import type { BlackbirdNflversePosition } from "@/lib/data-acquisition/nflverse";
import type { PlayerProfileAvailabilityMetrics, PlayerProfileConsistencyMetrics, PlayerProfileRecommendationSignals } from "./player-profile-types";

export function buildConsistencyMetrics(points: number[], position: BlackbirdNflversePosition | null): PlayerProfileConsistencyMetrics {
  const sorted = [...points].sort((a, b) => a - b);
  const meanValue = mean(points);
  const sd = standardDeviation(points);
  const boomThreshold = boomWeekThreshold(position);
  const bustThreshold = bustWeekThreshold(position);
  const startableThreshold = startableWeekThreshold(position);
  const floor = percentile(sorted, 20);
  const ceiling80 = percentile(sorted, 80);
  const ceiling90 = percentile(sorted, 90);
  const consistencyScore = points.length && meanValue !== null && sd !== null
    ? clamp(100 - (sd / Math.max(Math.abs(meanValue), 1)) * 35)
    : 0;
  const spikeWeekScore = points.length && ceiling90 !== null && meanValue !== null
    ? clamp((ceiling90 / Math.max(Math.abs(meanValue), 1)) * 45)
    : 0;

  return {
    mean: roundOrNull(meanValue),
    median: roundOrNull(percentile(sorted, 50)),
    standardDeviation: roundOrNull(sd),
    floorPercentile20: roundOrNull(floor),
    ceilingPercentile80: roundOrNull(ceiling80),
    ceilingPercentile90: roundOrNull(ceiling90),
    boomWeeks: points.filter((value) => value >= boomThreshold).length,
    bustWeeks: points.filter((value) => value <= bustThreshold).length,
    startableWeeks: points.filter((value) => value >= startableThreshold).length,
    consistencyScore: round(consistencyScore),
    spikeWeekScore: round(spikeWeekScore),
  };
}

export function buildAvailabilityMetrics(weeksWithStats: number, expectedWeeks = 17): PlayerProfileAvailabilityMetrics {
  const missedWeekEstimate = Math.max(0, expectedWeeks - weeksWithStats);
  return {
    weeksWithStatRows: weeksWithStats,
    missedWeekEstimate,
    gamesPlayed: weeksWithStats,
    availabilityScore: round(clamp((weeksWithStats / expectedWeeks) * 100)),
  };
}

export function buildRecommendationSignals(input: {
  position: BlackbirdNflversePosition;
  consistency: PlayerProfileConsistencyMetrics;
  availability: PlayerProfileAvailabilityMetrics;
}): PlayerProfileRecommendationSignals {
  const floorScore = scoreFromValue(input.consistency.floorPercentile20, 5, 20);
  const ceilingScore = scoreFromValue(input.consistency.ceilingPercentile90, 10, 30);
  const volatilityLabel = input.consistency.standardDeviation === null
    ? "unknown"
    : input.consistency.standardDeviation >= 10 ? "high" : input.consistency.standardDeviation >= 5 ? "medium" : "low";
  const idp = ["DL", "LB", "DB"].includes(input.position)
    ? "IDP profile uses explicit tackle/sack/interception weekly stat columns when present."
    : null;

  return {
    floorScore,
    ceilingScore,
    consistencyScore: input.consistency.consistencyScore,
    spikeScore: input.consistency.spikeWeekScore,
    availabilityScore: input.availability.availabilityScore,
    volatilityLabel,
    formatFitHints: {
      redraft: input.availability.availabilityScore >= 75 ? "usable historical availability sample" : "availability/sample-size caveat",
      dynasty: "bio and age fields are preserved for future dynasty calibration",
      bestBall: input.consistency.spikeWeekScore >= 65 ? "spike-week profile worth monitoring" : "limited spike-week edge from current sample",
      idp,
    },
  };
}

export function summarizeKeyStats(rows: Array<{ canonicalStats: Record<string, number> }>): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    for (const [key, value] of Object.entries(row.canonicalStats)) {
      totals[key] = round((totals[key] ?? 0) + value);
    }
  }
  return totals;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number | null {
  const avg = mean(values);
  if (avg === null) return null;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length);
}

function percentile(sortedValues: number[], pct: number): number | null {
  if (!sortedValues.length) return null;
  if (sortedValues.length === 1) return sortedValues[0];
  const index = (pct / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower);
}

function boomWeekThreshold(position: BlackbirdNflversePosition | null) {
  if (position === "QB") return 25;
  if (position === "K") return 12;
  if (position === "DL" || position === "LB" || position === "DB") return 18;
  return 20;
}

function bustWeekThreshold(position: BlackbirdNflversePosition | null) {
  if (position === "QB") return 12;
  if (position === "K") return 5;
  if (position === "DL" || position === "LB" || position === "DB") return 6;
  return 7;
}

function startableWeekThreshold(position: BlackbirdNflversePosition | null) {
  if (position === "QB") return 18;
  if (position === "K") return 8;
  if (position === "DL" || position === "LB" || position === "DB") return 10;
  return 12;
}

function scoreFromValue(value: number | null, low: number, high: number) {
  if (value === null) return 0;
  return round(clamp(((value - low) / (high - low)) * 100));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function roundOrNull(value: number | null) {
  return value === null ? null : round(value);
}
