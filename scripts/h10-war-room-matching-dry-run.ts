// H10.3 — War Room matching coverage dry-run.
//
// Read-only. Audits deterministic linkage between War Room rows and H10 value
// rows. No persistence, recommendation replacement, or ordering changes.

import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { buildNormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import { buildWarRoomMatchingCoverage, type WarRoomCanonicalCandidate } from "@/lib/draft/war-room-matching-coverage";
import type { DraftTargetScorePlayer } from "@/lib/draft/scoring";
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
  const players = (state?.remainingPlayers ?? []) as DraftTargetScorePlayer[];
  const valueRows = loadH10ValueRows(args.leagueId);
  const sleeperCanonicalCandidates = await loadSleeperCanonicalCandidates(players);
  const coverage = buildWarRoomMatchingCoverage({
    leagueId: args.leagueId,
    players,
    valueRows,
    rosterRequirements: state?.rosterRequirements ?? buildNormalizedRosterRequirements(league?.roster_positions_json ?? []),
    includeDstDryRun: args.includeDstDryRun,
    includeAllPositions: args.includeAllPositions,
    sleeperCanonicalCandidates,
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    args,
    leagueLoaded: Boolean(league),
    league: league ? { id: league.id, name: league.name } : null,
    draftRoomLoaded: Boolean(draftRoom),
    fallbackRelevanceDiagnostics: state?.fallbackRelevanceDiagnostics ?? null,
    ...coverage.summary,
    rows: coverage.rows,
  };
  const artifactPath = writeArtifact(summary);

  console.log("\nH10.3 War Room Matching Coverage Dry Run");
  console.log(JSON.stringify({
    leagueLoaded: summary.leagueLoaded,
    draftRoomLoaded: summary.draftRoomLoaded,
    fallbackRelevanceDiagnostics: summary.fallbackRelevanceDiagnostics,
    rowsLoaded: coverage.summary.rowsLoaded,
    rowsMatched: coverage.summary.rowsMatched,
    rowsUnmatched: coverage.summary.rowsUnmatched,
    matchRate: coverage.summary.matchRate,
    matchRateByPosition: coverage.summary.matchRateByPosition,
    matchRateBySource: coverage.summary.matchRateBySource,
    missingProjectionCount: coverage.summary.missingProjectionCount,
    formatExcludedCount: coverage.summary.formatExcludedCount,
    lowConfidenceCount: coverage.summary.lowConfidenceCount,
    classificationCounts: coverage.summary.classificationCounts,
    missingProjectionReasons: coverage.summary.missingProjectionReasons,
    topMissingHighRankPlayers: coverage.summary.topMissingHighRankPlayers.slice(0, 10),
    topMissingHighAdpPlayers: coverage.summary.topMissingHighAdpPlayers.slice(0, 10),
    highPriorityMissingProjectionExamples: coverage.summary.highPriorityMissingProjectionExamples.slice(0, 10),
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

async function loadSleeperCanonicalCandidates(players: DraftTargetScorePlayer[]): Promise<Record<string, WarRoomCanonicalCandidate[]>> {
  const sleeperIds = [...new Set(players.map((player) => player.sleeper_player_id).filter((id): id is string => Boolean(id)))];
  if (!sleeperIds.length) return {};
  const candidates: Record<string, WarRoomCanonicalCandidate[]> = {};
  for (const batch of chunks(sleeperIds, 200)) {
    const { data, error } = await createAdminClient()
      .from("players")
      .select("id,sleeper_player_id,full_name,position,primary_position,position_group,team")
      .in("sleeper_player_id", batch);
    if (error) throw error;
    for (const row of (data ?? []) as WarRoomCanonicalCandidate[]) {
      if (!row.sleeper_player_id) continue;
      candidates[row.sleeper_player_id] = [...(candidates[row.sleeper_player_id] ?? []), row];
    }
  }
  return candidates;
}

function loadH10ValueRows(leagueId: string): H10LeagueValueRow[] {
  const artifactPath = path.join(process.cwd(), "artifacts", "projections", "h10-league-value.json");
  if (!existsSync(artifactPath)) return [];
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { rows?: H10LeagueValueRow[] };
  return (artifact.rows ?? []).filter((row) => row.leagueId === leagueId);
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
  const artifactPath = path.join(dir, "h10-war-room-matching-coverage.json");
  writeFileSync(artifactPath, JSON.stringify(summary, null, 2));
  return artifactPath;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
