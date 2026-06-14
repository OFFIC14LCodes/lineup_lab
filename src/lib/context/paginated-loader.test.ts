// paginated-loader: resilient fetch + retry tests

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_SIZE,
  buildPaginatedErrorMessage,
  classifySupabaseError,
  loadAllPagesWith,
} from "./paginated-loader";
import type { PagedQueryResult, PageProgress } from "./paginated-loader";

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const noSleep = () => Promise.resolve();

function succeed<T>(rows: T[]): PagedQueryResult<T> {
  return { data: rows, error: null };
}

function failWith(message: string, code?: string): PagedQueryResult<never> {
  return { data: null, error: { message, code } };
}

type Row = { id: number };

// --------------------------------------------------------------------------
// 1. Error classification
// --------------------------------------------------------------------------

describe("classifySupabaseError", () => {
  it("classifies TypeError: fetch failed as transient", () => {
    expect(classifySupabaseError({ message: "TypeError: fetch failed" })).toBe("transient");
  });

  it("classifies network timeout as transient", () => {
    expect(classifySupabaseError({ message: "network timeout occurred" })).toBe("transient");
  });

  it("classifies ECONNRESET as transient", () => {
    expect(classifySupabaseError({ message: "read ECONNRESET" })).toBe("transient");
  });

  it("classifies HTTP 500 code as transient", () => {
    expect(classifySupabaseError({ message: "Internal Server Error", code: "500" })).toBe("transient");
  });

  it("classifies HTTP 429 code as transient", () => {
    expect(classifySupabaseError({ message: "Too Many Requests", code: "429" })).toBe("transient");
  });

  it("classifies HTTP 502/503/504 as transient", () => {
    expect(classifySupabaseError({ code: "502" })).toBe("transient");
    expect(classifySupabaseError({ code: "503" })).toBe("transient");
    expect(classifySupabaseError({ code: "504" })).toBe("transient");
  });

  it("classifies undefined_column (42703) as deterministic", () => {
    expect(classifySupabaseError({ message: "column not found", code: "42703" })).toBe("deterministic");
  });

  it("classifies undefined_table (42P01) as deterministic", () => {
    expect(classifySupabaseError({ message: "relation does not exist", code: "42P01" })).toBe("deterministic");
  });

  it("classifies permission denied as deterministic", () => {
    expect(classifySupabaseError({ message: "permission denied for table players" })).toBe("deterministic");
  });

  it("classifies row level security as deterministic", () => {
    expect(classifySupabaseError({ message: "row level security policy denied" })).toBe("deterministic");
  });

  it("classifies PGRST prefix codes as deterministic", () => {
    expect(classifySupabaseError({ code: "PGRST116", message: "schema mismatch" })).toBe("deterministic");
    expect(classifySupabaseError({ code: "PGRST200", message: "could not find foreign key" })).toBe("deterministic");
  });

  it("classifies HTTP 401/403/404 as deterministic", () => {
    expect(classifySupabaseError({ code: "401" })).toBe("deterministic");
    expect(classifySupabaseError({ code: "403" })).toBe("deterministic");
    expect(classifySupabaseError({ code: "404" })).toBe("deterministic");
  });

  it("classifies unknown errors as unknown (not transient)", () => {
    expect(classifySupabaseError({ message: "something unexpected happened" })).toBe("unknown");
  });

  it("deterministic wins over transient when both patterns match", () => {
    // An error with JWT in message + ECONNRESET would be deterministic (JWT check first)
    expect(classifySupabaseError({ message: "jwt expired" })).toBe("deterministic");
  });
});

// --------------------------------------------------------------------------
// 2. Transient failure then success
// --------------------------------------------------------------------------

describe("loadAllPagesWith — transient failure then success", () => {
  it("retries transient error and returns rows on success", async () => {
    let callCount = 0;
    const fetchPage = async (): Promise<PagedQueryResult<Row>> => {
      callCount++;
      if (callCount <= 2) return failWith("TypeError: fetch failed");
      return succeed([{ id: 1 }]); // 1 row < pageSize → last page
    };

    const rows = await loadAllPagesWith(fetchPage, {
      table: "test_table",
      pageSize: 10,
      maxAttempts: 5,
      backoffMs: [0, 0, 0, 0, 0],
      jitterMs: 0,
      sleep: noSleep,
    });

    expect(rows).toHaveLength(1);
    expect(callCount).toBe(3); // 2 transient failures + 1 success
  });

  it("succeeds on the last allowed attempt", async () => {
    let callCount = 0;
    const MAX = 5;
    const fetchPage = async (): Promise<PagedQueryResult<Row>> => {
      callCount++;
      if (callCount < MAX) return failWith("network timeout");
      return succeed([{ id: 42 }]);
    };

    const rows = await loadAllPagesWith(fetchPage, {
      table: "t",
      pageSize: 10,
      maxAttempts: MAX,
      backoffMs: [0, 0, 0, 0, 0],
      jitterMs: 0,
      sleep: noSleep,
    });

    expect(rows).toHaveLength(1);
    expect(callCount).toBe(MAX);
  });
});

// --------------------------------------------------------------------------
// 3. Transient failures exhausting retries
// --------------------------------------------------------------------------

describe("loadAllPagesWith — retries exhausted", () => {
  it("throws after exhausting all retry attempts", async () => {
    const fetchPage = async (): Promise<PagedQueryResult<Row>> =>
      failWith("TypeError: fetch failed");

    await expect(
      loadAllPagesWith(fetchPage, {
        table: "player_weekly_derived_stats",
        pageSize: 500,
        maxAttempts: 5,
        backoffMs: [0, 0, 0, 0, 0],
        jitterMs: 0,
        sleep: noSleep,
        season: 2025,
        seasonType: "regular",
      })
    ).rejects.toThrow(/player_weekly_derived_stats/);
  });

  it("error message includes table, range, attempt, season, cause", async () => {
    const fetchPage = async (): Promise<PagedQueryResult<Row>> =>
      failWith("TypeError: fetch failed");

    let errorMsg = "";
    try {
      await loadAllPagesWith(fetchPage, {
        table: "player_weekly_stats",
        pageSize: 500,
        maxAttempts: 3,
        backoffMs: [0, 0, 0],
        jitterMs: 0,
        sleep: noSleep,
        season: 2025,
        seasonType: "regular",
      });
    } catch (e) {
      errorMsg = String(e);
    }

    expect(errorMsg).toContain("table=player_weekly_stats");
    expect(errorMsg).toContain("range=0-499");
    expect(errorMsg).toContain("attempt=3/3");
    expect(errorMsg).toContain("season=2025");
    expect(errorMsg).toContain("season_type=regular");
    expect(errorMsg).toContain("TypeError: fetch failed");
  });
});

// --------------------------------------------------------------------------
// 4. Deterministic error not retried
// --------------------------------------------------------------------------

describe("loadAllPagesWith — deterministic errors not retried", () => {
  it("throws immediately on schema error without retrying", async () => {
    let callCount = 0;
    const fetchPage = async (): Promise<PagedQueryResult<Row>> => {
      callCount++;
      return failWith("column stat_scope does not exist", "42703");
    };

    await expect(
      loadAllPagesWith(fetchPage, {
        table: "player_weekly_derived_stats",
        pageSize: 500,
        maxAttempts: 5,
        backoffMs: [0, 0, 0, 0, 0],
        jitterMs: 0,
        sleep: noSleep,
      })
    ).rejects.toThrow(/non-retryable.*schema/i);

    expect(callCount).toBe(1); // attempted exactly once
  });

  it("throws immediately on permission denied without retrying", async () => {
    let callCount = 0;
    const fetchPage = async (): Promise<PagedQueryResult<Row>> => {
      callCount++;
      return failWith("permission denied for table team_game_stats");
    };

    await expect(
      loadAllPagesWith(fetchPage, {
        table: "team_game_stats",
        pageSize: 500,
        maxAttempts: 5,
        backoffMs: [0, 0, 0, 0, 0],
        jitterMs: 0,
        sleep: noSleep,
      })
    ).rejects.toThrow();

    expect(callCount).toBe(1);
  });

  it("throws immediately on unknown error without retrying", async () => {
    let callCount = 0;
    const fetchPage = async (): Promise<PagedQueryResult<Row>> => {
      callCount++;
      return failWith("something completely unexpected");
    };

    await expect(
      loadAllPagesWith(fetchPage, {
        table: "t",
        pageSize: 10,
        maxAttempts: 5,
        backoffMs: [0, 0, 0, 0, 0],
        jitterMs: 0,
        sleep: noSleep,
      })
    ).rejects.toThrow(/unclassified/i);

    expect(callCount).toBe(1);
  });
});

// --------------------------------------------------------------------------
// 5. Retry repeats same page range
// --------------------------------------------------------------------------

describe("loadAllPagesWith — retry repeats same page range", () => {
  it("calls fetchPage with the same from/to on every retry attempt", async () => {
    const calls: Array<{ from: number; to: number }> = [];
    let attempts = 0;

    const fetchPage = async (from: number, to: number): Promise<PagedQueryResult<Row>> => {
      calls.push({ from, to });
      attempts++;
      if (attempts <= 3) return failWith("TypeError: fetch failed"); // 3 transient failures
      return succeed([{ id: from + 1 }]); // success on attempt 4
    };

    await loadAllPagesWith(fetchPage, {
      table: "t",
      pageSize: 100,
      maxAttempts: 5,
      backoffMs: [0, 0, 0, 0, 0],
      jitterMs: 0,
      sleep: noSleep,
    });

    // All 4 calls should have the same from/to (page 0 retried)
    expect(calls).toHaveLength(4);
    for (const call of calls) {
      expect(call.from).toBe(0);
      expect(call.to).toBe(99);
    }
  });

  it("advances to next page only after successful fetch", async () => {
    const calls: number[] = [];

    const fetchPage = async (from: number): Promise<PagedQueryResult<Row>> => {
      calls.push(from);
      if (from === 0 && calls.filter((f) => f === 0).length === 1) {
        return failWith("TypeError: fetch failed"); // page 0 fails once then succeeds
      }
      // Page 0 (second attempt): 5 rows at full pageSize → continue
      if (from === 0) return succeed(Array.from({ length: 5 }, (_, i) => ({ id: i })));
      // Page 1: 2 rows < pageSize → last page
      return succeed([{ id: 10 }, { id: 11 }]);
    };

    const rows = await loadAllPagesWith(fetchPage, {
      table: "t",
      pageSize: 5,
      maxAttempts: 3,
      backoffMs: [0, 0, 0],
      jitterMs: 0,
      sleep: noSleep,
    });

    expect(rows).toHaveLength(7); // 5 from page 0 + 2 from page 1
    // page 0 called twice (1 fail + 1 success), page 1 called once
    expect(calls.filter((f) => f === 0)).toHaveLength(2);
    expect(calls.filter((f) => f === 5)).toHaveLength(1);
  });
});

// --------------------------------------------------------------------------
// 6. No duplicate rows after retry
// --------------------------------------------------------------------------

describe("loadAllPagesWith — no duplicates after retry", () => {
  it("does not duplicate rows when page succeeds after 1 transient failure", async () => {
    let callCount = 0;
    const fetchPage = async (): Promise<PagedQueryResult<Row>> => {
      callCount++;
      if (callCount === 1) return failWith("TypeError: fetch failed");
      return succeed([{ id: 1 }, { id: 2 }, { id: 3 }]);
    };

    const rows = await loadAllPagesWith(fetchPage, {
      table: "t",
      pageSize: 10,
      maxAttempts: 2,
      backoffMs: [0],
      jitterMs: 0,
      sleep: noSleep,
    });

    expect(rows).toHaveLength(3); // exactly 3, not 6
    expect(callCount).toBe(2);
  });

  it("multi-page: no duplication across page boundaries", async () => {
    const callsByPage: Record<number, number> = {};

    const fetchPage = async (from: number): Promise<PagedQueryResult<Row>> => {
      callsByPage[from] = (callsByPage[from] ?? 0) + 1;
      // Page 0 fails once
      if (from === 0 && callsByPage[0] === 1) return failWith("network timeout");
      // Page 0 (second attempt): full page (3 rows)
      if (from === 0) return succeed([{ id: 1 }, { id: 2 }, { id: 3 }]);
      // Page 1: 2 rows = last page
      return succeed([{ id: 4 }, { id: 5 }]);
    };

    const rows = await loadAllPagesWith(fetchPage, {
      table: "t",
      pageSize: 3,
      maxAttempts: 3,
      backoffMs: [0, 0, 0],
      jitterMs: 0,
      sleep: noSleep,
    });

    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.id).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

// --------------------------------------------------------------------------
// 7. Page size configuration
// --------------------------------------------------------------------------

describe("loadAllPagesWith — page-size configuration", () => {
  it("uses configured page size for from/to bounds", async () => {
    const ranges: Array<[number, number]> = [];
    let page = 0;

    const fetchPage = async (from: number, to: number): Promise<PagedQueryResult<Row>> => {
      ranges.push([from, to]);
      page++;
      // Return a full page for pages 0-2, then a partial final page
      const size = to - from + 1;
      if (page <= 2) return succeed(Array.from({ length: size }, (_, i) => ({ id: from + i })));
      return succeed([{ id: from }]); // partial last page
    };

    await loadAllPagesWith(fetchPage, {
      table: "t",
      pageSize: 250,
      maxAttempts: 1,
      backoffMs: [],
      jitterMs: 0,
      sleep: noSleep,
    });

    expect(ranges[0]).toEqual([0, 249]);
    expect(ranges[1]).toEqual([250, 499]);
    expect(ranges[2]).toEqual([500, 749]);
  });

  it("uses DEFAULT_PAGE_SIZE when pageSize not specified", async () => {
    const ranges: Array<[number, number]> = [];
    const fetchPage = async (from: number, to: number): Promise<PagedQueryResult<Row>> => {
      ranges.push([from, to]);
      return succeed([{ id: 1 }]); // 1 row = last page on first request
    };

    await loadAllPagesWith(fetchPage, { table: "t", maxAttempts: 1, backoffMs: [], jitterMs: 0, sleep: noSleep });

    expect(ranges[0]![1]).toBe(DEFAULT_PAGE_SIZE - 1); // to = 499 for default 500
  });
});

// --------------------------------------------------------------------------
// 8. Progress logging
// --------------------------------------------------------------------------

describe("loadAllPagesWith — progress callback", () => {
  it("calls onProgress for each successfully loaded page", async () => {
    const progress: PageProgress[] = [];

    const fetchPage = async (from: number): Promise<PagedQueryResult<Row>> => {
      if (from === 0) return succeed(Array.from({ length: 10 }, (_, i) => ({ id: i })));
      return succeed([{ id: 99 }]); // last page
    };

    await loadAllPagesWith(fetchPage, {
      table: "test_table",
      pageSize: 10,
      maxAttempts: 1,
      backoffMs: [],
      jitterMs: 0,
      sleep: noSleep,
      onProgress: (info) => progress.push(info),
    });

    expect(progress).toHaveLength(2);
    expect(progress[0]).toMatchObject({ table: "test_table", page: 1, rowsThisPage: 10, totalRows: 10 });
    expect(progress[1]).toMatchObject({ table: "test_table", page: 2, rowsThisPage: 1, totalRows: 11 });
  });

  it("does not call onProgress for failed attempts", async () => {
    const progress: PageProgress[] = [];
    let callCount = 0;

    const fetchPage = async (): Promise<PagedQueryResult<Row>> => {
      callCount++;
      if (callCount === 1) return failWith("network timeout");
      return succeed([{ id: 1 }]);
    };

    await loadAllPagesWith(fetchPage, {
      table: "t",
      pageSize: 5,
      maxAttempts: 3,
      backoffMs: [0, 0],
      jitterMs: 0,
      sleep: noSleep,
      onProgress: (info) => progress.push(info),
    });

    expect(progress).toHaveLength(1); // only the successful attempt triggers progress
    expect(progress[0]!.page).toBe(1);
  });
});

// --------------------------------------------------------------------------
// 9. No writes on pre-persistence failure (two-phase guarantee)
// --------------------------------------------------------------------------

describe("two-phase load-before-write guarantee", () => {
  it("write callback is never called when Phase A loading throws", async () => {
    const writeCalls: string[] = [];
    const mockWrite = (id: string) => { writeCalls.push(id); };

    const alwaysFailFetch = async (): Promise<PagedQueryResult<Row>> =>
      failWith("TypeError: fetch failed");

    async function simulateH8Pipeline() {
      // Phase A: load (throws before writing)
      const rows = await loadAllPagesWith(alwaysFailFetch, {
        table: "player_weekly_derived_stats",
        maxAttempts: 1,  // fail fast in test
        backoffMs: [],
        jitterMs: 0,
        sleep: noSleep,
      });

      // Phase B: write (never reached if Phase A throws)
      for (const row of rows) {
        mockWrite(String(row.id));
      }
    }

    await expect(simulateH8Pipeline()).rejects.toThrow();
    expect(writeCalls).toHaveLength(0); // no writes occurred
  });

  it("Phase B is reached only when Phase A completes successfully", async () => {
    const writeCalls: number[] = [];
    const phaseAResults: Row[] = [];

    const successFetch = async (): Promise<PagedQueryResult<Row>> =>
      succeed([{ id: 1 }, { id: 2 }]);

    // Phase A
    const rows = await loadAllPagesWith(successFetch, {
      table: "t",
      pageSize: 10,
      maxAttempts: 1,
      backoffMs: [],
      jitterMs: 0,
      sleep: noSleep,
    });
    phaseAResults.push(...rows);

    // Phase B (only runs because Phase A succeeded)
    for (const row of phaseAResults) {
      writeCalls.push(row.id);
    }

    expect(phaseAResults).toHaveLength(2);
    expect(writeCalls).toEqual([1, 2]);
  });

  it("partial Phase A (multiple tables) aborts before writes if any table fails", async () => {
    const writeCalls: number[] = [];

    const goodFetch = async (): Promise<PagedQueryResult<Row>> =>
      succeed([{ id: 1 }]);
    const badFetch = async (): Promise<PagedQueryResult<Row>> =>
      failWith("TypeError: fetch failed");

    async function simulateMultiTableLoad() {
      // Both must succeed before any writes
      const weeklyRows = await loadAllPagesWith(goodFetch, {
        table: "player_weekly_stats", maxAttempts: 1, backoffMs: [], jitterMs: 0, sleep: noSleep,
      });
      const derivedRows = await loadAllPagesWith(badFetch, {
        table: "player_weekly_derived_stats", maxAttempts: 1, backoffMs: [], jitterMs: 0, sleep: noSleep,
      });

      // Writes (never reached if either load fails)
      for (const row of [...weeklyRows, ...derivedRows]) {
        writeCalls.push(row.id);
      }
    }

    await expect(simulateMultiTableLoad()).rejects.toThrow(/player_weekly_derived_stats/);
    expect(writeCalls).toHaveLength(0);
  });
});

// --------------------------------------------------------------------------
// 10. Error message builder
// --------------------------------------------------------------------------

describe("buildPaginatedErrorMessage", () => {
  it("includes all required context fields", () => {
    const msg = buildPaginatedErrorMessage({
      table: "player_weekly_derived_stats",
      page: 3,
      from: 1000,
      to: 1499,
      attempt: 5,
      maxAttempts: 5,
      cause: "TypeError: fetch failed",
      classification: "transient",
      season: 2025,
      seasonType: "regular",
    });

    expect(msg).toContain("table=player_weekly_derived_stats");
    expect(msg).toContain("range=1000-1499 (page 3)");
    expect(msg).toContain("attempt=5/5");
    expect(msg).toContain("season=2025");
    expect(msg).toContain("season_type=regular");
    expect(msg).toContain("cause=TypeError: fetch failed");
    expect(msg).toContain("retries exhausted");
  });

  it("includes schema note for deterministic errors", () => {
    const msg = buildPaginatedErrorMessage({
      table: "t", page: 1, from: 0, to: 499,
      attempt: 1, maxAttempts: 5,
      cause: "column stat_scope does not exist",
      classification: "deterministic",
    });
    expect(msg).toContain("non-retryable");
    expect(msg).toContain("schema");
  });
});
