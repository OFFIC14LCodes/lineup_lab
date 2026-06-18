# Projection/Scoring Foundation Handoff 2026

Recommendation: foundation_ready_for_disabled_flag_code_review
Dry run: true
Read only: true

## Executive Summary

v8.2 is safely scaffolded behind an off-by-default feature flag for dry-run snapshot generation only.

- Feature flag: BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES
- Default behavior: Default behavior remains current path.
- Live behavior changed: false
- Supabase writes changed: false
- Blackbird Rank changed: false
- Draft Suggestions changed: false
- War Room UI/scoring changed: false

## Model Lineage

### v6/v7 identity

v6 and v7 remained identical in the parity audit, confirming the existing production path was stable before v8.2 review.

```json
{
  "identicalRows": "1680/1680",
  "identicalRate": 1
}
```

### v8 experiment

v8 introduced expected-games changes but was too aggressive in high-impact cohorts.

### v8.1 calibrated gate

v8.1 improved aggregate backtest metrics but still needed high-impact movement protection.

### v8.2 high-impact guardrail

v8.2 kept the v8.1 gains while adding guardrails around high-impact movement, K fallback, and protected review cohorts.

```json
{
  "totalMaeDeltaVsV7": -0.138,
  "gamesMaeDeltaVsV7": -0.089,
  "twentyPlusPpgBucketFixedOrParity": true,
  "teKFallbackParityClean": true
}
```

### candidate rationale

v8.2 became the candidate because it preserved total MAE/RMSE gains while protected rows stayed on the current path for disabled flag review.

## Governance Chain

| Stage | Artifact | Recommendation/Verdict | Gates | Key Counts | Remaining Blockers |
|---|---|---|---|---|---|
| shadow projection | available | shadow_candidate_with_manual_review | 10/10 | currentRows: 5635; shadowRows: 5635; sharedRows: 5635; criticalMovements: 54 |  |
| universe eligibility audit | available | universe_blocked_for_promotion | 7/7 | rows: 5635; finalRows: null; validationIssues: null; policyViolations: null |  |
| promotion candidate pool | available | promotion_pool_needs_manual_review | 10/10 | rows: 5635; finalRows: null; validationIssues: null; policyViolations: null |  |
| manual review packet | available | manual_review_packet_ready | 9/9 | rows: 46; finalRows: null; validationIssues: null; policyViolations: null |  |
| manual review decisions | available | review_decisions_unresolved_rows_remaining | 10/10 | rows: null; finalRows: null; validationIssues: null; policyViolations: null |  |
| final promotion readiness | available | ready_for_shadow_promotion_review | 13/13 | eligibleRows: 3245; manualReviewRowsRemaining: 0; shadowOnlyRows: 1145; blockedRows: 1245; validationIssues: 0; policyViolations: 0 |  |
| limited promotion-pool review | available | limited_pool_needs_rank_impact_review | 12/12 | eligibleRows: 3245; criticalExcluded: 54; kExcluded: 127 |  |
| rank impact quality review | available | rank_impact_needs_tier_review | 12/12 | rows: 3245; finalRows: null; validationIssues: null; policyViolations: null |  |
| rank impact tier review | available | tier_review_packet_ready | 11/11 | rows: 35; finalRows: null; validationIssues: null; policyViolations: null |  |
| tier decisions | available | tier_decisions_ready | 11/11 | tierApproved: 0; tierCurrentPath: 35; tierShadowOnly: 0; tierUnresolved: 0 |  |
| feature-flag readiness | available | ready_for_disabled_feature_flag_scaffold | 15/15 | totalRows: 5635; wouldUseV82UnderFlag: 3210; wouldUseCurrentPathUnderFlag: 147; excludedFromFlagPool: 1033; blockedFromFlagPool: 1245 |  |
| feature-flag preview | available | selector_preview_clean | 14/14 | disabledV82Rows: 0; enabledV82Rows: 3210; enabledCurrentPathRows: 147; protectedViolations: 0 |  |
| pipeline selector preview | available | pipeline_selector_preview_clean | 16/16 | disabledV82Rows: 0; enabledV82Rows: 3210; enabledCurrentPathRows: 147; missingArtifactV82Rows: 0 |  |
| snapshot diff guard | available | snapshot_diff_guard_clean | 15/15 | defaultV82Rows: 0; defaultCurrentPathRows: 5635; enabledV82Rows: 3210; missingArtifactV82Rows: 0 |  |

## Current Safe Subset

```json
{
  "total2026Rows": 5635,
  "wouldUseV82UnderEnabledFlag": 3210,
  "wouldUseCurrentPath": 147,
  "excludedFromFlagPool": 1033,
  "blockedFromFlagPool": 1245,
  "kRowsUsingV82": 0,
  "criticalMoversUsingV82": 0,
  "meaningfulRankMoversUsingV82": 0,
  "legacyRowsUsingV82": 0
}
```

## Protection Policy

- K rows protected
- critical movement rows protected
- meaningful rank movers protected
- QB/Superflex-sensitive rows protected
- injury/role-sensitive rows protected
- model-policy-sensitive rows protected
- legacy/stale rows blocked
- missing readiness artifacts fail closed
- flag disabled by default

## Feature Flag Status

```json
{
  "featureFlag": "BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES",
  "enabledValues": [
    "true",
    "TRUE",
    "1"
  ],
  "disabledValues": [
    "unset",
    "false",
    "0",
    "no",
    "arbitrary strings"
  ],
  "missingArtifactsBehavior": "current_path",
  "defaultArtifact": "restored/current path"
}
```

## Commands To Regenerate

```powershell
Remove-Item Env:\BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES -ErrorAction SilentlyContinue
npm run projection:snapshot:preseason -- --target-season=2026 --include-idp
npm run projection:v8-2:shadow -- --projection-season=2026 --include-idp
npm run projection:universe:eligibility:audit -- --projection-season=2026 --include-idp
npm run projection:promotion:candidate-pool -- --projection-season=2026 --include-idp
npm run projection:promotion:manual-review -- --projection-season=2026 --include-idp
npm run projection:promotion:readiness-final -- --projection-season=2026 --include-idp --decisions-file=artifacts/projections/backtesting/projection-promotion-review-decisions-2026.conservative.csv
npm run projection:promotion:limited-pool-review -- --projection-season=2026 --include-idp
npm run projection:rank-impact:quality-review -- --projection-season=2026 --include-idp
npm run projection:rank-impact:tier-review -- --projection-season=2026 --include-idp
npm run projection:rank-impact:tier-decisions -- --projection-season=2026 --include-idp --decisions-file=artifacts/projections/backtesting/projection-rank-impact-tier-decisions-2026.conservative.csv
npm run projection:v8-2:feature-flag:readiness -- --projection-season=2026 --include-idp
npm run projection:v8-2:feature-flag:preview -- --projection-season=2026 --include-idp
npm run projection:selector:pipeline-preview -- --projection-season=2026 --include-idp
npm run projection:v8-2:snapshot-diff-guard -- --projection-season=2026 --include-idp
npm run projection:foundation:handoff -- --projection-season=2026 --include-idp
```

## Verification Commands

```powershell
npx vitest run src/lib/projections/feature-flags.test.ts src/lib/projections/backtesting/projection-selector-pipeline-preview.test.ts src/lib/projections/backtesting/projection-v8-2-snapshot-diff-guard.test.ts
npm test
npm run lint
npm run typecheck
npm run build
```

## Allowed Next

- dry-run feature-flag scaffold review
- disabled feature-flag code review
- shadow-only comparison improvements
- manual review of protected rows
- kicker policy research
- roster/depth-chart source integration
- War Room UI improvements that do not consume v8.2 yet

## Not Allowed Yet

- do not enable v8.2 live
- do not write v8.2 production projections
- do not let v8.2 affect Blackbird Rank
- do not let v8.2 affect Draft Suggestion ordering
- do not let v8.2 affect War Room scoring
- do not include K rows in v8.2 promotion
- do not include critical movers in v8.2 promotion
- do not include meaningful rank movers in v8.2 promotion
- do not include legacy/stale rows

## Safety Gates

| Gate | Status | Detail |
|---|---|---|
| required_artifacts_available | PASS | all required artifacts available |
| snapshot_diff_guard_clean | PASS | snapshot_diff_guard_clean |
| feature_flag_readiness_clean | PASS | ready_for_disabled_feature_flag_scaffold |
| pipeline_selector_preview_clean | PASS | pipeline_selector_preview_clean |
| feature_flag_preview_clean | PASS | selector_preview_clean |
| default_behavior_current_path_only | PASS | default v8.2/current/selector 0/5635/5635 |
| enabled_safe_subset_matches_expected | PASS | readiness/guard v8.2 3210/3210 |
| protected_rows_stay_current_path | PASS | K/critical/rank/legacy 0/0/0/0 |
| missing_artifacts_fail_closed | PASS | 0 missing-artifact v8.2 row(s) |
| no_live_outputs_changed | PASS | Handoff report writes only dry-run report artifacts. |
| no_supabase_writes | PASS | No Supabase client or writer is imported or called. |
| rankings_unchanged | PASS | Blackbird Rank code paths are not imported or executed. |
| draft_suggestions_unchanged | PASS | Draft Suggestion code paths are not imported or executed. |
| war_room_unchanged | PASS | War Room UI/scoring code is not imported or modified. |

## Artifact Inventory

| Key | Status | Size | Path | Error |
|---|---|---:|---|---|
| snapshot | not_parsed | 527345575 | C:\Projects\lineup_lab\artifacts\projections\backtesting\preseason-projection-snapshot-2026.json |  |
| shadow | available | 5838093 | C:\Projects\lineup_lab\artifacts\projections\backtesting\projection-v8-2-shadow-2026.json |  |
| universeEligibilityAudit | available | 6085226 | C:\Projects\lineup_lab\artifacts\projections\backtesting\projection-universe-eligibility-audit-2026.json |  |
| promotionCandidatePool | available | 7140732 | C:\Projects\lineup_lab\artifacts\projections\backtesting\projection-promotion-candidate-pool-2026.json |  |
| manualReviewPacket | available | 307869 | C:\Projects\lineup_lab\artifacts\projections\backtesting\projection-promotion-manual-review-2026.json |  |
| manualReviewDecisionsResolved | available | 127727 | C:\Projects\lineup_lab\artifacts\projections\backtesting\projection-promotion-review-decisions-2026.resolved.json |  |
| manualReviewDecisionsConservative | not_parsed | 24327 | C:\Projects\lineup_lab\artifacts\projections\backtesting\projection-promotion-review-decisions-2026.conservative.csv |  |
| finalPromotionReadiness | available | 4560117 | C:\Projects\lineup_lab\artifacts\projections\backtesting\projection-promotion-readiness-final-2026.json |  |
| limitedPromotionPoolReview | available | 3668311 | C:\Projects\lineup_lab\artifacts\projections\backtesting\projection-limited-promotion-pool-review-2026.json |  |
| rankImpactQualityReview | available | 3452493 | C:\Projects\lineup_lab\artifacts\projections\backtesting\projection-rank-impact-quality-review-2026.json |  |
| rankImpactTierReview | available | 205511 | C:\Projects\lineup_lab\artifacts\projections\backtesting\projection-rank-impact-tier-review-2026.json |  |
| rankImpactTierDecisionsResolved | available | 219367 | C:\Projects\lineup_lab\artifacts\projections\backtesting\projection-rank-impact-tier-decisions-2026.resolved.json |  |
| rankImpactTierDecisionsConservative | not_parsed | 18612 | C:\Projects\lineup_lab\artifacts\projections\backtesting\projection-rank-impact-tier-decisions-2026.conservative.csv |  |
| featureFlagReadiness | available | 4717777 | C:\Projects\lineup_lab\artifacts\projections\backtesting\projection-v8-2-feature-flag-readiness-2026.json |  |
| featureFlagPreview | available | 6912198 | C:\Projects\lineup_lab\artifacts\projections\backtesting\projection-v8-2-feature-flag-preview-2026.json |  |
| pipelineSelectorPreview | available | 12235908 | C:\Projects\lineup_lab\artifacts\projections\backtesting\projection-selector-pipeline-preview-2026.json |  |
| snapshotDiffGuard | available | 10380 | C:\Projects\lineup_lab\artifacts\projections\backtesting\projection-v8-2-snapshot-diff-guard-2026.json |  |

## Notes

- Read-only handoff report; no live projections, 2026 production outputs, Supabase writes, ranking paths, recommendation paths, or War Room UI paths are changed.
- The large preseason snapshot artifact is checked for existence and size but not parsed by this handoff report. Snapshot safety is summarized from the snapshot diff guard artifact.
