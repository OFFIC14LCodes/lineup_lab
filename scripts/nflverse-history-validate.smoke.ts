import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

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

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const hasConfig = Boolean(url && serviceRoleKey);

describe.sequential("nflverse history validate", () => {
  it.skipIf(!hasConfig)(
    `validate:nflverse-history (season=${getSeason()})`,
    async () => {
      if (!url || !serviceRoleKey) {
        throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
      }

      const season = getSeason();

      const admin = createSupabaseClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      // Always dry-run: validate only, never write
      const report = await runNflversePipeline(
        { season, mode: "dry_run", projectRoot: process.cwd() },
        admin
      );

      console.info(
        JSON.stringify(
          {
            event: "nflverse_validate_complete",
            season: report.season,
            sha256: report.sha256,
            schemaValid: report.schemaValid,
            missingColumns: report.missingColumns,
            coverage: report.coverage,
            durationMs: report.durationMs
          },
          null,
          2
        )
      );

      expect(report.schemaValid).toBe(true);
      if (!report.schemaValid) {
        console.error(
          `Schema validation failed. Missing columns: ${report.missingColumns.join(", ")}`
        );
        return;
      }

      const { coverage } = report;

      console.info([
        "",
        "=== nflverse H1 Validate Report ===",
        `Season:              ${report.season}`,
        `Source URL:          ${report.sourceUrl}`,
        `SHA-256:             ${report.sha256}`,
        `Already cached:      ${report.alreadyArchived}`,
        "",
        "--- Identity Resolution Coverage (dry run) ---",
        `Total rows:          ${coverage.totalSourceRows}`,
        `QB/RB/WR/TE rows:    ${coverage.filteredPositionRows}`,
        `Regular season rows: ${coverage.regularSeasonRows}`,
        `Resolved:            ${coverage.resolvedRows}`,
        `Unresolved:          ${coverage.unresolvedRows}`,
        `Rejected:            ${coverage.rejectedRows}`,
        "",
        "NOTE: Unresolved GSIS IDs need player_external_ids mappings (provider=gsis, external_type=gsis).",
        "Run 'npm run import:nflverse-history -- --execute' to write resolved rows.",
        ""
      ].join("\n"));
    },
    180_000
  );

  it.skipIf(hasConfig)("skips when Supabase is not configured", () => {
    console.warn(
      "Skipping nflverse validate: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set."
    );
  });
});

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
