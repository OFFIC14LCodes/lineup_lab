# Projection Ablation 2025

Dry run: true
Read only: true
Target season: 2025
Input seasons: 2018, 2019, 2020, 2021, 2022, 2023, 2024
Leakage safe: true

## Variants Evaluated

- weighted_recent_ppg
- weighted_recent_ppg_plus_baseline_games
- weighted_recent_ppg_plus_availability_games
- weighted_recent_ppg_plus_cohort_games
- weighted_recent_ppg_plus_profile_ppg_adjustment
- weighted_recent_ppg_plus_role_ppg_adjustment
- weighted_recent_ppg_plus_no_prior_priors
- blackbird_v2
- blackbird_v3
- blackbird_expected_games_v4
- blackbird_expected_games_v5_selective
- blackbird_expected_games_v6_gated
- blackbird_expected_games_v7_family_selective
- blackbird_expected_games_v8_cohort_blend
- blackbird_expected_games_v8_1_calibrated_gate
- blackbird_expected_games_v8_2_high_impact_guardrail

## Overall Ablation Table

```json
{
  "weighted_recent_ppg": {
    "count": 1368,
    "maeTotal": 38.441,
    "maePpg": 2.254,
    "rmseTotal": 54.841,
    "rmsePpg": 3.091,
    "biasTotal": 3.683,
    "biasPpg": 0.297,
    "medianAbsErrorTotal": 26,
    "medianAbsErrorPpg": 1.6,
    "correlationTotal": 0.722,
    "correlationPpg": 0.735,
    "rankCorrelationTotal": 0.705,
    "gamesMae": 3.917,
    "availabilityMissCounts": {
      "accurate_games": 542,
      "overestimated_availability": 148,
      "underestimated_availability": 206,
      "major_availability_miss": 275,
      "low_actual_games": 197,
      "no_games_projection": 327
    },
    "hitRates": {
      "top12": 0.167,
      "top24": 0.375,
      "top36": 0.417
    }
  },
  "weighted_recent_ppg_plus_baseline_games": {
    "count": 1368,
    "maeTotal": 39.623,
    "maePpg": 2.254,
    "rmseTotal": 57.753,
    "rmsePpg": 3.091,
    "biasTotal": 3.656,
    "biasPpg": 0.297,
    "medianAbsErrorTotal": 26.85,
    "medianAbsErrorPpg": 1.6,
    "correlationTotal": 0.703,
    "correlationPpg": 0.735,
    "rankCorrelationTotal": 0.693,
    "gamesMae": 4.246,
    "availabilityMissCounts": {
      "accurate_games": 483,
      "overestimated_availability": 183,
      "underestimated_availability": 199,
      "major_availability_miss": 306,
      "low_actual_games": 197,
      "no_games_projection": 327
    },
    "hitRates": {
      "top12": 0.167,
      "top24": 0.417,
      "top36": 0.444
    }
  },
  "weighted_recent_ppg_plus_availability_games": {
    "count": 1368,
    "maeTotal": 37.937,
    "maePpg": 2.254,
    "rmseTotal": 54.762,
    "rmsePpg": 3.091,
    "biasTotal": -2.657,
    "biasPpg": 0.297,
    "medianAbsErrorTotal": 24.85,
    "medianAbsErrorPpg": 1.6,
    "correlationTotal": 0.717,
    "correlationPpg": 0.735,
    "rankCorrelationTotal": 0.7,
    "gamesMae": 4.034,
    "availabilityMissCounts": {
      "accurate_games": 484,
      "overestimated_availability": 117,
      "underestimated_availability": 259,
      "major_availability_miss": 311,
      "low_actual_games": 197,
      "no_games_projection": 327
    },
    "hitRates": {
      "top12": 0.167,
      "top24": 0.417,
      "top36": 0.389
    }
  },
  "weighted_recent_ppg_plus_cohort_games": {
    "count": 1368,
    "maeTotal": 38.915,
    "maePpg": 2.254,
    "rmseTotal": 55.388,
    "rmsePpg": 3.091,
    "biasTotal": -0.063,
    "biasPpg": 0.297,
    "medianAbsErrorTotal": 26.35,
    "medianAbsErrorPpg": 1.6,
    "correlationTotal": 0.708,
    "correlationPpg": 0.735,
    "rankCorrelationTotal": 0.687,
    "gamesMae": 4.067,
    "availabilityMissCounts": {
      "accurate_games": 522,
      "overestimated_availability": 139,
      "underestimated_availability": 199,
      "major_availability_miss": 311,
      "low_actual_games": 197,
      "no_games_projection": 327
    },
    "hitRates": {
      "top12": 0.25,
      "top24": 0.375,
      "top36": 0.389
    }
  },
  "weighted_recent_ppg_plus_profile_ppg_adjustment": {
    "count": 1368,
    "maeTotal": 39.892,
    "maePpg": 2.334,
    "rmseTotal": 57.308,
    "rmsePpg": 3.229,
    "biasTotal": 7.59,
    "biasPpg": 0.565,
    "medianAbsErrorTotal": 26.3,
    "medianAbsErrorPpg": 1.8,
    "correlationTotal": 0.719,
    "correlationPpg": 0.739,
    "rankCorrelationTotal": 0.702,
    "gamesMae": 3.917,
    "availabilityMissCounts": {
      "accurate_games": 542,
      "overestimated_availability": 148,
      "underestimated_availability": 206,
      "major_availability_miss": 275,
      "low_actual_games": 197,
      "no_games_projection": 327
    },
    "hitRates": {
      "top12": 0.167,
      "top24": 0.375,
      "top36": 0.417
    }
  },
  "weighted_recent_ppg_plus_role_ppg_adjustment": {
    "count": 1368,
    "maeTotal": 38.325,
    "maePpg": 2.245,
    "rmseTotal": 54.855,
    "rmsePpg": 3.093,
    "biasTotal": 2.987,
    "biasPpg": 0.237,
    "medianAbsErrorTotal": 25.55,
    "medianAbsErrorPpg": 1.6,
    "correlationTotal": 0.722,
    "correlationPpg": 0.736,
    "rankCorrelationTotal": 0.705,
    "gamesMae": 3.917,
    "availabilityMissCounts": {
      "accurate_games": 542,
      "overestimated_availability": 148,
      "underestimated_availability": 206,
      "major_availability_miss": 275,
      "low_actual_games": 197,
      "no_games_projection": 327
    },
    "hitRates": {
      "top12": 0.25,
      "top24": 0.375,
      "top36": 0.417
    }
  },
  "weighted_recent_ppg_plus_no_prior_priors": {
    "count": 1680,
    "maeTotal": 38.203,
    "maePpg": 2.338,
    "rmseTotal": 55.816,
    "rmsePpg": 3.249,
    "biasTotal": -1.917,
    "biasPpg": -0.118,
    "medianAbsErrorTotal": 24,
    "medianAbsErrorPpg": 1.7,
    "correlationTotal": 0.69,
    "correlationPpg": 0.689,
    "rankCorrelationTotal": 0.644,
    "gamesMae": 4.132,
    "availabilityMissCounts": {
      "accurate_games": 613,
      "overestimated_availability": 174,
      "underestimated_availability": 249,
      "major_availability_miss": 359,
      "low_actual_games": 285,
      "no_games_projection": 15
    },
    "hitRates": {
      "top12": 0.167,
      "top24": 0.375,
      "top36": 0.417
    }
  },
  "blackbird_v2": {
    "count": 1680,
    "maeTotal": 38.352,
    "maePpg": 2.362,
    "rmseTotal": 56.942,
    "rmsePpg": 3.297,
    "biasTotal": -6.11,
    "biasPpg": -0.05,
    "medianAbsErrorTotal": 22.8,
    "medianAbsErrorPpg": 1.7,
    "correlationTotal": 0.687,
    "correlationPpg": 0.695,
    "rankCorrelationTotal": 0.643,
    "gamesMae": 4.226,
    "availabilityMissCounts": {
      "accurate_games": 549,
      "overestimated_availability": 137,
      "underestimated_availability": 298,
      "major_availability_miss": 411,
      "low_actual_games": 285,
      "no_games_projection": 15
    },
    "hitRates": {
      "top12": 0.167,
      "top24": 0.417,
      "top36": 0.389
    }
  },
  "blackbird_v3": {
    "count": 1680,
    "maeTotal": 38.812,
    "maePpg": 2.383,
    "rmseTotal": 56.89,
    "rmsePpg": 3.323,
    "biasTotal": -6.345,
    "biasPpg": -0.248,
    "medianAbsErrorTotal": 24.65,
    "medianAbsErrorPpg": 1.7,
    "correlationTotal": 0.677,
    "correlationPpg": 0.684,
    "rankCorrelationTotal": 0.621,
    "gamesMae": 4.261,
    "availabilityMissCounts": {
      "accurate_games": 588,
      "overestimated_availability": 160,
      "underestimated_availability": 240,
      "major_availability_miss": 407,
      "low_actual_games": 285,
      "no_games_projection": 15
    },
    "hitRates": {
      "top12": 0.25,
      "top24": 0.375,
      "top36": 0.389
    }
  },
  "blackbird_expected_games_v4": {
    "count": 1680,
    "maeTotal": 37.928,
    "maePpg": 2.316,
    "rmseTotal": 55.915,
    "rmsePpg": 3.192,
    "biasTotal": -4.489,
    "biasPpg": 0.011,
    "medianAbsErrorTotal": 23.85,
    "medianAbsErrorPpg": 1.7,
    "correlationTotal": 0.69,
    "correlationPpg": 0.694,
    "rankCorrelationTotal": 0.64,
    "gamesMae": 4.197,
    "availabilityMissCounts": {
      "accurate_games": 577,
      "overestimated_availability": 138,
      "underestimated_availability": 271,
      "major_availability_miss": 409,
      "low_actual_games": 285,
      "no_games_projection": 15
    },
    "hitRates": {
      "top12": 0.167,
      "top24": 0.333,
      "top36": 0.417
    }
  },
  "blackbird_expected_games_v5_selective": {
    "count": 1680,
    "maeTotal": 37.973,
    "maePpg": 2.316,
    "rmseTotal": 55.938,
    "rmsePpg": 3.192,
    "biasTotal": -4.698,
    "biasPpg": 0.011,
    "medianAbsErrorTotal": 23.8,
    "medianAbsErrorPpg": 1.7,
    "correlationTotal": 0.69,
    "correlationPpg": 0.694,
    "rankCorrelationTotal": 0.636,
    "gamesMae": 4.213,
    "availabilityMissCounts": {
      "accurate_games": 556,
      "overestimated_availability": 149,
      "underestimated_availability": 290,
      "major_availability_miss": 400,
      "low_actual_games": 285,
      "no_games_projection": 15
    },
    "hitRates": {
      "top12": 0.167,
      "top24": 0.375,
      "top36": 0.417
    }
  },
  "blackbird_expected_games_v6_gated": {
    "count": 1680,
    "maeTotal": 38.003,
    "maePpg": 2.316,
    "rmseTotal": 56.099,
    "rmsePpg": 3.192,
    "biasTotal": -4.89,
    "biasPpg": 0.011,
    "medianAbsErrorTotal": 24,
    "medianAbsErrorPpg": 1.7,
    "correlationTotal": 0.689,
    "correlationPpg": 0.694,
    "rankCorrelationTotal": 0.631,
    "gamesMae": 4.239,
    "availabilityMissCounts": {
      "accurate_games": 585,
      "overestimated_availability": 131,
      "underestimated_availability": 268,
      "major_availability_miss": 411,
      "low_actual_games": 285,
      "no_games_projection": 15
    },
    "hitRates": {
      "top12": 0.167,
      "top24": 0.375,
      "top36": 0.417
    }
  },
  "blackbird_expected_games_v7_family_selective": {
    "count": 1680,
    "maeTotal": 38.003,
    "maePpg": 2.316,
    "rmseTotal": 56.099,
    "rmsePpg": 3.192,
    "biasTotal": -4.89,
    "biasPpg": 0.011,
    "medianAbsErrorTotal": 24,
    "medianAbsErrorPpg": 1.7,
    "correlationTotal": 0.689,
    "correlationPpg": 0.694,
    "rankCorrelationTotal": 0.631,
    "gamesMae": 4.239,
    "availabilityMissCounts": {
      "accurate_games": 585,
      "overestimated_availability": 131,
      "underestimated_availability": 268,
      "major_availability_miss": 411,
      "low_actual_games": 285,
      "no_games_projection": 15
    },
    "hitRates": {
      "top12": 0.167,
      "top24": 0.375,
      "top36": 0.417
    }
  },
  "blackbird_expected_games_v8_cohort_blend": {
    "count": 1680,
    "maeTotal": 38.143,
    "maePpg": 2.316,
    "rmseTotal": 55.741,
    "rmsePpg": 3.192,
    "biasTotal": -2.208,
    "biasPpg": 0.011,
    "medianAbsErrorTotal": 24.1,
    "medianAbsErrorPpg": 1.7,
    "correlationTotal": 0.692,
    "correlationPpg": 0.694,
    "rankCorrelationTotal": 0.639,
    "gamesMae": 4.137,
    "availabilityMissCounts": {
      "accurate_games": 553,
      "overestimated_availability": 182,
      "underestimated_availability": 306,
      "major_availability_miss": 354,
      "low_actual_games": 285,
      "no_games_projection": 15
    },
    "hitRates": {
      "top12": 0.167,
      "top24": 0.375,
      "top36": 0.417
    }
  },
  "blackbird_expected_games_v8_1_calibrated_gate": {
    "count": 1680,
    "maeTotal": 37.878,
    "maePpg": 2.316,
    "rmseTotal": 55.593,
    "rmsePpg": 3.192,
    "biasTotal": -3.311,
    "biasPpg": 0.011,
    "medianAbsErrorTotal": 23.9,
    "medianAbsErrorPpg": 1.7,
    "correlationTotal": 0.693,
    "correlationPpg": 0.694,
    "rankCorrelationTotal": 0.639,
    "gamesMae": 4.15,
    "availabilityMissCounts": {
      "accurate_games": 544,
      "overestimated_availability": 177,
      "underestimated_availability": 313,
      "major_availability_miss": 361,
      "low_actual_games": 285,
      "no_games_projection": 15
    },
    "hitRates": {
      "top12": 0.167,
      "top24": 0.375,
      "top36": 0.417
    }
  },
  "blackbird_expected_games_v8_2_high_impact_guardrail": {
    "count": 1680,
    "maeTotal": 37.865,
    "maePpg": 2.316,
    "rmseTotal": 55.585,
    "rmsePpg": 3.192,
    "biasTotal": -3.355,
    "biasPpg": 0.011,
    "medianAbsErrorTotal": 23.85,
    "medianAbsErrorPpg": 1.7,
    "correlationTotal": 0.693,
    "correlationPpg": 0.694,
    "rankCorrelationTotal": 0.64,
    "gamesMae": 4.15,
    "availabilityMissCounts": {
      "accurate_games": 544,
      "overestimated_availability": 177,
      "underestimated_availability": 313,
      "major_availability_miss": 361,
      "low_actual_games": 285,
      "no_games_projection": 15
    },
    "hitRates": {
      "top12": 0.167,
      "top24": 0.333,
      "top36": 0.417
    }
  }
}
```

## PPG Component Findings

- weighted_recent_ppg_plus_baseline_games: PPG MAE delta 0; needs_cohort_split.
- weighted_recent_ppg_plus_availability_games: PPG MAE delta 0; keep_component.
- weighted_recent_ppg_plus_cohort_games: PPG MAE delta 0; keep_diagnostic_only.
- weighted_recent_ppg_plus_profile_ppg_adjustment: PPG MAE delta 0.08; remove_component.
- weighted_recent_ppg_plus_role_ppg_adjustment: PPG MAE delta -0.009; keep_diagnostic_only.
- weighted_recent_ppg_plus_no_prior_priors: PPG MAE delta 0.084; needs_cohort_split.
- blackbird_v2: PPG MAE delta 0.108; needs_cohort_split.
- blackbird_v3: PPG MAE delta 0.129; keep_diagnostic_only.
- blackbird_expected_games_v4: PPG MAE delta 0.062; needs_cohort_split.
- blackbird_expected_games_v5_selective: PPG MAE delta 0.062; needs_cohort_split.
- blackbird_expected_games_v6_gated: PPG MAE delta 0.062; needs_cohort_split.
- blackbird_expected_games_v7_family_selective: PPG MAE delta 0.062; needs_cohort_split.
- blackbird_expected_games_v8_cohort_blend: PPG MAE delta 0.062; needs_cohort_split.
- blackbird_expected_games_v8_1_calibrated_gate: PPG MAE delta 0.062; needs_cohort_split.
- blackbird_expected_games_v8_2_high_impact_guardrail: PPG MAE delta 0.062; needs_cohort_split.

## Games / Availability Component Findings

- weighted_recent_ppg_plus_baseline_games: total MAE delta 1.182, games MAE delta 0.329; needs_cohort_split.
- weighted_recent_ppg_plus_availability_games: total MAE delta -0.504, games MAE delta 0.117; keep_component.
- weighted_recent_ppg_plus_cohort_games: total MAE delta 0.474, games MAE delta 0.15; keep_diagnostic_only.
- blackbird_v2: total MAE delta -0.089, games MAE delta 0.309; needs_cohort_split.
- blackbird_v3: total MAE delta 0.371, games MAE delta 0.344; keep_diagnostic_only.
- blackbird_expected_games_v4: total MAE delta -0.513, games MAE delta 0.28; needs_cohort_split.
- blackbird_expected_games_v5_selective: total MAE delta -0.468, games MAE delta 0.296; needs_cohort_split.
- blackbird_expected_games_v6_gated: total MAE delta -0.438, games MAE delta 0.322; needs_cohort_split.
- blackbird_expected_games_v7_family_selective: total MAE delta -0.438, games MAE delta 0.322; needs_cohort_split.
- blackbird_expected_games_v8_cohort_blend: total MAE delta -0.298, games MAE delta 0.22; needs_cohort_split.
- blackbird_expected_games_v8_1_calibrated_gate: total MAE delta -0.563, games MAE delta 0.233; needs_cohort_split.
- blackbird_expected_games_v8_2_high_impact_guardrail: total MAE delta -0.576, games MAE delta 0.233; needs_cohort_split.

## No-Prior Component Findings

- No-prior prior variant recommendation: needs_cohort_split.
- No-prior cohort weighted MAE total: 92.8; no-prior prior MAE total: 37.336.

## Position-Level Findings

```json
{
  "DB": {
    "weighted_recent_ppg": {
      "count": 338,
      "maeTotal": 37.203,
      "maePpg": 2.112,
      "rmseTotal": 49.008,
      "rmsePpg": 2.847,
      "biasTotal": 1.873,
      "biasPpg": 0.103,
      "medianAbsErrorTotal": 27.95,
      "medianAbsErrorPpg": 1.7,
      "correlationTotal": 0.641,
      "correlationPpg": 0.585,
      "rankCorrelationTotal": 0.646,
      "gamesMae": 4.127,
      "availabilityMissCounts": {
        "accurate_games": 123,
        "overestimated_availability": 32,
        "underestimated_availability": 54,
        "major_availability_miss": 74,
        "low_actual_games": 55,
        "no_games_projection": 77
      },
      "hitRates": {
        "top12": 0.083,
        "top24": 0.333,
        "top36": 0.361
      }
    },
    "weighted_recent_ppg_plus_baseline_games": {
      "count": 338,
      "maeTotal": 37.396,
      "maePpg": 2.112,
      "rmseTotal": 50.257,
      "rmsePpg": 2.847,
      "biasTotal": 2.782,
      "biasPpg": 0.103,
      "medianAbsErrorTotal": 29.15,
      "medianAbsErrorPpg": 1.7,
      "correlationTotal": 0.643,
      "correlationPpg": 0.585,
      "rankCorrelationTotal": 0.641,
      "gamesMae": 4.432,
      "availabilityMissCounts": {
        "accurate_games": 105,
        "overestimated_availability": 49,
        "underestimated_availability": 57,
        "major_availability_miss": 72,
        "low_actual_games": 55,
        "no_games_projection": 77
      },
      "hitRates": {
        "top12": 0.083,
        "top24": 0.333,
        "top36": 0.306
      }
    },
    "weighted_recent_ppg_plus_availability_games": {
      "count": 338,
      "maeTotal": 36.369,
      "maePpg": 2.112,
      "rmseTotal": 48.772,
      "rmsePpg": 2.847,
      "biasTotal": -8.197,
      "biasPpg": 0.103,
      "medianAbsErrorTotal": 28.75,
      "medianAbsErrorPpg": 1.7,
      "correlationTotal": 0.639,
      "correlationPpg": 0.585,
      "rankCorrelationTotal": 0.643,
      "gamesMae": 4.287,
      "availabilityMissCounts": {
        "accurate_games": 103,
        "overestimated_availability": 28,
        "underestimated_availability": 72,
        "major_availability_miss": 80,
        "low_actual_games": 55,
        "no_games_projection": 77
      },
      "hitRates": {
        "top12": 0.083,
        "top24": 0.333,
        "top36": 0.389
      }
    },
    "weighted_recent_ppg_plus_cohort_games": {
      "count": 338,
      "maeTotal": 39.297,
      "maePpg": 2.112,
      "rmseTotal": 51.561,
      "rmsePpg": 2.847,
      "biasTotal": -2.367,
      "biasPpg": 0.103,
      "medianAbsErrorTotal": 29.85,
      "medianAbsErrorPpg": 1.7,
      "correlationTotal": 0.593,
      "correlationPpg": 0.585,
      "rankCorrelationTotal": 0.595,
      "gamesMae": 4.376,
      "availabilityMissCounts": {
        "accurate_games": 115,
        "overestimated_availability": 31,
        "underestimated_availability": 48,
        "major_availability_miss": 89,
        "low_actual_games": 55,
        "no_games_projection": 77
      },
      "hitRates": {
        "top12": 0.083,
        "top24": 0.333,
        "top36": 0.389
      }
    },
    "weighted_recent_ppg_plus_profile_ppg_adjustment": {
      "count": 338,
      "maeTotal": 37.61,
      "maePpg": 2.104,
      "rmseTotal": 49.486,
      "rmsePpg": 2.831,
      "biasTotal": 3.501,
      "biasPpg": 0.201,
      "medianAbsErrorTotal": 28.35,
      "medianAbsErrorPpg": 1.8,
      "correlationTotal": 0.64,
      "correlationPpg": 0.597,
      "rankCorrelationTotal": 0.645,
      "gamesMae": 4.127,
      "availabilityMissCounts": {
        "accurate_games": 123,
        "overestimated_availability": 32,
        "underestimated_availability": 54,
        "major_availability_miss": 74,
        "low_actual_games": 55,
        "no_games_projection": 77
      },
      "hitRates": {
        "top12": 0.083,
        "top24": 0.333,
        "top36": 0.361
      }
    },
    "weighted_recent_ppg_plus_role_ppg_adjustment": {
      "count": 338,
      "maeTotal": 36.864,
      "maePpg": 2.093,
      "rmseTotal": 48.689,
      "rmsePpg": 2.824,
      "biasTotal": 0.363,
      "biasPpg": -0.019,
      "medianAbsErrorTotal": 27.7,
      "medianAbsErrorPpg": 1.65,
      "correlationTotal": 0.641,
      "correlationPpg": 0.586,
      "rankCorrelationTotal": 0.647,
      "gamesMae": 4.127,
      "availabilityMissCounts": {
        "accurate_games": 123,
        "overestimated_availability": 32,
        "underestimated_availability": 54,
        "major_availability_miss": 74,
        "low_actual_games": 55,
        "no_games_projection": 77
      },
      "hitRates": {
        "top12": 0.083,
        "top24": 0.333,
        "top36": 0.361
      }
    },
    "weighted_recent_ppg_plus_no_prior_priors": {
      "count": 406,
      "maeTotal": 37.28,
      "maePpg": 2.279,
      "rmseTotal": 50.579,
      "rmsePpg": 3.077,
      "biasTotal": -3.444,
      "biasPpg": -0.393,
      "medianAbsErrorTotal": 26.55,
      "medianAbsErrorPpg": 1.8,
      "correlationTotal": 0.61,
      "correlationPpg": 0.524,
      "rankCorrelationTotal": 0.597,
      "gamesMae": 4.229,
      "availabilityMissCounts": {
        "accurate_games": 142,
        "overestimated_availability": 37,
        "underestimated_availability": 61,
        "major_availability_miss": 90,
        "low_actual_games": 76,
        "no_games_projection": 9
      },
      "hitRates": {
        "top12": 0.083,
        "top24": 0.292,
        "top36": 0.306
      }
    },
    "blackbird_v2": {
      "count": 406,
      "maeTotal": 36.564,
      "maePpg": 2.262,
      "rmseTotal": 50.589,
      "rmsePpg": 3.058,
      "biasTotal": -12.279,
      "biasPpg": -0.426,
      "medianAbsErrorTotal": 25.75,
      "medianAbsErrorPpg": 1.8,
      "correlationTotal": 0.613,
      "correlationPpg": 0.535,
      "rankCorrelationTotal": 0.599,
      "gamesMae": 4.35,
      "availabilityMissCounts": {
        "accurate_games": 120,
        "overestimated_availability": 32,
        "underestimated_availability": 82,
        "major_availability_miss": 96,
        "low_actual_games": 76,
        "no_games_projection": 9
      },
      "hitRates": {
        "top12": 0.083,
        "top24": 0.292,
        "top36": 0.333
      }
    },
    "blackbird_v3": {
      "count": 406,
      "maeTotal": 39.256,
      "maePpg": 2.355,
      "rmseTotal": 53.301,
      "rmsePpg": 3.19,
      "biasTotal": -9.652,
      "biasPpg": -0.639,
      "medianAbsErrorTotal": 29,
      "medianAbsErrorPpg": 1.9,
      "correlationTotal": 0.568,
      "correlationPpg": 0.511,
      "rankCorrelationTotal": 0.547,
      "gamesMae": 4.436,
      "availabilityMissCounts": {
        "accurate_games": 132,
        "overestimated_availability": 35,
        "underestimated_availability": 58,
        "major_availability_miss": 105,
        "low_actual_games": 76,
        "no_games_projection": 9
      },
      "hitRates": {
        "top12": 0.083,
        "top24": 0.292,
        "top36": 0.333
      }
    },
    "blackbird_expected_games_v4": {
      "count": 406,
      "maeTotal": 36.845,
      "maePpg": 2.225,
      "rmseTotal": 50.359,
      "rmsePpg": 3,
      "biasTotal": -6.794,
      "biasPpg": -0.301,
      "medianAbsErrorTotal": 26.9,
      "medianAbsErrorPpg": 1.8,
      "correlationTotal": 0.614,
      "correlationPpg": 0.534,
      "rankCorrelationTotal": 0.59,
      "gamesMae": 4.266,
      "availabilityMissCounts": {
        "accurate_games": 128,
        "overestimated_availability": 32,
        "underestimated_availability": 73,
        "major_availability_miss": 97,
        "low_actual_games": 76,
        "no_games_projection": 9
      },
      "hitRates": {
        "top12": 0.083,
        "top24": 0.292,
        "top36": 0.306
      }
    },
    "blackbird_expected_games_v5_selective": {
      "count": 406,
      "maeTotal": 36.845,
      "maePpg": 2.225,
      "rmseTotal": 50.359,
      "rmsePpg": 3,
      "biasTotal": -6.794,
      "biasPpg": -0.301,
      "medianAbsErrorTotal": 26.9,
      "medianAbsErrorPpg": 1.8,
      "correlationTotal": 0.614,
      "correlationPpg": 0.534,
      "rankCorrelationTotal": 0.59,
      "gamesMae": 4.266,
      "availabilityMissCounts": {
        "accurate_games": 128,
        "overestimated_availability": 32,
        "underestimated_availability": 73,
        "major_availability_miss": 97,
        "low_actual_games": 76,
        "no_games_projection": 9
      },
      "hitRates": {
        "top12": 0.083,
        "top24": 0.292,
        "top36": 0.306
      }
    },
    "blackbird_expected_games_v6_gated": {
      "count": 406,
      "maeTotal": 36.834,
      "maePpg": 2.225,
      "rmseTotal": 50.329,
      "rmsePpg": 3,
      "biasTotal": -6.8,
      "biasPpg": -0.301,
      "medianAbsErrorTotal": 26.9,
      "medianAbsErrorPpg": 1.8,
      "correlationTotal": 0.614,
      "correlationPpg": 0.534,
      "rankCorrelationTotal": 0.589,
      "gamesMae": 4.271,
      "availabilityMissCounts": {
        "accurate_games": 128,
        "overestimated_availability": 32,
        "underestimated_availability": 73,
        "major_availability_miss": 97,
        "low_actual_games": 76,
        "no_games_projection": 9
      },
      "hitRates": {
        "top12": 0.083,
        "top24": 0.292,
        "top36": 0.306
      }
    },
    "blackbird_expected_games_v7_family_selective": {
      "count": 406,
      "maeTotal": 36.834,
      "maePpg": 2.225,
      "rmseTotal": 50.329,
      "rmsePpg": 3,
      "biasTotal": -6.8,
      "biasPpg": -0.301,
      "medianAbsErrorTotal": 26.9,
      "medianAbsErrorPpg": 1.8,
      "correlationTotal": 0.614,
      "correlationPpg": 0.534,
      "rankCorrelationTotal": 0.589,
      "gamesMae": 4.271,
      "availabilityMissCounts": {
        "accurate_games": 128,
        "overestimated_availability": 32,
        "underestimated_availability": 73,
        "major_availability_miss": 97,
        "low_actual_games": 76,
        "no_games_projection": 9
      },
      "hitRates": {
        "top12": 0.083,
        "top24": 0.292,
        "top36": 0.306
      }
    },
    "blackbird_expected_games_v8_cohort_blend": {
      "count": 406,
      "maeTotal": 37.429,
      "maePpg": 2.225,
      "rmseTotal": 50.852,
      "rmsePpg": 3,
      "biasTotal": -4.468,
      "biasPpg": -0.301,
      "medianAbsErrorTotal": 27,
      "medianAbsErrorPpg": 1.8,
      "correlationTotal": 0.607,
      "correlationPpg": 0.534,
      "rankCorrelationTotal": 0.587,
      "gamesMae": 4.271,
      "availabilityMissCounts": {
        "accurate_games": 121,
        "overestimated_availability": 38,
        "underestimated_availability": 81,
        "major_availability_miss": 90,
        "low_actual_games": 76,
        "no_games_projection": 9
      },
      "hitRates": {
        "top12": 0.083,
        "top24": 0.292,
        "top36": 0.306
      }
    },
    "blackbird_expected_games_v8_1_calibrated_gate": {
      "count": 406,
      "maeTotal": 37.108,
      "maePpg": 2.225,
      "rmseTotal": 50.552,
      "rmsePpg": 3,
      "biasTotal": -5.617,
      "biasPpg": -0.301,
      "medianAbsErrorTotal": 27.1,
      "medianAbsErrorPpg": 1.8,
      "correlationTotal": 0.611,
      "correlationPpg": 0.534,
      "rankCorrelationTotal": 0.586,
      "gamesMae": 4.269,
      "availabilityMissCounts": {
        "accurate_games": 120,
        "overestimated_availability": 40,
        "underestimated_availability": 81,
        "major_availability_miss": 89,
        "low_actual_games": 76,
        "no_games_projection": 9
      },
      "hitRates": {
        "top12": 0.083,
        "top24": 0.25,
        "top36": 0.306
      }
    },
    "blackbird_expected_games_v8_2_high_impact_guardrail": {
      "count": 406,
      "maeTotal": 37.108,
      "maePpg": 2.225,
      "rmseTotal": 50.552,
      "rmsePpg": 3,
      "biasTotal": -5.617,
      "biasPpg": -0.301,
      "medianAbsErrorTotal": 27.1,
      "medianAbsErrorPpg": 1.8,
      "correlationTotal": 0.611,
      "correlationPpg": 0.534,
      "rankCorrelationTotal": 0.586,
      "gamesMae": 4.269,
      "availabilityMissCounts": {
        "accurate_games": 120,
        "overestimated_availability": 40,
        "underestimated_availability": 81,
        "major_availability_miss": 89,
        "low_actual_games": 76,
        "no_games_projection": 9
      },
      "hitRates": {
        "top12": 0.083,
        "top24": 0.25,
        "top36": 0.306
      }
    }
  },
  "DL": {
    "weighted_recent_ppg": {
      "count": 260,
      "maeTotal": 26.99,
      "maePpg": 1.619,
      "rmseTotal": 36.395,
      "rmsePpg": 2.11,
      "biasTotal": 0.933,
      "biasPpg": -0.072,
      "medianAbsErrorTotal": 20.7,
      "medianAbsErrorPpg": 1.25,
      "correlationTotal": 0.625,
      "correlationPpg": 0.585,
      "rankCorrelationTotal": 0.568,
      "gamesMae": 4.158,
      "availabilityMissCounts": {
        "accurate_games": 97,
        "overestimated_availability": 34,
        "underestimated_availability": 34,
        "major_availability_miss": 52,
        "low_actual_games": 43,
        "no_games_projection": 53
      },
      "hitRates": {
        "top12": 0.5,
        "top24": 0.542,
        "top36": 0.611
      }
    },
    "weighted_recent_ppg_plus_baseline_games": {
      "count": 260,
      "maeTotal": 28.484,
      "maePpg": 1.619,
      "rmseTotal": 38.372,
      "rmsePpg": 2.11,
      "biasTotal": 0.261,
      "biasPpg": -0.072,
      "medianAbsErrorTotal": 21,
      "medianAbsErrorPpg": 1.25,
      "correlationTotal": 0.588,
      "correlationPpg": 0.585,
      "rankCorrelationTotal": 0.549,
      "gamesMae": 4.377,
      "availabilityMissCounts": {
        "accurate_games": 94,
        "overestimated_availability": 37,
        "underestimated_availability": 24,
        "major_availability_miss": 62,
        "low_actual_games": 43,
        "no_games_projection": 53
      },
      "hitRates": {
        "top12": 0.417,
        "top24": 0.5,
        "top36": 0.528
      }
    },
    "weighted_recent_ppg_plus_availability_games": {
      "count": 260,
      "maeTotal": 26.731,
      "maePpg": 1.619,
      "rmseTotal": 35.995,
      "rmsePpg": 2.11,
      "biasTotal": -6.169,
      "biasPpg": -0.072,
      "medianAbsErrorTotal": 20.2,
      "medianAbsErrorPpg": 1.25,
      "correlationTotal": 0.624,
      "correlationPpg": 0.585,
      "rankCorrelationTotal": 0.57,
      "gamesMae": 4.242,
      "availabilityMissCounts": {
        "accurate_games": 87,
        "overestimated_availability": 21,
        "underestimated_availability": 52,
        "major_availability_miss": 57,
        "low_actual_games": 43,
        "no_games_projection": 53
      },
      "hitRates": {
        "top12": 0.417,
        "top24": 0.458,
        "top36": 0.556
      }
    },
    "weighted_recent_ppg_plus_cohort_games": {
      "count": 260,
      "maeTotal": 27.458,
      "maePpg": 1.619,
      "rmseTotal": 36.973,
      "rmsePpg": 2.11,
      "biasTotal": -0.666,
      "biasPpg": -0.072,
      "medianAbsErrorTotal": 20.9,
      "medianAbsErrorPpg": 1.25,
      "correlationTotal": 0.609,
      "correlationPpg": 0.585,
      "rankCorrelationTotal": 0.552,
      "gamesMae": 4.223,
      "availabilityMissCounts": {
        "accurate_games": 92,
        "overestimated_availability": 35,
        "underestimated_availability": 39,
        "major_availability_miss": 51,
        "low_actual_games": 43,
        "no_games_projection": 53
      },
      "hitRates": {
        "top12": 0.417,
        "top24": 0.542,
        "top36": 0.583
      }
    },
    "weighted_recent_ppg_plus_profile_ppg_adjustment": {
      "count": 260,
      "maeTotal": 27.326,
      "maePpg": 1.622,
      "rmseTotal": 36.722,
      "rmsePpg": 2.116,
      "biasTotal": 1.672,
      "biasPpg": -0.047,
      "medianAbsErrorTotal": 21.2,
      "medianAbsErrorPpg": 1.2,
      "correlationTotal": 0.624,
      "correlationPpg": 0.586,
      "rankCorrelationTotal": 0.568,
      "gamesMae": 4.158,
      "availab
```

## IDP-Specific Findings

- DL: weighted total MAE 26.99, v2 25.45, v3 26.18, v4 25.39, v5 25.395, v6 25.395, v7 25.395, v8 25.455, v8.1 25.333, v8.2 25.333.
- LB: weighted total MAE 41.58, v2 39.816, v3 40.501, v4 39.752, v5 39.801, v6 39.807, v7 39.807, v8 39.954, v8.1 39.884, v8.2 39.884.
- DB: weighted total MAE 37.203, v2 36.564, v3 39.256, v4 36.845, v5 36.845, v6 36.834, v7 36.834, v8 37.429, v8.1 37.108, v8.2 37.108.

## Top Helpful Components

- blackbird_expected_games_v8_2_high_impact_guardrail: blackbird_expected_games_v8_2_high_impact_guardrail total MAE delta -0.576, PPG MAE delta 0.062, games MAE delta 0.233 vs weighted_recent_ppg.
- blackbird_expected_games_v8_1_calibrated_gate: blackbird_expected_games_v8_1_calibrated_gate total MAE delta -0.563, PPG MAE delta 0.062, games MAE delta 0.233 vs weighted_recent_ppg.
- blackbird_expected_games_v4: blackbird_expected_games_v4 total MAE delta -0.513, PPG MAE delta 0.062, games MAE delta 0.28 vs weighted_recent_ppg.
- weighted_recent_ppg_plus_availability_games: weighted_recent_ppg_plus_availability_games total MAE delta -0.504, PPG MAE delta 0, games MAE delta 0.117 vs weighted_recent_ppg.
- blackbird_expected_games_v5_selective: blackbird_expected_games_v5_selective total MAE delta -0.468, PPG MAE delta 0.062, games MAE delta 0.296 vs weighted_recent_ppg.

## Top Harmful Components

- blackbird_v3: blackbird_v3 total MAE delta 0.371, PPG MAE delta 0.129, games MAE delta 0.344 vs weighted_recent_ppg.
- blackbird_v2: blackbird_v2 total MAE delta -0.089, PPG MAE delta 0.108, games MAE delta 0.309 vs weighted_recent_ppg.
- weighted_recent_ppg_plus_no_prior_priors: weighted_recent_ppg_plus_no_prior_priors total MAE delta -0.238, PPG MAE delta 0.084, games MAE delta 0.215 vs weighted_recent_ppg.
- weighted_recent_ppg_plus_profile_ppg_adjustment: weighted_recent_ppg_plus_profile_ppg_adjustment total MAE delta 1.451, PPG MAE delta 0.08, games MAE delta 0 vs weighted_recent_ppg.
- blackbird_expected_games_v4: blackbird_expected_games_v4 total MAE delta -0.513, PPG MAE delta 0.062, games MAE delta 0.28 vs weighted_recent_ppg.

## Component Recommendations

- weighted_recent_ppg_plus_baseline_games: needs_cohort_split. weighted_recent_ppg_plus_baseline_games total MAE delta 1.182, PPG MAE delta 0, games MAE delta 0.329 vs weighted_recent_ppg.
- weighted_recent_ppg_plus_availability_games: keep_component. weighted_recent_ppg_plus_availability_games total MAE delta -0.504, PPG MAE delta 0, games MAE delta 0.117 vs weighted_recent_ppg.
- weighted_recent_ppg_plus_cohort_games: keep_diagnostic_only. weighted_recent_ppg_plus_cohort_games total MAE delta 0.474, PPG MAE delta 0, games MAE delta 0.15 vs weighted_recent_ppg.
- weighted_recent_ppg_plus_profile_ppg_adjustment: remove_component. weighted_recent_ppg_plus_profile_ppg_adjustment total MAE delta 1.451, PPG MAE delta 0.08, games MAE delta 0 vs weighted_recent_ppg.
- weighted_recent_ppg_plus_role_ppg_adjustment: keep_diagnostic_only. weighted_recent_ppg_plus_role_ppg_adjustment total MAE delta -0.116, PPG MAE delta -0.009, games MAE delta 0 vs weighted_recent_ppg.
- weighted_recent_ppg_plus_no_prior_priors: needs_cohort_split. weighted_recent_ppg_plus_no_prior_priors total MAE delta -0.238, PPG MAE delta 0.084, games MAE delta 0.215 vs weighted_recent_ppg.
- blackbird_v2: needs_cohort_split. blackbird_v2 total MAE delta -0.089, PPG MAE delta 0.108, games MAE delta 0.309 vs weighted_recent_ppg.
- blackbird_v3: keep_diagnostic_only. blackbird_v3 total MAE delta 0.371, PPG MAE delta 0.129, games MAE delta 0.344 vs weighted_recent_ppg.
- blackbird_expected_games_v4: needs_cohort_split. blackbird_expected_games_v4 total MAE delta -0.513, PPG MAE delta 0.062, games MAE delta 0.28 vs weighted_recent_ppg.
- blackbird_expected_games_v5_selective: needs_cohort_split. blackbird_expected_games_v5_selective total MAE delta -0.468, PPG MAE delta 0.062, games MAE delta 0.296 vs weighted_recent_ppg.
- blackbird_expected_games_v6_gated: needs_cohort_split. blackbird_expected_games_v6_gated total MAE delta -0.438, PPG MAE delta 0.062, games MAE delta 0.322 vs weighted_recent_ppg.
- blackbird_expected_games_v7_family_selective: needs_cohort_split. blackbird_expected_games_v7_family_selective total MAE delta -0.438, PPG MAE delta 0.062, games MAE delta 0.322 vs weighted_recent_ppg.
- blackbird_expected_games_v8_cohort_blend: needs_cohort_split. blackbird_expected_games_v8_cohort_blend total MAE delta -0.298, PPG MAE delta 0.062, games MAE delta 0.22 vs weighted_recent_ppg.
- blackbird_expected_games_v8_1_calibrated_gate: needs_cohort_split. blackbird_expected_games_v8_1_calibrated_gate total MAE delta -0.563, PPG MAE delta 0.062, games MAE delta 0.233 vs weighted_recent_ppg.
- blackbird_expected_games_v8_2_high_impact_guardrail: needs_cohort_split. blackbird_expected_games_v8_2_high_impact_guardrail total MAE delta -0.576, PPG MAE delta 0.062, games MAE delta 0.233 vs weighted_recent_ppg.

## Recommended Next Model Recipe

- Keep weighted_recent_ppg as the PPG anchor until a component improves PPG MAE without material regressions.
- Use expected-games components only as diagnostic candidates; split by position before live integration.
- Remove broad profile PPG adjustment for now; it worsens PPG MAE in this backtest.
- Keep tiny role PPG adjustment diagnostic-only; the signal is promising but too small for live integration.
- Next model should test position-specific expected-games families before any PPG adjustment is reintroduced.

## Leakage Safety

- Ablation inputs are generated from historical profile seasons strictly before targetSeason.
- Target-season data is used only for actual outcomes and error calculations.
- This diagnostic is read-only and does not write to Supabase or mutate live projections.
