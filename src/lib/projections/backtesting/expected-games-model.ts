import type { ExpectedGamesModelInput, ExpectedGamesModelResult } from "./expected-games-model-types";
import { calculateLowPriorExpectedGamesBaseline } from "./low-prior-expected-games-baseline";
import {
  calculateWeightedBaselineExpectedGamesFromSeasonSummaries,
} from "./weighted-baseline-expected-games";

const RECENT_WEIGHTS = [0.55, 0.3, 0.15];

export function projectExpectedGamesV4(input: ExpectedGamesModelInput): ExpectedGamesModelResult {
  const position = input.profile.bio.normalizedPosition;
  const weightedRecent = weightedAverage(input.priorSummaries.slice(0, 3).map((summary) => summary.gamesPlayed), RECENT_WEIGHTS);
  const weightedBaselineExpectedGames = calculateWeightedBaselineExpectedGamesFromSeasonSummaries({
    summaries: input.priorSummaries,
    fallbackGames: input.previousProjectedGames,
  });
  const careerRecent = input.priorSummaries.length
    ? input.priorSummaries.reduce((sum, summary) => sum + summary.gamesPlayed, 0) / input.priorSummaries.length
    : null;
  const priorSeasonGames = input.priorSummaries[0]?.gamesPlayed ?? null;
  const snapShare = input.priorUsage?.offensiveSnapShare ?? input.priorUsage?.defensiveSnapShare ?? null;
  const role = roleLabel(position, input.priorUsage);
  const warnings: string[] = [];
  const base = weightedRecent !== null && careerRecent !== null
    ? weightedRecent * 0.72 + careerRecent * 0.28
    : weightedRecent ?? careerRecent ?? input.previousProjectedGames;

  let games = base;
  let rule = "standard_position_expected_games";
  let confidence: ExpectedGamesModelResult["expectedGamesConfidence"] = input.priorSummaries.length >= 3 ? "medium" : "low";

  if (input.noPrior) {
    const noPrior = noPriorGames(position, input.noPriorType);
    games = noPrior.games;
    rule = noPrior.rule;
    confidence = noPrior.confidence;
    warnings.push("no_prior_nfl_data");
    if (input.noPriorType === "unsupported_no_signal") warnings.push("no_prior_no_signal_conservative_games");
  } else if (position === "QB") {
    const starter = (priorSeasonGames ?? 0) >= 12 || (snapShare ?? 0) >= 0.65;
    if (starter) {
      games = Math.max(base, Math.min(16, (priorSeasonGames ?? base) * 0.75 + 4));
      rule = "qb_projected_or_prior_starter_expected_games";
      confidence = "high";
    } else {
      games = Math.min(base, 7);
      rule = "qb_backup_or_low_sample_expected_games";
      confidence = "low";
      warnings.push("qb_low_sample_or_backup_conservative_games");
    }
  } else if (position === "RB") {
    games = base - 0.6;
    rule = "rb_weighted_recent_with_volatility_dampening";
    if (["workhorse", "receiving_back"].includes(role) || (snapShare ?? 0) >= 0.62) {
      games = Math.max(games, base - 0.1);
      rule = "rb_lead_role_protected_expected_games";
      confidence = "medium";
    }
    if (input.priorSummaries.length <= 1 || (input.priorSummaries[0]?.gamesPlayed ?? 0) < 8) {
      games = Math.min(games, 9);
      warnings.push("rb_low_sample_capped_games");
    }
  } else if (position === "WR" || position === "TE") {
    games = base;
    rule = position === "TE" ? "te_weighted_recent_role_expected_games" : "wr_weighted_recent_role_expected_games";
    if ((snapShare ?? 0) >= 0.68 || ["alpha_receiver", "volume_receiver"].includes(role)) {
      games = Math.max(games, Math.min(16, base + 0.5));
      confidence = "medium";
    }
    if ((snapShare ?? 1) < 0.45 || role === "low_usage") {
      games -= 1.1;
      warnings.push(`${position.toLowerCase()}_low_usage_conservative_games`);
    }
    if (input.priorSummaries.length >= 3 && (priorSeasonGames ?? 0) <= 8 && careerRecent !== null && careerRecent >= 12) {
      games = Math.max(games, 11);
      warnings.push("stable_veteran_one_missed_season_not_overpenalized");
    }
  } else if (position === "K") {
    games = Math.min(16, Math.max(8, base));
    rule = "kicker_simple_roster_status_expected_games";
    confidence = input.profile.bio.active ? "medium" : "low";
    if (!input.profile.bio.active) warnings.push("kicker_inactive_status_conservative_games");
  } else if (position === "LB") {
    games = base;
    rule = "lb_snap_tackle_floor_expected_games";
    if ((snapShare ?? 0) >= 0.65 || role === "tackle_floor") {
      games = Math.max(games, Math.min(16, base + 0.6));
      confidence = "medium";
    }
  } else if (position === "DL") {
    games = base - 0.4;
    rule = "dl_rotational_sack_profile_expected_games";
    if ((snapShare ?? 1) < 0.45 || role === "sack_upside") {
      games -= 0.8;
      warnings.push("dl_rotational_or_sack_dependent_conservative_games");
    }
  } else if (position === "DB") {
    games = base - 0.5;
    rule = "db_volatility_aware_expected_games";
    if ((snapShare ?? 0) >= 0.75 || role === "tackle_floor") games += 0.4;
    if ((snapShare ?? 1) < 0.5) warnings.push("db_low_snap_share_volatility_games");
  }

  if ((input.profile.bio.age ?? 0) >= 31 && ["RB", "WR", "TE", "DL", "LB", "DB"].includes(position)) {
    games -= 0.4;
    warnings.push("age_31_plus_small_availability_dampening");
  }

  const v4ProjectedGames = clampRound(games, 1, 17);
  const selective = selectExpectedGamesV5({
    input,
    v4ProjectedGames,
    baselineGames: weightedRecent === null ? input.previousProjectedGames : clamp(weightedRecent, 1, 17),
    role,
    snapShare,
    priorSeasonGames,
    warnings,
    confidence,
  });
  const gated = selectExpectedGamesV6({
    input,
    v4ProjectedGames,
    v5ProjectedGames: round1(selective.games),
    baselineGames: input.previousProjectedGames,
    weightedBaselineExpectedGames,
    role,
    snapShare,
    priorSeasonGames,
    confidence,
  });
  const familySelective = selectExpectedGamesV7({
    input,
    v4ProjectedGames,
    v5ProjectedGames: round1(selective.games),
    v6ProjectedGames: round1(gated.games),
    baselineGames: input.previousProjectedGames,
    weightedBaselineExpectedGames,
    role,
    snapShare,
    priorSeasonGames,
    confidence,
  });
  const cohortBlend = selectExpectedGamesV8({
    input,
    v7ProjectedGames: round1(familySelective.games),
    baselineGames: input.previousProjectedGames,
    weightedBaselineExpectedGames,
    role,
    snapShare,
    priorSeasonGames,
    confidence,
  });
  const calibratedGate = selectExpectedGamesV81({
    input,
    v7ProjectedGames: round1(familySelective.games),
    v8ProjectedGames: round1(cohortBlend.games),
    v8Cohort: cohortBlend.cohort,
    role,
    snapShare,
  });
  const highImpactGuardrail = selectExpectedGamesV82({
    input,
    v7ProjectedGames: round1(familySelective.games),
    v8ProjectedGames: round1(cohortBlend.games),
    v81ProjectedGames: round1(calibratedGate.games),
    v8Cohort: cohortBlend.cohort,
    v81Cohort: calibratedGate.cohort,
  });

  return {
    expectedGamesModel: modelName(position),
    expectedGamesRule: rule,
    expectedGamesInputs: {
      priorSeasonsUsed: input.priorSummaries.map((summary) => summary.season).filter((season): season is number => typeof season === "number" && season < input.targetSeason),
      weightedRecentGames: weightedRecent === null ? null : round1(weightedRecent),
      careerRecentGames: careerRecent === null ? null : round1(careerRecent),
      priorSeasonGames,
      snapShare,
      roleLabel: role,
      noPriorType: input.noPriorType,
    },
    expectedGamesConfidence: confidence,
    expectedGamesWarnings: warnings.sort(),
    previousProjectedGames: input.previousProjectedGames,
    v4ProjectedGames,
    v5ProjectedGames: round1(selective.games),
    v6ProjectedGames: round1(gated.games),
    v7ProjectedGames: round1(familySelective.games),
    v8ProjectedGames: round1(cohortBlend.games),
    weightedRecentGames: weightedRecent === null ? null : round1(weightedRecent),
    careerRecentGames: careerRecent === null ? null : round1(careerRecent),
    selectedExpectedGamesMethod: selective.method,
    selectedExpectedGamesReason: selective.reason,
    fallbackReason: selective.fallbackReason,
    v6SelectedExpectedGamesMethod: gated.method,
    v6GateReason: gated.gateReason,
    v6PositionFamilyGateStatus: gated.gateStatus,
    v6ExpectedGamesConfidence: gated.confidence,
    v6SelectedExpectedGamesReason: gated.reason,
    v6FallbackReason: gated.fallbackReason,
    v7SelectedExpectedGamesMethod: familySelective.method,
    v7GateReason: familySelective.gateReason,
    v7PositionFamilyGateStatus: familySelective.gateStatus,
    v7ExpectedGamesConfidence: familySelective.confidence,
    v7SelectedExpectedGamesReason: familySelective.reason,
    v7FallbackReason: familySelective.fallbackReason,
    v8SelectedExpectedGamesMethod: cohortBlend.method,
    v8Cohort: cohortBlend.cohort,
    v8BaselineExpectedGames: cohortBlend.baselineExpectedGames,
    v8Adjustment: cohortBlend.adjustment,
    v8AdjustmentReason: cohortBlend.adjustmentReason,
    v8BaselineSource: cohortBlend.baselineSource,
    v8ExpectedGamesConfidence: cohortBlend.confidence,
    v8SelectedExpectedGamesReason: cohortBlend.reason,
    v8FallbackReason: cohortBlend.fallbackReason,
    v81BaseModelUsed: "blackbird_expected_games_v8_cohort_blend",
    v81ProjectedGamesRawV8: round1(cohortBlend.games),
    v81ProjectedGamesV7: round1(familySelective.games),
    v81ProjectedGames: round1(calibratedGate.games),
    v81RawDeltaFromV7: calibratedGate.rawDelta,
    v81CalibratedDeltaFromV7: calibratedGate.calibratedDelta,
    v81DampeningFactor: calibratedGate.dampeningFactor,
    v81GatesApplied: calibratedGate.gatesApplied,
    v81Cohort: calibratedGate.cohort,
    v81Position: calibratedGate.position,
    v81PpgBucket: calibratedGate.ppgBucket,
    v81AdjustmentBucket: calibratedGate.adjustmentBucket,
    v81ReasonCodes: calibratedGate.reasonCodes,
    v81SelectedExpectedGamesReason: calibratedGate.reason,
    v82BaseModelUsed: "blackbird_expected_games_v8_1_calibrated_gate",
    v82ProjectedGamesV7: round1(familySelective.games),
    v82ProjectedGamesV8: round1(cohortBlend.games),
    v82ProjectedGamesV81: round1(calibratedGate.games),
    v82ProjectedGames: round1(highImpactGuardrail.games),
    v82DeltaFromV7: highImpactGuardrail.deltaFromV7,
    v82DeltaFromV81: highImpactGuardrail.deltaFromV81,
    v82GuardrailApplied: highImpactGuardrail.guardrailApplied,
    v82GuardrailReasonCodes: highImpactGuardrail.reasonCodes,
    v82PpgBucket: highImpactGuardrail.ppgBucket,
    v82AdjustmentBucket: highImpactGuardrail.adjustmentBucket,
    v82SelectedExpectedGamesReason: highImpactGuardrail.reason,
    qbStarterProbabilityBucket: familySelective.qbStarterProbabilityBucket,
    qbStarterSignalReason: familySelective.qbStarterSignalReason,
    qbExpectedGamesCap: familySelective.qbExpectedGamesCap,
    qbFallbackReason: familySelective.qbFallbackReason,
  };
}

function selectExpectedGamesV8(input: {
  input: ExpectedGamesModelInput;
  v7ProjectedGames: number;
  baselineGames: number;
  weightedBaselineExpectedGames: number | null;
  role: string;
  snapShare: number | null;
  priorSeasonGames: number | null;
  confidence: ExpectedGamesModelResult["expectedGamesConfidence"];
}) {
  const position = input.input.profile.bio.normalizedPosition;
  const weightedBaseline = round1(clamp(input.weightedBaselineExpectedGames ?? input.baselineGames, 1, 17));
  const lowPrior = lowPriorBaselineForExpectedGames(input.input, position);
  const priorCount = input.input.priorSummaries.length;
  const careerGames = input.input.priorSummaries.reduce((sum, summary) => sum + summary.gamesPlayed, 0);
  const lowSample = priorCount <= 1 || careerGames < 8 || (input.priorSeasonGames ?? 0) < 8;
  const priorSeason = input.priorSeasonGames ?? weightedBaseline;
  const snap = input.snapShare;

  if (position === "TE") {
    return v8Result({
      games: weightedBaseline,
      method: "te_safe_model",
      cohort: "te_fallback",
      baselineExpectedGames: weightedBaseline,
      adjustment: 0,
      adjustmentReason: "TE preserves hard weighted-baseline fallback in v8.",
      baselineSource: "hard_fallback",
      confidence: "low",
      reason: "V8 keeps TE hard fallback unchanged because prior variants regressed TE.",
      fallbackReason: "TE expected-games experimentation remains disabled in v8.",
    });
  }

  if (position === "K") {
    return v8Result({
      games: weightedBaseline,
      method: "simple_kicker_games",
      cohort: "k_fallback",
      baselineExpectedGames: weightedBaseline,
      adjustment: 0,
      adjustmentReason: "K preserves hard weighted-baseline fallback in v8.",
      baselineSource: "hard_fallback",
      confidence: "low",
      reason: "V8 keeps K hard fallback unchanged because prior variants regressed K.",
      fallbackReason: "K expected-games experimentation remains disabled in v8.",
    });
  }

  if (input.input.noPrior) {
    const anchor = lowPrior?.expectedGames ?? Math.min(input.v7ProjectedGames, position === "QB" ? 2 : 5);
    const adjustment = noPriorAdjustment(position, input.input.noPriorType);
    return v8Result({
      games: clamp(anchor + adjustment, 1, 17),
      method: "no_prior_minimal",
      cohort: input.input.noPriorType === "rookie_with_rookie_source_data" ? "rookie" : "no_prior_stats",
      baselineExpectedGames: anchor,
      adjustment,
      adjustmentReason: adjustment === 0
        ? "No reliable low-prior context beyond the conservative position prior."
        : "Small conservative no-prior adjustment from available no-prior type and position.",
      baselineSource: "low_prior_baseline",
      confidence: "very_low",
      reason: "V8 evaluates no-prior players against the low-prior baseline protocol, separate from weighted recent PPG.",
      fallbackReason: "No weighted recent games sample exists for no-prior player.",
    });
  }

  if (priorCount <= 1 && lowSample) {
    const anchor = lowPrior?.expectedGames ?? weightedBaseline;
    const rookieSample = input.priorSeasonGames !== null ? clamp(input.priorSeasonGames * 0.35 + anchor * 0.65, 1, 17) : anchor;
    const roleBump = roleAdjustment(position, input.role, snap) * 0.5;
    const games = clamp(rookieSample + roleBump, 1, 17);
    return v8Result({
      games,
      method: "v8_cohort_blend",
      cohort: "second_year_low_prior",
      baselineExpectedGames: anchor,
      adjustment: games - anchor,
      adjustmentReason: "Second-year low-prior blend uses low-prior baseline, small prior NFL game sample, and capped role signal.",
      baselineSource: lowPrior ? "low_prior_baseline" : "weighted_baseline",
      confidence: "low",
      reason: "V8 treats second-year low-prior rows as their own cohort instead of pure weighted recent PPG.",
      fallbackReason: null,
    });
  }

  if (["DL", "LB", "DB"].includes(position)) {
    const adjustment = clamp(roleAdjustment(position, input.role, snap) * 0.4, -0.6, 0.6);
    const games = clamp(weightedBaseline * 0.82 + input.v7ProjectedGames * 0.18 + adjustment, 1, 17);
    return v8Result({
      games,
      method: "v8_cohort_blend",
      cohort: "idp_conservative",
      baselineExpectedGames: weightedBaseline,
      adjustment: games - weightedBaseline,
      adjustmentReason: "IDP v8 uses only a small role/snap blend to avoid overfitting defensive availability.",
      baselineSource: "weighted_baseline",
      confidence: input.confidence,
      reason: "V8 keeps IDP conservative while allowing small role-aware availability movement.",
      fallbackReason: null,
    });
  }

  const positionPrior = positionPriorGames(position);
  const availabilityBlend = weightedBaseline * 0.72 + priorSeason * 0.18 + positionPrior * 0.1;
  const adjustment = clamp(roleAdjustment(position, input.role, snap), -0.9, 0.9);
  const games = clamp(availabilityBlend + adjustment, 1, 17);
  return v8Result({
    games,
    method: "v8_cohort_blend",
    cohort: "veteran_prior_sample",
    baselineExpectedGames: weightedBaseline,
    adjustment: games - weightedBaseline,
    adjustmentReason: "Veteran v8 blends weighted baseline, prior-season games, a position prior, and capped role/snap signal.",
    baselineSource: "weighted_baseline",
    confidence: input.confidence,
    reason: "V8 applies a real cohort-specific blend for veteran prior-sample rows.",
    fallbackReason: null,
  });
}

const V81_OFFENSE_DAMPENING = {
  ppg20Plus: 0.25,
  ppg15To20: 0.45,
  ppg10To15: 0.65,
  ppgUnder10: 0.9,
  qbHighPpgMultiplier: 0.75,
  rbHighPpgMultiplier: 0.85,
  idpMultiplier: 0.5,
  noPriorStatsMultiplier: 0.25,
  largeAdjustmentCap: 3,
  qbLargeAdjustmentCap: 2,
} as const;

function selectExpectedGamesV81(input: {
  input: ExpectedGamesModelInput;
  v7ProjectedGames: number;
  v8ProjectedGames: number;
  v8Cohort: ExpectedGamesModelResult["v8Cohort"];
  role: string;
  snapShare: number | null;
}) {
  const position = input.input.profile.bio.normalizedPosition;
  const rawDelta = round1(input.v8ProjectedGames - input.v7ProjectedGames);
  const ppgAnchor = ppgAnchorForV81(input.input);
  const ppgBucket = ppgBucketForV81(ppgAnchor);
  const adjustmentBucket = adjustmentBucketForV81(Math.abs(rawDelta));
  const gatesApplied: ExpectedGamesModelResult["v81GatesApplied"] = [];
  const reasonCodes: string[] = [];
  let dampeningFactor = 1;
  let cap: number | null = null;

  if (position === "TE" && input.v8Cohort === "te_fallback") {
    gatesApplied.push("te_fallback_preserved");
    reasonCodes.push("te_fallback_preserved");
    return v81Result(input, input.v8ProjectedGames, rawDelta, gatesApplied, reasonCodes, ppgBucket, adjustmentBucket, "TE fallback remains unchanged in v8.1.");
  }

  if (position === "K") {
    gatesApplied.push("k_fallback_preserved");
    reasonCodes.push("k_fallback_preserved");
    return v81Result(input, input.v8ProjectedGames, rawDelta, gatesApplied, reasonCodes, ppgBucket, adjustmentBucket, "K fallback remains unchanged in v8.1.");
  }

  if (input.v8Cohort === "rookie") {
    gatesApplied.push("rookie_v8_preserved");
    reasonCodes.push("rookie_v8_preserved");
  }

  if (input.v8Cohort === "second_year_low_prior" || input.v8Cohort === "low_prior_sample") {
    gatesApplied.push("low_prior_v8_preserved");
    reasonCodes.push("low_prior_v8_preserved");
  }

  if (input.v8Cohort === "no_prior_stats") {
    dampeningFactor = Math.min(dampeningFactor, V81_OFFENSE_DAMPENING.noPriorStatsMultiplier);
    gatesApplied.push("no_prior_stats_conservative");
    reasonCodes.push("no_prior_stats_conservative");
  }

  if (["DL", "LB", "DB"].includes(position)) {
    dampeningFactor = Math.min(dampeningFactor, V81_OFFENSE_DAMPENING.idpMultiplier);
    gatesApplied.push("idp_dampen");
    reasonCodes.push("idp_dampen");
  }

  const offense = ["QB", "RB", "WR", "TE"].includes(position);
  if (offense) {
    const ppgFactor = ppgDampeningFactor(ppgAnchor);
    if (ppgFactor < 1) {
      dampeningFactor = Math.min(dampeningFactor, ppgFactor);
      gatesApplied.push("high_ppg_offense_dampen");
      reasonCodes.push("high_ppg_offense_dampen");
    }
    if (position === "QB" && ppgAnchor >= 10) {
      dampeningFactor = Math.min(dampeningFactor, ppgFactor * V81_OFFENSE_DAMPENING.qbHighPpgMultiplier);
      gatesApplied.push("qb_high_ppg_dampen");
      reasonCodes.push("qb_high_ppg_dampen");
    }
    if (position === "RB" && ppgAnchor >= 10) {
      dampeningFactor = Math.min(dampeningFactor, ppgFactor * V81_OFFENSE_DAMPENING.rbHighPpgMultiplier);
      reasonCodes.push("rb_high_ppg_dampen");
    }
    if (position === "WR" && ppgAnchor < 15 && Math.abs(rawDelta) < 4 && !input.input.noPrior) {
      gatesApplied.push("wr_v8_preserved");
      reasonCodes.push("wr_v8_preserved");
    }
  }

  if (Math.abs(rawDelta) >= 4) {
    cap = position === "QB" ? V81_OFFENSE_DAMPENING.qbLargeAdjustmentCap : V81_OFFENSE_DAMPENING.largeAdjustmentCap;
    gatesApplied.push("large_adjustment_cap");
    reasonCodes.push("large_adjustment_cap");
    if (offense && !input.input.noPrior) dampeningFactor = Math.min(dampeningFactor, 0.5);
  }

  const dampedDelta = rawDelta * dampeningFactor;
  const cappedDelta = cap === null ? dampedDelta : Math.sign(dampedDelta) * Math.min(Math.abs(dampedDelta), cap);
  const games = clamp(input.v7ProjectedGames + cappedDelta, 1, 17);
  const reason = `V8.1 applies calibrated gates to v8 delta: ppg=${ppgAnchor}, raw=${rawDelta}, factor=${round1(dampeningFactor)}, cap=${cap ?? "none"}.`;
  return v81Result(input, games, rawDelta, gatesApplied, reasonCodes.length ? reasonCodes : ["v8_1_no_gate"], ppgBucket, adjustmentBucket, reason);
}

function v81Result(
  input: {
    input: ExpectedGamesModelInput;
    v7ProjectedGames: number;
    v8ProjectedGames: number;
    v8Cohort: ExpectedGamesModelResult["v8Cohort"];
  },
  gamesInput: number,
  rawDelta: number,
  gatesApplied: ExpectedGamesModelResult["v81GatesApplied"],
  reasonCodes: string[],
  ppgBucket: ExpectedGamesModelResult["v81PpgBucket"],
  adjustmentBucket: ExpectedGamesModelResult["v81AdjustmentBucket"],
  reason: string
) {
  const games = round1(clamp(gamesInput, 1, 17));
  const calibratedDelta = round1(games - input.v7ProjectedGames);
  return {
    games,
    rawDelta: round1(rawDelta),
    calibratedDelta,
    dampeningFactor: round1(rawDelta === 0 ? 1 : calibratedDelta / rawDelta),
    gatesApplied,
    cohort: input.v8Cohort,
    position: input.input.profile.bio.normalizedPosition,
    ppgBucket,
    adjustmentBucket,
    reasonCodes,
    reason,
  };
}

function ppgAnchorForV81(input: ExpectedGamesModelInput) {
  if (typeof input.projectedPpgAnchor === "number" && Number.isFinite(input.projectedPpgAnchor)) return input.projectedPpgAnchor;
  const weightedPpg = weightedAverage(input.priorSummaries.slice(0, 3).map((summary) => summary.pointsPerGame ?? 0), RECENT_WEIGHTS);
  if (weightedPpg !== null && weightedPpg > 0) return weightedPpg;
  const careerGames = input.priorSummaries.reduce((sum, summary) => sum + summary.gamesPlayed, 0);
  const careerPoints = input.priorSummaries.reduce((sum, summary) => sum + summary.totalFantasyPoints, 0);
  return careerGames ? careerPoints / careerGames : 0;
}

function selectExpectedGamesV82(input: {
  input: ExpectedGamesModelInput;
  v7ProjectedGames: number;
  v8ProjectedGames: number;
  v81ProjectedGames: number;
  v8Cohort: ExpectedGamesModelResult["v8Cohort"];
  v81Cohort: string;
}) {
  const position = input.input.profile.bio.normalizedPosition;
  const ppgAnchor = ppgAnchorForV81(input.input);
  const ppgBucket = ppgBucketForV81(ppgAnchor);
  const v81Delta = round1(input.v81ProjectedGames - input.v7ProjectedGames);
  const absDelta = Math.abs(v81Delta);
  const reasonCodes: string[] = [];
  let movementFactor = 1;

  if (position === "TE" && input.v8Cohort === "te_fallback") {
    return v82Result(input, input.v81ProjectedGames, false, ["te_fallback_preserved"], ppgBucket, "TE fallback remains unchanged in v8.2.");
  }
  if (position === "K") {
    return v82Result(input, input.v81ProjectedGames, false, ["k_fallback_preserved"], ppgBucket, "K fallback remains unchanged in v8.2.");
  }

  const offense = ["QB", "RB", "WR", "TE"].includes(position);
  const idp = ["DL", "LB", "DB"].includes(position);
  if (idp) {
    reasonCodes.push("idp_v8_1_preserved");
    return v82Result(input, input.v81ProjectedGames, false, reasonCodes, ppgBucket, "V8.2 preserves v8.1 for IDP rows.");
  }
  if (input.v81Cohort === "rookie") reasonCodes.push("rookie_v8_1_preserved");
  if (input.v81Cohort === "second_year_low_prior" || input.v81Cohort === "low_prior_sample") reasonCodes.push("low_prior_v8_1_preserved");
  if (input.v81Cohort === "no_prior_stats") {
    reasonCodes.push("no_prior_stats_conservative");
    return v82Result(input, input.v81ProjectedGames, false, reasonCodes, ppgBucket, "V8.2 preserves v8.1 conservative no-prior handling.");
  }

  if (offense && ppgAnchor >= 20) {
    reasonCodes.push("high_impact_guardrail", "elite_ppg_guardrail");
    movementFactor = position === "QB" ? 0.1 : 0.25;
    if (position === "QB") reasonCodes.push("qb_elite_guardrail");
    if (absDelta >= 4) {
      movementFactor = 0;
      reasonCodes.push("large_adjustment_guardrail");
    }
  } else if (offense && ppgAnchor >= 15 && (position === "QB" || absDelta >= 4)) {
    reasonCodes.push("high_impact_guardrail");
    movementFactor = position === "QB" ? 0.3 : 0.6;
    if (position === "QB") reasonCodes.push("qb_elite_guardrail");
    if (absDelta >= 4) reasonCodes.push("large_adjustment_guardrail");
  }

  if (offense && ["RB", "TE"].includes(position) && ppgAnchor >= 15 && input.input.priorSummaries.length >= 2) {
    movementFactor = Math.min(movementFactor, 0.5);
    reasonCodes.push("veteran_rb_te_guardrail");
  }

  if (position === "WR" && !(ppgAnchor >= 20 && absDelta >= 2)) {
    reasonCodes.push("wr_v8_1_preserved");
    return v82Result(input, input.v81ProjectedGames, false, reasonCodes, ppgBucket, "V8.2 preserves v8.1 for WR rows outside elite large-movement guardrail.");
  }

  if (movementFactor >= 1) {
    return v82Result(input, input.v81ProjectedGames, false, reasonCodes.length ? reasonCodes : ["v8_2_no_guardrail"], ppgBucket, "V8.2 preserves v8.1 because no high-impact guardrail was triggered.");
  }

  const guardedDelta = v81Delta * movementFactor;
  const games = clamp(input.v7ProjectedGames + guardedDelta, 1, 17);
  const reason = `V8.2 high-impact guardrail applies factor=${round1(movementFactor)} to v8.1 delta=${v81Delta} for ${position} at ${round1(ppgAnchor)} PPG.`;
  return v82Result(input, games, true, reasonCodes, ppgBucket, reason);
}

function v82Result(
  input: {
    v7ProjectedGames: number;
    v8ProjectedGames: number;
    v81ProjectedGames: number;
  },
  gamesInput: number,
  guardrailApplied: boolean,
  reasonCodes: string[],
  ppgBucket: ExpectedGamesModelResult["v82PpgBucket"],
  reason: string
) {
  const games = round1(clamp(gamesInput, 1, 17));
  const deltaFromV7 = round1(games - input.v7ProjectedGames);
  return {
    games,
    deltaFromV7,
    deltaFromV81: round1(games - input.v81ProjectedGames),
    guardrailApplied,
    reasonCodes,
    ppgBucket,
    adjustmentBucket: adjustmentBucketForV81(Math.abs(deltaFromV7)),
    reason,
  };
}

function ppgBucketForV81(ppg: number): ExpectedGamesModelResult["v81PpgBucket"] {
  if (ppg < 5) return "0-5 PPG";
  if (ppg < 10) return "5-10 PPG";
  if (ppg < 15) return "10-15 PPG";
  if (ppg < 20) return "15-20 PPG";
  return "20+ PPG";
}

function ppgDampeningFactor(ppg: number) {
  if (ppg >= 20) return V81_OFFENSE_DAMPENING.ppg20Plus;
  if (ppg >= 15) return V81_OFFENSE_DAMPENING.ppg15To20;
  if (ppg >= 10) return V81_OFFENSE_DAMPENING.ppg10To15;
  return V81_OFFENSE_DAMPENING.ppgUnder10;
}

function adjustmentBucketForV81(delta: number): ExpectedGamesModelResult["v81AdjustmentBucket"] {
  if (delta === 0) return "0";
  if (delta <= 0.5) return "0-0.5";
  if (delta <= 1) return "0.5-1";
  if (delta <= 2) return "1-2";
  if (delta <= 4) return "2-4";
  return "4+";
}

function lowPriorBaselineForExpectedGames(input: ExpectedGamesModelInput, position: string) {
  const priorDataGroup = input.noPrior
    ? input.noPriorType === "rookie_with_rookie_source_data" ? "rookie" : "no_prior_stats"
    : "second_year";
  const careerGames = input.priorSummaries.reduce((sum, summary) => sum + summary.gamesPlayed, 0);
  return calculateLowPriorExpectedGamesBaseline({
    position,
    priorDataGroup,
    cohortLabels: careerGames < 8 || input.noPrior ? ["low_prior_sample"] : [],
  });
}

function v8Result(input: {
  games: number;
  method: ExpectedGamesModelResult["v8SelectedExpectedGamesMethod"];
  cohort: ExpectedGamesModelResult["v8Cohort"];
  baselineExpectedGames: number | null;
  adjustment: number;
  adjustmentReason: string;
  baselineSource: ExpectedGamesModelResult["v8BaselineSource"];
  confidence: ExpectedGamesModelResult["v8ExpectedGamesConfidence"];
  reason: string;
  fallbackReason: string | null;
}) {
  const games = round1(clamp(input.games, 1, 17));
  return {
    games,
    method: input.method,
    cohort: input.cohort,
    baselineExpectedGames: input.baselineExpectedGames === null ? null : round1(input.baselineExpectedGames),
    adjustment: round1(games - (input.baselineExpectedGames ?? games)),
    adjustmentReason: input.adjustmentReason,
    baselineSource: input.baselineSource,
    confidence: input.confidence,
    reason: input.reason,
    fallbackReason: input.fallbackReason,
  };
}

function noPriorAdjustment(position: string, noPriorType: string) {
  if (noPriorType === "unsupported_no_signal") return -1;
  if (noPriorType === "rookie_with_rookie_source_data") return position === "QB" ? 0 : position === "RB" || position === "WR" ? 0.3 : 0;
  if (noPriorType === "roster_or_snap_evidence_no_prior_stats") return 0.5;
  return 0;
}

function roleAdjustment(position: string, role: string, snapShare: number | null) {
  const snap = snapShare ?? 0;
  if (position === "QB") {
    if (role === "starter" || snap >= 0.65) return 0.8;
    if (role === "backup" || snap < 0.35) return -0.8;
  }
  if (position === "RB") {
    if (role === "workhorse" || snap >= 0.62) return 0.6;
    if (role === "low_usage" || snap < 0.35) return -0.6;
  }
  if (position === "WR") {
    if (role === "alpha_receiver" || role === "volume_receiver" || snap >= 0.68) return 0.5;
    if (role === "low_usage" || snap < 0.4) return -0.5;
  }
  if (position === "LB" || position === "DB") {
    if (role === "tackle_floor" || snap >= 0.65) return 0.5;
    if (snap > 0 && snap < 0.45) return -0.5;
  }
  if (position === "DL") {
    if (role === "sack_upside" || snap < 0.45) return -0.4;
    if (snap >= 0.65) return 0.4;
  }
  return 0;
}

function positionPriorGames(position: string) {
  const priors: Record<string, number> = { QB: 12, RB: 11, WR: 12, DL: 10, LB: 11, DB: 11 };
  return priors[position] ?? 10;
}

function selectExpectedGamesV5(input: {
  input: ExpectedGamesModelInput;
  v4ProjectedGames: number;
  baselineGames: number;
  role: string;
  snapShare: number | null;
  priorSeasonGames: number | null;
  warnings: string[];
  confidence: ExpectedGamesModelResult["expectedGamesConfidence"];
}) {
  const position = input.input.profile.bio.normalizedPosition;
  const baseline = round1(clamp(input.baselineGames, 1, 17));
  const noPrior = input.input.noPrior;
  const lowSample = input.input.priorSummaries.length <= 1 || (input.priorSeasonGames ?? 0) < 8;

  if (noPrior) {
    if (position === "QB") {
      return {
        games: Math.min(2, baseline),
        method: "no_prior_minimal" as const,
        reason: "No-prior QB receives minimal expected games unless future pre-target starter evidence is available.",
        fallbackReason: "v4 rejected for no-prior QB overprojection risk.",
      };
    }
    if (input.input.noPriorType === "unsupported_no_signal") {
      return {
        games: 1,
        method: "no_prior_minimal" as const,
        reason: "No-prior/no-signal player receives near-zero expected games.",
        fallbackReason: "v4 rejected because there is no reliable pre-target role signal.",
      };
    }
    return {
      games: Math.min(input.v4ProjectedGames, baseline),
      method: "no_prior_minimal" as const,
      reason: "No-prior player uses the lower of v4 and baseline expected games.",
      fallbackReason: input.v4ProjectedGames > baseline ? "v4 capped by no-prior risk." : null,
    };
  }

  if (position === "QB") {
    const clearStarter = (input.priorSeasonGames ?? 0) >= 12 && (input.snapShare ?? 0) >= 0.65;
    const uncertainStarter = (input.priorSeasonGames ?? 0) >= 8 && !clearStarter;
    if (clearStarter) {
      return {
        games: Math.min(input.v4ProjectedGames, Math.max(baseline, 15)),
        method: "qb_starter_model" as const,
        reason: "QB has clear pre-target starter signal.",
        fallbackReason: null,
      };
    }
    if (uncertainStarter) {
      return {
        games: Math.min(input.v4ProjectedGames, Math.max(8, baseline)),
        method: "qb_starter_model" as const,
        reason: "QB has prior starter sample but uncertain durability or role stability.",
        fallbackReason: "v4 capped for qb_uncertain_starter.",
      };
    }
    return {
      games: Math.min(baseline, 5),
      method: "qb_backup_model" as const,
      reason: "QB profile is backup/low-sample; v5 avoids overprojection.",
      fallbackReason: "v4 rejected for qb_backup_risk and qb_low_sample.",
    };
  }

  if (position === "RB") {
    const confidentRole = ["workhorse", "receiving_back"].includes(input.role) || (input.snapShare ?? 0) >= 0.62;
    if (confidentRole || !input.input.noPrior) {
      return {
        games: input.v4ProjectedGames,
        method: "v4_position_model" as const,
        reason: confidentRole ? "RB has medium/high role confidence, so v4 volatility-aware games are used." : "RB aggregate backtest signal supports v4 games over fallback.",
        fallbackReason: null,
      };
    }
    return {
      games: baseline,
      method: "baseline_games" as const,
      reason: "RB lacks enough role confidence for v4 expected-games adjustment.",
      fallbackReason: "v4 rejected for low-confidence RB role/sample.",
    };
  }

  if (position === "WR") {
    const confidentRole = ["alpha_receiver", "volume_receiver"].includes(input.role) || (input.snapShare ?? 0) >= 0.68;
    if (confidentRole && !lowSample) {
      return {
        games: input.v4ProjectedGames,
        method: "v4_position_model" as const,
        reason: "WR has medium/high snap or target role confidence.",
        fallbackReason: null,
      };
    }
    return {
      games: baseline,
      method: "baseline_games" as const,
      reason: "WR v5 falls back without stable snap/target confidence.",
      fallbackReason: "v4 rejected for low-confidence WR role/sample.",
    };
  }

  if (position === "TE") {
    const highConfidence = ["alpha_receiver", "volume_receiver"].includes(input.role) && (input.snapShare ?? 0) >= 0.75 && !lowSample;
    return {
      games: highConfidence ? Math.min(input.v4ProjectedGames, Math.max(baseline, 12)) : baseline,
      method: "te_safe_model" as const,
      reason: highConfidence ? "TE has high role confidence, but v5 still caps v4 impact." : "TE defaults to safe baseline games to avoid v4 regression.",
      fallbackReason: highConfidence ? "v4 capped for TE regression control." : "v4 rejected by default for TE regression control.",
    };
  }

  if (position === "K") {
    return {
      games: baseline,
      method: "simple_kicker_games" as const,
      reason: "K uses simple baseline/status expected games; v4 complexity is disabled.",
      fallbackReason: "v4 rejected for K regression control.",
    };
  }

  if (position === "LB") {
    const fullTime = input.role === "tackle_floor" || (input.snapShare ?? 0) >= 0.65;
    return {
      games: fullTime ? input.v4ProjectedGames : baseline,
      method: fullTime ? "v4_position_model" as const : "baseline_games" as const,
      reason: fullTime ? "LB tackle-floor/full-time role signal supports v4 games." : "LB lacks full-time/tackle-floor confidence.",
      fallbackReason: fullTime ? null : "v4 rejected for low-confidence LB role.",
    };
  }

  if (position === "DL") {
    const rotational = input.role === "sack_upside" || (input.snapShare ?? 1) < 0.45;
    return {
      games: rotational ? Math.min(input.v4ProjectedGames, baseline) : input.v4ProjectedGames,
      method: rotational ? "baseline_games" as const : "v4_position_model" as const,
      reason: rotational ? "DL sack-only/rotational profile is capped to avoid overboosting." : "DL role supports v4 IDP expected games.",
      fallbackReason: rotational ? "v4 capped for DL rotational/sack-only risk." : null,
    };
  }

  if (position === "DB") {
    const confidentRole = input.role === "tackle_floor" || (input.snapShare ?? 0) >= 0.65;
    return {
      games: input.v4ProjectedGames,
      method: "v4_position_model" as const,
      reason: confidentRole ? "DB has enough snap/tackle role confidence for v4 games." : "DB aggregate backtest signal supports v4 games despite volatility.",
      fallbackReason: null,
    };
  }

  return {
    games: baseline,
    method: "baseline_games" as const,
    reason: "Unsupported position uses baseline expected games.",
    fallbackReason: "v4 rejected for unsupported position.",
  };
}

function selectExpectedGamesV6(input: {
  input: ExpectedGamesModelInput;
  v4ProjectedGames: number;
  v5ProjectedGames: number;
  baselineGames: number;
  weightedBaselineExpectedGames: number | null;
  role: string;
  snapShare: number | null;
  priorSeasonGames: number | null;
  confidence: ExpectedGamesModelResult["expectedGamesConfidence"];
}) {
  const position = input.input.profile.bio.normalizedPosition;
  const baseline = round1(clamp(input.weightedBaselineExpectedGames ?? input.baselineGames, 1, 17));
  const lowSample = input.input.priorSummaries.length <= 1 || (input.priorSeasonGames ?? 0) < 8;
  const noPrior = input.input.noPrior;

  if (noPrior) {
    const games = position === "QB"
      ? Math.min(2, baseline)
      : input.input.noPriorType === "unsupported_no_signal"
        ? 1
        : Math.min(baseline, position === "K" ? 8 : 5);
    return {
      games,
      method: "no_prior_minimal" as const,
      gateReason: "no_prior_minimal" as const,
      gateStatus: "fallback" as const,
      confidence: "very_low" as const,
      reason: "V6 minimizes no-prior/no-signal expected games and keeps this backtest-only.",
      fallbackReason: "Expected-games family gate rejected no-prior profile.",
    };
  }

  if (position === "QB") {
    const clearStarter = (input.priorSeasonGames ?? 0) >= 12 && (input.snapShare ?? 0) >= 0.65;
    const priorStarter = (input.priorSeasonGames ?? 0) >= 10 || input.role === "starter";
    if (clearStarter) {
      return {
        games: Math.min(input.v5ProjectedGames, Math.max(baseline, 14)),
        method: "qb_starter_model" as const,
        gateReason: "qb_clear_starter_expected_games" as const,
        gateStatus: "passed" as const,
        confidence: "medium" as const,
        reason: "QB passed v6 clear-starter gate, so expected-games adjustment is allowed with a starter floor.",
        fallbackReason: null,
      };
    }
    if (priorStarter && !lowSample) {
      return {
        games: Math.min(input.v5ProjectedGames, Math.max(baseline, 8)),
        method: "qb_starter_model" as const,
        gateReason: "position_family_passed_gate" as const,
        gateStatus: "passed" as const,
        confidence: "low" as const,
        reason: "QB had prior starter signal but did not pass the clear-starter gate; v6 caps expected-games impact.",
        fallbackReason: "QB expected-games capped for uncertain starter risk.",
      };
    }
    return {
      games: Math.min(baseline, 5),
      method: "qb_backup_model" as const,
      gateReason: "qb_backup_fallback" as const,
      gateStatus: "fallback" as const,
      confidence: "low" as const,
      reason: "QB failed the v6 starter gate and falls back to conservative backup games.",
      fallbackReason: "Expected-games rejected for backup/low-sample/no-prior QB risk.",
    };
  }

  if (position === "RB") {
    const meaningfulRole = input.input.priorSummaries.length > 0 || ["workhorse", "receiving_back", "committee_back"].includes(input.role) || (input.snapShare ?? 0) >= 0.35;
    return meaningfulRole
      ? {
          games: input.v5ProjectedGames,
          method: "v4_position_model" as const,
          gateReason: "position_family_passed_gate" as const,
          gateStatus: "passed" as const,
          confidence: input.confidence,
          reason: "RB passed v6 family gate; prior diagnostics support expected-games adjustment.",
          fallbackReason: null,
        }
      : {
          games: baseline,
          method: "baseline_games" as const,
          gateReason: "low_confidence_fallback" as const,
          gateStatus: "fallback" as const,
          confidence: "low" as const,
          reason: "RB lacks prior data and meaningful role signal, so v6 uses baseline games.",
          fallbackReason: "Expected-games rejected for low-confidence RB role.",
        };
  }

  if (position === "WR") {
    const rolePass = ["alpha_receiver", "volume_receiver"].includes(input.role) || (input.snapShare ?? 0) >= 0.68;
    if (rolePass && !lowSample) {
      return {
        games: input.v5ProjectedGames,
        method: "v4_position_model" as const,
        gateReason: "position_family_passed_gate" as const,
        gateStatus: "passed" as const,
        confidence: input.confidence,
        reason: "WR passed v6 role-confidence gate.",
        fallbackReason: null,
      };
    }
    return {
      games: baseline,
      method: "baseline_games" as const,
      gateReason: rolePass ? "low_confidence_fallback" as const : "position_family_failed_gate" as const,
      gateStatus: "fallback" as const,
      confidence: "low" as const,
      reason: "WR failed v6 role/sample gate, so expected-games adjustment is disabled.",
      fallbackReason: "Expected-games rejected for WR low-confidence role/sample.",
    };
  }

  if (position === "TE") {
    return {
      games: baseline,
      method: "te_safe_model" as const,
      gateReason: "te_baseline_fallback" as const,
      gateStatus: "fallback" as const,
      confidence: "low" as const,
      reason: "TE defaults to weighted/baseline games in v6 because v4/v5 materially regressed TE.",
      fallbackReason: "Expected-games family gate rejected TE by default.",
    };
  }

  if (position === "K") {
    return {
      games: baseline,
      method: "simple_kicker_games" as const,
      gateReason: "k_baseline_fallback" as const,
      gateStatus: "fallback" as const,
      confidence: "low" as const,
      reason: "K defaults to simple weighted/baseline games in v6 because v4/v5 materially regressed K.",
      fallbackReason: "Expected-games family gate rejected K.",
    };
  }

  if (["DL", "LB", "DB"].includes(position)) {
    if (position === "DL") {
      const sackOnly = input.role === "sack_upside" || (input.snapShare ?? 1) < 0.45;
      return {
        games: sackOnly ? Math.min(input.v5ProjectedGames, baseline) : input.v5ProjectedGames,
        method: sackOnly ? "baseline_games" as const : "v4_position_model" as const,
        gateReason: sackOnly ? "low_confidence_fallback" as const : "idp_expected_games_enabled" as const,
        gateStatus: sackOnly ? "fallback" as const : "passed" as const,
        confidence: sackOnly ? "low" as const : input.confidence,
        reason: sackOnly ? "DL rotational/sack-only profile is capped by v6." : "DL passed v6 IDP expected-games gate.",
        fallbackReason: sackOnly ? "Expected-games capped for DL rotational/sack-only risk." : null,
      };
    }
    if (position === "LB") {
      const fullTime = input.role === "tackle_floor" || (input.snapShare ?? 0) >= 0.65;
      return {
        games: fullTime ? input.v5ProjectedGames : baseline,
        method: fullTime ? "v4_position_model" as const : "baseline_games" as const,
        gateReason: fullTime ? "idp_expected_games_enabled" as const : "low_confidence_fallback" as const,
        gateStatus: fullTime ? "passed" as const : "fallback" as const,
        confidence: fullTime ? input.confidence : "low" as const,
        reason: fullTime ? "LB tackle-floor/full-time role passed v6 IDP gate." : "LB failed tackle-floor/full-time gate and falls back.",
        fallbackReason: fullTime ? null : "Expected-games rejected for low-confidence LB role.",
      };
    }
    const dbTackleFloor = input.role === "tackle_floor" || (input.snapShare ?? 0) >= 0.65;
    return {
      games: dbTackleFloor ? input.v5ProjectedGames : Math.min(input.v5ProjectedGames, baseline),
      method: dbTackleFloor ? "v4_position_model" as const : "baseline_games" as const,
      gateReason: dbTackleFloor ? "idp_expected_games_enabled" as const : "low_confidence_fallback" as const,
      gateStatus: dbTackleFloor ? "passed" as const : "fallback" as const,
      confidence: dbTackleFloor ? input.confidence : "low" as const,
      reason: dbTackleFloor ? "DB tackle-floor/snap role passed v6 IDP gate." : "DB volatility safeguard capped expected-games adjustment.",
      fallbackReason: dbTackleFloor ? null : "Expected-games capped for DB volatility.",
    };
  }

  return {
    games: baseline,
    method: "baseline_games" as const,
    gateReason: "position_family_failed_gate" as const,
    gateStatus: "fallback" as const,
    confidence: "low" as const,
    reason: "Unsupported position failed v6 expected-games family gate.",
    fallbackReason: "Expected-games rejected for unsupported position.",
  };
}

function selectExpectedGamesV7(input: {
  input: ExpectedGamesModelInput;
  v4ProjectedGames: number;
  v5ProjectedGames: number;
  v6ProjectedGames: number;
  baselineGames: number;
  weightedBaselineExpectedGames: number | null;
  role: string;
  snapShare: number | null;
  priorSeasonGames: number | null;
  confidence: ExpectedGamesModelResult["expectedGamesConfidence"];
}) {
  const position = input.input.profile.bio.normalizedPosition;
  const baseline = round1(clamp(input.weightedBaselineExpectedGames ?? input.baselineGames, 1, 17));
  const lowSample = input.input.priorSummaries.length <= 1 || (input.priorSeasonGames ?? 0) < 8;
  const noPrior = input.input.noPrior;
  const emptyQb = {
    qbStarterProbabilityBucket: null,
    qbStarterSignalReason: null,
    qbExpectedGamesCap: null,
    qbFallbackReason: null,
  };

  if (noPrior) {
    const games = position === "QB"
      ? Math.min(2, baseline)
      : input.input.noPriorType === "unsupported_no_signal"
        ? 1
        : Math.min(baseline, position === "K" ? 8 : 5);
    return {
      games,
      method: "no_prior_minimal" as const,
      gateReason: "no_prior_minimal" as const,
      gateStatus: "fallback" as const,
      confidence: "very_low" as const,
      reason: "V7 minimizes no-prior/no-signal expected games and does not infer future role from target-season outcomes.",
      fallbackReason: "Family-selective expected-games gate rejected no-prior profile.",
      qbStarterProbabilityBucket: position === "QB" ? "no_prior_minimal" as const : null,
      qbStarterSignalReason: position === "QB" ? "No prior QB production or approved pre-target starter signal was available." : null,
      qbExpectedGamesCap: position === "QB" ? 2 : null,
      qbFallbackReason: position === "QB" ? "No-prior QB hard-capped to minimal games." : null,
    };
  }

  if (position === "QB") {
    const priorGames = input.priorSeasonGames ?? 0;
    const snap = input.snapShare ?? 0;
    const clearStarter = priorGames >= 12 && snap >= 0.65;
    const probableStarter = priorGames >= 10 || (snap >= 0.55 && input.role === "starter");
    const unstableStarter = priorGames >= 8 || snap >= 0.45;
    if (clearStarter) {
      return {
        games: Math.min(input.v6ProjectedGames, Math.max(baseline, 14)),
        method: "qb_starter_model" as const,
        gateReason: "qb_clear_starter_expected_games" as const,
        gateStatus: "passed" as const,
        confidence: "medium" as const,
        reason: "QB is a clear pre-target starter; v7 allows expected-games adjustment with a starter floor.",
        fallbackReason: null,
        qbStarterProbabilityBucket: "clear_starter" as const,
        qbStarterSignalReason: "Prior season games and snap/share role both indicate a clear starter before the target season.",
        qbExpectedGamesCap: 17,
        qbFallbackReason: null,
      };
    }
    if (probableStarter) {
      return {
        games: Math.min(input.v6ProjectedGames, Math.max(baseline, 10)),
        method: "qb_starter_model" as const,
        gateReason: "position_family_passed_gate" as const,
        gateStatus: "passed" as const,
        confidence: "low" as const,
        reason: "QB is a probable starter but not a clean clear-starter profile; v7 caps expected-games impact.",
        fallbackReason: "QB expected-games capped for probable-starter uncertainty.",
        qbStarterProbabilityBucket: "probable_starter" as const,
        qbStarterSignalReason: "Prior season games or pre-target starter role signal suggests probable starter.",
        qbExpectedGamesCap: 15,
        qbFallbackReason: "Capped below clear-starter handling.",
      };
    }
    if (unstableStarter && !lowSample) {
      return {
        games: Math.min(input.v6ProjectedGames, Math.max(baseline, 8)),
        method: "qb_starter_model" as const,
        gateReason: "position_family_passed_gate" as const,
        gateStatus: "passed" as const,
        confidence: "low" as const,
        reason: "QB has unstable starter signal; v7 allows only capped starter games.",
        fallbackReason: "QB expected-games capped for unstable starter risk.",
        qbStarterProbabilityBucket: "unstable_starter" as const,
        qbStarterSignalReason: "QB had partial starter evidence before target season but lacked clear starter durability/role.",
        qbExpectedGamesCap: 12,
        qbFallbackReason: "Capped for unstable starter risk.",
      };
    }
    return {
      games: Math.min(baseline, 5),
      method: "qb_backup_model" as const,
      gateReason: "qb_backup_fallback" as const,
      gateStatus: "fallback" as const,
      confidence: "low" as const,
      reason: "QB is backup/low-sample by pre-target evidence; v7 uses conservative backup games.",
      fallbackReason: "Family-selective expected-games rejected backup/low-sample QB.",
      qbStarterProbabilityBucket: "backup_or_low_sample" as const,
      qbStarterSignalReason: "QB did not have enough prior games, snap share, or starter role signal before target season.",
      qbExpectedGamesCap: 5,
      qbFallbackReason: "Backup/low-sample QB capped to conservative games.",
    };
  }

  if (position === "TE") {
    return {
      games: baseline,
      method: "te_safe_model" as const,
      gateReason: "te_hard_baseline_fallback" as const,
      gateStatus: "fallback" as const,
      confidence: "low" as const,
      reason: "TE is hard-isolated to weighted/baseline games in v7 because expected-games variants regressed TE.",
      fallbackReason: "TE expected-games model disabled in v7.",
      ...emptyQb,
    };
  }

  if (position === "K") {
    return {
      games: baseline,
      method: "simple_kicker_games" as const,
      gateReason: "k_hard_baseline_fallback" as const,
      gateStatus: "fallback" as const,
      confidence: "low" as const,
      reason: "K is hard-isolated to simple weighted/baseline games in v7 because expected-games variants regressed K.",
      fallbackReason: "K expected-games model disabled in v7.",
      ...emptyQb,
    };
  }

  if (position === "RB") {
    const meaningfulRole = input.input.priorSummaries.length > 0 || ["workhorse", "receiving_back", "committee_back"].includes(input.role) || (input.snapShare ?? 0) >= 0.35;
    return meaningfulRole
      ? {
          games: input.v5ProjectedGames,
          method: "v4_position_model" as const,
          gateReason: "position_family_passed_gate" as const,
          gateStatus: "passed" as const,
          confidence: input.confidence,
          reason: "RB passed v7 family gate; prior diagnostics support expected-games adjustment.",
          fallbackReason: null,
          ...emptyQb,
        }
      : {
          games: baseline,
          method: "baseline_games" as const,
          gateReason: "low_confidence_fallback" as const,
          gateStatus: "fallback" as const,
          confidence: "low" as const,
          reason: "RB lacks prior data and meaningful role signal, so v7 uses baseline games.",
          fallbackReason: "Expected-games rejected for low-confidence RB role.",
          ...emptyQb,
        };
  }

  if (position === "WR") {
    const rolePass = ["alpha_receiver", "volume_receiver"].includes(input.role) || (input.snapShare ?? 0) >= 0.68;
    if (rolePass && !lowSample) {
      return {
        games: input.v5ProjectedGames,
        method: "v4_position_model" as const,
        gateReason: "position_family_passed_gate" as const,
        gateStatus: "passed" as const,
        confidence: input.confidence,
        reason: "WR passed v7 role-confidence gate.",
        fallbackReason: null,
        ...emptyQb,
      };
    }
    return {
      games: baseline,
      method: "baseline_games" as const,
      gateReason: rolePass ? "low_confidence_fallback" as const : "position_family_failed_gate" as const,
      gateStatus: "fallback" as const,
      confidence: "low" as const,
      reason: "WR failed v7 role/sample gate, so expected-games adjustment is disabled.",
      fallbackReason: "Expected-games rejected for WR low-confidence role/sample.",
      ...emptyQb,
    };
  }

  if (["DL", "LB", "DB"].includes(position)) {
    if (position === "DL") {
      const sackOnly = input.role === "sack_upside" || (input.snapShare ?? 1) < 0.45;
      return {
        games: sackOnly ? Math.min(input.v5ProjectedGames, baseline) : input.v5ProjectedGames,
        method: sackOnly ? "baseline_games" as const : "v4_position_model" as const,
        gateReason: sackOnly ? "low_confidence_fallback" as const : "idp_expected_games_enabled" as const,
        gateStatus: sackOnly ? "fallback" as const : "passed" as const,
        confidence: sackOnly ? "low" as const : input.confidence,
        reason: sackOnly ? "DL rotational/sack-only profile is capped by v7." : "DL passed v7 IDP expected-games gate.",
        fallbackReason: sackOnly ? "Expected-games capped for DL rotational/sack-only risk." : null,
        ...emptyQb,
      };
    }
    if (position === "LB") {
      const fullTime = input.role === "tackle_floor" || (input.snapShare ?? 0) >= 0.65;
      return {
        games: fullTime ? input.v5ProjectedGames : baseline,
        method: fullTime ? "v4_position_model" as const : "baseline_games" as const,
        gateReason: fullTime ? "idp_expected_games_enabled" as const : "low_confidence_fallback" as const,
        gateStatus: fullTime ? "passed" as const : "fallback" as const,
        confidence: fullTime ? input.confidence : "low" as const,
        reason: fullTime ? "LB tackle-floor/full-time role passed v7 IDP gate." : "LB failed tackle-floor/full-time gate and falls back.",
        fallbackReason: fullTime ? null : "Expected-games rejected for low-confidence LB role.",
        ...emptyQb,
      };
    }
    const dbTackleFloor = input.role === "tackle_floor" || (input.snapShare ?? 0) >= 0.65;
    return {
      games: dbTackleFloor ? input.v5ProjectedGames : Math.min(input.v5ProjectedGames, baseline),
      method: dbTackleFloor ? "v4_position_model" as const : "baseline_games" as const,
      gateReason: dbTackleFloor ? "idp_expected_games_enabled" as const : "low_confidence_fallback" as const,
      gateStatus: dbTackleFloor ? "passed" as const : "fallback" as const,
      confidence: dbTackleFloor ? input.confidence : "low" as const,
      reason: dbTackleFloor ? "DB tackle-floor/snap role passed v7 IDP gate." : "DB volatility safeguard capped expected-games adjustment.",
      fallbackReason: dbTackleFloor ? null : "Expected-games capped for DB volatility.",
      ...emptyQb,
    };
  }

  return {
    games: baseline,
    method: "baseline_games" as const,
    gateReason: "position_family_failed_gate" as const,
    gateStatus: "fallback" as const,
    confidence: "low" as const,
    reason: "Unsupported position failed v7 expected-games family gate.",
    fallbackReason: "Expected-games rejected for unsupported position.",
    ...emptyQb,
  };
}

function noPriorGames(position: string, noPriorType: string) {
  if (noPriorType === "unsupported_no_signal") return { games: 1, rule: "no_prior_no_signal_near_zero_expected_games", confidence: "very_low" as const };
  if (noPriorType === "rookie_with_rookie_source_data") {
    const games: Record<string, number> = { QB: 7, RB: 7, WR: 7, TE: 6, K: 10, DL: 5, LB: 5, DB: 5 };
    return { games: games[position] ?? 5, rule: "rookie_source_data_conservative_position_prior_games", confidence: "very_low" as const };
  }
  if (noPriorType === "roster_or_snap_evidence_no_prior_stats") return { games: position === "K" ? 10 : 5, rule: "no_prior_with_roster_or_snap_evidence_low_expected_games", confidence: "low" as const };
  if (noPriorType === "idp_no_prior_player") return { games: 4, rule: "idp_no_prior_very_conservative_expected_games", confidence: "very_low" as const };
  return { games: 2, rule: "depth_or_fringe_no_prior_conservative_expected_games", confidence: "very_low" as const };
}

function modelName(position: string): ExpectedGamesModelResult["expectedGamesModel"] {
  if (position === "QB") return "blackbird_expected_games_qb";
  if (position === "RB") return "blackbird_expected_games_rb";
  if (position === "WR" || position === "TE") return "blackbird_expected_games_wr_te";
  if (position === "K") return "blackbird_expected_games_k";
  if (["DL", "LB", "DB"].includes(position)) return "blackbird_expected_games_idp";
  return "blackbird_expected_games_v4";
}

function roleLabel(position: string, usage: ExpectedGamesModelInput["priorUsage"]) {
  if (!usage) return "insufficient_data";
  if (["DL", "LB", "DB"].includes(position)) {
    if ((usage.tackleFloorScore ?? 0) >= 70) return "tackle_floor";
    if ((usage.sackDependencyScore ?? 0) >= 60) return "sack_upside";
    if ((usage.bigPlayDependencyScore ?? 0) >= 60) return "big_play_dependent";
    return "balanced";
  }
  if (position === "QB") return (usage.passAttemptsPerGame ?? 0) >= 20 || (usage.offensiveSnapShare ?? 0) >= 0.65 ? "starter" : "backup";
  if (position === "RB") return (usage.touchesPerGame ?? 0) >= 18 ? "workhorse" : (usage.targetsPerGame ?? 0) >= 4 ? "receiving_back" : (usage.touchesPerGame ?? 0) >= 10 ? "committee_back" : "low_usage";
  if (position === "WR" || position === "TE") return (usage.targetsPerGame ?? 0) >= 8 ? "alpha_receiver" : (usage.targetsPerGame ?? 0) >= 5 ? "volume_receiver" : "low_usage";
  return "standard";
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
