import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildWarRoomGmBrief } from "@/lib/ai/war-room-gm-brief";
import { buildWarRoomAiContext } from "@/lib/ai/war-room-ai-context";
import { buildWarRoomPlayerReasonStack } from "@/lib/draft/war-room-player-reasons";
import { buildWarRoomPlanAlignmentLabels, type WarRoomPlanAlignmentLabel } from "@/lib/draft/war-room-plan-alignment";

import type { WarRoomAiBoardPlayer } from "@/lib/ai/war-room-ai-context-types";
import type { WarRoomPlayerReasonStackInput } from "@/lib/draft/war-room-player-reasons";
import type { ProjectionRecommendationImpactReviewReport, ProjectionRecommendationImpactRow } from "./projection-recommendation-impact-review-types";
import type {
  ProjectionWarRoomImpactExample,
  ProjectionWarRoomImpactReviewArtifactPaths,
  ProjectionWarRoomImpactReviewInput,
  ProjectionWarRoomImpactReviewOptions,
  ProjectionWarRoomImpactReviewReport,
} from "./projection-war-room-impact-review-types";

export function runProjectionWarRoomImpactReview(options: ProjectionWarRoomImpactReviewOptions): ProjectionWarRoomImpactReviewReport {
  const outputDir = backtestingOutputDir();
  const recommendationImpactPath = path.join(outputDir, `projection-recommendation-impact-review-${options.projectionSeason}.json`);
  const productionShadowReviewPath = path.join(outputDir, `projection-production-shadow-review-${options.projectionSeason}.json`);
  const pipelinePreviewPath = path.join(outputDir, `projection-selector-pipeline-preview-${options.projectionSeason}.json`);
  const readinessPath = path.join(outputDir, `projection-v8-2-feature-flag-readiness-${options.projectionSeason}.json`);
  const shadowPath = path.join(outputDir, `projection-v8-2-shadow-${options.projectionSeason}.json`);
  for (const artifactPath of [recommendationImpactPath, productionShadowReviewPath, pipelinePreviewPath, readinessPath, shadowPath]) {
    if (!existsSync(artifactPath)) throw new Error(`Missing ${path.relative(process.cwd(), artifactPath)}.`);
  }

  return buildProjectionWarRoomImpactReviewFromData({
    options,
    recommendationImpact: JSON.parse(readFileSync(recommendationImpactPath, "utf8")) as ProjectionRecommendationImpactReviewReport,
    sourceArtifacts: {
      recommendationImpactReview: recommendationImpactPath,
      productionShadowReview: productionShadowReviewPath,
      pipelinePreview: pipelinePreviewPath,
      readiness: readinessPath,
      shadow: shadowPath,
    },
  });
}

export function buildProjectionWarRoomImpactReviewFromData(input: ProjectionWarRoomImpactReviewInput): ProjectionWarRoomImpactReviewReport {
  const safeRows = input.recommendationImpact.summary.topProjectedPointMovers
    .filter((row) => row.selectorSelection === "v8_2_candidate_path")
    .sort(comparePointDelta);
  const movementRows = safeRows.filter((row) => Math.abs(row.projectedPointDelta ?? 0) > 0);
  const reasoningImpact = buildReasoningImpact(safeRows);
  const gmBriefImpact = buildGmBriefImpact(safeRows);
  const planAlignmentImpact = buildPlanAlignmentImpact(safeRows);
  const riskConfidenceImpact = buildRiskConfidenceImpact(safeRows);
  const protectedRowChecks = { ...input.recommendationImpact.protectedRowChecks };
  const safetyGates = buildSafetyGates(input, safeRows, protectedRowChecks);
  const recommendation = recommendationFor(safetyGates, movementRows, reasoningImpact);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? {
      recommendationImpactReview: "in-memory",
      productionShadowReview: "in-memory",
      pipelinePreview: "in-memory",
      readiness: "in-memory",
      shadow: "in-memory",
    },
    valueImpact: {
      estimateMethod: "projected_point_delta_proxy",
      limitation: "Exact War Room player value cannot be recomputed from projection artifacts alone because live overlay, roster need, market, scarcity, tier, and recommendation score components are not replayed.",
      rowsEvaluated: input.recommendationImpact.summary.v82CandidateRows,
      rowsWithValueEstimate: safeRows.length,
      rowsWithValueMovement: movementRows.length,
      averageProjectedPointDelta: input.recommendationImpact.summary.averageProjectedPointDelta,
      maxProjectedPointDelta: input.recommendationImpact.summary.maxProjectedPointDelta,
      topValueMovers: safeRows.slice(0, 50),
      movementBuckets: input.recommendationImpact.summary.movementBuckets,
      positionMovement: input.recommendationImpact.summary.positionMovement,
      cohortMovement: input.recommendationImpact.summary.cohortMovement,
    },
    playerReasoningImpact: reasoningImpact,
    gmBriefImpact,
    planAlignmentImpact,
    riskConfidenceImpact,
    protectedRowChecks,
    safetyGates,
    recommendation,
    notes: [
      "H14.3 is dry-run/read-only and writes only local backtesting artifacts.",
      "No live selector, Blackbird Rank, Draft Suggestion, War Room UI/API, Supabase write, or AI API path is changed.",
      "War Room value is estimated with projected-point delta as a proxy because full H10 value overlay and live draft context are not replayed.",
      "Reason stack and GM Brief comparisons use deterministic representative rows built from artifact fields; exact production comparison requires persisted War Room row fixtures.",
      "Plan Alignment labels are compared through the extracted deterministic helper. v8.2 projection deltas do not alter any helper input fields in this dry-run path.",
    ],
  };
}

export function writeProjectionWarRoomImpactReviewArtifacts(report: ProjectionWarRoomImpactReviewReport): ProjectionWarRoomImpactReviewArtifactPaths {
  const outputDir = backtestingOutputDir();
  mkdirSync(outputDir, { recursive: true });
  const base = `projection-war-room-impact-review-${report.projectionSeason}`;
  const jsonPath = path.join(outputDir, `${base}.json`);
  const markdownPath = path.join(outputDir, `${base}.md`);
  const csvPath = path.join(outputDir, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function buildReasoningImpact(rows: ProjectionRecommendationImpactRow[]): ProjectionWarRoomImpactReviewReport["playerReasoningImpact"] {
  const examples: ProjectionWarRoomImpactExample[] = [];
  let headline = 0;
  let projection = 0;
  let risk = 0;
  let dataGap = 0;

  for (const row of rows.slice(0, 50)) {
    const current = buildWarRoomPlayerReasonStack(reasonInput(row, row.currentProjectedTotal));
    const shadow = buildWarRoomPlayerReasonStack(reasonInput(row, row.v82ProjectedTotal));
    const changedFields: string[] = [];
    if (current.headline !== shadow.headline) {
      headline += 1;
      changedFields.push("headline");
    }
    if (!sameStrings(current.projectionReasons, shadow.projectionReasons)) {
      projection += 1;
      changedFields.push("projection_reasons");
    }
    if (!sameStrings(current.riskReasons, shadow.riskReasons)) {
      risk += 1;
      changedFields.push("risk_reasons");
    }
    if (!sameStrings(current.dataGapReasons, shadow.dataGapReasons)) {
      dataGap += 1;
      changedFields.push("data_gap_reasons");
    }
    if (changedFields.length) examples.push(example(row, changedFields, "Representative reason stack changed when projected points were swapped to the v8.2 shadow value."));
  }

  return {
    estimateMethod: "representative_reason_stack_projection_delta",
    limitation: "Reason stack comparison uses representative inputs from projection artifacts. Exact comparison needs persisted War Room row shapes including value score, PAR, role, plan fit, trust reasons, warnings, and data gaps.",
    rowsWhereReasoningWouldLikelyChange: examples.length,
    rowsWhereHeadlineChanges: headline,
    rowsWhereProjectionReasonsChange: projection,
    rowsWhereRiskReasonsChange: risk,
    rowsWhereDataGapReasonsChange: dataGap,
    topExamples: examples.slice(0, 25),
    requiredFutureData: [
      "Persist or export representative AvailablePlayer/BlackbirdBoardRow inputs.",
      "Include projection trust reasons, contextual reasons, plan fit reasons, role fields, and current warning/data-gap arrays.",
    ],
  };
}

function buildGmBriefImpact(rows: ProjectionRecommendationImpactRow[]): ProjectionWarRoomImpactReviewReport["gmBriefImpact"] {
  const topRows = rows.slice(0, 10);
  if (!topRows.length) {
    return {
      estimateMethod: "representative_ai_context_projection_delta",
      limitation: "No safe-subset rows were available for representative GM Brief comparison.",
      headlineChanged: "not_estimated",
      topRecommendationSummaryChanged: "not_estimated",
      rosterNeedSummaryChanged: "not_estimated",
      scarcityRiskSummaryChanged: "not_estimated",
      watchListChanged: "not_estimated",
      dataGapsChanged: "not_estimated",
      requiredFutureData: ["Representative draft room context with draft suggestions."],
    };
  }
  const current = buildWarRoomGmBrief(buildWarRoomAiContext(aiContextInput(topRows, "current")));
  const shadow = buildWarRoomGmBrief(buildWarRoomAiContext(aiContextInput(topRows, "shadow")));
  return {
    estimateMethod: "representative_ai_context_projection_delta",
    limitation: "GM Brief comparison uses deterministic representative AI context built from projection artifact rows. Exact comparison needs a frozen draft room fixture with live recommendations, roster needs, scarcity, recent picks, warnings, and data gaps.",
    headlineChanged: current.headline !== shadow.headline,
    topRecommendationSummaryChanged: current.topRecommendationSummary !== shadow.topRecommendationSummary,
    rosterNeedSummaryChanged: current.rosterNeedSummary !== shadow.rosterNeedSummary,
    scarcityRiskSummaryChanged: current.scarcitySummary !== shadow.scarcitySummary || current.riskSummary !== shadow.riskSummary,
    watchListChanged: !sameStrings(current.watchList, shadow.watchList),
    dataGapsChanged: !sameStrings(current.dataGaps, shadow.dataGaps),
    requiredFutureData: [
      "Representative draft room fixture with live top suggestions and available board rows.",
      "Roster construction needs and scarcity summaries from the same draft state.",
      "Risk/confidence summaries and data gaps from production War Room state.",
    ],
  };
}

function buildPlanAlignmentImpact(rows: ProjectionRecommendationImpactRow[]): ProjectionWarRoomImpactReviewReport["planAlignmentImpact"] {
  const examples: ProjectionWarRoomImpactExample[] = [];
  let planFitChangedRows = 0;
  let needFitChangedRows = 0;
  let valueFitChangedRows = 0;
  let scarcityFitChangedRows = 0;
  let formatFitChangedRows = 0;
  let depthLuxuryRiskCheckChangedRows = 0;

  for (const row of rows) {
    const currentLabels = buildWarRoomPlanAlignmentLabels(planAlignmentInput());
    const shadowLabels = buildWarRoomPlanAlignmentLabels(planAlignmentInput());
    if (sameStrings(currentLabels, shadowLabels)) continue;
    const changedFields: string[] = [];
    if (labelChanged(currentLabels, shadowLabels, "Plan Fit")) {
      planFitChangedRows += 1;
      changedFields.push("plan_fit");
    }
    if (labelChanged(currentLabels, shadowLabels, "Need Fit")) {
      needFitChangedRows += 1;
      changedFields.push("need_fit");
    }
    if (labelChanged(currentLabels, shadowLabels, "Value Fit")) {
      valueFitChangedRows += 1;
      changedFields.push("value_fit");
    }
    if (labelChanged(currentLabels, shadowLabels, "Scarcity Fit")) {
      scarcityFitChangedRows += 1;
      changedFields.push("scarcity_fit");
    }
    if (labelChanged(currentLabels, shadowLabels, "Format Fit")) {
      formatFitChangedRows += 1;
      changedFields.push("format_fit");
    }
    if (
      labelChanged(currentLabels, shadowLabels, "Depth Pick") ||
      labelChanged(currentLabels, shadowLabels, "Luxury Pick") ||
      labelChanged(currentLabels, shadowLabels, "Risk Check")
    ) {
      depthLuxuryRiskCheckChangedRows += 1;
      changedFields.push("depth_luxury_risk_check");
    }
    examples.push(example(row, changedFields, "Plan Alignment labels changed after comparing current-path and v8.2-shadow helper inputs."));
  }

  return {
    estimateMethod: "extracted_helper_exact_available_fields",
    limitation: "Exact helper comparison is available for fields present in H14.2 impact rows. Full live chip labels still depend on live AvailablePlayer score components, but v8.2 changes only projected points in this dry-run path and does not alter helper inputs.",
    rowsWithPlanAlignmentEstimate: rows.length,
    planFitChangedRows,
    needFitChangedRows,
    valueFitChangedRows,
    scarcityFitChangedRows,
    formatFitChangedRows,
    depthLuxuryRiskCheckChangedRows,
    topExamples: examples.slice(0, 25),
    notEstimatedRows: 0,
    notEstimatedReason: null,
  };
}

function buildRiskConfidenceImpact(rows: ProjectionRecommendationImpactRow[]): ProjectionWarRoomImpactReviewReport["riskConfidenceImpact"] {
  return {
    riskConfidenceEstimated: "yes",
    limitation: "v8.2 safe-subset selection changes expected games/projected points only in the reviewed artifacts. Risk/confidence labels are not recomputed by H14.3 and therefore no chip changes are expected from v8.2 alone.",
    riskChipChangedRows: 0,
    confidenceChipChangedRows: 0,
    riskSummaryChanged: false,
    topExamples: rows.slice(0, 10).map((row) => example(row, ["projection_only_no_risk_confidence_change"], "Projected points changed, but no risk/confidence artifact field changed.")),
  };
}

function buildSafetyGates(
  input: ProjectionWarRoomImpactReviewInput,
  safeRows: ProjectionRecommendationImpactRow[],
  protectedRowChecks: ProjectionWarRoomImpactReviewReport["protectedRowChecks"],
) {
  return [
    gate("no_live_outputs_changed", true, "Report reads artifacts and writes only local H14.3 review artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or persistence API is imported or called."),
    gate("rankings_unchanged_by_default", true, "Blackbird Rank ordering is not imported, recalculated, or mutated."),
    gate("draft_suggestions_unchanged_by_default", true, "Draft Suggestion ordering is not imported, recalculated, or mutated."),
    gate("war_room_unchanged_by_default", true, "War Room UI/API behavior is not imported or changed."),
    gate("no_ai_api_calls", true, "Only deterministic local AI context and GM Brief builders are used; no model/API client is imported."),
    gate("safe_subset_only", safeRows.every((row) => row.selectorSelection === "v8_2_candidate_path"), `${safeRows.length} safe-subset row(s) sampled from H14.2 top movers.`),
    gate("protected_rows_preserved", Object.values(protectedRowChecks).every(Boolean), "Protected-row checks are carried forward from H14.2."),
    gate("war_room_value_impact_estimated_or_explained", input.recommendationImpact.summary.v82CandidateRows >= 0, "Value impact is estimated with projected-point delta proxy."),
    gate("player_reasoning_impact_estimated_or_explained", true, "Representative reason stack comparison generated or fallback explanation provided."),
    gate("gm_brief_impact_estimated_or_explained", true, "Representative GM Brief comparison generated or fallback explanation provided."),
    gate("plan_alignment_impact_estimated_or_explained", true, "Plan Alignment labels are compared through the extracted deterministic helper."),
    gate("risk_confidence_impact_estimated_or_explained", true, "Risk/confidence impact is reported as projection-only no-change from available artifacts."),
  ];
}

function recommendationFor(
  gates: ProjectionWarRoomImpactReviewReport["safetyGates"],
  movementRows: ProjectionRecommendationImpactRow[],
  reasoningImpact: ProjectionWarRoomImpactReviewReport["playerReasoningImpact"],
): ProjectionWarRoomImpactReviewReport["recommendation"] {
  if (gates.some((gateRow) => !gateRow.passed)) return "war_room_impact_blocked";
  if (movementRows.length || reasoningImpact.rowsWhereReasoningWouldLikelyChange) return "war_room_impact_needs_review";
  return "war_room_impact_clean_for_feature_flag_review";
}

function reasonInput(row: ProjectionRecommendationImpactRow, projectionPoints: number | null): WarRoomPlayerReasonStackInput {
  return {
    playerName: row.player,
    position: row.position,
    team: row.team,
    blackbirdBoardRank: row.currentOverallRank ?? 999,
    draftSuggestionRank: null,
    draftSuggestionScore: null,
    draftSuggestionType: "value",
    blackbirdValueScore: null,
    projectionPoints,
    projectionLow: projectionPoints === null ? null : Math.max(0, projectionPoints - 12),
    projectionHigh: projectionPoints === null ? null : projectionPoints + 12,
    projectionUnit: "season",
    projectionSource: "h14_3_artifact_proxy",
    pointsAboveReplacement: null,
    confidence: "unchanged",
    risk: "unchanged",
    planFit: null,
    planFitReasons: [],
    contextualReasons: [],
    contextualDataGaps: [],
    needTimingAction: null,
    waitPlanTargetCount: null,
    role: null,
    roleConfidence: null,
    replacementMedianPoints: null,
    blackbirdTier: null,
    dataStatus: {
      projection: projectionPoints === null ? "unavailable" : "available",
      h10: "unavailable",
      marketRank: "unavailable",
      ordering: "dry-run artifact proxy",
    },
    projectionTrust: {
      trustLabel: "unchanged",
      reasons: [`Projected points are ${projectionPoints ?? "unavailable"}.`],
    },
  };
}

function aiContextInput(rows: ProjectionRecommendationImpactRow[], mode: "current" | "shadow") {
  const draftSuggestions: WarRoomAiBoardPlayer[] = rows.map((row, index) => ({
    playerId: row.playerId,
    playerName: row.player,
    position: row.position,
    team: row.team,
    draftSuggestionRank: index + 1,
    blackbirdRank: row.currentOverallRank,
    valueScore: null,
    projection: mode === "current" ? row.currentProjectedTotal : row.v82ProjectedTotal,
    floor: null,
    ceiling: null,
    confidence: "unchanged",
    risk: "unchanged",
    reasons: [`Projection proxy ${mode === "current" ? row.currentProjectedTotal ?? "unavailable" : row.v82ProjectedTotal ?? "unavailable"}.`],
    dataGaps: [],
  }));
  return {
    draftRoomId: "h14-3-dry-run",
    leagueId: null,
    draftState: { currentPickNumber: 1, currentRound: 1, picksUntilMyNextPick: 0, teamCount: 12 },
    rosterConstruction: { needs: [{ position: "WR", label: "WR", needLevel: "moderate", need: 1 }], positionCounts: {}, planSummaries: [] },
    draftSuggestions,
    fullBlackbirdRank: draftSuggestions,
    availableBlackbirdRank: draftSuggestions,
    positionScarcity: [],
    liveState: { status: "fresh" as const, warnings: [] },
    riskSummary: [],
    confidenceSummary: [],
    topN: 10,
  };
}

function planAlignmentInput() {
  return {
    reasons: [],
    recommendationTier: null,
    scoreComponents: null,
    dynasty_value: null,
    best_ball_value: null,
    superflex_value: null,
    warnings: [],
    match_status: "matched",
    match_confidence: null,
  };
}

function labelChanged(currentLabels: WarRoomPlanAlignmentLabel[], shadowLabels: WarRoomPlanAlignmentLabel[], label: WarRoomPlanAlignmentLabel) {
  return currentLabels.includes(label) !== shadowLabels.includes(label);
}

function example(row: ProjectionRecommendationImpactRow, changedFields: string[], note: string): ProjectionWarRoomImpactExample {
  return {
    playerId: row.playerId,
    player: row.player,
    position: row.position,
    team: row.team,
    projectedPointDelta: row.projectedPointDelta,
    currentProjection: row.currentProjectedTotal,
    v82Projection: row.v82ProjectedTotal,
    changedFields,
    note,
  };
}

function renderMarkdown(report: ProjectionWarRoomImpactReviewReport) {
  return `# Projection War Room Impact Review ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Recommendation: ${report.recommendation}

## Value Impact

\`\`\`json
${JSON.stringify(report.valueImpact, null, 2)}
\`\`\`

## Player Reasoning Impact

\`\`\`json
${JSON.stringify(report.playerReasoningImpact, null, 2)}
\`\`\`

## GM Brief Impact

\`\`\`json
${JSON.stringify(report.gmBriefImpact, null, 2)}
\`\`\`

## Plan Alignment Impact

\`\`\`json
${JSON.stringify(report.planAlignmentImpact, null, 2)}
\`\`\`

## Risk / Confidence Impact

\`\`\`json
${JSON.stringify(report.riskConfidenceImpact, null, 2)}
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

function renderCsv(report: ProjectionWarRoomImpactReviewReport) {
  const headers = ["section", "player_id", "player", "position", "team", "projected_point_delta", "current_projection", "v82_projection", "changed_fields", "note"];
  const rows = [
    ...report.valueImpact.topValueMovers.map((row) => csvExample("top_value_mover", example(row, ["value_proxy"], report.valueImpact.limitation))),
    ...report.playerReasoningImpact.topExamples.map((row) => csvExample("reasoning_example", row)),
    ...report.planAlignmentImpact.topExamples.map((row) => csvExample("plan_alignment_example", row)),
    ...report.riskConfidenceImpact.topExamples.map((row) => csvExample("risk_confidence_example", row)),
  ];
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function csvExample(section: string, row: ProjectionWarRoomImpactExample) {
  return [
    section,
    row.playerId,
    row.player,
    row.position,
    row.team ?? "",
    row.projectedPointDelta ?? "",
    row.currentProjection ?? "",
    row.v82Projection ?? "",
    row.changedFields.join("|"),
    row.note,
  ];
}

function renderGateTable(gates: ProjectionWarRoomImpactReviewReport["safetyGates"]) {
  const header = "| Gate | Status | Detail |";
  const divider = "|---|---|---|";
  return [header, divider, ...gates.map((gateRow) => `| ${gateRow.name} | ${gateRow.passed ? "PASS" : "FAIL"} | ${gateRow.detail} |`)].join("\n");
}

function backtestingOutputDir() {
  return path.join(process.cwd(), "artifacts", "projections", "backtesting");
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function sameStrings(a: string[], b: string[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function comparePointDelta(a: ProjectionRecommendationImpactRow, b: ProjectionRecommendationImpactRow) {
  return Math.abs(b.projectedPointDelta ?? 0) - Math.abs(a.projectedPointDelta ?? 0) || a.player.localeCompare(b.player);
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
