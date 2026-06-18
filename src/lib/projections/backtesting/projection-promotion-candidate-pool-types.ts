import type { ProjectionUniverseEligibilityStatus } from "./projection-universe-eligibility-audit-types";

export type ProjectionPromotionEligibilityClassification =
  | "eligible_for_projection_promotion"
  | "manual_review_before_promotion"
  | "shadow_only"
  | "blocked_from_promotion";

export type ProjectionPromotionCandidateReasonCode =
  | "active_plausible_allowed"
  | "rookie_allowed"
  | "low_confidence_allowed"
  | "critical_movement_manual_review"
  | "high_impact_manual_review"
  | "rookie_extreme_movement_review"
  | "active_veteran_large_movement_review"
  | "ambiguous_roster_signal_review"
  | "stale_signal_shadow_only"
  | "low_prior_shadow_only"
  | "kicker_policy_shadow_only"
  | "retired_legacy_blocked"
  | "missing_current_team_blocked"
  | "old_last_seen_blocked"
  | "no_2026_roster_signal_blocked"
  | "manual_name_flag_blocked";

export type ProjectionPromotionRecommendedAction =
  | "ready_for_promotion_review_pool"
  | "manual_review_required_before_promotion"
  | "keep_shadow_only"
  | "exclude_from_promotion_candidate_pool"
  | "review_kicker_policy_before_promotion";

export type ProjectionPromotionPoolVerdict =
  | "promotion_pool_clean_for_review"
  | "promotion_pool_needs_manual_review"
  | "promotion_pool_blocked";

export type ProjectionPromotionMovementBucket = "0" | "0-5" | "5-10" | "10-20" | "20+";

export type ProjectionPromotionCandidateRow = {
  playerId: string;
  sleeperId: string | null;
  gsisId: string | null;
  player: string;
  position: string;
  team: string | null;
  universeEligibilityStatus: ProjectionUniverseEligibilityStatus;
  promotionEligibilityClassification: ProjectionPromotionEligibilityClassification;
  reasonCodes: ProjectionPromotionCandidateReasonCode[];
  universeReasonCodes: string[];
  currentExpectedGames: number | null;
  v82ExpectedGames: number | null;
  gamesDelta: number | null;
  projectedTotalPointDelta: number | null;
  movementBucket: ProjectionPromotionMovementBucket;
  criticalMovement: boolean;
  rankingMovementEstimated: boolean;
  estimatedOverallRankMovement: number | null;
  recommendedAction: ProjectionPromotionRecommendedAction;
  riskFlags: string[];
  cohortTags: string[];
  lastActiveSeason: number | null;
  priorGames: number;
  noPriorNflData: boolean;
  matchConfidence: string;
};

export type ProjectionPromotionPoolMetric = {
  segment: string;
  rows: number;
  movementBucketCounts: Record<ProjectionPromotionMovementBucket, number>;
  criticalMovementRows: number;
  averageProjectedPointDelta: number | null;
  averageAbsProjectedPointDelta: number | null;
  topMovements: ProjectionPromotionCandidateRow[];
  positionMovementCounts: Record<string, number>;
  cohortMovementCounts: Record<string, number>;
};

export type ProjectionPromotionCandidatePoolReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    snapshot: string;
    shadow: string;
    universeEligibilityAudit: string;
  };
  summary: {
    totalRows: number;
    classificationCounts: Record<ProjectionPromotionEligibilityClassification, number>;
    byUniverseStatus: Record<string, number>;
    byPosition: Record<string, Record<ProjectionPromotionEligibilityClassification, number>>;
    byCohort: Record<string, Record<ProjectionPromotionEligibilityClassification, number>>;
    byTeamSignal: Record<string, number>;
    byMovementBucket: Record<ProjectionPromotionMovementBucket, number>;
    byRiskFlag: Record<string, number>;
    byRecommendedAction: Record<ProjectionPromotionRecommendedAction, number>;
  };
  poolMetrics: ProjectionPromotionPoolMetric[];
  rows: ProjectionPromotionCandidateRow[];
  topEligibleMovements: ProjectionPromotionCandidateRow[];
  topManualReviewMovements: ProjectionPromotionCandidateRow[];
  topBlockedMovements: ProjectionPromotionCandidateRow[];
  topShadowOnlyMovements: ProjectionPromotionCandidateRow[];
  criticalMovementRows: ProjectionPromotionCandidateRow[];
  kickerPolicy: {
    totalKRows: number;
    eligibleKRows: number;
    manualReviewKRows: number;
    shadowOnlyKRows: number;
    blockedKRows: number;
    criticalMovementKRows: number;
    excludedFromEligiblePoolRows: number;
    recommendation: string;
  };
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  verdict: ProjectionPromotionPoolVerdict;
  notes: string[];
};

export type ProjectionPromotionCandidatePoolOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionPromotionCandidatePoolArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
