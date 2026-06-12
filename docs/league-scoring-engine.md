# League Scoring Engine

Blackbird GM F1 adds a deterministic fantasy scoring engine for provider-neutral stats and projections.

## Purpose

- Score stored `stats_json` against a Sleeper league's canonical `leagues.scoring_settings_json`.
- Return transparent component-level math, coverage reporting, and warnings.
- Keep the engine pure and reusable across weekly actuals, season stats, and projections.

## Formula Version

- `blackbird-scoring-v1`

## Canonical League Scoring Source

- Canonical source table/field: `public.leagues.scoring_settings_json`
- Imported from Sleeper `league.scoring_settings` in [src/lib/rosterforge/sync.ts](/c:/Projects/lineup_lab/src/lib/rosterforge/sync.ts)
- Existing derived convenience field: `leagues.te_premium`, currently sourced from `rec_te_bonus`

## Supported Categories

- Passing
- Rushing
- Receiving
- First downs
- Returns
- Kicking
- Team defense
- IDP
- Threshold bonuses
- Miscellaneous turnover scoring

## Canonical Stat Keys

Examples:

- Passing: `pass_yd`, `pass_td`, `pass_int`, `pass_cmp`, `pass_inc`, `pass_att`, `pass_sack`, `pass_2pt`, `pass_fd`, `pass_pick6`
- Rushing: `rush_yd`, `rush_td`, `rush_att`, `rush_2pt`, `rush_fd`
- Receiving: `rec`, `rec_yd`, `rec_td`, `rec_tgt`, `rec_2pt`, `rec_fd`
- Returns: `kick_ret_yd`, `punt_ret_yd`, `return_td`, `return_fd`
- Kicking: `xpm`, `xpmiss`, `fgm`, `fgmiss`, `fgm_20_29`, `fgm_40_49`, `fgm_50p`
- Team defense: `sack`, `int`, `ff`, `fr`, `safe`, `blk_kick`, `def_td`, `def_st_td`, `pts_allow`, `yds_allow`
- IDP: `solo_tkl`, `ast_tkl`, `tkl`, `tkl_loss`, `qb_hit`, `pd`, `int_ret_yd`, `fr_ret_yd`, `st_tkl`

## Alias Behavior

- Exact canonical key wins.
- Documented aliases are accepted conservatively.
- Multiple aliases with conflicting values produce an ambiguity warning.
- The engine does not combine multiple aliases into one total.

## Fractional Scoring

- Yardage and other fractional settings use raw JavaScript number precision.
- Intermediate values are not rounded.
- Display formatting should happen outside the engine.

## TE Premium

- `rec_te_bonus` is treated as an additive TE-only reception bonus on top of generic `rec`.
- Position-specific replacement semantics like `rec_te` are not guessed; unsupported keys remain visible in coverage/audit output.

## Bonus Behavior

- Supported threshold bonuses currently include:
  - `bonus_pass_yd_300`
  - `bonus_pass_yd_400`
  - `bonus_rush_yd_100`
  - `bonus_rush_yd_200`
  - `bonus_rec_yd_100`
  - `bonus_rec_yd_200`
- Threshold rules are explicit and non-cumulative unless multiple keys are active and independently matched.

## K / DEF / IDP Coverage

- Kicker distance-band scoring is supported when band-specific raw stats exist.
- Generic `fgm` is intentionally not double-counted alongside active distance-band keys.
- DEF points-allowed and yards-allowed tiers are exclusive by threshold match.
- IDP uses explicit individual-player keys and warns when total tackles overlap with solo/assist scoring.

## Unknown and Unsupported Keys

- Active nonzero scoring keys are never silently ignored.
- Each active key is tracked as one of:
  - evaluated
  - supported but missing required stats
  - unsupported
  - not applicable for the position

## Coverage Reporting

Each score result includes:

- evaluated keys
- supported keys
- unsupported keys
- missing-stat requirements
- unused raw stat keys
- ambiguous alias reports
- `coverageRatio`
- `isComplete`

## Limitations

- This is not full Sleeper scoring compatibility yet.
- Position-specific reception replacement keys are not assumed.
- Long-play touchdown bonuses are not implemented yet.
- Some uncommon team-defense and kicker scoring keys may still be unsupported.
- No persistence or background recalculation exists in F1.

## Provider Adapter Guidance

- Future provider adapters should normalize toward the canonical stat keys listed here.
- Do not pre-compute fantasy points inside adapters.
- Preserve raw stats when possible; let league scoring happen in this engine.
