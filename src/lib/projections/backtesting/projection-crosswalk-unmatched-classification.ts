import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ProjectionActiveUniversePolicyClassification, ProjectionActiveUniversePolicyPacketReport, ProjectionActiveUniversePolicyPacketRow } from "./projection-active-universe-policy-packet-types";
import type { ProjectionActiveUniverseGateRosterRefreshReport } from "./projection-active-universe-gate-roster-refresh-types";
import type { ProjectionCrosswalkEnhancedConfirmationReport, ProjectionCrosswalkEnhancedConfirmationRow } from "./projection-crosswalk-enhanced-confirmation-types";
import type { ProjectionCurrentRosterConfirmationReport } from "./projection-current-roster-confirmation-types";
import type { ProjectionPlayerIdCrosswalkReviewReport } from "./projection-player-id-crosswalk-review-types";
import type { ProjectionRookieNewTargetDiagnosticsReport, ProjectionRookieNewTargetDiagnosticsRow } from "./projection-rookie-new-target-diagnostics-types";
import type { PreseasonProjectionSnapshot, PreseasonProjectionSnapshotRow } from "./preseason-projection-snapshot-types";
import type {
  ProjectionCrosswalkUnmatchedArtifactPaths,
  ProjectionCrosswalkUnmatchedClass,
  ProjectionCrosswalkUnmatchedInput,
  ProjectionCrosswalkUnmatchedReasonCode,
  ProjectionCrosswalkUnmatchedRecommendation,
  ProjectionCrosswalkUnmatchedReport,
  ProjectionCrosswalkUnmatchedRow,
  ProjectionCrosswalkUnmatchedSourcePriority,
} from "./projection-crosswalk-unmatched-classification-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const CURRENT_ROSTER_OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "current-rosters");
const CROSSWALK_OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "player-crosswalk");
const CLASSES: ProjectionCrosswalkUnmatchedClass[] = [
  "likely_inactive_or_archive",
  "needs_transaction_status_source",
  "needs_sleeper_status_source",
  "needs_depth_chart_source",
  "needs_manual_review",
  "keep_source_expansion_required",
];
const SOURCE_PRIORITIES: ProjectionCrosswalkUnmatchedSourcePriority[] = [
  "sleeper_player_metadata_source",
  "transaction_free_agent_source",
  "depth_chart_source",
  "manual_review",
  "keep_shadow_only_policy",
];
const POLICY_CLASSIFICATIONS: ProjectionActiveUniversePolicyClassification[] = [
  "policy_active_candidate",
  "policy_shadow_only",
  "policy_blocked_archive",
  "policy_manual_review",
  "policy_source_expansion_required",
  "policy_kicker_review_required",
  "policy_current_path_only",
];

export function runProjectionCrosswalkUnmatchedClassification(options: { projectionSeason: number; includeIdp: boolean }): ProjectionCrosswalkUnmatchedReport {
  const sourceArtifacts = {
    crosswalkEnhancedConfirmation: path.join(OUTPUT_DIR, `projection-crosswalk-enhanced-confirmation-${options.projectionSeason}.json`),
    playerIdCrosswalkReview: path.join(OUTPUT_DIR, `projection-player-id-crosswalk-review-${options.projectionSeason}.json`),
    playerIdCrosswalkSource: path.join(CROSSWALK_OUTPUT_DIR, `sleeper-nflverse-crosswalk-${options.projectionSeason}.normalized.json`),
    rookieNewTargetDiagnostics: path.join(OUTPUT_DIR, `projection-rookie-new-target-diagnostics-${options.projectionSeason}.json`),
    policyPacket: path.join(OUTPUT_DIR, `projection-active-universe-policy-packet-${options.projectionSeason}.json`),
    rosterRefresh: path.join(OUTPUT_DIR, `projection-active-universe-gate-roster-refresh-${options.projectionSeason}.json`),
    currentRosterConfirmation: path.join(OUTPUT_DIR, `projection-current-roster-confirmation-${options.projectionSeason}.json`),
    currentRosterSource: path.join(CURRENT_ROSTER_OUTPUT_DIR, `current-rosters-${options.projectionSeason}.normalized.json`),
    preseasonProjectionSnapshot: path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`),
  };
  return buildProjectionCrosswalkUnmatchedClassificationFromData({
    options,
    crosswalkEnhancedConfirmation: readIfExists<ProjectionCrosswalkEnhancedConfirmationReport>(sourceArtifacts.crosswalkEnhancedConfirmation),
    playerIdCrosswalkReview: readIfExists<ProjectionPlayerIdCrosswalkReviewReport>(sourceArtifacts.playerIdCrosswalkReview),
    rookieNewTargetDiagnostics: readIfExists<ProjectionRookieNewTargetDiagnosticsReport>(sourceArtifacts.rookieNewTargetDiagnostics),
    policyPacket: readIfExists<ProjectionActiveUniversePolicyPacketReport>(sourceArtifacts.policyPacket),
    rosterRefresh: readIfExists<ProjectionActiveUniverseGateRosterRefreshReport>(sourceArtifacts.rosterRefresh),
    currentRosterConfirmation: readIfExists<ProjectionCurrentRosterConfirmationReport>(sourceArtifacts.currentRosterConfirmation),
    currentRosterSourcePresent: existsSync(sourceArtifacts.currentRosterSource),
    preseasonProjectionSnapshot: readIfExists<PreseasonProjectionSnapshot>(sourceArtifacts.preseasonProjectionSnapshot),
    sourceArtifacts: {
      crosswalkEnhancedConfirmation: sourceArtifacts.crosswalkEnhancedConfirmation,
      playerIdCrosswalkReview: sourceArtifacts.playerIdCrosswalkReview,
      rookieNewTargetDiagnostics: sourceArtifacts.rookieNewTargetDiagnostics,
      policyPacket: sourceArtifacts.policyPacket,
      rosterRefresh: sourceArtifacts.rosterRefresh,
      currentRosterConfirmation: sourceArtifacts.currentRosterConfirmation,
      currentRosterSource: existsSync(sourceArtifacts.currentRosterSource) ? sourceArtifacts.currentRosterSource : null,
      preseasonProjectionSnapshot: sourceArtifacts.preseasonProjectionSnapshot,
    },
  });
}

export function buildProjectionCrosswalkUnmatchedClassificationFromData(input: ProjectionCrosswalkUnmatchedInput): ProjectionCrosswalkUnmatchedReport {
  if (!hasRequiredSources(input)) return sourceMissingReport(input);
  const lookups = buildLookups(input);
  const targetRows = input.crosswalkEnhancedConfirmation.rows.filter((row) => row.enhancedStatus === "crosswalk_source_unmatched");
  const rows = targetRows.map((row) => classifyRow(row, lookups));
  const summary = buildSummary(rows);
  const priorityCounts = countByFixed(rows, SOURCE_PRIORITIES, (row) => row.sourcePriority);
  const h21PolicyPreview = {
    wouldRemainUnder: countByFixed(rows, POLICY_CLASSIFICATIONS, (row) => row.h21PolicyPreview),
    notes: [
      "H26 policy preview is conservative and does not change H21 behavior.",
      "Crosswalk-unmatched rows are never forced active by this report.",
    ],
  };
  const zeroChecks = zeroChecksFor(input.rosterRefresh);
  const safeRows = rows.filter((row) => row.v82SafeSubsetStatus === "v82_safe_subset");
  const safetyGates = buildSafetyGates(rows, zeroChecks);
  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? sourceArtifactsFor(input),
    sourceMissing: false,
    summary,
    sourcePriorityRecommendation: {
      recommendedSourcePriority: recommendedSourcePriority(priorityCounts),
      priorityCounts,
      note: "Recommended source priority is selected from the largest classified source-need bucket.",
    },
    h21PolicyPreview,
    v82Impact: {
      safeRowsAffected: safeRows.length,
      safeRowsStillHeldBack: safeRows.filter((row) => row.h21PolicyPreview !== "policy_active_candidate").length,
      blocksControlledFlagReview: safeRows.some((row) => row.h21PolicyPreview !== "policy_active_candidate"),
      zeroChecksPreserved: Object.values(zeroChecks).every(Boolean),
      zeroChecks,
    },
    examples: {
      topLikelyInactiveArchiveRows: topRows(rows.filter((row) => row.classification === "likely_inactive_or_archive"), 50),
      topNeedsTransactionStatusRows: topRows(rows.filter((row) => row.classification === "needs_transaction_status_source"), 50),
      topNeedsSleeperStatusRows: topRows(rows.filter((row) => row.classification === "needs_sleeper_status_source"), 50),
      topNeedsDepthChartRows: topRows(rows.filter((row) => row.classification === "needs_depth_chart_source"), 50),
      topV82SafeHeldBackRows: topRows(safeRows.filter((row) => row.h21PolicyPreview !== "policy_active_candidate"), 50),
    },
    rows,
    safetyGates,
    recommendation: recommendationFor(safetyGates, rows),
    notes: [
      "H26 is dry-run/read-only source coverage classification only.",
      "No live projection, rank, suggestion, War Room scoring, Supabase, or v8.2 behavior is changed.",
      "No unmatched row is promoted to active by this report.",
    ],
  };
}

export function writeProjectionCrosswalkUnmatchedClassificationArtifacts(report: ProjectionCrosswalkUnmatchedReport): ProjectionCrosswalkUnmatchedArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-crosswalk-unmatched-classification-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function hasRequiredSources(input: ProjectionCrosswalkUnmatchedInput): input is ProjectionCrosswalkUnmatchedInput & {
  crosswalkEnhancedConfirmation: ProjectionCrosswalkEnhancedConfirmationReport;
  playerIdCrosswalkReview: ProjectionPlayerIdCrosswalkReviewReport;
  rookieNewTargetDiagnostics: ProjectionRookieNewTargetDiagnosticsReport;
  policyPacket: ProjectionActiveUniversePolicyPacketReport;
  rosterRefresh: ProjectionActiveUniverseGateRosterRefreshReport;
  currentRosterConfirmation: ProjectionCurrentRosterConfirmationReport;
  preseasonProjectionSnapshot: Pick<PreseasonProjectionSnapshot, "metadata" | "diagnostics" | "rows">;
} {
  return Boolean(input.crosswalkEnhancedConfirmation && input.playerIdCrosswalkReview && input.rookieNewTargetDiagnostics && input.policyPacket && input.rosterRefresh && input.currentRosterConfirmation && input.preseasonProjectionSnapshot);
}

function buildLookups(input: ProjectionCrosswalkUnmatchedInput) {
  return {
    h23ByPlayerId: mapFirst((input.rookieNewTargetDiagnostics?.rows ?? []).map((row) => [row.playerId, row] as const)),
    policyByPlayerId: mapFirst((input.policyPacket?.rows ?? []).map((row) => [row.playerId, row] as const)),
    snapshotByGsis: mapFirst((input.preseasonProjectionSnapshot?.rows ?? []).filter((row) => row.gsisId).map((row) => [row.gsisId ?? "", row] as const)),
  };
}

function classifyRow(row: ProjectionCrosswalkEnhancedConfirmationRow, lookups: ReturnType<typeof buildLookups>): ProjectionCrosswalkUnmatchedRow {
  const h23Row = lookups.h23ByPlayerId.get(row.playerId) ?? null;
  const policyRow = lookups.policyByPlayerId.get(row.playerId) ?? null;
  const snapshotRow = row.crosswalkGsisId ? lookups.snapshotByGsis.get(row.crosswalkGsisId) ?? row.linkedSnapshotRow : row.linkedSnapshotRow;
  const reasonCodes = reasonCodesFor(row, h23Row, policyRow, snapshotRow);
  const classification = classificationFor(row, h23Row, policyRow, snapshotRow, reasonCodes);
  return {
    playerId: row.playerId,
    sleeperId: row.sleeperId,
    crosswalkGsisId: row.crosswalkGsisId,
    player: row.player,
    normalizedName: row.normalizedName,
    position: row.position,
    projectionTeam: row.projectionTeam,
    h23IdentityClass: h23Row?.targetIdentityClass ?? null,
    h21PolicyGroup: policyRow?.policyGroup ?? h23Row?.h21PolicyGroup ?? null,
    h21RecommendedPolicyAction: policyRow?.recommendedPolicyAction ?? null,
    originalPolicyClassification: policyRow?.policyClassification ?? null,
    lastActiveSeason: policyRow?.lastActiveSeason ?? null,
    v82SafeSubsetStatus: row.v82SafeSubsetStatus === "v82_safe_subset" ? "v82_safe_subset" : "not_v82_safe_subset",
    projectedTotalPointDelta: row.projectedTotalPointDelta,
    estimatedOverallRankMovement: row.estimatedOverallRankMovement,
    classification,
    reasonCodes,
    h21PolicyPreview: policyFor(classification),
    sourcePriority: sourcePriorityFor(classification),
    h25Row: row,
    h23Row,
    policyRow,
    snapshotRow,
  };
}

function reasonCodesFor(
  row: ProjectionCrosswalkEnhancedConfirmationRow,
  h23Row: ProjectionRookieNewTargetDiagnosticsRow | null,
  policyRow: ProjectionActiveUniversePolicyPacketRow | null,
  snapshotRow: PreseasonProjectionSnapshotRow | null,
): ProjectionCrosswalkUnmatchedReasonCode[] {
  const codes = new Set<ProjectionCrosswalkUnmatchedReasonCode>(["exact_crosswalk_confirmed", "missing_from_current_roster_source", "missing_from_rookie_source"]);
  if ((policyRow?.lastActiveSeason ?? 0) > 0 && (policyRow?.lastActiveSeason ?? 0) < 2025) codes.add("old_last_seen_signal");
  if (snapshotRow?.confidence === "very_low" || (snapshotRow?.inputCoverage?.priorGames ?? 0) <= 1 || snapshotRow?.inputCoverage?.noPriorNflData) codes.add("low_prior_signal");
  if (row.existingRosterConfirmationStatus === "roster_unmatched" || row.existingRosterConfirmationStatus === "roster_source_missing") codes.add("no_current_roster_confirmation");
  if (row.sleeperId && !row.currentRosterStatus) codes.add("sleeper_only_status_needed");
  if (policyRow?.recommendedPolicyAction === "needs_transaction_status_source" || policyRow?.policyGroup === "stale_unmatched_review") codes.add("recent_activity_needs_transaction_status");
  if ((policyRow?.lastActiveSeason ?? 0) < 2025) codes.add("possible_free_agent_or_retired");
  if (h23Row?.positionFamilyDiagnostic && h23Row.positionFamilyDiagnostic !== "not_applicable" && h23Row.positionFamilyDiagnostic !== "position_family_exact") codes.add("position_family_uncertain");
  if (snapshotRow) codes.add("historical_name_present");
  if (row.v82SafeSubsetStatus === "v82_safe_subset") codes.add("v8_2_safe_but_held_back");
  if (policyRow?.recommendedPolicyAction === "needs_depth_chart_source") codes.add("depth_chart_policy_need");
  return [...codes];
}

function classificationFor(
  row: ProjectionCrosswalkEnhancedConfirmationRow,
  h23Row: ProjectionRookieNewTargetDiagnosticsRow | null,
  policyRow: ProjectionActiveUniversePolicyPacketRow | null,
  snapshotRow: PreseasonProjectionSnapshotRow | null,
  codes: ProjectionCrosswalkUnmatchedReasonCode[],
): ProjectionCrosswalkUnmatchedClass {
  if (codes.includes("position_family_uncertain")) return "needs_manual_review";
  if (policyRow?.recommendedPolicyAction === "needs_depth_chart_source") return "needs_depth_chart_source";
  if (policyRow?.recommendedPolicyAction === "needs_transaction_status_source" || policyRow?.policyGroup === "stale_unmatched_review") return "needs_transaction_status_source";
  if ((policyRow?.lastActiveSeason ?? 0) > 0 && (policyRow?.lastActiveSeason ?? 0) < 2025) return "likely_inactive_or_archive";
  if (row.sleeperId && (snapshotRow?.confidence === "very_low" || snapshotRow?.inputCoverage?.noPriorNflData || h23Row?.targetIdentityClass === "sleeper_only_player")) return "needs_sleeper_status_source";
  return "keep_source_expansion_required";
}

function policyFor(classification: ProjectionCrosswalkUnmatchedClass): ProjectionActiveUniversePolicyClassification {
  if (classification === "likely_inactive_or_archive") return "policy_blocked_archive";
  if (classification === "needs_manual_review") return "policy_manual_review";
  if (classification === "keep_source_expansion_required") return "policy_source_expansion_required";
  return "policy_source_expansion_required";
}

function sourcePriorityFor(classification: ProjectionCrosswalkUnmatchedClass): ProjectionCrosswalkUnmatchedSourcePriority {
  if (classification === "needs_sleeper_status_source") return "sleeper_player_metadata_source";
  if (classification === "needs_transaction_status_source") return "transaction_free_agent_source";
  if (classification === "needs_depth_chart_source") return "depth_chart_source";
  if (classification === "needs_manual_review") return "manual_review";
  return "keep_shadow_only_policy";
}

function recommendedSourcePriority(counts: Record<ProjectionCrosswalkUnmatchedSourcePriority, number>): ProjectionCrosswalkUnmatchedSourcePriority {
  return [...SOURCE_PRIORITIES].sort((a, b) => counts[b] - counts[a] || SOURCE_PRIORITIES.indexOf(a) - SOURCE_PRIORITIES.indexOf(b))[0];
}

function buildSummary(rows: ProjectionCrosswalkUnmatchedRow[]): ProjectionCrosswalkUnmatchedReport["summary"] {
  const projectionDeltas = rows.map((row) => Math.abs(row.projectedTotalPointDelta ?? 0));
  const rankMovements = rows.map((row) => Math.abs(row.estimatedOverallRankMovement ?? 0));
  return {
    totalCrosswalkUnmatchedRows: rows.length,
    byClassification: countByFixed(rows, CLASSES, (row) => row.classification),
    byPosition: countBy(rows, (row) => row.position),
    byTeam: countBy(rows, (row) => row.projectionTeam ?? "missing_team"),
    byOriginalH21PolicyGroup: countBy(rows, (row) => row.h21PolicyGroup ?? "missing_policy_group"),
    byH23IdentityClass: countBy(rows, (row) => row.h23IdentityClass ?? "missing_identity_class"),
    byV82SafeSubset: countBy(rows, (row) => row.v82SafeSubsetStatus),
    projectionImportance: {
      topProjectionDelta: projectionDeltas.length ? Math.max(...projectionDeltas) : null,
      topRankMovement: rankMovements.length ? Math.max(...rankMovements) : null,
      criticalOrMeaningfulRows: rows.filter((row) => Math.abs(row.estimatedOverallRankMovement ?? 0) >= 24 || Math.abs(row.projectedTotalPointDelta ?? 0) >= 25).length,
    },
  };
}

function sourceMissingReport(input: ProjectionCrosswalkUnmatchedInput): ProjectionCrosswalkUnmatchedReport {
  const zeroChecks = zeroChecksFor(input.rosterRefresh);
  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? sourceArtifactsFor(input),
    sourceMissing: true,
    summary: {
      totalCrosswalkUnmatchedRows: 0,
      byClassification: Object.fromEntries(CLASSES.map((classification) => [classification, 0])) as Record<ProjectionCrosswalkUnmatchedClass, number>,
      byPosition: {},
      byTeam: {},
      byOriginalH21PolicyGroup: {},
      byH23IdentityClass: {},
      byV82SafeSubset: {},
      projectionImportance: { topProjectionDelta: null, topRankMovement: null, criticalOrMeaningfulRows: 0 },
    },
    sourcePriorityRecommendation: {
      recommendedSourcePriority: "manual_review",
      priorityCounts: Object.fromEntries(SOURCE_PRIORITIES.map((priority) => [priority, 0])) as Record<ProjectionCrosswalkUnmatchedSourcePriority, number>,
      note: "Required source artifacts are missing.",
    },
    h21PolicyPreview: {
      wouldRemainUnder: Object.fromEntries(POLICY_CLASSIFICATIONS.map((classification) => [classification, 0])) as Record<ProjectionActiveUniversePolicyClassification, number>,
      notes: ["Required source artifacts are missing."],
    },
    v82Impact: { safeRowsAffected: 0, safeRowsStillHeldBack: 0, blocksControlledFlagReview: false, zeroChecksPreserved: Object.values(zeroChecks).every(Boolean), zeroChecks },
    examples: { topLikelyInactiveArchiveRows: [], topNeedsTransactionStatusRows: [], topNeedsSleeperStatusRows: [], topNeedsDepthChartRows: [], topV82SafeHeldBackRows: [] },
    rows: [],
    safetyGates: [gate("required_sources_present", false, "One or more required H26 source artifacts are missing.")],
    recommendation: "crosswalk_unmatched_blocked",
    notes: ["H26 did not mutate live outputs."],
  };
}

function buildSafetyGates(rows: ProjectionCrosswalkUnmatchedRow[], zeroChecks: ProjectionCrosswalkUnmatchedReport["v82Impact"]["zeroChecks"]) {
  return [
    gate("no_live_outputs_changed", true, "Report reads artifacts and writes only local H26 artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Blackbird Rank ordering is not imported, recalculated, or mutated."),
    gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported, recalculated, or mutated."),
    gate("war_room_scoring_unchanged", true, "War Room scoring behavior is not imported, recalculated, or mutated."),
    gate("v8_2_not_enabled", true, "v8.2 feature flag and projection selector behavior are not changed."),
    gate("unmatched_rows_not_forced_active", rows.every((row) => row.h21PolicyPreview !== "policy_active_candidate"), "No unmatched row is previewed as active candidate."),
    gate("source_need_reported", rows.length === 0 || rows.every((row) => row.sourcePriority), `${rows.length} unmatched rows classified with source priority.`),
    gate("v8_2_zero_checks_preserved", Object.values(zeroChecks).every(Boolean), "K, critical mover, meaningful rank mover, and legacy v8.2 zero checks remain zero."),
  ];
}

function recommendationFor(safetyGates: ProjectionCrosswalkUnmatchedReport["safetyGates"], rows: ProjectionCrosswalkUnmatchedRow[]): ProjectionCrosswalkUnmatchedRecommendation {
  if (safetyGates.some((gateRow) => !gateRow.passed)) return "crosswalk_unmatched_blocked";
  if (rows.some((row) => row.classification === "needs_manual_review")) return "crosswalk_unmatched_needs_manual_review";
  return "crosswalk_unmatched_ready_for_source_selection";
}

function zeroChecksFor(rosterRefresh: ProjectionActiveUniverseGateRosterRefreshReport | null) {
  const packet = rosterRefresh?.v82SafeSubsetCrossReference.packetSummary;
  return {
    kRowsUsingV82: (packet?.kRowsUsingV82 ?? 0) === 0,
    criticalMoversUsingV82: (packet?.criticalMoversUsingV82 ?? 0) === 0,
    meaningfulRankMoversUsingV82: (packet?.meaningfulRankMoversUsingV82 ?? 0) === 0,
    legacyRowsUsingV82: (packet?.legacyRowsUsingV82 ?? 0) === 0,
  };
}

function sourceArtifactsFor(input: ProjectionCrosswalkUnmatchedInput): ProjectionCrosswalkUnmatchedReport["sourceArtifacts"] {
  return {
    crosswalkEnhancedConfirmation: input.crosswalkEnhancedConfirmation ? "in-memory" : "missing",
    playerIdCrosswalkReview: input.playerIdCrosswalkReview ? "in-memory" : "missing",
    rookieNewTargetDiagnostics: input.rookieNewTargetDiagnostics ? "in-memory" : "missing",
    policyPacket: input.policyPacket ? "in-memory" : "missing",
    rosterRefresh: input.rosterRefresh ? "in-memory" : "missing",
    currentRosterConfirmation: input.currentRosterConfirmation ? "in-memory" : "missing",
    currentRosterSource: input.currentRosterSourcePresent ? "in-memory" : null,
    preseasonProjectionSnapshot: input.preseasonProjectionSnapshot ? "in-memory" : "missing",
  };
}

function renderMarkdown(report: ProjectionCrosswalkUnmatchedReport) {
  return `# Projection Crosswalk-Unmatched Classification ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Recommendation: ${report.recommendation}
Source priority: ${report.sourcePriorityRecommendation.recommendedSourcePriority}

## Summary

\`\`\`json
${JSON.stringify(report.summary, null, 2)}
\`\`\`

## Source Priority

\`\`\`json
${JSON.stringify(report.sourcePriorityRecommendation, null, 2)}
\`\`\`

## H21 Policy Preview

\`\`\`json
${JSON.stringify(report.h21PolicyPreview, null, 2)}
\`\`\`

## v8.2 Impact

\`\`\`json
${JSON.stringify(report.v82Impact, null, 2)}
\`\`\`

## Likely Inactive / Archive

${renderRows(report.examples.topLikelyInactiveArchiveRows)}

## Needs Transaction Status

${renderRows(report.examples.topNeedsTransactionStatusRows)}

## Needs Sleeper Status

${renderRows(report.examples.topNeedsSleeperStatusRows)}

## Needs Depth Chart

${renderRows(report.examples.topNeedsDepthChartRows)}

## v8.2 Safe But Held Back

${renderRows(report.examples.topV82SafeHeldBackRows)}

## Safety Gates

${renderGateTable(report.safetyGates)}
`;
}

function renderRows(rows: ProjectionCrosswalkUnmatchedRow[]) {
  if (!rows.length) return "No rows.";
  return [
    "| Player | Pos | Team | Class | Source Priority | Policy Preview | Reasons |",
    "|---|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.projectionTeam ?? ""} | ${row.classification} | ${row.sourcePriority} | ${row.h21PolicyPreview} | ${row.reasonCodes.slice(0, 4).join(" ")} |`),
  ].join("\n");
}

function renderGateTable(gates: ProjectionCrosswalkUnmatchedReport["safetyGates"]) {
  return [
    "| Gate | Status | Detail |",
    "|---|---|---|",
    ...gates.map((gateRow) => `| ${gateRow.name} | ${gateRow.passed ? "PASS" : "FAIL"} | ${gateRow.detail} |`),
  ].join("\n");
}

function renderCsv(report: ProjectionCrosswalkUnmatchedReport) {
  const headers = ["player_id", "sleeper_id", "gsis_id", "player", "position", "projection_team", "classification", "source_priority", "h21_policy_preview", "h21_policy_group", "h23_identity_class", "last_active_season", "v82_safe_subset", "reason_codes"];
  const rows = report.rows.map((row) => [
    row.playerId,
    row.sleeperId ?? "",
    row.crosswalkGsisId ?? "",
    row.player,
    row.position,
    row.projectionTeam ?? "",
    row.classification,
    row.sourcePriority,
    row.h21PolicyPreview,
    row.h21PolicyGroup ?? "",
    row.h23IdentityClass ?? "",
    row.lastActiveSeason ?? "",
    row.v82SafeSubsetStatus,
    row.reasonCodes.join("|"),
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function topRows(rows: ProjectionCrosswalkUnmatchedRow[], limit: number) {
  return [...rows].sort((a, b) =>
    Math.abs(b.projectedTotalPointDelta ?? 0) - Math.abs(a.projectedTotalPointDelta ?? 0)
    || Math.abs(b.estimatedOverallRankMovement ?? 0) - Math.abs(a.estimatedOverallRankMovement ?? 0)
    || a.player.localeCompare(b.player)
  ).slice(0, limit);
}

function countBy<T>(rows: T[], keyFor: (row: T) => string) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = keyFor(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function countByFixed<T, Key extends string>(rows: T[], keys: Key[], keyFor: (row: T) => Key) {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<Key, number>;
  for (const row of rows) counts[keyFor(row)] += 1;
  return counts;
}

function mapFirst<T>(entries: Array<readonly [string, T]>) {
  const mapped = new Map<string, T>();
  for (const [key, value] of entries) if (!mapped.has(key)) mapped.set(key, value);
  return mapped;
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function readIfExists<T>(artifactPath: string): T | null {
  return existsSync(artifactPath) ? readJson<T>(artifactPath) : null;
}

function readJson<T>(artifactPath: string): T {
  return JSON.parse(readFileSync(artifactPath, "utf8")) as T;
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
