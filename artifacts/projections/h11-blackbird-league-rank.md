# h11-blackbird-league-rank

```json
{
  "generatedAt": "2026-06-16T01:04:46.216Z",
  "verdict": "passed",
  "diagnostics": {
    "totalPlayers": 9,
    "draftedPlayersIncluded": 2,
    "undraftedPlayersIncluded": 7,
    "projectionUnits": {
      "season": 9,
      "weekly": 0,
      "game": 0,
      "fallback": 0,
      "unknown": 0
    },
    "fallbackProjectionRows": 0,
    "adpPrimarySignal": false,
    "orderingMethod": "contextual league value -> projection -> name; ADP external reference only",
    "bannedLanguageFound": []
  },
  "sampleRows": [
    {
      "playerId": "qb",
      "playerName": "Superflex QB",
      "position": "QB",
      "team": "TST",
      "drafted": true,
      "blackbirdRank": 1,
      "blackbirdTier": 1,
      "leagueValueScore": 70.22,
      "projectedFantasyPoints": {
        "floor": 280,
        "median": 335,
        "ceiling": 380,
        "unit": "season",
        "source": "h10_league_projection",
        "scoringAware": true
      },
      "pointsAboveReplacement": 85,
      "valueComponents": {
        "projectionValue": 50,
        "floorCeilingShape": 83.28358208955224,
        "positionScarcity": 78,
        "rosterFormatFit": 65,
        "leagueFormatFit": 78,
        "ageCurve": 78,
        "dynastyValue": 68.9,
        "redraftValue": 50,
        "bestBallFit": 68.14925373134328,
        "superflexFit": 63.75,
        "idpFormatFit": 50,
        "situation": 50,
        "coachingEnvironment": 50,
        "depthChartRole": 50,
        "projectedSnapShare": 50,
        "confidence": 66,
        "riskAdjustment": 1
      },
      "confidence": "medium",
      "risk": "low",
      "reasons": [
        "Projection median contributes 50.0 component points.",
        "QB scarcity is elevated for this league.",
        "Superflex/2QB format lifts quarterback value.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape."
      ],
      "dataGaps": [
        "coaching environment",
        "depth chart role",
        "injury risk",
        "projected snap share",
        "role stability",
        "team defense environment",
        "team offense environment"
      ],
      "source": {
        "adp": 8,
        "externalMarketRank": 10,
        "h10RecommendationRank": null,
        "projectionRunId": null,
        "projectionVersion": "h10_league_value",
        "fallbackProjection": false
      }
    },
    {
      "playerId": "lb",
      "playerName": "Starter LB",
      "position": "LB",
      "team": "TST",
      "drafted": true,
      "blackbirdRank": 2,
      "blackbirdTier": 1,
      "leagueValueScore": 67.53,
      "projectedFantasyPoints": {
        "floor": 205,
        "median": 259,
        "ceiling": 300,
        "unit": "season",
        "source": "h10_league_projection",
        "scoringAware": true
      },
      "pointsAboveReplacement": 50,
      "valueComponents": {
        "projectionValue": 50,
        "floorCeilingShape": 83.4942084942085,
        "positionScarcity": 72,
        "rosterFormatFit": 65,
        "leagueFormatFit": 66,
        "ageCurve": 72,
        "dynastyValue": 67.1,
        "redraftValue": 50,
        "bestBallFit": 68.22297297297297,
        "superflexFit": 45,
        "idpFormatFit": 66,
        "situation": 50,
        "coachingEnvironment": 50,
        "depthChartRole": 50,
        "projectedSnapShare": 50,
        "confidence": 66,
        "riskAdjustment": 1
      },
      "confidence": "medium",
      "risk": "low",
      "reasons": [
        "Projection median contributes 50.0 component points.",
        "LB scarcity is elevated for this league.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape.",
        "IDP value is separated by defensive position and confidence."
      ],
      "dataGaps": [
        "coaching environment",
        "depth chart role",
        "injury risk",
        "projected snap share",
        "role stability",
        "team defense environment",
        "team offense environment"
      ],
      "source": {
        "adp": 110,
        "externalMarketRank": 10,
        "h10RecommendationRank": null,
        "projectionRunId": null,
        "projectionVersion": "idp_k_dst_v3_or_later",
        "fallbackProjection": false
      }
    },
    {
      "playerId": "wr",
      "playerName": "Ceiling WR",
      "position": "WR",
      "team": "TST",
      "drafted": false,
      "blackbirdRank": 3,
      "blackbirdTier": 1,
      "leagueValueScore": 66.79,
      "projectedFantasyPoints": {
        "floor": 175,
        "median": 245,
        "ceiling": 335,
        "unit": "season",
        "source": "h10_league_projection",
        "scoringAware": true
      },
      "pointsAboveReplacement": 45,
      "valueComponents": {
        "projectionValue": 50,
        "floorCeilingShape": 93.06122448979592,
        "positionScarcity": 58,
        "rosterFormatFit": 77,
        "leagueFormatFit": 50,
        "ageCurve": 71,
        "dynastyValue": 66.8,
        "redraftValue": 50,
        "bestBallFit": 85.87142857142857,
        "superflexFit": 45,
        "idpFormatFit": 50,
        "situation": 50,
        "coachingEnvironment": 50,
        "depthChartRole": 50,
        "projectedSnapShare": 50,
        "confidence": 66,
        "riskAdjustment": 1
      },
      "confidence": "medium",
      "risk": "low",
      "reasons": [
        "Projection median contributes 50.0 component points.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape."
      ],
      "dataGaps": [
        "coaching environment",
        "depth chart role",
        "injury risk",
        "projected snap share",
        "role stability",
        "team defense environment",
        "team offense environment"
      ],
      "source": {
        "adp": 18,
        "externalMarketRank": 10,
        "h10RecommendationRank": null,
        "projectionRunId": null,
        "projectionVersion": "h10_league_value",
        "fallbackProjection": false
      }
    },
    {
      "playerId": "te",
      "playerName": "Premium TE",
      "position": "TE",
      "team": "TST",
      "drafted": false,
      "blackbirdRank": 4,
      "blackbirdTier": 1,
      "leagueValueScore": 66.78,
      "projectedFantasyPoints": {
        "floor": 180,
        "median": 220,
        "ceiling": 275,
        "unit": "season",
        "source": "h10_league_projection",
        "scoringAware": true
      },
      "pointsAboveReplacement": 42,
      "valueComponents": {
        "projectionValue": 50,
        "floorCeilingShape": 89.20454545454545,
        "positionScarcity": 65,
        "rosterFormatFit": 65,
        "leagueFormatFit": 68,
        "ageCurve": 73,
        "dynastyValue": 67.4,
        "redraftValue": 50,
        "bestBallFit": 70.2215909090909,
        "superflexFit": 45,
        "idpFormatFit": 50,
        "situation": 50,
        "coachingEnvironment": 50,
        "depthChartRole": 50,
        "projectedSnapShare": 50,
        "confidence": 66,
        "riskAdjustment": 1
      },
      "confidence": "medium",
      "risk": "low",
      "reasons": [
        "Projection median contributes 50.0 component points.",
        "TE scarcity is elevated for this league.",
        "TE premium format lifts tight end value.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape."
      ],
      "dataGaps": [
        "coaching environment",
        "depth chart role",
        "injury risk",
        "projected snap share",
        "role stability",
        "team defense environment",
        "team offense environment"
      ],
      "source": {
        "adp": 30,
        "externalMarketRank": 10,
        "h10RecommendationRank": null,
        "projectionRunId": null,
        "projectionVersion": "h10_league_value",
        "fallbackProjection": false
      }
    },
    {
      "playerId": "rb",
      "playerName": "Need RB",
      "position": "RB",
      "team": "TST",
      "drafted": false,
      "blackbirdRank": 5,
      "blackbirdTier": 1,
      "leagueValueScore": 66.52,
      "projectedFantasyPoints": {
        "floor": 210,
        "median": 260,
        "ceiling": 310,
        "unit": "season",
        "source": "h10_league_projection",
        "scoringAware": true
      },
      "pointsAboveReplacement": 55,
      "valueComponents": {
        "projectionValue": 50,
        "floorCeilingShape": 85.76923076923077,
        "positionScarcity": 70,
        "rosterFormatFit": 77,
        "leagueFormatFit": 50,
        "ageCurve": 66,
        "dynastyValue": 65.3,
        "redraftValue": 50,
        "bestBallFit": 69.01923076923077,
        "superflexFit": 45,
        "idpFormatFit": 50,
        "situation": 50,
        "coachingEnvironment": 50,
        "depthChartRole": 50,
        "projectedSnapShare": 50,
        "confidence": 66,
        "riskAdjustment": 1
      },
      "confidence": "medium",
      "risk": "low",
      "reasons": [
        "Projection median contributes 50.0 component points.",
        "RB scarcity is elevated for this league.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape."
      ],
      "dataGaps": [
        "coaching environment",
        "depth chart role",
        "injury risk",
        "projected snap share",
        "role stability",
        "team defense environment",
        "team offense environment"
      ],
      "source": {
        "adp": 22,
        "externalMarketRank": 10,
        "h10RecommendationRank": null,
        "projectionRunId": null,
        "projectionVersion": "h10_league_value",
        "fallbackProjection": false
      }
    },
    {
      "playerId": "dl",
      "playerName": "Starter DL",
      "position": "DL",
      "team": "TST",
      "drafted": false,
      "blackbirdRank": 6,
      "blackbirdTier": 1,
      "leagueValueScore": 66.41,
      "projectedFantasyPoints": {
        "floor": 170,
        "median": 214,
        "ceiling": 255,
        "unit": "season",
        "source": "h10_league_projection",
        "scoringAware": true
      },
      "pointsAboveReplacement": 35,
      "valueComponents": {
        "projectionValue": 50,
        "floorCeilingShape": 85.39719626168224,
        "positionScarcity": 62,
        "rosterFormatFit": 65,
        "leagueFormatFit": 66,
        "ageCurve": 72,
        "dynastyValue": 67.1,
        "redraftValue": 50,
        "bestBallFit": 68.88901869158877,
        "superflexFit": 45,
        "idpFormatFit": 66,
        "situation": 50,
        "coachingEnvironment": 50,
        "depthChartRole": 50,
        "projectedSnapShare": 50,
        "confidence": 66,
        "riskAdjustment": 1
      },
      "confidence": "medium",
      "risk": "low",
      "reasons": [
        "Projection median contributes 50.0 component points.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape.",
        "IDP value is separated by defensive position and confidence."
      ],
      "dataGaps": [
        "coaching environment",
        "depth chart role",
        "injury risk",
        "projected snap share",
        "role stability",
        "team defense environment",
        "team offense environment"
      ],
      "source": {
        "adp": 120,
        "externalMarketRank": 10,
        "h10RecommendationRank": null,
        "projectionRunId": null,
        "projectionVersion": "idp_k_dst_v3_or_later",
        "fallbackProjection": false
      }
    },
    {
      "playerId": "db",
      "playerName": "Starter DB",
      "position": "DB",
      "team": "TST",
      "drafted": false,
      "blackbirdRank": 7,
      "blackbirdTier": 1,
      "leagueValueScore": 64.01,
      "projectedFantasyPoints": {
        "floor": 155,
        "median": 196,
        "ceiling": 235,
        "unit": "season",
        "source": "h10_league_projection",
        "scoringAware": true
      },
      "pointsAboveReplacement": 28,
      "valueComponents": {
        "projectionValue": 50,
        "floorCeilingShape": 85.71428571428572,
        "positionScarcity": 55,
        "rosterFormatFit": 65,
        "leagueFormatFit": 66,
        "ageCurve": 72,
        "dynastyValue": 67.1,
        "redraftValue": 50,
        "bestBallFit": 69,
        "superflexFit": 45,
        "idpFormatFit": 52,
        "situation": 50,
        "coachingEnvironment": 50,
        "depthChartRole": 50,
        "projectedSnapShare": 50,
        "confidence": 42,
        "riskAdjustment": 1
      },
      "confidence": "low",
      "risk": "low",
      "reasons": [
        "Projection median contributes 50.0 component points.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape.",
        "IDP value is separated by defensive position and confidence."
      ],
      "dataGaps": [
        "coaching environment",
        "depth chart role",
        "injury risk",
        "projected snap share",
        "role stability",
        "team defense environment",
        "team offense environment"
      ],
      "source": {
        "adp": 130,
        "externalMarketRank": 10,
        "h10RecommendationRank": null,
        "projectionRunId": null,
        "projectionVersion": "idp_k_dst_v3_or_later",
        "fallbackProjection": false
      }
    },
    {
      "playerId": "def",
      "playerName": "Defense",
      "position": "DEF",
      "team": "TST",
      "drafted": false,
      "blackbirdRank": 8,
      "blackbirdTier": 1,
      "leagueValueScore": 60.42,
      "projectedFantasyPoints": {
        "floor": 80,
        "median": 120,
        "ceiling": 150,
        "unit": "season",
        "source": "h10_league_projection",
        "scoringAware": true
      },
      "pointsAboveReplacement": 8,
      "valueComponents": {
        "projectionValue": 50,
        "floorCeilingShape": 85.41666666666666,
        "positionScarcity": 38,
        "rosterFormatFit": 57,
        "leagueFormatFit": 50,
        "ageCurve": 72,
        "dynastyValue": 67.1,
        "redraftValue": 50,
        "bestBallFit": 68.89583333333333,
        "superflexFit": 45,
        "idpFormatFit": 50,
        "situation": 50,
        "coachingEnvironment": 50,
        "depthChartRole": 50,
        "projectedSnapShare": 50,
        "confidence": 66,
        "riskAdjustment": 1
      },
      "confidence": "medium",
      "risk": "low",
      "reasons": [
        "Projection median contributes 50.0 component points.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape."
      ],
      "dataGaps": [
        "coaching environment",
        "depth chart role",
        "injury risk",
        "projected snap share",
        "role stability",
        "team defense environment",
        "team offense environment"
      ],
      "source": {
        "adp": 155,
        "externalMarketRank": 10,
        "h10RecommendationRank": null,
        "projectionRunId": null,
        "projectionVersion": "h10_league_value",
        "fallbackProjection": false
      }
    },
    {
      "playerId": "k",
      "playerName": "Kicker",
      "position": "K",
      "team": "TST",
      "drafted": false,
      "blackbirdRank": 9,
      "blackbirdTier": 1,
      "leagueValueScore": 59.9,
      "projectedFantasyPoints": {
        "floor": 90,
        "median": 115,
        "ceiling": 135,
        "unit": "season",
        "source": "h10_league_projection",
        "scoringAware": true
      },
      "pointsAboveReplacement": 6,
      "valueComponents": {
        "projectionValue": 50,
        "floorCeilingShape": 84.1304347826087,
        "positionScarcity": 35,
        "rosterFormatFit": 57,
        "leagueFormatFit": 50,
        "ageCurve": 72,
        "dynastyValue": 67.1,
        "redraftValue": 50,
        "bestBallFit": 68.44565217391305,
        "superflexFit": 45,
        "idpFormatFit": 50,
        "situation": 50,
        "coachingEnvironment": 50,
        "depthChartRole": 50,
        "projectedSnapShare": 50,
        "confidence": 66,
        "riskAdjustment": 1
      },
      "confidence": "medium",
      "risk": "low",
      "reasons": [
        "Projection median contributes 50.0 component points.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape."
      ],
      "dataGaps": [
        "coaching environment",
        "depth chart role",
        "injury risk",
        "projected snap share",
        "role stability",
        "team defense environment",
        "team offense environment"
      ],
      "source": {
        "adp": 160,
        "externalMarketRank": 10,
        "h10RecommendationRank": null,
        "projectionRunId": null,
        "projectionVersion": "h10_league_value",
        "fallbackProjection": false
      }
    }
  ],
  "checks": [
    {
      "name": "drafted_and_undrafted_included",
      "passed": true,
      "detail": "{\"totalPlayers\":9,\"draftedPlayersIncluded\":2,\"undraftedPlayersIncluded\":7,\"projectionUnits\":{\"season\":9,\"weekly\":0,\"game\":0,\"fallback\":0,\"unknown\":0},\"fallbackProjectionRows\":0,\"adpPrimarySignal\":false,\"orderingMethod\":\"contextual league value -> projection -> name; ADP external reference only\",\"bannedLanguageFound\":[]}"
    },
    {
      "name": "rank_static_after_picks",
      "passed": true,
      "detail": "rank map unchanged after simulated picks"
    },
    {
      "name": "adp_not_primary",
      "passed": true,
      "detail": "contextual league value -> projection -> name; ADP external reference only"
    },
    {
      "name": "projection_units_visible",
      "passed": true,
      "detail": "{\"season\":9,\"weekly\":0,\"game\":0,\"fallback\":0,\"unknown\":0}"
    },
    {
      "name": "no_banned_language",
      "passed": true,
      "detail": "none"
    }
  ]
}
```
