import type { ProjectionActiveUniverseGateStatus, ProjectionActiveUniverseGateV82Path } from "./projection-active-universe-gate-types";
import type { ProjectionCurrentRosterConfirmationReasonCode, ProjectionCurrentRosterConfirmationStatus } from "./projection-current-roster-confirmation-types";
import type { ProjectionPromotionEligibilityClassification } from "./projection-promotion-candidate-pool-types";

export type ProjectionActiveUniverseGateRosterRefreshStatus =
  | "roster_confirmed_active"
  | "roster_confirmed_ir_pup_nfi"
  | "roster_confirmed_non_active"
  | "roster_unmatched_review"
  | "rookie_or_new_unmatched_review"
  | "legacy_archive_blocked"
  | "kicker_policy_review"
  | "manual_review_required";

export type ProjectionActiveUniverseGateRosterRefreshRecommendation =
  | "roster_refresh_ready_for_policy_review"
  | "roster_refresh_needs_more_source_data"
  | "roster_refresh_blocked";

export type ProjectionActiveUniverseGateRosterRefreshOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionActiveUniverseGateRosterRefreshRow = {
  playerId: string;
  player: string;
  position: string;
  projectionTeam: string | null;
  rosterTeam: string | null;
  rosterStatus: string | null;
  originalGateStatus: ProjectionActiveUniverseGateStatus;
  refreshedGateStatus: ProjectionActiveUniverseGateRosterRefreshStatus;
  confirmationStatus: ProjectionCurrentRosterConfirmationStatus;
  promotionEligibilityClassification: ProjectionPromotionEligibilityClassification | "missing_from_candidate_pool";
  v82Path: ProjectionActiveUniverseGateV82Path;
  reasonCodes: ProjectionCurrentRosterConfirmationReasonCode[];
  refreshReasonCodes: string[];
  recommendedAction: string;
  lastActiveSeason: number | null;
  projectedTotalPointDelta: number | null;
  criticalMovement: boolean;
  estimatedOverallRankMovement: number | null;
  matchConfidence: string;
};

export type ProjectionActiveUniverseGateRosterRefreshReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    preseasonProjectionSnapshot: string;
    activeUniverseGate: string;
    currentRosterConfirmation: string;
    currentRosterConfirmationDelta: string;
    universeHygieneSummary: string;
    promotionCandidatePool: string;
    featureFlagReviewPacket: string;
  };
  beforeAfterStatusCounts: {
    totalRows: number;
    originalH16StatusCounts: Record<ProjectionActiveUniverseGateStatus, number>;
    refreshedStatusCounts: Record<ProjectionActiveUniverseGateRosterRefreshStatus, number>;
    transitionCounts: Record<string, number>;
  };
  statusChangeSummary: {
    activeConfirmedIncrease: number;
    activeConfirmedDecrease: number;
    staleStatusReviewResolved: number;
    manualReviewResolved: number;
    lowConfidenceResolved: number;
    legacyArchiveChanged: number;
    kickerPolicyChanged: number;
    kickerPolicyUnchanged: number;
  };
  matchedSummary: {
    matchedRows: number;
    unmatchedRows: number;
    conflicts: number;
    confirmedActive: number;
    confirmedNonActive: number;
    confirmedIrPupNfi: number;
  };
  unmatchedSummary: {
    totalRows: number;
    byOriginalH16GateStatus: Record<string, number>;
    byPosition: Record<string, number>;
    byTeam: Record<string, number>;
    byStaleLegacyStatus: Record<string, number>;
    byPromotionClassification: Record<string, number>;
    topUnmatchedActiveCandidateRows: ProjectionActiveUniverseGateRosterRefreshRow[];
    topUnmatchedLowConfidenceRows: ProjectionActiveUniverseGateRosterRefreshRow[];
    topUnmatchedStaleRows: ProjectionActiveUniverseGateRosterRefreshRow[];
  };
  conflicts: ProjectionActiveUniverseGateRosterRefreshRow[];
  manualReviewResolvedRows: ProjectionActiveUniverseGateRosterRefreshRow[];
  staleReviewResolvedRows: ProjectionActiveUniverseGateRosterRefreshRow[];
  v82SafeSubsetCrossReference: {
    byRefreshedStatus: Record<ProjectionActiveUniverseGateRosterRefreshStatus, Record<ProjectionActiveUniverseGateV82Path, number>>;
    packetSummary: {
      enabledSafeSubsetV82Rows: number;
      currentPathProtectedRows: number;
      excludedRows: number;
      blockedRows: number;
      kRowsUsingV82: number;
      criticalMoversUsingV82: number;
      meaningfulRankMoversUsingV82: number;
      legacyRowsUsingV82: number;
    };
    rowsThatWouldUseV82UnderEnabledSafeFlag: number;
    rowsThatStayCurrentPath: number;
    rowsExcludedOrBlocked: number;
    rowsBlocked: number;
    preservedZeroChecks: Record<"kRowsUsingV82" | "criticalMoversUsingV82" | "meaningfulRankMoversUsingV82" | "legacyRowsUsingV82", boolean>;
  };
  rows: ProjectionActiveUniverseGateRosterRefreshRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionActiveUniverseGateRosterRefreshRecommendation;
  notes: string[];
};

export type ProjectionActiveUniverseGateRosterRefreshInput = {
  options: ProjectionActiveUniverseGateRosterRefreshOptions;
  activeUniverseGate: import("./projection-active-universe-gate-types").ProjectionActiveUniverseGateReport;
  currentRosterConfirmation: import("./projection-current-roster-confirmation-types").ProjectionCurrentRosterConfirmationReport;
  currentRosterConfirmationDelta: import("./projection-current-roster-confirmation-delta-types").ProjectionCurrentRosterConfirmationDeltaReport;
  featureFlagReviewPacket: import("./projection-v8-2-feature-flag-review-packet-types").ProjectionV82FeatureFlagReviewPacketReport;
  sourceArtifacts?: ProjectionActiveUniverseGateRosterRefreshReport["sourceArtifacts"];
};

export type ProjectionActiveUniverseGateRosterRefreshArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
