import { NextResponse } from "next/server";

import { matchRankingRowToPlayer, type MatchablePlayer } from "@/lib/players/match";
import { normalizePlayerName, normalizePosition, normalizeTeam } from "@/lib/players/normalize";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { toNumber } from "@/lib/utils";

type RawRankingInput = Record<string, unknown>;

type RankingInput = {
  sleeper_player_id?: string | null;
  player_name: string;
  position: string | null;
  team: string | null;
  rank: number | null;
  adp: number | null;
  projected_points: number | null;
  dynasty_value: number | null;
  best_ball_value: number | null;
  superflex_value: number | null;
  te_premium_value: number | null;
};

type UploadSummary = {
  totalRows: number;
  matchedExact: number;
  matchedFuzzy: number;
  ambiguous: number;
  unmatched: number;
  inserted: number;
  updated: number;
  errors: number;
};

const COLUMN_ALIASES: Record<keyof RankingInput, string[]> = {
  sleeper_player_id: ["sleeper_player_id", "sleeper id", "sleeper_id", "player_id"],
  player_name: ["player_name", "player", "name", "player name"],
  position: ["position", "pos"],
  team: ["team", "tm", "nfl_team"],
  rank: ["rank", "overall_rank"],
  adp: ["adp"],
  projected_points: ["proj", "projected", "projected_points", "fantasy_points"],
  dynasty_value: ["dynasty", "dynasty_value"],
  best_ball_value: ["best_ball", "best_ball_value"],
  superflex_value: ["superflex", "sf_value"],
  te_premium_value: ["te_premium", "tep_value"]
};

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    rows?: RawRankingInput[];
    leagueId?: string | null;
    source?: string;
    season?: string;
    format?: string;
  };
  const rawRows = (body.rows ?? []).slice(0, 3000);
  const source = body.source?.trim() || "manual";
  const season = body.season?.trim() || String(new Date().getFullYear());
  const format = body.format?.trim() || "dynasty_superflex";
  const leagueId = body.leagueId || null;

  if (leagueId) {
    const supabase = await createClient();
    const { data: league, error: leagueError } = await supabase
      .from("leagues")
      .select("id")
      .eq("id", leagueId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (leagueError) {
      return NextResponse.json({ error: "Unable to verify league access." }, { status: 500 });
    }

    if (!league) {
      return NextResponse.json({ error: "League not found." }, { status: 404 });
    }
  }

  const rows = rawRows.map(normalizeRankingRow).filter((row): row is RankingInput => Boolean(row));
  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid ranking rows found." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id,sleeper_player_id,full_name,normalized_name,position,primary_position,position_group,side_of_ball,team");

  if (playersError) {
    return NextResponse.json({ error: playersError.message }, { status: 500 });
  }

  const matchablePlayers = (players ?? []) as MatchablePlayer[];
  const summary: UploadSummary = {
    totalRows: rawRows.length,
    matchedExact: 0,
    matchedFuzzy: 0,
    ambiguous: 0,
    unmatched: 0,
    inserted: 0,
    updated: 0,
    errors: 0
  };

  for (const row of rows) {
    const match = matchRankingRowToPlayer(row, matchablePlayers);
    if (match.match_status === "fuzzy") summary.matchedFuzzy += 1;
    else if (match.match_status === "ambiguous") summary.ambiguous += 1;
    else if (match.match_status === "unmatched") summary.unmatched += 1;
    else summary.matchedExact += 1;

    const normalizedName = normalizePlayerName(row.player_name);
    const normalizedPosition = row.position || null;
    const normalizedTeam = row.team || null;
    // TODO: Add provider-backed projections and format-specific value models.
    // TODO: Add licensed/imported ADP and projection provider integrations. Do not scrape paid data.
    const payload = {
      user_id: user.id,
      league_id: leagueId,
      source,
      season,
      format,
      sleeper_player_id: match.sleeper_player_id,
      matched_player_id: match.matched_player_id,
      player_name: row.player_name,
      normalized_player_name: normalizedName,
      position: normalizedPosition,
      team: normalizedTeam,
      rank: row.rank,
      adp: row.adp,
      projected_points: row.projected_points,
      dynasty_value: row.dynasty_value,
      best_ball_value: row.best_ball_value,
      superflex_value: row.superflex_value,
      te_premium_value: row.te_premium_value,
      match_status: match.match_status,
      match_confidence: match.match_confidence,
      metadata_json: {
        raw: row,
        candidates: match.candidates,
        candidate_count: match.candidate_count
      }
    };

    try {
      const existingQuery = supabase
        .from("draft_rankings")
        .select("id")
        .eq("user_id", user.id)
        .eq("source", source)
        .eq("season", season)
        .eq("format", format)
        .limit(1);

      if (leagueId) existingQuery.eq("league_id", leagueId);
      else existingQuery.is("league_id", null);

      if (match.sleeper_player_id) existingQuery.eq("sleeper_player_id", match.sleeper_player_id);
      else {
        existingQuery
          .is("sleeper_player_id", null)
          .eq("normalized_player_name", normalizedName);

        if (normalizedPosition) existingQuery.eq("position", normalizedPosition);
        else existingQuery.is("position", null);

        if (normalizedTeam) existingQuery.eq("team", normalizedTeam);
        else existingQuery.is("team", null);
      }

      const { data: existing } = await existingQuery.maybeSingle();
      if (existing?.id) {
        const { error } = await supabase.from("draft_rankings").update(payload).eq("id", existing.id);
        if (error) throw error;
        summary.updated += 1;
      } else {
        const { error } = await supabase.from("draft_rankings").insert(payload);
        if (error) throw error;
        summary.inserted += 1;
      }
    } catch {
      summary.errors += 1;
    }
  }

  return NextResponse.json(summary);
}

function normalizeRankingRow(row: RawRankingInput): RankingInput | null {
  const playerName = readString(row, "player_name");
  if (!playerName) return null;

  return {
    sleeper_player_id: readString(row, "sleeper_player_id"),
    player_name: playerName,
    position: normalizePosition(readString(row, "position")),
    team: normalizeTeam(readString(row, "team")),
    rank: toNumber(readValue(row, "rank")),
    adp: toNumber(readValue(row, "adp")),
    projected_points: toNumber(readValue(row, "projected_points")),
    dynasty_value: toNumber(readValue(row, "dynasty_value")),
    best_ball_value: toNumber(readValue(row, "best_ball_value")),
    superflex_value: toNumber(readValue(row, "superflex_value")),
    te_premium_value: toNumber(readValue(row, "te_premium_value"))
  };
}

function readString(row: RawRankingInput, field: keyof RankingInput) {
  const value = readValue(row, field);
  return typeof value === "string" ? value.trim() || null : value === undefined || value === null ? null : String(value);
}

function readValue(row: RawRankingInput, field: keyof RankingInput) {
  const normalizedRow = new Map(
    Object.entries(row).map(([key, value]) => [key.trim().toLowerCase().replace(/\s+/g, " "), value])
  );
  for (const alias of COLUMN_ALIASES[field]) {
    const value = normalizedRow.get(alias);
    if (value !== undefined && value !== "") return value;
  }
  return null;
}
