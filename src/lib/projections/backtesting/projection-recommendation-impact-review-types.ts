export type ProjectionRecommendationImpactReviewRecommendation =
  | "recommendation_impact_clean_for_disabled_flag_review"
  | "recommendation_impact_needs_review"
  | "recommendation_impact_blocked";

export type ProjectionRecommendationImpactReviewOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionRecommendationImpactBucket = "0" | "0-2" | "2-5" | "5-10" | "10-20" | "20+";
export type ProjectionRecommendationRankMovementBucket = "0" | "1-5" | "6-10" | "11-25" | "26-50" | "50+";

export type ProjectionRecommendationImpactRow = {
  playerId: string;
  player: string;
  position: string;
  team: string | null;
  selectorSelection: string;
  selectorReason: string;
  cohorts: string[];
  currentProjectedTotal: number | null;
  v82ProjectedTotal: number | null;
  projectedPointDelta: number | null;
  currentOverallRank: number | null;
  v82OverallRank: number | null;
  estimatedOverallRankMovement: number | null;
  currentPositionRank: number | null;
  v82PositionRank: number | null;
  estimatedPositionRankMovement: number | null;
  protectedByPolicy: boolean;
  protectionReasons: string[];
  criticalMovement: boolean;
  meaningfulRankMover: boolean;
  universeEligibilityStatus: string | null;
};

export type ProjectionRecommendationSegmentMovement = {
  segment: string;
  rows: number;
  averageProjectedPointDelta: number | null;
  medianProjectedPointDelta: number | null;
  maxAbsProjectedPointDelta: number | null;
  rowsMoving5PlusPoints: number;
  rowsMoving10PlusPoints: number;
  rowsMoving20PlusPoints: number;
};

export type ProjectionRecommendationRankBucketSummary = {
  bucket: ProjectionRecommendationRankMovementBucket;
  rows: number;
};

export type ProjectionRecommendationDraftSuggestionRow = {
  playerId: string | null;
  player: string;
  position: string;
  team: string | null;
  baselineRank: number;
  estimatedRank: number;
  baselineScore: number;
  estimatedScore: number;
  projectedPointDelta: number;
};

export type ProjectionRecommendationImpactReviewReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    productionShadowReview: string;
    pipelinePreview: string;
    readiness: string;
    shadow: string;
    draftSuggestionArtifact: string | null;
    blackbirdRankArtifact: string | null;
  };
  summary: {
    totalRowsEvaluated: number;
    v82CandidateRows: number;
    currentPathProtectedRows: number;
    excludedRows: number;
    blockedRows: number;
    averageProjectedPointDelta: number | null;
    medianProjectedPointDelta: number | null;
    maxProjectedPointDelta: number | null;
    movementBuckets: Record<ProjectionRecommendationImpactBucket, number>;
    positionMovement: ProjectionRecommendationSegmentMovement[];
    cohortMovement: ProjectionRecommendationSegmentMovement[];
    topProjectedPointMovers: ProjectionRecommendationImpactRow[];
  };
  blackbirdRankImpact: {
    estimateMethod: "shadow_rank_fields" | "projected_point_delta_proxy";
    limitation: string | null;
    rowsWithRankEstimate: number;
    overallRankMovementBuckets: ProjectionRecommendationRankBucketSummary[];
    positionRankMovementBuckets: ProjectionRecommendationRankBucketSummary[];
    positionRankMovement: ProjectionRecommendationSegmentMovement[];
    topOverallRankRisers: ProjectionRecommendationImpactRow[];
    topOverallRankFallers: ProjectionRecommendationImpactRow[];
    topPositionRankRisers: ProjectionRecommendationImpactRow[];
    topPositionRankFallers: ProjectionRecommendationImpactRow[];
    top300AffectedRows: ProjectionRecommendationImpactRow[];
    qbSuperflexSensitiveMovement: ProjectionRecommendationImpactRow[];
    starterTierMovement: ProjectionRecommendationImpactRow[];
    deepTierNoiseMovement: ProjectionRecommendationImpactRow[];
  };
  draftSuggestionImpact: {
    estimateMethod: "artifact_proxy" | "deterministic_fixture_proxy";
    limitation: string;
    topSuggestionChanged: boolean | null;
    top5SuggestionOverlap: number | null;
    top10SuggestionOverlap: number | null;
    rowsEnteringTop10: ProjectionRecommendationDraftSuggestionRow[];
    rowsLeavingTop10: ProjectionRecommendationDraftSuggestionRow[];
    largestSuggestionRankRisers: ProjectionRecommendationDraftSuggestionRow[];
    largestSuggestionRankFallers: ProjectionRecommendationDraftSuggestionRow[];
    positionDistributionOfChanges: Record<string, number>;
    protectedRowsRemainedCurrentPath: boolean;
  };
  warRoomImpact: {
    projectionValuesChanged: "estimated";
    playerValueChanged: "not_estimated";
    reasoningTextAffected: "not_estimated";
    gmBriefAffected: "not_estimated";
    planAlignmentAffected: "not_estimated";
    riskConfidenceAffected: "not_estimated";
    reasons: Record<string, string>;
  };
  protectedRowChecks: {
    kRowsDoNotUseV82: boolean;
    criticalMovementRowsDoNotUseV82: boolean;
    meaningfulRankMoversDoNotUseV82: boolean;
    legacyStaleRowsDoNotUseV82: boolean;
    missingArtifactsFailClosed: boolean;
  };
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionRecommendationImpactReviewRecommendation;
  notes: string[];
};

export type ProjectionRecommendationImpactReviewInput = {
  options: ProjectionRecommendationImpactReviewOptions;
  productionShadowReview: {
    recommendation: string;
    selectorWiredBeyondDryRun: boolean;
    missingArtifactsMode: { v82Rows: number; currentPathRows: number };
  };
  pipelinePreview: import("./projection-selector-pipeline-preview-types").ProjectionSelectorPipelinePreviewReport;
  readinessRows: import("./projection-v8-2-feature-flag-readiness-types").ProjectionV82FeatureFlagReadinessRow[];
  shadowRows: import("./projection-v8-2-shadow-types").ProjectionV82ShadowRow[];
  draftSuggestionRows?: ProjectionRecommendationDraftSuggestionRow[];
  sourceArtifacts?: ProjectionRecommendationImpactReviewReport["sourceArtifacts"];
};

export type ProjectionRecommendationImpactReviewArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
