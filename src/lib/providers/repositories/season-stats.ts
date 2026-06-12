import "server-only";

import { buildSeasonStatsInsert } from "@/lib/providers/data-builders";
import type { PlayerSeasonStatsInsert, PlayerSeasonStatsRow, SeasonType } from "@/lib/providers/data-types";
import { normalizeProviderName } from "@/lib/providers/constants";
import {
  buildSeasonStatsScope,
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
  verifyExternalMapping,
  type ReadClient,
  type WriteClient
} from "@/lib/providers/repositories/shared";

type SeasonStatsRecord = Omit<PlayerSeasonStatsRow, "provider" | "season_type"> & {
  provider: string;
  season_type: string;
};

export const SEASON_STATS_REPOSITORY_NOTE = MIGRATION_005_DEPENDENCY_NOTE;

export async function upsertSeasonStats(input: PlayerSeasonStatsInsert, client?: WriteClient) {
  const supabase = getWriteClient(client);
  const row = buildSeasonStatsInsert(input);
  await verifyExternalMapping(
    {
      playerId: row.player_id,
      provider: row.provider,
      providerExternalId: row.provider_external_id ?? null,
      requireVerifiedMapping: true
    },
    supabase
  );
  const existing = await findExistingSeasonStatsRow(row, supabase);

  if (existing) {
    const { data, error } = await supabase
      .from("player_season_stats")
      .update(row)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw mapDatabaseError(error);
    return mapSeasonStatsRow(data);
  }

  const { data, error } = await supabase.from("player_season_stats").insert(row).select("*").single();
  if (error) throw mapDatabaseError(error);
  return mapSeasonStatsRow(data);
}

export async function upsertSeasonStatsBatch(inputs: PlayerSeasonStatsInsert[], client?: WriteClient) {
  const supabase = getWriteClient(client);
  const rows = inputs.map((input) => buildSeasonStatsInsert(input));
  validateBatchPlan(rows, (row) => scopeToKey(buildSeasonStatsScope(row)));

  for (const row of rows) {
    await verifyExternalMapping(
      {
        playerId: row.player_id,
        provider: row.provider,
        providerExternalId: row.provider_external_id ?? null,
        requireVerifiedMapping: true
      },
      supabase
    );
  }

  const results: PlayerSeasonStatsRow[] = [];
  for (const row of rows) {
    results.push(await upsertSeasonStats(row, supabase));
  }
  return results;
}

export async function getSeasonStatsForPlayer(
  input: { playerId: string; season: number; provider?: string; seasonType?: SeasonType },
  client?: ReadClient
) {
  assertUuid(input.playerId, "playerId");
  validateSeason(input.season);
  const supabase = await getReadClient(client);

  let query = supabase
    .from("player_season_stats")
    .select("*")
    .eq("player_id", input.playerId)
    .eq("season", input.season)
    .order("provider")
    .order("updated_at", { ascending: false });

  if (input.provider) query = query.eq("provider", normalizeProviderName(input.provider));
  if (input.seasonType) query = query.eq("season_type", input.seasonType);

  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  return (data ?? []).map(mapSeasonStatsRow);
}

export async function getSeasonStatsForPlayers(
  input: { playerIds: string[]; season: number; provider?: string; seasonType?: SeasonType },
  client?: ReadClient
) {
  rejectIfEmptyIds(input.playerIds, "playerIds").forEach((playerId) => assertUuid(playerId, "playerId"));
  validateSeason(input.season);
  const supabase = await getReadClient(client);

  let query = supabase
    .from("player_season_stats")
    .select("*")
    .in("player_id", input.playerIds)
    .eq("season", input.season)
    .order("player_id")
    .order("provider");

  if (input.provider) query = query.eq("provider", normalizeProviderName(input.provider));
  if (input.seasonType) query = query.eq("season_type", input.seasonType);

  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  return (data ?? []).map(mapSeasonStatsRow);
}

export async function getLatestSeasonStatsForPlayer(
  input: { playerId: string; provider?: string; seasonType?: SeasonType },
  client?: ReadClient
) {
  assertUuid(input.playerId, "playerId");
  const supabase = await getReadClient(client);

  let query = supabase
    .from("player_season_stats")
    .select("*")
    .eq("player_id", input.playerId)
    .order("season", { ascending: false })
    .order("source_updated_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(1);

  if (input.provider) query = query.eq("provider", normalizeProviderName(input.provider));
  if (input.seasonType) query = query.eq("season_type", input.seasonType);

  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  return data?.[0] ? mapSeasonStatsRow(data[0]) : null;
}

export async function listSeasonStatsByPosition(
  input: { positionGroup: string; season: number; provider?: string; limit?: number; offset?: number },
  client?: ReadClient
) {
  validateSeason(input.season);
  const { limit, offset } = normalizeListQueryOptions(input);
  const supabase = await getReadClient(client);

  let query = supabase
    .from("player_season_stats")
    .select("*")
    .eq("position_group", input.positionGroup)
    .eq("season", input.season)
    .order("provider_fantasy_points", { ascending: false, nullsFirst: false })
    .order("player_id")
    .range(offset, offset + limit - 1);

  if (input.provider) query = query.eq("provider", normalizeProviderName(input.provider));
  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  return (data ?? []).map(mapSeasonStatsRow);
}

async function findExistingSeasonStatsRow(row: PlayerSeasonStatsInsert, client: WriteClient) {
  const scope = buildSeasonStatsScope(row);
  const { data, error } = await client
    .from("player_season_stats")
    .select("*")
    .eq("player_id", scope.playerId)
    .eq("provider", scope.provider)
    .eq("season", scope.season)
    .eq("season_type", scope.seasonType)
    .maybeSingle();

  if (error) throw mapDatabaseError(error);
  return data ? mapSeasonStatsRow(data as SeasonStatsRecord) : null;
}

function mapSeasonStatsRow(row: SeasonStatsRecord): PlayerSeasonStatsRow {
  return {
    ...row,
    provider: normalizeProviderName(row.provider),
    season_type: row.season_type as SeasonType
  };
}
