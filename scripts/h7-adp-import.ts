// H7 ADP Snapshot Import
//
// Usage:
//   npm run import:h7-adp -- --provider=mfl --season=2026 --mode=dry_run
//   npm run import:h7-adp -- --provider=mfl --season=2026 --mode=execute
//   npm run import:h7-adp -- --provider=mfl --season=2026 --mode=execute --team-count=12
//
// Modes:
//   dry_run  — resolves identities, shows what would be written; writes nothing
//   execute  — seeds crosswalks, inserts snapshot + player records + movements

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { resolveAdpIdentities, summarizeResolution, buildExternalIdMap } from "@/lib/adp/identity";
import { importAdpSnapshot, seedCrosswalks, MFL_CROSSWALKS, loadLatestSnapshotWithRecords } from "@/lib/adp/storage";
import type { PlayerAdpRecord } from "@/lib/adp/types";
import { fetchMflAdp, buildMflSourceMeta } from "@/lib/providers/adp/mfl";
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
    // Support both "--flag value" and "--flag=value" forms
    const eqArg = argv.find((a) => a.startsWith(flag + "="));
    if (eqArg) return eqArg.slice(flag.length + 1);
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
  };
  const mode = get("--mode", "dry_run") as "dry_run" | "execute";
  if (mode !== "dry_run" && mode !== "execute") {
    console.error(`Invalid --mode "${mode}". Must be "dry_run" or "execute".`);
    process.exit(1);
  }
  return {
    provider: get("--provider", "mfl") ?? "mfl",
    season: parseInt(get("--season", "2026") ?? "2026", 10),
    teamCount: parseInt(get("--team-count", "12") ?? "12", 10),
    mode,
    mflBaseUrl: get("--mfl-url"),
  };
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

  const mode = args.mode;
  const modeLabel = mode === "dry_run" ? "DRY RUN" : "EXECUTE";
  console.log(`\n[h7-import] ${modeLabel} — provider=${args.provider} season=${args.season} teamCount=${args.teamCount}`);
  if (mode === "dry_run") console.log("[h7-import] No rows will be written.\n");

  // ── Step 1: Seed crosswalks (execute mode only) ──────────────────────────
  if (mode === "execute" && args.provider === "mfl") {
    console.log("[h7-import] Seeding MFL crosswalks...");
    const cwResult = await seedCrosswalks(supabase, MFL_CROSSWALKS);
    console.log(`[h7-import] Crosswalks: ${cwResult.seeded} seeded, ${cwResult.alreadyExist} already exist`);
    if (cwResult.errors.length) console.warn("[h7-import] Crosswalk errors:", cwResult.errors);
  }

  // ── Step 2: Fetch ADP ─────────────────────────────────────────────────────
  console.log(`[h7-import] Fetching ADP from MFL (season=${args.season})...`);
  const now = new Date().toISOString();
  const mflResult = await fetchMflAdp({
    season: args.season,
    teamCount: args.teamCount,
    baseUrl: args.mflBaseUrl ?? undefined,
  });
  console.log(
    `[h7-import] Fetched: ${mflResult.raw.length} records, ` +
    `sampleSize=${mflResult.sampleSize}, rejected=${mflResult.rejectedCount}, ` +
    `hash=${mflResult.fileHash.slice(0, 12)}...`
  );
  if (mflResult.rejectedCount > 0) {
    console.log(`[h7-import] Rejection reasons: ${JSON.stringify(mflResult.rejectedReasons)}`);
  }

  const sourceMeta = buildMflSourceMeta({
    season: args.season,
    teamCount: args.teamCount,
    capturedAt: now,
    effectiveDate: now.slice(0, 10),
    fileHash: mflResult.fileHash,
    sourceUrl: mflResult.sourceUrl,
    sampleSize: mflResult.sampleSize,
    sourceVersion: mflResult.sourceVersion,
  });

  // ── Step 3: Load canonical players + external IDs ────────────────────────
  console.log("[h7-import] Loading canonical players...");
  const canonicalPlayers = await loadAllPages<MatchablePlayer>((from, to) =>
    supabase
      .from("players")
      .select("id,sleeper_player_id,full_name,normalized_name,position,primary_position,position_group,side_of_ball,team")
      .range(from, to)
  );
  console.log(`[h7-import] Loaded ${canonicalPlayers.length} canonical players`);

  const externalIdRows = await loadAllPages<{ external_id: string; player_id: string }>((from, to) =>
    supabase
      .from("player_external_ids")
      .select("external_id,player_id")
      .eq("provider", "mfl")
      .eq("external_type", "player")
      .range(from, to)
  );
  const externalIdMap = buildExternalIdMap(externalIdRows);
  console.log(`[h7-import] MFL external ID map: ${externalIdMap.size} entries`);

  // ── Step 4: Resolve identities ────────────────────────────────────────────
  const resolved: PlayerAdpRecord[] = resolveAdpIdentities(mflResult.raw, {
    externalIdMap,
    canonicalPlayers,
    playerIdsWithProfile: new Set(),
  });
  const summary = summarizeResolution(resolved);
  console.log(
    `[h7-import] Identity resolution: ${summary.resolved}/${summary.total} resolved ` +
    `(${summary.ambiguous} ambiguous, ${summary.unresolved} unresolved, ${summary.rookie} rookie)`
  );

  if (summary.unresolved > 0) {
    const sample = resolved
      .filter((r) => !r.canonicalPlayerId && r.identityMatchMethod !== "ambiguous")
      .slice(0, 10)
      .map((r) => `${r.rawName} (${r.rawPosition}/${r.rawTeam ?? "?"})`);
    console.log(`[h7-import] Unresolved sample: ${sample.join(", ")}`);
  }

  // ── Step 5: Import snapshot ───────────────────────────────────────────────
  console.log(`[h7-import] Importing snapshot (mode=${mode})...`);
  const importResult = await importAdpSnapshot({
    mode,
    sourceMeta,
    sourceConfidence: "medium",
    records: resolved,
    supabase,
  });

  // ── Step 6: Report ────────────────────────────────────────────────────────
  console.log("\n── H7 Import Result ──────────────────────────────────────");
  console.log(`  Mode                : ${importResult.mode}`);
  if (importResult.existingSnapshotId) {
    console.log(`  Status              : DUPLICATE — existing snapshot matched`);
    console.log(`  Existing snapshot   : ${importResult.existingSnapshotId}`);
  } else {
    console.log(`  Status              : ${mode === "execute" ? (importResult.snapshotId ? "INSERTED" : "ERROR") : "DRY RUN"}`);
    if (importResult.snapshotId) console.log(`  Snapshot ID         : ${importResult.snapshotId}`);
  }
  console.log(`  Snapshot inserted   : ${importResult.snapshotInserted}`);
  console.log(`  Player records      : ${importResult.playerRecordsInserted} inserted`);
  console.log(`  Movements           : ${importResult.movementsInserted} computed`);
  if (importResult.errors.length) {
    console.error(`  Errors              : ${importResult.errors.join("; ")}`);
  }
  console.log(`  File hash           : ${importResult.diagnostics.fileHash.slice(0, 16)}...`);
  console.log(`  Source              : ${importResult.diagnostics.sourceIdentifier}`);
  console.log("──────────────────────────────────────────────────────────\n");

  // ── Step 7: Write artifact ────────────────────────────────────────────────
  const artifactDir = path.join(process.cwd(), "artifacts", "adp");
  mkdirSync(artifactDir, { recursive: true });
  const artifactPath = path.join(artifactDir, `h7-import-${args.season}-${mode}.json`);
  writeFileSync(
    artifactPath,
    JSON.stringify(
      {
        generatedAt: now,
        mode,
        args,
        mflFetch: {
          rawRecords: mflResult.raw.length,
          rejected: mflResult.rejectedCount,
          rejectedReasons: mflResult.rejectedReasons,
          sampleSize: mflResult.sampleSize,
          sourceVersion: mflResult.sourceVersion,
          fileHash: mflResult.fileHash,
        },
        resolution: {
          ...summary,
          resolvedRate: Math.round((summary.resolved / summary.total) * 1000) / 10,
          unresolvedSample: resolved
            .filter((r) => !r.canonicalPlayerId)
            .map((r) => ({
              rawName: r.rawName,
              rawPosition: r.rawPosition,
              rawTeam: r.rawTeam,
              method: r.identityMatchMethod,
            })),
        },
        importResult,
        sourceMeta,
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`[h7-import] Artifact: ${artifactPath}`);

  // ── Step 8: Database validation (execute mode only) ───────────────────────
  if (mode === "execute" && importResult.snapshotId) {
    console.log("[h7-import] Running post-import database validation...");
    const loaded = await loadLatestSnapshotWithRecords(supabase, args.provider, args.season);
    if (!loaded) {
      console.error("[h7-import] DB validation: could not load snapshot after insert");
    } else {
      const { snapshot, records } = loaded;
      const resolvedInDb = records.filter((r) => r.canonical_player_id !== null).length;
      const uniqueIds = new Set(records.filter((r) => r.canonical_player_id).map((r) => r.canonical_player_id));
      console.log(`[h7-import] DB snapshot: ${snapshot.id.slice(0, 8)}...`);
      console.log(`[h7-import] DB records : ${records.length} rows`);
      console.log(`[h7-import] Resolved   : ${resolvedInDb} with canonical ID`);
      console.log(`[h7-import] Unique IDs : ${uniqueIds.size} distinct canonical players`);
      const sampleAdp = records.slice(0, 3).map((r) => `${r.raw_name}=${r.overall_adp}`).join(", ");
      console.log(`[h7-import] Sample ADP : ${sampleAdp}`);
    }
  }
}

main().catch((err) => {
  console.error("[h7-import] Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
