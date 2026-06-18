# Projection Rank Impact Quality Review 2026

Dry run: true
Read only: true
Recommendation: rank_impact_needs_tier_review

## Summary

```json
{
  "eligibleRows": 3245,
  "meaningfulOverallRankMovers": 15,
  "meaningfulPositionRankMovers": 27,
  "smallPointsLargeRankNoiseRows": 1674,
  "deepTierNoiseRows": 2275,
  "qbSuperflexSensitiveRows": 4
}
```

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| no_live_outputs_changed | PASS | Rank impact quality review reads dry-run artifacts and writes only review artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is imported or called. |
| rankings_unchanged | PASS | Rank movement is copied from dry-run shadow and limited-pool artifacts only. |
| draft_suggestions_unchanged | PASS | Draft suggestion code paths are not imported or executed. |
| war_room_unchanged | PASS | War Room UI code is not imported or modified. |
| eligible_pool_only | PASS | 3245/3245 eligible rows reviewed. |
| critical_movements_excluded | PASS | 54 critical movement rows excluded. |
| k_rows_excluded | PASS | 127 K rows excluded. |
| legacy_rows_excluded | PASS | 1245 legacy/retired rows excluded. |
| rank_quality_review_generated | PASS | 3245 rank quality rows generated. |
| meaningful_rank_movements_reported | PASS | 15 meaningful overall movers and 27 meaningful position movers reported. |
| deep_tier_noise_identified | PASS | 2275 deep-tier noise row(s) identified. |

## Relevance Tier Summaries

| Tier | Rows | Avg Pts | Median Pts | Avg Overall Move | Avg Pos Move | Pos 10+ | Overall 50+ |
|---|---:|---:|---:|---:|---:|---:|---:|
| overall_top_50 | 46 | 0.53 | 0 | -0.13 | 0 | 0 | 0 |
| overall_top_100 | 95 | 1.18 | 0 | -0.39 | 0.02 | 0 | 0 |
| overall_top_200 | 187 | 0.91 | 0 | -0.44 | -0.05 | 0 | 1 |
| overall_top_300 | 270 | 0.91 | 0 | -0.92 | -0.03 | 1 | 3 |
| overall_top_500 | 412 | 0.86 | 0 | -2.29 | -0.32 | 14 | 13 |
| overall_500_plus | 2833 | 1.43 | 0 | -9.75 | -3.42 | 1929 | 2200 |
| position_starter_tier | 274 | 1.19 | 0 | 0.2 | -0.34 | 1 | 8 |
| position_depth_tier | 227 | 0.85 | 0 | -6.74 | -0.12 | 24 | 48 |
| position_deep_tier | 2744 | 1.42 | 0 | -9.87 | -3.54 | 1918 | 2157 |
| near_zero_projection | 57 | 0.1 | 0 | -91.02 | -13.84 | 33 | 40 |

## Point Delta Bucket Summaries

| Tier | Rows | Avg Pts | Median Pts | Avg Overall Move | Avg Pos Move | Pos 10+ | Overall 50+ |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0 | 1724 | 0 | 0 | -266.42 | -30.29 | 1111 | 1256 |
| 0-2 | 582 | 0.31 | 0.3 | -186.71 | -7.42 | 314 | 351 |
| 2-5 | 383 | 1.83 | 2.6 | -6.92 | 0.96 | 48 | 106 |
| 5-10 | 511 | 6.18 | 7.5 | 951.92 | 87.59 | 440 | 460 |
| 10-20 | 45 | 8.37 | 12 | 1236.31 | 35.18 | 30 | 40 |

## Draftable Range Summaries

| Segment | Rows | Avg Pts | Pos 5+ | Pos 10+ | Overall 25+ | Overall 50+ |
|---|---:|---:|---:|---:|---:|---:|
| top_50_overall | 46 | 0.53 | 0 | 0 | 0 | 0 |
| top_100_overall | 95 | 1.18 | 1 | 0 | 1 | 0 |
| top_150_overall | 140 | 0.84 | 3 | 0 | 4 | 1 |
| top_200_overall | 187 | 0.91 | 7 | 0 | 7 | 1 |
| top_300_overall | 270 | 0.91 | 20 | 1 | 15 | 3 |
| top_500_overall | 412 | 0.86 | 65 | 14 | 40 | 13 |

## Position Range Summaries

| Segment | Rows | Avg Pts | Pos 5+ | Pos 10+ | Overall 25+ | Overall 50+ |
|---|---:|---:|---:|---:|---:|---:|
| QB_top_12 | 10 | 0 | 0 | 0 | 0 | 0 |
| QB_top_24 | 21 | 0.35 | 1 | 0 | 0 | 0 |
| QB_top_36 | 31 | -0.18 | 1 | 0 | 3 | 1 |
| QB_top_50 | 38 | 0.69 | 2 | 0 | 10 | 6 |
| RB_top_24 | 23 | 1.74 | 0 | 0 | 0 | 0 |
| RB_top_48 | 41 | 1.33 | 7 | 0 | 8 | 1 |
| RB_top_72 | 50 | 0.76 | 10 | 1 | 15 | 5 |
| RB_top_100 | 64 | 0.99 | 18 | 7 | 27 | 17 |
| WR_top_36 | 38 | 0.47 | 3 | 0 | 4 | 0 |
| WR_top_72 | 64 | -0.48 | 8 | 0 | 10 | 3 |
| WR_top_100 | 84 | -0.23 | 21 | 6 | 25 | 12 |
| WR_top_150 | 117 | -0.83 | 31 | 13 | 56 | 37 |
| TE_top_12 | 11 | 0 | 0 | 0 | 0 | 0 |
| TE_top_24 | 22 | 0 | 0 | 0 | 0 | 0 |
| TE_top_36 | 33 | 0 | 0 | 0 | 0 | 0 |
| TE_top_50 | 41 | 0 | 0 | 0 | 0 | 0 |
| DL_top_24 | 23 | 3.91 | 0 | 0 | 6 | 1 |
| DL_top_48 | 42 | 3.74 | 3 | 1 | 15 | 4 |
| DL_top_72 | 62 | 3.52 | 4 | 1 | 19 | 4 |
| DL_top_100 | 86 | 3.37 | 7 | 1 | 27 | 4 |
| LB_top_24 | 21 | 2.46 | 0 | 0 | 0 | 0 |
| LB_top_48 | 43 | 1.3 | 1 | 0 | 0 | 0 |
| LB_top_72 | 65 | 0.82 | 1 | 0 | 0 | 0 |
| LB_top_100 | 87 | 0.62 | 1 | 0 | 0 | 0 |
| DB_top_24 | 22 | 1.91 | 0 | 0 | 0 | 0 |
| DB_top_48 | 41 | 2.03 | 4 | 0 | 0 | 0 |
| DB_top_72 | 65 | 1.82 | 21 | 6 | 1 | 0 |
| DB_top_100 | 86 | 2.02 | 33 | 8 | 3 | 0 |

## QB / Superflex Review

```json
{
  "eligibleQbRows": 191,
  "rowsMoving5PlusPositionRanks": 143,
  "rowsMoving10PlusPositionRanks": 133,
  "top12MeaningfulRows": 0,
  "top24MeaningfulRows": 1,
  "top36MeaningfulRows": 4
}
```

## Top Meaningful Overall-Rank Movers

| Player | Pos | Team | Pts Delta | Best OVR | OVR Move | Best Pos | Pos Move | Flags |
|---|---|---|---:|---:|---:|---:|---:|---|
| Chris Godwin | WR | TB | -12.8 | 218 | -63 | 51 | -6 | top_300_overall_movement, starter_tier_position_movement |
| Jacoby Brissett | QB | ARI | -13.9 | 150 | -50 | 32 | -1 | top_200_overall_movement, qb_superflex_sensitive_movement |
| Kareem Hunt | RB | KC | 12.4 | 221 | 50 | 32 | 0 | top_300_overall_movement |
| Joe Flacco | QB | CIN | -17 | 95 | -47 | 28 | -3 | top_100_overall_movement, qb_superflex_sensitive_movement |
| Leonard Williams | DL | SEA | 7 | 291 | 43 | 7 | 1 | top_300_overall_movement |
| Christian Watson | WR | GB | -5.4 | 281 | -39 | 60 | -2 | top_300_overall_movement |
| Cooper Kupp | WR | SEA | 10.8 | 161 | 35 | 36 | 9 | top_200_overall_movement, starter_tier_position_movement |
| Mac Jones | QB | SF | -4.2 | 300 | -34 | 37 | -1 | top_300_overall_movement |
| Ja'Quan McMillian | DB | DEN | 7.1 | 283 | 32 | 58 | 15 | top_300_overall_movement |
| Brandon Aiyuk | WR | SF | -5.7 | 241 | -31 | 54 | -1 | top_300_overall_movement |
| Mike Evans | WR | SF | -11.1 | 143 | -30 | 35 | -4 | top_200_overall_movement |
| Rico Dowdle | RB | PIT | 9.9 | 155 | 30 | 26 | 1 | top_200_overall_movement |
| Quentin Johnston | WR | LAC | -6.4 | 161 | -30 | 36 | -7 | top_200_overall_movement, starter_tier_position_movement |
| Terry McLaurin | WR | WAS | -11.7 | 108 | -28 | 27 | -6 | top_200_overall_movement, starter_tier_position_movement |
| Will Levis | QB | TEN | -4.5 | 249 | -26 | 35 | -1 | top_300_overall_movement, qb_superflex_sensitive_movement |

## Top Meaningful Position-Rank Movers

| Player | Pos | Team | Pts Delta | Best OVR | OVR Move | Best Pos | Pos Move | Flags |
|---|---|---|---:|---:|---:|---:|---:|---|
| Derrick Brown | DL | CAR | -0.7 | 728 | -35 | 47 | -11 | starter_tier_position_movement, small_points_large_rank_noise, deep_tier_rank_noise |
| Cooper Kupp | WR | SEA | 10.8 | 161 | 35 | 36 | 9 | top_200_overall_movement, starter_tier_position_movement |
| Ezekiel Elliott | RB | LAC | -2.2 | 469 | -33 | 42 | -9 | starter_tier_position_movement |
| Isiah Pacheco | RB | DET | -1.7 | 484 | -27 | 44 | -9 | starter_tier_position_movement |
| Tyler Allgeier | RB | ARI | -1.4 | 465 | -24 | 41 | -9 | starter_tier_position_movement |
| Zack Moss | RB | CIN | -4 | 488 | -47 | 47 | -8 | starter_tier_position_movement |
| Jayden Reed | WR | GB | -11.3 | 305 | -88 | 63 | -7 | starter_tier_position_movement |
| Quentin Johnston | WR | LAC | -6.4 | 161 | -30 | 36 | -7 | top_200_overall_movement, starter_tier_position_movement |
| Tank Dell | WR | HOU | 5 | 184 | 16 | 40 | 7 | starter_tier_position_movement |
| Chris Godwin | WR | TB | -12.8 | 218 | -63 | 51 | -6 | top_300_overall_movement, starter_tier_position_movement |
| Daniel Jones | QB | IND | -12 | 78 | -24 | 23 | -6 | starter_tier_position_movement, qb_superflex_sensitive_movement |
| Terry McLaurin | WR | WAS | -11.7 | 108 | -28 | 27 | -6 | top_200_overall_movement, starter_tier_position_movement |
| DeAndre Hopkins | WR | BAL | -6.4 | 406 | -50 | 72 | -6 | starter_tier_position_movement |
| Rome Odunze | WR | CHI | -6.2 | 188 | -21 | 43 | -6 | starter_tier_position_movement |
| Brian Robinson | RB | ATL | -5.5 | 328 | -45 | 33 | -6 | starter_tier_position_movement |
| Trey Hendrickson | DL | BAL | 7.4 | 575 | 51 | 32 | 5 | starter_tier_position_movement, deep_tier_rank_noise |
| Jalen Thompson | DB | DAL | 4.2 | 239 | 13 | 39 | 5 | starter_tier_position_movement |
| Quentin Lake | DB | LAR | 4.2 | 240 | 13 | 40 | 5 | starter_tier_position_movement |
| Fred Warner | LB | SF | -4.1 | 144 | -9 | 35 | -5 | starter_tier_position_movement |
| Jalen Carter | DL | PHI | 2.6 | 586 | 0 | 30 | -5 | starter_tier_position_movement |
| Devin Singletary | RB | NYG | -1.4 | 445 | -16 | 40 | -5 | starter_tier_position_movement |
| Tyjae Spears | RB | TEN | -0.9 | 429 | -14 | 39 | -5 | starter_tier_position_movement |
| Jacob Parrish | DB | TB | 0 | 220 | -7 | 32 | -5 | starter_tier_position_movement |
| Kamren Kinchens | DB | LAR | 0 | 251 | -5 | 43 | -5 | starter_tier_position_movement |
| Joe Flacco | QB | CIN | -17 | 95 | -47 | 28 | -3 | top_100_overall_movement, qb_superflex_sensitive_movement |

## Top Small-Points Large-Rank Noise

| Player | Pos | Team | Pts Delta | Best OVR | OVR Move | Best Pos | Pos Move | Flags |
|---|---|---|---:|---:|---:|---:|---:|---|
| Trent Sherfield | WR | BUF | -1.7 | 2622 | -1498 | 347 | -630 | small_points_large_rank_noise, deep_tier_rank_noise |
| C.J. Ham | RB | MIN | -0.8 | 2616 | -1390 | 229 | -279 | small_points_large_rank_noise, deep_tier_rank_noise |
| Ajani Carter | DB | HOU | -0.6 | 2653 | -1362 | 675 | -144 | small_points_large_rank_noise, deep_tier_rank_noise |
| Alex Carter | DB | WAS | -0.6 | 2657 | -1359 | 676 | -144 | small_points_large_rank_noise, deep_tier_rank_noise |
| Ben DeLuca | DB | LAC | -0.6 | 2698 | -1320 | 681 | -140 | small_points_large_rank_noise, deep_tier_rank_noise |
| Brandon Hill | DB | HOU | -0.6 | 2712 | -1307 | 684 | -138 | small_points_large_rank_noise, deep_tier_rank_noise |
| Bryan Mills | DB | MIN | -0.6 | 2731 | -1289 | 686 | -137 | small_points_large_rank_noise, deep_tier_rank_noise |
| Craig Mager | DB | DEN | -0.6 | 2816 | -1206 | 701 | -123 | small_points_large_rank_noise, deep_tier_rank_noise |
| DaMarcus Fields | DB | WAS | -0.6 | 2832 | -1191 | 706 | -119 | small_points_large_rank_noise, deep_tier_rank_noise |
| D'Ernest Johnson | RB | NE | -0.1 | 2820 | -1173 | 279 | -226 | small_points_large_rank_noise, deep_tier_rank_noise |
| Daryl Porter | DB | PIT | -0.6 | 2863 | -1161 | 707 | -119 | small_points_large_rank_noise, deep_tier_rank_noise |
| David Rivers | DB | MIA | -0.6 | 2866 | -1159 | 709 | -118 | small_points_large_rank_noise, deep_tier_rank_noise |
| Delrick Abrams | DB | LA | -0.6 | 2888 | -1138 | 713 | -115 | small_points_large_rank_noise, deep_tier_rank_noise |
| Dominique Hampton | DB | CHI | -0.6 | 2935 | -1092 | 724 | -105 | small_points_large_rank_noise, deep_tier_rank_noise |
| Don Carey | DB | DET | -0.6 | 2937 | -1091 | 726 | -104 | small_points_large_rank_noise, deep_tier_rank_noise |
| Don Gardner | DB | TB | -0.6 | 2938 | -1091 | 727 | -104 | small_points_large_rank_noise, deep_tier_rank_noise |
| Donovan Olumba | DB | LA | -0.6 | 2942 | -1088 | 728 | -104 | small_points_large_rank_noise, deep_tier_rank_noise |
| Ekow Boye-Doe | DB | ARI | -0.6 | 2966 | -1066 | 730 | -103 | small_points_large_rank_noise, deep_tier_rank_noise |
| Elijah Benton | DB | NYJ | -0.6 | 2969 | -1064 | 731 | -103 | small_points_large_rank_noise, deep_tier_rank_noise |
| Ethan Robinson | DB | MIA | -0.6 | 2993 | -1043 | 735 | -100 | small_points_large_rank_noise, deep_tier_rank_noise |
| Gabe Jeudy-Lally | DB | TEN | -0.6 | 3002 | -1035 | 737 | -99 | small_points_large_rank_noise, deep_tier_rank_noise |
| Harlan Miller | DB | WAS | -0.6 | 3023 | -1015 | 739 | -98 | small_points_large_rank_noise, deep_tier_rank_noise |
| Jamar Johnson | DB | DEN | -0.6 | 3100 | -940 | 752 | -86 | small_points_large_rank_noise, deep_tier_rank_noise |
| James Wiggins | DB | KC | -0.6 | 3105 | -937 | 753 | -86 | small_points_large_rank_noise, deep_tier_rank_noise |
| Jameson Houston | DB | MIN | -0.6 | 3107 | -936 | 754 | -86 | small_points_large_rank_noise, deep_tier_rank_noise |

## Top Deep-Tier Rank Noise

| Player | Pos | Team | Pts Delta | Best OVR | OVR Move | Best Pos | Pos Move | Flags |
|---|---|---|---:|---:|---:|---:|---:|---|
| Ty Simpson | QB | LAR | 12 | 2143 | 2197 | 124 | 102 | deep_tier_rank_noise |
| Taylen Green | QB | CLE | 12 | 2141 | 2191 | 123 | 99 | deep_tier_rank_noise |
| Mike Hartline | QB | IND | 12 | 2137 | 2170 | 119 | 84 | deep_tier_rank_noise |
| Miller Moss | QB | CHI | 12 | 2138 | 2170 | 120 | 84 | deep_tier_rank_noise |
| Matthew Caldwell | QB | LAR | 12 | 2136 | 2167 | 118 | 81 | deep_tier_rank_noise |
| Mark Gronowski | QB | MIA | 12 | 2135 | 2166 | 117 | 80 | deep_tier_rank_noise |
| Luke Altmyer | QB | DET | 12 | 2134 | 2165 | 116 | 79 | deep_tier_rank_noise |
| Kyron Drones | QB | GB | 12 | 2132 | 2164 | 115 | 78 | deep_tier_rank_noise |
| Kevin O'Connell | QB | NYJ | 12 | 2129 | 2161 | 113 | 74 | deep_tier_rank_noise |
| Kurt Warner | QB | ARI | 12 | 2131 | 2160 | 114 | 74 | deep_tier_rank_noise |
| Joey Aguilar | QB | JAX | 12 | 2127 | 2152 | 112 | 66 | deep_tier_rank_noise |
| Joe Fagnano | QB | BAL | 12 | 2126 | 2151 | 111 | 65 | deep_tier_rank_noise |
| Jalon Daniels | QB | TB | 12 | 2125 | 2144 | 110 | 60 | deep_tier_rank_noise |
| Jack Strand | QB | ATL | 12 | 2122 | 2140 | 108 | 56 | deep_tier_rank_noise |
| Jacob Clark | QB | LV | 12 | 2123 | 2140 | 109 | 56 | deep_tier_rank_noise |
| Haynes King | QB | CAR | 12 | 2120 | 2135 | 107 | 50 | deep_tier_rank_noise |
| Fernando Mendoza | QB | LV | 12 | 2118 | 2132 | 105 | 48 | deep_tier_rank_noise |
| Garrett Nussmeier | QB | KC | 12 | 2119 | 2132 | 106 | 48 | deep_tier_rank_noise |
| Drew Allar | QB | PIT | 12 | 2116 | 2125 | 104 | 41 | deep_tier_rank_noise |
| Cole Payton | QB | PHI | 12 | 2115 | 2112 | 103 | 32 | deep_tier_rank_noise |
| Carson Beck | QB | ARI | 12 | 2113 | 2104 | 102 | 24 | deep_tier_rank_noise |
| Byron Leftwich | QB | PIT | 12 | 2111 | 2102 | 100 | 23 | deep_tier_rank_noise |
| Cade Klubnik | QB | NYJ | 12 | 2112 | 2102 | 101 | 23 | deep_tier_rank_noise |
| Behren Morton | QB | NE | 12 | 2109 | 2099 | 99 | 19 | deep_tier_rank_noise |
| Athan Kaliakmanis | QB | WAS | 12 | 2108 | 2097 | 98 | 17 | deep_tier_rank_noise |

## Top QB Rank Movers

| Player | Pos | Team | Pts Delta | Best OVR | OVR Move | Best Pos | Pos Move | Flags |
|---|---|---|---:|---:|---:|---:|---:|---|
| Ty Simpson | QB | LAR | 12 | 2143 | 2197 | 124 | 102 | deep_tier_rank_noise |
| Taylen Green | QB | CLE | 12 | 2141 | 2191 | 123 | 99 | deep_tier_rank_noise |
| Mike Hartline | QB | IND | 12 | 2137 | 2170 | 119 | 84 | deep_tier_rank_noise |
| Miller Moss | QB | CHI | 12 | 2138 | 2170 | 120 | 84 | deep_tier_rank_noise |
| Matthew Caldwell | QB | LAR | 12 | 2136 | 2167 | 118 | 81 | deep_tier_rank_noise |
| Mark Gronowski | QB | MIA | 12 | 2135 | 2166 | 117 | 80 | deep_tier_rank_noise |
| Luke Altmyer | QB | DET | 12 | 2134 | 2165 | 116 | 79 | deep_tier_rank_noise |
| Kyron Drones | QB | GB | 12 | 2132 | 2164 | 115 | 78 | deep_tier_rank_noise |
| Kevin O'Connell | QB | NYJ | 12 | 2129 | 2161 | 113 | 74 | deep_tier_rank_noise |
| Kurt Warner | QB | ARI | 12 | 2131 | 2160 | 114 | 74 | deep_tier_rank_noise |
| Joey Aguilar | QB | JAX | 12 | 2127 | 2152 | 112 | 66 | deep_tier_rank_noise |
| Joe Fagnano | QB | BAL | 12 | 2126 | 2151 | 111 | 65 | deep_tier_rank_noise |
| Jalon Daniels | QB | TB | 12 | 2125 | 2144 | 110 | 60 | deep_tier_rank_noise |
| Jack Strand | QB | ATL | 12 | 2122 | 2140 | 108 | 56 | deep_tier_rank_noise |
| Jacob Clark | QB | LV | 12 | 2123 | 2140 | 109 | 56 | deep_tier_rank_noise |
| Haynes King | QB | CAR | 12 | 2120 | 2135 | 107 | 50 | deep_tier_rank_noise |
| Fernando Mendoza | QB | LV | 12 | 2118 | 2132 | 105 | 48 | deep_tier_rank_noise |
| Garrett Nussmeier | QB | KC | 12 | 2119 | 2132 | 106 | 48 | deep_tier_rank_noise |
| Kevin Hogan | QB | TEN | 0.6 | 4180 | 109 | 144 | 42 | small_points_large_rank_noise, deep_tier_rank_noise |
| Drew Allar | QB | PIT | 12 | 2116 | 2125 | 104 | 41 | deep_tier_rank_noise |
| Alek Torgersen | QB | DET | 0 | 4198 | -110 | 112 | -36 | small_points_large_rank_noise, deep_tier_rank_noise |
| Andrew Peasley | QB | NYJ | 0 | 4202 | -107 | 113 | -36 | small_points_large_rank_noise, deep_tier_rank_noise |
| Anthony Gordon | QB | DEN | 0 | 4203 | -107 | 114 | -36 | small_points_large_rank_noise, deep_tier_rank_noise |
| Drew Lock | QB | SEA | -1 | 2239 | -559 | 98 | -35 | small_points_large_rank_noise, deep_tier_rank_noise |
| Austin Reed | QB | CHI | 0 | 4207 | -106 | 117 | -35 | small_points_large_rank_noise, deep_tier_rank_noise |

## Notes

- Dry-run/read-only rank impact quality review only.
- Rank movement is evaluated only for rows in the limited eligible promotion pool.
- Large rank movement in deep or near-zero projection tiers is classified as noise rather than direct draft-impact signal.
- No live projections, 2026 production outputs, Supabase writes, War Room UI, Blackbird Rank, or Draft Suggestion ordering are changed.
