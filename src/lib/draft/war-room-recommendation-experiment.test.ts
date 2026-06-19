import { describe, expect, it } from "vitest";

import {
  buildH10RecommendationExperimentDiagnostics,
  filterBlackbirdDiagnosticsRows,
  filterBlackbirdRecommendationRows,
} from "./war-room-recommendation-experiment";
import type { WarRoomRecommendationResult, WarRoomRecommendationRow } from "./war-room-recommendations";

describe("H10 recommendation experiment gates", () => {
  it("allows experiment display when all gates pass", () => {
    const diagnostics = buildH10RecommendationExperimentDiagnostics({
      recommendations: result(),
      legacyRecommendationCount: 2,
      legacyRecommendationsUnchanged: true,
      remainingPlayersOrderUnchanged: true,
    });

    expect(diagnostics.blackbirdPreviewReady).toBe(true);
    expect(diagnostics.blackbirdExperimentEligible).toBe(true);
    expect(diagnostics.failedExperimentGates).toEqual([]);
  });

  it("fails when match rate is below threshold", () => {
    const diagnostics = buildH10RecommendationExperimentDiagnostics({
      recommendations: result({ matchRate: 0.84 }),
      legacyRecommendationCount: 1,
    });

    expect(diagnostics.blackbirdExperimentEligible).toBe(false);
    expect(diagnostics.failedExperimentGates).toContain("MATCH_RATE_BELOW_0_85");
  });

  it("fails when insufficient data rate is above threshold", () => {
    const diagnostics = buildH10RecommendationExperimentDiagnostics({
      recommendations: result({ rowsByTier: { insufficient_data: 2, watchlist: 8 }, recommendationsGenerated: 10 }),
      legacyRecommendationCount: 1,
    });

    expect(diagnostics.blackbirdExperimentEligible).toBe(false);
    expect(diagnostics.failedExperimentGates).toContain("INSUFFICIENT_DATA_RATE_ABOVE_0_15");
  });

  it("fails on invariant and forbidden language failures", () => {
    const diagnostics = buildH10RecommendationExperimentDiagnostics({
      recommendations: result({ invariantFailures: ["Forbidden output field emitted: bestPick"] }),
      legacyRecommendationCount: 1,
    });

    expect(diagnostics.failedExperimentGates).toContain("INVARIANT_FAILURES_PRESENT");
    expect(diagnostics.failedExperimentGates).toContain("FORBIDDEN_LANGUAGE_PRESENT");
  });

  it("fails if legacy or remaining order changed", () => {
    const diagnostics = buildH10RecommendationExperimentDiagnostics({
      recommendations: result(),
      legacyRecommendationCount: 1,
      legacyRecommendationsUnchanged: false,
      remainingPlayersOrderUnchanged: false,
    });

    expect(diagnostics.failedExperimentGates).toContain("LEGACY_RECOMMENDATIONS_CHANGED");
    expect(diagnostics.failedExperimentGates).toContain("REMAINING_PLAYERS_ORDER_CHANGED");
  });

  it("keeps missing projection and format excluded rows diagnostics-only", () => {
    const rows = [
      row({ status: "recommendable", recommendationTier: "solid_target" }),
      row({ status: "watch_only", recommendationTier: "watchlist" }),
      row({ status: "missing_projection", recommendationTier: "insufficient_data" }),
      row({ status: "format_excluded", recommendationTier: "avoid_for_now" }),
      row({ status: "insufficient_context", recommendationTier: "insufficient_data" }),
    ];

    expect(filterBlackbirdRecommendationRows(rows).map((item) => item.status)).toEqual(["recommendable", "watch_only"]);
    expect(filterBlackbirdDiagnosticsRows(rows).map((item) => item.status)).toEqual([
      "missing_projection",
      "format_excluded",
      "insufficient_context",
    ]);
  });
});

function result(overrides: {
  matchRate?: number;
  rowsByTier?: Record<string, number>;
  recommendationsGenerated?: number;
  invariantFailures?: string[];
} = {}): WarRoomRecommendationResult {
  const rows = [row()];
  return {
    rows,
    diagnostics: {
      leagueId: "league",
      draftRoomId: "draft",
      remainingPlayersLoaded: rows.length,
      overlayRowsLoaded: rows.length,
      recommendationsGenerated: overrides.recommendationsGenerated ?? rows.length,
      filteredUnsupportedPositions: [],
      filteredUnsupportedPositionCount: 0,
      rowsByTier: overrides.rowsByTier ?? { watchlist: rows.length },
      rowsByStatus: { recommendable: rows.length },
      rowsByPosition: { RB: rows.length },
      warningCounts: {},
      matchCoverageSummary: {
        leagueId: "league",
        rowsLoaded: rows.length,
        rowsMatched: rows.length,
        rowsUnmatched: 0,
        matchRate: overrides.matchRate ?? 1,
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
      idpRowsEvaluated: 0,
      idpRowsByTier: {},
      idpAverageScoreComponents: null,
      idpTopLeagueValueRows: [],
      idpTopRosterNeedRows: [],
      idpTopTierCliffRows: [],
      idpSuppressionReasons: {},
      invariantFailures: overrides.invariantFailures ?? [],
      contextLimitations: [],
    },
  };
}

function row(overrides: Partial<WarRoomRecommendationRow> = {}): WarRoomRecommendationRow {
  return {
    leagueId: "league",
    draftRoomId: "draft",
    entityId: "player",
    entityType: "PLAYER",
    displayName: "Player",
    team: "DAL",
    position: "RB",
    recommendationRank: 1,
    recommendationTier: "watchlist",
    recommendationScore: 50,
    scoreComponents: {
      leagueValue: 10,
      rosterNeed: 10,
      scarcity: 5,
      tierCliff: 2,
      marketValue: 3,
      availabilityRisk: 1,
      needTiming: 0,
      confidencePenalty: 0,
      formatPenalty: 0,
    },
    primaryReason: "League value: +1 points above replacement.",
    explanationFragments: ["League value: +1 points above replacement."],
    reasonCodes: [],
    warningCodes: [],
    h10: {
      medianPoints: 100,
      pointsAboveReplacement: 1,
      riskAdjustedValue: 1,
      tier: 1,
      marketValueSignal: "aligned",
      confidenceLabel: "medium",
      valueReadiness: "READY",
    },
    draftContext: {
      currentRound: 1,
      currentPick: 1,
      picksUntilNextUserPick: 12,
      positionNeedLevel: "high",
      starterSlotNeed: true,
      benchDepthNeed: false,
      tierDropBeforeNextPick: false,
    },
    rosterNeedStatus: "starter_need_open",
    needUrgency: "medium",
    futureAvailability: "uncertain_available_next_pick",
    tierDropRisk: "medium",
    opportunityCost: "low",
    needTimingAction: "monitor",
    needTimingReasons: ["RB timing action: monitor."],
    survivalConfidence: "medium",
    survivalConfidenceScore: 55,
    comparableOptionsNow: 3,
    comparableOptionsLikelyNextPick: 1,
    comparableOptionsLikelyNextTwoPicks: 1,
    waitRisk: "medium",
    waitRiskReasons: [],
    needTimingAdjustedBySurvival: false,
    waitPlanTargets: [],
    waitPlanTargetCount: 0,
    waitPlanStrongTargetCount: 0,
    waitPlanSurvivalSummary: "No wait targets.",
    waitPlanRisk: "medium",
    waitPlanReason: "No wait plan.",
    waitPlanBacked: false,
    waitPlanFallbackAction: null,
    needTimingAdjustedByWaitPlan: false,
    status: "recommendable",
    ...overrides,
  };
}
