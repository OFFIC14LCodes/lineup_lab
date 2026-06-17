import path from "node:path";

import { buildBlackbirdBoard, type BlackbirdBoardRow } from "@/lib/draft/blackbird-board";
import type { BlackbirdLeagueContext } from "@/lib/draft/blackbird-contextual-value";
import { buildBlackbirdLeagueRank } from "@/lib/draft/blackbird-league-rank";
import { buildLiveDraftSuggestions } from "@/lib/draft/live-draft-suggestion";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import { buildProjectionTrust } from "@/lib/projections/projection-trust";
import { BLACKBIRD_SCORING_FORMULA_VERSION, normalizeSleeperScoringSettings } from "@/lib/scoring";
import {
  buildPlayerProfileEvidence,
  buildPlayerProfileScoringMetadata,
  createPlayerProfileRepository,
  DEFAULT_PLAYER_PROFILE_SCORING,
  rescoreHistoricalPlayerProfile,
  scoringProfileFromNormalizedSettings,
  toPlayerProfileReadModel,
  type PlayerProfileScoringContext,
} from "@/lib/player-profiles";
import {
  buildProfileEvidenceDiagnostics,
  writeProfileEvidenceDiagnosticsArtifacts,
  type ProfileEvidenceDiagnosticInputRow,
} from "@/lib/player-profiles/player-profile-evidence-diagnostics";
import { getDraftRoomState } from "@/lib/rosterforge/state";
import { createAdminClient } from "@/lib/supabase/admin";

import { arg, loadLocalEnv } from "./h9-projection-hardening-utils";

loadLocalEnv();

type DraftRoomRow = {
  id: string;
  user_id: string;
  league_id: string | null;
};

type BoardScenario = {
  draftRoomId: string | null;
  leagueId: string | null;
  rows: BlackbirdBoardRow[];
  scoringContext: PlayerProfileScoringContext;
  limitations: string[];
};

if (isMainModule()) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

async function main() {
  const draftRoomId = arg("--draft-room-id");
  const { result } = await buildProfileEvidenceDiagnosticResult(draftRoomId);
  const artifacts = writeProfileEvidenceDiagnosticsArtifacts(result);

  console.log("Blackbird Historical Profile Evidence Diagnostics");
  console.log(`  dry run: ${result.dryRun}`);
  console.log(`  read-only: ${result.readOnly}`);
  console.log(`  draft room: ${result.draftRoomId ?? "synthetic"}`);
  console.log(`  league: ${result.leagueId ?? "synthetic"}`);
  console.log(`  players evaluated: ${result.totals.playersEvaluated}`);
  console.log(`  profiles available: ${result.totals.profilesAvailable}`);
  console.log(`  profiles unavailable: ${result.totals.profilesUnavailable}`);
  console.log(`  support count: ${result.totals.profileSupportCount}`);
  console.log(`  caution count: ${result.totals.cautionCount}`);
  console.log(`  hidden value count: ${result.totals.hiddenValueCount}`);
  console.log(`  disagreement count: ${result.totals.disagreementCount}`);
  console.log(`  severity counts: ${JSON.stringify(result.totals.severityCounts)}`);
  console.log("  artifacts:");
  console.log(`    ${relative(artifacts.jsonPath)}`);
  console.log(`    ${relative(artifacts.markdownPath)}`);
  console.log(`    ${relative(artifacts.csvPath)}`);
}

export async function buildProfileEvidenceDiagnosticResult(draftRoomId?: string | null) {
  const scenario = draftRoomId ? await realDraftRoomScenario(draftRoomId) : syntheticScenario();
  const repository = await createPlayerProfileRepository();
  const inputRows: ProfileEvidenceDiagnosticInputRow[] = [];
  for (const boardRow of scenario.rows) {
    const lookup = await lookupProfile(repository, boardRow);
    if (!lookup.profile) {
      const evidence = buildPlayerProfileEvidence({
        profile: null,
        scoring: scenario.scoringContext.metadata,
        unavailableReason: lookup.duplicateKey ? "ambiguous" : repository.status === "ready" ? "profile_not_found" : "artifact_unavailable",
      });
      inputRows.push({ boardRow, profile: null, evidence, matchedBy: lookup.matchedBy, duplicateKey: lookup.duplicateKey });
      continue;
    }

    const scoredProfile = rescoreHistoricalPlayerProfile(lookup.profile, scenario.scoringContext.scoringProfile);
    const readModel = toPlayerProfileReadModel(scoredProfile, { weeklyLimit: 8 });
    const evidence = buildPlayerProfileEvidence({
      profile: readModel,
      scoring: scenario.scoringContext.metadata,
    });
    inputRows.push({ boardRow, profile: readModel, evidence, matchedBy: lookup.matchedBy, duplicateKey: lookup.duplicateKey });
  }

  const result = buildProfileEvidenceDiagnostics({
    draftRoomId: scenario.draftRoomId,
    leagueId: scenario.leagueId,
    rows: inputRows,
    limitations: [
      ...scenario.limitations,
      "Historical profile evidence is observational only and is not included in Blackbird Rank.",
      "Historical profile evidence is observational only and is not included in Draft Suggestion ordering.",
      `Profile artifact status: ${repository.status}.`,
    ],
  });
  return { scenario, result };
}

async function realDraftRoomScenario(draftRoomId: string): Promise<BoardScenario> {
  process.env.ENABLE_H10_WAR_ROOM_OVERLAY = process.env.ENABLE_H10_WAR_ROOM_OVERLAY ?? "true";
  process.env.ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_PREVIEW = process.env.ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_PREVIEW ?? "true";
  process.env.ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_EXPERIMENT = process.env.ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_EXPERIMENT ?? "true";

  const room = await loadDraftRoom(draftRoomId);
  const state = await getDraftRoomState(room.user_id, draftRoomId);
  const league = recordOrNull(state.league);
  const scoringSettings = primitiveRecordOrNull(league?.scoring_settings_json);
  const leagueContext = leagueContextFromState(state);
  const players = mergePlayers(
    mergePlayers(state.blackbirdRankPlayers ?? [], state.draftablePlayers ?? []),
    state.remainingPlayers ?? []
  );
  const board = buildBlackbirdBoard({
    players,
    overlays: state.h10ValueOverlay ?? [],
    recommendations: state.h10RecommendationPreview ?? [],
    draftedPlayerIds: (state.draftedPlayerIds ?? []).filter((id): id is string => typeof id === "string"),
    leagueContext,
    includeDrafted: true,
  });
  const rows = applyLiveSuggestionRanks({
    rows: board.rows,
    players,
    overlays: state.h10ValueOverlay ?? [],
    recommendations: state.h10RecommendationPreview ?? [],
    draftedPlayerIds: (state.draftedPlayerIds ?? []).filter((id): id is string => typeof id === "string"),
    leagueContext,
    positionCounts: state.positionCounts,
    positionNeeds: state.positionNeeds,
    currentPickNumber: state.currentPickNumber,
    picksUntilMyTurn: state.picksUntilMyNextPick,
  });

  return {
    draftRoomId,
    leagueId: room.league_id,
    rows,
    scoringContext: scoringSettings
      ? leagueScoringContext({ source: "draft_room", id: room.league_id ?? draftRoomId, label: league?.name ? `${String(league.name)} scoring` : "Draft room league scoring", settings: scoringSettings })
      : defaultScoringContext("fallback", ["Draft room league scoring settings are missing; using default profile scoring."]),
    limitations: ["Current War Room board state was loaded through getDraftRoomState and existing board/suggestion builders."],
  };
}

function syntheticScenario(): BoardScenario {
  const rows = withFallbackDraftSuggestionRanks([
    boardRow({ playerId: "11638", playerName: "Caleb Williams", position: "QB", team: "CHI", blackbirdBoardRank: 8, draftSuggestionRank: 2, draftSuggestionScore: 85, blackbirdValueScore: 84, projectionPoints: 318, projectionLow: 255, projectionHigh: 375 }),
    boardRow({ playerId: "4034", playerName: "Christian McCaffrey", position: "RB", team: "SF", blackbirdBoardRank: 130, draftSuggestionRank: 88, draftSuggestionScore: 58, blackbirdValueScore: 76, projectionPoints: 205, projectionLow: 150, projectionHigh: 270 }),
    boardRow({ playerId: "6790", playerName: "Jordyn Brooks", position: "LB", team: "MIA", blackbirdBoardRank: 18, draftSuggestionRank: 14, draftSuggestionScore: 78, blackbirdValueScore: 79, projectionPoints: 245, projectionLow: 185, projectionHigh: 290 }),
    boardRow({ playerId: null, playerName: "Will Anderson", position: "DL", team: "HOU", blackbirdBoardRank: 42, draftSuggestionRank: 38, draftSuggestionScore: 68, blackbirdValueScore: 72, projectionPoints: 180, projectionLow: 120, projectionHigh: 230 }),
    boardRow({ playerId: "missing", playerName: "Missing Test Player", position: "WR", team: "FA", blackbirdBoardRank: 120, draftSuggestionRank: 110, draftSuggestionScore: 40, blackbirdValueScore: 42, projectionPoints: null, projectionLow: null, projectionHigh: null }),
  ]);
  return {
    draftRoomId: null,
    leagueId: null,
    rows,
    scoringContext: defaultScoringContext("default", []),
    limitations: [
      "No --draft-room-id was provided, so the diagnostic used a synthetic board with real player names for artifact-backed profile lookup.",
      "Run with --draft-room-id=<id> to compare against the current War Room board state.",
    ],
  };
}

function applyLiveSuggestionRanks(input: {
  rows: BlackbirdBoardRow[];
  players: ScoredDraftTarget[];
  overlays: WarRoomValueOverlayRow[];
  recommendations: Parameters<typeof buildBlackbirdBoard>[0]["recommendations"];
  draftedPlayerIds: string[];
  leagueContext: BlackbirdLeagueContext;
  positionCounts?: Record<string, number>;
  positionNeeds?: Parameters<typeof buildLiveDraftSuggestions>[0]["positionNeeds"];
  currentPickNumber?: number | null;
  picksUntilMyTurn?: number | null;
}): BlackbirdBoardRow[] {
  const leagueRank = buildBlackbirdLeagueRank({
    players: input.players,
    overlays: input.overlays,
    recommendations: input.recommendations,
    draftedPlayerIds: input.draftedPlayerIds,
    leagueContext: input.leagueContext,
  });
  const suggestions = buildLiveDraftSuggestions({
    leagueRankRows: leagueRank.rows,
    draftedPlayerIds: input.draftedPlayerIds,
    positionCounts: input.positionCounts,
    positionNeeds: input.positionNeeds,
    currentPickNumber: input.currentPickNumber,
    picksUntilMyTurn: input.picksUntilMyTurn,
  });
  const suggestionById = new Map(suggestions.rows.map((row) => [row.playerId, row]));
  return withFallbackDraftSuggestionRanks(input.rows.map((row) => {
    const suggestion = row.playerId ? suggestionById.get(row.playerId) : undefined;
    return suggestion
      ? {
          ...row,
          draftSuggestionRank: suggestion.draftSuggestionRank,
          draftSuggestionScore: suggestion.suggestionScore,
          draftSuggestionType: suggestion.suggestionType,
          needTimingAction: suggestion.timingAction,
        }
      : row;
  }));
}

async function lookupProfile(repository: Awaited<ReturnType<typeof createPlayerProfileRepository>>, row: BlackbirdBoardRow) {
  if (row.playerId) {
    const byId = await repository.lookupProfile({ playerId: row.playerId, position: row.position });
    if (byId.profile || byId.duplicateKey) return byId;
  }
  if (row.playerName && row.position) {
    const byName = await repository.lookupProfile({ normalizedName: row.playerName, position: row.position });
    if (byName.profile || byName.duplicateKey) return byName;
  }
  return { profile: null, matchedBy: null, duplicateKey: null };
}

async function loadDraftRoom(draftRoomId: string): Promise<DraftRoomRow> {
  const { data, error } = await createAdminClient()
    .from("draft_rooms")
    .select("id,user_id,league_id")
    .eq("id", draftRoomId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Draft room not found: ${draftRoomId}`);
  return data as DraftRoomRow;
}

function leagueScoringContext(input: {
  source: "draft_room" | "league";
  id: string;
  label: string;
  settings: Record<string, unknown>;
}): PlayerProfileScoringContext {
  const normalized = normalizeSleeperScoringSettings(input.settings);
  const scoringProfile = scoringProfileFromNormalizedSettings({
    id: `${input.source}:${input.id}`,
    label: input.label,
    version: BLACKBIRD_SCORING_FORMULA_VERSION,
    scoringSettings: normalized,
    notes: ["Historical profile points are recalculated at diagnostic read time from preserved raw stat fields."],
  });
  return {
    scoringProfile,
    metadata: buildPlayerProfileScoringMetadata({
      scoringSource: input.source,
      scoringProfile,
      warnings: normalized.invalidKeys.length
        ? [`${normalized.invalidKeys.length} invalid league scoring setting(s) were ignored.`]
        : [],
    }),
  };
}

function defaultScoringContext(source: "default" | "fallback", warnings: string[]): PlayerProfileScoringContext {
  return {
    scoringProfile: DEFAULT_PLAYER_PROFILE_SCORING,
    metadata: buildPlayerProfileScoringMetadata({
      scoringSource: source,
      scoringProfile: DEFAULT_PLAYER_PROFILE_SCORING,
      warnings,
    }),
  };
}

function leagueContextFromState(state: Awaited<ReturnType<typeof getDraftRoomState>>): BlackbirdLeagueContext {
  const league = recordOrNull(state.league);
  const scoringSettings = primitiveRecordOrNull(league?.scoring_settings_json);
  return {
    isDynasty: Boolean(league?.is_dynasty),
    isBestBall: Boolean(league?.is_best_ball),
    isSuperflex: Boolean(league?.is_superflex),
    isTwoQb: Boolean(league?.is_two_qb),
    tePremium: Number(league?.te_premium ?? 0),
    hasIDP: Boolean(state.hasIDP),
    hasKicker: Boolean(state.hasKicker),
    hasTeamDefense: Boolean(state.hasTeamDefense),
    rosterPositions: Array.isArray(league?.roster_positions_json) ? league.roster_positions_json.filter((slot): slot is string => typeof slot === "string") : [],
    scoringSettings,
  };
}

function mergePlayers(left: ScoredDraftTarget[], right: ScoredDraftTarget[]): ScoredDraftTarget[] {
  const merged: ScoredDraftTarget[] = [];
  const seen = new Set<string>();
  for (const [source, players] of [["left", left], ["right", right]] as const) {
    players.forEach((player, index) => {
      const keys = playerKeys(player, `${source}:${index}`);
      if (keys.some((key) => seen.has(key))) return;
      merged.push(player);
      keys.forEach((key) => seen.add(key));
    });
  }
  return merged;
}

function playerKeys(player: ScoredDraftTarget, fallback: string): string[] {
  const keys = [player.matched_player_id, player.sleeper_player_id]
    .filter((value): value is string => Boolean(value))
    .map((value) => `id:${value}`);
  const nameKey = [player.player_name, player.position, player.team].map((value) => value?.trim().toLowerCase() ?? "").join("|");
  if (nameKey.replaceAll("|", "")) keys.push(`name:${nameKey}`);
  return keys.length ? keys : [`fallback:${fallback}`];
}

function withFallbackDraftSuggestionRanks(rows: BlackbirdBoardRow[]): BlackbirdBoardRow[] {
  const rankedRows = rows
    .filter((row) => !row.drafted && row.draftSuggestionRank !== null)
    .sort((a, b) => (a.draftSuggestionRank ?? 999999) - (b.draftSuggestionRank ?? 999999));
  const fallbackRows = rows
    .filter((row) => !row.drafted && row.draftSuggestionRank === null)
    .sort((a, b) => a.blackbirdBoardRank - b.blackbirdBoardRank || a.playerName.localeCompare(b.playerName));
  const fallbackRankByKey = new Map<string, number>();
  fallbackRows.forEach((row, index) => {
    fallbackRankByKey.set(boardRowKey(row), rankedRows.length + index + 1);
  });

  return rows.map((row) => {
    const fallbackRank = fallbackRankByKey.get(boardRowKey(row));
    if (!fallbackRank) return row;
    return {
      ...row,
      draftSuggestionRank: fallbackRank,
      draftSuggestionScore: row.blackbirdValueScore,
      draftSuggestionType: row.dataStatus.projection === "unavailable" ? "insufficient_data" : "value",
      needTimingAction: row.needTimingAction ?? "value available",
    };
  });
}

function boardRow(overrides: Partial<BlackbirdBoardRow>): BlackbirdBoardRow {
  const row = {
    blackbirdBoardRank: 1,
    draftSuggestionRank: null,
    draftSuggestionScore: null,
    draftSuggestionType: null,
    playerId: null,
    playerName: "Player",
    position: "RB",
    team: null,
    blackbirdValueScore: null,
    projectionPoints: null,
    projectionLow: null,
    projectionHigh: null,
    projectionUnit: "season",
    projectionSource: "synthetic_diagnostic",
    projectionTrust: buildProjectionTrust({
      playerId: overrides.playerId ?? null,
      playerName: overrides.playerName ?? "Player",
      position: overrides.position ?? "RB",
      team: overrides.team ?? null,
      projectionSource: "comprehensive_stat_projection",
      projectionUnit: "season",
      floorPoints: overrides.projectionLow ?? null,
      medianPoints: overrides.projectionPoints ?? null,
      ceilingPoints: overrides.projectionHigh ?? null,
      dataGaps: [],
    }),
    role: null,
    roleConfidence: null,
    replacementMedianPoints: null,
    replacementRank: null,
    pointsAboveReplacement: null,
    adp: null,
    marketRank: null,
    rankDelta: null,
    confidence: "medium",
    risk: "low",
    blackbirdTier: null,
    valueScoreComponents: null,
    contextualReasons: [],
    contextualDataGaps: [],
    planFit: "insufficient_data",
    planFitReasons: [],
    needTimingAction: null,
    waitPlanTargetCount: null,
    drafted: false,
    dataStatus: { projection: "available", adp: "unavailable", marketRank: "available", h10: "unavailable", ordering: "blackbird" },
    source: {
      h10RecommendationRank: null,
      h10RecommendationScore: null,
      draftTargetScore: null,
      originalIndex: 0,
      player: {} as ScoredDraftTarget,
      overlay: null,
      recommendation: null,
      leagueRank: null,
    },
    ...overrides,
  } satisfies BlackbirdBoardRow;
  return row;
}

function boardRowKey(row: BlackbirdBoardRow): string {
  return `${row.playerId ?? ""}|${row.playerName}|${row.position ?? ""}|${row.team ?? ""}`;
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function primitiveRecordOrNull(value: unknown): Record<string, string | number | boolean | null> | null {
  const record = recordOrNull(value);
  if (!record) return null;
  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of Object.entries(record)) {
    if (item === null || typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      output[key] = item;
    }
  }
  return output;
}

function relative(filePath: string) {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}

function isMainModule() {
  const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
  return entry === path.resolve(__filename);
}
