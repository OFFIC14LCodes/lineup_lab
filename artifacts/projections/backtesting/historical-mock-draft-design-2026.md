# Historical Mock Draft Backtest Design

- Generated: 2026-06-18T22:24:24.230Z
- Projection season: 2026
- Dry run: true
- Read only: true

## Baseline Drafters

- adp_only
- projection_only
- blackbird_rank_only
- need_based
- random_within_adp_band
- market_rank

## Season Outcome Metrics

- best_ball_total_points
- weekly_average
- starter_points
- bench_points
- positional_advantage
- replacement_value
- hit_rate
- bust_rate
- injury_games_lost
- regret_score

## Data Leakage Rules

- Draft phase must not read actual season points, games played, injuries, depth-chart changes, or post-draft ADP.
- All draft inputs must be timestamped at or before the preseason cutoff.
- Actual outcomes may be joined only after every simulated roster is locked.
- Backtest fixtures must preserve separate draft_input and season_outcome namespaces.

## Future Phases

- phase 1: static design artifact and fixtures
- phase 2: one-season deterministic simulator
- phase 3: baseline drafters and best-ball scorer
- phase 4: multi-season replay and regret analysis
- phase 5: reporting UI after dry-run validation

