# Projection Universe Eligibility Audit 2026

Dry run: true
Read only: true
Verdict: universe_blocked_for_promotion

## Summary

```json
{
  "active_plausible": 1645,
  "low_confidence_plausible": 417,
  "rookie_or_new_player": 1689,
  "stale_historical_signal": 639,
  "retired_or_legacy_suspect": 1245,
  "manual_review_required": 0
}
```

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| no_live_outputs_changed | PASS | Audit reads dry-run artifacts and writes only audit artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is imported or called. |
| rankings_unchanged | PASS | Ranking movement is copied from shadow diagnostics only. |
| draft_suggestions_unchanged | PASS | Draft suggestion code paths are not imported or executed. |
| war_room_unchanged | PASS | War Room UI code is not imported or modified. |
| critical_movements_classified | PASS | 54 critical movement rows classified. |
| legacy_suspects_reported | PASS | 1245 retired/legacy suspects reported. |

## Position Summary

| Segment | Total | Active | Low Conf | Rookie/New | Stale | Retired/Legacy | Manual Review |
|---|---:|---:|---:|---:|---:|---:|---:|
| QB | 293 | 74 | 22 | 120 | 31 | 46 | 0 |
| RB | 686 | 157 | 50 | 261 | 73 | 145 | 0 |
| WR | 1211 | 243 | 56 | 607 | 103 | 202 | 0 |
| TE | 570 | 129 | 25 | 260 | 44 | 112 | 0 |
| K | 127 | 46 | 6 | 32 | 14 | 29 | 0 |
| DL | 803 | 307 | 73 | 120 | 106 | 197 | 0 |
| LB | 823 | 294 | 81 | 123 | 105 | 220 | 0 |
| DB | 1122 | 395 | 104 | 166 | 163 | 294 | 0 |
| DST | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Cohort Summary

| Segment | Total | Active | Low Conf | Rookie/New | Stale | Retired/Legacy | Manual Review |
|---|---:|---:|---:|---:|---:|---:|---:|
| rookie_or_new_player | 1689 | 0 | 0 | 1689 | 0 | 0 | 0 |
| low_prior_sample | 2973 | 0 | 417 | 1689 | 204 | 663 | 0 |
| stale_historical_signal | 639 | 0 | 0 | 0 | 639 | 0 | 0 |
| retired_or_legacy_suspect | 1245 | 0 | 0 | 0 | 0 | 1245 | 0 |
| manual_review_required | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| idp | 2748 | 996 | 258 | 409 | 374 | 711 | 0 |
| offense | 2760 | 603 | 153 | 1248 | 251 | 505 | 0 |
| kicker | 127 | 46 | 6 | 32 | 14 | 29 | 0 |

## Critical Movement Review

| Player | Pos | Team | Status | Reasons | Point Move | Action | Last Active |
|---|---|---|---|---|---:|---|---:|
| Ashton Jeanty | RB | LV | active_plausible | has_current_team large_expected_games_delta no_2026_roster_signal recent_nfl_activity shadow_critical_movement | 43.5 | manual_review_before_promotion | 2025 |
| RJ Harvey | RB | DEN | active_plausible | has_current_team large_expected_games_delta no_2026_roster_signal recent_nfl_activity shadow_critical_movement | 36.3 | manual_review_before_promotion | 2025 |
| Quinshon Judkins | RB | CLE | active_plausible | has_current_team large_expected_games_delta no_2026_roster_signal recent_nfl_activity shadow_critical_movement | 32.4 | manual_review_before_promotion | 2025 |
| TreVeyon Henderson | RB | NE | active_plausible | has_current_team large_expected_games_delta no_2026_roster_signal recent_nfl_activity shadow_critical_movement | 32.1 | manual_review_before_promotion | 2025 |
| Eli Manning | QB | NYG | retired_or_legacy_suspect | has_current_team large_expected_games_delta legacy_name_match manual_review_name_flag no_2026_roster_signal no_recent_nfl_activity old_last_seen_season shadow_critical_movement | 29 | exclude_from_promotion_candidate_pool | 2019 |
| Tyler Shough | QB | NO | low_confidence_plausible | has_current_team large_expected_games_delta no_2026_roster_signal recent_nfl_activity shadow_critical_movement | 29 | manual_review_before_promotion | 2025 |
| Woody Marks | RB | HOU | active_plausible | has_current_team large_expected_games_delta no_2026_roster_signal recent_nfl_activity shadow_critical_movement | 27.9 | manual_review_before_promotion | 2025 |
| Philip Rivers | QB | IND | retired_or_legacy_suspect | has_current_team large_expected_games_delta legacy_name_match manual_review_name_flag no_2026_roster_signal recent_nfl_activity shadow_critical_movement | 25.8 | exclude_from_promotion_candidate_pool | 2025 |
| Jacory Croskey-Merritt | RB | WAS | active_plausible | has_current_team large_expected_games_delta no_2026_roster_signal recent_nfl_activity shadow_critical_movement | 25.5 | manual_review_before_promotion | 2025 |
| J.J. McCarthy | QB | MIN | low_confidence_plausible | has_current_team large_expected_games_delta no_2026_roster_signal recent_nfl_activity shadow_critical_movement | 25.4 | manual_review_before_promotion | 2025 |
| Kyle Monangai | RB | CHI | active_plausible | has_current_team large_expected_games_delta no_2026_roster_signal recent_nfl_activity shadow_critical_movement | 25.2 | manual_review_before_promotion | 2025 |
| Derrick Willies | WR | CLE | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season shadow_critical_movement | 24.6 | exclude_from_promotion_candidate_pool | 2018 |
| Alex Hale | K | GB | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Andrew Mevis | K | JAX | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Austin MacGinnis | K | LA | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| B.T. Potter | K | TB | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Blake Haubeil | K | CAR | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Cole Hedlund | K | IND | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| David Marvin | K | ATL | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Dominic Zvada | K | NYG | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Drew Stevens | K | WAS | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Gabe Brkic | K | GB | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Gabriel Plascencia | K | CHI | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Jack Podlesny | K | GB | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Jake Verity | K | JAX | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| James McCourt | K | LV | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| James Turner | K | DET | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Jonathan Garibay | K | DAL | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Jose Borregales | K | TB | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Justin Rohrwasser | K | NE | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Kansei Matsuzawa | K | LV | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Laith Marjan | K | PIT | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Lenny Krieg | K | ATL | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Maddux Trujillo | K | BUF | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Mark McNamee | K | GB | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Marshall Morgan | K | BUF | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Mason Shipley | K | NO | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Mike Meyer | K | JAX | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Quinn Nordin | K | NE | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Ross Martin | K | CLE | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Tanner Brown | K | ATL | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Trevor Moore | K | TB | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Tucker McCann | K | TEN | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Tyler Davis | K | BUF | rookie_or_new_player | has_current_team kicker_low_prior_fallback large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity rookie_current_class shadow_critical_movement | 24 | needs_kicker_policy_review |  |
| Doug Martin | RB | OAK | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season shadow_critical_movement | 23.7 | exclude_from_promotion_candidate_pool | 2018 |
| Russell Wilson | QB | NYG | active_plausible | has_current_team no_2026_roster_signal recent_nfl_activity shadow_critical_movement | 22.9 | manual_review_before_promotion | 2025 |
| Dyontae Johnson | LB | NYG | low_confidence_plausible | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity shadow_critical_movement | 22.1 | manual_review_before_promotion | 2024 |
| Isaiah Crowell | RB | LV | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season shadow_critical_movement | 21.6 | exclude_from_promotion_candidate_pool | 2018 |
| Wes Hills | RB | DET | retired_or_legacy_suspect | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season shadow_critical_movement | 21.1 | exclude_from_promotion_candidate_pool | 2019 |
| Tyrod Taylor | QB | GB | active_plausible | has_current_team large_expected_games_delta no_2026_roster_signal recent_nfl_activity shadow_critical_movement | 20.9 | manual_review_before_promotion | 2025 |
| Devlin Hodges | QB | PIT | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season shadow_critical_movement | 20.8 | exclude_from_promotion_candidate_pool | 2019 |
| Keith Ford | RB | GB | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season shadow_critical_movement | 20.8 | exclude_from_promotion_candidate_pool | 2018 |
| Deshaun Watson | QB | CLE | active_plausible | has_current_team no_2026_roster_signal no_recent_nfl_activity shadow_critical_movement | 20.6 | manual_review_before_promotion | 2024 |
| Austin Ekeler | RB | WAS | active_plausible | has_current_team large_expected_games_delta no_2026_roster_signal recent_nfl_activity shadow_critical_movement | -20.5 | manual_review_before_promotion | 2025 |

## Kicker Review

```json
{
  "totalKRows": 127,
  "lowPriorFallbackRows": 127,
  "criticalMovementRows": 32,
  "movingEightToTwelveExpectedGames": 32,
  "statusCounts": {
    "retired_or_legacy_suspect": 29,
    "rookie_or_new_player": 32,
    "active_plausible": 46,
    "low_confidence_plausible": 6,
    "stale_historical_signal": 14
  },
  "recommendation": "Keep K on current/v7 fallback during early v8.2 shadow adoption until low-prior kicker policy is reviewed."
}
```

## Retired / Legacy Suspects

| Player | Pos | Team | Status | Reasons | Point Move | Action | Last Active |
|---|---|---|---|---|---:|---|---:|
| Eli Manning | QB | NYG | retired_or_legacy_suspect | has_current_team large_expected_games_delta legacy_name_match manual_review_name_flag no_2026_roster_signal no_recent_nfl_activity old_last_seen_season shadow_critical_movement | 29 | exclude_from_promotion_candidate_pool | 2019 |
| Philip Rivers | QB | IND | retired_or_legacy_suspect | has_current_team large_expected_games_delta legacy_name_match manual_review_name_flag no_2026_roster_signal recent_nfl_activity shadow_critical_movement | 25.8 | exclude_from_promotion_candidate_pool | 2025 |
| Derrick Willies | WR | CLE | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season shadow_critical_movement | 24.6 | exclude_from_promotion_candidate_pool | 2018 |
| Doug Martin | RB | OAK | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season shadow_critical_movement | 23.7 | exclude_from_promotion_candidate_pool | 2018 |
| Isaiah Crowell | RB | LV | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season shadow_critical_movement | 21.6 | exclude_from_promotion_candidate_pool | 2018 |
| Wes Hills | RB | DET | retired_or_legacy_suspect | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season shadow_critical_movement | 21.1 | exclude_from_promotion_candidate_pool | 2019 |
| Devlin Hodges | QB | PIT | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season shadow_critical_movement | 20.8 | exclude_from_promotion_candidate_pool | 2019 |
| Keith Ford | RB | GB | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season shadow_critical_movement | 20.8 | exclude_from_promotion_candidate_pool | 2018 |
| Dwayne Haskins | QB | PIT | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 19.8 | exclude_from_promotion_candidate_pool | 2020 |
| Lenzy Pipkins | DB | CLE | retired_or_legacy_suspect | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 19.5 | exclude_from_promotion_candidate_pool | 2018 |
| Chris Ivory | RB | BUF | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 18.8 | exclude_from_promotion_candidate_pool | 2018 |
| Alfred Blue | RB | JAX | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 18 | exclude_from_promotion_candidate_pool | 2018 |
| Chris Conte | DB | TB | retired_or_legacy_suspect | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 18 | exclude_from_promotion_candidate_pool | 2018 |
| Jacquizz Rodgers | RB | NO | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 16.5 | exclude_from_promotion_candidate_pool | 2018 |
| LeGarrette Blount | RB | DET | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 16.5 | exclude_from_promotion_candidate_pool | 2018 |
| Cam Newton | QB | CAR | retired_or_legacy_suspect | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 16.2 | exclude_from_promotion_candidate_pool | 2021 |
| Emmanuel Sanders | WR | BUF | retired_or_legacy_suspect | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 15.7 | exclude_from_promotion_candidate_pool | 2021 |
| Jake Luton | QB | LV | retired_or_legacy_suspect | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 14.1 | exclude_from_promotion_candidate_pool | 2020 |
| William Hayes | DL | MIA | retired_or_legacy_suspect | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 14 | exclude_from_promotion_candidate_pool | 2018 |
| JaQuan Hardy | RB | DEN | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 13.5 | exclude_from_promotion_candidate_pool | 2021 |
| Devonta Freeman | RB | BAL | retired_or_legacy_suspect | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 13.4 | exclude_from_promotion_candidate_pool | 2021 |
| Cameron Meredith | WR | NE | retired_or_legacy_suspect | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 13.2 | exclude_from_promotion_candidate_pool | 2018 |
| Brock Coyle | LB | SF | retired_or_legacy_suspect | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 13 | exclude_from_promotion_candidate_pool | 2018 |
| Kyron Brown | DB | BUF | retired_or_legacy_suspect | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 13 | exclude_from_promotion_candidate_pool | 2019 |
| Paul Richardson | WR | SEA | retired_or_legacy_suspect | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 13 | exclude_from_promotion_candidate_pool | 2019 |
| Eric Berry | DB | KC | retired_or_legacy_suspect | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 12 | exclude_from_promotion_candidate_pool | 2018 |
| Christian Miller | DL | CAR | retired_or_legacy_suspect | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 11.9 | exclude_from_promotion_candidate_pool | 2019 |
| Seth Williams | WR | DAL | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 11.9 | exclude_from_promotion_candidate_pool | 2021 |
| Alexander Myres | DB | IND | retired_or_legacy_suspect | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 11.7 | exclude_from_promotion_candidate_pool | 2020 |
| Derek Anderson | QB | BUF | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 11.7 | exclude_from_promotion_candidate_pool | 2018 |
| Garrett Gilbert | QB | NE | retired_or_legacy_suspect | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 11.5 | exclude_from_promotion_candidate_pool | 2021 |
| Jeremy Hill | RB | NE | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 11.1 | exclude_from_promotion_candidate_pool | 2018 |
| Jon Hilliman | RB | NYG | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 11.1 | exclude_from_promotion_candidate_pool | 2019 |
| Mike Glennon | QB | MIA | retired_or_legacy_suspect | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 11.1 | exclude_from_promotion_candidate_pool | 2021 |
| Dekoda Watson | LB | SEA | retired_or_legacy_suspect | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 11 | exclude_from_promotion_candidate_pool | 2018 |
| Cedrick Lattimore | DL | SEA | retired_or_legacy_suspect | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 10.8 | exclude_from_promotion_candidate_pool | 2020 |
| Mark Gilbert | DB | PIT | retired_or_legacy_suspect | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 10.4 | exclude_from_promotion_candidate_pool | 2021 |
| Eli Rogers | WR | PIT | retired_or_legacy_suspect | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 9.8 | exclude_from_promotion_candidate_pool | 2018 |
| Marshawn Lynch | RB | SEA | retired_or_legacy_suspect | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 9.8 | exclude_from_promotion_candidate_pool | 2019 |
| Brock Osweiler | QB | MIA | retired_or_legacy_suspect | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 9.7 | exclude_from_promotion_candidate_pool | 2018 |
| Trey Ragas | RB | LA | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 9.5 | exclude_from_promotion_candidate_pool | 2021 |
| Brandon LaFell | WR | OAK | retired_or_legacy_suspect | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 9.4 | exclude_from_promotion_candidate_pool | 2018 |
| Charcandrick West | RB | IND | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 9.4 | exclude_from_promotion_candidate_pool | 2018 |
| Derrius Guice | RB | WAS | retired_or_legacy_suspect | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 9.2 | exclude_from_promotion_candidate_pool | 2019 |
| Sean Mannion | QB | SEA | retired_or_legacy_suspect | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 9.2 | exclude_from_promotion_candidate_pool | 2021 |
| David Parry | DL | NE | retired_or_legacy_suspect | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 9.1 | exclude_from_promotion_candidate_pool | 2018 |
| Taylor Gabriel | WR | CHI | retired_or_legacy_suspect | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | -8.9 | exclude_from_promotion_candidate_pool | 2019 |
| Tyrell Williams | WR | DET | retired_or_legacy_suspect | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | -8.8 | exclude_from_promotion_candidate_pool | 2021 |
| Jeremy Kerley | WR | BUF | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 8.6 | exclude_from_promotion_candidate_pool | 2018 |
| Travaris Cadet | RB | CAR | retired_or_legacy_suspect | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | 8.6 | exclude_from_promotion_candidate_pool | 2018 |

## Notes

- Dry-run/read-only projection universe eligibility audit only.
- Rows are classified for review; no players are deleted or filtered from projection artifacts.
- No live projections, 2026 production outputs, Blackbird Rank, Draft Suggestion ordering, War Room UI, or Supabase data are changed.
