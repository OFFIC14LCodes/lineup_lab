import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function rpc<T>(sql: string): Promise<T[]> {
  const { data, error } = await sb.rpc("exec_sql" as any, { query: sql }).returns<T[]>();
  if (error) throw new Error(error.message);
  return data as T[];
}

// Use pg_catalog directly via a known RPC or just check via information_schema
async function checkViaInformationSchema() {
  // Check indexes
  const { data: indexes, error: idxErr } = await sb
    .from("pg_indexes" as any)
    .select("indexname,tablename")
    .in("tablename", ["adp_snapshots", "adp_player_records", "adp_player_movements"]);

  if (idxErr) {
    console.log("Cannot query pg_indexes directly — using column check instead");
    // Fall back: just check columns exist
    for (const tbl of ["adp_snapshots", "adp_player_records", "adp_player_movements"]) {
      const { data, error } = await sb.from(tbl).select("*").limit(0);
      if (error) {
        console.log(`  ${tbl}: ERROR ${error.code}`);
      } else {
        console.log(`  ${tbl}: accessible`);
      }
    }
    return;
  }

  console.log("=== Indexes ===");
  for (const idx of indexes ?? []) {
    console.log(`  ${(idx as any).tablename}.${(idx as any).indexname}`);
  }
}

async function main() {
  console.log("=== ADP Schema Verification ===\n");

  // Basic table access
  console.log("Tables:");
  for (const tbl of ["adp_snapshots", "adp_player_records", "adp_player_movements"]) {
    const { count, error } = await sb.from(tbl).select("*", { count: "exact", head: true });
    if (error) console.log(`  ${tbl}: ERROR ${error.code} ${error.message}`);
    else console.log(`  ${tbl}: OK (${count} rows)`);
  }

  await checkViaInformationSchema();

  // Check unique constraint via duplicate insert attempt
  console.log("\n=== Unique Constraint (file_hash) ===");
  const testHash = "schema-verify-test-" + Date.now();
  const testRow = {
    provider: "mfl",
    source_identifier: "schema-test",
    file_hash: testHash,
    source_meta_json: { test: true },
    source_confidence: "medium",
    season: 2026,
    team_count: 12,
    scoring_format: "ppr",
    ppr_value: 1.0,
    te_premium_value: 0.0,
    sample_size: 0,
    captured_at: new Date().toISOString(),
    effective_date: "2026-01-01",
    total_records: 0,
    resolved_count: 0,
    unresolved_count: 0,
    ambiguous_count: 0,
    rookie_count: 0,
  };

  const { data: ins1, error: e1 } = await sb.from("adp_snapshots").insert(testRow).select("id").single();
  if (e1) {
    console.log("  Insert 1 failed:", e1.code, e1.message);
  } else {
    console.log("  Insert 1: OK, id=" + (ins1 as any)?.id?.slice(0, 8) + "...");

    // Attempt duplicate
    const { error: e2 } = await sb.from("adp_snapshots").insert({ ...testRow }).select("id");
    if (e2?.code === "23505") {
      console.log("  Duplicate rejected: unique constraint WORKS ✓");
    } else if (e2) {
      console.log("  Duplicate error:", e2.code, e2.message);
    } else {
      console.log("  WARNING: duplicate was accepted — unique constraint may not be active");
    }

    // Cleanup
    await sb.from("adp_snapshots").delete().eq("id", (ins1 as any).id);
    console.log("  Test row cleaned up");
  }

  // RLS check: authenticated reads (anon key can't read)
  console.log("\n=== RLS Check ===");
  const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (anonKey) {
    const anonSb = createClient(anonUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error: rlsErr } = await anonSb.from("adp_snapshots").select("id").limit(1);
    if (rlsErr) {
      console.log("  Anon read blocked:", rlsErr.code, "(expected — RLS working)");
    } else {
      console.log("  Anon read allowed (policy: authenticated reads only via RLS — may require session)");
    }
  }

  // FK: check adp_player_records references adp_snapshots
  console.log("\n=== FK Constraint Check ===");
  const fakeSnapId = "00000000-0000-0000-0000-000000000000";
  const { error: fkErr } = await sb.from("adp_player_records").insert({
    snapshot_id: fakeSnapId,
    raw_name: "FK Test Player",
    overall_adp: 1.0,
  });
  if (fkErr?.code === "23503") {
    console.log("  FK constraint WORKS — orphan insert rejected ✓");
  } else if (fkErr) {
    console.log("  FK insert failed:", fkErr.code, fkErr.message);
  } else {
    console.log("  WARNING: FK not enforced — orphan insert accepted");
  }
}

main().catch(console.error);
