# Projection Universe Hygiene Summary 2026

Dry run: true
Read only: true
Recommendation: universe_hygiene_needs_review

## Hygiene Counts

```json
{
  "totalRows": 5635,
  "activePlausible": 1645,
  "lowConfidencePlausible": 417,
  "rookieNew": 1689,
  "staleHistorical": 639,
  "retiredLegacySuspect": 1245,
  "manualReviewRequired": 0,
  "blockedFromPromotion": 1245,
  "shadowOnly": 1099,
  "eligible": 3245,
  "missingTeam": 0,
  "unknownStatus": 0,
  "oldLastSeenSignal": 1883,
  "positionCounts": {
    "DB": 1122,
    "TE": 570,
    "DL": 803,
    "LB": 823,
    "WR": 1211,
    "K": 127,
    "RB": 686,
    "QB": 293
  },
  "teamCounts": {
    "CAR": 203,
    "NO": 181,
    "TEN": 193,
    "WAS": 214,
    "LAC": 161,
    "JAX": 178,
    "DEN": 151,
    "HOU": 173,
    "MIA": 202,
    "IND": 174,
    "CLE": 177,
    "SEA": 179,
    "BUF": 171,
    "ATL": 176,
    "TB": 191,
    "NYJ": 190,
    "LV": 168,
    "DAL": 157,
    "DET": 197,
    "CHI": 152,
    "KC": 165,
    "NYG": 190,
    "PHI": 161,
    "ARI": 210,
    "BAL": 161,
    "SF": 167,
    "LA": 75,
    "GB": 166,
    "CIN": 143,
    "NE": 153,
    "MIN": 164,
    "PIT": 209,
    "OAK": 17,
    "LAR": 66
  }
}
```

## Stale / Legacy Review

Total stale/legacy rows: 1884

| Player | Pos | Team | Last Active | Reasons | Why Blocked |
|---|---|---|---:|---|---|
| Derrick Willies | WR | CLE | 2018 | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season shadow_critical_movement | exclude_from_promotion_candidate_pool |
| Doug Martin | RB | OAK | 2018 | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season shadow_critical_movement | exclude_from_promotion_candidate_pool |
| Isaiah Crowell | RB | LV | 2018 | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season shadow_critical_movement | exclude_from_promotion_candidate_pool |
| Keith Ford | RB | GB | 2018 | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season shadow_critical_movement | exclude_from_promotion_candidate_pool |
| Lenzy Pipkins | DB | CLE | 2018 | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Chris Ivory | RB | BUF | 2018 | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Alfred Blue | RB | JAX | 2018 | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Chris Conte | DB | TB | 2018 | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Jacquizz Rodgers | RB | NO | 2018 | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| LeGarrette Blount | RB | DET | 2018 | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| William Hayes | DL | MIA | 2018 | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Cameron Meredith | WR | NE | 2018 | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Brock Coyle | LB | SF | 2018 | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Eric Berry | DB | KC | 2018 | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Derek Anderson | QB | BUF | 2018 | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Jeremy Hill | RB | NE | 2018 | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Dekoda Watson | LB | SEA | 2018 | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Eli Rogers | WR | PIT | 2018 | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Brock Osweiler | QB | MIA | 2018 | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Brandon LaFell | WR | OAK | 2018 | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Charcandrick West | RB | IND | 2018 | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| David Parry | DL | NE | 2018 | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Jeremy Kerley | WR | BUF | 2018 | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Travaris Cadet | RB | CAR | 2018 | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Jay Bromley | DL | SF | 2018 | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Sam Bradford | QB | ARI | 2018 | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Cameron Artis-Payne | RB | CAR | 2018 | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Derrick Jones | DB | HOU | 2018 | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Leonard Johnson | DB | ARI | 2018 | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Da'Norris Searcy | DB | CAR | 2018 | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Jeremy Langford | RB | ATL | 2018 | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Elijah McGuire | RB | KC | 2018 | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Tre'von Johnson | LB | LAC | 2018 | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Willie Henry | DL | NYG | 2018 | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Kamar Aiken | WR | PHI | 2018 | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Destiny Vaeao | DL | CAR | 2018 | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Martavis Bryant | WR | WAS | 2018 | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Brian Quick | WR | WAS | 2018 | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Marcus Murphy | RB | BUF | 2018 | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Ron Parker | DB | KC | 2018 | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Anthony Wint | LB | NYJ | 2018 | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Chris Long | DL | PHI | 2018 | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Joshua Holsey | DB | OAK | 2018 | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Corey Grant | RB | GB | 2018 | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| De'Angelo Henderson | RB | PHI | 2018 | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Jamaal Charles | RB | JAX | 2018 | has_current_team large_expected_games_delta no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Dexter McDougle | DB | PHI | 2018 | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Tom Johnson | DL | MIN | 2018 | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Michael Bennett | DL | ATL | 2018 | has_current_team idp_low_prior_fallback no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |
| Kyle Williams | DL | BUF | 2018 | has_current_team no_2026_roster_signal no_recent_nfl_activity old_last_seen_season | exclude_from_promotion_candidate_pool |

## Kicker Policy

```json
{
  "totalKRows": 127,
  "eligibleKRows": 0,
  "shadowOnlyKRows": 66,
  "blockedKRows": 29,
  "lowPriorKRows": 127,
  "criticalMovementKRows": 32,
  "whyExcludedFromV82Promotion": "K rows remain excluded from initial v8.2 promotion because low-prior kicker fallback behavior needs a dedicated policy review before promotion eligibility.",
  "recommendedNextAction": "kicker_policy_review_required"
}
```

## Roster / Team Confidence

```json
{
  "rowsWithCurrentTeam": 5635,
  "rowsMissingTeam": 0,
  "rowsWithAmbiguousTeam": 19,
  "rowsWithStaleTeam": 1883,
  "rookiesWithTeam": 1689,
  "rookiesMissingTeam": 0,
  "veteransMissingTeam": 0,
  "sourceStatus": "insufficient_current_roster_source",
  "recommendation": "Integrate or refresh a current roster/team source before any future projection promotion so missing/stale team signals can be separated from true inactive players."
}
```

## Hygiene Gates

| Gate | Status | Detail |
|---|---|---|
| legacy_rows_identified | PASS | 1245 retired/legacy and 639 stale rows. |
| kicker_policy_flagged | PASS | 127 K rows; 127 low-prior K rows. |
| missing_team_rows_reported | PASS | 0 missing-team rows. |
| blocked_rows_not_promoted | PASS | 1245 blocked rows tracked; 0 blocked/legacy row(s) eligible. |
| no_live_outputs_changed | PASS | Summary reads artifacts and writes only local H15 artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is imported or called. |
| rankings_unchanged | PASS | Blackbird Rank ordering is not imported, recalculated, or mutated. |
| draft_suggestions_unchanged | PASS | Draft Suggestion ordering is not imported, recalculated, or mutated. |
| war_room_scoring_unchanged | PASS | War Room scoring behavior is not imported, recalculated, or mutated. |
| v82_not_live | PASS | ready_for_controlled_flag_review |

## Notes

- H15 is dry-run/read-only data hygiene reporting only.
- No v8.2 enablement, promotion, live projection output, Supabase write, Blackbird Rank ordering, Draft Suggestion ordering, War Room scoring behavior, or AI API path is changed.
- Stale/legacy and K rows are reported for review; players are not deleted or silently removed from production outputs.
