import type { HistoricalMockDraftStrategy } from "./historical-mock-draft-engine-types";

export type HistoricalStrategyComparisonRecommendation =
  | "historical_strategy_comparison_ready_for_review"
  | "historical_strategy_comparison_needs_coverage_improvement"
  | "historical_strategy_comparison_needs_outcome_data"
  | "historical_strategy_comparison_needs_bugfix"
  | "historical_strategy_comparison_blocked";

export type HistoricalStrategyLeaderboardRow = {
  strategy: HistoricalMockDraftStrategy;
  rank: number;
  best_ball_total_points: number;
  weekly_average: number;
  best_team_points: number;
  worst_team_points: number;
  average_team_points: number;
  median_team_points: number;
  team_count: number;
  blackbird_delta_points: number;
  blackbird_delta_weekly_average: number;
};

export type HistoricalTeamComparisonRow = {
  strategy: HistoricalMockDraftStrategy;
  team_id: string;
  draft_slot: number | null;
  season_points: number;
  weekly_average: number;
  weekly_scores: number[];
  position_points: Record<string, number>;
  starter_fill_rate: number;
  zero_score_starter_weeks: number;
  missing_score_count: number;
};

export type HistoricalPositionalOutcomeSummary = {
  strategy: HistoricalMockDraftStrategy;
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX: number;
  SUPERFLEX: number;
  positional_advantage_vs_field: Record<string, number>;
  position_that_drove_success: string | "not_available_v1";
  position_that_hurt_most: string | "not_available_v1";
};

export type HistoricalDraftCapitalRoundSummary = {
  strategy: HistoricalMockDraftStrategy;
  round: number;
  points_by_round_drafted: number;
  hits_by_round: number;
  busts_by_round: number;
};

export type HistoricalDraftCapitalAnalysis = {
  roundSummaries: HistoricalDraftCapitalRoundSummary[];
  early_round_efficiency: Record<HistoricalMockDraftStrategy, number>;
  middle_round_efficiency: Record<HistoricalMockDraftStrategy, number>;
  late_round_efficiency: Record<HistoricalMockDraftStrategy, number>;
  best_value_picks: Array<{ strategy: HistoricalMockDraftStrategy; player: string; round: number; points: number }>;
  worst_misses: Array<{ strategy: HistoricalMockDraftStrategy; player: string; round: number; points: number }>;
  limitations: string[];
};

export type HistoricalMissingScoreCoverage = {
  universePlayers: number;
  weeklyExactIdMatchedUniversePlayers: number;
  universeMissingWeeklyOutcomePlayers: number;
  h37ExactIdMatches: number;
  trueZeroWeekRows: number;
  registryBackedZeroSeasonRows: number;
  h37MissingPlayerScores: number;
  missingScoreRate: number;
  missingScoreRateBeforeZeroWeekTreatment: number;
  adjustedMissingScoreRate: number;
  finalMissingScoreRate: number;
  positionsMostAffectedByMissingScores: Array<{ position: string; missingScoreCount: number }>;
  strategiesMostAffectedByMissingScores: Array<{ strategy: HistoricalMockDraftStrategy; missingScoreCount: number }>;
  adjustedMissingScoreRateByStrategy: Array<{ strategy: HistoricalMockDraftStrategy; missingScoreRate: number; missingScoreCount: number; totalPlayerWeeks: number }>;
  reliabilityGrade: "high" | "medium" | "low" | "insufficient";
  warning: string | null;
};

export type HistoricalBlackbirdFocus = {
  blackbirdOverallRank: number | "not_available";
  strategiesBlackbirdBeat: HistoricalMockDraftStrategy[];
  strategiesThatBeatBlackbird: HistoricalMockDraftStrategy[];
  blackbirdPointDeltaVsBaseline: Record<string, number>;
  blackbirdWeeklyAverageDeltaVsBaseline: Record<string, number>;
  blackbirdBestTeamRank: number | "not_available";
  blackbirdWorstTeamRank: number | "not_available";
};

export type HistoricalStrategyComparisonReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  season: number;
  recommendation: HistoricalStrategyComparisonRecommendation;
  sourceArtifacts: {
    mockDraftEngine: string;
    seasonOutcomeScorer: string;
    draftUniverse: string;
    weeklyResults: string;
  };
  strategyLeaderboard: HistoricalStrategyLeaderboardRow[];
  blackbirdFocus: HistoricalBlackbirdFocus;
  teamLevelComparison: HistoricalTeamComparisonRow[];
  positionalOutcomeAnalysis: HistoricalPositionalOutcomeSummary[];
  draftCapitalRoundAnalysis: HistoricalDraftCapitalAnalysis;
  missingScoreCoverage: HistoricalMissingScoreCoverage;
  dataLeakageGuard: {
    draftRostersCameFromH36PreseasonOnlyEngine: boolean;
    outcomesCameFromH37ScoringPhase: boolean;
    strategyComparisonDidNotRecomputeRankingsFromOutcomes: boolean;
    actualSeasonPointsUsedOnlyAfterDraftsWereComplete: boolean;
  };
  limitations: string[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
};

export type HistoricalStrategyComparisonArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
