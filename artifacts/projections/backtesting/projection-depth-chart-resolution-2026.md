# Projection Depth Chart Resolution 2026

Dry run: true
Read only: true
Recommendation: depth_chart_resolution_needs_source_population

## Summary

```json
{
  "targetDepthChartSourceRows": 1101,
  "sourceRows": 0,
  "matchedRows": 0,
  "confirmedActiveStarterBackup": 0,
  "reservePracticeSquad": 0,
  "inactiveInjured": 0,
  "teamConflicts": 0,
  "positionConflicts": 0,
  "reviewCandidates": 0,
  "unmatched": 1101,
  "sourceMissing": 0,
  "byPosition": {
    "WR": 170,
    "LB": 211,
    "DB": 273,
    "DL": 204,
    "QB": 40,
    "RB": 128,
    "TE": 75
  },
  "byTeam": {
    "ARI": 40,
    "BUF": 45,
    "NE": 28,
    "LA": 18,
    "DEN": 17,
    "NYG": 30,
    "TEN": 45,
    "SF": 38,
    "CIN": 17,
    "CAR": 40,
    "TB": 41,
    "NYJ": 34,
    "DAL": 34,
    "WAS": 53,
    "CHI": 25,
    "MIA": 44,
    "DET": 52,
    "IND": 24,
    "BAL": 36,
    "NO": 44,
    "PIT": 52,
    "HOU": 42,
    "MIN": 28,
    "CLE": 38,
    "LV": 41,
    "SEA": 27,
    "ATL": 33,
    "KC": 29,
    "PHI": 34,
    "LAC": 38,
    "JAX": 22,
    "GB": 12
  },
  "byV82SafeSubset": {
    "not_v82_safe_subset": 672,
    "v82_safe_subset": 429
  },
  "byImportanceBucket": {
    "high": 75,
    "low": 601,
    "moderate": 425
  },
  "byStatus": {
    "depth_chart_active_confirmed": 0,
    "depth_chart_starter_confirmed": 0,
    "depth_chart_backup_confirmed": 0,
    "depth_chart_reserve_or_practice_squad": 0,
    "depth_chart_inactive_or_injured": 0,
    "depth_chart_team_conflict": 0,
    "depth_chart_position_conflict": 0,
    "depth_chart_review_candidate": 0,
    "depth_chart_unmatched": 1101,
    "depth_chart_source_missing": 0
  }
}
```

## Policy Impact Preview

```json
{
  "h30FinalPolicyCountsBeforeDepthChart": {
    "final_policy_active_candidate": 2118,
    "final_policy_shadow_only": 695,
    "final_policy_current_path_only": 171,
    "final_policy_manual_review": 204,
    "final_policy_source_expansion_required": 1101,
    "final_policy_kicker_review_required": 127,
    "final_policy_blocked_archive": 1219
  },
  "h31DepthChartPreviewCounts": {
    "final_policy_active_candidate_preview": 0,
    "final_policy_shadow_only": 0,
    "final_policy_current_path_only": 0,
    "final_policy_manual_review": 0,
    "final_policy_source_expansion_required": 1101
  },
  "deltaActiveCandidatePreview": 0,
  "deltaShadowOnly": 0,
  "deltaCurrentPathOnly": 0,
  "deltaManualReview": 0,
  "deltaSourceExpansionRequired": 0
}
```

## v8.2 Controlled Flag Impact

```json
{
  "v82SafeRowsResolvedByDepthChart": 0,
  "v82SafeRowsNewlyAllowed": 0,
  "v82SafeRowsStillSourceExpansionRequired": 429,
  "v82SafeRowsMovedToManualReview": 0,
  "controlledFlagReviewRemainsBlocked": true,
  "protectedZeroChecks": {
    "kRowsUsingV82": true,
    "criticalMoversUsingV82": true,
    "meaningfulRankMoversUsingV82": true,
    "legacyRowsUsingV82": true
  }
}
```

## Active / Starter / Backup Confirmations

No rows.

## Reserve / Practice Squad

No rows.

## Conflicts

No rows.

## Still Unmatched

| Player | Pos | Team | Status | Policy | Match | Reasons |
|---|---|---|---|---|---|---|
| Desmond Ridder | QB | GB | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Tayler Hawkins | DB | SF | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Vincent Gray | DB | CLE | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Jamon Johnson | LB | GB | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Leonard Fournette | RB | BUF | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Jacob Kibodi | RB | CLE | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Rondale Moore | WR | MIN | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Kareem Hunt | RB | KC | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Daylen Baldwin | WR | ARI | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Davis Webb | QB | NYG | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| DeVante Parker | WR | PHI | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Spencer Brown | RB | ATL | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Titus Leo | DL | PHI | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Cole Beasley | WR | NYG | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Elijah Dotson | RB | ATL | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Stefon Diggs | WR | NE | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| David Blough | QB | DET | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Blake Watson | RB | TEN | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Caleb Huntley | RB | ATL | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| John Wolford | QB | MIN | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Anthony Brown | QB | BUF | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Colt McCoy | QB | ARI | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Jarvis Landry | WR | NO | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Miles Sanders | RB | DAL | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Marvin Jones | WR | DET | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Leonard Taylor | TE | JAX | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Jerand Bradley | TE | LAC | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Dylan Parham | TE | DEN | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Beau Gardner | TE | ATL | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Jayron Kearse | DB | DAL | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Dalvin Cook | RB | DAL | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Melvin Gordon | RB | BAL | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| A.J. Green | WR | ARI | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Tyler Boyd | WR | TEN | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Zyon Gilbert | DB | PIT | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| D'Onta Foreman | RB | CLE | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Donovan Wilson | DB | DAL | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Duke Johnson | RB | BUF | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Jadeveon Clowney | DL | DAL | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Curtis Samuel | WR | BUF | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Aaron Donald | DL | LA | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Sony Michel | RB | LA | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Terrance Mitchell | DB | SF | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| DeAndre Hopkins | WR | BAL | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Eric Rowe | DB | PIT | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Riley Nowakowski | RB | PIT | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Barion Brown | WR | NO | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Rudy Ford | DB | CAR | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| Rayshad Nichols | DL | BAL | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |
| J.J. Watt | DL | ARI | depth_chart_unmatched | final_policy_source_expansion_required | none | depth_chart_unmatched |

## v8.2 Safe Newly Allowed

No rows.

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| no_live_outputs_changed | PASS | Report reads artifacts and writes only local H31 artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is imported or called. |
| rankings_unchanged | PASS | Blackbird Rank ordering is not imported, recalculated, or mutated. |
| draft_suggestions_unchanged | PASS | Draft Suggestion ordering is not imported, recalculated, or mutated. |
| war_room_scoring_unchanged | PASS | War Room scoring behavior is not imported, recalculated, or mutated. |
| v8_2_not_enabled | PASS | v8.2 feature flag and projection selector behavior are not changed. |
| depth_chart_unmatched_not_forced_active | PASS | 0 unmatched/source-missing rows forced active. |
| conflicts_manual_review | PASS | 0 conflicts not manual-review. |
| zero_checks_preserved | PASS | K, critical mover, meaningful rank mover, and legacy v8.2 zero checks remain zero. |
