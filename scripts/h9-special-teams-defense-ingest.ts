// H9.8 — IDP / K / DST ingestion foundation.
//
// Ingestion only: no projection modeling, no War Room ordering changes.

import path from "node:path";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import Papa from "papaparse";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { loadAllPagesWith } from "@/lib/context/paginated-loader";
import {
  H98_DST_UNAVAILABLE_COMPONENTS,
  H98_IDP_FIELD_MAP,
  H98_KICKER_FIELD_MAP,
  buildSourceAvailability,
  fieldCoverage,
  normalizeH98PlayerRow,
  type H98Category,
  type H98NormalizedPlayerRow,
} from "@/lib/projections/special-teams-defense-ingest";

type ExistingWeeklyRow = {
  player_id: string;
  provider: string;
  season: number;
  week: number;
  season_type: string;
  position_group: string | null;
};

type TeamGameRow = {
  game_id: string;
  season: number;
  week: number;
  season_type: string;
  team_id: string;
  opponent_id: string;
  points_allowed: number | null;
  yards_allowed: number | null;
  points_scored: number | null;
  offensive_yards: number | null;
  reconciliation_status: string;
};

type AdpSnapshotRow = {
  id: string;
  provider: string;
  scoring_format: string;
  is_superflex: boolean;
  is_best_ball: boolean;
  is_dynasty: boolean;
};

type AdpRecordRow = {
  snapshot_id: string;
  canonical_player_id: string | null;
  raw_position: string | null;
  identity_match_method: string | null;
};

type PlayerRow = {
  id: string;
  primary_position: string | null;
  position: string | null;
  position_group: string | null;
};

const BATCH_SIZE = 500;
const IDP_GROUPS = ["DL", "LB", "DB"];
const KICKER_GROUPS = ["K"];
const SOURCE_PROVIDER = "nflverse";
const DATA_VERSION = "h9.8-special-teams-defense";

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

function argValue(name: string, fallback: string | null = null) {
  const argv = process.argv.slice(2);
  const eq = argv.find((arg) => arg.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : fallback;
}

function hasArg(name: string) {
  return process.argv.slice(2).includes(name);
}

function supabase(): SupabaseClient<any> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase environment: NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and service or anon key are required.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function selectedCategories(): H98Category[] {
  if (hasArg("--all")) return ["idp", "kicker", "dst"];
  const categories: H98Category[] = [];
  if (hasArg("--idp")) categories.push("idp");
  if (hasArg("--kicker")) categories.push("kicker");
  if (hasArg("--dst")) categories.push("dst");
  return categories.length > 0 ? categories : ["idp", "kicker", "dst"];
}

function sourcePath(season: number) {
  return path.join(process.cwd(), "data", "raw", "nflverse", "player_stats", String(season), `stats_player_week_${season}.csv`);
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function statKeyList(map: ReadonlyArray<readonly [string, string]>) {
  return [...new Set(map.map(([, canonical]) => canonical))].sort();
}

function normalizeSourceRows(rawRows: Record<string, string>[]) {
  const idp: H98NormalizedPlayerRow[] = [];
  const kicker: H98NormalizedPlayerRow[] = [];
  const rejected: Record<string, number> = {};

  for (const raw of rawRows) {
    const result = normalizeH98PlayerRow(raw);
    if (!result.ok) {
      if (result.category) rejected[result.reason] = (rejected[result.reason] ?? 0) + 1;
      continue;
    }
    if (result.row.category === "idp") idp.push(result.row);
    if (result.row.category === "kicker") kicker.push(result.row);
  }

  return { idp, kicker, rejected };
}

async function resolveGsisIds(client: SupabaseClient<any>, rows: H98NormalizedPlayerRow[]) {
  const ids = [...new Set(rows.map((row) => row.gsisId))];
  const map = new Map<string, string>();
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    const { data, error } = await client
      .from("player_external_ids")
      .select("external_id,player_id")
      .eq("provider", "gsis")
      .eq("external_type", "gsis")
      .in("external_id", chunk);
    if (error) throw new Error(`GSIS identity lookup failed: ${error.message}`);
    for (const row of data ?? []) map.set(row.external_id as string, row.player_id as string);
  }
  return map;
}

async function loadExistingKeys(client: SupabaseClient<any>, season: number, positionGroups: string[]) {
  const rows = await loadAllPagesWith<ExistingWeeklyRow>(
    (from, to) => client
      .from("player_weekly_stats")
      .select("player_id,provider,season,week,season_type,position_group")
      .eq("provider", SOURCE_PROVIDER)
      .eq("season", season)
      .eq("season_type", "regular")
      .eq("data_version", DATA_VERSION)
      .in("position_group", positionGroups)
      .range(from, to),
    { table: "player_weekly_stats" }
  );
  return new Set(rows.map((row) => `${row.player_id}|${row.week}|${row.position_group}`));
}

async function insertWeeklyRows(
  client: SupabaseClient<any>,
  rows: H98NormalizedPlayerRow[],
  identityMap: Map<string, string>,
  existingKeys: Set<string>
) {
  const insertRows = rows
    .map((row) => {
      const playerId = identityMap.get(row.gsisId);
      if (!playerId) return null;
      const key = `${playerId}|${row.week}|${row.positionGroup}`;
      if (existingKeys.has(key)) return null;
      existingKeys.add(key);
      return {
        player_id: playerId,
        provider: SOURCE_PROVIDER,
        provider_external_id: row.gsisId,
        season: row.season,
        week: row.week,
        season_type: row.seasonType,
        team: row.team,
        opponent: row.opponent,
        position_group: row.positionGroup,
        stats_json: row.stats,
        provider_fantasy_points: null,
        data_version: DATA_VERSION,
        metadata_json: {
          h9_phase: "H9.8",
          category: row.category,
          raw_position: row.rawPosition,
          raw_position_group: row.rawPositionGroup,
          source_fields: row.sourceFields,
          all_zero_stats: row.allZeroStats,
        },
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  let written = 0;
  for (let i = 0; i < insertRows.length; i += BATCH_SIZE) {
    const chunk = insertRows.slice(i, i + BATCH_SIZE);
    const { error } = await client.from("player_weekly_stats").insert(chunk);
    if (error) throw new Error(`player_weekly_stats insert failed at row ${i}: ${error.message}`);
    written += chunk.length;
  }
  return written;
}

function duplicatePlayerWeeks(rows: H98NormalizedPlayerRow[], identityMap: Map<string, string>) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const playerId = identityMap.get(row.gsisId) ?? row.gsisId;
    const key = `${playerId}|${row.season}|${row.week}|${row.positionGroup}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([key, count]) => ({ key, count }));
}

function summarizePlayerRows(rows: H98NormalizedPlayerRow[], identityMap: Map<string, string>, expectedFields: string[]) {
  const unresolved = rows.filter((row) => !identityMap.has(row.gsisId));
  return {
    sourceRows: rows.length,
    resolvedRows: rows.length - unresolved.length,
    unresolvedRows: unresolved.length,
    distinctPlayers: new Set(rows.map((row) => identityMap.get(row.gsisId) ?? row.gsisId)).size,
    positionsDistribution: countBy(rows.map((row) => row.positionGroup)),
    rawPositionsDistribution: countBy(rows.map((row) => row.rawPosition || "UNKNOWN")),
    weeksCoverage: countBy(rows.map((row) => String(row.week))),
    teamsCoverage: countBy(rows.map((row) => row.team ?? "UNKNOWN")),
    fieldCoverage: fieldCoverage(rows, expectedFields),
    allZeroRows: rows.filter((row) => row.allZeroStats).length,
    duplicatePlayerWeekRows: duplicatePlayerWeeks(rows, identityMap),
    unresolvedPlayerIdentities: unresolved.slice(0, 100).map((row) => ({
      gsisId: row.gsisId,
      name: row.playerDisplayName,
      position: row.rawPosition,
      team: row.team,
      week: row.week,
    })),
  };
}

async function loadTeamGameRows(client: SupabaseClient<any>, season: number) {
  return loadAllPagesWith<TeamGameRow>(
    (from, to) => client
      .from("team_game_stats")
      .select("game_id,season,week,season_type,team_id,opponent_id,points_allowed,yards_allowed,points_scored,offensive_yards,reconciliation_status")
      .eq("season", season)
      .eq("season_type", "REG")
      .order("team_id", { ascending: true })
      .range(from, to),
    { table: "team_game_stats" }
  );
}

function summarizeDst(rows: TeamGameRow[]) {
  return {
    rows: rows.length,
    teams: new Set(rows.map((row) => row.team_id)).size,
    weeks: countBy(rows.map((row) => String(row.week))),
    games: new Set(rows.map((row) => row.game_id)).size,
    availableComponentFields: ["points_allowed", "yards_allowed", "points_scored", "offensive_yards"],
    missingComponentFields: H98_DST_UNAVAILABLE_COMPONENTS,
    pointsAllowedCoverage: rows.filter((row) => row.points_allowed !== null).length,
    yardsAllowedCoverage: rows.filter((row) => row.yards_allowed !== null).length,
    turnoverCoverage: 0,
    defensiveTdCoverage: 0,
    reconciliationStatus: countBy(rows.map((row) => row.reconciliation_status)),
    h5DeferredEdgeCaseWarnings: [
      "DST allowance tiers are available from team_game_stats, but rare DST scoring components remain unavailable.",
      "Do not score sacks, turnovers, blocked kicks, safeties, return TDs, or defensive 2PT returns until a verified component source is added.",
    ],
  };
}

async function summarizeAdp(client: SupabaseClient<any>, season: number) {
  const snapshots = await loadAllPagesWith<AdpSnapshotRow>(
    (from, to) => client
      .from("adp_snapshots")
      .select("id,provider,scoring_format,is_superflex,is_best_ball,is_dynasty")
      .eq("season", season + 1)
      .range(from, to),
    { table: "adp_snapshots" }
  );
  const records = snapshots.length === 0 ? [] : await loadAllPagesWith<AdpRecordRow>(
    (from, to) => client
      .from("adp_player_records")
      .select("snapshot_id,canonical_player_id,raw_position,identity_match_method")
      .in("snapshot_id", snapshots.map((snapshot) => snapshot.id))
      .range(from, to),
    { table: "adp_player_records" }
  );
  const players = await loadAllPagesWith<PlayerRow>(
    (from, to) => client
      .from("players")
      .select("id,primary_position,position,position_group")
      .range(from, to),
    { table: "players" }
  );
  const playerById = new Map(players.map((player) => [player.id, player]));
  const relevant = records.filter((record) => {
    const player = record.canonical_player_id ? playerById.get(record.canonical_player_id) : null;
    const pos = (player?.primary_position ?? player?.position ?? player?.position_group ?? record.raw_position ?? "").toUpperCase();
    return ["DL", "DE", "DT", "LB", "DB", "CB", "S", "SAF", "K", "PK", "DEF", "DST", "D/ST"].includes(pos) || pos.startsWith("DST");
  });
  return {
    snapshotCount: snapshots.length,
    recordCount: records.length,
    relevantRecordCount: relevant.length,
    providerDistribution: countBy(snapshots.map((snapshot) => snapshot.provider)),
    relevantPositionDistribution: countBy(relevant.map((record) => {
      const player = record.canonical_player_id ? playerById.get(record.canonical_player_id) : null;
      return (player?.primary_position ?? player?.position ?? player?.position_group ?? record.raw_position ?? "UNKNOWN").toUpperCase();
    })),
    resolvedRelevantRecords: relevant.filter((record) => record.canonical_player_id).length,
    unresolvedRelevantRecords: relevant.filter((record) => !record.canonical_player_id).length,
    formatGroups: snapshots.map((snapshot) => ({
      provider: snapshot.provider,
      scoringFormat: snapshot.scoring_format,
      isSuperflex: snapshot.is_superflex,
      isBestBall: snapshot.is_best_ball,
      isDynasty: snapshot.is_dynasty,
      idpCompatible: relevant.some((record) => {
        const player = record.canonical_player_id ? playerById.get(record.canonical_player_id) : null;
        const pos = (player?.primary_position ?? player?.position ?? player?.position_group ?? record.raw_position ?? "").toUpperCase();
        return ["DL", "DE", "DT", "LB", "DB", "CB", "S", "SAF"].includes(pos);
      }),
      dstKCompatible: relevant.some((record) => {
        const player = record.canonical_player_id ? playerById.get(record.canonical_player_id) : null;
        const pos = (player?.primary_position ?? player?.position ?? player?.position_group ?? record.raw_position ?? "").toUpperCase();
        return ["K", "PK", "DEF", "DST", "D/ST"].includes(pos) || pos.startsWith("DST");
      }),
    })),
    futureImportExpectations: [
      "provider",
      "season",
      "position",
      "overall_adp",
      "positional_adp",
      "format_group",
      "scoring_format",
      "team_count",
      "superflex_flag",
      "idp_flag",
      "dst_k_flag",
      "source_date",
    ],
  };
}

async function main() {
  const historicalSeason = Number(argValue("--historical-season", "2025"));
  const categories = selectedCategories();
  const execute = hasArg("--execute");
  const inspect = hasArg("--inspect");
  const allowPartialExecute = hasArg("--allow-partial-execute");
  const client = supabase();

  if (execute && !hasArg("--all") && !hasArg("--idp") && !hasArg("--kicker") && !hasArg("--dst")) {
    throw new Error("Execute requires --all or an explicit category flag.");
  }

  const csvPath = sourcePath(historicalSeason);
  if (!existsSync(csvPath)) throw new Error(`Missing archived nflverse player weekly source: ${csvPath}`);
  const csv = readFileSync(csvPath, "utf8");
  const sha256 = createHash("sha256").update(csv).digest("hex");
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  const sourceColumns = new Set(parsed.meta.fields ?? []);
  const normalized = normalizeSourceRows(parsed.data);
  const selectedPlayerRows = [
    ...(categories.includes("idp") ? normalized.idp : []),
    ...(categories.includes("kicker") ? normalized.kicker : []),
  ];

  const sourceAvailability = buildSourceAvailability({
    sourceColumns,
    canonicalDbColumns: new Set([
      "stats_json",
      "points_allowed",
      "yards_allowed",
      "points_scored",
      "offensive_yards",
    ]),
  });

  const unavailableSelected = categories.filter((category) => {
    if (category === "idp") return normalized.idp.length === 0;
    if (category === "kicker") return normalized.kicker.length === 0;
    return false;
  });
  if (execute && unavailableSelected.length > 0 && !allowPartialExecute) {
    throw new Error(`Partial execute blocked because source data is unavailable for: ${unavailableSelected.join(", ")}.`);
  }

  const identityMap = await resolveGsisIds(client, selectedPlayerRows);
  const idpExistingKeys = await loadExistingKeys(client, historicalSeason, IDP_GROUPS);
  const kickerExistingKeys = await loadExistingKeys(client, historicalSeason, KICKER_GROUPS);
  const idpExistingRowsBeforeWrite = idpExistingKeys.size;
  const kickerExistingRowsBeforeWrite = kickerExistingKeys.size;

  let idpWritten = 0;
  let kickerWritten = 0;
  if (execute && categories.includes("idp")) {
    idpWritten = await insertWeeklyRows(client, normalized.idp, identityMap, idpExistingKeys);
  }
  if (execute && categories.includes("kicker")) {
    kickerWritten = await insertWeeklyRows(client, normalized.kicker, identityMap, kickerExistingKeys);
  }

  const [teamRows, adp] = await Promise.all([
    categories.includes("dst") || inspect ? loadTeamGameRows(client, historicalSeason) : Promise.resolve([]),
    summarizeAdp(client, historicalSeason),
  ]);

  const idpSummary = summarizePlayerRows(normalized.idp, identityMap, statKeyList(H98_IDP_FIELD_MAP));
  const kickerSummary = summarizePlayerRows(normalized.kicker, identityMap, statKeyList(H98_KICKER_FIELD_MAP));
  const dstSummary = summarizeDst(teamRows);

  const artifact = {
    auditId: `h9.8-special-teams-defense-${new Date().toISOString()}`,
    historicalSeason,
    mode: execute ? "execute" : "dry-run",
    inspect,
    selectedCategories: categories,
    source: {
      filePath: csvPath,
      sha256,
      totalRows: parsed.data.length,
      sourceColumns: [...sourceColumns].sort(),
    },
    storageDecision: {
      decision: "Option A for player-level IDP/K: extend/use player_weekly_stats; DST remains team-level in team_game_stats.",
      migrationsCreated: [],
      rationale: [
        "player_weekly_stats already has provider, season, week, season_type, position_group, stats_json, metadata_json, and natural-key indexes.",
        "Existing builders and table constraints accept LB/K/DEF-style rows without offensive assumptions.",
        "DST is not player-level and should remain in team_game_stats until a richer team-defense component table is justified.",
      ],
      safeguards: [
        `H9.8 writes use data_version=${DATA_VERSION}.`,
        "Offensive rows and projection outputs are not modified.",
        "DST component gaps remain documented instead of fabricated.",
      ],
    },
    sourceAvailability,
    idp: {
      blockedReason: normalized.idp.length === 0 ? "IDP INGESTION BLOCKED — source data unavailable" : null,
      ...idpSummary,
      writePlan: {
        dryRunRows: normalized.idp.filter((row) => identityMap.has(row.gsisId)).length,
        executeRowsWritten: idpWritten,
        existingRowsBeforeWrite: idpExistingRowsBeforeWrite,
      },
    },
    kicker: {
      blockedReason: normalized.kicker.length === 0 ? "KICKER INGESTION BLOCKED — source data unavailable" : null,
      ...kickerSummary,
      distanceBucketCoverage: {
        madeBucketsPresent: kickerSummary.fieldCoverage.presentFields.filter((field) => field.startsWith("fgm_")),
        missedBucketsPresent: kickerSummary.fieldCoverage.presentFields.filter((field) => field.startsWith("fgmiss_")),
        attemptBucketsPresent: [],
        note: "nflverse weekly has make/miss distance buckets, not distance-bucket attempts; attempts are not fabricated.",
      },
      writePlan: {
        dryRunRows: normalized.kicker.filter((row) => identityMap.has(row.gsisId)).length,
        executeRowsWritten: kickerWritten,
        existingRowsBeforeWrite: kickerExistingRowsBeforeWrite,
      },
    },
    dst: dstSummary,
    adpAvailability: adp,
    categoryReadiness: {
      idp: normalized.idp.length > 0 && idpSummary.unresolvedRows < normalized.idp.length ? "ingestion-ready" : "blocked",
      kicker: normalized.kicker.length > 0 && kickerSummary.unresolvedRows < normalized.kicker.length ? "ingestion-ready" : "blocked",
      dst: teamRows.length > 0 ? "team-allowance-data-ready-component-gaps-documented" : "blocked",
      return: "deferred-no-owned-league-demand",
    },
  };

  const outDir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(outDir, { recursive: true });
  const ingestPath = path.join(outDir, `h9-special-teams-defense-ingest-${historicalSeason}.json`);
  const auditPath = path.join(outDir, `h9-special-teams-defense-data-audit-${historicalSeason}.json`);
  writeFileSync(ingestPath, `${JSON.stringify(artifact, null, 2)}\n`);
  writeFileSync(auditPath, `${JSON.stringify({
    auditId: artifact.auditId,
    historicalSeason,
    mode: artifact.mode,
    inspect: artifact.inspect,
    selectedCategories: artifact.selectedCategories,
    sourceAvailability,
    storageDecision: artifact.storageDecision,
    categoryReadiness: artifact.categoryReadiness,
    idp: artifact.idp,
    kicker: artifact.kicker,
    dst: artifact.dst,
    adpAvailability: artifact.adpAvailability,
  }, null, 2)}\n`);

  console.log(JSON.stringify({
    ingestArtifact: ingestPath,
    auditArtifact: auditPath,
    mode: artifact.mode,
    selectedCategories: categories,
    idp: {
      sourceRows: artifact.idp.sourceRows,
      resolvedRows: artifact.idp.resolvedRows,
      unresolvedRows: artifact.idp.unresolvedRows,
      existingRowsBeforeWrite: artifact.idp.writePlan.existingRowsBeforeWrite,
      executeRowsWritten: artifact.idp.writePlan.executeRowsWritten,
    },
    kicker: {
      sourceRows: artifact.kicker.sourceRows,
      resolvedRows: artifact.kicker.resolvedRows,
      unresolvedRows: artifact.kicker.unresolvedRows,
      existingRowsBeforeWrite: artifact.kicker.writePlan.existingRowsBeforeWrite,
      executeRowsWritten: artifact.kicker.writePlan.executeRowsWritten,
    },
    dst: {
      rows: artifact.dst.rows,
      teams: artifact.dst.teams,
      games: artifact.dst.games,
      pointsAllowedCoverage: artifact.dst.pointsAllowedCoverage,
      yardsAllowedCoverage: artifact.dst.yardsAllowedCoverage,
      missingComponentFields: artifact.dst.missingComponentFields,
    },
    adpRelevantRecords: artifact.adpAvailability.relevantRecordCount,
    categoryReadiness: artifact.categoryReadiness,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
