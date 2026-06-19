# Historical Weekly Results Normalization 2025

- Generated: 2026-06-19T03:07:41.024Z
- Recommendation: historical_weekly_results_ready_for_h37_scoring
- Selected source: data/nflverse/player_stats_2025.csv
- Fantasy point method: precomputed_fantasy_points_ppr
- Dry run: true
- Read only: true

## Source Discovery

- Sources checked: 5
- Selected row count: 19421
- Season coverage: 2025
- Week coverage: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22
- Fantasy points present: true
- Scoring must be calculated: false

## Coverage

- Total weekly rows: 19399
- Players covered: 2024
- Weeks covered: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22
- Positions covered: C, CB, DB, DE, DL, DT, FB, FS, G, ILB, K, LB, LS, MLB, NT, OL, OLB, OT, P, QB, RB, S, SAF, TE, WR
- Rows with fantasy points: 19399
- Rows calculated from stats: 0
- Rows missing scoring inputs: 0

## H37 Integration

- weeklyResultsInputPath: artifacts/projections/backtesting/historical-weekly-results-2025.normalized.json

## Limitations

- Sleeper IDs are not present in the selected weekly source; H37 may rely on player_id/gsis_id or name+position fallback.

## Data Leakage Guard

- Outcome-only source: true
- Not used by H36: true
- H37 scoring only: true
- No draft rankings recomputed: true
- No live outputs changed: true

