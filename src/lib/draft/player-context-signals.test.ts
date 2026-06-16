import { describe, expect, it } from "vitest";

import { buildBlackbirdContextualValue } from "./blackbird-contextual-value";
import {
  buildPlayerContextSignals,
  buildPlayerContextSignalSummary,
  playerContextSignalsToSituationContext,
} from "./player-context-signals";
import type { WarRoomValueOverlayRow } from "./h10-war-room-overlay";
import type { ScoredDraftTarget } from "./scoring";

describe("H11 K.5 player context signals", () => {
  it("does not fabricate coaching, team environment, injury, or snap-share data", () => {
    const signals = buildPlayerContextSignals({
      playerId: "p1",
      playerName: "Context RB",
      position: "RB",
      team: "SEA",
      age: 24,
      yearsExperience: 2,
      projectionConfidence: "medium",
    });

    expect(signals.coachingEnvironment).toMatchObject({ score: null, label: "unknown" });
    expect(signals.teamEnvironment).toMatchObject({ score: null, label: "unknown" });
    expect(signals.projectedSnapShare).toBeNull();
    expect(signals.injuryRisk.label).toBe("unknown");
    expect(signals.dataGaps).toEqual(expect.arrayContaining(["actual snap share", "coaching environment", "team environment", "confirmed injury status"]));
    expect(signals.confidence).toBe("very_low");
  });

  it("derives role stability and injury risk only as historical proxies", () => {
    const signals = buildPlayerContextSignals({
      playerId: "p2",
      playerName: "Stable LB",
      position: "LB",
      team: "BAL",
      age: 26,
      yearsExperience: 4,
      historicalGamesPlayed: 16,
      historicalGamesPossible: 17,
      weeklyStatTotals: [7, 8, 6, 7, 8, 7, 6, 8],
      projectedVolume: 145,
      sameTeamPositionProjectedVolumes: [145, 82, 45],
      projectionConfidence: "high",
      matchStatus: "exact_id",
    });

    expect(signals.depthChartRole).toBe("starter");
    expect(signals.roleStability.label).toBe("high");
    expect(signals.roleStability.reasons.join(" ")).toContain("Derived proxy");
    expect(signals.injuryRisk.label).toBe("low");
    expect(signals.injuryRisk.reasons.join(" ")).toContain("Derived proxy");
    expect(signals.projectedSnapShare).toBeNull();
    expect(signals.confidence).toBe("medium");
  });

  it("labels rookies without volume as rookie unknown rather than assigning a role", () => {
    const signals = buildPlayerContextSignals({
      playerId: "rookie",
      playerName: "Rookie WR",
      position: "WR",
      age: 21,
      yearsExperience: 0,
      isRookie: true,
    });

    expect(signals.depthChartRole).toBe("rookie_unknown");
    expect(signals.dataGaps).toContain("confirmed depth chart role");
  });

  it("summarizes coverage and top data gaps", () => {
    const signals = [
      buildPlayerContextSignals({ playerId: "qb", playerName: "QB", position: "QB", age: 27, yearsExperience: 5, historicalGamesPlayed: 17, historicalGamesPossible: 17 }),
      buildPlayerContextSignals({ playerId: "db", playerName: "DB", position: "DB", historicalGamesPlayed: 8, historicalGamesPossible: 17 }),
    ];
    const summary = buildPlayerContextSignalSummary(signals);

    expect(summary.totalPlayers).toBe(2);
    expect(summary.playersWithAge).toBe(1);
    expect(summary.playersWithYearsExperience).toBe(1);
    expect(summary.playersWithInjuryRisk).toBe(2);
    expect(summary.topDataGaps.map((row) => row.gap)).toEqual(expect.arrayContaining(["coaching environment", "team environment"]));
  });

  it("feeds known context into contextual value while unknown fields remain neutral gaps", () => {
    const stableStarter = buildPlayerContextSignals({
      playerId: "stable",
      playerName: "Stable RB",
      position: "RB",
      team: "BUF",
      age: 24,
      yearsExperience: 3,
      historicalGamesPlayed: 17,
      historicalGamesPossible: 17,
      weeklyStatTotals: [12, 13, 11, 12, 13, 12, 11, 13],
      projectedVolume: 250,
      sameTeamPositionProjectedVolumes: [250, 80, 30],
      projectionConfidence: "high",
      matchStatus: "exact_id",
    });
    const unknown = buildPlayerContextSignals({ playerId: "unknown", playerName: "Unknown RB", position: "RB", age: 24, yearsExperience: 3 });

    const withContext = contextual("Stable RB", playerContextSignalsToSituationContext(stableStarter));
    const withoutContext = contextual("Unknown RB", playerContextSignalsToSituationContext(unknown));

    expect(withContext.valueScoreComponents.depthChartRole).toBeGreaterThan(withoutContext.valueScoreComponents.depthChartRole);
    expect(withContext.valueScoreComponents.situation).toBeGreaterThan(withoutContext.valueScoreComponents.situation);
    expect(withContext.dataGaps).toEqual(expect.arrayContaining(["actual snap share", "coaching environment", "team environment"]));
    expect(withoutContext.dataGaps).toEqual(expect.arrayContaining(["confirmed depth chart role", "role stability"]));
  });
});

function contextual(playerName: string, situationContext: ReturnType<typeof playerContextSignalsToSituationContext>) {
  return buildBlackbirdContextualValue({
    player: player({ matched_player_id: situationContext.playerId ?? null, player_name: playerName }),
    overlay: overlay({ entityId: situationContext.playerId ?? "p", displayName: playerName }),
    situationContext,
    leagueContext: {
      isDynasty: true,
      rosterPositions: ["QB", "RB", "WR", "TE"],
      scoringSettings: { rec: 1 },
    },
  });
}

function player(overrides: Partial<ScoredDraftTarget> = {}): ScoredDraftTarget {
  return {
    sleeper_player_id: null,
    matched_player_id: "p",
    player_name: "Player",
    position: "RB",
    team: "TST",
    age: 24,
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
    entityId: "p",
    entityType: "PLAYER",
    displayName: "Player",
    team: "TST",
    position: "RB",
    medianPoints: 220,
    floorPoints: 190,
    ceilingPoints: 260,
    pointsAboveReplacement: 30,
    pointsAboveStarterCutline: 12,
    riskAdjustedValue: 24,
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
