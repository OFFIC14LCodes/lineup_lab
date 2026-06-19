# Historical Market Anchor Experiment 2025

- Recommendation: market_anchor_experiment_directional_only
- Market source used: marketRank
- Players with ADP: 0
- Players with market rank: 657
- Average rank movement: 0
- Max rank movement: 0

## Leaderboard

| Rank | Strategy | Avg Points | Delta vs Blackbird | Delta vs Need |
|---:|---|---:|---:|---:|
| 1 | blackbird_market_anchor_need_based | 326.83 | 13.8 | 0 |
| 2 | need_based | 326.83 | 13.8 | 0 |
| 3 | blackbird_market_anchor | 313.03 | 0 | -13.8 |
| 4 | blackbird_rank_only | 313.03 | 0 | -13.8 |
| 5 | market_rank | 313.03 | 0 | -13.8 |
| 6 | projection_only | 313.03 | 0 | -13.8 |
| 7 | adp_only | 146.7 | -166.33 | -180.13 |
| 8 | random_within_adp_band | 145.4 | -167.63 | -181.43 |

## Data Leakage Guard

- Market anchor used only preseason-safe fields: true
- Actual weekly outcomes not used during draft: true
- Actual season points used only after drafts complete: true
- Rank blend did not use final season results: true

## Limitations

- single_season_only
- ADP unavailable; used marketRank as the market anchor source.
- marketRank currently mirrors blackbird_rank_fallback in the 2025 universe; exact ties should be treated as directional only.
- blackbird_market_anchor_need_based improvement is attributable to the need-based layer, not market-anchor rank movement in this artifact.

