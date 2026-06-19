# Projection Sleeper Policy Refresh 2026

Dry run: true
Read only: true
Recommendation: sleeper_policy_refresh_ready_for_transaction_source

## Summary

```json
{
  "totalSleeperRows": 1052,
  "activeCandidatesGainedFromSleeperMetadata": 21,
  "heldBackFromSleeperMetadata": 1031,
  "manualReviewPositionConflicts": 23,
  "inactiveStaleHeldBack": 138,
  "freeAgentUnknownHeldBack": 870,
  "missingMetadataHeldBack": 0,
  "teamConflictsManualReview": 0
}
```

## Before / After Policy Counts

```json
{
  "h21Before": {
    "policy_active_candidate": 0,
    "policy_shadow_only": 0,
    "policy_blocked_archive": 0,
    "policy_manual_review": 0,
    "policy_source_expansion_required": 1052,
    "policy_kicker_review_required": 0,
    "policy_current_path_only": 0
  },
  "h28After": {
    "policy_active_candidate": 0,
    "policy_shadow_only": 138,
    "policy_blocked_archive": 0,
    "policy_manual_review": 23,
    "policy_source_expansion_required": 870,
    "policy_kicker_review_required": 0,
    "policy_current_path_only": 0,
    "policy_active_candidate_preview": 21
  },
  "delta": {
    "policy_active_candidate": 0,
    "policy_shadow_only": 138,
    "policy_blocked_archive": 0,
    "policy_manual_review": 23,
    "policy_source_expansion_required": -182,
    "policy_kicker_review_required": 0,
    "policy_current_path_only": 0,
    "policy_active_candidate_preview": 21
  }
}
```

## v8.2 Safe Subset Impact

```json
{
  "newlyAllowedBySleeperMetadata": 21,
  "stillHeldBack": 1031,
  "heldBackByInactiveStale": 138,
  "heldBackByFreeAgentUnknown": 870,
  "heldBackByPositionConflict": 23,
  "heldBackByMissingMetadata": 0,
  "controlledFlagReviewRemainsBlocked": true,
  "protectedZeroChecks": {
    "kRowsUsingV82": true,
    "criticalMoversUsingV82": true,
    "meaningfulRankMoversUsingV82": true,
    "legacyRowsUsingV82": true
  }
}
```

## Source Recommendations

- free_agent_unknown_policy_review: 870 rows, 870 v8.2-safe rows. Free-agent/unknown rows are the largest remaining Sleeper metadata bucket and need a policy decision or external status source.
- transaction_status_source: 138 rows, 138 v8.2-safe rows. Inactive/stale rows need transaction or status evidence before any active-universe consideration.
- position_conflict_manual_review: 23 rows, 23 v8.2-safe rows. Position conflicts must remain manual review because they can alter roster-slot and scoring treatment.

## Active Plausible Rows

| Player | Pos | Projection Team | Metadata Team | Status | Original Policy | Refreshed Policy | Reasons |
|---|---|---|---|---|---|---|---|
| Luke Lachey | TE | GB | GB | sleeper_metadata_active_plausible | policy_source_expansion_required | policy_active_candidate_preview | sleeper_active_plausible_preview_allowed v8_2_safe_subset_preserved |
| Dax Raymond | TE | PIT | PIT | sleeper_metadata_active_plausible | policy_source_expansion_required | policy_active_candidate_preview | sleeper_active_plausible_preview_allowed v8_2_safe_subset_preserved |
| Max Tomczak | WR | BUF | BUF | sleeper_metadata_active_plausible | policy_source_expansion_required | policy_active_candidate_preview | sleeper_active_plausible_preview_allowed v8_2_safe_subset_preserved |
| Levi Wentz | WR | PIT | PIT | sleeper_metadata_active_plausible | policy_source_expansion_required | policy_active_candidate_preview | sleeper_active_plausible_preview_allowed v8_2_safe_subset_preserved |
| Joshua Pitsenberger | RB | HOU | HOU | sleeper_metadata_active_plausible | policy_source_expansion_required | policy_active_candidate_preview | sleeper_active_plausible_preview_allowed v8_2_safe_subset_preserved |
| Cameron Ross | WR | DEN | DEN | sleeper_metadata_active_plausible | policy_source_expansion_required | policy_active_candidate_preview | sleeper_active_plausible_preview_allowed v8_2_safe_subset_preserved |
| Justin Hilliard | LB | KC | KC | sleeper_metadata_active_plausible | policy_source_expansion_required | policy_active_candidate_preview | sleeper_active_plausible_preview_allowed v8_2_safe_subset_preserved |
| Wynton McManis | LB | MIA | MIA | sleeper_metadata_active_plausible | policy_source_expansion_required | policy_active_candidate_preview | sleeper_active_plausible_preview_allowed v8_2_safe_subset_preserved |
| Bryan Mills | DB | MIN | MIN | sleeper_metadata_active_plausible | policy_source_expansion_required | policy_active_candidate_preview | sleeper_active_plausible_preview_allowed v8_2_safe_subset_preserved |
| Daryl Porter | DB | PIT | PIT | sleeper_metadata_active_plausible | policy_source_expansion_required | policy_active_candidate_preview | sleeper_active_plausible_preview_allowed v8_2_safe_subset_preserved |
| Rojesterman Farris | DB | DEN | DEN | sleeper_metadata_active_plausible | policy_source_expansion_required | policy_active_candidate_preview | sleeper_active_plausible_preview_allowed v8_2_safe_subset_preserved |
| Tavien Feaster | RB | ARI | ARI | sleeper_metadata_active_plausible | policy_source_expansion_required | policy_active_candidate_preview | sleeper_active_plausible_preview_allowed v8_2_safe_subset_preserved |
| Benny LeMay | RB | CLE | CLE | sleeper_metadata_active_plausible | policy_source_expansion_required | policy_active_candidate_preview | sleeper_active_plausible_preview_allowed v8_2_safe_subset_preserved |
| Caleb Scott | WR | TEN | TEN | sleeper_metadata_active_plausible | policy_source_expansion_required | policy_active_candidate_preview | sleeper_active_plausible_preview_allowed v8_2_safe_subset_preserved |
| Da'Quan Felton | WR | NYJ | NYJ | sleeper_metadata_active_plausible | policy_source_expansion_required | policy_active_candidate_preview | sleeper_active_plausible_preview_allowed v8_2_safe_subset_preserved |
| Eldridge Massington | WR | NO | NO | sleeper_metadata_active_plausible | policy_source_expansion_required | policy_active_candidate_preview | sleeper_active_plausible_preview_allowed v8_2_safe_subset_preserved |
| Joaquin Davis | WR | PIT | PIT | sleeper_metadata_active_plausible | policy_source_expansion_required | policy_active_candidate_preview | sleeper_active_plausible_preview_allowed v8_2_safe_subset_preserved |
| Major Burns | DB | MIA | MIA | sleeper_metadata_active_plausible | policy_source_expansion_required | policy_active_candidate_preview | sleeper_active_plausible_preview_allowed v8_2_safe_subset_preserved |
| Robert Burns | RB | CHI | CHI | sleeper_metadata_active_plausible | policy_source_expansion_required | policy_active_candidate_preview | sleeper_active_plausible_preview_allowed v8_2_safe_subset_preserved |
| VJ Payne | DB | NYJ | NYJ | sleeper_metadata_active_plausible | policy_source_expansion_required | policy_active_candidate_preview | sleeper_active_plausible_preview_allowed v8_2_safe_subset_preserved |
| Clayton Thorson | QB | NYG | NYG | sleeper_metadata_active_plausible | policy_source_expansion_required | policy_active_candidate_preview | sleeper_active_plausible_preview_allowed v8_2_safe_subset_preserved |

## Inactive / Stale Examples

| Player | Pos | Projection Team | Metadata Team | Status | Original Policy | Refreshed Policy | Reasons |
|---|---|---|---|---|---|---|---|
| Mike Hartline | QB | IND |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Kevin O'Connell | QB | NYJ |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Kurt Warner | QB | ARI |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Byron Leftwich | QB | PIT |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Sean Ryan | TE | KC |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Nate Becker | TE | GB |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Nate Wieting | TE | NYG |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Michael Colubiale | TE | JAX |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Jevoni Robinson | TE | HOU |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Joe Sommers | TE | SEA |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| John Stephens | TE | DAL |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Josh Pederson | TE | JAX |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Jordan Murray | TE | NYG |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Donnie Ernsberger | TE | TEN | TEN | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Dylan Stapleton | TE | HOU |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Eli Wolf | TE | WAS |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Darion Clark | TE | CHI |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Colin Jeter | TE | TB |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Charles Scarff | TE | BAL |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Bryce Sterk | TE | CIN |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Alex Gray | TE | ATL |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Adam Zaruba | TE | PHI |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Sergio Bailey II | WR | TB |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Justin Thomas | WR | PIT |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Freddie Brown | WR | MIN |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Frank Stephens | WR | SF |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Ervin Philips | WR | TB |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Duce Staley | RB | PIT |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Damon Gibson | WR | ATL |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Cedric Benson | RB | GB |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Chris Orr | LB | CAR |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| D'Andre Walker | LB | SEA |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Kasim Edebali | LB | OAK |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Marcus Smith | LB | WAS |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Quentin Poling | LB | NO | NO | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Alex Carter | DB | WAS |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Craig Mager | DB | DEN |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| David Rivers | DB | MIA |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Don Carey | DB | DET |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Harlan Miller | DB | WAS |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Jayson Stanley | DB | GB |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Jeremy Clark | DB | NYJ |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Josh Nurse | DB | JAX |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Kamrin Moore | DB | NYG |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Michael Jordan | DB | TEN |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Michael Joseph | DB | CHI |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Treston Decoud | DB | DAL |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Daylon Mack | DL | ARI |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Robert Thomas | DL | BUF |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Will Clarke | DL | NO |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |

## Free Agent / Unknown Examples

| Player | Pos | Projection Team | Metadata Team | Status | Original Policy | Refreshed Policy | Reasons |
|---|---|---|---|---|---|---|---|
| Zach Heins | TE | LAC |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Zack Kuntz | TE | NYJ |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Tyree Mayfield | TE | SF |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Tony Poljan | TE | BAL |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Travis Wilson | TE | LA |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Tim Semisch | TE | DEN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Trevor Wood | TE | PIT |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Trey Knox | TE | MIN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Troy Mangen | TE | ATL |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Thaddeus Moss | TE | CIN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Thomas Greaney | TE | CLE |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Thomas Odukoya | TE | NE |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Thomas Yassmin | TE | LAC |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Tyler Hoppes | TE | MIN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Tyler Neville | TE | DAL |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Tanner McLachlan | TE | LAC |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Tanner Taula | TE | TB |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Taylor Sloat | TE | TB |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Stephen Baggett | TE | CLE |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Steven Scheu | TE | DEN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Steven Stilianos | TE | DET |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Stevo Klotz | TE | LAC |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Shaun Beyer | TE | GB |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Shawn Bowman | TE | JAX |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Sage Surratt | TE | ARI |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Scooter Harrington | TE | CHI |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Scott Orndoff | TE | PHI |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Seth Green | TE | NO |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Rory Anderson | TE | CHI |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Ryan Becker | TE | ATL |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Ryan Jones | TE | NYG |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Rysen John | TE | CHI |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Roger Carter | TE | LA |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Romello Brooker | TE | LA |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Riley Sharp | TE | BAL |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Ray Hamilton | TE | WAS |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Patrick Murtagh | TE | DEN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Oscar Cardenas | TE | ARI |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Nick Bowers | TE | MIA |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Nick Eubanks | TE | IND |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Nick Guggemos | TE | GB |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Nick Truesdell | TE | MIN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Noah Gindorff | TE | PIT |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Nolan Givan | TE | DET |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Naz Bohannon | TE | JAX |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Neal Johnson | TE | NYJ |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Moral Stephens | TE | DEN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Moritz Bohringer | TE | CIN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Nakia Griffin-Stewart | TE | IND |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Mike Rigerman | TE | BAL |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |

## Position Conflicts

| Player | Pos | Projection Team | Metadata Team | Status | Original Policy | Refreshed Policy | Reasons |
|---|---|---|---|---|---|---|---|
| Zach Conque | TE | IND |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| Matt Nelson | TE | DET |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| Marcus Lucas | TE | DAL |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| Brandon Cottom | TE | SEA |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| Deon Butler | WR | SEA |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| Richard Jarvis | LB | BUF |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| James Looney | DL | GB |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| Paul Quessenberry | RB | HOU |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| Alex McGough | WR | GB |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| Anthony Manzo-Lewis | RB | LAC |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| Blake Mack | WR | KC |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| Blake Sims | RB | TB |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| Bug Howard | WR | TB |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| Derek Parish | RB | JAX |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| Ervin Philips | WR | TB |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| Jacob Huesman | RB | NYG |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| Kazmeir Allen | RB | WAS |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| Lamar Jordan | WR | ATL |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| Nick Holley | RB | LA |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| Ross Scheuerman | WR | GB |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| Ryan Yurachek | RB | DAL |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| JT Jones | DL | PIT |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| Tim Tebow | QB | NYJ |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |

## v8.2 Safe Still Held Back

| Player | Pos | Projection Team | Metadata Team | Status | Original Policy | Refreshed Policy | Reasons |
|---|---|---|---|---|---|---|---|
| Mike Hartline | QB | IND |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Kevin O'Connell | QB | NYJ |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Kurt Warner | QB | ARI |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Byron Leftwich | QB | PIT |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Zach Heins | TE | LAC |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Zack Kuntz | TE | NYJ |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Zach Conque | TE | IND |  | sleeper_metadata_position_conflict | policy_source_expansion_required | policy_manual_review | sleeper_position_conflict_manual_review v8_2_safe_subset_preserved |
| Tyree Mayfield | TE | SF |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Tony Poljan | TE | BAL |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Travis Wilson | TE | LA |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Tim Semisch | TE | DEN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Trevor Wood | TE | PIT |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Trey Knox | TE | MIN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Troy Mangen | TE | ATL |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Thaddeus Moss | TE | CIN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Thomas Greaney | TE | CLE |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Thomas Odukoya | TE | NE |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Thomas Yassmin | TE | LAC |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Tyler Hoppes | TE | MIN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Tyler Neville | TE | DAL |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Tanner McLachlan | TE | LAC |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Tanner Taula | TE | TB |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Taylor Sloat | TE | TB |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Stephen Baggett | TE | CLE |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Steven Scheu | TE | DEN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Steven Stilianos | TE | DET |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Stevo Klotz | TE | LAC |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Shaun Beyer | TE | GB |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Shawn Bowman | TE | JAX |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Sage Surratt | TE | ARI |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Scooter Harrington | TE | CHI |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Scott Orndoff | TE | PHI |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Sean Ryan | TE | KC |  | sleeper_metadata_inactive_or_stale | policy_source_expansion_required | policy_shadow_only | sleeper_inactive_stale_held_back v8_2_safe_subset_preserved |
| Seth Green | TE | NO |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Rory Anderson | TE | CHI |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Ryan Becker | TE | ATL |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Ryan Jones | TE | NYG |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Rysen John | TE | CHI |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Roger Carter | TE | LA |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Romello Brooker | TE | LA |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Riley Sharp | TE | BAL |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Ray Hamilton | TE | WAS |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Patrick Murtagh | TE | DEN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Oscar Cardenas | TE | ARI |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Nick Bowers | TE | MIA |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Nick Eubanks | TE | IND |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Nick Guggemos | TE | GB |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Nick Truesdell | TE | MIN |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Noah Gindorff | TE | PIT |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |
| Nolan Givan | TE | DET |  | sleeper_metadata_free_agent_or_unknown | policy_source_expansion_required | policy_source_expansion_required | sleeper_free_agent_unknown_held_back v8_2_safe_subset_preserved |

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| required_sources_present | PASS | H27 Sleeper metadata resolution and H21 policy packet are required. |
| no_live_outputs_changed | PASS | Report reads artifacts and writes only local H28 artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is imported or called. |
| rankings_unchanged | PASS | Blackbird Rank ordering is not imported, recalculated, or mutated. |
| draft_suggestions_unchanged | PASS | Draft Suggestion ordering is not imported, recalculated, or mutated. |
| war_room_scoring_unchanged | PASS | War Room scoring behavior is not imported, recalculated, or mutated. |
| v8_2_not_enabled | PASS | v8.2 feature flag and projection selector behavior are not changed. |
| only_active_plausible_promoted_in_preview | PASS | 21 preview promotions checked. |
| inactive_stale_held_back | PASS | 0 inactive/stale rows promoted. |
| free_agent_unknown_held_back | PASS | 0 free-agent/unknown rows promoted. |
| position_conflicts_manual_review | PASS | 0 position conflicts promoted; 0 not manual-review. |
| zero_checks_preserved | PASS | K, critical mover, meaningful rank mover, and legacy v8.2 zero checks remain zero. |

## Notes

- H28 is a refreshed dry-run policy preview only; the original H21 artifact is not modified.
- Only Sleeper active-plausible rows are promoted to active-candidate preview.
- Inactive/stale, free-agent/unknown, missing metadata, and position-conflict rows remain held back.
- No live projection, rank, suggestion, War Room scoring, Supabase, or v8.2 behavior is changed.
