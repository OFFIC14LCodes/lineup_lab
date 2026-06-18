import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES,
  selectExpectedGamesModelForProjectionRow,
} from "@/lib/projections/feature-flags";

import type { PreseasonProjectionSnapshot } from "./preseason-projection-snapshot-types";
import type {
  ProjectionSelectorPipelinePreviewArtifactPaths,
  ProjectionSelectorPipelinePreviewMismatch,
  ProjectionSelectorPipelinePreviewMode,
  ProjectionSelectorPipelinePreviewMovementSummary,
  ProjectionSelectorPipelinePreviewOptions,
  ProjectionSelectorPipelinePreviewReport,
  ProjectionSelectorPipelinePreviewRow,
  ProjectionSelectorPipelinePreviewSelection,
  ProjectionSelectorPipelinePreviewSummary,
} from "./projection-selector-pipeline-preview-types";
import type { ProjectionV82FeatureFlagPreviewReport } from "./projection-v8-2-feature-flag-preview-types";
import type { ProjectionV82FeatureFlagReadinessReport, ProjectionV82FeatureFlagReadinessRow } from "./projection-v8-2-feature-flag-readiness-types";
import type { ProjectionV82ShadowReport, ProjectionV82ShadowRow } from "./projection-v8-2-shadow-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DL", "LB", "DB", "DST"];

export function runProjectionSelectorPipelinePreview(options: ProjectionSelectorPipelinePreviewOptions): ProjectionSelectorPipelinePreviewReport {
  const snapshotPath = path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`);
  const readinessPath = path.join(OUTPUT_DIR, `projection-v8-2-feature-flag-readiness-${options.projectionSeason}.json`);
  const selectorPreviewPath = path.join(OUTPUT_DIR, `projection-v8-2-feature-flag-preview-${options.projectionSeason}.json`);
  const shadowPath = path.join(OUTPUT_DIR, `projection-v8-2-shadow-${options.projectionSeason}.json`);
  for (const artifactPath of [snapshotPath, readinessPath, selectorPreviewPath, shadowPath]) {
    if (!existsSync(artifactPath)) throw new Error(`Missing ${path.relative(process.cwd(), artifactPath)}.`);
  }

  return buildProjectionSelectorPipelinePreviewFromData({
    options,
    snapshot: JSON.parse(readFileSync(snapshotPath, "utf8")) as PreseasonProjectionSnapshot,
    readiness: JSON.parse(readFileSync(readinessPath, "utf8")) as ProjectionV82FeatureFlagReadinessReport,
    selectorPreview: JSON.parse(readFileSync(selectorPreviewPath, "utf8")) as ProjectionV82FeatureFlagPreviewReport,
    shadow: JSON.parse(readFileSync(shadowPath, "utf8")) as ProjectionV82ShadowReport,
    sourceArtifacts: {
      snapshot: snapshotPath,
      readiness: readinessPath,
      selectorPreview: selectorPreviewPath,
      shadow: shadowPath,
    },
  });
}

export function buildProjectionSelectorPipelinePreviewFromData(input: {
  options: ProjectionSelectorPipelinePreviewOptions;
  snapshot: PreseasonProjectionSnapshot;
  readiness: ProjectionV82FeatureFlagReadinessReport;
  selectorPreview: ProjectionV82FeatureFlagPreviewReport;
  shadow: ProjectionV82ShadowReport;
  sourceArtifacts?: ProjectionSelectorPipelinePreviewReport["sourceArtifacts"];
}): ProjectionSelectorPipelinePreviewReport {
  void input.snapshot;
  const shadowByPlayerId = new Map(input.shadow.rows.map((row) => [row.playerId, row]));
  const selectorPreviewByMode = previewRowsByMode(input.selectorPreview);
  const disabledRows = buildRows({
    readinessRows: input.readiness.rows,
    shadowByPlayerId,
    selectorPreviewRows: selectorPreviewByMode.disabled,
    mode: "disabled",
    flagEnabled: false,
    readinessArtifactsAvailable: true,
  });
  const enabledRows = buildRows({
    readinessRows: input.readiness.rows,
    shadowByPlayerId,
    selectorPreviewRows: selectorPreviewByMode.enabled,
    mode: "enabled",
    flagEnabled: true,
    readinessArtifactsAvailable: true,
  });
  const missingArtifactRows = buildRows({
    readinessRows: input.readiness.rows,
    shadowByPlayerId,
    selectorPreviewRows: selectorPreviewByMode.enabled,
    mode: "missing_artifacts",
    flagEnabled: true,
    readinessArtifactsAvailable: false,
  });
  const disabledSummary = summarize(disabledRows);
  const enabledSummary = summarize(enabledRows);
  const missingArtifactsSummary = summarize(missingArtifactRows);
  const mismatches = [
    ...enabledRows.filter((row) => row.mismatchWithSelectorPreview).map((row) => mismatch(row, row.readinessStatus, row.selectorSelection, "selector output differed from selector-preview artifact")),
    ...enabledRows.filter((row) => row.mismatchWithReadiness).map((row) => mismatch(row, row.readinessStatus, row.selectorSelection, "selector output differed from readiness expected status")),
    ...disabledRows.filter((row) => row.projectionTotalMismatchVsCurrent).map((row) => mismatch(row, row.currentProjectedTotal, row.selectedProjectedTotal, "disabled output differed from current path total")),
  ];
  const protectedRowViolations = enabledRows.filter((row) => row.protectedRowViolation).map((row) => mismatch(row, "current_path", row.selectorSelection, "protected row selected v8.2"));
  const safetyGates = buildSafetyGates(input.readiness, input.selectorPreview, disabledSummary, enabledSummary, missingArtifactsSummary, mismatches, protectedRowViolations);
  const recommendation = recommendationFor(safetyGates);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    featureFlagName: BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES,
    sourceArtifacts: input.sourceArtifacts ?? { snapshot: "in-memory", readiness: "in-memory", selectorPreview: "in-memory", shadow: "in-memory" },
    disabledMode: { rows: disabledRows, summary: disabledSummary },
    enabledMode: { rows: enabledRows, summary: enabledSummary },
    missingArtifactsMode: { summary: missingArtifactsSummary },
    expectedReadinessCounts: {
      wouldUseV82UnderFlag: input.readiness.summary.wouldUseV82UnderFlag,
      wouldUseCurrentPathUnderFlag: input.readiness.summary.wouldUseCurrentPathUnderFlag,
      excludedFromFlagPool: input.readiness.summary.excludedFromFlagPool,
      blockedFromFlagPool: input.readiness.summary.blockedFromFlagPool,
    },
    expectedSelectorPreviewCounts: {
      v82Rows: input.selectorPreview.enabledMode.summary.v82Rows,
      currentPathRows: input.selectorPreview.enabledMode.summary.currentPathRows,
      excludedRows: input.selectorPreview.enabledMode.summary.excludedRows,
      blockedRows: input.selectorPreview.enabledMode.summary.blockedRows,
    },
    mismatches,
    protectedRowViolations,
    safetyGates,
    recommendation,
    notes: [
      "Dry-run/read-only projection-pipeline selector preview only.",
      "The preview combines artifact current totals with artifact v8.2 shadow totals to exercise selector-based expected-games model choice.",
      "No live projection generation, 2026 production outputs, Supabase writes, Blackbird Rank, Draft Suggestion ordering, War Room UI, or v8.2 promotion paths are changed.",
    ],
  };
}

export function writeProjectionSelectorPipelinePreviewArtifacts(report: ProjectionSelectorPipelinePreviewReport): ProjectionSelectorPipelinePreviewArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-selector-pipeline-preview-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function buildRows(input: {
  readinessRows: ProjectionV82FeatureFlagReadinessRow[];
  shadowByPlayerId: Map<string, ProjectionV82ShadowRow>;
  selectorPreviewRows: Map<string, ProjectionSelectorPipelinePreviewSelection>;
  mode: ProjectionSelectorPipelinePreviewMode;
  flagEnabled: boolean;
  readinessArtifactsAvailable: boolean;
}): ProjectionSelectorPipelinePreviewRow[] {
  return input.readinessRows.map((row) => {
    const shadow = input.shadowByPlayerId.get(row.playerId) ?? null;
    const selector = selectExpectedGamesModelForProjectionRow({
      playerId: row.playerId,
      position: row.position,
      criticalMovement: row.criticalMovement,
      meaningfulRankMover: row.meaningfulRankMover,
      universeEligibilityStatus: row.universeEligibilityStatus,
      readinessRow: row,
      readinessArtifactsAvailable: input.readinessArtifactsAvailable,
      flagEnabled: input.flagEnabled,
    });
    const selectorSelection = selectionFor(selector.selection, row);
    const readinessStatus = input.mode === "enabled" ? readinessSelection(row) : "current_path";
    const selectedProjectedTotal = selectedTotal(selectorSelection, row, shadow);
    const selectedExpectedGames = selectedGames(selectorSelection, row, shadow);
    const projectedTotalDeltaVsCurrent = row.currentProjectedTotal === null || selectedProjectedTotal === null
      ? null
      : round(selectedProjectedTotal - row.currentProjectedTotal);
    const selectorPreviewSelection = input.selectorPreviewRows.get(row.playerId);

    return {
      playerId: row.playerId,
      player: row.player,
      position: row.position,
      team: row.team,
      mode: input.mode,
      readinessStatus,
      selectorSelection,
      selectorReason: selector.reason,
      expectedGamesModel: selector.model,
      currentExpectedGames: row.currentExpectedGames,
      selectedExpectedGames,
      v82ExpectedGames: row.v82ExpectedGames ?? shadow?.v82ExpectedGames ?? null,
      currentProjectedTotal: row.currentProjectedTotal,
      selectedProjectedTotal,
      v82ProjectedTotal: row.v82ProjectedTotal ?? shadow?.shadowProjectedTotal ?? null,
      projectedTotalDeltaVsCurrent,
      movementBucket: projectedTotalDeltaVsCurrent === null ? row.movementBucket : movementBucketFor(projectedTotalDeltaVsCurrent),
      gamesBucket: shadow?.gamesBucket ?? null,
      cohorts: shadow?.cohorts ?? [],
      criticalMovement: row.criticalMovement,
      meaningfulRankMover: row.meaningfulRankMover,
      universeEligibilityStatus: row.universeEligibilityStatus,
      mismatchWithSelectorPreview: input.mode !== "missing_artifacts" && selectorPreviewSelection !== undefined && selectorSelection !== selectorPreviewSelection,
      mismatchWithReadiness: input.mode === "enabled" && selectorSelection !== readinessStatus,
      projectionTotalMismatchVsCurrent: input.mode === "disabled" && projectedTotalDeltaVsCurrent !== 0,
      protectedRowViolation: selectorSelection === "v8_2_candidate_path" && isProtected(row),
    };
  });
}

function selectionFor(selection: ReturnType<typeof selectExpectedGamesModelForProjectionRow>["selection"], row: ProjectionV82FeatureFlagReadinessRow): ProjectionSelectorPipelinePreviewSelection {
  if (selection === "v8_2_candidate_path") return "v8_2_candidate_path";
  if (selection === "blocked_or_excluded") return row.status === "blocked_from_flag_pool" ? "blocked_from_flag_pool" : "excluded_from_flag_pool";
  return "current_path";
}

function readinessSelection(row: ProjectionV82FeatureFlagReadinessRow): ProjectionSelectorPipelinePreviewSelection {
  if (row.status === "would_use_v8_2_under_flag") return "v8_2_candidate_path";
  if (row.status === "would_use_current_path_under_flag") return "current_path";
  return row.status;
}

function selectedTotal(selection: ProjectionSelectorPipelinePreviewSelection, row: ProjectionV82FeatureFlagReadinessRow, shadow: ProjectionV82ShadowRow | null) {
  if (selection === "v8_2_candidate_path") return row.v82ProjectedTotal ?? shadow?.shadowProjectedTotal ?? null;
  if (selection === "current_path") return row.currentProjectedTotal;
  return null;
}

function selectedGames(selection: ProjectionSelectorPipelinePreviewSelection, row: ProjectionV82FeatureFlagReadinessRow, shadow: ProjectionV82ShadowRow | null) {
  if (selection === "v8_2_candidate_path") return row.v82ExpectedGames ?? shadow?.v82ExpectedGames ?? null;
  if (selection === "current_path") return row.currentExpectedGames;
  return null;
}

function summarize(rows: ProjectionSelectorPipelinePreviewRow[]): ProjectionSelectorPipelinePreviewSummary {
  const deltas = rows.map((row) => row.projectedTotalDeltaVsCurrent).filter((value): value is number => value !== null);
  return {
    rowsEvaluated: rows.length,
    currentPathRows: rows.filter((row) => row.selectorSelection === "current_path").length,
    v82Rows: rows.filter((row) => row.selectorSelection === "v8_2_candidate_path").length,
    excludedRows: rows.filter((row) => row.selectorSelection === "excluded_from_flag_pool").length,
    blockedRows: rows.filter((row) => row.selectorSelection === "blocked_from_flag_pool").length,
    projectionTotalMismatchesVsCurrent: rows.filter((row) => row.projectionTotalMismatchVsCurrent).length,
    maxProjectionDeltaVsCurrent: deltas.length ? round(Math.max(...deltas.map((value) => Math.abs(value)))) : null,
    rankingAffectingOutputDeltaRows: rows.filter((row) => row.projectedTotalDeltaVsCurrent !== null && row.projectedTotalDeltaVsCurrent !== 0).length,
    protectedRowViolations: rows.filter((row) => row.protectedRowViolation).length,
    mismatchesWithSelectorPreview: rows.filter((row) => row.mismatchWithSelectorPreview).length,
    mismatchesWithReadiness: rows.filter((row) => row.mismatchWithReadiness).length,
    kRowsUsingV82: rows.filter((row) => row.position === "K" && row.selectorSelection === "v8_2_candidate_path").length,
    criticalMovementRowsUsingV82: rows.filter((row) => row.criticalMovement && row.selectorSelection === "v8_2_candidate_path").length,
    meaningfulRankMoversUsingV82: rows.filter((row) => row.meaningfulRankMover && row.selectorSelection === "v8_2_candidate_path").length,
    legacyRowsUsingV82: rows.filter((row) => (row.universeEligibilityStatus === "retired_or_legacy_suspect" || row.universeEligibilityStatus === "stale_historical_signal") && row.selectorSelection === "v8_2_candidate_path").length,
    movementBuckets: countBy(rows.map((row) => String(row.movementBucket))),
    positionSummaries: POSITIONS.map((position) => movementSummary(position, rows.filter((row) => row.position === position))),
    cohortSummaries: [...new Set(rows.flatMap((row) => row.cohorts))].sort().map((cohort) => movementSummary(cohort, rows.filter((row) => row.cohorts.includes(cohort)))),
  };
}

function buildSafetyGates(
  readiness: ProjectionV82FeatureFlagReadinessReport,
  selectorPreview: ProjectionV82FeatureFlagPreviewReport,
  disabled: ProjectionSelectorPipelinePreviewSummary,
  enabled: ProjectionSelectorPipelinePreviewSummary,
  missingArtifacts: ProjectionSelectorPipelinePreviewSummary,
  mismatches: ProjectionSelectorPipelinePreviewMismatch[],
  violations: ProjectionSelectorPipelinePreviewMismatch[],
) {
  return [
    gate("disabled_mode_uses_current_path_only", disabled.v82Rows === 0 && disabled.excludedRows === 0 && disabled.blockedRows === 0, `disabled current/v8.2/excluded/blocked ${disabled.currentPathRows}/${disabled.v82Rows}/${disabled.excludedRows}/${disabled.blockedRows}`),
    gate("disabled_mode_projection_outputs_match_current", disabled.projectionTotalMismatchesVsCurrent === 0 && disabled.maxProjectionDeltaVsCurrent === 0 && disabled.rankingAffectingOutputDeltaRows === 0, `mismatches ${disabled.projectionTotalMismatchesVsCurrent}; max delta ${disabled.maxProjectionDeltaVsCurrent}; ranking delta rows ${disabled.rankingAffectingOutputDeltaRows}`),
    gate("enabled_mode_matches_selector_preview", enabled.v82Rows === selectorPreview.enabledMode.summary.v82Rows && enabled.currentPathRows === selectorPreview.enabledMode.summary.currentPathRows && enabled.excludedRows === selectorPreview.enabledMode.summary.excludedRows && enabled.blockedRows === selectorPreview.enabledMode.summary.blockedRows, `actual ${enabled.v82Rows}/${enabled.currentPathRows}/${enabled.excludedRows}/${enabled.blockedRows}; expected ${selectorPreview.enabledMode.summary.v82Rows}/${selectorPreview.enabledMode.summary.currentPathRows}/${selectorPreview.enabledMode.summary.excludedRows}/${selectorPreview.enabledMode.summary.blockedRows}`),
    gate("enabled_mode_matches_readiness_counts", enabled.v82Rows === readiness.summary.wouldUseV82UnderFlag && enabled.currentPathRows === readiness.summary.wouldUseCurrentPathUnderFlag && enabled.excludedRows === readiness.summary.excludedFromFlagPool && enabled.blockedRows === readiness.summary.blockedFromFlagPool, `actual ${enabled.v82Rows}/${enabled.currentPathRows}/${enabled.excludedRows}/${enabled.blockedRows}; expected ${readiness.summary.wouldUseV82UnderFlag}/${readiness.summary.wouldUseCurrentPathUnderFlag}/${readiness.summary.excludedFromFlagPool}/${readiness.summary.blockedFromFlagPool}`),
    gate("k_rows_not_using_v8_2", enabled.kRowsUsingV82 === 0, `${enabled.kRowsUsingV82} K row(s) selected v8.2.`),
    gate("critical_movers_not_using_v8_2", enabled.criticalMovementRowsUsingV82 === 0, `${enabled.criticalMovementRowsUsingV82} critical movement row(s) selected v8.2.`),
    gate("meaningful_rank_movers_not_using_v8_2", enabled.meaningfulRankMoversUsingV82 === 0, `${enabled.meaningfulRankMoversUsingV82} meaningful rank mover(s) selected v8.2.`),
    gate("legacy_rows_not_using_v8_2", enabled.legacyRowsUsingV82 === 0, `${enabled.legacyRowsUsingV82} legacy/stale row(s) selected v8.2.`),
    gate("missing_artifacts_fail_closed", missingArtifacts.v82Rows === 0, `${missingArtifacts.v82Rows} missing-artifact row(s) selected v8.2.`),
    gate("mismatch_rows_zero", mismatches.length === 0, `${mismatches.length} mismatch row(s).`),
    gate("protected_row_violations_zero", violations.length === 0, `${violations.length} protected-row violation(s).`),
    gate("no_live_outputs_changed", true, "Preview writes only dry-run artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Ranking code paths are not imported or executed."),
    gate("draft_suggestions_unchanged", true, "Draft suggestion code paths are not imported or executed."),
    gate("war_room_unchanged", true, "War Room UI code is not imported or modified."),
  ];
}

function recommendationFor(gates: ProjectionSelectorPipelinePreviewReport["safetyGates"]): ProjectionSelectorPipelinePreviewReport["recommendation"] {
  const failed = gates.filter((gate) => !gate.passed);
  if (!failed.length) return "pipeline_selector_preview_clean";
  if (failed.some((gate) => gate.name.includes("not_using_v8_2") || gate.name.includes("violations") || gate.name === "missing_artifacts_fail_closed")) return "pipeline_selector_preview_blocked";
  return "pipeline_selector_preview_mismatch";
}

function previewRowsByMode(preview: ProjectionV82FeatureFlagPreviewReport) {
  return {
    disabled: new Map(preview.disabledMode.rows.map((row) => [row.playerId, row.selectorSelection])),
    enabled: new Map(preview.enabledMode.rows.map((row) => [row.playerId, row.selectorSelection])),
  };
}

function movementSummary(segment: string, rows: ProjectionSelectorPipelinePreviewRow[]): ProjectionSelectorPipelinePreviewMovementSummary {
  const deltas = rows.map((row) => row.projectedTotalDeltaVsCurrent).filter((value): value is number => value !== null);
  return {
    segment,
    rows: rows.length,
    averageProjectedTotalDeltaVsCurrent: mean(deltas),
    maxAbsProjectedTotalDeltaVsCurrent: deltas.length ? round(Math.max(...deltas.map((value) => Math.abs(value)))) : null,
    rowsMoving5Plus: deltas.filter((value) => Math.abs(value) >= 5).length,
    rowsMoving10Plus: deltas.filter((value) => Math.abs(value) >= 10).length,
    rowsMoving20Plus: deltas.filter((value) => Math.abs(value) >= 20).length,
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

function mismatch(row: ProjectionSelectorPipelinePreviewRow, expected: ProjectionSelectorPipelinePreviewMismatch["expected"], actual: ProjectionSelectorPipelinePreviewMismatch["actual"], reason: string): ProjectionSelectorPipelinePreviewMismatch {
  return { playerId: row.playerId, player: row.player, position: row.position, team: row.team, expected, actual, reason };
}

function movementBucketFor(delta: number) {
  const absolute = Math.abs(delta);
  if (absolute === 0) return "0";
  if (absolute < 5) return "0-5";
  if (absolute < 10) return "5-10";
  if (absolute < 20) return "10-20";
  return "20+";
}

function renderMarkdown(report: ProjectionSelectorPipelinePreviewReport) {
  return `# Projection Selector Pipeline Preview ${report.projectionSeason}

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

function renderCsv(report: ProjectionSelectorPipelinePreviewReport) {
  const headers = ["mode", "player_id", "player", "position", "team", "readiness_status", "selector_selection", "selector_reason", "expected_games_model", "current_expected_games", "selected_expected_games", "v82_expected_games", "current_projected_total", "selected_projected_total", "v82_projected_total", "projected_total_delta_vs_current", "movement_bucket", "cohorts", "mismatch_with_selector_preview", "mismatch_with_readiness", "projection_total_mismatch_vs_current", "protected_row_violation"];
  const rows = [...report.disabledMode.rows, ...report.enabledMode.rows].map((row) => [
    row.mode,
    row.playerId,
    row.player,
    row.position,
    row.team ?? "",
    row.readinessStatus,
    row.selectorSelection,
    row.selectorReason,
    row.expectedGamesModel ?? "",
    row.currentExpectedGames ?? "",
    row.selectedExpectedGames ?? "",
    row.v82ExpectedGames ?? "",
    row.currentProjectedTotal ?? "",
    row.selectedProjectedTotal ?? "",
    row.v82ProjectedTotal ?? "",
    row.projectedTotalDeltaVsCurrent ?? "",
    row.movementBucket,
    row.cohorts.join("|"),
    row.mismatchWithSelectorPreview,
    row.mismatchWithReadiness,
    row.projectionTotalMismatchVsCurrent,
    row.protectedRowViolation,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function renderGateTable(gates: ProjectionSelectorPipelinePreviewReport["safetyGates"]) {
  const header = "| Gate | Status | Detail |";
  const divider = "|---|---|---|";
  return [header, divider, ...gates.map((gate) => `| ${gate.name} | ${gate.passed ? "PASS" : "FAIL"} | ${gate.detail} |`)].join("\n");
}

function renderMismatchTable(rows: ProjectionSelectorPipelinePreviewMismatch[]) {
  if (!rows.length) return "No rows.";
  const header = "| Player | Pos | Team | Expected | Actual | Reason |";
  const divider = "|---|---|---|---|---|---|";
  return [header, divider, ...rows.slice(0, 50).map((row) => `| ${row.player} | ${row.position} | ${row.team ?? ""} | ${row.expected ?? ""} | ${row.actual ?? ""} | ${row.reason} |`)].join("\n");
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function countBy(values: string[]) {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function mean(values: number[]) {
  if (!values.length) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
