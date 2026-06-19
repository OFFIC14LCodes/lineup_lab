# Historical ADP Source 2025

- Recommendation: historical_adp_source_needs_real_csv
- Input: data/backtesting/adp/historical-adp-2025.template.csv
- Source rows: 0
- Normalized rows: 0
- Invalid rows: 0
- Duplicate rows removed: 0
- Conflict rows: 0
- As-of dates: none

## Match Coverage

- Universe rows: 657
- Exact ID matches: 0
- Name/team/position matches: 0
- Review candidates: 0
- Unmatched ADP rows: 0
- Universe rows without ADP: 657

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

