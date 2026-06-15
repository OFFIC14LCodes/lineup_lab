import { describe, expect, it } from "vitest";

import {
  projectH910Population,
  scoreH910Leagues,
  validateScenarioOrdering,
  type H910WeeklyRow,
} from "./idp-k-baseline-projections";

function row(player_id: string, week: number, position_group: string, stats_json: Record<string, number>): H910WeeklyRow {
  return { player_id, week, position_group, stats_json };
}

describe("H9.10 IDP/K low-confidence baseline projections", () => {
  it("counts IDP active and role weeks, normalizes DL/LB/DB groups, and projects tackle volume", () => {
    const rows = [
      row("lb1", 1, "ILB", { solo_tkl: 5, ast_tkl: 3, tkl: 8, sack: 1, qb_hit: 2 }),
      row("lb1", 2, "LB", { solo_tkl: 4, ast_tkl: 4, tkl: 8, pd: 1 }),
      row("lb1", 3, "LB", { solo_tkl: 0, ast_tkl: 0, tkl: 0 }),
      row("db1", 1, "CB", { solo_tkl: 3, ast_tkl: 1, tkl: 4, int: 1, pd: 2 }),
    ];

    const result = projectH910Population({ rows, includeIdp: true, includeKicker: false });
    const lb = result.projections.find((projection) => projection.canonicalPlayerId === "lb1");

    expect(lb?.position).toBe("LB");
    expect(lb?.historicalActiveWeeks).toBe(3);
    expect(lb?.historicalRoleWeeks).toBe(2);
    expect(lb?.roleClass).toBe("IDP_MINIMAL_SAMPLE");
    expect(lb?.componentsByScenario.median.tkl).toBeGreaterThan(0);
    expect(lb?.reasonCodes).toContain("IDP_TACKLE_VOLUME_PROJECTED");
    expect(lb?.reasonCodes).toContain("IDP_BIG_PLAY_REGRESSION");
    expect(lb?.reasonCodes).toContain("IDP_LOW_SAMPLE");
  });

  it("heavily regresses IDP big plays and makes defensive touchdowns volatile", () => {
    const rows = [
      row("dl1", 1, "DE", { solo_tkl: 1, ast_tkl: 0, tkl: 1, sack: 3, def_td: 1 }),
      row("dl1", 2, "DE", { solo_tkl: 1, ast_tkl: 0, tkl: 1, sack: 2 }),
      row("ref", 1, "DL", { solo_tkl: 5, ast_tkl: 2, tkl: 7, sack: 0 }),
      row("ref", 2, "DL", { solo_tkl: 5, ast_tkl: 2, tkl: 7, sack: 0 }),
    ];

    const projection = projectH910Population({ rows, includeIdp: true, includeKicker: false, playerId: "dl1" }).projections[0];

    expect(projection.componentsByScenario.median.sack).toBeLessThan(15);
    expect(projection.componentsByScenario.downside.def_td).toBe(0);
    expect(projection.componentsByScenario.upside.def_td).toBeGreaterThanOrEqual(projection.componentsByScenario.ceiling.def_td);
    expect(projection.reasonCodes).toContain("IDP_DEFENSIVE_TD_VOLATILITY");
    expect(validateScenarioOrdering(projection)).toEqual([]);
  });

  it("projects kicker volume, regresses make rates, derives misses, and keeps bucket attempts absent", () => {
    const rows = [
      row("k1", 1, "PK", { fga: 2, fgm: 2, xpa: 3, xpm: 3, fgm_40_49: 1, fgm_50_59: 1 }),
      row("k1", 2, "K", { fga: 2, fgm: 1, fgmiss: 1, xpa: 2, xpm: 2, fgm_30_39: 1, fgmiss_50p: 1 }),
      row("kref", 1, "K", { fga: 2, fgm: 1, fgmiss: 1, xpa: 4, xpm: 4 }),
    ];

    const projection = projectH910Population({ rows, includeIdp: false, includeKicker: true, playerId: "k1" }).projections[0];

    expect(projection.position).toBe("K");
    expect(projection.historicalRoleWeeks).toBe(2);
    expect(projection.roleClass).toBe("K_LOW_SAMPLE");
    expect(projection.componentsByScenario.median.fga).toBeGreaterThan(0);
    expect(projection.componentsByScenario.median.fgmiss).toBeGreaterThan(0);
    expect(projection.componentsByScenario.median.fga_40_49).toBeUndefined();
    expect(projection.componentsByScenario.median.fgm_0_19).toBe(0);
    expect(projection.reasonCodes).toContain("K_MAKE_RATE_REGRESSION");
    expect(projection.reasonCodes).toContain("K_DISTANCE_BUCKET_LIMITED");
    expect(projection.reasonCodes).toContain("K_TEAM_ENVIRONMENT_NOT_MODELED");
    expect(validateScenarioOrdering(projection)).toEqual([]);
  });

  it("scores IDP and kicker leagues, ranks deterministically, and reports unsupported missing stats visibly", () => {
    const rows = [
      row("lb1", 1, "LB", { solo_tkl: 5, ast_tkl: 3, tkl: 8, sack: 1, qb_hit: 2 }),
      row("lb2", 1, "LB", { solo_tkl: 1, ast_tkl: 1, tkl: 2 }),
      row("k1", 1, "K", { fga: 2, fgm: 2, xpa: 3, xpm: 3 }),
    ];
    const projections = projectH910Population({ rows, includeIdp: true, includeKicker: true }).projections;

    const scored = scoreH910Leagues({
      projections,
      leagues: [
        {
          leagueId: "idp",
          leagueName: "IDP",
          season: 2026,
          rosterPositions: ["DL", "LB", "DB"],
          scoringSettings: { solo_tkl: 1, sack: 4, bonus_sack_2p: 2, st_tkl: 1 },
        },
        {
          leagueId: "k",
          leagueName: "K",
          season: 2026,
          rosterPositions: ["K"],
          scoringSettings: { fgm: 3, xpm: 1, fgmiss_50p: -1 },
        },
      ],
    });

    expect(scored.idpLeaguesScored).toBe(1);
    expect(scored.kickerLeaguesScored).toBe(1);
    expect(scored.outputs.find((output) => output.playerId === "lb1")?.rank).toBe(1);
    expect(scored.unsupportedScoringKeys.some((key) => key.includes("bonus_sack_2p"))).toBe(false);
    expect(scored.unsupportedScoringKeys.some((key) => key.includes("st_tkl"))).toBe(true);
    expect(scored.unsupportedScoringKeys.some((key) => key.includes("fgmiss_50p"))).toBe(false);
  });

  it("uses provider IDP stat aliases so high-value tackles and sacks do not collapse to near-zero season points", () => {
    const rows = Array.from({ length: 14 }, (_, index) =>
      row("lb-alias", index + 1, "LB", {
        solo_tackles: 6,
        assisted_tackles: 3,
        sacks: index % 4 === 0 ? 1 : 0,
        tackles_for_loss: 1,
      })
    );

    const projections = projectH910Population({ rows, includeIdp: true, includeKicker: false }).projections;
    const scored = scoreH910Leagues({
      projections,
      leagues: [
        {
          leagueId: "heavy-idp",
          leagueName: "Heavy IDP",
          season: 2026,
          rosterPositions: ["LB", "IDP"],
          scoringSettings: { solo_tkl: 2, ast_tkl: 1, sack: 6, tkl_loss: 1 },
        },
      ],
    });

    const output = scored.outputs.find((row) => row.playerId === "lb-alias");
    expect(projections[0].componentsByScenario.median.solo_tkl).toBeGreaterThan(60);
    expect(projections[0].componentsByScenario.median.sack).toBeGreaterThan(2);
    expect(output?.medianPoints).toBeGreaterThan(150);
    expect(output?.unsupportedScoringKeys).toEqual([]);
    expect(output?.missingStatsForSupportedKeys).toEqual([]);
  });

  it("scores Sleeper idp-prefixed scoring keys separately from team-defense sack scoring", () => {
    const rows = Array.from({ length: 14 }, (_, index) =>
      row("lb-sleeper-idp", index + 1, "LB", {
        solo_tkl: 6,
        ast_tkl: 3,
        sack: index % 4 === 0 ? 1 : 0,
        tkl_loss: 1,
      })
    );

    const projections = projectH910Population({ rows, includeIdp: true, includeKicker: false }).projections;
    const scored = scoreH910Leagues({
      projections,
      leagues: [
        {
          leagueId: "bestballs-idp",
          leagueName: "BestBalls IDP",
          season: 2026,
          rosterPositions: ["DL", "LB", "DB", "IDP_FLEX"],
          scoringSettings: {
            idp_tkl_solo: 2,
            idp_tkl_ast: 1,
            idp_sack: 6,
            idp_tkl_loss: 2,
            idp_qb_hit: 1,
            idp_pass_def: 3,
            sack: 1,
          },
        },
      ],
    });

    const output = scored.outputs.find((row) => row.playerId === "lb-sleeper-idp");
    expect(output?.medianPoints).toBeGreaterThan(150);
    expect(output?.unsupportedScoringKeys).toEqual([]);
    expect(output?.missingStatsForSupportedKeys).toEqual([]);
  });

  it("keeps scope to resolved IDP/K rows only and can tag unresolved exclusions", () => {
    const result = projectH910Population({
      rows: [
        row("idp", 1, "LB", { solo_tkl: 4, ast_tkl: 2, tkl: 6 }),
        row("offense", 1, "WR", { rec: 10, rec_yd: 100, rec_td: 1 }),
        { player_id: null, week: 1, position_group: "LB", stats_json: { solo_tkl: 10 } },
      ],
      includeIdp: true,
      includeKicker: true,
      unresolvedExclusions: {
        unresolvedRowsExcluded: { idp: 1, kicker: 0, total: 1 },
        unresolvedPlayersExcluded: 1,
        unresolvedStatVolumeExcluded: { idpPercent: 10, kickerPercent: 0 },
        highPriorityUnresolvedExcluded: 1,
      },
    });

    expect(result.projections).toHaveLength(1);
    expect(result.projections[0].canonicalPlayerId).toBe("idp");
    expect(result.projections[0].reasonCodes).toContain("IDP_UNRESOLVED_ROWS_EXCLUDED");
  });
});
