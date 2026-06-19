export type RookieTeamConfirmationCanonicalField =
  | "player_id"
  | "sleeper_id"
  | "gsis_id"
  | "player_name"
  | "position"
  | "college"
  | "nfl_team"
  | "draft_club"
  | "draft_round"
  | "draft_pick"
  | "source"
  | "source_updated_at"
  | "notes";

export type RookieTeamConfirmationSourceOptions = {
  season: number;
  inputPath: string;
};

export type RookieTeamConfirmationSourceRow = {
  playerId: string | null;
  sleeperId: string | null;
  gsisId: string | null;
  playerName: string;
  normalizedName: string;
  position: string;
  college: string | null;
  normalizedCollege: string | null;
  nflTeam: string | null;
  draftClub: string | null;
  draftRound: number | null;
  draftPick: number | null;
  source: string;
  sourceUpdatedAt: string | null;
  notes: string | null;
  matchKey: string;
};

export type RookieTeamConfirmationSourceIssue = {
  rowNumber: number;
  playerName: string | null;
  issue: string;
  detail: string;
};

export type RookieTeamConfirmationSourceReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  season: number;
  inputPath: string;
  sourceRows: number;
  normalizedRows: number;
  duplicateRowsRemoved: number;
  invalidRows: number;
  missingIdentifierRows: number;
  positionCounts: Record<string, number>;
  teamCounts: Record<string, number>;
  rows: RookieTeamConfirmationSourceRow[];
  issues: RookieTeamConfirmationSourceIssue[];
  notes: string[];
};

export type RookieTeamConfirmationSourceInspectReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  inputPath: string;
  headers: string[];
  sampleRows: Array<Record<string, unknown>>;
  directMappedFields: Partial<Record<RookieTeamConfirmationCanonicalField, string>>;
  missingRequiredFields: RookieTeamConfirmationCanonicalField[];
  missingRecommendedFields: RookieTeamConfirmationCanonicalField[];
  suggestedMapping: Partial<Record<RookieTeamConfirmationCanonicalField, string>>;
  notes: string[];
};

export type RookieTeamConfirmationSourceArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
