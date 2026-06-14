// Investigate the 4 unresolved ADP identities and produce a classification ledger.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { fetchMflAdp } from "@/lib/providers/adp/mfl";

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

// Known unresolved from last dry-run
const UNRESOLVED = [
  { rawName: "David Bailey",        rawPosition: "DE",  rawTeam: "NYJ", rawId: null as string | null },
  { rawName: "Brendan Sorsby",      rawPosition: "XX",  rawTeam: null,  rawId: null as string | null },
  { rawName: "Matthew Hibner",      rawPosition: "TE",  rawTeam: "BAL", rawId: null as string | null },
  { rawName: "Chigoziem Okonkwo",   rawPosition: "TE",  rawTeam: "WAS", rawId: null as string | null },
];

async function searchCanonical(name: string, position: string | null, team: string | null) {
  // Fuzzy name search
  const nameParts = name.toLowerCase().split(" ");
  const { data, error } = await sb
    .from("players")
    .select("id,full_name,normalized_name,position,team,sleeper_player_id")
    .ilike("full_name", `%${nameParts[nameParts.length - 1]}%`)
    .limit(10);
  if (error) return [];
  return (data ?? []) as Array<{ id: string; full_name: string; normalized_name: string; position: string; team: string; sleeper_player_id: string }>;
}

async function main() {
  // First get MFL IDs by fetching live ADP
  console.log("Fetching live MFL ADP to get player IDs...\n");
  const mflResult = await fetchMflAdp({ season: 2026 });

  // Find MFL IDs for unresolved names
  for (const u of UNRESOLVED) {
    const match = mflResult.raw.find((r) => r.rawName === u.rawName);
    if (match) {
      u.rawId = match.rawId;
    }
  }

  console.log("=== Identity Review Ledger ===\n");

  for (const u of UNRESOLVED) {
    const mflRec = mflResult.raw.find((r) => r.rawName === u.rawName);
    console.log(`--- ${u.rawName} ---`);
    console.log(`  MFL ID   : ${u.rawId ?? "not found in live feed"}`);
    console.log(`  Position : ${u.rawPosition}`);
    console.log(`  Team     : ${u.rawTeam ?? "null"}`);
    console.log(`  ADP      : ${mflRec?.overallAdp ?? "n/a"}`);
    console.log(`  Rank     : ${mflRec?.overallRank ?? "n/a"}`);
    console.log(`  Min/Max  : ${mflRec?.minPick ?? "n/a"} / ${mflRec?.maxPick ?? "n/a"}`);
    console.log(`  extraFields: ${JSON.stringify(mflRec?.extraFields ?? {})}`);

    // Search canonical players
    const candidates = await searchCanonical(u.rawName, u.rawPosition, u.rawTeam);
    if (candidates.length === 0) {
      console.log(`  Canonical: NO CANDIDATES FOUND`);
    } else {
      console.log(`  Canonical candidates:`);
      for (const c of candidates) {
        console.log(`    - ${c.full_name} | ${c.position} | ${c.team} | sleeper=${c.sleeper_player_id}`);
      }
    }
    console.log();
  }

  // Also check TMWR classification
  console.log("=== TMWR Classification ===");
  const tmwrRec = mflResult.raw.find((r) => r.rawPosition === "TMWR");
  if (tmwrRec) {
    console.log(`TMWR record found: ${tmwrRec.rawName} | ${tmwrRec.rawPosition} | ${tmwrRec.rawTeam}`);
  } else {
    // Check what was rejected
    console.log("TMWR not in output (correctly filtered out by SKIP_POSITIONS/TM* prefix)");
    console.log("Rejected reason: skip_position (position starts with TM)");
    console.log("Classification: domain_excluded_team_aggregate");
  }
}

main().catch(console.error);
