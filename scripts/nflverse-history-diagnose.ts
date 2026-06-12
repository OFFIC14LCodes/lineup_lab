#!/usr/bin/env tsx
/**
 * H1 — nflverse Historical Import Diagnostic
 *
 * Compares the live player_weekly_stats rows for a given provider/season
 * against the expected resolved rows from the cached nflverse CSV.
 *
 * Reports:
 *   - Total rows in DB (count by position, week)
 *   - Set A: resolved source rows (from CSV + GSIS map)
 *   - Set B: existing DB rows
 *   - A minus B: missing rows (not yet written)
 *   - B minus A: unexpected rows (in DB but not in resolved source)
 *   - A intersect B: already written
 *
 * Writes artifact: data/diagnostic/nflverse-import-gap-<season>.json
 *
 * Usage:
 *   npm run diagnose:nflverse-history
 *   npm run diagnose:nflverse-history -- --season=2024
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";

import { parseSeason } from "../src/lib/providers/nflverse/import-cli-options";
import { downloadAndArchive } from "../src/lib/providers/nflverse/download";
import { normalizeNflverseRow } from "../src/lib/providers/nflverse/normalize";
import { resolveGsisIdsBatch } from "../src/lib/providers/nflverse/identity";
import { NFLVERSE_SUPPORTED_POSITION_GROUPS } from "../src/lib/providers/nflverse/schema";
import { normalizeGsisId } from "../src/lib/providers/nflverse/normalize-gsis-id";

loadLocalEnv();

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!url || !serviceRoleKey) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const adminClient = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const projectRoot = process.cwd();
  const season = parseSeason(process.argv, process.env);

  console.info(`\n=== nflverse Import Diagnostic — Season ${season} ===\n`);

  // ── 1. Load cached CSV ────────────────────────────────────────────────────
  console.info("Loading nflverse CSV (cached)...");
  const download = await downloadAndArchive(season, projectRoot);
  const fileContent = readFileSync(download.filePath, "utf8");
  const parsed = Papa.parse<Record<string, string>>(fileContent, {
    header: true,
    skipEmptyLines: true
  });
  console.info(`  CSV rows: ${parsed.data.length}`);

  // ── 2. Collect scope entries from CSV ─────────────────────────────────────
  type SourceRow = { gsisId: string; week: number; positionGroup: string };
  const scopeEntries: SourceRow[] = [];

  for (const raw of parsed.data) {
    const positionGroup = raw["position_group"]?.trim().toUpperCase();
    if (!positionGroup || !NFLVERSE_SUPPORTED_POSITION_GROUPS.has(positionGroup)) continue;

    const result = normalizeNflverseRow(raw);
    if (!result.ok) continue; // skips non-regular and invalid rows

    const gsisId = normalizeGsisId(raw["player_id"]);
    if (!gsisId) continue;

    scopeEntries.push({ gsisId, week: result.row.week, positionGroup: result.row.positionGroup });
  }
  console.info(`  Regular-season QB/RB/WR/TE rows: ${scopeEntries.length}`);

  // ── 3. Resolve GSIS IDs → canonical player IDs ───────────────────────────
  console.info("Resolving GSIS IDs via player_external_ids...");
  const gsisIds = new Set(scopeEntries.map((e) => e.gsisId));
  const gsisMap = await resolveGsisIdsBatch(gsisIds, adminClient);
  console.info(`  Resolved: ${gsisMap.size} / ${gsisIds.size} unique GSIS IDs`);

  // ── 4. Build set A: resolved source rows (natural key = playerId|week) ────
  type ResolvedRow = { naturalKey: string; gsisId: string; playerId: string; week: number; positionGroup: string };
  const setA: ResolvedRow[] = [];

  for (const entry of scopeEntries) {
    const playerId = gsisMap.get(entry.gsisId);
    if (!playerId) continue;
    setA.push({
      naturalKey: `${playerId}|${entry.week}`,
      gsisId: entry.gsisId,
      playerId,
      week: entry.week,
      positionGroup: entry.positionGroup
    });
  }

  // Deduplicate A (same player can appear once per week in resolved source)
  const setAByKey = new Map<string, ResolvedRow>();
  for (const row of setA) {
    setAByKey.set(row.naturalKey, row);
  }
  const setAUniq = [...setAByKey.values()];
  console.info(`  Set A (resolved source): ${setAUniq.length} unique player-week pairs`);

  // ── 5. Query set B: existing DB rows ─────────────────────────────────────
  console.info("Querying existing player_weekly_stats rows...");
  type DbRow = { player_id: string; week: number; position_group: string | null };
  const dbRows: DbRow[] = [];

  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await adminClient
      .from("player_weekly_stats")
      .select("player_id,week,position_group")
      .eq("provider", "nflverse")
      .eq("season", season)
      .eq("season_type", "regular")
      .range(offset, offset + PAGE - 1);

    if (error) throw new Error(`DB query failed: ${error.message}`);
    for (const row of data ?? []) {
      dbRows.push(row as DbRow);
    }
    if ((data?.length ?? 0) < PAGE) break;
    offset += PAGE;
  }
  console.info(`  Set B (DB existing): ${dbRows.length} rows`);

  const setBByKey = new Map<string, DbRow>();
  for (const row of dbRows) {
    setBByKey.set(`${row.player_id}|${row.week}`, row);
  }

  // ── 6. Compute sets ───────────────────────────────────────────────────────
  const aMinus_B: ResolvedRow[] = []; // missing from DB
  const aIntersect_B: ResolvedRow[] = []; // already written

  for (const row of setAUniq) {
    if (setBByKey.has(row.naturalKey)) {
      aIntersect_B.push(row);
    } else {
      aMinus_B.push(row);
    }
  }

  const bMinus_A: DbRow[] = []; // unexpected rows in DB
  const setAKeys = new Set(setAUniq.map((r) => r.naturalKey));
  for (const [key, row] of setBByKey) {
    if (!setAKeys.has(key)) {
      bMinus_A.push(row);
    }
  }

  // ── 7. Count breakdowns ───────────────────────────────────────────────────
  function countByPosition(rows: Array<{ positionGroup?: string }>): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const pos = r.positionGroup ?? "unknown";
      counts[pos] = (counts[pos] ?? 0) + 1;
    }
    return counts;
  }

  function countByWeek(rows: Array<{ week: number }>): Record<number, number> {
    const counts: Record<number, number> = {};
    for (const r of rows) {
      counts[r.week] = (counts[r.week] ?? 0) + 1;
    }
    return counts;
  }

  const dbByPosition: Record<string, number> = {};
  const dbByWeek: Record<number, number> = {};
  for (const row of dbRows) {
    const pos = row.position_group ?? "unknown";
    dbByPosition[pos] = (dbByPosition[pos] ?? 0) + 1;
    dbByWeek[row.week] = (dbByWeek[row.week] ?? 0) + 1;
  }

  // ── 8. Print report ───────────────────────────────────────────────────────
  console.info([
    "",
    "=== Diagnostic Report ===",
    "",
    `Set A (resolved source rows): ${setAUniq.length}`,
    `Set B (existing DB rows):     ${dbRows.length}`,
    `A ∩ B (already written):      ${aIntersect_B.length}`,
    `A - B (missing from DB):      ${aMinus_B.length}`,
    `B - A (unexpected in DB):     ${bMinus_A.length}`,
    ""
  ].join("\n"));

  console.info("--- DB rows by position_group ---");
  for (const [pos, count] of Object.entries(dbByPosition).sort()) {
    console.info(`  ${pos.padEnd(4)}: ${count}`);
  }

  console.info("\n--- DB rows by week ---");
  for (const [week, count] of Object.entries(dbByWeek)
    .map(([w, c]) => [parseInt(w), c] as [number, number])
    .sort((a, b) => a[0] - b[0])) {
    console.info(`  Week ${String(week).padStart(2)}: ${count}`);
  }

  if (aMinus_B.length > 0) {
    console.info("\n--- Missing rows by position_group ---");
    const missingByPos = countByPosition(aMinus_B.map((r) => ({ positionGroup: r.positionGroup })));
    for (const [pos, count] of Object.entries(missingByPos).sort()) {
      console.info(`  ${pos.padEnd(4)}: ${count}`);
    }
    console.info("\n--- Missing rows by week ---");
    const missingByWeek = countByWeek(aMinus_B);
    for (const [week, count] of Object.entries(missingByWeek)
      .map(([w, c]) => [parseInt(w), c] as [number, number])
      .sort((a, b) => a[0] - b[0])) {
      console.info(`  Week ${String(week).padStart(2)}: ${count}`);
    }
  }

  if (bMinus_A.length > 0) {
    console.info(`\n⚠️  ${bMinus_A.length} unexpected rows in DB (not in resolved source). Investigate before resuming.`);
  }

  // ── 9. Write artifact ────────────────────────────────────────────────────
  const diagDir = path.join(projectRoot, "data", "diagnostic");
  mkdirSync(diagDir, { recursive: true });

  const artifact = {
    generatedAt: new Date().toISOString(),
    season,
    sourceUrl: download.sourceUrl,
    sha256: download.sha256,
    setACount: setAUniq.length,
    setBCount: dbRows.length,
    intersectionCount: aIntersect_B.length,
    missingCount: aMinus_B.length,
    unexpectedCount: bMinus_A.length,
    dbByPosition,
    dbByWeek,
    missingRows: aMinus_B.map((r) => ({
      naturalKey: r.naturalKey,
      gsisId: r.gsisId,
      playerId: r.playerId,
      week: r.week,
      positionGroup: r.positionGroup
    })),
    unexpectedRows: bMinus_A.map((r) => ({
      naturalKey: `${r.player_id}|${r.week}`,
      playerId: r.player_id,
      week: r.week,
      positionGroup: r.position_group
    }))
  };

  const artifactPath = path.join(diagDir, `nflverse-import-gap-${season}.json`);
  writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), "utf8");
  console.info(`\nDiagnostic artifact → ${artifactPath}`);

  // ── 10. Resume guidance ──────────────────────────────────────────────────
  if (aMinus_B.length > 0) {
    console.info([
      "",
      `=== Resume Plan ===`,
      `${aIntersect_B.length} rows exist — will be skipped (not re-written).`,
      `${aMinus_B.length} rows are missing — will be written on resume.`,
      `Expected final row count: ${setAUniq.length}`,
      ``,
      `Run to resume (dry-run first):`,
      `  npm run import:nflverse-history -- --season=${season}`,
      `Then execute:`,
      `  npm run import:nflverse-history -- --season=${season} --execute`,
      ""
    ].join("\n"));
  } else {
    console.info(`\n✓ All ${setAUniq.length} resolved rows are present in DB. Import is complete.`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
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
