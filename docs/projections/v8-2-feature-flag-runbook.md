# v8.2 Feature-Flag Runbook

This runbook prepares a future controlled feature-flag review for the v8.2 expected-games model. It does not enable v8.2 and does not authorize production usage.

## Current Status

- v8.2 status: `ready_for_controlled_flag_review`
- flag default: disabled
- live usage: no
- Supabase writes: no
- Blackbird Rank usage: no
- Draft Suggestion usage: no
- War Room scoring usage: no
- feature flag name: `BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES`
- protected rows enforced: yes
- missing artifact behavior: fail closed

## Preconditions Before Any Future Enablement

- All H14 artifacts regenerated.
- Feature-flag review packet remains `ready_for_controlled_flag_review`.
- Snapshot diff guard clean.
- Production shadow review clean or reviewed.
- Recommendation impact reviewed.
- War Room impact reviewed.
- No protected rows using v8.2.
- No missing readiness artifacts.
- No uncommitted generated artifact issues.

## Safe Regeneration Command Sequence

Run with the feature flag unset:

```powershell
Remove-Item Env:\BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES -ErrorAction SilentlyContinue
npm run projection:snapshot:preseason -- --target-season=2026 --include-idp
npm run projection:production:shadow-review -- --projection-season=2026 --include-idp
npm run projection:recommendation-impact:review -- --projection-season=2026 --include-idp
npm run projection:war-room-impact:review -- --projection-season=2026 --include-idp
npm run projection:v8-2:feature-flag:review-packet -- --projection-season=2026 --include-idp
npm run projection:v8-2:snapshot-diff-guard -- --projection-season=2026 --include-idp
```

## What Not To Do

- Do not enable the env var in production yet.
- Do not set `BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES=true` in production yet.
- Do not write v8.2 projection outputs to Supabase production tables.
- Do not let v8.2 power Draft Suggestions yet.
- Do not include K rows.
- Do not include critical movers.
- Do not include meaningful rank movers.
- Do not include legacy/stale rows.
- Do not change Blackbird Rank ordering.
- Do not change Draft Suggestion ordering.
- Do not change War Room scoring behavior.
- Do not add AI API calls.

## Future Enablement Plan

- Phase 0: disabled scaffold, current state.
- Phase 1: dev/local enabled run only.
- Phase 2: preview/staging environment enabled.
- Phase 3: shadow production read-only logging.
- Phase 4: limited safe-subset recommendation experiment.
- Phase 5: production enablement only after manual approval.

Do not implement these phases from this runbook. This document only describes the future path.

## Rollback Plan

- Unset `BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES`.
- Confirm selector returns current path.
- Rerun snapshot diff guard.
- Do not delete artifacts unless needed.

## Review Packet Baseline

The current H14.5 review packet returned:

- final packet recommendation: `ready_for_controlled_flag_review`
- safety gates: `50/50`
- disabled mode v8.2 rows: `0`
- enabled safe subset v8.2 rows: `3210`
- protected rows: `147`
- excluded rows: `1033`
- blocked rows: `1245`
- missing artifact fallback rows: `5635`
- top suggestion changed: `false`
- top 5 overlap: `5`
- top 10 overlap: `10`
- top 300 affected rows: `247`
- QB/Superflex-sensitive rows: `0`
- starter-tier movement rows: `0`
- deep-tier/noise rows shown: `50`
- War Room value movement rows: `50`
- reasoning likely changed rows: `50`
- GM Brief headline changed: `false`
- GM Brief top recommendation summary changed: `true`
- Plan Alignment changed rows: `0`
- risk/confidence changed rows: `0`
