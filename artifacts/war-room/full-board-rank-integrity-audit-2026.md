# Full Board Rank Integrity Audit

Generated: 2026-06-19T21:13:10.131Z
Projection season: 2026
League format: SUPERFLEX_NO_K
Market format: SUPERFLEX
Recommendation: full_board_rank_ready_for_manual_review

## Summary

- total_draftable_players: 1017
- players_with_adp: 276
- players_without_adp: 741
- players_with_severe_negative_market_deltas: 53
- players_with_severe_positive_market_deltas: 11
- players_with_suspicious_drops: 2
- players_with_suspicious_boosts: 2
- players_with_missing_projections: 0
- players_with_low_trust_in_top_100: 0
- players_with_high_market_rank_but_buried: 0
- players_with_high_projection_rank_but_buried: 0
- legacy_watchlist_excluded_count: 6
- unsupported_position_excluded_count: 2875

## Positional Balance Top 100

- QB: 25
- RB: 28
- WR: 36
- TE: 11
- K: 0
- DST: 0
- IDP: 0

## Top Suspicious Drops

- #39 Malik Nabers WR: market=13, projection=135, delta_market=26, reasons=low_projection_points|low_projection_ppg|poor_replacement_value|data_gap_penalty|market_disagreement|position_scarcity_adjustment, label=suspicious
- #72 Omarion Hampton RB: market=39, projection=152, delta_market=33, reasons=low_projection_points|low_projection_ppg|poor_replacement_value|data_gap_penalty|market_disagreement|position_scarcity_adjustment, label=suspicious

## Top Suspicious Boosts

- #39 Malik Nabers WR: market=13, projection=135, delta_market=26, reasons=scarcity_boost|role_or_context_boost|possible_wrong_sort_field, label=suspicious
- #72 Omarion Hampton RB: market=39, projection=152, delta_market=33, reasons=role_or_context_boost|possible_wrong_sort_field, label=suspicious

## Watchlist

- Ja'Marr Chase: blackbird=5, market=3, projection=5, position=2, delta_market=2, label=probably_justified
- Bijan Robinson: blackbird=9, market=5, projection=9, position=2, delta_market=4, label=probably_justified
- Justin Jefferson: blackbird=23, market=7, projection=28, position=6, delta_market=16, label=probably_justified
- Saquon Barkley: blackbird=24, market=9, projection=30, position=4, delta_market=15, label=probably_justified
- Jahmyr Gibbs: blackbird=3, market=8, projection=3, position=1, delta_market=-5, label=probably_justified
- CeeDee Lamb: blackbird=21, market=11, projection=20, position=5, delta_market=10, label=probably_justified
- Amon-Ra St. Brown: blackbird=7, market=15, projection=7, position=3, delta_market=-8, label=probably_justified
- Puka Nacua: blackbird=2, market=16, projection=2, position=1, delta_market=-14, label=probably_justified
- Malik Nabers: blackbird=39, market=13, projection=135, position=11, delta_market=26, label=suspicious
- Nico Collins: blackbird=33, market=23, projection=31, position=7, delta_market=10, label=probably_justified
- Brian Thomas: blackbird=38, market=20, projection=67, position=10, delta_market=18, label=probably_justified
- Drake London: blackbird=41, market=24, projection=41, position=12, delta_market=17, label=probably_justified
- Brock Bowers: blackbird=37, market=12, projection=50, position=2, delta_market=25, label=probably_justified
- Trey McBride: blackbird=11, market=21, projection=24, position=1, delta_market=-10, label=probably_justified
- Josh Allen: blackbird=1, market=1, projection=1, position=1, delta_market=0, label=probably_justified
- Lamar Jackson: blackbird=6, market=2, projection=6, position=3, delta_market=4, label=probably_justified
- Jayden Daniels: blackbird=25, market=4, projection=58, position=14, delta_market=21, label=probably_justified
- Joe Burrow: blackbird=26, market=6, projection=59, position=15, delta_market=20, label=probably_justified
- Jalen Hurts: blackbird=4, market=10, projection=4, position=2, delta_market=-6, label=probably_justified
- Patrick Mahomes: blackbird=8, market=19, projection=8, position=4, delta_market=-11, label=probably_justified

## Round Movement

- Dropped 3+ rounds vs market: Brock Bowers, Breece Hall, Xavier Worthy, T.J. Hockenson, Rome Odunze, Aaron Jones, Evan Engram, Quinshon Judkins, Chris Godwin, Justin Fields, Brian Robinson, James Conner, Isiah Pacheco, Calvin Ridley, Jordan Mason, Luther Burden, Keon Coleman, Cam Skattebo, Mason Taylor, Ricky Pearsall
- Boosted 3+ rounds vs market: Drake Maye, Jared Goff, Matthew Stafford, Trevor Lawrence, Caleb Williams, Dak Prescott, Jordan Love, Travis Kelce, George Pickens, Jaxson Dart, Bryce Young, Sam Darnold, Michael Pittman, Jake Ferguson, Dallas Goedert, Kyle Pitts, Colston Loveland, Javonte Williams, Wan'Dale Robinson, Harold Fannin
- Dropped 3+ rounds vs projection: Tua Tagovailoa, Aaron Rodgers, Justin Fields, Kirk Cousins, Tyler Shough, Will Levis, Luther Burden, Keon Coleman, J.J. McCarthy, Spencer Rattler, Kimani Vidal, Shedeur Sanders, Ray Davis, Pat Bryant, Michael Penix, Russell Wilson, Isaac TeSlaa, Jalen McMillan, A.T. Perry, Audric Estime
- Boosted 3+ rounds vs projection: Malik Nabers, Bucky Irving, Marvin Harrison, Chuba Hubbard, Rashee Rice, Kyler Murray, Alvin Kamara, Omarion Hampton, Evan Engram, Colby Parkinson, Tyler Higbee, Dawson Knox, Noah Fant, Austin Hooper, Noah Gray, Tommy Tremble, Josh Oliver, Darnell Washington, Daniel Bellinger, Davis Allen

## Safety

- dry_run_only: pass - Audit reads local artifacts and writes local report files only.
- no_supabase_writes: pass - No Supabase client is imported or called.
- v8_2_not_enabled: pass - Audit does not read or write v8.2 feature flags.
- market_anchor_default_disabled: pass - Market Anchor remains preview/reference-only and disabled by default.
- no_blocking_legacy_or_unsupported_leakage: pass - No blocked legacy or unsupported-position leakage detected.
- Market anchor enabled by default: false
- Supabase writes: false
- v8.2 enabled: false

