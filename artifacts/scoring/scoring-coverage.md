# Scoring Coverage Audit Report

**Audited:** 2026-06-15T20:27:00.245Z
**Registry keys:** 119  |  **Engine keys:** 115
**Findings:** 0 errors, 0 warnings

## Coverage Status Overview

Independent dimensions below are separate 105-key reconciliations. They overlap conceptually and must not be added across sections.
Correction: the stale H3 report undercounted H2/H2.1 PBP support because `pass_pick6` and its alias `pass_int_td` were still classified as backlog after the derived-stat pipeline landed.

### Engine Implementation Status

| Engine status | Keys |
|---------------|------|
| implemented_verified | 115 |
| implemented_unverified | 0 |
| not_implemented | 4 |

### Data Availability Status

| Data status | Keys |
|-------------|------|
| nflverse_weekly_verified | 47 |
| nflverse_weekly_available | 0 |
| nflverse_weekly_derivable | 0 |
| nflverse_weekly_unwired | 0 |
| nflverse_pbp_derived | 7 |
| nflverse_pbp_derivable | 7 |
| requires_team_game_context | 16 |
| requires_new_source | 1 |
| not_safely_derivable | 0 |
| out_of_scope | 41 |

### Scope Classification

| Scope classification | Keys |
|----------------------|------|
| operational_now | 54 |
| current_scope_backlog | 24 |
| deferred_current_phase | 41 |

### Source Classification

| Source classification | Keys |
|-----------------------|------|
| nflverse_weekly_player_stats | 47 |
| nflverse_pbp_derived_stats | 14 |
| team_game_context | 16 |
| deferred_position_source | 42 |

### Verification Level

| Verification level | Keys |
|--------------------|------|
| real_play_verified | 5 |
| repository_test_verified | 114 |

## Keys by Stat Family

| Family | Keys |
|--------|------|
| first_down_bonuses | 5 |
| idp | 10 |
| kicking | 16 |
| long_td_bonuses | 11 |
| miscellaneous_skill | 5 |
| passing_outcomes | 5 |
| passing_volume | 5 |
| position_rec_bonuses | 6 |
| receiving | 6 |
| rushing | 5 |
| special_teams_skill | 4 |
| team_defense | 31 |
| yardage_threshold_bonuses | 10 |

## H2 / H2.1 Verification Table

| Scoring key | Engine status | Data status | Source | Persistence path | Scoring read path | Unit-test evidence | Integration-test evidence | Real-play verification evidence |
|-------------|---------------|-------------|--------|------------------|-------------------|--------------------|---------------------------|---------------------------------|
| `pass_pick6` | implemented_verified | nflverse_pbp_derived | nflverse_pbp_derived_stats | src/lib/providers/nflverse/pbp/pipeline.ts -> public.player_weekly_derived_stats(stats_json, stat_scope=nflverse_pbp_derived) | src/lib/scoring/server/derived-stats.ts -> mergeWithDerivedStats() -> src/lib/scoring/sleeper-keys.ts | src/lib/providers/nflverse/pbp/derive.test.ts — play classification, attribution, threshold, and invariant coverage. | src/lib/scoring/score-offense.test.ts — scoring with pass_pick6 and additive alias handling via pass_int_td. | Local archived 2025 nflverse PBP: game 2025_01_MIN_CHI, play 2188, week 1, passer J.McCarthy, qualifies as pick-six. |
| `rec_td_40p` | implemented_verified | nflverse_pbp_derived | nflverse_pbp_derived_stats | src/lib/providers/nflverse/pbp/pipeline.ts -> public.player_weekly_derived_stats(stats_json, stat_scope=nflverse_pbp_derived) | src/lib/scoring/server/derived-stats.ts -> mergeWithDerivedStats() -> src/lib/scoring/sleeper-keys.ts | src/lib/providers/nflverse/pbp/derive.test.ts — play classification, attribution, threshold, and invariant coverage. | src/lib/scoring/score-offense.test.ts — long-TD derived stat scores through the live scoring engine when present. | Local archived 2025 nflverse PBP: game 2025_01_TB_ATL, play 110, week 1, receiver B.Robinson, 50-yard receiving TD. |
| `rec_td_50p` | implemented_verified | nflverse_pbp_derived | nflverse_pbp_derived_stats | src/lib/providers/nflverse/pbp/pipeline.ts -> public.player_weekly_derived_stats(stats_json, stat_scope=nflverse_pbp_derived) | src/lib/scoring/server/derived-stats.ts -> mergeWithDerivedStats() -> src/lib/scoring/sleeper-keys.ts | src/lib/providers/nflverse/pbp/derive.test.ts — play classification, attribution, threshold, and invariant coverage. | src/lib/scoring/score-offense.test.ts — long-TD derived stat scores through the live scoring engine when present. | Local archived 2025 nflverse PBP: game 2025_01_TB_ATL, play 110, week 1, receiver B.Robinson, 50-yard receiving TD. |
| `rush_td_40p` | implemented_verified | nflverse_pbp_derived | nflverse_pbp_derived_stats | src/lib/providers/nflverse/pbp/pipeline.ts -> public.player_weekly_derived_stats(stats_json, stat_scope=nflverse_pbp_derived) | src/lib/scoring/server/derived-stats.ts -> mergeWithDerivedStats() -> src/lib/scoring/sleeper-keys.ts | src/lib/providers/nflverse/pbp/derive.test.ts — play classification, attribution, threshold, and invariant coverage. | src/lib/scoring/score-offense.test.ts — long-TD derived stat scores through the live scoring engine when present. | Local archived 2025 nflverse PBP: game 2025_01_BAL_BUF, play 3313, week 1, rusher D.Henry, 46-yard rushing TD. |
| `rush_td_50p` | implemented_verified | nflverse_pbp_derived | nflverse_pbp_derived_stats | src/lib/providers/nflverse/pbp/pipeline.ts -> public.player_weekly_derived_stats(stats_json, stat_scope=nflverse_pbp_derived) | src/lib/scoring/server/derived-stats.ts -> mergeWithDerivedStats() -> src/lib/scoring/sleeper-keys.ts | src/lib/providers/nflverse/pbp/derive.test.ts — play classification, attribution, threshold, and invariant coverage. | src/lib/scoring/score-offense.test.ts — long-TD derived stat scores through the live scoring engine when present. | Local archived 2025 nflverse PBP: game 2025_03_LV_WAS, play 1709, week 3, rusher J.McNichols, 60-yard rushing TD. |

## Findings

No findings — registry is consistent with engine code.

## Implementation Roadmap (Current-Scope Backlog)

Keys ordered by implementation effort (lowest to highest):

| Key | Data status | Blocker |
|-----|-------------|---------|
| `fum_rec` | nflverse_pbp_derivable | — |
| `pass_td_40p` | nflverse_pbp_derivable | — |
| `pass_td_50p` | nflverse_pbp_derivable | — |
| `pass_cmp_40p` | nflverse_pbp_derivable | — |
| `rec_40p` | nflverse_pbp_derivable | — |
| `rush_40p` | nflverse_pbp_derivable | — |
| `fum_rec_td` | nflverse_pbp_derivable | — |
| `pts_allow_0` | requires_team_game_context | Requires team-level game aggregate (points allowed per game), not per-player stats |
| `pts_allow_1_6` | requires_team_game_context | — |
| `pts_allow_7_13` | requires_team_game_context | — |
| `pts_allow_14_20` | requires_team_game_context | — |
| `pts_allow_21_27` | requires_team_game_context | — |
| `pts_allow_28_34` | requires_team_game_context | — |
| `pts_allow_35p` | requires_team_game_context | — |
| `yds_allow_0_100` | requires_team_game_context | — |
| `yds_allow_101_199` | requires_team_game_context | — |
| `yds_allow_200_299` | requires_team_game_context | — |
| `yds_allow_300_349` | requires_team_game_context | — |
| `yds_allow_350_399` | requires_team_game_context | — |
| `yds_allow_400_449` | requires_team_game_context | — |
| `yds_allow_450_499` | requires_team_game_context | — |
| `yds_allow_500_549` | requires_team_game_context | — |
| `yds_allow_550p` | requires_team_game_context | — |
| `return_fd` | requires_new_source | Archived nflverse weekly player stats do not expose a verified return-first-down column; return_fd cannot be activated from the current weekly source. |

## H4 Backlog Groups

### Group A — derivable from existing weekly data

Keys that can be computed from already-extracted weekly player stats without adding a new upstream source.

Current key count: **0**

| Key | Family | Data status | Recommended path | Primary blocker |
|-----|--------|-------------|------------------|-----------------|

### Group B — source available but unwired

Keys whose raw columns already exist in the nflverse weekly player stats artifact but are not yet normalized into canonical stats.

Current key count: **0**

| Key | Family | Data status | Recommended path | Primary blocker |
|-----|--------|-------------|------------------|-----------------|

### Group A/B candidates blocked after verification

Keys reviewed in the same quick-win tranche that could not be safely activated because the archived weekly source did not verify the needed field.

Current key count: **1**

| Key | Family | Data status | Recommended path | Primary blocker |
|-----|--------|-------------|------------------|-----------------|
| `return_fd` | special_teams_skill | requires_new_source | Keep blocked until a verified source field exists. | Archived nflverse weekly player stats do not expose a verified return-first-down column; return_fd cannot be activated from the current weekly source. |

### Group C — additional PBP derivations

Keys that still require more play-by-play-derived canonical stats beyond the H2/H2.1 set now in production.

Current key count: **7**

| Key | Family | Data status | Recommended path | Primary blocker |
|-----|--------|-------------|------------------|-----------------|
| `fum_rec` | miscellaneous_skill | nflverse_pbp_derivable | Extend the PBP derivation pipeline with a new derived canonical stat. | — |
| `pass_td_40p` | long_td_bonuses | nflverse_pbp_derivable | Extend the PBP derivation pipeline with a new derived canonical stat. | — |
| `pass_td_50p` | long_td_bonuses | nflverse_pbp_derivable | Extend the PBP derivation pipeline with a new derived canonical stat. | — |
| `pass_cmp_40p` | long_td_bonuses | nflverse_pbp_derivable | Extend the PBP derivation pipeline with a new derived canonical stat. | — |
| `rec_40p` | long_td_bonuses | nflverse_pbp_derivable | Extend the PBP derivation pipeline with a new derived canonical stat. | — |
| `rush_40p` | long_td_bonuses | nflverse_pbp_derivable | Extend the PBP derivation pipeline with a new derived canonical stat. | — |
| `fum_rec_td` | miscellaneous_skill | nflverse_pbp_derivable | Extend the PBP derivation pipeline with a new derived canonical stat. | — |

### Group D — team-context dependent

Keys that depend on team-level game results rather than player stat rows or player-level PBP accumulation.

Current key count: **16**

| Key | Family | Data status | Recommended path | Primary blocker |
|-----|--------|-------------|------------------|-----------------|
| `pts_allow_0` | team_defense | requires_team_game_context | Add a team game-result ingestion layer and team-defense aggregation. | Requires team-level game aggregate (points allowed per game), not per-player stats |
| `pts_allow_1_6` | team_defense | requires_team_game_context | Add a team game-result ingestion layer and team-defense aggregation. | — |
| `pts_allow_7_13` | team_defense | requires_team_game_context | Add a team game-result ingestion layer and team-defense aggregation. | — |
| `pts_allow_14_20` | team_defense | requires_team_game_context | Add a team game-result ingestion layer and team-defense aggregation. | — |
| `pts_allow_21_27` | team_defense | requires_team_game_context | Add a team game-result ingestion layer and team-defense aggregation. | — |
| `pts_allow_28_34` | team_defense | requires_team_game_context | Add a team game-result ingestion layer and team-defense aggregation. | — |
| `pts_allow_35p` | team_defense | requires_team_game_context | Add a team game-result ingestion layer and team-defense aggregation. | — |
| `yds_allow_0_100` | team_defense | requires_team_game_context | Add a team game-result ingestion layer and team-defense aggregation. | — |
| `yds_allow_101_199` | team_defense | requires_team_game_context | Add a team game-result ingestion layer and team-defense aggregation. | — |
| `yds_allow_200_299` | team_defense | requires_team_game_context | Add a team game-result ingestion layer and team-defense aggregation. | — |
| `yds_allow_300_349` | team_defense | requires_team_game_context | Add a team game-result ingestion layer and team-defense aggregation. | — |
| `yds_allow_350_399` | team_defense | requires_team_game_context | Add a team game-result ingestion layer and team-defense aggregation. | — |
| `yds_allow_400_449` | team_defense | requires_team_game_context | Add a team game-result ingestion layer and team-defense aggregation. | — |
| `yds_allow_450_499` | team_defense | requires_team_game_context | Add a team game-result ingestion layer and team-defense aggregation. | — |
| `yds_allow_500_549` | team_defense | requires_team_game_context | Add a team game-result ingestion layer and team-defense aggregation. | — |
| `yds_allow_550p` | team_defense | requires_team_game_context | Add a team game-result ingestion layer and team-defense aggregation. | — |

## Operational Keys

`bonus_fd_qb`, `bonus_fd_rb`, `bonus_fd_te`, `bonus_fd_wr`, `bonus_pass_cmp_25`, `bonus_pass_yd_300`, `bonus_pass_yd_400`, `bonus_rec_rb`, `bonus_rec_te`, `bonus_rec_wr`, `bonus_rec_yd_100`, `bonus_rec_yd_200`, `bonus_rush_att_20`, `bonus_rush_rec_yd_100`, `bonus_rush_rec_yd_200`, `bonus_rush_yd_100`, `bonus_rush_yd_200`, `fum`, `fum_lost`, `fum_ret_td`, `kick_ret_yd`, `pass_2pt`, `pass_att`, `pass_cmp`, `pass_fd`, `pass_inc`, `pass_int`, `pass_int_td`, `pass_pick6`, `pass_sack`, `pass_td`, `pass_yd`, `punt_ret_yd`, `rec`, `rec_20_29`, `rec_2pt`, `rec_30_39`, `rec_fd`, `rec_rb_bonus`, `rec_td`, `rec_td_40p`, `rec_td_50p`, `rec_te_bonus`, `rec_tgt`, `rec_wr_bonus`, `rec_yd`, `return_td`, `rush_2pt`, `rush_att`, `rush_fd`, `rush_td`, `rush_td_40p`, `rush_td_50p`, `rush_yd`

## Full Registry

| Key | Label | Family | Engine | Data status | Phase |
|-----|-------|--------|--------|-------------|-------|
| `pass_yd` | Passing yards | passing_volume | implemented_verified | nflverse_weekly_verified | H1 |
| `pass_att` | Passing attempts | passing_volume | implemented_verified | nflverse_weekly_verified | H1 |
| `pass_cmp` | Passing completions | passing_volume | implemented_verified | nflverse_weekly_verified | H1 |
| `pass_inc` | Passing incompletions | passing_volume | implemented_verified | nflverse_weekly_verified | H4A |
| `pass_sack` | Sacks taken (QB) | passing_volume | implemented_verified | nflverse_weekly_verified | H1 |
| `pass_td` | Passing touchdowns | passing_outcomes | implemented_verified | nflverse_weekly_verified | H1 |
| `pass_int` | Interceptions thrown | passing_outcomes | implemented_verified | nflverse_weekly_verified | H1 |
| `pass_2pt` | Passing two-point conversions | passing_outcomes | implemented_verified | nflverse_weekly_verified | H1 |
| `pass_pick6` | Pick-sixes thrown | passing_outcomes | implemented_verified | nflverse_pbp_derived | H2.1 |
| `pass_int_td` | Pick-six thrown (alternate key) | passing_outcomes | implemented_verified | nflverse_pbp_derived | H2.1 |
| `rush_yd` | Rushing yards | rushing | implemented_verified | nflverse_weekly_verified | H1 |
| `rush_att` | Rushing attempts (carries) | rushing | implemented_verified | nflverse_weekly_verified | H1 |
| `rush_td` | Rushing touchdowns | rushing | implemented_verified | nflverse_weekly_verified | H1 |
| `rush_fd` | Rushing first downs | rushing | implemented_verified | nflverse_weekly_verified | H1 |
| `rush_2pt` | Rushing two-point conversions | rushing | implemented_verified | nflverse_weekly_verified | H1 |
| `rec` | Receptions | receiving | implemented_verified | nflverse_weekly_verified | H1 |
| `rec_tgt` | Targets | receiving | implemented_verified | nflverse_weekly_verified | H1 |
| `rec_yd` | Receiving yards | receiving | implemented_verified | nflverse_weekly_verified | H1 |
| `rec_td` | Receiving touchdowns | receiving | implemented_verified | nflverse_weekly_verified | H1 |
| `rec_fd` | Receiving first downs | receiving | implemented_verified | nflverse_weekly_verified | H1 |
| `rec_2pt` | Receiving two-point conversions | receiving | implemented_verified | nflverse_weekly_verified | H1 |
| `rec_te_bonus` | TE reception bonus (legacy key) | position_rec_bonuses | implemented_verified | nflverse_weekly_verified | H1 |
| `rec_rb_bonus` | RB reception bonus (legacy key) | position_rec_bonuses | implemented_verified | nflverse_weekly_verified | H1 |
| `rec_wr_bonus` | WR reception bonus (legacy key) | position_rec_bonuses | implemented_verified | nflverse_weekly_verified | H1 |
| `bonus_rec_te` | TE reception bonus | position_rec_bonuses | implemented_verified | nflverse_weekly_verified | H1 |
| `bonus_rec_rb` | RB reception bonus | position_rec_bonuses | implemented_verified | nflverse_weekly_verified | H1 |
| `bonus_rec_wr` | WR reception bonus | position_rec_bonuses | implemented_verified | nflverse_weekly_verified | H1 |
| `fum_lost` | Fumbles lost | miscellaneous_skill | implemented_verified | nflverse_weekly_verified | H1 |
| `fum` | Total fumbles (lost + recovered) | miscellaneous_skill | implemented_verified | nflverse_weekly_verified | H4A |
| `fum_ret_td` | Fumble return touchdowns | miscellaneous_skill | implemented_verified | nflverse_pbp_derived | H4B |
| `fum_rec` | Offensive fumble recovery | miscellaneous_skill | implemented_verified | nflverse_pbp_derivable | H9.4 |
| `kick_ret_yd` | Kick return yards | special_teams_skill | implemented_verified | nflverse_weekly_verified | H4A |
| `punt_ret_yd` | Punt return yards | special_teams_skill | implemented_verified | nflverse_weekly_verified | H4A |
| `return_td` | Return touchdowns (kick or punt) | special_teams_skill | implemented_verified | nflverse_weekly_verified | H4A |
| `return_fd` | Return first downs | special_teams_skill | implemented_verified | requires_new_source | — |
| `pass_fd` | Passing first downs | first_down_bonuses | implemented_verified | nflverse_weekly_verified | H1 |
| `bonus_fd_qb` | QB first-down bonus (per passing first down) | first_down_bonuses | implemented_verified | nflverse_weekly_verified | H1 |
| `bonus_fd_rb` | RB first-down bonus (per rushing + receiving first down) | first_down_bonuses | implemented_verified | nflverse_weekly_verified | H1 |
| `bonus_fd_wr` | WR first-down bonus (per receiving first down) | first_down_bonuses | implemented_verified | nflverse_weekly_verified | H1 |
| `bonus_fd_te` | TE first-down bonus (per receiving first down) | first_down_bonuses | implemented_verified | nflverse_weekly_verified | H1 |
| `rec_td_40p` | Receiving TD of 40+ yards bonus | long_td_bonuses | implemented_verified | nflverse_pbp_derived | H2 |
| `rec_td_50p` | Receiving TD of 50+ yards bonus | long_td_bonuses | implemented_verified | nflverse_pbp_derived | H2 |
| `rush_td_40p` | Rushing TD of 40+ yards bonus | long_td_bonuses | implemented_verified | nflverse_pbp_derived | H2 |
| `rush_td_50p` | Rushing TD of 50+ yards bonus | long_td_bonuses | implemented_verified | nflverse_pbp_derived | H2 |
| `pass_td_40p` | Passing TD of 40+ yards bonus | long_td_bonuses | implemented_verified | nflverse_pbp_derivable | H9.4 |
| `pass_td_50p` | Passing TD of 50+ yards bonus | long_td_bonuses | implemented_verified | nflverse_pbp_derivable | H9.4 |
| `pass_cmp_40p` | Passing completion of 40+ yards bonus | long_td_bonuses | implemented_verified | nflverse_pbp_derivable | H9.4 |
| `rec_20_29` | Reception of 20-29 yards bonus | long_td_bonuses | implemented_verified | nflverse_weekly_verified | H9.4 |
| `rec_30_39` | Reception of 30-39 yards bonus | long_td_bonuses | implemented_verified | nflverse_weekly_verified | H9.4 |
| `rec_40p` | Reception of 40+ yards bonus | long_td_bonuses | implemented_verified | nflverse_pbp_derivable | H9.4 |
| `rush_40p` | Rush of 40+ yards bonus | long_td_bonuses | implemented_verified | nflverse_pbp_derivable | H9.4 |
| `bonus_pass_yd_300` | 300-399 passing-yard bonus | yardage_threshold_bonuses | implemented_verified | nflverse_weekly_verified | H1 |
| `bonus_pass_yd_400` | 400+ passing-yard bonus | yardage_threshold_bonuses | implemented_verified | nflverse_weekly_verified | H1 |
| `bonus_pass_cmp_25` | 25+ completions bonus | yardage_threshold_bonuses | implemented_verified | nflverse_weekly_verified | H1 |
| `bonus_rush_yd_100` | 100-199 rushing-yard bonus | yardage_threshold_bonuses | implemented_verified | nflverse_weekly_verified | H1 |
| `bonus_rush_yd_200` | 200+ rushing-yard bonus | yardage_threshold_bonuses | implemented_verified | nflverse_weekly_verified | H1 |
| `bonus_rush_att_20` | 20+ carries bonus | yardage_threshold_bonuses | implemented_verified | nflverse_weekly_verified | H1 |
| `bonus_rec_yd_100` | 100-199 receiving-yard bonus | yardage_threshold_bonuses | implemented_verified | nflverse_weekly_verified | H1 |
| `bonus_rec_yd_200` | 200+ receiving-yard bonus | yardage_threshold_bonuses | implemented_verified | nflverse_weekly_verified | H1 |
| `bonus_rush_rec_yd_100` | 100-199 combined rush+rec yards bonus | yardage_threshold_bonuses | implemented_verified | nflverse_weekly_verified | H1 |
| `bonus_rush_rec_yd_200` | 200+ combined rush+rec yards bonus | yardage_threshold_bonuses | implemented_verified | nflverse_weekly_verified | H1 |
| `xpm` | Extra points made | kicking | implemented_verified | out_of_scope | — |
| `xpmiss` | Extra points missed | kicking | implemented_verified | out_of_scope | — |
| `fgm` | Field goals made | kicking | implemented_verified | out_of_scope | — |
| `fgmiss` | Field goals missed | kicking | implemented_verified | out_of_scope | — |
| `fgm_0_19` | FG made 0-19 yards | kicking | implemented_verified | out_of_scope | — |
| `fgm_20_29` | FG made 20-29 yards | kicking | implemented_verified | out_of_scope | — |
| `fgm_30_39` | FG made 30-39 yards | kicking | implemented_verified | out_of_scope | — |
| `fgm_40_49` | FG made 40-49 yards | kicking | implemented_verified | out_of_scope | — |
| `fgm_50_59` | FG made 50-59 yards | kicking | implemented_verified | out_of_scope | — |
| `fgm_50p` | FG made 50+ yards | kicking | implemented_verified | out_of_scope | — |
| `fgm_60p` | FG made 60+ yards | kicking | implemented_verified | out_of_scope | — |
| `fgmiss_0_19` | FG missed 0-19 yards | kicking | implemented_verified | out_of_scope | — |
| `fgmiss_20_29` | FG missed 20-29 yards | kicking | implemented_verified | out_of_scope | — |
| `fgmiss_30_39` | FG missed 30-39 yards | kicking | implemented_verified | out_of_scope | — |
| `fgmiss_40_49` | FG missed 40-49 yards | kicking | implemented_verified | out_of_scope | — |
| `fgmiss_50p` | FG missed 50+ yards | kicking | implemented_verified | out_of_scope | — |
| `sack` | Sacks | team_defense | implemented_verified | out_of_scope | — |
| `int` | Interceptions | team_defense | implemented_verified | out_of_scope | — |
| `ff` | Forced fumbles | team_defense | implemented_verified | out_of_scope | — |
| `fr` | Fumble recoveries | team_defense | implemented_verified | out_of_scope | — |
| `safe` | Safeties | team_defense | implemented_verified | out_of_scope | — |
| `blk_kick` | Blocked kicks | team_defense | implemented_verified | out_of_scope | — |
| `def_td` | Defensive touchdowns | team_defense | implemented_verified | out_of_scope | — |
| `def_st_td` | Defensive/special-teams touchdowns | team_defense | implemented_verified | out_of_scope | — |
| `def_st_ff` | Special-teams forced fumble | team_defense | not_implemented | out_of_scope | — |
| `def_st_fum_rec` | Special-teams fumble recovery | team_defense | not_implemented | out_of_scope | — |
| `fum_rec_td` | Offensive fumble recovery touchdown | miscellaneous_skill | implemented_verified | nflverse_pbp_derivable | H9.4 |
| `def_2pt_ret` | Defensive two-point return | team_defense | implemented_verified | out_of_scope | — |
| `fourth_down_stop` | Fourth-down stops | team_defense | implemented_verified | out_of_scope | — |
| `three_and_out` | Three-and-outs forced | team_defense | implemented_verified | out_of_scope | — |
| `pts_allow_0` | Points allowed: shutout (0) | team_defense | implemented_verified | requires_team_game_context | — |
| `pts_allow_1_6` | Points allowed: 1-6 | team_defense | implemented_verified | requires_team_game_context | — |
| `pts_allow_7_13` | Points allowed: 7-13 | team_defense | implemented_verified | requires_team_game_context | — |
| `pts_allow_14_20` | Points allowed: 14-20 | team_defense | implemented_verified | requires_team_game_context | — |
| `pts_allow_21_27` | Points allowed: 21-27 | team_defense | implemented_verified | requires_team_game_context | — |
| `pts_allow_28_34` | Points allowed: 28-34 | team_defense | implemented_verified | requires_team_game_context | — |
| `pts_allow_35p` | Points allowed: 35+ | team_defense | implemented_verified | requires_team_game_context | — |
| `yds_allow_0_100` | Yards allowed: 0-100 | team_defense | implemented_verified | requires_team_game_context | — |
| `yds_allow_101_199` | Yards allowed: 101-199 | team_defense | implemented_verified | requires_team_game_context | — |
| `yds_allow_200_299` | Yards allowed: 200-299 | team_defense | implemented_verified | requires_team_game_context | — |
| `yds_allow_300_349` | Yards allowed: 300-349 | team_defense | implemented_verified | requires_team_game_context | — |
| `yds_allow_350_399` | Yards allowed: 350-399 | team_defense | implemented_verified | requires_team_game_context | — |
| `yds_allow_400_449` | Yards allowed: 400-449 | team_defense | implemented_verified | requires_team_game_context | — |
| `yds_allow_450_499` | Yards allowed: 450-499 | team_defense | implemented_verified | requires_team_game_context | — |
| `yds_allow_500_549` | Yards allowed: 500-549 | team_defense | implemented_verified | requires_team_game_context | — |
| `yds_allow_550p` | Yards allowed: 550+ | team_defense | implemented_verified | requires_team_game_context | — |
| `solo_tkl` | Solo tackles | idp | implemented_verified | out_of_scope | — |
| `ast_tkl` | Assisted tackles | idp | implemented_verified | out_of_scope | — |
| `tkl` | Total tackles | idp | implemented_verified | out_of_scope | — |
| `tkl_loss` | Tackles for loss | idp | implemented_verified | out_of_scope | — |
| `st_tkl` | Special-teams tackles | idp | implemented_verified | out_of_scope | — |
| `qb_hit` | QB hits | idp | implemented_verified | out_of_scope | — |
| `pd` | Passes defended | idp | implemented_verified | out_of_scope | — |
| `int_ret_yd` | Interception return yards | idp | implemented_verified | out_of_scope | — |
| `fr_ret_yd` | Fumble return yards | idp | implemented_verified | out_of_scope | — |
| `bonus_def_fum_td_50p` | Defensive fumble-return TD 50+ yards bonus | team_defense | not_implemented | out_of_scope | — |
| `bonus_def_int_td_50p` | Defensive INT-return TD 50+ yards bonus | team_defense | not_implemented | out_of_scope | — |
| `bonus_sack_2p` | 2+ sack game bonus (IDP) | idp | implemented_verified | out_of_scope | — |
