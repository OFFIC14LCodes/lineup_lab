import type { ProjectionActivePolicyRefreshFinalReport } from "./projection-active-policy-refresh-final-types";
import type { ProjectionDepthChartResolutionReport } from "./projection-depth-chart-resolution-types";
import type { ProjectionFreeAgentUnknownPolicyReviewReport } from "./projection-free-agent-unknown-policy-review-types";
import type { ProjectionSleeperMetadataResolutionReport } from "./projection-sleeper-metadata-resolution-types";
import type { ProjectionSleeperPolicyRefreshReport } from "./projection-sleeper-policy-refresh-types";
import type { ProjectionV82FeatureFlagReviewPacketReport } from "./projection-v8-2-feature-flag-review-packet-types";

export type WarRoomV1ReadinessStatus =
  | "ready"
  | "ready_with_holdbacks"
  | "needs_e2e_test"
  | "needs_manual_review"
  | "blocked";

export type WarRoomV1ReadinessRecommendation =
  | "war_room_v1_ready_with_holdbacks"
  | "war_room_v1_needs_e2e_draft_test"
  | "war_room_v1_needs_manual_review"
  | "war_room_v1_blocked";

export type WarRoomV1ReadinessCategoryName =
  | "war_room_ui_readiness"
  | "draft_sync_readiness"
  | "board_modes_readiness"
  | "player_detail_readiness"
  | "roster_construction_readiness"
  | "gm_brief_readiness"
  | "ai_context_readiness"
  | "projection_foundation_readiness"
  | "active_policy_readiness"
  | "v8_2_flag_safety"
  | "source_holdback_safety"
  | "e2e_draft_test_readiness";

export type WarRoomV1ReadinessOptions = {
  projectionSeason: number;
  includeIdp: boolean;
  env?: Record<string, string | undefined>;
};

export type WarRoomV1FeatureCheck = {
  name: string;
  present: boolean;
  detail: string;
};

export type WarRoomV1ReadinessCategory = {
  name: WarRoomV1ReadinessCategoryName;
  status: WarRoomV1ReadinessStatus;
  passedChecks: number;
  totalChecks: number;
  checks: WarRoomV1FeatureCheck[];
  detail: string;
};

export type WarRoomV1ReadinessReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    activePolicyRefreshFinal: string;
    depthChartResolution: string;
    featureFlagReviewPacket: string;
    sleeperPolicyRefresh: string;
    freeAgentUnknownPolicyReview: string;
    sleeperMetadataResolution: string;
    activeUniversePolicyPacket: string;
    preseasonProjectionSnapshot: string;
  };
  sourceMissing: boolean;
  recommendation: WarRoomV1ReadinessRecommendation;
  categorySummary: Record<WarRoomV1ReadinessCategoryName, WarRoomV1ReadinessStatus>;
  categories: WarRoomV1ReadinessCategory[];
  warRoomFeatureChecklist: WarRoomV1FeatureCheck[];
  conservativeLaunchPolicy: ProjectionActivePolicyRefreshFinalReport["policyCounts"]["h30FinalPolicyCounts"];
  sourceHoldbackSummary: {
    depthChartSourceRowsHeldBack: number;
    depthChartUnmatchedRows: number;
    freeAgentUnknownRowsNotAutoPromoted: boolean;
    freeAgentUnknownManualReviewRows: number;
    inactiveStaleRowsHeldBack: number;
    positionConflictsManualReview: number;
    kickerRowsNotAutoPromoted: boolean;
    legacyRowsBlockedArchive: boolean;
  };
  v82Safety: {
    featureFlagName: "BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES";
    enabled: boolean;
    defaultDisabled: boolean;
    safeRowsAllowedByFinalPolicy: number;
    safeRowsHeldBack: number;
    controlledFlagReviewRemainsBlocked: boolean;
    zeroChecksPreserved: boolean;
    protectedZeroChecks: Record<"kRowsUsingV82" | "criticalMoversUsingV82" | "meaningfulRankMoversUsingV82" | "legacyRowsUsingV82", boolean>;
  };
  e2eDraftTestChecklist: string[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  notes: string[];
};

export type WarRoomV1ReadinessInput = {
  options: WarRoomV1ReadinessOptions;
  activePolicyRefreshFinal: ProjectionActivePolicyRefreshFinalReport | null;
  depthChartResolution: ProjectionDepthChartResolutionReport | null;
  featureFlagReviewPacket: ProjectionV82FeatureFlagReviewPacketReport | null;
  sleeperPolicyRefresh?: ProjectionSleeperPolicyRefreshReport | null;
  freeAgentUnknownPolicyReview?: ProjectionFreeAgentUnknownPolicyReviewReport | null;
  sleeperMetadataResolution?: ProjectionSleeperMetadataResolutionReport | null;
  activeUniversePolicyPacket?: unknown;
  preseasonProjectionSnapshot?: unknown;
  sourceTexts: {
    draftWarRoom: string;
    draftWarRoomTest: string;
    aiContext: string;
    liveState: string;
    playerReasons: string;
  };
  sourceArtifacts?: WarRoomV1ReadinessReport["sourceArtifacts"];
};

export type WarRoomV1ReadinessArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
