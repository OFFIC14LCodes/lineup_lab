import type { ScoringCategory } from "@/lib/scoring/types";
import type {
  ScoringCoverageRecord,
  ScoringDataStatus,
  ScoringEngineStatus,
  ScoringStatFamily
} from "./types";

// ---------------------------------------------------------------------------
// Registry builder
// ---------------------------------------------------------------------------

function entry(
  key: string,
  label: string,
  family: ScoringStatFamily,
  category: ScoringCategory,
  positions: string[],
  engineStatus: ScoringEngineStatus,
  dataStatus: ScoringDataStatus,
  options: Partial<
    Pick<ScoringCoverageRecord, "canonicalStatKey" | "derivedStatExpression" | "normalizedFrom" | "implementationPhase" | "blockers" | "notes">
  > = {}
): ScoringCoverageRecord {
  return {
    key,
    label,
    family,
    category,
    allowedPositions: positions,
    engineStatus,
    dataStatus,
    canonicalStatKey: options.canonicalStatKey ?? key,
    derivedStatExpression: options.derivedStatExpression ?? null,
    normalizedFrom: options.normalizedFrom ?? null,
    implementationPhase: options.implementationPhase ?? null,
    blockers: options.blockers ?? [],
    notes: options.notes ?? null
  };
}

const QB = ["QB"];
const OFF = ["QB", "RB", "WR", "TE"];
const K = ["K"];
const DEF = ["DEF"];
const IDP = ["DL", "LB", "DB"];
const DEF_IDP = [...DEF, ...IDP];

const IMPL_VER = "implemented_verified" as const;
const NOT_IMPL = "not_implemented" as const;
const NW_VER = "nflverse_weekly_verified" as const;
const PBP_DER = "nflverse_pbp_derived" as const;
const OOS = "out_of_scope" as const;

export const H2_VERIFIED_KEYS = [
  "pass_pick6",
  "rec_td_40p",
  "rec_td_50p",
  "rush_td_40p",
  "rush_td_50p"
] as const;

// ---------------------------------------------------------------------------
// Registry — 115 unique scoring keys
// ---------------------------------------------------------------------------

export const SCORING_COVERAGE_REGISTRY: ScoringCoverageRecord[] = [
  // ─── Passing volume ────────────────────────────────────────────────────────
  entry("pass_yd", "Passing yards", "passing_volume", "passing", QB, IMPL_VER, NW_VER,
    { normalizedFrom: "passing_yards", implementationPhase: "H1" }),
  entry("pass_att", "Passing attempts", "passing_volume", "passing", QB, IMPL_VER, NW_VER,
    { normalizedFrom: "attempts", implementationPhase: "H1" }),
  entry("pass_cmp", "Passing completions", "passing_volume", "passing", QB, IMPL_VER, NW_VER,
    { normalizedFrom: "completions", implementationPhase: "H1" }),
  entry("pass_inc", "Passing incompletions", "passing_volume", "passing", QB, IMPL_VER, NW_VER,
    { derivedStatExpression: "pass_att - pass_cmp",
      implementationPhase: "H4A",
      notes: "Derived during weekly normalization as pass_att - pass_cmp with a persisted warning when source completions exceed attempts." }),
  entry("pass_sack", "Sacks taken (QB)", "passing_volume", "passing", QB, IMPL_VER, NW_VER,
    { normalizedFrom: "sacks_suffered", implementationPhase: "H1" }),

  // ─── Passing outcomes ──────────────────────────────────────────────────────
  entry("pass_td", "Passing touchdowns", "passing_outcomes", "passing", QB, IMPL_VER, NW_VER,
    { normalizedFrom: "passing_tds", implementationPhase: "H1" }),
  entry("pass_int", "Interceptions thrown", "passing_outcomes", "passing", QB, IMPL_VER, NW_VER,
    { normalizedFrom: "passing_interceptions", implementationPhase: "H1" }),
  entry("pass_2pt", "Passing two-point conversions", "passing_outcomes", "passing", QB, IMPL_VER, NW_VER,
    { normalizedFrom: "passing_2pt_conversions", implementationPhase: "H1" }),
  entry("pass_pick6", "Pick-sixes thrown", "passing_outcomes", "passing", QB, IMPL_VER, PBP_DER,
    { implementationPhase: "H2.1",
      notes: "Derived from nflverse PBP; stored in player_weekly_derived_stats and merged onto weekly scoring rows." }),
  entry("pass_int_td", "Pick-six thrown (alternate key)", "passing_outcomes", "passing", QB, IMPL_VER, PBP_DER,
    { canonicalStatKey: "pass_pick6",
      implementationPhase: "H2.1",
      notes: "Alias for pass_pick6. Both keys evaluate identically once the derived pass_pick6 canonical stat is present." }),

  // ─── Rushing ───────────────────────────────────────────────────────────────
  entry("rush_yd", "Rushing yards", "rushing", "rushing", OFF, IMPL_VER, NW_VER,
    { normalizedFrom: "rushing_yards", implementationPhase: "H1" }),
  entry("rush_att", "Rushing attempts (carries)", "rushing", "rushing", OFF, IMPL_VER, NW_VER,
    { normalizedFrom: "carries", implementationPhase: "H1" }),
  entry("rush_td", "Rushing touchdowns", "rushing", "rushing", OFF, IMPL_VER, NW_VER,
    { normalizedFrom: "rushing_tds", implementationPhase: "H1" }),
  entry("rush_fd", "Rushing first downs", "rushing", "first_downs", OFF, IMPL_VER, NW_VER,
    { normalizedFrom: "rushing_first_downs", implementationPhase: "H1" }),
  entry("rush_2pt", "Rushing two-point conversions", "rushing", "rushing", OFF, IMPL_VER, NW_VER,
    { normalizedFrom: "rushing_2pt_conversions", implementationPhase: "H1" }),

  // ─── Receiving ─────────────────────────────────────────────────────────────
  entry("rec", "Receptions", "receiving", "receiving", OFF, IMPL_VER, NW_VER,
    { normalizedFrom: "receptions", implementationPhase: "H1" }),
  entry("rec_tgt", "Targets", "receiving", "receiving", OFF, IMPL_VER, NW_VER,
    { normalizedFrom: "targets", implementationPhase: "H1" }),
  entry("rec_yd", "Receiving yards", "receiving", "receiving", OFF, IMPL_VER, NW_VER,
    { normalizedFrom: "receiving_yards", implementationPhase: "H1" }),
  entry("rec_td", "Receiving touchdowns", "receiving", "receiving", OFF, IMPL_VER, NW_VER,
    { normalizedFrom: "receiving_tds", implementationPhase: "H1" }),
  entry("rec_fd", "Receiving first downs", "receiving", "first_downs", OFF, IMPL_VER, NW_VER,
    { normalizedFrom: "receiving_first_downs", implementationPhase: "H1" }),
  entry("rec_2pt", "Receiving two-point conversions", "receiving", "receiving", OFF, IMPL_VER, NW_VER,
    { normalizedFrom: "receiving_2pt_conversions", implementationPhase: "H1" }),

  // ─── Position reception bonuses ────────────────────────────────────────────
  entry("rec_te_bonus", "TE reception bonus (legacy key)", "position_rec_bonuses", "receiving", ["TE"], IMPL_VER, NW_VER,
    { canonicalStatKey: "rec", normalizedFrom: "receptions", implementationPhase: "H1",
      notes: "Legacy Sleeper key; bonus_rec_te is the preferred modern key. Both resolve to the same rec stat for TE." }),
  entry("rec_rb_bonus", "RB reception bonus (legacy key)", "position_rec_bonuses", "receiving", ["RB"], IMPL_VER, NW_VER,
    { canonicalStatKey: "rec", normalizedFrom: "receptions", implementationPhase: "H1",
      notes: "Legacy Sleeper key; bonus_rec_rb is the preferred modern key." }),
  entry("rec_wr_bonus", "WR reception bonus (legacy key)", "position_rec_bonuses", "receiving", ["WR"], IMPL_VER, NW_VER,
    { canonicalStatKey: "rec", normalizedFrom: "receptions", implementationPhase: "H1",
      notes: "Legacy Sleeper key; bonus_rec_wr is the preferred modern key." }),
  entry("bonus_rec_te", "TE reception bonus", "position_rec_bonuses", "receiving", ["TE"], IMPL_VER, NW_VER,
    { canonicalStatKey: "rec", normalizedFrom: "receptions", implementationPhase: "H1" }),
  entry("bonus_rec_rb", "RB reception bonus", "position_rec_bonuses", "receiving", ["RB"], IMPL_VER, NW_VER,
    { canonicalStatKey: "rec", normalizedFrom: "receptions", implementationPhase: "H1" }),
  entry("bonus_rec_wr", "WR reception bonus", "position_rec_bonuses", "receiving", ["WR"], IMPL_VER, NW_VER,
    { canonicalStatKey: "rec", normalizedFrom: "receptions", implementationPhase: "H1" }),

  // ─── Miscellaneous skill ───────────────────────────────────────────────────
  entry("fum_lost", "Fumbles lost", "miscellaneous_skill", "miscellaneous", OFF, IMPL_VER, NW_VER,
    { normalizedFrom: "sack_fumbles_lost+rushing_fumbles_lost+receiving_fumbles_lost",
      implementationPhase: "H1" }),
  entry("fum", "Total fumbles (lost + recovered)", "miscellaneous_skill", "miscellaneous", OFF, IMPL_VER, NW_VER,
    { normalizedFrom: "sack_fumbles+rushing_fumbles+receiving_fumbles",
      implementationPhase: "H4A",
      notes: "Different from fum_lost: counts all fumbles regardless of recovery. Columns exist in nflverse weekly CSV." }),
  entry("fum_ret_td", "Fumble return touchdowns", "miscellaneous_skill", "miscellaneous", OFF, IMPL_VER, PBP_DER,
    { implementationPhase: "H4B",
      notes: "Derived from nflverse PBP only when the recovery player and touchdown scorer match unambiguously in structured fields." }),
  entry("fum_rec", "Offensive fumble recovery", "miscellaneous_skill", "miscellaneous", OFF, NOT_IMPL, "nflverse_pbp_derivable",
    { notes: "Points for an offensive player recovering any fumble; not exposed in nflverse weekly CSV — requires PBP recovery attribution. No engine rule implemented." }),

  // ─── Special teams skill ───────────────────────────────────────────────────
  entry("kick_ret_yd", "Kick return yards", "special_teams_skill", "returns", OFF, IMPL_VER, NW_VER,
    { normalizedFrom: "kickoff_return_yards",
      implementationPhase: "H4A",
      notes: "Return stats exist in nflverse weekly CSV for all players including offensive skill positions." }),
  entry("punt_ret_yd", "Punt return yards", "special_teams_skill", "returns", OFF, IMPL_VER, NW_VER,
    { normalizedFrom: "punt_return_yards",
      implementationPhase: "H4A" }),
  entry("return_td", "Return touchdowns (kick or punt)", "special_teams_skill", "returns", OFF, IMPL_VER, NW_VER,
    { normalizedFrom: "special_teams_tds",
      implementationPhase: "H4A",
      notes: "nflverse weekly exposes a single player-level special_teams_tds total rather than separate kick and punt return touchdown columns." }),
  entry("return_fd", "Return first downs", "special_teams_skill", "first_downs", OFF, IMPL_VER, "requires_new_source",
    { normalizedFrom: null,
      blockers: ["Archived nflverse weekly player stats do not expose a verified return-first-down column; return_fd cannot be activated from the current weekly source."],
      notes: "H4A investigated this key explicitly and left it non-operational rather than inferring it from unrelated fields." }),

  // ─── First-down bonuses ────────────────────────────────────────────────────
  entry("pass_fd", "Passing first downs", "first_down_bonuses", "first_downs", QB, IMPL_VER, NW_VER,
    { normalizedFrom: "passing_first_downs", implementationPhase: "H1" }),
  entry("bonus_fd_qb", "QB first-down bonus (per passing first down)", "first_down_bonuses", "first_downs", QB, IMPL_VER, NW_VER,
    { canonicalStatKey: "pass_fd", normalizedFrom: "passing_first_downs", implementationPhase: "H1",
      notes: "Additive to pass_fd; reads same pass_fd stat but under a different scoring key." }),
  entry("bonus_fd_rb", "RB first-down bonus (per rushing + receiving first down)", "first_down_bonuses", "first_downs", ["RB"], IMPL_VER, NW_VER,
    { derivedStatExpression: "rush_fd + rec_fd",
      normalizedFrom: "rushing_first_downs+receiving_first_downs", implementationPhase: "H1" }),
  entry("bonus_fd_wr", "WR first-down bonus (per receiving first down)", "first_down_bonuses", "first_downs", ["WR"], IMPL_VER, NW_VER,
    { canonicalStatKey: "rec_fd", normalizedFrom: "receiving_first_downs", implementationPhase: "H1" }),
  entry("bonus_fd_te", "TE first-down bonus (per receiving first down)", "first_down_bonuses", "first_downs", ["TE"], IMPL_VER, NW_VER,
    { canonicalStatKey: "rec_fd", normalizedFrom: "receiving_first_downs", implementationPhase: "H1" }),

  // ─── Long-TD bonuses (PBP-derived, H2) ────────────────────────────────────
  entry("rec_td_40p", "Receiving TD of 40+ yards bonus", "long_td_bonuses", "bonuses", OFF, IMPL_VER, PBP_DER,
    { implementationPhase: "H2",
      notes: "Derived from nflverse PBP; stored in player_weekly_derived_stats with stat_scope=nflverse_pbp_derived." }),
  entry("rec_td_50p", "Receiving TD of 50+ yards bonus", "long_td_bonuses", "bonuses", OFF, IMPL_VER, PBP_DER,
    { implementationPhase: "H2",
      notes: "50p is a subset of 40p; leagues use either the lower threshold or both additively." }),
  entry("rush_td_40p", "Rushing TD of 40+ yards bonus", "long_td_bonuses", "bonuses", OFF, IMPL_VER, PBP_DER,
    { implementationPhase: "H2" }),
  entry("rush_td_50p", "Rushing TD of 50+ yards bonus", "long_td_bonuses", "bonuses", OFF, IMPL_VER, PBP_DER,
    { implementationPhase: "H2" }),
  entry("pass_td_40p", "Passing TD of 40+ yards bonus", "long_td_bonuses", "bonuses", QB, NOT_IMPL, "nflverse_pbp_derivable",
    { notes: "PBP-derivable equivalent of rec_td_40p/rush_td_40p for the passer; H2 pipeline not yet extended to passing long TDs. No engine rule implemented." }),
  entry("pass_td_50p", "Passing TD of 50+ yards bonus", "long_td_bonuses", "bonuses", QB, NOT_IMPL, "nflverse_pbp_derivable",
    { notes: "50p is a subset of 40p; engine rule not yet implemented." }),
  entry("pass_cmp_40p", "Passing completion of 40+ yards bonus", "long_td_bonuses", "bonuses", QB, NOT_IMPL, "nflverse_pbp_derivable",
    { notes: "Bonus for a reception that travels 40+ air yards to the passer's credit; requires PBP air-yards data." }),

  // ─── Yardage threshold bonuses ─────────────────────────────────────────────
  entry("bonus_pass_yd_300", "300-399 passing-yard bonus", "yardage_threshold_bonuses", "bonuses", QB, IMPL_VER, NW_VER,
    { canonicalStatKey: "pass_yd", normalizedFrom: "passing_yards", implementationPhase: "H1" }),
  entry("bonus_pass_yd_400", "400+ passing-yard bonus", "yardage_threshold_bonuses", "bonuses", QB, IMPL_VER, NW_VER,
    { canonicalStatKey: "pass_yd", normalizedFrom: "passing_yards", implementationPhase: "H1" }),
  entry("bonus_pass_cmp_25", "25+ completions bonus", "yardage_threshold_bonuses", "bonuses", QB, IMPL_VER, NW_VER,
    { canonicalStatKey: "pass_cmp", normalizedFrom: "completions", implementationPhase: "H1" }),
  entry("bonus_rush_yd_100", "100-199 rushing-yard bonus", "yardage_threshold_bonuses", "bonuses", OFF, IMPL_VER, NW_VER,
    { canonicalStatKey: "rush_yd", normalizedFrom: "rushing_yards", implementationPhase: "H1" }),
  entry("bonus_rush_yd_200", "200+ rushing-yard bonus", "yardage_threshold_bonuses", "bonuses", OFF, IMPL_VER, NW_VER,
    { canonicalStatKey: "rush_yd", normalizedFrom: "rushing_yards", implementationPhase: "H1" }),
  entry("bonus_rush_att_20", "20+ carries bonus", "yardage_threshold_bonuses", "bonuses", OFF, IMPL_VER, NW_VER,
    { canonicalStatKey: "rush_att", normalizedFrom: "carries", implementationPhase: "H1" }),
  entry("bonus_rec_yd_100", "100-199 receiving-yard bonus", "yardage_threshold_bonuses", "bonuses", OFF, IMPL_VER, NW_VER,
    { canonicalStatKey: "rec_yd", normalizedFrom: "receiving_yards", implementationPhase: "H1" }),
  entry("bonus_rec_yd_200", "200+ receiving-yard bonus", "yardage_threshold_bonuses", "bonuses", OFF, IMPL_VER, NW_VER,
    { canonicalStatKey: "rec_yd", normalizedFrom: "receiving_yards", implementationPhase: "H1" }),
  entry("bonus_rush_rec_yd_100", "100-199 combined rush+rec yards bonus", "yardage_threshold_bonuses", "bonuses", OFF, IMPL_VER, NW_VER,
    { derivedStatExpression: "rush_yd + rec_yd",
      normalizedFrom: "rushing_yards+receiving_yards", implementationPhase: "H1" }),
  entry("bonus_rush_rec_yd_200", "200+ combined rush+rec yards bonus", "yardage_threshold_bonuses", "bonuses", OFF, IMPL_VER, NW_VER,
    { derivedStatExpression: "rush_yd + rec_yd",
      normalizedFrom: "rushing_yards+receiving_yards", implementationPhase: "H1" }),

  // ─── Kicking (out of scope — K position) ──────────────────────────────────
  entry("xpm", "Extra points made", "kicking", "kicking", K, IMPL_VER, OOS,
    { blockers: ["K position excluded from current nflverse weekly ingestion scope"],
      notes: "nflverse weekly has kicker stats; data pipeline scope must be extended to K." }),
  entry("xpmiss", "Extra points missed", "kicking", "kicking", K, IMPL_VER, OOS,
    { blockers: ["Same as xpm"] }),
  entry("fgm", "Field goals made", "kicking", "kicking", K, IMPL_VER, OOS,
    { notes: "Overlapping-FG rule: deactivated when distance-band keys are also active to avoid double-counting." }),
  entry("fgmiss", "Field goals missed", "kicking", "kicking", K, IMPL_VER, OOS, {}),
  entry("fgm_0_19", "FG made 0-19 yards", "kicking", "kicking", K, IMPL_VER, OOS, {}),
  entry("fgm_20_29", "FG made 20-29 yards", "kicking", "kicking", K, IMPL_VER, OOS, {}),
  entry("fgm_30_39", "FG made 30-39 yards", "kicking", "kicking", K, IMPL_VER, OOS, {}),
  entry("fgm_40_49", "FG made 40-49 yards", "kicking", "kicking", K, IMPL_VER, OOS, {}),
  entry("fgm_50_59", "FG made 50-59 yards", "kicking", "kicking", K, IMPL_VER, OOS, {}),
  entry("fgm_50p", "FG made 50+ yards", "kicking", "kicking", K, IMPL_VER, OOS,
    { notes: "Overlaps fgm_50_59 and fgm_60p; Sleeper leagues use one or the other." }),
  entry("fgm_60p", "FG made 60+ yards", "kicking", "kicking", K, IMPL_VER, OOS, {}),
  entry("fgmiss_0_19", "FG missed 0-19 yards", "kicking", "kicking", K, IMPL_VER, OOS, {}),
  entry("fgmiss_20_29", "FG missed 20-29 yards", "kicking", "kicking", K, IMPL_VER, OOS, {}),
  entry("fgmiss_30_39", "FG missed 30-39 yards", "kicking", "kicking", K, IMPL_VER, OOS, {}),
  entry("fgmiss_40_49", "FG missed 40-49 yards", "kicking", "kicking", K, IMPL_VER, OOS, {}),
  entry("fgmiss_50p", "FG missed 50+ yards", "kicking", "kicking", K, IMPL_VER, OOS, {}),

  // ─── Team defense — counting stats ────────────────────────────────────────
  entry("sack", "Sacks", "team_defense", "team_defense", DEF_IDP, IMPL_VER, OOS,
    { blockers: ["DEF and IDP positions excluded from current ingestion scope"],
      notes: "Rule handles both DEF and IDP positions with the same key; Sleeper registers one entry per position group." }),
  entry("int", "Interceptions", "team_defense", "team_defense", DEF_IDP, IMPL_VER, OOS,
    { notes: "Same dual-position key as sack." }),
  entry("ff", "Forced fumbles", "team_defense", "team_defense", DEF_IDP, IMPL_VER, OOS, {}),
  entry("fr", "Fumble recoveries", "team_defense", "team_defense", DEF_IDP, IMPL_VER, OOS, {}),
  entry("safe", "Safeties", "team_defense", "team_defense", DEF_IDP, IMPL_VER, OOS, {}),
  entry("blk_kick", "Blocked kicks", "team_defense", "team_defense", DEF_IDP, IMPL_VER, OOS, {}),
  entry("def_td", "Defensive touchdowns", "team_defense", "team_defense", DEF_IDP, IMPL_VER, OOS, {}),
  entry("def_st_td", "Defensive/special-teams touchdowns", "team_defense", "team_defense", DEF_IDP, IMPL_VER, OOS, {}),
  entry("def_st_ff", "Special-teams forced fumble", "team_defense", "team_defense", DEF_IDP, NOT_IMPL, OOS,
    { blockers: ["DEF and IDP positions excluded from current ingestion scope"],
      notes: "Forced fumble credited to a kicking/coverage-unit player; separate from field-player ff. No engine rule implemented." }),
  entry("def_st_fum_rec", "Special-teams fumble recovery", "team_defense", "team_defense", DEF_IDP, NOT_IMPL, OOS,
    { notes: "Fumble recovery credited to a kicking/coverage-unit player; no engine rule implemented." }),
  entry("fum_rec_td", "Fumble recovery touchdown", "team_defense", "team_defense", DEF_IDP, NOT_IMPL, OOS,
    { notes: "Sleeper key for scoring a TD after recovering a fumble; primarily a DEF/IDP key. Offensive equivalent is fum_ret_td." }),
  entry("def_2pt_ret", "Defensive two-point return", "team_defense", "team_defense", DEF, IMPL_VER, OOS, {}),
  entry("fourth_down_stop", "Fourth-down stops", "team_defense", "team_defense", DEF, IMPL_VER, OOS,
    { notes: "Requires play-by-play or team game-log data; not in standard player_stats CSV." }),
  entry("three_and_out", "Three-and-outs forced", "team_defense", "team_defense", DEF, IMPL_VER, OOS,
    { notes: "Requires drive-level team data; not derivable from player stats." }),

  // ─── Team defense — points-allowed tiers ──────────────────────────────────
  entry("pts_allow_0", "Points allowed: shutout (0)", "team_defense", "team_defense", DEF, IMPL_VER, "requires_team_game_context",
    { canonicalStatKey: "pts_allow",
      blockers: ["Requires team-level game aggregate (points allowed per game), not per-player stats"],
      notes: "pts_allow is a team-level stat; needs a separate team game-result ingestion pipeline." }),
  entry("pts_allow_1_6", "Points allowed: 1-6", "team_defense", "team_defense", DEF, IMPL_VER, "requires_team_game_context",
    { canonicalStatKey: "pts_allow" }),
  entry("pts_allow_7_13", "Points allowed: 7-13", "team_defense", "team_defense", DEF, IMPL_VER, "requires_team_game_context",
    { canonicalStatKey: "pts_allow" }),
  entry("pts_allow_14_20", "Points allowed: 14-20", "team_defense", "team_defense", DEF, IMPL_VER, "requires_team_game_context",
    { canonicalStatKey: "pts_allow" }),
  entry("pts_allow_21_27", "Points allowed: 21-27", "team_defense", "team_defense", DEF, IMPL_VER, "requires_team_game_context",
    { canonicalStatKey: "pts_allow" }),
  entry("pts_allow_28_34", "Points allowed: 28-34", "team_defense", "team_defense", DEF, IMPL_VER, "requires_team_game_context",
    { canonicalStatKey: "pts_allow" }),
  entry("pts_allow_35p", "Points allowed: 35+", "team_defense", "team_defense", DEF, IMPL_VER, "requires_team_game_context",
    { canonicalStatKey: "pts_allow" }),

  // ─── Team defense — yards-allowed tiers ───────────────────────────────────
  entry("yds_allow_0_100", "Yards allowed: 0-100", "team_defense", "team_defense", DEF, IMPL_VER, "requires_team_game_context",
    { canonicalStatKey: "yds_allow",
      notes: "yds_allow is a team-level stat; needs team game-result ingestion pipeline." }),
  entry("yds_allow_101_199", "Yards allowed: 101-199", "team_defense", "team_defense", DEF, IMPL_VER, "requires_team_game_context",
    { canonicalStatKey: "yds_allow" }),
  entry("yds_allow_200_299", "Yards allowed: 200-299", "team_defense", "team_defense", DEF, IMPL_VER, "requires_team_game_context",
    { canonicalStatKey: "yds_allow" }),
  entry("yds_allow_300_349", "Yards allowed: 300-349", "team_defense", "team_defense", DEF, IMPL_VER, "requires_team_game_context",
    { canonicalStatKey: "yds_allow" }),
  entry("yds_allow_350_399", "Yards allowed: 350-399", "team_defense", "team_defense", DEF, IMPL_VER, "requires_team_game_context",
    { canonicalStatKey: "yds_allow" }),
  entry("yds_allow_400_449", "Yards allowed: 400-449", "team_defense", "team_defense", DEF, IMPL_VER, "requires_team_game_context",
    { canonicalStatKey: "yds_allow" }),
  entry("yds_allow_450_499", "Yards allowed: 450-499", "team_defense", "team_defense", DEF, IMPL_VER, "requires_team_game_context",
    { canonicalStatKey: "yds_allow" }),
  entry("yds_allow_500_549", "Yards allowed: 500-549", "team_defense", "team_defense", DEF, IMPL_VER, "requires_team_game_context",
    { canonicalStatKey: "yds_allow" }),
  entry("yds_allow_550p", "Yards allowed: 550+", "team_defense", "team_defense", DEF, IMPL_VER, "requires_team_game_context",
    { canonicalStatKey: "yds_allow" }),

  // ─── IDP — tackle family ───────────────────────────────────────────────────
  entry("solo_tkl", "Solo tackles", "idp", "idp", IDP, IMPL_VER, OOS,
    { blockers: ["IDP position group excluded from current nflverse weekly ingestion scope"],
      notes: "nflverse has defensive player stats via a separate endpoint/CSV; not yet wired." }),
  entry("ast_tkl", "Assisted tackles", "idp", "idp", IDP, IMPL_VER, OOS, {}),
  entry("tkl", "Total tackles", "idp", "idp", IDP, IMPL_VER, OOS, {}),
  entry("tkl_loss", "Tackles for loss", "idp", "idp", IDP, IMPL_VER, OOS, {}),
  entry("st_tkl", "Special-teams tackles", "idp", "idp", IDP, IMPL_VER, OOS, {}),

  // ─── IDP — pass-rush / coverage ───────────────────────────────────────────
  entry("qb_hit", "QB hits", "idp", "idp", IDP, IMPL_VER, OOS, {}),
  entry("pd", "Passes defended", "idp", "idp", IDP, IMPL_VER, OOS, {}),
  entry("int_ret_yd", "Interception return yards", "idp", "idp", IDP, IMPL_VER, OOS, {}),

  // ─── IDP — turnover / big plays ───────────────────────────────────────────
  entry("fr_ret_yd", "Fumble return yards", "idp", "idp", IDP, IMPL_VER, OOS, {}),

  // ─── Team defense / IDP — big-play bonuses ────────────────────────────────
  entry("bonus_def_fum_td_50p", "Defensive fumble-return TD 50+ yards bonus", "team_defense", "team_defense", DEF_IDP, NOT_IMPL, OOS,
    { blockers: ["DEF and IDP positions excluded from current ingestion scope"],
      notes: "Bonus for a defensive fumble return touchdown of 50+ yards; no engine rule implemented." }),
  entry("bonus_def_int_td_50p", "Defensive INT-return TD 50+ yards bonus", "team_defense", "team_defense", DEF_IDP, NOT_IMPL, OOS,
    { notes: "Bonus for an interception return touchdown of 50+ yards; no engine rule implemented." }),
  entry("bonus_sack_2p", "2+ sack game bonus (IDP)", "idp", "idp", IDP, NOT_IMPL, OOS,
    { notes: "Bonus points for recording 2 or more sacks in a single game; no engine rule implemented." })
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export const REGISTRY_BY_KEY = new Map<string, ScoringCoverageRecord>(
  SCORING_COVERAGE_REGISTRY.map((record) => [record.key, record])
);

/** Keys that are fully operational: engine verified + nflverse weekly stat available + live tested. */
export const OPERATIONAL_KEYS = SCORING_COVERAGE_REGISTRY
  .filter((r) => r.engineStatus === "implemented_verified" &&
    (r.dataStatus === "nflverse_weekly_verified" || r.dataStatus === "nflverse_pbp_derived"))
  .map((r) => r.key);

/** Keys with engine rules but stat data not available from any active pipeline. */
export const DATA_GAP_KEYS = SCORING_COVERAGE_REGISTRY
  .filter((r) => r.engineStatus !== "not_implemented" &&
    r.dataStatus !== "nflverse_weekly_verified" &&
    r.dataStatus !== "nflverse_pbp_derived" &&
    r.dataStatus !== "out_of_scope")
  .map((r) => r.key);

/** Keys explicitly excluded from current phase (K, DEF, IDP). */
export const OUT_OF_SCOPE_KEYS = SCORING_COVERAGE_REGISTRY
  .filter((r) => r.dataStatus === "out_of_scope")
  .map((r) => r.key);

/** PBP-derived keys (H2 pipeline). */
export const PBP_DERIVED_KEYS = SCORING_COVERAGE_REGISTRY
  .filter((r) => r.dataStatus === "nflverse_pbp_derived")
  .map((r) => r.key);

/** Keys that are PBP-derivable but pipeline not yet built. */
export const PBP_DERIVABLE_KEYS = SCORING_COVERAGE_REGISTRY
  .filter((r) => r.dataStatus === "nflverse_pbp_derivable")
  .map((r) => r.key);

/** Requires team game-level context (pts_allow_*, yds_allow_*). */
export const TEAM_CONTEXT_KEYS = SCORING_COVERAGE_REGISTRY
  .filter((r) => r.dataStatus === "requires_team_game_context")
  .map((r) => r.key);
