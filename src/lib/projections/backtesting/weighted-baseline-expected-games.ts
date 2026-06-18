import type { HistoricalPlayerProfileSnapshot } from "@/lib/player-profiles";

import type { ProjectionBacktestInputFeatures } from "./projection-backtest-types";

const WEIGHTS = [0.5, 0.3, 0.2];

export type WeightedBaselineExpectedGamesInput = {
  recentGames: Array<number | null>;
  careerGames: number | null;
  seasonCount: number;
  fallbackGames?: number | null;
};

export function calculateWeightedBaselineExpectedGames(input: WeightedBaselineExpectedGamesInput): number | null {
  const recentGames = weightedAverage(input.recentGames.slice(0, 3), WEIGHTS);
  if (recentGames !== null) return clampRound(recentGames, 1, 17);
  if (input.careerGames !== null && input.careerGames > 0 && input.seasonCount > 0) {
    return clampRound(input.careerGames / input.seasonCount, 1, 17);
  }
  if (input.fallbackGames !== undefined && input.fallbackGames !== null) {
    return clampRound(input.fallbackGames, 1, 17);
  }
  return null;
}

export function calculateWeightedBaselineExpectedGamesFromBacktestFeatures(features: ProjectionBacktestInputFeatures): number | null {
  return calculateWeightedBaselineExpectedGames({
    recentGames: features.recentSeasonPpgs.map((season) => season.games),
    careerGames: features.careerToDateGames,
    seasonCount: features.inputSeasonsUsed.length,
  });
}

export function calculateWeightedBaselineExpectedGamesFromSeasonSummaries(input: {
  summaries: HistoricalPlayerProfileSnapshot["seasonSummaries"];
  fallbackGames?: number | null;
}): number | null {
  const summaries = input.summaries.slice(0, 3);
  const careerGames = input.summaries.reduce((sum, summary) => sum + summary.gamesPlayed, 0);
  return calculateWeightedBaselineExpectedGames({
    recentGames: summaries.map((summary) => summary.gamesPlayed),
    careerGames,
    seasonCount: input.summaries.length,
    fallbackGames: input.fallbackGames,
  });
}

export function calculateWeightedRecentGamesRaw(values: Array<number | null>): number | null {
  return weightedAverage(values.slice(0, 3), WEIGHTS);
}

function weightedAverage(values: Array<number | null>, weights: number[]): number | null {
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

function clampRound(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
