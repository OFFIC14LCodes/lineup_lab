import type { BlackbirdLeagueRankRow } from "@/lib/draft/blackbird-league-rank";
import type { LivePlanStatus } from "@/lib/draft/live-plan-status";

export type LiveDraftSuggestionType =
  | "value"
  | "need"
  | "tier_risk"
  | "contingency"
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
      const baseScore = Math.max(0, 100 - row.blackbirdRank * 0.35) + row.leagueValueScore * 0.7;
      const needBoost = needBoostFor(need, planPosition);
      const tierBoost = tierRisk ? 12 : 0;
      const contingencyBoost = contingency ? 8 : 0;
      const waitAdjustment = waitPlan?.status === "supported" ? -4 : waitPlan?.status === "weakening" ? 5 : waitPlan?.status === "dangerous" ? 10 : 0;
      const avoidPenalty = planPosition?.status === "avoid_forcing" || ["K", "DEF"].includes(position) && (input.currentPickNumber ?? 1) <= 120 ? -12 : 0;
      const confidencePenalty = row.confidence === "very_low" ? -8 : row.confidence === "low" ? -4 : 0;
      const riskPenalty = row.risk === "high" ? -7 : row.risk === "medium" ? -3 : 0;
      const suggestionScore = round2(baseScore + needBoost + tierBoost + contingencyBoost + waitAdjustment + avoidPenalty + confidencePenalty + riskPenalty);
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
        suggestionType,
        timingAction: timingActionFor(suggestionType, waitPlan?.status ?? null),
        planFit: planPosition?.status ?? null,
        reasons: reasonsFor({ row, need, planPosition, tierRisk: Boolean(tierRisk), contingency: Boolean(contingency), waitPlanStatus: waitPlan?.status ?? null }),
        cautions: cautionsFor(row, avoidPenalty),
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
    input.tierRisk ? `${input.row.position} tier risk is active.` : null,
    input.contingency ? `${input.row.position} contingency is active.` : null,
    input.waitPlanStatus ? `${input.row.position} wait plan status is ${input.waitPlanStatus}.` : null,
  ].filter((reason): reason is string => Boolean(reason));
}

function cautionsFor(row: BlackbirdLeagueRankRow, avoidPenalty: number): string[] {
  return [
    avoidPenalty < 0 ? `${row.position} has avoid-forcing context at this stage.` : null,
    row.confidence === "low" || row.confidence === "very_low" ? `Context confidence is ${row.confidence}.` : null,
    row.risk !== "low" ? `Risk label is ${row.risk}.` : null,
    row.projectedFantasyPoints.unit === "fallback" ? "Projection is fallback-labeled." : null,
  ].filter((caution): caution is string => Boolean(caution));
}

function normalizePosition(position: string): string {
  const normalized = position.trim().toUpperCase();
  return normalized === "DST" || normalized === "D/ST" ? "DEF" : normalized;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
