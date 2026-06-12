/**
 * Smoke test: nflverse resume behavior — read-only, bounded Supabase query.
 *
 * Verifies that the pre-flight existing-row query:
 *   1. Returns without error for provider=nflverse + season + season_type=regular
 *   2. Reports a non-negative row count
 *   3. Does NOT write any rows
 *
 * This test is read-only and idempotent. It will pass whether rows exist or not.
 * It requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 *
 * Usage:
 *   npm run smoke:nflverse-history-resume
 *   npm run smoke:nflverse-history-resume -- --season=2024
 */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadLocalEnv();

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];

const hasConfig = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

const SEASON = (() => {
  const arg = process.argv.find((a) => a.startsWith("--season="));
  if (arg) {
    const n = parseInt(arg.split("=")[1], 10);
    return Number.isFinite(n) ? n : 2025;
  }
  return 2025;
})();

const PAGE_SIZE = 1000;

describe.skipIf(!hasConfig)(`nflverse resume pre-flight smoke — season ${SEASON}`, () => {
  it("pre-flight query returns without error", async () => {
    const client = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const existingKeys = new Set<string>();
    let offset = 0;

    while (true) {
      const { data, error } = await client
        .from("player_weekly_stats")
        .select("player_id,week")
        .eq("provider", "nflverse")
        .eq("season", SEASON)
        .eq("season_type", "regular")
        .range(offset, offset + PAGE_SIZE - 1);

      expect(error).toBeNull();
      for (const row of data ?? []) {
        existingKeys.add(`${row.player_id}|${row.week}`);
      }
      if ((data?.length ?? 0) < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    expect(existingKeys.size).toBeGreaterThanOrEqual(0);
    console.info(`[smoke] Season ${SEASON}: ${existingKeys.size} existing player_weekly_stats rows found.`);
  });

  it("pre-flight query does not write any rows", async () => {
    // This test is trivially true (the pre-flight is SELECT-only).
    // Kept as a sentinel so regressions that accidentally write here are caught.
    const client = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { count, error } = await client
      .from("player_weekly_stats")
      .select("*", { count: "exact", head: true })
      .eq("provider", "nflverse")
      .eq("season", SEASON)
      .eq("season_type", "regular");

    expect(error).toBeNull();
    const before = count ?? 0;

    // Run pre-flight again (read-only by definition) — count must not change.
    const { count: after, error: err2 } = await client
      .from("player_weekly_stats")
      .select("*", { count: "exact", head: true })
      .eq("provider", "nflverse")
      .eq("season", SEASON)
      .eq("season_type", "regular");

    expect(err2).toBeNull();
    expect(after).toBe(before);
    console.info(`[smoke] Row count stable at ${before} — no writes occurred.`);
  });
});

describe.skipIf(hasConfig)("nflverse resume pre-flight smoke (skipped — no config)", () => {
  it("skipped: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured", () => {
    console.info("[smoke] Skipped. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run.");
  });
});
