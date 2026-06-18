# h9-rookie-enrichment-readiness

```json
{
  "generatedAt": "2026-06-16T19:06:25.704Z",
  "verdict": "passed",
  "readiness": "ready_with_source_gaps",
  "sourceStatus": "enrichment_overlay_loaded",
  "overlayCandidates": [
    {
      "path": "C:\\Projects\\lineup_lab\\data\\rookies\\rookie-enrichment.csv",
      "exists": true
    },
    {
      "path": "C:\\Projects\\lineup_lab\\data\\rookies\\rookie-enrichment.json",
      "exists": false
    }
  ],
  "checks": [
    {
      "name": "base_rookie_file_available",
      "passed": true,
      "detail": "C:\\Projects\\lineup_lab\\data\\rookies\\rookie-data.csv"
    },
    {
      "name": "base_rows_valid",
      "passed": true,
      "detail": "702/702 valid, 0 invalid"
    },
    {
      "name": "enrichment_overlay_optional_and_detected_if_present",
      "passed": true,
      "detail": "C:\\Projects\\lineup_lab\\data\\rookies\\rookie-enrichment.csv"
    },
    {
      "name": "enrichment_rows_valid_when_present",
      "passed": true,
      "detail": "0 invalid enrichment rows"
    },
    {
      "name": "enrichment_ambiguity_reported_not_forced",
      "passed": true,
      "detail": "0 ambiguous enrichment rows"
    },
    {
      "name": "enrichment_conflicts_reported_not_overwritten",
      "passed": true,
      "detail": "0 conflicts"
    },
    {
      "name": "draft_capital_gaps_explicit",
      "passed": true,
      "detail": "0 with draft capital"
    },
    {
      "name": "college_production_gaps_explicit",
      "passed": true,
      "detail": "0 with college production"
    },
    {
      "name": "role_gaps_explicit",
      "passed": true,
      "detail": "0 with landing spot role"
    },
    {
      "name": "no_adp_fallback",
      "passed": true,
      "detail": "rookie enrichment schema excludes ADP"
    },
    {
      "name": "no_scraping_or_paid_api",
      "passed": true,
      "detail": "local/manual/provider-export overlay only"
    }
  ],
  "baseImport": {
    "sourcePath": "C:\\Projects\\lineup_lab\\data\\rookies\\rookie-data.csv",
    "totalRows": 702,
    "validRows": 702,
    "invalidRows": 0,
    "matchedRows": 702,
    "unmatchedRows": 0,
    "ambiguousMatches": 0
  },
  "enrichmentImport": {
    "sourcePath": "C:\\Projects\\lineup_lab\\data\\rookies\\rookie-enrichment.csv",
    "rows": 702,
    "validRows": 702,
    "invalidRows": 0,
    "matchedRows": 702,
    "unmatchedRows": 0,
    "ambiguousRows": 0,
    "conflictCount": 0,
    "conflicts": [],
    "results": [
      {
        "row": 2,
        "matchedBaseIndex": 0,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 3,
        "matchedBaseIndex": 1,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 4,
        "matchedBaseIndex": 2,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 5,
        "matchedBaseIndex": 3,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 6,
        "matchedBaseIndex": 4,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 7,
        "matchedBaseIndex": 5,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 8,
        "matchedBaseIndex": 6,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 9,
        "matchedBaseIndex": 7,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 10,
        "matchedBaseIndex": 8,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 11,
        "matchedBaseIndex": 9,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 12,
        "matchedBaseIndex": 10,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 13,
        "matchedBaseIndex": 11,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 14,
        "matchedBaseIndex": 12,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 15,
        "matchedBaseIndex": 13,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 16,
        "matchedBaseIndex": 14,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 17,
        "matchedBaseIndex": 15,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 18,
        "matchedBaseIndex": 16,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 19,
        "matchedBaseIndex": 17,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 20,
        "matchedBaseIndex": 18,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 21,
        "matchedBaseIndex": 19,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 22,
        "matchedBaseIndex": 20,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 23,
        "matchedBaseIndex": 21,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 24,
        "matchedBaseIndex": 22,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 25,
        "matchedBaseIndex": 23,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 26,
        "matchedBaseIndex": 24,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 27,
        "matchedBaseIndex": 25,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 28,
        "matchedBaseIndex": 26,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 29,
        "matchedBaseIndex": 27,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 30,
        "matchedBaseIndex": 28,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 31,
        "matchedBaseIndex": 29,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 32,
        "matchedBaseIndex": 30,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 33,
        "matchedBaseIndex": 31,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 34,
        "matchedBaseIndex": 32,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 35,
        "matchedBaseIndex": 33,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 36,
        "matchedBaseIndex": 34,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 37,
        "matchedBaseIndex": 35,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 38,
        "matchedBaseIndex": 36,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 39,
        "matchedBaseIndex": 37,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 40,
        "matchedBaseIndex": 38,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 41,
        "matchedBaseIndex": 39,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 42,
        "matchedBaseIndex": 40,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 43,
        "matchedBaseIndex": 41,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 44,
        "matchedBaseIndex": 42,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 45,
        "matchedBaseIndex": 43,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 46,
        "matchedBaseIndex": 44,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 47,
        "matchedBaseIndex": 45,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 48,
        "matchedBaseIndex": 46,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 49,
        "matchedBaseIndex": 47,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 50,
        "matchedBaseIndex": 48,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      },
      {
        "row": 51,
        "matchedBaseIndex": 49,
        "matchStatus": "matched_player_id",
        "unresolvedReason": null,
        "errors": []
      }
    ]
  },
  "before": {
    "players": 702,
    "withDraftCapital": 0,
    "withCollegeProduction": 0,
    "withLandingSpotRole": 0,
    "withOpportunityScore": 0,
    "confidenceDistribution": {
      "very_low": 702
    },
    "sourceLabels": [
      "players.metadata_json"
    ]
  },
  "after": {
    "players": 702,
    "withDraftCapital": 0,
    "withCollegeProduction": 0,
    "withLandingSpotRole": 0,
    "withOpportunityScore": 0,
    "confidenceDistribution": {
      "very_low": 702
    },
    "sourceLabels": [
      "players.metadata_json + rookie-enrichment"
    ]
  },
  "expectedProjectionConfidenceImprovement": {
    "currentImportedConfidence": {
      "very_low": 702
    },
    "expected": "Rookies with verified draft capital, college production, and landing spot role can move from very_low to low/medium; unknown fields remain conservative gaps."
  },
  "topDataGaps": [
    {
      "key": "college production",
      "count": 702
    },
    {
      "key": "landing spot role",
      "count": 702
    },
    {
      "key": "NFL draft capital",
      "count": 702
    },
    {
      "key": "team assignment",
      "count": 151
    },
    {
      "key": "college",
      "count": 34
    }
  ],
  "sampleContextCards": [
    {
      "playerId": "df12143a-4821-4658-b16a-ba685122ba25",
      "playerName": "Athan Kaliakmanis",
      "position": "QB",
      "team": "WAS",
      "draftCapitalScore": null,
      "collegeProductionScore": null,
      "opportunityScore": null,
      "landingSpotRole": "unknown",
      "confidence": "very_low",
      "availableInputs": [
        "age",
        "team assignment",
        "years experience"
      ],
      "dataGaps": [
        "NFL draft capital",
        "college production",
        "landing spot role"
      ],
      "sourceLabels": [
        "players.metadata_json + rookie-enrichment"
      ]
    },
    {
      "playerId": "f51932b4-fd98-4c6c-867e-3430fefd190c",
      "playerName": "Adam Randall",
      "position": "RB",
      "team": "BAL",
      "draftCapitalScore": null,
      "collegeProductionScore": null,
      "opportunityScore": null,
      "landingSpotRole": "unknown",
      "confidence": "very_low",
      "availableInputs": [
        "age",
        "team assignment",
        "years experience"
      ],
      "dataGaps": [
        "NFL draft capital",
        "college production",
        "landing spot role"
      ],
      "sourceLabels": [
        "players.metadata_json + rookie-enrichment"
      ]
    },
    {
      "playerId": "4df3e0a5-0359-4248-b281-5ae881615d6d",
      "playerName": "Aaron Anderson",
      "position": "WR",
      "team": "CLE",
      "draftCapitalScore": null,
      "collegeProductionScore": null,
      "opportunityScore": null,
      "landingSpotRole": "unknown",
      "confidence": "very_low",
      "availableInputs": [
        "age",
        "team assignment",
        "years experience"
      ],
      "dataGaps": [
        "NFL draft capital",
        "college production",
        "landing spot role"
      ],
      "sourceLabels": [
        "players.metadata_json + rookie-enrichment"
      ]
    },
    {
      "playerId": "352d7ba3-7879-4b18-9e3b-15641cf8d8b6",
      "playerName": "Ademola Faleye",
      "position": "TE",
      "team": null,
      "draftCapitalScore": null,
      "collegeProductionScore": null,
      "opportunityScore": null,
      "landingSpotRole": "unknown",
      "confidence": "very_low",
      "availableInputs": [
        "age",
        "years experience"
      ],
      "dataGaps": [
        "NFL draft capital",
        "college production",
        "landing spot role",
        "team assignment"
      ],
      "sourceLabels": [
        "players.metadata_json + rookie-enrichment"
      ]
    },
    {
      "playerId": "17e9aa74-fe50-4b83-817b-03dc8fb9e4bc",
      "playerName": "Aaron Graves",
      "position": "DL",
      "team": "BAL",
      "draftCapitalScore": null,
      "collegeProductionScore": null,
      "opportunityScore": null,
      "landingSpotRole": "unknown",
      "confidence": "very_low",
      "availableInputs": [
        "age",
        "team assignment",
        "years experience"
      ],
      "dataGaps": [
        "NFL draft capital",
        "college production",
        "landing spot role"
      ],
      "sourceLabels": [
        "players.metadata_json + rookie-enrichment"
      ]
    },
    {
      "playerId": "dcfbb708-ff31-4649-8306-361ae3081534",
      "playerName": "Aiden Fisher",
      "position": "LB",
      "team": "HOU",
      "draftCapitalScore": null,
      "collegeProductionScore": null,
      "opportunityScore": null,
      "landingSpotRole": "unknown",
      "confidence": "very_low",
      "availableInputs": [
        "age",
        "team assignment",
        "years experience"
      ],
      "dataGaps": [
        "NFL draft capital",
        "college production",
        "landing spot role"
      ],
      "sourceLabels": [
        "players.metadata_json + rookie-enrichment"
      ]
    },
    {
      "playerId": "92017508-73d4-4001-9cb2-ceedac467edc",
      "playerName": "Aamaris Brown",
      "position": "DB",
      "team": "DET",
      "draftCapitalScore": null,
      "collegeProductionScore": null,
      "opportunityScore": null,
      "landingSpotRole": "unknown",
      "confidence": "very_low",
      "availableInputs": [
        "team assignment",
        "years experience"
      ],
      "dataGaps": [
        "NFL draft capital",
        "college production",
        "landing spot role"
      ],
      "sourceLabels": [
        "players.metadata_json + rookie-enrichment"
      ]
    }
  ],
  "safety": {
    "noScraping": true,
    "noPaidApi": true,
    "noFabricatedDraftCapital": true,
    "noFabricatedCollegeProduction": true,
    "noFabricatedLandingSpotRole": true,
    "noAdpFallback": true,
    "noPersistence": true
  }
}
```
