import { describe, expect, it } from "vitest";

import {
  buildTeamDefenseAllowanceStats,
  scoreTeamDefenseAllowance,
  selectPointsAllowedBucket,
  selectYardsAllowedBucket,
  type TeamDefenseAllowanceInput,
} from "./team-defense-allowance";

function input(overrides: Partial<TeamDefenseAllowanceInput> = {}): TeamDefenseAllowanceInput {
  return {
    season: 2025,
    week: 1,
    gameId: "2025_01_BUF_KC",
    teamId: "BUF",
    opponentTeamId: "KC",
    pointsAllowed: 13,
    yardsAllowed: 100,
    sourceCompleteness: "complete",
    reconciliationStatus: "verified",
    ...overrides,
  };
}

describe("team-defense allowance buckets", () => {
  it.each([
    [0, "pts_allow_0"],
    [1, "pts_allow_1_6"],
    [6, "pts_allow_1_6"],
    [7, "pts_allow_7_13"],
    [13, "pts_allow_7_13"],
    [14, "pts_allow_14_20"],
    [20, "pts_allow_14_20"],
    [21, "pts_allow_21_27"],
    [27, "pts_allow_21_27"],
    [28, "pts_allow_28_34"],
    [34, "pts_allow_28_34"],
    [35, "pts_allow_35p"],
  ])("selects the points bucket for %i", (value, expected) => {
    expect(selectPointsAllowedBucket(value)).toBe(expected);
  });

  it.each([
    [0, "yds_allow_0_100"],
    [100, "yds_allow_0_100"],
    [101, "yds_allow_101_199"],
    [199, "yds_allow_101_199"],
    [200, "yds_allow_200_299"],
    [299, "yds_allow_200_299"],
    [300, "yds_allow_300_349"],
    [349, "yds_allow_300_349"],
    [350, "yds_allow_350_399"],
    [399, "yds_allow_350_399"],
    [400, "yds_allow_400_449"],
    [449, "yds_allow_400_449"],
    [450, "yds_allow_450_499"],
    [499, "yds_allow_450_499"],
    [500, "yds_allow_500_549"],
    [549, "yds_allow_500_549"],
    [550, "yds_allow_550p"],
  ])("selects the yards bucket for %i", (value, expected) => {
    expect(selectYardsAllowedBucket(value)).toBe(expected);
  });

  it("rejects negative and fractional bucket inputs", () => {
    expect(() => selectPointsAllowedBucket(-1)).toThrow("non-negative");
    expect(() => selectYardsAllowedBucket(100.5)).toThrow("integer");
  });

  it("scores exactly one points bucket and one yards bucket, including configured zero-value keys", () => {
    const result = scoreTeamDefenseAllowance(input({ pointsAllowed: 21, yardsAllowed: 100 }), {
      pts_allow_14_20: 99,
      pts_allow_21_27: 0,
      yds_allow_0_100: 5,
      yds_allow_101_199: 3,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.selectedPointsBucket).toBe("pts_allow_21_27");
    expect(result.selectedYardsBucket).toBe("yds_allow_0_100");
    expect(result.result.totalPoints).toBe(5);
    expect(result.result.components.map((component) => component.scoringKey)).toEqual(["yds_allow_0_100"]);
  });

  it("returns missing-context warnings instead of scoring unsafe rows", () => {
    const result = buildTeamDefenseAllowanceStats(input({
      teamId: "",
      pointsAllowed: null,
      sourceCompleteness: "partial",
      reconciliationStatus: "conflict",
    }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      "TEAM_CONTEXT_MISSING",
      "TEAM_CONTEXT_INCOMPLETE",
      "TEAM_CONTEXT_UNVERIFIED",
      "TEAM_ALLOWANCE_STAT_MISSING",
    ]);
  });

  it("rejects incomplete, reconciliation-failed, negative, and fractional context", () => {
    const result = buildTeamDefenseAllowanceStats(input({
      pointsAllowed: -1,
      yardsAllowed: 300.5,
      sourceCompleteness: "missing",
      reconciliationStatus: "incomplete",
    }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.warnings.map((warning) => warning.code)).toContain("TEAM_CONTEXT_INCOMPLETE");
    expect(result.warnings.map((warning) => warning.code)).toContain("TEAM_CONTEXT_UNVERIFIED");
    expect(result.warnings.map((warning) => warning.code)).toContain("TEAM_ALLOWANCE_NEGATIVE");
    expect(result.warnings.map((warning) => warning.code)).toContain("TEAM_ALLOWANCE_FRACTIONAL");
  });

  it("keeps allowance scoring separate from offensive scoring", () => {
    const result = scoreTeamDefenseAllowance(input({ pointsAllowed: 0, yardsAllowed: 550 }), {
      pass_yd: 0.04,
      pts_allow_0: 10,
      yds_allow_550p: -5,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.coverage.notApplicableScoringKeys).toContain("pass_yd");
    expect(result.result.totalPoints).toBe(5);
  });
});
