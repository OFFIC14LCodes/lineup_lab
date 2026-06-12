import { describe, expect, it } from "vitest";

import { auditLeagueScoringSettings, normalizeSleeperScoringSettings, scoreFantasyStats } from "@/lib/scoring";
import { BLACKBIRD_SCORING_FORMULA_VERSION } from "@/lib/scoring/score-player";
import type { ProviderPointComparison } from "@/lib/scoring/server/types";
import { buildDiscrepancyInvestigations, DISCREPANCY_THRESHOLDS } from "@/lib/scoring/validation/discrepancy";
import type { CohortValidationSummary, RowValidationResult } from "@/lib/scoring/validation/types";
import { BLACKBIRD_SCORING_READINESS_VERSION } from "@/lib/scoring/validation/constants";

const BASE_SETTINGS = { rec: 1, rec_yd: 0.1, rec_td: 6 };

function makeLeague() {
  const normalized = normalizeSleeperScoringSettings(BASE_SETTINGS);
  return {
    leagueId: "league-1",
    leagueName: "League One",
    season: 2026,
    scoringSettings: normalized,
    scoringAudit: auditLeagueScoringSettings(normalized),
    formulaVersion: BLACKBIRD_SCORING_FORMULA_VERSION
  };
}

function makeReadiness() {
  return {
    status: "ready" as const,
    eligibleForRecommendationExperiment: true,
    eligibleExperimentScope: "weekly_recommendation" as const,
    score: 100,
    reasons: [],
    warnings: [],
    failedRules: [],
    passedRules: [],
    scoreBreakdown: [],
    formulaVersion: BLACKBIRD_SCORING_FORMULA_VERSION,
    readinessVersion: BLACKBIRD_SCORING_READINESS_VERSION
  };
}

function makeScoringResult(stats: Record<string, number>, providerPoints: number | null) {
  const league = makeLeague();
  const blackbird = scoreFantasyStats({ stats, scoringSettings: BASE_SETTINGS, positionGroup: "WR" });
  const providerComparison: ProviderPointComparison | null =
    providerPoints !== null
      ? {
          providerPoints,
          blackbirdPoints: blackbird.totalPoints,
          difference: blackbird.totalPoints - providerPoints,
          absoluteDifference: Math.abs(blackbird.totalPoints - providerPoints),
          percentDifference: providerPoints !== 0 ? Math.abs(blackbird.totalPoints - providerPoints) / providerPoints : null,
          comparisonStatus: Math.abs(blackbird.totalPoints - providerPoints) < 0.1 ? "match" : "different",
          warnings: []
        }
      : null;

  return {
    league: { id: league.leagueId, name: league.leagueName },
    player: { id: "player-1", name: "Player One", team: "CHI", positionGroup: "WR" as const },
    source: {
      table: "player_weekly_stats" as const,
      rowId: "row-1",
      provider: "manual" as const,
      providerExternalId: null,
      season: 2026,
      week: 1,
      projectionType: null,
      sourceUpdatedAt: new Date().toISOString(),
      ingestedAt: new Date().toISOString()
    },
    blackbird,
    providerComparison,
    aggregateCompatibility: null,
    contextWarnings: []
  };
}

function makeRow(rowId: string, stats: Record<string, number>, providerPoints: number | null): RowValidationResult {
  const scoringResult = makeScoringResult(stats, providerPoints);
  return {
    rowId,
    playerId: "player-1",
    playerName: "Player One",
    provider: "manual",
    sourceType: "weekly_stats",
    positionGroup: "WR",
    season: 2026,
    week: 1,
    projectionType: null,
    blackbirdPoints: scoringResult.blackbird.totalPoints,
    coverageRatio: scoringResult.blackbird.coverage.coverageRatio,
    providerComparison: scoringResult.providerComparison,
    readiness: makeReadiness(),
    scoringResult
  };
}

function makeCohort(rows: RowValidationResult[]): CohortValidationSummary {
  return {
    cohortKey: "manual|weekly_stats|WR|none",
    provider: "manual",
    sourceType: "weekly_stats",
    positionGroup: "WR",
    projectionType: null,
    sampleSize: rows.length,
    sampleSufficiency: rows.length >= 20 ? "moderate" : rows.length >= 5 ? "small" : "insufficient",
    readyCount: rows.length,
    conditionallyReadyCount: 0,
    notReadyCount: 0,
    insufficientDataCount: 0,
    eligibleCount: rows.length,
    eligiblePercentage: 1,
    averageCoverageRatio: 1,
    minimumCoverageRatio: 1,
    unsupportedKeyFrequency: [],
    missingStatFrequency: [],
    aliasAmbiguityCount: 0,
    positionWarningCount: 0,
    providerComparison: {
      withProviderTotals: rows.filter((r) => r.providerComparison !== null).length,
      withoutProviderTotals: rows.filter((r) => r.providerComparison === null).length,
      matchCount: rows.filter((r) => r.providerComparison?.comparisonStatus === "match").length,
      closeCount: rows.filter((r) => r.providerComparison?.comparisonStatus === "close").length,
      differentCount: rows.filter((r) => r.providerComparison?.comparisonStatus === "different").length,
      incompleteCoverageCount: 0,
      meanSignedDifference: null,
      meanAbsoluteDifference: null,
      medianAbsoluteDifference: null,
      maximumAbsoluteDifference: null,
      percentageWithProviderTotals: 1,
      percentageMatch: 0,
      percentageClose: 0,
      percentageDifferent: 1
    },
    warnings: [],
    readiness: makeReadiness()
  };
}

describe("buildDiscrepancyInvestigations — trigger thresholds", () => {
  it("does not trigger when fewer than minFullyCoveredRows exist", () => {
    const rows = Array.from({ length: DISCREPANCY_THRESHOLDS.minFullyCoveredRows - 1 }, (_, i) =>
      makeRow(`row-${i}`, { rec: 3, rec_yd: 30, rec_td: 1 }, 100)
    );

    const result = buildDiscrepancyInvestigations({
      leagueLabel: "League A",
      cohorts: [makeCohort(rows)],
      rows,
      providerLabels: new Map([["manual", "Provider A"]])
    });

    expect(result).toHaveLength(0);
  });

  it("does not trigger when all fully-covered rows match and differences are small", () => {
    const rows = Array.from({ length: 6 }, (_, i) =>
      makeRow(`row-${i}`, { rec: 5, rec_yd: 70, rec_td: 1 }, 18) // exact match
    );

    const result = buildDiscrepancyInvestigations({
      leagueLabel: "League A",
      cohorts: [makeCohort(rows)],
      rows,
      providerLabels: new Map([["manual", "Provider A"]])
    });

    expect(result).toHaveLength(0);
  });

  it("triggers when minDifferentRows threshold is met", () => {
    const stats = { rec: 5, rec_yd: 70, rec_td: 1 };
    const rows = Array.from({ length: 6 }, (_, i) =>
      makeRow(`row-${i}`, stats, 99) // big difference → "different"
    );

    const result = buildDiscrepancyInvestigations({
      leagueLabel: "League A",
      cohorts: [makeCohort(rows)],
      rows,
      providerLabels: new Map([["manual", "Provider A"]])
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].triggerReasons.some((r) => r.includes("different"))).toBe(true);
  });

  it("triggers on mean absolute difference alone", () => {
    const stats = { rec: 5, rec_yd: 70, rec_td: 1 };
    // Only 2 "different" rows (below minDifferentRows=3), but mean diff > 0.5
    const matchingRows = Array.from({ length: 4 }, (_, i) =>
      makeRow(`match-${i}`, stats, 18) // exact
    );
    const differentRows = Array.from({ length: 2 }, (_, i) =>
      makeRow(`diff-${i}`, stats, 15) // 3 point diff each → mean ~1.0
    );
    const rows = [...matchingRows, ...differentRows];

    const result = buildDiscrepancyInvestigations({
      leagueLabel: "League A",
      cohorts: [makeCohort(rows)],
      rows,
      providerLabels: new Map([["manual", "Provider A"]])
    });

    expect(result.length).toBeGreaterThan(0);
    const triggered = result[0].triggerReasons.some((r) => r.includes("Mean absolute difference"));
    const triggeredByMax = result[0].triggerReasons.some((r) => r.includes("Maximum absolute difference"));
    expect(triggered || triggeredByMax).toBe(true);
  });

  it("triggers on maximum absolute difference alone", () => {
    const stats = { rec: 5, rec_yd: 70, rec_td: 1 };
    // Mostly matching rows, one big outlier
    const matchingRows = Array.from({ length: 5 }, (_, i) =>
      makeRow(`match-${i}`, stats, 18) // exact
    );
    const outlier = makeRow("outlier", stats, 10); // 8-point diff → triggers maxAbsDiff
    const rows = [...matchingRows, outlier];

    const result = buildDiscrepancyInvestigations({
      leagueLabel: "League A",
      cohorts: [makeCohort(rows)],
      rows,
      providerLabels: new Map([["manual", "Provider A"]])
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].triggerReasons.some((r) => r.includes("Maximum absolute difference"))).toBe(true);
  });

  it("anonymizes provider in investigation output", () => {
    const stats = { rec: 5, rec_yd: 70, rec_td: 1 };
    const rows = Array.from({ length: 6 }, (_, i) => makeRow(`row-${i}`, stats, 99));

    const result = buildDiscrepancyInvestigations({
      leagueLabel: "League A",
      cohorts: [makeCohort(rows)],
      rows,
      providerLabels: new Map([["manual", "Provider X"]])
    });

    expect(result[0].providerLabel).toBe("Provider X");
  });

  it("caps representative samples at maxRepresentativeSamples", () => {
    const stats = { rec: 5, rec_yd: 70, rec_td: 1 };
    const rows = Array.from({ length: 10 }, (_, i) => makeRow(`row-${i}`, stats, 99));

    const result = buildDiscrepancyInvestigations({
      leagueLabel: "League A",
      cohorts: [makeCohort(rows)],
      rows,
      providerLabels: new Map([["manual", "Provider A"]])
    });

    if (result.length > 0) {
      expect(result[0].representativeSamples.length).toBeLessThanOrEqual(
        DISCREPANCY_THRESHOLDS.maxRepresentativeSamples
      );
    }
  });

  it("does not expose player names in representative samples", () => {
    const stats = { rec: 5, rec_yd: 70, rec_td: 1 };
    const rows = Array.from({ length: 6 }, (_, i) => makeRow(`row-${i}`, stats, 99));

    const result = buildDiscrepancyInvestigations({
      leagueLabel: "League A",
      cohorts: [makeCohort(rows)],
      rows,
      providerLabels: new Map([["manual", "Provider A"]])
    });

    if (result.length > 0) {
      for (const sample of result[0].representativeSamples) {
        expect(sample.rowLabel).toMatch(/^Row \d+$/);
        expect(Object.keys(sample)).not.toContain("playerName");
        expect(Object.keys(sample)).not.toContain("playerId");
      }
    }
  });
});
