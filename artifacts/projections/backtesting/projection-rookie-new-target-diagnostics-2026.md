# Projection Rookie/New Target Diagnostics 2026

Dry run: true
Read only: true
Recommendation: rookie_target_diagnostics_ready_for_source_selection

## Summary

```json
{
  "totalTargetRows": 1078,
  "identityClassCounts": {
    "true_rookie_candidate": 2,
    "sleeper_only_player": 1052,
    "low_prior_veteran_or_unknown": 0,
    "idp_position_family_mismatch_candidate": 14,
    "special_teams_position_mismatch_candidate": 1,
    "duplicate_or_alias_candidate": 1,
    "missing_identity_data": 0,
    "source_strategy_unknown": 8
  },
  "sourceStrategyCounts": {
    "use_sleeper_player_metadata": 0,
    "use_current_roster_source": 8,
    "use_draft_results_source": 0,
    "use_depth_chart_source": 0,
    "use_transaction_status_source": 0,
    "use_manual_rookie_source": 3,
    "needs_id_crosswalk": 1052,
    "needs_position_family_review": 15
  },
  "positionFamilyCounts": {
    "returner_family_compatible": 1,
    "edge_family_compatible": 14,
    "db_family_compatible": 0,
    "te_ls_incompatible_without_review": 1,
    "position_family_incompatible": 10,
    "position_family_exact": 0,
    "not_applicable": 1052
  }
}
```

## Source Coverage

```json
{
  "targetRowsWithSleeperIdOnly": 0,
  "targetRowsWithGsisId": 1078,
  "targetRowsWithBothSleeperAndGsis": 1078,
  "targetRowsWithNoStableId": 0,
  "targetRowsFoundInCurrentRosterSource": 26,
  "targetRowsFoundInRookieSource": 18,
  "targetRowsFoundByNameTeamOverlap": 17,
  "targetRowsRequiringSleeperMetadata": 0,
  "targetRowsRequiringDraftResults": 0,
  "targetRowsRequiringManualReview": 18
}
```

## Position Family Diagnostics

```json
{
  "nameTeamOverlapsWithIncompatiblePosition": 2,
  "nameTeamOverlapsWithCompatiblePositionFamily": 15,
  "namePositionOverlapsWithTeamMismatch": 0
}
```

## H21 / v8.2 Impact

```json
{
  "rowsBySourceStrategy": {
    "use_sleeper_player_metadata": 0,
    "use_current_roster_source": 8,
    "use_draft_results_source": 0,
    "use_depth_chart_source": 0,
    "use_transaction_status_source": 0,
    "use_manual_rookie_source": 3,
    "needs_id_crosswalk": 1052,
    "needs_position_family_review": 15
  },
  "v82SafeRowsBySourceStrategy": {
    "use_sleeper_player_metadata": 0,
    "use_current_roster_source": 8,
    "use_draft_results_source": 0,
    "use_depth_chart_source": 0,
    "use_transaction_status_source": 0,
    "use_manual_rookie_source": 3,
    "needs_id_crosswalk": 1052,
    "needs_position_family_review": 15
  },
  "sourceStrategyBlocksV82ControlledReview": false,
  "note": "H23 is source-selection diagnostics only; no source strategy changes H21 or v8.2 behavior."
}
```

## Top Projection Impact Rows

| Player | Pos | Team | Class | Strategy | Current | Rookie | v8.2 | Reasons |
|---|---|---|---|---|---|---|---|---|
| Mike Hartline | QB | IND | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Kevin O'Connell | QB | NYJ | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Kurt Warner | QB | ARI | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Byron Leftwich | QB | PIT | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Zach Heins | TE | LAC | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Zack Kuntz | TE | NYJ | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Zach Conque | TE | IND | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Tyree Mayfield | TE | SF | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Tony Poljan | TE | BAL | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Travis Wilson | TE | LA | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Tim Semisch | TE | DEN | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Trevor Wood | TE | PIT | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Trey Knox | TE | MIN | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Troy Mangen | TE | ATL | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Thaddeus Moss | TE | CIN | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Thomas Greaney | TE | CLE | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Thomas Odukoya | TE | NE | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Thomas Yassmin | TE | LAC | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Tyler Hoppes | TE | MIN | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Tyler Neville | TE | DAL | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Tanner McLachlan | TE | LAC | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Tanner Taula | TE | TB | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Taylor Sloat | TE | TB | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Stephen Baggett | TE | CLE | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Steven Scheu | TE | DEN | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Steven Stilianos | TE | DET | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Stevo Klotz | TE | LAC | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Shaun Beyer | TE | GB | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Shawn Bowman | TE | JAX | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Sage Surratt | TE | ARI | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Scooter Harrington | TE | CHI | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Scott Orndoff | TE | PHI | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Sean Ryan | TE | KC | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Seth Green | TE | NO | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Rory Anderson | TE | CHI | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Ryan Becker | TE | ATL | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Ryan Jones | TE | NYG | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Rysen John | TE | CHI | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Roger Carter | TE | LA | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Romello Brooker | TE | LA | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Riley Sharp | TE | BAL | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Ray Hamilton | TE | WAS | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Patrick Murtagh | TE | DEN | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Oscar Cardenas | TE | ARI | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Nick Bowers | TE | MIA | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Nick Eubanks | TE | IND | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Nick Guggemos | TE | GB | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Nick Truesdell | TE | MIN | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Noah Gindorff | TE | PIT | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Nolan Givan | TE | DET | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |

## Top v8.2 Safe Rows

| Player | Pos | Team | Class | Strategy | Current | Rookie | v8.2 | Reasons |
|---|---|---|---|---|---|---|---|---|
| Mike Hartline | QB | IND | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Kevin O'Connell | QB | NYJ | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Kurt Warner | QB | ARI | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Byron Leftwich | QB | PIT | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Zach Heins | TE | LAC | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Zack Kuntz | TE | NYJ | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Zach Conque | TE | IND | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Tyree Mayfield | TE | SF | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Tony Poljan | TE | BAL | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Travis Wilson | TE | LA | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Tim Semisch | TE | DEN | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Trevor Wood | TE | PIT | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Trey Knox | TE | MIN | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Troy Mangen | TE | ATL | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Thaddeus Moss | TE | CIN | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Thomas Greaney | TE | CLE | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Thomas Odukoya | TE | NE | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Thomas Yassmin | TE | LAC | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Tyler Hoppes | TE | MIN | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Tyler Neville | TE | DAL | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Tanner McLachlan | TE | LAC | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Tanner Taula | TE | TB | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Taylor Sloat | TE | TB | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Stephen Baggett | TE | CLE | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Steven Scheu | TE | DEN | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Steven Stilianos | TE | DET | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Stevo Klotz | TE | LAC | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Shaun Beyer | TE | GB | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Shawn Bowman | TE | JAX | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Sage Surratt | TE | ARI | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Scooter Harrington | TE | CHI | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Scott Orndoff | TE | PHI | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Sean Ryan | TE | KC | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Seth Green | TE | NO | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Rory Anderson | TE | CHI | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Ryan Becker | TE | ATL | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Ryan Jones | TE | NYG | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Rysen John | TE | CHI | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Roger Carter | TE | LA | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Romello Brooker | TE | LA | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Riley Sharp | TE | BAL | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Ray Hamilton | TE | WAS | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Patrick Murtagh | TE | DEN | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Oscar Cardenas | TE | ARI | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Nick Bowers | TE | MIA | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Nick Eubanks | TE | IND | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Nick Guggemos | TE | GB | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Nick Truesdell | TE | MIN | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Noah Gindorff | TE | PIT | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Nolan Givan | TE | DET | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |

## Rows With No Source Overlap

| Player | Pos | Team | Class | Strategy | Current | Rookie | v8.2 | Reasons |
|---|---|---|---|---|---|---|---|---|
| Mike Hartline | QB | IND | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Kevin O'Connell | QB | NYJ | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Kurt Warner | QB | ARI | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Byron Leftwich | QB | PIT | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Zach Heins | TE | LAC | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Zack Kuntz | TE | NYJ | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Zach Conque | TE | IND | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Tyree Mayfield | TE | SF | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Tony Poljan | TE | BAL | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Travis Wilson | TE | LA | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Tim Semisch | TE | DEN | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Trevor Wood | TE | PIT | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Trey Knox | TE | MIN | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Troy Mangen | TE | ATL | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Thaddeus Moss | TE | CIN | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Thomas Greaney | TE | CLE | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Thomas Odukoya | TE | NE | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Thomas Yassmin | TE | LAC | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Tyler Hoppes | TE | MIN | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Tyler Neville | TE | DAL | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Tanner McLachlan | TE | LAC | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Tanner Taula | TE | TB | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Taylor Sloat | TE | TB | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Stephen Baggett | TE | CLE | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Steven Scheu | TE | DEN | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Steven Stilianos | TE | DET | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Stevo Klotz | TE | LAC | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Shaun Beyer | TE | GB | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Shawn Bowman | TE | JAX | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Sage Surratt | TE | ARI | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Scooter Harrington | TE | CHI | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Scott Orndoff | TE | PHI | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Sean Ryan | TE | KC | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Seth Green | TE | NO | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Rory Anderson | TE | CHI | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Ryan Becker | TE | ATL | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Ryan Jones | TE | NYG | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Rysen John | TE | CHI | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Roger Carter | TE | LA | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Romello Brooker | TE | LA | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Riley Sharp | TE | BAL | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Ray Hamilton | TE | WAS | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Patrick Murtagh | TE | DEN | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Oscar Cardenas | TE | ARI | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Nick Bowers | TE | MIA | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Nick Eubanks | TE | IND | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Nick Guggemos | TE | GB | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Nick Truesdell | TE | MIN | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Noah Gindorff | TE | PIT | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Nolan Givan | TE | DET | sleeper_only_player | needs_id_crosswalk | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |

## Name Overlap With Position Mismatch

| Player | Pos | Team | Class | Strategy | Current | Rookie | v8.2 | Reasons |
|---|---|---|---|---|---|---|---|---|
| Leonard Taylor | TE | JAX | source_strategy_unknown | use_current_roster_source | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Jerand Bradley | TE | LAC | true_rookie_candidate | use_manual_rookie_source | roster_unmatched | rookie_team_review_candidate | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Dylan Parham | TE | DEN | source_strategy_unknown | use_current_roster_source | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Beau Gardner | TE | ATL | duplicate_or_alias_candidate | use_manual_rookie_source | roster_unmatched | rookie_team_review_candidate | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Riley Nowakowski | RB | PIT | true_rookie_candidate | use_manual_rookie_source | roster_unmatched | rookie_team_review_candidate | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Anthony Johnson | WR | PIT | source_strategy_unknown | use_current_roster_source | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Joey Porter | LB | ARI | source_strategy_unknown | use_current_roster_source | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Eric Rogers | WR | SF | source_strategy_unknown | use_current_roster_source | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| James Williams | RB | DET | source_strategy_unknown | use_current_roster_source | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Jaylon Moore | WR | JAX | source_strategy_unknown | use_current_roster_source | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Mike Hughes | DL | JAX | source_strategy_unknown | use_current_roster_source | roster_unmatched | rookie_team_unmatched | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |

## Likely IDP Edge-Family Mismatch Candidates

| Player | Pos | Team | Class | Strategy | Current | Rookie | v8.2 | Reasons |
|---|---|---|---|---|---|---|---|---|
| Aidan Hubbard | LB | SEA | idp_position_family_mismatch_candidate | needs_position_family_review | roster_unmatched | rookie_team_review_candidate | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Arden Walker | LB | MIN | idp_position_family_mismatch_candidate | needs_position_family_review | roster_unmatched | rookie_team_review_candidate | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Dani Dennis-Sutton | LB | GB | idp_position_family_mismatch_candidate | needs_position_family_review | roster_unmatched | rookie_team_review_candidate | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Ethan Burke | LB | BAL | idp_position_family_mismatch_candidate | needs_position_family_review | roster_unmatched | rookie_team_review_candidate | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Isaiah Smith | LB | CAR | idp_position_family_mismatch_candidate | needs_position_family_review | roster_unmatched | rookie_team_review_candidate | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Jack Pyburn | LB | TB | idp_position_family_mismatch_candidate | needs_position_family_review | roster_unmatched | rookie_team_review_candidate | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Joshua Weru | LB | PHI | idp_position_family_mismatch_candidate | needs_position_family_review | roster_unmatched | rookie_team_review_candidate | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Malachi Lawrence | LB | DAL | idp_position_family_mismatch_candidate | needs_position_family_review | roster_unmatched | rookie_team_review_candidate | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Marvin Jones | LB | SEA | idp_position_family_mismatch_candidate | needs_position_family_review | roster_unmatched | rookie_team_review_candidate | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Nadame Tucker | LB | LAC | idp_position_family_mismatch_candidate | needs_position_family_review | roster_unmatched | rookie_team_review_candidate | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Xavier Holmes | LB | NE | idp_position_family_mismatch_candidate | needs_position_family_review | roster_unmatched | rookie_team_review_candidate | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Yasir Holmes | LB | TB | idp_position_family_mismatch_candidate | needs_position_family_review | roster_unmatched | rookie_team_review_candidate | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Cian Slone | DL | LV | idp_position_family_mismatch_candidate | needs_position_family_review | roster_unmatched | rookie_team_review_candidate | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Zion Young | DL | BAL | idp_position_family_mismatch_candidate | needs_position_family_review | roster_unmatched | rookie_team_review_candidate | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |

## Special Teams Position Mismatch Candidates

| Player | Pos | Team | Class | Strategy | Current | Rookie | v8.2 | Reasons |
|---|---|---|---|---|---|---|---|---|
| Beau Gardner | TE | ATL | duplicate_or_alias_candidate | use_manual_rookie_source | roster_unmatched | rookie_team_review_candidate | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |
| Barion Brown | WR | NO | special_teams_position_mismatch_candidate | needs_position_family_review | roster_unmatched | rookie_team_review_candidate | v82_safe_subset | h21_rookie_new_unmatched v8_2_safe_subset snapshot_sleeper_id_present snapshot_gsis_id_present |

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| no_live_outputs_changed | PASS | Report reads artifacts and writes only local H23 artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is imported or called. |
| rankings_unchanged | PASS | Blackbird Rank ordering is not imported, recalculated, or mutated. |
| draft_suggestions_unchanged | PASS | Draft Suggestion ordering is not imported, recalculated, or mutated. |
| war_room_scoring_unchanged | PASS | War Room scoring behavior is not imported, recalculated, or mutated. |
| v8_2_not_enabled | PASS | v8.2 feature flag and projection selector behavior are not changed. |
| only_rookie_new_unmatched_targeted | PASS | 1078 target rows evaluated. |
| all_target_rows_classified | PASS | 1078 target rows classified. |

## Notes

- H23 is a dry-run/read-only diagnostics and source-strategy report.
- Position-family compatibility is review evidence only and does not confirm identity.
- No live projections, rank, suggestions, War Room scoring, Supabase tables, or v8.2 selection are mutated.
