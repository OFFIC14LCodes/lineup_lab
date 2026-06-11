import { normalizePlayerName } from "@/lib/players/normalize";
import { createAdminClient } from "@/lib/supabase/admin";

type DraftPickRow = {
  pick_no: number;
  round: number | null;
  pick_in_round: number | null;
  platform_roster_id: string | null;
  picked_by_platform_user_id: string | null;
  sleeper_player_id: string | null;
  player_name: string | null;
  position: string | null;
  team: string | null;
  picked_at: string | null;
};

type RankingRow = {
  id: string;
  sleeper_player_id: string | null;
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
  match_status: string | null;
  match_confidence: number | null;
  matched_player_id: string | null;
};

type PlayerRow = {
  id: string;
  sleeper_player_id: string | null;
  full_name: string | null;
  position: string | null;
  team: string | null;
  fantasy_positions_json: string[] | null;
  normalized_name: string | null;
};

const STARTER_TARGETS: Record<string, number> = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1
};

const POSITION_ORDER: Record<string, number> = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 4,
  K: 5,
  DEF: 6
};

export async function getDraftRoomState(userId: string, draftRoomId: string) {
  const supabase = createAdminClient();

  const { data: room, error: roomError } = await supabase
    .from("draft_rooms")
    .select("*, leagues(*)")
    .eq("id", draftRoomId)
    .eq("user_id", userId)
    .single();

  if (roomError || !room) {
    throw roomError ?? new Error("Draft room not found.");
  }

  const [{ data: picks }, { data: account }, { data: rosters }, { data: rankings }, { data: players }] =
    await Promise.all([
      supabase
        .from("draft_room_picks")
        .select("*")
        .eq("draft_room_id", draftRoomId)
        .order("pick_no", { ascending: true }),
      supabase
        .from("fantasy_accounts")
        .select("*")
        .eq("user_id", userId)
        .eq("platform", "sleeper")
        .maybeSingle(),
      supabase.from("league_rosters").select("*").eq("league_id", room.league_id),
      supabase
        .from("draft_rankings")
        .select("*")
        .eq("user_id", userId)
        .or(`league_id.eq.${room.league_id},league_id.is.null`)
        .order("rank", { ascending: true, nullsFirst: false })
        .limit(1000),
      supabase
        .from("players")
        .select("id,sleeper_player_id,full_name,position,team,fantasy_positions_json,normalized_name")
        .eq("active", true)
        .in("position", ["QB", "RB", "WR", "TE"])
        .limit(500)
    ]);

  const draftPicks = ((picks ?? []) as DraftPickRow[]).filter((pick) => Boolean(pick.player_name || pick.sleeper_player_id));
  const draftedIds = new Set(draftPicks.map((pick) => pick.sleeper_player_id).filter(Boolean));
  const draftedNames = new Set(draftPicks.map((pick) => normalizePlayerName(pick.player_name ?? "")).filter(Boolean));
  const myPlatformUserId = account?.platform_user_id as string | undefined;
  const myRoster = rosters?.find((roster) => roster.owner_platform_user_id === myPlatformUserId);
  const myRosterId = myRoster?.platform_roster_id as string | undefined;

  const myPicks = draftPicks.filter((pick) => {
    return (
      (myPlatformUserId && pick.picked_by_platform_user_id === myPlatformUserId) ||
      (myRosterId && pick.platform_roster_id === myRosterId)
    );
  });

  const rankingRows = (rankings ?? []) as RankingRow[];
  const playerRows = (players ?? []) as PlayerRow[];
  const hasRankings = rankingRows.length > 0;

  const remainingPlayers = hasRankings
    ? rankingRows
        .filter((ranking) => {
          const byId = ranking.sleeper_player_id && draftedIds.has(ranking.sleeper_player_id);
          const byName = !ranking.sleeper_player_id && draftedNames.has(normalizePlayerName(ranking.player_name));
          return !byId && !byName;
        })
        .map((ranking) => ({
          source: "ranking" as const,
          sleeper_player_id: ranking.sleeper_player_id,
          player_name: ranking.player_name,
          position: ranking.position,
          team: ranking.team,
          rank: ranking.rank,
          adp: ranking.adp,
          projected_points: ranking.projected_points,
          dynasty_value: ranking.dynasty_value,
          best_ball_value: ranking.best_ball_value,
          superflex_value: ranking.superflex_value,
          te_premium_value: ranking.te_premium_value,
          match_status: ranking.match_status,
          match_confidence: ranking.match_confidence
        }))
        .sort((a, b) => (a.rank ?? 99999) - (b.rank ?? 99999))
        .slice(0, 150)
    : playerRows
        .filter((player) => {
          const byId = player.sleeper_player_id && draftedIds.has(player.sleeper_player_id);
          const byName = draftedNames.has(player.normalized_name ?? normalizePlayerName(player.full_name ?? ""));
          return !byId && !byName;
        })
        .map((player) => ({
          source: "sleeper_pool" as const,
          sleeper_player_id: player.sleeper_player_id,
          player_name: player.full_name,
          position: player.position,
          team: player.team,
          rank: null,
          adp: null,
          projected_points: null,
          dynasty_value: null,
          best_ball_value: null,
          superflex_value: null,
          te_premium_value: null,
          match_status: null,
          match_confidence: null
        }))
        .sort((a, b) => {
          const pos = (POSITION_ORDER[a.position ?? ""] ?? 99) - (POSITION_ORDER[b.position ?? ""] ?? 99);
          return pos || (a.player_name ?? "").localeCompare(b.player_name ?? "");
        })
        .slice(0, 150);

  const counts = countPositions(myPicks);
  const topNeeds = Object.entries(STARTER_TARGETS)
    .map(([position, target]) => ({
      position,
      current: counts[position] ?? 0,
      target,
      need: Math.max(0, target - (counts[position] ?? 0))
    }))
    .sort((a, b) => b.need - a.need)
    .filter((need) => need.need > 0);

  const statusCounts = rankingRows.reduce<Record<string, number>>((acc, ranking) => {
    const status = ranking.match_status ?? "unmatched";
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
  const issueCount = (statusCounts.unmatched ?? 0) + (statusCounts.ambiguous ?? 0);
  const lastPick = draftPicks.at(-1) ?? null;
  const currentPickNumber = (lastPick?.pick_no ?? 0) + 1;

  return {
    room,
    league: room.leagues,
    picks: draftPicks,
    currentPickNumber,
    currentRound: lastPick?.round ?? 1,
    lastPick,
    myRoster: myPicks,
    positionCounts: counts,
    draftedPlayerIds: Array.from(draftedIds),
    remainingPlayers,
    recommendations: remainingPlayers.slice(0, 10),
    topNeeds,
    rankingsUploaded: hasRankings,
    rankingMatchStatusCounts: statusCounts,
    boardLabel: hasRankings ? "Ranked available players" : "Unranked Sleeper player pool",
    warning: hasRankings
      ? issueCount > Math.max(10, rankingRows.length * 0.2)
        ? `${issueCount} rankings are unmatched or ambiguous. Review the rankings manager before trusting the board.`
        : null
      : playerRows.length
        ? "No rankings uploaded. Upload rankings to power recommendations. Showing an unranked Sleeper player pool."
        : "No rankings uploaded. Upload rankings to power recommendations. Sync Sleeper players for an unranked fallback pool."
  };
}

function countPositions(picks: DraftPickRow[]) {
  return picks.reduce<Record<string, number>>((acc, pick) => {
    const position = pick.position ?? "UNK";
    acc[position] = (acc[position] ?? 0) + 1;
    return acc;
  }, {});
}
