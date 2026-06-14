// H9-lite projection engine — canonical deterministic hashing.
//
// Design goals:
//   1. Stable: same semantic inputs always produce the same hash regardless of
//      JS object-key insertion order or floating-point representation noise.
//   2. Semantic: only values that affect projection outputs are included;
//      volatile DB metadata (IDs, created_at, updated_at) are excluded.
//   3. Two-layer: playerDataHash excludes the player ID so identical semantic
//      data produces the same hash; playerProjectionInputHash includes the
//      player ID so it is always player-unique.
//   4. Pure: no I/O, no side effects, fully testable without mocks.

import { createHash } from "node:crypto";

import type { ModelConfig } from "./constants";
import type {
  CompatibleAdpRecord,
  H8ContextFields,
  HistoricalPlayerProjectionInput,
  PlayerDataHashPayload,
  RunSemanticHashPayload,
  WeeklyStatRow,
} from "./types";

// --------------------------------------------------------------------------
// Internal helpers
// --------------------------------------------------------------------------

// Round a number to 6 decimal places and return as a JS number.
// This normalizes floating-point noise (0.10000000000000001 → 0.1).
// Non-finite values (NaN, Infinity) map to null so they are hash-stable.
function normalizeNumber(n: number): number | null {
  if (!Number.isFinite(n)) return null;
  return parseFloat(n.toFixed(6));
}

// Recursively sort object keys and normalize all numeric values.
// Arrays are NOT sorted — order matters semantically in most contexts.
// Pass sorted arrays explicitly when order is semantically irrelevant.
function sortKeysDeep(value: unknown): unknown {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") return normalizeNumber(value);
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  if (typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  return String(value);
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

// --------------------------------------------------------------------------
// Public: low-level SHA-256
// --------------------------------------------------------------------------

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

// --------------------------------------------------------------------------
// Public: canonical scoring config hash (per league)
//
// Input is the raw scoring_settings_json from the leagues table.
// Volatile fields (updated_at, league name) must NOT be passed here —
// pass only the settings object.
// --------------------------------------------------------------------------

export function hashScoringConfig(
  leagueId: string,
  scoringSettingsJson: Record<string, unknown>
): string {
  const payload = {
    leagueId,
    settings: scoringSettingsJson,
  };
  return sha256(canonicalJson(payload));
}

// --------------------------------------------------------------------------
// Internal: normalize a weekly stat row into a sort-stable structure
// --------------------------------------------------------------------------

function normalizeStatRow(row: WeeklyStatRow): Record<string, number> {
  return {
    carries: normalizeNumber(row.carries) ?? 0,
    completions: normalizeNumber(row.completions) ?? 0,
    fumRetTd: normalizeNumber(row.fumRetTd) ?? 0,
    fumblesLost: normalizeNumber(row.fumblesLost) ?? 0,
    interceptions: normalizeNumber(row.interceptions) ?? 0,
    passAttempts: normalizeNumber(row.passAttempts) ?? 0,
    passingTds: normalizeNumber(row.passingTds) ?? 0,
    passingYards: normalizeNumber(row.passingYards) ?? 0,
    receptions: normalizeNumber(row.receptions) ?? 0,
    receivingTds: normalizeNumber(row.receivingTds) ?? 0,
    receivingYards: normalizeNumber(row.receivingYards) ?? 0,
    rushingTds: normalizeNumber(row.rushingTds) ?? 0,
    rushingYards: normalizeNumber(row.rushingYards) ?? 0,
    targets: normalizeNumber(row.targets) ?? 0,
    twoPointConversions: normalizeNumber(row.twoPointConversions) ?? 0,
  };
}

// --------------------------------------------------------------------------
// Internal: normalize compatible ADP records for canonical hashing.
// DB IDs (adpRecordId, snapshotId) are excluded — they are lineage metadata.
// The content (rates, format, effective date) determines the hash.
// --------------------------------------------------------------------------

function normalizeAdpRecord(
  r: CompatibleAdpRecord
): PlayerDataHashPayload["compatibleAdpRecords"][number] {
  return {
    effectiveDate: r.effectiveDate,
    isBestBall: r.isBestBall,
    isDynasty: r.isDynasty,
    isSuperflex: r.isSuperflex,
    overallAdp: normalizeNumber(r.overallAdp) ?? 0,
    overallRank: r.overallRank === null ? null : normalizeNumber(r.overallRank),
    positionalAdp:
      r.positionalAdp === null ? null : normalizeNumber(r.positionalAdp),
    positionalRank:
      r.positionalRank === null ? null : normalizeNumber(r.positionalRank),
    pprValue: normalizeNumber(r.pprValue) ?? 0,
    provider: r.provider,
    scoringFormat: r.scoringFormat,
    tePremiumValue: normalizeNumber(r.tePremiumValue) ?? 0,
  };
}

// --------------------------------------------------------------------------
// Internal: normalize H8 context fields for canonical hashing.
// Only value/status/confidence are semantic; source IDs are excluded.
// --------------------------------------------------------------------------

function normalizeH8Fields(
  fields: H8ContextFields
): PlayerDataHashPayload["h8Fields"] {
  const result: PlayerDataHashPayload["h8Fields"] = {};
  // sourceEvidenceIds are lineage metadata — excluded from the canonical hash.
  for (const key of [
    "priorCarryShare",
    "priorEarlyDownPassRate",
    "priorGoalLineShare",
    "priorRedZoneShare",
    "priorTargetShare",
    "priorTeamPassRate",
    "priorTeamRushRate",
  ] as const) {
    const field = fields[key];
    result[key] = {
      confidence: field.confidence,
      status: field.status,
      value: field.value === null ? null : normalizeNumber(field.value),
    };
  }
  return result;
}

// --------------------------------------------------------------------------
// Public: playerDataHash
//
// Hashes only the semantic content of a player's inputs, without their ID.
// Two players with genuinely identical positions, seasons, stats, H8 context,
// ADP data, and model config will produce the same playerDataHash.
// This is intentional and expected.
// --------------------------------------------------------------------------

export function playerDataHash(
  input: HistoricalPlayerProjectionInput,
  modelConfig: ModelConfig
): string {
  const weeklyStats = [...input.weeklyStats]
    .sort((a, b) => a.week - b.week)
    .map((row) => ({
      stats: normalizeStatRow(row),
      week: row.week,
    }));

  // ADP records: sort by (provider, scoringFormat, effectiveDate, overallAdp)
  // so identical content in different insertion order produces the same hash.
  const adpRecords = [...input.compatibleAdpRecords]
    .sort((a, b) => {
      if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
      if (a.scoringFormat !== b.scoringFormat)
        return a.scoringFormat.localeCompare(b.scoringFormat);
      if (a.effectiveDate !== b.effectiveDate)
        return a.effectiveDate.localeCompare(b.effectiveDate);
      return (a.overallAdp ?? 0) - (b.overallAdp ?? 0);
    })
    .map(normalizeAdpRecord);

  const payload: PlayerDataHashPayload = {
    compatibleAdpRecords: adpRecords,
    h8Fields: normalizeH8Fields(input.h8Fields),
    historicalSeason: input.historicalSeason,
    modelConfig,
    position: input.position,
    projectionSeason: input.projectionSeason,
    projectionVersion: modelConfig.projectionVersion,
    weeklyStats,
  };

  return sha256(canonicalJson(payload));
}

// --------------------------------------------------------------------------
// Public: playerProjectionInputHash
//
// Includes canonicalPlayerId, so this hash is unique per player even when
// playerDataHash matches another player's data hash.
// --------------------------------------------------------------------------

export function playerProjectionInputHash(
  canonicalPlayerId: string,
  dataHash: string,
  method: string,
  projectionVersion: number
): string {
  const payload = {
    canonicalPlayerId,
    method,
    playerDataHash: dataHash,
    projectionVersion,
  };
  return sha256(canonicalJson(payload));
}

// --------------------------------------------------------------------------
// Public: runSemanticHash
//
// Covers the full set of inputs and constants for a projection run.
// If any player's semantic inputs, any league's scoring config, or any
// model constant changes, the run hash changes.
// --------------------------------------------------------------------------

export function runSemanticHash(
  payload: RunSemanticHashPayload
): string {
  // Sort playerProjectionInputHashes so run hash is insertion-order independent.
  const sortedInputHashes = [...payload.population.playerProjectionInputHashes].sort();
  const canonical: RunSemanticHashPayload = {
    ...payload,
    population: {
      ...payload.population,
      playerProjectionInputHashes: sortedInputHashes,
    },
  };
  return sha256(canonicalJson(canonical));
}

// --------------------------------------------------------------------------
// Public: reasonKey
//
// Deterministic unique key for a single reason record.
// Ensures ON CONFLICT (reason_key) DO NOTHING is safe for retries and reruns.
// --------------------------------------------------------------------------

export function reasonKey(opts: {
  projectionRunId: string;
  canonicalPlayerId: string;
  leagueId: string | null;
  reasonCode: string;
  reasonScope: string;
}): string {
  const parts = [
    opts.projectionRunId,
    opts.canonicalPlayerId,
    opts.leagueId ?? "GLOBAL",
    opts.reasonCode,
    opts.reasonScope,
  ];
  return sha256(parts.join("|"));
}

// --------------------------------------------------------------------------
// Public: buildPlayerHashes
//
// Convenience wrapper that computes both hashes for a player given the
// run model config. Returns both for storage in player_projection_inputs.
// --------------------------------------------------------------------------

export function buildPlayerHashes(
  input: HistoricalPlayerProjectionInput,
  modelConfig: ModelConfig
): {
  playerDataHash: string;
  playerProjectionInputHash: string;
} {
  const dataHash = playerDataHash(input, modelConfig);
  const inputHash = playerProjectionInputHash(
    input.canonicalPlayerId,
    dataHash,
    modelConfig.projectionMethod,
    modelConfig.projectionVersion
  );
  return {
    playerDataHash: dataHash,
    playerProjectionInputHash: inputHash,
  };
}
