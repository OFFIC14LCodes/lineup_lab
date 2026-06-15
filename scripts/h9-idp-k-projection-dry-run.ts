// H9.10 — IDP / K low-confidence baseline projection dry run.
//
// Computation only. No persistence, War Room changes, or offensive projection changes.

import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { loadAllPagesWith } from "@/lib/context/paginated-loader";
import {
  projectH910Population,
  scoreH910Leagues,
  type H910LeagueInput,
  type H910Position,
  type H910UnresolvedExclusionSummary,
  type H910WeeklyRow,
} from "@/lib/projections/idp-k-baseline-projections";
import {
  assertH911ExecuteSafety,
  buildH911WritePlan,
  h911ReasonKey,
  inspectH911Rows,
  H911_PROJECTION_METHOD,
  type H911WritePlan,
} from "@/lib/projections/idp-k-persistence";

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
  includeIdp: boolean;
  includeKicker: boolean;
  position: H910Position | null;
  limit: number | null;
  playerId: string | null;
  leagueId: string | null;
  execute: boolean;
  allowPartialExecute: boolean;
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
  const position = argValue("--position");
  const normalizedPosition = position?.toUpperCase() ?? null;
  if (normalizedPosition && !["DL", "LB", "DB", "K"].includes(normalizedPosition)) {
    throw new Error("--position must be DL, LB, DB, or K");
  }
  const all = hasArg("--all");
  const onlyIdp = hasArg("--idp");
  const onlyKicker = hasArg("--kicker");
  return {
    historicalSeason: Number(argValue("--historical-season", "2025")),
    projectionSeason: Number(argValue("--projection-season", "2026")),
    includeIdp: all || onlyIdp || (!all && !onlyIdp && !onlyKicker),
    includeKicker: all || onlyKicker || (!all && !onlyIdp && !onlyKicker),
    position: normalizedPosition as H910Position | null,
    limit: argValue("--limit") ? Number(argValue("--limit")) : null,
    playerId: argValue("--player-id"),
    leagueId: argValue("--league-id"),
    execute: hasArg("--execute") || hasArg("--persist"),
    allowPartialExecute: hasArg("--allow-partial-execute"),
    inspectPersistence: hasArg("--inspect-persistence"),
  };
}

function supabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  return createClient(supabaseUrl, supabaseKey);
}

async function loadWeeklyRows(client: SupabaseClient<any>, args: Args): Promise<H910WeeklyRow[]> {
  const positions = args.position
    ? [args.position]
    : args.includeIdp && !args.includeKicker
      ? ["DL", "LB", "DB"]
      : args.includeKicker && !args.includeIdp
        ? ["K"]
        : ["DL", "LB", "DB", "K"];
  return loadAllPagesWith<H910WeeklyRow>(
    (from, to) => {
      let query = client
        .from("player_weekly_stats")
        .select("player_id,week,position_group,stats_json")
        .eq("season", args.historicalSeason)
        .eq("season_type", "regular")
        .eq("data_version", "h9.8-special-teams-defense")
        .in("position_group", positions)
        .not("player_id", "is", null)
        .range(from, to);
      if (args.playerId) query = query.eq("player_id", args.playerId);
      return query;
    },
    { table: "player_weekly_stats" }
  );
}

async function loadLeagues(client: SupabaseClient<any>, projectionSeason: number, leagueId: string | null): Promise<H910LeagueInput[]> {
  const rows = await loadAllPagesWith<LeagueRow>(
    (from, to) => {
      let query = client
        .from("leagues")
        .select("id,name,season,scoring_settings_json,roster_positions_json")
        .eq("season", projectionSeason)
        .range(from, to);
      if (leagueId) query = query.eq("id", leagueId);
      return query;
    },
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

class InterruptedError extends Error {
  constructor() {
    super("H9.11 IDP/K persistence interrupted by SIGINT.");
  }
}

let interrupted = false;
let activePersistenceClient: SupabaseClient<any> | null = null;
let activePersistenceRunId: string | null = null;

process.once("SIGINT", async () => {
  interrupted = true;
  if (activePersistenceClient && activePersistenceRunId) {
    await activePersistenceClient.from("projection_runs").update({ run_status: "interrupted" }).eq("projection_run_id", activePersistenceRunId);
  }
});

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function codeVersion() {
  try {
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as { version?: string };
    return `blackbird-gm@${pkg.version ?? "0.0.0"}`;
  } catch {
    return "blackbird-gm@unknown";
  }
}

function isTransient(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|network|fetch|429|408|500|502|503|504/i.test(message);
}

async function retryTransient<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), 30_000)),
      ]);
    } catch (error) {
      last = error;
      if (attempt === 3 || !isTransient(error)) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
  throw last;
}

function chunks<T>(rows: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < rows.length; i += size) result.push(rows.slice(i, i + size));
  return result;
}

function schemaErrorMessage(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  if (/position.*check|role_sample_class|position_group|semantic_input_hash|schema cache|column|constraint/i.test(message)) {
    return `H9.11 BLOCKED BY SCHEMA — apply supabase/migrations/016_idp_k_projection_compat.sql before --execute/--inspect-persistence (${message})`;
  }
  return null;
}

async function upsertBatch(
  client: SupabaseClient<any>,
  table: string,
  rows: Array<Record<string, unknown>>,
  onConflict: string,
  batchSize = 500
) {
  let inserted = 0;
  let existing = 0;
  for (const [index, batch] of chunks(rows, batchSize).entries()) {
    if (interrupted) throw new InterruptedError();
    const data = await retryTransient(`${table} batch ${index + 1}`, async () => {
      const { data: insertedRows, error } = await client
        .from(table)
        .upsert(batch, { onConflict, ignoreDuplicates: true })
        .select(onConflict.split(",")[0]);
      if (error) throw error;
      return insertedRows ?? [];
    });
    inserted += data.length;
    existing += batch.length - data.length;
  }
  return { attempted: rows.length, inserted, existing };
}

type ProjectionRunDbRow = { projection_run_id: string; run_status: string };

async function getOrCreateRun(client: SupabaseClient<any>, plan: H911WritePlan): Promise<ProjectionRunDbRow> {
  const existing = await retryTransient("projection_runs lookup", async () => {
    const { data, error } = await client
      .from("projection_runs")
      .select("projection_run_id,run_status")
      .eq("semantic_input_hash", plan.semanticInputHash)
      .maybeSingle();
    if (error) throw error;
    return data as ProjectionRunDbRow | null;
  });
  if (existing) {
    const { error } = await client
      .from("projection_runs")
      .update({ run_status: existing.run_status === "complete" ? "complete" : "persisting", failure_code: null, failure_message: null })
      .eq("projection_run_id", existing.projection_run_id);
    if (error) throw error;
    return existing.run_status === "complete" ? existing : { ...existing, run_status: "persisting" };
  }
  const { data, error } = await client
    .from("projection_runs")
    .insert({ ...plan.run, run_status: "persisting", started_at: new Date().toISOString() })
    .select("projection_run_id,run_status")
    .single();
  if (error) throw error;
  return data as ProjectionRunDbRow;
}

async function inspectRun(client: SupabaseClient<any>, projectionRunId: string, expected?: H911WritePlan["expected"]) {
  const run = await retryTransient("projection_runs inspect", async () => {
    const { data, error } = await client
      .from("projection_runs")
      .select("projection_run_id,run_status")
      .eq("projection_run_id", projectionRunId)
      .single();
    if (error) throw error;
    return data as ProjectionRunDbRow;
  });
  const inputs = await loadAllPagesWith<{ canonical_player_id: string; position: string | null; position_group: string | null }>(
    (from, to) => client
      .from("player_projection_inputs")
      .select("canonical_player_id,position,position_group")
      .eq("projection_run_id", projectionRunId)
      .order("canonical_player_id", { ascending: true })
      .range(from, to),
    { table: "player_projection_inputs" }
  );
  const outputs = await loadAllPagesWith<{ canonical_player_id: string; league_id: string; position: string | null }>(
    (from, to) => client
      .from("player_projection_outputs")
      .select("canonical_player_id,league_id,position")
      .eq("projection_run_id", projectionRunId)
      .order("canonical_player_id", { ascending: true })
      .order("league_id", { ascending: true })
      .range(from, to),
    { table: "player_projection_outputs" }
  );
  const reasons = await loadAllPagesWith<{ reason_key: string }>(
    (from, to) => client
      .from("projection_reasons")
      .select("reason_key")
      .eq("projection_run_id", projectionRunId)
      .order("reason_key", { ascending: true })
      .range(from, to),
    { table: "projection_reasons" }
  );
  return {
    projectionRunId,
    runStatus: run.run_status,
    ...inspectH911Rows({ inputs, outputs, reasons }, expected),
  };
}

async function inspectByHash(client: SupabaseClient<any>, semanticInputHash: string, expected?: H911WritePlan["expected"]) {
  const { data, error } = await client
    .from("projection_runs")
    .select("projection_run_id,run_status")
    .eq("semantic_input_hash", semanticInputHash)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return inspectRun(client, (data as ProjectionRunDbRow).projection_run_id, expected);
}

async function inspectPersistenceState(client: SupabaseClient<any>, plan: H911WritePlan | null, readiness: Record<string, unknown>) {
  const runs = await loadAllPagesWith<{ projection_run_id: string; run_status: string }>(
    (from, to) => client
      .from("projection_runs")
      .select("projection_run_id,run_status")
      .eq("method", H911_PROJECTION_METHOD)
      .order("created_at", { ascending: false })
      .order("projection_run_id", { ascending: true })
      .range(from, to),
    { table: "projection_runs" }
  );
  const latest = plan ? await inspectByHash(client, plan.semanticInputHash, plan.expected) : null;
  return {
    projection_runs: {
      idpKCompleteRuns: runs.filter((run) => run.run_status === "complete").length,
      interruptedRuns: runs.filter((run) => run.run_status === "interrupted").length,
      failedRuns: runs.filter((run) => run.run_status === "failed").length,
      totalRuns: runs.length,
    },
    latestPlannedRun: latest,
    readiness,
  };
}

async function markRunFailed(client: SupabaseClient<any>, projectionRunId: string, code: string, message: string) {
  await client
    .from("projection_runs")
    .update({
      run_status: "failed",
      failed_at: new Date().toISOString(),
      failure_code: code,
      failure_message: message.slice(0, 1000),
    })
    .eq("projection_run_id", projectionRunId);
}

async function persistPlan(client: SupabaseClient<any>, plan: H911WritePlan) {
  const run = await getOrCreateRun(client, plan);
  const projectionRunId = run.projection_run_id;
  activePersistenceClient = client;
  activePersistenceRunId = projectionRunId;
  try {
    const rowsWithRun = {
      inputs: plan.inputs.map((row) => ({ ...row, projection_run_id: projectionRunId })),
      outputs: plan.outputs.map((row) => ({ ...row, projection_run_id: projectionRunId })),
      reasons: plan.reasonsWithoutRun.map((row) => ({
        ...row,
        projection_run_id: projectionRunId,
        reason_key: h911ReasonKey({
          projectionRunId,
          canonicalPlayerId: row.canonical_player_id,
          leagueId: row.league_id,
          reasonCode: row.reason_code,
          reasonScope: row.reason_scope,
        }),
      })),
    };
    const batchResults = {
      inputs: await upsertBatch(client, "player_projection_inputs", rowsWithRun.inputs, "projection_run_id,canonical_player_id"),
      outputs: await upsertBatch(client, "player_projection_outputs", rowsWithRun.outputs, "projection_run_id,canonical_player_id,league_id"),
      reasons: await upsertBatch(client, "projection_reasons", rowsWithRun.reasons, "reason_key"),
    };
    const inspection = await inspectRun(client, projectionRunId, plan.expected);
    if (!inspection.complete) throw new Error(`Post-write inspection failed: ${JSON.stringify(inspection)}`);
    const { error } = await client
      .from("projection_runs")
      .update({
        run_status: "complete",
        completed_at: new Date().toISOString(),
        input_count: inspection.inputCount,
        output_count: inspection.outputCount,
        reason_count: inspection.reasonCount,
      })
      .eq("projection_run_id", projectionRunId);
    if (error) throw error;
    return { projectionRunId, reusedCompleteRun: run.run_status === "complete", batchResults, inspection: { ...inspection, runStatus: "complete", complete: true } };
  } catch (error) {
    if (error instanceof InterruptedError) {
      await client.from("projection_runs").update({ run_status: "interrupted" }).eq("projection_run_id", projectionRunId);
    } else {
      await markRunFailed(client, projectionRunId, "H9_11_PERSISTENCE_FAILED", error instanceof Error ? error.message : String(error));
    }
    throw error;
  } finally {
    activePersistenceClient = null;
    activePersistenceRunId = null;
  }
}

function readUnresolvedSummary(historicalSeason: number): H910UnresolvedExclusionSummary {
  const fallback = {
    unresolvedRowsExcluded: { idp: 0, kicker: 0, total: 0 },
    unresolvedPlayersExcluded: 0,
    unresolvedStatVolumeExcluded: { idpPercent: 0, kickerPercent: 0 },
    highPriorityUnresolvedExcluded: 0,
  };
  const readinessPath = path.join(process.cwd(), "artifacts", "projections", `h9-idp-k-projection-readiness-${historicalSeason}.json`);
  if (!existsSync(readinessPath)) return fallback;
  const readiness = JSON.parse(readFileSync(readinessPath, "utf8")) as any;
  const idpRows = Number(readiness.afterIdentityCounts?.idpUnresolvedRows ?? 0);
  const kickerRows = Number(readiness.afterIdentityCounts?.kickerUnresolvedRows ?? 0);
  return {
    unresolvedRowsExcluded: { idp: idpRows, kicker: kickerRows, total: idpRows + kickerRows },
    unresolvedPlayersExcluded: Number(readiness.unresolvedMetrics?.remainingUnresolvedPlayers ?? 0),
    unresolvedStatVolumeExcluded: {
      idpPercent: Number(readiness.unresolvedMetrics?.unresolvedStatVolumePercentage?.idpPercent ?? 0),
      kickerPercent: Number(readiness.unresolvedMetrics?.unresolvedStatVolumePercentage?.kickerPercent ?? 0),
    },
    highPriorityUnresolvedExcluded: Number(readiness.unresolvedMetrics?.remainingHighPriorityUnresolvedPlayers ?? 0),
  };
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {} as Record<string, number>);
}

function topProjected(projections: ReturnType<typeof projectH910Population>["projections"], position: H910Position) {
  return projections
    .filter((projection) => projection.position === position)
    .map((projection) => ({
      playerId: projection.canonicalPlayerId,
      position: projection.position,
      roleClass: projection.roleClass,
      median: projection.componentsByScenario.median,
      confidence: projection.confidence,
    }))
    .sort((a, b) => {
      const aVolume = Object.values(a.median).reduce((sum, value) => sum + value, 0);
      const bVolume = Object.values(b.median).reduce((sum, value) => sum + value, 0);
      return bVolume - aVolume || a.playerId.localeCompare(b.playerId);
    })
    .slice(0, 10);
}

function widestRanges(projections: ReturnType<typeof projectH910Population>["projections"]) {
  return projections
    .map((projection) => ({
      playerId: projection.canonicalPlayerId,
      position: projection.position,
      range: Number((Object.values(projection.componentsByScenario.upside).reduce((sum, value) => sum + value, 0) -
        Object.values(projection.componentsByScenario.downside).reduce((sum, value) => sum + value, 0)).toFixed(4)),
    }))
    .sort((a, b) => b.range - a.range || a.playerId.localeCompare(b.playerId))
    .slice(0, 25);
}

async function main() {
  const args = parseArgs();
  if (args.execute) assertH911ExecuteSafety(args, args.allowPartialExecute);
  const client = supabase();
  const unresolvedExclusions = readUnresolvedSummary(args.historicalSeason);

  console.log("\nH9.11 IDP/K Projection Dry Run");
  console.log(`  Historical season: ${args.historicalSeason}`);
  console.log(`  Projection season: ${args.projectionSeason}`);
  console.log(`  Scope: idp=${args.includeIdp} kicker=${args.includeKicker} position=${args.position ?? "all"} player=${args.playerId ?? "all"} league=${args.leagueId ?? "all"}`);

  const rows = await loadWeeklyRows(client, args);
  const projectionResult = projectH910Population({
    rows,
    includeIdp: args.includeIdp,
    includeKicker: args.includeKicker,
    position: args.position,
    limit: args.limit,
    playerId: args.playerId,
    unresolvedExclusions,
  });
  const leagues = await loadLeagues(client, args.projectionSeason, args.leagueId);
  const scoring = scoreH910Leagues({ projections: projectionResult.projections, leagues });
  const readiness = {
    unresolvedRowsExcluded: unresolvedExclusions.unresolvedRowsExcluded,
    highPriorityUnresolvedExcluded: unresolvedExclusions.highPriorityUnresolvedExcluded,
    unsupportedScoringKeys: scoring.unsupportedScoringKeys,
    scenarioInvariantFailures: projectionResult.scenarioInvariantFailures,
  };
  const plan = buildH911WritePlan({
    args,
    weeklyRows: rows,
    projections: projectionResult.projections,
    leagues,
    outputs: scoring.outputs,
    unresolvedExclusions,
    unsupportedScoringKeys: scoring.unsupportedScoringKeys,
    scenarioInvariantFailures: projectionResult.scenarioInvariantFailures,
    asOfDate: todayIsoDate(),
    codeVersion: codeVersion(),
  });
  const persistenceInspection = args.inspectPersistence || args.execute
    ? await inspectPersistenceState(client, plan, readiness)
    : null;

  const projectionArtifactPath = path.join(process.cwd(), "artifacts", "projections", `h9-idp-k-projections-${args.historicalSeason}-to-${args.projectionSeason}.json`);
  const scoringArtifactPath = path.join(process.cwd(), "artifacts", "projections", `h9-idp-k-league-scoring-${args.historicalSeason}-to-${args.projectionSeason}.json`);
  mkdirSync(path.dirname(projectionArtifactPath), { recursive: true });

  const projectionArtifact = {
    dryRunId: `h9.10-idp-k-${new Date().toISOString()}`,
    historicalSeason: args.historicalSeason,
    projectionSeason: args.projectionSeason,
    mode: args.execute ? "execute" : "dry_run_only",
    scope: { includeIdp: args.includeIdp, includeKicker: args.includeKicker, position: args.position, limit: args.limit, playerId: args.playerId, leagueId: args.leagueId },
    inputRows: rows.length,
    idpPlayersProjected: projectionResult.projections.filter((projection) => projection.category === "idp").length,
    kickerPlayersProjected: projectionResult.projections.filter((projection) => projection.category === "kicker").length,
    positionDistribution: countBy(projectionResult.projections.map((projection) => projection.position)),
    confidenceDistribution: countBy(projectionResult.projections.map((projection) => projection.confidence)),
    roleClassDistribution: countBy(projectionResult.projections.map((projection) => projection.roleClass)),
    unresolvedExclusions,
    scenarioInvariantFailures: projectionResult.scenarioInvariantFailures,
    topProjectedIdpByGroup: {
      DL: topProjected(projectionResult.projections, "DL"),
      LB: topProjected(projectionResult.projections, "LB"),
      DB: topProjected(projectionResult.projections, "DB"),
    },
    topProjectedK: topProjected(projectionResult.projections, "K"),
    widestRanges: widestRanges(projectionResult.projections),
    bigPlayVolatilityLeaders: projectionResult.projections
      .filter((projection) => projection.category === "idp")
      .map((projection) => ({
        playerId: projection.canonicalPlayerId,
        position: projection.position,
        upsideBigPlays: Number(((projection.componentsByScenario.upside.sack ?? 0) + (projection.componentsByScenario.upside.int ?? 0) + (projection.componentsByScenario.upside.ff ?? 0) + (projection.componentsByScenario.upside.fr ?? 0) + (projection.componentsByScenario.upside.def_td ?? 0)).toFixed(4)),
        medianBigPlays: Number(((projection.componentsByScenario.median.sack ?? 0) + (projection.componentsByScenario.median.int ?? 0) + (projection.componentsByScenario.median.ff ?? 0) + (projection.componentsByScenario.median.fr ?? 0) + (projection.componentsByScenario.median.def_td ?? 0)).toFixed(4)),
      }))
      .sort((a, b) => (b.upsideBigPlays - b.medianBigPlays) - (a.upsideBigPlays - a.medianBigPlays))
      .slice(0, 25),
    persistencePlan: {
      semanticInputHash: plan.semanticInputHash,
      expected: plan.expected,
      method: plan.run.method,
      projectionVersion: plan.run.projection_version,
      selectionScope: plan.run.selection_scope,
    },
    persistenceInspection,
    projections: projectionResult.projections,
  };
  const scoringArtifact = {
    dryRunId: projectionArtifact.dryRunId,
    historicalSeason: args.historicalSeason,
    projectionSeason: args.projectionSeason,
    idpLeaguesScored: scoring.idpLeaguesScored,
    kickerLeaguesScored: scoring.kickerLeaguesScored,
    playerLeagueOutputs: scoring.outputs.length,
    unsupportedScoringKeys: scoring.unsupportedScoringKeys,
    scenarioInvariantFailures: projectionResult.scenarioInvariantFailures,
    persistencePlan: {
      semanticInputHash: plan.semanticInputHash,
      expected: plan.expected,
    },
    persistenceInspection,
    outputs: scoring.outputs,
  };

  writeFileSync(projectionArtifactPath, `${JSON.stringify(projectionArtifact, null, 2)}\n`);
  writeFileSync(scoringArtifactPath, `${JSON.stringify(scoringArtifact, null, 2)}\n`);

  console.log(JSON.stringify({
    idpPlayersProjected: projectionArtifact.idpPlayersProjected,
    kickerPlayersProjected: projectionArtifact.kickerPlayersProjected,
    idpKLeagueOutputs: scoring.outputs.length,
    positionDistribution: projectionArtifact.positionDistribution,
    confidenceDistribution: projectionArtifact.confidenceDistribution,
    unresolvedExclusions,
    scenarioInvariantFailures: projectionResult.scenarioInvariantFailures.length,
    unsupportedScoringKeys: scoring.unsupportedScoringKeys,
    persistencePlan: plan.expected,
    persistenceInspection,
    artifacts: { projections: projectionArtifactPath, leagueScoring: scoringArtifactPath },
  }, null, 2));

  if (projectionResult.scenarioInvariantFailures.length > 0) throw new Error("H9.11 scenario invariant failures found.");
  if (scoring.unsupportedScoringKeys.length > 0) throw new Error("H9.11 unsupported scoring keys found. See league scoring artifact.");
  if (args.inspectPersistence && !args.execute) return;
  if (args.execute) {
    const persistence = await persistPlan(client, plan);
    console.log(JSON.stringify({ h911Persistence: persistence }, null, 2));
  }
}

main().catch((error) => {
  const schemaMessage = schemaErrorMessage(error);
  if (schemaMessage) {
    console.error(schemaMessage);
    process.exit(1);
  }
  console.error("FATAL:", error);
  process.exit(1);
});
