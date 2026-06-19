import { describe, expect, it } from "vitest";

import { buildBlackbirdBoard, findBannedBoardLanguage } from "./blackbird-board";
import type { ScoredDraftTarget } from "./scoring";
import type { WarRoomValueOverlayRow } from "./h10-war-room-overlay";
import type { WarRoomRecommendationRow } from "./war-room-recommendations";

describe("H11.3 Blackbird board", () => {
  it("does not use alphabetical as primary ordering when Blackbird data exists", () => {
    const { rows } = buildBlackbirdBoard({
      players: [
        player({ player_name: "Alpha WR", matched_player_id: "a", projected_points: 160, draftTargetScore: 50, rank: 40 }),
        player({ player_name: "Zulu RB", matched_player_id: "z", projected_points: 240, draftTargetScore: 95, rank: 30 }),
      ],
      overlays: [
        overlay({ entityId: "a", displayName: "Alpha WR", position: "WR", medianPoints: 160, pointsAboveReplacement: 5 }),
        overlay({ entityId: "z", displayName: "Zulu RB", position: "RB", medianPoints: 240, pointsAboveReplacement: 35 }),
      ],
      recommendations: [
        recommendation({ entityId: "z", displayName: "Zulu RB", recommendationRank: 1, recommendationScore: 91 }),
        recommendation({ entityId: "a", displayName: "Alpha WR", recommendationRank: 2, recommendationScore: 80 }),
      ],
    });

    expect(rows.map((row) => row.playerName)).toEqual(["Zulu RB", "Alpha WR"]);
  });

  it("does not let H10 recommendation rank override stronger contextual value", () => {
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

    expect(rows[0]).toMatchObject({ playerName: "Projection Lead", blackbirdBoardRank: 1 });
  });

  it("renders projection data status and Blackbird draft rank when present", () => {
    const { rows } = buildBlackbirdBoard({
      players: [player({ projected_points: 280.5, adp: 18 })],
      overlays: [overlay({ medianPoints: 281, pointsAboveReplacement: 42 })],
    });

    expect(rows[0]).toMatchObject({
      projectionPoints: 281,
      marketRank: 1,
      rankDelta: null,
      dataStatus: expect.objectContaining({ projection: "available", marketRank: "available", h10: "available" }),
    });
  });

  it("marks missing projection with explicit unavailable statuses", () => {
    const { rows } = buildBlackbirdBoard({
      players: [player({ projected_points: null, adp: null, draftTargetScore: null })],
      overlays: [overlay({ overlayStatus: "missing_projection", medianPoints: null })],
    });

    expect(rows[0].dataStatus).toMatchObject({
      projection: "unavailable",
      marketRank: "available",
      h10: "unavailable",
    });
    expect(rows[0].playerDetailContext?.dataGaps).toEqual(expect.arrayContaining(["projection", "H10 context"]));
  });

  it("excludes drafted players", () => {
    const { rows, diagnostics } = buildBlackbirdBoard({
      players: [player({ sleeper_player_id: "drafted", player_name: "Taken" }), player({ sleeper_player_id: "available", player_name: "Available" })],
      draftedPlayerIds: ["drafted"],
    });

    expect(rows.map((row) => row.playerName)).toEqual(["Available"]);
    expect(diagnostics.draftedRowsExcluded).toBe(1);
  });

  it("supports local projection sort without mutating input order", () => {
    const players = [
      player({ player_name: "Low Projection", projected_points: 100 }),
      player({ player_name: "High Projection", projected_points: 300 }),
    ];
    const before = JSON.stringify(players);
    const { rows } = buildBlackbirdBoard({ players, sortKey: "projection" });

    expect(rows[0].playerName).toBe("High Projection");
    expect(JSON.stringify(players)).toBe(before);
  });

  it("matches overlay projections by identity instead of array position", () => {
    const { rows } = buildBlackbirdBoard({
      players: [
        player({ player_name: "Alpha LB", matched_player_id: "alpha", position: "LB", projected_points: 4 }),
        player({ player_name: "Beta LB", matched_player_id: "beta", position: "LB", projected_points: 5 }),
      ],
      overlays: [
        overlay({ entityId: "beta", displayName: "Beta LB", position: "LB", medianPoints: 250, pointsAboveReplacement: 40 }),
        overlay({ entityId: "alpha", displayName: "Alpha LB", position: "LB", medianPoints: 150, pointsAboveReplacement: 20 }),
      ],
    });

    expect(rows.find((row) => row.playerName === "Alpha LB")?.projectionPoints).toBe(150);
    expect(rows.find((row) => row.playerName === "Beta LB")?.projectionPoints).toBe(250);
  });

  it("refines tied value scores with same-position projection and PAR context", () => {
    const { rows } = buildBlackbirdBoard({
      players: [
        player({ player_name: "Lower LB", matched_player_id: "lower", position: "LB", projected_points: 120, draftTargetScore: 70 }),
        player({ player_name: "Higher LB", matched_player_id: "higher", position: "LB", projected_points: 200, draftTargetScore: 70 }),
      ],
      overlays: [
        overlay({ entityId: "lower", displayName: "Lower LB", position: "LB", medianPoints: 120, pointsAboveReplacement: 5 }),
        overlay({ entityId: "higher", displayName: "Higher LB", position: "LB", medianPoints: 200, pointsAboveReplacement: 30 }),
      ],
    });

    const lower = rows.find((row) => row.playerName === "Lower LB");
    const higher = rows.find((row) => row.playerName === "Higher LB");
    expect(higher?.blackbirdValueScore).toBeGreaterThan(lower?.blackbirdValueScore ?? 0);
  });

  it("does not use ADP as the Blackbird rank fallback", () => {
    const { rows } = buildBlackbirdBoard({
      players: [
        player({ player_name: "ADP First", matched_player_id: "adp", adp: 1, projected_points: 190 }),
        player({ player_name: "Blackbird First", matched_player_id: "bb", adp: 250, projected_points: 240 }),
      ],
      overlays: [
        overlay({ entityId: "adp", displayName: "ADP First", medianPoints: 190, pointsAboveReplacement: 8 }),
        overlay({ entityId: "bb", displayName: "Blackbird First", medianPoints: 240, pointsAboveReplacement: 38 }),
      ],
    });

    expect(rows[0].playerName).toBe("Blackbird First");
    expect(rows[0].marketRank).toBe(1);
    expect(rows[0].suggestedDraftSpot.marketEdgePicks).not.toBeNull();
  });

  it("adds suggested draft spot without changing Blackbird rank order", () => {
    const { rows } = buildBlackbirdBoard({
      players: [
        player({ player_name: "Early Value", matched_player_id: "early", projected_points: 280, adp: 45 }),
        player({ player_name: "Second Value", matched_player_id: "second", projected_points: 210, adp: 18 }),
      ],
      draftTiming: { teamCount: 12, currentPick: 20, picksUntilNextTurn: 12 },
    });

    expect(rows[0].playerName).toBe("Early Value");
    expect(rows[0].suggestedDraftSpot.marketEdgePicks).toBeGreaterThan(0);
    expect(rows[0].suggestedDraftSpot.reason).toContain("timing");
    expect(rows.map((row) => row.playerName)).toEqual(["Early Value", "Second Value"]);
  });

  it("applies dynasty runway without using ADP as raw value", () => {
    const { rows } = buildBlackbirdBoard({
      players: [
        player({ player_name: "Younger RB", matched_player_id: "young", sleeper_player_id: "young", age: 27, projected_points: 288, adp: 27, rank: 31 }),
        player({ player_name: "Older RB", matched_player_id: "old", sleeper_player_id: "old", age: 32, projected_points: 293, adp: 18, rank: 30 }),
      ],
      leagueContext: {
        isDynasty: true,
        isSuperflex: true,
        isTwoQb: false,
        isBestBall: false,
        tePremium: 0,
        rosterPositions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "SUPER_FLEX"],
      },
      draftTiming: { teamCount: 12 },
    });

    expect(rows[0].playerName).toBe("Younger RB");
    expect(rows[0].dynastyAssetValue?.ageCurve.declineRisk).toBe("medium");
    expect(rows[1].dynastyAssetValue?.ageCurve.declineRisk).toBe("severe");
    expect(rows[1].suggestedDraftSpot.marketEdgePicks).not.toBeNull();
  });

  it("keeps board projection and detail projection consistent", () => {
    const { rows } = buildBlackbirdBoard({
      players: [player({ projected_points: 50 })],
      overlays: [overlay({ medianPoints: 275, floorPoints: 230, ceilingPoints: 315 })],
    });

    expect(rows[0].projectionPoints).toBe(275);
    expect(rows[0].playerDetailContext?.projectedFantasyPoints).toMatchObject({
      low: 230,
      median: 275,
      high: 315,
    });
  });

  it("surfaces contextual data gaps instead of fabricating missing context", () => {
    const { rows } = buildBlackbirdBoard({
      players: [player({ age: null, years_exp: null })],
      overlays: [overlay()],
    });

    expect(rows[0].contextualDataGaps).toEqual(expect.arrayContaining(["age", "years experience", "projected snap share"]));
  });

  it("does not emit banned board language", () => {
    const { rows, diagnostics } = buildBlackbirdBoard({
      players: [player({ player_name: "Safe Copy" })],
    });

    expect(diagnostics.bannedLanguageFound).toEqual([]);
    expect(findBannedBoardLanguage(JSON.stringify(rows))).toEqual([]);
    expect(findBannedBoardLanguage("must draft")).toEqual(["must draft"]);
  });

  it("builds deterministic player detail context with neighbors, explanations, and wait context", () => {
    const { rows } = buildBlackbirdBoard({
      players: [
        player({ player_name: "Alpha RB", matched_player_id: "a", projected_points: 210, adp: 30 }),
        player({ player_name: "Beta RB", matched_player_id: "b", projected_points: 205, adp: 35 }),
        player({ player_name: "Gamma RB", matched_player_id: "g", projected_points: 200, adp: 40 }),
      ],
      recommendations: [
        recommendation({ entityId: "a", displayName: "Alpha RB", recommendationRank: 1, recommendationScore: 88, needTimingAction: "monitor" }),
        recommendation({ entityId: "b", displayName: "Beta RB", recommendationRank: 2, recommendationScore: 84, needTimingAction: "wait_one_turn", waitPlanTargetCount: 2 }),
        recommendation({ entityId: "g", displayName: "Gamma RB", recommendationRank: 3, recommendationScore: 80 }),
      ],
    });

    const detail = rows[1].playerDetailContext;
    expect(detail).toMatchObject({
      playerName: "Beta RB",
      blackbirdRank: 2,
      timingAction: "wait_one_turn",
    });
    expect(detail?.whyBlackbirdLikes.length).toBeGreaterThan(0);
    expect(detail?.tierNeighborContext.previous[0].playerName).toBe("Alpha RB");
    expect(detail?.tierNeighborContext.next[0].playerName).toBe("Gamma RB");
    expect(detail?.waitPlanContext.join(" ")).toContain("2 wait-plan targets");
    expect(findBannedBoardLanguage(JSON.stringify(detail))).toEqual([]);
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
    floorPoints: overrides.floorPoints ?? 190,
    ceilingPoints: overrides.ceilingPoints ?? 250,
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
