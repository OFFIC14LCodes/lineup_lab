# Historical Outcome Coverage Diagnostics

- Generated: 2026-06-19T03:08:37.199Z
- Season: 2025
- Recommendation: historical_outcome_coverage_ready_for_h37_fix
- H37 integration: coverage_ready_to_treat_missing_weeks_as_zero
- Dry run: true
- Read only: true

## Missing Reason Summary

- none

## True Zero vs Mapping

- True zero week rows: 0
- Identifier mismatch suspected rows: 0
- Source expansion needed rows: 0
- Manual review candidate rows: 0

## Improvement Preview

- Current missing rows: 0
- True zero week rows to synthesize: 0
- Remaining missing after preview: 0
- Projected missing score rate after preview: 0

## Strategy Impact

- blackbird_rank_only: 0 (0/540)
- projection_only: 0 (0/540)
- adp_only: 0 (0/540)
- market_rank: 0 (0/540)
- need_based: 0 (0/540)
- random_within_adp_band: 0 (0/540)

## Safety Gates

- no_live_outputs_changed: true
- no_supabase_writes: true
- rankings_unchanged: true
- draft_suggestions_unchanged: true
- war_room_scoring_unchanged: true
- v8_2_not_enabled: true
- historical_backtest_no_future_leakage: true
- outcomes_used_only_after_draft: true
- loose_fuzzy_not_confirmed: true
- dry_run_only: true

