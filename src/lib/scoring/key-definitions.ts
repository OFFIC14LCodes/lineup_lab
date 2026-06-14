import type { PositionGroup, ScoringKeyDefinition } from "@/lib/scoring/types";

const OFFENSE: PositionGroup[] = ["QB", "RB", "WR", "TE"];

type KeyDefinitionInput = Omit<ScoringKeyDefinition, "implementationStatus"> & {
  implementationStatus?: ScoringKeyDefinition["implementationStatus"];
};

const KNOWN_KEY_DEFINITIONS: ScoringKeyDefinition[] = [
  define({
    scoringKey: "fum_ret_td",
    category: "miscellaneous",
    description: "Fumble-recovery touchdowns derived from nflverse play-by-play when recovery and touchdown attribution are structurally unambiguous",
    allowedPositions: OFFENSE,
    requiredStats: ["fum_ret_td"],
    dataCapabilityStatus: "implementable_now_verified",
    rowStatAvailabilityStatus: "available",
    dataCapabilityDetail: {
      reason: "Derived from nflverse PBP by matching the touchdown scorer to the fumble recovery player on qualifying plays.",
      requiredData: ["nflverse PBP fumble recovery player attribution", "nflverse PBP touchdown scorer attribution"]
    }
  }),
  define({
    scoringKey: "pass_inc",
    category: "passing",
    description: "Passing incompletions derived from pass_att - pass_cmp during weekly normalization",
    allowedPositions: ["QB"],
    requiredStats: ["pass_inc"],
    dataCapabilityStatus: "implementable_now_verified"
  }),
  define({
    scoringKey: "fum",
    category: "miscellaneous",
    description: "Total fumbles aggregated from nflverse weekly context columns",
    allowedPositions: OFFENSE,
    requiredStats: ["fum"],
    dataCapabilityStatus: "implementable_now_verified"
  }),
  define({
    scoringKey: "kick_ret_yd",
    category: "returns",
    description: "Kickoff return yards from nflverse weekly player stats",
    allowedPositions: OFFENSE,
    requiredStats: ["kick_ret_yd"],
    dataCapabilityStatus: "implementable_now_verified"
  }),
  define({
    scoringKey: "punt_ret_yd",
    category: "returns",
    description: "Punt return yards from nflverse weekly player stats",
    allowedPositions: OFFENSE,
    requiredStats: ["punt_ret_yd"],
    dataCapabilityStatus: "implementable_now_verified"
  }),
  define({
    scoringKey: "return_td",
    category: "returns",
    description: "Kick or punt return touchdowns from nflverse weekly special_teams_tds",
    allowedPositions: OFFENSE,
    requiredStats: ["return_td"],
    dataCapabilityStatus: "implementable_now_verified"
  }),
  define({
    scoringKey: "return_fd",
    category: "first_downs",
    description: "Return first downs",
    allowedPositions: OFFENSE,
    requiredStats: ["return_fd"],
    dataCapabilityStatus: "unavailable_from_weekly_source",
    rowStatAvailabilityStatus: "absent",
    dataCapabilityDetail: {
      reason: "The archived nflverse weekly player stats schema does not expose a verified return-first-down column, so return_fd cannot be sourced from the current weekly pipeline.",
      requiredData: ["A verified weekly player return-first-down field or a new trustworthy source"]
    }
  }),
  define({
    scoringKey: "bonus_rec_rb",
    category: "receiving",
    description: "Running back reception bonus",
    allowedPositions: ["RB"],
    requiredStats: ["rec"]
  }),
  define({
    scoringKey: "bonus_rec_wr",
    category: "receiving",
    description: "Wide receiver reception bonus",
    allowedPositions: ["WR"],
    requiredStats: ["rec"]
  }),
  define({
    scoringKey: "bonus_rec_te",
    category: "receiving",
    description: "Tight end reception bonus",
    allowedPositions: ["TE"],
    requiredStats: ["rec"]
  }),
  define({
    scoringKey: "bonus_pass_cmp_25",
    category: "bonuses",
    description: "25+ pass completions bonus",
    allowedPositions: ["QB"],
    requiredStats: ["pass_cmp"]
  }),
  define({
    scoringKey: "bonus_rush_att_20",
    category: "bonuses",
    description: "20+ carries bonus",
    allowedPositions: OFFENSE,
    requiredStats: ["rush_att"]
  }),
  define({
    scoringKey: "bonus_rush_rec_yd_100",
    category: "bonuses",
    description: "100-199 combined rush + rec yards bonus",
    allowedPositions: OFFENSE,
    requiredStats: ["rush_yd", "rec_yd"],
    derivedStatExpression: "rush_yd + rec_yd"
  }),
  define({
    scoringKey: "bonus_rush_rec_yd_200",
    category: "bonuses",
    description: "200+ combined rush + rec yards bonus",
    allowedPositions: OFFENSE,
    requiredStats: ["rush_yd", "rec_yd"],
    derivedStatExpression: "rush_yd + rec_yd"
  }),
  define({
    scoringKey: "bonus_fd_qb",
    category: "first_downs",
    description: "QB bonus per passing first down — additive to pass_fd, scored per first down earned via passing",
    allowedPositions: ["QB"],
    requiredStats: ["pass_fd"],
    dataCapabilityStatus: "implementable_now_verified"
  }),
  define({
    scoringKey: "bonus_fd_rb",
    category: "first_downs",
    description: "RB bonus per first down earned — applies to combined rushing and receiving first downs (rush_fd + rec_fd)",
    allowedPositions: ["RB"],
    requiredStats: ["rush_fd", "rec_fd"],
    derivedStatExpression: "rush_fd + rec_fd",
    dataCapabilityStatus: "implementable_now_verified"
  }),
  define({
    scoringKey: "bonus_fd_wr",
    category: "first_downs",
    description: "WR bonus per receiving first down — additive to rec_fd, scored per first down earned via reception",
    allowedPositions: ["WR"],
    requiredStats: ["rec_fd"],
    dataCapabilityStatus: "implementable_now_verified"
  }),
  define({
    scoringKey: "bonus_fd_te",
    category: "first_downs",
    description: "TE bonus per receiving first down — additive to rec_fd, scored per first down earned via reception",
    allowedPositions: ["TE"],
    requiredStats: ["rec_fd"],
    dataCapabilityStatus: "implementable_now_verified"
  }),
  define({
    scoringKey: "pass_pick6",
    category: "passing",
    description: "Pick-sixes thrown — derived from nflverse play-by-play and merged from player_weekly_derived_stats",
    allowedPositions: ["QB"],
    requiredStats: ["pass_pick6"],
    engineImplementationStatus: "implemented",
    dataCapabilityStatus: "implementable_now_verified",
    rowStatAvailabilityStatus: "available",
    dataCapabilityDetail: {
      reason: "The canonical pass_pick6 stat is produced by the nflverse PBP derivation pipeline and merged onto weekly scoring rows before scoring.",
      requiredData: ["nflverse PBP interception + return_touchdown attribution"]
    }
  }),
  define({
    scoringKey: "pass_int_td",
    category: "passing",
    description: "QB penalty when a thrown interception is returned for a touchdown — alias of pass_pick6 and backed by the same derived canonical stat",
    allowedPositions: ["QB"],
    requiredStats: ["pass_pick6"],
    engineImplementationStatus: "implemented",
    dataCapabilityStatus: "implementable_now_verified",
    rowStatAvailabilityStatus: "available",
    dataCapabilityDetail: {
      reason: "Maps to the derived pass_pick6 canonical stat, which is available after the nflverse PBP derivation merge.",
      requiredData: ["nflverse PBP interception + return_touchdown attribution"]
    }
  }),
  define({
    scoringKey: "rec_td_40p",
    category: "bonuses",
    description: "Receiving touchdown of 40+ yards bonus — derived from nflverse play-by-play; stored in player_weekly_derived_stats",
    allowedPositions: ["QB", "RB", "WR", "TE"],
    requiredStats: ["rec_td_40p"],
    dataCapabilityStatus: "implementable_now_verified"
  }),
  define({
    scoringKey: "rec_td_50p",
    category: "bonuses",
    description: "Receiving touchdown of 50+ yards bonus — derived from nflverse play-by-play; stored in player_weekly_derived_stats",
    allowedPositions: ["QB", "RB", "WR", "TE"],
    requiredStats: ["rec_td_50p"],
    dataCapabilityStatus: "implementable_now_verified"
  }),
  define({
    scoringKey: "rush_td_40p",
    category: "bonuses",
    description: "Rushing touchdown of 40+ yards bonus — derived from nflverse play-by-play; stored in player_weekly_derived_stats",
    allowedPositions: ["QB", "RB", "WR", "TE"],
    requiredStats: ["rush_td_40p"],
    dataCapabilityStatus: "implementable_now_verified"
  }),
  define({
    scoringKey: "rush_td_50p",
    category: "bonuses",
    description: "Rushing touchdown of 50+ yards bonus — derived from nflverse play-by-play; stored in player_weekly_derived_stats",
    allowedPositions: ["QB", "RB", "WR", "TE"],
    requiredStats: ["rush_td_50p"],
    dataCapabilityStatus: "implementable_now_verified"
  })
];

const DEFINITION_BY_KEY = new Map(KNOWN_KEY_DEFINITIONS.map((definition) => [definition.scoringKey, definition] as const));

export function getKnownScoringKeyDefinition(scoringKey: string) {
  return DEFINITION_BY_KEY.get(scoringKey) ?? null;
}

export function isScoringKeyApplicableToPosition(scoringKey: string, positionGroup: PositionGroup | null) {
  const definition = getKnownScoringKeyDefinition(scoringKey);
  if (!definition?.allowedPositions?.length) {
    return definition ? true : null;
  }
  if (!positionGroup) {
    return false;
  }
  return definition.allowedPositions.includes(positionGroup);
}

function define(input: KeyDefinitionInput): ScoringKeyDefinition {
  return {
    ...input,
    implementationStatus: input.implementationStatus ?? "implemented"
  };
}
