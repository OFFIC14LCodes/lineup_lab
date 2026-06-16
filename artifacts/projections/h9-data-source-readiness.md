# h9-data-source-readiness

```json
{
  "generatedAt": "2026-06-16T19:06:00.632Z",
  "kind": "data-source-readiness",
  "safety": {
    "noScraping": true,
    "noPaidApi": true,
    "noAi": true,
    "noAdpFallback": true,
    "unknownFieldsRemainDataGaps": true
  },
  "verdict": "passed",
  "summary": {
    "registeredSources": 5,
    "availableSources": 3,
    "missingLocalFiles": 0,
    "disabledApiSources": 2
  },
  "sources": [
    {
      "sourceId": "local_rookie_draft_capital_csv",
      "sourceName": "Local rookie draft capital CSV",
      "sourceCategory": "nfl_draft_capital",
      "acquisitionMethod": "local_csv",
      "requiresApiKey": false,
      "localPath": "C:\\Projects\\lineup_lab\\data\\rookies\\sources\\draft-capital.csv",
      "enabled": true,
      "priority": 10,
      "notes": [
        "Preferred offline source for verified NFL draft capital."
      ],
      "configured": true,
      "available": true,
      "skippedReason": null
    },
    {
      "sourceId": "local_rookie_college_production_csv",
      "sourceName": "Local rookie college production CSV",
      "sourceCategory": "college_player_stats",
      "acquisitionMethod": "local_csv",
      "requiresApiKey": false,
      "localPath": "C:\\Projects\\lineup_lab\\data\\rookies\\sources\\college-production.csv",
      "enabled": true,
      "priority": 20,
      "notes": [
        "Preferred offline source for verified college production profiles."
      ],
      "configured": true,
      "available": true,
      "skippedReason": null
    },
    {
      "sourceId": "local_rookie_role_notes_csv",
      "sourceName": "Local rookie role notes CSV",
      "sourceCategory": "manual_role_notes",
      "acquisitionMethod": "manual",
      "requiresApiKey": false,
      "localPath": "C:\\Projects\\lineup_lab\\data\\rookies\\sources\\role-notes.csv",
      "enabled": true,
      "priority": 30,
      "notes": [
        "Manual/imported opportunity notes. Missing values remain data gaps."
      ],
      "configured": true,
      "available": true,
      "skippedReason": null
    },
    {
      "sourceId": "cfbd_api_college_stats",
      "sourceName": "CollegeFootballData API",
      "sourceCategory": "college_player_stats",
      "acquisitionMethod": "api",
      "requiresApiKey": true,
      "apiKeyEnvName": "CFBD_API_KEY",
      "enabled": false,
      "priority": 60,
      "notes": [
        "Disabled unless CFBD_API_KEY is configured. No API calls are made by diagnostics."
      ],
      "configured": false,
      "available": false,
      "skippedReason": "missing CFBD_API_KEY"
    },
    {
      "sourceId": "sportsdataio_context_api",
      "sourceName": "SportsDataIO context API placeholder",
      "sourceCategory": "provider_projection_context",
      "acquisitionMethod": "api",
      "requiresApiKey": true,
      "apiKeyEnvName": "SPORTSDATAIO_API_KEY",
      "enabled": false,
      "priority": 80,
      "notes": [
        "Placeholder only. Requires explicit source integration approval before use."
      ],
      "configured": false,
      "available": false,
      "skippedReason": "missing SPORTSDATAIO_API_KEY"
    }
  ],
  "directories": [
    {
      "dir": "data/acquisition/cache",
      "exists": true
    },
    {
      "dir": "data/acquisition/raw",
      "exists": true
    },
    {
      "dir": "data/acquisition/normalized",
      "exists": true
    },
    {
      "dir": "data/acquisition/logs",
      "exists": true
    },
    {
      "dir": "data/rookies/sources",
      "exists": true
    }
  ]
}
```
