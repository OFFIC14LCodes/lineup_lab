export type TeamGamePipelineMode = "dry_run" | "execute";

export type TeamGamePipelineStatus =
  | "success"
  | "partial_failure"
  | "failure"
  | "schema_error";

export type TeamGamePipelineOptions = {
  season: number;
  mode: TeamGamePipelineMode;
  projectRoot: string;
};

// One team's perspective on a single game, ready to write to team_game_stats.
export type TeamGameRow = {
  gameId: string;
  season: number;
  week: number;
  seasonType: "REG";
  teamId: string;
  opponentId: string;
  isHome: boolean;
  pointsScored: number;
  pointsAllowed: number;
  offensiveYards: number | null;
  yardsAllowed: number | null;
  isFinal: boolean;
};

export type TeamGameWriteResult = {
  gameId: string;
  teamId: string;
  writeStatus:
    | "insert_required"
    | "update_required"
    | "unchanged"
    | "conflict"
    | "inserted"
    | "updated"
    | "skipped_dry_run"
    | "error";
  errorMessage: string | null;
  semanticHash?: string | null;
  existingSemanticHash?: string | null;
};

export type TeamGamePipelineCoverage = {
  totalScheduleRows: number;
  filteredGames: number;
  skippedNonReg: number;
  skippedNoScore: number;
  skippedBadTeam: number;
  teamGameRowsBuilt: number;
  rowsDerived: number;
  rowsExisting: number;
  rowsInserted: number;
  rowsUpdated: number;
  rowsUnchanged: number;
  rowsConflicted: number;
  rowsMissing: number;
  rowsUnexpected: number;
  exactSemanticMatches: number;
  semanticDifferences: number;
  duplicateNaturalKeys: number;
  writeAttempts: number;
  writeErrors: number;
  pbpGamesFound: number;
  pbpGamesMissing: number;
};

export type TeamGameInvariantViolation = {
  gameId: string;
  violation: string;
};

export type TeamGamePipelineReport = {
  season: number;
  mode: TeamGamePipelineMode;
  pipelineStatus: TeamGamePipelineStatus;
  schedulesUrl: string;
  schedulesFilePath: string;
  schedulesSha256: string;
  schedulesAlreadyArchived: boolean;
  schedulesSchemaValid: boolean;
  schedulesMissingColumns: string[];
  pbpFilePath: string | null;
  pbpSchemaValid: boolean;
  sourceId: string | null;
  batchId: string | null;
  coverage: TeamGamePipelineCoverage;
  invariantViolations: TeamGameInvariantViolation[];
  writeResults: TeamGameWriteResult[];
  durationMs: number;
  completedAt: string;
};
