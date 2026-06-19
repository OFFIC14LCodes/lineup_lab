# Historical Mock Draft Engine

- Generated: 2026-06-18T23:52:04.589Z
- Projection season: 2026
- Recommendation: historical_mock_draft_engine_ready_for_season_scoring
- Draft order: third_round_reversal
- Dry run: true
- Read only: true

## Strategies

| Strategy | Picks | My roster | Starter coverage | Bench depth |
| --- | --- | --- | --- | --- |
| blackbird_rank_only | 16 | Historical RB 1 (RB), Historical RB 3 (RB), Historical WR 4 (WR), Historical TE 3 (TE) | Starter holes: QB, WR | No bench depth beyond core starters yet. |
| projection_only | 16 | Historical WR 1 (WR), Historical TE 1 (TE), Historical RB 4 (RB), Historical TE 3 (TE) | Starter holes: QB, RB, WR | No bench depth beyond core starters yet. |
| adp_only | 16 | Historical WR 1 (WR), Historical WR 4 (WR), Historical RB 4 (RB), Historical TE 3 (TE) | Starter holes: QB, RB | No bench depth beyond core starters yet. |
| market_rank | 16 | Historical WR 1 (WR), Historical TE 1 (TE), Historical TE 2 (TE), Historical TE 3 (TE) | Starter holes: QB, RB, WR | No bench depth beyond core starters yet. |
| need_based | 16 | Historical QB 2 (QB), Historical RB 3 (RB), Historical WR 4 (WR), Historical TE 2 (TE) | Starter holes: RB, WR | No bench depth beyond core starters yet. |
| random_within_adp_band | 16 | Historical RB 3 (RB), Historical TE 1 (TE), Historical QB 1 (QB), Historical WR 3 (WR) | Starter holes: RB, WR | No bench depth beyond core starters yet. |

## Data Leakage Guard

- Actual season scoring loaded: false
- Future outcome fields used: false

- Allowed: preseason projection snapshot for the historical season
- Allowed: preseason ADP or market rank source if present
- Allowed: league roster and scoring settings
- Allowed: draft slot/order
- Allowed: player universe as of draft time
- Disallowed: actual weekly results from the historical season
- Disallowed: final season fantasy points
- Disallowed: injury outcomes not known before the draft
- Disallowed: future ADP/rank/projection snapshots

