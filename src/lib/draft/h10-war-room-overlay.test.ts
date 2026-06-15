import { describe, expect, it } from "vitest";

import { buildNormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import type { DraftTargetScorePlayer } from "./scoring";
import { buildWarRoomValueOverlay } from "./h10-war-room-overlay";
import type { H10LeagueValueRow } from "@/lib/projections/h10-league-value";

describe("buildWarRoomValueOverlay", () => {
  it("matches by canonical matched_player_id and preserves H10 values", () => {
    const result = buildWarRoomValueOverlay({
      leagueId: "l1",
      players: [player({ matched_player_id: "p1" })],
      valueRows: [valueRow({ entityId: "p1", pointsAboveReplacement: 42, marketValueSignal: "above_market" })],
      rosterRequirements: requirements(["QB", "RB"]),
    });

    expect(result.rows[0]).toMatchObject({
      entityId: "p1",
      overlayStatus: "available",
      pointsAboveReplacement: 42,
      marketValueSignal: "above_market",
    });
  });

  it("returns missing_projection without name-only matching", () => {
    const result = buildWarRoomValueOverlay({
      leagueId: "l1",
      players: [player({ matched_player_id: null, sleeper_player_id: null, player_name: "Same Name" })],
      valueRows: [valueRow({ entityId: "different-id", displayName: "Same Name", team: "BUF" })],
      rosterRequirements: requirements(["QB", "RB"]),
    });

    expect(result.rows[0].overlayStatus).toBe("missing_projection");
    expect(result.rows[0].warningCodes).toContain("H10_VALUE_OVERLAY_MISSING_PROJECTION");
    expect(result.diagnostics.matchCoverageSummary.classificationCounts.MISSING_CANONICAL_ID).toBe(1);
    expect(result.diagnostics.missingProjectionReasons.NO_CANONICAL_OR_SLEEPER_ID).toBe(1);
  });

  it("matches by Sleeper crosswalk when supplied", () => {
    const result = buildWarRoomValueOverlay({
      leagueId: "l1",
      players: [player({ matched_player_id: null, sleeper_player_id: "s1" })],
      valueRows: [valueRow({ entityId: "p1" })],
      rosterRequirements: requirements(["QB", "RB"]),
      sleeperToCanonicalId: { s1: "p1" },
    });

    expect(result.rows[0].entityId).toBe("p1");
  });

  it("matches DST by exact team identity and marks dry-run only when enabled", () => {
    const result = buildWarRoomValueOverlay({
      leagueId: "l1",
      players: [player({ position: "DEF", team: "DAL", matched_player_id: null })],
      valueRows: [valueRow({ entityId: "DAL", entityType: "TEAM_DEFENSE", position: "DST", positionGroup: "DST", team: "DAL", valueReadiness: "SCORING_PARTIAL_ALLOWANCE_ONLY", warningCodes: ["DST_DRY_RUN_ONLY"] })],
      rosterRequirements: requirements(["DST"]),
      includeDstDryRun: true,
    });

    expect(result.rows[0]).toMatchObject({ entityType: "TEAM_DEFENSE", overlayStatus: "dst_dry_run" });
  });

  it("marks IDP, K, and DST format excluded when league does not roster them", () => {
    const result = buildWarRoomValueOverlay({
      leagueId: "l1",
      players: [
        player({ matched_player_id: "lb", position: "LB" }),
        player({ matched_player_id: "k", position: "K" }),
        player({ matched_player_id: "dst", position: "DEF" }),
      ],
      valueRows: [
        valueRow({ entityId: "lb", position: "LB", positionGroup: "LB" }),
        valueRow({ entityId: "k", position: "K", positionGroup: "K" }),
        valueRow({ entityId: "dst", entityType: "TEAM_DEFENSE", position: "DST", positionGroup: "DST" }),
      ],
      rosterRequirements: requirements(["QB", "RB"]),
    });

    expect(result.rows.map((row) => row.overlayStatus)).toEqual(["format_excluded", "format_excluded", "format_excluded"]);
  });

  it("includeAllPositions overrides IDP/K format exclusion but not DST dry-run disabled status", () => {
    const result = buildWarRoomValueOverlay({
      leagueId: "l1",
      players: [player({ matched_player_id: "lb", position: "LB" }), player({ matched_player_id: "k", position: "K" })],
      valueRows: [valueRow({ entityId: "lb", position: "LB", positionGroup: "LB" }), valueRow({ entityId: "k", position: "K", positionGroup: "K" })],
      rosterRequirements: requirements(["QB", "RB"]),
      includeAllPositions: true,
    });

    expect(result.rows.map((row) => row.overlayStatus)).toEqual(["available", "available"]);
  });

  it("preserves warning codes, input order, and emits no recommendation fields", () => {
    const players = [player({ matched_player_id: "p2", player_name: "Second" }), player({ matched_player_id: "p1", player_name: "First" })];
    const result = buildWarRoomValueOverlay({
      leagueId: "l1",
      players,
      valueRows: [valueRow({ entityId: "p1" }), valueRow({ entityId: "p2", warningCodes: ["LOW_PROJECTION_CONFIDENCE"], riskLabel: "high" })],
      rosterRequirements: requirements(["QB", "RB"]),
    });

    expect(result.rows.map((row) => row.displayName)).toEqual(["Second", "First"]);
    expect(result.rows[0].warningCodes).toContain("LOW_PROJECTION_CONFIDENCE");
    expect(result.rows[0].overlayStatus).toBe("low_confidence");
    const keys = new Set(result.rows.flatMap((row) => Object.keys(row)));
    for (const forbidden of ["recommendation", "shouldDraft", "bestPick", "pickGrade", "takeNow", "avoidNow"]) {
      expect(keys.has(forbidden)).toBe(false);
    }
    expect(result.diagnostics.invariantFailures).toEqual([]);
  });

  it("adds match coverage diagnostics without changing overlay row order", () => {
    const result = buildWarRoomValueOverlay({
      leagueId: "l1",
      players: [player({ matched_player_id: "p1", player_name: "Matched" }), player({ matched_player_id: "missing", player_name: "Missing", position: "WR" })],
      valueRows: [valueRow({ entityId: "p1" })],
      rosterRequirements: requirements(["QB", "RB", "WR"]),
    });

    expect(result.rows.map((row) => row.displayName)).toEqual(["Matched", "Missing"]);
    expect(result.diagnostics.matchCoverageSummary.rowsMatched + result.diagnostics.matchCoverageSummary.rowsUnmatched).toBe(2);
    expect(result.diagnostics.matchRateByPosition.RB.matchRate).toBe(1);
    expect(result.diagnostics.highPriorityMissingProjectionExamples[0]).toMatchObject({
      player_name: "Missing",
      missingReason: "CANONICAL_ID_HAS_NO_H10_VALUE_ROW",
    });
  });
});

function requirements(slots: string[]) {
  return buildNormalizedRosterRequirements(slots);
}

function player(overrides: Partial<DraftTargetScorePlayer> = {}): DraftTargetScorePlayer {
  return {
    sleeper_player_id: "sleeper",
    matched_player_id: "p1",
    player_name: "Player",
    position: "RB",
    team: "DAL",
    rank: 1,
    adp: 10,
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

function valueRow(overrides: Partial<H10LeagueValueRow> = {}): H10LeagueValueRow {
  return {
    leagueId: "l1",
    leagueName: "League",
    entityId: "p1",
    entityType: "PLAYER",
    displayName: "Player",
    team: "DAL",
    position: "RB",
    positionGroup: "RB",
    projectedPositionRank: 1,
    medianPoints: 200,
    floorPoints: 180,
    ceilingPoints: 220,
    downsidePoints: 160,
    upsidePoints: 240,
    replacementRank: 2,
    replacementLevelPoints: 150,
    pointsAboveReplacement: 50,
    starterCutlineRank: 1,
    starterCutlinePoints: 200,
    pointsAboveStarterCutline: 0,
    positionScarcityScore: 30,
    scarcityLabel: "medium",
    tier: 1,
    tierLabel: "Elite",
    tierSize: 1,
    tierGapAbove: null,
    tierGapBelow: 10,
    pointsToNextTier: 10,
    pointsAboveNextTier: 10,
    confidenceAdjustedValue: 47,
    riskAdjustedValue: 42,
    riskLabel: "medium",
    marketRankDelta: 12,
    marketValueSignal: "above_market",
    draftRelevance: "draft_relevant",
    valueReadiness: "READY",
    reasonCodes: ["REASON"],
    warningCodes: [],
    ...overrides,
  };
}
