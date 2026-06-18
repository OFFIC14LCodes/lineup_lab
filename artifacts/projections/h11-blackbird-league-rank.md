# h11-blackbird-league-rank

```json
{
  "generatedAt": "2026-06-16T19:38:28.585Z",
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
    "roleClassifiedRows": 9,
    "replacementBaselinePositions": 9,
    "playersWithRoleAwarePAR": 9,
    "adpPrimarySignal": false,
    "orderingMethod": "contextual league value + role-aware PAR -> projection -> name; ADP external reference only",
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
      "leagueValueScore": 53.59,
      "projectedFantasyPoints": {
        "floor": 280,
        "median": 335,
        "ceiling": 380,
        "unit": "season",
        "source": "h10_league_projection",
        "scoringAware": true
      },
      "projectionTrust": {
        "playerId": "qb",
        "playerName": "Superflex QB",
        "position": "QB",
        "team": "TST",
        "projectionRunId": null,
        "projectionVersion": "h10_league_value",
        "projectionUnit": "season",
        "projectionSource": "legacy_projection",
        "hasStatBackedProjection": false,
        "hasScoredFantasyProjection": true,
        "hasProjectedComponents": false,
        "trustScore": 30,
        "trustLabel": "low",
        "fallbackReason": "missing_projected_components",
        "reasons": [
          "Projected stat components are missing.",
          "Legacy projection source is labeled separately from comprehensive projection output.",
          "Fallback/root-cause reason: missing_projected_components.",
          "Source confidence: medium."
        ],
        "dataGaps": [
          "coaching environment",
          "depth chart role",
          "injury risk",
          "projected snap share",
          "role stability",
          "team defense environment",
          "team offense environment"
        ]
      },
      "roleClassification": {
        "playerId": "qb",
        "playerName": "Superflex QB",
        "position": "QB",
        "team": "TST",
        "role": "probable_starter",
        "confidence": "low",
        "basis": [
          "projection_volume_proxy"
        ],
        "teamPositionRankProxy": null,
        "sameTeamPositionPeerCount": 1,
        "projectedVolumeScore": 100,
        "reasons": [
          "Role is inferred from QB season projection volume, not confirmed depth chart data."
        ],
        "dataGaps": [
          "confirmed depth chart",
          "confirmed snap share"
        ]
      },
      "replacementValue": {
        "playerId": "qb",
        "position": "QB",
        "medianPoints": 335,
        "replacementMedianPoints": 335,
        "pointsAboveReplacement": 0,
        "parPercentileByPosition": 50,
        "replacementRank": 21,
        "replacementMethod": "league_roster_slots",
        "role": "probable_starter",
        "roleConfidence": "low",
        "reasons": [
          "QB replacement baseline is rank 21 by league roster demand.",
          "PAR is season projection minus replacement median (335.0)."
        ],
        "dataGaps": [
          "confirmed depth chart",
          "confirmed snap share"
        ]
      },
      "pointsAboveReplacement": 0,
      "valueComponents": {
        "projectionValue": 50,
        "floorCeilingShape": 83.28358208955224,
        "positionScarcity": 50,
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
        "depthChartRole": 76,
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
        "Best ball format gives additional weight to ceiling shape.",
        "Role is inferred from QB season projection volume, not confirmed depth chart data.",
        "QB replacement baseline is rank 21 by league roster demand.",
        "PAR is season projection minus replacement median (335.0)."
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
      "leagueValueScore": 52.15,
      "projectedFantasyPoints": {
        "floor": 205,
        "median": 259,
        "ceiling": 300,
        "unit": "season",
        "source": "h10_league_projection",
        "scoringAware": true
      },
      "projectionTrust": {
        "playerId": "lb",
        "playerName": "Starter LB",
        "position": "LB",
        "team": "TST",
        "projectionRunId": null,
        "projectionVersion": "idp_k_dst_v3_or_later",
        "projectionUnit": "season",
        "projectionSource": "legacy_projection",
        "hasStatBackedProjection": false,
        "hasScoredFantasyProjection": true,
        "hasProjectedComponents": false,
        "trustScore": 30,
        "trustLabel": "low",
        "fallbackReason": "missing_projected_components",
        "reasons": [
          "Projected stat components are missing.",
          "Legacy projection source is labeled separately from comprehensive projection output.",
          "Fallback/root-cause reason: missing_projected_components.",
          "Source confidence: medium."
        ],
        "dataGaps": [
          "coaching environment",
          "depth chart role",
          "injury risk",
          "projected snap share",
          "role stability",
          "team defense environment",
          "team offense environment"
        ]
      },
      "roleClassification": {
        "playerId": "lb",
        "playerName": "Starter LB",
        "position": "LB",
        "team": "TST",
        "role": "probable_starter",
        "confidence": "low",
        "basis": [
          "projection_volume_proxy"
        ],
        "teamPositionRankProxy": null,
        "sameTeamPositionPeerCount": 1,
        "projectedVolumeScore": 100,
        "reasons": [
          "Role is inferred from LB season projection volume, not confirmed depth chart data."
        ],
        "dataGaps": [
          "confirmed depth chart",
          "confirmed snap share"
        ]
      },
      "replacementValue": {
        "playerId": "lb",
        "position": "LB",
        "medianPoints": 259,
        "replacementMedianPoints": 259,
        "pointsAboveReplacement": 0,
        "parPercentileByPosition": 50,
        "replacementRank": 12,
        "replacementMethod": "league_roster_slots",
        "role": "probable_starter",
        "roleConfidence": "low",
        "reasons": [
          "LB replacement baseline is rank 12 by league roster demand.",
          "PAR is season projection minus replacement median (259.0)."
        ],
        "dataGaps": [
          "confirmed depth chart",
          "confirmed snap share"
        ]
      },
      "pointsAboveReplacement": 0,
      "valueComponents": {
        "projectionValue": 50,
        "floorCeilingShape": 83.4942084942085,
        "positionScarcity": 50,
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
        "depthChartRole": 76,
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
        "IDP value is separated by defensive position and confidence.",
        "Role is inferred from LB season projection volume, not confirmed depth chart data.",
        "LB replacement baseline is rank 12 by league roster demand.",
        "PAR is season projection minus replacement median (259.0)."
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
      "playerId": "te",
      "playerName": "Premium TE",
      "position": "TE",
      "team": "TST",
      "drafted": false,
      "blackbirdRank": 3,
      "blackbirdTier": 1,
      "leagueValueScore": 52.11,
      "projectedFantasyPoints": {
        "floor": 180,
        "median": 220,
        "ceiling": 275,
        "unit": "season",
        "source": "h10_league_projection",
        "scoringAware": true
      },
      "projectionTrust": {
        "playerId": "te",
        "playerName": "Premium TE",
        "position": "TE",
        "team": "TST",
        "projectionRunId": null,
        "projectionVersion": "h10_league_value",
        "projectionUnit": "season",
        "projectionSource": "legacy_projection",
        "hasStatBackedProjection": false,
        "hasScoredFantasyProjection": true,
        "hasProjectedComponents": false,
        "trustScore": 30,
        "trustLabel": "low",
        "fallbackReason": "missing_projected_components",
        "reasons": [
          "Projected stat components are missing.",
          "Legacy projection source is labeled separately from comprehensive projection output.",
          "Fallback/root-cause reason: missing_projected_components.",
          "Source confidence: medium."
        ],
        "dataGaps": [
          "coaching environment",
          "depth chart role",
          "injury risk",
          "projected snap share",
          "role stability",
          "team defense environment",
          "team offense environment"
        ]
      },
      "roleClassification": {
        "playerId": "te",
        "playerName": "Premium TE",
        "position": "TE",
        "team": "TST",
        "role": "probable_starter",
        "confidence": "low",
        "basis": [
          "projection_volume_proxy"
        ],
        "teamPositionRankProxy": null,
        "sameTeamPositionPeerCount": 1,
        "projectedVolumeScore": 100,
        "reasons": [
          "Role is inferred from TE season projection volume, not confirmed depth chart data."
        ],
        "dataGaps": [
          "confirmed depth chart",
          "confirmed snap share"
        ]
      },
      "replacementValue": {
        "playerId": "te",
        "position": "TE",
        "medianPoints": 220,
        "replacementMedianPoints": 220,
        "pointsAboveReplacement": 0,
        "parPercentileByPosition": 50,
        "replacementRank": 15,
        "replacementMethod": "league_roster_slots",
        "role": "probable_starter",
        "roleConfidence": "low",
        "reasons": [
          "TE replacement baseline is rank 15 by league roster demand.",
          "PAR is season projection minus replacement median (220.0)."
        ],
        "dataGaps": [
          "confirmed depth chart",
          "confirmed snap share"
        ]
      },
      "pointsAboveReplacement": 0,
      "valueComponents": {
        "projectionValue": 50,
        "floorCeilingShape": 89.20454545454545,
        "positionScarcity": 50,
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
        "depthChartRole": 76,
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
        "Best ball format gives additional weight to ceiling shape.",
        "Role is inferred from TE season projection volume, not confirmed depth chart data.",
        "TE replacement baseline is rank 15 by league roster demand.",
        "PAR is season projection minus replacement median (220.0)."
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
      "playerId": "wr",
      "playerName": "Ceiling WR",
      "position": "WR",
      "team": "TST",
      "drafted": false,
      "blackbirdRank": 4,
      "blackbirdTier": 1,
      "leagueValueScore": 52.02,
      "projectedFantasyPoints": {
        "floor": 175,
        "median": 245,
        "ceiling": 335,
        "unit": "season",
        "source": "h10_league_projection",
        "scoringAware": true
      },
      "projectionTrust": {
        "playerId": "wr",
        "playerName": "Ceiling WR",
        "position": "WR",
        "team": "TST",
        "projectionRunId": null,
        "projectionVersion": "h10_league_value",
        "projectionUnit": "season",
        "projectionSource": "legacy_projection",
        "hasStatBackedProjection": false,
        "hasScoredFantasyProjection": true,
        "hasProjectedComponents": false,
        "trustScore": 30,
        "trustLabel": "low",
        "fallbackReason": "missing_projected_components",
        "reasons": [
          "Projected stat components are missing.",
          "Legacy projection source is labeled separately from comprehensive projection output.",
          "Fallback/root-cause reason: missing_projected_components.",
          "Source confidence: medium."
        ],
        "dataGaps": [
          "coaching environment",
          "depth chart role",
          "injury risk",
          "projected snap share",
          "role stability",
          "team defense environment",
          "team offense environment"
        ]
      },
      "roleClassification": {
        "playerId": "wr",
        "playerName": "Ceiling WR",
        "position": "WR",
        "team": "TST",
        "role": "probable_starter",
        "confidence": "low",
        "basis": [
          "projection_volume_proxy"
        ],
        "teamPositionRankProxy": null,
        "sameTeamPositionPeerCount": 1,
        "projectedVolumeScore": 100,
        "reasons": [
          "Role is inferred from WR season projection volume, not confirmed depth chart data."
        ],
        "dataGaps": [
          "confirmed depth chart",
          "confirmed snap share"
        ]
      },
      "replacementValue": {
        "playerId": "wr",
        "position": "WR",
        "medianPoints": 245,
        "replacementMedianPoints": 245,
        "pointsAboveReplacement": 0,
        "parPercentileByPosition": 50,
        "replacementRank": 31,
        "replacementMethod": "league_roster_slots",
        "role": "probable_starter",
        "roleConfidence": "low",
        "reasons": [
          "WR replacement baseline is rank 31 by league roster demand.",
          "PAR is season projection minus replacement median (245.0)."
        ],
        "dataGaps": [
          "confirmed depth chart",
          "confirmed snap share"
        ]
      },
      "pointsAboveReplacement": 0,
      "valueComponents": {
        "projectionValue": 50,
        "floorCeilingShape": 93.06122448979592,
        "positionScarcity": 50,
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
        "depthChartRole": 76,
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
        "Role is inferred from WR season projection volume, not confirmed depth chart data.",
        "WR replacement baseline is rank 31 by league roster demand.",
        "PAR is season projection minus replacement median (245.0)."
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
      "playerId": "dl",
      "playerName": "Starter DL",
      "position": "DL",
      "team": "TST",
      "drafted": false,
      "blackbirdRank": 5,
      "blackbirdTier": 1,
      "leagueValueScore": 51.78,
      "projectedFantasyPoints": {
        "floor": 170,
        "median": 214,
        "ceiling": 255,
        "unit": "season",
        "source": "h10_league_projection",
        "scoringAware": true
      },
      "projectionTrust": {
        "playerId": "dl",
        "playerName": "Starter DL",
        "position": "DL",
        "team": "TST",
        "projectionRunId": null,
        "projectionVersion": "idp_k_dst_v3_or_later",
        "projectionUnit": "season",
        "projectionSource": "legacy_projection",
        "hasStatBackedProjection": false,
        "hasScoredFantasyProjection": true,
        "hasProjectedComponents": false,
        "trustScore": 30,
        "trustLabel": "low",
        "fallbackReason": "missing_projected_components",
        "reasons": [
          "Projected stat components are missing.",
          "Legacy projection source is labeled separately from comprehensive projection output.",
          "Fallback/root-cause reason: missing_projected_components.",
          "Source confidence: medium."
        ],
        "dataGaps": [
          "coaching environment",
          "depth chart role",
          "injury risk",
          "projected snap share",
          "role stability",
          "team defense environment",
          "team offense environment"
        ]
      },
      "roleClassification": {
        "playerId": "dl",
        "playerName": "Starter DL",
        "position": "DL",
        "team": "TST",
        "role": "probable_starter",
        "confidence": "low",
        "basis": [
          "projection_volume_proxy"
        ],
        "teamPositionRankProxy": null,
        "sameTeamPositionPeerCount": 1,
        "projectedVolumeScore": 100,
        "reasons": [
          "Role is inferred from DL season projection volume, not confirmed depth chart data."
        ],
        "dataGaps": [
          "confirmed depth chart",
          "confirmed snap share"
        ]
      },
      "replacementValue": {
        "playerId": "dl",
        "position": "DL",
        "medianPoints": 214,
        "replacementMedianPoints": 214,
        "pointsAboveReplacement": 0,
        "parPercentileByPosition": 50,
        "replacementRank": 12,
        "replacementMethod": "league_roster_slots",
        "role": "probable_starter",
        "roleConfidence": "low",
        "reasons": [
          "DL replacement baseline is rank 12 by league roster demand.",
          "PAR is season projection minus replacement median (214.0)."
        ],
        "dataGaps": [
          "confirmed depth chart",
          "confirmed snap share"
        ]
      },
      "pointsAboveReplacement": 0,
      "valueComponents": {
        "projectionValue": 50,
        "floorCeilingShape": 85.39719626168224,
        "positionScarcity": 50,
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
        "depthChartRole": 76,
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
        "IDP value is separated by defensive position and confidence.",
        "Role is inferred from DL season projection volume, not confirmed depth chart data.",
        "DL replacement baseline is rank 12 by league roster demand.",
        "PAR is season projection minus replacement median (214.0)."
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
      "playerId": "rb",
      "playerName": "Need RB",
      "position": "RB",
      "team": "TST",
      "drafted": false,
      "blackbirdRank": 6,
      "blackbirdTier": 1,
      "leagueValueScore": 51.7,
      "projectedFantasyPoints": {
        "floor": 210,
        "median": 260,
        "ceiling": 310,
        "unit": "season",
        "source": "h10_league_projection",
        "scoringAware": true
      },
      "projectionTrust": {
        "playerId": "rb",
        "playerName": "Need RB",
        "position": "RB",
        "team": "TST",
        "projectionRunId": null,
        "projectionVersion": "h10_league_value",
        "projectionUnit": "season",
        "projectionSource": "legacy_projection",
        "hasStatBackedProjection": false,
        "hasScoredFantasyProjection": true,
        "hasProjectedComponents": false,
        "trustScore": 30,
        "trustLabel": "low",
        "fallbackReason": "missing_projected_components",
        "reasons": [
          "Projected stat components are missing.",
          "Legacy projection source is labeled separately from comprehensive projection output.",
          "Fallback/root-cause reason: missing_projected_components.",
          "Source confidence: medium."
        ],
        "dataGaps": [
          "coaching environment",
          "depth chart role",
          "injury risk",
          "projected snap share",
          "role stability",
          "team defense environment",
          "team offense environment"
        ]
      },
      "roleClassification": {
        "playerId": "rb",
        "playerName": "Need RB",
        "position": "RB",
        "team": "TST",
        "role": "probable_starter",
        "confidence": "low",
        "basis": [
          "projection_volume_proxy"
        ],
        "teamPositionRankProxy": null,
        "sameTeamPositionPeerCount": 1,
        "projectedVolumeScore": 100,
        "reasons": [
          "Role is inferred from RB season projection volume, not confirmed depth chart data."
        ],
        "dataGaps": [
          "confirmed depth chart",
          "confirmed snap share"
        ]
      },
      "replacementValue": {
        "playerId": "rb",
        "position": "RB",
        "medianPoints": 260,
        "replacementMedianPoints": 260,
        "pointsAboveReplacement": 0,
        "parPercentileByPosition": 50,
        "replacementRank": 30,
        "replacementMethod": "league_roster_slots",
        "role": "probable_starter",
        "roleConfidence": "low",
        "reasons": [
          "RB replacement baseline is rank 30 by league roster demand.",
          "PAR is season projection minus replacement median (260.0)."
        ],
        "dataGaps": [
          "confirmed depth chart",
          "confirmed snap share"
        ]
      },
      "pointsAboveReplacement": 0,
      "valueComponents": {
        "projectionValue": 50,
        "floorCeilingShape": 85.76923076923077,
        "positionScarcity": 50,
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
        "depthChartRole": 76,
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
        "Best ball format gives additional weight to ceiling shape.",
        "Role is inferred from RB season projection volume, not confirmed depth chart data.",
        "RB replacement baseline is rank 30 by league roster demand.",
        "PAR is season projection minus replacement median (260.0)."
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
      "playerId": "def",
      "playerName": "Defense",
      "position": "DEF",
      "team": "TST",
      "drafted": false,
      "blackbirdRank": 7,
      "blackbirdTier": 1,
      "leagueValueScore": 49.27,
      "projectedFantasyPoints": {
        "floor": 80,
        "median": 120,
        "ceiling": 150,
        "unit": "season",
        "source": "h10_league_projection",
        "scoringAware": true
      },
      "projectionTrust": {
        "playerId": "def",
        "playerName": "Defense",
        "position": "DEF",
        "team": "TST",
        "projectionRunId": null,
        "projectionVersion": "h10_league_value",
        "projectionUnit": "season",
        "projectionSource": "legacy_projection",
        "hasStatBackedProjection": false,
        "hasScoredFantasyProjection": true,
        "hasProjectedComponents": false,
        "trustScore": 30,
        "trustLabel": "low",
        "fallbackReason": "missing_projected_components",
        "reasons": [
          "Projected stat components are missing.",
          "Legacy projection source is labeled separately from comprehensive projection output.",
          "Fallback/root-cause reason: missing_projected_components.",
          "Source confidence: medium."
        ],
        "dataGaps": [
          "coaching environment",
          "depth chart role",
          "injury risk",
          "projected snap share",
          "role stability",
          "team defense environment",
          "team offense environment"
        ]
      },
      "roleClassification": {
        "playerId": "def",
        "playerName": "Defense",
        "position": "DEF",
        "team": "TST",
        "role": "team_unit",
        "confidence": "medium",
        "basis": [
          "team_unit"
        ],
        "teamPositionRankProxy": null,
        "sameTeamPositionPeerCount": 1,
        "projectedVolumeScore": 96,
        "reasons": [
          "Team defense is evaluated as a unit, not an individual depth-chart role."
        ],
        "dataGaps": [
          "individual role not applicable to team defense"
        ]
      },
      "replacementValue": {
        "playerId": "def",
        "position": "DEF",
        "medianPoints": 120,
        "replacementMedianPoints": 120,
        "pointsAboveReplacement": 0,
        "parPercentileByPosition": 50,
        "replacementRank": 12,
        "replacementMethod": "league_roster_slots",
        "role": "team_unit",
        "roleConfidence": "medium",
        "reasons": [
          "DEF replacement baseline is rank 12 by league roster demand.",
          "PAR is season projection minus replacement median (120.0)."
        ],
        "dataGaps": [
          "individual role not applicable to team defense"
        ]
      },
      "pointsAboveReplacement": 0,
      "valueComponents": {
        "projectionValue": 50,
        "floorCeilingShape": 85.41666666666666,
        "positionScarcity": 50,
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
        "depthChartRole": 82,
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
        "Team defense is evaluated as a unit, not an individual depth-chart role.",
        "DEF replacement baseline is rank 12 by league roster demand.",
        "PAR is season projection minus replacement median (120.0)."
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
      "blackbirdRank": 8,
      "blackbirdTier": 1,
      "leagueValueScore": 48.43,
      "projectedFantasyPoints": {
        "floor": 90,
        "median": 115,
        "ceiling": 135,
        "unit": "season",
        "source": "h10_league_projection",
        "scoringAware": true
      },
      "projectionTrust": {
        "playerId": "k",
        "playerName": "Kicker",
        "position": "K",
        "team": "TST",
        "projectionRunId": null,
        "projectionVersion": "h10_league_value",
        "projectionUnit": "season",
        "projectionSource": "legacy_projection",
        "hasStatBackedProjection": false,
        "hasScoredFantasyProjection": true,
        "hasProjectedComponents": false,
        "trustScore": 30,
        "trustLabel": "low",
        "fallbackReason": "missing_projected_components",
        "reasons": [
          "Projected stat components are missing.",
          "Legacy projection source is labeled separately from comprehensive projection output.",
          "Fallback/root-cause reason: missing_projected_components.",
          "Source confidence: medium."
        ],
        "dataGaps": [
          "coaching environment",
          "depth chart role",
          "injury risk",
          "projected snap share",
          "role stability",
          "team defense environment",
          "team offense environment"
        ]
      },
      "roleClassification": {
        "playerId": "k",
        "playerName": "Kicker",
        "position": "K",
        "team": "TST",
        "role": "probable_starter",
        "confidence": "low",
        "basis": [
          "projection_volume_proxy"
        ],
        "teamPositionRankProxy": null,
        "sameTeamPositionPeerCount": 1,
        "projectedVolumeScore": 95.83333333333334,
        "reasons": [
          "Role is inferred from K season projection volume, not confirmed depth chart data."
        ],
        "dataGaps": [
          "confirmed depth chart",
          "confirmed snap share"
        ]
      },
      "replacementValue": {
        "playerId": "k",
        "position": "K",
        "medianPoints": 115,
        "replacementMedianPoints": 115,
        "pointsAboveReplacement": 0,
        "parPercentileByPosition": 50,
        "replacementRank": 12,
        "replacementMethod": "league_roster_slots",
        "role": "probable_starter",
        "roleConfidence": "low",
        "reasons": [
          "K replacement baseline is rank 12 by league roster demand.",
          "PAR is season projection minus replacement median (115.0)."
        ],
        "dataGaps": [
          "confirmed depth chart",
          "confirmed snap share"
        ]
      },
      "pointsAboveReplacement": 0,
      "valueComponents": {
        "projectionValue": 50,
        "floorCeilingShape": 84.1304347826087,
        "positionScarcity": 50,
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
        "depthChartRole": 76,
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
        "Role is inferred from K season projection volume, not confirmed depth chart data.",
        "K replacement baseline is rank 12 by league roster demand.",
        "PAR is season projection minus replacement median (115.0)."
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
      ],
      "source": {
        "adp": 160,
        "externalMarketRank": 10,
        "h10RecommendationRank": null,
        "projectionRunId": null,
        "projectionVersion": "h10_league_value",
        "fallbackProjection": false
      }
    },
    {
      "playerId": "db",
      "playerName": "Starter DB",
      "position": "DB",
      "team": "TST",
      "drafted": false,
      "blackbirdRank": 9,
      "blackbirdTier": 1,
      "leagueValueScore": 45.88,
      "projectedFantasyPoints": {
        "floor": 155,
        "median": 196,
        "ceiling": 235,
        "unit": "season",
        "source": "h10_league_projection",
        "scoringAware": true
      },
      "projectionTrust": {
        "playerId": "db",
        "playerName": "Starter DB",
        "position": "DB",
        "team": "TST",
        "projectionRunId": null,
        "projectionVersion": "idp_k_dst_v3_or_later",
        "projectionUnit": "season",
        "projectionSource": "legacy_projection",
        "hasStatBackedProjection": false,
        "hasScoredFantasyProjection": true,
        "hasProjectedComponents": false,
        "trustScore": 20,
        "trustLabel": "very_low",
        "fallbackReason": "missing_projected_components",
        "reasons": [
          "Projected stat components are missing.",
          "Legacy projection source is labeled separately from comprehensive projection output.",
          "Fallback/root-cause reason: missing_projected_components.",
          "Source confidence: low."
        ],
        "dataGaps": [
          "coaching environment",
          "depth chart role",
          "injury risk",
          "projected snap share",
          "role stability",
          "team defense environment",
          "team offense environment"
        ]
      },
      "roleClassification": {
        "playerId": "db",
        "playerName": "Starter DB",
        "position": "DB",
        "team": "TST",
        "role": "probable_starter",
        "confidence": "low",
        "basis": [
          "projection_volume_proxy"
        ],
        "teamPositionRankProxy": null,
        "sameTeamPositionPeerCount": 1,
        "projectedVolumeScore": 100,
        "reasons": [
          "Role is inferred from DB season projection volume, not confirmed depth chart data."
        ],
        "dataGaps": [
          "confirmed depth chart",
          "confirmed snap share"
        ]
      },
      "replacementValue": {
        "playerId": "db",
        "position": "DB",
        "medianPoints": 196,
        "replacementMedianPoints": 196,
        "pointsAboveReplacement": 0,
        "parPercentileByPosition": 50,
        "replacementRank": 12,
        "replacementMethod": "league_roster_slots",
        "role": "probable_starter",
        "roleConfidence": "low",
        "reasons": [
          "DB replacement baseline is rank 12 by league roster demand.",
          "PAR is season projection minus replacement median (196.0)."
        ],
        "dataGaps": [
          "confirmed depth chart",
          "confirmed depth chart for backup deweighting",
          "confirmed snap share"
        ]
      },
      "pointsAboveReplacement": 0,
      "valueComponents": {
        "projectionValue": 50,
        "floorCeilingShape": 85.71428571428572,
        "positionScarcity": 50,
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
        "depthChartRole": 76,
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
        "IDP value is separated by defensive position and confidence.",
        "Role is inferred from DB season projection volume, not confirmed depth chart data.",
        "DB replacement baseline is rank 12 by league roster demand.",
        "PAR is season projection minus replacement median (196.0)."
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
      ],
      "source": {
        "adp": 130,
        "externalMarketRank": 10,
        "h10RecommendationRank": null,
        "projectionRunId": null,
        "projectionVersion": "idp_k_dst_v3_or_later",
        "fallbackProjection": false
      }
    }
  ],
  "checks": [
    {
      "name": "drafted_and_undrafted_included",
      "passed": true,
      "detail": "{\"totalPlayers\":9,\"draftedPlayersIncluded\":2,\"undraftedPlayersIncluded\":7,\"projectionUnits\":{\"season\":9,\"weekly\":0,\"game\":0,\"fallback\":0,\"unknown\":0},\"fallbackProjectionRows\":0,\"roleClassifiedRows\":9,\"replacementBaselinePositions\":9,\"playersWithRoleAwarePAR\":9,\"adpPrimarySignal\":false,\"orderingMethod\":\"contextual league value + role-aware PAR -> projection -> name; ADP external reference only\",\"bannedLanguageFound\":[]}"
    },
    {
      "name": "rank_static_after_picks",
      "passed": true,
      "detail": "rank map unchanged after simulated picks"
    },
    {
      "name": "adp_not_primary",
      "passed": true,
      "detail": "contextual league value + role-aware PAR -> projection -> name; ADP external reference only"
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
