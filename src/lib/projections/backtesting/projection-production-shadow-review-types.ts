import type { ProjectionSelectorPipelinePreviewReport, ProjectionSelectorPipelinePreviewRow, ProjectionSelectorPipelinePreviewSummary } from "./projection-selector-pipeline-preview-types";
import type { ProjectionV82FeatureFlagReadinessRow } from "./projection-v8-2-feature-flag-readiness-types";
import type { ProjectionV82ShadowRow } from "./projection-v8-2-shadow-types";

export type ProjectionProductionShadowReviewRecommendation =
  | "production_shadow_clean"
  | "production_shadow_needs_review"
  | "production_shadow_blocked";

export type ProjectionProductionShadowReviewOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionProductionPathAuditRow = {
  pathName: string;
  file: string;
  currentModelSource: string;
  writesToSupabase: boolean;
  affectsRankings: boolean;
  affectsDraftSuggestions: boolean;
  affectsWarRoom: boolean;
  v82SelectorCurrentlyWired: boolean;
  safeToShadow: boolean;
  note: string;
};

export type ProjectionProductionImpactRow = {
  playerId: string;
  player: string;
  position: string;
  team: string | null;
  currentProjectedTotal: number | null;
  selectedProjectedTotal: number | null;
  v82ProjectedTotal: number | null;
  projectedTotalDeltaVsCurrent: number | null;
  currentOverallRank: number | null;
  shadowOverallRank: number | null;
  estimatedOverallRankMovement: number | null;
  currentPositionRank: number | null;
  shadowPositionRank: number | null;
  estimatedPositionRankMovement: number | null;
  selectorReason: string;
  preservedByPolicy: boolean;
  protectionReasons: string[];
};

export type ProjectionProductionSegmentImpact = {
  segment: string;
  rows: number;
  averageProjectedTotalDeltaVsCurrent: number | null;
  maxAbsProjectedTotalDeltaVsCurrent: number | null;
};

export type ProjectionProductionImpactPreview = {
  topProjectedPointDeltas: ProjectionProductionImpactRow[];
  topEstimatedBlackbirdRankMovementRows: ProjectionProductionImpactRow[];
  topEstimatedDraftSuggestionMovementRows: ProjectionProductionImpactRow[];
  positionsMostAffected: ProjectionProductionSegmentImpact[];
  cohortsMostAffected: ProjectionProductionSegmentImpact[];
  rowsWhereCurrentPathPreservedDueToProtectionPolicy: ProjectionProductionImpactRow[];
  blackbirdRankImpactEstimate: "estimated_from_shadow_rank_fields" | "unavailable";
  draftSuggestionImpactEstimate: "estimated_from_projection_delta_proxy" | "unavailable";
  warRoomImpactEstimate: "estimated_from_projection_delta_proxy" | "unavailable";
  missingDataNotes: string[];
};

export type ProjectionProductionShadowReviewSummary = {
  totalProjectionRows: number;
  currentPathRows: number;
  v82ShadowRows: number;
  excludedRows: number;
  blockedRows: number;
  kRowsUsingV82: number;
  criticalMoversUsingV82: number;
  meaningfulRankMoversUsingV82: number;
  legacyRowsUsingV82: number;
  missingArtifactFallbackRows: number;
  projectionPointDeltas: {
    rowsWithDelta: number;
    maxAbsDelta: number | null;
    averageAbsDelta: number | null;
  };
  rankImpactDeltas: {
    rowsWithEstimatedOverallRankMovement: number;
    rowsWithEstimatedPositionRankMovement: number;
    maxAbsOverallRankMovement: number | null;
    maxAbsPositionRankMovement: number | null;
  };
  draftSuggestionImpactEstimate: {
    estimatedRowsWithPointDelta: number;
    limitation: string;
  };
  warRoomImpactEstimate: {
    estimatedRowsWithPointDelta: number;
    limitation: string;
  };
};

export type ProjectionProductionShadowReviewReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  featureFlagName: "BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES";
  selectorWiredBeyondDryRun: false;
  sourceArtifacts: {
    pipelinePreview: string;
    readiness: string;
    shadow: string;
    snapshotDiffGuard: string;
    foundationHandoff: string;
  };
  productionPathAudit: ProjectionProductionPathAuditRow[];
  disabledModeEquivalence: ProjectionSelectorPipelinePreviewSummary;
  enabledModeShadow: ProjectionSelectorPipelinePreviewSummary;
  missingArtifactsMode: ProjectionSelectorPipelinePreviewSummary;
  summary: ProjectionProductionShadowReviewSummary;
  impactPreview: ProjectionProductionImpactPreview;
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionProductionShadowReviewRecommendation;
  notes: string[];
};

export type ProjectionProductionShadowReviewInput = {
  options: ProjectionProductionShadowReviewOptions;
  pipelinePreview: ProjectionSelectorPipelinePreviewReport;
  readinessRows: ProjectionV82FeatureFlagReadinessRow[];
  shadowRows: ProjectionV82ShadowRow[];
  snapshotDiffGuardRecommendation: string;
  foundationHandoffRecommendation: string;
  sourceArtifacts?: ProjectionProductionShadowReviewReport["sourceArtifacts"];
};

export type ProjectionProductionShadowReviewArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};

export type ProjectionProductionShadowReviewEnabledRow = ProjectionSelectorPipelinePreviewRow;
