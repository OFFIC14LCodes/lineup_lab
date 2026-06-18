import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type {
  ProjectionParityAuditRow,
  ProjectionParityEvaluationCohort,
} from "./projection-parity-audit-types";
import { runProjectionParityAudit } from "./projection-parity-audit";
import type {
  ProjectionV82ImpactPreviewRow,
  ProjectionV82IntegrationReviewArtifactPaths,
  ProjectionV82IntegrationReviewInput,
  ProjectionV82IntegrationReviewMetricRow,
  ProjectionV82IntegrationReviewOptions,
  ProjectionV82IntegrationReviewReport,
  ProjectionV82MovementBucket,
  ProjectionV82MovementRisk,
  ProjectionV82MovementSummaryRow,
  ProjectionV82Recommendation,
  ProjectionV82SafetyGate,
} from "./projection-v8-2-integration-review-types";
import type { ProjectionParityAuditReport } from "./projection-parity-audit-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const MODEL = "blackbird_expected_games_v8_2_high_impact_guardrail" as const;
const COHORTS: ProjectionParityEvaluationCohort[] = [
  "all_rows",
  "shared_weighted_rows",
  "v7_only_rows",
  "veteran_prior_sample",
  "rookie",
  "second_year_low_prior",
  "no_prior_stats",
  "low_prior_sample",
  "te_fallback",
  "k_fallback",
  "idp",
  "offense",
  "kicker",
];
const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DL", "LB", "DB", "DST"];
const PPG_BUCKETS = ["0-5 PPG", "5-10 PPG", "10-15 PPG", "15-20 PPG", "20+ PPG"];
const ADJUSTMENT_BUCKETS = ["0", "0-0.5", "0.5-1", "1-2", "2-4", "4+"];

export function runProjectionV82IntegrationReview(options: ProjectionV82IntegrationReviewOptions): ProjectionV82IntegrationReviewReport {
  const parityPath = path.join(OUTPUT_DIR, `projection-parity-audit-${options.targetSeason}.json`);
  const parityAudit = existsSync(parityPath)
    ? JSON.parse(readFileSync(parityPath, "utf8")) as ProjectionParityAuditReport
    : runProjectionParityAudit(options);

  return buildProjectionV82IntegrationReviewFromData({
    parityAudit,
    options,
    sourceArtifacts: {
      parityAudit: existsSync(parityPath) ? parityPath : "generated_in_memory",
      backtest: parityAudit.sourceArtifacts.backtest,
      snapshot: parityAudit.sourceArtifacts.snapshot,
    },
  });
}

export function buildProjectionV82IntegrationReviewFromData(input: ProjectionV82IntegrationReviewInput): ProjectionV82IntegrationReviewReport {
  const rows = comparableRows(input.parityAudit.rows);
  const cohorts = COHORTS.map((cohort) => metricRow(cohort, rows.filter((row) => row.evaluationCohorts.includes(cohort))));
  const positions = POSITIONS.map((position) => metricRow(position, rows.filter((row) => row.position === position)));
  const ppgBuckets = PPG_BUCKETS.map((bucket) => metricRow(bucket, rows.filter((row) => ppgBucket(row) === bucket)));
  const adjustmentBuckets = ADJUSTMENT_BUCKETS.map((bucket) => metricRow(bucket, rows.filter((row) => adjustmentBucket(row) === bucket)));
  const allRows = metricRow("all_rows", rows);
  const impactRows = rows.map(impactRow);
  const sortedImpactRows = [...impactRows]
    .filter((row) => row.projectedTotalPointDelta !== null)
    .sort((a, b) => Math.abs(b.projectedTotalPointDelta ?? 0) - Math.abs(a.projectedTotalPointDelta ?? 0) || a.player.localeCompare(b.player));
  const topMovements = sortedImpactRows.slice(0, 50);
  const safetyGates = buildSafetyGates({
    allRows,
    ppgBuckets,
    cohorts,
    adjustmentBuckets,
    parityAudit: input.parityAudit,
  });
  const recommendation = recommendationFor(safetyGates, topMovements);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    targetSeason: input.options.targetSeason,
    includeIdp: input.options.includeIdp,
    model: MODEL,
    sourceArtifacts: input.sourceArtifacts ?? {
      parityAudit: "in-memory",
      backtest: input.parityAudit.sourceArtifacts.backtest,
      snapshot: input.parityAudit.sourceArtifacts.snapshot,
    },
    modelQualitySummary: {
      allRows,
      cohorts,
      positions,
      ppgBuckets,
      adjustmentBuckets,
    },
    safetyGates,
    impactPreview: {
      totalRows: impactRows.length,
      movementBuckets: movementBucketCounts(impactRows),
      riskCounts: riskCounts(impactRows),
      rows: sortedImpactRows,
      topMovements,
    },
    positionImpactSummary: POSITIONS.map((position) => movementSummary(position, impactRows.filter((row) => row.position === position))),
    cohortImpactSummary: COHORTS.map((cohort) => movementSummary(cohort, impactRows.filter((row) => row.cohorts.includes(cohort)))),
    recommendation,
    notes: [
      "Dry-run/read-only integration-readiness review only.",
      "No live projections, 2026 outputs, Supabase writes, War Room UI, Blackbird Rank, or Draft Suggestion ordering are changed.",
    ],
  };
}

export function writeProjectionV82IntegrationReviewArtifacts(report: ProjectionV82IntegrationReviewReport): ProjectionV82IntegrationReviewArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-v8-2-integration-review-${report.targetSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderProjectionV82IntegrationReviewMarkdown(report), "utf8");
  writeFileSync(csvPath, renderProjectionV82IntegrationReviewCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

export function renderProjectionV82IntegrationReviewMarkdown(report: ProjectionV82IntegrationReviewReport): string {
  return `# Projection v8.2 Integration Review ${report.targetSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Model: ${report.model}
Include IDP: ${report.includeIdp}
Recommendation: ${report.recommendation}

## Source Artifacts

- Parity audit: ${report.sourceArtifacts.parityAudit}
- Backtest: ${report.sourceArtifacts.backtest}
- Snapshot: ${report.sourceArtifacts.snapshot}

## Model Quality Summary

${renderMetricTable([report.modelQualitySummary.allRows])}

## Safety Gates

${renderSafetyGateTable(report.safetyGates)}

## Cohort Results

${renderMetricTable(report.modelQualitySummary.cohorts)}

## Position Results

${renderMetricTable(report.modelQualitySummary.positions)}

## PPG Bucket Results

${renderMetricTable(report.modelQualitySummary.ppgBuckets)}

## Adjustment Bucket Results

${renderMetricTable(report.modelQualitySummary.adjustmentBuckets)}

## Impact Preview

Movement buckets:

\`\`\`json
${JSON.stringify(report.impactPreview.movementBuckets, null, 2)}
\`\`\`

Risk counts:

\`\`\`json
${JSON.stringify(report.impactPreview.riskCounts, null, 2)}
\`\`\`

## Top 20 Player Movements

${renderImpactTable(report.impactPreview.topMovements.slice(0, 20))}

## Position Movement Summary

${renderMovementSummaryTable(report.positionImpactSummary)}

## Cohort Movement Summary

${renderMovementSummaryTable(report.cohortImpactSummary)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

export function renderProjectionV82IntegrationReviewCsv(report: ProjectionV82IntegrationReviewReport): string {
  const headers = [
    "player",
    "sleeper_id",
    "gsis_id",
    "position",
    "team",
    "cohorts",
    "ppg_bucket",
    "movement_bucket",
    "risk",
    "risk_flags",
    "v7_expected_games",
    "v82_expected_games",
    "expected_games_delta",
    "ppg_anchor",
    "projected_total_point_delta",
    "actual_games",
    "actual_points",
    "v82_abs_error_delta_vs_v7",
    "guardrail_reason_codes",
  ];
  const rows = report.impactPreview.rows.map((row) => [
    row.player,
    row.sleeperId ?? "",
    row.gsisId ?? "",
    row.position,
    row.team ?? "",
    row.cohorts.join("|"),
    row.ppgBucket,
    row.movementBucket,
    row.risk,
    row.riskFlags.join("|"),
    row.v7ExpectedGames ?? "",
    row.v82ExpectedGames ?? "",
    row.expectedGamesDelta ?? "",
    row.ppgAnchor ?? "",
    row.projectedTotalPointDelta ?? "",
    row.actualGames,
    row.actualPoints,
    row.v82AbsErrorDeltaVsV7 ?? "",
    row.guardrailReasonCodes.join("|"),
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function buildSafetyGates(input: {
  allRows: ProjectionV82IntegrationReviewMetricRow;
  ppgBuckets: ProjectionV82IntegrationReviewMetricRow[];
  cohorts: ProjectionV82IntegrationReviewMetricRow[];
  adjustmentBuckets: ProjectionV82IntegrationReviewMetricRow[];
  parityAudit: ProjectionParityAuditReport;
}): ProjectionV82SafetyGate[] {
  const ppg20 = input.ppgBuckets.find((row) => row.segment === "20+ PPG");
  const ppg15 = input.ppgBuckets.find((row) => row.segment === "15-20 PPG");
  const rookie = input.cohorts.find((row) => row.segment === "rookie");
  const lowPrior = input.cohorts.find((row) => row.segment === "low_prior_sample");
  const largeAdjustment = input.adjustmentBuckets.find((row) => row.segment === "4+");
  const distinctRate = input.allRows.v82DifferentFromV7Rate ?? 0;

  return [
    gate("overall_total_mae_better_than_v7", le(input.allRows.v82TotalMae, input.allRows.v7TotalMae), `${input.allRows.v82TotalMae ?? "n/a"} vs ${input.allRows.v7TotalMae ?? "n/a"}`),
    gate("overall_games_mae_better_than_v7", le(input.allRows.v82GamesMae, input.allRows.v7GamesMae), `${input.allRows.v82GamesMae ?? "n/a"} vs ${input.allRows.v7GamesMae ?? "n/a"}`),
    gate("overall_rmse_better_than_v7", le(input.allRows.v82TotalRmse, input.allRows.v7TotalRmse), `${input.allRows.v82TotalRmse ?? "n/a"} vs ${input.allRows.v7TotalRmse ?? "n/a"}`),
    gate("20_plus_ppg_not_worse_than_v7", le(ppg20?.v82TotalMae ?? null, ppg20?.v7TotalMae ?? null), `${ppg20?.v82TotalMae ?? "n/a"} vs ${ppg20?.v7TotalMae ?? "n/a"}`),
    gate("15_20_ppg_not_worse_than_v7", le(ppg15?.v82TotalMae ?? null, ppg15?.v7TotalMae ?? null), `${ppg15?.v82TotalMae ?? "n/a"} vs ${ppg15?.v7TotalMae ?? "n/a"}`),
    gate(
      "rookie_low_prior_not_worse_than_v7",
      le(rookie?.v82TotalMae ?? null, rookie?.v7TotalMae ?? null) && le(lowPrior?.v82TotalMae ?? null, lowPrior?.v7TotalMae ?? null),
      `rookie ${rookie?.v82TotalMae ?? "n/a"} vs ${rookie?.v7TotalMae ?? "n/a"}; low_prior ${lowPrior?.v82TotalMae ?? "n/a"} vs ${lowPrior?.v7TotalMae ?? "n/a"}`
    ),
    gate("te_fallback_parity_clean", fallbackClean(input.parityAudit, "TE"), `missing ${input.parityAudit.fallbackAudit.TE.fallbackMissingRows}; mismatch ${input.parityAudit.fallbackAudit.TE.baselineMismatchRows}`),
    gate("k_fallback_parity_clean", fallbackClean(input.parityAudit, "K"), `missing ${input.parityAudit.fallbackAudit.K.fallbackMissingRows}; mismatch ${input.parityAudit.fallbackAudit.K.baselineMismatchRows}`),
    gate("v8_2_distinct_from_v7", distinctRate >= 0.1, `${input.allRows.v82DifferentFromV7Rows}/${input.allRows.rows} (${distinctRate})`),
    gate("large_adjustment_bucket_controlled", (largeAdjustment?.rows ?? 0) === 0 || le(largeAdjustment?.v82TotalMae ?? null, largeAdjustment?.v7TotalMae ?? null), `${largeAdjustment?.rows ?? 0} rows; delta ${largeAdjustment?.v82TotalMaeDeltaVsV7 ?? "n/a"}`),
    gate("no_live_outputs_changed", true, "Report-only module; no live output writer is called."),
  ];
}

function impactRow(row: ProjectionParityAuditRow): ProjectionV82ImpactPreviewRow {
  const expectedGamesDelta = nullableDiff(row.v82.games, row.v7.games);
  const ppgAnchor = row.v7.ppg;
  const projectedTotalPointDelta = nullableDiff(row.v82.total, row.v7.total);
  const movementBucket = movementBucketFor(projectedTotalPointDelta);
  const risk = riskFor(movementBucket);
  const riskFlags = riskFlagsFor(row, expectedGamesDelta, ppgAnchor);
  const v7Abs = row.v7.errorTotal === null ? null : Math.abs(row.v7.errorTotal);
  const v82Abs = row.v82.errorTotal === null ? null : Math.abs(row.v82.errorTotal);
  return {
    player: row.player,
    sleeperId: row.sleeperId,
    gsisId: row.gsisId,
    position: row.position,
    team: row.team,
    cohorts: row.evaluationCohorts,
    ppgBucket: ppgBucket(row),
    movementBucket,
    risk,
    riskFlags,
    v7ExpectedGames: row.v7.games,
    v82ExpectedGames: row.v82.games,
    expectedGamesDelta,
    ppgAnchor,
    projectedTotalPointDelta,
    actualGames: row.actualGames,
    actualPoints: row.actualPoints,
    v82AbsErrorDeltaVsV7: v7Abs === null || v82Abs === null ? null : round(v82Abs - v7Abs),
    guardrailReasonCodes: row.snapshotDiagnostics?.v82GuardrailReasonCodes ?? [],
  };
}

function metricRow(segment: string, rows: ProjectionParityAuditRow[]): ProjectionV82IntegrationReviewMetricRow {
  const comparable = comparableRows(rows);
  const v82DifferentFromV7 = comparable.filter(v82DiffersFromV7).length;
  const v82DifferentFromV81 = comparable.filter(v82DiffersFromV81).length;
  return {
    segment,
    rows: comparable.length,
    v7GamesMae: mae(comparable.map((row) => row.v7.errorGames)),
    v81GamesMae: mae(comparable.map((row) => row.v81.errorGames)),
    v82GamesMae: mae(comparable.map((row) => row.v82.errorGames)),
    v82GamesMaeDeltaVsV7: deltaMae(comparable.map((row) => row.v82.errorGames), comparable.map((row) => row.v7.errorGames)),
    v82GamesMaeDeltaVsV81: deltaMae(comparable.map((row) => row.v82.errorGames), comparable.map((row) => row.v81.errorGames)),
    v7TotalMae: mae(comparable.map((row) => row.v7.errorTotal)),
    v81TotalMae: mae(comparable.map((row) => row.v81.errorTotal)),
    v82TotalMae: mae(comparable.map((row) => row.v82.errorTotal)),
    v82TotalMaeDeltaVsV7: deltaMae(comparable.map((row) => row.v82.errorTotal), comparable.map((row) => row.v7.errorTotal)),
    v82TotalMaeDeltaVsV81: deltaMae(comparable.map((row) => row.v82.errorTotal), comparable.map((row) => row.v81.errorTotal)),
    v7TotalRmse: rmse(comparable.map((row) => row.v7.errorTotal)),
    v81TotalRmse: rmse(comparable.map((row) => row.v81.errorTotal)),
    v82TotalRmse: rmse(comparable.map((row) => row.v82.errorTotal)),
    v82TotalRmseDeltaVsV7: deltaRmse(comparable.map((row) => row.v82.errorTotal), comparable.map((row) => row.v7.errorTotal)),
    v82TotalRmseDeltaVsV81: deltaRmse(comparable.map((row) => row.v82.errorTotal), comparable.map((row) => row.v81.errorTotal)),
    v7TotalBias: mean(comparable.map((row) => row.v7.errorTotal)),
    v81TotalBias: mean(comparable.map((row) => row.v81.errorTotal)),
    v82TotalBias: mean(comparable.map((row) => row.v82.errorTotal)),
    v82TotalBiasDeltaVsV7: diff(mean(comparable.map((row) => row.v82.errorTotal)), mean(comparable.map((row) => row.v7.errorTotal))),
    v82TotalBiasDeltaVsV81: diff(mean(comparable.map((row) => row.v82.errorTotal)), mean(comparable.map((row) => row.v81.errorTotal))),
    v82DifferentFromV7Rows: v82DifferentFromV7,
    v82DifferentFromV7Rate: comparable.length ? round(v82DifferentFromV7 / comparable.length) : null,
    v82DifferentFromV81Rows: v82DifferentFromV81,
    v82DifferentFromV81Rate: comparable.length ? round(v82DifferentFromV81 / comparable.length) : null,
  };
}

function movementSummary(segment: string, rows: ProjectionV82ImpactPreviewRow[]): ProjectionV82MovementSummaryRow {
  return {
    segment,
    rows: rows.length,
    move5Plus: rows.filter((row) => Math.abs(row.projectedTotalPointDelta ?? 0) >= 5).length,
    move10Plus: rows.filter((row) => Math.abs(row.projectedTotalPointDelta ?? 0) >= 10).length,
    move20Plus: rows.filter((row) => Math.abs(row.projectedTotalPointDelta ?? 0) >= 20).length,
  };
}

function recommendationFor(gates: ProjectionV82SafetyGate[], topMovements: ProjectionV82ImpactPreviewRow[]): ProjectionV82Recommendation {
  const failed = gates.filter((gate) => !gate.passed);
  if (failed.length) return "remain_experimental";
  if (topMovements.some((row) => row.risk === "critical")) return "integration_review_candidate";
  if (topMovements.some((row) => row.risk === "high")) return "ready_for_shadow_projection";
  return "ready_for_live_promotion";
}

function riskFlagsFor(row: ProjectionParityAuditRow, expectedGamesDelta: number | null, ppgAnchor: number | null): string[] {
  const flags = new Set<string>();
  if ((ppgAnchor ?? 0) >= 15) flags.add("elite_ppg_player");
  if (row.evaluationCohorts.some((cohort) => ["rookie", "low_prior_sample", "v7_only_rows", "second_year_low_prior", "no_prior_stats"].includes(cohort))) flags.add("rookie_or_low_prior");
  if (["QB", "RB", "WR", "TE"].includes(row.position)) flags.add("high_value_position");
  if (row.position === "QB") flags.add("qb_superflex_sensitive");
  if (["DL", "LB", "DB"].includes(row.position)) flags.add("idp_row");
  if (row.evaluationCohorts.includes("te_fallback") || row.evaluationCohorts.includes("k_fallback")) flags.add("fallback_row");
  if (Math.abs(expectedGamesDelta ?? 0) >= 2) flags.add("large_games_movement");
  if (row.snapshotDiagnostics?.v82GuardrailApplied) flags.add("guardrail_applied");
  return [...flags];
}

function movementBucketCounts(rows: ProjectionV82ImpactPreviewRow[]): Record<ProjectionV82MovementBucket, number> {
  return {
    "0": rows.filter((row) => row.movementBucket === "0").length,
    "0-5": rows.filter((row) => row.movementBucket === "0-5").length,
    "5-10": rows.filter((row) => row.movementBucket === "5-10").length,
    "10-20": rows.filter((row) => row.movementBucket === "10-20").length,
    "20+": rows.filter((row) => row.movementBucket === "20+").length,
  };
}

function riskCounts(rows: ProjectionV82ImpactPreviewRow[]): Record<ProjectionV82MovementRisk, number> {
  return {
    low: rows.filter((row) => row.risk === "low").length,
    moderate: rows.filter((row) => row.risk === "moderate").length,
    high: rows.filter((row) => row.risk === "high").length,
    critical: rows.filter((row) => row.risk === "critical").length,
  };
}

function movementBucketFor(delta: number | null): ProjectionV82MovementBucket {
  const absolute = Math.abs(delta ?? 0);
  if (absolute === 0) return "0";
  if (absolute < 5) return "0-5";
  if (absolute < 10) return "5-10";
  if (absolute < 20) return "10-20";
  return "20+";
}

function riskFor(bucket: ProjectionV82MovementBucket): ProjectionV82MovementRisk {
  if (bucket === "20+") return "critical";
  if (bucket === "10-20") return "high";
  if (bucket === "5-10") return "moderate";
  return "low";
}

function ppgBucket(row: ProjectionParityAuditRow) {
  const ppg = row.v7.ppg ?? row.actualPpg ?? 0;
  if (ppg < 5) return "0-5 PPG";
  if (ppg < 10) return "5-10 PPG";
  if (ppg < 15) return "10-15 PPG";
  if (ppg < 20) return "15-20 PPG";
  return "20+ PPG";
}

function adjustmentBucket(row: ProjectionParityAuditRow) {
  const delta = Math.abs((row.v82.games ?? 0) - (row.v7.games ?? 0));
  if (delta === 0) return "0";
  if (delta <= 0.5) return "0-0.5";
  if (delta <= 1) return "0.5-1";
  if (delta <= 2) return "1-2";
  if (delta <= 4) return "2-4";
  return "4+";
}

function comparableRows(rows: ProjectionParityAuditRow[]) {
  return rows.filter((row) => row.v7.total !== null && row.v81.total !== null && row.v82.total !== null);
}

function fallbackClean(report: ProjectionParityAuditReport, position: "TE" | "K") {
  const audit = report.fallbackAudit[position];
  return audit.fallbackMissingRows === 0 && audit.baselineMismatchRows === 0 && audit.fallbackAppliedRows === audit.rows;
}

function v82DiffersFromV7(row: ProjectionParityAuditRow) {
  return row.v7.ppg !== row.v82.ppg || row.v7.games !== row.v82.games || row.v7.total !== row.v82.total;
}

function v82DiffersFromV81(row: ProjectionParityAuditRow) {
  return row.v81.ppg !== row.v82.ppg || row.v81.games !== row.v82.games || row.v81.total !== row.v82.total;
}

function renderMetricTable(rows: ProjectionV82IntegrationReviewMetricRow[]) {
  const header = "| Segment | Rows | Games MAE v7 | v8.1 | v8.2 | v8.2 Games vs v7 | Total MAE v7 | v8.1 | v8.2 | v8.2 Total vs v7 | v8.2 Total vs v8.1 | RMSE v7 | v8.2 | v8.2 RMSE vs v7 | Bias v7 | v8.2 | v8.2 Diff vs v7 |";
  const divider = "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|";
  const body = rows.map((row) => `| ${row.segment} | ${row.rows} | ${format(row.v7GamesMae)} | ${format(row.v81GamesMae)} | ${format(row.v82GamesMae)} | ${format(row.v82GamesMaeDeltaVsV7)} | ${format(row.v7TotalMae)} | ${format(row.v81TotalMae)} | ${format(row.v82TotalMae)} | ${format(row.v82TotalMaeDeltaVsV7)} | ${format(row.v82TotalMaeDeltaVsV81)} | ${format(row.v7TotalRmse)} | ${format(row.v82TotalRmse)} | ${format(row.v82TotalRmseDeltaVsV7)} | ${format(row.v7TotalBias)} | ${format(row.v82TotalBias)} | ${row.v82DifferentFromV7Rows} |`);
  return [header, divider, ...body].join("\n");
}

function renderSafetyGateTable(gates: ProjectionV82SafetyGate[]) {
  const header = "| Gate | Status | Detail |";
  const divider = "|---|---|---|";
  const body = gates.map((gate) => `| ${gate.name} | ${gate.passed ? "PASS" : "FAIL"} | ${gate.detail} |`);
  return [header, divider, ...body].join("\n");
}

function renderImpactTable(rows: ProjectionV82ImpactPreviewRow[]) {
  if (!rows.length) return "No rows.";
  const header = "| Player | Pos | Cohorts | v7 G | v8.2 G | Games Delta | PPG | Points Delta | Risk | Flags | Error Delta vs v7 | Reasons |";
  const divider = "|---|---|---|---:|---:|---:|---:|---:|---|---|---:|---|";
  const body = rows.map((row) => `| ${row.player} | ${row.position} | ${row.cohorts.join(" ")} | ${format(row.v7ExpectedGames)} | ${format(row.v82ExpectedGames)} | ${format(row.expectedGamesDelta)} | ${format(row.ppgAnchor)} | ${format(row.projectedTotalPointDelta)} | ${row.risk} | ${row.riskFlags.join(" ")} | ${format(row.v82AbsErrorDeltaVsV7)} | ${row.guardrailReasonCodes.join(" ")} |`);
  return [header, divider, ...body].join("\n");
}

function renderMovementSummaryTable(rows: ProjectionV82MovementSummaryRow[]) {
  const header = "| Segment | Rows | Move 5+ | Move 10+ | Move 20+ |";
  const divider = "|---|---:|---:|---:|---:|";
  const body = rows.map((row) => `| ${row.segment} | ${row.rows} | ${row.move5Plus} | ${row.move10Plus} | ${row.move20Plus} |`);
  return [header, divider, ...body].join("\n");
}

function gate(name: ProjectionV82SafetyGate["name"], passed: boolean, detail: string): ProjectionV82SafetyGate {
  return { name, passed, detail };
}

function le(candidate: number | null, baseline: number | null) {
  if (candidate === null || baseline === null) return false;
  return candidate <= baseline;
}

function nullableDiff(candidate: number | null, baseline: number | null) {
  if (candidate === null || baseline === null) return null;
  return round(candidate - baseline);
}

function mae(values: Array<number | null>) {
  return mean(values.map((value) => value === null ? null : Math.abs(value)));
}

function rmse(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return null;
  return round(Math.sqrt(valid.reduce((sum, value) => sum + value ** 2, 0) / valid.length));
}

function deltaMae(candidate: Array<number | null>, baseline: Array<number | null>) {
  return diff(mae(candidate), mae(baseline));
}

function deltaRmse(candidate: Array<number | null>, baseline: Array<number | null>) {
  return diff(rmse(candidate), rmse(baseline));
}

function mean(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return null;
  return round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function diff(candidate: number | null, baseline: number | null) {
  if (candidate === null || baseline === null) return null;
  return round(candidate - baseline);
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function format(value: number | null) {
  return value === null ? "n/a" : String(value);
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
