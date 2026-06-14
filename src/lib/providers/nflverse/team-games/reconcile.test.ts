import { describe, expect, it } from "vitest";

import {
  reconcileStoredTeamGameRows,
  type StoredTeamGameRow,
} from "./reconcile";

function row(overrides: Partial<StoredTeamGameRow>): StoredTeamGameRow {
  return {
    game_id: "2025_01_BUF_KC",
    season: 2025,
    week: 1,
    season_type: "REG",
    team_id: "BUF",
    opponent_id: "KC",
    is_home: true,
    points_scored: 24,
    points_allowed: 21,
    offensive_yards: 350,
    yards_allowed: 310,
    is_final: true,
    reconciliation_status: "verified",
    ...overrides,
  };
}

describe("reconcileStoredTeamGameRows", () => {
  it("passes a clean two-row reciprocal game", () => {
    const report = reconcileStoredTeamGameRows([
      row({ team_id: "BUF", opponent_id: "KC", is_home: true, points_scored: 24, points_allowed: 21, offensive_yards: 350, yards_allowed: 310 }),
      row({ team_id: "KC", opponent_id: "BUF", is_home: false, points_scored: 21, points_allowed: 24, offensive_yards: 310, yards_allowed: 350 }),
    ]);

    expect(report.totalRows).toBe(2);
    expect(report.totalDistinctGames).toBe(1);
    expect(report.rowsPerGameDistribution).toEqual({ "2": 1 });
    expect(report.violations).toEqual([]);
  });

  it("flags reciprocal opponent, score, yardage, and home-away violations", () => {
    const report = reconcileStoredTeamGameRows([
      row({ team_id: "BUF", opponent_id: "KC", is_home: true, points_scored: 24, points_allowed: 20, offensive_yards: 350, yards_allowed: 309 }),
      row({ team_id: "KC", opponent_id: "CIN", is_home: true, points_scored: 21, points_allowed: 24, offensive_yards: 310, yards_allowed: 350 }),
    ]);

    expect(report.reciprocalOpponentMismatches).toBe(1);
    expect(report.pointsAllowedMismatches).toBe(1);
    expect(report.yardsAllowedMismatches).toBe(1);
    expect(report.homeAwayMismatches).toBe(1);
  });

  it("flags duplicate natural keys and non-two-row games", () => {
    const report = reconcileStoredTeamGameRows([
      row({ team_id: "BUF" }),
      row({ team_id: "BUF" }),
      row({ game_id: "2025_01_DAL_PHI", team_id: "DAL", opponent_id: "PHI" }),
    ]);

    expect(report.duplicateNaturalKeys).toBe(1);
    expect(report.violations.some((violation) => violation.code === "rows_per_game_violation")).toBe(true);
  });

  it("flags missing opponents, invalid teams, negative values, fractional values, and non-final rows", () => {
    const report = reconcileStoredTeamGameRows([
      row({
        team_id: "BAD",
        opponent_id: null,
        points_scored: -1,
        points_allowed: 17.5,
        is_final: false,
      }),
    ]);

    expect(report.missingOpponents).toBe(1);
    expect(report.invalidTeamIdentities).toBe(2);
    expect(report.negativeValues).toBe(1);
    expect(report.fractionalValues).toBe(1);
    expect(report.finalStatusViolations).toBe(1);
  });

  it("summarizes reconciliation statuses", () => {
    const report = reconcileStoredTeamGameRows([
      row({ reconciliation_status: "verified" }),
      row({ team_id: "KC", opponent_id: "BUF", is_home: false, points_scored: 21, points_allowed: 24, offensive_yards: 310, yards_allowed: 350, reconciliation_status: "conflict" }),
    ]);

    expect(report.reconciliationStatusDistribution).toEqual({ verified: 1, conflict: 1 });
  });
});
