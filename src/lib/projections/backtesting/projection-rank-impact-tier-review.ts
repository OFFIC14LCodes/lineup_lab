import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ProjectionLimitedPromotionPoolReviewReport, ProjectionLimitedPromotionPoolReviewRow } from "./projection-limited-promotion-pool-review-types";
import type { ProjectionPromotionReadinessFinalReport } from "./projection-promotion-readiness-final-types";
import type { ProjectionRankImpactFlag, ProjectionRankImpactQualityReviewReport, ProjectionRankImpactQualityRow } from "./projection-rank-impact-quality-review-types";
import type {
  ProjectionRankImpactPositionRankRange,
  ProjectionRankImpactRankRange,
  ProjectionRankImpactTierReviewAction,
  ProjectionRankImpactTierReviewArtifactPaths,
  ProjectionRankImpactTierReviewOptions,
  ProjectionRankImpactTierReviewReport,
  ProjectionRankImpactTierReviewRow,
  ProjectionRankImpactTierReviewSummary,
  ProjectionRankImpactTierReviewVerdict,
} from "./projection-rank-impact-tier-review-types";
import type { ProjectionV82ShadowReport } from "./projection-v8-2-shadow-types";
import type { PreseasonProjectionSnapshot } from "./preseason-projection-snapshot-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const MEANINGFUL_FLAGS: ProjectionRankImpactFlag[] = [
  "top_100_overall_movement",
  "top_200_overall_movement",
  "top_300_overall_movement",
  "starter_tier_position_movement",
  "qb_superflex_sensitive_movement",
];

export function runProjectionRankImpactTierReview(options: ProjectionRankImpactTierReviewOptions): ProjectionRankImpactTierReviewReport {
  const qualityPath = path.join(OUTPUT_DIR, `projection-rank-impact-quality-review-${options.projectionSeason}.json`);
  const limitedPath = path.join(OUTPUT_DIR, `projection-limited-promotion-pool-review-${options.projectionSeason}.json`);
  const finalReadinessPath = path.join(OUTPUT_DIR, `projection-promotion-readiness-final-${options.projectionSeason}.json`);
  const shadowPath = path.join(OUTPUT_DIR, `projection-v8-2-shadow-${options.projectionSeason}.json`);
  const snapshotPath = path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`);
  for (const artifactPath of [qualityPath, limitedPath, finalReadinessPath, shadowPath, snapshotPath]) {
    if (!existsSync(artifactPath)) throw new Error(`Missing ${path.relative(process.cwd(), artifactPath)}.`);
  }

  return buildProjectionRankImpactTierReviewFromData({
    options,
    qualityReview: JSON.parse(readFileSync(qualityPath, "utf8")) as ProjectionRankImpactQualityReviewReport,
    limitedPool: JSON.parse(readFileSync(limitedPath, "utf8")) as ProjectionLimitedPromotionPoolReviewReport,
    finalReadiness: JSON.parse(readFileSync(finalReadinessPath, "utf8")) as ProjectionPromotionReadinessFinalReport,
    shadow: JSON.parse(readFileSync(shadowPath, "utf8")) as ProjectionV82ShadowReport,
    snapshot: JSON.parse(readFileSync(snapshotPath, "utf8")) as PreseasonProjectionSnapshot,
    sourceArtifacts: {
      rankImpactQualityReview: qualityPath,
      limitedPromotionPoolReview: limitedPath,
      finalReadiness: finalReadinessPath,
      shadow: shadowPath,
      snapshot: snapshotPath,
    },
  });
}

export function buildProjectionRankImpactTierReviewFromData(input: {
  options: ProjectionRankImpactTierReviewOptions;
  qualityReview: ProjectionRankImpactQualityReviewReport;
  limitedPool: ProjectionLimitedPromotionPoolReviewReport;
  finalReadiness: ProjectionPromotionReadinessFinalReport;
  shadow: ProjectionV82ShadowReport;
  snapshot: PreseasonProjectionSnapshot;
  sourceArtifacts?: ProjectionRankImpactTierReviewReport["sourceArtifacts"];
}): ProjectionRankImpactTierReviewReport {
  void input.finalReadiness;
  void input.shadow;
  void input.snapshot;

  const limitedByPlayerId = new Map(input.limitedPool.eligibleRows.map((row) => [row.playerId, row]));
  const rows = input.qualityReview.rows
    .filter(isMeaningfulRankImpactRow)
    .map((quality) => {
      const limited = limitedByPlayerId.get(quality.playerId);
      if (!limited) throw new Error(`Missing limited-pool row for ${quality.playerId}.`);
      return tierReviewRow(quality, limited);
    })
    .sort(compareTierRows);

  const summary = buildSummary(rows);
  const safetyGates = buildSafetyGates(input.qualityReview, input.limitedPool, rows);
  const verdict = verdictFor(safetyGates, rows);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? {
      rankImpactQualityReview: "in-memory",
      limitedPromotionPoolReview: "in-memory",
      finalReadiness: "in-memory",
      shadow: "in-memory",
      snapshot: "in-memory",
    },
    rows,
    summary,
    allMeaningfulOverallRankMovers: rows.filter(hasMeaningfulOverallFlag).sort(compareByAbsOverallRankMovement),
    allMeaningfulPositionRankMovers: rows.filter(hasMeaningfulPositionFlag).sort(compareByAbsPositionRankMovement),
    allQbSuperflexSensitiveMovers: rows.filter((row) => row.rankImpactFlags.includes("qb_superflex_sensitive_movement")).sort(compareByAbsPositionRankMovement),
    starterTierVeteranMovers: rows.filter(isStarterTierVeteranMover).sort(compareTierRows),
    rookieYoungMovers: rows.filter(isRookieOrYoungMover).sort(compareTierRows),
    topProjectedPointMovers: [...rows].sort(compareByAbsPointDelta).slice(0, 25),
    safetyGates,
    verdict,
    notes: [
      "Dry-run/read-only rank impact tier review packet only.",
      "Only meaningful rank-impact rows are included; deep-tier noise appears only if another meaningful flag is also present.",
      "Recommended actions are conservative review routing labels, not model decisions.",
      "No live projections, 2026 production outputs, Supabase writes, Blackbird Rank, Draft Suggestion ordering, War Room UI, or conservative decision files are changed.",
    ],
  };
}

export function writeProjectionRankImpactTierReviewArtifacts(report: ProjectionRankImpactTierReviewReport): ProjectionRankImpactTierReviewArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-rank-impact-tier-review-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderProjectionRankImpactTierReviewMarkdown(report), "utf8");
  writeFileSync(csvPath, renderProjectionRankImpactTierReviewCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

export function isMeaningfulRankImpactRow(row: ProjectionRankImpactQualityRow): boolean {
  return row.meaningfulFlags.some((flag) => MEANINGFUL_FLAGS.includes(flag));
}

export function tierReviewRow(quality: ProjectionRankImpactQualityRow, limited: ProjectionLimitedPromotionPoolReviewRow): ProjectionRankImpactTierReviewRow {
  const recommendedTierReviewAction = recommendedActionFor(quality, limited);
  return {
    playerId: quality.playerId,
    player: quality.player,
    position: quality.position,
    team: quality.team,
    currentExpectedGames: limited.currentExpectedGames,
    v82ExpectedGames: limited.v82ExpectedGames,
    gamesDelta: limited.gamesDelta,
    currentProjectedTotal: quality.currentProjectedTotal,
    v82ProjectedTotal: quality.v82ProjectedTotal,
    projectedPointDelta: quality.projectedPointDelta,
    currentOverallRank: quality.currentOverallRank,
    v82OverallRank: quality.v82OverallRank,
    estimatedOverallRankMovement: quality.estimatedOverallRankMovement,
    currentPositionRank: quality.currentPositionRank,
    v82PositionRank: quality.v82PositionRank,
    estimatedPositionRankMovement: quality.estimatedPositionRankMovement,
    bestOverallRank: quality.bestOverallRank,
    bestPositionRank: quality.bestPositionRank,
    relevanceTiers: [...quality.relevanceTiers],
    pointDeltaBucket: quality.pointDeltaBucket,
    overallRankRange: overallRankRangeFor(quality.bestOverallRank),
    positionRankRange: positionRankRangeFor(quality.relevanceTiers),
    rankImpactFlags: quality.meaningfulFlags.filter((flag) => MEANINGFUL_FLAGS.includes(flag)),
    riskFlags: [...quality.riskFlags],
    reasonCodes: [...quality.reasonCodes],
    cohortTags: [...limited.cohortTags],
    universeEligibilityStatus: limited.universeEligibilityStatus,
    promotionClassification: limited.finalClassification,
    recommendedTierReviewAction,
    reviewRationale: reviewRationaleFor(recommendedTierReviewAction, quality, limited),
  };
}

function recommendedActionFor(quality: ProjectionRankImpactQualityRow, limited: ProjectionLimitedPromotionPoolReviewRow): ProjectionRankImpactTierReviewAction {
  if (quality.meaningfulFlags.includes("qb_superflex_sensitive_movement")) return "needs_qb_superflex_review";
  if (isSmallPointsLargeMeaningfulMove(quality)) return "needs_model_policy_review";
  if (isRookieOrYoung(quality, limited)) {
    if (Math.abs(quality.projectedPointDelta ?? 0) < 5 && Math.abs(quality.estimatedOverallRankMovement ?? 0) < 25) return "acceptable_v8_2_movement";
    return "needs_roster_confirmation";
  }
  if (quality.relevanceTiers.includes("position_starter_tier") && (quality.projectedPointDelta ?? 0) < 0) return "needs_injury_role_review";
  if (quality.relevanceTiers.includes("position_starter_tier") && ["RB", "WR", "TE"].includes(quality.position)) return "needs_model_policy_review";
  if (Math.abs(quality.projectedPointDelta ?? 0) >= 10) return "needs_model_policy_review";
  return "keep_current_path_for_now";
}

function reviewRationaleFor(action: ProjectionRankImpactTierReviewAction, quality: ProjectionRankImpactQualityRow, limited: ProjectionLimitedPromotionPoolReviewRow): string {
  switch (action) {
    case "needs_qb_superflex_review":
      return "QB movement inside a Superflex-sensitive range should be reviewed before any v8.2 promotion path changes.";
    case "needs_injury_role_review":
      return "Starter-tier veteran negative movement may reflect injury, role, or availability assumptions and needs confirmation.";
    case "needs_roster_confirmation":
      return "Rookie/young or low-prior movement should be checked against current roster/depth-chart context before approval.";
    case "needs_model_policy_review":
      return isSmallPointsLargeMeaningfulMove(quality)
        ? "Small point movement is causing meaningful rank movement in a draft-relevant range; model policy should confirm whether this is acceptable."
        : "Meaningful starter/top-range movement should be reviewed against promotion policy before feature-flag review.";
    case "acceptable_v8_2_movement":
      return "Movement is modest and appears acceptable for the limited v8.2 promotion review packet.";
    case "keep_current_path_for_now":
      return `Keep current path until tier review confirms the ${limited.universeEligibilityStatus} row should move.`;
  }
}

function buildSummary(rows: ProjectionRankImpactTierReviewRow[]): ProjectionRankImpactTierReviewSummary {
  return {
    meaningfulRows: rows.length,
    actionCounts: countBy(rows, (row) => row.recommendedTierReviewAction, actionKeys()),
    positionCounts: countBy(rows, (row) => row.position),
    rankImpactFlagCounts: countFlags(rows.flatMap((row) => row.rankImpactFlags)),
    overallRankRangeCounts: countBy(rows, (row) => row.overallRankRange, rankRangeKeys()),
    positionRankRangeCounts: countBy(rows, (row) => row.positionRankRange, positionRankRangeKeys()),
    projectedPointMovementBucketCounts: countBy(rows, (row) => row.pointDeltaBucket, ["0", "0-2", "2-5", "5-10", "10-20"]),
    qbSuperflexSensitiveRows: rows.filter((row) => row.rankImpactFlags.includes("qb_superflex_sensitive_movement")).length,
  };
}

function buildSafetyGates(quality: ProjectionRankImpactQualityReviewReport, limitedPool: ProjectionLimitedPromotionPoolReviewReport, rows: ProjectionRankImpactTierReviewRow[]) {
  return [
    gate("no_live_outputs_changed", true, "Tier review packet reads dry-run artifacts and writes only review packet artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Rank fields are copied from dry-run rank impact artifacts only."),
    gate("draft_suggestions_unchanged", true, "Draft suggestion code paths are not imported or executed."),
    gate("war_room_unchanged", true, "War Room UI code is not imported or modified."),
    gate("v8_2_not_promoted", true, "This packet does not update promotion decisions or production projection paths."),
    gate("conservative_decision_file_unchanged", true, "The conservative decision file is not read for mutation or rewritten."),
    gate("eligible_pool_only", rows.every((row) => limitedPool.eligibleRows.some((eligible) => eligible.playerId === row.playerId)), `${rows.length} row(s) are from the eligible limited promotion pool.`),
    gate("meaningful_rows_only", rows.every((row) => row.rankImpactFlags.some((flag) => MEANINGFUL_FLAGS.includes(flag))), `${rows.length} meaningful row(s) included.`),
    gate("deep_noise_only_excluded", rows.every((row) => row.rankImpactFlags.some((flag) => flag !== "deep_tier_rank_noise")), "Deep-tier noise-only rows are excluded."),
    gate("source_quality_review_ready", quality.recommendation === "rank_impact_needs_tier_review" || quality.recommendation === "rank_impact_clean_for_feature_flag_review", `Source quality recommendation: ${quality.recommendation}.`),
  ];
}

function verdictFor(gates: ProjectionRankImpactTierReviewReport["safetyGates"], rows: ProjectionRankImpactTierReviewRow[]): ProjectionRankImpactTierReviewVerdict {
  if (gates.some((gate) => !gate.passed)) return "tier_review_blocked";
  if (!rows.length) return "tier_review_no_meaningful_movers";
  return "tier_review_packet_ready";
}

function isSmallPointsLargeMeaningfulMove(row: ProjectionRankImpactQualityRow) {
  return Math.abs(row.projectedPointDelta ?? 0) < 5 && (Math.abs(row.estimatedOverallRankMovement ?? 0) >= 25 || Math.abs(row.estimatedPositionRankMovement ?? 0) >= 5);
}

function isRookieOrYoungMover(row: ProjectionRankImpactTierReviewRow) {
  return row.riskFlags.includes("rookie_or_low_prior") || row.reasonCodes.some((reason) => reason.includes("rookie")) || row.cohortTags.some((tag) => tag.includes("rookie") || tag.includes("low_prior"));
}

function isRookieOrYoung(row: ProjectionRankImpactQualityRow, limited: ProjectionLimitedPromotionPoolReviewRow) {
  return row.riskFlags.includes("rookie_or_low_prior") || row.reasonCodes.some((reason) => reason.includes("rookie")) || limited.cohortTags.some((tag) => tag.includes("rookie") || tag.includes("low_prior"));
}

function isStarterTierVeteranMover(row: ProjectionRankImpactTierReviewRow) {
  return row.relevanceTiers.includes("position_starter_tier") && !isRookieOrYoungMover(row);
}

function hasMeaningfulOverallFlag(row: ProjectionRankImpactTierReviewRow) {
  return row.rankImpactFlags.some((flag) => flag === "top_100_overall_movement" || flag === "top_200_overall_movement" || flag === "top_300_overall_movement");
}

function hasMeaningfulPositionFlag(row: ProjectionRankImpactTierReviewRow) {
  return row.rankImpactFlags.some((flag) => flag === "starter_tier_position_movement" || flag === "qb_superflex_sensitive_movement");
}

function overallRankRangeFor(rank: number | null): ProjectionRankImpactRankRange {
  if (rank === null) return "unknown";
  if (rank <= 50) return "top_50";
  if (rank <= 100) return "top_100";
  if (rank <= 150) return "top_150";
  if (rank <= 200) return "top_200";
  if (rank <= 300) return "top_300";
  if (rank <= 500) return "top_500";
  return "500_plus";
}

function positionRankRangeFor(tiers: string[]): ProjectionRankImpactPositionRankRange {
  if (tiers.includes("position_starter_tier")) return "starter";
  if (tiers.includes("position_depth_tier")) return "depth";
  if (tiers.includes("position_deep_tier")) return "deep";
  return "unknown";
}

function compareTierRows(a: ProjectionRankImpactTierReviewRow, b: ProjectionRankImpactTierReviewRow) {
  return rankActionWeight(a.recommendedTierReviewAction) - rankActionWeight(b.recommendedTierReviewAction)
    || Math.abs(b.estimatedOverallRankMovement ?? 0) - Math.abs(a.estimatedOverallRankMovement ?? 0)
    || Math.abs(b.estimatedPositionRankMovement ?? 0) - Math.abs(a.estimatedPositionRankMovement ?? 0)
    || Math.abs(b.projectedPointDelta ?? 0) - Math.abs(a.projectedPointDelta ?? 0);
}

function compareByAbsOverallRankMovement(a: ProjectionRankImpactTierReviewRow, b: ProjectionRankImpactTierReviewRow) {
  return Math.abs(b.estimatedOverallRankMovement ?? 0) - Math.abs(a.estimatedOverallRankMovement ?? 0) || Math.abs(b.projectedPointDelta ?? 0) - Math.abs(a.projectedPointDelta ?? 0);
}

function compareByAbsPositionRankMovement(a: ProjectionRankImpactTierReviewRow, b: ProjectionRankImpactTierReviewRow) {
  return Math.abs(b.estimatedPositionRankMovement ?? 0) - Math.abs(a.estimatedPositionRankMovement ?? 0) || Math.abs(b.projectedPointDelta ?? 0) - Math.abs(a.projectedPointDelta ?? 0);
}

function compareByAbsPointDelta(a: ProjectionRankImpactTierReviewRow, b: ProjectionRankImpactTierReviewRow) {
  return Math.abs(b.projectedPointDelta ?? 0) - Math.abs(a.projectedPointDelta ?? 0) || Math.abs(b.estimatedOverallRankMovement ?? 0) - Math.abs(a.estimatedOverallRankMovement ?? 0);
}

function rankActionWeight(action: ProjectionRankImpactTierReviewAction) {
  const weights: Record<ProjectionRankImpactTierReviewAction, number> = {
    needs_qb_superflex_review: 0,
    needs_injury_role_review: 1,
    needs_roster_confirmation: 2,
    needs_model_policy_review: 3,
    keep_current_path_for_now: 4,
    acceptable_v8_2_movement: 5,
  };
  return weights[action];
}

function renderProjectionRankImpactTierReviewMarkdown(report: ProjectionRankImpactTierReviewReport) {
  return `# Projection Rank Impact Tier Review ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Verdict: ${report.verdict}

## Summary

\`\`\`json
${JSON.stringify(report.summary, null, 2)}
\`\`\`

## Safety Gates

${renderGateTable(report.safetyGates)}

## Recommended Action Counts

${renderCounts(report.summary.actionCounts)}

## All Meaningful Overall-Rank Movers

${renderRowsTable(report.allMeaningfulOverallRankMovers)}

## All Meaningful Position-Rank Movers

${renderRowsTable(report.allMeaningfulPositionRankMovers)}

## QB / Superflex-Sensitive Movers

${renderRowsTable(report.allQbSuperflexSensitiveMovers)}

## Starter-Tier Veteran Movers

${renderRowsTable(report.starterTierVeteranMovers)}

## Rookie / Young Movers

${renderRowsTable(report.rookieYoungMovers)}

## Top Projected-Point Movers

${renderRowsTable(report.topProjectedPointMovers)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderProjectionRankImpactTierReviewCsv(report: ProjectionRankImpactTierReviewReport) {
  const headers = [
    "player_id",
    "player",
    "position",
    "team",
    "current_expected_games",
    "v82_expected_games",
    "games_delta",
    "current_projected_total",
    "v82_projected_total",
    "projected_point_delta",
    "current_overall_rank",
    "v82_overall_rank",
    "overall_rank_movement",
    "current_position_rank",
    "v82_position_rank",
    "position_rank_movement",
    "rank_impact_flags",
    "risk_flags",
    "v82_reason_codes",
    "universe_eligibility_status",
    "promotion_classification",
    "recommended_tier_review_action",
    "review_rationale",
  ];
  const rows = report.rows.map((row) => [
    row.playerId,
    row.player,
    row.position,
    row.team ?? "",
    row.currentExpectedGames ?? "",
    row.v82ExpectedGames ?? "",
    row.gamesDelta ?? "",
    row.currentProjectedTotal ?? "",
    row.v82ProjectedTotal ?? "",
    row.projectedPointDelta ?? "",
    row.currentOverallRank ?? "",
    row.v82OverallRank ?? "",
    row.estimatedOverallRankMovement ?? "",
    row.currentPositionRank ?? "",
    row.v82PositionRank ?? "",
    row.estimatedPositionRankMovement ?? "",
    row.rankImpactFlags.join("|"),
    row.riskFlags.join("|"),
    row.reasonCodes.join("|"),
    row.universeEligibilityStatus,
    row.promotionClassification,
    row.recommendedTierReviewAction,
    row.reviewRationale,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function renderGateTable(gates: ProjectionRankImpactTierReviewReport["safetyGates"]) {
  const header = "| Gate | Status | Detail |";
  const divider = "|---|---|---|";
  return [header, divider, ...gates.map((gate) => `| ${gate.name} | ${gate.passed ? "PASS" : "FAIL"} | ${gate.detail} |`)].join("\n");
}

function renderCounts(counts: Record<string, number>) {
  const header = "| Value | Rows |";
  const divider = "|---|---:|";
  return [header, divider, ...Object.entries(counts).map(([key, value]) => `| ${key} | ${value} |`)].join("\n");
}

function renderRowsTable(rows: ProjectionRankImpactTierReviewRow[]) {
  if (!rows.length) return "No rows.";
  const header = "| Player | Pos | Team | Pts Delta | Best OVR | OVR Move | Best Pos | Pos Move | Action | Flags |";
  const divider = "|---|---|---|---:|---:|---:|---:|---:|---|---|";
  return [header, divider, ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.team ?? ""} | ${row.projectedPointDelta ?? ""} | ${row.bestOverallRank ?? ""} | ${row.estimatedOverallRankMovement ?? ""} | ${row.bestPositionRank ?? ""} | ${row.estimatedPositionRankMovement ?? ""} | ${row.recommendedTierReviewAction} | ${row.rankImpactFlags.join(", ")} |`)].join("\n");
}

function countBy<T, K extends string>(rows: T[], selector: (row: T) => K, keys?: readonly K[]): Record<K, number> {
  const counts = Object.fromEntries((keys ?? []).map((key) => [key, 0])) as Record<K, number>;
  for (const row of rows) {
    const key = selector(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function countFlags(flags: ProjectionRankImpactFlag[]) {
  const counts = Object.fromEntries(MEANINGFUL_FLAGS.map((flag) => [flag, 0])) as Record<ProjectionRankImpactFlag, number>;
  for (const flag of flags) counts[flag] = (counts[flag] ?? 0) + 1;
  return counts;
}

function actionKeys(): ProjectionRankImpactTierReviewAction[] {
  return ["acceptable_v8_2_movement", "keep_current_path_for_now", "needs_roster_confirmation", "needs_injury_role_review", "needs_qb_superflex_review", "needs_model_policy_review"];
}

function rankRangeKeys(): ProjectionRankImpactRankRange[] {
  return ["top_50", "top_100", "top_150", "top_200", "top_300", "top_500", "500_plus", "unknown"];
}

function positionRankRangeKeys(): ProjectionRankImpactPositionRankRange[] {
  return ["starter", "depth", "deep", "unknown"];
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
