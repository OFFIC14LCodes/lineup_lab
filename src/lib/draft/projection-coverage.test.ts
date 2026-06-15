import { describe, expect, it } from "vitest";

import { buildBlackbirdBoard } from "@/lib/draft/blackbird-board";
import { buildProjectionCoverageAudit, getEnabledPositions } from "@/lib/draft/projection-coverage";
import { buildNormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";
import type { H10LeagueValueRow } from "@/lib/projections/h10-league-value";

describe("projection coverage audit", () => {
  it("fails when an offense-enabled board collapses to one IDP position", () => {
    const requirements = buildNormalizedRosterRequirements(["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "DL", "LB", "DB", "BN"]);
    const board = buildBlackbirdBoard({
      players: [player({ player_name: "Only DB", position: "DB", projected_points: 140 })],
    });

    const audit = buildProjectionCoverageAudit({
      draftRoomId: "room",
      leagueId: "league",
      rosterPositions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "DL", "LB", "DB", "BN"],
      rosterRequirements: requirements,
      projectionRows: [projection({ position: "DB" })],
      availablePlayers: [player({ position: "QB" }), player({ position: "RB" }), player({ position: "WR" }), player({ position: "TE" }), player({ position: "DB" })],
      boardRows: board.rows,
    });

    expect(audit.suspiciousSinglePositionOnly).toBe(true);
    expect(audit.missingProjectionPositions).toEqual(expect.arrayContaining(["QB", "RB", "WR", "TE"]));
    expect(audit.verdict).toBe("failed");
  });

  it("passes when enabled positions have projection and board coverage", () => {
    const rosterPositions = ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF"];
    const requirements = buildNormalizedRosterRequirements(rosterPositions);
    const players = [
      player({ player_name: "QB", position: "QB", projected_points: 320 }),
      player({ player_name: "RB", position: "RB", projected_points: 230 }),
      player({ player_name: "WR", position: "WR", projected_points: 220 }),
      player({ player_name: "TE", position: "TE", projected_points: 180 }),
      player({ player_name: "K", position: "K", projected_points: 120 }),
      player({ player_name: "DST", position: "DEF", projected_points: 110 }),
    ];
    const board = buildBlackbirdBoard({ players });

    const audit = buildProjectionCoverageAudit({
      draftRoomId: "room",
      leagueId: "league",
      rosterPositions,
      rosterRequirements: requirements,
      projectionRows: ["QB", "RB", "WR", "TE", "K", "DEF"].map((position) => projection({ position })),
      availablePlayers: players,
      boardRows: board.rows,
    });

    expect(getEnabledPositions(requirements)).toEqual(["QB", "RB", "WR", "TE", "K", "DST"]);
    expect(audit.verdict).toBe("passed");
  });

  it("flags mostly single-digit offensive projections", () => {
    const rosterPositions = ["QB", "RB", "WR", "TE"];
    const requirements = buildNormalizedRosterRequirements(rosterPositions);
    const players = [
      player({ player_name: "QB", position: "QB", projected_points: 4 }),
      player({ player_name: "RB", position: "RB", projected_points: 5 }),
      player({ player_name: "WR", position: "WR", projected_points: 6 }),
      player({ player_name: "TE", position: "TE", projected_points: 7 }),
    ];
    const board = buildBlackbirdBoard({ players });

    const audit = buildProjectionCoverageAudit({
      draftRoomId: "room",
      leagueId: "league",
      rosterPositions,
      rosterRequirements: requirements,
      projectionRows: rosterPositions.map((position) => projection({ position, medianPoints: 6 })),
      availablePlayers: players,
      boardRows: board.rows,
    });

    expect(audit.suspiciousLowProjectionCount).toBe(4);
    expect(audit.verdict).toBe("failed");
  });
});

function player(overrides: Partial<ScoredDraftTarget> = {}): ScoredDraftTarget {
  return {
    sleeper_player_id: overrides.sleeper_player_id ?? overrides.matched_player_id ?? "s1",
    matched_player_id: overrides.matched_player_id ?? "m1",
    player_name: overrides.player_name ?? "Player",
    position: overrides.position ?? "RB",
    team: "TST",
    rank: 1,
    adp: 1,
    projected_points: overrides.projected_points ?? 200,
    dynasty_value: 1,
    best_ball_value: 1,
    superflex_value: 1,
    te_premium_value: 1,
    match_status: "exact_id",
    match_confidence: 1,
    is_ranked: true,
    is_fallback: false,
    draftTargetScore: 60,
    recommendationTier: "good_value",
    scoreComponents: null,
    reasons: [],
    warnings: [],
    inputCompleteness: "full",
    positionScoringMode: "offense_v1_1",
    ...overrides,
  };
}

function projection(overrides: Partial<H10LeagueValueRow> = {}): H10LeagueValueRow {
  return {
    leagueId: "league",
    leagueName: "League",
    entityId: `${overrides.position ?? "RB"}-1`,
    entityType: "PLAYER",
    displayName: "Player",
    team: "TST",
    position: overrides.position ?? "RB",
    positionGroup: overrides.position ?? "RB",
    projectedPositionRank: 1,
    medianPoints: overrides.medianPoints ?? 200,
    floorPoints: 100,
    ceilingPoints: 260,
    downsidePoints: 90,
    upsidePoints: 280,
    replacementRank: 12,
    replacementLevelPoints: 100,
    pointsAboveReplacement: 100,
    starterCutlineRank: 6,
    starterCutlinePoints: 160,
    pointsAboveStarterCutline: 40,
    positionScarcityScore: 50,
    scarcityLabel: "medium",
    tier: 1,
    tierLabel: "Tier 1",
    tierSize: 1,
    tierGapAbove: null,
    tierGapBelow: null,
    pointsToNextTier: null,
    pointsAboveNextTier: null,
    confidenceAdjustedValue: 100,
    riskAdjustedValue: 100,
    riskLabel: "low",
    marketRankDelta: null,
    marketValueSignal: "aligned",
    draftRelevance: "draft_relevant",
    valueReadiness: "READY",
    reasonCodes: [],
    warningCodes: [],
    ...overrides,
  };
}
