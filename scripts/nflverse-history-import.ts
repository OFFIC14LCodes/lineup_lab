#!/usr/bin/env tsx
/**
 * H1 — nflverse Historical Stats Import (Operational CLI)
 *
 * Invokes runNflversePipeline() directly. Mode and season are resolved from
 * CLI arguments first, then environment variables, then defaults.
 *
 * Usage:
 *   npm run import:nflverse-history                          # dry run, season=2025
 *   npm run import:nflverse-history -- --season=2024        # dry run, season=2024
 *   npm run import:nflverse-history -- --execute            # execute, season=2025
 *   npm run import:nflverse-history -- --season=2024 --execute
 *
 * Environment variable fallbacks (lower precedence than CLI flags):
 *   NFLVERSE_SEASON=2024
 *   NFLVERSE_EXECUTE=true
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { parseMode, parseSeason } from "../src/lib/providers/nflverse/import-cli-options";
import { runNflversePipeline } from "../src/lib/providers/nflverse/pipeline";

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
    console.info("=== EXECUTE MODE: Canonical weekly stats will be written ===");
  } else {
    console.info("=== DRY RUN MODE: No canonical writes ===");
  }
  console.info(`Season: ${season}\n`);

  const report = await runNflversePipeline({ season, mode, projectRoot }, adminClient);

  if (!report.schemaValid) {
    console.error(
      `Schema validation failed. Missing columns: ${report.missingColumns.join(", ")}`
    );
    process.exitCode = 1;
    return;
  }

  const { coverage } = report;
  const resolvedPct =
    coverage.regularSeasonRows > 0
      ? ((coverage.resolvedRows / coverage.regularSeasonRows) * 100).toFixed(1)
      : "0.0";

  // Status banner — must print before exit code is set so partial failure is visible.
  const statusLabel =
    report.pipelineStatus === "success"
      ? "SUCCESS"
      : report.pipelineStatus === "partial_failure"
        ? "PARTIAL FAILURE"
        : "FAILURE";

  const lines = [
    `=== nflverse H1 Import Report — ${statusLabel} ===`,
    `Season:          ${report.season}`,
    `Mode:            ${report.mode}`,
    `Source:          ${report.sourceUrl}`,
    `Archive:         ${report.filePath}`,
    `SHA-256:         ${report.sha256}`,
    `Already cached:  ${report.alreadyArchived}`,
    `Schema valid:    ${report.schemaValid}`,
    "",
    "--- Coverage ---",
    `Total CSV rows:       ${coverage.totalSourceRows}`,
    `QB/RB/WR/TE rows:     ${coverage.filteredPositionRows}`,
    `Regular season rows:  ${coverage.regularSeasonRows}`,
    `Resolved (GSIS map):  ${coverage.resolvedRows} (${resolvedPct}%)`,
    `Unresolved:           ${coverage.unresolvedRows}`,
    `Rejected/error:       ${coverage.rejectedRows}`,
    `Existing (skipped):   ${coverage.existingRows}`,
    `Inserted this run:    ${coverage.insertedRows}`,
    `Total written:        ${coverage.writtenRows}`,
    `Write errors:         ${coverage.errorRows}`,
    "",
    "--- By Position ---"
  ];

  for (const [pos, counts] of Object.entries(coverage.coverageByPosition).sort()) {
    const total = counts.resolved + counts.unresolved;
    const pct = total > 0 ? ((counts.resolved / total) * 100).toFixed(1) : "0.0";
    lines.push(`  ${pos}: ${counts.resolved}/${total} resolved (${pct}%)`);
  }

  lines.push(
    "",
    `Unique GSIS IDs:      ${coverage.uniqueGsisIds}`,
    `  Resolved:           ${coverage.resolvedGsisIds}`,
    `  Unresolved:         ${coverage.unresolvedGsisIds}`,
    "",
    `Duration:             ${report.durationMs}ms`,
    `Completed:            ${report.completedAt}`,
    ""
  );

  if (mode === "dry_run") {
    lines.push(
      "DRY RUN — no data written to Supabase.",
      "Re-run with --execute to write resolved rows.",
      ""
    );
  } else {
    lines.push(`Batch ID: ${report.batchId ?? "none"}`, "");
    if (report.pipelineStatus === "partial_failure") {
      lines.push(
        `⚠  PARTIAL FAILURE: ${coverage.errorRows} rows failed. Re-run with --execute to resume.`,
        ""
      );
    } else if (report.pipelineStatus === "failure") {
      lines.push("✗  FAILURE: No rows were written. Check errors above.", "");
    }
  }

  lines.forEach((l) => console.info(l));

  if (report.pipelineStatus === "partial_failure" || report.pipelineStatus === "failure") {
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
