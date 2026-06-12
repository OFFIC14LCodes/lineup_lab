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
import { createAdminClient } from "@/lib/supabase/admin";
import { createProviderOrchestrationDependencies } from "@/lib/providers/orchestration/identity-lookups";
import { executeReadyRecords } from "@/lib/providers/orchestration/execution";
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
import { ProviderRepositoryError, ProviderRepositoryValidationError } from "@/lib/providers/repositories/shared";
import { IMPORT_SESSION_TTL_MINUTES } from "@/lib/providers/import/constants";
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

export async function createImportPreview(userId: string, request: ImportPreviewRequest): Promise<ImportPreviewResponse> {
  const parsed = parseImportPayload(request);
  const normalization = normalizeImportRecords(parsed);
  const plan = await planImportDataset(normalization.records, normalization.issues, request.datasetKind);
  const adjustedPlan = applyInjuryImportModeToPlan(plan, request.injuryImportMode ?? "append_observation");
  const payload: ImportSessionPayload = {
    filename: request.filename,
    sourceHash: hashSource(request.fileContent),
    datasetKind: request.datasetKind,
    provider: request.provider,
    injuryImportMode: request.injuryImportMode ?? "append_observation",
    normalizationIssues: normalization.issues,
    normalizedRecords: normalization.records,
    plan: adjustedPlan,
    totalRows: parsed.records.length,
    sourceWarnings: parsed.sourceWarnings
  };

  const session = await persistImportSession(userId, payload, "previewed");
  return buildPreviewResponse(session);
}

export async function approveImportMapping(userId: string, request: MappingApprovalRequest): Promise<MappingApprovalResponse> {
  const session = await getImportSessionOrThrow(userId, request.sessionId);
  const payload = session.session_payload_json;
  const currentPlan = payload.plan;
  const sourceRecordId = request.sourceRecordId.trim();

  if (!sourceRecordId) {
    throw new ProviderRepositoryValidationError("sourceRecordId is required.");
  }

  const mappingRequiredIndex = currentPlan.mappingRequired.findIndex((row) => row.sourceRecordId === sourceRecordId);
  const manualReviewIndex = currentPlan.manualReview.findIndex((row) => row.sourceRecordId === sourceRecordId);
  const unresolvedIndex = currentPlan.unresolved.findIndex((row) => row.sourceRecordId === sourceRecordId);

  if (mappingRequiredIndex < 0 && manualReviewIndex < 0 && unresolvedIndex < 0) {
    throw new ProviderRepositoryValidationError("Review row not found in this import session.");
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
    if (request.action === "approve") {
      const playerId = request.playerId?.trim() || row.playerId;
      const readyRecord = await createApprovedReadyRecord(row.record, playerId, payload.injuryImportMode);
      if (row.record.providerExternalId) {
        await persistApprovedExternalMapping(row, playerId);
      }
      nextPlan.ready.push(readyRecord);
    } else {
      nextPlan.rejected.push(buildSkippedRow(row.record, row.sourceIndex, row.sourceRecordId));
    }
  } else if (manualReviewIndex >= 0) {
    const row = nextPlan.manualReview.splice(manualReviewIndex, 1)[0];
    if (request.action === "approve") {
      const playerId = request.playerId?.trim() || row.resolvedPlayerId;
      if (!playerId) {
        throw new ProviderRepositoryValidationError("playerId is required to approve a manual review row.");
      }
      const readyRecord = await createApprovedReadyRecord(row.record, playerId, payload.injuryImportMode, row);
      if (row.record.providerExternalId) {
        await persistManualReviewMapping(row, playerId);
      }
      nextPlan.ready.push(readyRecord);
    } else {
      nextPlan.rejected.push(buildSkippedRow(row.record, row.sourceIndex, row.sourceRecordId));
    }
  } else if (unresolvedIndex >= 0) {
    const row = nextPlan.unresolved.splice(unresolvedIndex, 1)[0];
    if (request.action === "approve") {
      const playerId = request.playerId?.trim();
      if (!playerId) {
        throw new ProviderRepositoryValidationError("playerId is required to approve an unresolved row.");
      }
      const readyRecord = await createApprovedReadyRecord(row.record, playerId, payload.injuryImportMode, row);
      if (row.record.providerExternalId) {
        await persistUnresolvedMapping(row, playerId);
      }
      nextPlan.ready.push(readyRecord);
    } else {
      nextPlan.rejected.push(buildSkippedRow(row.record, row.sourceIndex, row.sourceRecordId));
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

  const updatedSession = await updateImportSession(userId, session.id, {
    ...payload,
    plan: nextPlan
  }, nextPlan.ready.length > 0 ? "ready" : "mapping_review");

  return buildPreviewResponse(updatedSession);
}

export async function executeImportSession(userId: string, request: ExecuteImportRequest): Promise<ExecuteImportResponse> {
  if (!request.confirm) {
    throw new ProviderRepositoryValidationError("confirm must be true to execute an import session.");
  }

  const session = await getImportSessionOrThrow(userId, request.sessionId);
  const payload = session.session_payload_json;

  if (payload.plan.ready.length === 0) {
    throw new ProviderRepositoryValidationError("This import session has no ready rows to execute.");
  }

  if (["completed", "partially_failed", "failed"].includes(session.status)) {
    throw new ProviderRepositoryValidationError("This import session has already been executed.");
  }

  await setImportSessionStatus(userId, session.id, "executing");

  let execution: IngestionExecutionResult | null = null;
  let status: ImportSessionStatus = "completed";

  try {
    execution = await executeReadyRecords(payload.plan.ready, createProviderOrchestrationDependencies(), {
      failureMode: request.failureMode ?? "stop_on_first_error"
    });

    if ((execution.summary.failed ?? 0) > 0) {
      status = execution.summary.written > 0 || execution.summary.updated > 0 || execution.summary.reused > 0
        ? "partially_failed"
        : "failed";
    }
  } catch (error) {
    status = "failed";
    if (error instanceof ProviderRepositoryError) {
      throw error;
    }
    throw new ProviderRepositoryError("REPOSITORY_WRITE_FAILED", error instanceof Error ? error.message : "Import execution failed.");
  } finally {
    const finalPayload: ImportSessionPayload = {
      ...payload,
      executedAt: new Date().toISOString(),
      executionResult: execution
    };
    await updateImportSession(userId, session.id, finalPayload, status);
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
    sourceHash: payload.sourceHash,
    injuryImportMode: payload.injuryImportMode,
    sourceWarnings: payload.sourceWarnings
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
}

async function persistManualReviewMapping(row: ManualReviewRecord, playerId: string) {
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
}

async function persistUnresolvedMapping(row: UnresolvedOrchestrationRecord, playerId: string) {
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

function buildSkippedRow(record: AdapterSourceRecord, sourceIndex?: number, sourceRecordId?: string | null) {
  return {
    record,
    code: "PLAYER_UNRESOLVED" as const,
    message: "Row was skipped during manual import review.",
    sourceIndex,
    sourceRecordId,
    details: { skipped: true }
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

async function persistImportSession(userId: string, payload: ImportSessionPayload, status: ImportSessionStatus) {
  const supabase = createAdminClient();
  const expiresAt = new Date(Date.now() + IMPORT_SESSION_TTL_MINUTES * 60_000).toISOString();
  const { data, error } = await supabase
    .from("provider_import_sessions")
    .insert({
      user_id: userId,
      provider: payload.provider,
      dataset_kind: payload.datasetKind,
      filename: payload.filename,
      source_hash: payload.sourceHash,
      session_payload_json: payload,
      status,
      expires_at: expiresAt
    })
    .select("*")
    .single();

  if (error) {
    throw new ProviderRepositoryError(
      error.code ?? "db_error",
      `Unable to create provider import session. Apply supabase/migrations/006_provider_import_sessions.sql before using this feature.`
    );
  }

  return data as ProviderImportSessionRow;
}

async function updateImportSession(userId: string, sessionId: string, payload: ImportSessionPayload, status: ImportSessionStatus) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("provider_import_sessions")
    .update({
      session_payload_json: payload,
      status
    })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw new ProviderRepositoryError(error.code ?? "db_error", "Unable to update provider import session.", error.details);
  }

  return data as ProviderImportSessionRow;
}

async function setImportSessionStatus(userId: string, sessionId: string, status: ImportSessionStatus) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("provider_import_sessions")
    .update({ status })
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (error) {
    throw new ProviderRepositoryError(error.code ?? "db_error", "Unable to update import session status.", error.details);
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
    throw new ProviderRepositoryError(error.code ?? "db_error", "Unable to load provider import session.", error.details);
  }

  if (!data) {
    throw new ProviderRepositoryValidationError("Import session not found.");
  }

  if (new Date(data.expires_at).getTime() <= Date.now()) {
    throw new ProviderRepositoryValidationError("Import session has expired. Preview the file again.");
  }

  return data as ProviderImportSessionRow;
}

function hashSource(fileContent: string) {
  return createHash("sha256").update(fileContent, "utf8").digest("hex");
}
