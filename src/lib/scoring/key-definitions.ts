import type { PositionGroup, ScoringKeyDefinition } from "@/lib/scoring/types";

const OFFENSE: PositionGroup[] = ["QB", "RB", "WR", "TE"];

type KeyDefinitionInput = Omit<ScoringKeyDefinition, "implementationStatus"> & {
  implementationStatus?: ScoringKeyDefinition["implementationStatus"];
};

const KNOWN_KEY_DEFINITIONS: ScoringKeyDefinition[] = [
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
    description: "Pick-sixes thrown — interceptions returned for a touchdown against the QB",
    allowedPositions: ["QB"],
    requiredStats: ["pass_pick6"],
    engineImplementationStatus: "implemented",
    dataCapabilityStatus: "unavailable_from_weekly_source",
    rowStatAvailabilityStatus: "absent",
    dataCapabilityDetail: {
      reason: "The nflverse weekly player stats CSV has no column that tracks whether a QB's interception was returned for a touchdown. Only the total interception count (passing_interceptions → pass_int) is recorded. The pass_pick6 canonical stat is absent from every nflverse weekly row.",
      requiredData: ["pick-six outcome per interception play"]
    }
  }),
  define({
    scoringKey: "pass_int_td",
    category: "passing",
    description: "QB penalty when thrown interception is returned for a touchdown (pick-six) — same event as pass_pick6, maps to identical canonical stat",
    allowedPositions: ["QB"],
    requiredStats: ["pass_pick6"],
    engineImplementationStatus: "implemented",
    dataCapabilityStatus: "unavailable_from_weekly_source",
    rowStatAvailabilityStatus: "absent",
    dataCapabilityDetail: {
      reason: "Maps to the pass_pick6 canonical stat, which is absent from the nflverse weekly source. The nflverse weekly CSV tracks only total interception count, not per-interception return outcomes. No inference from pass_int is permitted.",
      requiredData: ["pick-six outcome per interception play"]
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
