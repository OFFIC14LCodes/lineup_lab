# Projection Promotion Final Readiness 2026

Dry run: true
Read only: true
Verdict: ready_for_shadow_promotion_review
Decisions file: artifacts/projections/backtesting/projection-promotion-review-decisions-2026.conservative.csv

## Summary

```json
{
  "eligibleRows": 3245,
  "manualReviewRowsRemaining": 0,
  "shadowOnlyRows": 1145,
  "blockedRows": 1245,
  "kRows": {
    "eligible_for_projection_promotion": 0,
    "manual_review_before_promotion": 0,
    "shadow_only": 98,
    "blocked_from_promotion": 29
  },
  "criticalMovementRows": {
    "eligible_for_projection_promotion": 0,
    "manual_review_before_promotion": 0,
    "shadow_only": 46,
    "blocked_from_promotion": 8
  },
  "unresolvedRows": 0,
  "validationErrors": 0,
  "policyViolations": 0
}
```

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| no_live_outputs_changed | PASS | Final readiness reads dry-run artifacts and writes only readiness artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is imported or called. |
| rankings_unchanged | PASS | Ranking code paths are not imported or modified. |
| draft_suggestions_unchanged | PASS | Draft suggestion code paths are not imported or executed. |
| war_room_unchanged | PASS | War Room UI code is not imported or modified. |
| all_manual_review_rows_accounted_for | PASS | 46/46 manual-review rows accounted for. |
| no_invalid_decisions | PASS | 0 validation issue(s). |
| no_legacy_rows_eligible | PASS | 0 legacy eligible row(s). |
| no_k_rows_eligible_without_override | PASS | 0 K row(s) eligible without explicit override. |
| critical_approvals_have_rationale | PASS | 0 critical approval(s) missing rationale. |
| unresolved_rows_reported | PASS | 0 unresolved row(s). |
| eligible_pool_generated | PASS | 3245 eligible row(s). |
| no_policy_violations | PASS | 0 policy violation(s). |

## Validation Issues

No validation issues.

## Policy Violations

No policy violations.

## Unresolved Rows

No rows.

## Top Eligible Movements

| Player | Pos | Team | Decision | Final Class | Points Delta | Current G | v8.2 G | Rationale |
|---|---|---|---|---|---:|---:|---:|---|
| Bhayshul Tuten | RB | JAX |  | eligible_for_projection_promotion | 18 | 9 | 12 |  |
| Dylan Sampson | RB | CLE |  | eligible_for_projection_promotion | 17.4 | 9 | 11.9 |  |
| Joe Flacco | QB | CIN |  | eligible_for_projection_promotion | -17 | 14 | 12.8 |  |
| Desmond Ridder | QB | GB |  | eligible_for_projection_promotion | 16.2 | 5 | 6.9 |  |
| Jacoby Brissett | QB | ARI |  | eligible_for_projection_promotion | -13.9 | 14 | 12.9 |  |
| Jalen Coker | WR | CAR |  | eligible_for_projection_promotion | 13 | 11 | 12.4 |  |
| Chris Godwin | WR | TB |  | eligible_for_projection_promotion | -12.8 | 12 | 11 |  |
| Kayshon Boutte | WR | NE |  | eligible_for_projection_promotion | 12.6 | 13 | 14.8 |  |
| Carson Wentz | QB | MIN |  | eligible_for_projection_promotion | 12.4 | 3 | 4 |  |
| Kareem Hunt | RB | KC |  | eligible_for_projection_promotion | 12.4 | 15 | 16.3 |  |
| Athan Kaliakmanis | QB | WAS |  | eligible_for_projection_promotion | 12 | 2 | 4 |  |
| Behren Morton | QB | NE |  | eligible_for_projection_promotion | 12 | 2 | 4 |  |
| Byron Leftwich | QB | PIT |  | eligible_for_projection_promotion | 12 | 2 | 4 |  |
| Cade Klubnik | QB | NYJ |  | eligible_for_projection_promotion | 12 | 2 | 4 |  |
| Carson Beck | QB | ARI |  | eligible_for_projection_promotion | 12 | 2 | 4 |  |
| Cole Payton | QB | PHI |  | eligible_for_projection_promotion | 12 | 2 | 4 |  |
| Daniel Jones | QB | IND |  | eligible_for_projection_promotion | -12 | 14 | 13.2 |  |
| Drew Allar | QB | PIT |  | eligible_for_projection_promotion | 12 | 2 | 4 |  |
| Fernando Mendoza | QB | LV |  | eligible_for_projection_promotion | 12 | 2 | 4 |  |
| Garrett Nussmeier | QB | KC |  | eligible_for_projection_promotion | 12 | 2 | 4 |  |
| Haynes King | QB | CAR |  | eligible_for_projection_promotion | 12 | 2 | 4 |  |
| Jack Strand | QB | ATL |  | eligible_for_projection_promotion | 12 | 2 | 4 |  |
| Jacob Clark | QB | LV |  | eligible_for_projection_promotion | 12 | 2 | 4 |  |
| Jalon Daniels | QB | TB |  | eligible_for_projection_promotion | 12 | 2 | 4 |  |
| Joe Fagnano | QB | BAL |  | eligible_for_projection_promotion | 12 | 2 | 4 |  |

## Top Manual-Review Movements

No rows.

## Top Shadow-Only Movements

| Player | Pos | Team | Decision | Final Class | Points Delta | Current G | v8.2 G | Rationale |
|---|---|---|---|---|---:|---:|---:|---|
| Ashton Jeanty | RB | LV | use_current_path_for_now | shadow_only | 43.5 | 9 | 12 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |
| RJ Harvey | RB | DEN | use_current_path_for_now | shadow_only | 36.3 | 9 | 12 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |
| Quinshon Judkins | RB | CLE | use_current_path_for_now | shadow_only | 32.4 | 9 | 11.7 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |
| TreVeyon Henderson | RB | NE | use_current_path_for_now | shadow_only | 32.1 | 9 | 12 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |
| Tyler Shough | QB | NO | use_current_path_for_now | shadow_only | 29 | 5 | 7 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |
| Woody Marks | RB | HOU | use_current_path_for_now | shadow_only | 27.9 | 9 | 12 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |
| Jacory Croskey-Merritt | RB | WAS | use_current_path_for_now | shadow_only | 25.5 | 9 | 12 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |
| J.J. McCarthy | QB | MIN | use_current_path_for_now | shadow_only | 25.4 | 5 | 7 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |
| Kyle Monangai | RB | CHI | use_current_path_for_now | shadow_only | 25.2 | 9 | 12 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |
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

## Top Blocked Movements

| Player | Pos | Team | Decision | Final Class | Points Delta | Current G | v8.2 G | Rationale |
|---|---|---|---|---|---:|---:|---:|---|
| Eli Manning | QB | NYG |  | blocked_from_promotion | 29 | 5 | 7 |  |
| Philip Rivers | QB | IND |  | blocked_from_promotion | 25.8 | 5 | 7 |  |
| Derrick Willies | WR | CLE |  | blocked_from_promotion | 24.6 | 1 | 3.7 |  |
| Doug Martin | RB | OAK |  | blocked_from_promotion | 23.7 | 9 | 12 |  |
| Isaiah Crowell | RB | LV |  | blocked_from_promotion | 21.6 | 9 | 11 |  |
| Wes Hills | RB | DET |  | blocked_from_promotion | 21.1 | 1 | 2.3 |  |
| Devlin Hodges | QB | PIT |  | blocked_from_promotion | 20.8 | 5 | 8.1 |  |
| Keith Ford | RB | GB |  | blocked_from_promotion | 20.8 | 1 | 4.2 |  |
| Dwayne Haskins | QB | PIT |  | blocked_from_promotion | 19.8 | 5 | 7 |  |
| Lenzy Pipkins | DB | CLE |  | blocked_from_promotion | 19.5 | 1 | 2.3 |  |
| Chris Ivory | RB | BUF |  | blocked_from_promotion | 18.8 | 9 | 12.3 |  |
| Alfred Blue | RB | JAX |  | blocked_from_promotion | 18 | 9 | 12 |  |
| Chris Conte | DB | TB |  | blocked_from_promotion | 18 | 1 | 2.5 |  |
| Jacquizz Rodgers | RB | NO |  | blocked_from_promotion | 16.5 | 9 | 11.9 |  |
| LeGarrette Blount | RB | DET |  | blocked_from_promotion | 16.5 | 9 | 12 |  |
| Cam Newton | QB | CAR |  | blocked_from_promotion | 16.2 | 5 | 6.2 |  |
| Emmanuel Sanders | WR | BUF |  | blocked_from_promotion | 15.7 | 15 | 16.6 |  |
| Jake Luton | QB | LV |  | blocked_from_promotion | 14.1 | 3 | 4.5 |  |
| William Hayes | DL | MIA |  | blocked_from_promotion | 14 | 1 | 2.4 |  |
| JaQuan Hardy | RB | DEN |  | blocked_from_promotion | 13.5 | 1 | 4 |  |
| Devonta Freeman | RB | BAL |  | blocked_from_promotion | 13.4 | 11 | 12.4 |  |
| Cameron Meredith | WR | NE |  | blocked_from_promotion | 13.2 | 3 | 4.5 |  |
| Brock Coyle | LB | SF |  | blocked_from_promotion | 13 | 1 | 2.3 |  |
| Kyron Brown | DB | BUF |  | blocked_from_promotion | 13 | 1 | 2.3 |  |
| Paul Richardson | WR | SEA |  | blocked_from_promotion | 13 | 8 | 9.8 |  |

## Critical Movement Rows

| Player | Pos | Team | Decision | Final Class | Points Delta | Current G | v8.2 G | Rationale |
|---|---|---|---|---|---:|---:|---:|---|
| Ashton Jeanty | RB | LV | use_current_path_for_now | shadow_only | 43.5 | 9 | 12 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |
| RJ Harvey | RB | DEN | use_current_path_for_now | shadow_only | 36.3 | 9 | 12 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |
| Quinshon Judkins | RB | CLE | use_current_path_for_now | shadow_only | 32.4 | 9 | 11.7 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |
| TreVeyon Henderson | RB | NE | use_current_path_for_now | shadow_only | 32.1 | 9 | 12 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |
| Eli Manning | QB | NYG |  | blocked_from_promotion | 29 | 5 | 7 |  |
| Tyler Shough | QB | NO | use_current_path_for_now | shadow_only | 29 | 5 | 7 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |
| Woody Marks | RB | HOU | use_current_path_for_now | shadow_only | 27.9 | 9 | 12 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |
| Philip Rivers | QB | IND |  | blocked_from_promotion | 25.8 | 5 | 7 |  |
| Jacory Croskey-Merritt | RB | WAS | use_current_path_for_now | shadow_only | 25.5 | 9 | 12 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |
| J.J. McCarthy | QB | MIN | use_current_path_for_now | shadow_only | 25.4 | 5 | 7 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |
| Kyle Monangai | RB | CHI | use_current_path_for_now | shadow_only | 25.2 | 9 | 12 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |
| Derrick Willies | WR | CLE |  | blocked_from_promotion | 24.6 | 1 | 3.7 |  |
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
| Doug Martin | RB | OAK |  | blocked_from_promotion | 23.7 | 9 | 12 |  |
| Russell Wilson | QB | NYG | use_current_path_for_now | shadow_only | 22.9 | 5 | 6.8 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |
| Dyontae Johnson | LB | NYG | use_current_path_for_now | shadow_only | 22.1 | 1 | 2.3 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |
| Isaiah Crowell | RB | LV |  | blocked_from_promotion | 21.6 | 9 | 11 |  |
| Wes Hills | RB | DET |  | blocked_from_promotion | 21.1 | 1 | 2.3 |  |
| Tyrod Taylor | QB | GB | use_current_path_for_now | shadow_only | 20.9 | 5 | 7.2 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |
| Devlin Hodges | QB | PIT |  | blocked_from_promotion | 20.8 | 5 | 8.1 |  |
| Keith Ford | RB | GB |  | blocked_from_promotion | 20.8 | 1 | 4.2 |  |
| Deshaun Watson | QB | CLE | use_current_path_for_now | shadow_only | 20.6 | 5 | 6.6 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |
| Austin Ekeler | RB | WAS | use_current_path_for_now | shadow_only | -20.5 | 9 | 6.8 | Critical 20+ projected-point movement requires roster/depth-chart/model-policy confirmation before v8.2 promotion; keep current path for this row during initial limited promotion-pool review. |

## Notes

- Dry-run/read-only final promotion-readiness report only.
- Final classifications are reporting output only and do not promote v8.2.
- K rows remain shadow-only unless an edited decision file explicitly approves them with an override rationale.
- No live projections, 2026 production outputs, Supabase writes, War Room UI, Blackbird Rank, or Draft Suggestion ordering are changed.
