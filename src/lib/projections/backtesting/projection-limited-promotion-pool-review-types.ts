import type { ProjectionPromotionEligibilityClassification } from "./projection-promotion-candidate-pool-types";
import type { ProjectionUniverseEligibilityStatus } from "./projection-universe-eligibility-audit-types";
import type { ProjectionV82ShadowGamesBucket, ProjectionV82ShadowMovementBucket } from "./projection-v8-2-shadow-types";

export type ProjectionLimitedPromotionPoolRecommendation =
  | "limited_pool_clean_for_feature_flag_review"
  | "limited_pool_needs_rank_impact_review"
  | "limited_pool_blocked";

export type ProjectionLimitedPromotionPoolReviewRow = {
  playerId: string;
  player: string;
  position: string;
  team: string | null;
  universeEligibilityStatus: ProjectionUniverseEligibilityStatus;
  finalClassification: ProjectionPromotionEligibilityClassification;
  currentExpectedGames: number | null;
  v82ExpectedGames: number | null;
  gamesDelta: number | null;
  scoringAnchorPpg: number | null;
  projectedPointDelta: number | null;
  currentProjectedTotal: number | null;
  v82ProjectedTotal: number | null;
  movementBucket: ProjectionV82ShadowMovementBucket | string;
  expectedGamesMovementBucket: ProjectionV82ShadowGamesBucket | string;
  estimatedPositionRankMovement: number | null;
  estimatedOverallRankMovement: number | null;
  currentPositionRank: number | null;
  v82PositionRank: number | null;
  currentOverallRank: number | null;
  v82OverallRank: number | null;
  riskFlags: string[];
  reasonCodes: string[];
  cohortTags: string[];
  criticalMovement: boolean;
};

export type ProjectionLimitedPromotionPoolMovementSummary = {
  rows: number;
  averageExpectedGamesDelta: number | null;
  averageProjectedPointDelta: number | null;
  medianProjectedPointDelta: number | null;
  maxProjectedPointDelta: number | null;
  movementBuckets: Record<ProjectionV82ShadowMovementBucket, number>;
  expectedGamesMovementBuckets: Record<ProjectionV82ShadowGamesBucket, number>;
};

export type ProjectionLimitedPromotionPoolSegmentSummary = {
  segment: string;
  rows: number;
  averageProjectedPointMovement: number | null;
  rowsMoving5Plus: number;
  rowsMoving10Plus: number;
  rowsMoving20Plus: number;
  topMovements: ProjectionLimitedPromotionPoolReviewRow[];
};

export type ProjectionLimitedPromotionPoolRankImpact = {
  estimated: boolean;
  reason: string;
  rowsWithRankMovementEstimate: number;
  rowsWithPositionRankMovementEstimate: number;
  rowsWithOverallRankMovementEstimate: number;
  topPositionRankRisers: ProjectionLimitedPromotionPoolReviewRow[];
  topPositionRankFallers: ProjectionLimitedPromotionPoolReviewRow[];
  topOverallRankRisers: ProjectionLimitedPromotionPoolReviewRow[];
  topOverallRankFallers: ProjectionLimitedPromotionPoolReviewRow[];
  rowsMoving5PlusPositionRanks: number;
  rowsMoving10PlusPositionRanks: number;
  rowsMoving25PlusOverallRanks: number;
  rowsMoving50PlusOverallRanks: number;
};

export type ProjectionLimitedPromotionPoolReviewReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    finalReadiness: string;
    conservativeDecisions: string;
    candidatePool: string;
    shadow: string;
    universeEligibilityAudit: string;
    snapshot: string;
  };
  eligibleRows: ProjectionLimitedPromotionPoolReviewRow[];
  excludedCounts: {
    criticalMovementRowsExcluded: number;
    kRowsExcluded: number;
    legacyRetiredRowsExcluded: number;
    shadowOnlyRowsExcluded: number;
    blockedRowsExcluded: number;
    manualReviewRowsRemaining: number;
  };
  movementSummary: ProjectionLimitedPromotionPoolMovementSummary;
  positionSummary: ProjectionLimitedPromotionPoolSegmentSummary[];
  cohortSummary: ProjectionLimitedPromotionPoolSegmentSummary[];
  rankImpactPreview: ProjectionLimitedPromotionPoolRankImpact;
  topEligibleMovements: ProjectionLimitedPromotionPoolReviewRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionLimitedPromotionPoolRecommendation;
  notes: string[];
};

export type ProjectionLimitedPromotionPoolReviewOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionLimitedPromotionPoolReviewArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
