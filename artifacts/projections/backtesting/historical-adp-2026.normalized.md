# Historical Wide ADP Source 2026

- Recommendation: wide_adp_source_ready_for_market_anchor
- Input: data/backtesting/adp/historical-adp-2026-wide.txt
- Input exists: true
- Source player rows: 316
- Normalized rows: 948
- Missing ADP rows: 124
- Missing order/rank rows: 0
- Duplicate player/format rows: 0
- Invalid rows: 0

## Rows By Scoring Format

- HALF_PPR: 316
- PPR: 316
- SUPERFLEX: 316

## Rows By Position

- K: 45
- QB: 141
- RB: 273
- TE: 132
- WR: 357

## Safety Gates

- no_live_outputs_changed: true
- no_supabase_writes: true
- live_rankings_unchanged: true
- live_draft_suggestions_unchanged: true
- war_room_scoring_unchanged: true
- v8_2_not_enabled: true
- adp_not_used_as_value: true
- market_anchor_source_only: true
- roster_eligibility_preserved: true
- dry_run_only: true

