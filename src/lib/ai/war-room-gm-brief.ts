import type { WarRoomAiBoardPlayer, WarRoomAiContext, WarRoomAiNeed } from "./war-room-ai-context-types";
import type { WarRoomGmBrief } from "./war-room-gm-brief-types";

const MAX_WATCH_ITEMS = 5;
const MAX_DATA_GAPS = 5;

export function buildWarRoomGmBrief(context: WarRoomAiContext | null | undefined): WarRoomGmBrief {
  if (!context) return emptyBrief();

  const topSuggestion = context.topPlayers.draftSuggestions[0] ?? null;
  const needs = prioritizedNeeds(context.rosterConstructionSummary.teamNeeds);
  const scarcityRows = context.positionScarcitySummary.filter((row) => row.summary.trim());
  const dataGaps = collectDataGaps(context);
  const watchList = buildWatchList(context, topSuggestion, needs, scarcityRows);

  return {
    headline: buildHeadline(context, topSuggestion),
    draftStateSummary: buildDraftStateSummary(context),
    rosterNeedSummary: buildRosterNeedSummary(needs),
    topRecommendationSummary: buildTopRecommendationSummary(topSuggestion),
    scarcitySummary: buildScarcitySummary(scarcityRows),
    riskSummary: buildRiskSummary(context),
    watchList,
    dataGaps,
    safety: safetyFlags(),
  };
}

function emptyBrief(): WarRoomGmBrief {
  return {
    headline: "Brief will appear once draft context is available.",
    draftStateSummary: "Draft context is not loaded yet.",
    rosterNeedSummary: "Roster needs are not available yet.",
    topRecommendationSummary: "Top suggestion is not available yet.",
    scarcitySummary: "Scarcity context is not available yet.",
    riskSummary: "Risk context is not available yet.",
    watchList: [],
    dataGaps: [],
    safety: safetyFlags(),
  };
}

function buildHeadline(context: WarRoomAiContext, topSuggestion: WarRoomAiBoardPlayer | null): string {
  const pick = context.draftState.currentPickNumber;
  const round = context.draftState.currentRound;
  if (!topSuggestion) return `Pick ${pick}, round ${round}: waiting for draft suggestions.`;
  return `Pick ${pick}, round ${round}: ${topSuggestion.playerName} is the current top draft suggestion.`;
}

function buildDraftStateSummary(context: WarRoomAiContext): string {
  const pieces = [`You are on pick ${context.draftState.currentPickNumber} in round ${context.draftState.currentRound}.`];
  if (context.draftState.picksUntilMyNextPick !== null && context.draftState.picksUntilMyNextPick !== undefined) {
    pieces.push(`${context.draftState.picksUntilMyNextPick} picks until your next turn.`);
  }
  if (context.draftState.teamCount) pieces.push(`${context.draftState.teamCount} teams in the room.`);
  if (context.liveState.status === "stale" || context.liveState.status === "error") {
    pieces.push("Freshness warning: suggestions may be based on stale draft state.");
  } else if (context.liveState.status === "watch") {
    pieces.push("Freshness watch: confirm sync before tight timing calls.");
  }
  return pieces.join(" ");
}

function buildRosterNeedSummary(needs: WarRoomAiNeed[]): string {
  if (!needs.length) return "No urgent roster need is available from the current context.";
  const topNeeds = needs.slice(0, 3).map((need) => need.label ?? need.position).join(", ");
  return `Strongest current needs appear to be ${topNeeds}.`;
}

function buildTopRecommendationSummary(topSuggestion: WarRoomAiBoardPlayer | null): string {
  if (!topSuggestion) return "No top draft suggestion is available yet.";
  const details = [
    topSuggestion.position ? `${topSuggestion.position}${topSuggestion.team ? `, ${topSuggestion.team}` : ""}` : null,
    topSuggestion.valueScore !== null && topSuggestion.valueScore !== undefined ? `value ${formatNumber(topSuggestion.valueScore)}` : null,
    topSuggestion.projection !== null && topSuggestion.projection !== undefined ? `projection ${formatNumber(topSuggestion.projection)}` : null,
    topSuggestion.confidence ? `${topSuggestion.confidence} confidence` : null,
  ].filter((value): value is string => Boolean(value));
  const reason = topSuggestion.reasons?.[0] ? ` Reason: ${topSuggestion.reasons[0]}.` : "";
  return `Top suggestion: ${topSuggestion.playerName}${details.length ? ` (${details.join("; ")})` : ""}.${reason}`;
}

function buildScarcitySummary(rows: WarRoomAiContext["positionScarcitySummary"]): string {
  if (!rows.length) return "No position scarcity warning is active from the current context.";
  const primary = rows[0];
  return `${primary.position} scarcity: ${primary.summary}${primary.risk ? ` (${primary.risk} risk)` : ""}.`;
}

function buildRiskSummary(context: WarRoomAiContext): string {
  const liveWarnings = context.liveState.warnings.filter(Boolean);
  const risks = context.riskConfidenceContext.riskSummary.filter(Boolean);
  const confidence = context.riskConfidenceContext.confidenceSummary.filter(Boolean);
  if (!liveWarnings.length && !risks.length && !confidence.length) return "No major risk or confidence notes are available from the current context.";
  return [...liveWarnings.slice(0, 1), ...risks.slice(0, 2), ...confidence.slice(0, 1)].join(" ");
}

function buildWatchList(
  context: WarRoomAiContext,
  topSuggestion: WarRoomAiBoardPlayer | null,
  needs: WarRoomAiNeed[],
  scarcityRows: WarRoomAiContext["positionScarcitySummary"]
): string[] {
  const items = [
    topSuggestion ? `Monitor ${topSuggestion.playerName} as the current top suggestion.` : null,
    ...needs.slice(0, 2).map((need) => `Track ${need.label ?? need.position} need before your next turn.`),
    ...scarcityRows.slice(0, 2).map((row) => `Watch ${row.position} scarcity: ${row.summary}.`),
    ...context.liveState.warnings.slice(0, 1).map((warning) => `Sync status: ${warning}`),
    ...context.recentPicks.slice(0, 1).map((pick) => `Recent pick context: ${pick.playerName ?? "Unknown player"} at pick ${pick.pickNo}.`),
  ].filter((item): item is string => Boolean(item));
  return dedupe(items).slice(0, MAX_WATCH_ITEMS);
}

function collectDataGaps(context: WarRoomAiContext): string[] {
  const gapCounts = new Map<string, number>();
  for (const row of [
    ...context.topPlayers.draftSuggestions,
    ...context.topPlayers.availableBlackbirdRank,
  ]) {
    for (const gap of row.dataGaps ?? []) {
      if (!gap || gap.toLowerCase() === "none") continue;
      gapCounts.set(gap, (gapCounts.get(gap) ?? 0) + 1);
    }
  }
  return Array.from(gapCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([gap, count]) => `${gap} unavailable for ${count} top player${count === 1 ? "" : "s"}`)
    .slice(0, MAX_DATA_GAPS);
}

function prioritizedNeeds(needs: WarRoomAiNeed[]): WarRoomAiNeed[] {
  const scoreByLevel: Record<string, number> = {
    urgent: 0,
    high: 1,
    moderate: 2,
    low: 3,
    filled: 4,
    not_used: 5,
  };
  return needs
    .slice()
    .filter((need) => !["filled", "not_used"].includes(need.needLevel ?? ""))
    .sort((a, b) => {
      const levelDiff = (scoreByLevel[a.needLevel ?? ""] ?? 9) - (scoreByLevel[b.needLevel ?? ""] ?? 9);
      if (levelDiff !== 0) return levelDiff;
      return (b.need ?? 0) - (a.need ?? 0) || a.position.localeCompare(b.position);
    });
}

function safetyFlags(): WarRoomGmBrief["safety"] {
  return {
    deterministic: true,
    aiApiCalls: false,
    mutatesDraftState: false,
    changesRankings: false,
  };
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function formatNumber(value: number): string {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
}
