import type { ScoringCategory } from "@/lib/scoring/types";

// ---------------------------------------------------------------------------
// H3 Scoring Coverage Audit — type definitions
// These are distinct from the per-key ScoringKeyDefinition types in ../types.ts.
// ScoringKeyDefinition describes a single key's capabilities; these types describe
// the audit-wide classification and reporting model.
// ---------------------------------------------------------------------------

/**
 * Logical grouping of related scoring keys for reporting and roadmapping.
 * 13 distinct families covering all position scopes.
 */
export type ScoringStatFamily =
  | "passing_volume"           // pass_yd, pass_att, pass_cmp, pass_inc, pass_sack
  | "passing_outcomes"         // pass_td, pass_int, pass_pick6, pass_int_td, pass_2pt
  | "rushing"                  // rush_yd, rush_att, rush_td, rush_fd, rush_2pt
  | "receiving"                // rec, rec_tgt, rec_yd, rec_td, rec_fd, rec_2pt
  | "miscellaneous_skill"      // fum, fum_lost, fum_ret_td
  | "special_teams_skill"      // kick_ret_yd, punt_ret_yd, return_td, return_fd
  | "first_down_bonuses"       // pass_fd, rush_fd, rec_fd, bonus_fd_qb/rb/wr/te
  | "yardage_threshold_bonuses" // bonus_pass_yd_*, bonus_rush_yd_*, bonus_rec_yd_*, etc.
  | "long_td_bonuses"          // rec_td_40p/50p, rush_td_40p/50p
  | "position_rec_bonuses"     // rec_te_bonus, rec_rb_bonus, rec_wr_bonus, bonus_rec_te/rb/wr
  | "kicking"                  // xpm, xpmiss, fgm, fgmiss, fgm_*, fgmiss_*
  | "team_defense"             // sack/int/ff/fr/safe/etc. (DEF), pts_allow_*, yds_allow_*
  | "idp";                     // solo_tkl, ast_tkl, tkl, tkl_loss, qb_hit, pd, etc.

/**
 * Whether the scoring engine has a functional, tested rule for this key.
 * Separate from whether the required stat data is available.
 */
export type ScoringEngineStatus =
  | "implemented_verified"   // Rule in SLEEPER_SCORING_RULES + tested with real data
  | "implemented_unverified" // Rule exists, no end-to-end test with real stat rows
  | "not_implemented";       // No rule in SLEEPER_SCORING_RULES

/**
 * Where the required canonical stat originates, and whether it is currently
 * available in the active data pipeline.
 *
 * Use the most specific status that applies:
 * - "nflverse_weekly_verified"  → column is mapped in normalize.ts + scored in live tests
 * - "nflverse_weekly_available" → column is mapped in normalize.ts, not live-tested
 * - "nflverse_weekly_derivable" → can be computed from already-extracted weekly stats
 * - "nflverse_weekly_unwired"   → column exists in nflverse CSV, not yet extracted/mapped
 * - "nflverse_pbp_derived"      → H2 PBP pipeline writes this to player_weekly_derived_stats
 * - "nflverse_pbp_derivable"    → PBP can derive this; pipeline not yet built
 * - "requires_team_game_context"→ needs team-level game aggregate (pts_allow, yds_allow)
 * - "requires_new_source"       → no current path; needs a new data source
 * - "not_safely_derivable"      → technically possible but unreliable or misleading
 * - "out_of_scope"              → position/category intentionally excluded this phase
 */
export type ScoringDataStatus =
  | "nflverse_weekly_verified"
  | "nflverse_weekly_available"
  | "nflverse_weekly_derivable"
  | "nflverse_weekly_unwired"
  | "nflverse_pbp_derived"
  | "nflverse_pbp_derivable"
  | "requires_team_game_context"
  | "requires_new_source"
  | "not_safely_derivable"
  | "out_of_scope";

export type ScoringSourceClassification =
  | "nflverse_weekly_player_stats"
  | "nflverse_pbp_derived_stats"
  | "team_game_context"
  | "deferred_position_source";

export type ScoringScopeClassification =
  | "operational_now"
  | "current_scope_backlog"
  | "deferred_current_phase";

export type ScoringVerificationLevel =
  | "real_play_verified"
  | "repository_test_verified";

/**
 * Authoritative coverage record for a single scoring key.
 * Stored in the registry; compared against live code by the audit tool.
 */
export type ScoringCoverageRecord = {
  key: string;
  label: string;
  family: ScoringStatFamily;
  category: ScoringCategory;
  allowedPositions: string[];
  engineStatus: ScoringEngineStatus;
  dataStatus: ScoringDataStatus;
  /** Canonical stat key read from stats_json (may match key or differ, e.g. pass_int_td → pass_pick6) */
  canonicalStatKey: string | null;
  /** Expression if the stat is computed from multiple canonical keys, e.g. "rush_yd + rec_yd" */
  derivedStatExpression: string | null;
  /** nflverse column name when dataStatus is nflverse_weekly_* */
  normalizedFrom: string | null;
  /** Implementation phase that delivered this key, e.g. "H1" or "H2" */
  implementationPhase: string | null;
  /** Remaining blockers before this key can become operational */
  blockers: string[];
  notes: string | null;
};

/**
 * Single contradiction or gap detected by the audit tool.
 */
export type AuditFinding = {
  severity: "error" | "warning" | "info";
  type:
    | "engine_mismatch"
    | "registry_gap"
    | "data_status_conflict"
    | "known_definition_mismatch"
    | "pbp_derived_set_mismatch";
  key: string;
  detail: string;
};

export type H2VerificationEntry = {
  scoringKey: string;
  engineStatus: ScoringEngineStatus;
  dataStatus: ScoringDataStatus;
  source: ScoringSourceClassification;
  persistencePath: string;
  scoringReadPath: string;
  unitTestEvidence: string;
  integrationTestEvidence: string;
  realPlayVerificationEvidence: string;
};

export type H4BacklogGroupId =
  | "group_a_weekly_derivable"
  | "group_b_weekly_unwired"
  | "group_ab_blocked_candidates"
  | "group_c_additional_pbp_derivations"
  | "group_d_team_context_dependent";

export type H4BacklogGroup = {
  id: H4BacklogGroupId;
  title: string;
  description: string;
  currentKeyCount: number;
  keys: Array<{
    key: string;
    label: string;
    family: ScoringStatFamily;
    dataStatus: ScoringDataStatus;
    recommendedPath: string;
    blockers: string[];
  }>;
};

/**
 * Full result of a coverage audit run.
 */
export type CoverageAuditResult = {
  auditedAt: string;
  totalRegistryKeys: number;
  totalEngineKeys: number;
  findings: AuditFinding[];
  dataStatusSummary: Record<ScoringDataStatus, number>;
  engineStatusSummary: Record<ScoringEngineStatus, number>;
  familySummary: Record<ScoringStatFamily, number>;
  sourceSummary: Record<ScoringSourceClassification, number>;
  scopeSummary: Record<ScoringScopeClassification, number>;
  verificationSummary: Record<ScoringVerificationLevel, number>;
  operationalKeys: string[];
  dataGapKeys: string[];
  outOfScopeKeys: string[];
  implementationRoadmap: ScoringCoverageRecord[];
  h2VerificationEntries: H2VerificationEntry[];
  h4BacklogGroups: H4BacklogGroup[];
};
