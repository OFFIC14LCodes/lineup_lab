import type { HistoricalPlayerProfileSnapshot } from "@/lib/player-profiles";

export type ExpectedGamesModelName =
  | "blackbird_expected_games_v4"
  | "blackbird_expected_games_v5_selective"
  | "blackbird_expected_games_v6_gated"
  | "blackbird_expected_games_v7_family_selective"
  | "blackbird_expected_games_v8_cohort_blend"
  | "blackbird_expected_games_v8_1_calibrated_gate"
  | "blackbird_expected_games_v8_2_high_impact_guardrail"
  | "blackbird_expected_games_qb"
  | "blackbird_expected_games_rb"
  | "blackbird_expected_games_wr_te"
  | "blackbird_expected_games_idp"
  | "blackbird_expected_games_k";

export type ExpectedGamesConfidence = "very_low" | "low" | "medium" | "high";

export type ExpectedGamesModelInput = {
  profile: HistoricalPlayerProfileSnapshot;
  targetSeason: number;
  priorSummaries: HistoricalPlayerProfileSnapshot["seasonSummaries"];
  priorUsage: NonNullable<HistoricalPlayerProfileSnapshot["seasonUsageSummaries"]>[number] | null;
  noPrior: boolean;
  noPriorType: string;
  previousProjectedGames: number;
  projectedPpgAnchor?: number | null;
};

export type ExpectedGamesModelResult = {
  expectedGamesModel: ExpectedGamesModelName;
  expectedGamesRule: string;
  expectedGamesInputs: {
    priorSeasonsUsed: number[];
    weightedRecentGames: number | null;
    careerRecentGames: number | null;
    priorSeasonGames: number | null;
    snapShare: number | null;
    roleLabel: string;
    noPriorType: string;
  };
  expectedGamesConfidence: ExpectedGamesConfidence;
  expectedGamesWarnings: string[];
  previousProjectedGames: number;
  v4ProjectedGames: number;
  v5ProjectedGames: number;
  v6ProjectedGames: number;
  v7ProjectedGames: number;
  weightedRecentGames: number | null;
  careerRecentGames: number | null;
  selectedExpectedGamesMethod:
    | "v4_position_model"
    | "baseline_games"
    | "simple_kicker_games"
    | "qb_starter_model"
    | "qb_backup_model"
    | "te_safe_model"
    | "no_prior_minimal"
    | "v8_cohort_blend";
  selectedExpectedGamesReason: string;
  fallbackReason: string | null;
  v6SelectedExpectedGamesMethod:
    | "v4_position_model"
    | "baseline_games"
    | "simple_kicker_games"
    | "qb_starter_model"
    | "qb_backup_model"
    | "te_safe_model"
    | "no_prior_minimal"
    | "v8_cohort_blend";
  v6GateReason:
    | "position_family_passed_gate"
    | "position_family_failed_gate"
    | "low_confidence_fallback"
    | "te_baseline_fallback"
    | "k_baseline_fallback"
    | "qb_backup_fallback"
    | "qb_clear_starter_expected_games"
    | "idp_expected_games_enabled"
    | "no_prior_minimal";
  v6PositionFamilyGateStatus: "passed" | "failed" | "fallback";
  v6ExpectedGamesConfidence: ExpectedGamesConfidence;
  v6SelectedExpectedGamesReason: string;
  v6FallbackReason: string | null;
  v7SelectedExpectedGamesMethod:
    | "v4_position_model"
    | "baseline_games"
    | "simple_kicker_games"
    | "qb_starter_model"
    | "qb_backup_model"
    | "te_safe_model"
    | "no_prior_minimal";
  v7GateReason:
    | "position_family_passed_gate"
    | "position_family_failed_gate"
    | "low_confidence_fallback"
    | "te_hard_baseline_fallback"
    | "k_hard_baseline_fallback"
    | "qb_backup_fallback"
    | "qb_clear_starter_expected_games"
    | "idp_expected_games_enabled"
    | "no_prior_minimal";
  v7PositionFamilyGateStatus: "passed" | "failed" | "fallback";
  v7ExpectedGamesConfidence: ExpectedGamesConfidence;
  v7SelectedExpectedGamesReason: string;
  v7FallbackReason: string | null;
  v8ProjectedGames: number;
  v8SelectedExpectedGamesMethod:
    | "v4_position_model"
    | "baseline_games"
    | "simple_kicker_games"
    | "qb_starter_model"
    | "qb_backup_model"
    | "te_safe_model"
    | "no_prior_minimal"
    | "v8_cohort_blend";
  v8Cohort:
    | "veteran_prior_sample"
    | "rookie"
    | "second_year_low_prior"
    | "no_prior_stats"
    | "te_fallback"
    | "k_fallback"
    | "idp_conservative"
    | "low_prior_sample";
  v8BaselineExpectedGames: number | null;
  v8Adjustment: number;
  v8AdjustmentReason: string;
  v8BaselineSource: "weighted_baseline" | "low_prior_baseline" | "hard_fallback" | "v7_preserved";
  v8ExpectedGamesConfidence: ExpectedGamesConfidence;
  v8SelectedExpectedGamesReason: string;
  v8FallbackReason: string | null;
  v81BaseModelUsed: "blackbird_expected_games_v8_cohort_blend";
  v81ProjectedGamesRawV8: number;
  v81ProjectedGamesV7: number;
  v81ProjectedGames: number;
  v81RawDeltaFromV7: number;
  v81CalibratedDeltaFromV7: number;
  v81DampeningFactor: number;
  v81GatesApplied: Array<
    | "high_ppg_offense_dampen"
    | "qb_high_ppg_dampen"
    | "large_adjustment_cap"
    | "rookie_v8_preserved"
    | "low_prior_v8_preserved"
    | "no_prior_stats_conservative"
    | "idp_dampen"
    | "te_fallback_preserved"
    | "k_fallback_preserved"
    | "wr_v8_preserved"
  >;
  v81Cohort: string;
  v81Position: string;
  v81PpgBucket: "0-5 PPG" | "5-10 PPG" | "10-15 PPG" | "15-20 PPG" | "20+ PPG";
  v81AdjustmentBucket: "0" | "0-0.5" | "0.5-1" | "1-2" | "2-4" | "4+";
  v81ReasonCodes: string[];
  v81SelectedExpectedGamesReason: string;
  v82BaseModelUsed: "blackbird_expected_games_v8_1_calibrated_gate";
  v82ProjectedGamesV7: number;
  v82ProjectedGamesV8: number;
  v82ProjectedGamesV81: number;
  v82ProjectedGames: number;
  v82DeltaFromV7: number;
  v82DeltaFromV81: number;
  v82GuardrailApplied: boolean;
  v82GuardrailReasonCodes: string[];
  v82PpgBucket: "0-5 PPG" | "5-10 PPG" | "10-15 PPG" | "15-20 PPG" | "20+ PPG";
  v82AdjustmentBucket: "0" | "0-0.5" | "0.5-1" | "1-2" | "2-4" | "4+";
  v82SelectedExpectedGamesReason: string;
  qbStarterProbabilityBucket:
    | "clear_starter"
    | "probable_starter"
    | "unstable_starter"
    | "backup_or_low_sample"
    | "no_prior_minimal"
    | null;
  qbStarterSignalReason: string | null;
  qbExpectedGamesCap: number | null;
  qbFallbackReason: string | null;
};
