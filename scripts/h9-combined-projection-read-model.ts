// H9.13 — Combined projection read model diagnostic.
//
// Read-only. No H10 valuation, draft recommendation, War Room ordering, or
// projection persistence changes.

import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { loadAllPagesWith } from "@/lib/context/paginated-loader";
import {
  buildCombinedProjectionReadModel,
  selectLatestCompleteRun,
  type CombinedProjectionRow,
  type CombinedProjectionSort,
  type LeagueReadRow,
  type MarketComparisonReadRow,
  type PlayerReadRow,
  type ProjectionOutputReadRow,
  type ProjectionReasonReadRow,
  type ProjectionRunReadRow,
} from "@/lib/projections/combined-projection-read-model";
import { PROJECTION_METHOD } from "@/lib/projections/constants";
import type { H912LeagueOutput } from "@/lib/projections/dst-baseline-projections";
import { H911_PROJECTION_METHOD } from "@/lib/projections/idp-k-persistence";

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

loadLocalEnv();

type Args = {
  leagueId: string | null;
  allLeagues: boolean;
  includeDstDryRun: boolean;
  includeAllPositions: boolean;
  position: string | null;
  sortBy: CombinedProjectionSort | null;
};

function argValue(name: string, def: string | null = null): string | null {
  const argv = process.argv.slice(2);
  const eq = argv.find((arg) => arg.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : def;
}

function hasArg(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

function parseArgs(): Args {
  const leagueId = argValue("--league-id");
  const allLeagues = hasArg("--all-leagues");
  if (!leagueId && !allLeagues) throw new Error("Use --league-id=<uuid> or --all-leagues.");
  const position = argValue("--position")?.toUpperCase() ?? null;
  if (position && !["QB", "RB", "WR", "TE", "DL", "LB", "DB", "K", "DST", "DEF"].includes(position)) {
    throw new Error("--position must be QB, RB, WR, TE, DL, LB, DB, K, or DST.");
  }
  const sortBy = argValue("--sort-by") as CombinedProjectionSort | null;
  if (sortBy && !["medianPoints", "projectedPositionRank", "position", "confidence", "marketRankDelta"].includes(sortBy)) {
    throw new Error("--sort-by must be medianPoints, projectedPositionRank, position, confidence, or marketRankDelta.");
  }
  return {
    leagueId,
    allLeagues,
    includeDstDryRun: hasArg("--include-dst-dry-run"),
    includeAllPositions: hasArg("--include-all-positions"),
    position,
    sortBy,
  };
}

function supabase(): SupabaseClient<any> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment: NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and service or anon key are required.");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function loadRuns(client: SupabaseClient<any>): Promise<ProjectionRunReadRow[]> {
  return loadAllPagesWith<ProjectionRunReadRow>(
    (from, to) => client
      .from("projection_runs")
      .select("projection_run_id,method,projection_version,selection_scope,run_status,completed_at")
      .in("method", [PROJECTION_METHOD, H911_PROJECTION_METHOD])
      .order("method", { ascending: true })
      .order("projection_version", { ascending: false })
      .order("completed_at", { ascending: false })
      .range(from, to),
    { table: "projection_runs" }
  );
}

async function loadLeagues(client: SupabaseClient<any>, args: Args): Promise<LeagueReadRow[]> {
  return loadAllPagesWith<LeagueReadRow>(
    (from, to) => {
      let query = client
        .from("leagues")
        .select("id,name,season,roster_positions_json,scoring_settings_json")
        .eq("season", "2026")
        .order("id", { ascending: true })
        .range(from, to);
      if (args.leagueId) query = query.eq("id", args.leagueId);
      return query;
    },
    { table: "leagues" }
  );
}

async function loadOutputs(client: SupabaseClient<any>, runIds: string[], leagueIds: string[]): Promise<ProjectionOutputReadRow[]> {
  if (runIds.length === 0 || leagueIds.length === 0) return [];
  return loadAllPagesWith<ProjectionOutputReadRow>(
    (from, to) => client
      .from("player_projection_outputs")
      .select("projection_run_id,canonical_player_id,league_id,position,projected_ppg_when_in_role,floor_ppg,ceiling_ppg,downside_points,floor_points,median_points,ceiling_points,upside_points,projection_confidence_label,projected_position_rank,projection_method")
      .in("projection_run_id", runIds)
      .in("league_id", leagueIds)
      .order("league_id", { ascending: true })
      .order("position", { ascending: true })
      .order("projected_position_rank", { ascending: true })
      .range(from, to),
    { table: "player_projection_outputs" }
  );
}

async function loadPlayers(client: SupabaseClient<any>, playerIds: string[]): Promise<PlayerReadRow[]> {
  if (playerIds.length === 0) return [];
  const rows: PlayerReadRow[] = [];
  for (const batch of chunks(playerIds, 200)) {
    rows.push(...await loadAllPagesWith<PlayerReadRow>(
      (from, to) => client
        .from("players")
        .select("id,full_name,team,position,position_group")
        .in("id", batch)
        .order("id", { ascending: true })
        .range(from, to),
      { table: "players" }
    ));
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

async function loadReasons(client: SupabaseClient<any>, runIds: string[], playerIds: string[]): Promise<ProjectionReasonReadRow[]> {
  if (runIds.length === 0 || playerIds.length === 0) return [];
  const rows: ProjectionReasonReadRow[] = [];
  for (const batch of chunks(playerIds, 200)) {
    rows.push(...await loadAllPagesWith<ProjectionReasonReadRow>(
      (from, to) => client
        .from("projection_reasons")
        .select("projection_run_id,canonical_player_id,league_id,reason_code,explanation")
        .in("projection_run_id", runIds)
        .in("canonical_player_id", batch)
        .order("projection_run_id", { ascending: true })
        .order("canonical_player_id", { ascending: true })
        .order("reason_code", { ascending: true })
        .range(from, to),
      { table: "projection_reasons" }
    ));
  }
  return rows.sort((a, b) =>
    a.projection_run_id.localeCompare(b.projection_run_id) ||
    a.canonical_player_id.localeCompare(b.canonical_player_id) ||
    a.reason_code.localeCompare(b.reason_code)
  );
}

async function loadMarketComparisons(client: SupabaseClient<any>, offensiveRunId: string | null, leagueIds: string[]): Promise<MarketComparisonReadRow[]> {
  if (!offensiveRunId || leagueIds.length === 0) return [];
  return loadAllPagesWith<MarketComparisonReadRow>(
    (from, to) => client
      .from("player_projection_market_comparisons")
      .select("projection_run_id,canonical_player_id,league_id,market_overall_adp,market_position_rank,rank_delta,market_discrepancy_label,compatibility_label,market_confidence_label,reason_codes,format_warnings_json")
      .eq("projection_run_id", offensiveRunId)
      .in("league_id", leagueIds)
      .order("league_id", { ascending: true })
      .order("canonical_player_id", { ascending: true })
      .range(from, to),
    { table: "player_projection_market_comparisons" }
  );
}

function loadDstOutputs(includeDstDryRun: boolean, leagueIds: string[]): H912LeagueOutput[] {
  if (!includeDstDryRun) return [];
  const artifactPath = path.join(process.cwd(), "artifacts", "projections", "h9-dst-projections-2025-to-2026.json");
  if (!existsSync(artifactPath)) return [];
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { leagueOutputs?: H912LeagueOutput[] };
  const leagueFilter = new Set(leagueIds);
  return (artifact.leagueOutputs ?? []).filter((row) => leagueFilter.has(row.leagueId));
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function topByPosition(rows: CombinedProjectionRow[]) {
  const grouped = new Map<string, CombinedProjectionRow[]>();
  for (const row of rows) grouped.set(row.positionGroup, [...(grouped.get(row.positionGroup) ?? []), row]);
  return Object.fromEntries([...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([position, positionRows]) => [
    position,
    positionRows
      .sort((a, b) => (a.projectedPositionRank ?? 9999) - (b.projectedPositionRank ?? 9999) || b.medianPoints - a.medianPoints || a.entityId.localeCompare(b.entityId))
      .slice(0, 5)
      .map((row) => ({
        leagueId: row.leagueId,
        entityId: row.entityId,
        displayName: row.displayName,
        team: row.team,
        medianPoints: row.medianPoints,
        projectedPositionRank: row.projectedPositionRank,
        projectionSource: row.projectionSource,
      })),
  ]));
}

function writeArtifact(summary: unknown) {
  const dir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(dir, { recursive: true });
  const artifactPath = path.join(dir, "h9-combined-projection-read-model.json");
  writeFileSync(artifactPath, JSON.stringify(summary, null, 2));
  return artifactPath;
}

async function main() {
  const args = parseArgs();
  const client = supabase();
  const [runs, leagues] = await Promise.all([loadRuns(client), loadLeagues(client, args)]);
  const leagueIds = leagues.map((league) => league.id);
  const offensiveRun = selectLatestCompleteRun(runs, PROJECTION_METHOD);
  const idpKRun = selectLatestCompleteRun(runs, H911_PROJECTION_METHOD);
  const runIds = [offensiveRun?.projection_run_id, idpKRun?.projection_run_id].filter((id): id is string => Boolean(id));
  const outputs = await loadOutputs(client, runIds, leagueIds);
  const playerIds = [...new Set(outputs.map((output) => output.canonical_player_id))];
  const [players, reasons, marketComparisons] = await Promise.all([
    loadPlayers(client, playerIds),
    loadReasons(client, runIds, playerIds),
    loadMarketComparisons(client, offensiveRun?.projection_run_id ?? null, leagueIds),
  ]);
  const dstOutputs = loadDstOutputs(args.includeDstDryRun, leagueIds);
  const model = buildCombinedProjectionReadModel({
    runs,
    outputs,
    players,
    leagues,
    reasons,
    marketComparisons,
    dstOutputs,
    options: {
      leagueIds,
      includeDstDryRun: args.includeDstDryRun,
      includeAllPositions: args.includeAllPositions,
      position: args.position,
      sortBy: args.sortBy,
    },
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    args,
    leaguesLoaded: leagues.length,
    rowsReturned: model.rows.length,
    rowsByProjectionSource: countBy(model.rows.map((row) => row.projectionSource)),
    rowsByPosition: countBy(model.rows.map((row) => row.positionGroup)),
    persistedVsDryRunRows: {
      persisted: model.rows.filter((row) => row.isPersisted).length,
      dryRun: model.rows.filter((row) => !row.isPersisted).length,
    },
    marketComparisonAvailability: countBy(model.rows.map((row) => row.marketComparisonStatus)),
    warningCounts: countBy(model.rows.flatMap((row) => row.warningCodes)),
    topProjectedByPosition: topByPosition(model.rows),
    dstRowsIncluded: model.rows.filter((row) => row.projectionSource === "DST_ALLOWANCE_BASELINE_V1_DRY_RUN").length,
    dstRowsExcluded: args.includeDstDryRun ? 0 : dstOutputs.length,
    leagueCoverage: model.leagueCoverage,
    selectedRuns: model.selectedRuns,
    rows: model.rows,
  };
  const artifactPath = writeArtifact(summary);

  console.log("\nH9.13 Combined Projection Read Model");
  console.log(JSON.stringify({
    leaguesLoaded: summary.leaguesLoaded,
    rowsReturned: summary.rowsReturned,
    rowsByProjectionSource: summary.rowsByProjectionSource,
    rowsByPosition: summary.rowsByPosition,
    persistedVsDryRunRows: summary.persistedVsDryRunRows,
    marketComparisonAvailability: summary.marketComparisonAvailability,
    warningCounts: summary.warningCounts,
    dstRowsIncluded: summary.dstRowsIncluded,
    missingProjectionCategoriesByLeague: Object.fromEntries(summary.leagueCoverage.map((coverage) => [coverage.leagueId, coverage.missingProjectionCategories])),
    artifactPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
