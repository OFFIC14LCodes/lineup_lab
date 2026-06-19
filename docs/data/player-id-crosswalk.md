# Player ID Crosswalk Source

H24 is a dry-run/read-only workflow for reviewing Sleeper-to-GSIS/nflverse identity bridges. It does not write to Supabase, alter projections, change Blackbird Rank, change Draft Suggestions, change War Room behavior, or enable v8.2.

## Existing Source First

The project already has a local Sleeper export path:

```text
data/sleeper/raw/players-nfl.json
```

The existing Sleeper normalizer extracts external IDs, including `metadata.gsis_id` and top-level `gsis_id`, when present. The H24 review uses that local file as source evidence before relying on optional manual CSV rows.

To refresh the local Sleeper export manually:

```bash
npm run sleeper:export
```

That command uses the Sleeper API at export time only. The app runtime does not require network access for H24.

## Optional CSV Source

Use the CSV only for source-declared mappings, manual review rows, or corrections that are not already covered by the local Sleeper export.

Template:

```text
data/player-crosswalk/sleeper-nflverse-crosswalk-2026.template.csv
```

Real local file, intentionally ignored by git:

```text
data/player-crosswalk/sleeper-nflverse-crosswalk-2026.csv
```

Columns:

```text
sleeper_id,gsis_id,player_id,player_name,position,team,source,source_updated_at,confidence,notes
```

Allowed `confidence` values:

```text
exact_id
source_declared
name_team_position
manual_review
unknown
```

Only `exact_id` and `source_declared` can become confirmed crosswalk evidence. `name_team_position`, `manual_review`, and `unknown` remain review evidence.

## Normalize The CSV

Run this after creating a real local CSV:

```bash
npm run data:player-id-crosswalk:normalize -- --season=2026 --input=data/player-crosswalk/sleeper-nflverse-crosswalk-2026.csv
```

For a smoke check of the template:

```bash
npm run data:player-id-crosswalk:normalize -- --season=2026 --input=data/player-crosswalk/sleeper-nflverse-crosswalk-2026.template.csv
```

Outputs:

```text
artifacts/projections/player-crosswalk/sleeper-nflverse-crosswalk-2026.normalized.json
artifacts/projections/player-crosswalk/sleeper-nflverse-crosswalk-2026.normalized.md
artifacts/projections/player-crosswalk/sleeper-nflverse-crosswalk-2026.normalized.csv
```

## Review Projection Impact

Run the H24 review after H23 artifacts exist:

```bash
npm run projection:player-id-crosswalk:review -- --projection-season=2026 --include-idp
```

Outputs:

```text
artifacts/projections/backtesting/projection-player-id-crosswalk-review-2026.json
artifacts/projections/backtesting/projection-player-id-crosswalk-review-2026.md
artifacts/projections/backtesting/projection-player-id-crosswalk-review-2026.csv
```

## Review Statuses

- `crosswalk_confirmed`: exact Sleeper-to-GSIS bridge exists from local Sleeper metadata, snapshot metadata, or source-declared CSV.
- `crosswalk_conflict`: multiple exact sources disagree.
- `crosswalk_missing`: no usable bridge was found.
- `crosswalk_ambiguous`: multiple candidate mappings exist without a safe winner.
- `crosswalk_review_candidate`: only review-grade evidence exists.
- `source_missing`: required H23 diagnostics are missing.

## Integration Preview

The review previews routing only:

- `use_current_roster_source`
- `use_rookie_team_confirmation_source`
- `manual_review`
- `still_needs_crosswalk`

These are not applied to live projections or ranking outputs.
