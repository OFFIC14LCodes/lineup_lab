import { describe, expect, it } from "vitest";

import { classifyPlayerRole } from "./player-role-classification";

describe("H9.15.2 player role classification", () => {
  it("uses projection volume and same-team rank as a proxy without claiming confirmed starter status", () => {
    const role = classifyPlayerRole({
      playerId: "rb1",
      playerName: "Lead RB",
      position: "RB",
      team: "TST",
      medianProjection: 260,
      projectionTrustLabel: "medium",
      sameTeamPositionPeers: [{ playerId: "rb2", medianProjection: 90 }],
    });

    expect(role.role).toBe("probable_starter");
    expect(role.basis).toContain("projection_volume_proxy");
    expect(role.basis).toContain("same_team_position_rank_proxy");
    expect(role.teamPositionRankProxy).toBe(1);
    expect(role.dataGaps).toContain("confirmed depth chart");
  });

  it("marks low-confidence rookies as unknown instead of fabricating role", () => {
    const role = classifyPlayerRole({
      playerId: "rookie",
      playerName: "Rookie",
      position: "WR",
      team: "TST",
      yearsExperience: 0,
      medianProjection: 120,
      projectionTrustLabel: "low",
    });

    expect(role.role).toBe("rookie_unknown");
    expect(role.confidence).toBe("low");
    expect(role.dataGaps).toContain("rookie draft capital");
  });

  it("treats team defense as a unit role", () => {
    const role = classifyPlayerRole({
      playerId: "def",
      playerName: "TST DEF",
      position: "DST",
      team: "TST",
      medianProjection: 118,
      projectionTrustLabel: "medium",
    });

    expect(role.position).toBe("DEF");
    expect(role.role).toBe("team_unit");
    expect(role.reasons[0]).toContain("unit");
  });
});
