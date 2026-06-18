# Projection v8 Calibration Audit 2025

Dry run: true
Read only: true
Include IDP: true

## Source Artifacts

- Parity audit: C:\Projects\lineup_lab\artifacts\projections\backtesting\projection-parity-audit-2025.json
- Backtest: C:\Projects\lineup_lab\artifacts\projections\backtesting\projection-backtest-2025.json
- Snapshot: C:\Projects\lineup_lab\artifacts\projections\backtesting\preseason-projection-snapshot-2025.json

## v7 vs v8 Identity

- Compared rows: 1680
- Identical rows: 733
- Different rows: 947
- Different rate: 0.564

## v8.1 Identity

- v7/v8.1 compared rows: 1680
- v7/v8.1 different rows: 940
- v7/v8.1 different rate: 0.56
- v8/v8.1 compared rows: 1680
- v8/v8.1 different rows: 812
- v8/v8.1 different rate: 0.483

## v8.2 Identity

- v7/v8.2 compared rows: 1680
- v7/v8.2 different rows: 934
- v7/v8.2 different rate: 0.556
- v8.1/v8.2 compared rows: 1680
- v8.1/v8.2 different rows: 20
- v8.1/v8.2 different rate: 0.012

## Cohort Breakdown

| Segment | Rows | Games MAE v7 | v8 | v8.1 | v8.2 | v8.2 Games Delta vs v7 | Total MAE v7 | v8 | v8.1 | v8.2 | v8.2 Total Delta vs v7 | v8.2 Total Delta vs v8.1 | v8.2 RMSE Delta vs v7 | v8.2 Bias Delta vs v7 | v8.2 Diff vs v8.1 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| all_rows | 1680 | 4.239 | 4.137 | 4.15 | 4.15 | -0.089 | 38.003 | 38.143 | 37.878 | 37.865 | -0.138 | -0.013 | -0.514 | 1.535 | 20 |
| shared_weighted_rows | 1368 | 3.919 | 3.867 | 3.871 | 3.871 | -0.048 | 37.911 | 38.269 | 37.901 | 37.886 | -0.025 | -0.015 | -0.155 | 1.201 | 20 |
| v7_only_rows | 312 | 5.641 | 5.322 | 5.373 | 5.373 | -0.268 | 38.405 | 37.591 | 37.774 | 37.774 | -0.631 | 0 | -1.908 | 3.004 | 0 |
| veteran_prior_sample | 1107 | 3.816 | 3.791 | 3.788 | 3.788 | -0.028 | 39.199 | 39.503 | 39.228 | 39.218 | 0.019 | -0.01 | -0.148 | 1.112 | 19 |
| rookie | 278 | 5.921 | 5.555 | 5.605 | 5.605 | -0.316 | 41.085 | 40.122 | 40.291 | 40.291 | -0.794 | 0 | -2.04 | 3.094 | 0 |
| second_year_low_prior | 85 | 4.718 | 4.402 | 4.447 | 4.453 | -0.265 | 25.266 | 25.806 | 25.207 | 25.082 | -0.184 | -0.125 | -0.621 | 1.767 | 1 |
| no_prior_stats | 14 | 3.286 | 3.429 | 3.486 | 3.486 | 0.2 | 13.879 | 15.521 | 15.493 | 15.493 | 1.614 | 0 | 1.544 | 1.558 | 0 |
| low_prior_sample | 443 | 5.456 | 5.111 | 5.179 | 5.18 | -0.276 | 34.072 | 33.507 | 33.517 | 33.493 | -0.579 | -0.024 | -1.59 | 2.561 | 1 |
| te_fallback | 112 | 3.17 | 3.17 | 3.17 | 3.17 | 0 | 27.892 | 27.892 | 27.892 | 27.892 | 0 | 0 | 0 | 0 | 0 |
| k_fallback | 35 | 2.429 | 2.429 | 2.429 | 2.429 | 0 | 24.837 | 24.837 | 24.837 | 24.837 | 0 | 0 | 0 | 0 | 0 |
| idp | 1018 | 4.25 | 4.222 | 4.226 | 4.226 | -0.024 | 34.247 | 34.546 | 34.361 | 34.361 | 0.114 | 0 | 0.083 | 1.128 | 0 |
| offense | 620 | 4.286 | 4.077 | 4.103 | 4.104 | -0.182 | 44.784 | 44.788 | 44.375 | 44.34 | -0.444 | -0.035 | -1.139 | 2.038 | 20 |
| kicker | 42 | 3.262 | 2.976 | 2.976 | 2.976 | -0.286 | 28.936 | 27.221 | 27.221 | 27.221 | -1.715 | 0 | -3.459 | 4 | 0 |

## Position Breakdown

| Segment | Rows | Games MAE v7 | v8 | v8.1 | v8.2 | v8.2 Games Delta vs v7 | Total MAE v7 | v8 | v8.1 | v8.2 | v8.2 Total Delta vs v7 | v8.2 Total Delta vs v8.1 | v8.2 RMSE Delta vs v7 | v8.2 Bias Delta vs v7 | v8.2 Diff vs v8.1 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| QB | 82 | 3.651 | 3.257 | 3.401 | 3.402 | -0.249 | 68.133 | 69.539 | 68.13 | 67.87 | -0.263 | -0.26 | -1.459 | 4.549 | 14 |
| RB | 162 | 5.056 | 4.833 | 4.831 | 4.834 | -0.222 | 48.503 | 48.872 | 47.934 | 47.935 | -0.568 | 0.001 | -1.548 | 2.812 | 6 |
| WR | 242 | 4.326 | 4.08 | 4.101 | 4.101 | -0.225 | 41.778 | 41.001 | 41.048 | 41.048 | -0.73 | 0 | -0.827 | 1.115 | 0 |
| TE | 134 | 3.672 | 3.657 | 3.657 | 3.657 | -0.015 | 31.431 | 31.543 | 31.543 | 31.543 | 0.112 | 0 | -0.89 | 1.231 | 0 |
| K | 42 | 3.262 | 2.976 | 2.976 | 2.976 | -0.286 | 28.936 | 27.221 | 27.221 | 27.221 | -1.715 | 0 | -3.459 | 4 | 0 |
| DL | 309 | 4.286 | 4.217 | 4.225 | 4.225 | -0.061 | 25.395 | 25.455 | 25.333 | 25.333 | -0.062 | 0 | -0.116 | 2.001 | 0 |
| LB | 303 | 4.185 | 4.16 | 4.171 | 4.171 | -0.014 | 39.807 | 39.954 | 39.884 | 39.884 | 0.077 | 0 | 0.044 | 0.165 | 0 |
| DB | 406 | 4.271 | 4.271 | 4.269 | 4.269 | -0.002 | 36.834 | 37.429 | 37.108 | 37.108 | 0.274 | 0 | 0.223 | 1.183 | 0 |
| DST | 0 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 0 |

## PPG Buckets

| Segment | Rows | Games MAE v7 | v8 | v8.1 | v8.2 | v8.2 Games Delta vs v7 | Total MAE v7 | v8 | v8.1 | v8.2 | v8.2 Total Delta vs v7 | v8.2 Total Delta vs v8.1 | v8.2 RMSE Delta vs v7 | v8.2 Bias Delta vs v7 | v8.2 Diff vs v8.1 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0-5 PPG | 905 | 4.692 | 4.554 | 4.574 | 4.574 | -0.118 | 27.355 | 27.117 | 27.135 | 27.135 | -0.22 | 0 | -0.765 | 1.264 | 0 |
| 5-10 PPG | 552 | 3.85 | 3.799 | 3.797 | 3.797 | -0.053 | 42.83 | 43.158 | 42.79 | 42.79 | -0.04 | 0 | -0.495 | 1.906 | 0 |
| 10-15 PPG | 162 | 3.295 | 3.212 | 3.233 | 3.233 | -0.062 | 61.379 | 62.256 | 61.418 | 61.418 | 0.039 | 0 | -0.175 | 2.003 | 0 |
| 15-20 PPG | 53 | 3.577 | 3.542 | 3.523 | 3.528 | -0.049 | 89.917 | 90.879 | 89.677 | 89.591 | -0.326 | -0.086 | -0.074 | 1.119 | 17 |
| 20+ PPG | 8 | 3.25 | 2.95 | 3.2 | 3.225 | -0.025 | 92.25 | 101.625 | 94.313 | 92.238 | -0.012 | -2.075 | 0.205 | -0.013 | 3 |

## Adjustment Size Buckets

| Segment | Rows | Games MAE v7 | v8 | v8.1 | v8.2 | v8.2 Games Delta vs v7 | Total MAE v7 | v8 | v8.1 | v8.2 | v8.2 Total Delta vs v7 | v8.2 Total Delta vs v8.1 | v8.2 RMSE Delta vs v7 | v8.2 Bias Delta vs v7 | v8.2 Diff vs v8.1 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 746 | 3.969 | 3.971 | 3.969 | 3.969 | 0 | 36.945 | 36.982 | 36.954 | 36.945 | 0 | -0.009 | 0 | 0 | 6 |
| 0-0.5 | 543 | 4.02 | 4.008 | 4.019 | 4.02 | 0 | 40.495 | 41.029 | 40.697 | 40.671 | 0.176 | -0.026 | 0.089 | 1.33 | 14 |
| 0.5-1 | 182 | 4.022 | 3.797 | 3.834 | 3.834 | -0.188 | 29.174 | 28.72 | 28.561 | 28.561 | -0.613 | 0 | -0.862 | 1.624 | 0 |
| 1-2 | 73 | 5.219 | 4.47 | 4.604 | 4.604 | -0.615 | 40.489 | 39.926 | 38.956 | 38.956 | -1.533 | 0 | -2.912 | 5.974 | 0 |
| 2-4 | 136 | 6.353 | 5.84 | 5.84 | 5.84 | -0.513 | 44.34 | 44.64 | 43.576 | 43.576 | -0.764 | 0 | -3.454 | 8.275 | 0 |
| 4+ | 0 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 0 |

## Over/Under Correction

```json
{
  "v7UnderprojectionRows": 820,
  "v8ImprovedUnderprojectionRows": 363,
  "v8OvercorrectedRows": 50,
  "v8WorsenedUnderprojectionRows": 77,
  "v81ImprovedUnderprojectionRows": 371,
  "v81OvercorrectedRows": 26,
  "v81WorsenedUnderprojectionRows": 65,
  "v7OverprojectionRows": 847,
  "v8ImprovedOverprojectionRows": 129,
  "v8WorsenedOverprojectionRows": 363,
  "v8UndercorrectedRows": 11,
  "v81ImprovedOverprojectionRows": 127,
  "v81WorsenedOverprojectionRows": 361,
  "v81UndercorrectedRows": 6,
  "v82ImprovedUnderprojectionRows": 370,
  "v82OvercorrectedRows": 26,
  "v82WorsenedUnderprojectionRows": 64,
  "v82ImprovedOverprojectionRows": 127,
  "v82WorsenedOverprojectionRows": 357,
  "v82UndercorrectedRows": 6
}
```

## Top 10 Improvements

| Player | Pos | Cohorts | Actual G | v7 G | v8 G | v8.1 G | v8.2 G | Actual Pts | v7 Pts | v8.1 Pts | v8.2 Pts | v8.2 Abs Err Delta vs v7 | v8.2 Reason |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Tyrone Tracy | RB | all_rows shared_weighted_rows offense | 15 | 9 | 17 | 12 | 12 | 162.8 | 99 | 132 | 132 | -33 | V8.2 preserves v8.1 because no high-impact guardrail was triggered. |
| Justin Fields | QB | all_rows shared_weighted_rows veteran_prior_sample offense | 9 | 7 | 11 | 9 | 9 | 138.6 | 105 | 135 | 135 | -30 | V8.2 preserves v8.1 because no high-impact guardrail was triggered. |
| Tyrell Shavers | WR | all_rows shared_weighted_rows low_prior_sample offense | 12 | 1 | 4 | 3 | 3 | 47.9 | 13.9 | 41.7 | 41.7 | -27.8 | V8.2 preserves v8.1 for WR rows outside elite large-movement guardrail. |
| Jacoby Brissett | QB | all_rows shared_weighted_rows veteran_prior_sample offense | 14 | 5 | 8.3 | 8 | 8 | 233.4 | 46 | 73.6 | 73.6 | -27.6 | V8.2 preserves v8.1 because no high-impact guardrail was triggered. |
| Andre Szmyt | K | all_rows v7_only_rows second_year_low_prior low_prior_sample kicker | 17 | 8 | 12 | 12 | 12 | 93 | 48 | 72 | 72 | -24 | K fallback remains unchanged in v8.2. |
| Andy Borregales | K | all_rows v7_only_rows rookie low_prior_sample kicker | 21 | 8 | 12 | 12 | 12 | 145 | 48 | 72 | 72 | -24 | K fallback remains unchanged in v8.2. |
| Harrison Mevis | K | all_rows v7_only_rows rookie low_prior_sample kicker | 12 | 8 | 12 | 12 | 12 | 101 | 48 | 72 | 72 | -24 | K fallback remains unchanged in v8.2. |
| Ryan Fitzgerald | K | all_rows v7_only_rows rookie low_prior_sample kicker | 18 | 8 | 12 | 12 | 12 | 99 | 48 | 72 | 72 | -24 | K fallback remains unchanged in v8.2. |
| Tyler Loop | K | all_rows v7_only_rows rookie low_prior_sample kicker | 17 | 8 | 12 | 12 | 12 | 128 | 48 | 72 | 72 | -24 | K fallback remains unchanged in v8.2. |
| Rico Dowdle | RB | all_rows shared_weighted_rows veteran_prior_sample offense | 18 | 12 | 14.1 | 13.9 | 13.9 | 220.8 | 96 | 111.2 | 111.2 | -15.2 | V8.2 preserves v8.1 because no high-impact guardrail was triggered. |

## Top 10 Regressions

| Player | Pos | Cohorts | Actual G | v7 G | v8 G | v8.1 G | v8.2 G | Actual Pts | v7 Pts | v8.1 Pts | v8.2 Pts | v8.2 Abs Err Delta vs v7 | v8.2 Reason |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Bucky Irving | RB | all_rows shared_weighted_rows offense | 10 | 9 | 17 | 12 | 12 | 140.5 | 131.4 | 175.2 | 175.2 | 25.6 | V8.2 preserves v8.1 because no high-impact guardrail was triggered. |
| Ben Sauls | K | all_rows v7_only_rows rookie low_prior_sample kicker | 3 | 8 | 12 | 12 | 12 | 31 | 48 | 72 | 72 | 24 | K fallback remains unchanged in v8.2. |
| Charlie Smyth | K | all_rows v7_only_rows second_year_low_prior low_prior_sample kicker | 6 | 8 | 12 | 12 | 12 | 45 | 48 | 72 | 72 | 24 | K fallback remains unchanged in v8.2. |
| Kenny Pickett | QB | all_rows shared_weighted_rows veteran_prior_sample offense | 6 | 5 | 8.9 | 8.5 | 8.5 | 9.7 | 34 | 57.8 | 57.8 | 23.8 | V8.2 preserves v8.1 because no high-impact guardrail was triggered. |
| Drew Lock | QB | all_rows shared_weighted_rows veteran_prior_sample offense | 3 | 5 | 7.6 | 7.3 | 7.3 | 0.1 | 49 | 71.5 | 71.5 | 22.5 | V8.2 preserves v8.1 because no high-impact guardrail was triggered. |
| Taysom Hill | QB | all_rows shared_weighted_rows veteran_prior_sample offense | 13 | 5 | 10.5 | 7 | 7 | 43.8 | 55.5 | 77.7 | 77.7 | 22.2 | V8.2 preserves v8.1 because no high-impact guardrail was triggered. |
| Jameis Winston | QB | all_rows shared_weighted_rows veteran_prior_sample offense | 3 | 7 | 9.7 | 9.4 | 9.4 | 45.2 | 64.4 | 86.5 | 86.5 | 22.1 | V8.2 preserves v8.1 because no high-impact guardrail was triggered. |
| Isaac Guerendo | RB | all_rows shared_weighted_rows offense | 7 | 9 | 15.7 | 12 | 12 | 0 | 54 | 72 | 72 | 18 | V8.2 preserves v8.1 because no high-impact guardrail was triggered. |
| Tanner McKee | QB | all_rows shared_weighted_rows low_prior_sample offense | 4 | 2 | 4.4 | 3.2 | 3.2 | 13.7 | 29 | 46.4 | 46.4 | 17.4 | V8.2 preserves v8.1 because no high-impact guardrail was triggered. |
| Braelon Allen | RB | all_rows shared_weighted_rows offense | 4 | 9 | 16.7 | 12 | 12 | 17.3 | 45 | 60 | 60 | 15 | V8.2 preserves v8.1 because no high-impact guardrail was triggered. |

## Calibration Recommendations

- Leave TE/K unchanged; fallback rows remain baseline-equivalent by design.
- Investigate no_prior_stats separately before broadening v8.2.
- Preserve v8.2 for low-prior rows as the safest first candidate.
- Review offensive high-impact regressions before any live adoption.
- Do not create a live replacement until this audit identifies a cohort-gated v8.2 rule with total MAE parity.

## Verdict

v8_2_candidate_promising
