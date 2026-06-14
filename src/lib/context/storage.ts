// H8: Context storage — read paths for player context snapshots and evidence.
// Writes go through the import pipeline (dry_run/execute pattern).
// Service-role writes only; authenticated reads only.

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ContextConfidence,
  ContextEvidenceRow,
  ContextSnapshotRow,
  TeamContextRow,
} from "./types";

// --------------------------------------------------------------------------
// Pagination helper
// --------------------------------------------------------------------------

async function loadAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(`DB query failed: ${error.message}`);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

// --------------------------------------------------------------------------
// Load current context snapshot for a player (most recent by as_of_date)
// --------------------------------------------------------------------------

export async function loadCurrentPlayerContext(
  supabase: SupabaseClient,
  canonicalPlayerId: string,
  season: number
): Promise<ContextSnapshotRow | null> {
  const { data, error } = await supabase
    .from("player_context_snapshots")
    .select("*")
    .eq("canonical_player_id", canonicalPlayerId)
    .eq("season", season)
    .order("as_of_date", { ascending: false })
    .order("context_version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`loadCurrentPlayerContext failed: ${error.message}`);
  return (data as ContextSnapshotRow | null);
}

// --------------------------------------------------------------------------
// Load context snapshot as-of a specific date
// --------------------------------------------------------------------------

export async function loadPlayerContextAsOf(
  supabase: SupabaseClient,
  canonicalPlayerId: string,
  season: number,
  asOfDate: string
): Promise<ContextSnapshotRow | null> {
  const { data, error } = await supabase
    .from("player_context_snapshots")
    .select("*")
    .eq("canonical_player_id", canonicalPlayerId)
    .eq("season", season)
    .lte("as_of_date", asOfDate)
    .order("as_of_date", { ascending: false })
    .order("context_version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`loadPlayerContextAsOf failed: ${error.message}`);
  return (data as ContextSnapshotRow | null);
}

// --------------------------------------------------------------------------
// Batch load current context for draft board (avoid N+1)
// --------------------------------------------------------------------------

export async function loadBatchPlayerContext(
  supabase: SupabaseClient,
  season: number,
  playerIds?: string[],
  options: {
    position?: string;
    minConfidence?: ContextConfidence;
    limit?: number;
  } = {}
): Promise<ContextSnapshotRow[]> {
  // Use a subquery-style approach: get latest as_of_date per player
  // then join back. Supabase doesn't support lateral joins, so we load and deduplicate in memory.
  let query = supabase
    .from("player_context_snapshots")
    .select("*")
    .eq("season", season)
    .order("canonical_player_id")
    .order("as_of_date", { ascending: false })
    .order("context_version", { ascending: false });

  if (playerIds && playerIds.length > 0) {
    query = query.in("canonical_player_id", playerIds);
  }
  if (options.position) {
    query = query.eq("position", options.position);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(`loadBatchPlayerContext failed: ${error.message}`);

  const rows = (data ?? []) as ContextSnapshotRow[];

  // Deduplicate: keep only the most recent snapshot per player
  const seen = new Set<string>();
  const deduped: ContextSnapshotRow[] = [];
  for (const row of rows) {
    if (!seen.has(row.canonical_player_id)) {
      seen.add(row.canonical_player_id);
      // Apply confidence filter after dedup
      if (options.minConfidence) {
        const order: Record<ContextConfidence, number> = {
          verified: 5, high: 4, moderate: 3, low: 2, unresolved: 1,
        };
        if ((order[row.overall_confidence] ?? 0) >= (order[options.minConfidence] ?? 0)) {
          deduped.push(row);
        }
      } else {
        deduped.push(row);
      }
    }
  }

  return deduped;
}

// --------------------------------------------------------------------------
// Load team environment context
// --------------------------------------------------------------------------

export async function loadTeamContext(
  supabase: SupabaseClient,
  teamId: string,
  season: number
): Promise<TeamContextRow | null> {
  const { data, error } = await supabase
    .from("team_context_snapshots")
    .select("*")
    .eq("team_id", teamId)
    .eq("season", season)
    .order("as_of_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`loadTeamContext failed: ${error.message}`);
  return (data as TeamContextRow | null);
}

// --------------------------------------------------------------------------
// Load evidence by IDs
// --------------------------------------------------------------------------

export async function loadEvidenceByIds(
  supabase: SupabaseClient,
  evidenceIds: string[]
): Promise<ContextEvidenceRow[]> {
  if (evidenceIds.length === 0) return [];
  return loadAllPages<ContextEvidenceRow>((from, to) =>
    supabase
      .from("context_evidence")
      .select("*")
      .in("evidence_id", evidenceIds)
      .range(from, to)
  );
}

// --------------------------------------------------------------------------
// Load evidence for a player (all categories or specific)
// --------------------------------------------------------------------------

export async function loadPlayerEvidence(
  supabase: SupabaseClient,
  playerId: string,
  season: number | null = null
): Promise<ContextEvidenceRow[]> {
  return loadAllPages<ContextEvidenceRow>((from, to) => {
    let q = supabase
      .from("context_evidence")
      .select("*")
      .eq("player_id", playerId)
      .range(from, to);
    if (season) q = q.eq("season", season);
    return q;
  });
}

// --------------------------------------------------------------------------
// Stale-context queue: players with stale_field_count > 0
// --------------------------------------------------------------------------

export async function loadStaleContextQueue(
  supabase: SupabaseClient,
  season: number,
  limit = 100
): Promise<ContextSnapshotRow[]> {
  const { data, error } = await supabase
    .from("player_context_snapshots")
    .select("*")
    .eq("season", season)
    .gt("stale_field_count", 0)
    .order("stale_field_count", { ascending: false })
    .order("as_of_date", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`loadStaleContextQueue failed: ${error.message}`);
  return (data ?? []) as ContextSnapshotRow[];
}

// --------------------------------------------------------------------------
// Contradiction queue: players with contradicted fields
// --------------------------------------------------------------------------

export async function loadContradictionQueue(
  supabase: SupabaseClient,
  season: number,
  limit = 100
): Promise<ContextSnapshotRow[]> {
  const { data, error } = await supabase
    .from("player_context_snapshots")
    .select("*")
    .eq("season", season)
    .eq("overall_status", "contradicted")
    .eq("manual_review_required", true)
    .order("as_of_date", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`loadContradictionQueue failed: ${error.message}`);
  return (data ?? []) as ContextSnapshotRow[];
}

// --------------------------------------------------------------------------
// Low-confidence queue
// --------------------------------------------------------------------------

export async function loadLowConfidenceQueue(
  supabase: SupabaseClient,
  season: number,
  limit = 100
): Promise<ContextSnapshotRow[]> {
  const { data, error } = await supabase
    .from("player_context_snapshots")
    .select("*")
    .eq("season", season)
    .in("overall_confidence", ["low", "unresolved"])
    .order("as_of_date", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`loadLowConfidenceQueue failed: ${error.message}`);
  return (data ?? []) as ContextSnapshotRow[];
}

// --------------------------------------------------------------------------
// Data quality report: aggregated counts
// --------------------------------------------------------------------------

export async function loadContextDataQuality(
  supabase: SupabaseClient,
  season: number
): Promise<{
  total: number;
  byConfidence: Record<string, number>;
  staleTotal: number;
  contradictedTotal: number;
  reviewRequired: number;
}> {
  // Load all current snapshots (deduped by player)
  const snapshots = await loadBatchPlayerContext(supabase, season);

  const byConfidence: Record<string, number> = {};
  let staleTotal = 0;
  let contradictedTotal = 0;
  let reviewRequired = 0;

  for (const s of snapshots) {
    byConfidence[s.overall_confidence] = (byConfidence[s.overall_confidence] ?? 0) + 1;
    staleTotal += s.stale_field_count;
    if (s.overall_status === "contradicted") contradictedTotal++;
    if (s.manual_review_required) reviewRequired++;
  }

  return {
    total: snapshots.length,
    byConfidence,
    staleTotal,
    contradictedTotal,
    reviewRequired,
  };
}

// --------------------------------------------------------------------------
// Write helpers (service-role only — used by import scripts)
// --------------------------------------------------------------------------

export type UpsertContextSnapshotOpts = {
  supabase: SupabaseClient;
  mode: "dry_run" | "execute";
  row: Omit<ContextSnapshotRow, "id" | "created_at" | "updated_at">;
};

export type UpsertContextResult = {
  mode: "dry_run" | "execute";
  snapshotId: string | null;
  inserted: boolean;
  errors: string[];
};

export async function upsertContextSnapshot(
  opts: UpsertContextSnapshotOpts
): Promise<UpsertContextResult> {
  if (opts.mode === "dry_run") {
    return { mode: "dry_run", snapshotId: null, inserted: false, errors: [] };
  }

  const { data, error } = await opts.supabase
    .from("player_context_snapshots")
    .insert({
      ...opts.row,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    return { mode: "execute", snapshotId: null, inserted: false, errors: [error.message] };
  }
  const row = data as { id: string };
  return { mode: "execute", snapshotId: row.id, inserted: true, errors: [] };
}

export async function upsertEvidence(
  supabase: SupabaseClient,
  rows: Array<Omit<ContextEvidenceRow, "id" | "created_at">>,
  mode: "dry_run" | "execute"
): Promise<{ inserted: number; alreadyExist: number; errors: string[] }> {
  if (mode === "dry_run" || rows.length === 0) {
    return { inserted: 0, alreadyExist: 0, errors: [] };
  }

  let inserted = 0;
  let alreadyExist = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const { data: existing } = await supabase
      .from("context_evidence")
      .select("id")
      .eq("evidence_id", row.evidence_id)
      .maybeSingle();

    if (existing) { alreadyExist++; continue; }

    const { error } = await supabase
      .from("context_evidence")
      .insert({ ...row, created_at: new Date().toISOString() });

    if (error) errors.push(`Evidence ${row.evidence_id}: ${error.message}`);
    else inserted++;
  }

  return { inserted, alreadyExist, errors };
}
