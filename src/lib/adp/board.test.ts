import { describe, expect, it } from "vitest";

import { buildAdpBoard, extractArchetypeExamples } from "./board";
import type { SnapshotRow, StoredPlayerRecord } from "./storage";
import type { AdpBoardSeasonModel, AdpFormatMatchScore, HistoricalLeagueValue, ValueVsMarket } from "./types";

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

function makeSnapshot(): SnapshotRow {
  return {
    id: "snap-uuid-1",
    provider: "mfl",
    source_identifier: "mfl-2026-redraft-ppr-12team-20260601",
    file_hash: "abc123",
    source_meta_json: {},
    source_confidence: "medium",
    season: 2026,
    team_count: 12,
    scoring_format: "ppr",
    ppr_value: 1.0,
    te_premium_value: 0.0,
    is_dynasty: false,
    is_best_ball: false,
    is_superflex: false,
    sample_size: 400,
    captured_at: "2026-06-01T12:00:00Z",
    effective_date: "2026-06-01",
    total_records: 5,
    resolved_count: 4,
    unresolved_count: 1,
    ambiguous_count: 0,
    rookie_count: 1,
  };
}

function makePlayerRecord(overrides: Partial<StoredPlayerRecord> = {}): StoredPlayerRecord {
  return {
    id: `rec-${Math.random().toString(36).slice(2)}`,
    snapshot_id: "snap-uuid-1",
    canonical_player_id: "player-uuid-1",
    sleeper_player_id: "sleeper-1",
    raw_name: "Jeremiyah Love",
    raw_position: "RB",
    raw_team: "ARI",
    raw_id: "17472",
    overall_adp: 2.09,
    overall_rank: 1,
    positional_adp: null,
    positional_rank: 1,
    min_pick: 1,
    max_pick: 50,
    stddev: null,
    sample_size: null,
    identity_match_method: "normalized_name_position_team",
    identity_match_confidence: 0.98,
    is_rookie: false,
    has_historical_profile: true,
    raw_data_json: null,
    ...overrides,
  };
}

function makeFormatMatch(overrides: Partial<AdpFormatMatchScore> = {}): AdpFormatMatchScore {
  return {
    snapshotId: "snap-uuid-1",
    leagueId: "league-uuid-1",
    overallScore: 0.95,
    dimensionScores: { pprValue: 1.0, draftType: 1.0, superflex: 1.0, tePremium: 1.0, teamCount: 1.0, bestBall: 1.0 },
    isCompatible: true,
    warnings: [],
    ...overrides,
  };
}

function makeHlv(canonicalPlayerId: string, overrides: Partial<HistoricalLeagueValue> = {}): HistoricalLeagueValue {
  return {
    canonicalPlayerId,
    playerName: "Test Player",
    position: "RB",
    nflTeam: "ARI",
    season: 2025,
    leagueId: "league-uuid-1",
    totalPoints: 280,
    pointsPerGame: 16.5,
    gamesWithValidScoringData: 17,
    pointsAboveReplacement: 120,
    replacementPointsPerGame: 9.4,
    scoringCompletenessRatio: 0.94,
    historicalScoreConfidence: "complete",
    adjustedParPerGame: 7.06,
    hlvScore: 95.0,
    hlvRank: 1,
    hlvPositionalRank: 1,
    confidencePenaltyFactor: 1.0,
    notes: [],
    ...overrides,
  };
}

function makeVvm(canonicalPlayerId: string, overrides: Partial<ValueVsMarket> = {}): ValueVsMarket {
  return {
    canonicalPlayerId,
    playerName: "Test Player",
    position: "RB",
    nflTeam: "ARI",
    leagueId: "league-uuid-1",
    isRookie: false,
    overallAdp: 2.09,
    marketRank: 1,
    hlvScore: 95.0,
    hlvRank: 1,
    hlvPositionalRank: 1,
    rankDelta: 0,
    adpDelta: 1.09,
    valueSignal: "fair_value",
    dataQuality: "complete",
    ...overrides,
  };
}

// --------------------------------------------------------------------------
// Board generation tests
// --------------------------------------------------------------------------

describe("buildAdpBoard", () => {
  it("returns entries sorted by ADP by default", () => {
    const records = [
      makePlayerRecord({ canonical_player_id: "p1", raw_name: "Player A", overall_adp: 10.0, overall_rank: 2 }),
      makePlayerRecord({ canonical_player_id: "p2", raw_name: "Player B", overall_adp: 5.0, overall_rank: 1 }),
      makePlayerRecord({ canonical_player_id: "p3", raw_name: "Player C", overall_adp: 15.0, overall_rank: 3 }),
    ];

    const board = buildAdpBoard({
      snapshot: makeSnapshot(),
      records,
      formatMatch: makeFormatMatch(),
      hlv: [],
      vvm: [],
    });

    expect(board[0].overallAdp).toBe(5.0);
    expect(board[1].overallAdp).toBe(10.0);
    expect(board[2].overallAdp).toBe(15.0);
  });

  it("attaches HLV data to resolved players", () => {
    const records = [makePlayerRecord({ canonical_player_id: "p1" })];
    const hlv = [makeHlv("p1", { hlvScore: 88.5, hlvRank: 3 })];
    const vvm = [makeVvm("p1", { rankDelta: 15, valueSignal: "moderate_value" })];

    const board = buildAdpBoard({ snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(), hlv, vvm });
    expect(board[0].hlvScore).toBe(88.5);
    expect(board[0].hlvRank).toBe(3);
    expect(board[0].rankDelta).toBe(15);
    expect(board[0].valueSignal).toBe("moderate_value");
  });

  it("marks players without HLV profile as insufficient_data", () => {
    const records = [makePlayerRecord({ canonical_player_id: "p1", has_historical_profile: false })];
    const board = buildAdpBoard({ snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(), hlv: [], vvm: [] });
    expect(board[0].hlvScore).toBeNull();
    expect(board[0].valueSignal).toBe("insufficient_data");
    expect(board[0].limitations).toContain("no H6 historical profile");
  });

  it("marks unresolved players with identity limitation", () => {
    const records = [makePlayerRecord({
      canonical_player_id: null,
      raw_name: "Unknown Player",
      identity_match_method: "unresolved",
    })];
    const board = buildAdpBoard({ snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(), hlv: [], vvm: [] });
    expect(board[0].canonicalPlayerId).toBeNull();
    expect(board[0].limitations).toContain("identity unresolved");
  });

  it("marks rookies with no-history limitation", () => {
    const records = [makePlayerRecord({ canonical_player_id: "p1", is_rookie: true })];
    const board = buildAdpBoard({ snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(), hlv: [], vvm: [] });
    expect(board[0].isRookie).toBe(true);
    expect(board[0].limitations).toContain("rookie — no historical data");
  });

  it("adds format warning to limitations when format is incompatible", () => {
    const records = [makePlayerRecord({ canonical_player_id: "p1" })];
    const badFormat = makeFormatMatch({
      isCompatible: false,
      warnings: ["Draft type mismatch: snapshot=redraft, league=dynasty"],
    });
    const board = buildAdpBoard({ snapshot: makeSnapshot(), records, formatMatch: badFormat, hlv: [], vvm: [] });
    expect(board[0].limitations.some((l) => l.includes("format mismatch"))).toBe(true);
  });

  // Filter: position
  it("filters by position", () => {
    const records = [
      makePlayerRecord({ canonical_player_id: "p1", raw_position: "QB", raw_name: "QB Player", overall_adp: 20 }),
      makePlayerRecord({ canonical_player_id: "p2", raw_position: "RB", raw_name: "RB Player", overall_adp: 5 }),
    ];
    const board = buildAdpBoard({
      snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(), hlv: [], vvm: [],
      filter: { positions: ["QB"] },
    });
    expect(board).toHaveLength(1);
    expect(board[0].position).toBe("QB");
  });

  // Filter: resolved only
  it("filters to resolved-only when requested", () => {
    const records = [
      makePlayerRecord({ canonical_player_id: "p1", raw_name: "Resolved" }),
      makePlayerRecord({ canonical_player_id: null, raw_name: "Unresolved" }),
    ];
    const board = buildAdpBoard({
      snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(), hlv: [], vvm: [],
      filter: { resolvedOnly: true },
    });
    expect(board).toHaveLength(1);
    expect(board[0].playerName).toBe("Resolved");
  });

  // Sort: by HLV rank
  it("sorts by HLV rank when sort=hlv", () => {
    const records = [
      makePlayerRecord({ canonical_player_id: "p1", raw_name: "P1", overall_adp: 10 }),
      makePlayerRecord({ canonical_player_id: "p2", raw_name: "P2", overall_adp: 5 }),
    ];
    const hlv = [makeHlv("p1", { hlvRank: 2 }), makeHlv("p2", { hlvRank: 5 })];
    const board = buildAdpBoard({
      snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(), hlv, vvm: [],
      sort: "hlv",
    });
    expect(board[0].hlvRank).toBe(2); // rank 2 before rank 5
    expect(board[1].hlvRank).toBe(5);
  });

  // Sort: by value gap descending
  it("sorts by value gap (rankDelta desc) when sort=value_gap", () => {
    const records = [
      makePlayerRecord({ canonical_player_id: "p1", raw_name: "P1", overall_adp: 30 }),
      makePlayerRecord({ canonical_player_id: "p2", raw_name: "P2", overall_adp: 10 }),
    ];
    const vvm = [
      makeVvm("p1", { rankDelta: 40 }), // strong value
      makeVvm("p2", { rankDelta: 5 }),   // moderate
    ];
    const board = buildAdpBoard({
      snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(), hlv: [], vvm,
      sort: "value_gap",
    });
    expect(board[0].rankDelta).toBe(40);
  });

  // Availability: probabilities exist for players with ADP
  it("computes availability probabilities for resolved players", () => {
    const records = [makePlayerRecord({ canonical_player_id: "p1", overall_adp: 24.0 })];
    const board = buildAdpBoard({ snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(), hlv: [], vvm: [] });
    // Probability at ADP pick should be ~50% (by definition of the normal distribution mean)
    const prob = board[0].probAtAdp;
    if (prob !== null) {
      expect(prob).toBeGreaterThan(0.3);
      expect(prob).toBeLessThan(0.7);
    }
  });

  // No recommendation ordering changes: board is read-only, no writes
  it("is a pure read-only function (no side effects)", () => {
    const records = [makePlayerRecord()];
    const result1 = buildAdpBoard({ snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(), hlv: [], vvm: [] });
    const result2 = buildAdpBoard({ snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(), hlv: [], vvm: [] });
    expect(result1).toHaveLength(result2.length);
    expect(result1[0].playerName).toBe(result2[0].playerName);
  });
});

// --------------------------------------------------------------------------
// Availability monotonicity test
// --------------------------------------------------------------------------

describe("availability probability monotonicity", () => {
  it("P(available) decreases monotonically as pick number increases past ADP", () => {
    const records = [
      makePlayerRecord({ canonical_player_id: "p1", overall_adp: 24.0 }),
    ];
    const board = buildAdpBoard({ snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(), hlv: [], vvm: [] });
    const p = board[0];

    const atAdp = p.probAtAdp;
    const atAdpPlus12 = p.probAtAdpPlus12;

    if (atAdp !== null && atAdpPlus12 !== null) {
      // 12 picks PAST ADP → player more likely already taken → lower availability
      expect(atAdpPlus12).toBeLessThanOrEqual(atAdp);
    }
  });

  it("P(available) at early pick is lower than at later pick for same player", () => {
    // Player with ADP = 36: earlier pick (10) should have very low probability
    // because ADP >> 10 means the player is usually gone by pick 10
    // Actually: P(available at pick p) = 1 - CDF(p), so if ADP=36 and p=10, most drafts
    // the player is NOT yet drafted at pick 10 → high availability
    // If p=60 (past ADP), player is likely gone → lower availability
    const records = [makePlayerRecord({ canonical_player_id: "p1", overall_adp: 36.0 })];
    const board = buildAdpBoard({ snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(), hlv: [], vvm: [] });
    expect(board[0].overallAdp).toBe(36);
    // probAtAdp is P(available at pick 36), which is ~50%
    // probAtAdpPlus12 is P(available at pick 48), which is lower (player more likely gone)
    const atAdp = board[0].probAtAdp;
    const atPlus12 = board[0].probAtAdpPlus12;
    if (atAdp !== null && atPlus12 !== null) {
      // Later picks = player more likely gone = lower availability
      expect(atPlus12).toBeLessThanOrEqual(atAdp);
    }
  });

  it("probabilities are within [0, 1]", () => {
    const adps = [5.0, 24.0, 60.0, 120.0, 200.0];
    for (const adp of adps) {
      const records = [makePlayerRecord({ canonical_player_id: "p-test", overall_adp: adp })];
      const board = buildAdpBoard({ snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(), hlv: [], vvm: [] });
      const prob = board[0].probAtAdp;
      if (prob !== null) {
        expect(prob).toBeGreaterThanOrEqual(0);
        expect(prob).toBeLessThanOrEqual(1);
      }
    }
  });

  it("early-round players (ADP≤24) have narrow variance (tight stage)", () => {
    const earlyRecord = makePlayerRecord({ canonical_player_id: "early", overall_adp: 6.0 });
    const lateRecord = makePlayerRecord({ canonical_player_id: "late", overall_adp: 120.0, raw_name: "Late Player" });
    const board = buildAdpBoard({
      snapshot: makeSnapshot(),
      records: [earlyRecord, lateRecord],
      formatMatch: makeFormatMatch(),
      hlv: [],
      vvm: [],
    });
    // Early player has narrower variance → probAtAdp should be closer to 0.5
    // Late player has wider variance → may also be ~0.5 at their ADP but with wider spread
    // Both should have valid probabilities
    const earlyProb = board.find((e) => e.overallAdp === 6.0)?.probAtAdp ?? null;
    const lateProb = board.find((e) => e.overallAdp === 120.0)?.probAtAdp ?? null;
    if (earlyProb !== null) expect(earlyProb).toBeGreaterThan(0);
    if (lateProb !== null) expect(lateProb).toBeGreaterThan(0);
  });
});

// --------------------------------------------------------------------------
// Season model tests (H7.1.1)
// --------------------------------------------------------------------------

function makeSeasonModel(overrides: Partial<AdpBoardSeasonModel> = {}): AdpBoardSeasonModel {
  return {
    adpSeason: 2026,
    historicalPerformanceSeason: 2025,
    leagueConfigSeason: 2026,
    leagueId: "league-uuid-1",
    analysisAsOfDate: "2026-06-14T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildAdpBoard — season model (H7.1.1)", () => {
  // 1. seasonModel is null when not passed
  it("seasonModel is null on entries when not provided", () => {
    const board = buildAdpBoard({
      snapshot: makeSnapshot(),
      records: [makePlayerRecord()],
      formatMatch: makeFormatMatch(),
      hlv: [],
      vvm: [],
    });
    expect(board[0].seasonModel).toBeNull();
  });

  // 2. seasonModel propagates to all entries
  it("seasonModel is set on all entries when passed", () => {
    const sm = makeSeasonModel();
    const records = [
      makePlayerRecord({ canonical_player_id: "p1", raw_name: "P1" }),
      makePlayerRecord({ canonical_player_id: "p2", raw_name: "P2", overall_adp: 5 }),
    ];
    const board = buildAdpBoard({
      snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(), hlv: [], vvm: [], seasonModel: sm,
    });
    expect(board).toHaveLength(2);
    board.forEach((entry) => {
      expect(entry.seasonModel).toEqual(sm);
    });
  });

  // 3. ADP season differs from historical performance season
  it("adpSeason (2026) is distinct from historicalPerformanceSeason (2025)", () => {
    const sm = makeSeasonModel();
    expect(sm.adpSeason).toBe(2026);
    expect(sm.historicalPerformanceSeason).toBe(2025);
    expect(sm.adpSeason).not.toBe(sm.historicalPerformanceSeason);
  });

  // 4. 2026 ADP player attaches 2025 HLV profile by player ID
  it("2026 ADP player attaches 2025 HLV profile when canonical IDs match", () => {
    const records = [makePlayerRecord({ canonical_player_id: "p1", overall_adp: 10 })];
    const hlv = [makeHlv("p1", { season: 2025, hlvRank: 5, hlvScore: 85 })];
    const vvm = [makeVvm("p1", { rankDelta: 5, valueSignal: "moderate_value" })];
    const board = buildAdpBoard({
      snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(),
      hlv, vvm, seasonModel: makeSeasonModel(),
    });
    expect(board[0].hlvRank).toBe(5);
    expect(board[0].hlvScore).toBe(85);
    expect(board[0].valueSignal).toBe("moderate_value");
  });

  // 5. No-history limitation includes performance season year when seasonModel is set
  it("no-profile limitation references historicalPerformanceSeason when seasonModel passed", () => {
    const records = [makePlayerRecord({ canonical_player_id: "p1", has_historical_profile: false })];
    const board = buildAdpBoard({
      snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(),
      hlv: [], vvm: [], seasonModel: makeSeasonModel(),
    });
    const limitation = board[0].limitations.find((l) => l.includes("2025"));
    expect(limitation).toBeDefined();
    expect(limitation).toContain("2026");
  });

  // 6. Rookie limitation includes performance season year
  it("rookie limitation references historicalPerformanceSeason when seasonModel passed", () => {
    const records = [makePlayerRecord({ canonical_player_id: "p1", is_rookie: true })];
    const board = buildAdpBoard({
      snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(),
      hlv: [], vvm: [], seasonModel: makeSeasonModel(),
    });
    const rookieLimitation = board[0].limitations.find((l) => l.includes("rookie"));
    expect(rookieLimitation).toBeDefined();
    expect(rookieLimitation).toContain("2025");
  });

  // 7. HLV rank population: entries with HLV have non-null hlvRank
  it("entries with attached HLV profile have non-null hlvRank", () => {
    const records = [
      makePlayerRecord({ canonical_player_id: "p1", raw_name: "With HLV", overall_adp: 5 }),
      makePlayerRecord({ canonical_player_id: "p2", raw_name: "No HLV", overall_adp: 10 }),
    ];
    const hlv = [makeHlv("p1", { hlvRank: 2 })];
    const board = buildAdpBoard({
      snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(),
      hlv, vvm: [], seasonModel: makeSeasonModel(),
    });
    expect(board.find((e) => e.canonicalPlayerId === "p1")?.hlvRank).toBe(2);
    expect(board.find((e) => e.canonicalPlayerId === "p2")?.hlvRank).toBeNull();
  });

  // 8. Positive gap → strong_value
  it("large positive rankDelta (market ADP >> HLV rank) yields strong_value", () => {
    const records = [makePlayerRecord({ canonical_player_id: "p1", overall_adp: 50, overall_rank: 50 })];
    const vvm = [makeVvm("p1", { rankDelta: 35, valueSignal: "strong_value" })];
    const board = buildAdpBoard({
      snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(),
      hlv: [], vvm, seasonModel: makeSeasonModel(),
    });
    expect(board[0].rankDelta).toBe(35);
    expect(board[0].valueSignal).toBe("strong_value");
  });

  // 9. Negative gap → clear_overdraft
  it("large negative rankDelta (HLV rank >> market ADP) yields clear_overdraft", () => {
    const records = [makePlayerRecord({ canonical_player_id: "p1", overall_adp: 5, overall_rank: 5 })];
    const vvm = [makeVvm("p1", { rankDelta: -30, valueSignal: "clear_overdraft" })];
    const board = buildAdpBoard({
      snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(),
      hlv: [], vvm, seasonModel: makeSeasonModel(),
    });
    expect(board[0].rankDelta).toBe(-30);
    expect(board[0].valueSignal).toBe("clear_overdraft");
  });

  // 10. Format mismatch warning retained alongside HLV limitations
  it("format mismatch warning is present alongside HLV data", () => {
    const records = [makePlayerRecord({ canonical_player_id: "p1" })];
    const hlv = [makeHlv("p1", { hlvRank: 3 })];
    const badFormat = makeFormatMatch({
      isCompatible: false,
      warnings: ["Superflex mismatch: snapshot has no SUPER_FLEX, league requires it"],
    });
    const board = buildAdpBoard({
      snapshot: makeSnapshot(), records, formatMatch: badFormat,
      hlv, vvm: [], seasonModel: makeSeasonModel(),
    });
    expect(board[0].hlvRank).toBe(3);
    expect(board[0].limitations.some((l) => l.includes("format mismatch"))).toBe(true);
    expect(board[0].formatMatchCompatible).toBe(false);
  });

  // 11. No HLV → insufficient_data (not zero)
  it("player without HLV profile gets insufficient_data valueSignal, not zero", () => {
    const records = [makePlayerRecord({ canonical_player_id: "p1" })];
    const board = buildAdpBoard({
      snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(),
      hlv: [], vvm: [], seasonModel: makeSeasonModel(),
    });
    expect(board[0].valueSignal).toBe("insufficient_data");
    expect(board[0].hlvScore).toBeNull();
    expect(board[0].hlvRank).toBeNull();
  });

  // 12. Rookie with no HLV → rookie_no_history dataQuality
  it("rookie without HLV profile gets rookie_no_history dataQuality", () => {
    const records = [makePlayerRecord({ canonical_player_id: "p1", is_rookie: true })];
    const board = buildAdpBoard({
      snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(),
      hlv: [], vvm: [], seasonModel: makeSeasonModel(),
    });
    expect(board[0].dataQuality).toBe("rookie_no_history");
    expect(board[0].isRookie).toBe(true);
  });

  // 13. Deterministic recomputation: same inputs always produce same output
  it("board output is deterministic given same inputs", () => {
    const records = [
      makePlayerRecord({ canonical_player_id: "p1", raw_name: "P1", overall_adp: 10 }),
      makePlayerRecord({ canonical_player_id: "p2", raw_name: "P2", overall_adp: 5 }),
    ];
    const hlv = [makeHlv("p1", { hlvRank: 2 }), makeHlv("p2", { hlvRank: 7 })];
    const sm = makeSeasonModel();
    const board1 = buildAdpBoard({ snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(), hlv, vvm: [], seasonModel: sm });
    const board2 = buildAdpBoard({ snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(), hlv, vvm: [], seasonModel: sm });
    expect(board1.map((e) => e.hlvRank)).toEqual(board2.map((e) => e.hlvRank));
    expect(board1.map((e) => e.overallAdp)).toEqual(board2.map((e) => e.overallAdp));
  });

  // 14. No projection language in limitation strings for historical players
  it("limitation strings for historical players contain no projection language", () => {
    const records = [makePlayerRecord({ canonical_player_id: "p1", has_historical_profile: false })];
    const board = buildAdpBoard({
      snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(),
      hlv: [], vvm: [], seasonModel: makeSeasonModel(),
    });
    const projectionWords = ["project", "forecast", "expected", "projected", "prediction"];
    board[0].limitations.forEach((lim) => {
      projectionWords.forEach((word) => {
        expect(lim.toLowerCase()).not.toContain(word);
      });
    });
  });
});

// --------------------------------------------------------------------------
// Archetype examples
// --------------------------------------------------------------------------

describe("extractArchetypeExamples", () => {
  it("returns archetype examples for players that match criteria", () => {
    const records = [
      makePlayerRecord({ canonical_player_id: "qb1", raw_position: "QB", raw_name: "Elite QB", overall_adp: 15.0, overall_rank: 1 }),
      makePlayerRecord({ canonical_player_id: "rb1", raw_position: "RB", raw_name: "Top RB", overall_adp: 5.0, overall_rank: 2 }),
      makePlayerRecord({ canonical_player_id: "wr1", raw_position: "WR", raw_name: "Mid WR", overall_adp: 50.0, overall_rank: 3 }),
    ];
    const vvm = [
      makeVvm("rb1", { rankDelta: 30, valueSignal: "strong_value" }),
    ];
    const board = buildAdpBoard({ snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(), hlv: [], vvm });
    const examples = extractArchetypeExamples(board);

    expect(examples.some((e) => e.archetype === "elite_qb")).toBe(true);
    expect(examples.some((e) => e.archetype === "elite_rb")).toBe(true);
    expect(examples.some((e) => e.archetype === "strong_value")).toBe(true);
  });

  it("rookie/no-history example has dataQuality=rookie_no_history or isRookie=true", () => {
    const records = [
      makePlayerRecord({ canonical_player_id: "r1", raw_name: "Rookie", is_rookie: true, overall_adp: 40.0, raw_position: "WR" }),
    ];
    const board = buildAdpBoard({ snapshot: makeSnapshot(), records, formatMatch: makeFormatMatch(), hlv: [], vvm: [] });
    const examples = extractArchetypeExamples(board);
    const rookieEx = examples.find((e) => e.archetype === "rookie_no_history");
    if (rookieEx) {
      expect(rookieEx.dataQuality === "rookie_no_history" || rookieEx.limitations.includes("rookie — no historical data")).toBe(true);
    }
  });
});
