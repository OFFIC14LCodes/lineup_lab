import type { ProviderStatsJson } from "@/lib/providers/data-types";

export type AuditRecoverabilityStatus = "fully_recoverable" | "partially_recoverable" | "not_recoverable";

export type AuditRecoverabilityAssessment = {
  status: AuditRecoverabilityStatus;
  reasons: string[];
};

export type InferredRepairRow = {
  naturalKey: string;
  playerId: string;
  week: number;
  changedStatKeys: string[];
  inferredPreviousStats: ProviderStatsJson;
  replacementStats: ProviderStatsJson;
};

export type AuditFallbackRecord = {
  operation: "audit_recovery_fallback";
  repairScope: "nflverse_history_reprocess";
  season: number;
  sourceSha256: string;
  repairedRowCount: number;
  affectedCanonicalKeys: string[];
  previousRowLevelHashesAvailable: false;
  canonicalRowsValidatedUnchanged: boolean;
  recoverabilityStatus: Exclude<AuditRecoverabilityStatus, "fully_recoverable">;
  limitationReasons: string[];
  relatedBatchIds: string[];
  generatedAt: string;
};

export type AuditFallbackBatchRecord = {
  id: string;
  status: string;
  season: number;
  createdAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
  report: AuditFallbackRecord;
};

export type AuditRecoveryPlan = {
  strategy: "noop" | "row_level_recovery" | "batch_fallback" | "already_recovered";
  writesCanonicalRows: boolean;
  writesAuditRows: boolean;
  missingCorrectionEntries: number;
};

export type AuditRecoveryAssessment = AuditRecoveryPlan & {
  rowLevelCorrectionEntriesMissing: number;
  acceptedBatchFallbackPresent: boolean;
  auditRequirementSatisfied: boolean;
  existingFallbackAuditFound: boolean;
  existingFallbackBatchId: string | null;
  duplicateCompletedFallbacks: number;
  warnings: string[];
};

export type RepairBatchRecord = {
  id: string;
  season: number;
  status: string;
  createdAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
  reportJson: Record<string, unknown> | null;
};

export type ReconcileBatchMetadata = {
  reconciliationOperation: "repair_batch_reconciliation";
  reason: "interrupted_before_audit_completion";
  reconciledByFallbackBatchId: string;
  reconciledAt: string;
  canonicalRowsAlreadyRepaired: true;
  rowLevelAuditUnavailable: true;
};

export type ReconcileBatchDecision = {
  batchId: string;
  action: "reconcile" | "skip";
  reason:
    | "eligible"
    | "not_open"
    | "wrong_season"
    | "missing_fallback_linkage"
    | "created_after_fallback"
    | "recent_or_active"
    | "canonical_validation_failed";
};

export function buildLegacyStatsFromCurrentNormalized(stats: ProviderStatsJson): ProviderStatsJson {
  return Object.fromEntries(
    Object.entries(stats).filter(([key, value]) => {
      if (key === "fum_lost") return false;
      return !(typeof value === "number" && value === 0);
    })
  );
}

export function inferRepairedRows(rows: Array<{ naturalKey: string; playerId: string; week: number; stats: ProviderStatsJson }>) {
  const inferredRows: InferredRepairRow[] = [];

  for (const row of rows) {
    const inferredPreviousStats = buildLegacyStatsFromCurrentNormalized(row.stats);
    const changedStatKeys = diffStatKeys(inferredPreviousStats, row.stats);
    if (changedStatKeys.length === 0) {
      continue;
    }

    inferredRows.push({
      naturalKey: row.naturalKey,
      playerId: row.playerId,
      week: row.week,
      changedStatKeys,
      inferredPreviousStats,
      replacementStats: row.stats
    });
  }

  return {
    repairedRowCount: inferredRows.length,
    affectedCanonicalKeys: [...new Set(inferredRows.flatMap((row) => row.changedStatKeys))].sort(),
    inferredRows
  };
}

export function classifyAuditRecoverability(input: {
  canReconstructPriorCanonicalStatsJson: boolean;
  canReconstructTruePreviousRowHash: boolean;
  hasStoredChangedFieldsJson: boolean;
  hasBatchLinkedRowAudit: boolean;
}): AuditRecoverabilityAssessment {
  const reasons: string[] = [];

  if (!input.canReconstructPriorCanonicalStatsJson) {
    reasons.push("True prior canonical stats_json is unavailable.");
  }
  if (!input.canReconstructTruePreviousRowHash) {
    reasons.push("True previous row hashes were never stored and cannot be reconstructed with certainty.");
  }
  if (!input.hasStoredChangedFieldsJson) {
    reasons.push("No stored changed_fields_json exists for the failed repair.");
  }
  if (!input.hasBatchLinkedRowAudit) {
    reasons.push("No import_batch_id linkage exists on football_stat_corrections rows.");
  }

  if (
    input.canReconstructPriorCanonicalStatsJson &&
    input.canReconstructTruePreviousRowHash &&
    input.hasStoredChangedFieldsJson &&
    input.hasBatchLinkedRowAudit
  ) {
    return { status: "fully_recoverable", reasons: [] };
  }

  if (input.canReconstructPriorCanonicalStatsJson) {
    return { status: "partially_recoverable", reasons };
  }

  return { status: "not_recoverable", reasons };
}

export function buildAuditFallbackRecord(input: {
  season: number;
  sourceSha256: string;
  repairedRowCount: number;
  affectedCanonicalKeys: string[];
  recoverabilityStatus: Exclude<AuditRecoverabilityStatus, "fully_recoverable">;
  limitationReasons: string[];
  relatedBatchIds: string[];
  generatedAt?: string;
}): AuditFallbackRecord {
  return {
    operation: "audit_recovery_fallback",
    repairScope: "nflverse_history_reprocess",
    season: input.season,
    sourceSha256: input.sourceSha256,
    repairedRowCount: input.repairedRowCount,
    affectedCanonicalKeys: input.affectedCanonicalKeys,
    previousRowLevelHashesAvailable: false,
    canonicalRowsValidatedUnchanged: true,
    recoverabilityStatus: input.recoverabilityStatus,
    limitationReasons: input.limitationReasons,
    relatedBatchIds: input.relatedBatchIds,
    generatedAt: input.generatedAt ?? new Date().toISOString()
  };
}

export function planAuditRecovery(input: {
  repairedRowCount: number;
  existingCorrectionEntries: number;
  recoverabilityStatus: AuditRecoverabilityStatus;
}): AuditRecoveryPlan {
  const missingCorrectionEntries = Math.max(input.repairedRowCount - input.existingCorrectionEntries, 0);

  if (missingCorrectionEntries === 0) {
    return {
      strategy: "noop",
      writesCanonicalRows: false,
      writesAuditRows: false,
      missingCorrectionEntries: 0
    };
  }

  if (input.recoverabilityStatus === "fully_recoverable") {
    return {
      strategy: "row_level_recovery",
      writesCanonicalRows: false,
      writesAuditRows: true,
      missingCorrectionEntries
    };
  }

  return {
    strategy: "batch_fallback",
    writesCanonicalRows: false,
    writesAuditRows: true,
    missingCorrectionEntries
  };
}

export function shouldInsertFallbackBatch(existingFallbacks: AuditFallbackRecord[], candidate: AuditFallbackRecord) {
  return !existingFallbacks.some(
    (row) =>
      row.operation === candidate.operation &&
      row.season === candidate.season &&
      row.sourceSha256 === candidate.sourceSha256 &&
      row.repairedRowCount === candidate.repairedRowCount
  );
}

export function isAuditFallbackRecord(value: unknown): value is AuditFallbackRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record["operation"] === "audit_recovery_fallback" &&
    record["repairScope"] === "nflverse_history_reprocess" &&
    typeof record["season"] === "number" &&
    typeof record["sourceSha256"] === "string" &&
    typeof record["repairedRowCount"] === "number"
  );
}

export function findMatchingFallbackBatches(
  batches: RepairBatchRecord[],
  candidate: AuditFallbackRecord
): AuditFallbackBatchRecord[] {
  return batches
    .filter((batch) => batch.status === "completed" && batch.season === candidate.season && isAuditFallbackRecord(batch.reportJson))
    .map((batch) => ({
      id: batch.id,
      status: batch.status,
      season: batch.season,
      createdAt: batch.createdAt,
      startedAt: batch.startedAt,
      completedAt: batch.completedAt,
      updatedAt: batch.updatedAt,
      report: batch.reportJson as AuditFallbackRecord
    }))
    .filter(
      (batch) =>
        batch.report.operation === candidate.operation &&
        batch.report.repairScope === candidate.repairScope &&
        batch.report.season === candidate.season &&
        batch.report.sourceSha256 === candidate.sourceSha256 &&
        batch.report.repairedRowCount === candidate.repairedRowCount
    );
}

export function assessAuditRecovery(input: {
  repairedRowCount: number;
  existingCorrectionEntries: number;
  recoverabilityStatus: AuditRecoverabilityStatus;
  fallbackCandidate: AuditFallbackRecord;
  repairBatches: RepairBatchRecord[];
}): AuditRecoveryAssessment {
  const plan = planAuditRecovery({
    repairedRowCount: input.repairedRowCount,
    existingCorrectionEntries: input.existingCorrectionEntries,
    recoverabilityStatus: input.recoverabilityStatus
  });
  const matchingFallbacks = findMatchingFallbackBatches(input.repairBatches, input.fallbackCandidate);
  const warnings: string[] = [];

  if (matchingFallbacks.length > 1) {
    warnings.push(
      `Multiple completed fallback audits match season=${input.fallbackCandidate.season} sourceSha256=${input.fallbackCandidate.sourceSha256}. No additional fallback batch will be written.`
    );
  }

  if (matchingFallbacks.length === 1) {
    return {
      strategy: "already_recovered",
      writesCanonicalRows: false,
      writesAuditRows: false,
      missingCorrectionEntries: 0,
      rowLevelCorrectionEntriesMissing: Math.max(input.repairedRowCount - input.existingCorrectionEntries, 0),
      acceptedBatchFallbackPresent: true,
      auditRequirementSatisfied: true,
      existingFallbackAuditFound: true,
      existingFallbackBatchId: matchingFallbacks[0].id,
      duplicateCompletedFallbacks: 0,
      warnings
    };
  }

  if (matchingFallbacks.length > 1) {
    return {
      strategy: plan.strategy,
      writesCanonicalRows: false,
      writesAuditRows: false,
      missingCorrectionEntries: 0,
      rowLevelCorrectionEntriesMissing: Math.max(input.repairedRowCount - input.existingCorrectionEntries, 0),
      acceptedBatchFallbackPresent: true,
      auditRequirementSatisfied: true,
      existingFallbackAuditFound: false,
      existingFallbackBatchId: null,
      duplicateCompletedFallbacks: matchingFallbacks.length,
      warnings
    };
  }

  return {
    ...plan,
    rowLevelCorrectionEntriesMissing: Math.max(input.repairedRowCount - input.existingCorrectionEntries, 0),
    acceptedBatchFallbackPresent: false,
    auditRequirementSatisfied: plan.strategy === "noop",
    existingFallbackAuditFound: false,
    existingFallbackBatchId: null,
    duplicateCompletedFallbacks: 0,
    warnings
  };
}

export function buildReconcileBatchMetadata(input: {
  fallbackBatchId: string;
  reconciledAt?: string;
}): ReconcileBatchMetadata {
  return {
    reconciliationOperation: "repair_batch_reconciliation",
    reason: "interrupted_before_audit_completion",
    reconciledByFallbackBatchId: input.fallbackBatchId,
    reconciledAt: input.reconciledAt ?? new Date().toISOString(),
    canonicalRowsAlreadyRepaired: true,
    rowLevelAuditUnavailable: true
  };
}

export function selectRepairBatchesForReconciliation(input: {
  season: number;
  repairBatches: RepairBatchRecord[];
  fallbackBatch: AuditFallbackBatchRecord | null;
  canonicalRowsValid: boolean;
  now?: string;
  recentThresholdMs?: number;
}): ReconcileBatchDecision[] {
  if (!input.fallbackBatch) {
    return input.repairBatches.map((batch) => ({
      batchId: batch.id,
      action: "skip",
      reason: "missing_fallback_linkage"
    }));
  }

  const nowMs = Date.parse(input.now ?? new Date().toISOString());
  const recentThresholdMs = input.recentThresholdMs ?? 15 * 60 * 1000;
  const fallbackAnchorMs = Date.parse(input.fallbackBatch.completedAt ?? input.fallbackBatch.createdAt ?? input.now ?? new Date().toISOString());
  const relatedBatchIds = new Set(input.fallbackBatch.report.relatedBatchIds);

  return input.repairBatches.map((batch) => {
    if (batch.season !== input.season) {
      return { batchId: batch.id, action: "skip", reason: "wrong_season" };
    }
    if (batch.status !== "pending" && batch.status !== "in_progress") {
      return { batchId: batch.id, action: "skip", reason: "not_open" };
    }
    if (!relatedBatchIds.has(batch.id)) {
      return { batchId: batch.id, action: "skip", reason: "missing_fallback_linkage" };
    }

    const createdAtMs = Date.parse(batch.createdAt ?? "");
    if (!Number.isFinite(createdAtMs) || createdAtMs >= fallbackAnchorMs) {
      return { batchId: batch.id, action: "skip", reason: "created_after_fallback" };
    }

    const lastActivityMs = Date.parse(batch.updatedAt ?? batch.startedAt ?? batch.createdAt ?? "");
    if (Number.isFinite(lastActivityMs) && nowMs - lastActivityMs < recentThresholdMs) {
      return { batchId: batch.id, action: "skip", reason: "recent_or_active" };
    }

    if (!input.canonicalRowsValid) {
      return { batchId: batch.id, action: "skip", reason: "canonical_validation_failed" };
    }

    return { batchId: batch.id, action: "reconcile", reason: "eligible" };
  });
}

export function mergeReconciliationMetadata(
  reportJson: Record<string, unknown> | null | undefined,
  metadata: ReconcileBatchMetadata
) {
  return {
    ...(reportJson ?? {}),
    ...metadata
  };
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  input: {
    retries?: number;
    initialDelayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
    onRetry?: (error: unknown, attempt: number) => void;
    sleep?: (ms: number) => Promise<void>;
  } = {}
): Promise<T> {
  const retries = input.retries ?? 3;
  const initialDelayMs = input.initialDelayMs ?? 250;
  const shouldRetry = input.shouldRetry ?? isTransientSupabaseFailure;
  const sleep = input.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error)) {
        throw error;
      }
      attempt += 1;
      input.onRetry?.(error, attempt);
      await sleep(initialDelayMs * 2 ** (attempt - 1));
    }
  }
}

export function isTransientSupabaseFailure(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);

  return /fetch failed|429|502|503|504|timeout|temporar/i.test(message);
}

function diffStatKeys(previousStats: ProviderStatsJson, replacementStats: ProviderStatsJson) {
  const previous = toNumericMap(previousStats);
  const replacement = toNumericMap(replacementStats);

  return [...new Set([...Object.keys(previous), ...Object.keys(replacement)])]
    .filter((key) => (previous[key] ?? null) !== (replacement[key] ?? null))
    .sort();
}

function toNumericMap(stats: ProviderStatsJson) {
  return Object.fromEntries(
    Object.entries(stats)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]))
      .map(([key, value]) => [key, value])
  ) as Record<string, number>;
}
