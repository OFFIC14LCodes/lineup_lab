// H9.1 — Role Foundation Dry-Run Diagnostic
//
// Loads 2025 weekly stats and H8 context snapshots, runs buildRoleProjectionFoundation
// for a sample of players, and prints structured diagnostic output.
// DOES NOT write any data to the database.
//
// Usage:
//   npm run dry-run:h9-role-foundation
//   npm run dry-run:h9-role-foundation -- --position WR --limit 20
//   npm run dry-run:h9-role-foundation -- --player-id <uuid>
//   npm run dry-run:h9-role-foundation -- --all
//
// Options:
//   --historical-season <year>   Stats season to use (default: 2025)
//   --projection-season <year>   Target projection season (default: 2026)
//   --all                        Process all eligible players
//   --position <pos>             Filter to QB | RB | WR | TE
//   --limit <n>                  Stratified sample of N players (default: 40)
//   --player-id <uuid>           Single player spot check
//   --verbose                    Print per-field H8 evaluation detail

import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { loadAllPagesWith } from "@/lib/context/paginated-loader";
import { REGULAR_SEASON_PLAYER, SKILL_POSITIONS } from "@/lib/context/season-type";
import type { BlackbirdDerivedContext } from "@/lib/context/types";
import type { HistoricalPlayerProjectionInput, H8ContextFields, H8FieldSnapshot } from "@/lib/projections/types";
import { normalizePlayerStats } from "@/lib/projections/normalize";
import { buildRoleProjectionFoundation } from "@/lib/projections/foundation";

// --------------------------------------------------------------------------
// Env loader
// --------------------------------------------------------------------------

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
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadLocalEnv();

// --------------------------------------------------------------------------
// Arg parser
// --------------------------------------------------------------------------

function parseArgs() {
  const argv = process.argv.slice(2);
  const flag = (name: string, def: string | null = null) => {
    const i = argv.indexOf(name);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
  };
  const has = (name: string) => argv.includes(name);

  return {
    historicalSeason: parseInt(flag("--historical-season", "2025") ?? "2025", 10),
    projectionSeason: parseInt(flag("--projection-season", "2026") ?? "2026", 10),
    all: has("--all"),
    position: flag("--position"),
    limit: parseInt(flag("--limit", "40") ?? "40", 10),
    playerId: flag("--player-id"),
    verbose: has("--verbose"),
  };
}

// --------------------------------------------------------------------------
// DB types
// --------------------------------------------------------------------------

type WeeklyStatDbRow = {
  player_id: string;
  season: number;
  week: number;
  position_group: string;
  stats_json: Record<string, unknown>;
};

type DerivedStatDbRow = {
  player_id: string;
  week: number;
  season: number;
  fum_ret_td: number | null;
};

type PlayerContextDbRow = {
  id: string;
  canonical_player_id: string;
  derived_context_json: string | null;
};

type PlayerDetailRow = {
  id: string;
  position: string | null;
};

// --------------------------------------------------------------------------
// Data loaders
// --------------------------------------------------------------------------

async function loadWeeklyStats(
  supabase: SupabaseClient<any>,
  season: number,
  playerIds?: string[]
): Promise<WeeklyStatDbRow[]> {
  console.log("  Loading player_weekly_stats...");
  return loadAllPagesWith<WeeklyStatDbRow>(
    (from, to) => {
      let q = supabase
        .from("player_weekly_stats")
        .select("player_id, season, week, position_group, stats_json")
        .eq("season", season)
        .eq("season_type", REGULAR_SEASON_PLAYER)
        .in("position_group", [...SKILL_POSITIONS])
        .range(from, to);
      if (playerIds?.length) q = q.in("player_id", playerIds);
      return q;
    },
    { table: "player_weekly_stats" }
  );
}

async function loadDerivedStats(
  supabase: SupabaseClient<any>,
  season: number,
  playerIds?: string[]
): Promise<DerivedStatDbRow[]> {
  console.log("  Loading player_weekly_derived_stats...");
  return loadAllPagesWith<DerivedStatDbRow>(
    (from, to) => {
      let q = supabase
        .from("player_weekly_derived_stats")
        .select("player_id, week, season, fum_ret_td")
        .eq("season", season)
        .range(from, to);
      if (playerIds?.length) q = q.in("player_id", playerIds);
      return q;
    },
    { table: "player_weekly_derived_stats" }
  );
}

async function loadH8Snapshots(
  supabase: SupabaseClient<any>,
  season: number,
  playerIds?: string[]
): Promise<PlayerContextDbRow[]> {
  console.log("  Loading player_context_snapshots...");
  return loadAllPagesWith<PlayerContextDbRow>(
    (from, to) => {
      let q = supabase
        .from("player_context_snapshots")
        .select("id, canonical_player_id, derived_context_json")
        .eq("season", season)
        .range(from, to);
      if (playerIds?.length) q = q.in("canonical_player_id", playerIds);
      return q;
    },
    { table: "player_context_snapshots" }
  );
}

async function loadPlayerDetails(
  supabase: SupabaseClient<any>,
  playerIds: string[]
): Promise<PlayerDetailRow[]> {
  if (!playerIds.length) return [];
  return loadAllPagesWith<PlayerDetailRow>(
    (from, to) =>
      supabase
        .from("canonical_players")
        .select("id, position")
        .in("id", playerIds)
        .range(from, to),
    { table: "canonical_players" }
  );
}

// --------------------------------------------------------------------------
// H8 context extraction
// --------------------------------------------------------------------------

const UNKNOWN_SNAP: H8FieldSnapshot = {
  value: null,
  status: "unknown",
  confidence: "unresolved",
  sourceEvidenceIds: [],
};

function extractH8Fields(derivedContextJson: string | null): H8ContextFields {
  if (!derivedContextJson) return allUnknown();
  let ctx: BlackbirdDerivedContext;
  try {
    ctx = JSON.parse(derivedContextJson) as BlackbirdDerivedContext;
  } catch {
    return allUnknown();
  }
  return {
    priorTargetShare: snapFromCtx(ctx.priorTargetShare),
    priorCarryShare: snapFromCtx(ctx.priorCarryShare),
    priorRedZoneShare: snapFromCtx(ctx.priorRedZoneShare),
    priorGoalLineShare: snapFromCtx(ctx.priorGoalLineShare),
    priorTeamPassRate: snapFromCtx(ctx.priorTeamPassRate),
    priorTeamRushRate: snapFromCtx(ctx.priorTeamRushRate),
    priorEarlyDownPassRate: snapFromCtx(ctx.priorEarlyDownPassRate),
  };
}

function snapFromCtx(field: BlackbirdDerivedContext[keyof BlackbirdDerivedContext] | undefined): H8FieldSnapshot {
  if (!field || typeof field !== "object") return UNKNOWN_SNAP;
  const f = field as { value?: unknown; status?: unknown; confidence?: unknown; evidenceIds?: unknown[] };
  return {
    value: typeof f.value === "number" ? f.value : null,
    status: (f.status as H8FieldSnapshot["status"]) ?? "unknown",
    confidence: (f.confidence as H8FieldSnapshot["confidence"]) ?? "unresolved",
    sourceEvidenceIds: Array.isArray(f.evidenceIds) ? f.evidenceIds as string[] : [],
  };
}

function allUnknown(): H8ContextFields {
  return {
    priorTargetShare: UNKNOWN_SNAP,
    priorCarryShare: UNKNOWN_SNAP,
    priorRedZoneShare: UNKNOWN_SNAP,
    priorGoalLineShare: UNKNOWN_SNAP,
    priorTeamPassRate: UNKNOWN_SNAP,
    priorTeamRushRate: UNKNOWN_SNAP,
    priorEarlyDownPassRate: UNKNOWN_SNAP,
  };
}

// --------------------------------------------------------------------------
// Stratified sample
// --------------------------------------------------------------------------

function stratifiedSample<T extends { position: string }>(
  players: T[],
  positions: string[],
  limit: number
): T[] {
  const perPos = Math.floor(limit / positions.length);
  const result: T[] = [];
  for (const pos of positions) {
    const pool = players.filter(p => p.position === pos);
    result.push(...pool.slice(0, perPos));
  }
  return result.slice(0, limit);
}

// --------------------------------------------------------------------------
// Diagnostic printing
// --------------------------------------------------------------------------

function printDiagnostic(
  foundation: ReturnType<typeof buildRoleProjectionFoundation>,
  verbose: boolean
) {
  const ag = foundation.projectedAvailability.projectedActiveGames;
  const rg = foundation.projectedAvailability.projectedRoleGames;

  console.log(`  Player:     ${foundation.canonicalPlayerId}`);
  console.log(`  Position:   ${foundation.position}`);
  console.log(`  Class:      ${foundation.roleSampleClass} (${foundation.roleSampleConfidence})`);
  console.log(`  ActiveWeeks:${foundation.historicalActiveWeeks}  RoleWeeks:${foundation.historicalRoleWeeks}  RolePF:${foundation.roleParticipationFactor.toFixed(2)}`);
  console.log(`  Totals:     att=${foundation.totals.totalPassAttempts} car=${foundation.totals.totalCarries} tgt=${foundation.totals.totalTargets}`);
  console.log(`  ActiveGames:floor=${ag.floor} med=${ag.median} ceil=${ag.ceiling} [${foundation.projectedAvailability.gamesConfidence}]`);
  console.log(`  RoleGames:  floor=${rg.floor} med=${rg.median} ceil=${rg.ceiling}`);
  console.log(`  H8:         applObs=${foundation.h8Evaluation.applicableObserved} applUnk=${foundation.h8Evaluation.applicableUnknown} contr=${foundation.h8Evaluation.hasContradictory} stale=${foundation.h8Evaluation.hasStale}`);
  console.log(`  Confidence: ${foundation.projectionConfidence.projectionConfidenceScore.toFixed(3)} [${foundation.projectionConfidence.projectionConfidenceLabel}]`);
  console.log(`  Uncertainty:mu=${foundation.modelUncertainty.toFixed(3)} vol=${foundation.playerVolatility.toFixed(3)} range=${foundation.totalRangeWidth.toFixed(3)}`);
  console.log(`  Reasons:    ${foundation.allReasonCodes.join(", ") || "(none)"}`);

  if (verbose && foundation.h8Evaluation.fieldEvaluations.length > 0) {
    console.log("  H8 fields:");
    for (const fe of foundation.h8Evaluation.fieldEvaluations) {
      if (fe.applicability === "not_applicable") continue;
      console.log(`    ${fe.fieldName}: [${fe.applicability}] ${fe.status}/${fe.confidence} value=${fe.value ?? "null"}`);
    }
  }
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

async function main() {
  const args = parseArgs();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`\nH9.1 Role Foundation Dry-Run`);
  console.log(`  Historical season: ${args.historicalSeason}`);
  console.log(`  Projection season: ${args.projectionSeason}`);
  console.log(`  Mode: ${args.playerId ? `player=${args.playerId}` : args.all ? "all" : args.position ? `position=${args.position}` : `limit=${args.limit}`}\n`);

  // --- Load weekly stats ---
  console.log("Phase A: Loading data...");
  const filterIds = args.playerId ? [args.playerId] : undefined;
  const weeklyRows = await loadWeeklyStats(supabase, args.historicalSeason, filterIds);
  const derivedRows = await loadDerivedStats(supabase, args.historicalSeason, filterIds);
  console.log(`  weekly_stats rows: ${weeklyRows.length}`);
  console.log(`  derived_stats rows: ${derivedRows.length}`);

  // Group by player
  const statsByPlayer = new Map<string, WeeklyStatDbRow[]>();
  for (const row of weeklyRows) {
    if (!statsByPlayer.has(row.player_id)) statsByPlayer.set(row.player_id, []);
    statsByPlayer.get(row.player_id)!.push(row);
  }

  const fumRetTdByPlayerWeek = new Map<string, number>();
  for (const row of derivedRows) {
    fumRetTdByPlayerWeek.set(`${row.player_id}:${row.week}`, row.fum_ret_td ?? 0);
  }

  // Determine player IDs in scope
  let scopedPlayerIds = [...statsByPlayer.keys()];
  if (args.playerId) {
    scopedPlayerIds = [args.playerId];
  } else if (args.position) {
    scopedPlayerIds = weeklyRows
      .filter(r => r.position_group.toUpperCase() === args.position!.toUpperCase())
      .map(r => r.player_id)
      .filter((v, i, a) => a.indexOf(v) === i);
  }

  // Load player details for position lookup
  const playerDetails = await loadPlayerDetails(supabase, scopedPlayerIds);
  const positionById = new Map(playerDetails.map(p => [p.id, p.position?.toUpperCase() ?? ""]));

  // Load H8 snapshots
  const h8Snapshots = await loadH8Snapshots(supabase, args.projectionSeason, scopedPlayerIds);
  const h8ByPlayer = new Map(h8Snapshots.map(s => [s.canonical_player_id, s]));

  console.log(`  Players with weekly stats: ${statsByPlayer.size}`);
  console.log(`  H8 snapshots found: ${h8Snapshots.length}`);

  // --- Determine sample ---
  type PlayerInfo = { playerId: string; position: string };
  let sample: PlayerInfo[];

  if (args.playerId) {
    const pos = positionById.get(args.playerId) ?? "WR";
    sample = [{ playerId: args.playerId, position: pos }];
  } else {
    const allPlayers: PlayerInfo[] = scopedPlayerIds
      .map(id => ({ playerId: id, position: positionById.get(id) ?? "" }))
      .filter(p => ["QB", "RB", "WR", "TE"].includes(p.position));

    if (args.all || args.position) {
      sample = allPlayers;
    } else {
      sample = stratifiedSample(allPlayers, ["QB", "RB", "WR", "TE"], args.limit);
    }
  }

  console.log(`\nPhase B: Running foundation computation on ${sample.length} players...\n`);

  // --- Counters for summary ---
  const classCounts: Record<string, number> = {};
  let successCount = 0;
  let errorCount = 0;
  const errorMessages: string[] = [];

  // Per-class sorted diagnostics buckets for representative output
  const byClass = new Map<string, ReturnType<typeof buildRoleProjectionFoundation>[]>();

  for (const { playerId, position } of sample) {
    const pos = position as "QB" | "RB" | "WR" | "TE";
    const rawRows = statsByPlayer.get(playerId) ?? [];

    // Normalize stats
    const normalizeResult = normalizePlayerStats(
      rawRows.map(r => ({
        week: r.week,
        statsJson: r.stats_json,
        fumRetTd: fumRetTdByPlayerWeek.get(`${playerId}:${r.week}`) ?? 0,
      }))
    );

    if (!normalizeResult.ok) {
      errorCount++;
      errorMessages.push(`${playerId}: ${normalizeResult.errors.slice(0, 2).join("; ")}`);
      continue;
    }

    // H8 fields
    const h8Snap = h8ByPlayer.get(playerId);
    const h8Fields = extractH8Fields(h8Snap?.derived_context_json ?? null);

    // Build input
    const input: HistoricalPlayerProjectionInput = {
      canonicalPlayerId: playerId,
      position: pos,
      historicalSeason: args.historicalSeason,
      projectionSeason: args.projectionSeason,
      weeklyStats: normalizeResult.stats.rows,
      h8SnapshotId: h8Snap?.id ?? null,
      h8Fields,
      compatibleAdpRecords: [],
    };

    try {
      const foundation = buildRoleProjectionFoundation(input);
      successCount++;
      classCounts[foundation.roleSampleClass] = (classCounts[foundation.roleSampleClass] ?? 0) + 1;

      if (!byClass.has(foundation.roleSampleClass)) byClass.set(foundation.roleSampleClass, []);
      byClass.get(foundation.roleSampleClass)!.push(foundation);
    } catch (e) {
      errorCount++;
      errorMessages.push(`${playerId}: ${String(e)}`);
    }
  }

  // --- Print representative diagnostics (up to 16) ---
  const CLASS_ORDER = [
    "ESTABLISHED_FULL_SEASON",
    "ESTABLISHED_PARTIAL_SEASON",
    "PART_TIME_CONTRIBUTOR",
    "BACKUP_OR_SPOT_STARTER",
    "MINIMAL_SAMPLE",
    "ROLE_UNKNOWN",
  ];

  let printed = 0;
  const MAX_DIAGNOSTICS = 16;

  for (const cls of CLASS_ORDER) {
    const bucket = byClass.get(cls) ?? [];
    if (!bucket.length) continue;

    // Print up to 3 examples per class; cycle positions for variety
    const toShow = bucket
      .sort((a, b) => b.totals.totalTargets + b.totals.totalCarries - (a.totals.totalTargets + a.totals.totalCarries))
      .slice(0, 3);

    for (const foundation of toShow) {
      if (printed >= MAX_DIAGNOSTICS) break;
      console.log(`\n── ${cls} [${foundation.position}] ──`);
      printDiagnostic(foundation, args.verbose);
      printed++;
    }
    if (printed >= MAX_DIAGNOSTICS) break;
  }

  // --- Summary ---
  console.log(`\n${"─".repeat(60)}`);
  console.log(`H9.1 Role Foundation Summary`);
  console.log(`  Processed: ${successCount} players`);
  console.log(`  Errors:    ${errorCount}`);
  console.log(`\n  Classification breakdown:`);
  for (const cls of CLASS_ORDER) {
    if (classCounts[cls]) {
      console.log(`    ${cls}: ${classCounts[cls]}`);
    }
  }

  if (errorMessages.length > 0) {
    console.log(`\n  Errors (first ${Math.min(errorMessages.length, 5)}):`);
    for (const msg of errorMessages.slice(0, 5)) {
      console.log(`    ${msg}`);
    }
  }

  // --- Validation checks ---
  console.log(`\n  Verification:`);
  let allPassed = true;

  for (const [cls, bucket] of byClass) {
    for (const f of bucket) {
      const ag = f.projectedAvailability.projectedActiveGames;
      const rg = f.projectedAvailability.projectedRoleGames;
      if (ag.floor > ag.median || ag.median > ag.ceiling || ag.ceiling > 17) {
        console.log(`  FAIL: activeGames ordering violated for ${f.canonicalPlayerId} [${cls}]`);
        allPassed = false;
      }
      if (rg.floor > rg.median || rg.median > rg.ceiling) {
        console.log(`  FAIL: roleGames ordering violated for ${f.canonicalPlayerId} [${cls}]`);
        allPassed = false;
      }
      if (rg.floor > ag.floor || rg.median > ag.median || rg.ceiling > ag.ceiling) {
        console.log(`  FAIL: roleGames > activeGames for ${f.canonicalPlayerId} [${cls}]`);
        allPassed = false;
      }
      if (f.totalRangeWidth < 0.20 || f.totalRangeWidth > 0.80) {
        console.log(`  FAIL: totalRangeWidth out of bounds for ${f.canonicalPlayerId}: ${f.totalRangeWidth}`);
        allPassed = false;
      }
    }
  }

  if (allPassed) {
    console.log("  ✓ All game-projection ordering invariants satisfied");
    console.log("  ✓ All totalRangeWidth values within [0.20, 0.80]");
  }

  console.log(`\n  ✓ Dry-run complete — no data written\n`);
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
