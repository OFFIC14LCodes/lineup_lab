import { describe, expect, it } from "vitest";

import { MODEL_CONFIG } from "./constants";
import {
  buildPlayerHashes,
  hashScoringConfig,
  playerDataHash,
  playerProjectionInputHash,
  reasonKey,
  runSemanticHash,
  sha256,
} from "./hash";
import type {
  CompatibleAdpRecord,
  H8ContextFields,
  HistoricalPlayerProjectionInput,
  RunSemanticHashPayload,
  WeeklyStatRow,
} from "./types";

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

function makeWeekRow(week: number, overrides: Partial<WeeklyStatRow> = {}): WeeklyStatRow {
  return {
    week,
    passAttempts: 0,
    completions: 0,
    passingYards: 0,
    passingTds: 0,
    interceptions: 0,
    carries: 0,
    rushingYards: 0,
    rushingTds: 0,
    targets: 0,
    receptions: 0,
    receivingYards: 0,
    receivingTds: 0,
    fumRetTd: 0,
    twoPointConversions: 0,
    fumblesLost: 0,
    ...overrides,
  };
}

const UNKNOWN_SNAP: H8ContextFields[keyof H8ContextFields] = {
  value: null,
  status: "unknown",
  confidence: "unresolved",
  sourceEvidenceIds: [],
};

const NEUTRAL_H8: H8ContextFields = {
  priorTargetShare: UNKNOWN_SNAP,
  priorCarryShare: UNKNOWN_SNAP,
  priorRedZoneShare: UNKNOWN_SNAP,
  priorGoalLineShare: UNKNOWN_SNAP,
  priorTeamPassRate: UNKNOWN_SNAP,
  priorTeamRushRate: UNKNOWN_SNAP,
  priorEarlyDownPassRate: UNKNOWN_SNAP,
};

const NEUTRAL_ADP: CompatibleAdpRecord[] = [];

function makeInput(
  overrides: Partial<HistoricalPlayerProjectionInput> = {}
): HistoricalPlayerProjectionInput {
  return {
    canonicalPlayerId: "00000000-0000-0000-0000-000000000001",
    position: "WR",
    historicalSeason: 2025,
    projectionSeason: 2026,
    weeklyStats: [makeWeekRow(1, { targets: 6, receptions: 4, receivingYards: 52 })],
    h8SnapshotId: null,
    h8Fields: NEUTRAL_H8,
    compatibleAdpRecords: NEUTRAL_ADP,
    ...overrides,
  };
}

// --------------------------------------------------------------------------
// 1. sha256 — basic stability
// --------------------------------------------------------------------------

describe("sha256", () => {
  it("is deterministic for the same input", () => {
    expect(sha256("hello")).toBe(sha256("hello"));
  });

  it("differs for different inputs", () => {
    expect(sha256("hello")).not.toBe(sha256("world"));
  });

  it("produces a 64-character hex string", () => {
    expect(sha256("test")).toMatch(/^[0-9a-f]{64}$/);
  });
});

// --------------------------------------------------------------------------
// 2. playerDataHash — semantic stability
// --------------------------------------------------------------------------

describe("playerDataHash", () => {
  it("is identical for identical inputs", () => {
    const a = makeInput();
    const b = makeInput();
    expect(playerDataHash(a, MODEL_CONFIG)).toBe(playerDataHash(b, MODEL_CONFIG));
  });

  it("changes when a weekly stat changes", () => {
    const a = makeInput();
    const b = makeInput({
      weeklyStats: [makeWeekRow(1, { targets: 7, receptions: 4, receivingYards: 52 })],
    });
    expect(playerDataHash(a, MODEL_CONFIG)).not.toBe(playerDataHash(b, MODEL_CONFIG));
  });

  it("changes when receivingTds changes", () => {
    const a = makeInput({
      weeklyStats: [makeWeekRow(1, { targets: 6, receivingTds: 0 })],
    });
    const b = makeInput({
      weeklyStats: [makeWeekRow(1, { targets: 6, receivingTds: 1 })],
    });
    expect(playerDataHash(a, MODEL_CONFIG)).not.toBe(playerDataHash(b, MODEL_CONFIG));
  });

  it("changes when H8 status changes", () => {
    const a = makeInput();
    const b = makeInput({
      h8Fields: {
        ...NEUTRAL_H8,
        priorTargetShare: { value: 0.182, status: "observed", confidence: "moderate", sourceEvidenceIds: [] },
      },
    });
    expect(playerDataHash(a, MODEL_CONFIG)).not.toBe(playerDataHash(b, MODEL_CONFIG));
  });

  it("changes when H8 value changes", () => {
    const observed = (v: number): H8ContextFields => ({
      ...NEUTRAL_H8,
      priorTargetShare: { value: v, status: "observed", confidence: "moderate", sourceEvidenceIds: [] },
    });
    const a = makeInput({ h8Fields: observed(0.182) });
    const b = makeInput({ h8Fields: observed(0.190) });
    expect(playerDataHash(a, MODEL_CONFIG)).not.toBe(playerDataHash(b, MODEL_CONFIG));
  });

  it("is stable regardless of object-key insertion order on H8 fields", () => {
    const h8A: H8ContextFields = {
      priorTargetShare: { value: 0.182, status: "observed", confidence: "moderate", sourceEvidenceIds: [] },
      priorCarryShare: UNKNOWN_SNAP,
      priorRedZoneShare: UNKNOWN_SNAP,
      priorGoalLineShare: UNKNOWN_SNAP,
      priorTeamPassRate: { value: 0.581, status: "inferred", confidence: "low", sourceEvidenceIds: [] },
      priorTeamRushRate: UNKNOWN_SNAP,
      priorEarlyDownPassRate: UNKNOWN_SNAP,
    };
    // Same values, different property enumeration order — JS objects don't guarantee order.
    const h8B: H8ContextFields = {
      priorEarlyDownPassRate: UNKNOWN_SNAP,
      priorTeamRushRate: UNKNOWN_SNAP,
      priorTeamPassRate: { value: 0.581, status: "inferred", confidence: "low", sourceEvidenceIds: [] },
      priorGoalLineShare: UNKNOWN_SNAP,
      priorRedZoneShare: UNKNOWN_SNAP,
      priorCarryShare: UNKNOWN_SNAP,
      priorTargetShare: { value: 0.182, status: "observed", confidence: "moderate", sourceEvidenceIds: [] },
    };
    const a = makeInput({ h8Fields: h8A });
    const b = makeInput({ h8Fields: h8B });
    expect(playerDataHash(a, MODEL_CONFIG)).toBe(playerDataHash(b, MODEL_CONFIG));
  });

  it("does NOT change when h8SnapshotId changes (volatile DB identifier)", () => {
    const a = makeInput({ h8SnapshotId: "uuid-A" });
    const b = makeInput({ h8SnapshotId: "uuid-B" });
    expect(playerDataHash(a, MODEL_CONFIG)).toBe(playerDataHash(b, MODEL_CONFIG));
  });

  it("does NOT change when canonicalPlayerId changes (ID excluded from data hash)", () => {
    const a = makeInput({ canonicalPlayerId: "00000000-0000-0000-0000-000000000001" });
    const b = makeInput({ canonicalPlayerId: "00000000-0000-0000-0000-000000000002" });
    // Two players with identical semantic data share the same playerDataHash
    expect(playerDataHash(a, MODEL_CONFIG)).toBe(playerDataHash(b, MODEL_CONFIG));
  });

  it("changes when a model constant changes", () => {
    const modifiedConfig = { ...MODEL_CONFIG, qbPassingTdK: 999 };
    const a = playerDataHash(makeInput(), MODEL_CONFIG);
    const b = playerDataHash(makeInput(), modifiedConfig as typeof MODEL_CONFIG);
    expect(a).not.toBe(b);
  });

  it("normalizes floating-point noise (0.1 vs 0.10000000000000001)", () => {
    const a = makeInput({
      weeklyStats: [makeWeekRow(1, { receivingYards: 0.1 })],
    });
    const b = makeInput({
      weeklyStats: [makeWeekRow(1, { receivingYards: 0.10000000000000001 })],
    });
    expect(playerDataHash(a, MODEL_CONFIG)).toBe(playerDataHash(b, MODEL_CONFIG));
  });

  it("is stable regardless of weekly-stat row insertion order", () => {
    const a = makeInput({
      weeklyStats: [
        makeWeekRow(1, { targets: 6 }),
        makeWeekRow(2, { targets: 8 }),
        makeWeekRow(3, { targets: 4 }),
      ],
    });
    // Rows in a different insertion order — should sort by week and produce same hash
    const b = makeInput({
      weeklyStats: [
        makeWeekRow(3, { targets: 4 }),
        makeWeekRow(1, { targets: 6 }),
        makeWeekRow(2, { targets: 8 }),
      ],
    });
    expect(playerDataHash(a, MODEL_CONFIG)).toBe(playerDataHash(b, MODEL_CONFIG));
  });

  it("ADP content changes the hash; ADP DB IDs do not", () => {
    const adpBase: CompatibleAdpRecord = {
      adpRecordId: "rec-uuid-A",
      snapshotId: "snap-uuid-A",
      provider: "fantasypros",
      scoringFormat: "half_ppr",
      pprValue: 0.5,
      tePremiumValue: 0.0,
      isDynasty: false,
      isBestBall: false,
      isSuperflex: false,
      overallAdp: 42.3,
      overallRank: 42,
      positionalAdp: 12.1,
      positionalRank: 12,
      effectiveDate: "2026-06-01",
    };
    const adpDifferentId: CompatibleAdpRecord = {
      ...adpBase,
      adpRecordId: "rec-uuid-B",  // different DB ID
      snapshotId: "snap-uuid-B",  // different DB ID
    };
    const adpDifferentContent: CompatibleAdpRecord = {
      ...adpBase,
      overallAdp: 55.0,           // different actual ADP
    };

    const withBase = makeInput({ compatibleAdpRecords: [adpBase] });
    const withDifferentId = makeInput({ compatibleAdpRecords: [adpDifferentId] });
    const withDifferentContent = makeInput({ compatibleAdpRecords: [adpDifferentContent] });

    // Different DB IDs → same data hash (IDs excluded)
    expect(playerDataHash(withBase, MODEL_CONFIG)).toBe(
      playerDataHash(withDifferentId, MODEL_CONFIG)
    );
    // Different ADP content → different data hash
    expect(playerDataHash(withBase, MODEL_CONFIG)).not.toBe(
      playerDataHash(withDifferentContent, MODEL_CONFIG)
    );
  });
});

// --------------------------------------------------------------------------
// 3. playerProjectionInputHash — player-unique guarantee
// --------------------------------------------------------------------------

describe("playerProjectionInputHash", () => {
  it("differs for different player IDs with identical semantic data", () => {
    const inputA = makeInput({ canonicalPlayerId: "00000000-0000-0000-0000-000000000001" });
    const inputB = makeInput({ canonicalPlayerId: "00000000-0000-0000-0000-000000000002" });

    const dataHashA = playerDataHash(inputA, MODEL_CONFIG);
    const dataHashB = playerDataHash(inputB, MODEL_CONFIG);

    // Confirm data hashes ARE equal (identical semantic inputs)
    expect(dataHashA).toBe(dataHashB);

    // Confirm projection input hashes are NOT equal (different player IDs)
    const projHashA = playerProjectionInputHash(
      inputA.canonicalPlayerId,
      dataHashA,
      MODEL_CONFIG.projectionMethod,
      MODEL_CONFIG.projectionVersion
    );
    const projHashB = playerProjectionInputHash(
      inputB.canonicalPlayerId,
      dataHashB,
      MODEL_CONFIG.projectionMethod,
      MODEL_CONFIG.projectionVersion
    );
    expect(projHashA).not.toBe(projHashB);
  });

  it("is identical when player ID, data hash, method, and version are all identical", () => {
    const h1 = playerProjectionInputHash("player-1", "datahash-abc", "blackbird_baseline_v1", 1);
    const h2 = playerProjectionInputHash("player-1", "datahash-abc", "blackbird_baseline_v1", 1);
    expect(h1).toBe(h2);
  });

  it("changes when projection method changes", () => {
    const h1 = playerProjectionInputHash("player-1", "hash", "blackbird_baseline_v1", 1);
    const h2 = playerProjectionInputHash("player-1", "hash", "blackbird_baseline_v2", 1);
    expect(h1).not.toBe(h2);
  });

  it("changes when projection version changes", () => {
    const h1 = playerProjectionInputHash("player-1", "hash", "blackbird_baseline_v1", 1);
    const h2 = playerProjectionInputHash("player-1", "hash", "blackbird_baseline_v1", 2);
    expect(h1).not.toBe(h2);
  });
});

// --------------------------------------------------------------------------
// 4. buildPlayerHashes — convenience wrapper
// --------------------------------------------------------------------------

describe("buildPlayerHashes", () => {
  it("returns consistent hashes that match individual functions", () => {
    const input = makeInput();
    const { playerDataHash: dh, playerProjectionInputHash: ih } = buildPlayerHashes(
      input,
      MODEL_CONFIG
    );
    expect(dh).toBe(playerDataHash(input, MODEL_CONFIG));
    expect(ih).toBe(
      playerProjectionInputHash(
        input.canonicalPlayerId,
        dh,
        MODEL_CONFIG.projectionMethod,
        MODEL_CONFIG.projectionVersion
      )
    );
  });

  it("produces different playerProjectionInputHash for two players with identical data", () => {
    const a = makeInput({ canonicalPlayerId: "00000000-0000-0000-0000-000000000001" });
    const b = makeInput({ canonicalPlayerId: "00000000-0000-0000-0000-000000000002" });
    const ha = buildPlayerHashes(a, MODEL_CONFIG);
    const hb = buildPlayerHashes(b, MODEL_CONFIG);
    expect(ha.playerDataHash).toBe(hb.playerDataHash);
    expect(ha.playerProjectionInputHash).not.toBe(hb.playerProjectionInputHash);
  });
});

// --------------------------------------------------------------------------
// 5. hashScoringConfig — league scoring stability
// --------------------------------------------------------------------------

describe("hashScoringConfig", () => {
  it("is identical for the same league ID and settings", () => {
    const settings = { pass_yd: 0.04, pass_td: 4, rec: 1.0 };
    expect(hashScoringConfig("league-1", settings)).toBe(
      hashScoringConfig("league-1", settings)
    );
  });

  it("changes when settings change", () => {
    const a = hashScoringConfig("league-1", { pass_yd: 0.04, pass_td: 4 });
    const b = hashScoringConfig("league-1", { pass_yd: 0.04, pass_td: 6 });
    expect(a).not.toBe(b);
  });

  it("changes when league ID changes (same settings)", () => {
    const settings = { pass_yd: 0.04, pass_td: 4 };
    const a = hashScoringConfig("league-1", settings);
    const b = hashScoringConfig("league-2", settings);
    expect(a).not.toBe(b);
  });

  it("is stable regardless of settings key insertion order", () => {
    const a = hashScoringConfig("league-1", { pass_td: 4, pass_yd: 0.04 });
    const b = hashScoringConfig("league-1", { pass_yd: 0.04, pass_td: 4 });
    expect(a).toBe(b);
  });
});

// --------------------------------------------------------------------------
// 6. runSemanticHash — run-level coverage
// --------------------------------------------------------------------------

describe("runSemanticHash", () => {
  const makeRunPayload = (
    overrides: Partial<RunSemanticHashPayload> = {}
  ): RunSemanticHashPayload => ({
      projection: {
        method: "blackbird_baseline_v1",
        version: 1,
        historicalSeason: 2025,
        projectionSeason: 2026,
        leagueConfigSeason: 2026,
        contextVersion: 1,
      },
      modelConfig: MODEL_CONFIG,
      population: {
        scope: "all",
        playerProjectionInputHashes: ["hash-player-1", "hash-player-2"],
      },
      leagues: {
        scoringConfigHashes: {
          "league-1": "scoring-hash-1",
          "league-2": "scoring-hash-2",
        },
      },
      reasonCodeRegistryVersion: "v1",
      ...overrides,
  });

  it("is stable for identical inputs", () => {
    const a = runSemanticHash(makeRunPayload());
    const b = runSemanticHash(makeRunPayload());
    expect(a).toBe(b);
  });

  it("changes when a player input hash changes", () => {
    const a = runSemanticHash(
      makeRunPayload({ population: { scope: "all", playerProjectionInputHashes: ["hash-1", "hash-2"] } })
    );
    const b = runSemanticHash(
      makeRunPayload({ population: { scope: "all", playerProjectionInputHashes: ["hash-1", "hash-CHANGED"] } })
    );
    expect(a).not.toBe(b);
  });

  it("is stable regardless of player input hash insertion order", () => {
    const a = runSemanticHash(
      makeRunPayload({ population: { scope: "all", playerProjectionInputHashes: ["hash-A", "hash-B", "hash-C"] } })
    );
    const b = runSemanticHash(
      makeRunPayload({ population: { scope: "all", playerProjectionInputHashes: ["hash-C", "hash-A", "hash-B"] } })
    );
    expect(a).toBe(b);
  });

  it("changes when a scoring config hash changes", () => {
    const a = runSemanticHash(
      makeRunPayload({ leagues: { scoringConfigHashes: { "league-1": "scoring-hash-1" } } })
    );
    const b = runSemanticHash(
      makeRunPayload({ leagues: { scoringConfigHashes: { "league-1": "scoring-hash-CHANGED" } } })
    );
    expect(a).not.toBe(b);
  });

  it("changes when a model constant changes", () => {
    const modifiedConfig = { ...MODEL_CONFIG, qbPassingTdK: 9999 };
    const a = runSemanticHash(makeRunPayload());
    const b = runSemanticHash(
      makeRunPayload({ modelConfig: modifiedConfig as typeof MODEL_CONFIG })
    );
    expect(a).not.toBe(b);
  });

  it("changes when historical season changes", () => {
    const a = runSemanticHash(
      makeRunPayload({ projection: { method: "blackbird_baseline_v1", version: 1, historicalSeason: 2025, projectionSeason: 2026, leagueConfigSeason: 2026, contextVersion: 1 } })
    );
    const b = runSemanticHash(
      makeRunPayload({ projection: { method: "blackbird_baseline_v1", version: 1, historicalSeason: 2024, projectionSeason: 2026, leagueConfigSeason: 2026, contextVersion: 1 } })
    );
    expect(a).not.toBe(b);
  });
});

// --------------------------------------------------------------------------
// 7. reasonKey — uniqueness and collision-free scopes
// --------------------------------------------------------------------------

describe("reasonKey", () => {
  const base = {
    projectionRunId: "run-uuid-1",
    canonicalPlayerId: "player-uuid-1",
    leagueId: "league-uuid-1",
    reasonCode: "TD_RATE_REGRESSION_DOWN",
    reasonScope: "rushing_td",
  } as const;

  it("is deterministic", () => {
    expect(reasonKey(base)).toBe(reasonKey(base));
  });

  it("differs when reason scope differs (same code, different stat type)", () => {
    const rushing = reasonKey({ ...base, reasonScope: "rushing_td" });
    const receiving = reasonKey({ ...base, reasonScope: "receiving_td" });
    expect(rushing).not.toBe(receiving);
  });

  it("differs when league_id is null vs a real league (global vs league-specific)", () => {
    const global = reasonKey({ ...base, leagueId: null });
    const leagueSpecific = reasonKey({ ...base, leagueId: "league-uuid-1" });
    expect(global).not.toBe(leagueSpecific);
  });

  it("differs when reason code differs", () => {
    const a = reasonKey({ ...base, reasonCode: "TD_RATE_REGRESSION_UP" });
    const b = reasonKey({ ...base, reasonCode: "TD_RATE_REGRESSION_DOWN" });
    expect(a).not.toBe(b);
  });

  it("differs when player ID differs", () => {
    const a = reasonKey({ ...base, canonicalPlayerId: "player-uuid-1" });
    const b = reasonKey({ ...base, canonicalPlayerId: "player-uuid-2" });
    expect(a).not.toBe(b);
  });

  it("differs when run ID differs", () => {
    const a = reasonKey({ ...base, projectionRunId: "run-uuid-1" });
    const b = reasonKey({ ...base, projectionRunId: "run-uuid-2" });
    expect(a).not.toBe(b);
  });

  it("produces a 64-character hex string", () => {
    expect(reasonKey(base)).toMatch(/^[0-9a-f]{64}$/);
  });
});
