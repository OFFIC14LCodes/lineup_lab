#!/usr/bin/env tsx
/**
 * GSIS Identity Validate — Phase H1.5
 * Always dry run. Downloads players.csv, validates schema, resolves identities,
 * and reports coverage without writing anything to the database.
 *
 * Usage:
 *   npm run validate:gsis-identities
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { runGsisBootstrap } from "../src/lib/providers/nflverse/players/bootstrap";

loadLocalEnv();

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!url || !serviceRoleKey) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  console.error("Set them in .env.local before running this script.");
  process.exit(1);
}

const adminClient = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const report = await runGsisBootstrap(
    { projectRoot: process.cwd(), mode: "dry_run" },
    adminClient
  );

  if (!report.schemaValid) {
    console.error(`\nSchema validation FAILED. Missing columns: ${report.missingColumns.join(", ")}`);
    process.exit(1);
  }

  const { coverage } = report;
  const readyTotal = coverage.readyViaGsisId + coverage.readyViaEspnId;
  const totalResolvable = coverage.existingMappings + readyTotal;

  console.info(
    [
      "",
      "=== GSIS Identity Validate (dry run) ===",
      `Source URL:          ${report.sourceUrl}`,
      `SHA-256:             ${report.sha256}`,
      `Already cached:      ${report.alreadyArchived}`,
      `Schema valid:        ${report.schemaValid}`,
      "",
      `Total source rows:   ${coverage.totalSourceRows}`,
      `Rejected:            ${coverage.rejectedRows}  (team-defense / blank gsis_id)`,
      `Existing mappings:   ${coverage.existingMappings}  (already in player_external_ids)`,
      `Ready (gsis_id):     ${coverage.readyViaGsisId}`,
      `Ready (espn_id):     ${coverage.readyViaEspnId}`,
      `Ready total:         ${readyTotal}`,
      `Total resolvable:    ${totalResolvable}`,
      `Conflict:            ${coverage.conflictRows}`,
      `Manual review:       ${coverage.manualReviewRows}`,
      `Unresolved:          ${coverage.unresolvedRows}`,
      `Duration:            ${report.durationMs}ms`,
      "",
      readyTotal > 0
        ? `Run 'npm run bootstrap:gsis-identities -- --execute' to write ${readyTotal} ready mapping(s).`
        : "No new mappings to write.",
      ""
    ].join("\n")
  );
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
