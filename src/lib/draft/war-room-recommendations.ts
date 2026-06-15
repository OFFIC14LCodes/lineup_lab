import type { DraftTargetScorePlayer } from "@/lib/draft/scoring";
import type { NormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import type { WarRoomMatchingCoverageSummary } from "@/lib/draft/war-room-matching-coverage";

export type WarRoomRecommendationTier =
  | "priority_target"
  | "strong_target"
  | "solid_target"
  | "watchlist"
  | "avoid_for_now"
  | "insufficient_data";

export type WarRoomRecommendationStatus =
  | "recommendable"
  | "watch_only"
  | "missing_projection"
  | "format_excluded"
  | "already_drafted"
  | "insufficient_context";

export type WarRoomRecommendationRow = {
  leagueId: string;
  draftRoomId: string;
  entityId: string | null;
  entityType: "PLAYER" | "TEAM_DEFENSE" | null;
  displayName: string;
  team: string | null;
  position: string | null;
  recommendationRank: number;
  recommendationTier: WarRoomRecommendationTier;
  recommendationScore: number;
  scoreComponents: {
    leagueValue: number;
    rosterNeed: number;
    scarcity: number;
    tierCliff: number;
    marketValue: number;
    availabilityRisk: number;
    confidencePenalty: number;
    formatPenalty: number;
  };
  primaryReason: string;
  explanationFragments: string[];
  reasonCodes: string[];
  warningCodes: string[];
  h10: {
    medianPoints: number | null;
    pointsAboveReplacement: number | null;
    riskAdjustedValue: number | null;
    tier: number | null;
    marketValueSignal: string | null;
    confidenceLabel: string | null;
    valueReadiness: string | null;
  };
  draftContext: {
    currentRound: number | null;
    currentPick: number | null;
    picksUntilNextUserPick: number | null;
    positionNeedLevel: string | null;
    starterSlotNeed: boolean;
    benchDepthNeed: boolean;
    tierDropBeforeNextPick: boolean | null;
  };
  status: WarRoomRecommendationStatus;
};

export type WarRoomRecommendationResult = {
  rows: WarRoomRecommendationRow[];
  diagnostics: {
    leagueId: string;
    draftRoomId: string;
    remainingPlayersLoaded: number;
    overlayRowsLoaded: number;
    recommendationsGenerated: number;
    rowsByTier: Record<string, number>;
    rowsByStatus: Record<string, number>;
    rowsByPosition: Record<string, number>;
    warningCounts: Record<string, number>;
    matchCoverageSummary?: WarRoomMatchingCoverageSummary;
    missingProjectionReasons?: Record<string, number>;
    matchRateByPosition?: WarRoomMatchingCoverageSummary["matchRateByPosition"];
    highPriorityMissingProjectionExamples?: WarRoomMatchingCoverageSummary["highPriorityMissingProjectionExamples"];
    idpRowsEvaluated: number;
    idpRowsByTier: Record<string, number>;
    idpAverageScoreComponents: WarRoomRecommendationRow["scoreComponents"] | null;
    idpTopLeagueValueRows: Array<Pick<WarRoomRecommendationRow, "displayName" | "position" | "recommendationScore" | "recommendationTier" | "scoreComponents" | "warningCodes">>;
    idpTopRosterNeedRows: Array<Pick<WarRoomRecommendationRow, "displayName" | "position" | "recommendationScore" | "recommendationTier" | "scoreComponents" | "warningCodes">>;
    idpTopTierCliffRows: Array<Pick<WarRoomRecommendationRow, "displayName" | "position" | "recommendationScore" | "recommendationTier" | "scoreComponents" | "warningCodes">>;
    idpSuppressionReasons: Record<string, number>;
    invariantFailures: string[];
    contextLimitations: string[];
  };
};

export type BuildWarRoomRecommendationsInput = {
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

type PositionNeedLike = {
  position: string;
  current?: number;
  draftedCount?: number;
  target?: number;
  minimumNeed?: number;
  directStarterRequirement?: number;
  sharedFlexDemand?: number;
  needLevel?: string;
  kind?: string;
};

type ScoreContext = {
  riskValues: number[];
  parValues: number[];
  starterCutlineValues: number[];
  scarcityValues: number[];
  tierCounts: Record<string, number>;
  contextLimitations: string[];
  needsByPosition: Map<string, PositionNeedLike>;
};

const FORBIDDEN_FIELDS = ["bestPick", "shouldDraft", "takeNow", "lockButton", "mustDraft", "guaranteed"];
const BANNED_EXPLANATION_TERMS = ["steal", "smash", "lock", "must draft", "league winner", "trust me"];
const IDP_POSITIONS = new Set(["DL", "LB", "DB"]);
const OFFENSIVE_FLEX_POSITIONS = new Set(["RB", "WR", "TE"]);

export function buildWarRoomRecommendations(input: BuildWarRoomRecommendationsInput): WarRoomRecommendationResult {
  const contextLimitations = buildContextLimitations(input);
  const scoreContext = buildScoreContext(input, contextLimitations);
  const rows = input.remainingPlayers.map((player, index) =>
    buildRecommendationRow({
      input,
      player,
      overlay: input.h10ValueOverlay[index] ?? null,
      scoreContext,
    })
  );
  const rankedRows = rows
    .sort(sortRecommendationRows)
    .map((row, index) => ({ ...row, recommendationRank: index + 1 }));
  const idpDiagnostics = buildIdpDiagnostics(rankedRows);

  return {
    rows: rankedRows,
    diagnostics: {
      leagueId: input.leagueId,
      draftRoomId: input.draftRoomId,
      remainingPlayersLoaded: input.remainingPlayers.length,
      overlayRowsLoaded: input.h10ValueOverlay.length,
      recommendationsGenerated: rankedRows.length,
      rowsByTier: countBy(rankedRows.map((row) => row.recommendationTier)),
      rowsByStatus: countBy(rankedRows.map((row) => row.status)),
      rowsByPosition: countBy(rankedRows.map((row) => normalizePosition(row.position))),
      warningCounts: countBy(rankedRows.flatMap((row) => row.warningCodes)),
      matchCoverageSummary: input.matchCoverageSummary,
      missingProjectionReasons: input.matchCoverageSummary?.missingProjectionReasons,
      matchRateByPosition: input.matchCoverageSummary?.matchRateByPosition,
      highPriorityMissingProjectionExamples: input.matchCoverageSummary?.highPriorityMissingProjectionExamples,
      ...idpDiagnostics,
      invariantFailures: [...validateForbiddenFields(rankedRows), ...validateExplanations(rankedRows)],
      contextLimitations,
    },
  };
}

function buildRecommendationRow({
  input,
  player,
  overlay,
  scoreContext,
}: {
  input: BuildWarRoomRecommendationsInput;
  player: DraftTargetScorePlayer;
  overlay: WarRoomValueOverlayRow | null;
  scoreContext: ScoreContext;
}): WarRoomRecommendationRow {
  const position = normalizePosition(player.position ?? overlay?.position ?? null);
  const rosterContext = deriveRosterContext(position, input, scoreContext.needsByPosition);
  const alreadyDrafted = isAlreadyDrafted(player, overlay, input.draftedPlayerIds ?? []);
  const status = getStatus(overlay, alreadyDrafted);
  const reasonCodes = new Set<string>(overlay?.reasonCodes ?? []);
  const warningCodes = new Set<string>(overlay?.warningCodes ?? []);

  if (scoreContext.contextLimitations.includes("ROSTER_CONTEXT_MISSING")) warningCodes.add("ROSTER_CONTEXT_MISSING");
  if (scoreContext.contextLimitations.includes("NEXT_PICK_CONTEXT_MISSING")) warningCodes.add("NEXT_PICK_CONTEXT_MISSING");
  if (rosterContext.positionOverfilled) reasonCodes.add("POSITION_OVERFILLED");
  if (rosterContext.starterNeed) reasonCodes.add("STARTER_NEED");
  if (rosterContext.benchNeed) reasonCodes.add("BENCH_DEPTH_NEED");
  if (rosterContext.mustDraftSoon) reasonCodes.add("DRAFT_CONTEXT_PRESSURE");

  const leagueValue = status === "missing_projection" ? 0 : scoreLeagueValue(overlay, scoreContext);
  const rosterNeed = status === "format_excluded" ? 0 : scoreRosterNeed(position, rosterContext, input);
  const scarcity = status === "missing_projection" ? 0 : scoreScarcity(overlay, scoreContext);
  const tierCliffResult = scoreTierCliff(overlay, input, scoreContext);
  const marketValue = status === "missing_projection" ? 0 : scoreMarketValue(overlay, player);
  const availabilityRisk = scoreAvailabilityRisk(player, overlay, input, tierCliffResult.sameTierRemaining);
  const confidencePenalty = scoreConfidencePenalty(overlay, position, input);
  const formatPenalty =
    status === "format_excluded"
      ? -100
      : alreadyDrafted
        ? -100
        : earlySpecialTeamsPenalty(position, input.currentRound ?? null) + (rosterContext.positionOverfilled ? -10 : 0);

  if (tierCliffResult.tierDropBeforeNextPick === null && overlay?.tier !== null && overlay?.tier !== undefined) {
    warningCodes.add("NEXT_PICK_AVAILABILITY_UNKNOWN");
  }
  if (tierCliffResult.visible) reasonCodes.add("TIER_CLIFF_VISIBLE");
  if (overlay?.marketValueSignal === "no_compatible_market") warningCodes.add("NO_COMPATIBLE_MARKET");
  if (overlay?.marketValueSignal === "not_implemented") warningCodes.add("MARKET_NOT_IMPLEMENTED");
  if (position === "K" && isEarlyRound(input.currentRound ?? null)) warningCodes.add("K_EARLY_ROUND_SUPPRESSION");
  if (position === "DEF" && isEarlyRound(input.currentRound ?? null)) warningCodes.add("DST_EARLY_ROUND_SUPPRESSION");

  const score = clamp(
    leagueValue + rosterNeed + scarcity + tierCliffResult.score + marketValue + availabilityRisk + confidencePenalty + formatPenalty,
    0,
    100
  );
  const tier = getRecommendationTier({ score, status, overlay, position, currentRound: input.currentRound ?? null, formatPenalty });
  const finalStatus = tier === "insufficient_data" && status === "recommendable" ? "insufficient_context" : status;
  const explanationFragments = buildExplanationFragments({
    overlay,
    position,
    rosterContext,
    tierCliff: tierCliffResult,
    marketValue,
    scoreComponents: {
      leagueValue,
      rosterNeed,
      scarcity,
      tierCliff: tierCliffResult.score,
      marketValue,
      availabilityRisk,
      confidencePenalty,
      formatPenalty,
    },
    warningCodes: [...warningCodes],
  });

  return {
    leagueId: input.leagueId,
    draftRoomId: input.draftRoomId,
    entityId: overlay?.entityId ?? player.matched_player_id ?? null,
    entityType: overlay?.entityType ?? (position === "DEF" ? "TEAM_DEFENSE" : "PLAYER"),
    displayName: player.player_name ?? overlay?.displayName ?? "Unknown",
    team: player.team ?? overlay?.team ?? null,
    position: position || null,
    recommendationRank: 0,
    recommendationTier: tier,
    recommendationScore: round(score),
    scoreComponents: {
      leagueValue: round(leagueValue),
      rosterNeed: round(rosterNeed),
      scarcity: round(scarcity),
      tierCliff: round(tierCliffResult.score),
      marketValue: round(marketValue),
      availabilityRisk: round(availabilityRisk),
      confidencePenalty: round(confidencePenalty),
      formatPenalty: round(formatPenalty),
    },
    primaryReason: explanationFragments[0] ?? "Insufficient context for a value recommendation.",
    explanationFragments,
    reasonCodes: [...reasonCodes].sort(),
    warningCodes: [...warningCodes].sort(),
    h10: {
      medianPoints: overlay?.medianPoints ?? null,
      pointsAboveReplacement: overlay?.pointsAboveReplacement ?? null,
      riskAdjustedValue: overlay?.riskAdjustedValue ?? null,
      tier: overlay?.tier ?? null,
      marketValueSignal: overlay?.marketValueSignal ?? null,
      confidenceLabel: overlay?.confidenceLabel ?? null,
      valueReadiness: overlay?.valueReadiness ?? null,
    },
    draftContext: {
      currentRound: input.currentRound ?? null,
      currentPick: input.currentPickNumber ?? null,
      picksUntilNextUserPick: input.picksUntilMyNextPick ?? null,
      positionNeedLevel: rosterContext.needLevel,
      starterSlotNeed: rosterContext.starterNeed,
      benchDepthNeed: rosterContext.benchNeed,
      tierDropBeforeNextPick: tierCliffResult.tierDropBeforeNextPick,
    },
    status: finalStatus,
  };
}

function buildScoreContext(input: BuildWarRoomRecommendationsInput, contextLimitations: string[]): ScoreContext {
  const playableRows = input.h10ValueOverlay.filter((row) => row.overlayStatus !== "missing_projection" && row.overlayStatus !== "format_excluded");
  return {
    riskValues: finiteValues(playableRows.map((row) => row.riskAdjustedValue)),
    parValues: finiteValues(playableRows.map((row) => row.pointsAboveReplacement)),
    starterCutlineValues: finiteValues(playableRows.map((row) => row.pointsAboveStarterCutline)),
    scarcityValues: finiteValues(playableRows.map((row) => row.positionScarcityScore)),
    tierCounts: countBy(playableRows.map((row) => tierKey(row))),
    contextLimitations,
    needsByPosition: parseNeeds(input.positionNeeds, input.topNeeds),
  };
}

function buildContextLimitations(input: BuildWarRoomRecommendationsInput): string[] {
  const limitations: string[] = [];
  if (!input.positionCounts && !Array.isArray(input.positionNeeds) && !Array.isArray(input.topNeeds) && !input.myRoster?.length) {
    limitations.push("ROSTER_CONTEXT_MISSING");
  }
  if (input.picksUntilMyNextPick === null || input.picksUntilMyNextPick === undefined || input.currentPickNumber === null || input.currentPickNumber === undefined) {
    limitations.push("NEXT_PICK_CONTEXT_MISSING");
  }
  if (input.h10ValueOverlay.length === 0) limitations.push("H10_VALUE_OVERLAY_MISSING");
  if (input.h10ValueOverlay.length > 0 && input.h10ValueOverlay.length !== input.remainingPlayers.length) {
    limitations.push("OVERLAY_PLAYER_COUNT_MISMATCH");
  }
  return limitations;
}

function parseNeeds(positionNeeds: unknown, topNeeds: unknown): Map<string, PositionNeedLike> {
  const needs = new Map<string, PositionNeedLike>();
  for (const item of [...unknownArray(positionNeeds), ...unknownArray(topNeeds)]) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const position = normalizePosition(typeof row.position === "string" ? row.position : null);
    if (!position) continue;
    const existing = needs.get(position);
    if (!existing || needWeight(row.needLevel) > needWeight(existing.needLevel)) {
      needs.set(position, {
        position,
        current: numberOrUndefined(row.current),
        draftedCount: numberOrUndefined(row.draftedCount),
        target: numberOrUndefined(row.target),
        minimumNeed: numberOrUndefined(row.minimumNeed),
        directStarterRequirement: numberOrUndefined(row.directStarterRequirement),
        sharedFlexDemand: numberOrUndefined(row.sharedFlexDemand),
        needLevel: typeof row.needLevel === "string" ? row.needLevel : undefined,
        kind: typeof row.kind === "string" ? row.kind : undefined,
      });
    }
  }
  return needs;
}

function deriveRosterContext(
  position: string,
  input: BuildWarRoomRecommendationsInput,
  needsByPosition: Map<string, PositionNeedLike>
) {
  const need = needsByPosition.get(position);
  const current = input.positionCounts?.[position] ?? need?.current ?? need?.draftedCount ?? countRosterPosition(input.myRoster, position);
  const directRequirement = getDirectRequirement(position, input.rosterRequirements);
  const sharedDemand = getSharedDemand(position, input.rosterRequirements);
  const minimumNeed = need?.minimumNeed ?? need?.target ?? getMinimumNeed(position, input.rosterRequirements);
  const needLevel = need?.needLevel ?? deriveNeedLevel(position, current, directRequirement, sharedDemand);
  const starterNeed = current < directRequirement;
  const benchNeed = !starterNeed && sharedDemand > 0 && current < minimumNeed;
  const positionUnderfilled = starterNeed || benchNeed || ["urgent", "high", "moderate"].includes(needLevel);
  const positionOverfilled = current > Math.max(minimumNeed + 1, directRequirement + sharedDemand + 1);
  const mustDraftSoon = starterNeed && (input.currentRound ?? 1) >= 8;
  const luxuryPick = !positionUnderfilled && current >= minimumNeed;
  return { current, directRequirement, sharedDemand, minimumNeed, needLevel, starterNeed, benchNeed, positionUnderfilled, positionOverfilled, mustDraftSoon, luxuryPick };
}

function scoreLeagueValue(overlay: WarRoomValueOverlayRow | null, context: ScoreContext): number {
  if (!overlay) return 0;
  const risk = normalizeToRange(overlay.riskAdjustedValue, context.riskValues, 0, 13);
  const par = normalizeToRange(overlay.pointsAboveReplacement, context.parValues, 0, 11);
  const starter = normalizeToRange(overlay.pointsAboveStarterCutline, context.starterCutlineValues, 0, 6);
  return risk + par + starter;
}

function scoreRosterNeed(position: string, rosterContext: ReturnType<typeof deriveRosterContext>, input: BuildWarRoomRecommendationsInput): number {
  if (!position) return 0;
  let score = 4;
  if (rosterContext.starterNeed) score += 10;
  if (rosterContext.benchNeed) score += 5;
  if (rosterContext.needLevel === "urgent") score += 6;
  else if (rosterContext.needLevel === "high") score += 4;
  else if (rosterContext.needLevel === "moderate") score += 2;
  else if (rosterContext.needLevel === "filled") score -= 4;
  else if (rosterContext.needLevel === "not_used") score -= 8;
  if (input.rosterRequirements.superflexCount > 0 && position === "QB") score += rosterContext.current === 0 ? 7 : rosterContext.current === 1 ? 4 : 1;
  if (input.rosterRequirements.offensiveFlexCount > 0 && OFFENSIVE_FLEX_POSITIONS.has(position)) score += 2;
  if (input.rosterRequirements.idpFlexCount > 0 && IDP_POSITIONS.has(position)) score += 3;
  if (rosterContext.positionOverfilled) score -= 8;
  if (position === "K" && !isLateRound(input.currentRound ?? null)) score -= 8;
  if (position === "DEF" && !isLateRound(input.currentRound ?? null)) score -= 8;
  return clamp(score, 0, 20);
}

function scoreScarcity(overlay: WarRoomValueOverlayRow | null, context: ScoreContext): number {
  if (!overlay) return 0;
  const numeric = normalizeToRange(overlay.positionScarcityScore, context.scarcityValues, 0, 10);
  const labelBonus = overlay.scarcityLabel === "high" ? 5 : overlay.scarcityLabel === "medium" ? 3 : overlay.scarcityLabel === "low" ? 1 : 2;
  return clamp(numeric + labelBonus, 0, 15);
}

function scoreTierCliff(overlay: WarRoomValueOverlayRow | null, input: BuildWarRoomRecommendationsInput, context: ScoreContext) {
  if (!overlay || overlay.tier === null || overlay.tier === undefined) {
    return { score: 0, visible: false, sameTierRemaining: 0, tierDropBeforeNextPick: null as boolean | null };
  }
  const sameTierRemaining = context.tierCounts[tierKey(overlay)] ?? 0;
  const visible = sameTierRemaining <= 3;
  const hasPickContext = input.picksUntilMyNextPick !== null && input.picksUntilMyNextPick !== undefined;
  const tierDropBeforeNextPick = hasPickContext ? sameTierRemaining <= Math.max(1, Math.ceil((input.picksUntilMyNextPick ?? 0) / 6)) : null;
  let score = 2;
  if (sameTierRemaining <= 1) score += 9;
  else if (sameTierRemaining <= 3) score += 6;
  else if (sameTierRemaining <= 6) score += 3;
  if (tierDropBeforeNextPick) score += 4;
  if (!hasPickContext && visible) score += 2;
  return { score: clamp(score, 0, 15), visible, sameTierRemaining, tierDropBeforeNextPick };
}

function scoreMarketValue(overlay: WarRoomValueOverlayRow | null, player: DraftTargetScorePlayer): number {
  if (!overlay) return 0;
  let score = 5;
  if (overlay.marketValueSignal === "above_market") score += 4;
  if (overlay.marketValueSignal === "aligned") score += 1;
  if (overlay.marketValueSignal === "below_market") score -= 2;
  if (overlay.marketValueSignal === "no_compatible_market") score -= 1;
  if (overlay.marketValueSignal === "not_implemented") score -= 2;
  if ((overlay.marketRankDelta ?? 0) >= 12) score += 2;
  if ((overlay.marketRankDelta ?? 0) <= -12) score -= 2;
  if (player.adp !== null && player.rank !== null && player.adp - player.rank >= 12) score += 1;
  return clamp(score, 0, 10);
}

function scoreAvailabilityRisk(
  player: DraftTargetScorePlayer,
  overlay: WarRoomValueOverlayRow | null,
  input: BuildWarRoomRecommendationsInput,
  sameTierRemaining: number
): number {
  if (input.picksUntilMyNextPick === null || input.picksUntilMyNextPick === undefined) return overlay ? 2 : 0;
  let score = 1;
  const currentPick = input.currentPickNumber ?? 0;
  const nextPick = currentPick + input.picksUntilMyNextPick;
  if (player.adp !== null && player.adp <= nextPick) score += 2;
  if (player.rank !== null && player.rank <= nextPick) score += 1;
  if (sameTierRemaining > 0 && sameTierRemaining <= Math.max(1, Math.ceil(input.picksUntilMyNextPick / 8))) score += 2;
  return clamp(score, 0, 5);
}

function scoreConfidencePenalty(overlay: WarRoomValueOverlayRow | null, position: string, input: BuildWarRoomRecommendationsInput): number {
  if (!overlay) return -45;
  if (IDP_POSITIONS.has(position)) return scoreIdpConfidencePenalty(overlay);
  let penalty = 0;
  if (overlay.confidenceLabel === "very_low") penalty -= 18;
  else if (overlay.confidenceLabel === "low") penalty -= 10;
  if (overlay.overlayStatus === "low_confidence") penalty -= 8;
  if (overlay.overlayStatus === "dst_dry_run") penalty -= input.includeDstDryRun ? 12 : 24;
  if (overlay.valueReadiness === "LOW_CONFIDENCE_BASELINE") penalty -= 8;
  if (overlay.valueReadiness === "SCORING_PARTIAL_ALLOWANCE_ONLY") penalty -= 10;
  if (overlay.warningCodes.includes("LOW_PROJECTION_CONFIDENCE")) penalty -= 5;
  if (position === "K" && !isLateRound(input.currentRound ?? null)) penalty -= 5;
  return penalty;
}

function scoreIdpConfidencePenalty(overlay: WarRoomValueOverlayRow): number {
  let penalty = 0;
  if (overlay.confidenceLabel === "very_low") penalty -= 14;
  else if (overlay.confidenceLabel === "low") penalty -= 6;
  if (overlay.overlayStatus === "low_confidence") penalty -= 3;
  if (overlay.valueReadiness === "LOW_CONFIDENCE_BASELINE") penalty -= 3;
  if (overlay.warningCodes.includes("LOW_PROJECTION_CONFIDENCE")) penalty -= 2;
  return penalty;
}

function getStatus(overlay: WarRoomValueOverlayRow | null, alreadyDrafted: boolean): WarRoomRecommendationStatus {
  if (alreadyDrafted) return "already_drafted";
  if (!overlay || overlay.overlayStatus === "missing_projection") return "missing_projection";
  if (overlay.overlayStatus === "format_excluded") return "format_excluded";
  if (overlay.overlayStatus === "low_confidence" || overlay.overlayStatus === "dst_dry_run") return "watch_only";
  return "recommendable";
}

function getRecommendationTier(input: {
  score: number;
  status: WarRoomRecommendationStatus;
  overlay: WarRoomValueOverlayRow | null;
  position: string;
  currentRound: number | null;
  formatPenalty: number;
}): WarRoomRecommendationTier {
  if (input.status === "missing_projection") return "insufficient_data";
  if (input.status === "format_excluded" || input.status === "already_drafted" || input.formatPenalty <= -50) return "avoid_for_now";
  if (input.overlay?.overlayStatus === "dst_dry_run" || input.overlay?.valueReadiness === "SCORING_PARTIAL_ALLOWANCE_ONLY") {
    if (input.score >= 72) return "strong_target";
  }
  if (input.overlay?.confidenceLabel === "very_low" && input.score >= 85) return "strong_target";
  if (input.position === "K" && !isLateRound(input.currentRound) && input.score >= 85) return "strong_target";
  if (input.score >= 85 && input.status === "recommendable") return "priority_target";
  if (input.score >= 72) return "strong_target";
  if (input.score >= 58) return "solid_target";
  if (input.score >= 42) return "watchlist";
  return "avoid_for_now";
}

function buildExplanationFragments(input: {
  overlay: WarRoomValueOverlayRow | null;
  position: string;
  rosterContext: ReturnType<typeof deriveRosterContext>;
  tierCliff: ReturnType<typeof scoreTierCliff>;
  marketValue: number;
  scoreComponents: WarRoomRecommendationRow["scoreComponents"];
  warningCodes: string[];
}): string[] {
  const fragments: string[] = [];
  if (!input.overlay || input.overlay.overlayStatus === "missing_projection") {
    fragments.push("Insufficient data: no H10 projection is available for this row.");
  } else if (input.scoreComponents.leagueValue >= 20 && (input.overlay.pointsAboveReplacement ?? 0) > 0) {
    fragments.push(`High league value: ${formatSigned(input.overlay.pointsAboveReplacement)} points above replacement.`);
  } else {
    fragments.push(`League value: ${formatSigned(input.overlay.pointsAboveReplacement)} points above replacement.`);
  }
  if (input.rosterContext.starterNeed) fragments.push(`Roster need: ${input.position} starter depth still matters in this format.`);
  else if (input.rosterContext.benchNeed) fragments.push(`Roster need: ${input.position} bench depth is still useful in this format.`);
  else if (input.rosterContext.positionOverfilled) fragments.push(`Roster fit: ${input.position} is already ahead of current roster need.`);
  if (input.scoreComponents.scarcity >= 10) fragments.push(`Scarcity: ${input.position} scarcity is ${input.overlay?.scarcityLabel ?? "elevated"} in this league.`);
  if (input.tierCliff.visible) fragments.push("Tier cliff: few players remain in this tier.");
  if (input.tierCliff.tierDropBeforeNextPick === null && input.tierCliff.visible) fragments.push("Tier cliff: next-pick availability is unknown.");
  if (input.overlay?.marketValueSignal === "above_market") fragments.push(`Market: Blackbird is ${Math.abs(input.overlay.marketRankDelta ?? 0)} rank spots above market.`);
  if (input.overlay?.marketValueSignal === "no_compatible_market") fragments.push("Warning: no compatible ADP is available for this format.");
  if (input.overlay?.overlayStatus === "low_confidence") fragments.push("Risk: low-confidence baseline; range is wide.");
  if (input.overlay?.overlayStatus === "dst_dry_run") fragments.push("Risk: team defense value is allowance-only dry-run context.");
  if (input.warningCodes.includes("NEXT_PICK_CONTEXT_MISSING")) fragments.push("Timing: next-pick context is missing, so urgency is conservative.");
  return Array.from(new Set(fragments)).slice(0, 6);
}

function isAlreadyDrafted(player: DraftTargetScorePlayer, overlay: WarRoomValueOverlayRow | null, draftedPlayerIds: string[]): boolean {
  const drafted = new Set(draftedPlayerIds);
  return Boolean(
    (player.sleeper_player_id && drafted.has(player.sleeper_player_id)) ||
      (player.matched_player_id && drafted.has(player.matched_player_id)) ||
      (overlay?.entityId && drafted.has(overlay.entityId))
  );
}

function getDirectRequirement(position: string, requirements: NormalizedRosterRequirements): number {
  if (position === "DST") return requirements.directStarters.DEF;
  return requirements.directStarters[position as keyof NormalizedRosterRequirements["directStarters"]] ?? 0;
}

function getSharedDemand(position: string, requirements: NormalizedRosterRequirements): number {
  if (position === "QB") return requirements.superflexCount;
  if (position === "RB" || position === "WR" || position === "TE") return requirements.offensiveFlexCount + requirements.superflexCount;
  if (IDP_POSITIONS.has(position)) return requirements.idpFlexCount;
  return 0;
}

function getMinimumNeed(position: string, requirements: NormalizedRosterRequirements): number {
  const direct = getDirectRequirement(position, requirements);
  const shared = getSharedDemand(position, requirements);
  if (position === "QB") return direct + Math.min(shared, 1);
  if (position === "RB" || position === "WR") return direct + (shared > 0 ? 1 : 0);
  if (position === "TE") return direct + (shared >= 2 ? 1 : 0);
  if (IDP_POSITIONS.has(position)) return direct + (shared > 0 ? 1 : 0);
  return direct;
}

function deriveNeedLevel(position: string, current: number, directRequirement: number, sharedDemand: number): string {
  if (!position || (directRequirement === 0 && sharedDemand === 0)) return "not_used";
  if (position === "QB" && sharedDemand > 0) {
    if (current === 0) return "urgent";
    if (current === 1) return "high";
  }
  if (current < directRequirement - 1) return "urgent";
  if (current < directRequirement) return "high";
  if (sharedDemand > 0 && current < directRequirement + 1) return "moderate";
  if (sharedDemand > 0) return "low";
  return "filled";
}

function countRosterPosition(myRoster: unknown[] | undefined, position: string): number {
  return unknownArray(myRoster).filter((row) => row && typeof row === "object" && normalizePosition((row as Record<string, unknown>).position as string | null) === position).length;
}

function normalizeToRange(value: number | null | undefined, values: number[], minScore: number, maxScore: number): number {
  if (value === null || value === undefined || !Number.isFinite(value) || values.length === 0) return (minScore + maxScore) / 2;
  if (values.length === 1) return (minScore + maxScore) / 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return (minScore + maxScore) / 2;
  return minScore + ((value - min) / (max - min)) * (maxScore - minScore);
}

function finiteValues(values: Array<number | null | undefined>): number[] {
  return values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function tierKey(row: WarRoomValueOverlayRow): string {
  return `${normalizePosition(row.position)}|${row.tier ?? "none"}`;
}

function earlySpecialTeamsPenalty(position: string, currentRound: number | null): number {
  if (position === "K" && !isLateRound(currentRound)) return isEarlyRound(currentRound) ? -24 : -12;
  if (position === "DEF" && !isLateRound(currentRound)) return isEarlyRound(currentRound) ? -24 : -12;
  return 0;
}

function isEarlyRound(round: number | null): boolean {
  return round === null || round <= 8;
}

function isLateRound(round: number | null): boolean {
  return round !== null && round >= 13;
}

function needWeight(level: unknown): number {
  if (level === "urgent") return 5;
  if (level === "high") return 4;
  if (level === "moderate") return 3;
  if (level === "low") return 2;
  if (level === "filled") return 1;
  return 0;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function unknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizePosition(position: string | null | undefined): string {
  const normalized = (position ?? "").trim().toUpperCase();
  if (normalized === "DST" || normalized === "D/ST") return "DEF";
  return normalized;
}

function sortRecommendationRows(a: WarRoomRecommendationRow, b: WarRoomRecommendationRow): number {
  const statusDelta = statusWeight(b.status) - statusWeight(a.status);
  if (statusDelta) return statusDelta;
  if (b.recommendationScore !== a.recommendationScore) return b.recommendationScore - a.recommendationScore;
  return (a.h10.tier ?? 999) - (b.h10.tier ?? 999) || (a.displayName ?? "").localeCompare(b.displayName ?? "");
}

function statusWeight(status: WarRoomRecommendationStatus): number {
  if (status === "recommendable") return 5;
  if (status === "watch_only") return 4;
  if (status === "insufficient_context") return 3;
  if (status === "missing_projection") return 2;
  if (status === "format_excluded") return 1;
  return 0;
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value || "UNK"] = (counts[value || "UNK"] ?? 0) + 1;
    return counts;
  }, {});
}

function buildIdpDiagnostics(rows: WarRoomRecommendationRow[]) {
  const idpRows = rows.filter((row) => IDP_POSITIONS.has(normalizePosition(row.position)));
  return {
    idpRowsEvaluated: idpRows.length,
    idpRowsByTier: countBy(idpRows.map((row) => row.recommendationTier)),
    idpAverageScoreComponents: averageScoreComponents(idpRows),
    idpTopLeagueValueRows: topIdpRows(idpRows, (row) => row.scoreComponents.leagueValue),
    idpTopRosterNeedRows: topIdpRows(idpRows, (row) => row.scoreComponents.rosterNeed),
    idpTopTierCliffRows: topIdpRows(idpRows, (row) => row.scoreComponents.tierCliff),
    idpSuppressionReasons: countBy(
      idpRows.flatMap((row) => [
        ...row.warningCodes.filter((code) => code === "LOW_PROJECTION_CONFIDENCE" || code === "MARKET_NOT_IMPLEMENTED" || code === "H10_VALUE_OVERLAY_MISSING_PROJECTION"),
        ...(row.status === "missing_projection" ? ["MISSING_PROJECTION"] : []),
        ...(row.recommendationTier === "avoid_for_now" ? ["SCORE_BELOW_WATCHLIST"] : []),
      ])
    ),
  };
}

function averageScoreComponents(rows: WarRoomRecommendationRow[]): WarRoomRecommendationRow["scoreComponents"] | null {
  if (!rows.length) return null;
  const totals = rows.reduce(
    (acc, row) => ({
      leagueValue: acc.leagueValue + row.scoreComponents.leagueValue,
      rosterNeed: acc.rosterNeed + row.scoreComponents.rosterNeed,
      scarcity: acc.scarcity + row.scoreComponents.scarcity,
      tierCliff: acc.tierCliff + row.scoreComponents.tierCliff,
      marketValue: acc.marketValue + row.scoreComponents.marketValue,
      availabilityRisk: acc.availabilityRisk + row.scoreComponents.availabilityRisk,
      confidencePenalty: acc.confidencePenalty + row.scoreComponents.confidencePenalty,
      formatPenalty: acc.formatPenalty + row.scoreComponents.formatPenalty,
    }),
    { leagueValue: 0, rosterNeed: 0, scarcity: 0, tierCliff: 0, marketValue: 0, availabilityRisk: 0, confidencePenalty: 0, formatPenalty: 0 }
  );
  return {
    leagueValue: round(totals.leagueValue / rows.length),
    rosterNeed: round(totals.rosterNeed / rows.length),
    scarcity: round(totals.scarcity / rows.length),
    tierCliff: round(totals.tierCliff / rows.length),
    marketValue: round(totals.marketValue / rows.length),
    availabilityRisk: round(totals.availabilityRisk / rows.length),
    confidencePenalty: round(totals.confidencePenalty / rows.length),
    formatPenalty: round(totals.formatPenalty / rows.length),
  };
}

function topIdpRows(rows: WarRoomRecommendationRow[], scoreFor: (row: WarRoomRecommendationRow) => number) {
  return [...rows]
    .sort((a, b) => scoreFor(b) - scoreFor(a) || b.recommendationScore - a.recommendationScore || a.displayName.localeCompare(b.displayName))
    .slice(0, 10)
    .map((row) => ({
      displayName: row.displayName,
      position: row.position,
      recommendationScore: row.recommendationScore,
      recommendationTier: row.recommendationTier,
      scoreComponents: row.scoreComponents,
      warningCodes: row.warningCodes,
    }));
}

function validateForbiddenFields(rows: WarRoomRecommendationRow[]): string[] {
  const keys = new Set(rows.flatMap((row) => Object.keys(row)));
  return FORBIDDEN_FIELDS.filter((field) => keys.has(field)).map((field) => `Forbidden output field emitted: ${field}`);
}

function validateExplanations(rows: WarRoomRecommendationRow[]): string[] {
  const failures: string[] = [];
  for (const row of rows) {
    const text = [row.primaryReason, ...row.explanationFragments].join(" ").toLowerCase();
    for (const banned of BANNED_EXPLANATION_TERMS) {
      if (text.includes(banned)) failures.push(`Banned explanation language emitted: ${banned}`);
    }
  }
  return Array.from(new Set(failures));
}

function formatSigned(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "unknown";
  return `${value >= 0 ? "+" : ""}${round(value)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
