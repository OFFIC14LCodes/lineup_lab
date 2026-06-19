import type { CurrentRosterSourceReport, CurrentRosterSourceRow } from "@/lib/data-acquisition/current-roster-source-types";
import type { RookieTeamConfirmationSourceReport, RookieTeamConfirmationSourceRow } from "@/lib/data-acquisition/rookie-team-confirmation-source-types";

import type { ProjectionActiveUniverseGateRosterRefreshReport } from "./projection-active-universe-gate-roster-refresh-types";
import type { ProjectionActiveUniversePolicyPacketReport } from "./projection-active-universe-policy-packet-types";
import type { ProjectionCurrentRosterConfirmationReport, ProjectionCurrentRosterConfirmationRow } from "./projection-current-roster-confirmation-types";
import type { ProjectionRookieTeamConfirmationReport, ProjectionRookieTeamConfirmationRow } from "./projection-rookie-team-confirmation-types";
import type { PreseasonProjectionSnapshot } from "./preseason-projection-snapshot-types";

export type ProjectionRookieNewTargetIdentityClass =
  | "true_rookie_candidate"
  | "sleeper_only_player"
  | "low_prior_veteran_or_unknown"
  | "idp_position_family_mismatch_candidate"
  | "special_teams_position_mismatch_candidate"
  | "duplicate_or_alias_candidate"
  | "missing_identity_data"
  | "source_strategy_unknown";

export type ProjectionRookieNewTargetSourceStrategy =
  | "use_sleeper_player_metadata"
  | "use_current_roster_source"
  | "use_draft_results_source"
  | "use_depth_chart_source"
  | "use_transaction_status_source"
  | "use_manual_rookie_source"
  | "needs_id_crosswalk"
  | "needs_position_family_review";

export type ProjectionRookieNewTargetDiagnosticsRecommendation =
  | "rookie_target_diagnostics_ready_for_source_selection"
  | "rookie_target_diagnostics_needs_more_identity_data"
  | "rookie_target_diagnostics_blocked";

export type ProjectionRookieNewTargetPositionFamilyDiagnostic =
  | "returner_family_compatible"
  | "edge_family_compatible"
  | "db_family_compatible"
  | "te_ls_incompatible_without_review"
  | "position_family_incompatible"
  | "position_family_exact"
  | "not_applicable";

export type ProjectionRookieNewTargetDiagnosticsOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionRookieNewTargetDiagnosticsRow = {
  playerId: string;
  sleeperId: string | null;
  gsisId: string | null;
  player: string;
  normalizedName: string;
  position: string;
  team: string | null;
  sourceRowMatchCandidates: {
    currentRoster: ProjectionRookieNewTargetSourceCandidate[];
    rookieTeam: ProjectionRookieNewTargetSourceCandidate[];
  };
  currentRosterMatchStatus: string;
  rookieConfirmationMatchStatus: string;
  h21PolicyGroup: string;
  v82SafeSubsetStatus: "v82_safe_subset" | "not_v82_safe_subset";
  reasonCodes: string[];
  targetIdentityClass: ProjectionRookieNewTargetIdentityClass;
  recommendedSourceStrategy: ProjectionRookieNewTargetSourceStrategy;
  positionFamilyDiagnostic: ProjectionRookieNewTargetPositionFamilyDiagnostic;
  projectedTotalPointDelta: number | null;
  estimatedOverallRankMovement: number | null;
};

export type ProjectionRookieNewTargetSourceCandidate = {
  source: "current_roster" | "rookie_team_confirmation";
  playerId: string | null;
  sleeperId: string | null;
  gsisId: string | null;
  playerName: string;
  normalizedName: string;
  position: string;
  team: string | null;
  status: string | null;
  matchKind: string;
  positionFamilyDiagnostic: ProjectionRookieNewTargetPositionFamilyDiagnostic;
};

export type ProjectionRookieNewTargetDiagnosticsReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    rookieTeamConfirmation: string;
    policyPacket: string;
    rosterRefresh: string;
    currentRosterConfirmation: string;
    preseasonProjectionSnapshot: string;
    currentRosterSource: string | null;
    rookieTeamConfirmationSource: string | null;
  };
  summary: {
    totalTargetRows: number;
    identityClassCounts: Record<ProjectionRookieNewTargetIdentityClass, number>;
    sourceStrategyCounts: Record<ProjectionRookieNewTargetSourceStrategy, number>;
    positionFamilyCounts: Record<ProjectionRookieNewTargetPositionFamilyDiagnostic, number>;
  };
  sourceCoverageSummary: {
    targetRowsWithSleeperIdOnly: number;
    targetRowsWithGsisId: number;
    targetRowsWithBothSleeperAndGsis: number;
    targetRowsWithNoStableId: number;
    targetRowsFoundInCurrentRosterSource: number;
    targetRowsFoundInRookieSource: number;
    targetRowsFoundByNameTeamOverlap: number;
    targetRowsRequiringSleeperMetadata: number;
    targetRowsRequiringDraftResults: number;
    targetRowsRequiringManualReview: number;
  };
  positionFamilyDiagnostics: {
    nameTeamOverlapsWithIncompatiblePosition: number;
    nameTeamOverlapsWithCompatiblePositionFamily: number;
    namePositionOverlapsWithTeamMismatch: number;
  };
  h21ImpactSummary: {
    rowsBySourceStrategy: Record<ProjectionRookieNewTargetSourceStrategy, number>;
    v82SafeRowsBySourceStrategy: Record<ProjectionRookieNewTargetSourceStrategy, number>;
    sourceStrategyBlocksV82ControlledReview: boolean;
    note: string;
  };
  examples: {
    topRowsByProjectionImpact: ProjectionRookieNewTargetDiagnosticsRow[];
    topV82SafeSubsetRows: ProjectionRookieNewTargetDiagnosticsRow[];
    topRowsWithNoSourceOverlap: ProjectionRookieNewTargetDiagnosticsRow[];
    topRowsWithNameOverlapPositionMismatch: ProjectionRookieNewTargetDiagnosticsRow[];
    topIdpEdgeFamilyMismatchCandidates: ProjectionRookieNewTargetDiagnosticsRow[];
    topSpecialTeamsPositionMismatchCandidates: ProjectionRookieNewTargetDiagnosticsRow[];
  };
  rows: ProjectionRookieNewTargetDiagnosticsRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionRookieNewTargetDiagnosticsRecommendation;
  notes: string[];
};

export type ProjectionRookieNewTargetDiagnosticsInput = {
  options: ProjectionRookieNewTargetDiagnosticsOptions;
  rookieTeamConfirmation: ProjectionRookieTeamConfirmationReport;
  policyPacket: ProjectionActiveUniversePolicyPacketReport;
  rosterRefresh: ProjectionActiveUniverseGateRosterRefreshReport;
  currentRosterConfirmation: ProjectionCurrentRosterConfirmationReport;
  preseasonProjectionSnapshot: Pick<PreseasonProjectionSnapshot, "metadata" | "diagnostics" | "rows"> | null;
  currentRosterSource: CurrentRosterSourceReport | null;
  rookieTeamConfirmationSource: RookieTeamConfirmationSourceReport | null;
  sourceArtifacts?: ProjectionRookieNewTargetDiagnosticsReport["sourceArtifacts"];
};

export type ProjectionRookieNewTargetDiagnosticsArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};

export type ProjectionRookieNewTargetDiagnosticsSourceLookup = {
  currentRosterRows: CurrentRosterSourceRow[];
  rookieSourceRows: RookieTeamConfirmationSourceRow[];
  currentConfirmationRows: ProjectionCurrentRosterConfirmationRow[];
  rookieConfirmationRows: ProjectionRookieTeamConfirmationRow[];
};
