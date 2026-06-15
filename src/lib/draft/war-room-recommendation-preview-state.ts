import type { DraftTargetScorePlayer } from "@/lib/draft/scoring";
import type { NormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import type { WarRoomMatchingCoverageSummary } from "@/lib/draft/war-room-matching-coverage";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import { buildWarRoomRecommendations, type WarRoomRecommendationResult, type WarRoomRecommendationRow } from "@/lib/draft/war-room-recommendations";

export type H10RecommendationPreviewPayload = {
  h10RecommendationPreview?: WarRoomRecommendationRow[];
  h10RecommendationDiagnostics?: WarRoomRecommendationResult["diagnostics"];
};

export type BuildH10RecommendationPreviewPayloadInput = {
  enabled: boolean;
  leagueId: string;
  draftRoomId: string;
  remainingPlayers: DraftTargetScorePlayer[];
  h10ValueOverlay: WarRoomValueOverlayRow[];
  rosterRequirements: NormalizedRosterRequirements;
  positionNeeds?: unknown;
  topNeeds?: unknown;
  myRoster?: unknown[];
  picks?: unknown[];
  currentPickNumber?: number | null;
  currentRound?: number | null;
  picksUntilMyNextPick?: number | null;
  draftedPlayerIds?: string[];
  positionCounts?: Record<string, number>;
  includeDstDryRun?: boolean;
  matchCoverageSummary?: WarRoomMatchingCoverageSummary;
};

export function buildH10RecommendationPreviewPayload(
  input: BuildH10RecommendationPreviewPayloadInput
): H10RecommendationPreviewPayload {
  if (!input.enabled) return {};

  try {
    const preview = buildWarRoomRecommendations({
      leagueId: input.leagueId,
      draftRoomId: input.draftRoomId,
      remainingPlayers: input.remainingPlayers,
      h10ValueOverlay: input.h10ValueOverlay,
      rosterRequirements: input.rosterRequirements,
      positionNeeds: input.positionNeeds,
      topNeeds: input.topNeeds,
      myRoster: input.myRoster,
      picks: input.picks,
      currentPickNumber: input.currentPickNumber,
      currentRound: input.currentRound,
      picksUntilMyNextPick: input.picksUntilMyNextPick,
      draftedPlayerIds: input.draftedPlayerIds,
      positionCounts: input.positionCounts,
      includeDstDryRun: input.includeDstDryRun,
      matchCoverageSummary: input.matchCoverageSummary,
    });
    return {
      h10RecommendationPreview: preview.rows,
      h10RecommendationDiagnostics: preview.diagnostics,
    };
  } catch (error) {
    return {
      h10RecommendationPreview: [],
      h10RecommendationDiagnostics: {
        leagueId: input.leagueId,
        draftRoomId: input.draftRoomId,
        remainingPlayersLoaded: input.remainingPlayers.length,
        overlayRowsLoaded: input.h10ValueOverlay.length,
        recommendationsGenerated: 0,
        rowsByTier: {},
        rowsByStatus: {},
        rowsByPosition: {},
        warningCounts: {},
        idpRowsEvaluated: 0,
        idpRowsByTier: {},
        idpAverageScoreComponents: null,
        idpTopLeagueValueRows: [],
        idpTopRosterNeedRows: [],
        idpTopTierCliffRows: [],
        idpSuppressionReasons: {},
        invariantFailures: [error instanceof Error ? error.message : "Unable to build H10 recommendation preview."],
        contextLimitations: ["H10_RECOMMENDATION_PREVIEW_UNAVAILABLE"],
      },
    };
  }
}
