# Scoring Validation Readiness

Internal-only readiness guidance for Blackbird GM scoring validation.

## Purpose

Phase F3 adds a bounded, read-only validation layer that answers:

- whether a league scoring configuration is sufficiently supported
- whether an individual stored row is sufficiently covered
- whether a provider/source/position cohort is consistently covered
- whether calculated scores are eligible for future recommendation experiments

This phase does not:

- change Draft Target Score
- change War Room ordering
- persist calculated fantasy points
- change provider import behavior

## Versions

- Scoring formula version: `blackbird-scoring-v1`
- Readiness version: `blackbird-scoring-readiness-v1`

## Readiness Layers

### League readiness

Evaluates the owned league scoring configuration for a position context.

Inputs:

- normalized scoring settings
- league scoring audit
- optional position group

Outputs:

- applicable active keys
- supported/unsupported applicable keys
- invalid settings
- support ratio
- aggregate-unsafe keys
- readiness decision

### Row readiness

Evaluates whether one stored row can be scored reliably enough for future experiments.

Inputs:

- scored row result
- league readiness
- source type
- aggregate compatibility
- provider comparison

Outputs:

- readiness status
- readiness score
- experiment eligibility
- experiment scope
- reasons, warnings, failed rules

### Cohort readiness

Summarizes consistency for bounded groups, currently grouped by:

- provider
- source type
- position group
- projection type

Outputs:

- readiness counts
- eligible percentage
- coverage averages/minimums
- common unsupported keys
- common missing stats
- provider comparison metrics
- sample sufficiency label

## Status Meanings

- `ready`: safe enough for future controlled experiments
- `conditionally_ready`: useful for internal analysis with explicit limitations
- `not_ready`: blocked by unsupported/high-impact gaps or repeated row issues
- `insufficient_data`: not enough evidence or key context is missing

## Readiness Score

The readiness score is a transparent 0-100 rules-based score, not a model confidence score.

Current structure:

- league support: 30
- row raw-stat coverage: 35
- identity and position integrity: 15
- alias and data integrity: 10
- source and aggregate suitability: 10

Current caps:

- invalid league settings cap at 20
- unsupported core/material key cap at 59
- missing position cap at 40

## Unsupported-Key Impact Levels

- `core`: foundational scoring such as receptions, yards, touchdowns, turnovers, key kicker/DEF/IDP rules
- `material`: meaningful but not always foundational scoring such as bonuses, defense tiers, certain sack/pressure/tackling variants
- `minor`: niche or low-frequency categories such as many return/special-teams variants
- `unknown`: conservative fallback; treated as blocking/high-impact for readiness

## Experiment Eligibility Rules

The validation layer reports experiment eligibility but does not feed recommendation logic yet.

Current rules:

- weekly actuals: eligible only when row readiness is `ready`
- weekly projections: eligible only when row readiness is `ready`
- season/rest-of-season projections: may be eligible only for season-level value experiments, not weekly recommendation experiments
- season actual aggregates: may be eligible only for historical season analysis when aggregate scoring is exact enough

## Sample Sufficiency Labels

- `insufficient`: fewer than 5 rows
- `small`: 5-19 rows
- `moderate`: 20-49 rows
- `stronger`: 50+ rows

These are descriptive labels only, not statistical guarantees.

## Provider Comparison

Provider fantasy points remain diagnostic only.

The validation report summarizes:

- with/without provider totals
- match/close/different/incomplete-coverage counts
- mean signed difference
- mean absolute difference
- median absolute difference
- maximum absolute difference

Provider mismatch alone does not block readiness if Blackbird coverage is otherwise complete.

## Aggregate Restrictions

Season and ROS rows may be structurally inexact when league scoring depends on game-level information such as:

- weekly threshold bonuses
- defense points-allowed tiers
- defense yards-allowed tiers
- long-play style bonuses

These rows can still be useful for internal validation, but not as exact weekly recommendation inputs.

## Thresholds

Current overall readiness thresholds:

- `ready`
  - at least 20 successfully scored rows
  - at least 95% eligible rows
  - average coverage at least 0.99
  - minimum coverage at least 0.95
  - error rate at most 5%
- `conditionally_ready`
  - at least 10 successfully scored rows
  - at least 80% eligible rows
  - average coverage at least 0.95
  - minimum coverage at least 0.90

## Limitations

- on-demand only
- no persistence
- no background recalculation
- no recommendation integration yet
- no claim that provider totals are truth
- bounded sample only; not a full-database certification
