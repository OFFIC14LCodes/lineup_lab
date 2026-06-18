# Projection Promotion Candidate Pool 2026

Dry run: true
Read only: true
Verdict: promotion_pool_needs_manual_review

## Classification Counts

```json
{
  "eligible_for_projection_promotion": 3245,
  "manual_review_before_promotion": 46,
  "shadow_only": 1099,
  "blocked_from_promotion": 1245
}
```

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| no_live_outputs_changed | PASS | Candidate-pool audit reads dry-run artifacts and writes only audit artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is imported or called. |
| rankings_unchanged | PASS | Ranking movement is copied from shadow diagnostics only. |
| draft_suggestions_unchanged | PASS | Draft suggestion code paths are not imported or executed. |
| war_room_unchanged | PASS | War Room UI code is not imported or modified. |
| retired_legacy_rows_blocked | PASS | 1245 retired/legacy rows checked. |
| k_rows_not_eligible_initially | PASS | 0 K rows eligible. |
| critical_movements_classified | PASS | 54 critical movement rows classified outside eligible pool. |
| eligible_pool_generated | PASS | 3245 eligible rows generated. |
| eligible_pool_has_no_legacy_suspects | PASS | 3245 eligible rows checked. |

## Pool Metrics

| Pool | Rows | Critical | Avg Delta | Avg Abs Delta | 20+ Moves |
|---|---:|---:|---:|---:|---:|
| all_rows | 5635 | 54 | 1.508 | 1.973 | 54 |
| promotion_eligible_rows_only | 3245 | 0 | 1.36 | 1.804 | 0 |
| promotion_eligible_excluding_k | 3245 | 0 | 1.36 | 1.804 | 0 |
| manual_review_rows | 46 | 46 | 24.159 | 25.05 | 46 |
| blocked_rows | 1245 | 8 | 1.46 | 1.888 | 8 |
| shadow_only_rows | 1099 | 0 | 1.05 | 1.602 | 0 |

## Kicker Policy

```json
{
  "totalKRows": 127,
  "eligibleKRows": 0,
  "manualReviewKRows": 32,
  "shadowOnlyKRows": 66,
  "blockedKRows": 29,
  "criticalMovementKRows": 32,
  "excludedFromEligiblePoolRows": 127,
  "recommendation": "Keep K excluded from the initial promotion-eligible pool until low-prior kicker fallback policy is reviewed."
}
```

## Top Eligible Movements

| Player | Pos | Team | Class | Universe | Points Delta | Current G | v8.2 G | Reasons | Action |
|---|---|---|---|---|---:|---:|---:|---|---|
| Bhayshul Tuten | RB | JAX | eligible_for_projection_promotion | active_plausible | 18 | 9 | 12 | active_plausible_allowed | ready_for_promotion_review_pool |
| Dylan Sampson | RB | CLE | eligible_for_projection_promotion | active_plausible | 17.4 | 9 | 11.9 | active_plausible_allowed | ready_for_promotion_review_pool |
| Joe Flacco | QB | CIN | eligible_for_projection_promotion | active_plausible | -17 | 14 | 12.8 | active_plausible_allowed | ready_for_promotion_review_pool |
| Desmond Ridder | QB | GB | eligible_for_projection_promotion | active_plausible | 16.2 | 5 | 6.9 | active_plausible_allowed | ready_for_promotion_review_pool |
| Jacoby Brissett | QB | ARI | eligible_for_projection_promotion | active_plausible | -13.9 | 14 | 12.9 | active_plausible_allowed | ready_for_promotion_review_pool |
| Jalen Coker | WR | CAR | eligible_for_projection_promotion | active_plausible | 13 | 11 | 12.4 | active_plausible_allowed | ready_for_promotion_review_pool |
| Chris Godwin | WR | TB | eligible_for_projection_promotion | active_plausible | -12.8 | 12 | 11 | active_plausible_allowed | ready_for_promotion_review_pool |
| Kayshon Boutte | WR | NE | eligible_for_projection_promotion | active_plausible | 12.6 | 13 | 14.8 | active_plausible_allowed | ready_for_promotion_review_pool |
| Carson Wentz | QB | MIN | eligible_for_projection_promotion | active_plausible | 12.4 | 3 | 4 | active_plausible_allowed | ready_for_promotion_review_pool |
| Kareem Hunt | RB | KC | eligible_for_projection_promotion | active_plausible | 12.4 | 15 | 16.3 | active_plausible_allowed | ready_for_promotion_review_pool |
| Athan Kaliakmanis | QB | WAS | eligible_for_projection_promotion | rookie_or_new_player | 12 | 2 | 4 | rookie_allowed | ready_for_promotion_review_pool |
| Behren Morton | QB | NE | eligible_for_projection_promotion | rookie_or_new_player | 12 | 2 | 4 | rookie_allowed | ready_for_promotion_review_pool |
| Byron Leftwich | QB | PIT | eligible_for_projection_promotion | rookie_or_new_player | 12 | 2 | 4 | rookie_allowed | ready_for_promotion_review_pool |
| Cade Klubnik | QB | NYJ | eligible_for_projection_promotion | rookie_or_new_player | 12 | 2 | 4 | rookie_allowed | ready_for_promotion_review_pool |
| Carson Beck | QB | ARI | eligible_for_projection_promotion | rookie_or_new_player | 12 | 2 | 4 | rookie_allowed | ready_for_promotion_review_pool |
| Cole Payton | QB | PHI | eligible_for_projection_promotion | rookie_or_new_player | 12 | 2 | 4 | rookie_allowed | ready_for_promotion_review_pool |
| Daniel Jones | QB | IND | eligible_for_projection_promotion | active_plausible | -12 | 14 | 13.2 | active_plausible_allowed | ready_for_promotion_review_pool |
| Drew Allar | QB | PIT | eligible_for_projection_promotion | rookie_or_new_player | 12 | 2 | 4 | rookie_allowed | ready_for_promotion_review_pool |
| Fernando Mendoza | QB | LV | eligible_for_projection_promotion | rookie_or_new_player | 12 | 2 | 4 | rookie_allowed | ready_for_promotion_review_pool |
| Garrett Nussmeier | QB | KC | eligible_for_projection_promotion | rookie_or_new_player | 12 | 2 | 4 | rookie_allowed | ready_for_promotion_review_pool |
| Haynes King | QB | CAR | eligible_for_projection_promotion | rookie_or_new_player | 12 | 2 | 4 | rookie_allowed | ready_for_promotion_review_pool |
| Jack Strand | QB | ATL | eligible_for_projection_promotion | rookie_or_new_player | 12 | 2 | 4 | rookie_allowed | ready_for_promotion_review_pool |
| Jacob Clark | QB | LV | eligible_for_projection_promotion | rookie_or_new_player | 12 | 2 | 4 | rookie_allowed | ready_for_promotion_review_pool |
| Jalon Daniels | QB | TB | eligible_for_projection_promotion | rookie_or_new_player | 12 | 2 | 4 | rookie_allowed | ready_for_promotion_review_pool |
| Joe Fagnano | QB | BAL | eligible_for_projection_promotion | rookie_or_new_player | 12 | 2 | 4 | rookie_allowed | ready_for_promotion_review_pool |

## Top Manual-Review Movements

| Player | Pos | Team | Class | Universe | Points Delta | Current G | v8.2 G | Reasons | Action |
|---|---|---|---|---|---:|---:|---:|---|---|
| Ashton Jeanty | RB | LV | manual_review_before_promotion | active_plausible | 43.5 | 9 | 12 | active_veteran_large_movement_review critical_movement_manual_review high_impact_manual_review | manual_review_required_before_promotion |
| RJ Harvey | RB | DEN | manual_review_before_promotion | active_plausible | 36.3 | 9 | 12 | active_veteran_large_movement_review critical_movement_manual_review high_impact_manual_review | manual_review_required_before_promotion |
| Quinshon Judkins | RB | CLE | manual_review_before_promotion | active_plausible | 32.4 | 9 | 11.7 | active_veteran_large_movement_review critical_movement_manual_review high_impact_manual_review | manual_review_required_before_promotion |
| TreVeyon Henderson | RB | NE | manual_review_before_promotion | active_plausible | 32.1 | 9 | 12 | active_veteran_large_movement_review critical_movement_manual_review high_impact_manual_review | manual_review_required_before_promotion |
| Tyler Shough | QB | NO | manual_review_before_promotion | low_confidence_plausible | 29 | 5 | 7 | critical_movement_manual_review high_impact_manual_review | manual_review_required_before_promotion |
| Woody Marks | RB | HOU | manual_review_before_promotion | active_plausible | 27.9 | 9 | 12 | active_veteran_large_movement_review critical_movement_manual_review high_impact_manual_review | manual_review_required_before_promotion |
| Jacory Croskey-Merritt | RB | WAS | manual_review_before_promotion | active_plausible | 25.5 | 9 | 12 | active_veteran_large_movement_review critical_movement_manual_review high_impact_manual_review | manual_review_required_before_promotion |
| J.J. McCarthy | QB | MIN | manual_review_before_promotion | low_confidence_plausible | 25.4 | 5 | 7 | critical_movement_manual_review high_impact_manual_review | manual_review_required_before_promotion |
| Kyle Monangai | RB | CHI | manual_review_before_promotion | active_plausible | 25.2 | 9 | 12 | active_veteran_large_movement_review critical_movement_manual_review high_impact_manual_review | manual_review_required_before_promotion |
| Alex Hale | K | GB | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Andrew Mevis | K | JAX | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Austin MacGinnis | K | LA | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| B.T. Potter | K | TB | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Blake Haubeil | K | CAR | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Cole Hedlund | K | IND | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| David Marvin | K | ATL | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Dominic Zvada | K | NYG | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Drew Stevens | K | WAS | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Gabe Brkic | K | GB | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Gabriel Plascencia | K | CHI | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Jack Podlesny | K | GB | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Jake Verity | K | JAX | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| James McCourt | K | LV | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| James Turner | K | DET | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Jonathan Garibay | K | DAL | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |

## Top Blocked Movements

| Player | Pos | Team | Class | Universe | Points Delta | Current G | v8.2 G | Reasons | Action |
|---|---|---|---|---|---:|---:|---:|---|---|
| Eli Manning | QB | NYG | blocked_from_promotion | retired_or_legacy_suspect | 29 | 5 | 7 | manual_name_flag_blocked retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Philip Rivers | QB | IND | blocked_from_promotion | retired_or_legacy_suspect | 25.8 | 5 | 7 | manual_name_flag_blocked retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Derrick Willies | WR | CLE | blocked_from_promotion | retired_or_legacy_suspect | 24.6 | 1 | 3.7 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Doug Martin | RB | OAK | blocked_from_promotion | retired_or_legacy_suspect | 23.7 | 9 | 12 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Isaiah Crowell | RB | LV | blocked_from_promotion | retired_or_legacy_suspect | 21.6 | 9 | 11 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Wes Hills | RB | DET | blocked_from_promotion | retired_or_legacy_suspect | 21.1 | 1 | 2.3 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Devlin Hodges | QB | PIT | blocked_from_promotion | retired_or_legacy_suspect | 20.8 | 5 | 8.1 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Keith Ford | RB | GB | blocked_from_promotion | retired_or_legacy_suspect | 20.8 | 1 | 4.2 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Dwayne Haskins | QB | PIT | blocked_from_promotion | retired_or_legacy_suspect | 19.8 | 5 | 7 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Lenzy Pipkins | DB | CLE | blocked_from_promotion | retired_or_legacy_suspect | 19.5 | 1 | 2.3 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Chris Ivory | RB | BUF | blocked_from_promotion | retired_or_legacy_suspect | 18.8 | 9 | 12.3 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Alfred Blue | RB | JAX | blocked_from_promotion | retired_or_legacy_suspect | 18 | 9 | 12 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Chris Conte | DB | TB | blocked_from_promotion | retired_or_legacy_suspect | 18 | 1 | 2.5 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Jacquizz Rodgers | RB | NO | blocked_from_promotion | retired_or_legacy_suspect | 16.5 | 9 | 11.9 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| LeGarrette Blount | RB | DET | blocked_from_promotion | retired_or_legacy_suspect | 16.5 | 9 | 12 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Cam Newton | QB | CAR | blocked_from_promotion | retired_or_legacy_suspect | 16.2 | 5 | 6.2 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Emmanuel Sanders | WR | BUF | blocked_from_promotion | retired_or_legacy_suspect | 15.7 | 15 | 16.6 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Jake Luton | QB | LV | blocked_from_promotion | retired_or_legacy_suspect | 14.1 | 3 | 4.5 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| William Hayes | DL | MIA | blocked_from_promotion | retired_or_legacy_suspect | 14 | 1 | 2.4 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| JaQuan Hardy | RB | DEN | blocked_from_promotion | retired_or_legacy_suspect | 13.5 | 1 | 4 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Devonta Freeman | RB | BAL | blocked_from_promotion | retired_or_legacy_suspect | 13.4 | 11 | 12.4 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Cameron Meredith | WR | NE | blocked_from_promotion | retired_or_legacy_suspect | 13.2 | 3 | 4.5 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Brock Coyle | LB | SF | blocked_from_promotion | retired_or_legacy_suspect | 13 | 1 | 2.3 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Kyron Brown | DB | BUF | blocked_from_promotion | retired_or_legacy_suspect | 13 | 1 | 2.3 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Paul Richardson | WR | SEA | blocked_from_promotion | retired_or_legacy_suspect | 13 | 8 | 9.8 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |

## Top Shadow-Only Movements

| Player | Pos | Team | Class | Universe | Points Delta | Current G | v8.2 G | Reasons | Action |
|---|---|---|---|---|---:|---:|---:|---|---|
| Jaylin Simpson | DB | GB | shadow_only | low_confidence_plausible | 19.5 | 1 | 2.5 | low_prior_shadow_only | keep_shadow_only |
| Phil Mafah | RB | DAL | shadow_only | low_confidence_plausible | 18.5 | 1 | 2.7 | low_prior_shadow_only | keep_shadow_only |
| Shedeur Sanders | QB | CLE | shadow_only | low_confidence_plausible | 18.5 | 5 | 6.7 | low_prior_shadow_only | keep_shadow_only |
| Easton Stick | QB | IND | shadow_only | stale_historical_signal | 17.9 | 3 | 4.9 | no_2026_roster_signal_blocked stale_signal_shadow_only | keep_shadow_only |
| Alijah Huzzie | DB | HOU | shadow_only | low_confidence_plausible | 15.6 | 1 | 2.3 | low_prior_shadow_only | keep_shadow_only |
| Ricky Barber | DL | WAS | shadow_only | low_confidence_plausible | 15.6 | 1 | 2.2 | low_prior_shadow_only | keep_shadow_only |
| Tayler Hawkins | DB | SF | shadow_only | stale_historical_signal | 15.6 | 1 | 2.3 | no_2026_roster_signal_blocked stale_signal_shadow_only | keep_shadow_only |
| Johnathan Baldwin | DB | GB | shadow_only | low_confidence_plausible | 14.3 | 1 | 2.3 | low_prior_shadow_only | keep_shadow_only |
| Vincent Gray | DB | CLE | shadow_only | stale_historical_signal | 14.3 | 1 | 2.3 | no_2026_roster_signal_blocked stale_signal_shadow_only | keep_shadow_only |
| Dillon Gabriel | QB | CLE | shadow_only | low_confidence_plausible | 14 | 5 | 7 | low_prior_shadow_only | keep_shadow_only |
| Jamon Johnson | LB | GB | shadow_only | low_confidence_plausible | 14 | 2 | 3 | low_prior_shadow_only | keep_shadow_only |
| Jawhar Jordan | RB | HOU | shadow_only | low_confidence_plausible | 13.3 | 3 | 4.8 | low_prior_shadow_only | keep_shadow_only |
| Leonard Fournette | RB | BUF | shadow_only | stale_historical_signal | -13.3 | 9 | 7.5 | no_2026_roster_signal_blocked stale_signal_shadow_only | keep_shadow_only |
| Jacob Kibodi | RB | CLE | shadow_only | low_confidence_plausible | 13.2 | 1 | 3.7 | low_prior_shadow_only | keep_shadow_only |
| Theo Wease | WR | MIA | shadow_only | low_confidence_plausible | 12.9 | 3 | 4.5 | low_prior_shadow_only | keep_shadow_only |
| Rondale Moore | WR | MIN | shadow_only | stale_historical_signal | 12.8 | 13 | 14.6 | no_2026_roster_signal_blocked stale_signal_shadow_only | keep_shadow_only |
| Trevor Siemian | QB | ATL | shadow_only | stale_historical_signal | 12.6 | 4 | 5.6 | no_2026_roster_signal_blocked stale_signal_shadow_only | keep_shadow_only |
| Daylen Baldwin | WR | ARI | shadow_only | stale_historical_signal | 12.2 | 1 | 3.7 | no_2026_roster_signal_blocked stale_signal_shadow_only | keep_shadow_only |
| Jordan James | RB | SF | shadow_only | low_confidence_plausible | 12.2 | 1 | 3.7 | low_prior_shadow_only | keep_shadow_only |
| Sincere McCormick | RB | SF | shadow_only | low_confidence_plausible | 12.2 | 3 | 4.8 | low_prior_shadow_only | keep_shadow_only |
| Davis Webb | QB | NYG | shadow_only | stale_historical_signal | 11.6 | 1 | 1.9 | no_2026_roster_signal_blocked stale_signal_shadow_only | keep_shadow_only |
| DeVante Parker | WR | PHI | shadow_only | stale_historical_signal | 11.6 | 11 | 12.5 | no_2026_roster_signal_blocked stale_signal_shadow_only | keep_shadow_only |
| Jakobie Keeney-James | WR | GB | shadow_only | low_confidence_plausible | 11.2 | 1 | 4.2 | low_prior_shadow_only | keep_shadow_only |
| Spencer Brown | RB | ATL | shadow_only | stale_historical_signal | 11.1 | 1 | 4 | no_2026_roster_signal_blocked stale_signal_shadow_only | keep_shadow_only |
| Cole Beasley | WR | NYG | shadow_only | stale_historical_signal | -10.8 | 12 | 10.6 | no_2026_roster_signal_blocked stale_signal_shadow_only | keep_shadow_only |

## All Critical Movement Rows

| Player | Pos | Team | Class | Universe | Points Delta | Current G | v8.2 G | Reasons | Action |
|---|---|---|---|---|---:|---:|---:|---|---|
| Ashton Jeanty | RB | LV | manual_review_before_promotion | active_plausible | 43.5 | 9 | 12 | active_veteran_large_movement_review critical_movement_manual_review high_impact_manual_review | manual_review_required_before_promotion |
| RJ Harvey | RB | DEN | manual_review_before_promotion | active_plausible | 36.3 | 9 | 12 | active_veteran_large_movement_review critical_movement_manual_review high_impact_manual_review | manual_review_required_before_promotion |
| Quinshon Judkins | RB | CLE | manual_review_before_promotion | active_plausible | 32.4 | 9 | 11.7 | active_veteran_large_movement_review critical_movement_manual_review high_impact_manual_review | manual_review_required_before_promotion |
| TreVeyon Henderson | RB | NE | manual_review_before_promotion | active_plausible | 32.1 | 9 | 12 | active_veteran_large_movement_review critical_movement_manual_review high_impact_manual_review | manual_review_required_before_promotion |
| Eli Manning | QB | NYG | blocked_from_promotion | retired_or_legacy_suspect | 29 | 5 | 7 | manual_name_flag_blocked retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Tyler Shough | QB | NO | manual_review_before_promotion | low_confidence_plausible | 29 | 5 | 7 | critical_movement_manual_review high_impact_manual_review | manual_review_required_before_promotion |
| Woody Marks | RB | HOU | manual_review_before_promotion | active_plausible | 27.9 | 9 | 12 | active_veteran_large_movement_review critical_movement_manual_review high_impact_manual_review | manual_review_required_before_promotion |
| Philip Rivers | QB | IND | blocked_from_promotion | retired_or_legacy_suspect | 25.8 | 5 | 7 | manual_name_flag_blocked retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Jacory Croskey-Merritt | RB | WAS | manual_review_before_promotion | active_plausible | 25.5 | 9 | 12 | active_veteran_large_movement_review critical_movement_manual_review high_impact_manual_review | manual_review_required_before_promotion |
| J.J. McCarthy | QB | MIN | manual_review_before_promotion | low_confidence_plausible | 25.4 | 5 | 7 | critical_movement_manual_review high_impact_manual_review | manual_review_required_before_promotion |
| Kyle Monangai | RB | CHI | manual_review_before_promotion | active_plausible | 25.2 | 9 | 12 | active_veteran_large_movement_review critical_movement_manual_review high_impact_manual_review | manual_review_required_before_promotion |
| Derrick Willies | WR | CLE | blocked_from_promotion | retired_or_legacy_suspect | 24.6 | 1 | 3.7 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Alex Hale | K | GB | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Andrew Mevis | K | JAX | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Austin MacGinnis | K | LA | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| B.T. Potter | K | TB | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Blake Haubeil | K | CAR | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Cole Hedlund | K | IND | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| David Marvin | K | ATL | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Dominic Zvada | K | NYG | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Drew Stevens | K | WAS | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Gabe Brkic | K | GB | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Gabriel Plascencia | K | CHI | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Jack Podlesny | K | GB | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Jake Verity | K | JAX | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| James McCourt | K | LV | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| James Turner | K | DET | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Jonathan Garibay | K | DAL | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Jose Borregales | K | TB | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Justin Rohrwasser | K | NE | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Kansei Matsuzawa | K | LV | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Laith Marjan | K | PIT | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Lenny Krieg | K | ATL | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Maddux Trujillo | K | BUF | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Mark McNamee | K | GB | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Marshall Morgan | K | BUF | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Mason Shipley | K | NO | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Mike Meyer | K | JAX | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Quinn Nordin | K | NE | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Ross Martin | K | CLE | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Tanner Brown | K | ATL | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Trevor Moore | K | TB | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Tucker McCann | K | TEN | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Tyler Davis | K | BUF | manual_review_before_promotion | rookie_or_new_player | 24 | 8 | 12 | critical_movement_manual_review kicker_policy_shadow_only | review_kicker_policy_before_promotion |
| Doug Martin | RB | OAK | blocked_from_promotion | retired_or_legacy_suspect | 23.7 | 9 | 12 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Russell Wilson | QB | NYG | manual_review_before_promotion | active_plausible | 22.9 | 5 | 6.8 | active_veteran_large_movement_review critical_movement_manual_review high_impact_manual_review | manual_review_required_before_promotion |
| Dyontae Johnson | LB | NYG | manual_review_before_promotion | low_confidence_plausible | 22.1 | 1 | 2.3 | critical_movement_manual_review | manual_review_required_before_promotion |
| Isaiah Crowell | RB | LV | blocked_from_promotion | retired_or_legacy_suspect | 21.6 | 9 | 11 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Wes Hills | RB | DET | blocked_from_promotion | retired_or_legacy_suspect | 21.1 | 1 | 2.3 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Tyrod Taylor | QB | GB | manual_review_before_promotion | active_plausible | 20.9 | 5 | 7.2 | active_veteran_large_movement_review critical_movement_manual_review high_impact_manual_review | manual_review_required_before_promotion |
| Devlin Hodges | QB | PIT | blocked_from_promotion | retired_or_legacy_suspect | 20.8 | 5 | 8.1 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Keith Ford | RB | GB | blocked_from_promotion | retired_or_legacy_suspect | 20.8 | 1 | 4.2 | retired_legacy_blocked | exclude_from_promotion_candidate_pool |
| Deshaun Watson | QB | CLE | manual_review_before_promotion | active_plausible | 20.6 | 5 | 6.6 | active_veteran_large_movement_review critical_movement_manual_review high_impact_manual_review | manual_review_required_before_promotion |
| Austin Ekeler | RB | WAS | manual_review_before_promotion | active_plausible | -20.5 | 9 | 6.8 | active_veteran_large_movement_review critical_movement_manual_review high_impact_manual_review | manual_review_required_before_promotion |

## Notes

- Dry-run/read-only promotion candidate pool audit only.
- Rows are classified for future promotion review; no projection artifacts are filtered or mutated.
- No live projections, 2026 production outputs, Supabase writes, War Room UI, Blackbird Rank, or Draft Suggestion ordering are changed.
- K rows are intentionally kept out of the initial eligible promotion pool until kicker low-prior fallback policy is reviewed.
