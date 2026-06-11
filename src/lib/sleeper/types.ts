export type SleeperUser = {
  user_id: string;
  username: string;
  display_name?: string;
  avatar?: string | null;
  metadata?: Record<string, unknown>;
};

export type SleeperLeague = {
  league_id: string;
  name: string;
  season: string;
  sport: string;
  total_rosters?: number;
  status?: string;
  settings?: Record<string, number>;
  scoring_settings?: Record<string, number>;
  roster_positions?: string[];
  metadata?: Record<string, unknown>;
  draft_id?: string;
};

export type SleeperRoster = {
  roster_id: number;
  owner_id?: string;
  starters?: string[];
  players?: string[];
  settings?: Record<string, number>;
  metadata?: Record<string, unknown>;
};

export type SleeperLeagueUser = {
  user_id: string;
  display_name?: string;
  username?: string;
  avatar?: string | null;
  metadata?: {
    team_name?: string;
    [key: string]: unknown;
  };
};

export type SleeperDraft = {
  draft_id: string;
  league_id?: string;
  status?: string;
  type?: string;
  season?: string;
  settings?: Record<string, number>;
  metadata?: Record<string, unknown>;
};

export type SleeperDraftPick = {
  pick_no: number;
  round?: number;
  draft_slot?: number;
  roster_id?: number;
  picked_by?: string;
  player_id?: string;
  metadata?: {
    first_name?: string;
    last_name?: string;
    player_id?: string;
    position?: string;
    team?: string;
    [key: string]: unknown;
  };
  picked_at?: number;
};

export type SleeperPlayer = {
  player_id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  team?: string;
  age?: number;
  years_exp?: number;
  status?: string;
  fantasy_positions?: string[];
  search_full_name?: string;
  [key: string]: unknown;
};
