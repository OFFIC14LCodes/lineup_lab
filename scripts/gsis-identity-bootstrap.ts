#!/usr/bin/env tsx
/**
 * GSIS Identity Bootstrap — Phase H1.5
 *
 * Dry run (default):
 *   npm run bootstrap:gsis-identities
 *
 * Execute (write player_external_ids rows):
 *   npm run bootstrap:gsis-identities -- --execute
 *
 * SECURITY: Never creates canonical players. Never maps by name alone.
 * Never maps team-defense entities. Dry run never writes to Supabase.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { runGsisBootstrap } from "../src/lib/providers/nflverse/players/bootstrap";
import type { GsisBootstrapMode } from "../src/lib/providers/nflverse/players/types";

loadLocalEnv();

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!url || !serviceRoleKey) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  console.error("Set them in .env.local before running this script.");
  process.exit(1);
}

const isExecute = process.argv.includes("--execute");
const mode: GsisBootstrapMode = isExecute ? "execute" : "dry_run";

if (isExecute) {
  console.warn("\n=== EXECUTE MODE: Will write to player_external_ids ===\n");
} else {
  console.info("\n=== DRY RUN MODE: No writes will occur ===\n");
}

const adminClient = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const report = await runGsisBootstrap({ projectRoot: process.cwd(), mode }, adminClient);

  if (!report.schemaValid) {
    console.error(`\nSchema validation FAILED. Missing columns: ${report.missingColumns.join(", ")}`);
    process.exit(1);
  }

  const { coverage } = report;
  const readyTotal = coverage.readyViaGsisId + coverage.readyViaEspnId;

  const lines = [
    "",
    `=== GSIS Identity Bootstrap Report (${mode}) ===`,
    `Source URL:          ${report.sourceUrl}`,
    `Archive path:        ${report.filePath}`,
    `SHA-256:             ${report.sha256}`,
    `Already cached:      ${report.alreadyArchived}`,
    `Schema valid:        ${report.schemaValid}`,
    "",
    "--- Coverage ---",
    `Total source rows:   ${coverage.totalSourceRows}`,
    `Rejected:            ${coverage.rejectedRows}  (team-defense / blank gsis_id)`,
    `Existing mappings:   ${coverage.existingMappings}  (already in player_external_ids)`,
    `Ready (gsis_id):     ${coverage.readyViaGsisId}  (metadata_json.gsis_id direct bridge)`,
    `Ready (espn_id):     ${coverage.readyViaEspnId}  (ESPN ID bridge)`,
    `Ready total:         ${readyTotal}`,
    `Conflict:            ${coverage.conflictRows}  (bridges disagree — manual resolution needed)`,
    `Manual review:       ${coverage.manualReviewRows}  (name-only candidate — not auto-mapped)`,
    `Unresolved:          ${coverage.unresolvedRows}`,
    ""
  ];

  if (mode === "execute") {
    lines.push(`Written:             ${coverage.writtenRows}`);
    if (coverage.errorRows > 0) {
      lines.push(`Errors:              ${coverage.errorRows}`);
    }
    lines.push("");
  }

  lines.push(`Duration:            ${report.durationMs}ms`, `Completed:           ${report.completedAt}`, "");

  console.info(lines.join("\n"));

  if (report.manualReviewList.length > 0) {
    const show = report.manualReviewList.slice(0, 50);
    console.info(`--- Manual Review List (${report.manualReviewList.length} players — not auto-mapped) ---`);
    for (const player of show) {
      console.info(`  ${player.gsisId}  ${player.displayName.padEnd(30)}  [${player.positionGroup ?? "?"}]`);
    }
    if (report.manualReviewList.length > 50) {
      console.info(`  ... and ${report.manualReviewList.length - 50} more`);
    }
    console.info("");
  }

  if (mode === "dry_run") {
    const ready = readyTotal;
    console.info(`Run with --execute to write ${ready} ready mapping(s) to player_external_ids.`);
    console.info("");
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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
