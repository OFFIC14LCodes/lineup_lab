import { describe, expect, it } from "vitest";

import { buildPlayerStatProjection } from "./player-stat-projections";
import { scorePlayerStatProjectionForLeague } from "./scored-stat-projections";

describe("scored comprehensive stat projections", () => {
  it("scores offensive projected stats through active league scoring", () => {
    const projection = buildPlayerStatProjection({
      playerId: "rb",
      playerName: "RB",
      position: "RB",
      season: 2026,
      historical: [{ season: 2025, stats: { rush_att: 220, rush_yd: 990, rush_td: 8, rec: 45, rec_yd: 360, rec_td: 2, fum_lost: 1 } }],
    });
    const scored = scorePlayerStatProjectionForLeague(projection, {
      leagueId: "league",
      scoringSettings: { rush_yd: 0.1, rush_td: 6, rec: 1, rec_yd: 0.1, rec_td: 6, fum_lost: -2 },
    });

    expect(scored.medianFantasyPoints).toBeGreaterThan(180);
    expect(scored.floorFantasyPoints!).toBeLessThanOrEqual(scored.medianFantasyPoints!);
    expect(scored.ceilingFantasyPoints!).toBeGreaterThanOrEqual(scored.medianFantasyPoints!);
    expect(scored.unsupportedScoringKeys).toEqual([]);
  });

  it("scores IDP projections and reports missing supported stats", () => {
    const projection = buildPlayerStatProjection({
      playerId: "lb",
      playerName: "LB",
      position: "LB",
      season: 2026,
      historical: [{ season: 2025, stats: { solo_tkl: 80, ast_tkl: 42, sack: 4, pass_def: 5 } }],
    });
    const scored = scorePlayerStatProjectionForLeague(projection, {
      leagueId: "idp",
      scoringSettings: { tkl_solo: 2, tkl_ast: 1, sack: 6, int: 4 },
    });

    expect(scored.medianFantasyPoints).toBeGreaterThan(200);
    expect(scored.missingProjectedStats.some((item) => item.includes("int"))).toBe(true);
  });

  it("does not score missing projections as zero", () => {
    const projection = buildPlayerStatProjection({ playerId: "x", playerName: "X", position: "WR", season: 2026 });
    const scored = scorePlayerStatProjectionForLeague(projection, {
      leagueId: "league",
      scoringSettings: { rec: 1, rec_yd: 0.1 },
    });

    expect(scored.medianFantasyPoints).toBeNull();
    expect(scored.missingProjectedStats).toEqual([]);
  });
});
