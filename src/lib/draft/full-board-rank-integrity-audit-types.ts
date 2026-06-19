export type FullBoardDeltaSeverity = "none" | "minor" | "moderate" | "major" | "severe";

export type FullBoardDisagreement =
  | "blackbird_much_lower_than_market"
  | "blackbird_much_higher_than_market"
  | "blackbird_much_lower_than_projection"
  | "blackbird_much_higher_than_projection"
  | "blackbird_much_lower_than_position_tier"
  | "blackbird_much_higher_than_position_tier";

export type FullBoardDropReason =
  | "low_trust_penalty"
  | "injury_risk_penalty"
  | "active_policy_penalty"
  | "source_expansion_or_manual_review"
  | "low_expected_games"
  | "low_projection_points"
  | "low_projection_ppg"
  | "poor_replacement_value"
  | "position_scarcity_adjustment"
  | "superflex_qb_pushdown_side_effect"
  | "market_disagreement"
  | "data_gap_penalty"
  | "possible_over_penalized_elite"
  | "possible_wrong_sort_field";

export type FullBoardBoostReason =
  | "high_projection_points"
  | "high_projection_ppg"
  | "high_replacement_value"
  | "superflex_qb_premium"
  | "scarcity_boost"
  | "high_confidence_boost"
  | "market_anchor_support"
  | "role_or_context_boost"
  | "possible_over_promoted_low_trust"
  | "possible_legacy_leak"
  | "possible_wrong_sort_field";

export type FullBoardSuspicionLabel =
  | "justified"
  | "probably_justified"
  | "needs_review"
  | "suspicious"
  | "blocked_bug";

export type FullBoardRankIntegrityRecommendation =
  | "full_board_rank_ready_for_manual_review"
  | "full_board_rank_needs_formula_tuning"
  | "full_board_rank_needs_data_fix"
  | "full_board_rank_has_blocking_leakage"
  | "full_board_rank_blocked";

export type FullBoardAuditRow = {
  player_name: string;
  position: string | null;
  team: string | null;
  draftable_rank: number;
  position_rank: number | null;
  projection_rank: number | null;
  projection_ppg_rank: number | null;
  projection_points: number | null;
  projection_ppg: number | null;
  floor: number | null;
  ceiling: number | null;
  points_above_replacement: number | null;
  replacement_value: number | null;
  par_rank: number | null;
  trust: string;
  confidence: string;
  risk: string;
  active_policy: string | null;
  draftability_status: "draftable";
  market_adp: number | null;
  market_order: number | null;
  market_position_rank: number | null;
  market_format: string | null;
  market_match_type: string | null;
  market_anchor_preview_rank: number | null;
  rank_delta_vs_market: number | null;
  rank_delta_vs_projection: number | null;
  rank_delta_vs_projection_ppg: number | null;
  rank_delta_vs_position_expectation: number | null;
  final_sort_key_used: "blackbird_rank";
  delta_severity_vs_market: FullBoardDeltaSeverity;
  delta_severity_vs_projection: FullBoardDeltaSeverity;
  disagreements: FullBoardDisagreement[];
  drop_reason_codes: FullBoardDropReason[];
  boost_reason_codes: FullBoardBoostReason[];
  major_reason_codes: string[];
  suspicion_label: FullBoardSuspicionLabel;
  why_ranked_there: string[];
};

export type FullBoardWatchlistRow = {
  player_name: string;
  matched: boolean;
  blackbird_rank: number | null;
  market_rank: number | null;
  projection_rank: number | null;
  position_rank: number | null;
  delta_vs_market: number | null;
  delta_vs_projection: number | null;
  why_ranked_there: string[];
  suspicion_label: FullBoardSuspicionLabel | "missing";
};

export type FullBoardRoundMovementSummary = {
  market_round_vs_blackbird_round: Array<{
    player_name: string;
    position: string | null;
    blackbird_round: string;
    market_round: string | null;
    projection_round: string | null;
    market_round_delta: number | null;
    projection_round_delta: number | null;
  }>;
  players_dropped_3_plus_rounds_vs_market: string[];
  players_boosted_3_plus_rounds_vs_market: string[];
  players_dropped_3_plus_rounds_vs_projection: string[];
  players_boosted_3_plus_rounds_vs_projection: string[];
};

export type FullBoardRankIntegrityAuditReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  leagueFormat: string;
  marketFormat: string;
  recommendation: FullBoardRankIntegrityRecommendation;
  rows: FullBoardAuditRow[];
  watchlist: FullBoardWatchlistRow[];
  summary: {
    total_draftable_players: number;
    players_with_adp: number;
    players_without_adp: number;
    players_with_severe_negative_market_deltas: number;
    players_with_severe_positive_market_deltas: number;
    players_with_suspicious_drops: number;
    players_with_suspicious_boosts: number;
    players_with_missing_projections: number;
    players_with_low_trust_in_top_100: number;
    players_with_high_market_rank_but_buried: number;
    players_with_high_projection_rank_but_buried: number;
    legacy_watchlist_excluded_count: number;
    unsupported_position_excluded_count: number;
  };
  positionalBalanceTop100: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
    K: number;
    DST: number;
    IDP: number;
  };
  roundMovement: FullBoardRoundMovementSummary;
  topSuspiciousDrops: FullBoardAuditRow[];
  topSuspiciousBoosts: FullBoardAuditRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  marketAnchorEnabledByDefault: false;
  supabaseWrites: false;
  v82Enabled: false;
};

export type BuildFullBoardRankIntegrityAuditInput = {
  projectionSeason: number;
  leagueFormat?: string;
  marketFormat?: string;
  rows: unknown[];
  legacyWatchlistExcludedCount?: number;
  unsupportedPositionExcludedCount?: number;
};
