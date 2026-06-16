# h11-board-plan-fit

```json
{
  "generatedAt": "2026-06-16T15:55:25.966Z",
  "verdict": "passed",
  "checks": [
    {
      "name": "board_rows_receive_plan_fit",
      "passed": true,
      "detail": "Kicker:avoid_forcing, RB Value:value_detour, QB Tier:contingency_fit"
    },
    {
      "name": "contextual_rank_primary",
      "passed": true,
      "detail": "static Blackbird league rank; ADP external reference only"
    },
    {
      "name": "h10_score_not_rank_source",
      "passed": true,
      "detail": "static Blackbird league rank; ADP external reference only"
    },
    {
      "name": "data_gaps_visible",
      "passed": true,
      "detail": "contextual gaps checked"
    },
    {
      "name": "projection_source_trust_visible",
      "passed": true,
      "detail": "source/unit/trust carried into plan fit rows"
    },
    {
      "name": "no_banned_language",
      "passed": true,
      "detail": "safe language"
    },
    {
      "name": "no_mutation",
      "passed": true,
      "detail": "synthetic read-only diagnostic"
    }
  ],
  "rows": [
    {
      "rank": 1,
      "playerName": "Kicker",
      "planFit": "avoid_forcing",
      "planFitReasons": [
        "Fills roster thin spot.",
        "Unexpected contextual value signal.",
        "Avoid forcing K/DST before late-window evidence.",
        "Situation, snap, or depth-chart data is unavailable."
      ],
      "projectionSource": "h10_league_projection",
      "projectionUnit": "season",
      "projectionTrustLabel": "low",
      "projectionTrustScore": 30
    },
    {
      "rank": 2,
      "playerName": "RB Value",
      "planFit": "value_detour",
      "planFitReasons": [
        "Fits active round window.",
        "Unexpected contextual value signal.",
        "Position can likely wait.",
        "Situation, snap, or depth-chart data is unavailable."
      ],
      "projectionSource": "h10_league_projection",
      "projectionUnit": "season",
      "projectionTrustLabel": "low",
      "projectionTrustScore": 30
    },
    {
      "rank": 3,
      "playerName": "QB Tier",
      "planFit": "contingency_fit",
      "planFitReasons": [
        "Fits active round window.",
        "Fits active contingency.",
        "Fills roster thin spot.",
        "Unexpected contextual value signal.",
        "Tier risk is rising.",
        "Situation, snap, or depth-chart data is unavailable."
      ],
      "projectionSource": "h10_league_projection",
      "projectionUnit": "season",
      "projectionTrustLabel": "low",
      "projectionTrustScore": 30
    }
  ]
}
```
