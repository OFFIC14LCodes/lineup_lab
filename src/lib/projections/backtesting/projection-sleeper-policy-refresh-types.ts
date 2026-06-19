import type { ProjectionActiveUniversePolicyClassification, ProjectionActiveUniversePolicyPacketReport } from "./projection-active-universe-policy-packet-types";
import type { ProjectionActiveUniverseGateRosterRefreshReport } from "./projection-active-universe-gate-roster-refresh-types";
import type { ProjectionRosterRefreshPolicyReviewReport } from "./projection-roster-refresh-policy-review-types";
import type { ProjectionSleeperMetadataResolutionReport, ProjectionSleeperMetadataResolutionRow } from "./projection-sleeper-metadata-resolution-types";
import type { ProjectionV82FeatureFlagReviewPacketReport } from "./projection-v8-2-feature-flag-review-packet-types";

export type ProjectionSleeperPolicyRefreshClassification =
  | ProjectionActiveUniversePolicyClassification
  | "policy_active_candidate_preview";

export type ProjectionSleeperPolicyRefreshReason =
  | "sleeper_active_plausible_preview_allowed"
  | "sleeper_inactive_stale_held_back"
  | "sleeper_free_agent_unknown_held_back"
  | "sleeper_position_conflict_manual_review"
  | "sleeper_team_conflict_manual_review"
  | "sleeper_metadata_missing_source_expansion"
  | "sleeper_manual_review_required"
  | "v8_2_safe_subset_preserved";

export type ProjectionSleeperPolicyRefreshSourceNeed =
  | "free_agent_unknown_policy_review"
  | "transaction_status_source"
  | "depth_chart_source"
  | "position_conflict_manual_review";

export type ProjectionSleeperPolicyRefreshRecommendation =
  | "sleeper_policy_refresh_ready_for_transaction_source"
  | "sleeper_policy_refresh_needs_manual_review"
  | "sleeper_policy_refresh_blocked";

export type ProjectionSleeperPolicyRefreshOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionSleeperPolicyRefreshRow = {
  playerId: string;
  sleeperId: string | null;
  player: string;
  position: string;
  projectionTeam: string | null;
  metadataTeam: string | null;
  metadataStatus: string | null;
  resolutionStatus: ProjectionSleeperMetadataResolutionRow["resolutionStatus"];
  originalPolicyClassification: ProjectionActiveUniversePolicyClassification;
  refreshedPolicyClassification: ProjectionSleeperPolicyRefreshClassification;
  policyDelta: "unchanged" | "promoted_in_preview" | "held_back" | "manual_review";
  reasonCodes: ProjectionSleeperPolicyRefreshReason[];
  v82SafeSubsetStatus: string;
  projectedTotalPointDelta: number | null;
  estimatedOverallRankMovement: number | null;
  h27Row: ProjectionSleeperMetadataResolutionRow;
};

export type ProjectionSleeperPolicyRefreshReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    sleeperMetadataResolution: string;
    activeUniversePolicyPacket: string;
    rosterRefreshPolicyReview: string;
    activeUniverseGateRosterRefresh: string;
    featureFlagReviewPacket: string;
    preseasonProjectionSnapshot: string;
  };
  sourceMissing: boolean;
  policyCounts: {
    h21Before: Record<ProjectionActiveUniversePolicyClassification, number>;
    h28After: Record<ProjectionSleeperPolicyRefreshClassification, number>;
    delta: Record<ProjectionSleeperPolicyRefreshClassification, number>;
  };
  summary: {
    totalSleeperRows: number;
    activeCandidatesGainedFromSleeperMetadata: number;
    heldBackFromSleeperMetadata: number;
    manualReviewPositionConflicts: number;
    inactiveStaleHeldBack: number;
    freeAgentUnknownHeldBack: number;
    missingMetadataHeldBack: number;
    teamConflictsManualReview: number;
  };
  v82SafeSubsetImpact: {
    newlyAllowedBySleeperMetadata: number;
    stillHeldBack: number;
    heldBackByInactiveStale: number;
    heldBackByFreeAgentUnknown: number;
    heldBackByPositionConflict: number;
    heldBackByMissingMetadata: number;
    controlledFlagReviewRemainsBlocked: boolean;
    protectedZeroChecks: Record<"kRowsUsingV82" | "criticalMoversUsingV82" | "meaningfulRankMoversUsingV82" | "legacyRowsUsingV82", boolean>;
  };
  sourceRecommendations: Array<{
    sourceNeed: ProjectionSleeperPolicyRefreshSourceNeed;
    rowsAffected: number;
    v82SafeSubsetRowsAffected: number;
    rationale: string;
  }>;
  examples: {
    activePlausibleRows: ProjectionSleeperPolicyRefreshRow[];
    topInactiveStaleRows: ProjectionSleeperPolicyRefreshRow[];
    topFreeAgentUnknownRows: ProjectionSleeperPolicyRefreshRow[];
    positionConflictRows: ProjectionSleeperPolicyRefreshRow[];
    topV82SafeRowsStillHeldBack: ProjectionSleeperPolicyRefreshRow[];
  };
  rows: ProjectionSleeperPolicyRefreshRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionSleeperPolicyRefreshRecommendation;
  notes: string[];
};

export type ProjectionSleeperPolicyRefreshInput = {
  options: ProjectionSleeperPolicyRefreshOptions;
  sleeperMetadataResolution: ProjectionSleeperMetadataResolutionReport | null;
  activeUniversePolicyPacket: ProjectionActiveUniversePolicyPacketReport | null;
  rosterRefreshPolicyReview?: ProjectionRosterRefreshPolicyReviewReport | null;
  activeUniverseGateRosterRefresh?: ProjectionActiveUniverseGateRosterRefreshReport | null;
  featureFlagReviewPacket?: ProjectionV82FeatureFlagReviewPacketReport | null;
  preseasonProjectionSnapshot?: unknown;
  sourceArtifacts?: ProjectionSleeperPolicyRefreshReport["sourceArtifacts"];
};

export type ProjectionSleeperPolicyRefreshArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
