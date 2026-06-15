import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { buildWarRoomValueOverlay } from "@/lib/draft/h10-war-room-overlay";
import { filterFallbackPlayers, type FallbackRelevanceDiagnostics } from "@/lib/draft/fallback-relevance";
import { buildH10RecommendationPreviewPayload } from "@/lib/draft/war-room-recommendation-preview-state";
import { normalizePlayerName, normalizePrimaryPosition } from "@/lib/players/normalize";
import { buildDraftTargetScore, type DraftTargetScorePlayer } from "@/lib/draft/scoring";
import { buildDraftBoardTeams } from "@/lib/rosterforge/draft-board-teams";
import { buildDraftPositionContext } from "@/lib/rosterforge/draft-position";
import {
  buildNormalizedRosterRequirements,
  buildPositionNeeds,
  buildTopNeeds,
  POSITION_GROUPS,
  type PositionGroup
} from "@/lib/draft/roster-slots";
import { getBooleanEnv } from "@/lib/env";
import { buildH10WarRoomModeState } from "@/lib/rosterforge/h10-internal-trusted-mode";
import type { H10LeagueValueRow } from "@/lib/projections/h10-league-value";
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
  age: number | null;
  years_exp: number | null;
  fantasy_positions_json: string[] | null;
  eligible_positions_json: string[] | null;
  normalized_name: string | null;
};

type LeagueRosterRow = {
  platform_roster_id: string;
  owner_platform_user_id: string | null;
  owner_display_name: string | null;
  players_json?: unknown;
  metadata_json?: unknown;
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
  no_draft_relevant_available_rows: "No draft-relevant fallback players are available with rankings, ADP, or Blackbird projections.",
  diagnostic_fallback_rows_hidden: "Some diagnostic fallback players are hidden because they lack rankings, ADP, and Blackbird projections.",
  draft_not_synced: "Draft picks have not synced yet.",
  unknown_roster_slots: "Some roster slots could not be normalized yet.",
  no_idp_players_synced: "League uses IDP slots, but no active defensive players are available in the synced pool.",
  no_kicker_players_synced: "League uses kicker slots, but no active kickers are available in the synced pool.",
  no_team_defense_players_synced: "League uses team defense slots, but no active DEF players are available in the synced pool."
};

const H10_WAR_ROOM_OVERLAY_FEATURE_FLAG = "ENABLE_H10_WAR_ROOM_OVERLAY";
const WAR_ROOM_DIAGNOSTIC_FALLBACKS_FEATURE_FLAG = "ENABLE_WAR_ROOM_DIAGNOSTIC_FALLBACKS";

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

  const validationMetadata = room.metadata_json && typeof room.metadata_json === "object" ? (room.metadata_json as Record<string, unknown>) : {};
  const isValidationRoom = validationMetadata.validation_room === true || validationMetadata.purpose === "h10_recommendation_validation";
  const validationProfile = typeof validationMetadata.h10_validation_profile === "string" ? validationMetadata.h10_validation_profile : null;
  let rankingsQuery = supabase
    .from("draft_rankings")
    .select("*")
    .eq("user_id", userId)
    .or(`league_id.eq.${room.league_id},league_id.is.null`)
    .order("rank", { ascending: true, nullsFirst: false })
    .limit(1000);

  if (isValidationRoom) {
    rankingsQuery = rankingsQuery.eq("source", "h10_validation");
    if (validationProfile) rankingsQuery = rankingsQuery.eq("format", validationProfile);
  } else {
    rankingsQuery = rankingsQuery.neq("source", "h10_validation");
  }

  const [{ data: picks }, { data: account }, { data: rosters }, { data: rankings }, players] =
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
      rankingsQuery,
      loadActivePlayerRows(supabase)
    ]);

  const rosterRows = (rosters ?? []) as LeagueRosterRow[];
  const rostersById = new Map(
    rosterRows.map((roster) => [
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
  const draftBoardTeams = buildDraftBoardTeams({
    rosters: rosterRows,
    roomMetadata: room.metadata_json,
    picks: draftPicks,
    teamCount: Number(room.leagues?.total_teams ?? rosterRows.length) || null,
  });
  const draftedIds = new Set(draftPicks.map((pick) => pick.sleeper_player_id).filter(Boolean));
  const draftedNames = new Set(draftPicks.map((pick) => normalizePlayerName(pick.player_name ?? "")).filter(Boolean));
  const myPlatformUserId = account?.platform_user_id as string | undefined;
  const myRoster = rosterRows.find((roster) => roster.owner_platform_user_id === myPlatformUserId);
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
  const playerRowsById = new Map(fallbackPlayers.map((player) => [player.id, player]));
  const hasRankings = rankingRows.length > 0;
  const rosterRequirements = buildNormalizedRosterRequirements(
    Array.isArray(room.leagues?.roster_positions_json) ? room.leagues.roster_positions_json : []
  );
  const fallbackValueRows = loadH10ValueRowsFromArtifact(room.league_id as string);
  const includeDiagnosticFallbacks = getBooleanEnv(WAR_ROOM_DIAGNOSTIC_FALLBACKS_FEATURE_FLAG, false);
  const unfilteredFallbackPlayers = fallbackPlayers
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
      age: player.age,
      years_exp: player.years_exp,
      match_status: null,
      match_confidence: null,
      is_ranked: false,
      is_fallback: true
    }))
    .sort((a, b) => {
      const pos = (POSITION_ORDER[a.position ?? ""] ?? 99) - (POSITION_ORDER[b.position ?? ""] ?? 99);
      return pos || (a.player_name ?? "").localeCompare(b.player_name ?? "");
    }) as DraftTargetScorePlayer[];
  const fallbackRelevance = filterFallbackPlayers({
    leagueId: room.league_id as string,
    players: unfilteredFallbackPlayers,
    valueRows: fallbackValueRows,
    rosterRequirements,
    includeDiagnosticFallbacks,
  });

  const remainingPlayers = hasRankings
    ? rankingRows
        .filter((ranking) => {
          const byId = ranking.sleeper_player_id && draftedIds.has(ranking.sleeper_player_id);
          const byName = !ranking.sleeper_player_id && draftedNames.has(normalizePlayerName(ranking.player_name));
          return !byId && !byName;
        })
        .map((ranking) => {
          const matchedPlayer =
            (ranking.sleeper_player_id ? playerRowsBySleeperId.get(ranking.sleeper_player_id) : null) ??
            (ranking.matched_player_id ? playerRowsById.get(ranking.matched_player_id) : null) ??
            null;
          return {
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
            age: matchedPlayer?.age ?? null,
            years_exp: matchedPlayer?.years_exp ?? null,
            match_status: ranking.match_status,
            match_confidence: ranking.match_confidence,
            is_ranked: true,
            is_fallback: false
          };
        })
        .sort((a, b) => (a.rank ?? 99999) - (b.rank ?? 99999))
        .slice(0, 150)
    : selectBalancedFallbackPlayers(fallbackRelevance.players, rosterRequirements, fallbackValueRows, 150);
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
  const draftPosition = buildDraftPositionContext({
    picks: draftPicks,
    settings: room.settings_json,
    myRosterId,
    myPlatformUserId,
    teamCountFallback: Number(room.leagues?.total_teams ?? draftBoardTeams.length) || null,
    roundsFallback: Array.isArray(room.leagues?.roster_positions_json) ? room.leagues.roster_positions_json.length : null,
  });
  const currentPickNumber = draftPosition.currentPickNumber;
  const warnings = [
    !hasRankings ? "no_rankings_uploaded" : null,
    issueCount > 0 ? "unmatched_rankings_present" : null,
    !hasRankings && fallbackPlayers.length > 0 ? "using_fallback_pool" : null,
    !hasRankings && fallbackRelevance.diagnostics.fallbackRowsExcluded > 0 ? "diagnostic_fallback_rows_hidden" : null,
    !hasRankings && fallbackRelevance.diagnostics.fallbackRowsIncluded === 0 && fallbackRelevance.diagnostics.fallbackRowsTotal > 0 ? "no_draft_relevant_available_rows" : null,
    !hasRankings && fallbackPlayers.length === 0 ? "no_players_synced" : null,
    !room.last_synced_at && draftPicks.length === 0 ? "draft_not_synced" : null,
    rosterRequirements.unknownSlots.length > 0 ? "unknown_roster_slots" : null,
    rosterRequirements.hasIDP && !hasActiveGroup(fallbackPlayers, ["DL", "LB", "DB"]) ? "no_idp_players_synced" : null,
    rosterRequirements.hasKicker && !hasActiveGroup(fallbackPlayers, ["K"]) ? "no_kicker_players_synced" : null,
    rosterRequirements.hasTeamDefense && !hasActiveGroup(fallbackPlayers, ["DEF"]) ? "no_team_defense_players_synced" : null
  ].filter((warning): warning is string => Boolean(warning));
  const picksUntilMyNextPick = draftPosition.picksUntilMyNextPick;
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
  const overlayPayload = getBooleanEnv(H10_WAR_ROOM_OVERLAY_FEATURE_FLAG, false)
    ? buildOptionalH10Overlay({
        leagueId: room.league_id as string,
        players: scoring.scoredPlayers,
        rosterRequirements,
        fallbackPlayers,
      })
    : {};
  const h10ModeState = buildH10WarRoomModeState({ userId });
  const recommendationPreviewPayload =
    h10ModeState.h10RecommendationPreviewEnabled ||
    h10ModeState.h10RecommendationExperimentEnabled ||
    h10ModeState.h10InternalTrustedExperimentAllowed
    ? buildOptionalH10RecommendationPreview({
        leagueId: room.league_id as string,
        draftRoomId,
        players: scoring.scoredPlayers,
        rosterRequirements,
        fallbackPlayers,
        positionNeeds,
        topNeeds,
        myRoster: myPicks,
        picks: draftPicks,
        currentPickNumber,
        currentRound: draftPosition.currentRound,
        picksUntilMyNextPick,
        draftedPlayerIds: Array.from(draftedIds).filter((id): id is string => Boolean(id)),
        positionCounts: counts,
        legacyRecommendationCount: hasRankings ? scoring.recommendations.length : 0,
      })
    : {};

  return {
    room,
    league: room.leagues,
    picks: draftPicks,
    draftBoardTeams,
    myDraftSlot: draftPosition.myDraftSlot,
    teamCount: draftPosition.teamCount,
    currentPickNumber,
    currentRound: draftPosition.currentRound,
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
    warning: warnings.map((warning) => WARNING_MESSAGES[warning] ?? warning).join(" ") || null,
    fallbackRelevanceDiagnostics: hasRankings ? emptyFallbackDiagnostics(includeDiagnosticFallbacks) : fallbackRelevance.diagnostics,
    ...h10ModeState,
    ...overlayPayload,
    ...recommendationPreviewPayload
  };
}

function buildOptionalH10Overlay(input: {
  leagueId: string;
  players: DraftTargetScorePlayer[];
  rosterRequirements: ReturnType<typeof buildNormalizedRosterRequirements>;
  fallbackPlayers: PlayerRow[];
}) {
  const valueRows = loadH10ValueRowsFromArtifact(input.leagueId);
  const sleeperToCanonicalId = Object.fromEntries(
    input.fallbackPlayers
      .filter((player) => player.sleeper_player_id)
      .map((player) => [player.sleeper_player_id as string, player.id])
  );
  const overlay = buildWarRoomValueOverlay({
    leagueId: input.leagueId,
    players: input.players,
    valueRows,
    rosterRequirements: input.rosterRequirements,
    includeDstDryRun: false,
    includeAllPositions: false,
    sleeperToCanonicalId,
  });
  return {
    h10ValueOverlay: overlay.rows,
    h10ValueOverlayDiagnostics: overlay.diagnostics,
  };
}

async function loadActivePlayerRows(supabase: ReturnType<typeof createAdminClient>): Promise<PlayerRow[]> {
  const pageSize = 1000;
  const rows: PlayerRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("players")
      .select(
        "id,sleeper_player_id,full_name,position,primary_position,position_group,team,age,years_exp,fantasy_positions_json,eligible_positions_json,normalized_name"
      )
      .eq("active", true)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as PlayerRow[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function buildOptionalH10RecommendationPreview(input: {
  leagueId: string;
  draftRoomId: string;
  players: DraftTargetScorePlayer[];
  rosterRequirements: ReturnType<typeof buildNormalizedRosterRequirements>;
  fallbackPlayers: PlayerRow[];
  positionNeeds: ReturnType<typeof buildPositionNeeds>;
  topNeeds: ReturnType<typeof buildTopNeeds>;
  myRoster: DraftPickRow[];
  picks: DraftPickRow[];
  currentPickNumber: number;
  currentRound: number;
  picksUntilMyNextPick: number | null;
  draftedPlayerIds: string[];
  positionCounts: Record<PositionGroup, number>;
  legacyRecommendationCount: number;
}) {
  try {
    const valueRows = loadH10ValueRowsFromArtifact(input.leagueId);
    const sleeperToCanonicalId = Object.fromEntries(
      input.fallbackPlayers
        .filter((player) => player.sleeper_player_id)
        .map((player) => [player.sleeper_player_id as string, player.id])
    );
    const overlay = buildWarRoomValueOverlay({
      leagueId: input.leagueId,
      players: input.players,
      valueRows,
      rosterRequirements: input.rosterRequirements,
      includeDstDryRun: false,
      includeAllPositions: false,
      sleeperToCanonicalId,
    });
    return buildH10RecommendationPreviewPayload({
      enabled: true,
      leagueId: input.leagueId,
      draftRoomId: input.draftRoomId,
      remainingPlayers: input.players,
      h10ValueOverlay: overlay.rows,
      rosterRequirements: input.rosterRequirements,
      positionNeeds: input.positionNeeds,
      topNeeds: input.topNeeds,
      myRoster: input.myRoster,
      picks: input.picks,
      currentPickNumber: input.currentPickNumber,
      currentRound: input.currentRound,
      picksUntilMyNextPick: input.picksUntilMyNextPick,
      draftedPlayerIds: input.draftedPlayerIds,
      positionCounts: input.positionCounts,
      includeDstDryRun: false,
      matchCoverageSummary: overlay.diagnostics.matchCoverageSummary,
      legacyRecommendationCount: input.legacyRecommendationCount,
      legacyRecommendationsUnchanged: true,
      remainingPlayersOrderUnchanged: true,
    });
  } catch (error) {
    return {
      h10RecommendationPreview: [],
      h10RecommendationDiagnostics: {
        leagueId: input.leagueId,
        draftRoomId: input.draftRoomId,
        remainingPlayersLoaded: input.players.length,
        overlayRowsLoaded: 0,
        recommendationsGenerated: 0,
        rowsByTier: {},
        rowsByStatus: {},
        rowsByPosition: {},
        warningCounts: {},
        idpRowsEvaluated: 0,
        idpRowsByTier: {},
        idpAverageScoreComponents: null,
        idpTopLeagueValueRows: [],
        idpTopRosterNeedRows: [],
        idpTopTierCliffRows: [],
        idpSuppressionReasons: {},
        invariantFailures: [error instanceof Error ? error.message : "Unable to build H10 recommendation preview."],
        contextLimitations: ["H10_RECOMMENDATION_PREVIEW_UNAVAILABLE"],
      },
      h10RecommendationExperimentDiagnostics: {
        legacyReady: input.legacyRecommendationCount > 0,
        blackbirdPreviewReady: false,
        blackbirdExperimentEligible: false,
        failedExperimentGates: ["INVARIANT_FAILURES_PRESENT"],
        blackbirdRowsGenerated: 0,
        blackbirdRowsShown: 0,
        rowsByTier: {},
        rowsByStatus: {},
        matchRate: null,
        insufficientDataRate: 1,
        warningCounts: {},
        contextLimitations: ["H10_RECOMMENDATION_PREVIEW_UNAVAILABLE"],
      },
    };
  }
}

function loadH10ValueRowsFromArtifact(leagueId: string): H10LeagueValueRow[] {
  const artifactPath = path.join(process.cwd(), "artifacts", "projections", "h10-league-value.json");
  if (!existsSync(artifactPath)) return [];
  try {
    const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { rows?: H10LeagueValueRow[] };
    return (artifact.rows ?? []).filter((row) => row.leagueId === leagueId);
  } catch {
    return [];
  }
}

function selectBalancedFallbackPlayers(
  players: DraftTargetScorePlayer[],
  rosterRequirements: ReturnType<typeof buildNormalizedRosterRequirements>,
  valueRows: H10LeagueValueRow[],
  limit: number
): DraftTargetScorePlayer[] {
  const enabledPositions = enabledRosterPositions(rosterRequirements);
  const valueByKey = buildFallbackValueIndex(valueRows);
  const groups = new Map<string, DraftTargetScorePlayer[]>();
  for (const player of players) {
    const position = normalizePrimaryPosition(player.position);
    if (!position || !enabledPositions.includes(position)) continue;
    groups.set(position, [...(groups.get(position) ?? []), player]);
  }
  for (const [position, rows] of groups.entries()) {
    groups.set(position, rows.sort((a, b) => fallbackValueFor(b, valueByKey) - fallbackValueFor(a, valueByKey) || (a.player_name ?? "").localeCompare(b.player_name ?? "")));
  }

  const selected: DraftTargetScorePlayer[] = [];
  const seen = new Set<string>();
  let cursor = 0;
  while (selected.length < limit && groups.size > 0) {
    let addedInPass = false;
    for (const position of enabledPositions) {
      const group = groups.get(position);
      if (!group?.length) continue;
      const player = group[cursor];
      if (!player) continue;
      const key = player.sleeper_player_id ?? player.matched_player_id ?? `${player.player_name}|${player.position}|${player.team}`;
      if (!seen.has(key)) {
        selected.push(player);
        seen.add(key);
        addedInPass = true;
        if (selected.length >= limit) break;
      }
    }
    cursor += 1;
    if (!addedInPass) break;
  }

  return selected;
}

function enabledRosterPositions(requirements: ReturnType<typeof buildNormalizedRosterRequirements>): string[] {
  const enabled = new Set<string>();
  for (const position of POSITION_GROUPS) {
    if (requirements.directStarters[position] > 0) enabled.add(position);
  }
  if (requirements.offensiveFlexCount > 0) ["RB", "WR", "TE"].forEach((position) => enabled.add(position));
  if (requirements.superflexCount > 0) ["QB", "RB", "WR", "TE"].forEach((position) => enabled.add(position));
  if (requirements.idpFlexCount > 0) ["DL", "LB", "DB"].forEach((position) => enabled.add(position));
  return POSITION_GROUPS.filter((position) => enabled.has(position));
}

function buildFallbackValueIndex(rows: H10LeagueValueRow[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const row of rows) {
    const value = row.riskAdjustedValue ?? row.pointsAboveReplacement ?? row.medianPoints ?? 0;
    index.set(`id:${row.entityId}`, value);
    index.set(`name:${normalizePlayerName(row.displayName)}|${normalizePrimaryPosition(row.positionGroup || row.position) ?? row.position}|${row.team ?? ""}`, value);
  }
  return index;
}

function fallbackValueFor(player: DraftTargetScorePlayer, index: Map<string, number>): number {
  return (
    (player.matched_player_id ? index.get(`id:${player.matched_player_id}`) : undefined) ??
    index.get(`name:${normalizePlayerName(player.player_name ?? "")}|${normalizePrimaryPosition(player.position) ?? player.position}|${player.team ?? ""}`) ??
    0
  );
}

function emptyFallbackDiagnostics(includeDiagnosticFallbacks: boolean): FallbackRelevanceDiagnostics {
  return {
    fallbackRowsTotal: 0,
    fallbackRowsIncluded: 0,
    fallbackRowsExcluded: 0,
    fallbackRelevanceDistribution: {},
    projectionlessFallbackRows: 0,
    historicalOnlyRows: 0,
    diagnosticFallbackRows: 0,
    draftRelevantFallbackRows: 0,
    formatExcludedFallbackRows: 0,
    includeDiagnosticFallbacks,
    topExcludedFallbackExamples: [],
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
