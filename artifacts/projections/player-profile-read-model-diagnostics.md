# player-profile-read-model-diagnostics

```json
{
  "generatedAt": "2026-06-16T22:29:53.111Z",
  "dryRun": true,
  "readOnly": true,
  "artifactPath": "C:\\Projects\\lineup_lab\\artifacts\\projections\\player-profiles.json",
  "cwd": "C:\\Projects\\lineup_lab",
  "artifactExists": true,
  "artifactStatus": "ready",
  "artifactSizeBytes": 37944227,
  "loadError": null,
  "totalProfiles": 7511,
  "profilesIndexedBySleeperId": 7511,
  "profilesIndexedByGsisId": 7478,
  "profilesIndexedByBlackbirdPlayerId": 0,
  "profilesIndexedByNflId": 4278,
  "profilesIndexedByEspnId": 7125,
  "profilesIndexedByPfrId": 6757,
  "profilesIndexedByNamePosition": 7462,
  "duplicateIdsFound": 167,
  "duplicateIdExamples": [
    {
      "index": "gsis_id",
      "key": "00-0025406",
      "count": 2
    },
    {
      "index": "gsis_id",
      "key": "00-0027037",
      "count": 2
    },
    {
      "index": "gsis_id",
      "key": "00-0033411",
      "count": 2
    },
    {
      "index": "gsis_id",
      "key": "00-0030500",
      "count": 2
    },
    {
      "index": "gsis_id",
      "key": "00-0029848",
      "count": 2
    },
    {
      "index": "gsis_id",
      "key": "00-0029981",
      "count": 2
    },
    {
      "index": "gsis_id",
      "key": "00-0032769",
      "count": 2
    },
    {
      "index": "gsis_id",
      "key": "00-0034641",
      "count": 2
    },
    {
      "index": "gsis_id",
      "key": "00-0031120",
      "count": 2
    },
    {
      "index": "gsis_id",
      "key": "00-0032876",
      "count": 2
    },
    {
      "index": "gsis_id",
      "key": "00-0033226",
      "count": 2
    },
    {
      "index": "gsis_id",
      "key": "00-0033425",
      "count": 2
    },
    {
      "index": "gsis_id",
      "key": "00-0033703",
      "count": 2
    },
    {
      "index": "gsis_id",
      "key": "00-0033815",
      "count": 2
    },
    {
      "index": "gsis_id",
      "key": "00-0034816",
      "count": 2
    },
    {
      "index": "gsis_id",
      "key": "00-0034685",
      "count": 2
    },
    {
      "index": "gsis_id",
      "key": "00-0034517",
      "count": 2
    },
    {
      "index": "gsis_id",
      "key": "00-0034560",
      "count": 2
    },
    {
      "index": "gsis_id",
      "key": "00-0034265",
      "count": 2
    },
    {
      "index": "gsis_id",
      "key": "00-0035718",
      "count": 2
    }
  ],
  "knownLookups": {
    "christianMcCaffreyBySleeperId4034": {
      "found": true,
      "matchedBy": "sleeper_id",
      "duplicateKey": null,
      "playerName": "Christian McCaffrey",
      "position": "RB"
    },
    "christianMcCaffreyByGsisId000033280": {
      "found": true,
      "matchedBy": "gsis_id",
      "duplicateKey": null,
      "playerName": "Christian McCaffrey",
      "position": "RB"
    },
    "calebWilliamsByNamePosition": {
      "found": true,
      "matchedBy": "name_position",
      "duplicateKey": null,
      "playerName": "Caleb Williams",
      "position": "QB"
    }
  },
  "cmcLookupStatus": {
    "found": true,
    "matchedBy": "sleeper_id",
    "duplicateKey": null,
    "playerName": "Christian McCaffrey",
    "position": "RB"
  },
  "cmcGsisLookupStatus": {
    "found": true,
    "matchedBy": "gsis_id",
    "duplicateKey": null,
    "playerName": "Christian McCaffrey",
    "position": "RB"
  },
  "calebWilliamsLookupStatus": {
    "found": true,
    "matchedBy": "name_position",
    "duplicateKey": null,
    "playerName": "Caleb Williams",
    "position": "QB"
  },
  "lookupSuccessExamplesByPosition": {
    "QB": [
      {
        "playerName": "GJ Kinne",
        "playerId": "1",
        "matchedBy": "sleeper_id"
      },
      {
        "playerName": "Kurt Warner",
        "playerId": "7",
        "matchedBy": "sleeper_id"
      },
      {
        "playerName": "Joe Flacco",
        "playerId": "19",
        "matchedBy": "sleeper_id"
      }
    ],
    "LB": [
      {
        "playerName": "David Harris",
        "playerId": "3",
        "matchedBy": "sleeper_id"
      },
      {
        "playerName": "Stephen Tulloch",
        "playerId": "10",
        "matchedBy": "sleeper_id"
      },
      {
        "playerName": "Patrick Willis",
        "playerId": "15",
        "matchedBy": "sleeper_id"
      }
    ],
    "WR": [
      {
        "playerName": "Roddy White",
        "playerId": "4",
        "matchedBy": "sleeper_id"
      },
      {
        "playerName": "Sidney Rice",
        "playerId": "14",
        "matchedBy": "sleeper_id"
      },
      {
        "playerName": "Domenik Hixon",
        "playerId": "65",
        "matchedBy": "sleeper_id"
      }
    ],
    "TE": [
      {
        "playerName": "Dallas Clark",
        "playerId": "5",
        "matchedBy": "sleeper_id"
      },
      {
        "playerName": "Jason Witten",
        "playerId": "23",
        "matchedBy": "sleeper_id"
      },
      {
        "playerName": "Jacob Tamme",
        "playerId": "32",
        "matchedBy": "sleeper_id"
      }
    ],
    "DL": [
      {
        "playerName": "Brandon Mebane",
        "playerId": "6",
        "matchedBy": "sleeper_id"
      },
      {
        "playerName": "Jason Jones",
        "playerId": "8",
        "matchedBy": "sleeper_id"
      },
      {
        "playerName": "Jared Allen",
        "playerId": "20",
        "matchedBy": "sleeper_id"
      }
    ],
    "K": [
      {
        "playerName": "Garrett Hartley",
        "playerId": "11",
        "matchedBy": "sleeper_id"
      },
      {
        "playerName": "Matt Prater",
        "playerId": "17",
        "matchedBy": "sleeper_id"
      },
      {
        "playerName": "Dan Carpenter",
        "playerId": "45",
        "matchedBy": "sleeper_id"
      }
    ],
    "RB": [
      {
        "playerName": "Ray Rice",
        "playerId": "16",
        "matchedBy": "sleeper_id"
      },
      {
        "playerName": "Jerome Felton",
        "playerId": "25",
        "matchedBy": "sleeper_id"
      },
      {
        "playerName": "Pierre Thomas",
        "playerId": "34",
        "matchedBy": "sleeper_id"
      }
    ],
    "DB": [
      {
        "playerName": "Roman Harper",
        "playerId": "26",
        "matchedBy": "sleeper_id"
      },
      {
        "playerName": "Aaron Ross",
        "playerId": "28",
        "matchedBy": "sleeper_id"
      },
      {
        "playerName": "Kenny Phillips",
        "playerId": "33",
        "matchedBy": "sleeper_id"
      }
    ]
  },
  "lookupFailures": [],
  "limitations": [
    "Artifact-backed read model only. No Supabase writes are performed.",
    "Ambiguous duplicate ID lookups intentionally return no profile.",
    "Weekly game log is capped in the API response."
  ]
}
```
