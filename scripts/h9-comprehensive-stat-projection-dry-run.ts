import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { loadAllPagesWith } from "@/lib/context/paginated-loader";
import { normalizePrimaryPosition } from "@/lib/players/normalize";
import { sha256 } from "@/lib/projections/hash";
import {
  buildPlayerStatProjection,
  COMPREHENSIVE_STAT_PROJECTION_VERSION,
  projectionMedianStats,
  type HistoricalStatInput,
  type PlayerStatProjection,
} from "@/lib/projections/player-stat-projections";
import { loadRookieData, rookieProfileForPlayer } from "@/lib/projections/rookie-data-loader";
import { normalizeRookieProfile, type NormalizedRookieProfile } from "@/lib/projections/rookie-data-sources";
import {
  scorePlayerStatProjectionForLeague,
  type LeagueScoringProjectionInput,
  type ScoredProjection,
} from "@/lib/projections/scored-stat-projections";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections");
const PROJECTION_METHOD = "blackbird_comprehensive_stat_projections_v1";
const PROJECTION_VERSION = 4;
const SELECTION_SCOPE = "all_draftable_comprehensive";
const REASON_REGISTRY_VERSION = "h9.15-comprehensive-reasons-v1";
const PERSISTENCE_SCHEMA_VERSION = "h9.15-deduped-persistence-v4-def";
const DRAFTABLE_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF", "DL", "LB", "DB"];
const PERSISTABLE_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF", "DL", "LB", "DB"];

type Args = {
  historicalSeason: number;
  projectionSeason: number;
  leagueId: string | null;
  playerId: string | null;
  limit: number | null;
  persist: boolean;
  inspectPersistence: boolean;
};

type PlayerRow = {
  id: string;
  sleeper_player_id: string | null;
  full_name: string | null;
  position: string | null;
  primary_position: string | null;
  position_group: string | null;
  team: string | null;
  age: number | string | null;
  years_exp: number | string | null;
  active?: boolean | null;
  metadata_json?: Record<string, unknown> | null;
};

type SeasonStatsRow = {
  player_id: string | null;
  season: number;
  position_group: string | null;
  games_played: number | null;
  stats_json: Record<string, unknown> | null;
};

type WeeklyStatsRow = {
  player_id: string | null;
  season: number;
  week: number | null;
  season_type: string | null;
  position_group: string | null;
  stats_json: Record<string, unknown> | null;
};

type LeagueRow = {
  id: string;
  name: string | null;
  season: number | null;
  scoring_settings_json: Record<string, unknown> | null;
  roster_positions_json: unknown;
};

type OutputRow = {
  canonical_player_id: string;
  league_id: string;
  position: string;
  projected_ppg_when_in_role: number;
  floor_ppg: number;
  ceiling_ppg: number;
  downside_points: number;
  floor_points: number;
  median_points: number;
  ceiling_points: number;
  upside_points: number;
  model_uncertainty: number;
  player_volatility: number;
  total_range_width: number;
  projection_confidence_score: number;
  projection_confidence_label: string;
  market_agreement_score: null;
  market_discrepancy: null;
  market_discrepancy_label: null;
  projected_position_rank: number;
  projected_components_json: Record<string, Record<string, number>>;
  projection_method: string;
  player_projection_input_hash: string;
  semantic_input_hash: string;
};

loadLocalEnv();

main().catch((error) => {
  console.error("FATAL:", error);
  process.exit(1);
});

async function main() {
  const args = parseArgs();
  const client = supabase();

  const [players, seasonRows, leagues] = await Promise.all([
    loadPlayers(client, args),
    loadHistoricalRows(client, args),
    loadLeagues(client, args),
  ]);
  const rookieData = loadRookieData({
    candidates: players.map((player) => ({ id: player.id, full_name: player.full_name, position: playerPosition(player), team: player.team })),
    useExampleWhenMissing: false,
  });
  const historicalByPlayer = groupHistoricalRows(seasonRows);
  const projections = players.map((player) => buildProjectionForPlayer(player, historicalByPlayer.get(player.id) ?? [], args.projectionSeason, rookieData.profilesByPlayerId));
  const leagueInputs = leagues.map((league): LeagueScoringProjectionInput => ({
    leagueId: league.id,
    scoringSettings: league.scoring_settings_json ?? {},
  }));
  const scored = scoreAll(projections, leagueInputs);
  const persistencePlan = buildPersistencePlan({ args, players, projections, leagues, scored });
  const inspectionBefore = args.inspectPersistence || args.persist ? await inspectByHash(client, persistencePlan.semanticInputHash, persistencePlan.expected) : null;
  const persistence = args.persist ? await persistPlan(client, persistencePlan) : null;
  const inspectionAfter = persistence ? await inspectRun(client, persistence.projectionRunId, persistencePlan.expected) : inspectionBefore;

  const artifact = buildArtifact({ args, players, projections, leagues, scored, persistencePlan, persistence, persistenceInspection: inspectionAfter, rookieData });
  writeArtifacts("h9-comprehensive-stat-projections", artifact.projections);
  writeArtifacts("h9-comprehensive-scored-projections", artifact.scoring);

  console.log(JSON.stringify({
    inputPlayers: players.length,
    projectedPlayers: projections.length,
    projectedPlayersWithStats: projections.filter((projection) => Object.keys(projection.stats).length > 0).length,
    projectedRookies: projections.filter((projection) => projection.projectionType === "rookie").length,
    rookieDataImport: {
      sourcePath: rookieData.sourcePath,
      totalRows: rookieData.totalRows,
      validRows: rookieData.validRows,
      matchedRows: rookieData.matchedRows,
      unmatchedRows: rookieData.unmatchedRows,
      enrichmentSourcePath: rookieData.enrichmentSourcePath,
      enrichmentRows: rookieData.enrichmentRows,
      matchedEnrichmentRows: rookieData.matchedEnrichmentRows,
      conflictCount: rookieData.conflictCount,
    },
    positionDistribution: countBy(projections.map((projection) => projection.position)),
    confidenceDistribution: countBy(projections.map((projection) => projection.confidence)),
    scoredFantasyOutputs: scored.filter((row) => row.scored.medianFantasyPoints !== null).length,
    unsupportedScoringKeys: unique(scored.flatMap((row) => row.scored.unsupportedScoringKeys)),
    missingScoringStatProjectionCount: scored.reduce((sum, row) => sum + row.scored.missingProjectedStats.length, 0),
    persistencePlan: persistencePlan.expected,
    persistence: persistence ? { projectionRunId: persistence.projectionRunId, reusedCompleteRun: persistence.reusedCompleteRun } : null,
    persistenceInspection: inspectionAfter,
    artifacts: {
      projections: path.join(OUTPUT_DIR, "h9-comprehensive-stat-projections.json"),
      scoring: path.join(OUTPUT_DIR, "h9-comprehensive-scored-projections.json"),
    },
  }, null, 2));
}

function parseArgs(): Args {
  return {
    historicalSeason: numberArg("--historical-season", 2025),
    projectionSeason: numberArg("--projection-season", 2026),
    leagueId: stringArg("--league-id"),
    playerId: stringArg("--player-id"),
    limit: stringArg("--limit") ? Number(stringArg("--limit")) : null,
    persist: hasArg("--persist") || hasArg("--execute"),
    inspectPersistence: hasArg("--inspect-persistence"),
  };
}

function stringArg(name: string): string | null {
  const argv = process.argv.slice(2);
  const eq = argv.find((arg) => arg.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : null;
}

function numberArg(name: string, fallback: number): number {
  const value = stringArg(name);
  return value ? Number(value) : fallback;
}

function hasArg(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");
  return createClient(url, key);
}

async function loadPlayers(client: SupabaseClient<any>, args: Args): Promise<PlayerRow[]> {
  const rows = await loadAllPagesWith<PlayerRow>(
    (from, to) => {
      let query = client
        .from("players")
        .select("id,sleeper_player_id,full_name,position,primary_position,position_group,team,age,years_exp,active,metadata_json")
        .range(from, to);
      if (args.playerId) query = query.eq("id", args.playerId);
      return query;
    },
    { table: "players" }
  );
  const filtered = rows
    .filter((player) => player.full_name)
    .filter((player) => player.active !== false)
    .filter((player) => DRAFTABLE_POSITIONS.includes(playerPosition(player)));
  const deduped = uniqueBy(filtered, (player) => player.id);
  return args.limit ? deduped.slice(0, args.limit) : deduped;
}

async function loadHistoricalRows(client: SupabaseClient<any>, args: Args): Promise<SeasonStatsRow[]> {
  const seasons = [args.historicalSeason, args.historicalSeason - 1, args.historicalSeason - 2];
  const seasonRows = await loadAllPagesWith<SeasonStatsRow>(
    (from, to) => {
      let query = client
        .from("player_season_stats")
        .select("player_id,season,position_group,games_played,stats_json")
        .in("season", seasons)
        .not("player_id", "is", null)
        .range(from, to);
      if (args.playerId) query = query.eq("player_id", args.playerId);
      return query;
    },
    { table: "player_season_stats" }
  );
  if (seasonRows.length) return seasonRows;

  const weeklyRows = await loadAllPagesWith<WeeklyStatsRow>(
    (from, to) => {
      let query = client
        .from("player_weekly_stats")
        .select("player_id,season,week,season_type,position_group,stats_json")
        .in("season", seasons)
        .not("player_id", "is", null)
        .range(from, to);
      if (args.playerId) query = query.eq("player_id", args.playerId);
      return query;
    },
    { table: "player_weekly_stats" }
  );
  return aggregateWeeklyRows(weeklyRows);
}

function aggregateWeeklyRows(rows: WeeklyStatsRow[]): SeasonStatsRow[] {
  const byKey = new Map<string, SeasonStatsRow & { weeks: Set<number> }>();
  for (const row of rows) {
    if (!row.player_id || !row.stats_json) continue;
    if (row.season_type && row.season_type !== "regular") continue;
    const key = `${row.player_id}|${row.season}`;
    const existing = byKey.get(key) ?? {
      player_id: row.player_id,
      season: row.season,
      position_group: row.position_group,
      games_played: 0,
      stats_json: {},
      weeks: new Set<number>(),
    };
    if (typeof row.week === "number") existing.weeks.add(row.week);
    for (const [statKey, rawValue] of Object.entries(row.stats_json)) {
      const value = numberOrNull(rawValue);
      if (value === null) continue;
      existing.stats_json![statKey] = numberOrNull(existing.stats_json![statKey]) ?? 0;
      existing.stats_json![statKey] = (existing.stats_json![statKey] as number) + value;
    }
    byKey.set(key, existing);
  }
  return Array.from(byKey.values()).map(({ weeks, ...row }) => ({
    ...row,
    games_played: weeks.size || row.games_played,
  }));
}

async function loadLeagues(client: SupabaseClient<any>, args: Args): Promise<LeagueRow[]> {
  return loadAllPagesWith<LeagueRow>(
    (from, to) => {
      let query = client
        .from("leagues")
        .select("id,name,season,scoring_settings_json,roster_positions_json")
        .eq("season", args.projectionSeason)
        .range(from, to);
      if (args.leagueId) query = query.eq("id", args.leagueId);
      return query;
    },
    { table: "leagues" }
  );
}

function buildProjectionForPlayer(player: PlayerRow, historical: HistoricalStatInput[], projectionSeason: number, rookieProfiles: Map<string, NormalizedRookieProfile>): PlayerStatProjection {
  const age = numberOrNull(player.age);
  const yearsExperience = numberOrNull(player.years_exp);
  const metadata = player.metadata_json ?? {};
  const draftRound = numberOrNull(metadata.draft_round);
  const draftPick = numberOrNull(metadata.draft_pick);
  const draftOverall = numberOrNull(metadata.draft_overall) ?? numberOrNull(metadata.draft_number) ?? draftPick;
  const derivedProfile = yearsExperience === 0 && (draftRound !== null || draftPick !== null || draftOverall !== null)
    ? normalizeRookieProfile({
        playerId: player.id,
        playerName: player.full_name ?? player.id,
        position: playerPosition(player),
        team: player.team,
        season: projectionSeason,
        rookieYear: projectionSeason,
        age,
        yearsExperience,
        nflDraftRound: draftRound,
        nflDraftPick: draftPick,
        nflDraftOverall: draftOverall,
        nflDraftTeam: stringOrNull(metadata.draft_team) ?? player.team,
        source: "derived",
        sourceLabel: "players.metadata_json",
        dataGaps: ["college production", "landing spot role"],
      })
    : null;
  const importedProfile = rookieProfileForPlayer(rookieProfiles, { id: player.id, full_name: player.full_name, position: playerPosition(player) }, projectionSeason);
  const rookieProfile = importedProfile ?? derivedProfile;
  return buildPlayerStatProjection({
    playerId: player.id,
    playerName: player.full_name ?? player.id,
    position: playerPosition(player),
    team: player.team,
    season: projectionSeason,
    age,
    yearsExperience,
    historical,
    rookieContext: yearsExperience === 0
      ? {
          rookieYear: projectionSeason,
          draftCapitalScore: rookieProfile?.draftCapitalScore ?? null,
          collegeProductionScore: rookieProfile?.collegeProductionScore ?? null,
          opportunityScore: rookieProfile?.opportunityScore ?? null,
          landingSpotRole: rookieProfile?.landingSpotRole ?? null,
          collegeStatsAvailable: rookieProfile?.collegeProductionScore !== null,
          dataGaps: rookieProfile?.dataGaps ?? ["missing NFL draft capital", "missing college production profile", "rookie role uncertainty"],
          profile: rookieProfile,
        }
      : null,
  });
}

function groupHistoricalRows(rows: SeasonStatsRow[]): Map<string, HistoricalStatInput[]> {
  const byPlayer = new Map<string, HistoricalStatInput[]>();
  for (const row of rows) {
    if (!row.player_id || !row.stats_json) continue;
    const list = byPlayer.get(row.player_id) ?? [];
    list.push({ season: row.season, gamesPlayed: row.games_played, stats: row.stats_json });
    byPlayer.set(row.player_id, list);
  }
  for (const list of byPlayer.values()) list.sort((a, b) => b.season - a.season);
  return byPlayer;
}

function scoreAll(projections: PlayerStatProjection[], leagues: LeagueScoringProjectionInput[]) {
  return projections.flatMap((projection) =>
    leagues.map((league) => ({ projection, scored: scorePlayerStatProjectionForLeague(projection, league) }))
  );
}

function buildPersistencePlan(input: {
  args: Args;
  players: PlayerRow[];
  projections: PlayerStatProjection[];
  leagues: LeagueRow[];
  scored: Array<{ projection: PlayerStatProjection; scored: ScoredProjection }>;
}) {
  const playerHashes = new Map(input.projections.map((projection) => {
    const hash = semanticHash({
      playerId: projection.playerId,
      projection,
      method: PROJECTION_METHOD,
      version: COMPREHENSIVE_STAT_PROJECTION_VERSION,
    });
    return [projection.playerId, { playerDataHash: hash, playerProjectionInputHash: semanticHash([projection.playerId, hash, PROJECTION_METHOD]) }];
  }));
  const semanticInputHash = semanticHash({
    method: PROJECTION_METHOD,
    version: COMPREHENSIVE_STAT_PROJECTION_VERSION,
    persistenceSchemaVersion: PERSISTENCE_SCHEMA_VERSION,
    historicalSeason: input.args.historicalSeason,
    projectionSeason: input.args.projectionSeason,
    playerHashes: [...playerHashes.values()].map((row) => row.playerProjectionInputHash).sort(),
    leagueHashes: input.leagues.map((league) => semanticHash({ id: league.id, scoring: league.scoring_settings_json, roster: league.roster_positions_json })).sort(),
  });
  const scoredWithPoints = input.scored.filter((row) => row.scored.medianFantasyPoints !== null);
  const rankByLeaguePosition = buildPositionRanks(scoredWithPoints);
  const persistableProjections = input.projections.filter((projection) => PERSISTABLE_POSITIONS.includes(projection.position));
  const inputs = uniqueBy(uniqueBy(persistableProjections, (projection) => projection.playerId).map((projection) => {
    const hashes = playerHashes.get(projection.playerId)!;
    return {
      canonical_player_id: projection.playerId,
      position: projection.position,
      position_group: projection.position,
      role_sample_class: roleSampleClass(projection),
      role_sample_confidence: projection.confidence,
      games_confidence: projection.confidence,
      historical_active_weeks: projection.projectionType === "veteran" ? 17 : 0,
      historical_role_weeks: projection.projectionType === "veteran" ? 17 : 0,
      role_participation_factor: projection.projectionType === "fallback" ? 0 : 1,
      projected_active_games_floor: 0,
      projected_active_games_median: 17,
      projected_active_games_ceiling: 17,
      projected_role_games_floor: 0,
      projected_role_games_median: 17,
      projected_role_games_ceiling: 17,
      model_uncertainty: confidenceUncertainty(projection.confidence),
      player_volatility: projection.projectionType === "rookie" ? 0.75 : 0.45,
      total_range_width: projectionRangeWidth(projection),
      projection_confidence_score: confidenceScore(projection.confidence),
      projection_confidence_label: projection.confidence,
      h8_snapshot_id: null,
      adp_record_ids: [],
      player_data_hash: hashes.playerDataHash,
      player_projection_input_hash: hashes.playerProjectionInputHash,
    };
  }), (row) => row.canonical_player_id);
  const outputs: OutputRow[] = uniqueBy(uniqueBy(
    scoredWithPoints.filter(({ projection }) => PERSISTABLE_POSITIONS.includes(projection.position)),
    ({ projection, scored }) => `${projection.playerId}|${scored.leagueId}`
  ).map(({ projection, scored }) => {
    const hashes = playerHashes.get(projection.playerId)!;
    const median = scored.medianFantasyPoints ?? 0;
    const floor = scored.floorFantasyPoints ?? median;
    const ceiling = scored.ceilingFantasyPoints ?? median;
    const rank = rankByLeaguePosition.get(`${scored.leagueId}|${projection.position}|${projection.playerId}`) ?? 9999;
    return {
      canonical_player_id: projection.playerId,
      league_id: scored.leagueId,
      position: projection.position,
      projected_ppg_when_in_role: round(median / 17, 4),
      floor_ppg: round(floor / 17, 4),
      ceiling_ppg: round(ceiling / 17, 4),
      downside_points: floor,
      floor_points: floor,
      median_points: median,
      ceiling_points: ceiling,
      upside_points: ceiling,
      model_uncertainty: confidenceUncertainty(projection.confidence),
      player_volatility: projection.projectionType === "rookie" ? 0.75 : 0.45,
      total_range_width: clamp(round((ceiling - floor) / Math.max(1, median), 6), 0, 1),
      projection_confidence_score: confidenceScore(projection.confidence),
      projection_confidence_label: projection.confidence,
      market_agreement_score: null,
      market_discrepancy: null,
      market_discrepancy_label: null,
      projected_position_rank: rank,
      projected_components_json: scenarioComponents(projection),
      projection_method: PROJECTION_METHOD,
      player_projection_input_hash: hashes.playerProjectionInputHash,
      semantic_input_hash: semanticInputHash,
    };
  }), (row) => `${row.canonical_player_id}|${row.league_id}`);
  const reasonsWithoutRun = uniqueBy(uniqueBy(input.projections, (projection) => projection.playerId).flatMap((projection) => {
    const base = projection.reasons.map((reason) => ({
      canonical_player_id: projection.playerId,
      league_id: null as string | null,
      reason_code: reasonCode(reason),
      reason_scope: "player_stat_projection",
      direction: "neutral",
      magnitude: null as number | null,
      explanation: reason,
      source_evidence_ids: [] as string[],
    }));
    const gaps = projection.dataGaps.map((gap) => ({
      canonical_player_id: projection.playerId,
      league_id: null as string | null,
      reason_code: `DATA_GAP_${reasonCode(gap)}`,
      reason_scope: "player_stat_projection",
      direction: "widened",
      magnitude: null as number | null,
      explanation: gap,
      source_evidence_ids: [] as string[],
    }));
    return [...base, ...gaps];
  }), (row) => `${row.canonical_player_id}|${row.league_id ?? "GLOBAL"}|${row.reason_code}|${row.reason_scope}`);
  return {
    semanticInputHash,
    run: {
      projection_version: PROJECTION_VERSION,
      historical_season: input.args.historicalSeason,
      projection_season: input.args.projectionSeason,
      league_config_season: input.args.projectionSeason,
      context_version: 1,
      as_of_date: new Date().toISOString().slice(0, 10),
      method: PROJECTION_METHOD,
      code_version: codeVersion(),
      model_config_json: {
        projectionVersion: COMPREHENSIVE_STAT_PROJECTION_VERSION,
        reasonRegistryVersion: REASON_REGISTRY_VERSION,
        noAdpFallback: true,
        unit: "season",
        persistenceSchemaVersion: PERSISTENCE_SCHEMA_VERSION,
      },
      semantic_input_hash: semanticInputHash,
      selection_scope: SELECTION_SCOPE,
      run_status: "ready_to_persist",
      population_count: input.projections.length,
      league_count: input.leagues.length,
      input_count: inputs.length,
      output_count: outputs.length,
      reason_count: reasonsWithoutRun.length,
    },
    inputs,
    outputs,
    reasonsWithoutRun,
    expected: {
      inputCount: inputs.length,
      outputCount: outputs.length,
      reasonCount: reasonsWithoutRun.length,
      playerCount: input.projections.length,
      leagueCount: input.leagues.length,
    },
  };
}

async function persistPlan(client: SupabaseClient<any>, plan: ReturnType<typeof buildPersistencePlan>) {
  const run = await getOrCreateRun(client, plan);
  if (run.run_status === "complete") return { projectionRunId: run.projection_run_id, reusedCompleteRun: true };
  const projectionRunId = run.projection_run_id;
  const reasons = plan.reasonsWithoutRun.map((row) => ({
    ...row,
    projection_run_id: projectionRunId,
    reason_key: semanticHash([projectionRunId, row.canonical_player_id, row.league_id ?? "GLOBAL", row.reason_code, row.reason_scope]),
  }));
  await upsertBatch(client, "player_projection_inputs", plan.inputs.map((row) => ({ ...row, projection_run_id: projectionRunId })), "projection_run_id,canonical_player_id");
  await upsertBatch(client, "player_projection_outputs", plan.outputs.map((row) => ({ ...row, projection_run_id: projectionRunId })), "projection_run_id,canonical_player_id,league_id");
  await upsertBatch(client, "projection_reasons", reasons, "reason_key");
  const inspection = await inspectRun(client, projectionRunId, plan.expected);
  if (!inspection.complete) throw new Error(`H9.15 persistence inspection failed: ${JSON.stringify(inspection)}`);
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
  return { projectionRunId, reusedCompleteRun: false };
}

async function getOrCreateRun(client: SupabaseClient<any>, plan: ReturnType<typeof buildPersistencePlan>) {
  const { data: existing, error: existingError } = await client
    .from("projection_runs")
    .select("projection_run_id,run_status")
    .eq("semantic_input_hash", plan.semanticInputHash)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    if ((existing as { run_status?: string }).run_status !== "complete") {
      const { error } = await client
        .from("projection_runs")
        .update({ run_status: "persisting", failure_code: null, failure_message: null })
        .eq("projection_run_id", (existing as { projection_run_id: string }).projection_run_id);
      if (error) throw error;
    }
    return existing as { projection_run_id: string; run_status: string };
  }
  const { data, error } = await client
    .from("projection_runs")
    .insert({ ...plan.run, run_status: "persisting", started_at: new Date().toISOString() })
    .select("projection_run_id,run_status")
    .single();
  if (error) throw error;
  return data as { projection_run_id: string; run_status: string };
}

async function inspectByHash(client: SupabaseClient<any>, semanticInputHash: string, expected: ReturnType<typeof buildPersistencePlan>["expected"]) {
  const { data, error } = await client
    .from("projection_runs")
    .select("projection_run_id")
    .eq("semantic_input_hash", semanticInputHash)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return inspectRun(client, (data as { projection_run_id: string }).projection_run_id, expected);
}

async function inspectRun(client: SupabaseClient<any>, projectionRunId: string, expected: ReturnType<typeof buildPersistencePlan>["expected"]) {
  const [inputs, outputs, reasons] = await Promise.all([
    loadAllPagesWith<{ canonical_player_id: string; position: string | null }>(
      (from, to) => client
        .from("player_projection_inputs")
        .select("canonical_player_id,position")
        .eq("projection_run_id", projectionRunId)
        .order("canonical_player_id", { ascending: true })
        .range(from, to),
      { table: "player_projection_inputs" }
    ),
    loadAllPagesWith<{ canonical_player_id: string; league_id: string; position: string | null }>(
      (from, to) => client
        .from("player_projection_outputs")
        .select("canonical_player_id,league_id,position")
        .eq("projection_run_id", projectionRunId)
        .order("canonical_player_id", { ascending: true })
        .order("league_id", { ascending: true })
        .range(from, to),
      { table: "player_projection_outputs" }
    ),
    loadAllPagesWith<{ reason_key: string }>(
      (from, to) => client
        .from("projection_reasons")
        .select("reason_key")
        .eq("projection_run_id", projectionRunId)
        .order("reason_key", { ascending: true })
        .range(from, to),
      { table: "projection_reasons" }
    ),
  ]);
  const outputKeys = outputs.map((row) => `${row.canonical_player_id}|${row.league_id}`);
  const inputKeys = inputs.map((row) => row.canonical_player_id);
  const reasonKeys = reasons.map((row) => row.reason_key);
  return {
    projectionRunId,
    inputCount: inputs.length,
    outputCount: outputs.length,
    reasonCount: reasons.length,
    distinctInputPlayers: new Set(inputs.map((row) => row.canonical_player_id)).size,
    distinctOutputPlayers: new Set(outputs.map((row) => row.canonical_player_id)).size,
    distinctOutputLeagues: new Set(outputs.map((row) => row.league_id)).size,
    positionDistribution: countBy(inputs.map((row) => row.position ?? "UNK")),
    duplicateInputKeys: inputKeys.length - new Set(inputKeys).size,
    duplicateOutputKeys: outputKeys.length - new Set(outputKeys).size,
    duplicateReasonKeys: reasonKeys.length - new Set(reasonKeys).size,
    missingPlayerLeagueOutputs: Math.max(0, expected.outputCount - new Set(outputKeys).size),
    complete:
      inputs.length === expected.inputCount &&
      outputs.length === expected.outputCount &&
      reasons.length === expected.reasonCount &&
      inputKeys.length === new Set(inputKeys).size &&
      outputKeys.length === new Set(outputKeys).size &&
      reasonKeys.length === new Set(reasonKeys).size,
  };
}

async function upsertBatch(client: SupabaseClient<any>, table: string, rows: Array<Record<string, unknown>>, onConflict: string) {
  const conflictKeys = onConflict.split(",").map((key) => key.trim());
  const uniqueRows = uniqueBy(rows, (row) => conflictKeys.map((key) => String(row[key] ?? "")).join("|"));
  for (let index = 0; index < uniqueRows.length; index += 500) {
    const batch = uniqueRows.slice(index, index + 500);
    const { error } = await client.from(table).upsert(batch, { onConflict });
    if (error) throw error;
  }
}

function buildArtifact(input: {
  args: Args;
  players: PlayerRow[];
  projections: PlayerStatProjection[];
  leagues: LeagueRow[];
  scored: Array<{ projection: PlayerStatProjection; scored: ScoredProjection }>;
  persistencePlan: ReturnType<typeof buildPersistencePlan>;
  persistence: { projectionRunId: string; reusedCompleteRun: boolean } | null;
  persistenceInspection: Awaited<ReturnType<typeof inspectRun>> | null;
  rookieData: ReturnType<typeof loadRookieData>;
}) {
  const scoredWithPoints = input.scored.filter((row) => row.scored.medianFantasyPoints !== null);
  const projectionStatCoverageByPosition = Object.fromEntries(DRAFTABLE_POSITIONS.map((position) => {
    const rows = input.projections.filter((projection) => projection.position === position);
    return [position, countBy(rows.flatMap((projection) => Object.keys(projection.stats)))];
  }));
  const projections = {
    generatedAt: new Date().toISOString(),
    method: PROJECTION_METHOD,
    projectionVersion: COMPREHENSIVE_STAT_PROJECTION_VERSION,
    historicalSeason: input.args.historicalSeason,
    projectionSeason: input.args.projectionSeason,
    projectionUnit: "season",
    inputPlayers: input.players.length,
    projectedPlayers: input.projections.length,
    projectedPlayersWithStats: input.projections.filter((projection) => Object.keys(projection.stats).length > 0).length,
    projectedRookies: input.projections.filter((projection) => projection.projectionType === "rookie").length,
    fallbackProjectionCount: input.projections.filter((projection) => projection.projectionType === "fallback").length,
    positionDistribution: countBy(input.projections.map((projection) => projection.position)),
    confidenceDistribution: countBy(input.projections.map((projection) => projection.confidence)),
    rookieConfidenceDistribution: countBy(input.projections.filter((projection) => projection.projectionType === "rookie").map((projection) => projection.confidence)),
    rookieDataImport: {
      sourcePath: input.rookieData.sourcePath,
      totalRows: input.rookieData.totalRows,
      validRows: input.rookieData.validRows,
      invalidRows: input.rookieData.invalidRows,
      matchedRows: input.rookieData.matchedRows,
      unmatchedRows: input.rookieData.unmatchedRows,
      enrichmentSourcePath: input.rookieData.enrichmentSourcePath,
      enrichmentRows: input.rookieData.enrichmentRows,
      validEnrichmentRows: input.rookieData.validEnrichmentRows,
      invalidEnrichmentRows: input.rookieData.invalidEnrichmentRows,
      matchedEnrichmentRows: input.rookieData.matchedEnrichmentRows,
      unmatchedEnrichmentRows: input.rookieData.unmatchedEnrichmentRows,
      ambiguousEnrichmentRows: input.rookieData.ambiguousEnrichmentRows,
      conflictCount: input.rookieData.conflictCount,
      conflicts: input.rookieData.conflicts.slice(0, 25),
      errors: input.rookieData.errors.slice(0, 25),
    },
    rookieProfiles: input.rookieData.rows.map((row) => ({
      playerName: row.profile.playerName,
      position: row.profile.position,
      matchedPlayerId: row.matchedPlayerId,
      matchStatus: row.matchStatus,
      draftCapitalScore: row.profile.draftCapitalScore,
      collegeProductionScore: row.profile.collegeProductionScore,
      opportunityScore: row.profile.opportunityScore,
      confidence: row.profile.rookieProjectionConfidence,
      dataGaps: row.profile.dataGaps,
      errors: row.errors,
    })),
    projectionStatCoverageByPosition,
    sampleProjections: input.projections
      .filter((projection) => Object.keys(projection.stats).length > 0)
      .slice(0, 25),
    projections: input.projections,
    persistencePlan: input.persistencePlan.expected,
    persistence: input.persistence,
    persistenceInspection: input.persistenceInspection,
  };
  const scoring = {
    generatedAt: projections.generatedAt,
    method: PROJECTION_METHOD,
    leagueCount: input.leagues.length,
    scoredFantasyOutputs: scoredWithPoints.length,
    scoredOutputsByLeague: countBy(scoredWithPoints.map((row) => row.scored.leagueId)),
    scoredOutputsByPosition: countBy(scoredWithPoints.map((row) => row.projection.position)),
    unsupportedScoringKeys: unique(input.scored.flatMap((row) => row.scored.unsupportedScoringKeys)),
    missingProjectedStats: topCounts(input.scored.flatMap((row) => row.scored.missingProjectedStats), 50),
    floorMedianCeilingFailures: input.scored.filter((row) => {
      const { floorFantasyPoints: floor, medianFantasyPoints: median, ceilingFantasyPoints: ceiling } = row.scored;
      return floor !== null && median !== null && ceiling !== null && !(floor <= median && median <= ceiling);
    }).length,
    sampleScoredProjections: scoredWithPoints.slice(0, 25),
    scored: input.scored,
    persistencePlan: input.persistencePlan.expected,
    persistence: input.persistence,
    persistenceInspection: input.persistenceInspection,
  };
  return { projections, scoring };
}

function writeArtifacts(name: string, artifact: unknown) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const jsonPath = path.join(OUTPUT_DIR, `${name}.json`);
  const mdPath = path.join(OUTPUT_DIR, `${name}.md`);
  const json = JSON.stringify(artifact, null, 2);
  writeFileSync(jsonPath, `${json}\n`);
  writeFileSync(mdPath, `# ${name}\n\n\`\`\`json\n${json.slice(0, 15000)}\n\`\`\`\n`);
}

function buildPositionRanks(rows: Array<{ projection: PlayerStatProjection; scored: ScoredProjection }>): Map<string, number> {
  const grouped = new Map<string, Array<{ projection: PlayerStatProjection; scored: ScoredProjection }>>();
  for (const row of rows) {
    const key = `${row.scored.leagueId}|${row.projection.position}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  const ranks = new Map<string, number>();
  for (const [key, group] of grouped) {
    group
      .sort((a, b) => (b.scored.medianFantasyPoints ?? -9999) - (a.scored.medianFantasyPoints ?? -9999) || a.projection.playerName.localeCompare(b.projection.playerName))
      .forEach((row, index) => ranks.set(`${key}|${row.projection.playerId}`, index + 1));
  }
  return ranks;
}

function scenarioComponents(projection: PlayerStatProjection): Record<string, Record<string, number>> {
  return {
    floor: scenarioStats(projection, "floor"),
    median: projectionMedianStats(projection),
    ceiling: scenarioStats(projection, "ceiling"),
  };
}

function scenarioStats(projection: PlayerStatProjection, scenario: "floor" | "median" | "ceiling"): Record<string, number> {
  return Object.fromEntries(
    Object.entries(projection.stats)
      .filter((entry): entry is [string, { floor: number | null; median: number | null; ceiling: number | null } & Record<typeof scenario, number>] => entry[1][scenario] !== null)
      .map(([key, range]) => [key, range[scenario]])
  );
}

function playerPosition(player: PlayerRow): string {
  return normalizePrimaryPosition(player.position_group ?? player.primary_position ?? player.position) ?? (player.position_group ?? player.primary_position ?? player.position ?? "UNK").toUpperCase();
}

function roleSampleClass(projection: PlayerStatProjection): string {
  const idp = ["DL", "LB", "DB"].includes(projection.position);
  if (projection.position === "DEF") {
    if (projection.projectionType === "fallback") return "DST_ROLE_UNKNOWN";
    if (projection.confidence === "very_low") return "DST_LOW_SAMPLE";
    return "DST_ESTABLISHED_PARTIAL_SEASON";
  }
  if (projection.position === "K") {
    if (projection.projectionType === "fallback") return "K_ROLE_UNKNOWN";
    if (projection.confidence === "very_low") return "K_LOW_SAMPLE";
    return "K_ESTABLISHED_PARTIAL_SEASON";
  }
  if (idp) {
    if (projection.projectionType === "fallback") return "IDP_ROLE_UNKNOWN";
    if (projection.confidence === "very_low") return "IDP_MINIMAL_SAMPLE";
    return "IDP_ESTABLISHED_PARTIAL_SEASON";
  }
  if (projection.projectionType === "fallback") return "ROLE_UNKNOWN";
  if (projection.confidence === "very_low") return "MINIMAL_SAMPLE";
  return "ESTABLISHED_PARTIAL_SEASON";
}

function projectionRangeWidth(projection: PlayerStatProjection): number {
  const med = Object.values(projection.stats).reduce((sum, range) => sum + Math.abs(range.median ?? 0), 0);
  const low = Object.values(projection.stats).reduce((sum, range) => sum + Math.abs(range.floor ?? 0), 0);
  const high = Object.values(projection.stats).reduce((sum, range) => sum + Math.abs(range.ceiling ?? 0), 0);
  return clamp(round((high - low) / Math.max(1, med), 6), 0, 1);
}

function confidenceScore(confidence: string): number {
  if (confidence === "high") return 0.9;
  if (confidence === "medium") return 0.7;
  if (confidence === "low") return 0.45;
  return 0.2;
}

function confidenceUncertainty(confidence: string): number {
  return round(1 - confidenceScore(confidence), 4);
}

function reasonCode(reason: string): string {
  return reason.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "UNKNOWN";
}

function semanticHash(value: unknown): string {
  return sha256(JSON.stringify(sortKeysDeep(value)));
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? Number(value.toFixed(6)) : null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (typeof value === "object") {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, sortKeysDeep((value as Record<string, unknown>)[key])]));
  }
  return String(value);
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {} as Record<string, number>);
}

function topCounts(values: string[], limit: number): Record<string, number> {
  return Object.fromEntries(Object.entries(countBy(values)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit));
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function uniqueBy<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const value of values) {
    const itemKey = key(value);
    if (seen.has(itemKey)) continue;
    seen.add(itemKey);
    result.push(value);
  }
  return result;
}

function round(value: number, places = 1): number {
  return Number(value.toFixed(places));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function codeVersion() {
  try {
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as { version?: string };
    return `blackbird-gm@${pkg.version ?? "0.0.0"}`;
  } catch {
    return "blackbird-gm@unknown";
  }
}

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}
