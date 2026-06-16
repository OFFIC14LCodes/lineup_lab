import { describe, expect, it } from "vitest";

import { buildReplacementValueModel, type ReplacementValuePlayer } from "./replacement-value";
import type { PlayerRoleClassification } from "@/lib/projections/player-role-classification";

describe("H9.15.2 replacement value", () => {
  it("builds role-aware replacement baselines from league roster slots", () => {
    const model = buildReplacementValueModel({
      leagueContext: {
        rosterPositions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN", "BN"],
        scoringSettings: { rec: 1 },
      },
      teamCount: 2,
      players: [
        player("rb1", "RB One", "RB", 260, "probable_starter"),
        player("rb2", "RB Two", "RB", 220, "probable_starter"),
        player("rb3", "RB Three", "RB", 180, "committee"),
        player("rb4", "RB Four", "RB", 120, "backup"),
        player("rb5", "RB Five", "RB", 80, "deep_reserve"),
      ],
    });

    const baseline = model.baselines.find((row) => row.position === "RB");
    const rb1 = model.playerPar.find((row) => row.playerId === "rb1");
    const rb4 = model.playerPar.find((row) => row.playerId === "rb4");

    expect(baseline?.method).toBe("league_roster_slots");
    expect(baseline?.replacementMedianPoints).toBeGreaterThan(0);
    expect(rb1?.pointsAboveReplacement).not.toBeNull();
    expect((rb1?.pointsAboveReplacement ?? 0)).toBeGreaterThan(rb4?.pointsAboveReplacement ?? 0);
    expect(model.diagnostics.playersWithPAR).toBe(5);
  });

  it("does not use ADP or market rank to set replacement", () => {
    const model = buildReplacementValueModel({
      leagueContext: { rosterPositions: ["QB"], scoringSettings: {} },
      teamCount: 1,
      players: [
        player("qb1", "QB One", "QB", 300, "probable_starter"),
        player("qb2", "QB Two", "QB", 100, "backup"),
      ],
    });

    expect(model.baselines.find((row) => row.position === "QB")?.replacementPlayerId).toBe("qb1");
  });
});

function player(playerId: string, playerName: string, position: string, medianPoints: number, role: PlayerRoleClassification["role"]): ReplacementValuePlayer {
  return {
    playerId,
    playerName,
    position,
    medianPoints,
    projectionTrustLabel: "medium",
    roleClassification: {
      playerId,
      playerName,
      position,
      team: "TST",
      role,
      confidence: "medium",
      basis: ["projection_volume_proxy"],
      teamPositionRankProxy: null,
      sameTeamPositionPeerCount: 1,
      projectedVolumeScore: null,
      reasons: [],
      dataGaps: ["confirmed depth chart"],
    },
  };
}
