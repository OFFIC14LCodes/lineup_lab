import type { ProjectionActiveUniverseGateV82Path } from "./projection-active-universe-gate-types";
import type { ProjectionRosterRefreshPolicyGroup, ProjectionRosterRefreshPolicyReviewRow } from "./projection-roster-refresh-policy-review-types";

export type ProjectionActiveUniversePolicyClassification =
  | "policy_active_candidate"
  | "policy_shadow_only"
  | "policy_blocked_archive"
  | "policy_manual_review"
  | "policy_source_expansion_required"
  | "policy_kicker_review_required"
  | "policy_current_path_only";

export type ProjectionActiveUniversePolicyReasonCode =
  | "roster_confirmed_active_allowed"
  | "ir_pup_nfi_requires_status_review"
  | "non_active_current_path_only"
  | "legacy_blocked"
  | "kicker_policy_missing"
  | "team_conflict_manual_review"
  | "manual_mover_current_path_only"
  | "unmatched_needs_depth_chart_source"
  | "unmatched_rookie_needs_team_confirmation"
  | "stale_needs_transaction_status_source"
  | "low_confidence_needs_depth_chart_source"
  | "v8_2_safe_subset_preserved";

export type ProjectionActiveUniversePolicyRecommendation =
  | "active_policy_ready_for_source_expansion"
  | "active_policy_needs_manual_decisions"
  | "active_policy_blocked";

export type ProjectionActiveUniversePolicySourceNeed =
  | "depth_chart_source"
  | "transaction_free_agent_source"
  | "rookie_team_confirmation_source"
  | "injury_pup_nfi_source"
  | "kicker_specific_depth_chart_source"
  | "manual_conflict_review";

export type ProjectionActiveUniversePolicyPacketOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionActiveUniversePolicyPacketRow = ProjectionRosterRefreshPolicyReviewRow & {
  policyClassification: ProjectionActiveUniversePolicyClassification;
  policyReasonCodes: ProjectionActiveUniversePolicyReasonCode[];
};

export type ProjectionActiveUniversePolicySourceNeedSummary = {
  sourceNeed: ProjectionActiveUniversePolicySourceNeed;
  rowsAffected: number;
  positionsAffected: Record<string, number>;
  v82SafeSubsetRowsAffected: number;
  topExamples: ProjectionActiveUniversePolicyPacketRow[];
  recommendedNextMilestone: string;
};

export type ProjectionActiveUniversePolicyPacketReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    rosterPolicyReview: string;
    rosterRefresh: string;
    currentRosterConfirmation: string;
    universeHygieneSummary: string;
    featureFlagReviewPacket: string;
    promotionCandidatePool: string;
  };
  policyCounts: {
    totalRows: number;
    byClassification: Record<ProjectionActiveUniversePolicyClassification, number>;
    byPosition: Record<string, Record<ProjectionActiveUniversePolicyClassification, number>>;
    byTeam: Record<string, Record<ProjectionActiveUniversePolicyClassification, number>>;
    byH20PolicyGroup: Record<ProjectionRosterRefreshPolicyGroup, Record<ProjectionActiveUniversePolicyClassification, number>>;
    byV82SelectionBucket: Record<ProjectionActiveUniverseGateV82Path, Record<ProjectionActiveUniversePolicyClassification, number>>;
  };
  sourceExpansionPriorities: ProjectionActiveUniversePolicySourceNeedSummary[];
  v82ConservativePolicyImpact: {
    safeV82RowsAllowedByConservativePolicy: number;
    safeV82RowsHeldBackBySourceExpansion: number;
    safeV82RowsHeldBackByKickerManualCurrentPathPolicy: number;
    protectedZeroChecks: Record<"kRowsUsingV82" | "criticalMoversUsingV82" | "meaningfulRankMoversUsingV82" | "legacyRowsUsingV82", boolean>;
    v82RemainsSafe: boolean;
  };
  manualReview: {
    conflicts: ProjectionActiveUniversePolicyPacketRow[];
    remainingManualRows: ProjectionActiveUniversePolicyPacketRow[];
    confirmedNonActiveRows: ProjectionActiveUniversePolicyPacketRow[];
    irPupNfiSummary: {
      totalRows: number;
      byPosition: Record<string, number>;
      topExamples: ProjectionActiveUniversePolicyPacketRow[];
    };
  };
  rows: ProjectionActiveUniversePolicyPacketRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionActiveUniversePolicyRecommendation;
  notes: string[];
};

export type ProjectionActiveUniversePolicyPacketInput = {
  options: ProjectionActiveUniversePolicyPacketOptions;
  rosterPolicyReview: import("./projection-roster-refresh-policy-review-types").ProjectionRosterRefreshPolicyReviewReport;
  rosterRefresh: import("./projection-active-universe-gate-roster-refresh-types").ProjectionActiveUniverseGateRosterRefreshReport;
  currentRosterConfirmation: import("./projection-current-roster-confirmation-types").ProjectionCurrentRosterConfirmationReport;
  featureFlagReviewPacket: import("./projection-v8-2-feature-flag-review-packet-types").ProjectionV82FeatureFlagReviewPacketReport;
  promotionCandidatePool: import("./projection-promotion-candidate-pool-types").ProjectionPromotionCandidatePoolReport;
  sourceArtifacts?: ProjectionActiveUniversePolicyPacketReport["sourceArtifacts"];
};

export type ProjectionActiveUniversePolicyPacketArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
