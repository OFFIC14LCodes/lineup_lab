# H10.16 Replay Data Expansion

Generated: 2026-06-15T17:46:39.290Z
Verdict: synthetic_replay_expansion_ready
Replay source type: synthetic
True historical drafts available: false

## Source Summary

- Completed draft rooms with picks: 0
- Draft pick rows: 222
- Roster rows: 14
- Recommendation snapshot rows: 0
- Audit error: none

## Metrics

- replaySourceType: synthetic
- replayPathCount: 88
- totalUserPickStates: 176
- actualTargetSurvivalRate: null
- syntheticTargetSurvivalRate: 0.71
- wait_on_need_success_rate: 0.92
- fill_now_supported_rate: 0.923
- tier_cliff_supported_rate: 1
- elite_value_cases: 20
- low_confidence_push_count: 0
- K_DST_early_push_count: 0
- IDP_low_confidence_overpush_count: 0
- instability_churn_count: 0
- safety_finding_count: 0
- waitPlanBackedRate: 0.705
- unsupportedWaitRate: 0
- roomStyleBreakdown: {"ADP-heavy":11,"projection/value-heavy":11,"positional-need-heavy":11,"IDP-aggressive":11,"TE-premium":11,"K/DST-late":11,"chaotic/reach-heavy":11,"balanced":11}
- positionBreakdown: {"DL":9,"LB":5,"DB":19,"TE":13,"RB":18,"WR":13,"QB":9,"DEF":7,"K":2}
- formatBreakdown: {"unknown":11}

## Data Sources Audited

- draft_rooms: found=true, rows=6, missing=none
- draft_room_picks: found=true, rows=222, missing=available_player_pool_at_pick
- league_rosters: found=true, rows=14, missing=none
- draft_recommendation_snapshots: found=true, rows=0, missing=complete historical coverage for every user pick

## Historical Replay Loader Design

- pick-by-pick board state from draft_room_picks ordered by pick_no
- user draft slot from draft pick draft_slot/pick_in_round or roster id fallback
- team count from draft settings, league total_teams, or league_rosters count
- snake position windows with buildDraftPositionContext
- roster state by applying picks up to each user pick
- actual drafted players between user picks

## Synthetic Replay Generator Design

Active: true
Styles: ADP-heavy, projection/value-heavy, positional-need-heavy, IDP-aggressive, TE-premium, K/DST-late, chaotic/reach-heavy, balanced
Generate deterministic board depletion variants from validation/live recommendation rows without changing recommendation logic or available-player ordering.

## Safety

- noWriteOperations: true
- noDraftRoomMutation: true
- noProjectionMutation: true
- noRecommendationPersistence: true
- noAvailablePlayerOrderMutation: true
- noLegacyReplacement: true
- noDefaultSourceChange: true
