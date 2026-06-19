# Projection Crosswalk-Unmatched Classification 2026

Dry run: true
Read only: true
Recommendation: crosswalk_unmatched_ready_for_source_selection
Source priority: sleeper_player_metadata_source

## Summary

```json
{
  "totalCrosswalkUnmatchedRows": 1052,
  "byClassification": {
    "likely_inactive_or_archive": 0,
    "needs_transaction_status_source": 0,
    "needs_sleeper_status_source": 1052,
    "needs_depth_chart_source": 0,
    "needs_manual_review": 0,
    "keep_source_expansion_required": 0
  },
  "byPosition": {
    "RB": 204,
    "WR": 466,
    "LB": 38,
    "TE": 192,
    "QB": 89,
    "DB": 43,
    "DL": 20
  },
  "byTeam": {
    "CLE": 34,
    "ARI": 40,
    "MIN": 40,
    "GB": 47,
    "SEA": 48,
    "LA": 37,
    "KC": 38,
    "DET": 32,
    "TB": 43,
    "PHI": 25,
    "CHI": 31,
    "BUF": 19,
    "IND": 35,
    "TEN": 31,
    "DAL": 25,
    "WAS": 35,
    "ATL": 36,
    "PIT": 47,
    "NYG": 34,
    "CAR": 42,
    "NYJ": 37,
    "DEN": 30,
    "LAC": 33,
    "OAK": 5,
    "HOU": 23,
    "LV": 8,
    "JAX": 35,
    "SF": 19,
    "BAL": 30,
    "NE": 24,
    "MIA": 35,
    "CIN": 31,
    "NO": 23
  },
  "byOriginalH21PolicyGroup": {
    "unmatched_rookie_new_review": 1052
  },
  "byH23IdentityClass": {
    "sleeper_only_player": 1052
  },
  "byV82SafeSubset": {
    "v82_safe_subset": 1052
  },
  "projectionImportance": {
    "topProjectionDelta": 12,
    "topRankMovement": 2170,
    "criticalOrMeaningfulRows": 1048
  }
}
```

## Source Priority

```json
{
  "recommendedSourcePriority": "sleeper_player_metadata_source",
  "priorityCounts": {
    "sleeper_player_metadata_source": 1052,
    "transaction_free_agent_source": 0,
    "depth_chart_source": 0,
    "manual_review": 0,
    "keep_shadow_only_policy": 0
  },
  "note": "Recommended source priority is selected from the largest classified source-need bucket."
}
```

## H21 Policy Preview

```json
{
  "wouldRemainUnder": {
    "policy_active_candidate": 0,
    "policy_shadow_only": 0,
    "policy_blocked_archive": 0,
    "policy_manual_review": 0,
    "policy_source_expansion_required": 1052,
    "policy_kicker_review_required": 0,
    "policy_current_path_only": 0
  },
  "notes": [
    "H26 policy preview is conservative and does not change H21 behavior.",
    "Crosswalk-unmatched rows are never forced active by this report."
  ]
}
```

## v8.2 Impact

```json
{
  "safeRowsAffected": 1052,
  "safeRowsStillHeldBack": 1052,
  "blocksControlledFlagReview": true,
  "zeroChecksPreserved": true,
  "zeroChecks": {
    "kRowsUsingV82": true,
    "criticalMoversUsingV82": true,
    "meaningfulRankMoversUsingV82": true,
    "legacyRowsUsingV82": true
  }
}
```

## Likely Inactive / Archive

No rows.

## Needs Transaction Status

No rows.

## Needs Sleeper Status

| Player | Pos | Team | Class | Source Priority | Policy Preview | Reasons |
|---|---|---|---|---|---|---|
| Mike Hartline | QB | IND | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Kevin O'Connell | QB | NYJ | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Kurt Warner | QB | ARI | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Byron Leftwich | QB | PIT | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Zach Heins | TE | LAC | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Zack Kuntz | TE | NYJ | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Zach Conque | TE | IND | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Tyree Mayfield | TE | SF | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Tony Poljan | TE | BAL | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Travis Wilson | TE | LA | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Tim Semisch | TE | DEN | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Trevor Wood | TE | PIT | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Trey Knox | TE | MIN | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Troy Mangen | TE | ATL | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Thaddeus Moss | TE | CIN | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Thomas Greaney | TE | CLE | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Thomas Odukoya | TE | NE | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Thomas Yassmin | TE | LAC | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Tyler Hoppes | TE | MIN | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Tyler Neville | TE | DAL | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Tanner McLachlan | TE | LAC | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Tanner Taula | TE | TB | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Taylor Sloat | TE | TB | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Stephen Baggett | TE | CLE | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Steven Scheu | TE | DEN | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Steven Stilianos | TE | DET | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Stevo Klotz | TE | LAC | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Shaun Beyer | TE | GB | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Shawn Bowman | TE | JAX | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Sage Surratt | TE | ARI | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Scooter Harrington | TE | CHI | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Scott Orndoff | TE | PHI | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Sean Ryan | TE | KC | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Seth Green | TE | NO | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Rory Anderson | TE | CHI | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Ryan Becker | TE | ATL | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Ryan Jones | TE | NYG | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Rysen John | TE | CHI | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Roger Carter | TE | LA | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Romello Brooker | TE | LA | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Riley Sharp | TE | BAL | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Ray Hamilton | TE | WAS | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Patrick Murtagh | TE | DEN | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Oscar Cardenas | TE | ARI | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Nick Bowers | TE | MIA | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Nick Eubanks | TE | IND | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Nick Guggemos | TE | GB | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Nick Truesdell | TE | MIN | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Noah Gindorff | TE | PIT | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Nolan Givan | TE | DET | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |

## Needs Depth Chart

No rows.

## v8.2 Safe But Held Back

| Player | Pos | Team | Class | Source Priority | Policy Preview | Reasons |
|---|---|---|---|---|---|---|
| Mike Hartline | QB | IND | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Kevin O'Connell | QB | NYJ | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Kurt Warner | QB | ARI | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Byron Leftwich | QB | PIT | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Zach Heins | TE | LAC | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Zack Kuntz | TE | NYJ | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Zach Conque | TE | IND | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Tyree Mayfield | TE | SF | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Tony Poljan | TE | BAL | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Travis Wilson | TE | LA | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Tim Semisch | TE | DEN | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Trevor Wood | TE | PIT | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Trey Knox | TE | MIN | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Troy Mangen | TE | ATL | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Thaddeus Moss | TE | CIN | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Thomas Greaney | TE | CLE | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Thomas Odukoya | TE | NE | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Thomas Yassmin | TE | LAC | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Tyler Hoppes | TE | MIN | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Tyler Neville | TE | DAL | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Tanner McLachlan | TE | LAC | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Tanner Taula | TE | TB | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Taylor Sloat | TE | TB | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Stephen Baggett | TE | CLE | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Steven Scheu | TE | DEN | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Steven Stilianos | TE | DET | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Stevo Klotz | TE | LAC | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Shaun Beyer | TE | GB | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Shawn Bowman | TE | JAX | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Sage Surratt | TE | ARI | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Scooter Harrington | TE | CHI | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Scott Orndoff | TE | PHI | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Sean Ryan | TE | KC | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Seth Green | TE | NO | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Rory Anderson | TE | CHI | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Ryan Becker | TE | ATL | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Ryan Jones | TE | NYG | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Rysen John | TE | CHI | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Roger Carter | TE | LA | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Romello Brooker | TE | LA | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Riley Sharp | TE | BAL | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Ray Hamilton | TE | WAS | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Patrick Murtagh | TE | DEN | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Oscar Cardenas | TE | ARI | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Nick Bowers | TE | MIA | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Nick Eubanks | TE | IND | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Nick Guggemos | TE | GB | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Nick Truesdell | TE | MIN | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Noah Gindorff | TE | PIT | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |
| Nolan Givan | TE | DET | needs_sleeper_status_source | sleeper_player_metadata_source | policy_source_expansion_required | exact_crosswalk_confirmed missing_from_current_roster_source missing_from_rookie_source low_prior_signal |

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| no_live_outputs_changed | PASS | Report reads artifacts and writes only local H26 artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is imported or called. |
| rankings_unchanged | PASS | Blackbird Rank ordering is not imported, recalculated, or mutated. |
| draft_suggestions_unchanged | PASS | Draft Suggestion ordering is not imported, recalculated, or mutated. |
| war_room_scoring_unchanged | PASS | War Room scoring behavior is not imported, recalculated, or mutated. |
| v8_2_not_enabled | PASS | v8.2 feature flag and projection selector behavior are not changed. |
| unmatched_rows_not_forced_active | PASS | No unmatched row is previewed as active candidate. |
| source_need_reported | PASS | 1052 unmatched rows classified with source priority. |
| v8_2_zero_checks_preserved | PASS | K, critical mover, meaningful rank mover, and legacy v8.2 zero checks remain zero. |
