import { describe, expect, it } from "vitest";

import { buildNormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import type { DraftTargetScorePlayer } from "@/lib/draft/scoring";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import { buildH10RecommendationPreviewPayload } from "./war-room-recommendation-preview-state";

describe("buildH10RecommendationPreviewPayload", () => {
  it("excludes H10 preview fields when disabled", () => {
    const payload = buildH10RecommendationPreviewPayload(baseInput({ enabled: false }));

    expect(payload).toEqual({});
  });

  it("includes H10 preview and diagnostics when enabled", () => {
    const payload = buildH10RecommendationPreviewPayload(baseInput({ enabled: true, legacyRecommendationCount: 2 }));

    expect(payload.h10RecommendationPreview?.length).toBe(1);
    expect(payload.h10RecommendationDiagnostics).toMatchObject({
      remainingPlayersLoaded: 1,
      overlayRowsLoaded: 1,
      recommendationsGenerated: 1,
    });
    expect(payload.h10RecommendationExperimentDiagnostics).toMatchObject({
      legacyReady: true,
      blackbirdPreviewReady: true,
      blackbirdExperimentEligible: true,
      failedExperimentGates: [],
    });
  });

  it("does not mutate remaining players, overlay rows, or legacy recommendations passed by callers", () => {
    const remainingPlayers = [player()];
    const h10ValueOverlay = [overlay()];
    const legacyRecommendations = [player({ player_name: "Legacy Target" })];
    const beforePlayers = JSON.stringify(remainingPlayers);
    const beforeOverlay = JSON.stringify(h10ValueOverlay);
    const beforeLegacy = JSON.stringify(legacyRecommendations);

    buildH10RecommendationPreviewPayload(baseInput({ enabled: true, remainingPlayers, h10ValueOverlay }));

    expect(JSON.stringify(remainingPlayers)).toBe(beforePlayers);
    expect(JSON.stringify(h10ValueOverlay)).toBe(beforeOverlay);
    expect(JSON.stringify(legacyRecommendations)).toBe(beforeLegacy);
  });

  it("empty overlay produces diagnostics instead of a fatal state failure", () => {
    const payload = buildH10RecommendationPreviewPayload(baseInput({ enabled: true, h10ValueOverlay: [] }));

    expect(payload.h10RecommendationPreview?.[0].recommendationTier).toBe("insufficient_data");
    expect(payload.h10RecommendationDiagnostics?.contextLimitations).toContain("H10_VALUE_OVERLAY_MISSING");
    expect(payload.h10RecommendationExperimentDiagnostics?.blackbirdExperimentEligible).toBe(false);
  });
});

function baseInput(overrides: Partial<Parameters<typeof buildH10RecommendationPreviewPayload>[0]> = {}) {
  return {
    enabled: true,
    leagueId: "league",
    draftRoomId: "draft",
    remainingPlayers: [player()],
    h10ValueOverlay: [overlay()],
    rosterRequirements: buildNormalizedRosterRequirements(["QB", "RB", "RB", "WR", "WR", "TE", "FLEX"]),
    positionNeeds: [{ position: "RB", draftedCount: 0, minimumNeed: 2, directStarterRequirement: 2, needLevel: "urgent" }],
    topNeeds: [{ position: "RB", current: 0, target: 2, needLevel: "urgent" }],
    myRoster: [],
    picks: [],
    currentPickNumber: 12,
    currentRound: 2,
    picksUntilMyNextPick: 10,
    draftedPlayerIds: [],
    positionCounts: {},
    matchCoverageSummary: {
      leagueId: "league",
      rowsLoaded: 1,
      rowsMatched: 1,
      rowsUnmatched: 0,
      matchRate: 1,
      matchRateByPosition: {},
      matchRateBySource: {},
      missingProjectionCount: 0,
      formatExcludedCount: 0,
      lowConfidenceCount: 0,
      classificationCounts: {},
      missingProjectionReasons: {},
      topMissingHighRankPlayers: [],
      topMissingHighAdpPlayers: [],
      highPriorityMissingProjectionExamples: [],
    },
    ...overrides,
  };
}

function player(overrides: Partial<DraftTargetScorePlayer> = {}): DraftTargetScorePlayer {
  return {
    sleeper_player_id: "sleeper",
    matched_player_id: "p1",
    player_name: "Preview Player",
    position: "RB",
    team: "DAL",
    rank: 1,
    adp: 12,
    projected_points: 200,
    dynasty_value: null,
    best_ball_value: null,
    superflex_value: null,
    te_premium_value: null,
    match_status: "exact",
    match_confidence: 1,
    is_ranked: true,
    is_fallback: false,
    ...overrides,
  };
}

function overlay(overrides: Partial<WarRoomValueOverlayRow> = {}): WarRoomValueOverlayRow {
  return {
    leagueId: "league",
    entityId: "p1",
    entityType: "PLAYER",
    displayName: "Preview Player",
    team: "DAL",
    position: "RB",
    medianPoints: 200,
    pointsAboveReplacement: 30,
    pointsAboveStarterCutline: 10,
    riskAdjustedValue: 25,
    confidenceAdjustedValue: 24,
    tier: 1,
    tierLabel: "Tier 1",
    positionScarcityScore: 30,
    scarcityLabel: "medium",
    marketValueSignal: "aligned",
    marketRankDelta: 0,
    confidenceLabel: "medium",
    riskLabel: "medium",
    valueReadiness: "READY",
    warningCodes: [],
    reasonCodes: [],
    draftRelevance: "draft_relevant",
    overlayStatus: "available",
    ...overrides,
    floorPoints: overrides.floorPoints ?? 180,
    ceilingPoints: overrides.ceilingPoints ?? 220,
  };
}
