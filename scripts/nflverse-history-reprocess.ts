#!/usr/bin/env tsx
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";

import { upsertWeeklyStats } from "../src/lib/providers/repositories/weekly-stats";
import {
  assessAuditRecovery,
  buildReconcileBatchMetadata,
  type AuditFallbackRecord,
  buildAuditFallbackRecord,
  classifyAuditRecoverability,
  type AuditFallbackBatchRecord,
  inferRepairedRows,
  isAuditFallbackRecord,
  mergeReconciliationMetadata,
  type RepairBatchRecord,
  selectRepairBatchesForReconciliation,
  withRetry
} from "../src/lib/providers/nflverse/audit-recovery";
import { downloadAndArchive } from "../src/lib/providers/nflverse/download";
import { resolveGsisIdsBatch } from "../src/lib/providers/nflverse/identity";
import { parseMode, parseReconcileBatches, parseRecoverAudit, parseSeason } from "../src/lib/providers/nflverse/import-cli-options";
import { buildRowSha256Input, normalizeNflverseRow } from "../src/lib/providers/nflverse/normalize";
import { classifyWeeklyRowCorrection, type ReprocessExpectedRow } from "../src/lib/providers/nflverse/reprocess";
import type { ProviderStatsJson } from "../src/lib/providers/data-types";
import { fetchAllPages } from "../src/lib/scoring/validation/live-validation-utils";

loadLocalEnv();

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!url || !serviceRoleKey) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const adminClient = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

type ExistingWeeklyRow = {
  id: string;
  player_id: string;
  provider_external_id: string | null;
  season: number;
  week: number;
  season_type: "regular";
  team: string | null;
  opponent: string | null;
  position_group: string | null;
  stats_json: ProviderStatsJson;
  provider_fantasy_points: number | null;
  source_updated_at: string | null;
  ingested_at: string;
  metadata_json: Record<string, unknown> | null;
};

type CorrectionRow = {
  id: string;
  player_id: string;
  provider: string;
  season: number;
  week: number;
  stat_key: string;
  original_value: number | null;
  corrected_value: number | null;
  correction_reason: string | null;
  corrected_by: string | null;
  applied_at: string | null;
  created_at: string;
};

type ImportBatchRow = {
  id: string;
  season: number;
  status: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string | null;
  report_json: Record<string, unknown> | null;
};

async function main() {
  const projectRoot = process.cwd();
  const season = parseSeason(process.argv, process.env);
  const mode = parseMode(process.argv, process.env);
  const recoverAudit = parseRecoverAudit(process.argv, process.env);
  const reconcileBatches = parseReconcileBatches(process.argv, process.env);

  const operationLabel = reconcileBatches ? "reconcile_batches" : recoverAudit ? "recover_audit" : mode;
  console.info(`\n=== nflverse Historical Reprocess — Season ${season} (${operationLabel}) ===\n`);

  const download = await downloadAndArchive(season, projectRoot);
  const parsed = Papa.parse<Record<string, string>>(readFileSync(download.filePath, "utf8"), {
    header: true,
    skipEmptyLines: true
  });

  const sourceRows: ReprocessExpectedRow[] = [];
  const sourceConflicts = new Map<string, ReprocessExpectedRow[]>();
  const normalizeErrors: Array<{ sourceRowNumber: number; reason: string }> = [];

  for (let i = 0; i < parsed.data.length; i += 1) {
    const raw = parsed.data[i];
    const result = normalizeNflverseRow(raw);
    if (!result.ok) {
      if (!result.reason.startsWith("Skipping non-regular") && !result.reason.startsWith("Unsupported position_group")) {
        normalizeErrors.push({ sourceRowNumber: i + 1, reason: result.reason });
      }
      continue;
    }

    sourceRows.push({
      playerId: "",
      gsisId: result.row.gsisId,
      season: result.row.season,
      week: result.row.week,
      seasonType: "regular",
      team: result.row.team || null,
      opponent: result.row.opponent || null,
      positionGroup: result.row.positionGroup,
      stats: result.row.stats,
      providerFantasyPoints: result.row.providerFantasyPoints,
      sourceRowNumber: i + 1,
      rowSha256: buildRowSha256Input(raw)
    });
  }

  const gsisMap = await resolveGsisIdsBatch(new Set(sourceRows.map((row) => row.gsisId)), adminClient);
  const resolvedRows: ReprocessExpectedRow[] = [];
  for (const row of sourceRows) {
    const playerId = gsisMap.get(row.gsisId);
    if (!playerId) continue;
    const resolved = { ...row, playerId };
    const naturalKey = `${playerId}|${row.week}`;
    const existing = sourceConflicts.get(naturalKey) ?? [];
    existing.push(resolved);
    sourceConflicts.set(naturalKey, existing);
  }

  const expectedByKey = new Map<string, ReprocessExpectedRow>();
  const conflicts = [...sourceConflicts.entries()].filter(([, rows]) => rows.length > 1);
  for (const [naturalKey, rows] of sourceConflicts) {
    if (rows.length === 1) {
      expectedByKey.set(naturalKey, rows[0]);
    }
  }

  const existingRows = await fetchAllPages(async (offset, limit) => {
    const { data, error } = await adminClient
      .from("player_weekly_stats")
      .select("id,player_id,provider_external_id,season,week,season_type,team,opponent,position_group,stats_json,provider_fantasy_points,source_updated_at,ingested_at,metadata_json")
      .eq("provider", "nflverse")
      .eq("season", season)
      .eq("season_type", "regular")
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to load existing weekly stats rows: ${error.message}`);
    return (data ?? []) as ExistingWeeklyRow[];
  });

  const existingByKey = new Map<string, ExistingWeeklyRow>(
    existingRows.map((row) => [`${row.player_id}|${row.week}`, row] as const)
  );

  const inferredRepair = inferRepairedRows(
    [...expectedByKey.entries()].map(([naturalKey, row]) => ({
      naturalKey,
      playerId: row.playerId,
      week: row.week,
      stats: row.stats
    }))
  );

  if (recoverAudit) {
    await runRecoverAudit({
      projectRoot,
      season,
      mode,
      download,
      expectedByKey,
      inferredRepair
    });
    return;
  }

  if (reconcileBatches) {
    await runReconcileBatches({
      projectRoot,
      season,
      mode,
      download,
      expectedByKey,
      existingByKey,
      inferredRepair
    });
    return;
  }

  let sourceId: string | null = null;
  let batchId: string | null = null;
  if (mode === "execute") {
    await preflightAuditDestination(season);
    sourceId = await upsertDataSource({
      season,
      sourceUrl: download.sourceUrl,
      filePath: download.filePath,
      sha256: download.sha256,
      rowCount: parsed.data.length
    });
    batchId = await createBatch(sourceId!, season, mode);
  }

  const unchangedRows: string[] = [];
  const zeroFieldEnrichmentRows: Array<{ naturalKey: string; statKeys: string[] }> = [];
  const correctionRows: Array<{ naturalKey: string; statKeys: string[]; fieldKeys: string[] }> = [];
  const missingRows: string[] = [];
  const errorRows: Array<{ naturalKey: string; error: string }> = [];

  const numericCorrections: Array<{
    playerId: string;
    week: number;
    statKey: string;
    originalValue: number | null;
    correctedValue: number | null;
    reason: string;
  }> = [];

  for (const [naturalKey, expected] of expectedByKey) {
    const existing = existingByKey.get(naturalKey) ?? null;
    const plan = classifyWeeklyRowCorrection(expected, existing);

    if (plan.classification === "unchanged") {
      unchangedRows.push(naturalKey);
      continue;
    }

    if (plan.classification === "zero_field_enrichment") {
      zeroFieldEnrichmentRows.push({ naturalKey, statKeys: plan.changedStatKeys });
    } else if (plan.classification === "correction") {
      correctionRows.push({ naturalKey, statKeys: plan.changedStatKeys, fieldKeys: plan.changedFieldKeys });
    } else if (plan.classification === "missing") {
      missingRows.push(naturalKey);
    }

    for (const correction of plan.numericCorrections) {
      numericCorrections.push({
        playerId: expected.playerId,
        week: expected.week,
        statKey: correction.statKey,
        originalValue: correction.originalValue,
        correctedValue: correction.correctedValue,
        reason:
          plan.classification === "zero_field_enrichment"
            ? "nflverse_zero_field_enrichment"
            : plan.classification === "missing"
              ? "nflverse_missing_row_rebuild"
              : "nflverse_row_correction"
      });
    }

    if (mode !== "execute") {
      continue;
    }

    try {
      await upsertWeeklyStats(
        {
          player_id: expected.playerId,
          provider: "nflverse",
          provider_external_id: expected.gsisId,
          season: expected.season,
          week: expected.week,
          season_type: expected.seasonType,
          team: expected.team,
          opponent: expected.opponent,
          position_group: expected.positionGroup,
          stats_json: expected.stats,
          provider_fantasy_points: expected.providerFantasyPoints,
          source_updated_at: existing?.source_updated_at ?? null,
          ingested_at: existing?.ingested_at,
          metadata_json: existing?.metadata_json ?? {}
        },
        { requireVerifiedMapping: false },
        adminClient
      );
    } catch (error) {
      errorRows.push({
        naturalKey,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const unexpectedExistingRows = existingRows
    .filter((row) => !expectedByKey.has(`${row.player_id}|${row.week}`))
    .map((row) => `${row.player_id}|${row.week}`);

  if (mode === "execute") {
    await insertCorrectionEntries(season, numericCorrections);
    await updateBatch(batchId!, {
      status: errorRows.length === 0 ? "completed" : "failed",
      report_json: {
        unchangedRows: unchangedRows.length,
        zeroFieldEnrichmentRows: zeroFieldEnrichmentRows.length,
        correctionRows: correctionRows.length,
        missingRows: missingRows.length,
        unexpectedExistingRows: unexpectedExistingRows.length,
        conflicts: conflicts.length,
        errors: errorRows.length
      }
    });
  }

  const sourceRecord = await findDataSourceRecord(season, download.sha256);
  const importBatches = await findImportBatches(season);
  const affectedCanonicalKeys = [...new Set([...zeroFieldEnrichmentRows, ...correctionRows].flatMap((row) => row.statKeys))].sort();

  const report = {
    generatedAt: new Date().toISOString(),
    season,
    mode,
    sourceUrl: download.sourceUrl,
    filePath: download.filePath,
    sourceSha256: download.sha256,
    sourceId: sourceId ?? sourceRecord?.id ?? null,
    batchId,
    sourceArtifactDownloadedAt: sourceRecord?.downloaded_at ?? null,
    importBatchIds: importBatches.map((batch) => batch.id),
    unchangedRows: unchangedRows.length,
    zeroFieldEnrichmentRows: zeroFieldEnrichmentRows.length,
    correctionRows: correctionRows.length,
    missingRows: missingRows.length,
    unexpectedExistingRows: unexpectedExistingRows.length,
    conflicts: conflicts.map(([naturalKey, rows]) => ({
      naturalKey,
      sourceRowNumbers: rows.map((row) => row.sourceRowNumber)
    })),
    errors: [...normalizeErrors.map((row) => ({ naturalKey: `source_row_${row.sourceRowNumber}`, error: row.reason })), ...errorRows],
    affectedCanonicalKeys,
    zeroFieldEnrichmentSamples: zeroFieldEnrichmentRows.slice(0, 20),
    correctionSamples: correctionRows.slice(0, 20),
    missingRowSamples: missingRows.slice(0, 20),
    unexpectedExistingSamples: unexpectedExistingRows.slice(0, 20)
  };

  const artifactDir = path.join(projectRoot, "data", "diagnostic");
  mkdirSync(artifactDir, { recursive: true });
  const artifactPath = path.join(artifactDir, `nflverse-reprocess-${season}-${mode}.json`);
  writeFileSync(artifactPath, JSON.stringify(report, null, 2), "utf8");

  console.info(JSON.stringify(report, null, 2));
  console.info(`\nArtifact written to ${artifactPath}`);

  if (mode !== "execute") {
    console.info(`\nDry-run only. Execute with:\n  npm run repair:nflverse-history -- --season=${season} --execute`);
  }
}

async function insertCorrectionEntries(
  season: number,
  corrections: Array<{
    playerId: string;
    week: number;
    statKey: string;
    originalValue: number | null;
    correctedValue: number | null;
    reason: string;
  }>
) {
  if (corrections.length === 0) return;

  const playerIds = [...new Set(corrections.map((row) => row.playerId))];
  const weeks = [...new Set(corrections.map((row) => row.week))];
  const data = await fetchExistingCorrectionRows(season, playerIds, weeks);

  const existingKeys = new Set(
    data.map(
      (row) =>
        `${row.player_id as string}|${row.week as number}|${row.stat_key as string}|${String(row.original_value)}|${String(row.corrected_value)}`
    )
  );

  const insertRows = corrections
    .filter(
      (row) =>
        !existingKeys.has(
          `${row.playerId}|${row.week}|${row.statKey}|${String(row.originalValue)}|${String(row.correctedValue)}`
        )
    )
    .map((row) => ({
      player_id: row.playerId,
      provider: "nflverse",
      season,
      week: row.week,
      stat_key: row.statKey,
      original_value: row.originalValue,
      corrected_value: row.correctedValue,
      correction_reason: row.reason,
      corrected_by: "nflverse-history-reprocess",
      applied_at: new Date().toISOString()
    }));

  if (insertRows.length === 0) return;
  for (const chunk of chunkArray(insertRows, 250)) {
    await withRetry(async () => {
      const { error: insertError } = await adminClient.from("football_stat_corrections").insert(chunk);
      if (insertError) throw new Error(`Failed to insert correction entries: ${insertError.message}`);
    });
  }
}

async function runRecoverAudit(input: {
  projectRoot: string;
  season: number;
  mode: "dry_run" | "execute";
  download: { sourceUrl: string; filePath: string; sha256: string };
  expectedByKey: Map<string, ReprocessExpectedRow>;
  inferredRepair: ReturnType<typeof inferRepairedRows>;
}) {
  const diagnosis = await diagnoseAuditState(input.season);
  const recoverability = classifyAuditRecoverability({
    canReconstructPriorCanonicalStatsJson: input.inferredRepair.repairedRowCount > 0,
    canReconstructTruePreviousRowHash: false,
    hasStoredChangedFieldsJson: false,
    hasBatchLinkedRowAudit: false
  });

  const fallbackRecord = buildAuditFallbackRecord({
    season: input.season,
    sourceSha256: input.download.sha256,
    repairedRowCount: input.inferredRepair.repairedRowCount,
    affectedCanonicalKeys: input.inferredRepair.affectedCanonicalKeys,
    recoverabilityStatus:
      recoverability.status === "fully_recoverable" ? "partially_recoverable" : recoverability.status,
    limitationReasons: recoverability.reasons,
    relatedBatchIds: diagnosis.openRepairBatchIds
  });
  const recoveryPlan = assessAuditRecovery({
    repairedRowCount: input.inferredRepair.repairedRowCount,
    existingCorrectionEntries: diagnosis.totalCorrections,
    recoverabilityStatus: recoverability.status,
    fallbackCandidate: fallbackRecord,
    repairBatches: diagnosis.repairBatches
  });

  let recoveryResult: "SUCCESS" | "PARTIAL FAILURE" | "FAILURE" = "SUCCESS";
  let batchId: string | null = null;
  let writeError: string | null = null;
  let executionMessage: string | null = null;

  if (input.mode === "execute") {
    if (recoveryPlan.strategy === "noop") {
      recoveryResult = "SUCCESS";
    } else if (recoveryPlan.strategy === "already_recovered") {
      recoveryResult = "SUCCESS";
      executionMessage = "ALREADY RECOVERED";
    } else if (recoveryPlan.duplicateCompletedFallbacks > 1) {
      recoveryResult = "PARTIAL FAILURE";
      executionMessage = "ALREADY RECOVERED";
      writeError = recoveryPlan.warnings[0] ?? "Multiple matching completed fallback audits exist. Manual review required.";
    } else if (recoverability.status === "fully_recoverable") {
      recoveryResult = "FAILURE";
      writeError = "Fully recoverable row-level audit mode is not implemented because current schema lacks the required stored hash fields.";
    } else {
      try {
        const sourceId = await upsertDataSource({
          season: input.season,
          sourceUrl: input.download.sourceUrl,
          filePath: input.download.filePath,
          sha256: input.download.sha256,
          rowCount: input.expectedByKey.size
        });
        batchId = await createBatch(sourceId, input.season, "execute");
        await updateBatch(batchId!, {
          status: "completed",
          report_json: fallbackRecord
        });
      } catch (error) {
        recoveryResult = "PARTIAL FAILURE";
        writeError = error instanceof Error ? error.message : String(error);
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    season: input.season,
    mode: input.mode,
    operation: "recover_audit",
    existingCorrectionEntryCount: diagnosis.totalCorrections,
    correctionRowsAssociatedWithFailedRun: diagnosis.failedRunCorrectionCount,
    distinctImportBatchIds: diagnosis.distinctImportBatchIds,
    earliestDetectedAt: diagnosis.earliestDetectedAt,
    latestDetectedAt: diagnosis.latestDetectedAt,
    duplicateCorrectionIdentities: diagnosis.duplicateCorrectionIdentities,
    expectedRepairedRowCount: input.inferredRepair.repairedRowCount,
    expectedAnyCorrectionExists: diagnosis.totalCorrections > 0,
    priorStateRecoverability: recoverability.status,
    recoverabilityReasons: recoverability.reasons,
    missingCorrectionEntries: recoveryPlan.missingCorrectionEntries,
    rowLevelCorrectionEntriesMissing: recoveryPlan.rowLevelCorrectionEntriesMissing,
    acceptedBatchFallbackPresent: recoveryPlan.acceptedBatchFallbackPresent,
    auditRequirementSatisfied: recoveryPlan.auditRequirementSatisfied,
    existingFallbackAuditFound: recoveryPlan.existingFallbackAuditFound,
    existingFallbackBatchId: recoveryPlan.existingFallbackBatchId,
    duplicateCompletedFallbacks: recoveryPlan.duplicateCompletedFallbacks,
    auditRecoveryRequired: !recoveryPlan.auditRequirementSatisfied,
    recoveryPlan,
    affectedCanonicalKeys: input.inferredRepair.affectedCanonicalKeys,
    fallbackAuditRecord: fallbackRecord,
    fallbackBatchId: batchId ?? recoveryPlan.existingFallbackBatchId,
    recoveryResult,
    executionMessage,
    writeError,
    warnings: recoveryPlan.warnings,
    openRepairBatchIds: diagnosis.openRepairBatchIds
  };

  const artifactDir = path.join(input.projectRoot, "data", "diagnostic");
  mkdirSync(artifactDir, { recursive: true });
  const artifactPath = path.join(artifactDir, `nflverse-recover-audit-${input.season}-${input.mode}.json`);
  writeFileSync(artifactPath, JSON.stringify(report, null, 2), "utf8");

  console.info(JSON.stringify(report, null, 2));
  if (executionMessage) {
    console.info(`\n${executionMessage}`);
  }
  console.info(`\nArtifact written to ${artifactPath}`);

  if (input.mode !== "execute") {
    console.info(`\nDry-run only. Execute with:\n  npm run repair:nflverse-history -- --season=${input.season} --recover-audit --execute`);
  }

  if (recoveryResult !== "SUCCESS") {
    process.exitCode = 1;
  }
}

async function runReconcileBatches(input: {
  projectRoot: string;
  season: number;
  mode: "dry_run" | "execute";
  download: { sourceUrl: string; filePath: string; sha256: string };
  expectedByKey: Map<string, ReprocessExpectedRow>;
  existingByKey: Map<string, ExistingWeeklyRow>;
  inferredRepair: ReturnType<typeof inferRepairedRows>;
}) {
  const diagnosis = await diagnoseAuditState(input.season);
  const fallbackRecord = buildAuditFallbackRecord({
    season: input.season,
    sourceSha256: input.download.sha256,
    repairedRowCount: input.inferredRepair.repairedRowCount,
    affectedCanonicalKeys: input.inferredRepair.affectedCanonicalKeys,
    recoverabilityStatus: "partially_recoverable",
    limitationReasons: [
      "True previous row hashes were never stored and cannot be reconstructed with certainty.",
      "No stored changed_fields_json exists for the failed repair.",
      "No import_batch_id linkage exists on football_stat_corrections rows."
    ],
    relatedBatchIds: diagnosis.openRepairBatchIds
  });
  const auditAssessment = assessAuditRecovery({
    repairedRowCount: input.inferredRepair.repairedRowCount,
    existingCorrectionEntries: diagnosis.totalCorrections,
    recoverabilityStatus: "partially_recoverable",
    fallbackCandidate: fallbackRecord,
    repairBatches: diagnosis.repairBatches
  });
  const fallbackBatch = auditAssessment.existingFallbackBatchId
    ? diagnosis.completedFallbackBatches.find((batch) => batch.id === auditAssessment.existingFallbackBatchId) ?? null
    : null;
  const canonicalValidation = validateCanonicalRepairState(input.expectedByKey, input.existingByKey, input.inferredRepair);
  const decisions = selectRepairBatchesForReconciliation({
    season: input.season,
    repairBatches: diagnosis.repairBatches,
    fallbackBatch,
    canonicalRowsValid: canonicalValidation.valid
  });
  const selectedBatchIds = decisions.filter((decision) => decision.action === "reconcile").map((decision) => decision.batchId);
  const terminalStatus = "failed";
  const reconciledAt = new Date().toISOString();
  const metadata = fallbackBatch
    ? buildReconcileBatchMetadata({
        fallbackBatchId: fallbackBatch.id,
        reconciledAt
      })
    : null;

  let reconciledCount = 0;
  let writeError: string | null = null;
  let result: "SUCCESS" | "PARTIAL FAILURE" | "FAILURE" = "SUCCESS";

  if (input.mode === "execute") {
    if (!auditAssessment.auditRequirementSatisfied || !fallbackBatch || !metadata) {
      result = "FAILURE";
      writeError = "A completed fallback audit is required before stale repair batches can be reconciled.";
    } else {
      for (const batchId of selectedBatchIds) {
        const batch = diagnosis.repairBatches.find((row) => row.id === batchId);
        if (!batch) continue;

        try {
          await updateBatch(batchId, {
            status: terminalStatus,
            report_json: mergeReconciliationMetadata(batch.reportJson, metadata)
          });
          reconciledCount += 1;
        } catch (error) {
          result = reconciledCount > 0 ? "PARTIAL FAILURE" : "FAILURE";
          writeError = error instanceof Error ? error.message : String(error);
          break;
        }
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    season: input.season,
    mode: input.mode,
    operation: "reconcile_repair_batches",
    existingFallbackDetectionResult: {
      existingFallbackAuditFound: auditAssessment.existingFallbackAuditFound,
      existingFallbackBatchId: auditAssessment.existingFallbackBatchId,
      acceptedBatchFallbackPresent: auditAssessment.acceptedBatchFallbackPresent,
      auditRequirementSatisfied: auditAssessment.auditRequirementSatisfied,
      warnings: auditAssessment.warnings
    },
    staleBatchCountSelected: selectedBatchIds.length,
    selectedBatchIds,
    proposedTerminalStatus: terminalStatus,
    canonicalValidation,
    reconciliationMetadata: metadata,
    decisions,
    reconciledCount,
    result,
    writeError
  };

  const artifactDir = path.join(input.projectRoot, "data", "diagnostic");
  mkdirSync(artifactDir, { recursive: true });
  const artifactPath = path.join(artifactDir, `nflverse-reconcile-batches-${input.season}-${input.mode}.json`);
  writeFileSync(artifactPath, JSON.stringify(report, null, 2), "utf8");

  console.info(JSON.stringify(report, null, 2));
  console.info(`\nArtifact written to ${artifactPath}`);

  if (input.mode !== "execute") {
    console.info(`\nDry-run only. Execute with:\n  npm run reconcile:nflverse-repair-batches -- --season=${input.season} --execute`);
  }

  if (result !== "SUCCESS") {
    process.exitCode = 1;
  }
}

async function diagnoseAuditState(season: number) {
  const corrections = await fetchAllPages(async (offset, limit) => {
    return withRetry(async () => {
      const { data, error } = await adminClient
        .from("football_stat_corrections")
        .select("id,player_id,provider,season,week,stat_key,original_value,corrected_value,correction_reason,corrected_by,applied_at,created_at")
        .eq("provider", "nflverse")
        .eq("season", season)
        .order("created_at", { ascending: true })
        .range(offset, offset + limit - 1);
      if (error) throw new Error(`Failed to load correction rows: ${error.message}`);
      return (data ?? []) as CorrectionRow[];
    });
  });

  const duplicateCorrectionIdentities = [...groupByIdentity(corrections).entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([identity, rows]) => ({ identity, count: rows.length }));

  const repairBatches = await withRetry(async () => {
    const { data, error } = await adminClient
      .from("football_import_batches")
      .select("id,season,status,created_at,started_at,completed_at,updated_at,report_json")
      .eq("season", season)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(`Failed to load repair batches: ${error.message}`);
    return (data ?? []) as ImportBatchRow[];
  });

  const openRepairBatchIds = repairBatches
    .filter((batch) => batch.status === "in_progress" || batch.status === "failed" || batch.status === "pending")
    .map((batch) => batch.id);
  const normalizedBatches: RepairBatchRecord[] = repairBatches.map((batch) => ({
    id: batch.id,
    season: batch.season,
    status: batch.status,
    createdAt: batch.created_at,
    startedAt: batch.started_at,
    completedAt: batch.completed_at,
    updatedAt: batch.updated_at,
    reportJson: batch.report_json
  }));
  const completedFallbackBatches = normalizedBatches
    .filter((batch) => batch.status === "completed" && isAuditFallbackRecord(batch.reportJson))
    .map((batch) => ({
      id: batch.id,
      status: batch.status,
      season: batch.season,
      createdAt: batch.createdAt,
      startedAt: batch.startedAt,
      completedAt: batch.completedAt,
      updatedAt: batch.updatedAt,
      report: batch.reportJson as AuditFallbackRecord
    }));

  return {
    totalCorrections: corrections.length,
    failedRunCorrectionCount: 0,
    distinctImportBatchIds: [] as string[],
    earliestDetectedAt: corrections[0]?.applied_at ?? corrections[0]?.created_at ?? null,
    latestDetectedAt: corrections[corrections.length - 1]?.applied_at ?? corrections[corrections.length - 1]?.created_at ?? null,
    duplicateCorrectionIdentities,
    openRepairBatchIds,
    repairBatches: normalizedBatches,
    completedFallbackBatches
  };
}

async function fetchExistingCorrectionRows(season: number, playerIds: string[], weeks: number[]) {
  const rows: CorrectionRow[] = [];
  for (const playerChunk of chunkArray(playerIds, 250)) {
    for (const weekChunk of chunkArray(weeks, 25)) {
      const chunkRows = await withRetry(async () => {
        const { data, error } = await adminClient
          .from("football_stat_corrections")
          .select("id,player_id,provider,season,week,stat_key,original_value,corrected_value,correction_reason,corrected_by,applied_at,created_at")
          .eq("provider", "nflverse")
          .eq("season", season)
          .in("player_id", playerChunk)
          .in("week", weekChunk);
        if (error) throw new Error(`Failed to load existing correction entries: ${error.message}`);
        return (data ?? []) as CorrectionRow[];
      });
      rows.push(...chunkRows);
    }
  }
  return rows;
}

async function preflightAuditDestination(season: number) {
  await withRetry(async () => {
    const { error } = await adminClient
      .from("football_stat_corrections")
      .select("id")
      .eq("provider", "nflverse")
      .eq("season", season)
      .limit(1);
    if (error) throw new Error(`Audit destination preflight failed: ${error.message}`);
  });
}

async function findDataSourceRecord(season: number, sha256: string) {
  return withRetry(async () => {
    const { data, error } = await adminClient
      .from("football_data_sources")
      .select("id,downloaded_at")
      .eq("provider", "nflverse")
      .eq("source_type", "weekly_stats")
      .eq("season", season)
      .eq("sha256", sha256)
      .maybeSingle();

    if (error) throw new Error(`Failed to load football_data_sources record: ${error.message}`);
    return data;
  });
}

async function findImportBatches(season: number) {
  return withRetry(async () => {
    const { data, error } = await adminClient
      .from("football_import_batches")
      .select("id")
      .eq("season", season)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(`Failed to load football_import_batches: ${error.message}`);
    return (data ?? []) as Array<{ id: string }>;
  });
}

async function upsertDataSource(input: {
  season: number;
  sourceUrl: string;
  filePath: string;
  sha256: string;
  rowCount: number;
}) {
  const existing = await findDataSourceRecord(input.season, input.sha256);
  if (existing) {
    return existing.id;
  }

  return withRetry(async () => {
    const { data, error } = await adminClient
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

    if (error) throw new Error(`Failed to create data source record: ${error.message}`);
    return data.id;
  });
}

async function createBatch(sourceId: string, season: number, mode: "dry_run" | "execute") {
  return withRetry(async () => {
    const { data, error } = await adminClient
      .from("football_import_batches")
      .insert({
        source_id: sourceId,
        season,
        mode,
        status: "in_progress",
        started_at: new Date().toISOString(),
        report_json: {}
      })
      .select("id")
      .single();

    if (error) throw new Error(`Failed to create correction batch: ${error.message}`);
    return data.id;
  });
}

async function updateBatch(batchId: string, payload: { status: "completed" | "failed"; report_json: Record<string, unknown> }) {
  await withRetry(async () => {
    const { error } = await adminClient
      .from("football_import_batches")
      .update({
        status: payload.status,
        report_json: payload.report_json,
        completed_at: new Date().toISOString()
      })
      .eq("id", batchId);
    if (error) throw new Error(`Failed to update correction batch: ${error.message}`);
  });
}

function validateCanonicalRepairState(
  expectedByKey: Map<string, ReprocessExpectedRow>,
  existingByKey: Map<string, ExistingWeeklyRow>,
  inferredRepair: ReturnType<typeof inferRepairedRows>
) {
  const mismatchedRows: string[] = [];

  for (const row of inferredRepair.inferredRows) {
    const expected = expectedByKey.get(row.naturalKey);
    const existing = existingByKey.get(row.naturalKey);
    if (!expected || !existing) {
      mismatchedRows.push(row.naturalKey);
      continue;
    }

    const normalizedExistingStats = stableJson(existing.stats_json);
    const normalizedExpectedStats = stableJson(expected.stats);
    if (
      normalizedExistingStats !== normalizedExpectedStats ||
      (existing.provider_fantasy_points ?? null) !== (expected.providerFantasyPoints ?? null)
    ) {
      mismatchedRows.push(row.naturalKey);
    }
  }

  return {
    valid: mismatchedRows.length === 0,
    checkedRowCount: inferredRepair.inferredRows.length,
    mismatchedRowCount: mismatchedRows.length,
    mismatchedRowSamples: mismatchedRows.slice(0, 20)
  };
}

function chunkArray<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function groupByIdentity(rows: CorrectionRow[]) {
  const grouped = new Map<string, CorrectionRow[]>();
  for (const row of rows) {
    const identity = [
      row.player_id,
      row.week,
      row.stat_key,
      String(row.original_value),
      String(row.corrected_value),
      row.correction_reason ?? ""
    ].join("|");
    const current = grouped.get(identity) ?? [];
    current.push(row);
    grouped.set(identity, current);
  }
  return grouped;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const contents = readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) continue;
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
