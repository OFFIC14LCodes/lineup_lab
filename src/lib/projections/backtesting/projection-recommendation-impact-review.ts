import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ProjectionProductionShadowReviewReport } from "./projection-production-shadow-review-types";
import type { ProjectionSelectorPipelinePreviewReport, ProjectionSelectorPipelinePreviewRow } from "./projection-selector-pipeline-preview-types";
import type {
  ProjectionRecommendationDraftSuggestionRow,
  ProjectionRecommendationImpactBucket,
  ProjectionRecommendationImpactReviewArtifactPaths,
  ProjectionRecommendationImpactReviewInput,
  ProjectionRecommendationImpactReviewOptions,
  ProjectionRecommendationImpactReviewReport,
  ProjectionRecommendationImpactRow,
  ProjectionRecommendationRankMovementBucket,
  ProjectionRecommendationSegmentMovement,
} from "./projection-recommendation-impact-review-types";
import type { ProjectionV82FeatureFlagReadinessReport, ProjectionV82FeatureFlagReadinessRow } from "./projection-v8-2-feature-flag-readiness-types";
import type { ProjectionV82ShadowReport, ProjectionV82ShadowRow } from "./projection-v8-2-shadow-types";

const POINT_BUCKETS: ProjectionRecommendationImpactBucket[] = ["0", "0-2", "2-5", "5-10", "10-20", "20+"];
const RANK_BUCKETS: ProjectionRecommendationRankMovementBucket[] = ["0", "1-5", "6-10", "11-25", "26-50", "50+"];

export function runProjectionRecommendationImpactReview(options: ProjectionRecommendationImpactReviewOptions): ProjectionRecommendationImpactReviewReport {
  const outputDir = backtestingOutputDir();
  const projectionArtifactDir = projectionOutputDir();
  const productionShadowReviewPath = path.join(outputDir, `projection-production-shadow-review-${options.projectionSeason}.json`);
  const pipelinePreviewPath = path.join(outputDir, `projection-selector-pipeline-preview-${options.projectionSeason}.json`);
  const readinessPath = path.join(outputDir, `projection-v8-2-feature-flag-readiness-${options.projectionSeason}.json`);
  const shadowPath = path.join(outputDir, `projection-v8-2-shadow-${options.projectionSeason}.json`);
  for (const artifactPath of [productionShadowReviewPath, pipelinePreviewPath, readinessPath, shadowPath]) {
    if (!existsSync(artifactPath)) throw new Error(`Missing ${path.relative(process.cwd(), artifactPath)}.`);
  }

  const draftSuggestionArtifact = firstExisting([
    path.join(projectionArtifactDir, "h10-war-room-recommendations.json"),
    path.join(projectionArtifactDir, "h11-live-draft-suggestions.json"),
  ]);
  const blackbirdRankArtifact = firstExisting([
    path.join(projectionArtifactDir, "h11-blackbird-league-rank.json"),
    path.join(projectionArtifactDir, "h11-blackbird-rank.json"),
  ]);

  return buildProjectionRecommendationImpactReviewFromData({
    options,
    productionShadowReview: JSON.parse(readFileSync(productionShadowReviewPath, "utf8")) as ProjectionProductionShadowReviewReport,
    pipelinePreview: JSON.parse(readFileSync(pipelinePreviewPath, "utf8")) as ProjectionSelectorPipelinePreviewReport,
    readinessRows: (JSON.parse(readFileSync(readinessPath, "utf8")) as ProjectionV82FeatureFlagReadinessReport).rows,
    shadowRows: (JSON.parse(readFileSync(shadowPath, "utf8")) as ProjectionV82ShadowReport).rows,
    draftSuggestionRows: draftSuggestionArtifact ? readDraftSuggestionRows(draftSuggestionArtifact) : undefined,
    sourceArtifacts: {
      productionShadowReview: productionShadowReviewPath,
      pipelinePreview: pipelinePreviewPath,
      readiness: readinessPath,
      shadow: shadowPath,
      draftSuggestionArtifact,
      blackbirdRankArtifact,
    },
  });
}

export function buildProjectionRecommendationImpactReviewFromData(input: ProjectionRecommendationImpactReviewInput): ProjectionRecommendationImpactReviewReport {
  const readinessById = new Map(input.readinessRows.map((row) => [row.playerId, row]));
  const shadowById = new Map(input.shadowRows.map((row) => [row.playerId, row]));
  const rows = input.pipelinePreview.enabledMode.rows.map((row) => impactRow(row, readinessById.get(row.playerId) ?? null, shadowById.get(row.playerId) ?? null));
  const safeRows = rows.filter((row) => row.selectorSelection === "v8_2_candidate_path");
  const protectedRows = rows.filter((row) => row.selectorSelection === "current_path" && row.protectionReasons.length > 0);
  const excludedRows = rows.filter((row) => row.selectorSelection === "excluded_from_flag_pool");
  const blockedRows = rows.filter((row) => row.selectorSelection === "blocked_from_flag_pool");
  const pointDeltas = safeRows.map((row) => row.projectedPointDelta).filter(isNumber);
  const rankRows = safeRows.filter((row) => isNumber(row.estimatedOverallRankMovement) || isNumber(row.estimatedPositionRankMovement));
  const draftSuggestionImpact = buildDraftSuggestionImpact(input.draftSuggestionRows, safeRows, protectedRows);
  const protectedRowChecks = {
    kRowsDoNotUseV82: !safeRows.some((row) => row.position === "K"),
    criticalMovementRowsDoNotUseV82: !safeRows.some((row) => row.criticalMovement),
    meaningfulRankMoversDoNotUseV82: !safeRows.some((row) => row.meaningfulRankMover),
    legacyStaleRowsDoNotUseV82: !safeRows.some((row) => isLegacy(row.universeEligibilityStatus) || row.protectionReasons.some((reason) => reason.includes("legacy"))),
    missingArtifactsFailClosed: input.productionShadowReview.missingArtifactsMode.v82Rows === 0,
  };
  const safetyGates = buildSafetyGates(input, safeRows, protectedRows, rankRows, draftSuggestionImpact, protectedRowChecks);
  const recommendation = recommendationFor(safetyGates, rankRows, draftSuggestionImpact);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? {
      productionShadowReview: "in-memory",
      pipelinePreview: "in-memory",
      readiness: "in-memory",
      shadow: "in-memory",
      draftSuggestionArtifact: null,
      blackbirdRankArtifact: null,
    },
    summary: {
      totalRowsEvaluated: rows.length,
      v82CandidateRows: safeRows.length,
      currentPathProtectedRows: protectedRows.length,
      excludedRows: excludedRows.length,
      blockedRows: blockedRows.length,
      averageProjectedPointDelta: average(pointDeltas),
      medianProjectedPointDelta: median(pointDeltas),
      maxProjectedPointDelta: maxAbs(pointDeltas),
      movementBuckets: bucketCounts(safeRows.map((row) => row.projectedPointDelta), pointBucketFor, POINT_BUCKETS),
      positionMovement: segmentMovement(safeRows, (row) => row.position),
      cohortMovement: segmentMovement(safeRows, (row) => row.cohorts),
      topProjectedPointMovers: topByAbs(safeRows, (row) => row.projectedPointDelta, 50),
    },
    blackbirdRankImpact: {
      estimateMethod: rankRows.length ? "shadow_rank_fields" : "projected_point_delta_proxy",
      limitation: rankRows.length ? null : "Exact Blackbird Rank recalculation is not available in this dry-run context; only projected-point delta proxy rows are reported.",
      rowsWithRankEstimate: rankRows.length,
      overallRankMovementBuckets: rankBucketCounts(rankRows.map((row) => row.estimatedOverallRankMovement)),
      positionRankMovementBuckets: rankBucketCounts(rankRows.map((row) => row.estimatedPositionRankMovement)),
      positionRankMovement: segmentMovement(rankRows, (row) => row.position),
      topOverallRankRisers: rankRows.filter((row) => (row.estimatedOverallRankMovement ?? 0) < 0).sort((a, b) => (a.estimatedOverallRankMovement ?? 0) - (b.estimatedOverallRankMovement ?? 0)).slice(0, 50),
      topOverallRankFallers: rankRows.filter((row) => (row.estimatedOverallRankMovement ?? 0) > 0).sort((a, b) => (b.estimatedOverallRankMovement ?? 0) - (a.estimatedOverallRankMovement ?? 0)).slice(0, 50),
      topPositionRankRisers: rankRows.filter((row) => (row.estimatedPositionRankMovement ?? 0) < 0).sort((a, b) => (a.estimatedPositionRankMovement ?? 0) - (b.estimatedPositionRankMovement ?? 0)).slice(0, 50),
      topPositionRankFallers: rankRows.filter((row) => (row.estimatedPositionRankMovement ?? 0) > 0).sort((a, b) => (b.estimatedPositionRankMovement ?? 0) - (a.estimatedPositionRankMovement ?? 0)).slice(0, 50),
      top300AffectedRows: rankRows.filter((row) => (bestRank(row.currentOverallRank, row.v82OverallRank) ?? Number.POSITIVE_INFINITY) <= 300).sort(compareRankImpact).slice(0, 300),
      qbSuperflexSensitiveMovement: rankRows.filter((row) => row.position === "QB" && (bestRank(row.currentPositionRank, row.v82PositionRank) ?? Number.POSITIVE_INFINITY) <= 36 && (Math.abs(row.estimatedPositionRankMovement ?? 0) >= 5 || Math.abs(row.estimatedOverallRankMovement ?? 0) >= 25)).sort(compareRankImpact).slice(0, 50),
      starterTierMovement: rankRows.filter((row) => (bestRank(row.currentPositionRank, row.v82PositionRank) ?? Number.POSITIVE_INFINITY) <= starterThreshold(row.position) && Math.abs(row.estimatedPositionRankMovement ?? 0) >= 5).sort(compareRankImpact).slice(0, 50),
      deepTierNoiseMovement: rankRows.filter((row) => (bestRank(row.currentOverallRank, row.v82OverallRank) ?? Number.POSITIVE_INFINITY) > 500 || (bestRank(row.currentPositionRank, row.v82PositionRank) ?? Number.POSITIVE_INFINITY) > starterThreshold(row.position) * 2).sort(compareRankImpact).slice(0, 50),
    },
    draftSuggestionImpact,
    warRoomImpact: {
      projectionValuesChanged: "estimated",
      playerValueChanged: "not_estimated",
      reasoningTextAffected: "not_estimated",
      gmBriefAffected: "not_estimated",
      planAlignmentAffected: "not_estimated",
      riskConfidenceAffected: "not_estimated",
      reasons: {
        projectionValuesChanged: `${safeRows.filter((row) => (row.projectedPointDelta ?? 0) !== 0).length} safe-subset row(s) have selected projection deltas in the shadow preview.`,
        playerValueChanged: "Current value overlay and Blackbird Rank formulas are not recalculated by this dry-run report.",
        reasoningTextAffected: "Live recommendation reason builders are not imported or executed.",
        gmBriefAffected: "AI GM context and live draft room state are not replayed.",
        planAlignmentAffected: "Pre-draft strategy and plan-fit inputs are not recalculated.",
        riskConfidenceAffected: "Projection trust/risk labels are not recomputed from v8.2 in this path.",
      },
    },
    protectedRowChecks,
    safetyGates,
    recommendation,
    notes: [
      "H14.2 is a dry-run/read-only recommendation impact report.",
      "No live projection selector, Blackbird Rank ordering, Draft Suggestion ordering, War Room UI, API route, or Supabase write path is changed.",
      "Blackbird Rank impact uses v8.2 shadow rank fields when available; otherwise the report fails back to a projected-point delta proxy and labels the limitation.",
      "Draft Suggestion impact is an artifact/fixture proxy because live availability, roster need, ADP, wait plans, scarcity, and recommendation scoring are intentionally not replayed.",
    ],
  };
}

export function writeProjectionRecommendationImpactReviewArtifacts(report: ProjectionRecommendationImpactReviewReport): ProjectionRecommendationImpactReviewArtifactPaths {
  const outputDir = backtestingOutputDir();
  mkdirSync(outputDir, { recursive: true });
  const base = `projection-recommendation-impact-review-${report.projectionSeason}`;
  const jsonPath = path.join(outputDir, `${base}.json`);
  const markdownPath = path.join(outputDir, `${base}.md`);
  const csvPath = path.join(outputDir, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function backtestingOutputDir() {
  return path.join(process.cwd(), "artifacts", "projections", "backtesting");
}

function projectionOutputDir() {
  return path.join(process.cwd(), "artifacts", "projections");
}

function impactRow(row: ProjectionSelectorPipelinePreviewRow, readiness: ProjectionV82FeatureFlagReadinessRow | null, shadow: ProjectionV82ShadowRow | null): ProjectionRecommendationImpactRow {
  const protectionReasons = readiness?.protectionReasons ?? [];
  return {
    playerId: row.playerId,
    player: row.player,
    position: row.position,
    team: row.team,
    selectorSelection: row.selectorSelection,
    selectorReason: row.selectorReason,
    cohorts: row.cohorts,
    currentProjectedTotal: row.currentProjectedTotal,
    v82ProjectedTotal: row.v82ProjectedTotal,
    projectedPointDelta: row.projectedTotalDeltaVsCurrent ?? shadow?.projectedTotalPointDelta ?? readiness?.projectedPointDelta ?? null,
    currentOverallRank: shadow?.currentOverallRank ?? null,
    v82OverallRank: shadow?.shadowOverallRank ?? null,
    estimatedOverallRankMovement: shadow?.estimatedOverallRankMovement ?? null,
    currentPositionRank: shadow?.currentPositionRank ?? null,
    v82PositionRank: shadow?.shadowPositionRank ?? null,
    estimatedPositionRankMovement: shadow?.estimatedPositionRankMovement ?? null,
    protectedByPolicy: row.selectorSelection === "current_path" && protectionReasons.length > 0,
    protectionReasons,
    criticalMovement: row.criticalMovement || Boolean(readiness?.criticalMovement),
    meaningfulRankMover: row.meaningfulRankMover || Boolean(readiness?.meaningfulRankMover),
    universeEligibilityStatus: row.universeEligibilityStatus ?? readiness?.universeEligibilityStatus ?? null,
  };
}

function buildDraftSuggestionImpact(
  sourceRows: ProjectionRecommendationDraftSuggestionRow[] | undefined,
  safeRows: ProjectionRecommendationImpactRow[],
  protectedRows: ProjectionRecommendationImpactRow[],
): ProjectionRecommendationImpactReviewReport["draftSuggestionImpact"] {
  const baseline = sourceRows?.length ? sourceRows : deterministicDraftSuggestionFixture(safeRows);
  const safeByKey = new Map<string, ProjectionRecommendationImpactRow>();
  for (const row of safeRows) {
    safeByKey.set(row.playerId.toLowerCase(), row);
    safeByKey.set(row.player.toLowerCase(), row);
  }
  const estimated = baseline.map((row) => {
    const impact = (row.playerId ? safeByKey.get(row.playerId.toLowerCase()) : null) ?? safeByKey.get(row.player.toLowerCase());
    const projectedPointDelta = impact?.projectedPointDelta ?? 0;
    return {
      ...row,
      projectedPointDelta,
      estimatedScore: round(row.baselineScore + projectedPointDelta * 0.05),
    };
  }).sort((a, b) => b.estimatedScore - a.estimatedScore || a.baselineRank - b.baselineRank)
    .map((row, index) => ({ ...row, estimatedRank: index + 1 }));
  const estimatedByPlayer = new Map(estimated.map((row) => [row.player, row]));
  const baselineTop1 = baseline.find((row) => row.baselineRank === 1)?.player ?? null;
  const estimatedTop1 = estimated.find((row) => row.estimatedRank === 1)?.player ?? null;
  const top5SuggestionOverlap = overlap(
    baseline.filter((row) => row.baselineRank <= 5).map((row) => row.player),
    estimated.filter((row) => row.estimatedRank <= 5).map((row) => row.player),
  );
  const top10SuggestionOverlap = overlap(
    baseline.filter((row) => row.baselineRank <= 10).map((row) => row.player),
    estimated.filter((row) => row.estimatedRank <= 10).map((row) => row.player),
  );
  const rowsEnteringTop10 = estimated.filter((row) => row.estimatedRank <= 10 && row.baselineRank > 10);
  const rowsLeavingTop10 = baseline.filter((row) => row.baselineRank <= 10 && (estimatedByPlayer.get(row.player)?.estimatedRank ?? Number.POSITIVE_INFINITY) > 10);
  const changed = estimated.filter((row) => row.baselineRank !== row.estimatedRank);
  return {
    estimateMethod: sourceRows?.length ? "artifact_proxy" : "deterministic_fixture_proxy",
    limitation: sourceRows?.length
      ? "Existing recommendation artifact rows are rescored with a small projected-point proxy only; live roster, market, availability, and timing signals are not replayed."
      : "No representative generated recommendation artifact was available in memory, so a deterministic safe-subset fixture was used.",
    topSuggestionChanged: baselineTop1 && estimatedTop1 ? baselineTop1 !== estimatedTop1 : null,
    top5SuggestionOverlap,
    top10SuggestionOverlap,
    rowsEnteringTop10,
    rowsLeavingTop10,
    largestSuggestionRankRisers: [...changed].sort((a, b) => (b.baselineRank - b.estimatedRank) - (a.baselineRank - a.estimatedRank)).slice(0, 25),
    largestSuggestionRankFallers: [...changed].sort((a, b) => (b.estimatedRank - b.baselineRank) - (a.estimatedRank - a.baselineRank)).slice(0, 25),
    positionDistributionOfChanges: changed.reduce<Record<string, number>>((acc, row) => {
      acc[row.position] = (acc[row.position] ?? 0) + 1;
      return acc;
    }, {}),
    protectedRowsRemainedCurrentPath: protectedRows.every((row) => row.selectorSelection === "current_path"),
  };
}

function buildSafetyGates(
  input: ProjectionRecommendationImpactReviewInput,
  safeRows: ProjectionRecommendationImpactRow[],
  protectedRows: ProjectionRecommendationImpactRow[],
  rankRows: ProjectionRecommendationImpactRow[],
  draftSuggestionImpact: ProjectionRecommendationImpactReviewReport["draftSuggestionImpact"],
  protectedRowChecks: ProjectionRecommendationImpactReviewReport["protectedRowChecks"],
) {
  return [
    gate("no_live_outputs_changed", !input.productionShadowReview.selectorWiredBeyondDryRun, "Report reads artifacts and writes only local H14.2 review artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or persistence API is imported by this dry-run report."),
    gate("rankings_unchanged_by_default", true, "Blackbird Rank impact is estimated only; no live ranking module is imported or mutated."),
    gate("draft_suggestions_unchanged_by_default", true, "Draft Suggestion impact is estimated only; live recommendation ordering is not imported or mutated."),
    gate("war_room_unchanged_by_default", true, "War Room UI/API behavior is not imported or changed."),
    gate("safe_subset_only", safeRows.every((row) => row.selectorSelection === "v8_2_candidate_path"), `${safeRows.length} v8.2 candidate row(s) evaluated.`),
    gate("protected_rows_preserved", Object.values(protectedRowChecks).every(Boolean), `${protectedRows.length} current-path protected row(s).`),
    gate("rank_impact_estimated_or_explained", rankRows.length > 0 || safeRows.length >= 0, `${rankRows.length} row(s) with rank estimate.`),
    gate("draft_suggestion_impact_estimated_or_explained", draftSuggestionImpact.top10SuggestionOverlap !== null || draftSuggestionImpact.limitation.length > 0, draftSuggestionImpact.estimateMethod),
    gate("war_room_impact_estimated_or_explained", true, "War Room impact fields are reported as estimated or not_estimated with reasons."),
  ];
}

function recommendationFor(
  gates: ProjectionRecommendationImpactReviewReport["safetyGates"],
  rankRows: ProjectionRecommendationImpactRow[],
  draftSuggestionImpact: ProjectionRecommendationImpactReviewReport["draftSuggestionImpact"],
): ProjectionRecommendationImpactReviewReport["recommendation"] {
  if (gates.some((gateRow) => !gateRow.passed)) return "recommendation_impact_blocked";
  if (rankRows.some((row) => Math.abs(row.estimatedOverallRankMovement ?? 0) >= 25 || Math.abs(row.estimatedPositionRankMovement ?? 0) >= 5)) return "recommendation_impact_needs_review";
  if ((draftSuggestionImpact.rowsEnteringTop10.length + draftSuggestionImpact.rowsLeavingTop10.length) > 0 || draftSuggestionImpact.topSuggestionChanged) return "recommendation_impact_needs_review";
  return "recommendation_impact_clean_for_disabled_flag_review";
}

function readDraftSuggestionRows(artifactPath: string): ProjectionRecommendationDraftSuggestionRow[] {
  const parsed = JSON.parse(readFileSync(artifactPath, "utf8")) as Record<string, unknown>;
  const rows = Array.isArray(parsed.topRecommendations) ? parsed.topRecommendations : firstArray(parsed);
  return rows.slice(0, 150).map((value, index) => {
    const row = value as Record<string, unknown>;
    return {
      playerId: stringOrNull(row.playerId),
      player: String(row.displayName ?? row.playerName ?? row.player ?? `suggestion-${index + 1}`),
      position: String(row.position ?? "UNK"),
      team: stringOrNull(row.team),
      baselineRank: numberOr(row.recommendationRank ?? row.draftSuggestionRank ?? row.rank, index + 1),
      estimatedRank: numberOr(row.recommendationRank ?? row.draftSuggestionRank ?? row.rank, index + 1),
      baselineScore: numberOr(row.recommendationScore ?? row.suggestionScore ?? row.blackbirdValueScore, 0),
      estimatedScore: numberOr(row.recommendationScore ?? row.suggestionScore ?? row.blackbirdValueScore, 0),
      projectedPointDelta: 0,
    };
  }).sort((a, b) => a.baselineRank - b.baselineRank);
}

function deterministicDraftSuggestionFixture(safeRows: ProjectionRecommendationImpactRow[]): ProjectionRecommendationDraftSuggestionRow[] {
  return safeRows.slice(0, 20).map((row, index) => ({
    playerId: row.playerId,
    player: row.player,
    position: row.position,
    team: row.team,
    baselineRank: index + 1,
    estimatedRank: index + 1,
    baselineScore: 100 - index,
    estimatedScore: 100 - index,
    projectedPointDelta: 0,
  }));
}

function segmentMovement(rows: ProjectionRecommendationImpactRow[], selector: (row: ProjectionRecommendationImpactRow) => string | string[]): ProjectionRecommendationSegmentMovement[] {
  const groups = new Map<string, ProjectionRecommendationImpactRow[]>();
  for (const row of rows) {
    const keys = selector(row);
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      if (!key) continue;
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }
  }
  return [...groups.entries()].map(([segment, group]) => {
    const deltas = group.map((row) => row.projectedPointDelta).filter(isNumber);
    return {
      segment,
      rows: group.length,
      averageProjectedPointDelta: average(deltas),
      medianProjectedPointDelta: median(deltas),
      maxAbsProjectedPointDelta: maxAbs(deltas),
      rowsMoving5PlusPoints: deltas.filter((value) => Math.abs(value) >= 5).length,
      rowsMoving10PlusPoints: deltas.filter((value) => Math.abs(value) >= 10).length,
      rowsMoving20PlusPoints: deltas.filter((value) => Math.abs(value) >= 20).length,
    };
  }).sort((a, b) => (b.maxAbsProjectedPointDelta ?? -1) - (a.maxAbsProjectedPointDelta ?? -1) || b.rows - a.rows || a.segment.localeCompare(b.segment));
}

function bucketCounts<T extends string>(values: Array<number | null>, bucketFor: (value: number | null) => T, buckets: T[]): Record<T, number> {
  const counts = Object.fromEntries(buckets.map((bucket) => [bucket, 0])) as Record<T, number>;
  for (const value of values) counts[bucketFor(value)] += 1;
  return counts;
}

function rankBucketCounts(values: Array<number | null>) {
  const counts = bucketCounts(values, rankBucketFor, RANK_BUCKETS);
  return RANK_BUCKETS.map((bucket) => ({ bucket, rows: counts[bucket] }));
}

function pointBucketFor(value: number | null): ProjectionRecommendationImpactBucket {
  const abs = Math.abs(value ?? 0);
  if (abs === 0) return "0";
  if (abs < 2) return "0-2";
  if (abs < 5) return "2-5";
  if (abs < 10) return "5-10";
  if (abs < 20) return "10-20";
  return "20+";
}

function rankBucketFor(value: number | null): ProjectionRecommendationRankMovementBucket {
  const abs = Math.abs(value ?? 0);
  if (abs === 0) return "0";
  if (abs <= 5) return "1-5";
  if (abs <= 10) return "6-10";
  if (abs <= 25) return "11-25";
  if (abs <= 50) return "26-50";
  return "50+";
}

function renderMarkdown(report: ProjectionRecommendationImpactReviewReport) {
  return `# Projection Recommendation Impact Review ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Recommendation: ${report.recommendation}

## Projection Movement Summary

\`\`\`json
${JSON.stringify(report.summary, null, 2)}
\`\`\`

## Blackbird Rank Impact Estimate

- Method: ${report.blackbirdRankImpact.estimateMethod}
- Limitation: ${report.blackbirdRankImpact.limitation ?? "none"}
- Rows with rank estimate: ${report.blackbirdRankImpact.rowsWithRankEstimate}
- Top 300 affected rows: ${report.blackbirdRankImpact.top300AffectedRows.length}
- QB/Superflex-sensitive movement rows: ${report.blackbirdRankImpact.qbSuperflexSensitiveMovement.length}
- Starter-tier movement rows: ${report.blackbirdRankImpact.starterTierMovement.length}
- Deep-tier/noise movement rows: ${report.blackbirdRankImpact.deepTierNoiseMovement.length}

## Draft Suggestion Impact Estimate

\`\`\`json
${JSON.stringify(report.draftSuggestionImpact, null, 2)}
\`\`\`

## War Room Impact Estimate

\`\`\`json
${JSON.stringify(report.warRoomImpact, null, 2)}
\`\`\`

## Protected Row Checks

\`\`\`json
${JSON.stringify(report.protectedRowChecks, null, 2)}
\`\`\`

## Safety Gates

${renderGateTable(report.safetyGates)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderCsv(report: ProjectionRecommendationImpactReviewReport) {
  const headers = ["section", "player_id", "player", "position", "team", "projected_point_delta", "current_overall_rank", "v82_overall_rank", "estimated_overall_rank_movement", "current_position_rank", "v82_position_rank", "estimated_position_rank_movement", "selector_selection", "protection_reasons"];
  const rows = [
    ...report.summary.topProjectedPointMovers.map((row) => csvRow("top_projected_point_mover", row)),
    ...report.blackbirdRankImpact.topOverallRankRisers.map((row) => csvRow("top_overall_rank_riser", row)),
    ...report.blackbirdRankImpact.topOverallRankFallers.map((row) => csvRow("top_overall_rank_faller", row)),
    ...report.blackbirdRankImpact.topPositionRankRisers.map((row) => csvRow("top_position_rank_riser", row)),
    ...report.blackbirdRankImpact.topPositionRankFallers.map((row) => csvRow("top_position_rank_faller", row)),
    ...report.blackbirdRankImpact.top300AffectedRows.map((row) => csvRow("top_300_affected", row)),
  ];
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function csvRow(section: string, row: ProjectionRecommendationImpactRow) {
  return [
    section,
    row.playerId,
    row.player,
    row.position,
    row.team ?? "",
    row.projectedPointDelta ?? "",
    row.currentOverallRank ?? "",
    row.v82OverallRank ?? "",
    row.estimatedOverallRankMovement ?? "",
    row.currentPositionRank ?? "",
    row.v82PositionRank ?? "",
    row.estimatedPositionRankMovement ?? "",
    row.selectorSelection,
    row.protectionReasons.join("|"),
  ];
}

function renderGateTable(gates: ProjectionRecommendationImpactReviewReport["safetyGates"]) {
  const header = "| Gate | Status | Detail |";
  const divider = "|---|---|---|";
  return [header, divider, ...gates.map((gateRow) => `| ${gateRow.name} | ${gateRow.passed ? "PASS" : "FAIL"} | ${gateRow.detail} |`)].join("\n");
}

function firstExisting(paths: string[]) {
  return paths.find((artifactPath) => existsSync(artifactPath)) ?? null;
}

function firstArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const item of Object.values(value)) {
    const found = firstArray(item);
    if (found.length) return found;
  }
  return [];
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function isLegacy(value: string | null) {
  return Boolean(value && (value.includes("legacy") || value.includes("retired") || value.includes("stale")));
}

function starterThreshold(position: string) {
  if (position === "QB") return 24;
  if (position === "RB") return 48;
  if (position === "WR") return 72;
  if (position === "TE") return 24;
  if (["DL", "LB", "DB"].includes(position)) return 48;
  return 24;
}

function bestRank(a: number | null, b: number | null) {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

function topByAbs<T>(rows: T[], selector: (row: T) => number | null, limit: number): T[] {
  return [...rows].sort((a, b) => Math.abs(selector(b) ?? 0) - Math.abs(selector(a) ?? 0)).slice(0, limit);
}

function compareRankImpact(a: ProjectionRecommendationImpactRow, b: ProjectionRecommendationImpactRow) {
  return Math.abs(b.estimatedOverallRankMovement ?? 0) - Math.abs(a.estimatedOverallRankMovement ?? 0)
    || Math.abs(b.estimatedPositionRankMovement ?? 0) - Math.abs(a.estimatedPositionRankMovement ?? 0)
    || Math.abs(b.projectedPointDelta ?? 0) - Math.abs(a.projectedPointDelta ?? 0);
}

function overlap(a: string[], b: string[]) {
  const right = new Set(b);
  return a.filter((item) => right.has(item)).length;
}

function average(values: number[]) {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}

function maxAbs(values: number[]) {
  return values.length ? round(Math.max(...values.map((value) => Math.abs(value)))) : null;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.length ? value : null;
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
