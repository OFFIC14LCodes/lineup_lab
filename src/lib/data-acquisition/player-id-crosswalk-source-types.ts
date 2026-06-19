export type PlayerIdCrosswalkConfidence =
  | "exact_id"
  | "source_declared"
  | "name_team_position"
  | "manual_review"
  | "unknown";

export type PlayerIdCrosswalkCanonicalField =
  | "sleeper_id"
  | "gsis_id"
  | "player_id"
  | "player_name"
  | "position"
  | "team"
  | "source"
  | "source_updated_at"
  | "confidence"
  | "notes";

export type PlayerIdCrosswalkSourceOptions = {
  season: number;
  inputPath: string;
};

export type PlayerIdCrosswalkSourceRow = {
  sleeperId: string;
  gsisId: string | null;
  playerId: string | null;
  playerName: string | null;
  normalizedName: string | null;
  position: string | null;
  team: string | null;
  source: string;
  sourceUpdatedAt: string | null;
  confidence: PlayerIdCrosswalkConfidence;
  notes: string | null;
  matchKey: string;
};

export type PlayerIdCrosswalkSourceIssue = {
  rowNumber: number;
  sleeperId: string | null;
  playerName: string | null;
  issue: string;
  detail: string;
};

export type PlayerIdCrosswalkSourceReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  season: number;
  inputPath: string;
  sourceRows: number;
  normalizedRows: number;
  duplicateRowsRemoved: number;
  invalidRows: number;
  missingGsisRows: number;
  conflictGroups: {
    sleeperIdToMultipleGsis: Record<string, string[]>;
    gsisIdToMultipleSleeper: Record<string, string[]>;
  };
  confidenceCounts: Record<PlayerIdCrosswalkConfidence, number>;
  rows: PlayerIdCrosswalkSourceRow[];
  issues: PlayerIdCrosswalkSourceIssue[];
  notes: string[];
};

export type PlayerIdCrosswalkSourceArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
