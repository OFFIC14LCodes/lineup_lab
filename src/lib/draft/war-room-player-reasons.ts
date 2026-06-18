import type { ProjectionUnit } from "@/lib/draft/blackbird-league-rank";

export type WarRoomPlayerReasonStack = {
  headline: string;
  valueReasons: string[];
  fitReasons: string[];
  projectionReasons: string[];
  riskReasons: string[];
  dataGapReasons: string[];
  timingReasons: string[];
};

export type WarRoomPlayerReasonStackInput = {
  playerName: string;
  position: string | null;
  team: string | null;
  blackbirdBoardRank: number;
  draftSuggestionRank: number | null;
  draftSuggestionScore: number | null;
  draftSuggestionType: string | null;
  blackbirdValueScore: number | null;
  projectionPoints: number | null;
  projectionLow: number | null;
  projectionHigh: number | null;
  projectionUnit: ProjectionUnit | "unknown";
  projectionSource: string;
  pointsAboveReplacement: number | null;
  confidence: string;
  risk: string;
  planFit: string | null;
  planFitReasons: string[];
  contextualReasons: string[];
  contextualDataGaps: string[];
  needTimingAction: string | null;
  waitPlanTargetCount: number | null;
  role: string | null;
  roleConfidence: string | null;
  replacementMedianPoints: number | null;
  blackbirdTier: number | null;
  dataStatus: {
    projection: "available" | "unavailable";
    h10: "available" | "unavailable";
    marketRank: "available" | "unavailable";
    ordering: string;
  };
  projectionTrust: {
    trustLabel: string;
    reasons: string[];
    fallbackReason?: string | null;
  };
};

export function buildWarRoomPlayerReasonStack(row: WarRoomPlayerReasonStackInput): WarRoomPlayerReasonStack {
  return {
    headline: buildHeadline(row),
    valueReasons: valueReasons(row),
    fitReasons: fitReasons(row),
    projectionReasons: projectionReasons(row),
    riskReasons: riskReasons(row),
    dataGapReasons: dataGapReasons(row),
    timingReasons: timingReasons(row),
  };
}

function buildHeadline(row: WarRoomPlayerReasonStackInput): string {
  const identity = [row.playerName, row.position, row.team].filter(Boolean).join(" · ");
  const draftRank = row.draftSuggestionRank === null ? "not currently ranked as a live suggestion" : `draft suggestion #${row.draftSuggestionRank}`;
  return `${identity} is Blackbird Power Rank #${row.blackbirdBoardRank} and ${draftRank}.`;
}

function valueReasons(row: WarRoomPlayerReasonStackInput): string[] {
  return withFallback([
    row.blackbirdValueScore === null ? null : `Value score is ${formatNumber(row.blackbirdValueScore)} out of 100.`,
    row.pointsAboveReplacement === null ? null : `PAR is ${formatNumber(row.pointsAboveReplacement)} against the role-aware replacement baseline.`,
    row.blackbirdTier === null ? null : `Blackbird tier ${row.blackbirdTier} groups him with similarly valued players.`,
    row.dataStatus.marketRank === "available" ? `Static league rank is available and does not depend on draft availability.` : null,
    ...row.contextualReasons.slice(0, 3),
  ], "No specific value drivers are available for this row yet.");
}

function fitReasons(row: WarRoomPlayerReasonStackInput): string[] {
  return withFallback([
    row.planFit ? `Plan fit is ${formatLabel(row.planFit)}.` : null,
    ...row.planFitReasons.slice(0, 4),
    row.role ? `Role proxy is ${formatLabel(row.role)}${row.roleConfidence ? ` with ${formatLabel(row.roleConfidence)} confidence` : ""}.` : null,
  ], "Fit reasons will appear when roster context is available.");
}

function projectionReasons(row: WarRoomPlayerReasonStackInput): string[] {
  if (row.dataStatus.projection === "unavailable") return ["No projection detail available yet."];
  return withFallback([
    row.projectionPoints === null ? null : `${projectionUnitLabel(row.projectionUnit)} median projection is ${formatNumber(row.projectionPoints)}.`,
    row.projectionLow === null || row.projectionHigh === null ? null : `Range is ${formatNumber(row.projectionLow)} floor to ${formatNumber(row.projectionHigh)} ceiling.`,
    `Projection source: ${formatLabel(row.projectionSource)}.`,
    `Projection trust is ${formatLabel(row.projectionTrust.trustLabel)}.`,
    ...row.projectionTrust.reasons.slice(0, 3),
  ], "Projection profile is available, but no detailed projection reasons were attached.");
}

function riskReasons(row: WarRoomPlayerReasonStackInput): string[] {
  return withFallback([
    `Player risk label is ${formatLabel(row.risk)}.`,
    `Confidence label is ${formatLabel(row.confidence)}.`,
    row.projectionTrust.fallbackReason ? `Projection fallback caveat: ${formatLabel(row.projectionTrust.fallbackReason)}.` : null,
    row.replacementMedianPoints === null ? "Replacement baseline is unavailable." : null,
    row.dataStatus.h10 === "unavailable" ? "Live H10 timing/value context is unavailable." : null,
  ], "Risk profile unavailable for this row.");
}

function dataGapReasons(row: WarRoomPlayerReasonStackInput): string[] {
  const gaps = [
    row.dataStatus.projection === "unavailable" ? "Projection data is unavailable." : null,
    row.dataStatus.marketRank === "unavailable" ? "Static Blackbird rank input is unavailable." : null,
    ...row.contextualDataGaps.filter((gap) => gap && gap.toLowerCase() !== "none").map((gap) => `${gap} is a data gap.`),
  ];
  return withFallback(gaps, "No specific data gaps flagged.");
}

function timingReasons(row: WarRoomPlayerReasonStackInput): string[] {
  return withFallback([
    row.needTimingAction ? `Timing action is ${formatLabel(row.needTimingAction)}.` : null,
    row.draftSuggestionType ? `Suggestion type is ${formatLabel(row.draftSuggestionType)}.` : null,
    row.waitPlanTargetCount ? `${row.waitPlanTargetCount} wait-plan target${row.waitPlanTargetCount === 1 ? "" : "s"} reference this profile.` : null,
    row.draftSuggestionRank === null ? "This player is not currently in the live Draft Suggestion list." : null,
  ], "Draft timing note is unavailable for this row.");
}

function withFallback(items: Array<string | null | undefined>, fallback: string): string[] {
  const compact = items.filter((item): item is string => Boolean(item && item.trim()));
  return compact.length ? dedupe(compact) : [fallback];
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function projectionUnitLabel(unit: ProjectionUnit | "unknown"): string {
  if (unit === "season") return "Season";
  if (unit === "weekly") return "Weekly";
  if (unit === "game") return "Game";
  if (unit === "fallback") return "Fallback";
  return "Unknown-unit";
}

function formatLabel(value: string): string {
  return value.replace(/_/g, " ");
}

function formatNumber(value: number): string {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
}
