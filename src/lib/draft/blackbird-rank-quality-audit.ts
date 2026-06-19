import type { BlackbirdBoardRow } from "./blackbird-board";
import type {
  BlackbirdRankAuditSortSurface,
  BlackbirdRankAuditTopRow,
  BlackbirdRankAuditWatchedPlayer,
  BlackbirdRankBugCode,
  BlackbirdRankQualityAuditReport,
  BuildBlackbirdRankQualityAuditInput,
} from "./blackbird-rank-quality-audit-types";

export const BLACKBIRD_RANK_AUDIT_WATCHLIST = [
  "Ja'Marr Chase",
  "Bijan Robinson",
  "Justin Jefferson",
  "CeeDee Lamb",
  "Saquon Barkley",
  "Jahmyr Gibbs",
  "Amon-Ra St. Brown",
  "Puka Nacua",
  "Malik Nabers",
  "Josh Allen",
  "Lamar Jackson",
  "Jayden Daniels",
  "Joe Burrow",
  "Jalen Hurts",
  "Brock Bowers",
  "Trey McBride",
] as const;

export const BLACKBIRD_RANK_LEGACY_AUDIT_WATCHLIST = [
  "Tom Brady",
  "Drew Brees",
  "Andrew Luck",
  "Ben Roethlisberger",
  "Philip Rivers",
  "Eli Manning",
] as const;

const UNSUPPORTED_DEFAULT_POSITIONS = new Set(["K", "DEF", "DL", "LB", "DB"]);

export function buildBlackbirdRankQualityAudit(input: BuildBlackbirdRankQualityAuditInput): BlackbirdRankQualityAuditReport {
  const sortedRows = [...input.rows].sort((a, b) => a.blackbirdBoardRank - b.blackbirdBoardRank || a.playerName.localeCompare(b.playerName));
  const topN = input.topN ?? 300;
  const top300 = sortedRows.slice(0, topN).map(toAuditRow);
  const watchedPlayers = BLACKBIRD_RANK_AUDIT_WATCHLIST.map((name) => watchedPlayer(name, sortedRows));
  const likelyRankBugs = watchedPlayers.flatMap((player) =>
    player.bug_codes.map((code) => ({
      code,
      player_name: player.player_name,
      detail: player.pushing_down_components.join("; ") || "watchlist threshold failed",
    })),
  );
  const legacyFindings = BLACKBIRD_RANK_LEGACY_AUDIT_WATCHLIST.map((name) => {
    const found = top300.some((row) => normalizedName(row.player_name) === normalizedName(name));
    const excluded = Boolean(input.draftability?.filteredExamples.some((row) => normalizedName(row.player_name ?? "") === normalizedName(name)));
    return {
      player_name: name,
      found_in_draftable_top_300: found,
      excluded_example: excluded,
    };
  });
  const legacyRankBugs = legacyFindings
    .filter((row) => row.found_in_draftable_top_300)
    .map((row) => ({
      code: "legacy_archive_draftable" as const,
      player_name: row.player_name,
      detail: "Legacy watchlist player appeared in draftable top 300.",
    }));
  const unsupportedPositionsPresentInTop300 = [...new Set(top300.map((row) => row.position).filter((position): position is string => typeof position === "string" && UNSUPPORTED_DEFAULT_POSITIONS.has(position)))].sort();
  const allLikelyRankBugs = [...likelyRankBugs, ...legacyRankBugs];
  const verdict = allLikelyRankBugs.length || unsupportedPositionsPresentInTop300.length ? "failed" : "passed";
  const excludedPolicyCounts = input.draftability?.filteredPolicyCounts ?? {};

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.projectionSeason,
    leagueFormat: input.leagueFormat ?? "SUPERFLEX_NO_K",
    verdict,
    recommendation: verdict === "passed" ? "blackbird_rank_quality_passed" : "blackbird_rank_quality_needs_review",
    rowsAudited: sortedRows.length,
    top25: top300.slice(0, 25),
    top50: top300.slice(0, 50),
    top300,
    draftable_top_25: top300.slice(0, 25),
    draftable_top_50: top300.slice(0, 50),
    excluded_legacy_examples: legacyFindings,
    excluded_policy_counts: excludedPolicyCounts,
    blocked_archive_count: countPolicies(excludedPolicyCounts, ["blocked_archive", "policy_blocked_archive"]),
    manual_review_count: countPolicies(excludedPolicyCounts, ["manual_review", "policy_manual_review", "conflict_review"]),
    source_expansion_required_count: countPolicies(excludedPolicyCounts, ["source_expansion_required", "policy_source_expansion_required", "stale_unmatched_review"]),
    shadow_only_count: countPolicies(excludedPolicyCounts, ["shadow_only", "policy_shadow_only"]),
    watchedPlayers,
    likelyRankBugs: allLikelyRankBugs,
    sortSurfaces: buildSortSurfaces(),
    unsupportedPositionsPresentInTop300,
    marketAnchorEnabledByDefault: false,
    supabaseWrites: false,
    v82Enabled: false,
  };
}

export function renderBlackbirdRankQualityAuditMarkdown(report: BlackbirdRankQualityAuditReport): string {
  const lines = [
    "# Blackbird Rank Quality Audit",
    "",
    `Generated: ${report.generatedAt}`,
    `Projection season: ${report.projectionSeason}`,
    `League format: ${report.leagueFormat}`,
    `Verdict: ${report.verdict}`,
    `Recommendation: ${report.recommendation}`,
    "",
    "## Watchlist",
    "",
    ...report.watchedPlayers.map((player) =>
      `- ${player.player_name}: rank ${player.current_rank ?? "missing"} (${player.expected_rough_range}); bugs=${player.bug_codes.join(", ") || "none"}; pushing_down=${player.pushing_down_components.join("; ") || "none"}`,
    ),
    "",
    "## Sort Surfaces",
    "",
    ...report.sortSurfaces.map((surface) => `- ${surface.surface}: ${surface.sort_field} - ${surface.detail}`),
    "",
    "## Top 25",
    "",
    ...report.top25.map((row) => `- #${row.current_blackbird_rank} ${row.player_name} ${row.position ?? ""} ${row.team ?? ""}: proj=${row.projection_points ?? "n/a"}, PAR=${row.points_above_replacement ?? "n/a"}, market=${row.market_order ?? "n/a"}`),
    "",
    "## Draftability Gate",
    "",
    `- Draftable top 25 rows: ${report.draftable_top_25.length}`,
    `- Blocked archive filtered: ${report.blocked_archive_count}`,
    `- Manual review filtered: ${report.manual_review_count}`,
    `- Source expansion required filtered: ${report.source_expansion_required_count}`,
    `- Shadow-only filtered: ${report.shadow_only_count}`,
    `- Legacy watchlist in draftable top 300: ${report.excluded_legacy_examples.filter((row) => row.found_in_draftable_top_300).map((row) => row.player_name).join(", ") || "none"}`,
    "",
    "## Safety",
    "",
    `- Unsupported positions in top 300: ${report.unsupportedPositionsPresentInTop300.join(", ") || "none"}`,
    `- Market anchor enabled by default: ${report.marketAnchorEnabledByDefault}`,
    `- Supabase writes: ${report.supabaseWrites}`,
    `- v8.2 enabled: ${report.v82Enabled}`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

export function renderBlackbirdRankQualityAuditCsv(report: BlackbirdRankQualityAuditReport): string {
  const header: Array<keyof BlackbirdRankAuditTopRow> = [
    "player_name",
    "position",
    "team",
    "current_blackbird_rank",
    "draft_suggestion_rank",
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
    "market_adp",
    "market_order",
    "market_anchor_rank",
    "final_sort_key_used",
    "reason_codes",
  ];
  return [
    header.join(","),
    ...report.top300.map((row) => header.map((key) => csvCell(Array.isArray(row[key]) ? (row[key] as string[]).join("|") : row[key])).join(",")),
  ].join("\n") + "\n";
}

function watchedPlayer(playerName: string, rows: BlackbirdBoardRow[]): BlackbirdRankAuditWatchedPlayer {
  const matches = rows.filter((row) => normalizedName(row.playerName) === normalizedName(playerName));
  const row = chooseBestWatchlistMatch(matches);
  if (!row) {
    return {
      player_name: playerName,
      matched: false,
      current_rank: null,
      expected_rough_range: expectedRange(playerName),
      why_ranked_there: ["No matching eligible board row was found."],
      pushing_down_components: ["missing eligible board row"],
      market_anchor_would_move: null,
      market_anchor_rank: null,
      active_policy_suppression: false,
      trust_risk_fallback_suppression: false,
      bug_codes: ["missing_projection_bug"],
      row: null,
    };
  }

  const bugCodes = bugCodesFor(row, playerName);
  const activePolicy = activePolicyFor(row);
  const marketAnchorRank = marketAnchorRankFor(row);
  return {
    player_name: playerName,
    matched: true,
    current_rank: row.blackbirdBoardRank,
    expected_rough_range: expectedRange(playerName),
    why_ranked_there: whyRanked(row),
    pushing_down_components: pushingDown(row),
    market_anchor_would_move: marketAnchorRank === null ? null : marketAnchorRank !== row.blackbirdBoardRank,
    market_anchor_rank: marketAnchorRank,
    active_policy_suppression: Boolean(activePolicy && !activePolicy.includes("active_candidate") && !activePolicy.includes("active_clear")),
    trust_risk_fallback_suppression: row.projectionTrust.trustLabel === "low" || row.projectionTrust.trustLabel === "very_low" || row.risk === "high" || row.projectionUnit === "fallback",
    bug_codes: bugCodes,
    row: toAuditRow(row),
  };
}

function chooseBestWatchlistMatch(rows: BlackbirdBoardRow[]): BlackbirdBoardRow | null {
  const offensive = rows.filter((row) => ["QB", "RB", "WR", "TE"].includes(row.position ?? ""));
  const pool = offensive.length ? offensive : rows;
  return [...pool].sort((a, b) => a.blackbirdBoardRank - b.blackbirdBoardRank)[0] ?? null;
}

function bugCodesFor(row: BlackbirdBoardRow, playerName: string): BlackbirdRankBugCode[] {
  const codes: BlackbirdRankBugCode[] = [];
  const rank = row.blackbirdBoardRank;
  const market = row.adp ?? row.source.player.rank ?? null;
  const projection = row.projectionPoints;
  const expectedMax = expectedMaxRank(playerName, row.position);
  if (rank > expectedMax) codes.push("elite_player_buried");
  if (projection !== null && rank > 75 && projection >= 250 && row.position !== "QB") codes.push("projection_rank_mismatch");
  if (market !== null && market <= 36 && rank > 60) codes.push("market_rank_mismatch");
  if (row.dataStatus.projection === "unavailable") codes.push("missing_projection_bug");
  if (row.pointsAboveReplacement === null && projection !== null && projection >= 250) codes.push("replacement_value_bug");
  if ((row.projectionTrust.trustLabel === "low" || row.projectionTrust.trustLabel === "very_low") && rank > expectedMax) codes.push("confidence_penalty_too_large");
  if (row.risk === "high" && projection !== null && projection >= 250) codes.push("overweighted_games_or_risk");
  if (UNSUPPORTED_DEFAULT_POSITIONS.has(row.position ?? "")) codes.push("position_eligibility_bug");
  const activePolicy = activePolicyFor(row);
  if (activePolicy && !activePolicy.includes("active_candidate") && !activePolicy.includes("active_clear")) codes.push("active_policy_unexpected_suppression");
  return [...new Set(codes)];
}

function toAuditRow(row: BlackbirdBoardRow): BlackbirdRankAuditTopRow {
  return {
    player_name: row.playerName,
    position: row.position,
    team: row.team,
    current_blackbird_rank: row.blackbirdBoardRank,
    draft_suggestion_rank: row.draftSuggestionRank,
    projection_points: row.projectionPoints,
    projection_ppg: row.projectionPoints === null ? null : round(row.projectionPoints / 17),
    floor: row.projectionLow,
    ceiling: row.projectionHigh,
    points_above_replacement: row.pointsAboveReplacement,
    replacement_value: row.replacementMedianPoints,
    trust: row.projectionTrust.trustLabel,
    confidence: row.confidence,
    risk: row.risk,
    active_policy: activePolicyFor(row),
    market_adp: row.adp,
    market_order: row.source.player.rank ?? row.marketRank,
    market_anchor_rank: marketAnchorRankFor(row),
    final_sort_key_used: "blackbird_rank",
    reason_codes: [...row.contextualReasons, ...row.contextualDataGaps].slice(0, 12),
  };
}

function buildSortSurfaces(): BlackbirdRankAuditSortSurface[] {
  return [
    { surface: "Full Blackbird Rank", sort_field: "blackbird_rank", detail: "Board mode sorts by row.blackbirdBoardRank." },
    { surface: "Available Blackbird Rank", sort_field: "blackbird_rank", detail: "Available mode filters drafted rows, then sorts by row.blackbirdBoardRank." },
    { surface: "Draft Suggestions", sort_field: "draft_suggestion_score", detail: "Draft Suggestions sort by draftSuggestionRank derived from dynamic live suggestion score." },
    { surface: "Draft Signal top player", sort_field: "draft_suggestion_score", detail: "Draft Signal consumes the top live draft suggestion when present." },
    { surface: "Recommended Targets", sort_field: "draft_suggestion_score", detail: "Recommended target surfaces use live recommendation rank/score, not the static board order." },
    { surface: "GM Brief top recommendation", sort_field: "draft_suggestion_score", detail: "GM brief passes draftSuggestions sorted by draftSuggestionRank and full rank separately by blackbirdBoardRank." },
  ];
}

function expectedRange(playerName: string): string {
  if (["Josh Allen", "Lamar Jackson", "Jayden Daniels", "Joe Burrow", "Jalen Hurts"].includes(playerName)) return "top 1-24 in Superflex";
  if (["Brock Bowers", "Trey McBride"].includes(playerName)) return "top 12-60 depending on TE premium";
  return "top 1-36 in most formats, still high in Superflex";
}

function expectedMaxRank(playerName: string, position: string | null): number {
  if (position === "QB") return 36;
  if (position === "TE") return 72;
  if (["Ja'Marr Chase", "Bijan Robinson", "Justin Jefferson", "CeeDee Lamb", "Jahmyr Gibbs"].includes(playerName)) return 36;
  return 60;
}

function whyRanked(row: BlackbirdBoardRow): string[] {
  return [
    `Blackbird rank ${row.blackbirdBoardRank} from static league value score ${row.blackbirdValueScore ?? "n/a"}.`,
    `Projection ${row.projectionPoints ?? "n/a"}; PAR ${row.pointsAboveReplacement ?? "n/a"}.`,
    `Trust ${row.projectionTrust.trustLabel}; confidence ${row.confidence}; risk ${row.risk}.`,
  ];
}

function pushingDown(row: BlackbirdBoardRow): string[] {
  return [
    row.dataStatus.projection === "unavailable" ? "missing projection" : null,
    row.pointsAboveReplacement === null ? "missing replacement value/PAR" : null,
    row.projectionTrust.trustLabel === "low" || row.projectionTrust.trustLabel === "very_low" ? `trust ${row.projectionTrust.trustLabel}` : null,
    row.risk !== "low" ? `risk ${row.risk}` : null,
    row.projectionUnit === "fallback" ? "fallback projection" : null,
    activePolicyFor(row)?.includes("blocked") ? `active policy ${activePolicyFor(row)}` : null,
  ].filter((item): item is string => Boolean(item));
}

function activePolicyFor(row: BlackbirdBoardRow): string | null {
  const player = row.source.player as BlackbirdBoardRow["source"]["player"] & { activePolicyClass?: string | null; active_policy?: string | null; policyGroup?: string | null };
  return player.activePolicyClass ?? player.active_policy ?? player.policyGroup ?? null;
}

function marketAnchorRankFor(row: BlackbirdBoardRow): number | null {
  const preview = row as BlackbirdBoardRow & { marketAnchorPreview?: { marketAnchorRank?: number | null } };
  return preview.marketAnchorPreview?.marketAnchorRank ?? null;
}

function countPolicies(counts: Record<string, number>, tokens: string[]): number {
  return Object.entries(counts).reduce((total, [policy, count]) => {
    return tokens.some((token) => policy.includes(token)) ? total + count : total;
  }, 0);
}

function normalizedName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
