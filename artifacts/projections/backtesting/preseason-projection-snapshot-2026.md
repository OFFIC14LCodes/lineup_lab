# Preseason Projection Snapshot 2026

Dry run: true
Artifact type: blackbird_preseason_projection_snapshot
Model version: preseason_snapshot_v2
Default universe: fantasy-relevant
Projection season: 2026
Input seasons: 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025
Excluded seasons: 2026
Leakage safe: true
Scoring source: default
Scoring profile: Blackbird default dry-run profile scoring

## Diagnostics

- Players considered: 8321
- Players projected: 5635
- Players skipped: 2686
- Players skipped no-signal: 2686
- Universe: fantasy-relevant
- No-prior count: 1689
- IDP count: 2748
- Average projected games: 6.5

## Expected Games Selector

```json
{
  "flagEnabled": false,
  "readinessArtifactsAvailable": true,
  "totalSelectorRows": 5635,
  "selectedV82Rows": 0,
  "currentPathRows": 5635,
  "blockedOrExcludedRows": 0,
  "missingReadinessRows": 0,
  "missingArtifactRows": 0,
  "protectedRows": 0,
  "kRowsUsingV82": 0,
  "criticalMovementRowsUsingV82": 0,
  "meaningfulRankMoversUsingV82": 0,
  "legacyRowsUsingV82": 0
}
```

## Variant Counts

```json
{
  "blackbird_availability_calibrated": 5635,
  "blackbird_calibrated_v2": 5635,
  "blackbird_cohort_calibrated_v3": 5635,
  "blackbird_cohort_games_calibrated": 5635,
  "blackbird_cohort_ppg_calibrated": 5635,
  "blackbird_existing_projection_v1": 5635,
  "blackbird_expected_games_v4": 5635,
  "blackbird_expected_games_v5_selective": 5635,
  "blackbird_expected_games_v6_gated": 5635,
  "blackbird_expected_games_v7_family_selective": 5635,
  "blackbird_expected_games_v8_1_calibrated_gate": 5635,
  "blackbird_expected_games_v8_2_high_impact_guardrail": 5635,
  "blackbird_expected_games_v8_cohort_blend": 5635,
  "blackbird_no_prior_calibrated": 5635
}
```

## Cohort Counts

```json
{
  "idp_db": 1122,
  "veteran_3plus_prior_seasons": 2188,
  "low_prior_sample": 2651,
  "one_prior_season": 1064,
  "rookie_or_no_prior_nfl_data": 1692,
  "two_prior_seasons": 694,
  "idp_dl": 803,
  "kicker": 127,
  "idp_lb": 823,
  "offense_qb": 293,
  "offense_rb": 686,
  "offense_te": 570,
  "offense_wr": 1211
}
```

## No-Prior Type Counts

```json
{
  "has_prior_nfl_data": 3946,
  "rookie_with_rookie_source_data": 536,
  "idp_no_prior_player": 104,
  "depth_or_fringe_no_prior_player": 973,
  "roster_or_snap_evidence_no_prior_stats": 76
}
```

## Average Projected PPG By Position

```json
{
  "DB": 4.7,
  "DL": 3.4,
  "K": 4.7,
  "LB": 4.5,
  "QB": 5.5,
  "RB": 3.2,
  "TE": 2.3,
  "WR": 2.7
}
```

## Confidence Distribution

```json
{
  "high": 2188,
  "low": 1056,
  "very_low": 1697,
  "medium": 694
}
```

## Warnings By Type

```json
{
  "high_value_usage_unavailable": 66794,
  "low_sample_size": 11060,
  "single_prior_season": 14896,
  "no_prior_nfl_data": 23646,
  "no_prior_type:rookie_with_rookie_source_data": 7504,
  "no_weekly_stats": 23646,
  "unsupported_missing_stat_columns": 5880,
  "usage_context_unavailable": 21140,
  "no_prior_type:idp_no_prior_player": 1456,
  "identity_confidence_not_strong": 756,
  "depth_or_fringe_no_prior_player": 13622,
  "no_prior_type:depth_or_fringe_no_prior_player": 13622,
  "weak_identity_match": 266,
  "no_prior_type:roster_or_snap_evidence_no_prior_stats": 1064
}
```

## Leakage Safety

- Passed: true
- Target season excluded from inputs: true
- No post-target projection artifacts used: true
- Target season 2026 is excluded from all numeric projection inputs.
- Rows are produced from profile history only; no current 2026 projection outputs are read.
