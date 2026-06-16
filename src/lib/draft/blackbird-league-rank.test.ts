import { describe, expect, it } from "vitest";

import { buildBlackbirdLeagueRank, findBannedLeagueRankLanguage } from "./blackbird-league-rank";
import type { WarRoomValueOverlayRow } from "./h10-war-room-overlay";
import type { ScoredDraftTarget } from "./scoring";

describe("H11.4.2 Blackbird league rank", () => {
  it("includes drafted and undrafted players with stable ranks", () => {
    const players = [
      player({ matched_player_id: "a", sleeper_player_id: "sa", player_name: "Alpha", projected_points: 240 }),
      player({ matched_player_id: "b", sleeper_player_id: "sb", player_name: "Beta", projected_points: 220 }),
    ];
    const first = buildBlackbirdLeagueRank({ players, draftedPlayerIds: [] }).rows;
    const afterPick = buildBlackbirdLeagueRank({ players, draftedPlayerIds: ["sa"] }).rows;

    expect(afterPick).toHaveLength(2);
    expect(afterPick.find((row) => row.playerName === "Alpha")?.drafted).toBe(true);
    expect(afterPick.map((row) => [row.playerName, row.blackbirdRank])).toEqual(first.map((row) => [row.playerName, row.blackbirdRank]));
  });

  it("does not use ADP as the rank fallback", () => {
    const { rows } = buildBlackbirdLeagueRank({
      players: [
        player({ matched_player_id: "adp", player_name: "ADP One", adp: 1, projected_points: 100 }),
        player({ matched_player_id: "value", player_name: "Value One", adp: 250, projected_points: 260 }),
      ],
    });

    expect(rows[0].playerName).toBe("Value One");
    expect(rows[0].source.adp).toBe(250);
  });

  it("labels projection units and fallback projections", () => {
    const { rows } = buildBlackbirdLeagueRank({
      players: [player({ is_fallback: true, projected_points: 80 })],
    });

    expect(rows[0].projectedFantasyPoints.unit).toBe("fallback");
    expect(rows[0].source.fallbackProjection).toBe(true);
  });

  it("keeps corrected IDP overlay scale as season projection", () => {
    const { rows } = buildBlackbirdLeagueRank({
      players: [player({ matched_player_id: "lb", player_name: "LB Starter", position: "LB", projected_points: 7 })],
      overlays: [overlay({ entityId: "lb", displayName: "LB Starter", position: "LB", medianPoints: 259, floorPoints: 210, ceilingPoints: 295 })],
      leagueContext: { hasIDP: true, rosterPositions: ["LB"], scoringSettings: { sack: 6, tackle_solo: 2 } },
    });

    expect(rows[0].projectedFantasyPoints.median).toBe(259);
    expect(rows[0].projectedFantasyPoints.unit).toBe("season");
  });

  it("does not emit banned language", () => {
    const { rows, diagnostics } = buildBlackbirdLeagueRank({ players: [player()] });
    expect(diagnostics.bannedLanguageFound).toEqual([]);
    expect(findBannedLeagueRankLanguage(JSON.stringify(rows))).toEqual([]);
  });
});

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
    adp: 12,
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
    floorPoints: 190,
    ceilingPoints: 250,
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
