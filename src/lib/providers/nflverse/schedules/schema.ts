// Column definitions for the nflverse schedules CSV.
// Source: https://github.com/nflverse/nflverse-data/releases/download/schedules/schedules.csv

// Columns required for H5 team-game stats ingestion.
export const SCHEDULES_REQUIRED_COLUMNS = [
  "game_id",
  "season",
  "game_type",
  "week",
  "home_team",
  "away_team",
  "home_score",
  "away_score",
] as const;

export type SchedulesRequiredColumn = (typeof SCHEDULES_REQUIRED_COLUMNS)[number];

export type SchedulesSchemaValidationResult = {
  valid: boolean;
  missingColumns: string[];
};

export function validateSchedulesSchema(columns: string[]): SchedulesSchemaValidationResult {
  const columnSet = new Set(columns);
  const missingColumns = SCHEDULES_REQUIRED_COLUMNS.filter((col) => !columnSet.has(col));
  return {
    valid: missingColumns.length === 0,
    missingColumns,
  };
}

// Raw row from the schedules CSV (all fields are strings before parsing).
export type SchedulesRawRow = Record<string, string>;

// A validated, typed schedule row for a completed game.
export type ScheduleGameRow = {
  gameId: string;
  season: number;
  gameType: string;
  week: number;
  homeTeamRaw: string;
  awayTeamRaw: string;
  homeScore: number;
  awayScore: number;
};

// Parse and validate a raw schedules CSV row.
// Returns null if the row is not a final regular-season game (missing scores or non-REG type).
export function parseScheduleRow(raw: SchedulesRawRow): ScheduleGameRow | null {
  const gameId = raw["game_id"]?.trim();
  const gameType = raw["game_type"]?.trim();
  const seasonStr = raw["season"]?.trim();
  const weekStr = raw["week"]?.trim();
  const homeTeamRaw = raw["home_team"]?.trim();
  const awayTeamRaw = raw["away_team"]?.trim();
  const homeScoreStr = raw["home_score"]?.trim();
  const awayScoreStr = raw["away_score"]?.trim();

  if (!gameId || !gameType || !seasonStr || !weekStr || !homeTeamRaw || !awayTeamRaw) return null;

  // Only import regular-season games.
  if (gameType !== "REG") return null;

  const season = parseInt(seasonStr, 10);
  const week = parseInt(weekStr, 10);
  if (!Number.isFinite(season) || !Number.isFinite(week)) return null;

  // Scores absent means the game has not been played yet.
  if (!homeScoreStr || homeScoreStr === "NA" || !awayScoreStr || awayScoreStr === "NA") return null;

  const homeScore = parseInt(homeScoreStr, 10);
  const awayScore = parseInt(awayScoreStr, 10);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
  if (homeScore < 0 || awayScore < 0) return null;

  return { gameId, season, gameType, week, homeTeamRaw, awayTeamRaw, homeScore, awayScore };
}
