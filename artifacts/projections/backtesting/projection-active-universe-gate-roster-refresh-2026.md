# Projection Active Universe Gate Roster Refresh 2026

Dry run: true
Read only: true
Recommendation: roster_refresh_ready_for_policy_review

## Before / After Status Counts

```json
{
  "totalRows": 5635,
  "originalH16StatusCounts": {
    "active_confirmed": 1588,
    "rookie_or_new_confirmed": 1657,
    "free_agent_plausible": 0,
    "low_confidence_plausible": 408,
    "stale_status_review": 625,
    "legacy_archive_blocked": 1216,
    "kicker_policy_review": 127,
    "manual_review_required": 14
  },
  "refreshedStatusCounts": {
    "roster_confirmed_active": 2097,
    "roster_confirmed_ir_pup_nfi": 29,
    "roster_confirmed_non_active": 6,
    "roster_unmatched_review": 1075,
    "rookie_or_new_unmatched_review": 1078,
    "legacy_archive_blocked": 1216,
    "kicker_policy_review": 127,
    "manual_review_required": 7
  },
  "transitionCounts": {
    "legacy_archive_blocked->legacy_archive_blocked": 1216,
    "kicker_policy_review->kicker_policy_review": 127,
    "stale_status_review->roster_unmatched_review": 592,
    "stale_status_review->roster_confirmed_active": 33,
    "rookie_or_new_confirmed->rookie_or_new_unmatched_review": 1078,
    "rookie_or_new_confirmed->roster_confirmed_active": 558,
    "rookie_or_new_confirmed->roster_confirmed_ir_pup_nfi": 19,
    "rookie_or_new_confirmed->roster_confirmed_non_active": 2,
    "low_confidence_plausible->roster_unmatched_review": 80,
    "low_confidence_plausible->roster_confirmed_active": 320,
    "low_confidence_plausible->manual_review_required": 2,
    "manual_review_required->manual_review_required": 3,
    "manual_review_required->roster_confirmed_active": 11,
    "low_confidence_plausible->roster_confirmed_ir_pup_nfi": 4,
    "low_confidence_plausible->roster_confirmed_non_active": 2,
    "active_confirmed->roster_confirmed_active": 1175,
    "active_confirmed->roster_unmatched_review": 403,
    "active_confirmed->manual_review_required": 2,
    "active_confirmed->roster_confirmed_non_active": 2,
    "active_confirmed->roster_confirmed_ir_pup_nfi": 6
  }
}
```

## Status Change Summary

```json
{
  "activeConfirmedIncrease": 406,
  "activeConfirmedDecrease": 10,
  "staleStatusReviewResolved": 33,
  "manualReviewResolved": 11,
  "lowConfidenceResolved": 328,
  "legacyArchiveChanged": 0,
  "kickerPolicyChanged": 0,
  "kickerPolicyUnchanged": 127
}
```

## Matched / Unmatched / Conflicts

```json
{
  "matchedRows": 2180,
  "unmatchedRows": 3455,
  "conflicts": 4,
  "confirmedActive": 2139,
  "confirmedNonActive": 8,
  "confirmedIrPupNfi": 29
}
```

## Unmatched Summary

```json
{
  "totalRows": 3455,
  "byOriginalH16GateStatus": {
    "legacy_archive_blocked": 1214,
    "kicker_policy_review": 85,
    "stale_status_review": 592,
    "rookie_or_new_confirmed": 1078,
    "low_confidence_plausible": 80,
    "manual_review_required": 3,
    "active_confirmed": 403
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
  "byStaleLegacyStatus": {
    "legacy_archive": 1214,
    "not_stale_or_legacy": 1649,
    "stale_status_review": 592
  },
  "byPromotionClassification": {
    "blocked_from_promotion": 1243,
    "shadow_only": 703,
    "eligible_for_projection_promotion": 1481,
    "manual_review_before_promotion": 28
  }
}
```

### Top Unmatched Active Candidates

| Player | Pos | Projection Team | Roster Team | Roster Status | Old Gate | New Gate | Reasons | Action |
|---|---|---|---|---|---|---|---|---|
| Desmond Ridder | QB | GB |  |  | active_confirmed | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Kareem Hunt | RB | KC |  |  | active_confirmed | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Byron Leftwich | QB | PIT |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Kevin O'Connell | QB | NYJ |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Kurt Warner | QB | ARI |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Mike Hartline | QB | IND |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Stefon Diggs | WR | NE |  |  | active_confirmed | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Miles Sanders | RB | DAL |  |  | active_confirmed | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Adam Zaruba | TE | PHI |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Alec Bloom | TE | ARI |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Alec Holler | TE | DAL |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Alex Ellis | TE | ARI |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Alex Gray | TE | ATL |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Alize Mack | TE | TEN |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Andrew Gleichert | TE | PHI |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Andrew Vollert | TE | IND |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Artayvious Lynn | TE | DAL |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Austin Allen | TE | GB |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Austin Fort | TE | TEN |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Austin Roberts | TE | LAC |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Austin Stogner | TE | ATL |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Beau Gardner | TE | ATL |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Beau Sandland | TE | GB |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Ben Beise | TE | TB |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Ben Johnson | TE | LAC |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Ben Mason | TE | LAC |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Bernhard Seikovits | TE | ARI |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Billy Brown | TE | IND |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Brandon Barnes | TE | OAK |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Brandon Cottom | TE | SEA |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Brayden Lenius | TE | ATL |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Brian Vogler | TE | IND |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Briley Moore | TE | TEN |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Bruno Labelle | TE | ARI |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Bryce Sterk | TE | CIN |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Bryce Williams | TE | ARI |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Bucky Hodges | TE | NYJ |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| C.J. Conrad | TE | NYG |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Cade Brewer | TE | SEA |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Caden Prieskorn | TE | CLE |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Cam Serigne | TE | CAR |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Cam Sutton | TE | SEA |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Cameron Clear | TE | PIT |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Camren McDonald | TE | LA |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Carl Tucker | TE | MIA |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Carson Meier | TE | ATL |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Cary Angeline | TE | PHI |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Charles Scarff | TE | BAL |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Charlie Taumoepeau | TE | DET |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |
| Chase Allen | TE | CHI |  |  | rookie_or_new_confirmed | rookie_or_new_unmatched_review |  | review_rookie_or_new_source_coverage |

### Top Unmatched Low Confidence

| Player | Pos | Projection Team | Roster Team | Roster Status | Old Gate | New Gate | Reasons | Action |
|---|---|---|---|---|---|---|---|---|
| Jamon Johnson | LB | GB |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Jacob Kibodi | RB | CLE |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Titus Leo | DL | PHI |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Blake Watson | RB | TEN |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Kristian Wilkerson | WR | BUF |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Jase McClellan | RB | TB |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Cory Trice | DB | PIT |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Jayden Peevy | DL | NO |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Jake Haener | QB | NO |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Kenny Dyson | LB | CAR |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Jacoby Windmon | LB | PIT |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Grant DuBose | WR | BUF |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Isaac Ukwu | DL | DET |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Jermar Jefferson | RB | ARI |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Millard Bradford | DB | CHI |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Isaiah Johnson | DB | MIA |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Bruce Hector | DL | SF |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Dallas Gant | LB | PHI |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| DJ James | DB | NE |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Brandon Joseph | DB | DET |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Morice Norris | DB | DET |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Khalid Duke | DL | TEN |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Tay Martin | WR | WAS |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Jordan Colbert | DB | MIA |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Nesta Jade Silvera | DL | LAC |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Tyreik McAllister | RB | LV |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Vi Jones | LB | ARI |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Jaquelin Roy | DL | NE |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Cam Smith | DB | MIA |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Mitchell Agude | LB | DET |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Faion Hicks | DB | SEA |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| C.J. Brewer | DL | TB |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Aaron Shampklin | RB | MIA |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Curtis Jacobs | LB | TEN |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Tyrion Davis-Price | RB | GB |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| De'Antre Prince | DB | JAX |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Jaylen Mahoney | DB | NYJ |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Ramel Keyton | WR | LV |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| T.J. Smith | DL | TEN |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Owen Wright | RB | TB |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Ameer Speed | DB | HOU |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Isaiah Bolden | DB | SF |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Alex Barrett | DL | SF |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Antonio Grier | LB | TB |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Jermaine Burton | WR | CIN |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Mike Greene | DL | TB |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Andre Baccellia | WR | ARI |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Erik Ezukanma | WR | PHI |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| John Kelly | RB | CLE |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Cody Thompson | WR | TB |  |  | low_confidence_plausible | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |

### Top Unmatched Stale

| Player | Pos | Projection Team | Roster Team | Roster Status | Old Gate | New Gate | Reasons | Action |
|---|---|---|---|---|---|---|---|---|
| Tayler Hawkins | DB | SF |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Vincent Gray | DB | CLE |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Leonard Fournette | RB | BUF |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Rondale Moore | WR | MIN |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Daylen Baldwin | WR | ARI |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Davis Webb | QB | NYG |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| DeVante Parker | WR | PHI |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Spencer Brown | RB | ATL |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Cole Beasley | WR | NYG |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Elijah Dotson | RB | ATL |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| David Blough | QB | DET |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Caleb Huntley | RB | ATL |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| John Wolford | QB | MIN |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Anthony Brown | QB | BUF |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Colt McCoy | QB | ARI |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Jarvis Landry | WR | NO |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Marvin Jones | WR | DET |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Jayron Kearse | DB | DAL |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Melvin Gordon | RB | BAL |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| A.J. Green | WR | ARI |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Zyon Gilbert | DB | PIT |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Duke Johnson | RB | BUF |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Aaron Donald | DL | LA |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Sony Michel | RB | LA |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Terrance Mitchell | DB | SF |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Eric Rowe | DB | PIT |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Rudy Ford | DB | CAR |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Rayshad Nichols | DL | BAL |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Corey Davis | WR | NYJ |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| J.J. Watt | DL | ARI |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Ryan Tannehill | QB | TEN |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| David Johnson | RB | NO |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Cade Johnson | WR | SEA |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Kenyan Drake | RB | GB |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| T.Y. Hilton | WR | DAL |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Dean Marlowe | DB | LAC |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Patrick Peterson | DB | PIT |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Russell Gage | WR | SF |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Derrek Pitts | DB | TB |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Tevin Coleman | RB | SF |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| DeAndre Houston-Carson | DB | HOU |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Dontrell Hilliard | RB | TEN |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Freddie Swain | WR | CHI |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Prince Emili | DL | ATL |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| BJ Thompson | DL | KC |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Damien Harris | RB | BUF |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Phillip Lindsay | RB | IND |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Chase Claypool | WR | BUF |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| Akiem Hicks | DL | TB |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |
| J.D. McKissic | RB | WAS |  |  | stale_status_review | roster_unmatched_review |  | keep_shadow_review_until_more_source_data |

## Conflicts

| Player | Pos | Projection Team | Roster Team | Roster Status | Old Gate | New Gate | Reasons | Action |
|---|---|---|---|---|---|---|---|---|
| Chandler Martin | LB | BAL | PHI | unknown | low_confidence_plausible | manual_review_required | matched_by_gsis_id team_conflicts_projection status_non_active | manual_review_team_conflict |
| Jordan Mims | RB | TEN | SF | unknown | low_confidence_plausible | manual_review_required | matched_by_sleeper_id team_conflicts_projection status_non_active | manual_review_team_conflict |
| Adam Thielen | WR | PIT | MIN | retired | active_confirmed | manual_review_required | matched_by_sleeper_id team_conflicts_projection status_non_active | manual_review_team_conflict |
| Markees Watts | LB | TB | CLE | retired | active_confirmed | manual_review_required | matched_by_sleeper_id team_conflicts_projection status_non_active | manual_review_team_conflict |

## Manual Review Resolved

| Player | Pos | Projection Team | Roster Team | Roster Status | Old Gate | New Gate | Reasons | Action |
|---|---|---|---|---|---|---|---|---|
| Ashton Jeanty | RB | LV | LV | active | manual_review_required | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| RJ Harvey | RB | DEN | DEN | active | manual_review_required | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Quinshon Judkins | RB | CLE | CLE | active | manual_review_required | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| TreVeyon Henderson | RB | NE | NE | active | manual_review_required | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Tyler Shough | QB | NO | NO | active | manual_review_required | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Woody Marks | RB | HOU | HOU | active | manual_review_required | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Jacory Croskey-Merritt | RB | WAS | WAS | active | manual_review_required | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| J.J. McCarthy | QB | MIN | MIN | active | manual_review_required | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Kyle Monangai | RB | CHI | CHI | active | manual_review_required | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Tyrod Taylor | QB | GB | GB | active | manual_review_required | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Deshaun Watson | QB | CLE | CLE | active | manual_review_required | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |

## Stale Review Resolved

| Player | Pos | Projection Team | Roster Team | Roster Status | Old Gate | New Gate | Reasons | Action |
|---|---|---|---|---|---|---|---|---|
| Easton Stick | QB | IND | IND | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Trevor Siemian | QB | ATL | ATL | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Quez Watkins | WR | PHI | PHI | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Darius Rush | DB | WAS | WAS | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Case Keenum | QB | CHI | CHI | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Chance Campbell | LB | PHI | PHI | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Dennis Houston | WR | TB | TB | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Salvon Ahmed | RB | CHI | CHI | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Israel Abanikanda | RB | DAL | DAL | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Kahlef Hailassie | DB | MIN | MIN | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| A.T. Perry | WR | PIT | PIT | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Phillip Dorsett | WR | LV | LV | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Gervarrius Owens | DB | CHI | CHI | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Tyreke Smith | LB | KC | KC | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Ross Blacklock | DL | ATL | ATL | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Matt Henningsen | DL | DEN | DEN | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Sean Clifford | QB | CIN | CIN | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Andrew Farmer | LB | SF | SF | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Earnest Brown | DL | TEN | TEN | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Timmy Horne | DL | TEN | TEN | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Benton Whitley | LB | CLE | CLE | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Colton Dowell | WR | SF | SF | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Tariq Castro-Fields | DB | PHI | PHI | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Danny Gray | WR | PHI | PHI | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Jonathan Garvin | LB | CHI | CHI | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Lance McCutcheon | WR | TEN | TEN | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Sam Ehlinger | QB | DEN | DEN | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| William Bradley-King | DL | SF | SF | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Ambry Thomas | DB | PHI | PHI | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Cole Turner | TE | MIA | MIA | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Damarion Williams | DB | TB | TB | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Lawrence Cager | TE | WAS | WAS | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |
| Sean McKeon | TE | IND | IND | active | stale_status_review | roster_confirmed_active | matched_by_sleeper_id team_matches_projection status_active | increase_active_universe_confidence_in_policy_review |

## v8.2 Safe Subset Cross-Reference

```json
{
  "byRefreshedStatus": {
    "roster_confirmed_active": {
      "would_use_v8_2_safe_subset": 1733,
      "would_stay_current_path": 11,
      "excluded_or_blocked": 353
    },
    "roster_confirmed_ir_pup_nfi": {
      "would_use_v8_2_safe_subset": 25,
      "would_stay_current_path": 0,
      "excluded_or_blocked": 4
    },
    "roster_confirmed_non_active": {
      "would_use_v8_2_safe_subset": 4,
      "would_stay_current_path": 0,
      "excluded_or_blocked": 2
    },
    "roster_unmatched_review": {
      "would_use_v8_2_safe_subset": 403,
      "would_stay_current_path": 0,
      "excluded_or_blocked": 672
    },
    "rookie_or_new_unmatched_review": {
      "would_use_v8_2_safe_subset": 1078,
      "would_stay_current_path": 0,
      "excluded_or_blocked": 0
    },
    "legacy_archive_blocked": {
      "would_use_v8_2_safe_subset": 0,
      "would_stay_current_path": 0,
      "excluded_or_blocked": 1216
    },
    "kicker_policy_review": {
      "would_use_v8_2_safe_subset": 0,
      "would_stay_current_path": 32,
      "excluded_or_blocked": 95
    },
    "manual_review_required": {
      "would_use_v8_2_safe_subset": 2,
      "would_stay_current_path": 3,
      "excluded_or_blocked": 2
    }
  },
  "packetSummary": {
    "enabledSafeSubsetV82Rows": 3210,
    "currentPathProtectedRows": 147,
    "excludedRows": 1033,
    "blockedRows": 1245,
    "kRowsUsingV82": 0,
    "criticalMoversUsingV82": 0,
    "meaningfulRankMoversUsingV82": 0,
    "legacyRowsUsingV82": 0
  },
  "rowsThatWouldUseV82UnderEnabledSafeFlag": 3245,
  "rowsThatStayCurrentPath": 46,
  "rowsExcludedOrBlocked": 2344,
  "rowsBlocked": 1216,
  "preservedZeroChecks": {
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
| no_live_outputs_changed | PASS | Report reads artifacts and writes only local H19 artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is imported or called. |
| rankings_unchanged | PASS | Blackbird Rank ordering is not imported, recalculated, or mutated. |
| draft_suggestions_unchanged | PASS | Draft Suggestion ordering is not imported, recalculated, or mutated. |
| war_room_scoring_unchanged | PASS | War Room scoring behavior is not imported, recalculated, or mutated. |
| v8_2_not_enabled | PASS | v8.2 feature flag and projection selector behavior are not changed. |
| roster_source_consumed | PASS | 2930 roster source rows reported. |
| conflicts_reported | PASS | 4 conflicts reported. |
| unmatched_rows_reported | PASS | 3455 unmatched rows reported. |
| manual_review_resolution_reported | PASS | 11 manual-review rows resolved. |
| stale_resolution_reported | PASS | 33 stale-review rows resolved. |
| kicker_policy_not_changed | PASS | All K rows remain kicker_policy_review. |
| v8_2_zero_checks_preserved | PASS | {"kRowsUsingV82":true,"criticalMoversUsingV82":true,"meaningfulRankMoversUsingV82":true,"legacyRowsUsingV82":true} |

## Notes

- H19 is a dry-run/read-only roster-confirmed active-universe gate refresh.
- Roster evidence is applied only to local reporting artifacts; production outputs are not filtered or changed.
- K rows remain in kicker policy review until a kicker policy is implemented.
- Unmatched rows remain review/shadow unless already legacy/archive protected.
- No live projections, Blackbird Rank ordering, Draft Suggestion ordering, War Room scoring behavior, Supabase writes, or v8.2 enablement are changed.
