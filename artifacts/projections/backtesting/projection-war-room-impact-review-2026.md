# Projection War Room Impact Review 2026

Dry run: true
Read only: true
Recommendation: war_room_impact_needs_review

## Value Impact

```json
{
  "estimateMethod": "projected_point_delta_proxy",
  "limitation": "Exact War Room player value cannot be recomputed from projection artifacts alone because live overlay, roster need, market, scarcity, tier, and recommendation score components are not replayed.",
  "rowsEvaluated": 3210,
  "rowsWithValueEstimate": 50,
  "rowsWithValueMovement": 50,
  "averageProjectedPointDelta": 1.4,
  "maxProjectedPointDelta": 18,
  "topValueMovers": [
    {
      "playerId": "12490",
      "player": "Bhayshul Tuten",
      "position": "RB",
      "team": "JAX",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "second_year_low_prior"
      ],
      "currentProjectedTotal": 54,
      "v82ProjectedTotal": 72,
      "projectedPointDelta": 18,
      "currentOverallRank": 1190,
      "v82OverallRank": 896,
      "estimatedOverallRankMovement": 294,
      "currentPositionRank": 116,
      "v82PositionRank": 82,
      "estimatedPositionRankMovement": 34,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "12469",
      "player": "Dylan Sampson",
      "position": "RB",
      "team": "CLE",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "second_year_low_prior"
      ],
      "currentProjectedTotal": 54,
      "v82ProjectedTotal": 71.4,
      "projectedPointDelta": 17.4,
      "currentOverallRank": 1191,
      "v82OverallRank": 937,
      "estimatedOverallRankMovement": 254,
      "currentPositionRank": 117,
      "v82PositionRank": 84,
      "estimatedPositionRankMovement": 33,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "8159",
      "player": "Desmond Ridder",
      "position": "QB",
      "team": "GB",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "veteran_prior_sample"
      ],
      "currentProjectedTotal": 42.5,
      "v82ProjectedTotal": 58.7,
      "projectedPointDelta": 16.2,
      "currentOverallRank": 1481,
      "v82OverallRank": 1168,
      "estimatedOverallRankMovement": 313,
      "currentPositionRank": 61,
      "v82PositionRank": 57,
      "estimatedPositionRankMovement": 4,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "11646",
      "player": "Jalen Coker",
      "position": "WR",
      "team": "CAR",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "veteran_prior_sample"
      ],
      "currentProjectedTotal": 102.3,
      "v82ProjectedTotal": 115.3,
      "projectedPointDelta": 13,
      "currentOverallRank": 534,
      "v82OverallRank": 453,
      "estimatedOverallRankMovement": 81,
      "currentPositionRank": 92,
      "v82PositionRank": 76,
      "estimatedPositionRankMovement": 16,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "9504",
      "player": "Kayshon Boutte",
      "position": "WR",
      "team": "NE",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "veteran_prior_sample"
      ],
      "currentProjectedTotal": 91,
      "v82ProjectedTotal": 103.6,
      "projectedPointDelta": 12.6,
      "currentOverallRank": 643,
      "v82OverallRank": 545,
      "estimatedOverallRankMovement": 98,
      "currentPositionRank": 107,
      "v82PositionRank": 93,
      "estimatedPositionRankMovement": 14,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "3161",
      "player": "Carson Wentz",
      "position": "QB",
      "team": "MIN",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "veteran_prior_sample"
      ],
      "currentProjectedTotal": 37.2,
      "v82ProjectedTotal": 49.6,
      "projectedPointDelta": 12.4,
      "currentOverallRank": 1609,
      "v82OverallRank": 1327,
      "estimatedOverallRankMovement": 282,
      "currentPositionRank": 69,
      "v82PositionRank": 61,
      "estimatedPositionRankMovement": 8,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "13557",
      "player": "Athan Kaliakmanis",
      "position": "QB",
      "team": "WAS",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4205,
      "v82OverallRank": 2108,
      "estimatedOverallRankMovement": 2097,
      "currentPositionRank": 115,
      "v82PositionRank": 98,
      "estimatedPositionRankMovement": 17,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "13295",
      "player": "Behren Morton",
      "position": "QB",
      "team": "NE",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4208,
      "v82OverallRank": 2109,
      "estimatedOverallRankMovement": 2099,
      "currentPositionRank": 118,
      "v82PositionRank": 99,
      "estimatedPositionRankMovement": 19,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "5817",
      "player": "Byron Leftwich",
      "position": "QB",
      "team": "PIT",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4213,
      "v82OverallRank": 2111,
      "estimatedOverallRankMovement": 2102,
      "currentPositionRank": 123,
      "v82PositionRank": 100,
      "estimatedPositionRankMovement": 23,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "13303",
      "player": "Cade Klubnik",
      "position": "QB",
      "team": "NYJ",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4214,
      "v82OverallRank": 2112,
      "estimatedOverallRankMovement": 2102,
      "currentPositionRank": 124,
      "v82PositionRank": 101,
      "estimatedPositionRankMovement": 23,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "13272",
      "player": "Carson Beck",
      "position": "QB",
      "team": "ARI",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4217,
      "v82OverallRank": 2113,
      "estimatedOverallRankMovement": 2104,
      "currentPositionRank": 126,
      "v82PositionRank": 102,
      "estimatedPositionRankMovement": 24,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "13335",
      "player": "Cole Payton",
      "position": "QB",
      "team": "PHI",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4227,
      "v82OverallRank": 2115,
      "estimatedOverallRankMovement": 2112,
      "currentPositionRank": 135,
      "v82PositionRank": 103,
      "estimatedPositionRankMovement": 32,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "13289",
      "player": "Drew Allar",
      "position": "QB",
      "team": "PIT",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4241,
      "v82OverallRank": 2116,
      "estimatedOverallRankMovement": 2125,
      "currentPositionRank": 145,
      "v82PositionRank": 104,
      "estimatedPositionRankMovement": 41,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "13269",
      "player": "Fernando Mendoza",
      "position": "QB",
      "team": "LV",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4250,
      "v82OverallRank": 2118,
      "estimatedOverallRankMovement": 2132,
      "currentPositionRank": 153,
      "v82PositionRank": 105,
      "estimatedPositionRankMovement": 48,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "13404",
      "player": "Garrett Nussmeier",
      "position": "QB",
      "team": "KC",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4251,
      "v82OverallRank": 2119,
      "estimatedOverallRankMovement": 2132,
      "currentPositionRank": 154,
      "v82PositionRank": 106,
      "estimatedPositionRankMovement": 48,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "13415",
      "player": "Haynes King",
      "position": "QB",
      "team": "CAR",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4255,
      "v82OverallRank": 2120,
      "estimatedOverallRankMovement": 2135,
      "currentPositionRank": 157,
      "v82PositionRank": 107,
      "estimatedPositionRankMovement": 50,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "13602",
      "player": "Jack Strand",
      "position": "QB",
      "team": "ATL",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4262,
      "v82OverallRank": 2122,
      "estimatedOverallRankMovement": 2140,
      "currentPositionRank": 164,
      "v82PositionRank": 108,
      "estimatedPositionRankMovement": 56,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "13802",
      "player": "Jacob Clark",
      "position": "QB",
      "team": "LV",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4263,
      "v82OverallRank": 2123,
      "estimatedOverallRankMovement": 2140,
      "currentPositionRank": 165,
      "v82PositionRank": 109,
      "estimatedPositionRankMovement": 56,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "13425",
      "player": "Jalon Daniels",
      "position": "QB",
      "team": "TB",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4269,
      "v82OverallRank": 2125,
      "estimatedOverallRankMovement": 2144,
      "currentPositionRank": 170,
      "v82PositionRank": 110,
      "estimatedPositionRankMovement": 60,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "13350",
      "player": "Joe Fagnano",
      "position": "QB",
      "team": "BAL",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4277,
      "v82OverallRank": 2126,
      "estimatedOverallRankMovement": 2151,
      "currentPositionRank": 176,
      "v82PositionRank": 111,
      "estimatedPositionRankMovement": 65,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "13428",
      "player": "Joey Aguilar",
      "position": "QB",
      "team": "JAX",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4279,
      "v82OverallRank": 2127,
      "estimatedOverallRankMovement": 2152,
      "currentPositionRank": 178,
      "v82PositionRank": 112,
      "estimatedPositionRankMovement": 66,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "5833",
      "player": "Kevin O'Connell",
      "position": "QB",
      "team": "NYJ",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4290,
      "v82OverallRank": 2129,
      "estimatedOverallRankMovement": 2161,
      "currentPositionRank": 187,
      "v82PositionRank": 113,
      "estimatedPositionRankMovement": 74,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "7",
      "player": "Kurt Warner",
      "position": "QB",
      "team": "ARI",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4291,
      "v82OverallRank": 2131,
      "estimatedOverallRankMovement": 2160,
      "currentPositionRank": 188,
      "v82PositionRank": 114,
      "estimatedPositionRankMovement": 74,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "13599",
      "player": "Kyron Drones",
      "position": "QB",
      "team": "GB",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4296,
      "v82OverallRank": 2132,
      "estimatedOverallRankMovement": 2164,
      "currentPositionRank": 193,
      "v82PositionRank": 115,
      "estimatedPositionRankMovement": 78,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "13314",
      "player": "Luke Altmyer",
      "position": "QB",
      "team": "DET",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4299,
      "v82OverallRank": 2134,
      "estimatedOverallRankMovement": 2165,
      "currentPositionRank": 195,
      "v82PositionRank": 116,
      "estimatedPositionRankMovement": 79,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "13816",
      "player": "Mark Gronowski",
      "position": "QB",
      "team": "MIA",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4301,
      "v82OverallRank": 2135,
      "estimatedOverallRankMovement": 2166,
      "currentPositionRank": 197,
      "v82PositionRank": 117,
      "estimatedPositionRankMovement": 80,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "13597",
      "player": "Matthew Caldwell",
      "position": "QB",
      "team": "LAR",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4303,
      "v82OverallRank": 2136,
      "estimatedOverallRankMovement": 2167,
      "currentPositionRank": 199,
      "v82PositionRank": 118,
      "estimatedPositionRankMovement": 81,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "3026",
      "player": "Mike Hartline",
      "position": "QB",
      "team": "IND",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4307,
      "v82OverallRank": 2137,
      "estimatedOverallRankMovement": 2170,
      "currentPositionRank": 203,
      "v82PositionRank": 119,
      "estimatedPositionRankMovement": 84,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "13310",
      "player": "Miller Moss",
      "position": "QB",
      "team": "CHI",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4308,
      "v82OverallRank": 2138,
      "estimatedOverallRankMovement": 2170,
      "currentPositionRank": 204,
      "v82PositionRank": 120,
      "estimatedPositionRankMovement": 84,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "13306",
      "player": "Taylen Green",
      "position": "QB",
      "team": "CLE",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4332,
      "v82OverallRank": 2141,
      "estimatedOverallRankMovement": 2191,
      "currentPositionRank": 222,
      "v82PositionRank": 123,
      "estimatedPositionRankMovement": 99,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "13275",
      "player": "Ty Simpson",
      "position": "QB",
      "team": "LAR",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "low_prior_sample",
        "no_prior_stats",
        "offense",
        "rookie"
      ],
      "currentProjectedTotal": 12,
      "v82ProjectedTotal": 24,
      "projectedPointDelta": 12,
      "currentOverallRank": 4340,
      "v82OverallRank": 2143,
      "estimatedOverallRankMovement": 2197,
      "currentPositionRank": 226,
      "v82PositionRank": 124,
      "estimatedPositionRankMovement": 102,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "rookie_or_new_player"
    },
    {
      "playerId": "6111",
      "player": "Jake Browning",
      "position": "QB",
      "team": "TB",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "veteran_prior_sample"
      ],
      "currentProjectedTotal": 40,
      "v82ProjectedTotal": 51.2,
      "projectedPointDelta": 11.2,
      "currentOverallRank": 1533,
      "v82OverallRank": 1298,
      "estimatedOverallRankMovement": 235,
      "currentPositionRank": 66,
      "v82PositionRank": 60,
      "estimatedPositionRankMovement": 6,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "12455",
      "player": "Brashard Smith",
      "position": "RB",
      "team": "KC",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "second_year_low_prior"
      ],
      "currentProjectedTotal": 33.3,
      "v82ProjectedTotal": 44.4,
      "projectedPointDelta": 11.1,
      "currentOverallRank": 1722,
      "v82OverallRank": 1459,
      "estimatedOverallRankMovement": 263,
      "currentPositionRank": 159,
      "v82PositionRank": 137,
      "estimatedPositionRankMovement": 22,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "11566",
      "player": "Jayden Daniels",
      "position": "QB",
      "team": "WAS",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "veteran_prior_sample"
      ],
      "currentProjectedTotal": 91.5,
      "v82ProjectedTotal": 102.5,
      "projectedPointDelta": 11,
      "currentOverallRank": 631,
      "v82OverallRank": 551,
      "estimatedOverallRankMovement": 80,
      "currentPositionRank": 41,
      "v82PositionRank": 40,
      "estimatedPositionRankMovement": 1,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "2306",
      "player": "Jameis Winston",
      "position": "QB",
      "team": "NYG",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "veteran_prior_sample"
      ],
      "currentProjectedTotal": 57,
      "v82ProjectedTotal": 67.3,
      "projectedPointDelta": 10.3,
      "currentOverallRank": 1149,
      "v82OverallRank": 991,
      "estimatedOverallRankMovement": 158,
      "currentPositionRank": 53,
      "v82PositionRank": 56,
      "estimatedPositionRankMovement": -3,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "7585",
      "player": "Davis Mills",
      "position": "QB",
      "team": "HOU",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "veteran_prior_sample"
      ],
      "currentProjectedTotal": 34,
      "v82ProjectedTotal": 44.2,
      "projectedPointDelta": 10.2,
      "currentOverallRank": 1705,
      "v82OverallRank": 1462,
      "estimatedOverallRankMovement": 243,
      "currentPositionRank": 76,
      "v82PositionRank": 67,
      "estimatedPositionRankMovement": 9,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "5297",
      "player": "Zach Sieler",
      "position": "DL",
      "team": "MIA",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "idp",
        "idp_conservative"
      ],
      "currentProjectedTotal": 113.4,
      "v82ProjectedTotal": 123.1,
      "projectedPointDelta": 9.7,
      "currentOverallRank": 455,
      "v82OverallRank": 401,
      "estimatedOverallRankMovement": 54,
      "currentPositionRank": 16,
      "v82PositionRank": 15,
      "estimatedPositionRankMovement": 1,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "12495",
      "player": "Ollie Gordon",
      "position": "RB",
      "team": "MIA",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "second_year_low_prior"
      ],
      "currentProjectedTotal": 28.8,
      "v82ProjectedTotal": 38.4,
      "projectedPointDelta": 9.6,
      "currentOverallRank": 1893,
      "v82OverallRank": 1618,
      "estimatedOverallRankMovement": 275,
      "currentPositionRank": 175,
      "v82PositionRank": 147,
      "estimatedPositionRankMovement": 28,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "6011",
      "player": "Gardner Minshew",
      "position": "QB",
      "team": "ARI",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "veteran_prior_sample"
      ],
      "currentProjectedTotal": 28,
      "v82ProjectedTotal": 37.5,
      "projectedPointDelta": 9.5,
      "currentOverallRank": 1918,
      "v82OverallRank": 1633,
      "estimatedOverallRankMovement": 285,
      "currentPositionRank": 90,
      "v82PositionRank": 80,
      "estimatedPositionRankMovement": 10,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "2449",
      "player": "Stefon Diggs",
      "position": "WR",
      "team": "NE",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "veteran_prior_sample"
      ],
      "currentProjectedTotal": 214.4,
      "v82ProjectedTotal": 223.8,
      "projectedPointDelta": 9.4,
      "currentOverallRank": 71,
      "v82OverallRank": 59,
      "estimatedOverallRankMovement": 12,
      "currentPositionRank": 17,
      "v82PositionRank": 14,
      "estimatedPositionRankMovement": 3,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "8180",
      "player": "Jalen Nailor",
      "position": "WR",
      "team": "LV",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "veteran_prior_sample"
      ],
      "currentProjectedTotal": 70.2,
      "v82ProjectedTotal": 78.8,
      "projectedPointDelta": 8.6,
      "currentOverallRank": 901,
      "v82OverallRank": 813,
      "estimatedOverallRankMovement": 88,
      "currentPositionRank": 137,
      "v82PositionRank": 122,
      "estimatedPositionRankMovement": 15,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "6783",
      "player": "Jerry Jeudy",
      "position": "WR",
      "team": "CLE",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "veteran_prior_sample"
      ],
      "currentProjectedTotal": 153.6,
      "v82ProjectedTotal": 162.2,
      "projectedPointDelta": 8.6,
      "currentOverallRank": 221,
      "v82OverallRank": 203,
      "estimatedOverallRankMovement": 18,
      "currentPositionRank": 52,
      "v82PositionRank": 48,
      "estimatedPositionRankMovement": 4,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "5849",
      "player": "Kyler Murray",
      "position": "QB",
      "team": "MIN",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "veteran_prior_sample"
      ],
      "currentProjectedTotal": 85,
      "v82ProjectedTotal": 93.5,
      "projectedPointDelta": 8.5,
      "currentOverallRank": 714,
      "v82OverallRank": 635,
      "estimatedOverallRankMovement": 79,
      "currentPositionRank": 44,
      "v82PositionRank": 45,
      "estimatedPositionRankMovement": -1,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "6819",
      "player": "Michael Pittman",
      "position": "WR",
      "team": "PIT",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "veteran_prior_sample"
      ],
      "currentProjectedTotal": 195.2,
      "v82ProjectedTotal": 203.7,
      "projectedPointDelta": 8.5,
      "currentOverallRank": 106,
      "v82OverallRank": 90,
      "estimatedOverallRankMovement": 16,
      "currentPositionRank": 26,
      "v82PositionRank": 23,
      "estimatedPositionRankMovement": 3,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "7090",
      "player": "Darnell Mooney",
      "position": "WR",
      "team": "NYG",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "veteran_prior_sample"
      ],
      "currentProjectedTotal": 105,
      "v82ProjectedTotal": 113.3,
      "projectedPointDelta": 8.3,
      "currentOverallRank": 518,
      "v82OverallRank": 465,
      "estimatedOverallRankMovement": 53,
      "currentPositionRank": 90,
      "v82PositionRank": 80,
      "estimatedPositionRankMovement": 10,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "11647",
      "player": "Kimani Vidal",
      "position": "RB",
      "team": "LAC",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "veteran_prior_sample"
      ],
      "currentProjectedTotal": 75.9,
      "v82ProjectedTotal": 84.2,
      "projectedPointDelta": 8.3,
      "currentOverallRank": 825,
      "v82OverallRank": 753,
      "estimatedOverallRankMovement": 72,
      "currentPositionRank": 77,
      "v82PositionRank": 73,
      "estimatedPositionRankMovement": 4,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "11559",
      "player": "Michael Penix",
      "position": "QB",
      "team": "ATL",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "veteran_prior_sample"
      ],
      "currentProjectedTotal": 94.4,
      "v82ProjectedTotal": 102.7,
      "projectedPointDelta": 8.3,
      "currentOverallRank": 602,
      "v82OverallRank": 550,
      "estimatedOverallRankMovement": 52,
      "currentPositionRank": 40,
      "v82PositionRank": 39,
      "estimatedPositionRankMovement": 1,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "1373",
      "player": "Geno Smith",
      "position": "QB",
      "team": "NYJ",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "veteran_prior_sample"
      ],
      "currentProjectedTotal": 204,
      "v82ProjectedTotal": 212.2,
      "projectedPointDelta": 8.2,
      "currentOverallRank": 84,
      "v82OverallRank": 78,
      "estimatedOverallRankMovement": 6,
      "currentPositionRank": 24,
      "v82PositionRank": 23,
      "estimatedPositionRankMovement": 1,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "6151",
      "player": "Miles Sanders",
      "position": "RB",
      "team": "DAL",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "veteran_prior_sample"
      ],
      "currentProjectedTotal": 61.2,
      "v82ProjectedTotal": 53,
      "projectedPointDelta": -8.2,
      "currentOverallRank": 1064,
      "v82OverallRank": 1266,
      "estimatedOverallRankMovement": -202,
      "currentPositionRank": 97,
      "v82PositionRank": 123,
      "estimatedPositionRankMovement": -26,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    },
    {
      "playerId": "8157",
      "player": "Bailey Zappe",
      "position": "QB",
      "team": "NYJ",
      "selectorSelection": "v8_2_candidate_path",
      "selectorReason": "eligible_safe_candidate",
      "cohorts": [
        "offense",
        "veteran_prior_sample"
      ],
      "currentProjectedTotal": 31.6,
      "v82ProjectedTotal": 39.5,
      "projectedPointDelta": 7.9,
      "currentOverallRank": 1779,
      "v82OverallRank": 1581,
      "estimatedOverallRankMovement": 198,
      "currentPositionRank": 80,
      "v82PositionRank": 76,
      "estimatedPositionRankMovement": 4,
      "protectedByPolicy": false,
      "protectionReasons": [
        "eligible_for_flag_candidate"
      ],
      "criticalMovement": false,
      "meaningfulRankMover": false,
      "universeEligibilityStatus": "active_plausible"
    }
  ],
  "movementBuckets": {
    "0": 1722,
    "0-2": 577,
    "2-5": 375,
    "5-10": 500,
    "10-20": 36,
    "20+": 0
  },
  "positionMovement": [
    {
      "segment": "RB",
      "rows": 401,
      "averageProjectedPointDelta": 0.997,
      "medianProjectedPointDelta": 0,
      "maxAbsProjectedPointDelta": 18,
      "rowsMoving5PlusPoints": 63,
      "rowsMoving10PlusPoints": 3,
      "rowsMoving20PlusPoints": 0
    },
    {
      "segment": "QB",
      "rows": 186,
      "averageProjectedPointDelta": 2.585,
      "medianProjectedPointDelta": 0,
      "maxAbsProjectedPointDelta": 16.2,
      "rowsMoving5PlusPoints": 44,
      "rowsMoving10PlusPoints": 31,
      "rowsMoving20PlusPoints": 0
    },
    {
      "segment": "WR",
      "rows": 839,
      "averageProjectedPointDelta": 0.609,
      "medianProjectedPointDelta": 0,
      "maxAbsProjectedPointDelta": 13,
      "rowsMoving5PlusPoints": 141,
      "rowsMoving10PlusPoints": 2,
      "rowsMoving20PlusPoints": 0
    },
    {
      "segment": "DL",
      "rows": 423,
      "averageProjectedPointDelta": 1.557,
      "medianProjectedPointDelta": 1.4,
      "maxAbsProjectedPointDelta": 9.7,
      "rowsMoving5PlusPoints": 12,
      "rowsMoving10PlusPoints": 0,
      "rowsMoving20PlusPoints": 0
    },
    {
      "segment": "LB",
      "rows": 416,
      "averageProjectedPointDelta": 0.076,
      "medianProjectedPointDelta": 0,
      "maxAbsProjectedPointDelta": 7.8,
      "rowsMoving5PlusPoints": 9,
      "rowsMoving10PlusPoints": 0,
      "rowsMoving20PlusPoints": 0
    },
    {
      "segment": "TE",
      "rows": 389,
      "averageProjectedPointDelta": 5.013,
      "medianProjectedPointDelta": 7.5,
      "maxAbsProjectedPointDelta": 7.5,
      "rowsMoving5PlusPoints": 260,
      "rowsMoving10PlusPoints": 0,
      "rowsMoving20PlusPoints": 0
    },
    {
      "segment": "DB",
      "rows": 556,
      "averageProjectedPointDelta": 0.831,
      "medianProjectedPointDelta": 0,
      "maxAbsProjectedPointDelta": 7,
      "rowsMoving5PlusPoints": 7,
      "rowsMoving10PlusPoints": 0,
      "rowsMoving20PlusPoints": 0
    }
  ],
  "cohortMovement": [
    {
      "segment": "offense",
      "rows": 1815,
      "averageProjectedPointDelta": 1.841,
      "medianProjectedPointDelta": 0,
      "maxAbsProjectedPointDelta": 18,
      "rowsMoving5PlusPoints": 508,
      "rowsMoving10PlusPoints": 36,
      "rowsMoving20PlusPoints": 0
    },
    {
      "segment": "second_year_low_prior",
      "rows": 92,
      "averageProjectedPointDelta": 0.877,
      "medianProjectedPointDelta": 0,
      "maxAbsProjectedPointDelta": 18,
      "rowsMoving5PlusPoints": 5,
      "rowsMoving10PlusPoints": 3,
      "rowsMoving20PlusPoints": 0
    },
    {
      "segment": "veteran_prior_sample",
      "rows": 401,
      "averageProjectedPointDelta": 0.134,
      "medianProjectedPointDelta": 0,
      "maxAbsProjectedPointDelta": 16.2,
      "rowsMoving5PlusPoints": 65,
      "rowsMoving10PlusPoints": 8,
      "rowsMoving20PlusPoints": 0
    },
    {
      "segment": "low_prior_sample",
      "rows": 1657,
      "averageProjectedPointDelta": 1.911,
      "medianProjectedPointDelta": 0,
      "maxAbsProjectedPointDelta": 12,
      "rowsMoving5PlusPoints": 438,
      "rowsMoving10PlusPoints": 25,
      "rowsMoving20PlusPoints": 0
    },
    {
      "segment": "no_prior_stats",
      "rows": 1657,
      "averageProjectedPointDelta": 1.911,
      "medianProjectedPointDelta": 0,
      "maxAbsProjectedPointDelta": 12,
      "rowsMoving5PlusPoints": 438,
      "rowsMoving10PlusPoints": 25,
      "rowsMoving20PlusPoints": 0
    },
    {
      "segment": "rookie",
      "rows": 483,
      "averageProjectedPointDelta": 2.617,
      "medianProjectedPointDelta": 0,
      "maxAbsProjectedPointDelta": 12,
      "rowsMoving5PlusPoints": 178,
      "rowsMoving10PlusPoints": 25,
      "rowsMoving20PlusPoints": 0
    },
    {
      "segment": "idp",
      "rows": 1395,
      "averageProjectedPointDelta": 0.826,
      "medianProjectedPointDelta": 0,
      "maxAbsProjectedPointDelta": 9.7,
      "rowsMoving5PlusPoints": 28,
      "rowsMoving10PlusPoints": 0,
      "rowsMoving20PlusPoints": 0
    },
    {
      "segment": "idp_conservative",
      "rows": 931,
      "averageProjectedPointDelta": 1.282,
      "medianProjectedPointDelta": 0.7,
      "maxAbsProjectedPointDelta": 9.7,
      "rowsMoving5PlusPoints": 28,
      "rowsMoving10PlusPoints": 0,
      "rowsMoving20PlusPoints": 0
    },
    {
      "segment": "te_fallback",
      "rows": 389,
      "averageProjectedPointDelta": 5.013,
      "medianProjectedPointDelta": 7.5,
      "maxAbsProjectedPointDelta": 7.5,
      "rowsMoving5PlusPoints": 260,
      "rowsMoving10PlusPoints": 0,
      "rowsMoving20PlusPoints": 0
    }
  ]
}
```

## Player Reasoning Impact

```json
{
  "estimateMethod": "representative_reason_stack_projection_delta",
  "limitation": "Reason stack comparison uses representative inputs from projection artifacts. Exact comparison needs persisted War Room row shapes including value score, PAR, role, plan fit, trust reasons, warnings, and data gaps.",
  "rowsWhereReasoningWouldLikelyChange": 50,
  "rowsWhereHeadlineChanges": 0,
  "rowsWhereProjectionReasonsChange": 50,
  "rowsWhereRiskReasonsChange": 0,
  "rowsWhereDataGapReasonsChange": 0,
  "topExamples": [
    {
      "playerId": "12490",
      "player": "Bhayshul Tuten",
      "position": "RB",
      "team": "JAX",
      "projectedPointDelta": 18,
      "currentProjection": 54,
      "v82Projection": 72,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "12469",
      "player": "Dylan Sampson",
      "position": "RB",
      "team": "CLE",
      "projectedPointDelta": 17.4,
      "currentProjection": 54,
      "v82Projection": 71.4,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "8159",
      "player": "Desmond Ridder",
      "position": "QB",
      "team": "GB",
      "projectedPointDelta": 16.2,
      "currentProjection": 42.5,
      "v82Projection": 58.7,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "11646",
      "player": "Jalen Coker",
      "position": "WR",
      "team": "CAR",
      "projectedPointDelta": 13,
      "currentProjection": 102.3,
      "v82Projection": 115.3,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "9504",
      "player": "Kayshon Boutte",
      "position": "WR",
      "team": "NE",
      "projectedPointDelta": 12.6,
      "currentProjection": 91,
      "v82Projection": 103.6,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "3161",
      "player": "Carson Wentz",
      "position": "QB",
      "team": "MIN",
      "projectedPointDelta": 12.4,
      "currentProjection": 37.2,
      "v82Projection": 49.6,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "13557",
      "player": "Athan Kaliakmanis",
      "position": "QB",
      "team": "WAS",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "13295",
      "player": "Behren Morton",
      "position": "QB",
      "team": "NE",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "5817",
      "player": "Byron Leftwich",
      "position": "QB",
      "team": "PIT",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "13303",
      "player": "Cade Klubnik",
      "position": "QB",
      "team": "NYJ",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "13272",
      "player": "Carson Beck",
      "position": "QB",
      "team": "ARI",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "13335",
      "player": "Cole Payton",
      "position": "QB",
      "team": "PHI",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "13289",
      "player": "Drew Allar",
      "position": "QB",
      "team": "PIT",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "13269",
      "player": "Fernando Mendoza",
      "position": "QB",
      "team": "LV",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "13404",
      "player": "Garrett Nussmeier",
      "position": "QB",
      "team": "KC",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "13415",
      "player": "Haynes King",
      "position": "QB",
      "team": "CAR",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "13602",
      "player": "Jack Strand",
      "position": "QB",
      "team": "ATL",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "13802",
      "player": "Jacob Clark",
      "position": "QB",
      "team": "LV",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "13425",
      "player": "Jalon Daniels",
      "position": "QB",
      "team": "TB",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "13350",
      "player": "Joe Fagnano",
      "position": "QB",
      "team": "BAL",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "13428",
      "player": "Joey Aguilar",
      "position": "QB",
      "team": "JAX",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "5833",
      "player": "Kevin O'Connell",
      "position": "QB",
      "team": "NYJ",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "7",
      "player": "Kurt Warner",
      "position": "QB",
      "team": "ARI",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "13599",
      "player": "Kyron Drones",
      "position": "QB",
      "team": "GB",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    },
    {
      "playerId": "13314",
      "player": "Luke Altmyer",
      "position": "QB",
      "team": "DET",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_reasons"
      ],
      "note": "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."
    }
  ],
  "requiredFutureData": [
    "Persist or export representative AvailablePlayer/BlackbirdBoardRow inputs.",
    "Include projection trust reasons, contextual reasons, plan fit reasons, role fields, and current warning/data-gap arrays."
  ]
}
```

## GM Brief Impact

```json
{
  "estimateMethod": "representative_ai_context_projection_delta",
  "limitation": "GM Brief comparison uses deterministic representative AI context built from projection artifact rows. Exact comparison needs a frozen draft room fixture with live recommendations, roster needs, scarcity, recent picks, warnings, and data gaps.",
  "headlineChanged": false,
  "topRecommendationSummaryChanged": true,
  "rosterNeedSummaryChanged": false,
  "scarcityRiskSummaryChanged": false,
  "watchListChanged": false,
  "dataGapsChanged": false,
  "requiredFutureData": [
    "Representative draft room fixture with live top suggestions and available board rows.",
    "Roster construction needs and scarcity summaries from the same draft state.",
    "Risk/confidence summaries and data gaps from production War Room state."
  ]
}
```

## Plan Alignment Impact

```json
{
  "estimateMethod": "extracted_helper_exact_available_fields",
  "limitation": "Exact helper comparison is available for fields present in H14.2 impact rows. Full live chip labels still depend on live AvailablePlayer score components, but v8.2 changes only projected points in this dry-run path and does not alter helper inputs.",
  "rowsWithPlanAlignmentEstimate": 50,
  "planFitChangedRows": 0,
  "needFitChangedRows": 0,
  "valueFitChangedRows": 0,
  "scarcityFitChangedRows": 0,
  "formatFitChangedRows": 0,
  "depthLuxuryRiskCheckChangedRows": 0,
  "topExamples": [],
  "notEstimatedRows": 0,
  "notEstimatedReason": null
}
```

## Risk / Confidence Impact

```json
{
  "riskConfidenceEstimated": "yes",
  "limitation": "v8.2 safe-subset selection changes expected games/projected points only in the reviewed artifacts. Risk/confidence labels are not recomputed by H14.3 and therefore no chip changes are expected from v8.2 alone.",
  "riskChipChangedRows": 0,
  "confidenceChipChangedRows": 0,
  "riskSummaryChanged": false,
  "topExamples": [
    {
      "playerId": "12490",
      "player": "Bhayshul Tuten",
      "position": "RB",
      "team": "JAX",
      "projectedPointDelta": 18,
      "currentProjection": 54,
      "v82Projection": 72,
      "changedFields": [
        "projection_only_no_risk_confidence_change"
      ],
      "note": "Projected points changed, but no risk/confidence artifact field changed."
    },
    {
      "playerId": "12469",
      "player": "Dylan Sampson",
      "position": "RB",
      "team": "CLE",
      "projectedPointDelta": 17.4,
      "currentProjection": 54,
      "v82Projection": 71.4,
      "changedFields": [
        "projection_only_no_risk_confidence_change"
      ],
      "note": "Projected points changed, but no risk/confidence artifact field changed."
    },
    {
      "playerId": "8159",
      "player": "Desmond Ridder",
      "position": "QB",
      "team": "GB",
      "projectedPointDelta": 16.2,
      "currentProjection": 42.5,
      "v82Projection": 58.7,
      "changedFields": [
        "projection_only_no_risk_confidence_change"
      ],
      "note": "Projected points changed, but no risk/confidence artifact field changed."
    },
    {
      "playerId": "11646",
      "player": "Jalen Coker",
      "position": "WR",
      "team": "CAR",
      "projectedPointDelta": 13,
      "currentProjection": 102.3,
      "v82Projection": 115.3,
      "changedFields": [
        "projection_only_no_risk_confidence_change"
      ],
      "note": "Projected points changed, but no risk/confidence artifact field changed."
    },
    {
      "playerId": "9504",
      "player": "Kayshon Boutte",
      "position": "WR",
      "team": "NE",
      "projectedPointDelta": 12.6,
      "currentProjection": 91,
      "v82Projection": 103.6,
      "changedFields": [
        "projection_only_no_risk_confidence_change"
      ],
      "note": "Projected points changed, but no risk/confidence artifact field changed."
    },
    {
      "playerId": "3161",
      "player": "Carson Wentz",
      "position": "QB",
      "team": "MIN",
      "projectedPointDelta": 12.4,
      "currentProjection": 37.2,
      "v82Projection": 49.6,
      "changedFields": [
        "projection_only_no_risk_confidence_change"
      ],
      "note": "Projected points changed, but no risk/confidence artifact field changed."
    },
    {
      "playerId": "13557",
      "player": "Athan Kaliakmanis",
      "position": "QB",
      "team": "WAS",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_only_no_risk_confidence_change"
      ],
      "note": "Projected points changed, but no risk/confidence artifact field changed."
    },
    {
      "playerId": "13295",
      "player": "Behren Morton",
      "position": "QB",
      "team": "NE",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_only_no_risk_confidence_change"
      ],
      "note": "Projected points changed, but no risk/confidence artifact field changed."
    },
    {
      "playerId": "5817",
      "player": "Byron Leftwich",
      "position": "QB",
      "team": "PIT",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_only_no_risk_confidence_change"
      ],
      "note": "Projected points changed, but no risk/confidence artifact field changed."
    },
    {
      "playerId": "13303",
      "player": "Cade Klubnik",
      "position": "QB",
      "team": "NYJ",
      "projectedPointDelta": 12,
      "currentProjection": 12,
      "v82Projection": 24,
      "changedFields": [
        "projection_only_no_risk_confidence_change"
      ],
      "note": "Projected points changed, but no risk/confidence artifact field changed."
    }
  ]
}
```

## Protected Row Checks

```json
{
  "kRowsDoNotUseV82": true,
  "criticalMovementRowsDoNotUseV82": true,
  "meaningfulRankMoversDoNotUseV82": true,
  "legacyStaleRowsDoNotUseV82": true,
  "missingArtifactsFailClosed": true
}
```

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| no_live_outputs_changed | PASS | Report reads artifacts and writes only local H14.3 review artifacts. |
| no_supabase_writes | PASS | No Supabase client or persistence API is imported or called. |
| rankings_unchanged_by_default | PASS | Blackbird Rank ordering is not imported, recalculated, or mutated. |
| draft_suggestions_unchanged_by_default | PASS | Draft Suggestion ordering is not imported, recalculated, or mutated. |
| war_room_unchanged_by_default | PASS | War Room UI/API behavior is not imported or changed. |
| no_ai_api_calls | PASS | Only deterministic local AI context and GM Brief builders are used; no model/API client is imported. |
| safe_subset_only | PASS | 50 safe-subset row(s) sampled from H14.2 top movers. |
| protected_rows_preserved | PASS | Protected-row checks are carried forward from H14.2. |
| war_room_value_impact_estimated_or_explained | PASS | Value impact is estimated with projected-point delta proxy. |
| player_reasoning_impact_estimated_or_explained | PASS | Representative reason stack comparison generated or fallback explanation provided. |
| gm_brief_impact_estimated_or_explained | PASS | Representative GM Brief comparison generated or fallback explanation provided. |
| plan_alignment_impact_estimated_or_explained | PASS | Plan Alignment labels are compared through the extracted deterministic helper. |
| risk_confidence_impact_estimated_or_explained | PASS | Risk/confidence impact is reported as projection-only no-change from available artifacts. |

## Notes

- H14.3 is dry-run/read-only and writes only local backtesting artifacts.
- No live selector, Blackbird Rank, Draft Suggestion, War Room UI/API, Supabase write, or AI API path is changed.
- War Room value is estimated with projected-point delta as a proxy because full H10 value overlay and live draft context are not replayed.
- Reason stack and GM Brief comparisons use deterministic representative rows built from artifact fields; exact production comparison requires persisted War Room row fixtures.
- Plan Alignment labels are compared through the extracted deterministic helper. v8.2 projection deltas do not alter any helper input fields in this dry-run path.
