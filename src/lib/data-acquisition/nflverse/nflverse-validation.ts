import { NFLVERSE_FILES, type NflverseFileKey, readNflverseCsv } from "./nflverse-csv-loader";

export const NFLVERSE_REQUIRED_COLUMNS: Record<NflverseFileKey, string[]> = {
  players: [
    "gsis_id",
    "display_name",
    "position_group",
    "position",
    "nfl_id",
    "pfr_id",
    "espn_id",
    "smart_id",
    "birth_date",
    "height",
    "weight",
    "college_name",
    "latest_team",
    "years_of_experience",
    "rookie_season",
    "draft_year",
    "draft_round",
    "draft_pick",
    "draft_team",
  ],
  rosters: [
    "season",
    "team",
    "position",
    "depth_chart_position",
    "full_name",
    "gsis_id",
    "espn_id",
    "pfr_id",
    "sleeper_id",
    "smart_id",
    "years_exp",
    "rookie_year",
    "draft_club",
    "draft_number",
    "week",
    "game_type",
  ],
  playerStats: [
    "player_id",
    "player_display_name",
    "position",
    "position_group",
    "season",
    "week",
    "team",
    "opponent_team",
    "passing_yards",
    "passing_tds",
    "carries",
    "rushing_yards",
    "targets",
    "receptions",
    "receiving_yards",
    "def_tackles_solo",
    "def_sacks",
    "fantasy_points",
    "fantasy_points_ppr",
  ],
  schedules: [
    "game_id",
    "season",
    "game_type",
    "week",
    "gameday",
    "away_team",
    "home_team",
    "away_score",
    "home_score",
    "away_qb_id",
    "home_qb_id",
  ],
};

export type NflverseFileValidationResult = {
  fileKey: NflverseFileKey;
  fileName: string;
  exists: boolean;
  rowCount: number;
  fieldCount: number;
  requiredColumns: string[];
  missingColumns: string[];
  parseErrors: string[];
};

export function validateNflverseFile(fileKey: NflverseFileKey, dataDir?: string): NflverseFileValidationResult {
  const csv = readNflverseCsv(fileKey, dataDir);
  const fieldSet = new Set(csv.fields);
  const requiredColumns = NFLVERSE_REQUIRED_COLUMNS[fileKey];

  return {
    fileKey,
    fileName: NFLVERSE_FILES[fileKey],
    exists: csv.exists,
    rowCount: csv.rows.length,
    fieldCount: csv.fields.length,
    requiredColumns,
    missingColumns: requiredColumns.filter((column) => !fieldSet.has(column)),
    parseErrors: csv.parseErrors,
  };
}

export function validateAllNflverseFiles(dataDir?: string): Record<NflverseFileKey, NflverseFileValidationResult> {
  return {
    players: validateNflverseFile("players", dataDir),
    rosters: validateNflverseFile("rosters", dataDir),
    playerStats: validateNflverseFile("playerStats", dataDir),
    schedules: validateNflverseFile("schedules", dataDir),
  };
}
