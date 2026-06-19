import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  runHistoricalOutcomeCoverageDiagnostics,
  writeHistoricalOutcomeCoverageDiagnosticsArtifacts,
} from "./historical-outcome-coverage-diagnostics";
import type { HistoricalDraftUniverseReport } from "./historical-draft-universe-builder-types";
import type { HistoricalMockDraftEngineReport } from "./historical-mock-draft-engine-types";
import type { HistoricalSeasonOutcomeScorerReport } from "./historical-season-outcome-scorer-types";
import type { HistoricalWeeklyResultsReport } from "./historical-weekly-results-source-types";

describe("historical outcome coverage diagnostics", () => {
  it("classifies missing rows, true zero weeks, and strict candidates without confirming loose fuzzy matches", () => {
    const cwd = setupWorkspace();
    try {
      writeArtifacts(cwd);

      const report = runHistoricalOutcomeCoverageDiagnostics({ season: 2025, cwd });

      expect(report.missingScoreRows).toHaveLength(4);
      expect(report.missingScoreRows.find((row) => row.player_id === "p1")?.missing_reason).toBe("player_did_not_record_stats");
      expect(report.missingScoreRows.find((row) => row.player_id === "p1")?.score_should_be_zero_for_week).toBe(true);
      expect(report.missingScoreRows.find((row) => row.player_id === "p2")?.candidate_match_status).toBe("normalized_name_position_team_candidate");
      expect(report.missingScoreRows.find((row) => row.player_id === "p2")?.mapping_failure_suspected).toBe(true);
      expect(report.missingScoreRows.find((row) => row.player_id === "p3")?.missing_reason).toBe("player_not_in_weekly_source");
      expect(report.safetyGates.find((gate) => gate.name === "loose_fuzzy_not_confirmed")?.passed).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("reports season-level coverage and projected missing-rate improvement", () => {
    const cwd = setupWorkspace();
    try {
      writeArtifacts(cwd);

      const report = runHistoricalOutcomeCoverageDiagnostics({ season: 2025, cwd });

      expect(report.seasonLevelCoverage.find((row) => row.drafted_player_id === "p1")).toMatchObject({
        weeks_expected: 2,
        weeks_with_scores: 1,
        weeks_missing: 1,
        weekly_source_match_type: "exact_player_id",
      });
      expect(report.trueZeroVsIdentifierMismatch).toMatchObject({
        true_zero_week_rows: 1,
        identifier_mismatch_suspected_rows: 1,
        source_expansion_needed_rows: 1,
        manual_review_candidate_rows: 1,
      });
      expect(report.improvementPreview).toMatchObject({
        current_missing_rows: 4,
        true_zero_week_rows_to_synthesize: 1,
        new_strict_name_position_team_review_candidates: 1,
        remaining_missing_after_preview: 3,
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("summarizes strategy, position, and round impact and recommends the H37 fix when zero weeks dominate", () => {
    const cwd = setupWorkspace();
    try {
      writeArtifacts(cwd, { zeroDominant: true });

      const report = runHistoricalOutcomeCoverageDiagnostics({ season: 2025, cwd });

      expect(report.strategyImpactPreview.missing_score_rate_by_strategy.some((row) => row.key === "blackbird_rank_only")).toBe(true);
      expect(report.strategyImpactPreview.missing_score_rate_by_position.some((row) => row.key === "RB")).toBe(true);
      expect(report.strategyImpactPreview.missing_score_rate_by_draft_round.some((row) => row.key === "1")).toBe(true);
      expect(report.h37IntegrationRecommendation).toBe("coverage_ready_to_treat_missing_weeks_as_zero");
      expect(report.recommendation).toBe("historical_outcome_coverage_ready_for_h37_fix");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("writes diagnostics artifacts and does not mutate live outputs", () => {
    const cwd = setupWorkspace();
    try {
      writeArtifacts(cwd);
      const report = runHistoricalOutcomeCoverageDiagnostics({ season: 2025, cwd });
      const artifacts = writeHistoricalOutcomeCoverageDiagnosticsArtifacts(report, cwd);

      expect(existsSync(artifacts.jsonPath)).toBe(true);
      expect(existsSync(artifacts.markdownPath)).toBe(true);
      expect(existsSync(artifacts.csvPath)).toBe(true);
      expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("blocks clearly when required artifacts are missing", () => {
    const cwd = setupWorkspace();
    try {
      const report = runHistoricalOutcomeCoverageDiagnostics({ season: 2025, cwd });

      expect(report.recommendation).toBe("historical_outcome_coverage_blocked");
      expect(report.h37IntegrationRecommendation).toBe("coverage_blocked");
      expect(report.limitations.join(" ")).toContain("Missing required artifacts");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

function setupWorkspace() {
  const cwd = path.join(tmpdir(), `blackbird-h39-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(path.join(cwd, "artifacts", "projections", "backtesting"), { recursive: true });
  return cwd;
}

function writeArtifacts(cwd: string, options: { zeroDominant?: boolean } = {}) {
  const dir = path.join(cwd, "artifacts", "projections", "backtesting");
  writeFileSync(path.join(dir, "historical-mock-draft-engine-2025.json"), JSON.stringify(draftReport()), "utf8");
  writeFileSync(path.join(dir, "historical-season-outcome-scorer-2025.json"), JSON.stringify(outcomeReport(options)), "utf8");
  writeFileSync(path.join(dir, "historical-draft-universe-2025.json"), JSON.stringify(universeReport()), "utf8");
  writeFileSync(path.join(dir, "historical-weekly-results-2025.normalized.json"), JSON.stringify(weeklyReport(options)), "utf8");
  writeFileSync(path.join(dir, "historical-strategy-comparison-2025.json"), JSON.stringify({ dryRun: true }), "utf8");
}

function draftReport(): HistoricalMockDraftEngineReport {
  const picks = [
    { strategy: "blackbird_rank_only" as const, overallPick: 1, round: 1, pickInRound: 1, draftSlot: 1, playerId: "p1", playerName: "Matched Back", position: "RB", nflTeam: "AAA", rankSource: "test" },
    { strategy: "blackbird_rank_only" as const, overallPick: 2, round: 1, pickInRound: 2, draftSlot: 1, playerId: "p2", playerName: "Mapped Wideout", position: "WR", nflTeam: "BBB", rankSource: "test" },
    { strategy: "projection_only" as const, overallPick: 3, round: 2, pickInRound: 1, draftSlot: 1, playerId: "p3", playerName: "Missing Tight End", position: "TE", nflTeam: "CCC", rankSource: "test" },
  ];
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2025,
    scenarioPath: null,
    recommendation: "historical_mock_draft_engine_ready_for_season_scoring",
    draftOrderType: "snake",
    draftOrder: [],
    strategyResults: [
      {
        strategy: "blackbird_rank_only",
        teamRosters: [{ draftSlot: 1, picks: picks.slice(0, 2) }],
        pickLog: picks.slice(0, 2),
        myTeamRoster: picks.slice(0, 2),
        positionCounts: {},
        starterCoverageEstimate: "",
        benchDepthEstimate: "",
        draftCapitalByPosition: {},
        reachesValueNotes: [],
      },
      {
        strategy: "projection_only",
        teamRosters: [{ draftSlot: 1, picks: picks.slice(2) }],
        pickLog: picks.slice(2),
        myTeamRoster: picks.slice(2),
        positionCounts: {},
        starterCoverageEstimate: "",
        benchDepthEstimate: "",
        draftCapitalByPosition: {},
        reachesValueNotes: [],
      },
    ],
    dataLeakageGuard: {
      allowedDraftTimeInputs: [],
      disallowedOutcomeInputs: [],
      actualSeasonScoringLoaded: false,
      futureOutcomeFieldsUsed: false,
    },
    safetyGates: [],
  };
}

function outcomeReport(options: { zeroDominant?: boolean }): HistoricalSeasonOutcomeScorerReport {
  const blackbirdWeekTwo = options.zeroDominant
    ? [
        { playerId: "p1", playerName: "Matched Back", position: "RB", points: 0, matchedBy: "missing" as const },
        { playerId: "p2", playerName: "Mapped Wideout", position: "WR", points: 0, matchedBy: "missing" as const },
      ]
    : [
        { playerId: "p1", playerName: "Matched Back", position: "RB", points: 0, matchedBy: "missing" as const },
        { playerId: "p2", playerName: "Mapped Wideout", position: "WR", points: 0, matchedBy: "missing" as const },
      ];
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2025,
    scenarioPath: null,
    recommendation: "historical_outcome_scoring_ready_for_strategy_comparison",
    actualWeeklyResultsFound: true,
    weeklyInputCoverage: {
      resultRows: 2,
      weeks: [1, 2],
      scoredWeeklyResultRows: 1,
      exactIdMatches: 1,
      namePositionFallbackMatches: 0,
      trueZeroWeekRows: 0,
      registryBackedZeroSeasonRows: 0,
      missingPlayerScores: options.zeroDominant ? 2 : 3,
      missingScoreRateBeforeH40: options.zeroDominant ? 0.67 : 0.75,
      missingScoreRateBeforeZeroWeekTreatment: options.zeroDominant ? 0.67 : 0.75,
      missingScoreRateAfterTrueZeroWeekTreatment: options.zeroDominant ? 0.67 : 0.75,
      missingScoreRateAfterZeroWeekTreatment: options.zeroDominant ? 0.67 : 0.75,
      missingScoreRateAfterRegistryZeroSeasonTreatment: options.zeroDominant ? 0.67 : 0.75,
      playersWithSeasonLevelExactMatch: 1,
      playersWithRegistryOnlyExactMatch: 0,
      playersMissingFromBothWeeklyAndRegistrySource: 2,
      playersMissingFromWeeklySourceEntirely: 2,
      registryBackedZeroSeasonUnavailable: false,
    },
    draftEngineSummary: { recommendation: "historical_mock_draft_engine_ready_for_season_scoring", draftOrderType: "snake" },
    strategyOutcomes: [
      {
        strategy: "blackbird_rank_only",
        teamKey: "slot-1",
        best_ball_total_points: 10,
        weekly_average: 5,
        weekly_scores: [
          {
            week: 1,
            teamKey: "blackbird_rank_only:slot-1",
            totalPoints: 10,
            starters: [{ playerId: "p1", playerName: "Matched Back", position: "RB", points: 10, matchedBy: "player_id" }],
            bench: [{ playerId: "p2", playerName: "Mapped Wideout", position: "WR", points: 0, matchedBy: "missing" }],
            starterPoints: 10,
            benchPoints: 0,
            fillRate: 1,
            zeroScoreStarterWeeks: 0,
            positionalPointsBySlot: { RB: 10 },
          },
          {
            week: 2,
            teamKey: "blackbird_rank_only:slot-1",
            totalPoints: 0,
            starters: blackbirdWeekTwo,
            bench: [],
            starterPoints: 0,
            benchPoints: 0,
            fillRate: 1,
            zeroScoreStarterWeeks: 1,
            positionalPointsBySlot: {},
          },
        ],
        starter_points: 10,
        bench_points: 0,
        optimal_lineup_fill_rate: 1,
        zero_score_starter_weeks: 1,
        positional_points_by_slot: { RB: 10 },
        positional_advantage: {},
        replacement_value: "not_available_v1",
        hit_rate: 0.5,
        bust_rate: 0.5,
        regret_score: "not_available_v1",
      },
      {
        strategy: "projection_only",
        teamKey: "slot-1",
        best_ball_total_points: 0,
        weekly_average: 0,
        weekly_scores: [
          {
            week: 1,
            teamKey: "projection_only:slot-1",
            totalPoints: 0,
            starters: [{ playerId: "p3", playerName: "Missing Tight End", position: "TE", points: 0, matchedBy: "missing" }],
            bench: [],
            starterPoints: 0,
            benchPoints: 0,
            fillRate: 1,
            zeroScoreStarterWeeks: 1,
            positionalPointsBySlot: {},
          },
        ],
        starter_points: 0,
        bench_points: 0,
        optimal_lineup_fill_rate: 1,
        zero_score_starter_weeks: 1,
        positional_points_by_slot: {},
        positional_advantage: {},
        replacement_value: "not_available_v1",
        hit_rate: 0,
        bust_rate: 1,
        regret_score: "not_available_v1",
      },
    ],
    strategyComparison: null,
    myTeamFocus: null,
    dataLeakageGuard: {
      draftArtifactLoadedBeforeOutcomes: true,
      actualOutcomesOnlyUsedInScoringPhase: true,
      draftRankingsNotRecomputedFromOutcomes: true,
      noFutureFieldsUsedInDraftSimulation: true,
    },
    limitations: [],
    safetyGates: [],
  };
}

function universeReport(): HistoricalDraftUniverseReport {
  const rows = [
    universeRow("p1", "s1", "g1", "Matched Back", "RB", "AAA"),
    universeRow("p2", "s2", "g2", "Mapped Wideout", "WR", "BBB"),
    universeRow("p3", "s3", "g3", "Missing Tight End", "TE", "CCC"),
  ];
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    season: 2025,
    recommendation: "historical_draft_universe_ready_for_h36_h37",
    options: { season: 2025, includeIdp: false, includeK: false, includeDst: false },
    sourceDiscovery: {
      preseasonProjectionSnapshot: {
        path: "",
        exists: true,
        rows: 3,
        playersWithPlayerId: 3,
        playersWithSleeperId: 3,
        playersWithGsisId: 3,
        playersWithPlayerName: 3,
        positionsCovered: ["RB", "WR", "TE"],
        teamsCovered: ["AAA", "BBB", "CCC"],
        rankingFieldsAvailable: [],
        projectionFieldsAvailable: [],
        adpMarketFieldsAvailable: [],
        blackbirdRankLikeFieldsAvailable: [],
      },
    },
    summary: { universeRows: 3, positions: ["RB", "WR", "TE"], teams: ["AAA", "BBB", "CCC"], rankingFallbackUsed: null, projectionFieldUsed: null, rowsWithPlayerId: 3, rowsWithSleeperId: 3, rowsWithGsisId: 3 },
    identifierCoveragePreview: { universePlayers: 3, playersWithWeeklyResultExactIdMatch: 1, playersWithWeeklyResultNamePositionFallback: 1, playersMissingWeeklyOutcome: 1, matchRateByPosition: {} },
    generatedH36ScenarioPath: "",
    h36PlayerUniverse: [],
    generatedH36Scenario: {} as HistoricalDraftUniverseReport["generatedH36Scenario"],
    rows,
    dataLeakageGuard: { actualWeeklyOutcomesNotUsedForRanking: true, weeklyOutcomesUsedOnlyForIdentifierCoveragePreview: true, noOutcomePointsJoinedIntoDraftUniverse: true, noFutureFieldsUsed: true },
    limitations: [],
    safetyGates: [],
  };
}

function universeRow(player_id: string, sleeper_id: string, gsis_id: string, player_name: string, position: string, team: string) {
  return {
    player_id,
    sleeper_id,
    gsis_id,
    player_name,
    position,
    team,
    age: null,
    years_exp: null,
    projection_points: 1,
    projection_ppg: null,
    blackbird_rank: null,
    blackbird_rank_fallback: null,
    blackbird_score: null,
    draft_score: null,
    adp: null,
    market_rank: null,
    source: "test",
    source_confidence: "test",
    notes: [],
  };
}

function weeklyReport(options: { zeroDominant?: boolean }): HistoricalWeeklyResultsReport {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    season: 2025,
    recommendation: "historical_weekly_results_ready_for_h37_scoring",
    sourceDiscovery: [],
    selectedSourcePath: null,
    summary: {
      totalWeeklyRows: 2,
      playersCovered: 2,
      weeksCovered: [1],
      positionsCovered: ["RB", "WR"],
      exactIdCoverage: { player_id: 1, sleeper_id: 0, gsis_id: 0 },
      rowsWithFantasyPoints: 2,
      rowsCalculatedFromStats: 0,
      rowsMissingScoringInputs: 0,
    },
    fantasyPointMethod: "precomputed_fantasy_points",
    h37Integration: { weeklyResultsInputPath: "", scenarioTemplatePath: "" },
    dataLeakageGuard: { weeklyOutcomesSourceIsOutcomeOnly: true, notUsedByH36DraftEngine: true, h37ScoringOnly: true, noDraftRankingsRecomputed: true, noLiveOutputsChanged: true },
    limitations: [],
    safetyGates: [],
    results: [
      weeklyRow("p1", "Matched Back", "RB", "AAA", 1, 10),
      weeklyRow(options.zeroDominant ? "p2" : "weekly-p2", "Mapped Wideout", "WR", "BBB", 1, 8),
    ],
  };
}

function weeklyRow(player_id: string, player_name: string, position: string, team: string, week: number, fantasy_points: number) {
  return {
    season: 2025,
    week,
    player_id,
    sleeper_id: null,
    gsis_id: null,
    player_name,
    position,
    fantasy_points,
    season_type: "REG",
    team,
    opponent: null,
    passing_points: 0,
    rushing_points: 0,
    receiving_points: 0,
    td_points: 0,
    turnover_points: 0,
    kicking_points: 0,
    dst_points: 0,
    idp_points: 0,
    source: "test",
    source_updated_at: null,
    notes: [],
  };
}
