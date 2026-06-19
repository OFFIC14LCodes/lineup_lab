import type { CurrentRosterSourceReport, CurrentRosterSourceRow } from "@/lib/data-acquisition/current-roster-source-types";
import type { RookieTeamConfirmationSourceReport, RookieTeamConfirmationSourceRow } from "@/lib/data-acquisition/rookie-team-confirmation-source-types";

import type { ProjectionActiveUniversePolicyClassification, ProjectionActiveUniversePolicyPacketReport } from "./projection-active-universe-policy-packet-types";
import type { ProjectionActiveUniverseGateRosterRefreshReport } from "./projection-active-universe-gate-roster-refresh-types";
import type { ProjectionCurrentRosterConfirmationReport, ProjectionCurrentRosterConfirmationRow } from "./projection-current-roster-confirmation-types";
import type { ProjectionPlayerIdCrosswalkReviewReport, ProjectionPlayerIdCrosswalkReviewRow } from "./projection-player-id-crosswalk-review-types";
import type { ProjectionRookieNewTargetDiagnosticsReport } from "./projection-rookie-new-target-diagnostics-types";
import type { ProjectionRookieTeamConfirmationReport } from "./projection-rookie-team-confirmation-types";
import type { PreseasonProjectionSnapshot, PreseasonProjectionSnapshotRow } from "./preseason-projection-snapshot-types";

export type ProjectionCrosswalkEnhancedConfirmationStatus =
  | "crosswalk_roster_confirmed_active"
  | "crosswalk_roster_confirmed_ir_pup_nfi"
  | "crosswalk_roster_confirmed_non_active"
  | "crosswalk_rookie_team_confirmed"
  | "crosswalk_team_conflict"
  | "crosswalk_source_unmatched"
  | "crosswalk_manual_review"
  | "crosswalk_blocked_archive";

export type ProjectionCrosswalkEnhancedConfirmationReasonCode =
  | "exact_crosswalk_confirmed"
  | "linked_to_current_roster_by_gsis"
  | "linked_to_rookie_source_by_gsis"
  | "linked_to_snapshot_by_gsis"
  | "linked_to_existing_roster_confirmation"
  | "team_matches_projection"
  | "team_conflicts_projection"
  | "status_active"
  | "status_ir_pup_nfi"
  | "status_non_active"
  | "roster_source_missing_after_crosswalk"
  | "rookie_source_missing_after_crosswalk"
  | "manual_review_position_family"
  | "crosswalk_not_confirmed"
  | "blocked_archive_preserved";

export type ProjectionCrosswalkEnhancedConfirmationRecommendation =
  | "crosswalk_enhanced_confirmation_ready_for_policy_refresh"
  | "crosswalk_enhanced_confirmation_needs_review"
  | "crosswalk_enhanced_confirmation_blocked";

export type ProjectionCrosswalkEnhancedConfirmationOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionCrosswalkEnhancedConfirmationRow = {
  playerId: string;
  sleeperId: string | null;
  crosswalkGsisId: string | null;
  player: string;
  normalizedName: string;
  position: string;
  projectionTeam: string | null;
  currentRosterTeam: string | null;
  currentRosterStatus: string | null;
  rookieTeam: string | null;
  snapshotTeam: string | null;
  existingRosterConfirmationStatus: string | null;
  h24Status: string;
  enhancedStatus: ProjectionCrosswalkEnhancedConfirmationStatus;
  reasonCodes: ProjectionCrosswalkEnhancedConfirmationReasonCode[];
  policyImpactPreview: ProjectionActiveUniversePolicyClassification;
  v82SafeSubsetStatus: string;
  linkedCurrentRosterRow: CurrentRosterSourceRow | null;
  linkedRookieTeamRow: RookieTeamConfirmationSourceRow | null;
  linkedSnapshotRow: PreseasonProjectionSnapshotRow | null;
  existingRosterConfirmationRow: ProjectionCurrentRosterConfirmationRow | null;
  projectedTotalPointDelta: number | null;
  estimatedOverallRankMovement: number | null;
};

export type ProjectionCrosswalkEnhancedConfirmationReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    playerIdCrosswalkReview: string;
    rookieNewTargetDiagnostics: string;
    rookieTeamConfirmation: string;
    currentRosterConfirmation: string;
    currentRosterSource: string | null;
    rookieTeamConfirmationSource: string | null;
    policyPacket: string;
    rosterRefresh: string;
    preseasonProjectionSnapshot: string;
  };
  sourceMissing: boolean;
  beforeAfterSummary: {
    needsIdCrosswalkBefore: number;
    exactCrosswalkConfirmed: number;
    linkedToCurrentRosterSource: number;
    linkedToRookieTeamSource: number;
    confirmedActiveAfterCrosswalk: number;
    confirmedTeamAfterCrosswalk: number;
    teamConflictsAfterCrosswalk: number;
    stillUnmatchedAfterCrosswalk: number;
    manualReviewAfterCrosswalk: number;
  };
  statusCounts: Record<ProjectionCrosswalkEnhancedConfirmationStatus, number>;
  h21PolicyImpactPreview: {
    wouldMoveTo: Record<ProjectionActiveUniversePolicyClassification, number>;
    notes: string[];
  };
  v82SafeSubsetImpact: {
    safeRowsResolvedByCrosswalkEnhancedConfirmation: number;
    safeRowsStillHeldBack: number;
    safeRowsMovedToActiveCandidatePreview: number;
    protectedRowsStillProtected: number;
    zeroChecks: Record<"kRowsUsingV82" | "criticalMoversUsingV82" | "meaningfulRankMoversUsingV82" | "legacyRowsUsingV82", boolean>;
  };
  reviewTables: {
    topRowsConfirmedActiveAfterCrosswalk: ProjectionCrosswalkEnhancedConfirmationRow[];
    rowsWithTeamConflictsAfterCrosswalk: ProjectionCrosswalkEnhancedConfirmationRow[];
    rowsStillUnmatchedAfterCrosswalk: ProjectionCrosswalkEnhancedConfirmationRow[];
    rowsMovedToActiveCandidatePreview: ProjectionCrosswalkEnhancedConfirmationRow[];
    rowsMovedToManualReview: ProjectionCrosswalkEnhancedConfirmationRow[];
  };
  rows: ProjectionCrosswalkEnhancedConfirmationRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionCrosswalkEnhancedConfirmationRecommendation;
  notes: string[];
};

export type ProjectionCrosswalkEnhancedConfirmationInput = {
  options: ProjectionCrosswalkEnhancedConfirmationOptions;
  playerIdCrosswalkReview: ProjectionPlayerIdCrosswalkReviewReport | null;
  rookieNewTargetDiagnostics: ProjectionRookieNewTargetDiagnosticsReport | null;
  rookieTeamConfirmation: ProjectionRookieTeamConfirmationReport | null;
  currentRosterConfirmation: ProjectionCurrentRosterConfirmationReport | null;
  currentRosterSource: CurrentRosterSourceReport | null;
  rookieTeamConfirmationSource: RookieTeamConfirmationSourceReport | null;
  policyPacket: ProjectionActiveUniversePolicyPacketReport | null;
  rosterRefresh: ProjectionActiveUniverseGateRosterRefreshReport | null;
  preseasonProjectionSnapshot: Pick<PreseasonProjectionSnapshot, "metadata" | "diagnostics" | "rows"> | null;
  sourceArtifacts?: ProjectionCrosswalkEnhancedConfirmationReport["sourceArtifacts"];
};

export type ProjectionCrosswalkEnhancedConfirmationArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};

export type ProjectionCrosswalkEnhancedTargetRow = ProjectionPlayerIdCrosswalkReviewRow;
