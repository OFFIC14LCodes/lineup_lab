import type {
  ProjectionRankImpactTierReviewAction,
  ProjectionRankImpactTierReviewRow,
} from "./projection-rank-impact-tier-review-types";

export type ProjectionRankImpactTierDecision =
  | "approve_v8_2_movement"
  | "use_current_path_for_now"
  | "keep_shadow_only"
  | "needs_roster_confirmation"
  | "needs_injury_role_review"
  | "needs_qb_superflex_review"
  | "needs_model_policy_review"
  | "unresolved";

export type ProjectionRankImpactTierStatus =
  | "tier_approved"
  | "tier_current_path"
  | "tier_shadow_only"
  | "tier_unresolved";

export type ProjectionRankImpactTierDecisionVerdict =
  | "tier_decisions_ready"
  | "tier_decisions_unresolved_rows_remaining"
  | "tier_decisions_blocked_by_validation"
  | "tier_decisions_blocked_by_policy";

export type ProjectionRankImpactTierDecisionTemplateRow = {
  playerId: string;
  player: string;
  position: string;
  team: string | null;
  currentExpectedGames: number | null;
  v82ExpectedGames: number | null;
  gamesDelta: number | null;
  currentProjectedTotal: number | null;
  v82ProjectedTotal: number | null;
  projectedPointDelta: number | null;
  currentOverallRank: number | null;
  v82OverallRank: number | null;
  estimatedOverallRankMovement: number | null;
  currentPositionRank: number | null;
  v82PositionRank: number | null;
  estimatedPositionRankMovement: number | null;
  rankImpactFlags: string[];
  riskFlags: string[];
  reasonCodes: string[];
  recommendedTierReviewAction: ProjectionRankImpactTierReviewAction;
  decision: ProjectionRankImpactTierDecision;
  decisionRationale: string;
  reviewer: string;
  reviewedAt: string;
};

export type ProjectionRankImpactTierResolvedDecisionRow = ProjectionRankImpactTierDecisionTemplateRow & {
  resolvedTierStatus: ProjectionRankImpactTierStatus;
  source: "default" | "decision_file";
  validationErrors: string[];
  policyViolations: string[];
  tierReviewRow: ProjectionRankImpactTierReviewRow;
};

export type ProjectionRankImpactTierDecisionReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  decisionsFile: string | null;
  sourceArtifacts: {
    rankImpactTierReview: string;
    rankImpactQualityReview: string;
    limitedPromotionPoolReview: string;
    finalReadiness: string;
    shadow: string;
  };
  templateRows: ProjectionRankImpactTierDecisionTemplateRow[];
  resolvedRows: ProjectionRankImpactTierResolvedDecisionRow[];
  validationErrors: string[];
  policyViolations: string[];
  summary: {
    totalTierReviewRows: number;
    defaultDecisionCounts: Record<ProjectionRankImpactTierDecision, number>;
    resolvedDecisionCounts: Record<ProjectionRankImpactTierDecision, number>;
    resolvedTierStatusCounts: Record<ProjectionRankImpactTierStatus, number>;
    validationErrors: number;
    policyViolations: number;
    qbSuperflexRowsByStatus: Record<ProjectionRankImpactTierStatus, number>;
    injuryRoleRowsByStatus: Record<ProjectionRankImpactTierStatus, number>;
    modelPolicyRowsByStatus: Record<ProjectionRankImpactTierStatus, number>;
  };
  topMovementRowsByFinalStatus: Record<ProjectionRankImpactTierStatus, ProjectionRankImpactTierResolvedDecisionRow[]>;
  unresolvedQbSuperflexRows: ProjectionRankImpactTierResolvedDecisionRow[];
  unresolvedInjuryRoleRows: ProjectionRankImpactTierResolvedDecisionRow[];
  unresolvedModelPolicyRows: ProjectionRankImpactTierResolvedDecisionRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  verdict: ProjectionRankImpactTierDecisionVerdict;
  notes: string[];
};

export type ProjectionRankImpactTierDecisionOptions = {
  projectionSeason: number;
  includeIdp: boolean;
  decisionsFile?: string | null;
};

export type ProjectionRankImpactTierDecisionArtifactPaths = {
  templateCsvPath: string;
  templateJsonPath: string;
  resolvedCsvPath: string;
  resolvedJsonPath: string;
  resolvedMarkdownPath: string;
};
