# Projection Active Policy Refresh Final 2026

Dry run: true
Read only: true
Recommendation: active_policy_final_needs_manual_review

## Policy Counts

```json
{
  "h21PolicyCounts": {
    "policy_active_candidate": 2097,
    "policy_shadow_only": 29,
    "policy_blocked_archive": 1219,
    "policy_manual_review": 4,
    "policy_source_expansion_required": 2153,
    "policy_kicker_review_required": 127,
    "policy_current_path_only": 6
  },
  "h28ScopedPolicyCounts": {
    "policy_active_candidate": 0,
    "policy_shadow_only": 138,
    "policy_blocked_archive": 0,
    "policy_manual_review": 23,
    "policy_source_expansion_required": 870,
    "policy_kicker_review_required": 0,
    "policy_current_path_only": 0,
    "policy_active_candidate_preview": 21
  },
  "h29ScopedPolicyCounts": {
    "free_agent_unknown_shadow_only": 528,
    "free_agent_unknown_current_path_only": 165,
    "free_agent_unknown_manual_review": 177,
    "free_agent_unknown_blocked_archive": 0,
    "free_agent_unknown_source_expansion_required": 0
  },
  "h30FinalPolicyCounts": {
    "final_policy_active_candidate": 2118,
    "final_policy_shadow_only": 695,
    "final_policy_current_path_only": 171,
    "final_policy_manual_review": 204,
    "final_policy_source_expansion_required": 1101,
    "final_policy_kicker_review_required": 127,
    "final_policy_blocked_archive": 1219
  }
}
```

## Remaining Blockers

```json
{
  "manualReviewRows": 204,
  "kickerPolicyRows": 127,
  "positionConflictRows": 23,
  "inactiveStaleHeldBack": 138,
  "remainingSourceExpansionRows": 1101,
  "blockedArchiveRows": 1219,
  "freeAgentUnknownHighImportanceManualReviewRows": 177,
  "rosterConflictRows": 4,
  "currentPathManualRows": 3
}
```

## v8.2 Controlled Flag Impact

```json
{
  "safeV82RowsAllowedByFinalPolicy": 1754,
  "safeV82RowsHeldShadowOnly": 691,
  "safeV82RowsHeldCurrentPathOnly": 167,
  "safeV82RowsHeldManualReview": 202,
  "safeV82RowsStillSourceExpansionRequired": 429,
  "safeV82RowsBlockedArchive": 2,
  "safeV82RowsKickerReviewRequired": 0,
  "controlledFlagReviewRemainsBlocked": true,
  "protectedZeroChecks": {
    "kRowsUsingV82": true,
    "criticalMoversUsingV82": true,
    "meaningfulRankMoversUsingV82": true,
    "legacyRowsUsingV82": true
  }
}
```

## Source Expansion Recommendations

- depth_chart_source: 1101 rows. Remaining source-expansion rows need depth chart or equivalent active-universe evidence.
- manual_high_importance_free_agent_review: 177 rows. High-importance free-agent/unknown rows remain manual review before controlled v8.2 review.
- transaction_status_source: 138 rows. Inactive/stale rows need transaction or status evidence.
- kicker_policy: 127 rows. Kicker rows remain held until kicker-specific policy and source coverage exist.
- position_conflict_manual_review: 23 rows. Position conflicts require manual validation before active policy promotion.

## Manual Review Summary

### Free-Agent/Unknown High Importance

| Player | Pos | Team | Final Policy | Layer | Points Delta | Rank Movement | Reasons |
|---|---|---|---|---|---|---|---|
| Zach Heins | TE | LAC | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1449 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Zack Kuntz | TE | NYJ | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1449 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Tyree Mayfield | TE | SF | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1442 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Tony Poljan | TE | BAL | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1441 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Travis Wilson | TE | LA | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1441 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Tim Semisch | TE | DEN | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1440 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Trevor Wood | TE | PIT | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1440 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Trey Knox | TE | MIN | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1440 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Troy Mangen | TE | ATL | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1440 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Thaddeus Moss | TE | CIN | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1439 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Thomas Greaney | TE | CLE | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1439 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Thomas Odukoya | TE | NE | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1439 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Thomas Yassmin | TE | LAC | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1439 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Tyler Hoppes | TE | MIN | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1439 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Tyler Neville | TE | DAL | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1439 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Tanner McLachlan | TE | LAC | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1438 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Tanner Taula | TE | TB | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1438 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Taylor Sloat | TE | TB | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1438 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Stephen Baggett | TE | CLE | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1436 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Steven Scheu | TE | DEN | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1436 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Steven Stilianos | TE | DET | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1436 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Stevo Klotz | TE | LAC | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1436 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Shaun Beyer | TE | GB | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1433 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Shawn Bowman | TE | JAX | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1433 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Sage Surratt | TE | ARI | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1432 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Scooter Harrington | TE | CHI | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1432 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Scott Orndoff | TE | PHI | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1432 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Seth Green | TE | NO | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1432 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Rory Anderson | TE | CHI | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1431 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Ryan Becker | TE | ATL | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1431 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Ryan Jones | TE | NYG | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1431 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Rysen John | TE | CHI | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1431 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Roger Carter | TE | LA | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1430 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Romello Brooker | TE | LA | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1430 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Riley Sharp | TE | BAL | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1428 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Ray Hamilton | TE | WAS | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1426 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Patrick Murtagh | TE | DEN | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1423 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Oscar Cardenas | TE | ARI | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1421 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Nick Bowers | TE | MIA | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1420 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Nick Eubanks | TE | IND | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1420 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Nick Guggemos | TE | GB | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1420 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Nick Truesdell | TE | MIN | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1420 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Noah Gindorff | TE | PIT | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1420 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Nolan Givan | TE | DET | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1420 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Naz Bohannon | TE | JAX | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1419 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Neal Johnson | TE | NYJ | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1419 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Moral Stephens | TE | DEN | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1418 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Moritz Bohringer | TE | CIN | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1418 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Nakia Griffin-Stewart | TE | IND | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1418 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |
| Mike Rigerman | TE | BAL | final_policy_manual_review | h29_free_agent_unknown_policy_review | 7.5 | 1417 | h21_source_expansion_preserved h28_source_expansion_preserved h29_free_agent_manual_review v8_2_safe_subset_preserved |

### Position Conflicts

| Player | Pos | Team | Final Policy | Layer | Points Delta | Rank Movement | Reasons |
|---|---|---|---|---|---|---|---|
| Zach Conque | TE | IND | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | 7.5 | 1448 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |
| Matt Nelson | TE | DET | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | 7.5 | 1413 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |
| Marcus Lucas | TE | DAL | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | 7.5 | 1412 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |
| Brandon Cottom | TE | SEA | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | 7.5 | 1357 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |
| Deon Butler | WR | SEA | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | 6.3 | 593 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |
| Richard Jarvis | LB | BUF | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | -0.7 | -571 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |
| James Looney | DL | GB | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | -0.5 | -392 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |
| Paul Quessenberry | RB | HOU | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | 0.3 | 297 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |
| Alex McGough | WR | GB | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | 0 | -557 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |
| Anthony Manzo-Lewis | RB | LAC | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | 0 | -554 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |
| Blake Mack | WR | KC | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | 0 | -549 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |
| Blake Sims | RB | TB | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | 0 | -549 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |
| Bug Howard | WR | TB | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | 0 | -541 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |
| Derek Parish | RB | JAX | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | 0 | -500 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |
| Ervin Philips | WR | TB | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | 0 | -477 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |
| Jacob Huesman | RB | NYG | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | 0 | -458 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |
| Kazmeir Allen | RB | WAS | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | 0 | -411 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |
| Lamar Jordan | WR | ATL | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | 0 | -397 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |
| Nick Holley | RB | LA | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | 0 | -363 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |
| Ross Scheuerman | WR | GB | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | 0 | -344 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |
| Ryan Yurachek | RB | DAL | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | 0 | -344 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |
| JT Jones | DL | PIT | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | 0 | -220 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |
| Tim Tebow | QB | NYJ | final_policy_manual_review | h28_sleeper_metadata_policy_refresh | 0 | -90 | h21_source_expansion_preserved h28_position_conflict_manual_review v8_2_safe_subset_preserved |

### Roster Conflicts

| Player | Pos | Team | Final Policy | Layer | Points Delta | Rank Movement | Reasons |
|---|---|---|---|---|---|---|---|
| Adam Thielen | WR | PIT | final_policy_manual_review | h21_conservative_policy | -3.3 | -36 | h21_manual_review_preserved v8_2_safe_subset_preserved |
| Chandler Martin | LB | BAL | final_policy_manual_review | h21_conservative_policy | 3 | 127 | h21_manual_review_preserved |
| Jordan Mims | RB | TEN | final_policy_manual_review | h21_conservative_policy | -0.2 | -147 | h21_manual_review_preserved |
| Markees Watts | LB | TB | final_policy_manual_review | h21_conservative_policy | 0 | -499 | h21_manual_review_preserved v8_2_safe_subset_preserved |

### Current-Path Manual Rows

No rows.

### Other Manual Rows

No rows.

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| required_sources_present | PASS | H21, H28, and H29 artifacts are required. |
| no_live_outputs_changed | PASS | Report reads artifacts and writes only local H30 artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is imported or called. |
| rankings_unchanged | PASS | Blackbird Rank ordering is not imported, recalculated, or mutated. |
| draft_suggestions_unchanged | PASS | Draft Suggestion ordering is not imported, recalculated, or mutated. |
| war_room_scoring_unchanged | PASS | War Room scoring behavior is not imported, recalculated, or mutated. |
| v8_2_not_enabled | PASS | v8.2 feature flag and projection selector behavior are not changed. |
| free_agent_unknown_not_auto_promoted | PASS | 0 free-agent/unknown rows promoted. |
| kicker_rows_not_auto_promoted | PASS | 0 kicker rows promoted. |
| legacy_rows_blocked | PASS | 0 legacy rows not blocked/archive. |
| manual_review_rows_reported | PASS | 204 manual review rows reported. |
| zero_checks_preserved | PASS | K, critical mover, meaningful rank mover, and legacy v8.2 zero checks remain zero. |

## Notes

- H30 is a dry-run/read-only final policy refresh packet.
- Policy layers are applied in order: H21 conservative policy, H28 Sleeper metadata refresh, H29 free-agent/unknown policy review.
- Free-agent/unknown rows are not promoted to active candidates.
- No live projection, rank, suggestion, War Room scoring, Supabase, or v8.2 behavior is changed.
