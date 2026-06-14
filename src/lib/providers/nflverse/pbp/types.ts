import type { InvariantViolation } from "./derive";

export type PbpPipelineMode = "dry_run" | "execute";
export type PbpPipelineStatus = "success" | "partial_failure" | "failure";

export type PbpPipelineOptions = {
  season: number;
  mode: PbpPipelineMode;
  projectRoot: string;
};

export type PbpPlayerWeekResult = {
  gsisId: string;
  playerId: string | null;
  week: number;
  resolutionStatus: "resolved" | "unresolved";
  writeStatus: "written" | "skipped_dry_run" | "skipped_existing" | "error" | null;
  rec_td_40p: number;
  rec_td_50p: number;
  rush_td_40p: number;
  rush_td_50p: number;
  pass_pick6: number;
  fum_ret_td: number;
  errorMessage: string | null;
};

export type PbpPipelineCoverage = {
  totalSourcePlays: number;
  regularSeasonPlays: number;
  excludedPlays: number;
  unresolvedPlays: number;
  totalPlayerWeeks: number;
  resolvedPlayerWeeks: number;
  unresolvedPlayerWeeks: number;
  writtenPlayerWeeks: number;
  existingPlayerWeeks: number;
  errorPlayerWeeks: number;
  uniqueGsisIds: number;
  resolvedGsisIds: number;
  unresolvedGsisIds: number;
  fumRetTdCandidatePlays: number;
  fumRetTdQualifiedPlays: number;
  fumRetTdAmbiguousPlays: number;
  fumRetTdExcludedPlays: number;
  fumRetTdResolvedPlayerWeeks: number;
  fumRetTdUnresolvedPlayerWeeks: number;
  fumRetTdWrittenRows: number;
  fumRetTdExistingRows: number;
  fumRetTdFailedRows: number;
};

export type FumRetTdAuditRecord = {
  gameId: string;
  week: number;
  playId: string;
  playType: string | null;
  description: string;
  recoveryPlayerGsisId: string | null;
  recoveryPlayerName: string | null;
  recoveryTeam: string | null;
  touchdownPlayerGsisId: string | null;
  touchdownPlayerName: string | null;
  touchdownTeam: string | null;
  recoveryYards: number | null;
  reason: string;
  canonicalPlayerId?: string | null;
  resolutionFailureReason?: string | null;
};

export type PbpPipelineReport = {
  season: number;
  mode: PbpPipelineMode;
  pipelineStatus: PbpPipelineStatus;
  sourceUrl: string;
  filePath: string;
  sha256: string;
  alreadyArchived: boolean;
  schemaValid: boolean;
  missingColumns: string[];
  sourceId: string | null;
  batchId: string | null;
  coverage: PbpPipelineCoverage;
  invariantViolations: InvariantViolation[];
  fumRetTdQualifiedEvents: FumRetTdAuditRecord[];
  fumRetTdExcludedEvents: FumRetTdAuditRecord[];
  fumRetTdIdentityUnresolvedEvents: FumRetTdAuditRecord[];
  durationMs: number;
  completedAt: string;
};
