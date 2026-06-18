import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type {
  ProjectionBacktestAvailabilityMissType,
  ProjectionBacktestBaselineModel,
  ProjectionBacktestDataset,
  ProjectionBacktestLeader,
  ProjectionBacktestMetrics,
  ProjectionBacktestOptions,
  ProjectionBacktestRankMiss,
  ProjectionBacktestReport,
  ProjectionBacktestExistingProjectionSource,
} from "./projection-backtest-types";
import type { PlayerProfileScoringMetadata } from "@/lib/player-profiles";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");

export function summarizeBacktestDiagnostics(input: {
  dataset: ProjectionBacktestDataset;
  metrics: ProjectionBacktestMetrics;
  options: ProjectionBacktestOptions;
  scoringMetadata: PlayerProfileScoringMetadata;
  existingProjectionSource?: ProjectionBacktestExistingProjectionSource | null;
}): ProjectionBacktestReport {
  const model = input.metrics.bestBaselineModel ?? "profile_informed_simple";
  const positionCounts = countBy(input.dataset.rows.map((row) => row.identity.position));
  const classificationCounts = countBy(input.dataset.rows.map((row) => row.classification));
  const idpRows = input.dataset.rows.filter((row) => ["DL", "LB", "DB"].includes(row.identity.position));

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    targetSeason: input.options.targetSeason,
    scoring: {
      source: input.scoringMetadata.scoringSource,
      profile: input.scoringMetadata.scoringProfileName,
      warnings: input.scoringMetadata.warnings,
    },
    options: input.options,
    playersEvaluated: input.dataset.rows.length,
    playersSkipped: input.dataset.skipped,
    dataset: input.dataset,
    metrics: input.metrics,
    classificationCounts,
    positionCounts,
    overprojectedLeaders: leaders(input.dataset, model, "over"),
    underprojectedLeaders: leaders(input.dataset, model, "under"),
    biggestRankMisses: rankMisses(input.dataset, model),
    existingProjectionSummary: existingProjectionSummary(input.dataset, input.existingProjectionSource ?? null, input.options.includeExistingProjections ?? false),
    availabilitySummary: availabilitySummary(input.dataset, model),
    errorDecompositionSummary: errorDecompositionSummary(input.dataset, model),
    priorDataSummary: countBy(input.dataset.rows.map((row) => row.priorDataGroup)) as ProjectionBacktestReport["priorDataSummary"],
    idpCalibrationSummary: {
      included: input.options.includeIdp || input.dataset.rows.some((row) => ["DL", "LB", "DB"].includes(row.identity.position)),
      playersEvaluated: idpRows.length,
      bestBaselineModel: bestModelForRows(idpRows, input.metrics.bestBaselineModel),
      byPosition: Object.fromEntries(["DL", "LB", "DB"].map((position) => [position, input.metrics.byPosition[position]?.[model] ?? null]).filter(([, value]) => value)) as ProjectionBacktestReport["idpCalibrationSummary"]["byPosition"],
      roleLabelCounts: countBy(idpRows.map((row) => row.inputFeatures.roleLabelThroughPreviousSeason)),
      overprojectionLeaders: leaders({ ...input.dataset, rows: idpRows }, model, "over"),
      underprojectionLeaders: leaders({ ...input.dataset, rows: idpRows }, model, "under"),
      notes: idpRows.length
        ? ["IDP rows were scored with the selected scoring profile, including solo tackles and sacks when present."]
        : ["IDP rows were not included. Use --include-idp or --positions=DL,LB,DB to evaluate defensive players."],
    },
    rookieLowSampleSummary: {
      lowActualSamplePlayers: classificationCounts.low_sample_actual ?? 0,
      insufficientPriorDataPlayers: classificationCounts.insufficient_prior_data ?? 0,
    },
    leakageSafety: {
      ...input.dataset.leakageSafety,
      notes: [
        "Target-season actual weekly scores and season summaries are used only in actual outcome and error metrics.",
        "Input features are built only from profile seasons strictly before targetSeason.",
        "Profile-wide metadata is limited to identity, warnings, and coverage diagnostics; numeric model inputs are prior-season/career-to-date only.",
      ],
    },
    recommendedNextCalibrationPriorities: recommendedPriorities(input.dataset),
  };
}

export function writeProjectionBacktestArtifacts(report: ProjectionBacktestReport) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-backtest-${report.targetSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function leaders(dataset: ProjectionBacktestDataset, model: ProjectionBacktestBaselineModel, direction: "over" | "under"): ProjectionBacktestLeader[] {
  return dataset.rows
    .map((row) => {
      const prediction = row.predictions[model];
      return {
        player: row.identity.name,
        position: row.identity.position,
        team: row.identity.team,
        model,
        predictedPpg: prediction?.predictedPpg ?? null,
        actualPpg: row.actuals.pointsPerGame,
        errorPpg: prediction?.errorPpg ?? null,
        predictedTotalPoints: prediction?.predictedTotalPoints ?? null,
        actualTotalPoints: row.actuals.totalPoints,
        errorTotalPoints: prediction?.errorTotalPoints ?? null,
        classification: row.classification,
      };
    })
    .filter((row) => row.errorPpg !== null)
    .sort((a, b) => direction === "over" ? (b.errorPpg ?? 0) - (a.errorPpg ?? 0) : (a.errorPpg ?? 0) - (b.errorPpg ?? 0))
    .slice(0, 25);
}

function rankMisses(dataset: ProjectionBacktestDataset, model: ProjectionBacktestBaselineModel): ProjectionBacktestRankMiss[] {
  const byPosition = new Map<string, typeof dataset.rows>();
  for (const row of dataset.rows) byPosition.set(row.identity.position, [...(byPosition.get(row.identity.position) ?? []), row]);
  const misses: ProjectionBacktestRankMiss[] = [];
  for (const positionRows of byPosition.values()) {
    const predictedRanks = new Map(positionRows
      .filter((row) => row.predictions[model]?.predictedTotalPoints !== null)
      .sort((a, b) => (b.predictions[model]?.predictedTotalPoints ?? -Infinity) - (a.predictions[model]?.predictedTotalPoints ?? -Infinity))
      .map((row, index) => [playerKey(row), index + 1]));
    for (const row of positionRows) {
      const predictedRank = predictedRanks.get(playerKey(row));
      const actualRank = row.actuals.positionalRank;
      if (!predictedRank || !actualRank) continue;
      misses.push({
        player: row.identity.name,
        position: row.identity.position,
        team: row.identity.team,
        model,
        predictedRank,
        actualRank,
        rankDelta: predictedRank - actualRank,
      });
    }
  }
  return misses.sort((a, b) => Math.abs(b.rankDelta) - Math.abs(a.rankDelta)).slice(0, 25);
}

function renderMarkdown(report: ProjectionBacktestReport) {
  const best = report.metrics.bestBaselineModel ?? "n/a";
  const worst = report.metrics.worstBaselineModel ?? "n/a";
  return `# Projection Backtest ${report.targetSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Scoring source: ${report.scoring.source}
Scoring profile: ${report.scoring.profile}

## Dataset

- Players evaluated: ${report.playersEvaluated}
- Players skipped: ${JSON.stringify(report.playersSkipped)}
- Input seasons used: ${report.leakageSafety.inputSeasonsUsed.join(", ") || "none"}
- Actual season used: ${report.leakageSafety.actualSeasonUsed}
- Target season excluded from input features: ${report.leakageSafety.targetSeasonExcludedFromInputFeatures}

## Metrics Overall

\`\`\`json
${JSON.stringify(report.metrics.overall, null, 2)}
\`\`\`

## Metrics By Position

\`\`\`json
${JSON.stringify(report.metrics.byPosition, null, 2).slice(0, 12000)}
\`\`\`

## Baselines

- Best baseline model: ${best}
- Worst baseline model: ${worst}

## Existing Blackbird Projection Source

- Requested: ${report.existingProjectionSummary.requested}
- Status: ${report.existingProjectionSummary.status}
- Source: ${report.existingProjectionSummary.sourceName ?? "n/a"}
- Source path: ${report.existingProjectionSummary.sourcePath ?? "n/a"}
- Leakage safe: ${report.existingProjectionSummary.leakageSafe}
- Source rows: ${report.existingProjectionSummary.sourceRows}
- Matched rows: ${report.existingProjectionSummary.matchedRows}
- Match coverage: ${report.existingProjectionSummary.matchCoverage ?? "n/a"}
- Diagnostics:
${report.existingProjectionSummary.diagnostics.slice(0, 12).map((note) => `  - ${note}`).join("\n") || "  - none"}

## Weighted Recent vs Blackbird Existing Projection

- Weighted recent MAE PPG: ${report.metrics.overall.weighted_recent_ppg?.maePpg ?? "n/a"}
- Weighted recent RMSE PPG: ${report.metrics.overall.weighted_recent_ppg?.rmsePpg ?? "n/a"}
- Existing Blackbird MAE PPG: ${report.metrics.overall.blackbird_existing_projection?.maePpg ?? "unavailable"}
- Existing Blackbird RMSE PPG: ${report.metrics.overall.blackbird_existing_projection?.rmsePpg ?? "unavailable"}
- Calibrated v2 MAE PPG: ${report.metrics.overall.blackbird_calibrated_v2?.maePpg ?? "unavailable"}
- Calibrated v2 RMSE PPG: ${report.metrics.overall.blackbird_calibrated_v2?.rmsePpg ?? "unavailable"}
- Cohort v3 MAE PPG: ${report.metrics.overall.blackbird_cohort_calibrated_v3?.maePpg ?? "unavailable"}
- Cohort v3 RMSE PPG: ${report.metrics.overall.blackbird_cohort_calibrated_v3?.rmsePpg ?? "unavailable"}
- Expected-games v4 MAE PPG: ${report.metrics.overall.blackbird_expected_games_v4?.maePpg ?? "unavailable"}
- Expected-games v4 RMSE PPG: ${report.metrics.overall.blackbird_expected_games_v4?.rmsePpg ?? "unavailable"}
- Expected-games v5 selective MAE PPG: ${report.metrics.overall.blackbird_expected_games_v5_selective?.maePpg ?? "unavailable"}
- Expected-games v5 selective RMSE PPG: ${report.metrics.overall.blackbird_expected_games_v5_selective?.rmsePpg ?? "unavailable"}
- Expected-games v6 gated MAE PPG: ${report.metrics.overall.blackbird_expected_games_v6_gated?.maePpg ?? "unavailable"}
- Expected-games v6 gated RMSE PPG: ${report.metrics.overall.blackbird_expected_games_v6_gated?.rmsePpg ?? "unavailable"}
- Expected-games v7 family selective MAE PPG: ${report.metrics.overall.blackbird_expected_games_v7_family_selective?.maePpg ?? "unavailable"}
- Expected-games v7 family selective RMSE PPG: ${report.metrics.overall.blackbird_expected_games_v7_family_selective?.rmsePpg ?? "unavailable"}
- Calibrated v2 beats weighted recent PPG MAE: ${beatsWeightedRecent(report)}
- Cohort v3 beats weighted recent PPG MAE: ${beatsWeightedRecent(report, "blackbird_cohort_calibrated_v3")}
- Cohort v3 beats weighted recent total MAE: ${beatsWeightedRecentTotal(report, "blackbird_cohort_calibrated_v3")}
- Expected-games v4 beats weighted recent PPG MAE: ${beatsWeightedRecent(report, "blackbird_expected_games_v4")}
- Expected-games v4 beats weighted recent total MAE: ${beatsWeightedRecentTotal(report, "blackbird_expected_games_v4")}
- Expected-games v5 selective beats weighted recent PPG MAE: ${beatsWeightedRecent(report, "blackbird_expected_games_v5_selective")}
- Expected-games v5 selective beats weighted recent total MAE: ${beatsWeightedRecentTotal(report, "blackbird_expected_games_v5_selective")}
- Expected-games v6 gated beats weighted recent PPG MAE: ${beatsWeightedRecent(report, "blackbird_expected_games_v6_gated")}
- Expected-games v6 gated beats weighted recent total MAE: ${beatsWeightedRecentTotal(report, "blackbird_expected_games_v6_gated")}
- Expected-games v7 family selective beats weighted recent PPG MAE: ${beatsWeightedRecent(report, "blackbird_expected_games_v7_family_selective")}
- Expected-games v7 family selective beats weighted recent total MAE: ${beatsWeightedRecentTotal(report, "blackbird_expected_games_v7_family_selective")}

## Do-No-Harm Gate

\`\`\`json
${JSON.stringify(doNoHarmGate(report), null, 2)}
\`\`\`

## Cohort Metrics

\`\`\`json
${JSON.stringify(report.metrics.byCohort, null, 2).slice(0, 18000)}
\`\`\`

## V1 vs Calibrated V2

\`\`\`json
${JSON.stringify({
  v1: report.metrics.overall.blackbird_existing_projection ?? null,
  availabilityCalibrated: report.metrics.overall.blackbird_availability_calibrated ?? null,
  noPriorCalibrated: report.metrics.overall.blackbird_no_prior_calibrated ?? null,
  calibratedV2: report.metrics.overall.blackbird_calibrated_v2 ?? null,
  cohortGames: report.metrics.overall.blackbird_cohort_games_calibrated ?? null,
  cohortPpg: report.metrics.overall.blackbird_cohort_ppg_calibrated ?? null,
  cohortV3: report.metrics.overall.blackbird_cohort_calibrated_v3 ?? null,
  expectedGamesV4: report.metrics.overall.blackbird_expected_games_v4 ?? null,
  expectedGamesV5Selective: report.metrics.overall.blackbird_expected_games_v5_selective ?? null,
  expectedGamesV6Gated: report.metrics.overall.blackbird_expected_games_v6_gated ?? null,
  expectedGamesV7FamilySelective: report.metrics.overall.blackbird_expected_games_v7_family_selective ?? null,
  weightedRecent: report.metrics.overall.weighted_recent_ppg ?? null,
}, null, 2)}
\`\`\`

## Availability / Expected Games

\`\`\`json
${JSON.stringify(report.availabilitySummary, null, 2)}
\`\`\`

## Position-Family Decision Table

${positionFamilyDecisionTable(report)}

## PPG vs Games Error Decomposition

\`\`\`json
${JSON.stringify(report.errorDecompositionSummary, null, 2)}
\`\`\`

## Rookie / No-Prior Groups

\`\`\`json
${JSON.stringify(report.priorDataSummary, null, 2)}
\`\`\`

## Overprojected Leaders

${leaderTable(report.overprojectedLeaders)}

## Underprojected Leaders

${leaderTable(report.underprojectedLeaders)}

## Biggest Rank Misses

${rankMissTable(report.biggestRankMisses)}

## IDP Calibration Summary

- Included: ${report.idpCalibrationSummary.included}
- IDP players evaluated: ${report.idpCalibrationSummary.playersEvaluated}
- Best IDP baseline model: ${report.idpCalibrationSummary.bestBaselineModel ?? "n/a"}
- IDP role labels: ${JSON.stringify(report.idpCalibrationSummary.roleLabelCounts)}
- Notes: ${report.idpCalibrationSummary.notes.join(" ")}

## Rookie / Low-Sample Summary

- Low actual sample players: ${report.rookieLowSampleSummary.lowActualSamplePlayers}
- Insufficient prior data players: ${report.rookieLowSampleSummary.insufficientPriorDataPlayers}

## Data Leakage Prevention

${report.leakageSafety.notes.map((note) => `- ${note}`).join("\n")}

## Recommended Next Calibration Priorities

${report.recommendedNextCalibrationPriorities.map((note) => `- ${note}`).join("\n")}
`;
}

function renderCsv(report: ProjectionBacktestReport) {
  const headers = [
    "player",
    "position",
    "team",
    "target_season_games",
    "actual_points",
    "actual_ppg",
    "prior_season_predicted_points",
    "prior_season_predicted_ppg",
    "weighted_recent_predicted_points",
    "weighted_recent_predicted_ppg",
    "career_recent_predicted_points",
    "career_recent_predicted_ppg",
    "profile_informed_predicted_points",
    "profile_informed_predicted_ppg",
    "profile_informed_error_ppg",
    "blackbird_predicted_points",
    "blackbird_predicted_ppg",
    "blackbird_predicted_games",
    "blackbird_v2_predicted_points",
    "blackbird_v2_predicted_ppg",
    "blackbird_v2_predicted_games",
    "blackbird_v3_predicted_points",
    "blackbird_v3_predicted_ppg",
    "blackbird_v3_predicted_games",
    "blackbird_expected_games_v4_predicted_points",
    "blackbird_expected_games_v4_predicted_ppg",
    "blackbird_expected_games_v4_predicted_games",
    "blackbird_expected_games_v5_selective_predicted_points",
    "blackbird_expected_games_v5_selective_predicted_ppg",
    "blackbird_expected_games_v5_selective_predicted_games",
    "blackbird_expected_games_v6_gated_predicted_points",
    "blackbird_expected_games_v6_gated_predicted_ppg",
    "blackbird_expected_games_v6_gated_predicted_games",
    "blackbird_expected_games_v7_family_selective_predicted_points",
    "blackbird_expected_games_v7_family_selective_predicted_ppg",
    "blackbird_expected_games_v7_family_selective_predicted_games",
    "blackbird_projection_source",
    "blackbird_match_confidence",
    "games_error",
    "ppg_error_component",
    "games_error_component",
    "combined_error",
    "availability_miss_type",
    "rookie_no_prior_group",
    "cohorts",
    "best_baseline",
    "classification",
    "prior_season_ppg",
    "career_to_date_ppg",
    "consistency",
    "spike",
    "availability",
    "snap_share",
    "role_label",
    "high_value_usage_flags",
    "warnings",
  ];
  const rows = report.dataset.rows.map((row) => [
    row.identity.name,
    row.identity.position,
    row.identity.team ?? "",
    row.actuals.games,
    row.actuals.totalPoints,
    row.actuals.pointsPerGame ?? "",
    row.predictions.prior_season_ppg?.predictedTotalPoints ?? "",
    row.predictions.prior_season_ppg?.predictedPpg ?? "",
    row.predictions.weighted_recent_ppg?.predictedTotalPoints ?? "",
    row.predictions.weighted_recent_ppg?.predictedPpg ?? "",
    row.predictions.career_recent_blend?.predictedTotalPoints ?? "",
    row.predictions.career_recent_blend?.predictedPpg ?? "",
    row.predictions.profile_informed_simple?.predictedTotalPoints ?? "",
    row.predictions.profile_informed_simple?.predictedPpg ?? "",
    row.predictions.profile_informed_simple?.errorPpg ?? "",
    row.predictions.blackbird_existing_projection?.predictedTotalPoints ?? "",
    row.predictions.blackbird_existing_projection?.predictedPpg ?? "",
    row.predictions.blackbird_existing_projection?.predictedGames ?? "",
    row.predictions.blackbird_calibrated_v2?.predictedTotalPoints ?? "",
    row.predictions.blackbird_calibrated_v2?.predictedPpg ?? "",
    row.predictions.blackbird_calibrated_v2?.predictedGames ?? "",
    row.predictions.blackbird_cohort_calibrated_v3?.predictedTotalPoints ?? "",
    row.predictions.blackbird_cohort_calibrated_v3?.predictedPpg ?? "",
    row.predictions.blackbird_cohort_calibrated_v3?.predictedGames ?? "",
    row.predictions.blackbird_expected_games_v4?.predictedTotalPoints ?? "",
    row.predictions.blackbird_expected_games_v4?.predictedPpg ?? "",
    row.predictions.blackbird_expected_games_v4?.predictedGames ?? "",
    row.predictions.blackbird_expected_games_v5_selective?.predictedTotalPoints ?? "",
    row.predictions.blackbird_expected_games_v5_selective?.predictedPpg ?? "",
    row.predictions.blackbird_expected_games_v5_selective?.predictedGames ?? "",
    row.predictions.blackbird_expected_games_v6_gated?.predictedTotalPoints ?? "",
    row.predictions.blackbird_expected_games_v6_gated?.predictedPpg ?? "",
    row.predictions.blackbird_expected_games_v6_gated?.predictedGames ?? "",
    row.predictions.blackbird_expected_games_v7_family_selective?.predictedTotalPoints ?? "",
    row.predictions.blackbird_expected_games_v7_family_selective?.predictedPpg ?? "",
    row.predictions.blackbird_expected_games_v7_family_selective?.predictedGames ?? "",
    row.predictions.blackbird_existing_projection?.projectionSource ?? "",
    row.predictions.blackbird_existing_projection?.matchConfidence ?? "",
    row.predictions.profile_informed_simple?.gamesError ?? "",
    row.predictions.profile_informed_simple?.ppgErrorComponent ?? "",
    row.predictions.profile_informed_simple?.gamesErrorComponent ?? "",
    row.predictions.profile_informed_simple?.combinedError ?? "",
    row.predictions.profile_informed_simple?.availabilityMissType ?? "",
    row.priorDataGroup,
    row.cohortLabels.join("|"),
    row.bestBaseline ?? "",
    row.classification,
    row.inputFeatures.priorSeasonPpg ?? "",
    row.inputFeatures.careerToDatePpg ?? "",
    row.inputFeatures.priorSeasonConsistency ?? "",
    row.inputFeatures.priorSeasonSpike ?? "",
    row.inputFeatures.priorSeasonAvailability ?? "",
    row.inputFeatures.priorSeasonOffensiveSnapShare ?? row.inputFeatures.priorSeasonDefensiveSnapShare ?? "",
    row.inputFeatures.roleLabelThroughPreviousSeason,
    row.inputFeatures.priorSeasonHighValueUsageFlags.join("|"),
    row.inputFeatures.warnings.join("|"),
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function recommendedPriorities(dataset: ProjectionBacktestDataset) {
  const counts = countBy(dataset.rows.map((row) => row.classification));
  const priorities = [
    "Compare profile-informed baseline against persisted Blackbird projection outputs once target-season projection run selection is explicit.",
    "Add a true preseason availability model instead of using prior-season games as expected games.",
  ];
  if ((counts.insufficient_prior_data ?? 0) > 0) priorities.push("Build separate rookie and no-prior-data baselines using rookie enrichment and market-independent context.");
  if ((counts.injury_or_availability_candidate ?? 0) > 0) priorities.push("Calibrate injury/availability features because missed games drive large total-point errors.");
  return priorities;
}

function existingProjectionSummary(dataset: ProjectionBacktestDataset, source: ProjectionBacktestExistingProjectionSource | null, requested: boolean): ProjectionBacktestReport["existingProjectionSummary"] {
  const matchedRows = dataset.rows.filter((row) => {
    const prediction = row.predictions.blackbird_existing_projection;
    return prediction?.predictedTotalPoints != null || prediction?.predictedPpg != null;
  }).length;
  return {
    requested,
    status: source?.status ?? "unavailable",
    sourceName: source?.sourceName ?? null,
    sourcePath: source?.sourcePath ?? null,
    leakageSafe: Boolean(source?.leakageSafe),
    sourceRows: source?.rows.length ?? 0,
    matchedRows,
    matchCoverage: dataset.rows.length ? round(matchedRows / dataset.rows.length) : null,
    diagnostics: source?.diagnostics ?? ["Existing projection loading was not requested."],
  };
}

function availabilitySummary(dataset: ProjectionBacktestDataset, model: ProjectionBacktestBaselineModel | null): ProjectionBacktestReport["availabilitySummary"] {
  if (!model) return { model: null, counts: emptyAvailabilityCounts(), averageGamesError: null, gamesMae: null, majorMissPlayers: 0 };
  const predictions = dataset.rows.map((row) => row.predictions[model]).filter(Boolean);
  const gamesErrors = predictions.map((prediction) => prediction?.gamesError).filter(isNumber);
  const counts = countBy(predictions.map((prediction) => prediction?.availabilityMissType ?? "no_games_projection"));
  return {
    model,
    counts,
    averageGamesError: mean(gamesErrors),
    gamesMae: mean(gamesErrors.map(Math.abs)),
    majorMissPlayers: counts.major_availability_miss ?? 0,
  };
}

function emptyAvailabilityCounts(): Record<ProjectionBacktestAvailabilityMissType, number> {
  return {
    accurate_games: 0,
    overestimated_availability: 0,
    underestimated_availability: 0,
    major_availability_miss: 0,
    low_actual_games: 0,
    no_games_projection: 0,
  };
}

function errorDecompositionSummary(dataset: ProjectionBacktestDataset, model: ProjectionBacktestBaselineModel | null): ProjectionBacktestReport["errorDecompositionSummary"] {
  if (!model) return { model: null, averagePpgErrorComponent: null, averageGamesErrorComponent: null, averageCombinedError: null, ppgDrivenMisses: 0, availabilityDrivenMisses: 0 };
  const predictions = dataset.rows.map((row) => row.predictions[model]).filter(Boolean);
  const ppgComponents = predictions.map((prediction) => prediction?.ppgErrorComponent).filter(isNumber);
  const gamesComponents = predictions.map((prediction) => prediction?.gamesErrorComponent).filter(isNumber);
  const combined = predictions.map((prediction) => prediction?.combinedError).filter(isNumber);
  let ppgDrivenMisses = 0;
  let availabilityDrivenMisses = 0;
  for (const prediction of predictions) {
    const ppg = Math.abs(prediction?.ppgErrorComponent ?? 0);
    const games = Math.abs(prediction?.gamesErrorComponent ?? 0);
    if (ppg > games) ppgDrivenMisses += 1;
    if (games > ppg) availabilityDrivenMisses += 1;
  }
  return {
    model,
    averagePpgErrorComponent: mean(ppgComponents),
    averageGamesErrorComponent: mean(gamesComponents),
    averageCombinedError: mean(combined),
    ppgDrivenMisses,
    availabilityDrivenMisses,
  };
}

function leaderTable(rows: ProjectionBacktestLeader[]) {
  if (!rows.length) return "None.";
  return rows.slice(0, 10).map((row) => `- ${row.player} ${row.position}: error PPG ${row.errorPpg}, predicted ${row.predictedPpg}, actual ${row.actualPpg}`).join("\n");
}

function rankMissTable(rows: ProjectionBacktestRankMiss[]) {
  if (!rows.length) return "None.";
  return rows.slice(0, 10).map((row) => `- ${row.player} ${row.position}: predicted #${row.predictedRank}, actual #${row.actualRank}, delta ${row.rankDelta}`).join("\n");
}

function positionFamilyDecisionTable(report: ProjectionBacktestReport) {
  const rows = [
    ["QB", "Starter-probability expected games", "Clear/probable starters allowed; unstable/backup/no-prior QBs capped.", "diagnostic volatility remains", "v7 keeps QB capped vs v6", "Diagnostic only"],
    ["RB", "Expected-games enabled", "Prior diagnostics improved RB total MAE.", resultLabel(report, "RB", "weighted_recent_ppg"), resultLabel(report, "RB", "blackbird_expected_games_v6_gated"), "Keep testing"],
    ["WR", "Role-gated expected-games enabled", "Only medium/high role confidence receives expected-games adjustment.", resultLabel(report, "WR", "weighted_recent_ppg"), resultLabel(report, "WR", "blackbird_expected_games_v6_gated"), "Keep testing"],
    ["TE", "Hard baseline fallback", "Prior expected-games variants materially regressed TE.", resultLabel(report, "TE", "weighted_recent_ppg"), resultLabel(report, "TE", "blackbird_expected_games_v6_gated"), "Do not enable"],
    ["K", "Hard baseline/simple fallback", "Prior expected-games variants materially regressed K.", resultLabel(report, "K", "weighted_recent_ppg"), resultLabel(report, "K", "blackbird_expected_games_v6_gated"), "Do not enable"],
    ["DL", "IDP expected-games enabled", "DL improved in prior expected-games diagnostics with rotational safeguards.", resultLabel(report, "DL", "weighted_recent_ppg"), resultLabel(report, "DL", "blackbird_expected_games_v6_gated"), "Keep testing"],
    ["LB", "IDP expected-games enabled", "LB tackle-floor/full-time role signal is preserved.", resultLabel(report, "LB", "weighted_recent_ppg"), resultLabel(report, "LB", "blackbird_expected_games_v6_gated"), "Keep testing"],
    ["DB", "IDP expected-games enabled", "DB uses tackle-floor/snap safeguards for volatility.", resultLabel(report, "DB", "weighted_recent_ppg"), resultLabel(report, "DB", "blackbird_expected_games_v6_gated"), "Keep testing"],
  ];
  return [
    "| Position | Model Used | Reason | Result vs weighted | Result vs v6 | Recommendation |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function resultLabel(report: ProjectionBacktestReport, position: string, anchor: ProjectionBacktestBaselineModel) {
  const row = report.metrics.byPosition[position];
  const v7 = row?.blackbird_expected_games_v7_family_selective?.maeTotal;
  const base = row?.[anchor]?.maeTotal;
  if (typeof v7 !== "number" || typeof base !== "number") return "unavailable";
  const delta = round(v7 - base);
  return delta <= 0 ? `improves ${Math.abs(delta)}` : `regresses ${delta}`;
}

function beatsWeightedRecent(report: ProjectionBacktestReport, model: ProjectionBacktestBaselineModel = "blackbird_calibrated_v2") {
  const weighted = report.metrics.overall.weighted_recent_ppg?.maePpg;
  const candidate = report.metrics.overall[model]?.maePpg;
  return typeof weighted === "number" && typeof candidate === "number" ? candidate <= weighted : false;
}

function beatsWeightedRecentTotal(report: ProjectionBacktestReport, model: ProjectionBacktestBaselineModel) {
  const weighted = report.metrics.overall.weighted_recent_ppg?.maeTotal;
  const candidate = report.metrics.overall[model]?.maeTotal;
  return typeof weighted === "number" && typeof candidate === "number" ? candidate <= weighted : false;
}

function doNoHarmGate(report: ProjectionBacktestReport) {
  const model: ProjectionBacktestBaselineModel = report.metrics.overall.blackbird_expected_games_v7_family_selective ? "blackbird_expected_games_v7_family_selective" : report.metrics.overall.blackbird_expected_games_v6_gated ? "blackbird_expected_games_v6_gated" : report.metrics.overall.blackbird_expected_games_v5_selective ? "blackbird_expected_games_v5_selective" : report.metrics.overall.blackbird_expected_games_v4 ? "blackbird_expected_games_v4" : "blackbird_cohort_calibrated_v3";
  const weighted = report.metrics.overall.weighted_recent_ppg;
  const v3 = report.metrics.overall[model];
  const positionComparisons = Object.fromEntries(Object.entries(report.metrics.byPosition).map(([position, rows]) => {
    const weightedPpg = rows.weighted_recent_ppg?.maePpg;
    const candidatePpg = rows[model]?.maePpg;
    const delta = typeof weightedPpg === "number" && typeof candidatePpg === "number" ? round(candidatePpg - weightedPpg) : null;
    return [position, {
      weightedMaePpg: weightedPpg ?? null,
      v3MaePpg: candidatePpg ?? null,
      delta,
      beatsWeightedRecent: delta !== null ? delta <= 0 : false,
      materiallyWorse: delta !== null ? delta > 0.25 : false,
    }];
  }));
  const improvedPositions = Object.values(positionComparisons).filter((row) => row.beatsWeightedRecent).length;
  const badlyRegressedPositions = Object.values(positionComparisons).filter((row) => row.materiallyWorse).length;
  const ppgDelta = typeof weighted?.maePpg === "number" && typeof v3?.maePpg === "number" ? round(v3.maePpg - weighted.maePpg) : null;
  const totalDelta = typeof weighted?.maeTotal === "number" && typeof v3?.maeTotal === "number" ? round(v3.maeTotal - weighted.maeTotal) : null;
  const passes = (totalDelta ?? Infinity) <= 0 && (ppgDelta ?? Infinity) <= 0.05 && improvedPositions >= 3 && badlyRegressedPositions === 0;
  return {
    recommendedForLiveIntegration: passes,
    ppgMaeDeltaVsWeightedRecent: ppgDelta,
    totalMaeDeltaVsWeightedRecent: totalDelta,
    improvedPositions,
    badlyRegressedPositions,
    positionComparisons,
    verdict: passes ? "eligible_for_tiny_flagged_live_weight_experiment" : "keep_diagnostic_only",
  };
}

function bestModelForRows(rows: ProjectionBacktestDataset["rows"], fallback: ProjectionBacktestBaselineModel | null) {
  if (!rows.length) return null;
  return fallback;
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function mean(values: number[]) {
  if (!values.length) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function playerKey(row: ProjectionBacktestDataset["rows"][number]) {
  return row.identity.sleeperId ?? row.identity.gsisId;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
