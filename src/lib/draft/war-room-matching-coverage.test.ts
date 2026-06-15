import { describe, expect, it } from "vitest";

import { buildNormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import type { H10LeagueValueRow } from "@/lib/projections/h10-league-value";
import type { DraftTargetScorePlayer } from "./scoring";
import { buildWarRoomMatchingCoverage } from "./war-room-matching-coverage";

describe("buildWarRoomMatchingCoverage", () => {
  it("matches by canonical ID", () => {
    const result = build({ players: [player({ matched_player_id: "p1" })], valueRows: [valueRow({ entityId: "p1" })] });

    expect(result.rows[0]).toMatchObject({ classification: "MATCHED_BY_CANONICAL_ID", matchedEntityId: "p1" });
    expect(result.summary.rowsMatched).toBe(1);
  });

  it("matches by unique Sleeper crosswalk", () => {
    const result = build({
      players: [player({ matched_player_id: null, sleeper_player_id: "s1" })],
      valueRows: [valueRow({ entityId: "p1" })],
      sleeperToCanonicalId: { s1: "p1" },
    });

    expect(result.rows[0]).toMatchObject({ classification: "MATCHED_BY_SLEEPER_ID", matchedBy: "sleeper_id" });
  });

  it("matches DST by exact team-defense identity", () => {
    const result = build({
      players: [player({ matched_player_id: null, sleeper_player_id: null, position: "DEF", team: "DAL" })],
      valueRows: [valueRow({ entityId: "DAL", entityType: "TEAM_DEFENSE", position: "DST", positionGroup: "DST", team: "DAL" })],
      rosterSlots: ["DST"],
      includeDstDryRun: true,
    });

    expect(result.rows[0]).toMatchObject({ classification: "MATCHED_BY_DST_TEAM", matchedEntityId: "DAL" });
  });

  it("rejects ambiguous candidates", () => {
    const result = build({
      players: [player({ matched_player_id: null, sleeper_player_id: "s1" })],
      sleeperCanonicalCandidates: {
        s1: [
          { id: "p1", sleeper_player_id: "s1", full_name: "A" },
          { id: "p2", sleeper_player_id: "s1", full_name: "B" },
        ],
      },
      valueRows: [valueRow({ entityId: "p1" }), valueRow({ entityId: "p2" })],
    });

    expect(result.rows[0]).toMatchObject({
      classification: "AMBIGUOUS_MATCH_REJECTED",
      missingReason: "SLEEPER_ID_MAPS_TO_MULTIPLE_CANONICAL_PLAYERS",
    });
    expect(result.rows[0].candidate_canonical_players).toHaveLength(2);
  });

  it("rejects team mismatch and position mismatch instead of guessing", () => {
    const teamMismatch = build({
      players: [player({ matched_player_id: "p1", team: "DAL" })],
      valueRows: [valueRow({ entityId: "p1", team: "PHI" })],
    });
    const positionMismatch = build({
      players: [player({ matched_player_id: "p1", position: "RB" })],
      valueRows: [valueRow({ entityId: "p1", position: "WR", positionGroup: "WR" })],
    });

    expect(teamMismatch.rows[0]).toMatchObject({ classification: "LOW_CONFIDENCE_MATCH", missingReason: "TEAM_MISMATCH_REJECTED" });
    expect(positionMismatch.rows[0]).toMatchObject({ classification: "LOW_CONFIDENCE_MATCH", missingReason: "POSITION_MISMATCH_REJECTED" });
  });

  it("matches source-specific IDP positions to grouped H10 positions", () => {
    const result = build({
      players: [player({ matched_player_id: "p1", position: "SS" })],
      valueRows: [valueRow({ entityId: "p1", position: "DB", positionGroup: "DB" })],
      rosterSlots: ["DB"],
    });

    expect(result.rows[0]).toMatchObject({
      classification: "MATCHED_BY_CANONICAL_ID",
      matchedEntityId: "p1",
      reasonCodes: ["IDP_POSITION_GROUP_COMPATIBLE", "IDP_HYBRID_POSITION_NORMALIZED"],
    });
  });

  it("matches DB/LB hybrid mismatch through generic compatibility instead of name hardcoding", () => {
    const result = build({
      players: [player({ player_name: "Hybrid Defender", matched_player_id: "p1", position: "DB" })],
      valueRows: [valueRow({ entityId: "p1", displayName: "Different Name", position: "LB", positionGroup: "LB" })],
      rosterSlots: ["DB"],
    });

    expect(result.rows[0]).toMatchObject({
      classification: "MATCHED_BY_CANONICAL_ID",
      matchedEntityId: "p1",
      reasonCodes: ["IDP_POSITION_GROUP_COMPATIBLE", "IDP_HYBRID_POSITION_NORMALIZED"],
    });
  });

  it("rejects incompatible IDP groups", () => {
    const result = build({
      players: [player({ matched_player_id: "p1", position: "DB" })],
      valueRows: [valueRow({ entityId: "p1", position: "DL", positionGroup: "DL" })],
    });

    expect(result.rows[0]).toMatchObject({
      classification: "LOW_CONFIDENCE_MATCH",
      missingReason: "IDP_POSITION_MISMATCH_REJECTED",
    });
  });

  it("keeps fallback row without identifiers unmatched", () => {
    const result = build({
      players: [player({ matched_player_id: null, sleeper_player_id: null, is_ranked: false, is_fallback: true })],
      valueRows: [valueRow({ displayName: "Player" })],
    });

    expect(result.rows[0]).toMatchObject({ classification: "FALLBACK_ROW_UNMATCHED" });
  });

  it("does not fuzzy match by name only", () => {
    const result = build({
      players: [player({ matched_player_id: null, sleeper_player_id: null, player_name: "Same Name" })],
      valueRows: [valueRow({ entityId: "different-id", displayName: "Same Name" })],
    });

    expect(result.rows[0].classification).toBe("MISSING_CANONICAL_ID");
    expect(result.rows[0].matchedEntityId).toBeNull();
  });

  it("classifies missing reasons, match rates, and high-priority examples", () => {
    const result = build({
      players: [
        player({ matched_player_id: "p1", position: "RB", rank: 1, adp: 5 }),
        player({ matched_player_id: "missing", position: "WR", rank: 2, adp: 12, projected_points: 180 }),
        player({ matched_player_id: null, sleeper_player_id: null, position: "TE", rank: 3, adp: 20 }),
      ],
      valueRows: [valueRow({ entityId: "p1", position: "RB", positionGroup: "RB" })],
    });

    expect(result.summary.rowsMatched + result.summary.rowsUnmatched).toBe(result.summary.rowsLoaded);
    expect(result.summary.matchRateByPosition.RB).toMatchObject({ rows: 1, matched: 1, unmatched: 0, matchRate: 1 });
    expect(result.summary.missingProjectionReasons).toMatchObject({
      CANONICAL_ID_HAS_NO_H10_VALUE_ROW: 1,
      POSITION_NOT_IN_H10_VALUE_MODEL: 1,
    });
    expect(result.summary.highPriorityMissingProjectionExamples[0].player_name).toBe("Player");
  });

  it("marks matched rows as format excluded when league does not roster the position", () => {
    const result = build({
      players: [player({ matched_player_id: "lb", position: "LB" })],
      valueRows: [valueRow({ entityId: "lb", position: "LB", positionGroup: "LB" })],
      rosterSlots: ["QB", "RB"],
    });

    expect(result.rows[0].classification).toBe("MATCHED_BUT_FORMAT_EXCLUDED");
    expect(result.summary.formatExcludedCount).toBe(1);
  });
});

type BuildOverrides = Partial<Parameters<typeof buildWarRoomMatchingCoverage>[0]> & {
  rosterSlots?: string[];
};

function build(overrides: BuildOverrides = {}) {
  return buildWarRoomMatchingCoverage({
    leagueId: "l1",
    players: overrides.players ?? [player()],
    valueRows: overrides.valueRows ?? [valueRow()],
    rosterRequirements: buildNormalizedRosterRequirements(overrides.rosterSlots ?? ["QB", "RB", "WR", "TE", "FLEX"]),
    includeDstDryRun: overrides.includeDstDryRun,
    includeAllPositions: overrides.includeAllPositions,
    sleeperToCanonicalId: overrides.sleeperToCanonicalId,
    sleeperCanonicalCandidates: overrides.sleeperCanonicalCandidates,
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
