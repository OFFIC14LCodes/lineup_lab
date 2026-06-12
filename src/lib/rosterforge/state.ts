import { normalizePlayerName, normalizePrimaryPosition } from "@/lib/players/normalize";
import { buildDraftTargetScore, type DraftTargetScorePlayer } from "@/lib/draft/scoring";
import {
  buildNormalizedRosterRequirements,
  buildPositionNeeds,
  buildTopNeeds,
  POSITION_GROUPS,
  type PositionGroup
} from "@/lib/draft/roster-slots";
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
  roster_label?: string | null;
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
  primary_position: string | null;
  position_group: string | null;
  team: string | null;
  fantasy_positions_json: string[] | null;
  eligible_positions_json: string[] | null;
  normalized_name: string | null;
};

const POSITION_ORDER: Record<string, number> = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 4,
  K: 5,
  DEF: 6,
  DL: 7,
  LB: 8,
  DB: 9
};

const FALLBACK_POSITION_GROUPS = ["QB", "RB", "WR", "TE", "K", "DEF", "DL", "LB", "DB"];

const WARNING_MESSAGES: Record<string, string> = {
  no_rankings_uploaded: "No rankings uploaded. Upload rankings to power recommendations.",
  unmatched_rankings_present: "Some rankings are unmatched and may not disappear when drafted until matched.",
  using_fallback_pool: "Unranked Sleeper player pool - upload rankings for real recommendations.",
  no_players_synced: "Sync Sleeper players for an unranked fallback pool.",
  draft_not_synced: "Draft picks have not synced yet.",
  unknown_roster_slots: "Some roster slots could not be normalized yet.",
  no_idp_players_synced: "League uses IDP slots, but no active defensive players are available in the synced pool.",
  no_kicker_players_synced: "League uses kicker slots, but no active kickers are available in the synced pool.",
  no_team_defense_players_synced: "League uses team defense slots, but no active DEF players are available in the synced pool."
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
        .select(
          "id,sleeper_player_id,full_name,position,primary_position,position_group,team,fantasy_positions_json,eligible_positions_json,normalized_name"
        )
        .eq("active", true)
        .limit(1000)
    ]);

  const rostersById = new Map(
    (rosters ?? []).map((roster) => [
      roster.platform_roster_id,
      (roster.owner_display_name as string | null) ?? `Roster ${roster.platform_roster_id}`
    ])
  );
  const draftPicks = ((picks ?? []) as DraftPickRow[])
    .filter((pick) => Boolean(pick.player_name || pick.sleeper_player_id))
    .map((pick) => ({
      ...pick,
      roster_label: pick.platform_roster_id ? rostersById.get(pick.platform_roster_id) ?? pick.platform_roster_id : null
    }));
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
  const fallbackPlayers = playerRows.filter((player) =>
    FALLBACK_POSITION_GROUPS.includes(player.position_group ?? player.primary_position ?? player.position ?? "")
  );
  const playerRowsBySleeperId = new Map(
    fallbackPlayers
      .filter((player) => Boolean(player.sleeper_player_id))
      .map((player) => [player.sleeper_player_id as string, player])
  );
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
          matched_player_id: ranking.matched_player_id,
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
          match_confidence: ranking.match_confidence,
          is_ranked: true,
          is_fallback: false
        }))
        .sort((a, b) => (a.rank ?? 99999) - (b.rank ?? 99999))
        .slice(0, 150)
    : fallbackPlayers
        .filter((player) => {
          const byId = player.sleeper_player_id && draftedIds.has(player.sleeper_player_id);
          const byName = draftedNames.has(player.normalized_name ?? normalizePlayerName(player.full_name ?? ""));
          return !byId && !byName;
        })
        .map((player) => ({
          source: "sleeper_pool" as const,
          sleeper_player_id: player.sleeper_player_id,
          matched_player_id: player.id,
          player_name: player.full_name,
          position: player.position_group ?? player.primary_position ?? player.position,
          team: player.team,
          rank: null,
          adp: null,
          projected_points: null,
          dynasty_value: null,
          best_ball_value: null,
          superflex_value: null,
          te_premium_value: null,
          match_status: null,
          match_confidence: null,
          is_ranked: false,
          is_fallback: true
        }))
        .sort((a, b) => {
          const pos = (POSITION_ORDER[a.position ?? ""] ?? 99) - (POSITION_ORDER[b.position ?? ""] ?? 99);
          return pos || (a.player_name ?? "").localeCompare(b.player_name ?? "");
        })
        .slice(0, 150);

  const rosterRequirements = buildNormalizedRosterRequirements(
    Array.isArray(room.leagues?.roster_positions_json) ? room.leagues.roster_positions_json : []
  );
  const counts = countPositions(myPicks, playerRowsBySleeperId);
  const positionNeeds = buildPositionNeeds(counts, rosterRequirements);
  const topNeeds = buildTopNeeds(positionNeeds);

  const statusCounts = rankingRows.reduce<Record<string, number>>((acc, ranking) => {
    const status = ranking.match_status ?? "unmatched";
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
  const issueCount = (statusCounts.unmatched ?? 0) + (statusCounts.ambiguous ?? 0);
  const lastPick = draftPicks.at(-1) ?? null;
  const currentPickNumber = (lastPick?.pick_no ?? 0) + 1;
  const warnings = [
    !hasRankings ? "no_rankings_uploaded" : null,
    issueCount > 0 ? "unmatched_rankings_present" : null,
    !hasRankings && fallbackPlayers.length > 0 ? "using_fallback_pool" : null,
    !hasRankings && fallbackPlayers.length === 0 ? "no_players_synced" : null,
    !room.last_synced_at && draftPicks.length === 0 ? "draft_not_synced" : null,
    rosterRequirements.unknownSlots.length > 0 ? "unknown_roster_slots" : null,
    rosterRequirements.hasIDP && !hasActiveGroup(fallbackPlayers, ["DL", "LB", "DB"]) ? "no_idp_players_synced" : null,
    rosterRequirements.hasKicker && !hasActiveGroup(fallbackPlayers, ["K"]) ? "no_kicker_players_synced" : null,
    rosterRequirements.hasTeamDefense && !hasActiveGroup(fallbackPlayers, ["DEF"]) ? "no_team_defense_players_synced" : null
  ].filter((warning): warning is string => Boolean(warning));
  const picksUntilMyNextPick = getPicksUntilMyNextPick(room.settings_json, myRosterId, currentPickNumber);
  const scoring = buildDraftTargetScore({
    players: remainingPlayers as DraftTargetScorePlayer[],
    league: {
      currentPickNumber,
      rosterPositions: Array.isArray(room.leagues?.roster_positions_json) ? room.leagues.roster_positions_json : [],
      positionCounts: counts,
      is_dynasty: Boolean(room.leagues?.is_dynasty),
      is_best_ball: Boolean(room.leagues?.is_best_ball),
      is_superflex: Boolean(room.leagues?.is_superflex),
      is_two_qb: Boolean(room.leagues?.is_two_qb),
      te_premium: Number(room.leagues?.te_premium ?? 0),
      scoringSettings:
        room.leagues?.scoring_settings_json && typeof room.leagues.scoring_settings_json === "object"
          ? (room.leagues.scoring_settings_json as Record<string, number>)
          : null
    }
  });

  const idpDetected = rosterRequirements.hasIDP;

  return {
    room,
    league: room.leagues,
    picks: draftPicks,
    currentPickNumber,
    currentRound: lastPick?.round ?? 1,
    picksUntilMyNextPick,
    lastPick,
    myRoster: myPicks,
    positionCounts: counts,
    draftedPlayerIds: Array.from(draftedIds),
    remainingPlayers: scoring.scoredPlayers,
    recommendations: hasRankings ? scoring.recommendations : [],
    topNeeds,
    rosterRequirements,
    positionNeeds,
    hasIDP: idpDetected,
    hasKicker: rosterRequirements.hasKicker,
    hasTeamDefense: rosterRequirements.hasTeamDefense,
    unknownRosterSlots: rosterRequirements.unknownSlots,
    rankingsUploaded: hasRankings,
    rankingMatchStatusCounts: statusCounts,
    boardLabel: hasRankings ? "Ranked available players" : WARNING_MESSAGES.using_fallback_pool,
    scoringMetadata: scoring.scoringMetadata,
    warnings,
    warningMessages: warnings.map((warning) => WARNING_MESSAGES[warning] ?? warning),
    warning: warnings.map((warning) => WARNING_MESSAGES[warning] ?? warning).join(" ") || null
  };
}

function countPositions(picks: DraftPickRow[], playersBySleeperId: Map<string, PlayerRow>) {
  const counts = Object.fromEntries(POSITION_GROUPS.map((position) => [position, 0])) as Record<PositionGroup, number>;

  for (const pick of picks) {
    const player = pick.sleeper_player_id ? playersBySleeperId.get(pick.sleeper_player_id) : null;
    const normalizedPosition = normalizeDraftedPosition(pick.position, player);
    if (!normalizedPosition) continue;
    counts[normalizedPosition] += 1;
  }

  return counts;
}

function normalizeDraftedPosition(rawPosition: string | null, player: PlayerRow | null | undefined): PositionGroup | null {
  const position =
    player?.primary_position ??
    player?.position_group ??
    player?.position ??
    normalizePrimaryPosition(rawPosition) ??
    null;

  if (!position) return null;

  if (FALLBACK_POSITION_GROUPS.includes(position)) {
    return position as PositionGroup;
  }

  return null;
}

function hasActiveGroup(players: PlayerRow[], groups: PositionGroup[]) {
  return players.some((player) => {
    const group = player.position_group ?? player.primary_position ?? player.position;
    return group ? groups.includes(group as PositionGroup) : false;
  });
}

function getPicksUntilMyNextPick(settings: unknown, myRosterId: string | undefined, currentPickNumber: number) {
  if (!myRosterId || !settings || typeof settings !== "object") return null;
  const draftSettings = settings as Record<string, unknown>;
  const teams = Number(draftSettings.teams);
  const rounds = Number(draftSettings.rounds);
  const slot = Number(myRosterId);

  if (!Number.isFinite(teams) || !Number.isFinite(rounds) || !Number.isFinite(slot) || teams <= 0 || rounds <= 0) {
    return null;
  }

  for (let pick = currentPickNumber; pick <= teams * rounds; pick += 1) {
    const round = Math.ceil(pick / teams);
    const pickInRound = ((pick - 1) % teams) + 1;
    const rosterSlot = round % 2 === 0 ? teams - pickInRound + 1 : pickInRound;
    if (rosterSlot === slot) return pick - currentPickNumber;
  }

  return null;
}
