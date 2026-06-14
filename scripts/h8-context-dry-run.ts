// H8 Player Context Dry-Run Diagnostic
//
// Derives forward-looking player context from Blackbird H1/H2 historical data.
// DOES NOT generate projections, expected fantasy points, or projected role expectations.
//
// ┌─ PHASE A: Load → Validate → Derive (all in memory before any DB write) ─┐
// │  loadAllWeeklyRows → loadPlayerDetails → loadDerivedRows → loadTeamGames │
// │  → selectEligiblePlayers → validateHistoricalLoad → validateExecuteMode  │
// │  → deriveAllContexts                                                      │
// └─ PHASE B: Persist (only reached when Phase A fully succeeds) ────────────┘
//
// Usage:
//   npm run dry-run:h8-context -- [options]
//
// Options:
//   --historical-season <year>    Season whose stats are used to derive context (default: 2025)
//   --context-season <year>       Season the context will be used for (default: 2026)
//   --all                         Process every eligible player
//   --position <pos>              Filter to one position: QB | RB | WR | TE
//   --limit <n>                   Stratified cross-position sample of N players (default: 50)
//   --player-id <uuid>            Single canonical player UUID (spot check)
//   --page-size <n>               Rows per paginated Phase A request (default: 500, max: 1000)
//   --evidence-batch-size <n>     Phase B evidence rows per batch (default: 500)
//   --snapshot-batch-size <n>     Phase B snapshot rows per batch (default: 200)
//   --execute                     Write to DB (requires --all or --position or --allow-partial-execute)
//   --allow-partial-execute       Acknowledge partial population execute
//   --inspect-persistence         Report existing H8 evidence and snapshot counts; no writes
//
// Execute safety:
//   --execute --all                   → allowed (full population)
//   --execute --position=QB           → allowed (intentional single position)
//   --execute --limit=50              → REFUSED (partial, not acknowledged)
//   --execute --allow-partial-execute → allowed (acknowledged)
//
// Phase B safety:
//   - No writes until Phase A fully completes
//   - Evidence batched (default 500 rows/request) with 30s timeout and 5× retry
//   - Snapshots batched (default 200 rows/request) with 30s timeout and 5× retry
//   - Ctrl+C (SIGINT) stops new batches; prints interruption report with progress
//   - Identical rerun is safe: ignoreDuplicates=true; no timestamp churn

import path from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CONTEXT_FIELDS,
  computeApplicabilityBreakdown,
  summarizeApplicability,
} from "@/lib/context/applicability";
import type { ApplicabilityBreakdown } from "@/lib/context/applicability";
import { aggregatePlayerSeasonStats, derivePlayerContext } from "@/lib/context/derive";
import type { BlackbirdDerivedContext, DerivedStatRow, TeamSeasonStats, WeeklyStatRow } from "@/lib/context/derive";
import {
  DEFAULT_EVIDENCE_BATCH_SIZE,
  DEFAULT_PHASE_B_TIMEOUT_MS,
  DEFAULT_SNAPSHOT_BATCH_SIZE,
  H8_CONTEXT_VERSION,
  buildEvidenceInsertRow,
  buildSnapshotInsertRow,
  createInterruptState,
  inspectH8Persistence,
  persistPhaseB,
} from "@/lib/context/phase-b-persist";
import type { EvidenceInsertRow, PhaseBProgress, SnapshotInsertRow } from "@/lib/context/phase-b-persist";
import {
  buildArtifactPath,
  buildSeasonModel,
  buildTeamWeeklyAggregates,
  ensureArtifactDir,
  mergeTeamSeasonContext,
  selectEligiblePlayers,
  stratifiedSample,
  validateExecuteMode,
  validateHistoricalLoad,
} from "@/lib/context/h8-load";
import type { EligiblePlayer, HistoricalWeeklyRow, TeamGameRow } from "@/lib/context/h8-load";
import { loadAllPagesWith } from "@/lib/context/paginated-loader";
import type { EvidenceRecord } from "@/lib/context/types";
import {
  REGULAR_SEASON_PLAYER,
  REGULAR_SEASON_TEAM_GAME,
  SKILL_POSITIONS,
} from "@/lib/context/season-type";

type SupabaseLike = SupabaseClient<any>;

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
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
  const flag = (name: string, def: string | null = null): string | null => {
    const i = argv.indexOf(name);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
  };
  const has = (name: string) => argv.includes(name);

  const historicalSeason = parseInt(
    flag("--historical-season") ?? flag("--season", "2025") ?? "2025",
    10
  );
  const contextSeason = parseInt(flag("--context-season", "2026") ?? "2026", 10);
  const rawLimit = flag("--limit");
  const rawPageSize = flag("--page-size");
  const rawEvidenceBatch = flag("--evidence-batch-size");
  const rawSnapshotBatch = flag("--snapshot-batch-size");

  return {
    historicalSeason,
    contextSeason,
    all: has("--all"),
    position: flag("--position"),
    limit: rawLimit !== null ? parseInt(rawLimit, 10) : 50,
    pageSize: rawPageSize !== null ? Math.min(parseInt(rawPageSize, 10), 1000) : 500,
    evidenceBatchSize: rawEvidenceBatch !== null ? parseInt(rawEvidenceBatch, 10) : DEFAULT_EVIDENCE_BATCH_SIZE,
    snapshotBatchSize: rawSnapshotBatch !== null ? parseInt(rawSnapshotBatch, 10) : DEFAULT_SNAPSHOT_BATCH_SIZE,
    execute: has("--execute"),
    allowPartialExecute: has("--allow-partial-execute"),
    playerId: flag("--player-id"),
    inspectPersistence: has("--inspect-persistence"),
  };
}

// --------------------------------------------------------------------------
// DB source loaders (each uses loadAllPagesWith with retry/backoff)
// --------------------------------------------------------------------------

/** Log progress compactly per table */
function makeProgressLogger(tableLabel: string) {
  return (info: { page: number; rowsThisPage: number; totalRows: number }) => {
    console.log(`    page ${info.page}: ${info.rowsThisPage} rows (total: ${info.totalRows})`);
  };
}

async function loadAllWeeklyRows(
  supabase: SupabaseLike,
  season: number,
  pageSize: number
): Promise<HistoricalWeeklyRow[]> {
  console.log(`  player_weekly_stats:`);
  return loadAllPagesWith<HistoricalWeeklyRow>(
    (from, to) =>
      supabase
        .from("player_weekly_stats")
        .select("player_id, season, week, season_type, team, position_group, stats_json")
        .eq("season", season)
        .eq("season_type", REGULAR_SEASON_PLAYER)
        .in("position_group", [...SKILL_POSITIONS])
        .range(from, to),
    {
      table: "player_weekly_stats",
      pageSize,
      season,
      seasonType: REGULAR_SEASON_PLAYER,
      onProgress: makeProgressLogger("player_weekly_stats"),
    }
  );
}

async function loadPlayerDetails(
  supabase: SupabaseLike,
  playerIds: string[],
  pageSize: number
): Promise<Array<{ id: string; full_name: string; position: string | null; team: string | null }>> {
  type Row = { id: string; full_name: string; position: string | null; team: string | null };
  const results: Row[] = [];
  const CHUNK = 200;
  console.log(`  players (${playerIds.length} IDs, ${Math.ceil(playerIds.length / CHUNK)} chunk(s)):`);
  for (let i = 0; i < playerIds.length; i += CHUNK) {
    const chunk = playerIds.slice(i, i + CHUNK);
    const chunkRows = await loadAllPagesWith<Row>(
      (from, to) =>
        supabase.from("players").select("id, full_name, position, team").in("id", chunk).range(from, to),
      {
        table: "players",
        pageSize,
        onProgress: (info) => console.log(`    chunk ${Math.floor(i / CHUNK) + 1} page ${info.page}: ${info.rowsThisPage} rows`),
      }
    );
    results.push(...chunkRows);
  }
  return results;
}

/**
 * Load H2 PBP derived rows for a set of player IDs.
 * Chunked by player ID (200 per batch) to avoid URL length limits with large populations.
 * H2 stores only: rec_td_40p, rec_td_50p, rush_td_40p, rush_td_50p, pass_pick6, fum_ret_td.
 */
async function loadDerivedRows(
  supabase: SupabaseLike,
  season: number,
  playerIds: string[],
  pageSize: number
): Promise<DerivedStatRow[]> {
  if (playerIds.length === 0) return [];
  const results: DerivedStatRow[] = [];
  const CHUNK = 200;
  const chunks = Math.ceil(playerIds.length / CHUNK);
  console.log(`  player_weekly_derived_stats (${playerIds.length} players, ${chunks} chunk(s)):`);
  for (let i = 0; i < playerIds.length; i += CHUNK) {
    const chunk = playerIds.slice(i, i + CHUNK);
    const chunkRows = await loadAllPagesWith<DerivedStatRow>(
      (from, to) =>
        supabase
          .from("player_weekly_derived_stats")
          .select("player_id, season, week, stats_json")
          .eq("season", season)
          .eq("season_type", REGULAR_SEASON_PLAYER)
          .eq("stat_scope", "nflverse_pbp_derived")
          .in("player_id", chunk)
          .range(from, to),
      {
        table: "player_weekly_derived_stats",
        pageSize,
        season,
        seasonType: REGULAR_SEASON_PLAYER,
        onProgress: (info) => {
          if (info.page === 1 && chunks > 1) {
            console.log(`    chunk ${Math.floor(i / CHUNK) + 1}/${chunks} page ${info.page}: ${info.rowsThisPage} rows`);
          } else {
            console.log(`    page ${info.page}: ${info.rowsThisPage} rows (total: ${info.totalRows})`);
          }
        },
      }
    );
    results.push(...chunkRows);
  }
  return results;
}

async function loadTeamGameRows(
  supabase: SupabaseLike,
  season: number,
  pageSize: number
): Promise<TeamGameRow[]> {
  console.log(`  team_game_stats:`);
  const { data, error } = await supabase
    .from("team_game_stats")
    .select("team_id, season, points_scored, points_allowed, offensive_yards, yards_allowed")
    .eq("season", season)
    .eq("season_type", REGULAR_SEASON_TEAM_GAME);
  if (error) {
    console.warn(`  [warn] team_game_stats: ${error.message} (non-fatal — team context will be limited)`);
    return [];
  }
  const rows = (data ?? []) as TeamGameRow[];
  console.log(`    total: ${rows.length} rows`);
  void pageSize; // team_game_stats is small (≤544 rows) — single request is fine
  return rows;
}

// --------------------------------------------------------------------------
// Derived result type (Phase A output, Phase B input)
// --------------------------------------------------------------------------

type DerivedResult = {
  eligible: EligiblePlayer;
  displayName: string;
  context: BlackbirdDerivedContext;
  evidenceRecords: EvidenceRecord[];
  breakdown: ApplicabilityBreakdown;
  targetShare: number | null;
  carryShare: number | null;
  passRate: number | null;
  rzShare: number | null;
};

// --------------------------------------------------------------------------
// Phase A: derive all contexts (pure, no DB writes)
// --------------------------------------------------------------------------

function deriveAllContexts(
  selectedEligible: EligiblePlayer[],
  selectedWeeklyRows: WeeklyStatRow[],
  derivedRows: DerivedStatRow[],
  teamSeasonMap: ReturnType<typeof mergeTeamSeasonContext>,
  playerMap: Map<string, { id: string; full_name: string; position: string | null; team: string | null }>,
  historicalSeason: number,
  capturedAt: string
): DerivedResult[] {
  return selectedEligible.map((eligible) => {
    const player = playerMap.get(eligible.playerId);
    const displayName = player?.full_name ?? `[unknown: ${eligible.playerId.slice(0, 8)}]`;

    const playerStats = aggregatePlayerSeasonStats(
      eligible.playerId,
      selectedWeeklyRows,
      derivedRows,
      historicalSeason,
      eligible.position
    );

    const teamAgg = eligible.primaryTeam ? teamSeasonMap.get(eligible.primaryTeam) : null;
    const teamStats: TeamSeasonStats | null = teamAgg
      ? {
          teamId: teamAgg.teamId,
          season: teamAgg.season,
          totalPassPlays: 0,      // not in nflverse player weekly stats
          totalRushPlays: 0,
          totalTargets: teamAgg.totalTargets,
          totalCarries: teamAgg.totalCarries,
          topTargetShare: teamAgg.topTargetShare,
        }
      : null;

    const { context, evidenceRecords } = derivePlayerContext(playerStats, teamStats, capturedAt);
    const breakdown = computeApplicabilityBreakdown(context, eligible.position);

    return {
      eligible,
      displayName,
      context,
      evidenceRecords,
      breakdown,
      targetShare: context.priorTargetShare.value,
      carryShare: context.priorCarryShare.value,
      passRate: context.priorTeamPassRate.value,
      rzShare: context.priorRedZoneShare.value,
    };
  });
}

// --------------------------------------------------------------------------
// Phase B row builders (pure, no DB)
// --------------------------------------------------------------------------

function buildPhaseBRows(
  results: DerivedResult[],
  contextTargetSeason: number,
  asOfDate: string
): { evidenceRows: EvidenceInsertRow[]; snapshotRows: SnapshotInsertRow[] } {
  const evidenceRows: EvidenceInsertRow[] = [];
  const snapshotRows: SnapshotInsertRow[] = [];

  for (const { eligible, context, evidenceRecords } of results) {
    for (const rec of evidenceRecords) {
      evidenceRows.push(buildEvidenceInsertRow(rec, eligible.playerId));
    }
    snapshotRows.push(buildSnapshotInsertRow({
      playerId: eligible.playerId,
      context,
      contextSeason: contextTargetSeason,
      asOfDate,
    }));
  }

  return { evidenceRows, snapshotRows };
}

// --------------------------------------------------------------------------
// Formatters
// --------------------------------------------------------------------------

const pct = (v: number | null) => (v !== null ? `${(v * 100).toFixed(1)}%` : "—");
const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length));

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRole = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!supabaseUrl || !serviceRole) {
    console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const seasonModel = buildSeasonModel(args.historicalSeason, args.contextSeason);
  const capturedAt = new Date().toISOString();
  const mode = args.execute ? "EXECUTE" : "DRY_RUN";

  // ─────────────────────────────────────────────────────────────────────────
  // --inspect-persistence: read-only DB state report, then exit
  // ─────────────────────────────────────────────────────────────────────────

  if (args.inspectPersistence) {
    console.log(`\n=== H8 Persistence Inspection ===`);
    console.log(`  Historical season: ${args.historicalSeason}  (context_evidence.season)`);
    console.log(`  Context season:    ${args.contextSeason}  (player_context_snapshots.season)`);
    console.log(`  Context version:   ${H8_CONTEXT_VERSION}  (H8_CONTEXT_VERSION)`);
    console.log(`  Page size:         ${args.pageSize} rows/request\n`);

    const inspection = await inspectH8Persistence({
      countEvidence: () =>
        (supabase as any)
          .from("context_evidence")
          .select("*", { count: "exact", head: true })
          .eq("season", args.historicalSeason),
      countSnapshots: () =>
        (supabase as any)
          .from("player_context_snapshots")
          .select("*", { count: "exact", head: true })
          .eq("season", args.contextSeason)
          .eq("context_version", H8_CONTEXT_VERSION),
      pageEvidencePlayers: (from, to) =>
        (supabase as any)
          .from("context_evidence")
          .select("player_id")
          .eq("season", args.historicalSeason)
          .range(from, to),
      pageSnapshotPlayers: (from, to) =>
        (supabase as any)
          .from("player_context_snapshots")
          .select("canonical_player_id, context_version, as_of_date")
          .eq("season", args.contextSeason)
          .eq("context_version", H8_CONTEXT_VERSION)
          .range(from, to),
      pageSize: args.pageSize,
    });

    if (inspection.tablesMissing.length > 0) {
      console.warn(`  [warn] Tables not found — migration 012 may not be applied: ${inspection.tablesMissing.join(", ")}`);
    }

    console.log(`context_evidence  (season=${args.historicalSeason}):`);
    console.log(`  rows (exact):        ${inspection.evidenceRows}`);
    console.log(`  distinct players:    ${inspection.evidencePlayers}`);
    if (inspection.evidenceDistribution) {
      const d = inspection.evidenceDistribution;
      console.log(`  rows per player:     min=${d.minPerPlayer}  max=${d.maxPerPlayer}  mode=${d.modePerPlayer}`);
      console.log(`  below mode:          ${d.playersBelowMode}`);
      console.log(`  above mode:          ${d.playersAboveMode}`);
    }

    console.log(`\nplayer_context_snapshots  (season=${args.contextSeason}, context_version=${H8_CONTEXT_VERSION}):`);
    console.log(`  rows (exact):        ${inspection.snapshotRows}`);
    console.log(`  distinct players:    ${inspection.snapshotPlayers}`);
    console.log(`  as_of_date(s):       ${inspection.snapshotAsDates.join(", ") || "—"}`);
    console.log(`  versions:            ${inspection.snapshotVersions.join(", ") || "—"}`);

    console.log(`\nCross-checks:`);
    console.log(`  Evidence only (no snapshot): ${inspection.playersWithEvidenceOnly}`);
    console.log(`  Snapshot only (no evidence): ${inspection.playersWithSnapshotOnly}`);
    console.log(`  Partially persisted:         ${inspection.partiallyPersisted}`);

    const d = inspection.evidenceDistribution;
    const verdictDetail = inspection.complete && d
      ? `${inspection.evidenceRows} evidence, ${inspection.snapshotRows} snapshots, ${inspection.evidencePlayers} players, uniform distribution (${d.modePerPlayer} per player)`
      : `${inspection.evidenceRows} evidence, ${inspection.snapshotRows} snapshots`;

    const verdict =
      inspection.evidenceRows === 0 && inspection.snapshotRows === 0
        ? "NO DATA — safe to rerun execute"
        : inspection.partiallyPersisted
          ? "PARTIALLY PERSISTED — only one table has data; inspect before rerun"
          : inspection.complete
            ? `COMPLETE — ${verdictDetail}`
            : `INCOMPLETE — evidence_players=${inspection.evidencePlayers} snapshot_players=${inspection.snapshotPlayers} evidence_only=${inspection.playersWithEvidenceOnly} snapshot_only=${inspection.playersWithSnapshotOnly}${d && (d.playersBelowMode > 0 || d.playersAboveMode > 0) ? ` distribution_skew=below:${d.playersBelowMode}+above:${d.playersAboveMode}` : ""}`;

    console.log(`\nVerdict: ${verdict}\n`);
    process.exit(0);
  }

  const selectionMode = args.all
    ? "ALL"
    : args.position
      ? `POSITION=${args.position}`
      : `STRATIFIED(limit=${args.limit})`;

  console.log(`\n=== H8 Player Context Diagnostic ===`);
  console.log(`Mode:               ${mode}`);
  console.log(`Selection:          ${selectionMode}`);
  console.log(`Historical season:  ${seasonModel.historicalPerformanceSeason}  (derivation source)`);
  console.log(`Context season:     ${seasonModel.contextTargetSeason}  (target season)`);
  console.log(`As-of date:         ${seasonModel.asOfDate}`);
  console.log(`Page size:          ${args.pageSize} rows/request (retry up to 5×: 500ms→1s→2s→4s→8s)`);
  if (args.execute) {
    console.log(`Evidence batch:     ${args.evidenceBatchSize} rows/batch (${DEFAULT_PHASE_B_TIMEOUT_MS / 1000}s timeout, 5× retry)`);
    console.log(`Snapshot batch:     ${args.snapshotBatchSize} rows/batch (${DEFAULT_PHASE_B_TIMEOUT_MS / 1000}s timeout, 5× retry)`);
  }
  if (args.playerId) console.log(`Player filter:      ${args.playerId}`);
  console.log(`\n── PHASE A: Load → Validate → Derive (no DB writes until Phase B) ──\n`);

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE A: Source loading (all with retry/backoff)
  // If any load fails, we throw here and Phase B is never reached.
  // ─────────────────────────────────────────────────────────────────────────

  // A1: All regular-season weekly rows (paginated, retry)
  console.log(`A1: Loading ${args.historicalSeason} regular-season weekly rows…`);
  const allWeeklyRows = await loadAllWeeklyRows(supabase, args.historicalSeason, args.pageSize);
  console.log(`  → ${allWeeklyRows.length} rows loaded\n`);

  if (allWeeklyRows.length === 0) {
    console.error(`[FAIL] Zero weekly rows for ${args.historicalSeason}. Verify H1 ingest ran and season_type="regular".`);
    process.exit(2);
  }

  // A2: Eligible population (pure, no DB)
  console.log(`A2: Building eligible player population…`);
  const allEligible = selectEligiblePlayers(allWeeklyRows, {
    season: args.historicalSeason,
    position: args.position,
    playerId: args.playerId,
  });

  let selectedEligible = allEligible;
  if (!args.all) {
    if (args.playerId) {
      selectedEligible = allEligible;
    } else if (args.position) {
      selectedEligible = allEligible.slice(0, args.limit);
    } else {
      selectedEligible = stratifiedSample(allEligible, args.limit);
    }
  }

  const eligiblePosDist = allEligible.reduce<Record<string, number>>((acc, p) => {
    acc[p.position] = (acc[p.position] ?? 0) + 1;
    return acc;
  }, {});
  const posDist = selectedEligible.reduce<Record<string, number>>((acc, p) => {
    acc[p.position] = (acc[p.position] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`  Eligible:  ${allEligible.length} players  [${SKILL_POSITIONS.map((p) => `${p}=${eligiblePosDist[p] ?? 0}`).join("  ")}]`);
  console.log(`  Selected:  ${selectedEligible.length} players  [${SKILL_POSITIONS.map((p) => `${p}=${posDist[p] ?? 0}`).join("  ")}]  mode=${selectionMode}`);

  // Fail-fast population check
  const loadCheck = validateHistoricalLoad(
    allEligible.map((p) => p.playerId),
    selectedEligible.map((p) => p.playerId),
    allWeeklyRows.length
  );
  if (!loadCheck.ok) {
    console.error(`\n[FAIL] ${loadCheck.reason}`);
    process.exit(loadCheck.exitCode);
  }

  // Execute safety check (before loading remaining sources — no point loading if refused)
  const executeCheck = validateExecuteMode({
    execute: args.execute,
    all: args.all,
    position: args.position,
    allowPartialExecute: args.allowPartialExecute,
    selectedCount: selectedEligible.length,
    eligibleCount: allEligible.length,
  });
  if (!executeCheck.ok) {
    console.error(`\n[REFUSED] ${executeCheck.reason}`);
    process.exit(executeCheck.exitCode);
  }
  console.log(`  Execute safety: ${executeCheck.planSummary}\n`);

  const selectedIds = selectedEligible.map((p) => p.playerId);

  // A3: Player display names (paginated, retry, chunked by player ID)
  console.log(`A3: Loading player display names…`);
  const playerDetails = await loadPlayerDetails(supabase, selectedIds, args.pageSize);
  const playerMap = new Map(playerDetails.map((p) => [p.id, p]));
  console.log(`  → ${playerDetails.length} player records\n`);

  // A4: H2 PBP derived rows (paginated, retry, chunked by player ID)
  console.log(`A4: Loading H2 PBP derived stats…`);
  const derivedRows = await loadDerivedRows(supabase, args.historicalSeason, selectedIds, args.pageSize);
  console.log(`  → ${derivedRows.length} derived rows (rec_td_40p/50p, rush_td_40p/50p, pass_pick6, fum_ret_td)\n`);

  // A5: Team game stats (single request, retry built into supabase client)
  console.log(`A5: Loading team game stats (season_type="${REGULAR_SEASON_TEAM_GAME}")…`);
  const teamGameRows = await loadTeamGameRows(supabase, args.historicalSeason, args.pageSize);
  console.log(`  → ${teamGameRows.length} team game rows\n`);

  // A6: Team aggregation (pure)
  console.log(`A6: Building team-season aggregates…`);
  const teamWeeklyAgg = buildTeamWeeklyAggregates(allWeeklyRows, args.historicalSeason);
  const teamSeasonMap = mergeTeamSeasonContext(teamWeeklyAgg, teamGameRows, args.historicalSeason);
  const teamsWithGames = [...teamSeasonMap.values()].filter((t) => t.gamesPlayed > 0).length;
  console.log(`  Teams: ${teamWeeklyAgg.size} with weekly aggregates, ${teamsWithGames} with game rows merged`);
  console.log(`  [note] teamPassRate = unknown (team_pass_plays not in nflverse player stats)\n`);

  // A7: Weekly row subset for selected players
  const selectedIdSet = new Set(selectedIds);
  const selectedWeeklyRows: WeeklyStatRow[] = allWeeklyRows
    .filter((r) => selectedIdSet.has(r.player_id))
    .map((r) => ({ player_id: r.player_id, season: r.season, week: r.week, stats_json: r.stats_json }));
  console.log(`A7: Weekly rows for selected players: ${selectedWeeklyRows.length}`);

  // A8: Derive all contexts (pure CPU, no DB)
  console.log(`\nA8: Deriving context for ${selectedEligible.length} players…`);
  const derivedResults = deriveAllContexts(
    selectedEligible,
    selectedWeeklyRows,
    derivedRows as DerivedStatRow[],
    teamSeasonMap,
    playerMap,
    args.historicalSeason,
    capturedAt
  );
  console.log(`  → ${derivedResults.length} contexts derived`);

  // A9: Build Phase B rows and print execute plan
  const { evidenceRows, snapshotRows } = buildPhaseBRows(derivedResults, args.contextSeason, seasonModel.asOfDate);

  if (args.execute) {
    const evidenceBatches = Math.ceil(evidenceRows.length / args.evidenceBatchSize);
    const snapshotBatches = Math.ceil(snapshotRows.length / args.snapshotBatchSize);
    console.log(`\n=== Execute Plan (Phase B) ===`);
    console.log(`  Players:              ${derivedResults.length}`);
    console.log(`  Position dist:        ${SKILL_POSITIONS.map((p) => `${p}=${posDist[p] ?? 0}`).join("  ")}`);
    console.log(`  Historical season:    ${args.historicalSeason}`);
    console.log(`  Context season:       ${args.contextSeason}`);
    console.log(`  Context version:      ${H8_CONTEXT_VERSION}  (integer)`);
    console.log(`  Evidence records:     ${evidenceRows.length} → ${evidenceBatches} batch(es) of ≤${args.evidenceBatchSize}`);
    console.log(`  Snapshots:            ${snapshotRows.length} → ${snapshotBatches} batch(es) of ≤${args.snapshotBatchSize}`);
    console.log(`  Scope:                ${executeCheck.planSummary}`);
    console.log(`  Idempotency:          ignoreDuplicates=true; identical rerun = 0 new writes`);
    console.log(`  Conflict keys:`);
    console.log(`    evidence:   evidence_id`);
    console.log(`    snapshots:  canonical_player_id,season,context_version`);
    console.log(`  Timeout per batch:    ${DEFAULT_PHASE_B_TIMEOUT_MS / 1000}s`);
    console.log(`  Retries per batch:    5× (500ms→1s→2s→4s→8s, transient only)`);
    console.log(`  SIGINT:               stops new batches; prints progress; safe to rerun`);
  }

  console.log(`\n──── PHASE A COMPLETE — ${derivedResults.length} contexts derived ────\n`);

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE B: Persist (only reached when Phase A succeeds fully)
  // SIGINT registered here — if fired before Phase B, "no DB writes"
  //                        — if fired during Phase B, "may have partially completed"
  // ─────────────────────────────────────────────────────────────────────────

  type PhaseBRecord = { evidenceAttempted: number; snapshotAttempted: number; evidenceBatchesCompleted: number; snapshotBatchesCompleted: number };
  let phaseBStarted = false;
  let phaseBRecord: PhaseBRecord | null = null;
  const interruptState = createInterruptState();

  process.once("SIGINT", () => {
    interruptState.triggered = true;
    if (!phaseBStarted) {
      console.error(`\n\nEXECUTE INTERRUPTED BEFORE PHASE B`);
      console.error(`No database writes were performed.`);
      console.error(`Safe to rerun the identical execute command.\n`);
      process.exit(130);
    }
    // If Phase B has started, the interrupt is handled inside persistPhaseB's loop.
    // We print the report after persistPhaseB returns.
  });

  let dbWrites: { evidenceAttempted: number; snapshotsAttempted: number } | null = null;

  if (args.execute) {
    phaseBStarted = true;
    const totalEvidence = evidenceRows.length;
    const totalSnapshots = snapshotRows.length;

    console.log(`── PHASE B: ${totalEvidence} evidence → ${snapshotRows.length} snapshots ──`);
    console.log(`   (Ctrl+C stops new batches; partial writes remain; safe to rerun)\n`);

    try {
      const phaseBResult = await persistPhaseB(
        supabase as any,
        evidenceRows,
        snapshotRows,
        {
          evidenceBatchSize: args.evidenceBatchSize,
          snapshotBatchSize: args.snapshotBatchSize,
          timeoutMs: DEFAULT_PHASE_B_TIMEOUT_MS,
          interruptState,
          onProgress: (p: PhaseBProgress) => {
            const elapsed = `${(p.elapsedBatchMs / 1000).toFixed(1)}s`;
            const totalElapsed = `${(p.elapsedTotalMs / 1000).toFixed(1)}s total`;
            const tableLabel = p.table === "context_evidence" ? "evidence" : "snapshots";
            console.log(
              `  ${tableLabel} batch ${p.batchNumber}/${p.totalBatches}: ` +
              `${p.attempted} attempted, ${p.inserted} inserted, ${p.existing} existing — ` +
              `completed in ${elapsed} (${p.completedCumulative}/${p.totalRows}, ${totalElapsed})`
            );
          },
        }
      );

      phaseBRecord = phaseBResult;

      if (phaseBResult.interrupted) {
        console.error(`\n\nEXECUTE INTERRUPTED DURING PHASE B`);
        console.error(`Database writes may have partially completed.`);
        console.error(`Evidence progress:  ${phaseBResult.evidenceAttempted} / ${totalEvidence}`);
        console.error(`Snapshot progress:  ${phaseBResult.snapshotAttempted} / ${totalSnapshots}`);
        console.error(`Evidence batches:   ${phaseBResult.evidenceBatchesCompleted} completed`);
        console.error(`Snapshot batches:   ${phaseBResult.snapshotBatchesCompleted} completed`);
        console.error(`Safe recovery: rerun the identical execute command after inspection.`);
        console.error(`  npm run dry-run:h8-context -- --historical-season=${args.historicalSeason} --context-season=${args.contextSeason} --all --inspect-persistence`);
        process.exit(130);
      }

      dbWrites = { evidenceAttempted: phaseBResult.evidenceAttempted, snapshotsAttempted: phaseBResult.snapshotAttempted };
      console.log(`\n── PHASE B COMPLETE — ${phaseBResult.evidenceAttempted} evidence attempted, ${phaseBResult.snapshotAttempted} snapshots attempted ──\n`);
    } catch (e) {
      console.error(`\n[ERROR] Phase B batch failed: ${e}`);
      if (phaseBRecord) {
        console.error(`Evidence progress: ${phaseBRecord.evidenceAttempted} / ${totalEvidence}`);
        console.error(`Snapshot progress: ${phaseBRecord.snapshotAttempted} / ${totalSnapshots}`);
      } else {
        console.error(`EXECUTE ABORTED — no database writes performed`);
      }
      process.exit(6);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Report
  // ─────────────────────────────────────────────────────────────────────────

  const popSummary = summarizeApplicability(derivedResults.map((r) => r.breakdown));
  const withTarget = derivedResults.filter((r) => r.targetShare !== null);
  const multiTeam = derivedResults.filter((r) => r.eligible.teamsPlayedFor.length > 1);

  // Tabular output (max 100 rows in console, rest in artifact)
  console.log(`Results (historical ${args.historicalSeason} → context ${args.contextSeason}):\n`);
  const WIDTHS = [28, 5, 5, 5, 3, 7, 7, 7, 6, 4, 4, 4];
  const HEADS = ["Player", "Pos", "Team", "Multi", "G", "TgtSh", "CarrSh", "PassRt", "RZSh", "Obs", "Unk", "N/A"];
  const header = HEADS.map((h, i) => pad(h, WIDTHS[i]!)).join(" ");
  console.log(header);
  console.log("─".repeat(header.length));

  for (const r of derivedResults.slice(0, 100)) {
    console.log([
      pad(r.displayName, 28),
      pad(r.eligible.position, 5),
      pad(r.eligible.primaryTeam ?? "?", 5),
      pad(r.eligible.teamsPlayedFor.length > 1 ? `+${r.eligible.teamsPlayedFor.length - 1}` : "", 5),
      pad(String(r.eligible.games), 3),
      pad(pct(r.targetShare), 7),
      pad(pct(r.carryShare), 7),
      pad(pct(r.passRate), 7),
      pad(pct(r.rzShare), 6),
      pad(String(r.breakdown.applicableObserved + r.breakdown.applicableInferred), 4),
      pad(String(r.breakdown.applicableUnknown), 4),
      pad(String(r.breakdown.notApplicable), 4),
    ].join(" "));
  }
  if (derivedResults.length > 100) {
    console.log(`  … ${derivedResults.length - 100} more rows in artifact`);
  }

  // Summary
  console.log(`\n=== Summary ===`);
  console.log(`  Historical season:       ${args.historicalSeason}`);
  console.log(`  Context season:          ${args.contextSeason}`);
  console.log(`  Selection mode:          ${selectionMode}`);
  console.log(`  Eligible players:        ${allEligible.length}  [${SKILL_POSITIONS.map((p) => `${p}=${eligiblePosDist[p] ?? 0}`).join("  ")}]`);
  console.log(`  Selected players:        ${derivedResults.length}  [${SKILL_POSITIONS.map((p) => `${p}=${posDist[p] ?? 0}`).join("  ")}]`);
  console.log(`  Multi-team players:      ${multiTeam.length}`);
  console.log(`  Global weekly rows:      ${allWeeklyRows.length}`);
  console.log(`  Selected weekly rows:    ${selectedWeeklyRows.length}`);
  console.log(`  Derived (H2 PBP) rows:   ${derivedRows.length}`);
  console.log(`  Team game rows:          ${teamGameRows.length}`);
  console.log(`  Teams aggregated:        ${teamSeasonMap.size}`);
  console.log(`  Has target share:        ${withTarget.length} / ${derivedResults.length}`);
  console.log(``);
  console.log(`  Field applicability (${CONTEXT_FIELDS.length} fields × ${derivedResults.length} players = ${popSummary.totalFields}):`);
  console.log(`    Applicable observed:   ${popSummary.totalApplicableObserved + popSummary.totalApplicableInferred}`);
  console.log(`    Applicable unknown:    ${popSummary.totalApplicableUnknown}`);
  console.log(`    Secondary observed:    ${popSummary.totalSecondaryObserved}`);
  console.log(`    Secondary unknown:     ${popSummary.totalSecondaryUnknown}`);
  console.log(`    Not applicable (N/A):  ${popSummary.totalNotApplicable}`);

  if (dbWrites) {
    console.log(`\n  DB writes (Phase B):`);
    console.log(`    Evidence attempted:  ${dbWrites.evidenceAttempted}`);
    console.log(`    Snapshots attempted: ${dbWrites.snapshotsAttempted}`);
    console.log(`    Inspect: npm run dry-run:h8-context -- --historical-season=${args.historicalSeason} --context-season=${args.contextSeason} --inspect-persistence`);
  } else {
    console.log(`\n  DB writes:             NONE (dry_run)`);
  }

  // Backlogs
  const firstResult = derivedResults[0];
  if (firstResult) {
    console.log(`\n=== Documented Backlogs ===`);
    for (const b of firstResult.context.backlogs) {
      console.log(`  - ${b}`);
    }
  }

  // Warnings
  const warnings: string[] = [];
  if (teamGameRows.length === 0) {
    warnings.push("team_game_stats returned 0 rows — points/yards context unavailable (non-fatal)");
  }
  if (withTarget.length === 0) {
    warnings.push("No players have a resolved target share — likely a team aggregation issue");
  }
  if (!args.position && !args.playerId && !args.all) {
    const missing = SKILL_POSITIONS.filter((p) => (posDist[p] ?? 0) === 0);
    if (missing.length > 0) {
      warnings.push(`Missing positions in sample: ${missing.join(", ")}`);
    }
  }
  if (warnings.length > 0) {
    console.log(`\n=== Warnings ===`);
    for (const w of warnings) console.warn(`  [warn] ${w}`);
  }

  // Artifact
  const artifactPath = buildArtifactPath(args.historicalSeason, args.contextSeason, process.cwd());
  const artifact = {
    runAt: capturedAt,
    mode,
    selectionMode,
    seasonModel,
    pageSize: args.pageSize,
    evidenceBatchSize: args.evidenceBatchSize,
    snapshotBatchSize: args.snapshotBatchSize,
    contextVersion: H8_CONTEXT_VERSION,
    all: args.all,
    limit: args.limit,
    positionFilter: args.position ?? null,
    playerIdFilter: args.playerId ?? null,
    sourceCounts: {
      globalWeeklyRows: allWeeklyRows.length,
      selectedWeeklyRows: selectedWeeklyRows.length,
      derivedRows: derivedRows.length,
      teamGameRows: teamGameRows.length,
      evidenceRowsBuilt: evidenceRows.length,
      snapshotRowsBuilt: snapshotRows.length,
    },
    population: {
      eligibleCount: allEligible.length,
      eligibleByPosition: eligiblePosDist,
      selectedCount: derivedResults.length,
      selectedByPosition: posDist,
      multiTeamCount: multiTeam.length,
    },
    applicabilitySummary: popSummary,
    warnings,
    rows: derivedResults.map((r) => ({
      playerId: r.eligible.playerId,
      name: r.displayName,
      position: r.eligible.position,
      primaryTeam: r.eligible.primaryTeam,
      teamsPlayedFor: r.eligible.teamsPlayedFor,
      games: r.eligible.games,
      targetShare: r.targetShare,
      carryShare: r.carryShare,
      passRate: r.passRate,
      rzShare: r.rzShare,
      applicableObs: r.breakdown.applicableObserved + r.breakdown.applicableInferred,
      applicableUnk: r.breakdown.applicableUnknown,
      notApplicable: r.breakdown.notApplicable,
      evidenceCount: r.evidenceRecords.length,
    })),
    backlogs: firstResult?.context.backlogs ?? [],
    dbWrites: dbWrites ? {
      evidenceAttempted: dbWrites.evidenceAttempted,
      snapshotsAttempted: dbWrites.snapshotsAttempted,
    } : null,
  };

  try {
    ensureArtifactDir(artifactPath);
    writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
    console.log(`\nArtifact: ${artifactPath}`);
  } catch (e) {
    console.error(`\n[error] Could not write artifact: ${e}`);
  }

  // Verdict
  const allPositionsOk =
    args.position || args.playerId
      ? true
      : SKILL_POSITIONS.every((p) => (posDist[p] ?? 0) > 0);

  const verdict =
    !allPositionsOk
      ? "SAMPLE SELECTION STILL INCORRECT"
      : withTarget.length === 0
        ? "WEEKLY DATA QUERY STILL BROKEN (zero target shares)"
        : args.execute && dbWrites
          ? `H8 PHASE B RESILIENT AND RESUMABLE — ${dbWrites.snapshotsAttempted}/${derivedResults.length} snapshots attempted`
          : args.all || derivedResults.length === allEligible.length
            ? "H8 FULL POPULATION READY FOR PERSISTENCE"
            : "H8 SAMPLE VALIDATED — use --all for full population execute";

  console.log(`\n=== Verdict: ${verdict} ===`);

  if (!args.execute) {
    console.log(`\nSafe execute commands:`);
    console.log(`  Full:  npm run dry-run:h8-context -- --historical-season=${args.historicalSeason} --context-season=${args.contextSeason} --all --execute`);
    console.log(`  By pos: npm run dry-run:h8-context -- --historical-season=${args.historicalSeason} --context-season=${args.contextSeason} --position=QB --execute`);
  }
  console.log(`\n=== H8 Dry-Run Complete ===\n`);
}

main().catch((e) => {
  console.error(`\nFatal error in Phase A — EXECUTE ABORTED — no database writes performed`);
  console.error(String(e));
  process.exit(1);
});
