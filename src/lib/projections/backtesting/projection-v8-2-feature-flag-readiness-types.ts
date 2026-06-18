import type { ProjectionPromotionEligibilityClassification } from "./projection-promotion-candidate-pool-types";
import type { ProjectionUniverseEligibilityStatus } from "./projection-universe-eligibility-audit-types";
import type { ProjectionV82ShadowMovementBucket } from "./projection-v8-2-shadow-types";

export type ProjectionV82FeatureFlagCandidateStatus =
  | "would_use_v8_2_under_flag"
  | "would_use_current_path_under_flag"
  | "excluded_from_flag_pool"
  | "blocked_from_flag_pool";

export type ProjectionV82FeatureFlagProtectionReason =
  | "eligible_for_flag_candidate"
  | "critical_movement_protected"
  | "kicker_policy_protected"
  | "tier_review_protected"
  | "qb_superflex_protected"
  | "injury_role_protected"
  | "model_policy_protected"
  | "shadow_only"
  | "blocked_legacy"
  | "blocked_other"
  | "manual_review_remaining"
  | "unresolved_tier_decision"
  | "missing_readiness_row";

export type ProjectionV82FeatureFlagReadinessRecommendation =
  | "ready_for_disabled_feature_flag_scaffold"
  | "feature_flag_readiness_needs_review"
  | "feature_flag_readiness_blocked";

export type ProjectionV82FeatureFlagReadinessRow = {
  playerId: string;
  player: string;
  position: string;
  team: string | null;
  status: ProjectionV82FeatureFlagCandidateStatus;
  protectionReasons: ProjectionV82FeatureFlagProtectionReason[];
  universeEligibilityStatus: ProjectionUniverseEligibilityStatus | null;
  finalClassification: ProjectionPromotionEligibilityClassification | null;
  currentExpectedGames: number | null;
  v82ExpectedGames: number | null;
  gamesDelta: number | null;
  currentProjectedTotal: number | null;
  v82ProjectedTotal: number | null;
  projectedPointDelta: number | null;
  movementBucket: ProjectionV82ShadowMovementBucket | string;
  criticalMovement: boolean;
  meaningfulRankMover: boolean;
  riskFlags: string[];
  reasonCodes: string[];
};

export type ProjectionV82FeatureFlagImpactSummary = {
  rows: number;
  averageProjectedPointDelta: number | null;
  medianProjectedPointDelta: number | null;
  maxProjectedPointDelta: number | null;
  movementBuckets: Record<string, number>;
  positionSummary: Array<{
    position: string;
    rows: number;
    averageProjectedPointDelta: number | null;
    maxProjectedPointDelta: number | null;
  }>;
  cohortSummary: Array<{
    cohort: string;
    rows: number;
    averageProjectedPointDelta: number | null;
    maxProjectedPointDelta: number | null;
  }>;
  topMovements: ProjectionV82FeatureFlagReadinessRow[];
};

export type ProjectionV82FeatureFlagProtectionSummary = Record<ProjectionV82FeatureFlagProtectionReason, number>;

export type ProjectionV82FeatureFlagReadinessReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    finalReadiness: string;
    conservativePromotionDecisions: string;
    conservativeTierDecisions: string;
    resolvedTierDecisions: string;
    tierReview: string;
    limitedPromotionPoolReview: string;
    shadow: string;
    universeEligibilityAudit: string;
    snapshot: string;
  };
  rows: ProjectionV82FeatureFlagReadinessRow[];
  summary: {
    totalRows: number;
    wouldUseV82UnderFlag: number;
    wouldUseCurrentPathUnderFlag: number;
    excludedFromFlagPool: number;
    blockedFromFlagPool: number;
    manualReviewRowsRemaining: number;
    unresolvedRowsRemaining: number;
    kRowsUsingV82: number;
    criticalMovementRowsUsingV82: number;
    meaningfulRankMoversUsingV82: number;
    legacyRowsUsingV82: number;
  };
  impactSummary: ProjectionV82FeatureFlagImpactSummary;
  currentPathProtectionSummary: ProjectionV82FeatureFlagProtectionSummary;
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionV82FeatureFlagReadinessRecommendation;
  notes: string[];
};

export type ProjectionV82FeatureFlagReadinessOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionV82FeatureFlagReadinessArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
