export type NflversePlayersRaw = Record<string, string>;

// Minimum columns required for H1.5 identity bootstrap
export const NFLVERSE_PLAYERS_REQUIRED_COLUMNS = [
  "gsis_id",
  "display_name",
  "position_group",
  "position",
  "espn_id",
  "latest_team",
  "status",
  "last_season"
] as const;

export type NflversePlayersSchemaResult = {
  valid: boolean;
  missingColumns: string[];
};

export function validateNflversePlayersSchema(columns: string[]): NflversePlayersSchemaResult {
  const columnSet = new Set(columns);
  const missingColumns = NFLVERSE_PLAYERS_REQUIRED_COLUMNS.filter((col) => !columnSet.has(col));
  return { valid: missingColumns.length === 0, missingColumns };
}
