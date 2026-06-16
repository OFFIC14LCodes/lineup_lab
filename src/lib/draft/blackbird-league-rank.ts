import {
  assignBlackbirdRanks,
  buildBlackbirdContextualValue,
  type BlackbirdContextualValue,
  type BlackbirdLeagueContext,
} from "@/lib/draft/blackbird-contextual-value";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";
import type { WarRoomRecommendationRow } from "@/lib/draft/war-room-recommendations";
import { buildReplacementValueModel, type PlayerPAR } from "@/lib/draft/replacement-value";
import { classifyPlayerRole, type PlayerRoleClassification } from "@/lib/projections/player-role-classification";
import { buildProjectionTrust, type ProjectionTrust } from "@/lib/projections/projection-trust";

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
  projectionTrust: ProjectionTrust;
  roleClassification: PlayerRoleClassification;
  replacementValue: PlayerPAR;
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
  roleClassifiedRows: number;
  replacementBaselinePositions: number;
  playersWithRoleAwarePAR: number;
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
          value: peer.overlay?.riskAdjustedValue ?? peer.recommendation?.recommendationScore ?? null,
        })),
    })
  ));
  const contextualByKey = new Map(contextualValues.map((value) => [rankKey(value.playerId, value.playerName), value]));
  const unrankedRows = baseRows
    .map((row): BlackbirdLeagueRankRow => {
      const playerId = row.player.matched_player_id ?? row.player.sleeper_player_id ?? row.overlay?.entityId ?? row.recommendation?.entityId ?? "";
      const playerName = row.player.player_name ?? row.overlay?.displayName ?? row.recommendation?.displayName ?? "Unknown";
      const contextual =
        contextualByKey.get(rankKey(playerId, playerName)) ??
        contextualByKey.get(rankKey(row.player.sleeper_player_id, playerName)) ??
        contextualByKey.get(rankKey(row.overlay?.entityId, playerName)) ??
        contextualByKey.get(rankKey(null, playerName));
      if (!contextual) throw new Error(`Missing contextual value for ${playerName}`);
      const unit = projectionUnit(row.player, row.overlay, contextual);
      const version = inferProjectionVersion(row.overlay, contextual);
      const projectionTrust = buildProjectionTrust({
        playerId,
        playerName,
        position: row.player.position ?? row.overlay?.position ?? row.recommendation?.position ?? "UNK",
        team: row.player.team ?? row.overlay?.team ?? row.recommendation?.team ?? null,
        projectionRunId: null,
        projectionVersion: version,
        projectionUnit: unit,
        projectionSource: contextual.projectedFantasyPoints.source,
        confidence: contextual.confidence,
        dataGaps: contextual.dataGaps,
        floorPoints: contextual.projectedFantasyPoints.low,
        medianPoints: contextual.projectedFantasyPoints.median,
        ceilingPoints: contextual.projectedFantasyPoints.high,
        isFallback: row.player.is_fallback || unit === "fallback",
        matchStatus: row.player.match_status,
      });
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
          unit,
          source: contextual.projectedFantasyPoints.source,
          scoringAware: contextual.projectedFantasyPoints.scoringAware,
        },
        projectionTrust,
        roleClassification: emptyRoleClassification(playerId, playerName, normalizePosition(row.player.position ?? row.overlay?.position ?? row.recommendation?.position ?? "UNK"), row.player.team ?? row.overlay?.team ?? row.recommendation?.team ?? null),
        replacementValue: emptyReplacementValue(playerId, normalizePosition(row.player.position ?? row.overlay?.position ?? row.recommendation?.position ?? "UNK")),
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
          projectionVersion: version,
          fallbackProjection: row.player.is_fallback || contextual.projectedFantasyPoints.source === "uploaded_ranking_projection",
        },
      };
    })
    .sort((a, b) => a.blackbirdRank - b.blackbirdRank);
  const baseByPlayerId = new Map(baseRows.map((base) => [playerIdFor(base.player, base.overlay, base.recommendation), base]));
  const roleByPlayerId = new Map(unrankedRows.map((row) => {
    const base = baseByPlayerId.get(row.playerId);
    return [
      row.playerId,
      classifyPlayerRole({
        playerId: row.playerId,
        playerName: row.playerName,
        position: row.position,
        team: row.team,
        age: finiteNumber(base?.player.age),
        yearsExperience: finiteNumber(base?.player.yearsExperience) ?? finiteNumber(base?.player.years_exp),
        medianProjection: row.projectedFantasyPoints.median,
        projectionTrustLabel: row.projectionTrust.trustLabel,
        projectionUnit: row.projectedFantasyPoints.unit,
        isFallback: row.source.fallbackProjection,
        matchStatus: base?.player.match_status,
        sameTeamPositionPeers: unrankedRows
          .filter((peer) => peer.playerId !== row.playerId && peer.team === row.team && peer.position === row.position)
          .map((peer) => ({
            playerId: peer.playerId,
            medianProjection: peer.projectedFantasyPoints.median,
            projectionTrustLabel: peer.projectionTrust.trustLabel,
            isFallback: peer.source.fallbackProjection,
          })),
      }),
    ] as const;
  }));
  const replacementModel = buildReplacementValueModel({
    players: unrankedRows.map((row) => ({
      playerId: row.playerId,
      playerName: row.playerName,
      position: row.position,
      medianPoints: row.projectedFantasyPoints.median,
      drafted: row.drafted,
      projectionTrustLabel: row.projectionTrust.trustLabel,
      roleClassification: roleByPlayerId.get(row.playerId) ?? emptyRoleClassification(row.playerId, row.playerName, row.position, row.team),
    })),
    leagueContext: input.leagueContext,
  });
  const replacementByPlayerId = new Map(replacementModel.playerPar.map((row) => [row.playerId, row]));
  const adjustedRows = unrankedRows.map((row) => {
    const roleClassification = roleByPlayerId.get(row.playerId) ?? row.roleClassification;
    const replacementValue = replacementByPlayerId.get(row.playerId) ?? row.replacementValue;
    const pointsAboveReplacement = replacementValue.pointsAboveReplacement ?? row.pointsAboveReplacement;
    const leagueValueScore = adjustedLeagueValueScore(row, replacementValue, roleClassification);
    return {
      ...row,
      roleClassification,
      replacementValue,
      pointsAboveReplacement,
      leagueValueScore,
      valueComponents: {
        ...row.valueComponents,
        positionScarcity: replacementValue.parPercentileByPosition ?? row.valueComponents.positionScarcity,
        depthChartRole: roleComponentScore(roleClassification.role),
      },
      reasons: Array.from(new Set([...row.reasons, ...roleClassification.reasons, ...replacementValue.reasons])).slice(0, 8),
      dataGaps: Array.from(new Set([...row.dataGaps, ...roleClassification.dataGaps, ...replacementValue.dataGaps])).sort(),
    };
  });
  const tiers = buildAdjustedTiers(adjustedRows);
  const rows = adjustedRows
    .sort((a, b) => b.leagueValueScore - a.leagueValueScore || (b.projectedFantasyPoints.median ?? -Infinity) - (a.projectedFantasyPoints.median ?? -Infinity) || a.playerName.localeCompare(b.playerName))
    .map((row, index) => ({
      ...row,
      blackbirdRank: index + 1,
      blackbirdTier: tiers.get(row.playerId) ?? row.blackbirdTier,
    }));
  return {
    rows,
    diagnostics: {
      totalPlayers: rows.length,
      draftedPlayersIncluded: rows.filter((row) => row.drafted).length,
      undraftedPlayersIncluded: rows.filter((row) => !row.drafted).length,
      projectionUnits: countProjectionUnits(rows),
      fallbackProjectionRows: rows.filter((row) => row.source.fallbackProjection).length,
      roleClassifiedRows: rows.filter((row) => row.roleClassification.role !== "unknown").length,
      replacementBaselinePositions: replacementModel.baselines.length,
      playersWithRoleAwarePAR: rows.filter((row) => row.replacementValue.pointsAboveReplacement !== null).length,
      adpPrimarySignal: false,
      orderingMethod: "contextual league value + role-aware PAR -> projection -> name; ADP external reference only",
      bannedLanguageFound: findBannedLeagueRankLanguage(JSON.stringify(rows)),
    },
  };
}

function adjustedLeagueValueScore(row: BlackbirdLeagueRankRow, replacementValue: PlayerPAR, role: PlayerRoleClassification): number {
  const baseScore = row.leagueValueScore;
  const parScore = replacementValue.parPercentileByPosition ?? 50;
  const roleScore = roleComponentScore(role.role);
  const trustScore = row.projectionTrust.trustScore;
  const formatFit = (row.valueComponents.rosterFormatFit + row.valueComponents.leagueFormatFit) / 2;
  const fallbackPenalty = row.source.fallbackProjection ? -9 : 0;
  const missingProjectionPenalty = row.projectedFantasyPoints.median === null ? -24 : 0;
  const trustPenalty = row.projectionTrust.trustLabel === "very_low" ? -8 : row.projectionTrust.trustLabel === "low" ? -4 : 0;
  const rolePenalty = ["backup", "deep_reserve", "rookie_unknown", "unknown"].includes(role.role) ? -5 : role.role === "rotational" ? -1.5 : 0;
  const riskPenalty = row.risk === "high" ? -5 : row.risk === "medium" ? -2 : 0;
  const dataGapPenalty = -Math.min(7, Math.max(0, row.dataGaps.length - 3) * 0.8);
  const score =
    baseScore * 0.38 +
    parScore * 0.32 +
    roleScore * 0.1 +
    trustScore * 0.1 +
    formatFit * 0.07 +
    row.valueComponents.floorCeilingShape * 0.03 +
    fallbackPenalty +
    missingProjectionPenalty +
    trustPenalty +
    rolePenalty +
    riskPenalty +
    dataGapPenalty;
  return clamp(round2(score), 0, 100);
}

function roleComponentScore(role: PlayerRoleClassification["role"]): number {
  if (role === "locked_starter" || role === "team_unit") return 82;
  if (role === "probable_starter") return 76;
  if (role === "committee") return 62;
  if (role === "rotational") return 52;
  if (role === "backup") return 34;
  if (role === "deep_reserve") return 20;
  if (role === "rookie_unknown") return 38;
  return 45;
}

function buildAdjustedTiers(rows: BlackbirdLeagueRankRow[]): Map<string, number> {
  const tiers = new Map<string, number>();
  let tier = 1;
  let previous: number | null = null;
  for (const row of [...rows].sort((a, b) => b.leagueValueScore - a.leagueValueScore || a.playerName.localeCompare(b.playerName))) {
    if (previous !== null && previous - row.leagueValueScore >= 4) tier += 1;
    tiers.set(row.playerId, tier);
    previous = row.leagueValueScore;
  }
  return tiers;
}

function emptyRoleClassification(playerId: string, playerName: string, position: string, team: string | null): PlayerRoleClassification {
  return {
    playerId,
    playerName,
    position,
    team,
    role: "unknown",
    confidence: "very_low",
    basis: ["insufficient_data"],
    teamPositionRankProxy: null,
    sameTeamPositionPeerCount: 1,
    projectedVolumeScore: null,
    reasons: [],
    dataGaps: ["role classification"],
  };
}

function emptyReplacementValue(playerId: string, position: string): PlayerPAR {
  return {
    playerId,
    position,
    medianPoints: null,
    replacementMedianPoints: null,
    pointsAboveReplacement: null,
    parPercentileByPosition: null,
    replacementRank: null,
    replacementMethod: "unavailable",
    role: "unknown",
    roleConfidence: "very_low",
    reasons: [],
    dataGaps: ["replacement baseline"],
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

function playerIdFor(player: ScoredDraftTarget, overlay: WarRoomValueOverlayRow | null, recommendation: WarRoomRecommendationRow | null): string {
  return player.matched_player_id ?? player.sleeper_player_id ?? overlay?.entityId ?? recommendation?.entityId ?? "";
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
