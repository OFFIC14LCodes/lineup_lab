# Projection Production Shadow Review 2026

Dry run: true
Read only: true
Feature flag: BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES
Selector wired beyond dry-run: false
Recommendation: production_shadow_needs_review

## Summary

```json
{
  "totalProjectionRows": 5635,
  "currentPathRows": 147,
  "v82ShadowRows": 3210,
  "excludedRows": 1033,
  "blockedRows": 1245,
  "kRowsUsingV82": 0,
  "criticalMoversUsingV82": 0,
  "meaningfulRankMoversUsingV82": 0,
  "legacyRowsUsingV82": 0,
  "missingArtifactFallbackRows": 5635,
  "projectionPointDeltas": {
    "rowsWithDelta": 1488,
    "maxAbsDelta": 18,
    "averageAbsDelta": 3.786
  },
  "rankImpactDeltas": {
    "rowsWithEstimatedOverallRankMovement": 5466,
    "rowsWithEstimatedPositionRankMovement": 4800,
    "maxAbsOverallRankMovement": 2791,
    "maxAbsPositionRankMovement": 765
  },
  "draftSuggestionImpactEstimate": {
    "estimatedRowsWithPointDelta": 1488,
    "limitation": "Projection-delta proxy only; live draft room availability, roster need, ADP, and recommendation scoring are not replayed."
  },
  "warRoomImpactEstimate": {
    "estimatedRowsWithPointDelta": 1488,
    "limitation": "Projection-delta proxy only; War Room board/value/recommendation order is not recalculated."
  }
}
```

## Production Path Audit

| Path | File | Supabase writes | Rankings | Draft Suggestions | War Room | v8.2 wired | Safe to shadow |
|---|---|---:|---:|---:|---:|---:|---:|
| Preseason projection snapshot | src/lib/projections/backtesting/preseason-projection-snapshot-builder.ts | no | no | no | no | yes | yes |
| v8.2 feature-flag readiness | src/lib/projections/backtesting/projection-v8-2-feature-flag-readiness.ts | no | no | no | no | yes | yes |
| Selector pipeline preview | src/lib/projections/backtesting/projection-selector-pipeline-preview.ts | no | no | no | no | yes | yes |
| Combined projection read model | src/lib/projections/combined-projection-read-model.ts | no | yes | yes | yes | no | yes |
| Combined projection diagnostic script | scripts/h9-combined-projection-read-model.ts | no | yes | yes | yes | no | yes |
| H10 league value model | src/lib/projections/h10-league-value.ts | no | yes | yes | yes | no | yes |
| War Room value overlay | src/lib/draft/h10-war-room-overlay.ts | no | yes | yes | yes | no | yes |
| War Room recommendations | src/lib/draft/war-room-recommendations.ts | no | yes | yes | yes | no | yes |
| Draft room state API | src/app/api/draft-rooms/[draftRoomId]/state/route.ts | no | yes | yes | yes | no | yes |
| Pre-draft strategy | src/app/api/draft-rooms/[draftRoomId]/pre-draft-strategy/route.ts | no | yes | yes | yes | no | yes |
| AI GM context | src/lib/ai/war-room-ai-context.ts | no | yes | yes | yes | no | yes |
| Projection persistence scripts | scripts/h9-league-projection-dry-run.ts and related projection import scripts | yes | yes | yes | yes | no | no |

## Disabled Mode Equivalence

```json
{
  "rowsEvaluated": 5635,
  "currentPathRows": 5635,
  "v82Rows": 0,
  "excludedRows": 0,
  "blockedRows": 0,
  "projectionTotalMismatchesVsCurrent": 0,
  "maxProjectionDeltaVsCurrent": 0,
  "rankingAffectingOutputDeltaRows": 0,
  "protectedRowViolations": 0,
  "mismatchesWithSelectorPreview": 0,
  "mismatchesWithReadiness": 0,
  "kRowsUsingV82": 0,
  "criticalMovementRowsUsingV82": 0,
  "meaningfulRankMoversUsingV82": 0,
  "legacyRowsUsingV82": 0,
  "movementBuckets": {
    "0": 5635
  },
  "positionSummaries": [
    {
      "segment": "QB",
      "rows": 293,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "RB",
      "rows": 686,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "WR",
      "rows": 1211,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "TE",
      "rows": 570,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
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
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "LB",
      "rows": 823,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "DB",
      "rows": 1122,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
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
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "idp_conservative",
      "rows": 1757,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
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
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "no_prior_stats",
      "rows": 1689,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "offense",
      "rows": 2760,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "rookie",
      "rows": 483,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "second_year_low_prior",
      "rows": 953,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "te_fallback",
      "rows": 570,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "veteran_prior_sample",
      "rows": 831,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    }
  ]
}
```

## Enabled Mode Shadow

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

## Missing Artifacts Mode

```json
{
  "rowsEvaluated": 5635,
  "currentPathRows": 5635,
  "v82Rows": 0,
  "excludedRows": 0,
  "blockedRows": 0,
  "projectionTotalMismatchesVsCurrent": 0,
  "maxProjectionDeltaVsCurrent": 0,
  "rankingAffectingOutputDeltaRows": 0,
  "protectedRowViolations": 0,
  "mismatchesWithSelectorPreview": 0,
  "mismatchesWithReadiness": 0,
  "kRowsUsingV82": 0,
  "criticalMovementRowsUsingV82": 0,
  "meaningfulRankMoversUsingV82": 0,
  "legacyRowsUsingV82": 0,
  "movementBuckets": {
    "0": 5635
  },
  "positionSummaries": [
    {
      "segment": "QB",
      "rows": 293,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "RB",
      "rows": 686,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "WR",
      "rows": 1211,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "TE",
      "rows": 570,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
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
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "LB",
      "rows": 823,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "DB",
      "rows": 1122,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
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
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "idp_conservative",
      "rows": 1757,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
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
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "no_prior_stats",
      "rows": 1689,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "offense",
      "rows": 2760,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "rookie",
      "rows": 483,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "second_year_low_prior",
      "rows": 953,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "te_fallback",
      "rows": 570,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    },
    {
      "segment": "veteran_prior_sample",
      "rows": 831,
      "averageProjectedTotalDeltaVsCurrent": 0,
      "maxAbsProjectedTotalDeltaVsCurrent": 0,
      "rowsMoving5Plus": 0,
      "rowsMoving10Plus": 0,
      "rowsMoving20Plus": 0
    }
  ]
}
```

## Impact Preview

- Top projected point delta rows: 25
- Top estimated Blackbird Rank movement rows: 25
- Top estimated Draft Suggestion movement rows: 25
- Rows preserved by protection policy shown: 25

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| flag_defaults_disabled | PASS | 0 disabled-mode v8.2 row(s). |
| disabled_mode_current_path_only | PASS | disabled current/v8.2/excluded/blocked 5635/0/0/0 |
| disabled_mode_projection_equivalent | PASS | mismatches 0; ranking delta rows 0; max delta 0 |
| no_supabase_writes | PASS | H14 reads artifacts and writes only local dry-run report artifacts. |
| rankings_unchanged_by_default | PASS | 0 disabled-mode ranking-affecting delta row(s). |
| draft_suggestions_unchanged_by_default | PASS | Draft Suggestion inputs remain current path in disabled mode. |
| war_room_unchanged_by_default | PASS | War Room projection/value inputs remain current path in disabled mode. |
| enabled_shadow_matches_safe_subset | PASS | pipeline_selector_preview_clean |
| k_rows_protected | PASS | 0 K row(s) using v8.2. |
| critical_movers_protected | PASS | 0 critical mover(s) using v8.2. |
| meaningful_rank_movers_protected | PASS | 0 meaningful rank mover(s) using v8.2. |
| legacy_rows_blocked | PASS | 0 legacy/stale row(s) using v8.2. |
| missing_artifacts_fail_closed | PASS | 0 missing-artifact v8.2 row(s). |
| impact_preview_generated | PASS | 25 top point-delta row(s). |
| snapshot_diff_guard_clean | PASS | snapshot_diff_guard_clean |
| foundation_handoff_ready | PASS | foundation_ready_for_disabled_flag_code_review |

## Notes

- H14 is a dry-run/read-only production-path shadow review.
- The v8.2 selector is not wired into live projection generation, Supabase writes, Blackbird Rank, Draft Suggestions, War Room scoring, or draft room APIs by this report.
- Disabled mode must remain current-path-only; missing artifacts fail closed through the existing selector preview.
- Draft Suggestion and War Room impact estimates are projection-delta proxies only because live draft room state, roster need, ADP, and recommendation scoring inputs are not replayed here.
- Draft Suggestion movement is estimated from projection deltas only; live room availability, roster need, wait plans, ADP, scarcity, and recommendation scoring are not replayed.
- War Room value movement is estimated from projection deltas only; live value overlay and draft room APIs are not recalculated.
