# Scoring Coverage System

## Overview

The scoring coverage system provides a **repository-grounded, machine-verifiable** inventory of every scoring key supported by Blackbird GM. It separates two concerns that are often conflated:

1. **Engine implementation status** — does the scoring engine have a rule to score this key?
2. **Data availability status** — is the required canonical stat available in the current data pipeline?

A key can be "implemented" in the engine but still produce zero points if its canonical stat is not present in `stats_json`. The coverage system makes this distinction explicit and detectable.

---

## Architecture

```
src/lib/scoring/coverage/
├── types.ts       — ScoringCoverageRecord, ScoringEngineStatus, ScoringDataStatus, ScoringStatFamily
├── registry.ts    — Authoritative inventory of all 105 unique scoring keys
├── audit.ts       — Contradiction detector: registry vs. live code (SLEEPER_RULES_BY_KEY)
├── report.ts      — JSON + Markdown report generators
└── audit.test.ts  — 18 structural invariant tests

scripts/
└── audit-scoring-coverage.ts  — CLI entry point

artifacts/scoring/
├── scoring-coverage.json      — Machine-readable full report (generated)
└── scoring-coverage.md        — Human-readable summary (generated)
```

Run the audit at any time:

```bash
npm run audit:scoring-coverage
```

---

## Status Models

### Engine Implementation Status (`ScoringEngineStatus`)

| Value | Meaning |
|-------|---------|
| `implemented_verified` | Rule exists in `SLEEPER_SCORING_RULES` + tested with real stat data |
| `implemented_unverified` | Rule exists but no end-to-end test with real rows |
| `not_implemented` | No rule in `SLEEPER_SCORING_RULES` |

### Data Availability Status (`ScoringDataStatus`)

| Value | Meaning | Action needed |
|-------|---------|---------------|
| `nflverse_weekly_verified` | Column mapped in `normalize.ts` + live tested | None — fully operational |
| `nflverse_weekly_available` | Column mapped, not live tested | Add test coverage |
| `nflverse_weekly_derivable` | Can be computed from existing weekly stats | Add derivation to `normalizeNflverseRow` |
| `nflverse_weekly_unwired` | Column exists in nflverse CSV, not extracted | Extend `STAT_COLUMN_MAP` and `NFLVERSE_REQUIRED_COLUMNS` |
| `nflverse_pbp_derived` | H2 PBP pipeline writes this to `player_weekly_derived_stats` | None — operational via derived stats merge |
| `nflverse_pbp_derivable` | Can be derived from nflverse PBP; current derived-stat coverage does not yet write this canonical stat | Extend the existing PBP derivation pipeline |
| `requires_team_game_context` | Needs team-level game aggregate (pts_allow, yds_allow) | Build team game-result ingestion pipeline |
| `requires_new_source` | No current path; needs new data source | Evaluate source options |
| `not_safely_derivable` | Technically possible but unreliable | Do not implement |
| `out_of_scope` | Position/category intentionally excluded this phase | Expand scope when K/DEF/IDP support is planned |

---

## Stat Families (`ScoringStatFamily`)

13 logical groupings used for reporting and implementation planning:

| Family | Key examples |
|--------|-------------|
| `passing_volume` | pass_yd, pass_att, pass_cmp, pass_inc, pass_sack |
| `passing_outcomes` | pass_td, pass_int, pass_pick6, pass_int_td, pass_2pt |
| `rushing` | rush_yd, rush_att, rush_td, rush_fd, rush_2pt |
| `receiving` | rec, rec_tgt, rec_yd, rec_td, rec_fd, rec_2pt |
| `miscellaneous_skill` | fum, fum_lost, fum_ret_td |
| `special_teams_skill` | kick_ret_yd, punt_ret_yd, return_td, return_fd |
| `first_down_bonuses` | pass_fd, bonus_fd_qb/rb/wr/te |
| `yardage_threshold_bonuses` | bonus_pass_yd_300, bonus_rush_yd_100, bonus_rec_yd_100, etc. |
| `long_td_bonuses` | rec_td_40p, rec_td_50p, rush_td_40p, rush_td_50p |
| `position_rec_bonuses` | rec_te_bonus, bonus_rec_te/rb/wr |
| `kicking` | xpm, xpmiss, fgm, fgmiss, fgm_* (out of scope) |
| `team_defense` | sack, int, ff, fr, pts_allow_*, yds_allow_* (out of scope / team context) |
| `idp` | solo_tkl, ast_tkl, tkl, qb_hit, pd, etc. (out of scope) |

---

## Implementation Phases

| Phase | Keys delivered |
|-------|----------------|
| H1 | All 20 nflverse weekly canonical stats + all bonus/threshold keys that read them |
| H2 | `rec_td_40p`, `rec_td_50p`, `rush_td_40p`, `rush_td_50p` (PBP derivation pipeline) |
| H2.1 | `pass_pick6` plus operational alias support for `pass_int_td` through the same canonical derived stat |
| H3 | This audit system (no new scoring keys; coverage visibility) |

---

## Contradiction Detection

The audit compares the static registry against live code at runtime:

| Check | Description |
|-------|-------------|
| Engine mismatch | Registry says `implemented_*` but no rule in `SLEEPER_RULES_BY_KEY` |
| Registry gap | Key in engine but no registry entry |
| PBP-derived set | Registry `nflverse_pbp_derived` keys must match the current derived-stat output set |
| Known definition mismatch | Registry conflicts with explicit record in `key-definitions.ts` |
| Data status conflict | Offense-only key marked `out_of_scope` |
| Dual-position keys | `sack`, `int`, etc. must have rules for both DEF and IDP |

The audit exits non-zero (`exit 1`) if any **error-severity** findings are detected.

---

## Implementation Roadmap Priority Order

When implementing new keys, prioritize by data status:

1. `nflverse_weekly_derivable` — quick wins (compute in `normalizeNflverseRow`)
2. `nflverse_weekly_unwired` — easy (add columns to `STAT_COLUMN_MAP`)
3. `nflverse_pbp_derivable` — medium (extend the existing PBP pipeline)
4. `requires_team_game_context` — harder (team game-result pipeline)
5. `requires_new_source` — research required
6. `out_of_scope` — K/DEF/IDP scope expansion

### Quick-win keys (Phase H4 candidates)

| Key | Action | Effort |
|-----|--------|--------|
| `pass_inc` | Add `pass_att - pass_cmp` derivation in `normalizeNflverseRow` | Low |
| `fum` | Add `sack_fumbles + rushing_fumbles + receiving_fumbles` to STAT_COLUMN_MAP | Low |
| `kick_ret_yd` | Add `kick_return_yards` to STAT_COLUMN_MAP + REQUIRED_COLUMNS | Low |
| `punt_ret_yd` | Add `punt_return_yards` to STAT_COLUMN_MAP + REQUIRED_COLUMNS | Low |
| `return_td` | Add `special_teams_tds` to STAT_COLUMN_MAP + REQUIRED_COLUMNS | Low |
| `return_fd` | Add `return_first_downs` to STAT_COLUMN_MAP + REQUIRED_COLUMNS | Low |
| `fum_ret_td` | Build PBP fumble-return-TD derivation | Medium |

---

## Design Constraints

- **Do not fabricate unavailable stats** — if a canonical stat is absent, the key produces `missing_stat`, never inferred from a related stat. `pass_int` must never substitute for `pass_pick6`.
- **Known-zero semantics for PBP-derived stats** — the derived-stat pipeline writes the H2/H2.1 canonical PBP keys (`rec_td_40p`, `rec_td_50p`, `rush_td_40p`, `rush_td_50p`, `pass_pick6`) into the derived row payload, so absence means not-yet-derived.
- **Dry-run by default** — the PBP import pipeline never writes without `--execute`.
- **K/DEF/IDP deferred** — engine rules exist, but ingestion scope is currently QB/RB/WR/TE only.

---

## Artifacts

After running `npm run audit:scoring-coverage`, the following files are generated:

- `artifacts/scoring/scoring-coverage.json` — full machine-readable report
- `artifacts/scoring/scoring-coverage.md` — human-readable summary with tables

These artifacts are **generated output** — do not edit them manually. Re-run the audit script to refresh after registry or engine changes.
