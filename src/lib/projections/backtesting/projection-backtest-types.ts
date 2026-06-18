import type {
  HistoricalPlayerProfileSnapshot,
  PlayerProfileScoringMetadata,
  PlayerProfileScoringProfile,
} from "@/lib/player-profiles";

export type ProjectionBacktestBaselineModel =
  | "prior_season_ppg"
  | "weighted_recent_ppg"
  | "career_recent_blend"
  | "profile_informed_simple"
  | "blackbird_existing_projection"
  | "blackbird_availability_calibrated"
  | "blackbird_no_prior_calibrated"
  | "blackbird_calibrated_v2"
  | "blackbird_cohort_games_calibrated"
  | "blackbird_cohort_ppg_calibrated"
  | "blackbird_cohort_calibrated_v3"
  | "blackbird_expected_games_v4"
  | "blackbird_expected_games_v5_selective"
  | "blackbird_expected_games_v6_gated"
  | "blackbird_expected_games_v7_family_selective"
  | "blackbird_expected_games_v8_cohort_blend"
  | "blackbird_expected_games_v8_1_calibrated_gate"
  | "blackbird_expected_games_v8_2_high_impact_guardrail";

export type ProjectionBacktestCohort =
  | "veteran_3plus_prior_seasons"
  | "two_prior_seasons"
  | "one_prior_season"
  | "rookie_or_no_prior_nfl_data"
  | "low_prior_sample"
  | "low_actual_sample"
  | "idp_dl"
  | "idp_lb"
  | "idp_db"
  | "offense_qb"
  | "offense_rb"
  | "offense_wr"
  | "offense_te"
  | "kicker";

export type ProjectionBacktestClassification =
  | "accurate"
  | "overprojected"
  | "underprojected"
  | "major_miss_high"
  | "major_miss_low"
  | "insufficient_prior_data"
  | "low_sample_actual"
  | "identity_warning"
  | "role_change_candidate"
  | "injury_or_availability_candidate";

export type ProjectionBacktestAvailabilityMissType =
  | "accurate_games"
  | "overestimated_availability"
  | "underestimated_availability"
  | "major_availability_miss"
  | "low_actual_games"
  | "no_games_projection";

export type ProjectionBacktestPriorDataGroup =
  | "rookie"
  | "second_year"
  | "no_prior_stats"
  | "one_prior_season"
  | "role_change_warning"
  | "multi_year_prior";

export type ProjectionBacktestOptions = {
  targetSeason: number;
  positions: string[] | null;
  includeIdp: boolean;
  includeExistingProjections?: boolean;
  scoring: "default";
  draftRoomId?: string | null;
  leagueId?: string | null;
};

export type ProjectionBacktestInputFeatures = {
  inputSeasonsUsed: number[];
  priorSeason: number | null;
  priorSeasonGames: number | null;
  priorSeasonPoints: number | null;
  priorSeasonPpg: number | null;
  priorSeasonFloor: number | null;
  priorSeasonMedian: number | null;
  priorSeasonCeiling: number | null;
  priorSeasonConsistency: number | null;
  priorSeasonSpike: number | null;
  priorSeasonAvailability: number | null;
  recentSeasonPpgs: Array<{ season: number; ppg: number; games: number; points: number }>;
  priorSeasonOffensiveSnapShare: number | null;
  priorSeasonDefensiveSnapShare: number | null;
  priorSeasonHighValueUsageAvailable: boolean;
  priorSeasonHighValueUsageFlags: string[];
  careerToDateGames: number;
  careerToDatePoints: number;
  careerToDatePpg: number | null;
  careerTrendPpg: number | null;
  rookieSeason: number | null;
  yearsExperience: number | null;
  roleLabelThroughPreviousSeason: string;
  usageTrendThroughPreviousSeason: string;
  coverageLabel: string | null;
  warnings: string[];
};

export type ProjectionBacktestActuals = {
  games: number;
  totalPoints: number;
  pointsPerGame: number | null;
  weeklyScores: number[];
  positionalRank: number | null;
};

export type ProjectionBacktestPrediction = {
  model: ProjectionBacktestBaselineModel;
  predictedPpg: number | null;
  predictedGames: number | null;
  predictedTotalPoints: number | null;
  errorPpg: number | null;
  errorTotalPoints: number | null;
  gamesError: number | null;
  availabilityMissType: ProjectionBacktestAvailabilityMissType;
  ppgErrorComponent: number | null;
  gamesErrorComponent: number | null;
  combinedError: number | null;
  projectionSource: string | null;
  matchConfidence: string | null;
  reasons: string[];
};

export type ProjectionBacktestPlayerRow = {
  identity: {
    sleeperId: string | null;
    gsisId: string;
    name: string;
    position: string;
    team: string | null;
    matchConfidence: string;
  };
  actuals: ProjectionBacktestActuals;
  inputFeatures: ProjectionBacktestInputFeatures;
  predictions: Record<ProjectionBacktestBaselineModel, ProjectionBacktestPrediction | null>;
  bestBaseline: ProjectionBacktestBaselineModel | null;
  classification: ProjectionBacktestClassification;
  priorDataGroup: ProjectionBacktestPriorDataGroup;
  cohortLabels: ProjectionBacktestCohort[];
};

export type ProjectionBacktestDataset = {
  targetSeason: number;
  inputSeasonsUsed: number[];
  actualSeasonUsed: number;
  rows: ProjectionBacktestPlayerRow[];
  skipped: {
    missingActuals: number;
    positionFiltered: number;
    insufficientPositionSupport: number;
  };
  leakageSafety: {
    targetSeasonExcludedFromInputFeatures: boolean;
    inputSeasonsUsed: number[];
    actualSeasonUsed: number;
  };
};

export type ProjectionBacktestMetricSet = {
  count: number;
  maeTotal: number | null;
  maePpg: number | null;
  rmseTotal: number | null;
  rmsePpg: number | null;
  biasTotal: number | null;
  biasPpg: number | null;
  medianAbsErrorTotal: number | null;
  medianAbsErrorPpg: number | null;
  correlationTotal: number | null;
  correlationPpg: number | null;
  rankCorrelationTotal: number | null;
  gamesMae: number | null;
  availabilityMissCounts: Record<ProjectionBacktestAvailabilityMissType, number>;
  hitRates: Record<string, number | null>;
};

export type ProjectionBacktestMetrics = {
  overall: Record<ProjectionBacktestBaselineModel, ProjectionBacktestMetricSet>;
  byPosition: Record<string, Record<ProjectionBacktestBaselineModel, ProjectionBacktestMetricSet>>;
  byCohort: Record<string, Record<ProjectionBacktestBaselineModel, ProjectionBacktestCohortMetricSet>>;
  bestBaselineModel: ProjectionBacktestBaselineModel | null;
  worstBaselineModel: ProjectionBacktestBaselineModel | null;
};

export type ProjectionBacktestCohortMetricSet = ProjectionBacktestMetricSet & {
  playersEvaluated: number;
  averageProjectedGames: number | null;
  averageActualGames: number | null;
  overprojectionCount: number;
  underprojectionCount: number;
  majorMissCount: number;
};

export type ProjectionBacktestReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  targetSeason: number;
  scoring: {
    source: PlayerProfileScoringMetadata["scoringSource"];
    profile: PlayerProfileScoringProfile["label"];
    warnings: string[];
  };
  options: ProjectionBacktestOptions;
  playersEvaluated: number;
  playersSkipped: ProjectionBacktestDataset["skipped"];
  dataset: ProjectionBacktestDataset;
  metrics: ProjectionBacktestMetrics;
  classificationCounts: Record<string, number>;
  positionCounts: Record<string, number>;
  overprojectedLeaders: ProjectionBacktestLeader[];
  underprojectedLeaders: ProjectionBacktestLeader[];
  biggestRankMisses: ProjectionBacktestRankMiss[];
  existingProjectionSummary: ProjectionBacktestExistingProjectionSummary;
  availabilitySummary: ProjectionBacktestAvailabilitySummary;
  errorDecompositionSummary: ProjectionBacktestErrorDecompositionSummary;
  priorDataSummary: Record<ProjectionBacktestPriorDataGroup, number>;
  idpCalibrationSummary: {
    included: boolean;
    playersEvaluated: number;
    bestBaselineModel: ProjectionBacktestBaselineModel | null;
    byPosition: Record<string, ProjectionBacktestMetricSet>;
    roleLabelCounts: Record<string, number>;
    overprojectionLeaders: ProjectionBacktestLeader[];
    underprojectionLeaders: ProjectionBacktestLeader[];
    notes: string[];
  };
  rookieLowSampleSummary: {
    lowActualSamplePlayers: number;
    insufficientPriorDataPlayers: number;
  };
  leakageSafety: ProjectionBacktestDataset["leakageSafety"] & {
    notes: string[];
  };
  recommendedNextCalibrationPriorities: string[];
};

export type ProjectionBacktestLeader = {
  player: string;
  position: string;
  team: string | null;
  model: ProjectionBacktestBaselineModel;
  predictedPpg: number | null;
  actualPpg: number | null;
  errorPpg: number | null;
  predictedTotalPoints: number | null;
  actualTotalPoints: number;
  errorTotalPoints: number | null;
  classification: ProjectionBacktestClassification;
};

export type ProjectionBacktestRankMiss = {
  player: string;
  position: string;
  team: string | null;
  model: ProjectionBacktestBaselineModel;
  predictedRank: number;
  actualRank: number;
  rankDelta: number;
};

export type ProjectionBacktestSource = {
  profiles: HistoricalPlayerProfileSnapshot[];
  scoringProfile: PlayerProfileScoringProfile;
  scoringMetadata: PlayerProfileScoringMetadata;
  existingProjectionSource?: ProjectionBacktestExistingProjectionSource | null;
};

export type ProjectionBacktestExistingProjectionRow = {
  playerId: string | null;
  sleeperId?: string | null;
  gsisId?: string | null;
  espnId?: string | null;
  playerName: string;
  normalizedName?: string | null;
  position: string;
  team?: string | null;
  projectedTotalPoints: number | null;
  projectedPpg: number | null;
  projectedGames: number | null;
  floorPoints?: number | null;
  medianPoints?: number | null;
  ceilingPoints?: number | null;
  confidence?: string | null;
  source: string;
  projectionRunId?: string | null;
  matchConfidence?: string | null;
};

export type ProjectionBacktestExistingProjectionSource = {
  status: "available" | "unavailable" | "rejected";
  sourceName: string;
  sourcePath: string | null;
  targetSeason: number | null;
  projectionSeason: number | null;
  leakageSafe: boolean;
  rows: ProjectionBacktestExistingProjectionRow[];
  diagnostics: string[];
};

export type ProjectionBacktestExistingProjectionSummary = {
  requested: boolean;
  status: "available" | "unavailable" | "rejected";
  sourceName: string | null;
  sourcePath: string | null;
  leakageSafe: boolean;
  sourceRows: number;
  matchedRows: number;
  matchCoverage: number | null;
  diagnostics: string[];
};

export type ProjectionBacktestAvailabilitySummary = {
  model: ProjectionBacktestBaselineModel | null;
  counts: Record<ProjectionBacktestAvailabilityMissType, number>;
  averageGamesError: number | null;
  gamesMae: number | null;
  majorMissPlayers: number;
};

export type ProjectionBacktestErrorDecompositionSummary = {
  model: ProjectionBacktestBaselineModel | null;
  averagePpgErrorComponent: number | null;
  averageGamesErrorComponent: number | null;
  averageCombinedError: number | null;
  ppgDrivenMisses: number;
  availabilityDrivenMisses: number;
};
