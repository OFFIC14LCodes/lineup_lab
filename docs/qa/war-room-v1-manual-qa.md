# War Room V1 Manual QA Checklist

Use this checklist against a real or test Sleeper draft room after the deterministic H33 E2E QA report passes.

## Setup

1. Connect a Sleeper account.
2. Open the dashboard.
3. Select a league.
4. Open the draft room.
5. Open browser DevTools and keep the Console visible.
6. Confirm the draft room loads without console or runtime errors.

## Draft Board

1. Verify Draft Suggestions render.
2. Verify Full Blackbird Rank renders drafted and undrafted players.
3. Verify Available Blackbird Rank hides drafted players.
4. Make or simulate a pick.
5. Verify picks update after Sleeper poll or manual sync.
6. Verify the drafted player disappears from available boards.

## Live State

1. Verify roster construction updates.
2. Verify Plan Alignment updates.
3. Verify GM Brief updates.
4. Verify sync status changes and remains readable.
5. Verify stale/error states if practical.

## Player Modal

1. Open the player modal from Draft Suggestions.
2. Open the player modal from Full Blackbird Rank.
3. Open the player modal from Available Blackbird Rank.
4. Confirm the modal includes player reasoning, roster fit, projection profile, risk/confidence, draft timing, and data gaps.

## Search And Filters

1. Test search by player name.
2. Test search by team.
3. Test search by position.
4. Test search by player ID or Sleeper ID if visible.
5. Test position chips.
6. Test load-more.
7. Test empty states.

## Layout

1. Verify desktop layout.
2. Verify tablet-width layout.
3. Verify mobile-width layout.
4. Confirm the Blackbird Board is not clipped horizontally.
5. Confirm dense table text remains readable.

## Safety

1. Verify no v8.2 enabled status.
2. Verify the scoring status panel is dev-only.
3. Verify unsupported positions are not recommended.
4. Verify no K recommendation appears in leagues without K slots.
5. Verify legacy/retired archived players such as Andrew Luck, Tom Brady, and Drew Brees do not appear in any actionable board, signal, recommendation, GM Brief, Plan Alignment, or Recent Signals surface.
6. Do not change projection, ranking, suggestion, or scoring behavior during QA.

## Recording Results

Copy `data/war-room/war-room-manual-qa.template.json` to `data/war-room/war-room-manual-qa.local.json`.
Fill each section with `pass`, `warn`, `fail`, or `not_tested`, then run:

```powershell
npm run war-room:manual-qa-report -- --projection-season=2026 --input=data/war-room/war-room-manual-qa.local.json
```

## Launch Candidate Pass

Use the launch-candidate status as the final War Room v1 go/no-go triage after H33 E2E QA is passing and browser QA has been recorded.

Required pass sections:

```text
draft_connection
draft_state_loading
board_modes
draft_suggestions
full_blackbird_rank
available_blackbird_rank
available_filtering
pick_updates
roster_construction
plan_alignment
gm_brief
player_modal
search_filter_load_more
sync_status
data_policy_holdbacks
unsupported_position_filtering
legacy_archive_filtering
v8_2_safety
console_errors
```

Allowed warning sections, if still readable and usable:

```text
responsive_tablet
responsive_mobile
error_stale_states
```

Blocker sections:

```text
draft_connection
draft_state_loading
board_modes
pick_updates
available_filtering
unsupported_position_filtering
legacy_archive_filtering
v8_2_safety
console_errors
```

Record issues in the relevant section `notes` field. Use concrete reproduction details: draft room, viewport, action taken, expected result, actual result, and whether the browser console logged an error.

Rerun the report after updating local QA results:

```powershell
npm run war-room:manual-qa-report -- --projection-season=2026 --input=data/war-room/war-room-manual-qa.local.json
```

Final interpretation:

- `launch_candidate_pass`: ready for launch-candidate approval.
- `launch_candidate_pass_with_warnings`: launchable only if warnings are accepted as readable/usable polish items.
- `launch_candidate_needs_bugfix`: fix scoped UI/sync issues and retest before approval.
- `launch_candidate_blocked`: not ready; a blocker failed, a required section is missing, or a required section is not tested.
