# h9-rookie-import-readiness

```json
{
  "kind": "h9-rookie-import-readiness",
  "generatedAt": "2026-06-16T17:43:27.167Z",
  "verdict": "passed",
  "checks": [
    {
      "name": "local_input_shape_available",
      "passed": true,
      "detail": "C:\\Projects\\lineup_lab\\data\\rookies\\rookie-data.csv"
    },
    {
      "name": "valid_rows_present",
      "passed": true,
      "detail": "702/702"
    },
    {
      "name": "invalid_rows_reported",
      "passed": true,
      "detail": "0 invalid rows"
    },
    {
      "name": "draft_capital_scored_or_gapped",
      "passed": true,
      "detail": "draft capital unavailable and reported as data gap"
    },
    {
      "name": "college_production_scored_or_gapped",
      "passed": true,
      "detail": "college production unavailable and reported as data gap"
    },
    {
      "name": "missing_data_is_explicit",
      "passed": true,
      "detail": "college production, landing spot role, NFL draft capital, team assignment, college"
    },
    {
      "name": "adp_not_used",
      "passed": true,
      "detail": "rookie import schema excludes ADP"
    },
    {
      "name": "no_persistence",
      "passed": true,
      "detail": "dry-run import only writes artifacts"
    }
  ],
  "safety": {
    "noScraping": true,
    "noPaidApi": true,
    "noFabricatedContext": true,
    "noAdpFallback": true,
    "noDraftStateMutation": true,
    "noRecommendationPersistence": true
  },
  "sourcePath": "C:\\Projects\\lineup_lab\\data\\rookies\\rookie-data.csv",
  "enrichmentSourcePath": null,
  "counts": {
    "totalRows": 702,
    "validRows": 702,
    "invalidRows": 0,
    "matchedRows": 702,
    "unmatchedRows": 0,
    "duplicateCandidateMatches": 0,
    "ambiguousMatches": 0,
    "exactIdMatches": 702,
    "namePositionTeamMatches": 0,
    "namePositionMatches": 0,
    "nameOnlyUniqueMatches": 0,
    "enrichmentRows": 0,
    "validEnrichmentRows": 0,
    "invalidEnrichmentRows": 0,
    "matchedEnrichmentRows": 0,
    "unmatchedEnrichmentRows": 0,
    "ambiguousEnrichmentRows": 0,
    "conflictCount": 0
  },
  "enrichmentResults": [],
  "conflicts": [],
  "sourceLabels": [
    "players.metadata_json"
  ],
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
  "samples": [
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
      ]
    },
    {
      "playerId": "56a60c05-94c9-4233-9ba1-413badb6e3db",
      "playerName": "Ahmari Harvey",
      "position": "DB",
      "team": "DEN",
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
      ]
    },
    {
      "playerId": "f3e0a6e8-9820-4d45-b98f-48d02170bfa2",
      "playerName": "AJ Haulcy",
      "position": "DB",
      "team": "IND",
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
      ]
    },
    {
      "playerId": "025e7d09-3bc2-45ed-bbb9-bdaacd5680da",
      "playerName": "Al'zillion Hamilton",
      "position": "DB",
      "team": "LAR",
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
      ]
    },
    {
      "playerId": "02c809d7-2819-4201-aace-865ceea995ef",
      "playerName": "Andre Fuller",
      "position": "DB",
      "team": "SEA",
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
      ]
    },
    {
      "playerId": "1e496684-662c-45ee-acd3-15b95583d9e7",
      "playerName": "Austin Brown",
      "position": "DB",
      "team": "IND",
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
      ]
    },
    {
      "playerId": "459fab97-e945-42bd-93cf-3125510c89b1",
      "playerName": "Avery Smith",
      "position": "DB",
      "team": "LAC",
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
      ]
    },
    {
      "playerId": "c23a8ad5-db6a-4b70-ae67-554ed1e15e1e",
      "playerName": "Avieon Terrell",
      "position": "DB",
      "team": "ATL",
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
      ]
    },
    {
      "playerId": "b055b8d6-500e-4818-bea2-23f66c7cd3ac",
      "playerName": "Ayden Garnes",
      "position": "DB",
      "team": "TB",
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
      ]
    },
    {
      "playerId": "3ba73fbc-2c93-4bdc-80a4-a1662be16620",
      "playerName": "Bishop Fitzgerald",
      "position": "DB",
      "team": "TEN",
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
      ]
    },
    {
      "playerId": "d86db881-089f-40a4-b96b-fa5f0b9c0e75",
      "playerName": "Brandon Cisse",
      "position": "DB",
      "team": "GB",
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
      ]
    },
    {
      "playerId": "f0229b28-2986-43c8-95f3-08b5a21c3586",
      "playerName": "Brent Austin",
      "position": "DB",
      "team": "DEN",
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
      ]
    }
  ],
  "errors": []
}
```
