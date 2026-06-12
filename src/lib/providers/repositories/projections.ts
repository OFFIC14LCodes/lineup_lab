import "server-only";

import { buildProjectionInsert } from "@/lib/providers/data-builders";
import type {
  PlayerProjectionInsert,
  PlayerProjectionRow,
  ProjectionType,
  SeasonType
} from "@/lib/providers/data-types";
import { normalizeProviderName } from "@/lib/providers/constants";
import {
  buildProjectionScope,
  normalizeListQueryOptions,
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

type ProjectionRecord = Omit<PlayerProjectionRow, "provider" | "season_type" | "projection_type"> & {
  provider: string;
  season_type: string;
  projection_type: string;
};

export const PROJECTIONS_REPOSITORY_NOTE = MIGRATION_005_DEPENDENCY_NOTE;

export async function upsertProjection(input: PlayerProjectionInsert, client?: WriteClient) {
  const supabase = getWriteClient(client);
  const row = buildProjectionInsert(input);
  await verifyExternalMapping(
    {
      playerId: row.player_id,
      provider: row.provider,
      providerExternalId: row.provider_external_id ?? null,
      requireVerifiedMapping: true
    },
    supabase
  );
  const existing = await findExistingProjectionRow(row, supabase);

  if (existing) {
    const { data, error } = await supabase
      .from("player_projections")
      .update(row)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw mapDatabaseError(error);
    return mapProjectionRow(data);
  }

  const { data, error } = await supabase.from("player_projections").insert(row).select("*").single();
  if (error) throw mapDatabaseError(error);
  return mapProjectionRow(data);
}

export async function upsertProjectionsBatch(inputs: PlayerProjectionInsert[], client?: WriteClient) {
  const supabase = getWriteClient(client);
  const rows = inputs.map((input) => buildProjectionInsert(input));
  validateBatchPlan(rows, (row) => scopeToKey(buildProjectionScope(row)));

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

  const results: PlayerProjectionRow[] = [];
  for (const row of rows) {
    results.push(await upsertProjection(row, supabase));
  }
  return results;
}

export async function getProjectionForPlayer(
  input: {
    playerId: string;
    season: number;
    week?: number | null;
    provider?: string;
    projectionType?: ProjectionType;
    scoringFormat?: string | null;
    version?: string;
  },
  client?: ReadClient
) {
  assertUuid(input.playerId, "playerId");
  validateSeason(input.season);
  if (input.week !== undefined && input.week !== null) validateWeek(input.week);
  const supabase = await getReadClient(client);

  let query = supabase
    .from("player_projections")
    .select("*")
    .eq("player_id", input.playerId)
    .eq("season", input.season)
    .order("source_updated_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (input.week === null) query = query.is("week", null);
  if (input.week !== undefined && input.week !== null) query = query.eq("week", input.week);
  if (input.provider) query = query.eq("provider", normalizeProviderName(input.provider));
  if (input.projectionType) query = query.eq("projection_type", input.projectionType);
  if (input.scoringFormat === null) query = query.is("scoring_format", null);
  if (input.scoringFormat) query = query.eq("scoring_format", input.scoringFormat);
  if (input.version) query = query.eq("version", input.version);

  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  return (data ?? []).map(mapProjectionRow);
}

export async function getCurrentWeeklyProjections(
  input: {
    playerIds?: string[];
    season: number;
    week: number;
    provider?: string;
    scoringFormat?: string | null;
    positionGroup?: string;
    limit?: number;
    offset?: number;
  },
  client?: ReadClient
) {
    validateSeason(input.season);
    validateWeek(input.week);
    const { limit, offset } = normalizeListQueryOptions(input);
    const supabase = await getReadClient(client);

    let query = supabase
      .from("player_projections")
      .select("*")
      .eq("season", input.season)
      .eq("week", input.week)
      .eq("projection_type", "weekly")
      .eq("version", "current")
      .order("provider_fantasy_points", { ascending: false, nullsFirst: false })
      .order("player_id")
      .range(offset, offset + limit - 1);

    if (input.playerIds?.length) {
      input.playerIds.forEach((playerId) => assertUuid(playerId, "playerId"));
      query = query.in("player_id", input.playerIds);
    }
    if (input.provider) query = query.eq("provider", normalizeProviderName(input.provider));
    if (input.positionGroup) query = query.eq("position_group", input.positionGroup);
    if (input.scoringFormat === null) query = query.is("scoring_format", null);
    if (input.scoringFormat) query = query.eq("scoring_format", input.scoringFormat);

    const { data, error } = await query;
    if (error) throw mapDatabaseError(error);
    return (data ?? []).map(mapProjectionRow);
}

export async function getCurrentSeasonProjections(
  input: {
    playerIds?: string[];
    season: number;
    provider?: string;
    projectionType?: ProjectionType;
    scoringFormat?: string | null;
    positionGroup?: string;
    limit?: number;
    offset?: number;
  },
  client?: ReadClient
) {
  validateSeason(input.season);
  const { limit, offset } = normalizeListQueryOptions(input);
  const supabase = await getReadClient(client);

  let query = supabase
    .from("player_projections")
    .select("*")
    .eq("season", input.season)
    .is("week", null)
    .eq("version", "current")
    .order("provider_fantasy_points", { ascending: false, nullsFirst: false })
    .order("player_id")
    .range(offset, offset + limit - 1);

  if (input.playerIds?.length) {
    input.playerIds.forEach((playerId) => assertUuid(playerId, "playerId"));
    query = query.in("player_id", input.playerIds);
  }
  if (input.provider) query = query.eq("provider", normalizeProviderName(input.provider));
  if (input.projectionType) query = query.eq("projection_type", input.projectionType);
  if (input.positionGroup) query = query.eq("position_group", input.positionGroup);
  if (input.scoringFormat === null) query = query.is("scoring_format", null);
  if (input.scoringFormat) query = query.eq("scoring_format", input.scoringFormat);

  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  return (data ?? []).map(mapProjectionRow);
}

export async function getLatestProjectionForPlayer(
  input: { playerId: string; provider?: string; projectionType?: ProjectionType },
  client?: ReadClient
) {
  assertUuid(input.playerId, "playerId");
  const supabase = await getReadClient(client);

  let query = supabase
    .from("player_projections")
    .select("*")
    .eq("player_id", input.playerId)
    .order("source_updated_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(1);

  if (input.provider) query = query.eq("provider", normalizeProviderName(input.provider));
  if (input.projectionType) query = query.eq("projection_type", input.projectionType);

  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  return data?.[0] ? mapProjectionRow(data[0]) : null;
}

async function findExistingProjectionRow(row: PlayerProjectionInsert, client: WriteClient) {
  const scope = buildProjectionScope(row);
  let query = client
    .from("player_projections")
    .select("*")
    .eq("player_id", scope.playerId)
    .eq("provider", scope.provider)
    .eq("season", scope.season)
    .eq("season_type", scope.seasonType)
    .eq("projection_type", scope.projectionType)
    .eq("version", scope.version);

  if (scope.mode === "weekly") {
    query = query.eq("week", scope.week);
  } else {
    query = query.is("week", null);
  }

  query = scope.scoringFormat === null ? query.is("scoring_format", null) : query.eq("scoring_format", scope.scoringFormat);

  const { data, error } = await query.maybeSingle();
  if (error) throw mapDatabaseError(error);
  return data ? mapProjectionRow(data as ProjectionRecord) : null;
}

function mapProjectionRow(row: ProjectionRecord): PlayerProjectionRow {
  return {
    ...row,
    provider: normalizeProviderName(row.provider),
    season_type: row.season_type as SeasonType,
    projection_type: row.projection_type as ProjectionType
  };
}
