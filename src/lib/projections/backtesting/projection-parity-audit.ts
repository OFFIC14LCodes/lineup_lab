import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type {
  ProjectionBacktestBaselineModel,
  ProjectionBacktestPlayerRow,
  ProjectionBacktestPrediction,
  ProjectionBacktestReport,
} from "./projection-backtest-types";
import type {
  PreseasonProjectionSnapshot,
  PreseasonProjectionSnapshotRow,
} from "./preseason-projection-snapshot-types";
import type {
  ProjectionParityArtifactPaths,
  ProjectionParityAuditInput,
  ProjectionParityAuditOptions,
  ProjectionParityAuditReport,
  ProjectionParityAuditRootCause,
  ProjectionParityAuditRow,
  ProjectionParityCohortComparison,
  ProjectionParityEvaluationCohort,
  ProjectionParityAuditPredictionSummary,
  ProjectionParityFallbackPositionAudit,
  ProjectionParityMetricSummary,
  ProjectionParitySnapshotDiagnostics,
} from "./projection-parity-audit-types";
import { calculateLowPriorExpectedGamesBaseline } from "./low-prior-expected-games-baseline";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const WEIGHTED_MODEL: ProjectionBacktestBaselineModel = "weighted_recent_ppg";
const V6_MODEL: ProjectionBacktestBaselineModel = "blackbird_expected_games_v6_gated";
const V7_MODEL: ProjectionBacktestBaselineModel = "blackbird_expected_games_v7_family_selective";
const V8_MODEL: ProjectionBacktestBaselineModel = "blackbird_expected_games_v8_cohort_blend";
const V81_MODEL: ProjectionBacktestBaselineModel = "blackbird_expected_games_v8_1_calibrated_gate";
const V82_MODEL: ProjectionBacktestBaselineModel = "blackbird_expected_games_v8_2_high_impact_guardrail";
const TOLERANCE = 0.0001;

export function runProjectionParityAudit(options: ProjectionParityAuditOptions): ProjectionParityAuditReport {
  const paths = {
    backtest: path.join(OUTPUT_DIR, `projection-backtest-${options.targetSeason}.json`),
    snapshot: path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.targetSeason}.json`),
  };
  if (!existsSync(paths.backtest)) {
    throw new Error(`Missing ${relative(paths.backtest)}. Run npm run projection:backtest -- --target-season=${options.targetSeason} --include-existing-projections first.`);
  }
  if (!existsSync(paths.snapshot)) {
    throw new Error(`Missing ${relative(paths.snapshot)}. Run npm run projection:snapshot:preseason -- --target-season=${options.targetSeason} first.`);
  }
  const report = JSON.parse(readFileSync(paths.backtest, "utf8")) as ProjectionBacktestReport;
  const snapshot = JSON.parse(readFileSync(paths.snapshot, "utf8")) as PreseasonProjectionSnapshot;
  return buildProjectionParityAuditFromData({
    report,
    snapshot,
    options,
  }, paths);
}

export function buildProjectionParityAuditFromData(
  input: ProjectionParityAuditInput,
  sourceArtifacts: ProjectionParityAuditReport["sourceArtifacts"] = { backtest: "in-memory", snapshot: "in-memory" }
): ProjectionParityAuditReport {
  const snapshotByKey = snapshotRowsByKey(input.snapshot.rows);
  const rows = input.report.dataset.rows.map((row) => buildAuditRow(row, snapshotByKey.get(playerKey(row))));
  const weightedKeys = new Set(rows.filter((row) => hasProjection(row.weighted)).map((row) => row.key));
  const v7Keys = new Set(rows.filter((row) => hasProjection(row.v7)).map((row) => row.key));
  const sharedRows = rows.filter((row) => weightedKeys.has(row.key) && v7Keys.has(row.key));
  const ppgMismatches = sharedRows.filter((row) => row.ppgAnchorDiff !== null && Math.abs(row.ppgAnchorDiff) > TOLERANCE);
  const gamesMismatches = sharedRows.filter((row) => row.gamesBaselineDiff !== null && Math.abs(row.gamesBaselineDiff) > TOLERANCE);
  const baselineImplementationMismatches = gamesMismatches.filter(isHardFallbackBaselineRow);
  const trueModelDifferences = gamesMismatches.filter((row) => !isHardFallbackBaselineRow(row));
  const v6V7Compared = rows.filter((row) => hasProjection(row.v6) && hasProjection(row.v7));
  const v6V7Identical = v6V7Compared.filter((row) =>
    equalNumber(row.v6.ppg, row.v7.ppg)
    && equalNumber(row.v6.games, row.v7.games)
    && equalNumber(row.v6.total, row.v7.total)
  );
  const v7V8Compared = rows.filter((row) => hasProjection(row.v7) && hasProjection(row.v8));
  const v7V8Identical = v7V8Compared.filter((row) =>
    equalNumber(row.v7.ppg, row.v8.ppg)
    && equalNumber(row.v7.games, row.v8.games)
    && equalNumber(row.v7.total, row.v8.total)
  );
  const v7V81Compared = rows.filter((row) => hasProjection(row.v7) && hasProjection(row.v81));
  const v7V81Identical = v7V81Compared.filter((row) =>
    equalNumber(row.v7.ppg, row.v81.ppg)
    && equalNumber(row.v7.games, row.v81.games)
    && equalNumber(row.v7.total, row.v81.total)
  );
  const v8V81Compared = rows.filter((row) => hasProjection(row.v8) && hasProjection(row.v81));
  const v8V81Identical = v8V81Compared.filter((row) =>
    equalNumber(row.v8.ppg, row.v81.ppg)
    && equalNumber(row.v8.games, row.v81.games)
    && equalNumber(row.v8.total, row.v81.total)
  );
  const v81V82Compared = rows.filter((row) => hasProjection(row.v81) && hasProjection(row.v82));
  const v81V82Identical = v81V82Compared.filter((row) =>
    equalNumber(row.v81.ppg, row.v82.ppg)
    && equalNumber(row.v81.games, row.v82.games)
    && equalNumber(row.v81.total, row.v82.total)
  );
  const teAudit = fallbackAudit("TE", sharedRows);
  const kAudit = fallbackAudit("K", sharedRows);
  const rootCauses = classifyRootCauses({
    weightedRows: weightedKeys.size,
    v7Rows: v7Keys.size,
    ppgMismatches,
    baselineImplementationMismatches,
    teAudit,
    kAudit,
    v6V7Compared,
    v6V7Identical,
  });

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    targetSeason: input.options.targetSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts,
    rowUniverse: rowUniverse(rows, weightedKeys, v7Keys),
    sharedRowMetrics: metricSummary(sharedRows),
    evaluationCohorts: cohortComparisons(rows, weightedKeys, v7Keys),
    comparisonProtocol: {
      sharedWeightedRows: "Rows with both weighted_recent_ppg and v7 predictions. This is the apples-to-apples weighted baseline comparison.",
      v7OnlyRows: "Rows with v7 predictions but no weighted_recent_ppg prediction. These are kept in the report and compared only against the no-prior baseline protocol where eligible.",
      noPriorBaseline: {
        name: "conservative_position_prior",
        description: "A diagnostic-only low/no-prior expected-games baseline using conservative position priors for rookie, second-year low-prior, and no-prior-stat rows. It is not merged into weighted_recent_ppg and does not change projection outputs.",
        appliesToCohorts: ["v7_only_rows", "rookie", "second_year_low_prior", "no_prior_stats", "low_prior_sample"],
        mergedIntoWeightedComparison: false,
      },
    },
    ppgAnchorParity: {
      comparedRows: sharedRows.filter((row) => row.ppgAnchorDiff !== null).length,
      mismatchedRows: ppgMismatches.length,
      matchedRows: sharedRows.length - ppgMismatches.length,
      averageAbsDiff: mean(ppgMismatches.map((row) => Math.abs(row.ppgAnchorDiff ?? 0))),
      maxAbsDiff: max(ppgMismatches.map((row) => Math.abs(row.ppgAnchorDiff ?? 0))),
      examples: topDiffs(ppgMismatches, "ppgAnchorDiff"),
    },
    gamesBaselineParity: {
      comparedRows: sharedRows.filter((row) => row.gamesBaselineDiff !== null).length,
      mismatchedRows: gamesMismatches.length,
      baselineImplementationMismatchRows: baselineImplementationMismatches.length,
      trueModelDifferenceRows: trueModelDifferences.length,
      matchedRows: sharedRows.length - gamesMismatches.length,
      averageAbsDiff: mean(gamesMismatches.map((row) => Math.abs(row.gamesBaselineDiff ?? 0))),
      maxAbsDiff: max(gamesMismatches.map((row) => Math.abs(row.gamesBaselineDiff ?? 0))),
      examples: topDiffs(gamesMismatches, "gamesBaselineDiff"),
    },
    fallbackAudit: {
      TE: teAudit,
      K: kAudit,
    },
    v6V7IdentityAudit: {
      comparedRows: v6V7Compared.length,
      identicalRows: v6V7Identical.length,
      differentRows: v6V7Compared.length - v6V7Identical.length,
      identicalRate: v6V7Compared.length ? round(v6V7Identical.length / v6V7Compared.length) : null,
      examplesIdentical: v6V7Identical.slice(0, 25),
      examplesDifferent: topDiffs(v6V7Compared.filter((row) => !v6V7Identical.includes(row)), "v6V7TotalDiff"),
    },
    v7V8IdentityAudit: {
      comparedRows: v7V8Compared.length,
      identicalRows: v7V8Identical.length,
      differentRows: v7V8Compared.length - v7V8Identical.length,
      identicalRate: v7V8Compared.length ? round(v7V8Identical.length / v7V8Compared.length) : null,
      differentRate: v7V8Compared.length ? round((v7V8Compared.length - v7V8Identical.length) / v7V8Compared.length) : null,
      byCohort: identityByCohort(v7V8Compared, "v7", "v8"),
      examplesIdentical: v7V8Identical.slice(0, 25),
      examplesDifferent: topDiffs(v7V8Compared.filter((row) => !v7V8Identical.includes(row)), "v7V8TotalDiff"),
    },
    v7V81IdentityAudit: {
      comparedRows: v7V81Compared.length,
      identicalRows: v7V81Identical.length,
      differentRows: v7V81Compared.length - v7V81Identical.length,
      identicalRate: v7V81Compared.length ? round(v7V81Identical.length / v7V81Compared.length) : null,
      differentRate: v7V81Compared.length ? round((v7V81Compared.length - v7V81Identical.length) / v7V81Compared.length) : null,
      byCohort: identityByCohort(v7V81Compared, "v7", "v81"),
      examplesIdentical: v7V81Identical.slice(0, 25),
      examplesDifferent: topDiffs(v7V81Compared.filter((row) => !v7V81Identical.includes(row)), "v7V81TotalDiff"),
    },
    v8V81IdentityAudit: {
      comparedRows: v8V81Compared.length,
      identicalRows: v8V81Identical.length,
      differentRows: v8V81Compared.length - v8V81Identical.length,
      identicalRate: v8V81Compared.length ? round(v8V81Identical.length / v8V81Compared.length) : null,
      differentRate: v8V81Compared.length ? round((v8V81Compared.length - v8V81Identical.length) / v8V81Compared.length) : null,
      byCohort: identityByCohort(v8V81Compared, "v8", "v81"),
      examplesIdentical: v8V81Identical.slice(0, 25),
      examplesDifferent: topDiffs(v8V81Compared.filter((row) => !v8V81Identical.includes(row)), "v8V81TotalDiff"),
    },
    v81V82IdentityAudit: {
      comparedRows: v81V82Compared.length,
      identicalRows: v81V82Identical.length,
      differentRows: v81V82Compared.length - v81V82Identical.length,
      identicalRate: v81V82Compared.length ? round(v81V82Identical.length / v81V82Compared.length) : null,
      differentRate: v81V82Compared.length ? round((v81V82Compared.length - v81V82Identical.length) / v81V82Compared.length) : null,
      byCohort: identityByCohort(v81V82Compared, "v81", "v82"),
      examplesIdentical: v81V82Identical.slice(0, 25),
      examplesDifferent: topDiffs(v81V82Compared.filter((row) => !v81V82Identical.includes(row)), "v81V82TotalDiff"),
    },
    rootCauses,
    recommendationsBeforeV8: recommendations(rootCauses),
    rows,
  };
}

export function writeProjectionParityAuditArtifacts(report: ProjectionParityAuditReport): ProjectionParityArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-parity-audit-${report.targetSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderProjectionParityAuditMarkdown(report), "utf8");
  writeFileSync(csvPath, renderProjectionParityAuditCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

export function renderProjectionParityAuditMarkdown(report: ProjectionParityAuditReport): string {
  return `# Projection Backtest Parity Audit ${report.targetSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Include IDP: ${report.includeIdp}

## Source Artifacts

- Backtest: ${report.sourceArtifacts.backtest}
- Snapshot: ${report.sourceArtifacts.snapshot}

## Row Universe

- Weighted rows: ${report.rowUniverse.weightedRows}
- v7 rows: ${report.rowUniverse.v7Rows}
- Shared rows: ${report.rowUniverse.sharedRows}
- Weighted-only rows: ${report.rowUniverse.weightedOnlyRows}
- v7-only rows: ${report.rowUniverse.v7OnlyRows}

### v7-Only Row Explanation

\`\`\`json
${JSON.stringify({
  byPriorDataGroup: report.rowUniverse.v7OnlyByPriorDataGroup,
  byCohort: report.rowUniverse.v7OnlyByCohort,
}, null, 2)}
\`\`\`

## Shared-Row Metrics

\`\`\`json
${JSON.stringify(report.sharedRowMetrics, null, 2)}
\`\`\`

## Comparison Protocol

- Shared weighted rows: ${report.comparisonProtocol.sharedWeightedRows}
- v7-only rows: ${report.comparisonProtocol.v7OnlyRows}
- No-prior baseline: ${report.comparisonProtocol.noPriorBaseline.description}
- No-prior merged into weighted comparison: ${report.comparisonProtocol.noPriorBaseline.mergedIntoWeightedComparison}

## Evaluation Cohorts

${report.evaluationCohorts.map(cohortMarkdown).join("\n\n")}

## PPG Anchor Parity

- Compared rows: ${report.ppgAnchorParity.comparedRows}
- Matched rows: ${report.ppgAnchorParity.matchedRows}
- Mismatched rows: ${report.ppgAnchorParity.mismatchedRows}
- Average absolute diff: ${report.ppgAnchorParity.averageAbsDiff ?? "n/a"}
- Max absolute diff: ${report.ppgAnchorParity.maxAbsDiff ?? "n/a"}

## Games Baseline Parity

- Compared rows: ${report.gamesBaselineParity.comparedRows}
- Matched rows: ${report.gamesBaselineParity.matchedRows}
- Mismatched rows: ${report.gamesBaselineParity.mismatchedRows}
- Baseline implementation mismatch rows: ${report.gamesBaselineParity.baselineImplementationMismatchRows}
- True model difference rows: ${report.gamesBaselineParity.trueModelDifferenceRows}
- Average absolute diff: ${report.gamesBaselineParity.averageAbsDiff ?? "n/a"}
- Max absolute diff: ${report.gamesBaselineParity.maxAbsDiff ?? "n/a"}

## TE Fallback Audit

${fallbackMarkdown(report.fallbackAudit.TE)}

## K Fallback Audit

${fallbackMarkdown(report.fallbackAudit.K)}

## v6 vs v7 Identity Audit

- Compared rows: ${report.v6V7IdentityAudit.comparedRows}
- Identical rows: ${report.v6V7IdentityAudit.identicalRows}
- Different rows: ${report.v6V7IdentityAudit.differentRows}
- Identical rate: ${report.v6V7IdentityAudit.identicalRate ?? "n/a"}

## v7 vs v8 Identity Audit

- Compared rows: ${report.v7V8IdentityAudit.comparedRows}
- Identical rows: ${report.v7V8IdentityAudit.identicalRows}
- Different rows: ${report.v7V8IdentityAudit.differentRows}
- Identical rate: ${report.v7V8IdentityAudit.identicalRate ?? "n/a"}
- Different rate: ${report.v7V8IdentityAudit.differentRate ?? "n/a"}

### v7 vs v8 Difference Rates By Cohort

\`\`\`json
${JSON.stringify(report.v7V8IdentityAudit.byCohort, null, 2)}
\`\`\`

## v7 vs v8.1 Identity Audit

- Compared rows: ${report.v7V81IdentityAudit.comparedRows}
- Identical rows: ${report.v7V81IdentityAudit.identicalRows}
- Different rows: ${report.v7V81IdentityAudit.differentRows}
- Identical rate: ${report.v7V81IdentityAudit.identicalRate ?? "n/a"}
- Different rate: ${report.v7V81IdentityAudit.differentRate ?? "n/a"}

## v8 vs v8.1 Identity Audit

- Compared rows: ${report.v8V81IdentityAudit.comparedRows}
- Identical rows: ${report.v8V81IdentityAudit.identicalRows}
- Different rows: ${report.v8V81IdentityAudit.differentRows}
- Identical rate: ${report.v8V81IdentityAudit.identicalRate ?? "n/a"}
- Different rate: ${report.v8V81IdentityAudit.differentRate ?? "n/a"}

## v8.1 vs v8.2 Identity Audit

- Compared rows: ${report.v81V82IdentityAudit.comparedRows}
- Identical rows: ${report.v81V82IdentityAudit.identicalRows}
- Different rows: ${report.v81V82IdentityAudit.differentRows}
- Identical rate: ${report.v81V82IdentityAudit.identicalRate ?? "n/a"}
- Different rate: ${report.v81V82IdentityAudit.differentRate ?? "n/a"}

### v8.1 vs v8.2 Difference Rates By Cohort

\`\`\`json
${JSON.stringify(report.v81V82IdentityAudit.byCohort, null, 2)}
\`\`\`

## Root Causes

${report.rootCauses.map((cause) => `- ${cause}`).join("\n")}

## Recommended Exact Fix Before v8

${report.recommendationsBeforeV8.map((line) => `- ${line}`).join("\n")}

## Top PPG Anchor Mismatches

${rowList(report.ppgAnchorParity.examples, "ppgAnchorDiff")}

## Top Games Baseline Mismatches

${rowList(report.gamesBaselineParity.examples, "gamesBaselineDiff")}
`;
}

export function renderProjectionParityAuditCsv(report: ProjectionParityAuditReport): string {
  const headers = [
    "key",
    "player",
    "sleeper_id",
    "gsis_id",
    "position",
    "team",
    "prior_data_group",
    "cohorts",
    "evaluation_cohorts",
    "actual_games",
    "actual_ppg",
    "actual_points",
    "weighted_ppg",
    "weighted_games",
    "weighted_total",
    "no_prior_baseline_games",
    "no_prior_baseline_error_games",
    "no_prior_baseline_protocol",
    "no_prior_baseline_basis",
    "v6_ppg",
    "v6_games",
    "v6_total",
    "v7_ppg",
    "v7_games",
    "v7_total",
    "v8_ppg",
    "v8_games",
    "v8_total",
    "v81_ppg",
    "v81_games",
    "v81_total",
    "v82_ppg",
    "v82_games",
    "v82_total",
    "ppg_anchor_diff",
    "games_baseline_diff",
    "total_diff",
    "v6_v7_ppg_diff",
    "v6_v7_games_diff",
    "v6_v7_total_diff",
    "v7_v8_ppg_diff",
    "v7_v8_games_diff",
    "v7_v8_total_diff",
    "v7_v81_ppg_diff",
    "v7_v81_games_diff",
    "v7_v81_total_diff",
    "v8_v81_ppg_diff",
    "v8_v81_games_diff",
    "v8_v81_total_diff",
    "v7_v82_ppg_diff",
    "v7_v82_games_diff",
    "v7_v82_total_diff",
    "v81_v82_ppg_diff",
    "v81_v82_games_diff",
    "v81_v82_total_diff",
    "v6_method",
    "v6_gate",
    "v6_fallback",
    "v7_method",
    "v7_gate",
    "v7_fallback",
    "v8_cohort",
    "v81_gates_applied",
    "v81_reason_codes",
    "v81_selected_reason",
    "v82_guardrail_applied",
    "v82_reason_codes",
    "v82_ppg_bucket",
    "v82_adjustment_bucket",
    "v82_selected_reason",
    "root_causes",
  ];
  const rows = report.rows.map((row) => [
    row.key,
    row.player,
    row.sleeperId ?? "",
    row.gsisId ?? "",
    row.position,
    row.team ?? "",
    row.priorDataGroup,
    row.cohortLabels.join("|"),
    row.evaluationCohorts.join("|"),
    row.actualGames,
    row.actualPpg ?? "",
    row.actualPoints,
    row.weighted.ppg ?? "",
    row.weighted.games ?? "",
    row.weighted.total ?? "",
    row.noPriorBaseline.expectedGames ?? "",
    row.noPriorBaseline.errorGames ?? "",
    row.noPriorBaseline.protocol ?? "",
    row.noPriorBaseline.basis ?? "",
    row.v6.ppg ?? "",
    row.v6.games ?? "",
    row.v6.total ?? "",
    row.v7.ppg ?? "",
    row.v7.games ?? "",
    row.v7.total ?? "",
    row.v8.ppg ?? "",
    row.v8.games ?? "",
    row.v8.total ?? "",
    row.v81.ppg ?? "",
    row.v81.games ?? "",
    row.v81.total ?? "",
    row.v82.ppg ?? "",
    row.v82.games ?? "",
    row.v82.total ?? "",
    row.ppgAnchorDiff ?? "",
    row.gamesBaselineDiff ?? "",
    row.totalDiff ?? "",
    row.v6V7PpgDiff ?? "",
    row.v6V7GamesDiff ?? "",
    row.v6V7TotalDiff ?? "",
    row.v7V8PpgDiff ?? "",
    row.v7V8GamesDiff ?? "",
    row.v7V8TotalDiff ?? "",
    row.v7V81PpgDiff ?? "",
    row.v7V81GamesDiff ?? "",
    row.v7V81TotalDiff ?? "",
    row.v8V81PpgDiff ?? "",
    row.v8V81GamesDiff ?? "",
    row.v8V81TotalDiff ?? "",
    row.v7V82PpgDiff ?? "",
    row.v7V82GamesDiff ?? "",
    row.v7V82TotalDiff ?? "",
    row.v81V82PpgDiff ?? "",
    row.v81V82GamesDiff ?? "",
    row.v81V82TotalDiff ?? "",
    row.snapshotDiagnostics?.v6SelectedExpectedGamesMethod ?? "",
    row.snapshotDiagnostics?.v6GateReason ?? "",
    row.snapshotDiagnostics?.v6FallbackReason ?? "",
    row.snapshotDiagnostics?.v7SelectedExpectedGamesMethod ?? "",
    row.snapshotDiagnostics?.v7GateReason ?? "",
    row.snapshotDiagnostics?.v7FallbackReason ?? "",
    row.snapshotDiagnostics?.v8Cohort ?? "",
    row.snapshotDiagnostics?.v81GatesApplied.join("|") ?? "",
    row.snapshotDiagnostics?.v81ReasonCodes.join("|") ?? "",
    row.snapshotDiagnostics?.v81SelectedExpectedGamesReason ?? "",
    row.snapshotDiagnostics?.v82GuardrailApplied ?? "",
    row.snapshotDiagnostics?.v82GuardrailReasonCodes.join("|") ?? "",
    row.snapshotDiagnostics?.v82PpgBucket ?? "",
    row.snapshotDiagnostics?.v82AdjustmentBucket ?? "",
    row.snapshotDiagnostics?.v82SelectedExpectedGamesReason ?? "",
    row.rootCauses.join("|"),
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function buildAuditRow(row: ProjectionBacktestPlayerRow, snapshotRow: PreseasonProjectionSnapshotRow | undefined): ProjectionParityAuditRow {
  const weighted = predictionSummary(row.predictions[WEIGHTED_MODEL]);
  const noPriorBaseline = noPriorBaselineSummary(row);
  const v6 = predictionSummary(row.predictions[V6_MODEL]);
  const v7 = predictionSummary(row.predictions[V7_MODEL]);
  const v8 = predictionSummary(row.predictions[V8_MODEL]);
  const v81 = predictionSummary(row.predictions[V81_MODEL]);
  const v82 = predictionSummary(row.predictions[V82_MODEL]);
  const rootCauses: ProjectionParityAuditRootCause[] = [];
  const ppgAnchorDiff = diff(v7.ppg, weighted.ppg);
  const gamesBaselineDiff = diff(v7.games, weighted.games);
  const totalDiff = diff(v7.total, weighted.total);
  if (ppgAnchorDiff !== null && Math.abs(ppgAnchorDiff) > TOLERANCE) rootCauses.push("ppg_anchor_mismatch");
  if (["TE", "K"].includes(row.identity.position)) {
    const expectedFallback = row.identity.position === "TE" ? "te_hard_baseline_fallback" : "k_hard_baseline_fallback";
    const fallback = snapshotRow?.expectedGamesDiagnostics.v7GateReason;
    if (fallback !== expectedFallback) rootCauses.push("fallback_not_applied");
    else if (gamesBaselineDiff !== null && Math.abs(gamesBaselineDiff) > TOLERANCE) {
      rootCauses.push("baseline_games_mismatch", "fallback_applied_but_not_baseline_equivalent", "te_k_baseline_definition_issue");
    }
  }
  if (hasProjection(v6) && hasProjection(v7) && equalNumber(v6.ppg, v7.ppg) && equalNumber(v6.games, v7.games) && equalNumber(v6.total, v7.total)) {
    rootCauses.push("v6_v7_same_path");
  }
  if (!rootCauses.length) rootCauses.push("no_issue_detected");
  return {
    key: playerKey(row),
    player: row.identity.name,
    sleeperId: row.identity.sleeperId,
    gsisId: row.identity.gsisId,
    position: row.identity.position,
    team: row.identity.team,
    priorDataGroup: row.priorDataGroup,
    cohortLabels: row.cohortLabels,
    evaluationCohorts: evaluationCohorts(row, weighted, v7, snapshotRow),
    actualGames: row.actuals.games,
    actualPpg: row.actuals.pointsPerGame,
    actualPoints: row.actuals.totalPoints,
    weighted,
    noPriorBaseline,
    v6,
    v7,
    v8,
    v81,
    v82,
    ppgAnchorDiff,
    gamesBaselineDiff,
    totalDiff,
    v6V7PpgDiff: diff(v7.ppg, v6.ppg),
    v6V7GamesDiff: diff(v7.games, v6.games),
    v6V7TotalDiff: diff(v7.total, v6.total),
    v7V8PpgDiff: diff(v8.ppg, v7.ppg),
    v7V8GamesDiff: diff(v8.games, v7.games),
    v7V8TotalDiff: diff(v8.total, v7.total),
    v7V81PpgDiff: diff(v81.ppg, v7.ppg),
    v7V81GamesDiff: diff(v81.games, v7.games),
    v7V81TotalDiff: diff(v81.total, v7.total),
    v8V81PpgDiff: diff(v81.ppg, v8.ppg),
    v8V81GamesDiff: diff(v81.games, v8.games),
    v8V81TotalDiff: diff(v81.total, v8.total),
    v7V82PpgDiff: diff(v82.ppg, v7.ppg),
    v7V82GamesDiff: diff(v82.games, v7.games),
    v7V82TotalDiff: diff(v82.total, v7.total),
    v81V82PpgDiff: diff(v82.ppg, v81.ppg),
    v81V82GamesDiff: diff(v82.games, v81.games),
    v81V82TotalDiff: diff(v82.total, v81.total),
    snapshotDiagnostics: snapshotRow ? snapshotDiagnostics(snapshotRow) : null,
    rootCauses,
  };
}

function noPriorBaselineSummary(row: ProjectionBacktestPlayerRow) {
  const baseline = calculateLowPriorExpectedGamesBaseline({
    position: row.identity.position,
    priorDataGroup: row.priorDataGroup,
    cohortLabels: row.cohortLabels,
  });
  if (!baseline) {
    return {
      expectedGames: null,
      protocol: null,
      basis: null,
      errorGames: null,
      reasons: [],
    };
  }
  return {
    expectedGames: baseline.expectedGames,
    protocol: baseline.protocol,
    basis: baseline.basis,
    errorGames: round(baseline.expectedGames - row.actuals.games),
    reasons: baseline.reasons,
  };
}

function evaluationCohorts(
  row: ProjectionBacktestPlayerRow,
  weighted: ProjectionParityAuditPredictionSummary,
  v7: ProjectionParityAuditPredictionSummary,
  snapshotRow: PreseasonProjectionSnapshotRow | undefined
): ProjectionParityEvaluationCohort[] {
  const cohorts = new Set<ProjectionParityEvaluationCohort>(["all_rows"]);
  const hasWeighted = hasProjection(weighted);
  const hasV7 = hasProjection(v7);
  if (hasWeighted && hasV7) cohorts.add("shared_weighted_rows");
  if (!hasWeighted && hasV7) cohorts.add("v7_only_rows");
  if (row.priorDataGroup === "rookie") cohorts.add("rookie");
  if (row.priorDataGroup === "second_year" && row.cohortLabels.includes("low_prior_sample")) cohorts.add("second_year_low_prior");
  if (row.priorDataGroup === "no_prior_stats") cohorts.add("no_prior_stats");
  if (!["rookie", "second_year", "no_prior_stats"].includes(row.priorDataGroup) && !row.cohortLabels.includes("low_prior_sample")) {
    cohorts.add("veteran_prior_sample");
  }
  if (row.cohortLabels.includes("low_prior_sample")) cohorts.add("low_prior_sample");
  if (snapshotRow?.expectedGamesDiagnostics.v7GateReason === "te_hard_baseline_fallback") cohorts.add("te_fallback");
  if (snapshotRow?.expectedGamesDiagnostics.v7GateReason === "k_hard_baseline_fallback") cohorts.add("k_fallback");
  if (["DL", "LB", "DB"].includes(row.identity.position)) cohorts.add("idp");
  if (["QB", "RB", "WR", "TE"].includes(row.identity.position)) cohorts.add("offense");
  if (row.identity.position === "K") cohorts.add("kicker");
  return [...cohorts];
}

function snapshotRowsByKey(rows: PreseasonProjectionSnapshotRow[]): Map<string, PreseasonProjectionSnapshotRow> {
  const map = new Map<string, PreseasonProjectionSnapshotRow>();
  for (const row of rows) {
    if (row.variant !== V7_MODEL) continue;
    map.set(snapshotKey(row), row);
  }
  return map;
}

function snapshotDiagnostics(row: PreseasonProjectionSnapshotRow): ProjectionParitySnapshotDiagnostics {
  const diagnostics = row.expectedGamesDiagnostics;
  return {
    weightedRecentGames: diagnostics.weightedRecentGames,
    v6ProjectedGames: diagnostics.v6ProjectedGames,
    v7ProjectedGames: diagnostics.v7ProjectedGames,
    v8ProjectedGames: diagnostics.v8ProjectedGames,
    v81ProjectedGames: diagnostics.v81ProjectedGames,
    v6SelectedExpectedGamesMethod: diagnostics.v6SelectedExpectedGamesMethod,
    v6GateReason: diagnostics.v6GateReason,
    v6PositionFamilyGateStatus: diagnostics.v6PositionFamilyGateStatus,
    v6FallbackReason: diagnostics.v6FallbackReason,
    v7SelectedExpectedGamesMethod: diagnostics.v7SelectedExpectedGamesMethod,
    v7GateReason: diagnostics.v7GateReason,
    v7PositionFamilyGateStatus: diagnostics.v7PositionFamilyGateStatus,
    v7FallbackReason: diagnostics.v7FallbackReason,
    v8SelectedExpectedGamesMethod: diagnostics.v8SelectedExpectedGamesMethod,
    v8Cohort: diagnostics.v8Cohort,
    v8BaselineExpectedGames: diagnostics.v8BaselineExpectedGames,
    v8Adjustment: diagnostics.v8Adjustment,
    v8AdjustmentReason: diagnostics.v8AdjustmentReason,
    v8BaselineSource: diagnostics.v8BaselineSource,
    v8FallbackReason: diagnostics.v8FallbackReason,
    v81BaseModelUsed: diagnostics.v81BaseModelUsed,
    v81ProjectedGamesRawV8: diagnostics.v81ProjectedGamesRawV8,
    v81ProjectedGamesV7: diagnostics.v81ProjectedGamesV7,
    v81RawDeltaFromV7: diagnostics.v81RawDeltaFromV7,
    v81CalibratedDeltaFromV7: diagnostics.v81CalibratedDeltaFromV7,
    v81DampeningFactor: diagnostics.v81DampeningFactor,
    v81GatesApplied: diagnostics.v81GatesApplied,
    v81Cohort: diagnostics.v81Cohort,
    v81Position: diagnostics.v81Position,
    v81PpgBucket: diagnostics.v81PpgBucket,
    v81AdjustmentBucket: diagnostics.v81AdjustmentBucket,
    v81ReasonCodes: diagnostics.v81ReasonCodes,
    v81SelectedExpectedGamesReason: diagnostics.v81SelectedExpectedGamesReason,
    v82BaseModelUsed: diagnostics.v82BaseModelUsed,
    v82ProjectedGamesV7: diagnostics.v82ProjectedGamesV7,
    v82ProjectedGamesV8: diagnostics.v82ProjectedGamesV8,
    v82ProjectedGamesV81: diagnostics.v82ProjectedGamesV81,
    v82DeltaFromV7: diagnostics.v82DeltaFromV7,
    v82DeltaFromV81: diagnostics.v82DeltaFromV81,
    v82GuardrailApplied: diagnostics.v82GuardrailApplied,
    v82GuardrailReasonCodes: diagnostics.v82GuardrailReasonCodes,
    v82PpgBucket: diagnostics.v82PpgBucket,
    v82AdjustmentBucket: diagnostics.v82AdjustmentBucket,
    v82SelectedExpectedGamesReason: diagnostics.v82SelectedExpectedGamesReason,
  };
}

function predictionSummary(prediction: ProjectionBacktestPrediction | null | undefined): ProjectionParityAuditPredictionSummary {
  return {
    ppg: prediction?.predictedPpg ?? null,
    games: prediction?.predictedGames ?? null,
    total: prediction?.predictedTotalPoints ?? null,
    errorPpg: prediction?.errorPpg ?? null,
    errorGames: prediction?.gamesError ?? null,
    errorTotal: prediction?.errorTotalPoints ?? null,
  };
}

function rowUniverse(rows: ProjectionParityAuditRow[], weightedKeys: Set<string>, v7Keys: Set<string>): ProjectionParityAuditReport["rowUniverse"] {
  const positions = [...new Set(rows.map((row) => row.position))].sort();
  return {
    weightedRows: weightedKeys.size,
    v7Rows: v7Keys.size,
    sharedRows: rows.filter((row) => weightedKeys.has(row.key) && v7Keys.has(row.key)).length,
    weightedOnlyRows: rows.filter((row) => weightedKeys.has(row.key) && !v7Keys.has(row.key)).length,
    v7OnlyRows: rows.filter((row) => v7Keys.has(row.key) && !weightedKeys.has(row.key)).length,
    byPosition: Object.fromEntries(positions.map((position) => {
      const positionRows = rows.filter((row) => row.position === position);
      return [position, {
        weightedRows: positionRows.filter((row) => weightedKeys.has(row.key)).length,
        v7Rows: positionRows.filter((row) => v7Keys.has(row.key)).length,
        sharedRows: positionRows.filter((row) => weightedKeys.has(row.key) && v7Keys.has(row.key)).length,
        weightedOnlyRows: positionRows.filter((row) => weightedKeys.has(row.key) && !v7Keys.has(row.key)).length,
        v7OnlyRows: positionRows.filter((row) => v7Keys.has(row.key) && !weightedKeys.has(row.key)).length,
      }];
    })),
    v7OnlyByPriorDataGroup: countBy(rows.filter((row) => v7Keys.has(row.key) && !weightedKeys.has(row.key)).map((row) => row.priorDataGroup)),
    v7OnlyByCohort: countBy(rows.filter((row) => v7Keys.has(row.key) && !weightedKeys.has(row.key)).flatMap((row) => row.cohortLabels)),
  };
}

function metricSummary(rows: ProjectionParityAuditRow[]): ProjectionParityMetricSummary {
  return {
    count: rows.length,
    weightedMaePpg: mae(rows.map((row) => row.weighted.errorPpg)),
    v7MaePpg: mae(rows.map((row) => row.v7.errorPpg)),
    weightedMaeGames: mae(rows.map((row) => row.weighted.errorGames)),
    v7MaeGames: mae(rows.map((row) => row.v7.errorGames)),
    weightedMaeTotal: mae(rows.map((row) => row.weighted.errorTotal)),
    v7MaeTotal: mae(rows.map((row) => row.v7.errorTotal)),
    v7DeltaMaePpg: deltaMae(rows.map((row) => row.v7.errorPpg), rows.map((row) => row.weighted.errorPpg)),
    v7DeltaMaeGames: deltaMae(rows.map((row) => row.v7.errorGames), rows.map((row) => row.weighted.errorGames)),
    v7DeltaMaeTotal: deltaMae(rows.map((row) => row.v7.errorTotal), rows.map((row) => row.weighted.errorTotal)),
  };
}

const COHORT_DESCRIPTIONS: Record<ProjectionParityEvaluationCohort, string> = {
  all_rows: "All rows with any projection in the parity audit.",
  shared_weighted_rows: "Rows where weighted_recent_ppg and v7 both exist; apples-to-apples weighted baseline comparison.",
  v7_only_rows: "Rows with v7 but no weighted_recent_ppg; evaluated separately with the no-prior protocol where eligible.",
  veteran_prior_sample: "Veteran rows with enough prior sample for weighted recent comparisons.",
  rookie: "Target-season rookie rows; not compared to weighted recent PPG unless weighted exists explicitly.",
  second_year_low_prior: "Second-year players with low prior sample; requires separate low-prior interpretation.",
  no_prior_stats: "Rows with no prior NFL stat sample.",
  low_prior_sample: "Rows with limited career-to-date games before the target season.",
  te_fallback: "TE rows where v7 used the hard baseline fallback.",
  k_fallback: "K rows where v7 used the hard baseline fallback.",
  idp: "DL/LB/DB rows.",
  offense: "QB/RB/WR/TE rows.",
  kicker: "K rows.",
};

function cohortComparisons(
  rows: ProjectionParityAuditRow[],
  weightedKeys: Set<string>,
  v7Keys: Set<string>
): ProjectionParityCohortComparison[] {
  const cohorts: ProjectionParityEvaluationCohort[] = [
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
  return cohorts.map((cohort) => {
    const cohortRows = rows.filter((row) => row.evaluationCohorts.includes(cohort));
    const noPriorRows = cohortRows.filter((row) => row.noPriorBaseline.expectedGames !== null);
    const weightedMaeGames = mae(cohortRows.map((row) => row.weighted.errorGames));
    const v7MaeGames = mae(cohortRows.map((row) => row.v7.errorGames));
    const noPriorBaselineMaeGames = mae(noPriorRows.map((row) => row.noPriorBaseline.errorGames));
    return {
      cohort,
      description: COHORT_DESCRIPTIONS[cohort],
      applesToApples: cohort === "shared_weighted_rows" || cohort === "veteran_prior_sample" || cohort === "te_fallback" || cohort === "k_fallback",
      rows: cohortRows.length,
      weightedRows: cohortRows.filter((row) => weightedKeys.has(row.key)).length,
      v7Rows: cohortRows.filter((row) => v7Keys.has(row.key)).length,
      sharedRows: cohortRows.filter((row) => weightedKeys.has(row.key) && v7Keys.has(row.key)).length,
      noPriorBaselineRows: noPriorRows.length,
    weightedMaeGames,
    v6MaeGames: mae(cohortRows.map((row) => row.v6.errorGames)),
    v7MaeGames,
    v8MaeGames: mae(cohortRows.map((row) => row.v8.errorGames)),
    v81MaeGames: mae(cohortRows.map((row) => row.v81.errorGames)),
    v82MaeGames: mae(cohortRows.map((row) => row.v82.errorGames)),
    noPriorBaselineMaeGames,
    v8DeltaMaeGamesVsV7: deltaMae(cohortRows.map((row) => row.v8.errorGames), cohortRows.map((row) => row.v7.errorGames)),
    v81DeltaMaeGamesVsV7: deltaMae(cohortRows.map((row) => row.v81.errorGames), cohortRows.map((row) => row.v7.errorGames)),
    v81DeltaMaeGamesVsV8: deltaMae(cohortRows.map((row) => row.v81.errorGames), cohortRows.map((row) => row.v8.errorGames)),
    v82DeltaMaeGamesVsV7: deltaMae(cohortRows.map((row) => row.v82.errorGames), cohortRows.map((row) => row.v7.errorGames)),
    v82DeltaMaeGamesVsV81: deltaMae(cohortRows.map((row) => row.v82.errorGames), cohortRows.map((row) => row.v81.errorGames)),
    v7DeltaMaeGamesVsWeighted: deltaMae(cohortRows.map((row) => row.v7.errorGames), cohortRows.map((row) => row.weighted.errorGames)),
    v8DeltaMaeGamesVsWeighted: deltaMae(cohortRows.map((row) => row.v8.errorGames), cohortRows.map((row) => row.weighted.errorGames)),
    v81DeltaMaeGamesVsWeighted: deltaMae(cohortRows.map((row) => row.v81.errorGames), cohortRows.map((row) => row.weighted.errorGames)),
    v82DeltaMaeGamesVsWeighted: deltaMae(cohortRows.map((row) => row.v82.errorGames), cohortRows.map((row) => row.weighted.errorGames)),
    v7DeltaMaeGamesVsNoPriorBaseline: deltaMae(cohortRows.map((row) => row.v7.errorGames), noPriorAlignedErrors(cohortRows)),
    v8DeltaMaeGamesVsNoPriorBaseline: deltaMae(cohortRows.map((row) => row.v8.errorGames), noPriorAlignedErrors(cohortRows)),
    v81DeltaMaeGamesVsNoPriorBaseline: deltaMae(cohortRows.map((row) => row.v81.errorGames), noPriorAlignedErrors(cohortRows)),
    v82DeltaMaeGamesVsNoPriorBaseline: deltaMae(cohortRows.map((row) => row.v82.errorGames), noPriorAlignedErrors(cohortRows)),
    v8DifferentFromV7Rows: cohortRows.filter((row) => hasProjection(row.v7) && hasProjection(row.v8) && !equalNumber(row.v7.games, row.v8.games)).length,
    v8DifferentFromV7Rate: rate(
      cohortRows.filter((row) => hasProjection(row.v7) && hasProjection(row.v8) && !equalNumber(row.v7.games, row.v8.games)).length,
      cohortRows.filter((row) => hasProjection(row.v7) && hasProjection(row.v8)).length
    ),
    v81DifferentFromV7Rows: cohortRows.filter((row) => hasProjection(row.v7) && hasProjection(row.v81) && !equalNumber(row.v7.games, row.v81.games)).length,
    v81DifferentFromV7Rate: rate(
      cohortRows.filter((row) => hasProjection(row.v7) && hasProjection(row.v81) && !equalNumber(row.v7.games, row.v81.games)).length,
      cohortRows.filter((row) => hasProjection(row.v7) && hasProjection(row.v81)).length
    ),
    v81DifferentFromV8Rows: cohortRows.filter((row) => hasProjection(row.v8) && hasProjection(row.v81) && !equalNumber(row.v8.games, row.v81.games)).length,
    v81DifferentFromV8Rate: rate(
      cohortRows.filter((row) => hasProjection(row.v8) && hasProjection(row.v81) && !equalNumber(row.v8.games, row.v81.games)).length,
      cohortRows.filter((row) => hasProjection(row.v8) && hasProjection(row.v81)).length
    ),
    v82DifferentFromV7Rows: cohortRows.filter((row) => hasProjection(row.v7) && hasProjection(row.v82) && !equalNumber(row.v7.games, row.v82.games)).length,
    v82DifferentFromV7Rate: rate(
      cohortRows.filter((row) => hasProjection(row.v7) && hasProjection(row.v82) && !equalNumber(row.v7.games, row.v82.games)).length,
      cohortRows.filter((row) => hasProjection(row.v7) && hasProjection(row.v82)).length
    ),
    v82DifferentFromV81Rows: cohortRows.filter((row) => hasProjection(row.v81) && hasProjection(row.v82) && !equalNumber(row.v81.games, row.v82.games)).length,
    v82DifferentFromV81Rate: rate(
      cohortRows.filter((row) => hasProjection(row.v81) && hasProjection(row.v82) && !equalNumber(row.v81.games, row.v82.games)).length,
      cohortRows.filter((row) => hasProjection(row.v81) && hasProjection(row.v82)).length
    ),
    notes: cohortNotes(cohort),
    };
  });
}

function noPriorAlignedErrors(rows: ProjectionParityAuditRow[]): Array<number | null> {
  return rows.map((row) => row.noPriorBaseline.errorGames);
}

function cohortNotes(cohort: ProjectionParityEvaluationCohort): string[] {
  if (cohort === "shared_weighted_rows") return ["Valid weighted baseline vs v7 comparison."];
  if (cohort === "v7_only_rows") return ["Not apples-to-apples against weighted_recent_ppg; use no-prior baseline rows only."];
  if (cohort === "rookie" || cohort === "second_year_low_prior" || cohort === "no_prior_stats") {
    return ["Low/no-prior cohort. No-prior baseline is diagnostic-only and separate from weighted_recent_ppg."];
  }
  return [];
}

function fallbackAudit(position: "TE" | "K", rows: ProjectionParityAuditRow[]): ProjectionParityFallbackPositionAudit {
  const positionRows = rows.filter((row) => row.position === position);
  const expectedFallback = position === "TE" ? "te_hard_baseline_fallback" : "k_hard_baseline_fallback";
  const fallbackApplied = positionRows.filter((row) => row.snapshotDiagnostics?.v7GateReason === expectedFallback);
  const baselineMismatch = fallbackApplied.filter((row) => row.gamesBaselineDiff !== null && Math.abs(row.gamesBaselineDiff) > TOLERANCE);
  const metrics = metricSummary(positionRows);
  return {
    position,
    rows: positionRows.length,
    fallbackAppliedRows: fallbackApplied.length,
    fallbackMissingRows: positionRows.length - fallbackApplied.length,
    baselineEquivalentRows: fallbackApplied.length - baselineMismatch.length,
    baselineMismatchRows: baselineMismatch.length,
    weightedMaeTotal: metrics.weightedMaeTotal,
    v7MaeTotal: metrics.v7MaeTotal,
    v7DeltaMaeTotal: metrics.v7DeltaMaeTotal,
    examples: topDiffs(positionRows, "totalDiff"),
  };
}

function isHardFallbackBaselineRow(row: ProjectionParityAuditRow): boolean {
  return row.snapshotDiagnostics?.v7GateReason === "te_hard_baseline_fallback"
    || row.snapshotDiagnostics?.v7GateReason === "k_hard_baseline_fallback";
}

function classifyRootCauses(input: {
  weightedRows: number;
  v7Rows: number;
  ppgMismatches: ProjectionParityAuditRow[];
  baselineImplementationMismatches: ProjectionParityAuditRow[];
  teAudit: ProjectionParityFallbackPositionAudit;
  kAudit: ProjectionParityFallbackPositionAudit;
  v6V7Compared: ProjectionParityAuditRow[];
  v6V7Identical: ProjectionParityAuditRow[];
}): ProjectionParityAuditRootCause[] {
  const causes = new Set<ProjectionParityAuditRootCause>();
  if (input.weightedRows !== input.v7Rows) causes.add("row_universe_difference");
  if (input.ppgMismatches.length) causes.add("ppg_anchor_mismatch");
  if (input.baselineImplementationMismatches.length) causes.add("baseline_games_mismatch");
  if (input.teAudit.fallbackMissingRows || input.kAudit.fallbackMissingRows) causes.add("fallback_not_applied");
  if (input.teAudit.baselineMismatchRows || input.kAudit.baselineMismatchRows) causes.add("fallback_applied_but_not_baseline_equivalent");
  if ((input.teAudit.v7DeltaMaeTotal ?? 0) > 0 || (input.kAudit.v7DeltaMaeTotal ?? 0) > 0) causes.add("te_k_baseline_definition_issue");
  if (input.v6V7Compared.length && input.v6V7Identical.length === input.v6V7Compared.length) causes.add("v6_v7_same_path");
  return causes.size ? [...causes] : ["no_issue_detected"];
}

function recommendations(causes: ProjectionParityAuditRootCause[]): string[] {
  const lines = ["Do not create v8 until the parity audit is clean or each intentional mismatch is explicitly accepted."];
  if (causes.includes("row_universe_difference")) {
    lines.push("Make the weighted baseline and candidate variants evaluate the same row universe, or report separate all-row and shared-row scorecards.");
  }
  if (causes.includes("ppg_anchor_mismatch")) {
    lines.push("Centralize weighted_recent_ppg in one function and reuse it for the baseline and Blackbird expected-games variants.");
  }
  if (causes.includes("baseline_games_mismatch") || causes.includes("fallback_applied_but_not_baseline_equivalent")) {
    lines.push("Define a single baseline expected-games function; TE/K hard fallback should call that function rather than an adjacent approximation.");
  }
  if (causes.includes("fallback_not_applied")) {
    lines.push("Fix TE/K fallback routing before comparing v7 results; missing fallback rows invalidate the TE/K regression interpretation.");
  }
  if (causes.includes("v6_v7_same_path")) {
    lines.push("Confirm v7 has at least one branch that differs from v6 before treating it as a new model; otherwise label it as a v6 alias.");
  }
  if (causes.includes("te_k_baseline_definition_issue")) {
    lines.push("Re-run TE/K diagnostics on shared rows after baseline parity; current TE/K regression may be caused by fallback definition drift, not model signal.");
  }
  return lines;
}

function hasProjection(prediction: ProjectionParityAuditPredictionSummary): boolean {
  return prediction.ppg !== null || prediction.games !== null || prediction.total !== null;
}

function topDiffs(rows: ProjectionParityAuditRow[], key: keyof Pick<ProjectionParityAuditRow, "ppgAnchorDiff" | "gamesBaselineDiff" | "totalDiff" | "v6V7TotalDiff" | "v7V8TotalDiff" | "v7V81TotalDiff" | "v8V81TotalDiff" | "v7V82TotalDiff" | "v81V82TotalDiff">) {
  return [...rows]
    .sort((a, b) => Math.abs((b[key] as number | null) ?? 0) - Math.abs((a[key] as number | null) ?? 0) || a.player.localeCompare(b.player))
    .slice(0, 25);
}

function rowList(rows: ProjectionParityAuditRow[], key: "ppgAnchorDiff" | "gamesBaselineDiff") {
  if (!rows.length) return "None.";
  return rows.slice(0, 10).map((row) => `- ${row.player} ${row.position}: ${key} ${row[key]}, weighted ${key === "ppgAnchorDiff" ? row.weighted.ppg : row.weighted.games}, v7 ${key === "ppgAnchorDiff" ? row.v7.ppg : row.v7.games}`).join("\n");
}

function fallbackMarkdown(audit: ProjectionParityFallbackPositionAudit) {
  return `- Rows: ${audit.rows}
- Fallback applied rows: ${audit.fallbackAppliedRows}
- Fallback missing rows: ${audit.fallbackMissingRows}
- Baseline equivalent rows: ${audit.baselineEquivalentRows}
- Baseline mismatch rows: ${audit.baselineMismatchRows}
- Weighted total MAE: ${audit.weightedMaeTotal ?? "n/a"}
- v7 total MAE: ${audit.v7MaeTotal ?? "n/a"}
- v7 total MAE delta: ${audit.v7DeltaMaeTotal ?? "n/a"}`;
}

function cohortMarkdown(cohort: ProjectionParityCohortComparison): string {
  return `### ${cohort.cohort}

- Description: ${cohort.description}
- Apples-to-apples weighted comparison: ${cohort.applesToApples}
- Rows: ${cohort.rows}
- Weighted rows: ${cohort.weightedRows}
- v7 rows: ${cohort.v7Rows}
- Shared rows: ${cohort.sharedRows}
- No-prior baseline rows: ${cohort.noPriorBaselineRows}
- Weighted games MAE: ${cohort.weightedMaeGames ?? "n/a"}
- v6 games MAE: ${cohort.v6MaeGames ?? "n/a"}
- v7 games MAE: ${cohort.v7MaeGames ?? "n/a"}
- v8 games MAE: ${cohort.v8MaeGames ?? "n/a"}
- v8.1 games MAE: ${cohort.v81MaeGames ?? "n/a"}
- v8.2 games MAE: ${cohort.v82MaeGames ?? "n/a"}
- No-prior baseline games MAE: ${cohort.noPriorBaselineMaeGames ?? "n/a"}
- v8 games MAE delta vs v7: ${cohort.v8DeltaMaeGamesVsV7 ?? "n/a"}
- v8.1 games MAE delta vs v7: ${cohort.v81DeltaMaeGamesVsV7 ?? "n/a"}
- v8.1 games MAE delta vs v8: ${cohort.v81DeltaMaeGamesVsV8 ?? "n/a"}
- v8.2 games MAE delta vs v7: ${cohort.v82DeltaMaeGamesVsV7 ?? "n/a"}
- v8.2 games MAE delta vs v8.1: ${cohort.v82DeltaMaeGamesVsV81 ?? "n/a"}
- v7 games MAE delta vs weighted: ${cohort.v7DeltaMaeGamesVsWeighted ?? "n/a"}
- v8 games MAE delta vs weighted: ${cohort.v8DeltaMaeGamesVsWeighted ?? "n/a"}
- v8.1 games MAE delta vs weighted: ${cohort.v81DeltaMaeGamesVsWeighted ?? "n/a"}
- v8.2 games MAE delta vs weighted: ${cohort.v82DeltaMaeGamesVsWeighted ?? "n/a"}
- v7 games MAE delta vs no-prior baseline: ${cohort.v7DeltaMaeGamesVsNoPriorBaseline ?? "n/a"}
- v8 games MAE delta vs no-prior baseline: ${cohort.v8DeltaMaeGamesVsNoPriorBaseline ?? "n/a"}
- v8.1 games MAE delta vs no-prior baseline: ${cohort.v81DeltaMaeGamesVsNoPriorBaseline ?? "n/a"}
- v8.2 games MAE delta vs no-prior baseline: ${cohort.v82DeltaMaeGamesVsNoPriorBaseline ?? "n/a"}
- v8 rows different from v7: ${cohort.v8DifferentFromV7Rows}
- v8 difference rate vs v7: ${cohort.v8DifferentFromV7Rate ?? "n/a"}
- v8.1 rows different from v7: ${cohort.v81DifferentFromV7Rows}
- v8.1 difference rate vs v7: ${cohort.v81DifferentFromV7Rate ?? "n/a"}
- v8.1 rows different from v8: ${cohort.v81DifferentFromV8Rows}
- v8.1 difference rate vs v8: ${cohort.v81DifferentFromV8Rate ?? "n/a"}
- v8.2 rows different from v7: ${cohort.v82DifferentFromV7Rows}
- v8.2 difference rate vs v7: ${cohort.v82DifferentFromV7Rate ?? "n/a"}
- v8.2 rows different from v8.1: ${cohort.v82DifferentFromV81Rows}
- v8.2 difference rate vs v8.1: ${cohort.v82DifferentFromV81Rate ?? "n/a"}
- Notes: ${cohort.notes.length ? cohort.notes.join(" ") : "None."}`;
}

function identityByCohort(rows: ProjectionParityAuditRow[], left: "v7" | "v8" | "v81", right: "v8" | "v81" | "v82") {
  const cohorts = [...new Set(rows.flatMap((row) => row.evaluationCohorts))].sort();
  return Object.fromEntries(cohorts.map((cohort) => {
    const cohortRows = rows.filter((row) => row.evaluationCohorts.includes(cohort));
    const differentRows = cohortRows.filter((row) =>
      !equalNumber(row[left].ppg, row[right].ppg)
      || !equalNumber(row[left].games, row[right].games)
      || !equalNumber(row[left].total, row[right].total)
    ).length;
    return [cohort, {
      comparedRows: cohortRows.length,
      differentRows,
      differentRate: rate(differentRows, cohortRows.length),
    }];
  }));
}

function playerKey(row: ProjectionBacktestPlayerRow): string {
  return row.identity.sleeperId
    ? `sleeper:${row.identity.sleeperId}`
    : row.identity.gsisId
      ? `gsis:${row.identity.gsisId}`
      : `name:${normalizeName(row.identity.name)}:${row.identity.position}`;
}

function snapshotKey(row: PreseasonProjectionSnapshotRow): string {
  return row.sleeperId
    ? `sleeper:${row.sleeperId}`
    : row.gsisId
      ? `gsis:${row.gsisId}`
      : `name:${row.normalizedName || normalizeName(row.playerName)}:${row.position}`;
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "").replace(/[^a-z0-9]/g, "");
}

function diff(value: number | null, anchor: number | null): number | null {
  if (value === null || anchor === null) return null;
  return round(value - anchor);
}

function equalNumber(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) <= TOLERANCE;
}

function mae(values: Array<number | null>): number | null {
  const valid = values.filter(isNumber).map(Math.abs);
  return mean(valid);
}

function deltaMae(values: Array<number | null>, anchor: Array<number | null>): number | null {
  const valueMae = mae(values);
  const anchorMae = mae(anchor);
  return valueMae !== null && anchorMae !== null ? round(valueMae - anchorMae) : null;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function max(values: number[]): number | null {
  if (!values.length) return null;
  return round(Math.max(...values));
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function rate(count: number, total: number): number | null {
  return total ? round(count / total) : null;
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function relative(filePath: string): string {
  return path.relative(process.cwd(), filePath);
}
