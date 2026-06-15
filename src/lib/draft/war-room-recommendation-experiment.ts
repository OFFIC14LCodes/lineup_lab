import type { WarRoomRecommendationResult, WarRoomRecommendationRow } from "@/lib/draft/war-room-recommendations";

export type H10RecommendationExperimentDiagnostics = {
  legacyReady: boolean;
  blackbirdPreviewReady: boolean;
  blackbirdExperimentEligible: boolean;
  failedExperimentGates: string[];
  blackbirdRowsGenerated: number;
  blackbirdRowsShown: number;
  rowsByTier: Record<string, number>;
  rowsByStatus: Record<string, number>;
  matchRate: number | null;
  insufficientDataRate: number;
  warningCounts: Record<string, number>;
  contextLimitations: string[];
};

export type BuildH10RecommendationExperimentDiagnosticsInput = {
  recommendations: WarRoomRecommendationResult;
  legacyRecommendationCount: number;
  legacyRecommendationsUnchanged?: boolean;
  remainingPlayersOrderUnchanged?: boolean;
};

const RECOMMENDATION_STATUSES = new Set(["recommendable", "watch_only"]);

export function buildH10RecommendationExperimentDiagnostics(
  input: BuildH10RecommendationExperimentDiagnosticsInput
): H10RecommendationExperimentDiagnostics {
  const diagnostics = input.recommendations.diagnostics;
  const rows = input.recommendations.rows;
  const matchRate = diagnostics.matchCoverageSummary?.matchRate ?? null;
  const insufficientDataCount = diagnostics.rowsByTier.insufficient_data ?? 0;
  const insufficientDataRate = diagnostics.recommendationsGenerated > 0 ? insufficientDataCount / diagnostics.recommendationsGenerated : 1;
  const failedExperimentGates = [
    matchRate === null || matchRate < 0.85 ? "MATCH_RATE_BELOW_0_85" : null,
    insufficientDataRate > 0.15 ? "INSUFFICIENT_DATA_RATE_ABOVE_0_15" : null,
    diagnostics.invariantFailures.length > 0 ? "INVARIANT_FAILURES_PRESENT" : null,
    hasForbiddenLanguageFailure(diagnostics.invariantFailures) ? "FORBIDDEN_LANGUAGE_PRESENT" : null,
    input.remainingPlayersOrderUnchanged === false ? "REMAINING_PLAYERS_ORDER_CHANGED" : null,
    input.legacyRecommendationsUnchanged === false ? "LEGACY_RECOMMENDATIONS_CHANGED" : null,
  ].filter((gate): gate is string => Boolean(gate));

  return {
    legacyReady: input.legacyRecommendationCount > 0,
    blackbirdPreviewReady: diagnostics.recommendationsGenerated > 0 && diagnostics.invariantFailures.length === 0,
    blackbirdExperimentEligible: failedExperimentGates.length === 0,
    failedExperimentGates,
    blackbirdRowsGenerated: diagnostics.recommendationsGenerated,
    blackbirdRowsShown: countShownRows(rows),
    rowsByTier: diagnostics.rowsByTier,
    rowsByStatus: diagnostics.rowsByStatus,
    matchRate,
    insufficientDataRate: round(insufficientDataRate),
    warningCounts: diagnostics.warningCounts,
    contextLimitations: diagnostics.contextLimitations,
  };
}

export function filterBlackbirdRecommendationRows(rows: WarRoomRecommendationRow[]) {
  return rows.filter((row) => RECOMMENDATION_STATUSES.has(row.status));
}

export function filterBlackbirdDiagnosticsRows(rows: WarRoomRecommendationRow[]) {
  return rows.filter((row) => !RECOMMENDATION_STATUSES.has(row.status));
}

function countShownRows(rows: WarRoomRecommendationRow[]) {
  return filterBlackbirdRecommendationRows(rows).length;
}

function hasForbiddenLanguageFailure(failures: string[]) {
  return failures.some((failure) => {
    const normalized = failure.toLowerCase();
    return normalized.includes("banned") || normalized.includes("forbidden");
  });
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
