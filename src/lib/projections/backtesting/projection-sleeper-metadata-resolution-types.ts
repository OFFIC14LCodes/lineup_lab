import type { SleeperPlayerMetadataReport, SleeperPlayerMetadataRow } from "@/lib/data-acquisition/sleeper-player-metadata-source-types";

import type { ProjectionActiveUniversePolicyClassification } from "./projection-active-universe-policy-packet-types";
import type { ProjectionActiveUniverseGateRosterRefreshReport } from "./projection-active-universe-gate-roster-refresh-types";
import type { ProjectionCrosswalkUnmatchedReport, ProjectionCrosswalkUnmatchedRow } from "./projection-crosswalk-unmatched-classification-types";

export type ProjectionSleeperMetadataResolutionStatus =
  | "sleeper_metadata_active_plausible"
  | "sleeper_metadata_inactive_or_stale"
  | "sleeper_metadata_free_agent_or_unknown"
  | "sleeper_metadata_position_conflict"
  | "sleeper_metadata_team_conflict"
  | "sleeper_metadata_missing"
  | "sleeper_metadata_manual_review";

export type ProjectionSleeperMetadataResolutionReasonCode =
  | "exact_sleeper_id_match"
  | "sleeper_active_true"
  | "sleeper_active_false"
  | "sleeper_team_present"
  | "sleeper_team_missing"
  | "sleeper_position_matches"
  | "sleeper_position_conflicts"
  | "sleeper_status_inactive"
  | "sleeper_status_unknown"
  | "sleeper_search_rank_available"
  | "missing_sleeper_metadata"
  | "crosswalk_confirmed_gsis"
  | "not_in_current_roster_source"
  | "not_in_rookie_source";

export type ProjectionSleeperMetadataResolutionRecommendation =
  | "sleeper_metadata_resolution_ready_for_policy_preview"
  | "sleeper_metadata_resolution_needs_review"
  | "sleeper_metadata_resolution_blocked";

export type ProjectionSleeperMetadataResolutionOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionSleeperMetadataResolutionRow = {
  playerId: string;
  sleeperId: string | null;
  crosswalkGsisId: string | null;
  player: string;
  position: string;
  projectionTeam: string | null;
  metadataTeam: string | null;
  metadataPosition: string | null;
  metadataStatus: string | null;
  metadataActive: boolean | null;
  resolutionStatus: ProjectionSleeperMetadataResolutionStatus;
  reasonCodes: ProjectionSleeperMetadataResolutionReasonCode[];
  policyPreview: ProjectionActiveUniversePolicyClassification;
  v82SafeSubsetStatus: string;
  sourceRow: SleeperPlayerMetadataRow | null;
  h26Row: ProjectionCrosswalkUnmatchedRow;
  projectedTotalPointDelta: number | null;
  estimatedOverallRankMovement: number | null;
};

export type ProjectionSleeperMetadataResolutionReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    crosswalkUnmatchedClassification: string;
    sleeperPlayerMetadataSource: string | null;
    rosterRefresh: string;
  };
  sourceMissing: boolean;
  summary: {
    targetRows: number;
    metadataSourceRows: number;
    matchedBySleeperId: number;
    missingMetadata: number;
    activePlausible: number;
    inactiveOrStale: number;
    freeAgentOrUnknown: number;
    positionConflicts: number;
    teamConflicts: number;
    manualReview: number;
    byPosition: Record<string, number>;
    byTeam: Record<string, number>;
    byV82SafeSubset: Record<string, number>;
    byStatus: Record<ProjectionSleeperMetadataResolutionStatus, number>;
  };
  policyPreview: {
    wouldMoveTo: Record<ProjectionActiveUniversePolicyClassification, number>;
    notes: string[];
  };
  v82Impact: {
    safeRowsResolvedBySleeperMetadata: number;
    safeRowsStillHeldBack: number;
    safeRowsMovedToActiveCandidatePreview: number;
    protectedZeroChecks: Record<"kRowsUsingV82" | "criticalMoversUsingV82" | "meaningfulRankMoversUsingV82" | "legacyRowsUsingV82", boolean>;
    unblocksControlledFlagReview: boolean;
  };
  examples: {
    topActivePlausibleRows: ProjectionSleeperMetadataResolutionRow[];
    topInactiveStaleRows: ProjectionSleeperMetadataResolutionRow[];
    topMissingMetadataRows: ProjectionSleeperMetadataResolutionRow[];
    topPositionTeamConflicts: ProjectionSleeperMetadataResolutionRow[];
    topV82SafeRowsStillHeldBack: ProjectionSleeperMetadataResolutionRow[];
  };
  rows: ProjectionSleeperMetadataResolutionRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionSleeperMetadataResolutionRecommendation;
  notes: string[];
};

export type ProjectionSleeperMetadataResolutionInput = {
  options: ProjectionSleeperMetadataResolutionOptions;
  crosswalkUnmatchedClassification: ProjectionCrosswalkUnmatchedReport | null;
  sleeperPlayerMetadataSource: SleeperPlayerMetadataReport | null;
  rosterRefresh: ProjectionActiveUniverseGateRosterRefreshReport | null;
  sourceArtifacts?: ProjectionSleeperMetadataResolutionReport["sourceArtifacts"];
};

export type ProjectionSleeperMetadataResolutionArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
