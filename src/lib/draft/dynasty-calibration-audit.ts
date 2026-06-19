import type { BlackbirdBoardRow } from "./blackbird-board";
import type { DynastyCalibrationAuditReport, DynastyCalibrationAuditRow, DynastyCalibrationRecommendation } from "./dynasty-calibration-audit-types";

export const DYNASTY_RB_WATCHLIST = [
  "Jonathan Taylor",
  "Derrick Henry",
  "Christian McCaffrey",
  "Saquon Barkley",
  "Josh Jacobs",
  "James Cook",
  "Kyren Williams",
  "Bijan Robinson",
  "Jahmyr Gibbs",
  "De'Von Achane",
  "Ashton Jeanty",
  "Bucky Irving",
  "Chase Brown",
  "Omarion Hampton",
];

export const DYNASTY_TE_WATCHLIST = [
  "Brock Bowers",
  "Trey McBride",
  "Sam LaPorta",
  "George Kittle",
  "Travis Kelce",
  "T.J. Hockenson",
  "Mark Andrews",
  "Colston Loveland",
  "Tyler Warren",
  "Harold Fannin",
];

export const DYNASTY_ASSET_WATCHLIST = [
  "Josh Allen",
  "Jalen Hurts",
  "Lamar Jackson",
  "Patrick Mahomes",
  "Jayden Daniels",
  "Joe Burrow",
  "Puka Nacua",
  "Ja'Marr Chase",
  "Amon-Ra St. Brown",
  "Justin Jefferson",
  "CeeDee Lamb",
  "Malik Nabers",
  "Brian Thomas",
  "Drake London",
  "Nico Collins",
  "Jahmyr Gibbs",
  "Bijan Robinson",
  "Saquon Barkley",
  "Jonathan Taylor",
  "Christian McCaffrey",
  "Derrick Henry",
  "Brock Bowers",
  "Trey McBride",
  "Sam LaPorta",
  "Travis Kelce",
];

export function buildDynastyCalibrationAudit(input: {
  projectionSeason: number;
  marketFormat: string;
  beforeRows: BlackbirdBoardRow[];
  afterRows: BlackbirdBoardRow[];
  unsupportedPlayersFiltered: number;
  unsupportedPositionsFiltered: string[];
}): DynastyCalibrationAuditReport {
  const beforeByName = new Map(input.beforeRows.map((row) => [normalizedName(row.playerName), row]));
  const beforePositionRanks = positionRankMap(input.beforeRows);
  const afterPositionRanks = positionRankMap(input.afterRows);
  const rows = input.afterRows.map((row) => toAuditRow(row, beforeByName.get(normalizedName(row.playerName)) ?? null, beforePositionRanks, afterPositionRanks));
  const top50 = rows.slice(0, 50);
  const rbComparison = pickWatchlist(rows, DYNASTY_RB_WATCHLIST);
  const teComparison = pickWatchlist(rows, DYNASTY_TE_WATCHLIST);
  const watchlist = pickWatchlist(rows, DYNASTY_ASSET_WATCHLIST);
  const top50RowsWithAge = top50.filter((row) => row.age !== null).length;
  const henry = rows.find((row) => normalizedName(row.playerName) === normalizedName("Derrick Henry"));
  const taylor = rows.find((row) => normalizedName(row.playerName) === normalizedName("Jonathan Taylor"));
  const bowers = rows.find((row) => normalizedName(row.playerName) === normalizedName("Brock Bowers"));
  const mcbride = rows.find((row) => normalizedName(row.playerName) === normalizedName("Trey McBride"));
  const henryTaylorResolved = Boolean(taylor?.afterRank && henry?.afterRank && taylor.afterRank < henry.afterRank);
  const bowersExplainable = Boolean(
    bowers &&
      bowers.dynastyAssetScore !== null &&
      bowers.runwayScore !== null &&
      bowers.runwayScore >= 85 &&
      (mcbride?.afterRank === null || bowers.afterRank !== null)
  );
  const recommendation = recommendationFor({
    rows,
    top50RowsWithAge,
    henryTaylorResolved,
    bowersExplainable,
  });

  return {
    dryRun: true,
    readOnly: true,
    projectionSeason: input.projectionSeason,
    marketFormat: input.marketFormat,
    recommendation,
    summary: {
      rowsAudited: rows.length,
      rowsWithAge: rows.filter((row) => row.age !== null).length,
      top50RowsWithAge,
      top50AgeCoverageRate: top50.length ? round2(top50RowsWithAge / top50.length) : 0,
      henryTaylorResolved,
      bowersExplainable,
      unsupportedPlayersFiltered: input.unsupportedPlayersFiltered,
      unsupportedPositionsFiltered: input.unsupportedPositionsFiltered,
    },
    rbComparison,
    teComparison,
    watchlist,
    top50,
    rows,
  };
}

export function renderDynastyCalibrationAuditMarkdown(report: DynastyCalibrationAuditReport): string {
  return [
    `# Dynasty Calibration Audit - ${report.projectionSeason}`,
    "",
    `- Dry run: ${report.dryRun}`,
    `- Read only: ${report.readOnly}`,
    `- Market format: ${report.marketFormat}`,
    `- Recommendation: ${report.recommendation}`,
    `- Top 50 age coverage: ${report.summary.top50RowsWithAge}/50 (${Math.round(report.summary.top50AgeCoverageRate * 100)}%)`,
    `- Jonathan Taylor over Derrick Henry: ${report.summary.henryTaylorResolved}`,
    `- Brock Bowers explainable: ${report.summary.bowersExplainable}`,
    `- Unsupported positions filtered: ${report.summary.unsupportedPositionsFiltered.join(", ") || "none"} (${report.summary.unsupportedPlayersFiltered})`,
    "",
    "## RB Calibration",
    "",
    table(report.rbComparison),
    "",
    "## TE Premium Calibration",
    "",
    table(report.teComparison),
    "",
    "## Watchlist",
    "",
    table(report.watchlist),
    "",
    "## Top 50",
    "",
    table(report.top50),
    "",
  ].join("\n");
}

export function renderDynastyCalibrationAuditCsv(rows: DynastyCalibrationAuditRow[]): string {
  const headers = [
    "after_rank",
    "before_rank",
    "player_name",
    "position",
    "team",
    "before_position_rank",
    "after_position_rank",
    "age",
    "age_phase",
    "runway_score",
    "projection_points",
    "projection_value",
    "replacement_value",
    "scarcity_value",
    "format_premium",
    "age_runway_value",
    "short_term_window_score",
    "runway_penalty",
    "age_cliff_penalty",
    "veteran_production_cushion",
    "age_penalty_was_smoothed",
    "age_reason",
    "elite_young_te_profile",
    "te_premium_scarcity_boost",
    "te_runway_boost",
    "te_market_sanity_context",
    "risk_adjustment",
    "trust_adjustment",
    "market_sanity_adjustment",
    "dynasty_asset_score",
    "market_adp",
    "suggested_draft_spot",
    "value_edge",
    "timing_label",
    "review_flag",
    "explanation",
  ];
  return [
    headers.join(","),
    ...rows.map((row) => [
      row.afterRank ?? "",
      row.beforeRank ?? "",
      csv(row.playerName),
      csv(row.position),
      csv(row.team),
      row.beforePositionRank ?? "",
      row.afterPositionRank ?? "",
      row.age ?? "",
      row.agePhase,
      row.runwayScore ?? "",
      row.projectionPoints ?? "",
      row.projectionValue ?? "",
      row.replacementValue ?? "",
      row.scarcityValue ?? "",
      row.formatPremium ?? "",
      row.ageRunwayValue ?? "",
      row.shortTermWindowScore ?? "",
      row.runwayPenalty ?? "",
      row.ageCliffPenalty ?? "",
      row.veteranProductionCushion ?? "",
      row.agePenaltyWasSmoothed,
      csv(row.ageReason),
      row.eliteYoungTeProfile,
      row.tePremiumScarcityBoost ?? "",
      row.teRunwayBoost ?? "",
      row.teMarketSanityContext ?? "",
      row.riskAdjustment ?? "",
      row.trustAdjustment ?? "",
      row.marketSanityAdjustment ?? "",
      row.dynastyAssetScore ?? "",
      row.marketAdp ?? "",
      csv(row.suggestedDraftSpot),
      row.valueEdge ?? "",
      row.timingLabel,
      csv(row.reviewFlag),
      csv(row.explanation),
    ].join(",")),
  ].join("\n") + "\n";
}

function toAuditRow(
  row: BlackbirdBoardRow,
  before: BlackbirdBoardRow | null,
  beforePositionRanks: Map<string, number>,
  afterPositionRanks: Map<string, number>
): DynastyCalibrationAuditRow {
  const value = row.dynastyAssetValue;
  const reviewFlag = reviewFlagFor(row, before);
  return {
    playerName: row.playerName,
    position: row.position,
    team: row.team,
    beforeRank: before?.blackbirdBoardRank ?? null,
    afterRank: row.blackbirdBoardRank,
    beforePositionRank: before ? beforePositionRanks.get(rowKey(before)) ?? null : null,
    afterPositionRank: afterPositionRanks.get(rowKey(row)) ?? null,
    age: value?.ageCurve.age ?? null,
    agePhase: value?.ageCurve.agePhase ?? "unknown",
    runwayScore: value?.ageCurve.runwayScore ?? null,
    projectionPoints: row.projectionPoints,
    projectionValue: value?.components.projectionValue ?? row.valueScoreComponents?.projectionValue ?? null,
    replacementValue: value?.components.replacementValue ?? null,
    scarcityValue: value?.components.scarcityValue ?? null,
    formatPremium: value?.components.formatPremium ?? null,
    ageRunwayValue: value?.components.ageRunwayValue ?? null,
    shortTermWindowScore: value?.components.shortTermWindowScore ?? null,
    runwayPenalty: value?.components.runwayPenalty ?? null,
    ageCliffPenalty: value?.components.ageCliffPenalty ?? null,
    veteranProductionCushion: value?.components.veteranProductionCushion ?? null,
    agePenaltyWasSmoothed: value?.agePenaltyWasSmoothed ?? false,
    ageReason: value?.ageReason ?? null,
    eliteYoungTeProfile: value?.eliteYoungTeProfile ?? false,
    tePremiumScarcityBoost: value?.components.tePremiumScarcityBoost ?? null,
    teRunwayBoost: value?.components.teRunwayBoost ?? null,
    teMarketSanityContext: value?.components.teMarketSanityContext ?? null,
    riskAdjustment: value?.components.riskAdjustment ?? null,
    trustAdjustment: value?.components.trustAdjustment ?? null,
    marketSanityAdjustment: value?.components.marketSanityAdjustment ?? null,
    dynastyAssetScore: value?.dynastyAssetScoreDisplay ?? null,
    marketAdp: row.adp,
    suggestedDraftSpot: formatSuggestedDraftSpot(row),
    valueEdge: row.suggestedDraftSpot.marketEdgePicks,
    timingLabel: row.suggestedDraftSpot.label,
    explanation: (value?.explanation ?? row.contextualReasons).slice(0, 3).join(" "),
    reviewFlag,
  };
}

function recommendationFor(input: {
  rows: DynastyCalibrationAuditRow[];
  top50RowsWithAge: number;
  henryTaylorResolved: boolean;
  bowersExplainable: boolean;
}): DynastyCalibrationRecommendation {
  if (!input.rows.length) return "dynasty_calibration_blocked";
  if (input.top50RowsWithAge < 40) return "dynasty_calibration_needs_age_data_fix";
  if (!input.rows.some((row) => row.marketAdp !== null)) return "dynasty_calibration_needs_market_data_fix";
  const olderEliteRbStillNuked = input.rows.some((row) =>
    ["Derrick Henry", "Christian McCaffrey"].includes(row.playerName) &&
    row.afterRank !== null &&
    row.afterRank > 90 &&
    (row.shortTermWindowScore ?? 0) >= 20
  );
  if (olderEliteRbStillNuked) return "dynasty_calibration_needs_age_smoothing";
  if (!input.bowersExplainable) return "dynasty_calibration_needs_te_premium_tuning";
  if (!input.henryTaylorResolved) return "dynasty_calibration_needs_formula_tuning";
  return "dynasty_calibration_ready_for_manual_review";
}

function reviewFlagFor(row: BlackbirdBoardRow, before: BlackbirdBoardRow | null): string | null {
  if (!row.dynastyAssetValue) return "missing_dynasty_asset_value";
  if (row.dynastyAssetValue.ageCurve.age === null) return "missing_age";
  if (row.position === "RB" && row.dynastyAssetValue.ageCurve.declineRisk === "severe" && row.blackbirdBoardRank <= 24) return "older_rb_top_24_manual_review";
  if (row.position === "TE" && row.dynastyAssetValue.ageCurve.agePhase === "ascending" && before && row.blackbirdBoardRank > before.blackbirdBoardRank + 15) return "young_te_still_underweighted";
  return null;
}

function pickWatchlist(rows: DynastyCalibrationAuditRow[], watchlist: string[]): DynastyCalibrationAuditRow[] {
  return watchlist
    .map((name) => rows.find((row) => normalizedName(row.playerName) === normalizedName(name)) ?? null)
    .filter((row): row is DynastyCalibrationAuditRow => Boolean(row));
}

function positionRankMap(rows: BlackbirdBoardRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  const ranks = new Map<string, number>();
  for (const row of rows) {
    const position = row.position ?? "UNK";
    const rank = (counts.get(position) ?? 0) + 1;
    counts.set(position, rank);
    ranks.set(rowKey(row), rank);
  }
  return ranks;
}

function rowKey(row: Pick<BlackbirdBoardRow, "playerId" | "playerName" | "position">): string {
  return `${row.playerId ?? ""}|${normalizedName(row.playerName)}|${row.position ?? ""}`;
}

function formatSuggestedDraftSpot(row: BlackbirdBoardRow): string {
  const spot = row.suggestedDraftSpot;
  if (spot.label === "avoid" || spot.label === "do_not_reach") return "Market too rich";
  if (spot.pickMin === null || spot.pickMax === null) return "Timing unknown";
  return `Round ${spot.round ?? "-"}, picks ${spot.pickMin}-${spot.pickMax}`;
}

function table(rows: DynastyCalibrationAuditRow[]): string {
  return [
    "| After | Before | Player | Pos | Age | Phase | Runway | Proj | Asset | ADP | Suggested | Edge | Timing | Flag |",
    "| ---: | ---: | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | --- | --- |",
    ...rows.map((row) =>
      `| ${row.afterRank ?? "-"} | ${row.beforeRank ?? "-"} | ${escapeMd(row.playerName)} | ${row.position ?? "-"} | ${row.age ?? "-"} | ${row.agePhase} | ${row.runwayScore ?? "-"} | ${row.projectionPoints ?? "-"} | ${row.dynastyAssetScore ?? "-"} | ${row.marketAdp ?? "-"} | ${escapeMd(row.suggestedDraftSpot)} | ${row.valueEdge ?? "-"} | ${row.timingLabel} | ${row.reviewFlag ?? "-"} |`
    ),
  ].join("\n");
}

function normalizedName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function csv(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function escapeMd(value: string): string {
  return value.replace(/\|/g, "\\|");
}
