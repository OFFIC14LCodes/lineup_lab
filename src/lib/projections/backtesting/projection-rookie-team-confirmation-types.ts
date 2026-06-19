import type { RookieTeamConfirmationSourceReport, RookieTeamConfirmationSourceRow } from "@/lib/data-acquisition/rookie-team-confirmation-source-types";

import type { ProjectionActiveUniversePolicyClassification, ProjectionActiveUniversePolicyPacketReport, ProjectionActiveUniversePolicyPacketRow } from "./projection-active-universe-policy-packet-types";
import type { ProjectionActiveUniverseGateRosterRefreshReport } from "./projection-active-universe-gate-roster-refresh-types";
import type { PreseasonProjectionSnapshot } from "./preseason-projection-snapshot-types";

export type ProjectionRookieTeamConfirmationStatus =
  | "rookie_team_confirmed"
  | "rookie_team_conflict"
  | "rookie_team_ambiguous_match"
  | "rookie_team_review_candidate"
  | "rookie_team_unmatched"
  | "rookie_team_source_missing";

export type ProjectionRookieTeamConfirmationMatchReason =
  | "player_id"
  | "sleeper_id"
  | "gsis_id"
  | "name_team"
  | "name_position"
  | "name_position_team"
  | "name_only_overlap"
  | "no_source"
  | "no_match";

export type ProjectionRookieTeamConfirmationRecommendation =
  | "rookie_team_confirmation_ready_for_h21_preview"
  | "rookie_team_confirmation_source_missing"
  | "rookie_team_confirmation_needs_review";

export type ProjectionRookieTeamConfirmationOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionRookieTeamConfirmationRow = ProjectionActiveUniversePolicyPacketRow & {
  rookieTeamStatus: ProjectionRookieTeamConfirmationStatus;
  matchReason: ProjectionRookieTeamConfirmationMatchReason;
  sourceTeam: string | null;
  sourceDraftClub: string | null;
  sourceCollege: string | null;
  sourcePlayerName: string | null;
  sourceRow: RookieTeamConfirmationSourceRow | null;
  previewPolicyClassification: ProjectionActiveUniversePolicyClassification;
  previewReasonCodes: string[];
};

export type ProjectionRookieTeamConfirmationReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    policyPacket: string;
    rosterRefresh: string;
    preseasonProjectionSnapshot: string;
    rookieTeamConfirmationSource: string | null;
  };
  sourceMissing: boolean;
  summary: {
    targetRookieNewUnmatchedRows: number;
    sourceRows: number;
    matchedRows: number;
    unmatchedRows: number;
    confirmedTeamRows: number;
    teamConflictRows: number;
    ambiguousMatchRows: number;
    reviewCandidateRows: number;
    invalidSourceRows: number;
    byStatus: Record<ProjectionRookieTeamConfirmationStatus, number>;
    byPosition: Record<string, Record<ProjectionRookieTeamConfirmationStatus, number>>;
    byTeam: Record<string, Record<ProjectionRookieTeamConfirmationStatus, number>>;
    byV82SafeSubset: Record<string, Record<ProjectionRookieTeamConfirmationStatus, number>>;
  };
  matchDiagnostics: {
    targetFieldCounts: {
      withPlayerId: number;
      withSleeperId: number;
      withGsisId: number;
      withPlayerName: number;
      withPosition: number;
      withTeam: number;
    };
    sourceFieldCounts: {
      withPlayerId: number;
      withSleeperId: number;
      withGsisId: number;
      withPlayerName: number;
      withPosition: number;
      withNflTeam: number;
    };
    candidateMatchCounts: {
      byExactPlayerId: number;
      bySleeperId: number;
      byGsisId: number;
      byNormalizedPlayerName: number;
      byNormalizedPlayerNamePosition: number;
      byNormalizedPlayerNameTeam: number;
      byNormalizedPlayerNamePositionTeam: number;
    };
    examples: {
      topTargetRows: ProjectionRookieTeamConfirmationExampleRow[];
      topSourceRows: ProjectionRookieTeamConfirmationSourceExampleRow[];
      normalizedNameOverlaps: ProjectionRookieTeamConfirmationOverlapExample[];
      nameOnlyMatchesRejected: ProjectionRookieTeamConfirmationRejectedExample[];
      sourceRowsWithNoTargetNameOverlap: ProjectionRookieTeamConfirmationSourceExampleRow[];
      targetRowsWithNoSourceNameOverlap: ProjectionRookieTeamConfirmationExampleRow[];
    };
  };
  h21IntegrationPreview: {
    wouldMoveTo: Record<ProjectionActiveUniversePolicyClassification, number>;
    confirmedRowsToActiveCandidate: number;
    conflictRowsToManualReview: number;
    heldForSourceExpansion: number;
    shadowOnlyRows: number;
    notes: string[];
  };
  rows: ProjectionRookieTeamConfirmationRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionRookieTeamConfirmationRecommendation;
  notes: string[];
};

export type ProjectionRookieTeamConfirmationExampleRow = {
  playerId: string;
  player: string;
  normalizedName: string;
  position: string;
  team: string | null;
  v82Path: string;
};

export type ProjectionRookieTeamConfirmationSourceExampleRow = {
  playerId: string | null;
  sleeperId: string | null;
  gsisId: string | null;
  playerName: string;
  normalizedName: string;
  position: string;
  nflTeam: string | null;
  draftClub: string | null;
};

export type ProjectionRookieTeamConfirmationOverlapExample = {
  normalizedName: string;
  targetPlayers: ProjectionRookieTeamConfirmationExampleRow[];
  sourcePlayers: ProjectionRookieTeamConfirmationSourceExampleRow[];
};

export type ProjectionRookieTeamConfirmationRejectedExample = {
  target: ProjectionRookieTeamConfirmationExampleRow;
  source: ProjectionRookieTeamConfirmationSourceExampleRow;
  reason: string;
};

export type ProjectionRookieTeamConfirmationInput = {
  options: ProjectionRookieTeamConfirmationOptions;
  policyPacket: ProjectionActiveUniversePolicyPacketReport;
  rosterRefresh: ProjectionActiveUniverseGateRosterRefreshReport;
  preseasonProjectionSnapshot: Pick<PreseasonProjectionSnapshot, "metadata" | "diagnostics" | "rows"> | null;
  rookieTeamConfirmationSource: RookieTeamConfirmationSourceReport | null;
  sourceArtifacts?: ProjectionRookieTeamConfirmationReport["sourceArtifacts"];
};

export type ProjectionRookieTeamConfirmationArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
