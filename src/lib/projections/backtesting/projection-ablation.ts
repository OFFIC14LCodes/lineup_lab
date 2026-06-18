import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type {
  ProjectionBacktestDataset,
  ProjectionBacktestOptions,
  ProjectionBacktestPrediction,
  ProjectionBacktestSource,
} from "./projection-backtest-types";
import { buildProjectionBacktestDataset } from "./projection-backtest-dataset";
import { metricSet } from "./projection-backtest-metrics";
import { profileInformedPpg, weightedRecentPpg, weightedRecentGames, withPredictions } from "./projection-backtest-runner";
import type {
  ProjectionAblationComponentSummary,
  ProjectionAblationReport,
  ProjectionAblationRow,
  ProjectionAblationVariant,
} from "./projection-ablation-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");

export const PROJECTION_ABLATION_VARIANTS: ProjectionAblationVariant[] = [
  "weighted_recent_ppg",
  "weighted_recent_ppg_plus_baseline_games",
  "weighted_recent_ppg_plus_availability_games",
  "weighted_recent_ppg_plus_cohort_games",
  "weighted_recent_ppg_plus_profile_ppg_adjustment",
  "weighted_recent_ppg_plus_role_ppg_adjustment",
  "weighted_recent_ppg_plus_no_prior_priors",
  "blackbird_v2",
  "blackbird_v3",
  "blackbird_expected_games_v4",
  "blackbird_expected_games_v5_selective",
  "blackbird_expected_games_v6_gated",
  "blackbird_expected_games_v7_family_selective",
  "blackbird_expected_games_v8_cohort_blend",
  "blackbird_expected_games_v8_1_calibrated_gate",
  "blackbird_expected_games_v8_2_high_impact_guardrail",
];

export function runProjectionAblation(input: {
  source: ProjectionBacktestSource;
  options: ProjectionBacktestOptions;
}): ProjectionAblationReport {
  const dataset = buildProjectionBacktestDataset({
    profiles: input.source.profiles,
    options: { ...input.options, includeExistingProjections: true },
    existingProjectionSource: input.source.existingProjectionSource,
  });
  const rows = dataset.rows.map((row) => withPredictions(row, [
    "weighted_recent_ppg",
    "profile_informed_simple",
    "blackbird_availability_calibrated",
    "blackbird_no_prior_calibrated",
    "blackbird_calibrated_v2",
    "blackbird_cohort_games_calibrated",
    "blackbird_cohort_calibrated_v3",
    "blackbird_expected_games_v4",
    "blackbird_expected_games_v5_selective",
    "blackbird_expected_games_v6_gated",
    "blackbird_expected_games_v7_family_selective",
    "blackbird_expected_games_v8_cohort_blend",
    "blackbird_expected_games_v8_1_calibrated_gate",
    "blackbird_expected_games_v8_2_high_impact_guardrail",
  ]));
  const predictedDataset: ProjectionBacktestDataset = { ...dataset, rows };
  const ablationRows = predictedDataset.rows.flatMap((row) => buildAblationRows(row));
  const overall = Object.fromEntries(PROJECTION_ABLATION_VARIANTS.map((variant) => [
    variant,
    metricSet(toDatasetRows(predictedDataset, ablationRows, variant), "weighted_recent_ppg"),
  ])) as ProjectionAblationReport["overall"];
  const byPosition = Object.fromEntries(
    [...new Set(predictedDataset.rows.map((row) => row.identity.position))].sort().map((position) => [
      position,
      Object.fromEntries(PROJECTION_ABLATION_VARIANTS.map((variant) => [
        variant,
        metricSet(toDatasetRows(predictedDataset, ablationRows.filter((row) => row.position === position), variant), "weighted_recent_ppg"),
      ])),
    ])
  ) as ProjectionAblationReport["byPosition"];
  const cohorts = [...new Set(predictedDataset.rows.flatMap((row) => row.cohortLabels))].sort();
  const byCohort = Object.fromEntries(cohorts.map((cohort) => [
    cohort,
    Object.fromEntries(PROJECTION_ABLATION_VARIANTS.map((variant) => [
      variant,
      metricSet(toDatasetRows(predictedDataset, ablationRows.filter((row) => row.cohorts.includes(cohort)), variant), "weighted_recent_ppg"),
    ])),
  ])) as ProjectionAblationReport["byCohort"];
  const componentSummaries = PROJECTION_ABLATION_VARIANTS
    .filter((variant) => variant !== "weighted_recent_ppg")
    .map((variant) => componentSummary(variant, ablationRows, overall, byPosition, byCohort));

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    targetSeason: input.options.targetSeason,
    inputSeasons: predictedDataset.inputSeasonsUsed,
    leakageSafety: {
      ...predictedDataset.leakageSafety,
      passed: predictedDataset.leakageSafety.targetSeasonExcludedFromInputFeatures,
      notes: [
        "Ablation inputs are generated from historical profile seasons strictly before targetSeason.",
        "Target-season data is used only for actual outcomes and error calculations.",
        "This diagnostic is read-only and does not write to Supabase or mutate live projections.",
      ],
    },
    options: input.options,
    variantsEvaluated: PROJECTION_ABLATION_VARIANTS,
    rows: ablationRows,
    overall,
    byPosition,
    byCohort,
    componentSummaries,
    topHelpfulComponents: [...componentSummaries].filter((summary) => (summary.netMaeImpact ?? Infinity) < 0).sort((a, b) => (a.netMaeImpact ?? 0) - (b.netMaeImpact ?? 0)).slice(0, 5),
    topHarmfulComponents: [...componentSummaries].filter((summary) => (summary.netPpgMaeImpact ?? -Infinity) > 0).sort((a, b) => (b.netPpgMaeImpact ?? 0) - (a.netPpgMaeImpact ?? 0)).slice(0, 5),
    ppgComponentFindings: ppgFindings(componentSummaries),
    gamesComponentFindings: gamesFindings(componentSummaries),
    noPriorComponentFindings: noPriorFindings(componentSummaries, byCohort),
    idpFindings: idpFindings(byPosition),
    recommendedNextModelRecipe: recommendedRecipe(componentSummaries),
    sourceModels: {
      weighted_recent_ppg: "weighted_recent_ppg",
      weighted_recent_ppg_plus_baseline_games: "synthetic",
      weighted_recent_ppg_plus_availability_games: "synthetic",
      weighted_recent_ppg_plus_cohort_games: "synthetic",
      weighted_recent_ppg_plus_profile_ppg_adjustment: "synthetic",
      weighted_recent_ppg_plus_role_ppg_adjustment: "synthetic",
      weighted_recent_ppg_plus_no_prior_priors: "synthetic",
      blackbird_v2: "blackbird_calibrated_v2",
      blackbird_v3: "blackbird_cohort_calibrated_v3",
      blackbird_expected_games_v4: "blackbird_expected_games_v4",
      blackbird_expected_games_v5_selective: "blackbird_expected_games_v5_selective",
      blackbird_expected_games_v6_gated: "blackbird_expected_games_v6_gated",
      blackbird_expected_games_v7_family_selective: "blackbird_expected_games_v7_family_selective",
      blackbird_expected_games_v8_cohort_blend: "blackbird_expected_games_v8_cohort_blend",
      blackbird_expected_games_v8_1_calibrated_gate: "blackbird_expected_games_v8_1_calibrated_gate",
      blackbird_expected_games_v8_2_high_impact_guardrail: "blackbird_expected_games_v8_2_high_impact_guardrail",
    },
  };
}

export function writeProjectionAblationArtifacts(report: ProjectionAblationReport) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-ablation-${report.targetSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

export function buildAblationRows(row: ProjectionBacktestDataset["rows"][number]): ProjectionAblationRow[] {
  const anchor = variantPrediction(row, "weighted_recent_ppg");
  return PROJECTION_ABLATION_VARIANTS.map((variant) => {
    const prediction = variantPrediction(row, variant);
    const ppgHelped = helped(prediction?.errorPpg, anchor?.errorPpg);
    const gamesHelped = helped(prediction?.gamesError, anchor?.gamesError);
    return {
      player: row.identity.name,
      sleeperId: row.identity.sleeperId,
      gsisId: row.identity.gsisId,
      position: row.identity.position,
      team: row.identity.team,
      cohort: primaryCohort(row),
      cohorts: row.cohortLabels,
      actualGames: row.actuals.games,
      actualPpg: row.actuals.pointsPerGame,
      actualPoints: row.actuals.totalPoints,
      modelName: variant,
      predictedGames: prediction?.predictedGames ?? null,
      predictedPpg: prediction?.predictedPpg ?? null,
      predictedPoints: prediction?.predictedTotalPoints ?? null,
      ppgError: prediction?.errorPpg ?? null,
      gamesError: prediction?.gamesError ?? null,
      totalError: prediction?.errorTotalPoints ?? null,
      totalErrorDueToPpg: prediction?.ppgErrorComponent ?? null,
      totalErrorDueToGames: prediction?.gamesErrorComponent ?? null,
      helpedOrWorsenedVsWeightedRecent: helpedTotal(prediction?.errorTotalPoints, anchor?.errorTotalPoints),
      componentFlags: componentFlags(variant, row),
      classification: classifyComponentImpact(ppgHelped, gamesHelped),
    };
  });
}

export function variantPrediction(row: ProjectionBacktestDataset["rows"][number], variant: ProjectionAblationVariant): ProjectionBacktestPrediction | null {
  const weighted = row.predictions.weighted_recent_ppg;
  if (variant === "weighted_recent_ppg") return weighted ?? null;
  if (variant === "blackbird_v2") return row.predictions.blackbird_calibrated_v2 ?? null;
  if (variant === "blackbird_v3") return row.predictions.blackbird_cohort_calibrated_v3 ?? null;
  if (variant === "blackbird_expected_games_v4") return row.predictions.blackbird_expected_games_v4 ?? null;
  if (variant === "blackbird_expected_games_v5_selective") return row.predictions.blackbird_expected_games_v5_selective ?? null;
  if (variant === "blackbird_expected_games_v6_gated") return row.predictions.blackbird_expected_games_v6_gated ?? null;
  if (variant === "blackbird_expected_games_v7_family_selective") return row.predictions.blackbird_expected_games_v7_family_selective ?? null;
  if (variant === "blackbird_expected_games_v8_cohort_blend") return row.predictions.blackbird_expected_games_v8_cohort_blend ?? null;
  if (variant === "blackbird_expected_games_v8_1_calibrated_gate") return row.predictions.blackbird_expected_games_v8_1_calibrated_gate ?? null;
  if (variant === "blackbird_expected_games_v8_2_high_impact_guardrail") return row.predictions.blackbird_expected_games_v8_2_high_impact_guardrail ?? null;
  const weightedPpg = weighted?.predictedPpg ?? weightedRecentPpg(row.inputFeatures);
  if (weightedPpg === null) {
    if (variant === "weighted_recent_ppg_plus_no_prior_priors") {
      return synthPrediction(row, variant, row.predictions.blackbird_no_prior_calibrated?.predictedPpg ?? null, row.predictions.blackbird_no_prior_calibrated?.predictedGames ?? null);
    }
    return synthPrediction(row, variant, null, null);
  }
  if (variant === "weighted_recent_ppg_plus_baseline_games") {
    return synthPrediction(row, variant, weightedPpg, baselineGames(row));
  }
  if (variant === "weighted_recent_ppg_plus_availability_games") {
    return synthPrediction(row, variant, weightedPpg, row.predictions.blackbird_availability_calibrated?.predictedGames ?? baselineGames(row));
  }
  if (variant === "weighted_recent_ppg_plus_cohort_games") {
    return synthPrediction(row, variant, weightedPpg, row.predictions.blackbird_cohort_games_calibrated?.predictedGames ?? baselineGames(row));
  }
  if (variant === "weighted_recent_ppg_plus_profile_ppg_adjustment") {
    return synthPrediction(row, variant, profileInformedPpg(row.inputFeatures), weighted?.predictedGames ?? baselineGames(row));
  }
  if (variant === "weighted_recent_ppg_plus_role_ppg_adjustment") {
    return synthPrediction(row, variant, roleAdjustedPpg(row, weightedPpg), weighted?.predictedGames ?? baselineGames(row));
  }
  if (variant === "weighted_recent_ppg_plus_no_prior_priors") {
    const noPrior = row.inputFeatures.inputSeasonsUsed.length === 0;
    return synthPrediction(row, variant, noPrior ? row.predictions.blackbird_no_prior_calibrated?.predictedPpg ?? weightedPpg : weightedPpg, noPrior ? row.predictions.blackbird_no_prior_calibrated?.predictedGames ?? baselineGames(row) : weighted?.predictedGames ?? baselineGames(row));
  }
  return null;
}

function synthPrediction(
  row: ProjectionBacktestDataset["rows"][number],
  variant: ProjectionAblationVariant,
  predictedPpg: number | null,
  predictedGames: number | null
): ProjectionBacktestPrediction {
  const predictedTotalPoints = predictedPpg !== null && predictedGames !== null ? round1(predictedPpg * predictedGames) : null;
  const errorPpg = predictedPpg !== null && row.actuals.pointsPerGame !== null ? round1(predictedPpg - row.actuals.pointsPerGame) : null;
  const errorTotalPoints = predictedTotalPoints !== null ? round1(predictedTotalPoints - row.actuals.totalPoints) : null;
  const gamesError = predictedGames !== null ? round1(predictedGames - row.actuals.games) : null;
  return {
    model: "weighted_recent_ppg",
    predictedPpg,
    predictedGames,
    predictedTotalPoints,
    errorPpg,
    errorTotalPoints,
    gamesError,
    availabilityMissType: availabilityMissType(predictedGames, row.actuals.games),
    ppgErrorComponent: predictedPpg !== null && row.actuals.pointsPerGame !== null && predictedGames !== null ? round1((predictedPpg - row.actuals.pointsPerGame) * predictedGames) : null,
    gamesErrorComponent: predictedGames !== null && row.actuals.pointsPerGame !== null ? round1((predictedGames - row.actuals.games) * row.actuals.pointsPerGame) : null,
    combinedError: errorTotalPoints,
    projectionSource: variant,
    matchConfidence: "synthetic_ablation",
    reasons: [`Synthetic ablation variant: ${variant}.`],
  };
}

function toDatasetRows(dataset: ProjectionBacktestDataset, ablationRows: ProjectionAblationRow[], variant: ProjectionAblationVariant): ProjectionBacktestDataset["rows"] {
  const byKey = new Map(ablationRows.filter((row) => row.modelName === variant).map((row) => [`${row.sleeperId ?? row.gsisId}:${row.modelName}`, row]));
  const rows: ProjectionBacktestDataset["rows"] = [];
  for (const row of dataset.rows) {
    const ablation = byKey.get(`${row.identity.sleeperId ?? row.identity.gsisId}:${variant}`);
    if (!ablation) continue;
    rows.push({
        ...row,
        predictions: {
          ...row.predictions,
          weighted_recent_ppg: synthPrediction(row, variant, ablation.predictedPpg, ablation.predictedGames),
        },
      });
  }
  return rows;
}

function componentSummary(
  variant: ProjectionAblationVariant,
  rows: ProjectionAblationRow[],
  overall: ProjectionAblationReport["overall"],
  byPosition: ProjectionAblationReport["byPosition"],
  byCohort: ProjectionAblationReport["byCohort"]
): ProjectionAblationComponentSummary {
  const variantRows = rows.filter((row) => row.modelName === variant);
  const impact = diff(overall[variant]?.maeTotal, overall.weighted_recent_ppg?.maeTotal);
  const ppgImpact = diff(overall[variant]?.maePpg, overall.weighted_recent_ppg?.maePpg);
  const gamesImpact = diff(overall[variant]?.gamesMae, overall.weighted_recent_ppg?.gamesMae);
  return {
    variant,
    recommendation: recommendationFor(impact, ppgImpact, gamesImpact, variant),
    summary: summaryFor(variant, impact, ppgImpact, gamesImpact),
    playersImproved: variantRows.filter((row) => row.helpedOrWorsenedVsWeightedRecent === "helped").length,
    playersWorsened: variantRows.filter((row) => row.helpedOrWorsenedVsWeightedRecent === "worsened").length,
    playersUnchanged: variantRows.filter((row) => row.helpedOrWorsenedVsWeightedRecent === "unchanged").length,
    netMaeImpact: impact,
    netPpgMaeImpact: ppgImpact,
    netGamesMaeImpact: gamesImpact,
    netBiasImpact: diff(overall[variant]?.biasTotal, overall.weighted_recent_ppg?.biasTotal),
    positionsImproved: directionalKeys(byPosition, variant, "improved"),
    positionsWorsened: directionalKeys(byPosition, variant, "worsened"),
    cohortsImproved: directionalKeys(byCohort, variant, "improved"),
    cohortsWorsened: directionalKeys(byCohort, variant, "worsened"),
  };
}

function directionalKeys(table: Record<string, ProjectionAblationReport["overall"]>, variant: ProjectionAblationVariant, direction: "improved" | "worsened") {
  return Object.entries(table)
    .filter(([, metrics]) => {
      const delta = diff(metrics[variant]?.maeTotal, metrics.weighted_recent_ppg?.maeTotal);
      return delta !== null && (direction === "improved" ? delta < 0 : delta > 0);
    })
    .map(([key]) => key)
    .sort();
}

function recommendedRecipe(summaries: ProjectionAblationComponentSummary[]) {
  const lines = ["Keep weighted_recent_ppg as the PPG anchor until a component improves PPG MAE without material regressions."];
  const games = summaries.find((summary) => summary.variant === "weighted_recent_ppg_plus_availability_games");
  const cohortGames = summaries.find((summary) => summary.variant === "weighted_recent_ppg_plus_cohort_games");
  const profilePpg = summaries.find((summary) => summary.variant === "weighted_recent_ppg_plus_profile_ppg_adjustment");
  const rolePpg = summaries.find((summary) => summary.variant === "weighted_recent_ppg_plus_role_ppg_adjustment");
  if ((games?.netMaeImpact ?? 1) < 0 || (cohortGames?.netMaeImpact ?? 1) < 0) lines.push("Use expected-games components only as diagnostic candidates; split by position before live integration.");
  if ((profilePpg?.netPpgMaeImpact ?? 0) > 0) lines.push("Remove broad profile PPG adjustment for now; it worsens PPG MAE in this backtest.");
  if ((rolePpg?.netMaeImpact ?? 1) < 0 && (rolePpg?.netPpgMaeImpact ?? 1) <= 0) lines.push("Keep tiny role PPG adjustment diagnostic-only; the signal is promising but too small for live integration.");
  lines.push("Next model should test position-specific expected-games families before any PPG adjustment is reintroduced.");
  return lines;
}

function renderMarkdown(report: ProjectionAblationReport) {
  return `# Projection Ablation ${report.targetSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Target season: ${report.targetSeason}
Input seasons: ${report.inputSeasons.join(", ") || "none"}
Leakage safe: ${report.leakageSafety.passed}

## Variants Evaluated

${report.variantsEvaluated.map((variant) => `- ${variant}`).join("\n")}

## Overall Ablation Table

\`\`\`json
${JSON.stringify(report.overall, null, 2)}
\`\`\`

## PPG Component Findings

${report.ppgComponentFindings.map((line) => `- ${line}`).join("\n")}

## Games / Availability Component Findings

${report.gamesComponentFindings.map((line) => `- ${line}`).join("\n")}

## No-Prior Component Findings

${report.noPriorComponentFindings.map((line) => `- ${line}`).join("\n")}

## Position-Level Findings

\`\`\`json
${JSON.stringify(report.byPosition, null, 2).slice(0, 16000)}
\`\`\`

## IDP-Specific Findings

${report.idpFindings.map((line) => `- ${line}`).join("\n")}

## Top Helpful Components

${report.topHelpfulComponents.map((summary) => `- ${summary.variant}: ${summary.summary}`).join("\n") || "- none"}

## Top Harmful Components

${report.topHarmfulComponents.map((summary) => `- ${summary.variant}: ${summary.summary}`).join("\n") || "- none"}

## Component Recommendations

${report.componentSummaries.map((summary) => `- ${summary.variant}: ${summary.recommendation}. ${summary.summary}`).join("\n")}

## Recommended Next Model Recipe

${report.recommendedNextModelRecipe.map((line) => `- ${line}`).join("\n")}

## Leakage Safety

${report.leakageSafety.notes.map((line) => `- ${line}`).join("\n")}
`;
}

function renderCsv(report: ProjectionAblationReport) {
  const headers = [
    "player", "position", "cohort", "actual_games", "actual_ppg", "actual_points", "model_name", "predicted_games",
    "predicted_ppg", "predicted_points", "ppg_error", "games_error", "total_error", "total_error_due_to_ppg",
    "total_error_due_to_games", "helped_worsened_vs_weighted_recent", "component_flags", "classification",
  ];
  const rows = report.rows.map((row) => [
    row.player,
    row.position,
    row.cohort,
    row.actualGames,
    row.actualPpg ?? "",
    row.actualPoints,
    row.modelName,
    row.predictedGames ?? "",
    row.predictedPpg ?? "",
    row.predictedPoints ?? "",
    row.ppgError ?? "",
    row.gamesError ?? "",
    row.totalError ?? "",
    row.totalErrorDueToPpg ?? "",
    row.totalErrorDueToGames ?? "",
    row.helpedOrWorsenedVsWeightedRecent,
    row.componentFlags.join("|"),
    row.classification,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function ppgFindings(summaries: ProjectionAblationComponentSummary[]) {
  return summaries
    .filter((summary) => summary.variant.includes("ppg") || summary.variant.includes("blackbird"))
    .map((summary) => `${summary.variant}: PPG MAE delta ${summary.netPpgMaeImpact ?? "n/a"}; ${summary.recommendation}.`);
}

function gamesFindings(summaries: ProjectionAblationComponentSummary[]) {
  return summaries
    .filter((summary) => summary.variant.includes("games") || summary.variant.includes("v2") || summary.variant.includes("v3") || summary.variant.includes("v4") || summary.variant.includes("v5") || summary.variant.includes("v6") || summary.variant.includes("v7") || summary.variant.includes("v8"))
    .map((summary) => `${summary.variant}: total MAE delta ${summary.netMaeImpact ?? "n/a"}, games MAE delta ${summary.netGamesMaeImpact ?? "n/a"}; ${summary.recommendation}.`);
}

function noPriorFindings(summaries: ProjectionAblationComponentSummary[], byCohort: ProjectionAblationReport["byCohort"]) {
  const noPrior = byCohort.rookie_or_no_prior_nfl_data;
  const candidate = summaries.find((summary) => summary.variant === "weighted_recent_ppg_plus_no_prior_priors");
  return [
    `No-prior prior variant recommendation: ${candidate?.recommendation ?? "unavailable"}.`,
    `No-prior cohort weighted MAE total: ${noPrior?.weighted_recent_ppg?.maeTotal ?? "n/a"}; no-prior prior MAE total: ${noPrior?.weighted_recent_ppg_plus_no_prior_priors?.maeTotal ?? "n/a"}.`,
  ];
}

function idpFindings(byPosition: ProjectionAblationReport["byPosition"]) {
  return ["DL", "LB", "DB"].map((position) => {
    const row = byPosition[position];
    if (!row) return `${position}: not evaluated.`;
    return `${position}: weighted total MAE ${row.weighted_recent_ppg?.maeTotal ?? "n/a"}, v2 ${row.blackbird_v2?.maeTotal ?? "n/a"}, v3 ${row.blackbird_v3?.maeTotal ?? "n/a"}, v4 ${row.blackbird_expected_games_v4?.maeTotal ?? "n/a"}, v5 ${row.blackbird_expected_games_v5_selective?.maeTotal ?? "n/a"}, v6 ${row.blackbird_expected_games_v6_gated?.maeTotal ?? "n/a"}, v7 ${row.blackbird_expected_games_v7_family_selective?.maeTotal ?? "n/a"}, v8 ${row.blackbird_expected_games_v8_cohort_blend?.maeTotal ?? "n/a"}, v8.1 ${row.blackbird_expected_games_v8_1_calibrated_gate?.maeTotal ?? "n/a"}, v8.2 ${row.blackbird_expected_games_v8_2_high_impact_guardrail?.maeTotal ?? "n/a"}.`;
  });
}

function componentFlags(variant: ProjectionAblationVariant, row: ProjectionBacktestDataset["rows"][number]) {
  const flags: string[] = [variant];
  if (variant.includes("games")) flags.push("games_component");
  if (variant.includes("ppg_adjustment")) flags.push("ppg_component");
  if (row.inputFeatures.inputSeasonsUsed.length === 0) flags.push("no_prior");
  if (["DL", "LB", "DB"].includes(row.identity.position)) flags.push("idp");
  if (row.inputFeatures.priorSeasonHighValueUsageFlags.length) flags.push("high_value_usage_available");
  return flags;
}

function baselineGames(row: ProjectionBacktestDataset["rows"][number]) {
  return row.inputFeatures.priorSeasonGames ?? weightedRecentGames(row.inputFeatures);
}

function roleAdjustedPpg(row: ProjectionBacktestDataset["rows"][number], ppg: number) {
  const snap = row.inputFeatures.priorSeasonOffensiveSnapShare ?? row.inputFeatures.priorSeasonDefensiveSnapShare;
  let adjustment = 0;
  if (snap !== null && snap >= 0.75) adjustment += 0.015;
  if (snap !== null && snap < 0.4) adjustment -= 0.02;
  if (row.inputFeatures.priorSeasonHighValueUsageFlags.includes("goal_line_role")) adjustment += 0.01;
  if (row.inputFeatures.roleLabelThroughPreviousSeason === "tackle_floor") adjustment += 0.015;
  if (row.inputFeatures.roleLabelThroughPreviousSeason === "big_play_dependent") adjustment -= 0.015;
  return round1(ppg * (1 + clamp(adjustment, -0.035, 0.035)));
}

function classifyComponentImpact(ppgHelped: boolean | null, gamesHelped: boolean | null) {
  if (ppgHelped === true && gamesHelped === true) return "both_helped";
  if (ppgHelped === false && gamesHelped === false) return "both_hurt";
  if (ppgHelped === true && gamesHelped === false) return "ppg_helped_games_hurt";
  if (gamesHelped === true && ppgHelped === false) return "games_helped_ppg_hurt";
  return "neutral";
}

function helped(value: number | null | undefined, anchor: number | null | undefined) {
  if (value === null || value === undefined || anchor === null || anchor === undefined) return null;
  const delta = Math.abs(value) - Math.abs(anchor);
  if (Math.abs(delta) < 0.05) return null;
  return delta < 0;
}

function helpedTotal(value: number | null | undefined, anchor: number | null | undefined): ProjectionAblationRow["helpedOrWorsenedVsWeightedRecent"] {
  if (value === null || value === undefined || anchor === null || anchor === undefined) return "unavailable";
  const delta = Math.abs(value) - Math.abs(anchor);
  if (Math.abs(delta) < 0.05) return "unchanged";
  return delta < 0 ? "helped" : "worsened";
}

function recommendationFor(totalImpact: number | null, ppgImpact: number | null, gamesImpact: number | null, variant: ProjectionAblationVariant): ProjectionAblationComponentSummary["recommendation"] {
  if (totalImpact === null || ppgImpact === null) return "needs_better_data";
  if (ppgImpact > 0.05 && variant.includes("ppg_adjustment")) return "remove_component";
  if (variant.includes("ppg_adjustment") && totalImpact < 0 && ppgImpact <= 0.02) return "keep_diagnostic_only";
  if (totalImpact < 0 && ppgImpact <= 0.05) return "keep_component";
  if (totalImpact < 0 && ppgImpact > 0.05) return "needs_cohort_split";
  if ((gamesImpact ?? 0) > 0.25 && variant.includes("games")) return "needs_cohort_split";
  return "keep_diagnostic_only";
}

function summaryFor(variant: ProjectionAblationVariant, totalImpact: number | null, ppgImpact: number | null, gamesImpact: number | null) {
  return `${variant} total MAE delta ${totalImpact ?? "n/a"}, PPG MAE delta ${ppgImpact ?? "n/a"}, games MAE delta ${gamesImpact ?? "n/a"} vs weighted_recent_ppg.`;
}

function primaryCohort(row: ProjectionBacktestDataset["rows"][number]) {
  return row.cohortLabels.find((cohort) => cohort.startsWith("offense_") || cohort.startsWith("idp_") || cohort === "kicker") ?? row.priorDataGroup;
}

function diff(value: number | null | undefined, anchor: number | null | undefined) {
  return typeof value === "number" && typeof anchor === "number" ? round3(value - anchor) : null;
}

function availabilityMissType(predictedGames: number | null, actualGames: number) {
  if (predictedGames === null) return "no_games_projection";
  if (actualGames < 4) return "low_actual_games";
  const error = predictedGames - actualGames;
  if (Math.abs(error) <= 2) return "accurate_games";
  if (Math.abs(error) >= 6) return "major_availability_miss";
  return error > 0 ? "overestimated_availability" : "underestimated_availability";
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
