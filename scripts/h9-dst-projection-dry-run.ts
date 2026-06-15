// H9.12 — DST allowance-only low-confidence baseline projection dry run.
//
// Team-level DST projections only. Persistence is intentionally deferred because
// current projection tables are player-centric and require canonical_player_id.

import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { loadAllPagesWith } from "@/lib/context/paginated-loader";
import {
  H912_PROJECTION_METHOD,
  H912_PROJECTION_VERSION,
  H912_SELECTION_SCOPE,
  buildH912ProjectionResult,
  type H912LeagueInput,
  type H912TeamGameRow,
} from "@/lib/projections/dst-baseline-projections";

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
  historicalSeason: number;
  projectionSeason: number;
  team: string | null;
  leagueId: string | null;
  execute: boolean;
  inspectPersistence: boolean;
};

type LeagueRow = {
  id: string;
  name: string | null;
  season: number;
  scoring_settings_json: Record<string, unknown> | null;
  roster_positions_json: unknown;
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
  return {
    historicalSeason: Number(argValue("--historical-season", "2025")),
    projectionSeason: Number(argValue("--projection-season", "2026")),
    team: argValue("--team")?.toUpperCase() ?? null,
    leagueId: argValue("--league-id"),
    execute: hasArg("--execute"),
    inspectPersistence: hasArg("--inspect-persistence"),
  };
}

function supabase(): SupabaseClient<any> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in .env.local");
  return createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
}

async function loadTeamRows(client: SupabaseClient<any>, season: number): Promise<H912TeamGameRow[]> {
  return loadAllPagesWith<H912TeamGameRow>(
    (from, to) => client
      .from("team_game_stats")
      .select("game_id,season,week,season_type,team_id,opponent_id,points_allowed,yards_allowed,reconciliation_status")
      .eq("season", season)
      .in("season_type", ["REG", "regular"])
      .order("team_id", { ascending: true })
      .order("week", { ascending: true })
      .range(from, to),
    { table: "team_game_stats" }
  );
}

async function loadLeagues(client: SupabaseClient<any>, projectionSeason: number): Promise<H912LeagueInput[]> {
  const rows = await loadAllPagesWith<LeagueRow>(
    (from, to) => client
      .from("leagues")
      .select("id,name,season,scoring_settings_json,roster_positions_json")
      .eq("season", projectionSeason)
      .order("id", { ascending: true })
      .range(from, to),
    { table: "leagues" }
  );
  return rows.map((row) => ({
    leagueId: row.id,
    leagueName: row.name ?? row.id,
    season: row.season,
    rosterPositions: Array.isArray(row.roster_positions_json) ? row.roster_positions_json.map(String) : [],
    scoringSettings: row.scoring_settings_json ?? {},
  }));
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {} as Record<T, number>);
}

function aggregateBucketDistribution(projections: Array<{ pointsAllowedDistribution: Record<string, number>; yardsAllowedDistribution: Record<string, number> }>) {
  const pointsAllowed: Record<string, number> = {};
  const yardsAllowed: Record<string, number> = {};
  for (const projection of projections) {
    for (const [key, count] of Object.entries(projection.pointsAllowedDistribution)) pointsAllowed[key] = (pointsAllowed[key] ?? 0) + count;
    for (const [key, count] of Object.entries(projection.yardsAllowedDistribution)) yardsAllowed[key] = (yardsAllowed[key] ?? 0) + count;
  }
  return { pointsAllowed, yardsAllowed };
}

function writeArtifacts(input: {
  args: Args;
  rows: H912TeamGameRow[];
  result: ReturnType<typeof buildH912ProjectionResult>;
}) {
  const dir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(dir, { recursive: true });
  const projectionPath = path.join(dir, `h9-dst-projections-${input.args.historicalSeason}-to-${input.args.projectionSeason}.json`);
  const coveragePath = path.join(dir, `h9-dst-data-coverage-${input.args.historicalSeason}.json`);
  const common = {
    generatedAt: new Date().toISOString(),
    method: H912_PROJECTION_METHOD,
    projectionVersion: H912_PROJECTION_VERSION,
    selectionScope: H912_SELECTION_SCOPE,
    historicalSeason: input.args.historicalSeason,
    projectionSeason: input.args.projectionSeason,
  };
  writeFileSync(projectionPath, JSON.stringify({
    ...common,
    teamCount: input.result.teamProjections.length,
    rowsLoaded: input.rows.length,
    bucketDistribution: aggregateBucketDistribution(input.result.teamProjections),
    leagueOutputCount: input.result.leagueOutputs.length,
    scoringReadiness: countBy(input.result.leagueOutputs.map((output) => output.scoringReadiness)),
    reasonCounts: countBy(input.result.leagueOutputs.flatMap((output) => output.reasonCodes)),
    invariantFailures: input.result.invariantFailures,
    persistenceRecommendation: input.result.persistenceRecommendation,
    teamProjections: input.result.teamProjections,
    leagueOutputs: input.result.leagueOutputs,
  }, null, 2));
  writeFileSync(coveragePath, JSON.stringify({
    ...common,
    rowsLoaded: input.rows.length,
    teamCount: new Set(input.rows.map((row) => row.team_id)).size,
    pointsAllowedCoverage: input.rows.filter((row) => row.points_allowed !== null).length,
    yardsAllowedCoverage: input.rows.filter((row) => row.yards_allowed !== null).length,
    componentCoverage: input.result.dataCoverage,
  }, null, 2));
  return { projections: projectionPath, dataCoverage: coveragePath };
}

async function inspectPersistence(client: SupabaseClient<any>) {
  const { data: outputColumns, error: columnsError } = await client
    .from("player_projection_outputs")
    .select("canonical_player_id,position")
    .limit(1);
  if (columnsError) {
    return {
      compatible: false,
      reason: `Unable to inspect player_projection_outputs: ${columnsError.message}`,
    };
  }
  void outputColumns;
  return {
    compatible: false,
    method: H912_PROJECTION_METHOD,
    selectionScope: H912_SELECTION_SCOPE,
    reason: "Existing projection persistence is player-centric and requires canonical_player_id; H9.12 DST projections are team-level and no fake player IDs are created.",
  };
}

async function main() {
  const args = parseArgs();
  const client = supabase();
  const [rows, leagues] = await Promise.all([
    loadTeamRows(client, args.historicalSeason),
    loadLeagues(client, args.projectionSeason),
  ]);
  const result = buildH912ProjectionResult({
    rows,
    leagues,
    team: args.team,
    leagueId: args.leagueId,
  });
  const artifacts = writeArtifacts({ args, rows, result });
  const persistenceInspection = args.inspectPersistence || args.execute ? await inspectPersistence(client) : null;

  const summary = {
    dstProjectionDryRun: "H9.12",
    historicalSeason: args.historicalSeason,
    projectionSeason: args.projectionSeason,
    scope: {
      team: args.team ?? "all",
      league: args.leagueId ?? "all",
    },
    rowsLoaded: rows.length,
    teamCount: result.teamProjections.length,
    leagueOutputCount: result.leagueOutputs.length,
    dstLeaguesScored: new Set(result.leagueOutputs.map((output) => output.leagueId)).size,
    confidenceDistribution: countBy(result.teamProjections.map((projection) => projection.confidence)),
    scoringReadiness: countBy(result.leagueOutputs.map((output) => output.scoringReadiness)),
    bigPlayComponentPolicy: "DST_BIG_PLAY_COMPONENTS_UNAVAILABLE",
    dataCoverage: result.dataCoverage,
    invariantFailures: result.invariantFailures,
    persistenceRecommendation: result.persistenceRecommendation,
    persistenceInspection,
    artifacts,
  };

  console.log("\nH9.12 DST Projection Dry Run");
  console.log(`  Historical season: ${args.historicalSeason}`);
  console.log(`  Projection season: ${args.projectionSeason}`);
  console.log(`  Scope: team=${args.team ?? "all"} league=${args.leagueId ?? "all"}`);
  console.log(JSON.stringify(summary, null, 2));
  if (args.execute) {
    console.log(JSON.stringify({ h912Persistence: result.persistenceRecommendation }, null, 2));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
