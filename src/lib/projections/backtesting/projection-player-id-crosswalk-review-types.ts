import type { CurrentRosterSourceReport, CurrentRosterSourceRow } from "@/lib/data-acquisition/current-roster-source-types";
import type { PlayerIdCrosswalkConfidence, PlayerIdCrosswalkSourceReport } from "@/lib/data-acquisition/player-id-crosswalk-source-types";
import type { RookieTeamConfirmationSourceReport, RookieTeamConfirmationSourceRow } from "@/lib/data-acquisition/rookie-team-confirmation-source-types";
import type { SleeperNormalizedPlayer } from "@/lib/data-acquisition/sleeper/sleeper-player-types";

import type { ProjectionRookieNewTargetDiagnosticsReport, ProjectionRookieNewTargetDiagnosticsRow } from "./projection-rookie-new-target-diagnostics-types";

export type ProjectionPlayerIdCrosswalkStatus =
  | "crosswalk_confirmed"
  | "crosswalk_conflict"
  | "crosswalk_missing"
  | "crosswalk_ambiguous"
  | "crosswalk_review_candidate"
  | "source_missing";

export type ProjectionPlayerIdCrosswalkIntegrationPreview =
  | "use_current_roster_source"
  | "use_rookie_team_confirmation_source"
  | "manual_review"
  | "still_needs_crosswalk";

export type ProjectionPlayerIdCrosswalkRecommendation =
  | "player_id_crosswalk_ready_for_source_integration_preview"
  | "player_id_crosswalk_needs_review"
  | "player_id_crosswalk_source_missing";

export type ProjectionPlayerIdCrosswalkReviewOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionPlayerIdCrosswalkEvidence = {
  source: "sleeper_metadata" | "snapshot" | "csv_crosswalk" | "name_team_position";
  sleeperId: string;
  gsisId: string | null;
  playerId: string | null;
  playerName: string | null;
  position: string | null;
  team: string | null;
  confidence: PlayerIdCrosswalkConfidence;
  confirmed: boolean;
  detail: string;
};

export type ProjectionPlayerIdCrosswalkReviewRow = {
  playerId: string;
  sleeperId: string | null;
  originalGsisId: string | null;
  crosswalkGsisId: string | null;
  player: string;
  normalizedName: string;
  position: string;
  team: string | null;
  h23SourceStrategy: string;
  v82SafeSubsetStatus: string;
  status: ProjectionPlayerIdCrosswalkStatus;
  confidence: PlayerIdCrosswalkConfidence;
  evidenceSources: string[];
  reasonCodes: string[];
  linkedCurrentRosterRow: CurrentRosterSourceRow | null;
  linkedRookieTeamRow: RookieTeamConfirmationSourceRow | null;
  integrationPreview: ProjectionPlayerIdCrosswalkIntegrationPreview;
  projectedTotalPointDelta: number | null;
  estimatedOverallRankMovement: number | null;
};

export type ProjectionPlayerIdCrosswalkReviewReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    rookieNewTargetDiagnostics: string;
    playerIdCrosswalkSource: string | null;
    sleeperPlayers: string | null;
    currentRosterSource: string | null;
    rookieTeamConfirmationSource: string | null;
  };
  sourceMissing: boolean;
  summary: {
    targetRows: number;
    confirmedRows: number;
    conflictRows: number;
    ambiguousRows: number;
    reviewCandidateRows: number;
    missingRows: number;
    byStatus: Record<ProjectionPlayerIdCrosswalkStatus, number>;
    byIntegrationPreview: Record<ProjectionPlayerIdCrosswalkIntegrationPreview, number>;
  };
  sourceCoverage: {
    sleeperMetadataRows: number;
    sleeperMetadataRowsWithGsis: number;
    csvCrosswalkRows: number;
    csvConfirmedRows: number;
    snapshotBridgeRows: number;
    targetRowsWithSleeperId: number;
    targetRowsWithSnapshotGsis: number;
  };
  h21IntegrationPreview: {
    wouldRouteTo: Record<ProjectionPlayerIdCrosswalkIntegrationPreview, number>;
    notes: string[];
  };
  examples: {
    confirmedRows: ProjectionPlayerIdCrosswalkReviewRow[];
    conflictRows: ProjectionPlayerIdCrosswalkReviewRow[];
    ambiguousRows: ProjectionPlayerIdCrosswalkReviewRow[];
    reviewCandidateRows: ProjectionPlayerIdCrosswalkReviewRow[];
    missingRows: ProjectionPlayerIdCrosswalkReviewRow[];
  };
  rows: ProjectionPlayerIdCrosswalkReviewRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionPlayerIdCrosswalkRecommendation;
  notes: string[];
};

export type ProjectionPlayerIdCrosswalkReviewInput = {
  options: ProjectionPlayerIdCrosswalkReviewOptions;
  rookieNewTargetDiagnostics: ProjectionRookieNewTargetDiagnosticsReport | null;
  playerIdCrosswalkSource: PlayerIdCrosswalkSourceReport | null;
  sleeperPlayers: SleeperNormalizedPlayer[];
  currentRosterSource: CurrentRosterSourceReport | null;
  rookieTeamConfirmationSource: RookieTeamConfirmationSourceReport | null;
  sourceArtifacts?: ProjectionPlayerIdCrosswalkReviewReport["sourceArtifacts"];
};

export type ProjectionPlayerIdCrosswalkArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};

export type ProjectionPlayerIdCrosswalkTargetRow = ProjectionRookieNewTargetDiagnosticsRow;
