import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES } from "@/lib/projections/feature-flags";

import type { ProjectionSelectorPipelinePreviewReport, ProjectionSelectorPipelinePreviewRow } from "./projection-selector-pipeline-preview-types";
import type {
  ProjectionProductionImpactPreview,
  ProjectionProductionImpactRow,
  ProjectionProductionPathAuditRow,
  ProjectionProductionSegmentImpact,
  ProjectionProductionShadowReviewArtifactPaths,
  ProjectionProductionShadowReviewInput,
  ProjectionProductionShadowReviewOptions,
  ProjectionProductionShadowReviewReport,
  ProjectionProductionShadowReviewSummary,
} from "./projection-production-shadow-review-types";
import type { ProjectionV82FeatureFlagReadinessReport, ProjectionV82FeatureFlagReadinessRow } from "./projection-v8-2-feature-flag-readiness-types";
import type { ProjectionV82ShadowReport, ProjectionV82ShadowRow } from "./projection-v8-2-shadow-types";
import type { ProjectionV82SnapshotDiffGuardReport } from "./projection-v8-2-snapshot-diff-guard-types";
import type { ProjectionFoundationHandoffReport } from "./projection-foundation-handoff-report-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");

export function runProjectionProductionShadowReview(options: ProjectionProductionShadowReviewOptions): ProjectionProductionShadowReviewReport {
  const pipelinePreviewPath = path.join(OUTPUT_DIR, `projection-selector-pipeline-preview-${options.projectionSeason}.json`);
  const readinessPath = path.join(OUTPUT_DIR, `projection-v8-2-feature-flag-readiness-${options.projectionSeason}.json`);
  const shadowPath = path.join(OUTPUT_DIR, `projection-v8-2-shadow-${options.projectionSeason}.json`);
  const snapshotDiffGuardPath = path.join(OUTPUT_DIR, `projection-v8-2-snapshot-diff-guard-${options.projectionSeason}.json`);
  const foundationHandoffPath = path.join(OUTPUT_DIR, `projection-foundation-handoff-${options.projectionSeason}.json`);
  for (const artifactPath of [pipelinePreviewPath, readinessPath, shadowPath, snapshotDiffGuardPath, foundationHandoffPath]) {
    if (!existsSync(artifactPath)) throw new Error(`Missing ${path.relative(process.cwd(), artifactPath)}.`);
  }

  const pipelinePreview = JSON.parse(readFileSync(pipelinePreviewPath, "utf8")) as ProjectionSelectorPipelinePreviewReport;
  const readiness = JSON.parse(readFileSync(readinessPath, "utf8")) as ProjectionV82FeatureFlagReadinessReport;
  const shadow = JSON.parse(readFileSync(shadowPath, "utf8")) as ProjectionV82ShadowReport;
  const snapshotDiffGuard = JSON.parse(readFileSync(snapshotDiffGuardPath, "utf8")) as ProjectionV82SnapshotDiffGuardReport;
  const foundationHandoff = JSON.parse(readFileSync(foundationHandoffPath, "utf8")) as ProjectionFoundationHandoffReport;

  return buildProjectionProductionShadowReviewFromData({
    options,
    pipelinePreview,
    readinessRows: readiness.rows,
    shadowRows: shadow.rows,
    snapshotDiffGuardRecommendation: snapshotDiffGuard.recommendation,
    foundationHandoffRecommendation: foundationHandoff.currentRecommendation,
    sourceArtifacts: {
      pipelinePreview: pipelinePreviewPath,
      readiness: readinessPath,
      shadow: shadowPath,
      snapshotDiffGuard: snapshotDiffGuardPath,
      foundationHandoff: foundationHandoffPath,
    },
  });
}

export function buildProjectionProductionShadowReviewFromData(input: ProjectionProductionShadowReviewInput): ProjectionProductionShadowReviewReport {
  const productionPathAudit = buildProductionPathAudit();
  const impactPreview = buildImpactPreview(input.pipelinePreview.enabledMode.rows, input.readinessRows, input.shadowRows);
  const summary = buildSummary(input.pipelinePreview, input.shadowRows);
  const safetyGates = buildSafetyGates(input.pipelinePreview, summary, impactPreview, input.snapshotDiffGuardRecommendation, input.foundationHandoffRecommendation);
  const recommendation = recommendationFor(safetyGates, impactPreview);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    featureFlagName: BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES,
    selectorWiredBeyondDryRun: false,
    sourceArtifacts: input.sourceArtifacts ?? {
      pipelinePreview: "in-memory",
      readiness: "in-memory",
      shadow: "in-memory",
      snapshotDiffGuard: "in-memory",
      foundationHandoff: "in-memory",
    },
    productionPathAudit,
    disabledModeEquivalence: input.pipelinePreview.disabledMode.summary,
    enabledModeShadow: input.pipelinePreview.enabledMode.summary,
    missingArtifactsMode: input.pipelinePreview.missingArtifactsMode.summary,
    summary,
    impactPreview,
    safetyGates,
    recommendation,
    notes: [
      "H14 is a dry-run/read-only production-path shadow review.",
      "The v8.2 selector is not wired into live projection generation, Supabase writes, Blackbird Rank, Draft Suggestions, War Room scoring, or draft room APIs by this report.",
      "Disabled mode must remain current-path-only; missing artifacts fail closed through the existing selector preview.",
      "Draft Suggestion and War Room impact estimates are projection-delta proxies only because live draft room state, roster need, ADP, and recommendation scoring inputs are not replayed here.",
    ],
  };
}

export function writeProjectionProductionShadowReviewArtifacts(report: ProjectionProductionShadowReviewReport): ProjectionProductionShadowReviewArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-production-shadow-review-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function buildProductionPathAudit(): ProjectionProductionPathAuditRow[] {
  return [
    audit("Preseason projection snapshot", "src/lib/projections/backtesting/preseason-projection-snapshot-builder.ts", "Artifact-only historical projection variants; selector diagnostics are dry-run only.", false, false, false, false, true, true, "Backtesting artifact path only."),
    audit("v8.2 feature-flag readiness", "src/lib/projections/backtesting/projection-v8-2-feature-flag-readiness.ts", "Readiness artifact rows and v8.2 shadow artifact.", false, false, false, false, true, true, "Defines safe subset; no live output writes."),
    audit("Selector pipeline preview", "src/lib/projections/backtesting/projection-selector-pipeline-preview.ts", "Readiness + shadow artifacts through selectExpectedGamesModelForProjectionRow.", false, false, false, false, true, true, "Existing disabled/enabled/missing-artifact selector preview."),
    audit("Combined projection read model", "src/lib/projections/combined-projection-read-model.ts", "Latest complete persisted current production projection runs from Supabase.", false, true, true, true, false, true, "Consumes persisted rows; H14 does not wire selector here."),
    audit("Combined projection diagnostic script", "scripts/h9-combined-projection-read-model.ts", "Supabase projection_runs/player_projection_outputs read model.", false, true, true, true, false, true, "Read-only diagnostic; imports Supabase client but does not write."),
    audit("H10 league value model", "src/lib/projections/h10-league-value.ts", "Current combined projection/value rows and market context.", false, true, true, true, false, true, "Downstream consumer; no v8.2 selector integration in H14."),
    audit("War Room value overlay", "src/lib/draft/h10-war-room-overlay.ts", "H10 value overlay rows loaded into draft room state.", false, true, true, true, false, true, "Downstream draft-room input; no selector integration in H14."),
    audit("War Room recommendations", "src/lib/draft/war-room-recommendations.ts", "Current H10 value overlay, roster need, scarcity, and market signals.", false, true, true, true, false, true, "Draft Suggestions remain unchanged by default."),
    audit("Draft room state API", "src/app/api/draft-rooms/[draftRoomId]/state/route.ts", "Persisted draft room projections/recommendations and current preview payloads.", false, true, true, true, false, true, "API behavior is not changed by H14."),
    audit("Pre-draft strategy", "src/app/api/draft-rooms/[draftRoomId]/pre-draft-strategy/route.ts", "Current strategy/read-model inputs.", false, true, true, true, false, true, "Consumer only; no selector integration in H14."),
    audit("AI GM context", "src/lib/ai/war-room-ai-context.ts", "Current War Room board, recommendations, roster, and live state.", false, true, true, true, false, true, "AI context remains current-path by default."),
    audit("Projection persistence scripts", "scripts/h9-league-projection-dry-run.ts and related projection import scripts", "Current projection builders and dry-run/persisted current path.", true, true, true, true, false, false, "Not safe to wire until production generation and Supabase writes are explicitly separated."),
  ];
}

function buildSummary(pipeline: ProjectionSelectorPipelinePreviewReport, shadowRows: ProjectionV82ShadowRow[]): ProjectionProductionShadowReviewSummary {
  const enabled = pipeline.enabledMode.summary;
  const enabledRows = pipeline.enabledMode.rows;
  const deltas = enabledRows.map((row) => row.projectedTotalDeltaVsCurrent).filter((value): value is number => value !== null && value !== 0);
  const overallRankMovements = shadowRows.map((row) => row.estimatedOverallRankMovement).filter((value): value is number => value !== null && value !== 0);
  const positionRankMovements = shadowRows.map((row) => row.estimatedPositionRankMovement).filter((value): value is number => value !== null && value !== 0);

  return {
    totalProjectionRows: enabled.rowsEvaluated,
    currentPathRows: enabled.currentPathRows,
    v82ShadowRows: enabled.v82Rows,
    excludedRows: enabled.excludedRows,
    blockedRows: enabled.blockedRows,
    kRowsUsingV82: enabled.kRowsUsingV82,
    criticalMoversUsingV82: enabled.criticalMovementRowsUsingV82,
    meaningfulRankMoversUsingV82: enabled.meaningfulRankMoversUsingV82,
    legacyRowsUsingV82: enabled.legacyRowsUsingV82,
    missingArtifactFallbackRows: pipeline.missingArtifactsMode.summary.currentPathRows,
    projectionPointDeltas: {
      rowsWithDelta: enabled.rankingAffectingOutputDeltaRows,
      maxAbsDelta: enabled.maxProjectionDeltaVsCurrent,
      averageAbsDelta: deltas.length ? round(mean(deltas.map((value) => Math.abs(value)))) : null,
    },
    rankImpactDeltas: {
      rowsWithEstimatedOverallRankMovement: overallRankMovements.length,
      rowsWithEstimatedPositionRankMovement: positionRankMovements.length,
      maxAbsOverallRankMovement: maxAbs(overallRankMovements),
      maxAbsPositionRankMovement: maxAbs(positionRankMovements),
    },
    draftSuggestionImpactEstimate: {
      estimatedRowsWithPointDelta: enabled.rankingAffectingOutputDeltaRows,
      limitation: "Projection-delta proxy only; live draft room availability, roster need, ADP, and recommendation scoring are not replayed.",
    },
    warRoomImpactEstimate: {
      estimatedRowsWithPointDelta: enabled.rankingAffectingOutputDeltaRows,
      limitation: "Projection-delta proxy only; War Room board/value/recommendation order is not recalculated.",
    },
  };
}

function buildImpactPreview(
  enabledRows: ProjectionSelectorPipelinePreviewRow[],
  readinessRows: ProjectionV82FeatureFlagReadinessRow[],
  shadowRows: ProjectionV82ShadowRow[],
): ProjectionProductionImpactPreview {
  const readinessById = new Map(readinessRows.map((row) => [row.playerId, row]));
  const shadowById = new Map(shadowRows.map((row) => [row.playerId, row]));
  const impactRows = enabledRows.map((row) => impactRow(row, readinessById.get(row.playerId) ?? null, shadowById.get(row.playerId) ?? null));
  const v82ImpactRows = impactRows.filter((row) => row.projectedTotalDeltaVsCurrent !== null && row.projectedTotalDeltaVsCurrent !== 0);
  const protectedRows = impactRows.filter((row) => row.preservedByPolicy);
  const blackbirdRankRows = impactRows.filter((row) => row.estimatedOverallRankMovement !== null && row.estimatedOverallRankMovement !== 0);
  const missingDataNotes = [
    "Draft Suggestion movement is estimated from projection deltas only; live room availability, roster need, wait plans, ADP, scarcity, and recommendation scoring are not replayed.",
    "War Room value movement is estimated from projection deltas only; live value overlay and draft room APIs are not recalculated.",
  ];
  if (!blackbirdRankRows.length) {
    missingDataNotes.push("Estimated Blackbird Rank movement fields were unavailable or zero in the shadow artifact.");
  }

  return {
    topProjectedPointDeltas: topByAbs(v82ImpactRows, (row) => row.projectedTotalDeltaVsCurrent, 25),
    topEstimatedBlackbirdRankMovementRows: topByAbs(blackbirdRankRows, (row) => row.estimatedOverallRankMovement, 25),
    topEstimatedDraftSuggestionMovementRows: topByAbs(v82ImpactRows, (row) => row.projectedTotalDeltaVsCurrent, 25),
    positionsMostAffected: segmentImpact(v82ImpactRows, (row) => row.position).slice(0, 10),
    cohortsMostAffected: segmentImpact(enabledRows, (row) => row.cohorts).slice(0, 10),
    rowsWhereCurrentPathPreservedDueToProtectionPolicy: topByAbs(protectedRows, (row) => row.v82ProjectedTotal !== null && row.currentProjectedTotal !== null ? row.v82ProjectedTotal - row.currentProjectedTotal : row.projectedTotalDeltaVsCurrent, 25),
    blackbirdRankImpactEstimate: blackbirdRankRows.length ? "estimated_from_shadow_rank_fields" : "unavailable",
    draftSuggestionImpactEstimate: v82ImpactRows.length ? "estimated_from_projection_delta_proxy" : "unavailable",
    warRoomImpactEstimate: v82ImpactRows.length ? "estimated_from_projection_delta_proxy" : "unavailable",
    missingDataNotes,
  };
}

function buildSafetyGates(
  pipeline: ProjectionSelectorPipelinePreviewReport,
  summary: ProjectionProductionShadowReviewSummary,
  impactPreview: ProjectionProductionImpactPreview,
  snapshotDiffGuardRecommendation: string,
  foundationHandoffRecommendation: string,
) {
  const disabled = pipeline.disabledMode.summary;
  const enabled = pipeline.enabledMode.summary;
  const missing = pipeline.missingArtifactsMode.summary;
  return [
    gate("flag_defaults_disabled", disabled.v82Rows === 0, `${disabled.v82Rows} disabled-mode v8.2 row(s).`),
    gate("disabled_mode_current_path_only", disabled.currentPathRows === disabled.rowsEvaluated && disabled.v82Rows === 0 && disabled.excludedRows === 0 && disabled.blockedRows === 0, `disabled current/v8.2/excluded/blocked ${disabled.currentPathRows}/${disabled.v82Rows}/${disabled.excludedRows}/${disabled.blockedRows}`),
    gate("disabled_mode_projection_equivalent", disabled.projectionTotalMismatchesVsCurrent === 0 && disabled.rankingAffectingOutputDeltaRows === 0 && disabled.maxProjectionDeltaVsCurrent === 0, `mismatches ${disabled.projectionTotalMismatchesVsCurrent}; ranking delta rows ${disabled.rankingAffectingOutputDeltaRows}; max delta ${disabled.maxProjectionDeltaVsCurrent}`),
    gate("no_supabase_writes", true, "H14 reads artifacts and writes only local dry-run report artifacts."),
    gate("rankings_unchanged_by_default", disabled.rankingAffectingOutputDeltaRows === 0, `${disabled.rankingAffectingOutputDeltaRows} disabled-mode ranking-affecting delta row(s).`),
    gate("draft_suggestions_unchanged_by_default", disabled.rankingAffectingOutputDeltaRows === 0, "Draft Suggestion inputs remain current path in disabled mode."),
    gate("war_room_unchanged_by_default", disabled.rankingAffectingOutputDeltaRows === 0, "War Room projection/value inputs remain current path in disabled mode."),
    gate("enabled_shadow_matches_safe_subset", pipeline.recommendation === "pipeline_selector_preview_clean", pipeline.recommendation),
    gate("k_rows_protected", enabled.kRowsUsingV82 === 0 && summary.kRowsUsingV82 === 0, `${summary.kRowsUsingV82} K row(s) using v8.2.`),
    gate("critical_movers_protected", enabled.criticalMovementRowsUsingV82 === 0 && summary.criticalMoversUsingV82 === 0, `${summary.criticalMoversUsingV82} critical mover(s) using v8.2.`),
    gate("meaningful_rank_movers_protected", enabled.meaningfulRankMoversUsingV82 === 0 && summary.meaningfulRankMoversUsingV82 === 0, `${summary.meaningfulRankMoversUsingV82} meaningful rank mover(s) using v8.2.`),
    gate("legacy_rows_blocked", enabled.legacyRowsUsingV82 === 0 && summary.legacyRowsUsingV82 === 0, `${summary.legacyRowsUsingV82} legacy/stale row(s) using v8.2.`),
    gate("missing_artifacts_fail_closed", missing.v82Rows === 0, `${missing.v82Rows} missing-artifact v8.2 row(s).`),
    gate("impact_preview_generated", impactPreview.topProjectedPointDeltas.length > 0 || enabled.v82Rows === 0, `${impactPreview.topProjectedPointDeltas.length} top point-delta row(s).`),
    gate("snapshot_diff_guard_clean", snapshotDiffGuardRecommendation === "snapshot_diff_guard_clean", snapshotDiffGuardRecommendation),
    gate("foundation_handoff_ready", foundationHandoffRecommendation === "foundation_ready_for_disabled_flag_code_review", foundationHandoffRecommendation),
  ];
}

function recommendationFor(gates: ProjectionProductionShadowReviewReport["safetyGates"], impactPreview: ProjectionProductionImpactPreview): ProjectionProductionShadowReviewReport["recommendation"] {
  const failed = gates.filter((gateRow) => !gateRow.passed);
  if (failed.some((gateRow) => [
    "disabled_mode_current_path_only",
    "disabled_mode_projection_equivalent",
    "k_rows_protected",
    "critical_movers_protected",
    "meaningful_rank_movers_protected",
    "legacy_rows_blocked",
    "missing_artifacts_fail_closed",
  ].includes(gateRow.name))) return "production_shadow_blocked";
  if (failed.length) return "production_shadow_needs_review";
  if (impactPreview.blackbirdRankImpactEstimate === "estimated_from_shadow_rank_fields" && impactPreview.topEstimatedBlackbirdRankMovementRows.length > 0) return "production_shadow_needs_review";
  return "production_shadow_clean";
}

function impactRow(row: ProjectionSelectorPipelinePreviewRow, readiness: ProjectionV82FeatureFlagReadinessRow | null, shadow: ProjectionV82ShadowRow | null): ProjectionProductionImpactRow {
  return {
    playerId: row.playerId,
    player: row.player,
    position: row.position,
    team: row.team,
    currentProjectedTotal: row.currentProjectedTotal,
    selectedProjectedTotal: row.selectedProjectedTotal,
    v82ProjectedTotal: row.v82ProjectedTotal,
    projectedTotalDeltaVsCurrent: row.projectedTotalDeltaVsCurrent,
    currentOverallRank: shadow?.currentOverallRank ?? null,
    shadowOverallRank: shadow?.shadowOverallRank ?? null,
    estimatedOverallRankMovement: shadow?.estimatedOverallRankMovement ?? null,
    currentPositionRank: shadow?.currentPositionRank ?? null,
    shadowPositionRank: shadow?.shadowPositionRank ?? null,
    estimatedPositionRankMovement: shadow?.estimatedPositionRankMovement ?? null,
    selectorReason: row.selectorReason,
    preservedByPolicy: row.selectorSelection === "current_path" && (readiness?.protectionReasons.length ?? 0) > 0,
    protectionReasons: readiness?.protectionReasons ?? [],
  };
}

function segmentImpact<T>(rows: T[], selector: (row: T) => string | string[]): ProjectionProductionSegmentImpact[] {
  const groups = new Map<string, ProjectionProductionImpactRow[]>();
  for (const row of rows) {
    const impact = isImpactRow(row) ? row : null;
    if (!impact) continue;
    const keys = selector(row);
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      if (!key) continue;
      const group = groups.get(key) ?? [];
      group.push(impact);
      groups.set(key, group);
    }
  }
  return [...groups.entries()]
    .map(([segment, groupRows]) => {
      const deltas = groupRows.map((row) => row.projectedTotalDeltaVsCurrent).filter((value): value is number => value !== null);
      return {
        segment,
        rows: groupRows.length,
        averageProjectedTotalDeltaVsCurrent: deltas.length ? round(mean(deltas)) : null,
        maxAbsProjectedTotalDeltaVsCurrent: maxAbs(deltas),
      };
    })
    .sort((a, b) => (b.maxAbsProjectedTotalDeltaVsCurrent ?? -1) - (a.maxAbsProjectedTotalDeltaVsCurrent ?? -1) || b.rows - a.rows || a.segment.localeCompare(b.segment));
}

function isImpactRow(value: unknown): value is ProjectionProductionImpactRow {
  return Boolean(value && typeof value === "object" && "projectedTotalDeltaVsCurrent" in value);
}

function topByAbs<T>(rows: T[], selector: (row: T) => number | null, limit: number): T[] {
  return [...rows]
    .sort((a, b) => Math.abs(selector(b) ?? 0) - Math.abs(selector(a) ?? 0))
    .slice(0, limit);
}

function audit(pathName: string, file: string, currentModelSource: string, writesToSupabase: boolean, affectsRankings: boolean, affectsDraftSuggestions: boolean, affectsWarRoom: boolean, v82SelectorCurrentlyWired: boolean, safeToShadow: boolean, note: string): ProjectionProductionPathAuditRow {
  return { pathName, file, currentModelSource, writesToSupabase, affectsRankings, affectsDraftSuggestions, affectsWarRoom, v82SelectorCurrentlyWired, safeToShadow, note };
}

function renderMarkdown(report: ProjectionProductionShadowReviewReport) {
  return `# Projection Production Shadow Review ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Feature flag: ${report.featureFlagName}
Selector wired beyond dry-run: ${report.selectorWiredBeyondDryRun}
Recommendation: ${report.recommendation}

## Summary

\`\`\`json
${JSON.stringify(report.summary, null, 2)}
\`\`\`

## Production Path Audit

| Path | File | Supabase writes | Rankings | Draft Suggestions | War Room | v8.2 wired | Safe to shadow |
|---|---|---:|---:|---:|---:|---:|---:|
${report.productionPathAudit.map((row) => `| ${row.pathName} | ${row.file} | ${row.writesToSupabase ? "yes" : "no"} | ${row.affectsRankings ? "yes" : "no"} | ${row.affectsDraftSuggestions ? "yes" : "no"} | ${row.affectsWarRoom ? "yes" : "no"} | ${row.v82SelectorCurrentlyWired ? "yes" : "no"} | ${row.safeToShadow ? "yes" : "no"} |`).join("\n")}

## Disabled Mode Equivalence

\`\`\`json
${JSON.stringify(report.disabledModeEquivalence, null, 2)}
\`\`\`

## Enabled Mode Shadow

\`\`\`json
${JSON.stringify(report.enabledModeShadow, null, 2)}
\`\`\`

## Missing Artifacts Mode

\`\`\`json
${JSON.stringify(report.missingArtifactsMode, null, 2)}
\`\`\`

## Impact Preview

- Top projected point delta rows: ${report.impactPreview.topProjectedPointDeltas.length}
- Top estimated Blackbird Rank movement rows: ${report.impactPreview.topEstimatedBlackbirdRankMovementRows.length}
- Top estimated Draft Suggestion movement rows: ${report.impactPreview.topEstimatedDraftSuggestionMovementRows.length}
- Rows preserved by protection policy shown: ${report.impactPreview.rowsWhereCurrentPathPreservedDueToProtectionPolicy.length}

## Safety Gates

${renderGateTable(report.safetyGates)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
${report.impactPreview.missingDataNotes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderCsv(report: ProjectionProductionShadowReviewReport) {
  const headers = ["section", "player_id", "player", "position", "team", "current_projected_total", "selected_projected_total", "v82_projected_total", "projected_total_delta_vs_current", "current_overall_rank", "shadow_overall_rank", "estimated_overall_rank_movement", "selector_reason", "preserved_by_policy", "protection_reasons"];
  const rows = [
    ...report.impactPreview.topProjectedPointDeltas.map((row) => csvRow("top_projected_point_delta", row)),
    ...report.impactPreview.topEstimatedBlackbirdRankMovementRows.map((row) => csvRow("top_blackbird_rank_movement", row)),
    ...report.impactPreview.topEstimatedDraftSuggestionMovementRows.map((row) => csvRow("top_draft_suggestion_proxy", row)),
    ...report.impactPreview.rowsWhereCurrentPathPreservedDueToProtectionPolicy.map((row) => csvRow("protected_current_path", row)),
  ];
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function csvRow(section: string, row: ProjectionProductionImpactRow) {
  return [
    section,
    row.playerId,
    row.player,
    row.position,
    row.team ?? "",
    row.currentProjectedTotal ?? "",
    row.selectedProjectedTotal ?? "",
    row.v82ProjectedTotal ?? "",
    row.projectedTotalDeltaVsCurrent ?? "",
    row.currentOverallRank ?? "",
    row.shadowOverallRank ?? "",
    row.estimatedOverallRankMovement ?? "",
    row.selectorReason,
    row.preservedByPolicy,
    row.protectionReasons.join("|"),
  ];
}

function renderGateTable(gates: ProjectionProductionShadowReviewReport["safetyGates"]) {
  const header = "| Gate | Status | Detail |";
  const divider = "|---|---|---|";
  return [header, divider, ...gates.map((gateRow) => `| ${gateRow.name} | ${gateRow.passed ? "PASS" : "FAIL"} | ${gateRow.detail} |`)].join("\n");
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxAbs(values: number[]) {
  return values.length ? round(Math.max(...values.map((value) => Math.abs(value)))) : null;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
