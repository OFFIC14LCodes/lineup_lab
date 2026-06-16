# h9-value-comparisons

```json
{
  "kind": "h9-value-comparisons",
  "dataMode": "real_room",
  "draftRoomId": "f85238ff-b2ee-4053-8493-e38c4cb63bd3",
  "activeProjectionRun": "e4cab3af-e6fa-45bf-b7f2-ee0e428f7ab2",
  "generatedAt": "2026-06-16T15:54:04.732Z",
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
    "adpRowsAudited": 0,
    "topAdpReferenceOnly": []
  },
  "totals": {
    "rankedPlayers": 1293,
    "draftSuggestions": 1054,
    "boardRows": 1293,
    "sameScoreCount": 1076,
    "nearTieClusters": 100
  },
  "sameScoreAnalysis": {
    "samePositionTieGroupCount": 30,
    "explainableSamePositionTieGroups": [
      {
        "position": "LB",
        "score": "27.4",
        "count": 13,
        "explainable": true,
        "reason": "source data gap: fallback projections with low trust and similar role proxy",
        "sample": [
          {
            "blackbirdRank": 97,
            "playerId": "dcfbb708-ff31-4649-8306-361ae3081534",
            "playerName": "Aiden Fisher",
            "position": "LB",
            "projection": 126.9,
            "par": 0,
            "staticValue": 27.41,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 46.1 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 98,
            "playerId": "87e17028-1754-4b40-b745-17e101075301",
            "playerName": "David Bailey",
            "position": "LB",
            "projection": 126.9,
            "par": 0,
            "staticValue": 27.41,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 46.1 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 99,
            "playerId": "3a18248c-45f3-4205-865a-e57252977bfd",
            "playerName": "Jaden Dugger",
            "position": "LB",
            "projection": 126.9,
            "par": 0,
            "staticValue": 27.41,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 46.1 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 100,
            "playerId": "874e2b88-90ef-47af-84f9-bbd154e3a900",
            "playerName": "Jaishawn Barham",
            "position": "LB",
            "projection": 126.9,
            "par": 0,
            "staticValue": 27.41,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 46.1 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 101,
            "playerId": "0291c28b-73e2-47cb-8a75-cb39883393a0",
            "playerName": "Jimmy Rolder",
            "position": "LB",
            "projection": 126.9,
            "par": 0,
            "staticValue": 27.41,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 46.1 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 102,
            "playerId": "4705ef6f-1483-4b29-94a0-3786feccb038",
            "playerName": "Kaleb Elarms-Orr",
            "position": "LB",
            "projection": 126.9,
            "par": 0,
            "staticValue": 27.41,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 46.1 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 103,
            "playerId": "472c2a8a-2f29-4c46-ba6e-d396b3e9dd19",
            "playerName": "Keyshaun Elliott",
            "position": "LB",
            "projection": 126.9,
            "par": 0,
            "staticValue": 27.41,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 46.1 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 104,
            "playerId": "43b3b6be-cb6d-4595-8079-c41acbaa9086",
            "playerName": "Khalil Jacobs",
            "position": "LB",
            "projection": 126.9,
            "par": 0,
            "staticValue": 27.41,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 46.1 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          }
        ]
      },
      {
        "position": "LB",
        "score": "27.3",
        "count": 18,
        "explainable": true,
        "reason": "source data gap: fallback projections with low trust and similar role proxy",
        "sample": [
          {
            "blackbirdRank": 110,
            "playerId": "4278188e-6afa-4a35-85a1-85f42ebacf98",
            "playerName": "Bryce Boettcher",
            "position": "LB",
            "projection": 126.9,
            "par": 0,
            "staticValue": 27.31,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 46.1 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 111,
            "playerId": "90ab5051-605d-4c00-9934-ccc01df2f307",
            "playerName": "Dasan McCullough",
            "position": "LB",
            "projection": 126.9,
            "par": 0,
            "staticValue": 27.31,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 46.1 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 112,
            "playerId": "04326bf2-b123-42de-a0d7-397b8faac232",
            "playerName": "Deontae Lawson",
            "position": "LB",
            "projection": 126.9,
            "par": 0,
            "staticValue": 27.31,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 46.1 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 113,
            "playerId": "257cc8f7-8b13-48b6-a527-22af36aaa5b1",
            "playerName": "Eric Gentry",
            "position": "LB",
            "projection": 126.9,
            "par": 0,
            "staticValue": 27.31,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 46.1 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 114,
            "playerId": "245f2d9b-da32-48f8-a0a7-8f04b8e5f541",
            "playerName": "Erick Hunter",
            "position": "LB",
            "projection": 126.9,
            "par": 0,
            "staticValue": 27.31,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 46.1 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 115,
            "playerId": "1ca247fa-b1b6-4b92-8859-0e0bc5527112",
            "playerName": "Jack Dingle",
            "position": "LB",
            "projection": 126.9,
            "par": 0,
            "staticValue": 27.31,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 46.1 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 116,
            "playerId": "b3c28340-e7a5-4b01-9574-aed41b96ebc8",
            "playerName": "Jack Kelly",
            "position": "LB",
            "projection": 126.9,
            "par": 0,
            "staticValue": 27.31,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 46.1 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 117,
            "playerId": "e2b4c9c2-1dc2-4b25-99c8-134bc48b8e61",
            "playerName": "Jackson Kuwatch",
            "position": "LB",
            "projection": 126.9,
            "par": 0,
            "staticValue": 27.31,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 46.1 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          }
        ]
      },
      {
        "position": "DB",
        "score": "26.8",
        "count": 16,
        "explainable": true,
        "reason": "source data gap: fallback projections with low trust and similar role proxy",
        "sample": [
          {
            "blackbirdRank": 136,
            "playerId": "c23a8ad5-db6a-4b70-ae67-554ed1e15e1e",
            "playerName": "Avieon Terrell",
            "position": "DB",
            "projection": 97.3,
            "par": 0,
            "staticValue": 26.81,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 44.3 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 137,
            "playerId": "549c9e3a-6ac2-4c48-b4db-e365db2ea2e3",
            "playerName": "Caleb Downs",
            "position": "DB",
            "projection": 97.3,
            "par": 0,
            "staticValue": 26.81,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 44.3 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 138,
            "playerId": "d1e876bd-9b24-4193-bb2d-b349f587b876",
            "playerName": "Chris Johnson",
            "position": "DB",
            "projection": 97.3,
            "par": 0,
            "staticValue": 26.81,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 44.3 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 139,
            "playerId": "dd9dc0f0-0c88-480b-81dd-06d138b62b3e",
            "playerName": "Colton Hood",
            "position": "DB",
            "projection": 97.3,
            "par": 0,
            "staticValue": 26.81,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 44.3 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 140,
            "playerId": "8a66738d-2eb8-4187-a5a1-a8aee12d0189",
            "playerName": "D'Angelo Ponds",
            "position": "DB",
            "projection": 97.3,
            "par": 0,
            "staticValue": 26.81,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 44.3 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 141,
            "playerId": "390ed485-cc75-4f10-a865-a04e6d7fb2c5",
            "playerName": "Devon Marshall",
            "position": "DB",
            "projection": 97.3,
            "par": 0,
            "staticValue": 26.81,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 44.3 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 142,
            "playerId": "2579d00d-f3b5-469f-9790-9f4f71144d99",
            "playerName": "Dillon Thieneman",
            "position": "DB",
            "projection": 97.3,
            "par": 0,
            "staticValue": 26.81,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 44.3 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 143,
            "playerId": "874a4f51-a24c-4f98-970a-ca46208b4a64",
            "playerName": "Genesis Smith",
            "position": "DB",
            "projection": 97.3,
            "par": 0,
            "staticValue": 26.81,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 44.3 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          }
        ]
      },
      {
        "position": "DB",
        "score": "26.7",
        "count": 19,
        "explainable": true,
        "reason": "source data gap: fallback projections with low trust and similar role proxy",
        "sample": [
          {
            "blackbirdRank": 153,
            "playerId": "f3e0a6e8-9820-4d45-b98f-48d02170bfa2",
            "playerName": "AJ Haulcy",
            "position": "DB",
            "projection": 97.3,
            "par": 0,
            "staticValue": 26.71,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 44.3 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 154,
            "playerId": "1e496684-662c-45ee-acd3-15b95583d9e7",
            "playerName": "Austin Brown",
            "position": "DB",
            "projection": 97.3,
            "par": 0,
            "staticValue": 26.71,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 44.3 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 155,
            "playerId": "459fab97-e945-42bd-93cf-3125510c89b1",
            "playerName": "Avery Smith",
            "position": "DB",
            "projection": 97.3,
            "par": 0,
            "staticValue": 26.71,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 44.3 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 156,
            "playerId": "c69823b4-9c06-48b9-b227-80804211555f",
            "playerName": "Chandler Rivers",
            "position": "DB",
            "projection": 97.3,
            "par": 0,
            "staticValue": 26.71,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 44.3 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 157,
            "playerId": "fb687fbc-d1f0-4516-a6a3-32a5a0de48de",
            "playerName": "Davison Igbinosun",
            "position": "DB",
            "projection": 97.3,
            "par": 0,
            "staticValue": 26.71,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 44.3 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 158,
            "playerId": "47403c11-460b-401b-a6a8-db6524f1fc64",
            "playerName": "Daylen Everette",
            "position": "DB",
            "projection": 97.3,
            "par": 0,
            "staticValue": 26.71,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 44.3 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 159,
            "playerId": "c544de38-97e8-4cdf-9c5f-fe01cf1a0a82",
            "playerName": "Devin Moore",
            "position": "DB",
            "projection": 97.3,
            "par": 0,
            "staticValue": 26.71,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 44.3 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 160,
            "playerId": "ebe5e7af-fa53-4227-95a2-7a5dfc6e7d81",
            "playerName": "Emmanuel McNeil-Warren",
            "position": "DB",
            "projection": 97.3,
            "par": 0,
            "staticValue": 26.71,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 44.3 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          }
        ]
      },
      {
        "position": "DB",
        "score": "26.6",
        "count": 20,
        "explainable": true,
        "reason": "source data gap: fallback projections with low trust and similar role proxy",
        "sample": [
          {
            "blackbirdRank": 173,
            "playerId": "19d82e9d-0f33-4652-82fb-6df1ee0b018d",
            "playerName": "Ceyair Wright",
            "position": "DB",
            "projection": 97.3,
            "par": 0,
            "staticValue": 26.61,
            "trust": "very_low",
            "role": "rookie_unknown",
            "fallback": true,
            "reasons": [
              "Projection median contributes 44.3 component points.",
              "Dynasty age curve is included.",
              "Best ball format gives additional weight to ceiling shape."
            ],
            "cautions": [
              "Fallback projection limits confidence.",
              "Projection trust is very low.",
              "Role is rookie unknown by projection-volume proxy."
            ]
          },
          {
            "blackbirdRank": 174,
            "playerId": "cbaeacd2-c0aa-4a5e-90d8-a1b0b43865b9",
            "p
```
