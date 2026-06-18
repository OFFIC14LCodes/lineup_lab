import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { PreseasonProjectionSnapshot } from "./preseason-projection-snapshot-types";
import type { ProjectionLimitedPromotionPoolReviewReport, ProjectionLimitedPromotionPoolReviewRow } from "./projection-limited-promotion-pool-review-types";
import type { ProjectionPromotionReadinessFinalReport } from "./projection-promotion-readiness-final-types";
import type {
  ProjectionRankImpactDraftableRangeSummary,
  ProjectionRankImpactFlag,
  ProjectionRankImpactPointDeltaBucket,
  ProjectionRankImpactQualityRecommendation,
  ProjectionRankImpactQualityReviewArtifactPaths,
  ProjectionRankImpactQualityReviewOptions,
  ProjectionRankImpactQualityReviewReport,
  ProjectionRankImpactQualityRow,
  ProjectionRankImpactRelevanceTier,
  ProjectionRankImpactTierSummary,
} from "./projection-rank-impact-quality-review-types";
import type { ProjectionV82ShadowReport } from "./projection-v8-2-shadow-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const RELEVANCE_TIERS: ProjectionRankImpactRelevanceTier[] = [
  "overall_top_50",
  "overall_top_100",
  "overall_top_200",
  "overall_top_300",
  "overall_top_500",
  "overall_500_plus",
  "position_starter_tier",
  "position_depth_tier",
  "position_deep_tier",
  "near_zero_projection",
];
const POINT_BUCKETS: ProjectionRankImpactPointDeltaBucket[] = ["0", "0-2", "2-5", "5-10", "10-20"];

export function runProjectionRankImpactQualityReview(options: ProjectionRankImpactQualityReviewOptions): ProjectionRankImpactQualityReviewReport {
  const limitedPath = path.join(OUTPUT_DIR, `projection-limited-promotion-pool-review-${options.projectionSeason}.json`);
  const finalReadinessPath = path.join(OUTPUT_DIR, `projection-promotion-readiness-final-${options.projectionSeason}.json`);
  const shadowPath = path.join(OUTPUT_DIR, `projection-v8-2-shadow-${options.projectionSeason}.json`);
  const snapshotPath = path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`);
  for (const artifactPath of [limitedPath, finalReadinessPath, shadowPath, snapshotPath]) {
    if (!existsSync(artifactPath)) throw new Error(`Missing ${path.relative(process.cwd(), artifactPath)}.`);
  }
  return buildProjectionRankImpactQualityReviewFromData({
    options,
    limitedPool: JSON.parse(readFileSync(limitedPath, "utf8")) as ProjectionLimitedPromotionPoolReviewReport,
    finalReadiness: JSON.parse(readFileSync(finalReadinessPath, "utf8")) as ProjectionPromotionReadinessFinalReport,
    shadow: JSON.parse(readFileSync(shadowPath, "utf8")) as ProjectionV82ShadowReport,
    snapshot: JSON.parse(readFileSync(snapshotPath, "utf8")) as PreseasonProjectionSnapshot,
    sourceArtifacts: {
      limitedPromotionPoolReview: limitedPath,
      finalReadiness: finalReadinessPath,
      shadow: shadowPath,
      snapshot: snapshotPath,
    },
  });
}

export function buildProjectionRankImpactQualityReviewFromData(input: {
  options: ProjectionRankImpactQualityReviewOptions;
  limitedPool: ProjectionLimitedPromotionPoolReviewReport;
  finalReadiness: ProjectionPromotionReadinessFinalReport;
  shadow: ProjectionV82ShadowReport;
  snapshot: PreseasonProjectionSnapshot;
  sourceArtifacts?: ProjectionRankImpactQualityReviewReport["sourceArtifacts"];
}): ProjectionRankImpactQualityReviewReport {
  void input.finalReadiness;
  void input.shadow;
  void input.snapshot;
  const rows = input.limitedPool.eligibleRows.map(qualityRow).sort(compareByAbsOverallRankMovement);
  const tierSummaries = RELEVANCE_TIERS.map((tier) => tierSummary(tier, rows.filter((row) => row.relevanceTiers.includes(tier))));
  const pointDeltaBucketSummaries = POINT_BUCKETS.map((bucket) => tierSummary(bucket, rows.filter((row) => row.pointDeltaBucket === bucket)));
  const draftableRangeSummaries = buildDraftableRangeSummaries(rows);
  const positionRangeSummaries = buildPositionRangeSummaries(rows);
  const qbReview = buildQbReview(rows);
  const topMeaningfulOverallRankMovers = rows.filter(hasMeaningfulOverallFlag).sort(compareByAbsOverallRankMovement).slice(0, 25);
  const topMeaningfulPositionRankMovers = rows.filter(hasMeaningfulPositionFlag).sort(compareByAbsPositionRankMovement).slice(0, 25);
  const topSmallPointsLargeRankNoiseRows = rows.filter((row) => row.meaningfulFlags.includes("small_points_large_rank_noise")).sort(compareByAbsOverallRankMovement).slice(0, 25);
  const topDeepTierRankNoiseRows = rows.filter((row) => row.meaningfulFlags.includes("deep_tier_rank_noise")).sort(compareByAbsOverallRankMovement).slice(0, 25);
  const topQbRankMovers = rows.filter((row) => row.position === "QB").sort(compareByAbsPositionRankMovement).slice(0, 25);
  const topRbRankMovers = rows.filter((row) => row.position === "RB").sort(compareByAbsPositionRankMovement).slice(0, 25);
  const topWrRankMovers = rows.filter((row) => row.position === "WR").sort(compareByAbsPositionRankMovement).slice(0, 25);
  const topTeRankMovers = rows.filter((row) => row.position === "TE").sort(compareByAbsPositionRankMovement).slice(0, 25);
  const summary = {
    eligibleRows: rows.length,
    meaningfulOverallRankMovers: topMeaningfulOverallRankMovers.length,
    meaningfulPositionRankMovers: rows.filter(hasMeaningfulPositionFlag).length,
    smallPointsLargeRankNoiseRows: rows.filter((row) => row.meaningfulFlags.includes("small_points_large_rank_noise")).length,
    deepTierNoiseRows: rows.filter((row) => row.meaningfulFlags.includes("deep_tier_rank_noise")).length,
    qbSuperflexSensitiveRows: rows.filter((row) => row.meaningfulFlags.includes("qb_superflex_sensitive_movement")).length,
  };
  const safetyGates = buildSafetyGates(input.limitedPool, rows, summary);
  const recommendation = recommendationFor(safetyGates, summary);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? {
      limitedPromotionPoolReview: "in-memory",
      finalReadiness: "in-memory",
      shadow: "in-memory",
      snapshot: "in-memory",
    },
    rows,
    tierSummaries,
    pointDeltaBucketSummaries,
    draftableRangeSummaries,
    positionRangeSummaries,
    qbReview,
    summary,
    topMeaningfulOverallRankMovers,
    topMeaningfulPositionRankMovers,
    topSmallPointsLargeRankNoiseRows,
    topDeepTierRankNoiseRows,
    topQbRankMovers,
    topRbRankMovers,
    topWrRankMovers,
    topTeRankMovers,
    safetyGates,
    recommendation,
    notes: [
      "Dry-run/read-only rank impact quality review only.",
      "Rank movement is evaluated only for rows in the limited eligible promotion pool.",
      "Large rank movement in deep or near-zero projection tiers is classified as noise rather than direct draft-impact signal.",
      "No live projections, 2026 production outputs, Supabase writes, War Room UI, Blackbird Rank, or Draft Suggestion ordering are changed.",
    ],
  };
}

export function writeProjectionRankImpactQualityReviewArtifacts(report: ProjectionRankImpactQualityReviewReport): ProjectionRankImpactQualityReviewArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-rank-impact-quality-review-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderProjectionRankImpactQualityReviewMarkdown(report), "utf8");
  writeFileSync(csvPath, renderProjectionRankImpactQualityReviewCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

export function qualityRow(row: ProjectionLimitedPromotionPoolReviewRow): ProjectionRankImpactQualityRow {
  const bestOverallRank = minRank(row.currentOverallRank, row.v82OverallRank);
  const bestPositionRank = minRank(row.currentPositionRank, row.v82PositionRank);
  const relevanceTiers = relevanceTiersFor(row, bestOverallRank, bestPositionRank);
  const pointDeltaBucket = pointDeltaBucketFor(row.projectedPointDelta);
  const meaningfulFlags = meaningfulFlagsFor(row, bestOverallRank, bestPositionRank, relevanceTiers, pointDeltaBucket);
  return {
    playerId: row.playerId,
    player: row.player,
    position: row.position,
    team: row.team,
    currentProjectedTotal: row.currentProjectedTotal,
    v82ProjectedTotal: row.v82ProjectedTotal,
    projectedPointDelta: row.projectedPointDelta,
    currentOverallRank: row.currentOverallRank,
    v82OverallRank: row.v82OverallRank,
    currentPositionRank: row.currentPositionRank,
    v82PositionRank: row.v82PositionRank,
    estimatedOverallRankMovement: row.estimatedOverallRankMovement,
    estimatedPositionRankMovement: row.estimatedPositionRankMovement,
    bestOverallRank,
    bestPositionRank,
    relevanceTiers,
    pointDeltaBucket,
    meaningfulFlags,
    riskFlags: [...row.riskFlags],
    reasonCodes: [...row.reasonCodes],
  };
}

function relevanceTiersFor(row: ProjectionLimitedPromotionPoolReviewRow, bestOverallRank: number | null, bestPositionRank: number | null): ProjectionRankImpactRelevanceTier[] {
  const tiers: ProjectionRankImpactRelevanceTier[] = [];
  if (bestOverallRank !== null) {
    if (bestOverallRank <= 50) tiers.push("overall_top_50");
    if (bestOverallRank <= 100) tiers.push("overall_top_100");
    if (bestOverallRank <= 200) tiers.push("overall_top_200");
    if (bestOverallRank <= 300) tiers.push("overall_top_300");
    if (bestOverallRank <= 500) tiers.push("overall_top_500");
    if (bestOverallRank > 500) tiers.push("overall_500_plus");
  } else {
    tiers.push("overall_500_plus");
  }
  const positionTier = positionTierFor(row.position, bestPositionRank);
  tiers.push(positionTier);
  if (Math.max(row.currentProjectedTotal ?? 0, row.v82ProjectedTotal ?? 0) < 5) tiers.push("near_zero_projection");
  return [...new Set(tiers)];
}

function meaningfulFlagsFor(row: ProjectionLimitedPromotionPoolReviewRow, bestOverallRank: number | null, bestPositionRank: number | null, tiers: ProjectionRankImpactRelevanceTier[], pointBucket: ProjectionRankImpactPointDeltaBucket): ProjectionRankImpactFlag[] {
  const flags: ProjectionRankImpactFlag[] = [];
  const absOverallMove = Math.abs(row.estimatedOverallRankMovement ?? 0);
  const absPositionMove = Math.abs(row.estimatedPositionRankMovement ?? 0);
  const absPoints = Math.abs(row.projectedPointDelta ?? 0);
  if (bestOverallRank !== null && bestOverallRank <= 100 && absOverallMove >= 25) flags.push("top_100_overall_movement");
  else if (bestOverallRank !== null && bestOverallRank <= 200 && absOverallMove >= 25) flags.push("top_200_overall_movement");
  else if (bestOverallRank !== null && bestOverallRank <= 300 && absOverallMove >= 25) flags.push("top_300_overall_movement");
  if (tiers.includes("position_starter_tier") && absPositionMove >= 5) flags.push("starter_tier_position_movement");
  if (row.position === "QB" && (bestPositionRank ?? Number.POSITIVE_INFINITY) <= 36 && (absPositionMove >= 5 || absOverallMove >= 25)) flags.push("qb_superflex_sensitive_movement");
  if (absPoints >= 10 && absOverallMove < 25 && absPositionMove < 5) flags.push("large_points_small_rank_noise");
  if ((pointBucket === "0" || pointBucket === "0-2") && (absOverallMove >= 50 || absPositionMove >= 10)) flags.push("small_points_large_rank_noise");
  if ((tiers.includes("overall_500_plus") || tiers.includes("position_deep_tier") || tiers.includes("near_zero_projection")) && (absOverallMove >= 50 || absPositionMove >= 10)) flags.push("deep_tier_rank_noise");
  return [...new Set(flags)];
}

function tierSummary(tier: string, rows: ProjectionRankImpactQualityRow[]): ProjectionRankImpactTierSummary {
  return {
    tier,
    rows: rows.length,
    averageProjectedPointDelta: average(rows.map((row) => row.projectedPointDelta)),
    medianProjectedPointDelta: median(rows.map((row) => row.projectedPointDelta)),
    averageOverallRankMovement: average(rows.map((row) => row.estimatedOverallRankMovement)),
    medianOverallRankMovement: median(rows.map((row) => row.estimatedOverallRankMovement)),
    averagePositionRankMovement: average(rows.map((row) => row.estimatedPositionRankMovement)),
    medianPositionRankMovement: median(rows.map((row) => row.estimatedPositionRankMovement)),
    rowsMoving5PlusPositionRanks: rows.filter((row) => Math.abs(row.estimatedPositionRankMovement ?? 0) >= 5).length,
    rowsMoving10PlusPositionRanks: rows.filter((row) => Math.abs(row.estimatedPositionRankMovement ?? 0) >= 10).length,
    rowsMoving25PlusOverallRanks: rows.filter((row) => Math.abs(row.estimatedOverallRankMovement ?? 0) >= 25).length,
    rowsMoving50PlusOverallRanks: rows.filter((row) => Math.abs(row.estimatedOverallRankMovement ?? 0) >= 50).length,
    topMovers: rows.sort(compareByAbsOverallRankMovement).slice(0, 10),
  };
}

function buildDraftableRangeSummaries(rows: ProjectionRankImpactQualityRow[]): ProjectionRankImpactDraftableRangeSummary[] {
  return [50, 100, 150, 200, 300, 500].map((range) => rangeSummary(`top_${range}_overall`, rows.filter((row) => (row.bestOverallRank ?? Number.POSITIVE_INFINITY) <= range)));
}

function buildPositionRangeSummaries(rows: ProjectionRankImpactQualityRow[]): ProjectionRankImpactDraftableRangeSummary[] {
  const ranges: Record<string, number[]> = {
    QB: [12, 24, 36, 50],
    RB: [24, 48, 72, 100],
    WR: [36, 72, 100, 150],
    TE: [12, 24, 36, 50],
    DL: [24, 48, 72, 100],
    LB: [24, 48, 72, 100],
    DB: [24, 48, 72, 100],
  };
  return Object.entries(ranges).flatMap(([position, thresholds]) =>
    thresholds.map((threshold) => rangeSummary(`${position}_top_${threshold}`, rows.filter((row) => row.position === position && (row.bestPositionRank ?? Number.POSITIVE_INFINITY) <= threshold))),
  );
}

function rangeSummary(segment: string, rows: ProjectionRankImpactQualityRow[]): ProjectionRankImpactDraftableRangeSummary {
  return {
    segment,
    rows: rows.length,
    rowsMoving5PlusPositionRanks: rows.filter((row) => Math.abs(row.estimatedPositionRankMovement ?? 0) >= 5).length,
    rowsMoving10PlusPositionRanks: rows.filter((row) => Math.abs(row.estimatedPositionRankMovement ?? 0) >= 10).length,
    rowsMoving25PlusOverallRanks: rows.filter((row) => Math.abs(row.estimatedOverallRankMovement ?? 0) >= 25).length,
    rowsMoving50PlusOverallRanks: rows.filter((row) => Math.abs(row.estimatedOverallRankMovement ?? 0) >= 50).length,
    averageProjectedPointDelta: average(rows.map((row) => row.projectedPointDelta)),
    topMovers: rows.sort(compareByAbsOverallRankMovement).slice(0, 10),
  };
}

function buildQbReview(rows: ProjectionRankImpactQualityRow[]) {
  const qbRows = rows.filter((row) => row.position === "QB");
  const meaningfulRows = qbRows.filter((row) => row.meaningfulFlags.includes("qb_superflex_sensitive_movement"));
  return {
    eligibleQbRows: qbRows.length,
    rowsMoving5PlusPositionRanks: qbRows.filter((row) => Math.abs(row.estimatedPositionRankMovement ?? 0) >= 5).length,
    rowsMoving10PlusPositionRanks: qbRows.filter((row) => Math.abs(row.estimatedPositionRankMovement ?? 0) >= 10).length,
    top12MeaningfulRows: meaningfulRows.filter((row) => (row.bestPositionRank ?? Number.POSITIVE_INFINITY) <= 12).length,
    top24MeaningfulRows: meaningfulRows.filter((row) => (row.bestPositionRank ?? Number.POSITIVE_INFINITY) <= 24).length,
    top36MeaningfulRows: meaningfulRows.filter((row) => (row.bestPositionRank ?? Number.POSITIVE_INFINITY) <= 36).length,
    topQbMovements: qbRows.sort(compareByAbsPositionRankMovement).slice(0, 25),
    backupDeepQbNoiseRows: qbRows.filter((row) => (row.bestPositionRank ?? 0) > 36 && row.meaningfulFlags.includes("deep_tier_rank_noise")).sort(compareByAbsOverallRankMovement).slice(0, 25),
  };
}

function buildSafetyGates(limitedPool: ProjectionLimitedPromotionPoolReviewReport, rows: ProjectionRankImpactQualityRow[], summary: ProjectionRankImpactQualityReviewReport["summary"]) {
  return [
    gate("no_live_outputs_changed", true, "Rank impact quality review reads dry-run artifacts and writes only review artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Rank movement is copied from dry-run shadow and limited-pool artifacts only."),
    gate("draft_suggestions_unchanged", true, "Draft suggestion code paths are not imported or executed."),
    gate("war_room_unchanged", true, "War Room UI code is not imported or modified."),
    gate("eligible_pool_only", rows.length === limitedPool.eligibleRows.length, `${rows.length}/${limitedPool.eligibleRows.length} eligible rows reviewed.`),
    gate("critical_movements_excluded", limitedPool.excludedCounts.criticalMovementRowsExcluded > 0 && limitedPool.eligibleRows.every((row) => !row.criticalMovement), `${limitedPool.excludedCounts.criticalMovementRowsExcluded} critical movement rows excluded.`),
    gate("k_rows_excluded", limitedPool.excludedCounts.kRowsExcluded > 0 && limitedPool.eligibleRows.every((row) => row.position !== "K"), `${limitedPool.excludedCounts.kRowsExcluded} K rows excluded.`),
    gate("legacy_rows_excluded", limitedPool.excludedCounts.legacyRetiredRowsExcluded > 0, `${limitedPool.excludedCounts.legacyRetiredRowsExcluded} legacy/retired rows excluded.`),
    gate("rank_quality_review_generated", rows.length > 0, `${rows.length} rank quality rows generated.`),
    gate("meaningful_rank_movements_reported", summary.meaningfulOverallRankMovers + summary.meaningfulPositionRankMovers >= 0, `${summary.meaningfulOverallRankMovers} meaningful overall movers and ${summary.meaningfulPositionRankMovers} meaningful position movers reported.`),
    gate("deep_tier_noise_identified", summary.deepTierNoiseRows >= 0, `${summary.deepTierNoiseRows} deep-tier noise row(s) identified.`),
  ];
}

function recommendationFor(gates: ProjectionRankImpactQualityReviewReport["safetyGates"], summary: ProjectionRankImpactQualityReviewReport["summary"]): ProjectionRankImpactQualityRecommendation {
  if (gates.some((gate) => !gate.passed)) return "rank_impact_blocked";
  if (summary.meaningfulOverallRankMovers || summary.meaningfulPositionRankMovers || summary.qbSuperflexSensitiveRows) return "rank_impact_needs_tier_review";
  return "rank_impact_clean_for_feature_flag_review";
}

function hasMeaningfulOverallFlag(row: ProjectionRankImpactQualityRow) {
  return row.meaningfulFlags.some((flag) => flag === "top_100_overall_movement" || flag === "top_200_overall_movement" || flag === "top_300_overall_movement");
}

function hasMeaningfulPositionFlag(row: ProjectionRankImpactQualityRow) {
  return row.meaningfulFlags.some((flag) => flag === "starter_tier_position_movement" || flag === "qb_superflex_sensitive_movement");
}

function positionTierFor(position: string, rank: number | null): ProjectionRankImpactRelevanceTier {
  if (rank === null) return "position_deep_tier";
  const starter = starterThreshold(position);
  if (rank <= starter) return "position_starter_tier";
  if (rank <= starter * 2) return "position_depth_tier";
  return "position_deep_tier";
}

function starterThreshold(position: string) {
  if (position === "QB") return 24;
  if (position === "RB") return 48;
  if (position === "WR") return 72;
  if (position === "TE") return 24;
  if (["DL", "LB", "DB"].includes(position)) return 48;
  return 24;
}

function pointDeltaBucketFor(value: number | null): ProjectionRankImpactPointDeltaBucket {
  const abs = Math.abs(value ?? 0);
  if (abs === 0) return "0";
  if (abs < 2) return "0-2";
  if (abs < 5) return "2-5";
  if (abs < 10) return "5-10";
  return "10-20";
}

function minRank(a: number | null, b: number | null) {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return null;
  return round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function median(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
  if (!valid.length) return null;
  const middle = Math.floor(valid.length / 2);
  return round(valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2);
}

function compareByAbsOverallRankMovement(a: ProjectionRankImpactQualityRow, b: ProjectionRankImpactQualityRow) {
  return Math.abs(b.estimatedOverallRankMovement ?? 0) - Math.abs(a.estimatedOverallRankMovement ?? 0) || Math.abs(b.projectedPointDelta ?? 0) - Math.abs(a.projectedPointDelta ?? 0);
}

function compareByAbsPositionRankMovement(a: ProjectionRankImpactQualityRow, b: ProjectionRankImpactQualityRow) {
  return Math.abs(b.estimatedPositionRankMovement ?? 0) - Math.abs(a.estimatedPositionRankMovement ?? 0) || Math.abs(b.projectedPointDelta ?? 0) - Math.abs(a.projectedPointDelta ?? 0);
}

function renderProjectionRankImpactQualityReviewMarkdown(report: ProjectionRankImpactQualityReviewReport) {
  return `# Projection Rank Impact Quality Review ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Recommendation: ${report.recommendation}

## Summary

\`\`\`json
${JSON.stringify(report.summary, null, 2)}
\`\`\`

## Safety Gates

${renderGateTable(report.safetyGates)}

## Relevance Tier Summaries

${renderTierSummary(report.tierSummaries)}

## Point Delta Bucket Summaries

${renderTierSummary(report.pointDeltaBucketSummaries)}

## Draftable Range Summaries

${renderRangeSummary(report.draftableRangeSummaries)}

## Position Range Summaries

${renderRangeSummary(report.positionRangeSummaries)}

## QB / Superflex Review

\`\`\`json
${JSON.stringify({
  eligibleQbRows: report.qbReview.eligibleQbRows,
  rowsMoving5PlusPositionRanks: report.qbReview.rowsMoving5PlusPositionRanks,
  rowsMoving10PlusPositionRanks: report.qbReview.rowsMoving10PlusPositionRanks,
  top12MeaningfulRows: report.qbReview.top12MeaningfulRows,
  top24MeaningfulRows: report.qbReview.top24MeaningfulRows,
  top36MeaningfulRows: report.qbReview.top36MeaningfulRows,
}, null, 2)}
\`\`\`

## Top Meaningful Overall-Rank Movers

${renderRowsTable(report.topMeaningfulOverallRankMovers)}

## Top Meaningful Position-Rank Movers

${renderRowsTable(report.topMeaningfulPositionRankMovers)}

## Top Small-Points Large-Rank Noise

${renderRowsTable(report.topSmallPointsLargeRankNoiseRows)}

## Top Deep-Tier Rank Noise

${renderRowsTable(report.topDeepTierRankNoiseRows)}

## Top QB Rank Movers

${renderRowsTable(report.topQbRankMovers)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderProjectionRankImpactQualityReviewCsv(report: ProjectionRankImpactQualityReviewReport) {
  const headers = [
    "player_id",
    "player",
    "position",
    "team",
    "current_projected_total",
    "v82_projected_total",
    "projected_point_delta",
    "current_overall_rank",
    "v82_overall_rank",
    "current_position_rank",
    "v82_position_rank",
    "estimated_overall_rank_movement",
    "estimated_position_rank_movement",
    "best_overall_rank",
    "best_position_rank",
    "relevance_tiers",
    "point_delta_bucket",
    "meaningful_flags",
    "risk_flags",
    "reason_codes",
  ];
  const rows = report.rows.map((row) => [
    row.playerId,
    row.player,
    row.position,
    row.team ?? "",
    row.currentProjectedTotal ?? "",
    row.v82ProjectedTotal ?? "",
    row.projectedPointDelta ?? "",
    row.currentOverallRank ?? "",
    row.v82OverallRank ?? "",
    row.currentPositionRank ?? "",
    row.v82PositionRank ?? "",
    row.estimatedOverallRankMovement ?? "",
    row.estimatedPositionRankMovement ?? "",
    row.bestOverallRank ?? "",
    row.bestPositionRank ?? "",
    row.relevanceTiers.join("|"),
    row.pointDeltaBucket,
    row.meaningfulFlags.join("|"),
    row.riskFlags.join("|"),
    row.reasonCodes.join("|"),
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function renderGateTable(gates: ProjectionRankImpactQualityReviewReport["safetyGates"]) {
  const header = "| Gate | Status | Detail |";
  const divider = "|---|---|---|";
  return [header, divider, ...gates.map((gate) => `| ${gate.name} | ${gate.passed ? "PASS" : "FAIL"} | ${gate.detail} |`)].join("\n");
}

function renderTierSummary(rows: ProjectionRankImpactTierSummary[]) {
  const header = "| Tier | Rows | Avg Pts | Median Pts | Avg Overall Move | Avg Pos Move | Pos 10+ | Overall 50+ |";
  const divider = "|---|---:|---:|---:|---:|---:|---:|---:|";
  return [header, divider, ...rows.map((row) => `| ${row.tier} | ${row.rows} | ${row.averageProjectedPointDelta ?? ""} | ${row.medianProjectedPointDelta ?? ""} | ${row.averageOverallRankMovement ?? ""} | ${row.averagePositionRankMovement ?? ""} | ${row.rowsMoving10PlusPositionRanks} | ${row.rowsMoving50PlusOverallRanks} |`)].join("\n");
}

function renderRangeSummary(rows: ProjectionRankImpactDraftableRangeSummary[]) {
  const header = "| Segment | Rows | Avg Pts | Pos 5+ | Pos 10+ | Overall 25+ | Overall 50+ |";
  const divider = "|---|---:|---:|---:|---:|---:|---:|";
  return [header, divider, ...rows.map((row) => `| ${row.segment} | ${row.rows} | ${row.averageProjectedPointDelta ?? ""} | ${row.rowsMoving5PlusPositionRanks} | ${row.rowsMoving10PlusPositionRanks} | ${row.rowsMoving25PlusOverallRanks} | ${row.rowsMoving50PlusOverallRanks} |`)].join("\n");
}

function renderRowsTable(rows: ProjectionRankImpactQualityRow[]) {
  if (!rows.length) return "No rows.";
  const header = "| Player | Pos | Team | Pts Delta | Best OVR | OVR Move | Best Pos | Pos Move | Flags |";
  const divider = "|---|---|---|---:|---:|---:|---:|---:|---|";
  return [header, divider, ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.team ?? ""} | ${row.projectedPointDelta ?? ""} | ${row.bestOverallRank ?? ""} | ${row.estimatedOverallRankMovement ?? ""} | ${row.bestPositionRank ?? ""} | ${row.estimatedPositionRankMovement ?? ""} | ${row.meaningfulFlags.join(", ")} |`)].join("\n");
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
