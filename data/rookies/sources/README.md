# Rookie Source Files

These files are local import points for rookie and college-player enrichment.

Values must come from a known source and should include `source`, `sourceLabel`, and `sourceConfidence` when a row contains real data. Leave unknown values blank. Do not fabricate draft capital, college production, landing spot role, depth chart role, snap share, injury status, or coaching context.

Supported files:

- `draft-capital.csv`: NFL draft round/pick/overall inputs.
- `college-production.csv`: verified college production stat inputs.
- `role-notes.csv`: manual role/opportunity notes with explicit source labels.

The acquisition builder preserves existing non-empty enrichment values unless an explicit overwrite mode is added in a future phase.

## Fill Order

Fill draft capital first. It is the cleanest input and immediately improves rookie opportunity/confidence when verified.

1. Run `npm run diagnose:h9-draft-capital-fill-readiness`.
2. Fill `data/rookies/sources/draft-capital-priority-fill.csv`.
3. Run `npm run diagnose:h9-rookie-source-population`.
4. Run `npm run build:h9-rookie-source-files -- --dry-run`.
5. If no conflicts appear, run `npm run build:h9-rookie-source-files -- --apply`.
6. Run `npm run build:h9-rookie-enrichment`.
7. Run `npm run dry-run:h9-rookie-data-import`.
8. Run `npm run dry-run:h9-comprehensive-stat-projections`.

## Source Files

- `draft-capital.csv`: production draft capital source rows. Keep header-only until verified data is available.
- `college-production.csv`: production college production source rows. Keep header-only until verified data is available.
- `role-notes.csv`: production manual role/opportunity rows. Keep header-only until verified role notes are available.
- `*-priority-fill.csv`: generated from the top rookie priority list. Fill these first.
- `*.example.csv`: examples only. Do not copy example rows into production files unless replaced with verified data.
- `imports/`: staging folder for provider/export CSV files.

## Validation

Run:

```bash
npm run diagnose:h9-rookie-source-population
npm run diagnose:h9-draft-capital-fill-readiness
```

Blank fields are treated as unknown data gaps, not zeroes. Non-empty malformed numbers are reported as invalid. Ambiguous player matches are not forced.

Allowed `sourceConfidence` values: `low`, `medium`, `high`.

Allowed `landingSpotRole` values: `clear_starter`, `probable_starter`, `committee`, `rotational`, `backup`, `unknown`.

## Provider Exports

Provider/export intake is explicit-map only. Drop exports into `data/rookies/sources/imports/`, map provider columns to Blackbird source columns, and dry-run the normalization before applying. The normalizer does not guess unknown column meanings.

ADP is not a projection input and is not used as a rookie projection fallback.
