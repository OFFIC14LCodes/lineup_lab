import { describe, expect, it } from "vitest";

import {
  activeDstBigPlayKeys,
  buildH912DataCoverage,
  buildH912ProjectionResult,
  projectH912DstPopulation,
  scoreAllowanceComponents,
  scoreH912DstLeagues,
  type H912LeagueInput,
  type H912TeamGameRow,
} from "./dst-baseline-projections";

const rows: H912TeamGameRow[] = [
  row("ARI", 1, 0, 99),
  row("ARI", 2, 6, 199),
  row("ARI", 3, 35, 550),
  row("BAL", 1, 14, 300),
  row("BAL", 2, 20, 349),
  row("BAL", 3, 28, 450),
];

const leagues: H912LeagueInput[] = [
  {
    leagueId: "dst-league",
    leagueName: "DST League",
    season: 2026,
    rosterPositions: ["QB", "RB", "WR", "TE", "DST", "BN"],
    scoringSettings: {
      pts_allow_0: 10,
      pts_allow_1_6: 7,
      pts_allow_14_20: 1,
      pts_allow_35p: -4,
      yds_allow_0_100: 5,
      yds_allow_101_199: 3,
      yds_allow_550p: -5,
      sack: 1,
      int: 2,
    },
  },
  {
    leagueId: "offense-only",
    leagueName: "No DST",
    season: 2026,
    rosterPositions: ["QB", "RB", "WR", "TE", "BN"],
    scoringSettings: { pts_allow_0: 10 },
  },
];

describe("H9.12 DST baseline projections", () => {
  it("builds explicit data coverage for allowance and missing big-play components", () => {
    const coverage = buildH912DataCoverage();

    expect(coverage.find((row) => row.dst_component === "points_allowed")).toMatchObject({
      source_available: true,
      projectable_now: true,
      projection_policy: "PROJECTED_FROM_TEAM_GAME_STATS",
    });
    expect(coverage.find((row) => row.dst_component === "sacks")).toMatchObject({
      source_available: false,
      projectable_now: false,
      projection_policy: "EXPLICITLY_UNAVAILABLE_ZEROED_LOW_CONFIDENCE",
      reason_code: "DST_BIG_PLAY_COMPONENTS_UNAVAILABLE",
    });
  });

  it("calculates points and yards bucket distributions per team", () => {
    const [ari] = projectH912DstPopulation(rows, "ARI");

    expect(ari.pointsAllowedDistribution).toEqual({
      pts_allow_0: 1,
      pts_allow_1_6: 1,
      pts_allow_35p: 1,
    });
    expect(ari.yardsAllowedDistribution).toEqual({
      yds_allow_0_100: 1,
      yds_allow_101_199: 1,
      yds_allow_550p: 1,
    });
  });

  it("shrinks team bucket rates toward the population reference", () => {
    const ari = projectH912DstPopulation(rows).find((projection) => projection.team === "ARI")!;

    expect(ari.expectedPointsAllowedBucketHits.pts_allow_0).toBeGreaterThan(0);
    expect(ari.expectedPointsAllowedBucketHits.pts_allow_0).toBeLessThan(17 / 3);
    expect(ari.expectedPointsAllowedBucketHits.pts_allow_14_20).toBeGreaterThan(0);
  });

  it("scores projected bucket hits instead of treating season-total allowance as one game", () => {
    const [ari] = projectH912DstPopulation(rows, "ARI");
    const score = scoreAllowanceComponents(ari.projectedComponents, leagues[0].scoringSettings);

    expect(score).not.toBe(10);
    expect(score).toBeCloseTo(
      ari.expectedPointsAllowedBucketHits.pts_allow_0 * 10 +
      ari.expectedPointsAllowedBucketHits.pts_allow_1_6 * 7 +
      ari.expectedPointsAllowedBucketHits.pts_allow_35p * -4 +
      ari.expectedYardsAllowedBucketHits.yds_allow_0_100 * 5 +
      ari.expectedYardsAllowedBucketHits.yds_allow_101_199 * 3 +
      ari.expectedYardsAllowedBucketHits.yds_allow_550p * -5,
      4
    );
  });

  it("emits missing big-play reason codes and low confidence", () => {
    const [ari] = projectH912DstPopulation(rows, "ARI");

    expect(ari.confidence).toBe("very_low");
    expect(ari.projectedComponents.sack).toBe(0);
    expect(ari.reasonCodes).toContain("DST_BIG_PLAY_COMPONENTS_UNAVAILABLE");
  });

  it("scores only DST leagues and marks outputs partial allowance-only", () => {
    const projections = projectH912DstPopulation(rows);
    const outputs = scoreH912DstLeagues(projections, leagues);

    expect(outputs).toHaveLength(2);
    expect(outputs.every((output) => output.leagueId === "dst-league")).toBe(true);
    expect(outputs.every((output) => output.scoringReadiness === "SCORING_PARTIAL_ALLOWANCE_ONLY")).toBe(true);
    expect(outputs.every((output) => output.materialMissingScoringKeys.length === 2)).toBe(true);
  });

  it("uses deterministic rank ordering and preserves scenario ordering", () => {
    const projections = projectH912DstPopulation(rows);
    const outputs = scoreH912DstLeagues(projections, leagues);

    expect(outputs.map((output) => output.projectedPositionRank)).toEqual([1, 2]);
    expect(outputs.map((output) => output.team)).toEqual([...outputs].sort((a, b) => b.medianPoints - a.medianPoints || a.team.localeCompare(b.team)).map((output) => output.team));
    expect(outputs.every((output) =>
      output.downsidePoints <= output.floorPoints &&
      output.floorPoints <= output.medianPoints &&
      output.medianPoints <= output.ceilingPoints &&
      output.ceilingPoints <= output.upsidePoints
    )).toBe(true);
  });

  it("documents persistence deferral and does not create fake player ids", () => {
    const result = buildH912ProjectionResult({ rows, leagues, team: null, leagueId: null });

    expect(result.persistenceRecommendation.implemented).toBe(false);
    expect(result.persistenceRecommendation.verdict).toBe("H9.12 DST DRY RUN READY — PERSISTENCE DEFERRED");
    expect(JSON.stringify(result.teamProjections)).not.toContain("canonical_player_id");
    expect(JSON.stringify(result.leagueOutputs)).not.toContain("canonical_player_id");
  });

  it("detects active DST big-play scoring keys", () => {
    expect(activeDstBigPlayKeys({ sack: 1, int: 2, pts_allow_0: 10, ff: 0 })).toEqual(["int", "sack"]);
  });
});

function row(team: string, week: number, pointsAllowed: number, yardsAllowed: number): H912TeamGameRow {
  return {
    game_id: `game-${week}-${team}`,
    season: 2025,
    week,
    season_type: "regular",
    team_id: team,
    opponent_id: "OPP",
    points_allowed: pointsAllowed,
    yards_allowed: yardsAllowed,
    reconciliation_status: "verified",
  };
}
