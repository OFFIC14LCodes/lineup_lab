import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  buildProjectionCurrentRosterConfirmationFromData,
} from "./projection-current-roster-confirmation";
import type { CurrentRosterSourceReport } from "@/lib/data-acquisition/current-roster-source-types";
import type { PreseasonProjectionSnapshot } from "./preseason-projection-snapshot-types";
import type { ProjectionActiveUniverseGateReport } from "./projection-active-universe-gate-types";
import type { ProjectionCurrentRosterConfirmationReport } from "./projection-current-roster-confirmation-types";
import type {
  ProjectionCurrentRosterConfirmationDeltaArtifactPaths,
  ProjectionCurrentRosterConfirmationDeltaInput,
  ProjectionCurrentRosterConfirmationDeltaOptions,
  ProjectionCurrentRosterConfirmationDeltaReport,
  ProjectionCurrentRosterConfirmationDeltaSummary,
} from "./projection-current-roster-confirmation-delta-types";

const BACKTESTING_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const ROSTER_DIR = path.join(process.cwd(), "artifacts", "projections", "current-rosters");
const REAL_SOURCE_PATH = path.join(process.cwd(), "data", "current-rosters", "current-rosters-2026.csv");

export function runProjectionCurrentRosterConfirmationDelta(options: ProjectionCurrentRosterConfirmationDeltaOptions): ProjectionCurrentRosterConfirmationDeltaReport {
  const sourceArtifacts = {
    beforeConfirmation: "source_missing_baseline",
    afterConfirmation: path.join(BACKTESTING_DIR, `projection-current-roster-confirmation-${options.projectionSeason}.json`),
    realSourceCsv: path.join(process.cwd(), "data", "current-rosters", `current-rosters-${options.projectionSeason}.csv`),
  };
  const snapshotPath = path.join(BACKTESTING_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`);
  const activeGatePath = path.join(BACKTESTING_DIR, `projection-active-universe-gate-${options.projectionSeason}.json`);
  const rosterPath = path.join(ROSTER_DIR, `current-rosters-${options.projectionSeason}.normalized.json`);
  for (const artifactPath of [snapshotPath, activeGatePath]) {
    if (!existsSync(artifactPath)) throw new Error(`Missing ${path.relative(process.cwd(), artifactPath)}.`);
  }
  const before = buildProjectionCurrentRosterConfirmationFromData({
    options,
    preseasonProjectionSnapshot: readJson<PreseasonProjectionSnapshot>(snapshotPath),
    activeUniverseGate: readJson<ProjectionActiveUniverseGateReport>(activeGatePath),
    currentRosterSource: null,
  });
  const after = existsSync(sourceArtifacts.afterConfirmation)
    ? readJson<ProjectionCurrentRosterConfirmationReport>(sourceArtifacts.afterConfirmation)
    : existsSync(rosterPath)
      ? buildProjectionCurrentRosterConfirmationFromData({
        options,
        preseasonProjectionSnapshot: readJson<PreseasonProjectionSnapshot>(snapshotPath),
        activeUniverseGate: readJson<ProjectionActiveUniverseGateReport>(activeGatePath),
        currentRosterSource: readJson<CurrentRosterSourceReport>(rosterPath),
      })
      : null;

  return buildProjectionCurrentRosterConfirmationDeltaFromData({
    options,
    before,
    after,
    realSourceCsvExists: existsSync(sourceArtifacts.realSourceCsv),
    sourceArtifacts: { ...sourceArtifacts, afterConfirmation: after ? sourceArtifacts.afterConfirmation : null },
  });
}

export function buildProjectionCurrentRosterConfirmationDeltaFromData(input: ProjectionCurrentRosterConfirmationDeltaInput): ProjectionCurrentRosterConfirmationDeltaReport {
  const before = summarize(input.before);
  const after = input.after ? summarize(input.after) : emptySummary(input.before.summary.totalProjectionRows);
  const delta = subtractSummary(after, before);
  const activeUniverseGateStatusChanges: Record<string, number> = input.after
    ? {
      active_confirmed_increase: input.after.h16IntegrationPreview.activeConfirmedIncrease,
      active_confirmed_decrease: input.after.h16IntegrationPreview.activeConfirmedDecrease,
      stale_status_review_resolved: input.after.h16IntegrationPreview.staleStatusReviewResolved,
      legacy_archive_blocked_confirmed: input.after.h16IntegrationPreview.legacyArchiveBlockedConfirmed,
      manual_review_required_resolved: input.after.h16IntegrationPreview.manualReviewRequiredResolved,
      kicker_policy_unaffected: input.after.h16IntegrationPreview.kickerPolicyUnaffected,
    }
    : {};
  const nextCommand = input.realSourceCsvExists ? null : `npm run data:current-rosters:normalize -- --season=${input.options.projectionSeason} --input=data/current-rosters/current-rosters-${input.options.projectionSeason}.csv`;
  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    realSourceStatus: input.realSourceCsvExists ? "real_source_present" : "real_source_missing",
    sourceArtifacts: input.sourceArtifacts ?? {
      beforeConfirmation: "in-memory",
      afterConfirmation: input.after ? "in-memory" : null,
      realSourceCsv: REAL_SOURCE_PATH,
    },
    before,
    after,
    delta,
    activeUniverseGateStatusChanges,
    nextCommand,
    safetyGates: [
      gate("no_live_outputs_changed", true, "Delta report reads artifacts and writes only local H18 artifacts."),
      gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
      gate("rankings_unchanged", true, "Blackbird Rank ordering is not imported, recalculated, or mutated."),
      gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported, recalculated, or mutated."),
      gate("war_room_scoring_unchanged", true, "War Room scoring behavior is not imported, recalculated, or mutated."),
      gate("v82_not_enabled", true, "v8.2 feature flag and projection selector behavior are not changed."),
    ],
    notes: [
      "H18 confirmation delta is dry-run/read-only.",
      input.realSourceCsvExists ? "Real current-roster source CSV was present." : "Real current-roster source CSV was missing; current delta uses available normalized/sample confirmation artifacts only.",
      "No production output is filtered or changed.",
    ],
  };
}

export function writeProjectionCurrentRosterConfirmationDeltaArtifacts(report: ProjectionCurrentRosterConfirmationDeltaReport): ProjectionCurrentRosterConfirmationDeltaArtifactPaths {
  mkdirSync(BACKTESTING_DIR, { recursive: true });
  const base = `projection-current-roster-confirmation-delta-${report.projectionSeason}`;
  const jsonPath = path.join(BACKTESTING_DIR, `${base}.json`);
  const markdownPath = path.join(BACKTESTING_DIR, `${base}.md`);
  const csvPath = path.join(BACKTESTING_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function summarize(report: ProjectionCurrentRosterConfirmationReport): ProjectionCurrentRosterConfirmationDeltaSummary {
  return {
    matchedRows: report.summary.matchedRows,
    unmatchedRows: report.summary.unmatchedRows,
    confirmedActive: report.summary.confirmedActive,
    confirmedNonActive: report.summary.confirmedNonActive,
    confirmedFreeAgent: report.summary.confirmedFreeAgent,
    confirmedIrPupNfi: report.summary.confirmedIrPupNfi,
    conflicts: report.summary.conflicts,
    legacyArchiveConfirmed: report.h16IntegrationPreview.legacyArchiveBlockedConfirmed,
    staleReviewResolved: report.h16IntegrationPreview.staleStatusReviewResolved,
    manualReviewResolved: report.h16IntegrationPreview.manualReviewRequiredResolved,
    kRowsWithRosterDepthStatus: report.rows.filter((row) => row.activeGateStatus === "kicker_policy_review" && row.rosterStatus).length,
    activeConfirmedIncrease: report.h16IntegrationPreview.activeConfirmedIncrease,
    activeConfirmedDecrease: report.h16IntegrationPreview.activeConfirmedDecrease,
  };
}

function emptySummary(totalRows: number): ProjectionCurrentRosterConfirmationDeltaSummary {
  return {
    matchedRows: 0,
    unmatchedRows: totalRows,
    confirmedActive: 0,
    confirmedNonActive: 0,
    confirmedFreeAgent: 0,
    confirmedIrPupNfi: 0,
    conflicts: 0,
    legacyArchiveConfirmed: 0,
    staleReviewResolved: 0,
    manualReviewResolved: 0,
    kRowsWithRosterDepthStatus: 0,
    activeConfirmedIncrease: 0,
    activeConfirmedDecrease: 0,
  };
}

function subtractSummary(after: ProjectionCurrentRosterConfirmationDeltaSummary, before: ProjectionCurrentRosterConfirmationDeltaSummary): ProjectionCurrentRosterConfirmationDeltaSummary {
  return Object.fromEntries(Object.keys(after).map((key) => [key, after[key as keyof ProjectionCurrentRosterConfirmationDeltaSummary] - before[key as keyof ProjectionCurrentRosterConfirmationDeltaSummary]])) as ProjectionCurrentRosterConfirmationDeltaSummary;
}

function renderMarkdown(report: ProjectionCurrentRosterConfirmationDeltaReport) {
  return `# Projection Current Roster Confirmation Delta ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Real source status: ${report.realSourceStatus}

## Before

\`\`\`json
${JSON.stringify(report.before, null, 2)}
\`\`\`

## After

\`\`\`json
${JSON.stringify(report.after, null, 2)}
\`\`\`

## Delta

\`\`\`json
${JSON.stringify(report.delta, null, 2)}
\`\`\`

Next command: ${report.nextCommand ?? "none"}
`;
}

function renderCsv(report: ProjectionCurrentRosterConfirmationDeltaReport) {
  const rows = [
    ["metric", "before", "after", "delta"],
    ...Object.keys(report.before).map((key) => [
      key,
      report.before[key as keyof ProjectionCurrentRosterConfirmationDeltaSummary],
      report.after[key as keyof ProjectionCurrentRosterConfirmationDeltaSummary],
      report.delta[key as keyof ProjectionCurrentRosterConfirmationDeltaSummary],
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function readJson<T>(artifactPath: string): T {
  return JSON.parse(readFileSync(artifactPath, "utf8")) as T;
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
