#!/usr/bin/env tsx
/**
 * H1.6 — Targeted 2025 GSIS Identity Diagnosis (Hardened)
 *
 * Joins the unresolved 2025 QB/RB/WR/TE players against:
 *   - nflverse players.csv
 *   - Blackbird canonical players (paginated)
 *   - player_external_ids
 *   - canonical metadata_json
 *
 * For each canonical_gsis_missing player with a unique candidate, runs
 * biographical evidence comparison and classifies into a confidence tier:
 *   auto_approved          — birth date or ESPN ID match (or 2+ medium bio signals)
 *   high_confidence_review — name+position or single medium signal only
 *   conflict               — contradictory biographical data (birth date/ESPN mismatch)
 *   ambiguous / rejected   — other hard blocks
 *
 * Writes full diagnostic reports (including evidence comparison) to:
 *   data/diagnostic/unresolved-2025-identities.json
 *   data/diagnostic/unresolved-2025-identities.csv
 *
 * Usage:
 *   npm run diagnose:2025-identities
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { diagnose2025Identities } from "../src/lib/providers/nflverse/identities/diagnose";
import type { UnresolvedRootCause } from "../src/lib/providers/nflverse/identities/types";

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

  console.info(`\n=== H1.6 Identity Diagnosis (Hardened) — Season ${season} ===\n`);
  console.info("Loading data sources (this may take 10–30s for 12k canonical players)...");

  const report = await diagnose2025Identities({ season, projectRoot }, adminClient);

  // ── Root cause summary ─────────────────────────────────────────────────────
  console.info([
    "",
    `Total unresolved 2025 GSIS IDs:  ${report.totalUnresolved}`,
    "",
    "--- Root Cause Breakdown ---"
  ].join("\n"));

  const CAUSE_LABELS: Record<UnresolvedRootCause, string> = {
    canonical_player_missing:          "canonical_player_missing          (not in Blackbird DB at all)",
    canonical_gsis_missing:            "canonical_gsis_missing            (in DB, meta.gsis_id null)",
    canonical_espn_missing:            "canonical_espn_missing            (in DB, meta.espn_id mismatched)",
    source_identifier_missing:         "source_identifier_missing         (nflverse has no espn_id)",
    identifier_format_mismatch:        "identifier_format_mismatch        (ID present but doesn't match)",
    duplicate_canonical_candidate:     "duplicate_canonical_candidate     (multiple name+pos matches)",
    conflicting_external_mapping:      "conflicting_external_mapping      (conflicting player_external_ids row)",
    position_mismatch:                 "position_mismatch                 (name matches but pos incompatible)",
    legacy_or_duplicate_source_identity: "legacy_or_duplicate_source_identity (legacy GSIS format)",
    unknown:                           "unknown"
  };

  for (const [cause, label] of Object.entries(CAUSE_LABELS) as [UnresolvedRootCause, string][]) {
    const count = report.rootCauseCounts[cause];
    if (count > 0) console.info(`  ${label}: ${count}`);
  }

  // ── Evidence tier breakdown ────────────────────────────────────────────────
  const { tierCounts } = report;
  const totalEvidenced = tierCounts.autoApproved + tierCounts.highConfidenceReview + tierCounts.ambiguous + tierCounts.conflict + tierCounts.rejected;
  console.info([
    "",
    "--- Evidence Tier Breakdown (canonical_gsis_missing with unique candidate) ---",
    `  auto_approved:          ${tierCounts.autoApproved.toString().padStart(4)}  (${report.autoApprovedRows} weekly rows)`,
    `  high_confidence_review: ${tierCounts.highConfidenceReview.toString().padStart(4)}  (${report.reviewRows} weekly rows)`,
    `  conflict:               ${tierCounts.conflict.toString().padStart(4)}  (${report.conflictRows} weekly rows)`,
    `  ambiguous:              ${tierCounts.ambiguous.toString().padStart(4)}`,
    `  rejected:               ${tierCounts.rejected.toString().padStart(4)}`,
    `  total evidenced:        ${totalEvidenced.toString().padStart(4)}`,
    ""
  ].join("\n"));

  // ── Post-repair projections ────────────────────────────────────────────────
  const alreadyResolvedIds = 211;
  const alreadyResolvedRows = 2107;
  const totalUniqueGsisIds = 616;
  const totalWeeklyRows = 6102;
  const afterAutoIds = alreadyResolvedIds + tierCounts.autoApproved;
  const afterAutoRows = alreadyResolvedRows + report.autoApprovedRows;
  const afterAllReviewIds = afterAutoIds + tierCounts.highConfidenceReview;
  const afterAllReviewRows = afterAutoRows + report.reviewRows;

  console.info([
    "--- Post-Repair Coverage Projections ---",
    `  After auto-approved repairs:`,
    `    Unique IDs: ${afterAutoIds}/${totalUniqueGsisIds} (${(100 * afterAutoIds / totalUniqueGsisIds).toFixed(1)}%)`,
    `    Weekly rows: ${afterAutoRows}/${totalWeeklyRows} (${(100 * afterAutoRows / totalWeeklyRows).toFixed(1)}%)`,
    `  After auto + all review approved:`,
    `    Unique IDs: ${afterAllReviewIds}/${totalUniqueGsisIds} (${(100 * afterAllReviewIds / totalUniqueGsisIds).toFixed(1)}%)`,
    `    Weekly rows: ${afterAllReviewRows}/${totalWeeklyRows} (${(100 * afterAllReviewRows / totalWeeklyRows).toFixed(1)}%)`,
    ""
  ].join("\n"));

  // ── By position ────────────────────────────────────────────────────────────
  console.info("--- By Position ---");
  for (const [pos, causeCounts] of Object.entries(report.byPosition)) {
    const total = Object.values(causeCounts).reduce((a, b) => a + (b ?? 0), 0);
    console.info(`  ${pos.padEnd(4)} — ${total} unresolved`);
    for (const [cause, count] of Object.entries(causeCounts)) {
      if (count && count > 0) console.info(`         ${cause}: ${count}`);
    }
  }

  // ── Conflict players ───────────────────────────────────────────────────────
  const conflictPlayers = report.players.filter((p) => p.confidenceTier === "conflict");
  if (conflictPlayers.length > 0) {
    console.info([
      "",
      `--- Conflict Players (${conflictPlayers.length} — require manual investigation) ---`
    ].join("\n"));
    for (const p of conflictPlayers) {
      console.info(
        `  ${p.gsisId}  ${p.nflverseName.padEnd(28)} rows=${p.weeklyRowCount.toString().padStart(2)} ` +
        `reason=${p.approvalReason}`
      );
      if (p.evidence?.contradictions) {
        for (const c of p.evidence.contradictions) {
          console.info(`    CONFLICT: ${c.field}: nflverse="${c.sourceValue}" canonical="${c.canonicalValue}"`);
        }
      }
    }
  }

  // ── Review players ─────────────────────────────────────────────────────────
  const reviewPlayers = report.players.filter((p) => p.confidenceTier === "high_confidence_review");
  if (reviewPlayers.length > 0) {
    console.info([
      "",
      `--- Review Players (${reviewPlayers.length} — name+position only, require explicit approval) ---`
    ].join("\n"));
    for (const p of reviewPlayers.slice(0, 10)) {
      console.info(
        `  ${p.gsisId}  ${p.nflverseName.padEnd(28)} rows=${p.weeklyRowCount.toString().padStart(2)} ` +
        `reason=${p.approvalReason}`
      );
    }
    if (reviewPlayers.length > 10) {
      console.info(`  ... and ${reviewPlayers.length - 10} more (see JSON report)`);
    }
  }

  // ── Top 20 unresolved ──────────────────────────────────────────────────────
  console.info([
    "",
    "--- Top 20 Unresolved by Weekly Row Count ---"
  ].join("\n"));
  for (const p of report.players.slice(0, 20)) {
    const tier = p.confidenceTier ? ` [${p.confidenceTier}]` : "";
    console.info(
      `  ${p.gsisId}  ${p.nflverseName.padEnd(30)} ${(p.nflversePositionGroup ?? "?").padEnd(4)} ` +
      `${(p.nflverseTeam ?? "??").padEnd(4)} rows=${p.weeklyRowCount.toString().padStart(2)} ` +
      `cause=${p.rootCause}${tier}`
    );
  }

  // ── Write artifacts ────────────────────────────────────────────────────────
  const diagDir = path.join(projectRoot, "data", "diagnostic");
  mkdirSync(diagDir, { recursive: true });

  const jsonPath = path.join(diagDir, "unresolved-2025-identities.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  console.info(`\nFull report → ${jsonPath}`);

  const csvHeaders = [
    "gsis_id", "nflverse_name", "position", "team", "espn_id",
    "weekly_rows", "root_cause", "candidate_count",
    "canonical_id", "canonical_name", "canonical_sleeper_id",
    "canonical_meta_gsis_id", "canonical_meta_espn_id",
    "canonical_team", "canonical_position",
    "confidence_tier", "approval_reason",
    "nflverse_birth_date", "canonical_birth_date",
    "nflverse_college", "canonical_college",
    "nflverse_height", "canonical_height",
    "nflverse_weight", "canonical_weight",
    "nflverse_rookie_season", "canonical_rookie_year",
    "nflverse_draft_year", "nflverse_draft_round", "nflverse_draft_pick",
    "strong_matches", "medium_matches", "contradictions",
    "nflverse_birth_date_raw", "nflverse_college_raw", "nflverse_suffix"
  ];
  const csvRows = report.players.map((p) => [
    p.gsisId, p.nflverseName, p.nflversePositionGroup ?? "", p.nflverseTeam ?? "",
    p.nflverseEspnId ?? "", p.weeklyRowCount, p.rootCause, p.candidateCount,
    p.canonicalPlayerId ?? "", p.canonicalName ?? "", p.canonicalSleeperPlayerId ?? "",
    p.canonicalMetaGsisId ?? "", p.canonicalMetaEspnId ?? "",
    p.canonicalTeam ?? "", p.canonicalPositionGroup ?? "",
    p.confidenceTier ?? "", p.approvalReason ?? "",
    p.nflverseBirthDate ?? "", p.canonicalBirthDate ?? "",
    p.nflverseCollege ?? "", p.canonicalCollege ?? "",
    p.nflverseHeight ?? "", p.canonicalHeight ?? "",
    p.nflverseWeight ?? "", p.canonicalWeight ?? "",
    p.nflverseRookieSeason ?? "", p.canonicalRookieYear ?? "",
    p.nflverseDraftYear ?? "", p.nflverseDraftRound ?? "", p.nflverseDraftPick ?? "",
    p.evidence?.strongMatches.map((s) => s.field).join("|") ?? "",
    p.evidence?.mediumMatches.map((m) => m.field).join("|") ?? "",
    p.evidence?.contradictions.map((c) => c.field).join("|") ?? "",
    p.nflverseBirthDate ?? "", p.nflverseCollege ?? "", p.nflverseSuffix ?? ""
  ].map(String));

  const csvContent = [csvHeaders.join(","), ...csvRows.map((r) => r.map(csvEscape).join(","))].join("\n");
  const csvPath = path.join(diagDir, "unresolved-2025-identities.csv");
  writeFileSync(csvPath, csvContent, "utf8");
  console.info(`CSV report   → ${csvPath}\n`);
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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
