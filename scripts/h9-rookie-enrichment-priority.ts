import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";

import { buildBlackbirdBoard } from "@/lib/draft/blackbird-board";
import { buildBlackbirdLeagueRank } from "@/lib/draft/blackbird-league-rank";
import { buildLiveDraftSuggestions } from "@/lib/draft/live-draft-suggestion";
import { buildLivePlanStatus } from "@/lib/draft/live-plan-status";
import { getDraftRoomState } from "@/lib/rosterforge/state";
import { loadRookieData } from "@/lib/projections/rookie-data-loader";
import {
  buildPriorityExportRows,
  buildRookieEnrichmentPriorityRows,
  buildRookieEnrichmentTemplateRows,
  ROOKIE_ENRICHMENT_PRIORITY_COLUMNS,
  ROOKIE_ENRICHMENT_TEMPLATE_COLUMNS,
  serializeCsv,
} from "@/lib/projections/rookie-enrichment-workflow";
import { arg, countBy, loadLocalEnv, readHardeningArtifacts, topEntries, writeDiagnostic } from "./h9-projection-hardening-utils";

loadLocalEnv();

const DATA_DIR = path.join(process.cwd(), "data", "rookies");
const TEMPLATE_PATH = path.join(DATA_DIR, "rookie-enrichment.csv");
const PRIORITY_PATH = path.join(DATA_DIR, "rookie-enrichment-priority.csv");
const draftRoomId = arg("--draft-room-id");
const authUserId = process.env.BLACKBIRD_E2E_AUTH_USER_ID ?? process.env.SCORING_VALIDATION_OPERATOR_USER_ID;

main().catch((error) => {
  const artifact = {
    generatedAt: new Date().toISOString(),
    draftRoomId,
    verdict: "blocked",
    failureReasons: [error instanceof Error ? error.message : String(error)],
  };
  writeDiagnostic("h9-rookie-enrichment-priority", artifact);
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const artifacts = readHardeningArtifacts();
  const projectionRows = artifacts.projections?.projections ?? [];
  const loadResult = loadRookieData({
    candidates: projectionRows.map((row) => ({ id: row.playerId, full_name: row.playerName, position: row.position, team: row.team ?? null })),
    dryRun: true,
    useExampleWhenMissing: false,
  });
  ensureTemplateFile(loadResult);
  const roomContext = draftRoomId ? await loadRoomContext(draftRoomId).catch((error) => ({ error: error instanceof Error ? error.message : String(error) })) : null;
  const priorityRows = buildRookieEnrichmentPriorityRows({
    rookieRows: loadResult.rows,
    blackbirdRanksByPlayerId: roomContext && "blackbirdRanks" in roomContext ? roomContext.blackbirdRanks : new Map(),
    draftSuggestionRanksByPlayerId: roomContext && "draftSuggestionRanks" in roomContext ? roomContext.draftSuggestionRanks : new Map(),
    projectionTrustByPlayerId: new Map(loadResult.rows.map((row) => [row.matchedPlayerId ?? row.profile.playerId, row.profile.rookieProjectionConfidence])),
    realRoomPlayerIds: roomContext && "realRoomPlayerIds" in roomContext ? roomContext.realRoomPlayerIds : new Set(),
    scarcePositions: roomContext && "scarcePositions" in roomContext ? roomContext.scarcePositions : new Set(["QB", "RB", "WR", "TE", "DL", "LB", "DB"]),
  });
  ensurePriorityFile(priorityRows, loadResult);
  const tierCounts = countBy(priorityRows.map((row) => row.priorityTier));
  const artifact = {
    generatedAt: new Date().toISOString(),
    draftRoomId: draftRoomId ?? null,
    verdict: loadResult.validRows > 0 && priorityRows.length > 0 ? "passed" : "failed",
    files: {
      templatePath: TEMPLATE_PATH,
      templateCreatedOrExists: existsSync(TEMPLATE_PATH),
      priorityPath: PRIORITY_PATH,
      priorityCreatedOrExists: existsSync(PRIORITY_PATH),
    },
    roomContext: roomContext && "error" in roomContext ? { loaded: false, error: roomContext.error } : roomContext ? {
      loaded: true,
      realRoomPlayerIds: roomContext.realRoomPlayerIds.size,
      boardRows: roomContext.boardRows,
      suggestionRows: roomContext.suggestionRows,
      scarcePositions: Array.from(roomContext.scarcePositions).sort(),
    } : { loaded: false, reason: "no draft room id supplied" },
    counts: {
      totalRookies: priorityRows.length,
      criticalPriorityRookies: tierCounts.critical ?? 0,
      highPriorityRookies: tierCounts.high ?? 0,
      mediumPriorityRookies: tierCounts.medium ?? 0,
      lowPriorityRookies: tierCounts.low ?? 0,
      priorityExportRows: buildPriorityExportRows(priorityRows, loadResult.rows).length,
    },
    top25PriorityRookies: priorityRows.slice(0, 25),
    topPriorityRookiesByPosition: Object.fromEntries(
      Array.from(new Set(priorityRows.map((row) => row.position))).sort().map((position) => [position, priorityRows.filter((row) => row.position === position).slice(0, 10)])
    ),
    priorityRookiesInRealDraftRoom: priorityRows.filter((row) => roomContext && "realRoomPlayerIds" in roomContext && roomContext.realRoomPlayerIds.has(row.playerId)).slice(0, 50),
    missingFieldsByPriorityGroup: Object.fromEntries(
      ["critical", "high", "medium", "low"].map((tier) => [tier, topEntries(countBy(priorityRows.filter((row) => row.priorityTier === tier).flatMap((row) => row.missingFields)))])
    ),
    safety: {
      noAdpPriorityInput: true,
      noAdpProjectionFallback: true,
      noScraping: true,
      noPaidApi: true,
      noFabricatedDraftCapital: true,
      noFabricatedCollegeProduction: true,
      noFabricatedLandingSpotRole: true,
      noDraftStateMutation: true,
    },
  };
  writeDiagnostic("h9-rookie-enrichment-priority", artifact);
  console.log(JSON.stringify({
    verdict: artifact.verdict,
    artifact: "artifacts/projections/h9-rookie-enrichment-priority.json",
    counts: artifact.counts,
    files: artifact.files,
  }, null, 2));
  if (artifact.verdict !== "passed") process.exitCode = 1;
}

function ensureTemplateFile(loadResult: ReturnType<typeof loadRookieData>) {
  mkdirSync(DATA_DIR, { recursive: true });
  if (existsSync(TEMPLATE_PATH)) return;
  writeFileSync(TEMPLATE_PATH, serializeCsv(buildRookieEnrichmentTemplateRows(loadResult), ROOKIE_ENRICHMENT_TEMPLATE_COLUMNS));
}

function ensurePriorityFile(priorityRows: ReturnType<typeof buildRookieEnrichmentPriorityRows>, loadResult: ReturnType<typeof loadRookieData>) {
  mkdirSync(DATA_DIR, { recursive: true });
  if (existsSync(PRIORITY_PATH) && priorityFileHasFilledInputs(PRIORITY_PATH)) return;
  writeFileSync(PRIORITY_PATH, serializeCsv(buildPriorityExportRows(priorityRows, loadResult.rows), ROOKIE_ENRICHMENT_PRIORITY_COLUMNS));
}

function priorityFileHasFilledInputs(filePath: string): boolean {
  const text = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  const checkedFields = [
    "nflDraftRound",
    "nflDraftPick",
    "nflDraftOverall",
    "collegeGames",
    "collegePassingAttempts",
    "collegePassingYards",
    "collegeRushingAttempts",
    "collegeRushingYards",
    "collegeTargets",
    "collegeReceptions",
    "collegeReceivingYards",
    "collegeSoloTackles",
    "collegeTotalTackles",
    "collegeSacks",
    "landingSpotRole",
    "opportunityNotes",
  ];
  const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) return true;
  return parsed.data.some((row) => checkedFields.some((field) => Boolean(String(row[field] ?? "").trim())));
}

async function loadRoomContext(roomId: string) {
  if (!authUserId) throw new Error("Missing BLACKBIRD_E2E_AUTH_USER_ID or SCORING_VALIDATION_OPERATOR_USER_ID for real-room priority context.");
  const state = await getDraftRoomState(authUserId, roomId) as Record<string, any>;
  const players = mergePlayers(state.blackbirdRankPlayers ?? [], state.draftablePlayers ?? [], state.remainingPlayers ?? []);
  const draftedPlayerIds = Array.isArray(state.draftedPlayerIds) ? state.draftedPlayerIds : [];
  const leagueContext = {
    isDynasty: Boolean(state.league?.is_dynasty),
    isBestBall: Boolean(state.league?.is_best_ball),
    isSuperflex: Boolean(state.league?.is_superflex),
    isTwoQb: Boolean(state.league?.is_two_qb),
    tePremium: Number(state.league?.te_premium ?? 0),
    hasIDP: Boolean(state.hasIDP),
    hasKicker: Boolean(state.hasKicker),
    hasTeamDefense: Boolean(state.hasTeamDefense),
    rosterPositions: Array.isArray(state.league?.roster_positions_json) ? state.league.roster_positions_json : [],
    scoringSettings: state.league?.scoring_settings_json && typeof state.league.scoring_settings_json === "object" ? state.league.scoring_settings_json : null,
  };
  const board = buildBlackbirdBoard({
    players,
    overlays: state.h10ValueOverlay ?? [],
    recommendations: state.h10RecommendationPreview ?? [],
    draftedPlayerIds,
    leagueContext,
    includeDrafted: true,
  });
  const leagueRank = buildBlackbirdLeagueRank({
    players,
    overlays: state.h10ValueOverlay ?? [],
    recommendations: state.h10RecommendationPreview ?? [],
    draftedPlayerIds,
    leagueContext,
  });
  const livePlan = buildLivePlanStatus({
    draftRoomId: roomId,
    currentPickNumber: state.currentPickNumber ?? null,
    currentRound: state.currentRound ?? null,
    myDraftSlot: state.myDraftSlot ?? null,
    teamCount: state.teamCount ?? null,
    picksUntilMyTurn: state.picksUntilMyNextPick ?? null,
    positionCounts: state.positionCounts ?? {},
    strategy: null,
    boardRows: board.rows,
    draftedPlayerIds,
  });
  const suggestions = buildLiveDraftSuggestions({
    leagueRankRows: leagueRank.rows,
    draftedPlayerIds,
    positionNeeds: state.positionNeeds ?? [],
    currentPickNumber: state.currentPickNumber ?? null,
    picksUntilMyTurn: state.picksUntilMyNextPick ?? null,
    livePlanStatus: livePlan,
  });
  const realRoomPlayerIds = new Set<string>(players.map((player) => String(player.matched_player_id ?? player.sleeper_player_id ?? "")).filter(Boolean));
  const blackbirdRanks = new Map(leagueRank.rows.map((row) => [row.playerId, row.blackbirdRank]));
  const draftSuggestionRanks = new Map(suggestions.rows.map((row) => [row.playerId, row.draftSuggestionRank]));
  const scarcePositions = new Set<string>([
    ...((state.positionNeeds ?? []) as Array<{ position?: string; needLevel?: string }>).filter((need) => ["urgent", "high", "moderate", "thin", "behind"].includes(String(need.needLevel ?? ""))).map((need) => normalizePosition(need.position)),
    ...(leagueContext.isSuperflex || leagueContext.isTwoQb ? ["QB"] : []),
    ...(leagueContext.hasIDP ? ["DL", "LB", "DB"] : []),
    ...(leagueContext.tePremium > 0 ? ["TE"] : []),
  ].filter(Boolean));
  return { realRoomPlayerIds, blackbirdRanks, draftSuggestionRanks, scarcePositions, boardRows: board.rows.length, suggestionRows: suggestions.rows.length };
}

function mergePlayers(...groups: any[][]): any[] {
  const rows: any[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const row of group) {
      const key = `${row.matched_player_id ?? ""}|${row.sleeper_player_id ?? ""}|${String(row.player_name ?? "").toLowerCase()}|${normalizePosition(row.position)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }
  return rows;
}

function normalizePosition(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toUpperCase();
  return normalized === "DST" || normalized === "D/ST" ? "DEF" : normalized;
}
