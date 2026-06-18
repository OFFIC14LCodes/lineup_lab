import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type {
  ProjectionParityAuditReport,
  ProjectionParityAuditRow,
  ProjectionParityEvaluationCohort,
} from "./projection-parity-audit-types";
import { runProjectionParityAudit } from "./projection-parity-audit";
import type {
  ProjectionV8AdjustmentBucketRow,
  ProjectionV8CalibrationArtifactPaths,
  ProjectionV8CalibrationAuditInput,
  ProjectionV8CalibrationAuditOptions,
  ProjectionV8CalibrationAuditReport,
  ProjectionV8CalibrationMetricRow,
  ProjectionV8CalibrationMover,
  ProjectionV8OverUnderCorrectionSummary,
} from "./projection-v8-calibration-audit-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
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

export function runProjectionV8CalibrationAudit(options: ProjectionV8CalibrationAuditOptions): ProjectionV8CalibrationAuditReport {
  const parityPath = path.join(OUTPUT_DIR, `projection-parity-audit-${options.targetSeason}.json`);
  const parityAudit = existsSync(parityPath)
    ? JSON.parse(readFileSync(parityPath, "utf8")) as ProjectionParityAuditReport
    : runProjectionParityAudit(options);
  return buildProjectionV8CalibrationAuditFromData({
    parityAudit,
    options,
    sourceArtifacts: {
      parityAudit: existsSync(parityPath) ? parityPath : "generated_in_memory",
      backtest: parityAudit.sourceArtifacts.backtest,
      snapshot: parityAudit.sourceArtifacts.snapshot,
    },
  });
}

export function buildProjectionV8CalibrationAuditFromData(input: ProjectionV8CalibrationAuditInput): ProjectionV8CalibrationAuditReport {
  const rows = comparableRows(input.parityAudit.rows);
  const v7V82Compared = input.parityAudit.rows.filter((row) => row.v7.total !== null && row.v82.total !== null);
  const v7V82Different = v7V82Compared.filter((row) => row.v7.total !== row.v82.total || row.v7.games !== row.v82.games).length;
  const cohortBreakdowns = COHORTS.map((cohort) => metricRow(cohort, rows.filter((row) => row.evaluationCohorts.includes(cohort))));
  const positionBreakdowns = POSITIONS.map((position) => metricRow(position, rows.filter((row) => row.position === position)));
  const ppgBuckets = PPG_BUCKETS.map((bucket) => metricRow(bucket, rows.filter((row) => ppgBucket(row) === bucket)));
  const adjustmentBuckets = ADJUSTMENT_BUCKETS.map((bucket) => {
    const bucketRows = rows.filter((row) => adjustmentBucket(row) === bucket);
    return {
      ...metricRow(bucket, bucketRows),
      topWorseningRows: topRegressions(bucketRows, 10),
      topImprovingRows: topImprovements(bucketRows, 10),
    };
  });
  const topImprovementsRows = topImprovements(rows, 25);
  const topRegressionsRows = topRegressions(rows, 25);
  const recommendations = calibrationRecommendations({
    cohortBreakdowns,
    positionBreakdowns,
    ppgBuckets,
    adjustmentBuckets,
    topRegressions: topRegressionsRows,
    overUnderCorrection: overUnderCorrection(rows),
  });
  const allRows = metricRow("all_rows", rows);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    targetSeason: input.options.targetSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? {
      parityAudit: "in-memory",
      backtest: input.parityAudit.sourceArtifacts.backtest,
      snapshot: input.parityAudit.sourceArtifacts.snapshot,
    },
    identitySummary: {
      comparedRows: input.parityAudit.v7V8IdentityAudit.comparedRows,
      identicalRows: input.parityAudit.v7V8IdentityAudit.identicalRows,
      differentRows: input.parityAudit.v7V8IdentityAudit.differentRows,
      differentRate: input.parityAudit.v7V8IdentityAudit.differentRate,
    },
    v81IdentitySummary: {
      v7ComparedRows: input.parityAudit.v7V81IdentityAudit.comparedRows,
      v7IdenticalRows: input.parityAudit.v7V81IdentityAudit.identicalRows,
      v7DifferentRows: input.parityAudit.v7V81IdentityAudit.differentRows,
      v7DifferentRate: input.parityAudit.v7V81IdentityAudit.differentRate,
      v8ComparedRows: input.parityAudit.v8V81IdentityAudit.comparedRows,
      v8IdenticalRows: input.parityAudit.v8V81IdentityAudit.identicalRows,
      v8DifferentRows: input.parityAudit.v8V81IdentityAudit.differentRows,
      v8DifferentRate: input.parityAudit.v8V81IdentityAudit.differentRate,
    },
    v82IdentitySummary: {
      v7ComparedRows: v7V82Compared.length,
      v7DifferentRows: v7V82Different,
      v7DifferentRate: v7V82Compared.length ? round(v7V82Different / v7V82Compared.length) : null,
      v81ComparedRows: input.parityAudit.v81V82IdentityAudit.comparedRows,
      v81DifferentRows: input.parityAudit.v81V82IdentityAudit.differentRows,
      v81DifferentRate: input.parityAudit.v81V82IdentityAudit.differentRate,
    },
    cohortBreakdowns,
    positionBreakdowns,
    ppgBuckets,
    adjustmentBuckets,
    overUnderCorrection: overUnderCorrection(rows),
    topImprovements: topImprovementsRows,
    topRegressions: topRegressionsRows,
    recommendations,
    verdict: verdict(allRows),
  };
}

export function writeProjectionV8CalibrationAuditArtifacts(report: ProjectionV8CalibrationAuditReport): ProjectionV8CalibrationArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-v8-calibration-audit-${report.targetSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderProjectionV8CalibrationAuditMarkdown(report), "utf8");
  writeFileSync(csvPath, renderProjectionV8CalibrationAuditCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

export function renderProjectionV8CalibrationAuditMarkdown(report: ProjectionV8CalibrationAuditReport): string {
  return `# Projection v8 Calibration Audit ${report.targetSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Include IDP: ${report.includeIdp}

## Source Artifacts

- Parity audit: ${report.sourceArtifacts.parityAudit}
- Backtest: ${report.sourceArtifacts.backtest}
- Snapshot: ${report.sourceArtifacts.snapshot}

## v7 vs v8 Identity

- Compared rows: ${report.identitySummary.comparedRows}
- Identical rows: ${report.identitySummary.identicalRows}
- Different rows: ${report.identitySummary.differentRows}
- Different rate: ${report.identitySummary.differentRate ?? "n/a"}

## v8.1 Identity

- v7/v8.1 compared rows: ${report.v81IdentitySummary.v7ComparedRows}
- v7/v8.1 different rows: ${report.v81IdentitySummary.v7DifferentRows}
- v7/v8.1 different rate: ${report.v81IdentitySummary.v7DifferentRate ?? "n/a"}
- v8/v8.1 compared rows: ${report.v81IdentitySummary.v8ComparedRows}
- v8/v8.1 different rows: ${report.v81IdentitySummary.v8DifferentRows}
- v8/v8.1 different rate: ${report.v81IdentitySummary.v8DifferentRate ?? "n/a"}

## v8.2 Identity

- v7/v8.2 compared rows: ${report.v82IdentitySummary.v7ComparedRows}
- v7/v8.2 different rows: ${report.v82IdentitySummary.v7DifferentRows}
- v7/v8.2 different rate: ${report.v82IdentitySummary.v7DifferentRate ?? "n/a"}
- v8.1/v8.2 compared rows: ${report.v82IdentitySummary.v81ComparedRows}
- v8.1/v8.2 different rows: ${report.v82IdentitySummary.v81DifferentRows}
- v8.1/v8.2 different rate: ${report.v82IdentitySummary.v81DifferentRate ?? "n/a"}

## Cohort Breakdown

${renderMetricTable(report.cohortBreakdowns)}

## Position Breakdown

${renderMetricTable(report.positionBreakdowns)}

## PPG Buckets

${renderMetricTable(report.ppgBuckets)}

## Adjustment Size Buckets

${renderMetricTable(report.adjustmentBuckets)}

## Over/Under Correction

\`\`\`json
${JSON.stringify(report.overUnderCorrection, null, 2)}
\`\`\`

## Top 10 Improvements

${renderMoverTable(report.topImprovements.slice(0, 10))}

## Top 10 Regressions

${renderMoverTable(report.topRegressions.slice(0, 10))}

## Calibration Recommendations

${report.recommendations.map((recommendation) => `- ${recommendation}`).join("\n")}

## Verdict

${report.verdict}
`;
}

export function renderProjectionV8CalibrationAuditCsv(report: ProjectionV8CalibrationAuditReport): string {
  const rows = [
    ["section", "segment", "rows", "v7_games_mae", "v8_games_mae", "v81_games_mae", "v82_games_mae", "v8_games_mae_delta_vs_v7", "v81_games_mae_delta_vs_v7", "v81_games_mae_delta_vs_v8", "v82_games_mae_delta_vs_v7", "v82_games_mae_delta_vs_v81", "v7_total_mae", "v8_total_mae", "v81_total_mae", "v82_total_mae", "v8_total_mae_delta_vs_v7", "v81_total_mae_delta_vs_v7", "v81_total_mae_delta_vs_v8", "v82_total_mae_delta_vs_v7", "v82_total_mae_delta_vs_v81", "v7_total_rmse", "v8_total_rmse", "v81_total_rmse", "v82_total_rmse", "v8_rmse_delta_vs_v7", "v81_rmse_delta_vs_v7", "v81_rmse_delta_vs_v8", "v82_rmse_delta_vs_v7", "v82_rmse_delta_vs_v81", "v7_total_bias", "v8_total_bias", "v81_total_bias", "v82_total_bias", "v8_bias_delta_vs_v7", "v81_bias_delta_vs_v7", "v81_bias_delta_vs_v8", "v82_bias_delta_vs_v7", "v82_bias_delta_vs_v81", "v8_different_rows", "v8_different_rate", "v81_different_from_v7_rows", "v81_different_from_v7_rate", "v81_different_from_v8_rows", "v81_different_from_v8_rate", "v82_different_from_v7_rows", "v82_different_from_v7_rate", "v82_different_from_v81_rows", "v82_different_from_v81_rate"],
    ...report.cohortBreakdowns.map((row) => csvMetricRow("cohort", row)),
    ...report.positionBreakdowns.map((row) => csvMetricRow("position", row)),
    ...report.ppgBuckets.map((row) => csvMetricRow("ppg_bucket", row)),
    ...report.adjustmentBuckets.map((row) => csvMetricRow("adjustment_bucket", row)),
  ];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function comparableRows(rows: ProjectionParityAuditRow[]) {
  return rows.filter((row) => row.v7.total !== null && row.v8.total !== null && row.v81.total !== null && row.v82.total !== null);
}

function metricRow(segment: string, rows: ProjectionParityAuditRow[]): ProjectionV8CalibrationMetricRow {
  const comparable = comparableRows(rows);
  const differentRows = comparable.filter(v8DiffersFromV7).length;
  const v81DifferentFromV7 = comparable.filter(v81DiffersFromV7).length;
  const v81DifferentFromV8 = comparable.filter(v81DiffersFromV8).length;
  const v82DifferentFromV7 = comparable.filter(v82DiffersFromV7).length;
  const v82DifferentFromV81 = comparable.filter(v82DiffersFromV81).length;
  return {
    segment,
    rows: comparable.length,
    v7GamesMae: mae(comparable.map((row) => row.v7.errorGames)),
    v8GamesMae: mae(comparable.map((row) => row.v8.errorGames)),
    v81GamesMae: mae(comparable.map((row) => row.v81.errorGames)),
    v82GamesMae: mae(comparable.map((row) => row.v82.errorGames)),
    gamesMaeDelta: deltaMae(comparable.map((row) => row.v8.errorGames), comparable.map((row) => row.v7.errorGames)),
    v81GamesMaeDeltaVsV7: deltaMae(comparable.map((row) => row.v81.errorGames), comparable.map((row) => row.v7.errorGames)),
    v81GamesMaeDeltaVsV8: deltaMae(comparable.map((row) => row.v81.errorGames), comparable.map((row) => row.v8.errorGames)),
    v82GamesMaeDeltaVsV7: deltaMae(comparable.map((row) => row.v82.errorGames), comparable.map((row) => row.v7.errorGames)),
    v82GamesMaeDeltaVsV81: deltaMae(comparable.map((row) => row.v82.errorGames), comparable.map((row) => row.v81.errorGames)),
    v7TotalMae: mae(comparable.map((row) => row.v7.errorTotal)),
    v8TotalMae: mae(comparable.map((row) => row.v8.errorTotal)),
    v81TotalMae: mae(comparable.map((row) => row.v81.errorTotal)),
    v82TotalMae: mae(comparable.map((row) => row.v82.errorTotal)),
    totalMaeDelta: deltaMae(comparable.map((row) => row.v8.errorTotal), comparable.map((row) => row.v7.errorTotal)),
    v81TotalMaeDeltaVsV7: deltaMae(comparable.map((row) => row.v81.errorTotal), comparable.map((row) => row.v7.errorTotal)),
    v81TotalMaeDeltaVsV8: deltaMae(comparable.map((row) => row.v81.errorTotal), comparable.map((row) => row.v8.errorTotal)),
    v82TotalMaeDeltaVsV7: deltaMae(comparable.map((row) => row.v82.errorTotal), comparable.map((row) => row.v7.errorTotal)),
    v82TotalMaeDeltaVsV81: deltaMae(comparable.map((row) => row.v82.errorTotal), comparable.map((row) => row.v81.errorTotal)),
    v7TotalRmse: rmse(comparable.map((row) => row.v7.errorTotal)),
    v8TotalRmse: rmse(comparable.map((row) => row.v8.errorTotal)),
    v81TotalRmse: rmse(comparable.map((row) => row.v81.errorTotal)),
    v82TotalRmse: rmse(comparable.map((row) => row.v82.errorTotal)),
    totalRmseDelta: deltaRmse(comparable.map((row) => row.v8.errorTotal), comparable.map((row) => row.v7.errorTotal)),
    v81TotalRmseDeltaVsV7: deltaRmse(comparable.map((row) => row.v81.errorTotal), comparable.map((row) => row.v7.errorTotal)),
    v81TotalRmseDeltaVsV8: deltaRmse(comparable.map((row) => row.v81.errorTotal), comparable.map((row) => row.v8.errorTotal)),
    v82TotalRmseDeltaVsV7: deltaRmse(comparable.map((row) => row.v82.errorTotal), comparable.map((row) => row.v7.errorTotal)),
    v82TotalRmseDeltaVsV81: deltaRmse(comparable.map((row) => row.v82.errorTotal), comparable.map((row) => row.v81.errorTotal)),
    v7TotalBias: mean(comparable.map((row) => row.v7.errorTotal)),
    v8TotalBias: mean(comparable.map((row) => row.v8.errorTotal)),
    v81TotalBias: mean(comparable.map((row) => row.v81.errorTotal)),
    v82TotalBias: mean(comparable.map((row) => row.v82.errorTotal)),
    totalBiasDelta: diff(mean(comparable.map((row) => row.v8.errorTotal)), mean(comparable.map((row) => row.v7.errorTotal))),
    v81TotalBiasDeltaVsV7: diff(mean(comparable.map((row) => row.v81.errorTotal)), mean(comparable.map((row) => row.v7.errorTotal))),
    v81TotalBiasDeltaVsV8: diff(mean(comparable.map((row) => row.v81.errorTotal)), mean(comparable.map((row) => row.v8.errorTotal))),
    v82TotalBiasDeltaVsV7: diff(mean(comparable.map((row) => row.v82.errorTotal)), mean(comparable.map((row) => row.v7.errorTotal))),
    v82TotalBiasDeltaVsV81: diff(mean(comparable.map((row) => row.v82.errorTotal)), mean(comparable.map((row) => row.v81.errorTotal))),
    v8DifferentRowCount: differentRows,
    v8DifferentRowRate: comparable.length ? round(differentRows / comparable.length) : null,
    v81DifferentFromV7RowCount: v81DifferentFromV7,
    v81DifferentFromV7RowRate: comparable.length ? round(v81DifferentFromV7 / comparable.length) : null,
    v81DifferentFromV8RowCount: v81DifferentFromV8,
    v81DifferentFromV8RowRate: comparable.length ? round(v81DifferentFromV8 / comparable.length) : null,
    v82DifferentFromV7RowCount: v82DifferentFromV7,
    v82DifferentFromV7RowRate: comparable.length ? round(v82DifferentFromV7 / comparable.length) : null,
    v82DifferentFromV81RowCount: v82DifferentFromV81,
    v82DifferentFromV81RowRate: comparable.length ? round(v82DifferentFromV81 / comparable.length) : null,
  };
}

function overUnderCorrection(rows: ProjectionParityAuditRow[]): ProjectionV8OverUnderCorrectionSummary {
  const comparable = comparableRows(rows);
  const under = comparable.filter((row) => (row.v7.errorTotal ?? 0) < 0);
  const over = comparable.filter((row) => (row.v7.errorTotal ?? 0) > 0);
  return {
    v7UnderprojectionRows: under.length,
    v8ImprovedUnderprojectionRows: under.filter(v8ImprovedAbsError).length,
    v8OvercorrectedRows: under.filter((row) => (row.v8.errorTotal ?? 0) > 0).length,
    v8WorsenedUnderprojectionRows: under.filter(v8WorsenedAbsError).length,
    v81ImprovedUnderprojectionRows: under.filter(v81ImprovedAbsError).length,
    v81OvercorrectedRows: under.filter((row) => (row.v81.errorTotal ?? 0) > 0).length,
    v81WorsenedUnderprojectionRows: under.filter(v81WorsenedAbsError).length,
    v7OverprojectionRows: over.length,
    v8ImprovedOverprojectionRows: over.filter(v8ImprovedAbsError).length,
    v8WorsenedOverprojectionRows: over.filter(v8WorsenedAbsError).length,
    v8UndercorrectedRows: over.filter((row) => (row.v8.errorTotal ?? 0) < 0).length,
    v81ImprovedOverprojectionRows: over.filter(v81ImprovedAbsError).length,
    v81WorsenedOverprojectionRows: over.filter(v81WorsenedAbsError).length,
    v81UndercorrectedRows: over.filter((row) => (row.v81.errorTotal ?? 0) < 0).length,
    v82ImprovedUnderprojectionRows: under.filter(v82ImprovedAbsError).length,
    v82OvercorrectedRows: under.filter((row) => (row.v82.errorTotal ?? 0) > 0).length,
    v82WorsenedUnderprojectionRows: under.filter(v82WorsenedAbsError).length,
    v82ImprovedOverprojectionRows: over.filter(v82ImprovedAbsError).length,
    v82WorsenedOverprojectionRows: over.filter(v82WorsenedAbsError).length,
    v82UndercorrectedRows: over.filter((row) => (row.v82.errorTotal ?? 0) < 0).length,
  };
}

function topImprovements(rows: ProjectionParityAuditRow[], limit: number): ProjectionV8CalibrationMover[] {
  return comparableRows(rows)
    .map(mover)
    .filter((row) => row.v82TotalAbsErrorDeltaVsV7 !== null && row.v82TotalAbsErrorDeltaVsV7 < 0)
    .sort((a, b) => (a.v82TotalAbsErrorDeltaVsV7 ?? 0) - (b.v82TotalAbsErrorDeltaVsV7 ?? 0) || a.player.localeCompare(b.player))
    .slice(0, limit);
}

function topRegressions(rows: ProjectionParityAuditRow[], limit: number): ProjectionV8CalibrationMover[] {
  return comparableRows(rows)
    .map(mover)
    .filter((row) => row.v82TotalAbsErrorDeltaVsV7 !== null && row.v82TotalAbsErrorDeltaVsV7 > 0)
    .sort((a, b) => (b.v82TotalAbsErrorDeltaVsV7 ?? 0) - (a.v82TotalAbsErrorDeltaVsV7 ?? 0) || a.player.localeCompare(b.player))
    .slice(0, limit);
}

function mover(row: ProjectionParityAuditRow): ProjectionV8CalibrationMover {
  const v7Abs = row.v7.errorTotal === null ? null : Math.abs(row.v7.errorTotal);
  const v8Abs = row.v8.errorTotal === null ? null : Math.abs(row.v8.errorTotal);
  const v81Abs = row.v81.errorTotal === null ? null : Math.abs(row.v81.errorTotal);
  const v82Abs = row.v82.errorTotal === null ? null : Math.abs(row.v82.errorTotal);
  return {
    player: row.player,
    sleeperId: row.sleeperId,
    gsisId: row.gsisId,
    position: row.position,
    team: row.team,
    priorDataGroup: row.priorDataGroup,
    evaluationCohorts: row.evaluationCohorts,
    actualGames: row.actualGames,
    v7ExpectedGames: row.v7.games,
    v8ExpectedGames: row.v8.games,
    v81ExpectedGames: row.v81.games,
    v82ExpectedGames: row.v82.games,
    actualTotalPoints: row.actualPoints,
    v7ProjectedTotal: row.v7.total,
    v8ProjectedTotal: row.v8.total,
    v81ProjectedTotal: row.v81.total,
    v82ProjectedTotal: row.v82.total,
    v7TotalAbsError: v7Abs,
    v8TotalAbsError: v8Abs,
    v81TotalAbsError: v81Abs,
    v82TotalAbsError: v82Abs,
    totalAbsErrorDelta: v7Abs === null || v8Abs === null ? null : round(v8Abs - v7Abs),
    v81TotalAbsErrorDeltaVsV7: v7Abs === null || v81Abs === null ? null : round(v81Abs - v7Abs),
    v81TotalAbsErrorDeltaVsV8: v8Abs === null || v81Abs === null ? null : round(v81Abs - v8Abs),
    v82TotalAbsErrorDeltaVsV7: v7Abs === null || v82Abs === null ? null : round(v82Abs - v7Abs),
    v82TotalAbsErrorDeltaVsV81: v81Abs === null || v82Abs === null ? null : round(v82Abs - v81Abs),
    v8Diagnostics: row.snapshotDiagnostics,
  };
}

function calibrationRecommendations(input: {
  cohortBreakdowns: ProjectionV8CalibrationMetricRow[];
  positionBreakdowns: ProjectionV8CalibrationMetricRow[];
  ppgBuckets: ProjectionV8CalibrationMetricRow[];
  adjustmentBuckets: ProjectionV8AdjustmentBucketRow[];
  topRegressions: ProjectionV8CalibrationMover[];
  overUnderCorrection: ProjectionV8OverUnderCorrectionSummary;
}): string[] {
  const recommendations = new Set<string>();
  recommendations.add("Leave TE/K unchanged; fallback rows remain baseline-equivalent by design.");
  const noPrior = input.cohortBreakdowns.find((row) => row.segment === "no_prior_stats");
  if ((noPrior?.v82TotalMaeDeltaVsV7 ?? 0) > 0) recommendations.add("Investigate no_prior_stats separately before broadening v8.2.");
  const rookie = input.cohortBreakdowns.find((row) => row.segment === "rookie");
  if ((rookie?.v82TotalMaeDeltaVsV7 ?? 0) > 0) recommendations.add("Dampen rookie adjustment or preserve v7 for rookie total-point scoring.");
  const highPpgRegression = input.ppgBuckets.find((row) => ["15-20 PPG", "20+ PPG"].includes(row.segment) && (row.v82TotalMaeDeltaVsV7 ?? 0) > 0);
  if (highPpgRegression) recommendations.add("Dampen high-PPG games movement; each game adjustment is expensive for premium scorers.");
  const largeAdjustmentRegression = input.adjustmentBuckets.find((row) => ["2-4", "4+"].includes(row.segment) && (row.v82TotalMaeDeltaVsV7 ?? 0) > 0);
  if (largeAdjustmentRegression) recommendations.add("Cap v8.2 adjustment size or blend v8.1/v7 in large movement buckets.");
  const lowPrior = input.cohortBreakdowns.find((row) => row.segment === "low_prior_sample");
  if ((lowPrior?.v82GamesMaeDeltaVsV7 ?? 0) < 0 && (lowPrior?.v82TotalMaeDeltaVsV7 ?? 0) <= 0) recommendations.add("Preserve v8.2 for low-prior rows as the safest first candidate.");
  if (input.topRegressions.length > 0 && input.topRegressions.slice(0, 10).some((row) => ["QB", "RB", "WR", "TE"].includes(row.position))) {
    recommendations.add("Review offensive high-impact regressions before any live adoption.");
  }
  if (input.overUnderCorrection.v82OvercorrectedRows > input.overUnderCorrection.v82ImprovedUnderprojectionRows * 0.25) {
    recommendations.add("Reduce v8.2 overcorrection on v7 underprojection rows.");
  }
  recommendations.add("Do not create a live replacement until this audit identifies a cohort-gated v8.2 rule with total MAE parity.");
  return [...recommendations];
}

function verdict(allRows: ProjectionV8CalibrationMetricRow): ProjectionV8CalibrationAuditReport["verdict"] {
  if ((allRows.v82TotalMaeDeltaVsV7 ?? 0) <= 0 && (allRows.v82TotalRmseDeltaVsV7 ?? 0) <= 0) return "v8_2_candidate_promising";
  if ((allRows.v82TotalMaeDeltaVsV7 ?? 0) <= 0.25) return "v8_2_neutral";
  return "v8_2_regressed_needs_rework";
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

function v8DiffersFromV7(row: ProjectionParityAuditRow) {
  return row.v7.ppg !== row.v8.ppg || row.v7.games !== row.v8.games || row.v7.total !== row.v8.total;
}

function v81DiffersFromV7(row: ProjectionParityAuditRow) {
  return row.v7.ppg !== row.v81.ppg || row.v7.games !== row.v81.games || row.v7.total !== row.v81.total;
}

function v81DiffersFromV8(row: ProjectionParityAuditRow) {
  return row.v8.ppg !== row.v81.ppg || row.v8.games !== row.v81.games || row.v8.total !== row.v81.total;
}

function v82DiffersFromV7(row: ProjectionParityAuditRow) {
  return row.v7.ppg !== row.v82.ppg || row.v7.games !== row.v82.games || row.v7.total !== row.v82.total;
}

function v82DiffersFromV81(row: ProjectionParityAuditRow) {
  return row.v81.ppg !== row.v82.ppg || row.v81.games !== row.v82.games || row.v81.total !== row.v82.total;
}

function v8ImprovedAbsError(row: ProjectionParityAuditRow) {
  if (row.v7.errorTotal === null || row.v8.errorTotal === null) return false;
  return Math.abs(row.v8.errorTotal) < Math.abs(row.v7.errorTotal);
}

function v8WorsenedAbsError(row: ProjectionParityAuditRow) {
  if (row.v7.errorTotal === null || row.v8.errorTotal === null) return false;
  return Math.abs(row.v8.errorTotal) > Math.abs(row.v7.errorTotal);
}

function v81ImprovedAbsError(row: ProjectionParityAuditRow) {
  if (row.v7.errorTotal === null || row.v81.errorTotal === null) return false;
  return Math.abs(row.v81.errorTotal) < Math.abs(row.v7.errorTotal);
}

function v81WorsenedAbsError(row: ProjectionParityAuditRow) {
  if (row.v7.errorTotal === null || row.v81.errorTotal === null) return false;
  return Math.abs(row.v81.errorTotal) > Math.abs(row.v7.errorTotal);
}

function v82ImprovedAbsError(row: ProjectionParityAuditRow) {
  if (row.v7.errorTotal === null || row.v82.errorTotal === null) return false;
  return Math.abs(row.v82.errorTotal) < Math.abs(row.v7.errorTotal);
}

function v82WorsenedAbsError(row: ProjectionParityAuditRow) {
  if (row.v7.errorTotal === null || row.v82.errorTotal === null) return false;
  return Math.abs(row.v82.errorTotal) > Math.abs(row.v7.errorTotal);
}

function renderMetricTable(rows: ProjectionV8CalibrationMetricRow[]) {
  const header = "| Segment | Rows | Games MAE v7 | v8 | v8.1 | v8.2 | v8.2 Games Delta vs v7 | Total MAE v7 | v8 | v8.1 | v8.2 | v8.2 Total Delta vs v7 | v8.2 Total Delta vs v8.1 | v8.2 RMSE Delta vs v7 | v8.2 Bias Delta vs v7 | v8.2 Diff vs v8.1 |";
  const divider = "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|";
  const body = rows.map((row) => `| ${row.segment} | ${row.rows} | ${format(row.v7GamesMae)} | ${format(row.v8GamesMae)} | ${format(row.v81GamesMae)} | ${format(row.v82GamesMae)} | ${format(row.v82GamesMaeDeltaVsV7)} | ${format(row.v7TotalMae)} | ${format(row.v8TotalMae)} | ${format(row.v81TotalMae)} | ${format(row.v82TotalMae)} | ${format(row.v82TotalMaeDeltaVsV7)} | ${format(row.v82TotalMaeDeltaVsV81)} | ${format(row.v82TotalRmseDeltaVsV7)} | ${format(row.v82TotalBiasDeltaVsV7)} | ${row.v82DifferentFromV81RowCount} |`);
  return [header, divider, ...body].join("\n");
}

function renderMoverTable(rows: ProjectionV8CalibrationMover[]) {
  if (!rows.length) return "No rows.";
  const header = "| Player | Pos | Cohorts | Actual G | v7 G | v8 G | v8.1 G | v8.2 G | Actual Pts | v7 Pts | v8.1 Pts | v8.2 Pts | v8.2 Abs Err Delta vs v7 | v8.2 Reason |";
  const divider = "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|";
  const body = rows.map((row) => `| ${row.player} | ${row.position} | ${row.evaluationCohorts.join(" ")} | ${row.actualGames} | ${format(row.v7ExpectedGames)} | ${format(row.v8ExpectedGames)} | ${format(row.v81ExpectedGames)} | ${format(row.v82ExpectedGames)} | ${format(row.actualTotalPoints)} | ${format(row.v7ProjectedTotal)} | ${format(row.v81ProjectedTotal)} | ${format(row.v82ProjectedTotal)} | ${format(row.v82TotalAbsErrorDeltaVsV7)} | ${row.v8Diagnostics?.v82SelectedExpectedGamesReason ?? ""} |`);
  return [header, divider, ...body].join("\n");
}

function csvMetricRow(section: string, row: ProjectionV8CalibrationMetricRow) {
  return [
    section,
    row.segment,
    row.rows,
    row.v7GamesMae ?? "",
    row.v8GamesMae ?? "",
    row.v81GamesMae ?? "",
    row.v82GamesMae ?? "",
    row.gamesMaeDelta ?? "",
    row.v81GamesMaeDeltaVsV7 ?? "",
    row.v81GamesMaeDeltaVsV8 ?? "",
    row.v82GamesMaeDeltaVsV7 ?? "",
    row.v82GamesMaeDeltaVsV81 ?? "",
    row.v7TotalMae ?? "",
    row.v8TotalMae ?? "",
    row.v81TotalMae ?? "",
    row.v82TotalMae ?? "",
    row.totalMaeDelta ?? "",
    row.v81TotalMaeDeltaVsV7 ?? "",
    row.v81TotalMaeDeltaVsV8 ?? "",
    row.v82TotalMaeDeltaVsV7 ?? "",
    row.v82TotalMaeDeltaVsV81 ?? "",
    row.v7TotalRmse ?? "",
    row.v8TotalRmse ?? "",
    row.v81TotalRmse ?? "",
    row.v82TotalRmse ?? "",
    row.totalRmseDelta ?? "",
    row.v81TotalRmseDeltaVsV7 ?? "",
    row.v81TotalRmseDeltaVsV8 ?? "",
    row.v82TotalRmseDeltaVsV7 ?? "",
    row.v82TotalRmseDeltaVsV81 ?? "",
    row.v7TotalBias ?? "",
    row.v8TotalBias ?? "",
    row.v81TotalBias ?? "",
    row.v82TotalBias ?? "",
    row.totalBiasDelta ?? "",
    row.v81TotalBiasDeltaVsV7 ?? "",
    row.v81TotalBiasDeltaVsV8 ?? "",
    row.v82TotalBiasDeltaVsV7 ?? "",
    row.v82TotalBiasDeltaVsV81 ?? "",
    row.v8DifferentRowCount,
    row.v8DifferentRowRate ?? "",
    row.v81DifferentFromV7RowCount,
    row.v81DifferentFromV7RowRate ?? "",
    row.v81DifferentFromV8RowCount,
    row.v81DifferentFromV8RowRate ?? "",
    row.v82DifferentFromV7RowCount,
    row.v82DifferentFromV7RowRate ?? "",
    row.v82DifferentFromV81RowCount,
    row.v82DifferentFromV81RowRate ?? "",
  ];
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

function diff(a: number | null, b: number | null) {
  if (a === null || b === null) return null;
  return round(a - b);
}

function format(value: number | null) {
  return value === null ? "n/a" : String(value);
}

function csvCell(value: unknown) {
  const text = String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
