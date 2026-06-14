// Canonical season_type values used across Blackbird's tables.
// These differ by table — do not unify them without a schema migration.
//
// player_weekly_stats, player_weekly_derived_stats, player_season_stats:
//   constraint: ('preseason', 'regular', 'postseason')   → use REGULAR_SEASON_PLAYER
//
// team_game_stats:
//   constraint: ('REG', 'POST')                          → use REGULAR_SEASON_TEAM_GAME
//
// This module is the single source of truth. H6, H7, H8, and all future
// scripts must import from here rather than inlining string literals.

/** For player_weekly_stats and player_weekly_derived_stats */
export const REGULAR_SEASON_PLAYER = "regular" as const;

/** For team_game_stats */
export const REGULAR_SEASON_TEAM_GAME = "REG" as const;

/** Positions considered skill positions for fantasy context derivation */
export const SKILL_POSITIONS = ["QB", "RB", "WR", "TE"] as const;
export type SkillPosition = (typeof SKILL_POSITIONS)[number];

export function isSkillPosition(pos: string | null | undefined): pos is SkillPosition {
  return SKILL_POSITIONS.includes(pos as SkillPosition);
}
