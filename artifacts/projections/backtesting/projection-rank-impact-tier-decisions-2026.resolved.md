# Projection Rank Impact Tier Decisions 2026

Dry run: true
Read only: true
Verdict: tier_decisions_ready
Decisions file: artifacts/projections/backtesting/projection-rank-impact-tier-decisions-2026.conservative.csv

## Summary

```json
{
  "totalTierReviewRows": 35,
  "defaultDecisionCounts": {
    "approve_v8_2_movement": 0,
    "use_current_path_for_now": 3,
    "keep_shadow_only": 0,
    "needs_roster_confirmation": 0,
    "needs_injury_role_review": 10,
    "needs_qb_superflex_review": 4,
    "needs_model_policy_review": 18,
    "unresolved": 0
  },
  "resolvedDecisionCounts": {
    "approve_v8_2_movement": 0,
    "use_current_path_for_now": 35,
    "keep_shadow_only": 0,
    "needs_roster_confirmation": 0,
    "needs_injury_role_review": 0,
    "needs_qb_superflex_review": 0,
    "needs_model_policy_review": 0,
    "unresolved": 0
  },
  "resolvedTierStatusCounts": {
    "tier_approved": 0,
    "tier_current_path": 35,
    "tier_shadow_only": 0,
    "tier_unresolved": 0
  },
  "validationErrors": 0,
  "policyViolations": 0,
  "qbSuperflexRowsByStatus": {
    "tier_approved": 0,
    "tier_current_path": 4,
    "tier_shadow_only": 0,
    "tier_unresolved": 0
  },
  "injuryRoleRowsByStatus": {
    "tier_approved": 0,
    "tier_current_path": 10,
    "tier_shadow_only": 0,
    "tier_unresolved": 0
  },
  "modelPolicyRowsByStatus": {
    "tier_approved": 0,
    "tier_current_path": 18,
    "tier_shadow_only": 0,
    "tier_unresolved": 0
  }
}
```

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| no_live_outputs_changed | PASS | Tier decisions read dry-run artifacts and write only decision registry artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is imported or called. |
| rankings_unchanged | PASS | Rank fields are copied from dry-run rank impact artifacts only. |
| draft_suggestions_unchanged | PASS | Draft suggestion code paths are not imported or executed. |
| war_room_unchanged | PASS | War Room UI code is not imported or modified. |
| v8_2_not_promoted | PASS | No production or live projection paths are changed. |
| conservative_decision_file_unchanged | PASS | The conservative promotion decision file is not rewritten. |
| decision_template_generated | PASS | 35 template rows generated. |
| resolved_registry_generated | PASS | 35/35 resolved rows generated. |
| validation_clean | PASS | 0 validation error(s). |
| policy_clean | PASS | 0 policy violation(s). |

## Validation Errors

No validation errors.

## Policy Violations

No policy violations.

## Unresolved QB / Superflex Rows

No rows.

## Unresolved Injury / Role Rows

No rows.

## Unresolved Model Policy Rows

No rows.

## Top Movement Rows by Final Status

### tier_approved

No rows.

### tier_current_path

| Player | Pos | Team | Decision | Status | Pts Delta | OVR Move | Pos Move | Rationale |
|---|---|---|---|---|---:|---:|---:|---|
| Joe Flacco | QB | CIN | use_current_path_for_now | tier_current_path | -17 | -47 | -3 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Jacoby Brissett | QB | ARI | use_current_path_for_now | tier_current_path | -13.9 | -50 | -1 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Chris Godwin | WR | TB | use_current_path_for_now | tier_current_path | -12.8 | -63 | -6 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Kareem Hunt | RB | KC | use_current_path_for_now | tier_current_path | 12.4 | 50 | 0 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Daniel Jones | QB | IND | use_current_path_for_now | tier_current_path | -12 | -24 | -6 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Terry McLaurin | WR | WAS | use_current_path_for_now | tier_current_path | -11.7 | -28 | -6 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Jayden Reed | WR | GB | use_current_path_for_now | tier_current_path | -11.3 | -88 | -7 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Mike Evans | WR | SF | use_current_path_for_now | tier_current_path | -11.1 | -30 | -4 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Cooper Kupp | WR | SEA | use_current_path_for_now | tier_current_path | 10.8 | 35 | 9 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Rico Dowdle | RB | PIT | use_current_path_for_now | tier_current_path | 9.9 | 30 | 1 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Trey Hendrickson | DL | BAL | use_current_path_for_now | tier_current_path | 7.4 | 51 | 5 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Ja'Quan McMillian | DB | DEN | use_current_path_for_now | tier_current_path | 7.1 | 32 | 15 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Leonard Williams | DL | SEA | use_current_path_for_now | tier_current_path | 7 | 43 | 1 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| DeAndre Hopkins | WR | BAL | use_current_path_for_now | tier_current_path | -6.4 | -50 | -6 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Quentin Johnston | WR | LAC | use_current_path_for_now | tier_current_path | -6.4 | -30 | -7 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Rome Odunze | WR | CHI | use_current_path_for_now | tier_current_path | -6.2 | -21 | -6 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Brandon Aiyuk | WR | SF | use_current_path_for_now | tier_current_path | -5.7 | -31 | -1 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Brian Robinson | RB | ATL | use_current_path_for_now | tier_current_path | -5.5 | -45 | -6 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Christian Watson | WR | GB | use_current_path_for_now | tier_current_path | -5.4 | -39 | -2 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Tank Dell | WR | HOU | use_current_path_for_now | tier_current_path | 5 | 16 | 7 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Will Levis | QB | TEN | use_current_path_for_now | tier_current_path | -4.5 | -26 | -1 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Mac Jones | QB | SF | use_current_path_for_now | tier_current_path | -4.2 | -34 | -1 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Jalen Thompson | DB | DAL | use_current_path_for_now | tier_current_path | 4.2 | 13 | 5 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Quentin Lake | DB | LAR | use_current_path_for_now | tier_current_path | 4.2 | 13 | 5 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |
| Fred Warner | LB | SF | use_current_path_for_now | tier_current_path | -4.1 | -9 | -5 | Meaningful rank-impact movement requires tier, role, injury, or Superflex review before v8.2 can affect this player; keep current path for this row during the first disabled feature-flag readiness review. |

### tier_shadow_only

No rows.

### tier_unresolved

No rows.

## Notes

- Dry-run/read-only rank impact tier decision registry only.
- Default decisions never auto-approve meaningful tier-review rows.
- Resolved tier statuses prepare later disabled feature-flag readiness review but do not promote v8.2.
- No live projections, 2026 production outputs, Supabase writes, Blackbird Rank, Draft Suggestion ordering, War Room UI, or conservative promotion decision files are changed.
