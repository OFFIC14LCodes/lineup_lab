import { describe, expect, it, vi } from "vitest";

import {
  assessAuditRecovery,
  buildAuditFallbackRecord,
  buildReconcileBatchMetadata,
  buildLegacyStatsFromCurrentNormalized,
  classifyAuditRecoverability,
  findMatchingFallbackBatches,
  inferRepairedRows,
  isTransientSupabaseFailure,
  mergeReconciliationMetadata,
  planAuditRecovery,
  selectRepairBatchesForReconciliation,
  shouldInsertFallbackBatch,
  withRetry
} from "@/lib/providers/nflverse/audit-recovery";

describe("buildLegacyStatsFromCurrentNormalized", () => {
  it("reconstructs the legacy zero-eliding representation", () => {
    expect(
      buildLegacyStatsFromCurrentNormalized({
        pass_cmp: 20,
        pass_2pt: 0,
        rush_td: 0,
        fum_lost: 1
      })
    ).toEqual({
      pass_cmp: 20
    });
  });
});

describe("inferRepairedRows", () => {
  it("infers repaired rows and affected canonical keys from current normalized rows", () => {
    const result = inferRepairedRows([
      {
        naturalKey: "player-1|1",
        playerId: "player-1",
        week: 1,
        stats: {
          pass_cmp: 20,
          pass_2pt: 0,
          fum_lost: 0
        }
      }
    ]);

    expect(result.repairedRowCount).toBe(1);
    expect(result.affectedCanonicalKeys).toEqual(["fum_lost", "pass_2pt"]);
  });
});

describe("classifyAuditRecoverability", () => {
  it("marks partially recoverable when prior stats can be reconstructed but true hashes cannot", () => {
    expect(
      classifyAuditRecoverability({
        canReconstructPriorCanonicalStatsJson: true,
        canReconstructTruePreviousRowHash: false,
        hasStoredChangedFieldsJson: false,
        hasBatchLinkedRowAudit: false
      }).status
    ).toBe("partially_recoverable");
  });

  it("blocks fabricated row-level recovery when prior state is unavailable", () => {
    expect(
      classifyAuditRecoverability({
        canReconstructPriorCanonicalStatsJson: false,
        canReconstructTruePreviousRowHash: false,
        hasStoredChangedFieldsJson: false,
        hasBatchLinkedRowAudit: false
      }).status
    ).toBe("not_recoverable");
  });
});

describe("planAuditRecovery", () => {
  it("treats repaired canonical rows with missing audit entries as a recovery gap", () => {
    const plan = planAuditRecovery({
      repairedRowCount: 5877,
      existingCorrectionEntries: 0,
      recoverabilityStatus: "partially_recoverable"
    });

    expect(plan.missingCorrectionEntries).toBe(5877);
    expect(plan.strategy).toBe("batch_fallback");
    expect(plan.writesAuditRows).toBe(true);
  });

  it("uses audit-only recovery with no canonical writes", () => {
    const plan = planAuditRecovery({
      repairedRowCount: 10,
      existingCorrectionEntries: 0,
      recoverabilityStatus: "fully_recoverable"
    });

    expect(plan.strategy).toBe("row_level_recovery");
    expect(plan.writesCanonicalRows).toBe(false);
    expect(plan.writesAuditRows).toBe(true);
  });

  it("skips recovery when existing audit coverage is complete", () => {
    const plan = planAuditRecovery({
      repairedRowCount: 10,
      existingCorrectionEntries: 10,
      recoverabilityStatus: "fully_recoverable"
    });

    expect(plan.strategy).toBe("noop");
    expect(plan.writesAuditRows).toBe(false);
  });

  it("supports partial audit recovery resume planning", () => {
    const plan = planAuditRecovery({
      repairedRowCount: 10,
      existingCorrectionEntries: 4,
      recoverabilityStatus: "fully_recoverable"
    });

    expect(plan.missingCorrectionEntries).toBe(6);
    expect(plan.strategy).toBe("row_level_recovery");
  });
});

describe("assessAuditRecovery", () => {
  const candidate = buildAuditFallbackRecord({
    season: 2025,
    sourceSha256: "sha-2025",
    repairedRowCount: 5877,
    affectedCanonicalKeys: ["fum_lost"],
    recoverabilityStatus: "partially_recoverable",
    limitationReasons: ["Hashes unavailable"],
    relatedBatchIds: ["stale-1", "stale-2"]
  });

  it("detects an existing matching fallback and short-circuits to already_recovered", () => {
    const assessment = assessAuditRecovery({
      repairedRowCount: 5877,
      existingCorrectionEntries: 0,
      recoverabilityStatus: "partially_recoverable",
      fallbackCandidate: candidate,
      repairBatches: [
        {
          id: "fallback-1",
          season: 2025,
          status: "completed",
          createdAt: "2026-06-12T00:00:00.000Z",
          startedAt: "2026-06-12T00:00:00.000Z",
          completedAt: "2026-06-12T00:01:00.000Z",
          updatedAt: "2026-06-12T00:01:00.000Z",
          reportJson: candidate
        }
      ]
    });

    expect(assessment.strategy).toBe("already_recovered");
    expect(assessment.existingFallbackAuditFound).toBe(true);
    expect(assessment.existingFallbackBatchId).toBe("fallback-1");
    expect(assessment.auditRequirementSatisfied).toBe(true);
    expect(assessment.acceptedBatchFallbackPresent).toBe(true);
    expect(assessment.rowLevelCorrectionEntriesMissing).toBe(5877);
    expect(assessment.writesAuditRows).toBe(false);
  });

  it("does not treat a different source hash as recovered", () => {
    const assessment = assessAuditRecovery({
      repairedRowCount: 5877,
      existingCorrectionEntries: 0,
      recoverabilityStatus: "partially_recoverable",
      fallbackCandidate: candidate,
      repairBatches: [
        {
          id: "fallback-1",
          season: 2025,
          status: "completed",
          createdAt: "2026-06-12T00:00:00.000Z",
          startedAt: "2026-06-12T00:00:00.000Z",
          completedAt: "2026-06-12T00:01:00.000Z",
          updatedAt: "2026-06-12T00:01:00.000Z",
          reportJson: { ...candidate, sourceSha256: "other-sha" }
        }
      ]
    });

    expect(assessment.strategy).toBe("batch_fallback");
    expect(assessment.acceptedBatchFallbackPresent).toBe(false);
  });

  it("does not treat a wrong season fallback as recovered", () => {
    const assessment = assessAuditRecovery({
      repairedRowCount: 5877,
      existingCorrectionEntries: 0,
      recoverabilityStatus: "partially_recoverable",
      fallbackCandidate: candidate,
      repairBatches: [
        {
          id: "fallback-1",
          season: 2024,
          status: "completed",
          createdAt: "2026-06-12T00:00:00.000Z",
          startedAt: "2026-06-12T00:00:00.000Z",
          completedAt: "2026-06-12T00:01:00.000Z",
          updatedAt: "2026-06-12T00:01:00.000Z",
          reportJson: { ...candidate, season: 2024 }
        }
      ]
    });

    expect(assessment.strategy).toBe("batch_fallback");
    expect(assessment.acceptedBatchFallbackPresent).toBe(false);
  });

  it("does not accept incomplete fallback batches", () => {
    const assessment = assessAuditRecovery({
      repairedRowCount: 5877,
      existingCorrectionEntries: 0,
      recoverabilityStatus: "partially_recoverable",
      fallbackCandidate: candidate,
      repairBatches: [
        {
          id: "fallback-1",
          season: 2025,
          status: "in_progress",
          createdAt: "2026-06-12T00:00:00.000Z",
          startedAt: "2026-06-12T00:00:00.000Z",
          completedAt: null,
          updatedAt: "2026-06-12T00:00:30.000Z",
          reportJson: candidate
        }
      ]
    });

    expect(assessment.strategy).toBe("batch_fallback");
    expect(assessment.acceptedBatchFallbackPresent).toBe(false);
  });

  it("warns on duplicate completed fallbacks and disables new writes", () => {
    const assessment = assessAuditRecovery({
      repairedRowCount: 5877,
      existingCorrectionEntries: 0,
      recoverabilityStatus: "partially_recoverable",
      fallbackCandidate: candidate,
      repairBatches: [
        {
          id: "fallback-1",
          season: 2025,
          status: "completed",
          createdAt: "2026-06-12T00:00:00.000Z",
          startedAt: "2026-06-12T00:00:00.000Z",
          completedAt: "2026-06-12T00:01:00.000Z",
          updatedAt: "2026-06-12T00:01:00.000Z",
          reportJson: candidate
        },
        {
          id: "fallback-2",
          season: 2025,
          status: "completed",
          createdAt: "2026-06-12T00:02:00.000Z",
          startedAt: "2026-06-12T00:02:00.000Z",
          completedAt: "2026-06-12T00:03:00.000Z",
          updatedAt: "2026-06-12T00:03:00.000Z",
          reportJson: candidate
        }
      ]
    });

    expect(assessment.acceptedBatchFallbackPresent).toBe(true);
    expect(assessment.auditRequirementSatisfied).toBe(true);
    expect(assessment.duplicateCompletedFallbacks).toBe(2);
    expect(assessment.writesAuditRows).toBe(false);
    expect(assessment.warnings).toHaveLength(1);
  });
});

describe("findMatchingFallbackBatches", () => {
  it("returns only exact completed matches", () => {
    const candidate = buildAuditFallbackRecord({
      season: 2025,
      sourceSha256: "sha",
      repairedRowCount: 5877,
      affectedCanonicalKeys: [],
      recoverabilityStatus: "partially_recoverable",
      limitationReasons: [],
      relatedBatchIds: []
    });

    const matches = findMatchingFallbackBatches(
      [
        {
          id: "match",
          season: 2025,
          status: "completed",
          createdAt: null,
          startedAt: null,
          completedAt: null,
          updatedAt: null,
          reportJson: candidate
        },
        {
          id: "non-match",
          season: 2025,
          status: "completed",
          createdAt: null,
          startedAt: null,
          completedAt: null,
          updatedAt: null,
          reportJson: { ...candidate, sourceSha256: "different" }
        }
      ],
      candidate
    );

    expect(matches.map((row) => row.id)).toEqual(["match"]);
  });
});

describe("withRetry", () => {
  it("retries transient lookup failures and succeeds", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce("ok");

    await expect(withRetry(operation, { sleep: async () => undefined })).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("retries transient insert failures until exhausted", async () => {
    const operation = vi.fn<() => Promise<string>>().mockRejectedValue(new Error("503 upstream"));

    await expect(withRetry(operation, { retries: 2, sleep: async () => undefined })).rejects.toThrow("503 upstream");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("does not retry deterministic constraint failures", async () => {
    const operation = vi.fn<() => Promise<string>>().mockRejectedValue(new Error("duplicate key value violates unique constraint"));

    await expect(withRetry(operation, { sleep: async () => undefined })).rejects.toThrow("duplicate key value");
    expect(operation).toHaveBeenCalledTimes(1);
  });
});

describe("isTransientSupabaseFailure", () => {
  it("recognizes transient network and gateway failures", () => {
    expect(isTransientSupabaseFailure(new Error("fetch failed"))).toBe(true);
    expect(isTransientSupabaseFailure(new Error("503 bad gateway"))).toBe(true);
    expect(isTransientSupabaseFailure(new Error("duplicate key value"))).toBe(false);
  });
});

describe("buildAuditFallbackRecord", () => {
  it("builds a batch-level fallback audit payload", () => {
    const record = buildAuditFallbackRecord({
      season: 2025,
      sourceSha256: "sha",
      repairedRowCount: 5877,
      affectedCanonicalKeys: ["fum_lost", "pass_2pt"],
      recoverabilityStatus: "partially_recoverable",
      limitationReasons: ["True previous row hashes were never stored."],
      relatedBatchIds: ["batch-1"]
    });

    expect(record.repairedRowCount).toBe(5877);
    expect(record.previousRowLevelHashesAvailable).toBe(false);
    expect(record.operation).toBe("audit_recovery_fallback");
  });

  it("is idempotent for repeated recovery attempts", () => {
    const record = buildAuditFallbackRecord({
      season: 2025,
      sourceSha256: "sha",
      repairedRowCount: 5877,
      affectedCanonicalKeys: ["fum_lost"],
      recoverabilityStatus: "partially_recoverable",
      limitationReasons: ["Hashes unavailable"],
      relatedBatchIds: ["batch-1"]
    });

    expect(shouldInsertFallbackBatch([record], record)).toBe(false);
  });
});

describe("repair batch reconciliation", () => {
  const fallbackRecord = buildAuditFallbackRecord({
    season: 2025,
    sourceSha256: "sha",
    repairedRowCount: 5877,
    affectedCanonicalKeys: ["fum_lost"],
    recoverabilityStatus: "partially_recoverable",
    limitationReasons: ["Hashes unavailable"],
    relatedBatchIds: ["stale-1", "stale-2", "stale-3"]
  });

  const fallbackBatch = {
    id: "fallback-batch",
    status: "completed",
    season: 2025,
    createdAt: "2026-06-12T01:00:00.000Z",
    startedAt: "2026-06-12T01:00:00.000Z",
    completedAt: "2026-06-12T01:01:00.000Z",
    updatedAt: "2026-06-12T01:01:00.000Z",
    report: fallbackRecord
  } as const;

  it("selects only matching stale open batches", () => {
    const decisions = selectRepairBatchesForReconciliation({
      season: 2025,
      fallbackBatch,
      canonicalRowsValid: true,
      now: "2026-06-12T02:00:00.000Z",
      repairBatches: [
        {
          id: "stale-1",
          season: 2025,
          status: "in_progress",
          createdAt: "2026-06-12T00:00:00.000Z",
          startedAt: "2026-06-12T00:00:00.000Z",
          completedAt: null,
          updatedAt: "2026-06-12T00:10:00.000Z",
          reportJson: {}
        },
        {
          id: "other",
          season: 2025,
          status: "in_progress",
          createdAt: "2026-06-12T00:00:00.000Z",
          startedAt: "2026-06-12T00:00:00.000Z",
          completedAt: null,
          updatedAt: "2026-06-12T00:10:00.000Z",
          reportJson: {}
        }
      ]
    });

    expect(decisions).toEqual([
      { batchId: "stale-1", action: "reconcile", reason: "eligible" },
      { batchId: "other", action: "skip", reason: "missing_fallback_linkage" }
    ]);
  });

  it("does not reconcile active or recent batches", () => {
    const decisions = selectRepairBatchesForReconciliation({
      season: 2025,
      fallbackBatch,
      canonicalRowsValid: true,
      now: "2026-06-12T01:05:00.000Z",
      repairBatches: [
        {
          id: "stale-1",
          season: 2025,
          status: "in_progress",
          createdAt: "2026-06-12T00:00:00.000Z",
          startedAt: "2026-06-12T00:00:00.000Z",
          completedAt: null,
          updatedAt: "2026-06-12T01:00:30.000Z",
          reportJson: {}
        }
      ]
    });

    expect(decisions[0]).toEqual({ batchId: "stale-1", action: "skip", reason: "recent_or_active" });
  });

  it("never modifies completed batches", () => {
    const decisions = selectRepairBatchesForReconciliation({
      season: 2025,
      fallbackBatch,
      canonicalRowsValid: true,
      now: "2026-06-12T02:00:00.000Z",
      repairBatches: [
        {
          id: "stale-1",
          season: 2025,
          status: "completed",
          createdAt: "2026-06-12T00:00:00.000Z",
          startedAt: "2026-06-12T00:00:00.000Z",
          completedAt: "2026-06-12T00:05:00.000Z",
          updatedAt: "2026-06-12T00:05:00.000Z",
          reportJson: {}
        }
      ]
    });

    expect(decisions[0]).toEqual({ batchId: "stale-1", action: "skip", reason: "not_open" });
  });

  it("requires canonical validation to pass", () => {
    const decisions = selectRepairBatchesForReconciliation({
      season: 2025,
      fallbackBatch,
      canonicalRowsValid: false,
      now: "2026-06-12T02:00:00.000Z",
      repairBatches: [
        {
          id: "stale-1",
          season: 2025,
          status: "in_progress",
          createdAt: "2026-06-12T00:00:00.000Z",
          startedAt: "2026-06-12T00:00:00.000Z",
          completedAt: null,
          updatedAt: "2026-06-12T00:10:00.000Z",
          reportJson: {}
        }
      ]
    });

    expect(decisions[0]).toEqual({ batchId: "stale-1", action: "skip", reason: "canonical_validation_failed" });
  });

  it("builds deterministic reconciliation metadata", () => {
    const metadata = buildReconcileBatchMetadata({
      fallbackBatchId: "fallback-batch",
      reconciledAt: "2026-06-12T03:00:00.000Z"
    });

    expect(metadata).toEqual({
      reconciliationOperation: "repair_batch_reconciliation",
      reason: "interrupted_before_audit_completion",
      reconciledByFallbackBatchId: "fallback-batch",
      reconciledAt: "2026-06-12T03:00:00.000Z",
      canonicalRowsAlreadyRepaired: true,
      rowLevelAuditUnavailable: true
    });
    expect(mergeReconciliationMetadata({ existing: true }, metadata)).toEqual({
      existing: true,
      ...metadata
    });
  });
});
