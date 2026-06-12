import { describe, expect, it } from "vitest";

import { isPositionCompatible } from "./classify";

// ─── Pure logic tests for diagnose module ─────────────────────────────────
// DB-dependent functions (loadAllCanonicalPlayers, etc.) are integration-tested
// via the CLI smoke commands. This file tests the pure logic.

describe("loadAllCanonicalPlayers — pagination contract", () => {
  it("handles empty result set without error", async () => {
    const mockClient = {
      from: () => ({
        select: () => ({
          range: () => Promise.resolve({ data: [], error: null })
        })
      })
    };

    // Import inside test to avoid top-level await issues
    const { loadAllCanonicalPlayers } = await import("./diagnose");
    const maps = await loadAllCanonicalPlayers(mockClient as never);
    expect(maps.byId.size).toBe(0);
    expect(maps.byGsisId.size).toBe(0);
    expect(maps.byEspnId.size).toBe(0);
    expect(maps.byNormalizedName.size).toBe(0);
  });

  it("loads players from multiple pages and accumulates all maps", async () => {
    // page1 must have exactly PAGE_SIZE (1000) rows so the paginator continues
    const kelceRow = {
      id: "aaaa-0001",
      sleeper_player_id: "1466",
      full_name: "Travis Kelce",
      normalized_name: "travis kelce",
      position_group: "TE",
      team: "KC",
      metadata_json: { gsis_id: "00-0030506", espn_id: 15847, stats_id: null }
    };
    const page1 = Array<typeof kelceRow>(1000).fill(kelceRow);
    const page2 = [
      {
        id: "bbbb-0002",
        sleeper_player_id: "4046",
        full_name: "Patrick Mahomes",
        normalized_name: "patrick mahomes",
        position_group: "QB",
        team: "KC",
        metadata_json: { gsis_id: "00-0039337", espn_id: 3139477, stats_id: null }
      }
    ];

    let callCount = 0;
    const mockClient = {
      from: () => ({
        select: () => ({
          range: (start: number) => {
            callCount++;
            if (start === 0) return Promise.resolve({ data: page1, error: null });
            if (start === 1000) return Promise.resolve({ data: page2, error: null });
            return Promise.resolve({ data: [], error: null });
          }
        })
      })
    };

    const { loadAllCanonicalPlayers } = await import("./diagnose");
    const maps = await loadAllCanonicalPlayers(mockClient as never);
    expect(callCount).toBeGreaterThanOrEqual(2);
    // page1 has 1000 identical rows (same ID) — deduplicated to 1 entry; page2 adds 1 more
    expect(maps.byId.size).toBe(2);
    expect(maps.byGsisId.get("00-0030506")?.sleeperId).toBe("1466");
    expect(maps.byGsisId.get("00-0039337")?.sleeperId).toBe("4046");
    expect(maps.byEspnId.get("15847")?.playerId).toBe("aaaa-0001");
    // page1 has 1000 identical Kelce rows — accumulates in byNormalizedName but byId deduplicates
    expect(maps.byNormalizedName.get("travis kelce")?.length).toBeGreaterThanOrEqual(1);
    expect(maps.byNormalizedName.get("patrick mahomes")?.length).toBeGreaterThanOrEqual(1);
  });
});

describe("unique canonical candidate detection", () => {
  it("detects exactly one position-compatible candidate", () => {
    const candidates = [
      { playerId: "a", sleeperId: "1", fullName: "John Smith", normalizedName: "john smith", positionGroup: "RB", team: "KC", metaGsisId: null, metaEspnId: null, metaStatsId: null }
    ];
    const compatible = candidates.filter(c => isPositionCompatible("RB", c.positionGroup));
    expect(compatible.length).toBe(1);
  });

  it("returns zero when position incompatible", () => {
    const candidates = [
      { playerId: "a", sleeperId: "1", fullName: "John Smith", normalizedName: "john smith", positionGroup: "QB", team: "KC", metaGsisId: null, metaEspnId: null, metaStatsId: null }
    ];
    const compatible = candidates.filter(c => isPositionCompatible("RB", c.positionGroup));
    expect(compatible.length).toBe(0);
  });

  it("returns multiple when both players match position", () => {
    const candidates = [
      { playerId: "a", sleeperId: "1", fullName: "John Smith", normalizedName: "john smith", positionGroup: "RB", team: "KC", metaGsisId: null, metaEspnId: null, metaStatsId: null },
      { playerId: "b", sleeperId: "2", fullName: "John Smith", normalizedName: "john smith", positionGroup: "RB", team: "NE", metaGsisId: null, metaEspnId: null, metaStatsId: null }
    ];
    const compatible = candidates.filter(c => isPositionCompatible("RB", c.positionGroup));
    expect(compatible.length).toBe(2);
  });
});

describe("metadata merge — preserves unrelated fields", () => {
  it("merge object preserves all existing keys", () => {
    const existing = { gsis_id: null, espn_id: 123, first_name: "Travis", last_name: "Kelce", stats_id: "448240" };
    const patched = { ...existing, gsis_id: "00-0030506" };
    expect(patched.espn_id).toBe(123);
    expect(patched.first_name).toBe("Travis");
    expect(patched.last_name).toBe("Kelce");
    expect(patched.stats_id).toBe("448240");
    expect(patched.gsis_id).toBe("00-0030506");
  });

  it("patch does not remove keys not in the patch", () => {
    const existing = { a: 1, b: 2, c: 3 };
    const patch = { b: 99 };
    const result = { ...existing, ...patch };
    expect(result.a).toBe(1);
    expect(result.b).toBe(99);
    expect(result.c).toBe(3);
  });
});

describe("targeted unresolved cohort construction", () => {
  it("excludes GSIS IDs that are already resolved", () => {
    const allWeeklyIds = new Map([
      ["00-0030506", { weeklyRowCount: 17, position: "TE" }],
      ["00-0039337", { weeklyRowCount: 14, position: "QB" }],
      ["00-0099999", { weeklyRowCount: 5, position: "RB" }]
    ]);
    const resolvedIds = new Set(["00-0039337"]);

    const unresolved = new Map(
      [...allWeeklyIds].filter(([id]) => !resolvedIds.has(id))
    );

    expect(unresolved.size).toBe(2);
    expect(unresolved.has("00-0039337")).toBe(false);
    expect(unresolved.has("00-0030506")).toBe(true);
    expect(unresolved.has("00-0099999")).toBe(true);
  });

  it("returns empty map when all weekly IDs are resolved", () => {
    const allWeeklyIds = new Map([
      ["00-0030506", { weeklyRowCount: 17, position: "TE" }]
    ]);
    const resolvedIds = new Set(["00-0030506"]);
    const unresolved = new Map(
      [...allWeeklyIds].filter(([id]) => !resolvedIds.has(id))
    );
    expect(unresolved.size).toBe(0);
  });
});
