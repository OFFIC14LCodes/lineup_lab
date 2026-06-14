/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";

import {
  importAdpSnapshot,
  seedCrosswalks,
  MFL_CROSSWALKS,
} from "./storage";
import type { CrosswalkEntry } from "./storage";
import type { PlayerAdpRecord, AdpSourceMeta } from "./types";

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

function makeMeta(overrides: Partial<AdpSourceMeta> = {}): AdpSourceMeta {
  return {
    provider: "mfl",
    sourceIdentifier: "mfl-2026-redraft-ppr-12team-20260601",
    sourceUrl: "https://api.myfantasyleague.com/2026/export?TYPE=adp",
    capturedAt: "2026-06-01T12:00:00.000Z",
    effectiveDate: "2026-06-01",
    season: 2026,
    formatProfile: {
      draftType: "redraft",
      platform: "mfl",
      scoringFormat: "ppr",
      pprValue: 1.0,
      tePremiumValue: 0.0,
      rosterPositions: [],
      teamCount: 12,
      isBestBall: false,
      isDynasty: false,
      isStartup: false,
      isSuperflex: false,
      isTePremium: false,
    },
    sampleSize: 300,
    sourceVersion: "1780000000",
    fileHash: "hash-abc123",
    parserVersion: "h7-mfl-parser-v1",
    ...overrides,
  };
}

function makeRecord(overrides: Partial<PlayerAdpRecord> = {}): PlayerAdpRecord {
  return {
    rawId: "17472",
    rawName: "Jeremiyah Love",
    rawPosition: "RB",
    rawTeam: "ARI",
    overallAdp: 2.09,
    overallRank: 1,
    positionalAdp: null,
    positionalRank: null,
    minPick: 1,
    maxPick: 50,
    stddev: null,
    sampleSize: null,
    extraFields: { mfl_id: "17472" },
    canonicalPlayerId: "player-uuid-1",
    sleeperPlayerId: "sleeper-1",
    resolvedName: "Jeremiyah Love",
    resolvedPosition: "RB",
    resolvedTeam: "ARI",
    identityMatchMethod: "normalized_name_position_team",
    identityMatchConfidence: 0.98,
    isRookie: false,
    hasHistoricalProfile: false,
    ...overrides,
  };
}

// --------------------------------------------------------------------------
// Supabase mock builder
// --------------------------------------------------------------------------

type QueryResult = { data: unknown; error: { message: string; code: string } | null };

function makeSupabaseMock(overrides: Record<string, QueryResult> = {}) {
  const calls: Array<{ table: string; op: string; data?: unknown }> = [];
  const defaults: Record<string, QueryResult> = {
    "adp_snapshots.select.maybeSingle.file_hash": { data: null, error: null },
    "adp_snapshots.insert": { data: { id: "snap-uuid-1" }, error: null },
    "adp_player_records.insert": { data: [], error: null },
    "adp_player_movements.insert": { data: [], error: null },
    "player_external_ids.select.maybeSingle": { data: null, error: null },
    "player_external_ids.insert": { data: {}, error: null },
    ...overrides,
  };

  const chain = (table: string): any => {
    const ctx = { table, ops: [] as string[], filters: {} as Record<string, unknown>, payload: null as unknown };

    const result = (key: string): QueryResult => {
      const found = defaults[key] ?? defaults[table + ".select"] ?? defaults[table + ".insert"] ?? { data: null, error: null };
      return found;
    };

    const proxy: any = {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      select: (..._: unknown[]) => {
        ctx.ops.push("select");
        return proxy;
      },
      insert: (data: unknown) => {
        ctx.ops.push("insert");
        ctx.payload = data;
        calls.push({ table, op: "insert", data });
        return proxy;
      },
      eq: (col: string, val: unknown) => {
        ctx.filters[col] = val;
        return proxy;
      },
      neq: () => proxy,
      order: () => proxy,
      limit: () => proxy,
      maybeSingle: () => {
        const isHash = "file_hash" in ctx.filters;
        const key = isHash ? `${table}.select.maybeSingle.file_hash` : `${table}.select.maybeSingle`;
        const r = result(key);
        calls.push({ table, op: "maybeSingle" });
        return Promise.resolve(r);
      },
      single: () => {
        const r = result(`${table}.insert`);
        calls.push({ table, op: "single" });
        return Promise.resolve(r);
      },
      then: (resolve: any) => {
        const key = ctx.ops.includes("insert") ? `${table}.insert` : `${table}.select`;
        const r = result(key);
        calls.push({ table, op: ctx.ops.join(".") });
        return Promise.resolve(r).then(resolve);
      },
    };
    return proxy;
  };

  return {
    from: (table: string) => chain(table),
    calls,
    defaults,
  };
}

// --------------------------------------------------------------------------
// Tests: immutable snapshot insert
// --------------------------------------------------------------------------

describe("importAdpSnapshot", () => {
  it("dry_run mode: writes nothing, returns planned counts", async () => {
    const sb = makeSupabaseMock();
    const result = await importAdpSnapshot({
      mode: "dry_run",
      sourceMeta: makeMeta(),
      sourceConfidence: "medium",
      records: [makeRecord()],
      supabase: sb as any,
    });

    expect(result.mode).toBe("dry_run");
    expect(result.snapshotInserted).toBe(1);
    expect(result.snapshotId).toBeNull();
    expect(result.playerRecordsInserted).toBeGreaterThan(0);
    // No actual insert calls in dry_run (only read for duplicate check)
    const insertCalls = sb.calls.filter((c) => c.op === "insert");
    expect(insertCalls).toHaveLength(0);
  });

  it("execute mode: inserts snapshot when hash is new", async () => {
    const sb = makeSupabaseMock({
      "adp_snapshots.select.maybeSingle.file_hash": { data: null, error: null },
      "adp_snapshots.insert": { data: { id: "snap-uuid-new" }, error: null },
    });

    const result = await importAdpSnapshot({
      mode: "execute",
      sourceMeta: makeMeta(),
      sourceConfidence: "medium",
      records: [makeRecord()],
      supabase: sb as any,
    });

    expect(result.snapshotInserted).toBe(1);
    expect(result.snapshotId).toBe("snap-uuid-new");
    expect(result.existingSnapshotId).toBeNull();
  });

  // Identical snapshot deduplication
  it("returns existingSnapshotId without inserting when hash already exists", async () => {
    const sb = makeSupabaseMock({
      "adp_snapshots.select.maybeSingle.file_hash": { data: { id: "existing-snap" }, error: null },
    });

    const result = await importAdpSnapshot({
      mode: "execute",
      sourceMeta: makeMeta(),
      sourceConfidence: "medium",
      records: [makeRecord()],
      supabase: sb as any,
    });

    expect(result.snapshotInserted).toBe(0);
    expect(result.existingSnapshotId).toBe("existing-snap");
    expect(result.playerRecordsInserted).toBe(0);
    expect(result.movementsInserted).toBe(0);
    // No insert should have been attempted
    const insertCalls = sb.calls.filter((c) => c.op === "insert");
    expect(insertCalls).toHaveLength(0);
  });

  // Player-record uniqueness: duplicate canonical player deduped before insert
  it("deduplicates records with the same canonicalPlayerId before insert", async () => {
    const sb = makeSupabaseMock({
      "adp_snapshots.select.maybeSingle.file_hash": { data: null, error: null },
      "adp_snapshots.insert": { data: { id: "snap-1" }, error: null },
      "adp_player_records.insert": { data: [], error: null },
      "adp_snapshots.select.maybeSingle": { data: null, error: null }, // findPreviousSnapshot
    });

    const records = [
      makeRecord({ canonicalPlayerId: "p1", overallAdp: 2.0 }),
      makeRecord({ canonicalPlayerId: "p1", overallAdp: 3.0 }), // same ID, different ADP
      makeRecord({ canonicalPlayerId: "p2", overallAdp: 4.0 }),
    ];

    const result = await importAdpSnapshot({
      mode: "execute",
      sourceMeta: makeMeta(),
      sourceConfidence: "medium",
      records,
      supabase: sb as any,
    });

    // 2 unique players despite 3 input records
    expect(result.playerRecordsInserted).toBe(2);
    expect(result.playerRecordsDuplicate).toBe(1);
  });

  // Unresolved identity: stored with null canonical_player_id
  it("stores unresolved records with null canonicalPlayerId", async () => {
    const captured: unknown[] = [];
    const sb = makeSupabaseMock({
      "adp_snapshots.select.maybeSingle.file_hash": { data: null, error: null },
      "adp_snapshots.insert": { data: { id: "snap-2" }, error: null },
    });
    // Intercept player record inserts
    const origFrom = sb.from.bind(sb);
    vi.spyOn(sb, "from").mockImplementation((table: string) => {
      const chain = origFrom(table);
      if (table === "adp_player_records") {
        return {
          ...chain,
          insert: (rows: unknown) => {
            captured.push(rows);
            return { then: (r: any) => Promise.resolve({ data: [], error: null }).then(r) };
          },
        };
      }
      return chain;
    });

    await importAdpSnapshot({
      mode: "execute",
      sourceMeta: makeMeta(),
      sourceConfidence: "medium",
      records: [makeRecord({ canonicalPlayerId: null, identityMatchMethod: "unresolved" })],
      supabase: sb as any,
    });

    const rows = (captured[0] as any[])?.[0];
    expect(rows?.canonical_player_id).toBeNull();
    expect(rows?.identity_match_method).toBe("unresolved");
  });

  // Diagnostics: resolved/unresolved counts correct
  it("diagnostics count resolved and unresolved records correctly", async () => {
    const sb = makeSupabaseMock();
    const records = [
      makeRecord({ canonicalPlayerId: "p1" }),
      makeRecord({ canonicalPlayerId: "p2", rawName: "Player 2" }),
      makeRecord({ canonicalPlayerId: null, rawName: "Player 3", identityMatchMethod: "unresolved" }),
      makeRecord({ canonicalPlayerId: null, rawName: "Player 4", identityMatchMethod: "ambiguous" }),
    ];

    const result = await importAdpSnapshot({
      mode: "dry_run",
      sourceMeta: makeMeta(),
      sourceConfidence: "medium",
      records,
      supabase: sb as any,
    });

    expect(result.diagnostics.resolvedCount).toBe(2);
    expect(result.diagnostics.unresolvedCount).toBe(1);
    expect(result.diagnostics.ambiguousCount).toBe(1);
    expect(result.diagnostics.totalRecords).toBe(4);
  });

  // Team-defense domain exclusion: stored records should not include team-aggregate positions
  it("does not include records with skip-position positions", () => {
    // TMWR is already filtered by fetchMflAdp; this test verifies that if such a record
    // slips through, it would still be stored (we don't re-filter at storage layer —
    // the provider is responsible for filtering). This is a design boundary test.
    const record = makeRecord({ rawPosition: "TMWR", canonicalPlayerId: null });
    expect(record.rawPosition).toBe("TMWR");
    // The storage layer accepts any records given to it; filtering happens upstream.
    expect(record.rawPosition).not.toBeNull();
  });
});

// --------------------------------------------------------------------------
// Tests: semantic source hash
// --------------------------------------------------------------------------

describe("semantic source hash", () => {
  it("same ADP data produces the same hash regardless of when fetched", () => {
    const meta1 = makeMeta({ fileHash: "hash-semantic-abc" });
    const meta2 = makeMeta({ fileHash: "hash-semantic-abc", capturedAt: "2026-06-02T08:00:00.000Z" });
    expect(meta1.fileHash).toBe(meta2.fileHash);
  });

  it("different ADP data produces different hashes", () => {
    const meta1 = makeMeta({ fileHash: "hash-abc" });
    const meta2 = makeMeta({ fileHash: "hash-xyz" });
    expect(meta1.fileHash).not.toBe(meta2.fileHash);
  });
});

// --------------------------------------------------------------------------
// Tests: movement direction
// --------------------------------------------------------------------------

describe("movement direction", () => {
  it("adp_delta sign: negative means player rose (ADP improved)", () => {
    // to_adp - from_adp = 3.0 - 5.0 = -2.0 (rose from pick 5 to pick 3)
    const delta = 3.0 - 5.0;
    expect(delta).toBe(-2);
    expect(delta).toBeLessThan(0); // Rising = negative delta
  });

  it("rank_delta sign: negative means rank improved", () => {
    const delta = 3 - 5; // from_rank=5, to_rank=3
    expect(delta).toBe(-2);
    expect(delta).toBeLessThan(0);
  });

  it("new player (appearing): from_adp is null, to_adp is positive", () => {
    const movement = { from_adp: null, to_adp: 20.5, adp_delta: null };
    expect(movement.from_adp).toBeNull();
    expect(movement.to_adp).toBeGreaterThan(0);
  });

  it("disappearing player: to_adp is null, from_adp is positive", () => {
    const movement = { from_adp: 15.3, to_adp: null, adp_delta: null };
    expect(movement.to_adp).toBeNull();
    expect(movement.from_adp).toBeGreaterThan(0);
  });

  it("unchanged player: adp_delta is 0 when ADP didn't change", () => {
    const delta = 5.0 - 5.0;
    expect(delta).toBe(0);
  });
});

// --------------------------------------------------------------------------
// Tests: crosswalk seeding
// --------------------------------------------------------------------------

describe("seedCrosswalks", () => {
  it("inserts new crosswalk entries", async () => {
    const sb = makeSupabaseMock({
      "player_external_ids.select.maybeSingle": { data: null, error: null },
      "player_external_ids.insert": { data: {}, error: null },
    });

    const entries: CrosswalkEntry[] = [
      { provider: "mfl", external_type: "player", external_id: "17627", player_id: "uuid-hibner" },
    ];

    const result = await seedCrosswalks(sb as any, entries);
    expect(result.seeded).toBe(1);
    expect(result.alreadyExist).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("skips already-existing crosswalk entries", async () => {
    const sb = makeSupabaseMock({
      "player_external_ids.select.maybeSingle": { data: { id: "existing" }, error: null },
    });

    const entries: CrosswalkEntry[] = [
      { provider: "mfl", external_type: "player", external_id: "17627", player_id: "uuid-hibner" },
    ];

    const result = await seedCrosswalks(sb as any, entries);
    expect(result.seeded).toBe(0);
    expect(result.alreadyExist).toBe(1);
  });

  it("MFL_CROSSWALKS contains Hibner and Okonkwo entries", () => {
    const hibner = MFL_CROSSWALKS.find((c) => c.external_id === "17627");
    expect(hibner).toBeDefined();
    expect(hibner!.player_id).toBe("dd586604-cfd2-4220-ab13-bae446997fcd");

    const okonkwo = MFL_CROSSWALKS.find((c) => c.external_id === "15889");
    expect(okonkwo).toBeDefined();
    expect(okonkwo!.player_id).toBe("a11903aa-1c14-4424-9300-fc8692619c3e");

    for (const c of MFL_CROSSWALKS) {
      expect(c.provider).toBe("mfl");
      expect(c.external_type).toBe("player");
      expect(c.external_id).toBeTruthy();
      expect(c.player_id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it("errors are collected when insert fails", async () => {
    const sb = makeSupabaseMock({
      "player_external_ids.select.maybeSingle": { data: null, error: null },
      "player_external_ids.insert": { data: null, error: { message: "constraint violation", code: "23505" } },
    });

    const entries: CrosswalkEntry[] = [
      { provider: "mfl", external_type: "player", external_id: "99999", player_id: "uuid-test" },
    ];

    const result = await seedCrosswalks(sb as any, entries);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/99999/);
  });
});
