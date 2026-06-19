import type { HistoricalMockDraftPlayer, HistoricalMockDraftScenario } from "./historical-mock-draft-engine-types";

export type HistoricalDraftUniverseRecommendation =
  | "historical_draft_universe_ready_for_h36_h37"
  | "historical_draft_universe_needs_preseason_snapshot"
  | "historical_draft_universe_needs_identifier_mapping"
  | "historical_draft_universe_needs_ranking_fields"
  | "historical_draft_universe_blocked";

export type HistoricalDraftUniverseOptions = {
  season: number;
  includeIdp: boolean;
  includeK: boolean;
  includeDst: boolean;
  minProjectionPoints?: number | null;
};

export type HistoricalDraftUniverseRow = {
  player_id: string;
  sleeper_id: string | null;
  gsis_id: string | null;
  player_name: string;
  position: string;
  team: string | null;
  age: number | null;
  years_exp: number | null;
  projection_points: number;
  projection_ppg: number | null;
  blackbird_rank: number | null;
  blackbird_rank_fallback: number | null;
  blackbird_score: number | null;
  draft_score: number | null;
  adp: number | null;
  market_rank: number | null;
  source: string;
  source_confidence: string;
  notes: string[];
};

export type HistoricalDraftUniverseSourceDiscovery = {
  preseasonProjectionSnapshot: {
    path: string;
    exists: boolean;
    rows: number;
    playersWithPlayerId: number;
    playersWithSleeperId: number;
    playersWithGsisId: number;
    playersWithPlayerName: number;
    positionsCovered: string[];
    teamsCovered: string[];
    rankingFieldsAvailable: string[];
    projectionFieldsAvailable: string[];
    adpMarketFieldsAvailable: string[];
    blackbirdRankLikeFieldsAvailable: string[];
  };
};

export type HistoricalDraftUniverseIdentifierCoveragePreview = {
  universePlayers: number;
  playersWithWeeklyResultExactIdMatch: number;
  playersWithWeeklyResultNamePositionFallback: number;
  playersMissingWeeklyOutcome: number;
  matchRateByPosition: Record<string, { total: number; exact: number; fallback: number; missing: number; matchRate: number }>;
};

export type HistoricalDraftUniverseReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  season: number;
  recommendation: HistoricalDraftUniverseRecommendation;
  options: HistoricalDraftUniverseOptions;
  sourceDiscovery: HistoricalDraftUniverseSourceDiscovery;
  summary: {
    universeRows: number;
    positions: string[];
    teams: string[];
    rankingFallbackUsed: string | null;
    projectionFieldUsed: string | null;
    rowsWithPlayerId: number;
    rowsWithSleeperId: number;
    rowsWithGsisId: number;
  };
  identifierCoveragePreview: HistoricalDraftUniverseIdentifierCoveragePreview;
  generatedH36ScenarioPath: string;
  h36PlayerUniverse: HistoricalMockDraftPlayer[];
  generatedH36Scenario: HistoricalMockDraftScenario;
  rows: HistoricalDraftUniverseRow[];
  dataLeakageGuard: {
    actualWeeklyOutcomesNotUsedForRanking: boolean;
    weeklyOutcomesUsedOnlyForIdentifierCoveragePreview: boolean;
    noOutcomePointsJoinedIntoDraftUniverse: boolean;
    noFutureFieldsUsed: boolean;
  };
  limitations: string[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
};

export type HistoricalDraftUniverseArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
  scenarioPath: string;
};

