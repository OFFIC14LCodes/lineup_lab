import { describe, expect, it, vi } from "vitest";

import { executeImportSession } from "@/lib/providers/import/service";
import { IMPORT_ERROR_CODES } from "@/lib/providers/import/errors";
import type {
  ImportReviewHistoryEntry,
  ImportSessionPayload,
  ImportSessionStatus,
  ProviderImportSessionRow
} from "@/lib/providers/import/types";
import type { PlannedReadyRecord, IngestionExecutionResult } from "@/lib/providers/orchestration/types";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const PLAYER_ID = "33333333-3333-4333-8333-333333333333";

function createReadyRecord(sourceRecordId: string): PlannedReadyRecord {
  return {
    record: {
      kind: "weekly_stats",
      provider: "manual",
      providerExternalId: null,
      externalType: "player",
      fullName: "Player One",
      firstName: null,
      lastName: null,
      team: "ATL",
      rawPosition: "WR",
      positionGroup: "WR",
      season: 2026,
      week: 1,
      seasonType: "regular",
      gameId: null,
      opponent: null,
      homeAway: null,
      gameDate: null,
      stats: {},
      providerFantasyPoints: null,
      sourceUpdatedAt: null,
      sourceRecordId,
      dataVersion: null,
      metadata: {}
    },
    prepared: {
      kind: "weekly_stats",
      playerId: PLAYER_ID,
      input: {
        player_id: PLAYER_ID,
        provider: "manual",
        season: 2026,
        week: 1,
        stats_json: {},
        metadata_json: {}
      }
    },
    writeEligibility: "eligible",
    sourceRecordId,
    warnings: []
  };
}

function createExecutionResult(
  outcomes: IngestionExecutionResult["outcomes"],
  warnings: string[] = []
): IngestionExecutionResult {
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
    startedAt: "2026-06-12T12:00:00.000Z",
    completedAt: "2026-06-12T12:00:01.000Z",
    warnings
  };
}

function createPayload(
  overrides: Partial<ImportSessionPayload> = {},
  reviewHistory: ImportReviewHistoryEntry[] = [{ action: "approve", at: "2026-06-12T11:59:00.000Z", previousOutcome: "manualReview", sourceRecordId: "review-1", selectedPlayerId: PLAYER_ID }]
): ImportSessionPayload {
  return {
    filename: "weekly.csv",
    datasetKind: "weekly_stats",
    provider: "manual",
    injuryImportMode: "append_observation",
    normalizationIssues: [],
    normalizedRecords: [createReadyRecord("row-1").record, createReadyRecord("row-2").record],
    plan: {
      datasetKind: "weekly_stats",
      provider: "manual",
      generatedAt: "2026-06-12T11:58:00.000Z",
      sourceIssueCount: 0,
      identityConflictCount: 0,
      limitedDataWarnings: [],
      ready: [createReadyRecord("row-1"), createReadyRecord("row-2")],
      mappingRequired: [],
      manualReview: [],
      unresolved: [],
      rejected: [],
      warnings: [],
      summary: {
        total: 2,
        ready: 2,
        mappingRequired: 0,
        manualReview: 0,
        unresolved: 0,
        rejected: 0
      }
    },
    totalRows: 2,
    sourceWarnings: [],
    reviewHistory,
    ...overrides
  };
}

function createSession(status: ImportSessionStatus, payloadOverrides: Partial<ImportSessionPayload> = {}): ProviderImportSessionRow {
  return {
    id: SESSION_ID,
    user_id: USER_ID,
    provider: "manual",
    dataset_kind: "weekly_stats",
    filename: "weekly.csv",
    source_hash: "hash",
    session_payload_json: createPayload(payloadOverrides),
    status,
    expires_at: "2026-06-12T13:00:00.000Z",
    created_at: "2026-06-12T11:55:00.000Z",
    updated_at: "2026-06-12T11:56:00.000Z"
  };
}

function createExecuteDeps(session: ProviderImportSessionRow, executionResult?: IngestionExecutionResult) {
  const transitionToExecuting = vi.fn().mockResolvedValue(undefined);
  const executeReadyRecords = vi.fn().mockResolvedValue(executionResult);
  const updateSession = vi.fn().mockImplementation(
    async (_userId: string, _sessionId: string, payload: ImportSessionPayload, status: ImportSessionStatus) => ({
      ...session,
      session_payload_json: payload,
      status
    })
  );

  return {
    loadSession: vi.fn().mockResolvedValue(session),
    transitionToExecuting,
    executeReadyRecords,
    createOrchestrationDependencies: vi.fn().mockReturnValue({}),
    updateSession,
    now: () => new Date("2026-06-12T12:00:02.000Z")
  };
}

describe("provider import execution service", () => {
  it("persists partial failure outcomes without erasing the stored plan or review history", async () => {
    const executionResult = createExecutionResult([
      {
        sourceRecordId: "row-1",
        kind: "weekly_stats",
        playerId: PLAYER_ID,
        provider: "manual",
        status: "written",
        rowId: "weekly-row-1",
        error: null
      },
      {
        sourceRecordId: "row-2",
        kind: "weekly_stats",
        playerId: PLAYER_ID,
        provider: "manual",
        status: "failed",
        rowId: null,
        error: {
          code: "REPOSITORY_WRITE_FAILED",
          message: "Repository write failed."
        }
      }
    ]);
    const session = createSession("ready");
    const deps = createExecuteDeps(session, executionResult);

    const response = await executeImportSession(USER_ID, { sessionId: SESSION_ID, confirm: true }, deps);

    expect(response.status).toBe("partially_failed");
    expect(response.execution).toEqual(executionResult);
    expect(deps.transitionToExecuting).toHaveBeenCalledWith(USER_ID, SESSION_ID);
    expect(deps.executeReadyRecords).toHaveBeenCalledWith(
      session.session_payload_json.plan.ready,
      {},
      { failureMode: "stop_on_first_error" }
    );
    expect(deps.updateSession).toHaveBeenCalledTimes(1);
    const persistedPayload = deps.updateSession.mock.calls[0][2] as ImportSessionPayload;
    const persistedStatus = deps.updateSession.mock.calls[0][3] as ImportSessionStatus;
    const expectedCurrentStatus = deps.updateSession.mock.calls[0][4] as ImportSessionStatus;
    expect(persistedStatus).toBe("partially_failed");
    expect(expectedCurrentStatus).toBe("executing");
    expect(persistedPayload.executionResult).toEqual(executionResult);
    expect(persistedPayload.reviewHistory).toEqual(session.session_payload_json.reviewHistory);
    expect(persistedPayload.plan).toEqual(session.session_payload_json.plan);
    expect(persistedPayload.executedAt).toBe("2026-06-12T12:00:02.000Z");
  });

  it("supports continue-on-error execution results without altering outcome order", async () => {
    const executionResult = createExecutionResult([
      {
        sourceRecordId: "row-1",
        kind: "weekly_stats",
        playerId: PLAYER_ID,
        provider: "manual",
        status: "written",
        rowId: "weekly-row-1",
        error: null
      },
      {
        sourceRecordId: "row-2",
        kind: "weekly_stats",
        playerId: PLAYER_ID,
        provider: "manual",
        status: "failed",
        rowId: null,
        error: {
          code: "REPOSITORY_WRITE_FAILED",
          message: "Repository write failed."
        }
      },
      {
        sourceRecordId: "row-3",
        kind: "weekly_stats",
        playerId: PLAYER_ID,
        provider: "manual",
        status: "written",
        rowId: "weekly-row-3",
        error: null
      }
    ]);
    const session = createSession("ready", {
      plan: {
        ...createPayload().plan,
        ready: [createReadyRecord("row-1"), createReadyRecord("row-2"), createReadyRecord("row-3")],
        summary: {
          total: 3,
          ready: 3,
          mappingRequired: 0,
          manualReview: 0,
          unresolved: 0,
          rejected: 0
        }
      },
      normalizedRecords: [createReadyRecord("row-1").record, createReadyRecord("row-2").record, createReadyRecord("row-3").record],
      totalRows: 3
    });
    const deps = createExecuteDeps(session, executionResult);

    const response = await executeImportSession(
      USER_ID,
      { sessionId: SESSION_ID, confirm: true, failureMode: "continue" },
      deps
    );

    expect(response.status).toBe("partially_failed");
    expect(response.execution?.outcomes.map((outcome) => outcome.sourceRecordId)).toEqual(["row-1", "row-2", "row-3"]);
    expect(response.execution?.outcomes.map((outcome) => outcome.status)).toEqual(["written", "failed", "written"]);
    expect(response.execution?.summary).toEqual({
      total: 3,
      written: 2,
      updated: 0,
      reused: 0,
      failed: 1
    });
    expect(response.execution?.nonTransactional).toBe(true);
    expect(deps.executeReadyRecords).toHaveBeenCalledWith(
      session.session_payload_json.plan.ready,
      {},
      { failureMode: "continue" }
    );
  });

  it("persists total failure safely instead of leaving the session executing", async () => {
    const executionResult = createExecutionResult([
      {
        sourceRecordId: "row-1",
        kind: "weekly_stats",
        playerId: PLAYER_ID,
        provider: "manual",
        status: "failed",
        rowId: null,
        error: {
          code: "REPOSITORY_WRITE_FAILED",
          message: "Repository write failed."
        }
      }
    ]);
    const session = createSession("ready");
    const deps = createExecuteDeps(session, executionResult);

    const response = await executeImportSession(USER_ID, { sessionId: SESSION_ID, confirm: true }, deps);

    expect(response.status).toBe("failed");
    expect(response.execution).toEqual(executionResult);
    expect(deps.updateSession).toHaveBeenCalledTimes(1);
    expect(deps.updateSession.mock.calls[0][3]).toBe("failed");
    const persistedPayload = deps.updateSession.mock.calls[0][2] as ImportSessionPayload;
    expect(persistedPayload.executionResult).toEqual(executionResult);
    expect(JSON.stringify(persistedPayload.executionResult)).not.toContain("supabase");
    expect(JSON.stringify(persistedPayload.executionResult)).not.toContain("service_role");
  });

  it("marks successful executions as completed", async () => {
    const executionResult = createExecutionResult([
      {
        sourceRecordId: "row-1",
        kind: "weekly_stats",
        playerId: PLAYER_ID,
        provider: "manual",
        status: "written",
        rowId: "weekly-row-1",
        error: null
      }
    ]);
    const session = createSession("ready");
    const deps = createExecuteDeps(session, executionResult);

    const response = await executeImportSession(USER_ID, { sessionId: SESSION_ID, confirm: true }, deps);

    expect(response.status).toBe("completed");
    expect(deps.updateSession.mock.calls[0][3]).toBe("completed");
  });

  it("returns stored results for completed and partially_failed sessions without re-executing", async () => {
    const storedExecution = createExecutionResult([
      {
        sourceRecordId: "row-1",
        kind: "weekly_stats",
        playerId: PLAYER_ID,
        provider: "manual",
        status: "written",
        rowId: "weekly-row-1",
        error: null
      }
    ]);

    for (const status of ["completed", "partially_failed"] as const) {
      const session = createSession(status, { executionResult: storedExecution });
      const deps = createExecuteDeps(session, storedExecution);

      const response = await executeImportSession(USER_ID, { sessionId: SESSION_ID, confirm: true }, deps);

      expect(response.status).toBe(status);
      expect(response.execution).toEqual(storedExecution);
      expect(deps.transitionToExecuting).not.toHaveBeenCalled();
      expect(deps.executeReadyRecords).not.toHaveBeenCalled();
      expect(deps.updateSession).not.toHaveBeenCalled();
    }
  });

  it("blocks retries for failed sessions and concurrent execution for executing sessions", async () => {
    const blockedCases: Array<{
      sessionStatus: ImportSessionStatus;
      expectedCode: string;
    }> = [
      { sessionStatus: "failed", expectedCode: IMPORT_ERROR_CODES.sessionNotExecutable },
      { sessionStatus: "executing", expectedCode: IMPORT_ERROR_CODES.executionAlreadyStarted }
    ];

    for (const blockedCase of blockedCases) {
      const session = createSession(blockedCase.sessionStatus);
      const deps = createExecuteDeps(session);

      await expect(
        executeImportSession(USER_ID, { sessionId: SESSION_ID, confirm: true }, deps)
      ).rejects.toMatchObject({
        code: blockedCase.expectedCode
      });

      expect(deps.executeReadyRecords).not.toHaveBeenCalled();
      expect(deps.updateSession).not.toHaveBeenCalled();
    }
  });
});
