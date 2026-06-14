// H7 ADP storage service — reads and writes adp_snapshots / adp_player_records / adp_player_movements.
// All writes are only executed when mode === "execute".
// Dry-run mode computes everything but writes nothing.

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AdpSourceConfidence,
  AdpSourceMeta,
  PlayerAdpRecord,
} from "./types";

// --------------------------------------------------------------------------
// Row shapes that mirror the DB schema
// --------------------------------------------------------------------------

export type SnapshotRow = {
  id: string;
  provider: string;
  source_identifier: string;
  file_hash: string;
  source_meta_json: object;
  source_confidence: string;
  season: number;
  team_count: number;
  scoring_format: string;
  ppr_value: number;
  te_premium_value: number;
  is_dynasty: boolean;
  is_best_ball: boolean;
  is_superflex: boolean;
  sample_size: number | null;
  captured_at: string;
  effective_date: string;
  total_records: number;
  resolved_count: number;
  unresolved_count: number;
  ambiguous_count: number;
  rookie_count: number;
};

// --------------------------------------------------------------------------
// Import result
// --------------------------------------------------------------------------

export type ImportAdpResult = {
  mode: "dry_run" | "execute";
  snapshotInserted: 0 | 1;
  snapshotId: string | null;
  existingSnapshotId: string | null;
  playerRecordsInserted: number;
  playerRecordsDuplicate: number;
  movementsInserted: number;
  errors: string[];
  diagnostics: {
    totalRecords: number;
    resolvedCount: number;
    unresolvedCount: number;
    ambiguousCount: number;
    rookieCount: number;
    fileHash: string;
    sourceIdentifier: string;
  };
};

// --------------------------------------------------------------------------
// Import options
// --------------------------------------------------------------------------

export type ImportAdpOptions = {
  mode: "dry_run" | "execute";
  sourceMeta: AdpSourceMeta;
  sourceConfidence: AdpSourceConfidence;
  records: PlayerAdpRecord[];
  supabase: SupabaseClient;
};

// --------------------------------------------------------------------------
// Internal helpers
// --------------------------------------------------------------------------

function countResolution(records: PlayerAdpRecord[]) {
  let resolved = 0, unresolved = 0, ambiguous = 0, rookie = 0;
  for (const r of records) {
    if (r.canonicalPlayerId) resolved++;
    else if (r.identityMatchMethod === "ambiguous") ambiguous++;
    else unresolved++;
    if (r.isRookie) rookie++;
  }
  return { resolved, unresolved, ambiguous, rookie };
}

function toSnapshotInsert(
  meta: AdpSourceMeta,
  confidence: AdpSourceConfidence,
  counts: ReturnType<typeof countResolution>,
  totalRecords: number
): Omit<SnapshotRow, "id"> {
  const fp = meta.formatProfile;
  return {
    provider: meta.provider,
    source_identifier: meta.sourceIdentifier,
    file_hash: meta.fileHash,
    source_meta_json: meta as object,
    source_confidence: confidence,
    season: meta.season,
    team_count: fp.teamCount,
    scoring_format: fp.scoringFormat,
    ppr_value: fp.pprValue,
    te_premium_value: fp.tePremiumValue,
    is_dynasty: fp.isDynasty,
    is_best_ball: fp.isBestBall,
    is_superflex: fp.isSuperflex,
    sample_size: meta.sampleSize,
    captured_at: meta.capturedAt,
    effective_date: meta.effectiveDate,
    total_records: totalRecords,
    resolved_count: counts.resolved,
    unresolved_count: counts.unresolved,
    ambiguous_count: counts.ambiguous,
    rookie_count: counts.rookie,
  };
}

function toPlayerRecordInsert(snapshotId: string, r: PlayerAdpRecord) {
  return {
    snapshot_id: snapshotId,
    canonical_player_id: r.canonicalPlayerId ?? null,
    sleeper_player_id: r.sleeperPlayerId ?? null,
    raw_name: r.rawName,
    raw_position: r.rawPosition ?? null,
    raw_team: r.rawTeam ?? null,
    raw_id: r.rawId ?? null,
    overall_adp: r.overallAdp,
    overall_rank: r.overallRank ?? null,
    positional_adp: r.positionalAdp ?? null,
    positional_rank: r.positionalRank ?? null,
    min_pick: r.minPick ?? null,
    max_pick: r.maxPick ?? null,
    stddev: r.stddev ?? null,
    sample_size: r.sampleSize ?? null,
    identity_match_method: r.identityMatchMethod ?? null,
    identity_match_confidence: r.identityMatchConfidence ?? null,
    is_rookie: r.isRookie,
    has_historical_profile: r.hasHistoricalProfile,
    raw_data_json: r.extraFields ?? null,
  };
}

// --------------------------------------------------------------------------
// Check whether a snapshot with this file_hash already exists
// --------------------------------------------------------------------------

export async function findSnapshotByHash(
  supabase: SupabaseClient,
  fileHash: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("adp_snapshots")
    .select("id")
    .eq("file_hash", fileHash)
    .maybeSingle();
  if (error) throw new Error(`findSnapshotByHash failed: ${error.message}`);
  return data?.id ?? null;
}

// --------------------------------------------------------------------------
// Find the most recent previous snapshot from the same provider+season
// --------------------------------------------------------------------------

export async function findPreviousSnapshot(
  supabase: SupabaseClient,
  provider: string,
  season: number,
  excludeSnapshotId: string
): Promise<SnapshotRow | null> {
  const { data, error } = await supabase
    .from("adp_snapshots")
    .select("*")
    .eq("provider", provider)
    .eq("season", season)
    .neq("id", excludeSnapshotId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findPreviousSnapshot failed: ${error.message}`);
  return data as SnapshotRow | null;
}

// --------------------------------------------------------------------------
// Insert snapshot + player records + movements
// --------------------------------------------------------------------------

type PlayerRecordRow = {
  id: string;
  canonical_player_id: string | null;
  raw_name: string;
  overall_adp: number;
  overall_rank: number | null;
};

async function computeAndInsertMovements(
  supabase: SupabaseClient,
  fromSnapshotId: string,
  toSnapshotId: string
): Promise<number> {
  const { data: fromRows, error: e1 } = await supabase
    .from("adp_player_records")
    .select("id,canonical_player_id,raw_name,overall_adp,overall_rank")
    .eq("snapshot_id", fromSnapshotId);
  if (e1) throw new Error(`Movement fetch (from) failed: ${e1.message}`);

  const { data: toRows, error: e2 } = await supabase
    .from("adp_player_records")
    .select("id,canonical_player_id,raw_name,overall_adp,overall_rank")
    .eq("snapshot_id", toSnapshotId);
  if (e2) throw new Error(`Movement fetch (to) failed: ${e2.message}`);

  const fromMap = new Map<string, PlayerRecordRow>();
  const toMap = new Map<string, PlayerRecordRow>();

  for (const r of fromRows as PlayerRecordRow[]) {
    if (r.canonical_player_id) fromMap.set(r.canonical_player_id, r);
    else fromMap.set(`raw:${r.raw_name}`, r);
  }
  for (const r of toRows as PlayerRecordRow[]) {
    if (r.canonical_player_id) toMap.set(r.canonical_player_id, r);
    else toMap.set(`raw:${r.raw_name}`, r);
  }

  const allKeys = new Set([...fromMap.keys(), ...toMap.keys()]);
  const movements = [];

  for (const key of allKeys) {
    const from = fromMap.get(key) ?? null;
    const to = toMap.get(key) ?? null;

    const fromAdp = from ? Number(from.overall_adp) : null;
    const toAdp = to ? Number(to.overall_adp) : null;
    const fromRank = from?.overall_rank ?? null;
    const toRank = to?.overall_rank ?? null;

    const adpDelta = fromAdp !== null && toAdp !== null ? toAdp - fromAdp : null;
    const rankDelta = fromRank !== null && toRank !== null ? toRank - fromRank : null;

    const canonicalPlayerId = (to ?? from)?.canonical_player_id ?? null;
    const rawName = (to ?? from)!.raw_name;

    movements.push({
      from_snapshot_id: fromSnapshotId,
      to_snapshot_id: toSnapshotId,
      canonical_player_id: canonicalPlayerId,
      raw_name: rawName,
      from_adp: fromAdp,
      to_adp: toAdp,
      adp_delta: adpDelta,
      from_rank: fromRank,
      to_rank: toRank,
      rank_delta: rankDelta,
    });
  }

  if (movements.length === 0) return 0;

  const { error: e3 } = await supabase.from("adp_player_movements").insert(movements);
  if (e3) throw new Error(`Movement insert failed: ${e3.message}`);
  return movements.length;
}

// --------------------------------------------------------------------------
// Main import function
// --------------------------------------------------------------------------

export async function importAdpSnapshot(opts: ImportAdpOptions): Promise<ImportAdpResult> {
  const { mode, sourceMeta, sourceConfidence, records, supabase } = opts;
  const counts = countResolution(records);
  const totalRecords = records.length;
  const errors: string[] = [];

  const diagnostics = {
    totalRecords,
    resolvedCount: counts.resolved,
    unresolvedCount: counts.unresolved,
    ambiguousCount: counts.ambiguous,
    rookieCount: counts.rookie,
    fileHash: sourceMeta.fileHash,
    sourceIdentifier: sourceMeta.sourceIdentifier,
  };

  // Deduplicate: check if this snapshot already exists
  const existingId = await findSnapshotByHash(supabase, sourceMeta.fileHash);
  if (existingId) {
    return {
      mode,
      snapshotInserted: 0,
      snapshotId: null,
      existingSnapshotId: existingId,
      playerRecordsInserted: 0,
      playerRecordsDuplicate: totalRecords,
      movementsInserted: 0,
      errors,
      diagnostics,
    };
  }

  if (mode === "dry_run") {
    // Dry run: compute everything, write nothing
    const prevSnap = await findPreviousSnapshot(supabase, sourceMeta.provider, sourceMeta.season, "00000000-0000-0000-0000-000000000000");
    return {
      mode,
      snapshotInserted: 1,
      snapshotId: null,
      existingSnapshotId: null,
      playerRecordsInserted: counts.resolved + counts.unresolved + counts.ambiguous,
      playerRecordsDuplicate: 0,
      movementsInserted: prevSnap ? totalRecords : 0,
      errors,
      diagnostics: {
        ...diagnostics,
        sourceIdentifier: sourceMeta.sourceIdentifier + " [DRY RUN — not written]",
      },
    };
  }

  // Execute mode: write snapshot
  const snapshotInsert = toSnapshotInsert(sourceMeta, sourceConfidence, counts, totalRecords);
  const { data: snapData, error: snapErr } = await supabase
    .from("adp_snapshots")
    .insert(snapshotInsert)
    .select("id")
    .single();

  if (snapErr) {
    errors.push(`Snapshot insert failed: ${snapErr.message}`);
    return {
      mode,
      snapshotInserted: 0,
      snapshotId: null,
      existingSnapshotId: null,
      playerRecordsInserted: 0,
      playerRecordsDuplicate: 0,
      movementsInserted: 0,
      errors,
      diagnostics,
    };
  }

  const snapshotId = (snapData as { id: string }).id;

  // Deduplicate player records by canonical_player_id within this snapshot
  const seen = new Set<string>();
  const deduped: PlayerAdpRecord[] = [];
  for (const r of records) {
    const key = r.canonicalPlayerId ?? `raw:${r.rawName}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(r);
    }
  }

  // Batch insert player records
  const playerRows = deduped.map((r) => toPlayerRecordInsert(snapshotId, r));
  const BATCH_SIZE = 200;
  let playerRecordsInserted = 0;

  for (let i = 0; i < playerRows.length; i += BATCH_SIZE) {
    const batch = playerRows.slice(i, i + BATCH_SIZE);
    const { error: recErr } = await supabase.from("adp_player_records").insert(batch);
    if (recErr) {
      errors.push(`Player records batch ${i / BATCH_SIZE + 1} failed: ${recErr.message}`);
    } else {
      playerRecordsInserted += batch.length;
    }
  }

  // Compute movements against previous snapshot
  let movementsInserted = 0;
  const prevSnap = await findPreviousSnapshot(supabase, sourceMeta.provider, sourceMeta.season, snapshotId);
  if (prevSnap) {
    try {
      movementsInserted = await computeAndInsertMovements(supabase, prevSnap.id, snapshotId);
    } catch (err) {
      errors.push(`Movement computation failed: ${(err as Error).message}`);
    }
  }

  return {
    mode,
    snapshotInserted: 1,
    snapshotId,
    existingSnapshotId: null,
    playerRecordsInserted,
    playerRecordsDuplicate: totalRecords - deduped.length,
    movementsInserted,
    errors,
    diagnostics,
  };
}

// --------------------------------------------------------------------------
// Board query: load a snapshot and its player records from DB
// --------------------------------------------------------------------------

export type StoredPlayerRecord = {
  id: string;
  snapshot_id: string;
  canonical_player_id: string | null;
  sleeper_player_id: string | null;
  raw_name: string;
  raw_position: string | null;
  raw_team: string | null;
  raw_id: string | null;
  overall_adp: number;
  overall_rank: number | null;
  positional_adp: number | null;
  positional_rank: number | null;
  min_pick: number | null;
  max_pick: number | null;
  stddev: number | null;
  sample_size: number | null;
  identity_match_method: string | null;
  identity_match_confidence: number | null;
  is_rookie: boolean;
  has_historical_profile: boolean;
  raw_data_json: Record<string, unknown> | null;
};

export async function loadLatestSnapshotWithRecords(
  supabase: SupabaseClient,
  provider: string,
  season: number
): Promise<{ snapshot: SnapshotRow; records: StoredPlayerRecord[] } | null> {
  const { data: snap, error: e1 } = await supabase
    .from("adp_snapshots")
    .select("*")
    .eq("provider", provider)
    .eq("season", season)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (e1) throw new Error(`loadLatestSnapshot failed: ${e1.message}`);
  if (!snap) return null;

  const snapshot = snap as SnapshotRow;

  const { data: records, error: e2 } = await supabase
    .from("adp_player_records")
    .select("*")
    .eq("snapshot_id", snapshot.id)
    .order("overall_adp", { ascending: true });
  if (e2) throw new Error(`loadPlayerRecords failed: ${e2.message}`);

  return { snapshot, records: (records ?? []) as StoredPlayerRecord[] };
}

// --------------------------------------------------------------------------
// Crosswalk seeding: insert provider-specific external IDs
// --------------------------------------------------------------------------

export type CrosswalkEntry = {
  provider: string;
  external_type: string;
  external_id: string;
  player_id: string;
};

export async function seedCrosswalks(
  supabase: SupabaseClient,
  entries: CrosswalkEntry[]
): Promise<{ seeded: number; alreadyExist: number; errors: string[] }> {
  const errors: string[] = [];
  let seeded = 0;
  let alreadyExist = 0;

  for (const entry of entries) {
    const { data: existing } = await supabase
      .from("player_external_ids")
      .select("id")
      .eq("provider", entry.provider)
      .eq("external_type", entry.external_type)
      .eq("external_id", entry.external_id)
      .maybeSingle();

    if (existing) {
      alreadyExist++;
      continue;
    }

    const { error } = await supabase.from("player_external_ids").insert(entry);
    if (error) {
      errors.push(`Crosswalk ${entry.external_id} failed: ${error.message}`);
    } else {
      seeded++;
    }
  }

  return { seeded, alreadyExist, errors };
}

// Known MFL name-alias crosswalks that are deterministic (1:1, position+team confirmed)
export const MFL_CROSSWALKS: CrosswalkEntry[] = [
  {
    provider: "mfl",
    external_type: "player",
    external_id: "17627",  // Matthew Hibner (MFL) → Matt Hibner (canonical)
    player_id: "dd586604-cfd2-4220-ab13-bae446997fcd",
  },
  {
    provider: "mfl",
    external_type: "player",
    external_id: "15889",  // Chigoziem Okonkwo (MFL) → Chig Okonkwo (canonical)
    player_id: "a11903aa-1c14-4424-9300-fc8692619c3e",
  },
];
