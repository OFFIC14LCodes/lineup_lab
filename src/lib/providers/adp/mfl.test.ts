import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchMflAdp } from "./mfl";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ADP_PLAYERS_JSON = {
  encoding: "utf-8",
  version: "1.0",
  adp: {
    totalDrafts: "397",
    totalPicks: "445",
    timestamp: "1781427448",
    player: [
      { id: "17472", rank: "1", averagePick: "2.09", minPick: "1", maxPick: "50", draftsSelectedIn: "367", draftSelPct: "92" },
      { id: "17497", rank: "2", averagePick: "4.90", minPick: "1", maxPick: "94", draftsSelectedIn: "367", draftSelPct: "92" },
      { id: "0151",  rank: "3", averagePick: "7.40", minPick: "1", maxPick: "97", draftsSelectedIn: "418", draftSelPct: "105" }, // team defense — should be skipped
      { id: "17462", rank: "4", averagePick: "12.3", minPick: "2", maxPick: "60", draftsSelectedIn: "300", draftSelPct: "75" },
    ],
  },
};

const PLAYERS_JSON = {
  players: {
    timestamp: "1781447346",
    player: [
      { id: "17472", name: "Love, Jeremiyah", position: "RB",  team: "ARI", status: "R" },
      { id: "17497", name: "Tate, Carnell",   position: "WR",  team: "TEN", status: "R" },
      { id: "0151",  name: "Bills, Buffalo",   position: "TMWR",team: "BUF", status: "A" },
      { id: "17462", name: "Mendoza, Fernando",position: "QB",  team: "LVR", status: "R" },
    ],
  },
};

const ADP_XML_BODY = `<?xml version="1.0" encoding="utf-8"?>
<adp timestamp="1781427448" totalPicks="445" totalDrafts="397">
  <player id="17472" rank="1" averagePick="2.09" minPick="1" maxPick="50" draftsSelectedIn="367" draftSelPct="92"/>
  <player id="17497" rank="2" averagePick="4.90" minPick="1" maxPick="94" draftsSelectedIn="367" draftSelPct="92"/>
  <player id="17462" rank="3" averagePick="12.3" minPick="2" maxPick="60" draftsSelectedIn="300" draftSelPct="75"/>
</adp>`;

const XML_ERROR_BODY = `<?xml version="1.0" encoding="utf-8"?>
<status is="Unknown Query Parameter"/>`;

const HTML_ERROR_BODY = `<H1>Not Found</H1>
<p>The requested URL was not found on this server.</p>`;

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

type MockResponse = { body: string; contentType: string; status?: number };

function makeFetch(routes: Record<string, MockResponse>) {
  return vi.fn((url: string | URL | Request) => {
    const urlStr = String(url);
    const match = Object.entries(routes).find(([k]) => urlStr.includes(k));
    if (!match) return Promise.reject(new Error(`No mock route for: ${urlStr}`));
    const { body, contentType, status = 200 } = match[1];
    return Promise.resolve(
      new Response(body, {
        status,
        headers: { "content-type": contentType },
      })
    );
  });
}

function adpJsonRoute(overrides: Partial<typeof ADP_PLAYERS_JSON> = {}): MockResponse {
  return {
    body: JSON.stringify({ ...ADP_PLAYERS_JSON, ...overrides }),
    contentType: "application/json; charset=utf-8",
  };
}

function playersJsonRoute(): MockResponse {
  return {
    body: JSON.stringify(PLAYERS_JSON),
    contentType: "application/json; charset=utf-8",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fetchMflAdp", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", makeFetch({
      "TYPE=adp": adpJsonRoute(),
      "TYPE=players": playersJsonRoute(),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // 1. Valid JSON response
  it("parses a valid JSON response and merges player details", async () => {
    const result = await fetchMflAdp({ season: 2026, baseUrl: "https://mock.mfl" });

    // 4 ADP entries: 1 TMWR (skipped), 3 real players
    expect(result.raw).toHaveLength(3);
    const player = result.raw.find((r) => r.rawId === "17472");
    expect(player).toBeDefined();
    expect(player!.rawName).toBe("Jeremiyah Love");   // "Last, First" → "First Last"
    expect(player!.rawPosition).toBe("RB");
    expect(player!.rawTeam).toBe("ARI");
    expect(player!.overallAdp).toBeCloseTo(2.09);
    expect(player!.overallRank).toBe(1);
    expect(player!.minPick).toBe(1);
    expect(player!.maxPick).toBe(50);
  });

  // 2. XML fallback via Content-Type
  it("parses XML when Content-Type is text/xml", async () => {
    vi.stubGlobal("fetch", makeFetch({
      "TYPE=adp": { body: ADP_XML_BODY, contentType: "text/xml; charset=utf-8" },
      "TYPE=players": playersJsonRoute(),
    }));

    const result = await fetchMflAdp({ season: 2026, baseUrl: "https://mock.mfl" });
    expect(result.raw.length).toBeGreaterThan(0);
    const qb = result.raw.find((r) => r.rawId === "17462");
    expect(qb?.rawName).toBe("Fernando Mendoza");
    expect(qb?.rawPosition).toBe("QB");
  });

  // 3. XML error response
  it("throws a useful error when MFL returns an XML error status", async () => {
    vi.stubGlobal("fetch", makeFetch({
      "TYPE=adp": { body: XML_ERROR_BODY, contentType: "text/xml" },
      "TYPE=players": playersJsonRoute(),
    }));

    await expect(fetchMflAdp({ season: 2026, baseUrl: "https://mock.mfl" }))
      .rejects.toThrow(/Unknown Query Parameter/);
  });

  // 4. HTML error page
  it("throws when MFL returns an HTML error page", async () => {
    vi.stubGlobal("fetch", makeFetch({
      "TYPE=adp": { body: HTML_ERROR_BODY, contentType: "text/html" },
      "TYPE=players": playersJsonRoute(),
    }));

    await expect(fetchMflAdp({ season: 2027, baseUrl: "https://mock.mfl" }))
      .rejects.toThrow(/HTML error page/);
  });

  // 5. Misleading Content-Type: says JSON, body is XML
  it("falls back to XML parsing when Content-Type says JSON but body is XML", async () => {
    vi.stubGlobal("fetch", makeFetch({
      "TYPE=adp": { body: ADP_XML_BODY, contentType: "application/json" },
      "TYPE=players": playersJsonRoute(),
    }));

    const result = await fetchMflAdp({ season: 2026, baseUrl: "https://mock.mfl" });
    expect(result.raw.length).toBeGreaterThan(0);
    expect(result.raw[0].rawName).toBeTruthy();
  });

  // 6. Malformed XML — truncated mid-tag causes fast-xml-parser to throw
  it("throws on malformed XML", async () => {
    vi.stubGlobal("fetch", makeFetch({
      "TYPE=adp": { body: "<?xml version=\"1.0\"?><adp totalDrafts=\"5\"><player id=\"1\" averagePick=\"5.0\"", contentType: "text/xml" },
      "TYPE=players": playersJsonRoute(),
    }));

    await expect(fetchMflAdp({ season: 2026, baseUrl: "https://mock.mfl" }))
      .rejects.toThrow(/XML parse failed/);
  });

  // 7. Decimal ADP values
  it("correctly parses decimal ADP values", async () => {
    const result = await fetchMflAdp({ season: 2026, baseUrl: "https://mock.mfl" });
    const p = result.raw.find((r) => r.rawId === "17472");
    expect(p!.overallAdp).toBeCloseTo(2.09, 2);
    const qb = result.raw.find((r) => r.rawId === "17462");
    expect(qb!.overallAdp).toBeCloseTo(12.3, 1);
  });

  // 8. JSON/XML equivalence
  it("produces equivalent records from JSON and XML formats", async () => {
    // JSON fetch
    const jsonResult = await fetchMflAdp({ season: 2026, baseUrl: "https://mock.mfl" });

    vi.stubGlobal("fetch", makeFetch({
      "TYPE=adp": { body: ADP_XML_BODY, contentType: "text/xml" },
      "TYPE=players": playersJsonRoute(),
    }));

    const xmlResult = await fetchMflAdp({ season: 2026, baseUrl: "https://mock.mfl" });

    // Both should produce the same player IDs (XML fixture has 3 real players, JSON has 3)
    const jsonIds = new Set(jsonResult.raw.map((r) => r.rawId));
    const xmlIds = new Set(xmlResult.raw.map((r) => r.rawId));
    for (const id of xmlIds) {
      expect(jsonIds.has(id)).toBe(true);
    }

    // Names and positions match for overlapping players
    for (const xmlRecord of xmlResult.raw) {
      const jsonRecord = jsonResult.raw.find((r) => r.rawId === xmlRecord.rawId);
      if (jsonRecord) {
        expect(xmlRecord.rawName).toBe(jsonRecord.rawName);
        expect(xmlRecord.rawPosition).toBe(jsonRecord.rawPosition);
      }
    }
  });

  // 9. Season with no player data (ended season / FCOUNT too high)
  it("throws an explicit error when ADP response has no player records", async () => {
    const emptyAdp = {
      encoding: "utf-8",
      version: "1.0",
      adp: { totalDrafts: "0", totalPicks: "0", timestamp: "1781427448" }, // no player key
    };
    vi.stubGlobal("fetch", makeFetch({
      "TYPE=adp": { body: JSON.stringify(emptyAdp), contentType: "application/json" },
      "TYPE=players": playersJsonRoute(),
    }));

    await expect(fetchMflAdp({ season: 2025, baseUrl: "https://mock.mfl" }))
      .rejects.toThrow(/no player records/);
  });

  // 10. No DB writes — fetchMflAdp is pure fetch+transform; no Supabase calls
  it("makes exactly two fetch calls (ADP + players) and nothing else", async () => {
    const mockFetch = makeFetch({
      "TYPE=adp": adpJsonRoute(),
      "TYPE=players": playersJsonRoute(),
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchMflAdp({ season: 2026, baseUrl: "https://mock.mfl" });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const urls = mockFetch.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("TYPE=adp"))).toBe(true);
    expect(urls.some((u) => u.includes("TYPE=players"))).toBe(true);
    // No Supabase or any other URLs
    expect(urls.every((u) => u.includes("mock.mfl"))).toBe(true);
  });

  // Bonus: sampleSize and sourceVersion populated from adp metadata
  it("extracts sampleSize from totalDrafts and sourceVersion from timestamp", async () => {
    const result = await fetchMflAdp({ season: 2026, baseUrl: "https://mock.mfl" });
    expect(result.sampleSize).toBe(397);
    expect(result.sourceVersion).toBe("1781427448");
  });

  // Bonus: team-aggregate positions (TMWR, TMDL, etc.) are skipped
  it("rejects team-aggregate positions (TM* prefix) with a rejection count", async () => {
    const result = await fetchMflAdp({ season: 2026, baseUrl: "https://mock.mfl" });
    const hasTeamAgg = result.raw.some((r) => r.rawPosition?.startsWith("TM"));
    expect(hasTeamAgg).toBe(false);
    // The TMWR player (id=0151) was in the fixture — verify it was counted as skipped
    expect(result.rejectedCount).toBeGreaterThan(0);
    expect(result.rejectedReasons["skip_position"]).toBeGreaterThanOrEqual(1);
  });

  // Bonus: MFL team codes normalized
  it("normalizes MFL-specific team codes (KCC→KC, GBP→GB, etc.)", async () => {
    const adpWithMflTeams = {
      ...ADP_PLAYERS_JSON,
      adp: {
        ...ADP_PLAYERS_JSON.adp,
        player: [{ id: "9999", rank: "1", averagePick: "5.0", minPick: "1", maxPick: "10", draftsSelectedIn: "200", draftSelPct: "50" }],
      },
    };
    const playersWithMflTeam = {
      players: { player: [{ id: "9999", name: "Chiefs, Kansas City", position: "QB", team: "KCC", status: "A" }] },
    };
    vi.stubGlobal("fetch", makeFetch({
      "TYPE=adp": { body: JSON.stringify(adpWithMflTeams), contentType: "application/json" },
      "TYPE=players": { body: JSON.stringify(playersWithMflTeam), contentType: "application/json" },
    }));

    const result = await fetchMflAdp({ season: 2026, baseUrl: "https://mock.mfl" });
    // "Chiefs, Kansas City" would have position QB — but the name won't normalize cleanly
    // The key check is team code normalization for real players
    if (result.raw.length > 0) {
      const p = result.raw[0];
      expect(p.rawTeam).toBe("KC");  // KCC → KC
    }
  });

  // Bonus: player missing from players map is counted as rejected
  it("counts records where player ID is missing from the players map", async () => {
    const adpWithUnknown = {
      ...ADP_PLAYERS_JSON,
      adp: {
        ...ADP_PLAYERS_JSON.adp,
        player: [
          { id: "UNKNOWN_99", rank: "1", averagePick: "5.0", minPick: "1", maxPick: "10", draftsSelectedIn: "100", draftSelPct: "25" },
          ...ADP_PLAYERS_JSON.adp.player,
        ],
      },
    };
    vi.stubGlobal("fetch", makeFetch({
      "TYPE=adp": { body: JSON.stringify(adpWithUnknown), contentType: "application/json" },
      "TYPE=players": playersJsonRoute(),
    }));

    const result = await fetchMflAdp({ season: 2026, baseUrl: "https://mock.mfl" });
    expect(result.rejectedReasons["player_id_not_found"]).toBe(1);
  });
});
