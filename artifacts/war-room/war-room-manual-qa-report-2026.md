# War Room V1 Manual QA Report

- Generated: 2026-06-19T18:52:37.202Z
- Projection season: 2026
- Recommendation: war_room_manual_qa_passed
- Launch candidate status: launch_candidate_pass
- Dry run: true
- Read only: true

## Sections

| Section | Status | Critical | Notes |
| --- | --- | --- | --- |
| environment | pass | true | Browser, account, league, draft room, and console state. |
| draft_connection | pass | true |  |
| draft_state_loading | pass | true |  |
| board_modes | pass | true |  |
| draft_suggestions | pass | true |  |
| full_blackbird_rank | pass | true |  |
| available_blackbird_rank | pass | true |  |
| available_filtering | pass | true |  |
| pick_updates | pass | true |  |
| roster_construction | pass | false |  |
| plan_alignment | pass | false |  |
| gm_brief | pass | false |  |
| player_modal | pass | false |  |
| search_filter_load_more | pass | false |  |
| sync_status | pass | true |  |
| error_stale_states | pass | false |  |
| responsive_desktop | pass | false |  |
| responsive_tablet | pass | false |  |
| responsive_mobile | pass | false |  |
| data_policy_holdbacks | pass | true |  |
| unsupported_position_filtering | pass | true | Verified unsupported positions are not recommended; no K recommendation appears in leagues without K slots. |
| legacy_archive_filtering | pass | true | Verified Andrew Luck, Tom Brady, and Drew Brees do not appear in Draft Suggestions, Full Blackbird Rank, Available Blackbird Rank, Draft Signal, Recommended Targets, GM Brief, Plan Alignment, or Recent Signals. |
| v8_2_safety | pass | true |  |
| console_errors | pass | true |  |

## Triage

| Severity | Area | Suggested Next Action |
| --- | --- | --- |

## Launch Candidate Triage

| Severity | Area | Blocker | Manual Retest | Recommended Action |
| --- | --- | --- | --- | --- |

