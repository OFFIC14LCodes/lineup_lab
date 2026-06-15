import { describe, expect, it } from "vitest";

import type { PlayerStatProjection } from "./component-projections";
import {
  buildLeagueScoringDiagnostic,
  h93AdapterStatKeys,
  projectLeagueProjectionPopulation,
  projectedComponentsToScoringStats,
  scorePlayerForLeague,
  type LeagueProjectionLeagueInput,
} from "./league-projections";
import type { ProjectionPosition, StatComponents } from "./types";

const ZERO: StatComponents = {
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
  fumblesLost: 0,
  twoPointConversions: 0,
  miscTds: 0,
};

function components(overrides: Partial<StatComponents>): StatComponents {
  return { ...ZERO, ...overrides };
}

function player(
  id: string,
  position: ProjectionPosition,
  median: StatComponents,
  overrides: Partial<Pick<
    PlayerStatProjection,
    "downsideComponents" | "floorComponents" | "ceilingComponents" | "upsideComponents"
  >> = {},
  roleGames = { floor: 10, median: 12, ceiling: 14 }
): PlayerStatProjection {
  return {
    canonicalPlayerId: id,
    position,
    roleFoundation: {
      projectedAvailability: {
        projectedRoleGames: roleGames,
      },
    },
    medianComponents: median,
    downsideComponents: overrides.downsideComponents ?? median,
    floorComponents: overrides.floorComponents ?? median,
    ceilingComponents: overrides.ceilingComponents ?? median,
    upsideComponents: overrides.upsideComponents ?? median,
    playerProjectionInputHash: `component-hash-${id}`,
    validation: { ok: true, failures: [] },
  } as unknown as PlayerStatProjection;
}

function league(overrides: Partial<LeagueProjectionLeagueInput> = {}): LeagueProjectionLeagueInput {
  return {
    leagueId: "league-a",
    leagueName: "League A",
    season: 2026,
    teamCount: 12,
    scoringType: "ppr",
    superflex: false,
    tePremium: false,
    startingRosterSettings: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX"],
    scoringSettings: {
      pass_yd: 0.04,
      pass_td: 4,
      pass_int: -2,
      rush_yd: 0.1,
      rush_td: 6,
      rec: 1,
      rec_yd: 0.1,
      rec_td: 6,
      fum_lost: -2,
    },
    ...overrides,
  };
}

describe("projectedComponentsToScoringStats", () => {
  it("maps H9.2 components to canonical scoring stats", () => {
    expect(projectedComponentsToScoringStats(components({
      passAttempts: 40,
      completions: 25,
      passingYards: 300,
      passingTds: 2,
      interceptions: 1,
      carries: 5,
      rushingYards: 24,
      rushingTds: 1,
      targets: 9,
      receptions: 6,
      receivingYards: 80,
      receivingTds: 1,
      fumblesLost: 0.5,
    }))).toMatchObject({
      pass_att: 40,
      pass_cmp: 25,
      pass_inc: 15,
      pass_yd: 300,
      pass_td: 2,
      pass_int: 1,
      rush_att: 5,
      rush_yd: 24,
      rush_td: 1,
      rec_tgt: 9,
      rec: 6,
      rec_yd: 80,
      rec_td: 1,
      fum_lost: 0.5,
      pass_2pt: 0,
      rush_2pt: 0,
      rec_2pt: 0,
    });
  });

  it("rejects invalid count components", () => {
    expect(() => projectedComponentsToScoringStats(components({ carries: -1 })))
      .toThrow(/carries must be nonnegative/);
    expect(() => projectedComponentsToScoringStats(components({ passAttempts: 10, completions: 11 })))
      .toThrow(/completions exceed passAttempts/);
  });

  it("explicitly carries total-fumble policy stats as known zero", () => {
    expect(h93AdapterStatKeys()).toContain("fum_lost");
    expect(h93AdapterStatKeys()).toContain("fum");
  });
});

describe("scorePlayerForLeague", () => {
  it("scores all scenarios and computes role-game PPG", () => {
    const projection = player("wr-1", "WR", components({
      targets: 120,
      receptions: 80,
      receivingYards: 1000,
      receivingTds: 8,
      fumblesLost: 1,
    }), {
      downsideComponents: components({ targets: 90, receptions: 55, receivingYards: 650, receivingTds: 4, fumblesLost: 2 }),
      floorComponents: components({ targets: 100, receptions: 65, receivingYards: 800, receivingTds: 5, fumblesLost: 1.5 }),
      ceilingComponents: components({ targets: 135, receptions: 92, receivingYards: 1200, receivingTds: 10, fumblesLost: 0.5 }),
      upsideComponents: components({ targets: 150, receptions: 105, receivingYards: 1400, receivingTds: 12, fumblesLost: 0 }),
    });

    const output = scorePlayerForLeague(projection, league(), "dry-run");

    expect(output.medianPoints).toBe(226);
    expect(output.projectedPPGWhenInRole).toBe(18.833333);
    expect(output.floorPPGWhenInRole).toBe(17.2);
    expect(output.ceilingPPGWhenInRole).toBe(19.357143);
    expect(output.validation.ok).toBe(true);
    expect(output.leagueSpecificReasons).toContain("LEAGUE_SCORING_APPLIED");
    expect(output.leagueSpecificReasons).toContain("PPR_SCORING_IMPACT");
    expect(output.leagueSpecificReasons).toContain("FUMBLE_PENALTY_IMPACT");
  });

  it("preserves valid negative fantasy points", () => {
    const projection = player("qb-penalty", "QB", components({
      passAttempts: 10,
      completions: 4,
      interceptions: 2,
      fumblesLost: 1,
    }), {
      downsideComponents: components({ passAttempts: 10, completions: 4, interceptions: 4, fumblesLost: 2 }),
      floorComponents: components({ passAttempts: 10, completions: 4, interceptions: 3, fumblesLost: 1 }),
      ceilingComponents: components({ passAttempts: 10, completions: 4, interceptions: 1, fumblesLost: 0 }),
      upsideComponents: components({ passAttempts: 10, completions: 4, interceptions: 0, fumblesLost: 0 }),
    });

    const output = scorePlayerForLeague(projection, league({ scoringSettings: { pass_int: -2, fum_lost: -2 } }), "dry-run");

    expect(output.downsidePoints).toBe(-12);
    expect(output.floorPoints).toBe(-8);
    expect(output.medianPoints).toBe(-6);
    expect(output.validation.ok).toBe(true);
    expect(output.leagueSpecificReasons).toContain("NEGATIVE_FLOOR_VALID");
    expect(output.leagueSpecificReasons).toContain("INTERCEPTION_PENALTY_IMPACT");
  });

  it("emits TE premium scoring diagnostics only for tight ends", () => {
    const te = player("te-1", "TE", components({ targets: 90, receptions: 60, receivingYards: 700, receivingTds: 5 }));
    const wr = player("wr-1", "WR", components({ targets: 90, receptions: 60, receivingYards: 700, receivingTds: 5 }));
    const tePremiumLeague = league({
      tePremium: true,
      scoringSettings: { rec: 1, bonus_rec_te: 0.5, rec_yd: 0.1, rec_td: 6 },
    });

    expect(scorePlayerForLeague(te, tePremiumLeague, "dry-run").leagueSpecificReasons)
      .toContain("TE_PREMIUM_SCORING_IMPACT");
    expect(scorePlayerForLeague(wr, tePremiumLeague, "dry-run").leagueSpecificReasons)
      .not.toContain("TE_PREMIUM_SCORING_IMPACT");
  });

  it("returns null PPG when the matching role-games scenario is zero", () => {
    const projection = player("rb-zero", "RB", components({ carries: 100, rushingYards: 450 }), {}, {
      floor: 0,
      median: 0,
      ceiling: 0,
    });
    const output = scorePlayerForLeague(projection, league(), "dry-run");
    expect(output.projectedPPGWhenInRole).toBeNull();
    expect(output.floorPPGWhenInRole).toBeNull();
    expect(output.ceilingPPGWhenInRole).toBeNull();
  });
});

describe("league scoring diagnostics and population ranking", () => {
  it("classifies first-down scoring as projection-supported", () => {
    const diagnostic = buildLeagueScoringDiagnostic(league({
      scoringSettings: { pass_yd: 0.04, pass_td: 4, pass_fd: 0.5 },
    }));

    expect(diagnostic.readiness).toBe("SCORING_READY");
    expect(diagnostic.projectionUnsupportedScoringKeys).not.toContain("pass_fd");
  });

  it("ranks by median, ceiling, PPG, then canonical ID", () => {
    const outputs = projectLeagueProjectionPopulation({
      dryRunId: "dry-run",
      leagues: [league({ scoringSettings: { rec: 1, rec_yd: 0.1, rec_td: 6 } })],
      players: [
        player("wr-b", "WR", components({ targets: 12, receptions: 10, receivingYards: 100, receivingTds: 1 }), {
          ceilingComponents: components({ targets: 13, receptions: 11, receivingYards: 110, receivingTds: 1 }),
        }),
        player("wr-a", "WR", components({ targets: 12, receptions: 10, receivingYards: 100, receivingTds: 1 }), {
          ceilingComponents: components({ targets: 14, receptions: 12, receivingYards: 120, receivingTds: 1 }),
        }),
        player("wr-c", "WR", components({ targets: 10, receptions: 8, receivingYards: 80, receivingTds: 1 })),
      ],
    }).outputs;

    expect(outputs.map((output) => [output.canonicalPlayerId, output.projectedPositionRank])).toEqual([
      ["wr-a", 1],
      ["wr-b", 2],
      ["wr-c", 3],
    ]);
    expect(outputs.every((output) => output.playersRankedAtPosition === 3)).toBe(true);
  });

  it("is deterministic across input order and excludes ADP fields", () => {
    const leagueA = league({ leagueId: "league-a", scoringSettings: { rec: 1, rec_yd: 0.1 } });
    const leagueB = league({ leagueId: "league-b", scoringSettings: { rec: 0.5, rec_yd: 0.1 } });
    const p1 = player("wr-a", "WR", components({ targets: 70, receptions: 50, receivingYards: 500 }));
    const p2 = player("wr-b", "WR", components({ targets: 60, receptions: 40, receivingYards: 450 }));

    const first = projectLeagueProjectionPopulation({ dryRunId: "dry-run", leagues: [leagueB, leagueA], players: [p2, p1] });
    const second = projectLeagueProjectionPopulation({ dryRunId: "dry-run", leagues: [leagueA, leagueB], players: [p1, p2] });

    expect(first.outputs.map((output) => output.semanticInputHash)).toEqual(
      second.outputs.map((output) => output.semanticInputHash)
    );
    expect(Object.keys(first.outputs[0])).not.toContain("marketAgreement");
    expect(Object.keys(first.outputs[0])).not.toContain("adp");
  });
});
