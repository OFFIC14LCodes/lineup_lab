import { describe, expect, it } from "vitest";

import { buildPlayerStatProjection } from "./player-stat-projections";

describe("comprehensive player stat projections", () => {
  it("builds veteran QB stat ranges from historical production", () => {
    const projection = buildPlayerStatProjection({
      playerId: "qb1",
      playerName: "Veteran QB",
      position: "QB",
      team: "TST",
      season: 2026,
      yearsExperience: 4,
      historical: [
        { season: 2025, stats: { pass_att: 600, pass_cmp: 390, pass_yd: 4300, pass_td: 32, pass_int: 12, rush_att: 55, rush_yd: 260, rush_td: 3 } },
        { season: 2024, stats: { pass_att: 550, pass_cmp: 352, pass_yd: 3900, pass_td: 28, pass_int: 10, rush_att: 50, rush_yd: 230, rush_td: 2 } },
      ],
    });

    expect(projection.projectionType).toBe("veteran");
    expect(projection.stats.pass_yd.median!).toBeGreaterThan(4000);
    expect(projection.stats.pass_td.floor!).toBeLessThanOrEqual(projection.stats.pass_td.median!);
    expect(projection.stats.pass_td.ceiling!).toBeGreaterThanOrEqual(projection.stats.pass_td.median!);
    expect(projection.stats.cmp_pct.median!).toBeGreaterThan(50);
  });

  it("builds rookie projections with wider uncertainty and data gaps", () => {
    const projection = buildPlayerStatProjection({
      playerId: "rookie-rb",
      playerName: "Rookie RB",
      position: "RB",
      team: "TST",
      season: 2026,
      yearsExperience: 0,
      rookieContext: { draftCapitalScore: 75, collegeStatsAvailable: false },
    });

    expect(projection.projectionType).toBe("rookie");
    expect(projection.confidence).toBe("low");
    expect(projection.dataGaps).toContain("missing college production profile");
    expect(projection.dataGaps).toContain("rookie role uncertainty");
    expect(projection.stats.rush_att.floor!).toBeLessThan(projection.stats.rush_att.median!);
    expect(projection.stats.rush_att.ceiling!).toBeGreaterThan(projection.stats.rush_att.median!);
  });

  it("does not fabricate stat ranges when no safe source exists", () => {
    const projection = buildPlayerStatProjection({
      playerId: "unknown",
      playerName: "Unknown Player",
      position: "WR",
      season: 2026,
    });

    expect(projection.projectionType).toBe("fallback");
    expect(Object.keys(projection.stats)).toHaveLength(0);
    expect(projection.dataGaps).toContain("missing historical stats");
  });
});
