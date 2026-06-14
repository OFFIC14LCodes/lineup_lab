import "server-only";

import { createHash } from "node:crypto";

import Papa from "papaparse";
import type { SupabaseClient } from "@supabase/supabase-js";

import { decompressPbpFile, downloadAndArchivePbp } from "@/lib/providers/nflverse/pbp/download";
import { validatePbpSchema } from "@/lib/providers/nflverse/pbp/schema";
import { downloadAndArchiveSchedules, readSchedulesFile } from "@/lib/providers/nflverse/schedules/download";
import { parseScheduleRow, validateSchedulesSchema } from "@/lib/providers/nflverse/schedules/schema";
import { normalizeNflTeamId } from "@/lib/providers/nflverse/teams/normalize";

import { accumulateTeamYards, getTeamOffensiveYards, verifyYardInvariants } from "./derive";
import type {
  TeamGameInvariantViolation,
  TeamGamePipelineCoverage,
  TeamGamePipelineMode,
  TeamGamePipelineOptions,
  TeamGamePipelineReport,
  TeamGamePipelineStatus,
  TeamGameRow,
  TeamGameWriteResult,
} from "./types";

export type ExistingTeamGameRow = {
  game_id: string;
  season: number;
  week: number;
  season_type: "REG";
  team_id: string;
  opponent_id: string;
  is_home: boolean;
  points_scored: number | null;
  points_allowed: number | null;
  offensive_yards: number | null;
  yards_allowed: number | null;
  is_final: boolean;
  reconciliation_status: "pending" | "verified" | "conflict" | "incomplete";
  source_provider: string;
  source_batch_id: string | null;
  updated_at: string | null;
};

type TeamGameSemanticPayload = {
  season: number;
  week: number;
  seasonType: "REG";
  gameId: string;
  teamId: string;
  opponentId: string;
  homeAway: "home" | "away";
  pointsScored: number | null;
  pointsAllowed: number | null;
  offensiveYards: number | null;
  yardsAllowed: number | null;
  isFinal: boolean;
  reconciliationStatus: string;
  sourceProvider: string;
};

type TeamGameWriteAction =
  | "insert_required"
  | "update_required"
  | "unchanged"
  | "conflict";

export type TeamGameRowDecision = {
  row: TeamGameRow;
  naturalKey: string;
  action: TeamGameWriteAction;
  errorMessage: string | null;
  semanticHash: string;
  existingSemanticHash: string | null;
};

export type TeamGameRowClassification = {
  decisions: TeamGameRowDecision[];
  rowsExisting: number;
  rowsInserted: number;
  rowsUpdated: number;
  rowsUnchanged: number;
  rowsConflicted: number;
  rowsMissing: number;
  rowsUnexpected: number;
  exactSemanticMatches: number;
  semanticDifferences: number;
  duplicateNaturalKeys: number;
};

export async function runTeamGamePipeline(
  options: TeamGamePipelineOptions,
  adminClient: SupabaseClient
): Promise<TeamGamePipelineReport> {
  const startedAt = Date.now();
  const { season, mode, projectRoot } = options;

  const coverage = emptyCoverage();
  const invariantViolations: TeamGameInvariantViolation[] = [];
  const writeResults: TeamGameWriteResult[] = [];

  // 1. Download schedules CSV.
  const schedulesDownload = await downloadAndArchiveSchedules(projectRoot);
  const schedulesCsvText = readSchedulesFile(schedulesDownload.filePath);

  const schedulesParsed = Papa.parse<Record<string, string>>(schedulesCsvText, {
    header: true,
    skipEmptyLines: true,
  });

  const schedulesColumns = schedulesParsed.meta.fields ?? [];
  const schedulesSchema = validateSchedulesSchema(schedulesColumns);

  if (!schedulesSchema.valid) {
    return failureReport({
      season, mode, coverage, invariantViolations, writeResults,
      schedulesDownload, pbpFilePath: null, pbpSchemaValid: true,
      schedulesSchemaValid: false,
      schedulesMissingColumns: schedulesSchema.missingColumns,
      sourceId: null, batchId: null,
      pipelineStatus: "schema_error",
      startedAt,
    });
  }

  // 2. Parse schedule rows for this season (REG, with final scores).
  const scheduleRows = schedulesParsed.data;
  coverage.totalScheduleRows = scheduleRows.length;

  type ParsedGame = {
    gameId: string;
    week: number;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number;
    awayScore: number;
  };
  const parsedGames: ParsedGame[] = [];

  for (const raw of scheduleRows) {
    if (raw["season"]?.trim() !== String(season)) {
      if (raw["game_type"]?.trim() !== "REG") coverage.skippedNonReg += 1;
      continue;
    }

    const game = parseScheduleRow(raw);
    if (!game) {
      if (raw["game_type"]?.trim() !== "REG") {
        coverage.skippedNonReg += 1;
      } else {
        coverage.skippedNoScore += 1;
      }
      continue;
    }

    coverage.filteredGames += 1;

    const homeTeamId = normalizeNflTeamId(game.homeTeamRaw);
    const awayTeamId = normalizeNflTeamId(game.awayTeamRaw);

    if (!homeTeamId || !awayTeamId) {
      coverage.skippedBadTeam += 1;
      continue;
    }

    parsedGames.push({
      gameId: game.gameId,
      week: game.week,
      homeTeamId,
      awayTeamId,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
    });
  }

  // 3. Download (or use cached) PBP for yard aggregation.
  const pbpDownload = await downloadAndArchivePbp(season, projectRoot);
  const pbpCsvText = decompressPbpFile(pbpDownload.filePath);

  const pbpParsed = Papa.parse<Record<string, string>>(pbpCsvText, {
    header: true,
    skipEmptyLines: true,
  });

  const pbpColumns = pbpParsed.meta.fields ?? [];
  const pbpSchema = validatePbpSchema(pbpColumns);

  if (!pbpSchema.valid) {
    return failureReport({
      season, mode, coverage, invariantViolations, writeResults,
      schedulesDownload, pbpFilePath: pbpDownload.filePath, pbpSchemaValid: false,
      schedulesSchemaValid: true, schedulesMissingColumns: [],
      sourceId: null, batchId: null,
      pipelineStatus: "schema_error",
      startedAt,
    });
  }

  // 4. Accumulate PBP yards.
  const yardsAcc = accumulateTeamYards(pbpParsed.data);

  // 5. Build team_game_stats rows (2 per game: home + away).
  const teamGameRows: TeamGameRow[] = [];

  for (const game of parsedGames) {
    const { gameId, week, homeTeamId, awayTeamId, homeScore, awayScore } = game;

    const homeOffYards = getTeamOffensiveYards(yardsAcc, gameId, homeTeamId);
    const awayOffYards = getTeamOffensiveYards(yardsAcc, gameId, awayTeamId);

    if (homeOffYards !== null) {
      coverage.pbpGamesFound += 1;
    } else {
      coverage.pbpGamesMissing += 1;
    }

    // Run yard invariants.
    const yardViolations = verifyYardInvariants(yardsAcc, gameId, homeTeamId, awayTeamId);
    for (const v of yardViolations) {
      invariantViolations.push({ gameId, violation: v });
    }

    // Home team row.
    teamGameRows.push({
      gameId,
      season,
      week,
      seasonType: "REG",
      teamId: homeTeamId,
      opponentId: awayTeamId,
      isHome: true,
      pointsScored: homeScore,
      pointsAllowed: awayScore,
      offensiveYards: homeOffYards,
      yardsAllowed: awayOffYards,
      isFinal: true,
    });

    // Away team row.
    teamGameRows.push({
      gameId,
      season,
      week,
      seasonType: "REG",
      teamId: awayTeamId,
      opponentId: homeTeamId,
      isHome: false,
      pointsScored: awayScore,
      pointsAllowed: homeScore,
      offensiveYards: awayOffYards,
      yardsAllowed: homeOffYards,
      isFinal: true,
    });
  }

  coverage.teamGameRowsBuilt = teamGameRows.length;

  // 6. Register source artifact and batch in execute mode.
  let sourceId: string | null = null;
  let batchId: string | null = null;

  if (mode === "execute") {
    sourceId = await upsertDataSource(adminClient, {
      season,
      sourceUrl: schedulesDownload.sourceUrl,
      filePath: schedulesDownload.filePath,
      sha256: schedulesDownload.sha256,
      rowCount: scheduleRows.length,
    });
    batchId = await createBatch(adminClient, { sourceId, season, mode });
    await updateBatchStatus(adminClient, batchId, "in_progress");
  }

  // 7. Pre-flight: fetch existing rows for semantic idempotency in both modes.
  const existingRows = await loadExistingTeamGameRows(adminClient, season);
  const classification = classifyTeamGameRows(teamGameRows, existingRows);
  coverage.rowsDerived = teamGameRows.length;
  coverage.rowsExisting = classification.rowsExisting;
  coverage.rowsInserted = classification.rowsInserted;
  coverage.rowsUpdated = classification.rowsUpdated;
  coverage.rowsUnchanged = classification.rowsUnchanged;
  coverage.rowsConflicted = classification.rowsConflicted;
  coverage.rowsMissing = classification.rowsMissing;
  coverage.rowsUnexpected = classification.rowsUnexpected;
  coverage.exactSemanticMatches = classification.exactSemanticMatches;
  coverage.semanticDifferences = classification.semanticDifferences;
  coverage.duplicateNaturalKeys = classification.duplicateNaturalKeys;

  // 8. Classify and write only semantic inserts/updates.
  for (const decision of classification.decisions) {
    const { row, semanticHash, existingSemanticHash } = decision;

    if (decision.action === "conflict") {
      writeResults.push({
        gameId: row.gameId,
        teamId: row.teamId,
        writeStatus: "conflict",
        errorMessage: decision.errorMessage,
        semanticHash,
        existingSemanticHash,
      });
      continue;
    }

    if (decision.action === "unchanged") {
      writeResults.push({ gameId: row.gameId, teamId: row.teamId, writeStatus: "unchanged", errorMessage: null, semanticHash, existingSemanticHash });
      continue;
    }

    if (decision.action === "insert_required") {
      if (mode !== "execute") {
        writeResults.push({ gameId: row.gameId, teamId: row.teamId, writeStatus: "insert_required", errorMessage: null, semanticHash, existingSemanticHash });
        continue;
      }

      coverage.writeAttempts += 1;
      try {
        await upsertTeamGameStats(adminClient, row, batchId);
        writeResults.push({ gameId: row.gameId, teamId: row.teamId, writeStatus: "inserted", errorMessage: null, semanticHash, existingSemanticHash });
      } catch (err) {
        writeResults.push({
          gameId: row.gameId,
          teamId: row.teamId,
          writeStatus: "error",
          errorMessage: err instanceof Error ? err.message : String(err),
          semanticHash,
          existingSemanticHash,
        });
        coverage.writeErrors += 1;
      }
      continue;
    }

    if (mode !== "execute") {
      writeResults.push({ gameId: row.gameId, teamId: row.teamId, writeStatus: "update_required", errorMessage: null, semanticHash, existingSemanticHash });
      continue;
    }

    coverage.writeAttempts += 1;
    try {
      await upsertTeamGameStats(adminClient, row, batchId);
      writeResults.push({ gameId: row.gameId, teamId: row.teamId, writeStatus: "updated", errorMessage: null, semanticHash, existingSemanticHash });
    } catch (err) {
      writeResults.push({
        gameId: row.gameId,
        teamId: row.teamId,
        writeStatus: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
        semanticHash,
        existingSemanticHash,
      });
      coverage.writeErrors += 1;
    }
  }

  // 9. Finalize batch.
  const pipelineStatus = computePipelineStatus(coverage, mode, invariantViolations.length);

  if (mode === "execute" && batchId) {
    try {
      await updateBatchStatus(adminClient, batchId, pipelineStatus === "success" ? "completed" : "failed", coverage);
    } catch (trackingErr) {
      console.error(
        `[team-game-pipeline] Warning: batch finalization failed: ${
          trackingErr instanceof Error ? trackingErr.message : String(trackingErr)
        }`
      );
    }
  }

  return {
    season,
    mode,
    pipelineStatus,
    schedulesUrl: schedulesDownload.sourceUrl,
    schedulesFilePath: schedulesDownload.filePath,
    schedulesSha256: schedulesDownload.sha256,
    schedulesAlreadyArchived: schedulesDownload.alreadyArchived,
    schedulesSchemaValid: true,
    schedulesMissingColumns: [],
    pbpFilePath: pbpDownload.filePath,
    pbpSchemaValid: true,
    sourceId,
    batchId,
    coverage,
    invariantViolations,
    writeResults,
    durationMs: Date.now() - startedAt,
    completedAt: new Date().toISOString(),
  };
}

function emptyClassification(): TeamGameRowClassification {
  return {
    decisions: [],
    rowsExisting: 0,
    rowsInserted: 0,
    rowsUpdated: 0,
    rowsUnchanged: 0,
    rowsConflicted: 0,
    rowsMissing: 0,
    rowsUnexpected: 0,
    exactSemanticMatches: 0,
    semanticDifferences: 0,
    duplicateNaturalKeys: 0,
  };
}

function classifyTeamGameRows(
  teamGameRows: TeamGameRow[],
  existingRows: ExistingTeamGameRow[]
): TeamGameRowClassification {
  const classification = emptyClassification();
  classification.rowsExisting = existingRows.length;

  const existingRowsByKey = new Map<string, ExistingTeamGameRow>();
  const duplicateExistingKeys = new Set<string>();
  for (const row of existingRows) {
    const key = makeNaturalKey(row.game_id, row.team_id);
    if (existingRowsByKey.has(key)) {
      duplicateExistingKeys.add(key);
      continue;
    }
    existingRowsByKey.set(key, row);
  }

  const derivedRowsByKey = new Map<string, TeamGameRow>();
  const duplicateDerivedKeys = new Set<string>();
  for (const row of teamGameRows) {
    const key = makeNaturalKey(row.gameId, row.teamId);
    if (derivedRowsByKey.has(key)) {
      duplicateDerivedKeys.add(key);
      continue;
    }
    derivedRowsByKey.set(key, row);
  }

  classification.duplicateNaturalKeys = duplicateExistingKeys.size + duplicateDerivedKeys.size;
  classification.rowsUnexpected = [...existingRowsByKey.keys()].filter((key) => !derivedRowsByKey.has(key)).length;

  for (const row of teamGameRows) {
    const naturalKey = makeNaturalKey(row.gameId, row.teamId);
    const semanticHash = computeTeamGameSemanticHash(row);
    const existingRow = existingRowsByKey.get(naturalKey) ?? null;
    const existingSemanticHash = existingRow ? computeExistingTeamGameSemanticHash(existingRow) : null;

    if (duplicateDerivedKeys.has(naturalKey) || duplicateExistingKeys.has(naturalKey)) {
      classification.rowsConflicted += 1;
      classification.decisions.push({
        row,
        naturalKey,
        action: "conflict",
        errorMessage: duplicateDerivedKeys.has(naturalKey)
          ? "duplicate derived natural key"
          : "duplicate existing natural key",
        semanticHash,
        existingSemanticHash,
      });
      continue;
    }

    if (!existingRow) {
      classification.rowsInserted += 1;
      classification.rowsMissing += 1;
      classification.decisions.push({
        row,
        naturalKey,
        action: "insert_required",
        errorMessage: null,
        semanticHash,
        existingSemanticHash,
      });
      continue;
    }

    if (semanticHash === existingSemanticHash) {
      classification.rowsUnchanged += 1;
      classification.exactSemanticMatches += 1;
      classification.decisions.push({
        row,
        naturalKey,
        action: "unchanged",
        errorMessage: null,
        semanticHash,
        existingSemanticHash,
      });
      continue;
    }

    classification.rowsUpdated += 1;
    classification.semanticDifferences += 1;
    classification.decisions.push({
      row,
      naturalKey,
      action: "update_required",
      errorMessage: null,
      semanticHash,
      existingSemanticHash,
    });
  }

  return classification;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function emptyCoverage(): TeamGamePipelineCoverage {
  return {
    totalScheduleRows: 0,
    filteredGames: 0,
    skippedNonReg: 0,
    skippedNoScore: 0,
    skippedBadTeam: 0,
    teamGameRowsBuilt: 0,
    rowsDerived: 0,
    rowsExisting: 0,
    rowsInserted: 0,
    rowsUpdated: 0,
    rowsUnchanged: 0,
    rowsConflicted: 0,
    rowsMissing: 0,
    rowsUnexpected: 0,
    exactSemanticMatches: 0,
    semanticDifferences: 0,
    duplicateNaturalKeys: 0,
    writeAttempts: 0,
    writeErrors: 0,
    pbpGamesFound: 0,
    pbpGamesMissing: 0,
  };
}

function computePipelineStatus(
  coverage: TeamGamePipelineCoverage,
  mode: TeamGamePipelineMode,
  violationCount: number
): TeamGamePipelineStatus {
  if (violationCount > 0) return "partial_failure";
  if (mode !== "execute") return "success";
  if (coverage.writeErrors === 0 && coverage.rowsConflicted === 0) return "success";
  if (coverage.writeAttempts > coverage.writeErrors) return "partial_failure";
  return "failure";
}

type FailureReportArgs = {
  season: number;
  mode: TeamGamePipelineMode;
  coverage: TeamGamePipelineCoverage;
  invariantViolations: TeamGameInvariantViolation[];
  writeResults: TeamGameWriteResult[];
  schedulesDownload: { sourceUrl: string; filePath: string; sha256: string; alreadyArchived: boolean };
  pbpFilePath: string | null;
  pbpSchemaValid: boolean;
  schedulesSchemaValid: boolean;
  schedulesMissingColumns: string[];
  sourceId: string | null;
  batchId: string | null;
  pipelineStatus: TeamGamePipelineStatus;
  startedAt: number;
};

function failureReport(args: FailureReportArgs): TeamGamePipelineReport {
  return {
    season: args.season,
    mode: args.mode,
    pipelineStatus: args.pipelineStatus,
    schedulesUrl: args.schedulesDownload.sourceUrl,
    schedulesFilePath: args.schedulesDownload.filePath,
    schedulesSha256: args.schedulesDownload.sha256,
    schedulesAlreadyArchived: args.schedulesDownload.alreadyArchived,
    schedulesSchemaValid: args.schedulesSchemaValid,
    schedulesMissingColumns: args.schedulesMissingColumns,
    pbpFilePath: args.pbpFilePath,
    pbpSchemaValid: args.pbpSchemaValid,
    sourceId: args.sourceId,
    batchId: args.batchId,
    coverage: args.coverage,
    invariantViolations: args.invariantViolations,
    writeResults: args.writeResults,
    durationMs: Date.now() - args.startedAt,
    completedAt: new Date().toISOString(),
  };
}

async function upsertTeamGameStats(
  client: SupabaseClient,
  row: TeamGameRow,
  batchId: string | null
) {
  const { error } = await client.from("team_game_stats").upsert(
    {
      game_id: row.gameId,
      season: row.season,
      week: row.week,
      season_type: row.seasonType,
      team_id: row.teamId,
      opponent_id: row.opponentId,
      is_home: row.isHome,
      points_scored: row.pointsScored,
      points_allowed: row.pointsAllowed,
      offensive_yards: row.offensiveYards ?? null,
      yards_allowed: row.yardsAllowed ?? null,
      is_final: row.isFinal,
      reconciliation_status: "verified",
      source_provider: "nflverse",
      source_batch_id: batchId ?? undefined,
    },
    { onConflict: "game_id,team_id" }
  );

  if (error) {
    throw new Error(
      `Failed to upsert team_game_stats for ${row.teamId} game ${row.gameId}: ${error.message}`
    );
  }
}

async function loadExistingTeamGameRows(
  client: SupabaseClient,
  season: number
): Promise<ExistingTeamGameRow[]> {
  const rows: ExistingTeamGameRow[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await client
      .from("team_game_stats")
      .select(
        [
          "game_id",
          "season",
          "week",
          "season_type",
          "team_id",
          "opponent_id",
          "is_home",
          "points_scored",
          "points_allowed",
          "offensive_yards",
          "yards_allowed",
          "is_final",
          "reconciliation_status",
          "source_provider",
          "source_batch_id",
          "updated_at",
        ].join(",")
      )
      .eq("season", season)
      .eq("season_type", "REG")
      .range(offset, offset + 999);

    if (error) throw new Error(`Pre-flight team_game_stats query failed: ${error.message}`);
    rows.push(...((data ?? []) as unknown as ExistingTeamGameRow[]));
    if ((data?.length ?? 0) < 1000) break;
    offset += 1000;
  }
  return rows;
}

function makeNaturalKey(gameId: string, teamId: string) {
  return `${gameId}|${teamId}`;
}

function buildTeamGameSemanticPayload(row: TeamGameRow): TeamGameSemanticPayload {
  return {
    season: row.season,
    week: row.week,
    seasonType: row.seasonType,
    gameId: row.gameId,
    teamId: row.teamId,
    opponentId: row.opponentId,
    homeAway: row.isHome ? "home" : "away",
    pointsScored: row.pointsScored,
    pointsAllowed: row.pointsAllowed,
    offensiveYards: row.offensiveYards,
    yardsAllowed: row.yardsAllowed,
    isFinal: row.isFinal,
    reconciliationStatus: "verified",
    sourceProvider: "nflverse",
  };
}

function buildExistingTeamGameSemanticPayload(row: ExistingTeamGameRow): TeamGameSemanticPayload {
  return {
    season: row.season,
    week: row.week,
    seasonType: row.season_type,
    gameId: row.game_id,
    teamId: row.team_id,
    opponentId: row.opponent_id,
    homeAway: row.is_home ? "home" : "away",
    pointsScored: row.points_scored,
    pointsAllowed: row.points_allowed,
    offensiveYards: row.offensive_yards,
    yardsAllowed: row.yards_allowed,
    isFinal: row.is_final,
    reconciliationStatus: row.reconciliation_status,
    sourceProvider: row.source_provider,
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

function hashSemanticPayload(payload: TeamGameSemanticPayload): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

function computeTeamGameSemanticHash(row: TeamGameRow): string {
  return hashSemanticPayload(buildTeamGameSemanticPayload(row));
}

function computeExistingTeamGameSemanticHash(row: ExistingTeamGameRow): string {
  return hashSemanticPayload(buildExistingTeamGameSemanticPayload(row));
}

async function upsertDataSource(
  client: SupabaseClient,
  input: { season: number; sourceUrl: string; filePath: string; sha256: string; rowCount: number }
): Promise<string> {
  const { data: existing, error: lookupError } = await client
    .from("football_data_sources")
    .select("id")
    .eq("provider", "nflverse")
    .eq("source_type", "schedules")
    .eq("season", input.season)
    .eq("sha256", input.sha256)
    .maybeSingle();

  if (lookupError) throw new Error(`Failed to look up schedules data source: ${lookupError.message}`);
  if (existing) return existing.id as string;

  const { data, error } = await client
    .from("football_data_sources")
    .insert({
      provider: "nflverse",
      source_type: "schedules",
      season: input.season,
      source_url: input.sourceUrl,
      file_path: input.filePath,
      sha256: input.sha256,
      row_count: input.rowCount,
      downloaded_at: new Date().toISOString(),
      metadata_json: {},
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create schedules data source: ${error.message}`);
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
      report_json: {},
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create team-games import batch: ${error.message}`);
  return data.id as string;
}

async function updateBatchStatus(
  client: SupabaseClient,
  batchId: string,
  status: "in_progress" | "completed" | "failed",
  coverage?: TeamGamePipelineCoverage
) {
  const payload: Record<string, unknown> = { status };
  if (status === "completed" || status === "failed") {
    payload.completed_at = new Date().toISOString();
    if (coverage) payload.report_json = coverage;
  }
  const { error } = await client.from("football_import_batches").update(payload).eq("id", batchId);
  if (error) throw new Error(`Failed to update team-games batch status: ${error.message}`);
}

export {
  buildTeamGameSemanticPayload,
  classifyTeamGameRows,
  computeExistingTeamGameSemanticHash,
  computePipelineStatus,
  computeTeamGameSemanticHash,
  emptyCoverage,
};
