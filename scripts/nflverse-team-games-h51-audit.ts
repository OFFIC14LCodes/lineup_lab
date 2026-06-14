import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import {
  reconcileStoredTeamGameRows,
  type StoredTeamGameRow,
} from "@/lib/providers/nflverse/team-games/reconcile";

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

loadLocalEnv();

type Args = {
  season: number;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let season = 2025;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--season" && args[i + 1]) {
      season = Number(args[++i]);
    } else if (args[i]?.startsWith("--season=")) {
      season = Number(args[i]!.slice("--season=".length));
    }
  }
  if (!Number.isInteger(season) || season < 2000 || season > 2100) {
    console.error(`Invalid --season: ${season}`);
    process.exit(1);
  }
  return { season };
}

async function main() {
  const { season } = parseArgs();
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const supabaseKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const rows: StoredTeamGameRow[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await admin
      .from("team_game_stats")
      .select(
        [
          "game_id",
          "season",
          "week",
          "season_type",
          "team_id",
          "opponent_id",
          "is_home",
          "points_scored",
          "points_allowed",
          "offensive_yards",
          "yards_allowed",
          "is_final",
          "reconciliation_status",
        ].join(",")
      )
      .eq("season", season)
      .eq("season_type", "REG")
      .range(offset, offset + 999);

    if (error) {
      console.error(`Failed to load team_game_stats: ${error.message}`);
      process.exit(1);
    }

    rows.push(...((data ?? []) as unknown as StoredTeamGameRow[]));
    if ((data?.length ?? 0) < 1000) break;
    offset += 1000;
  }

  const report = reconcileStoredTeamGameRows(rows);

  console.log(`\n=== H5.1 Team-Game Reconciliation ===`);
  console.log(`Season:                          ${season}`);
  console.log(`Total rows:                      ${report.totalRows}`);
  console.log(`Distinct games:                  ${report.totalDistinctGames}`);
  console.log(`Rows per game distribution:      ${JSON.stringify(report.rowsPerGameDistribution)}`);
  console.log(`Duplicate natural keys:          ${report.duplicateNaturalKeys}`);
  console.log(`Missing opponents:               ${report.missingOpponents}`);
  console.log(`Reciprocal opponent mismatches:  ${report.reciprocalOpponentMismatches}`);
  console.log(`Points-allowed mismatches:       ${report.pointsAllowedMismatches}`);
  console.log(`Yards-allowed mismatches:        ${report.yardsAllowedMismatches}`);
  console.log(`Home/away mismatches:            ${report.homeAwayMismatches}`);
  console.log(`Invalid team identities:         ${report.invalidTeamIdentities}`);
  console.log(`Negative values:                 ${report.negativeValues}`);
  console.log(`Fractional values:               ${report.fractionalValues}`);
  console.log(`Final-status violations:         ${report.finalStatusViolations}`);
  console.log(`Reconciliation statuses:         ${JSON.stringify(report.reconciliationStatusDistribution)}`);
  console.log(`Violations:                      ${report.violations.length}`);

  if (report.violations.length > 0) {
    console.log("\n--- Violations ---");
    for (const violation of report.violations) {
      console.log(`[${violation.code}] ${violation.gameId}${violation.teamId ? `/${violation.teamId}` : ""}: ${violation.detail}`);
    }
  }

  const artifactDir = path.join(process.cwd(), "artifacts", "team-games");
  mkdirSync(artifactDir, { recursive: true });
  const artifactPath = path.join(artifactDir, `h51-team-game-reconciliation-${season}.json`);
  writeFileSync(artifactPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nArtifact written: ${artifactPath}`);

  if (report.violations.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("[h51-team-game-audit] Fatal:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
