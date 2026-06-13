# Blackbird GM — H1 nflverse Historical Weekly Actual-Stat Ingestion

## Purpose

Phase H1 provides a bounded, repeatable, server-only historical-data pipeline that:

1. Downloads one completed NFL season of nflverse weekly player stats
2. Archives and fingerprints the immutable source artifact (SHA-256)
3. Validates the CSV schema against expected columns
4. Maps nflverse GSIS player identities to canonical Blackbird players
5. Normalizes supported weekly offensive actual stats into Blackbird's canonical stat keys
6. Writes resolved rows through the existing provider-neutral weekly-stat repository
7. Produces a detailed coverage and validation report
8. Is fully idempotent — re-running never creates duplicates

**This pipeline does not modify Draft Target Score, War Room ordering, recommendations,
readiness thresholds, projections, or scoring behavior.**

---

## Data Attribution

nflverse weekly player stats are published under the
[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
license by the nflverse project: https://github.com/nflverse/nflverse-data

When using this data, you must credit nflverse as the source.

---

## Commands

### Dry run (default) — download and report, no DB writes

```bash
npm run import:nflverse-history
```

Or explicitly:

```bash
npm run import:nflverse-history -- --season=2025
```

Dry run:
- Downloads and archives the source CSV (idempotent)
- Validates the schema
- Resolves GSIS identities (read-only DB queries)
- Prints a coverage report
- **Does NOT write any rows to `player_weekly_stats` or any tracking tables**

### Execute — write resolved rows to Supabase

```bash
npm run import:nflverse-history -- --execute
npm run import:nflverse-history -- --execute --season=2025
```

Execute mode:
- Everything dry run does, plus:
- Creates a `football_data_sources` record (or reuses existing for same SHA-256)
- Creates a `football_import_batches` tracking record
- Writes resolved rows to `player_weekly_stats` via upsert (idempotent)
- Records per-row outcomes in `football_source_rows`

### Validate (read-only schema + identity check)

```bash
npm run validate:nflverse-history
npm run validate:nflverse-history -- --season=2025
```

Equivalent to dry run but run as a standalone validation command. Asserts schema validity.

### Audit recovery (repair control-plane only)

```bash
npm run repair:nflverse-history -- --season=2025 --recover-audit
```

Dry-run recover-audit mode:
- Never updates `player_weekly_stats`
- Diagnoses `football_stat_corrections` coverage for nflverse 2025
- Reports whether row-level repair history is fully recoverable, partially recoverable, or not recoverable
- Produces a bounded recovery plan and diagnostic artifact

Execute recover-audit mode:
- Still never updates `player_weekly_stats`
- Inserts only missing audit-side records that are safe to create
- If true row-level correction history cannot be reconstructed, writes a batch-level fallback audit record to `football_import_batches.report_json`
- Uses retry-protected chunked audit reads/writes
- Re-running after a matching completed fallback audit reports `ALREADY RECOVERED` and performs zero writes

### Reconcile stale repair batches (control-plane only)

```bash
npm run reconcile:nflverse-repair-batches -- --season=2025
```

Dry-run reconcile mode:
- Never updates `player_weekly_stats`
- Requires a completed matching fallback audit record first
- Validates that repaired canonical rows still match the archived source artifact
- Selects only stale open repair batches linked by the fallback audit `relatedBatchIds`
- Proposes a terminal `failed` status plus explicit reconciliation metadata in `football_import_batches.report_json`

---

## Prerequisites

Set the following in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=<your-project-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

The pipeline uses the service role key to bypass RLS. No user authentication is needed.
Migration `007_nflverse_history.sql` must be applied to the Supabase project before execute mode.

---

## Source Data

| Property       | Value                                                                 |
|----------------|-----------------------------------------------------------------------|
| Provider       | nflverse (CC BY 4.0)                                                 |
| Format         | CSV (papaparse, header=true)                                          |
| URL pattern    | `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_{season}.csv` |
| Archive path   | `data/raw/nflverse/player_stats/{season}/stats_player_week_{season}.csv`  |
| Fingerprint    | SHA-256 of raw file bytes                                             |
| Season default | 2025                                                                  |

Downloaded files are gitignored (`data/raw/`). The SHA-256 fingerprint is stored in
`football_data_sources` and used to detect whether the file has changed between runs.

---

## Scope

| Dimension         | Value                                         |
|-------------------|-----------------------------------------------|
| Positions         | QB, RB, WR, TE only                           |
| Season type       | Regular season only (nflverse `season_type=REG`) |
| Identity method   | GSIS ID lookup only — no name-only fallback   |
| Team column       | `team` (nflverse 2025+ uses `team`, not `recent_team`) |
| Provider name     | `nflverse`                                    |
| External ID type  | `gsis`                                        |

Rows with unsupported positions, non-regular season types, or missing GSIS IDs are
skipped and counted in the coverage report. No partial writes occur.

---

## Canonical Stat Mapping

| nflverse column          | Canonical key |
|--------------------------|---------------|
| `completions`            | `pass_cmp`    |
| `attempts`               | `pass_att`    |
| `passing_yards`          | `pass_yd`     |
| `passing_tds`            | `pass_td`     |
| `passing_interceptions`  | `pass_int`    |
| `sacks_suffered`         | `pass_sack`   |
| `passing_first_downs`    | `pass_fd`     |
| `passing_2pt_conversions`| `pass_2pt`    |
| `carries`                | `rush_att`    |
| `rushing_yards`          | `rush_yd`     |
| `rushing_tds`            | `rush_td`     |
| `rushing_first_downs`    | `rush_fd`     |
| `rushing_2pt_conversions`| `rush_2pt`    |
| `receptions`             | `rec`         |
| `targets`                | `rec_tgt`     |
| `receiving_yards`        | `rec_yd`      |
| `receiving_tds`          | `rec_td`      |
| `receiving_first_downs`  | `rec_fd`      |
| `receiving_2pt_conversions`| `rec_2pt`   |
| `sack_fumbles_lost` + `rushing_fumbles_lost` + `receiving_fumbles_lost` | `fum_lost` |

Numeric zero values are preserved in `stats_json` when the source column is present and parseable.
Blank, null, `NA`, `NaN`, infinite, and absent source values are omitted instead of being coerced to zero.
The nflverse `fantasy_points` column maps to `provider_fantasy_points`.

---

## Identity Resolution

Each nflverse row carries a GSIS player ID in the `player_id` column.

The pipeline looks up `player_external_ids` where:
- `provider = 'gsis'`
- `external_id = <gsis_id>`
- `external_type = 'gsis'`

If a mapping exists (any `mapping_status`), the row resolves to the mapped canonical
`player_id` and is eligible for writing.

If no mapping exists, the row is counted as `unresolved`. There is **no name-only
fallback**. To bring unresolved players into coverage, insert rows into
`player_external_ids` linking their GSIS ID to their canonical UUID.

---

## Idempotency

The pipeline is safe to re-run:

- **Archive**: If `data/raw/nflverse/player_stats/{season}/player_stats_{season}.csv`
  exists, the pipeline reuses it (no re-download). The SHA-256 is recomputed from
  the cached file.
- **`football_data_sources`**: Unique on `(provider, source_type, season, sha256)`.
  Re-running with the same file reuses the existing record.
- **`football_import_batches`**: A new batch record is created for each run.
  Historical run data is preserved.
- **`player_weekly_stats`**: Uses the existing `upsertWeeklyStats` function which
  performs an update if a matching row already exists (keyed on
  `(player_id, provider, season, week, season_type)`).

---

## Database Tables

All four tables are RLS-enabled with no authenticated-user policies.
Access is via service role key only.

| Table                     | Purpose                                       |
|---------------------------|-----------------------------------------------|
| `football_data_sources`   | Raw artifact fingerprint and archive path     |
| `football_import_batches` | Per-run tracking and final coverage report    |
| `football_source_rows`    | Per-source-row resolution and write outcome   |
| `football_stat_corrections` | Manual stat overrides / repair audit entries |

Current limitation:
- `football_stat_corrections` does not store `import_batch_id`, `game_id`, `previous_row_hash`, `replacement_row_hash`, or `changed_fields_json`.
- That means a failed historical repair can require a batch-level fallback audit record instead of a fully reconstructed row-level audit trail.

---

## Coverage Report Fields

```
totalSourceRows       — total rows in the source CSV
filteredPositionRows  — rows for QB/RB/WR/TE
regularSeasonRows     — filteredPositionRows where season_type=REG
resolvedRows          — rows with a GSIS mapping found
unresolvedRows        — rows with no GSIS mapping
rejectedRows          — rows with parse/validation errors
writtenRows           — rows written to player_weekly_stats (execute mode only)
errorRows             — rows that failed during write
uniqueGsisIds         — distinct GSIS IDs in scope
resolvedGsisIds       — distinct GSIS IDs with a mapping
unresolvedGsisIds     — distinct GSIS IDs without a mapping
coverageByPosition    — resolved/unresolved counts per position group
```

---

## Non-Negotiables

- Does NOT modify Draft Target Score
- Does NOT modify War Room ordering
- Does NOT add projection value to recommendation formulas
- Does NOT change readiness thresholds or scoring behavior
- Dry run never writes to Supabase
- Identity resolution uses GSIS ID only — no name-only fallback
- Only QB, RB, WR, TE rows from regular season are processed
- Source artifact is immutable once archived; SHA-256 fingerprints the content
- Control-plane audit writes are not transactionally coupled to canonical row updates through the current repository layer; resume behavior must explicitly inspect partial state
