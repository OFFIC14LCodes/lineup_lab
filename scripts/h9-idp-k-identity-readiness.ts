// H9.9 — IDP/K identity repair and projection readiness.
//
// Identity/readiness only: no projection modeling and no War Room ordering changes.

import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import Papa from "papaparse";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { loadAllPagesWith } from "@/lib/context/paginated-loader";
import { normalizePlayerName, normalizePositionGroup, normalizeTeam } from "@/lib/players/normalize";
import {
  activeWeekMetrics,
  classifyDstReadiness,
  classifyProjectionReadiness,
  makeUnresolvedAggregate,
  matchIdentityCandidate,
  type H99CandidatePlayer,
  type H99UnresolvedAggregate,
} from "@/lib/projections/idp-k-identity-readiness";
import { normalizeH98PlayerRow, type H98NormalizedPlayerRow } from "@/lib/projections/special-teams-defense-ingest";

type ExistingMappingRow = {
  player_id: string;
  external_id: string;
};

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

type WeeklyRow = {
  player_id: string;
  provider_external_id: string | null;
  week: number;
  position_group: string | null;
  team: string | null;
  stats_json: Record<string, number>;
};

type TeamGameRow = {
  points_allowed: number | null;
  yards_allowed: number | null;
};

type AdpSnapshotRow = {
  id: string;
  provider: string;
};

type AdpRecordRow = {
  snapshot_id: string;
  canonical_player_id: string | null;
  raw_name: string;
  raw_position: string | null;
};

type H99MappingRow = {
  player_id: string;
  external_id: string;
  team: string | null;
  position_group: string | null;
  confidence: number | null;
  mapping_method: string | null;
  metadata_json: Record<string, unknown> | null;
};

const DATA_VERSION = "h9.8-special-teams-defense";
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

function sourcePath(season: number) {
  return path.join(process.cwd(), "data", "raw", "nflverse", "player_stats", String(season), `stats_player_week_${season}.csv`);
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function normalizeSourceRows(rawRows: Record<string, string>[]) {
  const rows: H98NormalizedPlayerRow[] = [];
  for (const raw of rawRows) {
    const result = normalizeH98PlayerRow(raw);
    if (result.ok && (result.row.category === "idp" || result.row.category === "kicker")) rows.push(result.row);
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
    for (const row of data ?? []) map.set(row.external_id as string, row.player_id as string);
  }
  return map;
}

async function loadH99Mappings(client: SupabaseClient<any>, season: number) {
  return loadAllPagesWith<H99MappingRow>(
    (from, to) => client
      .from("player_external_ids")
      .select("player_id,external_id,team,position_group,confidence,mapping_method,metadata_json")
      .eq("provider", "gsis")
      .eq("external_type", "gsis")
      .eq("season", season)
      .eq("mapping_method", "h9.9_exact_name_team_position")
      .range(from, to),
    { table: "player_external_ids" }
  );
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
    const existing = candidatesByName.get(normalizedName) ?? [];
    existing.push(candidate);
    candidatesByName.set(normalizedName, existing);
  }
  return { rows, candidatesByName };
}

function aggregateByGsis(rows: H98NormalizedPlayerRow[], existingMap: Map<string, string>) {
  const unresolved = rows.filter((row) => !existingMap.has(row.gsisId));
  const groups = new Map<string, H98NormalizedPlayerRow[]>();
  for (const row of unresolved) {
    const existing = groups.get(row.gsisId) ?? [];
    existing.push(row);
    groups.set(row.gsisId, existing);
  }
  return [...groups.values()].map(makeUnresolvedAggregate).sort((a, b) => b.totalOpportunityOrPointsProxy - a.totalOpportunityOrPointsProxy);
}

function buildDiagnostics(
  aggregates: H99UnresolvedAggregate[],
  candidatesByName: Map<string, H99CandidatePlayer[]>,
  existingMap: Map<string, string>,
  adpNames: Set<string>
) {
  return aggregates.map((aggregate) => {
    const decision = matchIdentityCandidate(aggregate, candidatesByName, existingMap.get(aggregate.sourcePlayerId));
    const adpRelevant = adpNames.has(aggregate.normalizedName);
    return {
      source_player_id: aggregate.sourcePlayerId,
      player_name: aggregate.playerName,
      position: aggregate.position,
      position_group: aggregate.positionGroup,
      team: aggregate.teams.join(","),
      weeks: aggregate.weeks,
      season: 2025,
      stat_summary: aggregate.statSummary,
      total_opportunity_or_points_proxy: Number(aggregate.totalOpportunityOrPointsProxy.toFixed(2)),
      reason_unresolved: decision.reasonUnresolved,
      candidate_matches: decision.candidateMatches,
      candidate_confidence: decision.confidence,
      recommended_action: adpRelevant && decision.status !== "auto_safe"
        ? `${decision.recommendedAction} ADP overlap raises priority.`
        : decision.recommendedAction,
      match_status: decision.status,
      match_method: decision.method,
      high_priority: aggregate.highPriority || adpRelevant,
      adp_relevance: adpRelevant,
      league_roster_relevance: aggregate.category === "kicker" ? "required_in_2_owned_leagues" : "required_in_2_owned_leagues",
    };
  });
}

async function loadPersistedWeeklyRows(client: SupabaseClient<any>, season: number) {
  return loadAllPagesWith<WeeklyRow>(
    (from, to) => client
      .from("player_weekly_stats")
      .select("player_id,provider_external_id,week,position_group,team,stats_json")
      .eq("provider", "nflverse")
      .eq("season", season)
      .eq("season_type", "regular")
      .eq("data_version", DATA_VERSION)
      .in("position_group", ["DL", "LB", "DB", "K"])
      .range(from, to),
    { table: "player_weekly_stats" }
  );
}

function rowsByPlayer(rows: WeeklyRow[], category: "idp" | "kicker") {
  const map = new Map<string, H98NormalizedPlayerRow[]>();
  for (const row of rows) {
    const isK = row.position_group === "K";
    if ((category === "kicker") !== isK) continue;
    const converted: H98NormalizedPlayerRow = {
      category,
      gsisId: row.provider_external_id ?? row.player_id,
      playerDisplayName: row.player_id,
      rawPosition: row.position_group ?? "",
      rawPositionGroup: row.position_group ?? "",
      positionGroup: (row.position_group as H98NormalizedPlayerRow["positionGroup"]) ?? "LB",
      team: row.team,
      opponent: null,
      season: 2025,
      week: row.week,
      seasonType: "regular",
      stats: row.stats_json,
      sourceFields: Object.keys(row.stats_json),
      allZeroStats: Object.values(row.stats_json).every((value) => Number(value) === 0),
    };
    const existing = map.get(row.player_id) ?? [];
    existing.push(converted);
    map.set(row.player_id, existing);
  }
  return map;
}

function summarizeResolved(rows: WeeklyRow[], category: "idp" | "kicker", adpPlayerIds: Set<string>) {
  const scoped = rows.filter((row) => category === "kicker" ? row.position_group === "K" : row.position_group !== "K");
  const grouped = rowsByPlayer(scoped, category);
  const weekMetrics = activeWeekMetrics(grouped);
  const fieldSet = new Set<string>();
  for (const row of scoped) for (const key of Object.keys(row.stats_json)) fieldSet.add(key);
  return {
    rows: scoped.length,
    distinctPlayers: grouped.size,
    weeksPerPlayerDistribution: countBy([...grouped.values()].map((playerRows) => String(new Set(playerRows.map((row) => row.week)).size))),
    positionDistribution: countBy(scoped.map((row) => row.position_group ?? "UNKNOWN")),
    teamsCovered: [...new Set(scoped.map((row) => row.team).filter((team): team is string => Boolean(team)))].sort(),
    statCoverage: [...fieldSet].sort(),
    playersWith8PlusActiveWeeks: weekMetrics.playersWithEightWeeks,
    playersWith12PlusActiveWeeks: weekMetrics.playersWithTwelveWeeks,
    playersWithMeaningfulRoleWeeks: weekMetrics.playersWithMeaningfulRoleWeeks,
    playersWithAdpRecords: [...grouped.keys()].filter((playerId) => adpPlayerIds.has(playerId)).length,
    playersLikelyRosterRelevant: category === "kicker"
      ? weekMetrics.playersWithEightWeeks
      : weekMetrics.playersWithMeaningfulRoleWeeks,
  };
}

async function loadAdp(client: SupabaseClient<any>, projectionSeason: number) {
  const snapshots = await loadAllPagesWith<AdpSnapshotRow>(
    (from, to) => client.from("adp_snapshots").select("id,provider").eq("season", projectionSeason).range(from, to),
    { table: "adp_snapshots" }
  );
  const records = snapshots.length === 0 ? [] : await loadAllPagesWith<AdpRecordRow>(
    (from, to) => client
      .from("adp_player_records")
      .select("snapshot_id,canonical_player_id,raw_name,raw_position")
      .in("snapshot_id", snapshots.map((snapshot) => snapshot.id))
      .range(from, to),
    { table: "adp_player_records" }
  );
  return {
    snapshots,
    records,
    playerIds: new Set(records.map((record) => record.canonical_player_id).filter((id): id is string => Boolean(id))),
    normalizedNames: new Set(records.map((record) => normalizePlayerName(record.raw_name)).filter(Boolean)),
  };
}

async function loadDstRows(client: SupabaseClient<any>, season: number) {
  return loadAllPagesWith<TeamGameRow>(
    (from, to) => client
      .from("team_game_stats")
      .select("points_allowed,yards_allowed")
      .eq("season", season)
      .eq("season_type", "REG")
      .range(from, to),
    { table: "team_game_stats" }
  );
}

async function writeMappings(client: SupabaseClient<any>, diagnostics: ReturnType<typeof buildDiagnostics>, season: number) {
  const autoSafe = diagnostics.filter((row) => row.match_status === "auto_safe" && row.candidate_matches.length === 1);
  let written = 0;
  for (let i = 0; i < autoSafe.length; i += BATCH_SIZE) {
    const chunk = autoSafe.slice(i, i + BATCH_SIZE);
    const rows = chunk.map((row) => ({
      player_id: row.candidate_matches[0].playerId,
      provider: "gsis",
      external_id: row.source_player_id,
      external_type: "gsis",
      season,
      team: row.team.split(",")[0] || null,
      position_group: row.position_group,
      mapping_status: "auto_matched",
      mapping_method: "h9.9_exact_name_team_position",
      confidence: row.candidate_confidence,
      verified_at: new Date().toISOString(),
      metadata_json: {
        source: "h9.9_idp_k_identity_repair",
        source_name: row.player_name,
        reason: row.reason_unresolved,
        created_by: "H9.9",
      },
    }));
    const { error } = await client.from("player_external_ids").upsert(rows, {
      onConflict: "provider,external_id,external_type",
      ignoreDuplicates: true,
    });
    if (error) throw new Error(`Failed to write H9.9 GSIS mappings: ${error.message}`);
    written += rows.length;
  }
  return { attempted: autoSafe.length, written };
}

async function main() {
  const historicalSeason = Number(argValue("--historical-season", "2025"));
  const projectionSeason = Number(argValue("--projection-season", String(historicalSeason + 1)));
  const execute = hasArg("--execute");
  const client = supabase();
  const csvPath = sourcePath(historicalSeason);
  const rawCsv = readFileSync(csvPath, "utf8");
  const parsed = Papa.parse<Record<string, string>>(rawCsv, { header: true, skipEmptyLines: true });
  const sourceRows = normalizeSourceRows(parsed.data);
  const existingBefore = await loadExistingGsisMappings(client, sourceRows.map((row) => row.gsisId));
  const unresolvedAggregates = aggregateByGsis(sourceRows, existingBefore);
  const { candidatesByName } = await loadPlayers(client);
  const adp = await loadAdp(client, projectionSeason);
  const diagnostics = buildDiagnostics(unresolvedAggregates, candidatesByName, existingBefore, adp.normalizedNames);
  const autoSafe = diagnostics.filter((row) => row.match_status === "auto_safe");
  const manualReview = diagnostics.filter((row) => row.match_status === "manual_review");
  const ambiguous = diagnostics.filter((row) => row.match_status === "ambiguous");
  const stillUnresolved = diagnostics.filter((row) => row.match_status === "unresolved");
  const highPriority = diagnostics.filter((row) => row.high_priority);

  const mappingWrite = execute ? await writeMappings(client, diagnostics, historicalSeason) : { attempted: autoSafe.length, written: 0 };
  const existingAfter = execute ? await loadExistingGsisMappings(client, sourceRows.map((row) => row.gsisId)) : existingBefore;
  const h99Mappings = await loadH99Mappings(client, historicalSeason);
  const h99MappingIds = new Set(h99Mappings.map((row) => row.external_id));
  const persistedRows = await loadPersistedWeeklyRows(client, historicalSeason);
  const dstRows = await loadDstRows(client, historicalSeason);

  const beforeCounts = {
    idpResolvedRows: sourceRows.filter((row) => row.category === "idp" && existingBefore.has(row.gsisId)).length,
    idpUnresolvedRows: sourceRows.filter((row) => row.category === "idp" && !existingBefore.has(row.gsisId)).length,
    kickerResolvedRows: sourceRows.filter((row) => row.category === "kicker" && existingBefore.has(row.gsisId)).length,
    kickerUnresolvedRows: sourceRows.filter((row) => row.category === "kicker" && !existingBefore.has(row.gsisId)).length,
  };
  const afterIdentityCounts = {
    idpResolvedRows: sourceRows.filter((row) => row.category === "idp" && existingAfter.has(row.gsisId)).length,
    idpUnresolvedRows: sourceRows.filter((row) => row.category === "idp" && !existingAfter.has(row.gsisId)).length,
    kickerResolvedRows: sourceRows.filter((row) => row.category === "kicker" && existingAfter.has(row.gsisId)).length,
    kickerUnresolvedRows: sourceRows.filter((row) => row.category === "kicker" && !existingAfter.has(row.gsisId)).length,
  };
  const h99RepairImpact = {
    mappingRows: h99Mappings.length,
    idpRowsUnlocked: sourceRows.filter((row) => row.category === "idp" && h99MappingIds.has(row.gsisId)).length,
    kickerRowsUnlocked: sourceRows.filter((row) => row.category === "kicker" && h99MappingIds.has(row.gsisId)).length,
    reconstructedBeforeH99Counts: {
      idpResolvedRows: afterIdentityCounts.idpResolvedRows - sourceRows.filter((row) => row.category === "idp" && h99MappingIds.has(row.gsisId)).length,
      idpUnresolvedRows: afterIdentityCounts.idpUnresolvedRows + sourceRows.filter((row) => row.category === "idp" && h99MappingIds.has(row.gsisId)).length,
      kickerResolvedRows: afterIdentityCounts.kickerResolvedRows - sourceRows.filter((row) => row.category === "kicker" && h99MappingIds.has(row.gsisId)).length,
      kickerUnresolvedRows: afterIdentityCounts.kickerUnresolvedRows + sourceRows.filter((row) => row.category === "kicker" && h99MappingIds.has(row.gsisId)).length,
    },
    mappings: h99Mappings.map((row) => ({
      sourcePlayerId: row.external_id,
      canonicalPlayerId: row.player_id,
      team: row.team,
      positionGroup: row.position_group,
      confidence: row.confidence,
      method: row.mapping_method,
      sourceName: row.metadata_json?.source_name ?? null,
    })),
  };

  const idpResolved = summarizeResolved(persistedRows, "idp", adp.playerIds);
  const kickerResolved = summarizeResolved(persistedRows, "kicker", adp.playerIds);
  const idpHighPriorityRemaining = highPriority.filter((row) => row.position_group !== "K" && row.match_status !== "auto_safe");
  const kickerHighPriorityRemaining = highPriority.filter((row) => row.position_group === "K" && row.match_status !== "auto_safe");
  const dstReadiness = classifyDstReadiness({
    rows: dstRows.length,
    pointsAllowedCoverage: dstRows.filter((row) => row.points_allowed !== null).length,
    yardsAllowedCoverage: dstRows.filter((row) => row.yards_allowed !== null).length,
    missingBigPlayComponents: 9,
  });

  const readiness = {
    idp: classifyProjectionReadiness({
      category: "idp",
      resolvedRows: afterIdentityCounts.idpResolvedRows,
      totalRows: sourceRows.filter((row) => row.category === "idp").length,
      highPriorityUnresolvedPlayers: idpHighPriorityRemaining.length,
      playersWithEightWeeks: idpResolved.playersWith8PlusActiveWeeks,
      playersWithTwelveWeeks: idpResolved.playersWith12PlusActiveWeeks,
    }),
    kicker: classifyProjectionReadiness({
      category: "kicker",
      resolvedRows: afterIdentityCounts.kickerResolvedRows,
      totalRows: sourceRows.filter((row) => row.category === "kicker").length,
      highPriorityUnresolvedPlayers: kickerHighPriorityRemaining.length,
      playersWithEightWeeks: kickerResolved.playersWith8PlusActiveWeeks,
      playersWithTwelveWeeks: kickerResolved.playersWith12PlusActiveWeeks,
    }),
    dst: dstReadiness,
    idpByPosition: {
      DL: classifyProjectionReadiness({ category: "idp", resolvedRows: persistedRows.filter((row) => row.position_group === "DL").length, totalRows: sourceRows.filter((row) => row.positionGroup === "DL").length, highPriorityUnresolvedPlayers: idpHighPriorityRemaining.filter((row) => row.position_group === "DL").length, playersWithEightWeeks: idpResolved.playersWith8PlusActiveWeeks, playersWithTwelveWeeks: idpResolved.playersWith12PlusActiveWeeks }),
      LB: classifyProjectionReadiness({ category: "idp", resolvedRows: persistedRows.filter((row) => row.position_group === "LB").length, totalRows: sourceRows.filter((row) => row.positionGroup === "LB").length, highPriorityUnresolvedPlayers: idpHighPriorityRemaining.filter((row) => row.position_group === "LB").length, playersWithEightWeeks: idpResolved.playersWith8PlusActiveWeeks, playersWithTwelveWeeks: idpResolved.playersWith12PlusActiveWeeks }),
      DB: classifyProjectionReadiness({ category: "idp", resolvedRows: persistedRows.filter((row) => row.position_group === "DB").length, totalRows: sourceRows.filter((row) => row.positionGroup === "DB").length, highPriorityUnresolvedPlayers: idpHighPriorityRemaining.filter((row) => row.position_group === "DB").length, playersWithEightWeeks: idpResolved.playersWith8PlusActiveWeeks, playersWithTwelveWeeks: idpResolved.playersWith12PlusActiveWeeks }),
    },
    kickerByPosition: {
      K: classifyProjectionReadiness({ category: "kicker", resolvedRows: afterIdentityCounts.kickerResolvedRows, totalRows: sourceRows.filter((row) => row.category === "kicker").length, highPriorityUnresolvedPlayers: kickerHighPriorityRemaining.length, playersWithEightWeeks: kickerResolved.playersWith8PlusActiveWeeks, playersWithTwelveWeeks: kickerResolved.playersWith12PlusActiveWeeks }),
      PK: classifyProjectionReadiness({ category: "kicker", resolvedRows: afterIdentityCounts.kickerResolvedRows, totalRows: sourceRows.filter((row) => row.category === "kicker").length, highPriorityUnresolvedPlayers: kickerHighPriorityRemaining.length, playersWithEightWeeks: kickerResolved.playersWith8PlusActiveWeeks, playersWithTwelveWeeks: kickerResolved.playersWith12PlusActiveWeeks }),
    },
  };

  const unresolvedStatVolume = {
    idpPercent: Number((sum(sourceRows.filter((row) => row.category === "idp" && !existingAfter.has(row.gsisId)).map((row) => sum(Object.values(row.stats)))) / Math.max(1, sum(sourceRows.filter((row) => row.category === "idp").map((row) => sum(Object.values(row.stats))))) * 100).toFixed(2)),
    kickerPercent: Number((sum(sourceRows.filter((row) => row.category === "kicker" && !existingAfter.has(row.gsisId)).map((row) => sum(Object.values(row.stats)))) / Math.max(1, sum(sourceRows.filter((row) => row.category === "kicker").map((row) => sum(Object.values(row.stats))))) * 100).toFixed(2)),
  };

  const identityArtifact = {
    auditId: `h9.9-idp-k-identity-${new Date().toISOString()}`,
    historicalSeason,
    projectionSeason,
    mode: execute ? "execute" : "dry-run",
    rootCauses: {
      primary: "Missing GSIS rows in player_external_ids for IDP/K players.",
      categories: countBy(diagnostics.map((row) => row.reason_unresolved ?? "existing")),
      notes: [
        "Existing generic GSIS bootstrap found zero stats_id/ESPN bridge-safe writes.",
        "H9.9 only treats exact normalized name + compatible position + team as auto-safe.",
        "Exact name matches without team agreement remain manual review.",
      ],
    },
    beforeCounts,
    afterIdentityCounts,
    h99RepairImpact,
    mappingWrite,
    matchSummary: {
      autoSafePlayers: autoSafe.length,
      manualReviewPlayers: manualReview.length,
      ambiguousPlayers: ambiguous.length,
      unresolvedPlayers: stillUnresolved.length,
      highPriorityPlayers: highPriority.length,
      remainingHighPriorityPlayers: highPriority.filter((row) => row.match_status !== "auto_safe").length,
    },
    autoSafeMappings: autoSafe,
    manualReviewCandidates: manualReview.slice(0, 250),
    ambiguousCandidates: ambiguous.slice(0, 250),
    unresolvedCandidates: stillUnresolved.slice(0, 250),
    highPriorityUnresolvedPlayers: highPriority.filter((row) => row.match_status !== "auto_safe").slice(0, 250),
  };

  const readinessArtifact = {
    auditId: identityArtifact.auditId,
    historicalSeason,
    projectionSeason,
    beforeCounts,
    afterIdentityCounts,
    h99RepairImpact: {
      mappingRows: h99RepairImpact.mappingRows,
      idpRowsUnlocked: h99RepairImpact.idpRowsUnlocked,
      kickerRowsUnlocked: h99RepairImpact.kickerRowsUnlocked,
      reconstructedBeforeH99Counts: h99RepairImpact.reconstructedBeforeH99Counts,
    },
    resolvedMetrics: {
      idp: idpResolved,
      kicker: kickerResolved,
    },
    unresolvedMetrics: {
      remainingUnresolvedPlayers: diagnostics.filter((row) => row.match_status !== "auto_safe").length,
      remainingHighPriorityUnresolvedPlayers: highPriority.filter((row) => row.match_status !== "auto_safe").length,
      unresolvedStatVolumePercentage: unresolvedStatVolume,
      unresolvedAdpOverlap: diagnostics.filter((row) => row.adp_relevance && row.match_status !== "auto_safe").length,
    },
    readiness,
    h9_10Recommendation: "Repair remaining high-priority IDP/K manual-review identities before projection modeling; DST can proceed only with allowance-only low-confidence design unless big-play components are derived.",
  };

  const outDir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(outDir, { recursive: true });
  const identityPath = path.join(outDir, `h9-idp-k-identity-audit-${historicalSeason}.json`);
  const readinessPath = path.join(outDir, `h9-idp-k-projection-readiness-${historicalSeason}.json`);
  writeFileSync(identityPath, `${JSON.stringify(identityArtifact, null, 2)}\n`);
  writeFileSync(readinessPath, `${JSON.stringify(readinessArtifact, null, 2)}\n`);

  console.log(JSON.stringify({
    identityArtifact: identityPath,
    readinessArtifact: readinessPath,
    mode: identityArtifact.mode,
    beforeCounts,
    afterIdentityCounts,
    mappingWrite,
    matchSummary: identityArtifact.matchSummary,
    readiness,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
