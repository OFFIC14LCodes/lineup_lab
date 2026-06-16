import type { BlackbirdLeagueContext } from "@/lib/draft/blackbird-contextual-value";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";

export const h1142LeagueContext: BlackbirdLeagueContext = {
  isDynasty: true,
  isBestBall: true,
  isSuperflex: true,
  tePremium: 1,
  hasIDP: true,
  hasKicker: true,
  hasTeamDefense: true,
  rosterPositions: ["QB", "OP", "RB", "RB", "WR", "WR", "TE", "FLEX", "DL", "LB", "DB", "K", "DEF"],
  scoringSettings: { rec: 1, sack: 6, tackle_solo: 2 },
};

export function h1142Players(): ScoredDraftTarget[] {
  return [
    player({ matched_player_id: "qb", sleeper_player_id: "sqb", player_name: "Superflex QB", position: "QB", projected_points: 335, adp: 8 }),
    player({ matched_player_id: "rb", sleeper_player_id: "srb", player_name: "Need RB", position: "RB", projected_points: 260, adp: 22 }),
    player({ matched_player_id: "wr", sleeper_player_id: "swr", player_name: "Ceiling WR", position: "WR", projected_points: 245, adp: 18, best_ball_value: 82 }),
    player({ matched_player_id: "te", sleeper_player_id: "ste", player_name: "Premium TE", position: "TE", projected_points: 220, adp: 30, te_premium_value: 80 }),
    player({ matched_player_id: "dl", sleeper_player_id: "sdl", player_name: "Starter DL", position: "DL", projected_points: 7, adp: 120 }),
    player({ matched_player_id: "lb", sleeper_player_id: "slb", player_name: "Starter LB", position: "LB", projected_points: 8, adp: 110 }),
    player({ matched_player_id: "db", sleeper_player_id: "sdb", player_name: "Starter DB", position: "DB", projected_points: 7, adp: 130 }),
    player({ matched_player_id: "k", sleeper_player_id: "sk", player_name: "Kicker", position: "K", projected_points: 115, adp: 160 }),
    player({ matched_player_id: "def", sleeper_player_id: "sdef", player_name: "Defense", position: "DEF", projected_points: 120, adp: 155 }),
  ];
}

export function h1142Overlays(): WarRoomValueOverlayRow[] {
  return [
    overlay({ entityId: "qb", displayName: "Superflex QB", position: "QB", medianPoints: 335, floorPoints: 280, ceilingPoints: 380, pointsAboveReplacement: 85, positionScarcityScore: 78 }),
    overlay({ entityId: "rb", displayName: "Need RB", position: "RB", medianPoints: 260, floorPoints: 210, ceilingPoints: 310, pointsAboveReplacement: 55, positionScarcityScore: 70 }),
    overlay({ entityId: "wr", displayName: "Ceiling WR", position: "WR", medianPoints: 245, floorPoints: 175, ceilingPoints: 335, pointsAboveReplacement: 45, positionScarcityScore: 58 }),
    overlay({ entityId: "te", displayName: "Premium TE", position: "TE", medianPoints: 220, floorPoints: 180, ceilingPoints: 275, pointsAboveReplacement: 42, positionScarcityScore: 65 }),
    overlay({ entityId: "dl", displayName: "Starter DL", position: "DL", medianPoints: 214, floorPoints: 170, ceilingPoints: 255, pointsAboveReplacement: 35, positionScarcityScore: 62, confidenceLabel: "medium", reasonCodes: ["IDP_V3_CORRECTED_SCALE"] }),
    overlay({ entityId: "lb", displayName: "Starter LB", position: "LB", medianPoints: 259, floorPoints: 205, ceilingPoints: 300, pointsAboveReplacement: 50, positionScarcityScore: 72, confidenceLabel: "medium", reasonCodes: ["IDP_V3_CORRECTED_SCALE"] }),
    overlay({ entityId: "db", displayName: "Starter DB", position: "DB", medianPoints: 196, floorPoints: 155, ceilingPoints: 235, pointsAboveReplacement: 28, positionScarcityScore: 55, confidenceLabel: "low", reasonCodes: ["IDP_V3_CORRECTED_SCALE"] }),
    overlay({ entityId: "k", displayName: "Kicker", position: "K", medianPoints: 115, floorPoints: 90, ceilingPoints: 135, pointsAboveReplacement: 6, positionScarcityScore: 35 }),
    overlay({ entityId: "def", displayName: "Defense", position: "DEF", medianPoints: 120, floorPoints: 80, ceilingPoints: 150, pointsAboveReplacement: 8, positionScarcityScore: 38 }),
  ];
}

export function player(overrides: Partial<ScoredDraftTarget> = {}): ScoredDraftTarget {
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

export function overlay(overrides: Partial<WarRoomValueOverlayRow> = {}): WarRoomValueOverlayRow {
  return {
    leagueId: "league",
    entityId: "m1",
    entityType: "PLAYER",
    displayName: "Player",
    team: "TST",
    position: "RB",
    medianPoints: 220,
    floorPoints: 180,
    ceilingPoints: 260,
    pointsAboveReplacement: 30,
    pointsAboveStarterCutline: 15,
    riskAdjustedValue: 25,
    confidenceAdjustedValue: 22,
    tier: 1,
    tierLabel: "Tier 1",
    positionScarcityScore: 60,
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
