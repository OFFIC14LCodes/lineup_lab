import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeGsisId } from "../normalize-gsis-id";
import type { GsisBootstrapPlayerRow, GsisBootstrapResult } from "./types";

const BATCH_SIZE = 500;

export type CanonicalPlayerEntry = {
  playerId: string;
  positionGroup: string | null;
  normalizedName: string | null;
};

export type PlayerBridgeMaps = {
  statsIdMap: Map<string, string>;         // Sleeper stats_id (= GSIS ID) → canonical player_id
  espnIdMap: Map<string, string>;          // ESPN ID string → canonical player_id
  normalizedNameMap: Map<string, CanonicalPlayerEntry[]>; // normalized_name → entries
};

// Bulk-load all existing GSIS mappings using chunked IN queries.
export async function loadExistingGsisMappings(
  gsisIds: string[],
  client: SupabaseClient
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const deduped = [...new Set(gsisIds)]
    .map(normalizeGsisId)
    .filter((id): id is string => id !== null);

  for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
    const chunk = deduped.slice(i, i + BATCH_SIZE);
    const { data, error } = await client
      .from("player_external_ids")
      .select("player_id, external_id")
      .eq("provider", "gsis")
      .eq("external_type", "gsis")
      .in("external_id", chunk);

    if (error) throw new Error(`Failed to load existing GSIS mappings: ${error.message}`);

    for (const row of data ?? []) {
      const key = normalizeGsisId(row.external_id as string);
      if (key) result.set(key, row.player_id as string);
    }
  }

  return result;
}

const PLAYER_PAGE_SIZE = 1000;

// Load ALL canonical players via paginated queries and build bridge maps.
// Supabase returns at most 1000 rows per query by default — pagination is required
// to cover the full player database (12k+ rows).
// metadata_json.gsis_id holds the canonical GSIS ID (e.g. "00-0030506").
// metadata_json.espn_id holds the ESPN ID (used as the primary bridge for nflverse).
export async function loadPlayerBridgeMaps(client: SupabaseClient): Promise<PlayerBridgeMaps> {
  const statsIdMap = new Map<string, string>();
  const espnIdMap = new Map<string, string>();
  const normalizedNameMap = new Map<string, CanonicalPlayerEntry[]>();

  let page = 0;
  while (true) {
    const { data, error } = await client
      .from("players")
      .select("id, metadata_json, normalized_name, position_group")
      .range(page * PLAYER_PAGE_SIZE, (page + 1) * PLAYER_PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to load canonical players (page ${page}): ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      const playerId = row.id as string;
      const meta = row.metadata_json as Record<string, unknown> | null;

      if (meta) {
        // metadata_json.gsis_id is the Sleeper player object field for the NFL GSIS ID.
        // metadata_json.stats_id is a different identifier (fantasy platform ID) and
        // does NOT equal the GSIS ID — do not use it as a GSIS bridge.
        const gsisIdFromMeta = meta["gsis_id"];
        if (gsisIdFromMeta !== null && gsisIdFromMeta !== undefined) {
          const normalized = normalizeGsisId(String(gsisIdFromMeta));
          if (normalized) statsIdMap.set(normalized, playerId);
        }

        const espnId = meta["espn_id"];
        if (espnId !== null && espnId !== undefined) {
          const espnIdStr = String(espnId).trim();
          if (espnIdStr && espnIdStr !== "null" && espnIdStr !== "undefined" && espnIdStr !== "0") {
            espnIdMap.set(espnIdStr, playerId);
          }
        }
      }

      const normalizedName = row.normalized_name as string | null;
      const positionGroup = row.position_group as string | null;
      if (normalizedName) {
        const entry: CanonicalPlayerEntry = { playerId, positionGroup, normalizedName };
        const existing = normalizedNameMap.get(normalizedName) ?? [];
        existing.push(entry);
        normalizedNameMap.set(normalizedName, existing);
      }
    }

    if (data.length < PLAYER_PAGE_SIZE) break;
    page++;
  }

  return { statsIdMap, espnIdMap, normalizedNameMap };
}

function isPositionCompatible(nflverseGroup: string | null, canonicalGroup: string | null): boolean {
  if (nflverseGroup === null || canonicalGroup === null) return true;
  return nflverseGroup === canonicalGroup;
}

// Resolve a single player using the priority cascade.
// No side effects: all DB queries happen before this function is called.
export function resolvePlayer(
  player: GsisBootstrapPlayerRow,
  existingMap: Map<string, string>,
  bridges: PlayerBridgeMaps
): GsisBootstrapResult {
  const { gsisId, displayName, positionGroup, normalizedName, espnId } = player;

  // Priority 1: existing gsis mapping in player_external_ids
  const existingPlayerId = existingMap.get(gsisId);
  if (existingPlayerId !== undefined) {
    return {
      gsisId,
      displayName,
      positionGroup,
      bootstrapStatus: "existing",
      playerId: existingPlayerId,
      bridgeMethod: "existing_mapping"
    };
  }

  // Priority 2: Sleeper metadata stats_id bridge (stats_id == GSIS ID for NFL players)
  const statsIdMatch = bridges.statsIdMap.get(gsisId);

  // Priority 3: ESPN ID bridge (nflverse espn_id vs Sleeper metadata espn_id)
  const espnIdMatch = espnId ? bridges.espnIdMap.get(espnId) : undefined;

  // Conflict: both bridges return different canonical players
  if (statsIdMatch !== undefined && espnIdMatch !== undefined && statsIdMatch !== espnIdMatch) {
    return {
      gsisId,
      displayName,
      positionGroup,
      bootstrapStatus: "conflict",
      playerId: null,
      bridgeMethod: null,
      conflictPlayerIds: [statsIdMatch, espnIdMatch]
    };
  }

  const bridgeMatch = statsIdMatch ?? espnIdMatch;
  if (bridgeMatch !== undefined) {
    return {
      gsisId,
      displayName,
      positionGroup,
      bootstrapStatus: "ready",
      playerId: bridgeMatch,
      bridgeMethod: statsIdMatch !== undefined ? "stats_id" : "espn_id"
    };
  }

  // Priority 4: name + position candidate (manual_review only — never auto-mapped)
  if (normalizedName) {
    const nameCandidates = bridges.normalizedNameMap.get(normalizedName) ?? [];
    const compatible = nameCandidates.filter((c) =>
      isPositionCompatible(positionGroup, c.positionGroup)
    );
    if (compatible.length === 1) {
      return {
        gsisId,
        displayName,
        positionGroup,
        bootstrapStatus: "manual_review",
        playerId: null,
        bridgeMethod: "name_position"
      };
    }
  }

  // Priority 5: unresolved
  return {
    gsisId,
    displayName,
    positionGroup,
    bootstrapStatus: "unresolved",
    playerId: null,
    bridgeMethod: null
  };
}
