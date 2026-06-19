# Rookie Team Confirmation Source

H22 uses a local CSV to confirm NFL team assignments for rookie/new unmatched projection rows. This workflow is dry-run/read-only and writes only local artifacts.

The goal is only to confirm the NFL team for rookie/new unmatched rows. This file does not create projections, does not rank players, and does not change Draft Suggestions or War Room behavior.

## Files

- Template: `data/rookies/rookie-team-confirmation-2026.template.csv`
- Real local source: `data/rookies/rookie-team-confirmation-2026.csv`
- Normalized artifacts: `artifacts/projections/rookies/rookie-team-confirmation-2026.normalized.*`
- Confirmation artifacts: `artifacts/projections/backtesting/projection-rookie-team-confirmation-2026.*`

Do not commit the real source CSV. Keep large or manually exported source files local.

## Source Options

Use the most reliable local source available, then inspect the headers before normalizing.

- nflreadr/nflverse roster export: best if the current roster export includes rookies and current team fields.
- Sleeper player export: useful if `data/sleeper/raw/players-nfl.json` or another local export has rookie/team/id values.
- NFL draft result CSV: useful for draft club, round, and pick, but verify current NFL team because rookies can be traded or unsigned.
- Manual rookie priority fill file: useful for a small review list when public exports are incomplete.
- Existing Blackbird rookie source files under `data/rookies/sources`: useful for draft capital, role notes, or college context; still verify the current NFL team separately.

Avoid mixing projection assumptions into this file. A row should answer: "Which NFL team is this rookie associated with, and what source supports that?"

## CSV Columns

Use these headers:

```text
player_id,sleeper_id,gsis_id,player_name,position,college,nfl_team,draft_club,draft_round,draft_pick,source,source_updated_at,notes
```

Identifiers are preferred in this order: `player_id`, `sleeper_id`, `gsis_id`. Rows without identifiers are retained for fallback matching by name and position. If college is known, include it so later reviews can disambiguate duplicate names.

Use standard team abbreviations for `nfl_team` and `draft_club`, such as `ARI`, `BAL`, `CHI`, `JAX`, `KC`, `LAR`, `LV`, `WAS`, or `FA`.

## Inspect Headers

Before preparing the canonical CSV, inspect the source file:

```bash
npm run data:rookies:team-confirmation:inspect -- --input=data/current-rosters/current-rosters-2026.raw.csv
```

The inspect command prints headers, sample rows, direct canonical mappings, missing required fields, missing recommended fields, and heuristic mapping suggestions. It does not write artifacts.

## Build From Current Rosters

If `data/current-rosters/current-rosters-2026.raw.csv` exists and includes rookie/current-team fields, use R locally to derive the rookie confirmation file. Inspect the real headers first because nflreadr column names can vary by source/version.

```r
install.packages(c("readr", "dplyr"))
library(readr)
library(dplyr)

rosters <- read_csv("data/current-rosters/current-rosters-2026.raw.csv")

rookies <- rosters %>%
  filter(entry_year == 2026 | rookie_year == 2026 | years_exp == 0) %>%
  transmute(
    player_id = gsis_id,
    sleeper_id = sleeper_id,
    gsis_id = gsis_id,
    player_name = full_name,
    position = position,
    college = college,
    nfl_team = team,
    draft_club = draft_club,
    draft_round = NA,
    draft_pick = draft_number,
    source = "nflreadr_rosters_rookie_extract",
    source_updated_at = as.character(Sys.time()),
    notes = paste0("entry_year=", entry_year, "; rookie_year=", rookie_year)
  )

write_csv(rookies, "data/rookies/rookie-team-confirmation-2026.csv")
```

If the export uses `recent_team` instead of `team`, `player_name` instead of `full_name`, or `draft_pick` instead of `draft_number`, adjust the `transmute()` fields before writing the canonical CSV.

## Alternative Local Sources

For a Sleeper player export, convert local player records into the canonical columns and prefer `sleeper_id`, `player_name`, `position`, and current team. Use `source = "sleeper_player_export_rookie_extract"`.

For an NFL draft result CSV, map `team` or `club` to `draft_club`, preserve `draft_round` and `draft_pick`, and only set `nfl_team` when the draft team is still the current team according to a roster/source check.

For manual fills, start from the template and add only confirmed rows. Put the source URL/name and date in `source` and `source_updated_at`, and explain any ambiguity in `notes`.

## Commands

Normalize a template or real local CSV:

```bash
npm run data:rookies:team-confirmation:normalize -- --season=2026 --input=data/rookies/rookie-team-confirmation-2026.template.csv
```

After placing a real local source file:

```bash
npm run data:rookies:team-confirmation:normalize -- --season=2026 --input=data/rookies/rookie-team-confirmation-2026.csv
npm run projection:rookies:team-confirmation -- --projection-season=2026 --include-idp
```

The confirmation report consumes H21 policy packet artifacts, H19 roster-refresh artifacts, the preseason projection snapshot, and the normalized rookie source if present. If the real normalized source is missing, the report still writes artifacts with `rookie_team_source_missing`.

## Policy Boundary

H22 does not change H21 behavior. It previews how confirmed rookie rows could move from `policy_source_expansion_required` to `policy_active_candidate`, while conflicts stay `policy_manual_review` and missing/unmatched rows stay `policy_source_expansion_required`.
