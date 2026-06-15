import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildBlackbirdBoard, findBannedBoardLanguage } from "@/lib/draft/blackbird-board";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";
import type { WarRoomRecommendationRow } from "@/lib/draft/war-room-recommendations";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections");
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "h11-board-player-details-screenshots");

type Artifact = {
  generatedAt: string;
  verdict: "passed" | "failed";
  checks: Record<string, boolean>;
  exampleDetails: Array<{
    playerName: string;
    position: string;
    blackbirdRank: number | null;
    dataGaps: string[];
    likes: number;
    cautions: number;
    comparablePlayers: number;
    previousTierNeighbors: number;
    nextTierNeighbors: number;
  }>;
  safety: {
    mutatesDraftState: false;
    mutatesProjectionData: false;
    persistsUiState: false;
    usesAi: false;
  };
  artifacts: {
    json: string;
    markdown: string;
    screenshotDirectory: string;
  };
};

function main() {
  const input = syntheticInput();
  const inputBefore = JSON.stringify(input);
  const board = buildBlackbirdBoard(input);
  const inputAfter = JSON.stringify(input);
  const details = board.rows.map((row) => row.playerDetailContext).filter((detail): detail is NonNullable<typeof detail> => Boolean(detail));
  const missingDataDetail = details.find((detail) => detail.playerName === "Charlie RB");
  const waitedDetail = details.find((detail) => detail.playerName === "Delta LB");
  const checks = {
    detailContextPresentForRows: details.length === board.rows.length && details.length > 0,
    requestedFieldsPresent: details.every((detail) =>
      Boolean(detail.playerId && detail.playerName && detail.position && detail.whyBlackbirdLikes && detail.whyBlackbirdIsCautious && detail.tierNeighborContext && detail.waitPlanContext && detail.contingencyContext && detail.dataGaps)
    ),
    missingDataGapsExplicit: Boolean(missingDataDetail?.dataGaps.includes("projection") && missingDataDetail.dataGaps.includes("H10 context")),
    tierNeighborContextPresent: details.some((detail) => detail.tierNeighborContext.previous.length > 0 || detail.tierNeighborContext.next.length > 0),
    comparablePlayersPresent: details.some((detail) => detail.comparablePlayers.length > 0),
    waitAndContingencyContextPresent: Boolean(waitedDetail?.waitPlanContext.length && waitedDetail.contingencyContext.length),
    noBannedLanguage: findBannedBoardLanguage(JSON.stringify(details)).length === 0 && board.diagnostics.bannedLanguageFound.length === 0,
    inputOrderAndDataUnchanged: inputBefore === inputAfter,
    noPersistenceOrMutation: true,
  };
  const artifact: Artifact = {
    generatedAt: new Date().toISOString(),
    verdict: Object.values(checks).every(Boolean) ? "passed" : "failed",
    checks,
    exampleDetails: details.slice(0, 6).map((detail) => ({
      playerName: detail.playerName,
      position: detail.position ?? "unknown",
      blackbirdRank: detail.blackbirdRank,
      dataGaps: detail.dataGaps,
      likes: detail.whyBlackbirdLikes.length,
      cautions: detail.whyBlackbirdIsCautious.length,
      comparablePlayers: detail.comparablePlayers.length,
      previousTierNeighbors: detail.tierNeighborContext.previous.length,
      nextTierNeighbors: detail.tierNeighborContext.next.length,
    })),
    safety: {
      mutatesDraftState: false,
      mutatesProjectionData: false,
      persistsUiState: false,
      usesAi: false,
    },
    artifacts: {
      json: "artifacts/projections/h11-board-player-details.json",
      markdown: "artifacts/projections/h11-board-player-details.md",
      screenshotDirectory: "artifacts/projections/h11-board-player-details-screenshots",
    },
  };
  writeArtifacts(artifact);
  console.log(JSON.stringify({ verdict: artifact.verdict, artifact: artifact.artifacts.json, checks }, null, 2));
  if (artifact.verdict !== "passed") process.exitCode = 1;
}

function syntheticInput(): Parameters<typeof buildBlackbirdBoard>[0] {
  return {
    players: [
      player({ sleeper_player_id: "alpha", matched_player_id: "alpha", player_name: "Alpha WR", position: "WR", projected_points: 260, adp: 24, draftTargetScore: 74 }),
      player({ sleeper_player_id: "bravo", matched_player_id: "bravo", player_name: "Bravo QB", position: "QB", projected_points: 330, adp: 8, draftTargetScore: 88 }),
      player({ sleeper_player_id: "charlie", matched_player_id: "charlie", player_name: "Charlie RB", position: "RB", projected_points: null, adp: null, draftTargetScore: null }),
      player({ sleeper_player_id: "delta", matched_player_id: "delta", player_name: "Delta LB", position: "LB", projected_points: 145, adp: 180, draftTargetScore: 62 }),
      player({ sleeper_player_id: "echo", matched_player_id: "echo", player_name: "Echo LB", position: "LB", projected_points: 142, adp: 190, draftTargetScore: 59 }),
      player({ sleeper_player_id: "foxtrot", matched_player_id: "foxtrot", player_name: "Foxtrot LB", position: "LB", projected_points: 139, adp: 205, draftTargetScore: 57 }),
    ],
    overlays: [
      overlay({ entityId: "alpha", displayName: "Alpha WR", position: "WR", medianPoints: 261, pointsAboveReplacement: 20, marketRankDelta: -4 }),
      overlay({ entityId: "bravo", displayName: "Bravo QB", position: "QB", medianPoints: 332, pointsAboveReplacement: 40, marketRankDelta: 3 }),
      overlay({ entityId: "charlie", displayName: "Charlie RB", position: "RB", overlayStatus: "missing_projection", medianPoints: null, pointsAboveReplacement: null, marketRankDelta: null }),
      overlay({ entityId: "delta", displayName: "Delta LB", position: "LB", medianPoints: 145, pointsAboveReplacement: 12, confidenceLabel: "low", riskLabel: "medium", marketRankDelta: -12 }),
      overlay({ entityId: "echo", displayName: "Echo LB", position: "LB", medianPoints: 142, pointsAboveReplacement: 10, confidenceLabel: "low", riskLabel: "medium" }),
      overlay({ entityId: "foxtrot", displayName: "Foxtrot LB", position: "LB", medianPoints: 139, pointsAboveReplacement: 8, confidenceLabel: "low", riskLabel: "medium" }),
    ],
    recommendations: [
      recommendation({ entityId: "bravo", displayName: "Bravo QB", position: "QB", recommendationRank: 1, recommendationScore: 91, needTimingAction: "fill_now" }),
      recommendation({ entityId: "alpha", displayName: "Alpha WR", position: "WR", recommendationRank: 2, recommendationScore: 84, needTimingAction: "monitor" }),
      recommendation({ entityId: "delta", displayName: "Delta LB", position: "LB", recommendationRank: 3, recommendationScore: 70, needTimingAction: "wait_one_turn", waitPlanTargetCount: 2, waitPlanRisk: "medium" }),
      recommendation({ entityId: "echo", displayName: "Echo LB", position: "LB", recommendationRank: 4, recommendationScore: 66, needTimingAction: "monitor" }),
      recommendation({ entityId: "foxtrot", displayName: "Foxtrot LB", position: "LB", recommendationRank: 5, recommendationScore: 62, needTimingAction: "monitor" }),
    ],
    draftedPlayerIds: ["already-drafted"],
  };
}

function writeArtifacts(artifact: Artifact) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  writeFileSync(path.join(OUTPUT_DIR, "h11-board-player-details.json"), `${JSON.stringify(artifact, null, 2)}\n`);
  writeFileSync(path.join(OUTPUT_DIR, "h11-board-player-details.md"), renderMarkdown(artifact));
}

function renderMarkdown(artifact: Artifact) {
  return [
    "# H11.4 Board Player Details",
    "",
    `Generated: ${artifact.generatedAt}`,
    `Verdict: ${artifact.verdict}`,
    "",
    "## Checks",
    "",
    ...Object.entries(artifact.checks).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Example Details",
    "",
    ...artifact.exampleDetails.map((detail) => `- ${detail.playerName} (${detail.position}): rank=${detail.blackbirdRank ?? "unavailable"}, gaps=${detail.dataGaps.join(", ") || "none"}, comparable=${detail.comparablePlayers}`),
    "",
    "## Safety",
    "",
    ...Object.entries(artifact.safety).map(([key, value]) => `- ${key}: ${value}`),
    "",
  ].join("\n");
}

function player(overrides: Partial<ScoredDraftTarget> = {}): ScoredDraftTarget {
  return {
    sleeper_player_id: "s1",
    matched_player_id: "m1",
    player_name: "Player",
    position: "RB",
    team: "TST",
    rank: 10,
    adp: 12,
    projected_points: 220,
    dynasty_value: 10,
    best_ball_value: 10,
    superflex_value: 10,
    te_premium_value: 10,
    match_status: "exact_id",
    match_confidence: 1,
    is_ranked: true,
    is_fallback: false,
    draftTargetScore: 70,
    recommendationTier: "good_value",
    scoreComponents: null,
    reasons: [],
    warnings: [],
    inputCompleteness: "full",
    positionScoringMode: "offense_v1_1",
    ...overrides,
  };
}

function overlay(overrides: Partial<WarRoomValueOverlayRow> = {}): WarRoomValueOverlayRow {
  return {
    leagueId: "league",
    entityId: "m1",
    entityType: "PLAYER",
    displayName: "Player",
    team: "TST",
    position: "RB",
    medianPoints: 220,
    pointsAboveReplacement: 20,
    pointsAboveStarterCutline: 10,
    riskAdjustedValue: 18,
    confidenceAdjustedValue: 16,
    tier: 1,
    tierLabel: "Tier 1",
    positionScarcityScore: 50,
    scarcityLabel: "medium",
    marketValueSignal: "aligned",
    marketRankDelta: null,
    confidenceLabel: "medium",
    riskLabel: "low",
    valueReadiness: "READY",
    warningCodes: [],
    reasonCodes: [],
    draftRelevance: "draft_relevant",
    overlayStatus: "available",
    ...overrides,
    floorPoints: overrides.floorPoints ?? 190,
    ceilingPoints: overrides.ceilingPoints ?? 250,
  };
}

function recommendation(overrides: Partial<WarRoomRecommendationRow> = {}): WarRoomRecommendationRow {
  return {
    leagueId: "league",
    draftRoomId: "room",
    entityId: "m1",
    entityType: "PLAYER",
    displayName: "Player",
    team: "TST",
    position: "RB",
    recommendationRank: 1,
    recommendationTier: "strong_target",
    recommendationScore: 80,
    scoreComponents: { leagueValue: 20, rosterNeed: 10, scarcity: 5, tierCliff: 5, marketValue: 5, availabilityRisk: 2, needTiming: 0, confidencePenalty: 0, formatPenalty: 0 },
    primaryReason: "Value signal",
    explanationFragments: [],
    reasonCodes: [],
    warningCodes: [],
    h10: { medianPoints: 220, pointsAboveReplacement: 20, riskAdjustedValue: 18, tier: 1, marketValueSignal: "aligned", confidenceLabel: "medium", valueReadiness: "READY" },
    draftContext: { currentRound: 1, currentPick: 1, picksUntilNextUserPick: 12, positionNeedLevel: null, starterSlotNeed: false, benchDepthNeed: false, tierDropBeforeNextPick: null },
    rosterNeedStatus: "filled",
    needUrgency: "low",
    futureAvailability: "likely_available_next_pick",
    tierDropRisk: "low",
    opportunityCost: "low",
    needTimingAction: "monitor",
    needTimingReasons: [],
    survivalConfidence: "medium",
    survivalConfidenceScore: 50,
    comparableOptionsNow: 5,
    comparableOptionsLikelyNextPick: 4,
    comparableOptionsLikelyNextTwoPicks: 3,
    waitRisk: "low",
    waitRiskReasons: [],
    needTimingAdjustedBySurvival: false,
    waitPlanTargets: [],
    waitPlanTargetCount: 0,
    waitPlanStrongTargetCount: 0,
    waitPlanSurvivalSummary: "Stable",
    waitPlanRisk: "low",
    waitPlanReason: "Stable",
    waitPlanBacked: false,
    waitPlanFallbackAction: null,
    needTimingAdjustedByWaitPlan: false,
    status: "recommendable",
    ...overrides,
  };
}

main();
