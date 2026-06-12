import "server-only";

import { normalizePlayerName, normalizePositionGroup, normalizeTeam } from "@/lib/players/normalize";
import type { ProviderOrchestrationDependencies } from "@/lib/providers/orchestration/dependencies";
import type {
  CandidatePlayerLookupInput,
  ExternalMappingLookupResult,
  IdentityLookupInput,
  ProviderCandidatePlayer
} from "@/lib/providers/orchestration/types";
import { normalizeProviderName } from "@/lib/providers/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertWeeklyStats } from "@/lib/providers/repositories/weekly-stats";
import { upsertSeasonStats } from "@/lib/providers/repositories/season-stats";
import { upsertProjection } from "@/lib/providers/repositories/projections";
import { addInjuryObservation, replaceCurrentInjuryObservation } from "@/lib/providers/repositories/injuries";

const MAX_CANDIDATE_RESULTS = 10;

export async function getExistingExternalMappings(input: IdentityLookupInput): Promise<ExternalMappingLookupResult[]> {
  const supabase = createAdminClient();
  const provider = normalizeProviderName(input.provider);
  const { data, error } = await supabase
    .from("player_external_ids")
    .select("player_id,provider,external_id,external_type,mapping_status,mapping_method,confidence,verified_at,team,position_group")
    .eq("provider", provider)
    .eq("external_id", input.providerExternalId)
    .eq("external_type", input.externalType);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    playerId: row.player_id,
    provider: provider,
    externalId: row.external_id,
    externalType: row.external_type,
    mappingStatus: row.mapping_status,
    mappingMethod: row.mapping_method,
    confidence: row.confidence,
    verifiedAt: row.verified_at,
    team: normalizeTeam(row.team),
    positionGroup: normalizePositionGroup(row.position_group)
  }));
}

export async function findCandidatePlayers(input: CandidatePlayerLookupInput): Promise<ProviderCandidatePlayer[]> {
  const supabase = createAdminClient();
  const team = normalizeTeam(input.team);
  const positionGroup = normalizePositionGroup(input.positionGroup ?? input.rawPosition);
  const fullName = input.fullName ? normalizePlayerName(input.fullName) : null;
  const fallbackName = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  const normalizedName = fullName || (fallbackName ? normalizePlayerName(fallbackName) : null);

  if (input.externalType === "team_defense") {
    if (!team) return [];
    const { data, error } = await supabase
      .from("players")
      .select("id,sleeper_player_id,full_name,first_name,last_name,team,primary_position,position_group,side_of_ball,metadata_json,normalized_name")
      .eq("team", team)
      .eq("position_group", "DEF")
      .eq("active", true)
      .order("full_name")
      .limit(MAX_CANDIDATE_RESULTS);

    if (error) throw error;
    return data ?? [];
  }

  if (!normalizedName) return [];

  let query = supabase
    .from("players")
    .select("id,sleeper_player_id,full_name,first_name,last_name,team,primary_position,position_group,side_of_ball,metadata_json,normalized_name")
    .eq("normalized_name", normalizedName)
    .eq("active", true)
    .order("team")
    .order("full_name")
    .limit(MAX_CANDIDATE_RESULTS);

  if (team) query = query.eq("team", team);
  if (positionGroup) query = query.eq("position_group", positionGroup);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export function createProviderOrchestrationDependencies(): ProviderOrchestrationDependencies {
  return {
    getExistingExternalMappings,
    findCandidatePlayers,
    upsertWeeklyStats,
    upsertSeasonStats,
    upsertProjection,
    addInjuryObservation,
    replaceCurrentInjuryObservation
  };
}
