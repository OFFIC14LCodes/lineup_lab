import { buildBlackbirdBoard } from "@/lib/draft/blackbird-board";
import { buildBlackbirdLeagueRank } from "@/lib/draft/blackbird-league-rank";
import { buildLiveDraftSuggestions } from "@/lib/draft/live-draft-suggestion";
import { buildLivePlanStatus } from "@/lib/draft/live-plan-status";
import { getDraftRoomState } from "@/lib/rosterforge/state";

import { arg, loadLocalEnv, readHardeningArtifacts, writeDiagnostic } from "./h9-projection-hardening-utils";

loadLocalEnv();

const draftRoomId = arg("--draft-room-id", "f85238ff-b2ee-4053-8493-e38c4cb63bd3")!;
const authUserId = process.env.BLACKBIRD_E2E_AUTH_USER_ID ?? process.env.SCORING_VALIDATION_OPERATOR_USER_ID;

main().catch((error) => {
  const artifact = {
    generatedAt: new Date().toISOString(),
    draftRoomId,
    verdict: "blocked",
    failureReasons: [error instanceof Error ? error.message : String(error)],
  };
  writeDiagnostic("h9-real-room-projection-integrity", artifact);
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  if (!authUserId) throw new Error("Missing BLACKBIRD_E2E_AUTH_USER_ID or SCORING_VALIDATION_OPERATOR_USER_ID.");

  const state = await getDraftRoomState(authUserId, draftRoomId) as Record<string, any>;
  const artifacts = readHardeningArtifacts();
  const activeRun = artifacts.projections?.persistence?.projectionRunId ?? null;
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
    draftRoomId,
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

  const picks = Array.isArray(state.picks) ? state.picks : [];
  const draftedByPosition = positionsIncluded(picks, board.rows);
  const boardDetailMismatches = board.rows.filter((row) => row.projectionPoints !== row.playerDetailContext?.projectedFantasyPoints.median);
  const suggestionDraftedLeaks = suggestions.rows.filter((row) => draftedPlayerIds.includes(row.playerId));
  const fallbackWithoutCaveat = board.rows.filter((row) =>
    row.projectionUnit === "fallback" &&
    !row.contextualDataGaps.some((gap) => /projection|fallback|historical|rookie/i.test(gap)) &&
    !row.playerDetailContext?.whyBlackbirdIsCautious.some((reason) => /projection|fallback|data/i.test(reason))
  );
  const staleOrUnknown = board.rows.filter((row) => row.projectionUnit === "unknown" || row.projectionSource === "missing");
  const failures = [
    !state.room ? "draft room did not load" : null,
    !leagueContext.scoringSettings ? "league scoring settings missing" : null,
    !state.league ? "league missing" : null,
    draftedByPosition.QB.missing.length ? "drafted QBs missing from static Blackbird Rank" : null,
    draftedByPosition.RB.missing.length ? "drafted RBs missing from static Blackbird Rank" : null,
    draftedByPosition.WR.missing.length ? "drafted WRs missing from static Blackbird Rank" : null,
    draftedByPosition.TE.missing.length ? "drafted TEs missing from static Blackbird Rank" : null,
    state.hasIDP && (draftedByPosition.DL.missing.length || draftedByPosition.LB.missing.length || draftedByPosition.DB.missing.length) ? "drafted IDPs missing from static Blackbird Rank" : null,
    suggestionDraftedLeaks.length ? "Draft Suggestion includes drafted players" : null,
    boardDetailMismatches.length ? "board/detail projection mismatch exists" : null,
    fallbackWithoutCaveat.length ? "fallback projection shown without caveat" : null,
  ].filter((item): item is string => Boolean(item));

  const artifact = {
    generatedAt: new Date().toISOString(),
    draftRoomId,
    verdict: failures.length ? "failed" : "passed",
    failureReasons: failures,
    activeProjectionRun: {
      expectedComprehensiveRunOrNewer: "3fa33111-b8f6-450d-93cb-8cf12acdfb4a",
      artifactProjectionRunId: activeRun,
      note: "War Room overlay rows currently expose projection values but not complete run metadata in every path.",
    },
    roomLoaded: Boolean(state.room),
    leagueScoringSettingsLoad: Boolean(leagueContext.scoringSettings),
    scoringFingerprintPresent: Boolean(state.league?.scoring_fingerprint || state.league?.scoring_settings_json),
    playerUniverse: {
      blackbirdRankPlayers: state.blackbirdRankPlayers?.length ?? 0,
      draftablePlayers: state.draftablePlayers?.length ?? 0,
      remainingPlayers: state.remainingPlayers?.length ?? 0,
      mergedPlayers: players.length,
      boardRows: board.rows.length,
      leagueRankRows: leagueRank.rows.length,
      suggestionRows: suggestions.rows.length,
    },
    draftedCoverage: draftedByPosition,
    projectionIntegrity: {
      boardDetailProjectionMismatches: boardDetailMismatches.slice(0, 20).map((row) => ({ playerName: row.playerName, board: row.projectionPoints, detail: row.playerDetailContext?.projectedFantasyPoints.median })),
      livePlanUsesBoardRows: livePlan.dataGaps.includes("missing Blackbird board rows") === false,
      staleOrUnknownProjectionRows: staleOrUnknown.slice(0, 20).map((row) => ({ playerName: row.playerName, position: row.position, source: row.projectionSource, unit: row.projectionUnit })),
      fallbackWithoutCaveat: fallbackWithoutCaveat.slice(0, 20).map((row) => ({ playerName: row.playerName, position: row.position })),
    },
    checks: [
      check("draft_room_exists_and_loads", Boolean(state.room), state.room?.id ?? "missing"),
      check("league_scoring_settings_load", Boolean(leagueContext.scoringSettings), leagueContext.scoringSettings ? "loaded" : "missing"),
      check("blackbird_rank_includes_drafted_and_undrafted", board.rows.some((row) => row.drafted) && board.rows.some((row) => !row.drafted), `${board.rows.filter((row) => row.drafted).length}/${board.rows.length}`),
      check("draft_suggestion_excludes_drafted", suggestionDraftedLeaks.length === 0, `${suggestionDraftedLeaks.length} leaks`),
      check("board_projection_equals_detail_projection", boardDetailMismatches.length === 0, `${boardDetailMismatches.length} mismatches`),
      check("live_plan_uses_same_projection_bundle", livePlan.dataGaps.includes("missing Blackbird board rows") === false, livePlan.dataGaps.join(", ") || "ok"),
      check("no_adp_fallback_for_blackbird_rank", leagueRank.diagnostics.adpPrimarySignal === false, leagueRank.diagnostics.orderingMethod),
      check("fallback_labeled", fallbackWithoutCaveat.length === 0, `${fallbackWithoutCaveat.length} rows`),
    ],
  };

  writeDiagnostic("h9-real-room-projection-integrity", artifact);
  console.log(JSON.stringify({ verdict: artifact.verdict, artifact: "artifacts/projections/h9-real-room-projection-integrity.json" }, null, 2));
  if (artifact.verdict !== "passed") process.exitCode = 1;
}

function positionsIncluded(picks: any[], boardRows: Array<{ playerId: string | null; playerName: string; position: string | null; drafted: boolean }>) {
  const positions = ["QB", "RB", "WR", "TE", "DL", "LB", "DB"] as const;
  return Object.fromEntries(positions.map((position) => {
    const drafted = picks.filter((pick) => normalizePosition(pick.position) === position);
    const missing = drafted.filter((pick) => !boardRows.some((row) => row.drafted && (row.playerId === pick.sleeper_player_id || normalizeName(row.playerName) === normalizeName(pick.player_name))));
    return [position, { drafted: drafted.length, included: drafted.length - missing.length, missing: missing.slice(0, 10).map((pick) => pick.player_name ?? pick.sleeper_player_id) }];
  })) as Record<(typeof positions)[number], { drafted: number; included: number; missing: string[] }>;
}

function mergePlayers(...groups: any[][]): any[] {
  const rows: any[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const row of group) {
      const key = `${row.matched_player_id ?? ""}|${row.sleeper_player_id ?? ""}|${normalizeName(row.player_name)}|${normalizePosition(row.position)}`;
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

function normalizeName(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function check(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}
