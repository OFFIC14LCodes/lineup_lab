import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// Team-game stats for a single team's week, ready for the scoring engine.
export type TeamGameContext = {
  gameId: string;
  season: number;
  week: number;
  teamId: string;
  opponentId: string;
  isHome: boolean;
  pointsScored: number | null;
  pointsAllowed: number | null;
  offensiveYards: number | null;
  yardsAllowed: number | null;
  isFinal: boolean;
};

// Load team-game context for a single team-week. Returns null if not found.
export async function loadTeamGameContext(
  season: number,
  week: number,
  teamId: string,
  client: SupabaseClient
): Promise<TeamGameContext | null> {
  const { data, error } = await client
    .from("team_game_stats")
    .select(
      "game_id,season,week,team_id,opponent_id,is_home,points_scored,points_allowed,offensive_yards,yards_allowed,is_final"
    )
    .eq("season", season)
    .eq("week", week)
    .eq("team_id", teamId)
    .eq("season_type", "REG")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load team game context for ${teamId} s${season}w${week}: ${error.message}`);
  }
  if (!data) return null;

  return {
    gameId: data.game_id as string,
    season: data.season as number,
    week: data.week as number,
    teamId: data.team_id as string,
    opponentId: data.opponent_id as string,
    isHome: data.is_home as boolean,
    pointsScored: data.points_scored as number | null,
    pointsAllowed: data.points_allowed as number | null,
    offensiveYards: data.offensive_yards as number | null,
    yardsAllowed: data.yards_allowed as number | null,
    isFinal: data.is_final as boolean,
  };
}

// Batch load team-game context for all weeks in a season.
// Returns a map keyed by `${teamId}|${week}`.
export async function loadTeamGameContextBatch(
  season: number,
  teamIds: string[],
  client: SupabaseClient
): Promise<Map<string, TeamGameContext>> {
  const result = new Map<string, TeamGameContext>();
  if (teamIds.length === 0) return result;

  let offset = 0;
  while (true) {
    const { data, error } = await client
      .from("team_game_stats")
      .select(
        "game_id,season,week,team_id,opponent_id,is_home,points_scored,points_allowed,offensive_yards,yards_allowed,is_final"
      )
      .eq("season", season)
      .eq("season_type", "REG")
      .in("team_id", teamIds)
      .range(offset, offset + 999);

    if (error) {
      throw new Error(`Failed to batch load team game context for season ${season}: ${error.message}`);
    }

    for (const row of data ?? []) {
      const ctx: TeamGameContext = {
        gameId: row.game_id as string,
        season: row.season as number,
        week: row.week as number,
        teamId: row.team_id as string,
        opponentId: row.opponent_id as string,
        isHome: row.is_home as boolean,
        pointsScored: row.points_scored as number | null,
        pointsAllowed: row.points_allowed as number | null,
        offensiveYards: row.offensive_yards as number | null,
        yardsAllowed: row.yards_allowed as number | null,
        isFinal: row.is_final as boolean,
      };
      result.set(`${ctx.teamId}|${ctx.week}`, ctx);
    }

    if ((data?.length ?? 0) < 1000) break;
    offset += 1000;
  }

  return result;
}
