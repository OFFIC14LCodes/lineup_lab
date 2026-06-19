import type { WarRoomAiBoardPlayer, WarRoomAiContext, WarRoomAiContextInput, WarRoomAiNeed, WarRoomAiPick } from "./war-room-ai-context-types";

const DEFAULT_TOP_N = 10;

export function buildWarRoomAiContext(input: WarRoomAiContextInput): WarRoomAiContext {
  const topN = clampTopN(input.topN);
  const scoringSettings = input.league?.scoringSettings ?? {};
  const formatFlags = [
    input.league?.isDynasty ? "dynasty" : "redraft",
    input.league?.isBestBall ? "best_ball" : null,
    input.league?.isSuperflex ? "superflex" : null,
    input.league?.isTwoQb ? "two_qb" : null,
    input.league?.tePremium ? `te_premium_${input.league.tePremium}` : null,
  ].filter((flag): flag is string => Boolean(flag));

  return {
    contextVersion: "war_room_ai_context_v1",
    readOnly: true,
    deterministic: true,
    canMutateDraft: false,
    draftRoomId: input.draftRoomId,
    leagueId: input.leagueId ?? null,
    leagueSettingsSummary: {
      name: input.league?.name ?? null,
      formatFlags,
      rosterPositions: [...(input.league?.rosterPositions ?? [])],
    },
    scoringSummary: {
      scoringKeys: Object.keys(scoringSettings).sort(),
      notableScoring: notableScoring(scoringSettings),
    },
    draftState: { ...input.draftState },
    rosterConstructionSummary: {
      positionCounts: { ...(input.rosterConstruction?.positionCounts ?? {}) },
      teamNeeds: cloneNeeds(input.rosterConstruction?.needs ?? []),
      planSummaries: [...(input.rosterConstruction?.planSummaries ?? [])],
    },
    userRosterSoFar: clonePicks(input.myRoster ?? []),
    recentPicks: clonePicks(input.recentPicks ?? []),
    topPlayers: {
      draftSuggestions: topPlayers(input.draftSuggestions ?? [], topN, "draftSuggestionRank"),
      fullBlackbirdRank: topPlayers(input.fullBlackbirdRank ?? [], topN, "blackbirdRank"),
      availableBlackbirdRank: topPlayers(input.availableBlackbirdRank ?? [], topN, "blackbirdRank"),
    },
    positionScarcitySummary: (input.positionScarcity ?? []).map((row) => ({
      position: row.position,
      summary: row.summary,
      risk: row.risk ?? null,
    })),
    liveState: {
      status: input.liveState?.status ?? "unknown",
      lastUpdatedAt: input.liveState?.lastUpdatedAt ?? null,
      secondsSinceUpdate: input.liveState?.secondsSinceUpdate ?? null,
      warnings: [...(input.liveState?.warnings ?? [])],
    },
    riskConfidenceContext: {
      riskSummary: [...(input.riskSummary ?? [])],
      confidenceSummary: [...(input.confidenceSummary ?? [])],
    },
    marketAnchorPreview: {
      marketAnchorPreviewEnabled: Boolean(input.marketAnchorPreview?.enabled),
      marketAnchorSource: input.marketAnchorPreview?.enabled ? input.marketAnchorPreview.source ?? null : null,
      marketAnchorMatchQuality: input.marketAnchorPreview?.enabled ? input.marketAnchorPreview.matchQuality ?? null : null,
      marketAnchorWarnings: input.marketAnchorPreview?.enabled ? [...(input.marketAnchorPreview.warnings ?? [])] : [],
    },
    safety: {
      noAiApiCalls: true,
      noSupabaseWrites: true,
      noRankingMutation: true,
      noDraftSuggestionMutation: true,
    },
  };
}

function topPlayers(rows: WarRoomAiBoardPlayer[], topN: number, rankKey: "draftSuggestionRank" | "blackbirdRank"): WarRoomAiBoardPlayer[] {
  return rows
    .slice()
    .sort((a, b) => {
      const rankA = rankKey === "draftSuggestionRank" ? a.draftSuggestionRank : a.blackbirdRank;
      const rankB = rankKey === "draftSuggestionRank" ? b.draftSuggestionRank : b.blackbirdRank;
      return (rankA ?? 999999) - (rankB ?? 999999) || a.playerName.localeCompare(b.playerName) || (a.playerId ?? "").localeCompare(b.playerId ?? "");
    })
    .slice(0, topN)
    .map(clonePlayer);
}

function clonePlayer(player: WarRoomAiBoardPlayer): WarRoomAiBoardPlayer {
  return {
    playerId: player.playerId ?? null,
    playerName: player.playerName,
    position: player.position ?? null,
    team: player.team ?? null,
    draftSuggestionRank: player.draftSuggestionRank ?? null,
    blackbirdRank: player.blackbirdRank ?? null,
    valueScore: player.valueScore ?? null,
    projection: player.projection ?? null,
    floor: player.floor ?? null,
    ceiling: player.ceiling ?? null,
    confidence: player.confidence ?? null,
    risk: player.risk ?? null,
    timingAction: player.timingAction ?? null,
    reasons: [...(player.reasons ?? [])],
    dataGaps: [...(player.dataGaps ?? [])],
    drafted: Boolean(player.drafted),
  };
}

function clonePicks(picks: WarRoomAiPick[]): WarRoomAiPick[] {
  return picks.map((pick) => ({ ...pick }));
}

function cloneNeeds(needs: WarRoomAiNeed[]): WarRoomAiNeed[] {
  return needs.map((need) => ({ ...need }));
}

function clampTopN(topN: number | null | undefined): number {
  if (!Number.isFinite(topN ?? NaN)) return DEFAULT_TOP_N;
  return Math.max(1, Math.min(25, Math.floor(topN as number)));
}

function notableScoring(scoringSettings: Record<string, number | string | boolean | null>): string[] {
  const entries = Object.entries(scoringSettings)
    .filter(([, value]) => typeof value === "number" && value !== 0)
    .sort(([a], [b]) => a.localeCompare(b));
  const notableKeys = ["pass_td", "rec", "rec_yd", "rush_yd", "sack", "idp_sack", "solo_tkl", "idp_tkl_solo", "fgm", "xpm"];
  return entries
    .filter(([key]) => notableKeys.includes(key))
    .map(([key, value]) => `${key}: ${value}`)
    .slice(0, 12);
}
