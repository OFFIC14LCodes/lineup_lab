// H9.3 — League Projection Output Dry-Run Diagnostic
//
// Usage:
//   npm run dry-run:h9-league-projections -- --historical-season=2025 --projection-season=2026 --all
//   npm run dry-run:h9-league-projections -- --position=WR --limit=25
//   npm run dry-run:h9-league-projections -- --player-id=<uuid> --league-id=<uuid>

import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { loadAllPagesWith } from "@/lib/context/paginated-loader";
import type { PlayerStatProjection } from "@/lib/projections/component-projections";
import {
  MODEL_CONFIG,
  PROJECTION_METHOD,
  PROJECTION_VERSION,
  REASON_CODE_REGISTRY_VERSION,
} from "@/lib/projections/constants";
import { hashScoringConfig, reasonKey, runSemanticHash } from "@/lib/projections/hash";
import {
  h93AdapterStatKeys,
  h94KnownZeroOrExcludedKeys,
  h94ProjectionUnsupportedBlockingKeys,
  projectLeagueProjectionPopulation,
  type LeagueProjectionLeagueInput,
  type LeagueProjectionOutput,
} from "@/lib/projections/league-projections";
import { REASON_CODES, type ReasonCode, type ReasonDirection, type ReasonScope } from "@/lib/projections/reason-codes";
import { getScoringKeyDefinition } from "@/lib/scoring/sleeper-keys";
import type { ProjectionPosition } from "@/lib/projections/types";

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadLocalEnv();

class InterruptedError extends Error {
  constructor() {
    super("H9.5 persistence interrupted by SIGINT.");
    this.name = "InterruptedError";
  }
}

let interrupted = false;
let activePersistenceClient: SupabaseClient<any> | null = null;
let activePersistenceRunId: string | null = null;

process.on("SIGINT", () => {
  interrupted = true;
  if (activePersistenceClient && activePersistenceRunId) {
    void (async () => {
      try {
        await activePersistenceClient
          ?.from("projection_runs")
          .update({ run_status: "interrupted" })
          .eq("projection_run_id", activePersistenceRunId);
      } finally {
        process.exit(130);
      }
    })();
    return;
  }
  process.exit(130);
});

function argValue(name: string, def: string | null = null): string | null {
  const argv = process.argv.slice(2);
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
}

function hasArg(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

function parseArgs() {
  const position = argValue("--position");
  if (position && !["QB", "RB", "WR", "TE"].includes(position.toUpperCase())) {
    throw new Error("--position must be QB, RB, WR, or TE");
  }
  const explicitLimit = argValue("--limit") !== null;
  return {
    historicalSeason: parseInt(argValue("--historical-season", "2025") ?? "2025", 10),
    projectionSeason: parseInt(argValue("--projection-season", "2026") ?? "2026", 10),
    all: hasArg("--all"),
    position: position ? position.toUpperCase() as ProjectionPosition : null,
    limit: parseInt(argValue("--limit", "40") ?? "40", 10),
    explicitLimit,
    playerId: argValue("--player-id"),
    leagueId: argValue("--league-id"),
    execute: hasArg("--execute"),
    allowPartialExecute: hasArg("--allow-partial-execute"),
    inspectPersistence: hasArg("--inspect-persistence"),
  };
}

type H92Artifact = {
  historicalSeason: number;
  projectionSeason: number;
  projections: PlayerStatProjection[];
};

type LeagueDbRow = {
  id: string;
  name: string | null;
  season: number | string | null;
  total_teams: number | null;
  is_superflex: boolean | null;
  is_two_qb: boolean | null;
  te_premium: boolean | null;
  scoring_settings_json: Record<string, unknown> | null;
  roster_positions_json: unknown;
  settings_json: Record<string, unknown> | null;
};

type ProjectionRunDbRow = {
  projection_run_id: string;
  run_status: string;
};

type ProjectionWritePlan = {
  run: Record<string, unknown>;
  semanticInputHash: string;
  inputs: Array<Record<string, unknown>>;
  outputs: Array<Record<string, unknown>>;
  reasonsWithoutRun: Array<{
    canonical_player_id: string;
    league_id: string | null;
    reason_code: ReasonCode;
    reason_scope: ReasonScope;
    direction: ReasonDirection;
    magnitude: number | null;
    explanation: string;
    source_evidence_ids: string[];
  }>;
  expected: {
    inputCount: number;
    outputCount: number;
    reasonCount: number;
    playerCount: number;
    leagueCount: number;
  };
};

type PersistenceInspection = {
  projectionRunId: string;
  runStatus: string;
  inputCount: number;
  outputCount: number;
  reasonCount: number;
  distinctInputPlayers: number;
  distinctOutputPlayers: number;
  distinctOutputLeagues: number;
  duplicateOutputKeys: number;
  duplicateReasonKeys: number;
  missingPlayerLeagueOutputs: number;
  complete: boolean;
};

function supabase(): SupabaseClient<any> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase environment: NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and service or anon key are required.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function assertExecuteSelection(args: ReturnType<typeof parseArgs>) {
  if (!args.execute) return;
  if (args.explicitLimit && !args.allowPartialExecute) {
    throw new Error("--execute with --limit requires --allow-partial-execute.");
  }
  if (!args.all && !args.position && !args.leagueId && !args.allowPartialExecute) {
    throw new Error("--execute default partial selection requires --allow-partial-execute. Use --all, --position, --league-id, or allow partial execution explicitly.");
  }
}

function loadComponentArtifact(historicalSeason: number, projectionSeason: number): H92Artifact {
  const file = path.join(
    process.cwd(),
    "artifacts",
    "projections",
    `h9-components-${historicalSeason}-to-${projectionSeason}.json`
  );
  if (!existsSync(file)) {
    throw new Error(`Missing H9.2 component artifact: ${file}. Run npm run dry-run:h9-components first.`);
  }
  const artifact = JSON.parse(readFileSync(file, "utf8")) as H92Artifact;
  if (artifact.historicalSeason !== historicalSeason || artifact.projectionSeason !== projectionSeason) {
    throw new Error(`H9.2 artifact season mismatch in ${file}`);
  }
  return artifact;
}

function rosterPositions(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function scoringType(settings: Record<string, unknown> | null): string | null {
  const raw = settings?.scoring_type ?? settings?.scoringType ?? settings?.scoring_format ?? settings?.scoringFormat;
  return typeof raw === "string" ? raw : null;
}

async function loadLeagues(
  client: SupabaseClient<any>,
  projectionSeason: number,
  leagueId: string | null
): Promise<LeagueProjectionLeagueInput[]> {
  const rows = await loadAllPagesWith<LeagueDbRow>(
    (from, to) => {
      let q = client
        .from("leagues")
        .select("id,name,season,total_teams,is_superflex,is_two_qb,te_premium,scoring_settings_json,roster_positions_json,settings_json")
        .eq("season", projectionSeason)
        .range(from, to);
      if (leagueId) q = q.eq("id", leagueId);
      return q;
    },
    { table: "leagues" }
  );

  return rows
    .map((row) => ({
      leagueId: row.id,
      leagueName: row.name ?? row.id,
      season: Number(row.season ?? projectionSeason),
      teamCount: row.total_teams,
      scoringType: scoringType(row.settings_json),
      superflex: Boolean(row.is_superflex || row.is_two_qb),
      tePremium: Boolean(row.te_premium),
      startingRosterSettings: rosterPositions(row.roster_positions_json),
      scoringSettings: row.scoring_settings_json ?? {},
    }))
    .sort((a, b) => a.leagueId.localeCompare(b.leagueId));
}

function filterPlayers(
  projections: PlayerStatProjection[],
  args: ReturnType<typeof parseArgs>
): PlayerStatProjection[] {
  let players = projections;
  if (args.position) players = players.filter((player) => player.position === args.position);
  if (args.playerId) players = players.filter((player) => player.canonicalPlayerId === args.playerId);
  players = [...players].sort((a, b) =>
    a.position.localeCompare(b.position) ||
    a.canonicalPlayerId.localeCompare(b.canonicalPlayerId)
  );
  return args.all ? players : players.slice(0, args.limit);
}

function countsBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce<Record<T, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {} as Record<T, number>);
}

function topByLeaguePosition(outputs: LeagueProjectionOutput[]) {
  return outputs
    .filter((output) => output.projectedPositionRank <= 5)
    .map((output) => ({
      leagueId: output.leagueId,
      leagueName: output.leagueName,
      position: output.position,
      rank: output.projectedPositionRank,
      canonicalPlayerId: output.canonicalPlayerId,
      medianPoints: output.medianPoints,
      ceilingPoints: output.ceilingPoints,
      projectedPPGWhenInRole: output.projectedPPGWhenInRole,
    }));
}

function largestReasonEffects(outputs: LeagueProjectionOutput[], reasonCode: string) {
  return outputs
    .filter((output) => output.leagueSpecificReasons.includes(reasonCode as any))
    .slice()
    .sort((a, b) => Math.abs(b.medianPoints) - Math.abs(a.medianPoints))
    .slice(0, 10)
    .map((output) => ({
      leagueId: output.leagueId,
      canonicalPlayerId: output.canonicalPlayerId,
      position: output.position,
      medianPoints: output.medianPoints,
      reasons: output.leagueSpecificReasons,
    }));
}

function activeScoringKeys(leagues: LeagueProjectionLeagueInput[]): string[] {
  return [...new Set(leagues.flatMap((league) =>
    Object.entries(league.scoringSettings)
      .filter(([, value]) => Number(value) !== 0)
      .map(([key]) => key)
  ))].sort();
}

function classifyScoringKey(key: string, leagueCount: number) {
  const adapterKeys = new Set(h93AdapterStatKeys());
  const knownZero = new Set(h94KnownZeroOrExcludedKeys());
  const unsupportedBlocking = new Set(h94ProjectionUnsupportedBlockingKeys());
  const definition = getScoringKeyDefinition(key);
  const positions = definition?.allowedPositions ?? [];
  const looksNonOffensive = /^(idp_|def_|st_|fg|xpm|xp|pts_allow|yds_allow|blk_kick|safe$|sack$|int$|ff$|bonus_def_|bonus_sack|bonus_tkl)/.test(key);
  const support = adapterKeys.has(key)
    ? "supported_projected"
    : knownZero.has(key)
      ? "supported_known_zero_or_excluded"
      : unsupportedBlocking.has(key)
        ? "unsupported_blocking"
        : definition
          ? "excluded_non_offensive_or_not_applicable"
          : looksNonOffensive
            ? "excluded_non_offensive_or_not_applicable"
            : "unsupported_blocking";
  const classification =
    support === "supported_projected" ? (key.includes("40") || key.includes("50") ? "PROJECTABLE_APPROXIMATION" : "PROJECTABLE_NOW") :
      support === "supported_known_zero_or_excluded" ? "KNOWN_ZERO_OR_NOT_APPLICABLE" :
        support === "excluded_non_offensive_or_not_applicable" ? "EXCLUDED_NON_OFFENSIVE" :
          "UNSUPPORTED_BLOCKING";
  return {
    scoringKey: key,
    numberOfLeaguesUsingIt: leagueCount,
    positionsApplicable: positions.length ? positions : ["UNKNOWN_OR_NON_OFFENSIVE"],
    currentScoringEngineSupport: definition ? "supported_or_known" : "unknown",
    currentProjectionComponentSupport: support,
    materiality: positions.some((p) => ["QB", "RB", "WR", "TE"].includes(p)) || !definition ? "can_change_offensive_projection" : "non_offensive",
    classification,
    recommendedAction:
      classification === "UNSUPPORTED_BLOCKING" ? "Add projection component, alias, or explicit exclusion policy before scoring-ready output." :
        classification === "PROJECTABLE_APPROXIMATION" ? "Use bounded approximation and reason-code diagnostics." :
          classification === "KNOWN_ZERO_OR_NOT_APPLICABLE" ? "Keep explicit zero/exclusion policy visible in diagnostics." :
            "No H9.4 action required for offensive projection readiness.",
  };
}

async function assertProjectionTables(client: SupabaseClient<any>) {
  const tables = [
    ["projection_runs", "projection_run_id"],
    ["player_projection_inputs", "input_id"],
    ["player_projection_outputs", "output_id"],
    ["projection_reasons", "reason_id"],
  ] as const;
  for (const [table, column] of tables) {
    const { error } = await client.from(table).select(column, { count: "exact", head: true });
    if (error) {
      throw new Error(`H9.5 BLOCKED — projection tables missing (${table}: ${error.message})`);
    }
  }
}

function selectionScope(args: ReturnType<typeof parseArgs>): string {
  const parts = [];
  if (args.all) parts.push("all");
  if (args.position) parts.push(`position:${args.position}`);
  if (args.playerId) parts.push(`player:${args.playerId}`);
  if (args.leagueId) parts.push(`league:${args.leagueId}`);
  if (!args.all && !args.position && !args.playerId && !args.leagueId) parts.push(`default-limit:${args.limit}`);
  if (!args.all && args.explicitLimit) parts.push(`limit:${args.limit}`);
  return parts.join("|");
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function codeVersion(): string {
  return process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "local";
}

function scenarioComponents(player: PlayerStatProjection) {
  return {
    downside: player.downsideComponents,
    floor: player.floorComponents,
    median: player.medianComponents,
    ceiling: player.ceilingComponents,
    upside: player.upsideComponents,
    downsideGames: player.roleFoundation.projectedAvailability.projectedRoleGames.floor,
    floorGames: player.roleFoundation.projectedAvailability.projectedRoleGames.floor,
    medianGames: player.roleFoundation.projectedAvailability.projectedRoleGames.median,
    ceilingGames: player.roleFoundation.projectedAvailability.projectedRoleGames.ceiling,
    upsideGames: player.roleFoundation.projectedAvailability.projectedRoleGames.ceiling,
  };
}

function reasonScope(code: ReasonCode): ReasonScope {
  const allowed = REASON_CODES[code]?.allowedScopes;
  if (allowed?.length) return allowed[0];
  if (code.includes("FUMBLE")) return "fumbles";
  if (code.includes("FIRST_DOWN")) return "first_downs";
  if (code.includes("SACK")) return "sacks";
  if (code.includes("LONG") || code.includes("PICK_SIX")) return "long_play";
  if (code.includes("THRESHOLD")) return "threshold_bonus";
  if (code.includes("RETURN")) return "returns";
  if (code.includes("MARKET")) return "market";
  if (code.includes("EFFICIENCY") || code.includes("RATE")) return "efficiency";
  if (code.includes("SCORING") || code.includes("PPR") || code.includes("PREMIUM")) return "league_scoring";
  return "projection";
}

function reasonExplanation(code: ReasonCode): string {
  return REASON_CODES[code]?.explanationTemplate ?? code;
}

function addReason(
  rows: ProjectionWritePlan["reasonsWithoutRun"],
  seen: Set<string>,
  opts: {
    canonicalPlayerId: string;
    leagueId: string | null;
    code: ReasonCode;
  }
) {
  const scope = reasonScope(opts.code);
  const key = `${opts.canonicalPlayerId}|${opts.leagueId ?? "GLOBAL"}|${opts.code}|${scope}`;
  if (seen.has(key)) return;
  seen.add(key);
  rows.push({
    canonical_player_id: opts.canonicalPlayerId,
    league_id: opts.leagueId,
    reason_code: opts.code,
    reason_scope: scope,
    direction: REASON_CODES[opts.code]?.defaultDirection ?? "neutral",
    magnitude: null,
    explanation: reasonExplanation(opts.code),
    source_evidence_ids: [],
  });
}

function buildWritePlan(opts: {
  args: ReturnType<typeof parseArgs>;
  players: PlayerStatProjection[];
  leagues: LeagueProjectionLeagueInput[];
  outputs: LeagueProjectionOutput[];
}): ProjectionWritePlan {
  const scope = selectionScope(opts.args);
  const scoringConfigHashes = Object.fromEntries(
    opts.leagues
      .map((league) => [league.leagueId, hashScoringConfig(league.leagueId, league.scoringSettings)] as const)
      .sort(([a], [b]) => a.localeCompare(b))
  );
  const semanticInputHash = runSemanticHash({
    projection: {
      method: PROJECTION_METHOD,
      version: PROJECTION_VERSION,
      historicalSeason: opts.args.historicalSeason,
      projectionSeason: opts.args.projectionSeason,
      leagueConfigSeason: opts.args.projectionSeason,
      contextVersion: 1,
    },
    modelConfig: MODEL_CONFIG,
    population: {
      scope,
      playerProjectionInputHashes: opts.players.map((player) => player.playerProjectionInputHash),
    },
    leagues: { scoringConfigHashes },
    reasonCodeRegistryVersion: REASON_CODE_REGISTRY_VERSION,
  });
  const playerById = new Map(opts.players.map((player) => [player.canonicalPlayerId, player]));
  const inputs = opts.players.map((player) => {
    const foundation = player.roleFoundation;
    return {
      canonical_player_id: player.canonicalPlayerId,
      position: player.position,
      role_sample_class: foundation.roleSampleClass,
      role_sample_confidence: foundation.roleSampleConfidence,
      games_confidence: foundation.projectedAvailability.gamesConfidence,
      historical_active_weeks: foundation.historicalActiveWeeks,
      historical_role_weeks: foundation.historicalRoleWeeks,
      role_participation_factor: foundation.roleParticipationFactor,
      projected_active_games_floor: Math.round(foundation.projectedAvailability.projectedActiveGames.floor),
      projected_active_games_median: Math.round(foundation.projectedAvailability.projectedActiveGames.median),
      projected_active_games_ceiling: Math.round(foundation.projectedAvailability.projectedActiveGames.ceiling),
      projected_role_games_floor: Math.round(foundation.projectedAvailability.projectedRoleGames.floor),
      projected_role_games_median: Math.round(foundation.projectedAvailability.projectedRoleGames.median),
      projected_role_games_ceiling: Math.round(foundation.projectedAvailability.projectedRoleGames.ceiling),
      model_uncertainty: foundation.modelUncertainty,
      player_volatility: foundation.playerVolatility,
      total_range_width: foundation.totalRangeWidth,
      projection_confidence_score: foundation.projectionConfidence.projectionConfidenceScore,
      projection_confidence_label: foundation.projectionConfidence.projectionConfidenceLabel,
      h8_snapshot_id: player.h8SnapshotId ?? null,
      adp_record_ids: [],
      player_data_hash: player.playerDataHash,
      player_projection_input_hash: player.playerProjectionInputHash,
    };
  });
  const outputs = opts.outputs.map((output) => {
    const player = playerById.get(output.canonicalPlayerId);
    if (!player) throw new Error(`Missing component projection for output player ${output.canonicalPlayerId}`);
    const foundation = player.roleFoundation;
    return {
      canonical_player_id: output.canonicalPlayerId,
      league_id: output.leagueId,
      position: output.position,
      projected_ppg_when_in_role: output.projectedPPGWhenInRole ?? 0,
      floor_ppg: output.floorPPGWhenInRole ?? 0,
      ceiling_ppg: output.ceilingPPGWhenInRole ?? 0,
      downside_points: output.downsidePoints,
      floor_points: output.floorPoints,
      median_points: output.medianPoints,
      ceiling_points: output.ceilingPoints,
      upside_points: output.upsidePoints,
      model_uncertainty: foundation.modelUncertainty,
      player_volatility: foundation.playerVolatility,
      total_range_width: foundation.totalRangeWidth,
      projection_confidence_score: foundation.projectionConfidence.projectionConfidenceScore,
      projection_confidence_label: foundation.projectionConfidence.projectionConfidenceLabel,
      market_agreement_score: null,
      market_discrepancy: null,
      market_discrepancy_label: null,
      projected_position_rank: output.projectedPositionRank,
      projected_components_json: scenarioComponents(player),
      projection_method: PROJECTION_METHOD,
      player_projection_input_hash: player.playerProjectionInputHash,
    };
  });
  const reasonsWithoutRun: ProjectionWritePlan["reasonsWithoutRun"] = [];
  const seenReasons = new Set<string>();
  for (const player of opts.players) {
    for (const code of player.componentReasons) {
      addReason(reasonsWithoutRun, seenReasons, {
        canonicalPlayerId: player.canonicalPlayerId,
        leagueId: null,
        code,
      });
    }
  }
  for (const output of opts.outputs) {
    for (const code of output.leagueSpecificReasons) {
      addReason(reasonsWithoutRun, seenReasons, {
        canonicalPlayerId: output.canonicalPlayerId,
        leagueId: output.leagueId,
        code,
      });
    }
  }
  return {
    run: {
      projection_version: PROJECTION_VERSION,
      historical_season: opts.args.historicalSeason,
      projection_season: opts.args.projectionSeason,
      league_config_season: opts.args.projectionSeason,
      context_version: 1,
      as_of_date: todayIsoDate(),
      method: PROJECTION_METHOD,
      code_version: codeVersion(),
      model_config_json: MODEL_CONFIG,
      semantic_input_hash: semanticInputHash,
      selection_scope: scope,
      run_status: "ready_to_persist",
      population_count: opts.players.length,
      league_count: opts.leagues.length,
      input_count: opts.players.length,
      output_count: opts.outputs.length,
      reason_count: reasonsWithoutRun.length,
    },
    semanticInputHash,
    inputs,
    outputs,
    reasonsWithoutRun,
    expected: {
      inputCount: opts.players.length,
      outputCount: opts.outputs.length,
      reasonCount: reasonsWithoutRun.length,
      playerCount: opts.players.length,
      leagueCount: opts.leagues.length,
    },
  };
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

async function getOrCreateRun(client: SupabaseClient<any>, plan: ProjectionWritePlan): Promise<ProjectionRunDbRow> {
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
      .update({
        run_status: existing.run_status === "complete" ? "complete" : "persisting",
        failure_code: null,
        failure_message: null,
      })
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

async function inspectRun(
  client: SupabaseClient<any>,
  projectionRunId: string,
  expected?: ProjectionWritePlan["expected"]
): Promise<PersistenceInspection> {
  const run = await retryTransient("projection_runs inspect", async () => {
    const { data, error } = await client
      .from("projection_runs")
      .select("projection_run_id,run_status")
      .eq("projection_run_id", projectionRunId)
      .single();
    if (error) throw error;
    return data as ProjectionRunDbRow;
  });
  const inputRows = await loadAllPagesWith<{ canonical_player_id: string }>(
    (from, to) => client
      .from("player_projection_inputs")
      .select("canonical_player_id")
      .eq("projection_run_id", projectionRunId)
      .order("canonical_player_id", { ascending: true })
      .range(from, to),
    { table: "player_projection_inputs" }
  );
  const outputRows = await loadAllPagesWith<{ canonical_player_id: string; league_id: string }>(
    (from, to) => client
      .from("player_projection_outputs")
      .select("canonical_player_id,league_id")
      .eq("projection_run_id", projectionRunId)
      .order("canonical_player_id", { ascending: true })
      .order("league_id", { ascending: true })
      .range(from, to),
    { table: "player_projection_outputs" }
  );
  const reasonRows = await loadAllPagesWith<{ reason_key: string }>(
    (from, to) => client
      .from("projection_reasons")
      .select("reason_key")
      .eq("projection_run_id", projectionRunId)
      .order("reason_key", { ascending: true })
      .range(from, to),
    { table: "projection_reasons" }
  );
  const outputKeys = outputRows.map((row) => `${row.canonical_player_id}|${row.league_id}`);
  const reasonKeys = reasonRows.map((row) => row.reason_key);
  const duplicateOutputKeys = outputKeys.length - new Set(outputKeys).size;
  const duplicateReasonKeys = reasonKeys.length - new Set(reasonKeys).size;
  const missingPlayerLeagueOutputs = expected
    ? Math.max(0, expected.playerCount * expected.leagueCount - new Set(outputKeys).size)
    : 0;
  const complete = Boolean(
    (!expected || (
      inputRows.length === expected.inputCount &&
      outputRows.length === expected.outputCount &&
      reasonRows.length === expected.reasonCount &&
      missingPlayerLeagueOutputs === 0
    )) &&
    duplicateOutputKeys === 0 &&
    duplicateReasonKeys === 0
  );
  return {
    projectionRunId,
    runStatus: run.run_status,
    inputCount: inputRows.length,
    outputCount: outputRows.length,
    reasonCount: reasonRows.length,
    distinctInputPlayers: new Set(inputRows.map((row) => row.canonical_player_id)).size,
    distinctOutputPlayers: new Set(outputRows.map((row) => row.canonical_player_id)).size,
    distinctOutputLeagues: new Set(outputRows.map((row) => row.league_id)).size,
    duplicateOutputKeys,
    duplicateReasonKeys,
    missingPlayerLeagueOutputs,
    complete,
  };
}

async function inspectByHash(
  client: SupabaseClient<any>,
  semanticInputHash: string,
  expected?: ProjectionWritePlan["expected"]
) {
  const { data, error } = await client
    .from("projection_runs")
    .select("projection_run_id,run_status")
    .eq("semantic_input_hash", semanticInputHash)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return inspectRun(client, (data as ProjectionRunDbRow).projection_run_id, expected);
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

async function persistPlan(client: SupabaseClient<any>, plan: ProjectionWritePlan) {
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
        reason_key: reasonKey({
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
    if (!inspection.complete) {
      throw new Error(`Post-write inspection failed: ${JSON.stringify(inspection)}`);
    }
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
    return {
      projectionRunId,
      reusedCompleteRun: run.run_status === "complete",
      batchResults,
      inspection: { ...inspection, runStatus: "complete", complete: true },
    };
  } catch (error) {
    if (error instanceof InterruptedError) {
      await client.from("projection_runs").update({ run_status: "interrupted" }).eq("projection_run_id", projectionRunId);
    } else {
      await markRunFailed(client, projectionRunId, "H9_5_PERSISTENCE_FAILED", error instanceof Error ? error.message : String(error));
    }
    throw error;
  } finally {
    activePersistenceClient = null;
    activePersistenceRunId = null;
  }
}

async function main() {
  const args = parseArgs();
  assertExecuteSelection(args);
  const client = supabase();
  const dryRunId = `h9.3-${args.historicalSeason}-to-${args.projectionSeason}-${new Date().toISOString()}`;
  const componentArtifact = loadComponentArtifact(args.historicalSeason, args.projectionSeason);
  const players = filterPlayers(componentArtifact.projections, args);
  if (players.length === 0) throw new Error("No H9.2 component projections matched the requested filters.");

  const leagues = await loadLeagues(client, args.projectionSeason, args.leagueId);
  if (leagues.length === 0) throw new Error("No owned league configs matched the requested filters.");

  const result = projectLeagueProjectionPopulation({ players, leagues, dryRunId });
  const plan = buildWritePlan({ args, players, leagues, outputs: result.outputs });
  if (args.execute || args.inspectPersistence) {
    await assertProjectionTables(client);
  }
  const persistenceInspection = args.inspectPersistence
    ? await inspectByHash(client, plan.semanticInputHash, plan.expected)
    : null;
  const keyCounts = new Map<string, number>();
  for (const league of leagues) {
    for (const key of activeScoringKeys([league])) keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  }
  const scoringKeyAudit = [...keyCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => classifyScoringKey(key, count));
  const readinessCounts = countsBy(result.leagueDiagnostics.map((diagnostic) => diagnostic.readiness));
  const unsupportedMaterialLeagues = result.leagueDiagnostics.filter(
    (diagnostic) =>
      diagnostic.unsupportedOffensiveScoringKeys.length > 0 ||
      diagnostic.projectionUnsupportedScoringKeys.length > 0
  );
  const scenarioOrderingFailures = result.invariantFailures;
  const artifact = {
    dryRunId,
    historicalSeason: args.historicalSeason,
    projectionSeason: args.projectionSeason,
    sourceComponentArtifact: `artifacts/projections/h9-components-${args.historicalSeason}-to-${args.projectionSeason}.json`,
    selection: {
      all: args.all,
      position: args.position,
      limit: args.all ? null : args.limit,
      playerId: args.playerId,
      leagueId: args.leagueId,
    },
    adapterStatKeys: h93AdapterStatKeys(),
    leagueCount: leagues.length,
    playerCount: players.length,
    playerLeagueOutputCount: result.outputs.length,
    persistencePlan: {
      semanticInputHash: plan.semanticInputHash,
      selectionScope: plan.run.selection_scope,
      expectedInputCount: plan.expected.inputCount,
      expectedOutputCount: plan.expected.outputCount,
      expectedReasonCount: plan.expected.reasonCount,
      phaseAReady: true,
    },
    persistenceInspection,
    readinessCounts,
    leagueDiagnostics: result.leagueDiagnostics,
    positionCounts: countsBy(players.map((player) => player.position)),
    outputCountsByPosition: countsBy(result.outputs.map((output) => output.position)),
    topPlayersByPositionPerLeague: topByLeaguePosition(result.outputs),
    largestPprEffects: largestReasonEffects(result.outputs, "PPR_SCORING_IMPACT"),
    largestTePremiumEffects: largestReasonEffects(result.outputs, "TE_PREMIUM_SCORING_IMPACT"),
    largestFumblePenaltyEffects: largestReasonEffects(result.outputs, "FUMBLE_PENALTY_IMPACT"),
    largestInterceptionPenaltyEffects: largestReasonEffects(result.outputs, "INTERCEPTION_PENALTY_IMPACT"),
    negativeFloorOutputs: result.outputs
      .filter((output) => output.floorPoints < 0 || output.downsidePoints < 0)
      .map((output) => ({
        leagueId: output.leagueId,
        canonicalPlayerId: output.canonicalPlayerId,
        position: output.position,
        downsidePoints: output.downsidePoints,
        floorPoints: output.floorPoints,
      })),
    scenarioOrderingFailures,
    unsupportedMaterialLeagues,
    representativeOutputs: result.outputs.slice(0, 25),
    outputs: result.outputs,
  };
  const auditArtifact = {
    dryRunId,
    projectionSeason: args.projectionSeason,
    leagueCount: leagues.length,
    sourceDataAvailability: {
      weeklyPlayerStats: ["pass_fd", "rush_fd", "rec_fd", "pass_sack"],
      weeklyDerivedStats: ["pass_pick6", "fum_ret_td", "rec_td_40p", "rec_td_50p", "rush_td_40p", "rush_td_50p"],
      absentOrUnsupportedForOffensiveProjection: ["kr_yd", "pr_yd", "return_td", "return_fd"],
    },
    scoringKeys: scoringKeyAudit,
  };

  const outDir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `h9-league-projections-${args.historicalSeason}-to-${args.projectionSeason}.json`);
  const auditPath = path.join(outDir, `h9-scoring-key-audit-${args.projectionSeason}.json`);
  writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
  writeFileSync(auditPath, `${JSON.stringify(auditArtifact, null, 2)}\n`);

  console.log(JSON.stringify({
    dryRunId,
    artifact: outPath,
    scoringKeyAuditArtifact: auditPath,
    leagueCount: leagues.length,
    playerCount: players.length,
    playerLeagueOutputCount: result.outputs.length,
    semanticInputHash: plan.semanticInputHash,
    persistenceExpectedCounts: plan.expected,
    persistenceInspection,
    readinessCounts,
    scenarioOrderingFailureCount: scenarioOrderingFailures.length,
    unsupportedMaterialLeagueCount: unsupportedMaterialLeagues.length,
  }, null, 2));

  if (scenarioOrderingFailures.length > 0) {
    throw new Error(`H9.3 scenario ordering invariant failed for ${scenarioOrderingFailures.length} output(s).`);
  }
  if (unsupportedMaterialLeagues.length > 0) {
    throw new Error(`H9.3 unsupported material offensive scoring in ${unsupportedMaterialLeagues.length} league(s).`);
  }
  if (args.execute) {
    if (interrupted) throw new InterruptedError();
    const persistence = await persistPlan(client, plan);
    console.log(JSON.stringify({
      h95Persistence: persistence,
    }, null, 2));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
