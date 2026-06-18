# Projection v8.2 Disabled Feature-Flag Readiness 2026

Dry run: true
Read only: true
Recommendation: ready_for_disabled_feature_flag_scaffold

## Summary

```json
{
  "totalRows": 5635,
  "wouldUseV82UnderFlag": 3210,
  "wouldUseCurrentPathUnderFlag": 147,
  "excludedFromFlagPool": 1033,
  "blockedFromFlagPool": 1245,
  "manualReviewRowsRemaining": 0,
  "unresolvedRowsRemaining": 0,
  "kRowsUsingV82": 0,
  "criticalMovementRowsUsingV82": 0,
  "meaningfulRankMoversUsingV82": 0,
  "legacyRowsUsingV82": 0
}
```

## Impact Summary

```json
{
  "rows": 3210,
  "averageProjectedPointDelta": 1.4,
  "medianProjectedPointDelta": 0,
  "maxProjectedPointDelta": 18,
  "movementBuckets": {
    "0": 1722,
    "10-20": 36,
    "5-10": 500,
    "0-5": 952
  }
}
```

## Current-Path Protection Summary

```json
{
  "eligible_for_flag_candidate": 0,
  "critical_movement_protected": 14,
  "kicker_policy_protected": 98,
  "tier_review_protected": 35,
  "qb_superflex_protected": 4,
  "injury_role_protected": 10,
  "model_policy_protected": 18,
  "shadow_only": 1033,
  "blocked_legacy": 1245,
  "blocked_other": 0,
  "manual_review_remaining": 0,
  "unresolved_tier_decision": 0,
  "missing_readiness_row": 0
}
```

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| no_live_outputs_changed | PASS | Readiness review writes only dry-run artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is imported or called. |
| rankings_unchanged | PASS | Rank data is read from dry-run artifacts only. |
| draft_suggestions_unchanged | PASS | Draft suggestion code paths are not imported or executed. |
| war_room_unchanged | PASS | War Room UI code is not imported or modified. |
| flag_not_enabled | PASS | No runtime feature flag is created or enabled. |
| v8_2_not_promoted | PASS | No live projection path is switched to v8.2. |
| manual_review_rows_zero | PASS | 0 manual-review row(s) remain. |
| unresolved_rows_zero | PASS | 0 unresolved row(s) remain. |
| k_rows_not_using_v8_2 | PASS | 0 K row(s) would use v8.2. |
| critical_movers_not_using_v8_2 | PASS | 0 critical movement row(s) would use v8.2. |
| meaningful_rank_movers_not_using_v8_2 | PASS | 0 meaningful rank mover(s) would use v8.2. |
| legacy_rows_not_using_v8_2 | PASS | 0 legacy row(s) would use v8.2. |
| candidate_set_generated | PASS | 5635 candidate rows generated. |
| impact_summary_generated | PASS | 3210 v8.2 impact row(s) summarized. |

## Top v8.2 Movements Under Disabled Flag Simulation

| Player | Pos | Team | Status | Pts Delta | Movement | Reasons |
|---|---|---|---|---:|---|---|
| Bhayshul Tuten | RB | JAX | would_use_v8_2_under_flag | 18 | 10-20 | eligible_for_flag_candidate |
| Dylan Sampson | RB | CLE | would_use_v8_2_under_flag | 17.4 | 10-20 | eligible_for_flag_candidate |
| Desmond Ridder | QB | GB | would_use_v8_2_under_flag | 16.2 | 10-20 | eligible_for_flag_candidate |
| Jalen Coker | WR | CAR | would_use_v8_2_under_flag | 13 | 10-20 | eligible_for_flag_candidate |
| Kayshon Boutte | WR | NE | would_use_v8_2_under_flag | 12.6 | 10-20 | eligible_for_flag_candidate |
| Carson Wentz | QB | MIN | would_use_v8_2_under_flag | 12.4 | 10-20 | eligible_for_flag_candidate |
| Athan Kaliakmanis | QB | WAS | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Behren Morton | QB | NE | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Byron Leftwich | QB | PIT | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Cade Klubnik | QB | NYJ | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Carson Beck | QB | ARI | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Cole Payton | QB | PHI | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Drew Allar | QB | PIT | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Fernando Mendoza | QB | LV | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Garrett Nussmeier | QB | KC | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Haynes King | QB | CAR | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Jack Strand | QB | ATL | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Jacob Clark | QB | LV | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Jalon Daniels | QB | TB | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Joe Fagnano | QB | BAL | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Joey Aguilar | QB | JAX | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Kevin O'Connell | QB | NYJ | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Kurt Warner | QB | ARI | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Kyron Drones | QB | GB | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Luke Altmyer | QB | DET | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Mark Gronowski | QB | MIA | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Matthew Caldwell | QB | LAR | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Mike Hartline | QB | IND | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Miller Moss | QB | CHI | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Taylen Green | QB | CLE | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Ty Simpson | QB | LAR | would_use_v8_2_under_flag | 12 | 10-20 | eligible_for_flag_candidate |
| Jake Browning | QB | TB | would_use_v8_2_under_flag | 11.2 | 10-20 | eligible_for_flag_candidate |
| Brashard Smith | RB | KC | would_use_v8_2_under_flag | 11.1 | 10-20 | eligible_for_flag_candidate |
| Jayden Daniels | QB | WAS | would_use_v8_2_under_flag | 11 | 10-20 | eligible_for_flag_candidate |
| Jameis Winston | QB | NYG | would_use_v8_2_under_flag | 10.3 | 10-20 | eligible_for_flag_candidate |
| Davis Mills | QB | HOU | would_use_v8_2_under_flag | 10.2 | 10-20 | eligible_for_flag_candidate |
| Zach Sieler | DL | MIA | would_use_v8_2_under_flag | 9.7 | 5-10 | eligible_for_flag_candidate |
| Ollie Gordon | RB | MIA | would_use_v8_2_under_flag | 9.6 | 5-10 | eligible_for_flag_candidate |
| Gardner Minshew | QB | ARI | would_use_v8_2_under_flag | 9.5 | 5-10 | eligible_for_flag_candidate |
| Stefon Diggs | WR | NE | would_use_v8_2_under_flag | 9.4 | 5-10 | eligible_for_flag_candidate |
| Jalen Nailor | WR | LV | would_use_v8_2_under_flag | 8.6 | 5-10 | eligible_for_flag_candidate |
| Jerry Jeudy | WR | CLE | would_use_v8_2_under_flag | 8.6 | 5-10 | eligible_for_flag_candidate |
| Kyler Murray | QB | MIN | would_use_v8_2_under_flag | 8.5 | 5-10 | eligible_for_flag_candidate |
| Michael Pittman | WR | PIT | would_use_v8_2_under_flag | 8.5 | 5-10 | eligible_for_flag_candidate |
| Darnell Mooney | WR | NYG | would_use_v8_2_under_flag | 8.3 | 5-10 | eligible_for_flag_candidate |
| Kimani Vidal | RB | LAC | would_use_v8_2_under_flag | 8.3 | 5-10 | eligible_for_flag_candidate |
| Michael Penix | QB | ATL | would_use_v8_2_under_flag | 8.3 | 5-10 | eligible_for_flag_candidate |
| Geno Smith | QB | NYJ | would_use_v8_2_under_flag | 8.2 | 5-10 | eligible_for_flag_candidate |
| Miles Sanders | RB | DAL | would_use_v8_2_under_flag | -8.2 | 5-10 | eligible_for_flag_candidate |
| Bailey Zappe | QB | NYJ | would_use_v8_2_under_flag | 7.9 | 5-10 | eligible_for_flag_candidate |

## Notes

- Dry-run/read-only disabled feature-flag readiness review only.
- No runtime feature flag is created or enabled by this report.
- Rows protected by conservative promotion or tier decisions remain on the current path in this simulation.
- No live projections, 2026 production outputs, Supabase writes, Blackbird Rank, Draft Suggestion ordering, War Room UI, or v8.2 promotion paths are changed.
