import { describe, expect, it } from "vitest";

import { buildNormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import type { DraftTargetScorePlayer } from "@/lib/draft/scoring";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import { buildWarRoomRecommendations, type BuildWarRoomRecommendationsInput } from "./war-room-recommendations";

describe("buildWarRoomRecommendations", () => {
  it("does not let highest PAR alone always win when roster need is stronger", () => {
    const result = build({
      players: [
        player({ player_name: "Luxury WR", matched_player_id: "wr", position: "WR", rank: 1 }),
        player({ player_name: "Needed RB", matched_player_id: "rb", position: "RB", rank: 2 }),
      ],
      overlays: [
        overlay({ entityId: "wr", displayName: "Luxury WR", position: "WR", pointsAboveReplacement: 40, riskAdjustedValue: 40 }),
        overlay({ entityId: "rb", displayName: "Needed RB", position: "RB", pointsAboveReplacement: 25, riskAdjustedValue: 25 }),
      ],
      positionCounts: { RB: 0, WR: 5 },
      positionNeeds: [
        { position: "RB", draftedCount: 0, minimumNeed: 2, directStarterRequirement: 2, needLevel: "urgent" },
        { position: "WR", draftedCount: 5, minimumNeed: 3, directStarterRequirement: 2, needLevel: "filled" },
      ],
    });

    expect(result.rows[0].displayName).toBe("Needed RB");
  });

  it("tier cliff can elevate a lower-value player", () => {
    const result = build({
      players: [
        player({ player_name: "Tier Cliff TE", matched_player_id: "te", position: "TE", rank: 4 }),
        player({ player_name: "Crowded WR", matched_player_id: "wr1", position: "WR", rank: 3 }),
        player({ player_name: "Crowded WR 2", matched_player_id: "wr2", position: "WR", rank: 5 }),
      ],
      overlays: [
        overlay({ entityId: "te", displayName: "Tier Cliff TE", position: "TE", tier: 1, pointsAboveReplacement: 20, riskAdjustedValue: 20 }),
        overlay({ entityId: "wr1", displayName: "Crowded WR", position: "WR", tier: 1, pointsAboveReplacement: 24, riskAdjustedValue: 24 }),
        overlay({ entityId: "wr2", displayName: "Crowded WR 2", position: "WR", tier: 1, pointsAboveReplacement: 22, riskAdjustedValue: 22 }),
      ],
      rosterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX"],
      positionCounts: { TE: 0, WR: 2 },
      picksUntilMyNextPick: 6,
    });

    const te = result.rows.find((row) => row.displayName === "Tier Cliff TE")!;
    expect(te.scoreComponents.tierCliff).toBeGreaterThan(0);
    expect(te.explanationFragments.join(" ")).toContain("Tier cliff");
  });

  it("market value can break ties but does not dominate league value", () => {
    const result = build({
      players: [
        player({ player_name: "Higher Value", matched_player_id: "high", position: "RB", rank: 1 }),
        player({ player_name: "Market Nudge", matched_player_id: "market", position: "RB", rank: 2 }),
      ],
      overlays: [
        overlay({ entityId: "high", displayName: "Higher Value", position: "RB", pointsAboveReplacement: 35, riskAdjustedValue: 35, marketValueSignal: "below_market", marketRankDelta: -20 }),
        overlay({ entityId: "market", displayName: "Market Nudge", position: "RB", pointsAboveReplacement: 10, riskAdjustedValue: 10, marketValueSignal: "above_market", marketRankDelta: 20 }),
      ],
    });

    expect(result.rows[0].displayName).toBe("Higher Value");
    expect(result.rows.find((row) => row.displayName === "Market Nudge")!.scoreComponents.marketValue).toBeGreaterThan(
      result.rows.find((row) => row.displayName === "Higher Value")!.scoreComponents.marketValue
    );
  });

  it("low confidence reduces score and prevents priority target", () => {
    const result = build({
      players: [player({ matched_player_id: "p1" })],
      overlays: [overlay({ overlayStatus: "low_confidence", confidenceLabel: "very_low", warningCodes: ["LOW_PROJECTION_CONFIDENCE"], valueReadiness: "LOW_CONFIDENCE_BASELINE", pointsAboveReplacement: 100, riskAdjustedValue: 100 })],
    });

    expect(result.rows[0].scoreComponents.confidencePenalty).toBeLessThan(0);
    expect(result.rows[0].recommendationTier).not.toBe("priority_target");
  });

  it("low-confidence IDP can become watchlist with strong value and roster need", () => {
    const result = build({
      players: [player({ matched_player_id: "lb", position: "LB" })],
      overlays: [overlay({ entityId: "lb", position: "LB", pointsAboveReplacement: 35, riskAdjustedValue: 35, positionScarcityScore: 45, scarcityLabel: "high", overlayStatus: "low_confidence", confidenceLabel: "low", valueReadiness: "LOW_CONFIDENCE_BASELINE", warningCodes: ["LOW_PROJECTION_CONFIDENCE"] })],
      rosterSlots: ["QB", "RB", "WR", "TE", "IDP_FLEX"],
      positionCounts: { LB: 0 },
      positionNeeds: [{ position: "LB", draftedCount: 0, minimumNeed: 1, directStarterRequirement: 0, sharedFlexDemand: 1, needLevel: "high" }],
    });

    expect(["watchlist", "solid_target", "strong_target"]).toContain(result.rows[0].recommendationTier);
    expect(result.rows[0].recommendationTier).not.toBe("avoid_for_now");
  });

  it("low-confidence IDP can become solid target when score supports it", () => {
    const result = build({
      players: [
        player({ matched_player_id: "lb1", position: "LB" }),
        player({ matched_player_id: "lb2", position: "LB" }),
      ],
      overlays: [
        overlay({ entityId: "lb1", position: "LB", tier: 1, pointsAboveReplacement: 80, pointsAboveStarterCutline: 40, riskAdjustedValue: 80, positionScarcityScore: 80, scarcityLabel: "high", overlayStatus: "low_confidence", confidenceLabel: "low", valueReadiness: "LOW_CONFIDENCE_BASELINE", warningCodes: ["LOW_PROJECTION_CONFIDENCE"] }),
        overlay({ entityId: "lb2", position: "LB", tier: 2, pointsAboveReplacement: 5, pointsAboveStarterCutline: 0, riskAdjustedValue: 5, positionScarcityScore: 5, scarcityLabel: "low", overlayStatus: "low_confidence", confidenceLabel: "low", valueReadiness: "LOW_CONFIDENCE_BASELINE", warningCodes: ["LOW_PROJECTION_CONFIDENCE"] }),
      ],
      rosterSlots: ["QB", "RB", "WR", "TE", "LB", "IDP_FLEX"],
      positionCounts: { LB: 0 },
      positionNeeds: [{ position: "LB", draftedCount: 0, minimumNeed: 2, directStarterRequirement: 1, sharedFlexDemand: 1, needLevel: "urgent" }],
      picksUntilMyNextPick: 6,
    });

    const top = result.rows.find((row) => row.entityId === "lb1")!;
    expect(["solid_target", "strong_target"]).toContain(top.recommendationTier);
  });

  it("very-low confidence IDP cannot become priority target", () => {
    const result = build({
      players: [player({ matched_player_id: "db", position: "DB" })],
      overlays: [overlay({ entityId: "db", position: "DB", pointsAboveReplacement: 120, pointsAboveStarterCutline: 80, riskAdjustedValue: 120, positionScarcityScore: 90, scarcityLabel: "high", overlayStatus: "low_confidence", confidenceLabel: "very_low", valueReadiness: "LOW_CONFIDENCE_BASELINE", warningCodes: ["LOW_PROJECTION_CONFIDENCE"] })],
      rosterSlots: ["QB", "RB", "WR", "TE", "DB", "IDP_FLEX"],
      positionCounts: { DB: 0 },
      positionNeeds: [{ position: "DB", draftedCount: 0, minimumNeed: 2, directStarterRequirement: 1, sharedFlexDemand: 1, needLevel: "urgent" }],
    });

    expect(result.rows[0].recommendationTier).not.toBe("priority_target");
  });

  it("MARKET_NOT_IMPLEMENTED does not force IDP avoid_for_now", () => {
    const result = build({
      players: [player({ matched_player_id: "db", position: "DB" })],
      overlays: [overlay({ entityId: "db", position: "DB", pointsAboveReplacement: 45, riskAdjustedValue: 45, positionScarcityScore: 55, scarcityLabel: "high", overlayStatus: "low_confidence", confidenceLabel: "low", valueReadiness: "LOW_CONFIDENCE_BASELINE", marketValueSignal: "not_implemented", warningCodes: ["LOW_PROJECTION_CONFIDENCE", "MARKET_NOT_IMPLEMENTED"] })],
      rosterSlots: ["QB", "RB", "WR", "TE", "DB", "IDP_FLEX"],
      positionCounts: { DB: 0 },
      positionNeeds: [{ position: "DB", draftedCount: 0, minimumNeed: 2, directStarterRequirement: 1, sharedFlexDemand: 1, needLevel: "urgent" }],
    });

    expect(result.rows[0].warningCodes).toContain("MARKET_NOT_IMPLEMENTED");
    expect(result.rows[0].recommendationTier).not.toBe("avoid_for_now");
  });

  it("missing projection becomes insufficient_data", () => {
    const result = build({
      players: [player({ matched_player_id: null })],
      overlays: [overlay({ entityId: null, entityType: null, overlayStatus: "missing_projection", pointsAboveReplacement: null, riskAdjustedValue: null, warningCodes: ["H10_VALUE_OVERLAY_MISSING_PROJECTION"] })],
    });

    expect(result.rows[0]).toMatchObject({ status: "missing_projection", recommendationTier: "insufficient_data" });
  });

  it("format excluded and already drafted rows cannot be targets", () => {
    const result = build({
      players: [player({ matched_player_id: "fmt" }), player({ matched_player_id: "drafted", sleeper_player_id: "s-drafted" })],
      overlays: [overlay({ entityId: "fmt", overlayStatus: "format_excluded" }), overlay({ entityId: "drafted" })],
      draftedPlayerIds: ["s-drafted"],
    });

    expect(result.rows.find((row) => row.entityId === "fmt")!.recommendationTier).toBe("avoid_for_now");
    expect(result.rows.find((row) => row.entityId === "drafted")!.status).toBe("already_drafted");
  });

  it("Superflex increases QB urgency and IDP flex affects defensive positions", () => {
    const superflex = build({
      players: [player({ matched_player_id: "qb", position: "QB" })],
      overlays: [overlay({ entityId: "qb", position: "QB" })],
      rosterSlots: ["QB", "SUPER_FLEX", "RB", "WR", "TE"],
      positionCounts: { QB: 0 },
    });
    const idp = build({
      players: [player({ matched_player_id: "lb", position: "LB" })],
      overlays: [overlay({ entityId: "lb", position: "LB" })],
      rosterSlots: ["QB", "RB", "WR", "TE", "IDP_FLEX"],
      positionCounts: { LB: 0 },
    });

    expect(superflex.rows[0].scoreComponents.rosterNeed).toBeGreaterThan(10);
    expect(idp.rows[0].scoreComponents.rosterNeed).toBeGreaterThan(5);
  });

  it("K and DST are suppressed early", () => {
    const result = build({
      players: [player({ matched_player_id: "k", position: "K" }), player({ matched_player_id: "dst", position: "DEF" })],
      overlays: [overlay({ entityId: "k", position: "K" }), overlay({ entityId: "dst", entityType: "TEAM_DEFENSE", position: "DEF", valueReadiness: "SCORING_PARTIAL_ALLOWANCE_ONLY", overlayStatus: "dst_dry_run" })],
      rosterSlots: ["QB", "RB", "WR", "TE", "K", "DEF"],
      currentRound: 3,
    });

    expect(result.rows.find((row) => row.position === "K")!.warningCodes).toContain("K_EARLY_ROUND_SUPPRESSION");
    expect(result.rows.find((row) => row.position === "DEF")!.recommendationTier).not.toBe("priority_target");
  });

  it("no pick context avoids false urgency and emits a limitation", () => {
    const result = build({ picksUntilMyNextPick: null, currentPickNumber: null });

    expect(result.diagnostics.contextLimitations).toContain("NEXT_PICK_CONTEXT_MISSING");
    expect(result.rows[0].draftContext.tierDropBeforeNextPick).toBeNull();
    expect(result.rows[0].warningCodes).toContain("NEXT_PICK_CONTEXT_MISSING");
  });

  it("surfaces deterministic explanations, warnings, and no banned language", () => {
    const result = build({
      overlays: [overlay({ marketValueSignal: "no_compatible_market", warningCodes: ["NO_COMPATIBLE_MARKET"] })],
    });

    expect(result.rows[0].primaryReason.length).toBeGreaterThan(0);
    expect(result.rows[0].warningCodes).toContain("NO_COMPATIBLE_MARKET");
    expect(result.diagnostics.invariantFailures).toEqual([]);
  });

  it("emits IDP-specific score diagnostics", () => {
    const result = build({
      players: [player({ matched_player_id: "db", position: "DB" })],
      overlays: [overlay({ entityId: "db", position: "DB", overlayStatus: "low_confidence", confidenceLabel: "low", valueReadiness: "LOW_CONFIDENCE_BASELINE", warningCodes: ["LOW_PROJECTION_CONFIDENCE"] })],
      rosterSlots: ["QB", "RB", "WR", "TE", "DB"],
    });

    expect(result.diagnostics.idpRowsEvaluated).toBe(1);
    expect(result.diagnostics.idpAverageScoreComponents).not.toBeNull();
    expect(result.diagnostics.idpSuppressionReasons.LOW_PROJECTION_CONFIDENCE).toBe(1);
    expect(result.diagnostics.idpTopLeagueValueRows[0].displayName).toBe("Player");
  });

  it("does not mutate remaining players or H10 overlay and emits no forbidden fields", () => {
    const players = [player({ matched_player_id: "p1" })];
    const overlays = [overlay({ entityId: "p1" })];
    const playersBefore = JSON.stringify(players);
    const overlaysBefore = JSON.stringify(overlays);
    const result = build({ players, overlays });

    expect(JSON.stringify(players)).toBe(playersBefore);
    expect(JSON.stringify(overlays)).toBe(overlaysBefore);
    const keys = new Set(result.rows.flatMap((row) => Object.keys(row)));
    for (const forbidden of ["bestPick", "shouldDraft", "takeNow", "lockButton", "mustDraft", "guaranteed"]) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it("passes match coverage diagnostics through without changing recommendation rows", () => {
    const result = build({
      matchCoverageSummary: {
        leagueId: "league",
        rowsLoaded: 2,
        rowsMatched: 1,
        rowsUnmatched: 1,
        matchRate: 0.5,
        matchRateByPosition: { RB: { rows: 2, matched: 1, unmatched: 1, matchRate: 0.5 } },
        matchRateBySource: { "ranked:exact": { rows: 2, matched: 1, unmatched: 1, matchRate: 0.5 } },
        missingProjectionCount: 1,
        formatExcludedCount: 0,
        lowConfidenceCount: 0,
        classificationCounts: { MATCHED_BY_CANONICAL_ID: 1, MISSING_H10_VALUE_ROW: 1 },
        missingProjectionReasons: { CANONICAL_ID_HAS_NO_H10_VALUE_ROW: 1 },
        topMissingHighRankPlayers: [],
        topMissingHighAdpPlayers: [],
        highPriorityMissingProjectionExamples: [],
      },
    });

    expect(result.diagnostics.matchCoverageSummary?.rowsLoaded).toBe(2);
    expect(result.diagnostics.missingProjectionReasons).toEqual({ CANONICAL_ID_HAS_NO_H10_VALUE_ROW: 1 });
    expect(result.rows).toHaveLength(1);
  });

  it("is deterministic under input reordering", () => {
    const players = [player({ player_name: "B", matched_player_id: "b", rank: 2 }), player({ player_name: "A", matched_player_id: "a", rank: 1 })];
    const overlays = [overlay({ entityId: "b", displayName: "B" }), overlay({ entityId: "a", displayName: "A" })];
    const first = build({ players, overlays }).rows.map((row) => row.displayName);
    const second = build({ players: [...players].reverse(), overlays: [...overlays].reverse() }).rows.map((row) => row.displayName);

    expect(first).toEqual(second);
  });
});

type BuildOverrides = Partial<BuildWarRoomRecommendationsInput> & {
  rosterSlots?: string[];
  players?: DraftTargetScorePlayer[];
  overlays?: WarRoomValueOverlayRow[];
};

function build(overrides: BuildOverrides = {}) {
  const rosterSlots = overrides.rosterSlots ?? ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN"];
  const players = overrides.remainingPlayers ?? overrides.players ?? [player({ matched_player_id: "p1" })];
  const overlays = overrides.h10ValueOverlay ?? overrides.overlays ?? [overlay({ entityId: "p1" })];
  return buildWarRoomRecommendations({
    leagueId: "league",
    draftRoomId: "draft",
    remainingPlayers: players as DraftTargetScorePlayer[],
    h10ValueOverlay: overlays as WarRoomValueOverlayRow[],
    rosterRequirements: buildNormalizedRosterRequirements(rosterSlots),
    positionNeeds: overrides.positionNeeds,
    topNeeds: overrides.topNeeds,
    myRoster: overrides.myRoster,
    picks: overrides.picks,
    currentPickNumber: "currentPickNumber" in overrides ? (overrides.currentPickNumber ?? null) : 24,
    currentRound: "currentRound" in overrides ? (overrides.currentRound ?? null) : 2,
    picksUntilMyNextPick: "picksUntilMyNextPick" in overrides ? (overrides.picksUntilMyNextPick ?? null) : 12,
    draftedPlayerIds: overrides.draftedPlayerIds,
    positionCounts: overrides.positionCounts ?? {},
    includeDstDryRun: overrides.includeDstDryRun,
    matchCoverageSummary: overrides.matchCoverageSummary,
  });
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
  };
}
