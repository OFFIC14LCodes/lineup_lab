# Projection Promotion Review Decisions 2026

Dry run: true
Read only: true
Verdict: review_decisions_unresolved_rows_remaining
Decisions file: default decisions

## Summary

```json
{
  "defaultDecisionCounts": {
    "approve_for_candidate_pool": 0,
    "keep_shadow_only": 0,
    "block_from_promotion": 0,
    "cap_v8_2_movement": 0,
    "use_current_path_for_now": 0,
    "needs_external_roster_confirmation": 0,
    "needs_kicker_policy_review": 32,
    "unresolved": 14
  },
  "resolvedDecisionCounts": {
    "approve_for_candidate_pool": 0,
    "keep_shadow_only": 0,
    "block_from_promotion": 0,
    "cap_v8_2_movement": 0,
    "use_current_path_for_now": 0,
    "needs_external_roster_confirmation": 0,
    "needs_kicker_policy_review": 32,
    "unresolved": 14
  },
  "originalCandidatePool": {
    "eligible_for_projection_promotion": 3245,
    "manual_review_before_promotion": 46,
    "shadow_only": 1099,
    "blocked_from_promotion": 1245
  },
  "resolvedCandidatePool": {
    "eligible_for_projection_promotion": 3245,
    "manual_review_before_promotion": 14,
    "shadow_only": 1131,
    "blocked_from_promotion": 1245
  },
  "eligibleRows": 3245,
  "manualReviewRowsRemaining": 14,
  "shadowOnlyRows": 1131,
  "blockedRows": 1245,
  "kRows": 32,
  "criticalMovementRows": 46,
  "nonKCriticalMovementRows": 14,
  "unresolvedRows": 14
}
```

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| no_live_outputs_changed | PASS | Decision resolver reads dry-run artifacts and writes only decision artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is imported or called. |
| rankings_unchanged | PASS | Rank movement remains copied from dry-run diagnostics only. |
| draft_suggestions_unchanged | PASS | Draft suggestion code paths are not imported or executed. |
| war_room_unchanged | PASS | War Room UI code is not imported or modified. |
| decision_template_generated | PASS | 46 template rows generated. |
| k_rows_not_auto_approved | PASS | 32 K decision rows checked. |
| critical_rows_not_auto_approved | PASS | 46 critical rows checked. |
| resolved_pool_generated | PASS | 46 resolved rows generated. |
| unresolved_rows_reported | PASS | 14 unresolved rows reported. |

## Unresolved Non-K Rows

| Player | Pos | Team | Decision | Resolved Class | Points Delta | Current G | v8.2 G | Rationale |
|---|---|---|---|---|---:|---:|---:|---|
| Ashton Jeanty | RB | LV | unresolved | manual_review_before_promotion | 43.5 | 9 | 12 | Default decision: critical non-K movement requires human review before promotion. |
| RJ Harvey | RB | DEN | unresolved | manual_review_before_promotion | 36.3 | 9 | 12 | Default decision: critical non-K movement requires human review before promotion. |
| Quinshon Judkins | RB | CLE | unresolved | manual_review_before_promotion | 32.4 | 9 | 11.7 | Default decision: critical non-K movement requires human review before promotion. |
| TreVeyon Henderson | RB | NE | unresolved | manual_review_before_promotion | 32.1 | 9 | 12 | Default decision: critical non-K movement requires human review before promotion. |
| Tyler Shough | QB | NO | unresolved | manual_review_before_promotion | 29 | 5 | 7 | Default decision: critical non-K movement requires human review before promotion. |
| Woody Marks | RB | HOU | unresolved | manual_review_before_promotion | 27.9 | 9 | 12 | Default decision: critical non-K movement requires human review before promotion. |
| Jacory Croskey-Merritt | RB | WAS | unresolved | manual_review_before_promotion | 25.5 | 9 | 12 | Default decision: critical non-K movement requires human review before promotion. |
| J.J. McCarthy | QB | MIN | unresolved | manual_review_before_promotion | 25.4 | 5 | 7 | Default decision: critical non-K movement requires human review before promotion. |
| Kyle Monangai | RB | CHI | unresolved | manual_review_before_promotion | 25.2 | 9 | 12 | Default decision: critical non-K movement requires human review before promotion. |
| Russell Wilson | QB | NYG | unresolved | manual_review_before_promotion | 22.9 | 5 | 6.8 | Default decision: critical non-K movement requires human review before promotion. |
| Dyontae Johnson | LB | NYG | unresolved | manual_review_before_promotion | 22.1 | 1 | 2.3 | Default decision: critical non-K movement requires human review before promotion. |
| Tyrod Taylor | QB | GB | unresolved | manual_review_before_promotion | 20.9 | 5 | 7.2 | Default decision: critical non-K movement requires human review before promotion. |
| Deshaun Watson | QB | CLE | unresolved | manual_review_before_promotion | 20.6 | 5 | 6.6 | Default decision: critical non-K movement requires human review before promotion. |
| Austin Ekeler | RB | WAS | unresolved | manual_review_before_promotion | -20.5 | 9 | 6.8 | Default decision: critical non-K movement requires human review before promotion. |

## Resolved Rows

| Player | Pos | Team | Decision | Resolved Class | Points Delta | Current G | v8.2 G | Rationale |
|---|---|---|---|---|---:|---:|---:|---|
| Ashton Jeanty | RB | LV | unresolved | manual_review_before_promotion | 43.5 | 9 | 12 | Default decision: critical non-K movement requires human review before promotion. |
| RJ Harvey | RB | DEN | unresolved | manual_review_before_promotion | 36.3 | 9 | 12 | Default decision: critical non-K movement requires human review before promotion. |
| Quinshon Judkins | RB | CLE | unresolved | manual_review_before_promotion | 32.4 | 9 | 11.7 | Default decision: critical non-K movement requires human review before promotion. |
| TreVeyon Henderson | RB | NE | unresolved | manual_review_before_promotion | 32.1 | 9 | 12 | Default decision: critical non-K movement requires human review before promotion. |
| Tyler Shough | QB | NO | unresolved | manual_review_before_promotion | 29 | 5 | 7 | Default decision: critical non-K movement requires human review before promotion. |
| Woody Marks | RB | HOU | unresolved | manual_review_before_promotion | 27.9 | 9 | 12 | Default decision: critical non-K movement requires human review before promotion. |
| Jacory Croskey-Merritt | RB | WAS | unresolved | manual_review_before_promotion | 25.5 | 9 | 12 | Default decision: critical non-K movement requires human review before promotion. |
| J.J. McCarthy | QB | MIN | unresolved | manual_review_before_promotion | 25.4 | 5 | 7 | Default decision: critical non-K movement requires human review before promotion. |
| Kyle Monangai | RB | CHI | unresolved | manual_review_before_promotion | 25.2 | 9 | 12 | Default decision: critical non-K movement requires human review before promotion. |
| Alex Hale | K | GB | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Andrew Mevis | K | JAX | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Austin MacGinnis | K | LA | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| B.T. Potter | K | TB | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Blake Haubeil | K | CAR | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Cole Hedlund | K | IND | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| David Marvin | K | ATL | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Dominic Zvada | K | NYG | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Drew Stevens | K | WAS | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Gabe Brkic | K | GB | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Gabriel Plascencia | K | CHI | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Jack Podlesny | K | GB | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Jake Verity | K | JAX | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| James McCourt | K | LV | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| James Turner | K | DET | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Jonathan Garibay | K | DAL | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Jose Borregales | K | TB | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Justin Rohrwasser | K | NE | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Kansei Matsuzawa | K | LV | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Laith Marjan | K | PIT | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Lenny Krieg | K | ATL | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Maddux Trujillo | K | BUF | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Mark McNamee | K | GB | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Marshall Morgan | K | BUF | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Mason Shipley | K | NO | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Mike Meyer | K | JAX | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Quinn Nordin | K | NE | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Ross Martin | K | CLE | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Tanner Brown | K | ATL | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Trevor Moore | K | TB | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Tucker McCann | K | TEN | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Tyler Davis | K | BUF | needs_kicker_policy_review | shadow_only | 24 | 8 | 12 | Default decision: K rows require kicker policy review and remain shadow-only for this promotion round. |
| Russell Wilson | QB | NYG | unresolved | manual_review_before_promotion | 22.9 | 5 | 6.8 | Default decision: critical non-K movement requires human review before promotion. |
| Dyontae Johnson | LB | NYG | unresolved | manual_review_before_promotion | 22.1 | 1 | 2.3 | Default decision: critical non-K movement requires human review before promotion. |
| Tyrod Taylor | QB | GB | unresolved | manual_review_before_promotion | 20.9 | 5 | 7.2 | Default decision: critical non-K movement requires human review before promotion. |
| Deshaun Watson | QB | CLE | unresolved | manual_review_before_promotion | 20.6 | 5 | 6.6 | Default decision: critical non-K movement requires human review before promotion. |
| Austin Ekeler | RB | WAS | unresolved | manual_review_before_promotion | -20.5 | 9 | 6.8 | Default decision: critical non-K movement requires human review before promotion. |

## Notes

- Dry-run/read-only review decision registry only.
- Default decisions do not promote v8.2 and do not mutate the promotion candidate pool.
- K rows default to needs_kicker_policy_review and resolve to shadow_only for the current promotion round.
- Critical non-K rows default to unresolved and remain manual_review_before_promotion until human review.
- No live projections, 2026 production outputs, Supabase writes, War Room UI, Blackbird Rank, or Draft Suggestion ordering are changed.
