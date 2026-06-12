import { describe, expect, it } from "vitest";

import { resolveGsisIdsBatch } from "./identity";
import { normalizeGsisId } from "./normalize-gsis-id";

// Minimal Supabase mock that records filter calls and returns configurable data.
type QuerySpy = {
  provider: string | null;
  externalType: string | null;
  seasonFilter: string | null;
  positionFilter: string | null;
  queriedIds: string[][];
};

function makeMockClient(
  mockRows: Array<{ external_id: string; player_id: string }>,
  spy: QuerySpy
) {
  const chain = {
    select: () => chain,
    eq: (col: string, val: string) => {
      if (col === "provider") spy.provider = val;
      if (col === "external_type") spy.externalType = val;
      if (col === "season") spy.seasonFilter = val;
      if (col === "position_group") spy.positionFilter = val;
      return chain;
    },
    in: (col: string, ids: string[]) => {
      spy.queriedIds.push(ids);
      const data = mockRows.filter((r) => ids.includes(r.external_id));
      return Promise.resolve({ data, error: null });
    }
  };
  return { from: () => chain } as unknown as Parameters<typeof resolveGsisIdsBatch>[1];
}

function makeSpy(): QuerySpy {
  return { provider: null, externalType: null, seasonFilter: null, positionFilter: null, queriedIds: [] };
}

// ─── Test 1: Bootstrap-created mapping resolves through H1 ─────────────────

describe("H1.5→H1 roundtrip: bootstrap-written GSIS mapping resolves via resolveGsisIdsBatch", () => {
  it("returns player_id for a GSIS ID that exists in player_external_ids", async () => {
    const gsisId = "00-0039337";
    const playerId = "aaaa0000-0000-0000-0000-000000000001";
    const spy = makeSpy();
    const client = makeMockClient([{ external_id: gsisId, player_id: playerId }], spy);

    const result = await resolveGsisIdsBatch([gsisId], client);

    expect(result.get(gsisId)).toBe(playerId);
    expect(result.size).toBe(1);
  });

  it("returns empty map when no GSIS IDs are in player_external_ids", async () => {
    const spy = makeSpy();
    const client = makeMockClient([], spy);

    const result = await resolveGsisIdsBatch(["00-0099999"], client);
    expect(result.size).toBe(0);
  });
});

// ─── Test 2: H1 query uses exactly provider=gsis, external_type=gsis, no season/position filter ─

describe("H1 lookup field correctness", () => {
  it("queries with provider=gsis", async () => {
    const spy = makeSpy();
    const client = makeMockClient([], spy);
    await resolveGsisIdsBatch(["00-0039337"], client);
    expect(spy.provider).toBe("gsis");
  });

  it("queries with external_type=gsis", async () => {
    const spy = makeSpy();
    const client = makeMockClient([], spy);
    await resolveGsisIdsBatch(["00-0039337"], client);
    expect(spy.externalType).toBe("gsis");
  });

  it("does NOT filter by season — null-season mappings resolve", async () => {
    const spy = makeSpy();
    const client = makeMockClient([], spy);
    await resolveGsisIdsBatch(["00-0039337"], client);
    expect(spy.seasonFilter).toBeNull();
  });

  it("does NOT filter by position — RB/WR/TE mappings are not blocked", async () => {
    const spy = makeSpy();
    const client = makeMockClient([], spy);
    await resolveGsisIdsBatch(["00-0039337"], client);
    expect(spy.positionFilter).toBeNull();
  });
});

// ─── Test 3: Shared normalization produces identical keys ───────────────────

describe("shared normalizeGsisId — H1 and H1.5 produce identical keys", () => {
  it("standard format: H1 source and H1.5 source normalize to the same key", () => {
    const h1Source = "00-0039337";   // from weekly stats CSV player_id column
    const h15Source = "00-0039337";  // from players.csv gsis_id column
    expect(normalizeGsisId(h1Source)).toBe(normalizeGsisId(h15Source));
  });

  it("whitespace variant normalizes to same key as trimmed version", () => {
    expect(normalizeGsisId("  00-0039337  ")).toBe(normalizeGsisId("00-0039337"));
  });

  it("legacy alphanumeric ID: uppercase and lowercase normalize to same key", () => {
    expect(normalizeGsisId("ALL637395")).toBe(normalizeGsisId("all637395"));
  });
});

// ─── Test 4: Chunked lookups return IDs from every chunk ────────────────────

describe("chunked identity lookup (BATCH_SIZE=500)", () => {
  it("resolves IDs that span two chunks", async () => {
    const firstId = "00-0000001";
    const lastId = "00-0000600";
    const firstPlayerId = "aaaa0000-0000-0000-0000-000000000001";
    const lastPlayerId = "bbbb0000-0000-0000-0000-000000000002";

    // Generate 600 unique GSIS IDs (spans two 500-ID chunks)
    const ids: string[] = [];
    for (let i = 1; i <= 600; i++) {
      ids.push(`00-${String(i).padStart(7, "0")}`);
    }
    expect(ids[0]).toBe(firstId);
    expect(ids[599]).toBe(lastId);

    const mockRows = [
      { external_id: firstId, player_id: firstPlayerId },
      { external_id: lastId, player_id: lastPlayerId }
    ];
    const spy = makeSpy();
    const client = makeMockClient(mockRows, spy);

    const result = await resolveGsisIdsBatch(ids, client);

    // Two separate DB queries were issued
    expect(spy.queriedIds.length).toBe(2);
    expect(spy.queriedIds[0].length).toBe(500);
    expect(spy.queriedIds[1].length).toBe(100);

    // Both IDs resolve regardless of which chunk they were in
    expect(result.get(firstId)).toBe(firstPlayerId);
    expect(result.get(lastId)).toBe(lastPlayerId);
  });
});

// ─── Test 5: Normalization in resolveGsisIdsBatch ───────────────────────────

describe("resolveGsisIdsBatch normalizes input IDs before querying", () => {
  it("deduplicates IDs that are identical after normalization", async () => {
    const spy = makeSpy();
    const client = makeMockClient([], spy);

    // Same ID with and without whitespace
    await resolveGsisIdsBatch(["00-0039337", "  00-0039337  ", "00-0039337"], client);

    // Should only query one unique ID
    const allQueried = spy.queriedIds.flat();
    expect(allQueried.filter((id) => id === "00-0039337").length).toBe(1);
  });
});
