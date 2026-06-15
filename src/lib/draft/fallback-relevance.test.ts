import { describe, expect, it } from "vitest";

import { buildNormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import type { H10LeagueValueRow } from "@/lib/projections/h10-league-value";
import type { DraftTargetScorePlayer } from "./scoring";
import { classifyFallbackPlayer, filterFallbackPlayers } from "./fallback-relevance";
import { buildWarRoomValueOverlay } from "./h10-war-room-overlay";
import { buildWarRoomRecommendations } from "./war-room-recommendations";

describe("fallback relevance", () => {
  it("classifies ranked fallback rows as draft relevant", () => {
    expect(classifyFallbackPlayer(player({ rank: 12 }), false, true)).toBe("DRAFT_RELEVANT");
  });

  it("classifies ADP fallback rows as draft relevant", () => {
    expect(classifyFallbackPlayer(player({ adp: 88 }), false, true)).toBe("DRAFT_RELEVANT");
  });

  it("classifies H10-valued fallback rows as draft relevant", () => {
    expect(classifyFallbackPlayer(player(), true, true)).toBe("DRAFT_RELEVANT");
  });

  it("classifies no-rank/no-ADP/no-H10 canonical fallback rows as projectionless fallback", () => {
    expect(classifyFallbackPlayer(player(), false, true)).toBe("PROJECTIONLESS_FALLBACK");
  });

  it("classifies format-excluded rows before projection status", () => {
    expect(classifyFallbackPlayer(player({ position: "DB" }), true, false)).toBe("FORMAT_EXCLUDED");
  });

  it("default filtering excludes projectionless historical fallback rows and preserves included order", () => {
    const result = filterFallbackPlayers({
      leagueId: "l1",
      players: [
        player({ player_name: "Projectionless", matched_player_id: "missing" }),
        player({ player_name: "Valued", matched_player_id: "p1" }),
        player({ player_name: "ADP", matched_player_id: "missing2", adp: 99 }),
      ],
      valueRows: [valueRow({ entityId: "p1" })],
      rosterRequirements: requirements(["RB"]),
    });

    expect(result.players.map((row) => row.player_name)).toEqual(["Valued", "ADP"]);
    expect(result.diagnostics).toMatchObject({
      fallbackRowsTotal: 3,
      fallbackRowsIncluded: 2,
      fallbackRowsExcluded: 1,
      projectionlessFallbackRows: 1,
      draftRelevantFallbackRows: 2,
    });
    expect(result.diagnostics.topExcludedFallbackExamples[0]).toMatchObject({
      player_name: "Projectionless",
      reasonExcluded: "PROJECTIONLESS_FALLBACK",
      hasH10Value: false,
    });
  });

  it("debug option includes diagnostic fallback rows but still excludes format-excluded rows", () => {
    const result = filterFallbackPlayers({
      leagueId: "l1",
      players: [player({ player_name: "Projectionless" }), player({ player_name: "DB", position: "DB" })],
      valueRows: [],
      rosterRequirements: requirements(["RB"]),
      includeDiagnosticFallbacks: true,
    });

    expect(result.players.map((row) => row.player_name)).toEqual(["Projectionless"]);
    expect(result.diagnostics).toMatchObject({
      fallbackRowsIncluded: 1,
      fallbackRowsExcluded: 1,
      includeDiagnosticFallbacks: true,
      formatExcludedFallbackRows: 1,
    });
  });

  it("does not mutate fallback players or H10 value rows", () => {
    const players = [player()];
    const valueRows = [valueRow()];
    const beforePlayers = JSON.stringify(players);
    const beforeRows = JSON.stringify(valueRows);

    filterFallbackPlayers({ leagueId: "l1", players, valueRows, rosterRequirements: requirements(["RB"]) });

    expect(JSON.stringify(players)).toBe(beforePlayers);
    expect(JSON.stringify(valueRows)).toBe(beforeRows);
  });

  it("improves H10 overlay match rate by filtering projectionless fallback rows", () => {
    const players = [player({ matched_player_id: "missing" }), player({ matched_player_id: "p1" })];
    const valueRows = [valueRow({ entityId: "p1" })];
    const rosterRequirements = requirements(["RB"]);
    const before = buildWarRoomValueOverlay({ leagueId: "l1", players, valueRows, rosterRequirements });
    const filtered = filterFallbackPlayers({ leagueId: "l1", players, valueRows, rosterRequirements });
    const after = buildWarRoomValueOverlay({ leagueId: "l1", players: filtered.players, valueRows, rosterRequirements });

    expect(before.diagnostics.matchCoverageSummary.matchRate).toBe(0.5);
    expect(after.diagnostics.matchCoverageSummary.matchRate).toBe(1);
  });

  it("recommendation preview receives fewer insufficient data rows after filtering", () => {
    const players = [player({ matched_player_id: "missing" }), player({ matched_player_id: "p1" })];
    const valueRows = [valueRow({ entityId: "p1" })];
    const rosterRequirements = requirements(["RB"]);
    const beforeOverlay = buildWarRoomValueOverlay({ leagueId: "l1", players, valueRows, rosterRequirements });
    const filtered = filterFallbackPlayers({ leagueId: "l1", players, valueRows, rosterRequirements });
    const afterOverlay = buildWarRoomValueOverlay({ leagueId: "l1", players: filtered.players, valueRows, rosterRequirements });
    const before = buildWarRoomRecommendations({
      leagueId: "l1",
      draftRoomId: "d1",
      remainingPlayers: players,
      h10ValueOverlay: beforeOverlay.rows,
      rosterRequirements,
      currentPickNumber: 1,
      currentRound: 1,
      picksUntilMyNextPick: 10,
      positionCounts: {},
    });
    const after = buildWarRoomRecommendations({
      leagueId: "l1",
      draftRoomId: "d1",
      remainingPlayers: filtered.players,
      h10ValueOverlay: afterOverlay.rows,
      rosterRequirements,
      currentPickNumber: 1,
      currentRound: 1,
      picksUntilMyNextPick: 10,
      positionCounts: {},
    });

    expect(before.diagnostics.rowsByTier.insufficient_data).toBe(1);
    expect(after.diagnostics.rowsByTier.insufficient_data ?? 0).toBe(0);
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
    rank: null,
    adp: null,
    projected_points: null,
    dynasty_value: null,
    best_ball_value: null,
    superflex_value: null,
    te_premium_value: null,
    match_status: null,
    match_confidence: null,
    is_ranked: false,
    is_fallback: true,
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
    reasonCodes: [],
    warningCodes: [],
    ...overrides,
  };
}
