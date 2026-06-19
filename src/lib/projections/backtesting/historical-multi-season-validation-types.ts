import type { HistoricalMockDraftStrategy } from "./historical-mock-draft-engine-types";
import type { HistoricalStrategyLeaderboardRow } from "./historical-strategy-comparison-report-types";

export type HistoricalMultiSeasonProductConfidenceRecommendation =
  | "multi_season_validation_supports_blackbird_confidence"
  | "multi_season_validation_directional_only"
  | "multi_season_validation_needs_more_seasons"
  | "multi_season_validation_needs_source_data"
  | "multi_season_validation_blocked";

export type HistoricalMultiSeasonAvailability = {
  preseasonSnapshotPresent: boolean;
  weeklyResultsSourcePresent: boolean;
  playerRegistryPresent: boolean;
  rosterSourcePresent: boolean;
  generatedDraftUniversePresent: boolean;
  generatedDraftUniverseBuildable: boolean;
  historicalMockDraftScenarioPresent: boolean;
  historicalMockDraftScenarioBuildable: boolean;
  seasonOutcomeScoringArtifactPresent: boolean;
  seasonOutcomeScoringArtifactBuildable: boolean;
  strategyComparisonArtifactPresent: boolean;
  strategyComparisonArtifactBuildable: boolean;
  missingInputs: string[];
};

export type HistoricalMultiSeasonStatus = "available" | "not_available";

export type HistoricalSeasonValidationSummary = {
  season: number;
  status: HistoricalMultiSeasonStatus;
  availability: HistoricalMultiSeasonAvailability;
  strategyLeaderboard: HistoricalStrategyLeaderboardRow[];
  blackbirdRank: number | "not_available";
  blackbirdAveragePoints: number | "not_available";
  blackbirdDeltaVsBaseline: Record<string, number>;
  missingScoreRate: number | "not_available";
  reliabilityGrade: "high" | "medium" | "low" | "insufficient" | "not_available";
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  dataLeakageGuard: {
    draftRostersCameFromPreseasonOnlyEngine: boolean;
    weeklyRegistryOutcomesUsedOnlyAfterDraft: boolean;
    zeroWeekAndZeroSeasonDidNotAlterDraftRankings: boolean;
    strategyComparisonDidNotRecomputeDraftDecisionsFromOutcomes: boolean;
    actualSeasonPointsUsedOnlyAfterDraftsComplete: boolean;
  };
  notes: string[];
};

export type HistoricalMultiSeasonLeaderboardRow = {
  strategy: HistoricalMockDraftStrategy;
  averageRank: number;
  averagePoints: number;
  medianPoints: number;
  wins: number;
  top2Finishes: number;
  seasonsAvailable: number;
};

export type HistoricalBaselineComparisonRow = {
  baseline: Exclude<HistoricalMockDraftStrategy, "blackbird_rank_only">;
  seasonsWon: number;
  seasonsLost: number;
  seasonsTied: number;
  averagePointDelta: number;
  medianPointDelta: number;
  largestWin: number;
  largestLoss: number;
};

export type HistoricalMultiSeasonReliabilitySummary = {
  highReliabilitySeasons: number[];
  mediumReliabilitySeasons: number[];
  lowReliabilitySeasons: number[];
  insufficientReliabilitySeasons: number[];
  averageMissingScoreRate: number;
  coverageLimitationsBySeason: Array<{ season: number; limitations: string[] }>;
  productConfidenceClaimSupported: boolean;
};

export type HistoricalMultiSeasonValidationReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  seasonsRequested: number[];
  seasonsAvailable: number[];
  seasonsNotAvailable: number[];
  sourceAvailability: Array<{ season: number; availability: HistoricalMultiSeasonAvailability }>;
  perSeasonSummaries: HistoricalSeasonValidationSummary[];
  multiSeasonLeaderboard: HistoricalMultiSeasonLeaderboardRow[];
  blackbirdSummary: {
    averageRank: number | "not_available";
    bestSeason: number | "not_available";
    worstSeason: number | "not_available";
    averageDeltaVsBaseline: Record<string, number>;
  };
  baselineComparison: HistoricalBaselineComparisonRow[];
  reliabilitySummary: HistoricalMultiSeasonReliabilitySummary;
  productConfidenceRecommendation: HistoricalMultiSeasonProductConfidenceRecommendation;
  dataLeakageGuard: {
    allAvailableSeasonsPassed: boolean;
    bySeason: Array<{ season: number; passed: boolean; detail: string }>;
  };
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  artifactPaths: {
    strategyComparisonArtifacts: Array<{ season: number; path: string; present: boolean }>;
  };
  limitations: string[];
};

export type HistoricalMultiSeasonValidationArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
