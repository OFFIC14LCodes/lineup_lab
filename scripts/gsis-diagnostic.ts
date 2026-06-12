#!/usr/bin/env tsx
/**
 * GSIS Identity Coverage Diagnostic — Phase H1.5 investigation
 *
 * Usage: npm run diagnostic:gsis
 *
 * Reports:
 *  A = unique GSIS IDs in 2025 weekly stats (QB/RB/WR/TE, REG)
 *  B = external_id values in player_external_ids (provider=gsis, external_type=gsis)
 *  C = what H1 resolveGsisIdsBatch would return
 *  Set intersections A∩B, A-B, B-A
 *  Mapping-field inspection for all B rows
 *  ESPN bridge overlap analysis
 *  Supabase project hostname (no secrets)
 *  Unresolved-2025 report (written to data/diagnostic/)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";

loadLocalEnv();

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!url || !serviceRoleKey) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.");
  process.exit(1);
}

const projectHost = new URL(url).hostname;
console.info(`\nSupabase project: ${projectHost}\n`);

const adminClient = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const WEEKLY_STATS_PATH = path.join(process.cwd(), "data", "raw", "nflverse", "player_stats", "2025", "stats_player_week_2025.csv");
const PLAYERS_CSV_PATH = path.join(process.cwd(), "data", "raw", "nflverse", "players", "players.csv");
const DIAGNOSTIC_DIR = path.join(process.cwd(), "data", "diagnostic");
const SUPPORTED_POS = new Set(["QB", "RB", "WR", "TE"]);

type WeeklyStatRow = {
  player_id: string;
  player_display_name: string;
  position_group: string;
  team: string;
  season_type: string;
  week: string;
};

type PlayersRow = {
  gsis_id: string;
  display_name: string;
  espn_id: string;
  position_group: string;
  position: string;
  latest_team: string;
  status: string;
};

type DbGsisRow = {
  external_id: string;
  player_id: string;
  provider: string;
  external_type: string;
  season: number | null;
  team: string | null;
  position_group: string | null;
  mapping_status: string;
  mapping_method: string | null;
  confidence: number | null;
  verified_at: string | null;
};

async function main() {
  // === A: Weekly stats GSIS IDs (QB/RB/WR/TE, REG) ===
  console.info("Loading 2025 weekly stats CSV...");
  const weeklyRaw = Papa.parse<Record<string, string>>(
    readFileSync(WEEKLY_STATS_PATH, "utf8"),
    { header: true, skipEmptyLines: true }
  );

  // Collect all unique GSIS IDs AND row-level details for unresolved report
  const setA = new Set<string>(); // unique GSIS IDs in scope
  const weeklyByGsis = new Map<string, { name: string; pos: string; team: string; rowCount: number }>();
  let totalWeeklyRows = 0;
  let filteredWeeklyRows = 0;

  for (const row of weeklyRaw.data) {
    totalWeeklyRows++;
    const pos = row["position_group"]?.trim().toUpperCase();
    const seasonType = row["season_type"]?.trim().toUpperCase();
    if (!SUPPORTED_POS.has(pos) || seasonType !== "REG") continue;
    filteredWeeklyRows++;
    const gsisId = row["player_id"]?.trim();
    if (!gsisId) continue;
    setA.add(gsisId);
    const existing = weeklyByGsis.get(gsisId);
    if (existing) {
      existing.rowCount++;
    } else {
      weeklyByGsis.set(gsisId, {
        name: row["player_display_name"]?.trim() ?? "",
        pos,
        team: row["team"]?.trim() ?? "",
        rowCount: 1
      });
    }
  }

  console.info(`A: ${setA.size} unique QB/RB/WR/TE REG GSIS IDs in 2025 weekly stats (from ${filteredWeeklyRows} rows / ${totalWeeklyRows} total)`);

  // === Load players.csv for ESPN ID cross-reference ===
  console.info("Loading players.csv...");
  const playersRaw = Papa.parse<Record<string, string>>(
    readFileSync(PLAYERS_CSV_PATH, "utf8"),
    { header: true, skipEmptyLines: true }
  );

  // Map: espnId → { gsisId, displayName, positionGroup, latestTeam, status }
  const nflverseByEspnId = new Map<string, PlayersRow>();
  const nflverseByGsisId = new Map<string, PlayersRow>();
  let playersWithEspnId = 0;
  let playersWithBothIds = 0;

  for (const row of playersRaw.data) {
    const gsisId = row["gsis_id"]?.trim();
    if (!gsisId) continue;
    const espnId = row["espn_id"]?.trim();
    const pr: PlayersRow = {
      gsis_id: gsisId,
      display_name: row["display_name"]?.trim() ?? "",
      espn_id: espnId ?? "",
      position_group: row["position_group"]?.trim().toUpperCase() ?? "",
      position: row["position"]?.trim().toUpperCase() ?? "",
      latest_team: row["latest_team"]?.trim() ?? "",
      status: row["status"]?.trim() ?? ""
    };
    nflverseByGsisId.set(gsisId, pr);
    if (espnId && espnId !== "NA" && espnId !== "0") {
      playersWithEspnId++;
      if (!nflverseByEspnId.has(espnId)) {
        nflverseByEspnId.set(espnId, pr);
        if (gsisId) playersWithBothIds++;
      } else {
        // Duplicate ESPN ID in players.csv — log it
        const existing = nflverseByEspnId.get(espnId)!;
        if (existing.gsis_id !== gsisId) {
          console.warn(`  DUPLICATE ESPN ID in players.csv: espn_id=${espnId} → gsis_id1=${existing.gsis_id} (${existing.display_name}), gsis_id2=${gsisId} (${pr.display_name})`);
        }
      }
    }
  }
  console.info(`  players.csv: ${nflverseByGsisId.size} rows with gsis_id; ${playersWithEspnId} with espn_id`);

  // === B: DB rows in player_external_ids (provider=gsis, external_type=gsis) ===
  console.info("Querying player_external_ids...");
  const { data: dbRows, error: dbError } = await adminClient
    .from("player_external_ids")
    .select("external_id, player_id, provider, external_type, season, team, position_group, mapping_status, mapping_method, confidence, verified_at")
    .eq("provider", "gsis")
    .eq("external_type", "gsis");

  if (dbError) {
    console.error("DB query failed:", dbError.message);
    process.exit(1);
  }

  const rows = (dbRows ?? []) as DbGsisRow[];
  const setB = new Set<string>(rows.map(r => r.external_id));
  console.info(`B: ${setB.size} external_id values in player_external_ids (provider=gsis, external_type=gsis)`);

  // === B field inspection ===
  const mappingMethodCounts: Record<string, number> = {};
  const mappingStatusCounts: Record<string, number> = {};
  const seasonCounts: Record<string, number> = {};
  let confidenceNull = 0;
  let verifiedAtNull = 0;
  let seasonNull = 0;
  let externalIdHasLeadingWhitespace = 0;
  let externalIdHasTrailingWhitespace = 0;

  for (const r of rows) {
    mappingMethodCounts[r.mapping_method ?? "null"] = (mappingMethodCounts[r.mapping_method ?? "null"] ?? 0) + 1;
    mappingStatusCounts[r.mapping_status] = (mappingStatusCounts[r.mapping_status] ?? 0) + 1;
    const seasonKey = r.season === null ? "null" : String(r.season);
    seasonCounts[seasonKey] = (seasonCounts[seasonKey] ?? 0) + 1;
    if (r.confidence === null) confidenceNull++;
    if (r.verified_at === null) verifiedAtNull++;
    if (r.season === null) seasonNull++;
    if (r.external_id !== r.external_id.trim()) {
      if (r.external_id.startsWith(" ") || r.external_id.startsWith("\t")) externalIdHasLeadingWhitespace++;
      if (r.external_id.endsWith(" ") || r.external_id.endsWith("\t")) externalIdHasTrailingWhitespace++;
    }
  }

  console.info("\n  B field summary:");
  console.info(`    mapping_method: ${JSON.stringify(mappingMethodCounts)}`);
  console.info(`    mapping_status: ${JSON.stringify(mappingStatusCounts)}`);
  console.info(`    season (null=${seasonNull}): ${JSON.stringify(seasonCounts)}`);
  console.info(`    confidence null: ${confidenceNull}, verified_at null: ${verifiedAtNull}`);
  console.info(`    external_id whitespace issues: leading=${externalIdHasLeadingWhitespace}, trailing=${externalIdHasTrailingWhitespace}`);

  // Sample 5 B rows
  console.info("\n  Sample B rows (first 5):");
  for (const r of rows.slice(0, 5)) {
    console.info(`    external_id="${r.external_id}" mapping_method="${r.mapping_method}" status="${r.mapping_status}" season=${r.season}`);
  }

  // === C: What resolveGsisIdsBatch would return for setA ===
  const BATCH_SIZE = 500;
  const setAArr = [...setA];
  const setC = new Set<string>();

  for (let i = 0; i < setAArr.length; i += BATCH_SIZE) {
    const chunk = setAArr.slice(i, i + BATCH_SIZE);
    const { data: resolved, error: resolveError } = await adminClient
      .from("player_external_ids")
      .select("player_id, external_id")
      .eq("provider", "gsis")
      .eq("external_type", "gsis")
      .in("external_id", chunk);
    if (resolveError) throw new Error(`resolveGsisIdsBatch failed: ${resolveError.message}`);
    for (const r of resolved ?? []) {
      setC.add(r.external_id as string);
    }
  }
  console.info(`\nC: ${setC.size} GSIS IDs resolved by H1 lookup logic (A→B exact match)`);

  // === Intersections ===
  const aIntersectB = [...setA].filter(id => setB.has(id));
  const aIntersectC = [...setA].filter(id => setC.has(id));
  const aMinusB = [...setA].filter(id => !setB.has(id));
  const bMinusA = [...setB].filter(id => !setA.has(id));
  const bMinusAWeeklyNflverse = bMinusA.filter(id => nflverseByGsisId.has(id));

  console.info("\n=== SET INTERSECTION ===");
  console.info(`|A| = ${setA.size}`);
  console.info(`|B| = ${setB.size}`);
  console.info(`|C| = ${setC.size}`);
  console.info(`|A ∩ B| = ${aIntersectB.length}`);
  console.info(`|A ∩ C| = ${aIntersectC.length}`);
  console.info(`|A - B| (weekly not in mappings) = ${aMinusB.length}`);
  console.info(`|B - A| (mappings not in 2025 weekly) = ${bMinusA.length}`);
  console.info(`A∩B == A∩C: ${aIntersectB.length === aIntersectC.length && aIntersectB.every(id => setC.has(id))}`);

  if (aIntersectB.length > 0 && aIntersectB.length <= 20) {
    console.info(`\nA ∩ B (all):`);
    for (const id of aIntersectB) {
      const weekly = weeklyByGsis.get(id)!;
      const dbRow = rows.find(r => r.external_id === id);
      const pl = nflverseByGsisId.get(id);
      console.info(`  ${id}  ${weekly.name.padEnd(28)} [${weekly.pos}/${weekly.team}]  db_method=${dbRow?.mapping_method ?? "?"}  nflverse_espnId=${pl?.espn_id ?? "?"}`);
    }
  }

  // === ESPN bridge analysis ===
  console.info("\n=== ESPN BRIDGE ANALYSIS ===");

  // Of the 931 B rows, how many have GSIS IDs in setA (2025 weekly)?
  const bInWeekly = rows.filter(r => setA.has(r.external_id));
  const bInNflversePlayers = rows.filter(r => nflverseByGsisId.has(r.external_id));
  const bNotInWeekly = rows.filter(r => !setA.has(r.external_id));

  console.info(`  B rows whose GSIS ID appears in 2025 weekly stats: ${bInWeekly.length}`);
  console.info(`  B rows in nflverse players.csv: ${bInNflversePlayers.length}`);
  console.info(`  B rows NOT in 2025 weekly stats: ${bNotInWeekly.length}`);

  // Of A (616 2025 players), how many are in players.csv?
  const aInNflverse = [...setA].filter(id => nflverseByGsisId.has(id));
  const aNotInNflverse = [...setA].filter(id => !nflverseByGsisId.has(id));
  console.info(`\n  2025 weekly GSIS IDs in players.csv: ${aInNflverse.length}`);
  console.info(`  2025 weekly GSIS IDs NOT in players.csv: ${aNotInNflverse.length}`);

  // Of 2025 players in nflverse, how many have espn_id that could bridge?
  const aWithEspnId = aInNflverse.filter(id => {
    const pl = nflverseByGsisId.get(id);
    return pl && pl.espn_id && pl.espn_id !== "NA" && pl.espn_id !== "0";
  });
  console.info(`  2025 players in nflverse WITH espn_id: ${aWithEspnId.length}`);

  // === Position breakdown of B rows that overlap with 2025 weekly ===
  if (bInWeekly.length > 0) {
    const posBreakdown: Record<string, number> = {};
    for (const r of bInWeekly) {
      const pl = nflverseByGsisId.get(r.external_id);
      const pos = pl?.position_group ?? weeklyByGsis.get(r.external_id)?.pos ?? "?";
      posBreakdown[pos] = (posBreakdown[pos] ?? 0) + 1;
    }
    console.info(`  B∩A position breakdown: ${JSON.stringify(posBreakdown)}`);
  }

  // Position breakdown of ALL B rows (to see what positions are stored)
  const bPositionBreakdown: Record<string, number> = {};
  for (const r of rows) {
    const pl = nflverseByGsisId.get(r.external_id);
    const pos = r.position_group ?? pl?.position_group ?? "unknown";
    bPositionBreakdown[pos] = (bPositionBreakdown[pos] ?? 0) + 1;
  }
  console.info(`  Position breakdown of ALL ${setB.size} B rows: ${JSON.stringify(bPositionBreakdown)}`);

  // === GSIS ID format analysis ===
  console.info("\n=== GSIS ID FORMAT ANALYSIS ===");
  const standardFormatA = [...setA].filter(id => /^00-\d{7}$/.test(id)).length;
  const nonStandardA = setA.size - standardFormatA;
  const standardFormatB = [...setB].filter(id => /^00-\d{7}$/.test(id)).length;
  const nonStandardB = setB.size - standardFormatB;
  console.info(`  A: ${standardFormatA} standard (00-XXXXXXX), ${nonStandardA} non-standard`);
  console.info(`  B: ${standardFormatB} standard (00-XXXXXXX), ${nonStandardB} non-standard`);
  if (nonStandardB > 0) {
    const nonStdSamples = [...setB].filter(id => !/^00-\d{7}$/.test(id)).slice(0, 5);
    console.info(`  B non-standard samples: ${nonStdSamples.join(", ")}`);
  }

  // === Canonical player ESPN ID analysis ===
  console.info("\n=== CANONICAL PLAYER ESPN ID ANALYSIS ===");
  const { data: canonicalPlayers, error: cpError } = await adminClient
    .from("players")
    .select("id, metadata_json, normalized_name, position_group, sleeper_player_id");
  if (cpError) throw new Error(`Failed to load players: ${cpError.message}`);

  let hasEspnId = 0;
  let hasStatsId = 0;
  let hasSleeperPlayerId = 0;
  const canonicalEspnIdMap = new Map<string, string>(); // espn_id → player_id

  for (const p of canonicalPlayers ?? []) {
    const meta = p.metadata_json as Record<string, unknown> | null;
    if ((p as any).sleeper_player_id) hasSleeperPlayerId++;
    if (meta) {
      const espnId = meta["espn_id"];
      if (espnId !== null && espnId !== undefined) {
        const s = String(espnId).trim();
        if (s && s !== "null" && s !== "undefined" && s !== "0") {
          hasEspnId++;
          canonicalEspnIdMap.set(s, p.id as string);
        }
      }
      if (typeof meta["stats_id"] === "string" && (meta["stats_id"] as string).trim()) {
        hasStatsId++;
      }
    }
  }

  console.info(`  Total canonical players: ${(canonicalPlayers ?? []).length}`);
  console.info(`  With sleeper_player_id: ${hasSleeperPlayerId}`);
  console.info(`  With metadata_json.espn_id: ${hasEspnId}`);
  console.info(`  With metadata_json.stats_id: ${hasStatsId}`);

  // Of the 2025 weekly players, how many have their espn_id in canonical players?
  let weeklyMatchableViaEspn = 0;
  let weeklyEspnMismatch = 0;
  for (const gsisId of setA) {
    const pl = nflverseByGsisId.get(gsisId);
    if (!pl || !pl.espn_id || pl.espn_id === "NA") continue;
    if (canonicalEspnIdMap.has(pl.espn_id)) {
      weeklyMatchableViaEspn++;
    } else {
      weeklyEspnMismatch++;
    }
  }
  console.info(`\n  Of ${setA.size} 2025 weekly GSIS players:`);
  console.info(`    ${aInNflverse.length} appear in players.csv`);
  console.info(`    ${weeklyMatchableViaEspn} have an espn_id matchable to a canonical player`);
  console.info(`    ${weeklyEspnMismatch} have espn_id in players.csv but NOT in canonical players`);
  console.info(`    ${aNotInNflverse.length} not in players.csv at all`);

  // === UNRESOLVED 2025 REPORT ===
  console.info("\n=== GENERATING UNRESOLVED-2025 REPORT ===");

  const unresolvedReport = [...setA]
    .filter(id => !setB.has(id))
    .map(id => {
      const weekly = weeklyByGsis.get(id)!;
      const pl = nflverseByGsisId.get(id);
      const espnId = pl?.espn_id ?? "";
      const espnInCanonical = espnId && canonicalEspnIdMap.has(espnId);
      const inB = setB.has(id);
      let unresolvedReason = "";
      if (!pl) unresolvedReason = "not_in_players_csv";
      else if (!espnId || espnId === "NA") unresolvedReason = "no_espn_id_in_players_csv";
      else if (!espnInCanonical) unresolvedReason = "espn_id_not_in_canonical_players";
      else unresolvedReason = "espn_in_canonical_but_no_gsis_mapping";
      return {
        gsis_id: id,
        name: weekly.name,
        pos: weekly.pos,
        team: weekly.team,
        weekly_row_count: weekly.rowCount,
        nflverse_espn_id: espnId || null,
        in_players_csv: Boolean(pl),
        espn_id_in_canonical: Boolean(espnInCanonical),
        already_in_player_external_ids: inB,
        unresolved_reason: unresolvedReason
      };
    })
    .sort((a, b) => b.weekly_row_count - a.weekly_row_count);

  const reasonCounts: Record<string, number> = {};
  for (const r of unresolvedReport) {
    reasonCounts[r.unresolved_reason] = (reasonCounts[r.unresolved_reason] ?? 0) + 1;
  }

  console.info(`  Unresolved 2025 players: ${unresolvedReport.length}`);
  console.info(`  By reason: ${JSON.stringify(reasonCounts, null, 2)}`);
  console.info(`\n  Top 20 by weekly row count:`);
  for (const r of unresolvedReport.slice(0, 20)) {
    console.info(`    ${r.gsis_id}  ${r.name.padEnd(28)} [${r.pos}/${r.team}]  rows=${r.weekly_row_count}  espn=${r.nflverse_espn_id ?? "none"}  reason=${r.unresolved_reason}`);
  }

  // Write full report
  mkdirSync(DIAGNOSTIC_DIR, { recursive: true });
  const reportPath = path.join(DIAGNOSTIC_DIR, "gsis-unresolved-2025.json");
  writeFileSync(reportPath, JSON.stringify(unresolvedReport, null, 2));
  console.info(`\n  Full unresolved report: ${reportPath}`);

  // === SLEEPER ID CHECK ===
  console.info("\n=== SLEEPER ID ANALYSIS ===");
  // Check if any 2025 weekly player can be bridged via sleeper_player_id
  // Sleeper API stores stats_id = GSIS ID. Check canonical players for stats_id field.
  const sleeperStatsIdMap = new Map<string, string>(); // stats_id → canonical player_id
  let sleeperStatsIdCount = 0;
  for (const p of canonicalPlayers ?? []) {
    const meta = p.metadata_json as Record<string, unknown> | null;
    if (!meta) continue;
    const statsId = meta["stats_id"];
    if (typeof statsId === "string" && statsId.trim()) {
      sleeperStatsIdMap.set(statsId.trim(), p.id as string);
      sleeperStatsIdCount++;
    }
  }
  console.info(`  Canonical players with metadata_json.stats_id: ${sleeperStatsIdCount}`);
  const weeklyMatchableViaStatsId = [...setA].filter(id => sleeperStatsIdMap.has(id)).length;
  console.info(`  2025 weekly GSIS IDs matchable via stats_id: ${weeklyMatchableViaStatsId}`);

  // If stats_id would fix things, show what it adds vs ESPN bridge
  if (weeklyMatchableViaStatsId > 0) {
    const fixedByStatsId = [...setA].filter(id => sleeperStatsIdMap.has(id) && !setB.has(id)).length;
    console.info(`  NEW matches via stats_id (not already in B): ${fixedByStatsId}`);
  }

  // === SUMMARY ===
  console.info("\n=== DIAGNOSTIC SUMMARY ===");
  console.info(`Supabase project: ${projectHost}`);
  console.info(`A (2025 weekly GSIS IDs, QB/RB/WR/TE REG): ${setA.size}`);
  console.info(`B (player_external_ids gsis rows): ${setB.size}`);
  console.info(`C (H1 lookup result): ${setC.size}`);
  console.info(`A ∩ B: ${aIntersectB.length}`);
  console.info(`A ∩ C: ${aIntersectC.length}`);
  console.info(`A - B: ${aMinusB.length}`);
  console.info(`B - A: ${bMinusA.length}`);
  console.info(`A∩B == A∩C: ${aIntersectB.length === aIntersectC.length}`);
  console.info(`Root cause analysis: ${unresolvedReport.length} unresolved — by reason: ${JSON.stringify(reasonCounts)}`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const contents = readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
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
