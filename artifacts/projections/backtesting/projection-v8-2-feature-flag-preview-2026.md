# Projection v8.2 Feature-Flag Selector Preview 2026

Dry run: true
Read only: true
Feature flag: BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES
Recommendation: selector_preview_clean

## Disabled Mode

```json
{
  "totalRows": 5635,
  "currentPathRows": 5635,
  "v82Rows": 0,
  "excludedRows": 0,
  "blockedRows": 0,
  "kRowsUsingV82": 0,
  "criticalMovementRowsUsingV82": 0,
  "meaningfulRankMoversUsingV82": 0,
  "legacyRowsUsingV82": 0,
  "mismatches": 0,
  "protectedRowViolations": 0
}
```

## Enabled Mode

```json
{
  "totalRows": 5635,
  "currentPathRows": 147,
  "v82Rows": 3210,
  "excludedRows": 1033,
  "blockedRows": 1245,
  "kRowsUsingV82": 0,
  "criticalMovementRowsUsingV82": 0,
  "meaningfulRankMoversUsingV82": 0,
  "legacyRowsUsingV82": 0,
  "mismatches": 0,
  "protectedRowViolations": 0
}
```

## Expected Readiness Counts

```json
{
  "wouldUseV82UnderFlag": 3210,
  "wouldUseCurrentPathUnderFlag": 147,
  "excludedFromFlagPool": 1033,
  "blockedFromFlagPool": 1245,
  "kRowsUsingV82": 0,
  "criticalMovementRowsUsingV82": 0,
  "meaningfulRankMoversUsingV82": 0,
  "legacyRowsUsingV82": 0
}
```

## Missing Artifacts Fail-Closed Mode

```json
{
  "totalRows": 5635,
  "currentPathRows": 5635,
  "v82Rows": 0,
  "excludedRows": 0,
  "blockedRows": 0,
  "kRowsUsingV82": 0,
  "criticalMovementRowsUsingV82": 0,
  "meaningfulRankMoversUsingV82": 0,
  "legacyRowsUsingV82": 0,
  "mismatches": 0,
  "protectedRowViolations": 0
}
```

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| disabled_mode_zero_v8_2_rows | PASS | 0 disabled-mode row(s) selected v8.2. |
| enabled_mode_matches_readiness_counts | PASS | actual v8.2/current/excluded/blocked 3210/147/1033/1245; expected 3210/147/1033/1245 |
| k_rows_not_using_v8_2 | PASS | 0 K row(s) selected v8.2. |
| critical_movers_not_using_v8_2 | PASS | 0 critical movement row(s) selected v8.2. |
| meaningful_rank_movers_not_using_v8_2 | PASS | 0 meaningful rank mover(s) selected v8.2. |
| legacy_rows_not_using_v8_2 | PASS | 0 legacy/stale row(s) selected v8.2. |
| missing_artifacts_fail_closed | PASS | 0 missing-artifact row(s) selected v8.2. |
| mismatch_rows_zero | PASS | 0 selector/readiness mismatch row(s). |
| protected_row_violations_zero | PASS | 0 protected-row violation(s). |
| no_live_outputs_changed | PASS | Preview writes only dry-run artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is imported or called. |
| rankings_unchanged | PASS | Ranking code paths are not imported or executed. |
| draft_suggestions_unchanged | PASS | Draft suggestion code paths are not imported or executed. |
| war_room_unchanged | PASS | War Room UI code is not imported or modified. |

## Mismatches

No rows.

## Protected-Row Violations

No rows.

## Notes

- Dry-run/read-only selector preview only.
- The selector is exercised in disabled, enabled, and missing-artifact modes without wiring it into live projection generation.
- No live projections, 2026 production outputs, Supabase writes, Blackbird Rank, Draft Suggestion ordering, War Room UI, or v8.2 promotion paths are changed.
