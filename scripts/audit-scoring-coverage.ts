/**
 * Scoring coverage audit CLI — H3 implementation.
 *
 * Usage:
 *   npm run audit:scoring-coverage
 *   npm run audit:scoring-coverage -- --no-artifacts
 *
 * Outputs:
 *   artifacts/scoring/scoring-coverage.json
 *   artifacts/scoring/scoring-coverage.md
 *   stdout: summary table + roadmap + any findings
 *
 * Exit code:
 *   0 — clean audit (no error findings)
 *   1 — one or more error-severity findings detected
 */

import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

// Coverage modules do NOT import server-only; tsconfig path aliases work in tsx.
import { runCoverageAudit } from "@/lib/scoring/coverage/audit";
import { generateJsonReport, generateMarkdownReport } from "@/lib/scoring/coverage/report";
import { SCORING_COVERAGE_REGISTRY } from "@/lib/scoring/coverage/registry";

// ---------------------------------------------------------------------------
// Parse argv
// ---------------------------------------------------------------------------

const writeArtifacts = !process.argv.includes("--no-artifacts");
const projectRoot = resolve(process.cwd());
const artifactsDir = resolve(projectRoot, "artifacts", "scoring");

// ---------------------------------------------------------------------------
// Run audit
// ---------------------------------------------------------------------------

const result = runCoverageAudit();
const errors = result.findings.filter((f) => f.severity === "error");
const warnings = result.findings.filter((f) => f.severity === "warning");

// ---------------------------------------------------------------------------
// Print summary
// ---------------------------------------------------------------------------

console.log("\n══════════════════════════════════════════════════════════════════");
console.log("  Blackbird GM — Scoring Coverage Audit");
console.log("══════════════════════════════════════════════════════════════════");
console.log(`  Audited at  : ${result.auditedAt}`);
console.log(`  Registry    : ${result.totalRegistryKeys} unique scoring keys`);
console.log(`  Engine      : ${result.totalEngineKeys} unique keys in SLEEPER_RULES_BY_KEY`);
console.log("");
console.log("  ── Data status breakdown ──────────────────────────────────────");
for (const [status, count] of Object.entries(result.dataStatusSummary)) {
  if (count === 0) continue;
  const bar = "█".repeat(Math.ceil(count / 2));
  const padded = String(count).padStart(3);
  console.log(`  ${padded}  ${bar.padEnd(16)}  ${status}`);
}
console.log("");
console.log("  ── Family breakdown ───────────────────────────────────────────");
for (const [family, count] of Object.entries(result.familySummary).sort()) {
  if (count === 0) continue;
  console.log(`  ${String(count).padStart(3)}  ${family}`);
}
console.log("");

// ── Operational keys ──────────────────────────────────────────────────────
console.log(`  ── Operational keys (${result.operationalKeys.length}) ──────────────────────────────────`);
const opChunks: string[][] = [];
let chunk: string[] = [];
for (const k of result.operationalKeys) {
  chunk.push(k);
  if (chunk.length === 5) { opChunks.push(chunk); chunk = []; }
}
if (chunk.length > 0) opChunks.push(chunk);
for (const row of opChunks) {
  console.log("  " + row.map((k) => k.padEnd(22)).join(""));
}
console.log("");

// ── Implementation roadmap ────────────────────────────────────────────────
console.log(`  ── Implementation Roadmap (${result.implementationRoadmap.length} data-gap keys) ──────────────`);
for (const r of result.implementationRoadmap) {
  const blocker = r.blockers[0] ?? r.notes ?? "—";
  const truncated = blocker.length > 75 ? blocker.slice(0, 72) + "..." : blocker;
  console.log(`  • ${r.key.padEnd(24)} [${r.dataStatus}]`);
  console.log(`    ${truncated}`);
}
console.log("");

// ── Findings ──────────────────────────────────────────────────────────────
if (result.findings.length === 0) {
  console.log("  ✓ No audit findings — registry is consistent with engine code.");
} else {
  if (errors.length > 0) {
    console.log(`  ✗ ${errors.length} ERROR(S):`);
    for (const f of errors) {
      console.log(`    [${f.type}] ${f.key}: ${f.detail}`);
    }
  }
  if (warnings.length > 0) {
    console.log(`  ! ${warnings.length} WARNING(S):`);
    for (const f of warnings) {
      console.log(`    [${f.type}] ${f.key}: ${f.detail}`);
    }
  }
}
console.log("");

// ── Registry size verification ────────────────────────────────────────────
console.log(`  ── Registry sanity ────────────────────────────────────────────`);
console.log(`  Total registry entries : ${SCORING_COVERAGE_REGISTRY.length}`);
console.log(`  Operational now        : ${result.operationalKeys.length}`);
console.log(`  Current-scope backlog  : ${result.dataGapKeys.length}`);
console.log(`  Deferred current phase : ${result.outOfScopeKeys.length}`);
console.log("");

// ---------------------------------------------------------------------------
// Write artifacts
// ---------------------------------------------------------------------------

if (writeArtifacts) {
  mkdirSync(artifactsDir, { recursive: true });

  const jsonPath = resolve(artifactsDir, "scoring-coverage.json");
  writeFileSync(jsonPath, generateJsonReport(result), "utf-8");
  console.log(`  ✓ JSON artifact written: ${jsonPath}`);

  const mdPath = resolve(artifactsDir, "scoring-coverage.md");
  writeFileSync(mdPath, generateMarkdownReport(result), "utf-8");
  console.log(`  ✓ Markdown artifact written: ${mdPath}`);

  const h4JsonPath = resolve(artifactsDir, "h4-backlog.json");
  writeFileSync(
    h4JsonPath,
    JSON.stringify({
      auditedAt: result.auditedAt,
      groups: result.h4BacklogGroups
    }, null, 2),
    "utf-8"
  );
  console.log(`  ✓ H4 backlog JSON written: ${h4JsonPath}`);

  const h4MdPath = resolve(artifactsDir, "h4-backlog.md");
  writeFileSync(
    h4MdPath,
    [
      "# H4 Backlog",
      "",
      ...result.h4BacklogGroups.flatMap((group) => [
        `## ${group.title}`,
        "",
        group.description,
        "",
        `Current key count: **${group.currentKeyCount}**`,
        "",
        "| Key | Family | Data status | Recommended path | Primary blocker |",
        "|-----|--------|-------------|------------------|-----------------|",
        ...group.keys.map((entry) => `| \`${entry.key}\` | ${entry.family} | ${entry.dataStatus} | ${entry.recommendedPath} | ${entry.blockers[0] ?? "—"} |`),
        ""
      ])
    ].join("\n"),
    "utf-8"
  );
  console.log(`  ✓ H4 backlog Markdown written: ${h4MdPath}`);
  console.log("");
}

console.log("══════════════════════════════════════════════════════════════════\n");

if (errors.length > 0) {
  process.exit(1);
}
