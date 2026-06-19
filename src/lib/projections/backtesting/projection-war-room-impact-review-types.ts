import type { ProjectionRecommendationImpactBucket, ProjectionRecommendationImpactRow, ProjectionRecommendationSegmentMovement } from "./projection-recommendation-impact-review-types";

export type ProjectionWarRoomImpactReviewRecommendation =
  | "war_room_impact_clean_for_feature_flag_review"
  | "war_room_impact_needs_helper_extraction"
  | "war_room_impact_needs_review"
  | "war_room_impact_blocked";

export type ProjectionWarRoomImpactReviewOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionWarRoomImpactExample = {
  playerId: string;
  player: string;
  position: string;
  team: string | null;
  projectedPointDelta: number | null;
  currentProjection: number | null;
  v82Projection: number | null;
  changedFields: string[];
  note: string;
};

export type ProjectionWarRoomImpactReviewReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    recommendationImpactReview: string;
    productionShadowReview: string;
    pipelinePreview: string;
    readiness: string;
    shadow: string;
  };
  valueImpact: {
    estimateMethod: "projected_point_delta_proxy";
    limitation: string;
    rowsEvaluated: number;
    rowsWithValueEstimate: number;
    rowsWithValueMovement: number;
    averageProjectedPointDelta: number | null;
    maxProjectedPointDelta: number | null;
    topValueMovers: ProjectionRecommendationImpactRow[];
    movementBuckets: Record<ProjectionRecommendationImpactBucket, number>;
    positionMovement: ProjectionRecommendationSegmentMovement[];
    cohortMovement: ProjectionRecommendationSegmentMovement[];
  };
  playerReasoningImpact: {
    estimateMethod: "representative_reason_stack_projection_delta";
    limitation: string;
    rowsWhereReasoningWouldLikelyChange: number;
    rowsWhereHeadlineChanges: number;
    rowsWhereProjectionReasonsChange: number;
    rowsWhereRiskReasonsChange: number;
    rowsWhereDataGapReasonsChange: number;
    topExamples: ProjectionWarRoomImpactExample[];
    requiredFutureData: string[];
  };
  gmBriefImpact: {
    estimateMethod: "representative_ai_context_projection_delta";
    limitation: string;
    headlineChanged: boolean | "not_estimated";
    topRecommendationSummaryChanged: boolean | "not_estimated";
    rosterNeedSummaryChanged: boolean | "not_estimated";
    scarcityRiskSummaryChanged: boolean | "not_estimated";
    watchListChanged: boolean | "not_estimated";
    dataGapsChanged: boolean | "not_estimated";
    requiredFutureData: string[];
  };
  planAlignmentImpact: {
    estimateMethod: "extracted_helper_exact_available_fields";
    limitation: string;
    rowsWithPlanAlignmentEstimate: number;
    planFitChangedRows: number;
    needFitChangedRows: number;
    valueFitChangedRows: number;
    scarcityFitChangedRows: number;
    formatFitChangedRows: number;
    depthLuxuryRiskCheckChangedRows: number;
    topExamples: ProjectionWarRoomImpactExample[];
    notEstimatedRows: number;
    notEstimatedReason: string | null;
  };
  riskConfidenceImpact: {
    riskConfidenceEstimated: "yes";
    limitation: string;
    riskChipChangedRows: number;
    confidenceChipChangedRows: number;
    riskSummaryChanged: boolean;
    topExamples: ProjectionWarRoomImpactExample[];
  };
  protectedRowChecks: {
    kRowsDoNotUseV82: boolean;
    criticalMovementRowsDoNotUseV82: boolean;
    meaningfulRankMoversDoNotUseV82: boolean;
    legacyStaleRowsDoNotUseV82: boolean;
    missingArtifactsFailClosed: boolean;
  };
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionWarRoomImpactReviewRecommendation;
  notes: string[];
};

export type ProjectionWarRoomImpactReviewInput = {
  options: ProjectionWarRoomImpactReviewOptions;
  recommendationImpact: import("./projection-recommendation-impact-review-types").ProjectionRecommendationImpactReviewReport;
  sourceArtifacts?: ProjectionWarRoomImpactReviewReport["sourceArtifacts"];
};

export type ProjectionWarRoomImpactReviewArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
