import "server-only";

import { createHash } from "crypto";

import {
  prepareInjuryCanonicalInput,
  prepareProjectionCanonicalInput,
  prepareSeasonStatsCanonicalInput,
  prepareWeeklyStatsCanonicalInput
} from "@/lib/providers/adapters/normalize";
import type { AdapterSourceRecord, PreparedCanonicalRecord } from "@/lib/providers/adapters/types";
import { upsertExternalIdMapping } from "@/lib/providers/external-ids";
import { ExternalIdMappingConflictError } from "@/lib/providers/external-ids";
import { createAdminClient } from "@/lib/supabase/admin";
import { createProviderOrchestrationDependencies } from "@/lib/providers/orchestration/identity-lookups";
import { executeReadyRecords as executeOrchestrationReadyRecords } from "@/lib/providers/orchestration/execution";
import {
  planInjuryIngestion,
  planProjectionIngestion,
  planSeasonStatsIngestion,
  planWeeklyStatsIngestion
} from "@/lib/providers/orchestration/planning";
import type {
  DatasetIngestionPlan,
  IngestionExecutionResult,
  ManualReviewRecord,
  MappingRequiredRecord,
  PlannedReadyRecord,
  UnresolvedOrchestrationRecord
} from "@/lib/providers/orchestration/types";
import { ProviderRepositoryError } from "@/lib/providers/repositories/shared";
import { IMPORT_SESSION_TTL_MINUTES } from "@/lib/providers/import/constants";
import { IMPORT_ERROR_CODES, ImportWorkflowError } from "@/lib/providers/import/errors";
import { normalizeImportRecords, parseImportPayload } from "@/lib/providers/import/parse";
import type {
  ExecuteImportRequest,
  ExecuteImportResponse,
  ImportPreviewRequest,
  ImportPreviewResponse,
  ImportSessionPayload,
  ImportSessionStatus,
  InjuryImportMode,
  MappingApprovalRequest,
  MappingApprovalResponse,
  ProviderImportSessionRow
} from "@/lib/providers/import/types";
import { canTransitionImportSessionStatus, isTerminalSessionStatus, validateApprovedPlayerId } from "@/lib/providers/import/workflow";

type PlayerOption = {
  id: string;
  fullName: string | null;
  team: string | null;
  positionGroup: string | null;
  primaryPosition: string | null;
};

type SessionPreviewExtras = {
  playerOptions: Record<string, PlayerOption>;
};

type ExecuteImportSessionDependencies = {
  loadSession: typeof getImportSessionOrThrow;
  transitionToExecuting: typeof transitionImportSessionToExecuting;
  updateSession: typeof updateImportSession;
  executeReadyRecords: typeof executeOrchestrationReadyRecords;
  createOrchestrationDependencies: typeof createProviderOrchestrationDependencies;
  now: () => Date;
};

const defaultExecuteImportSessionDependencies: ExecuteImportSessionDependencies = {
  loadSession: getImportSessionOrThrow,
  transitionToExecuting: transitionImportSessionToExecuting,
  updateSession: updateImportSession,
  executeReadyRecords: executeOrchestrationReadyRecords,
  createOrchestrationDependencies: createProviderOrchestrationDependencies,
  now: () => new Date()
};

export async function createImportPreview(userId: string, request: ImportPreviewRequest): Promise<ImportPreviewResponse> {
  const parsed = parseImportPayload(request);
  const normalization = normalizeImportRecords(parsed);
  const plan = await planImportDataset(normalization.records, normalization.issues, request.datasetKind);
  const adjustedPlan = applyInjuryImportModeToPlan(plan, request.injuryImportMode ?? "append_observation");
  const sourceHash = hashSource(request.fileContent);
  const payload: ImportSessionPayload = {
    filename: sanitizeStoredFilename(request.filename),
    datasetKind: request.datasetKind,
    provider: request.provider,
    injuryImportMode: request.injuryImportMode ?? "append_observation",
    normalizationIssues: normalization.issues,
    normalizedRecords: normalization.records,
    plan: adjustedPlan,
    totalRows: parsed.records.length,
    sourceWarnings: parsed.sourceWarnings,
    reviewHistory: []
  };

  const session = await persistImportSession(userId, sanitizeSessionPayload(payload), sourceHash, deriveSessionStatus(adjustedPlan));
  return buildPreviewResponse(session);
}

export async function approveImportMapping(userId: string, request: MappingApprovalRequest): Promise<MappingApprovalResponse> {
  const session = await getImportSessionOrThrow(userId, request.sessionId);
  if (!["previewed", "mapping_review", "ready"].includes(session.status)) {
    throw new ImportWorkflowError(
      IMPORT_ERROR_CODES.mappingNotApprovable,
      `This import session cannot be reviewed from status ${session.status}.`,
      409
    );
  }
  const payload = session.session_payload_json;
  const currentPlan = payload.plan;
  const reviewHistory = [...payload.reviewHistory];
  const sourceRecordId = request.sourceRecordId.trim();

  if (!sourceRecordId) {
    throw new ImportWorkflowError(IMPORT_ERROR_CODES.invalidRequest, "sourceRecordId is required.", 400);
  }

  const mappingRequiredIndex = currentPlan.mappingRequired.findIndex((row) => row.sourceRecordId === sourceRecordId);
  const manualReviewIndex = currentPlan.manualReview.findIndex((row) => row.sourceRecordId === sourceRecordId);
  const unresolvedIndex = currentPlan.unresolved.findIndex((row) => row.sourceRecordId === sourceRecordId);

  if (mappingRequiredIndex < 0 && manualReviewIndex < 0 && unresolvedIndex < 0) {
    const approvedReview = payload.reviewHistory.find(
      (entry) => entry.sourceRecordId === sourceRecordId && entry.action === "approve"
    );
    const skippedReview = payload.reviewHistory.find(
      (entry) => entry.sourceRecordId === sourceRecordId && entry.action === "skip"
    );

    if (request.action === "approve" && approvedReview) {
      return buildPreviewResponse(session);
    }

    if (request.action === "skip" && skippedReview) {
      return buildPreviewResponse(session);
    }

    throw new ImportWorkflowError(IMPORT_ERROR_CODES.mappingNotApprovable, "Review row not found in this import session.", 404);
  }

  const nextPlan: DatasetIngestionPlan = {
    ...currentPlan,
    ready: [...currentPlan.ready],
    mappingRequired: [...currentPlan.mappingRequired],
    manualReview: [...currentPlan.manualReview],
    unresolved: [...currentPlan.unresolved],
    rejected: [...currentPlan.rejected]
  };

  if (mappingRequiredIndex >= 0) {
    const row = nextPlan.mappingRequired.splice(mappingRequiredIndex, 1)[0];
    const playerId = validateApprovedPlayerId(row, request.playerId);
    if (request.action === "approve") {
      if (row.record.providerExternalId) {
        await persistApprovedExternalMapping(row, playerId);
      }
      nextPlan.ready.push(...(await createReadyRecordsFromApprovedRows([row.record], payload.injuryImportMode)));
      reviewHistory.push(buildReviewHistoryEntry("mappingRequired", request.action, row.sourceRecordId, playerId));
    } else {
      nextPlan.rejected.push(buildSkippedRow(row.record, "mappingRequired", row.sourceIndex, row.sourceRecordId));
      reviewHistory.push(buildReviewHistoryEntry("mappingRequired", request.action, row.sourceRecordId));
    }
  } else if (manualReviewIndex >= 0) {
    const row = nextPlan.manualReview.splice(manualReviewIndex, 1)[0];
    const playerId = validateApprovedPlayerId(row, request.playerId);
    if (request.action === "approve") {
      if (row.record.providerExternalId) {
        await persistManualReviewMapping(row, playerId);
        nextPlan.ready.push(...(await createReadyRecordsFromApprovedRows([row.record], payload.injuryImportMode)));
      } else {
        nextPlan.ready.push(await createApprovedReadyRecord(row.record, playerId, payload.injuryImportMode, row));
      }
      reviewHistory.push(buildReviewHistoryEntry("manualReview", request.action, row.sourceRecordId, playerId));
    } else {
      nextPlan.rejected.push(buildSkippedRow(row.record, "manualReview", row.sourceIndex, row.sourceRecordId));
      reviewHistory.push(buildReviewHistoryEntry("manualReview", request.action, row.sourceRecordId));
    }
  } else if (unresolvedIndex >= 0) {
    const row = nextPlan.unresolved.splice(unresolvedIndex, 1)[0];
    const playerId = validateApprovedPlayerId(row, request.playerId);
    if (request.action === "approve") {
      if (row.record.providerExternalId) {
        await persistUnresolvedMapping(row, playerId);
        nextPlan.ready.push(...(await createReadyRecordsFromApprovedRows([row.record], payload.injuryImportMode)));
      } else {
        nextPlan.ready.push(await createApprovedReadyRecord(row.record, playerId, payload.injuryImportMode, row));
      }
      reviewHistory.push(buildReviewHistoryEntry("unresolved", request.action, row.sourceRecordId, playerId));
    } else {
      nextPlan.rejected.push(buildSkippedRow(row.record, "unresolved", row.sourceIndex, row.sourceRecordId));
      reviewHistory.push(buildReviewHistoryEntry("unresolved", request.action, row.sourceRecordId));
    }
  }

  nextPlan.summary = {
    total: payload.totalRows,
    ready: nextPlan.ready.length,
    mappingRequired: nextPlan.mappingRequired.length,
    manualReview: nextPlan.manualReview.length,
    unresolved: nextPlan.unresolved.length,
    rejected: nextPlan.rejected.length
  };

  const updatedSession = await updateImportSession(
    userId,
    session.id,
    sanitizeSessionPayload({
      ...payload,
      plan: nextPlan,
      reviewHistory
    }),
    deriveSessionStatus(nextPlan),
    session.status
  );

  return buildPreviewResponse(updatedSession);
}

export async function executeImportSession(
  userId: string,
  request: ExecuteImportRequest,
  dependencyOverrides: Partial<ExecuteImportSessionDependencies> = {}
): Promise<ExecuteImportResponse> {
  const dependencies = {
    ...defaultExecuteImportSessionDependencies,
    ...dependencyOverrides
  };

  if (!request.confirm) {
    throw new ImportWorkflowError(
      IMPORT_ERROR_CODES.sessionNotExecutable,
      "Explicit confirmation is required before execution.",
      400
    );
  }

  const session = await dependencies.loadSession(userId, request.sessionId);
  const payload = session.session_payload_json;

  if (payload.plan.ready.length === 0) {
    throw new ImportWorkflowError(
      IMPORT_ERROR_CODES.sessionNotExecutable,
      "This import session has no ready rows to execute.",
      409
    );
  }

  if (session.status === "completed" || session.status === "partially_failed") {
    return {
      sessionId: session.id,
      status: session.status,
      blockedCounts: {
        mappingRequired: payload.plan.mappingRequired.length,
        manualReview: payload.plan.manualReview.length,
        unresolved: payload.plan.unresolved.length,
        rejected: payload.plan.rejected.length
      },
      readyCount: payload.plan.ready.length,
      execution: payload.executionResult ?? null,
      warnings: ["This import session was already executed. Returning the stored execution result."]
    };
  }

  if (session.status !== "ready") {
    throw buildNonExecutableStatusError(session.status);
  }

  await dependencies.transitionToExecuting(userId, session.id);

  let execution: IngestionExecutionResult | null = null;
  let status: ImportSessionStatus = "completed";

  try {
    execution = await dependencies.executeReadyRecords(payload.plan.ready, dependencies.createOrchestrationDependencies(), {
      failureMode: request.failureMode ?? "stop_on_first_error"
    });

    if ((execution.summary.failed ?? 0) > 0) {
      status = execution.summary.written > 0 || execution.summary.updated > 0 || execution.summary.reused > 0
        ? "partially_failed"
        : "failed";
    }
  } catch (error) {
    status = "failed";
    if (error instanceof ProviderRepositoryError || error instanceof ImportWorkflowError) {
      throw error;
    }
    throw new ImportWorkflowError(
      IMPORT_ERROR_CODES.internalError,
      "Import execution failed.",
      500
    );
  } finally {
    const finalPayload = sanitizeSessionPayload({
      ...payload,
      executedAt: dependencies.now().toISOString(),
      executionResult: execution
    });
    await dependencies.updateSession(userId, session.id, finalPayload, status, "executing");
  }

  return {
    sessionId: session.id,
    status,
    blockedCounts: {
      mappingRequired: payload.plan.mappingRequired.length,
      manualReview: payload.plan.manualReview.length,
      unresolved: payload.plan.unresolved.length,
      rejected: payload.plan.rejected.length
    },
    readyCount: payload.plan.ready.length,
    execution,
    warnings: [
      ...(execution?.warnings ?? []),
      ...(payload.plan.mappingRequired.length || payload.plan.manualReview.length || payload.plan.unresolved.length
        ? ["Only ready rows were executed. Review or skip remaining blocked rows before re-running a new import."]
        : [])
    ]
  };
}

export async function buildPreviewResponse(session: ProviderImportSessionRow): Promise<ImportPreviewResponse> {
  const payload = session.session_payload_json;
  const extras = await getSessionPreviewExtras(payload.plan);

  return {
    sessionId: session.id,
    datasetKind: payload.datasetKind,
    provider: payload.provider,
    filename: payload.filename,
    totalRows: payload.totalRows,
    normalizationIssues: payload.normalizationIssues,
    readyRows: payload.plan.ready,
    mappingRequiredRows: payload.plan.mappingRequired.map((row) => ({
      ...row,
      candidatePlayers: mapCandidatePlayers([row.playerId], extras.playerOptions)
    })),
    manualReviewRows: payload.plan.manualReview.map((row) => ({
      ...row,
      candidatePlayers: mapCandidatePlayers(row.candidatePlayerIds, extras.playerOptions)
    })),
    unresolvedRows: payload.plan.unresolved.map((row) => ({
      ...row,
      candidatePlayers: mapCandidatePlayers(row.candidatePlayerIds, extras.playerOptions)
    })),
    rejectedRows: payload.plan.rejected,
    summary: {
      totalRows: payload.totalRows,
      ready: payload.plan.ready.length,
      mappingRequired: payload.plan.mappingRequired.length,
      manualReview: payload.plan.manualReview.length,
      unresolved: payload.plan.unresolved.length,
      rejected: payload.plan.rejected.length
    },
    generatedAt: payload.plan.generatedAt,
    expiresAt: session.expires_at,
    sourceHash: session.source_hash,
    injuryImportMode: payload.injuryImportMode,
    sourceWarnings: payload.sourceWarnings,
    reviewHistory: payload.reviewHistory
  };
}

async function planImportDataset(records: AdapterSourceRecord[], issues: ImportSessionPayload["normalizationIssues"], datasetKind: ImportPreviewRequest["datasetKind"]) {
  const dependencies = createProviderOrchestrationDependencies();
  switch (datasetKind) {
    case "weekly_stats":
      return planWeeklyStatsIngestion(records as import("@/lib/providers/adapters/types").AdapterWeeklyStatsRecord[], issues, dependencies);
    case "season_stats":
      return planSeasonStatsIngestion(records as import("@/lib/providers/adapters/types").AdapterSeasonStatsRecord[], issues, dependencies);
    case "projection":
      return planProjectionIngestion(records as import("@/lib/providers/adapters/types").AdapterProjectionRecord[], issues, dependencies);
    case "injury":
      return planInjuryIngestion(records as import("@/lib/providers/adapters/types").AdapterInjuryRecord[], issues, dependencies);
  }
}

function applyInjuryImportModeToPlan(plan: DatasetIngestionPlan, injuryImportMode: InjuryImportMode): DatasetIngestionPlan {
  if (plan.datasetKind !== "injury") {
    return plan;
  }

  return {
    ...plan,
    ready: plan.ready.map((row) =>
      row.prepared.kind === "injury"
        ? {
            ...row,
            prepared: {
              ...row.prepared,
              executionMode: injuryImportMode
            }
          }
        : row
    )
  };
}

async function persistApprovedExternalMapping(row: MappingRequiredRecord, playerId: string) {
  try {
    await upsertExternalIdMapping({
      player_id: playerId,
      provider: row.provider,
      external_id: row.providerExternalId,
      external_type: row.externalType,
      team: row.record.team,
      position_group: row.record.positionGroup,
      season: row.record.season,
      mapping_method: "manual",
      mapping_status: "verified",
      confidence: 1,
      verified_at: new Date().toISOString(),
      metadata_json: {
        approved_via: "provider_import",
        source_record_id: row.sourceRecordId
      }
    });
  } catch (error) {
    if (error instanceof ExternalIdMappingConflictError) {
      throw new ImportWorkflowError(IMPORT_ERROR_CODES.mappingConflict, error.message, 409);
    }
    throw error;
  }
}

async function persistManualReviewMapping(row: ManualReviewRecord, playerId: string) {
  try {
    await upsertExternalIdMapping({
      player_id: playerId,
      provider: row.record.provider,
      external_id: row.record.providerExternalId as string,
      external_type: row.record.externalType,
      team: row.record.team,
      position_group: row.record.positionGroup,
      season: row.record.season,
      mapping_method: "manual",
      mapping_status: "verified",
      confidence: 1,
      verified_at: new Date().toISOString(),
      metadata_json: {
        approved_via: "provider_import",
        source_record_id: row.sourceRecordId
      }
    });
  } catch (error) {
    if (error instanceof ExternalIdMappingConflictError) {
      throw new ImportWorkflowError(IMPORT_ERROR_CODES.mappingConflict, error.message, 409);
    }
    throw error;
  }
}

async function persistUnresolvedMapping(row: UnresolvedOrchestrationRecord, playerId: string) {
  try {
    await upsertExternalIdMapping({
      player_id: playerId,
      provider: row.record.provider,
      external_id: row.record.providerExternalId as string,
      external_type: row.record.externalType,
      team: row.record.team,
      position_group: row.record.positionGroup,
      season: row.record.season,
      mapping_method: "manual",
      mapping_status: "verified",
      confidence: 1,
      verified_at: new Date().toISOString(),
      metadata_json: {
        approved_via: "provider_import",
        source_record_id: row.sourceRecordId
      }
    });
  } catch (error) {
    if (error instanceof ExternalIdMappingConflictError) {
      throw new ImportWorkflowError(IMPORT_ERROR_CODES.mappingConflict, error.message, 409);
    }
    throw error;
  }
}

async function createApprovedReadyRecord(
  record: AdapterSourceRecord,
  playerId: string,
  injuryImportMode: InjuryImportMode,
  reviewRow?: ManualReviewRecord | UnresolvedOrchestrationRecord
): Promise<PlannedReadyRecord> {
  const prepared = prepareRecord(record, playerId, injuryImportMode);
  return {
    record,
    prepared,
    writeEligibility: "eligible",
    sourceIndex: reviewRow?.sourceIndex,
    sourceRecordId: record.sourceRecordId,
    warnings: reviewRow ? [...reviewRow.warnings, "Identity approved manually during import review."] : ["Identity approved manually during import review."]
  };
}

function prepareRecord(record: AdapterSourceRecord, playerId: string, injuryImportMode: InjuryImportMode): PreparedCanonicalRecord {
  switch (record.kind) {
    case "weekly_stats":
      return prepareWeeklyStatsCanonicalInput(record, playerId);
    case "season_stats":
      return prepareSeasonStatsCanonicalInput(record, playerId);
    case "projection":
      return prepareProjectionCanonicalInput(record, playerId);
    case "injury": {
      const prepared = prepareInjuryCanonicalInput(record, playerId);
      return {
        kind: "injury",
        playerId: prepared.playerId,
        input: prepared.input,
        executionMode: injuryImportMode
      };
    }
  }
}

function buildSkippedRow(
  record: AdapterSourceRecord,
  previousOutcome: "mappingRequired" | "manualReview" | "unresolved",
  sourceIndex?: number,
  sourceRecordId?: string | null
) {
  return {
    record,
    code: "PLAYER_UNRESOLVED" as const,
    message: "Row was skipped during manual import review.",
    sourceIndex,
    sourceRecordId,
    details: { skipped: true, previousOutcome }
  };
}

async function getSessionPreviewExtras(plan: DatasetIngestionPlan): Promise<SessionPreviewExtras> {
  const playerIds = new Set<string>();

  for (const row of plan.mappingRequired) {
    playerIds.add(row.playerId);
  }
  for (const row of plan.manualReview) {
    if (row.resolvedPlayerId) playerIds.add(row.resolvedPlayerId);
    row.candidatePlayerIds.forEach((id) => playerIds.add(id));
  }
  for (const row of plan.unresolved) {
    row.candidatePlayerIds.forEach((id) => playerIds.add(id));
  }

  if (playerIds.size === 0) {
    return { playerOptions: {} };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("players")
    .select("id,full_name,team,position_group,primary_position")
    .in("id", [...playerIds]);

  if (error) {
    throw new ProviderRepositoryError(error.code ?? "db_error", error.message, error.details);
  }

  const playerOptions = Object.fromEntries(
    (data ?? []).map((row) => [
      row.id,
      {
        id: row.id,
        fullName: row.full_name,
        team: row.team,
        positionGroup: row.position_group,
        primaryPosition: row.primary_position
      }
    ])
  );

  return { playerOptions };
}

function mapCandidatePlayers(playerIds: string[], playerOptions: Record<string, PlayerOption>) {
  return playerIds.map((id) => playerOptions[id]).filter((value): value is PlayerOption => Boolean(value));
}

async function persistImportSession(userId: string, payload: ImportSessionPayload, sourceHash: string, status: ImportSessionStatus) {
  const supabase = createAdminClient();
  const expiresAt = new Date(Date.now() + IMPORT_SESSION_TTL_MINUTES * 60_000).toISOString();
  const { data, error } = await supabase
    .from("provider_import_sessions")
    .insert({
      user_id: userId,
      provider: payload.provider,
      dataset_kind: payload.datasetKind,
      filename: payload.filename,
      source_hash: sourceHash,
      session_payload_json: payload,
      status,
      expires_at: expiresAt
    })
    .select("*")
    .single();

  if (error) {
    throw new ImportWorkflowError(
      IMPORT_ERROR_CODES.previewPersistenceFailed,
      "Unable to create provider import session. Apply supabase/migrations/006_provider_import_sessions.sql before using this feature.",
      500
    );
  }

  return data as ProviderImportSessionRow;
}

async function updateImportSession(
  userId: string,
  sessionId: string,
  payload: ImportSessionPayload,
  status: ImportSessionStatus,
  expectedCurrentStatus?: ImportSessionStatus
) {
  if (expectedCurrentStatus && !canTransitionImportSessionStatus(expectedCurrentStatus, status)) {
    throw new ImportWorkflowError(IMPORT_ERROR_CODES.sessionNotExecutable, "Invalid session status transition.", 409);
  }
  const supabase = createAdminClient();
  let query = supabase
    .from("provider_import_sessions")
    .update({
      session_payload_json: payload,
      status
    })
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (expectedCurrentStatus) {
    query = query.eq("status", expectedCurrentStatus);
  }

  const { data, error } = await query.select("*").maybeSingle();

  if (error) {
    throw new ImportWorkflowError(IMPORT_ERROR_CODES.internalError, "Unable to update provider import session.", 500);
  }

  if (!data) {
    const currentSession = await getImportSessionOrThrow(userId, sessionId);
    throw buildNonExecutableStatusError(currentSession.status);
  }

  return data as ProviderImportSessionRow;
}

async function transitionImportSessionToExecuting(userId: string, sessionId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("provider_import_sessions")
    .update({ status: "executing" })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("status", "ready")
    .gt("expires_at", new Date().toISOString())
    .select("id,status")
    .maybeSingle();

  if (error) {
    throw new ImportWorkflowError(IMPORT_ERROR_CODES.internalError, "Unable to update import session status.", 500);
  }

  if (!data) {
    const session = await getImportSessionOrThrow(userId, sessionId);
    if (session.status === "executing") {
      throw new ImportWorkflowError(
        IMPORT_ERROR_CODES.executionAlreadyStarted,
        "Execution has already started for this import session.",
        409
      );
    }
    throw buildNonExecutableStatusError(session.status);
  }
}

async function getImportSessionOrThrow(userId: string, sessionId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("provider_import_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new ImportWorkflowError(IMPORT_ERROR_CODES.internalError, "Unable to load provider import session.", 500);
  }

  if (!data) {
    throw new ImportWorkflowError(IMPORT_ERROR_CODES.sessionNotFound, "Import session not found.", 404);
  }

  if (new Date(data.expires_at).getTime() <= Date.now()) {
    if (!isTerminalSessionStatus(data.status)) {
      await supabase.from("provider_import_sessions").update({ status: "expired" }).eq("id", data.id).eq("user_id", userId);
    }
    throw new ImportWorkflowError(
      IMPORT_ERROR_CODES.sessionExpired,
      "This import preview has expired. Preview the file again.",
      410
    );
  }

  return data as ProviderImportSessionRow;
}

function hashSource(fileContent: string) {
  return createHash("sha256").update(fileContent, "utf8").digest("hex");
}

function sanitizeStoredFilename(filename: string) {
  return filename.split(/[\\/]/).pop()?.trim().slice(0, 120) || "import-file";
}

function sanitizeSessionPayload(payload: ImportSessionPayload): ImportSessionPayload {
  return {
    ...payload,
    filename: sanitizeStoredFilename(payload.filename),
    normalizedRecords: payload.normalizedRecords.map((record) => sanitizeRecord(record)),
    plan: sanitizePlan(payload.plan)
  };
}

function sanitizePlan(plan: DatasetIngestionPlan): DatasetIngestionPlan {
  return {
    ...plan,
    ready: plan.ready.map((row) => ({
      ...row,
      record: sanitizeRecord(row.record),
      prepared: sanitizePreparedRecord(row.prepared)
    })),
    mappingRequired: plan.mappingRequired.map((row) => ({
      ...row,
      record: sanitizeRecord(row.record)
    })),
    manualReview: plan.manualReview.map((row) => ({
      ...row,
      record: sanitizeRecord(row.record)
    })),
    unresolved: plan.unresolved.map((row) => ({
      ...row,
      record: sanitizeRecord(row.record)
    })),
    rejected: plan.rejected.map((row) => ({
      ...row,
      record: sanitizeRecord(row.record)
    }))
  };
}

function sanitizeRecord(record: AdapterSourceRecord): AdapterSourceRecord {
  return {
    ...record,
    metadata: {}
  };
}

function sanitizePreparedRecord(prepared: PreparedCanonicalRecord): PreparedCanonicalRecord {
  switch (prepared.kind) {
    case "weekly_stats":
      return {
        ...prepared,
        input: {
          ...prepared.input,
          metadata_json: {}
        }
      };
    case "season_stats":
      return {
        ...prepared,
        input: {
          ...prepared.input,
          metadata_json: {}
        }
      };
    case "projection":
      return {
        ...prepared,
        input: {
          ...prepared.input,
          metadata_json: {}
        }
      };
    case "injury":
      return {
        ...prepared,
        input: {
          ...prepared.input,
          metadata_json: {}
        }
      };
  }
}

function deriveSessionStatus(plan: DatasetIngestionPlan): ImportSessionStatus {
  if (plan.mappingRequired.length || plan.manualReview.length || plan.unresolved.length) {
    return plan.ready.length > 0 ? "ready" : "mapping_review";
  }
  return "ready";
}

function buildReviewHistoryEntry(
  previousOutcome: "mappingRequired" | "manualReview" | "unresolved",
  action: "approve" | "skip",
  sourceRecordId: string | null | undefined,
  selectedPlayerId?: string | null
) {
  return {
    previousOutcome,
    action,
    sourceRecordId: sourceRecordId ?? null,
    selectedPlayerId: selectedPlayerId ?? null,
    at: new Date().toISOString()
  };
}

async function createReadyRecordsFromApprovedRows(records: AdapterSourceRecord[], injuryImportMode: InjuryImportMode) {
  const plan = applyInjuryImportModeToPlan(
    await planImportDataset(records, [], records[0].kind),
    injuryImportMode
  );

  if (plan.ready.length !== records.length || plan.mappingRequired.length || plan.manualReview.length || plan.unresolved.length || plan.rejected.length) {
    throw new ImportWorkflowError(
      IMPORT_ERROR_CODES.mappingNotApprovable,
      "The approved row could not be promoted to ready after validation.",
      409
    );
  }

  return plan.ready;
}

function buildNonExecutableStatusError(status: ImportSessionStatus) {
  if (status === "completed" || status === "partially_failed") {
    return new ImportWorkflowError(
      IMPORT_ERROR_CODES.executionAlreadyCompleted,
      "This import session has already completed execution.",
      409
    );
  }

  if (status === "executing") {
    return new ImportWorkflowError(
      IMPORT_ERROR_CODES.executionAlreadyStarted,
      "Execution has already started for this import session.",
      409
    );
  }

  if (status === "expired") {
    return new ImportWorkflowError(
      IMPORT_ERROR_CODES.sessionExpired,
      "This import preview has expired. Preview the file again.",
      410
    );
  }

  return new ImportWorkflowError(
    IMPORT_ERROR_CODES.sessionNotExecutable,
    `This import session cannot execute from status ${status}.`,
    409
  );
}
