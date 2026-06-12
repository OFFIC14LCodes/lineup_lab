import {
  prepareInjuryCanonicalInput,
  prepareProjectionCanonicalInput,
  prepareSeasonStatsCanonicalInput,
  prepareWeeklyStatsCanonicalInput
} from "@/lib/providers/adapters/normalize";
import type {
  AdapterNormalizationIssue,
  AdapterSourceRecord,
  IngestionPlan,
  IdentityResolutionResult,
  PreparedCanonicalRecord,
  RejectedAdapterRecord,
  UnresolvedAdapterRecord
} from "@/lib/providers/adapters/types";

export type PlannedRecordInput = {
  record: AdapterSourceRecord;
  identity: IdentityResolutionResult;
  sourceIndex?: number;
};

export function createIngestionPlan(
  inputs: PlannedRecordInput[],
  warnings: AdapterNormalizationIssue[] = [],
  rejected: RejectedAdapterRecord[] = []
): IngestionPlan {
  const ready: PreparedCanonicalRecord[] = [];
  const unresolved: UnresolvedAdapterRecord[] = [];
  const manualReview: UnresolvedAdapterRecord[] = [];

  for (const input of inputs) {
    if (input.identity.status === "resolved" || input.identity.status === "team_defense_resolved") {
      ready.push(prepareCanonicalRecord(input.record, input.identity.playerId as string));
      continue;
    }

    const unresolvedEntry: UnresolvedAdapterRecord = {
      record: input.record,
      identity: input.identity,
      sourceIndex: input.sourceIndex,
      sourceRecordId: input.record.sourceRecordId,
      reasons: input.identity.reasons,
      warnings: input.identity.warnings
    };

    if (input.identity.status === "manual_review" || input.identity.status === "conflicting_mapping") {
      manualReview.push(unresolvedEntry);
    } else {
      unresolved.push(unresolvedEntry);
    }
  }

  const total = inputs.length + rejected.length;
  return {
    ready,
    unresolved,
    manualReview,
    rejected,
    warnings,
    summary: {
      total,
      ready: ready.length,
      unresolved: unresolved.length,
      manualReview: manualReview.length,
      rejected: rejected.length
    }
  };
}

function prepareCanonicalRecord(record: AdapterSourceRecord, playerId: string): PreparedCanonicalRecord {
  switch (record.kind) {
    case "weekly_stats":
      return prepareWeeklyStatsCanonicalInput(record, playerId);
    case "season_stats":
      return prepareSeasonStatsCanonicalInput(record, playerId);
    case "projection":
      return prepareProjectionCanonicalInput(record, playerId);
    case "injury":
      return prepareInjuryCanonicalInput(record, playerId);
  }
}

// TODO: future provider ingestion should persist unresolved/manual-review records in a staging or review queue.
