# h9-value-score-audit

```json
{
  "kind": "h9-value-score-audit",
  "dataMode": "synthetic_fixture",
  "draftRoomId": null,
  "activeProjectionRun": null,
  "generatedAt": "2026-06-16T19:38:10.127Z",
  "verdict": "pass",
  "checks": {
    "valueDistributionNotCompressed": true,
    "samePositionTiesExplainable": true,
    "missingProjectionsNotZero": true,
    "fallbackPlayersCaveated": true,
    "lowTrustSuggestionsCaveated": true,
    "suggestionScoresNormalized": true,
    "adpIsolationPasses": true,
    "boardDisplaySemanticsClear": true,
    "noPersistenceOrMutation": true
  },
  "adpIsolation": {
    "checks": {
      "staticBlackbirdRankDoesNotUseAdp": true,
      "leagueValueScoreDoesNotUseAdp": true,
      "parDoesNotUseAdp": true,
      "draftSuggestionDoesNotUseAdpPrimary": true,
      "oldDraftTargetScoreDoesNotLeakIntoVisibleBlackbirdValue": true,
      "marketRankInternalCompatibilityOnly": true,
      "noAdpRookieProjectionFallback": true
    },
    "adpRowsAudited": 13,
    "topAdpReferenceOnly": [
      {
        "playerName": "Backup QB",
        "adp": 2,
        "blackbirdRank": 12,
        "staticValue": 17.5
      },
      {
        "playerName": "Superflex QB",
        "adp": 8,
        "blackbirdRank": 1,
        "staticValue": 73.39
      },
      {
        "playerName": "Depth LB",
        "adp": 16,
        "blackbirdRank": 11,
        "staticValue": 22.55
      },
      {
        "playerName": "Ceiling WR",
        "adp": 18,
        "blackbirdRank": 5,
        "staticValue": 52.02
      },
      {
        "playerName": "Reserve RB",
        "adp": 20,
        "blackbirdRank": 13,
        "staticValue": 15.97
      },
      {
        "playerName": "Need RB",
        "adp": 22,
        "blackbirdRank": 3,
        "staticValue": 71.5
      },
      {
        "playerName": "Premium TE",
        "adp": 30,
        "blackbirdRank": 4,
        "staticValue": 52.11
      },
      {
        "playerName": "Starter LB",
        "adp": 110,
        "blackbirdRank": 2,
        "staticValue": 71.95
      },
      {
        "playerName": "Starter DL",
        "adp": 120,
        "blackbirdRank": 6,
        "staticValue": 51.78
      },
      {
        "playerName": "Starter DB",
        "adp": 130,
        "blackbirdRank": 10,
        "staticValue": 45.88
      }
    ]
  },
  "totals": {
    "rankedPlayers": 13,
    "draftSuggestions": 12,
    "boardRows": 13,
    "sameScoreCount": 0,
    "nearTieClusters": 0
  },
  "sameScoreAnalysis": {
    "samePositionTieGroupCount": 0,
    "explainableSamePositionTieGroups": [],
    "unexplainedSamePositionTieGroups": []
  },
  "valueScoreDistribution": {
    "min": 15.97,
    "median": 49.27,
    "max": 73.39,
    "p25": 45.88,
    "p75": 52.11
  },
  "clusteringByPosition": [
    {
      "label": "RB",
      "count": 3,
      "min": 15.97,
      "median": 47.24,
      "max": 71.5
    },
    {
      "label": "QB",
      "count": 2,
      "min": 17.5,
      "median": 73.39,
      "max": 73.39
    },
    {
      "label": "LB",
      "count": 2,
      "min": 22.55,
      "median": 71.95,
      "max": 71.95
    },
    {
      "label": "TE",
      "count": 1,
      "min": 52.11,
      "median": 52.11,
      "max": 52.11
    },
    {
      "label": "WR",
      "count": 1,
      "min": 52.02,
      "median": 52.02,
      "max": 52.02
    },
    {
      "label": "DL",
      "count": 1,
      "min": 51.78,
      "median": 51.78,
      "max": 51.78
    },
    {
      "label": "DEF",
      "count": 1,
      "min": 49.27,
      "median": 49.27,
      "max": 49.27
    },
    {
      "label": "K",
      "count": 1,
      "min": 48.43,
      "median": 48.43,
      "max": 48.43
    },
    {
      "label": "DB",
      "count": 1,
      "min": 45.88,
      "median": 45.88,
      "max": 45.88
    }
  ],
  "clusteringByTrust": [
    {
      "label": "low",
      "count": 9,
      "min": 47.24,
      "median": 52.02,
      "max": 73.39
    },
    {
      "label": "very_low",
      "count": 4,
      "min": 15.97,
      "median": 22.55,
      "max": 45.88
    }
  ],
  "clusteringByRole": [
    {
      "label": "probable_starter",
      "count": 8,
      "min": 45.88,
      "median": 52.11,
      "max": 73.39
    },
    {
      "label": "deep_reserve",
      "count": 2,
      "min": 15.97,
      "median": 17.5,
      "max": 17.5
    },
    {
      "label": "team_unit",
      "count": 1,
      "min": 49.27,
      "median": 49.27,
      "max": 49.27
    },
    {
      "label": "committee",
      "count": 1,
      "min": 47.24,
      "median": 47.24,
      "max": 47.24
    },
    {
      "label": "rotational",
      "count": 1,
      "min": 22.55,
      "median": 22.55,
      "max": 22.55
    }
  ],
  "clusteringByFallback": [
    {
      "label": "non_fallback",
      "count": 13,
      "min": 15.97,
      "median": 49.27,
      "max": 73.39
    }
  ],
  "blackbirdRankTop25": [
    {
      "blackbirdRank": 1,
      "playerId": "qb",
      "playerName": "Superflex QB",
      "position": "QB",
      "projection": 335,
      "par": 0,
      "staticValue": 73.39,
      "trust": "low",
      "role": "probable_starter",
      "fallback": false,
      "reasons": [
        "Projection median contributes 100.0 component points.",
        "QB scarcity is elevated for this league.",
        "Superflex/2QB format lifts quarterback value."
      ],
      "cautions": [
        "Projection trust is low."
      ]
    },
    {
      "blackbirdRank": 2,
      "playerId": "lb",
      "playerName": "Starter LB",
      "position": "LB",
      "projection": 259,
      "par": 0,
      "staticValue": 71.95,
      "trust": "low",
      "role": "probable_starter",
      "fallback": false,
      "reasons": [
        "Projection median contributes 100.0 component points.",
        "LB scarcity is elevated for this league.",
        "Dynasty age curve is included."
      ],
      "cautions": [
        "Projection trust is low."
      ]
    },
    {
      "blackbirdRank": 3,
      "playerId": "rb",
      "playerName": "Need RB",
      "position": "RB",
      "projection": 260,
      "par": 105,
      "staticValue": 71.5,
      "trust": "low",
      "role": "probable_starter",
      "fallback": false,
      "reasons": [
        "Projection median contributes 100.0 component points.",
        "RB scarcity is elevated for this league.",
        "Dynasty age curve is included."
      ],
      "cautions": [
        "Projection trust is low."
      ]
    },
    {
      "blackbirdRank": 4,
      "playerId": "te",
      "playerName": "Premium TE",
      "position": "TE",
      "projection": 220,
      "par": 0,
      "staticValue": 52.11,
      "trust": "low",
      "role": "probable_starter",
      "fallback": false,
      "reasons": [
        "Projection median contributes 50.0 component points.",
        "TE scarcity is elevated for this league.",
        "TE premium format lifts tight end value."
      ],
      "cautions": [
        "Projection trust is low."
      ]
    },
    {
      "blackbirdRank": 5,
      "playerId": "wr",
      "playerName": "Ceiling WR",
      "position": "WR",
      "projection": 245,
      "par": 0,
      "staticValue": 52.02,
      "trust": "low",
      "role": "probable_starter",
      "fallback": false,
      "reasons": [
        "Projection median contributes 50.0 component points.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape."
      ],
      "cautions": [
        "Projection trust is low."
      ]
    },
    {
      "blackbirdRank": 6,
      "playerId": "dl",
      "playerName": "Starter DL",
      "position": "DL",
      "projection": 214,
      "par": 0,
      "staticValue": 51.78,
      "trust": "low",
      "role": "probable_starter",
      "fallback": false,
      "reasons": [
        "Projection median contributes 50.0 component points.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape."
      ],
      "cautions": [
        "Projection trust is low."
      ]
    },
    {
      "blackbirdRank": 7,
      "playerId": "def",
      "playerName": "Defense",
      "position": "DEF",
      "projection": 120,
      "par": 0,
      "staticValue": 49.27,
      "trust": "low",
      "role": "team_unit",
      "fallback": false,
      "reasons": [
        "Projection median contributes 50.0 component points.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape."
      ],
      "cautions": [
        "Projection trust is low."
      ]
    },
    {
      "blackbirdRank": 8,
      "playerId": "k",
      "playerName": "Kicker",
      "position": "K",
      "projection": 115,
      "par": 0,
      "staticValue": 48.43,
      "trust": "low",
      "role": "probable_starter",
      "fallback": false,
      "reasons": [
        "Projection median contributes 50.0 component points.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape."
      ],
      "cautions": [
        "Projection trust is low."
      ]
    },
    {
      "blackbirdRank": 9,
      "playerId": "rb2",
      "playerName": "Depth RB",
      "position": "RB",
      "projection": 155,
      "par": 0,
      "staticValue": 47.24,
      "trust": "low",
      "role": "committee",
      "fallback": false,
      "reasons": [
        "Projection median contributes 43.2 component points.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape."
      ],
      "cautions": [
        "Projection trust is low."
      ]
    },
    {
      "blackbirdRank": 10,
      "playerId": "db",
      "playerName": "Starter DB",
      "position": "DB",
      "projection": 196,
      "par": 0,
      "staticValue": 45.88,
      "trust": "very_low",
      "role": "probable_starter",
      "fallback": false,
      "reasons": [
        "Projection median contributes 50.0 component points.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape."
      ],
      "cautions": [
        "Projection trust is very low."
      ]
    },
    {
      "blackbirdRank": 11,
      "playerId": "lb2",
      "playerName": "Depth LB",
      "position": "LB",
      "projection": 140,
      "par": -119,
      "staticValue": 22.55,
      "trust": "very_low",
      "role": "rotational",
      "fallback": false,
      "reasons": [
        "Projection median contributes 0.0 component points.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape."
      ],
      "cautions": [
        "Projection trust is very low."
      ]
    },
    {
      "blackbirdRank": 12,
      "playerId": "qb2",
      "playerName": "Backup QB",
      "position": "QB",
      "projection": 115,
      "par": -220,
      "staticValue": 17.5,
      "trust": "very_low",
      "role": "deep_reserve",
      "fallback": false,
      "reasons": [
        "Projection median contributes 0.0 component points.",
        "Superflex/2QB format lifts quarterback value.",
        "Dynasty age curve is included."
      ],
      "cautions": [
        "Projection trust is very low.",
        "Role is deep reserve by projection-volume proxy."
      ]
    },
    {
      "blackbirdRank": 13,
      "playerId": "rb3",
      "playerName": "Reserve RB",
      "position": "RB",
      "projection": 75,
      "par": -80,
      "staticValue": 15.97,
      "trust": "very_low",
      "role": "deep_reserve",
      "fallback": false,
      "reasons": [
        "Projection median contributes 0.0 component points.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape."
      ],
      "cautions": [
        "Projection trust is very low.",
        "Role is deep reserve by projection-volume proxy."
      ]
    }
  ],
  "blackbirdRankTop100": [
    {
      "blackbirdRank": 1,
      "playerId": "qb",
      "playerName": "Superflex QB",
      "position": "QB",
      "projection": 335,
      "par": 0,
      "staticValue": 73.39,
      "trust": "low",
      "role": "probable_starter",
      "fallback": false,
      "reasons": [
        "Projection median contributes 100.0 component points.",
        "QB scarcity is elevated for this league.",
        "Superflex/2QB format lifts quarterback value."
      ],
      "cautions": [
        "Projection trust is low."
      ]
    },
    {
      "blackbirdRank": 2,
      "playerId": "lb",
      "playerName": "Starter LB",
      "position": "LB",
      "projection": 259,
      "par": 0,
      "staticValue": 71.95,
      "trust": "low",
      "role": "probable_starter",
      "fallback": false,
      "reasons": [
        "Projection median contributes 100.0 component points.",
        "LB scarcity is elevated for this league.",
        "Dynasty age curve is included."
      ],
      "cautions": [
        "Projection trust is low."
      ]
    },
    {
      "blackbirdRank": 3,
      "playerId": "rb",
      "playerName": "Need RB",
      "position": "RB",
      "projection": 260,
      "par": 105,
      "staticValue": 71.5,
      "trust": "low",
      "role": "probable_starter",
      "fallback": false,
      "reasons": [
        "Projection median contributes 100.0 component points.",
        "RB scarcity is elevated for this league.",
        "Dynasty age curve is included."
      ],
      "cautions": [
        "Projection trust is low."
      ]
    },
    {
      "blackbirdRank": 4,
      "playerId": "te",
      "playerName": "Premium TE",
      "position": "TE",
      "projection": 220,
      "par": 0,
      "staticValue": 52.11,
      "trust": "low",
      "role": "probable_starter",
      "fallback": false,
      "reasons": [
        "Projection median contributes 50.0 component points.",
        "TE scarcity is elevated for this league.",
        "TE premium format lifts tight end value."
      ],
      "cautions": [
        "Projection trust is low."
      ]
    },
    {
      "blackbirdRank": 5,
      "playerId": "wr",
      "playerName": "Ceiling WR",
      "position": "WR",
      "projection": 245,
      "par": 0,
      "staticValue": 52.02,
      "trust": "low",
      "role": "probable_starter",
      "fallback": false,
      "reasons": [
        "Projection median contributes 50.0 component points.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape."
      ],
      "cautions": [
        "Projection trust is low."
      ]
    },
    {
      "blackbirdRank": 6,
      "playerId": "dl",
      "playerName": "Starter DL",
      "position": "DL",
      "projection": 214,
      "par": 0,
      "staticValue": 51.78,
      "trust": "low",
      "role": "probable_starter",
      "fallback": false,
      "reasons": [
        "Projection median contributes 50.0 component points.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape."
      ],
      "cautions": [
        "Projection trust is low."
      ]
    },
    {
      "blackbirdRank": 7,
      "playerId": "def",
      "playerName": "Defense",
      "position": "DEF",
      "projection": 120,
      "par": 0,
      "staticValue": 49.27,
      "trust": "low",
      "role": "team_unit",
      "fallback": false,
      "reasons": [
        "Projection median contributes 50.0 component points.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape."
      ],
      "cautions": [
        "Projection trust is low."
      ]
    },
    {
      "blackbirdRank": 8,
      "playerId": "k",
      "playerName": "Kicker",
      "position": "K",
      "projection": 115,
      "par": 0,
      "staticValue": 48.43,
      "trust": "low",
      "role": "probable_starter",
      "fallback": false,
      "reasons": [
        "Projection median contributes 50.0 component points.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape."
      ],
      "cautions": [
        "Projection trust is low."
      ]
    },
    {
      "blackbirdRank": 9,
      "playerId": "rb2",
      "playerName": "Depth RB",
      "position": "RB",
      "projection": 155,
      "par": 0,
      "staticValue": 47.24,
      "trust": "low",
      "role": "committee",
      "fallback": false,
      "reasons": [
        "Projection median contributes 43.2 component points.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape."
      ],
      "cautions": [
        "Projection trust is low."
      ]
    },
    {
      "blackbirdRank": 10,
      "playerId": "db",
      "playerName": "Starter DB",
      "position": "DB",
      "projection": 196,
      "par": 0,
      "staticValue": 45.88,
      "trust": "very_low",
      "role": "probable_starter",
      "fallback": false,
      "reasons": [
        "Projection median contributes 50.0 component points.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape."
      ],
      "cautions": [
        "Projection trust is very low."
      ]
    },
    {
      "blackbirdRank": 11,
      "playerId": "lb2",
      "playerName": "Depth LB",
      "position": "LB",
      "projection": 140,
      "par": -119,
      "staticValue": 22.55,
      "trust": "very_low",
      "role": "rotational",
      "fallback": false,
      "reasons": [
        "Projection median contributes 0.0 component points.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape."
      ],
      "cautions": [
        "Projection trust is very low."
      ]
    },
    {
      "blackbirdRank": 12,
      "playerId": "qb2",
      "playerName": "Backup QB",
      "position": "QB",
      "projection": 115,
      "par": -220,
      "staticValue": 17.5,
      "trust": "very_low",
      "role": "deep_reserve",
      "fallback": false,
      "reasons": [
        "Projection median contributes 0.0 component points.",
        "Superflex/2QB format lifts quarterback value.",
        "Dynasty age curve is included."
      ],
      "cautions": [
        "Projection trust is very low.",
        "Role is deep reserve by projection-volume proxy."
      ]
    },
    {
      "blackbirdRank": 13,
      "playerId": "rb3",
      "playerName": "Reserve RB",
      "position": "RB",
      "projection": 75,
      "par": -80,
      "staticValue": 15.97,
      "trust": "very_low",
      "role": "deep_reserve",
      "fallback": false,
      "reasons": [
        "Projection median contributes 0.0 component points.",
        "Dynasty age curve is included.",
        "Best ball format gives additional weight to ceiling shape."
      ],
      "cautions": [
        "Projection trust is very low.",
        "Role is deep reserve by projection-volume proxy."
      ]
    }
  ],
  "draftSuggestionTop25": [
    {
      "playerId": "rb",
      "playerName": "Need RB",
      "position": "RB",
      "team": "TST",
      "draftSuggestionRank": 1,
      "suggestionScore": 84.9,
      "blackbirdRank": 3,
      "leagueValueScore": 71.5,
      "projectionTrustLabel": "low",
      "projectionTrustScore": 30,
      "projectionSource": "h10_league_projection",
      "projectionUnit": "season",
      "role": "probable_starter",
      "roleConfidence": "low",
      "pointsAboveReplacement": 105,
      "replacementMedianPoints": 155,
      "suggestionType": "need",
      "timingAction": "fill need if value holds",
      "planFit": null,
      "reasons": [
        "Static Blackbird Rank #3; live score adjusts for roster and timing context.",
        "RB need level is high.",
        "Role-aware PAR is 105.0 points above replacement.",
        "Role proxy is probable starter with low confidence."
      ],
      "cautions": [
        "Projection trust is low.",
        "Projection caveat: missing projected components."
      ],
      "dataGaps": [
        "coaching environment",
        "confirmed depth chart",
        "confirmed depth chart for backup deweighting",
        "confirmed snap share",
        "depth chart role",
        "injury risk",
        "projected snap share",
        "role stability",
        "team defense environment",
        "team offense environment"
      ]
    },
    {
      "playerId": "lb",
      "playerName": "Starter LB",
      "position": "LB",
      "team": "TST",
      "draftSuggestionRank": 2,
      "suggestionScore": 75.15,
      "blackbirdRank": 2,
      "leagueValueScore": 71.95,
      "projectionTrustLabel": "low",
      "projectionTrustScore": 30,
      "projectionSource": "h10_league_projection",
      "projectionUnit": "season",
      "role": "probable_starter",
      "roleConfidence": "low",
      "pointsAboveReplacement": 0,
      "replacementMedianPoints": 259,
      "suggestionType": "depth",
      "timingAction": "value available",
      "planFit": null,
      "reasons": [
        "Static Blackbird Rank #2; live score adjusts for roster and timing context.",
        "LB need level is moderate.",
        "Role-aware PAR is 0.0 points above replacement.",
        "Role proxy is probable starter with low confidence."
      ],
      "cautions": [
        "Projection trust is low.",
        "Projection caveat: missing projected components."
      ],
      "dataGaps": [
        "coaching environment",
        "confirmed depth chart",
        "confirmed depth chart for backup deweighting",
        "confirmed snap share",
        "depth chart role",
        "injury risk",
        "projected snap share",
        "role stability",
        "team defense environment",
        "team offense environment"
      ]
    },
    {
      "playerId": "rb2",
      "playerName": "Depth RB",
      "position": "RB",
      "team": "TST",
      "draftSuggestionRank": 3,
      "suggestionScore": 50.71,
      "blackbirdRank": 9,
      "leagueValueScore": 47.24,
      "projectionTrustLabel": "low",
      "projectionTrustScore": 30,
      "projectionSource": "h10_league_projection",
      "projectionUnit": "season",
      "role": "committee",
      "roleConfidence": "low",
      "pointsAboveReplacement": 0,
      "replacementMedianPoints": 155,
      "suggestionType": "need",
      "timingAction": "fill need if value holds",
      "planFit": null,
      "reasons": [
        "Static Blackbird Rank #9; live score adjusts for roster and timing context.",
        "RB need level is high.",
        "Role-aware PAR is 0.0 points above replacement.",
        "Role proxy is committee with low confidence."
      ],
      "cautions": [
        "Projection trust is low.",
        "Projection caveat: missing projected components."
      ],
      "dataGaps": [
        "coaching environment",
        "confirmed depth chart",
        "confirmed depth chart for backup deweighting",
        "confirmed snap share",
        "depth chart role",
        "injury risk",
        "projected snap share",
        "role stability",
        "team defense environment",
        "team offense environment"
      ]
    },
    {
      "playerId": "te",
      "playerName": "Premium TE",
      "position": "TE",
      "team": "TST",
      "draftSuggestionRank": 4,
      "suggestionScore": 49.34,
      "blackbirdRank": 4,
      "leagueValueScore": 52.11,
      "projectionTrustLabel": "low",
      "projectionTrustScore": 30,
      "projectionSource": "h10_league_projection",
      "projectionUnit": "season",
      "role": "probable_starter",
      "roleConfidence": "low",
      "pointsAboveReplacement": 0,
      "replacementMedianPoints": 220,
      "suggestionType": "value",
      "timingAction": "value available",
      "planFit": null,
      "reasons": [
        "Static Blackbird Rank #4; live score adjusts for roster and timing context.",
        "Role-aware PAR is 0.0 points above replacement.",
        "Role proxy is probable starter with low confidence."
      ],
      "cautions": [
        "Projection trust is low.",
        "Projection caveat: missing projected components."
      ],
      "dataGaps": [
        "coaching environment",
        "confirmed depth chart",
        "confirmed snap share",
        "depth chart role",
        "injury risk",
        "projected snap share",
        "role stability",
        "team defense environment",
        "team offense environment"
      ]
    },
    {
      "playerId": "wr",
      "playerName": "Ceiling WR",
      "position": "WR",
      "team": "TST",
      "draftSuggestionRank": 5,
      "suggestionScore": 47.97,
      "blackbirdRank": 5,
      "leagueValueScore": 52.02,
      "projectionTrustLabel": "low",
      "projectionTrustScore": 30,
      "projectionSource": "h10_league_projection",
      "projectionUnit": "season",
      "role": "probable_starter",
      "roleConfidence": "low",
      "pointsAboveReplacement": 0,
      "replacementMedianPoints": 245,
      "suggestionType": "value",
      "timingAction": "value available",
      "planFit": null,
      "reasons": [
        "Static Blackbird Rank #5; live score adjusts for roster and timing context.",
        "Role-aware PAR is 0.0 points above replacement.",
        "Role proxy is probable starter with low confidence."
      ],
      "cautions": [
        "Projection trust is low.",
        "Projection caveat: missing projected components."
      ],
      "dataGaps": [
        "coaching environment",
        "confirmed depth chart",
        "confirmed snap share",
        "depth chart role",
        "injury risk",
        "projected snap share",
        "role stability",
        "team defense environment",
        "team offense environment"
      ]
    },
    {
      "playerId": "dl",
      "playerName": "Starter DL",
      "position": "DL",
      "team": "TST",
      "draftSuggestionRank": 6,
      "suggestionScore": 46.55,
      "blackbirdRank": 6,
      "leagueValueScore": 51.78,
      "projectionTrustLabel": "low",
      "projectionTrustScore": 30,
      "projectionSource": "h10_league_projection",
      "projectionUnit": "season",
      "role": "probable_starter",
      "roleConfidence": "low",
      "pointsAboveReplacement": 0,
      "replacementMedianPoints": 214,
      "suggestionType": "value",
      "timingAction": "value available",
      "planFit": null,
      "reasons": [
        "Static Blackbird Rank #6; live score adjusts for roster and timing context.",
        "Role-aware PAR is 0.0 points above replacement.",
        "Role proxy is probable starter with low confidence."
      ],
      "cautions": [
        "Projection trust is low.",
        "Projection caveat: missing projected components."
      ],
      "dataGaps": [
        "coaching environment",
        "confirmed depth chart",
        "confirmed snap share",
        "depth chart role",
        "injury risk",
        "projected snap share",
        "role stability",
        "team defense environment",
        "team offense environment"
      ]
    },
    {
      "playerId": "def",
      "playerName": "Defense",
      "position": "DEF",
      "team": "TST",
      "draftSuggestionRank": 7,
      "suggestionScore": 37.3,
      "blackbirdRank": 7,
      "leagueValueScore": 49.27,
      "projectionTrustLabel": "low",
      "projectionTrustScore": 30,
      "projectionSource": "h10_league_projection",
      "projectionUnit": "season",
      "role": "team_unit",
      "roleConfidence": "medium",
      "pointsAboveReplacement": 0,
      "replacementMedianPoints": 120,
      "suggestionType": "avoid_forcing",
      "timingAction": "avoid forcing",
      "planFit": null,
      "reasons": [
        "Static Blackbird Rank #7; live score adjusts for roster and timing context.",
        "Role-aware PAR is 0.0 points above replacement.",
        "Role proxy is team unit with medium confidence."
      ],
      "cautions": [
        "DEF has avoid-forcing context at this stage.",
        "Projection trust is low.",
        "Projection caveat: missing projected components."
      ],
      "dataGaps": [
        "coaching environment",
        "depth chart role",
        "individual role not applicable to team defense",
        "injury risk",
        "projected snap share",
        "role stability",
        "team defense environment",
        "team offense environment"
      ]
    },
    {
      "playerId": "db",
      "playerName": "Starter DB",
      "position": "DB",
      "team": "TST",
      "draftSuggestionRank": 8,
      "suggestionScore": 34.1,
      "blackbirdRank": 10,
      "leagueValueScore": 45.88,
      "projectionTrustLabel": "very_low",
      "projectionTrustScore": 20,
      "projectionSource": "h10_league_projection",
      "projectionUnit": "season",
      "role": "probable_starter",
      "roleConfidence": "low",
      "pointsAboveReplacement": 0,
      "replacementMedianPoints": 196,
      "suggestionType": "value",
      "timingAction": "value available",
      "planFit": null,
      "reasons": [
        "Static Blackbird Rank #10; live score adjusts for roster and timing context.",
        "Role-aware PAR is 0.0 points above replacement.",
        "Role proxy is probable starter with low confidence."
      ],
      "cautions": [
        "Context confidence is low.",
        "Projection trust is very low.",
        "Projection caveat: missing projected components."
      ],
      "dataGaps": [
        "coaching environment",
        "confirmed depth chart",
        "confirmed depth chart for backup deweighting",
        "confirmed snap share",
        "depth chart role",
        "injury risk",
        "projected snap share",
        "role stability",
        "team defense environment",
        "team offense environment"
      ]
    },
    {
      "playerId": "k",
      "playerName": "Kicker",
      "position": "K",
      "team": "TST",
      "draftSuggestionRank": 9,
      "suggestionScore": 32.68,
      "bl
```
