import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ProjectionProductionShadowReviewReport } from "./projection-production-shadow-review-types";
import type { ProjectionRecommendationImpactReviewReport } from "./projection-recommendation-impact-review-types";
import type { ProjectionWarRoomImpactReviewReport } from "./projection-war-room-impact-review-types";
import type {
  ProjectionV82FeatureFlagReviewPacketArtifactPaths,
  ProjectionV82FeatureFlagReviewPacketChecklistItem,
  ProjectionV82FeatureFlagReviewPacketInput,
  ProjectionV82FeatureFlagReviewPacketOptions,
  ProjectionV82FeatureFlagReviewPacketReport,
} from "./projection-v8-2-feature-flag-review-packet-types";

const FEATURE_FLAG_NAME = "BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES" as const;

export function runProjectionV82FeatureFlagReviewPacket(options: ProjectionV82FeatureFlagReviewPacketOptions): ProjectionV82FeatureFlagReviewPacketReport {
  const outputDir = backtestingOutputDir();
  const sourceArtifacts = {
    productionShadowReview: path.join(outputDir, `projection-production-shadow-review-${options.projectionSeason}.json`),
    recommendationImpactReview: path.join(outputDir, `projection-recommendation-impact-review-${options.projectionSeason}.json`),
    warRoomImpactReview: path.join(outputDir, `projection-war-room-impact-review-${options.projectionSeason}.json`),
    featureFlagReadiness: path.join(outputDir, `projection-v8-2-feature-flag-readiness-${options.projectionSeason}.json`),
    featureFlagPreview: path.join(outputDir, `projection-v8-2-feature-flag-preview-${options.projectionSeason}.json`),
    selectorPipelinePreview: path.join(outputDir, `projection-selector-pipeline-preview-${options.projectionSeason}.json`),
    snapshotDiffGuard: path.join(outputDir, `projection-v8-2-snapshot-diff-guard-${options.projectionSeason}.json`),
    foundationHandoff: path.join(outputDir, `projection-foundation-handoff-${options.projectionSeason}.json`),
    preseasonProjectionSnapshot: path.join(outputDir, `preseason-projection-snapshot-${options.projectionSeason}.json`),
  };

  for (const artifactPath of Object.values(sourceArtifacts)) {
    if (!existsSync(artifactPath)) throw new Error(`Missing ${path.relative(process.cwd(), artifactPath)}.`);
  }

  return buildProjectionV82FeatureFlagReviewPacketFromData({
    options,
    productionShadowReview: readJson<ProjectionProductionShadowReviewReport>(sourceArtifacts.productionShadowReview),
    recommendationImpactReview: readJson<ProjectionRecommendationImpactReviewReport>(sourceArtifacts.recommendationImpactReview),
    warRoomImpactReview: readJson<ProjectionWarRoomImpactReviewReport>(sourceArtifacts.warRoomImpactReview),
    sourceArtifacts,
  });
}

export function buildProjectionV82FeatureFlagReviewPacketFromData(input: ProjectionV82FeatureFlagReviewPacketInput): ProjectionV82FeatureFlagReviewPacketReport {
  const safetySummary = {
    disabledModeV82Rows: input.productionShadowReview.disabledModeEquivalence.v82Rows,
    enabledSafeSubsetV82Rows: input.productionShadowReview.enabledModeShadow.v82Rows,
    currentPathProtectedRows: input.recommendationImpactReview.summary.currentPathProtectedRows,
    excludedRows: input.productionShadowReview.enabledModeShadow.excludedRows,
    blockedRows: input.productionShadowReview.enabledModeShadow.blockedRows,
    kRowsUsingV82: input.productionShadowReview.summary.kRowsUsingV82,
    criticalMoversUsingV82: input.productionShadowReview.summary.criticalMoversUsingV82,
    meaningfulRankMoversUsingV82: input.productionShadowReview.summary.meaningfulRankMoversUsingV82,
    legacyRowsUsingV82: input.productionShadowReview.summary.legacyRowsUsingV82,
    missingArtifactFallbackRows: input.productionShadowReview.summary.missingArtifactFallbackRows,
  };
  const recommendationImpactSummary = {
    topSuggestionChanged: input.recommendationImpactReview.draftSuggestionImpact.topSuggestionChanged,
    top5Overlap: input.recommendationImpactReview.draftSuggestionImpact.top5SuggestionOverlap,
    top10Overlap: input.recommendationImpactReview.draftSuggestionImpact.top10SuggestionOverlap,
    top300AffectedRows: input.recommendationImpactReview.blackbirdRankImpact.top300AffectedRows.length,
    qbSuperflexSensitiveRows: input.recommendationImpactReview.blackbirdRankImpact.qbSuperflexSensitiveMovement.length,
    starterTierMovementRows: input.recommendationImpactReview.blackbirdRankImpact.starterTierMovement.length,
    deepTierNoiseRowsShown: input.recommendationImpactReview.blackbirdRankImpact.deepTierNoiseMovement.length,
  };
  const planAlignmentChangedRows = input.warRoomImpactReview.planAlignmentImpact.planFitChangedRows
    + input.warRoomImpactReview.planAlignmentImpact.needFitChangedRows
    + input.warRoomImpactReview.planAlignmentImpact.valueFitChangedRows
    + input.warRoomImpactReview.planAlignmentImpact.scarcityFitChangedRows
    + input.warRoomImpactReview.planAlignmentImpact.formatFitChangedRows
    + input.warRoomImpactReview.planAlignmentImpact.depthLuxuryRiskCheckChangedRows;
  const riskConfidenceChangedRows = input.warRoomImpactReview.riskConfidenceImpact.riskChipChangedRows
    + input.warRoomImpactReview.riskConfidenceImpact.confidenceChipChangedRows;
  const warRoomImpactSummary = {
    valueMovementRows: input.warRoomImpactReview.valueImpact.rowsWithValueMovement,
    reasoningLikelyChangedRows: input.warRoomImpactReview.playerReasoningImpact.rowsWhereReasoningWouldLikelyChange,
    gmBriefHeadlineChanged: input.warRoomImpactReview.gmBriefImpact.headlineChanged,
    gmBriefTopRecommendationSummaryChanged: input.warRoomImpactReview.gmBriefImpact.topRecommendationSummaryChanged,
    planAlignmentChangedRows,
    riskConfidenceChangedRows,
    notEstimatedAreas: notEstimatedAreas(input.warRoomImpactReview),
  };
  const goNoGoChecklist = buildGoNoGoChecklist(input, safetySummary, recommendationImpactSummary, warRoomImpactSummary);
  const safetyGates = [
    ...gatePrefix("production", input.productionShadowReview.safetyGates),
    ...gatePrefix("recommendation_impact", input.recommendationImpactReview.safetyGates),
    ...gatePrefix("war_room_impact", input.warRoomImpactReview.safetyGates),
    ...goNoGoChecklist,
  ];
  const recommendation = recommendationFor(safetyGates, recommendationImpactSummary, warRoomImpactSummary);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    featureFlagName: FEATURE_FLAG_NAME,
    recommendation,
    sourceArtifacts: input.sourceArtifacts ?? {
      productionShadowReview: "in-memory",
      recommendationImpactReview: "in-memory",
      warRoomImpactReview: "in-memory",
      featureFlagReadiness: "in-memory",
      featureFlagPreview: "in-memory",
      selectorPipelinePreview: "in-memory",
      snapshotDiffGuard: "in-memory",
      foundationHandoff: "in-memory",
      preseasonProjectionSnapshot: "in-memory",
    },
    executiveSummary: {
      summary: recommendationSummary(recommendation),
      allowedNextStep: "Create a disabled-by-default operational feature flag runbook and optionally add admin/dev-only visibility for selected model source.",
      notAllowed: [
        "Do not set BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES=true in production yet.",
        "Do not write v8.2 projections to Supabase production tables yet.",
        "Do not use v8.2 in live Draft Suggestions yet.",
      ],
    },
    safetySummary,
    recommendationImpactSummary,
    warRoomImpactSummary,
    topReviewExamples: {
      projectedPointMovers: input.productionShadowReview.impactPreview.topProjectedPointDeltas.slice(0, 10),
      reasoningChangedRows: input.warRoomImpactReview.playerReasoningImpact.topExamples.slice(0, 10),
      top300AffectedRows: input.recommendationImpactReview.blackbirdRankImpact.top300AffectedRows.slice(0, 10),
      deepTierNoiseRows: input.recommendationImpactReview.blackbirdRankImpact.deepTierNoiseMovement.slice(0, 10),
    },
    goNoGoChecklist,
    safetyGates,
    notes: [
      "H14.5 is a dry-run/read-only review packet over existing local artifacts.",
      "This packet does not enable v8.2, promote v8.2, change production projection outputs, write Supabase rows, change Blackbird Rank, change Draft Suggestions, change War Room behavior, or call AI APIs.",
      "A ready recommendation means controlled flag-review planning is allowed; it does not authorize production enablement.",
    ],
  };
}

export function writeProjectionV82FeatureFlagReviewPacketArtifacts(report: ProjectionV82FeatureFlagReviewPacketReport): ProjectionV82FeatureFlagReviewPacketArtifactPaths {
  const outputDir = backtestingOutputDir();
  mkdirSync(outputDir, { recursive: true });
  const base = `projection-v8-2-feature-flag-review-packet-${report.projectionSeason}`;
  const jsonPath = path.join(outputDir, `${base}.json`);
  const markdownPath = path.join(outputDir, `${base}.md`);
  const csvPath = path.join(outputDir, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function buildGoNoGoChecklist(
  input: ProjectionV82FeatureFlagReviewPacketInput,
  safetySummary: ProjectionV82FeatureFlagReviewPacketReport["safetySummary"],
  recommendationImpactSummary: ProjectionV82FeatureFlagReviewPacketReport["recommendationImpactSummary"],
  warRoomImpactSummary: ProjectionV82FeatureFlagReviewPacketReport["warRoomImpactSummary"],
): ProjectionV82FeatureFlagReviewPacketChecklistItem[] {
  return [
    check("Feature flag exists", input.productionShadowReview.featureFlagName === FEATURE_FLAG_NAME, input.productionShadowReview.featureFlagName),
    check("Feature flag defaults disabled", safetySummary.disabledModeV82Rows === 0, `${safetySummary.disabledModeV82Rows} disabled-mode v8.2 row(s).`),
    check("Disabled mode matches current path", input.productionShadowReview.disabledModeEquivalence.projectionTotalMismatchesVsCurrent === 0 && input.productionShadowReview.disabledModeEquivalence.rankingAffectingOutputDeltaRows === 0, `${input.productionShadowReview.disabledModeEquivalence.projectionTotalMismatchesVsCurrent} mismatch row(s); ${input.productionShadowReview.disabledModeEquivalence.rankingAffectingOutputDeltaRows} ranking delta row(s).`),
    check("Enabled mode only safe subset", safetySummary.enabledSafeSubsetV82Rows > 0 && safetySummary.kRowsUsingV82 === 0 && safetySummary.criticalMoversUsingV82 === 0 && safetySummary.meaningfulRankMoversUsingV82 === 0 && safetySummary.legacyRowsUsingV82 === 0, `${safetySummary.enabledSafeSubsetV82Rows} safe-subset v8.2 row(s).`),
    check("Protected rows preserved", Object.values(input.recommendationImpactReview.protectedRowChecks).every(Boolean), `${safetySummary.currentPathProtectedRows} current-path protected row(s).`),
    check("Missing artifacts fail closed", safetySummary.missingArtifactFallbackRows === input.productionShadowReview.enabledModeShadow.rowsEvaluated, `${safetySummary.missingArtifactFallbackRows} fallback row(s).`),
    check("Supabase writes unchanged", true, "Packet reads local artifacts and writes only local packet artifacts."),
    check("Rankings unchanged by default", input.productionShadowReview.disabledModeEquivalence.rankingAffectingOutputDeltaRows === 0, `${input.productionShadowReview.disabledModeEquivalence.rankingAffectingOutputDeltaRows} disabled-mode ranking delta row(s).`),
    check("Draft Suggestions unchanged by default", recommendationImpactSummary.topSuggestionChanged === false && input.productionShadowReview.disabledModeEquivalence.rankingAffectingOutputDeltaRows === 0, `top suggestion changed: ${recommendationImpactSummary.topSuggestionChanged}`),
    check("War Room unchanged by default", warRoomImpactSummary.planAlignmentChangedRows === 0 && warRoomImpactSummary.riskConfidenceChangedRows === 0, `plan alignment ${warRoomImpactSummary.planAlignmentChangedRows}; risk/confidence ${warRoomImpactSummary.riskConfidenceChangedRows}.`),
    check("No AI API calls", input.warRoomImpactReview.safetyGates.some((gate) => gate.name === "no_ai_api_calls" && gate.passed), "Only deterministic local GM Brief builders are used."),
  ];
}

function recommendationFor(
  safetyGates: ProjectionV82FeatureFlagReviewPacketChecklistItem[],
  recommendationImpactSummary: ProjectionV82FeatureFlagReviewPacketReport["recommendationImpactSummary"],
  warRoomImpactSummary: ProjectionV82FeatureFlagReviewPacketReport["warRoomImpactSummary"],
): ProjectionV82FeatureFlagReviewPacketReport["recommendation"] {
  if (safetyGates.some((gate) => !gate.passed)) return "blocked_for_flag_review";
  if (
    recommendationImpactSummary.topSuggestionChanged ||
    recommendationImpactSummary.qbSuperflexSensitiveRows > 0 ||
    recommendationImpactSummary.starterTierMovementRows > 0 ||
    warRoomImpactSummary.planAlignmentChangedRows > 0 ||
    warRoomImpactSummary.riskConfidenceChangedRows > 0
  ) {
    return "needs_value_reasoning_review";
  }
  return "ready_for_controlled_flag_review";
}

function notEstimatedAreas(warRoomImpact: ProjectionWarRoomImpactReviewReport) {
  const areas: string[] = [];
  if (warRoomImpact.planAlignmentImpact.notEstimatedRows > 0 || warRoomImpact.planAlignmentImpact.notEstimatedReason) {
    areas.push(`Plan Alignment: ${warRoomImpact.planAlignmentImpact.notEstimatedReason ?? `${warRoomImpact.planAlignmentImpact.notEstimatedRows} row(s) not estimated`}`);
  }
  for (const [name, value] of Object.entries(warRoomImpact.gmBriefImpact)) {
    if (value === "not_estimated") areas.push(`GM Brief ${name}`);
  }
  return areas;
}

function gatePrefix(prefix: string, gates: Array<{ name: string; passed: boolean; detail: string }>): ProjectionV82FeatureFlagReviewPacketChecklistItem[] {
  return gates.map((gate) => ({
    name: `${prefix}.${gate.name}`,
    passed: gate.passed,
    detail: gate.detail,
  }));
}

function recommendationSummary(recommendation: ProjectionV82FeatureFlagReviewPacketReport["recommendation"]) {
  if (recommendation === "ready_for_controlled_flag_review") return "v8.2 is ready for a controlled, off-by-default feature-flag review on the safe subset. Production enablement remains disallowed.";
  if (recommendation === "needs_value_reasoning_review") return "Safety gates are clean, but value/reasoning-sensitive movement requires human review before controlled flag-review planning.";
  return "One or more safety gates failed; v8.2 is blocked from controlled feature-flag review.";
}

function renderMarkdown(report: ProjectionV82FeatureFlagReviewPacketReport) {
  return `# v8.2 Feature-Flag Review Packet ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Feature flag: ${report.featureFlagName}
Recommendation: ${report.recommendation}

## Executive Summary

${report.executiveSummary.summary}

Allowed next step: ${report.executiveSummary.allowedNextStep}

Still not allowed:
${report.executiveSummary.notAllowed.map((item) => `- ${item}`).join("\n")}

## Safety Summary

\`\`\`json
${JSON.stringify(report.safetySummary, null, 2)}
\`\`\`

## Recommendation Impact Summary

\`\`\`json
${JSON.stringify(report.recommendationImpactSummary, null, 2)}
\`\`\`

## War Room Impact Summary

\`\`\`json
${JSON.stringify(report.warRoomImpactSummary, null, 2)}
\`\`\`

## Go / No-Go Checklist

${renderChecklist(report.goNoGoChecklist)}

## Safety Gates

${renderChecklist(report.safetyGates)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderCsv(report: ProjectionV82FeatureFlagReviewPacketReport) {
  const headers = ["section", "player_id", "player", "position", "team", "projected_delta", "current_projection", "v82_projection", "current_rank", "v82_rank", "rank_movement", "note"];
  const rows = [
    ...report.topReviewExamples.projectedPointMovers.map((row) => [
      "projected_point_mover",
      row.playerId,
      row.player,
      row.position,
      row.team ?? "",
      row.projectedTotalDeltaVsCurrent ?? "",
      row.currentProjectedTotal ?? "",
      row.v82ProjectedTotal ?? "",
      row.currentOverallRank ?? "",
      row.shadowOverallRank ?? "",
      row.estimatedOverallRankMovement ?? "",
      row.selectorReason,
    ]),
    ...report.topReviewExamples.reasoningChangedRows.map((row) => [
      "reasoning_changed",
      row.playerId,
      row.player,
      row.position,
      row.team ?? "",
      row.projectedPointDelta ?? "",
      row.currentProjection ?? "",
      row.v82Projection ?? "",
      "",
      "",
      "",
      row.note,
    ]),
    ...report.topReviewExamples.top300AffectedRows.map((row) => csvRecommendationRow("top_300_affected", row)),
    ...report.topReviewExamples.deepTierNoiseRows.map((row) => csvRecommendationRow("deep_tier_noise", row)),
  ];
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function csvRecommendationRow(section: string, row: ProjectionV82FeatureFlagReviewPacketReport["topReviewExamples"]["top300AffectedRows"][number]) {
  return [
    section,
    row.playerId,
    row.player,
    row.position,
    row.team ?? "",
    row.projectedPointDelta ?? "",
    row.currentProjectedTotal ?? "",
    row.v82ProjectedTotal ?? "",
    row.currentOverallRank ?? "",
    row.v82OverallRank ?? "",
    row.estimatedOverallRankMovement ?? "",
    row.selectorReason,
  ];
}

function renderChecklist(items: ProjectionV82FeatureFlagReviewPacketChecklistItem[]) {
  return [
    "| Check | Status | Detail |",
    "|---|---|---|",
    ...items.map((item) => `| ${item.name} | ${item.passed ? "PASS" : "FAIL"} | ${item.detail} |`),
  ].join("\n");
}

function check(name: string, passed: boolean, detail: string): ProjectionV82FeatureFlagReviewPacketChecklistItem {
  return { name, passed, detail };
}

function readJson<T>(artifactPath: string): T {
  return JSON.parse(readFileSync(artifactPath, "utf8")) as T;
}

function backtestingOutputDir() {
  return path.join(process.cwd(), "artifacts", "projections", "backtesting");
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
