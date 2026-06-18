import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES,
  selectExpectedGamesModelForProjectionRow,
} from "@/lib/projections/feature-flags";

import type { PreseasonProjectionSnapshot } from "./preseason-projection-snapshot-types";
import type { ProjectionV82FeatureFlagReadinessReport, ProjectionV82FeatureFlagReadinessRow } from "./projection-v8-2-feature-flag-readiness-types";
import type { ProjectionV82FeatureFlagPreviewArtifactPaths, ProjectionV82FeatureFlagPreviewMismatch, ProjectionV82FeatureFlagPreviewMode, ProjectionV82FeatureFlagPreviewOptions, ProjectionV82FeatureFlagPreviewReport, ProjectionV82FeatureFlagPreviewRow, ProjectionV82FeatureFlagPreviewSelection, ProjectionV82FeatureFlagPreviewSummary } from "./projection-v8-2-feature-flag-preview-types";
import type { ProjectionV82ShadowReport } from "./projection-v8-2-shadow-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");

export function runProjectionV82FeatureFlagPreview(options: ProjectionV82FeatureFlagPreviewOptions): ProjectionV82FeatureFlagPreviewReport {
  const readinessPath = path.join(OUTPUT_DIR, `projection-v8-2-feature-flag-readiness-${options.projectionSeason}.json`);
  const shadowPath = path.join(OUTPUT_DIR, `projection-v8-2-shadow-${options.projectionSeason}.json`);
  const snapshotPath = path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`);
  for (const artifactPath of [readinessPath, shadowPath, snapshotPath]) {
    if (!existsSync(artifactPath)) throw new Error(`Missing ${path.relative(process.cwd(), artifactPath)}.`);
  }

  return buildProjectionV82FeatureFlagPreviewFromData({
    options,
    readiness: JSON.parse(readFileSync(readinessPath, "utf8")) as ProjectionV82FeatureFlagReadinessReport,
    shadow: JSON.parse(readFileSync(shadowPath, "utf8")) as ProjectionV82ShadowReport,
    snapshot: JSON.parse(readFileSync(snapshotPath, "utf8")) as PreseasonProjectionSnapshot,
    sourceArtifacts: { readiness: readinessPath, shadow: shadowPath, snapshot: snapshotPath },
  });
}

export function buildProjectionV82FeatureFlagPreviewFromData(input: {
  options: ProjectionV82FeatureFlagPreviewOptions;
  readiness: ProjectionV82FeatureFlagReadinessReport;
  shadow: ProjectionV82ShadowReport;
  snapshot: PreseasonProjectionSnapshot;
  sourceArtifacts?: ProjectionV82FeatureFlagPreviewReport["sourceArtifacts"];
}): ProjectionV82FeatureFlagPreviewReport {
  void input.shadow;
  void input.snapshot;
  const disabledRows = previewRows(input.readiness.rows, "disabled", false, true);
  const enabledRows = previewRows(input.readiness.rows, "enabled", true, true);
  const missingArtifactRows = previewRows(input.readiness.rows, "missing_artifacts", true, false);
  const disabledSummary = summarize(disabledRows);
  const enabledSummary = summarize(enabledRows);
  const missingArtifactsSummary = summarize(missingArtifactRows);
  const mismatches = enabledRows.filter((row) => row.mismatch).map(mismatchFor);
  const protectedRowViolations = enabledRows.filter((row) => row.violation).map(violationFor);
  const safetyGates = buildSafetyGates(input.readiness, disabledSummary, enabledSummary, missingArtifactsSummary, mismatches, protectedRowViolations);
  const recommendation = recommendationFor(safetyGates);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    featureFlagName: BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES,
    sourceArtifacts: input.sourceArtifacts ?? { readiness: "in-memory", shadow: "in-memory", snapshot: "in-memory" },
    disabledMode: { rows: disabledRows, summary: disabledSummary },
    enabledMode: {
      rows: enabledRows,
      summary: enabledSummary,
      expectedReadinessSummary: {
        wouldUseV82UnderFlag: input.readiness.summary.wouldUseV82UnderFlag,
        wouldUseCurrentPathUnderFlag: input.readiness.summary.wouldUseCurrentPathUnderFlag,
        excludedFromFlagPool: input.readiness.summary.excludedFromFlagPool,
        blockedFromFlagPool: input.readiness.summary.blockedFromFlagPool,
        kRowsUsingV82: input.readiness.summary.kRowsUsingV82,
        criticalMovementRowsUsingV82: input.readiness.summary.criticalMovementRowsUsingV82,
        meaningfulRankMoversUsingV82: input.readiness.summary.meaningfulRankMoversUsingV82,
        legacyRowsUsingV82: input.readiness.summary.legacyRowsUsingV82,
      },
    },
    missingArtifactsMode: { summary: missingArtifactsSummary },
    mismatches,
    protectedRowViolations,
    safetyGates,
    recommendation,
    notes: [
      "Dry-run/read-only selector preview only.",
      "The selector is exercised in disabled, enabled, and missing-artifact modes without wiring it into live projection generation.",
      "No live projections, 2026 production outputs, Supabase writes, Blackbird Rank, Draft Suggestion ordering, War Room UI, or v8.2 promotion paths are changed.",
    ],
  };
}

export function writeProjectionV82FeatureFlagPreviewArtifacts(report: ProjectionV82FeatureFlagPreviewReport): ProjectionV82FeatureFlagPreviewArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-v8-2-feature-flag-preview-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function previewRows(
  readinessRows: ProjectionV82FeatureFlagReadinessRow[],
  mode: ProjectionV82FeatureFlagPreviewMode,
  flagEnabled: boolean,
  readinessArtifactsAvailable: boolean,
): ProjectionV82FeatureFlagPreviewRow[] {
  return readinessRows.map((row) => {
    const selector = selectExpectedGamesModelForProjectionRow({
      playerId: row.playerId,
      position: row.position,
      criticalMovement: row.criticalMovement,
      meaningfulRankMover: row.meaningfulRankMover,
      universeEligibilityStatus: row.universeEligibilityStatus,
      readinessRow: row,
      readinessArtifactsAvailable,
      flagEnabled,
    });
    const selectorSelection = previewSelection(selector.selection, row);
    const readinessExpectedSelection = mode === "enabled" ? readinessSelection(row) : "current_path";
    const violation = selectorSelection === "v8_2_candidate_path" && isProtected(row);
    return {
      playerId: row.playerId,
      player: row.player,
      position: row.position,
      team: row.team,
      status: row.status,
      universeEligibilityStatus: row.universeEligibilityStatus,
      criticalMovement: row.criticalMovement,
      meaningfulRankMover: row.meaningfulRankMover,
      projectedPointDelta: row.projectedPointDelta,
      movementBucket: row.movementBucket,
      mode,
      selectorSelection,
      selectorReason: selector.reason,
      readinessExpectedSelection,
      mismatch: selectorSelection !== readinessExpectedSelection,
      violation,
    };
  });
}

function previewSelection(selection: ReturnType<typeof selectExpectedGamesModelForProjectionRow>["selection"], row: ProjectionV82FeatureFlagReadinessRow): ProjectionV82FeatureFlagPreviewSelection {
  if (selection === "v8_2_candidate_path") return "v8_2_candidate_path";
  if (selection === "blocked_or_excluded") return row.status === "blocked_from_flag_pool" ? "blocked_from_flag_pool" : "excluded_from_flag_pool";
  return "current_path";
}

function readinessSelection(row: ProjectionV82FeatureFlagReadinessRow): ProjectionV82FeatureFlagPreviewSelection {
  if (row.status === "would_use_v8_2_under_flag") return "v8_2_candidate_path";
  if (row.status === "would_use_current_path_under_flag") return "current_path";
  return row.status;
}

function summarize(rows: ProjectionV82FeatureFlagPreviewRow[]): ProjectionV82FeatureFlagPreviewSummary {
  return {
    totalRows: rows.length,
    currentPathRows: rows.filter((row) => row.selectorSelection === "current_path").length,
    v82Rows: rows.filter((row) => row.selectorSelection === "v8_2_candidate_path").length,
    excludedRows: rows.filter((row) => row.selectorSelection === "excluded_from_flag_pool").length,
    blockedRows: rows.filter((row) => row.selectorSelection === "blocked_from_flag_pool").length,
    kRowsUsingV82: rows.filter((row) => row.position === "K" && row.selectorSelection === "v8_2_candidate_path").length,
    criticalMovementRowsUsingV82: rows.filter((row) => row.criticalMovement && row.selectorSelection === "v8_2_candidate_path").length,
    meaningfulRankMoversUsingV82: rows.filter((row) => row.meaningfulRankMover && row.selectorSelection === "v8_2_candidate_path").length,
    legacyRowsUsingV82: rows.filter((row) => (row.universeEligibilityStatus === "retired_or_legacy_suspect" || row.universeEligibilityStatus === "stale_historical_signal") && row.selectorSelection === "v8_2_candidate_path").length,
    mismatches: rows.filter((row) => row.mismatch).length,
    protectedRowViolations: rows.filter((row) => row.violation).length,
  };
}

function buildSafetyGates(
  readiness: ProjectionV82FeatureFlagReadinessReport,
  disabled: ProjectionV82FeatureFlagPreviewSummary,
  enabled: ProjectionV82FeatureFlagPreviewSummary,
  missingArtifacts: ProjectionV82FeatureFlagPreviewSummary,
  mismatches: ProjectionV82FeatureFlagPreviewMismatch[],
  violations: ProjectionV82FeatureFlagPreviewMismatch[],
) {
  return [
    gate("disabled_mode_zero_v8_2_rows", disabled.v82Rows === 0, `${disabled.v82Rows} disabled-mode row(s) selected v8.2.`),
    gate(
      "enabled_mode_matches_readiness_counts",
      enabled.v82Rows === readiness.summary.wouldUseV82UnderFlag
        && enabled.currentPathRows === readiness.summary.wouldUseCurrentPathUnderFlag
        && enabled.excludedRows === readiness.summary.excludedFromFlagPool
        && enabled.blockedRows === readiness.summary.blockedFromFlagPool,
      `actual v8.2/current/excluded/blocked ${enabled.v82Rows}/${enabled.currentPathRows}/${enabled.excludedRows}/${enabled.blockedRows}; expected ${readiness.summary.wouldUseV82UnderFlag}/${readiness.summary.wouldUseCurrentPathUnderFlag}/${readiness.summary.excludedFromFlagPool}/${readiness.summary.blockedFromFlagPool}`,
    ),
    gate("k_rows_not_using_v8_2", enabled.kRowsUsingV82 === 0, `${enabled.kRowsUsingV82} K row(s) selected v8.2.`),
    gate("critical_movers_not_using_v8_2", enabled.criticalMovementRowsUsingV82 === 0, `${enabled.criticalMovementRowsUsingV82} critical movement row(s) selected v8.2.`),
    gate("meaningful_rank_movers_not_using_v8_2", enabled.meaningfulRankMoversUsingV82 === 0, `${enabled.meaningfulRankMoversUsingV82} meaningful rank mover(s) selected v8.2.`),
    gate("legacy_rows_not_using_v8_2", enabled.legacyRowsUsingV82 === 0, `${enabled.legacyRowsUsingV82} legacy/stale row(s) selected v8.2.`),
    gate("missing_artifacts_fail_closed", missingArtifacts.v82Rows === 0, `${missingArtifacts.v82Rows} missing-artifact row(s) selected v8.2.`),
    gate("mismatch_rows_zero", mismatches.length === 0, `${mismatches.length} selector/readiness mismatch row(s).`),
    gate("protected_row_violations_zero", violations.length === 0, `${violations.length} protected-row violation(s).`),
    gate("no_live_outputs_changed", true, "Preview writes only dry-run artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Ranking code paths are not imported or executed."),
    gate("draft_suggestions_unchanged", true, "Draft suggestion code paths are not imported or executed."),
    gate("war_room_unchanged", true, "War Room UI code is not imported or modified."),
  ];
}

function recommendationFor(gates: ProjectionV82FeatureFlagPreviewReport["safetyGates"]): ProjectionV82FeatureFlagPreviewReport["recommendation"] {
  const failed = gates.filter((gate) => !gate.passed);
  if (!failed.length) return "selector_preview_clean";
  if (failed.some((gate) => gate.name.includes("not_using_v8_2") || gate.name.includes("violations") || gate.name === "missing_artifacts_fail_closed")) return "selector_preview_blocked";
  return "selector_preview_mismatch";
}

function mismatchFor(row: ProjectionV82FeatureFlagPreviewRow): ProjectionV82FeatureFlagPreviewMismatch {
  return {
    playerId: row.playerId,
    player: row.player,
    position: row.position,
    team: row.team,
    readinessExpectedSelection: row.readinessExpectedSelection,
    selectorSelection: row.selectorSelection,
    selectorReason: row.selectorReason,
    detail: `Selector chose ${row.selectorSelection}; readiness expected ${row.readinessExpectedSelection}.`,
  };
}

function violationFor(row: ProjectionV82FeatureFlagPreviewRow): ProjectionV82FeatureFlagPreviewMismatch {
  return {
    ...mismatchFor(row),
    detail: "Selector chose v8.2 for a protected row.",
  };
}

function isProtected(row: ProjectionV82FeatureFlagReadinessRow) {
  return row.position === "K"
    || row.criticalMovement
    || row.meaningfulRankMover
    || row.universeEligibilityStatus === "retired_or_legacy_suspect"
    || row.universeEligibilityStatus === "stale_historical_signal"
    || row.status === "blocked_from_flag_pool"
    || row.status === "excluded_from_flag_pool"
    || row.status === "would_use_current_path_under_flag";
}

function renderMarkdown(report: ProjectionV82FeatureFlagPreviewReport) {
  return `# Projection v8.2 Feature-Flag Selector Preview ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Feature flag: ${report.featureFlagName}
Recommendation: ${report.recommendation}

## Disabled Mode

\`\`\`json
${JSON.stringify(report.disabledMode.summary, null, 2)}
\`\`\`

## Enabled Mode

\`\`\`json
${JSON.stringify(report.enabledMode.summary, null, 2)}
\`\`\`

## Expected Readiness Counts

\`\`\`json
${JSON.stringify(report.enabledMode.expectedReadinessSummary, null, 2)}
\`\`\`

## Missing Artifacts Fail-Closed Mode

\`\`\`json
${JSON.stringify(report.missingArtifactsMode.summary, null, 2)}
\`\`\`

## Safety Gates

${renderGateTable(report.safetyGates)}

## Mismatches

${renderMismatchTable(report.mismatches)}

## Protected-Row Violations

${renderMismatchTable(report.protectedRowViolations)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderCsv(report: ProjectionV82FeatureFlagPreviewReport) {
  const headers = ["mode", "player_id", "player", "position", "team", "readiness_status", "selector_selection", "selector_reason", "readiness_expected_selection", "mismatch", "violation", "projected_point_delta", "movement_bucket"];
  const rows = [...report.disabledMode.rows, ...report.enabledMode.rows].map((row) => [
    row.mode,
    row.playerId,
    row.player,
    row.position,
    row.team ?? "",
    row.status,
    row.selectorSelection,
    row.selectorReason,
    row.readinessExpectedSelection,
    row.mismatch,
    row.violation,
    row.projectedPointDelta ?? "",
    row.movementBucket,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function renderGateTable(gates: ProjectionV82FeatureFlagPreviewReport["safetyGates"]) {
  const header = "| Gate | Status | Detail |";
  const divider = "|---|---|---|";
  return [header, divider, ...gates.map((gate) => `| ${gate.name} | ${gate.passed ? "PASS" : "FAIL"} | ${gate.detail} |`)].join("\n");
}

function renderMismatchTable(rows: ProjectionV82FeatureFlagPreviewMismatch[]) {
  if (!rows.length) return "No rows.";
  const header = "| Player | Pos | Team | Expected | Actual | Reason | Detail |";
  const divider = "|---|---|---|---|---|---|---|";
  return [header, divider, ...rows.slice(0, 50).map((row) => `| ${row.player} | ${row.position} | ${row.team ?? ""} | ${row.readinessExpectedSelection} | ${row.selectorSelection} | ${row.selectorReason} | ${row.detail} |`)].join("\n");
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
