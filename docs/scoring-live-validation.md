# Blackbird GM — F4 Live Scoring Validation

## Purpose

Phase F4 provides a read-only, operator-authenticated validation workflow that runs the existing
`blackbird-scoring-v1` and `blackbird-scoring-readiness-v1` engines against real stored data
in the configured Supabase project. The goal is to collect concrete evidence of data coverage,
readiness status, and discrepancy patterns — not to change any recommendation behavior.

**Draft Target Score is unchanged. War Room ordering is unchanged.**

---

## How to Run

### Prerequisites

Set the following in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=<your-project-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SCORING_VALIDATION_OPERATOR_USER_ID=<auth-user-id-whose-leagues-to-validate>
```

`SCORING_VALIDATION_OPERATOR_USER_ID` must be a real Supabase auth user ID. The runner validates
that queried leagues are owned by this user before scoring them.

### Command

```bash
npm run validate:scoring-live
```

The runner:
- Exits **zero** on completion (including when data is sparse or no cohort is ready).
- Exits **nonzero** only for operational failures (DB unreachable, misconfiguration, write detected).
- Produces structured JSON evidence to stdout.
- Is never invoked by `npm test`, `npm run build`, or CI.

---

## Anonymization

All identifying information is anonymized in the evidence output:

| Raw value | Output label |
|-----------|-------------|
| Real league IDs | `League A`, `League B`, `League C` |
| Real provider names | `Provider A`, `Provider B`, … |
| Individual player names / IDs | Not included in cohort-level output |
| Discrepant row samples | Labeled `Row 1`, `Row 2`, … |

Do not commit `.env.local` or any evidence output that contains real league IDs or user IDs.

---

## Sample Bounds

| Parameter | Value |
|-----------|-------|
| Maximum leagues selected | 3 |
| Maximum rows per combined report | 100 |
| Maximum rows per position cohort | 25 |
| Maximum discrepant samples per investigation | 5 |
| Maximum representative leagues scanned | 20 |

---

## Readiness Interpretation

Each cohort receives one of four statuses from the existing F3 readiness engine:

| Status | Meaning |
|--------|---------|
| `ready` | Meets all thresholds; eligible for controlled experiments |
| `conditionally_ready` | Minor issues (staleness, minor keys); limited eligibility |
| `not_ready` | Core coverage or alias issues block eligibility |
| `insufficient_data` | Fewer than 5–10 rows; descriptive only |

**Thresholds are not changed by this phase.** Evidence must demonstrate a concrete
misclassification before any threshold change is considered.

---

## Discrepancy Cues

A discrepancy investigation is triggered for a cohort when all of the following hold:
- At least **5 fully covered rows** exist (provider total present, Blackbird coverage complete).
- AND at least one of:
  - ≥ 3 rows have comparison status `"different"`
  - Mean absolute difference > 0.5
  - Maximum absolute difference > 2.0

These are investigation triggers only, not readiness gates. A triggered investigation does not
automatically imply a scoring engine defect — likely causes are inferred from the component
evidence (unsupported keys, missing stats, alias ambiguity, rounding, staleness).

---

## Experiment Candidate Rules

A cohort is reported as an experiment candidate only when the existing F3 rules say it is
eligible, and the additional F4 gates also pass.

### Weekly projections

| Gate | Threshold |
|------|-----------|
| Source type | `projections` with `projection_type = weekly` |
| Sample size | ≥ 20 successfully scored rows |
| Eligibility | ≥ 95% of rows eligible |
| Average coverage | ≥ 99% |
| Minimum coverage | ≥ 95% |
| Unsupported keys | No core or material impact |
| Alias ambiguity | None |
| Error rate | ≤ 5% |

### Weekly actuals (`weekly_stats`)

Weekly actuals **are not** projection recommendation candidates. They may confirm historical
scoring accuracy but cannot serve as draft projection sources. They are always classified as
**scoring-validation candidates** in the evidence output, not experiment candidates.

### Season / ROS projections

Season and rest-of-season projections may qualify only for `season_value_experiment`, never
for `weekly_projection_experiment` or `weekly_recommendation`.

They must also meet the F3 minimum sample and readiness gates.

---

## No-Write Guarantee

The runner captures row counts from all affected tables before and after the validation run.
If any count changes, the test fails immediately with a `READ-ONLY VIOLATION` error.

Specifically, the runner never calls:
- Any `insert`, `upsert`, or `update` Supabase operation.
- Any import session creation or modification function.
- Any external ID mapping function.
- Any provider stats or projection write path.

---

## Limitations

- The runner uses the admin service role key to bypass cookie-based auth, so it validates leagues
  owned by the configured operator user only. It does not simulate browser authentication.
- Smoke test rows (from `smoke:provider-pipeline` and `smoke:provider-import`) will appear in
  the counts and may be scored. They typically appear as sparse cohorts (`insufficient_data`).
- The runner does not distinguish between smoke test rows and real imported rows; if the database
  contains only smoke data, the verdict will be `INSUFFICIENT LIVE DATA`.
- `availableWeeks` and `availableSeasons` are derived from `player_weekly_stats` only; projections
  may cover different seasons.
- No browser walkthrough is performed; the API path and service layer are validated instead.

---

## Explicit Statement: Draft Target Score Is Unchanged

The F4 validation runner does not modify, read, or influence:
- Draft Target Score calculation
- War Room player ordering or recommendation formulas
- Any ranking, scoring weight, or recommendation experiment state

Calculated scores and validation reports produced by this runner are never persisted to Supabase.
