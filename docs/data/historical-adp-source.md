# Historical ADP Source

H47 adds a file-based historical ADP adapter for backtesting only. ADP is treated as a market prior/anchor, not value. It must not be used to change live projections, live Blackbird Rank, Draft Suggestions, War Room recommendations, scoring, Supabase data, or v8.2 state.

## Source Rules

Use only historical or preseason ADP that was available before the target season draft date. Do not use post-season rankings, actual season outcomes, final fantasy points, or any source generated after the historical draft window.

Supported input is a generic CSV:

```text
data/backtesting/adp/historical-adp-2025.csv
```

Real local CSVs are intentionally ignored by git. The committed template is:

```text
data/backtesting/adp/historical-adp-2025.template.csv
```

## Columns

```text
season,source,as_of_date,player_name,position,team,adp,rank,sleeper_id,gsis_id,player_id,notes
```

Notes:

- `season`: target historical season, for example `2025`.
- `source`: provider name, for example `FantasyPros`, `Sleeper`, or another CSV export source.
- `as_of_date`: date the ADP snapshot was available.
- `adp`: market average draft position.
- `rank`: market rank. If omitted, the normalizer derives rank from `adp`.
- IDs are optional but preferred. Exact ID matches are safest.

## Normalize

With the template only:

```powershell
npm run projection:historical-adp:normalize -- --season=2025 --input=data/backtesting/adp/historical-adp-2025.template.csv
```

With a real local CSV:

```powershell
npm run projection:historical-adp:normalize -- --season=2025 --input=data/backtesting/adp/historical-adp-2025.csv
```

## 2026 Wide ADP Source

The 2026 wide source can contain Half PPR, PPR, and Superflex markets in one table. Keep the real local file out of git at one of these paths:

```text
data/backtesting/adp/historical-adp-2026-wide.txt
data/backtesting/adp/historical-adp-2026-wide.csv
```

Normalize it with:

```powershell
npm run projection:historical-adp:normalize-wide -- --season=2026 --input=data/backtesting/adp/historical-adp-2026-wide.txt
```

The wide normalizer emits one canonical ADP row per player/scoring format using `HALF_PPR`, `PPR`, and `SUPERFLEX`. ADP/order remain market-prior fields only and do not override roster eligibility.

To feed one market into the existing H47 matcher later, use the normalized CSV plus a market format:

```powershell
npm run projection:historical-adp:normalize -- --season=2026 --input=artifacts/projections/backtesting/historical-adp-2026.normalized.csv --market-format=SUPERFLEX
```

The normalizer writes:

```text
artifacts/projections/backtesting/historical-adp-2025.normalized.json
artifacts/projections/backtesting/historical-adp-2025.normalized.md
artifacts/projections/backtesting/historical-adp-2025.normalized.csv
artifacts/projections/backtesting/historical-draft-universe-2025.market-enriched.json
artifacts/projections/backtesting/historical-draft-universe-2025.market-enriched.md
artifacts/projections/backtesting/historical-draft-universe-2025.market-enriched.csv
```

## Matching

The adapter matches ADP rows to the historical draft universe in this order:

1. `player_id` exact
2. `sleeper_id` exact
3. `gsis_id` exact
4. normalized `player_name + position + team`
5. normalized `player_name + position`

Name and position without team is reported as a review candidate unless it is clearly unique. No loose fuzzy matching is confirmed automatically.

## H46 Retest

A historical ADP file alone is not enough for H46. It must be matched to a historical draft universe for the same season. If the universe is missing, run or build the historical draft universe pipeline first.

After creating a real market-enriched universe, rerun the market-anchor experiment against that artifact:

```powershell
npm run projection:historical-market-anchor-experiment -- --season=2025 --universe=artifacts/projections/backtesting/historical-draft-universe-2025.market-enriched.json
```

If the external source differs from Blackbird fallback ranks, H46 should report nonzero rank movement and the biggest movers. The season outcome scorer still uses actual outcomes only after drafts complete.
