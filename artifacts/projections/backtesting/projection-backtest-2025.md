# Projection Backtest 2025

Dry run: true
Read only: true
Scoring source: default
Scoring profile: Blackbird default dry-run profile scoring

## Dataset

- Players evaluated: 1695
- Players skipped: {"missingActuals":6626,"positionFiltered":0,"insufficientPositionSupport":0}
- Input seasons used: 2018, 2019, 2020, 2021, 2022, 2023, 2024
- Actual season used: 2025
- Target season excluded from input features: true

## Metrics Overall

```json
{
  "prior_season_ppg": {
    "count": 1368,
    "maeTotal": 38.12,
    "maePpg": 2.335,
    "rmseTotal": 55.013,
    "rmsePpg": 3.278,
    "biasTotal": 4.196,
    "biasPpg": 0.272,
    "medianAbsErrorTotal": 25.6,
    "medianAbsErrorPpg": 1.7,
    "correlationTotal": 0.73,
    "correlationPpg": 0.722,
    "rankCorrelationTotal": 0.712,
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
  "career_recent_blend": {
    "count": 1368,
    "maeTotal": 38.579,
    "maePpg": 2.26,
    "rmseTotal": 54.904,
    "rmsePpg": 3.101,
    "biasTotal": 4.108,
    "biasPpg": 0.368,
    "medianAbsErrorTotal": 26,
    "medianAbsErrorPpg": 1.7,
    "correlationTotal": 0.72,
    "correlationPpg": 0.733,
    "rankCorrelationTotal": 0.701,
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
      "top24": 0.417,
      "top36": 0.417
    }
  },
  "profile_informed_simple": {
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
  "blackbird_existing_projection": {
    "count": 1680,
    "maeTotal": 38.739,
    "maePpg": 2.347,
    "rmseTotal": 56.505,
    "rmsePpg": 3.259,
    "biasTotal": -0.187,
    "biasPpg": 0.036,
    "medianAbsErrorTotal": 24,
    "medianAbsErrorPpg": 1.7,
    "correlationTotal": 0.692,
    "correlationPpg": 0.698,
    "rankCorrelationTotal": 0.645,
    "gamesMae": 4.124,
    "availabilityMissCounts": {
      "accurate_games": 617,
      "overestimated_availability": 171,
      "underestimated_availability": 247,
      "major_availability_miss": 360,
      "low_actual_games": 285,
      "no_games_projection": 15
    },
    "hitRates": {
      "top12": 0.167,
      "top24": 0.375,
      "top36": 0.417
    }
  },
  "blackbird_availability_calibrated": {
    "count": 1680,
    "maeTotal": 38.322,
    "maePpg": 2.347,
    "rmseTotal": 56.729,
    "rmsePpg": 3.259,
    "biasTotal": -5.646,
    "biasPpg": 0.036,
    "medianAbsErrorTotal": 22.8,
    "medianAbsErrorPpg": 1.7,
    "correlationTotal": 0.688,
    "correlationPpg": 0.698,
    "rankCorrelationTotal": 0.645,
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
  "blackbird_no_prior_calibrated": {
    "count": 1680,
    "maeTotal": 38.705,
    "maePpg": 2.362,
    "rmseTotal": 56.731,
    "rmsePpg": 3.297,
    "biasTotal": -0.86,
    "biasPpg": -0.048,
    "medianAbsErrorTotal": 24,
    "medianAbsErrorPpg": 1.7,
    "correlationTotal": 0.691,
    "correlationPpg": 0.695,
    "rankCorrelationTotal": 0.646,
    "gamesMae": 4.124,
    "availabilityMissCounts": {
      "accurate_games": 617,
      "overestimated_availability": 171,
      "underestimated_availability": 247,
      "major_availability_miss": 360,
      "low_actual_games": 285,
      "no_games_projection": 15
    },
    "hitRates": {
      "top12": 0.167,
      "top24": 0.375,
      "top36": 0.417
    }
  },
  "blackbird_calibrated_v2": {
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
  "blackbird_cohort_games_calibrated": {
    "count": 1680,
    "maeTotal": 39.046,
    "maePpg": 2.347,
    "rmseTotal": 56.921,
    "rmsePpg": 3.259,
    "biasTotal": -3.449,
    "biasPpg": 0.036,
    "medianAbsErrorTotal": 24.4,
    "medianAbsErrorPpg": 1.7,
    "correlationTotal": 0.681,
    "correlationPpg": 0.698,
    "rankCorrelationTotal": 0.633,
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
  "blackbird_cohort_ppg_calibrated": {
    "count": 1680,
    "maeTotal": 38.304,
    "maePpg": 2.383,
    "rmseTotal": 56.246,
    "rmsePpg": 3.323,
    "biasTotal": -3.351,
    "biasPpg": -0.248,
    "medianAbsErrorTotal": 24.1,
    "medianAbsErrorPpg": 1.7,
    "correlationTotal": 0.689,
    "correlationPpg": 0.684,
    "rankCorrelationTotal": 0.634,
    "gamesMae": 4.124,
    "availabilityMissCounts": {
      "accurate_games": 617,
      "overestimated_availability": 171,
      "underestimated_availability": 247,
      "major_availability_miss": 360,
      "low_actual_games": 285,
      "no_games_projection": 15
    },
    "hitRates": {
      "top12": 0.167,
      "top24": 0.333,
      "top36": 0.417
    }
  },
  "blackbird_cohort_calibrated_v3": {
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

## Metrics By Position

```json
{
  "DB": {
    "prior_season_ppg": {
      "count": 338,
      "maeTotal": 36.033,
      "maePpg": 2.126,
      "rmseTotal": 48.682,
      "rmsePpg": 2.992,
      "biasTotal": 1.872,
      "biasPpg": 0.048,
      "medianAbsErrorTotal": 28.45,
      "medianAbsErrorPpg": 1.5,
      "correlationTotal": 0.659,
      "correlationPpg": 0.58,
      "rankCorrelationTotal": 0.657,
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
        "top12": 0.167,
        "top24": 0.417,
        "top36": 0.361
      }
    },
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
    "career_recent_blend": {
      "count": 338,
      "maeTotal": 37.343,
      "maePpg": 2.117,
      "rmseTotal": 49.127,
      "rmsePpg": 2.847,
      "biasTotal": 2.292,
      "biasPpg": 0.164,
      "medianAbsErrorTotal": 28.4,
      "medianAbsErrorPpg": 1.7,
      "correlationTotal": 0.636,
      "correlationPpg": 0.58,
      "rankCorrelationTotal": 0.641,
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
    "profile_informed_simple": {
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
    "blackbird_existing_projection": {
      "count": 406,
      "maeTotal": 37.092,
      "maePpg": 2.228,
      "rmseTotal": 50.132,
      "rmsePpg": 3.007,
      "biasTotal": -3.445,
      "biasPpg": -0.367,
      "medianAbsErrorTotal": 26.5,
      "medianAbsErrorPpg": 1.8,
      "correlationTotal": 0.615,
      "correlationPpg": 0.541,
      "rankCorrelationTotal": 0.6,
      "gamesMae": 4.2,
      "availabilityMissCounts": {
        "accurate_games": 144,
        "overestimated_availability": 35,
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
    "blackbird_availability_calibrated": {
      "count": 406,
      "maeTotal": 36.457,
      "maePpg": 2.228,
      "rmseTotal": 50.374,
      "rmsePpg": 3.007,
      "biasTotal": -11.892,
      "biasPpg": -0.367,
      "medianAbsErrorTotal": 25.4,
      "medianAbsErrorPpg": 1.8,
      "correlationTotal": 0.614,
      "correlationPpg": 0.541,
      "rankCorrelationTotal": 0.603,
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
    "blackbird_no_prior_calibrated": {
      "count": 406,
      "maeTotal": 37.136,
      "maePpg": 2.261,
      "rmseTotal": 50.344,
      "rmsePpg": 3.058,
      "biasTotal": -3.91,
      "biasPpg": -0.425,
      "medianAbsErrorTotal": 27.15,
      "medianAbsErrorPpg": 1.8,
      "correlationTotal": 0.614,
      "correlationPpg": 0.535,
      "rankCorrelationTotal": 0.599,
      "gamesMae": 4.2,
      "availabilityMissCounts": {
        "accurate_games": 144,
        "overestimated_availability": 35,
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
    "blackbird_calibrated_v2": {
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
    "blackbird_cohort_games_calibrated": {
      "count": 406,
      "maeTotal": 38.995,
      "maePpg": 2.228,
      "rmseTotal": 52.641,
      "rmsePpg": 3.007,
      "biasTotal": -7.065,
      "biasPpg": -0.367,
      "medianAbsErrorTotal": 28.4,
      "medianAbsErrorPpg": 1.8,
      "correlationTotal": 0.575,
      "correlationPpg": 0.541,
      "rankCorrelationTotal": 0.565,
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
    "blackbird_cohort_ppg_calibrated": {
      "count": 406,
      "maeTotal": 37.272,
      "maePpg": 2.355,
      "rmseTotal": 50.801,
      "rmsePpg": 3.19,
      "biasTotal": -6.307,
      "biasPpg": -0.639,
      "medianAbsErrorTotal": 27.6,
      "medianAbsErrorPpg": 1.9,
      "correlationTotal": 0.607,
      "correlationPpg": 0.511,
      "rankCorrelationTotal": 0.581,
      "gamesMae": 4.2,
      "availabilityMissCounts": {
        "accurate_games": 144,
        "overestimated_availability": 35,
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
    "blackbird_cohort_calibrated_v3": {
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
      "availabilityMissCounts
```

## Baselines

- Best baseline model: weighted_recent_ppg
- Worst baseline model: blackbird_cohort_ppg_calibrated

## Existing Blackbird Projection Source

- Requested: true
- Status: available
- Source: blackbird_projection_artifact
- Source path: C:\Projects\lineup_lab\artifacts\projections\backtesting\preseason-projection-snapshot-2025.json
- Leakage safe: true
- Source rows: 78470
- Matched rows: 1680
- Match coverage: 0.991
- Diagnostics:
  - checked:artifacts\projections\backtesting\preseason-projection-snapshot-2025.json
  - available:78470_rows

## Weighted Recent vs Blackbird Existing Projection

- Weighted recent MAE PPG: 2.254
- Weighted recent RMSE PPG: 3.091
- Existing Blackbird MAE PPG: 2.347
- Existing Blackbird RMSE PPG: 3.259
- Calibrated v2 MAE PPG: 2.362
- Calibrated v2 RMSE PPG: 3.297
- Cohort v3 MAE PPG: 2.383
- Cohort v3 RMSE PPG: 3.323
- Expected-games v4 MAE PPG: 2.316
- Expected-games v4 RMSE PPG: 3.192
- Expected-games v5 selective MAE PPG: 2.316
- Expected-games v5 selective RMSE PPG: 3.192
- Expected-games v6 gated MAE PPG: 2.316
- Expected-games v6 gated RMSE PPG: 3.192
- Expected-games v7 family selective MAE PPG: 2.316
- Expected-games v7 family selective RMSE PPG: 3.192
- Calibrated v2 beats weighted recent PPG MAE: false
- Cohort v3 beats weighted recent PPG MAE: false
- Cohort v3 beats weighted recent total MAE: false
- Expected-games v4 beats weighted recent PPG MAE: false
- Expected-games v4 beats weighted recent total MAE: true
- Expected-games v5 selective beats weighted recent PPG MAE: false
- Expected-games v5 selective beats weighted recent total MAE: true
- Expected-games v6 gated beats weighted recent PPG MAE: false
- Expected-games v6 gated beats weighted recent total MAE: true
- Expected-games v7 family selective beats weighted recent PPG MAE: false
- Expected-games v7 family selective beats weighted recent total MAE: true

## Do-No-Harm Gate

```json
{
  "recommendedForLiveIntegration": false,
  "ppgMaeDeltaVsWeightedRecent": 0.062,
  "totalMaeDeltaVsWeightedRecent": -0.438,
  "improvedPositions": 3,
  "badlyRegressedPositions": 1,
  "positionComparisons": {
    "DB": {
      "weightedMaePpg": 2.112,
      "v3MaePpg": 2.225,
      "delta": 0.113,
      "beatsWeightedRecent": false,
      "materiallyWorse": false
    },
    "DL": {
      "weightedMaePpg": 1.619,
      "v3MaePpg": 1.594,
      "delta": -0.025,
      "beatsWeightedRecent": true,
      "materiallyWorse": false
    },
    "K": {
      "weightedMaePpg": 1.197,
      "v3MaePpg": 1.274,
      "delta": 0.077,
      "beatsWeightedRecent": false,
      "materiallyWorse": false
    },
    "LB": {
      "weightedMaePpg": 2.307,
      "v3MaePpg": 2.293,
      "delta": -0.014,
      "beatsWeightedRecent": true,
      "materiallyWorse": false
    },
    "QB": {
      "weightedMaePpg": 4.722,
      "v3MaePpg": 4.729,
      "delta": 0.007,
      "beatsWeightedRecent": false,
      "materiallyWorse": false
    },
    "RB": {
      "weightedMaePpg": 2.696,
      "v3MaePpg": 2.955,
      "delta": 0.259,
      "beatsWeightedRecent": false,
      "materiallyWorse": true
    },
    "TE": {
      "weightedMaePpg": 1.847,
      "v3MaePpg": 2.025,
      "delta": 0.178,
      "beatsWeightedRecent": false,
      "materiallyWorse": false
    },
    "WR": {
      "weightedMaePpg": 2.573,
      "v3MaePpg": 2.515,
      "delta": -0.058,
      "beatsWeightedRecent": true,
      "materiallyWorse": false
    }
  },
  "verdict": "keep_diagnostic_only"
}
```

## Cohort Metrics

```json
{
  "idp_db": {
    "prior_season_ppg": {
      "count": 338,
      "maeTotal": 36.033,
      "maePpg": 2.126,
      "rmseTotal": 48.682,
      "rmsePpg": 2.992,
      "biasTotal": 1.872,
      "biasPpg": 0.048,
      "medianAbsErrorTotal": 28.45,
      "medianAbsErrorPpg": 1.5,
      "correlationTotal": 0.659,
      "correlationPpg": 0.58,
      "rankCorrelationTotal": 0.657,
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
        "top12": 0.167,
        "top24": 0.417,
        "top36": 0.361
      },
      "playersEvaluated": 415,
      "averageProjectedGames": 11.195,
      "averageActualGames": 10.234,
      "overprojectionCount": 179,
      "underprojectionCount": 154,
      "majorMissCount": 86
    },
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
      },
      "playersEvaluated": 415,
      "averageProjectedGames": 11.195,
      "averageActualGames": 10.234,
      "overprojectionCount": 184,
      "underprojectionCount": 152,
      "majorMissCount": 104
    },
    "career_recent_blend": {
      "count": 338,
      "maeTotal": 37.343,
      "maePpg": 2.117,
      "rmseTotal": 49.127,
      "rmsePpg": 2.847,
      "biasTotal": 2.292,
      "biasPpg": 0.164,
      "medianAbsErrorTotal": 28.4,
      "medianAbsErrorPpg": 1.7,
      "correlationTotal": 0.636,
      "correlationPpg": 0.58,
      "rankCorrelationTotal": 0.641,
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
      },
      "playersEvaluated": 415,
      "averageProjectedGames": 11.195,
      "averageActualGames": 10.234,
      "overprojectionCount": 184,
      "underprojectionCount": 152,
      "majorMissCount": 102
    },
    "profile_informed_simple": {
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
      },
      "playersEvaluated": 415,
      "averageProjectedGames": 11.195,
      "averageActualGames": 10.234,
      "overprojectionCount": 189,
      "underprojectionCount": 148,
      "majorMissCount": 104
    },
    "blackbird_existing_projection": {
      "count": 406,
      "maeTotal": 37.092,
      "maePpg": 2.228,
      "rmseTotal": 50.132,
      "rmsePpg": 3.007,
      "biasTotal": -3.445,
      "biasPpg": -0.367,
      "medianAbsErrorTotal": 26.5,
      "medianAbsErrorPpg": 1.8,
      "correlationTotal": 0.615,
      "correlationPpg": 0.541,
      "rankCorrelationTotal": 0.6,
      "gamesMae": 4.2,
      "availabilityMissCounts": {
        "accurate_games": 144,
        "overestimated_availability": 35,
        "underestimated_availability": 61,
        "major_availability_miss": 90,
        "low_actual_games": 76,
        "no_games_projection": 9
      },
      "hitRates": {
        "top12": 0.083,
        "top24": 0.292,
        "top36": 0.306
      },
      "playersEvaluated": 415,
      "averageProjectedGames": 10.589,
      "averageActualGames": 10.234,
      "overprojectionCount": 206,
      "underprojectionCount": 196,
      "majorMissCount": 115
    },
    "blackbird_availability_calibrated": {
      "count": 406,
      "maeTotal": 36.457,
      "maePpg": 2.228,
      "rmseTotal": 50.374,
      "rmsePpg": 3.007,
      "biasTotal": -11.892,
      "biasPpg": -0.367,
      "medianAbsErrorTotal": 25.4,
      "medianAbsErrorPpg": 1.8,
      "correlationTotal": 0.614,
      "correlationPpg": 0.541,
      "rankCorrelationTotal": 0.603,
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
      },
      "playersEvaluated": 415,
      "averageProjectedGames": 9.167,
      "averageActualGames": 10.234,
      "overprojectionCount": 174,
      "underprojectionCount": 229,
      "majorMissCount": 114
    },
    "blackbird_no_prior_calibrated": {
      "count": 406,
      "maeTotal": 37.136,
      "maePpg": 2.261,
      "rmseTotal": 50.344,
      "rmsePpg": 3.058,
      "biasTotal": -3.91,
      "biasPpg": -0.425,
      "medianAbsErrorTotal": 27.15,
      "medianAbsErrorPpg": 1.8,
      "correlationTotal": 0.614,
      "correlationPpg": 0.535,
      "rankCorrelationTotal": 0.599,
      "gamesMae": 4.2,
      "availabilityMissCounts": {
        "accurate_games": 144,
        "overestimated_availability": 35,
        "underestimated_availability": 61,
        "major_availability_miss": 90,
        "low_actual_games": 76,
        "no_games_projection": 9
      },
      "hitRates": {
        "top12": 0.083,
        "top24": 0.292,
        "top36": 0.306
      },
      "playersEvaluated": 415,
      "averageProjectedGames": 10.589,
      "averageActualGames": 10.234,
      "overprojectionCount": 206,
      "underprojectionCount": 196,
      "majorMissCount": 116
    },
    "blackbird_calibrated_v2": {
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
      },
      "playersEvaluated": 415,
      "averageProjectedGames": 9.167,
      "averageActualGames": 10.234,
      "overprojectionCount": 170,
      "underprojectionCount": 233,
      "majorMissCount": 115
    },
    "blackbird_cohort_games_calibrated": {
      "count": 406,
      "maeTotal": 38.995,
      "maePpg": 2.228,
      "rmseTotal": 52.641,
      "rmsePpg": 3.007,
      "biasTotal": -7.065,
      "biasPpg": -0.367,
      "medianAbsErrorTotal": 28.4,
      "medianAbsErrorPpg": 1.8,
      "correlationTotal": 0.575,
      "correlationPpg": 0.541,
      "rankCorrelationTotal": 0.565,
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
      },
      "playersEvaluated": 415,
      "averageProjectedGames": 9.943,
      "averageActualGames": 10.234,
      "overprojectionCount": 197,
      "underprojectionCount": 206,
      "majorMissCount": 123
    },
    "blackbird_cohort_ppg_calibrated": {
      "count": 406,
      "maeTotal": 37.272,
      "maePpg": 2.355,
      "rmseTotal": 50.801,
      "rmsePpg": 3.19,
      "biasTotal": -6.307,
      "biasPpg": -0.639,
      "medianAbsErrorTotal": 27.6,
      "medianAbsErrorPpg": 1.9,
      "correlationTotal": 0.607,
      "correlationPpg": 0.511,
      "rankCorrelationTotal": 0.581,
      "gamesMae": 4.2,
      "availabilityMissCounts": {
        "accurate_games": 144,
        "overestimated_availability": 35,
        "underestimated_availability": 61,
        "major_availability_miss": 90,
        "low_actual_games": 76,
        "no_games_projection": 9
      },
      "hitRates": {
        "top12": 0.083,
        "top24": 0.292,
        "top36": 0.306
      },
      "playersEvaluated": 415,
      "averageProjectedGames": 10.589,
      "averageActualGames": 10.234,
      "overprojectionCount": 196,
      "underprojectionCount": 207,
      "majorMissCount": 115
    },
    "blackbird_cohort_calibrated_v3": {
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
      },
      "playersEvaluated": 415,
      "averageProjectedGames": 9.943,
      "averageActualGames": 10.234,
      "overprojectionCount": 187,
      "underprojectionCount": 217,
      "majorMissCount": 122
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
      },
      "playersEvaluated": 415,
      "averageProjectedGames": 9.744,
      "averageActualGames": 10.234,
      "overprojectionCount": 195,
      "underprojectionCount": 209,
      "majorMissCount": 117
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
      },
      "playersEvaluated": 415,
      "averageProjectedGames": 9.744,
      "averageActualGames": 10.234,
      "overprojectionCount": 195,
      "underprojectionCount": 209,
      "majorMissCount": 117
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
      },
      "playersEvaluated": 415,
      "averageProjectedGames": 9.749,
      "averageActualGames": 10.234,
      "overprojectionCount": 196,
      "underprojectionCount": 208,
      "majorMissCount": 117
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
      },
      "playersEvaluated": 415,
      "averageProjectedGames": 9.749,
      "averageActualGames": 10.234,
      "overprojectionCount": 196,
      "underprojectionCount": 208,
      "majorMissCount": 117
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
      },
      "playersEvaluated": 415,
      "averageProjectedGames": 10.134,
      "averageActualGames": 10.234,
      "overprojectionCount": 207,
      "underprojectionCount": 198,
      "majorMissCount": 120
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
      },
      "playersEvaluated": 415,
      "averageProjectedGames": 9.947,
      "averageActualGames": 10.234,
      "overprojectionCount": 202,
      "underprojectionCount": 203,
      "majorMissCount": 120
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
      },
      "playersEvaluated": 415,
      "averageProjectedGames": 9.947,
      "averageActualGames": 10.234,
      "overprojectionCount": 202,
      "underprojectionCount": 203,
      "majorMissCount": 120
    }
  },
  "idp_dl": {
    "prior_season_ppg": {
      "count": 260,
      "maeTotal": 28.669,
      "maePpg": 1.782,
      "rmseTotal": 38.731,
      "rmsePpg": 2.336,
      "biasTotal": 1.851,
      "biasPpg": -0.021,
      "medianAbsErrorTotal": 22.25,
      "medianAbsErrorPpg": 1.4,
      "correlationTotal": 0.593,
      "correlationPpg": 0.525,
      "rankCorrelationTotal": 0.546,
      "gamesMae": 4.158,
      "avail
```

## V1 vs Calibrated V2

```json
{
  "v1": {
    "count": 1680,
    "maeTotal": 38.739,
    "maePpg": 2.347,
    "rmseTotal": 56.505,
    "rmsePpg": 3.259,
    "biasTotal": -0.187,
    "biasPpg": 0.036,
    "medianAbsErrorTotal": 24,
    "medianAbsErrorPpg": 1.7,
    "correlationTotal": 0.692,
    "correlationPpg": 0.698,
    "rankCorrelationTotal": 0.645,
    "gamesMae": 4.124,
    "availabilityMissCounts": {
      "accurate_games": 617,
      "overestimated_availability": 171,
      "underestimated_availability": 247,
      "major_availability_miss": 360,
      "low_actual_games": 285,
      "no_games_projection": 15
    },
    "hitRates": {
      "top12": 0.167,
      "top24": 0.375,
      "top36": 0.417
    }
  },
  "availabilityCalibrated": {
    "count": 1680,
    "maeTotal": 38.322,
    "maePpg": 2.347,
    "rmseTotal": 56.729,
    "rmsePpg": 3.259,
    "biasTotal": -5.646,
    "biasPpg": 0.036,
    "medianAbsErrorTotal": 22.8,
    "medianAbsErrorPpg": 1.7,
    "correlationTotal": 0.688,
    "correlationPpg": 0.698,
    "rankCorrelationTotal": 0.645,
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
  "noPriorCalibrated": {
    "count": 1680,
    "maeTotal": 38.705,
    "maePpg": 2.362,
    "rmseTotal": 56.731,
    "rmsePpg": 3.297,
    "biasTotal": -0.86,
    "biasPpg": -0.048,
    "medianAbsErrorTotal": 24,
    "medianAbsErrorPpg": 1.7,
    "correlationTotal": 0.691,
    "correlationPpg": 0.695,
    "rankCorrelationTotal": 0.646,
    "gamesMae": 4.124,
    "availabilityMissCounts": {
      "accurate_games": 617,
      "overestimated_availability": 171,
      "underestimated_availability": 247,
      "major_availability_miss": 360,
      "low_actual_games": 285,
      "no_games_projection": 15
    },
    "hitRates": {
      "top12": 0.167,
      "top24": 0.375,
      "top36": 0.417
    }
  },
  "calibratedV2": {
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
  "cohortGames": {
    "count": 1680,
    "maeTotal": 39.046,
    "maePpg": 2.347,
    "rmseTotal": 56.921,
    "rmsePpg": 3.259,
    "biasTotal": -3.449,
    "biasPpg": 0.036,
    "medianAbsErrorTotal": 24.4,
    "medianAbsErrorPpg": 1.7,
    "correlationTotal": 0.681,
    "correlationPpg": 0.698,
    "rankCorrelationTotal": 0.633,
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
  "cohortPpg": {
    "count": 1680,
    "maeTotal": 38.304,
    "maePpg": 2.383,
    "rmseTotal": 56.246,
    "rmsePpg": 3.323,
    "biasTotal": -3.351,
    "biasPpg": -0.248,
    "medianAbsErrorTotal": 24.1,
    "medianAbsErrorPpg": 1.7,
    "correlationTotal": 0.689,
    "correlationPpg": 0.684,
    "rankCorrelationTotal": 0.634,
    "gamesMae": 4.124,
    "availabilityMissCounts": {
      "accurate_games": 617,
      "overestimated_availability": 171,
      "underestimated_availability": 247,
      "major_availability_miss": 360,
      "low_actual_games": 285,
      "no_games_projection": 15
    },
    "hitRates": {
      "top12": 0.167,
      "top24": 0.333,
      "top36": 0.417
    }
  },
  "cohortV3": {
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
  "expectedGamesV4": {
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
  "expectedGamesV5Selective": {
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
  "expectedGamesV6Gated": {
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
  "expectedGamesV7FamilySelective": {
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
  "weightedRecent": {
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
  }
}
```

## Availability / Expected Games

```json
{
  "model": "weighted_recent_ppg",
  "counts": {
    "low_actual_games": 197,
    "accurate_games": 542,
    "major_availability_miss": 275,
    "no_games_projection": 327,
    "underestimated_availability": 206,
    "overestimated_availability": 148
  },
  "averageGamesError": 0.357,
  "gamesMae": 3.917,
  "majorMissPlayers": 275
}
```

## Position-Family Decision Table

| Position | Model Used | Reason | Result vs weighted | Result vs v6 | Recommendation |
| --- | --- | --- | --- | --- | --- |
| QB | Starter-probability expected games | Clear/probable starters allowed; unstable/backup/no-prior QBs capped. | diagnostic volatility remains | v7 keeps QB capped vs v6 | Diagnostic only |
| RB | Expected-games enabled | Prior diagnostics improved RB total MAE. | improves 0.847 | improves 0 | Keep testing |
| WR | Role-gated expected-games enabled | Only medium/high role confidence receives expected-games adjustment. | improves 1.301 | improves 0 | Keep testing |
| TE | Hard baseline fallback | Prior expected-games variants materially regressed TE. | regresses 3.539 | improves 0 | Do not enable |
| K | Hard baseline/simple fallback | Prior expected-games variants materially regressed K. | regresses 4.099 | improves 0 | Do not enable |
| DL | IDP expected-games enabled | DL improved in prior expected-games diagnostics with rotational safeguards. | improves 1.595 | improves 0 | Keep testing |
| LB | IDP expected-games enabled | LB tackle-floor/full-time role signal is preserved. | improves 1.773 | improves 0 | Keep testing |
| DB | IDP expected-games enabled | DB uses tackle-floor/snap safeguards for volatility. | improves 0.369 | improves 0 | Keep testing |

## PPG vs Games Error Decomposition

```json
{
  "model": "weighted_recent_ppg",
  "averagePpgErrorComponent": 4.161,
  "averageGamesErrorComponent": -0.479,
  "averageCombinedError": 3.683,
  "ppgDrivenMisses": 779,
  "availabilityDrivenMisses": 572
}
```

## Rookie / No-Prior Groups

```json
{
  "role_change_warning": 1120,
  "rookie": 278,
  "one_prior_season": 53,
  "second_year": 225,
  "no_prior_stats": 19
}
```

## Overprojected Leaders

- Joe Milton QB: error PPG 18.1, predicted 21.2, actual 3.1
- Jimmy Garoppolo QB: error PPG 16, predicted 15.7, actual -0.3
- Anthony Richardson QB: error PPG 15, predicted 16.1, actual 1.1
- Joshua Dobbs QB: error PPG 15, predicted 15.5, actual 0.5
- Tanner McKee QB: error PPG 11.1, predicted 14.5, actual 3.4
- Zach Wilson QB: error PPG 10.7, predicted 11.1, actual 0.4
- Gardner Minshew QB: error PPG 10.3, predicted 10.2, actual -0.1
- Adam Thielen WR: error PPG 10.3, predicted 13.1, actual 2.8
- Tyrell Shavers WR: error PPG 9.9, predicted 13.9, actual 4
- Drew Lock QB: error PPG 9.8, predicted 9.8, actual 0

## Underprojected Leaders

- Keidron Smith DB: error PPG -20.7, predicted 1.3, actual 22
- Cedric Gray LB: error PPG -11.8, predicted 4.8, actual 16.6
- Tatum Bethune LB: error PPG -9.6, predicted 2, actual 11.6
- Devin White LB: error PPG -8.9, predicted 7.7, actual 16.6
- Drake Thomas LB: error PPG -8.9, predicted 1.5, actual 10.4
- Jake Tonges TE: error PPG -8.9, predicted 0, actual 8.9
- Kenneth Gainwell RB: error PPG -8.2, predicted 4.7, actual 12.9
- Jaxon Smith-Njigba WR: error PPG -7.9, predicted 12.6, actual 20.5
- Kemon Hall DB: error PPG -7.8, predicted 2.2, actual 10
- Eric Wilson LB: error PPG -7.6, predicted 5, actual 12.6

## Biggest Rank Misses

- Mike Hilton DB: predicted #58, actual #339, delta -281
- Julian Blackmon DB: predicted #54, actual #334, delta -280
- Damar Hamlin DB: predicted #129, actual #397, delta -268
- Damar Hamlin DB: predicted #130, actual #398, delta -268
- Richie Grant DB: predicted #139, actual #404, delta -265
- Kyzir White LB: predicted #21, actual #276, delta -255
- Amani Oruwariye DB: predicted #155, actual #407, delta -252
- Calijah Kancey DL: predicted #47, actual #296, delta -249
- Ty Okada DB: predicted #333, actual #86, delta 247
- Nahshon Wright DB: predicted #268, actual #28, delta 240

## IDP Calibration Summary

- Included: true
- IDP players evaluated: 1033
- Best IDP baseline model: weighted_recent_ppg
- IDP role labels: {"balanced":806,"insufficient_data":193,"tackle_floor":32,"big_play_dependent":2}
- Notes: IDP rows were scored with the selected scoring profile, including solo tackles and sacks when present.

## Rookie / Low-Sample Summary

- Low actual sample players: 197
- Insufficient prior data players: 327

## Data Leakage Prevention

- Target-season actual weekly scores and season summaries are used only in actual outcome and error metrics.
- Input features are built only from profile seasons strictly before targetSeason.
- Profile-wide metadata is limited to identity, warnings, and coverage diagnostics; numeric model inputs are prior-season/career-to-date only.

## Recommended Next Calibration Priorities

- Compare profile-informed baseline against persisted Blackbird projection outputs once target-season projection run selection is explicit.
- Add a true preseason availability model instead of using prior-season games as expected games.
- Build separate rookie and no-prior-data baselines using rookie enrichment and market-independent context.
- Calibrate injury/availability features because missed games drive large total-point errors.
