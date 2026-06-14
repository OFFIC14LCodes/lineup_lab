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

async function main() {
  // Matt Hibner - sleeper=13324, TE, BAL
  const { data: hibner } = await sb.from("players").select("id,full_name,position,team,sleeper_player_id").eq("sleeper_player_id", "13324").single();
  console.log("Matt Hibner:", JSON.stringify(hibner));

  // Chig Okonkwo - sleeper=8210, TE, WAS
  const { data: okonkwo } = await sb.from("players").select("id,full_name,position,team,sleeper_player_id").eq("sleeper_player_id", "8210").single();
  console.log("Chig Okonkwo:", JSON.stringify(okonkwo));

  // Check existing MFL external IDs
  const { data: existing } = await sb.from("player_external_ids").select("*").eq("provider", "mfl").limit(5);
  console.log("Existing MFL external IDs:", JSON.stringify(existing));

  // Check player_external_ids table schema
  const { data: tableInfo, error: tErr } = await sb.from("player_external_ids").select("*").limit(0);
  console.log("Table accessible:", !tErr);
}
main().catch(console.error);
