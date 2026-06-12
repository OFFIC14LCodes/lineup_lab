export type NflversePipelineMode = "dry_run" | "execute";
export type NflversePipelineStatus = "success" | "partial_failure" | "failure";

export type NflversePipelineOptions = {
  season: number;
  mode: NflversePipelineMode;
  projectRoot: string;
};

export type NflverseRowResult = {
  sourceRowNumber: number;
  rowSha256: string;
  gsisId: string;
  playerId: string | null;
  resolutionStatus: "resolved" | "unresolved" | "rejected" | "skipped";
  // "skipped_existing" is in-memory only; stored as null in football_source_rows
  writeStatus: "written" | "skipped_dry_run" | "skipped_existing" | "error" | null;
  canonicalKeyCount: number;
  errorMessage: string | null;
};

export type NflversePipelineCoverage = {
  totalSourceRows: number;
  filteredPositionRows: number;
  regularSeasonRows: number;
  resolvedRows: number;
  unresolvedRows: number;
  rejectedRows: number;
  // In execute mode: rows successfully inserted this run (excludes pre-existing)
  writtenRows: number;
  // Alias for writtenRows — rows newly inserted (not pre-existing)
  insertedRows: number;
  // Rows that already existed in the DB before this run (skipped, not re-written)
  existingRows: number;
  errorRows: number;
  uniqueGsisIds: number;
  resolvedGsisIds: number;
  unresolvedGsisIds: number;
  coverageByPosition: Record<string, { resolved: number; unresolved: number }>;
};

export type NflversePipelineReport = {
  season: number;
  mode: NflversePipelineMode;
  pipelineStatus: NflversePipelineStatus;
  sourceUrl: string;
  filePath: string;
  sha256: string;
  alreadyArchived: boolean;
  schemaValid: boolean;
  missingColumns: string[];
  sourceId: string | null;
  batchId: string | null;
  coverage: NflversePipelineCoverage;
  durationMs: number;
  completedAt: string;
};
