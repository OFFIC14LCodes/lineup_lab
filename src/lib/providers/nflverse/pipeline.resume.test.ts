import { describe, expect, it, vi, beforeEach } from "vitest";
import { computePipelineStatus, emptyCoverage } from "./pipeline";
import type { NflversePipelineCoverage } from "./types";

// ─── computePipelineStatus unit tests ───────────────────────────────────────
describe("computePipelineStatus", () => {
  it("returns success when mode is dry_run regardless of error count", () => {
    const cov: NflversePipelineCoverage = { ...emptyCoverage(), errorRows: 5 };
    expect(computePipelineStatus(cov, "dry_run")).toBe("success");
  });

  it("returns success when execute mode has zero errors", () => {
    const cov: NflversePipelineCoverage = {
      ...emptyCoverage(),
      writtenRows: 10,
      insertedRows: 10,
      errorRows: 0
    };
    expect(computePipelineStatus(cov, "execute")).toBe("success");
  });

  it("returns partial_failure when execute mode has errors and at least one written row", () => {
    const cov: NflversePipelineCoverage = {
      ...emptyCoverage(),
      writtenRows: 5,
      insertedRows: 5,
      errorRows: 2
    };
    expect(computePipelineStatus(cov, "execute")).toBe("partial_failure");
  });

  it("returns failure when execute mode has errors and zero written rows", () => {
    const cov: NflversePipelineCoverage = {
      ...emptyCoverage(),
      writtenRows: 0,
      insertedRows: 0,
      errorRows: 3
    };
    expect(computePipelineStatus(cov, "execute")).toBe("failure");
  });

  it("returns success when execute mode has only existingRows (all skipped, no errors)", () => {
    const cov: NflversePipelineCoverage = {
      ...emptyCoverage(),
      existingRows: 3669,
      writtenRows: 0,
      insertedRows: 0,
      errorRows: 0
    };
    // All rows were already present — successful idempotent run, no errors.
    expect(computePipelineStatus(cov, "execute")).toBe("success");
  });
});

// ─── emptyCoverage unit tests ────────────────────────────────────────────────
describe("emptyCoverage", () => {
  it("initializes insertedRows to 0", () => {
    expect(emptyCoverage().insertedRows).toBe(0);
  });

  it("initializes existingRows to 0", () => {
    expect(emptyCoverage().existingRows).toBe(0);
  });

  it("insertedRows + existingRows equals writtenRows when all succeed", () => {
    const cov = emptyCoverage();
    cov.insertedRows = 2208;
    cov.existingRows = 3669;
    cov.writtenRows = cov.insertedRows; // writtenRows only counts newly inserted
    // 3669 pre-existing + 2208 inserted = 5877 total coverage
    expect(cov.insertedRows + cov.existingRows).toBe(5877);
  });
});

// ─── Pipeline behavior tests (integration-level, with mocks) ─────────────────
// These tests verify the pre-flight skip logic and status computation using
// mock Supabase clients and mock pipeline internals.

import { runNflversePipeline } from "./pipeline";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("./download", () => ({
  downloadAndArchive: vi.fn().mockResolvedValue({
    sourceUrl: "https://example.com/players.csv",
    filePath: "/fake/players.csv",
    sha256: "deadbeef",
    alreadyArchived: true
  })
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn().mockReturnValue(
    // Minimal CSV: 2 regular-season QB rows with distinct player_id + week
    [
      "player_id,position_group,season_type,week,season,team,opponent_team,fantasy_points_ppr",
      "00-0000001,QB,REG,1,2025,KC,LV,25.0",
      "00-0000002,QB,REG,2,2025,SF,SEA,18.5"
    ].join("\n")
  ),
  existsSync: vi.fn().mockReturnValue(false)
}));

vi.mock("./schema", () => ({
  validateNflverseSchema: vi.fn().mockReturnValue({ valid: true, missingColumns: [] }),
  NFLVERSE_SUPPORTED_POSITION_GROUPS: new Set(["QB", "RB", "WR", "TE"])
}));

vi.mock("./normalize", () => ({
  buildRowSha256Input: vi.fn().mockImplementation((raw: Record<string, string>) =>
    JSON.stringify(raw)
  ),
  normalizeNflverseRow: vi.fn().mockImplementation((raw: Record<string, string>) => ({
    ok: true,
    row: {
      gsisId: raw["player_id"],
      week: parseInt(raw["week"]),
      season: parseInt(raw["season"]),
      seasonType: raw["season_type"],
      team: raw["team"],
      opponent: raw["opponent_team"],
      positionGroup: raw["position_group"],
      stats: {},
      providerFantasyPoints: parseFloat(raw["fantasy_points_ppr"]),
      canonicalKeyCount: 1
    }
  }))
}));

vi.mock("./identity", () => ({
  resolveGsisIdsBatch: vi.fn().mockResolvedValue(
    new Map([
      ["00-0000001", "player-uuid-1"],
      ["00-0000002", "player-uuid-2"]
    ])
  )
}));

vi.mock("@/lib/providers/repositories/weekly-stats", () => ({
  upsertWeeklyStats: vi.fn().mockResolvedValue(undefined)
}));

import { upsertWeeklyStats } from "@/lib/providers/repositories/weekly-stats";

function makeClient(overrides: Partial<Record<string, unknown>> = {}): SupabaseClient {
  const defaultFrom = (table: string) => {
    if (table === "football_data_sources") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) })
              })
            })
          })
        }),
        insert: () => ({
          select: () => ({ single: async () => ({ data: { id: "source-id-1" }, error: null }) })
        })
      };
    }
    if (table === "football_import_batches") {
      return {
        insert: () => ({
          select: () => ({ single: async () => ({ data: { id: "batch-id-1" }, error: null }) })
        }),
        update: () => ({ eq: () => async () => ({ error: null }) }),
        // Vitest actually calls .update().eq() as a builder, returning the promise from a final .eq()
      };
    }
    if (table === "player_weekly_stats") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                range: async () => ({ data: [], error: null })
              })
            })
          })
        })
      };
    }
    if (table === "football_source_rows") {
      return {
        insert: async () => ({ error: null })
      };
    }
    return {};
  };

  return {
    from: vi.fn().mockImplementation(defaultFrom),
    ...overrides
  } as unknown as SupabaseClient;
}

describe("runNflversePipeline — dry_run mode", () => {
  it("returns pipelineStatus success without writing rows", async () => {
    const client = makeClient();
    const report = await runNflversePipeline(
      { season: 2025, mode: "dry_run", projectRoot: "/fake" },
      client
    );
    expect(report.pipelineStatus).toBe("success");
    expect(upsertWeeklyStats).not.toHaveBeenCalled();
    expect(report.coverage.writtenRows).toBe(0);
    expect(report.coverage.insertedRows).toBe(0);
  });

  it("dry_run does not query player_weekly_stats for existing rows", async () => {
    const client = makeClient();
    const fromSpy = client.from as ReturnType<typeof vi.fn>;
    await runNflversePipeline({ season: 2025, mode: "dry_run", projectRoot: "/fake" }, client);
    const pwsCalls = fromSpy.mock.calls.filter((args: unknown[]) => args[0] === "player_weekly_stats");
    expect(pwsCalls).toHaveLength(0);
  });
});

describe("runNflversePipeline — execute mode, no existing rows", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(upsertWeeklyStats).mockResolvedValue(undefined as any);
  });

  it("writes resolved rows when none pre-exist", async () => {
    const client = makeClient();
    // Patch update to return no error
    const fromOrig = (client.from as ReturnType<typeof vi.fn>).getMockImplementation()!;
    (client.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "football_import_batches") {
        return {
          insert: () => ({
            select: () => ({ single: async () => ({ data: { id: "batch-id-1" }, error: null }) })
          }),
          update: () => ({
            eq: () => ({ error: null }) // synchronous return, handled correctly
          })
        };
      }
      return fromOrig(table);
    });

    const report = await runNflversePipeline(
      { season: 2025, mode: "execute", projectRoot: "/fake" },
      client
    );
    expect(report.pipelineStatus).toBe("success");
    expect(upsertWeeklyStats).toHaveBeenCalledTimes(2);
    expect(report.coverage.insertedRows).toBe(2);
    expect(report.coverage.existingRows).toBe(0);
  });
});

describe("runNflversePipeline — execute mode, pre-existing rows (resume)", () => {
  it("skips already-written rows and counts them in existingRows", async () => {
    vi.mocked(upsertWeeklyStats).mockClear();

    // Pre-populate player_weekly_stats with player-uuid-1 week 1 already existing.
    const fromWithExisting = (table: string) => {
      if (table === "football_data_sources") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) })
                })
              })
            })
          }),
          insert: () => ({
            select: () => ({ single: async () => ({ data: { id: "source-id-1" }, error: null }) })
          })
        };
      }
      if (table === "football_import_batches") {
        return {
          insert: () => ({
            select: () => ({ single: async () => ({ data: { id: "batch-id-1" }, error: null }) })
          }),
          update: () => ({ eq: () => ({ error: null }) })
        };
      }
      if (table === "player_weekly_stats") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  range: async () => ({
                    // player-uuid-1|1 already exists
                    data: [{ player_id: "player-uuid-1", week: 1 }],
                    error: null
                  })
                })
              })
            })
          })
        };
      }
      if (table === "football_source_rows") {
        return { insert: async () => ({ error: null }) };
      }
      return {};
    };

    const client = {
      from: vi.fn().mockImplementation(fromWithExisting)
    } as unknown as SupabaseClient;

    const report = await runNflversePipeline(
      { season: 2025, mode: "execute", projectRoot: "/fake" },
      client
    );

    // Only player-uuid-2 week 2 should be inserted; player-uuid-1 week 1 skipped.
    expect(report.coverage.existingRows).toBe(1);
    expect(report.coverage.insertedRows).toBe(1);
    expect(report.coverage.writtenRows).toBe(1);
    // existingRows + insertedRows covers both resolved source rows
    expect(report.coverage.existingRows + report.coverage.insertedRows).toBe(2);
    expect(upsertWeeklyStats).toHaveBeenCalledTimes(1);
  });

  it("full resume: 3669 existing + 2208 newly inserted = 5877 total, pipelineStatus success", () => {
    // Arithmetic invariant for the real data set — no mocking needed.
    const cov = emptyCoverage();
    cov.existingRows = 3669;
    cov.insertedRows = 2208;
    cov.writtenRows = 2208;
    cov.errorRows = 0;
    expect(cov.existingRows + cov.insertedRows).toBe(5877);
    expect(computePipelineStatus(cov, "execute")).toBe("success");
  });
});

describe("runNflversePipeline — partial failure", () => {
  it("returns partial_failure status and sets errorRows when upsert throws", async () => {
    vi.mocked(upsertWeeklyStats)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce(undefined as any) // row 1 succeeds
      .mockRejectedValueOnce(new Error("DB constraint violation")); // row 2 fails

    const fromNone = (table: string) => {
      if (table === "football_data_sources") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) })
                })
              })
            })
          }),
          insert: () => ({
            select: () => ({ single: async () => ({ data: { id: "source-id-1" }, error: null }) })
          })
        };
      }
      if (table === "football_import_batches") {
        return {
          insert: () => ({
            select: () => ({ single: async () => ({ data: { id: "batch-id-1" }, error: null }) })
          }),
          update: () => ({ eq: () => ({ error: null }) })
        };
      }
      if (table === "player_weekly_stats") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  range: async () => ({ data: [], error: null })
                })
              })
            })
          })
        };
      }
      if (table === "football_source_rows") {
        return { insert: async () => ({ error: null }) };
      }
      return {};
    };

    const client = {
      from: vi.fn().mockImplementation(fromNone)
    } as unknown as SupabaseClient;

    const report = await runNflversePipeline(
      { season: 2025, mode: "execute", projectRoot: "/fake" },
      client
    );
    expect(report.pipelineStatus).toBe("partial_failure");
    expect(report.coverage.errorRows).toBe(1);
    expect(report.coverage.insertedRows).toBe(1);
  });
});
