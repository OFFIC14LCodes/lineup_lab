import { NextResponse } from "next/server";

import {
  buildHistoricalStatLine,
  buildProjectionStatLine,
  isUuid,
  type PlayerProfileHistoryRow,
  type PlayerProfileProjection,
} from "@/lib/draft/player-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/supabase/auth";

type PlayerRow = {
  id: string;
  sleeper_player_id: string | null;
  full_name: string | null;
  position: string | null;
  team: string | null;
  status: string | null;
};

type ProjectionOutputRow = {
  projection_run_id: string;
  position: string;
  projected_ppg_when_in_role: number | string;
  floor_points: number | string;
  median_points: number | string;
  ceiling_points: number | string;
  upside_points: number | string;
  projection_confidence_label: string;
  projected_position_rank: number | null;
  projection_method: string;
  projected_components_json: unknown;
};

type ProjectionRunRow = {
  projection_run_id: string;
  projection_season: number | null;
  as_of_date: string | null;
};

type SeasonStatsRow = {
  season: number;
  team: string | null;
  position_group: string | null;
  games_played: number | null;
  games_started: number | null;
  stats_json: unknown;
  provider_fantasy_points: number | string | null;
};

export async function GET(_: Request, { params }: { params: Promise<{ draftRoomId: string; playerId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { draftRoomId, playerId } = await params;
  const supabase = createAdminClient();

  const { data: room, error: roomError } = await supabase
    .from("draft_rooms")
    .select("id,league_id")
    .eq("id", draftRoomId)
    .eq("user_id", user.id)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "Draft room not found." }, { status: 404 });
  }

  const playerQuery = supabase
    .from("players")
    .select("id,sleeper_player_id,full_name,position,team,status")
    .limit(1);

  const { data: players, error: playerError } = await (
    isUuid(playerId)
      ? playerQuery.or(`id.eq.${playerId},sleeper_player_id.eq.${playerId}`)
      : playerQuery.eq("sleeper_player_id", playerId)
  );

  const player = (players?.[0] ?? null) as PlayerRow | null;
  if (playerError || !player) {
    return NextResponse.json({ error: "Player profile not found." }, { status: 404 });
  }

  const [{ data: projectionRows }, { data: seasonRows }] = await Promise.all([
    supabase
      .from("player_projection_outputs")
      .select(
        "projection_run_id,position,projected_ppg_when_in_role,floor_points,median_points,ceiling_points,upside_points,projection_confidence_label,projected_position_rank,projection_method,projected_components_json"
      )
      .eq("canonical_player_id", player.id)
      .eq("league_id", room.league_id)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("player_season_stats")
      .select("season,team,position_group,games_played,games_started,stats_json,provider_fantasy_points")
      .eq("player_id", player.id)
      .eq("season_type", "regular")
      .order("season", { ascending: false })
      .limit(6),
  ]);

  const projectionRow = (projectionRows?.[0] ?? null) as ProjectionOutputRow | null;
  let projectionRun: ProjectionRunRow | null = null;
  if (projectionRow) {
    const { data } = await supabase
      .from("projection_runs")
      .select("projection_run_id,projection_season,as_of_date")
      .eq("projection_run_id", projectionRow.projection_run_id)
      .maybeSingle();
    projectionRun = data as ProjectionRunRow | null;
  }

  const projection: PlayerProfileProjection | null = projectionRow
    ? {
        projectionRunId: projectionRow.projection_run_id,
        projectionSeason: projectionRun?.projection_season ?? null,
        asOfDate: projectionRun?.as_of_date ?? null,
        position: projectionRow.position,
        projectedPpgWhenInRole: numberValue(projectionRow.projected_ppg_when_in_role),
        floorPoints: numberValue(projectionRow.floor_points),
        medianPoints: numberValue(projectionRow.median_points),
        ceilingPoints: numberValue(projectionRow.ceiling_points),
        upsidePoints: numberValue(projectionRow.upside_points),
        confidenceLabel: projectionRow.projection_confidence_label,
        projectedPositionRank: projectionRow.projected_position_rank,
        projectionMethod: projectionRow.projection_method,
        statLine: buildProjectionStatLine(projectionRow.projected_components_json, projectionRow.position),
      }
    : null;

  const history = ((seasonRows ?? []) as SeasonStatsRow[]).map((row): PlayerProfileHistoryRow => ({
    season: row.season,
    team: row.team,
    position: row.position_group,
    gamesPlayed: row.games_played,
    gamesStarted: row.games_started,
    fantasyPoints: row.provider_fantasy_points === null ? null : numberValue(row.provider_fantasy_points),
    statLine: buildHistoricalStatLine(row.stats_json, row.position_group ?? player.position),
  }));

  return NextResponse.json({
    player: {
      id: player.id,
      sleeperPlayerId: player.sleeper_player_id,
      fullName: player.full_name,
      position: player.position,
      team: player.team,
      status: player.status,
    },
    projection,
    history,
    dataAvailability: {
      projection: projection !== null,
      projectedStatLine: Boolean(projection?.statLine.length),
      historicalSeasons: history.length,
    },
  });
}

function numberValue(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}
