import type {
  ProjectionBacktestBaselineModel,
  ProjectionBacktestPrediction,
  ProjectionBacktestReport,
} from "./projection-backtest-types";
import type {
  PreseasonProjectionSnapshot,
  PreseasonProjectionSnapshotRow,
} from "./preseason-projection-snapshot-types";

export type ProjectionParityAuditRootCause =
  | "row_universe_difference"
  | "ppg_anchor_mismatch"
  | "baseline_games_mismatch"
  | "fallback_not_applied"
  | "fallback_applied_but_not_baseline_equivalent"
  | "v6_v7_same_path"
  | "te_k_baseline_definition_issue"
  | "no_issue_detected";

export type ProjectionParityEvaluationCohort =
  | "all_rows"
  | "shared_weighted_rows"
  | "v7_only_rows"
  | "veteran_prior_sample"
  | "rookie"
  | "second_year_low_prior"
  | "no_prior_stats"
  | "low_prior_sample"
  | "te_fallback"
  | "k_fallback"
  | "idp"
  | "offense"
  | "kicker";

export type ProjectionParityAuditOptions = {
  targetSeason: number;
  includeIdp: boolean;
};

export type ProjectionParityAuditInput = {
  report: ProjectionBacktestReport;
  snapshot: PreseasonProjectionSnapshot;
  options: ProjectionParityAuditOptions;
};

export type ProjectionParityAuditPredictionSummary = {
  ppg: number | null;
  games: number | null;
  total: number | null;
  errorPpg: number | null;
  errorGames: number | null;
  errorTotal: number | null;
};

export type ProjectionParityNoPriorBaselineSummary = {
  expectedGames: number | null;
  protocol: "conservative_position_prior" | null;
  basis: string | null;
  errorGames: number | null;
  reasons: string[];
};

export type ProjectionParitySnapshotDiagnostics = Pick<
  PreseasonProjectionSnapshotRow["expectedGamesDiagnostics"],
  | "weightedRecentGames"
  | "v6ProjectedGames"
  | "v7ProjectedGames"
  | "v8ProjectedGames"
  | "v81ProjectedGames"
  | "v6SelectedExpectedGamesMethod"
  | "v6GateReason"
  | "v6PositionFamilyGateStatus"
  | "v6FallbackReason"
  | "v7SelectedExpectedGamesMethod"
  | "v7GateReason"
  | "v7PositionFamilyGateStatus"
  | "v7FallbackReason"
  | "v8SelectedExpectedGamesMethod"
  | "v8Cohort"
  | "v8BaselineExpectedGames"
  | "v8Adjustment"
  | "v8AdjustmentReason"
  | "v8BaselineSource"
  | "v8FallbackReason"
  | "v81BaseModelUsed"
  | "v81ProjectedGamesRawV8"
  | "v81ProjectedGamesV7"
  | "v81RawDeltaFromV7"
  | "v81CalibratedDeltaFromV7"
  | "v81DampeningFactor"
  | "v81GatesApplied"
  | "v81Cohort"
  | "v81Position"
  | "v81PpgBucket"
  | "v81AdjustmentBucket"
  | "v81ReasonCodes"
  | "v81SelectedExpectedGamesReason"
  | "v82BaseModelUsed"
  | "v82ProjectedGamesV7"
  | "v82ProjectedGamesV8"
  | "v82ProjectedGamesV81"
  | "v82DeltaFromV7"
  | "v82DeltaFromV81"
  | "v82GuardrailApplied"
  | "v82GuardrailReasonCodes"
  | "v82PpgBucket"
  | "v82AdjustmentBucket"
  | "v82SelectedExpectedGamesReason"
>;

export type ProjectionParityAuditRow = {
  key: string;
  player: string;
  sleeperId: string | null;
  gsisId: string | null;
  position: string;
  team: string | null;
  priorDataGroup: string;
  cohortLabels: string[];
  evaluationCohorts: ProjectionParityEvaluationCohort[];
  actualGames: number;
  actualPpg: number | null;
  actualPoints: number;
  weighted: ProjectionParityAuditPredictionSummary;
  noPriorBaseline: ProjectionParityNoPriorBaselineSummary;
  v6: ProjectionParityAuditPredictionSummary;
  v7: ProjectionParityAuditPredictionSummary;
  v8: ProjectionParityAuditPredictionSummary;
  v81: ProjectionParityAuditPredictionSummary;
  v82: ProjectionParityAuditPredictionSummary;
  ppgAnchorDiff: number | null;
  gamesBaselineDiff: number | null;
  totalDiff: number | null;
  v6V7PpgDiff: number | null;
  v6V7GamesDiff: number | null;
  v6V7TotalDiff: number | null;
  v7V8PpgDiff: number | null;
  v7V8GamesDiff: number | null;
  v7V8TotalDiff: number | null;
  v7V81PpgDiff: number | null;
  v7V81GamesDiff: number | null;
  v7V81TotalDiff: number | null;
  v8V81PpgDiff: number | null;
  v8V81GamesDiff: number | null;
  v8V81TotalDiff: number | null;
  v7V82PpgDiff: number | null;
  v7V82GamesDiff: number | null;
  v7V82TotalDiff: number | null;
  v81V82PpgDiff: number | null;
  v81V82GamesDiff: number | null;
  v81V82TotalDiff: number | null;
  snapshotDiagnostics: ProjectionParitySnapshotDiagnostics | null;
  rootCauses: ProjectionParityAuditRootCause[];
};

export type ProjectionParityMetricSummary = {
  count: number;
  weightedMaePpg: number | null;
  v7MaePpg: number | null;
  weightedMaeGames: number | null;
  v7MaeGames: number | null;
  weightedMaeTotal: number | null;
  v7MaeTotal: number | null;
  v7DeltaMaePpg: number | null;
  v7DeltaMaeGames: number | null;
  v7DeltaMaeTotal: number | null;
};

export type ProjectionParityCohortComparison = {
  cohort: ProjectionParityEvaluationCohort;
  description: string;
  applesToApples: boolean;
  rows: number;
  weightedRows: number;
  v7Rows: number;
  sharedRows: number;
  noPriorBaselineRows: number;
  weightedMaeGames: number | null;
  noPriorBaselineMaeGames: number | null;
  v6MaeGames: number | null;
  v7MaeGames: number | null;
  v8MaeGames: number | null;
  v81MaeGames: number | null;
  v82MaeGames: number | null;
  v8DeltaMaeGamesVsV7: number | null;
  v81DeltaMaeGamesVsV7: number | null;
  v81DeltaMaeGamesVsV8: number | null;
  v82DeltaMaeGamesVsV7: number | null;
  v82DeltaMaeGamesVsV81: number | null;
  v7DeltaMaeGamesVsWeighted: number | null;
  v8DeltaMaeGamesVsWeighted: number | null;
  v81DeltaMaeGamesVsWeighted: number | null;
  v82DeltaMaeGamesVsWeighted: number | null;
  v7DeltaMaeGamesVsNoPriorBaseline: number | null;
  v8DeltaMaeGamesVsNoPriorBaseline: number | null;
  v81DeltaMaeGamesVsNoPriorBaseline: number | null;
  v82DeltaMaeGamesVsNoPriorBaseline: number | null;
  v8DifferentFromV7Rows: number;
  v8DifferentFromV7Rate: number | null;
  v81DifferentFromV7Rows: number;
  v81DifferentFromV7Rate: number | null;
  v81DifferentFromV8Rows: number;
  v81DifferentFromV8Rate: number | null;
  v82DifferentFromV7Rows: number;
  v82DifferentFromV7Rate: number | null;
  v82DifferentFromV81Rows: number;
  v82DifferentFromV81Rate: number | null;
  notes: string[];
};

export type ProjectionParityAuditReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  targetSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    backtest: string;
    snapshot: string;
  };
  rowUniverse: {
    weightedRows: number;
    v7Rows: number;
    sharedRows: number;
    weightedOnlyRows: number;
    v7OnlyRows: number;
    byPosition: Record<string, {
      weightedRows: number;
      v7Rows: number;
      sharedRows: number;
      weightedOnlyRows: number;
      v7OnlyRows: number;
    }>;
    v7OnlyByPriorDataGroup: Record<string, number>;
    v7OnlyByCohort: Record<string, number>;
  };
  sharedRowMetrics: ProjectionParityMetricSummary;
  evaluationCohorts: ProjectionParityCohortComparison[];
  comparisonProtocol: {
    sharedWeightedRows: string;
    v7OnlyRows: string;
    noPriorBaseline: {
      name: "conservative_position_prior";
      description: string;
      appliesToCohorts: ProjectionParityEvaluationCohort[];
      mergedIntoWeightedComparison: false;
    };
  };
  ppgAnchorParity: {
    comparedRows: number;
    mismatchedRows: number;
    matchedRows: number;
    averageAbsDiff: number | null;
    maxAbsDiff: number | null;
    examples: ProjectionParityAuditRow[];
  };
  gamesBaselineParity: {
    comparedRows: number;
    mismatchedRows: number;
    baselineImplementationMismatchRows: number;
    trueModelDifferenceRows: number;
    matchedRows: number;
    averageAbsDiff: number | null;
    maxAbsDiff: number | null;
    examples: ProjectionParityAuditRow[];
  };
  fallbackAudit: {
    TE: ProjectionParityFallbackPositionAudit;
    K: ProjectionParityFallbackPositionAudit;
  };
  v6V7IdentityAudit: {
    comparedRows: number;
    identicalRows: number;
    differentRows: number;
    identicalRate: number | null;
    examplesIdentical: ProjectionParityAuditRow[];
    examplesDifferent: ProjectionParityAuditRow[];
  };
  v7V8IdentityAudit: {
    comparedRows: number;
    identicalRows: number;
    differentRows: number;
    identicalRate: number | null;
    differentRate: number | null;
    byCohort: Record<string, { comparedRows: number; differentRows: number; differentRate: number | null }>;
    examplesIdentical: ProjectionParityAuditRow[];
    examplesDifferent: ProjectionParityAuditRow[];
  };
  v7V81IdentityAudit: {
    comparedRows: number;
    identicalRows: number;
    differentRows: number;
    identicalRate: number | null;
    differentRate: number | null;
    byCohort: Record<string, { comparedRows: number; differentRows: number; differentRate: number | null }>;
    examplesIdentical: ProjectionParityAuditRow[];
    examplesDifferent: ProjectionParityAuditRow[];
  };
  v8V81IdentityAudit: {
    comparedRows: number;
    identicalRows: number;
    differentRows: number;
    identicalRate: number | null;
    differentRate: number | null;
    byCohort: Record<string, { comparedRows: number; differentRows: number; differentRate: number | null }>;
    examplesIdentical: ProjectionParityAuditRow[];
    examplesDifferent: ProjectionParityAuditRow[];
  };
  v81V82IdentityAudit: {
    comparedRows: number;
    identicalRows: number;
    differentRows: number;
    identicalRate: number | null;
    differentRate: number | null;
    byCohort: Record<string, { comparedRows: number; differentRows: number; differentRate: number | null }>;
    examplesIdentical: ProjectionParityAuditRow[];
    examplesDifferent: ProjectionParityAuditRow[];
  };
  rootCauses: ProjectionParityAuditRootCause[];
  recommendationsBeforeV8: string[];
  rows: ProjectionParityAuditRow[];
};

export type ProjectionParityFallbackPositionAudit = {
  position: "TE" | "K";
  rows: number;
  fallbackAppliedRows: number;
  fallbackMissingRows: number;
  baselineEquivalentRows: number;
  baselineMismatchRows: number;
  weightedMaeTotal: number | null;
  v7MaeTotal: number | null;
  v7DeltaMaeTotal: number | null;
  examples: ProjectionParityAuditRow[];
};

export type ProjectionParityArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};

export type ProjectionParityModelKey =
  | "weighted_recent_ppg"
  | "blackbird_expected_games_v6_gated"
  | "blackbird_expected_games_v7_family_selective"
  | "blackbird_expected_games_v8_cohort_blend"
  | "blackbird_expected_games_v8_1_calibrated_gate"
  | "blackbird_expected_games_v8_2_high_impact_guardrail";

export type ProjectionParityPredictionAccessor = (
  predictions: Partial<Record<ProjectionBacktestBaselineModel, ProjectionBacktestPrediction | null>>
) => ProjectionBacktestPrediction | null | undefined;
