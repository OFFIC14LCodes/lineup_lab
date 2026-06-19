# Current Roster Source Workflow

Blackbird consumes current roster/status data from a local CSV file. The app does not require R, nflreadr, nflverse, or any external network dependency at runtime.

## Target Files

- Template: `data/current-rosters/current-rosters-2026.template.csv`
- Real source CSV: `data/current-rosters/current-rosters-2026.csv`
- Raw export CSV: `data/current-rosters/current-rosters-2026.raw.csv`
- Optional mapping: `data/current-rosters/current-rosters-2026.mapping.json`
- Example mapping: `data/current-rosters/current-rosters-2026.mapping.example.json`

`data/current-rosters/current-rosters-2026.csv` and `data/current-rosters/current-rosters-2026.raw.csv` are ignored by git because real roster exports can be large and should remain local or be stored separately.

## Required Canonical Columns

The normalizer accepts these canonical columns:

```text
player_id
sleeper_id
gsis_id
player_name
position
team
status
roster_status
depth_chart_position
depth_chart_order
source
source_updated_at
notes
```

At minimum, provide `player_name`, `position`, `team`, and `status`. Id columns are strongly recommended because they avoid ambiguous matching.

Accepted `status` values:

```text
active
practice_squad
injured_reserve
pup
nfi
suspended
free_agent
retired
unknown
```

Aliases such as `IR`, `PS`, and `FA` are normalized.

## Exporting From nflreadr / nflverse

If R and nflreadr are available locally, export a roster CSV outside the app. This is a local data prep step only; the application does not install or require R, nflreadr, nflverse, or network access at runtime.

From the repository root, a likely 2026 export is:

```r
install.packages("nflreadr")
library(nflreadr)

rosters <- load_rosters(seasons = 2026)
write.csv(rosters, "data/current-rosters/current-rosters-2026.raw.csv", row.names = FALSE)
```

If the 2026 roster set is not available yet, export the latest available season as a temporary source:

```r
library(nflreadr)

rosters <- load_rosters(seasons = 2025)
write.csv(rosters, "data/current-rosters/current-rosters-2026.raw.csv", row.names = FALSE)
```

After export, inspect the raw file before creating a mapping or copying it to the canonical source path:

```bash
npm run data:current-rosters:inspect -- --input=data/current-rosters/current-rosters-2026.raw.csv
```

The actual headers can vary by nflreadr version, season, and source. Do not assume the example mapping is correct until the inspected headers confirm it.

When the raw export has the expected columns, copy it to the canonical local source file:

```text
data/current-rosters/current-rosters-2026.csv
```

Then inspect the canonical file:

```bash
npm run data:current-rosters:inspect -- --input=data/current-rosters/current-rosters-2026.csv
```

## Header Inspection

The inspect command prints the detected headers, sample rows, fields that map directly, missing required fields, missing recommended fields, and a suggested mapping. Run it before normalization:

```bash
npm run data:current-rosters:inspect -- --input=data/current-rosters/current-rosters-2026.csv
```

Required fields for confirmation are `player_name`, `position`, `team`, and `status`. Id fields such as `gsis_id`, `sleeper_id`, or another stable `player_id` are strongly recommended because they reduce ambiguous name matching.

## Common Mapping Guide

Verify these against the inspected headers. They are examples, not guaranteed nflreadr contracts:

```text
player_id: player_id, esb_id, gsis_it_id
gsis_id: gsis_id, gsis
sleeper_id: sleeper_id
player_name: player_name, full_name, display_name
position: position
team: team, recent_team
status: status, roster_status
roster_status: roster_status, status
```

An example-only nflverse-style mapping is available at:

```text
data/current-rosters/current-rosters-2026.mapping.example.json
```

If the inspected headers match that example, copy or adapt it to:

```text
data/current-rosters/current-rosters-2026.mapping.json
```

The mapping file uses canonical fields as keys and source CSV headers as values:

```json
{
  "player_id": "gsis_id",
  "gsis_id": "gsis_id",
  "sleeper_id": "sleeper_id",
  "player_name": "player_name",
  "position": "position",
  "team": "team",
  "status": "status",
  "roster_status": "status"
}
```

Then normalize:

```bash
npm run data:current-rosters:normalize -- --season=2026 --input=data/current-rosters/current-rosters-2026.csv --mapping=data/current-rosters/current-rosters-2026.mapping.json
```

If the file already uses canonical headers:

```bash
npm run data:current-rosters:normalize -- --season=2026 --input=data/current-rosters/current-rosters-2026.csv
```

Then run confirmation and delta reports:

```bash
npm run projection:current-roster:confirm -- --projection-season=2026 --include-idp
npm run projection:current-roster:confirm-delta -- --projection-season=2026 --include-idp
```

These reports are dry-run/read-only. They do not change live projections, Blackbird Rank, Draft Suggestions, War Room scoring, Supabase data, or v8.2 behavior.

## Full Local Command Sequence

After placing a real CSV at `data/current-rosters/current-rosters-2026.csv`, run:

```bash
npm run data:current-rosters:inspect -- --input=data/current-rosters/current-rosters-2026.csv
npm run data:current-rosters:normalize -- --season=2026 --input=data/current-rosters/current-rosters-2026.csv --mapping=data/current-rosters/current-rosters-2026.mapping.json
npm run projection:current-roster:confirm -- --projection-season=2026 --include-idp
npm run projection:current-roster:confirm-delta -- --projection-season=2026 --include-idp
```

If no mapping file is needed, omit the `--mapping` argument:

```bash
npm run data:current-rosters:normalize -- --season=2026 --input=data/current-rosters/current-rosters-2026.csv
```
