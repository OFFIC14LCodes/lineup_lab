import type { ProjectionPromotionEligibilityClassification } from "./projection-promotion-candidate-pool-types";
import type { ProjectionPromotionReviewDecision } from "./projection-promotion-review-decisions-types";
import type { ProjectionUniverseEligibilityStatus } from "./projection-universe-eligibility-audit-types";

export type ProjectionPromotionReadinessFinalVerdict =
  | "ready_for_shadow_promotion_review"
  | "ready_for_limited_feature_flag_review"
  | "manual_decisions_required"
  | "blocked_by_invalid_decisions"
  | "blocked_by_policy_violation";

export type ProjectionPromotionReadinessValidationCode =
  | "invalid_decision"
  | "missing_rationale"
  | "unknown_player_id"
  | "duplicate_decision_row"
  | "manual_review_row_missing_from_decision_file";

export type ProjectionPromotionReadinessPolicyViolationCode =
  | "k_row_approved_without_explicit_override_reason"
  | "critical_movement_row_approved_without_rationale"
  | "retired_legacy_row_approved";

export type ProjectionPromotionReadinessValidationIssue = {
  code: ProjectionPromotionReadinessValidationCode;
  playerId: string | null;
  player: string | null;
  detail: string;
};

export type ProjectionPromotionReadinessPolicyViolation = {
  code: ProjectionPromotionReadinessPolicyViolationCode;
  playerId: string;
  player: string;
  position: string;
  decision: ProjectionPromotionReviewDecision;
  detail: string;
};

export type ProjectionPromotionReadinessFinalRow = {
  playerId: string;
  player: string;
  position: string;
  team: string | null;
  universeEligibilityStatus: ProjectionUniverseEligibilityStatus;
  originalClassification: ProjectionPromotionEligibilityClassification;
  finalClassification: ProjectionPromotionEligibilityClassification;
  decision: ProjectionPromotionReviewDecision | null;
  decisionRationale: string | null;
  reviewer: string | null;
  reviewedAt: string | null;
  projectedTotalPointDelta: number | null;
  currentExpectedGames: number | null;
  v82ExpectedGames: number | null;
  gamesDelta: number | null;
  criticalMovement: boolean;
  movementBucket: string;
  riskFlags: string[];
  reasonCodes: string[];
  source: "candidate_pool" | "review_decision";
};

export type ProjectionPromotionReadinessFinalReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  decisionsFile: string | null;
  sourceArtifacts: {
    reviewDecisions: string;
    promotionCandidatePool: string;
    promotionManualReview: string;
    shadow: string;
    universeEligibilityAudit: string;
  };
  validationIssues: ProjectionPromotionReadinessValidationIssue[];
  policyViolations: ProjectionPromotionReadinessPolicyViolation[];
  finalRows: ProjectionPromotionReadinessFinalRow[];
  summary: {
    eligibleRows: number;
    manualReviewRowsRemaining: number;
    shadowOnlyRows: number;
    blockedRows: number;
    kRows: Record<ProjectionPromotionEligibilityClassification, number>;
    criticalMovementRows: Record<ProjectionPromotionEligibilityClassification, number>;
    unresolvedRows: number;
    validationErrors: number;
    policyViolations: number;
  };
  topEligibleMovements: ProjectionPromotionReadinessFinalRow[];
  topManualReviewMovements: ProjectionPromotionReadinessFinalRow[];
  topShadowOnlyMovements: ProjectionPromotionReadinessFinalRow[];
  topBlockedMovements: ProjectionPromotionReadinessFinalRow[];
  criticalMovementRows: ProjectionPromotionReadinessFinalRow[];
  unresolvedRows: ProjectionPromotionReadinessFinalRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  verdict: ProjectionPromotionReadinessFinalVerdict;
  notes: string[];
};

export type ProjectionPromotionReadinessFinalOptions = {
  projectionSeason: number;
  includeIdp: boolean;
  decisionsFile?: string | null;
};

export type ProjectionPromotionReadinessFinalArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
