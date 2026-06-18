import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { PreseasonProjectionSnapshot } from "./preseason-projection-snapshot-types";
import type { ProjectionPromotionCandidatePoolReport } from "./projection-promotion-candidate-pool-types";
import type { ProjectionPromotionReadinessFinalReport, ProjectionPromotionReadinessFinalRow } from "./projection-promotion-readiness-final-types";
import type {
  ProjectionLimitedPromotionPoolMovementSummary,
  ProjectionLimitedPromotionPoolRankImpact,
  ProjectionLimitedPromotionPoolRecommendation,
  ProjectionLimitedPromotionPoolReviewArtifactPaths,
  ProjectionLimitedPromotionPoolReviewOptions,
  ProjectionLimitedPromotionPoolReviewReport,
  ProjectionLimitedPromotionPoolReviewRow,
  ProjectionLimitedPromotionPoolSegmentSummary,
} from "./projection-limited-promotion-pool-review-types";
import type { ProjectionUniverseEligibilityAuditReport } from "./projection-universe-eligibility-audit-types";
import type { ProjectionV82ShadowGamesBucket, ProjectionV82ShadowMovementBucket, ProjectionV82ShadowReport, ProjectionV82ShadowRow } from "./projection-v8-2-shadow-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const MOVEMENT_BUCKETS: ProjectionV82ShadowMovementBucket[] = ["0", "0-5", "5-10", "10-20", "20+"];
const GAMES_BUCKETS: ProjectionV82ShadowGamesBucket[] = ["0", "0-0.5", "0.5-1", "1-2", "2-4", "4+"];
const POSITION_ORDER = ["QB", "RB", "WR", "TE", "DL", "LB", "DB", "DST"];
const COHORT_ORDER = ["active_plausible", "low_confidence_plausible", "rookie_or_new_player", "low_prior_sample", "veteran_prior_sample", "offense", "idp"];

export function runProjectionLimitedPromotionPoolReview(options: ProjectionLimitedPromotionPoolReviewOptions): ProjectionLimitedPromotionPoolReviewReport {
  const finalReadinessPath = path.join(OUTPUT_DIR, `projection-promotion-readiness-final-${options.projectionSeason}.json`);
  const conservativeDecisionsPath = path.join(OUTPUT_DIR, `projection-promotion-review-decisions-${options.projectionSeason}.conservative.csv`);
  const candidatePoolPath = path.join(OUTPUT_DIR, `projection-promotion-candidate-pool-${options.projectionSeason}.json`);
  const shadowPath = path.join(OUTPUT_DIR, `projection-v8-2-shadow-${options.projectionSeason}.json`);
  const universePath = path.join(OUTPUT_DIR, `projection-universe-eligibility-audit-${options.projectionSeason}.json`);
  const snapshotPath = path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`);
  for (const artifactPath of [finalReadinessPath, conservativeDecisionsPath, candidatePoolPath, shadowPath, universePath, snapshotPath]) {
    if (!existsSync(artifactPath)) throw new Error(`Missing ${path.relative(process.cwd(), artifactPath)}.`);
  }

  return buildProjectionLimitedPromotionPoolReviewFromData({
    options,
    finalReadiness: JSON.parse(readFileSync(finalReadinessPath, "utf8")) as ProjectionPromotionReadinessFinalReport,
    candidatePool: JSON.parse(readFileSync(candidatePoolPath, "utf8")) as ProjectionPromotionCandidatePoolReport,
    shadow: JSON.parse(readFileSync(shadowPath, "utf8")) as ProjectionV82ShadowReport,
    universe: JSON.parse(readFileSync(universePath, "utf8")) as ProjectionUniverseEligibilityAuditReport,
    snapshot: JSON.parse(readFileSync(snapshotPath, "utf8")) as PreseasonProjectionSnapshot,
    sourceArtifacts: {
      finalReadiness: finalReadinessPath,
      conservativeDecisions: conservativeDecisionsPath,
      candidatePool: candidatePoolPath,
      shadow: shadowPath,
      universeEligibilityAudit: universePath,
      snapshot: snapshotPath,
    },
  });
}

export function buildProjectionLimitedPromotionPoolReviewFromData(input: {
  options: ProjectionLimitedPromotionPoolReviewOptions;
  finalReadiness: ProjectionPromotionReadinessFinalReport;
  candidatePool: ProjectionPromotionCandidatePoolReport;
  shadow: ProjectionV82ShadowReport;
  universe: ProjectionUniverseEligibilityAuditReport;
  snapshot: PreseasonProjectionSnapshot;
  sourceArtifacts?: ProjectionLimitedPromotionPoolReviewReport["sourceArtifacts"];
}): ProjectionLimitedPromotionPoolReviewReport {
  void input.candidatePool;
  void input.universe;
  void input.snapshot;
  const shadowByPlayerId = new Map(input.shadow.rows.map((row) => [row.playerId, row]));
  const eligibleRows = input.finalReadiness.finalRows
    .filter((row) => row.finalClassification === "eligible_for_projection_promotion")
    .map((row) => limitedRow(row, shadowByPlayerId.get(row.playerId) ?? null))
    .sort(compareByAbsMovement);
  const excludedCounts = buildExcludedCounts(input.finalReadiness.finalRows);
  const movementSummary = buildMovementSummary(eligibleRows);
  const positionSummary = buildSegmentSummary(eligibleRows, POSITION_ORDER, (row) => row.position);
  const cohortSummary = buildSegmentSummary(eligibleRows, COHORT_ORDER, cohortSegmentsFor);
  const rankImpactPreview = buildRankImpactPreview(eligibleRows);
  const topEligibleMovements = eligibleRows.slice(0, 50);
  const safetyGates = buildSafetyGates(eligibleRows, excludedCounts, rankImpactPreview);
  const recommendation = recommendationFor(safetyGates, rankImpactPreview, movementSummary);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? {
      finalReadiness: "in-memory",
      conservativeDecisions: "in-memory",
      candidatePool: "in-memory",
      shadow: "in-memory",
      universeEligibilityAudit: "in-memory",
      snapshot: "in-memory",
    },
    eligibleRows,
    excludedCounts,
    movementSummary,
    positionSummary,
    cohortSummary,
    rankImpactPreview,
    topEligibleMovements,
    safetyGates,
    recommendation,
    notes: [
      "Dry-run/read-only limited promotion-pool review only.",
      "Only final eligible_for_projection_promotion rows are evaluated.",
      "Critical movement rows, K rows, shadow-only rows, blocked rows, and remaining manual-review rows are excluded from the eligible pool.",
      "No live projections, 2026 production outputs, Supabase writes, War Room UI, Blackbird Rank, or Draft Suggestion ordering are changed.",
    ],
  };
}

export function writeProjectionLimitedPromotionPoolReviewArtifacts(report: ProjectionLimitedPromotionPoolReviewReport): ProjectionLimitedPromotionPoolReviewArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-limited-promotion-pool-review-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderProjectionLimitedPromotionPoolReviewMarkdown(report), "utf8");
  writeFileSync(csvPath, renderProjectionLimitedPromotionPoolReviewCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function limitedRow(row: ProjectionPromotionReadinessFinalRow, shadow: ProjectionV82ShadowRow | null): ProjectionLimitedPromotionPoolReviewRow {
  return {
    playerId: row.playerId,
    player: row.player,
    position: row.position,
    team: row.team,
    universeEligibilityStatus: row.universeEligibilityStatus,
    finalClassification: row.finalClassification,
    currentExpectedGames: row.currentExpectedGames,
    v82ExpectedGames: row.v82ExpectedGames,
    gamesDelta: row.gamesDelta,
    scoringAnchorPpg: shadow?.ppgAnchor ?? null,
    projectedPointDelta: row.projectedTotalPointDelta,
    currentProjectedTotal: shadow?.currentProjectedTotal ?? null,
    v82ProjectedTotal: shadow?.shadowProjectedTotal ?? null,
    movementBucket: shadow?.movementBucket ?? row.movementBucket,
    expectedGamesMovementBucket: shadow?.gamesBucket ?? bucketGames(row.gamesDelta),
    estimatedPositionRankMovement: shadow?.estimatedPositionRankMovement ?? null,
    estimatedOverallRankMovement: shadow?.estimatedOverallRankMovement ?? null,
    currentPositionRank: shadow?.currentPositionRank ?? null,
    v82PositionRank: shadow?.shadowPositionRank ?? null,
    currentOverallRank: shadow?.currentOverallRank ?? null,
    v82OverallRank: shadow?.shadowOverallRank ?? null,
    riskFlags: [...row.riskFlags],
    reasonCodes: [...row.reasonCodes],
    cohortTags: [...cohortSegmentsFor(row)],
    criticalMovement: row.criticalMovement,
  };
}

function buildExcludedCounts(rows: ProjectionPromotionReadinessFinalRow[]) {
  const excluded = rows.filter((row) => row.finalClassification !== "eligible_for_projection_promotion");
  return {
    criticalMovementRowsExcluded: excluded.filter((row) => row.criticalMovement).length,
    kRowsExcluded: excluded.filter((row) => row.position === "K").length,
    legacyRetiredRowsExcluded: excluded.filter((row) => row.universeEligibilityStatus === "retired_or_legacy_suspect").length,
    shadowOnlyRowsExcluded: rows.filter((row) => row.finalClassification === "shadow_only").length,
    blockedRowsExcluded: rows.filter((row) => row.finalClassification === "blocked_from_promotion").length,
    manualReviewRowsRemaining: rows.filter((row) => row.finalClassification === "manual_review_before_promotion").length,
  };
}

function buildMovementSummary(rows: ProjectionLimitedPromotionPoolReviewRow[]): ProjectionLimitedPromotionPoolMovementSummary {
  return {
    rows: rows.length,
    averageExpectedGamesDelta: average(rows.map((row) => row.gamesDelta)),
    averageProjectedPointDelta: average(rows.map((row) => row.projectedPointDelta)),
    medianProjectedPointDelta: median(rows.map((row) => row.projectedPointDelta)),
    maxProjectedPointDelta: max(rows.map((row) => row.projectedPointDelta)),
    movementBuckets: countBuckets(rows.map((row) => bucketMovement(row.projectedPointDelta)), MOVEMENT_BUCKETS),
    expectedGamesMovementBuckets: countBuckets(rows.map((row) => bucketGames(row.gamesDelta)), GAMES_BUCKETS),
  };
}

function buildSegmentSummary(rows: ProjectionLimitedPromotionPoolReviewRow[], order: string[], segmentFor: ((row: ProjectionLimitedPromotionPoolReviewRow) => string) | ((row: ProjectionLimitedPromotionPoolReviewRow) => string[])): ProjectionLimitedPromotionPoolSegmentSummary[] {
  const segments = new Map<string, ProjectionLimitedPromotionPoolReviewRow[]>();
  for (const row of rows) {
    const raw = segmentFor(row);
    for (const segment of Array.isArray(raw) ? raw : [raw]) {
      if (!segments.has(segment)) segments.set(segment, []);
      segments.get(segment)?.push(row);
    }
  }
  return [...new Set([...order, ...segments.keys()])]
    .filter((segment) => segments.has(segment))
    .map((segment) => {
      const segmentRows = segments.get(segment) ?? [];
      return {
        segment,
        rows: segmentRows.length,
        averageProjectedPointMovement: average(segmentRows.map((row) => row.projectedPointDelta)),
        rowsMoving5Plus: segmentRows.filter((row) => Math.abs(row.projectedPointDelta ?? 0) >= 5).length,
        rowsMoving10Plus: segmentRows.filter((row) => Math.abs(row.projectedPointDelta ?? 0) >= 10).length,
        rowsMoving20Plus: segmentRows.filter((row) => Math.abs(row.projectedPointDelta ?? 0) >= 20).length,
        topMovements: segmentRows.sort(compareByAbsMovement).slice(0, 10),
      };
    });
}

function buildRankImpactPreview(rows: ProjectionLimitedPromotionPoolReviewRow[]): ProjectionLimitedPromotionPoolRankImpact {
  const positionEstimated = rows.filter((row) => row.estimatedPositionRankMovement !== null);
  const overallEstimated = rows.filter((row) => row.estimatedOverallRankMovement !== null);
  const estimated = positionEstimated.length > 0 || overallEstimated.length > 0;
  return {
    estimated,
    reason: estimated ? "Rank movement copied from v8.2 shadow report estimates." : "No rank movement estimates were available in the v8.2 shadow report.",
    rowsWithRankMovementEstimate: new Set([...positionEstimated, ...overallEstimated].map((row) => row.playerId)).size,
    rowsWithPositionRankMovementEstimate: positionEstimated.length,
    rowsWithOverallRankMovementEstimate: overallEstimated.length,
    topPositionRankRisers: positionEstimated.filter((row) => (row.estimatedPositionRankMovement ?? 0) > 0).sort(comparePositionRankMovementDesc).slice(0, 25),
    topPositionRankFallers: positionEstimated.filter((row) => (row.estimatedPositionRankMovement ?? 0) < 0).sort(comparePositionRankMovementAsc).slice(0, 25),
    topOverallRankRisers: overallEstimated.filter((row) => (row.estimatedOverallRankMovement ?? 0) > 0).sort(compareOverallRankMovementDesc).slice(0, 25),
    topOverallRankFallers: overallEstimated.filter((row) => (row.estimatedOverallRankMovement ?? 0) < 0).sort(compareOverallRankMovementAsc).slice(0, 25),
    rowsMoving5PlusPositionRanks: positionEstimated.filter((row) => Math.abs(row.estimatedPositionRankMovement ?? 0) >= 5).length,
    rowsMoving10PlusPositionRanks: positionEstimated.filter((row) => Math.abs(row.estimatedPositionRankMovement ?? 0) >= 10).length,
    rowsMoving25PlusOverallRanks: overallEstimated.filter((row) => Math.abs(row.estimatedOverallRankMovement ?? 0) >= 25).length,
    rowsMoving50PlusOverallRanks: overallEstimated.filter((row) => Math.abs(row.estimatedOverallRankMovement ?? 0) >= 50).length,
  };
}

function buildSafetyGates(rows: ProjectionLimitedPromotionPoolReviewRow[], excluded: ProjectionLimitedPromotionPoolReviewReport["excludedCounts"], rankImpact: ProjectionLimitedPromotionPoolRankImpact) {
  return [
    gate("no_live_outputs_changed", true, "Limited pool review reads dry-run artifacts and writes only review artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Rank movement is estimated from dry-run shadow artifacts only."),
    gate("draft_suggestions_unchanged", true, "Draft suggestion code paths are not imported or executed."),
    gate("war_room_unchanged", true, "War Room UI code is not imported or modified."),
    gate("eligible_pool_generated", rows.length > 0, `${rows.length} eligible row(s).`),
    gate("manual_review_rows_zero", excluded.manualReviewRowsRemaining === 0, `${excluded.manualReviewRowsRemaining} manual-review row(s) remaining.`),
    gate("critical_movements_excluded", rows.every((row) => !row.criticalMovement), `${rows.filter((row) => row.criticalMovement).length} critical movement eligible row(s).`),
    gate("k_rows_excluded", rows.every((row) => row.position !== "K"), `${rows.filter((row) => row.position === "K").length} eligible K row(s).`),
    gate("legacy_rows_excluded", rows.every((row) => row.universeEligibilityStatus !== "retired_or_legacy_suspect"), `${rows.filter((row) => row.universeEligibilityStatus === "retired_or_legacy_suspect").length} eligible legacy row(s).`),
    gate("no_20_plus_movement_in_eligible_pool", rows.every((row) => Math.abs(row.projectedPointDelta ?? 0) < 20), `${rows.filter((row) => Math.abs(row.projectedPointDelta ?? 0) >= 20).length} eligible 20+ movement row(s).`),
    gate("rank_impact_reported_or_explained", rankImpact.estimated || Boolean(rankImpact.reason), rankImpact.reason),
  ];
}

function recommendationFor(gates: ProjectionLimitedPromotionPoolReviewReport["safetyGates"], rankImpact: ProjectionLimitedPromotionPoolRankImpact, movement: ProjectionLimitedPromotionPoolMovementSummary): ProjectionLimitedPromotionPoolRecommendation {
  if (gates.some((gate) => !gate.passed)) return "limited_pool_blocked";
  if (movement.movementBuckets["10-20"] > 0 || rankImpact.rowsMoving10PlusPositionRanks > 0 || rankImpact.rowsMoving50PlusOverallRanks > 0) return "limited_pool_needs_rank_impact_review";
  return "limited_pool_clean_for_feature_flag_review";
}

function cohortSegmentsFor(row: Pick<ProjectionLimitedPromotionPoolReviewRow, "universeEligibilityStatus" | "position" | "riskFlags" | "reasonCodes">): string[] {
  const segments: string[] = [row.universeEligibilityStatus];
  if (row.riskFlags.includes("rookie_or_low_prior")) segments.push("low_prior_sample");
  else segments.push("veteran_prior_sample");
  if (["DL", "LB", "DB"].includes(row.position)) segments.push("idp");
  if (["QB", "RB", "WR", "TE"].includes(row.position)) segments.push("offense");
  return segments;
}

function bucketMovement(value: number | null): ProjectionV82ShadowMovementBucket {
  const abs = Math.abs(value ?? 0);
  if (abs === 0) return "0";
  if (abs < 5) return "0-5";
  if (abs < 10) return "5-10";
  if (abs < 20) return "10-20";
  return "20+";
}

function bucketGames(value: number | null): ProjectionV82ShadowGamesBucket {
  const abs = Math.abs(value ?? 0);
  if (abs === 0) return "0";
  if (abs < 0.5) return "0-0.5";
  if (abs < 1) return "0.5-1";
  if (abs < 2) return "1-2";
  if (abs < 4) return "2-4";
  return "4+";
}

function countBuckets<T extends string>(values: T[], buckets: T[]) {
  return Object.fromEntries(buckets.map((bucket) => [bucket, values.filter((value) => value === bucket).length])) as Record<T, number>;
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

function max(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return valid.length ? round(Math.max(...valid)) : null;
}

function compareByAbsMovement(a: ProjectionLimitedPromotionPoolReviewRow, b: ProjectionLimitedPromotionPoolReviewRow) {
  return Math.abs(b.projectedPointDelta ?? 0) - Math.abs(a.projectedPointDelta ?? 0) || a.player.localeCompare(b.player);
}

function comparePositionRankMovementDesc(a: ProjectionLimitedPromotionPoolReviewRow, b: ProjectionLimitedPromotionPoolReviewRow) {
  return (b.estimatedPositionRankMovement ?? 0) - (a.estimatedPositionRankMovement ?? 0) || compareByAbsMovement(a, b);
}

function comparePositionRankMovementAsc(a: ProjectionLimitedPromotionPoolReviewRow, b: ProjectionLimitedPromotionPoolReviewRow) {
  return (a.estimatedPositionRankMovement ?? 0) - (b.estimatedPositionRankMovement ?? 0) || compareByAbsMovement(a, b);
}

function compareOverallRankMovementDesc(a: ProjectionLimitedPromotionPoolReviewRow, b: ProjectionLimitedPromotionPoolReviewRow) {
  return (b.estimatedOverallRankMovement ?? 0) - (a.estimatedOverallRankMovement ?? 0) || compareByAbsMovement(a, b);
}

function compareOverallRankMovementAsc(a: ProjectionLimitedPromotionPoolReviewRow, b: ProjectionLimitedPromotionPoolReviewRow) {
  return (a.estimatedOverallRankMovement ?? 0) - (b.estimatedOverallRankMovement ?? 0) || compareByAbsMovement(a, b);
}

function renderProjectionLimitedPromotionPoolReviewMarkdown(report: ProjectionLimitedPromotionPoolReviewReport) {
  return `# Projection Limited Promotion-Pool Review ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Recommendation: ${report.recommendation}

## Excluded Counts

\`\`\`json
${JSON.stringify(report.excludedCounts, null, 2)}
\`\`\`

## Eligible-Pool Movement Summary

\`\`\`json
${JSON.stringify(report.movementSummary, null, 2)}
\`\`\`

## Rank Impact Preview

\`\`\`json
${JSON.stringify({
  estimated: report.rankImpactPreview.estimated,
  reason: report.rankImpactPreview.reason,
  rowsWithRankMovementEstimate: report.rankImpactPreview.rowsWithRankMovementEstimate,
  rowsMoving5PlusPositionRanks: report.rankImpactPreview.rowsMoving5PlusPositionRanks,
  rowsMoving10PlusPositionRanks: report.rankImpactPreview.rowsMoving10PlusPositionRanks,
  rowsMoving25PlusOverallRanks: report.rankImpactPreview.rowsMoving25PlusOverallRanks,
  rowsMoving50PlusOverallRanks: report.rankImpactPreview.rowsMoving50PlusOverallRanks,
}, null, 2)}
\`\`\`

## Safety Gates

${renderGateTable(report.safetyGates)}

## Position Summary

${renderSegmentSummary(report.positionSummary)}

## Cohort Summary

${renderSegmentSummary(report.cohortSummary)}

## Top Eligible Movements

${renderRowsTable(report.topEligibleMovements)}

## Top Position-Rank Risers

${renderRowsTable(report.rankImpactPreview.topPositionRankRisers)}

## Top Position-Rank Fallers

${renderRowsTable(report.rankImpactPreview.topPositionRankFallers)}

## Top Overall-Rank Risers

${renderRowsTable(report.rankImpactPreview.topOverallRankRisers)}

## Top Overall-Rank Fallers

${renderRowsTable(report.rankImpactPreview.topOverallRankFallers)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderProjectionLimitedPromotionPoolReviewCsv(report: ProjectionLimitedPromotionPoolReviewReport) {
  const headers = [
    "player_id",
    "player",
    "position",
    "team",
    "universe_eligibility_status",
    "current_expected_games",
    "v82_expected_games",
    "games_delta",
    "scoring_anchor_ppg",
    "projected_point_delta",
    "current_projected_total",
    "v82_projected_total",
    "estimated_position_rank_movement",
    "estimated_overall_rank_movement",
    "risk_flags",
    "reason_codes",
    "cohort_tags",
  ];
  const rows = report.eligibleRows.map((row) => [
    row.playerId,
    row.player,
    row.position,
    row.team ?? "",
    row.universeEligibilityStatus,
    row.currentExpectedGames ?? "",
    row.v82ExpectedGames ?? "",
    row.gamesDelta ?? "",
    row.scoringAnchorPpg ?? "",
    row.projectedPointDelta ?? "",
    row.currentProjectedTotal ?? "",
    row.v82ProjectedTotal ?? "",
    row.estimatedPositionRankMovement ?? "",
    row.estimatedOverallRankMovement ?? "",
    row.riskFlags.join("|"),
    row.reasonCodes.join("|"),
    row.cohortTags.join("|"),
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function renderGateTable(gates: ProjectionLimitedPromotionPoolReviewReport["safetyGates"]) {
  const header = "| Gate | Status | Detail |";
  const divider = "|---|---|---|";
  return [header, divider, ...gates.map((gate) => `| ${gate.name} | ${gate.passed ? "PASS" : "FAIL"} | ${gate.detail} |`)].join("\n");
}

function renderSegmentSummary(rows: ProjectionLimitedPromotionPoolSegmentSummary[]) {
  const header = "| Segment | Rows | Avg Point Move | 5+ | 10+ | 20+ |";
  const divider = "|---|---:|---:|---:|---:|---:|";
  return [header, divider, ...rows.map((row) => `| ${row.segment} | ${row.rows} | ${row.averageProjectedPointMovement ?? ""} | ${row.rowsMoving5Plus} | ${row.rowsMoving10Plus} | ${row.rowsMoving20Plus} |`)].join("\n");
}

function renderRowsTable(rows: ProjectionLimitedPromotionPoolReviewRow[]) {
  if (!rows.length) return "No rows.";
  const header = "| Player | Pos | Team | Universe | Current G | v8.2 G | PPG | Point Delta | Current Total | v8.2 Total | Pos Rank Move | Overall Rank Move |";
  const divider = "|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|";
  return [header, divider, ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.team ?? ""} | ${row.universeEligibilityStatus} | ${row.currentExpectedGames ?? ""} | ${row.v82ExpectedGames ?? ""} | ${row.scoringAnchorPpg ?? ""} | ${row.projectedPointDelta ?? ""} | ${row.currentProjectedTotal ?? ""} | ${row.v82ProjectedTotal ?? ""} | ${row.estimatedPositionRankMovement ?? ""} | ${row.estimatedOverallRankMovement ?? ""} |`)].join("\n");
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
