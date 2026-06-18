import type { BlackbirdCalibrationCohort, CohortCalibrationInput, CohortCalibrationResult } from "./cohort-calibration-types";

export function calibrateCohortProjection(input: CohortCalibrationInput): CohortCalibrationResult {
  const cohort = assignCalibrationCohort(input);
  const games = cohortExpectedGames(cohort, input);
  const ppgAdjustment = cohortPpgAdjustment(cohort, input);
  const ppg = round1(cohortNoPriorPpg(cohort, input) * (1 + ppgAdjustment));
  return {
    cohort,
    cohortReason: cohortReason(cohort, input),
    expectedGames: games,
    expectedGamesRule: expectedGamesRule(cohort),
    ppg,
    ppgAdjustment,
    ppgAdjustmentRule: ppgAdjustmentRule(cohort, ppgAdjustment),
    confidenceRule: confidenceRule(cohort, input),
    noPriorRule: input.noPrior ? noPriorRule(cohort, input.noPriorType) : null,
  };
}

export function assignCalibrationCohort(input: CohortCalibrationInput): BlackbirdCalibrationCohort {
  const position = input.profile.bio.normalizedPosition;
  const priorGames = input.priorSummaries.reduce((sum, summary) => sum + summary.gamesPlayed, 0);
  const snap = input.priorUsage?.offensiveSnapShare ?? input.priorUsage?.defensiveSnapShare ?? null;
  const lowSample = input.priorSummaries.length <= 1 || priorGames < 8;
  if (input.noPriorType === "unsupported_no_signal") return "no_prior_no_signal";
  if (input.noPriorType === "rookie_with_rookie_source_data") return "rookie_with_source_data";
  if (input.noPrior && input.noPriorType !== "has_prior_nfl_data") return "no_prior_with_role_signal";
  if (lowSample) return position === "QB" ? "qb_low_sample_or_backup" : position === "RB" ? "rb_low_sample" : position === "WR" ? "wr_low_sample" : position === "TE" ? "te_low_sample" : "low_prior_sample";
  if (position === "QB") return snap !== null && snap >= 0.65 && (input.priorSummaries[0]?.gamesPlayed ?? 0) >= 10 ? "qb_projected_starter" : "qb_low_sample_or_backup";
  if (position === "RB") return "rb_veteran";
  if (position === "WR") return "wr_veteran";
  if (position === "TE") return "te_veteran";
  if (position === "K") return "kicker";
  if (position === "DL") return "idp_dl";
  if (position === "LB") return "idp_lb";
  if (position === "DB") return "idp_db";
  return "low_prior_sample";
}

function cohortExpectedGames(cohort: BlackbirdCalibrationCohort, input: CohortCalibrationInput) {
  if (!input.noPrior && !["qb_low_sample_or_backup", "rb_low_sample", "wr_low_sample", "te_low_sample", "low_prior_sample"].includes(cohort)) {
    return input.v1Games;
  }
  const recent = weightedAverage(input.priorSummaries.slice(0, 3).map((summary) => summary.gamesPlayed), [0.55, 0.3, 0.15]);
  const career = input.priorSummaries.length ? input.priorSummaries.reduce((sum, summary) => sum + summary.gamesPlayed, 0) / input.priorSummaries.length : null;
  const base = recent !== null && career !== null ? recent * 0.72 + career * 0.28 : recent ?? career ?? input.v1Games;
  const snap = input.priorUsage?.offensiveSnapShare ?? input.priorUsage?.defensiveSnapShare ?? null;
  let games = base;
  if (cohort === "qb_projected_starter") games = input.v1Games;
  else if (cohort === "qb_low_sample_or_backup") games = Math.min(input.v1Games, 9);
  else if (cohort === "rb_veteran") games = snap !== null && snap >= 0.62 ? games - 0.2 : games - 0.7;
  else if (cohort === "rb_low_sample") games = Math.min(input.v1Games, 9);
  else if (cohort === "wr_veteran" || cohort === "te_veteran") games = snap !== null && snap >= 0.6 ? games + 0.2 : games - 0.3;
  else if (cohort === "wr_low_sample" || cohort === "te_low_sample") games = Math.min(input.v1Games, 10);
  else if (cohort === "kicker") games = input.v1Games;
  else if (cohort === "idp_lb") games = snap !== null && snap >= 0.65 ? games + 0.4 : games;
  else if (cohort === "idp_dl") games = snap !== null && snap < 0.45 ? games - 0.5 : games;
  else if (cohort === "idp_db") games = snap !== null && snap >= 0.7 ? games + 0.1 : games - 0.5;
  else if (cohort === "rookie_with_source_data") games = input.profile.bio.normalizedPosition === "QB" ? 8 : input.profile.bio.normalizedPosition === "K" ? 11 : 7;
  else if (cohort === "no_prior_with_role_signal") games = input.profile.bio.normalizedPosition === "K" ? 10 : 6;
  else if (cohort === "no_prior_no_signal") games = 2;
  else if (cohort === "low_prior_sample") games = Math.min(input.v1Games, 9);
  return clampRound(games, 1, 17);
}

function cohortPpgAdjustment(cohort: BlackbirdCalibrationCohort, input: CohortCalibrationInput) {
  if (["no_prior_no_signal", "rookie_with_source_data", "no_prior_with_role_signal"].includes(cohort)) return 0;
  const snap = input.priorUsage?.offensiveSnapShare ?? input.priorUsage?.defensiveSnapShare ?? null;
  let adjustment = 0;
  if (snap !== null && snap >= 0.7) adjustment += 0.015;
  if (snap !== null && snap < 0.4) adjustment -= 0.02;
  if ((input.priorSummaries[0]?.consistencyScore ?? 50) >= 75) adjustment += 0.01;
  if ((input.priorSummaries[0]?.availabilityScore ?? 75) < 55) adjustment -= 0.01;
  if (cohort === "idp_lb" && (input.priorUsage?.tackleFloorScore ?? 0) >= 70 && snap !== null && snap >= 0.65) adjustment += 0.02;
  if (cohort === "idp_dl" && (input.priorUsage?.sackDependencyScore ?? 0) >= 70) adjustment -= 0.015;
  if (cohort === "idp_db") adjustment -= 0.01;
  if (cohort === "kicker") adjustment = 0;
  const cap = cohort === "idp_lb" ? 0.05 : cohort === "idp_dl" || cohort === "idp_db" ? 0.03 : 0.04;
  return round3(clamp(adjustment, -cap, cap));
}

function cohortNoPriorPpg(cohort: BlackbirdCalibrationCohort, input: CohortCalibrationInput) {
  if (!input.noPrior) return input.basePpg;
  const position = input.profile.bio.normalizedPosition;
  const prior: Record<string, number> = { QB: 5.5, RB: 2.4, WR: 2.4, TE: 2, K: 5.5, DL: 1.8, LB: 2.5, DB: 2 };
  if (cohort === "no_prior_no_signal") {
    const noSignal: Record<string, number> = { QB: 1.2, RB: 0.5, WR: 0.5, TE: 0.4, K: 0.8, DL: 0.4, LB: 0.5, DB: 0.5 };
    return noSignal[position] ?? 0.5;
  }
  if (cohort === "no_prior_with_role_signal") return (prior[position] ?? 1.5) * 0.65;
  if (cohort === "rookie_with_source_data") return (prior[position] ?? 1.5) * 0.85;
  return prior[position] ?? input.basePpg;
}

function cohortReason(cohort: BlackbirdCalibrationCohort, input: CohortCalibrationInput) {
  return `${cohort} assigned from position ${input.profile.bio.normalizedPosition}, prior seasons ${input.priorSummaries.length}, no-prior type ${input.noPriorType}.`;
}

function expectedGamesRule(cohort: BlackbirdCalibrationCohort) {
  return `Expected games use cohort rule ${cohort}, anchored to weighted recent games when prior data exists.`;
}

function ppgAdjustmentRule(cohort: BlackbirdCalibrationCohort, adjustment: number) {
  return `PPG anchored to weighted recent production with ${round3(adjustment * 100)}% capped cohort adjustment for ${cohort}.`;
}

function confidenceRule(cohort: BlackbirdCalibrationCohort, input: CohortCalibrationInput) {
  if (input.noPrior) return `Low confidence because ${cohort} has no prior NFL stat sample.`;
  if (input.priorSummaries.length >= 3) return `Higher confidence from ${input.priorSummaries.length} pre-target seasons.`;
  return `Moderate/low confidence from limited ${input.priorSummaries.length}-season sample.`;
}

function noPriorRule(cohort: BlackbirdCalibrationCohort, noPriorType: string) {
  return `No-prior handling uses ${cohort} prior for ${noPriorType}; no target-season outcomes are used.`;
}

function weightedAverage(values: Array<number | null>, weights: number[]) {
  let total = 0;
  let weightTotal = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const weight = weights[index] ?? 0;
    if (typeof value !== "number" || !Number.isFinite(value) || weight <= 0) continue;
    total += value * weight;
    weightTotal += weight;
  }
  return weightTotal ? total / weightTotal : null;
}

function clampRound(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}
