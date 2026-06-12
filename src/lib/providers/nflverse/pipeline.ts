import "server-only";

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import Papa from "papaparse";
import type { SupabaseClient } from "@supabase/supabase-js";

import { upsertWeeklyStats } from "@/lib/providers/repositories/weekly-stats";

import { downloadAndArchive } from "./download";
import { resolveGsisIdsBatch } from "./identity";
import { buildRowSha256Input, normalizeNflverseRow } from "./normalize";
import { validateNflverseSchema, NFLVERSE_SUPPORTED_POSITION_GROUPS } from "./schema";
import type {
  NflversePipelineCoverage,
  NflversePipelineOptions,
  NflversePipelineReport,
  NflversePipelineStatus,
  NflverseRowResult
} from "./types";

// Pre-flight page size for querying existing rows.
const PREFLIGHT_PAGE_SIZE = 1000;

export async function runNflversePipeline(
  options: NflversePipelineOptions,
  adminClient: SupabaseClient
): Promise<NflversePipelineReport> {
  const startedAt = Date.now();
  const { season, mode, projectRoot } = options;

  // 1. Download and archive source artifact
  const download = await downloadAndArchive(season, projectRoot);

  // 2. Parse CSV
  const fileContent = readFileSync(download.filePath, "utf8");
  const parsed = Papa.parse<Record<string, string>>(fileContent, {
    header: true,
    skipEmptyLines: true
  });

  const columns = parsed.meta.fields ?? [];
  const schemaResult = validateNflverseSchema(columns);
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
      durationMs: Date.now() - startedAt,
      completedAt: new Date().toISOString()
    };
  }

  const rawRows = parsed.data;

  // 3. Register source artifact in execute mode
  let sourceId: string | null = null;
  let batchId: string | null = null;

  if (mode === "execute") {
    sourceId = await upsertDataSource(adminClient, {
      season,
      sourceUrl: download.sourceUrl,
      filePath: download.filePath,
      sha256: download.sha256,
      rowCount: rawRows.length
    });

    batchId = await createBatch(adminClient, {
      sourceId,
      season,
      mode
    });

    await updateBatchStatus(adminClient, batchId, "in_progress");
  }

  // 4. First pass: normalize all scope rows and collect GSIS IDs for bulk resolution.
  type NormalizedEntry = {
    sourceRowNumber: number;
    rowSha256: string;
    normalizeResult: ReturnType<typeof normalizeNflverseRow>;
    rawGsisId: string;
  };

  const scopeEntries: NormalizedEntry[] = [];
  const coverage: NflversePipelineCoverage = emptyCoverage();

  coverage.totalSourceRows = rawRows.length;

  for (let i = 0; i < rawRows.length; i += 1) {
    const raw = rawRows[i];
    const positionGroup = raw["position_group"]?.trim().toUpperCase();

    if (!positionGroup || !NFLVERSE_SUPPORTED_POSITION_GROUPS.has(positionGroup)) {
      continue;
    }

    coverage.filteredPositionRows += 1;

    const rowSha256 = createHash("sha256").update(buildRowSha256Input(raw)).digest("hex");
    const normalizeResult = normalizeNflverseRow(raw);
    scopeEntries.push({
      sourceRowNumber: i + 1,
      rowSha256,
      normalizeResult,
      rawGsisId: raw["player_id"]?.trim() ?? ""
    });
  }

  // 5. Bulk GSIS identity resolution — one DB call (chunked at 500) for all scope rows.
  const scopeGsisIds = new Set(
    scopeEntries
      .filter((e) => e.normalizeResult.ok)
      .map((e) => (e.normalizeResult.ok ? e.normalizeResult.row.gsisId : ""))
      .filter(Boolean)
  );
  const gsisMap = await resolveGsisIdsBatch(scopeGsisIds, adminClient);

  // 6. Pre-flight: in execute mode, fetch the set of (player_id, week) pairs that
  //    already exist in player_weekly_stats for this provider/season/season_type.
  //    These rows are skipped (not re-written) to support safe resume.
  const existingNaturalKeys = new Set<string>();
  if (mode === "execute") {
    let offset = 0;
    while (true) {
      const { data, error } = await adminClient
        .from("player_weekly_stats")
        .select("player_id,week")
        .eq("provider", "nflverse")
        .eq("season", season)
        .eq("season_type", "regular")
        .range(offset, offset + PREFLIGHT_PAGE_SIZE - 1);

      if (error) throw new Error(`Pre-flight existing-row query failed: ${error.message}`);
      for (const row of data ?? []) {
        existingNaturalKeys.add(`${row.player_id as string}|${row.week as number}`);
      }
      if ((data?.length ?? 0) < PREFLIGHT_PAGE_SIZE) break;
      offset += PREFLIGHT_PAGE_SIZE;
    }
    coverage.existingRows = existingNaturalKeys.size;
  }

  // 7. Second pass: apply resolution map and write rows.
  const rowResults: NflverseRowResult[] = [];
  const allGsisIds = new Set<string>();
  const resolvedGsisIds = new Set<string>();
  const unresolvedGsisIds = new Set<string>();

  for (const entry of scopeEntries) {
    const { sourceRowNumber, rowSha256, normalizeResult, rawGsisId } = entry;

    if (!normalizeResult.ok) {
      const isNonRegular = normalizeResult.reason.startsWith("Skipping non-regular");
      const resolutionStatus = isNonRegular ? "skipped" : "rejected";
      if (!isNonRegular) coverage.rejectedRows += 1;
      rowResults.push({
        sourceRowNumber,
        rowSha256,
        gsisId: rawGsisId,
        playerId: null,
        resolutionStatus,
        writeStatus: null,
        canonicalKeyCount: 0,
        errorMessage: normalizeResult.reason
      });
      continue;
    }

    coverage.regularSeasonRows += 1;
    const { row } = normalizeResult;
    allGsisIds.add(row.gsisId);

    const playerId = gsisMap.get(row.gsisId) ?? null;
    const resolutionStatus: NflverseRowResult["resolutionStatus"] = playerId ? "resolved" : "unresolved";

    if (playerId) {
      resolvedGsisIds.add(row.gsisId);
      coverage.resolvedRows += 1;
    } else {
      unresolvedGsisIds.add(row.gsisId);
      coverage.unresolvedRows += 1;
    }

    if (!coverage.coverageByPosition[row.positionGroup]) {
      coverage.coverageByPosition[row.positionGroup] = { resolved: 0, unresolved: 0 };
    }
    coverage.coverageByPosition[row.positionGroup][playerId ? "resolved" : "unresolved"] += 1;

    // 8. Write row: execute mode only, resolved only, not already existing.
    let writeStatus: NflverseRowResult["writeStatus"] = null;

    if (playerId) {
      const naturalKey = `${playerId}|${row.week}`;

      if (mode === "execute") {
        if (existingNaturalKeys.has(naturalKey)) {
          // Row already exists — skip to avoid duplicate write.
          writeStatus = "skipped_existing";
          // existingRows was already set from pre-flight; don't double-count
        } else {
          try {
            await upsertWeeklyStats(
              {
                player_id: playerId,
                provider: "nflverse",
                provider_external_id: row.gsisId,
                season: row.season,
                week: row.week,
                season_type: row.seasonType,
                team: row.team || null,
                opponent: row.opponent || null,
                position_group: row.positionGroup,
                stats_json: row.stats,
                provider_fantasy_points: row.providerFantasyPoints ?? null,
                metadata_json: {}
              },
              { requireVerifiedMapping: false },
              adminClient as Parameters<typeof upsertWeeklyStats>[2]
            );
            writeStatus = "written";
            coverage.writtenRows += 1;
            coverage.insertedRows += 1;
          } catch (err) {
            writeStatus = "error";
            coverage.errorRows += 1;
            rowResults.push({
              sourceRowNumber,
              rowSha256,
              gsisId: row.gsisId,
              playerId,
              resolutionStatus: "resolved",
              writeStatus: "error",
              canonicalKeyCount: row.canonicalKeyCount,
              errorMessage: err instanceof Error ? err.message : String(err)
            });
            continue;
          }
        }
      } else {
        writeStatus = "skipped_dry_run";
      }
    }

    rowResults.push({
      sourceRowNumber,
      rowSha256,
      gsisId: row.gsisId,
      playerId,
      resolutionStatus,
      writeStatus,
      canonicalKeyCount: row.canonicalKeyCount,
      errorMessage: null
    });
  }

  coverage.uniqueGsisIds = allGsisIds.size;
  coverage.resolvedGsisIds = resolvedGsisIds.size;
  coverage.unresolvedGsisIds = unresolvedGsisIds.size;

  // 9. Determine pipeline status.
  const pipelineStatus = computePipelineStatus(coverage, mode);

  // 10. Persist row tracking and finalize batch (execute mode only).
  //     Always attempt finalization even after partial failure.
  if (mode === "execute" && batchId) {
    try {
      await writeSourceRows(adminClient, batchId, rowResults);
      const finalStatus = pipelineStatus === "success" ? "completed" : "failed";
      await updateBatchStatus(adminClient, batchId, finalStatus, coverage);
    } catch (trackingErr) {
      // Tracking failure does not override the row write outcome.
      console.error(
        `[pipeline] Warning: batch tracking update failed (rows were written): ${
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
    durationMs: Date.now() - startedAt,
    completedAt: new Date().toISOString()
  };
}

function computePipelineStatus(
  coverage: NflversePipelineCoverage,
  mode: NflversePipelineOptions["mode"]
): NflversePipelineStatus {
  if (mode !== "execute") return "success";
  if (coverage.errorRows === 0) return "success";
  if (coverage.writtenRows > 0) return "partial_failure";
  return "failure";
}

function emptyCoverage(): NflversePipelineCoverage {
  return {
    totalSourceRows: 0,
    filteredPositionRows: 0,
    regularSeasonRows: 0,
    resolvedRows: 0,
    unresolvedRows: 0,
    rejectedRows: 0,
    writtenRows: 0,
    insertedRows: 0,
    existingRows: 0,
    errorRows: 0,
    uniqueGsisIds: 0,
    resolvedGsisIds: 0,
    unresolvedGsisIds: 0,
    coverageByPosition: {}
  };
}

async function upsertDataSource(
  client: SupabaseClient,
  input: {
    season: number;
    sourceUrl: string;
    filePath: string;
    sha256: string;
    rowCount: number;
  }
): Promise<string> {
  const { data: existing, error: lookupError } = await client
    .from("football_data_sources")
    .select("id")
    .eq("provider", "nflverse")
    .eq("source_type", "weekly_stats")
    .eq("season", input.season)
    .eq("sha256", input.sha256)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Failed to look up data source: ${lookupError.message}`);
  }

  if (existing) {
    return existing.id;
  }

  const { data, error } = await client
    .from("football_data_sources")
    .insert({
      provider: "nflverse",
      source_type: "weekly_stats",
      season: input.season,
      source_url: input.sourceUrl,
      file_path: input.filePath,
      sha256: input.sha256,
      row_count: input.rowCount,
      downloaded_at: new Date().toISOString(),
      metadata_json: {}
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create data source record: ${error.message}`);
  }

  return data.id;
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

  if (error) {
    throw new Error(`Failed to create import batch: ${error.message}`);
  }

  return data.id;
}

async function updateBatchStatus(
  client: SupabaseClient,
  batchId: string,
  status: "in_progress" | "completed" | "failed",
  coverage?: NflversePipelineCoverage
) {
  const payload: Record<string, unknown> = { status };
  if (status === "completed" || status === "failed") {
    payload.completed_at = new Date().toISOString();
    if (coverage) {
      payload.report_json = coverage;
    }
  }

  const { error } = await client
    .from("football_import_batches")
    .update(payload)
    .eq("id", batchId);

  if (error) {
    throw new Error(`Failed to update batch status: ${error.message}`);
  }
}

async function writeSourceRows(
  client: SupabaseClient,
  batchId: string,
  rows: NflverseRowResult[]
) {
  const CHUNK_SIZE = 500;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const insertRows = chunk.map((r) => ({
      batch_id: batchId,
      source_row_number: r.sourceRowNumber,
      row_sha256: r.rowSha256,
      player_id: r.playerId,
      gsis_id: r.gsisId || null,
      resolution_status: r.resolutionStatus,
      // "skipped_existing" is not a valid DB value — map to null
      write_status: r.writeStatus === "skipped_existing" ? null : r.writeStatus,
      canonical_key_count: r.canonicalKeyCount,
      error_message: r.errorMessage
    }));

    const { error } = await client.from("football_source_rows").insert(insertRows);
    if (error) {
      throw new Error(`Failed to write source rows (chunk starting at ${i}): ${error.message}`);
    }
  }
}

// Re-export for testability
export { computePipelineStatus, emptyCoverage };
export type { NflversePipelineOptions };
