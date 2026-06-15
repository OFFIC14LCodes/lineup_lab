import {
  buildPreDraftStrategy,
  validateStrategyLanguage,
  type PreDraftStrategyOutput,
} from "@/lib/draft/pre-draft-strategy";
import { compactRecommendationRow, type H10WarRoomCompactRecommendation } from "@/lib/draft/war-room-recommendation-validation";
import type { WarRoomRecommendationRow } from "@/lib/draft/war-room-recommendations";
import { getDraftRoomState } from "@/lib/rosterforge/state";

export type PreDraftStrategyEndpointResponse = Omit<PreDraftStrategyOutput, "dataAvailabilityAudit"> & {
  dataGaps: string[];
  safetyLanguageStatus: {
    passed: boolean;
    failures: string[];
  };
  dataAvailabilityAudit: PreDraftStrategyOutput["dataAvailabilityAudit"];
  endpointMetadata: {
    draftRoomId: string;
    leagueId: string;
    readOnly: true;
    persistedStrategy: false;
    source: "live_draft_room_state";
  };
};

type DraftRoomState = Awaited<ReturnType<typeof getDraftRoomState>>;

export class PreDraftStrategyAccessError extends Error {
  constructor(message = "Draft room not found.") {
    super(message);
    this.name = "PreDraftStrategyAccessError";
  }
}

export async function getPreDraftStrategyEndpointResponse(
  userId: string,
  draftRoomId: string
): Promise<PreDraftStrategyEndpointResponse> {
  try {
    return buildPreDraftStrategyEndpointResponse(await getDraftRoomState(userId, draftRoomId));
  } catch (error) {
    if (isDraftRoomAccessError(error)) throw new PreDraftStrategyAccessError();
    throw error;
  }
}

export function buildPreDraftStrategyEndpointResponse(state: DraftRoomState): PreDraftStrategyEndpointResponse {
  const league = state.league && typeof state.league === "object" ? (state.league as Record<string, unknown>) : {};
  const room = state.room && typeof state.room === "object" ? (state.room as Record<string, unknown>) : {};
  const rosterSlots = stringArray(league.roster_positions_json);
  const scoringSettings = recordOrNull(league.scoring_settings_json);
  const recommendations = compactH10Recommendations(state.h10RecommendationPreview);
  const roundCount = readPositiveInt(room.settings_json, "rounds") ?? (rosterSlots.length > 0 ? rosterSlots.length : null);
  const strategy = buildPreDraftStrategy({
    room: {
      draftRoomId: String(room.id ?? ""),
      leagueId: String(room.league_id ?? ""),
      leagueName: typeof league.name === "string" ? league.name : null,
      season: typeof league.season === "string" || typeof league.season === "number" ? league.season : null,
      positions_present: uniquePositions([
        ...stringArray(state.remainingPlayers?.map((player) => player.position)),
        ...Object.keys(state.h10RecommendationDiagnostics?.rowsByPosition ?? {}),
      ]),
      hasIDP: Boolean(state.hasIDP),
      hasKicker: Boolean(state.hasKicker),
      hasTeamDefense: Boolean(state.hasTeamDefense),
      isSuperflex: Boolean(league.is_superflex),
      is2QB: Boolean(league.is_two_qb),
      isTEPremium: Number(league.te_premium ?? 0) > 0,
      benchDepth: Number(state.rosterRequirements?.benchCount ?? 0),
      currentPickKnown: typeof state.currentPickNumber === "number",
      picksUntilMyNextPickKnown: typeof state.picksUntilMyNextPick === "number",
      remaining_player_count: state.remainingPlayers?.length ?? 0,
    },
    roomResult: {
      formats: [],
      rowsByPosition: state.h10RecommendationDiagnostics?.rowsByPosition ?? {},
      contextLimitations: state.h10RecommendationDiagnostics?.contextLimitations ?? [],
      topRecommendations: recommendations.slice(0, 15),
      watchlistExamples: recommendations.filter((row) => row.recommendationTier === "watchlist").slice(0, 10),
    },
    rosterSlots,
    scoringSettings,
    draftSlot: state.myDraftSlot,
    teamCount: state.teamCount,
    rounds: roundCount,
  });
  const dataGaps = buildDataGaps(strategy, state);
  const languageFailures = validateStrategyLanguage(strategy);
  return {
    ...strategy,
    dataGaps,
    safetyLanguageStatus: {
      passed: languageFailures.length === 0,
      failures: languageFailures,
    },
    endpointMetadata: {
      draftRoomId: strategy.leagueSummary.draftRoomId,
      leagueId: strategy.leagueSummary.leagueId,
      readOnly: true,
      persistedStrategy: false,
      source: "live_draft_room_state",
    },
  };
}

function compactH10Recommendations(rows: WarRoomRecommendationRow[] | undefined): H10WarRoomCompactRecommendation[] {
  return (rows ?? []).map(compactRecommendationRow);
}

function buildDataGaps(strategy: PreDraftStrategyOutput, state: DraftRoomState): string[] {
  const gaps = Object.entries(strategy.dataAvailabilityAudit)
    .filter(([key]) => key !== "notes")
    .filter(([, status]) => status === "missing" || status === "partial")
    .map(([key, status]) => `${key}: ${status}`);
  if (!state.myDraftSlot) gaps.push("missing draft slot");
  if (!state.teamCount) gaps.push("missing team count");
  if (!recordOrNull((state.league as Record<string, unknown> | null | undefined)?.scoring_settings_json)) {
    gaps.push("missing raw scoring settings");
  }
  if (!state.h10RecommendationPreview?.length) gaps.push("missing H10 timing rows");
  if (!state.remainingPlayers?.length) gaps.push("missing remaining player/projection rows");
  for (const warning of state.warnings ?? []) gaps.push(`state warning: ${warning}`);
  return Array.from(new Set(gaps)).sort();
}

function isDraftRoomAccessError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("draft room not found") || message.includes("row not found") || message.includes("no rows");
}

function readPositiveInt(settings: unknown, key: string): number | null {
  if (!settings || typeof settings !== "object") return null;
  const value = Number((settings as Record<string, unknown>)[key]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function recordOrNull(value: unknown): Record<string, number | string | boolean | null> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, number | string | boolean | null>)
    : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function uniquePositions(positions: string[]): string[] {
  return Array.from(new Set(positions.map(normalizePosition).filter(Boolean))).sort();
}

function normalizePosition(position: string | null | undefined): string {
  const normalized = (position ?? "").trim().toUpperCase();
  if (normalized === "DST" || normalized === "D/ST") return "DEF";
  return normalized;
}
