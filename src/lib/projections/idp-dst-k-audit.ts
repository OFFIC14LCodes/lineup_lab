import { buildNormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import { REGISTRY_BY_KEY } from "@/lib/scoring/coverage/registry";

export type ProjectionCategory = "idp" | "dst" | "kicker" | "return";

export type ProjectabilityClassification =
  | "PROJECTABLE_NOW"
  | "PROJECTABLE_APPROXIMATION"
  | "KNOWN_ZERO_OR_NOT_APPLICABLE"
  | "EXCLUDED_FROM_POSITION_MODEL"
  | "UNSUPPORTED_NEEDS_DATA"
  | "UNSUPPORTED_DO_NOT_PROJECT";

export type LeagueRosterAuditInput = {
  leagueId: string;
  leagueName: string;
  season: number;
  rosterPositions: string[];
  scoringSettings: Record<string, unknown>;
};

export type LeagueRosterAudit = {
  league_id: string;
  league_name: string;
  season: number;
  uses_idp: boolean;
  uses_dst: boolean;
  uses_kicker: boolean;
  uses_return_scoring: boolean;
  idp_slots: number;
  dst_slots: number;
  k_slots: number;
  return_relevant: boolean;
  war_room_required: boolean;
  starter_slots_by_position: Record<string, number>;
  total_required_starters: number;
};

export type DataPresence = {
  hasIdpWeeklyRows: boolean;
  hasDstWeeklyRows: boolean;
  hasKickerWeeklyRows: boolean;
  hasTeamGameRows: boolean;
  hasField: (field: string) => boolean;
  hasTeamField: (field: string) => boolean;
};

export const IDP_SCORING_KEYS = [
  "solo_tkl",
  "ast_tkl",
  "tkl",
  "tkl_loss",
  "st_tkl",
  "sack",
  "qb_hit",
  "int",
  "int_ret_yd",
  "pd",
  "ff",
  "fr",
  "fr_ret_yd",
  "safe",
  "blk_kick",
  "def_td",
  "def_st_td",
  "bonus_sack_2p",
  "idp_tkl_solo",
  "idp_tkl_ast",
  "idp_tkl",
  "idp_tkl_loss",
  "idp_st_tkl",
  "idp_sack",
  "idp_qb_hit",
  "idp_int",
  "idp_int_ret_yd",
  "idp_pass_def",
  "idp_ff",
  "idp_fum_rec",
  "idp_fum_ret_yd",
  "idp_safe",
  "idp_blk_kick",
  "idp_def_td",
  "idp_def_st_td",
] as const;

export const DST_SCORING_KEYS = [
  "sack",
  "int",
  "ff",
  "fr",
  "safe",
  "blk_kick",
  "def_td",
  "def_st_td",
  "def_2pt_ret",
  "fourth_down_stop",
  "three_and_out",
  "pts_allow_0",
  "pts_allow_1_6",
  "pts_allow_7_13",
  "pts_allow_14_20",
  "pts_allow_21_27",
  "pts_allow_28_34",
  "pts_allow_35p",
  "yds_allow_0_100",
  "yds_allow_101_199",
  "yds_allow_200_299",
  "yds_allow_300_349",
  "yds_allow_350_399",
  "yds_allow_400_449",
  "yds_allow_450_499",
  "yds_allow_500_549",
  "yds_allow_550p",
] as const;

export const KICKER_SCORING_KEYS = [
  "xpm",
  "xpmiss",
  "fgm",
  "fgmiss",
  "fgm_0_19",
  "fgm_20_29",
  "fgm_30_39",
  "fgm_40_49",
  "fgm_50_59",
  "fgm_50p",
  "fgm_60p",
  "fgmiss_0_19",
  "fgmiss_20_29",
  "fgmiss_30_39",
  "fgmiss_40_49",
  "fgmiss_50p",
] as const;

export const RETURN_SCORING_KEYS = [
  "kick_ret_yd",
  "punt_ret_yd",
  "return_td",
  "return_fd",
] as const;

const KEY_ALIASES: Record<string, string[]> = {
  solo_tkl: ["solo_tkl", "solo_tackles", "def_solo_tackles"],
  ast_tkl: ["ast_tkl", "assisted_tackles", "def_assisted_tackles"],
  tkl: ["tkl", "tackles", "total_tackles"],
  tkl_loss: ["tkl_loss", "tackles_for_loss", "tfl"],
  st_tkl: ["st_tkl", "special_teams_tackles"],
  sack: ["sack", "sacks"],
  qb_hit: ["qb_hit", "qb_hits"],
  int: ["int", "interceptions"],
  int_ret_yd: ["int_ret_yd", "interception_return_yards"],
  pd: ["pd", "passes_defended", "pass_defended"],
  ff: ["ff", "forced_fumbles"],
  fr: ["fr", "fumble_recoveries"],
  fr_ret_yd: ["fr_ret_yd", "fumble_recovery_yards"],
  safe: ["safe", "safeties"],
  blk_kick: ["blk_kick", "blocked_kicks"],
  def_td: ["def_td", "defensive_tds", "defensive_touchdowns"],
  def_st_td: ["def_st_td", "special_teams_tds"],
  def_2pt_ret: ["def_2pt_ret"],
  xpm: ["xpm", "xp_made", "extra_points_made"],
  xpmiss: ["xpmiss", "xp_missed", "extra_points_missed"],
  fgm: ["fgm", "fg_made", "field_goals_made"],
  fgmiss: ["fgmiss", "fg_missed", "field_goals_missed"],
  fgm_0_19: ["fgm_0_19", "fg_made_0_19"],
  fgm_20_29: ["fgm_20_29", "fg_made_20_29"],
  fgm_30_39: ["fgm_30_39", "fg_made_30_39"],
  fgm_40_49: ["fgm_40_49", "fg_made_40_49"],
  fgm_50_59: ["fgm_50_59", "fg_made_50_59"],
  fgm_50p: ["fgm_50p", "fg_made_50_plus", "fg_made_50p"],
  fgm_60p: ["fgm_60p", "fg_made_60_plus"],
  fgmiss_0_19: ["fgmiss_0_19", "fg_missed_0_19"],
  fgmiss_20_29: ["fgmiss_20_29", "fg_missed_20_29"],
  fgmiss_30_39: ["fgmiss_30_39", "fg_missed_30_39"],
  fgmiss_40_49: ["fgmiss_40_49", "fg_missed_40_49"],
  fgmiss_50p: ["fgmiss_50p", "fg_missed_50_plus", "fg_missed_50p"],
  kick_ret_yd: ["kick_ret_yd", "kickoff_return_yards", "kick_return_yards"],
  punt_ret_yd: ["punt_ret_yd", "punt_return_yards"],
  return_td: ["return_td", "special_teams_tds", "return_tds"],
  pts_allow: ["points_allowed", "pts_allow"],
  yds_allow: ["yards_allowed", "yds_allow"],
};

function activeScoringKeys(settings: Record<string, unknown>): string[] {
  return Object.entries(settings)
    .filter(([, value]) => Number(value) !== 0)
    .map(([key]) => key)
    .sort();
}

export function auditLeagueRoster(input: LeagueRosterAuditInput): LeagueRosterAudit {
  const requirements = buildNormalizedRosterRequirements(input.rosterPositions);
  const activeKeys = new Set(activeScoringKeys(input.scoringSettings));
  const usesReturnScoring = RETURN_SCORING_KEYS.some((key) => activeKeys.has(key));
  const idpSlots =
    requirements.directStarters.DL +
    requirements.directStarters.LB +
    requirements.directStarters.DB +
    requirements.idpFlexCount;
  const totalRequiredStarters =
    Object.values(requirements.directStarters).reduce((sum, count) => sum + count, 0) +
    requirements.offensiveFlexCount +
    requirements.superflexCount +
    requirements.idpFlexCount;

  return {
    league_id: input.leagueId,
    league_name: input.leagueName,
    season: input.season,
    uses_idp: requirements.hasIDP,
    uses_dst: requirements.hasTeamDefense,
    uses_kicker: requirements.hasKicker,
    uses_return_scoring: usesReturnScoring,
    idp_slots: idpSlots,
    dst_slots: requirements.directStarters.DEF,
    k_slots: requirements.directStarters.K,
    return_relevant: usesReturnScoring,
    war_room_required: requirements.hasIDP || requirements.hasTeamDefense || requirements.hasKicker || usesReturnScoring,
    starter_slots_by_position: {
      ...requirements.directStarters,
      OFFENSIVE_FLEX: requirements.offensiveFlexCount,
      SUPERFLEX: requirements.superflexCount,
      IDP_FLEX: requirements.idpFlexCount,
    },
    total_required_starters: totalRequiredStarters,
  };
}

function aliasesFor(key: string): string[] {
  if (key.startsWith("pts_allow_")) return KEY_ALIASES.pts_allow;
  if (key.startsWith("yds_allow_")) return KEY_ALIASES.yds_allow;
  return KEY_ALIASES[key] ?? [key];
}

function hasAnyField(data: DataPresence, key: string): boolean {
  return aliasesFor(key).some((field) => data.hasField(field));
}

function hasAnyTeamField(data: DataPresence, key: string): boolean {
  return aliasesFor(key).some((field) => data.hasTeamField(field));
}

export function classifyScoringKeyProjectability(
  key: string,
  category: ProjectionCategory,
  data: DataPresence
): ProjectabilityClassification {
  const registry = REGISTRY_BY_KEY.get(key);
  if (!registry) return "UNSUPPORTED_NEEDS_DATA";

  if (category === "return") {
    if (key === "return_fd") return "UNSUPPORTED_NEEDS_DATA";
    return hasAnyField(data, key) ? "PROJECTABLE_APPROXIMATION" : "UNSUPPORTED_NEEDS_DATA";
  }

  if (category === "kicker") {
    if (!data.hasKickerWeeklyRows) return "UNSUPPORTED_NEEDS_DATA";
    return hasAnyField(data, key) ? "PROJECTABLE_NOW" : "UNSUPPORTED_NEEDS_DATA";
  }

  if (category === "idp") {
    if (!data.hasIdpWeeklyRows) return "UNSUPPORTED_NEEDS_DATA";
    if (key.startsWith("bonus_")) return hasAnyField(data, "sack") ? "PROJECTABLE_APPROXIMATION" : "UNSUPPORTED_NEEDS_DATA";
    return hasAnyField(data, key) ? "PROJECTABLE_NOW" : "UNSUPPORTED_NEEDS_DATA";
  }

  if (category === "dst") {
    if (key === "fourth_down_stop" || key === "three_and_out") return "UNSUPPORTED_NEEDS_DATA";
    if (key.startsWith("pts_allow_") || key.startsWith("yds_allow_")) {
      return data.hasTeamGameRows && hasAnyTeamField(data, key) ? "PROJECTABLE_NOW" : "UNSUPPORTED_NEEDS_DATA";
    }
    return data.hasDstWeeklyRows && hasAnyField(data, key) ? "PROJECTABLE_NOW" : "UNSUPPORTED_NEEDS_DATA";
  }

  return "UNSUPPORTED_DO_NOT_PROJECT";
}

export function scoringKeyCategory(key: string): ProjectionCategory | null {
  const record = REGISTRY_BY_KEY.get(key);
  if (!record) {
    if (RETURN_SCORING_KEYS.includes(key as never)) return "return";
    return null;
  }
  if (record.family === "idp") return "idp";
  if (record.family === "kicking") return "kicker";
  if (record.family === "team_defense") return "dst";
  if (record.family === "special_teams_skill") return "return";
  return null;
}

export function relevantScoringKeys(settings: Record<string, unknown>): string[] {
  return activeScoringKeys(settings).filter((key) => scoringKeyCategory(key) !== null);
}
