import type { PositionGroup } from "@/lib/scoring/types";
import type { CanonicalStatDefinition, ResolvedStat } from "@/lib/scoring/types";

const STAT_DEFINITIONS: CanonicalStatDefinition[] = [
  { canonicalKey: "pass_yd", aliases: ["pass_yds", "passing_yards", "pass_yards"] },
  { canonicalKey: "pass_td", aliases: ["pass_tds", "passing_touchdowns", "passing_tds"] },
  { canonicalKey: "pass_int", aliases: ["passing_interceptions", "interceptions_thrown", "pass_interceptions"] },
  { canonicalKey: "pass_cmp", aliases: ["pass_completions", "completions"] },
  { canonicalKey: "pass_inc", aliases: ["pass_incompletions", "incompletions"] },
  { canonicalKey: "pass_att", aliases: ["pass_attempts", "passing_attempts"] },
  { canonicalKey: "pass_sack", aliases: ["sacks_taken", "times_sacked"] },
  { canonicalKey: "pass_2pt", aliases: ["pass_two_point_conversions", "passing_two_point_conversions"] },
  { canonicalKey: "pass_fd", aliases: ["passing_first_downs"] },
  { canonicalKey: "pass_pick6", aliases: ["pick_six_thrown", "pick_sixes_thrown", "pass_pick_6"] },
  { canonicalKey: "rush_yd", aliases: ["rush_yds", "rushing_yards", "rush_yards"] },
  { canonicalKey: "rush_td", aliases: ["rush_tds", "rushing_touchdowns", "rushing_tds"] },
  { canonicalKey: "rush_att", aliases: ["rush_attempts", "rushing_attempts"] },
  { canonicalKey: "rush_2pt", aliases: ["rush_two_point_conversions", "rushing_two_point_conversions"] },
  { canonicalKey: "rush_fd", aliases: ["rushing_first_downs"] },
  { canonicalKey: "rec", aliases: ["receptions"] },
  { canonicalKey: "rec_yd", aliases: ["receiving_yards", "rec_yards", "rec_yds"] },
  { canonicalKey: "rec_td", aliases: ["receiving_touchdowns", "receiving_tds", "rec_tds"] },
  { canonicalKey: "rec_tgt", aliases: ["targets", "receiving_targets"] },
  { canonicalKey: "rec_2pt", aliases: ["receiving_two_point_conversions", "rec_two_point_conversions"] },
  { canonicalKey: "rec_fd", aliases: ["receiving_first_downs"] },
  { canonicalKey: "fum", aliases: ["fumbles"] },
  { canonicalKey: "fum_lost", aliases: ["fumbles_lost"] },
  { canonicalKey: "fum_ret_td", aliases: ["fumble_return_touchdowns", "fumble_recovery_touchdowns"] },
  { canonicalKey: "kick_ret_yd", aliases: ["kick_return_yards", "kick_return_yd"] },
  { canonicalKey: "punt_ret_yd", aliases: ["punt_return_yards", "punt_return_yd"] },
  { canonicalKey: "return_td", aliases: ["return_touchdowns", "ret_td"] },
  { canonicalKey: "return_fd", aliases: ["return_first_downs"] },
  { canonicalKey: "xpm", aliases: ["extra_points_made"] },
  { canonicalKey: "xpmiss", aliases: ["xp_missed", "extra_points_missed"] },
  { canonicalKey: "fgm", aliases: ["field_goals_made"] },
  { canonicalKey: "fgmiss", aliases: ["fg_missed", "field_goals_missed"] },
  { canonicalKey: "fgm_0_19", aliases: ["field_goals_made_0_19"] },
  { canonicalKey: "fgm_20_29", aliases: ["field_goals_made_20_29"] },
  { canonicalKey: "fgm_30_39", aliases: ["field_goals_made_30_39"] },
  { canonicalKey: "fgm_40_49", aliases: ["field_goals_made_40_49"] },
  { canonicalKey: "fgm_50_59", aliases: ["field_goals_made_50_59"] },
  { canonicalKey: "fgm_50p", aliases: ["field_goals_made_50_plus"] },
  { canonicalKey: "fgm_60p", aliases: ["field_goals_made_60_plus"] },
  { canonicalKey: "fgmiss_0_19", aliases: ["field_goals_missed_0_19"] },
  { canonicalKey: "fgmiss_20_29", aliases: ["field_goals_missed_20_29"] },
  { canonicalKey: "fgmiss_30_39", aliases: ["field_goals_missed_30_39"] },
  { canonicalKey: "fgmiss_40_49", aliases: ["field_goals_missed_40_49"] },
  { canonicalKey: "fgmiss_50p", aliases: ["field_goals_missed_50_plus"] },
  { canonicalKey: "pts_allow", aliases: ["points_allowed"] },
  { canonicalKey: "yds_allow", aliases: ["yards_allowed"] },
  { canonicalKey: "sack", aliases: ["sacks"] },
  { canonicalKey: "int", aliases: ["interceptions"] },
  { canonicalKey: "ff", aliases: ["forced_fumbles"] },
  { canonicalKey: "fr", aliases: ["fumble_recoveries"] },
  { canonicalKey: "safe", aliases: ["safeties"] },
  { canonicalKey: "blk_kick", aliases: ["blocked_kicks"] },
  { canonicalKey: "def_td", aliases: ["defensive_touchdowns"] },
  { canonicalKey: "def_st_td", aliases: ["defensive_special_teams_touchdowns", "special_teams_touchdowns"] },
  { canonicalKey: "def_2pt_ret", aliases: ["two_point_returns", "two_point_return_touchdowns"] },
  { canonicalKey: "fourth_down_stop", aliases: ["fourth_down_stops"] },
  { canonicalKey: "three_and_out", aliases: ["three_and_outs"] },
  { canonicalKey: "solo_tkl", aliases: ["tackle_solo", "solo_tackles"], allowedPositions: ["DL", "LB", "DB"] },
  { canonicalKey: "ast_tkl", aliases: ["assist_tkl", "tackle_ast", "assisted_tackles"], allowedPositions: ["DL", "LB", "DB"] },
  { canonicalKey: "tkl", aliases: ["tackles", "total_tackles"], allowedPositions: ["DL", "LB", "DB"] },
  { canonicalKey: "tkl_loss", aliases: ["tackle_loss", "tackles_for_loss"], allowedPositions: ["DL", "LB", "DB"] },
  { canonicalKey: "qb_hit", aliases: ["quarterback_hits"], allowedPositions: ["DL", "LB", "DB"] },
  { canonicalKey: "pd", aliases: ["pass_def", "passes_defended"], allowedPositions: ["DL", "LB", "DB"] },
  { canonicalKey: "int_ret_yd", aliases: ["interception_return_yards"], allowedPositions: ["DL", "LB", "DB"] },
  { canonicalKey: "fr_ret_yd", aliases: ["fumble_return_yards"], allowedPositions: ["DL", "LB", "DB"] },
  { canonicalKey: "st_tkl", aliases: ["special_teams_tackles"], allowedPositions: ["DL", "LB", "DB"] }
];

const STAT_DEFINITIONS_BY_KEY = new Map(STAT_DEFINITIONS.map((entry) => [entry.canonicalKey, entry]));

type NumericStats = Record<string, number>;

export function getCanonicalStatDefinitions() {
  return [...STAT_DEFINITIONS];
}

export function createStatResolver(rawStats: Record<string, unknown>) {
  const normalizedStats = normalizeStats(rawStats);
  const consumedKeys = new Set<string>();
  const ambiguityMap = new Map<string, string[]>();
  const cache = new Map<string, ResolvedStat>();

  return {
    getStat(canonicalKey: string): ResolvedStat {
      const cached = cache.get(canonicalKey);
      if (cached) return cached;

      const definition = STAT_DEFINITIONS_BY_KEY.get(canonicalKey);
      const presentAliases: string[] = [];
      const exactValue = normalizedStats[canonicalKey];

      if (exactValue !== undefined) {
        presentAliases.push(canonicalKey);
      }

      for (const alias of definition?.aliases ?? []) {
        if (normalizedStats[alias] !== undefined) {
          presentAliases.push(alias);
        }
      }

      let statKey: string | null = null;
      let statValue: number | null = null;

      if (exactValue !== undefined) {
        statKey = canonicalKey;
        statValue = exactValue;
      } else {
        for (const alias of definition?.aliases ?? []) {
          if (normalizedStats[alias] !== undefined) {
            statKey = alias;
            statValue = normalizedStats[alias];
            break;
          }
        }
      }

      if (presentAliases.length > 1) {
        const distinctValues = new Set(
          presentAliases
            .map((alias) => normalizedStats[alias])
            .filter((value): value is number => value !== undefined)
        );
        if (distinctValues.size > 1) {
          ambiguityMap.set(canonicalKey, [...presentAliases]);
        }
      }

      if (statKey) {
        consumedKeys.add(statKey);
      }

      const resolved = {
        canonicalKey,
        statKey,
        statValue,
        presentAliases
      };
      cache.set(canonicalKey, resolved);
      return resolved;
    },
    getUnusedStatKeys() {
      return Object.keys(normalizedStats).filter((key) => !consumedKeys.has(key)).sort();
    },
    getAmbiguousAliases() {
      return [...ambiguityMap.entries()]
        .map(([canonicalKey, presentAliases]) => ({ canonicalKey, presentAliases }))
        .sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey));
    }
  };
}

export function getDefinitionForCanonicalStat(canonicalKey: string) {
  return STAT_DEFINITIONS_BY_KEY.get(canonicalKey) ?? null;
}

export function isStatAllowedForPosition(canonicalKey: string, positionGroup: PositionGroup | null) {
  const definition = STAT_DEFINITIONS_BY_KEY.get(canonicalKey);
  if (!definition?.allowedPositions?.length) return true;
  if (!positionGroup) return false;
  return definition.allowedPositions.includes(positionGroup);
}

function normalizeStats(rawStats: Record<string, unknown>): NumericStats {
  return Object.fromEntries(
    Object.entries(rawStats)
      .map(([key, value]) => [key.trim().toLowerCase(), toFiniteNumber(value)] as const)
      .filter((entry): entry is [string, number] => entry[0].length > 0 && entry[1] !== null)
  );
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
