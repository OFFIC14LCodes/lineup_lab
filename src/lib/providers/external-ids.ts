import "server-only";

import { normalizePositionGroup, normalizeTeam } from "@/lib/players/normalize";
import {
  normalizeExternalEntityType,
  normalizeExternalId,
  normalizeMappingMethod,
  normalizeMappingStatus,
  normalizeProviderName
} from "@/lib/providers/constants";
import type {
  ExternalEntityType,
  ExternalIdPlayerSummary,
  MappingMethod,
  PlayerExternalIdInsert,
  PlayerExternalIdLookup,
  PlayerExternalIdRow,
  PlayerExternalIdUpdate
} from "@/lib/providers/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ExternalIdRecord = {
  id: string;
  player_id: string;
  provider: string;
  external_id: string;
  external_type: string;
  season: number | null;
  team: string | null;
  position_group: string | null;
  mapping_status: string;
  mapping_method: string | null;
  confidence: number | null;
  metadata_json: Record<string, unknown> | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

type PlayerRecord = ExternalIdPlayerSummary;
type ReadClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;
type WriteClient = ReturnType<typeof createAdminClient>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ExternalIdMappingError extends Error {}

export class ExternalIdValidationError extends ExternalIdMappingError {}

export class ExternalIdMappingConflictError extends ExternalIdMappingError {}

export function detectExternalIdConflict(
  existingMapping: Pick<PlayerExternalIdRow, "player_id" | "provider" | "external_id" | "external_type"> | null,
  targetPlayerId: string
) {
  if (!existingMapping || existingMapping.player_id === targetPlayerId) {
    return null;
  }

  return `External ID ${existingMapping.provider}:${existingMapping.external_type}:${existingMapping.external_id} is already mapped to another player.`;
}

export async function listExternalIdsForPlayer(
  playerId: string,
  client?: ReadClient
): Promise<PlayerExternalIdRow[]> {
  assertUuid(playerId, "playerId");
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("player_external_ids")
    .select("*")
    .eq("player_id", playerId)
    .order("provider")
    .order("external_type")
    .order("season", { ascending: false, nullsFirst: true });

  if (error) {
    throw new ExternalIdMappingError(error.message);
  }

  return (data ?? []).map(mapExternalIdRow);
}

export async function getExternalIdForPlayer(
  playerId: string,
  lookup: Omit<PlayerExternalIdLookup, "externalId">,
  client?: ReadClient
): Promise<PlayerExternalIdRow | null> {
  assertUuid(playerId, "playerId");
  const supabase = client ?? (await createClient());
  const provider = normalizeProviderName(lookup.provider);
  const externalType = normalizeExternalEntityType(lookup.externalType);

  let query = supabase
    .from("player_external_ids")
    .select("*")
    .eq("player_id", playerId)
    .eq("provider", provider)
    .eq("external_type", externalType);

  if (lookup.season === undefined) {
    query = query.order("season", { ascending: false, nullsFirst: true }).limit(1);
    const { data, error } = await query;
    if (error) throw new ExternalIdMappingError(error.message);
    return data?.[0] ? mapExternalIdRow(data[0]) : null;
  }

  query = lookup.season === null ? query.is("season", null) : query.eq("season", lookup.season);
  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new ExternalIdMappingError(error.message);
  }

  return data ? mapExternalIdRow(data) : null;
}

export async function getPlayerByExternalId(
  lookup: PlayerExternalIdLookup,
  client?: ReadClient
): Promise<{ mapping: PlayerExternalIdRow; player: ExternalIdPlayerSummary | null } | null> {
  const supabase = client ?? (await createClient());
  const mapping = await getMappingByExternalId(lookup, supabase);

  if (!mapping) {
    return null;
  }

  const { data, error } = await supabase
    .from("players")
    .select("id,sleeper_player_id,full_name,team,primary_position,position_group,side_of_ball")
    .eq("id", mapping.player_id)
    .maybeSingle();

  if (error) {
    throw new ExternalIdMappingError(error.message);
  }

  return {
    mapping,
    player: data ? mapPlayerRow(data) : null
  };
}

export async function upsertExternalIdMapping(
  input: PlayerExternalIdInsert,
  client?: WriteClient
): Promise<PlayerExternalIdRow> {
  const supabase = client ?? createAdminClient();
  const payload = normalizeExternalIdPayload(input);

  const conflictingMapping = await getMappingByExternalId(
    {
      provider: payload.provider,
      externalId: payload.external_id,
      externalType: payload.external_type
    },
    supabase
  );
  const conflictMessage = detectExternalIdConflict(conflictingMapping, payload.player_id);
  if (conflictMessage) {
    throw new ExternalIdMappingConflictError(conflictMessage);
  }

  const existingPlayerMapping = await getExistingPlayerMapping(
    {
      playerId: payload.player_id,
      provider: payload.provider,
      externalType: payload.external_type,
      season: payload.season ?? null
    },
    supabase
  );

  if (existingPlayerMapping) {
    const { data, error } = await supabase
      .from("player_external_ids")
      .update(payload)
      .eq("id", existingPlayerMapping.id)
      .select("*")
      .single();

    if (error) {
      throw new ExternalIdMappingError(error.message);
    }

    return mapExternalIdRow(data);
  }

  const { data, error } = await supabase
    .from("player_external_ids")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new ExternalIdMappingError(error.message);
  }

  return mapExternalIdRow(data);
}

export async function markMappingVerified(
  mappingId: string,
  updates: {
    confidence?: number | null;
    mappingMethod?: MappingMethod | null;
    metadata?: Record<string, unknown>;
  } = {},
  client?: WriteClient
): Promise<PlayerExternalIdRow> {
  assertUuid(mappingId, "mappingId");
  const supabase = client ?? createAdminClient();

  const payload = normalizeMutableUpdate({
    confidence: updates.confidence ?? 1,
    mapping_status: "verified",
    mapping_method: updates.mappingMethod ?? "manual",
    metadata_json: updates.metadata
  });

  const { data, error } = await supabase
    .from("player_external_ids")
    .update({
      ...payload,
      verified_at: new Date().toISOString()
    })
    .eq("id", mappingId)
    .select("*")
    .single();

  if (error) {
    throw new ExternalIdMappingError(error.message);
  }

  return mapExternalIdRow(data);
}

export async function markMappingForReview(
  mappingId: string,
  updates: {
    confidence?: number | null;
    mappingMethod?: MappingMethod | null;
    metadata?: Record<string, unknown>;
  } = {},
  client?: WriteClient
): Promise<PlayerExternalIdRow> {
  assertUuid(mappingId, "mappingId");
  const supabase = client ?? createAdminClient();

  const payload = normalizeMutableUpdate({
    confidence: updates.confidence ?? null,
    mapping_status: "manual_review",
    mapping_method: updates.mappingMethod ?? "manual",
    metadata_json: updates.metadata
  });

  const { data, error } = await supabase
    .from("player_external_ids")
    .update({
      ...payload,
      verified_at: null
    })
    .eq("id", mappingId)
    .select("*")
    .single();

  if (error) {
    throw new ExternalIdMappingError(error.message);
  }

  return mapExternalIdRow(data);
}

async function getMappingByExternalId(lookup: PlayerExternalIdLookup, client: ReadClient) {
  const provider = normalizeProviderName(lookup.provider);
  const externalId = normalizeExternalId(lookup.externalId);
  const externalType = normalizeExternalEntityType(lookup.externalType);

  let query = client
    .from("player_external_ids")
    .select("*")
    .eq("provider", provider)
    .eq("external_id", externalId)
    .eq("external_type", externalType);

  if (lookup.season === undefined) {
    query = query.order("season", { ascending: false, nullsFirst: true }).limit(1);
    const { data, error } = await query;
    if (error) throw new ExternalIdMappingError(error.message);
    return data?.[0] ? mapExternalIdRow(data[0]) : null;
  }

  query = lookup.season === null ? query.is("season", null) : query.eq("season", lookup.season);
  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new ExternalIdMappingError(error.message);
  }
  return data ? mapExternalIdRow(data) : null;
}

async function getExistingPlayerMapping(
  lookup: {
    playerId: string;
    provider: string;
    externalType: ExternalEntityType;
    season: number | null;
  },
  client: ReadClient
) {
  let query = client
    .from("player_external_ids")
    .select("*")
    .eq("player_id", lookup.playerId)
    .eq("provider", lookup.provider)
    .eq("external_type", lookup.externalType);

  query = lookup.season === null ? query.is("season", null) : query.eq("season", lookup.season);
  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new ExternalIdMappingError(error.message);
  }

  return data ? mapExternalIdRow(data) : null;
}

function normalizeExternalIdPayload(input: PlayerExternalIdInsert) {
  assertUuid(input.player_id, "player_id");

  const season = normalizeSeason(input.season);
  const confidence = normalizeConfidence(input.confidence);

  return {
    player_id: input.player_id,
    provider: normalizeProviderName(input.provider),
    external_id: normalizeExternalId(input.external_id),
    external_type: normalizeExternalEntityType(input.external_type),
    season,
    team: normalizeTeam(input.team),
    position_group: input.position_group ? normalizePositionGroup(input.position_group) : null,
    mapping_status: normalizeMappingStatus(input.mapping_status),
    mapping_method: normalizeMappingMethod(input.mapping_method),
    confidence,
    metadata_json: input.metadata_json ?? {},
    verified_at: input.verified_at ?? null
  };
}

function normalizeMutableUpdate(update: {
  mapping_status?: string | null;
  mapping_method?: string | null;
  confidence?: number | null;
  metadata_json?: Record<string, unknown>;
}): PlayerExternalIdUpdate & { mapping_status?: string } {
  return {
    mapping_status: update.mapping_status ? normalizeMappingStatus(update.mapping_status) : undefined,
    mapping_method: update.mapping_method === undefined ? undefined : normalizeMappingMethod(update.mapping_method),
    confidence: normalizeConfidence(update.confidence),
    metadata_json: update.metadata_json
  };
}

function normalizeSeason(value?: number | null) {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || value < 1900 || value > 3000) {
    throw new ExternalIdValidationError("Season must be a four-digit year when provided.");
  }
  return value;
}

function normalizeConfidence(value?: number | null) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value < 0 || value > 1) {
    throw new ExternalIdValidationError("Confidence must be between 0 and 1.");
  }
  return value;
}

function assertUuid(value: string, label: string) {
  if (!UUID_PATTERN.test(value)) {
    throw new ExternalIdValidationError(`${label} must be a UUID.`);
  }
}

function mapExternalIdRow(row: ExternalIdRecord): PlayerExternalIdRow {
  return {
    id: row.id,
    player_id: row.player_id,
    provider: normalizeProviderName(row.provider),
    external_id: row.external_id,
    external_type: normalizeExternalEntityType(row.external_type),
    season: row.season,
    team: normalizeTeam(row.team),
    position_group: row.position_group ? normalizePositionGroup(row.position_group) : null,
    mapping_status: normalizeMappingStatus(row.mapping_status),
    mapping_method: row.mapping_method ? normalizeMappingMethod(row.mapping_method) : null,
    confidence: row.confidence,
    metadata_json: row.metadata_json ?? {},
    verified_at: row.verified_at,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapPlayerRow(row: PlayerRecord): ExternalIdPlayerSummary {
  return {
    id: row.id,
    sleeper_player_id: row.sleeper_player_id,
    full_name: row.full_name,
    team: normalizeTeam(row.team),
    primary_position: row.primary_position,
    position_group: row.position_group ? normalizePositionGroup(row.position_group) : null,
    side_of_ball: row.side_of_ball
  };
}
