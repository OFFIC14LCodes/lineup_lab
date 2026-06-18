# Projection v8.2 Snapshot Diff Guard 2026

Dry run: true
Read only: true
Recommendation: snapshot_diff_guard_clean

## Default Snapshot

```json
{
  "totalRows": 78890,
  "selectorRows": 5635,
  "selectorFlagEnabled": false,
  "readinessArtifactsAvailable": true,
  "v82SelectedRows": 0,
  "currentPathRows": 5635,
  "projectionDeltasVsCurrentPath": 0,
  "rankingAffectingDeltas": 0,
  "protectedRowViolations": 0
}
```

## Enabled Validation

Strategy: pipeline_preview_artifact_no_enabled_snapshot_written

```json
{
  "rowsEvaluated": 5635,
  "currentPathRows": 147,
  "v82Rows": 3210,
  "excludedRows": 1033,
  "blockedRows": 1245,
  "projectionTotalMismatchesVsCurrent": 0,
  "maxProjectionDeltaVsCurrent": 18,
  "rankingAffectingOutputDeltaRows": 1488,
  "protectedRowViolations": 0,
  "mismatchesWithSelectorPreview": 0,
  "mismatchesWithReadiness": 0,
  "kRowsUsingV82": 0,
  "criticalMovementRowsUsingV82": 0,
  "meaningfulRankMoversUsingV82": 0,
  "legacyRowsUsingV82": 0,
  "movementBuckets": {
    "0": 2718,
    "20+": 8,
    "10-20": 94,
    "5-10": 651,
    "0-5": 2164
  },
  "positionSummaries": [
    {
      "segment": "QB",
      "rows": 293,
      "averageProjectedTotalDeltaVsCurrent": 2.453,
      "maxAbsProjectedTotalDeltaVsCurrent": 16.2,
      "rowsMoving5Plus": 44,
      "rowsMoving10Plus": 31,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "RB",
      "rows": 686,
      "averageProjectedTotalDeltaVsCurrent": 0.956,
      "maxAbsProjectedTotalDeltaVsCurrent": 18,
      "rowsMoving5Plus": 63,
      "rowsMoving10Plus": 3,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "WR",
      "rows": 1211,
      "averageProjectedTotalDeltaVsCurrent": 0.601,
      "maxAbsProjectedTotalDeltaVsCurrent": 13,
      "rowsMoving5Plus": 141,
      "rowsMoving10Plus": 2,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "TE",
      "rows": 570,
      "averageProjectedTotalDeltaVsCurrent": 5.013,
      "maxAbsProjectedTotalDeltaVsCurrent": 7.5,
      "rowsMoving5Plus": 260,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "K",
      "rows": 127,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "DL",
      "rows": 803,
      "averageProjectedTotalDeltaVsCurrent": 1.543,
      "maxAbsProjectedTotalDeltaVsCurrent": 9.7,
      "rowsMoving5Plus": 12,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "LB",
      "rows": 823,
      "averageProjectedTotalDeltaVsCurrent": 0.075,
      "maxAbsProjectedTotalDeltaVsCurrent": 7.8,
      "rowsMoving5Plus": 9,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "DB",
      "rows": 1122,
      "averageProjectedTotalDeltaVsCurrent": 0.824,
      "maxAbsProjectedTotalDeltaVsCurrent": 7,
      "rowsMoving5Plus": 7,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "DST",
      "rows": 0,
      "averageProjectedTotalDeltaVsCurrent": null,
      "maxAbsProjectedTotalDeltaVsCurrent": null,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    }
  ],
  "cohortSummaries": [
    {
      "segment": "idp",
      "rows": 2748,
      "averageProjectedTotalDeltaVsCurrent": 0.819,
      "maxAbsProjectedTotalDeltaVsCurrent": 9.7,
      "rowsMoving5Plus": 28,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "idp_conservative",
      "rows": 1757,
      "averageProjectedTotalDeltaVsCurrent": 1.27,
      "maxAbsProjectedTotalDeltaVsCurrent": 9.7,
      "rowsMoving5Plus": 28,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "k_fallback",
      "rows": 127,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "kicker",
      "rows": 127,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "low_prior_sample",
      "rows": 2973,
      "averageProjectedTotalDeltaVsCurrent": 1.858,
      "maxAbsProjectedTotalDeltaVsCurrent": 12,
      "rowsMoving5Plus": 438,
      "rowsMoving10Plus": 25,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "no_prior_stats",
      "rows": 1689,
      "averageProjectedTotalDeltaVsCurrent": 1.874,
      "maxAbsProjectedTotalDeltaVsCurrent": 12,
      "rowsMoving5Plus": 438,
      "rowsMoving10Plus": 25,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "offense",
      "rows": 2760,
      "averageProjectedTotalDeltaVsCurrent": 1.803,
      "maxAbsProjectedTotalDeltaVsCurrent": 18,
      "rowsMoving5Plus": 508,
      "rowsMoving10Plus": 36,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "rookie",
      "rows": 483,
      "averageProjectedTotalDeltaVsCurrent": 2.617,
      "maxAbsProjectedTotalDeltaVsCurrent": 12,
      "rowsMoving5Plus": 178,
      "rowsMoving10Plus": 25,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "second_year_low_prior",
      "rows": 953,
      "averageProjectedTotalDeltaVsCurrent": 0.783,
      "maxAbsProjectedTotalDeltaVsCurrent": 18,
      "rowsMoving5Plus": 5,
      "rowsMoving10Plus": 3,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "te_fallback",
      "rows": 570,
      "averageProjectedTotalDeltaVsCurrent": 5.013,
      "maxAbsProjectedTotalDeltaVsCurrent": 7.5,
      "rowsMoving5Plus": 260,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "veteran_prior_sample",
      "rows": 831,
      "averageProjectedTotalDeltaVsCurrent": 0.125,
      "maxAbsProjectedTotalDeltaVsCurrent": 16.2,
      "rowsMoving5Plus": 65,
      "rowsMoving10Plus": 8,
      "rowsMoving20Plus": 0
    }
  ]
}
```

## Missing Artifacts

```json
{
  "v82SelectedRows": 0,
  "currentPathRows": 5635
}
```

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| default_snapshot_flag_disabled | PASS | flag enabled: false |
| default_snapshot_zero_v8_2_rows | PASS | 0 default snapshot row(s) selected v8.2. |
| default_snapshot_current_path_only | PASS | 5635/5635 selector rows current path. |
| default_snapshot_no_protected_violations | PASS | 0 default protected-row violation(s). |
| default_snapshot_projection_deltas_zero | PASS | projection deltas 0; ranking deltas 0 |
| enabled_counts_match_readiness_or_preview | PASS | actual v8.2/current/excluded/blocked 3210/147/1033/1245 |
| enabled_protected_rows_zero | PASS | K/critical/rank/legacy 0/0/0/0 |
| missing_artifacts_fail_closed | PASS | 0 missing-artifact row(s) selected v8.2. |
| pipeline_preview_clean | PASS | pipeline_selector_preview_clean |
| no_live_outputs_changed | PASS | Guard writes only dry-run report artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is imported or called. |
| rankings_unchanged | PASS | Ranking code paths are not imported or executed. |
| draft_suggestions_unchanged | PASS | Draft suggestion code paths are not imported or executed. |
| war_room_unchanged | PASS | War Room UI code is not imported or modified. |
| default_artifact_restored_or_unchanged | PASS | Default snapshot remains disabled/current-path-only. |

## Notes

- Dry-run/read-only v8.2 snapshot diff guard.
- Enabled-mode validation uses selector and pipeline preview artifacts; no enabled snapshot artifact is generated or written by this guard.
- No live projections, 2026 production outputs, Supabase writes, Blackbird Rank, Draft Suggestion ordering, War Room UI, or v8.2 promotion paths are changed.
