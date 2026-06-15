// H10.2A — War Room recommendation preview dry-run.
//
// Read-only. Builds deterministic value-context recommendation rows from the
// current War Room state and H10 overlay. No persistence and no legacy
// recommendation replacement.

import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { buildNormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import { buildWarRoomValueOverlay } from "@/lib/draft/h10-war-room-overlay";
import type { DraftTargetScorePlayer } from "@/lib/draft/scoring";
import { buildWarRoomRecommendations, type WarRoomRecommendationRow } from "@/lib/draft/war-room-recommendations";
import type { H10LeagueValueRow } from "@/lib/projections/h10-league-value";
import { getDraftRoomState } from "@/lib/rosterforge/state";
import { createAdminClient } from "@/lib/supabase/admin";

type Args = {
  leagueId: string;
  draftRoomId: string | null;
  includeDstDryRun: boolean;
  includeAllPositions: boolean;
};

type LeagueRow = {
  id: string;
  name: string | null;
  roster_positions_json: string[] | null;
};

type DraftRoomRow = {
  id: string;
  user_id: string;
  league_id: string;
};

loadLocalEnv();

async function main() {
  const args = parseArgs();
  const league = await loadLeague(args.leagueId);
  const draftRoom = args.draftRoomId ? await loadDraftRoom(args.draftRoomId) : null;
  if (draftRoom && draftRoom.league_id !== args.leagueId) {
    throw new Error(`Draft room ${draftRoom.id} belongs to league ${draftRoom.league_id}, not ${args.leagueId}.`);
  }

  const state = draftRoom ? await getDraftRoomState(draftRoom.user_id, draftRoom.id) : null;
  const remainingPlayers = (state?.remainingPlayers ?? []) as DraftTargetScorePlayer[];
  const rosterRequirements = state?.rosterRequirements ?? buildNormalizedRosterRequirements(league?.roster_positions_json ?? []);
  const valueRows = loadH10ValueRows(args.leagueId);
  const sleeperToCanonicalId = await loadSleeperCrosswalk(remainingPlayers);
  const overlay = buildWarRoomValueOverlay({
    leagueId: args.leagueId,
    players: remainingPlayers,
    valueRows,
    rosterRequirements,
    includeDstDryRun: args.includeDstDryRun,
    includeAllPositions: args.includeAllPositions,
    sleeperToCanonicalId,
  });
  const recommendations = buildWarRoomRecommendations({
    leagueId: args.leagueId,
    draftRoomId: args.draftRoomId ?? "NO_DRAFT_ROOM",
    remainingPlayers,
    h10ValueOverlay: overlay.rows,
    rosterRequirements,
    positionNeeds: state?.positionNeeds,
    topNeeds: state?.topNeeds,
    myRoster: state?.myRoster,
    picks: state?.picks,
    currentPickNumber: state?.currentPickNumber ?? null,
    currentRound: state?.currentRound ?? null,
    picksUntilMyNextPick: state?.picksUntilMyNextPick ?? null,
    draftedPlayerIds: state?.draftedPlayerIds?.filter((id): id is string => Boolean(id)),
    positionCounts: state?.positionCounts,
    includeDstDryRun: args.includeDstDryRun,
    matchCoverageSummary: overlay.diagnostics.matchCoverageSummary,
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    args,
    leagueLoaded: Boolean(league),
    league: league ? { id: league.id, name: league.name } : null,
    draftRoomLoaded: Boolean(draftRoom),
    fallbackRelevanceDiagnostics: state?.fallbackRelevanceDiagnostics ?? null,
    remainingPlayersLoaded: recommendations.diagnostics.remainingPlayersLoaded,
    overlayRowsLoaded: recommendations.diagnostics.overlayRowsLoaded,
    recommendationsGenerated: recommendations.diagnostics.recommendationsGenerated,
    rowsByTier: recommendations.diagnostics.rowsByTier,
    rowsByStatus: recommendations.diagnostics.rowsByStatus,
    rowsByPosition: recommendations.diagnostics.rowsByPosition,
    warningCounts: recommendations.diagnostics.warningCounts,
    matchCoverageSummary: recommendations.diagnostics.matchCoverageSummary,
    missingProjectionReasons: recommendations.diagnostics.missingProjectionReasons,
    matchRateByPosition: recommendations.diagnostics.matchRateByPosition,
    highPriorityMissingProjectionExamples: recommendations.diagnostics.highPriorityMissingProjectionExamples,
    idpRowsEvaluated: recommendations.diagnostics.idpRowsEvaluated,
    idpRowsByTier: recommendations.diagnostics.idpRowsByTier,
    idpAverageScoreComponents: recommendations.diagnostics.idpAverageScoreComponents,
    idpTopLeagueValueRows: recommendations.diagnostics.idpTopLeagueValueRows,
    idpTopRosterNeedRows: recommendations.diagnostics.idpTopRosterNeedRows,
    idpTopTierCliffRows: recommendations.diagnostics.idpTopTierCliffRows,
    idpSuppressionReasons: recommendations.diagnostics.idpSuppressionReasons,
    topRecommendations: recommendations.rows
      .filter((row) => row.status === "recommendable" || row.status === "watch_only")
      .slice(0, 15)
      .map(compactRow),
    watchlistExamples: recommendations.rows
      .filter((row) => row.recommendationTier === "watchlist")
      .slice(0, 10)
      .map(compactRow),
    insufficientDataExamples: recommendations.rows
      .filter((row) => row.recommendationTier === "insufficient_data")
      .slice(0, 10)
      .map(compactRow),
    contextLimitations: recommendations.diagnostics.contextLimitations,
    invariantFailures: recommendations.diagnostics.invariantFailures,
    rows: recommendations.rows,
  };
  const artifactPath = writeArtifact(summary);

  console.log("\nH10.2A War Room Recommendation Dry Run");
  console.log(JSON.stringify({
    leagueLoaded: summary.leagueLoaded,
    draftRoomLoaded: summary.draftRoomLoaded,
    fallbackRelevanceDiagnostics: summary.fallbackRelevanceDiagnostics,
    remainingPlayersLoaded: summary.remainingPlayersLoaded,
    overlayRowsLoaded: summary.overlayRowsLoaded,
    recommendationsGenerated: summary.recommendationsGenerated,
    rowsByTier: summary.rowsByTier,
    rowsByStatus: summary.rowsByStatus,
    rowsByPosition: summary.rowsByPosition,
    warningCounts: summary.warningCounts,
    matchCoverageSummary: summary.matchCoverageSummary
      ? {
          rowsLoaded: summary.matchCoverageSummary.rowsLoaded,
          rowsMatched: summary.matchCoverageSummary.rowsMatched,
          rowsUnmatched: summary.matchCoverageSummary.rowsUnmatched,
          matchRate: summary.matchCoverageSummary.matchRate,
          classificationCounts: summary.matchCoverageSummary.classificationCounts,
        }
      : null,
    missingProjectionReasons: summary.missingProjectionReasons,
    matchRateByPosition: summary.matchRateByPosition,
    highPriorityMissingProjectionExamples: summary.highPriorityMissingProjectionExamples?.slice(0, 10),
    idpRowsEvaluated: summary.idpRowsEvaluated,
    idpRowsByTier: summary.idpRowsByTier,
    idpAverageScoreComponents: summary.idpAverageScoreComponents,
    idpTopLeagueValueRows: summary.idpTopLeagueValueRows,
    idpTopRosterNeedRows: summary.idpTopRosterNeedRows,
    idpTopTierCliffRows: summary.idpTopTierCliffRows,
    idpSuppressionReasons: summary.idpSuppressionReasons,
    topRecommendations: summary.topRecommendations,
    watchlistExamples: summary.watchlistExamples,
    insufficientDataExamples: summary.insufficientDataExamples,
    contextLimitations: summary.contextLimitations,
    invariantFailures: summary.invariantFailures,
    artifactPath,
  }, null, 2));
}

function parseArgs(): Args {
  const leagueId = argValue("--league-id");
  if (!leagueId) throw new Error("Use --league-id=<uuid>.");
  return {
    leagueId,
    draftRoomId: argValue("--draft-room-id"),
    includeDstDryRun: hasArg("--include-dst-dry-run"),
    includeAllPositions: hasArg("--include-all-positions"),
  };
}

async function loadLeague(leagueId: string): Promise<LeagueRow | null> {
  const { data, error } = await createAdminClient()
    .from("leagues")
    .select("id,name,roster_positions_json")
    .eq("id", leagueId)
    .maybeSingle();
  if (error) throw error;
  return data as LeagueRow | null;
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

async function loadSleeperCrosswalk(players: DraftTargetScorePlayer[]): Promise<Record<string, string>> {
  const sleeperIds = [...new Set(players.map((player) => player.sleeper_player_id).filter((id): id is string => Boolean(id)))];
  if (!sleeperIds.length) return {};
  const crosswalk: Record<string, string> = {};
  for (const batch of chunks(sleeperIds, 200)) {
    const { data, error } = await createAdminClient()
      .from("players")
      .select("id,sleeper_player_id")
      .in("sleeper_player_id", batch);
    if (error) throw error;
    for (const row of (data ?? []) as Array<{ id: string; sleeper_player_id: string | null }>) {
      if (row.sleeper_player_id) crosswalk[row.sleeper_player_id] = row.id;
    }
  }
  return crosswalk;
}

function loadH10ValueRows(leagueId: string): H10LeagueValueRow[] {
  const artifactPath = path.join(process.cwd(), "artifacts", "projections", "h10-league-value.json");
  if (!existsSync(artifactPath)) return [];
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { rows?: H10LeagueValueRow[] };
  return (artifact.rows ?? []).filter((row) => row.leagueId === leagueId);
}

function compactRow(row: WarRoomRecommendationRow) {
  return {
    recommendationRank: row.recommendationRank,
    displayName: row.displayName,
    position: row.position,
    team: row.team,
    recommendationTier: row.recommendationTier,
    recommendationScore: row.recommendationScore,
    status: row.status,
    primaryReason: row.primaryReason,
    warningCodes: row.warningCodes,
  };
}

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sep = trimmed.indexOf("=");
    if (sep === -1) continue;
    const key = trimmed.slice(0, sep).trim();
    if (!key || process.env[key]) continue;
    let value = trimmed.slice(sep + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

function argValue(name: string): string | null {
  const argv = process.argv.slice(2);
  const eq = argv.find((arg) => arg.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : null;
}

function hasArg(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function writeArtifact(summary: unknown) {
  const dir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(dir, { recursive: true });
  const artifactPath = path.join(dir, "h10-war-room-recommendations.json");
  writeFileSync(artifactPath, JSON.stringify(summary, null, 2));
  return artifactPath;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
