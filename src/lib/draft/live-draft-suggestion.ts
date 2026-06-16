import type { BlackbirdLeagueRankRow } from "@/lib/draft/blackbird-league-rank";
import type { LivePlanStatus } from "@/lib/draft/live-plan-status";
import { buildProjectionTrust } from "@/lib/projections/projection-trust";

export type LiveDraftSuggestionType =
  | "value"
  | "need"
  | "tier_risk"
  | "contingency"
  | "value_detour"
  | "wait_plan"
  | "depth"
  | "avoid_forcing"
  | "insufficient_data";

export type LiveDraftSuggestionRow = {
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
  draftSuggestionRank: number;
  suggestionScore: number;
  blackbirdRank: number;
  leagueValueScore: number;
  projectionTrustLabel: string;
  projectionTrustScore: number;
  projectionSource: string;
  projectionUnit: string;
  role: string;
  roleConfidence: string;
  pointsAboveReplacement: number | null;
  replacementMedianPoints: number | null;
  suggestionType: LiveDraftSuggestionType;
  timingAction: string;
  planFit: string | null;
  reasons: string[];
  cautions: string[];
  dataGaps: string[];
};

type LiveDraftPositionNeed = { position: string; needLevel?: string | null; deficit?: number | null; minimumNeed?: number | null };

export type BuildLiveDraftSuggestionsInput = {
  leagueRankRows: BlackbirdLeagueRankRow[];
  draftedPlayerIds?: string[];
  positionCounts?: Record<string, number>;
  positionNeeds?: LiveDraftPositionNeed[];
  currentPickNumber?: number | null;
  picksUntilMyTurn?: number | null;
  livePlanStatus?: LivePlanStatus | null;
};

export type LiveDraftSuggestionDiagnostics = {
  inputRows: number;
  availableRows: number;
  draftedRowsExcluded: number;
  rankChangedFromStatic: boolean;
  bannedLanguageFound: string[];
  noPersistence: true;
};

const BANNED_TERMS = ["must draft", "guaranteed", "lock", "best pick", "you should draft", "final plan"] as const;

export function buildLiveDraftSuggestions(input: BuildLiveDraftSuggestionsInput): {
  rows: LiveDraftSuggestionRow[];
  diagnostics: LiveDraftSuggestionDiagnostics;
} {
  const drafted = new Set(input.draftedPlayerIds ?? []);
  const needs = new Map((input.positionNeeds ?? []).map((need) => [normalizePosition(need.position), need]));
  const rows = input.leagueRankRows
    .filter((row) => !row.drafted && !drafted.has(row.playerId))
    .map((row) => {
      const position = normalizePosition(row.position);
      const need = needs.get(position);
      const planPosition = input.livePlanStatus?.positionPlanStatus.find((status) => status.position === position) ?? null;
      const tierRisk = input.livePlanStatus?.tierRiskStatus.find((status) => status.position === position && status.riskLevel !== "low") ?? null;
      const waitPlan = input.livePlanStatus?.waitPlanStatus.find((status) => status.position === position) ?? null;
      const contingency = input.livePlanStatus?.triggeredContingencies.find((status) => status.relatedPositions.includes(position)) ?? null;
      const staticRankScore = staticRankScoreFor(row.blackbirdRank, input.leagueRankRows.length);
      const parScore = row.replacementValue.parPercentileByPosition ?? 45;
      const needBoost = needBoostFor(need, planPosition);
      const tierBoost = tierRisk ? 9 : 0;
      const contingencyBoost = contingency ? 6 : 0;
      const waitAdjustment = waitPlan?.status === "supported" ? -3 : waitPlan?.status === "weakening" ? 4 : waitPlan?.status === "dangerous" ? 8 : 0;
      const avoidPenalty = planPosition?.status === "avoid_forcing" || ["K", "DEF"].includes(position) && (input.currentPickNumber ?? 1) <= 120 ? -10 : 0;
      const confidencePenalty = row.confidence === "very_low" ? -7 : row.confidence === "low" ? -4 : 0;
      const riskPenalty = row.risk === "high" ? -6 : row.risk === "medium" ? -3 : 0;
      const parAdjustment = parAdjustmentFor(row.pointsAboveReplacement);
      const roleAdjustment = roleAdjustmentFor(row.roleClassification.role, row.roleClassification.confidence);
      const projectionTrust = trustForRow(row);
      const fallbackPenalty = row.source.fallbackProjection ? -8 : 0;
      const suggestionScore = clamp(round2(
        row.leagueValueScore * 0.36 +
        staticRankScore * 0.16 +
        parScore * 0.16 +
        projectionTrust.trustScore * 0.1 +
        roleScoreFor(row.roleClassification.role) * 0.08 +
        needBoost +
        tierBoost +
        contingencyBoost +
        waitAdjustment +
        avoidPenalty +
        confidencePenalty +
        riskPenalty +
        parAdjustment +
        roleAdjustment +
        fallbackPenalty
      ), 0, 100);
      const suggestionType = typeFor({ needBoost, tierRisk: Boolean(tierRisk), contingency: Boolean(contingency), waitPlanStatus: waitPlan?.status, avoidPenalty, row });
      return {
        playerId: row.playerId,
        playerName: row.playerName,
        position,
        team: row.team,
        draftSuggestionRank: 0,
        suggestionScore,
        blackbirdRank: row.blackbirdRank,
        leagueValueScore: row.leagueValueScore,
        projectionTrustLabel: projectionTrust.trustLabel,
        projectionTrustScore: projectionTrust.trustScore,
        projectionSource: row.projectedFantasyPoints.source,
        projectionUnit: row.projectedFantasyPoints.unit,
        role: row.roleClassification.role,
        roleConfidence: row.roleClassification.confidence,
        pointsAboveReplacement: row.pointsAboveReplacement,
        replacementMedianPoints: row.replacementValue.replacementMedianPoints,
        suggestionType,
        timingAction: timingActionFor(suggestionType, waitPlan?.status ?? null),
        planFit: planPosition?.status ?? null,
        reasons: reasonsFor({ row, need, planPosition, tierRisk: Boolean(tierRisk), contingency: Boolean(contingency), waitPlanStatus: waitPlan?.status ?? null }),
        cautions: cautionsFor(row, avoidPenalty, projectionTrust),
        dataGaps: row.dataGaps,
      };
    })
    .sort((a, b) => b.suggestionScore - a.suggestionScore || a.blackbirdRank - b.blackbirdRank || a.playerName.localeCompare(b.playerName))
    .map((row, index) => ({ ...row, draftSuggestionRank: index + 1 }));
  return {
    rows,
    diagnostics: {
      inputRows: input.leagueRankRows.length,
      availableRows: rows.length,
      draftedRowsExcluded: input.leagueRankRows.length - rows.length,
      rankChangedFromStatic: rows.some((row) => row.draftSuggestionRank !== row.blackbirdRank),
      bannedLanguageFound: findBannedLiveDraftSuggestionLanguage(JSON.stringify(rows)),
      noPersistence: true,
    },
  };
}

export function findBannedLiveDraftSuggestionLanguage(text: string): string[] {
  const normalized = text.replace(/\bDrew Lock\b/g, "Drew L.").toLowerCase();
  return BANNED_TERMS.filter((phrase) => new RegExp(`(^|\\W)${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\W|$)`, "i").test(normalized));
}

function typeFor(input: {
  needBoost: number;
  tierRisk: boolean;
  contingency: boolean;
  waitPlanStatus?: string | null;
  avoidPenalty: number;
  row: BlackbirdLeagueRankRow;
}): LiveDraftSuggestionType {
  if (input.avoidPenalty < 0) return "avoid_forcing";
  if (input.contingency) return "contingency";
  if (input.tierRisk) return "tier_risk";
  if (input.needBoost >= 10) return "need";
  if ((input.row.pointsAboveReplacement ?? 0) >= 35 && input.row.leagueValueScore >= 72) return "value_detour";
  if (input.waitPlanStatus && input.waitPlanStatus !== "supported") return "wait_plan";
  if (input.row.projectedFantasyPoints.median === null) return "insufficient_data";
  if (input.needBoost > 0) return "depth";
  return "value";
}

function needBoostFor(need: LiveDraftPositionNeed | undefined, planPosition: LivePlanStatus["positionPlanStatus"][number] | null): number {
  const level = need?.needLevel ?? planPosition?.status ?? "";
  if (level === "urgent" || level === "behind" || level === "thin") return 18;
  if (level === "high") return 14;
  if (level === "moderate" || level === "intentionally_waiting") return 8;
  if (level === "low") return 3;
  return 0;
}

function timingActionFor(type: LiveDraftSuggestionType, waitStatus: string | null): string {
  if (type === "avoid_forcing") return "avoid forcing";
  if (type === "tier_risk" || type === "contingency") return "monitor tier pressure";
  if (type === "value_detour") return "value detour";
  if (type === "need") return "fill need if value holds";
  if (type === "wait_plan" && waitStatus === "dangerous") return "wait plan danger";
  if (type === "wait_plan") return "wait plan weakening";
  if (type === "insufficient_data") return "needs more data";
  return "value available";
}

function reasonsFor(input: {
  row: BlackbirdLeagueRankRow;
  need: LiveDraftPositionNeed | undefined;
  planPosition: LivePlanStatus["positionPlanStatus"][number] | null;
  tierRisk: boolean;
  contingency: boolean;
  waitPlanStatus: string | null;
}): string[] {
  return [
    `Static Blackbird Rank #${input.row.blackbirdRank}; live score adjusts for roster and timing context.`,
    input.need?.needLevel ? `${input.row.position} need level is ${input.need.needLevel}.` : null,
    input.planPosition ? `Live plan status for ${input.row.position}: ${input.planPosition.status}.` : null,
    input.row.pointsAboveReplacement !== null ? `Role-aware PAR is ${input.row.pointsAboveReplacement.toFixed(1)} points above replacement.` : null,
    input.row.roleClassification.role !== "unknown" ? `Role proxy is ${input.row.roleClassification.role.replace(/_/g, " ")} with ${input.row.roleClassification.confidence.replace("_", " ")} confidence.` : null,
    input.tierRisk ? `${input.row.position} tier risk is active.` : null,
    input.contingency ? `${input.row.position} contingency is active.` : null,
    input.waitPlanStatus ? `${input.row.position} wait plan status is ${input.waitPlanStatus}.` : null,
  ].filter((reason): reason is string => Boolean(reason));
}

function cautionsFor(row: BlackbirdLeagueRankRow, avoidPenalty: number, projectionTrust = trustForRow(row)): string[] {
  return [
    avoidPenalty < 0 ? `${row.position} has avoid-forcing context at this stage.` : null,
    row.confidence === "low" || row.confidence === "very_low" ? `Context confidence is ${row.confidence}.` : null,
    row.risk !== "low" ? `Risk label is ${row.risk}.` : null,
    row.projectedFantasyPoints.unit === "fallback" ? "Projection is fallback-labeled." : null,
    ["backup", "deep_reserve", "rookie_unknown", "unknown"].includes(row.roleClassification.role) ? `Role proxy is ${row.roleClassification.role.replace(/_/g, " ")}.` : null,
    row.replacementValue.replacementMedianPoints === null ? "Replacement baseline is unavailable." : null,
    projectionTrust.trustLabel === "very_low" || projectionTrust.trustLabel === "low" ? `Projection trust is ${projectionTrust.trustLabel.replace("_", " ")}.` : null,
    projectionTrust.fallbackReason ? `Projection caveat: ${projectionTrust.fallbackReason.replace(/_/g, " ")}.` : null,
  ].filter((caution): caution is string => Boolean(caution));
}

function parAdjustmentFor(pointsAboveReplacement: number | null): number {
  if (pointsAboveReplacement === null) return -2;
  return Math.max(-8, Math.min(8, pointsAboveReplacement * 0.05));
}

function roleAdjustmentFor(role: string, confidence: string): number {
  const base =
    role === "locked_starter" || role === "team_unit" ? 4 :
      role === "probable_starter" ? 3 :
        role === "committee" ? 1 :
          role === "rotational" ? 0 :
            role === "backup" ? -4 :
              role === "deep_reserve" ? -8 :
                role === "rookie_unknown" ? -5 :
                  -3;
  const confidencePenalty = confidence === "very_low" ? -3 : confidence === "low" ? -1.5 : 0;
  return base + confidencePenalty;
}

function staticRankScoreFor(rank: number, totalRows: number): number {
  if (totalRows <= 1) return 50;
  return Math.max(0, Math.min(100, 100 - ((rank - 1) / (totalRows - 1)) * 100));
}

function roleScoreFor(role: string): number {
  if (role === "locked_starter" || role === "team_unit") return 82;
  if (role === "probable_starter") return 76;
  if (role === "committee") return 62;
  if (role === "rotational") return 52;
  if (role === "backup") return 34;
  if (role === "deep_reserve") return 18;
  if (role === "rookie_unknown") return 38;
  return 42;
}

function trustForRow(row: BlackbirdLeagueRankRow) {
  return row.projectionTrust ?? buildProjectionTrust({
    playerId: row.playerId,
    playerName: row.playerName,
    position: row.position,
    team: row.team,
    projectionRunId: row.source?.projectionRunId ?? null,
    projectionVersion: row.source?.projectionVersion ?? null,
    projectionUnit: row.projectedFantasyPoints.unit,
    projectionSource: row.projectedFantasyPoints.source,
    confidence: row.confidence,
    dataGaps: row.dataGaps,
    floorPoints: row.projectedFantasyPoints.floor,
    medianPoints: row.projectedFantasyPoints.median,
    ceilingPoints: row.projectedFantasyPoints.ceiling,
    isFallback: row.source?.fallbackProjection ?? row.projectedFantasyPoints.unit === "fallback",
  });
}

function normalizePosition(position: string): string {
  const normalized = position.trim().toUpperCase();
  return normalized === "DST" || normalized === "D/ST" ? "DEF" : normalized;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
