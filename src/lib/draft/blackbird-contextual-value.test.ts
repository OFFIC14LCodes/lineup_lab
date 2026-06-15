import { describe, expect, it } from "vitest";

import { buildBlackbirdContextualValue, assignBlackbirdRanks, type BlackbirdLeagueContext } from "./blackbird-contextual-value";
import type { ScoredDraftTarget } from "./scoring";
import type { WarRoomValueOverlayRow } from "./h10-war-room-overlay";

describe("H11.4.1 Blackbird contextual value", () => {
  it("keeps projected fantasy points separate from contextual value score", () => {
    const value = contextual({ projected_points: 240 }, overlay({ medianPoints: 240, floorPoints: 210, ceilingPoints: 270 }));

    expect(value.projectedFantasyPoints).toMatchObject({ low: 210, median: 240, high: 270, scoringAware: true });
    expect(value.valueScore).not.toBe(240);
    expect(value.valueScoreComponents.projectionValue).toBeTypeOf("number");
  });

  it("lifts younger comparable players in dynasty", () => {
    const young = contextual({ player_name: "Young RB", age: 23, dynasty_value: 70 }, overlay({ entityId: "young", displayName: "Young RB" }), { isDynasty: true });
    const older = contextual({ player_name: "Older RB", age: 30, dynasty_value: 70 }, overlay({ entityId: "older", displayName: "Older RB" }), { isDynasty: true });

    expect(young.valueScoreComponents.ageCurve).toBeGreaterThan(older.valueScoreComponents.ageCurve);
    expect(young.valueScore).toBeGreaterThan(older.valueScore);
  });

  it("keeps redraft age mostly neutral compared with dynasty", () => {
    const redraftYoung = contextual({ player_name: "Young WR", position: "WR", age: 24 }, overlay({ displayName: "Young WR", position: "WR" }), { isDynasty: false });
    const redraftOlder = contextual({ player_name: "Older WR", position: "WR", age: 29 }, overlay({ displayName: "Older WR", position: "WR" }), { isDynasty: false });
    const dynastyOlder = contextual({ player_name: "Dynasty Older WR", position: "WR", age: 29 }, overlay({ displayName: "Dynasty Older WR", position: "WR" }), { isDynasty: true });

    expect(Math.abs(redraftYoung.valueScore - redraftOlder.valueScore)).toBeLessThan(3);
    expect(redraftOlder.valueScore).toBeGreaterThan(dynastyOlder.valueScore);
  });

  it("rewards ceiling shape in best ball", () => {
    const bestBall = contextual({}, overlay({ floorPoints: 160, medianPoints: 210, ceilingPoints: 330 }), { isBestBall: true });
    const managed = contextual({}, overlay({ floorPoints: 160, medianPoints: 210, ceilingPoints: 330 }), { isBestBall: false });

    expect(bestBall.valueScoreComponents.bestBallFit).toBeGreaterThan(managed.valueScoreComponents.bestBallFit);
    expect(bestBall.valueScore).toBeGreaterThan(managed.valueScore);
  });

  it("boosts quarterbacks in superflex and tight ends in TE premium", () => {
    const superflexQb = contextual({ position: "QB" }, overlay({ position: "QB" }), { isSuperflex: true, rosterPositions: ["QB", "RB", "WR", "TE", "OP"] });
    const standardQb = contextual({ position: "QB" }, overlay({ position: "QB" }), { isSuperflex: false, rosterPositions: ["QB", "RB", "WR", "TE"] });
    const premiumTe = contextual({ position: "TE" }, overlay({ position: "TE" }), { tePremium: 1, rosterPositions: ["QB", "RB", "WR", "TE"] });
    const standardTe = contextual({ position: "TE" }, overlay({ position: "TE" }), { tePremium: 0, rosterPositions: ["QB", "RB", "WR", "TE"] });

    expect(superflexQb.valueScore).toBeGreaterThan(standardQb.valueScore);
    expect(premiumTe.valueScore).toBeGreaterThan(standardTe.valueScore);
  });

  it("handles IDP value with explicit league context and data gaps", () => {
    const idp = contextual(
      { position: "LB", player_name: "IDP Starter" },
      overlay({ position: "LB", displayName: "IDP Starter", medianPoints: 220, floorPoints: 180, ceilingPoints: 260, confidenceLabel: "medium" }),
      { hasIDP: true, rosterPositions: ["LB", "IDP_FLEX"], scoringSettings: { sack: 6, tackle_solo: 2 } }
    );

    expect(idp.valueScoreComponents.idpFormatFit).toBeGreaterThan(50);
    expect(idp.dataGaps).toEqual(expect.arrayContaining(["projected snap share", "depth chart role"]));
  });

  it("does not use ADP as a contextual value input", () => {
    const earlyAdp = contextual({ player_name: "Early ADP", adp: 1 }, overlay({ displayName: "Early ADP" }));
    const lateAdp = contextual({ player_name: "Late ADP", adp: 250 }, overlay({ displayName: "Late ADP" }));

    expect(earlyAdp.valueScore).toBe(lateAdp.valueScore);
  });

  it("separates same-position ties and assigns deterministic ranks", () => {
    const ranked = assignBlackbirdRanks([
      contextual({ player_name: "Alpha", matched_player_id: "a" }, overlay({ entityId: "a", displayName: "Alpha", medianPoints: 205, pointsAboveReplacement: 18 })),
      contextual({ player_name: "Beta", matched_player_id: "b" }, overlay({ entityId: "b", displayName: "Beta", medianPoints: 230, pointsAboveReplacement: 35 })),
    ]);

    expect(ranked[0]).toMatchObject({ playerName: "Beta", blackbirdRank: 1 });
    expect(ranked[1]).toMatchObject({ playerName: "Alpha", blackbirdRank: 2 });
  });
});

function contextual(
  playerOverrides: Partial<ScoredDraftTarget> = {},
  overlayRow: WarRoomValueOverlayRow = overlay(),
  leagueContext: BlackbirdLeagueContext = {}
) {
  return buildBlackbirdContextualValue({
    player: player(playerOverrides),
    overlay: overlayRow,
    leagueContext: {
      rosterPositions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN"],
      scoringSettings: { rec: 1 },
      ...leagueContext,
    },
    positionPeers: [
      { projection: 150, floor: 120, ceiling: 180, par: 5, value: 5 },
      { projection: 260, floor: 220, ceiling: 310, par: 45, value: 45 },
    ],
  });
}

function player(overrides: Partial<ScoredDraftTarget> = {}): ScoredDraftTarget {
  return {
    sleeper_player_id: "s1",
    matched_player_id: "m1",
    player_name: "Player",
    position: "RB",
    team: "TST",
    age: 25,
    years_exp: 3,
    rank: 10,
    adp: null,
    projected_points: 220,
    dynasty_value: 65,
    best_ball_value: 60,
    superflex_value: 55,
    te_premium_value: 55,
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
