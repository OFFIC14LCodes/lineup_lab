# h9-rookie-data-import-dry-run

```json
{
  "generatedAt": "2026-06-16T19:07:00.783Z",
  "verdict": "passed",
  "dryRun": true,
  "noPersistence": true,
  "noAdpFallback": true,
  "sourcePath": "C:\\Projects\\lineup_lab\\data\\rookies\\rookie-data.csv",
  "prioritySourcePath": "C:\\Projects\\lineup_lab\\data\\rookies\\rookie-enrichment-priority.csv",
  "counts": {
    "baseSourcePath": "C:\\Projects\\lineup_lab\\data\\rookies\\rookie-data.csv",
    "enrichmentSourcePath": "C:\\Projects\\lineup_lab\\data\\rookies\\rookie-enrichment.csv",
    "prioritySourcePath": "C:\\Projects\\lineup_lab\\data\\rookies\\rookie-enrichment-priority.csv",
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
    "candidatePlayers": 7266,
    "enrichmentRows": 702,
    "validEnrichmentRows": 702,
    "invalidEnrichmentRows": 0,
    "matchedEnrichmentRows": 702,
    "unmatchedEnrichmentRows": 0,
    "ambiguousEnrichmentRows": 0,
    "conflictCount": 0,
    "priorityRows": 100,
    "rowsWithDraftCapital": 0,
    "rowsWithCollegeProduction": 0,
    "rowsWithLandingSpotRole": 0,
    "coverageByPriorityTier": {
      "high": 100
    }
  },
  "coverageByPosition": {
    "DB": {
      "total": 155,
      "withDraftCapital": 0,
      "withCollegeProduction": 0,
      "withLandingSpotRole": 0
    },
    "DL": {
      "total": 149,
      "withDraftCapital": 0,
      "withCollegeProduction": 0,
      "withLandingSpotRole": 0
    },
    "K": {
      "total": 14,
      "withDraftCapital": 0,
      "withCollegeProduction": 0,
      "withLandingSpotRole": 0
    },
    "LB": {
      "total": 85,
      "withDraftCapital": 0,
      "withCollegeProduction": 0,
      "withLandingSpotRole": 0
    },
    "QB": {
      "total": 33,
      "withDraftCapital": 0,
      "withCollegeProduction": 0,
      "withLandingSpotRole": 0
    },
    "RB": {
      "total": 62,
      "withDraftCapital": 0,
      "withCollegeProduction": 0,
      "withLandingSpotRole": 0
    },
    "TE": {
      "total": 66,
      "withDraftCapital": 0,
      "withCollegeProduction": 0,
      "withLandingSpotRole": 0
    },
    "WR": {
      "total": 138,
      "withDraftCapital": 0,
      "withCollegeProduction": 0,
      "withLandingSpotRole": 0
    }
  },
  "topMissingFields": [
    {
      "field": "college production",
      "count": 702
    },
    {
      "field": "landing spot role",
      "count": 702
    },
    {
      "field": "NFL draft capital",
      "count": 702
    },
    {
      "field": "team assignment",
      "count": 151
    },
    {
      "field": "college",
      "count": 34
    }
  ],
  "nextAction": "Fill nflDraftRound/nflDraftOverall and college production for the 100 critical/high priority rookies in data/rookies/rookie-enrichment-priority.csv, then rerun npm run dry-run:h9-rookie-data-import.",
  "enrichmentResults": [
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
    },
    {
      "row": 52,
      "matchedBaseIndex": 50,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 53,
      "matchedBaseIndex": 51,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 54,
      "matchedBaseIndex": 52,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 55,
      "matchedBaseIndex": 53,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 56,
      "matchedBaseIndex": 54,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 57,
      "matchedBaseIndex": 55,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 58,
      "matchedBaseIndex": 56,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 59,
      "matchedBaseIndex": 57,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 60,
      "matchedBaseIndex": 58,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 61,
      "matchedBaseIndex": 59,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 62,
      "matchedBaseIndex": 60,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 63,
      "matchedBaseIndex": 61,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 64,
      "matchedBaseIndex": 62,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 65,
      "matchedBaseIndex": 63,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 66,
      "matchedBaseIndex": 64,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 67,
      "matchedBaseIndex": 65,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 68,
      "matchedBaseIndex": 66,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 69,
      "matchedBaseIndex": 67,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 70,
      "matchedBaseIndex": 68,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 71,
      "matchedBaseIndex": 69,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 72,
      "matchedBaseIndex": 70,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 73,
      "matchedBaseIndex": 71,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 74,
      "matchedBaseIndex": 72,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 75,
      "matchedBaseIndex": 73,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 76,
      "matchedBaseIndex": 74,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 77,
      "matchedBaseIndex": 75,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 78,
      "matchedBaseIndex": 76,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 79,
      "matchedBaseIndex": 77,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 80,
      "matchedBaseIndex": 78,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 81,
      "matchedBaseIndex": 79,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 82,
      "matchedBaseIndex": 80,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 83,
      "matchedBaseIndex": 81,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 84,
      "matchedBaseIndex": 82,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 85,
      "matchedBaseIndex": 83,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 86,
      "matchedBaseIndex": 84,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 87,
      "matchedBaseIndex": 85,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 88,
      "matchedBaseIndex": 86,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 89,
      "matchedBaseIndex": 87,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 90,
      "matchedBaseIndex": 88,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 91,
      "matchedBaseIndex": 89,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 92,
      "matchedBaseIndex": 90,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 93,
      "matchedBaseIndex": 91,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 94,
      "matchedBaseIndex": 92,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 95,
      "matchedBaseIndex": 93,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 96,
      "matchedBaseIndex": 94,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 97,
      "matchedBaseIndex": 95,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 98,
      "matchedBaseIndex": 96,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 99,
      "matchedBaseIndex": 97,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 100,
      "matchedBaseIndex": 98,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 101,
      "matchedBaseIndex": 99,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 102,
      "matchedBaseIndex": 100,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 103,
      "matchedBaseIndex": 101,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 104,
      "matchedBaseIndex": 102,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 105,
      "matchedBaseIndex": 103,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 106,
      "matchedBaseIndex": 104,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 107,
      "matchedBaseIndex": 105,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 108,
      "matchedBaseIndex": 106,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 109,
      "matchedBaseIndex": 107,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 110,
      "matchedBaseIndex": 108,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 111,
      "matchedBaseIndex": 109,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 112,
      "matchedBaseIndex": 110,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 113,
      "matchedBaseIndex": 111,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 114,
      "matchedBaseIndex": 112,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 115,
      "matchedBaseIndex": 113,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 116,
      "matchedBaseIndex": 114,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 117,
      "matchedBaseIndex": 115,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 118,
      "matchedBaseIndex": 116,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 119,
      "matchedBaseIndex": 117,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 120,
      "matchedBaseIndex": 118,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 121,
      "matchedBaseIndex": 119,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 122,
      "matchedBaseIndex": 120,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 123,
      "matchedBaseIndex": 121,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 124,
      "matchedBaseIndex": 122,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 125,
      "matchedBaseIndex": 123,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 126,
      "matchedBaseIndex": 124,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 127,
      "matchedBaseIndex": 125,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 128,
      "matchedBaseIndex": 126,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 129,
      "matchedBaseIndex": 127,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 130,
      "matchedBaseIndex": 128,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 131,
      "matchedBaseIndex": 129,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 132,
      "matchedBaseIndex": 130,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 133,
      "matchedBaseIndex": 131,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 134,
      "matchedBaseIndex": 132,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 135,
      "matchedBaseIndex": 133,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 136,
      "matchedBaseIndex": 134,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 137,
      "matchedBaseIndex": 135,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 138,
      "matchedBaseIndex": 136,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 139,
      "matchedBaseIndex": 137,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 140,
      "matchedBaseIndex": 138,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 141,
      "matchedBaseIndex": 139,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 142,
      "matchedBaseIndex": 140,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 143,
      "matchedBaseIndex": 141,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 144,
      "matchedBaseIndex": 142,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 145,
      "matchedBaseIndex": 143,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 146,
      "matchedBaseIndex": 144,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 147,
      "matchedBaseIndex": 145,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 148,
      "matchedBaseIndex": 146,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 149,
      "matchedBaseIndex": 147,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 150,
      "matchedBaseIndex": 148,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 151,
      "matchedBaseIndex": 149,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 152,
      "matchedBaseIndex": 150,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 153,
      "matchedBaseIndex": 151,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 154,
      "matchedBaseIndex": 152,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 155,
      "matchedBaseIndex": 153,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 156,
      "matchedBaseIndex": 154,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 157,
      "matchedBaseIndex": 155,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 158,
      "matchedBaseIndex": 156,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 159,
      "matchedBaseIndex": 157,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 160,
      "matchedBaseIndex": 158,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 161,
      "matchedBaseIndex": 159,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 162,
      "matchedBaseIndex": 160,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 163,
      "matchedBaseIndex": 161,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 164,
      "matchedBaseIndex": 162,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 165,
      "matchedBaseIndex": 163,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 166,
      "matchedBaseIndex": 164,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 167,
      "matchedBaseIndex": 165,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 168,
      "matchedBaseIndex": 166,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 169,
      "matchedBaseIndex": 167,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 170,
      "matchedBaseIndex": 168,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 171,
      "matchedBaseIndex": 169,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 172,
      "matchedBaseIndex": 170,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 173,
      "matchedBaseIndex": 171,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 174,
      "matchedBaseIndex": 172,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 175,
      "matchedBaseIndex": 173,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 176,
      "matchedBaseIndex": 174,
      "matchStatus": "matched_player_id",
      "unresolvedReason": null,
      "errors": []
    },
    {
      "row": 177,
      "matchedBaseIndex": 175,
      "matc
```
