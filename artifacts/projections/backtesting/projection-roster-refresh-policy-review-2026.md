# Projection Roster Refresh Policy Review 2026

Dry run: true
Read only: true
Recommendation: roster_policy_needs_manual_review

## Policy Group Counts

```json
{
  "conflict_review": 4,
  "manual_review_remaining": 3,
  "unmatched_active_candidate_review": 403,
  "unmatched_rookie_new_review": 1078,
  "unmatched_low_confidence_review": 80,
  "stale_unmatched_review": 592,
  "kicker_policy_review": 127,
  "legacy_blocked": 1216,
  "confirmed_active_clear": 2097,
  "confirmed_ir_pup_nfi_review": 29,
  "confirmed_non_active_review": 6
}
```

## Recommended Actions

```json
{
  "safe_to_keep_active_candidate": 2097,
  "needs_depth_chart_source": 483,
  "needs_transaction_status_source": 600,
  "needs_rookie_team_confirmation": 1078,
  "needs_manual_team_conflict_review": 2,
  "keep_blocked_archive": 1216,
  "keep_current_path": 3,
  "keep_shadow_only": 0,
  "needs_kicker_policy": 127,
  "needs_injury_status_review": 29
}
```

## Conflicts

| Player | Pos | Projection Team | Roster Team | Roster Status | H19 Status | v8.2 | Action |
|---|---|---|---|---|---|---|---|
| Adam Thielen | WR | PIT | MIN | retired | manual_review_required | would_use_v8_2_safe_subset | needs_transaction_status_source |
| Chandler Martin | LB | BAL | PHI | unknown | manual_review_required | excluded_or_blocked | needs_manual_team_conflict_review |
| Jordan Mims | RB | TEN | SF | unknown | manual_review_required | excluded_or_blocked | needs_manual_team_conflict_review |
| Markees Watts | LB | TB | CLE | retired | manual_review_required | would_use_v8_2_safe_subset | needs_transaction_status_source |

## Remaining Manual Review

| Player | Pos | Projection Team | Roster Team | Roster Status | H19 Status | v8.2 | Action |
|---|---|---|---|---|---|---|---|
| Russell Wilson | QB | NYG |  |  | manual_review_required | protected_current_path | keep_current_path |
| Dyontae Johnson | LB | NYG |  |  | manual_review_required | protected_current_path | keep_current_path |
| Austin Ekeler | RB | WAS |  |  | manual_review_required | protected_current_path | keep_current_path |
| Adam Thielen | WR | PIT | MIN | retired | manual_review_required | would_use_v8_2_safe_subset | needs_transaction_status_source |
| Chandler Martin | LB | BAL | PHI | unknown | manual_review_required | excluded_or_blocked | needs_manual_team_conflict_review |
| Jordan Mims | RB | TEN | SF | unknown | manual_review_required | excluded_or_blocked | needs_manual_team_conflict_review |
| Markees Watts | LB | TB | CLE | retired | manual_review_required | would_use_v8_2_safe_subset | needs_transaction_status_source |

## Unmatched Summary

```json
{
  "totalRows": 3455,
  "byH19Status": {
    "legacy_archive_blocked": 1214,
    "kicker_policy_review": 85,
    "roster_unmatched_review": 1075,
    "rookie_or_new_unmatched_review": 1078,
    "manual_review_required": 3
  },
  "byPosition": {
    "DB": 610,
    "TE": 378,
    "DL": 421,
    "LB": 470,
    "WR": 838,
    "K": 85,
    "RB": 478,
    "QB": 175
  },
  "byTeam": {
    "CAR": 135,
    "NO": 113,
    "TEN": 123,
    "WAS": 143,
    "LAC": 97,
    "JAX": 109,
    "DEN": 84,
    "HOU": 104,
    "MIA": 131,
    "IND": 107,
    "CLE": 110,
    "SEA": 112,
    "BUF": 103,
    "ATL": 111,
    "TB": 123,
    "NYJ": 118,
    "LV": 100,
    "DAL": 85,
    "DET": 130,
    "CHI": 85,
    "KC": 97,
    "NYG": 117,
    "PHI": 91,
    "ARI": 140,
    "BAL": 100,
    "SF": 96,
    "LA": 75,
    "GB": 102,
    "CIN": 72,
    "NE": 83,
    "MIN": 94,
    "PIT": 146,
    "OAK": 17,
    "LAR": 2
  },
  "byPromotionClassification": {
    "blocked_from_promotion": 1243,
    "shadow_only": 703,
    "eligible_for_projection_promotion": 1481,
    "manual_review_before_promotion": 28
  },
  "byV82Status": {
    "excluded_or_blocked": 1946,
    "would_use_v8_2_safe_subset": 1481,
    "protected_current_path": 28
  },
  "byStaleLegacyStatus": {
    "legacy_blocked": 1214,
    "not_stale_or_legacy": 1649,
    "stale_unmatched_review": 592
  }
}
```

## Rookies / New Unmatched

```json
{
  "totalRows": 1078,
  "positionCounts": {
    "RB": 206,
    "WR": 470,
    "LB": 51,
    "TE": 196,
    "QB": 89,
    "DB": 43,
    "DL": 23
  },
  "teamCounts": {
    "CLE": 34,
    "ARI": 41,
    "MIN": 41,
    "GB": 48,
    "SEA": 50,
    "LA": 37,
    "KC": 38,
    "DET": 33,
    "TB": 45,
    "PHI": 26,
    "CHI": 31,
    "BUF": 19,
    "IND": 35,
    "TEN": 31,
    "DAL": 26,
    "WAS": 35,
    "ATL": 37,
    "PIT": 49,
    "NYG": 34,
    "CAR": 43,
    "NYJ": 37,
    "DEN": 31,
    "LAC": 35,
    "OAK": 5,
    "HOU": 23,
    "LV": 9,
    "JAX": 38,
    "SF": 20,
    "BAL": 32,
    "NO": 24,
    "NE": 25,
    "MIA": 35,
    "CIN": 31
  },
  "v82SafeSubsetRows": 1078,
  "recommendedAction": "needs_rookie_team_confirmation"
}
```

| Player | Pos | Projection Team | Roster Team | Roster Status | H19 Status | v8.2 | Action |
|---|---|---|---|---|---|---|---|
| Byron Leftwich | QB | PIT |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Kevin O'Connell | QB | NYJ |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Kurt Warner | QB | ARI |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Mike Hartline | QB | IND |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Adam Zaruba | TE | PHI |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Alec Bloom | TE | ARI |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Alec Holler | TE | DAL |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Alex Ellis | TE | ARI |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Alex Gray | TE | ATL |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Alize Mack | TE | TEN |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Andrew Gleichert | TE | PHI |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Andrew Vollert | TE | IND |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Artayvious Lynn | TE | DAL |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Austin Allen | TE | GB |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Austin Fort | TE | TEN |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Austin Roberts | TE | LAC |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Austin Stogner | TE | ATL |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Beau Gardner | TE | ATL |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Beau Sandland | TE | GB |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Ben Beise | TE | TB |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Ben Johnson | TE | LAC |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Ben Mason | TE | LAC |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Bernhard Seikovits | TE | ARI |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Billy Brown | TE | IND |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Brandon Barnes | TE | OAK |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Brandon Cottom | TE | SEA |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Brayden Lenius | TE | ATL |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Brian Vogler | TE | IND |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Briley Moore | TE | TEN |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Bruno Labelle | TE | ARI |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Bryce Sterk | TE | CIN |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Bryce Williams | TE | ARI |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Bucky Hodges | TE | NYJ |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| C.J. Conrad | TE | NYG |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Cade Brewer | TE | SEA |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Caden Prieskorn | TE | CLE |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Cam Serigne | TE | CAR |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Cam Sutton | TE | SEA |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Cameron Clear | TE | PIT |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Camren McDonald | TE | LA |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Carl Tucker | TE | MIA |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Carson Meier | TE | ATL |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Cary Angeline | TE | PHI |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Charles Scarff | TE | BAL |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Charlie Taumoepeau | TE | DET |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Chase Allen | TE | CHI |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Chase Harrell | TE | SF |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Chris Bazile | TE | ARI |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Chris Pierce | TE | CAR |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |
| Christian Scotland-Williamson | TE | PIT |  |  | rookie_or_new_unmatched_review | would_use_v8_2_safe_subset | needs_rookie_team_confirmation |

## Active Candidate Unmatched

```json
{
  "totalRows": 403,
  "positionCounts": {
    "DL": 87,
    "LB": 82,
    "DB": 99,
    "WR": 56,
    "RB": 43,
    "TE": 25,
    "QB": 11
  },
  "teamCounts": {
    "PHI": 14,
    "TB": 13,
    "PIT": 16,
    "CHI": 7,
    "LV": 17,
    "HOU": 20,
    "MIA": 16,
    "NYJ": 14,
    "DET": 16,
    "CAR": 15,
    "TEN": 15,
    "ARI": 12,
    "DAL": 12,
    "BAL": 12,
    "NE": 12,
    "NYG": 11,
    "JAX": 6,
    "BUF": 21,
    "LA": 7,
    "ATL": 10,
    "MIN": 11,
    "WAS": 22,
    "SF": 13,
    "CIN": 5,
    "IND": 14,
    "SEA": 6,
    "NO": 12,
    "GB": 4,
    "KC": 11,
    "CLE": 18,
    "DEN": 3,
    "LAC": 18
  },
  "v82SafeSubsetRows": 403,
  "recommendedAction": "needs_depth_chart_source"
}
```

| Player | Pos | Projection Team | Roster Team | Roster Status | H19 Status | v8.2 | Action |
|---|---|---|---|---|---|---|---|
| Desmond Ridder | QB | GB |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Kareem Hunt | RB | KC |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Stefon Diggs | WR | NE |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Miles Sanders | RB | DAL |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Dalvin Cook | RB | DAL |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Tyler Boyd | WR | TEN |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| D'Onta Foreman | RB | CLE |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Donovan Wilson | DB | DAL |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Jadeveon Clowney | DL | DAL |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Curtis Samuel | WR | BUF |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| DeAndre Hopkins | WR | BAL |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Sam Hubbard | DL | CIN |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Stephon Gilmore | DB | MIN |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Ifeatu Melifonwu | DB | MIA |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Tyler Lockett | WR | LV |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Brandon Aiyuk | WR | SF |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| David Bell | WR | CLE |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Chris Moore | WR | WAS |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Ray-Ray McCloud | WR | NYG |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Nelson Agholor | WR | BAL |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| DJ Chark | WR | LAC |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Tyreek Hill | WR | MIA |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Clelin Ferrell | DL | SF |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Jamaal Williams | RB | NO |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Gabe Davis | WR | BUF |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Alexander Mattison | RB | MIA |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Denico Autry | DL | HOU |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Jordan Poyer | DB | BUF |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Noah Brown | WR | WAS |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Josey Jewell | LB | CAR |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Zack Moss | RB | CIN |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Keenan Allen | WR | LAC |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Bryce Huff | DL | SF |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Cooper Rush | QB | BAL |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Michael Pierce | DL | BAL |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Allen Lazard | WR | NYJ |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Derek Barnett | DL | HOU |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Taysom Hill | QB | NO |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Jimmie Ward | DB | HOU |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Robert Woods | WR | PIT |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Emmanuel Ogbah | DL | JAX |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Harrison Smith | DB | MIN |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Kenny Moore | DB | IND |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Devin White | LB | LV |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Carlos Watkins | DL | TEN |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Justin Simmons | DB | ATL |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Folorunso Fatukasi | DL | HOU |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Hunter Renfrow | WR | CAR |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Preston Smith | DL | WAS |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |
| Joe Mixon | RB | HOU |  |  | roster_unmatched_review | would_use_v8_2_safe_subset | needs_depth_chart_source |

## Low Confidence Unmatched

```json
{
  "totalRows": 80,
  "positionCounts": {
    "RB": 12,
    "DL": 13,
    "DB": 17,
    "WR": 14,
    "LB": 16,
    "TE": 5,
    "QB": 3
  },
  "teamCounts": {
    "MIA": 4,
    "SF": 4,
    "HOU": 1,
    "ARI": 4,
    "TEN": 5,
    "TB": 7,
    "BAL": 2,
    "DET": 4,
    "MIN": 2,
    "LV": 3,
    "NYG": 4,
    "CAR": 2,
    "NYJ": 4,
    "PIT": 4,
    "PHI": 3,
    "NO": 4,
    "JAX": 1,
    "DEN": 1,
    "NE": 2,
    "CLE": 4,
    "SEA": 1,
    "BUF": 2,
    "CIN": 2,
    "DAL": 1,
    "GB": 2,
    "KC": 1,
    "CHI": 2,
    "ATL": 2,
    "LAC": 1,
    "WAS": 1
  },
  "v82SafeSubsetRows": 0,
  "recommendedAction": "needs_depth_chart_source"
}
```

| Player | Pos | Projection Team | Roster Team | Roster Status | H19 Status | v8.2 | Action |
|---|---|---|---|---|---|---|---|
| Jamon Johnson | LB | GB |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Jacob Kibodi | RB | CLE |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Titus Leo | DL | PHI |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Blake Watson | RB | TEN |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Kristian Wilkerson | WR | BUF |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Jase McClellan | RB | TB |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Cory Trice | DB | PIT |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Jayden Peevy | DL | NO |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Jake Haener | QB | NO |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Kenny Dyson | LB | CAR |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Jacoby Windmon | LB | PIT |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Grant DuBose | WR | BUF |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Isaac Ukwu | DL | DET |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Jermar Jefferson | RB | ARI |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Millard Bradford | DB | CHI |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Isaiah Johnson | DB | MIA |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Bruce Hector | DL | SF |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Dallas Gant | LB | PHI |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| DJ James | DB | NE |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Brandon Joseph | DB | DET |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Morice Norris | DB | DET |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Khalid Duke | DL | TEN |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Tay Martin | WR | WAS |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Jordan Colbert | DB | MIA |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Nesta Jade Silvera | DL | LAC |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Tyreik McAllister | RB | LV |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Vi Jones | LB | ARI |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Jaquelin Roy | DL | NE |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Cam Smith | DB | MIA |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Mitchell Agude | LB | DET |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Faion Hicks | DB | SEA |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| C.J. Brewer | DL | TB |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Aaron Shampklin | RB | MIA |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Curtis Jacobs | LB | TEN |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Tyrion Davis-Price | RB | GB |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| De'Antre Prince | DB | JAX |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Jaylen Mahoney | DB | NYJ |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Ramel Keyton | WR | LV |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| T.J. Smith | DL | TEN |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Owen Wright | RB | TB |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Ameer Speed | DB | HOU |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Isaiah Bolden | DB | SF |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Alex Barrett | DL | SF |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Antonio Grier | LB | TB |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Jermaine Burton | WR | CIN |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Mike Greene | DL | TB |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Andre Baccellia | WR | ARI |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Erik Ezukanma | WR | PHI |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| John Kelly | RB | CLE |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |
| Cody Thompson | WR | TB |  |  | roster_unmatched_review | excluded_or_blocked | needs_depth_chart_source |

## Kicker Policy

```json
{
  "totalKRows": 127,
  "confirmedRosterDepthRows": 42,
  "unmatchedKRows": 85,
  "criticalMoverKRows": 32,
  "blockedKRows": 29,
  "shadowOnlyKRows": 66,
  "recommendedAction": "needs_kicker_policy",
  "topExamples": [
    {
      "playerId": "12438",
      "player": "Alex Hale",
      "position": "K",
      "projectionTeam": "GB",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 414
    },
    {
      "playerId": "8775",
      "player": "Andrew Mevis",
      "position": "K",
      "projectionTeam": "JAX",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 413
    },
    {
      "playerId": "7095",
      "player": "Austin MacGinnis",
      "position": "K",
      "projectionTeam": "LA",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 413
    },
    {
      "playerId": "11092",
      "player": "B.T. Potter",
      "position": "K",
      "projectionTeam": "TB",
      "rosterTeam": "TB",
      "rosterStatus": "active",
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_confirmed_active",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "matched_by_gsis_id",
        "team_matches_projection",
        "status_active",
        "kicker_policy_preserved",
        "current_roster_active_confirmation",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 413
    },
    {
      "playerId": "7855",
      "player": "Blake Haubeil",
      "position": "K",
      "projectionTeam": "CAR",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 412
    },
    {
      "playerId": "6496",
      "player": "Cole Hedlund",
      "position": "K",
      "projectionTeam": "IND",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 411
    },
    {
      "playerId": "5247",
      "player": "David Marvin",
      "position": "K",
      "projectionTeam": "ATL",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 411
    },
    {
      "playerId": "13833",
      "player": "Dominic Zvada",
      "position": "K",
      "projectionTeam": "NYG",
      "rosterTeam": "NYG",
      "rosterStatus": "active",
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_confirmed_active",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "matched_by_name_team_position",
        "team_matches_projection",
        "status_active",
        "kicker_policy_preserved",
        "current_roster_active_confirmation",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 411
    },
    {
      "playerId": "13968",
      "player": "Drew Stevens",
      "position": "K",
      "projectionTeam": "WAS",
      "rosterTeam": "WAS",
      "rosterStatus": "active",
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_confirmed_active",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "matched_by_name_team_position",
        "team_matches_projection",
        "status_active",
        "kicker_policy_preserved",
        "current_roster_active_confirmation",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 411
    },
    {
      "playerId": "8260",
      "player": "Gabe Brkic",
      "position": "K",
      "projectionTeam": "GB",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 411
    },
    {
      "playerId": "13710",
      "player": "Gabriel Plascencia",
      "position": "K",
      "projectionTeam": "CHI",
      "rosterTeam": "CHI",
      "rosterStatus": "active",
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_confirmed_active",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "matched_by_name_team_position",
        "team_matches_projection",
        "status_active",
        "kicker_policy_preserved",
        "current_roster_active_confirmation",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 411
    },
    {
      "playerId": "11077",
      "player": "Jack Podlesny",
      "position": "K",
      "projectionTeam": "GB",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 412
    },
    {
      "playerId": "8056",
      "player": "Jake Verity",
      "position": "K",
      "projectionTeam": "JAX",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 412
    },
    {
      "playerId": "8577",
      "player": "James McCourt",
      "position": "K",
      "projectionTeam": "LV",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 412
    },
    {
      "playerId": "12156",
      "player": "James Turner",
      "position": "K",
      "projectionTeam": "DET",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 413
    },
    {
      "playerId": "8812",
      "player": "Jonathan Garibay",
      "position": "K",
      "projectionTeam": "DAL",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 414
    },
    {
      "playerId": "7961",
      "player": "Jose Borregales",
      "position": "K",
      "projectionTeam": "TB",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 414
    },
    {
      "playerId": "7121",
      "player": "Justin Rohrwasser",
      "position": "K",
      "projectionTeam": "NE",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 414
    },
    {
      "playerId": "13804",
      "player": "Kansei Matsuzawa",
      "position": "K",
      "projectionTeam": "LV",
      "rosterTeam": "LV",
      "rosterStatus": "unknown",
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_confirmed_non_active",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "matched_by_name_team_position",
        "team_matches_projection",
        "status_non_active",
        "kicker_policy_preserved",
        "current_roster_non_active_confirmation",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 414
    },
    {
      "playerId": "13813",
      "player": "Laith Marjan",
      "position": "K",
      "projectionTeam": "PIT",
      "rosterTeam": "PIT",
      "rosterStatus": "active",
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_confirmed_active",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "matched_by_name_team_position",
        "team_matches_projection",
        "status_active",
        "kicker_policy_preserved",
        "current_roster_active_confirmation",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 414
    },
    {
      "playerId": "12548",
      "player": "Lenny Krieg",
      "position": "K",
      "projectionTeam": "ATL",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 414
    },
    {
      "playerId": "12824",
      "player": "Maddux Trujillo",
      "position": "K",
      "projectionTeam": "BUF",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 414
    },
    {
      "playerId": "13237",
      "player": "Mark McNamee",
      "position": "K",
      "projectionTeam": "GB",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 414
    },
    {
      "playerId": "3579",
      "player": "Marshall Morgan",
      "position": "K",
      "projectionTeam": "BUF",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 414
    },
    {
      "playerId": "13644",
      "player": "Mason Shipley",
      "position": "K",
      "projectionTeam": "NO",
      "rosterTeam": "NO",
      "rosterStatus": "active",
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_confirmed_active",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "matched_by_name_team_position",
        "team_matches_projection",
        "status_active",
        "kicker_policy_preserved",
        "current_roster_active_confirmation",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 414
    },
    {
      "playerId": "2819",
      "player": "Mike Meyer",
      "position": "K",
      "projectionTeam": "JAX",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 414
    },
    {
      "playerId": "8040",
      "player": "Quinn Nordin",
      "position": "K",
      "projectionTeam": "NE",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 414
    },
    {
      "playerId": "3460",
      "player": "Ross Martin",
      "position": "K",
      "projectionTeam": "CLE",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 414
    },
    {
      "playerId": "11145",
      "player": "Tanner Brown",
      "position": "K",
      "projectionTeam": "ATL",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 414
    },
    {
      "playerId": "5397",
      "player": "Trevor Moore",
      "position": "K",
      "projectionTeam": "TB",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 414
    },
    {
      "playerId": "7446",
      "player": "Tucker McCann",
      "position": "K",
      "projectionTeam": "TEN",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 414
    },
    {
      "playerId": "5251",
      "player": "Tyler Davis",
      "position": "K",
      "projectionTeam": "BUF",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "manual_review_before_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "would_stay_current_path",
      "v82ProtectionStatus": "protected_current_path",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "critical_movement_manual_review",
        "kicker_policy_shadow_only"
      ],
      "lastActiveSeason": null,
      "projectedTotalPointDelta": 24,
      "criticalMovement": true,
      "estimatedOverallRankMovement": 414
    },
    {
      "playerId": "1358",
      "player": "Caleb Sturgis",
      "position": "K",
      "projectionTeam": "LAC",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "blocked_from_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "excluded_or_blocked",
      "v82ProtectionStatus": "excluded_or_blocked",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "retired_legacy_blocked"
      ],
      "lastActiveSeason": 2018,
      "projectedTotalPointDelta": 0,
      "criticalMovement": false,
      "estimatedOverallRankMovement": -23
    },
    {
      "playerId": "2242",
      "player": "Chandler Catanzaro",
      "position": "K",
      "projectionTeam": "NYJ",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "blocked_from_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "excluded_or_blocked",
      "v82ProtectionStatus": "excluded_or_blocked",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "retired_legacy_blocked"
      ],
      "lastActiveSeason": 2018,
      "projectedTotalPointDelta": 0,
      "criticalMovement": false,
      "estimatedOverallRankMovement": -43
    },
    {
      "playerId": "1750",
      "player": "Giorgio Tavecchio",
      "position": "K",
      "projectionTeam": "TEN",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "blocked_from_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "excluded_or_blocked",
      "v82ProtectionStatus": "excluded_or_blocked",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "retired_legacy_blocked"
      ],
      "lastActiveSeason": 2018,
      "projectedTotalPointDelta": 0,
      "criticalMovement": false,
      "estimatedOverallRankMovement": -72
    },
    {
      "playerId": "5386",
      "player": "Matt McCrane",
      "position": "K",
      "projectionTeam": "DET",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "blocked_from_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "excluded_or_blocked",
      "v82ProtectionStatus": "excluded_or_blocked",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "retired_legacy_blocked"
      ],
      "lastActiveSeason": 2018,
      "projectedTotalPointDelta": 0,
      "criticalMovement": false,
      "estimatedOverallRankMovement": -36
    },
    {
      "playerId": "3673",
      "player": "Nick Rose",
      "position": "K",
      "projectionTeam": "LAC",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "blocked_from_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "excluded_or_blocked",
      "v82ProtectionStatus": "excluded_or_blocked",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "retired_legacy_blocked"
      ],
      "lastActiveSeason": 2018,
      "projectedTotalPointDelta": 0,
      "criticalMovement": false,
      "estimatedOverallRankMovement": 0
    },
    {
      "playerId": "229",
      "player": "Phil Dawson",
      "position": "K",
      "projectionTeam": "ARI",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "blocked_from_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "excluded_or_blocked",
      "v82ProtectionStatus": "excluded_or_blocked",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "retired_legacy_blocked"
      ],
      "lastActiveSeason": 2018,
      "projectedTotalPointDelta": 0,
      "criticalMovement": false,
      "estimatedOverallRankMovement": -25
    },
    {
      "playerId": "118",
      "player": "Sebastian Janikowski",
      "position": "K",
      "projectionTeam": "SEA",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "blocked_from_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "excluded_or_blocked",
      "v82ProtectionStatus": "excluded_or_blocked",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "retired_legacy_blocked"
      ],
      "lastActiveSeason": 2018,
      "projectedTotalPointDelta": 0,
      "criticalMovement": false,
      "estimatedOverallRankMovement": -15
    },
    {
      "playerId": "120",
      "player": "Adam Vinatieri",
      "position": "K",
      "projectionTeam": "IND",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "blocked_from_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "excluded_or_blocked",
      "v82ProtectionStatus": "excluded_or_blocked",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "retired_legacy_blocked"
      ],
      "lastActiveSeason": 2019,
      "projectedTotalPointDelta": 0,
      "criticalMovement": false,
      "estimatedOverallRankMovement": -27
    },
    {
      "playerId": "5460",
      "player": "Kaare Vedvik",
      "position": "K",
      "projectionTeam": "JAX",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "blocked_from_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "excluded_or_blocked",
      "v82ProtectionStatus": "excluded_or_blocked",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "retired_legacy_blocked"
      ],
      "lastActiveSeason": 2019,
      "projectedTotalPointDelta": 0,
      "criticalMovement": false,
      "estimatedOverallRankMovement": 1
    },
    {
      "playerId": "127",
      "player": "Matt Bryant",
      "position": "K",
      "projectionTeam": "ATL",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "blocked_from_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "excluded_or_blocked",
      "v82ProtectionStatus": "excluded_or_blocked",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "retired_legacy_blocked"
      ],
      "lastActiveSeason": 2019,
      "projectedTotalPointDelta": 0,
      "criticalMovement": false,
      "estimatedOverallRankMovement": -52
    },
    {
      "playerId": "899",
      "player": "Dan Bailey",
      "position": "K",
      "projectionTeam": "MIN",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "blocked_from_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "excluded_or_blocked",
      "v82ProtectionStatus": "excluded_or_blocked",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "retired_legacy_blocked"
      ],
      "lastActiveSeason": 2020,
      "projectedTotalPointDelta": 0,
      "criticalMovement": false,
      "estimatedOverallRankMovement": -17
    },
    {
      "playerId": "3805",
      "player": "Jon Brown",
      "position": "K",
      "projectionTeam": "JAX",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "blocked_from_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "excluded_or_blocked",
      "v82ProtectionStatus": "excluded_or_blocked",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "retired_legacy_blocked"
      ],
      "lastActiveSeason": 2020,
      "projectedTotalPointDelta": 0,
      "criticalMovement": false,
      "estimatedOverallRankMovement": -133
    },
    {
      "playerId": "1287",
      "player": "Kai Forbath",
      "position": "K",
      "projectionTeam": "LA",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "blocked_from_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "excluded_or_blocked",
      "v82ProtectionStatus": "excluded_or_blocked",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "retired_legacy_blocked"
      ],
      "lastActiveSeason": 2020,
      "projectedTotalPointDelta": 0,
      "criticalMovement": false,
      "estimatedOverallRankMovement": -498
    },
    {
      "playerId": "658",
      "player": "Mike Nugent",
      "position": "K",
      "projectionTeam": "ARI",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "blocked_from_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "excluded_or_blocked",
      "v82ProtectionStatus": "excluded_or_blocked",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "retired_legacy_blocked"
      ],
      "lastActiveSeason": 2020,
      "projectedTotalPointDelta": 0,
      "criticalMovement": false,
      "estimatedOverallRankMovement": -28
    },
    {
      "playerId": "3909",
      "player": "Sam Ficken",
      "position": "K",
      "projectionTeam": "DET",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "blocked_from_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "excluded_or_blocked",
      "v82ProtectionStatus": "excluded_or_blocked",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "retired_legacy_blocked"
      ],
      "lastActiveSeason": 2020,
      "projectedTotalPointDelta": 0,
      "criticalMovement": false,
      "estimatedOverallRankMovement": -24
    },
    {
      "playerId": "7152",
      "player": "Sam Sloman",
      "position": "K",
      "projectionTeam": "SF",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "blocked_from_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "excluded_or_blocked",
      "v82ProtectionStatus": "excluded_or_blocked",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "retired_legacy_blocked"
      ],
      "lastActiveSeason": 2020,
      "projectedTotalPointDelta": 0,
      "criticalMovement": false,
      "estimatedOverallRankMovement": -51
    },
    {
      "playerId": "7515",
      "player": "Sergio Castillo",
      "position": "K",
      "projectionTeam": "NYJ",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "blocked_from_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "excluded_or_blocked",
      "v82ProtectionStatus": "excluded_or_blocked",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "retired_legacy_blocked"
      ],
      "lastActiveSeason": 2020,
      "projectedTotalPointDelta": 0,
      "criticalMovement": false,
      "estimatedOverallRankMovement": -30
    },
    {
      "playerId": "110",
      "player": "Stephen Gostkowski",
      "position": "K",
      "projectionTeam": "TEN",
      "rosterTeam": null,
      "rosterStatus": null,
      "originalGateStatus": "kicker_policy_review",
      "h19Status": "kicker_policy_review",
      "confirmationStatus": "roster_unmatched",
      "promotionEligibilityClassification": "blocked_from_promotion",
      "policyGroup": "kicker_policy_review",
      "recommendedPolicyAction": "needs_kicker_policy",
      "v82Path": "excluded_or_blocked",
      "v82ProtectionStatus": "excluded_or_blocked",
      "reasonCodes": [
        "kicker_policy_preserved",
        "current_roster_unmatched",
        "retired_legacy_blocked"
      ],
      "lastActiveSeason": 2020,
      "projectedTotalPointDelta": 0,
      "criticalMovement": false,
      "estimatedOverallRankMovement": -18
    }
  ]
}
```

## v8.2 Adoption Impact

```json
{
  "safeSubsetRowsInsideConfirmedActiveClear": 1733,
  "safeSubsetRowsInsideUnmatchedGroups": 1481,
  "protectedRowsInsideConflictManualKickerGroups": 132,
  "safeSubsetRemainsIntact": true,
  "packetZeroChecks": {
    "kRowsUsingV82": true,
    "criticalMoversUsingV82": true,
    "meaningfulRankMoversUsingV82": true,
    "legacyRowsUsingV82": true
  }
}
```

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| no_live_outputs_changed | PASS | Report reads artifacts and writes only local H20 artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is imported or called. |
| rankings_unchanged | PASS | Blackbird Rank ordering is not imported, recalculated, or mutated. |
| draft_suggestions_unchanged | PASS | Draft Suggestion ordering is not imported, recalculated, or mutated. |
| war_room_scoring_unchanged | PASS | War Room scoring behavior is not imported, recalculated, or mutated. |
| v8_2_not_enabled | PASS | v8.2 feature flag and projection selector behavior are not changed. |
| conflicts_listed | PASS | 4 conflicts listed. |
| manual_review_rows_listed | PASS | 7 manual-review rows listed. |
| unmatched_groups_summarized | PASS | 3455 unmatched rows summarized. |
| kicker_policy_reported | PASS | 127 K rows reported. |
| v8_2_protection_preserved | PASS | v8.2 packet zero checks remain preserved. |
| all_rows_grouped | PASS | 5635 rows grouped. |

## Notes

- H20 is a dry-run/read-only roster-refresh policy review packet.
- Rows are grouped for policy review only; production projections and draft behavior are not filtered or changed.
- Unmatched rows are summarized and capped in markdown; the CSV contains all row-level policy assignments.
- No live projections, Blackbird Rank ordering, Draft Suggestion ordering, War Room scoring behavior, Supabase writes, or v8.2 enablement are changed.
