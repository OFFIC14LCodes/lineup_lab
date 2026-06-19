# Historical Draft Universe 2025

- Generated: 2026-06-19T15:34:11.781Z
- Recommendation: historical_draft_universe_ready_for_h36_h37
- Dry run: true
- Read only: true

## Source Discovery

- Snapshot: artifacts\projections\backtesting\preseason-projection-snapshot-2025.json
- Snapshot rows: 78470
- Player ID rows: 78470
- Sleeper ID rows: 78470
- GSIS ID rows: 78470
- Projection fields: projectedTotalPoints, projectedPpg, floorPoints, medianPoints, ceilingPoints
- Rank-like fields: projectedTotalPoints, confidenceScore, variant

## Universe

- Rows: 657
- Positions: QB, RB, TE, WR
- Teams: 34
- Projection field used: projectedTotalPoints
- Ranking fallback: blackbird_rank_fallback: projected preseason total points descending; ties by projection_ppg, source confidence, and player name

## H37 Identifier Coverage Preview

- Universe players: 657
- Exact ID matches: 351
- Name/position fallback matches: 0
- Missing weekly outcomes: 306

## Generated H36 Scenario

- data/backtesting/historical-mock-draft-scenario.2025.generated.json

## Data Leakage Guard

- Actual weekly outcomes not used for ranking: true
- Weekly outcomes only for coverage preview: true
- No outcome points joined into draft universe: true
- No future fields used: true

## Limitations

- Default H36.1 build excludes IDP for initial H36/H37 scoring.
- Default H36.1 build excludes kickers.
- Default H36.1 build excludes DST.
- Draft universe is filtered to preseason projection_points >= 25.
- ADP is not present in the selected preseason snapshot; adp strategy falls back to projected ranking in H36.
- Some universe players have no 2025 weekly outcome match; H37 will score those missing weeks as zero.

