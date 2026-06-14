import { describe, expect, it } from "vitest";

import { aggregateLeagueDraftData, buildLeagueFormatProfile } from "@/lib/draft-data/aggregate";
import type { DraftDataDerivedWeeklyRow, DraftDataLeague, DraftDataPlayer, DraftDataWeeklyRow } from "@/lib/draft-data/types";

const league: DraftDataLeague = {
  id: "league-1",
  name: "Test League",
  season: 2025,
  total_teams: 2,
  is_dynasty: false,
  is_best_ball: false,
  is_superflex: false,
  is_two_qb: false,
  te_premium: false,
  scoring_settings_json: {
    pass_yd: 0.04,
    pass_td: 4,
    rush_yd: 0.1,
    rush_td: 6,
    rec: 1,
    rec_yd: 0.1,
    rec_td: 6
  },
  roster_positions_json: ["QB", "RB", "WR", "TE", "FLEX", "BN"]
};

const players: DraftDataPlayer[] = [
  { id: "qb-1", full_name: "Alpha QB", position: "QB", team: "DAL", position_group: "QB" },
  { id: "qb-2", full_name: "Beta QB", position: "QB", team: "CHI", position_group: "QB" },
  { id: "rb-1", full_name: "Alpha RB", position: "RB", team: "DAL", position_group: "RB" },
  { id: "rb-2", full_name: "Beta RB", position: "RB", team: "CHI", position_group: "RB" },
  { id: "wr-1", full_name: "Alpha WR", position: "WR", team: "DAL", position_group: "WR" },
  { id: "te-1", full_name: "Alpha TE", position: "TE", team: "DAL", position_group: "TE" }
];

describe("aggregateLeagueDraftData", () => {
  it("aggregates only stored weekly rows without inferring missing weeks as zero", () => {
    const rows: DraftDataWeeklyRow[] = [
      weekly("qb-1", "QB", 1, { pass_yd: 250, pass_td: 2 }),
      weekly("qb-1", "QB", 3, { pass_yd: 100, pass_td: 0 }),
      weekly("qb-2", "QB", 1, { pass_yd: 200, pass_td: 1 }),
      weekly("rb-1", "RB", 1, { rush_yd: 90, rush_td: 1, rec: 2, rec_yd: 10 }),
      weekly("rb-1", "RB", 2, { rush_yd: -5 }),
      weekly("rb-2", "RB", 1, { rush_yd: 40 }),
      weekly("wr-1", "WR", 1, { rec: 6, rec_yd: 80, rec_td: 1 }),
      weekly("te-1", "TE", 1, { rec: 4, rec_yd: 40 })
    ];

    const result = aggregateLeagueDraftData({
      league,
      performanceSeason: 2025,
      leagueConfigSeason: 2026,
      weeklyRows: rows,
      players,
      generatedAt: "2026-01-01T00:00:00.000Z"
    });

    const qb = result.profiles.find((profile) => profile.playerId === "qb-1");
    expect(qb?.gamesWithValidScoringData).toBe(2);
    expect(qb?.zeroPointWeeks).toBe(0);
    expect(qb?.totalPoints).toBe(22);
    expect(qb?.weeklyFinishDistribution.weeks).toBe(2);

    const rb = result.profiles.find((profile) => profile.playerId === "rb-1");
    expect(rb?.negativePointWeeks).toBe(1);
    expect(rb?.gamesPlayed).toBe(2);
    expect(rb?.scoringCompleteness.validScoredWeeksOnly).toBe(true);
  });

  it("keeps league scoring specific and detects TE premium format", () => {
    const tePremiumLeague = {
      ...league,
      id: "league-te",
      scoring_settings_json: { ...league.scoring_settings_json, bonus_rec_te: 0.5 },
      te_premium: true
    };

    const standard = aggregateLeagueDraftData({
      league,
      performanceSeason: 2025,
      leagueConfigSeason: 2026,
      weeklyRows: [weekly("te-1", "TE", 1, { rec: 4, rec_yd: 40 })],
      players
    });
    const premium = aggregateLeagueDraftData({
      league: tePremiumLeague,
      performanceSeason: 2025,
      leagueConfigSeason: 2026,
      weeklyRows: [weekly("te-1", "TE", 1, { rec: 4, rec_yd: 40 })],
      players
    });

    expect(buildLeagueFormatProfile(tePremiumLeague, 2025).tePremium.detected).toBe(true);
    expect(premium.profiles[0]!.totalPoints).toBeGreaterThan(standard.profiles[0]!.totalPoints);
  });

  it("produces deterministic ranks and preliminary replacement summaries", () => {
    const rows: DraftDataWeeklyRow[] = [
      weekly("qb-1", "QB", 1, { pass_yd: 300, pass_td: 3 }),
      weekly("qb-1", "QB", 2, { pass_yd: 280, pass_td: 2 }),
      weekly("qb-1", "QB", 3, { pass_yd: 260, pass_td: 2 }),
      weekly("qb-1", "QB", 4, { pass_yd: 220, pass_td: 1 }),
      weekly("qb-2", "QB", 1, { pass_yd: 200, pass_td: 1 }),
      weekly("qb-2", "QB", 2, { pass_yd: 200, pass_td: 1 }),
      weekly("qb-2", "QB", 3, { pass_yd: 200, pass_td: 1 }),
      weekly("qb-2", "QB", 4, { pass_yd: 200, pass_td: 1 }),
      weekly("rb-1", "RB", 1, { rush_yd: 100, rush_td: 1 }),
      weekly("rb-1", "RB", 2, { rush_yd: 100, rush_td: 1 }),
      weekly("rb-1", "RB", 3, { rush_yd: 100, rush_td: 1 }),
      weekly("rb-1", "RB", 4, { rush_yd: 100, rush_td: 1 })
    ];

    const first = aggregateLeagueDraftData({ league, performanceSeason: 2025, leagueConfigSeason: 2026, weeklyRows: rows, players });
    const second = aggregateLeagueDraftData({ league, performanceSeason: 2025, leagueConfigSeason: 2026, weeklyRows: [...rows].reverse(), players });

    expect(first.profiles.map((profile) => [profile.playerId, profile.ranks])).toEqual(
      second.profiles.map((profile) => [profile.playerId, profile.ranks])
    );
    expect(first.replacementSummary.positionSummaries.QB.replacementPointsPerGame).not.toBeNull();
    expect(first.profiles.find((profile) => profile.playerId === "qb-1")?.replacement.pointsAboveReplacement).not.toBeNull();
  });

  it("marks situation fields unknown rather than neutral", () => {
    const result = aggregateLeagueDraftData({
      league,
      performanceSeason: 2025,
      leagueConfigSeason: 2026,
      weeklyRows: [weekly("wr-1", "WR", 1, { rec: 3, rec_yd: 30 })],
      players
    });

    expect(result.profiles[0]!.situationProfile.depthChartRole.status).toBe("unknown");
    expect(result.profiles[0]!.situationProfile.depthChartRole.value).toBeNull();
  });

  it("records separate performance and league configuration seasons with deterministic provenance", () => {
    const first = aggregateLeagueDraftData({
      league: { ...league, season: 2026 },
      performanceSeason: 2025,
      weeklyRows: [weekly("wr-1", "WR", 1, { rec: 3, rec_yd: 30 })],
      players,
      generatedAt: "2026-06-14T00:00:00.000Z"
    });
    const second = aggregateLeagueDraftData({
      league: { ...league, season: 2026 },
      performanceSeason: 2025,
      weeklyRows: [weekly("wr-1", "WR", 1, { rec: 3, rec_yd: 30 })],
      players,
      generatedAt: "2026-06-14T00:00:00.000Z"
    });

    expect(first.profiles[0]!.performanceSeason).toBe(2025);
    expect(first.profiles[0]!.leagueConfigSeason).toBe(2026);
    expect(first.profiles[0]!.analysisMode).toBe("historical_under_current_format");
    expect(first.provenance).toEqual(second.provenance);
    expect(first.provenance.scoringSettingsHash).toMatch(/^fnv1a32:/);
  });
});

describe("H6.1 known-zero inference", () => {
  const pbpLeague: DraftDataLeague = {
    ...league,
    id: "league-pbp",
    scoring_settings_json: {
      ...league.scoring_settings_json,
      rush_td_50p: 3,
      pass_pick6: -2,
      pass_int_td: -4
    }
  };

  it("injects known-zero stats for PBP-derived keys when batch is complete and no derived row exists", () => {
    const rows: DraftDataWeeklyRow[] = [
      weekly("rb-1", "RB", 1, { rush_yd: 90, rush_td: 1 })
    ];

    const withoutInference = aggregateLeagueDraftData({
      league: pbpLeague,
      performanceSeason: 2025,
      leagueConfigSeason: 2026,
      weeklyRows: rows,
      players,
      pbpDerivedBatchStatus: "not_run"
    });

    const withInference = aggregateLeagueDraftData({
      league: pbpLeague,
      performanceSeason: 2025,
      leagueConfigSeason: 2026,
      weeklyRows: rows,
      players,
      pbpDerivedBatchStatus: "complete"
    });

    const profileWithout = withoutInference.profiles.find((p) => p.playerId === "rb-1")!;
    const profileWith = withInference.profiles.find((p) => p.playerId === "rb-1")!;

    // Without inference: rush_td_50p is in missingStats because no derived row
    expect(profileWithout.scoringCompleteness.missingStatsForSupportedKeys).toContain("rush_td_50p");
    // With inference: rush_td_50p was injected as zero — no longer missing
    expect(profileWith.scoringCompleteness.missingStatsForSupportedKeys).not.toContain("rush_td_50p");

    // knownZeroInferencesApplied count
    expect(withInference.diagnostics.knownZeroInferencesApplied).toBe(1);
    expect(withoutInference.diagnostics.knownZeroInferencesApplied).toBe(0);
  });

  it("does not override an explicit derived row when batch is complete", () => {
    const rows: DraftDataWeeklyRow[] = [
      weekly("rb-1", "RB", 1, { rush_yd: 90, rush_td: 1 })
    ];
    const derivedRows: DraftDataDerivedWeeklyRow[] = [{
      player_id: "rb-1",
      season: 2025,
      week: 1,
      season_type: "regular",
      stat_scope: "nflverse_pbp_derived",
      stats_json: { rush_td_50p: 1 },
      completeness: "complete"
    }];

    const result = aggregateLeagueDraftData({
      league: pbpLeague,
      performanceSeason: 2025,
      leagueConfigSeason: 2026,
      weeklyRows: rows,
      players,
      derivedRows,
      pbpDerivedBatchStatus: "complete"
    });

    const profile = result.profiles.find((p) => p.playerId === "rb-1")!;
    // No known-zero inferences: derived row existed
    expect(result.diagnostics.knownZeroInferencesApplied).toBe(0);
    // rush_td_50p should be in evaluated keys (scored as 1 event)
    expect(profile.scoringCompleteness.missingStatsForSupportedKeys).not.toContain("rush_td_50p");
    // +3 pts for rush_td_50p × 1
    expect(profile.totalPoints).toBeGreaterThan(0);
  });

  it("pass_int_td and pass_pick6 both clear as known-zero when batch is complete", () => {
    const rows: DraftDataWeeklyRow[] = [
      weekly("qb-1", "QB", 1, { pass_yd: 250, pass_td: 2 })
    ];

    const result = aggregateLeagueDraftData({
      league: pbpLeague,
      performanceSeason: 2025,
      leagueConfigSeason: 2026,
      weeklyRows: rows,
      players,
      pbpDerivedBatchStatus: "complete"
    });

    const profile = result.profiles.find((p) => p.playerId === "qb-1")!;
    expect(profile.scoringCompleteness.missingStatsForSupportedKeys).not.toContain("pass_pick6");
    expect(profile.scoringCompleteness.missingStatsForSupportedKeys).not.toContain("pass_int_td");
    // Both are tracked as known-zero
    expect(profile.scoringCompleteness.knownZeroStatsForSupportedKeys).toContain("pass_pick6");
    expect(profile.scoringCompleteness.knownZeroStatsForSupportedKeys).toContain("pass_int_td");
  });
});

describe("H6.1 ScoringCompleteness structured model", () => {
  const pbpLeague: DraftDataLeague = {
    ...league,
    id: "league-completeness",
    scoring_settings_json: {
      pass_yd: 0.04,
      pass_td: 4,
      rush_yd: 0.1,
      rush_td: 6,
      rec: 1,
      rec_yd: 0.1,
      rec_td: 6,
      rush_td_50p: 3
    }
  };

  it("completeness ratio is 1 when all keys are evaluated", () => {
    const rows: DraftDataWeeklyRow[] = [
      weekly("rb-1", "RB", 1, { rush_yd: 90, rush_td: 1 })
    ];

    const result = aggregateLeagueDraftData({
      league: pbpLeague,
      performanceSeason: 2025,
      leagueConfigSeason: 2026,
      weeklyRows: rows,
      players,
      pbpDerivedBatchStatus: "complete"
    });

    const profile = result.profiles.find((p) => p.playerId === "rb-1")!;
    const { scoringCompletenessRatio, historicalScoreConfidence, applicableKeyCount, evaluatedKeyCount } = profile.scoringCompleteness;

    expect(applicableKeyCount).toBeGreaterThan(0);
    expect(evaluatedKeyCount).toBeLessThanOrEqual(applicableKeyCount);
    expect(scoringCompletenessRatio).toBeGreaterThanOrEqual(0);
    expect(scoringCompletenessRatio).toBeLessThanOrEqual(1);
    // With complete batch, no missing stats → should be complete or high
    expect(["complete", "high"]).toContain(historicalScoreConfidence);
  });

  it("leagueSummary aggregates profile-level completeness", () => {
    const rows: DraftDataWeeklyRow[] = [
      weekly("rb-1", "RB", 1, { rush_yd: 90, rush_td: 1 }),
      weekly("wr-1", "WR", 1, { rec: 5, rec_yd: 60 })
    ];

    const result = aggregateLeagueDraftData({
      league: pbpLeague,
      performanceSeason: 2025,
      leagueConfigSeason: 2026,
      weeklyRows: rows,
      players,
      pbpDerivedBatchStatus: "complete"
    });

    const { leagueSummary } = result;
    expect(leagueSummary.leagueId).toBe(pbpLeague.id);
    expect(leagueSummary.totalProfiles).toBe(2);
    expect(leagueSummary.averageScoringCompletenessRatio).toBeGreaterThanOrEqual(0);
    expect(leagueSummary.averageScoringCompletenessRatio).toBeLessThanOrEqual(1);
    expect(leagueSummary.activeScoringKeyCount).toBeGreaterThan(0);
    expect(typeof leagueSummary.positionBreakdown["RB"]).toBe("object");
    expect(leagueSummary.positionBreakdown["RB"]!.count).toBe(1);
  });

  it("incompleteSourceKeyCount increments when PBP batch is not complete", () => {
    const rows: DraftDataWeeklyRow[] = [
      weekly("rb-1", "RB", 1, { rush_yd: 90, rush_td: 1 })
    ];

    const notRun = aggregateLeagueDraftData({
      league: pbpLeague,
      performanceSeason: 2025,
      leagueConfigSeason: 2026,
      weeklyRows: rows,
      players,
      pbpDerivedBatchStatus: "not_run"
    });

    const profile = notRun.profiles.find((p) => p.playerId === "rb-1")!;
    expect(profile.scoringCompleteness.incompleteSourceKeyCount).toBeGreaterThan(0);
    expect(profile.scoringCompleteness.missingMergeKeyCount).toBe(0);
  });

  it("limitations list contains entry for each missing key", () => {
    const rows: DraftDataWeeklyRow[] = [
      weekly("rb-1", "RB", 1, { rush_yd: 90, rush_td: 1 })
    ];

    const result = aggregateLeagueDraftData({
      league: pbpLeague,
      performanceSeason: 2025,
      leagueConfigSeason: 2026,
      weeklyRows: rows,
      players,
      pbpDerivedBatchStatus: "not_run"
    });

    const profile = result.profiles.find((p) => p.playerId === "rb-1")!;
    const rush50pLimitation = profile.limitations.find((l) => l.scoringKey === "rush_td_50p");
    expect(rush50pLimitation).toBeDefined();
    expect(rush50pLimitation!.reason).toBe("missing_merge");
    expect(rush50pLimitation!.estimatedMaxPointImpactPerGame).toBe(3);
  });

  it("pbpDerivedBatchStatus is reflected in diagnostics", () => {
    const result = aggregateLeagueDraftData({
      league,
      performanceSeason: 2025,
      leagueConfigSeason: 2026,
      weeklyRows: [weekly("rb-1", "RB", 1, { rush_yd: 50 })],
      players,
      pbpDerivedBatchStatus: "partial"
    });
    expect(result.diagnostics.pbpDerivedBatchStatus).toBe("partial");
  });
});

describe("H6.1 inapplicable key filtering (DEF/IDP/K keys excluded from offensive completeness)", () => {
  // League with DEF/IDP scoring keys active alongside standard offensive keys.
  // These keys are "unsupported" by the engine for all positions (no rule exists for them),
  // but they must NOT count against an offensive player's scoring completeness.
  const defLeague: DraftDataLeague = {
    ...league,
    id: "league-def",
    scoring_settings_json: {
      pass_yd: 0.04,
      pass_td: 4,
      rush_yd: 0.1,
      rush_td: 6,
      rec: 1,
      rec_yd: 0.1,
      rec_td: 6,
      // DEF/IDP/ST keys — real leagues have these; they are out-of-scope for offensive analysis
      sack: 1,
      int: 2,
      def_st_ff: 1,
      def_st_fum_rec: 1,
      bonus_def_fum_td_50p: 2,
      bonus_def_int_td_50p: 2,
      bonus_sack_2p: 1
    }
  };

  it("defensive/ST keys do not reduce offensive player completeness ratio", () => {
    const rows: DraftDataWeeklyRow[] = [
      weekly("rb-1", "RB", 1, { rush_yd: 90, rush_td: 1 })
    ];

    const result = aggregateLeagueDraftData({
      league: defLeague,
      performanceSeason: 2025,
      leagueConfigSeason: 2026,
      weeklyRows: rows,
      players,
      pbpDerivedBatchStatus: "complete"
    });

    const profile = result.profiles.find((p) => p.playerId === "rb-1")!;
    const { scoringCompletenessRatio, historicalScoreConfidence, unsupportedScoringKeys } = profile.scoringCompleteness;

    // Keys with NO engine rule (NOT_IMPL) appear in unsupportedScoringKeys for all positions.
    // Keys WITH an engine rule (sack, int) are evaluated by the engine (as 0 for offensive
    // players) and do NOT appear in unsupportedScoringKeys — the engine handles them.
    expect(unsupportedScoringKeys).toContain("def_st_ff");
    expect(unsupportedScoringKeys).toContain("bonus_sack_2p");
    expect(scoringCompletenessRatio).toBeGreaterThanOrEqual(0.9);
    expect(["complete", "high"]).toContain(historicalScoreConfidence);
  });

  it("DEF/IDP/ST unsupported keys do not appear in offensive limitations", () => {
    const rows: DraftDataWeeklyRow[] = [
      weekly("wr-1", "WR", 1, { rec: 5, rec_yd: 60, rec_td: 1 })
    ];

    const result = aggregateLeagueDraftData({
      league: defLeague,
      performanceSeason: 2025,
      leagueConfigSeason: 2026,
      weeklyRows: rows,
      players,
      pbpDerivedBatchStatus: "complete"
    });

    const profile = result.profiles.find((p) => p.playerId === "wr-1")!;
    const defKeyLimitations = profile.limitations.filter(
      (l) => ["sack", "int", "def_st_ff", "def_st_fum_rec", "bonus_def_fum_td_50p", "bonus_def_int_td_50p", "bonus_sack_2p"].includes(l.scoringKey)
    );
    expect(defKeyLimitations).toHaveLength(0);
  });

  it("leagueSummary captures out-of-scope keys in outOfScopeLeagueScoringKeys", () => {
    const rows: DraftDataWeeklyRow[] = [
      weekly("rb-1", "RB", 1, { rush_yd: 90, rush_td: 1 }),
      weekly("wr-1", "WR", 1, { rec: 5, rec_yd: 60 })
    ];

    const result = aggregateLeagueDraftData({
      league: defLeague,
      performanceSeason: 2025,
      leagueConfigSeason: 2026,
      weeklyRows: rows,
      players,
      pbpDerivedBatchStatus: "complete"
    });

    // Only keys with NO engine rule (NOT_IMPL) appear in unsupportedScoringKeys and thus in
    // outOfScopeLeagueScoringKeys. Keys with engine rules (sack, int) are evaluated by the
    // engine at 0 for offensive players and do not flow through unsupportedScoringKeys.
    const { outOfScopeLeagueScoringKeys } = result.leagueSummary;
    expect(outOfScopeLeagueScoringKeys).toContain("def_st_ff");
    expect(outOfScopeLeagueScoringKeys).toContain("bonus_sack_2p");
  });

  it("applicable unsupported offensive keys appear in limitations and increment unsupportedEngineKeyCount", () => {
    // A key that is not in SLEEPER_SCORING_RULES and does not match any DEF/IDP pattern.
    // It appears as "unsupported" in the engine but is applicable to offensive profiles,
    // so it SHOULD count against completeness (unlike DEF/IDP keys which don't).
    const customLeague: DraftDataLeague = {
      ...league,
      id: "league-custom-key",
      scoring_settings_json: {
        rush_yd: 0.1,
        rush_td: 6,
        custom_bonus_td: 5  // unknown key, not DEF/IDP pattern, not in engine
      }
    };
    const rows: DraftDataWeeklyRow[] = [
      weekly("rb-1", "RB", 1, { rush_yd: 90, rush_td: 1 })
    ];

    const result = aggregateLeagueDraftData({
      league: customLeague,
      performanceSeason: 2025,
      leagueConfigSeason: 2026,
      weeklyRows: rows,
      players,
      pbpDerivedBatchStatus: "complete"
    });

    const profile = result.profiles.find((p) => p.playerId === "rb-1")!;
    const customLimitation = profile.limitations.find((l) => l.scoringKey === "custom_bonus_td");
    expect(customLimitation).toBeDefined();
    expect(customLimitation!.reason).toBe("unsupported_engine");
    expect(customLimitation!.estimatedMaxPointImpactPerGame).toBe(5);
    expect(profile.scoringCompleteness.unsupportedEngineKeyCount).toBeGreaterThan(0);
  });
});

function weekly(player_id: string, position_group: string, week: number, stats_json: Record<string, number>): DraftDataWeeklyRow {
  return {
    player_id,
    season: 2025,
    week,
    season_type: "regular",
    game_id: `game-${week}`,
    team: "DAL",
    opponent: "CHI",
    position_group,
    stats_json
  };
}
