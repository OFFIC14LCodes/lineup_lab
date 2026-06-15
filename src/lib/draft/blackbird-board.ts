import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";
import type { WarRoomRecommendationRow } from "@/lib/draft/war-room-recommendations";

export type BlackbirdBoardSortKey = "blackbird" | "adp" | "projection" | "value";

export type BlackbirdBoardRow = {
  blackbirdBoardRank: number;
  playerId: string | null;
  playerName: string;
  position: string | null;
  team: string | null;
  blackbirdValueScore: number | null;
  projectionPoints: number | null;
  pointsAboveReplacement: number | null;
  adp: number | null;
  marketRank: number | null;
  rankDelta: number | null;
  confidence: string;
  risk: string;
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
  };
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
}): { rows: BlackbirdBoardRow[]; diagnostics: BlackbirdBoardDiagnostics } {
  const drafted = new Set(input.draftedPlayerIds ?? []);
  const recommendationByKey = new Map((input.recommendations ?? []).map((row) => [boardKey(row.entityId, row.displayName), row]));
  const rows = input.players
    .map((player, originalIndex) => {
      const overlay = input.overlays?.[originalIndex] ?? null;
      const recommendation = findRecommendation(recommendationByKey, player, overlay);
      return buildRow({ player, overlay, recommendation, originalIndex, drafted });
    })
    .filter((row) => !row.drafted)
    .sort((a, b) => sortBoardRows(a, b, input.sortKey ?? "blackbird"))
    .map((row, index) => ({
      ...row,
      blackbirdBoardRank: index + 1,
      rankDelta: row.marketRank === null ? null : round(row.marketRank - (index + 1)),
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
      orderingMethod: "available players -> H10 recommendation/value rank -> projection/value score -> market/ADP value -> ADP/market rank -> projected points -> position/name",
      bannedLanguageFound: findBannedBoardLanguage(JSON.stringify(rows)),
    },
  };
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
}): Omit<BlackbirdBoardRow, "blackbirdBoardRank"> {
  const playerId = input.player.sleeper_player_id ?? input.player.matched_player_id ?? input.overlay?.entityId ?? input.recommendation?.entityId ?? null;
  const projectionPoints = input.overlay?.medianPoints ?? input.player.projected_points ?? input.recommendation?.h10.medianPoints ?? null;
  const pointsAboveReplacement = input.overlay?.pointsAboveReplacement ?? input.recommendation?.h10.pointsAboveReplacement ?? null;
  const blackbirdValueScore = input.recommendation?.recommendationScore ?? input.player.draftTargetScore ?? input.overlay?.riskAdjustedValue ?? null;
  const marketRank = deriveMarketRank(input.player, input.overlay, input.recommendation);
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
    pointsAboveReplacement: finiteNumber(pointsAboveReplacement),
    adp: finiteNumber(input.player.adp),
    marketRank,
    rankDelta: null,
    confidence: input.recommendation?.h10.confidenceLabel ?? input.overlay?.confidenceLabel ?? confidenceFromPlayer(input.player),
    risk: input.recommendation?.tierDropRisk ?? input.overlay?.riskLabel ?? riskFromWarnings(input.player.warnings),
    needTimingAction: input.recommendation?.needTimingAction ?? null,
    waitPlanTargetCount: input.recommendation?.waitPlanTargetCount ?? null,
    drafted,
    dataStatus: {
      projection: projectionPoints === null || projectionPoints === undefined ? "unavailable" : "available",
      adp: input.player.adp === null || input.player.adp === undefined ? "unavailable" : "available",
      marketRank: marketRank === null ? "unavailable" : "available",
      h10: input.recommendation || (input.overlay && input.overlay.overlayStatus !== "missing_projection") ? "available" : "unavailable",
      ordering: input.recommendation
        ? "blackbird"
        : projectionPoints !== null || input.player.draftTargetScore !== null || input.player.adp !== null
          ? "projection_market"
          : "fallback_context",
    },
    source: {
      h10RecommendationRank: input.recommendation?.recommendationRank ?? null,
      h10RecommendationScore: input.recommendation?.recommendationScore ?? null,
      draftTargetScore: input.player.draftTargetScore ?? null,
      originalIndex: input.originalIndex,
    },
  };
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
  if (sortKey === "adp") return ascNullable(a.adp, b.adp) || sortBoardRows(a, b, "blackbird");
  if (sortKey === "projection") return descNullable(a.projectionPoints, b.projectionPoints) || sortBoardRows(a, b, "blackbird");
  if (sortKey === "value") return descNullable(a.blackbirdValueScore, b.blackbirdValueScore) || sortBoardRows(a, b, "blackbird");

  return (
    ascNullable(a.source.h10RecommendationRank, b.source.h10RecommendationRank) ||
    descNullable(a.blackbirdValueScore, b.blackbirdValueScore) ||
    descNullable(a.pointsAboveReplacement, b.pointsAboveReplacement) ||
    ascNullable(a.marketRank, b.marketRank) ||
    ascNullable(a.adp, b.adp) ||
    descNullable(a.projectionPoints, b.projectionPoints) ||
    positionWeight(a.position) - positionWeight(b.position) ||
    a.playerName.localeCompare(b.playerName)
  );
}

function deriveMarketRank(
  player: ScoredDraftTarget,
  overlay: WarRoomValueOverlayRow | null,
  recommendation: WarRoomRecommendationRow | null
): number | null {
  if (player.adp !== null && player.adp !== undefined && Number.isFinite(player.adp)) return player.adp;
  const delta = overlay?.marketRankDelta ?? null;
  if (delta !== null && recommendation?.recommendationRank) return recommendation.recommendationRank + delta;
  return null;
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

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
