import { describe, expect, it } from "vitest";

import type { CombinedProjectionRow, LeagueReadRow } from "./combined-projection-read-model";
import { buildH10LeagueValueModel } from "./h10-league-value";

describe("H10-lite league value engine", () => {
  it("makes Superflex QB replacement numerically deeper and scarcer than 1QB", () => {
    const oneQb = buildH10LeagueValueModel({ leagues: [league("one", ["QB", "RB", "WR", "TE", "BN", "BN"])], rows: rows("one") });
    const superflex = buildH10LeagueValueModel({ leagues: [league("sf", ["QB", "RB", "WR", "TE", "SUPER_FLEX", "BN", "BN"])], rows: rows("sf") });

    const oneQbLevel = oneQb.diagnosticsByLeague.one.replacementLevelsByPosition.QB;
    const sfLevel = superflex.diagnosticsByLeague.sf.replacementLevelsByPosition.QB;

    expect(sfLevel.replacementRank).toBeGreaterThan(oneQbLevel.replacementRank);
    expect(superflex.diagnosticsByLeague.sf.scarcityByPosition.QB.score).toBeGreaterThan(oneQb.diagnosticsByLeague.one.scarcityByPosition.QB.score);
  });

  it("increases replacement threshold with more direct starters", () => {
    const oneRb = buildH10LeagueValueModel({ leagues: [league("l1", ["QB", "RB", "WR", "TE"])], rows: rows("l1") });
    const twoRb = buildH10LeagueValueModel({ leagues: [league("l2", ["QB", "RB", "RB", "WR", "TE"])], rows: rows("l2") });

    expect(twoRb.diagnosticsByLeague.l2.replacementLevelsByPosition.RB.replacementRank).toBeGreaterThan(oneRb.diagnosticsByLeague.l1.replacementLevelsByPosition.RB.replacementRank);
  });

  it("allocates offensive flex and Superflex deterministically by median points", () => {
    const model = buildH10LeagueValueModel({ leagues: [league("sf", ["QB", "RB", "WR", "TE", "FLEX", "SUPER_FLEX"])], rows: rows("sf") });
    const summary = model.diagnosticsByLeague.sf.flexAllocationSummary;

    expect(summary.offensiveFlexAllocatedByPosition.RB).toBe(1);
    expect(summary.superflexAllocatedByPosition.QB).toBe(1);
    expect(summary.selectedPositions).toEqual(["RB", "QB"]);
  });

  it("allocates IDP flex and keeps K replacement shallow", () => {
    const model = buildH10LeagueValueModel({ leagues: [league("idp", ["DL", "LB", "DB", "IDP_FLEX", "K", "BN", "BN"])], rows: idpRows("idp") });
    const summary = model.diagnosticsByLeague.idp.flexAllocationSummary;

    expect(Object.values(summary.idpFlexAllocatedByPosition).reduce((sum, value) => sum + value, 0)).toBe(1);
    expect(model.diagnosticsByLeague.idp.replacementLevelsByPosition.K.replacementRank).toBeLessThanOrEqual(2);
  });

  it("caps K and DST scarcity at medium", () => {
    const model = buildH10LeagueValueModel({ leagues: [league("dst", ["K", "DST", "BN", "BN", "BN"])], rows: [...kRows("dst"), ...dstRows("dst")] });

    expect(model.diagnosticsByLeague.dst.scarcityByPosition.K.label).not.toMatch(/high|extreme/);
    expect(model.diagnosticsByLeague.dst.scarcityByPosition.DST.label).not.toMatch(/high|extreme/);
    expect(model.diagnosticsByLeague.dst.scarcityByPosition.K.score).toBeLessThanOrEqual(49);
    expect(model.diagnosticsByLeague.dst.scarcityByPosition.DST.score).toBeLessThanOrEqual(49);
  });

  it("creates deterministic tiers independent of input order and ADP fields", () => {
    const baseRows = rows("tier").map((row) => row.positionGroup === "WR" && row.entityId === "tier-wr-2" ? { ...row, marketRankDelta: 99 } : row);
    const a = buildH10LeagueValueModel({ leagues: [league("tier", ["WR", "WR", "BN"])], rows: baseRows });
    const b = buildH10LeagueValueModel({ leagues: [league("tier", ["WR", "WR", "BN"])], rows: [...baseRows].reverse() });

    const tiersA = a.rows.filter((row) => row.positionGroup === "WR").map((row) => [row.entityId, row.tier]);
    const tiersB = b.rows.filter((row) => row.positionGroup === "WR").map((row) => [row.entityId, row.tier]);
    expect(tiersA).toEqual(tiersB);
    expect(new Set(tiersA.map(([, tier]) => tier)).size).toBeGreaterThan(1);
  });

  it("reduces adjusted values for low confidence without mutating raw projection values", () => {
    const high = row("risk", "p-high", "WR", 200, 1, { confidenceLabel: "high" });
    const low = row("risk", "p-low", "WR", 200, 2, { confidenceLabel: "low" });
    const model = buildH10LeagueValueModel({ leagues: [league("risk", ["WR", "BN", "BN", "BN", "BN"])], rows: [high, low, row("risk", "p-repl", "WR", 100, 3)] });
    const highValue = model.rows.find((item) => item.entityId === "p-high")!;
    const lowValue = model.rows.find((item) => item.entityId === "p-low")!;

    expect(highValue.medianPoints).toBe(200);
    expect(lowValue.medianPoints).toBe(200);
    expect(lowValue.riskAdjustedValue).toBeLessThan(highValue.riskAdjustedValue);
  });

  it("penalizes DST allowance-only and leaves IDP/K low-confidence rows valued", () => {
    const model = buildH10LeagueValueModel({ leagues: [league("mixed", ["DST", "LB"])], rows: [...dstRows("mixed"), ...idpRows("mixed").filter((item) => item.positionGroup === "LB")] });
    const dst = model.rows.find((row) => row.positionGroup === "DST")!;
    const lb = model.rows.find((row) => row.positionGroup === "LB")!;

    expect(dst.valueReadiness).toBe("SCORING_PARTIAL_ALLOWANCE_ONLY");
    expect(dst.riskLabel).toBe("extreme");
    expect(lb.valueReadiness).toBe("LOW_CONFIDENCE_BASELINE");
    expect(lb.pointsAboveReplacement).toBeTypeOf("number");
  });

  it("maps market signals without changing value fields", () => {
    const base = row("market", "wr", "WR", 200, 1, { marketRankDelta: 20, marketComparisonStatus: "AVAILABLE" });
    const noMarket = row("market", "rb", "RB", 180, 1, { marketComparisonStatus: "NO_COMPATIBLE_MARKET", marketRankDelta: null });
    const model = buildH10LeagueValueModel({ leagues: [league("market", ["WR", "RB", "BN", "BN", "BN", "BN"])], rows: [base, noMarket, row("market", "wr2", "WR", 100, 2), row("market", "rb2", "RB", 90, 2)] });
    const valued = model.rows.find((item) => item.entityId === "wr")!;
    const missing = model.rows.find((item) => item.entityId === "rb")!;

    expect(valued.marketValueSignal).toBe("above_market");
    expect(missing.marketValueSignal).toBe("no_compatible_market");
    expect(valued.pointsAboveReplacement).toBe(100);
  });

  it("emits no forbidden recommendation or War Room fields and no invariant failures", () => {
    const model = buildH10LeagueValueModel({ leagues: [league("scope", ["QB", "RB", "WR", "TE", "FLEX"])], rows: rows("scope") });
    const keys = new Set(model.rows.flatMap((row) => Object.keys(row)));

    for (const forbidden of ["recommendation", "draftNow", "shouldDraft", "bestPick", "rosterNeed", "pickGrade"]) {
      expect(keys.has(forbidden)).toBe(false);
    }
    expect(model.invariantFailures).toEqual([]);
  });
});

function league(id: string, roster: string[]): LeagueReadRow {
  return { id, name: id, season: 2026, roster_positions_json: roster, scoring_settings_json: {} };
}

function rows(leagueId: string): CombinedProjectionRow[] {
  return [
    row(leagueId, `${leagueId}-qb-1`, "QB", 330, 1),
    row(leagueId, `${leagueId}-qb-2`, "QB", 300, 2),
    row(leagueId, `${leagueId}-qb-3`, "QB", 270, 3),
    row(leagueId, `${leagueId}-rb-1`, "RB", 250, 1),
    row(leagueId, `${leagueId}-rb-2`, "RB", 230, 2),
    row(leagueId, `${leagueId}-rb-3`, "RB", 175, 3),
    row(leagueId, `${leagueId}-wr-1`, "WR", 240, 1),
    row(leagueId, `tier-wr-2`, "WR", 180, 2),
    row(leagueId, `${leagueId}-wr-3`, "WR", 130, 3),
    row(leagueId, `${leagueId}-te-1`, "TE", 150, 1),
    row(leagueId, `${leagueId}-te-2`, "TE", 110, 2),
  ];
}

function idpRows(leagueId: string): CombinedProjectionRow[] {
  return [
    row(leagueId, "dl1", "DL", 120, 1, { projectionSource: "IDP_K_BASELINE_V1", projectionReadiness: "LOW_CONFIDENCE_BASELINE", marketComparisonStatus: "NOT_IMPLEMENTED_FOR_SOURCE" }),
    row(leagueId, "lb1", "LB", 140, 1, { projectionSource: "IDP_K_BASELINE_V1", projectionReadiness: "LOW_CONFIDENCE_BASELINE", marketComparisonStatus: "NOT_IMPLEMENTED_FOR_SOURCE" }),
    row(leagueId, "lb2", "LB", 130, 2, { projectionSource: "IDP_K_BASELINE_V1", projectionReadiness: "LOW_CONFIDENCE_BASELINE", marketComparisonStatus: "NOT_IMPLEMENTED_FOR_SOURCE" }),
    row(leagueId, "db1", "DB", 115, 1, { projectionSource: "IDP_K_BASELINE_V1", projectionReadiness: "LOW_CONFIDENCE_BASELINE", marketComparisonStatus: "NOT_IMPLEMENTED_FOR_SOURCE" }),
    ...kRows(leagueId),
  ];
}

function kRows(leagueId: string): CombinedProjectionRow[] {
  return [
    row(leagueId, "k1", "K", 120, 1, { projectionSource: "IDP_K_BASELINE_V1", projectionReadiness: "LOW_CONFIDENCE_BASELINE", marketComparisonStatus: "NOT_IMPLEMENTED_FOR_SOURCE" }),
    row(leagueId, "k2", "K", 118, 2, { projectionSource: "IDP_K_BASELINE_V1", projectionReadiness: "LOW_CONFIDENCE_BASELINE", marketComparisonStatus: "NOT_IMPLEMENTED_FOR_SOURCE" }),
  ];
}

function dstRows(leagueId: string): CombinedProjectionRow[] {
  return [
    row(leagueId, "dst1", "DST", 110, 1, { entityType: "TEAM_DEFENSE", projectionSource: "DST_ALLOWANCE_BASELINE_V1_DRY_RUN", projectionReadiness: "SCORING_PARTIAL_ALLOWANCE_ONLY", confidenceLabel: "very_low", marketComparisonStatus: "NOT_IMPLEMENTED_FOR_SOURCE", isPersisted: false }),
    row(leagueId, "dst2", "DST", 80, 2, { entityType: "TEAM_DEFENSE", projectionSource: "DST_ALLOWANCE_BASELINE_V1_DRY_RUN", projectionReadiness: "SCORING_PARTIAL_ALLOWANCE_ONLY", confidenceLabel: "very_low", marketComparisonStatus: "NOT_IMPLEMENTED_FOR_SOURCE", isPersisted: false }),
  ];
}

function row(leagueId: string, entityId: string, position: string, median: number, rank: number, overrides: Partial<CombinedProjectionRow> = {}): CombinedProjectionRow {
  return {
    leagueId,
    leagueName: leagueId,
    entityType: "PLAYER",
    entityId,
    displayName: entityId,
    team: "TST",
    position,
    positionGroup: position,
    projectionSource: "OFFENSE_BASELINE_V1",
    projectionRunId: "run",
    projectionMethod: "method",
    projectionReadiness: "READY",
    confidenceLabel: "medium",
    medianPoints: median,
    floorPoints: median - 20,
    ceilingPoints: median + 20,
    downsidePoints: median - 40,
    upsidePoints: median + 40,
    projectedPpgWhenInRole: median / 17,
    projectedPositionRank: rank,
    marketComparisonStatus: "AVAILABLE",
    marketOverallAdp: rank,
    marketPositionRank: rank,
    marketRankDelta: 0,
    marketDiscrepancyLabel: null,
    marketCompatibility: "compatible",
    marketConfidence: "medium",
    reasonCodes: [],
    warningCodes: [],
    explanationFragments: [],
    isPersisted: true,
    isDraftRelevant: true,
    ...overrides,
  };
}
