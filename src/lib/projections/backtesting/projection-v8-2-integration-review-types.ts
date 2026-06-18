import type {
  ProjectionParityAuditReport,
  ProjectionParityAuditRow,
  ProjectionParityEvaluationCohort,
} from "./projection-parity-audit-types";

export type ProjectionV82IntegrationReviewOptions = {
  targetSeason: number;
  includeIdp: boolean;
};

export type ProjectionV82IntegrationReviewMetricRow = {
  segment: string;
  rows: number;
  v7GamesMae: number | null;
  v81GamesMae: number | null;
  v82GamesMae: number | null;
  v82GamesMaeDeltaVsV7: number | null;
  v82GamesMaeDeltaVsV81: number | null;
  v7TotalMae: number | null;
  v81TotalMae: number | null;
  v82TotalMae: number | null;
  v82TotalMaeDeltaVsV7: number | null;
  v82TotalMaeDeltaVsV81: number | null;
  v7TotalRmse: number | null;
  v81TotalRmse: number | null;
  v82TotalRmse: number | null;
  v82TotalRmseDeltaVsV7: number | null;
  v82TotalRmseDeltaVsV81: number | null;
  v7TotalBias: number | null;
  v81TotalBias: number | null;
  v82TotalBias: number | null;
  v82TotalBiasDeltaVsV7: number | null;
  v82TotalBiasDeltaVsV81: number | null;
  v82DifferentFromV7Rows: number;
  v82DifferentFromV7Rate: number | null;
  v82DifferentFromV81Rows: number;
  v82DifferentFromV81Rate: number | null;
};

export type ProjectionV82SafetyGateName =
  | "overall_total_mae_better_than_v7"
  | "overall_games_mae_better_than_v7"
  | "overall_rmse_better_than_v7"
  | "20_plus_ppg_not_worse_than_v7"
  | "15_20_ppg_not_worse_than_v7"
  | "rookie_low_prior_not_worse_than_v7"
  | "te_fallback_parity_clean"
  | "k_fallback_parity_clean"
  | "v8_2_distinct_from_v7"
  | "large_adjustment_bucket_controlled"
  | "no_live_outputs_changed";

export type ProjectionV82SafetyGate = {
  name: ProjectionV82SafetyGateName;
  passed: boolean;
  detail: string;
};

export type ProjectionV82MovementBucket = "0" | "0-5" | "5-10" | "10-20" | "20+";
export type ProjectionV82MovementRisk = "low" | "moderate" | "high" | "critical";
export type ProjectionV82Recommendation =
  | "remain_experimental"
  | "integration_review_candidate"
  | "ready_for_shadow_projection"
  | "ready_for_live_promotion";

export type ProjectionV82ImpactPreviewRow = {
  player: string;
  sleeperId: string | null;
  gsisId: string | null;
  position: string;
  team: string | null;
  cohorts: ProjectionParityEvaluationCohort[];
  ppgBucket: string;
  movementBucket: ProjectionV82MovementBucket;
  risk: ProjectionV82MovementRisk;
  riskFlags: string[];
  v7ExpectedGames: number | null;
  v82ExpectedGames: number | null;
  expectedGamesDelta: number | null;
  ppgAnchor: number | null;
  projectedTotalPointDelta: number | null;
  actualGames: number;
  actualPoints: number;
  v82AbsErrorDeltaVsV7: number | null;
  guardrailReasonCodes: string[];
};

export type ProjectionV82MovementSummaryRow = {
  segment: string;
  rows: number;
  move5Plus: number;
  move10Plus: number;
  move20Plus: number;
};

export type ProjectionV82IntegrationReviewReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  targetSeason: number;
  includeIdp: boolean;
  model: "blackbird_expected_games_v8_2_high_impact_guardrail";
  sourceArtifacts: {
    parityAudit: string;
    backtest: string;
    snapshot: string;
  };
  modelQualitySummary: {
    allRows: ProjectionV82IntegrationReviewMetricRow;
    cohorts: ProjectionV82IntegrationReviewMetricRow[];
    positions: ProjectionV82IntegrationReviewMetricRow[];
    ppgBuckets: ProjectionV82IntegrationReviewMetricRow[];
    adjustmentBuckets: ProjectionV82IntegrationReviewMetricRow[];
  };
  safetyGates: ProjectionV82SafetyGate[];
  impactPreview: {
    totalRows: number;
    movementBuckets: Record<ProjectionV82MovementBucket, number>;
    riskCounts: Record<ProjectionV82MovementRisk, number>;
    rows: ProjectionV82ImpactPreviewRow[];
    topMovements: ProjectionV82ImpactPreviewRow[];
  };
  positionImpactSummary: ProjectionV82MovementSummaryRow[];
  cohortImpactSummary: ProjectionV82MovementSummaryRow[];
  recommendation: ProjectionV82Recommendation;
  notes: string[];
};

export type ProjectionV82IntegrationReviewInput = {
  parityAudit: ProjectionParityAuditReport;
  options: ProjectionV82IntegrationReviewOptions;
  sourceArtifacts?: ProjectionV82IntegrationReviewReport["sourceArtifacts"];
};

export type ProjectionV82IntegrationReviewArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};

export type ProjectionV82ReviewSourceRow = ProjectionParityAuditRow;
