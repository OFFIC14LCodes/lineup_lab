import {
  assignBlackbirdRanks,
  buildBlackbirdContextualValue,
  type BlackbirdContextualValue,
  type BlackbirdLeagueContext,
} from "@/lib/draft/blackbird-contextual-value";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";
import type { WarRoomRecommendationRow } from "@/lib/draft/war-room-recommendations";

export type ProjectionUnit = "season" | "weekly" | "game" | "fallback" | "unknown";

export type BlackbirdLeagueRankRow = {
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
  drafted: boolean;
  blackbirdRank: number;
  blackbirdTier: number | null;
  leagueValueScore: number;
  projectedFantasyPoints: {
    floor: number | null;
    median: number | null;
    ceiling: number | null;
    unit: ProjectionUnit;
    source: string;
    scoringAware: boolean;
  };
  pointsAboveReplacement: number | null;
  valueComponents: BlackbirdContextualValue["valueScoreComponents"];
  confidence: BlackbirdContextualValue["confidence"];
  risk: BlackbirdContextualValue["risk"];
  reasons: string[];
  dataGaps: string[];
  source: {
    adp: number | null;
    externalMarketRank: number | null;
    h10RecommendationRank: number | null;
    projectionRunId: string | null;
    projectionVersion: string | null;
    fallbackProjection: boolean;
  };
};

export type BlackbirdLeagueRankDiagnostics = {
  totalPlayers: number;
  draftedPlayersIncluded: number;
  undraftedPlayersIncluded: number;
  projectionUnits: Record<ProjectionUnit, number>;
  fallbackProjectionRows: number;
  adpPrimarySignal: false;
  orderingMethod: string;
  bannedLanguageFound: string[];
};

export type BuildBlackbirdLeagueRankInput = {
  players: ScoredDraftTarget[];
  overlays?: WarRoomValueOverlayRow[];
  recommendations?: WarRoomRecommendationRow[];
  draftedPlayerIds?: string[];
  leagueContext?: BlackbirdLeagueContext;
};

const BANNED_TERMS = ["must draft", "guaranteed", "lock", "best pick", "you should draft", "final plan"] as const;

export function buildBlackbirdLeagueRank(input: BuildBlackbirdLeagueRankInput): {
  rows: BlackbirdLeagueRankRow[];
  diagnostics: BlackbirdLeagueRankDiagnostics;
} {
  const drafted = new Set(input.draftedPlayerIds ?? []);
  const overlayByKey = new Map((input.overlays ?? []).map((row) => [rankKey(row.entityId, row.displayName), row]));
  const recommendationByKey = new Map((input.recommendations ?? []).map((row) => [rankKey(row.entityId, row.displayName), row]));
  const baseRows = input.players.map((player) => {
    const overlay = findOverlay(overlayByKey, player);
    const recommendation = findRecommendation(recommendationByKey, player, overlay);
    return { player, overlay, recommendation };
  });
  const contextualValues = assignBlackbirdRanks(baseRows.map((row) =>
    buildBlackbirdContextualValue({
      player: row.player,
      overlay: row.overlay,
      recommendation: row.recommendation,
      leagueContext: input.leagueContext,
      positionPeers: baseRows
        .filter((peer) => normalizePosition(peer.player.position ?? peer.overlay?.position ?? peer.recommendation?.position ?? "UNK") === normalizePosition(row.player.position ?? row.overlay?.position ?? row.recommendation?.position ?? "UNK"))
        .map((peer) => ({
          projection: peer.overlay?.medianPoints ?? peer.player.projected_points ?? peer.recommendation?.h10.medianPoints ?? null,
          floor: peer.overlay?.floorPoints ?? null,
          ceiling: peer.overlay?.ceilingPoints ?? null,
          par: peer.overlay?.pointsAboveReplacement ?? peer.recommendation?.h10.pointsAboveReplacement ?? null,
          value: peer.recommendation?.recommendationScore ?? peer.player.draftTargetScore ?? peer.overlay?.riskAdjustedValue ?? null,
        })),
    })
  ));
  const contextualByKey = new Map(contextualValues.map((value) => [rankKey(value.playerId, value.playerName), value]));
  const rows = baseRows
    .map((row): BlackbirdLeagueRankRow => {
      const playerId = row.player.matched_player_id ?? row.player.sleeper_player_id ?? row.overlay?.entityId ?? row.recommendation?.entityId ?? "";
      const playerName = row.player.player_name ?? row.overlay?.displayName ?? row.recommendation?.displayName ?? "Unknown";
      const contextual =
        contextualByKey.get(rankKey(playerId, playerName)) ??
        contextualByKey.get(rankKey(row.player.sleeper_player_id, playerName)) ??
        contextualByKey.get(rankKey(row.overlay?.entityId, playerName)) ??
        contextualByKey.get(rankKey(null, playerName));
      if (!contextual) throw new Error(`Missing contextual value for ${playerName}`);
      return {
        playerId,
        playerName,
        position: normalizePosition(row.player.position ?? row.overlay?.position ?? row.recommendation?.position ?? "UNK"),
        team: row.player.team ?? row.overlay?.team ?? row.recommendation?.team ?? null,
        drafted: isDrafted(playerId, row.player, row.overlay, row.recommendation, drafted),
        blackbirdRank: contextual.blackbirdRank ?? 999999,
        blackbirdTier: contextual.blackbirdTier,
        leagueValueScore: contextual.valueScore,
        projectedFantasyPoints: {
          floor: contextual.projectedFantasyPoints.low,
          median: contextual.projectedFantasyPoints.median,
          ceiling: contextual.projectedFantasyPoints.high,
          unit: projectionUnit(row.player, row.overlay, contextual),
          source: contextual.projectedFantasyPoints.source,
          scoringAware: contextual.projectedFantasyPoints.scoringAware,
        },
        pointsAboveReplacement: row.overlay?.pointsAboveReplacement ?? row.recommendation?.h10.pointsAboveReplacement ?? null,
        valueComponents: contextual.valueScoreComponents,
        confidence: contextual.confidence,
        risk: contextual.risk,
        reasons: contextual.reasons,
        dataGaps: contextual.dataGaps,
        source: {
          adp: finiteNumber(row.player.adp),
          externalMarketRank: finiteNumber(row.player.rank),
          h10RecommendationRank: row.recommendation?.recommendationRank ?? null,
          projectionRunId: null,
          projectionVersion: inferProjectionVersion(row.overlay, contextual),
          fallbackProjection: row.player.is_fallback || contextual.projectedFantasyPoints.source === "uploaded_ranking_projection",
        },
      };
    })
    .sort((a, b) => a.blackbirdRank - b.blackbirdRank);
  return {
    rows,
    diagnostics: {
      totalPlayers: rows.length,
      draftedPlayersIncluded: rows.filter((row) => row.drafted).length,
      undraftedPlayersIncluded: rows.filter((row) => !row.drafted).length,
      projectionUnits: countProjectionUnits(rows),
      fallbackProjectionRows: rows.filter((row) => row.source.fallbackProjection).length,
      adpPrimarySignal: false,
      orderingMethod: "contextual league value -> projection -> name; ADP external reference only",
      bannedLanguageFound: findBannedLeagueRankLanguage(JSON.stringify(rows)),
    },
  };
}

export function findBannedLeagueRankLanguage(text: string): string[] {
  const normalized = text.replace(/\bDrew Lock\b/g, "Drew L.").toLowerCase();
  return BANNED_TERMS.filter((phrase) => new RegExp(`(^|\\W)${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\W|$)`, "i").test(normalized));
}

function projectionUnit(player: ScoredDraftTarget, overlay: WarRoomValueOverlayRow | null, contextual: BlackbirdContextualValue): ProjectionUnit {
  if (contextual.projectedFantasyPoints.median === null) return "unknown";
  if (overlay?.medianPoints !== null && overlay?.medianPoints !== undefined) return "season";
  if (player.projected_points !== null && player.projected_points !== undefined) return player.is_fallback ? "fallback" : "season";
  return "unknown";
}

function inferProjectionVersion(overlay: WarRoomValueOverlayRow | null, contextual: BlackbirdContextualValue): string | null {
  if (!contextual.projectedFantasyPoints.scoringAware) return null;
  if (overlay?.reasonCodes.some((code) => code.toLowerCase().includes("idp"))) return "idp_k_dst_v3_or_later";
  return "h10_league_value";
}

function countProjectionUnits(rows: BlackbirdLeagueRankRow[]): Record<ProjectionUnit, number> {
  return rows.reduce<Record<ProjectionUnit, number>>((counts, row) => {
    counts[row.projectedFantasyPoints.unit] += 1;
    return counts;
  }, { season: 0, weekly: 0, game: 0, fallback: 0, unknown: 0 });
}

function findOverlay(overlayByKey: Map<string, WarRoomValueOverlayRow>, player: ScoredDraftTarget): WarRoomValueOverlayRow | null {
  return overlayByKey.get(rankKey(player.matched_player_id, player.player_name)) ?? overlayByKey.get(rankKey(player.sleeper_player_id, player.player_name)) ?? overlayByKey.get(rankKey(null, player.player_name)) ?? null;
}

function findRecommendation(recommendationByKey: Map<string, WarRoomRecommendationRow>, player: ScoredDraftTarget, overlay: WarRoomValueOverlayRow | null): WarRoomRecommendationRow | null {
  return recommendationByKey.get(rankKey(player.matched_player_id, player.player_name)) ?? recommendationByKey.get(rankKey(player.sleeper_player_id, player.player_name)) ?? recommendationByKey.get(rankKey(overlay?.entityId, overlay?.displayName ?? player.player_name)) ?? recommendationByKey.get(rankKey(null, player.player_name)) ?? null;
}

function isDrafted(playerId: string, player: ScoredDraftTarget, overlay: WarRoomValueOverlayRow | null, recommendation: WarRoomRecommendationRow | null, drafted: Set<string>): boolean {
  return Boolean(playerId && drafted.has(playerId)) || Boolean(player.sleeper_player_id && drafted.has(player.sleeper_player_id)) || Boolean(player.matched_player_id && drafted.has(player.matched_player_id)) || Boolean(overlay?.entityId && drafted.has(overlay.entityId)) || Boolean(recommendation?.entityId && drafted.has(recommendation.entityId));
}

function rankKey(id: string | null | undefined, name: string | null | undefined): string {
  return `${id ?? ""}|${(name ?? "").trim().toLowerCase()}`;
}

function normalizePosition(position: string): string {
  const normalized = position.trim().toUpperCase();
  return normalized === "DST" || normalized === "D/ST" ? "DEF" : normalized;
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
