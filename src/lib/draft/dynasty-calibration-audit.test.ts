import { describe, expect, it } from "vitest";

import { buildBlackbirdBoard } from "./blackbird-board";
import { buildDynastyCalibrationAudit, renderDynastyCalibrationAuditMarkdown } from "./dynasty-calibration-audit";
import type { ScoredDraftTarget } from "./scoring";

describe("H56B dynasty calibration audit", () => {
  it("reports ready when age data is available and dynasty comparisons are coherent", () => {
    const players = [
      player({ player_name: "Jonathan Taylor", matched_player_id: "jt", sleeper_player_id: "jt", position: "RB", age: 27, projected_points: 288, adp: 27, rank: 31 }),
      player({ player_name: "Derrick Henry", matched_player_id: "dh", sleeper_player_id: "dh", position: "RB", age: 32, projected_points: 293, adp: 18, rank: 30 }),
      player({ player_name: "Brock Bowers", matched_player_id: "bb", sleeper_player_id: "bb", position: "TE", age: 23, projected_points: 225, adp: 12, rank: 37 }),
      player({ player_name: "Trey McBride", matched_player_id: "tm", sleeper_player_id: "tm", position: "TE", age: 26, projected_points: 220, adp: 18, rank: 34 }),
      ...Array.from({ length: 48 }, (_, index) =>
        player({
          player_name: `Prime WR ${index}`,
          matched_player_id: `wr${index}`,
          sleeper_player_id: `wr${index}`,
          position: "WR",
          age: 25,
          projected_points: 210 - index,
          adp: 40 + index,
          rank: 40 + index,
        })
      ),
    ];
    const before = buildBlackbirdBoard({ players, leagueContext: league(false), includeDrafted: true, draftTiming: { teamCount: 12 } });
    const after = buildBlackbirdBoard({ players, leagueContext: league(true), includeDrafted: true, draftTiming: { teamCount: 12 } });
    const report = buildDynastyCalibrationAudit({
      projectionSeason: 2026,
      marketFormat: "SUPERFLEX",
      beforeRows: before.rows,
      afterRows: after.rows,
      unsupportedPlayersFiltered: 0,
      unsupportedPositionsFiltered: [],
    });

    const taylor = report.rows.find((row) => row.playerName === "Jonathan Taylor");
    const henry = report.rows.find((row) => row.playerName === "Derrick Henry");
    const bowers = report.rows.find((row) => row.playerName === "Brock Bowers");
    expect(taylor?.afterRank).toBeLessThan(henry?.afterRank ?? 999);
    expect(bowers?.dynastyAssetScore).not.toBeNull();
    expect(report.recommendation).toBe("dynasty_calibration_ready_for_manual_review");
    expect(renderDynastyCalibrationAuditMarkdown(report)).toContain("Jonathan Taylor over Derrick Henry: true");
  });

  it("flags missing age data", () => {
    const players = Array.from({ length: 52 }, (_, index) =>
      player({
        player_name: index === 0 ? "Jonathan Taylor" : index === 1 ? "Derrick Henry" : index === 2 ? "Brock Bowers" : `Player ${index}`,
        matched_player_id: `p${index}`,
        sleeper_player_id: `p${index}`,
        position: index === 2 ? "TE" : index < 2 ? "RB" : "WR",
        age: null,
        projected_points: 260 - index,
        adp: 10 + index,
        rank: 10 + index,
      })
    );
    const before = buildBlackbirdBoard({ players, leagueContext: league(false), includeDrafted: true });
    const after = buildBlackbirdBoard({ players, leagueContext: league(true), includeDrafted: true });

    const report = buildDynastyCalibrationAudit({
      projectionSeason: 2026,
      marketFormat: "SUPERFLEX",
      beforeRows: before.rows,
      afterRows: after.rows,
      unsupportedPlayersFiltered: 0,
      unsupportedPositionsFiltered: [],
    });

    expect(report.recommendation).toBe("dynasty_calibration_needs_age_data_fix");
  });

  it("keeps suggested draft spot driven by updated rank and market timing", () => {
    const players = [
      player({ player_name: "Brock Bowers", matched_player_id: "bb", sleeper_player_id: "bb", position: "TE", age: 23, projected_points: 225, adp: 12, rank: 37 }),
      player({ player_name: "Travis Kelce", matched_player_id: "tk", sleeper_player_id: "tk", position: "TE", age: 36, projected_points: 225, adp: 70, rank: 40 }),
    ];
    const after = buildBlackbirdBoard({ players, leagueContext: league(true), includeDrafted: true, draftTiming: { teamCount: 12 } });
    const bowers = after.rows.find((row) => row.playerName === "Brock Bowers");
    const kelce = after.rows.find((row) => row.playerName === "Travis Kelce");

    expect(bowers?.blackbirdBoardRank).toBeLessThan(kelce?.blackbirdBoardRank ?? 999);
    expect(bowers?.suggestedDraftSpot.marketEdgePicks).not.toBeNull();
    expect(bowers?.dynastyAssetValue?.components.marketSanityAdjustment).toBeLessThanOrEqual(4);
  });
});

function league(isDynasty: boolean) {
  return {
    isDynasty,
    isSuperflex: true,
    isTwoQb: false,
    isBestBall: false,
    tePremium: isDynasty ? 1 : 0,
    hasIDP: false,
    hasKicker: false,
    hasTeamDefense: false,
    rosterPositions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "SUPER_FLEX", "BN", "BN"],
    scoringSettings: {},
  };
}

function player(overrides: Partial<ScoredDraftTarget> = {}): ScoredDraftTarget {
  return {
    sleeper_player_id: "s1",
    matched_player_id: "m1",
    player_name: "Player",
    position: "RB",
    team: "TST",
    age: 25,
    yearsExperience: 4,
    rank: 10,
    adp: 12,
    projected_points: 220,
    dynasty_value: null,
    best_ball_value: null,
    superflex_value: null,
    te_premium_value: null,
    match_status: "exact_id",
    match_confidence: 1,
    is_ranked: true,
    is_fallback: false,
    draftTargetScore: 70,
    recommendationTier: "good_value",
    scoreComponents: null,
    reasons: [],
    warnings: [],
    inputCompleteness: "full",
    positionScoringMode: "offense_v1_1",
    ...overrides,
  };
}
