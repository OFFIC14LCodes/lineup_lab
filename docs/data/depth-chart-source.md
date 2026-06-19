# Depth Chart Source Workflow

H31 adds a file-based, dry-run depth chart source. It does not change live projections, rankings, draft suggestions, War Room behavior, Supabase, or v8.2.

## Source File

Use a local provider export at:

```text
data/depth-charts/depth-chart-2026.csv
```

Do not commit the real source file. The repository includes only:

```text
data/depth-charts/depth-chart-2026.template.csv
```

Expected columns:

```text
season
team
player_name
position
depth_position
depth_rank
role
status
sleeper_id
gsis_id
player_id
source
source_updated_at
notes
```

Allowed statuses:

```text
active
starter
backup
reserve
practice_squad
injured
inactive
unknown
```

Allowed roles:

```text
starter
backup
rotational
handcuff
depth
practice_squad
special_teams
unknown
```

## Normalize

Run against the template first:

```bash
npm run data:depth-chart:normalize -- --season=2026 --input=data/depth-charts/depth-chart-2026.template.csv
```

Run against a real local source after export:

```bash
npm run data:depth-chart:normalize -- --season=2026 --input=data/depth-charts/depth-chart-2026.csv
```

The normalizer writes local artifacts only:

```text
artifacts/projections/depth-charts/depth-chart-2026.normalized.json
artifacts/projections/depth-charts/depth-chart-2026.normalized.md
artifacts/projections/depth-charts/depth-chart-2026.normalized.csv
```

## External Trial Source: ScrapePlayers

`Carpe-Omnia/ScrapePlayers` includes an ESPN-derived depth chart CSV at:

```text
combined_depth_charts/master_nfl_depth_chart.csv
```

The repo README describes that data as collected on June 11, 2025. Treat it as stale source-format trial data only. Do not treat it as current 2026 production truth, do not use it to auto-promote players, and do not commit the real external CSV.

Place local external files under:

```text
data/depth-charts/external/
```

Inspect the external headers first:

```bash
npm run data:depth-chart:external:inspect -- --input=data/depth-charts/external/master_nfl_depth_chart.csv
```

Convert the ScrapePlayers shape into the H31 canonical depth chart source CSV:

```bash
npm run data:depth-chart:scrapeplayers:convert -- --input=data/depth-charts/external/master_nfl_depth_chart.csv --output=data/depth-charts/depth-chart-2026.csv --season=2026
```

The adapter marks converted rows as:

```text
source = scrapeplayers_espn_depth_chart_2025_06_11
source_updated_at = 2025-06-11
notes = stale_source_trial_not_current_2026_truth
```

Role/status mapping is conservative:

```text
depth rank 1 -> role starter, status unknown unless an explicit source status says otherwise
depth rank 2 -> role backup, status unknown
depth rank 3+ -> role depth, status unknown
missing rank -> role unknown, status unknown
```

After conversion, run the normal H31 workflow:

```bash
npm run data:depth-chart:normalize -- --season=2026 --input=data/depth-charts/depth-chart-2026.csv
npm run projection:depth-chart:resolve -- --projection-season=2026 --include-idp
```

## Resolve

Preview depth chart policy impact:

```bash
npm run projection:depth-chart:resolve -- --projection-season=2026 --include-idp
```

The resolver uses exact IDs first, then normalized name + team + compatible position as a review candidate. Unmatched rows remain source-expansion-required.
