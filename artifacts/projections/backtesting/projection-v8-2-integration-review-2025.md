# Projection v8.2 Integration Review 2025

Dry run: true
Read only: true
Model: blackbird_expected_games_v8_2_high_impact_guardrail
Include IDP: true
Recommendation: integration_review_candidate

## Source Artifacts

- Parity audit: C:\Projects\lineup_lab\artifacts\projections\backtesting\projection-parity-audit-2025.json
- Backtest: C:\Projects\lineup_lab\artifacts\projections\backtesting\projection-backtest-2025.json
- Snapshot: C:\Projects\lineup_lab\artifacts\projections\backtesting\preseason-projection-snapshot-2025.json

## Model Quality Summary

| Segment | Rows | Games MAE v7 | v8.1 | v8.2 | v8.2 Games vs v7 | Total MAE v7 | v8.1 | v8.2 | v8.2 Total vs v7 | v8.2 Total vs v8.1 | RMSE v7 | v8.2 | v8.2 RMSE vs v7 | Bias v7 | v8.2 | v8.2 Diff vs v7 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| all_rows | 1680 | 4.239 | 4.15 | 4.15 | -0.089 | 38.003 | 37.878 | 37.865 | -0.138 | -0.013 | 56.099 | 55.585 | -0.514 | -4.89 | -3.355 | 934 |

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| overall_total_mae_better_than_v7 | PASS | 37.865 vs 38.003 |
| overall_games_mae_better_than_v7 | PASS | 4.15 vs 4.239 |
| overall_rmse_better_than_v7 | PASS | 55.585 vs 56.099 |
| 20_plus_ppg_not_worse_than_v7 | PASS | 92.238 vs 92.25 |
| 15_20_ppg_not_worse_than_v7 | PASS | 89.591 vs 89.917 |
| rookie_low_prior_not_worse_than_v7 | PASS | rookie 40.291 vs 41.085; low_prior 33.493 vs 34.072 |
| te_fallback_parity_clean | PASS | missing 0; mismatch 0 |
| k_fallback_parity_clean | PASS | missing 0; mismatch 0 |
| v8_2_distinct_from_v7 | PASS | 934/1680 (0.556) |
| large_adjustment_bucket_controlled | PASS | 0 rows; delta n/a |
| no_live_outputs_changed | PASS | Report-only module; no live output writer is called. |

## Cohort Results

| Segment | Rows | Games MAE v7 | v8.1 | v8.2 | v8.2 Games vs v7 | Total MAE v7 | v8.1 | v8.2 | v8.2 Total vs v7 | v8.2 Total vs v8.1 | RMSE v7 | v8.2 | v8.2 RMSE vs v7 | Bias v7 | v8.2 | v8.2 Diff vs v7 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| all_rows | 1680 | 4.239 | 4.15 | 4.15 | -0.089 | 38.003 | 37.878 | 37.865 | -0.138 | -0.013 | 56.099 | 55.585 | -0.514 | -4.89 | -3.355 | 934 |
| shared_weighted_rows | 1368 | 3.919 | 3.871 | 3.871 | -0.048 | 37.911 | 37.901 | 37.886 | -0.025 | -0.015 | 54.513 | 54.358 | -0.155 | 1.023 | 2.224 | 801 |
| v7_only_rows | 312 | 5.641 | 5.373 | 5.373 | -0.268 | 38.405 | 37.774 | 37.774 | -0.631 | 0 | 62.581 | 60.673 | -1.908 | -30.819 | -27.815 | 133 |
| veteran_prior_sample | 1107 | 3.816 | 3.788 | 3.788 | -0.028 | 39.199 | 39.228 | 39.218 | 0.019 | -0.01 | 55.314 | 55.166 | -0.148 | 4.622 | 5.734 | 657 |
| rookie | 278 | 5.921 | 5.605 | 5.605 | -0.316 | 41.085 | 40.291 | 40.291 | -0.794 | 0 | 65.705 | 63.665 | -2.04 | -34.591 | -31.497 | 110 |
| second_year_low_prior | 85 | 4.718 | 4.447 | 4.453 | -0.265 | 25.266 | 25.207 | 25.082 | -0.184 | -0.125 | 44.18 | 43.559 | -0.621 | -19.24 | -17.473 | 65 |
| no_prior_stats | 14 | 3.286 | 3.486 | 3.486 | 0.2 | 13.879 | 15.493 | 15.493 | 1.614 | 0 | 15.757 | 17.301 | 1.544 | 3.121 | 4.679 | 10 |
| low_prior_sample | 443 | 5.456 | 5.179 | 5.18 | -0.276 | 34.072 | 33.517 | 33.493 | -0.579 | -0.024 | 56.937 | 55.347 | -1.59 | -27.449 | -24.888 | 226 |
| te_fallback | 112 | 3.17 | 3.17 | 3.17 | 0 | 27.892 | 27.892 | 27.892 | 0 | 0 | 39.504 | 39.504 | 0 | 3.206 | 3.206 | 0 |
| k_fallback | 35 | 2.429 | 2.429 | 2.429 | 0 | 24.837 | 24.837 | 24.837 | 0 | 0 | 33.131 | 33.131 | 0 | -0.643 | -0.643 | 0 |
| idp | 1018 | 4.25 | 4.226 | 4.226 | -0.024 | 34.247 | 34.361 | 34.361 | 0.114 | 0 | 48.889 | 48.972 | 0.083 | -7.521 | -6.393 | 482 |
| offense | 620 | 4.286 | 4.103 | 4.104 | -0.182 | 44.784 | 44.375 | 44.34 | -0.444 | -0.035 | 67.105 | 65.966 | -1.139 | -0.373 | 1.665 | 445 |
| kicker | 42 | 3.262 | 2.976 | 2.976 | -0.286 | 28.936 | 27.221 | 27.221 | -1.715 | 0 | 38.409 | 34.95 | -3.459 | -7.821 | -3.821 | 7 |

## Position Results

| Segment | Rows | Games MAE v7 | v8.1 | v8.2 | v8.2 Games vs v7 | Total MAE v7 | v8.1 | v8.2 | v8.2 Total vs v7 | v8.2 Total vs v8.1 | RMSE v7 | v8.2 | v8.2 RMSE vs v7 | Bias v7 | v8.2 | v8.2 Diff vs v7 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| QB | 82 | 3.651 | 3.401 | 3.402 | -0.249 | 68.133 | 68.13 | 67.87 | -0.263 | -0.26 | 94.016 | 92.557 | -1.459 | -0.816 | 3.733 | 56 |
| RB | 162 | 5.056 | 4.831 | 4.834 | -0.222 | 48.503 | 47.934 | 47.935 | -0.568 | 0.001 | 72.506 | 70.958 | -1.548 | -7.73 | -4.918 | 147 |
| WR | 242 | 4.326 | 4.101 | 4.101 | -0.225 | 41.778 | 41.048 | 41.048 | -0.73 | 0 | 61.33 | 60.503 | -0.827 | 6.46 | 7.575 | 220 |
| TE | 134 | 3.672 | 3.657 | 3.657 | -0.015 | 31.431 | 31.543 | 31.543 | 0.112 | 0 | 47.726 | 46.836 | -0.89 | -3.547 | -2.316 | 22 |
| K | 42 | 3.262 | 2.976 | 2.976 | -0.286 | 28.936 | 27.221 | 27.221 | -1.715 | 0 | 38.409 | 34.95 | -3.459 | -7.821 | -3.821 | 7 |
| DL | 309 | 4.286 | 4.225 | 4.225 | -0.061 | 25.395 | 25.333 | 25.333 | -0.062 | 0 | 34.725 | 34.609 | -0.116 | -6.655 | -4.654 | 256 |
| LB | 303 | 4.185 | 4.171 | 4.171 | -0.014 | 39.807 | 39.884 | 39.884 | 0.077 | 0 | 58.366 | 58.41 | 0.044 | -9.37 | -9.205 | 38 |
| DB | 406 | 4.271 | 4.269 | 4.269 | -0.002 | 36.834 | 37.108 | 37.108 | 0.274 | 0 | 50.329 | 50.552 | 0.223 | -6.8 | -5.617 | 188 |
| DST | 0 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 0 |

## PPG Bucket Results

| Segment | Rows | Games MAE v7 | v8.1 | v8.2 | v8.2 Games vs v7 | Total MAE v7 | v8.1 | v8.2 | v8.2 Total vs v7 | v8.2 Total vs v8.1 | RMSE v7 | v8.2 | v8.2 RMSE vs v7 | Bias v7 | v8.2 | v8.2 Diff vs v7 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0-5 PPG | 905 | 4.692 | 4.574 | 4.574 | -0.118 | 27.355 | 27.135 | 27.135 | -0.22 | 0 | 44.893 | 44.128 | -0.765 | -15.524 | -14.26 | 516 |
| 5-10 PPG | 552 | 3.85 | 3.797 | 3.797 | -0.053 | 42.83 | 42.79 | 42.79 | -0.04 | 0 | 54.899 | 54.404 | -0.495 | 1.558 | 3.464 | 296 |
| 10-15 PPG | 162 | 3.295 | 3.233 | 3.233 | -0.062 | 61.379 | 61.418 | 61.418 | 0.039 | 0 | 78.452 | 78.277 | -0.175 | 14.616 | 16.619 | 92 |
| 15-20 PPG | 53 | 3.577 | 3.523 | 3.528 | -0.049 | 89.917 | 89.677 | 89.591 | -0.326 | -0.086 | 113.233 | 113.159 | -0.074 | 36.955 | 38.074 | 27 |
| 20+ PPG | 8 | 3.25 | 3.2 | 3.225 | -0.025 | 92.25 | 94.313 | 92.238 | -0.012 | -2.075 | 123.951 | 124.156 | 0.205 | 80.875 | 80.862 | 3 |

## Adjustment Bucket Results

| Segment | Rows | Games MAE v7 | v8.1 | v8.2 | v8.2 Games vs v7 | Total MAE v7 | v8.1 | v8.2 | v8.2 Total vs v7 | v8.2 Total vs v8.1 | RMSE v7 | v8.2 | v8.2 RMSE vs v7 | Bias v7 | v8.2 | v8.2 Diff vs v7 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 746 | 3.969 | 3.969 | 3.969 | 0 | 36.945 | 36.954 | 36.945 | 0 | -0.009 | 54.387 | 54.387 | 0 | -5.189 | -5.189 | 0 |
| 0-0.5 | 543 | 4.02 | 4.019 | 4.02 | 0 | 40.495 | 40.697 | 40.671 | 0.176 | -0.026 | 58.223 | 58.312 | 0.089 | 0.56 | 1.89 | 543 |
| 0.5-1 | 182 | 4.022 | 3.834 | 3.834 | -0.188 | 29.174 | 28.561 | 28.561 | -0.613 | 0 | 40.854 | 39.992 | -0.862 | 5.784 | 7.408 | 182 |
| 1-2 | 73 | 5.219 | 4.604 | 4.604 | -0.615 | 40.489 | 38.956 | 38.956 | -1.533 | 0 | 59.662 | 56.75 | -2.912 | -13.736 | -7.762 | 73 |
| 2-4 | 136 | 6.353 | 5.84 | 5.84 | -0.513 | 44.34 | 43.576 | 43.576 | -0.764 | 0 | 70.507 | 67.053 | -3.454 | -34.548 | -26.273 | 136 |
| 4+ | 0 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 0 |

## Impact Preview

Movement buckets:

```json
{
  "0": 757,
  "0-5": 690,
  "5-10": 190,
  "10-20": 27,
  "20+": 16
}
```

Risk counts:

```json
{
  "low": 1447,
  "moderate": 190,
  "high": 27,
  "critical": 16
}
```

## Top 20 Player Movements

| Player | Pos | Cohorts | v7 G | v8.2 G | Games Delta | PPG | Points Delta | Risk | Flags | Error Delta vs v7 | Reasons |
|---|---|---|---:|---:|---:|---:|---:|---|---|---:|---|
| Bucky Irving | RB | all_rows shared_weighted_rows offense | 9 | 12 | 3 | 14.6 | 43.8 | critical | high_value_position large_games_movement | 25.6 | low_prior_v8_1_preserved |
| Tyrone Tracy | RB | all_rows shared_weighted_rows offense | 9 | 12 | 3 | 11 | 33 | critical | high_value_position large_games_movement | -33 | low_prior_v8_1_preserved |
| Justin Fields | QB | all_rows shared_weighted_rows veteran_prior_sample offense | 7 | 9 | 2 | 15 | 30 | critical | elite_ppg_player high_value_position qb_superflex_sensitive large_games_movement | -30 | v8_2_no_guardrail |
| Tyrell Shavers | WR | all_rows shared_weighted_rows low_prior_sample offense | 1 | 3 | 2 | 13.9 | 27.8 | critical | rookie_or_low_prior high_value_position large_games_movement | -27.8 | low_prior_v8_1_preserved wr_v8_1_preserved |
| Jacoby Brissett | QB | all_rows shared_weighted_rows veteran_prior_sample offense | 5 | 8 | 3 | 9.2 | 27.6 | critical | high_value_position qb_superflex_sensitive large_games_movement | -27.6 | v8_2_no_guardrail |
| Andre Szmyt | K | all_rows v7_only_rows second_year_low_prior low_prior_sample kicker | 8 | 12 | 4 | 6 | 24 | critical | rookie_or_low_prior large_games_movement | -24 | k_fallback_preserved |
| Andy Borregales | K | all_rows v7_only_rows rookie low_prior_sample kicker | 8 | 12 | 4 | 6 | 24 | critical | rookie_or_low_prior large_games_movement | -24 | k_fallback_preserved |
| Ben Sauls | K | all_rows v7_only_rows rookie low_prior_sample kicker | 8 | 12 | 4 | 6 | 24 | critical | rookie_or_low_prior large_games_movement | 24 | k_fallback_preserved |
| Charlie Smyth | K | all_rows v7_only_rows second_year_low_prior low_prior_sample kicker | 8 | 12 | 4 | 6 | 24 | critical | rookie_or_low_prior large_games_movement | 24 | k_fallback_preserved |
| Harrison Mevis | K | all_rows v7_only_rows rookie low_prior_sample kicker | 8 | 12 | 4 | 6 | 24 | critical | rookie_or_low_prior large_games_movement | -24 | k_fallback_preserved |
| Ryan Fitzgerald | K | all_rows v7_only_rows rookie low_prior_sample kicker | 8 | 12 | 4 | 6 | 24 | critical | rookie_or_low_prior large_games_movement | -24 | k_fallback_preserved |
| Tyler Loop | K | all_rows v7_only_rows rookie low_prior_sample kicker | 8 | 12 | 4 | 6 | 24 | critical | rookie_or_low_prior large_games_movement | -24 | k_fallback_preserved |
| Kenny Pickett | QB | all_rows shared_weighted_rows veteran_prior_sample offense | 5 | 8.5 | 3.5 | 6.8 | 23.8 | critical | high_value_position qb_superflex_sensitive large_games_movement | 23.8 | v8_2_no_guardrail |
| Drew Lock | QB | all_rows shared_weighted_rows veteran_prior_sample offense | 5 | 7.3 | 2.3 | 9.8 | 22.5 | critical | high_value_position qb_superflex_sensitive large_games_movement | 22.5 | v8_2_no_guardrail |
| Taysom Hill | QB | all_rows shared_weighted_rows veteran_prior_sample offense | 5 | 7 | 2 | 11.1 | 22.2 | critical | high_value_position qb_superflex_sensitive large_games_movement | 22.2 | v8_2_no_guardrail |
| Jameis Winston | QB | all_rows shared_weighted_rows veteran_prior_sample offense | 7 | 9.4 | 2.4 | 9.2 | 22.1 | critical | high_value_position qb_superflex_sensitive large_games_movement | 22.1 | v8_2_no_guardrail |
| Ray Davis | RB | all_rows shared_weighted_rows offense | 9 | 12 | 3 | 6.3 | 18.9 | high | high_value_position large_games_movement | 5.5 | low_prior_v8_1_preserved |
| Isaac Guerendo | RB | all_rows shared_weighted_rows offense | 9 | 12 | 3 | 6 | 18 | high | high_value_position large_games_movement | 18 | low_prior_v8_1_preserved |
| Tanner McKee | QB | all_rows shared_weighted_rows low_prior_sample offense | 2 | 3.2 | 1.2 | 14.5 | 17.4 | high | rookie_or_low_prior high_value_position qb_superflex_sensitive | 17.4 | low_prior_v8_1_preserved |
| Rico Dowdle | RB | all_rows shared_weighted_rows veteran_prior_sample offense | 12 | 13.9 | 1.9 | 8 | 15.2 | high | high_value_position | -15.2 | v8_2_no_guardrail |

## Position Movement Summary

| Segment | Rows | Move 5+ | Move 10+ | Move 20+ |
|---|---:|---:|---:|---:|
| QB | 82 | 27 | 19 | 6 |
| RB | 162 | 62 | 9 | 2 |
| WR | 242 | 72 | 7 | 1 |
| TE | 134 | 22 | 0 | 0 |
| K | 42 | 7 | 7 | 7 |
| DL | 309 | 25 | 1 | 0 |
| LB | 303 | 7 | 0 | 0 |
| DB | 406 | 11 | 0 | 0 |
| DST | 0 | 0 | 0 | 0 |

## Cohort Movement Summary

| Segment | Rows | Move 5+ | Move 10+ | Move 20+ |
|---|---:|---:|---:|---:|
| all_rows | 1680 | 233 | 43 | 16 |
| shared_weighted_rows | 1368 | 117 | 26 | 9 |
| v7_only_rows | 312 | 116 | 17 | 7 |
| veteran_prior_sample | 1107 | 96 | 17 | 6 |
| rookie | 278 | 110 | 15 | 5 |
| second_year_low_prior | 85 | 8 | 2 | 2 |
| no_prior_stats | 14 | 3 | 0 | 0 |
| low_prior_sample | 443 | 126 | 19 | 8 |
| te_fallback | 112 | 0 | 0 | 0 |
| k_fallback | 35 | 0 | 0 | 0 |
| idp | 1018 | 43 | 1 | 0 |
| offense | 620 | 183 | 35 | 9 |
| kicker | 42 | 7 | 7 | 7 |

## Notes

- Dry-run/read-only integration-readiness review only.
- No live projections, 2026 outputs, Supabase writes, War Room UI, Blackbird Rank, or Draft Suggestion ordering are changed.
