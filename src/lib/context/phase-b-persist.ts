// H8 Phase B: Batch persistence with retry, timeout, progress, and SIGINT safety.
//
// Design guarantees:
//   - All evidence upserted before any snapshot
//   - Each batch is the unit of retry — the same rows are retried, never advanced
//   - ignoreDuplicates: true ensures idempotency (identical rerun = 0 new inserts)
//   - Deterministic DB errors (schema, auth, constraint) fail immediately without retry
//   - An InterruptState flag lets the caller signal abort between batches
//   - No writes happen after interrupted = true is detected
//
// Schema requirements fulfilled here:
//   context_evidence.evidence_category  — NOT NULL; mapped from EvidenceRecord.evidenceCategory
//   player_context_snapshots.context_version — INT (H8_CONTEXT_VERSION = 1, not a string)
//   player_context_snapshots unique constraint — (canonical_player_id, season, context_version)
//     (added in migration 013_player_context_constraints.sql)

import type { BlackbirdDerivedContext, EvidenceRecord } from "./derive";
import { classifySupabaseError, loadAllPagesWith } from "./paginated-loader";

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

export const H8_CONTEXT_VERSION = 1;
export const DEFAULT_EVIDENCE_BATCH_SIZE = 500;
export const DEFAULT_SNAPSHOT_BATCH_SIZE = 200;
export const DEFAULT_PHASE_B_TIMEOUT_MS = 30_000;
export const DEFAULT_PHASE_B_MAX_ATTEMPTS = 5;
export const DEFAULT_PHASE_B_BACKOFF_MS: readonly number[] = [500, 1_000, 2_000, 4_000, 8_000];

// --------------------------------------------------------------------------
// Schema-accurate row types
// --------------------------------------------------------------------------

export type EvidenceInsertRow = {
  evidence_id: string;
  source_type: string;
  source_name: string | null;
  source_url: string | null;
  source_identifier: string | null;
  author: string | null;
  organization: string | null;
  published_at: string | null;
  captured_at: string;
  effective_date: string | null;
  season: number | null;
  player_id: string | null;
  team_id: string | null;
  evidence_category: string;       // NOT NULL — required field frequently missing in older code
  normalized_claim: string;
  raw_excerpt: string | null;
  is_observed: boolean;
  confidence: number;
  reliability_tier: number;
  expiration_policy: string;
  expires_at: string | null;
  source_hash: string | null;
  parser_version: string | null;
  review_status: string;
};

export type SnapshotInsertRow = {
  canonical_player_id: string;
  season: number;
  as_of_date: string;
  context_version: number;         // INT — H8_CONTEXT_VERSION=1 (not a string)
  overall_confidence: string;
  overall_status: string;
  derived_context_json: string;
  updated_at: string;
};

// --------------------------------------------------------------------------
// Progress and result types
// --------------------------------------------------------------------------

export type PhaseBProgress = {
  table: "context_evidence" | "player_context_snapshots";
  batchNumber: number;
  totalBatches: number;
  attempted: number;
  inserted: number;
  existing: number;
  completedCumulative: number;
  totalRows: number;
  elapsedBatchMs: number;
  elapsedTotalMs: number;
};

export type PhaseBResult = {
  evidenceAttempted: number;
  snapshotAttempted: number;
  evidenceBatchesCompleted: number;
  snapshotBatchesCompleted: number;
  interrupted: boolean;
};

export type InterruptState = { triggered: boolean };

export function createInterruptState(): InterruptState {
  return { triggered: false };
}

// --------------------------------------------------------------------------
// Row builders (pure, testable, schema-accurate)
// --------------------------------------------------------------------------

// Maps player/season status ("observed","inferred") → snapshot status ("current")
// player_context_snapshots.overall_status CHECK: ('current','stale','contradicted','unknown','not_applicable')
function toSnapshotStatus(fieldStatus: string): string {
  if (fieldStatus === "observed" || fieldStatus === "inferred") return "current";
  return fieldStatus;
}

export function buildEvidenceInsertRow(rec: EvidenceRecord, playerId: string): EvidenceInsertRow {
  return {
    evidence_id: rec.evidenceId,
    source_type: rec.sourceType,
    source_name: rec.sourceName,
    source_url: rec.sourceUrl,
    source_identifier: rec.sourceIdentifier,
    author: rec.author,
    organization: rec.organization,
    published_at: rec.publishedAt,
    captured_at: rec.capturedAt,
    effective_date: rec.effectiveDate,
    season: rec.season,
    player_id: playerId,
    team_id: rec.teamId,
    evidence_category: rec.evidenceCategory,  // was missing; NOT NULL in schema
    normalized_claim: rec.normalizedClaim,
    raw_excerpt: rec.rawExcerpt,
    is_observed: rec.isObserved,
    confidence: rec.confidence,
    reliability_tier: rec.reliabilityTier,
    expiration_policy: rec.expirationPolicy,
    expires_at: rec.expiresAt,
    source_hash: rec.sourceHash,
    parser_version: rec.parserVersion,
    review_status: rec.reviewStatus,
  };
}

export function buildSnapshotInsertRow(opts: {
  playerId: string;
  context: BlackbirdDerivedContext;
  contextSeason: number;
  asOfDate: string;
}): SnapshotInsertRow {
  const { playerId, context, contextSeason, asOfDate } = opts;
  const field = context.priorTargetShare;
  return {
    canonical_player_id: playerId,
    season: contextSeason,
    as_of_date: asOfDate,
    context_version: H8_CONTEXT_VERSION,
    overall_confidence: field.confidence,
    overall_status: toSnapshotStatus(field.status),
    derived_context_json: JSON.stringify(context),
    updated_at: new Date().toISOString(),
  };
}

// --------------------------------------------------------------------------
// Timeout wrapper
// --------------------------------------------------------------------------

export function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Request timed out after ${ms}ms`)),
      ms
    );
    p.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err: unknown) => { clearTimeout(timer); reject(err); }
    );
  });
}

// --------------------------------------------------------------------------
// Supabase-compatible mock interface (for testing)
// --------------------------------------------------------------------------

export type BatchUpsertResult = {
  data: Array<Record<string, unknown>> | null;
  error: { message: string; code?: string } | null;
};

export type SupabaseBatchClient = {
  from: (table: string) => {
    upsert: (
      rows: Record<string, unknown>[],
      opts: { onConflict: string; ignoreDuplicates: boolean }
    ) => {
      select: (col: string) => PromiseLike<BatchUpsertResult>;
    };
  };
};

// --------------------------------------------------------------------------
// Batch upsert with retry (internal)
// --------------------------------------------------------------------------

async function upsertBatchWithRetry(opts: {
  supabase: SupabaseBatchClient;
  table: "context_evidence" | "player_context_snapshots";
  rows: Record<string, unknown>[];
  onConflict: string;
  selectKey: string;
  timeoutMs: number;
  maxAttempts: number;
  backoffMs: readonly number[];
  sleep: (ms: number) => Promise<void>;
  batchLabel: string;
}): Promise<{ inserted: number; existing: number }> {
  const { supabase, table, rows, onConflict, selectKey, timeoutMs, maxAttempts, backoffMs, sleep, batchLabel } = opts;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let result: BatchUpsertResult;
    try {
      result = await withTimeout(
        supabase.from(table).upsert(rows as Record<string, unknown>[], { onConflict, ignoreDuplicates: true }).select(selectKey),
        timeoutMs
      );
    } catch (e) {
      // Timeout or network throw — normalize to error shape
      result = { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
    }

    if (!result.error) {
      const inserted = result.data?.length ?? 0;
      const existing = rows.length - inserted;
      return { inserted, existing };
    }

    const classification = classifySupabaseError(result.error);
    const isLastAttempt = attempt >= maxAttempts;

    if (classification !== "transient" || isLastAttempt) {
      const kind = classification === "transient" ? "retries exhausted" : classification;
      throw new Error(
        `Phase B batch failed [${kind}] ${batchLabel} attempt ${attempt}/${maxAttempts}: ${result.error.message}`
      );
    }

    const delay = (backoffMs[attempt - 1] as number | undefined) ?? (backoffMs[backoffMs.length - 1] as number);
    console.warn(`  [retry] ${batchLabel} attempt ${attempt}/${maxAttempts}: ${result.error.message}`);
    await sleep(delay);
  }

  // Unreachable
  throw new Error(`[internal] upsertBatchWithRetry exhausted (${batchLabel})`);
}

// --------------------------------------------------------------------------
// Phase B: batch evidence then batch snapshots
// --------------------------------------------------------------------------

export type PhaseBOpts = {
  evidenceBatchSize?: number;
  snapshotBatchSize?: number;
  timeoutMs?: number;
  maxAttempts?: number;
  backoffMs?: readonly number[];
  onProgress?: (p: PhaseBProgress) => void;
  interruptState?: InterruptState;
  sleep?: (ms: number) => Promise<void>;
};

const noopSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function persistPhaseB(
  supabase: SupabaseBatchClient,
  evidenceRows: EvidenceInsertRow[],
  snapshotRows: SnapshotInsertRow[],
  opts: PhaseBOpts = {}
): Promise<PhaseBResult> {
  const evidenceBatchSize = opts.evidenceBatchSize ?? DEFAULT_EVIDENCE_BATCH_SIZE;
  const snapshotBatchSize = opts.snapshotBatchSize ?? DEFAULT_SNAPSHOT_BATCH_SIZE;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_PHASE_B_TIMEOUT_MS;
  const maxAttempts = opts.maxAttempts ?? DEFAULT_PHASE_B_MAX_ATTEMPTS;
  const backoffMs = opts.backoffMs ?? DEFAULT_PHASE_B_BACKOFF_MS;
  const sleep = opts.sleep ?? noopSleep;
  const { onProgress, interruptState } = opts;

  const startMs = Date.now();
  let evidenceAttempted = 0;
  let snapshotAttempted = 0;
  let evidenceBatchesCompleted = 0;
  let snapshotBatchesCompleted = 0;
  let interrupted = false;

  const evidenceBatches = chunk(evidenceRows as Record<string, unknown>[], evidenceBatchSize);
  const snapshotBatches = chunk(snapshotRows as Record<string, unknown>[], snapshotBatchSize);

  // ─── Evidence batches ───────────────────────────────────────────────────
  for (let b = 0; b < evidenceBatches.length; b++) {
    if (interruptState?.triggered) {
      interrupted = true;
      break;
    }

    const batch = evidenceBatches[b]!;
    const batchStart = Date.now();
    const { inserted, existing } = await upsertBatchWithRetry({
      supabase,
      table: "context_evidence",
      rows: batch,
      onConflict: "evidence_id",
      selectKey: "evidence_id",
      timeoutMs,
      maxAttempts,
      backoffMs,
      sleep,
      batchLabel: `evidence batch ${b + 1}/${evidenceBatches.length}`,
    });

    evidenceAttempted += batch.length;
    evidenceBatchesCompleted++;

    onProgress?.({
      table: "context_evidence",
      batchNumber: b + 1,
      totalBatches: evidenceBatches.length,
      attempted: batch.length,
      inserted,
      existing,
      completedCumulative: evidenceAttempted,
      totalRows: evidenceRows.length,
      elapsedBatchMs: Date.now() - batchStart,
      elapsedTotalMs: Date.now() - startMs,
    });
  }

  // ─── Snapshot batches (skipped if interrupted) ──────────────────────────
  if (!interrupted) {
    for (let b = 0; b < snapshotBatches.length; b++) {
      if (interruptState?.triggered) {
        interrupted = true;
        break;
      }

      const batch = snapshotBatches[b]!;
      const batchStart = Date.now();
      const { inserted, existing } = await upsertBatchWithRetry({
        supabase,
        table: "player_context_snapshots",
        rows: batch,
        onConflict: "canonical_player_id,season,context_version",
        selectKey: "canonical_player_id",
        timeoutMs,
        maxAttempts,
        backoffMs,
        sleep,
        batchLabel: `snapshot batch ${b + 1}/${snapshotBatches.length}`,
      });

      snapshotAttempted += batch.length;
      snapshotBatchesCompleted++;

      onProgress?.({
        table: "player_context_snapshots",
        batchNumber: b + 1,
        totalBatches: snapshotBatches.length,
        attempted: batch.length,
        inserted,
        existing,
        completedCumulative: snapshotAttempted,
        totalRows: snapshotRows.length,
        elapsedBatchMs: Date.now() - batchStart,
        elapsedTotalMs: Date.now() - startMs,
      });
    }
  }

  return {
    evidenceAttempted,
    snapshotAttempted,
    evidenceBatchesCompleted,
    snapshotBatchesCompleted,
    interrupted,
  };
}

// --------------------------------------------------------------------------
// Inspection — types
// --------------------------------------------------------------------------

export type EvidenceDistribution = {
  minPerPlayer: number;
  maxPerPlayer: number;
  modePerPlayer: number;
  playersAtMode: number;
  playersBelowMode: number;
  playersAboveMode: number;
};

export type PersistenceInspection = {
  evidenceRows: number;                    // exact count from DB (count query, not row fetch)
  evidencePlayers: number;                 // distinct player_ids from full paginated load
  snapshotRows: number;                    // exact count from DB
  snapshotPlayers: number;                 // distinct canonical_player_ids
  snapshotVersions: number[];
  snapshotAsDates: string[];
  playersWithEvidenceOnly: number;         // players with evidence but no snapshot
  playersWithSnapshotOnly: number;         // players with snapshot but no evidence
  evidenceDistribution: EvidenceDistribution | null;
  complete: boolean;                       // all cross-checks pass and distribution is uniform
  partiallyPersisted: boolean;
  tablesMissing: string[];
};

// Callbacks injected by caller — avoids coupling to Supabase client shape and enables testing.
export type InspectH8Opts = {
  /** Returns exact row count for context_evidence scoped to this run. */
  countEvidence: () => PromiseLike<{ count: number | null; error: { message: string; code?: string } | null }>;
  /** Returns exact row count for player_context_snapshots scoped to this run. */
  countSnapshots: () => PromiseLike<{ count: number | null; error: { message: string; code?: string } | null }>;
  /** Returns one page of player_id values from context_evidence. */
  pageEvidencePlayers: (from: number, to: number) => PromiseLike<{
    data: Array<{ player_id: string | null }> | null;
    error: { message: string; code?: string } | null;
  }>;
  /** Returns one page of (canonical_player_id, context_version, as_of_date) from player_context_snapshots. */
  pageSnapshotPlayers: (from: number, to: number) => PromiseLike<{
    data: Array<{ canonical_player_id: string; context_version: number; as_of_date: string }> | null;
    error: { message: string; code?: string } | null;
  }>;
  pageSize?: number;
};

// --------------------------------------------------------------------------
// Inspection — implementation (read-only, no writes)
// --------------------------------------------------------------------------

export async function inspectH8Persistence(opts: InspectH8Opts): Promise<PersistenceInspection> {
  const { pageSize = 1000 } = opts;
  const tablesMissing: string[] = [];

  // 1. Exact row counts via count queries (parallel — avoids loading any row data for counts)
  const [evCountResult, snCountResult] = await Promise.all([
    opts.countEvidence(),
    opts.countSnapshots(),
  ]);

  if (evCountResult.error) tablesMissing.push("context_evidence");
  if (snCountResult.error) tablesMissing.push("player_context_snapshots");

  const evidenceRows = evCountResult.error ? 0 : (evCountResult.count ?? 0);
  const snapshotRows = snCountResult.error ? 0 : (snCountResult.count ?? 0);

  // 2. Paginated load of player IDs for cross-checks and distribution audit.
  //    loadAllPagesWith uses .range() on every request, so > 1,000 rows are handled correctly.
  //    If count = 0 (empty table), skip the load entirely.
  let evidencePlayerRows: Array<{ player_id: string | null }> = [];
  let snapshotPlayerRows: Array<{ canonical_player_id: string; context_version: number; as_of_date: string }> = [];

  if (evidenceRows > 0) {
    evidencePlayerRows = await loadAllPagesWith<{ player_id: string | null }>(
      opts.pageEvidencePlayers,
      { table: "context_evidence", pageSize }
    );
  }

  if (snapshotRows > 0) {
    snapshotPlayerRows = await loadAllPagesWith<{
      canonical_player_id: string;
      context_version: number;
      as_of_date: string;
    }>(opts.pageSnapshotPlayers, { table: "player_context_snapshots", pageSize });
  }

  // 3. Player ID sets and cross-checks
  const evPlayerSet = new Set(
    evidencePlayerRows
      .map((r) => r.player_id)
      .filter((id): id is string => id !== null && id !== "")
  );
  const snPlayerSet = new Set(snapshotPlayerRows.map((r) => r.canonical_player_id));

  const playersWithEvidenceOnly = [...evPlayerSet].filter((id) => !snPlayerSet.has(id)).length;
  const playersWithSnapshotOnly = [...snPlayerSet].filter((id) => !evPlayerSet.has(id)).length;

  // 4. Snapshot metadata (distinct versions and as_of_dates across loaded rows)
  const snapshotVersions = [...new Set(snapshotPlayerRows.map((r) => r.context_version))].sort(
    (a, b) => a - b
  );
  const snapshotAsDates = [...new Set(snapshotPlayerRows.map((r) => r.as_of_date))].sort();

  // 5. Per-player evidence distribution audit
  let evidenceDistribution: EvidenceDistribution | null = null;
  if (evidencePlayerRows.length > 0) {
    const counts = new Map<string, number>();
    for (const row of evidencePlayerRows) {
      const id = row.player_id;
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const values = [...counts.values()];
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Mode: most common count; lower value wins ties for determinism
    const freq = new Map<number, number>();
    for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1);
    let mode = min;
    let modeFreq = 0;
    for (const [val, f] of freq) {
      if (f > modeFreq || (f === modeFreq && val < mode)) {
        mode = val;
        modeFreq = f;
      }
    }

    evidenceDistribution = {
      minPerPlayer: min,
      maxPerPlayer: max,
      modePerPlayer: mode,
      playersAtMode: values.filter((v) => v === mode).length,
      playersBelowMode: values.filter((v) => v < mode).length,
      playersAboveMode: values.filter((v) => v > mode).length,
    };
  }

  // 6. Complete: all cross-checks pass AND evidence distribution is uniform
  const complete =
    evidenceRows > 0 &&
    snapshotRows > 0 &&
    evPlayerSet.size > 0 &&
    snPlayerSet.size > 0 &&
    tablesMissing.length === 0 &&
    playersWithEvidenceOnly === 0 &&
    playersWithSnapshotOnly === 0 &&
    (evidenceDistribution === null ||
      (evidenceDistribution.playersBelowMode === 0 && evidenceDistribution.playersAboveMode === 0));

  const partiallyPersisted =
    (evidenceRows > 0 || snapshotRows > 0) && (evidenceRows === 0 || snapshotRows === 0);

  return {
    evidenceRows,
    evidencePlayers: evPlayerSet.size,
    snapshotRows,
    snapshotPlayers: snPlayerSet.size,
    snapshotVersions,
    snapshotAsDates,
    playersWithEvidenceOnly,
    playersWithSnapshotOnly,
    evidenceDistribution,
    complete,
    partiallyPersisted,
    tablesMissing,
  };
}
