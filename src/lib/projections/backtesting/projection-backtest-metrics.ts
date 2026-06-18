import type {
  ProjectionBacktestBaselineModel,
  ProjectionBacktestDataset,
  ProjectionBacktestMetricSet,
  ProjectionBacktestMetrics,
  ProjectionBacktestPlayerRow,
} from "./projection-backtest-types";

export function computeProjectionBacktestMetrics(
  dataset: ProjectionBacktestDataset,
  models: ProjectionBacktestBaselineModel[]
): ProjectionBacktestMetrics {
  const overall = Object.fromEntries(models.map((model) => [model, metricSet(dataset.rows, model)])) as ProjectionBacktestMetrics["overall"];
  const positions = Array.from(new Set(dataset.rows.map((row) => row.identity.position))).sort();
  const byPosition: ProjectionBacktestMetrics["byPosition"] = {};
  for (const position of positions) {
    const positionRows = dataset.rows.filter((row) => row.identity.position === position);
    byPosition[position] = Object.fromEntries(models.map((model) => [model, metricSet(positionRows, model)])) as Record<ProjectionBacktestBaselineModel, ProjectionBacktestMetricSet>;
  }
  const cohorts = Array.from(new Set(dataset.rows.flatMap((row) => row.cohortLabels))).sort();
  const byCohort: ProjectionBacktestMetrics["byCohort"] = {};
  for (const cohort of cohorts) {
    const cohortRows = dataset.rows.filter((row) => row.cohortLabels.includes(cohort));
    byCohort[cohort] = Object.fromEntries(models.map((model) => [model, cohortMetricSet(cohortRows, model)])) as ProjectionBacktestMetrics["byCohort"][string];
  }
  const rankedModels = models
    .map((model) => ({ model, mae: overall[model]?.maePpg ?? Infinity }))
    .filter((row) => Number.isFinite(row.mae))
    .sort((a, b) => a.mae - b.mae || a.model.localeCompare(b.model));
  return {
    overall,
    byPosition,
    byCohort,
    bestBaselineModel: rankedModels[0]?.model ?? null,
    worstBaselineModel: rankedModels.at(-1)?.model ?? null,
  };
}

function cohortMetricSet(rows: ProjectionBacktestPlayerRow[], model: ProjectionBacktestBaselineModel) {
  const metrics = metricSet(rows, model);
  const predictions = rows.map((row) => row.predictions[model]).filter(Boolean);
  return {
    ...metrics,
    playersEvaluated: rows.length,
    averageProjectedGames: mean(predictions.map((prediction) => prediction?.predictedGames).filter(isNumber)),
    averageActualGames: mean(rows.map((row) => row.actuals.games)),
    overprojectionCount: predictions.filter((prediction) => (prediction?.errorTotalPoints ?? 0) > 0).length,
    underprojectionCount: predictions.filter((prediction) => (prediction?.errorTotalPoints ?? 0) < 0).length,
    majorMissCount: predictions.filter((prediction) => Math.abs(prediction?.errorTotalPoints ?? 0) >= 50).length,
  };
}

export function metricSet(rows: ProjectionBacktestPlayerRow[], model: ProjectionBacktestBaselineModel): ProjectionBacktestMetricSet {
  const valid = rows
    .map((row) => ({ row, prediction: row.predictions[model] }))
    .filter((entry) => entry.prediction?.predictedPpg !== null && entry.prediction?.predictedTotalPoints !== null && entry.row.actuals.pointsPerGame !== null);
  const totalErrors = valid.map((entry) => entry.prediction!.errorTotalPoints).filter(isNumber);
  const ppgErrors = valid.map((entry) => entry.prediction!.errorPpg).filter(isNumber);
  const gamesErrors = rows
    .map((row) => row.predictions[model]?.gamesError)
    .filter(isNumber);
  const availabilityMissCounts = rows.reduce<ProjectionBacktestMetricSet["availabilityMissCounts"]>((acc, row) => {
    const type = row.predictions[model]?.availabilityMissType ?? "no_games_projection";
    acc[type] = (acc[type] ?? 0) + 1;
    return acc;
  }, {
    accurate_games: 0,
    overestimated_availability: 0,
    underestimated_availability: 0,
    major_availability_miss: 0,
    low_actual_games: 0,
    no_games_projection: 0,
  });
  return {
    count: valid.length,
    maeTotal: mean(totalErrors.map(Math.abs)),
    maePpg: mean(ppgErrors.map(Math.abs)),
    rmseTotal: rmse(totalErrors),
    rmsePpg: rmse(ppgErrors),
    biasTotal: mean(totalErrors),
    biasPpg: mean(ppgErrors),
    medianAbsErrorTotal: median(totalErrors.map(Math.abs)),
    medianAbsErrorPpg: median(ppgErrors.map(Math.abs)),
    correlationTotal: correlation(
      valid.map((entry) => entry.prediction!.predictedTotalPoints).filter(isNumber),
      valid.map((entry) => entry.row.actuals.totalPoints)
    ),
    correlationPpg: correlation(
      valid.map((entry) => entry.prediction!.predictedPpg).filter(isNumber),
      valid.map((entry) => entry.row.actuals.pointsPerGame).filter(isNumber)
    ),
    rankCorrelationTotal: rankCorrelation(valid, model),
    gamesMae: mean(gamesErrors.map(Math.abs)),
    availabilityMissCounts,
    hitRates: hitRates(valid.map((entry) => entry.row), model),
  };
}

function hitRates(rows: ProjectionBacktestPlayerRow[], model: ProjectionBacktestBaselineModel): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  for (const topN of [12, 24, 36]) {
    const predicted = rows
      .filter((row) => row.predictions[model]?.predictedTotalPoints !== null)
      .sort((a, b) => (b.predictions[model]?.predictedTotalPoints ?? -Infinity) - (a.predictions[model]?.predictedTotalPoints ?? -Infinity))
      .slice(0, topN);
    const actual = rows
      .sort((a, b) => b.actuals.totalPoints - a.actuals.totalPoints)
      .slice(0, topN);
    if (predicted.length < topN || actual.length < topN) {
      result[`top${topN}`] = null;
      continue;
    }
    const actualKeys = new Set(actual.map(playerKey));
    result[`top${topN}`] = round(predicted.filter((row) => actualKeys.has(playerKey(row))).length / topN);
  }
  return result;
}

function rankCorrelation(valid: Array<{ row: ProjectionBacktestPlayerRow; prediction: ProjectionBacktestPlayerRow["predictions"][ProjectionBacktestBaselineModel] }>, model: ProjectionBacktestBaselineModel) {
  const predicted = [...valid]
    .sort((a, b) => (b.row.predictions[model]?.predictedTotalPoints ?? -Infinity) - (a.row.predictions[model]?.predictedTotalPoints ?? -Infinity))
    .map((entry, index) => [playerKey(entry.row), index + 1] as const);
  const actual = [...valid]
    .sort((a, b) => b.row.actuals.totalPoints - a.row.actuals.totalPoints)
    .map((entry, index) => [playerKey(entry.row), index + 1] as const);
  const actualRanks = new Map(actual);
  const predictedRanks = predicted.map(([, rank]) => rank);
  const actualRankValues = predicted.map(([key]) => actualRanks.get(key)).filter(isNumber);
  return correlation(predictedRanks, actualRankValues);
}

function correlation(a: number[], b: number[]) {
  if (a.length !== b.length || a.length < 2) return null;
  const meanA = mean(a);
  const meanB = mean(b);
  if (meanA === null || meanB === null) return null;
  const numerator = a.reduce((sum, value, index) => sum + (value - meanA) * (b[index] - meanB), 0);
  const denominatorA = Math.sqrt(a.reduce((sum, value) => sum + (value - meanA) ** 2, 0));
  const denominatorB = Math.sqrt(b.reduce((sum, value) => sum + (value - meanB) ** 2, 0));
  if (!denominatorA || !denominatorB) return null;
  return round(numerator / (denominatorA * denominatorB));
}

function rmse(values: number[]) {
  if (!values.length) return null;
  return round(Math.sqrt(values.reduce((sum, value) => sum + value ** 2, 0) / values.length));
}

function mean(values: number[]) {
  if (!values.length) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : round((sorted[mid - 1] + sorted[mid]) / 2);
}

function playerKey(row: ProjectionBacktestPlayerRow) {
  return row.identity.sleeperId ?? row.identity.gsisId;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
