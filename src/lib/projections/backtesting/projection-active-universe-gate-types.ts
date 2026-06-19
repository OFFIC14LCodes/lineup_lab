import type { ProjectionPromotionEligibilityClassification } from "./projection-promotion-candidate-pool-types";
import type { ProjectionUniverseEligibilityStatus } from "./projection-universe-eligibility-audit-types";

export type ProjectionActiveUniverseGateStatus =
  | "active_confirmed"
  | "rookie_or_new_confirmed"
  | "free_agent_plausible"
  | "low_confidence_plausible"
  | "stale_status_review"
  | "legacy_archive_blocked"
  | "kicker_policy_review"
  | "manual_review_required";

export type ProjectionActiveUniverseGateReasonCode =
  | "current_team_present"
  | "team_value_stale_suspect"
  | "recent_activity_signal"
  | "old_last_seen_signal"
  | "rookie_current_class"
  | "blocked_legacy_from_hygiene"
  | "promotion_eligible"
  | "shadow_only_from_candidate_pool"
  | "kicker_policy_excluded"
  | "critical_movement_protected"
  | "meaningful_rank_protected"
  | "ambiguous_team_signal"
  | "needs_current_roster_source"
  | "needs_depth_chart_source";

export type ProjectionActiveUniverseGateRecommendation =
  | "active_universe_gate_ready_for_source_integration"
  | "active_universe_gate_needs_review"
  | "active_universe_gate_blocked";

export type ProjectionActiveUniverseGateV82Path = "would_use_v8_2_safe_subset" | "would_stay_current_path" | "excluded_or_blocked";

export type ProjectionActiveUniverseGateOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionActiveUniverseGateRow = {
  playerId: string;
  player: string;
  position: string;
  team: string | null;
  lastActiveSeason: number | null;
  gateStatus: ProjectionActiveUniverseGateStatus;
  reasonCodes: ProjectionActiveUniverseGateReasonCode[];
  universeEligibilityStatus: ProjectionUniverseEligibilityStatus;
  promotionEligibilityClassification: ProjectionPromotionEligibilityClassification | "missing_from_candidate_pool";
  v82Path: ProjectionActiveUniverseGateV82Path;
  currentExpectedGames: number | null;
  v82ExpectedGames: number | null;
  projectedTotalPointDelta: number | null;
  criticalMovement: boolean;
  estimatedOverallRankMovement: number | null;
  matchConfidence: string;
  recommendedAction: string;
};

export type ProjectionActiveUniverseGateReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    preseasonProjectionSnapshot: string;
    universeEligibilityAudit: string;
    universeHygieneSummary: string;
    promotionCandidatePool: string;
    featureFlagReviewPacket: string;
  };
  activeGateCounts: {
    totalRows: number;
    statusCounts: Record<ProjectionActiveUniverseGateStatus, number>;
    byPosition: Record<string, Record<ProjectionActiveUniverseGateStatus, number>>;
    byTeam: Record<string, Record<ProjectionActiveUniverseGateStatus, number>>;
    byOriginalHygieneStatus: Record<string, Record<ProjectionActiveUniverseGateStatus, number>>;
    byPromotionClassification: Record<string, Record<ProjectionActiveUniverseGateStatus, number>>;
  };
  sourceIntegrationNeeds: {
    currentRosterSourceNeeded: number;
    depthChartSourceNeeded: number;
    transactionFreeAgentStatusSourceNeeded: number;
    rookieDraftTeamSourceNeeded: number;
    injuryPupNfiStatusSourceNeeded: number;
    kickerSpecificDepthChartSourceNeeded: number;
    notes: string[];
  };
  candidatePool: {
    activeUniverseCandidateRows: number;
    blockedArchiveRows: number;
    reviewRows: number;
    kickerPolicyRows: number;
    note: string;
  };
  v82SafeSubsetCrossReference: {
    byGateStatus: Record<ProjectionActiveUniverseGateStatus, Record<ProjectionActiveUniverseGateV82Path, number>>;
    packetSummary: {
      enabledSafeSubsetV82Rows: number;
      currentPathProtectedRows: number;
      excludedRows: number;
      blockedRows: number;
    };
    note: string;
  };
  topReviewTables: {
    staleStatusReview: ProjectionActiveUniverseGateRow[];
    legacyArchiveBlocked: ProjectionActiveUniverseGateRow[];
    freeAgentPlausible: ProjectionActiveUniverseGateRow[];
    lowConfidencePlausible: ProjectionActiveUniverseGateRow[];
    ambiguousTeamRows: ProjectionActiveUniverseGateRow[];
    kickerPolicyReview: ProjectionActiveUniverseGateRow[];
  };
  rows: ProjectionActiveUniverseGateRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionActiveUniverseGateRecommendation;
  notes: string[];
};

export type ProjectionActiveUniverseGateInput = {
  options: ProjectionActiveUniverseGateOptions;
  universeEligibilityAudit: import("./projection-universe-eligibility-audit-types").ProjectionUniverseEligibilityAuditReport;
  universeHygieneSummary: import("./projection-universe-hygiene-summary-types").ProjectionUniverseHygieneSummaryReport;
  promotionCandidatePool: import("./projection-promotion-candidate-pool-types").ProjectionPromotionCandidatePoolReport;
  featureFlagReviewPacket: import("./projection-v8-2-feature-flag-review-packet-types").ProjectionV82FeatureFlagReviewPacketReport;
  sourceArtifacts?: ProjectionActiveUniverseGateReport["sourceArtifacts"];
};

export type ProjectionActiveUniverseGateArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
