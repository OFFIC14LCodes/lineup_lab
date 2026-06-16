import { scoreFantasyStats } from "@/lib/scoring/score-player";
import { normalizePositionGroup } from "@/lib/players/normalize";

import type { NflverseWeeklyStatRecord } from "@/lib/data-acquisition/nflverse";
import type { PlayerProfileScoringProfile } from "./player-profile-types";

export const DEFAULT_PLAYER_PROFILE_SCORING: PlayerProfileScoringProfile = {
  id: "blackbird-default-profile-scoring",
  label: "Blackbird default dry-run profile scoring",
  version: "v1",
  scoringSettings: {
    pass_yd: 0.04,
    pass_td: 4,
    pass_int: -2,
    rush_yd: 0.1,
    rush_td: 6,
    rec: 1,
    rec_yd: 0.1,
    rec_td: 6,
    fgm: 3,
    xpm: 1,
    fgmiss: -1,
    xpmiss: -1,
    solo_tkl: 2,
    ast_tkl: 1,
    sack: 6,
    int: 4,
    ff: 2,
    fr: 2,
    pd: 1,
    def_td: 6,
    safe: 2,
  },
  notes: [
    "Dry-run default profile only; not a league-specific scoring profile.",
    "IDP support includes solo tackles and sacks so defensive profiles do not collapse to near-zero points.",
    "Replace with league scoring when profiles are wired into product surfaces.",
  ],
};

export function scoreProfileWeeklyStat(row: NflverseWeeklyStatRecord, scoringProfile: PlayerProfileScoringProfile = DEFAULT_PLAYER_PROFILE_SCORING) {
  const stats = canonicalWeeklyStats(row);
  return {
    stats,
    result: scoreFantasyStats({
      stats,
      scoringSettings: scoringProfile.scoringSettings,
      positionGroup: normalizePositionGroup(row.position),
      statSource: "actual",
      context: { season: row.season ?? undefined, week: row.week, playerId: row.playerId },
    }),
  };
}

export function canonicalWeeklyStats(row: NflverseWeeklyStatRecord): Record<string, number> {
  const stats: Record<string, number> = {};
  add(stats, "pass_cmp", row.offensiveStats.completions);
  add(stats, "pass_att", row.offensiveStats.attempts);
  add(stats, "pass_yd", row.offensiveStats.passing_yards);
  add(stats, "pass_td", row.offensiveStats.passing_tds);
  add(stats, "pass_int", row.offensiveStats.passing_interceptions);
  add(stats, "pass_sack", row.offensiveStats.sacks_suffered);
  add(stats, "rush_att", row.offensiveStats.carries);
  add(stats, "rush_yd", row.offensiveStats.rushing_yards);
  add(stats, "rush_td", row.offensiveStats.rushing_tds);
  add(stats, "rec", row.offensiveStats.receptions);
  add(stats, "targets", row.offensiveStats.targets);
  add(stats, "rec_yd", row.offensiveStats.receiving_yards);
  add(stats, "rec_td", row.offensiveStats.receiving_tds);
  add(stats, "fgm", row.kickingStats.fg_made);
  add(stats, "fga", row.kickingStats.fg_att);
  add(stats, "fgmiss", row.kickingStats.fg_missed);
  add(stats, "xpm", row.kickingStats.pat_made);
  add(stats, "xpa", row.kickingStats.pat_att);
  add(stats, "xpmiss", row.kickingStats.pat_missed);
  add(stats, "solo_tkl", row.defensiveStats.def_tackles_solo);
  add(stats, "ast_tkl", row.defensiveStats.def_tackle_assists);
  add(stats, "tkl", row.defensiveStats.def_tackles_with_assist);
  add(stats, "tkl_loss", row.defensiveStats.def_tackles_for_loss);
  add(stats, "ff", row.defensiveStats.def_fumbles_forced);
  add(stats, "sack", row.defensiveStats.def_sacks);
  add(stats, "qb_hit", row.defensiveStats.def_qb_hits);
  add(stats, "int", row.defensiveStats.def_interceptions);
  add(stats, "int_ret_yd", row.defensiveStats.def_interception_yards);
  add(stats, "pd", row.defensiveStats.def_pass_defended);
  add(stats, "def_td", row.defensiveStats.def_tds);
  add(stats, "safe", row.defensiveStats.def_safeties);
  return stats;
}

function add(stats: Record<string, number>, key: string, value: number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) stats[key] = value;
}
