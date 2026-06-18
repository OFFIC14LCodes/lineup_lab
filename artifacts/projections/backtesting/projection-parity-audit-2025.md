# Projection Backtest Parity Audit 2025

Dry run: true
Read only: true
Include IDP: true

## Source Artifacts

- Backtest: C:\Projects\lineup_lab\artifacts\projections\backtesting\projection-backtest-2025.json
- Snapshot: C:\Projects\lineup_lab\artifacts\projections\backtesting\preseason-projection-snapshot-2025.json

## Row Universe

- Weighted rows: 1368
- v7 rows: 1680
- Shared rows: 1368
- Weighted-only rows: 0
- v7-only rows: 312

### v7-Only Row Explanation

```json
{
  "byPriorDataGroup": {
    "rookie": 278,
    "second_year": 20,
    "no_prior_stats": 14
  },
  "byCohort": {
    "idp_db": 68,
    "low_prior_sample": 312,
    "rookie_or_no_prior_nfl_data": 312,
    "low_actual_sample": 88,
    "idp_dl": 49,
    "kicker": 7,
    "idp_lb": 61,
    "offense_qb": 14,
    "offense_rb": 40,
    "offense_te": 22,
    "offense_wr": 51
  }
}
```

## Shared-Row Metrics

```json
{
  "count": 1368,
  "weightedMaePpg": 2.254,
  "v7MaePpg": 2.254,
  "weightedMaeGames": 3.917,
  "v7MaeGames": 3.919,
  "weightedMaeTotal": 38.441,
  "v7MaeTotal": 37.911,
  "v7DeltaMaePpg": 0,
  "v7DeltaMaeGames": 0.002,
  "v7DeltaMaeTotal": -0.53
}
```

## Comparison Protocol

- Shared weighted rows: Rows with both weighted_recent_ppg and v7 predictions. This is the apples-to-apples weighted baseline comparison.
- v7-only rows: Rows with v7 predictions but no weighted_recent_ppg prediction. These are kept in the report and compared only against the no-prior baseline protocol where eligible.
- No-prior baseline: A diagnostic-only low/no-prior expected-games baseline using conservative position priors for rookie, second-year low-prior, and no-prior-stat rows. It is not merged into weighted_recent_ppg and does not change projection outputs.
- No-prior merged into weighted comparison: false

## Evaluation Cohorts

### all_rows

- Description: All rows with any projection in the parity audit.
- Apples-to-apples weighted comparison: false
- Rows: 1695
- Weighted rows: 1368
- v7 rows: 1680
- Shared rows: 1368
- No-prior baseline rows: 392
- Weighted games MAE: 3.917
- v6 games MAE: 4.239
- v7 games MAE: 4.239
- v8 games MAE: 4.137
- v8.1 games MAE: 4.15
- v8.2 games MAE: 4.15
- No-prior baseline games MAE: 5.189
- v8 games MAE delta vs v7: -0.102
- v8.1 games MAE delta vs v7: -0.089
- v8.1 games MAE delta vs v8: 0.013
- v8.2 games MAE delta vs v7: -0.089
- v8.2 games MAE delta vs v8.1: 0
- v7 games MAE delta vs weighted: 0.322
- v8 games MAE delta vs weighted: 0.22
- v8.1 games MAE delta vs weighted: 0.233
- v8.2 games MAE delta vs weighted: 0.233
- v7 games MAE delta vs no-prior baseline: -0.95
- v8 games MAE delta vs no-prior baseline: -1.052
- v8.1 games MAE delta vs no-prior baseline: -1.039
- v8.2 games MAE delta vs no-prior baseline: -1.039
- v8 rows different from v7: 947
- v8 difference rate vs v7: 0.564
- v8.1 rows different from v7: 940
- v8.1 difference rate vs v7: 0.56
- v8.1 rows different from v8: 812
- v8.1 difference rate vs v8: 0.483
- v8.2 rows different from v7: 934
- v8.2 difference rate vs v7: 0.556
- v8.2 rows different from v8.1: 20
- v8.2 difference rate vs v8.1: 0.012
- Notes: None.

### shared_weighted_rows

- Description: Rows where weighted_recent_ppg and v7 both exist; apples-to-apples weighted baseline comparison.
- Apples-to-apples weighted comparison: true
- Rows: 1368
- Weighted rows: 1368
- v7 rows: 1368
- Shared rows: 1368
- No-prior baseline rows: 65
- Weighted games MAE: 3.917
- v6 games MAE: 3.919
- v7 games MAE: 3.919
- v8 games MAE: 3.867
- v8.1 games MAE: 3.871
- v8.2 games MAE: 3.871
- No-prior baseline games MAE: 4.738
- v8 games MAE delta vs v7: -0.052
- v8.1 games MAE delta vs v7: -0.048
- v8.1 games MAE delta vs v8: 0.004
- v8.2 games MAE delta vs v7: -0.048
- v8.2 games MAE delta vs v8.1: 0
- v7 games MAE delta vs weighted: 0.002
- v8 games MAE delta vs weighted: -0.05
- v8.1 games MAE delta vs weighted: -0.046
- v8.2 games MAE delta vs weighted: -0.046
- v7 games MAE delta vs no-prior baseline: -0.819
- v8 games MAE delta vs no-prior baseline: -0.871
- v8.1 games MAE delta vs no-prior baseline: -0.867
- v8.2 games MAE delta vs no-prior baseline: -0.867
- v8 rows different from v7: 814
- v8 difference rate vs v7: 0.595
- v8.1 rows different from v7: 807
- v8.1 difference rate vs v7: 0.59
- v8.1 rows different from v8: 708
- v8.1 difference rate vs v8: 0.518
- v8.2 rows different from v7: 801
- v8.2 difference rate vs v7: 0.586
- v8.2 rows different from v8.1: 20
- v8.2 difference rate vs v8.1: 0.015
- Notes: Valid weighted baseline vs v7 comparison.

### v7_only_rows

- Description: Rows with v7 but no weighted_recent_ppg; evaluated separately with the no-prior protocol where eligible.
- Apples-to-apples weighted comparison: false
- Rows: 312
- Weighted rows: 0
- v7 rows: 312
- Shared rows: 0
- No-prior baseline rows: 312
- Weighted games MAE: n/a
- v6 games MAE: 5.641
- v7 games MAE: 5.641
- v8 games MAE: 5.322
- v8.1 games MAE: 5.373
- v8.2 games MAE: 5.373
- No-prior baseline games MAE: 5.394
- v8 games MAE delta vs v7: -0.319
- v8.1 games MAE delta vs v7: -0.268
- v8.1 games MAE delta vs v8: 0.051
- v8.2 games MAE delta vs v7: -0.268
- v8.2 games MAE delta vs v8.1: 0
- v7 games MAE delta vs weighted: n/a
- v8 games MAE delta vs weighted: n/a
- v8.1 games MAE delta vs weighted: n/a
- v8.2 games MAE delta vs weighted: n/a
- v7 games MAE delta vs no-prior baseline: 0.247
- v8 games MAE delta vs no-prior baseline: -0.072
- v8.1 games MAE delta vs no-prior baseline: -0.021
- v8.2 games MAE delta vs no-prior baseline: -0.021
- v8 rows different from v7: 133
- v8 difference rate vs v7: 0.426
- v8.1 rows different from v7: 133
- v8.1 difference rate vs v7: 0.426
- v8.1 rows different from v8: 104
- v8.1 difference rate vs v8: 0.333
- v8.2 rows different from v7: 133
- v8.2 difference rate vs v7: 0.426
- v8.2 rows different from v8.1: 0
- v8.2 difference rate vs v8.1: 0
- Notes: Not apples-to-apples against weighted_recent_ppg; use no-prior baseline rows only.

### veteran_prior_sample

- Description: Veteran rows with enough prior sample for weighted recent comparisons.
- Apples-to-apples weighted comparison: true
- Rows: 1107
- Weighted rows: 1107
- v7 rows: 1107
- Shared rows: 1107
- No-prior baseline rows: 0
- Weighted games MAE: 3.823
- v6 games MAE: 3.816
- v7 games MAE: 3.816
- v8 games MAE: 3.791
- v8.1 games MAE: 3.788
- v8.2 games MAE: 3.788
- No-prior baseline games MAE: n/a
- v8 games MAE delta vs v7: -0.025
- v8.1 games MAE delta vs v7: -0.028
- v8.1 games MAE delta vs v8: -0.003
- v8.2 games MAE delta vs v7: -0.028
- v8.2 games MAE delta vs v8.1: 0
- v7 games MAE delta vs weighted: -0.007
- v8 games MAE delta vs weighted: -0.032
- v8.1 games MAE delta vs weighted: -0.035
- v8.2 games MAE delta vs weighted: -0.035
- v7 games MAE delta vs no-prior baseline: n/a
- v8 games MAE delta vs no-prior baseline: n/a
- v8.1 games MAE delta vs no-prior baseline: n/a
- v8.2 games MAE delta vs no-prior baseline: n/a
- v8 rows different from v7: 670
- v8 difference rate vs v7: 0.605
- v8.1 rows different from v7: 663
- v8.1 difference rate vs v7: 0.599
- v8.1 rows different from v8: 587
- v8.1 difference rate vs v8: 0.53
- v8.2 rows different from v7: 657
- v8.2 difference rate vs v7: 0.593
- v8.2 rows different from v8.1: 19
- v8.2 difference rate vs v8.1: 0.017
- Notes: None.

### rookie

- Description: Target-season rookie rows; not compared to weighted recent PPG unless weighted exists explicitly.
- Apples-to-apples weighted comparison: false
- Rows: 278
- Weighted rows: 0
- v7 rows: 278
- Shared rows: 0
- No-prior baseline rows: 278
- Weighted games MAE: n/a
- v6 games MAE: 5.921
- v7 games MAE: 5.921
- v8 games MAE: 5.555
- v8.1 games MAE: 5.605
- v8.2 games MAE: 5.605
- No-prior baseline games MAE: 5.612
- v8 games MAE delta vs v7: -0.366
- v8.1 games MAE delta vs v7: -0.316
- v8.1 games MAE delta vs v8: 0.05
- v8.2 games MAE delta vs v7: -0.316
- v8.2 games MAE delta vs v8.1: 0
- v7 games MAE delta vs weighted: n/a
- v8 games MAE delta vs weighted: n/a
- v8.1 games MAE delta vs weighted: n/a
- v8.2 games MAE delta vs weighted: n/a
- v7 games MAE delta vs no-prior baseline: 0.309
- v8 games MAE delta vs no-prior baseline: -0.057
- v8.1 games MAE delta vs no-prior baseline: -0.007
- v8.2 games MAE delta vs no-prior baseline: -0.007
- v8 rows different from v7: 110
- v8 difference rate vs v7: 0.396
- v8.1 rows different from v7: 110
- v8.1 difference rate vs v7: 0.396
- v8.1 rows different from v8: 87
- v8.1 difference rate vs v8: 0.313
- v8.2 rows different from v7: 110
- v8.2 difference rate vs v7: 0.396
- v8.2 rows different from v8.1: 0
- v8.2 difference rate vs v8.1: 0
- Notes: Low/no-prior cohort. No-prior baseline is diagnostic-only and separate from weighted_recent_ppg.

### second_year_low_prior

- Description: Second-year players with low prior sample; requires separate low-prior interpretation.
- Apples-to-apples weighted comparison: false
- Rows: 95
- Weighted rows: 65
- v7 rows: 85
- Shared rows: 65
- No-prior baseline rows: 95
- Weighted games MAE: 4.954
- v6 games MAE: 4.718
- v7 games MAE: 4.718
- v8 games MAE: 4.402
- v8.1 games MAE: 4.447
- v8.2 games MAE: 4.453
- No-prior baseline games MAE: 4.347
- v8 games MAE delta vs v7: -0.316
- v8.1 games MAE delta vs v7: -0.271
- v8.1 games MAE delta vs v8: 0.045
- v8.2 games MAE delta vs v7: -0.265
- v8.2 games MAE delta vs v8.1: 0.006
- v7 games MAE delta vs weighted: -0.236
- v8 games MAE delta vs weighted: -0.552
- v8.1 games MAE delta vs weighted: -0.507
- v8.2 games MAE delta vs weighted: -0.501
- v7 games MAE delta vs no-prior baseline: 0.371
- v8 games MAE delta vs no-prior baseline: 0.055
- v8.1 games MAE delta vs no-prior baseline: 0.1
- v8.2 games MAE delta vs no-prior baseline: 0.106
- v8 rows different from v7: 65
- v8 difference rate vs v7: 0.765
- v8.1 rows different from v7: 65
- v8.1 difference rate vs v7: 0.765
- v8.1 rows different from v8: 56
- v8.1 difference rate vs v8: 0.659
- v8.2 rows different from v7: 65
- v8.2 difference rate vs v7: 0.765
- v8.2 rows different from v8.1: 1
- v8.2 difference rate vs v8.1: 0.012
- Notes: Low/no-prior cohort. No-prior baseline is diagnostic-only and separate from weighted_recent_ppg.

### no_prior_stats

- Description: Rows with no prior NFL stat sample.
- Apples-to-apples weighted comparison: false
- Rows: 19
- Weighted rows: 0
- v7 rows: 14
- Shared rows: 0
- No-prior baseline rows: 19
- Weighted games MAE: n/a
- v6 games MAE: 3.286
- v7 games MAE: 3.286
- v8 games MAE: 3.429
- v8.1 games MAE: 3.486
- v8.2 games MAE: 3.486
- No-prior baseline games MAE: 3.211
- v8 games MAE delta vs v7: 0.143
- v8.1 games MAE delta vs v7: 0.2
- v8.1 games MAE delta vs v8: 0.057
- v8.2 games MAE delta vs v7: 0.2
- v8.2 games MAE delta vs v8.1: 0
- v7 games MAE delta vs weighted: n/a
- v8 games MAE delta vs weighted: n/a
- v8.1 games MAE delta vs weighted: n/a
- v8.2 games MAE delta vs weighted: n/a
- v7 games MAE delta vs no-prior baseline: 0.075
- v8 games MAE delta vs no-prior baseline: 0.218
- v8.1 games MAE delta vs no-prior baseline: 0.275
- v8.2 games MAE delta vs no-prior baseline: 0.275
- v8 rows different from v7: 10
- v8 difference rate vs v7: 0.714
- v8.1 rows different from v7: 10
- v8.1 difference rate vs v7: 0.714
- v8.1 rows different from v8: 7
- v8.1 difference rate vs v8: 0.5
- v8.2 rows different from v7: 10
- v8.2 difference rate vs v7: 0.714
- v8.2 rows different from v8.1: 0
- v8.2 difference rate vs v8.1: 0
- Notes: Low/no-prior cohort. No-prior baseline is diagnostic-only and separate from weighted_recent_ppg.

### low_prior_sample

- Description: Rows with limited career-to-date games before the target season.
- Apples-to-apples weighted comparison: false
- Rows: 458
- Weighted rows: 131
- v7 rows: 443
- Shared rows: 131
- No-prior baseline rows: 392
- Weighted games MAE: 4.863
- v6 games MAE: 5.456
- v7 games MAE: 5.456
- v8 games MAE: 5.111
- v8.1 games MAE: 5.179
- v8.2 games MAE: 5.18
- No-prior baseline games MAE: 5.189
- v8 games MAE delta vs v7: -0.345
- v8.1 games MAE delta vs v7: -0.277
- v8.1 games MAE delta vs v8: 0.068
- v8.2 games MAE delta vs v7: -0.276
- v8.2 games MAE delta vs v8.1: 0.001
- v7 games MAE delta vs weighted: 0.593
- v8 games MAE delta vs weighted: 0.248
- v8.1 games MAE delta vs weighted: 0.316
- v8.2 games MAE delta vs weighted: 0.317
- v7 games MAE delta vs no-prior baseline: 0.267
- v8 games MAE delta vs no-prior baseline: -0.078
- v8.1 games MAE delta vs no-prior baseline: -0.01
- v8.2 games MAE delta vs no-prior baseline: -0.009
- v8 rows different from v7: 226
- v8 difference rate vs v7: 0.51
- v8.1 rows different from v7: 226
- v8.1 difference rate vs v7: 0.51
- v8.1 rows different from v8: 189
- v8.1 difference rate vs v8: 0.427
- v8.2 rows different from v7: 226
- v8.2 difference rate vs v7: 0.51
- v8.2 rows different from v8.1: 1
- v8.2 difference rate vs v8.1: 0.002
- Notes: None.

### te_fallback

- Description: TE rows where v7 used the hard baseline fallback.
- Apples-to-apples weighted comparison: true
- Rows: 112
- Weighted rows: 112
- v7 rows: 112
- Shared rows: 112
- No-prior baseline rows: 6
- Weighted games MAE: 3.17
- v6 games MAE: 3.17
- v7 games MAE: 3.17
- v8 games MAE: 3.17
- v8.1 games MAE: 3.17
- v8.2 games MAE: 3.17
- No-prior baseline games MAE: 3
- v8 games MAE delta vs v7: 0
- v8.1 games MAE delta vs v7: 0
- v8.1 games MAE delta vs v8: 0
- v8.2 games MAE delta vs v7: 0
- v8.2 games MAE delta vs v8.1: 0
- v7 games MAE delta vs weighted: 0
- v8 games MAE delta vs weighted: 0
- v8.1 games MAE delta vs weighted: 0
- v8.2 games MAE delta vs weighted: 0
- v7 games MAE delta vs no-prior baseline: 0.17
- v8 games MAE delta vs no-prior baseline: 0.17
- v8.1 games MAE delta vs no-prior baseline: 0.17
- v8.2 games MAE delta vs no-prior baseline: 0.17
- v8 rows different from v7: 0
- v8 difference rate vs v7: 0
- v8.1 rows different from v7: 0
- v8.1 difference rate vs v7: 0
- v8.1 rows different from v8: 0
- v8.1 difference rate vs v8: 0
- v8.2 rows different from v7: 0
- v8.2 difference rate vs v7: 0
- v8.2 rows different from v8.1: 0
- v8.2 difference rate vs v8.1: 0
- Notes: None.

### k_fallback

- Description: K rows where v7 used the hard baseline fallback.
- Apples-to-apples weighted comparison: true
- Rows: 35
- Weighted rows: 35
- v7 rows: 35
- Shared rows: 35
- No-prior baseline rows: 2
- Weighted games MAE: 2.429
- v6 games MAE: 2.429
- v7 games MAE: 2.429
- v8 games MAE: 2.429
- v8.1 games MAE: 2.429
- v8.2 games MAE: 2.429
- No-prior baseline games MAE: 5.5
- v8 games MAE delta vs v7: 0
- v8.1 games MAE delta vs v7: 0
- v8.1 games MAE delta vs v8: 0
- v8.2 games MAE delta vs v7: 0
- v8.2 games MAE delta vs v8.1: 0
- v7 games MAE delta vs weighted: 0
- v8 games MAE delta vs weighted: 0
- v8.1 games MAE delta vs weighted: 0
- v8.2 games MAE delta vs weighted: 0
- v7 games MAE delta vs no-prior baseline: -3.071
- v8 games MAE delta vs no-prior baseline: -3.071
- v8.1 games MAE delta vs no-prior baseline: -3.071
- v8.2 games MAE delta vs no-prior baseline: -3.071
- v8 rows different from v7: 0
- v8 difference rate vs v7: 0
- v8.1 rows different from v7: 0
- v8.1 difference rate vs v7: 0
- v8.1 rows different from v8: 0
- v8.1 difference rate vs v8: 0
- v8.2 rows different from v7: 0
- v8.2 difference rate vs v7: 0
- v8.2 rows different from v8.1: 0
- v8.2 difference rate vs v8.1: 0
- Notes: None.

### idp

- Description: DL/LB/DB rows.
- Apples-to-apples weighted comparison: false
- Rows: 1033
- Weighted rows: 840
- v7 rows: 1018
- Shared rows: 840
- No-prior baseline rows: 236
- Weighted games MAE: 4.064
- v6 games MAE: 4.25
- v7 games MAE: 4.25
- v8 games MAE: 4.222
- v8.1 games MAE: 4.226
- v8.2 games MAE: 4.226
- No-prior baseline games MAE: 4.979
- v8 games MAE delta vs v7: -0.028
- v8.1 games MAE delta vs v7: -0.024
- v8.1 games MAE delta vs v8: 0.004
- v8.2 games MAE delta vs v7: -0.024
- v8.2 games MAE delta vs v8.1: 0
- v7 games MAE delta vs weighted: 0.186
- v8 games MAE delta vs weighted: 0.158
- v8.1 games MAE delta vs weighted: 0.162
- v8.2 games MAE delta vs weighted: 0.162
- v7 games MAE delta vs no-prior baseline: -0.729
- v8 games MAE delta vs no-prior baseline: -0.757
- v8.1 games MAE delta vs no-prior baseline: -0.753
- v8.2 games MAE delta vs no-prior baseline: -0.753
- v8 rows different from v7: 484
- v8 difference rate vs v7: 0.475
- v8.1 rows different from v7: 482
- v8.1 difference rate vs v7: 0.473
- v8.1 rows different from v8: 477
- v8.1 difference rate vs v8: 0.469
- v8.2 rows different from v7: 482
- v8.2 difference rate vs v7: 0.473
- v8.2 rows different from v8.1: 0
- v8.2 difference rate vs v8.1: 0
- Notes: None.

### offense

- Description: QB/RB/WR/TE rows.
- Apples-to-apples weighted comparison: false
- Rows: 620
- Weighted rows: 493
- v7 rows: 620
- Shared rows: 493
- No-prior baseline rows: 147
- Weighted games MAE: 3.773
- v6 games MAE: 4.286
- v7 games MAE: 4.286
- v8 games MAE: 4.077
- v8.1 games MAE: 4.103
- v8.2 games MAE: 4.104
- No-prior baseline games MAE: 5.456
- v8 games MAE delta vs v7: -0.209
- v8.1 games MAE delta vs v7: -0.183
- v8.1 games MAE delta vs v8: 0.026
- v8.2 games MAE delta vs v7: -0.182
- v8.2 games MAE delta vs v8.1: 0.001
- v7 games MAE delta vs weighted: 0.513
- v8 games MAE delta vs weighted: 0.304
- v8.1 games MAE delta vs weighted: 0.33
- v8.2 games MAE delta vs weighted: 0.331
- v7 games MAE delta vs no-prior baseline: -1.17
- v8 games MAE delta vs no-prior baseline: -1.379
- v8.1 games MAE delta vs no-prior baseline: -1.353
- v8.2 games MAE delta vs no-prior baseline: -1.352
- v8 rows different from v7: 456
- v8 difference rate vs v7: 0.735
- v8.1 rows different from v7: 451
- v8.1 difference rate vs v7: 0.727
- v8.1 rows different from v8: 335
- v8.1 difference rate vs v8: 0.54
- v8.2 rows different from v7: 445
- v8.2 difference rate vs v7: 0.718
- v8.2 rows different from v8.1: 20
- v8.2 difference rate vs v8.1: 0.032
- Notes: None.

### kicker

- Description: K rows.
- Apples-to-apples weighted comparison: false
- Rows: 42
- Weighted rows: 35
- v7 rows: 42
- Shared rows: 35
- No-prior baseline rows: 9
- Weighted games MAE: 2.429
- v6 games MAE: 3.262
- v7 games MAE: 3.262
- v8 games MAE: 2.976
- v8.1 games MAE: 2.976
- v8.2 games MAE: 2.976
- No-prior baseline games MAE: 6.333
- v8 games MAE delta vs v7: -0.286
- v8.1 games MAE delta vs v7: -0.286
- v8.1 games MAE delta vs v8: 0
- v8.2 games MAE delta vs v7: -0.286
- v8.2 games MAE delta vs v8.1: 0
- v7 games MAE delta vs weighted: 0.833
- v8 games MAE delta vs weighted: 0.547
- v8.1 games MAE delta vs weighted: 0.547
- v8.2 games MAE delta vs weighted: 0.547
- v7 games MAE delta vs no-prior baseline: -3.071
- v8 games MAE delta vs no-prior baseline: -3.357
- v8.1 games MAE delta vs no-prior baseline: -3.357
- v8.2 games MAE delta vs no-prior baseline: -3.357
- v8 rows different from v7: 7
- v8 difference rate vs v7: 0.167
- v8.1 rows different from v7: 7
- v8.1 difference rate vs v7: 0.167
- v8.1 rows different from v8: 0
- v8.1 difference rate vs v8: 0
- v8.2 rows different from v7: 7
- v8.2 difference rate vs v7: 0.167
- v8.2 rows different from v8.1: 0
- v8.2 difference rate vs v8.1: 0
- Notes: None.

## PPG Anchor Parity

- Compared rows: 1368
- Matched rows: 1368
- Mismatched rows: 0
- Average absolute diff: n/a
- Max absolute diff: n/a

## Games Baseline Parity

- Compared rows: 1368
- Matched rows: 832
- Mismatched rows: 536
- Baseline implementation mismatch rows: 0
- True model difference rows: 536
- Average absolute diff: 1.343
- Max absolute diff: 8

## TE Fallback Audit

- Rows: 112
- Fallback applied rows: 112
- Fallback missing rows: 0
- Baseline equivalent rows: 112
- Baseline mismatch rows: 0
- Weighted total MAE: 27.892
- v7 total MAE: 27.892
- v7 total MAE delta: 0

## K Fallback Audit

- Rows: 35
- Fallback applied rows: 35
- Fallback missing rows: 0
- Baseline equivalent rows: 35
- Baseline mismatch rows: 0
- Weighted total MAE: 24.837
- v7 total MAE: 24.837
- v7 total MAE delta: 0

## v6 vs v7 Identity Audit

- Compared rows: 1680
- Identical rows: 1680
- Different rows: 0
- Identical rate: 1

## v7 vs v8 Identity Audit

- Compared rows: 1680
- Identical rows: 733
- Different rows: 947
- Identical rate: 0.436
- Different rate: 0.564

### v7 vs v8 Difference Rates By Cohort

```json
{
  "all_rows": {
    "comparedRows": 1680,
    "differentRows": 947,
    "differentRate": 0.564
  },
  "idp": {
    "comparedRows": 1018,
    "differentRows": 484,
    "differentRate": 0.475
  },
  "k_fallback": {
    "comparedRows": 35,
    "differentRows": 0,
    "differentRate": 0
  },
  "kicker": {
    "comparedRows": 42,
    "differentRows": 7,
    "differentRate": 0.167
  },
  "low_prior_sample": {
    "comparedRows": 443,
    "differentRows": 226,
    "differentRate": 0.51
  },
  "no_prior_stats": {
    "comparedRows": 14,
    "differentRows": 10,
    "differentRate": 0.714
  },
  "offense": {
    "comparedRows": 620,
    "differentRows": 456,
    "differentRate": 0.735
  },
  "rookie": {
    "comparedRows": 278,
    "differentRows": 110,
    "differentRate": 0.396
  },
  "second_year_low_prior": {
    "comparedRows": 85,
    "differentRows": 65,
    "differentRate": 0.765
  },
  "shared_weighted_rows": {
    "comparedRows": 1368,
    "differentRows": 814,
    "differentRate": 0.595
  },
  "te_fallback": {
    "comparedRows": 112,
    "differentRows": 0,
    "differentRate": 0
  },
  "v7_only_rows": {
    "comparedRows": 312,
    "differentRows": 133,
    "differentRate": 0.426
  },
  "veteran_prior_sample": {
    "comparedRows": 1107,
    "differentRows": 670,
    "differentRate": 0.605
  }
}
```

## v7 vs v8.1 Identity Audit

- Compared rows: 1680
- Identical rows: 740
- Different rows: 940
- Identical rate: 0.44
- Different rate: 0.56

## v8 vs v8.1 Identity Audit

- Compared rows: 1680
- Identical rows: 868
- Different rows: 812
- Identical rate: 0.517
- Different rate: 0.483

## v8.1 vs v8.2 Identity Audit

- Compared rows: 1680
- Identical rows: 1660
- Different rows: 20
- Identical rate: 0.988
- Different rate: 0.012

### v8.1 vs v8.2 Difference Rates By Cohort

```json
{
  "all_rows": {
    "comparedRows": 1680,
    "differentRows": 20,
    "differentRate": 0.012
  },
  "idp": {
    "comparedRows": 1018,
    "differentRows": 0,
    "differentRate": 0
  },
  "k_fallback": {
    "comparedRows": 35,
    "differentRows": 0,
    "differentRate": 0
  },
  "kicker": {
    "comparedRows": 42,
    "differentRows": 0,
    "differentRate": 0
  },
  "low_prior_sample": {
    "comparedRows": 443,
    "differentRows": 1,
    "differentRate": 0.002
  },
  "no_prior_stats": {
    "comparedRows": 14,
    "differentRows": 0,
    "differentRate": 0
  },
  "offense": {
    "comparedRows": 620,
    "differentRows": 20,
    "differentRate": 0.032
  },
  "rookie": {
    "comparedRows": 278,
    "differentRows": 0,
    "differentRate": 0
  },
  "second_year_low_prior": {
    "comparedRows": 85,
    "differentRows": 1,
    "differentRate": 0.012
  },
  "shared_weighted_rows": {
    "comparedRows": 1368,
    "differentRows": 20,
    "differentRate": 0.015
  },
  "te_fallback": {
    "comparedRows": 112,
    "differentRows": 0,
    "differentRate": 0
  },
  "v7_only_rows": {
    "comparedRows": 312,
    "differentRows": 0,
    "differentRate": 0
  },
  "veteran_prior_sample": {
    "comparedRows": 1107,
    "differentRows": 19,
    "differentRate": 0.017
  }
}
```

## Root Causes

- row_universe_difference
- v6_v7_same_path

## Recommended Exact Fix Before v8

- Do not create v8 until the parity audit is clean or each intentional mismatch is explicitly accepted.
- Make the weighted baseline and candidate variants evaluate the same row universe, or report separate all-row and shared-row scorecards.
- Confirm v7 has at least one branch that differs from v6 before treating it as a new model; otherwise label it as a v6 alias.

## Top PPG Anchor Mismatches

None.

## Top Games Baseline Mismatches

- Braelon Allen RB: gamesBaselineDiff -8, weighted 17, v7 9
- Bucky Irving RB: gamesBaselineDiff -8, weighted 17, v7 9
- Ray Davis RB: gamesBaselineDiff -8, weighted 17, v7 9
- Tyrone Tracy RB: gamesBaselineDiff -8, weighted 17, v7 9
- Isaac Guerendo RB: gamesBaselineDiff -7, weighted 16, v7 9
- Taysom Hill QB: gamesBaselineDiff -7, weighted 12, v7 5
- Will Shipley RB: gamesBaselineDiff -7, weighted 16, v7 9
- Blake Corum RB: gamesBaselineDiff -6, weighted 15, v7 9
- Justin Fields QB: gamesBaselineDiff -5, weighted 12, v7 7
- Kenny Pickett QB: gamesBaselineDiff -5, weighted 10, v7 5
