import {
  filterBlackbirdDiagnosticsRows,
  filterBlackbirdRecommendationRows,
  type H10RecommendationExperimentDiagnostics,
} from "@/lib/draft/war-room-recommendation-experiment";
import type { WarRoomRecommendationRow } from "@/lib/draft/war-room-recommendations";

export type H10RecommendationSource = "legacy" | "blackbird";

export const DEFAULT_H10_RECOMMENDATION_SOURCE: H10RecommendationSource = "legacy";

export const H10_RECOMMENDATION_READINESS_LABELS = [
  "Experimental",
  "Deterministic",
  "Projection-based",
  "Not final draft advice",
] as const;

export type BuildH10RecommendationExperimentUiStateInput = {
  previewEnabled?: boolean;
  experimentEnabled?: boolean;
  selectedSource?: H10RecommendationSource;
  rows: WarRoomRecommendationRow[];
  experimentDiagnostics?: H10RecommendationExperimentDiagnostics | null;
};

export function buildH10RecommendationExperimentUiState(input: BuildH10RecommendationExperimentUiStateInput) {
  const selectedSource = input.selectedSource ?? DEFAULT_H10_RECOMMENDATION_SOURCE;
  const experimentEnabled = Boolean(input.experimentEnabled);
  const previewEnabled = Boolean(input.previewEnabled);
  const recommendationRows = filterBlackbirdRecommendationRows(input.rows);
  const diagnosticsRows = filterBlackbirdDiagnosticsRows(input.rows);
  const blackbirdPanelEnabled = Boolean(input.experimentDiagnostics?.blackbirdPreviewReady ?? recommendationRows.length > 0);

  return {
    selectedSource,
    showExperimentSelector: experimentEnabled,
    showPreviewPanel: !experimentEnabled && previewEnabled,
    legacyPanelPrimary: !experimentEnabled || selectedSource === "legacy",
    blackbirdPanelEnabled,
    blackbirdRowsShown: recommendationRows.length,
    diagnosticsOnlyRows: diagnosticsRows.length,
    failedExperimentGates: input.experimentDiagnostics?.failedExperimentGates ?? [],
    readinessLabels: H10_RECOMMENDATION_READINESS_LABELS,
  };
}
