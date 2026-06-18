# Preseason Projection Snapshot 2025

Dry run: true
Artifact type: blackbird_preseason_projection_snapshot
Model version: preseason_snapshot_v2
Default universe: fantasy-relevant
Projection season: 2025
Input seasons: 2018, 2019, 2020, 2021, 2022, 2023, 2024
Excluded seasons: 2025
Leakage safe: true
Scoring source: default
Scoring profile: Blackbird default dry-run profile scoring

## Diagnostics

- Players considered: 8321
- Players projected: 5605
- Players skipped: 2716
- Players skipped no-signal: 2716
- Universe: fantasy-relevant
- No-prior count: 1986
- IDP count: 2718
- Average projected games: 6.5

## Variant Counts

```json
{
  "blackbird_availability_calibrated": 5605,
  "blackbird_calibrated_v2": 5605,
  "blackbird_cohort_calibrated_v3": 5605,
  "blackbird_cohort_games_calibrated": 5605,
  "blackbird_cohort_ppg_calibrated": 5605,
  "blackbird_existing_projection_v1": 5605,
  "blackbird_expected_games_v4": 5605,
  "blackbird_expected_games_v5_selective": 5605,
  "blackbird_expected_games_v6_gated": 5605,
  "blackbird_expected_games_v7_family_selective": 5605,
  "blackbird_expected_games_v8_1_calibrated_gate": 5605,
  "blackbird_expected_games_v8_2_high_impact_guardrail": 5605,
  "blackbird_expected_games_v8_cohort_blend": 5605,
  "blackbird_no_prior_calibrated": 5605
}
```

## Cohort Counts

```json
{
  "idp_db": 1105,
  "veteran_3plus_prior_seasons": 1959,
  "low_prior_sample": 2878,
  "one_prior_season": 985,
  "rookie_or_no_prior_nfl_data": 1989,
  "two_prior_seasons": 675,
  "idp_dl": 796,
  "kicker": 127,
  "idp_lb": 817,
  "offense_qb": 293,
  "offense_rb": 686,
  "offense_te": 570,
  "offense_wr": 1211
}
```

## No-Prior Type Counts

```json
{
  "has_prior_nfl_data": 3619,
  "rookie_with_rookie_source_data": 814,
  "idp_no_prior_player": 99,
  "depth_or_fringe_no_prior_player": 999,
  "roster_or_snap_evidence_no_prior_stats": 74
}
```

## Average Projected PPG By Position

```json
{
  "DB": 4.6,
  "DL": 3.3,
  "K": 4.5,
  "LB": 4.4,
  "QB": 5.6,
  "RB": 3.1,
  "TE": 2.2,
  "WR": 2.7
}
```

## Confidence Distribution

```json
{
  "high": 1959,
  "low": 985,
  "very_low": 1986,
  "medium": 675
}
```

## Warnings By Type

```json
{
  "high_value_usage_unavailable": 68250,
  "low_sample_size": 10878,
  "single_prior_season": 13790,
  "no_prior_nfl_data": 27804,
  "no_prior_type:rookie_with_rookie_source_data": 11396,
  "no_weekly_stats": 23450,
  "unsupported_missing_stat_columns": 5684,
  "usage_context_unavailable": 25396,
  "no_prior_type:idp_no_prior_player": 1386,
  "identity_confidence_not_strong": 672,
  "depth_or_fringe_no_prior_player": 13986,
  "no_prior_type:depth_or_fringe_no_prior_player": 13986,
  "weak_identity_match": 266,
  "no_prior_type:roster_or_snap_evidence_no_prior_stats": 1036
}
```

## Leakage Safety

- Passed: true
- Target season excluded from inputs: true
- No post-target projection artifacts used: true
- Target season 2025 is excluded from all numeric projection inputs.
- Rows are produced from profile history only; no current 2026 projection outputs are read.
