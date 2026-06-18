import type {
  ProjectionBacktestBaselineModel,
  ProjectionBacktestDataset,
  ProjectionBacktestInputFeatures,
  ProjectionBacktestOptions,
  ProjectionBacktestPlayerRow,
  ProjectionBacktestPrediction,
} from "./projection-backtest-types";
import { buildProjectionBacktestDataset } from "./projection-backtest-dataset";
import { computeProjectionBacktestMetrics } from "./projection-backtest-metrics";
import type {
  ProjectionBacktestReport,
  ProjectionBacktestSource,
} from "./projection-backtest-types";
import { summarizeBacktestDiagnostics } from "./projection-backtest-diagnostics";
import {
  calculateWeightedBaselineExpectedGamesFromBacktestFeatures,
  calculateWeightedRecentGamesRaw,
} from "./weighted-baseline-expected-games";

const BASELINE_MODELS: ProjectionBacktestBaselineModel[] = [
  "prior_season_ppg",
  "weighted_recent_ppg",
  "career_recent_blend",
  "profile_informed_simple",
];

export function runProjectionBacktest(input: {
  source: ProjectionBacktestSource;
  options: ProjectionBacktestOptions;
}): ProjectionBacktestReport {
  const dataset = buildProjectionBacktestDataset({
    profiles: input.source.profiles,
    options: input.options,
    existingProjectionSource: input.source.existingProjectionSource,
  });
  const models = modelsForDataset(dataset);
  const rows = dataset.rows.map((row) => withPredictions(row, models));
  const predictedDataset: ProjectionBacktestDataset = { ...dataset, rows };
  const metrics = computeProjectionBacktestMetrics(predictedDataset, models);

  return summarizeBacktestDiagnostics({
    dataset: predictedDataset,
    metrics,
    options: input.options,
    scoringMetadata: input.source.scoringMetadata,
    existingProjectionSource: input.source.existingProjectionSource ?? null,
  });
}

export function withPredictions(row: ProjectionBacktestPlayerRow, models: ProjectionBacktestBaselineModel[] = BASELINE_MODELS): ProjectionBacktestPlayerRow {
  const predictions = { ...row.predictions };
  for (const model of models) {
    if (isExistingProjectionModel(model) && predictions[model]) continue;
    predictions[model] = predict(row, model);
  }
  const bestBaseline = bestPrediction(predictions);
  return {
    ...row,
    predictions,
    bestBaseline,
    classification: classifyRow(row, predictions.profile_informed_simple ?? predictions.weighted_recent_ppg ?? predictions.prior_season_ppg),
  };
}

export function predict(row: ProjectionBacktestPlayerRow, model: ProjectionBacktestBaselineModel): ProjectionBacktestPrediction {
  if (isExistingProjectionModel(model)) {
    return row.predictions[model] ?? emptyPrediction(model);
  }
  const features = row.inputFeatures;
  const predictedPpg = model === "prior_season_ppg"
    ? features.priorSeasonPpg
    : model === "weighted_recent_ppg"
      ? weightedRecentPpg(features)
      : model === "career_recent_blend"
        ? careerRecentBlend(features)
        : model === "profile_informed_simple"
          ? profileInformedPpg(features)
          : null;
  const predictedGames = predictedGamesFromPrior(features);
  const predictedTotalPoints = predictedPpg !== null && predictedGames !== null ? round(predictedPpg * predictedGames) : null;
  const gamesError = predictedGames !== null ? round(predictedGames - row.actuals.games) : null;
  const errorTotalPoints = predictedTotalPoints !== null ? round(predictedTotalPoints - row.actuals.totalPoints) : null;
  return {
    model,
    predictedPpg,
    predictedGames,
    predictedTotalPoints,
    errorPpg: predictedPpg !== null && row.actuals.pointsPerGame !== null ? round(predictedPpg - row.actuals.pointsPerGame) : null,
    errorTotalPoints,
    gamesError,
    availabilityMissType: availabilityMissType(predictedGames, row.actuals.games),
    ppgErrorComponent: predictedPpg !== null && row.actuals.pointsPerGame !== null && predictedGames !== null
      ? round((predictedPpg - row.actuals.pointsPerGame) * predictedGames)
      : null,
    gamesErrorComponent: predictedGames !== null && row.actuals.pointsPerGame !== null
      ? round((predictedGames - row.actuals.games) * row.actuals.pointsPerGame)
      : null,
    combinedError: errorTotalPoints,
    projectionSource: null,
    matchConfidence: null,
    reasons: predictionReasons(model),
  };
}

export function weightedRecentPpg(features: ProjectionBacktestInputFeatures): number | null {
  const values = features.recentSeasonPpgs.slice(0, 3).map((season) => season.ppg);
  if (!values.length) return null;
  const weighted = weightedAverage(values, [0.5, 0.3, 0.2]);
  return weighted === null ? null : round(weighted);
}

export function careerRecentBlend(features: ProjectionBacktestInputFeatures): number | null {
  const recent = weightedRecentPpg(features);
  if (recent === null && features.careerToDatePpg === null) return null;
  if (recent === null) return features.careerToDatePpg;
  if (features.careerToDatePpg === null) return recent;
  return round(recent * 0.65 + features.careerToDatePpg * 0.35);
}

export function profileInformedPpg(features: ProjectionBacktestInputFeatures): number | null {
  const base = careerRecentBlend(features);
  if (base === null) return null;
  let adjustment = 0;
  adjustment += clamp(((features.priorSeasonConsistency ?? 50) - 50) * 0.001, -0.04, 0.04);
  adjustment += clamp(((features.priorSeasonAvailability ?? 75) - 75) * 0.001, -0.05, 0.04);
  adjustment += clamp(((features.priorSeasonSpike ?? 50) - 50) * 0.0005, -0.025, 0.035);

  const snapShare = features.priorSeasonOffensiveSnapShare ?? features.priorSeasonDefensiveSnapShare;
  if (snapShare !== null && snapShare >= 0.7) adjustment += 0.03;
  if (snapShare !== null && snapShare < 0.4) adjustment -= 0.03;
  if (features.priorSeasonHighValueUsageFlags.some((flag) => ["goal_line_role", "red_zone_role", "end_zone_target_role", "high_value_touch_role"].includes(flag))) {
    adjustment += 0.025;
  }
  if (features.warnings.includes("low_snap_share") || features.warnings.includes("fragile_role")) adjustment -= 0.025;

  const capped = clamp(adjustment, -0.12, 0.12);
  return round(base * (1 + capped));
}

function predictedGamesFromPrior(features: ProjectionBacktestInputFeatures): number | null {
  return calculateWeightedBaselineExpectedGamesFromBacktestFeatures(features);
}

export function weightedRecentGames(features: ProjectionBacktestInputFeatures): number | null {
  const values = features.recentSeasonPpgs.map((season) => season.games);
  const weighted = calculateWeightedRecentGamesRaw(values);
  return weighted === null ? null : round(weighted);
}

function bestPrediction(predictions: ProjectionBacktestPlayerRow["predictions"]): ProjectionBacktestBaselineModel | null {
  return (Object.keys(predictions) as ProjectionBacktestBaselineModel[])
    .filter((model) => Boolean(predictions[model]))
    .map((model) => predictions[model])
    .filter((prediction): prediction is ProjectionBacktestPrediction => Boolean(prediction?.errorPpg !== null))
    .sort((a, b) => Math.abs(a.errorPpg ?? Infinity) - Math.abs(b.errorPpg ?? Infinity) || a.model.localeCompare(b.model))[0]?.model ?? null;
}

function classifyRow(row: ProjectionBacktestPlayerRow, prediction: ProjectionBacktestPrediction | null) {
  if (row.inputFeatures.priorSeasonPpg === null && row.inputFeatures.careerToDatePpg === null) return "insufficient_prior_data";
  if (row.actuals.games < 4) return "low_sample_actual";
  if (!["exact_id", "strong"].includes(row.identity.matchConfidence) || row.inputFeatures.warnings.includes("weak_identity_match")) return "identity_warning";
  if ((row.inputFeatures.priorSeasonGames ?? 17) >= 12 && row.actuals.games <= 8) return "injury_or_availability_candidate";
  const error = prediction?.errorPpg;
  if (error === null || error === undefined) return "insufficient_prior_data";
  if (error >= 6) return "major_miss_high";
  if (error <= -6) return "major_miss_low";
  if (error >= 2) return "overprojected";
  if (error <= -2) return "underprojected";
  if (Math.abs(error) >= 4 && row.inputFeatures.usageTrendThroughPreviousSeason !== "stable") return "role_change_candidate";
  return "accurate";
}

function predictionReasons(model: ProjectionBacktestBaselineModel) {
  if (model === "prior_season_ppg") return ["Predicted PPG equals the most recent season before the target season."];
  if (model === "weighted_recent_ppg") return ["Predicted PPG blends prior-season PPG with career-to-date PPG when available."];
  if (model === "career_recent_blend") return ["Predicted PPG blends weighted recent form with career-to-date production."];
  if (model === "profile_informed_simple") {
    return [
      "Predicted PPG starts from career/recent blend.",
      "Conservative modifiers use only prior-season consistency, availability, snap share, and high-value usage.",
      "Total profile-informed adjustment is capped at +/-12%.",
    ];
  }
  return [];
}

function modelsForDataset(dataset: ProjectionBacktestDataset): ProjectionBacktestBaselineModel[] {
  const candidateModels: ProjectionBacktestBaselineModel[] = [
    "blackbird_existing_projection",
    "blackbird_availability_calibrated",
    "blackbird_no_prior_calibrated",
    "blackbird_calibrated_v2",
    "blackbird_cohort_games_calibrated",
    "blackbird_cohort_ppg_calibrated",
    "blackbird_cohort_calibrated_v3",
    "blackbird_expected_games_v4",
    "blackbird_expected_games_v5_selective",
    "blackbird_expected_games_v6_gated",
    "blackbird_expected_games_v7_family_selective",
    "blackbird_expected_games_v8_cohort_blend",
    "blackbird_expected_games_v8_1_calibrated_gate",
    "blackbird_expected_games_v8_2_high_impact_guardrail",
  ];
  const extra = candidateModels.filter((model) => dataset.rows.some((row) => row.predictions[model]));
  return [...BASELINE_MODELS, ...extra];
}

function isExistingProjectionModel(model: ProjectionBacktestBaselineModel) {
  return model.startsWith("blackbird_");
}

function availabilityMissType(predictedGames: number | null, actualGames: number) {
  if (predictedGames === null) return "no_games_projection";
  if (actualGames < 4) return "low_actual_games";
  const error = predictedGames - actualGames;
  if (Math.abs(error) <= 2) return "accurate_games";
  if (Math.abs(error) >= 6) return "major_availability_miss";
  return error > 0 ? "overestimated_availability" : "underestimated_availability";
}

function emptyPrediction(model: ProjectionBacktestBaselineModel): ProjectionBacktestPrediction {
  return {
    model,
    predictedPpg: null,
    predictedGames: null,
    predictedTotalPoints: null,
    errorPpg: null,
    errorTotalPoints: null,
    gamesError: null,
    availabilityMissType: "no_games_projection",
    ppgErrorComponent: null,
    gamesErrorComponent: null,
    combinedError: null,
    projectionSource: null,
    matchConfidence: null,
    reasons: ["Existing Blackbird projection was unavailable for this player."],
  };
}

function weightedAverage(values: Array<number | null>, weights: number[]) {
  let weightTotal = 0;
  let valueTotal = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const weight = weights[index] ?? 0;
    if (typeof value !== "number" || !Number.isFinite(value) || weight <= 0) continue;
    valueTotal += value * weight;
    weightTotal += weight;
  }
  return weightTotal ? valueTotal / weightTotal : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
