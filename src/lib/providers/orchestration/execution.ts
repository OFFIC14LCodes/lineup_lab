import type { RepositoryWriteDependencies } from "@/lib/providers/orchestration/dependencies";
import type { DatasetIngestionPlan, IngestionExecutionResult, IngestionWriteOutcome, PlannedReadyRecord } from "@/lib/providers/orchestration/types";
import { ProviderRepositoryConflictError, ProviderRepositoryError } from "@/lib/providers/repositories/shared";

export type IngestionExecutionOptions = {
  failureMode?: "stop_on_first_error" | "continue";
};

export async function executeIngestionPlan(
  plan: DatasetIngestionPlan,
  dependencies: RepositoryWriteDependencies,
  options: IngestionExecutionOptions = {}
): Promise<IngestionExecutionResult> {
  if (plan.mappingRequired.length || plan.manualReview.length || plan.unresolved.length || plan.rejected.length) {
    throw new ProviderRepositoryError(
      "PLAN_NOT_EXECUTABLE",
      "Plan contains non-ready records. Execute only a fully ready plan or filter to ready records first."
    );
  }

  return executeReadyRecords(plan.ready, dependencies, options);
}

export async function executeReadyRecords(
  records: PlannedReadyRecord[],
  dependencies: RepositoryWriteDependencies,
  options: IngestionExecutionOptions = {}
): Promise<IngestionExecutionResult> {
  const failureMode = options.failureMode ?? "stop_on_first_error";
  const startedAt = new Date().toISOString();
  const outcomes: IngestionWriteOutcome[] = [];
  const warnings: string[] = [];

  for (const entry of records) {
    try {
      const outcome = await writePreparedRecord(entry, dependencies);
      outcomes.push(outcome);
    } catch (error) {
      const repositoryError = normalizeExecutionError(error);
      outcomes.push({
        sourceRecordId: entry.sourceRecordId ?? null,
        kind: entry.prepared.kind,
        playerId: entry.prepared.playerId,
        provider: entry.prepared.input.provider,
        status: "failed",
        rowId: null,
        error: {
          code: repositoryError.code,
          message: repositoryError.message
        }
      });

      if (repositoryError.code === "mapping_conflict" || failureMode === "stop_on_first_error") {
        warnings.push("Execution is non-transactional; earlier writes were not rolled back.");
        break;
      }
    }
  }

  const completedAt = new Date().toISOString();
  return {
    outcomes,
    summary: {
      total: outcomes.length,
      written: outcomes.filter((outcome) => outcome.status === "written").length,
      updated: outcomes.filter((outcome) => outcome.status === "updated").length,
      reused: outcomes.filter((outcome) => outcome.status === "reused").length,
      failed: outcomes.filter((outcome) => outcome.status === "failed").length
    },
    nonTransactional: true,
    startedAt,
    completedAt,
    warnings
  };
}

async function writePreparedRecord(entry: PlannedReadyRecord, dependencies: RepositoryWriteDependencies): Promise<IngestionWriteOutcome> {
  switch (entry.prepared.kind) {
    case "weekly_stats": {
      const row = await dependencies.upsertWeeklyStats(entry.prepared.input);
      return successOutcome(entry, row.id);
    }
    case "season_stats": {
      const row = await dependencies.upsertSeasonStats(entry.prepared.input);
      return successOutcome(entry, row.id);
    }
    case "projection": {
      const row = await dependencies.upsertProjection(entry.prepared.input);
      return successOutcome(entry, row.id);
    }
    case "injury": {
      const row =
        entry.prepared.executionMode === "replace_current"
          ? await dependencies.replaceCurrentInjuryObservation(entry.prepared.input)
          : await dependencies.addInjuryObservation(entry.prepared.input);
      return successOutcome(entry, row.id);
    }
  }
}

function successOutcome(entry: PlannedReadyRecord, rowId: string): IngestionWriteOutcome {
  return {
    sourceRecordId: entry.sourceRecordId ?? null,
    kind: entry.prepared.kind,
    playerId: entry.prepared.playerId,
    provider: entry.prepared.input.provider,
    status: "written",
    rowId,
    error: null
  };
}

function normalizeExecutionError(error: unknown) {
  if (error instanceof ProviderRepositoryConflictError || error instanceof ProviderRepositoryError) {
    const detailsCode =
      error.details && typeof error.details === "object" && "code" in error.details ? (error.details.code as string) : null;
    return detailsCode && detailsCode !== error.code
      ? new ProviderRepositoryError(detailsCode, error.message, error.details)
      : error;
  }

  return new ProviderRepositoryError("REPOSITORY_WRITE_FAILED", error instanceof Error ? error.message : "Repository write failed.");
}
