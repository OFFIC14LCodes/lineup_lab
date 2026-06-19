import type { BlackbirdBoardRow } from "./blackbird-board";
import { BLACKBIRD_RANK_LEGACY_AUDIT_WATCHLIST } from "./blackbird-rank-quality-audit";
import type {
  BuildFullBoardRankIntegrityAuditInput,
  FullBoardAuditRow,
  FullBoardBoostReason,
  FullBoardDeltaSeverity,
  FullBoardDisagreement,
  FullBoardDropReason,
  FullBoardRankIntegrityAuditReport,
  FullBoardRankIntegrityRecommendation,
  FullBoardSuspicionLabel,
  FullBoardWatchlistRow,
} from "./full-board-rank-integrity-audit-types";

const WATCHLIST = [
  "Ja'Marr Chase",
  "Bijan Robinson",
  "Justin Jefferson",
  "Saquon Barkley",
  "Jahmyr Gibbs",
  "CeeDee Lamb",
  "Amon-Ra St. Brown",
  "Puka Nacua",
  "Malik Nabers",
  "Nico Collins",
  "Brian Thomas",
  "Drake London",
  "Brock Bowers",
  "Trey McBride",
  "Josh Allen",
  "Lamar Jackson",
  "Jayden Daniels",
  "Joe Burrow",
  "Jalen Hurts",
  "Patrick Mahomes",
] as const;

const UNSUPPORTED_POSITIONS = new Set(["K", "DEF", "DST", "DL", "LB", "DB"]);
const IDP_POSITIONS = new Set(["DL", "LB", "DB"]);

type FullBoardSourcePlayer = BlackbirdBoardRow["source"]["player"] & {
  activePolicyClass?: string | null;
  active_policy?: string | null;
  policyGroup?: string | null;
  marketRank?: number | null;
  marketFormat?: string | null;
  marketMatchType?: string | null;
  externalMarketMatchConfidence?: string | null;
  marketAnchorRank?: number | null;
};

export function buildFullBoardRankIntegrityAudit(input: BuildFullBoardRankIntegrityAuditInput): FullBoardRankIntegrityAuditReport {
  const rows = (input.rows as BlackbirdBoardRow[])
    .filter((row) => !row.drafted)
    .sort((a, b) => a.blackbirdBoardRank - b.blackbirdBoardRank || a.playerName.localeCompare(b.playerName));
  const projectionRanks = rankBy(rows, (row) => row.projectionPoints);
  const projectionPpgRanks = rankBy(rows, (row) => projectionPpg(row));
  const parRanks = rankBy(rows, (row) => row.pointsAboveReplacement);
  const positionRanks = rankByPosition(rows);
  const marketPositionRanks = rankMarketByPosition(rows);
  const auditRows = rows.map((row) => toAuditRow(row, {
    projectionRank: projectionRanks.get(rowKey(row)) ?? null,
    projectionPpgRank: projectionPpgRanks.get(rowKey(row)) ?? null,
    parRank: parRanks.get(rowKey(row)) ?? null,
    positionRank: positionRanks.get(rowKey(row)) ?? null,
    marketPositionRank: marketPositionRanks.get(rowKey(row)) ?? null,
    marketFormat: input.marketFormat ?? "SUPERFLEX",
  }));
  const watchlist = WATCHLIST.map((name) => watchlistRow(name, auditRows));
  const positionalBalanceTop100 = buildPositionalBalance(auditRows.slice(0, 100));
  const roundMovement = buildRoundMovement(auditRows);
  const summary = buildSummary(auditRows, {
    legacyWatchlistExcludedCount: input.legacyWatchlistExcludedCount ?? 0,
    unsupportedPositionExcludedCount: input.unsupportedPositionExcludedCount ?? 0,
  });
  const blockingLeakage = auditRows.some((row) => row.suspicion_label === "blocked_bug");
  const recommendation = recommend({ rows: auditRows, summary, blockingLeakage });

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.projectionSeason,
    leagueFormat: input.leagueFormat ?? "SUPERFLEX_NO_K",
    marketFormat: input.marketFormat ?? "SUPERFLEX",
    recommendation,
    rows: auditRows,
    watchlist,
    summary,
    positionalBalanceTop100,
    roundMovement,
    topSuspiciousDrops: auditRows.filter((row) => isSuspiciousDrop(row)).slice(0, 25),
    topSuspiciousBoosts: auditRows.filter((row) => isSuspiciousBoost(row)).slice(0, 25),
    safetyGates: [
      { name: "dry_run_only", passed: true, detail: "Audit reads local artifacts and writes local report files only." },
      { name: "no_supabase_writes", passed: true, detail: "No Supabase client is imported or called." },
      { name: "v8_2_not_enabled", passed: true, detail: "Audit does not read or write v8.2 feature flags." },
      { name: "market_anchor_default_disabled", passed: true, detail: "Market Anchor remains preview/reference-only and disabled by default." },
      { name: "no_blocking_legacy_or_unsupported_leakage", passed: !blockingLeakage, detail: blockingLeakage ? "Blocked player appeared in draftable board." : "No blocked legacy or unsupported-position leakage detected." },
    ],
    marketAnchorEnabledByDefault: false,
    supabaseWrites: false,
    v82Enabled: false,
  };
}

export function renderFullBoardRankIntegrityMarkdown(report: FullBoardRankIntegrityAuditReport): string {
  const lines = [
    "# Full Board Rank Integrity Audit",
    "",
    `Generated: ${report.generatedAt}`,
    `Projection season: ${report.projectionSeason}`,
    `League format: ${report.leagueFormat}`,
    `Market format: ${report.marketFormat}`,
    `Recommendation: ${report.recommendation}`,
    "",
    "## Summary",
    "",
    ...Object.entries(report.summary).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Positional Balance Top 100",
    "",
    ...Object.entries(report.positionalBalanceTop100).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Top Suspicious Drops",
    "",
    ...report.topSuspiciousDrops.slice(0, 15).map((row) => `- #${row.draftable_rank} ${row.player_name} ${row.position ?? ""}: market=${row.market_order ?? "n/a"}, projection=${row.projection_rank ?? "n/a"}, delta_market=${row.rank_delta_vs_market ?? "n/a"}, reasons=${row.drop_reason_codes.join("|") || "none"}, label=${row.suspicion_label}`),
    "",
    "## Top Suspicious Boosts",
    "",
    ...report.topSuspiciousBoosts.slice(0, 15).map((row) => `- #${row.draftable_rank} ${row.player_name} ${row.position ?? ""}: market=${row.market_order ?? "n/a"}, projection=${row.projection_rank ?? "n/a"}, delta_market=${row.rank_delta_vs_market ?? "n/a"}, reasons=${row.boost_reason_codes.join("|") || "none"}, label=${row.suspicion_label}`),
    "",
    "## Watchlist",
    "",
    ...report.watchlist.map((row) => `- ${row.player_name}: blackbird=${row.blackbird_rank ?? "missing"}, market=${row.market_rank ?? "n/a"}, projection=${row.projection_rank ?? "n/a"}, position=${row.position_rank ?? "n/a"}, delta_market=${row.delta_vs_market ?? "n/a"}, label=${row.suspicion_label}`),
    "",
    "## Round Movement",
    "",
    `- Dropped 3+ rounds vs market: ${report.roundMovement.players_dropped_3_plus_rounds_vs_market.slice(0, 20).join(", ") || "none"}`,
    `- Boosted 3+ rounds vs market: ${report.roundMovement.players_boosted_3_plus_rounds_vs_market.slice(0, 20).join(", ") || "none"}`,
    `- Dropped 3+ rounds vs projection: ${report.roundMovement.players_dropped_3_plus_rounds_vs_projection.slice(0, 20).join(", ") || "none"}`,
    `- Boosted 3+ rounds vs projection: ${report.roundMovement.players_boosted_3_plus_rounds_vs_projection.slice(0, 20).join(", ") || "none"}`,
    "",
    "## Safety",
    "",
    ...report.safetyGates.map((gate) => `- ${gate.name}: ${gate.passed ? "pass" : "fail"} - ${gate.detail}`),
    `- Market anchor enabled by default: ${report.marketAnchorEnabledByDefault}`,
    `- Supabase writes: ${report.supabaseWrites}`,
    `- v8.2 enabled: ${report.v82Enabled}`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

export function renderFullBoardRankIntegrityCsv(report: FullBoardRankIntegrityAuditReport): string {
  const header: Array<keyof FullBoardAuditRow> = [
    "player_name",
    "position",
    "team",
    "draftable_rank",
    "position_rank",
    "projection_rank",
    "projection_points",
    "projection_ppg",
    "floor",
    "ceiling",
    "points_above_replacement",
    "replacement_value",
    "trust",
    "confidence",
    "risk",
    "active_policy",
    "draftability_status",
    "market_adp",
    "market_order",
    "market_position_rank",
    "market_format",
    "market_match_type",
    "market_anchor_preview_rank",
    "rank_delta_vs_market",
    "rank_delta_vs_projection",
    "rank_delta_vs_position_expectation",
    "final_sort_key_used",
    "major_reason_codes",
    "suspicion_label",
  ];
  return [
    header.join(","),
    ...report.rows.map((row) => header.map((key) => csvCell(Array.isArray(row[key]) ? (row[key] as string[]).join("|") : row[key])).join(",")),
  ].join("\n") + "\n";
}

function toAuditRow(
  row: BlackbirdBoardRow,
  ranks: { projectionRank: number | null; projectionPpgRank: number | null; parRank: number | null; positionRank: number | null; marketPositionRank: number | null; marketFormat: string },
): FullBoardAuditRow {
  const sourcePlayer = row.source.player as FullBoardSourcePlayer;
  const marketOrder = numberOrNull(sourcePlayer.marketRank) ?? numberOrNull(row.adp);
  const marketAnchorPreviewRank = marketAnchorPreviewRankFor(row, sourcePlayer);
  const activePolicy = sourcePlayer.activePolicyClass ?? sourcePlayer.active_policy ?? sourcePlayer.policyGroup ?? null;
  const rankDeltaVsMarket = delta(row.blackbirdBoardRank, marketOrder);
  const rankDeltaVsProjection = delta(row.blackbirdBoardRank, ranks.projectionRank);
  const rankDeltaVsPosition = delta(ranks.positionRank, ranks.marketPositionRank);
  const disagreements = disagreementsFor({ rankDeltaVsMarket, rankDeltaVsProjection, rankDeltaVsPosition });
  const dropReasons = dropReasonsFor(row, { marketOrder, projectionRank: ranks.projectionRank, rankDeltaVsMarket, rankDeltaVsProjection, activePolicy });
  const boostReasons = boostReasonsFor(row, { marketOrder, projectionRank: ranks.projectionRank, rankDeltaVsMarket, rankDeltaVsProjection, marketAnchorPreviewRank });
  const suspicion = suspicionFor(row, { rankDeltaVsMarket, rankDeltaVsProjection, marketOrder, projectionRank: ranks.projectionRank, dropReasons, boostReasons, activePolicy });
  return {
    player_name: row.playerName,
    position: row.position,
    team: row.team,
    draftable_rank: row.blackbirdBoardRank,
    position_rank: ranks.positionRank,
    projection_rank: ranks.projectionRank,
    projection_ppg_rank: ranks.projectionPpgRank,
    projection_points: row.projectionPoints,
    projection_ppg: projectionPpg(row),
    floor: row.projectionLow,
    ceiling: row.projectionHigh,
    points_above_replacement: row.pointsAboveReplacement,
    replacement_value: row.replacementMedianPoints,
    par_rank: ranks.parRank,
    trust: row.projectionTrust.trustLabel,
    confidence: row.confidence,
    risk: row.risk,
    active_policy: activePolicy,
    draftability_status: "draftable",
    market_adp: row.adp,
    market_order: marketOrder,
    market_position_rank: ranks.marketPositionRank,
    market_format: sourcePlayer.marketFormat ?? ranks.marketFormat,
    market_match_type: sourcePlayer.marketMatchType ?? sourcePlayer.externalMarketMatchConfidence ?? null,
    market_anchor_preview_rank: marketAnchorPreviewRank,
    rank_delta_vs_market: rankDeltaVsMarket,
    rank_delta_vs_projection: rankDeltaVsProjection,
    rank_delta_vs_projection_ppg: delta(row.blackbirdBoardRank, ranks.projectionPpgRank),
    rank_delta_vs_position_expectation: rankDeltaVsPosition,
    final_sort_key_used: "blackbird_rank",
    delta_severity_vs_market: severity(rankDeltaVsMarket),
    delta_severity_vs_projection: severity(rankDeltaVsProjection),
    disagreements,
    drop_reason_codes: dropReasons,
    boost_reason_codes: boostReasons,
    major_reason_codes: [...new Set([...dropReasons, ...boostReasons, ...row.contextualReasons, ...row.contextualDataGaps])].slice(0, 16),
    suspicion_label: suspicion,
    why_ranked_there: whyRanked(row),
  };
}

function disagreementsFor(input: { rankDeltaVsMarket: number | null; rankDeltaVsProjection: number | null; rankDeltaVsPosition: number | null }): FullBoardDisagreement[] {
  const disagreements: FullBoardDisagreement[] = [];
  if ((input.rankDeltaVsMarket ?? 0) >= 25) disagreements.push("blackbird_much_lower_than_market");
  if ((input.rankDeltaVsMarket ?? 0) <= -25) disagreements.push("blackbird_much_higher_than_market");
  if ((input.rankDeltaVsProjection ?? 0) >= 25) disagreements.push("blackbird_much_lower_than_projection");
  if ((input.rankDeltaVsProjection ?? 0) <= -25) disagreements.push("blackbird_much_higher_than_projection");
  if ((input.rankDeltaVsPosition ?? 0) >= 25) disagreements.push("blackbird_much_lower_than_position_tier");
  if ((input.rankDeltaVsPosition ?? 0) <= -25) disagreements.push("blackbird_much_higher_than_position_tier");
  return disagreements;
}

function dropReasonsFor(row: BlackbirdBoardRow, input: { marketOrder: number | null; projectionRank: number | null; rankDeltaVsMarket: number | null; rankDeltaVsProjection: number | null; activePolicy: string | null }): FullBoardDropReason[] {
  const reasons: FullBoardDropReason[] = [];
  if (row.projectionTrust.trustLabel === "low" || row.projectionTrust.trustLabel === "very_low") reasons.push("low_trust_penalty");
  if (row.risk === "high") reasons.push("injury_risk_penalty");
  if (input.activePolicy && !input.activePolicy.includes("active_candidate") && !input.activePolicy.includes("active")) reasons.push("active_policy_penalty");
  if (input.activePolicy?.includes("source_expansion") || input.activePolicy?.includes("manual_review")) reasons.push("source_expansion_or_manual_review");
  if (row.projectionPoints !== null && row.projectionPoints < 160) reasons.push("low_projection_points");
  if (projectionPpg(row) !== null && (projectionPpg(row) ?? 0) < 10) reasons.push("low_projection_ppg");
  if (row.pointsAboveReplacement !== null && row.pointsAboveReplacement < 0) reasons.push("poor_replacement_value");
  if (row.contextualDataGaps.length > 0 || row.dataStatus.projection === "unavailable") reasons.push("data_gap_penalty");
  if (input.rankDeltaVsMarket !== null && input.rankDeltaVsMarket >= 25) reasons.push("market_disagreement");
  if (row.position !== "QB" && input.rankDeltaVsMarket !== null && input.rankDeltaVsMarket >= 50) reasons.push("superflex_qb_pushdown_side_effect");
  if (input.marketOrder !== null && input.marketOrder <= 36 && input.rankDeltaVsMarket !== null && input.rankDeltaVsMarket >= 50 && row.projectionTrust.trustLabel !== "low" && row.projectionTrust.trustLabel !== "very_low") reasons.push("possible_over_penalized_elite");
  if (input.projectionRank !== null && input.projectionRank <= 36 && input.rankDeltaVsProjection !== null && input.rankDeltaVsProjection >= 75) reasons.push("possible_wrong_sort_field");
  if (row.position && ["RB", "WR", "TE"].includes(row.position) && input.rankDeltaVsMarket !== null && input.rankDeltaVsMarket >= 25) reasons.push("position_scarcity_adjustment");
  return [...new Set(reasons)];
}

function boostReasonsFor(row: BlackbirdBoardRow, input: { marketOrder: number | null; projectionRank: number | null; rankDeltaVsMarket: number | null; rankDeltaVsProjection: number | null; marketAnchorPreviewRank: number | null }): FullBoardBoostReason[] {
  const reasons: FullBoardBoostReason[] = [];
  if ((row.projectionPoints ?? 0) >= 280) reasons.push("high_projection_points");
  if ((projectionPpg(row) ?? 0) >= 16) reasons.push("high_projection_ppg");
  if ((row.pointsAboveReplacement ?? 0) >= 40) reasons.push("high_replacement_value");
  if (row.position === "QB" && row.blackbirdBoardRank <= 36) reasons.push("superflex_qb_premium");
  if (row.blackbirdTier !== null && row.blackbirdTier <= 2) reasons.push("scarcity_boost");
  if (row.confidence === "high" || row.projectionTrust.trustLabel === "high") reasons.push("high_confidence_boost");
  if (input.marketAnchorPreviewRank !== null && input.marketAnchorPreviewRank <= row.blackbirdBoardRank) reasons.push("market_anchor_support");
  if (row.role || row.roleConfidence === "high") reasons.push("role_or_context_boost");
  if ((row.projectionTrust.trustLabel === "low" || row.projectionTrust.trustLabel === "very_low") && row.blackbirdBoardRank <= 100) reasons.push("possible_over_promoted_low_trust");
  if (BLACKBIRD_RANK_LEGACY_AUDIT_WATCHLIST.some((name) => normalizedName(name) === normalizedName(row.playerName))) reasons.push("possible_legacy_leak");
  if (row.blackbirdBoardRank <= 300 && input.projectionRank !== null && input.rankDeltaVsProjection !== null && input.rankDeltaVsProjection <= -75 && row.projectionPoints !== null && row.projectionPoints < 180) reasons.push("possible_wrong_sort_field");
  return [...new Set(reasons)];
}

function suspicionFor(row: BlackbirdBoardRow, input: { rankDeltaVsMarket: number | null; rankDeltaVsProjection: number | null; marketOrder: number | null; projectionRank: number | null; dropReasons: FullBoardDropReason[]; boostReasons: FullBoardBoostReason[]; activePolicy: string | null }): FullBoardSuspicionLabel {
  if (UNSUPPORTED_POSITIONS.has(row.position ?? "") || input.boostReasons.includes("possible_legacy_leak")) return "blocked_bug";
  if (input.activePolicy && !input.activePolicy.includes("active_candidate") && !input.activePolicy.includes("active")) return "justified";
  if (input.dropReasons.includes("possible_over_penalized_elite") || input.boostReasons.includes("possible_wrong_sort_field")) return "suspicious";
  if (input.marketOrder !== null && input.marketOrder <= 36 && (input.rankDeltaVsMarket ?? 0) >= 80 && row.projectionTrust.trustLabel !== "low" && row.projectionTrust.trustLabel !== "very_low") return "suspicious";
  if (input.projectionRank !== null && input.projectionRank <= 36 && (input.rankDeltaVsProjection ?? 0) >= 80) return "suspicious";
  if (input.boostReasons.includes("possible_over_promoted_low_trust")) {
    const marketBoost = input.rankDeltaVsMarket !== null && input.rankDeltaVsMarket <= -50;
    const projectionBoost = input.rankDeltaVsProjection !== null && input.rankDeltaVsProjection <= -50;
    return row.blackbirdBoardRank <= 50 && (marketBoost || projectionBoost) ? "suspicious" : "needs_review";
  }
  if (Math.abs(input.rankDeltaVsMarket ?? 0) >= 100 || Math.abs(input.rankDeltaVsProjection ?? 0) >= 100) return "needs_review";
  if (input.dropReasons.some((reason) => reason === "low_trust_penalty" || reason === "data_gap_penalty" || reason === "poor_replacement_value")) return "probably_justified";
  return "justified";
}

function buildSummary(rows: FullBoardAuditRow[], input: { legacyWatchlistExcludedCount: number; unsupportedPositionExcludedCount: number }): FullBoardRankIntegrityAuditReport["summary"] {
  return {
    total_draftable_players: rows.length,
    players_with_adp: rows.filter((row) => row.market_order !== null).length,
    players_without_adp: rows.filter((row) => row.market_order === null).length,
    players_with_severe_negative_market_deltas: rows.filter((row) => (row.rank_delta_vs_market ?? 0) >= 100).length,
    players_with_severe_positive_market_deltas: rows.filter((row) => (row.rank_delta_vs_market ?? 0) <= -100).length,
    players_with_suspicious_drops: rows.filter(isSuspiciousDrop).length,
    players_with_suspicious_boosts: rows.filter(isSuspiciousBoost).length,
    players_with_missing_projections: rows.filter((row) => row.projection_points === null).length,
    players_with_low_trust_in_top_100: rows.filter((row) => row.draftable_rank <= 100 && (row.trust === "low" || row.trust === "very_low")).length,
    players_with_high_market_rank_but_buried: rows.filter((row) => (row.market_order ?? 999999) <= 36 && (row.rank_delta_vs_market ?? 0) >= 50).length,
    players_with_high_projection_rank_but_buried: rows.filter((row) => (row.projection_rank ?? 999999) <= 36 && (row.rank_delta_vs_projection ?? 0) >= 50).length,
    legacy_watchlist_excluded_count: input.legacyWatchlistExcludedCount,
    unsupported_position_excluded_count: input.unsupportedPositionExcludedCount,
  };
}

function buildPositionalBalance(rows: FullBoardAuditRow[]): FullBoardRankIntegrityAuditReport["positionalBalanceTop100"] {
  return {
    QB: rows.filter((row) => row.position === "QB").length,
    RB: rows.filter((row) => row.position === "RB").length,
    WR: rows.filter((row) => row.position === "WR").length,
    TE: rows.filter((row) => row.position === "TE").length,
    K: rows.filter((row) => row.position === "K").length,
    DST: rows.filter((row) => row.position === "DEF" || row.position === "DST").length,
    IDP: rows.filter((row) => IDP_POSITIONS.has(row.position ?? "")).length,
  };
}

function buildRoundMovement(rows: FullBoardAuditRow[]): FullBoardRankIntegrityAuditReport["roundMovement"] {
  const movement = rows.map((row) => {
    const blackbirdRoundNumber = roundNumber(row.draftable_rank);
    const marketRoundNumber = row.market_order === null ? null : roundNumber(row.market_order);
    const projectionRoundNumber = row.projection_rank === null ? null : roundNumber(row.projection_rank);
    return {
      player_name: row.player_name,
      position: row.position,
      blackbird_round: roundLabel(row.draftable_rank),
      market_round: row.market_order === null ? null : roundLabel(row.market_order),
      projection_round: row.projection_rank === null ? null : roundLabel(row.projection_rank),
      market_round_delta: marketRoundNumber === null ? null : blackbirdRoundNumber - marketRoundNumber,
      projection_round_delta: projectionRoundNumber === null ? null : blackbirdRoundNumber - projectionRoundNumber,
    };
  });
  return {
    market_round_vs_blackbird_round: movement,
    players_dropped_3_plus_rounds_vs_market: movement.filter((row) => (row.market_round_delta ?? 0) >= 3).map((row) => row.player_name),
    players_boosted_3_plus_rounds_vs_market: movement.filter((row) => (row.market_round_delta ?? 0) <= -3).map((row) => row.player_name),
    players_dropped_3_plus_rounds_vs_projection: movement.filter((row) => (row.projection_round_delta ?? 0) >= 3).map((row) => row.player_name),
    players_boosted_3_plus_rounds_vs_projection: movement.filter((row) => (row.projection_round_delta ?? 0) <= -3).map((row) => row.player_name),
  };
}

function recommend(input: { rows: FullBoardAuditRow[]; summary: FullBoardRankIntegrityAuditReport["summary"]; blockingLeakage: boolean }): FullBoardRankIntegrityRecommendation {
  if (!input.rows.length) return "full_board_rank_blocked";
  if (input.blockingLeakage) return "full_board_rank_has_blocking_leakage";
  if (input.summary.players_with_missing_projections > input.rows.length * 0.2 || input.summary.players_with_low_trust_in_top_100 > 25) return "full_board_rank_needs_data_fix";
  if (input.summary.players_with_suspicious_drops >= 10 || input.summary.players_with_suspicious_boosts >= 10) return "full_board_rank_needs_formula_tuning";
  return "full_board_rank_ready_for_manual_review";
}

function watchlistRow(playerName: string, rows: FullBoardAuditRow[]): FullBoardWatchlistRow {
  const row = rows.find((candidate) => normalizedName(candidate.player_name) === normalizedName(playerName));
  if (!row) {
    return {
      player_name: playerName,
      matched: false,
      blackbird_rank: null,
      market_rank: null,
      projection_rank: null,
      position_rank: null,
      delta_vs_market: null,
      delta_vs_projection: null,
      why_ranked_there: ["No matching draftable row was found."],
      suspicion_label: "missing",
    };
  }
  return {
    player_name: playerName,
    matched: true,
    blackbird_rank: row.draftable_rank,
    market_rank: row.market_order,
    projection_rank: row.projection_rank,
    position_rank: row.position_rank,
    delta_vs_market: row.rank_delta_vs_market,
    delta_vs_projection: row.rank_delta_vs_projection,
    why_ranked_there: row.why_ranked_there,
    suspicion_label: row.suspicion_label,
  };
}

function rankBy(rows: BlackbirdBoardRow[], valueFor: (row: BlackbirdBoardRow) => number | null | undefined): Map<string, number> {
  const ranked = rows
    .filter((row) => numberOrNull(valueFor(row)) !== null)
    .sort((a, b) => (numberOrNull(valueFor(b)) ?? 0) - (numberOrNull(valueFor(a)) ?? 0) || a.blackbirdBoardRank - b.blackbirdBoardRank);
  return new Map(ranked.map((row, index) => [rowKey(row), index + 1]));
}

function rankByPosition(rows: BlackbirdBoardRow[]): Map<string, number> {
  const rank = new Map<string, number>();
  for (const position of new Set(rows.map((row) => row.position ?? "UNK"))) {
    rows.filter((row) => (row.position ?? "UNK") === position)
      .sort((a, b) => a.blackbirdBoardRank - b.blackbirdBoardRank)
      .forEach((row, index) => rank.set(rowKey(row), index + 1));
  }
  return rank;
}

function rankMarketByPosition(rows: BlackbirdBoardRow[]): Map<string, number> {
  const rank = new Map<string, number>();
  for (const position of new Set(rows.map((row) => row.position ?? "UNK"))) {
    rows.filter((row) => (row.position ?? "UNK") === position && marketOrderFor(row) !== null)
      .sort((a, b) => (marketOrderFor(a) ?? 999999) - (marketOrderFor(b) ?? 999999))
      .forEach((row, index) => rank.set(rowKey(row), index + 1));
  }
  return rank;
}

function marketOrderFor(row: BlackbirdBoardRow): number | null {
  const player = row.source.player as FullBoardSourcePlayer;
  return numberOrNull(player.marketRank) ?? numberOrNull(row.adp);
}

function projectionPpg(row: BlackbirdBoardRow): number | null {
  return row.projectionPoints === null ? null : round(row.projectionPoints / 17);
}

function delta(blackbirdRank: number | null, baselineRank: number | null): number | null {
  if (blackbirdRank === null || baselineRank === null) return null;
  return blackbirdRank - baselineRank;
}

function severity(deltaValue: number | null): FullBoardDeltaSeverity {
  const magnitude = Math.abs(deltaValue ?? 0);
  if (magnitude >= 100) return "severe";
  if (magnitude >= 50) return "major";
  if (magnitude >= 25) return "moderate";
  if (magnitude >= 12) return "minor";
  return "none";
}

function marketAnchorPreviewRankFor(row: BlackbirdBoardRow, sourcePlayer: FullBoardSourcePlayer): number | null {
  const preview = row as BlackbirdBoardRow & { marketAnchorPreview?: { marketAnchorRank?: number | null } };
  return preview.marketAnchorPreview?.marketAnchorRank ?? sourcePlayer.marketAnchorRank ?? null;
}

function isSuspiciousDrop(row: FullBoardAuditRow): boolean {
  return row.suspicion_label === "suspicious" && ((row.rank_delta_vs_market ?? 0) >= 25 || (row.rank_delta_vs_projection ?? 0) >= 25);
}

function isSuspiciousBoost(row: FullBoardAuditRow): boolean {
  return row.suspicion_label === "suspicious" && ((row.rank_delta_vs_market ?? 0) <= -25 || (row.rank_delta_vs_projection ?? 0) <= -25);
}

function roundNumber(rank: number): number {
  return Math.max(1, Math.ceil(rank / 12));
}

function roundLabel(rank: number): string {
  const round = roundNumber(rank);
  if (round <= 5) return `Round ${round}`;
  if (round <= 10) return "Round 6-10";
  return "Round 11+";
}

function whyRanked(row: BlackbirdBoardRow): string[] {
  return [
    `Blackbird rank ${row.blackbirdBoardRank}; value score ${row.blackbirdValueScore ?? "n/a"}.`,
    `Projection ${row.projectionPoints ?? "n/a"}; PAR ${row.pointsAboveReplacement ?? "n/a"}.`,
    `Trust ${row.projectionTrust.trustLabel}; confidence ${row.confidence}; risk ${row.risk}.`,
  ];
}

function rowKey(row: Pick<BlackbirdBoardRow, "playerId" | "playerName" | "position" | "team">): string {
  return `${row.playerId ?? ""}|${normalizedName(row.playerName)}|${row.position ?? ""}|${row.team ?? ""}`;
}

function normalizedName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
