import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { BlackbirdBoardRow } from "./blackbird-board";
import type {
  MarketAnchorBoardPreviewDiagnostics,
  MarketAnchorBoardPreviewResult,
  MarketAnchorBoardPreviewRow,
} from "./market-anchor-board-preview-types";
import { filterDraftablePlayers } from "./player-draftability";

type EnrichedUniverseArtifact = {
  rows?: EnrichedMarketPlayer[];
};

type ReviewArtifact = {
  recommendation?: string;
  matchQualityAudit?: {
    exactIdMatches: number;
    nameTeamPositionMatches: number;
    uniqueNamePositionMatches: number;
    reviewCandidates: number;
    unmatchedAdpRows: number;
    matchQualityRiskGrade: string;
    warnings: string[];
  };
  rosterEligibilitySafety?: {
    unsupportedPositionsFiltered?: string[];
  };
};

type EnrichedMarketPlayer = {
  playerId: string;
  playerName: string;
  normalizedPlayerName?: string;
  position: string | null;
  team: string | null;
  adp: number | null;
  marketRank: number | null;
  marketFormat: string;
  externalMarketMatchConfidence: string | null;
  externalMarketNotes: string[];
  marketAnchorRank: number | null;
  marketAnchorMovement: number;
  activePolicyClass?: string | null;
  policyGroup?: string | null;
};

const DEFAULT_ARTIFACT_DIR = path.join("artifacts", "projections", "backtesting");
const MOVEMENT_CAP = 24;

export function buildMarketAnchorBoardPreview(input: {
  rows: BlackbirdBoardRow[];
  rosterPositions: string[];
  marketFormat: string;
  projectionSeason?: number;
  flagEnabled?: boolean;
  enrichedUniversePath?: string;
  reviewPath?: string;
  cwd?: string;
}): MarketAnchorBoardPreviewResult {
  const flagEnabled = Boolean(input.flagEnabled);
  const marketFormat = normalizeMarketFormat(input.marketFormat);
  const disabled = baseDiagnostics({ flagEnabled, marketFormat });
  if (!flagEnabled) return { rows: input.rows, diagnostics: disabled };

  const cwd = input.cwd ?? process.cwd();
  const season = input.projectionSeason ?? 2026;
  const enrichedUniversePath = input.enrichedUniversePath ?? path.join(DEFAULT_ARTIFACT_DIR, `current-season-adp-enriched-universe-${season}.json`);
  const reviewPath = input.reviewPath ?? path.join(DEFAULT_ARTIFACT_DIR, `current-market-anchor-review-${season}.json`);
  const resolvedUniversePath = path.resolve(cwd, enrichedUniversePath);
  const resolvedReviewPath = path.resolve(cwd, reviewPath);
  const artifactAvailability = {
    enrichedUniverse: existsSync(resolvedUniversePath),
    review: existsSync(resolvedReviewPath),
  };
  if (!artifactAvailability.enrichedUniverse || !artifactAvailability.review) {
    return {
      rows: input.rows,
      diagnostics: {
        ...disabled,
        flagEnabled: true,
        status: "artifacts_missing",
        label: "Market Anchor Rank: preview enabled",
        artifactAvailability,
        warnings: ["Market anchor artifacts missing — current Blackbird Rank path used."],
      },
    };
  }

  const universe = readJson<EnrichedUniverseArtifact>(resolvedUniversePath).rows ?? [];
  const review = readJson<ReviewArtifact>(resolvedReviewPath);
  const eligibleUniverse = filterDraftablePlayers(universe, { rosterPositions: input.rosterPositions });
  const marketByKey = new Map(eligibleUniverse.players.map((player) => [playerKey(player.playerId, player.playerName, player.position, player.team), player]));
  const appliedKeys = new Set<string>();
  const rows: MarketAnchorBoardPreviewRow[] = input.rows.map((row) => {
    const market = findMarketPlayer(marketByKey, row);
    if (!market || !canApplyMarketAnchor(market, marketFormat)) return row;
    appliedKeys.add(playerKey(market.playerId, market.playerName, market.position, market.team));
    return {
      ...row,
      marketRank: market.marketRank,
      rankDelta: market.marketAnchorMovement,
      marketAnchorPreview: {
        enabled: true,
        label: "Market Anchor Preview",
        source: "current_season_adp_enrichment",
        marketFormat,
        originalBlackbirdRank: row.blackbirdBoardRank,
        marketAnchorRank: market.marketAnchorRank ?? row.blackbirdBoardRank,
        marketRank: market.marketRank ?? row.blackbirdBoardRank,
        marketAdp: market.adp,
        rankDelta: market.marketAnchorMovement,
        matchConfidence: marketMatchConfidence(market),
        notes: ["ADP used as market prior, not value", ...market.externalMarketNotes],
      },
    } satisfies MarketAnchorBoardPreviewRow;
  });
  const sorted = [...rows].sort((a, b) => previewRank(a) - previewRank(b) || a.blackbirdBoardRank - b.blackbirdBoardRank || a.playerName.localeCompare(b.playerName));
  const reranked: MarketAnchorBoardPreviewRow[] = sorted.map((row, index) => ({
    ...row,
    blackbirdBoardRank: row.marketAnchorPreview ? index + 1 : row.blackbirdBoardRank,
  }));

  return {
    rows: reranked,
    diagnostics: {
      flagEnabled: true,
      status: "preview_enabled",
      label: "Market Anchor Rank: preview enabled",
      marketFormat,
      artifactAvailability,
      playersWithAdp: universe.filter((player) => player.marketRank !== null).length,
      playersWithMarketMovement: universe.filter((player) => player.marketRank !== null && player.marketAnchorMovement !== 0).length,
      playersApplied: appliedKeys.size,
      playersSkipped: Math.max(0, universe.filter((player) => player.marketRank !== null).length - appliedKeys.size),
      unsupportedPositionsFiltered: review.rosterEligibilitySafety?.unsupportedPositionsFiltered ?? eligibleUniverse.filteredPositions,
      matchQualityWarning: review.matchQualityAudit?.warnings?.[0] ?? null,
      warnings: [
        ...(review.matchQualityAudit?.warnings ?? []),
        ...(review.matchQualityAudit?.exactIdMatches === 0 ? ["Market anchor uses name/team/position matching; review before production activation."] : []),
      ],
    },
  };
}

export function buildMarketAnchorPreviewDisabledDiagnostics(marketFormat = "SUPERFLEX"): MarketAnchorBoardPreviewDiagnostics {
  return baseDiagnostics({ flagEnabled: false, marketFormat: normalizeMarketFormat(marketFormat) });
}

function canApplyMarketAnchor(player: EnrichedMarketPlayer, marketFormat: string) {
  if (normalizeMarketFormat(player.marketFormat) !== marketFormat) return false;
  if (player.marketRank === null || player.marketAnchorRank === null) return false;
  if (Math.abs(player.marketAnchorMovement) > MOVEMENT_CAP) return false;
  const confidence = marketMatchConfidence(player);
  return confidence === "exact" || confidence === "high";
}

function marketMatchConfidence(player: EnrichedMarketPlayer): "exact" | "high" | "review" {
  if (player.externalMarketNotes.some((note) => note === "unique_name_position_without_team")) return "review";
  if (player.externalMarketMatchConfidence === "exact") return "exact";
  if (player.externalMarketMatchConfidence === "high") return "high";
  return "review";
}

function findMarketPlayer(index: Map<string, EnrichedMarketPlayer>, row: BlackbirdBoardRow) {
  return (
    index.get(playerKey(row.playerId, row.playerName, row.position, row.team)) ??
    index.get(playerKey(null, row.playerName, row.position, row.team)) ??
    null
  );
}

function previewRank(row: MarketAnchorBoardPreviewRow) {
  return row.marketAnchorPreview?.marketAnchorRank ?? row.blackbirdBoardRank;
}

function baseDiagnostics(input: { flagEnabled: boolean; marketFormat: string }): MarketAnchorBoardPreviewDiagnostics {
  return {
    flagEnabled: input.flagEnabled,
    status: input.flagEnabled ? "preview_enabled" : "disabled",
    label: input.flagEnabled ? "Market Anchor Rank: preview enabled" : "Market Anchor Rank: disabled",
    marketFormat: input.marketFormat,
    artifactAvailability: { enrichedUniverse: false, review: false },
    playersWithAdp: 0,
    playersWithMarketMovement: 0,
    playersApplied: 0,
    playersSkipped: 0,
    unsupportedPositionsFiltered: [],
    matchQualityWarning: null,
    warnings: [],
  };
}

function playerKey(id: string | null | undefined, name: string | null | undefined, position: string | null | undefined, team: string | null | undefined) {
  return `${id ?? ""}|${normalizeName(name)}|${normalizePosition(position)}|${normalizeTeam(team)}`;
}

function normalizeMarketFormat(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function normalizeName(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizePosition(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toUpperCase();
  if (normalized === "D/ST" || normalized === "DST") return "DEF";
  return normalized;
}

function normalizeTeam(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}
