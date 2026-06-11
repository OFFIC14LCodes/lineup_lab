import {
  getDraft,
  getDraftPicks,
  getLeague,
  getLeagueDrafts,
  getLeagueRosters,
  getLeagueUsers,
  getSleeperUserByUsername,
  getUserLeagues
} from "@/lib/sleeper/client";
import type { SleeperDraftPick, SleeperLeagueUser } from "@/lib/sleeper/types";
import { createAdminClient } from "@/lib/supabase/admin";

type Json = Record<string, unknown>;

function leagueFlags(league: Awaited<ReturnType<typeof getLeague>>) {
  const rosterPositions = league.roster_positions ?? [];
  const scoring = league.scoring_settings ?? {};
  const settings = league.settings ?? {};

  return {
    is_dynasty: settings.type === 2 || league.metadata?.type === "dynasty",
    is_best_ball: league.metadata?.best_ball === "1" || settings.best_ball === 1,
    is_superflex: rosterPositions.includes("SUPER_FLEX"),
    is_two_qb: rosterPositions.filter((slot) => slot === "QB").length > 1,
    te_premium: Number(scoring.rec_te_bonus ?? 0)
  };
}

function pickName(pick: SleeperDraftPick) {
  return [pick.metadata?.first_name, pick.metadata?.last_name].filter(Boolean).join(" ") || null;
}

function pickedAt(pick: SleeperDraftPick) {
  return pick.picked_at ? new Date(pick.picked_at).toISOString() : null;
}

export async function connectSleeperAccount(userId: string, username: string) {
  const sleeperUser = await getSleeperUserByUsername(username);
  const leagues = await getUserLeagues(sleeperUser.user_id);
  const supabase = createAdminClient();

  await supabase.from("profiles").upsert({
    id: userId,
    display_name: sleeperUser.display_name ?? sleeperUser.username
  });

  const { error } = await supabase.from("fantasy_accounts").upsert(
    {
      user_id: userId,
      platform: "sleeper",
      platform_user_id: sleeperUser.user_id,
      platform_username: sleeperUser.username,
      metadata_json: sleeperUser as Json
    },
    { onConflict: "user_id,platform,platform_user_id" }
  );

  if (error) {
    throw error;
  }

  const rows = leagues.map((league) => ({
    user_id: userId,
    platform: "sleeper",
    platform_league_id: league.league_id,
    name: league.name,
    season: league.season,
    sport: league.sport,
    total_teams: league.total_rosters ?? null,
    status: league.status ?? null,
    ...leagueFlags(league),
    settings_json: league.settings ?? {},
    scoring_settings_json: league.scoring_settings ?? {},
    roster_positions_json: league.roster_positions ?? [],
    metadata_json: league as Json,
    last_synced_at: new Date().toISOString()
  }));

  if (rows.length > 0) {
    const { error: leagueError } = await supabase
      .from("leagues")
      .upsert(rows, { onConflict: "user_id,platform,platform_league_id" });

    if (leagueError) {
      throw leagueError;
    }
  }

  return { sleeperUser, leagues };
}

export async function importSleeperLeague(userId: string, platformLeagueId: string) {
  const supabase = createAdminClient();
  const startedAt = new Date().toISOString();

  try {
    const [league, rosters, managers, drafts] = await Promise.all([
      getLeague(platformLeagueId),
      getLeagueRosters(platformLeagueId),
      getLeagueUsers(platformLeagueId),
      getLeagueDrafts(platformLeagueId)
    ]);

    const { data: leagueRow, error: leagueError } = await supabase
      .from("leagues")
      .upsert(
        {
          user_id: userId,
          platform: "sleeper",
          platform_league_id: league.league_id,
          name: league.name,
          season: league.season,
          sport: league.sport,
          total_teams: league.total_rosters ?? null,
          status: league.status ?? null,
          ...leagueFlags(league),
          settings_json: league.settings ?? {},
          scoring_settings_json: league.scoring_settings ?? {},
          roster_positions_json: league.roster_positions ?? [],
          metadata_json: league as Json,
          last_synced_at: new Date().toISOString()
        },
        { onConflict: "user_id,platform,platform_league_id" }
      )
      .select()
      .single();

    if (leagueError || !leagueRow) {
      throw leagueError ?? new Error("Unable to upsert league.");
    }

    await supabase.from("league_users").delete().eq("league_id", leagueRow.id);
    if (managers.length > 0) {
      const { error } = await supabase.from("league_users").insert(
        managers.map((manager) => ({
          league_id: leagueRow.id,
          platform_user_id: manager.user_id,
          display_name: manager.display_name ?? manager.username ?? null,
          team_name: manager.metadata?.team_name ?? null,
          avatar: manager.avatar ?? null,
          metadata_json: manager as Json
        }))
      );
      if (error) throw error;
    }

    const managersById = new Map<string, SleeperLeagueUser>(
      managers.map((manager) => [manager.user_id, manager])
    );

    if (rosters.length > 0) {
      const { error } = await supabase.from("league_rosters").upsert(
        rosters.map((roster) => {
          const manager = roster.owner_id ? managersById.get(roster.owner_id) : null;
          return {
            league_id: leagueRow.id,
            platform_roster_id: String(roster.roster_id),
            owner_platform_user_id: roster.owner_id ?? null,
            owner_display_name: manager?.display_name ?? manager?.username ?? null,
            starters_json: roster.starters ?? [],
            players_json: roster.players ?? [],
            settings_json: roster.settings ?? {},
            metadata_json: roster as Json
          };
        }),
        { onConflict: "league_id,platform_roster_id" }
      );
      if (error) throw error;
    }

    const draftRows = [];
    for (const draft of drafts) {
      const draftDetails = await getDraft(draft.draft_id);
      draftRows.push({
        user_id: userId,
        league_id: leagueRow.id,
        platform: "sleeper",
        platform_draft_id: draftDetails.draft_id,
        status: draftDetails.status ?? null,
        draft_type: draftDetails.type ?? null,
        season: draftDetails.season ?? league.season,
        settings_json: draftDetails.settings ?? {},
        metadata_json: draftDetails as Json,
        last_synced_at: new Date().toISOString()
      });
    }

    if (draftRows.length > 0) {
      const { error } = await supabase
        .from("draft_rooms")
        .upsert(draftRows, { onConflict: "user_id,platform,platform_draft_id" });
      if (error) throw error;
    }

    await supabase.from("sync_runs").insert({
      user_id: userId,
      league_id: leagueRow.id,
      sync_type: "league_import",
      status: "success",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      metadata_json: { drafts: drafts.length, rosters: rosters.length, managers: managers.length }
    });

    return leagueRow;
  } catch (error) {
    await supabase.from("sync_runs").insert({
      user_id: userId,
      sync_type: "league_import",
      status: "error",
      message: error instanceof Error ? error.message : "Unknown sync error",
      started_at: startedAt,
      finished_at: new Date().toISOString()
    });
    throw error;
  }
}

export async function createDraftRoomForDraft(
  userId: string,
  leagueId: string,
  platformDraftId: string
) {
  const supabase = createAdminClient();
  const draft = await getDraft(platformDraftId);

  const { data, error } = await supabase
    .from("draft_rooms")
    .upsert(
      {
        user_id: userId,
        league_id: leagueId,
        platform: "sleeper",
        platform_draft_id: platformDraftId,
        status: draft.status ?? null,
        draft_type: draft.type ?? null,
        season: draft.season ?? null,
        settings_json: draft.settings ?? {},
        metadata_json: draft as Json,
        last_synced_at: new Date().toISOString()
      },
      { onConflict: "user_id,platform,platform_draft_id" }
    )
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error("Unable to create draft room.");
  }

  return data;
}

export async function syncDraftRoomPicks(userId: string, draftRoomId: string) {
  const supabase = createAdminClient();
  const { data: room, error: roomError } = await supabase
    .from("draft_rooms")
    .select("*")
    .eq("id", draftRoomId)
    .eq("user_id", userId)
    .single();

  if (roomError || !room) {
    throw roomError ?? new Error("Draft room not found.");
  }

  const [draft, picks] = await Promise.all([
    getDraft(room.platform_draft_id),
    getDraftPicks(room.platform_draft_id)
  ]);

  if (picks.length > 0) {
    const { error } = await supabase.from("draft_room_picks").upsert(
      picks.map((pick) => ({
        draft_room_id: room.id,
        platform_pick_id: `${room.platform_draft_id}:${pick.pick_no}`,
        pick_no: pick.pick_no,
        round: pick.round ?? null,
        pick_in_round: pick.draft_slot ?? null,
        platform_roster_id: pick.roster_id ? String(pick.roster_id) : null,
        picked_by_platform_user_id: pick.picked_by ?? null,
        sleeper_player_id: pick.player_id ?? pick.metadata?.player_id ?? null,
        player_name: pickName(pick),
        position: pick.metadata?.position ?? null,
        team: pick.metadata?.team ?? null,
        metadata_json: pick as Json,
        picked_at: pickedAt(pick)
      })),
      { onConflict: "draft_room_id,pick_no" }
    );

    if (error) {
      throw error;
    }
  }

  const { error: updateError } = await supabase
    .from("draft_rooms")
    .update({
      status: draft.status ?? room.status,
      settings_json: draft.settings ?? room.settings_json,
      metadata_json: draft as Json,
      last_synced_at: new Date().toISOString()
    })
    .eq("id", room.id)
    .eq("user_id", userId);

  if (updateError) {
    throw updateError;
  }

  return { room, picks };
}
