import { describe, expect, it } from "vitest";

import {
  buildH10RecommendationExperimentUiState,
  DEFAULT_H10_RECOMMENDATION_SOURCE,
  H10_RECOMMENDATION_READINESS_LABELS,
} from "@/lib/draft/war-room-recommendation-experiment-ui";
import type { H10RecommendationExperimentDiagnostics } from "@/lib/draft/war-room-recommendation-experiment";
import type { WarRoomRecommendationRow } from "@/lib/draft/war-room-recommendations";

describe("buildH10RecommendationExperimentUiState", () => {
  it("keeps legacy as the default recommendation source", () => {
    const state = buildH10RecommendationExperimentUiState({
      rows: [row("recommendable")],
      experimentDiagnostics: diagnostics({ blackbirdExperimentEligible: true }),
    });

    expect(DEFAULT_H10_RECOMMENDATION_SOURCE).toBe("legacy");
    expect(state.selectedSource).toBe("legacy");
    expect(state.legacyPanelPrimary).toBe(true);
  });

  it("shows preview-only panel below legacy and does not show experiment selector", () => {
    const state = buildH10RecommendationExperimentUiState({
      previewEnabled: true,
      experimentEnabled: false,
      rows: [row("recommendable")],
      experimentDiagnostics: diagnostics({ blackbirdExperimentEligible: true }),
    });

    expect(state.showPreviewPanel).toBe(true);
    expect(state.showExperimentSelector).toBe(false);
    expect(state.legacyPanelPrimary).toBe(true);
  });

  it("shows experiment selector when experiment flag is enabled and hides preview-only panel", () => {
    const state = buildH10RecommendationExperimentUiState({
      previewEnabled: true,
      experimentEnabled: true,
      selectedSource: "blackbird",
      rows: [row("recommendable")],
      experimentDiagnostics: diagnostics({ blackbirdExperimentEligible: true }),
    });

    expect(state.showExperimentSelector).toBe(true);
    expect(state.showPreviewPanel).toBe(false);
    expect(state.legacyPanelPrimary).toBe(false);
    expect(state.blackbirdPanelEnabled).toBe(true);
  });

  it("hides H10 recommendation UI when both flags are disabled", () => {
    const state = buildH10RecommendationExperimentUiState({
      previewEnabled: false,
      experimentEnabled: false,
      rows: [row("recommendable")],
      experimentDiagnostics: diagnostics({ blackbirdExperimentEligible: true }),
    });

    expect(state.showExperimentSelector).toBe(false);
    expect(state.showPreviewPanel).toBe(false);
    expect(state.legacyPanelPrimary).toBe(true);
  });

  it("disables Blackbird panel and exposes failed gates when gates fail", () => {
    const state = buildH10RecommendationExperimentUiState({
      experimentEnabled: true,
      selectedSource: "blackbird",
      rows: [row("recommendable")],
      experimentDiagnostics: diagnostics({
        blackbirdExperimentEligible: false,
        failedExperimentGates: ["MATCH_RATE_BELOW_0_85"],
      }),
    });

    expect(state.blackbirdPanelEnabled).toBe(false);
    expect(state.failedExperimentGates).toEqual(["MATCH_RATE_BELOW_0_85"]);
  });

  it("counts missing projection and format excluded rows as diagnostics-only", () => {
    const state = buildH10RecommendationExperimentUiState({
      experimentEnabled: true,
      rows: [row("recommendable"), row("watch_only"), row("missing_projection"), row("format_excluded"), row("insufficient_context")],
      experimentDiagnostics: diagnostics({ blackbirdExperimentEligible: true }),
    });

    expect(state.blackbirdRowsShown).toBe(2);
    expect(state.diagnosticsOnlyRows).toBe(3);
  });

  it("uses required experimental labels without banned advice wording", () => {
    const labelText = H10_RECOMMENDATION_READINESS_LABELS.join(" ").toLowerCase();

    expect(labelText).toContain("experimental");
    expect(labelText).toContain("deterministic");
    expect(labelText).toContain("projection-based");
    expect(labelText).toContain("not final draft advice");
    expect(labelText).not.toMatch(/\b(ai says|guaranteed|must draft|lock|best pick)\b/);
  });
});

function row(status: WarRoomRecommendationRow["status"]): WarRoomRecommendationRow {
  return { status } as WarRoomRecommendationRow;
}

function diagnostics(overrides: Partial<H10RecommendationExperimentDiagnostics> = {}): H10RecommendationExperimentDiagnostics {
  return {
    legacyReady: true,
    blackbirdPreviewReady: true,
    blackbirdExperimentEligible: true,
    failedExperimentGates: [],
    blackbirdRowsGenerated: 1,
    blackbirdRowsShown: 1,
    rowsByTier: {},
    rowsByStatus: {},
    matchRate: 1,
    insufficientDataRate: 0,
    warningCounts: {},
    contextLimitations: [],
    ...overrides,
  };
}
