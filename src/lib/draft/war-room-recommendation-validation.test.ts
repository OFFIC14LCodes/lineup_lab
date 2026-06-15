import { describe, expect, it } from "vitest";

import type { DraftTargetScorePlayer } from "@/lib/draft/scoring";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import { buildNormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import { buildWarRoomRecommendations, type WarRoomRecommendationResult } from "@/lib/draft/war-room-recommendations";
import {
  buildPerRoomValidation,
  buildValidationReadiness,
  classifyRosterFormats,
  type H10WarRoomInventoryRow,
} from "./war-room-recommendation-validation";

describe("H10 War Room recommendation validation", () => {
  it("classifies common league formats", () => {
    const formats = classifyRosterFormats({
      rosterSlots: ["QB", "SUPER_FLEX", "RB", "WR", "TE", "TE", "K", "DEF", "LB", "BN", "BN"],
      tePremium: 1.5,
    });

    expect(formats.isSuperflex).toBe(true);
    expect(formats.isTEPremium).toBe(true);
    expect(formats.requirements.hasIDP).toBe(true);
    expect(formats.requirements.hasKicker).toBe(true);
    expect(formats.requirements.hasTeamDefense).toBe(true);
  });

  it("validates a 1QB offensive room with target tiers", () => {
    const result = recommendations({
      players: [
        player({ matched_player_id: "rb", position: "RB", player_name: "Target RB" }),
        player({ matched_player_id: "wr", position: "WR", player_name: "Depth WR", rank: 20 }),
      ],
      overlays: [
        overlay({ entityId: "rb", position: "RB", pointsAboveReplacement: 55, pointsAboveStarterCutline: 30, riskAdjustedValue: 55, positionScarcityScore: 70, scarcityLabel: "high" }),
        overlay({ entityId: "wr", position: "WR", pointsAboveReplacement: 10, riskAdjustedValue: 10, positionScarcityScore: 10, scarcityLabel: "low" }),
      ],
      rosterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX"],
      positionCounts: { RB: 0 },
      positionNeeds: [{ position: "RB", draftedCount: 0, minimumNeed: 3, directStarterRequirement: 2, sharedFlexDemand: 1, needLevel: "urgent" }],
    });
    const validation = roomValidation(result, inventory({ has_uploaded_rankings: true, positions_present: ["RB", "WR"] }));

    expect(validation.thresholdResults.offensiveTargetTierPass).toBe(true);
    expect(["priority_target", "strong_target", "solid_target", "watchlist"]).toContain(validation.topRecommendations[0].recommendationTier);
  });

  it("validates Superflex QB urgency", () => {
    const result = recommendations({
      players: [player({ matched_player_id: "qb", position: "QB" }), player({ matched_player_id: "rb", position: "RB" })],
      overlays: [overlay({ entityId: "qb", position: "QB" }), overlay({ entityId: "rb", position: "RB" })],
      rosterSlots: ["QB", "SUPER_FLEX", "RB", "WR", "TE"],
      positionCounts: { QB: 0, RB: 1 },
    });
    const validation = roomValidation(result, inventory({ isSuperflex: true, positions_present: ["QB", "RB"] }));

    expect(validation.thresholdResults.superflexQbUrgencyPass).toBe(true);
    expect(validation.formatDiagnostics).toMatchObject({ superflexQbUrgencyApplied: true });
  });

  it("validates TE premium value is preserved when TE is valuable", () => {
    const result = recommendations({
      players: [player({ matched_player_id: "te", position: "TE", player_name: "Premium TE" }), player({ matched_player_id: "wr", position: "WR" })],
      overlays: [
        overlay({ entityId: "te", position: "TE", pointsAboveReplacement: 65, pointsAboveStarterCutline: 40, riskAdjustedValue: 65, positionScarcityScore: 80, scarcityLabel: "high" }),
        overlay({ entityId: "wr", position: "WR", pointsAboveReplacement: 12, riskAdjustedValue: 12 }),
      ],
      rosterSlots: ["QB", "RB", "WR", "TE", "FLEX"],
      positionCounts: { TE: 0 },
      positionNeeds: [{ position: "TE", draftedCount: 0, minimumNeed: 1, directStarterRequirement: 1, needLevel: "high" }],
    });
    const validation = roomValidation(result, inventory({ isTEPremium: true, positions_present: ["TE", "WR"] }));

    expect(validation.topRecommendations[0].position).toBe("TE");
    expect(validation.thresholdResults.offensiveTargetTierPass).toBe(true);
  });

  it("keeps K and DST out of priority target early", () => {
    const result = recommendations({
      players: [player({ matched_player_id: "k", position: "K" }), player({ matched_player_id: "dst", position: "DEF" })],
      overlays: [
        overlay({ entityId: "k", position: "K", pointsAboveReplacement: 90, riskAdjustedValue: 90 }),
        overlay({ entityId: "dst", entityType: "TEAM_DEFENSE", position: "DEF", pointsAboveReplacement: 90, riskAdjustedValue: 90, overlayStatus: "dst_dry_run", valueReadiness: "SCORING_PARTIAL_ALLOWANCE_ONLY" }),
      ],
      rosterSlots: ["QB", "RB", "WR", "TE", "K", "DEF"],
      currentRound: 3,
    });
    const validation = roomValidation(result, inventory({ hasKicker: true, hasTeamDefense: true, positions_present: ["K", "DEF"] }));

    expect(validation.thresholdResults.kEarlySuppressionPass).toBe(true);
    expect(validation.thresholdResults.dstEarlySuppressionPass).toBe(true);
  });

  it("allows IDP watchlist behavior while fallback-only missing projections stay conservative", () => {
    const idp = recommendations({
      players: [player({ matched_player_id: "lb", position: "LB" })],
      overlays: [overlay({ entityId: "lb", position: "LB", overlayStatus: "low_confidence", confidenceLabel: "low", valueReadiness: "LOW_CONFIDENCE_BASELINE", warningCodes: ["LOW_PROJECTION_CONFIDENCE"], pointsAboveReplacement: 45, riskAdjustedValue: 45, positionScarcityScore: 70, scarcityLabel: "high" })],
      rosterSlots: ["QB", "RB", "WR", "TE", "IDP_FLEX"],
      positionCounts: { LB: 0 },
      positionNeeds: [{ position: "LB", draftedCount: 0, minimumNeed: 1, sharedFlexDemand: 1, needLevel: "high" }],
    });
    const fallbackOnly = recommendations({
      players: [player({ matched_player_id: null, position: "RB", is_ranked: false, is_fallback: true })],
      overlays: [overlay({ entityId: null, position: "RB", overlayStatus: "missing_projection", warningCodes: ["H10_VALUE_OVERLAY_MISSING_PROJECTION"] })],
    });

    expect(idp.rows[0].recommendationTier).not.toBe("avoid_for_now");
    expect(fallbackOnly.rows[0].recommendationTier).toBe("insufficient_data");
  });

  it("fails readiness when legacy rows or remaining order change", () => {
    const result = recommendations();
    const validation = roomValidation(result, inventory(), { legacyRowsChanged: true, remainingPlayersOrderChanged: true });
    const readiness = buildValidationReadiness({ inventory: [inventory()], roomResults: [validation] });

    expect(validation.thresholdResults.legacyUnchangedPass).toBe(false);
    expect(validation.thresholdResults.remainingOrderUnchangedPass).toBe(false);
    expect(readiness.verdict).not.toBe("ready");
  });
});

function recommendations(overrides: {
  players?: DraftTargetScorePlayer[];
  overlays?: WarRoomValueOverlayRow[];
  rosterSlots?: string[];
  positionCounts?: Record<string, number>;
  positionNeeds?: unknown;
  currentRound?: number;
} = {}): WarRoomRecommendationResult {
  const players = overrides.players ?? [player()];
  const overlays = overrides.overlays ?? [overlay()];
  return buildWarRoomRecommendations({
    leagueId: "league",
    draftRoomId: "draft",
    remainingPlayers: players,
    h10ValueOverlay: overlays,
    rosterRequirements: buildNormalizedRosterRequirements(overrides.rosterSlots ?? ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX"]),
    positionNeeds: overrides.positionNeeds,
    topNeeds: overrides.positionNeeds,
    myRoster: [],
    picks: [],
    currentPickNumber: 24,
    currentRound: overrides.currentRound ?? 2,
    picksUntilMyNextPick: 12,
    draftedPlayerIds: [],
    positionCounts: overrides.positionCounts ?? {},
    includeDstDryRun: true,
    matchCoverageSummary: {
      leagueId: "league",
      rowsLoaded: players.length,
      rowsMatched: overlays.filter((row) => row.overlayStatus !== "missing_projection").length,
      rowsUnmatched: overlays.filter((row) => row.overlayStatus === "missing_projection").length,
      matchRate: overlays.filter((row) => row.overlayStatus !== "missing_projection").length / Math.max(1, players.length),
      matchRateByPosition: {},
      matchRateBySource: {},
      missingProjectionCount: overlays.filter((row) => row.overlayStatus === "missing_projection").length,
      formatExcludedCount: 0,
      lowConfidenceCount: 0,
      classificationCounts: {},
      missingProjectionReasons: {},
      topMissingHighRankPlayers: [],
      topMissingHighAdpPlayers: [],
      highPriorityMissingProjectionExamples: [],
    },
  });
}

function roomValidation(
  result: WarRoomRecommendationResult,
  inv: H10WarRoomInventoryRow,
  overrides: { legacyRowsChanged?: boolean; remainingPlayersOrderChanged?: boolean } = {}
) {
  return buildPerRoomValidation({
    inventory: inv,
    recommendations: result,
    legacyRecommendationTopRows: [],
    legacyRowsChanged: overrides.legacyRowsChanged ?? false,
    remainingPlayersOrderChanged: overrides.remainingPlayersOrderChanged ?? false,
  });
}

function inventory(overrides: Partial<H10WarRoomInventoryRow> = {}): H10WarRoomInventoryRow {
  return {
    source: "fixture",
    draftRoomId: "draft",
    leagueId: "league",
    leagueName: "League",
    season: 2026,
    has_uploaded_rankings: false,
    remaining_player_count: 1,
    fallback_row_count: 1,
    ranked_row_count: 0,
    positions_present: ["RB"],
    hasIDP: false,
    hasKicker: false,
    hasTeamDefense: false,
    isSuperflex: false,
    is2QB: false,
    isTEPremium: false,
    benchDepth: 6,
    currentPickKnown: true,
    picksUntilMyNextPickKnown: true,
    legacyRecommendationCount: 0,
    h10PreviewEnabledPossible: true,
    ...overrides,
  };
}

function player(overrides: Partial<DraftTargetScorePlayer> = {}): DraftTargetScorePlayer {
  return {
    sleeper_player_id: "sleeper",
    matched_player_id: "p1",
    player_name: "Player",
    position: "RB",
    team: "DAL",
    rank: 1,
    adp: 20,
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
    displayName: "Player",
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
