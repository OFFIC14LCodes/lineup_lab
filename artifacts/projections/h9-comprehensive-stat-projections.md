# h9-comprehensive-stat-projections

```json
{
  "generatedAt": "2026-06-16T04:44:33.289Z",
  "method": "blackbird_comprehensive_stat_projections_v1",
  "projectionVersion": "comprehensive-stat-projections-v1",
  "historicalSeason": 2025,
  "projectionSeason": 2026,
  "projectionUnit": "season",
  "inputPlayers": 7266,
  "projectedPlayers": 7266,
  "projectedPlayersWithStats": 2140,
  "projectedRookies": 702,
  "fallbackProjectionCount": 5126,
  "positionDistribution": {
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
  "confidenceDistribution": {
    "low": 1438,
    "very_low": 5828
  },
  "rookieConfidenceDistribution": {
    "very_low": 702
  },
  "projectionStatCoverageByPosition": {
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
  "sampleProjections": [
    {
      "playerId": "9c149379-df06-4e2d-b734-3fee91327ead",
      "playerName": "Graham Gano",
      "position": "K",
      "team": null,
      "season": 2026,
      "projectionVersion": "comprehensive-stat-projections-v1",
      "projectionUnit": "season",
      "projectionType": "veteran",
      "confidence": "low",
      "dataGaps": [
        "limited historical seasons"
      ],
      "reasons": [
        "Weighted recent historical stat production.",
        "Sparse touchdown/turnover events are regressed."
      ],
      "stats": {
        "pat_att": {
          "floor": 5.9,
          "median": 9,
          "ceiling": 12.1
        },
        "pat_made": {
          "floor": 5.9,
          "median": 9,
          "ceiling": 12.1
        },
        "fg_att": {
          "floor": 6.6,
          "median": 10,
          "ceiling": 13.4
        },
        "fg_made": {
          "floor": 5.9,
          "median": 9,
          "ceiling": 12.1
        },
        "fgm_0_19": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "fgm_20_29": {
          "floor": 2,
          "median": 3,
          "ceiling": 4
        },
        "fgm_30_39": {
          "floor": 2.6,
          "median": 4,
          "ceiling": 5.4
        },
        "fgm_40_49": {
          "floor": 0.7,
          "median": 1,
          "ceiling": 1.3
        },
        "fgm_50p": {
          "floor": 0.7,
          "median": 1,
          "ceiling": 1.3
        },
        "fgmiss": {
          "floor": 0.7,
          "median": 1,
          "ceiling": 1.3
        },
        "xpmiss": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "fg_long": {
          "floor": 123.4,
          "median": 187,
          "ceiling": 250.6
        },
        "fgm_60p": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "fgm_50_59": {
          "floor": 0.7,
          "median": 1,
          "ceiling": 1.3
        },
        "fg_blocked": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "fgmiss_50p": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "fgmiss_60p": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "xp_blocked": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "fgmiss_0_19": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "fgmiss_20_29": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "fgmiss_30_39": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "fgmiss_40_49": {
          "floor": 0.7,
          "median": 1,
          "ceiling": 1.3
        },
        "fgmiss_50_59": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "fg_pct": {
          "floor": 90,
          "median": 90,
          "ceiling": 90
        },
        "pat_pct": {
          "floor": 100,
          "median": 100,
          "ceiling": 100
        }
      }
    },
    {
      "playerId": "e511e620-a3a2-4960-90ed-06898da3ff6e",
      "playerName": "Matt Prater",
      "position": "K",
      "team": null,
      "season": 2026,
      "projectionVersion": "comprehensive-stat-projections-v1",
      "projectionUnit": "season",
      "projectionType": "veteran",
      "confidence": "low",
      "dataGaps": [
        "limited historical seasons"
      ],
      "reasons": [
        "Weighted recent historical stat production.",
        "Sparse touchdown/turnover events are regressed."
      ],
      "stats": {
        "pat_att": {
          "floor": 32.3,
          "median": 49,
          "ceiling": 65.7
        },
        "pat_made": {
          "floor": 30.4,
          "median": 46,
          "ceiling": 61.6
        },
        "fg_att": {
          "floor": 13.2,
          "median": 20,
          "ceiling": 26.8
        },
        "fg_made": {
          "floor": 11.9,
          "median": 18,
          "ceiling": 24.1
        },
        "fgm_0_19": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "fgm_20_29": {
          "floor": 2.6,
          "median": 4,
          "ceiling": 5.4
        },
        "fgm_30_39": {
          "floor": 4.6,
          "median": 7,
          "ceiling": 9.4
        },
        "fgm_40_49": {
          "floor": 4,
          "median": 6,
          "ceiling": 8
        },
        "fgm_50p": {
          "floor": 0.7,
          "median": 1,
          "ceiling": 1.3
        },
        "fgmiss": {
          "floor": 1.3,
          "median": 2,
          "ceiling": 2.7
        },
        "xpmiss": {
          "floor": 2,
          "median": 3,
          "ceiling": 4
        },
        "fg_long": {
          "floor": 273.2,
          "median": 414,
          "ceiling": 554.8
        },
        "fgm_60p": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "fgm_50_59": {
          "floor": 0.7,
          "median": 1,
          "ceiling": 1.3
        },
        "fg_blocked": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "fgmiss_50p": {
          "floor": 0.7,
          "median": 1,
          "ceiling": 1.3
        },
        "fgmiss_60p": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "xp_blocked": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "fgmiss_0_19": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "fgmiss_20_29": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "fgmiss_30_39": {
          "floor": 0.7,
          "median": 1,
          "ceiling": 1.3
        },
        "fgmiss_40_49": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "fgmiss_50_59": {
          "floor": 0.7,
          "median": 1,
          "ceiling": 1.3
        },
        "fg_pct": {
          "floor": 90,
          "median": 90,
          "ceiling": 90
        },
        "pat_pct": {
          "floor": 93.9,
          "median": 93.9,
          "ceiling": 93.9
        }
      }
    },
    {
      "playerId": "07021f93-ee96-4638-b026-2c5c4c33426d",
      "playerName": "Joe Flacco",
      "position": "QB",
      "team": "CIN",
      "season": 2026,
      "projectionVersion": "comprehensive-stat-projections-v1",
      "projectionUnit": "season",
      "projectionType": "veteran",
      "confidence": "low",
      "dataGaps": [
        "limited historical seasons"
      ],
      "reasons": [
        "Weighted recent historical stat production.",
        "Sparse touchdown/turnover events are regressed."
      ],
      "stats": {
        "pass_att": {
          "floor": 307.8,
          "median": 416,
          "ceiling": 524.2
        },
        "pass_cmp": {
          "floor": 185.7,
          "median": 251,
          "ceiling": 316.3
        },
        "pass_yd": {
          "floor": 1834.5,
          "median": 2479,
          "ceiling": 3123.5
        },
        "pass_td": {
          "floor": 10,
          "median": 13.5,
          "ceiling": 17
        },
        "pass_int": {
          "floor": 7.4,
          "median": 10,
          "ceiling": 12.6
        },
        "rush_att": {
          "floor": 15.5,
          "median": 21,
          "ceiling": 26.5
        },
        "rush_yd": {
          "floor": 25.9,
          "median": 35,
          "ceiling": 44.1
        },
        "rush_td": {
          "floor": 0.7,
          "median": 0.9,
          "ceiling": 1.1
        },
        "fum_lost": {
          "floor": 2.2,
          "median": 3,
          "ceiling": 3.8
        },
        "pass_fd": {
          "floor": 85.1,
          "median": 115,
          "ceiling": 144.9
        },
        "rush_fd": {
          "floor": 6.7,
          "median": 9,
          "ceiling": 11.3
        },
        "two_pt": {
          "floor": 0.8,
          "median": 1.1,
          "ceiling": 1.4
        },
        "rec": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "rec_fd": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "rec_td": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "rec_yd": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "target": {
          "floor": 0,
          "median": 0,
          "ceiling": 0
        },
        "pass_sack": {
          "floor": 13.3,
          "median": 18,
          "ceiling": 22.7
        },
        "ypc": {
          "floor": 1.7,
          "median": 1.7,
          "ceiling": 1.7
        },
        "cmp_pct": {
          "floor": 60.3,
          "median": 60.3,
          "ceiling": 60.3
        }
      }
    },
    {
      "playerId": "e7aa792e-43ee-4ed5-8d42-1d15950eeee3",
      "playerName": "Aaron Rodgers",
      "position": "QB",
      "team": "PIT",
      "season": 2026,
      "projectionVersion": "comprehensive-stat-projections-v1",
      "projectionUnit": "season",
      "projectionType": "veteran",
      "confidence": "low",
      "dataGaps": [
        "limited historical seasons"
      ],
      "reasons": [
        "Weighted recent historical stat production.",
        "Sparse touchdown/turnover events are regressed."
      ],
      "stats": {
        "pass_att": {
          "floor": 368.5,
          "median": 498,
          "ceiling": 627.5
        },
        "pass_cmp": {
          "floor": 242,
          "median": 327,
          "ceiling": 412
        },
        "pass_yd": {
          "floor": 2458.3,
          "median": 3322,
          "ceiling": 4185.7
        },
        "pass_td": {
          "floor": 16,
          "median": 21.6,
          "ceiling": 27.2
        },
        "pass_int": {
          "floor": 5.2,
          "median": 7,
          "ceiling": 8.8
        },
        "rush_att": {
          "floor": 15.5,
          "median": 21,
```
