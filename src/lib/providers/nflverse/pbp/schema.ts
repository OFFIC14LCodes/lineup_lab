// Exact column names from the nflverse play-by-play CSV release.
// Source: https://github.com/nflverse/nflverse-data/releases/tag/pbp
// Field semantics follow the nflverse data dictionary (nflreadr::field_descriptions).

export type NflversePbpRaw = Record<string, string>;

// Columns required for H2 derivation. Schema validation fails if any are absent.
export const PBP_REQUIRED_COLUMNS = [
  // Play identity
  "play_id",
  "game_id",
  "season",
  "week",
  "season_type",
  // Teams
  "posteam",
  "defteam",
  // Play classification
  "play_type",
  // Yardage (used as touchdown distance)
  "yards_gained",
  // Touchdown indicators
  "touchdown",
  "pass_touchdown",
  "rush_touchdown",
  "return_touchdown",
  // Interception
  "interception",
  // Exclusion indicators
  "two_point_attempt",
  "play_deleted",
  "penalty",
  // Touchdown attribution
  "td_player_id",
  "td_team",
  // Offensive player IDs
  "passer_player_id",
  "rusher_player_id",
  "receiver_player_id",
  // Names (for diagnostic reporting only — not used in derivation logic)
  "passer_player_name",
  "rusher_player_name",
  "receiver_player_name",
  "td_player_name"
] as const;

export type PbpRequiredColumn = (typeof PBP_REQUIRED_COLUMNS)[number];

export type PbpSchemaValidationResult = {
  valid: boolean;
  missingColumns: string[];
};

export function validatePbpSchema(columns: string[]): PbpSchemaValidationResult {
  const columnSet = new Set(columns);
  const missingColumns = PBP_REQUIRED_COLUMNS.filter((col) => !columnSet.has(col));
  return {
    valid: missingColumns.length === 0,
    missingColumns
  };
}

// Parse a PBP numeric field: returns the number or null for empty/NA/non-finite values.
export function parsePbpNumeric(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "NA" || trimmed === "NaN" || trimmed === "NULL") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return n;
}

// Parse a PBP indicator column (0/1 or "0"/"1") returning a boolean.
export function parsePbpFlag(raw: string | undefined): boolean {
  return parsePbpNumeric(raw) === 1;
}

// Parse a PBP string field, returning null for empty/NA values.
export function parsePbpString(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "NA" || trimmed === "NULL") return null;
  return trimmed;
}

// nflverse season_type values that count as regular season.
export const PBP_REGULAR_SEASON_TYPE = "REG";
