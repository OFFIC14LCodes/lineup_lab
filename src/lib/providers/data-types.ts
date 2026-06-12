import type { ProviderName } from "@/lib/providers/types";

export const SEASON_TYPES = ["preseason", "regular", "postseason"] as const;
export const PROJECTION_TYPES = ["preseason", "season", "weekly", "rest_of_season"] as const;
export const HOME_AWAY_VALUES = ["home", "away"] as const;

export type SeasonType = (typeof SEASON_TYPES)[number];
export type ProjectionType = (typeof PROJECTION_TYPES)[number];
export type HomeAway = (typeof HOME_AWAY_VALUES)[number];
export type ProviderStatsJsonValue = number | string | boolean | null;
export type ProviderStatsJson = Record<string, ProviderStatsJsonValue>;

export type PlayerWeeklyStatsRow = {
  id: string;
  player_id: string;
  provider: ProviderName;
  provider_external_id: string | null;
  season: number;
  week: number;
  season_type: SeasonType;
  game_id: string | null;
  team: string | null;
  opponent: string | null;
  position_group: string | null;
  home_away: HomeAway | null;
  game_date: string | null;
  stats_json: ProviderStatsJson;
  provider_fantasy_points: number | null;
  source_updated_at: string | null;
  ingested_at: string;
  data_version: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PlayerWeeklyStatsInsert = {
  player_id: string;
  provider: ProviderName;
  provider_external_id?: string | null;
  season: number;
  week: number;
  season_type?: SeasonType;
  game_id?: string | null;
  team?: string | null;
  opponent?: string | null;
  position_group?: string | null;
  home_away?: HomeAway | null;
  game_date?: string | null;
  stats_json: ProviderStatsJson;
  provider_fantasy_points?: number | null;
  source_updated_at?: string | null;
  ingested_at?: string;
  data_version?: string | null;
  metadata_json?: Record<string, unknown>;
};

export type PlayerSeasonStatsRow = {
  id: string;
  player_id: string;
  provider: ProviderName;
  provider_external_id: string | null;
  season: number;
  season_type: SeasonType;
  team: string | null;
  position_group: string | null;
  games_played: number | null;
  games_started: number | null;
  stats_json: ProviderStatsJson;
  provider_fantasy_points: number | null;
  source_updated_at: string | null;
  ingested_at: string;
  data_version: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PlayerSeasonStatsInsert = {
  player_id: string;
  provider: ProviderName;
  provider_external_id?: string | null;
  season: number;
  season_type?: SeasonType;
  team?: string | null;
  position_group?: string | null;
  games_played?: number | null;
  games_started?: number | null;
  stats_json: ProviderStatsJson;
  provider_fantasy_points?: number | null;
  source_updated_at?: string | null;
  ingested_at?: string;
  data_version?: string | null;
  metadata_json?: Record<string, unknown>;
};

export type PlayerProjectionRow = {
  id: string;
  player_id: string;
  provider: ProviderName;
  provider_external_id: string | null;
  season: number;
  week: number | null;
  season_type: SeasonType;
  projection_type: ProjectionType;
  scoring_format: string | null;
  position_group: string | null;
  team: string | null;
  opponent: string | null;
  stats_json: ProviderStatsJson;
  provider_fantasy_points: number | null;
  source_updated_at: string | null;
  ingested_at: string;
  version: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PlayerProjectionInsert = {
  player_id: string;
  provider: ProviderName;
  provider_external_id?: string | null;
  season: number;
  week?: number | null;
  season_type?: SeasonType;
  projection_type: ProjectionType;
  scoring_format?: string | null;
  position_group?: string | null;
  team?: string | null;
  opponent?: string | null;
  stats_json: ProviderStatsJson;
  provider_fantasy_points?: number | null;
  source_updated_at?: string | null;
  ingested_at?: string;
  version?: string;
  metadata_json?: Record<string, unknown>;
};

export type PlayerInjuryRow = {
  id: string;
  player_id: string;
  provider: ProviderName;
  provider_external_id: string | null;
  season: number | null;
  week: number | null;
  team: string | null;
  status: string | null;
  practice_status: string | null;
  game_status: string | null;
  body_part: string | null;
  injury_type: string | null;
  description: string | null;
  expected_return: string | null;
  source_updated_at: string | null;
  observed_at: string;
  ingested_at: string;
  is_current: boolean;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PlayerInjuryInsert = {
  player_id: string;
  provider: ProviderName;
  provider_external_id?: string | null;
  season?: number | null;
  week?: number | null;
  team?: string | null;
  status?: string | null;
  practice_status?: string | null;
  game_status?: string | null;
  body_part?: string | null;
  injury_type?: string | null;
  description?: string | null;
  expected_return?: string | null;
  source_updated_at?: string | null;
  observed_at?: string;
  ingested_at?: string;
  is_current?: boolean;
  metadata_json?: Record<string, unknown>;
};
