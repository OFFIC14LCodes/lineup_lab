import type { ProjectionPromotionCandidateReasonCode, ProjectionPromotionEligibilityClassification } from "./projection-promotion-candidate-pool-types";
import type { ProjectionUniverseEligibilityStatus } from "./projection-universe-eligibility-audit-types";

export type ProjectionPromotionManualReviewAction =
  | "approve_for_candidate_pool"
  | "keep_shadow_only"
  | "block_from_promotion"
  | "needs_roster_confirmation"
  | "needs_model_policy_review"
  | "needs_kicker_policy_review";

export type ProjectionPromotionManualReviewVerdict =
  | "manual_review_packet_ready"
  | "manual_review_packet_blocked"
  | "manual_review_no_rows";

export type ProjectionPromotionManualReviewRow = {
  playerId: string;
  sleeperId: string | null;
  gsisId: string | null;
  player: string;
  position: string;
  team: string | null;
  universeEligibilityStatus: ProjectionUniverseEligibilityStatus;
  promotionClassification: ProjectionPromotionEligibilityClassification;
  promotionReasonCodes: ProjectionPromotionCandidateReasonCode[];
  currentExpectedGames: number | null;
  v82ExpectedGames: number | null;
  gamesDelta: number | null;
  scoringAnchorPpg: number | null;
  projectedTotalPointDelta: number | null;
  movementBucket: string;
  criticalMovement: boolean;
  estimatedPositionRankMovement: number | null;
  estimatedOverallRankMovement: number | null;
  v82GuardrailReasonCodes: string[];
  riskFlags: string[];
  proposedReviewAction: ProjectionPromotionManualReviewAction;
  reviewRationale: string[];
};

export type ProjectionPromotionManualReviewSummary = {
  totalManualReviewRows: number;
  proposedActionCounts: Record<ProjectionPromotionManualReviewAction, number>;
  byPosition: Record<string, number>;
  byUniverseEligibilityStatus: Record<string, number>;
  byPromotionReasonCode: Record<string, number>;
  criticalMovementRows: number;
  kickerManualReviewRows: number;
  rookieNewPlayerRows: number;
  veteranManualReviewRows: number;
  canProceedAfterHumanDecisions: boolean;
};

export type ProjectionPromotionManualReviewReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    snapshot: string;
    shadow: string;
    universeEligibilityAudit: string;
    promotionCandidatePool: string;
  };
  summary: ProjectionPromotionManualReviewSummary;
  rows: ProjectionPromotionManualReviewRow[];
  topManualReviewRows: ProjectionPromotionManualReviewRow[];
  kickerManualReviewRows: ProjectionPromotionManualReviewRow[];
  rookieNewPlayerManualReviewRows: ProjectionPromotionManualReviewRow[];
  veteranManualReviewRows: ProjectionPromotionManualReviewRow[];
  highImpactManualReviewRows: ProjectionPromotionManualReviewRow[];
  rowsByProposedAction: Record<ProjectionPromotionManualReviewAction, ProjectionPromotionManualReviewRow[]>;
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  verdict: ProjectionPromotionManualReviewVerdict;
  notes: string[];
};

export type ProjectionPromotionManualReviewOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionPromotionManualReviewArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
