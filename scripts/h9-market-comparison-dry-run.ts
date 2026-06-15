// H9.6 — ADP / market comparison for persisted baseline projections.
//
// Usage:
//   npm run dry-run:h9-market-comparison -- --projection-run-id=<uuid>
//   npm run dry-run:h9-market-comparison -- --projection-run-id=<uuid> --execute
//   npm run dry-run:h9-market-comparison -- --projection-run-id=<uuid> --inspect

import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { loadAllPagesWith } from "@/lib/context/paginated-loader";
import type { AdpFormatProfile, LeagueFormatInput, PlayerAdpRecord } from "@/lib/adp/types";
import {
  buildLeagueMarketConsensus,
  buildMarketComparison,
  summarizeMarketInspection,
  type MarketComparison,
  type MarketInspectionRow,
  type SnapshotMarketInput,
} from "@/lib/projections/market-comparison";
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
    super("H9.6 market comparison persistence interrupted by SIGINT.");
    this.name = "InterruptedError";
  }
}

let interrupted = false;
process.on("SIGINT", () => {
  interrupted = true;
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
  const projectionRunId = argValue("--projection-run-id");
  if (!projectionRunId) throw new Error("--projection-run-id is required.");
  return {
    projectionRunId,
    execute: hasArg("--execute"),
    inspect: hasArg("--inspect"),
  };
}

function supabase(): SupabaseClient<any> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase environment: NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and service or anon key are required.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

type ProjectionRunRow = {
  projection_run_id: string;
  historical_season: number;
  projection_season: number;
  run_status: string;
};

type ProjectionOutputRow = {
  projection_run_id: string;
  canonical_player_id: string;
  league_id: string;
  position: ProjectionPosition;
  projected_position_rank: number;
  median_points: number;
  projection_confidence_score: number;
};

type LeagueRow = {
  id: string;
  season: number | string | null;
  total_teams: number | null;
  is_superflex: boolean | null;
  is_two_qb: boolean | null;
  te_premium: boolean | null;
  scoring_settings_json: Record<string, unknown> | null;
  roster_positions_json: unknown;
  settings_json: Record<string, unknown> | null;
};

type SnapshotRow = {
  id: string;
  provider: string;
  source_meta_json: Record<string, unknown> | null;
  source_confidence: "high" | "medium" | "low" | "unknown";
  season: number;
  team_count: number;
  scoring_format: string;
  ppr_value: number;
  te_premium_value: number;
  is_dynasty: boolean;
  is_best_ball: boolean;
  is_superflex: boolean;
  sample_size: number | null;
  captured_at: string;
  effective_date: string;
};

type AdpRecordRow = {
  id: string;
  snapshot_id: string;
  canonical_player_id: string | null;
  sleeper_player_id: string | null;
  raw_name: string;
  raw_position: string | null;
  raw_team: string | null;
  raw_id: string | null;
  overall_adp: number;
  overall_rank: number | null;
  positional_adp: number | null;
  positional_rank: number | null;
  min_pick: number | null;
  max_pick: number | null;
  stddev: number | null;
  sample_size: number | null;
  identity_match_method: PlayerAdpRecord["identityMatchMethod"] | null;
  identity_match_confidence: number | null;
  is_rookie: boolean;
  has_historical_profile: boolean;
  raw_data_json: Record<string, unknown> | null;
};

function pprValue(settings: Record<string, unknown> | null): number {
  const rec = Number(settings?.rec ?? 0);
  if (rec >= 1) return 1;
  if (rec >= 0.5) return 0.5;
  return 0;
}

function leagueInput(row: LeagueRow): LeagueFormatInput {
  return {
    leagueId: row.id,
    pprValue: pprValue(row.scoring_settings_json),
    tePremiumValue: row.te_premium ? 0.5 : 0,
    teamCount: row.total_teams ?? 12,
    isDynasty: Boolean(row.settings_json?.type === "dynasty" || row.settings_json?.is_dynasty),
    isBestBall: Boolean(row.settings_json?.best_ball || row.settings_json?.bestBall),
    isSuperflex: Boolean(row.is_superflex || row.is_two_qb),
  };
}

function fallbackFormatProfile(row: SnapshotRow): AdpFormatProfile {
  return {
    draftType: row.is_best_ball ? "best_ball" : row.is_dynasty ? "dynasty_startup" : "redraft",
    platform: row.provider,
    scoringFormat: row.scoring_format === "half_ppr" ? "half_ppr" : row.scoring_format === "standard" ? "standard" : "ppr",
    pprValue: Number(row.ppr_value),
    tePremiumValue: Number(row.te_premium_value),
    rosterPositions: [],
    teamCount: row.team_count,
    isBestBall: row.is_best_ball,
    isDynasty: row.is_dynasty,
    isStartup: row.is_dynasty,
    isSuperflex: row.is_superflex,
    isTePremium: Number(row.te_premium_value) > 0,
  };
}

function snapshotFormat(row: SnapshotRow): AdpFormatProfile {
  const meta = row.source_meta_json as { formatProfile?: AdpFormatProfile } | null;
  return meta?.formatProfile ?? fallbackFormatProfile(row);
}

function toPlayerRecord(row: AdpRecordRow): PlayerAdpRecord {
  return {
    rawId: row.raw_id,
    rawName: row.raw_name,
    rawPosition: row.raw_position,
    rawTeam: row.raw_team,
    overallAdp: Number(row.overall_adp),
    overallRank: row.overall_rank,
    positionalAdp: row.positional_adp === null ? null : Number(row.positional_adp),
    positionalRank: row.positional_rank,
    minPick: row.min_pick,
    maxPick: row.max_pick,
    stddev: row.stddev === null ? null : Number(row.stddev),
    sampleSize: row.sample_size,
    extraFields: row.raw_data_json ?? {},
    canonicalPlayerId: row.canonical_player_id,
    sleeperPlayerId: row.sleeper_player_id,
    resolvedName: null,
    resolvedPosition: row.raw_position,
    resolvedTeam: row.raw_team,
    identityMatchMethod: row.identity_match_method,
    identityMatchConfidence: row.identity_match_confidence,
    isRookie: row.is_rookie,
    hasHistoricalProfile: row.has_historical_profile,
  };
}

async function assertComparisonTable(client: SupabaseClient<any>) {
  const { error } = await client
    .from("player_projection_market_comparisons")
    .select("comparison_id", { count: "exact", head: true });
  if (error) {
    throw new Error(`H9.6 BLOCKED — apply supabase/migrations/015_projection_market_comparisons.sql before --execute/--inspect (${error.message})`);
  }
}

async function loadRun(client: SupabaseClient<any>, projectionRunId: string): Promise<ProjectionRunRow> {
  const { data, error } = await client
    .from("projection_runs")
    .select("projection_run_id,historical_season,projection_season,run_status")
    .eq("projection_run_id", projectionRunId)
    .single();
  if (error) throw error;
  return data as ProjectionRunRow;
}

async function loadOutputs(client: SupabaseClient<any>, projectionRunId: string): Promise<ProjectionOutputRow[]> {
  return loadAllPagesWith<ProjectionOutputRow>(
    (from, to) => client
      .from("player_projection_outputs")
      .select("projection_run_id,canonical_player_id,league_id,position,projected_position_rank,median_points,projection_confidence_score")
      .eq("projection_run_id", projectionRunId)
      .order("canonical_player_id", { ascending: true })
      .order("league_id", { ascending: true })
      .range(from, to),
    { table: "player_projection_outputs" }
  );
}

async function loadLeagues(client: SupabaseClient<any>, leagueIds: string[]): Promise<LeagueRow[]> {
  return loadAllPagesWith<LeagueRow>(
    (from, to) => client
      .from("leagues")
      .select("id,season,total_teams,is_superflex,is_two_qb,te_premium,scoring_settings_json,roster_positions_json,settings_json")
      .in("id", leagueIds)
      .order("id", { ascending: true })
      .range(from, to),
    { table: "leagues" }
  );
}

async function loadSnapshots(client: SupabaseClient<any>, season: number): Promise<SnapshotRow[]> {
  return loadAllPagesWith<SnapshotRow>(
    (from, to) => client
      .from("adp_snapshots")
      .select("id,provider,source_meta_json,source_confidence,season,team_count,scoring_format,ppr_value,te_premium_value,is_dynasty,is_best_ball,is_superflex,sample_size,captured_at,effective_date")
      .eq("season", season)
      .order("captured_at", { ascending: false })
      .range(from, to),
    { table: "adp_snapshots" }
  );
}

async function loadAdpRecords(client: SupabaseClient<any>, snapshotIds: string[]): Promise<AdpRecordRow[]> {
  if (snapshotIds.length === 0) return [];
  return loadAllPagesWith<AdpRecordRow>(
    (from, to) => client
      .from("adp_player_records")
      .select("id,snapshot_id,canonical_player_id,sleeper_player_id,raw_name,raw_position,raw_team,raw_id,overall_adp,overall_rank,positional_adp,positional_rank,min_pick,max_pick,stddev,sample_size,identity_match_method,identity_match_confidence,is_rookie,has_historical_profile,raw_data_json")
      .in("snapshot_id", snapshotIds)
      .not("canonical_player_id", "is", null)
      .order("snapshot_id", { ascending: true })
      .order("overall_adp", { ascending: true })
      .range(from, to),
    { table: "adp_player_records" }
  );
}

function buildSnapshots(snapshotRows: SnapshotRow[], recordRows: AdpRecordRow[]): SnapshotMarketInput[] {
  const recordsBySnapshot = new Map<string, PlayerAdpRecord[]>();
  for (const row of recordRows) {
    const list = recordsBySnapshot.get(row.snapshot_id) ?? [];
    list.push(toPlayerRecord(row));
    recordsBySnapshot.set(row.snapshot_id, list);
  }
  return snapshotRows.map((row) => ({
    snapshotId: row.id,
    provider: row.provider,
    capturedAt: row.captured_at,
    sourceConfidence: row.source_confidence,
    sampleSize: row.sample_size,
    formatProfile: snapshotFormat(row),
    records: recordsBySnapshot.get(row.id) ?? [],
  }));
}

function buildComparisons(opts: {
  run: ProjectionRunRow;
  outputs: ProjectionOutputRow[];
  leagues: LeagueRow[];
  snapshots: SnapshotMarketInput[];
}): MarketComparison[] {
  const leagueById = new Map(opts.leagues.map((league) => [league.id, leagueInput(league)]));
  const comparisons: MarketComparison[] = [];
  for (const league of leagueById.values()) {
    const leagueOutputs = opts.outputs.filter((output) => output.league_id === league.leagueId);
    for (const position of ["QB", "RB", "WR", "TE"] as const) {
      const positionOutputs = leagueOutputs.filter((output) => output.position === position);
      if (positionOutputs.length === 0) continue;
      const consensus = buildLeagueMarketConsensus({
        league,
        position,
        snapshots: opts.snapshots,
      });
      const consensusByPlayer = new Map(consensus.records.map((record) => [record.canonicalPlayerId, record]));
      const compatibilityLabels = [...consensus.compatibilityBySnapshot.values()];
      const warnings = [...consensus.warningsBySnapshot.values()].flat();
      for (const output of positionOutputs) {
        comparisons.push(buildMarketComparison({
          projection: {
            projectionRunId: opts.run.projection_run_id,
            canonicalPlayerId: output.canonical_player_id,
            leagueId: output.league_id,
            position: output.position,
            projectedPositionRank: output.projected_position_rank,
          },
          consensus: consensusByPlayer.get(output.canonical_player_id) ?? null,
          breakdown: consensus.breakdowns.get(output.canonical_player_id) ?? null,
          compatibilityLabels,
          formatWarnings: warnings,
        }));
      }
    }
  }
  return comparisons.sort((a, b) =>
    a.leagueId.localeCompare(b.leagueId) ||
    a.canonicalPlayerId.localeCompare(b.canonicalPlayerId)
  );
}

function toDbRow(comparison: MarketComparison) {
  return {
    projection_run_id: comparison.projectionRunId,
    canonical_player_id: comparison.canonicalPlayerId,
    league_id: comparison.leagueId,
    market_overall_adp: comparison.marketOverallAdp,
    market_position_adp: comparison.marketPositionAdp,
    market_position_rank: comparison.marketPositionRank,
    projected_position_rank: comparison.projectedPositionRank,
    rank_delta: comparison.rankDelta,
    absolute_rank_delta: comparison.absoluteRankDelta,
    market_agreement_score: comparison.marketAgreementScore,
    market_discrepancy_label: comparison.marketDiscrepancyLabel,
    compatibility_label: comparison.compatibilityLabel,
    market_confidence_label: comparison.marketConfidenceLabel,
    provider_count: comparison.providerCount,
    provider_disagreement: comparison.providerDisagreement,
    source_contributions_json: comparison.sourceContributions,
    format_warnings_json: comparison.formatWarnings,
    reason_codes: comparison.reasonCodes,
    semantic_market_hash: comparison.semanticMarketHash,
    updated_at: new Date().toISOString(),
  };
}

function chunks<T>(rows: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < rows.length; i += size) result.push(rows.slice(i, i + size));
  return result;
}

async function persistComparisons(client: SupabaseClient<any>, comparisons: MarketComparison[]) {
  let insertedOrUpdated = 0;
  for (const batch of chunks(comparisons.map(toDbRow), 500)) {
    if (interrupted) throw new InterruptedError();
    const { data, error } = await client
      .from("player_projection_market_comparisons")
      .upsert(batch, { onConflict: "projection_run_id,canonical_player_id,league_id" })
      .select("comparison_id");
    if (error) throw error;
    insertedOrUpdated += data?.length ?? 0;
  }
  return { attempted: comparisons.length, insertedOrUpdated };
}

async function inspectComparisons(
  client: SupabaseClient<any>,
  projectionRunId: string,
  expectedCount: number
) {
  let rows: Array<MarketInspectionRow & { rank_delta: number | null }>;
  try {
    rows = await loadAllPagesWith(
      (from, to) => client
        .from("player_projection_market_comparisons")
        .select("canonical_player_id,league_id,compatibility_label,reason_codes,provider_count,rank_delta")
        .eq("projection_run_id", projectionRunId)
        .order("canonical_player_id", { ascending: true })
        .order("league_id", { ascending: true })
        .range(from, to),
      { table: "player_projection_market_comparisons" }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("player_projection_market_comparisons") || message.includes("schema cache")) {
      throw new Error(`H9.6 BLOCKED — apply supabase/migrations/015_projection_market_comparisons.sql before --execute/--inspect (${message})`);
    }
    throw error;
  }
  return summarizeMarketInspection(rows, expectedCount);
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function topByDelta(comparisons: MarketComparison[], direction: "above" | "below") {
  return comparisons
    .filter((comparison) => direction === "above"
      ? (comparison.rankDelta ?? 0) > 0
      : (comparison.rankDelta ?? 0) < 0
    )
    .sort((a, b) => direction === "above"
      ? (b.rankDelta ?? 0) - (a.rankDelta ?? 0)
      : (a.rankDelta ?? 0) - (b.rankDelta ?? 0)
    )
    .slice(0, 20)
    .map((comparison) => ({
      leagueId: comparison.leagueId,
      canonicalPlayerId: comparison.canonicalPlayerId,
      projectedPositionRank: comparison.projectedPositionRank,
      marketPositionRank: comparison.marketPositionRank,
      rankDelta: comparison.rankDelta,
      label: comparison.marketDiscrepancyLabel,
      confidence: comparison.marketConfidenceLabel,
    }));
}

function highestProviderDisagreement(comparisons: MarketComparison[]) {
  return comparisons
    .filter((comparison) => comparison.providerDisagreement !== null)
    .sort((a, b) => (b.providerDisagreement ?? 0) - (a.providerDisagreement ?? 0))
    .slice(0, 20)
    .map((comparison) => ({
      leagueId: comparison.leagueId,
      canonicalPlayerId: comparison.canonicalPlayerId,
      providerDisagreement: comparison.providerDisagreement,
      providerCount: comparison.providerCount,
      rankDelta: comparison.rankDelta,
    }));
}

async function main() {
  const args = parseArgs();
  const client = supabase();
  const run = await loadRun(client, args.projectionRunId);
  if (run.run_status !== "complete") {
    throw new Error(`Projection run ${args.projectionRunId} is not complete (status=${run.run_status}).`);
  }
  const outputs = await loadOutputs(client, args.projectionRunId);
  const leagues = await loadLeagues(client, [...new Set(outputs.map((output) => output.league_id))]);
  const snapshots = await loadSnapshots(client, run.projection_season);
  const adpRecords = await loadAdpRecords(client, snapshots.map((snapshot) => snapshot.id));
  const snapshotInputs = buildSnapshots(snapshots, adpRecords);
  const comparisons = buildComparisons({ run, outputs, leagues, snapshots: snapshotInputs });

  const compatibleComparisonCount = comparisons.filter((comparison) => comparison.marketPositionRank !== null).length;
  const noMarketCount = comparisons.filter((comparison) => comparison.reasonCodes.includes("MARKET_DATA_UNAVAILABLE")).length;
  const artifact = {
    projectionRun: run,
    leaguesLoaded: leagues.length,
    projectionOutputsLoaded: outputs.length,
    adpSnapshotsLoaded: snapshots.length,
    adpRecordsLoaded: adpRecords.length,
    comparisonCount: comparisons.length,
    compatibleComparisonCount,
    noMarketCount,
    incompatibleOnlyCount: comparisons.filter((comparison) => comparison.compatibilityLabel === "INCOMPATIBLE").length,
    providerCountDistribution: countBy(comparisons.map((comparison) => String(comparison.providerCount))),
    compatibilityDistribution: countBy(comparisons.map((comparison) => comparison.compatibilityLabel)),
    marketDiscrepancyDistribution: countBy(comparisons.map((comparison) => comparison.marketDiscrepancyLabel)),
    formatWarningCount: comparisons.filter((comparison) => comparison.formatWarnings.length > 0).length,
    topAboveMarket: topByDelta(comparisons, "above"),
    topBelowMarket: topByDelta(comparisons, "below"),
    highestProviderDisagreement: highestProviderDisagreement(comparisons),
    writePlanCounts: {
      comparisonRows: comparisons.length,
    },
    sampleComparisons: comparisons.slice(0, 25),
  };

  const outDir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `h9-market-comparison-${run.historical_season}-to-${run.projection_season}.json`);
  writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);

  let inspection = null;
  if (args.execute || args.inspect) {
    await assertComparisonTable(client);
  }
  if (args.execute) {
    const persist = await persistComparisons(client, comparisons);
    inspection = await inspectComparisons(client, args.projectionRunId, comparisons.length);
    console.log(JSON.stringify({ persist }, null, 2));
  }
  if (args.inspect && !args.execute) {
    inspection = await inspectComparisons(client, args.projectionRunId, comparisons.length);
  }

  console.log(JSON.stringify({
    artifact: outPath,
    projectionRunId: run.projection_run_id,
    projectionOutputsLoaded: outputs.length,
    leaguesLoaded: leagues.length,
    adpSnapshotsLoaded: snapshots.length,
    adpRecordsLoaded: adpRecords.length,
    compatibleComparisonCount,
    noMarketCount,
    incompatibleOnlyCount: artifact.incompatibleOnlyCount,
    providerCountDistribution: artifact.providerCountDistribution,
    compatibilityDistribution: artifact.compatibilityDistribution,
    marketDiscrepancyDistribution: artifact.marketDiscrepancyDistribution,
    formatWarningCount: artifact.formatWarningCount,
    topAboveMarket: artifact.topAboveMarket.slice(0, 10),
    topBelowMarket: artifact.topBelowMarket.slice(0, 10),
    highestProviderDisagreement: artifact.highestProviderDisagreement.slice(0, 10),
    writePlanCounts: artifact.writePlanCounts,
    inspection,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
