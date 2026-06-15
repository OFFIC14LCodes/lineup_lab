import type {
  FantasyScoringComponent,
  PositionGroup,
  ScoringKeyDefinition,
  ScoringRuleContext,
  SleeperScoringRule
} from "@/lib/scoring/types";
import { getKnownScoringKeyDefinition } from "@/lib/scoring/key-definitions";

const OFFENSE: PositionGroup[] = ["QB", "RB", "WR", "TE"];
const KICKER: PositionGroup[] = ["K"];
const TEAM_DEFENSE: PositionGroup[] = ["DEF"];
const IDP: PositionGroup[] = ["DL", "LB", "DB"];

const FIELD_GOAL_BAND_KEYS = ["fgm_0_19", "fgm_20_29", "fgm_30_39", "fgm_40_49", "fgm_50_59", "fgm_50p", "fgm_60p"];

export const SLEEPER_SCORING_RULES: SleeperScoringRule[] = [
  statRule("pass_yd", "pass_yd", "passing", "Passing yards", ["QB"]),
  statRule("pass_td", "pass_td", "passing", "Passing touchdowns", ["QB"]),
  statRule("pass_int", "pass_int", "passing", "Interceptions thrown", ["QB"]),
  statRule("pass_cmp", "pass_cmp", "passing", "Passing completions", ["QB"]),
  statRule("pass_inc", "pass_inc", "passing", "Passing incompletions", ["QB"]),
  statRule("pass_att", "pass_att", "passing", "Passing attempts", ["QB"]),
  statRule("pass_sack", "pass_sack", "passing", "Sacks taken", ["QB"]),
  statRule("pass_2pt", "pass_2pt", "passing", "Passing two-point conversions", ["QB"]),
  statRule("pass_fd", "pass_fd", "first_downs", "Passing first downs", ["QB"]),
  statRule("pass_pick6", "pass_pick6", "passing", "Pick-sixes thrown", ["QB"]),
  statRule("pass_int_td", "pass_pick6", "passing", "Interception returned for touchdown (pick-six thrown)", ["QB"]),
  statRule("pass_td_40p", "pass_td_40p", "bonuses", "Passing TD of 40+ yards bonus", ["QB"]),
  statRule("pass_td_50p", "pass_td_50p", "bonuses", "Passing TD of 50+ yards bonus", ["QB"]),
  statRule("pass_cmp_40p", "pass_cmp_40p", "bonuses", "Passing completion of 40+ yards bonus", ["QB"]),
  statRule("rush_yd", "rush_yd", "rushing", "Rushing yards", OFFENSE),
  statRule("rush_td", "rush_td", "rushing", "Rushing touchdowns", OFFENSE),
  statRule("rush_att", "rush_att", "rushing", "Rushing attempts", OFFENSE),
  statRule("rush_2pt", "rush_2pt", "rushing", "Rushing two-point conversions", OFFENSE),
  statRule("rush_fd", "rush_fd", "first_downs", "Rushing first downs", OFFENSE),
  statRule("rec", "rec", "receiving", "Receptions", OFFENSE),
  statRule("rec_yd", "rec_yd", "receiving", "Receiving yards", OFFENSE),
  statRule("rec_td", "rec_td", "receiving", "Receiving touchdowns", OFFENSE),
  statRule("rec_tgt", "rec_tgt", "receiving", "Targets", OFFENSE),
  statRule("rec_2pt", "rec_2pt", "receiving", "Receiving two-point conversions", OFFENSE),
  statRule("rec_fd", "rec_fd", "first_downs", "Receiving first downs", OFFENSE),
  statRule("rec_te_bonus", "rec", "receiving", "Tight end reception bonus", ["TE"]),
  statRule("rec_rb_bonus", "rec", "receiving", "Running back reception bonus", ["RB"]),
  statRule("rec_wr_bonus", "rec", "receiving", "Wide receiver reception bonus", ["WR"]),
  statRule("bonus_rec_te", "rec", "receiving", "Tight end reception bonus", ["TE"]),
  statRule("bonus_rec_rb", "rec", "receiving", "Running back reception bonus", ["RB"]),
  statRule("bonus_rec_wr", "rec", "receiving", "Wide receiver reception bonus", ["WR"]),
  statRule("fum", "fum", "miscellaneous", "Fumbles", OFFENSE),
  statRule("fum_lost", "fum_lost", "miscellaneous", "Fumbles lost", OFFENSE),
  statRule("fum_rec", "fum_rec", "miscellaneous", "Offensive fumble recoveries", OFFENSE),
  statRule("fum_rec_td", "fum_rec_td", "miscellaneous", "Offensive fumble recovery touchdowns", OFFENSE),
  statRule("fum_ret_td", "fum_ret_td", "miscellaneous", "Fumble return touchdowns", OFFENSE),
  statRule("kick_ret_yd", "kick_ret_yd", "returns", "Kick return yards", OFFENSE),
  statRule("punt_ret_yd", "punt_ret_yd", "returns", "Punt return yards", OFFENSE),
  statRule("return_td", "return_td", "returns", "Return touchdowns", OFFENSE),
  statRule("return_fd", "return_fd", "first_downs", "Return first downs", OFFENSE),
  // Position-specific first-down bonuses — additive to any generic first-down keys active in the league.
  // bonus_fd_qb: per passing first down (same underlying stat as pass_fd, different scoring key)
  statRule("bonus_fd_qb", "pass_fd", "first_downs", "Quarterback first-down bonus (per passing first down)", ["QB"]),
  // bonus_fd_rb: per combined rushing + receiving first down (rush_fd + rec_fd)
  combinedPerUnitStatRule("bonus_fd_rb", ["rush_fd", "rec_fd"], "first_downs", "Running back first-down bonus (per rushing or receiving first down)", ["RB"]),
  // bonus_fd_wr: per receiving first down (same underlying stat as rec_fd, different scoring key)
  statRule("bonus_fd_wr", "rec_fd", "first_downs", "Wide receiver first-down bonus (per receiving first down)", ["WR"]),
  // bonus_fd_te: per receiving first down (same underlying stat as rec_fd, different scoring key)
  statRule("bonus_fd_te", "rec_fd", "first_downs", "Tight end first-down bonus (per receiving first down)", ["TE"]),
  // Long-TD bonuses — stat values come from player_weekly_derived_stats (nflverse PBP derivation).
  statRule("rec_td_40p", "rec_td_40p", "bonuses", "Receiving TD of 40+ yards bonus", OFFENSE),
  statRule("rec_td_50p", "rec_td_50p", "bonuses", "Receiving TD of 50+ yards bonus", OFFENSE),
  statRule("rec_20_29", "rec_20_29", "bonuses", "Reception of 20-29 yards bonus", OFFENSE),
  statRule("rec_30_39", "rec_30_39", "bonuses", "Reception of 30-39 yards bonus", OFFENSE),
  statRule("rec_40p", "rec_40p", "bonuses", "Reception of 40+ yards bonus", OFFENSE),
  statRule("rush_td_40p", "rush_td_40p", "bonuses", "Rushing TD of 40+ yards bonus", OFFENSE),
  statRule("rush_td_50p", "rush_td_50p", "bonuses", "Rushing TD of 50+ yards bonus", OFFENSE),
  statRule("rush_40p", "rush_40p", "bonuses", "Rush of 40+ yards bonus", OFFENSE),
  thresholdRangeRule("bonus_pass_yd_300", "pass_yd", 300, 400, "bonuses", "300-399 passing-yard bonus", ["QB"]),
  thresholdRule("bonus_pass_yd_400", "pass_yd", 400, "bonuses", "400+ passing-yard bonus", ["QB"]),
  thresholdRule("bonus_pass_cmp_25", "pass_cmp", 25, "bonuses", "25+ pass completions bonus", ["QB"]),
  thresholdRangeRule("bonus_rush_yd_100", "rush_yd", 100, 200, "bonuses", "100-199 rushing-yard bonus", OFFENSE),
  thresholdRule("bonus_rush_yd_200", "rush_yd", 200, "bonuses", "200+ rushing-yard bonus", OFFENSE),
  thresholdRule("bonus_rush_att_20", "rush_att", 20, "bonuses", "20+ carries bonus", OFFENSE),
  thresholdRangeRule("bonus_rec_yd_100", "rec_yd", 100, 200, "bonuses", "100-199 receiving-yard bonus", OFFENSE),
  thresholdRule("bonus_rec_yd_200", "rec_yd", 200, "bonuses", "200+ receiving-yard bonus", OFFENSE),
  combinedThresholdRangeRule(
    "bonus_rush_rec_yd_100",
    ["rush_yd", "rec_yd"],
    100,
    200,
    "bonuses",
    "100-199 combined rush + rec yards bonus",
    OFFENSE
  ),
  combinedThresholdRule(
    "bonus_rush_rec_yd_200",
    ["rush_yd", "rec_yd"],
    200,
    "bonuses",
    "200+ combined rush + rec yards bonus",
    OFFENSE
  ),
  statRule("xpm", "xpm", "kicking", "Extra points made", KICKER),
  statRule("xpmiss", "xpmiss", "kicking", "Extra points missed", KICKER),
  overlappingFieldGoalRule("fgm", "fgm", "kicking", "Field goals made"),
  statRule("fgmiss", "fgmiss", "kicking", "Field goals missed", KICKER),
  statRule("fgm_0_19", "fgm_0_19", "kicking", "Field goals made from 0-19 yards", KICKER),
  statRule("fgm_20_29", "fgm_20_29", "kicking", "Field goals made from 20-29 yards", KICKER),
  statRule("fgm_30_39", "fgm_30_39", "kicking", "Field goals made from 30-39 yards", KICKER),
  statRule("fgm_40_49", "fgm_40_49", "kicking", "Field goals made from 40-49 yards", KICKER),
  statRule("fgm_50_59", "fgm_50_59", "kicking", "Field goals made from 50-59 yards", KICKER),
  statRule("fgm_50p", "fgm_50p", "kicking", "Field goals made from 50+ yards", KICKER),
  statRule("fgm_60p", "fgm_60p", "kicking", "Field goals made from 60+ yards", KICKER),
  statRule("fgmiss_0_19", "fgmiss_0_19", "kicking", "Field goals missed from 0-19 yards", KICKER),
  statRule("fgmiss_20_29", "fgmiss_20_29", "kicking", "Field goals missed from 20-29 yards", KICKER),
  statRule("fgmiss_30_39", "fgmiss_30_39", "kicking", "Field goals missed from 30-39 yards", KICKER),
  statRule("fgmiss_40_49", "fgmiss_40_49", "kicking", "Field goals missed from 40-49 yards", KICKER),
  statRule("fgmiss_50p", "fgmiss_50p", "kicking", "Field goals missed from 50+ yards", KICKER),
  statRule("sack", "sack", "team_defense", "Sacks", TEAM_DEFENSE),
  statRule("int", "int", "team_defense", "Interceptions", TEAM_DEFENSE),
  statRule("ff", "ff", "team_defense", "Forced fumbles", TEAM_DEFENSE),
  statRule("fr", "fr", "team_defense", "Fumble recoveries", TEAM_DEFENSE),
  statRule("safe", "safe", "team_defense", "Safeties", TEAM_DEFENSE),
  statRule("blk_kick", "blk_kick", "team_defense", "Blocked kicks", TEAM_DEFENSE),
  statRule("def_td", "def_td", "team_defense", "Defensive touchdowns", TEAM_DEFENSE),
  statRule("def_st_td", "def_st_td", "team_defense", "Special-teams touchdowns", TEAM_DEFENSE),
  statRule("def_2pt_ret", "def_2pt_ret", "team_defense", "Two-point returns", TEAM_DEFENSE),
  statRule("fourth_down_stop", "fourth_down_stop", "team_defense", "Fourth-down stops", TEAM_DEFENSE),
  statRule("three_and_out", "three_and_out", "team_defense", "Three-and-outs", TEAM_DEFENSE),
  tierRule("pts_allow_0", "pts_allow", 0, 0, "team_defense", "Shutout points-allowed tier", TEAM_DEFENSE),
  tierRule("pts_allow_1_6", "pts_allow", 1, 6, "team_defense", "1-6 points-allowed tier", TEAM_DEFENSE),
  tierRule("pts_allow_7_13", "pts_allow", 7, 13, "team_defense", "7-13 points-allowed tier", TEAM_DEFENSE),
  tierRule("pts_allow_14_20", "pts_allow", 14, 20, "team_defense", "14-20 points-allowed tier", TEAM_DEFENSE),
  tierRule("pts_allow_21_27", "pts_allow", 21, 27, "team_defense", "21-27 points-allowed tier", TEAM_DEFENSE),
  tierRule("pts_allow_28_34", "pts_allow", 28, 34, "team_defense", "28-34 points-allowed tier", TEAM_DEFENSE),
  tierRule("pts_allow_35p", "pts_allow", 35, Number.POSITIVE_INFINITY, "team_defense", "35+ points-allowed tier", TEAM_DEFENSE),
  tierRule("yds_allow_0_100", "yds_allow", 0, 100, "team_defense", "0-100 yards-allowed tier", TEAM_DEFENSE),
  tierRule("yds_allow_101_199", "yds_allow", 101, 199, "team_defense", "101-199 yards-allowed tier", TEAM_DEFENSE),
  tierRule("yds_allow_200_299", "yds_allow", 200, 299, "team_defense", "200-299 yards-allowed tier", TEAM_DEFENSE),
  tierRule("yds_allow_300_349", "yds_allow", 300, 349, "team_defense", "300-349 yards-allowed tier", TEAM_DEFENSE),
  tierRule("yds_allow_350_399", "yds_allow", 350, 399, "team_defense", "350-399 yards-allowed tier", TEAM_DEFENSE),
  tierRule("yds_allow_400_449", "yds_allow", 400, 449, "team_defense", "400-449 yards-allowed tier", TEAM_DEFENSE),
  tierRule("yds_allow_450_499", "yds_allow", 450, 499, "team_defense", "450-499 yards-allowed tier", TEAM_DEFENSE),
  tierRule("yds_allow_500_549", "yds_allow", 500, 549, "team_defense", "500-549 yards-allowed tier", TEAM_DEFENSE),
  tierRule("yds_allow_550p", "yds_allow", 550, Number.POSITIVE_INFINITY, "team_defense", "550+ yards-allowed tier", TEAM_DEFENSE),
  statRule("solo_tkl", "solo_tkl", "idp", "Solo tackles", IDP),
  statRule("ast_tkl", "ast_tkl", "idp", "Assisted tackles", IDP),
  statRule("tkl", "tkl", "idp", "Total tackles", IDP),
  statRule("tkl_loss", "tkl_loss", "idp", "Tackles for loss", IDP),
  statRule("sack", "sack", "idp", "Sacks", IDP),
  statRule("qb_hit", "qb_hit", "idp", "Quarterback hits", IDP),
  statRule("int", "int", "idp", "Interceptions", IDP),
  statRule("int_ret_yd", "int_ret_yd", "idp", "Interception return yards", IDP),
  statRule("pd", "pd", "idp", "Passes defended", IDP),
  statRule("ff", "ff", "idp", "Forced fumbles", IDP),
  statRule("fr", "fr", "idp", "Fumble recoveries", IDP),
  statRule("fr_ret_yd", "fr_ret_yd", "idp", "Fumble return yards", IDP),
  statRule("safe", "safe", "idp", "Safeties", IDP),
  statRule("blk_kick", "blk_kick", "idp", "Blocked kicks", IDP),
  statRule("def_td", "def_td", "idp", "Defensive touchdowns", IDP),
  statRule("def_st_td", "def_st_td", "idp", "Special-teams touchdowns", IDP),
  statRule("st_tkl", "st_tkl", "idp", "Special-teams tackles", IDP),
  statRule("bonus_sack_2p", "bonus_sack_2p", "idp", "Projected 2+ sack game bonus approximation", IDP)
];

export const SLEEPER_RULES_BY_KEY = new Map<string, SleeperScoringRule[]>();
for (const rule of SLEEPER_SCORING_RULES) {
  const existing = SLEEPER_RULES_BY_KEY.get(rule.scoringKey) ?? [];
  existing.push(rule);
  SLEEPER_RULES_BY_KEY.set(rule.scoringKey, existing);
}

export function getScoringKeyDefinition(scoringKey: string): ScoringKeyDefinition | null {
  const knownDefinition = getKnownScoringKeyDefinition(scoringKey);
  if (knownDefinition) {
    return knownDefinition;
  }

  const rules = SLEEPER_RULES_BY_KEY.get(scoringKey) ?? [];
  if (rules.length === 0) {
    return null;
  }

  return {
    scoringKey,
    category: rules[0].category,
    description: rules[0].description,
    allowedPositions: mergeAllowedPositions(rules),
    requiredStats: [...new Set(rules.flatMap((rule) => rule.requiredStats))].sort(),
    implementationStatus: "implemented"
  };
}

function statRule(
  scoringKey: string,
  canonicalStatKey: string,
  category: FantasyScoringComponent["category"],
  description: string,
  allowedPositions?: PositionGroup[]
): SleeperScoringRule {
  return {
    scoringKey,
    category,
    description,
    allowedPositions,
    requiredStats: [canonicalStatKey],
    evaluate(context) {
      if (!isApplicable(context, allowedPositions)) {
        return {
          state: "not_applicable",
          requiredStats: [canonicalStatKey]
        };
      }

      const resolved = context.getStat(canonicalStatKey);
      if (resolved.statValue === null || !resolved.statKey) {
        return {
          state: "missing_stat",
          requiredStats: [canonicalStatKey]
        };
      }

      return {
        state: "evaluated",
        requiredStats: [canonicalStatKey],
        components: [
          component({
            scoringKey,
            statKey: resolved.statKey,
            statValue: resolved.statValue,
            scoringValue: context.scoringValue,
            category,
            description
          })
        ]
      };
    }
  };
}

function thresholdRule(
  scoringKey: string,
  canonicalStatKey: string,
  threshold: number,
  category: FantasyScoringComponent["category"],
  description: string,
  allowedPositions?: PositionGroup[]
): SleeperScoringRule {
  return {
    scoringKey,
    category,
    description,
    allowedPositions,
    requiredStats: [canonicalStatKey],
    evaluate(context) {
      if (!isApplicable(context, allowedPositions)) {
        return {
          state: "not_applicable",
          requiredStats: [canonicalStatKey]
        };
      }

      if (context.statSource === "projection") {
        const projectedHits = context.getStat(scoringKey);
        if (projectedHits.statValue !== null && projectedHits.statKey) {
          return {
            state: "evaluated",
            requiredStats: [scoringKey],
            components: projectedHits.statValue > 0
              ? [component({
                  scoringKey,
                  statKey: projectedHits.statKey,
                  statValue: projectedHits.statValue,
                  scoringValue: context.scoringValue,
                  category,
                  description
                })]
              : []
          };
        }
      }

      const resolved = context.getStat(canonicalStatKey);
      if (resolved.statValue === null || !resolved.statKey) {
        return {
          state: "missing_stat",
          requiredStats: [canonicalStatKey]
        };
      }

      return {
        state: "evaluated",
        requiredStats: [canonicalStatKey],
        components:
          resolved.statValue >= threshold
          ? [
                fixedPointComponent({
                  scoringKey,
                  statKey: resolved.statKey,
                  statValue: resolved.statValue,
                  scoringValue: context.scoringValue,
                  category,
                  description
                })
              ]
            : []
      };
    }
  };
}

function thresholdRangeRule(
  scoringKey: string,
  canonicalStatKey: string,
  minimum: number,
  exclusiveMaximum: number,
  category: FantasyScoringComponent["category"],
  description: string,
  allowedPositions?: PositionGroup[]
): SleeperScoringRule {
  return {
    scoringKey,
    category,
    description,
    allowedPositions,
    requiredStats: [canonicalStatKey],
    evaluate(context) {
      if (!isApplicable(context, allowedPositions)) {
        return {
          state: "not_applicable",
          requiredStats: [canonicalStatKey]
        };
      }

      if (context.statSource === "projection") {
        const projectedHits = context.getStat(scoringKey);
        if (projectedHits.statValue !== null && projectedHits.statKey) {
          return {
            state: "evaluated",
            requiredStats: [scoringKey],
            components: projectedHits.statValue > 0
              ? [component({
                  scoringKey,
                  statKey: projectedHits.statKey,
                  statValue: projectedHits.statValue,
                  scoringValue: context.scoringValue,
                  category,
                  description
                })]
              : []
          };
        }
      }

      const resolved = context.getStat(canonicalStatKey);
      if (resolved.statValue === null || !resolved.statKey) {
        return {
          state: "missing_stat",
          requiredStats: [canonicalStatKey]
        };
      }

      return {
        state: "evaluated",
        requiredStats: [canonicalStatKey],
        components:
          resolved.statValue >= minimum && resolved.statValue < exclusiveMaximum
            ? [
                fixedPointComponent({
                  scoringKey,
                  statKey: resolved.statKey,
                  statValue: resolved.statValue,
                  scoringValue: context.scoringValue,
                  category,
                  description
                })
              ]
            : []
      };
    }
  };
}

function tierRule(
  scoringKey: string,
  canonicalStatKey: string,
  min: number,
  max: number,
  category: FantasyScoringComponent["category"],
  description: string,
  allowedPositions?: PositionGroup[]
): SleeperScoringRule {
  return {
    scoringKey,
    category,
    description,
    allowedPositions,
    requiredStats: [canonicalStatKey],
    evaluate(context) {
      if (!isApplicable(context, allowedPositions)) {
        return {
          state: "not_applicable",
          requiredStats: [canonicalStatKey]
        };
      }

      const resolved = context.getStat(canonicalStatKey);
      if (resolved.statValue === null || !resolved.statKey) {
        return {
          state: "missing_stat",
          requiredStats: [canonicalStatKey]
        };
      }

      const matches = resolved.statValue >= min && resolved.statValue <= max;
      return {
        state: "evaluated",
        requiredStats: [canonicalStatKey],
        components: matches
          ? [
              fixedPointComponent({
                scoringKey,
                statKey: resolved.statKey,
                statValue: resolved.statValue,
                scoringValue: context.scoringValue,
                category,
                description
              })
            ]
          : []
      };
    }
  };
}

function overlappingFieldGoalRule(
  scoringKey: string,
  canonicalStatKey: string,
  category: FantasyScoringComponent["category"],
  description: string
): SleeperScoringRule {
  return {
    scoringKey,
    category,
    description,
    allowedPositions: KICKER,
    requiredStats: [canonicalStatKey],
    evaluate(context) {
      if (!isApplicable(context, KICKER)) {
        return {
          state: "not_applicable",
          requiredStats: [canonicalStatKey]
        };
      }

      if (FIELD_GOAL_BAND_KEYS.some((key) => context.activeScoringKeys.has(key))) {
        return {
          state: "unsupported",
          requiredStats: [canonicalStatKey],
          warning: {
            code: "OVERLAPPING_KICKER_SCORING",
            scoringKey,
            message: "Generic field-goal scoring overlaps with active distance-band scoring and was not double-counted."
          }
        };
      }

      const resolved = context.getStat(canonicalStatKey);
      if (resolved.statValue === null || !resolved.statKey) {
        return {
          state: "missing_stat",
          requiredStats: [canonicalStatKey]
        };
      }

      return {
        state: "evaluated",
        requiredStats: [canonicalStatKey],
        components: [
          component({
            scoringKey,
            statKey: resolved.statKey,
            statValue: resolved.statValue,
            scoringValue: context.scoringValue,
            category,
            description
          })
        ]
      };
    }
  };
}

function combinedThresholdRule(
  scoringKey: string,
  canonicalStatKeys: [string, string],
  threshold: number,
  category: FantasyScoringComponent["category"],
  description: string,
  allowedPositions?: PositionGroup[]
): SleeperScoringRule {
  return {
    scoringKey,
    category,
    description,
    allowedPositions,
    requiredStats: canonicalStatKeys,
    evaluate(context) {
      if (!isApplicable(context, allowedPositions)) {
        return {
          state: "not_applicable",
          requiredStats: canonicalStatKeys
        };
      }

      if (context.statSource === "projection") {
        const projectedHits = context.getStat(scoringKey);
        if (projectedHits.statValue !== null && projectedHits.statKey) {
          return {
            state: "evaluated",
            requiredStats: [scoringKey],
            components: projectedHits.statValue > 0
              ? [component({
                  scoringKey,
                  statKey: projectedHits.statKey,
                  statValue: projectedHits.statValue,
                  scoringValue: context.scoringValue,
                  category,
                  description
                })]
              : []
          };
        }
      }

      const [firstKey, secondKey] = canonicalStatKeys;
      const first = context.getStat(firstKey);
      const second = context.getStat(secondKey);
      const hasFirst = typeof first.statValue === "number" && first.statKey;
      const hasSecond = typeof second.statValue === "number" && second.statKey;

      if (!hasFirst && !hasSecond) {
        return {
          state: "missing_stat",
          requiredStats: canonicalStatKeys
        };
      }

      const statValue = (hasFirst ? (first.statValue ?? 0) : 0) + (hasSecond ? (second.statValue ?? 0) : 0);
      return {
        state: "evaluated",
        requiredStats: canonicalStatKeys,
        components:
          statValue >= threshold
            ? [
                fixedPointComponent({
                  scoringKey,
                  statKey: `${firstKey}+${secondKey}`,
                  statValue,
                  scoringValue: context.scoringValue,
                  category,
                  description
                })
              ]
            : []
      };
    }
  };
}

function combinedPerUnitStatRule(
  scoringKey: string,
  canonicalStatKeys: [string, string],
  category: FantasyScoringComponent["category"],
  description: string,
  allowedPositions?: PositionGroup[]
): SleeperScoringRule {
  return {
    scoringKey,
    category,
    description,
    allowedPositions,
    requiredStats: canonicalStatKeys,
    evaluate(context) {
      if (!isApplicable(context, allowedPositions)) {
        return {
          state: "not_applicable",
          requiredStats: canonicalStatKeys
        };
      }

      const [firstKey, secondKey] = canonicalStatKeys;
      const first = context.getStat(firstKey);
      const second = context.getStat(secondKey);
      const hasFirst = typeof first.statValue === "number" && first.statKey;
      const hasSecond = typeof second.statValue === "number" && second.statKey;

      if (!hasFirst && !hasSecond) {
        return {
          state: "missing_stat",
          requiredStats: canonicalStatKeys
        };
      }

      const combined = (hasFirst ? (first.statValue ?? 0) : 0) + (hasSecond ? (second.statValue ?? 0) : 0);
      return {
        state: "evaluated",
        requiredStats: canonicalStatKeys,
        components:
          combined > 0
            ? [
                component({
                  scoringKey,
                  statKey: `${firstKey}+${secondKey}`,
                  statValue: combined,
                  scoringValue: context.scoringValue,
                  category,
                  description
                })
              ]
            : []
      };
    }
  };
}

function combinedThresholdRangeRule(
  scoringKey: string,
  canonicalStatKeys: [string, string],
  minimum: number,
  exclusiveMaximum: number,
  category: FantasyScoringComponent["category"],
  description: string,
  allowedPositions?: PositionGroup[]
): SleeperScoringRule {
  return {
    scoringKey,
    category,
    description,
    allowedPositions,
    requiredStats: canonicalStatKeys,
    evaluate(context) {
      if (!isApplicable(context, allowedPositions)) {
        return {
          state: "not_applicable",
          requiredStats: canonicalStatKeys
        };
      }

      if (context.statSource === "projection") {
        const projectedHits = context.getStat(scoringKey);
        if (projectedHits.statValue !== null && projectedHits.statKey) {
          return {
            state: "evaluated",
            requiredStats: [scoringKey],
            components: projectedHits.statValue > 0
              ? [component({
                  scoringKey,
                  statKey: projectedHits.statKey,
                  statValue: projectedHits.statValue,
                  scoringValue: context.scoringValue,
                  category,
                  description
                })]
              : []
          };
        }
      }

      const [firstKey, secondKey] = canonicalStatKeys;
      const first = context.getStat(firstKey);
      const second = context.getStat(secondKey);
      const hasFirst = typeof first.statValue === "number" && first.statKey;
      const hasSecond = typeof second.statValue === "number" && second.statKey;

      if (!hasFirst && !hasSecond) {
        return {
          state: "missing_stat",
          requiredStats: canonicalStatKeys
        };
      }

      const statValue = (hasFirst ? (first.statValue ?? 0) : 0) + (hasSecond ? (second.statValue ?? 0) : 0);
      return {
        state: "evaluated",
        requiredStats: canonicalStatKeys,
        components:
          statValue >= minimum && statValue < exclusiveMaximum
            ? [
                fixedPointComponent({
                  scoringKey,
                  statKey: `${firstKey}+${secondKey}`,
                  statValue,
                  scoringValue: context.scoringValue,
                  category,
                  description
                })
              ]
            : []
      };
    }
  };
}

function component(input: Omit<FantasyScoringComponent, "points">): FantasyScoringComponent {
  return {
    ...input,
    points: input.statValue * input.scoringValue
  };
}

function fixedPointComponent(input: Omit<FantasyScoringComponent, "points">): FantasyScoringComponent {
  return {
    ...input,
    points: input.scoringValue
  };
}

function isApplicable(context: ScoringRuleContext, allowedPositions?: PositionGroup[]) {
  if (!allowedPositions?.length) return true;
  if (!context.positionGroup) return false;
  return allowedPositions.includes(context.positionGroup);
}

function mergeAllowedPositions(rules: SleeperScoringRule[]) {
  const positions = [...new Set(rules.flatMap((rule) => rule.allowedPositions ?? []))];
  return positions.length > 0 ? positions : undefined;
}
