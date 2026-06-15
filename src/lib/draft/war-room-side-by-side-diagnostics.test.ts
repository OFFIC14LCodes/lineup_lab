import { describe, expect, it } from "vitest";

import {
  buildH10WarRoomSideBySideDiagnostics,
  compareRoom,
  type H10SideBySideBlackbirdRow,
  type H10SideBySideLegacyRow,
  type H10SideBySideRoomInput,
} from "@/lib/draft/war-room-side-by-side-diagnostics";

describe("H10 War Room side-by-side diagnostics", () => {
  it("calculates overlap and Blackbird-only / legacy-only targets", () => {
    const result = compareRoom(room({
      legacyRecommendationTopRows: [legacy("Same Player", "RB", 74), legacy("Legacy Only", "WR", 70)],
      topRecommendations: [blackbird("Same Player", "RB", 68), blackbird("Blackbird Only", "TE", 60)],
    }));

    expect(result.overlapCount).toBe(1);
    expect(result.blackbirdOnlyTargets.map((row) => row.displayName)).toEqual(["Blackbird Only"]);
    expect(result.legacyOnlyTargets.map((row) => row.player_name)).toEqual(["Legacy Only"]);
    expect(result.disagreementCount).toBe(3);
  });

  it("classifies same-target score differences without failing the artifact", () => {
    const artifact = buildH10WarRoomSideBySideDiagnostics({
      generatedAt: "2026-06-15T00:00:00.000Z",
      featureFlags: { previewEnabled: true, experimentEnabled: true },
      rooms: [room({
        legacyRecommendationTopRows: [legacy("Shared RB", "RB", 90)],
        topRecommendations: [blackbird("Shared RB", "RB", 64, { leagueValue: 12 })],
      })],
    });

    expect(artifact.aggregate.disagreementIsFailure).toBe(false);
    expect(artifact.aggregate.disagreementCounts.LEGACY_HIGHER_SCORE).toBe(1);
  });

  it("classifies Blackbird projected targets missing from legacy", () => {
    const result = compareRoom(room({
      legacyRecommendationTopRows: [],
      topRecommendations: [blackbird("Projected TE", "TE", 62, { leagueValue: 20 })],
    }));

    expect(result.disagreementCounts.BLACKBIRD_HAS_PROJECTION_LEGACY_MISSING).toBe(1);
    expect(result.examples[0]).toMatchObject({
      classification: "BLACKBIRD_HAS_PROJECTION_LEGACY_MISSING",
      blackbirdName: "Projected TE",
    });
  });

  it("reconciles disagreement count with classification counts", () => {
    const result = compareRoom(room({
      legacyRecommendationTopRows: [legacy("Legacy One", "WR", 70), legacy("Legacy Two", "RB", 68)],
      topRecommendations: [
        blackbird("Blackbird One", "WR", 62, { leagueValue: 20 }),
        blackbird("Blackbird Two", "RB", 58, { leagueValue: 18 }),
        blackbird("Blackbird Three", "TE", 55, { leagueValue: 15 }),
      ],
    }));
    const classified = Object.values(result.disagreementCounts).reduce((total, count) => total + count, 0);

    expect(result.disagreementCount).toBe(5);
    expect(classified).toBe(5);
  });

  it("classifies legacy-only rows against insufficient Blackbird rows", () => {
    const result = compareRoom(room({
      legacyRecommendationTopRows: [legacy("Legacy WR", "WR", 70)],
      topRecommendations: [blackbird("Unknown WR", "WR", 0, {}, { recommendationTier: "insufficient_data", status: "missing_projection" })],
    }));

    expect(result.disagreementCounts.LEGACY_HAS_ROW_BLACKBIRD_INSUFFICIENT_DATA).toBe(1);
  });

  it("classifies format or confidence suppression", () => {
    const result = compareRoom(room({
      legacyRecommendationTopRows: [legacy("Suppressed K", "K", 65)],
      topRecommendations: [blackbird("Suppressed K", "K", 10, {}, { status: "format_excluded" })],
    }));

    expect(result.disagreementCounts.FORMAT_OR_CONFIDENCE_SUPPRESSION).toBe(1);
  });

  it("marks safety assertions false when ordering, legacy rows, or banned wording fail", () => {
    const result = compareRoom(room({
      legacyRowsChanged: true,
      remainingPlayersOrderChanged: true,
      topRecommendations: [blackbird("Bad Phrase", "RB", 70, {}, { primaryReason: "Guaranteed lock." })],
    }));

    expect(result.safetyAssertions.defaultSourceRemainsLegacy).toBe(true);
    expect(result.safetyAssertions.blackbirdDoesNotMutateLegacyRows).toBe(false);
    expect(result.safetyAssertions.blackbirdDoesNotMutateAvailablePlayerOrder).toBe(false);
    expect(result.safetyAssertions.noBannedRecommendationLanguage).toBe(false);
  });
});

function room(overrides: Partial<H10SideBySideRoomInput> = {}): H10SideBySideRoomInput {
  return {
    source: "validation_seed",
    draftRoomId: "room",
    leagueId: "league",
    leagueName: "League",
    legacyRecommendationTopRows: [],
    topRecommendations: [],
    warningCounts: {},
    rowsByTier: {},
    rowsByStatus: {},
    legacyRowsChanged: false,
    remainingPlayersOrderChanged: false,
    experimentReadiness: {
      legacyReady: true,
      blackbirdPreviewReady: true,
      blackbirdExperimentEligible: true,
      failedExperimentGates: [],
    },
    ...overrides,
  };
}

function legacy(player_name: string, position: string, draftTargetScore: number): H10SideBySideLegacyRow {
  return {
    player_name,
    position,
    recommendationTier: "strong_target",
    draftTargetScore,
  };
}

function blackbird(
  displayName: string,
  position: string,
  recommendationScore: number,
  scoreComponents: H10SideBySideBlackbirdRow["scoreComponents"] = {},
  overrides: Partial<H10SideBySideBlackbirdRow> = {}
): H10SideBySideBlackbirdRow {
  return {
    displayName,
    position,
    team: "FA",
    recommendationRank: 1,
    recommendationTier: "strong_target",
    recommendationScore,
    status: "recommendable",
    primaryReason: "Projection value.",
    warningCodes: [],
    scoreComponents,
    ...overrides,
  };
}
