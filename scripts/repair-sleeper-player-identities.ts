#!/usr/bin/env tsx
/**
 * H1.6 — Hardened Sleeper Player Identity Repair
 *
 * Reads the diagnose report from data/diagnostic/unresolved-2025-identities.json,
 * then applies (or previews) safe metadata_json patches to canonical players.
 *
 * Tier enforcement (enforced in buildRepairDecision):
 *   auto_approved          → written in execute mode
 *   high_confidence_review → written only if GSIS ID in --review-list artifact
 *   conflict               → NEVER written (contradictory biographical data)
 *   ambiguous / rejected   → NEVER written
 *
 * Safety constraints (enforced in buildRepairDecision):
 *   - Unique canonical candidate required (candidateCount === 1)
 *   - Sleeper ID on canonical required
 *   - Position must be compatible
 *   - No team-defense (DEF/DST) entities
 *   - Will not silently overwrite a different existing gsis_id or espn_id
 *   - Conflicting player_external_ids mapping blocks repair
 *   - Idempotent: already-patched records skipped, not double-applied
 *   - Dry run never writes to Supabase
 *
 * Usage:
 *   npm run repair:sleeper-player-identities                          # dry run (auto_approved only)
 *   npm run repair:sleeper-player-identities -- --execute            # write auto_approved
 *   npm run repair:sleeper-player-identities -- --review-list=<path> # dry run, include approved review list
 *   npm run repair:sleeper-player-identities -- --execute --review-list=<path>  # write auto + approved review
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { repairSleeperPlayerIdentities } from "../src/lib/providers/nflverse/identities/repair";
import type { DiagnoseReport, RepairMode } from "../src/lib/providers/nflverse/identities/types";

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
  const season = parseInt(process.env["NFLVERSE_SEASON"] ?? "2025", 10);
  const execute = process.argv.includes("--execute");
  const mode: RepairMode = execute ? "execute" : "dry_run";

  // Optional: --review-list=<path> specifies a JSON file with approved review GSIS IDs
  const reviewListArg = process.argv.find((a) => a.startsWith("--review-list="));
  let approvedReviewIds: Set<string> | undefined;
  if (reviewListArg) {
    const listPath = reviewListArg.split("=")[1]!;
    if (!existsSync(listPath)) {
      console.error(`ERROR: Review list file not found: ${listPath}`);
      process.exit(1);
    }
    const listData = JSON.parse(readFileSync(listPath, "utf8")) as string[];
    if (!Array.isArray(listData)) {
      console.error("ERROR: Review list must be a JSON array of GSIS ID strings.");
      process.exit(1);
    }
    approvedReviewIds = new Set(listData);
    console.info(`Review list loaded: ${approvedReviewIds.size} approved IDs from ${listPath}`);
  }

  const diagPath = path.join(projectRoot, "data", "diagnostic", "unresolved-2025-identities.json");

  if (!existsSync(diagPath)) {
    console.error(`ERROR: Diagnose report not found at:\n  ${diagPath}`);
    console.error("Run 'npm run diagnose:2025-identities' first.");
    process.exit(1);
  }

  const diagnoseReport = JSON.parse(readFileSync(diagPath, "utf8")) as DiagnoseReport;

  // Summarize the diagnose report's tier distribution
  const tc = diagnoseReport.tierCounts ?? { autoApproved: 0, highConfidenceReview: 0, ambiguous: 0, conflict: 0, rejected: 0 };

  console.info([
    "",
    `=== H1.6 Sleeper Player Identity Repair (Hardened) — Season ${season} ===`,
    `Mode: ${mode === "execute" ? "EXECUTE (will write to Supabase)" : "DRY RUN (no writes)"}`,
    `Repair candidates loaded from: ${diagPath}`,
    `Total unresolved in report: ${diagnoseReport.totalUnresolved}`,
    "",
    "--- Diagnose Tier Summary ---",
    `  auto_approved:          ${tc.autoApproved}  (safe to write)`,
    `  high_confidence_review: ${tc.highConfidenceReview}  (requires explicit --review-list)`,
    `  conflict:               ${tc.conflict}  (NEVER written — contradictory data)`,
    `  ambiguous:              ${tc.ambiguous}  (NEVER written)`,
    `  rejected:               ${tc.rejected}  (NEVER written)`,
    approvedReviewIds ? `  approved via review list: ${approvedReviewIds.size}` : "  review list: none",
    ""
  ].join("\n"));

  const report = await repairSleeperPlayerIdentities(
    { mode, projectRoot, season, approvedReviewIds },
    diagnoseReport,
    adminClient
  );

  // ── Console summary ────────────────────────────────────────────────────────
  console.info([
    "--- Repair Summary ---",
    `  Mode:                    ${report.mode}`,
    `  Total decisions:         ${report.totalCandidates}`,
    `  Auto-approved repairs:   ${report.autoApprovedRepairs}`,
    `  Review-approved repairs: ${report.reviewApprovedRepairs}`,
    `  GSIS ID repairs:         ${report.gsisIdRepairs}`,
    `  ESPN ID repairs:         ${report.espnIdRepairs}`,
    `  Skipped (other):         ${report.skipped}`,
    `  Skipped (pending review):${report.skippedPendingReview}`,
    `  Skipped (hard block):    ${report.skippedBlocked}`,
    `  Conflict (not writable): ${report.conflicts}`,
    `  Errors:                  ${report.errors}`,
    `  Duration:                ${report.durationMs}ms`,
    ""
  ].join("\n"));

  // Print decisions with tier annotation
  console.info("--- Decisions ---");
  for (const d of report.decisions) {
    const status = d.decision === "repair" ? "[REPAIR]" : "[SKIP  ]";
    const tier = d.confidenceTier ? ` {${d.confidenceTier}}` : "";
    const reason = d.decision === "skip" ? ` (${d.skipReason ?? "unknown"})` : "";
    console.info(
      `  ${status}${tier} ${d.gsisId}  ${d.nflverseName.padEnd(26)} ${(d.nflversePosition ?? "?").padEnd(4)} ` +
      `${d.repairType}=${d.newValue}${reason}`
    );
  }

  if (report.conflicts > 0) {
    console.info(`\nNOTE: ${report.conflicts} conflict(s) blocked (contradictory biographical data — manual investigation required).`);
  }
  if (report.skippedPendingReview > 0) {
    console.info(`NOTE: ${report.skippedPendingReview} candidate(s) pending review. Pass --review-list=<path> to approve specific GSIS IDs.`);
  }
  if (report.errors > 0) {
    console.error(`\nERROR: ${report.errors} error(s) occurred during execution.`);
  }

  // ── Persist report ────────────────────────────────────────────────────────
  const diagDir = path.join(projectRoot, "data", "diagnostic");
  mkdirSync(diagDir, { recursive: true });

  const suffix = mode === "execute" ? "executed" : "dry-run";
  const reportPath = path.join(diagDir, `repair-sleeper-player-identities-${suffix}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.info(`\nFull repair report → ${reportPath}`);

  if (mode === "dry_run") {
    console.info([
      "\n[DRY RUN] No changes written.",
      "  To write auto_approved repairs: pass --execute",
      "  To include review candidates: pass --review-list=<json-array-of-gsis-ids>"
    ].join("\n"));
  } else {
    const total = report.autoApprovedRepairs + report.reviewApprovedRepairs;
    console.info(`\n[EXECUTE] ${total} metadata patches applied.`);
  }
  console.info("");
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
