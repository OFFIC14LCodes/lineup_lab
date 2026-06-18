# Projection Limited Promotion-Pool Review 2026

Dry run: true
Read only: true
Recommendation: limited_pool_needs_rank_impact_review

## Excluded Counts

```json
{
  "criticalMovementRowsExcluded": 54,
  "kRowsExcluded": 127,
  "legacyRetiredRowsExcluded": 1245,
  "shadowOnlyRowsExcluded": 1145,
  "blockedRowsExcluded": 1245,
  "manualReviewRowsRemaining": 0
}
```

## Eligible-Pool Movement Summary

```json
{
  "rows": 3245,
  "averageExpectedGamesDelta": 0.42,
  "averageProjectedPointDelta": 1.36,
  "medianProjectedPointDelta": 0,
  "maxProjectedPointDelta": 18,
  "movementBuckets": {
    "0": 1724,
    "0-5": 965,
    "5-10": 511,
    "10-20": 45,
    "20+": 0
  },
  "expectedGamesMovementBuckets": {
    "0": 1712,
    "0-0.5": 769,
    "0.5-1": 249,
    "1-2": 68,
    "2-4": 447,
    "4+": 0
  }
}
```

## Rank Impact Preview

```json
{
  "estimated": true,
  "reason": "Rank movement copied from v8.2 shadow report estimates.",
  "rowsWithRankMovementEstimate": 3245,
  "rowsMoving5PlusPositionRanks": 2277,
  "rowsMoving10PlusPositionRanks": 1943,
  "rowsMoving25PlusOverallRanks": 2536,
  "rowsMoving50PlusOverallRanks": 2213
}
```

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| no_live_outputs_changed | PASS | Limited pool review reads dry-run artifacts and writes only review artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is imported or called. |
| rankings_unchanged | PASS | Rank movement is estimated from dry-run shadow artifacts only. |
| draft_suggestions_unchanged | PASS | Draft suggestion code paths are not imported or executed. |
| war_room_unchanged | PASS | War Room UI code is not imported or modified. |
| eligible_pool_generated | PASS | 3245 eligible row(s). |
| manual_review_rows_zero | PASS | 0 manual-review row(s) remaining. |
| critical_movements_excluded | PASS | 0 critical movement eligible row(s). |
| k_rows_excluded | PASS | 0 eligible K row(s). |
| legacy_rows_excluded | PASS | 0 eligible legacy row(s). |
| no_20_plus_movement_in_eligible_pool | PASS | 0 eligible 20+ movement row(s). |
| rank_impact_reported_or_explained | PASS | Rank movement copied from v8.2 shadow report estimates. |

## Position Summary

| Segment | Rows | Avg Point Move | 5+ | 10+ | 20+ |
|---|---:|---:|---:|---:|---:|
| QB | 191 | 2.25 | 47 | 34 | 0 |
| RB | 410 | 0.99 | 66 | 4 | 0 |
| WR | 850 | 0.53 | 152 | 7 | 0 |
| TE | 389 | 5.01 | 260 | 0 | 0 |
| DL | 427 | 1.58 | 14 | 0 | 0 |
| LB | 417 | 0.07 | 9 | 0 | 0 |
| DB | 561 | 0.85 | 8 | 0 | 0 |

## Cohort Summary

| Segment | Rows | Avg Point Move | 5+ | 10+ | 20+ |
|---|---:|---:|---:|---:|---:|
| active_plausible | 1588 | 0.79 | 118 | 20 | 0 |
| rookie_or_new_player | 1657 | 1.91 | 438 | 25 | 0 |
| low_prior_sample | 1750 | 1.86 | 443 | 28 | 0 |
| veteran_prior_sample | 1495 | 0.78 | 113 | 17 | 0 |
| offense | 1840 | 1.76 | 525 | 45 | 0 |
| idp | 1405 | 0.84 | 31 | 0 | 0 |

## Top Eligible Movements

| Player | Pos | Team | Universe | Current G | v8.2 G | PPG | Point Delta | Current Total | v8.2 Total | Pos Rank Move | Overall Rank Move |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Bhayshul Tuten | RB | JAX | active_plausible | 9 | 12 | 6 | 18 | 54 | 72 | 34 | 294 |
| Dylan Sampson | RB | CLE | active_plausible | 9 | 11.9 | 6 | 17.4 | 54 | 71.4 | 33 | 254 |
| Joe Flacco | QB | CIN | active_plausible | 14 | 12.8 | 14.2 | -17 | 198.8 | 181.8 | -3 | -47 |
| Desmond Ridder | QB | GB | active_plausible | 5 | 6.9 | 8.5 | 16.2 | 42.5 | 58.7 | 4 | 313 |
| Jacoby Brissett | QB | ARI | active_plausible | 14 | 12.9 | 12.6 | -13.9 | 176.4 | 162.5 | -1 | -50 |
| Jalen Coker | WR | CAR | active_plausible | 11 | 12.4 | 9.3 | 13 | 102.3 | 115.3 | 16 | 81 |
| Chris Godwin | WR | TB | active_plausible | 12 | 11 | 12.8 | -12.8 | 153.6 | 140.8 | -6 | -63 |
| Kayshon Boutte | WR | NE | active_plausible | 13 | 14.8 | 7 | 12.6 | 91 | 103.6 | 14 | 98 |
| Carson Wentz | QB | MIN | active_plausible | 3 | 4 | 12.4 | 12.4 | 37.2 | 49.6 | 8 | 282 |
| Kareem Hunt | RB | KC | active_plausible | 15 | 16.3 | 9.5 | 12.4 | 142.5 | 154.9 | 0 | 50 |
| Athan Kaliakmanis | QB | WAS | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 17 | 2097 |
| Behren Morton | QB | NE | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 19 | 2099 |
| Byron Leftwich | QB | PIT | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 23 | 2102 |
| Cade Klubnik | QB | NYJ | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 23 | 2102 |
| Carson Beck | QB | ARI | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 24 | 2104 |
| Cole Payton | QB | PHI | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 32 | 2112 |
| Daniel Jones | QB | IND | active_plausible | 14 | 13.2 | 15 | -12 | 210 | 198 | -6 | -24 |
| Drew Allar | QB | PIT | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 41 | 2125 |
| Fernando Mendoza | QB | LV | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 48 | 2132 |
| Garrett Nussmeier | QB | KC | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 48 | 2132 |
| Haynes King | QB | CAR | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 50 | 2135 |
| Jack Strand | QB | ATL | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 56 | 2140 |
| Jacob Clark | QB | LV | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 56 | 2140 |
| Jalon Daniels | QB | TB | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 60 | 2144 |
| Joe Fagnano | QB | BAL | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 65 | 2151 |
| Joey Aguilar | QB | JAX | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 66 | 2152 |
| Kevin O'Connell | QB | NYJ | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 74 | 2161 |
| Kurt Warner | QB | ARI | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 74 | 2160 |
| Kyron Drones | QB | GB | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 78 | 2164 |
| Luke Altmyer | QB | DET | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 79 | 2165 |
| Mark Gronowski | QB | MIA | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 80 | 2166 |
| Matthew Caldwell | QB | LAR | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 81 | 2167 |
| Mike Hartline | QB | IND | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 84 | 2170 |
| Miller Moss | QB | CHI | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 84 | 2170 |
| Taylen Green | QB | CLE | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 99 | 2191 |
| Ty Simpson | QB | LAR | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 102 | 2197 |
| Terry McLaurin | WR | WAS | active_plausible | 15 | 14.1 | 13 | -11.7 | 195 | 183.3 | -6 | -28 |
| Jayden Reed | WR | GB | active_plausible | 12 | 11 | 11.3 | -11.3 | 135.6 | 124.3 | -7 | -88 |
| Jake Browning | QB | TB | active_plausible | 5 | 6.4 | 8 | 11.2 | 40 | 51.2 | 6 | 235 |
| Brashard Smith | RB | KC | active_plausible | 9 | 12 | 3.7 | 11.1 | 33.3 | 44.4 | 22 | 263 |
| Mike Evans | WR | SF | active_plausible | 13 | 12.2 | 13.9 | -11.1 | 180.7 | 169.6 | -4 | -30 |
| Jayden Daniels | QB | WAS | active_plausible | 5 | 5.6 | 18.3 | 11 | 91.5 | 102.5 | 1 | 80 |
| Cooper Kupp | WR | SEA | active_plausible | 15 | 16 | 10.8 | 10.8 | 162 | 172.8 | 9 | 35 |
| Jameis Winston | QB | NYG | active_plausible | 5 | 5.9 | 11.4 | 10.3 | 57 | 67.3 | -3 | 158 |
| Davis Mills | QB | HOU | active_plausible | 5 | 6.5 | 6.8 | 10.2 | 34 | 44.2 | 9 | 243 |
| Rico Dowdle | RB | PIT | active_plausible | 15 | 15.9 | 11 | 9.9 | 165 | 174.9 | 1 | 30 |
| Zach Sieler | DL | MIA | active_plausible | 14 | 15.2 | 8.1 | 9.7 | 113.4 | 123.1 | 1 | 54 |
| Ollie Gordon | RB | MIA | active_plausible | 9 | 12 | 3.2 | 9.6 | 28.8 | 38.4 | 28 | 275 |
| Gardner Minshew | QB | ARI | active_plausible | 5 | 6.7 | 5.6 | 9.5 | 28 | 37.5 | 10 | 285 |
| Stefon Diggs | WR | NE | active_plausible | 16 | 16.7 | 13.4 | 9.4 | 214.4 | 223.8 | 3 | 12 |

## Top Position-Rank Risers

| Player | Pos | Team | Universe | Current G | v8.2 G | PPG | Point Delta | Current Total | v8.2 Total | Pos Rank Move | Overall Rank Move |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Zachariah Branch | WR | ATL | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 547 | 1265 |
| Xavier Loyd | WR | KC | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 546 | 1257 |
| Will Pauling | WR | SF | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 542 | 1251 |
| Wesley Grimes | WR | SF | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 541 | 1250 |
| Vinny Anthony | WR | ATL | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 539 | 1246 |
| Tyren Montgomery | WR | TEN | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 536 | 1242 |
| Treyvhon Saunders | WR | HOU | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 523 | 1225 |
| Trebor Pena | WR | JAX | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 519 | 1217 |
| Trayvon Rudolph | WR | MIN | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 516 | 1212 |
| Terrill Davis | WR | MIN | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 501 | 1188 |
| Ted Hurst | WR | TB | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 497 | 1184 |
| Sincere Brown | WR | LAC | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 481 | 1154 |
| Skyler Bell | WR | BUF | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 481 | 1154 |
| Sergio Bailey II | WR | TB | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 472 | 1138 |
| Sahmir Hagans | WR | IND | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 466 | 1129 |
| Romello Brinson | WR | DAL | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 462 | 1122 |
| Reggie Virgil | WR | ARI | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 456 | 1106 |
| Raylen Sharpe | WR | IND | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 452 | 1102 |
| Rashad Rochelle | WR | SEA | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 450 | 1099 |
| Omar Cooper | WR | NYJ | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 437 | 1072 |
| Omari Evans | WR | KC | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 437 | 1072 |
| Omari Kelly | WR | CHI | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 437 | 1072 |
| Octavian Smith | WR | BAL | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 434 | 1068 |
| Noah Thomas | WR | CIN | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 432 | 1065 |
| Nick DeGennaro | WR | NE | rookie_or_new_player | 5 | 7.1 | 3 | 6.3 | 15 | 21.3 | 430 | 1060 |

## Top Position-Rank Fallers

| Player | Pos | Team | Universe | Current G | v8.2 G | PPG | Point Delta | Current Total | v8.2 Total | Pos Rank Move | Overall Rank Move |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Trent Sherfield | WR | BUF | active_plausible | 9 | 8 | 1.7 | -1.7 | 15.3 | 13.6 | -630 | -1498 |
| C.J. Ham | RB | MIN | active_plausible | 9 | 8.5 | 1.7 | -0.8 | 15.3 | 14.5 | -279 | -1390 |
| Brevin Jordan | TE | HOU | active_plausible | 6 | 6 | 2.9 | 0 | 17.4 | 17.4 | -260 | -468 |
| Charlie Woerner | TE | ATL | active_plausible | 10 | 10 | 1.3 | 0 | 13 | 13 | -260 | -368 |
| Harrison Bryant | TE | SEA | active_plausible | 8 | 8 | 2.2 | 0 | 17.6 | 17.6 | -260 | -510 |
| Hunter Long | TE | JAX | active_plausible | 7 | 7 | 2.7 | 0 | 18.9 | 18.9 | -260 | -493 |
| Ian Thomas | TE | LV | active_plausible | 7 | 7 | 2 | 0 | 14 | 14 | -260 | -366 |
| Irv Smith | TE | HOU | active_plausible | 5 | 5 | 3.1 | 0 | 15.5 | 15.5 | -260 | -506 |
| Jelani Woods | TE | NYJ | active_plausible | 6 | 6 | 2.8 | 0 | 16.8 | 16.8 | -260 | -491 |
| Jody Fortson | TE | KC | active_plausible | 6 | 6 | 2.2 | 0 | 13.2 | 13.2 | -260 | -371 |
| Lucas Krull | TE | DEN | active_plausible | 6 | 6 | 2.5 | 0 | 15 | 15 | -260 | -390 |
| Payne Durham | TE | TB | active_plausible | 8 | 8 | 1.8 | 0 | 14.4 | 14.4 | -260 | -355 |
| Peyton Hendershot | TE | KC | active_plausible | 8 | 8 | 1.9 | 0 | 15.2 | 15.2 | -260 | -560 |
| Quintin Morris | TE | JAX | active_plausible | 9 | 9 | 2 | 0 | 18 | 18 | -260 | -499 |
| Robert Tonyan | TE | PIT | active_plausible | 8 | 8 | 2.2 | 0 | 17.6 | 17.6 | -260 | -510 |
| D'Ernest Johnson | RB | NE | active_plausible | 10 | 9.9 | 1.5 | -0.1 | 15 | 14.9 | -226 | -1173 |
| A.J. Richardson | WR | ARI | rookie_or_new_player | 5 | 5 | 3 | 0 | 15 | 15 | -150 | -563 |
| Aaron Lacombe | WR | LA | rookie_or_new_player | 5 | 5 | 3 | 0 | 15 | 15 | -148 | -561 |
| Adonis Jennings | WR | GB | rookie_or_new_player | 5 | 5 | 3 | 0 | 15 | 15 | -147 | -559 |
| Ahmad Wagner | WR | CHI | rookie_or_new_player | 5 | 5 | 3 | 0 | 15 | 15 | -147 | -559 |
| Ahmarean Brown | WR | BUF | rookie_or_new_player | 5 | 5 | 3 | 0 | 15 | 15 | -147 | -559 |
| AJ Henning | WR | MIA | rookie_or_new_player | 5 | 5 | 3 | 0 | 15 | 15 | -147 | -559 |
| Ajou Ajou | WR | IND | rookie_or_new_player | 5 | 5 | 3 | 0 | 15 | 15 | -147 | -558 |
| Alex McGough | WR | GB | rookie_or_new_player | 5 | 5 | 3 | 0 | 15 | 15 | -147 | -557 |
| Alex Wesley | WR | CHI | rookie_or_new_player | 5 | 5 | 3 | 0 | 15 | 15 | -147 | -557 |

## Top Overall-Rank Risers

| Player | Pos | Team | Universe | Current G | v8.2 G | PPG | Point Delta | Current Total | v8.2 Total | Pos Rank Move | Overall Rank Move |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Ty Simpson | QB | LAR | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 102 | 2197 |
| Taylen Green | QB | CLE | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 99 | 2191 |
| Mike Hartline | QB | IND | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 84 | 2170 |
| Miller Moss | QB | CHI | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 84 | 2170 |
| Matthew Caldwell | QB | LAR | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 81 | 2167 |
| Mark Gronowski | QB | MIA | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 80 | 2166 |
| Luke Altmyer | QB | DET | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 79 | 2165 |
| Kyron Drones | QB | GB | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 78 | 2164 |
| Kevin O'Connell | QB | NYJ | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 74 | 2161 |
| Kurt Warner | QB | ARI | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 74 | 2160 |
| Joey Aguilar | QB | JAX | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 66 | 2152 |
| Joe Fagnano | QB | BAL | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 65 | 2151 |
| Jalon Daniels | QB | TB | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 60 | 2144 |
| Jack Strand | QB | ATL | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 56 | 2140 |
| Jacob Clark | QB | LV | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 56 | 2140 |
| Haynes King | QB | CAR | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 50 | 2135 |
| Fernando Mendoza | QB | LV | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 48 | 2132 |
| Garrett Nussmeier | QB | KC | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 48 | 2132 |
| Drew Allar | QB | PIT | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 41 | 2125 |
| Cole Payton | QB | PHI | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 32 | 2112 |
| Carson Beck | QB | ARI | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 24 | 2104 |
| Byron Leftwich | QB | PIT | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 23 | 2102 |
| Cade Klubnik | QB | NYJ | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 23 | 2102 |
| Behren Morton | QB | NE | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 19 | 2099 |
| Athan Kaliakmanis | QB | WAS | rookie_or_new_player | 2 | 4 | 6 | 12 | 12 | 24 | 17 | 2097 |

## Top Overall-Rank Fallers

| Player | Pos | Team | Universe | Current G | v8.2 G | PPG | Point Delta | Current Total | v8.2 Total | Pos Rank Move | Overall Rank Move |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Trent Sherfield | WR | BUF | active_plausible | 9 | 8 | 1.7 | -1.7 | 15.3 | 13.6 | -630 | -1498 |
| C.J. Ham | RB | MIN | active_plausible | 9 | 8.5 | 1.7 | -0.8 | 15.3 | 14.5 | -279 | -1390 |
| Ajani Carter | DB | HOU | rookie_or_new_player | 5 | 4.8 | 3 | -0.6 | 15 | 14.4 | -144 | -1362 |
| Alex Carter | DB | WAS | rookie_or_new_player | 5 | 4.8 | 3 | -0.6 | 15 | 14.4 | -144 | -1359 |
| Ben DeLuca | DB | LAC | rookie_or_new_player | 5 | 4.8 | 3 | -0.6 | 15 | 14.4 | -140 | -1320 |
| Brandon Hill | DB | HOU | rookie_or_new_player | 5 | 4.8 | 3 | -0.6 | 15 | 14.4 | -138 | -1307 |
| Bryan Mills | DB | MIN | rookie_or_new_player | 5 | 4.8 | 3 | -0.6 | 15 | 14.4 | -137 | -1289 |
| Craig Mager | DB | DEN | rookie_or_new_player | 5 | 4.8 | 3 | -0.6 | 15 | 14.4 | -123 | -1206 |
| DaMarcus Fields | DB | WAS | rookie_or_new_player | 5 | 4.8 | 3 | -0.6 | 15 | 14.4 | -119 | -1191 |
| D'Ernest Johnson | RB | NE | active_plausible | 10 | 9.9 | 1.5 | -0.1 | 15 | 14.9 | -226 | -1173 |
| Daryl Porter | DB | PIT | rookie_or_new_player | 5 | 4.8 | 3 | -0.6 | 15 | 14.4 | -119 | -1161 |
| David Rivers | DB | MIA | rookie_or_new_player | 5 | 4.8 | 3 | -0.6 | 15 | 14.4 | -118 | -1159 |
| Delrick Abrams | DB | LA | rookie_or_new_player | 5 | 4.8 | 3 | -0.6 | 15 | 14.4 | -115 | -1138 |
| Dominique Hampton | DB | CHI | rookie_or_new_player | 5 | 4.8 | 3 | -0.6 | 15 | 14.4 | -105 | -1092 |
| Don Carey | DB | DET | rookie_or_new_player | 5 | 4.8 | 3 | -0.6 | 15 | 14.4 | -104 | -1091 |
| Don Gardner | DB | TB | rookie_or_new_player | 5 | 4.8 | 3 | -0.6 | 15 | 14.4 | -104 | -1091 |
| Donovan Olumba | DB | LA | rookie_or_new_player | 5 | 4.8 | 3 | -0.6 | 15 | 14.4 | -104 | -1088 |
| Ekow Boye-Doe | DB | ARI | rookie_or_new_player | 5 | 4.8 | 3 | -0.6 | 15 | 14.4 | -103 | -1066 |
| Elijah Benton | DB | NYJ | rookie_or_new_player | 5 | 4.8 | 3 | -0.6 | 15 | 14.4 | -103 | -1064 |
| Ethan Robinson | DB | MIA | rookie_or_new_player | 5 | 4.8 | 3 | -0.6 | 15 | 14.4 | -100 | -1043 |
| Gabe Jeudy-Lally | DB | TEN | rookie_or_new_player | 5 | 4.8 | 3 | -0.6 | 15 | 14.4 | -99 | -1035 |
| Harlan Miller | DB | WAS | rookie_or_new_player | 5 | 4.8 | 3 | -0.6 | 15 | 14.4 | -98 | -1015 |
| Jamar Johnson | DB | DEN | rookie_or_new_player | 5 | 4.8 | 3 | -0.6 | 15 | 14.4 | -86 | -940 |
| James Wiggins | DB | KC | rookie_or_new_player | 5 | 4.8 | 3 | -0.6 | 15 | 14.4 | -86 | -937 |
| Jameson Houston | DB | MIN | rookie_or_new_player | 5 | 4.8 | 3 | -0.6 | 15 | 14.4 | -86 | -936 |

## Notes

- Dry-run/read-only limited promotion-pool review only.
- Only final eligible_for_projection_promotion rows are evaluated.
- Critical movement rows, K rows, shadow-only rows, blocked rows, and remaining manual-review rows are excluded from the eligible pool.
- No live projections, 2026 production outputs, Supabase writes, War Room UI, Blackbird Rank, or Draft Suggestion ordering are changed.
