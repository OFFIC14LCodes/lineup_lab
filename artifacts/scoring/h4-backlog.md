# H4 Backlog

## Group A — derivable from existing weekly data

Keys that can be computed from already-extracted weekly player stats without adding a new upstream source.

Current key count: **0**

| Key | Family | Data status | Recommended path | Primary blocker |
|-----|--------|-------------|------------------|-----------------|

## Group B — source available but unwired

Keys whose raw columns already exist in the nflverse weekly player stats artifact but are not yet normalized into canonical stats.

Current key count: **0**

| Key | Family | Data status | Recommended path | Primary blocker |
|-----|--------|-------------|------------------|-----------------|

## Group A/B candidates blocked after verification

Keys reviewed in the same quick-win tranche that could not be safely activated because the archived weekly source did not verify the needed field.

Current key count: **1**

| Key | Family | Data status | Recommended path | Primary blocker |
|-----|--------|-------------|------------------|-----------------|
| `return_fd` | special_teams_skill | requires_new_source | Keep blocked until a verified source field exists. | Archived nflverse weekly player stats do not expose a verified return-first-down column; return_fd cannot be activated from the current weekly source. |

## Group C — additional PBP derivations

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

## Group D — team-context dependent

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
