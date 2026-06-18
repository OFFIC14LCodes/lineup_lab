# Projection v8.2 Shadow Report 2026

Dry run: true
Read only: true
Current model: blackbird_expected_games_v7_family_selective
Shadow model: blackbird_expected_games_v8_2_high_impact_guardrail
Recommendation: shadow_candidate_with_manual_review

## Row Coverage

```json
{
  "currentLiveProjectionRows": 5635,
  "v82ShadowRows": 5635,
  "sharedRows": 5635,
  "currentOnlyRows": 0,
  "v82OnlyRows": 0,
  "rowsSkipped": 2686,
  "skipReasons": {
    "players_skipped_no_signal": 2686,
    "current_only_rows": 0,
    "v82_only_rows": 0
  },
  "positionCounts": {
    "DB": 1122,
    "DL": 803,
    "K": 127,
    "LB": 823,
    "QB": 293,
    "RB": 686,
    "TE": 570,
    "WR": 1211
  },
  "cohortCounts": {
    "idp": 2748,
    "idp_conservative": 1757,
    "low_prior_sample": 2973,
    "second_year_low_prior": 953,
    "no_prior_stats": 1689,
    "rookie": 483,
    "k_fallback": 127,
    "kicker": 127,
    "offense": 2760,
    "veteran_prior_sample": 831,
    "te_fallback": 570
  }
}
```

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| no_live_outputs_changed | PASS | Shadow report reads dry-run artifacts and writes only shadow artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is called by the shadow report module. |
| rankings_unchanged | PASS | Ranking movement is estimated in-memory only. |
| draft_suggestions_unchanged | PASS | Draft suggestion code paths are not imported or executed. |
| war_room_unchanged | PASS | War Room UI code is not imported or modified. |
| te_fallback_preserved | PASS | 570 TE fallback rows checked. |
| k_fallback_preserved | PASS | 127 K fallback rows checked. |
| critical_movements_reported | PASS | 54 critical rows reported. |
| elite_ppg_movements_guardrailed | PASS | 0 elite critical rows checked. |
| shadow_rows_generated | PASS | 5635 shared shadow rows. |

## Movement Buckets

```json
{
  "0": 2639,
  "0-5": 2177,
  "5-10": 662,
  "10-20": 103,
  "20+": 54
}
```

## Expected-Games Movement Buckets

```json
{
  "0": 2534,
  "0-0.5": 1546,
  "0.5-1": 583,
  "1-2": 372,
  "2-4": 600,
  "4+": 0
}
```

## Top 20 Player Movements

| Player | Pos | Team | Cohorts | Current G | v8.2 G | Games Delta | PPG | Points Delta | Risk | Flags | Reasons |
|---|---|---|---|---:|---:|---:|---:|---:|---|---|---|
| Ashton Jeanty | RB | LV | offense second_year_low_prior | 9 | 12 | 3 | 14.5 | 43.5 | critical | high_value_position large_games_movement rookie_or_low_prior | low_prior_v8_1_preserved |
| RJ Harvey | RB | DEN | offense second_year_low_prior | 9 | 12 | 3 | 12.1 | 36.3 | critical | high_value_position large_games_movement rookie_or_low_prior | low_prior_v8_1_preserved |
| Quinshon Judkins | RB | CLE | offense second_year_low_prior | 9 | 11.7 | 2.7 | 12 | 32.4 | critical | high_value_position large_games_movement rookie_or_low_prior | low_prior_v8_1_preserved |
| TreVeyon Henderson | RB | NE | offense second_year_low_prior | 9 | 12 | 3 | 10.7 | 32.1 | critical | high_value_position large_games_movement rookie_or_low_prior | low_prior_v8_1_preserved |
| Eli Manning | QB | NYG | offense veteran_prior_sample | 5 | 7 | 2 | 14.5 | 29 | critical | high_value_position large_games_movement qb_superflex_sensitive | v8_2_no_guardrail |
| Tyler Shough | QB | NO | low_prior_sample offense second_year_low_prior | 5 | 7 | 2 | 14.5 | 29 | critical | high_value_position large_games_movement qb_superflex_sensitive rookie_or_low_prior | low_prior_v8_1_preserved |
| Woody Marks | RB | HOU | offense second_year_low_prior | 9 | 12 | 3 | 9.3 | 27.9 | critical | high_value_position large_games_movement rookie_or_low_prior | low_prior_v8_1_preserved |
| Philip Rivers | QB | IND | offense veteran_prior_sample | 5 | 7 | 2 | 12.9 | 25.8 | critical | high_value_position large_games_movement qb_superflex_sensitive | v8_2_no_guardrail |
| Jacory Croskey-Merritt | RB | WAS | offense second_year_low_prior | 9 | 12 | 3 | 8.5 | 25.5 | critical | high_value_position large_games_movement rookie_or_low_prior | low_prior_v8_1_preserved |
| J.J. McCarthy | QB | MIN | low_prior_sample offense second_year_low_prior | 5 | 7 | 2 | 12.7 | 25.4 | critical | high_value_position large_games_movement qb_superflex_sensitive rookie_or_low_prior | low_prior_v8_1_preserved |
| Kyle Monangai | RB | CHI | offense second_year_low_prior | 9 | 12 | 3 | 8.4 | 25.2 | critical | high_value_position large_games_movement rookie_or_low_prior | low_prior_v8_1_preserved |
| Derrick Willies | WR | CLE | low_prior_sample offense second_year_low_prior | 1 | 3.7 | 2.7 | 9.1 | 24.6 | critical | high_value_position large_games_movement rookie_or_low_prior | low_prior_v8_1_preserved wr_v8_1_preserved |
| Alex Hale | K | GB | k_fallback kicker low_prior_sample no_prior_stats | 8 | 12 | 4 | 6 | 24 | critical | fallback_row large_games_movement rookie_or_low_prior | k_fallback_preserved |
| Andrew Mevis | K | JAX | k_fallback kicker low_prior_sample no_prior_stats | 8 | 12 | 4 | 6 | 24 | critical | fallback_row large_games_movement rookie_or_low_prior | k_fallback_preserved |
| Austin MacGinnis | K | LA | k_fallback kicker low_prior_sample no_prior_stats | 8 | 12 | 4 | 6 | 24 | critical | fallback_row large_games_movement rookie_or_low_prior | k_fallback_preserved |
| B.T. Potter | K | TB | k_fallback kicker low_prior_sample no_prior_stats | 8 | 12 | 4 | 6 | 24 | critical | fallback_row large_games_movement rookie_or_low_prior | k_fallback_preserved |
| Blake Haubeil | K | CAR | k_fallback kicker low_prior_sample no_prior_stats | 8 | 12 | 4 | 6 | 24 | critical | fallback_row large_games_movement rookie_or_low_prior | k_fallback_preserved |
| Cole Hedlund | K | IND | k_fallback kicker low_prior_sample no_prior_stats | 8 | 12 | 4 | 6 | 24 | critical | fallback_row large_games_movement rookie_or_low_prior | k_fallback_preserved |
| David Marvin | K | ATL | k_fallback kicker low_prior_sample no_prior_stats | 8 | 12 | 4 | 6 | 24 | critical | fallback_row large_games_movement rookie_or_low_prior | k_fallback_preserved |
| Dominic Zvada | K | NYG | k_fallback kicker low_prior_sample no_prior_stats | 8 | 12 | 4 | 6 | 24 | critical | fallback_row large_games_movement rookie_or_low_prior | k_fallback_preserved |

## Critical Movement Review

| Player | Pos | Team | Current G | v8.2 G | Games Delta | Points Delta | Why v8.2 moved | Guardrail | Review Status |
|---|---|---|---:|---:|---:|---:|---|---|---|
| Ashton Jeanty | RB | LV | 9 | 12 | 3 | 43.5 | low_prior_v8_1_preserved | false | needs_manual_review |
| RJ Harvey | RB | DEN | 9 | 12 | 3 | 36.3 | low_prior_v8_1_preserved | false | needs_manual_review |
| Quinshon Judkins | RB | CLE | 9 | 11.7 | 2.7 | 32.4 | low_prior_v8_1_preserved | false | needs_manual_review |
| TreVeyon Henderson | RB | NE | 9 | 12 | 3 | 32.1 | low_prior_v8_1_preserved | false | needs_manual_review |
| Eli Manning | QB | NYG | 5 | 7 | 2 | 29 | v8_2_no_guardrail | false | needs_manual_review |
| Tyler Shough | QB | NO | 5 | 7 | 2 | 29 | low_prior_v8_1_preserved | false | needs_manual_review |
| Woody Marks | RB | HOU | 9 | 12 | 3 | 27.9 | low_prior_v8_1_preserved | false | needs_manual_review |
| Philip Rivers | QB | IND | 5 | 7 | 2 | 25.8 | v8_2_no_guardrail | false | needs_manual_review |
| Jacory Croskey-Merritt | RB | WAS | 9 | 12 | 3 | 25.5 | low_prior_v8_1_preserved | false | needs_manual_review |
| J.J. McCarthy | QB | MIN | 5 | 7 | 2 | 25.4 | low_prior_v8_1_preserved | false | needs_manual_review |
| Kyle Monangai | RB | CHI | 9 | 12 | 3 | 25.2 | low_prior_v8_1_preserved | false | needs_manual_review |
| Derrick Willies | WR | CLE | 1 | 3.7 | 2.7 | 24.6 | low_prior_v8_1_preserved wr_v8_1_preserved | false | needs_manual_review |
| Alex Hale | K | GB | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Andrew Mevis | K | JAX | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Austin MacGinnis | K | LA | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| B.T. Potter | K | TB | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Blake Haubeil | K | CAR | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Cole Hedlund | K | IND | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| David Marvin | K | ATL | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Dominic Zvada | K | NYG | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Drew Stevens | K | WAS | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Gabe Brkic | K | GB | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Gabriel Plascencia | K | CHI | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Jack Podlesny | K | GB | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Jake Verity | K | JAX | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| James McCourt | K | LV | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| James Turner | K | DET | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Jonathan Garibay | K | DAL | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Jose Borregales | K | TB | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Justin Rohrwasser | K | NE | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Kansei Matsuzawa | K | LV | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Laith Marjan | K | PIT | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Lenny Krieg | K | ATL | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Maddux Trujillo | K | BUF | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Mark McNamee | K | GB | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Marshall Morgan | K | BUF | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Mason Shipley | K | NO | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Mike Meyer | K | JAX | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Quinn Nordin | K | NE | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Ross Martin | K | CLE | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Tanner Brown | K | ATL | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Trevor Moore | K | TB | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Tucker McCann | K | TEN | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Tyler Davis | K | BUF | 8 | 12 | 4 | 24 | k_fallback_preserved | false | needs_manual_review |
| Doug Martin | RB | OAK | 9 | 12 | 3 | 23.7 | low_prior_v8_1_preserved | false | needs_manual_review |
| Russell Wilson | QB | NYG | 5 | 6.8 | 1.8 | 22.9 | v8_2_no_guardrail | false | needs_manual_review |
| Dyontae Johnson | LB | NYG | 1 | 2.3 | 1.3 | 22.1 | idp_v8_1_preserved | false | needs_manual_review |
| Isaiah Crowell | RB | LV | 9 | 11 | 2 | 21.6 | low_prior_v8_1_preserved | false | needs_manual_review |
| Wes Hills | RB | DET | 1 | 2.3 | 1.3 | 21.1 | low_prior_v8_1_preserved | false | needs_manual_review |
| Tyrod Taylor | QB | GB | 5 | 7.2 | 2.2 | 20.9 | v8_2_no_guardrail | false | needs_manual_review |
| Devlin Hodges | QB | PIT | 5 | 8.1 | 3.1 | 20.8 | low_prior_v8_1_preserved | false | needs_manual_review |
| Keith Ford | RB | GB | 1 | 4.2 | 3.2 | 20.8 | low_prior_v8_1_preserved | false | needs_manual_review |
| Deshaun Watson | QB | CLE | 5 | 6.6 | 1.6 | 20.6 | v8_2_no_guardrail | false | needs_manual_review |
| Austin Ekeler | RB | WAS | 9 | 6.8 | -2.2 | -20.5 | v8_2_no_guardrail | false | needs_manual_review |

## Position Movement Summary

| Segment | Rows | Avg Games Delta | Avg Points Delta | Move 5+ | Move 10+ | Move 20+ | Critical |
|---|---:|---:|---:|---:|---:|---:|---:|
| QB | 293 | 0.565 | 3.199 | 84 | 53 | 8 | 8 |
| RB | 686 | 0.592 | 1.669 | 129 | 32 | 12 | 12 |
| WR | 1211 | 0.276 | 0.493 | 200 | 18 | 1 | 1 |
| TE | 570 | 1.368 | 3.421 | 260 | 0 | 0 | 0 |
| K | 127 | 1.008 | 6.047 | 32 | 32 | 32 | 32 |
| DL | 803 | 0.496 | 1.805 | 41 | 6 | 0 | 0 |
| LB | 823 | 0.087 | 0.302 | 23 | 5 | 1 | 1 |
| DB | 1122 | 0.253 | 1.251 | 50 | 11 | 0 | 0 |
| DST | 0 | n/a | n/a | 0 | 0 | 0 | 0 |

## Cohort Movement Summary

| Segment | Rows | Avg Games Delta | Avg Points Delta | Move 5+ | Move 10+ | Move 20+ | Critical |
|---|---:|---:|---:|---:|---:|---:|---:|
| veteran_prior_sample | 831 | -0.018 | 0.087 | 139 | 37 | 6 | 6 |
| rookie | 483 | 0.769 | 2.617 | 178 | 25 | 0 | 0 |
| second_year_low_prior | 953 | 0.941 | 2.588 | 161 | 63 | 16 | 16 |
| no_prior_stats | 1689 | 0.748 | 2.329 | 470 | 57 | 32 | 32 |
| low_prior_sample | 2973 | 0.731 | 2.078 | 617 | 107 | 39 | 39 |
| te_fallback | 570 | 1.368 | 3.421 | 260 | 0 | 0 | 0 |
| k_fallback | 127 | 1.008 | 6.047 | 32 | 32 | 32 | 32 |
| idp | 2748 | 0.274 | 1.129 | 114 | 22 | 1 | 1 |
| offense | 2760 | 0.611 | 1.677 | 673 | 103 | 21 | 21 |
| kicker | 127 | 1.008 | 6.047 | 32 | 32 | 32 | 32 |

## Ranking Risk Preview

Estimated: true
Reason: Estimated from current and v8.2 projected total points within the dry-run snapshot row universe. No ranking state was mutated.
Rows with overall rank movement estimate: 5635
Rows with position rank movement estimate: 5635

## Notes

- Shadow/dev-only comparison infrastructure.
- The current model is read from the dry-run snapshot as blackbird_expected_games_v7_family_selective.
- No live projections, 2026 production outputs, Supabase writes, War Room UI, Blackbird Rank, or Draft Suggestion ordering are changed.
