import "server-only";

import { buildWeeklyStatsInsert } from "@/lib/providers/data-builders";
import type { PlayerWeeklyStatsInsert, PlayerWeeklyStatsRow, SeasonType } from "@/lib/providers/data-types";
import { normalizeProviderName } from "@/lib/providers/constants";
import {
  buildWeeklyStatsConflictScope,
  normalizeListQueryOptions,
  rejectIfEmptyIds,
  scopeToKey,
  validateBatchPlan
} from "@/lib/providers/repositories/repository-helpers";
import {
  MIGRATION_005_DEPENDENCY_NOTE,
  assertUuid,
  getReadClient,
  getWriteClient,
  mapDatabaseError,
  validateSeason,
  validateWeek,
  verifyExternalMapping,
  type ReadClient,
  type WriteClient
} from "@/lib/providers/repositories/shared";

type WeeklyStatsRecord = Omit<PlayerWeeklyStatsRow, "provider" | "season_type" | "home_away"> & {
  provider: string;
  season_type: string;
  home_away: string | null;
};

type MappingOptions = {
  requireVerifiedMapping?: boolean;
};

// Requires migration 005 to exist in the target Supabase project before these repositories are usable.
export const WEEKLY_STATS_REPOSITORY_NOTE = MIGRATION_005_DEPENDENCY_NOTE;

export async function upsertWeeklyStats(
  input: PlayerWeeklyStatsInsert,
  options: MappingOptions = {},
  client?: WriteClient
) {
  const supabase = getWriteClient(client);
  const row = buildWeeklyStatsInsert(input);
  await verifyExternalMapping(
    {
      playerId: row.player_id,
      provider: row.provider,
      providerExternalId: row.provider_external_id ?? null,
      requireVerifiedMapping: options.requireVerifiedMapping ?? true
    },
    supabase
  );

  const existing = await findExistingWeeklyStatsRow(row, supabase);
  if (existing) {
    const { data, error } = await supabase
      .from("player_weekly_stats")
      .update(row)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw mapDatabaseError(error);
    return mapWeeklyStatsRow(data);
  }

  const { data, error } = await supabase.from("player_weekly_stats").insert(row).select("*").single();
  if (error) throw mapDatabaseError(error);
  return mapWeeklyStatsRow(data);
}

export async function upsertWeeklyStatsBatch(
  inputs: PlayerWeeklyStatsInsert[],
  options: MappingOptions = {},
  client?: WriteClient
) {
  const supabase = getWriteClient(client);
  const rows = inputs.map((input) => buildWeeklyStatsInsert(input));
  validateBatchPlan(rows, (row) => scopeToKey(buildWeeklyStatsConflictScope(row)));

  for (const row of rows) {
    await verifyExternalMapping(
      {
        playerId: row.player_id,
        provider: row.provider,
        providerExternalId: row.provider_external_id ?? null,
        requireVerifiedMapping: options.requireVerifiedMapping ?? true
      },
      supabase
    );
  }

  const results: PlayerWeeklyStatsRow[] = [];
  for (const row of rows) {
    results.push(await upsertWeeklyStats(row, options, supabase));
  }
  return results;
}

export async function getWeeklyStatsForPlayer(
  input: {
    playerId: string;
    season: number;
    week?: number;
    provider?: string;
    seasonType?: SeasonType;
  },
  client?: ReadClient
) {
  assertUuid(input.playerId, "playerId");
  validateSeason(input.season);
  if (input.week !== undefined) validateWeek(input.week);
  const supabase = await getReadClient(client);

  let query = supabase
    .from("player_weekly_stats")
    .select("*")
    .eq("player_id", input.playerId)
    .eq("season", input.season)
    .order("week", { ascending: false })
    .order("game_date", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (input.week !== undefined) query = query.eq("week", input.week);
  if (input.provider) query = query.eq("provider", normalizeProviderName(input.provider));
  if (input.seasonType) query = query.eq("season_type", input.seasonType);

  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  return (data ?? []).map(mapWeeklyStatsRow);
}

export async function getWeeklyStatsForPlayers(
  input: { playerIds: string[]; season: number; week: number; provider?: string },
  client?: ReadClient
) {
  rejectIfEmptyIds(input.playerIds, "playerIds").forEach((playerId) => assertUuid(playerId, "playerId"));
  validateSeason(input.season);
  validateWeek(input.week);
  const supabase = await getReadClient(client);

  let query = supabase
    .from("player_weekly_stats")
    .select("*")
    .in("player_id", input.playerIds)
    .eq("season", input.season)
    .eq("week", input.week)
    .order("player_id")
    .order("provider")
    .order("game_date", { ascending: false, nullsFirst: false });

  if (input.provider) query = query.eq("provider", normalizeProviderName(input.provider));
  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  return (data ?? []).map(mapWeeklyStatsRow);
}

export async function getLatestWeeklyStatsForPlayer(
  input: { playerId: string; provider?: string; season?: number },
  client?: ReadClient
) {
  assertUuid(input.playerId, "playerId");
  if (input.season !== undefined) validateSeason(input.season);
  const supabase = await getReadClient(client);

  let query = supabase
    .from("player_weekly_stats")
    .select("*")
    .eq("player_id", input.playerId)
    .order("season", { ascending: false })
    .order("week", { ascending: false })
    .order("source_updated_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(1);

  if (input.provider) query = query.eq("provider", normalizeProviderName(input.provider));
  if (input.season !== undefined) query = query.eq("season", input.season);

  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  return data?.[0] ? mapWeeklyStatsRow(data[0]) : null;
}

export async function listWeeklyStatsByPosition(
  input: { positionGroup: string; season: number; week: number; provider?: string; limit?: number; offset?: number },
  client?: ReadClient
) {
  validateSeason(input.season);
  validateWeek(input.week);
  const { limit, offset } = normalizeListQueryOptions(input);
  const supabase = await getReadClient(client);

  let query = supabase
    .from("player_weekly_stats")
    .select("*")
    .eq("position_group", input.positionGroup)
    .eq("season", input.season)
    .eq("week", input.week)
    .order("provider_fantasy_points", { ascending: false, nullsFirst: false })
    .order("player_id")
    .range(offset, offset + limit - 1);

  if (input.provider) query = query.eq("provider", normalizeProviderName(input.provider));
  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  return (data ?? []).map(mapWeeklyStatsRow);
}

async function findExistingWeeklyStatsRow(row: PlayerWeeklyStatsInsert, client: WriteClient) {
  const scope = buildWeeklyStatsConflictScope(row);
  let query = client
    .from("player_weekly_stats")
    .select("id,*")
    .eq("player_id", scope.playerId)
    .eq("provider", scope.provider)
    .eq("season", scope.season)
    .eq("week", scope.week)
    .eq("season_type", scope.seasonType);

  if (scope.mode === "with_game") {
    query = query.eq("game_id", scope.gameId);
  } else {
    query = query.is("game_id", null);
  }

  query = scope.dataVersion === null ? query.is("data_version", null) : query.eq("data_version", scope.dataVersion);

  const { data, error } = await query.maybeSingle();
  if (error) throw mapDatabaseError(error);
  return data ? mapWeeklyStatsRow(data as WeeklyStatsRecord) : null;
}

function mapWeeklyStatsRow(row: WeeklyStatsRecord): PlayerWeeklyStatsRow {
  return {
    ...row,
    provider: normalizeProviderName(row.provider),
    season_type: row.season_type as SeasonType,
    home_away: (row.home_away as PlayerWeeklyStatsRow["home_away"]) ?? null
  };
}
