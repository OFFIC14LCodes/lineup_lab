import { describe, expect, it } from "vitest";

import { buildBlackbirdBoard, findBannedBoardLanguage } from "./blackbird-board";
import type { ScoredDraftTarget } from "./scoring";
import type { WarRoomValueOverlayRow } from "./h10-war-room-overlay";
import type { WarRoomRecommendationRow } from "./war-room-recommendations";

describe("H11.3 Blackbird board", () => {
  it("does not use alphabetical as primary ordering when Blackbird data exists", () => {
    const { rows } = buildBlackbirdBoard({
      players: [
        player({ player_name: "Alpha WR", matched_player_id: "a", draftTargetScore: 50, rank: 40 }),
        player({ player_name: "Zulu RB", matched_player_id: "z", draftTargetScore: 95, rank: 30 }),
      ],
      recommendations: [
        recommendation({ entityId: "z", displayName: "Zulu RB", recommendationRank: 1, recommendationScore: 91 }),
        recommendation({ entityId: "a", displayName: "Alpha WR", recommendationRank: 2, recommendationScore: 80 }),
      ],
    });

    expect(rows.map((row) => row.playerName)).toEqual(["Zulu RB", "Alpha WR"]);
  });

  it("sorts by Blackbird/value rank before ADP and projection", () => {
    const { rows } = buildBlackbirdBoard({
      players: [
        player({ player_name: "Projection Lead", matched_player_id: "p", projected_points: 350, adp: 5 }),
        player({ player_name: "Blackbird Lead", matched_player_id: "b", projected_points: 200, adp: 50 }),
      ],
      recommendations: [
        recommendation({ entityId: "b", displayName: "Blackbird Lead", recommendationRank: 1, recommendationScore: 88 }),
        recommendation({ entityId: "p", displayName: "Projection Lead", recommendationRank: 2, recommendationScore: 86 }),
      ],
    });

    expect(rows[0]).toMatchObject({ playerName: "Blackbird Lead", blackbirdBoardRank: 1 });
  });

  it("renders ADP/projection data status when present", () => {
    const { rows } = buildBlackbirdBoard({
      players: [player({ projected_points: 280.5, adp: 18 })],
      overlays: [overlay({ medianPoints: 281, pointsAboveReplacement: 42 })],
    });

    expect(rows[0]).toMatchObject({
      projectionPoints: 281,
      adp: 18,
      dataStatus: expect.objectContaining({ projection: "available", adp: "available", h10: "available" }),
    });
  });

  it("marks missing ADP/projection with explicit unavailable statuses", () => {
    const { rows } = buildBlackbirdBoard({
      players: [player({ projected_points: null, adp: null, draftTargetScore: null })],
      overlays: [overlay({ overlayStatus: "missing_projection", medianPoints: null })],
    });

    expect(rows[0].dataStatus).toMatchObject({
      projection: "unavailable",
      adp: "unavailable",
      marketRank: "unavailable",
      h10: "unavailable",
    });
  });

  it("excludes drafted players", () => {
    const { rows, diagnostics } = buildBlackbirdBoard({
      players: [player({ sleeper_player_id: "drafted", player_name: "Taken" }), player({ sleeper_player_id: "available", player_name: "Available" })],
      draftedPlayerIds: ["drafted"],
    });

    expect(rows.map((row) => row.playerName)).toEqual(["Available"]);
    expect(diagnostics.draftedRowsExcluded).toBe(1);
  });

  it("supports local sort keys without mutating input order", () => {
    const players = [
      player({ player_name: "Low ADP", adp: 40, projected_points: 300 }),
      player({ player_name: "High ADP", adp: 4, projected_points: 100 }),
    ];
    const before = JSON.stringify(players);
    const { rows } = buildBlackbirdBoard({ players, sortKey: "adp" });

    expect(rows[0].playerName).toBe("High ADP");
    expect(JSON.stringify(players)).toBe(before);
  });

  it("does not emit banned board language", () => {
    const { rows, diagnostics } = buildBlackbirdBoard({
      players: [player({ player_name: "Safe Copy" })],
    });

    expect(diagnostics.bannedLanguageFound).toEqual([]);
    expect(findBannedBoardLanguage(JSON.stringify(rows))).toEqual([]);
    expect(findBannedBoardLanguage("must draft")).toEqual(["must draft"]);
  });
});

function player(overrides: Partial<ScoredDraftTarget> = {}): ScoredDraftTarget {
  return {
    sleeper_player_id: "s1",
    matched_player_id: "m1",
    player_name: "Player",
    position: "RB",
    team: "TST",
    rank: 10,
    adp: 12,
    projected_points: 220,
    dynasty_value: 10,
    best_ball_value: 10,
    superflex_value: 10,
    te_premium_value: 10,
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

function overlay(overrides: Partial<WarRoomValueOverlayRow> = {}): WarRoomValueOverlayRow {
  return {
    leagueId: "league",
    entityId: "m1",
    entityType: "PLAYER",
    displayName: "Player",
    team: "TST",
    position: "RB",
    medianPoints: 220,
    pointsAboveReplacement: 20,
    pointsAboveStarterCutline: 10,
    riskAdjustedValue: 18,
    confidenceAdjustedValue: 16,
    tier: 1,
    tierLabel: "Tier 1",
    positionScarcityScore: 50,
    scarcityLabel: "medium",
    marketValueSignal: "aligned",
    marketRankDelta: null,
    confidenceLabel: "medium",
    riskLabel: "low",
    valueReadiness: "READY",
    warningCodes: [],
    reasonCodes: [],
    draftRelevance: "draft_relevant",
    overlayStatus: "available",
    ...overrides,
  };
}

function recommendation(overrides: Partial<WarRoomRecommendationRow> = {}): WarRoomRecommendationRow {
  return {
    leagueId: "league",
    draftRoomId: "room",
    entityId: "m1",
    entityType: "PLAYER",
    displayName: "Player",
    team: "TST",
    position: "RB",
    recommendationRank: 1,
    recommendationTier: "strong_target",
    recommendationScore: 80,
    scoreComponents: {
      leagueValue: 20,
      rosterNeed: 10,
      scarcity: 5,
      tierCliff: 5,
      marketValue: 5,
      availabilityRisk: 2,
      needTiming: 0,
      confidencePenalty: 0,
      formatPenalty: 0,
    },
    primaryReason: "Value signal",
    explanationFragments: [],
    reasonCodes: [],
    warningCodes: [],
    h10: {
      medianPoints: 220,
      pointsAboveReplacement: 20,
      riskAdjustedValue: 18,
      tier: 1,
      marketValueSignal: "aligned",
      confidenceLabel: "medium",
      valueReadiness: "READY",
    },
    draftContext: {
      currentRound: 1,
      currentPick: 1,
      picksUntilNextUserPick: 12,
      positionNeedLevel: null,
      starterSlotNeed: false,
      benchDepthNeed: false,
      tierDropBeforeNextPick: null,
    },
    rosterNeedStatus: "filled",
    needUrgency: "low",
    futureAvailability: "likely_available_next_pick",
    tierDropRisk: "low",
    opportunityCost: "low",
    needTimingAction: "monitor",
    needTimingReasons: [],
    survivalConfidence: "medium",
    survivalConfidenceScore: 50,
    comparableOptionsNow: 5,
    comparableOptionsLikelyNextPick: 4,
    comparableOptionsLikelyNextTwoPicks: 3,
    waitRisk: "low",
    waitRiskReasons: [],
    needTimingAdjustedBySurvival: false,
    waitPlanTargets: [],
    waitPlanTargetCount: 0,
    waitPlanStrongTargetCount: 0,
    waitPlanSurvivalSummary: "Stable",
    waitPlanRisk: "low",
    waitPlanReason: "Stable",
    waitPlanBacked: false,
    waitPlanFallbackAction: null,
    needTimingAdjustedByWaitPlan: false,
    status: "recommendable",
    ...overrides,
  };
}
