import { describe, expect, it } from "vitest";

import type { PlayerBridgeMaps } from "./resolve";
import { resolvePlayer } from "./resolve";
import type { GsisBootstrapPlayerRow } from "./types";

const PLAYER_ID_A = "aaaa0000-0000-0000-0000-000000000001";
const PLAYER_ID_B = "bbbb0000-0000-0000-0000-000000000002";

function makePlayer(overrides: Partial<GsisBootstrapPlayerRow> = {}): GsisBootstrapPlayerRow {
  return {
    gsisId: "00-0039337",
    displayName: "Patrick Mahomes",
    normalizedName: "patrick mahomes",
    positionGroup: "QB",
    rawPositionGroup: "QB",
    espnId: "3139477",
    latestTeam: "KC",
    status: "ACT",
    lastSeason: 2025,
    ...overrides
  };
}

function makeBridges(overrides: Partial<PlayerBridgeMaps> = {}): PlayerBridgeMaps {
  return {
    statsIdMap: new Map(),
    espnIdMap: new Map(),
    normalizedNameMap: new Map(),
    ...overrides
  };
}

describe("resolvePlayer — priority 1: existing mapping", () => {
  it("returns existing when GSIS mapping already exists", () => {
    const player = makePlayer();
    const existingMap = new Map([[player.gsisId, PLAYER_ID_A]]);
    const result = resolvePlayer(player, existingMap, makeBridges());
    expect(result.bootstrapStatus).toBe("existing");
    expect(result.playerId).toBe(PLAYER_ID_A);
    expect(result.bridgeMethod).toBe("existing_mapping");
  });

  it("existing mapping takes priority over all bridges", () => {
    const player = makePlayer();
    const existingMap = new Map([[player.gsisId, PLAYER_ID_A]]);
    const bridges = makeBridges({
      statsIdMap: new Map([[player.gsisId, PLAYER_ID_B]])
    });
    const result = resolvePlayer(player, existingMap, bridges);
    expect(result.bootstrapStatus).toBe("existing");
    expect(result.playerId).toBe(PLAYER_ID_A);
  });
});

describe("resolvePlayer — priority 2: stats_id bridge", () => {
  it("resolves via stats_id when no existing mapping", () => {
    const player = makePlayer();
    const bridges = makeBridges({
      statsIdMap: new Map([[player.gsisId, PLAYER_ID_A]])
    });
    const result = resolvePlayer(player, new Map(), bridges);
    expect(result.bootstrapStatus).toBe("ready");
    expect(result.playerId).toBe(PLAYER_ID_A);
    expect(result.bridgeMethod).toBe("stats_id");
  });

  it("stats_id takes priority over espn_id when both match same player", () => {
    const player = makePlayer();
    const bridges = makeBridges({
      statsIdMap: new Map([[player.gsisId, PLAYER_ID_A]]),
      espnIdMap: new Map([[player.espnId!, PLAYER_ID_A]])
    });
    const result = resolvePlayer(player, new Map(), bridges);
    expect(result.bootstrapStatus).toBe("ready");
    expect(result.bridgeMethod).toBe("stats_id");
  });
});

describe("resolvePlayer — priority 3: espn_id bridge", () => {
  it("resolves via espn_id when no stats_id match", () => {
    const player = makePlayer();
    const bridges = makeBridges({
      espnIdMap: new Map([[player.espnId!, PLAYER_ID_B]])
    });
    const result = resolvePlayer(player, new Map(), bridges);
    expect(result.bootstrapStatus).toBe("ready");
    expect(result.playerId).toBe(PLAYER_ID_B);
    expect(result.bridgeMethod).toBe("espn_id");
  });

  it("does not match espn_id when player has no espn_id", () => {
    const player = makePlayer({ espnId: null });
    const bridges = makeBridges({
      espnIdMap: new Map([["3139477", PLAYER_ID_A]])
    });
    const result = resolvePlayer(player, new Map(), bridges);
    expect(result.bootstrapStatus).toBe("unresolved");
  });
});

describe("resolvePlayer — conflict detection", () => {
  it("returns conflict when stats_id and espn_id disagree", () => {
    const player = makePlayer();
    const bridges = makeBridges({
      statsIdMap: new Map([[player.gsisId, PLAYER_ID_A]]),
      espnIdMap: new Map([[player.espnId!, PLAYER_ID_B]])
    });
    const result = resolvePlayer(player, new Map(), bridges);
    expect(result.bootstrapStatus).toBe("conflict");
    expect(result.playerId).toBeNull();
    expect(result.conflictPlayerIds).toContain(PLAYER_ID_A);
    expect(result.conflictPlayerIds).toContain(PLAYER_ID_B);
  });

  it("does NOT conflict when both bridges return same player", () => {
    const player = makePlayer();
    const bridges = makeBridges({
      statsIdMap: new Map([[player.gsisId, PLAYER_ID_A]]),
      espnIdMap: new Map([[player.espnId!, PLAYER_ID_A]])
    });
    const result = resolvePlayer(player, new Map(), bridges);
    expect(result.bootstrapStatus).toBe("ready");
  });
});

describe("resolvePlayer — priority 4: manual_review", () => {
  it("returns manual_review for unique position-compatible name candidate", () => {
    const player = makePlayer({ espnId: null });
    const bridges = makeBridges({
      normalizedNameMap: new Map([
        [
          player.normalizedName,
          [{ playerId: PLAYER_ID_A, positionGroup: "QB", normalizedName: player.normalizedName }]
        ]
      ])
    });
    const result = resolvePlayer(player, new Map(), bridges);
    expect(result.bootstrapStatus).toBe("manual_review");
    expect(result.playerId).toBeNull();
    expect(result.bridgeMethod).toBe("name_position");
  });

  it("returns unresolved for ambiguous name candidates (multiple matches)", () => {
    const player = makePlayer({ espnId: null });
    const bridges = makeBridges({
      normalizedNameMap: new Map([
        [
          player.normalizedName,
          [
            { playerId: PLAYER_ID_A, positionGroup: "QB", normalizedName: player.normalizedName },
            { playerId: PLAYER_ID_B, positionGroup: "QB", normalizedName: player.normalizedName }
          ]
        ]
      ])
    });
    const result = resolvePlayer(player, new Map(), bridges);
    expect(result.bootstrapStatus).toBe("unresolved");
  });

  it("returns unresolved when name candidate has incompatible position", () => {
    const player = makePlayer({ positionGroup: "QB", espnId: null });
    const bridges = makeBridges({
      normalizedNameMap: new Map([
        [
          player.normalizedName,
          [{ playerId: PLAYER_ID_A, positionGroup: "RB", normalizedName: player.normalizedName }]
        ]
      ])
    });
    const result = resolvePlayer(player, new Map(), bridges);
    expect(result.bootstrapStatus).toBe("unresolved");
  });

  it("accepts name candidate when nflverse positionGroup is null (cannot rule out)", () => {
    const player = makePlayer({ positionGroup: null, espnId: null });
    const bridges = makeBridges({
      normalizedNameMap: new Map([
        [
          player.normalizedName,
          [{ playerId: PLAYER_ID_A, positionGroup: "QB", normalizedName: player.normalizedName }]
        ]
      ])
    });
    const result = resolvePlayer(player, new Map(), bridges);
    expect(result.bootstrapStatus).toBe("manual_review");
  });
});

describe("resolvePlayer — priority 5: unresolved", () => {
  it("returns unresolved when no bridges match and no name candidate", () => {
    const result = resolvePlayer(makePlayer(), new Map(), makeBridges());
    expect(result.bootstrapStatus).toBe("unresolved");
    expect(result.playerId).toBeNull();
    expect(result.bridgeMethod).toBeNull();
  });
});
