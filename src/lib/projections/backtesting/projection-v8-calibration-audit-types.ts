import type {
  ProjectionParityAuditReport,
  ProjectionParityAuditRow,
  ProjectionParityEvaluationCohort,
} from "./projection-parity-audit-types";

export type ProjectionV8CalibrationAuditOptions = {
  targetSeason: number;
  includeIdp: boolean;
};

export type ProjectionV8CalibrationMetricRow = {
  segment: string;
  rows: number;
  v7GamesMae: number | null;
  v8GamesMae: number | null;
  v81GamesMae: number | null;
  v82GamesMae: number | null;
  gamesMaeDelta: number | null;
  v81GamesMaeDeltaVsV7: number | null;
  v81GamesMaeDeltaVsV8: number | null;
  v82GamesMaeDeltaVsV7: number | null;
  v82GamesMaeDeltaVsV81: number | null;
  v7TotalMae: number | null;
  v8TotalMae: number | null;
  v81TotalMae: number | null;
  v82TotalMae: number | null;
  totalMaeDelta: number | null;
  v81TotalMaeDeltaVsV7: number | null;
  v81TotalMaeDeltaVsV8: number | null;
  v82TotalMaeDeltaVsV7: number | null;
  v82TotalMaeDeltaVsV81: number | null;
  v7TotalRmse: number | null;
  v8TotalRmse: number | null;
  v81TotalRmse: number | null;
  v82TotalRmse: number | null;
  totalRmseDelta: number | null;
  v81TotalRmseDeltaVsV7: number | null;
  v81TotalRmseDeltaVsV8: number | null;
  v82TotalRmseDeltaVsV7: number | null;
  v82TotalRmseDeltaVsV81: number | null;
  v7TotalBias: number | null;
  v8TotalBias: number | null;
  v81TotalBias: number | null;
  v82TotalBias: number | null;
  totalBiasDelta: number | null;
  v81TotalBiasDeltaVsV7: number | null;
  v81TotalBiasDeltaVsV8: number | null;
  v82TotalBiasDeltaVsV7: number | null;
  v82TotalBiasDeltaVsV81: number | null;
  v8DifferentRowCount: number;
  v8DifferentRowRate: number | null;
  v81DifferentFromV7RowCount: number;
  v81DifferentFromV7RowRate: number | null;
  v81DifferentFromV8RowCount: number;
  v81DifferentFromV8RowRate: number | null;
  v82DifferentFromV7RowCount: number;
  v82DifferentFromV7RowRate: number | null;
  v82DifferentFromV81RowCount: number;
  v82DifferentFromV81RowRate: number | null;
};

export type ProjectionV8CalibrationMover = {
  player: string;
  sleeperId: string | null;
  gsisId: string | null;
  position: string;
  team: string | null;
  priorDataGroup: string;
  evaluationCohorts: ProjectionParityEvaluationCohort[];
  actualGames: number;
  v7ExpectedGames: number | null;
  v8ExpectedGames: number | null;
  v81ExpectedGames: number | null;
  v82ExpectedGames: number | null;
  actualTotalPoints: number;
  v7ProjectedTotal: number | null;
  v8ProjectedTotal: number | null;
  v81ProjectedTotal: number | null;
  v82ProjectedTotal: number | null;
  v7TotalAbsError: number | null;
  v8TotalAbsError: number | null;
  v81TotalAbsError: number | null;
  v82TotalAbsError: number | null;
  totalAbsErrorDelta: number | null;
  v81TotalAbsErrorDeltaVsV7: number | null;
  v81TotalAbsErrorDeltaVsV8: number | null;
  v82TotalAbsErrorDeltaVsV7: number | null;
  v82TotalAbsErrorDeltaVsV81: number | null;
  v8Diagnostics: ProjectionParityAuditRow["snapshotDiagnostics"];
};

export type ProjectionV8AdjustmentBucketRow = ProjectionV8CalibrationMetricRow & {
  topWorseningRows: ProjectionV8CalibrationMover[];
  topImprovingRows: ProjectionV8CalibrationMover[];
};

export type ProjectionV8OverUnderCorrectionSummary = {
  v7UnderprojectionRows: number;
  v8ImprovedUnderprojectionRows: number;
  v8OvercorrectedRows: number;
  v8WorsenedUnderprojectionRows: number;
  v81ImprovedUnderprojectionRows: number;
  v81OvercorrectedRows: number;
  v81WorsenedUnderprojectionRows: number;
  v7OverprojectionRows: number;
  v8ImprovedOverprojectionRows: number;
  v8WorsenedOverprojectionRows: number;
  v8UndercorrectedRows: number;
  v81ImprovedOverprojectionRows: number;
  v81WorsenedOverprojectionRows: number;
  v81UndercorrectedRows: number;
  v82ImprovedUnderprojectionRows: number;
  v82OvercorrectedRows: number;
  v82WorsenedUnderprojectionRows: number;
  v82ImprovedOverprojectionRows: number;
  v82WorsenedOverprojectionRows: number;
  v82UndercorrectedRows: number;
};

export type ProjectionV8CalibrationAuditReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  targetSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    parityAudit: string;
    backtest: string;
    snapshot: string;
  };
  identitySummary: {
    comparedRows: number;
    identicalRows: number;
    differentRows: number;
    differentRate: number | null;
  };
  v81IdentitySummary: {
    v7ComparedRows: number;
    v7IdenticalRows: number;
    v7DifferentRows: number;
    v7DifferentRate: number | null;
    v8ComparedRows: number;
    v8IdenticalRows: number;
    v8DifferentRows: number;
    v8DifferentRate: number | null;
  };
  v82IdentitySummary: {
    v7ComparedRows: number;
    v7DifferentRows: number;
    v7DifferentRate: number | null;
    v81ComparedRows: number;
    v81DifferentRows: number;
    v81DifferentRate: number | null;
  };
  cohortBreakdowns: ProjectionV8CalibrationMetricRow[];
  positionBreakdowns: ProjectionV8CalibrationMetricRow[];
  ppgBuckets: ProjectionV8CalibrationMetricRow[];
  adjustmentBuckets: ProjectionV8AdjustmentBucketRow[];
  overUnderCorrection: ProjectionV8OverUnderCorrectionSummary;
  topImprovements: ProjectionV8CalibrationMover[];
  topRegressions: ProjectionV8CalibrationMover[];
  recommendations: string[];
  verdict: "v8_2_candidate_promising" | "v8_2_neutral" | "v8_2_regressed_needs_rework";
};

export type ProjectionV8CalibrationAuditInput = {
  parityAudit: ProjectionParityAuditReport;
  options: ProjectionV8CalibrationAuditOptions;
  sourceArtifacts?: ProjectionV8CalibrationAuditReport["sourceArtifacts"];
};

export type ProjectionV8CalibrationArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
