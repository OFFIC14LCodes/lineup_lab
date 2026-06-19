import type { ProjectionProductionImpactRow, ProjectionProductionShadowReviewReport } from "./projection-production-shadow-review-types";
import type { ProjectionRecommendationImpactReviewReport, ProjectionRecommendationImpactRow } from "./projection-recommendation-impact-review-types";
import type { ProjectionWarRoomImpactExample, ProjectionWarRoomImpactReviewReport } from "./projection-war-room-impact-review-types";

export type ProjectionV82FeatureFlagReviewPacketRecommendation =
  | "ready_for_controlled_flag_review"
  | "needs_value_reasoning_review"
  | "blocked_for_flag_review";

export type ProjectionV82FeatureFlagReviewPacketOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionV82FeatureFlagReviewPacketChecklistItem = {
  name: string;
  passed: boolean;
  detail: string;
};

export type ProjectionV82FeatureFlagReviewPacketReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  featureFlagName: "BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES";
  recommendation: ProjectionV82FeatureFlagReviewPacketRecommendation;
  sourceArtifacts: {
    productionShadowReview: string;
    recommendationImpactReview: string;
    warRoomImpactReview: string;
    featureFlagReadiness: string;
    featureFlagPreview: string;
    selectorPipelinePreview: string;
    snapshotDiffGuard: string;
    foundationHandoff: string;
    preseasonProjectionSnapshot: string;
  };
  executiveSummary: {
    summary: string;
    allowedNextStep: string;
    notAllowed: string[];
  };
  safetySummary: {
    disabledModeV82Rows: number;
    enabledSafeSubsetV82Rows: number;
    currentPathProtectedRows: number;
    excludedRows: number;
    blockedRows: number;
    kRowsUsingV82: number;
    criticalMoversUsingV82: number;
    meaningfulRankMoversUsingV82: number;
    legacyRowsUsingV82: number;
    missingArtifactFallbackRows: number;
  };
  recommendationImpactSummary: {
    topSuggestionChanged: boolean | null;
    top5Overlap: number | null;
    top10Overlap: number | null;
    top300AffectedRows: number;
    qbSuperflexSensitiveRows: number;
    starterTierMovementRows: number;
    deepTierNoiseRowsShown: number;
  };
  warRoomImpactSummary: {
    valueMovementRows: number;
    reasoningLikelyChangedRows: number;
    gmBriefHeadlineChanged: boolean | "not_estimated";
    gmBriefTopRecommendationSummaryChanged: boolean | "not_estimated";
    planAlignmentChangedRows: number;
    riskConfidenceChangedRows: number;
    notEstimatedAreas: string[];
  };
  topReviewExamples: {
    projectedPointMovers: ProjectionProductionImpactRow[];
    reasoningChangedRows: ProjectionWarRoomImpactExample[];
    top300AffectedRows: ProjectionRecommendationImpactRow[];
    deepTierNoiseRows: ProjectionRecommendationImpactRow[];
  };
  goNoGoChecklist: ProjectionV82FeatureFlagReviewPacketChecklistItem[];
  safetyGates: ProjectionV82FeatureFlagReviewPacketChecklistItem[];
  notes: string[];
};

export type ProjectionV82FeatureFlagReviewPacketInput = {
  options: ProjectionV82FeatureFlagReviewPacketOptions;
  productionShadowReview: ProjectionProductionShadowReviewReport;
  recommendationImpactReview: ProjectionRecommendationImpactReviewReport;
  warRoomImpactReview: ProjectionWarRoomImpactReviewReport;
  sourceArtifacts?: ProjectionV82FeatureFlagReviewPacketReport["sourceArtifacts"];
};

export type ProjectionV82FeatureFlagReviewPacketArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
