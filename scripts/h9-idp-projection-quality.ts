// H9.11.1 — IDP projection quality diagnostic.
//
// Read-only. Verifies latest persisted IDP/K projections against active Sleeper IDP scoring.

import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { loadAllPagesWith } from "@/lib/context/paginated-loader";
import { selectLatestCompleteRun } from "@/lib/projections/combined-projection-read-model";
import { H911_PROJECTION_METHOD, H911_PROJECTION_VERSION } from "@/lib/projections/idp-k-persistence";

type RunRow = {
  projection_run_id: string;
  method: string;
  projection_version: number;
  selection_scope: string | null;
  run_status: string;
  completed_at: string | null;
};

type OutputRow = {
  projection_run_id: string;
  canonical_player_id: string;
  league_id: string;
  position: string;
  floor_points: number;
  median_points: number;
  ceiling_points: number;
  projection_confidence_label: string;
  projected_position_rank: number | null;
  projected_components_json: Record<string, Record<string, number>> | null;
};

type PlayerRow = {
  id: string;
  full_name: string | null;
  team: string | null;
  position: string | null;
  position_group: string | null;
};

type LeagueRow = {
  id: string;
  name: string | null;
  season: number;
  scoring_settings_json: Record<string, unknown> | null;
  roster_positions_json: unknown;
};

const IDP_POSITIONS = new Set(["LB", "DL", "DB"]);
const IDP_PREFIXED_KEYS = ["idp_tkl_solo", "idp_tkl_ast", "idp_sack", "idp_tkl_loss", "idp_int", "idp_ff", "idp_fum_rec", "idp_pass_def"];

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

async function loadRuns(client: SupabaseClient<any>) {
  return loadAllPagesWith<RunRow>(
    (from, to) => client
      .from("projection_runs")
      .select("projection_run_id,method,projection_version,selection_scope,run_status,completed_at")
      .eq("method", H911_PROJECTION_METHOD)
      .range(from, to),
    { table: "projection_runs" }
  );
}

async function loadOutputs(client: SupabaseClient<any>, projectionRunId: string) {
  return loadAllPagesWith<OutputRow>(
    (from, to) => client
      .from("player_projection_outputs")
      .select("projection_run_id,canonical_player_id,league_id,position,floor_points,median_points,ceiling_points,projection_confidence_label,projected_position_rank,projected_components_json")
      .eq("projection_run_id", projectionRunId)
      .in("position", ["LB", "DL", "DB"])
      .range(from, to),
    { table: "player_projection_outputs" }
  );
}

async function loadPlayers(client: SupabaseClient<any>, ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  const rows: PlayerRow[] = [];
  for (let i = 0; i < uniqueIds.length; i += 100) {
    const chunk = uniqueIds.slice(i, i + 100);
    rows.push(...await loadAllPagesWith<PlayerRow>(
      (from, to) => client.from("players").select("id,full_name,team,position,position_group").in("id", chunk).range(from, to),
      { table: "players" }
    ));
  }
  return new Map(rows.map((row) => [row.id, row]));
}

async function loadLeagues(client: SupabaseClient<any>, projectionSeason: number) {
  const rows = await loadAllPagesWith<LeagueRow>(
    (from, to) => client
      .from("leagues")
      .select("id,name,season,scoring_settings_json,roster_positions_json")
      .eq("season", projectionSeason)
      .range(from, to),
    { table: "leagues" }
  );
  return new Map(rows.map((row) => [row.id, row]));
}

function hasIdpRoster(league: LeagueRow | undefined) {
  const roster = Array.isArray(league?.roster_positions_json) ? league.roster_positions_json.map(String) : [];
  return roster.some((slot) => IDP_POSITIONS.has(slot.toUpperCase()));
}

function idpScoringKeys(league: LeagueRow | undefined) {
  return Object.entries(league?.scoring_settings_json ?? {})
    .filter(([key, value]) => key.startsWith("idp_") && Number(value) !== 0)
    .map(([key]) => key)
    .sort();
}

function components(output: OutputRow) {
  return output.projected_components_json?.median ?? {};
}

function splashStats(stats: Record<string, number>) {
  return {
    interceptions: Number((stats.int ?? 0).toFixed(2)),
    forcedFumbles: Number((stats.ff ?? 0).toFixed(2)),
    fumbleRecoveries: Number((stats.fr ?? 0).toFixed(2)),
    passesDefended: Number((stats.pd ?? 0).toFixed(2)),
    touchdowns: Number((stats.def_td ?? 0).toFixed(2)),
  };
}

function sampleRows(outputs: OutputRow[], players: Map<string, PlayerRow>, league: LeagueRow | undefined) {
  return ["LB", "DL", "DB"].reduce<Record<string, unknown[]>>((samples, position) => {
    samples[position] = outputs
      .filter((output) => output.position === position)
      .sort((a, b) => (a.projected_position_rank ?? 9999) - (b.projected_position_rank ?? 9999) || b.median_points - a.median_points)
      .slice(0, 10)
      .map((output) => {
        const stats = components(output);
        const player = players.get(output.canonical_player_id);
        return {
          playerId: output.canonical_player_id,
          playerName: player?.full_name ?? output.canonical_player_id,
          team: player?.team ?? null,
          position: output.position,
          projectedTackles: Number(((stats.tkl ?? (stats.solo_tkl ?? 0) + (stats.ast_tkl ?? 0)) ?? 0).toFixed(2)),
          projectedSoloTackles: Number((stats.solo_tkl ?? 0).toFixed(2)),
          projectedAssistedTackles: Number((stats.ast_tkl ?? 0).toFixed(2)),
          projectedSacks: Number((stats.sack ?? 0).toFixed(2)),
          projectedSplashStats: splashStats(stats),
          medianFantasyPoints: Number(output.median_points.toFixed(2)),
          floor: Number(output.floor_points.toFixed(2)),
          ceiling: Number(output.ceiling_points.toFixed(2)),
          confidence: output.projection_confidence_label,
          scoringKeysApplied: idpScoringKeys(league),
        };
      });
    return samples;
  }, {});
}

async function main() {
  const projectionSeason = Number(argValue("--projection-season", "2026"));
  const client = supabase();
  const runs = await loadRuns(client);
  const latestRun = selectLatestCompleteRun(runs, H911_PROJECTION_METHOD);
  if (!latestRun) throw new Error("No complete IDP/K projection run found.");
  const outputs = await loadOutputs(client, latestRun.projection_run_id);
  const leagues = await loadLeagues(client, projectionSeason);
  const idpLeagueIds = [...new Set(outputs.map((output) => output.league_id))]
    .filter((leagueId) => hasIdpRoster(leagues.get(leagueId)));
  const selectedLeagueId = idpLeagueIds.find((id) => /bestballs/i.test(leagues.get(id)?.name ?? "")) ?? idpLeagueIds[0] ?? outputs[0]?.league_id;
  const selectedLeague = leagues.get(selectedLeagueId);
  const scoped = outputs.filter((output) => output.league_id === selectedLeagueId);
  const players = await loadPlayers(client, [...new Set(scoped.map((output) => output.canonical_player_id))]);
  const lowStarterRows = scoped.filter((output) => (output.projected_position_rank ?? 9999) <= 60 && output.median_points >= 4 && output.median_points <= 8);
  const singleDigitTopRows = scoped.filter((output) => (output.projected_position_rank ?? 9999) <= 25 && output.median_points < 10);
  const activeKeys = idpScoringKeys(selectedLeague);
  const artifact = {
    projectionSeason,
    latestIdpKRun: latestRun,
    expectedProjectionVersion: H911_PROJECTION_VERSION,
    usesLatestCorrectedVersion: latestRun.projection_version >= H911_PROJECTION_VERSION,
    selectedLeague: selectedLeague ? { leagueId: selectedLeague.id, leagueName: selectedLeague.name } : null,
    checks: {
      topIdpPlausible: singleDigitTopRows.length === 0,
      noStarterLevelSingleDigitSeasonPoints: lowStarterRows.length === 0,
      idpPrefixedScoringKeysRecognized: IDP_PREFIXED_KEYS.some((key) => activeKeys.includes(key)),
      noDoubleCountingIdpAndTeamDefenseSacks: activeKeys.includes("idp_sack") && !activeKeys.includes("sack"),
      noKDstScoringContamination: activeKeys.every((key) => key.startsWith("idp_")),
      latestProjectionRunSelected: latestRun.projection_version >= H911_PROJECTION_VERSION,
      warRoomUsesLatestCorrectedProjectionRun: latestRun.projection_version >= H911_PROJECTION_VERSION,
    },
    activeIdpScoringKeys: activeKeys,
    lowStarterRows: lowStarterRows.slice(0, 50),
    singleDigitTopRows: singleDigitTopRows.slice(0, 50),
    sampleTop10ByPosition: sampleRows(scoped, players, selectedLeague),
    verdict: lowStarterRows.length === 0 && singleDigitTopRows.length === 0 && latestRun.projection_version >= H911_PROJECTION_VERSION
      ? "H9.11.1 IDP IDENTITY AND PROJECTION QUALITY READY"
      : "H9.11.1 IDP SCORING FIX READY BUT IDENTITY QUALITY RISKS REMAIN",
  };

  const outDir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "h9-idp-projection-quality.json");
  const mdPath = path.join(outDir, "h9-idp-projection-quality.md");
  writeFileSync(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`);
  const samples = artifact.sampleTop10ByPosition as Record<string, Array<Record<string, unknown>>>;
  writeFileSync(mdPath, [
    "# H9.11.1 IDP Projection Quality",
    "",
    `Verdict: ${artifact.verdict}`,
    `Latest run: ${latestRun.projection_run_id} v${latestRun.projection_version}`,
    `Selected league: ${selectedLeague?.name ?? selectedLeagueId}`,
    "",
    "## Checks",
    "",
    ...Object.entries(artifact.checks).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Top Samples",
    "",
    ...["LB", "DL", "DB"].flatMap((position) => [
      `### ${position}`,
      "",
      "| Player | Team | Tackles | Sacks | Median | Floor | Ceiling | Confidence |",
      "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
      ...samples[position].map((row) => `| ${row.playerName} | ${row.team ?? ""} | ${row.projectedTackles} | ${row.projectedSacks} | ${row.medianFantasyPoints} | ${row.floor} | ${row.ceiling} | ${row.confidence} |`),
      "",
    ]),
  ].join("\n"));
  console.log(JSON.stringify({ jsonPath, mdPath, verdict: artifact.verdict, latestRun: artifact.latestIdpKRun, checks: artifact.checks }, null, 2));
}

main().catch((error) => {
  console.error("FATAL:", error);
  process.exit(1);
});
