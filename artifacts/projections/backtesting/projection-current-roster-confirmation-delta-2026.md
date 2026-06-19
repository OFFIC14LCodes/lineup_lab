# Projection Current Roster Confirmation Delta 2026

Dry run: true
Read only: true
Real source status: real_source_present

## Before

```json
{
  "matchedRows": 0,
  "unmatchedRows": 5635,
  "confirmedActive": 0,
  "confirmedNonActive": 0,
  "confirmedFreeAgent": 0,
  "confirmedIrPupNfi": 0,
  "conflicts": 0,
  "legacyArchiveConfirmed": 0,
  "staleReviewResolved": 0,
  "manualReviewResolved": 0,
  "kRowsWithRosterDepthStatus": 0,
  "activeConfirmedIncrease": 0,
  "activeConfirmedDecrease": 0
}
```

## After

```json
{
  "matchedRows": 2180,
  "unmatchedRows": 3455,
  "confirmedActive": 2139,
  "confirmedNonActive": 8,
  "confirmedFreeAgent": 0,
  "confirmedIrPupNfi": 29,
  "conflicts": 4,
  "legacyArchiveConfirmed": 0,
  "staleReviewResolved": 33,
  "manualReviewResolved": 11,
  "kRowsWithRosterDepthStatus": 42,
  "activeConfirmedIncrease": 406,
  "activeConfirmedDecrease": 10
}
```

## Delta

```json
{
  "matchedRows": 2180,
  "unmatchedRows": -2180,
  "confirmedActive": 2139,
  "confirmedNonActive": 8,
  "confirmedFreeAgent": 0,
  "confirmedIrPupNfi": 29,
  "conflicts": 4,
  "legacyArchiveConfirmed": 0,
  "staleReviewResolved": 33,
  "manualReviewResolved": 11,
  "kRowsWithRosterDepthStatus": 42,
  "activeConfirmedIncrease": 406,
  "activeConfirmedDecrease": 10
}
```

Next command: none
