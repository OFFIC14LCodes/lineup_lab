export type NflversePlayerStatsRaw = Record<string, string>;

export const NFLVERSE_SUPPORTED_POSITION_GROUPS = new Set(["QB", "RB", "WR", "TE"]);

// nflverse season_type values
export const NFLVERSE_SEASON_TYPE_MAP: Record<string, string> = {
  REG: "regular",
  POST: "postseason",
  PRE: "preseason"
};

// Columns required for H1 ingestion. Schema validation fails if any are absent.
export const NFLVERSE_REQUIRED_COLUMNS = [
  "player_id",
  "player_display_name",
  "position_group",
  "team",
  "season",
  "week",
  "season_type",
  "opponent_team",
  "completions",
  "attempts",
  "passing_yards",
  "passing_tds",
  "passing_interceptions",
  "sacks_suffered",
  "passing_first_downs",
  "passing_2pt_conversions",
  "sack_fumbles",
  "carries",
  "rushing_yards",
  "rushing_tds",
  "rushing_fumbles",
  "rushing_fumbles_lost",
  "rushing_first_downs",
  "rushing_2pt_conversions",
  "receptions",
  "targets",
  "receiving_yards",
  "receiving_tds",
  "receiving_fumbles",
  "receiving_fumbles_lost",
  "receiving_first_downs",
  "receiving_2pt_conversions",
  "sack_fumbles_lost",
  "punt_return_yards",
  "kickoff_return_yards",
  "special_teams_tds",
  "fantasy_points",
  "fantasy_points_ppr"
] as const;

export type NflverseSchemaValidationResult = {
  valid: boolean;
  missingColumns: string[];
};

export function validateNflverseSchema(columns: string[]): NflverseSchemaValidationResult {
  const columnSet = new Set(columns);
  const missingColumns = NFLVERSE_REQUIRED_COLUMNS.filter((col) => !columnSet.has(col));
  return {
    valid: missingColumns.length === 0,
    missingColumns
  };
}
