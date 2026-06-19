import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  runHistoricalWeeklySourceExpansionReview,
  writeHistoricalWeeklySourceExpansionReviewArtifacts,
} from "./historical-weekly-source-expansion-review";
import type { HistoricalOutcomeCoverageDiagnosticsReport } from "./historical-outcome-coverage-diagnostics-types";
import type { HistoricalSeasonOutcomeScorerReport } from "./historical-season-outcome-scorer-types";
import type { HistoricalStrategyComparisonReport } from "./historical-strategy-comparison-report-types";

describe("historical weekly source expansion review", () => {
  it("aggregates remaining missing players and classifies safe zero-season previews", () => {
    const cwd = setupWorkspace();
    try {
      writeArtifacts(cwd);

      const report = runHistoricalWeeklySourceExpansionReview({ season: 2025, cwd });

      expect(report.remainingMissingPlayers).toHaveLength(4);
      expect(report.remainingMissingPlayers.find((row) => row.player_id === "p1")).toMatchObject({
        player_name: "Roster Match",
        drafted_count: 1,
        draft_rounds: [3],
        missing_weeks: [1, 2],
        roster_source_present: true,
        reason: "likely_zero_season_player",
        recommended_treatment: "zero_season_confirmed",
      });
      expect(report.remainingMissingPlayers.find((row) => row.player_id === "p2")).toMatchObject({
        player_registry_present: true,
        recommended_treatment: "zero_season_confirmed",
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("reports source availability and identifier mapping gaps without scoring strict candidates", () => {
    const cwd = setupWorkspace();
    try {
      writeArtifacts(cwd);

      const report = runHistoricalWeeklySourceExpansionReview({ season: 2025, cwd });

      expect(report.sourceAvailability.find((row) => row.source === "rosters")).toMatchObject({
        exists: true,
        rows: 1,
        exact_id_matches: 1,
      });
      expect(report.sourceAvailability.find((row) => row.source === "players")).toMatchObject({
        exists: true,
        rows: 2,
        exact_id_matches: 1,
        strict_name_position_team_candidates: 1,
      });
      expect(report.remainingMissingPlayers.find((row) => row.player_id === "p3")).toMatchObject({
        reason: "identifier_mapping_gap",
        recommended_treatment: "needs_identifier_mapping",
      });
      expect(report.safetyGates.find((gate) => gate.name === "loose_fuzzy_not_confirmed")?.passed).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("projects coverage improvement and strategy distortion", () => {
    const cwd = setupWorkspace();
    try {
      writeArtifacts(cwd);

      const report = runHistoricalWeeklySourceExpansionReview({ season: 2025, cwd });

      expect(report.projectedCoverageImprovement).toMatchObject({
        current_missing_rows: 5,
        missing_rows_that_could_become_zero_season_rows: 3,
        missing_rows_requiring_identifier_mapping: 1,
        projected_remaining_missing_rows: 2,
        current_missing_rate: 0.25,
        projected_missing_rate_after_safe_treatment: 0.1,
        projected_reliability_grade: "medium",
      });
      expect(report.strategyDistortionSummary.remaining_missing_rate_by_strategy[0]).toMatchObject({
        strategy: "adp_only",
        missing_rate: 0.4,
      });
      expect(report.strategyDistortionSummary.blackbird_rank_likely_stable_or_uncertain).toBe("likely_stable");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("recommends identifier review before H42 when strict candidates remain", () => {
    const cwd = setupWorkspace();
    try {
      writeArtifacts(cwd);

      const report = runHistoricalWeeklySourceExpansionReview({ season: 2025, cwd });

      expect(report.h37IntegrationRecommendation).toBe("weekly_source_expansion_needs_identifier_mapping");
      expect(report.recommendation).toBe("historical_weekly_source_expansion_needs_manual_review");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("writes artifacts and reports no live mutation", () => {
    const cwd = setupWorkspace();
    try {
      writeArtifacts(cwd);
      const report = runHistoricalWeeklySourceExpansionReview({ season: 2025, cwd });
      const artifacts = writeHistoricalWeeklySourceExpansionReviewArtifacts(report, cwd);

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
      const report = runHistoricalWeeklySourceExpansionReview({ season: 2025, cwd });

      expect(report.h37IntegrationRecommendation).toBe("weekly_source_expansion_blocked");
      expect(report.recommendation).toBe("historical_weekly_source_expansion_blocked");
      expect(report.limitations.join(" ")).toContain("Missing required artifact");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

function setupWorkspace() {
  const cwd = path.join(tmpdir(), `blackbird-h41-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(path.join(cwd, "artifacts", "projections", "backtesting"), { recursive: true });
  mkdirSync(path.join(cwd, "data", "nflverse"), { recursive: true });
  return cwd;
}

function writeArtifacts(cwd: string) {
  const artifactDir = path.join(cwd, "artifacts", "projections", "backtesting");
  writeFileSync(path.join(artifactDir, "historical-season-outcome-scorer-2025.json"), JSON.stringify(h37()), "utf8");
  writeFileSync(path.join(artifactDir, "historical-outcome-coverage-diagnostics-2025.json"), JSON.stringify(h39()), "utf8");
  writeFileSync(path.join(artifactDir, "historical-strategy-comparison-2025.json"), JSON.stringify(h38()), "utf8");
  writeFileSync(path.join(artifactDir, "historical-draft-universe-2025.json"), JSON.stringify({ dataLeakageGuard: { noOutcomePointsJoinedIntoDraftUniverse: true } }), "utf8");
  writeFileSync(path.join(artifactDir, "historical-weekly-results-2025.normalized.json"), JSON.stringify({ summary: { weeksCovered: [1, 2] }, results: [] }), "utf8");
  writeFileSync(path.join(cwd, "data", "nflverse", "rosters_2025.csv"), [
    "season,team,position,status,full_name,gsis_id,sleeper_id",
    "2025,AAA,RB,RES,Roster Match,g1,s1",
  ].join("\n"), "utf8");
  writeFileSync(path.join(cwd, "data", "nflverse", "players.csv"), [
    "gsis_id,display_name,position,latest_team,status",
    "g2,Registry Match,WR,BBB,RET",
    "other-id,Identifier Candidate,TE,CCC,ACT",
  ].join("\n"), "utf8");
  writeFileSync(path.join(cwd, "data", "nflverse", "snap_counts_2018_2025.csv"), [
    "season,week,player,position,team,offense_snaps",
    "2025,1,Snap Candidate,TE,DDD,4",
  ].join("\n"), "utf8");
}

function h37(): HistoricalSeasonOutcomeScorerReport {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2025,
    scenarioPath: null,
    recommendation: "historical_outcome_scoring_ready_for_strategy_comparison",
    actualWeeklyResultsFound: true,
    weeklyInputCoverage: {
      resultRows: 10,
      weeks: [1, 2],
      scoredWeeklyResultRows: 12,
      exactIdMatches: 12,
      namePositionFallbackMatches: 0,
      trueZeroWeekRows: 3,
      registryBackedZeroSeasonRows: 0,
      missingPlayerScores: 5,
      missingScoreRateBeforeH40: 0.4,
      missingScoreRateBeforeZeroWeekTreatment: 0.4,
      missingScoreRateAfterTrueZeroWeekTreatment: 0.25,
      missingScoreRateAfterZeroWeekTreatment: 0.25,
      missingScoreRateAfterRegistryZeroSeasonTreatment: 0.25,
      playersWithSeasonLevelExactMatch: 2,
      playersWithRegistryOnlyExactMatch: 0,
      playersMissingFromBothWeeklyAndRegistrySource: 3,
      playersMissingFromWeeklySourceEntirely: 3,
      registryBackedZeroSeasonUnavailable: false,
    },
    draftEngineSummary: null,
    strategyOutcomes: [],
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

function h39(): HistoricalOutcomeCoverageDiagnosticsReport {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    season: 2025,
    recommendation: "historical_outcome_coverage_needs_source_expansion",
    h37IntegrationRecommendation: "coverage_needs_weekly_source_expansion",
    sourceArtifacts: {},
    missingScoreRows: [
      missing("p1", "s1", "g1", "Roster Match", "RB", "AAA", "blackbird_rank_only", 3, 1),
      missing("p1", "s1", "g1", "Roster Match", "RB", "AAA", "blackbird_rank_only", 3, 2),
      missing("p2", "s2", "g2", "Registry Match", "WR", "BBB", "projection_only", 5, 1),
      missing("p3", "s3", "g3", "Identifier Candidate", "TE", "CCC", "adp_only", 8, 1),
      missing("p4", "s4", "g4", "No Source", "QB", "DDD", "adp_only", 9, 2),
    ],
    missingReasonSummary: [],
    seasonLevelCoverage: [],
    trueZeroVsIdentifierMismatch: {
      true_zero_week_rows: 0,
      identifier_mismatch_suspected_rows: 0,
      source_expansion_needed_rows: 5,
      manual_review_candidate_rows: 0,
    },
    improvementPreview: {
      current_missing_rows: 5,
      new_exact_matches_possible: 0,
      new_strict_name_position_team_review_candidates: 0,
      true_zero_week_rows_to_synthesize: 0,
      remaining_missing_after_preview: 5,
      current_missing_score_rate: 0.25,
      projected_missing_score_rate_after_preview: 0.25,
    },
    strategyImpactPreview: {
      missing_score_rate_by_strategy: [],
      missing_score_rate_by_position: [],
      missing_score_rate_by_draft_round: [],
      blackbird_missing_score_rate: 0.1,
      baseline_missing_score_rates: {},
      blackbird_rank_may_be_distorted_by_coverage: true,
    },
    dataLeakageGuard: {
      draftRostersCameFromH36PreseasonOnlyEngine: true,
      outcomesCameFromH37ScoringPhase: true,
      actualSeasonPointsUsedOnlyAfterDraftsWereComplete: true,
      noLooseFuzzyConfirmedMatches: true,
    },
    limitations: [],
    safetyGates: [],
  };
}

function h38(): HistoricalStrategyComparisonReport {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    season: 2025,
    recommendation: "historical_strategy_comparison_needs_coverage_improvement",
    sourceArtifacts: { mockDraftEngine: "", seasonOutcomeScorer: "", draftUniverse: "", weeklyResults: "" },
    strategyLeaderboard: [],
    blackbirdFocus: {
      blackbirdOverallRank: 2,
      strategiesBlackbirdBeat: [],
      strategiesThatBeatBlackbird: [],
      blackbirdPointDeltaVsBaseline: {},
      blackbirdWeeklyAverageDeltaVsBaseline: {},
      blackbirdBestTeamRank: 1,
      blackbirdWorstTeamRank: 3,
    },
    teamLevelComparison: [],
    positionalOutcomeAnalysis: [],
    draftCapitalRoundAnalysis: {
      roundSummaries: [],
      early_round_efficiency: {} as HistoricalStrategyComparisonReport["draftCapitalRoundAnalysis"]["early_round_efficiency"],
      middle_round_efficiency: {} as HistoricalStrategyComparisonReport["draftCapitalRoundAnalysis"]["middle_round_efficiency"],
      late_round_efficiency: {} as HistoricalStrategyComparisonReport["draftCapitalRoundAnalysis"]["late_round_efficiency"],
      best_value_picks: [],
      worst_misses: [],
      limitations: [],
    },
    missingScoreCoverage: {
      universePlayers: 3,
      weeklyExactIdMatchedUniversePlayers: 1,
      universeMissingWeeklyOutcomePlayers: 2,
      h37ExactIdMatches: 12,
      trueZeroWeekRows: 3,
      registryBackedZeroSeasonRows: 0,
      h37MissingPlayerScores: 5,
      missingScoreRate: 0.25,
      missingScoreRateBeforeZeroWeekTreatment: 0.4,
      adjustedMissingScoreRate: 0.25,
      finalMissingScoreRate: 0.25,
      positionsMostAffectedByMissingScores: [],
      strategiesMostAffectedByMissingScores: [],
      adjustedMissingScoreRateByStrategy: [
        { strategy: "adp_only", missingScoreRate: 0.4, missingScoreCount: 2, totalPlayerWeeks: 5 },
        { strategy: "blackbird_rank_only", missingScoreRate: 0.1, missingScoreCount: 2, totalPlayerWeeks: 20 },
        { strategy: "projection_only", missingScoreRate: 0.1, missingScoreCount: 1, totalPlayerWeeks: 10 },
      ],
      reliabilityGrade: "low",
      warning: "directional",
    },
    dataLeakageGuard: {
      draftRostersCameFromH36PreseasonOnlyEngine: true,
      outcomesCameFromH37ScoringPhase: true,
      strategyComparisonDidNotRecomputeRankingsFromOutcomes: true,
      actualSeasonPointsUsedOnlyAfterDraftsWereComplete: true,
    },
    limitations: [],
    safetyGates: [],
  };
}

function missing(
  player_id: string,
  sleeper_id: string,
  gsis_id: string,
  player_name: string,
  position: string,
  team: string,
  strategy: "blackbird_rank_only" | "projection_only" | "adp_only",
  draft_round: number,
  week: number,
) {
  return {
    strategy,
    team_id: "slot-1",
    draft_slot: 1,
    week,
    player_id,
    sleeper_id,
    gsis_id,
    player_name,
    position,
    team,
    draft_round,
    draft_pick: draft_round * 10,
    missing_reason: "player_not_in_weekly_source" as const,
    candidate_match_status: "none" as const,
    season_level_player_found_in_weekly_source: false,
    week_level_row_found: false,
    score_should_be_zero_for_week: false,
    mapping_failure_suspected: false,
    candidate_count: 0,
  };
}
