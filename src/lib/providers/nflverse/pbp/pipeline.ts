import "server-only";

import Papa from "papaparse";
import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveGsisIdsBatch } from "@/lib/providers/nflverse/identity";

import { decompressPbpFile, downloadAndArchivePbp } from "./download";
import {
  accumulatePlayEvents,
  verifyDerivedStatsInvariants,
  type DerivedStatsAccumulator,
  type PlayerWeekDerivedStats
} from "./derive";
import { validatePbpSchema } from "./schema";
import type {
  PbpPipelineCoverage,
  PbpPipelineMode,
  PbpPipelineOptions,
  PbpPipelineReport,
  PbpPipelineStatus,
  PbpPlayerWeekResult
} from "./types";

const STAT_SCOPE = "nflverse_pbp_derived";
const SEASON_TYPE = "regular";

export async function runPbpDerivedPipeline(
  options: PbpPipelineOptions,
  adminClient: SupabaseClient
): Promise<PbpPipelineReport> {
  const startedAt = Date.now();
  const { season, mode, projectRoot } = options;

  // 1. Download (or use cached) gzipped PBP file.
  const download = await downloadAndArchivePbp(season, projectRoot);

  // 2. Decompress and parse CSV.
  const csvText = decompressPbpFile(download.filePath);
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true
  });

  const columns = parsed.meta.fields ?? [];
  const schemaResult = validatePbpSchema(columns);
  if (!schemaResult.valid) {
    return {
      season,
      mode,
      pipelineStatus: "failure",
      sourceUrl: download.sourceUrl,
      filePath: download.filePath,
      sha256: download.sha256,
      alreadyArchived: download.alreadyArchived,
      schemaValid: false,
      missingColumns: schemaResult.missingColumns,
      sourceId: null,
      batchId: null,
      coverage: emptyCoverage(),
      invariantViolations: [],
      durationMs: Date.now() - startedAt,
      completedAt: new Date().toISOString()
    };
  }

  const rawPlays = parsed.data;
  const coverage = emptyCoverage();
  coverage.totalSourcePlays = rawPlays.length;

  // 3. Register source artifact in execute mode.
  let sourceId: string | null = null;
  let batchId: string | null = null;

  if (mode === "execute") {
    sourceId = await upsertDataSource(adminClient, {
      season,
      sourceUrl: download.sourceUrl,
      filePath: download.filePath,
      sha256: download.sha256,
      playCount: rawPlays.length
    });
    batchId = await createBatch(adminClient, { sourceId, season, mode });
    await updateBatchStatus(adminClient, batchId, "in_progress");
  }

  // 4. Accumulate all plays into the DerivedStatsAccumulator.
  const accumulator: DerivedStatsAccumulator = new Map();

  for (const raw of rawPlays) {
    const summary = accumulatePlayEvents(accumulator, raw);
    if (summary.resolved.length > 0) coverage.regularSeasonPlays += 1;
    else coverage.excludedPlays += 1;
    coverage.unresolvedPlays += summary.unresolved.length;
  }

  // 5. Invariant check before any writes.
  const invariantViolations = verifyDerivedStatsInvariants(accumulator);

  // 6. Collect unique GSIS IDs for bulk resolution.
  const allGsisIds = new Set<string>();
  for (const key of accumulator.keys()) {
    const [gsisId] = key.split("|");
    if (gsisId) allGsisIds.add(gsisId);
  }
  coverage.uniqueGsisIds = allGsisIds.size;

  const gsisMap = await resolveGsisIdsBatch(allGsisIds, adminClient);
  coverage.resolvedGsisIds = gsisMap.size;
  coverage.unresolvedGsisIds = allGsisIds.size - gsisMap.size;

  // 7. Pre-flight: fetch existing (player_id, week) natural keys to skip on resume.
  const existingNaturalKeys = new Set<string>();
  if (mode === "execute") {
    let offset = 0;
    while (true) {
      const { data, error } = await adminClient
        .from("player_weekly_derived_stats")
        .select("player_id,week")
        .eq("season", season)
        .eq("season_type", SEASON_TYPE)
        .eq("stat_scope", STAT_SCOPE)
        .range(offset, offset + 999);

      if (error) throw new Error(`Pre-flight derived stats query failed: ${error.message}`);
      for (const row of data ?? []) {
        existingNaturalKeys.add(`${row.player_id as string}|${row.week as number}`);
      }
      if ((data?.length ?? 0) < 1000) break;
      offset += 1000;
    }
    coverage.existingPlayerWeeks = existingNaturalKeys.size;
  }

  // 8. Write results.
  const playerWeekResults: PbpPlayerWeekResult[] = [];

  for (const [accKey, stats] of accumulator) {
    const [gsisId, weekStr] = accKey.split("|");
    const week = parseInt(weekStr ?? "0", 10);
    if (!gsisId) continue;

    const playerId = gsisMap.get(gsisId) ?? null;
    const resolutionStatus = playerId ? "resolved" : "unresolved";

    if (playerId) {
      coverage.resolvedPlayerWeeks += 1;
    } else {
      coverage.unresolvedPlayerWeeks += 1;
    }
    coverage.totalPlayerWeeks += 1;

    let writeStatus: PbpPlayerWeekResult["writeStatus"] = null;

    if (playerId && mode === "execute") {
      const naturalKey = `${playerId}|${week}`;
      if (existingNaturalKeys.has(naturalKey)) {
        writeStatus = "skipped_existing";
      } else {
        try {
          await upsertDerivedStats(adminClient, {
            playerId,
            season,
            week,
            stats,
            sourceId,
            batchId
          });
          writeStatus = "written";
          coverage.writtenPlayerWeeks += 1;
        } catch (err) {
          writeStatus = "error";
          coverage.errorPlayerWeeks += 1;
          playerWeekResults.push({
            gsisId,
            playerId,
            week,
            resolutionStatus: "resolved",
            writeStatus: "error",
            ...stats,
            errorMessage: err instanceof Error ? err.message : String(err)
          });
          continue;
        }
      }
    } else if (mode !== "execute") {
      writeStatus = "skipped_dry_run";
    }

    playerWeekResults.push({
      gsisId,
      playerId,
      week,
      resolutionStatus,
      writeStatus,
      ...stats,
      errorMessage: null
    });
  }

  // 9. Finalize batch.
  const pipelineStatus = computePipelineStatus(coverage, mode, invariantViolations.length);

  if (mode === "execute" && batchId) {
    try {
      const finalStatus = pipelineStatus === "success" ? "completed" : "failed";
      await updateBatchStatus(adminClient, batchId, finalStatus, coverage);
    } catch (trackingErr) {
      console.error(
        `[pbp-pipeline] Warning: batch finalization failed: ${
          trackingErr instanceof Error ? trackingErr.message : String(trackingErr)
        }`
      );
    }
  }

  return {
    season,
    mode,
    pipelineStatus,
    sourceUrl: download.sourceUrl,
    filePath: download.filePath,
    sha256: download.sha256,
    alreadyArchived: download.alreadyArchived,
    schemaValid: true,
    missingColumns: [],
    sourceId,
    batchId,
    coverage,
    invariantViolations,
    durationMs: Date.now() - startedAt,
    completedAt: new Date().toISOString()
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function emptyCoverage(): PbpPipelineCoverage {
  return {
    totalSourcePlays: 0,
    regularSeasonPlays: 0,
    excludedPlays: 0,
    unresolvedPlays: 0,
    totalPlayerWeeks: 0,
    resolvedPlayerWeeks: 0,
    unresolvedPlayerWeeks: 0,
    writtenPlayerWeeks: 0,
    existingPlayerWeeks: 0,
    errorPlayerWeeks: 0,
    uniqueGsisIds: 0,
    resolvedGsisIds: 0,
    unresolvedGsisIds: 0
  };
}

function computePipelineStatus(
  coverage: PbpPipelineCoverage,
  mode: PbpPipelineMode,
  violationCount: number
): PbpPipelineStatus {
  if (violationCount > 0) return "failure";
  if (mode !== "execute") return "success";
  if (coverage.errorPlayerWeeks === 0) return "success";
  if (coverage.writtenPlayerWeeks > 0) return "partial_failure";
  return "failure";
}

async function upsertDataSource(
  client: SupabaseClient,
  input: { season: number; sourceUrl: string; filePath: string; sha256: string; playCount: number }
): Promise<string> {
  const { data: existing, error: lookupError } = await client
    .from("football_data_sources")
    .select("id")
    .eq("provider", "nflverse")
    .eq("source_type", "pbp_derived")
    .eq("season", input.season)
    .eq("sha256", input.sha256)
    .maybeSingle();

  if (lookupError) throw new Error(`Failed to look up PBP data source: ${lookupError.message}`);
  if (existing) return existing.id as string;

  const { data, error } = await client
    .from("football_data_sources")
    .insert({
      provider: "nflverse",
      source_type: "pbp_derived",
      season: input.season,
      source_url: input.sourceUrl,
      file_path: input.filePath,
      sha256: input.sha256,
      row_count: input.playCount,
      downloaded_at: new Date().toISOString(),
      metadata_json: {}
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create PBP data source: ${error.message}`);
  return data.id as string;
}

async function createBatch(
  client: SupabaseClient,
  input: { sourceId: string; season: number; mode: string }
): Promise<string> {
  const { data, error } = await client
    .from("football_import_batches")
    .insert({
      source_id: input.sourceId,
      season: input.season,
      mode: input.mode,
      status: "pending",
      started_at: new Date().toISOString(),
      report_json: {}
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create PBP import batch: ${error.message}`);
  return data.id as string;
}

async function updateBatchStatus(
  client: SupabaseClient,
  batchId: string,
  status: "in_progress" | "completed" | "failed",
  coverage?: PbpPipelineCoverage
) {
  const payload: Record<string, unknown> = { status };
  if (status === "completed" || status === "failed") {
    payload.completed_at = new Date().toISOString();
    if (coverage) payload.report_json = coverage;
  }
  const { error } = await client.from("football_import_batches").update(payload).eq("id", batchId);
  if (error) throw new Error(`Failed to update PBP batch status: ${error.message}`);
}

async function upsertDerivedStats(
  client: SupabaseClient,
  input: {
    playerId: string;
    season: number;
    week: number;
    stats: PlayerWeekDerivedStats;
    sourceId: string | null;
    batchId: string | null;
  }
) {
  const { error } = await client.from("player_weekly_derived_stats").upsert(
    {
      player_id: input.playerId,
      season: input.season,
      week: input.week,
      season_type: SEASON_TYPE,
      stat_scope: STAT_SCOPE,
      stats_json: input.stats,
      completeness: "complete",
      source_artifact_id: input.sourceId ?? undefined,
      import_batch_id: input.batchId ?? undefined,
      ingested_at: new Date().toISOString()
    },
    {
      onConflict: "player_id,season,week,season_type,stat_scope"
    }
  );

  if (error) {
    throw new Error(
      `Failed to upsert derived stats for player ${input.playerId} week ${input.week}: ${error.message}`
    );
  }
}

export { computePipelineStatus, emptyCoverage };
export type { PbpPipelineOptions };
