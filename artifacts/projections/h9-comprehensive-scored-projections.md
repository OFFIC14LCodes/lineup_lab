# h9-comprehensive-scored-projections

```json
{
  "generatedAt": "2026-06-16T19:07:30.467Z",
  "method": "blackbird_comprehensive_stat_projections_v1",
  "leagueCount": 13,
  "scoredFantasyOutputs": 27820,
  "scoredOutputsByLeague": {
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
  },
  "scoredOutputsByPosition": {
    "K": 676,
    "QB": 1482,
    "TE": 2561,
    "DL": 5434,
    "LB": 3627,
    "DB": 6513,
    "RB": 2717,
    "WR": 4810
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
  "floorMedianCeilingFailures": 0,
  "sampleScoredProjections": [
    {
      "projection": {
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
      "scored": {
        "playerId": "9c149379-df06-4e2d-b734-3fee91327ead",
        "leagueId": "566b01f1-28df-48f2-ac3d-2ecaf0eeb09e",
        "scoringFingerprint": "62d2fa99b9a3d77306fab9e12646c56c5c95f771351b431b351b870b8b688a26",
        "floorFantasyPoints": 0,
        "medianFantasyPoints": 0,
        "ceilingFantasyPoints": 0,
        "statContributions": [],
        "unsupportedScoringKeys": [],
        "missingProjectedStats": [],
        "warnings": []
      }
    },
    {
      "projection": {
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
      "scored": {
        "playerId": "9c149379-df06-4e2d-b734-3fee91327ead",
        "leagueId": "bb695a41-86ad-4a9c-9948-95604c5cfa41",
        "scoringFingerprint": "f833565d613b21ded95be2c8837bf6449e04cd0c301994deda46ff6584f29ed1",
        "floorFantasyPoints": 25.3,
        "medianFantasyPoints": 38,
        "ceilingFantasyPoints": 50.7,
        "statContributions": [
          {
            "statKey": "fgm_0_19",
            "projectedFloor": 0,
            "projectedMedian": 0,
            "projectedCeiling": 0,
            "scoringValue": 3,
            "floorPoints": 0,
            "medianPoints": 0,
            "ceilingPoints": 0
          },
          {
            "statKey": "fgm_20_29",
            "projectedFloor": 2,
            "projectedMedian": 3,
            "projectedCeiling": 4,
            "scoringValue": 3,
            "floorPoints": 6,
            "medianPoints": 9,
            "ceilingPoints": 12
          },
          {
            "statKey": "fgm_30_39",
            "projectedFloor": 2.6,
            "projectedMedian": 4,
            "projectedCeiling": 5.4,
            "scoringValue": 3,
            "floorPoints": 7.800000000000001,
            "medianPoints": 12,
            "ceilingPoints": 16.200000000000003
          },
          {
            "statKey": "fgm_40_49",
            "projectedFloor": 0.7,
            "projectedMedian": 1,
            "projectedCeiling": 1.3,
            "scoringValue": 4,
            "floorPoints": 2.8,
            "medianPoints": 4,
            "ceilingPoints": 5.2
          },
          {
            "statKey": "fgm_50p",
            "projectedFloor": 0.7,
            "projectedMedian": 1,
            "projectedCeiling": 1.3,
            "scoringValue": 5,
            "floorPoints": 3.5,
            "medianPoints": 5,
            "ceilingPoints": 6.5
          },
          {
            "statKey": "fgmiss",
            "projectedFloor": 0.7,
            "projectedMedian": 1,
            "projectedCeiling": 1.3,
            "scoringValue": -1,
            "floorPoints": -0.7,
            "medianPoints": -1,
            "ceilingPoints": -1.3
          },
          {
            "statKey": "xpmiss",
            "projectedFloor": 0,
            "projectedMedian": 0,
            "projectedCeiling": 0,
            "scoringValue": -1,
            "floorPoints": 0,
            "medianPoints": 0,
            "ceilingPoints": 0
          }
        ],
        "unsupportedScoringKeys": [
          "st_ff",
          "st_fum_rec"
        ],
        "missingProjectedStats": [],
        "warnings": []
      }
    },
    {
      "projection": {
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

```
