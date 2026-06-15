// H10.7 — seed deterministic War Room validation draft rooms.
//
// Mutates only validation-marked draft rooms and ranking rows. Does not write
// recommendations, projections, H10 values, or user production draft rooms.

import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import {
  buildH10ValidationSeedPlan,
  cleanupFilters,
  rankingSource,
  type H10ValidationLeagueCandidate,
  type H10ValidationSeedRoomPlan,
} from "@/lib/draft/h10-validation-room-seed";
import type { H10LeagueValueRow } from "@/lib/projections/h10-league-value";
import { createAdminClient } from "@/lib/supabase/admin";

type Args = {
  cleanup: boolean;
};

type PlayerLookupRow = {
  id: string;
  sleeper_player_id: string | null;
  full_name: string | null;
  position: string | null;
  team: string | null;
};

loadLocalEnv();

async function main() {
  const args = parseArgs();
  const client = createAdminClient();
  if (args.cleanup) {
    const cleanup = await cleanupValidationRows();
    writeInventory({ mode: "cleanup", cleanup });
    console.log(JSON.stringify({ mode: "cleanup", cleanup }, null, 2));
    return;
  }

  const valueRows = loadH10ValueRows();
  const leagues = await loadLeagues();
  const playerLookup = await loadPlayerLookup([...new Set(valueRows.map((row) => row.entityId))]);
  const plan = buildH10ValidationSeedPlan({ leagues, valueRows, playerLookup });
  const createdRooms = [];

  for (const room of plan.rooms) {
    const league = leagues.find((candidate) => candidate.id === room.leagueId);
    if (!league) continue;
    await client.from("draft_rooms").upsert(
      {
        user_id: room.userId,
        league_id: room.leagueId,
        platform: "h10_validation",
        platform_draft_id: room.platformDraftId,
        status: "pre_draft",
        draft_type: "snake",
        season: "2026",
        settings_json: { teams: 12, rounds: 18, roster_positions: room.rosterSlots },
        metadata_json: room.metadata,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform,platform_draft_id" }
    ).throwOnError();

    const { data: draftRoom } = await client
      .from("draft_rooms")
      .select("id")
      .eq("user_id", room.userId)
      .eq("platform", "h10_validation")
      .eq("platform_draft_id", room.platformDraftId)
      .single()
      .throwOnError();

    await seedRoster(room);
    await refreshRankings(room);
    createdRooms.push({
      profileId: room.profileId,
      draftRoomId: draftRoom.id,
      leagueId: room.leagueId,
      leagueName: league.name,
      rankingsSeeded: room.players.length,
      positions: [...new Set(room.players.map((player) => player.position))].sort(),
      validationMarker: room.metadata,
    });
  }

  const artifact = {
    generatedAt: new Date().toISOString(),
    mode: "seed",
    strategy: "validation_seed_existing_h10_leagues",
    roomsCreatedOrFound: createdRooms,
    missingProfiles: plan.missingProfiles,
    schemaAudit: schemaAudit(),
  };
  writeInventory(artifact);
  console.log("\nH10.7 validation room seed");
  console.log(JSON.stringify(artifact, null, 2));
}

async function seedRoster(room: H10ValidationSeedRoomPlan) {
  const client = createAdminClient();
  await client
    .from("league_rosters")
    .upsert(
      {
        league_id: room.leagueId,
        platform_roster_id: "1",
        owner_platform_user_id: "h10-validation-user",
        owner_display_name: "[H10 Validation] Roster",
        starters_json: [],
        players_json: [],
        settings_json: {},
        metadata_json: room.metadata,
      },
      { onConflict: "league_id,platform_roster_id" }
    )
    .throwOnError();
}

async function refreshRankings(room: H10ValidationSeedRoomPlan) {
  const client = createAdminClient();
  await client
    .from("draft_rankings")
    .delete()
    .eq("user_id", room.userId)
    .eq("league_id", room.leagueId)
    .eq("source", rankingSource())
    .eq("format", room.rankingFormat)
    .throwOnError();

  const rows = room.players.map((player) => ({
    user_id: room.userId,
    league_id: room.leagueId,
    source: rankingSource(),
    season: "2026",
    format: room.rankingFormat,
    sleeper_player_id: player.sleeperPlayerId,
    player_name: player.displayName,
    normalized_player_name: normalizeName(player.displayName),
    position: player.position,
    team: player.team,
    rank: player.rank,
    adp: player.adp,
    projected_points: player.projectedPoints,
    dynasty_value: null,
    best_ball_value: null,
    superflex_value: null,
    te_premium_value: null,
    match_status: player.entityId ? "exact" : "unmatched",
    match_confidence: player.entityId ? 1 : null,
    matched_player_id: isUuid(player.entityId) ? player.entityId : null,
    metadata_json: {
      validation_room: true,
      validation: true,
      created_by_system: true,
      purpose: "h10_recommendation_validation",
      h10_validation_profile: room.profileId,
    },
  }));

  if (rows.length) await client.from("draft_rankings").insert(rows).throwOnError();
}

async function cleanupValidationRows() {
  const client = createAdminClient();
  const filters = cleanupFilters();
  const rankingDelete = await client.from("draft_rankings").delete().eq("source", filters.rankingSource).select("id");
  if (rankingDelete.error) throw rankingDelete.error;
  const roomDelete = await client
    .from("draft_rooms")
    .delete()
    .contains("metadata_json", { purpose: filters.draftRoomMetadataPurpose })
    .select("id");
  if (roomDelete.error) throw roomDelete.error;
  return {
    draftRankingsDeleted: rankingDelete.data?.length ?? 0,
    draftRoomsDeleted: roomDelete.data?.length ?? 0,
  };
}

async function loadLeagues(): Promise<H10ValidationLeagueCandidate[]> {
  const { data, error } = await createAdminClient()
    .from("leagues")
    .select("id,user_id,name,season,roster_positions_json,is_superflex,is_two_qb,te_premium,metadata_json")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as H10ValidationLeagueCandidate[];
}

async function loadPlayerLookup(playerIds: string[]) {
  const lookup: Record<string, PlayerLookupRow> = {};
  for (const batch of chunks(playerIds.filter(isUuid), 200)) {
    const { data, error } = await createAdminClient()
      .from("players")
      .select("id,sleeper_player_id,full_name,position,team")
      .in("id", batch);
    if (error) throw error;
    for (const row of (data ?? []) as PlayerLookupRow[]) lookup[row.id] = row;
  }
  return lookup;
}

function loadH10ValueRows(): H10LeagueValueRow[] {
  const artifactPath = path.join(process.cwd(), "artifacts", "projections", "h10-league-value.json");
  if (!existsSync(artifactPath)) return [];
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { rows?: H10LeagueValueRow[] };
  return artifact.rows ?? [];
}

function writeInventory(artifact: unknown) {
  const dir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "h10-war-room-validation-room-inventory.json"), JSON.stringify(artifact, null, 2));
}

function schemaAudit() {
  return [
    {
      table: "leagues",
      purpose: "Stores league format, roster positions, scoring settings, and ownership.",
      requiredFields: ["id", "user_id", "platform_league_id", "name", "season", "roster_positions_json", "metadata_json"],
      safeSeedStrategy: "Prefer existing owned leagues with H10 value rows; create no projection/value data.",
      cleanupStrategy: "Do not delete existing leagues; cleanup can target only validation-created rooms/rankings.",
      validationRowsCanBeIsolated: true,
    },
    {
      table: "draft_rooms",
      purpose: "Represents a draft room for War Room state.",
      requiredFields: ["user_id", "league_id", "platform", "platform_draft_id", "season", "settings_json", "metadata_json"],
      safeSeedStrategy: "Upsert deterministic platform=h10_validation and platform_draft_id=h10-validation-<profile>.",
      cleanupStrategy: "Delete only rows where metadata_json contains purpose=h10_recommendation_validation.",
      validationRowsCanBeIsolated: true,
    },
    {
      table: "draft_rankings",
      purpose: "Uploaded rankings source for remaining-player board.",
      requiredFields: ["user_id", "league_id", "source", "season", "format", "player_name", "rank", "matched_player_id"],
      safeSeedStrategy: "Delete and reinsert source=h10_validation rows per profile; use canonical matched_player_id when available.",
      cleanupStrategy: "Delete only source=h10_validation rows.",
      validationRowsCanBeIsolated: true,
    },
    {
      table: "draft_room_picks",
      purpose: "Synced selected-player picks used to remove drafted players and derive current pick.",
      requiredFields: ["draft_room_id", "pick_no"],
      safeSeedStrategy: "No pick rows are required for H10.7 seeded pre-draft rooms.",
      cleanupStrategy: "Cascade delete via validation draft room if picks are later added.",
      validationRowsCanBeIsolated: true,
    },
    {
      table: "league_rosters",
      purpose: "Owner roster mapping used for current roster context.",
      requiredFields: ["league_id", "platform_roster_id", "metadata_json"],
      safeSeedStrategy: "Upsert a single validation roster marker when missing.",
      cleanupStrategy: "Leave existing league roster rows intact; do not delete shared league-owned rows.",
      validationRowsCanBeIsolated: "partial",
    },
  ];
}

function parseArgs(): Args {
  return { cleanup: process.argv.slice(2).includes("--cleanup") };
}

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sep = trimmed.indexOf("=");
    if (sep === -1) continue;
    const key = trimmed.slice(0, sep).trim();
    if (!key || process.env[key]) continue;
    let value = trimmed.slice(sep + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
