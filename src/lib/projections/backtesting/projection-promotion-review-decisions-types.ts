import type { ProjectionPromotionEligibilityClassification } from "./projection-promotion-candidate-pool-types";
import type { ProjectionPromotionManualReviewAction } from "./projection-promotion-manual-review-types";
import type { ProjectionUniverseEligibilityStatus } from "./projection-universe-eligibility-audit-types";

export type ProjectionPromotionReviewDecision =
  | "approve_for_candidate_pool"
  | "keep_shadow_only"
  | "block_from_promotion"
  | "cap_v8_2_movement"
  | "use_current_path_for_now"
  | "needs_external_roster_confirmation"
  | "needs_kicker_policy_review"
  | "unresolved";

export type ProjectionPromotionReviewDecisionVerdict =
  | "review_decisions_ready"
  | "review_decisions_unresolved_rows_remaining"
  | "review_decisions_blocked";

export type ProjectionPromotionReviewDecisionTemplateRow = {
  playerId: string;
  player: string;
  position: string;
  team: string | null;
  currentProposedAction: ProjectionPromotionManualReviewAction;
  movementAmount: number | null;
  currentExpectedGames: number | null;
  v82ExpectedGames: number | null;
  gamesDelta: number | null;
  ppgAnchor: number | null;
  riskFlags: string[];
  reasonCodes: string[];
  recommendedDefaultDecision: ProjectionPromotionReviewDecision;
  decision: ProjectionPromotionReviewDecision;
  decisionRationale: string;
  reviewer: string;
  reviewedAt: string;
};

export type ProjectionPromotionResolvedDecisionRow = ProjectionPromotionReviewDecisionTemplateRow & {
  originalPromotionClassification: ProjectionPromotionEligibilityClassification;
  manualReviewProposedAction: ProjectionPromotionManualReviewAction;
  humanOrDefaultDecision: ProjectionPromotionReviewDecision;
  resolvedClassification: ProjectionPromotionEligibilityClassification;
  resolvedAction: string;
  universeEligibilityStatus: ProjectionUniverseEligibilityStatus;
  criticalMovement: boolean;
  source: "default" | "decision_file";
};

export type ProjectionPromotionReviewDecisionReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  decisionsFile: string | null;
  sourceArtifacts: {
    shadow: string;
    universeEligibilityAudit: string;
    promotionCandidatePool: string;
    promotionManualReview: string;
  };
  templateRows: ProjectionPromotionReviewDecisionTemplateRow[];
  resolvedRows: ProjectionPromotionResolvedDecisionRow[];
  summary: {
    defaultDecisionCounts: Record<ProjectionPromotionReviewDecision, number>;
    resolvedDecisionCounts: Record<ProjectionPromotionReviewDecision, number>;
    originalCandidatePool: Record<ProjectionPromotionEligibilityClassification, number>;
    resolvedCandidatePool: Record<ProjectionPromotionEligibilityClassification, number>;
    eligibleRows: number;
    manualReviewRowsRemaining: number;
    shadowOnlyRows: number;
    blockedRows: number;
    kRows: number;
    criticalMovementRows: number;
    nonKCriticalMovementRows: number;
    unresolvedRows: number;
  };
  unresolvedNonKRows: ProjectionPromotionResolvedDecisionRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  verdict: ProjectionPromotionReviewDecisionVerdict;
  notes: string[];
};

export type ProjectionPromotionReviewDecisionOptions = {
  projectionSeason: number;
  includeIdp: boolean;
  decisionsFile?: string | null;
};

export type ProjectionPromotionReviewDecisionArtifactPaths = {
  templateCsvPath: string;
  templateJsonPath: string;
  resolvedJsonPath: string;
  resolvedMarkdownPath: string;
  resolvedCsvPath: string;
};
