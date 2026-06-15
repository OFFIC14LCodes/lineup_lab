import type { WarRoomRecommendationResult, WarRoomRecommendationRow } from "@/lib/draft/war-room-recommendations";
import { buildH10RecommendationExperimentDiagnostics, type H10RecommendationExperimentDiagnostics } from "@/lib/draft/war-room-recommendation-experiment";
import { buildNormalizedRosterRequirements, type NormalizedRosterRequirements } from "@/lib/draft/roster-slots";

export type H10WarRoomInventoryRow = {
  source: "live" | "validation_seed" | "fixture";
  draftRoomId: string;
  leagueId: string;
  leagueName: string | null;
  season: string | number | null;
  has_uploaded_rankings: boolean;
  remaining_player_count: number;
  fallback_row_count: number;
  ranked_row_count: number;
  positions_present: string[];
  hasIDP: boolean;
  hasKicker: boolean;
  hasTeamDefense: boolean;
  isSuperflex: boolean;
  is2QB: boolean;
  isTEPremium: boolean;
  benchDepth: number;
  currentPickKnown: boolean;
  picksUntilMyNextPickKnown: boolean;
  legacyRecommendationCount: number;
  h10PreviewEnabledPossible: boolean;
};

export type H10WarRoomPerRoomValidation = {
  source: "live" | "validation_seed" | "fixture";
  draftRoomId: string;
  leagueId: string;
  leagueName: string | null;
  formats: string[];
  remainingPlayersLoaded: number;
  overlayRowsLoaded: number;
  recommendationsGenerated: number;
  matchRate: number | null;
  rowsByTier: Record<string, number>;
  rowsByStatus: Record<string, number>;
  rowsByPosition: Record<string, number>;
  warningCounts: Record<string, number>;
  contextLimitations: string[];
  invariantFailures: string[];
  topRecommendations: H10WarRoomCompactRecommendation[];
  watchlistExamples: H10WarRoomCompactRecommendation[];
  insufficientDataExamples: H10WarRoomCompactRecommendation[];
  legacyRecommendationCount: number;
  legacyRecommendationTopRows: Array<{ player_name: string | null; position: string | null; recommendationTier?: string | null; draftTargetScore?: number | null }>;
  legacyRowsChanged: boolean;
  remainingPlayersOrderChanged: boolean;
  thresholdResults: H10WarRoomThresholdResults;
  formatDiagnostics: Record<string, unknown>;
  experimentReadiness: H10RecommendationExperimentDiagnostics;
};

export type H10WarRoomThresholdResults = {
  matchRatePass: boolean;
  insufficientDataPass: boolean;
  invariantPass: boolean;
  legacyUnchangedPass: boolean;
  remainingOrderUnchangedPass: boolean;
  forbiddenLanguagePass: boolean;
  offensiveTargetTierPass: boolean | null;
  superflexQbUrgencyPass: boolean | null;
  kEarlySuppressionPass: boolean | null;
  dstEarlySuppressionPass: boolean | null;
};

export type H10WarRoomCompactRecommendation = {
  recommendationRank: number;
  displayName: string;
  position: string | null;
  team: string | null;
  recommendationTier: string;
  recommendationScore: number;
  status: string;
  primaryReason: string;
  explanationFragments: string[];
  warningCodes: string[];
  reasonCodes: string[];
  scoreComponents: WarRoomRecommendationRow["scoreComponents"];
  h10: WarRoomRecommendationRow["h10"];
  draftContext: WarRoomRecommendationRow["draftContext"];
  rosterNeedStatus: WarRoomRecommendationRow["rosterNeedStatus"];
  needUrgency: WarRoomRecommendationRow["needUrgency"];
  futureAvailability: WarRoomRecommendationRow["futureAvailability"];
  tierDropRisk: WarRoomRecommendationRow["tierDropRisk"];
  opportunityCost: WarRoomRecommendationRow["opportunityCost"];
  needTimingAction: WarRoomRecommendationRow["needTimingAction"];
  needTimingReasons: string[];
};

const TARGET_TIERS = new Set(["priority_target", "strong_target", "solid_target", "watchlist"]);
const OFFENSE_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);
const IDP_POSITIONS = new Set(["DL", "LB", "DB"]);

export function classifyRosterFormats(input: {
  rosterSlots: string[] | null | undefined;
  isSuperflex?: boolean | null;
  isTwoQb?: boolean | null;
  tePremium?: number | null;
}): {
  requirements: NormalizedRosterRequirements;
  formats: string[];
  isSuperflex: boolean;
  is2QB: boolean;
  isTEPremium: boolean;
  benchDepth: number;
} {
  const requirements = buildNormalizedRosterRequirements(input.rosterSlots ?? []);
  const normalizedSlots = (input.rosterSlots ?? []).map((slot) => slot.trim().toUpperCase().replace(/\s+/g, "_"));
  const isSuperflex = Boolean(input.isSuperflex) || requirements.superflexCount > 0;
  const is2QB = Boolean(input.isTwoQb) || requirements.directStarters.QB >= 2 || normalizedSlots.includes("2QB");
  const isTEPremium = Number(input.tePremium ?? 0) > 0;
  const formats = [
    isSuperflex ? "Superflex" : null,
    is2QB ? "2QB" : null,
    isTEPremium ? "TE premium" : null,
    requirements.hasIDP ? "IDP" : null,
    requirements.hasKicker ? "Kicker" : null,
    requirements.hasTeamDefense ? "DST" : null,
    requirements.benchCount >= 8 ? "Deep roster" : "Shallow roster",
  ].filter((format): format is string => Boolean(format));

  if (!isSuperflex && !is2QB && !isTEPremium && !requirements.hasIDP) formats.unshift("1QB offense");

  return {
    requirements,
    formats,
    isSuperflex,
    is2QB,
    isTEPremium,
    benchDepth: requirements.benchCount,
  };
}

export function compactRecommendationRow(row: WarRoomRecommendationRow): H10WarRoomCompactRecommendation {
  return {
    recommendationRank: row.recommendationRank,
    displayName: row.displayName,
    position: row.position,
    team: row.team,
    recommendationTier: row.recommendationTier,
    recommendationScore: row.recommendationScore,
    status: row.status,
    primaryReason: row.primaryReason,
    explanationFragments: row.explanationFragments,
    warningCodes: row.warningCodes,
    reasonCodes: row.reasonCodes,
    scoreComponents: row.scoreComponents,
    h10: row.h10,
    draftContext: row.draftContext,
    rosterNeedStatus: row.rosterNeedStatus,
    needUrgency: row.needUrgency,
    futureAvailability: row.futureAvailability,
    tierDropRisk: row.tierDropRisk,
    opportunityCost: row.opportunityCost,
    needTimingAction: row.needTimingAction,
    needTimingReasons: row.needTimingReasons,
  };
}

export function buildPerRoomValidation(input: {
  inventory: H10WarRoomInventoryRow;
  recommendations: WarRoomRecommendationResult;
  legacyRecommendationTopRows: H10WarRoomPerRoomValidation["legacyRecommendationTopRows"];
  legacyRowsChanged: boolean;
  remainingPlayersOrderChanged: boolean;
}): H10WarRoomPerRoomValidation {
  const rows = input.recommendations.rows;
  const diagnostics = input.recommendations.diagnostics;
  const insufficientDataCount = diagnostics.rowsByTier.insufficient_data ?? 0;
  const shownRows = Math.max(1, diagnostics.recommendationsGenerated);
  const matchRate = diagnostics.matchCoverageSummary?.matchRate ?? null;
  const hasOffensiveRows = rows.some((row) => OFFENSE_POSITIONS.has(normalizePosition(row.position)));
  const hasOffensiveTargetTier = rows.some((row) => OFFENSE_POSITIONS.has(normalizePosition(row.position)) && TARGET_TIERS.has(row.recommendationTier));
  const qbRows = rows.filter((row) => normalizePosition(row.position) === "QB");
  const nonQbOffense = rows.filter((row) => OFFENSE_POSITIONS.has(normalizePosition(row.position)) && normalizePosition(row.position) !== "QB");
  const qbAverageRosterNeed = average(qbRows.map((row) => row.scoreComponents.rosterNeed));
  const nonQbAverageRosterNeed = average(nonQbOffense.map((row) => row.scoreComponents.rosterNeed));
  const kRows = rows.filter((row) => normalizePosition(row.position) === "K");
  const dstRows = rows.filter((row) => normalizePosition(row.position) === "DEF");
  const experimentReadiness = buildH10RecommendationExperimentDiagnostics({
    recommendations: input.recommendations,
    legacyRecommendationCount: input.inventory.legacyRecommendationCount,
    legacyRecommendationsUnchanged: !input.legacyRowsChanged,
    remainingPlayersOrderUnchanged: !input.remainingPlayersOrderChanged,
  });

  const thresholdResults: H10WarRoomThresholdResults = {
    matchRatePass: matchRate === null ? false : matchRate >= 0.85,
    insufficientDataPass: insufficientDataCount / shownRows <= 0.15,
    invariantPass: diagnostics.invariantFailures.length === 0,
    legacyUnchangedPass: !input.legacyRowsChanged,
    remainingOrderUnchangedPass: !input.remainingPlayersOrderChanged,
    forbiddenLanguagePass: diagnostics.invariantFailures.every((failure) => !failure.toLowerCase().includes("banned") && !failure.toLowerCase().includes("forbidden")),
    offensiveTargetTierPass: hasOffensiveRows ? hasOffensiveTargetTier : null,
    superflexQbUrgencyPass:
      input.inventory.isSuperflex || input.inventory.is2QB
        ? qbRows.length > 0 && nonQbOffense.length > 0
          ? qbAverageRosterNeed > nonQbAverageRosterNeed
          : null
        : null,
    kEarlySuppressionPass: kRows.length > 0 ? kRows.every((row) => row.recommendationTier !== "priority_target") : null,
    dstEarlySuppressionPass: dstRows.length > 0 ? dstRows.every((row) => row.recommendationTier !== "priority_target") : null,
  };

  return {
    source: input.inventory.source,
    draftRoomId: input.inventory.draftRoomId,
    leagueId: input.inventory.leagueId,
    leagueName: input.inventory.leagueName,
    formats: classifyInventoryFormats(input.inventory),
    remainingPlayersLoaded: diagnostics.remainingPlayersLoaded,
    overlayRowsLoaded: diagnostics.overlayRowsLoaded,
    recommendationsGenerated: diagnostics.recommendationsGenerated,
    matchRate,
    rowsByTier: diagnostics.rowsByTier,
    rowsByStatus: diagnostics.rowsByStatus,
    rowsByPosition: diagnostics.rowsByPosition,
    warningCounts: diagnostics.warningCounts,
    contextLimitations: diagnostics.contextLimitations,
    invariantFailures: diagnostics.invariantFailures,
    topRecommendations: rows.filter((row) => row.status === "recommendable" || row.status === "watch_only").slice(0, 15).map(compactRecommendationRow),
    watchlistExamples: rows.filter((row) => row.recommendationTier === "watchlist").slice(0, 10).map(compactRecommendationRow),
    insufficientDataExamples: rows.filter((row) => row.recommendationTier === "insufficient_data").slice(0, 10).map(compactRecommendationRow),
    legacyRecommendationCount: input.inventory.legacyRecommendationCount,
    legacyRecommendationTopRows: input.legacyRecommendationTopRows,
    legacyRowsChanged: input.legacyRowsChanged,
    remainingPlayersOrderChanged: input.remainingPlayersOrderChanged,
    thresholdResults,
    experimentReadiness,
    formatDiagnostics: {
      superflexQbUrgencyApplied: thresholdResults.superflexQbUrgencyPass,
      qbAverageRosterNeed,
      nonQbAverageRosterNeed,
      idpRows: rows.filter((row) => IDP_POSITIONS.has(normalizePosition(row.position))).length,
      kickerRows: kRows.length,
      dstRows: dstRows.length,
    },
  };
}

export function buildValidationReadiness(input: {
  inventory: H10WarRoomInventoryRow[];
  roomResults: H10WarRoomPerRoomValidation[];
}): {
  verdict: "ready" | "needs_revision" | "blocked_by_lack_of_draft_rooms";
  thresholdResults: Record<string, boolean>;
  failures: string[];
  formatCoverage: Record<string, boolean>;
} {
  const formatCoverage = {
    "1QB offense": input.roomResults.some((room) => room.formats.includes("1QB offense")),
    "Superflex / 2QB": input.roomResults.some((room) => room.formats.includes("Superflex") || room.formats.includes("2QB")),
    "TE premium": input.roomResults.some((room) => room.formats.includes("TE premium")),
    IDP: input.roomResults.some((room) => room.formats.includes("IDP")),
    Kicker: input.roomResults.some((room) => room.formats.includes("Kicker")),
    DST: input.roomResults.some((room) => room.formats.includes("DST")),
    "Deep rosters": input.roomResults.some((room) => room.formats.includes("Deep roster")),
    "Shallow rosters": input.roomResults.some((room) => room.formats.includes("Shallow roster")),
    "Uploaded rankings": input.inventory.some((room) => room.has_uploaded_rankings),
    "Fallback pools": input.inventory.some((room) => !room.has_uploaded_rankings && room.fallback_row_count > 0),
  };

  if (input.roomResults.length === 0) {
    return {
      verdict: "blocked_by_lack_of_draft_rooms",
      thresholdResults: {},
      failures: ["No draft rooms were available for live validation."],
      formatCoverage,
    };
  }

  const liveCoverageBlockers = buildCoverageBlockers(formatCoverage, input.roomResults);
  const roomFailures = input.roomResults.flatMap((room) => roomFailuresFor(room));
  const thresholdResults = {
    allMatchRatesPass: input.roomResults.every((room) => room.thresholdResults.matchRatePass),
    allInsufficientDataPass: input.roomResults.every((room) => room.thresholdResults.insufficientDataPass),
    allInvariantPass: input.roomResults.every((room) => room.thresholdResults.invariantPass),
    allLegacyUnchangedPass: input.roomResults.every((room) => room.thresholdResults.legacyUnchangedPass),
    allRemainingOrderUnchangedPass: input.roomResults.every((room) => room.thresholdResults.remainingOrderUnchangedPass),
    allForbiddenLanguagePass: input.roomResults.every((room) => room.thresholdResults.forbiddenLanguagePass),
    atLeastOneOffensiveRoomProducesTargetTiers: input.roomResults.some((room) => room.thresholdResults.offensiveTargetTierPass === true),
    superflexRoomShowsQbUrgency: input.roomResults.some((room) => room.thresholdResults.superflexQbUrgencyPass === true),
  };
  const failures = [
    ...roomFailures,
    ...liveCoverageBlockers,
    ...Object.entries(thresholdResults)
      .filter(([, passed]) => !passed)
      .map(([name]) => `Readiness threshold failed: ${name}`),
  ];
  return {
    verdict: liveCoverageBlockers.length > 0 ? "blocked_by_lack_of_draft_rooms" : failures.length === 0 ? "ready" : "needs_revision",
    thresholdResults,
    failures,
    formatCoverage,
  };
}

function buildCoverageBlockers(
  formatCoverage: Record<string, boolean>,
  roomResults: H10WarRoomPerRoomValidation[]
): string[] {
  const blockers: string[] = [];
  const hasOffensiveRows = roomResults.some((room) =>
    Object.keys(room.rowsByPosition).some((position) => OFFENSE_POSITIONS.has(normalizePosition(position)))
  );
  const hasSuperflexQbEvaluation = roomResults.some((room) => room.thresholdResults.superflexQbUrgencyPass !== null);

  if (!hasOffensiveRows) blockers.push("Validation set does not include offensive remaining-player rows.");
  if (!formatCoverage["1QB offense"]) blockers.push("Validation set does not include a 1QB offensive room.");
  if (!hasSuperflexQbEvaluation) blockers.push("Validation set does not include evaluable Superflex/2QB QB rows.");
  if (!formatCoverage["TE premium"]) blockers.push("Validation set does not include a TE premium room.");
  if (!formatCoverage.Kicker) blockers.push("Validation set does not include a kicker room.");
  if (!formatCoverage.DST) blockers.push("Validation set does not include a DST room.");
  if (!formatCoverage["Uploaded rankings"]) blockers.push("Validation set does not include a room with uploaded rankings.");

  return blockers;
}

function roomFailuresFor(room: H10WarRoomPerRoomValidation): string[] {
  const coreGates = new Set([
    "matchRatePass",
    "insufficientDataPass",
    "invariantPass",
    "legacyUnchangedPass",
    "remainingOrderUnchangedPass",
    "forbiddenLanguagePass",
  ]);
  return Object.entries(room.thresholdResults)
    .filter(([name]) => coreGates.has(name))
    .filter(([, passed]) => passed === false)
    .map(([name]) => `${room.draftRoomId}: ${name} failed`);
}

function classifyInventoryFormats(room: H10WarRoomInventoryRow): string[] {
  return [
    !room.isSuperflex && !room.is2QB && !room.isTEPremium && !room.hasIDP ? "1QB offense" : null,
    room.isSuperflex ? "Superflex" : null,
    room.is2QB ? "2QB" : null,
    room.isTEPremium ? "TE premium" : null,
    room.hasIDP ? "IDP" : null,
    room.hasKicker ? "Kicker" : null,
    room.hasTeamDefense ? "DST" : null,
    room.benchDepth >= 8 ? "Deep roster" : "Shallow roster",
    room.has_uploaded_rankings ? "Uploaded rankings" : "Fallback pool",
  ].filter((format): format is string => Boolean(format));
}

function normalizePosition(position: string | null | undefined): string {
  const normalized = (position ?? "").trim().toUpperCase();
  if (normalized === "DST" || normalized === "D/ST") return "DEF";
  return normalized;
}

function average(values: number[]): number {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return 0;
  return Math.round((finite.reduce((sum, value) => sum + value, 0) / finite.length) * 10) / 10;
}
