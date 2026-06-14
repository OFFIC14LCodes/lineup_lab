// H7.2 CSV ADP Snapshot Import (FantasyPros / generic CSV)
//
// Usage:
//   # Dry run — resolves identities, shows what would be written; writes nothing
//   npm run import:h7-csv-adp -- \
//     --file=artifacts/adp/fp-2026-redraft-ppr-12team.csv \
//     --provider=fantasypros --season=2026 \
//     --format=redraft --scoring=ppr --team-count=12 \
//     --mode=dry_run
//
//   # Execute — inserts snapshot + records
//   npm run import:h7-csv-adp -- \
//     --file=artifacts/adp/fp-2026-dynasty-sf-12team.csv \
//     --provider=fantasypros --season=2026 \
//     --format=dynasty_startup --scoring=ppr --team-count=12 \
//     --superflex --mode=execute
//
// --format options  : redraft | dynasty_startup | dynasty_ongoing | rookie | best_ball
// --scoring options : ppr | half_ppr | standard
// --superflex flag  : marks the format as Superflex (2QB/SUPER_FLEX slot)
// --te-premium=N    : TE bonus PPR value (default 0.0)
// --confidence      : high | medium (default) | low

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { parseCsvAdp, buildCsvSourceMeta } from "@/lib/providers/adp/csv";
import { resolveAdpIdentities, summarizeResolution, buildExternalIdMap, FANTASYPROS_NAME_ALIASES } from "@/lib/adp/identity";
import { importAdpSnapshot, loadLatestSnapshotWithRecords } from "@/lib/adp/storage";
import { assignFormatGroupKey } from "@/lib/adp/format-group";
import type { AdpFormatProfile, AdpProvider, AdpDraftType, AdpScoringFormat, AdpSourceConfidence } from "@/lib/adp/types";
import type { PlayerAdpRecord } from "@/lib/adp/types";
import type { MatchablePlayer } from "@/lib/players/match";

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

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (flag: string, def: string | null = null): string | null => {
    const eqArg = argv.find((a) => a.startsWith(flag + "="));
    if (eqArg) return eqArg.slice(flag.length + 1);
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
  };
  const has = (flag: string) => argv.includes(flag);

  const mode = (get("--mode", "dry_run") ?? "dry_run") as "dry_run" | "execute";
  if (mode !== "dry_run" && mode !== "execute") {
    console.error(`Invalid --mode "${mode}". Must be "dry_run" or "execute".`);
    process.exit(1);
  }

  const file = get("--file");
  if (!file) {
    console.error('Missing required --file argument. E.g.: --file=artifacts/adp/fp-2026-redraft-ppr.csv');
    process.exit(1);
  }

  const format = (get("--format", "redraft") ?? "redraft") as
    | "redraft" | "dynasty_startup" | "dynasty_ongoing" | "rookie" | "best_ball";
  const scoring = (get("--scoring", "ppr") ?? "ppr") as "ppr" | "half_ppr" | "standard";
  const provider = (get("--provider", "fantasypros") ?? "fantasypros") as AdpProvider;
  const season = parseInt(get("--season", "2026") ?? "2026", 10);
  const teamCount = parseInt(get("--team-count", "12") ?? "12", 10);
  const isSuperflex = has("--superflex") || get("--superflex") === "true";
  const tePremium = parseFloat(get("--te-premium", "0") ?? "0");
  const confidence = (get("--confidence", "medium") ?? "medium") as AdpSourceConfidence;

  return { file, provider, season, format, scoring, teamCount, isSuperflex, tePremium, confidence, mode };
}

async function loadAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(`DB query failed: ${error.message}`);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function main() {
  loadLocalEnv();
  const args = parseArgs();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) {
    console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const modeLabel = args.mode === "dry_run" ? "DRY RUN" : "EXECUTE";
  console.log(`\n[h7-csv-import] ${modeLabel} — provider=${args.provider} season=${args.season} format=${args.format} scoring=${args.scoring}`);
  console.log(`[h7-csv-import] file=${args.file} teamCount=${args.teamCount} superflex=${args.isSuperflex} tePremium=${args.tePremium}`);
  if (args.mode === "dry_run") console.log("[h7-csv-import] No rows will be written.\n");

  // ── Step 1: Read and parse the CSV file ──────────────────────────────────
  const filePath = path.resolve(process.cwd(), args.file);
  if (!existsSync(filePath)) {
    console.error(`[h7-csv-import] File not found: ${filePath}`);
    process.exit(1);
  }

  const csvText = readFileSync(filePath, "utf8");
  const parseResult = parseCsvAdp(csvText);
  console.log(`[h7-csv-import] Parsed: ${parseResult.rowCount} records, ${parseResult.skippedRows} skipped, format=${parseResult.detectedFormat}`);
  console.log(`[h7-csv-import] File hash: ${parseResult.fileHash.slice(0, 16)}...`);

  if (parseResult.raw.length === 0) {
    console.error("[h7-csv-import] No records parsed — check CSV format.");
    process.exit(1);
  }

  // ── Step 2: Build format profile and source meta ─────────────────────────
  const isDynasty = args.format.startsWith("dynasty");
  const isStartup = args.format === "dynasty_startup";
  const isBestBall = args.format === "best_ball";
  const pprValue = args.scoring === "ppr" ? 1.0 : args.scoring === "half_ppr" ? 0.5 : 0.0;
  const scoringFormat: AdpScoringFormat = args.scoring === "ppr" ? "ppr"
    : args.scoring === "half_ppr" ? "half_ppr"
    : "standard";
  const draftType: AdpDraftType = isDynasty
    ? (isStartup ? "dynasty_startup" : "dynasty_rookie")
    : isBestBall ? "best_ball"
    : "redraft";

  const formatProfile: AdpFormatProfile = {
    draftType,
    platform: args.provider,
    scoringFormat,
    pprValue,
    tePremiumValue: args.tePremium,
    rosterPositions: args.isSuperflex ? ["QB", "RB", "RB", "WR", "WR", "WR", "TE", "SUPER_FLEX", "FLEX", "K", "DEF", "BN", "BN", "BN", "BN"] : ["QB", "RB", "RB", "WR", "WR", "WR", "TE", "FLEX", "K", "DEF", "BN", "BN", "BN", "BN"],
    teamCount: args.teamCount,
    isBestBall,
    isDynasty,
    isStartup,
    isSuperflex: args.isSuperflex,
    isTePremium: args.tePremium > 0,
  };

  const formatGroupKey = assignFormatGroupKey(formatProfile);
  console.log(`[h7-csv-import] Format group: ${formatGroupKey}`);

  const now = new Date().toISOString();
  const sourceMeta = buildCsvSourceMeta({
    filename: path.basename(args.file),
    fileHash: parseResult.fileHash,
    capturedAt: now,
    effectiveDate: now.slice(0, 10),
    season: args.season,
    formatProfile,
    sampleSize: null,
    provider: args.provider === "fantasypros" ? "fantasypros" : "manual_csv",
  });

  // ── Step 3: Load canonical players + external IDs ────────────────────────
  console.log("[h7-csv-import] Loading canonical players...");
  const canonicalPlayers = await loadAllPages<MatchablePlayer>((from, to) =>
    supabase
      .from("players")
      .select("id,sleeper_player_id,full_name,normalized_name,position,primary_position,position_group,side_of_ball,team")
      .range(from, to)
  );
  console.log(`[h7-csv-import] Loaded ${canonicalPlayers.length} canonical players`);

  const externalIdRows = await loadAllPages<{ external_id: string; player_id: string }>((from, to) =>
    supabase
      .from("player_external_ids")
      .select("external_id,player_id")
      .eq("provider", args.provider)
      .eq("external_type", "player")
      .range(from, to)
  );
  const externalIdMap = buildExternalIdMap(externalIdRows);
  console.log(`[h7-csv-import] External ID map: ${externalIdMap.size} entries`);

  // ── Step 4: Resolve identities ────────────────────────────────────────────
  const nameAliases = args.provider === "fantasypros" ? FANTASYPROS_NAME_ALIASES : undefined;
  const resolved: PlayerAdpRecord[] = resolveAdpIdentities(parseResult.raw, {
    externalIdMap,
    canonicalPlayers,
    playerIdsWithProfile: new Set(),
    nameAliases,
  });
  const summary = summarizeResolution(resolved);
  console.log(
    `[h7-csv-import] Identity resolution: ${summary.resolved}/${summary.total} resolved ` +
    `(${summary.ambiguous} ambiguous, ${summary.unresolved} unresolved, ${summary.rookie} rookie)`
  );

  if (summary.unresolved > 0) {
    const sample = resolved
      .filter((r) => !r.canonicalPlayerId && r.identityMatchMethod !== "ambiguous")
      .slice(0, 10)
      .map((r) => `${r.rawName} (${r.rawPosition}/${r.rawTeam ?? "?"})`);
    console.log(`[h7-csv-import] Unresolved sample: ${sample.join(", ")}`);
  }

  // ── Step 5: Import snapshot ───────────────────────────────────────────────
  console.log(`[h7-csv-import] Importing snapshot (mode=${args.mode})...`);
  const importResult = await importAdpSnapshot({
    mode: args.mode,
    sourceMeta,
    sourceConfidence: args.confidence,
    records: resolved,
    supabase,
  });

  // ── Step 6: Report ────────────────────────────────────────────────────────
  console.log("\n── H7.2 CSV Import Result ─────────────────────────────────");
  console.log(`  Mode                : ${importResult.mode}`);
  if (importResult.existingSnapshotId) {
    console.log(`  Status              : DUPLICATE — existing snapshot matched`);
    console.log(`  Existing snapshot   : ${importResult.existingSnapshotId}`);
  } else {
    console.log(`  Status              : ${args.mode === "execute" ? (importResult.snapshotId ? "INSERTED" : "ERROR") : "DRY RUN"}`);
    if (importResult.snapshotId) console.log(`  Snapshot ID         : ${importResult.snapshotId}`);
  }
  console.log(`  Snapshot inserted   : ${importResult.snapshotInserted}`);
  console.log(`  Player records      : ${importResult.playerRecordsInserted} inserted`);
  console.log(`  Movements           : ${importResult.movementsInserted} computed`);
  console.log(`  Format group        : ${formatGroupKey}`);
  console.log(`  Resolution rate     : ${Math.round((summary.resolved / summary.total) * 1000) / 10}%`);
  if (importResult.errors.length) {
    console.error(`  Errors              : ${importResult.errors.join("; ")}`);
  }
  console.log(`  File hash           : ${importResult.diagnostics.fileHash.slice(0, 16)}...`);
  console.log(`  Source              : ${importResult.diagnostics.sourceIdentifier}`);
  console.log("──────────────────────────────────────────────────────────\n");

  // ── Step 7: Write artifact ────────────────────────────────────────────────
  const artifactDir = path.join(process.cwd(), "artifacts", "adp");
  mkdirSync(artifactDir, { recursive: true });
  const artifactPath = path.join(
    artifactDir,
    `h7-csv-import-${args.season}-${formatGroupKey}-${args.mode}.json`
  );
  writeFileSync(
    artifactPath,
    JSON.stringify(
      {
        generatedAt: now,
        mode: args.mode,
        args,
        parse: {
          rawRecords: parseResult.rowCount,
          skippedRows: parseResult.skippedRows,
          detectedFormat: parseResult.detectedFormat,
          fileHash: parseResult.fileHash,
        },
        formatProfile,
        formatGroupKey,
        resolution: {
          ...summary,
          resolvedRate: Math.round((summary.resolved / summary.total) * 1000) / 10,
          unresolvedSample: resolved
            .filter((r) => !r.canonicalPlayerId)
            .slice(0, 20)
            .map((r) => ({ rawName: r.rawName, rawPosition: r.rawPosition, rawTeam: r.rawTeam, method: r.identityMatchMethod })),
        },
        importResult,
        sourceMeta,
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`[h7-csv-import] Artifact: ${artifactPath}`);

  // ── Step 8: DB validation (execute mode only) ─────────────────────────────
  if (args.mode === "execute" && importResult.snapshotId) {
    console.log("[h7-csv-import] Running post-import database validation...");
    const loaded = await loadLatestSnapshotWithRecords(supabase, args.provider, args.season);
    if (!loaded) {
      console.error("[h7-csv-import] DB validation: could not load snapshot after insert");
    } else {
      const { snapshot, records } = loaded;
      const resolvedInDb = records.filter((r) => r.canonical_player_id !== null).length;
      const uniqueIds = new Set(records.filter((r) => r.canonical_player_id).map((r) => r.canonical_player_id));
      console.log(`[h7-csv-import] DB snapshot : ${snapshot.id.slice(0, 8)}...`);
      console.log(`[h7-csv-import] DB records  : ${records.length} rows`);
      console.log(`[h7-csv-import] Resolved    : ${resolvedInDb} with canonical ID`);
      console.log(`[h7-csv-import] Unique IDs  : ${uniqueIds.size} distinct canonical players`);
      const sampleAdp = records.slice(0, 3).map((r) => `${r.raw_name}=${r.overall_adp}`).join(", ");
      console.log(`[h7-csv-import] Sample ADP  : ${sampleAdp}`);
    }
  }
}

main().catch((err) => {
  console.error("[h7-csv-import] Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
