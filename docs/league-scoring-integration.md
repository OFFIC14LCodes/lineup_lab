# League Scoring Integration

Internal-only integration notes for applying Blackbird GM league scoring settings to stored provider data.

## Scope

- Pure scoring engine: `src/lib/scoring/*`
- Stored-row server integration: `src/lib/scoring/server/*`
- Internal inspector route: `/settings/scoring-inspector`
- Feature flag: `ENABLE_SCORING_INSPECTOR=true`

This phase does not:

- persist calculated fantasy points
- change provider import behavior
- change Draft Target Score
- change War Room ordering or recommendations

## Ownership Model

- Leagues are authorized by `leagues.user_id = auth.uid()`.
- Every scoring-inspector request must authenticate the current user.
- Every scoring-inspector request must verify that the selected `leagueId` belongs to that user.
- Provider stats and projections are global rows; league authorization comes from the scoring context, not from row ownership.

## Pure Scoring vs Stored-Row Scoring

- Pure scoring accepts:
  - normalized Sleeper scoring settings
  - provider-neutral stats
  - canonical position context
- Stored-row scoring adds:
  - owned league lookup
  - `leagues.scoring_settings_json`
  - stored weekly stats, season stats, or projections
  - canonical player resolution
  - provider-point comparison

## Provider-Point Comparison

- `provider_fantasy_points` is reference data only.
- Comparison thresholds:
  - `match`: absolute difference `<= 0.01`
  - `close`: absolute difference `<= 0.5`
  - `different`: above `0.5`
- If Blackbird coverage is incomplete, comparison status becomes `incomplete_blackbird_coverage`.
- A provider mismatch is not proof of an engine defect when coverage is incomplete.

## Coverage Interpretation

Inspector coverage labels are intentionally conservative:

- `Complete`
- `Partial`
- `Unsupported settings`
- `Missing raw stats`
- `Alias ambiguity`
- `Position missing`

The league-level audit and row-level coverage report are related but different:

- league audit shows what scoring keys Blackbird understands for the league
- row coverage shows whether the selected stored row had enough raw stats to evaluate those keys

## Season Aggregate Limitations

Season stats, season projections, and rest-of-season projections may be structurally incomplete when the league uses game-level scoring such as:

- weekly threshold bonuses
- long-play bonuses
- points-allowed defense tiers
- yards-allowed defense tiers

These rows are still scored on demand, but they are marked as aggregate estimates when exact weekly reconstruction is unsafe.

## Internal Inspector Workflow

1. Select an owned league.
2. Select a source type:
   - weekly stats
   - season stats
   - projections
3. Load a bounded sample.
4. Review:
   - Blackbird points
   - provider points
   - difference
   - component breakdown
   - coverage warnings
   - aggregate-compatibility warnings

## Current Limits

- read-only only
- no injuries scoring
- no calculated-score persistence
- no recommendation integration yet
- no automatic recalculation jobs
