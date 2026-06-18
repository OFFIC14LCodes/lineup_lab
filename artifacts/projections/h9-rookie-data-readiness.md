# h9-rookie-data-readiness

```json
{
  "generatedAt": "2026-06-16T18:14:38.408Z",
  "verdict": "passed",
  "rookieCount": 702,
  "rookiesWithProjections": 702,
  "rookiesMissingProjections": 0,
  "rookiesWithDraftCapital": 0,
  "rookiesWithCollegeProduction": 0,
  "rookiesWithTeamAssignment": 551,
  "rookiesWithRoleContext": 0,
  "rookieDataImport": {
    "sourcePath": "C:\\Projects\\lineup_lab\\data\\rookies\\rookie-data.csv",
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
    "enrichmentSourcePath": "C:\\Projects\\lineup_lab\\data\\rookies\\rookie-enrichment.csv",
    "enrichmentRows": 702,
    "validEnrichmentRows": 702,
    "invalidEnrichmentRows": 0,
    "matchedEnrichmentRows": 702,
    "unmatchedEnrichmentRows": 0,
    "ambiguousEnrichmentRows": 0,
    "conflictCount": 0,
    "conflicts": [],
    "noPersistence": true
  },
  "importedRookiesWithDraftCapital": 0,
  "importedRookiesWithCollegeProduction": 0,
  "importedRookiesWithRoleContext": 0,
  "rookieProjectionTrustDistribution": {
    "low": 702
  },
  "projectedConfidenceBeforeAfterAvailableInputs": {
    "current": {
      "very_low": 702
    },
    "expectedAfterDraftCapitalCollegeRole": "low-to-medium for rookies with real draft capital, college production, and role context; very_low remains for missing inputs"
  },
  "topRookieDataGaps": [
    {
      "key": "college production",
      "count": 1404
    },
    {
      "key": "landing spot role",
      "count": 1404
    },
    {
      "key": "NFL draft capital",
      "count": 1404
    },
    {
      "key": "missing college production profile",
      "count": 702
    },
    {
      "key": "missing NFL draft capital",
      "count": 702
    },
    {
      "key": "rookie role uncertainty",
      "count": 702
    },
    {
      "key": "team assignment",
      "count": 302
    },
    {
      "key": "college",
      "count": 68
    }
  ],
  "importReadyLocalInputShape": {
    "files": [
      "data/rookies/rookie-data.csv",
      "data/rookies/rookie-data.json"
    ],
    "model": "src/lib/projections/rookie-data-sources.ts",
    "loader": "src/lib/projections/rookie-data-loader.ts",
    "fields": [
      "playerId",
      "playerName",
      "position",
      "team",
      "season",
      "nflDraftRound",
      "nflDraftOverall",
      "college production columns",
      "landingSpotRole",
      "source"
    ]
  },
  "examplesOfDataNeeded": [
    "NFL draft round and overall pick",
    "college receiving/rushing/passing/tackle production",
    "team assignment and position",
    "role expectation such as starter, committee, rotational, backup"
  ]
}
```
