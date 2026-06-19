import type { HistoricalMockDraftPlayer, HistoricalMockDraftStrategy } from "./historical-mock-draft-engine-types";

export type HistoricalMarketAnchorSource = "adpRank" | "marketRank" | "market_anchor_unavailable";
export type HistoricalMarketAnchorConfidenceBucket = "high" | "medium" | "low" | "unknown";
export type HistoricalMarketAnchorStrength = "light" | "default" | "strong";

export type HistoricalMarketAnchorRankedPlayer = HistoricalMockDraftPlayer & {
  marketAnchorRank: number | null;
  marketAnchorSource: HistoricalMarketAnchorSource;
  marketAnchorConfidenceBucket: HistoricalMarketAnchorConfidenceBucket;
  marketAnchorMovement: number;
};

export type HistoricalMarketFieldDiscovery = {
  sourceUsed: HistoricalMarketAnchorSource;
  players: number;
  playersWithAdpRank: number;
  playersWithMarketRank: number;
  playersWithBlackbirdRank: number;
  playersWithProjectionRank: number;
  playersWithProjectedPoints: number;
  playersWithConfidenceField: number;
  fieldsAvailable: string[];
};

export type HistoricalMarketAnchorMovementSummary = {
  averageRankMovement: number;
  maxRankMovement: number;
  movedUpMost: Array<{ playerId: string; playerName: string; position: string; originalRank: number | null; marketRank: number | null; anchoredRank: number | null; movement: number; confidenceBucket: HistoricalMarketAnchorConfidenceBucket }>;
  movedDownMost: Array<{ playerId: string; playerName: string; position: string; originalRank: number | null; marketRank: number | null; anchoredRank: number | null; movement: number; confidenceBucket: HistoricalMarketAnchorConfidenceBucket }>;
  movementByConfidenceBucket: Record<HistoricalMarketAnchorConfidenceBucket, { players: number; averageMovement: number; maxMovement: number }>;
  movementByPosition: Record<string, { players: number; averageMovement: number; maxMovement: number }>;
};

export type HistoricalMarketAnchorExperimentRecommendation =
  | "market_anchor_experiment_improved_blackbird"
  | "market_anchor_experiment_directional_only"
  | "market_anchor_experiment_no_improvement"
  | "market_anchor_experiment_needs_market_source"
  | "market_anchor_experiment_blocked";

export type HistoricalMarketAnchorExperimentReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  season: number;
  recommendation: HistoricalMarketAnchorExperimentRecommendation;
  marketFieldDiscovery: HistoricalMarketFieldDiscovery;
  confidenceWeights: Record<HistoricalMarketAnchorConfidenceBucket, { modelWeight: number; marketWeight: number }>;
  movementCaps: Record<HistoricalMarketAnchorStrength, number>;
  defaultMovementSummary: HistoricalMarketAnchorMovementSummary;
  strategyLeaderboard: Array<{ strategy: HistoricalMockDraftStrategy; rank: number; average_team_points: number; deltaVsBlackbirdOriginal: number | null; deltaVsNeedBased: number | null; deltaVsProjectionOnly: number | null; deltaVsMarketRank: number | null; deltaVsAdpOnly: number | null }>;
  improvedVsOriginalBlackbird: boolean;
  limitations: string[];
  dataLeakageGuard: {
    marketAnchorUsedOnlyPreseasonSafeFields: boolean;
    actualWeeklyOutcomesNotUsedDuringDraft: boolean;
    actualSeasonPointsUsedOnlyAfterDraftsComplete: boolean;
    rankBlendDidNotUseFinalSeasonResults: boolean;
  };
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
};

export type HistoricalMarketAnchorExperimentArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
