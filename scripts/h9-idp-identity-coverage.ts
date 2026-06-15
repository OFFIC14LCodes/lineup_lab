// H9.11.1 — IDP unresolved identity coverage diagnostic.
//
// Read-only. Reports unresolved source rows and deterministic repair opportunities.

import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import Papa from "papaparse";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { loadAllPagesWith } from "@/lib/context/paginated-loader";
import { normalizePlayerName, normalizePositionGroup, normalizeTeam } from "@/lib/players/normalize";
import {
  makeUnresolvedAggregate,
  matchIdentityCandidate,
  type H99CandidatePlayer,
} from "@/lib/projections/idp-k-identity-readiness";
import { normalizeH98PlayerRow, type H98NormalizedPlayerRow } from "@/lib/projections/special-teams-defense-ingest";

type PlayerRow = {
  id: string;
  full_name: string | null;
  normalized_name: string | null;
  team: string | null;
  primary_position: string | null;
  position: string | null;
  position_group: string | null;
  active: boolean | null;
};

type MappingRow = {
  player_id: string;
  external_id: string;
};

type LeagueRow = {
  scoring_settings_json: Record<string, unknown> | null;
};

const BATCH_SIZE = 500;

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

function argValue(name: string, fallback: string): string {
  const argv = process.argv.slice(2);
  const eq = argv.find((arg) => arg.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : fallback;
}

function supabase(): SupabaseClient<any> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment.");
  return createClient(url, key, { auth: { persistSession: false } });
}

function sourcePath(season: number) {
  return path.join(process.cwd(), "data", "raw", "nflverse", "player_stats", String(season), `stats_player_week_${season}.csv`);
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function normalizeSourceRows(rawRows: Record<string, string>[]) {
  const rows: H98NormalizedPlayerRow[] = [];
  for (const raw of rawRows) {
    const result = normalizeH98PlayerRow(raw);
    if (result.ok && result.row.category === "idp") rows.push(result.row);
  }
  return rows;
}

async function loadExistingGsisMappings(client: SupabaseClient<any>, gsisIds: string[]) {
  const map = new Map<string, string>();
  const ids = [...new Set(gsisIds)];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    const { data, error } = await client
      .from("player_external_ids")
      .select("player_id,external_id")
      .eq("provider", "gsis")
      .eq("external_type", "gsis")
      .in("external_id", chunk);
    if (error) throw new Error(`Failed to load GSIS mappings: ${error.message}`);
    for (const row of (data ?? []) as MappingRow[]) map.set(row.external_id, row.player_id);
  }
  return map;
}

async function loadPlayers(client: SupabaseClient<any>) {
  const rows = await loadAllPagesWith<PlayerRow>(
    (from, to) => client
      .from("players")
      .select("id,full_name,normalized_name,team,primary_position,position,position_group,active")
      .range(from, to),
    { table: "players" }
  );
  const candidatesByName = new Map<string, H99CandidatePlayer[]>();
  for (const row of rows) {
    const normalizedName = row.normalized_name ?? (row.full_name ? normalizePlayerName(row.full_name) : null);
    if (!normalizedName) continue;
    const candidate: H99CandidatePlayer = {
      playerId: row.id,
      fullName: row.full_name,
      normalizedName,
      team: normalizeTeam(row.team),
      positionGroup: normalizePositionGroup(row.position_group ?? row.primary_position ?? row.position),
      active: row.active,
    };
    candidatesByName.set(normalizedName, [...(candidatesByName.get(normalizedName) ?? []), candidate]);
  }
  return candidatesByName;
}

async function loadActiveIdpScoring(client: SupabaseClient<any>, projectionSeason: number) {
  const leagues = await loadAllPagesWith<LeagueRow>(
    (from, to) => client.from("leagues").select("scoring_settings_json").eq("season", projectionSeason).range(from, to),
    { table: "leagues" }
  );
  const scoring: Record<string, number> = {};
  for (const league of leagues) {
    for (const [key, value] of Object.entries(league.scoring_settings_json ?? {})) {
      if (!key.startsWith("idp_")) continue;
      const numeric = Number(value);
      if (Number.isFinite(numeric)) scoring[key] = Math.max(scoring[key] ?? 0, numeric);
    }
  }
  return scoring;
}

function idpFantasyProxy(stats: Record<string, number>, scoring: Record<string, number>) {
  return (
    (stats.solo_tkl ?? 0) * (scoring.idp_tkl_solo ?? 2) +
    (stats.ast_tkl ?? 0) * (scoring.idp_tkl_ast ?? 1) +
    (stats.tkl_loss ?? 0) * (scoring.idp_tkl_loss ?? 0) +
    (stats.sack ?? 0) * (scoring.idp_sack ?? 6) +
    (stats.qb_hit ?? 0) * (scoring.idp_qb_hit ?? 0) +
    (stats.int ?? 0) * (scoring.idp_int ?? 6) +
    (stats.pd ?? 0) * (scoring.idp_pass_def ?? 0) +
    (stats.ff ?? 0) * (scoring.idp_ff ?? 3) +
    (stats.fr ?? 0) * (scoring.idp_fum_rec ?? 3) +
    (stats.def_td ?? 0) * (scoring.idp_def_td ?? 6)
  );
}

function statVolume(rows: H98NormalizedPlayerRow[]) {
  return sum(rows.map((row) => sum(Object.values(row.stats).map((value) => Math.abs(value)))));
}

async function main() {
  const historicalSeason = Number(argValue("--historical-season", "2025"));
  const projectionSeason = Number(argValue("--projection-season", String(historicalSeason + 1)));
  const client = supabase();
  const parsed = Papa.parse<Record<string, string>>(readFileSync(sourcePath(historicalSeason), "utf8"), { header: true, skipEmptyLines: true });
  const sourceRows = normalizeSourceRows(parsed.data);
  const identityMap = await loadExistingGsisMappings(client, sourceRows.map((row) => row.gsisId));
  const candidatesByName = await loadPlayers(client);
  const activeScoring = await loadActiveIdpScoring(client, projectionSeason);
  const unresolvedRows = sourceRows.filter((row) => !identityMap.has(row.gsisId));
  const grouped = new Map<string, H98NormalizedPlayerRow[]>();
  for (const row of unresolvedRows) grouped.set(row.gsisId, [...(grouped.get(row.gsisId) ?? []), row]);

  const diagnostics = [...grouped.values()].map((rows) => {
    const aggregate = makeUnresolvedAggregate(rows);
    const decision = matchIdentityCandidate(aggregate, candidatesByName);
    const fantasyPointEstimate = idpFantasyProxy(aggregate.statSummary, activeScoring);
    const highPriority = aggregate.highPriority || fantasyPointEstimate >= 50 || (aggregate.statSummary.solo_tkl ?? 0) >= 25 || (aggregate.statSummary.sack ?? 0) >= 3;
    return {
      ...aggregate,
      fantasyPointEstimate: Number(fantasyPointEstimate.toFixed(2)),
      highPriority,
      matchStatus: decision.status,
      matchMethod: decision.method,
      matchConfidence: decision.confidence,
      reasonUnresolved: decision.reasonUnresolved,
      candidateMatches: decision.candidateMatches,
      recommendedAction: decision.recommendedAction,
    };
  }).sort((a, b) => b.fantasyPointEstimate - a.fantasyPointEstimate || b.totalOpportunityOrPointsProxy - a.totalOpportunityOrPointsProxy);

  const totalVolume = statVolume(sourceRows);
  const unresolvedVolume = statVolume(unresolvedRows);
  const identityRepairOpportunities = {
    exactOrNormalizedNameTeamPosition: diagnostics.filter((row) => row.matchMethod === "normalized_name_team_position").length,
    knownAlias: diagnostics.filter((row) => row.matchMethod === "known_alias").length,
    uniqueNamePositionManualReview: diagnostics.filter((row) => row.matchMethod === "unique_name_position").length,
    ambiguous: diagnostics.filter((row) => row.matchStatus === "ambiguous").length,
    stillUnresolved: diagnostics.filter((row) => row.matchStatus === "unresolved").length,
  };
  const verdict =
    diagnostics.filter((row) => row.highPriority && row.matchStatus !== "auto_safe").length > 0
      ? "H9.11.1 IDP SCORING FIX READY BUT IDENTITY QUALITY RISKS REMAIN"
      : "H9.11.1 IDP IDENTITY AND PROJECTION QUALITY READY";
  const artifact = {
    historicalSeason,
    projectionSeason,
    totalIdpSourceRows: sourceRows.length,
    resolvedIdpRows: sourceRows.length - unresolvedRows.length,
    unresolvedIdpRows: unresolvedRows.length,
    unresolvedIdpPercent: Number(((unresolvedRows.length / Math.max(1, sourceRows.length)) * 100).toFixed(2)),
    unresolvedIdpStatVolumePercent: Number(((unresolvedVolume / Math.max(1, totalVolume)) * 100).toFixed(2)),
    unresolvedByPosition: countBy(unresolvedRows.map((row) => row.positionGroup)),
    unresolvedByTeam: countBy(unresolvedRows.map((row) => row.team ?? "UNKNOWN")),
    unresolvedBySourceProvider: { nflverse: unresolvedRows.length },
    highPriorityUnresolvedPlayerCount: diagnostics.filter((row) => row.highPriority).length,
    highPriorityUnresolvedPlayers: diagnostics.filter((row) => row.highPriority),
    likelyNameMatches: diagnostics.filter((row) => row.matchMethod && row.matchMethod !== "unresolved").slice(0, 100),
    likelyTeamPositionMatches: diagnostics.filter((row) => row.matchMethod === "normalized_name_team_position").slice(0, 100),
    duplicateCandidateMatches: diagnostics.filter((row) => row.matchStatus === "ambiguous").slice(0, 100),
    missingCanonicalPlayerIds: diagnostics.filter((row) => row.matchStatus === "unresolved").slice(0, 100),
    identityRepairOpportunities,
    verdict,
  };

  const outDir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "h9-idp-identity-coverage.json");
  const mdPath = path.join(outDir, "h9-idp-identity-coverage.md");
  writeFileSync(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`);
  writeFileSync(mdPath, [
    "# H9.11.1 IDP Identity Coverage",
    "",
    `Verdict: ${artifact.verdict}`,
    "",
    `Rows: ${artifact.resolvedIdpRows}/${artifact.totalIdpSourceRows} resolved (${artifact.unresolvedIdpPercent}% unresolved).`,
    `Stat volume unresolved: ${artifact.unresolvedIdpStatVolumePercent}%.`,
    "",
    "## Repair Opportunities",
    "",
    ...Object.entries(identityRepairOpportunities).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Top High-Priority Unresolved",
    "",
    "| Player | Pos | Teams | Rows | Fantasy Proxy | Match | Action |",
    "| --- | --- | --- | ---: | ---: | --- | --- |",
    ...artifact.highPriorityUnresolvedPlayers.slice(0, 25).map((row) =>
      `| ${row.playerName} | ${row.positionGroup} | ${row.teams.join(",")} | ${row.rowCount} | ${row.fantasyPointEstimate} | ${row.matchMethod ?? row.matchStatus} | ${row.recommendedAction} |`
    ),
  ].join("\n"));
  console.log(JSON.stringify({ jsonPath, mdPath, verdict, unresolvedIdpRows: artifact.unresolvedIdpRows, unresolvedIdpStatVolumePercent: artifact.unresolvedIdpStatVolumePercent, identityRepairOpportunities }, null, 2));
}

main().catch((error) => {
  console.error("FATAL:", error);
  process.exit(1);
});
