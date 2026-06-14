// Phase B persistence: batch upsert, retry, timeout, SIGINT, idempotency

import { describe, expect, it } from "vitest";

import type { BlackbirdDerivedContext } from "./derive";
import {
  H8_CONTEXT_VERSION,
  buildEvidenceInsertRow,
  buildSnapshotInsertRow,
  createInterruptState,
  inspectH8Persistence,
  persistPhaseB,
  withTimeout,
} from "./phase-b-persist";
import type {
  BatchUpsertResult,
  EvidenceDistribution,
  EvidenceInsertRow,
  InspectH8Opts,
  PhaseBProgress,
  SnapshotInsertRow,
  SupabaseBatchClient,
} from "./phase-b-persist";

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const noSleep = () => Promise.resolve();

function makeEvidenceRow(n: number): EvidenceInsertRow {
  return {
    evidence_id: `ev_${n.toString().padStart(8, "0")}`,
    source_type: "model_inference",
    source_name: "Blackbird GM",
    source_url: null,
    source_identifier: `blackbird-probe-${n}`,
    author: null,
    organization: null,
    published_at: null,
    captured_at: "2026-06-14T00:00:00.000Z",
    effective_date: null,
    season: 2025,
    player_id: `player-${Math.floor(n / 8)}`,
    team_id: null,
    evidence_category: "model_inference",
    normalized_claim: `test claim ${n}`,
    raw_excerpt: null,
    is_observed: false,
    confidence: 0.4,
    reliability_tier: 4,
    expiration_policy: "seasonal",
    expires_at: null,
    source_hash: null,
    parser_version: "h8-evidence-v1",
    review_status: "approved",
  };
}

function makeSnapshotRow(playerId: string): SnapshotInsertRow {
  return {
    canonical_player_id: playerId,
    season: 2026,
    as_of_date: "2026-06-14",
    context_version: H8_CONTEXT_VERSION,
    overall_confidence: "unresolved",
    overall_status: "unknown",
    derived_context_json: "{}",
    updated_at: "2026-06-14T00:00:00.000Z",
  };
}

type MockCall = { table: string; rows: Record<string, unknown>[] };

function makeMockClient(
  responses: Array<BatchUpsertResult | ((rows: Record<string, unknown>[], callNum: number) => BatchUpsertResult)>
): { client: SupabaseBatchClient; calls: MockCall[] } {
  const calls: MockCall[] = [];
  let callIndex = 0;

  const client: SupabaseBatchClient = {
    from: (table) => ({
      upsert: (rows) => ({
        select: () => {
          const ci = callIndex++;
          calls.push({ table, rows });
          const resp = responses[ci];
          const result: BatchUpsertResult =
            typeof resp === "function" ? resp(rows, ci) : (resp ?? { data: rows.map(() => ({})), error: null });
          return Promise.resolve(result);
        },
      }),
    }),
  };

  return { client, calls };
}

function succeed(rows: Record<string, unknown>[]): BatchUpsertResult {
  // By default return same count as input (all inserted)
  return { data: rows.map(() => ({})), error: null };
}

function succeedWithN(n: number): BatchUpsertResult {
  return { data: Array.from({ length: n }, () => ({})), error: null };
}

function failWith(msg: string, code?: string): BatchUpsertResult {
  return { data: null, error: { message: msg, code } };
}

// --------------------------------------------------------------------------
// 1. buildEvidenceInsertRow — includes evidence_category
// --------------------------------------------------------------------------

describe("buildEvidenceInsertRow", () => {
  it("maps evidence_category from evidenceCategory (was missing)", () => {
    const rec = {
      evidenceId: "abc123",
      sourceType: "model_inference" as const,
      sourceName: "Blackbird GM",
      sourceUrl: null,
      sourceIdentifier: "blackbird-h2",
      author: null,
      organization: null,
      publishedAt: null,
      capturedAt: "2026-06-14T00:00:00.000Z",
      effectiveDate: null,
      season: 2025,
      playerId: "player-uuid",
      teamId: null,
      evidenceCategory: "model_inference" as const,
      normalizedClaim: "2025 target share: 18.2%",
      rawExcerpt: null,
      isObserved: false,
      confidence: 0.4,
      reliabilityTier: 4 as const,
      expirationPolicy: "seasonal" as const,
      expiresAt: null,
      sourceHash: null,
      parserVersion: "h8-evidence-v1",
      reviewStatus: "approved" as const,
    };

    const row = buildEvidenceInsertRow(rec, "player-uuid");

    expect(row.evidence_category).toBe("model_inference");
    expect(row.evidence_id).toBe("abc123");
    expect(row.player_id).toBe("player-uuid");
    expect(row.season).toBe(2025);
  });
});

// --------------------------------------------------------------------------
// 2. buildSnapshotInsertRow — context_version is integer H8_CONTEXT_VERSION
// --------------------------------------------------------------------------

describe("buildSnapshotInsertRow", () => {
  const baseContext = {
    priorTargetShare: {
      value: 0.182,
      valueType: "number",
      status: "inferred" as const,
      confidence: "low" as const,
      evidenceIds: ["abc"],
      observedAt: null,
      effectiveFrom: null,
      expiresAt: null,
      lastReviewedAt: null,
      inferenceMethod: "h2_pbp_season_2025",
      contradictionCount: 0,
    },
  } as unknown as BlackbirdDerivedContext;

  it("uses H8_CONTEXT_VERSION (integer 1, not a string)", () => {
    const row = buildSnapshotInsertRow({ playerId: "p1", context: baseContext, contextSeason: 2026, asOfDate: "2026-06-14" });
    expect(row.context_version).toBe(H8_CONTEXT_VERSION);
    expect(typeof row.context_version).toBe("number");
    expect(row.context_version).toBe(1);
  });

  it("maps inferred status → current (valid snapshot status)", () => {
    const row = buildSnapshotInsertRow({ playerId: "p1", context: baseContext, contextSeason: 2026, asOfDate: "2026-06-14" });
    expect(row.overall_status).toBe("current");
  });

  it("maps observed status → current", () => {
    const ctx = { ...baseContext, priorTargetShare: { ...baseContext.priorTargetShare, status: "observed" as const } } as unknown as BlackbirdDerivedContext;
    const row = buildSnapshotInsertRow({ playerId: "p1", context: ctx, contextSeason: 2026, asOfDate: "2026-06-14" });
    expect(row.overall_status).toBe("current");
  });

  it("passes through unknown status unchanged", () => {
    const ctx = { ...baseContext, priorTargetShare: { ...baseContext.priorTargetShare, status: "unknown" as const, confidence: "unresolved" as const } } as unknown as BlackbirdDerivedContext;
    const row = buildSnapshotInsertRow({ playerId: "p1", context: ctx, contextSeason: 2026, asOfDate: "2026-06-14" });
    expect(row.overall_status).toBe("unknown");
  });
});

// --------------------------------------------------------------------------
// 3. Batching — evidence splits into ceil(N/batchSize) batches
// --------------------------------------------------------------------------

describe("persistPhaseB — batching", () => {
  it("splits 501 evidence rows into 2 batches (batchSize=500)", async () => {
    const ev = Array.from({ length: 501 }, (_, i) => makeEvidenceRow(i));
    const sn: SnapshotInsertRow[] = [];
    const { client, calls } = makeMockClient([
      (rows) => succeed(rows),
      (rows) => succeed(rows),
    ]);

    const result = await persistPhaseB(client, ev, sn, { evidenceBatchSize: 500, sleep: noSleep });

    expect(result.evidenceBatchesCompleted).toBe(2);
    expect(calls.filter((c) => c.table === "context_evidence")).toHaveLength(2);
    expect(calls[0]!.rows).toHaveLength(500);
    expect(calls[1]!.rows).toHaveLength(1);
    expect(result.evidenceAttempted).toBe(501);
  });

  it("splits 201 snapshot rows into 2 batches (batchSize=200)", async () => {
    const ev: EvidenceInsertRow[] = [];
    const sn = Array.from({ length: 201 }, (_, i) => makeSnapshotRow(`player-${i}`));
    const { client, calls } = makeMockClient([
      (rows) => succeed(rows),
      (rows) => succeed(rows),
    ]);

    const result = await persistPhaseB(client, ev, sn, { snapshotBatchSize: 200, sleep: noSleep });

    expect(result.snapshotBatchesCompleted).toBe(2);
    expect(calls.filter((c) => c.table === "player_context_snapshots")).toHaveLength(2);
    expect(result.snapshotAttempted).toBe(201);
  });

  it("uses ignoreDuplicates=true — detected via always-passing second identical call", async () => {
    const ev = [makeEvidenceRow(1)];
    const sn: SnapshotInsertRow[] = [];
    let opts: Record<string, unknown> = {};

    const client: SupabaseBatchClient = {
      from: () => ({
        upsert: (_, upsertOpts) => {
          opts = upsertOpts as Record<string, unknown>;
          return { select: () => Promise.resolve({ data: [{}], error: null }) };
        },
      }),
    };

    await persistPhaseB(client, ev, sn, { sleep: noSleep });
    expect(opts["ignoreDuplicates"]).toBe(true);
    expect(opts["onConflict"]).toBe("evidence_id");
  });
});

// --------------------------------------------------------------------------
// 4. Progress callbacks — called after each successful batch
// --------------------------------------------------------------------------

describe("persistPhaseB — progress callbacks", () => {
  it("emits progress after each evidence and snapshot batch", async () => {
    const ev = Array.from({ length: 10 }, (_, i) => makeEvidenceRow(i));
    const sn = Array.from({ length: 5 }, (_, i) => makeSnapshotRow(`p${i}`));
    const progresses: PhaseBProgress[] = [];
    const { client } = makeMockClient([
      () => succeedWithN(10),
      () => succeedWithN(5),
    ]);

    await persistPhaseB(client, ev, sn, {
      evidenceBatchSize: 10,
      snapshotBatchSize: 5,
      onProgress: (p) => progresses.push(p),
      sleep: noSleep,
    });

    expect(progresses).toHaveLength(2);
    expect(progresses[0]!.table).toBe("context_evidence");
    expect(progresses[0]!.batchNumber).toBe(1);
    expect(progresses[0]!.totalBatches).toBe(1);
    expect(progresses[0]!.attempted).toBe(10);
    expect(progresses[0]!.inserted).toBe(10);
    expect(progresses[0]!.existing).toBe(0);

    expect(progresses[1]!.table).toBe("player_context_snapshots");
    expect(progresses[1]!.batchNumber).toBe(1);
    expect(progresses[1]!.inserted).toBe(5);
  });

  it("reports inserted vs existing correctly when some rows already exist", async () => {
    const ev = Array.from({ length: 10 }, (_, i) => makeEvidenceRow(i));
    const sn: SnapshotInsertRow[] = [];
    const progresses: PhaseBProgress[] = [];

    // Supabase returns only newly inserted rows; 7 inserted, 3 already existed
    const { client } = makeMockClient([() => succeedWithN(7)]);
    await persistPhaseB(client, ev, sn, {
      evidenceBatchSize: 10,
      onProgress: (p) => progresses.push(p),
      sleep: noSleep,
    });

    expect(progresses[0]!.inserted).toBe(7);
    expect(progresses[0]!.existing).toBe(3);
    expect(progresses[0]!.attempted).toBe(10);
  });

  it("does NOT emit progress for failed attempts (only for successful batches)", async () => {
    const ev = [makeEvidenceRow(1)];
    const sn: SnapshotInsertRow[] = [];
    const progresses: PhaseBProgress[] = [];
    let callCount = 0;

    const client: SupabaseBatchClient = {
      from: () => ({
        upsert: (rows) => ({
          select: () => {
            callCount++;
            if (callCount === 1) return Promise.resolve(failWith("network timeout"));
            return Promise.resolve(succeed(rows));
          },
        }),
      }),
    };

    await persistPhaseB(client, ev, sn, {
      onProgress: (p) => progresses.push(p),
      sleep: noSleep,
      backoffMs: [0],
    });

    expect(callCount).toBe(2);  // 1 retry
    expect(progresses).toHaveLength(1);  // only 1 success event
  });
});

// --------------------------------------------------------------------------
// 5. Transient failure then success
// --------------------------------------------------------------------------

describe("persistPhaseB — transient retry", () => {
  it("retries a transient network error and succeeds", async () => {
    const ev = [makeEvidenceRow(1)];
    const sn: SnapshotInsertRow[] = [];
    let callCount = 0;

    const client: SupabaseBatchClient = {
      from: () => ({
        upsert: (rows) => ({
          select: () => {
            callCount++;
            if (callCount === 1) return Promise.resolve(failWith("TypeError: fetch failed"));
            return Promise.resolve(succeed(rows));
          },
        }),
      }),
    };

    const result = await persistPhaseB(client, ev, sn, { sleep: noSleep, backoffMs: [0, 0, 0, 0, 0] });

    expect(callCount).toBe(2);
    expect(result.evidenceBatchesCompleted).toBe(1);
    expect(result.evidenceAttempted).toBe(1);
  });

  it("retries up to maxAttempts then throws", async () => {
    const ev = [makeEvidenceRow(1)];
    const sn: SnapshotInsertRow[] = [];

    const client: SupabaseBatchClient = {
      from: () => ({
        upsert: () => ({
          select: () => Promise.resolve(failWith("TypeError: fetch failed")),
        }),
      }),
    };

    await expect(
      persistPhaseB(client, ev, sn, { maxAttempts: 3, sleep: noSleep, backoffMs: [0, 0, 0] })
    ).rejects.toThrow("retries exhausted");
  });
});

// --------------------------------------------------------------------------
// 6. Deterministic errors — no retry, fail immediately
// --------------------------------------------------------------------------

describe("persistPhaseB — deterministic errors not retried", () => {
  it("does not retry 42P10 (no unique constraint)", async () => {
    const ev = [makeEvidenceRow(1)];
    const sn: SnapshotInsertRow[] = [];
    let callCount = 0;

    const client: SupabaseBatchClient = {
      from: () => ({
        upsert: () => ({
          select: () => { callCount++; return Promise.resolve(failWith("no unique or exclusion constraint", "42P10")); },
        }),
      }),
    };

    await expect(
      persistPhaseB(client, ev, sn, { sleep: noSleep })
    ).rejects.toThrow(/deterministic|no unique|42P10/);
    expect(callCount).toBe(1);
  });

  it("does not retry 23502 (not_null_violation — missing evidence_category)", async () => {
    const ev = [makeEvidenceRow(1)];
    const sn: SnapshotInsertRow[] = [];
    let callCount = 0;

    const client: SupabaseBatchClient = {
      from: () => ({
        upsert: () => ({
          select: () => { callCount++; return Promise.resolve(failWith("null value in column", "23502")); },
        }),
      }),
    };

    await expect(
      persistPhaseB(client, ev, sn, { sleep: noSleep })
    ).rejects.toThrow("deterministic");
    expect(callCount).toBe(1);
  });

  it("does not retry 22P02 (type cast failure — context_version as text)", async () => {
    const ev: EvidenceInsertRow[] = [];
    const sn = [makeSnapshotRow("p1")];
    let callCount = 0;

    const client: SupabaseBatchClient = {
      from: () => ({
        upsert: () => ({
          select: () => { callCount++; return Promise.resolve(failWith("invalid input syntax for type integer", "22P02")); },
        }),
      }),
    };

    await expect(
      persistPhaseB(client, ev, sn, { sleep: noSleep })
    ).rejects.toThrow("deterministic");
    expect(callCount).toBe(1);
  });
});

// --------------------------------------------------------------------------
// 7. Request timeout
// --------------------------------------------------------------------------

describe("withTimeout", () => {
  it("resolves normally when the promise resolves before timeout", async () => {
    const result = await withTimeout(Promise.resolve(42), 1000);
    expect(result).toBe(42);
  });

  it("rejects with a timeout error when the promise is too slow", async () => {
    const neverResolves = new Promise<never>(() => {});
    await expect(withTimeout(neverResolves, 10)).rejects.toThrow("timed out after 10ms");
  });
});

describe("persistPhaseB — request timeout → retried as transient", () => {
  it("treats a timed-out batch as transient and retries", async () => {
    const ev = [makeEvidenceRow(1)];
    const sn: SnapshotInsertRow[] = [];
    let callCount = 0;

    const client: SupabaseBatchClient = {
      from: () => ({
        upsert: (rows) => ({
          select: () => {
            callCount++;
            if (callCount === 1) {
              // Simulate a slow request that never resolves within the timeout
              return new Promise<BatchUpsertResult>((resolve) => setTimeout(() => resolve(succeed(rows)), 5000));
            }
            return Promise.resolve(succeed(rows));
          },
        }),
      }),
    };

    const result = await persistPhaseB(client, ev, sn, {
      timeoutMs: 20,  // 20ms timeout — first call will time out
      sleep: noSleep,
      backoffMs: [0, 0, 0, 0, 0],
    });

    expect(callCount).toBe(2);
    expect(result.evidenceBatchesCompleted).toBe(1);
  });
});

// --------------------------------------------------------------------------
// 8. Ctrl+C before Phase B
// --------------------------------------------------------------------------

describe("persistPhaseB — interrupt before Phase B", () => {
  it("attempts no batches when interrupt triggered before call", async () => {
    const ev = Array.from({ length: 10 }, (_, i) => makeEvidenceRow(i));
    const sn = Array.from({ length: 5 }, (_, i) => makeSnapshotRow(`p${i}`));
    let callCount = 0;

    const client: SupabaseBatchClient = {
      from: () => ({
        upsert: () => ({ select: () => { callCount++; return Promise.resolve({ data: [], error: null }); } }),
      }),
    };

    const state = createInterruptState();
    state.triggered = true;  // interrupt before call

    const result = await persistPhaseB(client, ev, sn, { interruptState: state, sleep: noSleep });

    expect(callCount).toBe(0);
    expect(result.evidenceBatchesCompleted).toBe(0);
    expect(result.snapshotBatchesCompleted).toBe(0);
    expect(result.interrupted).toBe(true);
  });
});

// --------------------------------------------------------------------------
// 9. Ctrl+C during evidence persistence
// --------------------------------------------------------------------------

describe("persistPhaseB — interrupt during evidence", () => {
  it("stops evidence batches and skips snapshots when interrupted after batch 1", async () => {
    const ev = Array.from({ length: 1000 }, (_, i) => makeEvidenceRow(i));
    const sn = Array.from({ length: 5 }, (_, i) => makeSnapshotRow(`p${i}`));
    const state = createInterruptState();
    const progresses: PhaseBProgress[] = [];
    let snapshotCalls = 0;

    const client: SupabaseBatchClient = {
      from: (table) => ({
        upsert: (rows) => ({
          select: () => {
            if (table === "player_context_snapshots") snapshotCalls++;
            return Promise.resolve(succeed(rows));
          },
        }),
      }),
    };

    const result = await persistPhaseB(client, ev, sn, {
      evidenceBatchSize: 500,
      snapshotBatchSize: 5,
      interruptState: state,
      sleep: noSleep,
      onProgress: (p) => {
        progresses.push(p);
        // Interrupt after first evidence batch
        if (p.table === "context_evidence" && p.batchNumber === 1) {
          state.triggered = true;
        }
      },
    });

    expect(result.evidenceBatchesCompleted).toBe(1);
    expect(result.interrupted).toBe(true);
    expect(snapshotCalls).toBe(0);  // snapshots never started
  });
});

// --------------------------------------------------------------------------
// 10. Ctrl+C during snapshot persistence
// --------------------------------------------------------------------------

describe("persistPhaseB — interrupt during snapshots", () => {
  it("completes all evidence, stops at first snapshot batch, returns interrupted=true", async () => {
    const ev = Array.from({ length: 5 }, (_, i) => makeEvidenceRow(i));
    const sn = Array.from({ length: 10 }, (_, i) => makeSnapshotRow(`p${i}`));
    const state = createInterruptState();
    const progresses: PhaseBProgress[] = [];

    const client: SupabaseBatchClient = {
      from: (table) => ({
        upsert: (rows) => ({
          select: () => {
            if (table === "player_context_snapshots") {
              state.triggered = true;  // trigger during snapshot processing
            }
            return Promise.resolve(succeed(rows));
          },
        }),
      }),
    };

    const result = await persistPhaseB(client, ev, sn, {
      evidenceBatchSize: 5,
      snapshotBatchSize: 5,
      interruptState: state,
      sleep: noSleep,
      onProgress: (p) => progresses.push(p),
    });

    expect(result.evidenceBatchesCompleted).toBe(1);
    expect(result.snapshotBatchesCompleted).toBe(1);  // completed the in-flight batch
    expect(result.interrupted).toBe(true);
    // Second snapshot batch never attempted
    const snapshotProgresses = progresses.filter((p) => p.table === "player_context_snapshots");
    expect(snapshotProgresses).toHaveLength(1);
  });
});

// --------------------------------------------------------------------------
// 11. Identical rerun → no duplicates (idempotency via ignoreDuplicates)
// --------------------------------------------------------------------------

describe("persistPhaseB — idempotency", () => {
  it("passes ignoreDuplicates=true so identical rerun produces 0 new rows", async () => {
    const ev = [makeEvidenceRow(1)];
    const sn = [makeSnapshotRow("p1")];
    const capturedOpts: Array<{ onConflict: string; ignoreDuplicates: boolean }> = [];

    const client: SupabaseBatchClient = {
      from: () => ({
        upsert: (_, opts) => {
          capturedOpts.push(opts as { onConflict: string; ignoreDuplicates: boolean });
          return { select: () => Promise.resolve({ data: [], error: null }) };
        },
      }),
    };

    await persistPhaseB(client, ev, sn, { sleep: noSleep });

    expect(capturedOpts[0]?.ignoreDuplicates).toBe(true);
    expect(capturedOpts[0]?.onConflict).toBe("evidence_id");
    expect(capturedOpts[1]?.ignoreDuplicates).toBe(true);
    expect(capturedOpts[1]?.onConflict).toBe("canonical_player_id,season,context_version");
  });

  it("retries the SAME batch rows (never advances row range on failure)", async () => {
    const ev = Array.from({ length: 3 }, (_, i) => makeEvidenceRow(i));
    const sn: SnapshotInsertRow[] = [];
    const capturedRowSets: string[][] = [];
    let callCount = 0;

    const client: SupabaseBatchClient = {
      from: () => ({
        upsert: (rows) => ({
          select: () => {
            callCount++;
            capturedRowSets.push(rows.map((r) => r["evidence_id"] as string));
            if (callCount === 1) return Promise.resolve(failWith("fetch failed"));
            return Promise.resolve(succeed(rows));
          },
        }),
      }),
    };

    await persistPhaseB(client, ev, sn, { sleep: noSleep, backoffMs: [0] });

    expect(capturedRowSets).toHaveLength(2);
    expect(capturedRowSets[0]).toEqual(capturedRowSets[1]);  // same rows retried
  });

  it("recovery: partial DB state followed by identical rerun — existing rows counted as existing", async () => {
    // Simulates: first run wrote 7 evidence rows, second run 3 already exist
    const ev = Array.from({ length: 10 }, (_, i) => makeEvidenceRow(i));
    const sn: SnapshotInsertRow[] = [];
    const progresses: PhaseBProgress[] = [];

    const { client } = makeMockClient([() => succeedWithN(3)]);  // 3 inserted, 7 already existed

    await persistPhaseB(client, ev, sn, {
      onProgress: (p) => progresses.push(p),
      sleep: noSleep,
    });

    expect(progresses[0]!.inserted).toBe(3);
    expect(progresses[0]!.existing).toBe(7);
    expect(progresses[0]!.attempted).toBe(10);
  });
});

// --------------------------------------------------------------------------
// 12. Counter accuracy
// --------------------------------------------------------------------------

describe("persistPhaseB — counter accuracy", () => {
  it("evidenceAttempted = sum of all evidence batch sizes", async () => {
    const ev = Array.from({ length: 1250 }, (_, i) => makeEvidenceRow(i));
    const sn: SnapshotInsertRow[] = [];
    const { client } = makeMockClient([
      (rows) => succeed(rows),
      (rows) => succeed(rows),
      (rows) => succeed(rows),
    ]);

    const result = await persistPhaseB(client, ev, sn, { evidenceBatchSize: 500, sleep: noSleep });

    expect(result.evidenceAttempted).toBe(1250);
    expect(result.evidenceBatchesCompleted).toBe(3);
  });

  it("snapshotAttempted and snapshotBatchesCompleted are 0 when interrupted before snapshots", async () => {
    const ev = [makeEvidenceRow(1)];
    const sn = [makeSnapshotRow("p1")];
    const state = createInterruptState();

    const { client } = makeMockClient([(rows) => { state.triggered = true; return succeed(rows); }]);

    const result = await persistPhaseB(client, ev, sn, { interruptState: state, sleep: noSleep });

    expect(result.snapshotAttempted).toBe(0);
    expect(result.snapshotBatchesCompleted).toBe(0);
  });
});

// --------------------------------------------------------------------------
// 13. inspectH8Persistence — paginated inspection
// --------------------------------------------------------------------------

// Simulate Supabase's .range() behaviour: return the slice of allRows for [from, to].
function makePaged<T>(allRows: T[]): (from: number, to: number) => Promise<{ data: T[]; error: null }> {
  return (from, to) => Promise.resolve({ data: allRows.slice(from, to + 1), error: null });
}

// Generate evidence player rows: playerCount players × perPlayer rows each.
function makeEvRows(playerCount: number, perPlayer: number): Array<{ player_id: string }> {
  const rows: Array<{ player_id: string }> = [];
  for (let p = 0; p < playerCount; p++) {
    for (let e = 0; e < perPlayer; e++) {
      rows.push({ player_id: `player-${p}` });
    }
  }
  return rows;
}

function makeSnRows(
  playerCount: number
): Array<{ canonical_player_id: string; context_version: number; as_of_date: string }> {
  return Array.from({ length: playerCount }, (_, i) => ({
    canonical_player_id: `player-${i}`,
    context_version: 1,
    as_of_date: "2026-06-14",
  }));
}

// Builds an InspectH8Opts with sensible defaults — override what you need.
function makeInspectOpts(
  override: Partial<InspectH8Opts> & {
    evidenceCount?: number;
    snapshotCount?: number;
    evidenceCountError?: { message: string; code?: string };
    snapshotCountError?: { message: string; code?: string };
  }
): InspectH8Opts {
  const {
    evidenceCount = 0,
    snapshotCount = 0,
    evidenceCountError,
    snapshotCountError,
    ...rest
  } = override;
  return {
    countEvidence: () =>
      Promise.resolve(
        evidenceCountError
          ? { count: null, error: evidenceCountError }
          : { count: evidenceCount, error: null }
      ),
    countSnapshots: () =>
      Promise.resolve(
        snapshotCountError
          ? { count: null, error: snapshotCountError }
          : { count: snapshotCount, error: null }
      ),
    pageEvidencePlayers: () => Promise.resolve({ data: [], error: null }),
    pageSnapshotPlayers: () => Promise.resolve({ data: [], error: null }),
    pageSize: 1000,
    ...rest,
  };
}

// Suppress unused-variable lint on the imported type — it is used for argument typing in tests.
void (undefined as unknown as EvidenceDistribution);

describe("inspectH8Persistence — paginated inspection", () => {
  it("loads all 4,744 evidence rows across 5 pages and reports correct counts", async () => {
    // 593 players × 8 evidence = 4,744 rows; pageSize=1000 → 5 pages (4×1000 + 744)
    const evRows = makeEvRows(593, 8);    // 4,744 rows
    const snRows = makeSnRows(593);

    const inspection = await inspectH8Persistence(
      makeInspectOpts({
        evidenceCount: 4744,
        snapshotCount: 593,
        pageEvidencePlayers: makePaged(evRows),
        pageSnapshotPlayers: makePaged(snRows),
        pageSize: 1000,
      })
    );

    expect(inspection.evidenceRows).toBe(4744);   // from exact count query
    expect(inspection.evidencePlayers).toBe(593); // from full paginated load
    expect(inspection.snapshotRows).toBe(593);
    expect(inspection.snapshotPlayers).toBe(593);
  });

  it("does not terminate loading when the first page is exactly 1,000 rows", async () => {
    // 1,500 distinct evidence player rows: page1=1000 rows (full), page2=500 rows (last)
    const evRows = Array.from({ length: 1500 }, (_, i) => ({ player_id: `player-${i}` }));

    const inspection = await inspectH8Persistence(
      makeInspectOpts({
        evidenceCount: 1500,
        snapshotCount: 0,
        pageEvidencePlayers: makePaged(evRows),
        pageSize: 1000,
      })
    );

    // Must load all 1,500 — not stop at the first full page of 1,000
    expect(inspection.evidencePlayers).toBe(1500);
  });

  it("reports COMPLETE=false when only 125 evidence players loaded vs 593 snapshot players", async () => {
    // Reproduces the original bug scenario: only 125 unique players visible from evidence
    // (equivalent to the old code returning 1,000 rows for 125 players × 8 evidence each).
    // Our new code paginates correctly, but this test proves that IF paginated data shows
    // only 125 evidence players against 593 snapshot players, complete is correctly false.
    const evRows = makeEvRows(125, 8); // 1,000 rows, 125 distinct players
    const snRows = makeSnRows(593);

    const inspection = await inspectH8Persistence(
      makeInspectOpts({
        evidenceCount: 1000,   // only 1,000 evidence rows
        snapshotCount: 593,
        pageEvidencePlayers: makePaged(evRows),
        pageSnapshotPlayers: makePaged(snRows),
        pageSize: 1000,
      })
    );

    expect(inspection.evidencePlayers).toBe(125);
    expect(inspection.snapshotPlayers).toBe(593);
    expect(inspection.playersWithSnapshotOnly).toBe(468); // 593 - 125
    expect(inspection.playersWithEvidenceOnly).toBe(0);
    expect(inspection.complete).toBe(false);
  });

  it("reports COMPLETE=true when 593 evidence players === 593 snapshot players with uniform distribution", async () => {
    const evRows = makeEvRows(593, 8); // uniform: every player has exactly 8 rows
    const snRows = makeSnRows(593);

    const inspection = await inspectH8Persistence(
      makeInspectOpts({
        evidenceCount: 4744,
        snapshotCount: 593,
        pageEvidencePlayers: makePaged(evRows),
        pageSnapshotPlayers: makePaged(snRows),
        pageSize: 1000,
      })
    );

    expect(inspection.complete).toBe(true);
    expect(inspection.playersWithEvidenceOnly).toBe(0);
    expect(inspection.playersWithSnapshotOnly).toBe(0);
    expect(inspection.evidenceDistribution?.playersBelowMode).toBe(0);
    expect(inspection.evidenceDistribution?.playersAboveMode).toBe(0);
  });

  it("detects partial evidence coverage — evidence-only players prevent COMPLETE", async () => {
    // 10 evidence players but only 8 snapshot players → 2 evidence-only, 0 snapshot-only
    const evRows = makeEvRows(10, 4);
    const snRows = makeSnRows(8); // only players 0–7

    const inspection = await inspectH8Persistence(
      makeInspectOpts({
        evidenceCount: 40,
        snapshotCount: 8,
        pageEvidencePlayers: makePaged(evRows),
        pageSnapshotPlayers: makePaged(snRows),
        pageSize: 1000,
      })
    );

    expect(inspection.playersWithEvidenceOnly).toBe(2);
    expect(inspection.playersWithSnapshotOnly).toBe(0);
    expect(inspection.complete).toBe(false);
  });

  it("reports distribution min/max/mode correctly and flags skew", async () => {
    // 4 players: 3 players have 8 rows each, 1 player has only 4 rows (below mode)
    const rows: Array<{ player_id: string }> = [
      ...Array.from({ length: 8 }, () => ({ player_id: "p0" })),
      ...Array.from({ length: 8 }, () => ({ player_id: "p1" })),
      ...Array.from({ length: 8 }, () => ({ player_id: "p2" })),
      ...Array.from({ length: 4 }, () => ({ player_id: "p3" })), // short player
    ];
    const snRows = makeSnRows(4);

    const inspection = await inspectH8Persistence(
      makeInspectOpts({
        evidenceCount: 28,
        snapshotCount: 4,
        pageEvidencePlayers: makePaged(rows),
        pageSnapshotPlayers: makePaged(snRows),
        pageSize: 1000,
      })
    );

    const d = inspection.evidenceDistribution!;
    expect(d.minPerPlayer).toBe(4);
    expect(d.maxPerPlayer).toBe(8);
    expect(d.modePerPlayer).toBe(8);     // 3 players at 8, only 1 at 4
    expect(d.playersAtMode).toBe(3);
    expect(d.playersBelowMode).toBe(1);  // p3 has only 4
    expect(d.playersAboveMode).toBe(0);
    expect(inspection.complete).toBe(false); // skewed distribution → not complete
  });

  it("reports tablesMissing and complete=false when count query errors", async () => {
    const inspection = await inspectH8Persistence(
      makeInspectOpts({
        evidenceCountError: { message: "relation does not exist", code: "42P01" },
        snapshotCount: 0,
      })
    );

    expect(inspection.tablesMissing).toContain("context_evidence");
    expect(inspection.evidenceRows).toBe(0);
    expect(inspection.complete).toBe(false);
  });
});
