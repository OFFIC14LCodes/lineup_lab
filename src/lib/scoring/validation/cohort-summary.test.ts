import { describe, expect, it } from "vitest";

import { buildCohortValidationSummaries } from "@/lib/scoring/validation";
import type { RowValidationResult } from "@/lib/scoring/validation/types";

function makeRow(overrides: Partial<RowValidationResult> = {}): RowValidationResult {
  return {
    rowId: "row-1",
    playerId: "player-1",
    playerName: "Player One",
    provider: "manual",
    sourceType: "weekly_stats",
    positionGroup: "WR",
    season: 2026,
    week: 1,
    projectionType: null,
    blackbirdPoints: 10,
    coverageRatio: 1,
    providerComparison: {
      providerPoints: 10,
      blackbirdPoints: 10,
      difference: 0,
      absoluteDifference: 0,
      percentDifference: 0,
      comparisonStatus: "match",
      warnings: []
    },
    readiness: {
      status: "ready",
      eligibleForRecommendationExperiment: true,
      eligibleExperimentScope: "weekly_recommendation",
      score: 100,
      reasons: [],
      warnings: [],
      failedRules: [],
      passedRules: [],
      scoreBreakdown: [],
      formulaVersion: "blackbird-scoring-v1",
      readinessVersion: "blackbird-scoring-readiness-v1"
    },
    scoringResult: {
      league: { id: "league-1", name: "League One" },
      player: { id: "player-1", name: "Player One", team: "CHI", positionGroup: "WR" },
      source: {
        table: "player_weekly_stats",
        rowId: "row-1",
        provider: "manual",
        providerExternalId: null,
        season: 2026,
        week: 1,
        projectionType: null,
        sourceUpdatedAt: null,
        ingestedAt: new Date().toISOString()
      },
      blackbird: {
        totalPoints: 10,
        components: [],
        coverage: {
          supportedScoringKeys: [],
          unsupportedScoringKeys: [],
          missingStatsForSupportedKeys: [],
          unusedStatKeys: [],
          ambiguousStatAliases: [],
          notApplicableScoringKeys: [],
          activeScoringKeys: [],
          evaluatedScoringKeys: [],
          coverageRatio: 1,
          isComplete: true
        },
        warnings: [],
        positionGroup: "WR",
        formulaVersion: "blackbird-scoring-v1"
      },
      providerComparison: null,
      aggregateCompatibility: null,
      contextWarnings: []
    },
    ...overrides
  };
}

describe("buildCohortValidationSummaries", () => {
  it("groups by provider, source, position, and projection type", () => {
    const rows = [
      makeRow({ rowId: "row-1", provider: "manual", sourceType: "weekly_stats", positionGroup: "WR" }),
      makeRow({ rowId: "row-2", provider: "manual", sourceType: "weekly_stats", positionGroup: "WR" }),
      makeRow({ rowId: "row-3", provider: "sportsdataio", sourceType: "projections", positionGroup: "TE", projectionType: "weekly" })
    ];

    const cohorts = buildCohortValidationSummaries(rows);

    expect(cohorts).toHaveLength(2);
    expect(cohorts[0].sampleSufficiency).toBe("insufficient");
  });

  it("computes provider comparison metrics including negative differences", () => {
    const rows = [
      makeRow({
        rowId: "row-1",
        providerComparison: {
          providerPoints: 8,
          blackbirdPoints: 10,
          difference: 2,
          absoluteDifference: 2,
          percentDifference: 0.25,
          comparisonStatus: "different",
          warnings: []
        }
      }),
      makeRow({
        rowId: "row-2",
        providerComparison: {
          providerPoints: 12,
          blackbirdPoints: 10,
          difference: -2,
          absoluteDifference: 2,
          percentDifference: 0.1667,
          comparisonStatus: "different",
          warnings: []
        }
      })
    ];

    const cohort = buildCohortValidationSummaries(rows)[0];
    expect(cohort.providerComparison.meanSignedDifference).toBe(0);
    expect(cohort.providerComparison.medianAbsoluteDifference).toBe(2);
  });
});
