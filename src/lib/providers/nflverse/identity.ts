import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeGsisId } from "./normalize-gsis-id";

// Maps gsisId → canonical player_id for all resolved IDs.
export type GsisResolutionMap = Map<string, string>;

const BATCH_SIZE = 500;

// Bulk-resolves a set of GSIS IDs in one or more queries.
// Returns a map of gsisId → playerId for all resolved entries.
// Unresolved IDs are absent from the map.
// No name-only fallback.
export async function resolveGsisIdsBatch(
  gsisIds: Iterable<string>,
  client: SupabaseClient
): Promise<GsisResolutionMap> {
  const ids = [
    ...new Set(
      [...gsisIds].map(normalizeGsisId).filter((id): id is string => id !== null)
    )
  ];
  const result: GsisResolutionMap = new Map();

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    const { data, error } = await client
      .from("player_external_ids")
      .select("player_id, external_id")
      .eq("provider", "gsis")
      .eq("external_type", "gsis")
      .in("external_id", chunk);

    if (error) {
      throw new Error(`Batch GSIS identity lookup failed: ${error.message}`);
    }

    for (const row of data ?? []) {
      result.set(row.external_id as string, row.player_id as string);
    }
  }

  return result;
}
