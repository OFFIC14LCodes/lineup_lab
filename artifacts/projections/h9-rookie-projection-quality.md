# h9-rookie-projection-quality

```json
{
  "kind": "rookie-projection-quality",
  "generatedAt": "2026-06-16T19:07:54.648Z",
  "verdict": "passed",
  "failureReasons": [],
  "warnings": [
    "5126 fallback projection rows have explicit data gaps",
    "missing projected stats for supported scoring keys are reported",
    "unsupported scoring keys are reported",
    "rookie uncertainty is visible as data gaps"
  ],
  "checks": {
    "projectionUnitLabels": "season",
    "noAdpFallback": true,
    "noDraftStateMutation": true,
    "noRecommendationPersistence": true,
    "missingStatsAreDataGaps": true,
    "boardDetailProjectionFoundation": "player_projection_outputs persisted by comprehensive run when --persist is used",
    "livePlanUsesProjectionFoundation": "War Room state reads latest persisted player_projection_outputs for board, suggestions, and plan fit"
  },
  "counts": {
    "inputPlayers": 7266,
    "projectedPlayers": 7266,
    "projectedPlayersWithStats": 2140,
    "projectedRookies": 702,
    "fallbackProjectionCount": 5126,
    "scoredFantasyOutputs": 27820,
    "leagueCount": 13
  },
  "distributions": {
    "positions": {
      "K": 153,
      "DL": 1358,
      "QB": 354,
      "TE": 601,
      "DB": 1680,
      "WR": 1296,
      "RB": 706,
      "LB": 1086,
      "DEF": 32
    },
    "confidence": {
      "low": 1438,
      "very_low": 5828
    },
    "rookieConfidence": {
      "very_low": 702
    },
    "scoredByPosition": {
      "K": 676,
      "QB": 1482,
      "TE": 2561,
      "DL": 5434,
      "LB": 3627,
      "DB": 6513,
      "RB": 2717,
      "WR": 4810
    },
    "scoredByLeague": {
      "566b01f1-28df-48f2-ac3d-2ecaf0eeb09e": 2140,
      "bb695a41-86ad-4a9c-9948-95604c5cfa41": 2140,
      "fde3c4a0-3cb6-4fac-890d-b43c5c2f0c1a": 2140,
      "b329b0f4-9e4a-4f3d-9e8a-ee8482be0138": 2140,
      "64a3d6af-449f-41c5-a1f9-5a3918bfc8e9": 2140,
      "c8b07cf4-7062-4cb7-8340-3b7dc431a575": 2140,
      "5a828edf-c69f-4ae6-93fc-c97a453e62c7": 2140,
      "4b06eb95-c193-41a0-857a-c9059b327891": 2140,
      "8d83d1ce-d9e5-4921-8e51-97c5d96a3700": 2140,
      "9574e197-b403-4798-9f89-15832da09d15": 2140,
      "8d1a3d47-0b1d-494c-bdab-1590fa630d7d": 2140,
      "da459ccd-6144-47ee-9453-735b39c62f65": 2140,
      "95c929b9-cc55-411e-8493-06fd85308c1c": 2140
    }
  },
  "coverage": {
    "statCoverageByPosition": {
      "QB": {
        "pass_att": 114,
        "pass_cmp": 114,
        "pass_yd": 114,
        "pass_td": 114,
        "pass_int": 114,
        "rush_att": 114,
        "rush_yd": 114,
        "rush_td": 114,
        "fum_lost": 114,
        "pass_fd": 81,
        "rush_fd": 81,
        "two_pt": 81,
        "rec": 81,
        "rec_fd": 81,
        "rec_td": 81,
        "rec_yd": 81,
        "target": 81,
        "pass_sack": 81,
        "ypc": 111,
        "cmp_pct": 109,
        "ypr": 8,
        "fum": 33
      },
      "RB": {
        "rush_att": 209,
        "rush_yd": 209,
        "rush_td": 209,
        "target": 209,
        "rec": 209,
        "rec_yd": 209,
        "rec_td": 209,
        "fum_lost": 209,
        "rush_fd": 147,
        "rec_fd": 147,
        "two_pt": 147,
        "pass_fd": 147,
        "pass_td": 147,
        "pass_yd": 147,
        "pass_att": 147,
        "pass_cmp": 147,
        "pass_int": 147,
        "pass_sack": 147,
        "ypc": 197,
        "ypr": 175,
        "cmp_pct": 6,
        "fum": 62
      },
      "WR": {
        "target": 370,
        "rec": 370,
        "rec_yd": 370,
        "rec_td": 370,
        "rush_att": 370,
        "rush_yd": 370,
        "rush_td": 370,
        "fum_lost": 370,
        "rec_fd": 232,
        "two_pt": 232,
        "pass_fd": 232,
        "pass_td": 232,
        "pass_yd": 232,
        "rush_fd": 232,
        "pass_att": 232,
        "pass_cmp": 232,
        "pass_int": 232,
        "pass_sack": 232,
        "ypr": 346,
        "ypc": 216,
        "cmp_pct": 4,
        "fum": 138
      },
      "TE": {
        "target": 197,
        "rec": 197,
        "rec_yd": 197,
        "rec_td": 197,
        "fum_lost": 197,
        "rec_fd": 131,
        "two_pt": 131,
        "pass_fd": 131,
        "pass_td": 131,
        "pass_yd": 131,
        "rush_fd": 131,
        "rush_td": 131,
        "rush_yd": 131,
        "pass_att": 131,
        "pass_cmp": 131,
        "pass_int": 131,
        "rush_att": 131,
        "pass_sack": 131,
        "ypr": 184,
        "ypc": 22,
        "cmp_pct": 3,
        "fum": 66
      },
      "K": {
        "pat_att": 52,
        "pat_made": 52,
        "fg_att": 52,
        "fg_made": 52,
        "fgm_0_19": 38,
        "fgm_20_29": 38,
        "fgm_30_39": 38,
        "fgm_40_49": 38,
        "fgm_50p": 38,
        "fgmiss": 38,
        "xpmiss": 38,
        "fg_long": 38,
        "fgm_60p": 38,
        "fgm_50_59": 38,
        "fg_blocked": 38,
        "fgmiss_50p": 38,
        "fgmiss_60p": 38,
        "xp_blocked": 38,
        "fgmiss_0_19": 38,
        "fgmiss_20_29": 38,
        "fgmiss_30_39": 38,
        "fgmiss_40_49": 38,
        "fgmiss_50_59": 38,
        "fg_pct": 52,
        "pat_pct": 52,
        "fg_miss": 14
      },
      "DEF": {},
      "DL": {
        "solo_tkl": 418,
        "ast_tkl": 418,
        "total_tkl": 418,
        "sack": 418,
        "qb_hit": 418,
        "ff": 418,
        "fr": 418,
        "pass_def": 418,
        "def_td": 269,
        "def_int": 269,
        "safety": 269,
        "fr_td": 269,
        "fr_opp": 269,
        "fr_own": 269,
        "sack_yd": 269,
        "tkl_loss": 269,
        "fr_opp_yd": 269,
        "fr_own_yd": 269,
        "fr_ret_yd": 269,
        "int_ret_yd": 269,
        "tkl_loss_yd": 269,
        "tfl": 149
      },
      "LB": {
        "solo_tkl": 279,
        "ast_tkl": 279,
        "total_tkl": 279,
        "sack": 279,
        "qb_hit": 279,
        "ff": 279,
        "fr": 194,
        "pass_def": 279,
        "def_int": 279,
        "def_td": 194,
        "safety": 194,
        "fr_td": 194,
        "fr_opp": 194,
        "fr_own": 194,
        "sack_yd": 194,
        "tkl_loss": 194,
        "fr_opp_yd": 194,
        "fr_own_yd": 194,
        "fr_ret_yd": 194,
        "int_ret_yd": 194,
        "tkl_loss_yd": 194,
        "tfl": 85
      },
      "DB": {
        "solo_tkl": 501,
        "ast_tkl": 501,
        "total_tkl": 501,
        "pass_def": 501,
        "def_int": 501,
        "sack": 501,
        "ff": 501,
        "fr": 346,
        "def_td": 346,
        "safety": 346,
        "fr_td": 346,
        "fr_opp": 346,
        "fr_own": 346,
        "qb_hit": 346,
        "sack_yd": 346,
        "tkl_loss": 346,
        "fr_opp_yd": 346,
        "fr_own_yd": 346,
        "fr_ret_yd": 346,
        "int_ret_yd": 346,
        "tkl_loss_yd": 346,
        "tfl": 155
      }
    },
    "unsupportedScoringKeys": [
      "bonus_def_fum_td_50p",
      "bonus_def_int_td_50p",
      "bonus_tkl_10p",
      "def_st_ff",
      "def_st_fum_rec",
      "idp_pass_def_3p",
      "idp_sack_yd",
      "kr_yd",
      "pr_yd",
      "st_ff",
      "st_fum_rec",
      "yds_allow_100_199"
    ],
    "missingProjectedStats": {
      "rec_2pt:rec_2pt": 11570,
      "rush_2pt:rush_2pt": 11570,
      "blk_kick:blk_kick": 9584,
      "def_st_td:def_st_td": 8386,
      "fum_rec_td:fum_rec_td": 8010,
      "rush_td_50p:rush_td_50p": 7120,
      "fum_rec:fum_rec": 6230,
      "rec_td_50p:rec_td_50p": 6230,
      "rec_td_40p:rec_td_40p": 4450,
      "rush_td_40p:rush_td_40p": 4450,
      "def_td:def_td": 2723,
      "safe:safe": 2723,
      "rec_fd:rec_fd": 1794,
      "rush_fd:rush_fd": 1794,
      "rec_40p:rec_40p": 1780,
      "pass_2pt:pass_2pt": 1482,
      "bonus_sack_2p:bonus_sack_2p": 1198,
      "fum:fum": 1182,
      "bonus_fd_wr:rec_fd": 1104,
      "int:int": 1043,
      "pass_int_td:pass_pick6": 912,
      "rec_20_29:rec_20_29": 890,
      "rec_30_39:rec_30_39": 890,
      "rush_40p:rush_40p": 890,
      "rush_td:rush_td": 858,
      "rush_yd:rush_yd": 858,
      "pass_td_50p:pass_td_50p": 798,
      "bonus_fd_te:rec_fd": 528,
      "bonus_rush_yd_200:rush_yd": 528,
      "bonus_fd_rb:rec_fd": 496,
      "bonus_fd_rb:rush_fd": 496,
      "fr:fr": 480,
      "rush_att:rush_att": 462,
      "rec_td:rec_td": 429,
      "rec_yd:rec_yd": 429,
      "rec:rec": 429,
      "fr_ret_yd:fr_ret_yd": 389,
      "int_ret_yd:int_ret_yd": 389,
      "pass_td_40p:pass_td_40p": 342,
      "bonus_rush_att_20:rush_att": 330,
      "bonus_rush_yd_100:rush_yd": 330,
      "qb_hit:qb_hit": 310,
      "bonus_rec_yd_200:rec_yd": 231,
      "bonus_rec_yd_100:rec_yd": 165,
      "bonus_fd_qb:pass_fd": 132,
      "fgm_0_19:fgm_0_19": 126,
      "fgm_20_29:fgm_20_29": 126,
      "fgm_30_39:fgm_30_39": 126,
      "fgm_40_49:fgm_40_49": 126,
      "xpmiss:xpmiss": 126
    },
    "floorMedianCeilingFailures": 0
  },
  "persistence": {
    "persistence": null,
    "persistenceInspection": null
  },
  "samples": {
    "byPosition": {
      "K": {
        "playerId": "9c149379-df06-4e2d-b734-3fee91327ead",
        "playerName": "Graham Gano",
        "projectionType": "veteran",
        "confidence": "low",
        "dataGaps": [
          "limited historical seasons"
        ],
        "medianStats": {
          "pat_att": 9,
          "pat_made": 9,
          "fg_att": 10,
          "fg_made": 9,
          "fgm_0_19": 0,
          "fgm_20_29": 3,
          "fgm_30_39": 4,
          "fgm_40_49": 1,
          "fgm_50p": 1,
          "fgmiss": 1,
          "xpmiss": 0,
          "fg_long": 187
        }
      },
      "DL": {
        "playerId": "5a37db66-ecb7-4e44-80db-7eab57e9ebe8",
        "playerName": "Brandon Mebane",
        "projectionType": "fallback",
        "confidence": "very_low",
        "dataGaps": [
          "missing historical stats",
          "missing rookie projection inputs"
        ],
        "medianStats": {}
      },
      "QB": {
        "playerId": "07021f93-ee96-4638-b026-2c5c4c33426d",
        "playerName": "Joe Flacco",
        "projectionType": "veteran",
        "confidence": "low",
        "dataGaps": [
          "limited historical seasons"
        ],
        "medianStats": {
          "pass_att": 416,
          "pass_cmp": 251,
          "pass_yd": 2479,
          "pass_td": 13.5,
          "pass_int": 10,
          "rush_att": 21,
          "rush_yd": 35,
          "rush_td": 0.9,
          "fum_lost": 3,
          "pass_fd": 115,
          "rush_fd": 9,
          "two_pt": 1.1
        }
      },
      "TE": {
        "playerId": "e8bbb98c-72c3-4504-963b-47f1229a5088",
        "playerName": "Jason Witten",
        "projectionType": "fallback",
        "confidence": "very_low",
        "dataGaps": [
          "missing historical stats",
          "missing rookie projection inputs"
        ],
        "medianStats": {}
      },
      "DB": {
        "playerId": "20f81da9-d8d9-4151-b85b-aca7cde29b2c",
        "playerName": "Mike Adams",
        "projectionType": "fallback",
        "confidence": "very_low",
        "dataGaps": [
          "missing historical stats",
          "missing rookie projection inputs"
        ],
        "medianStats": {}
      },
      "WR": {
        "playerId": "2a7b5329-4baf-45e0-9a52-e6a4b418fd1a",
        "playerName": "DeSean Jackson",
        "projectionType": "fallback",
        "confidence": "very_low",
        "dataGaps": [
          "missing historical stats",
          "missing rookie projection inputs"
        ],
        "medianStats": {}
      },
      "RB": {
        "playerId": "6b8a6a1d-2238-45e4-907a-b338f4fa5f09",
        "playerName": "Adrian Peterson",
        "projectionType": "fallback",
        "confidence": "very_low",
        "dataGaps": [
          "missing historical stats",
          "missing rookie projection inputs"
        ],
        "medianStats": {}
      },
      "LB": {
        "playerId": "fa8b0d58-241a-48cb-806f-3024913605c3",
        "playerName": "Thomas Davis",
        "projectionType": "fallback",
        "confidence": "very_low",
        "dataGaps": [
          "missing historical stats",
          "missing rookie projection inputs"
        ],
        "medianStats": {}
      },
      "DEF": {
        "playerId": "aea8be45-11fa-4ef4-b3e8-ec7e9380e8bf",
        "playerName": "New Orleans Saints",
        "projectionType": "fallback",
        "confidence": "very_low",
        "dataGaps": [
          "missing historical stats",
          "missing rookie projection inputs"
        ],
        "medianStats": {}
      }
    },
    "rookiesByPosition": {
      "DB": {
        "playerId": "b055b8d6-500e-4818-bea2-23f66c7cd3ac",
        "playerName": "Ayden Garnes",
        "projectionType": "rookie",
        "confidence": "very_low",
        "dataGaps": [
          "NFL draft capital",
          "college production",
          "landing spot role",
          "missing NFL draft capital",
          "missing college production profile",
          "rookie role uncertainty"
        ],
        "medianStats": {
          "solo_tkl": 22.5,
          "ast_tkl": 11,
          "total_tkl": 33.5,
          "pass_def": 2.5,
          "def_int": 0.6,
          "sack": 0.2,
          "tfl": 1,
          "ff": 0.4
        }
      },
      "WR": {
        "playerId": "a163e09e-4831-4602-bda3-1ef59edd74c1",
        "playerName": "Cameron Dorner",
        "projectionType": "rookie",
        "confidence": "very_low",
        "dataGaps": [
          "NFL draft capital",
          "college production",
          "landing spot role",
          "missing NFL draft capital",
          "missing college production profile",
          "rookie role uncertainty"
        ],
        "medianStats": {
          "target": 37.4,
          "rec": 22.4,
          "rec_yd": 283.4,
          "rec_td": 1.6,
          "rush_att": 1.6,
          "rush_yd": 9.4,
          "rush_td": 0.1,
          "fum": 0.5,
          "fum_lost": 0.2,
          "ypc": 5.9,
          "ypr": 12.7
        }
      },
      "LB": {
        "playerId": "92715814-e9ca-44f9-b389-658c678b4f8e",
        "playerName": "Andrew Jones",
        "projectionType": "rookie",
        "confidence": "very_low",
        "dataGaps": [
          "NFL draft capital",
          "college production",
          "landing spot role",
          "missing NFL draft capital",
          "missing college production profile",
          "rookie role uncertainty",
          "team assignment"
        ],
        "medianStats": {
          "solo_tkl": 27.5,
          "ast_tkl": 16,
          "total_tkl": 43.5,
          "tfl": 2.5,
          "sack": 1.2,
          "qb_hit": 2.5,
          "pass_def": 1.5,
          "def_int": 0.2,
          "ff": 0.5
        }
      },
      "RB": {
        "playerId": "fb05090b-fa0d-4083-884a-2cc9cc6baa0c",
        "playerName": "Myles Montgomery",
        "projectionType": "rookie",
        "confidence": "very_low",
        "dataGaps": [
          "NFL draft capital",
          "college production",
          "landing spot role",
          "missing NFL draft capital",
    
```
