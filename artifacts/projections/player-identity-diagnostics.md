# player-identity-diagnostics

```json
{
  "generatedAt": "2026-06-16T21:00:17.674Z",
  "dryRun": true,
  "sources": {
    "blackbirdContextProfiles": {
      "path": "C:\\Projects\\lineup_lab\\data\\player-context\\normalized\\player-context-profiles.json",
      "exists": true,
      "rows": 7266
    },
    "rookieData": {
      "path": "C:\\Projects\\lineup_lab\\data\\rookies\\rookie-data.csv",
      "exists": true,
      "rows": 702
    },
    "sleeperExport": {
      "path": "C:\\Projects\\lineup_lab\\data\\sleeper\\raw\\players-nfl.json",
      "exists": true,
      "rawRows": 12199,
      "normalizedRows": 12199
    },
    "sleeperRepairDiagnostic": {
      "path": "C:\\Projects\\lineup_lab\\data\\diagnostic\\repair-sleeper-player-identities-dry-run.json",
      "exists": true,
      "rows": 382
    },
    "manualOverrides": {
      "path": "C:\\Projects\\lineup_lab\\data\\player-identity\\manual-overrides.csv",
      "exists": true,
      "rows": 0,
      "approvedRows": 0,
      "skippedRows": 0,
      "missingColumns": [],
      "issues": []
    },
    "nflversePlayers": {
      "rows": 25040
    },
    "nflverseRosters": {
      "rows": 3137
    },
    "nflversePlayerStats": {
      "rows": 19421
    }
  },
  "counts": {
    "totalBlackbirdSleeperPlayersConsidered": 17120,
    "totalNflversePlayersConsidered": 20597,
    "totalSleeperPlayersLoaded": 12199,
    "activeSleeperPlayers": 9393,
    "fantasyRelevantSleeperPlayers": 9859,
    "activeFantasyRelevantSleeperPlayers": 7635,
    "manualOverrideMatches": 0,
    "manualOverrideConflicts": 0,
    "exactIdMatches": 4764,
    "exactExternalIdMatches": 4764,
    "strongNamePositionTeamMatches": 2393,
    "namePositionTeamMatches": 4259,
    "mediumMatches": 133,
    "weakMatches": 215,
    "unmatchedBlackbirdSleeperPlayers": 4066,
    "activeFantasyRelevantUnmatchedPlayers": 1834,
    "inactiveRetiredUnmatchedPlayers": 2232,
    "unmatchedNflverseFantasyRelevantPlayers": 13035,
    "conflictsDuplicateCandidates": 270,
    "activeFantasyRelevantConflicts": 151
  },
  "confidenceDistribution": {
    "manual_override": 0,
    "exact_id": 4764,
    "strong": 7672,
    "medium": 133,
    "weak": 215,
    "unmatched": 4066,
    "conflict": 270
  },
  "examples": {
    "manual_override": [],
    "exact_id": [
      {
        "sourcePlayerId": "b34b7166-3905-4cf5-964f-c79068632e27",
        "sourcePlayerName": "Rashid Shaheed",
        "sourcePosition": "WR",
        "sourceTeam": "SEA",
        "sourceStatus": null,
        "sourceActive": null,
        "sourceSearchRank": null,
        "sourceYearsExperience": null,
        "sourceCollege": null,
        "sourceAge": null,
        "sourceBirthDate": null,
        "sourceHeight": null,
        "sourceWeight": null,
        "matchedPlayerId": "00-0037545",
        "matchedPlayerName": "Rashid Shaheed",
        "confidence": "exact_id",
        "score": 185,
        "matchReasons": [
          "exact ID match: sleeper_id, gsis_id",
          "normalized full name match",
          "position match",
          "team match"
        ],
        "conflictReasons": [],
        "candidateCount": 1,
        "preservedIds": {
          "blackbirdPlayerId": "b34b7166-3905-4cf5-964f-c79068632e27",
          "sleeperId": "8676",
          "gsisId": "00-0037545",
          "espnId": "4032473",
          "pfrId": "ShahRa00",
          "nflId": "55133",
          "smartId": "32005348-4108-9447-3491-eb73ad07ef30"
        },
        "candidateExamples": [
          {
            "playerId": "00-0037545",
            "playerName": "Rashid Shaheed",
            "position": "WR",
            "team": "SEA",
            "score": 185,
            "reasons": [
              "exact ID match: sleeper_id, gsis_id",
              "normalized full name match",
              "position match",
              "team match"
            ]
          }
        ]
      },
      {
        "sourcePlayerId": "c20ab5c3-4b48-499f-9627-ce3a16eb1556",
        "sourcePlayerName": "DeVonta Smith",
        "sourcePosition": "WR",
        "sourceTeam": "PHI",
        "sourceStatus": null,
        "sourceActive": null,
        "sourceSearchRank": null,
        "sourceYearsExperience": null,
        "sourceCollege": null,
        "sourceAge": null,
        "sourceBirthDate": null,
        "sourceHeight": null,
        "sourceWeight": null,
        "matchedPlayerId": "00-0036912",
        "matchedPlayerName": "DeVonta Smith",
        "confidence": "exact_id",
        "score": 185,
        "matchReasons": [
          "exact ID match: sleeper_id, gsis_id",
          "normalized full name match",
          "position match",
          "team match"
        ],
        "conflictReasons": [],
        "candidateCount": 2,
        "preservedIds": {
          "blackbirdPlayerId": "c20ab5c3-4b48-499f-9627-ce3a16eb1556",
          "sleeperId": "7525",
          "gsisId": "00-0036912",
          "espnId": "4241478",
          "pfrId": "SmitDe07",
          "nflId": "53439",
          "smartId": "3200534d-4920-6016-573c-fcc767bafc4d"
        },
        "candidateExamples": [
          {
            "playerId": "00-0036912",
            "playerName": "DeVonta Smith",
            "position": "WR",
            "team": "PHI",
            "score": 185,
            "reasons": [
              "exact ID match: sleeper_id, gsis_id",
              "normalized full name match",
              "position match",
              "team match"
            ]
          },
          {
            "playerId": "SMI206364",
            "playerName": "Devonta Smith",
            "position": "DB",
            "team": "CAR",
            "score": 17,
            "reasons": [
              "normalized full name match",
              "team mismatch lowered confidence: PHI vs CAR"
            ]
          }
        ]
      },
      {
        "sourcePlayerId": "b4d2ed26-10a6-4efc-b0f7-4ce9b44134a2",
        "sourcePlayerName": "Kenneth Gainwell",
        "sourcePosition": "RB",
        "sourceTeam": "TB",
        "sourceStatus": null,
        "sourceActive": null,
        "sourceSearchRank": null,
        "sourceYearsExperience": null,
        "sourceCollege": null,
        "sourceAge": null,
        "sourceBirthDate": null,
        "sourceHeight": null,
        "sourceWeight": null,
        "matchedPlayerId": "00-0036919",
        "matchedPlayerName": "Kenneth Gainwell",
        "confidence": "exact_id",
        "score": 185,
        "matchReasons": [
          "exact ID match: sleeper_id, gsis_id",
          "normalized full name match",
          "position match",
          "team match"
        ],
        "conflictReasons": [],
        "candidateCount": 1,
        "preservedIds": {
          "blackbirdPlayerId": "b4d2ed26-10a6-4efc-b0f7-4ce9b44134a2",
          "sleeperId": "7567",
          "gsisId": "00-0036919",
          "espnId": "4371733",
          "pfrId": "GainKe00",
          "nflId": "53579",
          "smartId": "32004741-4960-6964-7702-692656fad861"
        },
        "candidateExamples": [
          {
            "playerId": "00-0036919",
            "playerName": "Kenneth Gainwell",
            "position": "RB",
            "team": "TB",
            "score": 185,
            "reasons": [
              "exact ID match: sleeper_id, gsis_id",
              "normalized full name match",
              "position match",
              "team match"
            ]
          }
        ]
      },
      {
        "sourcePlayerId": "522721fc-c89e-4eeb-b69f-45a9c8f0ba45",
        "sourcePlayerName": "Amon-Ra St. Brown",
        "sourcePosition": "WR",
        "sourceTeam": "DET",
        "sourceStatus": null,
        "sourceActive": null,
        "sourceSearchRank": null,
        "sourceYearsExperience": null,
        "sourceCollege": null,
        "sourceAge": null,
        "sourceBirthDate": null,
        "sourceHeight": null,
        "sourceWeight": null,
        "matchedPlayerId": "00-0036963",
        "matchedPlayerName": "Amon-Ra St. Brown",
        "confidence": "exact_id",
        "score": 185,
        "matchReasons": [
          "exact ID match: sleeper_id, gsis_id",
          "normalized full name match",
          "position match",
          "team match"
        ],
        "conflictReasons": [],
        "candidateCount": 1,
        "preservedIds": {
          "blackbirdPlayerId": "522721fc-c89e-4eeb-b69f-45a9c8f0ba45",
          "sleeperId": "7547",
          "gsisId": "00-0036963",
          "espnId": "4374302",
          "pfrId": "StxxAm00",
          "nflId": "53541",
          "smartId": "32005354-4241-5291-a564-57e98d35161d"
        },
        "candidateExamples": [
          {
            "playerId": "00-0036963",
            "playerName": "Amon-Ra St. Brown",
            "position": "WR",
            "team": "DET",
            "score": 185,
            "reasons": [
              "exact ID match: sleeper_id, gsis_id",
              "normalized full name match",
              "position match",
              "team match"
            ]
          }
        ]
      },
      {
        "sourcePlayerId": "1704535f-e8b7-45ff-9d2c-80ce9b9d0c26",
        "sourcePlayerName": "Kyle Pitts",
        "sourcePosition": "TE",
        "sourceTeam": "ATL",
        "sourceStatus": null,
        "sourceActive": null,
        "sourceSearchRank": null,
        "sourceYearsExperience": null,
        "sourceCollege": null,
        "sourceAge": null,
        "sourceBirthDate": null,
        "sourceHeight": null,
        "sourceWeight": null,
        "matchedPlayerId": "00-0036970",
        "matchedPlayerName": "Kyle Pitts",
        "confidence": "exact_id",
        "score": 185,
        "matchReasons": [
          "exact ID match: sleeper_id, gsis_id",
          "normalized full name match",
          "position match",
          "team match"
        ],
        "conflictReasons": [],
        "candidateCount": 1,
        "preservedIds": {
          "blackbirdPlayerId": "1704535f-e8b7-45ff-9d2c-80ce9b9d0c26",
          "sleeperId": "7553",
          "gsisId": "00-0036970",
          "espnId": "4360248",
          "pfrId": "PittKy00",
          "nflId": "53433",
          "smartId": "32005049-5451-6805-5aec-d4afcbd52e25"
        },
        "candidateExamples": [
          {
            "playerId": "00-0036970",
            "playerName": "Kyle Pitts",
            "position": "TE",
            "team": "ATL",
            "score": 185,
            "reasons": [
              "exact ID match: sleeper_id, gsis_id",
              "normalized full name match",
              "position match",
              "team match"
            ]
          }
        ]
      },
      {
        "sourcePlayerId": "73084804-7000-479d-b952-2aaad5c0cc4b",
        "sourcePlayerName": "Trevor Lawrence",
        "sourcePosition": "QB",
        "sourceTeam": "JAX",
        "sourceStatus": null,
        "sourceActive": null,
        "sourceSearchRank": null,
        "sourceYearsExperience": null,
        "sourceCollege": null,
        "sourceAge": null,
        "sourceBirthDate": null,
        "sourceHeight": null,
        "sourceWeight": null,
        "matchedPlayerId": "00-0036971",
        "matchedPlayerName": "Trevor Lawrence",
        "confidence": "exact_id",
        "score": 185,
        "matchReasons": [
          "exact ID match: sleeper_id, gsis_id",
          "normalized full name match",
          "position match",
          "team match"
        ],
        "conflictReasons": [],
        "candidateCount": 1,
        "preservedIds": {
          "blackbirdPlayerId": "73084804-7000-479d-b952-2aaad5c0cc4b",
          "sleeperId": "7523",
          "gsisId": "00-0036971",
          "espnId": "4360310",
          "pfrId": "LawrTr00",
          "nflId": "53430",
          "smartId": "32004c41-5751-4099-56fc-f565c8d26c06"
        },
        "candidateExamples": [
          {
            "playerId": "00-0036971",
            "playerName": "Trevor Lawrence",
            "position": "QB",
            "team": "JAX",
            "score": 185,
            "reasons": [
              "exact ID match: sleeper_id, gsis_id",
              "normalized full name match",
              "position match",
              "team match"
            ]
          }
        ]
      },
      {
        "sourcePlayerId": "44b71fa4-11f8-43a3-8a48-17c541f8e741",
        "sourcePlayerName": "Travis Etienne",
        "sourcePosition": "RB",
        "sourceTeam": "NO",
        "sourceStatus": null,
        "sourceActive": null,
        "sourceSearchRank": null,
        "sourceYearsExperience": null,
        "sourceCollege": null,
        "sourceAge": null,
        "sourceBirthDate": null,
        "sourceHeight": null,
        "sourceWeight": null,
        "matchedPlayerId": "00-0036973",
        "matchedPlayerName": "Travis Etienne",
        "confidence": "exact_id",
        "score": 185,
        "matchReasons": [
          "exact ID match: sleeper_id, gsis_id",
          "normalized full name match",
          "position match",
          "team match"
        ],
        "conflictReasons": [],
        "candidateCount": 1,
        "preservedIds": {
          "blackbirdPlayerId": "44b71fa4-11f8-43a3-8a48-17c541f8e741",
          "sleeperId": "7543",
          "gsisId": "00-0036973",
          "espnId": "4239996",
          "pfrId": "EtieTr00",
          "nflId": "53454",
          "smartId": "32004554-4942-6541-8c54-a69299f0a040"
        },
        "candidateExamples": [
          {
            "playerId": "00-0036973",
            "playerName": "Travis Etienne",
            "position": "RB",
            "team": "NO",
            "score": 185,
            "reasons": [
              "exact ID match: sleeper_id, gsis_id",
              "normalized full name match",
              "position match",
              "team match"
            ]
          }
        ]
      },
      {
        "sourcePlayerId": "15a53aca-29f0-4589-a881-105c8206807f",
        "sourcePlayerName": "Jameson Williams",
        "sourcePosition": "WR",
        "sourceTeam": "DET",
        "sourceStatus": null,
        "sourceActive": null,
        "sourceSearchRank": null,
        "sourceYearsExperience": null,
        "sourceCollege": null,
        "sourceAge": null,
        "sourceBirthDate": null,
        "sourceHeight": null,
        "sourceWeight": null,
        "matchedPlayerId": "00-0037240",
        "matchedPlayerName": "Jameson Williams",
        "confidence": "exact_id",
        "score": 185,
        "matchReasons": [
          "exact ID match: sleeper_id, gsis_id",
          "normalized full name match",
          "position match",
          "team match"
        ],
        "conflictReasons": [],
        "candidateCount": 1,
        "preservedIds": {
          "blackbirdPlayerId": "15a53aca-29f0-4589-a881-105c8206807f",
          "sleeperId": "8148",
          "gsisId": "00-0037240",
          "espnId": "4426388",
          "pfrId": "WillJa11",
          "nflId": "54477",
          "smartId": "32005749-4c34-4909-bc5e-bde59d1a8826"
        },
        "candidateExamples": [
          {
            "playerId": "00-0037240",
            "playerName": "Jameson Williams",
            "position": "WR",
            "team": "DET",
            "score": 185,
            "reasons": [
              "exact ID match: sleeper_id, gsis_id",
              "normalized full name match",
              "position match",
              "team match"
            ]
          }
        ]
      },
      {
        "sourcePlayerId": "c856bff2-094a-4f08-9d9a-b0339ba0bf02",
        "sourcePlayerName": "Jalen Nailor",
        "sourcePosition": "WR",
        "sourceTeam": "LV",
        "sourceStatus": null,
        "sourceActive": null,
        "sourceSearchRank": null,
        "sourceYearsExperience": null,
        "sourceCollege": null,
        "sourceAge": null,
        "sourceBirthDate": null,
        "sourceHeight": null,
        "sourceWeight": null,
        "matchedPlayerId": "00-0037291",
        "matchedPlayerName": "Jalen Nailor",
        "confidence": "exact_id",
        "score": 185,
        "matchReasons": [
          "exact ID match: sleeper_id, gsis_id",
          "normalized full name match",
          "position match",
          "team match"
        ],
        "conflictReasons": [],
        "candidateCount": 1,
        "preservedIds": {
          "blackbirdPlayerId": "c856bff2-094a-4f08-9d9a-b0339ba0bf02",
          "sleeperId": "8180",
          "gsisId": "00-0037291",
          "espnId": "4382466",
          "pfrId": "NailJa00",
          "nflId": "54656",
          "smartId": "32004e41-4906-7484-dbfb-80032db5a1ba"
        },
        "candidateExamples": [
          {
            "playerId": "00-0037291",
            "playerName": "Jalen Nailor",
            "position": "WR",
            "team": "LV",
            "score": 185,
            "reasons": [
              "exact ID match: sleeper_id, gsis_id",
              "normalized full name match",
              "position match",
              "team match"
            ]
          }
        ]
      },
      {
        "sourcePlayerId": "0628e2bf-b1cd-4150-9a39-3393e0ff46d4",
        "sourcePlayerName": "George Pickens",
        "sourcePosition": "WR",
        "sourceTeam": "DAL",
        "sourceStatus": null,
        "sourceActive": null,
        "sourceSearchRank": null,
        "sourceYearsExperience": null,
        "sourceCollege": null,
        "sourceAge": null,
        "sourceBirthDate": null,
        "sourceHeight": null,
        "sourceWeight": null,
        "matchedPlayerId": "00-0037247",
        "matchedPlayerName": "George Pickens",
        "confidence": "exact_id",
        "score": 185,
        "matchReasons": [
          "exact ID match: sleeper_id, gsis_id",
          "normalized full name match",
          "position match",
          "team match"
        ],
        "conflictReasons": [],
        "candidateCount": 1,
        "preservedIds": {
          "blackbirdPlayerId": "0628e2bf-b1cd-4150-9a39-3393e0ff46d4",
          "sleeperId": "8137",
          "gsisId": "00-0037247",
          "espnId": "4426354",
          "pfrId": "PickGe00",
          "nflId": "54517",
          "smartId": "32005049-4357-6156-653f-e3c2b6d1b9bc"
        },
        "candidateExamples": [
          {
            "playerId": "00-0037247",
            "playerName": "George Pickens",
            "position": "WR",
            "team": "DAL",
            "score": 185,
            "reasons": [
              "exact ID match: sleeper_id, gsis_id",
              "normalized full name match",
              "position match",
              "team match"
            ]
          }
        ]
      },
      {
        "sourcePlayerId": "ed0d13a7-5376-4258-ae5e-0838d638123f",
        "sourcePlayerName": "Skyy Moore",
        "sourcePosition": "WR",
        "sourceTeam": "GB",
        "sourceStatus": null,
        "sourceActive": null,
        "sourceSearchRank": null,
        "sourceYearsExperience": null,
        "sourceCollege": null,
        "sourceAge": null,
        "sourceBirthDate": null,
        "sourceHeight": null,
        "sourceWeight": null,
        "matchedPlayerId": "00-0038090",
        "matchedPlayerName": "Skyy Moore",
        "confidence": "exact_id",
        "score": 185,
        "matchReasons": [
          "exact ID match: sleeper_id, gsis_id",
          "normalized full name match",
          "position match",
          "team match"
        ],
        "conflictReasons": [],
        "candidateCount": 1,
        "preservedIds": {
          "blackbirdPlayerId": "ed0d13a7-5376-4258-ae5e-0838d638123f",
          "sleeperId": "8168",
          "gsisId": "00-0038090",
          "espnId": "4430191",
          "pfrId": "MoorSk01",
          "nflId": "54519",
          "smartId": "32004d4f-4f67-8505-ee46-18aa406b13ff"
        },
        "candidateExamples": [
          {
            "playerId": "00-0038090",
            "playerName": "Skyy Moore",
            "position": "WR",
            "team": "GB",
            "score": 185,
            "reasons": [
              "exact ID match: sleeper_id, gsis_id",
              "normalized full name match",
              "position match",
              "team match"
            ]
          }
        ]
      },
      {
        "sourcePlayerId": "ad2bce1b-abcd-42e7-a89d-f1fdd418b64f",
        "sourcePlayerName": "Tyler Allgeier",
        "sourcePosition": "RB",
        "sourceTeam": "ARI",
        "sourceStatus": null,
        "sourceActive": null,
        "sourceSearchRank": null,
        "sourceYearsExperience": null,
        "sourceCollege": null,
        "sourceAge": null,
        "sourceBirthDate": null,
        "sourceHeight": null,
        "sourceWeight": null,
        "matchedPlayerId": "00-0037263",
        "matchedPlayerName": "Tyler Allgeier",
        "confidence": "exact_id",
        "score": 162,
        "matchReasons": [
          "exact ID match: sleeper_id, gsis_id",
          "normalized full name match",
          "position match",
          "team mismatch lowered confidence: ARI vs AZ"
        ],
        "conflictReasons": [],
        "candidateCount": 1,
        "preservedIds": {
          "blackbirdPlayerId": "ad2bce1b-abcd-42e7-a89d-f1fdd418b64f",
          "sleeperId": "8132",
          "gsisId": "00-0037263",
          "espnId": "4373626",
          "pfrId": "AllgTy00",
          "nflId": "54616",
          "smartId": "3200414c-4c70-2582-4cca-1a2070c9a090"
        },
        "candidateExamples": [
          {
            "playerId": "00-0037263",
            "playerName": "Tyler Allgeier",
            "position": "RB",
            "team": "AZ",
            "score": 162,
            "reasons": [
              "exact ID match: sleeper_id, gsis_id",
              "normalized full name match",
              "position match",
              "team mismatch lowered confidence: ARI vs AZ"
            ]
          }
        ]
      },
      {
        "sourcePlayerId": "edb64cc9-bd37-4095-931d-03d6b7db4c5b",
        "sourcePlayerName": "Jaret Patterson",
        "sourcePosition": "RB",
        "sourceTeam": "LAC",
        "sourceStatus": null,
        "sourceActive": null,
        "sourceSearchRank": null,
        "sourceYearsExperience": null,
        "sourceCollege": null,
        "sourceAge": null,
        "sourceBirthDate": null,
        "sourceHeight": null,
        "sourceWeight": null,
        "matchedPlayerId": "00-0036755",
        "matchedPlayerName": "Jaret Patterson",
        "confidence": "exact_id",
        "score": 185,
        "matchReasons": [
          "exact ID match: sleeper_id, gsis_id",
          "normalized full name match",
          "position match",
          "team match"
        ],
        "conflictReasons": [],
        "candidateCount": 1,
        "preservedIds": {
          "blackbirdPlayerId": "edb64cc9-bd37-4095-931d-03d6b7db4c5b",
          "sleeperId": "7537",
          "gsisId": "00-0036755",
          "espnId": "4362452",
          "pfrId": "PattJa01",
          "nflId": "53960",
          "smartId": "32005041-5445-6375-4c14-9b0e9f7438ee"
        },
        "candidateExamples": [
          {
            "playerId": "00-0036755",
            "playerName": "Jaret Patterson",
            "position": "RB",
            "team": "LAC",
            "score": 185,
            "reasons": [
              "exact ID match: sleeper_id, gsis_id",
              "normalized full name match",
              "position match",
              "team match"
            ]
          }
        ]
      },
      {
        "sourcePlayerId": "304c3fa3-4433-4760-978e-95c32414fb24",
        "sourcePlayerName": "Zach Wilson",
        "sourcePosition": "QB",
        "sourceTeam": "NO",
        "sourceStatus": null,
        "sourceActive": null,
        "sourceSearchRank": null,
        "sourceYearsExperience": null,
        "sourceCollege": null,
        "sourceAge": null,
        "sourceBirthDate": null,
        "sourceHeight": null,
        "sourceWeight": null,
        "matchedPlayerId": "00-0037013",
        "matchedPlayerName": "Zach Wilson",
        "confidence": "exact_id",
        "score": 185,
        "matchReasons": [
          "exact ID match: sleeper_id, gsis_id",
          "normalized full name match",
          "position match",
          "team match"
        ],
        "conflictReasons": [],
        "candidateCount": 1,
        "preservedIds": {
          "blackbirdPlayerId": "304c3fa3-4433-4760-978e-95c32414fb24",
          "sleeperId": "7538",
          "gsisId": "00-0037013",
          "espnId": "4361259",
          "pfrId": "WilsZa00",
          "nflId": "53431",
          "smartId": "32005749-4c82-7119-d27e-724ec33f130b"
        },
        "candidateExamples": [
          {
            "playerId": "00-0037013",
            "playerName": "Zach Wilson",
            "position": "QB",
            "team": "NO",
            "score": 185,
            "reasons": [
              "exact ID match: sleeper_id, gsis_id",
              "normalized full name match",
              "position match",
              "team match"
            ]
          }
        ]
      },
      {
        "sourcePlayerId": "351026cc-5e38-4b4b-915a-2265a5d03e44",
        "sourcePlayerName": "Brian Robinson",
        "sourcePosition": "RB",
        "sourceTeam": "ATL",
        "sourceStatus": null,
        "sourceActive": null,
        "sourceSearchRank": null,
        "sourceYearsExperience": null,
        "sourceCollege": null,
        "sourceAge": null,
        "sourceBirthDate": null,
        "sourceHeight": null,
        "sourceWeight": null,
        "matchedPlayerId": "00-0037746",
        "matchedPlayerName": "Brian Robinson",
        "confidence": "exact_id",
        "score": 185,
        "matchReasons": [
          "exact ID match: sleeper_id, gsis_id",
          "normalized full name match",
          "position match",
          "team match"
        ],
        "conflictReasons": [],
        "candidateCount": 1,
        "preservedIds": {
          "blackbirdPlayerId": "351026cc-5e38-4b4b-915a-2265a5d03e44",
          "sleeperId": "8154",
          "gsisId": "00-0037746",
          "espnId": "4241474",
          "pfrId": "RobiBr01",
          "nflId": "54563",
          "smartId": "3200524f-4273-6177-6c0d-d79eb9d007d1"
        },
        "candidateExamples": [
          {
            "playerId": "00-0037746",
            "playerName": "Brian Robinson",
            "position": "RB",
            "team": "ATL",
            "score": 185,
            "reasons": [
              "exact ID match: sleeper_id, gsis_id",
              "normalized full name match",
              "position match",
              "team match"
            ]
          }
        ]
      },
      {
        "sourcePlayerId": "a11903aa-1c14-4424-9300-fc8692619c3e",
        "sourcePlayerName": "Chig Okonkwo",
        "sourcePosition": "TE",
        "sourceTeam": "WAS",
        "sourceStatus": null,
        "sourceActive": null,
        "sourceSearchRank": null,
        "sourceYearsExperience": null,
        "sourceCollege": null,
        "sourceAge": null,
        "sourceBirthDate": null,
        "sourceHeight": null,
        "sourceWeight": null,
        "matchedPlayerId": "00-0037809",
        "matchedPlayerName": "Chig Okonkwo",
        "confidence": "exact_id",
        "score": 185,
        "matchReasons": [
          "exact ID match: sleeper_id, gsis_id",
          "normalized full name match",
          "position match",
          "team match"
        ],
        "conflictReasons": [],
        "candidateCount": 1,
        "preservedIds": {
          "blackbirdPlayerId": "a11903aa-1c14-4424-9300-fc8692619c3e",
          "sleeperId": "8210",
          "gsisId": "00-0037809",
          "espnId": "4360635",
          "pfrId": "OkonCh00",
          "nflId": "54608",
          "smartId": "32004f4b-4f28-3611-fc64-d952b8d6cb17"
        },
        "candidateExamples": [
          {
            "playerId": "00-0037809",
            "playerName": "Chig Okonkwo",
            "position": "TE",
            "team": "WAS",
            "score": 185,
            "reasons": [
              "exact ID match: sleeper_id, gsis_id",
              "normalized full name match",
              "position match",
              "team match"
            ]
          }
        ]
      },
      {
        "sourcePlayerId": "ecf230d0-7b18-4a51-ae6a-5c25bd42da1e",
        "sourcePlayerName": "Kyren Williams",
        "sourcePosition": "RB",
        "sourceTeam": "LAR",
        "sourceStatus": null,
        "sourceActive": null,
        "sourceSearchRank": null,
        "sourceYearsExperience": null,
        "sourceCollege": null,
        "sourceAge": null,
        "sourceBirthDate": null,
        "sourceHeight": null,
        "sourceWeight": null,
        "matchedPlayerId": "00-0037840",
        "matchedPlayerName": "Kyren Williams",
        "confidence": "exact_id",
        "score": 162,
        "matchReasons": [
          "exact ID match: sleeper_id, gsis_id",
          "normalized full name match",
          "position match",
          "team mismatch lowered confidence: LAR vs LA"
        ],
        "conflictReasons": [],
        "candidateCount": 1,
        "preservedIds": {
          "blackbirdPlayerId": "ecf230d0-7b18-4a51-ae6a-5c25bd42da1e",
          "sleeperId": "8150",
          "gsisId": "00-0037840",
          "espnId": "4430737",
          "pfrId": "WillKy02",
          "nflId": "54629",
          "smartId": "32005749-4c41-5359-809b-caeaa1db84d0"
        },
        "candidateExamples": [
          {
            "playerId": "00-0037840",
            "playerName": "Kyren Williams",
            "position": "RB",
            "team": "LA",
            "score": 162,
            "reasons": [
              "exact ID match: sleeper_id, gsis_id",
              "normalized full name match",
              "position match",
              "team mismatch lowered confidence: LAR vs LA"
            ]
          }
        ]
      },
      {
        "sourcePlayerId": "023cfa29-696b-46f6-9
```
