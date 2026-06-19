import type { ProjectionActiveUniversePolicyClassification, ProjectionActiveUniversePolicyPacketReport, ProjectionActiveUniversePolicyPacketRow } from "./projection-active-universe-policy-packet-types";
import type { ProjectionActiveUniverseGateRosterRefreshReport } from "./projection-active-universe-gate-roster-refresh-types";
import type { ProjectionCrosswalkEnhancedConfirmationReport, ProjectionCrosswalkEnhancedConfirmationRow } from "./projection-crosswalk-enhanced-confirmation-types";
import type { ProjectionCurrentRosterConfirmationReport } from "./projection-current-roster-confirmation-types";
import type { ProjectionPlayerIdCrosswalkReviewReport } from "./projection-player-id-crosswalk-review-types";
import type { ProjectionRookieNewTargetDiagnosticsReport, ProjectionRookieNewTargetDiagnosticsRow } from "./projection-rookie-new-target-diagnostics-types";
import type { PreseasonProjectionSnapshot, PreseasonProjectionSnapshotRow } from "./preseason-projection-snapshot-types";

export type ProjectionCrosswalkUnmatchedClass =
  | "likely_inactive_or_archive"
  | "needs_transaction_status_source"
  | "needs_sleeper_status_source"
  | "needs_depth_chart_source"
  | "needs_manual_review"
  | "keep_source_expansion_required";

export type ProjectionCrosswalkUnmatchedReasonCode =
  | "exact_crosswalk_confirmed"
  | "missing_from_current_roster_source"
  | "missing_from_rookie_source"
  | "old_last_seen_signal"
  | "low_prior_signal"
  | "no_current_roster_confirmation"
  | "sleeper_only_status_needed"
  | "possible_free_agent_or_retired"
  | "position_family_uncertain"
  | "historical_name_present"
  | "v8_2_safe_but_held_back"
  | "depth_chart_policy_need"
  | "recent_activity_needs_transaction_status";

export type ProjectionCrosswalkUnmatchedSourcePriority =
  | "sleeper_player_metadata_source"
  | "transaction_free_agent_source"
  | "depth_chart_source"
  | "manual_review"
  | "keep_shadow_only_policy";

export type ProjectionCrosswalkUnmatchedRecommendation =
  | "crosswalk_unmatched_ready_for_source_selection"
  | "crosswalk_unmatched_needs_manual_review"
  | "crosswalk_unmatched_blocked";

export type ProjectionCrosswalkUnmatchedOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionCrosswalkUnmatchedRow = {
  playerId: string;
  sleeperId: string | null;
  crosswalkGsisId: string | null;
  player: string;
  normalizedName: string;
  position: string;
  projectionTeam: string | null;
  h23IdentityClass: string | null;
  h21PolicyGroup: string | null;
  h21RecommendedPolicyAction: string | null;
  originalPolicyClassification: ProjectionActiveUniversePolicyClassification | null;
  lastActiveSeason: number | null;
  v82SafeSubsetStatus: "v82_safe_subset" | "not_v82_safe_subset";
  projectedTotalPointDelta: number | null;
  estimatedOverallRankMovement: number | null;
  classification: ProjectionCrosswalkUnmatchedClass;
  reasonCodes: ProjectionCrosswalkUnmatchedReasonCode[];
  h21PolicyPreview: ProjectionActiveUniversePolicyClassification;
  sourcePriority: ProjectionCrosswalkUnmatchedSourcePriority;
  h25Row: ProjectionCrosswalkEnhancedConfirmationRow;
  h23Row: ProjectionRookieNewTargetDiagnosticsRow | null;
  policyRow: ProjectionActiveUniversePolicyPacketRow | null;
  snapshotRow: PreseasonProjectionSnapshotRow | null;
};

export type ProjectionCrosswalkUnmatchedReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    crosswalkEnhancedConfirmation: string;
    playerIdCrosswalkReview: string;
    rookieNewTargetDiagnostics: string;
    policyPacket: string;
    rosterRefresh: string;
    currentRosterConfirmation: string;
    currentRosterSource: string | null;
    preseasonProjectionSnapshot: string;
  };
  sourceMissing: boolean;
  summary: {
    totalCrosswalkUnmatchedRows: number;
    byClassification: Record<ProjectionCrosswalkUnmatchedClass, number>;
    byPosition: Record<string, number>;
    byTeam: Record<string, number>;
    byOriginalH21PolicyGroup: Record<string, number>;
    byH23IdentityClass: Record<string, number>;
    byV82SafeSubset: Record<string, number>;
    projectionImportance: {
      topProjectionDelta: number | null;
      topRankMovement: number | null;
      criticalOrMeaningfulRows: number;
    };
  };
  sourcePriorityRecommendation: {
    recommendedSourcePriority: ProjectionCrosswalkUnmatchedSourcePriority;
    priorityCounts: Record<ProjectionCrosswalkUnmatchedSourcePriority, number>;
    note: string;
  };
  h21PolicyPreview: {
    wouldRemainUnder: Record<ProjectionActiveUniversePolicyClassification, number>;
    notes: string[];
  };
  v82Impact: {
    safeRowsAffected: number;
    safeRowsStillHeldBack: number;
    blocksControlledFlagReview: boolean;
    zeroChecksPreserved: boolean;
    zeroChecks: Record<"kRowsUsingV82" | "criticalMoversUsingV82" | "meaningfulRankMoversUsingV82" | "legacyRowsUsingV82", boolean>;
  };
  examples: {
    topLikelyInactiveArchiveRows: ProjectionCrosswalkUnmatchedRow[];
    topNeedsTransactionStatusRows: ProjectionCrosswalkUnmatchedRow[];
    topNeedsSleeperStatusRows: ProjectionCrosswalkUnmatchedRow[];
    topNeedsDepthChartRows: ProjectionCrosswalkUnmatchedRow[];
    topV82SafeHeldBackRows: ProjectionCrosswalkUnmatchedRow[];
  };
  rows: ProjectionCrosswalkUnmatchedRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionCrosswalkUnmatchedRecommendation;
  notes: string[];
};

export type ProjectionCrosswalkUnmatchedInput = {
  options: ProjectionCrosswalkUnmatchedOptions;
  crosswalkEnhancedConfirmation: ProjectionCrosswalkEnhancedConfirmationReport | null;
  playerIdCrosswalkReview: ProjectionPlayerIdCrosswalkReviewReport | null;
  rookieNewTargetDiagnostics: ProjectionRookieNewTargetDiagnosticsReport | null;
  policyPacket: ProjectionActiveUniversePolicyPacketReport | null;
  rosterRefresh: ProjectionActiveUniverseGateRosterRefreshReport | null;
  currentRosterConfirmation: ProjectionCurrentRosterConfirmationReport | null;
  currentRosterSourcePresent: boolean;
  preseasonProjectionSnapshot: Pick<PreseasonProjectionSnapshot, "metadata" | "diagnostics" | "rows"> | null;
  sourceArtifacts?: ProjectionCrosswalkUnmatchedReport["sourceArtifacts"];
};

export type ProjectionCrosswalkUnmatchedArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
