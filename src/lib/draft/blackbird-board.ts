import {
  assignBlackbirdRanks,
  buildBlackbirdContextualValue,
  type BlackbirdContextualValue,
  type BlackbirdLeagueContext,
} from "@/lib/draft/blackbird-contextual-value";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";
import type { WarRoomRecommendationRow } from "@/lib/draft/war-room-recommendations";

export type BlackbirdBoardSortKey = "blackbird" | "projection" | "value";

export type BlackbirdBoardRow = {
  blackbirdBoardRank: number;
  playerId: string | null;
  playerName: string;
  position: string | null;
  team: string | null;
  blackbirdValueScore: number | null;
  projectionPoints: number | null;
  projectionLow: number | null;
  projectionHigh: number | null;
  pointsAboveReplacement: number | null;
  adp: number | null;
  marketRank: number | null;
  rankDelta: number | null;
  confidence: string;
  risk: string;
  blackbirdTier: number | null;
  valueScoreComponents: BlackbirdContextualValue["valueScoreComponents"] | null;
  contextualReasons: string[];
  contextualDataGaps: string[];
  needTimingAction: string | null;
  waitPlanTargetCount: number | null;
  drafted: boolean;
  dataStatus: {
    projection: "available" | "unavailable";
    adp: "available" | "unavailable";
    marketRank: "available" | "unavailable";
    h10: "available" | "unavailable";
    ordering: "blackbird" | "projection_market" | "fallback_context";
  };
  source: {
    h10RecommendationRank: number | null;
    h10RecommendationScore: number | null;
    draftTargetScore: number | null;
    originalIndex: number;
    player: ScoredDraftTarget & { age?: number | null; years_exp?: number | null; yearsExperience?: number | null };
    overlay: WarRoomValueOverlayRow | null;
    recommendation: WarRoomRecommendationRow | null;
  };
  playerDetailContext?: BlackbirdBoardPlayerDetailContext;
};

export type BlackbirdBoardPlayerDetailContext = {
  playerId: string | null;
  playerName: string;
  position: string | null;
  team: string | null;
  blackbirdRank: number;
  projection: number | null;
  par: number | null;
  adp: number | null;
  marketRank: number | null;
  rankDelta: number | null;
  valueScore: number | null;
  valueScoreComponents: BlackbirdContextualValue["valueScoreComponents"] | null;
  projectedFantasyPoints: BlackbirdContextualValue["projectedFantasyPoints"];
  blackbirdTier: number | null;
  timingAction: string | null;
  confidence: string;
  risk: string;
  whyBlackbirdLikes: string[];
  whyBlackbirdIsCautious: string[];
  tierNeighborContext: {
    previous: Array<{ playerName: string; position: string | null; rank: number; valueScore: number | null }>;
    next: Array<{ playerName: string; position: string | null; rank: number; valueScore: number | null }>;
  };
  comparablePlayers: Array<{ playerName: string; position: string | null; rank: number; projection: number | null; valueScore: number | null }>;
  waitPlanContext: string[];
  contingencyContext: string[];
  dataGaps: string[];
};

export type BlackbirdBoardDiagnostics = {
  totalInputPlayers: number;
  availableRows: number;
  draftedRowsExcluded: number;
  h10RowsMatched: number;
  projectionRows: number;
  adpRows: number;
  marketRows: number;
  fallbackOrderedRows: number;
  orderingMethod: string;
  bannedLanguageFound: string[];
};

const BANNED_BOARD_TERMS = ["must draft", "guaranteed", "lock", "best pick", "you should draft", "final plan"] as const;

export function buildBlackbirdBoard(input: {
  players: ScoredDraftTarget[];
  overlays?: WarRoomValueOverlayRow[];
  recommendations?: WarRoomRecommendationRow[];
  draftedPlayerIds?: string[];
  sortKey?: BlackbirdBoardSortKey;
  leagueContext?: BlackbirdLeagueContext;
}): { rows: BlackbirdBoardRow[]; diagnostics: BlackbirdBoardDiagnostics } {
  const drafted = new Set(input.draftedPlayerIds ?? []);
  const recommendationByKey = new Map((input.recommendations ?? []).map((row) => [boardKey(row.entityId, row.displayName), row]));
  const overlayByKey = new Map((input.overlays ?? []).map((row) => [boardKey(row.entityId, row.displayName), row]));
  const rowsWithoutRanks = input.players
    .map((player, originalIndex) => {
      const overlay = findOverlay(overlayByKey, player);
      const recommendation = findRecommendation(recommendationByKey, player, overlay);
      return buildRow({ player, overlay, recommendation, originalIndex, drafted });
    })
    .filter((row) => !row.drafted);
  const contextualValues = assignBlackbirdRanks(rowsWithoutRanks.map((row) =>
    buildBlackbirdContextualValue({
      player: row.source.player,
      overlay: row.source.overlay,
      recommendation: row.source.recommendation,
      leagueContext: input.leagueContext,
      positionPeers: rowsWithoutRanks
        .filter((peer) => peer.position === row.position)
        .map((peer) => ({
          projection: peer.projectionPoints,
          floor: peer.projectionLow,
          ceiling: peer.projectionHigh,
          par: peer.pointsAboveReplacement,
          value: peer.blackbirdValueScore,
        })),
    })
  ));
  const contextualByPlayer = new Map(contextualValues.map((value) => [boardKey(value.playerId, value.playerName), value]));
  const rows = rowsWithoutRanks
    .map((row) => applyContextualValue(row, findContextualValue(contextualByPlayer, row)))
    .sort((a, b) => sortBoardRows(a, b, input.sortKey ?? "blackbird"))
    .map((row, index) => ({
      ...row,
      blackbirdBoardRank: index + 1,
      marketRank: index + 1,
      rankDelta: null,
      dataStatus: {
        ...row.dataStatus,
        marketRank: "available" as const,
      },
    }))
    .map((row, _index, sortedRows) => ({
      ...row,
      playerDetailContext: buildPlayerDetailContext(row, sortedRows),
    }));

  return {
    rows,
    diagnostics: {
      totalInputPlayers: input.players.length,
      availableRows: rows.length,
      draftedRowsExcluded: input.players.length - rows.length,
      h10RowsMatched: rows.filter((row) => row.dataStatus.h10 === "available").length,
      projectionRows: rows.filter((row) => row.dataStatus.projection === "available").length,
      adpRows: rows.filter((row) => row.dataStatus.adp === "available").length,
      marketRows: rows.filter((row) => row.dataStatus.marketRank === "available").length,
      fallbackOrderedRows: rows.filter((row) => row.dataStatus.ordering === "fallback_context").length,
      orderingMethod: "available players -> contextual Blackbird value -> PAR -> projected fantasy points -> H10 tie-breakers -> position/name",
      bannedLanguageFound: findBannedBoardLanguage(JSON.stringify(rows)),
    },
  };
}

function findContextualValue(
  contextualByPlayer: Map<string, BlackbirdContextualValue>,
  row: Omit<BlackbirdBoardRow, "blackbirdBoardRank" | "playerDetailContext">
): BlackbirdContextualValue | null {
  return (
    contextualByPlayer.get(boardKey(row.playerId, row.playerName)) ??
    contextualByPlayer.get(boardKey(row.source.player.matched_player_id, row.playerName)) ??
    contextualByPlayer.get(boardKey(row.source.player.sleeper_player_id, row.playerName)) ??
    contextualByPlayer.get(boardKey(row.source.overlay?.entityId ?? null, row.playerName)) ??
    contextualByPlayer.get(boardKey(null, row.playerName)) ??
    null
  );
}

export function buildPlayerDetailContext(
  row: Omit<BlackbirdBoardRow, "playerDetailContext">,
  boardRows: Array<Omit<BlackbirdBoardRow, "playerDetailContext">>
): BlackbirdBoardPlayerDetailContext {
  const samePosition = boardRows.filter((candidate) => candidate.position === row.position);
  const currentPositionIndex = samePosition.findIndex((candidate) => candidate.playerId === row.playerId && candidate.playerName === row.playerName);
  const previous = samePosition.slice(Math.max(0, currentPositionIndex - 2), Math.max(0, currentPositionIndex)).map(neighborSummary);
  const next = samePosition.slice(currentPositionIndex + 1, currentPositionIndex + 3).map(neighborSummary);
  const comparablePlayers = samePosition
    .filter((candidate) => candidate.playerId !== row.playerId || candidate.playerName !== row.playerName)
    .slice(Math.max(0, currentPositionIndex - 2), currentPositionIndex + 3)
    .slice(0, 4)
    .map((candidate) => ({
      playerName: candidate.playerName,
      position: candidate.position,
      rank: candidate.blackbirdBoardRank,
    projection: candidate.projectionPoints,
      valueScore: candidate.blackbirdValueScore,
    }));
  return {
    playerId: row.playerId,
    playerName: row.playerName,
    position: row.position,
    team: row.team,
    blackbirdRank: row.blackbirdBoardRank,
    projection: row.projectionPoints,
    par: row.pointsAboveReplacement,
    adp: row.adp,
    marketRank: row.marketRank,
    rankDelta: row.rankDelta,
    valueScore: row.blackbirdValueScore,
    valueScoreComponents: row.valueScoreComponents,
    projectedFantasyPoints: {
      low: row.projectionLow,
      median: row.projectionPoints,
      high: row.projectionHigh,
      source: row.contextualDataGaps.includes("projection median") ? "missing" : "blackbird_contextual_value",
      scoringAware: row.dataStatus.projection === "available",
    },
    blackbirdTier: row.blackbirdTier,
    timingAction: row.needTimingAction,
    confidence: row.confidence,
    risk: row.risk,
    whyBlackbirdLikes: whyLikes(row),
    whyBlackbirdIsCautious: whyCautious(row),
    tierNeighborContext: { previous, next },
    comparablePlayers,
    waitPlanContext: waitPlanContext(row),
    contingencyContext: contingencyContext(row),
    dataGaps: dataGaps(row),
  };
}

function neighborSummary(row: Omit<BlackbirdBoardRow, "playerDetailContext">) {
  return {
    playerName: row.playerName,
    position: row.position,
    rank: row.blackbirdBoardRank,
    valueScore: row.blackbirdValueScore,
  };
}

function whyLikes(row: Omit<BlackbirdBoardRow, "playerDetailContext">): string[] {
  const reasons: string[] = [];
  if (row.source.h10RecommendationRank !== null) reasons.push(`Blackbird preview rank ${row.source.h10RecommendationRank} is available.`);
  if (row.blackbirdValueScore !== null) reasons.push(`Contextual value score ${row.blackbirdValueScore.toFixed(2)} is part of the board signal.`);
  if (row.projectionPoints !== null) reasons.push(`Projection signal is ${row.projectionPoints.toFixed(1)} points.`);
  if (row.pointsAboveReplacement !== null) reasons.push(`PAR signal is ${row.pointsAboveReplacement.toFixed(1)}.`);
  if (row.marketRank !== null) reasons.push(`Blackbird draft rank is ${row.marketRank}.`);
  if (row.needTimingAction === "fill_now" || row.needTimingAction === "monitor") reasons.push(`Timing action is ${row.needTimingAction.replace(/_/g, " ")}.`);
  return [...reasons, ...row.contextualReasons].length ? [...reasons, ...row.contextualReasons] : ["Board placement is driven by available deterministic ranking signals."];
}

function whyCautious(row: Omit<BlackbirdBoardRow, "playerDetailContext">): string[] {
  const cautions: string[] = [];
  if (row.risk !== "low") cautions.push(`Risk label is ${row.risk}.`);
  if (row.confidence === "low" || row.confidence === "limited" || row.confidence === "medium-low") cautions.push(`Confidence is ${row.confidence}.`);
  if (row.dataStatus.projection === "unavailable") cautions.push("Projection data is unavailable.");
  if (row.dataStatus.h10 === "unavailable") cautions.push("H10 timing and value context is unavailable.");
  return cautions.length ? cautions : ["No major deterministic caution flag is present."];
}

function waitPlanContext(row: Omit<BlackbirdBoardRow, "playerDetailContext">): string[] {
  const context: string[] = [];
  if (row.waitPlanTargetCount && row.waitPlanTargetCount > 0) context.push(`${row.waitPlanTargetCount} wait-plan target${row.waitPlanTargetCount === 1 ? "" : "s"} reference this profile.`);
  if (row.needTimingAction?.startsWith("wait")) context.push(`Timing action supports waiting: ${row.needTimingAction.replace(/_/g, " ")}.`);
  if (!context.length) context.push("No explicit wait-plan target context is attached.");
  return context;
}

function contingencyContext(row: Omit<BlackbirdBoardRow, "playerDetailContext">): string[] {
  const position = row.position ?? "position";
  if (row.needTimingAction === "fill_now") return [`Passing on this ${position} can increase near-term fill pressure.`];
  if (row.needTimingAction === "monitor") return [`Monitor this ${position} against tier neighbors and market delta.`];
  if (row.needTimingAction?.startsWith("wait")) return [`This ${position} can remain in a wait-path if comparable players stay available.`];
  if (row.position === "K" || row.position === "DEF") return [`${position} is generally a late fill path unless scoring context changes the signal.`];
  return [`Use comparable ${position} alternatives if this profile is drafted before the next pick.`];
}

function dataGaps(row: Omit<BlackbirdBoardRow, "playerDetailContext">): string[] {
  const gaps: string[] = [];
  if (row.dataStatus.projection === "unavailable") gaps.push("projection");
  if (row.dataStatus.marketRank === "unavailable") gaps.push("market rank");
  if (row.dataStatus.h10 === "unavailable") gaps.push("H10 context");
  gaps.push(...row.contextualDataGaps);
  return gaps.length ? gaps : ["none"];
}

export function findBannedBoardLanguage(text: string): string[] {
  const normalized = sanitizeProperNouns(text).toLowerCase();
  return BANNED_BOARD_TERMS.filter((phrase) => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\W)${escaped}(\\W|$)`, "i").test(normalized);
  });
}

function sanitizeProperNouns(text: string): string {
  return text.replace(/\bDrew Lock\b/g, "Drew L.");
}

function buildRow(input: {
  player: ScoredDraftTarget;
  overlay: WarRoomValueOverlayRow | null;
  recommendation: WarRoomRecommendationRow | null;
  originalIndex: number;
  drafted: Set<string>;
}): Omit<BlackbirdBoardRow, "blackbirdBoardRank" | "playerDetailContext"> {
  const playerId = input.player.sleeper_player_id ?? input.player.matched_player_id ?? input.overlay?.entityId ?? input.recommendation?.entityId ?? null;
  const projectionPoints = input.overlay?.medianPoints ?? input.player.projected_points ?? input.recommendation?.h10.medianPoints ?? null;
  const projectionLow = input.overlay?.floorPoints ?? null;
  const projectionHigh = input.overlay?.ceilingPoints ?? null;
  const pointsAboveReplacement = input.overlay?.pointsAboveReplacement ?? input.recommendation?.h10.pointsAboveReplacement ?? null;
  const blackbirdValueScore = input.recommendation?.recommendationScore ?? input.player.draftTargetScore ?? input.overlay?.riskAdjustedValue ?? null;
  const drafted = Boolean(
    (input.player.sleeper_player_id && input.drafted.has(input.player.sleeper_player_id)) ||
      (input.player.matched_player_id && input.drafted.has(input.player.matched_player_id)) ||
      (input.overlay?.entityId && input.drafted.has(input.overlay.entityId)) ||
      (input.recommendation?.entityId && input.drafted.has(input.recommendation.entityId))
  );

  return {
    playerId,
    playerName: input.player.player_name ?? input.overlay?.displayName ?? input.recommendation?.displayName ?? "Unknown",
    position: normalizePosition(input.player.position ?? input.overlay?.position ?? input.recommendation?.position ?? null),
    team: input.player.team ?? input.overlay?.team ?? input.recommendation?.team ?? null,
    blackbirdValueScore: finiteNumber(blackbirdValueScore),
    projectionPoints: finiteNumber(projectionPoints),
    projectionLow: finiteNumber(projectionLow),
    projectionHigh: finiteNumber(projectionHigh),
    pointsAboveReplacement: finiteNumber(pointsAboveReplacement),
    adp: finiteNumber(input.player.adp),
    marketRank: null,
    rankDelta: null,
    confidence: input.recommendation?.h10.confidenceLabel ?? input.overlay?.confidenceLabel ?? confidenceFromPlayer(input.player),
    risk: input.recommendation?.tierDropRisk ?? input.overlay?.riskLabel ?? riskFromWarnings(input.player.warnings),
    blackbirdTier: null,
    valueScoreComponents: null,
    contextualReasons: [],
    contextualDataGaps: [],
    needTimingAction: input.recommendation?.needTimingAction ?? null,
    waitPlanTargetCount: input.recommendation?.waitPlanTargetCount ?? null,
    drafted,
    dataStatus: {
      projection: projectionPoints === null || projectionPoints === undefined ? "unavailable" : "available",
      adp: input.player.adp === null || input.player.adp === undefined ? "unavailable" : "available",
      marketRank: "unavailable",
      h10: input.recommendation || (input.overlay && input.overlay.overlayStatus !== "missing_projection") ? "available" : "unavailable",
      ordering: input.recommendation
        ? "blackbird"
        : projectionPoints !== null || input.player.draftTargetScore !== null
          ? "projection_market"
          : "fallback_context",
    },
    source: {
      h10RecommendationRank: input.recommendation?.recommendationRank ?? null,
      h10RecommendationScore: input.recommendation?.recommendationScore ?? null,
      draftTargetScore: input.player.draftTargetScore ?? null,
      originalIndex: input.originalIndex,
      player: input.player,
      overlay: input.overlay,
      recommendation: input.recommendation,
    },
  };
}

function applyContextualValue(
  row: Omit<BlackbirdBoardRow, "blackbirdBoardRank" | "playerDetailContext">,
  contextual: BlackbirdContextualValue | null
): Omit<BlackbirdBoardRow, "blackbirdBoardRank" | "playerDetailContext"> {
  if (!contextual) return row;
  return {
    ...row,
    blackbirdValueScore: contextual.valueScore,
    projectionPoints: contextual.projectedFantasyPoints.median,
    projectionLow: contextual.projectedFantasyPoints.low,
    projectionHigh: contextual.projectedFantasyPoints.high,
    confidence: contextual.confidence,
    risk: contextual.risk,
    blackbirdTier: contextual.blackbirdTier,
    valueScoreComponents: contextual.valueScoreComponents,
    contextualReasons: contextual.reasons,
    contextualDataGaps: contextual.dataGaps,
    dataStatus: {
      ...row.dataStatus,
      projection: contextual.projectedFantasyPoints.median === null ? "unavailable" : "available",
      h10: row.dataStatus.h10,
    },
  };
}

function findOverlay(
  overlayByKey: Map<string, WarRoomValueOverlayRow>,
  player: ScoredDraftTarget
): WarRoomValueOverlayRow | null {
  return (
    overlayByKey.get(boardKey(player.matched_player_id, player.player_name)) ??
    overlayByKey.get(boardKey(player.sleeper_player_id, player.player_name)) ??
    overlayByKey.get(boardKey(null, player.player_name)) ??
    null
  );
}

function findRecommendation(
  recommendationByKey: Map<string, WarRoomRecommendationRow>,
  player: ScoredDraftTarget,
  overlay: WarRoomValueOverlayRow | null
): WarRoomRecommendationRow | null {
  return (
    recommendationByKey.get(boardKey(player.matched_player_id, player.player_name)) ??
    recommendationByKey.get(boardKey(player.sleeper_player_id, player.player_name)) ??
    recommendationByKey.get(boardKey(overlay?.entityId ?? null, overlay?.displayName ?? player.player_name)) ??
    recommendationByKey.get(boardKey(null, player.player_name)) ??
    null
  );
}

function sortBoardRows(a: Omit<BlackbirdBoardRow, "blackbirdBoardRank">, b: Omit<BlackbirdBoardRow, "blackbirdBoardRank">, sortKey: BlackbirdBoardSortKey): number {
  if (sortKey === "projection") return descNullable(a.projectionPoints, b.projectionPoints) || sortBoardRows(a, b, "blackbird");
  if (sortKey === "value") return descNullable(a.blackbirdValueScore, b.blackbirdValueScore) || sortBoardRows(a, b, "blackbird");

  return (
    descNullable(a.blackbirdValueScore, b.blackbirdValueScore) ||
    descNullable(a.pointsAboveReplacement, b.pointsAboveReplacement) ||
    descNullable(a.projectionPoints, b.projectionPoints) ||
    ascNullable(a.source.h10RecommendationRank, b.source.h10RecommendationRank) ||
    descNullable(a.source.h10RecommendationScore, b.source.h10RecommendationScore) ||
    positionWeight(a.position) - positionWeight(b.position) ||
    a.playerName.localeCompare(b.playerName)
  );
}

function boardKey(id: string | null | undefined, name: string | null | undefined): string {
  return `${id ?? ""}|${(name ?? "").trim().toLowerCase()}`;
}

function normalizePosition(position: string | null): string | null {
  if (!position) return null;
  const normalized = position.trim().toUpperCase();
  return normalized === "DST" || normalized === "D/ST" ? "DEF" : normalized;
}

function confidenceFromPlayer(player: ScoredDraftTarget): string {
  if (player.match_status === "ambiguous" || player.match_status === "unmatched") return "low";
  if (player.inputCompleteness === "full") return "medium";
  if (player.inputCompleteness === "partial") return "medium-low";
  return "limited";
}

function riskFromWarnings(warnings: string[]): string {
  if (warnings.some((warning) => warning.toLowerCase().includes("low-confidence"))) return "high";
  if (warnings.length) return "medium";
  return "low";
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function descNullable(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function ascNullable(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function positionWeight(position: string | null): number {
  const weights: Record<string, number> = { QB: 1, RB: 2, WR: 3, TE: 4, DL: 5, LB: 6, DB: 7, K: 8, DEF: 9 };
  return weights[position ?? ""] ?? 99;
}
