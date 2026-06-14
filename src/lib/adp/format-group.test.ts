// H7.2 — Format group classification, snapshot compatibility, and consensus breakdown tests

import { describe, expect, it } from "vitest";

import { buildConsensusAdpWithBreakdown } from "./consensus";
import type { SnapshotContribution } from "./consensus";
import {
  assignFormatGroupKey,
  assignFormatGroupKeyForLeague,
  classifySnapshotCompatibility,
  groupSnapshotsByFormat,
  selectBestFormatGroup,
} from "./format-group";
import { scoreFormatMatchByPosition } from "./format-match";
import type { AdpFormatProfile, PlayerAdpRecord } from "./types";

// ─── Shared fixtures ─────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<AdpFormatProfile> = {}): AdpFormatProfile {
  return {
    draftType: "redraft",
    platform: "mfl",
    scoringFormat: "ppr",
    pprValue: 1.0,
    tePremiumValue: 0,
    rosterPositions: ["QB", "RB", "WR", "TE", "FLEX", "BN"],
    teamCount: 12,
    isBestBall: false,
    isDynasty: false,
    isStartup: false,
    isSuperflex: false,
    isTePremium: false,
    ...overrides,
  };
}

function makeRecord(overrides: Partial<PlayerAdpRecord> = {}): PlayerAdpRecord {
  return {
    rawId: null,
    rawName: "Test Player",
    rawPosition: "WR",
    rawTeam: "SF",
    overallAdp: 24.0,
    overallRank: null,
    positionalAdp: null,
    positionalRank: null,
    minPick: null,
    maxPick: null,
    stddev: null,
    sampleSize: null,
    extraFields: {},
    canonicalPlayerId: "player-uuid-1",
    sleeperPlayerId: null,
    resolvedName: "Test Player",
    resolvedPosition: "WR",
    resolvedTeam: "SF",
    identityMatchMethod: "normalized_name_position_team",
    identityMatchConfidence: 0.98,
    isRookie: false,
    hasHistoricalProfile: true,
    ...overrides,
  };
}

function makeSnap(
  snapshotId: string,
  profile: AdpFormatProfile,
  records: PlayerAdpRecord[],
  overrides: Partial<SnapshotContribution> = {}
): SnapshotContribution {
  return {
    snapshotId,
    provider: "mfl",
    capturedAt: new Date().toISOString(),
    formatMatchScore: 1.0,
    sourceConfidenceScore: 0.75,
    sampleSize: 500,
    records,
    ...overrides,
  };
}

// ─── 1. Format group assignment ───────────────────────────────────────────────

describe("assignFormatGroupKey — format group classification", () => {
  it("assigns redraft_1qb for standard redraft", () => {
    expect(assignFormatGroupKey(makeProfile())).toBe("redraft_1qb");
  });

  it("assigns redraft_superflex for redraft with superflex", () => {
    expect(assignFormatGroupKey(makeProfile({ isSuperflex: true }))).toBe("redraft_superflex");
  });

  it("assigns dynasty_startup_1qb for dynasty startup 1QB", () => {
    expect(
      assignFormatGroupKey(makeProfile({ isDynasty: true, isStartup: true, draftType: "dynasty_startup" }))
    ).toBe("dynasty_startup_1qb");
  });

  it("assigns dynasty_startup_superflex for dynasty startup Superflex", () => {
    expect(
      assignFormatGroupKey(
        makeProfile({ isDynasty: true, isStartup: true, isSuperflex: true, draftType: "dynasty_startup" })
      )
    ).toBe("dynasty_startup_superflex");
  });

  it("assigns dynasty_ongoing_1qb for non-startup dynasty", () => {
    expect(
      assignFormatGroupKey(makeProfile({ isDynasty: true, isStartup: false, draftType: "dynasty_startup" }))
    ).toBe("dynasty_ongoing_1qb");
  });

  it("assigns best_ball for best ball format", () => {
    expect(
      assignFormatGroupKey(makeProfile({ isBestBall: true, draftType: "best_ball" }))
    ).toBe("best_ball");
  });
});

// ─── 2. Snapshot compatibility — incompatible cases ──────────────────────────

describe("classifySnapshotCompatibility — incompatible", () => {
  it("dynasty vs redraft is incompatible", () => {
    const a = makeProfile({ isDynasty: true, isStartup: true });
    const b = makeProfile({ isDynasty: false });
    const report = classifySnapshotCompatibility(a, b);
    expect(report.compatibility).toBe("incompatible");
    expect(report.reasons[0]).toMatch(/dynasty.*redraft/i);
  });

  it("startup vs ongoing dynasty is incompatible", () => {
    const a = makeProfile({ isDynasty: true, isStartup: true });
    const b = makeProfile({ isDynasty: true, isStartup: false });
    const report = classifySnapshotCompatibility(a, b);
    expect(report.compatibility).toBe("incompatible");
    expect(report.reasons[0]).toMatch(/startup.*ongoing/i);
  });

  it("best-ball vs standard draft is incompatible", () => {
    const a = makeProfile({ isBestBall: true });
    const b = makeProfile({ isBestBall: false });
    const report = classifySnapshotCompatibility(a, b);
    expect(report.compatibility).toBe("incompatible");
    expect(report.reasons[0]).toMatch(/best.ball/i);
  });
});

// ─── 3. Snapshot compatibility — partial ─────────────────────────────────────

describe("classifySnapshotCompatibility — partially_compatible", () => {
  it("superflex vs 1QB is partially compatible", () => {
    const a = makeProfile({ isSuperflex: true });
    const b = makeProfile({ isSuperflex: false });
    const report = classifySnapshotCompatibility(a, b);
    expect(report.compatibility).toBe("partially_compatible");
    expect(report.reasons[0]).toMatch(/superflex/i);
  });

  it("PPR vs standard (diff ≥ 0.5) is partially compatible", () => {
    const a = makeProfile({ pprValue: 1.0 });
    const b = makeProfile({ pprValue: 0.0 });
    const report = classifySnapshotCompatibility(a, b);
    expect(report.compatibility).toBe("partially_compatible");
    expect(report.reasons[0]).toMatch(/ppr/i);
  });

  it("large team count gap (>4) is partially compatible", () => {
    const a = makeProfile({ teamCount: 12 });
    const b = makeProfile({ teamCount: 6 });
    const report = classifySnapshotCompatibility(a, b);
    expect(report.compatibility).toBe("partially_compatible");
    expect(report.reasons[0]).toMatch(/team count/i);
  });

  it("same format returns compatible with no reasons", () => {
    const a = makeProfile();
    const b = makeProfile();
    const report = classifySnapshotCompatibility(a, b);
    expect(report.compatibility).toBe("compatible");
    expect(report.reasons).toHaveLength(0);
  });
});

// ─── 4. Format group selection for a league ──────────────────────────────────

describe("selectBestFormatGroup", () => {
  it("returns exact match when available", () => {
    const profile = makeProfile({ isSuperflex: false });
    const groups = groupSnapshotsByFormat([{ id: "snap-1", formatProfile: profile }]);
    const result = selectBestFormatGroup(groups, { isDynasty: false, isSuperflex: false, isBestBall: false });
    expect(result?.compatibility).toBe("compatible");
    expect(result?.group.key).toBe("redraft_1qb");
  });

  it("falls back to opposite superflex when exact match is missing", () => {
    // Only have Superflex snapshot, but league wants 1QB
    const sfProfile = makeProfile({ isSuperflex: true });
    const groups = groupSnapshotsByFormat([{ id: "snap-sf", formatProfile: sfProfile }]);
    const result = selectBestFormatGroup(groups, { isDynasty: false, isSuperflex: false, isBestBall: false });
    expect(result?.compatibility).toBe("partially_compatible");
    expect(result?.warnings[0]).toMatch(/no 1QB/i);
  });

  it("returns null when no groups available", () => {
    const result = selectBestFormatGroup(new Map(), { isDynasty: false, isSuperflex: false, isBestBall: false });
    expect(result).toBeNull();
  });

  it("returns incompatible cross-group when only opposite dynasty type is available", () => {
    const dynastyProfile = makeProfile({ isDynasty: true, isStartup: true });
    const groups = groupSnapshotsByFormat([{ id: "snap-dynasty", formatProfile: dynastyProfile }]);
    const result = selectBestFormatGroup(groups, { isDynasty: false, isSuperflex: false, isBestBall: false });
    expect(result?.compatibility).toBe("incompatible");
  });
});

// ─── 5. Position-specific format match scores ─────────────────────────────────

describe("scoreFormatMatchByPosition — position-specific weights", () => {
  it("QB score is low when superflex mismatches", () => {
    const profile = makeProfile({ isSuperflex: true }); // snapshot has superflex
    const league = { leagueId: "lg1", pprValue: 1.0, tePremiumValue: 0, teamCount: 12, isDynasty: false, isSuperflex: false, isBestBall: false };
    const scores = scoreFormatMatchByPosition(profile, league);
    const qb = scores.find((s) => s.position === "QB")!;
    // QB weight for superflex is 0.48 — mismatch penalty is severe
    expect(qb.score).toBeLessThan(0.7);
    expect(qb.warnings[0]).toMatch(/superflex/i);
  });

  it("TE score is low when TE-premium mismatches", () => {
    const profile = makeProfile({ tePremiumValue: 0.5, isTePremium: true });
    const league = { leagueId: "lg1", pprValue: 1.0, tePremiumValue: 0, teamCount: 12, isDynasty: false, isSuperflex: false, isBestBall: false };
    const scores = scoreFormatMatchByPosition(profile, league);
    const te = scores.find((s) => s.position === "TE")!;
    // TE premium weight is 0.38 — mismatch hits TE hard
    expect(te.score).toBeLessThan(0.8);
    expect(te.warnings[0]).toMatch(/te.premium/i);
  });

  it("RB and WR scores are low when PPR mismatches by full point", () => {
    const profile = makeProfile({ pprValue: 0.0, scoringFormat: "standard" });
    const league = { leagueId: "lg1", pprValue: 1.0, tePremiumValue: 0, teamCount: 12, isDynasty: false, isSuperflex: false, isBestBall: false };
    const scores = scoreFormatMatchByPosition(profile, league);
    const rb = scores.find((s) => s.position === "RB")!;
    const wr = scores.find((s) => s.position === "WR")!;
    expect(rb.score).toBeLessThan(0.7);
    expect(wr.score).toBeLessThan(0.7);
    expect(rb.warnings[0]).toMatch(/ppr/i);
    expect(wr.warnings[0]).toMatch(/ppr/i);
  });

  it("returns 4 entries (QB/RB/WR/TE) for every call", () => {
    const profile = makeProfile();
    const league = { leagueId: "lg1", pprValue: 1.0, tePremiumValue: 0, teamCount: 12, isDynasty: false, isSuperflex: false, isBestBall: false };
    const scores = scoreFormatMatchByPosition(profile, league);
    expect(scores.map((s) => s.position)).toEqual(["QB", "RB", "WR", "TE"]);
  });
});

// ─── 6. Consensus with breakdown ─────────────────────────────────────────────

describe("buildConsensusAdpWithBreakdown", () => {
  it("returns breakdown keyed by canonicalPlayerId", () => {
    const rec = makeRecord({ canonicalPlayerId: "player-1", overallAdp: 10 });
    const snap = makeSnap("snap-1", makeProfile(), [rec]);
    const { records, breakdowns } = buildConsensusAdpWithBreakdown([snap]);
    expect(records).toHaveLength(1);
    expect(breakdowns.has("player-1")).toBe(true);
  });

  it("provider disagreement is null for single source", () => {
    const rec = makeRecord({ canonicalPlayerId: "player-1", overallAdp: 10 });
    const snap = makeSnap("snap-1", makeProfile(), [rec]);
    const { breakdowns } = buildConsensusAdpWithBreakdown([snap]);
    expect(breakdowns.get("player-1")!.providerDisagreement).toBeNull();
  });

  it("provider disagreement is max–min ADP spread across sources", () => {
    const rec1 = makeRecord({ canonicalPlayerId: "player-1", overallAdp: 10 });
    const rec2 = makeRecord({ canonicalPlayerId: "player-1", overallAdp: 20 });
    const snap1 = makeSnap("snap-1", makeProfile(), [rec1], { provider: "mfl", sampleSize: 500, sourceConfidenceScore: 1.0, formatMatchScore: 1.0 });
    const snap2 = makeSnap("snap-2", makeProfile(), [rec2], { provider: "fantasypros", sampleSize: 500, sourceConfidenceScore: 1.0, formatMatchScore: 1.0 });
    const { breakdowns } = buildConsensusAdpWithBreakdown([snap1, snap2]);
    const bd = breakdowns.get("player-1")!;
    expect(bd.providerDisagreement).toBeCloseTo(10, 0);
  });

  it("market confidence is high for 2+ providers with low disagreement and large sample", () => {
    const rec1 = makeRecord({ canonicalPlayerId: "player-1", overallAdp: 10 });
    const rec2 = makeRecord({ canonicalPlayerId: "player-1", overallAdp: 12 }); // disagreement=2
    const snap1 = makeSnap("snap-1", makeProfile(), [rec1], { provider: "mfl", sampleSize: 400, sourceConfidenceScore: 1.0, formatMatchScore: 1.0 });
    const snap2 = makeSnap("snap-2", makeProfile(), [rec2], { provider: "fantasypros", sampleSize: 400, sourceConfidenceScore: 1.0, formatMatchScore: 1.0 });
    const { breakdowns } = buildConsensusAdpWithBreakdown([snap1, snap2]);
    expect(breakdowns.get("player-1")!.marketConfidence).toBe("high");
  });

  it("market confidence is low for single small source", () => {
    const rec = makeRecord({ canonicalPlayerId: "player-1", overallAdp: 10 });
    const snap = makeSnap("snap-1", makeProfile(), [rec], { sampleSize: 50 });
    const { breakdowns } = buildConsensusAdpWithBreakdown([snap]);
    expect(breakdowns.get("player-1")!.marketConfidence).toBe("low");
  });

  it("rookie in consensus without historical profile still gets a breakdown", () => {
    const rec = makeRecord({
      canonicalPlayerId: "rookie-1",
      overallAdp: 30,
      isRookie: true,
      hasHistoricalProfile: false,
    });
    const snap = makeSnap("snap-1", makeProfile(), [rec]);
    const { records, breakdowns } = buildConsensusAdpWithBreakdown([snap]);
    expect(records.find((r) => r.canonicalPlayerId === "rookie-1")).toBeDefined();
    expect(breakdowns.has("rookie-1")).toBe(true);
  });

  it("reruns produce deterministic results", () => {
    const rec = makeRecord({ canonicalPlayerId: "player-1", overallAdp: 18 });
    const snap = makeSnap("snap-1", makeProfile(), [rec]);
    const ref = new Date("2026-06-01T00:00:00Z");
    const r1 = buildConsensusAdpWithBreakdown([snap], ref);
    const r2 = buildConsensusAdpWithBreakdown([snap], ref);
    expect(r1.records[0].overallAdp).toBe(r2.records[0].overallAdp);
    expect(r1.breakdowns.get("player-1")!.marketConfidence).toBe(
      r2.breakdowns.get("player-1")!.marketConfidence
    );
  });
});

// ─── 7. assignFormatGroupKeyForLeague ────────────────────────────────────────

describe("assignFormatGroupKeyForLeague", () => {
  it("returns redraft_1qb for standard redraft league", () => {
    expect(assignFormatGroupKeyForLeague({ isDynasty: false, isSuperflex: false, isBestBall: false })).toBe("redraft_1qb");
  });

  it("returns dynasty_startup_superflex for dynasty Superflex league", () => {
    expect(assignFormatGroupKeyForLeague({ isDynasty: true, isSuperflex: true, isBestBall: false })).toBe("dynasty_startup_superflex");
  });

  it("returns best_ball for best-ball league", () => {
    expect(assignFormatGroupKeyForLeague({ isDynasty: false, isSuperflex: false, isBestBall: true })).toBe("best_ball");
  });
});
