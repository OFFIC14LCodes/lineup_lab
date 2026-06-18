import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { PreseasonProjectionSnapshot } from "./preseason-projection-snapshot-types";
import type { ProjectionSelectorPipelinePreviewReport } from "./projection-selector-pipeline-preview-types";
import type {
  ProjectionV82SnapshotDiffGuardArtifactPaths,
  ProjectionV82SnapshotDiffGuardOptions,
  ProjectionV82SnapshotDiffGuardReport,
  ProjectionV82SnapshotDiffGuardSummary,
} from "./projection-v8-2-snapshot-diff-guard-types";
import type { ProjectionV82FeatureFlagPreviewReport } from "./projection-v8-2-feature-flag-preview-types";
import type { ProjectionV82FeatureFlagReadinessReport } from "./projection-v8-2-feature-flag-readiness-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");

export function runProjectionV82SnapshotDiffGuard(options: ProjectionV82SnapshotDiffGuardOptions): ProjectionV82SnapshotDiffGuardReport {
  const snapshotPath = path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`);
  const readinessPath = path.join(OUTPUT_DIR, `projection-v8-2-feature-flag-readiness-${options.projectionSeason}.json`);
  const selectorPreviewPath = path.join(OUTPUT_DIR, `projection-v8-2-feature-flag-preview-${options.projectionSeason}.json`);
  const pipelinePreviewPath = path.join(OUTPUT_DIR, `projection-selector-pipeline-preview-${options.projectionSeason}.json`);
  for (const artifactPath of [snapshotPath, readinessPath, selectorPreviewPath, pipelinePreviewPath]) {
    if (!existsSync(artifactPath)) throw new Error(`Missing ${path.relative(process.cwd(), artifactPath)}.`);
  }

  return buildProjectionV82SnapshotDiffGuardFromData({
    options,
    snapshot: JSON.parse(readFileSync(snapshotPath, "utf8")) as PreseasonProjectionSnapshot,
    readiness: JSON.parse(readFileSync(readinessPath, "utf8")) as ProjectionV82FeatureFlagReadinessReport,
    selectorPreview: JSON.parse(readFileSync(selectorPreviewPath, "utf8")) as ProjectionV82FeatureFlagPreviewReport,
    pipelinePreview: JSON.parse(readFileSync(pipelinePreviewPath, "utf8")) as ProjectionSelectorPipelinePreviewReport,
    sourceArtifacts: {
      snapshot: snapshotPath,
      readiness: readinessPath,
      selectorPreview: selectorPreviewPath,
      pipelinePreview: pipelinePreviewPath,
    },
  });
}

export function buildProjectionV82SnapshotDiffGuardFromData(input: {
  options: ProjectionV82SnapshotDiffGuardOptions;
  snapshot: PreseasonProjectionSnapshot;
  readiness: ProjectionV82FeatureFlagReadinessReport;
  selectorPreview: ProjectionV82FeatureFlagPreviewReport;
  pipelinePreview: ProjectionSelectorPipelinePreviewReport;
  sourceArtifacts?: ProjectionV82SnapshotDiffGuardReport["sourceArtifacts"];
}): ProjectionV82SnapshotDiffGuardReport {
  const defaultSnapshot = summarizeDefaultSnapshot(input.snapshot, input.pipelinePreview);
  const enabledValidation = {
    strategy: "pipeline_preview_artifact_no_enabled_snapshot_written" as const,
    summary: input.pipelinePreview.enabledMode.summary,
    expectedV82Rows: input.readiness.summary.wouldUseV82UnderFlag,
    expectedCurrentPathRows: input.readiness.summary.wouldUseCurrentPathUnderFlag,
    expectedExcludedRows: input.readiness.summary.excludedFromFlagPool,
    expectedBlockedRows: input.readiness.summary.blockedFromFlagPool,
  };
  const missingArtifacts = {
    v82SelectedRows: input.pipelinePreview.missingArtifactsMode.summary.v82Rows,
    currentPathRows: input.pipelinePreview.missingArtifactsMode.summary.currentPathRows,
  };
  const safetyGates = buildSafetyGates(defaultSnapshot, enabledValidation, missingArtifacts, input.selectorPreview, input.pipelinePreview);
  const recommendation = recommendationFor(safetyGates);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? { snapshot: "in-memory", readiness: "in-memory", selectorPreview: "in-memory", pipelinePreview: "in-memory" },
    defaultSnapshot,
    enabledValidation,
    missingArtifacts,
    pipelinePreviewRecommendation: input.pipelinePreview.recommendation,
    safetyGates,
    recommendation,
    notes: [
      "Dry-run/read-only v8.2 snapshot diff guard.",
      "Enabled-mode validation uses selector and pipeline preview artifacts; no enabled snapshot artifact is generated or written by this guard.",
      "No live projections, 2026 production outputs, Supabase writes, Blackbird Rank, Draft Suggestion ordering, War Room UI, or v8.2 promotion paths are changed.",
    ],
  };
}

export function writeProjectionV82SnapshotDiffGuardArtifacts(report: ProjectionV82SnapshotDiffGuardReport): ProjectionV82SnapshotDiffGuardArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-v8-2-snapshot-diff-guard-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function summarizeDefaultSnapshot(snapshot: PreseasonProjectionSnapshot, pipelinePreview: ProjectionSelectorPipelinePreviewReport): ProjectionV82SnapshotDiffGuardSummary {
  const selector = snapshot.diagnostics.expectedGamesSelector;
  const selectorRows = snapshot.rows.filter((row) => row.variant === "blackbird_expected_games_v7_family_selective");
  return {
    totalRows: snapshot.rows.length,
    selectorRows: selector?.totalSelectorRows ?? selectorRows.length,
    selectorFlagEnabled: selector?.flagEnabled ?? null,
    readinessArtifactsAvailable: selector?.readinessArtifactsAvailable ?? null,
    v82SelectedRows: selector?.selectedV82Rows ?? selectorRows.filter((row) => row.expectedGamesDiagnostics.expectedGamesModelSelected === "blackbird_expected_games_v8_2_high_impact_guardrail").length,
    currentPathRows: selector?.currentPathRows ?? selectorRows.filter((row) => row.expectedGamesDiagnostics.expectedGamesModelSelected === "current").length,
    projectionDeltasVsCurrentPath: pipelinePreview.disabledMode.summary.projectionTotalMismatchesVsCurrent,
    rankingAffectingDeltas: pipelinePreview.disabledMode.summary.rankingAffectingOutputDeltaRows,
    protectedRowViolations: (selector?.kRowsUsingV82 ?? 0)
      + (selector?.criticalMovementRowsUsingV82 ?? 0)
      + (selector?.meaningfulRankMoversUsingV82 ?? 0)
      + (selector?.legacyRowsUsingV82 ?? 0),
  };
}

function buildSafetyGates(
  defaultSnapshot: ProjectionV82SnapshotDiffGuardSummary,
  enabledValidation: ProjectionV82SnapshotDiffGuardReport["enabledValidation"],
  missingArtifacts: ProjectionV82SnapshotDiffGuardReport["missingArtifacts"],
  selectorPreview: ProjectionV82FeatureFlagPreviewReport,
  pipelinePreview: ProjectionSelectorPipelinePreviewReport,
) {
  return [
    gate("default_snapshot_flag_disabled", defaultSnapshot.selectorFlagEnabled === false, `flag enabled: ${defaultSnapshot.selectorFlagEnabled}`),
    gate("default_snapshot_zero_v8_2_rows", defaultSnapshot.v82SelectedRows === 0, `${defaultSnapshot.v82SelectedRows} default snapshot row(s) selected v8.2.`),
    gate("default_snapshot_current_path_only", defaultSnapshot.currentPathRows === defaultSnapshot.selectorRows, `${defaultSnapshot.currentPathRows}/${defaultSnapshot.selectorRows} selector rows current path.`),
    gate("default_snapshot_no_protected_violations", defaultSnapshot.protectedRowViolations === 0, `${defaultSnapshot.protectedRowViolations} default protected-row violation(s).`),
    gate("default_snapshot_projection_deltas_zero", defaultSnapshot.projectionDeltasVsCurrentPath === 0 && defaultSnapshot.rankingAffectingDeltas === 0, `projection deltas ${defaultSnapshot.projectionDeltasVsCurrentPath}; ranking deltas ${defaultSnapshot.rankingAffectingDeltas}`),
    gate("enabled_counts_match_readiness_or_preview", enabledValidation.summary.v82Rows === enabledValidation.expectedV82Rows && enabledValidation.summary.currentPathRows === enabledValidation.expectedCurrentPathRows && enabledValidation.summary.excludedRows === enabledValidation.expectedExcludedRows && enabledValidation.summary.blockedRows === enabledValidation.expectedBlockedRows && enabledValidation.summary.v82Rows === selectorPreview.enabledMode.summary.v82Rows, `actual v8.2/current/excluded/blocked ${enabledValidation.summary.v82Rows}/${enabledValidation.summary.currentPathRows}/${enabledValidation.summary.excludedRows}/${enabledValidation.summary.blockedRows}`),
    gate("enabled_protected_rows_zero", enabledValidation.summary.kRowsUsingV82 === 0 && enabledValidation.summary.criticalMovementRowsUsingV82 === 0 && enabledValidation.summary.meaningfulRankMoversUsingV82 === 0 && enabledValidation.summary.legacyRowsUsingV82 === 0, `K/critical/rank/legacy ${enabledValidation.summary.kRowsUsingV82}/${enabledValidation.summary.criticalMovementRowsUsingV82}/${enabledValidation.summary.meaningfulRankMoversUsingV82}/${enabledValidation.summary.legacyRowsUsingV82}`),
    gate("missing_artifacts_fail_closed", missingArtifacts.v82SelectedRows === 0, `${missingArtifacts.v82SelectedRows} missing-artifact row(s) selected v8.2.`),
    gate("pipeline_preview_clean", pipelinePreview.recommendation === "pipeline_selector_preview_clean", pipelinePreview.recommendation),
    gate("no_live_outputs_changed", true, "Guard writes only dry-run report artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Ranking code paths are not imported or executed."),
    gate("draft_suggestions_unchanged", true, "Draft suggestion code paths are not imported or executed."),
    gate("war_room_unchanged", true, "War Room UI code is not imported or modified."),
    gate("default_artifact_restored_or_unchanged", defaultSnapshot.selectorFlagEnabled === false && defaultSnapshot.v82SelectedRows === 0, "Default snapshot remains disabled/current-path-only."),
  ];
}

function recommendationFor(gates: ProjectionV82SnapshotDiffGuardReport["safetyGates"]): ProjectionV82SnapshotDiffGuardReport["recommendation"] {
  const failed = gates.filter((gate) => !gate.passed);
  if (!failed.length) return "snapshot_diff_guard_clean";
  if (failed.some((gate) => gate.name.includes("protected") || gate.name === "missing_artifacts_fail_closed" || gate.name === "default_snapshot_zero_v8_2_rows")) return "snapshot_diff_guard_blocked";
  return "snapshot_diff_guard_mismatch";
}

function renderMarkdown(report: ProjectionV82SnapshotDiffGuardReport) {
  return `# Projection v8.2 Snapshot Diff Guard ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Recommendation: ${report.recommendation}

## Default Snapshot

\`\`\`json
${JSON.stringify(report.defaultSnapshot, null, 2)}
\`\`\`

## Enabled Validation

Strategy: ${report.enabledValidation.strategy}

\`\`\`json
${JSON.stringify(report.enabledValidation.summary, null, 2)}
\`\`\`

## Missing Artifacts

\`\`\`json
${JSON.stringify(report.missingArtifacts, null, 2)}
\`\`\`

## Safety Gates

${renderGateTable(report.safetyGates)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderCsv(report: ProjectionV82SnapshotDiffGuardReport) {
  const headers = ["gate", "passed", "detail"];
  const rows = report.safetyGates.map((gateRow) => [gateRow.name, gateRow.passed, gateRow.detail]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function renderGateTable(gates: ProjectionV82SnapshotDiffGuardReport["safetyGates"]) {
  const header = "| Gate | Status | Detail |";
  const divider = "|---|---|---|";
  return [header, divider, ...gates.map((gateRow) => `| ${gateRow.name} | ${gateRow.passed ? "PASS" : "FAIL"} | ${gateRow.detail} |`)].join("\n");
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
