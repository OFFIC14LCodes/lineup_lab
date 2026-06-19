import type { ProjectionSleeperPolicyRefreshReport, ProjectionSleeperPolicyRefreshRow } from "./projection-sleeper-policy-refresh-types";
import type { ProjectionSleeperMetadataResolutionReport } from "./projection-sleeper-metadata-resolution-types";
import type { ProjectionActiveUniversePolicyPacketReport } from "./projection-active-universe-policy-packet-types";
import type { ProjectionRosterRefreshPolicyReviewReport } from "./projection-roster-refresh-policy-review-types";
import type { ProjectionV82FeatureFlagReviewPacketReport } from "./projection-v8-2-feature-flag-review-packet-types";

export type ProjectionFreeAgentUnknownPolicyClass =
  | "free_agent_unknown_shadow_only"
  | "free_agent_unknown_current_path_only"
  | "free_agent_unknown_manual_review"
  | "free_agent_unknown_blocked_archive"
  | "free_agent_unknown_source_expansion_required";

export type ProjectionFreeAgentUnknownImportanceBucket =
  | "high_projection_importance"
  | "moderate_projection_importance"
  | "low_projection_importance"
  | "insufficient_projection_importance_data";

export type ProjectionFreeAgentUnknownReasonCode =
  | "sleeper_metadata_free_agent_unknown"
  | "not_current_roster_confirmed"
  | "not_rookie_confirmed"
  | "low_projection_importance"
  | "moderate_projection_importance"
  | "high_projection_importance"
  | "old_last_seen_signal"
  | "v8_2_safe_but_held_back"
  | "needs_transaction_status_source"
  | "needs_manual_review";

export type ProjectionFreeAgentUnknownPolicyRecommendation =
  | "free_agent_unknown_policy_ready_for_refresh"
  | "free_agent_unknown_policy_needs_manual_review"
  | "free_agent_unknown_policy_blocked";

export type ProjectionFreeAgentUnknownPolicyOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionFreeAgentUnknownPolicyRow = {
  playerId: string;
  sleeperId: string | null;
  player: string;
  position: string;
  projectionTeam: string | null;
  metadataTeam: string | null;
  metadataStatus: string | null;
  projectedTotalPointDelta: number | null;
  estimatedOverallRankMovement: number | null;
  lastActiveSeason: number | null;
  oldOrStaleSignal: boolean;
  importanceBucket: ProjectionFreeAgentUnknownImportanceBucket;
  policyClass: ProjectionFreeAgentUnknownPolicyClass;
  reasonCodes: ProjectionFreeAgentUnknownReasonCode[];
  v82SafeSubsetStatus: string;
  h28Row: ProjectionSleeperPolicyRefreshRow;
};

export type ProjectionFreeAgentUnknownPolicyReviewReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    sleeperPolicyRefresh: string;
    sleeperMetadataResolution: string;
    activeUniversePolicyPacket: string;
    rosterRefreshPolicyReview: string;
    featureFlagReviewPacket: string;
    preseasonProjectionSnapshot: string;
  };
  sourceMissing: boolean;
  summary: {
    targetRows: number;
    reviewedRows: number;
    activePromotions: number;
    byPolicyClass: Record<ProjectionFreeAgentUnknownPolicyClass, number>;
    byPosition: Record<string, Record<ProjectionFreeAgentUnknownPolicyClass, number>>;
    byTeam: Record<string, Record<ProjectionFreeAgentUnknownPolicyClass, number>>;
    byImportanceBucket: Record<ProjectionFreeAgentUnknownImportanceBucket, number>;
    byV82SafeSubset: Record<string, Record<ProjectionFreeAgentUnknownPolicyClass, number>>;
    oldOrStaleSignal: {
      oldOrStaleRows: number;
      notOldOrStaleRows: number;
      byPolicyClass: Record<ProjectionFreeAgentUnknownPolicyClass, number>;
    };
  };
  v82Impact: {
    freeAgentUnknownV82SafeRowsReviewed: number;
    heldBackAsShadowOnly: number;
    heldBackAsCurrentPathOnly: number;
    heldBackAsManualReview: number;
    heldBackAsBlockedArchive: number;
    heldBackAsSourceExpansionRequired: number;
    controlledFlagReviewRemainsBlocked: boolean;
    protectedZeroChecks: Record<"kRowsUsingV82" | "criticalMoversUsingV82" | "meaningfulRankMoversUsingV82" | "legacyRowsUsingV82", boolean>;
  };
  examples: {
    topHighImportanceManualReviewRows: ProjectionFreeAgentUnknownPolicyRow[];
    topCurrentPathOnlyRows: ProjectionFreeAgentUnknownPolicyRow[];
    topShadowOnlyRows: ProjectionFreeAgentUnknownPolicyRow[];
    topBlockedArchiveRows: ProjectionFreeAgentUnknownPolicyRow[];
    topSourceExpansionRequiredRows: ProjectionFreeAgentUnknownPolicyRow[];
  };
  rows: ProjectionFreeAgentUnknownPolicyRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionFreeAgentUnknownPolicyRecommendation;
  notes: string[];
};

export type ProjectionFreeAgentUnknownPolicyReviewInput = {
  options: ProjectionFreeAgentUnknownPolicyOptions;
  sleeperPolicyRefresh: ProjectionSleeperPolicyRefreshReport | null;
  sleeperMetadataResolution?: ProjectionSleeperMetadataResolutionReport | null;
  activeUniversePolicyPacket?: ProjectionActiveUniversePolicyPacketReport | null;
  rosterRefreshPolicyReview?: ProjectionRosterRefreshPolicyReviewReport | null;
  featureFlagReviewPacket?: ProjectionV82FeatureFlagReviewPacketReport | null;
  preseasonProjectionSnapshot?: unknown;
  sourceArtifacts?: ProjectionFreeAgentUnknownPolicyReviewReport["sourceArtifacts"];
};

export type ProjectionFreeAgentUnknownPolicyReviewArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
