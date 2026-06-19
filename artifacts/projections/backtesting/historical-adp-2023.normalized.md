# Historical ADP Source 2023

- Recommendation: historical_adp_source_needs_historical_universe
- Input: data/backtesting/adp/historical-adp-2023.csv
- Universe path: artifacts\projections\backtesting\historical-draft-universe-2023.json
- Universe exists: false
- Universe rows: 0
- Universe usable rows: 0
- Source rows: 202
- Normalized rows: 202
- Invalid rows: 0
- Duplicate rows removed: 0
- Conflict rows: 0
- As-of dates: 2023-08-03

## Universe Availability

ADP source parsed successfully, but no historical draft universe exists for this season. Build the historical draft universe before expecting ADP matches.

## Match Coverage

- Universe rows: 0
- Exact ID matches: 0
- Name/team/position matches: 0
- Review candidates: 0
- Unmatched ADP rows: 202
- Universe rows without ADP: 0

## Safety Gates

- no_live_outputs_changed: true
- no_supabase_writes: true
- live_rankings_unchanged: true
- live_draft_suggestions_unchanged: true
- war_room_scoring_unchanged: true
- v8_2_not_enabled: true
- adp_not_used_as_value: true
- market_anchor_backtest_only: true
- roster_eligibility_preserved: true
- historical_backtest_no_future_leakage: true
- dry_run_only: true

