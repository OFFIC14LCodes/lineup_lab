#!/usr/bin/env tsx
/**
 * H2 — nflverse Play-by-Play Derived Stats Import
 *
 * Downloads the nflverse PBP gzip for the target season, derives long-TD and
 * pick-six stats, resolves GSIS IDs, and upserts into player_weekly_derived_stats.
 *
 * Usage:
 *   npm run import:nflverse-pbp-derived                      # dry run, season=2025
 *   npm run import:nflverse-pbp-derived -- --season=2024     # dry run, season=2024
 *   npm run import:nflverse-pbp-derived -- --execute         # execute, season=2025
 *   npm run import:nflverse-pbp-derived -- --season=2024 --execute
 *
 * Environment variable fallbacks:
 *   NFLVERSE_PBP_SEASON=2024
 *   NFLVERSE_PBP_EXECUTE=true
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { parseMode, parseSeason } from "../src/lib/providers/nflverse/pbp/import-cli-options";
import { runPbpDerivedPipeline } from "../src/lib/providers/nflverse/pbp/pipeline";

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
  const mode = parseMode(process.argv, process.env);

  if (mode === "execute") {
    console.info("=== EXECUTE MODE: Derived stats will be written to player_weekly_derived_stats ===");
  } else {
    console.info("=== DRY RUN MODE: No writes to Supabase ===");
  }
  console.info(`Season: ${season}\n`);

  const report = await runPbpDerivedPipeline({ season, mode, projectRoot }, adminClient);

  if (!report.schemaValid) {
    console.error(`Schema validation failed. Missing columns: ${report.missingColumns.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const { coverage } = report;

  const statusLabel =
    report.pipelineStatus === "success"
      ? "SUCCESS"
      : report.pipelineStatus === "partial_failure"
        ? "PARTIAL FAILURE"
        : "FAILURE";

  const resolvedPct =
    coverage.totalPlayerWeeks > 0
      ? ((coverage.resolvedPlayerWeeks / coverage.totalPlayerWeeks) * 100).toFixed(1)
      : "0.0";

  const lines = [
    `=== nflverse H2 PBP Derived Import Report — ${statusLabel} ===`,
    `Season:               ${report.season}`,
    `Mode:                 ${report.mode}`,
    `Source:               ${report.sourceUrl}`,
    `Archive:              ${report.filePath}`,
    `SHA-256:              ${report.sha256}`,
    `Already cached:       ${report.alreadyArchived}`,
    `Schema valid:         ${report.schemaValid}`,
    "",
    "--- Play Coverage ---",
    `Total source plays:   ${coverage.totalSourcePlays}`,
    `Regular season plays: ${coverage.regularSeasonPlays}`,
    `Excluded plays:       ${coverage.excludedPlays}`,
    `Unresolved plays:     ${coverage.unresolvedPlays}`,
    "",
    "--- fum_ret_td Audit ---",
    `Candidate plays:      ${coverage.fumRetTdCandidatePlays}`,
    `Qualified plays:      ${coverage.fumRetTdQualifiedPlays}`,
    `Ambiguous plays:      ${coverage.fumRetTdAmbiguousPlays}`,
    `Excluded plays:       ${coverage.fumRetTdExcludedPlays}`,
    "",
    "--- Player-Week Results ---",
    `Total player-weeks:   ${coverage.totalPlayerWeeks}`,
    `Resolved:             ${coverage.resolvedPlayerWeeks} (${resolvedPct}%)`,
    `Unresolved:           ${coverage.unresolvedPlayerWeeks}`,
    `Existing (skipped):   ${coverage.existingPlayerWeeks}`,
    `Written this run:     ${coverage.writtenPlayerWeeks}`,
    `Write errors:         ${coverage.errorPlayerWeeks}`,
    "",
    "--- fum_ret_td Player-Weeks ---",
    `Resolved player-weeks:${coverage.fumRetTdResolvedPlayerWeeks}`,
    `Unresolved player-weeks: ${coverage.fumRetTdUnresolvedPlayerWeeks}`,
    `Written rows:         ${coverage.fumRetTdWrittenRows}`,
    `Existing rows:        ${coverage.fumRetTdExistingRows}`,
    `Failed rows:          ${coverage.fumRetTdFailedRows}`,
    "",
    "--- GSIS Identity ---",
    `Unique GSIS IDs:      ${coverage.uniqueGsisIds}`,
    `  Resolved:           ${coverage.resolvedGsisIds}`,
    `  Unresolved:         ${coverage.unresolvedGsisIds}`,
    "",
    "--- Invariants ---",
    `Violations:           ${report.invariantViolations.length}`
  ];

  if (report.invariantViolations.length > 0) {
    for (const v of report.invariantViolations) {
      lines.push(`  ${v.gsisId} week ${v.week}: ${v.rule} — ${JSON.stringify(v.values)}`);
    }
  }

  if (report.fumRetTdExcludedEvents.length > 0) {
    const grouped = new Map<string, number>();
    for (const event of report.fumRetTdExcludedEvents) {
      grouped.set(event.reason, (grouped.get(event.reason) ?? 0) + 1);
    }
    lines.push("", "--- fum_ret_td Exclusion Reasons ---");
    for (const [reason, count] of [...grouped.entries()].sort()) {
      lines.push(`  ${reason}: ${count}`);
    }
  }

  lines.push(
    "",
    `Duration:             ${report.durationMs}ms`,
    `Completed:            ${report.completedAt}`,
    ""
  );

  if (mode === "dry_run") {
    lines.push("DRY RUN — no data written to Supabase.", "Re-run with --execute to write results.", "");
  } else {
    lines.push(`Batch ID: ${report.batchId ?? "none"}`, "");
    if (report.pipelineStatus === "partial_failure") {
      lines.push(`⚠  PARTIAL FAILURE: ${coverage.errorPlayerWeeks} player-weeks failed.`, "");
    } else if (report.pipelineStatus === "failure") {
      lines.push("✗  FAILURE — see violations/errors above.", "");
    } else {
      lines.push("✓  All derived stats written successfully.", "");
    }
  }

  console.info(lines.join("\n"));

  if (report.pipelineStatus !== "success") {
    process.exitCode = 1;
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
