import { describe, expect, it } from "vitest";

import { buildConsensusAdp } from "./consensus";
import type { SnapshotContribution } from "./consensus";
import type { PlayerAdpRecord } from "./types";

function makeRecord(overrides: Partial<PlayerAdpRecord> = {}): PlayerAdpRecord {
  return {
    rawId: null,
    rawName: "Test Player",
    rawPosition: "WR",
    rawTeam: "SF",
    overallAdp: 24.0,
    overallRank: null,
    positionalAdp: null,
    positionalRank: null,
    minPick: 18,
    maxPick: 30,
    stddev: 4.0,
    sampleSize: null,
    extraFields: {},
    canonicalPlayerId: "player-uuid-1",
    sleeperPlayerId: "sleeper-1",
    resolvedName: "Test Player",
    resolvedPosition: "WR",
    resolvedTeam: "SF",
    identityMatchMethod: "normalized_name_position_team",
    identityMatchConfidence: 0.98,
    isRookie: false,
    hasHistoricalProfile: true,
    ...overrides,
  };
}

function makeSnap(overrides: Partial<SnapshotContribution> = {}): SnapshotContribution {
  return {
    snapshotId: "snap-1",
    provider: "mfl",
    capturedAt: new Date().toISOString(),
    formatMatchScore: 1.0,
    sourceConfidenceScore: 0.75,
    sampleSize: 500,
    records: [makeRecord()],
    ...overrides,
  };
}

describe("buildConsensusAdp", () => {
  it("returns empty array for no contributions", () => {
    expect(buildConsensusAdp([])).toHaveLength(0);
  });

  it("single snapshot: passthrough with rank=1 for the only player", () => {
    const result = buildConsensusAdp([makeSnap()]);
    expect(result).toHaveLength(1);
    expect(result[0].canonicalPlayerId).toBe("player-uuid-1");
    expect(result[0].overallRank).toBe(1);
    expect(result[0].providerCount).toBe(1);
    expect(result[0].adpStddev).toBeNull(); // only one source
  });

  it("excludes unresolved records (no canonicalPlayerId)", () => {
    const snap = makeSnap({
      records: [
        makeRecord({ canonicalPlayerId: "p1" }),
        makeRecord({ canonicalPlayerId: null }),
      ]
    });
    const result = buildConsensusAdp([snap]);
    expect(result).toHaveLength(1);
    expect(result[0].canonicalPlayerId).toBe("p1");
  });

  it("two snapshots with same player: weighted average ADP", () => {
    const snap1 = makeSnap({
      snapshotId: "snap-1",
      formatMatchScore: 1.0,
      sourceConfidenceScore: 1.0,
      sampleSize: 1000,
      records: [makeRecord({ overallAdp: 20 })],
    });
    const snap2 = makeSnap({
      snapshotId: "snap-2",
      formatMatchScore: 1.0,
      sourceConfidenceScore: 1.0,
      sampleSize: 1000,
      records: [makeRecord({ overallAdp: 30 })],
    });
    const result = buildConsensusAdp([snap1, snap2]);
    expect(result).toHaveLength(1);
    // Equal weights → average = 25
    expect(result[0].overallAdp).toBeCloseTo(25, 0);
    expect(result[0].providerCount).toBe(2);
    expect(result[0].adpStddev).not.toBeNull();
  });

  it("assigns overall ranks in ascending ADP order", () => {
    const snap = makeSnap({
      records: [
        makeRecord({ canonicalPlayerId: "p1", overallAdp: 40 }),
        makeRecord({ canonicalPlayerId: "p2", overallAdp: 10 }),
        makeRecord({ canonicalPlayerId: "p3", overallAdp: 25 }),
      ]
    });
    const result = buildConsensusAdp([snap]);
    const sorted = result.sort((a, b) => a.overallRank - b.overallRank);
    expect(sorted[0].overallAdp).toBe(10);
    expect(sorted[0].overallRank).toBe(1);
    expect(sorted[1].overallAdp).toBe(25);
    expect(sorted[2].overallAdp).toBe(40);
    expect(sorted[2].overallRank).toBe(3);
  });

  it("assigns positional ranks separately per position", () => {
    const snap = makeSnap({
      records: [
        makeRecord({ canonicalPlayerId: "qb1", resolvedPosition: "QB", overallAdp: 50 }),
        makeRecord({ canonicalPlayerId: "wr1", resolvedPosition: "WR", overallAdp: 10 }),
        makeRecord({ canonicalPlayerId: "wr2", resolvedPosition: "WR", overallAdp: 20 }),
      ]
    });
    const result = buildConsensusAdp([snap]);
    const byId = Object.fromEntries(result.map((r) => [r.canonicalPlayerId, r]));
    expect(byId["qb1"].positionalRank).toBe(1);
    expect(byId["wr1"].positionalRank).toBe(1);
    expect(byId["wr2"].positionalRank).toBe(2);
  });

  it("older snapshot receives lower recency weight", () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 1 * 24 * 3600 * 1000).toISOString();
    const old = new Date(now.getTime() - 60 * 24 * 3600 * 1000).toISOString();

    const snap1 = makeSnap({ snapshotId: "snap-recent", capturedAt: recent, records: [makeRecord({ overallAdp: 10 })] });
    const snap2 = makeSnap({ snapshotId: "snap-old", capturedAt: old, records: [makeRecord({ overallAdp: 50 })] });
    const result = buildConsensusAdp([snap1, snap2]);
    // Recent snapshot should dominate: weighted ADP should be closer to 10 than 50
    expect(result[0].overallAdp).toBeLessThan(30);
  });

  it("zero formatMatchScore snapshot contributes nothing", () => {
    const snap1 = makeSnap({ records: [makeRecord({ overallAdp: 24 })] });
    const snap2 = makeSnap({
      snapshotId: "snap-incompatible",
      formatMatchScore: 0,
      records: [makeRecord({ overallAdp: 100 })],
    });
    const result = buildConsensusAdp([snap1, snap2]);
    // Only snap1 has non-zero format weight, so result should be ~24
    expect(result[0].overallAdp).toBeCloseTo(24, 0);
  });
});
