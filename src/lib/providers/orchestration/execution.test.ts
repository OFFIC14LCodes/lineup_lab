import { describe, expect, it, vi } from "vitest";

import { executeIngestionPlan, executeReadyRecords } from "@/lib/providers/orchestration/execution";
import type { RepositoryWriteDependencies } from "@/lib/providers/orchestration/dependencies";
import type { DatasetIngestionPlan, PlannedReadyRecord } from "@/lib/providers/orchestration/types";
import type { PreparedCanonicalRecord } from "@/lib/providers/adapters/types";
import { ProviderRepositoryConflictError, ProviderRepositoryError } from "@/lib/providers/repositories/shared";

const PLAYER_ID = "11111111-1111-4111-8111-111111111111";

function prepared(kind: PreparedCanonicalRecord["kind"], overrides: Partial<PreparedCanonicalRecord> = {}): PreparedCanonicalRecord {
  switch (kind) {
    case "weekly_stats":
      return {
        kind,
        playerId: PLAYER_ID,
        input: { player_id: PLAYER_ID, provider: "manual", season: 2026, week: 1, stats_json: {} },
        ...overrides
      } as PreparedCanonicalRecord;
    case "season_stats":
      return {
        kind,
        playerId: PLAYER_ID,
        input: { player_id: PLAYER_ID, provider: "manual", season: 2026, stats_json: {} },
        ...overrides
      } as PreparedCanonicalRecord;
    case "projection":
      return {
        kind,
        playerId: PLAYER_ID,
        input: { player_id: PLAYER_ID, provider: "manual", season: 2026, projection_type: "season", stats_json: {} },
        ...overrides
      } as PreparedCanonicalRecord;
    case "injury":
      return {
        kind,
        playerId: PLAYER_ID,
        executionMode: "append_observation",
        input: { player_id: PLAYER_ID, provider: "manual" },
        ...overrides
      } as PreparedCanonicalRecord;
  }
}

function ready(preparedRecord: PreparedCanonicalRecord, sourceRecordId = "src"): PlannedReadyRecord {
  return {
    record: {
      kind: preparedRecord.kind,
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
      sourceUpdatedAt: null,
      sourceRecordId,
      metadata: {},
      ...(preparedRecord.kind === "weekly_stats"
        ? { week: 1, seasonType: "regular", gameId: null, opponent: null, homeAway: null, gameDate: null, stats: {}, providerFantasyPoints: null, dataVersion: null }
        : preparedRecord.kind === "season_stats"
          ? { seasonType: "regular", gamesPlayed: 17, gamesStarted: 17, stats: {}, providerFantasyPoints: null, dataVersion: null }
          : preparedRecord.kind === "projection"
            ? { week: null, seasonType: "regular", projectionType: "season", scoringFormat: null, opponent: null, stats: {}, providerFantasyPoints: null, version: "current" }
            : { week: null, status: null, practiceStatus: null, gameStatus: null, bodyPart: null, injuryType: null, description: null, expectedReturn: null, observedAt: null, isCurrent: true })
    } as PlannedReadyRecord["record"],
    prepared: preparedRecord,
    writeEligibility: "eligible",
    sourceRecordId,
    warnings: []
  };
}

function repoDeps(): RepositoryWriteDependencies {
  return {
    upsertWeeklyStats: vi.fn().mockResolvedValue({ id: "weekly-row" }),
    upsertSeasonStats: vi.fn().mockResolvedValue({ id: "season-row" }),
    upsertProjection: vi.fn().mockResolvedValue({ id: "projection-row" }),
    addInjuryObservation: vi.fn().mockResolvedValue({ id: "injury-row" }),
    replaceCurrentInjuryObservation: vi.fn().mockResolvedValue({ id: "injury-current-row" })
  } as unknown as RepositoryWriteDependencies;
}

describe("orchestration execution", () => {
  it("routes each ready record to the correct repository writer in order", async () => {
    const deps = repoDeps();
    const result = await executeReadyRecords(
      [ready(prepared("weekly_stats"), "w1"), ready(prepared("season_stats"), "s1"), ready(prepared("projection"), "p1"), ready(prepared("injury"), "i1"), ready(prepared("injury", { executionMode: "replace_current" }), "i2")],
      deps
    );

    expect(deps.upsertWeeklyStats).toHaveBeenCalledTimes(1);
    expect(deps.upsertSeasonStats).toHaveBeenCalledTimes(1);
    expect(deps.upsertProjection).toHaveBeenCalledTimes(1);
    expect(deps.addInjuryObservation).toHaveBeenCalledTimes(1);
    expect(deps.replaceCurrentInjuryObservation).toHaveBeenCalledTimes(1);
    expect(result.outcomes.map((outcome) => outcome.sourceRecordId)).toEqual(["w1", "s1", "p1", "i1", "i2"]);
  });

  it("rejects plans that contain non-ready records", async () => {
    const deps = repoDeps();
    const plan: DatasetIngestionPlan = {
      datasetKind: "weekly_stats",
      provider: "manual",
      generatedAt: "",
      sourceIssueCount: 0,
      identityConflictCount: 0,
      limitedDataWarnings: [],
      ready: [ready(prepared("weekly_stats"))],
      mappingRequired: [
        {
          record: ready(prepared("weekly_stats")).record,
          playerId: PLAYER_ID,
          provider: "manual",
          providerExternalId: "ext-1",
          externalType: "player",
          suggestedMappingMethod: "manual",
          confidence: 1,
          reasons: [],
          warnings: [],
          proposedExternalMapping: {
            player_id: PLAYER_ID,
            provider: "manual",
            external_id: "ext-1",
            external_type: "player"
          }
        }
      ],
      manualReview: [],
      unresolved: [],
      rejected: [],
      warnings: [],
      summary: { total: 2, ready: 1, mappingRequired: 1, manualReview: 0, unresolved: 0, rejected: 0 }
    };

    await expect(executeIngestionPlan(plan, deps)).rejects.toThrow("non-ready");
  });

  it("supports stop_on_first_error and continue failure modes", async () => {
    const deps = repoDeps();
    deps.upsertSeasonStats = vi.fn().mockRejectedValue(
      new ProviderRepositoryError("REPOSITORY_WRITE_FAILED", "select * from provider_import_sessions https://example.supabase.co")
    );

    const records = [ready(prepared("weekly_stats"), "one"), ready(prepared("season_stats"), "two"), ready(prepared("projection"), "three")];

    const stopped = await executeReadyRecords(records, deps, { failureMode: "stop_on_first_error" });
    expect(stopped.outcomes).toHaveLength(2);
    expect(stopped.outcomes.map((outcome) => outcome.sourceRecordId)).toEqual(["one", "two"]);
    expect(stopped.summary).toEqual({
      total: 2,
      written: 1,
      updated: 0,
      reused: 0,
      failed: 1
    });
    expect(stopped.outcomes[1].status).toBe("failed");
    expect(stopped.outcomes[1].error).toEqual({
      code: "REPOSITORY_WRITE_FAILED",
      message: "Repository write failed."
    });
    expect(stopped.warnings).toContain("Execution is non-transactional; earlier writes were not rolled back.");
    expect(deps.upsertProjection).not.toHaveBeenCalled();

    const continued = await executeReadyRecords(records, deps, { failureMode: "continue" });
    expect(continued.outcomes).toHaveLength(3);
    expect(continued.outcomes.map((outcome) => outcome.sourceRecordId)).toEqual(["one", "two", "three"]);
    expect(continued.outcomes.map((outcome) => outcome.status)).toEqual(["written", "failed", "written"]);
    expect(continued.summary).toEqual({
      total: 3,
      written: 2,
      updated: 0,
      reused: 0,
      failed: 1
    });
    expect(continued.outcomes.filter((outcome) => outcome.status === "failed")).toHaveLength(1);
    expect(continued.nonTransactional).toBe(true);
  });

  it("stops on mapping conflicts under default mode", async () => {
    const deps = repoDeps();
    deps.upsertWeeklyStats = vi.fn().mockRejectedValue(new ProviderRepositoryConflictError("mapping conflict"));

    const result = await executeReadyRecords([ready(prepared("weekly_stats"), "one"), ready(prepared("projection"), "two")], deps);
    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0].error?.code).toBe("conflict_error");
  });

  it("records total failure without leaking raw repository details", async () => {
    const deps = repoDeps();
    deps.upsertWeeklyStats = vi.fn().mockRejectedValue(
      new ProviderRepositoryError("db_error", "insert failed near select * from secrets at https://example.supabase.co/rest/v1")
    );

    const result = await executeReadyRecords([ready(prepared("weekly_stats"), "one")], deps);

    expect(result.summary).toEqual({
      total: 1,
      written: 0,
      updated: 0,
      reused: 0,
      failed: 1
    });
    expect(result.outcomes[0]).toMatchObject({
      sourceRecordId: "one",
      status: "failed",
      error: {
        code: "db_error",
        message: "Repository write failed."
      }
    });
    expect(JSON.stringify(result.outcomes[0].error)).not.toContain("supabase");
    expect(JSON.stringify(result.outcomes[0].error)).not.toContain("select *");
    expect(result.nonTransactional).toBe(true);
  });
});
