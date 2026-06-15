import type { DraftTargetScorePlayer } from "@/lib/draft/scoring";
import type { NormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import {
  buildWarRoomMatchingCoverage,
  matchedEntityIdForCoverage,
  type WarRoomMatchingCoverageSummary,
} from "@/lib/draft/war-room-matching-coverage";
import type { H10LeagueValueRow } from "@/lib/projections/h10-league-value";

export type WarRoomValueOverlayRow = {
  leagueId: string;
  entityId: string | null;
  entityType: "PLAYER" | "TEAM_DEFENSE" | null;
  displayName: string;
  team: string | null;
  position: string | null;
  floorPoints: number | null;
  medianPoints: number | null;
  ceilingPoints: number | null;
  pointsAboveReplacement: number | null;
  pointsAboveStarterCutline: number | null;
  riskAdjustedValue: number | null;
  confidenceAdjustedValue: number | null;
  tier: number | null;
  tierLabel: string | null;
  positionScarcityScore: number | null;
  scarcityLabel: string | null;
  marketValueSignal: string | null;
  marketRankDelta: number | null;
  confidenceLabel: string | null;
  riskLabel: string | null;
  valueReadiness: string | null;
  warningCodes: string[];
  reasonCodes: string[];
  draftRelevance: "draft_relevant" | "format_excluded" | "diagnostic_only" | "missing_projection";
  overlayStatus: "available" | "missing_projection" | "format_excluded" | "low_confidence" | "dst_dry_run";
};

export type WarRoomValueOverlayResult = {
  rows: WarRoomValueOverlayRow[];
  diagnostics: {
    leagueId: string;
    playerRowsLoaded: number;
    h10RowsLoaded: number;
    matchedRows: number;
    unmatchedRows: number;
    rowsByOverlayStatus: Record<string, number>;
    rowsByPosition: Record<string, number>;
    warningCounts: Record<string, number>;
    matchCoverageSummary: WarRoomMatchingCoverageSummary;
    missingProjectionReasons: Record<string, number>;
    matchRateByPosition: WarRoomMatchingCoverageSummary["matchRateByPosition"];
    highPriorityMissingProjectionExamples: WarRoomMatchingCoverageSummary["highPriorityMissingProjectionExamples"];
    invariantFailures: string[];
  };
};

export type BuildWarRoomValueOverlayInput = {
  leagueId: string;
  players: DraftTargetScorePlayer[];
  valueRows: H10LeagueValueRow[];
  rosterRequirements: NormalizedRosterRequirements;
  includeDstDryRun?: boolean;
  includeAllPositions?: boolean;
  sleeperToCanonicalId?: Record<string, string>;
};

const MISSING_PROJECTION_WARNING = "H10_VALUE_OVERLAY_MISSING_PROJECTION";
const FORBIDDEN_FIELDS = ["recommendation", "shouldDraft", "bestPick", "pickGrade", "takeNow", "avoidNow"];
const IDP_POSITIONS = new Set(["DL", "LB", "DB"]);

export function buildWarRoomValueOverlay(input: BuildWarRoomValueOverlayInput): WarRoomValueOverlayResult {
  const valueRows = input.valueRows.filter((row) => row.leagueId === input.leagueId);
  const byEntityId = new Map(valueRows.map((row) => [row.entityId, row]));
  const coverage = buildWarRoomMatchingCoverage({
    leagueId: input.leagueId,
    players: input.players,
    valueRows: input.valueRows,
    rosterRequirements: input.rosterRequirements,
    includeDstDryRun: input.includeDstDryRun,
    includeAllPositions: input.includeAllPositions,
    sleeperToCanonicalId: input.sleeperToCanonicalId,
  });
  const rows = input.players.map((player, index) => {
    const coverageRow = coverage.rows[index];
    const matchedEntityId = matchedEntityIdForCoverage(coverageRow);
    const valueRow = matchedEntityId ? byEntityId.get(matchedEntityId) ?? null : null;
    if (!valueRow) return missingRow(input.leagueId, player);
    return overlayRow(player, valueRow, input.rosterRequirements, Boolean(input.includeDstDryRun), Boolean(input.includeAllPositions), coverageRow.reasonCodes);
  });
  const diagnostics = {
    leagueId: input.leagueId,
    playerRowsLoaded: input.players.length,
    h10RowsLoaded: valueRows.length,
    matchedRows: rows.filter((row) => row.overlayStatus !== "missing_projection").length,
    unmatchedRows: rows.filter((row) => row.overlayStatus === "missing_projection").length,
    rowsByOverlayStatus: countBy(rows.map((row) => row.overlayStatus)),
    rowsByPosition: countBy(rows.map((row) => normalizePosition(row.position ?? "UNK"))),
    warningCounts: countBy(rows.flatMap((row) => row.warningCodes)),
    matchCoverageSummary: coverage.summary,
    missingProjectionReasons: coverage.summary.missingProjectionReasons,
    matchRateByPosition: coverage.summary.matchRateByPosition,
    highPriorityMissingProjectionExamples: coverage.summary.highPriorityMissingProjectionExamples,
    invariantFailures: validateForbiddenFields(rows),
  };
  return { rows, diagnostics };
}

function overlayRow(
  player: DraftTargetScorePlayer,
  row: H10LeagueValueRow,
  requirements: NormalizedRosterRequirements,
  includeDstDryRun: boolean,
  includeAllPositions: boolean,
  matchReasonCodes: string[] = []
): WarRoomValueOverlayRow {
  const formatExcluded = !includeAllPositions && isFormatExcluded(row, requirements, includeDstDryRun);
  const overlayStatus = formatExcluded ? "format_excluded" : statusFor(row);
  return {
    leagueId: row.leagueId,
    entityId: row.entityId,
    entityType: row.entityType,
    displayName: player.player_name ?? row.displayName,
    team: player.team ?? row.team,
    position: player.position ?? row.position,
    floorPoints: row.floorPoints,
    medianPoints: row.medianPoints,
    ceilingPoints: row.ceilingPoints,
    pointsAboveReplacement: row.pointsAboveReplacement,
    pointsAboveStarterCutline: row.pointsAboveStarterCutline,
    riskAdjustedValue: row.riskAdjustedValue,
    confidenceAdjustedValue: row.confidenceAdjustedValue,
    tier: row.tier,
    tierLabel: row.tierLabel,
    positionScarcityScore: row.positionScarcityScore,
    scarcityLabel: row.scarcityLabel,
    marketValueSignal: row.marketValueSignal,
    marketRankDelta: row.marketRankDelta,
    confidenceLabel: inferConfidenceLabel(row),
    riskLabel: row.riskLabel,
    valueReadiness: row.valueReadiness,
    warningCodes: [...row.warningCodes],
    reasonCodes: Array.from(new Set([...row.reasonCodes, ...matchReasonCodes])).sort(),
    draftRelevance: formatExcluded ? "format_excluded" : row.draftRelevance,
    overlayStatus,
  };
}

function missingRow(leagueId: string, player: DraftTargetScorePlayer): WarRoomValueOverlayRow {
  return {
    leagueId,
    entityId: null,
    entityType: null,
    displayName: player.player_name ?? "Unknown",
    team: player.team,
    position: player.position,
    floorPoints: null,
    medianPoints: null,
    ceilingPoints: null,
    pointsAboveReplacement: null,
    pointsAboveStarterCutline: null,
    riskAdjustedValue: null,
    confidenceAdjustedValue: null,
    tier: null,
    tierLabel: null,
    positionScarcityScore: null,
    scarcityLabel: null,
    marketValueSignal: null,
    marketRankDelta: null,
    confidenceLabel: null,
    riskLabel: null,
    valueReadiness: null,
    warningCodes: [MISSING_PROJECTION_WARNING],
    reasonCodes: [],
    draftRelevance: "missing_projection",
    overlayStatus: "missing_projection",
  };
}

function isFormatExcluded(row: H10LeagueValueRow, requirements: NormalizedRosterRequirements, includeDstDryRun: boolean): boolean {
  const position = normalizePosition(row.positionGroup);
  if (IDP_POSITIONS.has(position)) return !requirements.hasIDP;
  if (position === "K") return !requirements.hasKicker;
  if (position === "DST") return !requirements.hasTeamDefense || !includeDstDryRun;
  return false;
}

function statusFor(row: H10LeagueValueRow): WarRoomValueOverlayRow["overlayStatus"] {
  if (normalizePosition(row.positionGroup) === "DST" || row.valueReadiness === "SCORING_PARTIAL_ALLOWANCE_ONLY" || row.warningCodes.includes("DST_DRY_RUN_ONLY")) return "dst_dry_run";
  if (row.valueReadiness === "LOW_CONFIDENCE_BASELINE" || row.riskLabel === "high" || row.riskLabel === "extreme" || row.warningCodes.includes("LOW_PROJECTION_CONFIDENCE")) return "low_confidence";
  return "available";
}

function inferConfidenceLabel(row: H10LeagueValueRow): string | null {
  if (row.riskLabel === "extreme") return "very_low";
  if (row.riskLabel === "high") return "low";
  if (row.riskLabel === "low") return "high_or_medium";
  return "medium";
}

function normalizePosition(position: string): string {
  const normalized = position.toUpperCase();
  return normalized === "DEF" || normalized === "D/ST" ? "DST" : normalized;
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function validateForbiddenFields(rows: WarRoomValueOverlayRow[]): string[] {
  const keys = new Set(rows.flatMap((row) => Object.keys(row)));
  return FORBIDDEN_FIELDS.filter((field) => keys.has(field)).map((field) => `Forbidden output field emitted: ${field}`);
}
