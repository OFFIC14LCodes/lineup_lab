# Sleeper Player Metadata Source

H27 uses local Sleeper player metadata to resolve crosswalk-confirmed rows that are missing from roster and rookie source files. This workflow is dry-run/read-only and does not change live projections, rankings, Draft Suggestions, War Room behavior, Supabase tables, or v8.2 flags.

## Existing Export

The repo already has a Sleeper export script:

```bash
npm run sleeper:export
```

It writes:

```text
data/sleeper/raw/players-nfl.json
```

H27 can normalize that file directly. The app runtime does not require network access; the API call is only used when you intentionally refresh the local export.

## Local Files

Template files:

```text
data/sleeper/sleeper-players-2026.template.json
data/sleeper/sleeper-players-2026.template.csv
```

Optional real local files, ignored by git:

```text
data/sleeper/sleeper-players-2026.json
data/sleeper/sleeper-players-2026.csv
```

## Normalize Metadata

Recommended, using the existing export:

```bash
npm run data:sleeper:players:normalize -- --season=2026 --input=data/sleeper/raw/players-nfl.json
```

Template smoke check:

```bash
npm run data:sleeper:players:normalize -- --season=2026 --input=data/sleeper/sleeper-players-2026.template.json
```

Outputs:

```text
artifacts/projections/sleeper/sleeper-player-metadata-2026.normalized.json
artifacts/projections/sleeper/sleeper-player-metadata-2026.normalized.md
artifacts/projections/sleeper/sleeper-player-metadata-2026.normalized.csv
```

## Run H27 Resolution

```bash
npm run projection:sleeper-metadata:resolve -- --projection-season=2026 --include-idp
```

Outputs:

```text
artifacts/projections/backtesting/projection-sleeper-metadata-resolution-2026.json
artifacts/projections/backtesting/projection-sleeper-metadata-resolution-2026.md
artifacts/projections/backtesting/projection-sleeper-metadata-resolution-2026.csv
```

Real Sleeper exports and generated JSON/CSV artifacts should not be committed.
