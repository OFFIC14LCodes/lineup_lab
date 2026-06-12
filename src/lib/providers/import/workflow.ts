import type { MappingRequiredRecord, ManualReviewRecord, UnresolvedOrchestrationRecord } from "@/lib/providers/orchestration/types";

import type { ImportSessionStatus } from "@/lib/providers/import/types";
import { IMPORT_ERROR_CODES, ImportWorkflowError } from "@/lib/providers/import/errors";

const TERMINAL_SESSION_STATUSES: ImportSessionStatus[] = ["completed", "partially_failed", "failed", "expired", "cancelled"];

const ALLOWED_SESSION_STATUS_TRANSITIONS: Record<ImportSessionStatus, ImportSessionStatus[]> = {
  previewed: ["mapping_review", "ready", "cancelled", "expired"],
  mapping_review: ["ready", "cancelled", "expired"],
  ready: ["executing", "cancelled", "expired"],
  executing: ["completed", "partially_failed", "failed"],
  completed: [],
  partially_failed: [],
  failed: [],
  expired: [],
  cancelled: []
};

export function isTerminalSessionStatus(status: ImportSessionStatus) {
  return TERMINAL_SESSION_STATUSES.includes(status);
}

export function canTransitionImportSessionStatus(from: ImportSessionStatus, to: ImportSessionStatus) {
  if (from === to) {
    return true;
  }
  return ALLOWED_SESSION_STATUS_TRANSITIONS[from].includes(to);
}

export function validateApprovedPlayerId(
  row: MappingRequiredRecord | ManualReviewRecord | UnresolvedOrchestrationRecord,
  requestedPlayerId?: string | null
) {
  const trimmed = requestedPlayerId?.trim() || null;

  if ("playerId" in row) {
    if (trimmed && trimmed !== row.playerId) {
      throw new ImportWorkflowError(
        IMPORT_ERROR_CODES.mappingNotApprovable,
        "This mapping-required row can only be approved for the server-selected player.",
        400
      );
    }
    return row.playerId;
  }

  const allowedPlayerIds = new Set<string>(row.candidatePlayerIds);
  if ("resolvedPlayerId" in row && row.resolvedPlayerId) {
    allowedPlayerIds.add(row.resolvedPlayerId);
  }

  if (!trimmed) {
    throw new ImportWorkflowError(
      IMPORT_ERROR_CODES.mappingNotApprovable,
      "Select one of the suggested players before approving this row.",
      400
    );
  }

  if (!allowedPlayerIds.has(trimmed)) {
    throw new ImportWorkflowError(
      IMPORT_ERROR_CODES.mappingNotApprovable,
      "The selected player is not valid for this stored review row.",
      400
    );
  }

  return trimmed;
}
