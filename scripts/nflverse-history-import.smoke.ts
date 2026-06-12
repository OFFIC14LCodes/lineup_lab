import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { describe, it } from "vitest";

import { runNflversePipeline } from "@/lib/providers/nflverse/pipeline";

loadEnvConfig(process.cwd());
loadLocalEnvFallback();

const DEFAULT_SEASON = 2025;

function getSeason(): number {
  const arg = process.argv.find((a) => a.startsWith("--season="));
  if (arg) {
    const parsed = parseInt(arg.split("=")[1], 10);
    if (Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100) {
      return parsed;
    }
  }
  return DEFAULT_SEASON;
}

function getMode(): "dry_run" | "execute" {
  if (process.argv.includes("--execute")) return "execute";
  return "dry_run"; // default
}

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const hasConfig = Boolean(url && serviceRoleKey);

describe.sequential("nflverse history import", () => {
  it.skipIf(!hasConfig)(
    `import:nflverse-history (season=${getSeason()}, mode=${getMode()})`,
    async () => {
      if (!url || !serviceRoleKey) {
        throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
      }

      const season = getSeason();
      const mode = getMode();

      console.info(
        JSON.stringify({ event: "nflverse_import_start", season, mode }, null, 2)
      );

      const admin = createSupabaseClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      const report = await runNflversePipeline(
        { season, mode, projectRoot: process.cwd() },
        admin
      );

      console.info(JSON.stringify(buildConsoleReport(report), null, 2));

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

      const lines = [
        "",
        "=== nflverse H1 Import Report ===",
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
        `Written to DB:        ${coverage.writtenRows}`,
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
      }

      lines.forEach((l) => console.info(l));
    },
    180_000
  );

  it.skipIf(hasConfig)("skips when Supabase is not configured", () => {
    console.warn(
      "Skipping nflverse import: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set."
    );
  });
});

function buildConsoleReport(report: Awaited<ReturnType<typeof runNflversePipeline>>) {
  return {
    event: "nflverse_import_complete",
    season: report.season,
    mode: report.mode,
    sha256: report.sha256,
    schemaValid: report.schemaValid,
    missingColumns: report.missingColumns,
    coverage: report.coverage,
    durationMs: report.durationMs
  };
}

function loadLocalEnvFallback() {
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
