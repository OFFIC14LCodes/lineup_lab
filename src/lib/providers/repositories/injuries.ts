import "server-only";

import { buildInjuryInsert } from "@/lib/providers/data-builders";
import type { PlayerInjuryInsert, PlayerInjuryRow } from "@/lib/providers/data-types";
import { normalizeProviderName } from "@/lib/providers/constants";
import {
  buildInjuryDedupeKey,
  normalizeListQueryOptions,
  planCurrentInjuryTransition,
  rejectIfEmptyIds,
  validateBatchPlan
} from "@/lib/providers/repositories/repository-helpers";
import {
  MIGRATION_005_DEPENDENCY_NOTE,
  ProviderRepositoryPartialFailureError,
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

type InjuryRecord = Omit<PlayerInjuryRow, "provider"> & {
  provider: string;
};

export const INJURIES_REPOSITORY_NOTE = `${MIGRATION_005_DEPENDENCY_NOTE} replaceCurrentInjuryObservation is not transactional across multiple Supabase calls.`;

export async function addInjuryObservation(input: PlayerInjuryInsert, client?: WriteClient) {
  const supabase = getWriteClient(client);
  const row = buildInjuryInsert(input);
  await verifyExternalMapping(
    {
      playerId: row.player_id,
      provider: row.provider,
      providerExternalId: row.provider_external_id ?? null,
      requireVerifiedMapping: true
    },
    supabase
  );
  const existing = await findExistingInjuryObservation(row, supabase);
  if (existing) return existing;

  const { data, error } = await supabase.from("player_injuries").insert(row).select("*").single();
  if (error) throw mapDatabaseError(error);
  return mapInjuryRow(data);
}

export async function addInjuryObservationsBatch(inputs: PlayerInjuryInsert[], client?: WriteClient) {
  const supabase = getWriteClient(client);
  const rows = inputs.map((input) => buildInjuryInsert(input));
  validateBatchPlan(rows, (row) =>
    JSON.stringify(buildInjuryDedupeKey(row) ?? { player_id: row.player_id, provider: row.provider, observed_at: row.observed_at ?? null })
  );

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

  const results: PlayerInjuryRow[] = [];
  for (const row of rows) {
    results.push(await addInjuryObservation(row, supabase));
  }
  return results;
}

export async function replaceCurrentInjuryObservation(input: PlayerInjuryInsert, client?: WriteClient) {
  const supabase = getWriteClient(client);
  const row = buildInjuryInsert({ ...input, is_current: true });
  await verifyExternalMapping(
    {
      playerId: row.player_id,
      provider: row.provider,
      providerExternalId: row.provider_external_id ?? null,
      requireVerifiedMapping: true
    },
    supabase
  );

  const { data: currentRows, error: currentError } = await supabase
    .from("player_injuries")
    .select("id,player_id,provider,is_current")
    .eq("player_id", row.player_id)
    .eq("provider", row.provider)
    .eq("is_current", true);

  if (currentError) throw mapDatabaseError(currentError);

  const plan = planCurrentInjuryTransition({
    playerId: row.player_id,
    provider: row.provider,
    existingCurrentRows: currentRows ?? []
  });

  if (plan.rowsToDeactivate.length > 0) {
    const { error } = await supabase.from("player_injuries").update({ is_current: false }).in("id", plan.rowsToDeactivate);
    if (error) throw mapDatabaseError(error);
  }

  const existing = await findExistingInjuryObservation(row, supabase);
  if (existing) return existing;

  const { data, error } = await supabase.from("player_injuries").insert(row).select("*").single();
  if (error) {
    throw new ProviderRepositoryPartialFailureError(
      "Prior current injury rows were cleared, but inserting the replacement observation failed.",
      { cause: error, rowsDeactivated: plan.rowsToDeactivate }
    );
  }

  return mapInjuryRow(data);
}

export async function getCurrentInjuryForPlayer(
  input: { playerId: string; provider?: string },
  client?: ReadClient
) {
  assertUuid(input.playerId, "playerId");
  const supabase = await getReadClient(client);

  let query = supabase
    .from("player_injuries")
    .select("*")
    .eq("player_id", input.playerId)
    .eq("is_current", true)
    .order("source_updated_at", { ascending: false, nullsFirst: false })
    .order("observed_at", { ascending: false })
    .limit(1);

  if (input.provider) query = query.eq("provider", normalizeProviderName(input.provider));
  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  return data?.[0] ? mapInjuryRow(data[0]) : null;
}

export async function getCurrentInjuriesForPlayers(
  input: { playerIds: string[]; provider?: string },
  client?: ReadClient
) {
  rejectIfEmptyIds(input.playerIds, "playerIds").forEach((playerId) => assertUuid(playerId, "playerId"));
  const supabase = await getReadClient(client);

  let query = supabase
    .from("player_injuries")
    .select("*")
    .in("player_id", input.playerIds)
    .eq("is_current", true)
    .order("player_id")
    .order("source_updated_at", { ascending: false, nullsFirst: false })
    .order("observed_at", { ascending: false });

  if (input.provider) query = query.eq("provider", normalizeProviderName(input.provider));
  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  return (data ?? []).map(mapInjuryRow);
}

export async function getInjuryHistoryForPlayer(
  input: { playerId: string; provider?: string; season?: number; limit?: number; offset?: number },
  client?: ReadClient
) {
  assertUuid(input.playerId, "playerId");
  if (input.season !== undefined) validateSeason(input.season);
  const { limit, offset } = normalizeListQueryOptions(input);
  const supabase = await getReadClient(client);

  let query = supabase
    .from("player_injuries")
    .select("*")
    .eq("player_id", input.playerId)
    .order("source_updated_at", { ascending: false, nullsFirst: false })
    .order("observed_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (input.provider) query = query.eq("provider", normalizeProviderName(input.provider));
  if (input.season !== undefined) query = query.eq("season", input.season);
  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  return (data ?? []).map(mapInjuryRow);
}

export async function listCurrentInjuries(
  input: { provider?: string; team?: string; season?: number; week?: number; limit?: number; offset?: number },
  client?: ReadClient
) {
  if (input.season !== undefined) validateSeason(input.season);
  if (input.week !== undefined) validateWeek(input.week);
  const { limit, offset } = normalizeListQueryOptions(input);
  const supabase = await getReadClient(client);

  let query = supabase
    .from("player_injuries")
    .select("*")
    .eq("is_current", true)
    .order("source_updated_at", { ascending: false, nullsFirst: false })
    .order("observed_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (input.provider) query = query.eq("provider", normalizeProviderName(input.provider));
  if (input.team) query = query.eq("team", input.team.toUpperCase());
  if (input.season !== undefined) query = query.eq("season", input.season);
  if (input.week !== undefined) query = query.eq("week", input.week);

  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  return (data ?? []).map(mapInjuryRow);
}

async function findExistingInjuryObservation(row: PlayerInjuryInsert, client: WriteClient) {
  const dedupe = buildInjuryDedupeKey(row);
  if (!dedupe) return null;

  let query = client
    .from("player_injuries")
    .select("*")
    .eq("player_id", dedupe.playerId)
    .eq("provider", dedupe.provider)
    .eq("source_updated_at", dedupe.sourceUpdatedAt);

  query = dedupe.team === null ? query.is("team", null) : query.eq("team", dedupe.team);
  query = dedupe.status === null ? query.is("status", null) : query.eq("status", dedupe.status);
  query = dedupe.practiceStatus === null ? query.is("practice_status", null) : query.eq("practice_status", dedupe.practiceStatus);
  query = dedupe.gameStatus === null ? query.is("game_status", null) : query.eq("game_status", dedupe.gameStatus);
  query = dedupe.bodyPart === null ? query.is("body_part", null) : query.eq("body_part", dedupe.bodyPart);
  query = dedupe.injuryType === null ? query.is("injury_type", null) : query.eq("injury_type", dedupe.injuryType);

  const { data, error } = await query.maybeSingle();
  if (error) throw mapDatabaseError(error);
  return data ? mapInjuryRow(data as InjuryRecord) : null;
}

function mapInjuryRow(row: InjuryRecord): PlayerInjuryRow {
  return {
    ...row,
    provider: normalizeProviderName(row.provider)
  };
}
