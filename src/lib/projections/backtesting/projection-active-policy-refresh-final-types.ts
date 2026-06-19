import type { ProjectionActiveUniversePolicyClassification, ProjectionActiveUniversePolicyPacketReport, ProjectionActiveUniversePolicyPacketRow } from "./projection-active-universe-policy-packet-types";
import type { ProjectionFreeAgentUnknownPolicyClass, ProjectionFreeAgentUnknownPolicyReviewReport, ProjectionFreeAgentUnknownPolicyRow } from "./projection-free-agent-unknown-policy-review-types";
import type { ProjectionRosterRefreshPolicyReviewReport } from "./projection-roster-refresh-policy-review-types";
import type { ProjectionSleeperMetadataResolutionReport } from "./projection-sleeper-metadata-resolution-types";
import type { ProjectionSleeperPolicyRefreshClassification, ProjectionSleeperPolicyRefreshReport, ProjectionSleeperPolicyRefreshRow } from "./projection-sleeper-policy-refresh-types";
import type { ProjectionV82FeatureFlagReviewPacketReport } from "./projection-v8-2-feature-flag-review-packet-types";

export type ProjectionActivePolicyRefreshFinalClass =
  | "final_policy_active_candidate"
  | "final_policy_shadow_only"
  | "final_policy_current_path_only"
  | "final_policy_manual_review"
  | "final_policy_source_expansion_required"
  | "final_policy_kicker_review_required"
  | "final_policy_blocked_archive";

export type ProjectionActivePolicyRefreshFinalLayer =
  | "h21_conservative_policy"
  | "h28_sleeper_metadata_policy_refresh"
  | "h29_free_agent_unknown_policy_review";

export type ProjectionActivePolicyRefreshFinalReasonCode =
  | "h21_confirmed_active_candidate"
  | "h21_shadow_only_preserved"
  | "h21_current_path_preserved"
  | "h21_manual_review_preserved"
  | "h21_source_expansion_preserved"
  | "h21_kicker_review_preserved"
  | "h21_legacy_blocked_preserved"
  | "h28_sleeper_active_plausible_promoted_preview"
  | "h28_inactive_stale_held_shadow"
  | "h28_position_conflict_manual_review"
  | "h28_source_expansion_preserved"
  | "h29_free_agent_shadow_only"
  | "h29_free_agent_current_path_only"
  | "h29_free_agent_manual_review"
  | "h29_free_agent_blocked_archive"
  | "h29_free_agent_source_expansion_required"
  | "v8_2_safe_subset_preserved";

export type ProjectionActivePolicyRefreshFinalRecommendation =
  | "active_policy_final_ready_for_controlled_flag_review"
  | "active_policy_final_needs_manual_review"
  | "active_policy_final_needs_kicker_policy"
  | "active_policy_final_blocked";

export type ProjectionActivePolicyRefreshFinalOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionActivePolicyRefreshFinalRow = {
  playerId: string;
  sleeperId: string | null;
  player: string;
  position: string;
  projectionTeam: string | null;
  basePolicyClassification: ProjectionActiveUniversePolicyClassification | null;
  h28PolicyClassification: ProjectionSleeperPolicyRefreshClassification | null;
  h29PolicyClass: ProjectionFreeAgentUnknownPolicyClass | null;
  finalPolicyClass: ProjectionActivePolicyRefreshFinalClass;
  appliedLayer: ProjectionActivePolicyRefreshFinalLayer;
  reasonCodes: ProjectionActivePolicyRefreshFinalReasonCode[];
  v82SafeSubset: boolean;
  policyGroup: string | null;
  projectedTotalPointDelta: number | null;
  estimatedOverallRankMovement: number | null;
  baseRow: ProjectionActiveUniversePolicyPacketRow | null;
  h28Row: ProjectionSleeperPolicyRefreshRow | null;
  h29Row: ProjectionFreeAgentUnknownPolicyRow | null;
};

export type ProjectionActivePolicyRefreshFinalReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    activeUniversePolicyPacket: string;
    sleeperPolicyRefresh: string;
    freeAgentUnknownPolicyReview: string;
    sleeperMetadataResolution: string;
    rosterRefreshPolicyReview: string;
    featureFlagReviewPacket: string;
    preseasonProjectionSnapshot: string;
  };
  sourceMissing: boolean;
  policyCounts: {
    h21PolicyCounts: Record<ProjectionActiveUniversePolicyClassification, number>;
    h28ScopedPolicyCounts: Record<ProjectionSleeperPolicyRefreshClassification, number>;
    h29ScopedPolicyCounts: Record<ProjectionFreeAgentUnknownPolicyClass, number>;
    h30FinalPolicyCounts: Record<ProjectionActivePolicyRefreshFinalClass, number>;
  };
  remainingBlockers: {
    manualReviewRows: number;
    kickerPolicyRows: number;
    positionConflictRows: number;
    inactiveStaleHeldBack: number;
    remainingSourceExpansionRows: number;
    blockedArchiveRows: number;
    freeAgentUnknownHighImportanceManualReviewRows: number;
    rosterConflictRows: number;
    currentPathManualRows: number;
  };
  v82ControlledFlagImpact: {
    safeV82RowsAllowedByFinalPolicy: number;
    safeV82RowsHeldShadowOnly: number;
    safeV82RowsHeldCurrentPathOnly: number;
    safeV82RowsHeldManualReview: number;
    safeV82RowsStillSourceExpansionRequired: number;
    safeV82RowsBlockedArchive: number;
    safeV82RowsKickerReviewRequired: number;
    controlledFlagReviewRemainsBlocked: boolean;
    protectedZeroChecks: Record<"kRowsUsingV82" | "criticalMoversUsingV82" | "meaningfulRankMoversUsingV82" | "legacyRowsUsingV82", boolean>;
  };
  manualReviewSummary: {
    freeAgentUnknownHighImportanceRows: ProjectionActivePolicyRefreshFinalRow[];
    positionConflictRows: ProjectionActivePolicyRefreshFinalRow[];
    rosterConflictRows: ProjectionActivePolicyRefreshFinalRow[];
    currentPathManualRows: ProjectionActivePolicyRefreshFinalRow[];
    otherManualRows: ProjectionActivePolicyRefreshFinalRow[];
  };
  sourceExpansionRecommendations: Array<{
    sourceNeed: "kicker_policy" | "position_conflict_manual_review" | "transaction_status_source" | "depth_chart_source" | "manual_high_importance_free_agent_review";
    rowsAffected: number;
    rationale: string;
  }>;
  rows: ProjectionActivePolicyRefreshFinalRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionActivePolicyRefreshFinalRecommendation;
  notes: string[];
};

export type ProjectionActivePolicyRefreshFinalInput = {
  options: ProjectionActivePolicyRefreshFinalOptions;
  activeUniversePolicyPacket: ProjectionActiveUniversePolicyPacketReport | null;
  sleeperPolicyRefresh: ProjectionSleeperPolicyRefreshReport | null;
  freeAgentUnknownPolicyReview: ProjectionFreeAgentUnknownPolicyReviewReport | null;
  sleeperMetadataResolution?: ProjectionSleeperMetadataResolutionReport | null;
  rosterRefreshPolicyReview?: ProjectionRosterRefreshPolicyReviewReport | null;
  featureFlagReviewPacket?: ProjectionV82FeatureFlagReviewPacketReport | null;
  preseasonProjectionSnapshot?: unknown;
  sourceArtifacts?: ProjectionActivePolicyRefreshFinalReport["sourceArtifacts"];
};

export type ProjectionActivePolicyRefreshFinalArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
