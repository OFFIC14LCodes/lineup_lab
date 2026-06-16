import { normalizePlayerName, normalizePrimaryPosition, normalizeTeam } from "@/lib/players/normalize";

import { nflverseNumber, nflverseString } from "./nflverse-csv-loader";

export type BlackbirdNflversePosition = "QB" | "RB" | "WR" | "TE" | "K" | "DST" | "DL" | "LB" | "DB";

export type NflverseIdentityIds = {
  gsisId: string | null;
  espnId: string | null;
  pfrId: string | null;
  nflId: string | null;
  smartId: string | null;
  sleeperId?: string | null;
};

export type NflversePlayerRecord = {
  playerId: string;
  playerName: string;
  searchName: string;
  position: BlackbirdNflversePosition | null;
  rawPosition: string | null;
  rawPositionGroup: string | null;
  team: string | null;
  ids: NflverseIdentityIds;
  birthDate: string | null;
  height: number | null;
  weight: number | null;
  college: string | null;
  yearsExperience: number | null;
  rookieSeason: number | null;
  lastSeason: number | null;
  draft: {
    year: number | null;
    round: number | null;
    pick: number | null;
    team: string | null;
  };
};

export type NflverseRosterRecord = {
  season: number | null;
  week: number | null;
  playerId: string;
  playerName: string;
  position: BlackbirdNflversePosition | null;
  rawPosition: string | null;
  depthChartPosition: string | null;
  team: string | null;
  status: string | null;
  ids: NflverseIdentityIds;
  yearsExperience: number | null;
  rookieYear: number | null;
};

export type NflverseWeeklyStatRecord = {
  season: number | null;
  week: number | null;
  playerId: string;
  playerName: string;
  position: BlackbirdNflversePosition | null;
  rawPosition: string | null;
  positionGroup: string | null;
  team: string | null;
  opponentTeam: string | null;
  offensiveStats: Record<string, number | null>;
  defensiveStats: Record<string, number | null>;
  kickingStats: Record<string, number | null>;
  fantasyPoints: number | null;
  fantasyPointsPpr: number | null;
};

const OFFENSIVE_STAT_COLUMNS = [
  "completions",
  "attempts",
  "passing_yards",
  "passing_tds",
  "passing_interceptions",
  "sacks_suffered",
  "carries",
  "rushing_yards",
  "rushing_tds",
  "receptions",
  "targets",
  "receiving_yards",
  "receiving_tds",
  "target_share",
  "air_yards_share",
  "wopr",
];

const DEFENSIVE_STAT_COLUMNS = [
  "def_tackles_solo",
  "def_tackles_with_assist",
  "def_tackle_assists",
  "def_tackles_for_loss",
  "def_tackles_for_loss_yards",
  "def_fumbles_forced",
  "def_sacks",
  "def_sack_yards",
  "def_qb_hits",
  "def_interceptions",
  "def_interception_yards",
  "def_pass_defended",
  "def_tds",
  "def_fumbles",
  "def_safeties",
];

const KICKING_STAT_COLUMNS = [
  "fg_made",
  "fg_att",
  "fg_missed",
  "fg_blocked",
  "fg_made_0_19",
  "fg_made_20_29",
  "fg_made_30_39",
  "fg_made_40_49",
  "fg_made_50_59",
  "fg_made_60_",
  "pat_made",
  "pat_att",
  "pat_missed",
  "pat_blocked",
];

export function normalizeNflversePosition(rawPosition?: string | null, rawPositionGroup?: string | null): BlackbirdNflversePosition | null {
  const normalized = normalizePrimaryPosition(rawPosition);
  if (normalized === "DEF") return "DST";
  if (normalized) return normalized;

  const normalizedGroup = normalizePrimaryPosition(rawPositionGroup);
  if (normalizedGroup === "DEF") return "DST";
  if (normalizedGroup) return normalizedGroup;

  const value = `${rawPosition ?? ""} ${rawPositionGroup ?? ""}`.toUpperCase();
  if (/\b(DL|DE|DT|NT|EDGE)\b/.test(value)) return "DL";
  if (/\b(LB|ILB|OLB|MLB)\b/.test(value)) return "LB";
  if (/\b(DB|CB|S|FS|SS)\b/.test(value)) return "DB";
  return null;
}

export function isFantasyRelevantNflversePosition(position: BlackbirdNflversePosition | null): position is BlackbirdNflversePosition {
  return position === "QB" || position === "RB" || position === "WR" || position === "TE" || position === "K" || position === "DST" || position === "DL" || position === "LB" || position === "DB";
}

export function normalizeNflversePlayer(row: Record<string, unknown>): NflversePlayerRecord {
  const playerName = nflverseString(row.display_name) ?? nflverseString(row.full_name) ?? "Unknown player";
  const ids = identityIds(row);
  return {
    playerId: ids.gsisId ?? ids.nflId ?? ids.smartId ?? ids.espnId ?? normalizePlayerName(playerName),
    playerName,
    searchName: normalizePlayerName(playerName),
    position: normalizeNflversePosition(nflverseString(row.position), nflverseString(row.position_group)),
    rawPosition: nflverseString(row.position),
    rawPositionGroup: nflverseString(row.position_group),
    team: normalizeTeam(nflverseString(row.latest_team)),
    ids,
    birthDate: nflverseString(row.birth_date),
    height: nflverseNumber(row.height),
    weight: nflverseNumber(row.weight),
    college: nflverseString(row.college_name),
    yearsExperience: nflverseNumber(row.years_of_experience),
    rookieSeason: nflverseNumber(row.rookie_season),
    lastSeason: nflverseNumber(row.last_season),
    draft: {
      year: nflverseNumber(row.draft_year),
      round: nflverseNumber(row.draft_round),
      pick: nflverseNumber(row.draft_pick),
      team: normalizeTeam(nflverseString(row.draft_team)),
    },
  };
}

export function normalizeNflverseRoster(row: Record<string, unknown>): NflverseRosterRecord {
  const playerName = nflverseString(row.full_name) ?? "Unknown player";
  const ids = identityIds(row);
  return {
    season: nflverseNumber(row.season),
    week: nflverseNumber(row.week),
    playerId: ids.gsisId ?? ids.smartId ?? ids.espnId ?? normalizePlayerName(playerName),
    playerName,
    position: normalizeNflversePosition(nflverseString(row.position), nflverseString(row.ngs_position)),
    rawPosition: nflverseString(row.position),
    depthChartPosition: nflverseString(row.depth_chart_position),
    team: normalizeTeam(nflverseString(row.team)),
    status: nflverseString(row.status),
    ids,
    yearsExperience: nflverseNumber(row.years_exp),
    rookieYear: nflverseNumber(row.rookie_year),
  };
}

export function normalizeNflverseWeeklyStat(row: Record<string, unknown>): NflverseWeeklyStatRecord {
  const playerName = nflverseString(row.player_display_name) ?? nflverseString(row.player_name) ?? "Unknown player";
  return {
    season: nflverseNumber(row.season),
    week: nflverseNumber(row.week),
    playerId: nflverseString(row.player_id) ?? normalizePlayerName(playerName),
    playerName,
    position: normalizeNflversePosition(nflverseString(row.position), nflverseString(row.position_group)),
    rawPosition: nflverseString(row.position),
    positionGroup: nflverseString(row.position_group),
    team: normalizeTeam(nflverseString(row.team)),
    opponentTeam: normalizeTeam(nflverseString(row.opponent_team)),
    offensiveStats: pickNumberColumns(row, OFFENSIVE_STAT_COLUMNS),
    defensiveStats: pickNumberColumns(row, DEFENSIVE_STAT_COLUMNS),
    kickingStats: pickNumberColumns(row, KICKING_STAT_COLUMNS),
    fantasyPoints: nflverseNumber(row.fantasy_points),
    fantasyPointsPpr: nflverseNumber(row.fantasy_points_ppr),
  };
}

export function hasPositiveStat(stats: Record<string, number | null>): boolean {
  return Object.values(stats).some((value) => typeof value === "number" && value > 0);
}

export function offensiveStatColumns(): string[] {
  return [...OFFENSIVE_STAT_COLUMNS];
}

export function defensiveStatColumns(): string[] {
  return [...DEFENSIVE_STAT_COLUMNS];
}

export function kickingStatColumns(): string[] {
  return [...KICKING_STAT_COLUMNS];
}

function identityIds(row: Record<string, unknown>): NflverseIdentityIds {
  return {
    gsisId: nflverseString(row.gsis_id),
    espnId: nflverseString(row.espn_id),
    pfrId: nflverseString(row.pfr_id),
    nflId: nflverseString(row.nfl_id),
    smartId: nflverseString(row.smart_id),
    sleeperId: nflverseString(row.sleeper_id),
  };
}

function pickNumberColumns(row: Record<string, unknown>, columns: string[]): Record<string, number | null> {
  return Object.fromEntries(columns.map((column) => [column, nflverseNumber(row[column])]));
}
