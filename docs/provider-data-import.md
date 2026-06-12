# Provider Data Import

Internal-only manual import flow for football data review in Blackbird GM.

## Guardrails

- Feature flag: `ENABLE_PROVIDER_DATA_IMPORT=true`
- Authenticated settings route only: `/settings/data-import`
- File size limit: 5 MB
- Parsed row limit: 250 rows
- Supported dataset kinds:
  - `weekly_stats`
  - `season_stats`
  - `projection`
  - `injury`
- Supported providers:
  - `manual`

## Flow

1. Upload a JSON or CSV file from the settings page.
2. Preview parsing and normalization results.
3. Review any blocked identity rows.
4. Approve a player match or skip a blocked row.
5. Execute the ready subset explicitly.

## Session Integrity

- Preview data is stored in `public.provider_import_sessions`.
- Sessions are scoped to the authenticated `user_id`.
- Sessions expire after 30 minutes.
- Authenticated users can `SELECT` only their own sessions through RLS.
- Ordinary authenticated users do not receive direct insert/update/delete session policies.
- The stored payload includes:
  - normalized records
  - preview plan
  - execution result metadata
  - review history
- The source hash is stored in the table column, not duplicated in the JSON payload.
- Session payloads intentionally omit raw upload bytes and scrub arbitrary imported metadata before persistence.

## Migration Requirement

Author the schema with:

- `supabase/migrations/006_provider_import_sessions.sql`

The runtime session flow depends on that migration being applied in the target Supabase project.

## Sample Files

Public sample files live under:

- `public/examples/provider-import/*.csv`
- `public/examples/provider-import/*.json`

These are intentionally small synthetic examples for validating the flow, not production datasets.

## Verification Notes

- `npm run smoke:provider-pipeline` runs only `scripts/provider-pipeline-smoke.smoke.ts`.
- `npm run smoke:provider-import` runs only `scripts/provider-import-smoke.smoke.ts`.
- Import execution is non-transactional; successful writes are not rolled back if a later row fails.
- Partially failed sessions retain their execution outcomes, stored plan, and review history for inspection.
- Automatic retry is not currently supported for `failed` or `partially_failed` sessions; create a fresh preview instead.
