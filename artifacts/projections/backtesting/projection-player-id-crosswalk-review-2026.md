# Projection Player ID Crosswalk Review 2026

Dry run: true
Read only: true
Recommendation: player_id_crosswalk_ready_for_source_integration_preview

## Summary

```json
{
  "targetRows": 1052,
  "confirmedRows": 1052,
  "conflictRows": 0,
  "ambiguousRows": 0,
  "reviewCandidateRows": 0,
  "missingRows": 0,
  "byStatus": {
    "crosswalk_confirmed": 1052,
    "crosswalk_conflict": 0,
    "crosswalk_missing": 0,
    "crosswalk_ambiguous": 0,
    "crosswalk_review_candidate": 0,
    "source_missing": 0
  },
  "byIntegrationPreview": {
    "use_current_roster_source": 0,
    "use_rookie_team_confirmation_source": 0,
    "manual_review": 1052,
    "still_needs_crosswalk": 0
  }
}
```

## Source Coverage

```json
{
  "sleeperMetadataRows": 12199,
  "sleeperMetadataRowsWithGsis": 3893,
  "csvCrosswalkRows": 2,
  "csvConfirmedRows": 1,
  "snapshotBridgeRows": 1052,
  "targetRowsWithSleeperId": 1052,
  "targetRowsWithSnapshotGsis": 1052
}
```

## Integration Preview

```json
{
  "wouldRouteTo": {
    "use_current_roster_source": 0,
    "use_rookie_team_confirmation_source": 0,
    "manual_review": 1052,
    "still_needs_crosswalk": 0
  },
  "notes": [
    "Preview routing is evidence only and does not update H21 policy packets.",
    "Confirmed crosswalk rows can be linked to current roster or rookie source artifacts by exact GSIS ID in a future dry-run."
  ]
}
```

## Confirmed Rows

| Player | Pos | Team | Sleeper | GSIS | Status | Preview | Evidence | Reasons |
|---|---|---|---|---|---|---|---|---|
| Mike Hartline | QB | IND | 3026 | 00-0028647 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Kevin O'Connell | QB | NYJ | 5833 | 00-0026234 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Kurt Warner | QB | ARI | 7 | 00-0017200 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Byron Leftwich | QB | PIT | 5817 | 00-0022177 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Zach Heins | TE | LAC | 11864 | 00-0039661 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Zack Kuntz | TE | NYJ | 9483 | 00-0038406 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Zach Conque | TE | IND | 4607 | 00-0033766 | crosswalk_confirmed | manual_review | sleeper_metadata snapshot | crosswalk_confirmed sleeper_metadata_gsis_bridge snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Tyree Mayfield | TE | SF | 6238 | 00-0035034 | crosswalk_confirmed | manual_review | sleeper_metadata snapshot | crosswalk_confirmed sleeper_metadata_gsis_bridge snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Tony Poljan | TE | BAL | 7972 | 00-0036583 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Travis Wilson | TE | LA | 4031 | 00-0033208 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Tim Semisch | TE | DEN | 2595 | 00-0032006 | crosswalk_confirmed | manual_review | sleeper_metadata snapshot | crosswalk_confirmed sleeper_metadata_gsis_bridge snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Trevor Wood | TE | PIT | 6263 | 00-0035170 | crosswalk_confirmed | manual_review | sleeper_metadata snapshot | crosswalk_confirmed sleeper_metadata_gsis_bridge snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Trey Knox | TE | MIN | 11601 | 00-0039711 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Troy Mangen | TE | ATL | 5245 | 00-0034146 | crosswalk_confirmed | manual_review | sleeper_metadata snapshot | crosswalk_confirmed sleeper_metadata_gsis_bridge snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Thaddeus Moss | TE | CIN | 6919 | 00-0036023 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Thomas Greaney | TE | CLE | 11351 | 00-0038713 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Thomas Odukoya | TE | NE | 8924 | 00-0038145 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Thomas Yassmin | TE | LAC | 12113 | 00-0039936 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Tyler Hoppes | TE | MIN | 5276 | 00-0034214 | crosswalk_confirmed | manual_review | sleeper_metadata snapshot | crosswalk_confirmed sleeper_metadata_gsis_bridge snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Tyler Neville | TE | DAL | 12850 | 00-0040050 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Tanner McLachlan | TE | LAC | 11598 | 00-0039399 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Tanner Taula | TE | TB | 11415 | 00-0038828 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Taylor Sloat | TE | TB | 2921 | SLO281988 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Stephen Baggett | TE | CLE | 5609 | 00-0034494 | crosswalk_confirmed | manual_review | sleeper_metadata snapshot | crosswalk_confirmed sleeper_metadata_gsis_bridge snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Steven Scheu | TE | DEN | 3504 | 00-0032582 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Steven Stilianos | TE | DET | 11960 | 00-0039654 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Stevo Klotz | TE | LAC | 12815 | 00-0040469 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Shaun Beyer | TE | GB | 8018 | 00-0036718 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Shawn Bowman | TE | JAX | 12217 | 00-0039550 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Sage Surratt | TE | ARI | 7576 | 00-0036753 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Scooter Harrington | TE | CHI | 7848 | 00-0036702 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Scott Orndoff | TE | PHI | 4309 | 00-0033240 | crosswalk_confirmed | manual_review | sleeper_metadata snapshot | crosswalk_confirmed sleeper_metadata_gsis_bridge snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Sean Ryan | TE | KC | 5834 | 00-0022817 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Seth Green | TE | NO | 8539 | 00-0037455 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Rory Anderson | TE | CHI | 2553 | 00-0032072 | crosswalk_confirmed | manual_review | sleeper_metadata snapshot | crosswalk_confirmed sleeper_metadata_gsis_bridge snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Ryan Becker | TE | ATL | 7162 | 00-0035914 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Ryan Jones | TE | NYG | 11298 | 00-0038480 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Rysen John | TE | CHI | 7379 | 00-0035991 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Roger Carter | TE | LA | 8747 | 00-0037632 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Romello Brooker | TE | LA | 6388 | 00-0035604 | crosswalk_confirmed | manual_review | sleeper_metadata snapshot | crosswalk_confirmed sleeper_metadata_gsis_bridge snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Riley Sharp | TE | BAL | 12250 | 00-0039256 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Ray Hamilton | TE | WAS | 2870 | 00-0031749 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Patrick Murtagh | TE | DEN | 11245 | 00-0039231 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Oscar Cardenas | TE | ARI | 12800 | 00-0040381 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Nick Bowers | TE | MIA | 7308 | 00-0036083 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Nick Eubanks | TE | IND | 7859 | 00-0036766 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Nick Guggemos | TE | GB | 8038 | 00-0036489 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Nick Truesdell | TE | MIN | 3921 | 00-0033149 | crosswalk_confirmed | manual_review | sleeper_metadata snapshot | crosswalk_confirmed sleeper_metadata_gsis_bridge snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Noah Gindorff | TE | PIT | 11225 | 00-0038758 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |
| Nolan Givan | TE | DET | 8817 | 00-0037462 | crosswalk_confirmed | manual_review | snapshot | crosswalk_confirmed snapshot_sleeper_gsis_bridge confirmed_crosswalk_no_roster_or_rookie_source_link |

## Conflicts

No rows.

## Ambiguous Rows

No rows.

## Review Candidates

No rows.

## Missing Rows

No rows.

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| no_live_outputs_changed | PASS | Report reads local artifacts and writes only local H24 artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is imported or called. |
| rankings_unchanged | PASS | Blackbird Rank ordering is not imported, recalculated, or mutated. |
| draft_suggestions_unchanged | PASS | Draft Suggestion ordering is not imported, recalculated, or mutated. |
| war_room_scoring_unchanged | PASS | War Room behavior is not imported, recalculated, or mutated. |
| v8_2_not_enabled | PASS | v8.2 feature flag and projection selector behavior are not changed. |
| only_h23_needs_id_crosswalk_rows_targeted | PASS | 1052 H23 needs_id_crosswalk rows evaluated. |
| name_team_position_not_confirmed | PASS | Name/team/position evidence is review-only. |
| required_h23_diagnostics_present | PASS | H23 diagnostics artifact is present. |

## Notes

- H24 is dry-run/read-only identity review only.
- Exact Sleeper metadata, exact source-declared CSV rows, and exact snapshot Sleeper/GSIS bridges can confirm identity.
- Name/team/position evidence is retained as review evidence and is not treated as a confirmed identity bridge.
- No live projections, rank, suggestions, War Room scoring, Supabase tables, or v8.2 selection are mutated.
