import { describe, expect, it } from "vitest";

import { buildIdentityReviewQueue, reviewRow } from "./identity-review-queue";
import type { MatchExample, PlayerIdentityDiagnosticsReport } from "./identity-diagnostics";

describe("identity review queue", () => {
  it("assigns P1 to active high-search-rank players with a team", () => {
    const row = reviewRow(match({ sourceSearchRank: 50, sourceTeam: "DET", sourceActive: true }), "unmatched");
    expect(row.reviewPriority).toBe("P1");
  });

  it("assigns P4 to inactive players", () => {
    const row = reviewRow(match({ sourceActive: false, sourceTeam: "DET" }), "unmatched");
    expect(row.reviewPriority).toBe("P4");
  });

  it("formats conflict rows with candidate data and possible duplicate action", () => {
    const row = reviewRow(match({
      confidence: "conflict",
      conflictReasons: ["duplicate candidates at the best confidence score"],
      candidateExamples: [
        { playerId: "00-1", playerName: "Test Player", position: "WR", team: "DET", score: 85, reasons: ["normalized full name match"] },
      ],
    }), "conflict");
    expect(row.recommendedAction).toBe("possible_duplicate");
    expect(row.candidateNflversePlayerIds).toEqual(["00-1"]);
    expect(row.conflictReasons).toContain("duplicate candidates at the best confidence score");
  });

  it("formats unmatched rows with provider_missing_id action when no candidates exist", () => {
    const row = reviewRow(match({ confidence: "unmatched", candidateExamples: [], candidateCount: 0 }), "unmatched");
    expect(row.recommendedAction).toBe("provider_missing_id");
    expect(row.candidateNames).toEqual([]);
  });

  it("builds review summary counts by priority and action", () => {
    const queue = buildIdentityReviewQueue(reportFixture());
    expect(queue.activeUnmatched).toHaveLength(1);
    expect(queue.activeConflicts).toHaveLength(1);
    expect(queue.summary.byPriority.P1).toBe(2);
    expect(queue.summary.byRecommendedAction.provider_missing_id).toBe(1);
    expect(queue.summary.byRecommendedAction.possible_duplicate).toBe(1);
  });

  it("keeps reason and candidate arrays CSV-safe by joining later instead of mutating rows", () => {
    const row = reviewRow(match({
      matchReasons: ["normalized full name match", "team mismatch lowered confidence: JAX vs FA"],
      candidateExamples: [{ playerId: "00-1", playerName: "Comma, Player", position: "DB", team: null, score: 42, reasons: ["name"] }],
    }), "unmatched");
    expect(row.matchReasons).toEqual(["normalized full name match", "team mismatch lowered confidence: JAX vs FA"]);
    expect(row.candidateNames).toEqual(["Comma, Player"]);
  });
});

function match(overrides: Partial<MatchExample> = {}): MatchExample {
  return {
    sourcePlayerId: "s1",
    sourcePlayerName: "Test Player",
    sourcePosition: "WR",
    sourceTeam: "DET",
    sourceStatus: "Active",
    sourceActive: true,
    sourceSearchRank: 100,
    sourceYearsExperience: 2,
    sourceCollege: "Example",
    sourceAge: 24,
    sourceBirthDate: "2002-01-01",
    sourceHeight: 72,
    sourceWeight: 205,
    matchedPlayerId: null,
    matchedPlayerName: null,
    confidence: "unmatched",
    score: 0,
    matchReasons: [],
    conflictReasons: [],
    candidateCount: 0,
    preservedIds: {
      blackbirdPlayerId: null,
      sleeperId: "s1",
      gsisId: null,
      espnId: null,
      pfrId: null,
      nflId: null,
      smartId: null,
    },
    candidateExamples: [],
    ...overrides,
  };
}

function reportFixture(): PlayerIdentityDiagnosticsReport {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    dryRun: true,
    sources: {
      blackbirdContextProfiles: { path: "context.json", exists: true, rows: 1 },
      rookieData: { path: "rookies.csv", exists: true, rows: 0 },
      sleeperExport: { path: "players.json", exists: true, rawRows: 1, normalizedRows: 1 },
      sleeperRepairDiagnostic: { path: "repair.json", exists: true, rows: 0 },
      manualOverrides: { path: "manual-overrides.csv", exists: true, rows: 0, approvedRows: 0, skippedRows: 0, missingColumns: [], issues: [] },
      nflversePlayers: { rows: 1 },
      nflverseRosters: { rows: 1 },
      nflversePlayerStats: { rows: 1 },
    },
    counts: {
      totalBlackbirdSleeperPlayersConsidered: 2,
      totalNflversePlayersConsidered: 1,
      totalSleeperPlayersLoaded: 1,
      activeSleeperPlayers: 1,
      fantasyRelevantSleeperPlayers: 1,
      activeFantasyRelevantSleeperPlayers: 1,
      manualOverrideMatches: 0,
      manualOverrideConflicts: 0,
      exactIdMatches: 0,
      exactExternalIdMatches: 0,
      strongNamePositionTeamMatches: 0,
      namePositionTeamMatches: 0,
      mediumMatches: 0,
      weakMatches: 0,
      unmatchedBlackbirdSleeperPlayers: 1,
      activeFantasyRelevantUnmatchedPlayers: 1,
      inactiveRetiredUnmatchedPlayers: 0,
      unmatchedNflverseFantasyRelevantPlayers: 1,
      conflictsDuplicateCandidates: 1,
      activeFantasyRelevantConflicts: 1,
    },
    confidenceDistribution: { manual_override: 0, exact_id: 0, strong: 0, medium: 0, weak: 0, unmatched: 1, conflict: 1 },
    examples: { manual_override: [], exact_id: [], strong: [], medium: [], weak: [], unmatched: [], conflict: [] },
    unmatchedNflverseExamples: [],
    topUnresolvedActiveFantasyRelevant: [match()],
    topConflicts: [match({ confidence: "conflict", conflictReasons: ["duplicate candidates at the best confidence score"] })],
    limitations: [],
    verdict: "needs_review",
  };
}
