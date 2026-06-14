import { matchRankingRowToPlayer } from "@/lib/players/match";
import type { MatchablePlayer } from "@/lib/players/match";
import { normalizePlayerName, normalizePosition, normalizeTeam } from "@/lib/players/normalize";

import type { AdpIdentityMatchMethod, PlayerAdpRecord, RawAdpRecord } from "./types";

export type AdpIdentityInput = {
  raw: RawAdpRecord;
  // Provider-specific external ID → canonical player ID, pre-resolved from player_external_ids.
  // Key: rawId (provider's player ID string); Value: canonical player UUID.
  externalIdMap: Map<string, string>;
  // All matchable players from public.players.
  canonicalPlayers: MatchablePlayer[];
  // Which canonical player IDs have an H6 profile for the current league.
  playerIdsWithProfile: Set<string>;
  // Optional: seasons_exp thresholds for rookie detection.
  rookieYearsExpMax?: number; // players with years_exp <= this are treated as rookies (default: 0)
  // Optional: raw provider name → canonical raw name (applied before normalization).
  // Use for nickname/alias mismatches between the provider and canonical player table.
  nameAliases?: Map<string, string>;
};

type CanonicalPlayerFull = MatchablePlayer & {
  years_exp?: number | null;
};

// Resolve one raw ADP record to a canonical player.
// Respects the "do not use name-only automatic mappings" constraint:
// name-only matches (exact_name, fuzzy) without position confirmation are rejected.
export function resolveAdpIdentity(input: AdpIdentityInput): PlayerAdpRecord {
  const { raw, externalIdMap, canonicalPlayers, playerIdsWithProfile } = input;
  const rookieThreshold = input.rookieYearsExpMax ?? 0;

  // Apply provider name alias before any matching (nickname → canonical name)
  const resolvedRawName = input.nameAliases?.get(raw.rawName) ?? raw.rawName;
  const effectiveRaw: RawAdpRecord = resolvedRawName !== raw.rawName
    ? { ...raw, rawName: resolvedRawName }
    : raw;

  // 1. Try external ID mapping (requires pre-seeded player_external_ids for this provider)
  if (effectiveRaw.rawId && externalIdMap.has(effectiveRaw.rawId)) {
    const canonicalId = externalIdMap.get(effectiveRaw.rawId)!;
    const player = canonicalPlayers.find((p) => p.id === canonicalId) as CanonicalPlayerFull | undefined;
    return enriched(effectiveRaw, canonicalId, player, "exact_id", 1.0, playerIdsWithProfile, rookieThreshold);
  }

  // 2. Name + position + team matching via existing infrastructure
  const matchResult = matchRankingRowToPlayer(
    {
      sleeper_player_id: null,
      player_name: effectiveRaw.rawName,
      position: effectiveRaw.rawPosition ?? undefined,
      team: effectiveRaw.rawTeam ?? undefined,
    },
    canonicalPlayers
  );

  // Accept exact_id, exact_name_position_team, exact_name_position only.
  // "exact_name" alone is rejected per the "no name-only automatic mappings" constraint.
  if (
    matchResult.matched_player_id &&
    (matchResult.match_status === "exact_id" ||
      matchResult.match_status === "exact_name_position_team" ||
      matchResult.match_status === "exact_name_position")
  ) {
    const method: AdpIdentityMatchMethod =
      matchResult.match_status === "exact_name_position_team"
        ? "normalized_name_position_team"
        : "normalized_name_position";

    const player = canonicalPlayers.find((p) => p.id === matchResult.matched_player_id) as CanonicalPlayerFull | undefined;
    return enriched(effectiveRaw, matchResult.matched_player_id, player, method, matchResult.match_confidence, playerIdsWithProfile, rookieThreshold);
  }

  if (matchResult.match_status === "ambiguous") {
    return unresolved(effectiveRaw, "ambiguous");
  }

  return unresolved(effectiveRaw, "unresolved");
}

// Resolve an array of raw records.
export function resolveAdpIdentities(
  raws: RawAdpRecord[],
  opts: Omit<AdpIdentityInput, "raw">
): PlayerAdpRecord[] {
  return raws.map((raw) => resolveAdpIdentity({ ...opts, raw }));
}

// Count resolution results.
export function summarizeResolution(records: PlayerAdpRecord[]) {
  let resolved = 0, ambiguous = 0, unresolved = 0, rookie = 0;
  for (const r of records) {
    if (r.canonicalPlayerId) resolved++;
    else if (r.identityMatchMethod === "ambiguous") ambiguous++;
    else unresolved++;
    if (r.isRookie) rookie++;
  }
  return { resolved, ambiguous, unresolved, rookie, total: records.length };
}

function enriched(
  raw: RawAdpRecord,
  canonicalPlayerId: string,
  player: CanonicalPlayerFull | undefined,
  method: AdpIdentityMatchMethod,
  confidence: number,
  playerIdsWithProfile: Set<string>,
  rookieThreshold: number
): PlayerAdpRecord {
  const yearsExp = (player as CanonicalPlayerFull | undefined)?.years_exp;
  return {
    ...raw,
    canonicalPlayerId,
    sleeperPlayerId: player?.sleeper_player_id ?? null,
    resolvedName: player?.full_name ?? null,
    resolvedPosition: normalizePosition(player?.position) ?? raw.rawPosition,
    resolvedTeam: normalizeTeam(player?.team) ?? raw.rawTeam,
    identityMatchMethod: method,
    identityMatchConfidence: Math.round(confidence * 10000) / 10000,
    isRookie: typeof yearsExp === "number" ? yearsExp <= rookieThreshold : false,
    hasHistoricalProfile: playerIdsWithProfile.has(canonicalPlayerId),
  };
}

function unresolved(
  raw: RawAdpRecord,
  method: "ambiguous" | "unresolved"
): PlayerAdpRecord {
  return {
    ...raw,
    canonicalPlayerId: null,
    sleeperPlayerId: null,
    resolvedName: null,
    resolvedPosition: raw.rawPosition ? (normalizePlayerName(raw.rawPosition) || raw.rawPosition) : null,
    resolvedTeam: null,
    identityMatchMethod: method,
    identityMatchConfidence: null,
    isRookie: false,
    hasHistoricalProfile: false,
  };
}

// Build the external ID map for a specific provider from player_external_ids rows.
export function buildExternalIdMap(
  rows: Array<{ external_id: string; player_id: string }>,
): Map<string, string> {
  return new Map(rows.map((r) => [r.external_id, r.player_id]));
}

// FantasyPros uses nicknames / marketing names that differ from canonical legal names.
// Each entry: FantasyPros display name → canonical full_name in public.players.
// Only add entries that are deterministic (1:1, confirmed position+team).
export const FANTASYPROS_NAME_ALIASES: Map<string, string> = new Map([
  ["Hollywood Brown", "Marquise Brown"],
]);

// Normalise an MFL-style "Last, First" name to "First Last".
export function normalizeMflName(mflName: string): string {
  const comma = mflName.indexOf(",");
  if (comma === -1) return mflName.trim();
  const last = mflName.slice(0, comma).trim();
  const first = mflName.slice(comma + 1).trim();
  return `${first} ${last}`.trim();
}
