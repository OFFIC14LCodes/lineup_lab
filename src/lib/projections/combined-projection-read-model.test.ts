import { describe, expect, it } from "vitest";

import {
  buildCombinedProjectionReadModel,
  selectLatestCompleteRun,
  type LeagueReadRow,
  type MarketComparisonReadRow,
  type PlayerReadRow,
  type ProjectionOutputReadRow,
  type ProjectionReasonReadRow,
  type ProjectionRunReadRow,
} from "./combined-projection-read-model";
import { H911_PROJECTION_METHOD } from "./idp-k-persistence";
import { PROJECTION_METHOD } from "./constants";
import type { H912LeagueOutput } from "./dst-baseline-projections";

const runs: ProjectionRunReadRow[] = [
  run("off-old", PROJECTION_METHOD, 1, "2026-06-01T00:00:00Z"),
  run("off-new", PROJECTION_METHOD, 1, "2026-06-02T00:00:00Z"),
  run("idp-new", H911_PROJECTION_METHOD, 1, "2026-06-03T00:00:00Z"),
  { ...run("off-failed", PROJECTION_METHOD, 9, "2026-06-04T00:00:00Z"), run_status: "failed" },
];

const leagues: LeagueReadRow[] = [
  league("l-offense", ["QB", "RB", "WR", "TE", "BN"]),
  league("l-full", ["QB", "RB", "WR", "TE", "DL", "LB", "DB", "K", "DST", "BN"]),
];

const players: PlayerReadRow[] = [
  player("qb1", "Quarterback One", "QB", "NYJ"),
  player("lb1", "Linebacker One", "LB", "BAL"),
  player("k1", "Kicker One", "K", "DAL"),
];

const outputs: ProjectionOutputReadRow[] = [
  output("off-old", "qb1", "l-offense", "QB", 99, 1),
  output("off-new", "qb1", "l-offense", "QB", 120, 1),
  output("off-new", "qb1", "l-full", "QB", 121, 1),
  output("idp-new", "lb1", "l-full", "LB", 100, 1),
  output("idp-new", "k1", "l-full", "K", 90, 1),
  output("idp-new", "lb1", "l-offense", "LB", 100, 1),
];

const reasons: ProjectionReasonReadRow[] = [
  reason("off-new", "qb1", null, "SINGLE_SEASON_ONLY"),
  reason("idp-new", "lb1", "l-full", "IDP_LOW_SAMPLE"),
  reason("idp-new", "k1", "l-full", "K_TEAM_ENVIRONMENT_NOT_MODELED"),
];

const marketComparisons: MarketComparisonReadRow[] = [
  {
    projection_run_id: "off-new",
    canonical_player_id: "qb1",
    league_id: "l-offense",
    market_overall_adp: 42,
    market_position_rank: 8,
    rank_delta: 7,
    market_discrepancy_label: "moderate_disagreement",
    compatibility_label: "compatible",
    market_confidence_label: "medium",
    reason_codes: ["MARKET_DISAGREEMENT_HIGH"],
    format_warnings_json: [{ code: "FORMAT_WARNING" }],
  },
];

const dstOutputs: H912LeagueOutput[] = [{
  leagueId: "l-full",
  leagueName: "l-full",
  team: "BAL",
  position: "DST",
  downsidePoints: 10,
  floorPoints: 12,
  medianPoints: 14,
  ceilingPoints: 16,
  upsidePoints: 18,
  projectedPositionRank: 1,
  confidence: "very_low",
  scoringReadiness: "SCORING_PARTIAL_ALLOWANCE_ONLY",
  reasonCodes: ["DST_LOW_CONFIDENCE_BASELINE", "DST_BIG_PLAY_COMPONENTS_UNAVAILABLE", "SCORING_PARTIAL_ALLOWANCE_ONLY"],
  materialMissingScoringKeys: ["sack"],
  projectedComponents: {},
}];

describe("combined projection read model", () => {
  it("selects latest complete runs deterministically", () => {
    expect(selectLatestCompleteRun(runs, PROJECTION_METHOD)?.projection_run_id).toBe("off-new");
    expect(selectLatestCompleteRun([
      run("b", PROJECTION_METHOD, 1, "2026-06-02T00:00:00Z"),
      run("a", PROJECTION_METHOD, 1, "2026-06-02T00:00:00Z"),
    ], PROJECTION_METHOD)?.projection_run_id).toBe("a");
  });

  it("reads offensive rows from persisted outputs and joins offensive market comparisons", () => {
    const model = fixture({ leagueIds: ["l-offense"] });
    const row = model.rows.find((item) => item.entityId === "qb1")!;

    expect(row.projectionSource).toBe("OFFENSE_BASELINE_V1");
    expect(row.isPersisted).toBe(true);
    expect(row.medianPoints).toBe(120);
    expect(row.marketComparisonStatus).toBe("AVAILABLE");
    expect(row.marketOverallAdp).toBe(42);
    expect(row.reasonCodes).toContain("MARKET_DISAGREEMENT_HIGH");
    expect(row.warningCodes).toContain("FORMAT_WARNING");
  });

  it("reads IDP/K rows from persisted IDP/K outputs and marks market not implemented", () => {
    const model = fixture({ leagueIds: ["l-full"] });
    const lb = model.rows.find((row) => row.entityId === "lb1")!;
    const kicker = model.rows.find((row) => row.entityId === "k1")!;

    expect(lb.projectionSource).toBe("IDP_K_BASELINE_V1");
    expect(lb.marketComparisonStatus).toBe("NOT_IMPLEMENTED_FOR_SOURCE");
    expect(lb.reasonCodes).toContain("IDP_LOW_SAMPLE");
    expect(kicker.position).toBe("K");
    expect(kicker.reasonCodes).toContain("K_TEAM_ENVIRONMENT_NOT_MODELED");
  });

  it("makes DST optional, dry-run sourced, and not persisted", () => {
    expect(fixture({ leagueIds: ["l-full"] }).rows.some((row) => row.entityType === "TEAM_DEFENSE")).toBe(false);
    const model = fixture({ leagueIds: ["l-full"], includeDstDryRun: true });
    const dst = model.rows.find((row) => row.entityType === "TEAM_DEFENSE")!;

    expect(dst.projectionSource).toBe("DST_ALLOWANCE_BASELINE_V1_DRY_RUN");
    expect(dst.isPersisted).toBe(false);
    expect(dst.projectionReadiness).toBe("SCORING_PARTIAL_ALLOWANCE_ONLY");
    expect(dst.marketComparisonStatus).toBe("NOT_IMPLEMENTED_FOR_SOURCE");
    expect(dst.warningCodes).toContain("DST_BIG_PLAY_COMPONENTS_UNAVAILABLE");
  });

  it("filters non-rostered positions unless includeAllPositions is set", () => {
    const filtered = fixture({ leagueIds: ["l-offense"] });
    expect(filtered.rows.some((row) => row.position === "LB")).toBe(false);
    expect(filtered.leagueCoverage[0].exclusionReasons).toContain("IDP positions excluded: league does not roster IDP.");

    const debug = fixture({ leagueIds: ["l-offense"], includeAllPositions: true });
    expect(debug.rows.some((row) => row.position === "LB")).toBe(true);
  });

  it("sorts deterministically and supports position filtering", () => {
    const model = fixture({ leagueIds: ["l-full"], includeDstDryRun: true, position: "QB" });

    expect(model.rows.map((row) => row.position)).toEqual(["QB"]);
    expect(model.rows.map((row) => row.entityId)).toEqual(["qb1"]);
  });

  it("does not produce H10 valuation or War Room recommendation fields", () => {
    const model = fixture({ includeDstDryRun: true });
    const serialized = JSON.stringify(model.rows);

    expect(serialized).not.toContain("replacement");
    expect(serialized).not.toContain("recommendation");
    expect(serialized).not.toContain("draftTargetScore");
  });
});

function fixture(options = {}) {
  return buildCombinedProjectionReadModel({
    runs,
    outputs,
    players,
    leagues,
    reasons,
    marketComparisons,
    dstOutputs,
    options,
  });
}

function run(projection_run_id: string, method: string, projection_version: number, completed_at: string): ProjectionRunReadRow {
  return { projection_run_id, method, projection_version, selection_scope: "all", run_status: "complete", completed_at };
}

function league(id: string, roster: string[]): LeagueReadRow {
  return { id, name: id, season: 2026, roster_positions_json: roster, scoring_settings_json: {} };
}

function player(id: string, full_name: string, position: string, team: string): PlayerReadRow {
  return { id, full_name, position, position_group: position, team };
}

function output(projection_run_id: string, canonical_player_id: string, league_id: string, position: string, median: number, rank: number): ProjectionOutputReadRow {
  return {
    projection_run_id,
    canonical_player_id,
    league_id,
    position,
    projected_ppg_when_in_role: 10,
    floor_ppg: 8,
    ceiling_ppg: 12,
    downside_points: median - 20,
    floor_points: median - 10,
    median_points: median,
    ceiling_points: median + 10,
    upside_points: median + 20,
    projection_confidence_label: "low",
    projected_position_rank: rank,
    projection_method: null,
  };
}

function reason(projection_run_id: string, canonical_player_id: string, league_id: string | null, reason_code: string): ProjectionReasonReadRow {
  return { projection_run_id, canonical_player_id, league_id, reason_code, explanation: `${reason_code} explanation` };
}
