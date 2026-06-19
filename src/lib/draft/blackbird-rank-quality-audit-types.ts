import type { BlackbirdBoardRow } from "./blackbird-board";
import type { FilterDraftablePlayersResult } from "./player-draftability-types";

export type BlackbirdRankBugCode =
  | "elite_player_buried"
  | "projection_rank_mismatch"
  | "market_rank_mismatch"
  | "wrong_sort_field"
  | "overweighted_games_or_risk"
  | "active_policy_unexpected_suppression"
  | "confidence_penalty_too_large"
  | "replacement_value_bug"
  | "missing_projection_bug"
  | "position_eligibility_bug"
  | "legacy_archive_draftable";

export type BlackbirdRankAuditSurface =
  | "Full Blackbird Rank"
  | "Available Blackbird Rank"
  | "Draft Suggestions"
  | "Draft Signal top player"
  | "Recommended Targets"
  | "GM Brief top recommendation";

export type BlackbirdRankAuditTopRow = {
  player_name: string;
  position: string | null;
  team: string | null;
  current_blackbird_rank: number;
  draft_suggestion_rank: number | null;
  projection_points: number | null;
  projection_ppg: number | null;
  floor: number | null;
  ceiling: number | null;
  points_above_replacement: number | null;
  replacement_value: number | null;
  trust: string;
  confidence: string;
  risk: string;
  active_policy: string | null;
  market_adp: number | null;
  market_order: number | null;
  market_anchor_rank: number | null;
  final_sort_key_used: string;
  reason_codes: string[];
};

export type BlackbirdRankAuditWatchedPlayer = {
  player_name: string;
  matched: boolean;
  current_rank: number | null;
  expected_rough_range: string;
  why_ranked_there: string[];
  pushing_down_components: string[];
  market_anchor_would_move: boolean | null;
  market_anchor_rank: number | null;
  active_policy_suppression: boolean;
  trust_risk_fallback_suppression: boolean;
  bug_codes: BlackbirdRankBugCode[];
  row: BlackbirdRankAuditTopRow | null;
};

export type BlackbirdRankAuditSortSurface = {
  surface: BlackbirdRankAuditSurface;
  sort_field: "blackbird_rank" | "static_value" | "draft_suggestion_score" | "projection_points" | "fallback_rank" | "market_anchor_preview_rank" | "some_other_field";
  detail: string;
};

export type BlackbirdRankQualityAuditReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  leagueFormat: string;
  verdict: "passed" | "failed" | "needs_review";
  recommendation: "blackbird_rank_quality_passed" | "blackbird_rank_quality_needs_review";
  rowsAudited: number;
  top25: BlackbirdRankAuditTopRow[];
  top50: BlackbirdRankAuditTopRow[];
  top300: BlackbirdRankAuditTopRow[];
  draftable_top_25: BlackbirdRankAuditTopRow[];
  draftable_top_50: BlackbirdRankAuditTopRow[];
  excluded_legacy_examples: Array<{
    player_name: string;
    found_in_draftable_top_300: boolean;
    excluded_example: boolean;
  }>;
  excluded_policy_counts: Record<string, number>;
  blocked_archive_count: number;
  manual_review_count: number;
  source_expansion_required_count: number;
  shadow_only_count: number;
  watchedPlayers: BlackbirdRankAuditWatchedPlayer[];
  likelyRankBugs: Array<{ code: BlackbirdRankBugCode; player_name: string; detail: string }>;
  sortSurfaces: BlackbirdRankAuditSortSurface[];
  unsupportedPositionsPresentInTop300: string[];
  marketAnchorEnabledByDefault: false;
  supabaseWrites: false;
  v82Enabled: false;
};

export type BuildBlackbirdRankQualityAuditInput = {
  projectionSeason: number;
  leagueFormat?: string;
  rows: BlackbirdBoardRow[];
  topN?: number;
  draftability?: Pick<FilterDraftablePlayersResult<unknown>, "filteredPolicyCounts" | "filteredExamples" | "filteredReasons">;
};
