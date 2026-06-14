import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

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

import { runTeamGamePipeline } from "@/lib/providers/nflverse/team-games/pipeline";
import type { TeamGamePipelineMode } from "@/lib/providers/nflverse/team-games/types";

// ---------------------------------------------------------------------------
// CLI arguments
// ---------------------------------------------------------------------------

function parseArgs(): { season: number; mode: TeamGamePipelineMode } {
  const args = process.argv.slice(2);
  let season = new Date().getFullYear();
  let mode: TeamGamePipelineMode = "dry_run";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--season" && args[i + 1]) {
      season = parseInt(args[++i]!, 10);
    } else if (args[i] === "--mode" && args[i + 1]) {
      const raw = args[++i]!;
      if (raw !== "dry_run" && raw !== "execute") {
        console.error(`Invalid --mode: ${raw}. Must be "dry_run" or "execute".`);
        process.exit(1);
      }
      mode = raw;
    }
  }

  if (!Number.isFinite(season) || season < 2000 || season > 2100) {
    console.error(`Invalid --season: ${season}`);
    process.exit(1);
  }

  return { season, mode };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { season, mode } = parseArgs();

  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const supabaseKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const adminClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const projectRoot = path.resolve(__dirname, "..");

  console.log(`[team-games-import] season=${season} mode=${mode}`);
  if (mode === "dry_run") {
    console.log("[team-games-import] DRY RUN — no data will be written to Supabase");
  }

  const report = await runTeamGamePipeline({ season, mode, projectRoot }, adminClient);

  // ---------------------------------------------------------------------------
  // Print summary
  // ---------------------------------------------------------------------------
  console.log("\n=== Team Game Import Report ===");
  console.log(`Status:         ${report.pipelineStatus}`);
  console.log(`Mode:           ${report.mode}`);
  console.log(`Season:         ${report.season}`);
  console.log(`Duration:       ${report.durationMs}ms`);
  console.log(`Schedules:      ${report.schedulesFilePath} (sha256: ${report.schedulesSha256.slice(0, 12)}...)`);
  console.log(`PBP:            ${report.pbpFilePath ?? "not loaded"}`);
  console.log("\n--- Coverage ---");
  const c = report.coverage;
  console.log(`Schedule rows:  ${c.totalScheduleRows} total, ${c.filteredGames} filtered REG games`);
  console.log(`Skipped:        ${c.skippedNonReg} non-REG, ${c.skippedNoScore} no-score, ${c.skippedBadTeam} bad-team`);
  console.log(`Team-game rows: ${c.rowsDerived} derived, ${c.rowsExisting} existing`);
  console.log(`Comparison:     ${c.exactSemanticMatches} exact, ${c.semanticDifferences} different, ${c.rowsMissing} missing, ${c.rowsUnexpected} unexpected`);
  console.log(`Actions:        ${c.rowsInserted} insert, ${c.rowsUpdated} update, ${c.rowsUnchanged} unchanged, ${c.rowsConflicted} conflicted`);
  console.log(`Writes:         ${c.writeAttempts} attempts, ${c.writeErrors} errors`);
  console.log(`PBP games:      ${c.pbpGamesFound} found, ${c.pbpGamesMissing} missing yards`);

  if (report.invariantViolations.length > 0) {
    console.log("\n--- Invariant Violations ---");
    for (const v of report.invariantViolations) {
      console.log(`  [${v.gameId}] ${v.violation}`);
    }
  }

  if (report.writeResults.some((r) => r.writeStatus === "error")) {
    console.log("\n--- Write Errors ---");
    for (const r of report.writeResults.filter((r) => r.writeStatus === "error")) {
      console.log(`  ${r.teamId} / ${r.gameId}: ${r.errorMessage}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Write artifact
  // ---------------------------------------------------------------------------
  const artifactDir = path.join(projectRoot, "artifacts", "team-games");
  mkdirSync(artifactDir, { recursive: true });
  const artifactPath = path.join(artifactDir, `team-game-import-${season}.json`);
  writeFileSync(artifactPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nArtifact written: ${artifactPath}`);

  // ---------------------------------------------------------------------------
  // Exit code
  // ---------------------------------------------------------------------------
  if (report.pipelineStatus === "failure" || report.pipelineStatus === "schema_error") {
    console.error("\n[team-games-import] Pipeline FAILED");
    process.exit(1);
  }

  if (report.pipelineStatus === "partial_failure") {
    console.warn("\n[team-games-import] Pipeline completed with warnings (partial_failure)");
    process.exit(0);
  }

  console.log("\n[team-games-import] Done.");
}

main().catch((err) => {
  console.error("[team-games-import] Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
