import type { HistoricalMockDraftEngineReport, HistoricalMockDraftStrategy } from "./historical-mock-draft-engine-types";

export type HistoricalOutcomeScoringRecommendation =
  | "historical_outcome_scoring_ready_for_strategy_comparison"
  | "historical_outcome_scoring_needs_actual_weekly_results"
  | "historical_outcome_scoring_needs_source_expansion"
  | "historical_outcome_scoring_needs_identifier_mapping"
  | "historical_outcome_scoring_needs_bugfix"
  | "historical_outcome_scoring_blocked";

export type HistoricalSeasonOutcomeScenario = {
  historicalSeason: number;
  draftEngineArtifactPath: string;
  weeklyResultsInputPath?: string | null;
  playerRegistryInputPath?: string | null;
  leagueType: string;
  rosterSettings: Record<string, number>;
  scoringSettings: Record<string, unknown>;
  lineupSettings: HistoricalLineupSettings;
  strategiesToScore: HistoricalMockDraftStrategy[];
  weeksToScore: number[];
};

export type HistoricalLineupSettings = {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX: number;
  SUPERFLEX: number;
  K: number;
  DST: number;
  DL?: number;
  LB?: number;
  DB?: number;
  IDP?: number;
};

export type HistoricalWeeklyResult = {
  week: number;
  player_id?: string | null;
  sleeper_id?: string | null;
  gsis_id?: string | null;
  player_name: string;
  position: string;
  fantasy_points: number;
};

export type HistoricalWeeklyResultsInput = {
  historicalSeason: number;
  results: HistoricalWeeklyResult[];
};

export type HistoricalLineupScoreStatus =
  | "scored_from_weekly_result"
  | "true_zero_week"
  | "registry_backed_zero_season"
  | "missing_weekly_source"
  | "missing_identifier_mapping"
  | "review_candidate_not_scored";

export type HistoricalPlayerRegistryRow = {
  player_id?: string | null;
  sleeper_id?: string | null;
  gsis_id?: string | null;
  player_name?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  position?: string | null;
  team?: string | null;
  latest_team?: string | null;
  status?: string | null;
};

export type HistoricalLineupPlayer = {
  playerId: string;
  playerName: string;
  position: string;
  points: number;
  matchedBy: "player_id" | "sleeper_id" | "gsis_id" | "name_position" | "missing";
  scoreStatus?: HistoricalLineupScoreStatus;
};

export type HistoricalWeeklyTeamScore = {
  week: number;
  teamKey: string;
  totalPoints: number;
  starters: HistoricalLineupPlayer[];
  bench: HistoricalLineupPlayer[];
  starterPoints: number;
  benchPoints: number;
  fillRate: number;
  zeroScoreStarterWeeks: number;
  positionalPointsBySlot: Record<string, number>;
};

export type HistoricalSeasonTeamOutcome = {
  strategy: HistoricalMockDraftStrategy;
  teamKey: string;
  best_ball_total_points: number;
  weekly_average: number;
  weekly_scores: HistoricalWeeklyTeamScore[];
  starter_points: number;
  bench_points: number;
  optimal_lineup_fill_rate: number;
  zero_score_starter_weeks: number;
  positional_points_by_slot: Record<string, number>;
  positional_advantage: Record<string, number | "not_available_v1">;
  replacement_value: "not_available_v1";
  hit_rate: number;
  bust_rate: number;
  regret_score: "not_available_v1";
};

export type HistoricalStrategyComparison = {
  blackbirdRankAmongStrategies: number | "not_available";
  blackbirdTotalPointsDeltaVsBaseline: Record<string, number>;
  blackbirdWeeklyAverageDeltaVsBaseline: Record<string, number>;
  blackbirdPositionalStrengthsWeaknesses: string[];
  blackbirdRosterConstructionOutcomeNotes: string[];
};

export type HistoricalSeasonOutcomeScorerReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  scenarioPath: string | null;
  recommendation: HistoricalOutcomeScoringRecommendation;
  actualWeeklyResultsFound: boolean;
  weeklyInputCoverage: {
    resultRows: number;
    weeks: number[];
    scoredWeeklyResultRows: number;
    exactIdMatches: number;
    namePositionFallbackMatches: number;
    trueZeroWeekRows: number;
    registryBackedZeroSeasonRows: number;
    missingPlayerScores: number;
    missingScoreRateBeforeH40: number;
    missingScoreRateBeforeZeroWeekTreatment: number;
    missingScoreRateAfterTrueZeroWeekTreatment: number;
    missingScoreRateAfterZeroWeekTreatment: number;
    missingScoreRateAfterRegistryZeroSeasonTreatment: number;
    playersWithSeasonLevelExactMatch: number;
    playersWithRegistryOnlyExactMatch: number;
    playersMissingFromBothWeeklyAndRegistrySource: number;
    playersMissingFromWeeklySourceEntirely: number;
    registryBackedZeroSeasonUnavailable: boolean;
  };
  draftEngineSummary: Pick<HistoricalMockDraftEngineReport, "recommendation" | "draftOrderType"> | null;
  strategyOutcomes: HistoricalSeasonTeamOutcome[];
  strategyComparison: HistoricalStrategyComparison | null;
  myTeamFocus: Record<string, unknown> | null;
  dataLeakageGuard: {
    draftArtifactLoadedBeforeOutcomes: boolean;
    actualOutcomesOnlyUsedInScoringPhase: boolean;
    draftRankingsNotRecomputedFromOutcomes: boolean;
    noFutureFieldsUsedInDraftSimulation: boolean;
  };
  limitations: string[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
};

export type HistoricalSeasonOutcomeScorerArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
