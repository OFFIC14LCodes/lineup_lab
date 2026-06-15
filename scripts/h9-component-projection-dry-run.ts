// H9.2 — Component Projection Dry-Run Diagnostic
//
// Usage:
//   npm run dry-run:h9-components -- --historical-season=2025 --projection-season=2026 --all
//   npm run dry-run:h9-components -- --position=WR --limit=25
//   npm run dry-run:h9-components -- --player-id=<uuid>

import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { loadAllPagesWith } from "@/lib/context/paginated-loader";
import { REGULAR_SEASON_PLAYER, SKILL_POSITIONS } from "@/lib/context/season-type";
import type { BlackbirdDerivedContext } from "@/lib/context/types";
import { normalizePlayerStats } from "@/lib/projections/normalize";
import { projectComponentPopulation, type PlayerStatProjection } from "@/lib/projections/component-projections";
import type { H8ContextFields, H8FieldSnapshot, HistoricalPlayerProjectionInput, ProjectionPosition } from "@/lib/projections/types";

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

function argValue(name: string, def: string | null = null): string | null {
  const argv = process.argv.slice(2);
  const eq = argv.find(a => a.startsWith(`${name}=`));
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
  return {
    historicalSeason: parseInt(argValue("--historical-season", "2025") ?? "2025", 10),
    projectionSeason: parseInt(argValue("--projection-season", "2026") ?? "2026", 10),
    all: hasArg("--all"),
    position: position ? position.toUpperCase() as ProjectionPosition : null,
    limit: parseInt(argValue("--limit", "40") ?? "40", 10),
    playerId: argValue("--player-id"),
  };
}

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
  stats_json: Record<string, unknown>;
};

type PlayerContextDbRow = {
  id: string;
  canonical_player_id: string;
  derived_context_json: string | null;
};

type PlayerDetailRow = {
  id: string;
  position: string | null;
  primary_position: string | null;
};

async function loadWeeklyStats(supabase: SupabaseClient<any>, season: number, playerIds?: string[]): Promise<WeeklyStatDbRow[]> {
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

async function loadDerivedStats(supabase: SupabaseClient<any>, season: number, playerIds?: string[]): Promise<DerivedStatDbRow[]> {
  return loadAllPagesWith<DerivedStatDbRow>(
    (from, to) => {
      let q = supabase
        .from("player_weekly_derived_stats")
        .select("player_id, week, season, stats_json")
        .eq("season", season)
        .range(from, to);
      if (playerIds?.length) q = q.in("player_id", playerIds);
      return q;
    },
    { table: "player_weekly_derived_stats" }
  );
}

async function loadH8Snapshots(supabase: SupabaseClient<any>, season: number, playerIds?: string[]): Promise<PlayerContextDbRow[]> {
  return loadAllPagesWith<PlayerContextDbRow>(
    (from, to) => {
      let q = supabase
        .from("player_context_snapshots")
        .select("id, canonical_player_id, derived_context_json")
        .eq("season", season)
        .range(from, to);
      if (playerIds?.length && playerIds.length <= 250) q = q.in("canonical_player_id", playerIds);
      return q;
    },
    { table: "player_context_snapshots" }
  );
}

async function loadPlayerDetails(supabase: SupabaseClient<any>, playerIds: string[]): Promise<PlayerDetailRow[]> {
  if (!playerIds.length) return [];
  return loadAllPagesWith<PlayerDetailRow>(
    (from, to) => {
      let q = supabase
        .from("players")
        .select("id, position, primary_position")
        .range(from, to);
      if (playerIds.length <= 250) q = q.in("id", playerIds);
      return q;
    },
    { table: "players" }
  );
}

const UNKNOWN_SNAP: H8FieldSnapshot = {
  value: null,
  status: "unknown",
  confidence: "unresolved",
  sourceEvidenceIds: [],
};

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

function extractH8Fields(derivedContextJson: string | null): H8ContextFields {
  if (!derivedContextJson) return allUnknown();
  try {
    const ctx = JSON.parse(derivedContextJson) as BlackbirdDerivedContext;
    return {
      priorTargetShare: snapFromCtx(ctx.priorTargetShare),
      priorCarryShare: snapFromCtx(ctx.priorCarryShare),
      priorRedZoneShare: snapFromCtx(ctx.priorRedZoneShare),
      priorGoalLineShare: snapFromCtx(ctx.priorGoalLineShare),
      priorTeamPassRate: snapFromCtx(ctx.priorTeamPassRate),
      priorTeamRushRate: snapFromCtx(ctx.priorTeamRushRate),
      priorEarlyDownPassRate: snapFromCtx(ctx.priorEarlyDownPassRate),
    };
  } catch {
    return allUnknown();
  }
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {} as Record<T, number>);
}

function avg(values: number[]): number {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

function topRegressions(projections: PlayerStatProjection[], direction: "up" | "down", tdOnly: boolean) {
  return projections
    .flatMap(p => p.regressionDiagnostics.map(d => ({ playerId: p.canonicalPlayerId, position: p.position, ...d })))
    .filter(d => tdOnly ? d.metric.toLowerCase().includes("td") : !d.metric.toLowerCase().includes("td"))
    .filter(d => direction === "up" ? d.regressedRate > d.historicalRate : d.regressedRate < d.historicalRate)
    .map(d => ({ ...d, delta: Math.abs(d.regressedRate - d.historicalRate) }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 10);
}

function selectRepresentatives(projections: PlayerStatProjection[]) {
  const byId = new Map<string, PlayerStatProjection>();
  const add = (label: string, p: PlayerStatProjection | undefined) => {
    if (p && !byId.has(label)) byId.set(label, p);
  };
  const sorted = [...projections].sort((a, b) => a.canonicalPlayerId.localeCompare(b.canonicalPlayerId));
  const establishedQbs = sorted.filter(p => p.position === "QB" && p.roleFoundation.historicalRoleWeeks > 0 && p.medianComponents.passAttempts > 0);
  add("established_mobile_qb", establishedQbs.sort((a, b) => b.medianComponents.carries - a.medianComponents.carries)[0]);
  add("established_pocket_qb", establishedQbs.sort((a, b) => a.medianComponents.carries - b.medianComponents.carries)[0]);
  add("high_volume_rb", sorted.filter(p => p.position === "RB").sort((a, b) => b.medianComponents.carries - a.medianComponents.carries)[0]);
  add("receiving_rb", sorted.filter(p => p.position === "RB").sort((a, b) => b.medianComponents.targets - a.medianComponents.targets)[0]);
  add("high_target_wr", sorted.filter(p => p.position === "WR").sort((a, b) => b.medianComponents.targets - a.medianComponents.targets)[0]);
  add("zero_td_high_target_wr", sorted.filter(p => p.position === "WR" && p.roleWeekRates.receivingTdsPerTarget === 0).sort((a, b) => b.medianComponents.targets - a.medianComponents.targets)[0]);
  add("low_volume_backup_rb", sorted.filter(p => p.position === "RB" && p.roleFoundation.roleSampleClass.includes("BACKUP")).sort((a, b) => a.medianComponents.carries - b.medianComponents.carries)[0]);
  add("late_season_breakout_wr", sorted.filter(p => p.position === "WR" && p.roleFoundation.historicalRoleWeeks <= 6).sort((a, b) => b.ceilingComponents.receivingYards - a.ceilingComponents.receivingYards)[0]);
  add("established_te", sorted.filter(p => p.position === "TE").sort((a, b) => b.medianComponents.targets - a.medianComponents.targets)[0]);
  add("zero_role_week_player", sorted.find(p => p.roleFoundation.historicalRoleWeeks === 0));
  add("long_td_volatility", sorted.find(p => p.componentReasons.includes("LONG_TD_VOLATILITY")));
  add("misc_td_evidence", sorted.find(p => p.componentReasons.includes("NON_REPEATABLE_MISC_TD")));
  return [...byId.entries()].map(([label, p]) => ({
    label,
    canonicalPlayerId: p.canonicalPlayerId,
    position: p.position,
    roleClass: p.roleFoundation.roleSampleClass,
    median: p.medianComponents,
    floor: p.floorComponents,
    ceiling: p.ceilingComponents,
    reasons: p.componentReasons,
  }));
}

async function main() {
  const args = parseArgs();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const filterIds = args.playerId ? [args.playerId] : undefined;

  console.log("\nH9.2 Component Projection Dry-Run");
  console.log(`  Historical season: ${args.historicalSeason}`);
  console.log(`  Projection season: ${args.projectionSeason}`);
  console.log(`  Mode: ${args.playerId ? `player=${args.playerId}` : args.all ? "all" : args.position ? `position=${args.position}` : `limit=${args.limit}`}`);

  const weeklyRows = await loadWeeklyStats(supabase, args.historicalSeason, filterIds);
  const derivedRows = await loadDerivedStats(supabase, args.historicalSeason, filterIds);
  const statsByPlayer = new Map<string, WeeklyStatDbRow[]>();
  for (const row of weeklyRows) {
    if (!statsByPlayer.has(row.player_id)) statsByPlayer.set(row.player_id, []);
    statsByPlayer.get(row.player_id)!.push(row);
  }
  const fumRetTdByPlayerWeek = new Map(derivedRows.map(row => {
    const raw = row.stats_json?.fum_ret_td;
    const value = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
    return [`${row.player_id}:${row.week}`, value] as const;
  }));
  const derivedByPlayerWeek = new Map(derivedRows.map(row => [`${row.player_id}:${row.week}`, row.stats_json ?? {}] as const));
  const longTdByPlayerWeek = new Map(derivedRows.map(row => {
    const value = ["rec_td_40p", "rec_td_50p", "rush_td_40p", "rush_td_50p"]
      .reduce((sum, key) => {
        const raw = row.stats_json?.[key];
        return sum + (typeof raw === "number" && Number.isFinite(raw) ? raw : 0);
      }, 0);
    return [`${row.player_id}:${row.week}`, value] as const;
  }));

  let scopedPlayerIds = [...statsByPlayer.keys()];
  if (args.playerId) scopedPlayerIds = [args.playerId];
  const playerDetails = await loadPlayerDetails(supabase, scopedPlayerIds);
  const positionById = new Map(playerDetails.map(p => [p.id, (p.primary_position ?? p.position)?.toUpperCase() ?? ""]));
  if (args.position) scopedPlayerIds = scopedPlayerIds.filter(id => positionById.get(id) === args.position);

  const h8Snapshots = await loadH8Snapshots(supabase, args.projectionSeason, scopedPlayerIds);
  const h8ByPlayer = new Map(h8Snapshots.map(s => [s.canonical_player_id, s]));

  const allInputs: HistoricalPlayerProjectionInput[] = scopedPlayerIds
    .map(id => ({ id, position: positionById.get(id) ?? "" }))
    .filter(p => ["QB", "RB", "WR", "TE"].includes(p.position))
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, args.all || args.position || args.playerId ? undefined : args.limit)
    .flatMap(({ id, position }) => {
      const normalizeResult = normalizePlayerStats((statsByPlayer.get(id) ?? []).map(r => ({
        week: r.week,
        statsJson: r.stats_json,
        fumRetTd: fumRetTdByPlayerWeek.get(`${id}:${r.week}`) ?? 0,
        derivedStatsJson: derivedByPlayerWeek.get(`${id}:${r.week}`) ?? {},
      })));
      if (!normalizeResult.ok) {
        console.log(`  Skipping ${id}: ${normalizeResult.errors.slice(0, 2).join("; ")}`);
        return [];
      }
      const h8 = h8ByPlayer.get(id);
      return [{
        canonicalPlayerId: id,
        position: position as ProjectionPosition,
        historicalSeason: args.historicalSeason,
        projectionSeason: args.projectionSeason,
        weeklyStats: normalizeResult.stats.rows.map(row => ({
          ...row,
          longTds: longTdByPlayerWeek.get(`${id}:${row.week}`) ?? 0,
        })),
        h8SnapshotId: h8?.id ?? null,
        h8Fields: extractH8Fields(h8?.derived_context_json ?? null),
        compatibleAdpRecords: [],
      }];
    });

  const result = projectComponentPopulation(allInputs);
  const projections = result.projections;
  const artifactPath = path.join(process.cwd(), "artifacts", "projections", `h9-components-${args.historicalSeason}-to-${args.projectionSeason}.json`);
  mkdirSync(path.dirname(artifactPath), { recursive: true });

  const positionCounts = countBy(projections.map(p => p.position));
  const roleClassCounts = countBy(projections.map(p => p.roleFoundation.roleSampleClass));
  const reasonCounts = countBy(projections.flatMap(p => p.componentReasons));
  const avgOpportunity = Object.fromEntries((["QB", "RB", "WR", "TE"] as const).map(pos => {
    const pool = projections.filter(p => p.position === pos);
    return [pos, {
      passAttempts: avg(pool.map(p => p.medianComponents.passAttempts)),
      carries: avg(pool.map(p => p.medianComponents.carries)),
      targets: avg(pool.map(p => p.medianComponents.targets)),
      fumblesLost: avg(pool.map(p => p.medianComponents.fumblesLost)),
    }];
  }));
  const opportunityDiagnostics = projections
    .flatMap(p => p.opportunityDiagnostics.map(d => ({
      canonicalPlayerId: p.canonicalPlayerId,
      position: p.position,
      metric: d.metric,
      opportunityReferenceName: d.opportunityReferenceName,
      eligiblePlayerCount: d.eligiblePlayerCount,
      rawOpportunityRate: d.rawOpportunityRate,
      referenceRate: d.referenceRate,
      regressedOpportunityRate: d.regressedOpportunityRate,
      regressedTowardReference: d.regressedTowardReference,
      percentileUsed: d.percentileUsed,
      capValue: d.capValue,
      capApplied: d.capApplied,
      fallbackTierUsed: d.fallbackTierUsed,
      smallPool: d.smallPool,
      method: d.method,
    })));
  const representatives = selectRepresentatives(projections);
  const artifact = {
    historicalSeason: args.historicalSeason,
    projectionSeason: args.projectionSeason,
    populationCount: projections.length,
    positionCounts,
    roleClassCounts,
    referenceRates: result.referenceRates,
    averageProjectedOpportunityByPosition: avgOpportunity,
    opportunityDiagnosticsSummary: {
      count: opportunityDiagnostics.length,
      regressedCount: opportunityDiagnostics.filter(d => d.regressedTowardReference).length,
      cappedCount: opportunityDiagnostics.filter(d => d.capApplied).length,
      smallPoolCount: opportunityDiagnostics.filter(d => d.smallPool).length,
      fallbackCount: opportunityDiagnostics.filter(d => d.fallbackTierUsed !== "primary").length,
    },
    opportunityDiagnostics: opportunityDiagnostics.slice(0, 250),
    largestUpwardTdRegressions: topRegressions(projections, "up", true),
    largestDownwardTdRegressions: topRegressions(projections, "down", true),
    largestEfficiencyRegressions: [...topRegressions(projections, "up", false), ...topRegressions(projections, "down", false)]
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 10),
    zeroTdPlayersReceivingPositiveRegression: projections
      .filter(p => p.regressionDiagnostics.some(d => d.metric.toLowerCase().includes("td") && d.historicalRate === 0 && d.regressedRate > 0))
      .map(p => p.canonicalPlayerId)
      .slice(0, 50),
    tinySamplePlayersHeavilyRegressed: projections
      .filter(p => p.regressionDiagnostics.some(d => d.sampleWeight < 0.25))
      .map(p => p.canonicalPlayerId)
      .slice(0, 50),
    playersWithZeroProjectedRoleGames: projections
      .filter(p => p.roleFoundation.projectedAvailability.projectedRoleGames.median === 0)
      .map(p => p.canonicalPlayerId),
    widestComponentRanges: projections
      .map(p => ({
        canonicalPlayerId: p.canonicalPlayerId,
        position: p.position,
        width: p.upsideComponents.receivingYards + p.upsideComponents.rushingYards + p.upsideComponents.passingYards -
          (p.downsideComponents.receivingYards + p.downsideComponents.rushingYards + p.downsideComponents.passingYards),
      }))
      .sort((a, b) => b.width - a.width)
      .slice(0, 25),
    reasonCounts,
    invariantFailures: result.invariantFailures,
    representatives,
    projections,
  };
  writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

  console.log("\nPopulation");
  console.log(`  Players projected: ${projections.length}`);
  console.log(`  Position counts: ${JSON.stringify(positionCounts)}`);
  console.log(`  Role classes: ${JSON.stringify(roleClassCounts)}`);
  console.log("\nReference rates");
  for (const ref of result.referenceRates) {
    console.log(`  ${ref.position} ${ref.referenceName}: rate=${ref.rate.toFixed(6)} events=${ref.totalEvents} players=${ref.eligiblePlayerCount} opp=${ref.totalOpportunity} tier=${ref.fallbackTierUsed}${ref.zeroRateObserved ? " ZERO" : ""}${ref.smallPool ? " SMALL" : ""}`);
  }
  console.log("\nDiagnostics");
  console.log(`  Zero-TD positive regressions: ${artifact.zeroTdPlayersReceivingPositiveRegression.length}`);
  console.log(`  Tiny-sample heavily regressed: ${artifact.tinySamplePlayersHeavilyRegressed.length}`);
  console.log(`  Opportunity diagnostics: regressed=${artifact.opportunityDiagnosticsSummary.regressedCount} capped=${artifact.opportunityDiagnosticsSummary.cappedCount} smallPool=${artifact.opportunityDiagnosticsSummary.smallPoolCount} fallback=${artifact.opportunityDiagnosticsSummary.fallbackCount}`);
  console.log(`  Zero projected role games: ${artifact.playersWithZeroProjectedRoleGames.length}`);
  console.log(`  Invariant failures: ${result.invariantFailures.length}`);
  console.log(`  Reason counts: ${JSON.stringify(reasonCounts)}`);
  console.log(`  Artifact: ${artifactPath}`);
  console.log("\nRepresentative stat lines");
  for (const rep of representatives.slice(0, 12)) {
    console.log(`  ${rep.label}: ${rep.canonicalPlayerId} ${rep.position} med pass=${rep.median.passAttempts.toFixed(1)} rush=${rep.median.carries.toFixed(1)} tgt=${rep.median.targets.toFixed(1)} recYd=${rep.median.receivingYards.toFixed(1)} td=${(rep.median.passingTds + rep.median.rushingTds + rep.median.receivingTds).toFixed(2)}`);
  }
  console.log("\nDry-run complete — no database writes.\n");
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
