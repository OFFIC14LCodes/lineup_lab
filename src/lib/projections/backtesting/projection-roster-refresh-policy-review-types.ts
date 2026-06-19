import type { ProjectionActiveUniverseGateStatus, ProjectionActiveUniverseGateV82Path } from "./projection-active-universe-gate-types";
import type { ProjectionActiveUniverseGateRosterRefreshStatus } from "./projection-active-universe-gate-roster-refresh-types";
import type { ProjectionCurrentRosterConfirmationStatus } from "./projection-current-roster-confirmation-types";
import type { ProjectionPromotionEligibilityClassification } from "./projection-promotion-candidate-pool-types";

export type ProjectionRosterRefreshPolicyGroup =
  | "conflict_review"
  | "manual_review_remaining"
  | "unmatched_active_candidate_review"
  | "unmatched_rookie_new_review"
  | "unmatched_low_confidence_review"
  | "stale_unmatched_review"
  | "kicker_policy_review"
  | "legacy_blocked"
  | "confirmed_active_clear"
  | "confirmed_ir_pup_nfi_review"
  | "confirmed_non_active_review";

export type ProjectionRosterRefreshPolicyAction =
  | "safe_to_keep_active_candidate"
  | "needs_depth_chart_source"
  | "needs_transaction_status_source"
  | "needs_rookie_team_confirmation"
  | "needs_manual_team_conflict_review"
  | "keep_blocked_archive"
  | "keep_current_path"
  | "keep_shadow_only"
  | "needs_kicker_policy"
  | "needs_injury_status_review";

export type ProjectionRosterRefreshPolicyRecommendation =
  | "roster_policy_ready_for_source_expansion"
  | "roster_policy_needs_manual_review"
  | "roster_policy_blocked";

export type ProjectionRosterRefreshPolicyReviewOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionRosterRefreshPolicyReviewRow = {
  playerId: string;
  player: string;
  position: string;
  projectionTeam: string | null;
  rosterTeam: string | null;
  rosterStatus: string | null;
  originalGateStatus: ProjectionActiveUniverseGateStatus;
  h19Status: ProjectionActiveUniverseGateRosterRefreshStatus;
  confirmationStatus: ProjectionCurrentRosterConfirmationStatus;
  promotionEligibilityClassification: ProjectionPromotionEligibilityClassification | "missing_from_candidate_pool";
  policyGroup: ProjectionRosterRefreshPolicyGroup;
  recommendedPolicyAction: ProjectionRosterRefreshPolicyAction;
  v82Path: ProjectionActiveUniverseGateV82Path;
  v82ProtectionStatus: "would_use_v8_2_safe_subset" | "protected_current_path" | "excluded_or_blocked";
  reasonCodes: string[];
  lastActiveSeason: number | null;
  projectedTotalPointDelta: number | null;
  criticalMovement: boolean;
  estimatedOverallRankMovement: number | null;
};

export type ProjectionRosterRefreshPolicyReviewReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    rosterRefresh: string;
    currentRosterConfirmation: string;
    currentRosterConfirmationDelta: string;
    activeUniverseGate: string;
    universeHygieneSummary: string;
    featureFlagReviewPacket: string;
    promotionCandidatePool: string;
  };
  policyGroupCounts: Record<ProjectionRosterRefreshPolicyGroup, number>;
  actionCounts: Record<ProjectionRosterRefreshPolicyAction, number>;
  conflicts: ProjectionRosterRefreshPolicyReviewRow[];
  remainingManualReviewRows: ProjectionRosterRefreshPolicyReviewRow[];
  unmatchedSummary: {
    totalRows: number;
    byH19Status: Record<string, number>;
    byPosition: Record<string, number>;
    byTeam: Record<string, number>;
    byPromotionClassification: Record<string, number>;
    byV82Status: Record<string, number>;
    byStaleLegacyStatus: Record<string, number>;
  };
  rookieNewUnmatched: {
    totalRows: number;
    positionCounts: Record<string, number>;
    teamCounts: Record<string, number>;
    v82SafeSubsetRows: number;
    recommendedAction: ProjectionRosterRefreshPolicyAction;
    topExamples: ProjectionRosterRefreshPolicyReviewRow[];
  };
  activeCandidateUnmatched: {
    totalRows: number;
    positionCounts: Record<string, number>;
    teamCounts: Record<string, number>;
    v82SafeSubsetRows: number;
    recommendedAction: ProjectionRosterRefreshPolicyAction;
    topExamples: ProjectionRosterRefreshPolicyReviewRow[];
  };
  lowConfidenceUnmatched: {
    totalRows: number;
    positionCounts: Record<string, number>;
    teamCounts: Record<string, number>;
    v82SafeSubsetRows: number;
    recommendedAction: ProjectionRosterRefreshPolicyAction;
    topExamples: ProjectionRosterRefreshPolicyReviewRow[];
  };
  kickerPolicy: {
    totalKRows: number;
    confirmedRosterDepthRows: number;
    unmatchedKRows: number;
    criticalMoverKRows: number;
    blockedKRows: number;
    shadowOnlyKRows: number;
    recommendedAction: ProjectionRosterRefreshPolicyAction;
    topExamples: ProjectionRosterRefreshPolicyReviewRow[];
  };
  v82AdoptionImpact: {
    safeSubsetRowsInsideConfirmedActiveClear: number;
    safeSubsetRowsInsideUnmatchedGroups: number;
    protectedRowsInsideConflictManualKickerGroups: number;
    safeSubsetRemainsIntact: boolean;
    packetZeroChecks: Record<"kRowsUsingV82" | "criticalMoversUsingV82" | "meaningfulRankMoversUsingV82" | "legacyRowsUsingV82", boolean>;
  };
  rows: ProjectionRosterRefreshPolicyReviewRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionRosterRefreshPolicyRecommendation;
  notes: string[];
};

export type ProjectionRosterRefreshPolicyReviewInput = {
  options: ProjectionRosterRefreshPolicyReviewOptions;
  rosterRefresh: import("./projection-active-universe-gate-roster-refresh-types").ProjectionActiveUniverseGateRosterRefreshReport;
  currentRosterConfirmation: import("./projection-current-roster-confirmation-types").ProjectionCurrentRosterConfirmationReport;
  currentRosterConfirmationDelta: import("./projection-current-roster-confirmation-delta-types").ProjectionCurrentRosterConfirmationDeltaReport;
  activeUniverseGate: import("./projection-active-universe-gate-types").ProjectionActiveUniverseGateReport;
  featureFlagReviewPacket: import("./projection-v8-2-feature-flag-review-packet-types").ProjectionV82FeatureFlagReviewPacketReport;
  promotionCandidatePool: import("./projection-promotion-candidate-pool-types").ProjectionPromotionCandidatePoolReport;
  sourceArtifacts?: ProjectionRosterRefreshPolicyReviewReport["sourceArtifacts"];
};

export type ProjectionRosterRefreshPolicyReviewArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
