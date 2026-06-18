# Projection Rank Impact Tier Review 2026

Dry run: true
Read only: true
Verdict: tier_review_packet_ready

## Summary

```json
{
  "meaningfulRows": 35,
  "actionCounts": {
    "acceptable_v8_2_movement": 0,
    "keep_current_path_for_now": 3,
    "needs_roster_confirmation": 0,
    "needs_injury_role_review": 10,
    "needs_qb_superflex_review": 4,
    "needs_model_policy_review": 18
  },
  "positionCounts": {
    "QB": 5,
    "WR": 11,
    "RB": 9,
    "DL": 4,
    "DB": 5,
    "LB": 1
  },
  "rankImpactFlagCounts": {
    "top_100_overall_movement": 1,
    "top_200_overall_movement": 6,
    "top_300_overall_movement": 8,
    "starter_tier_position_movement": 24,
    "qb_superflex_sensitive_movement": 4
  },
  "overallRankRangeCounts": {
    "top_50": 0,
    "top_100": 2,
    "top_150": 4,
    "top_200": 5,
    "top_300": 12,
    "top_500": 9,
    "500_plus": 3,
    "unknown": 0
  },
  "positionRankRangeCounts": {
    "starter": 30,
    "depth": 5,
    "deep": 0,
    "unknown": 0
  },
  "projectedPointMovementBucketCounts": {
    "0": 2,
    "0-2": 5,
    "2-5": 8,
    "5-10": 11,
    "10-20": 9
  },
  "qbSuperflexSensitiveRows": 4
}
```

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| no_live_outputs_changed | PASS | Tier review packet reads dry-run artifacts and writes only review packet artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is imported or called. |
| rankings_unchanged | PASS | Rank fields are copied from dry-run rank impact artifacts only. |
| draft_suggestions_unchanged | PASS | Draft suggestion code paths are not imported or executed. |
| war_room_unchanged | PASS | War Room UI code is not imported or modified. |
| v8_2_not_promoted | PASS | This packet does not update promotion decisions or production projection paths. |
| conservative_decision_file_unchanged | PASS | The conservative decision file is not read for mutation or rewritten. |
| eligible_pool_only | PASS | 35 row(s) are from the eligible limited promotion pool. |
| meaningful_rows_only | PASS | 35 meaningful row(s) included. |
| deep_noise_only_excluded | PASS | Deep-tier noise-only rows are excluded. |
| source_quality_review_ready | PASS | Source quality recommendation: rank_impact_needs_tier_review. |

## Recommended Action Counts

| Value | Rows |
|---|---:|
| acceptable_v8_2_movement | 0 |
| keep_current_path_for_now | 3 |
| needs_roster_confirmation | 0 |
| needs_injury_role_review | 10 |
| needs_qb_superflex_review | 4 |
| needs_model_policy_review | 18 |

## All Meaningful Overall-Rank Movers

| Player | Pos | Team | Pts Delta | Best OVR | OVR Move | Best Pos | Pos Move | Action | Flags |
|---|---|---|---:|---:|---:|---:|---:|---|---|
| Chris Godwin | WR | TB | -12.8 | 218 | -63 | 51 | -6 | needs_injury_role_review | top_300_overall_movement, starter_tier_position_movement |
| Jacoby Brissett | QB | ARI | -13.9 | 150 | -50 | 32 | -1 | needs_qb_superflex_review | top_200_overall_movement, qb_superflex_sensitive_movement |
| Kareem Hunt | RB | KC | 12.4 | 221 | 50 | 32 | 0 | needs_model_policy_review | top_300_overall_movement |
| Joe Flacco | QB | CIN | -17 | 95 | -47 | 28 | -3 | needs_qb_superflex_review | top_100_overall_movement, qb_superflex_sensitive_movement |
| Leonard Williams | DL | SEA | 7 | 291 | 43 | 7 | 1 | keep_current_path_for_now | top_300_overall_movement |
| Christian Watson | WR | GB | -5.4 | 281 | -39 | 60 | -2 | needs_injury_role_review | top_300_overall_movement |
| Cooper Kupp | WR | SEA | 10.8 | 161 | 35 | 36 | 9 | needs_model_policy_review | top_200_overall_movement, starter_tier_position_movement |
| Mac Jones | QB | SF | -4.2 | 300 | -34 | 37 | -1 | needs_model_policy_review | top_300_overall_movement |
| Ja'Quan McMillian | DB | DEN | 7.1 | 283 | 32 | 58 | 15 | keep_current_path_for_now | top_300_overall_movement |
| Brandon Aiyuk | WR | SF | -5.7 | 241 | -31 | 54 | -1 | needs_injury_role_review | top_300_overall_movement |
| Mike Evans | WR | SF | -11.1 | 143 | -30 | 35 | -4 | needs_injury_role_review | top_200_overall_movement |
| Rico Dowdle | RB | PIT | 9.9 | 155 | 30 | 26 | 1 | needs_model_policy_review | top_200_overall_movement |
| Quentin Johnston | WR | LAC | -6.4 | 161 | -30 | 36 | -7 | needs_injury_role_review | top_200_overall_movement, starter_tier_position_movement |
| Terry McLaurin | WR | WAS | -11.7 | 108 | -28 | 27 | -6 | needs_injury_role_review | top_200_overall_movement, starter_tier_position_movement |
| Will Levis | QB | TEN | -4.5 | 249 | -26 | 35 | -1 | needs_qb_superflex_review | top_300_overall_movement, qb_superflex_sensitive_movement |

## All Meaningful Position-Rank Movers

| Player | Pos | Team | Pts Delta | Best OVR | OVR Move | Best Pos | Pos Move | Action | Flags |
|---|---|---|---:|---:|---:|---:|---:|---|---|
| Derrick Brown | DL | CAR | -0.7 | 728 | -35 | 47 | -11 | needs_model_policy_review | starter_tier_position_movement |
| Cooper Kupp | WR | SEA | 10.8 | 161 | 35 | 36 | 9 | needs_model_policy_review | top_200_overall_movement, starter_tier_position_movement |
| Ezekiel Elliott | RB | LAC | -2.2 | 469 | -33 | 42 | -9 | needs_model_policy_review | starter_tier_position_movement |
| Isiah Pacheco | RB | DET | -1.7 | 484 | -27 | 44 | -9 | needs_model_policy_review | starter_tier_position_movement |
| Tyler Allgeier | RB | ARI | -1.4 | 465 | -24 | 41 | -9 | needs_model_policy_review | starter_tier_position_movement |
| Zack Moss | RB | CIN | -4 | 488 | -47 | 47 | -8 | needs_model_policy_review | starter_tier_position_movement |
| Jayden Reed | WR | GB | -11.3 | 305 | -88 | 63 | -7 | needs_injury_role_review | starter_tier_position_movement |
| Quentin Johnston | WR | LAC | -6.4 | 161 | -30 | 36 | -7 | needs_injury_role_review | top_200_overall_movement, starter_tier_position_movement |
| Tank Dell | WR | HOU | 5 | 184 | 16 | 40 | 7 | needs_model_policy_review | starter_tier_position_movement |
| Chris Godwin | WR | TB | -12.8 | 218 | -63 | 51 | -6 | needs_injury_role_review | top_300_overall_movement, starter_tier_position_movement |
| Daniel Jones | QB | IND | -12 | 78 | -24 | 23 | -6 | needs_qb_superflex_review | starter_tier_position_movement, qb_superflex_sensitive_movement |
| Terry McLaurin | WR | WAS | -11.7 | 108 | -28 | 27 | -6 | needs_injury_role_review | top_200_overall_movement, starter_tier_position_movement |
| DeAndre Hopkins | WR | BAL | -6.4 | 406 | -50 | 72 | -6 | needs_injury_role_review | starter_tier_position_movement |
| Rome Odunze | WR | CHI | -6.2 | 188 | -21 | 43 | -6 | needs_injury_role_review | starter_tier_position_movement |
| Brian Robinson | RB | ATL | -5.5 | 328 | -45 | 33 | -6 | needs_injury_role_review | starter_tier_position_movement |
| Trey Hendrickson | DL | BAL | 7.4 | 575 | 51 | 32 | 5 | keep_current_path_for_now | starter_tier_position_movement |
| Jalen Thompson | DB | DAL | 4.2 | 239 | 13 | 39 | 5 | needs_model_policy_review | starter_tier_position_movement |
| Quentin Lake | DB | LAR | 4.2 | 240 | 13 | 40 | 5 | needs_model_policy_review | starter_tier_position_movement |
| Fred Warner | LB | SF | -4.1 | 144 | -9 | 35 | -5 | needs_model_policy_review | starter_tier_position_movement |
| Jalen Carter | DL | PHI | 2.6 | 586 | 0 | 30 | -5 | needs_model_policy_review | starter_tier_position_movement |
| Devin Singletary | RB | NYG | -1.4 | 445 | -16 | 40 | -5 | needs_model_policy_review | starter_tier_position_movement |
| Tyjae Spears | RB | TEN | -0.9 | 429 | -14 | 39 | -5 | needs_model_policy_review | starter_tier_position_movement |
| Jacob Parrish | DB | TB | 0 | 220 | -7 | 32 | -5 | needs_model_policy_review | starter_tier_position_movement |
| Kamren Kinchens | DB | LAR | 0 | 251 | -5 | 43 | -5 | needs_model_policy_review | starter_tier_position_movement |
| Joe Flacco | QB | CIN | -17 | 95 | -47 | 28 | -3 | needs_qb_superflex_review | top_100_overall_movement, qb_superflex_sensitive_movement |
| Jacoby Brissett | QB | ARI | -13.9 | 150 | -50 | 32 | -1 | needs_qb_superflex_review | top_200_overall_movement, qb_superflex_sensitive_movement |
| Will Levis | QB | TEN | -4.5 | 249 | -26 | 35 | -1 | needs_qb_superflex_review | top_300_overall_movement, qb_superflex_sensitive_movement |

## QB / Superflex-Sensitive Movers

| Player | Pos | Team | Pts Delta | Best OVR | OVR Move | Best Pos | Pos Move | Action | Flags |
|---|---|---|---:|---:|---:|---:|---:|---|---|
| Daniel Jones | QB | IND | -12 | 78 | -24 | 23 | -6 | needs_qb_superflex_review | starter_tier_position_movement, qb_superflex_sensitive_movement |
| Joe Flacco | QB | CIN | -17 | 95 | -47 | 28 | -3 | needs_qb_superflex_review | top_100_overall_movement, qb_superflex_sensitive_movement |
| Jacoby Brissett | QB | ARI | -13.9 | 150 | -50 | 32 | -1 | needs_qb_superflex_review | top_200_overall_movement, qb_superflex_sensitive_movement |
| Will Levis | QB | TEN | -4.5 | 249 | -26 | 35 | -1 | needs_qb_superflex_review | top_300_overall_movement, qb_superflex_sensitive_movement |

## Starter-Tier Veteran Movers

| Player | Pos | Team | Pts Delta | Best OVR | OVR Move | Best Pos | Pos Move | Action | Flags |
|---|---|---|---:|---:|---:|---:|---:|---|---|
| Daniel Jones | QB | IND | -12 | 78 | -24 | 23 | -6 | needs_qb_superflex_review | starter_tier_position_movement, qb_superflex_sensitive_movement |
| Jayden Reed | WR | GB | -11.3 | 305 | -88 | 63 | -7 | needs_injury_role_review | starter_tier_position_movement |
| Chris Godwin | WR | TB | -12.8 | 218 | -63 | 51 | -6 | needs_injury_role_review | top_300_overall_movement, starter_tier_position_movement |
| DeAndre Hopkins | WR | BAL | -6.4 | 406 | -50 | 72 | -6 | needs_injury_role_review | starter_tier_position_movement |
| Brian Robinson | RB | ATL | -5.5 | 328 | -45 | 33 | -6 | needs_injury_role_review | starter_tier_position_movement |
| Christian Watson | WR | GB | -5.4 | 281 | -39 | 60 | -2 | needs_injury_role_review | top_300_overall_movement |
| Brandon Aiyuk | WR | SF | -5.7 | 241 | -31 | 54 | -1 | needs_injury_role_review | top_300_overall_movement |
| Quentin Johnston | WR | LAC | -6.4 | 161 | -30 | 36 | -7 | needs_injury_role_review | top_200_overall_movement, starter_tier_position_movement |
| Mike Evans | WR | SF | -11.1 | 143 | -30 | 35 | -4 | needs_injury_role_review | top_200_overall_movement |
| Terry McLaurin | WR | WAS | -11.7 | 108 | -28 | 27 | -6 | needs_injury_role_review | top_200_overall_movement, starter_tier_position_movement |
| Rome Odunze | WR | CHI | -6.2 | 188 | -21 | 43 | -6 | needs_injury_role_review | starter_tier_position_movement |
| Kareem Hunt | RB | KC | 12.4 | 221 | 50 | 32 | 0 | needs_model_policy_review | top_300_overall_movement |
| Zack Moss | RB | CIN | -4 | 488 | -47 | 47 | -8 | needs_model_policy_review | starter_tier_position_movement |
| Derrick Brown | DL | CAR | -0.7 | 728 | -35 | 47 | -11 | needs_model_policy_review | starter_tier_position_movement |
| Cooper Kupp | WR | SEA | 10.8 | 161 | 35 | 36 | 9 | needs_model_policy_review | top_200_overall_movement, starter_tier_position_movement |
| Ezekiel Elliott | RB | LAC | -2.2 | 469 | -33 | 42 | -9 | needs_model_policy_review | starter_tier_position_movement |
| Rico Dowdle | RB | PIT | 9.9 | 155 | 30 | 26 | 1 | needs_model_policy_review | top_200_overall_movement |
| Isiah Pacheco | RB | DET | -1.7 | 484 | -27 | 44 | -9 | needs_model_policy_review | starter_tier_position_movement |
| Tyler Allgeier | RB | ARI | -1.4 | 465 | -24 | 41 | -9 | needs_model_policy_review | starter_tier_position_movement |
| Tank Dell | WR | HOU | 5 | 184 | 16 | 40 | 7 | needs_model_policy_review | starter_tier_position_movement |
| Devin Singletary | RB | NYG | -1.4 | 445 | -16 | 40 | -5 | needs_model_policy_review | starter_tier_position_movement |
| Tyjae Spears | RB | TEN | -0.9 | 429 | -14 | 39 | -5 | needs_model_policy_review | starter_tier_position_movement |
| Jalen Thompson | DB | DAL | 4.2 | 239 | 13 | 39 | 5 | needs_model_policy_review | starter_tier_position_movement |
| Quentin Lake | DB | LAR | 4.2 | 240 | 13 | 40 | 5 | needs_model_policy_review | starter_tier_position_movement |
| Fred Warner | LB | SF | -4.1 | 144 | -9 | 35 | -5 | needs_model_policy_review | starter_tier_position_movement |
| Kamren Kinchens | DB | LAR | 0 | 251 | -5 | 43 | -5 | needs_model_policy_review | starter_tier_position_movement |
| Jalen Carter | DL | PHI | 2.6 | 586 | 0 | 30 | -5 | needs_model_policy_review | starter_tier_position_movement |
| Trey Hendrickson | DL | BAL | 7.4 | 575 | 51 | 32 | 5 | keep_current_path_for_now | starter_tier_position_movement |
| Leonard Williams | DL | SEA | 7 | 291 | 43 | 7 | 1 | keep_current_path_for_now | top_300_overall_movement |

## Rookie / Young Movers

| Player | Pos | Team | Pts Delta | Best OVR | OVR Move | Best Pos | Pos Move | Action | Flags |
|---|---|---|---:|---:|---:|---:|---:|---|---|
| Jacob Parrish | DB | TB | 0 | 220 | -7 | 32 | -5 | needs_model_policy_review | starter_tier_position_movement |

## Top Projected-Point Movers

| Player | Pos | Team | Pts Delta | Best OVR | OVR Move | Best Pos | Pos Move | Action | Flags |
|---|---|---|---:|---:|---:|---:|---:|---|---|
| Joe Flacco | QB | CIN | -17 | 95 | -47 | 28 | -3 | needs_qb_superflex_review | top_100_overall_movement, qb_superflex_sensitive_movement |
| Jacoby Brissett | QB | ARI | -13.9 | 150 | -50 | 32 | -1 | needs_qb_superflex_review | top_200_overall_movement, qb_superflex_sensitive_movement |
| Chris Godwin | WR | TB | -12.8 | 218 | -63 | 51 | -6 | needs_injury_role_review | top_300_overall_movement, starter_tier_position_movement |
| Kareem Hunt | RB | KC | 12.4 | 221 | 50 | 32 | 0 | needs_model_policy_review | top_300_overall_movement |
| Daniel Jones | QB | IND | -12 | 78 | -24 | 23 | -6 | needs_qb_superflex_review | starter_tier_position_movement, qb_superflex_sensitive_movement |
| Terry McLaurin | WR | WAS | -11.7 | 108 | -28 | 27 | -6 | needs_injury_role_review | top_200_overall_movement, starter_tier_position_movement |
| Jayden Reed | WR | GB | -11.3 | 305 | -88 | 63 | -7 | needs_injury_role_review | starter_tier_position_movement |
| Mike Evans | WR | SF | -11.1 | 143 | -30 | 35 | -4 | needs_injury_role_review | top_200_overall_movement |
| Cooper Kupp | WR | SEA | 10.8 | 161 | 35 | 36 | 9 | needs_model_policy_review | top_200_overall_movement, starter_tier_position_movement |
| Rico Dowdle | RB | PIT | 9.9 | 155 | 30 | 26 | 1 | needs_model_policy_review | top_200_overall_movement |
| Trey Hendrickson | DL | BAL | 7.4 | 575 | 51 | 32 | 5 | keep_current_path_for_now | starter_tier_position_movement |
| Ja'Quan McMillian | DB | DEN | 7.1 | 283 | 32 | 58 | 15 | keep_current_path_for_now | top_300_overall_movement |
| Leonard Williams | DL | SEA | 7 | 291 | 43 | 7 | 1 | keep_current_path_for_now | top_300_overall_movement |
| DeAndre Hopkins | WR | BAL | -6.4 | 406 | -50 | 72 | -6 | needs_injury_role_review | starter_tier_position_movement |
| Quentin Johnston | WR | LAC | -6.4 | 161 | -30 | 36 | -7 | needs_injury_role_review | top_200_overall_movement, starter_tier_position_movement |
| Rome Odunze | WR | CHI | -6.2 | 188 | -21 | 43 | -6 | needs_injury_role_review | starter_tier_position_movement |
| Brandon Aiyuk | WR | SF | -5.7 | 241 | -31 | 54 | -1 | needs_injury_role_review | top_300_overall_movement |
| Brian Robinson | RB | ATL | -5.5 | 328 | -45 | 33 | -6 | needs_injury_role_review | starter_tier_position_movement |
| Christian Watson | WR | GB | -5.4 | 281 | -39 | 60 | -2 | needs_injury_role_review | top_300_overall_movement |
| Tank Dell | WR | HOU | 5 | 184 | 16 | 40 | 7 | needs_model_policy_review | starter_tier_position_movement |
| Will Levis | QB | TEN | -4.5 | 249 | -26 | 35 | -1 | needs_qb_superflex_review | top_300_overall_movement, qb_superflex_sensitive_movement |
| Mac Jones | QB | SF | -4.2 | 300 | -34 | 37 | -1 | needs_model_policy_review | top_300_overall_movement |
| Jalen Thompson | DB | DAL | 4.2 | 239 | 13 | 39 | 5 | needs_model_policy_review | starter_tier_position_movement |
| Quentin Lake | DB | LAR | 4.2 | 240 | 13 | 40 | 5 | needs_model_policy_review | starter_tier_position_movement |
| Fred Warner | LB | SF | -4.1 | 144 | -9 | 35 | -5 | needs_model_policy_review | starter_tier_position_movement |

## Notes

- Dry-run/read-only rank impact tier review packet only.
- Only meaningful rank-impact rows are included; deep-tier noise appears only if another meaningful flag is also present.
- Recommended actions are conservative review routing labels, not model decisions.
- No live projections, 2026 production outputs, Supabase writes, Blackbird Rank, Draft Suggestion ordering, War Room UI, or conservative decision files are changed.
