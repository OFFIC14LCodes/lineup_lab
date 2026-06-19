# Projection Sleeper Metadata Resolution 2026

Dry run: true
Read only: true
Recommendation: sleeper_metadata_resolution_needs_review

## Summary

```json
{
  "targetRows": 1052,
  "metadataSourceRows": 12199,
  "matchedBySleeperId": 1052,
  "missingMetadata": 0,
  "activePlausible": 21,
  "inactiveOrStale": 138,
  "freeAgentOrUnknown": 870,
  "positionConflicts": 23,
  "teamConflicts": 0,
  "manualReview": 0,
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
  "byV82SafeSubset": {
    "v82_safe_subset": 1052
  },
  "byStatus": {
    "sleeper_metadata_active_plausible": 21,
    "sleeper_metadata_inactive_or_stale": 138,
    "sleeper_metadata_free_agent_or_unknown": 870,
    "sleeper_metadata_position_conflict": 23,
    "sleeper_metadata_team_conflict": 0,
    "sleeper_metadata_missing": 0,
    "sleeper_metadata_manual_review": 0
  }
}
```

## Policy Preview

```json
{
  "wouldMoveTo": {
    "policy_active_candidate": 21,
    "policy_shadow_only": 138,
    "policy_blocked_archive": 0,
    "policy_manual_review": 23,
    "policy_source_expansion_required": 870,
    "policy_kicker_review_required": 0,
    "policy_current_path_only": 0
  },
  "notes": [
    "Sleeper metadata resolution is preview-only and does not update H21 behavior.",
    "Only exact Sleeper ID matches are used."
  ]
}
```

## v8.2 Impact

```json
{
  "safeRowsResolvedBySleeperMetadata": 21,
  "safeRowsStillHeldBack": 1031,
  "safeRowsMovedToActiveCandidatePreview": 21,
  "protectedZeroChecks": {
    "kRowsUsingV82": true,
    "criticalMoversUsingV82": true,
    "meaningfulRankMoversUsingV82": true,
    "legacyRowsUsingV82": true
  },
  "unblocksControlledFlagReview": false
}
```

## Active Plausible

| Player | Pos | Projection Team | Metadata Team | Status | Policy Preview | Reasons |
|---|---|---|---|---|---|---|
| Luke Lachey | TE | GB | GB | sleeper_metadata_active_plausible | policy_active_candidate | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Dax Raymond | TE | PIT | PIT | sleeper_metadata_active_plausible | policy_active_candidate | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Max Tomczak | WR | BUF | BUF | sleeper_metadata_active_plausible | policy_active_candidate | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Levi Wentz | WR | PIT | PIT | sleeper_metadata_active_plausible | policy_active_candidate | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Joshua Pitsenberger | RB | HOU | HOU | sleeper_metadata_active_plausible | policy_active_candidate | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Cameron Ross | WR | DEN | DEN | sleeper_metadata_active_plausible | policy_active_candidate | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Justin Hilliard | LB | KC | KC | sleeper_metadata_active_plausible | policy_active_candidate | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Wynton McManis | LB | MIA | MIA | sleeper_metadata_active_plausible | policy_active_candidate | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Bryan Mills | DB | MIN | MIN | sleeper_metadata_active_plausible | policy_active_candidate | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Daryl Porter | DB | PIT | PIT | sleeper_metadata_active_plausible | policy_active_candidate | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Rojesterman Farris | DB | DEN | DEN | sleeper_metadata_active_plausible | policy_active_candidate | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Tavien Feaster | RB | ARI | ARI | sleeper_metadata_active_plausible | policy_active_candidate | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Benny LeMay | RB | CLE | CLE | sleeper_metadata_active_plausible | policy_active_candidate | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Caleb Scott | WR | TEN | TEN | sleeper_metadata_active_plausible | policy_active_candidate | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Da'Quan Felton | WR | NYJ | NYJ | sleeper_metadata_active_plausible | policy_active_candidate | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Eldridge Massington | WR | NO | NO | sleeper_metadata_active_plausible | policy_active_candidate | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Joaquin Davis | WR | PIT | PIT | sleeper_metadata_active_plausible | policy_active_candidate | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Major Burns | DB | MIA | MIA | sleeper_metadata_active_plausible | policy_active_candidate | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Robert Burns | RB | CHI | CHI | sleeper_metadata_active_plausible | policy_active_candidate | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| VJ Payne | DB | NYJ | NYJ | sleeper_metadata_active_plausible | policy_active_candidate | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Clayton Thorson | QB | NYG | NYG | sleeper_metadata_active_plausible | policy_active_candidate | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |

## Inactive / Stale

| Player | Pos | Projection Team | Metadata Team | Status | Policy Preview | Reasons |
|---|---|---|---|---|---|---|
| Mike Hartline | QB | IND |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Kevin O'Connell | QB | NYJ |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Kurt Warner | QB | ARI |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Byron Leftwich | QB | PIT |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Sean Ryan | TE | KC |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Nate Becker | TE | GB |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Nate Wieting | TE | NYG |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Michael Colubiale | TE | JAX |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Jevoni Robinson | TE | HOU |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Joe Sommers | TE | SEA |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| John Stephens | TE | DAL |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Josh Pederson | TE | JAX |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Jordan Murray | TE | NYG |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Donnie Ernsberger | TE | TEN | TEN | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Dylan Stapleton | TE | HOU |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Eli Wolf | TE | WAS |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Darion Clark | TE | CHI |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Colin Jeter | TE | TB |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Charles Scarff | TE | BAL |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Bryce Sterk | TE | CIN |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Alex Gray | TE | ATL |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Adam Zaruba | TE | PHI |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Sergio Bailey II | WR | TB |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Justin Thomas | WR | PIT |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Freddie Brown | WR | MIN |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Frank Stephens | WR | SF |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Ervin Philips | WR | TB |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Duce Staley | RB | PIT |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Damon Gibson | WR | ATL |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Cedric Benson | RB | GB |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Chris Orr | LB | CAR |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| D'Andre Walker | LB | SEA |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Kasim Edebali | LB | OAK |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Marcus Smith | LB | WAS |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Quentin Poling | LB | NO | NO | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Alex Carter | DB | WAS |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Craig Mager | DB | DEN |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| David Rivers | DB | MIA |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Don Carey | DB | DET |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Harlan Miller | DB | WAS |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Jayson Stanley | DB | GB |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Jeremy Clark | DB | NYJ |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Josh Nurse | DB | JAX |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Kamrin Moore | DB | NYG |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Michael Jordan | DB | TEN |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Michael Joseph | DB | CHI |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Treston Decoud | DB | DAL |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Daylon Mack | DL | ARI |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Robert Thomas | DL | BUF |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Will Clarke | DL | NO |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |

## Missing Metadata

No rows.

## Conflicts

| Player | Pos | Projection Team | Metadata Team | Status | Policy Preview | Reasons |
|---|---|---|---|---|---|---|
| Zach Conque | TE | IND |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Matt Nelson | TE | DET |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Marcus Lucas | TE | DAL |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Brandon Cottom | TE | SEA |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Deon Butler | WR | SEA |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Richard Jarvis | LB | BUF |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| James Looney | DL | GB |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Paul Quessenberry | RB | HOU |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Alex McGough | WR | GB |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Anthony Manzo-Lewis | RB | LAC |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Blake Mack | WR | KC |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Blake Sims | RB | TB |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Bug Howard | WR | TB |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Derek Parish | RB | JAX |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Ervin Philips | WR | TB |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Jacob Huesman | RB | NYG |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Kazmeir Allen | RB | WAS |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Lamar Jordan | WR | ATL |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Nick Holley | RB | LA |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Ross Scheuerman | WR | GB |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Ryan Yurachek | RB | DAL |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| JT Jones | DL | PIT |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Tim Tebow | QB | NYJ |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |

## v8.2 Safe Still Held Back

| Player | Pos | Projection Team | Metadata Team | Status | Policy Preview | Reasons |
|---|---|---|---|---|---|---|
| Mike Hartline | QB | IND |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Kevin O'Connell | QB | NYJ |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Kurt Warner | QB | ARI |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Byron Leftwich | QB | PIT |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Zach Heins | TE | LAC |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Zack Kuntz | TE | NYJ |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Zach Conque | TE | IND |  | sleeper_metadata_position_conflict | policy_manual_review | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Tyree Mayfield | TE | SF |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Tony Poljan | TE | BAL |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Travis Wilson | TE | LA |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Tim Semisch | TE | DEN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Trevor Wood | TE | PIT |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Trey Knox | TE | MIN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Troy Mangen | TE | ATL |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Thaddeus Moss | TE | CIN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Thomas Greaney | TE | CLE |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Thomas Odukoya | TE | NE |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Thomas Yassmin | TE | LAC |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Tyler Hoppes | TE | MIN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Tyler Neville | TE | DAL |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Tanner McLachlan | TE | LAC |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Tanner Taula | TE | TB |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Taylor Sloat | TE | TB |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Stephen Baggett | TE | CLE |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Steven Scheu | TE | DEN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Steven Stilianos | TE | DET |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Stevo Klotz | TE | LAC |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Shaun Beyer | TE | GB |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Shawn Bowman | TE | JAX |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Sage Surratt | TE | ARI |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Scooter Harrington | TE | CHI |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Scott Orndoff | TE | PHI |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Sean Ryan | TE | KC |  | sleeper_metadata_inactive_or_stale | policy_shadow_only | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Seth Green | TE | NO |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Rory Anderson | TE | CHI |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Ryan Becker | TE | ATL |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Ryan Jones | TE | NYG |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Rysen John | TE | CHI |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Roger Carter | TE | LA |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Romello Brooker | TE | LA |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Riley Sharp | TE | BAL |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Ray Hamilton | TE | WAS |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Patrick Murtagh | TE | DEN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Oscar Cardenas | TE | ARI |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Nick Bowers | TE | MIA |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Nick Eubanks | TE | IND |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Nick Guggemos | TE | GB |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Nick Truesdell | TE | MIN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Noah Gindorff | TE | PIT |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |
| Nolan Givan | TE | DET |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | crosswalk_confirmed_gsis not_in_current_roster_source not_in_rookie_source exact_sleeper_id_match |

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| no_live_outputs_changed | PASS | Report reads artifacts and writes only local H27 artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is imported or called. |
| rankings_unchanged | PASS | Blackbird Rank ordering is not imported, recalculated, or mutated. |
| draft_suggestions_unchanged | PASS | Draft Suggestion ordering is not imported, recalculated, or mutated. |
| war_room_scoring_unchanged | PASS | War Room scoring behavior is not imported, recalculated, or mutated. |
| v8_2_not_enabled | PASS | v8.2 feature flag and projection selector behavior are not changed. |
| only_exact_sleeper_id_join | PASS | Metadata joins use exact Sleeper IDs only. |
| v8_2_zero_checks_preserved | PASS | K, critical mover, meaningful rank mover, and legacy v8.2 zero checks remain zero. |
