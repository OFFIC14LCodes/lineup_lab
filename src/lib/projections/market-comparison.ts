import { buildConsensusAdpWithBreakdown, type SnapshotContribution } from "@/lib/adp/consensus";
import { scoreFormatMatch, scoreFormatMatchByPosition } from "@/lib/adp/format-match";
import type {
  AdpFormatProfile,
  ConsensusAdpBreakdown,
  ConsensusAdpRecord,
  LeagueFormatInput,
} from "@/lib/adp/types";

import { sha256 } from "./hash";
import type { MarketDiscrepancyLabel, ProjectionPosition } from "./types";

export type MarketCompatibilityLabel =
  | "EXACT_MATCH"
  | "STRONG_MATCH"
  | "PARTIAL_MATCH"
  | "WEAK_MATCH"
  | "INCOMPATIBLE"
  | "NO_MARKET_DATA";

export type MarketConfidenceLabel = "high" | "medium" | "low" | "none";

export type MarketReasonCode =
  | "PROJECTED_ABOVE_MARKET"
  | "PROJECTED_BELOW_MARKET"
  | "MARKET_ALIGNED"
  | "MARKET_DISAGREEMENT_HIGH"
  | "MARKET_FORMAT_WARNING"
  | "MARKET_DATA_UNAVAILABLE"
  | "MARKET_SINGLE_PROVIDER"
  | "MARKET_PROVIDER_DISAGREEMENT_HIGH";

export type MarketSourceContribution = {
  snapshotId: string;
  provider: string;
  capturedAt: string;
  overallAdp: number;
  effectiveWeight: number;
};

export type ProjectionMarketInput = {
  projectionRunId: string;
  canonicalPlayerId: string;
  leagueId: string;
  position: ProjectionPosition;
  projectedPositionRank: number;
};

export type MarketComparison = {
  projectionRunId: string;
  canonicalPlayerId: string;
  leagueId: string;
  marketOverallAdp: number | null;
  marketPositionAdp: number | null;
  marketPositionRank: number | null;
  projectedPositionRank: number;
  rankDelta: number | null;
  absoluteRankDelta: number | null;
  marketAgreementScore: number | null;
  marketDiscrepancyLabel: MarketDiscrepancyLabel | "no_compatible_market";
  compatibilityLabel: MarketCompatibilityLabel;
  marketConfidenceLabel: MarketConfidenceLabel;
  providerCount: number;
  providerDisagreement: number | null;
  sourceContributions: MarketSourceContribution[];
  formatWarnings: string[];
  reasonCodes: MarketReasonCode[];
  semanticMarketHash: string;
};

export type SnapshotMarketInput = {
  snapshotId: string;
  provider: string;
  capturedAt: string;
  sourceConfidence: "high" | "medium" | "low" | "unknown";
  sampleSize: number | null;
  formatProfile: AdpFormatProfile;
  records: SnapshotContribution["records"];
};

export type MarketInspectionRow = {
  canonical_player_id: string;
  league_id: string;
  compatibility_label: string;
  reason_codes: string[];
  provider_count: number;
};

export type MarketInspectionSummary = {
  comparisonRows: number;
  distinctPlayers: number;
  distinctLeagues: number;
  missingComparisons: number;
  duplicateComparisonKeys: number;
  compatibleComparisonCount: number;
  noMarketCount: number;
  incompatibleOnlyCount: number;
  playersWithZeroCompatibleMarketAcrossAllLeagues: number;
  playersWithAtLeastOneNoMarketLeague: number;
  playersWithCompatibleMarketInAtLeastOneLeague: number;
  leaguesWithZeroCompatibleMarket: number;
  leaguesWithAtLeastOneNoMarketPlayer: number;
  compatibilityDistribution: Record<string, number>;
  providerCountDistribution: Record<string, number>;
  reconciliation: {
    comparisonRowsEqualCompatiblePlusNoMarket: boolean;
    providerZeroEqualsNoMarketCount: boolean;
    missingAndDuplicateFree: boolean;
  };
};

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function isNoMarketRow(row: MarketInspectionRow): boolean {
  return row.provider_count === 0 || row.reason_codes.includes("MARKET_DATA_UNAVAILABLE");
}

function hasCompatibleMarket(row: MarketInspectionRow): boolean {
  return !isNoMarketRow(row) && row.provider_count > 0;
}

export function summarizeMarketInspection(
  rows: MarketInspectionRow[],
  expectedCount: number
): MarketInspectionSummary {
  const keys = rows.map((row) => `${row.canonical_player_id}|${row.league_id}`);
  const playerRows = new Map<string, MarketInspectionRow[]>();
  const leagueRows = new Map<string, MarketInspectionRow[]>();
  for (const row of rows) {
    const byPlayer = playerRows.get(row.canonical_player_id) ?? [];
    byPlayer.push(row);
    playerRows.set(row.canonical_player_id, byPlayer);
    const byLeague = leagueRows.get(row.league_id) ?? [];
    byLeague.push(row);
    leagueRows.set(row.league_id, byLeague);
  }
  const noMarketRows = rows.filter(isNoMarketRow);
  const compatibleRows = rows.filter(hasCompatibleMarket);
  const providerCountDistribution = countBy(rows.map((row) => String(row.provider_count)));
  const noMarketCount = noMarketRows.length;
  const missingComparisons = Math.max(0, expectedCount - new Set(keys).size);
  const duplicateComparisonKeys = keys.length - new Set(keys).size;

  return {
    comparisonRows: rows.length,
    distinctPlayers: playerRows.size,
    distinctLeagues: leagueRows.size,
    missingComparisons,
    duplicateComparisonKeys,
    compatibleComparisonCount: compatibleRows.length,
    noMarketCount,
    incompatibleOnlyCount: rows.filter((row) => row.compatibility_label === "INCOMPATIBLE" && isNoMarketRow(row)).length,
    playersWithZeroCompatibleMarketAcrossAllLeagues: [...playerRows.values()]
      .filter((playerComparisons) => playerComparisons.every(isNoMarketRow)).length,
    playersWithAtLeastOneNoMarketLeague: [...playerRows.values()]
      .filter((playerComparisons) => playerComparisons.some(isNoMarketRow)).length,
    playersWithCompatibleMarketInAtLeastOneLeague: [...playerRows.values()]
      .filter((playerComparisons) => playerComparisons.some(hasCompatibleMarket)).length,
    leaguesWithZeroCompatibleMarket: [...leagueRows.values()]
      .filter((leagueComparisons) => leagueComparisons.every(isNoMarketRow)).length,
    leaguesWithAtLeastOneNoMarketPlayer: [...leagueRows.values()]
      .filter((leagueComparisons) => leagueComparisons.some(isNoMarketRow)).length,
    compatibilityDistribution: countBy(rows.map((row) => row.compatibility_label)),
    providerCountDistribution,
    reconciliation: {
      comparisonRowsEqualCompatiblePlusNoMarket: rows.length === compatibleRows.length + noMarketCount,
      providerZeroEqualsNoMarketCount: Number(providerCountDistribution["0"] ?? 0) === noMarketCount,
      missingAndDuplicateFree: missingComparisons === 0 && duplicateComparisonKeys === 0,
    },
  };
}

function sourceConfidenceScore(confidence: SnapshotMarketInput["sourceConfidence"]): number {
  if (confidence === "high") return 1;
  if (confidence === "medium") return 0.75;
  if (confidence === "low") return 0.5;
  return 0.4;
}

function sameCoreFormat(snapshot: AdpFormatProfile, league: LeagueFormatInput): boolean {
  return snapshot.isDynasty === league.isDynasty &&
    snapshot.isBestBall === league.isBestBall &&
    snapshot.isSuperflex === league.isSuperflex &&
    Math.abs(snapshot.pprValue - league.pprValue) < 0.01 &&
    Math.abs(snapshot.tePremiumValue - league.tePremiumValue) < 0.01 &&
    Math.abs(snapshot.teamCount - league.teamCount) <= 2;
}

function isRookieOnly(profile: AdpFormatProfile): boolean {
  return profile.draftType === "dynasty_rookie";
}

export function classifyMarketCompatibility(opts: {
  snapshot: AdpFormatProfile;
  league: LeagueFormatInput;
  position: ProjectionPosition;
}): {
  label: MarketCompatibilityLabel;
  weight: number;
  warnings: string[];
} {
  if (isRookieOnly(opts.snapshot)) {
    return { label: "INCOMPATIBLE", weight: 0, warnings: ["Rookie-only ADP is not comparable to full baseline projections."] };
  }
  if (opts.snapshot.isDynasty !== opts.league.isDynasty) {
    return { label: "INCOMPATIBLE", weight: 0, warnings: ["Dynasty and redraft ADP are not blended."] };
  }
  if (opts.snapshot.isBestBall !== opts.league.isBestBall) {
    return { label: "INCOMPATIBLE", weight: 0, warnings: ["Best-ball and managed-league ADP are not blended."] };
  }

  const format = scoreFormatMatch("snapshot", opts.snapshot, opts.league);
  const positionScore = scoreFormatMatchByPosition(opts.snapshot, opts.league)
    .find((score) => score.position === opts.position)?.score ?? format.overallScore;
  const warnings = [...format.warnings];
  const positionWarnings = scoreFormatMatchByPosition(opts.snapshot, opts.league)
    .find((score) => score.position === opts.position)?.warnings ?? [];
  warnings.push(...positionWarnings);

  if (sameCoreFormat(opts.snapshot, opts.league)) {
    return { label: "EXACT_MATCH", weight: 1, warnings };
  }
  if (format.overallScore >= 0.85 && positionScore >= 0.80) {
    return { label: "STRONG_MATCH", weight: Math.min(format.overallScore, positionScore), warnings };
  }
  if (format.overallScore >= 0.65 && positionScore >= 0.55) {
    return { label: "PARTIAL_MATCH", weight: Math.min(format.overallScore, positionScore) * 0.8, warnings };
  }
  if (format.overallScore >= 0.45 && positionScore >= 0.35) {
    return { label: "WEAK_MATCH", weight: Math.min(format.overallScore, positionScore) * 0.45, warnings };
  }
  return { label: "INCOMPATIBLE", weight: 0, warnings };
}

export function marketDiscrepancyLabel(rankDelta: number | null): MarketComparison["marketDiscrepancyLabel"] {
  if (rankDelta === null) return "no_compatible_market";
  const abs = Math.abs(rankDelta);
  if (abs <= 5) return "aligned";
  if (abs <= 15) return "slight_disagreement";
  if (abs <= 30) return "moderate_disagreement";
  return "strong_disagreement";
}

export function marketAgreementScore(rankDelta: number | null): number | null {
  if (rankDelta === null) return null;
  return Math.max(0, Math.round((1 - Math.min(Math.abs(rankDelta), 60) / 60) * 1000) / 1000);
}

function semanticMarketHash(payload: unknown): string {
  return sha256(JSON.stringify(payload));
}

function comparisonReasons(opts: {
  rankDelta: number | null;
  label: MarketComparison["marketDiscrepancyLabel"];
  providerCount: number;
  providerDisagreement: number | null;
  warnings: string[];
}): MarketReasonCode[] {
  const reasons = new Set<MarketReasonCode>();
  if (opts.rankDelta === null) reasons.add("MARKET_DATA_UNAVAILABLE");
  else if (opts.label === "aligned") reasons.add("MARKET_ALIGNED");
  else if (opts.rankDelta > 0) reasons.add("PROJECTED_ABOVE_MARKET");
  else reasons.add("PROJECTED_BELOW_MARKET");
  if (opts.label === "strong_disagreement") reasons.add("MARKET_DISAGREEMENT_HIGH");
  if (opts.providerCount === 1) reasons.add("MARKET_SINGLE_PROVIDER");
  if ((opts.providerDisagreement ?? 0) > 24) reasons.add("MARKET_PROVIDER_DISAGREEMENT_HIGH");
  if (opts.warnings.length > 0) reasons.add("MARKET_FORMAT_WARNING");
  return [...reasons].sort();
}

function highestCompatibility(labels: MarketCompatibilityLabel[]): MarketCompatibilityLabel {
  const order: MarketCompatibilityLabel[] = ["EXACT_MATCH", "STRONG_MATCH", "PARTIAL_MATCH", "WEAK_MATCH", "INCOMPATIBLE", "NO_MARKET_DATA"];
  return order.find((label) => labels.includes(label)) ?? "NO_MARKET_DATA";
}

export function buildLeagueMarketConsensus(opts: {
  league: LeagueFormatInput;
  position: ProjectionPosition;
  snapshots: SnapshotMarketInput[];
  referenceDate?: Date;
}): {
  records: ConsensusAdpRecord[];
  breakdowns: Map<string, ConsensusAdpBreakdown>;
  compatibilityBySnapshot: Map<string, MarketCompatibilityLabel>;
  warningsBySnapshot: Map<string, string[]>;
} {
  const compatibilityBySnapshot = new Map<string, MarketCompatibilityLabel>();
  const warningsBySnapshot = new Map<string, string[]>();
  const contributions: SnapshotContribution[] = [];
  for (const snapshot of opts.snapshots) {
    const compatibility = classifyMarketCompatibility({
      snapshot: snapshot.formatProfile,
      league: opts.league,
      position: opts.position,
    });
    compatibilityBySnapshot.set(snapshot.snapshotId, compatibility.label);
    warningsBySnapshot.set(snapshot.snapshotId, compatibility.warnings);
    if (compatibility.weight <= 0) continue;
    contributions.push({
      snapshotId: snapshot.snapshotId,
      provider: snapshot.provider,
      capturedAt: snapshot.capturedAt,
      formatMatchScore: compatibility.weight,
      sourceConfidenceScore: sourceConfidenceScore(snapshot.sourceConfidence),
      sampleSize: snapshot.sampleSize,
      records: snapshot.records,
    });
  }
  return {
    ...buildConsensusAdpWithBreakdown(contributions, opts.referenceDate),
    compatibilityBySnapshot,
    warningsBySnapshot,
  };
}

export function buildMarketComparison(opts: {
  projection: ProjectionMarketInput;
  consensus: ConsensusAdpRecord | null;
  breakdown: ConsensusAdpBreakdown | null;
  compatibilityLabels: MarketCompatibilityLabel[];
  formatWarnings: string[];
}): MarketComparison {
  const marketPositionRank = opts.consensus?.positionalRank ?? null;
  const rankDelta = marketPositionRank === null
    ? null
    : marketPositionRank - opts.projection.projectedPositionRank;
  const label = marketDiscrepancyLabel(rankDelta);
  const providerCount = opts.breakdown?.providerContributions.length ?? 0;
  const providerDisagreement = opts.breakdown?.providerDisagreement ?? null;
  const warnings = [...new Set(opts.formatWarnings)].sort();
  const compatibilityLabel = opts.consensus
    ? highestCompatibility(opts.compatibilityLabels)
    : (opts.compatibilityLabels.length > 0 ? "INCOMPATIBLE" : "NO_MARKET_DATA");
  const marketConfidenceLabel: MarketConfidenceLabel = opts.breakdown?.marketConfidence ?? "none";
  const reasons = comparisonReasons({
    rankDelta,
    label,
    providerCount,
    providerDisagreement,
    warnings,
  });
  const sourceContributions = (opts.breakdown?.providerContributions ?? []).map((contribution) => ({
    snapshotId: contribution.snapshotId,
    provider: contribution.provider,
    capturedAt: contribution.capturedAt,
    overallAdp: contribution.overallAdp,
    effectiveWeight: contribution.effectiveWeight,
  }));

  const comparisonWithoutHash = {
    projectionRunId: opts.projection.projectionRunId,
    canonicalPlayerId: opts.projection.canonicalPlayerId,
    leagueId: opts.projection.leagueId,
    marketOverallAdp: opts.consensus?.overallAdp ?? null,
    marketPositionAdp: opts.consensus?.positionalAdp ?? null,
    marketPositionRank,
    projectedPositionRank: opts.projection.projectedPositionRank,
    rankDelta,
    absoluteRankDelta: rankDelta === null ? null : Math.abs(rankDelta),
    marketAgreementScore: marketAgreementScore(rankDelta),
    marketDiscrepancyLabel: label,
    compatibilityLabel,
    marketConfidenceLabel,
    providerCount,
    providerDisagreement,
    sourceContributions,
    formatWarnings: warnings,
    reasonCodes: reasons,
  };
  return {
    ...comparisonWithoutHash,
    semanticMarketHash: semanticMarketHash(comparisonWithoutHash),
  };
}
