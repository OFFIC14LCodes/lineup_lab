# Rookie Data Inputs

Blackbird reads local rookie context from `data/rookies/rookie-data.csv` or `data/rookies/rookie-data.json`.

This is a local/import-based data layer. Do not scrape websites, add paid APIs, use ADP as a rookie projection fallback, or invent missing rookie stats.

The canonical identity file is `rookie-data.csv`. Optional enrichment can be placed in `rookie-enrichment.csv` or `rookie-enrichment.json`; enrichment values are merged at dry-run time and do not erase known base values with blanks.

`rookie-enrichment.csv` is the generated enrichment overlay consumed by rookie projection loaders. For new source data, prefer filling the source files under `data/rookies/sources/` and then rebuild `rookie-enrichment.csv`; do not hand-enter unverified values.

`rookie-enrichment-priority.csv` is a smaller fillable export for the highest-priority rookies. It includes helper columns `priorityTier`, `priorityScore`, and `priorityReasons`; these are for workflow triage only and are not projection inputs.

## Required Fields

- `playerName`
- `position`
- `season`
- `source`

Allowed `source` values: `manual`, `csv_import`, `provider`, `derived`, `unknown`.

## Strongly Preferred Fields

- `playerId`
- `team`
- `rookieYear`
- `age`
- `yearsExperience`
- `nflDraftRound`
- `nflDraftPick`
- `nflDraftOverall`
- `nflDraftTeam`
- `college`
- `collegeConference`
- `collegeGames`

## Position-Specific Fields

QB: `collegePassingAttempts`, `collegeCompletions`, `collegePassingYards`, `collegePassingTouchdowns`, `collegeInterceptions`, `collegeRushingAttempts`, `collegeRushingYards`, `collegeRushingTouchdowns`.

RB: `collegeRushingAttempts`, `collegeRushingYards`, `collegeRushingTouchdowns`, `collegeTargets`, `collegeReceptions`, `collegeReceivingYards`, `collegeReceivingTouchdowns`.

WR/TE: `collegeTargets`, `collegeReceptions`, `collegeReceivingYards`, `collegeReceivingTouchdowns`, `collegeRushingAttempts`, `collegeRushingYards`, `collegeRushingTouchdowns`.

IDP: `collegeSoloTackles`, `collegeAssistedTackles`, `collegeTotalTackles`, `collegeTacklesForLoss`, `collegeSacks`, `collegeInterceptionsDef`, `collegePassesDefended`, `collegeForcedFumbles`, `collegeFumbleRecoveries`.

Optional role fields: `landingSpotRole`, `opportunityNotes`.

Allowed `landingSpotRole` values: `clear_starter`, `probable_starter`, `committee`, `rotational`, `backup`, `unknown`.

## JSON Shape

`rookie-data.json` should be an array of objects using the same field names as the CSV:

```json
[
  {
    "playerName": "Example Rookie",
    "position": "WR",
    "team": "KC",
    "season": 2026,
    "source": "manual"
  }
]
```

## Missing Data

Blank fields are treated as data gaps, not zeroes. Missing draft capital, college production, landing spot role, injury, snap share, or depth chart information should stay blank unless it is known from an approved local/manual source.

ADP is not a rookie projection input and is not used as an enrichment priority signal.

## Enrichment Workflows

Source-file enrichment:

1. Run `npm run diagnose:h9-draft-capital-fill-readiness`.
2. Fill `data/rookies/sources/draft-capital-priority-fill.csv` first.
3. Leave unknown fields blank.
4. Run `npm run diagnose:h9-rookie-source-population`.
5. Run `npm run build:h9-rookie-source-files -- --dry-run`.
6. If clean, run `npm run build:h9-rookie-source-files -- --apply`.
7. Run `npm run build:h9-rookie-enrichment`.
8. Run `npm run dry-run:h9-rookie-data-import`.

Provider/export enrichment:

1. Place exported CSVs in `data/rookies/sources/imports/`.
2. Use an explicit column map to normalize provider columns to Blackbird source columns.
3. Dry-run normalization before applying.
4. The source merge reports conflicts and does not overwrite non-empty values with blanks.
5. Ambiguous or conflicting rows are reported and not forced.

`data/rookies/rookie-data.enriched.example.csv` shows a sparse enrichment overlay shape. It is illustrative only; replace example values with verified source data before use.

## Field Priorities By Position

QB:
- `nflDraftRound`, `nflDraftOverall`, `nflDraftTeam`
- `collegePassingAttempts`, `collegeCompletions`, `collegePassingYards`, `collegePassingTouchdowns`, `collegeInterceptions`
- `collegeRushingAttempts`, `collegeRushingYards`, `collegeRushingTouchdowns`
- `landingSpotRole`

RB:
- `nflDraftRound`, `nflDraftOverall`, `nflDraftTeam`
- `collegeRushingAttempts`, `collegeRushingYards`, `collegeRushingTouchdowns`
- `collegeTargets`, `collegeReceptions`, `collegeReceivingYards`, `collegeReceivingTouchdowns`
- `landingSpotRole`

WR/TE:
- `nflDraftRound`, `nflDraftOverall`, `nflDraftTeam`
- `collegeTargets`, `collegeReceptions`, `collegeReceivingYards`, `collegeReceivingTouchdowns`
- `landingSpotRole`

DL/LB/DB:
- `nflDraftRound`, `nflDraftOverall`, `nflDraftTeam`
- `collegeSoloTackles`, `collegeAssistedTackles`, `collegeTotalTackles`
- `collegeTacklesForLoss`, `collegeSacks`, `collegeInterceptionsDef`, `collegePassesDefended`, `collegeForcedFumbles`
- `landingSpotRole`

K:
- `nflDraftRound`, `nflDraftOverall`, `nflDraftTeam`
- verified kicking production only if a supported field is added later
- `landingSpotRole`

## Valid Row Examples

Keep unknown fields blank:

```csv
playerId,playerName,position,team,season,source,sourceLabel,nflDraftRound,nflDraftPick,nflDraftOverall,nflDraftTeam,college,collegeConference,collegeGames,landingSpotRole,opportunityNotes
example-qb,Example Rookie QB,QB,CHI,2026,manual,verified_manual,1,1,1,CHI,Example State,SEC,14,probable_starter,verified role note
example-db,Example Rookie DB,DB,JAX,2026,manual,verified_manual,,,,JAX,,,,,
```

Do not enter guessed values. If draft capital, college stats, or role are not verified, leave them blank.

## Commands

Build a local file from canonical player metadata:

```bash
npm run build:h9-rookie-data-file
```

Validate the import:

```bash
npm run dry-run:h9-rookie-data-import
```

Create or refresh priority diagnostics and fillable priority export:

```bash
npm run diagnose:h9-rookie-enrichment-priority
npm run diagnose:h9-rookie-enrichment-coverage
npm run diagnose:h9-draft-capital-fill-readiness
npm run diagnose:h9-rookie-source-population
```

Run against the real draft room:

```bash
npm run diagnose:h9-rookie-enrichment-priority -- --draft-room-id=f85238ff-b2ee-4053-8493-e38c4cb63bd3
npm run diagnose:h9-rookie-enrichment-coverage -- --draft-room-id=f85238ff-b2ee-4053-8493-e38c4cb63bd3
```

Validate projection quality:

```bash
npm run dry-run:h9-comprehensive-stat-projections
npm run diagnose:h9-rookie-data-readiness
npm run diagnose:h9-rookie-projection-quality
npm run diagnose:h9-rookie-import-readiness
npm run diagnose:h9-rookie-enrichment-readiness
```

After filling verified enrichment data, rerun:

```bash
npm run build:h9-rookie-source-files -- --dry-run
npm run build:h9-rookie-source-files -- --apply
npm run build:h9-rookie-enrichment
npm run dry-run:h9-rookie-data-import
npm run dry-run:h9-comprehensive-stat-projections -- --persist --inspect-persistence
```
