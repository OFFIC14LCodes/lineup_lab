import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ProjectionActiveUniverseGateReport } from "./projection-active-universe-gate-types";
import type { ProjectionActiveUniverseGateRosterRefreshReport, ProjectionActiveUniverseGateRosterRefreshRow } from "./projection-active-universe-gate-roster-refresh-types";
import type { ProjectionCurrentRosterConfirmationReport } from "./projection-current-roster-confirmation-types";
import type { ProjectionCurrentRosterConfirmationDeltaReport } from "./projection-current-roster-confirmation-delta-types";
import type { ProjectionPromotionCandidatePoolReport, ProjectionPromotionCandidateRow } from "./projection-promotion-candidate-pool-types";
import type {
  ProjectionRosterRefreshPolicyAction,
  ProjectionRosterRefreshPolicyGroup,
  ProjectionRosterRefreshPolicyRecommendation,
  ProjectionRosterRefreshPolicyReviewArtifactPaths,
  ProjectionRosterRefreshPolicyReviewInput,
  ProjectionRosterRefreshPolicyReviewOptions,
  ProjectionRosterRefreshPolicyReviewReport,
  ProjectionRosterRefreshPolicyReviewRow,
} from "./projection-roster-refresh-policy-review-types";
import type { ProjectionV82FeatureFlagReviewPacketReport } from "./projection-v8-2-feature-flag-review-packet-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const POLICY_GROUPS: ProjectionRosterRefreshPolicyGroup[] = [
  "conflict_review",
  "manual_review_remaining",
  "unmatched_active_candidate_review",
  "unmatched_rookie_new_review",
  "unmatched_low_confidence_review",
  "stale_unmatched_review",
  "kicker_policy_review",
  "legacy_blocked",
  "confirmed_active_clear",
  "confirmed_ir_pup_nfi_review",
  "confirmed_non_active_review",
];
const POLICY_ACTIONS: ProjectionRosterRefreshPolicyAction[] = [
  "safe_to_keep_active_candidate",
  "needs_depth_chart_source",
  "needs_transaction_status_source",
  "needs_rookie_team_confirmation",
  "needs_manual_team_conflict_review",
  "keep_blocked_archive",
  "keep_current_path",
  "keep_shadow_only",
  "needs_kicker_policy",
  "needs_injury_status_review",
];

export function runProjectionRosterRefreshPolicyReview(options: ProjectionRosterRefreshPolicyReviewOptions): ProjectionRosterRefreshPolicyReviewReport {
  const sourceArtifacts = {
    rosterRefresh: path.join(OUTPUT_DIR, `projection-active-universe-gate-roster-refresh-${options.projectionSeason}.json`),
    currentRosterConfirmation: path.join(OUTPUT_DIR, `projection-current-roster-confirmation-${options.projectionSeason}.json`),
    currentRosterConfirmationDelta: path.join(OUTPUT_DIR, `projection-current-roster-confirmation-delta-${options.projectionSeason}.json`),
    activeUniverseGate: path.join(OUTPUT_DIR, `projection-active-universe-gate-${options.projectionSeason}.json`),
    universeHygieneSummary: path.join(OUTPUT_DIR, `projection-universe-hygiene-summary-${options.projectionSeason}.json`),
    featureFlagReviewPacket: path.join(OUTPUT_DIR, `projection-v8-2-feature-flag-review-packet-${options.projectionSeason}.json`),
    promotionCandidatePool: path.join(OUTPUT_DIR, `projection-promotion-candidate-pool-${options.projectionSeason}.json`),
  };
  for (const artifactPath of Object.values(sourceArtifacts)) {
    if (!existsSync(artifactPath)) throw new Error(`Missing ${path.relative(process.cwd(), artifactPath)}.`);
  }

  return buildProjectionRosterRefreshPolicyReviewFromData({
    options,
    rosterRefresh: readJson<ProjectionActiveUniverseGateRosterRefreshReport>(sourceArtifacts.rosterRefresh),
    currentRosterConfirmation: readJson<ProjectionCurrentRosterConfirmationReport>(sourceArtifacts.currentRosterConfirmation),
    currentRosterConfirmationDelta: readJson<ProjectionCurrentRosterConfirmationDeltaReport>(sourceArtifacts.currentRosterConfirmationDelta),
    activeUniverseGate: readJson<ProjectionActiveUniverseGateReport>(sourceArtifacts.activeUniverseGate),
    featureFlagReviewPacket: readJson<ProjectionV82FeatureFlagReviewPacketReport>(sourceArtifacts.featureFlagReviewPacket),
    promotionCandidatePool: readJson<ProjectionPromotionCandidatePoolReport>(sourceArtifacts.promotionCandidatePool),
    sourceArtifacts,
  });
}

export function buildProjectionRosterRefreshPolicyReviewFromData(input: ProjectionRosterRefreshPolicyReviewInput): ProjectionRosterRefreshPolicyReviewReport {
  const promotionById = new Map(input.promotionCandidatePool.rows.map((row) => [row.playerId, row]));
  const rows = input.rosterRefresh.rows.map((row) => policyRow(row, promotionById.get(row.playerId)));
  const conflicts = topRows(rows.filter((row) => row.policyGroup === "conflict_review"), 100);
  const remainingManualReviewRows = topRows(rows.filter((row) => row.h19Status === "manual_review_required"), 100);
  const policyActionableUnmatchedRows = rows.filter((row) => isUnmatchedGroup(row.policyGroup));
  const allUnmatchedRows = rows.filter((row) => row.confirmationStatus === "roster_unmatched" || row.confirmationStatus === "roster_source_missing");
  const rookieNewRows = rows.filter((row) => row.policyGroup === "unmatched_rookie_new_review");
  const activeCandidateRows = rows.filter((row) => row.policyGroup === "unmatched_active_candidate_review");
  const lowConfidenceRows = rows.filter((row) => row.policyGroup === "unmatched_low_confidence_review");
  const kickerRows = rows.filter((row) => row.policyGroup === "kicker_policy_review");
  const packetZeroChecks = {
    kRowsUsingV82: input.featureFlagReviewPacket.safetySummary.kRowsUsingV82 === 0,
    criticalMoversUsingV82: input.featureFlagReviewPacket.safetySummary.criticalMoversUsingV82 === 0,
    meaningfulRankMoversUsingV82: input.featureFlagReviewPacket.safetySummary.meaningfulRankMoversUsingV82 === 0,
    legacyRowsUsingV82: input.featureFlagReviewPacket.safetySummary.legacyRowsUsingV82 === 0,
  };
  const v82AdoptionImpact = {
    safeSubsetRowsInsideConfirmedActiveClear: rows.filter((row) => row.policyGroup === "confirmed_active_clear" && row.v82Path === "would_use_v8_2_safe_subset").length,
    safeSubsetRowsInsideUnmatchedGroups: allUnmatchedRows.filter((row) => row.v82Path === "would_use_v8_2_safe_subset").length,
    protectedRowsInsideConflictManualKickerGroups: rows.filter((row) =>
      (row.policyGroup === "conflict_review" || row.policyGroup === "manual_review_remaining" || row.policyGroup === "kicker_policy_review")
      && row.v82Path !== "would_use_v8_2_safe_subset"
    ).length,
    safeSubsetRemainsIntact: Object.values(packetZeroChecks).every(Boolean),
    packetZeroChecks,
  };
  const safetyGates = buildSafetyGates(input, rows, conflicts, remainingManualReviewRows, allUnmatchedRows, kickerRows, v82AdoptionImpact.safeSubsetRemainsIntact);
  const recommendation = recommendationFor(safetyGates, conflicts, remainingManualReviewRows, policyActionableUnmatchedRows, kickerRows);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? {
      rosterRefresh: "in-memory",
      currentRosterConfirmation: "in-memory",
      currentRosterConfirmationDelta: "in-memory",
      activeUniverseGate: "in-memory",
      universeHygieneSummary: "in-memory",
      featureFlagReviewPacket: "in-memory",
      promotionCandidatePool: "in-memory",
    },
    policyGroupCounts: countPolicyGroups(rows),
    actionCounts: countPolicyActions(rows),
    conflicts,
    remainingManualReviewRows,
    unmatchedSummary: {
      totalRows: allUnmatchedRows.length,
      byH19Status: countBy(allUnmatchedRows, (row) => row.h19Status),
      byPosition: countBy(allUnmatchedRows, (row) => row.position || "unknown_position"),
      byTeam: countBy(allUnmatchedRows, (row) => row.projectionTeam ?? "missing_team"),
      byPromotionClassification: countBy(allUnmatchedRows, (row) => row.promotionEligibilityClassification),
      byV82Status: countBy(allUnmatchedRows, (row) => row.v82ProtectionStatus),
      byStaleLegacyStatus: countBy(allUnmatchedRows, staleLegacyBucket),
    },
    rookieNewUnmatched: groupSummary(rookieNewRows, "needs_rookie_team_confirmation"),
    activeCandidateUnmatched: groupSummary(activeCandidateRows, "needs_depth_chart_source"),
    lowConfidenceUnmatched: groupSummary(lowConfidenceRows, "needs_depth_chart_source"),
    kickerPolicy: {
      totalKRows: kickerRows.length,
      confirmedRosterDepthRows: kickerRows.filter((row) => row.rosterStatus).length,
      unmatchedKRows: kickerRows.filter((row) => row.confirmationStatus === "roster_unmatched" || row.confirmationStatus === "roster_source_missing").length,
      criticalMoverKRows: kickerRows.filter((row) => row.criticalMovement).length,
      blockedKRows: kickerRows.filter((row) => row.promotionEligibilityClassification === "blocked_from_promotion").length,
      shadowOnlyKRows: kickerRows.filter((row) => row.promotionEligibilityClassification === "shadow_only").length,
      recommendedAction: "needs_kicker_policy",
      topExamples: topRows(kickerRows),
    },
    v82AdoptionImpact,
    rows,
    safetyGates,
    recommendation,
    notes: [
      "H20 is a dry-run/read-only roster-refresh policy review packet.",
      "Rows are grouped for policy review only; production projections and draft behavior are not filtered or changed.",
      "Unmatched rows are summarized and capped in markdown; the CSV contains all row-level policy assignments.",
      "No live projections, Blackbird Rank ordering, Draft Suggestion ordering, War Room scoring behavior, Supabase writes, or v8.2 enablement are changed.",
    ],
  };
}

export function writeProjectionRosterRefreshPolicyReviewArtifacts(report: ProjectionRosterRefreshPolicyReviewReport): ProjectionRosterRefreshPolicyReviewArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-roster-refresh-policy-review-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function policyRow(row: ProjectionActiveUniverseGateRosterRefreshRow, promotionRow: ProjectionPromotionCandidateRow | undefined): ProjectionRosterRefreshPolicyReviewRow {
  const policyGroup = policyGroupFor(row);
  return {
    playerId: row.playerId,
    player: row.player,
    position: row.position,
    projectionTeam: row.projectionTeam,
    rosterTeam: row.rosterTeam,
    rosterStatus: row.rosterStatus,
    originalGateStatus: row.originalGateStatus,
    h19Status: row.refreshedGateStatus,
    confirmationStatus: row.confirmationStatus,
    promotionEligibilityClassification: row.promotionEligibilityClassification,
    policyGroup,
    recommendedPolicyAction: policyActionFor(row, policyGroup),
    v82Path: row.v82Path,
    v82ProtectionStatus: row.v82Path === "would_use_v8_2_safe_subset" ? "would_use_v8_2_safe_subset" : row.v82Path === "would_stay_current_path" ? "protected_current_path" : "excluded_or_blocked",
    reasonCodes: [...row.reasonCodes, ...row.refreshReasonCodes, ...(promotionRow?.reasonCodes ?? [])],
    lastActiveSeason: row.lastActiveSeason,
    projectedTotalPointDelta: row.projectedTotalPointDelta,
    criticalMovement: row.criticalMovement || Boolean(promotionRow?.criticalMovement),
    estimatedOverallRankMovement: row.estimatedOverallRankMovement,
  };
}

function policyGroupFor(row: ProjectionActiveUniverseGateRosterRefreshRow): ProjectionRosterRefreshPolicyGroup {
  if (row.confirmationStatus === "roster_conflict") return "conflict_review";
  if (row.refreshedGateStatus === "kicker_policy_review" || row.position === "K") return "kicker_policy_review";
  if (row.refreshedGateStatus === "legacy_archive_blocked") return "legacy_blocked";
  if (row.refreshedGateStatus === "manual_review_required") return "manual_review_remaining";
  if (row.refreshedGateStatus === "rookie_or_new_unmatched_review") return "unmatched_rookie_new_review";
  if (row.refreshedGateStatus === "roster_unmatched_review" && row.originalGateStatus === "stale_status_review") return "stale_unmatched_review";
  if (row.refreshedGateStatus === "roster_unmatched_review" && row.originalGateStatus === "low_confidence_plausible") return "unmatched_low_confidence_review";
  if (row.refreshedGateStatus === "roster_unmatched_review") return "unmatched_active_candidate_review";
  if (row.refreshedGateStatus === "roster_confirmed_ir_pup_nfi") return "confirmed_ir_pup_nfi_review";
  if (row.refreshedGateStatus === "roster_confirmed_non_active") return "confirmed_non_active_review";
  return "confirmed_active_clear";
}

function policyActionFor(row: ProjectionActiveUniverseGateRosterRefreshRow, group: ProjectionRosterRefreshPolicyGroup): ProjectionRosterRefreshPolicyAction {
  if (group === "conflict_review") {
    if (row.rosterStatus === "retired" && row.originalGateStatus === "legacy_archive_blocked") return "keep_blocked_archive";
    if (row.rosterStatus === "retired") return "needs_transaction_status_source";
    return "needs_manual_team_conflict_review";
  }
  if (group === "manual_review_remaining") return "keep_current_path";
  if (group === "unmatched_rookie_new_review") return "needs_rookie_team_confirmation";
  if (group === "unmatched_active_candidate_review") return row.projectionTeam && row.projectionTeam !== "FA" ? "needs_depth_chart_source" : "needs_transaction_status_source";
  if (group === "unmatched_low_confidence_review") return "needs_depth_chart_source";
  if (group === "stale_unmatched_review") return "needs_transaction_status_source";
  if (group === "kicker_policy_review") return "needs_kicker_policy";
  if (group === "legacy_blocked") return "keep_blocked_archive";
  if (group === "confirmed_ir_pup_nfi_review") return "needs_injury_status_review";
  if (group === "confirmed_non_active_review") return "needs_transaction_status_source";
  return "safe_to_keep_active_candidate";
}

function buildSafetyGates(
  input: ProjectionRosterRefreshPolicyReviewInput,
  rows: ProjectionRosterRefreshPolicyReviewRow[],
  conflicts: ProjectionRosterRefreshPolicyReviewRow[],
  remainingManualReviewRows: ProjectionRosterRefreshPolicyReviewRow[],
  unmatchedRows: ProjectionRosterRefreshPolicyReviewRow[],
  kickerRows: ProjectionRosterRefreshPolicyReviewRow[],
  safeSubsetRemainsIntact: boolean,
) {
  return [
    gate("no_live_outputs_changed", true, "Report reads artifacts and writes only local H20 artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Blackbird Rank ordering is not imported, recalculated, or mutated."),
    gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported, recalculated, or mutated."),
    gate("war_room_scoring_unchanged", true, "War Room scoring behavior is not imported, recalculated, or mutated."),
    gate("v8_2_not_enabled", true, "v8.2 feature flag and projection selector behavior are not changed."),
    gate("conflicts_listed", conflicts.length === input.rosterRefresh.matchedSummary.conflicts, `${conflicts.length} conflicts listed.`),
    gate("manual_review_rows_listed", remainingManualReviewRows.length === input.rosterRefresh.beforeAfterStatusCounts.refreshedStatusCounts.manual_review_required, `${remainingManualReviewRows.length} manual-review rows listed.`),
    gate("unmatched_groups_summarized", unmatchedRows.length === input.rosterRefresh.matchedSummary.unmatchedRows, `${unmatchedRows.length} unmatched rows summarized.`),
    gate("kicker_policy_reported", kickerRows.length === input.rosterRefresh.beforeAfterStatusCounts.refreshedStatusCounts.kicker_policy_review, `${kickerRows.length} K rows reported.`),
    gate("v8_2_protection_preserved", safeSubsetRemainsIntact, "v8.2 packet zero checks remain preserved."),
    gate("all_rows_grouped", rows.length === input.rosterRefresh.rows.length, `${rows.length} rows grouped.`),
  ];
}

function recommendationFor(
  safetyGates: ProjectionRosterRefreshPolicyReviewReport["safetyGates"],
  conflicts: ProjectionRosterRefreshPolicyReviewRow[],
  remainingManualReviewRows: ProjectionRosterRefreshPolicyReviewRow[],
  unmatchedRows: ProjectionRosterRefreshPolicyReviewRow[],
  kickerRows: ProjectionRosterRefreshPolicyReviewRow[],
): ProjectionRosterRefreshPolicyRecommendation {
  if (safetyGates.some((gateRow) => !gateRow.passed)) return "roster_policy_blocked";
  if (conflicts.length || remainingManualReviewRows.length || unmatchedRows.length || kickerRows.length) return "roster_policy_needs_manual_review";
  return "roster_policy_ready_for_source_expansion";
}

function groupSummary(rows: ProjectionRosterRefreshPolicyReviewRow[], recommendedAction: ProjectionRosterRefreshPolicyAction) {
  return {
    totalRows: rows.length,
    positionCounts: countBy(rows, (row) => row.position || "unknown_position"),
    teamCounts: countBy(rows, (row) => row.projectionTeam ?? "missing_team"),
    v82SafeSubsetRows: rows.filter((row) => row.v82Path === "would_use_v8_2_safe_subset").length,
    recommendedAction,
    topExamples: topRows(rows),
  };
}

function isUnmatchedGroup(group: ProjectionRosterRefreshPolicyGroup) {
  return group === "unmatched_active_candidate_review"
    || group === "unmatched_rookie_new_review"
    || group === "unmatched_low_confidence_review"
    || group === "stale_unmatched_review";
}

function staleLegacyBucket(row: ProjectionRosterRefreshPolicyReviewRow) {
  if (row.policyGroup === "legacy_blocked") return "legacy_blocked";
  if (row.policyGroup === "stale_unmatched_review") return "stale_unmatched_review";
  return "not_stale_or_legacy";
}

function renderMarkdown(report: ProjectionRosterRefreshPolicyReviewReport) {
  return `# Projection Roster Refresh Policy Review ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Recommendation: ${report.recommendation}

## Policy Group Counts

\`\`\`json
${JSON.stringify(report.policyGroupCounts, null, 2)}
\`\`\`

## Recommended Actions

\`\`\`json
${JSON.stringify(report.actionCounts, null, 2)}
\`\`\`

## Conflicts

${renderRows(report.conflicts)}

## Remaining Manual Review

${renderRows(report.remainingManualReviewRows)}

## Unmatched Summary

\`\`\`json
${JSON.stringify(report.unmatchedSummary, null, 2)}
\`\`\`

## Rookies / New Unmatched

\`\`\`json
${JSON.stringify({
    totalRows: report.rookieNewUnmatched.totalRows,
    positionCounts: report.rookieNewUnmatched.positionCounts,
    teamCounts: report.rookieNewUnmatched.teamCounts,
    v82SafeSubsetRows: report.rookieNewUnmatched.v82SafeSubsetRows,
    recommendedAction: report.rookieNewUnmatched.recommendedAction,
  }, null, 2)}
\`\`\`

${renderRows(report.rookieNewUnmatched.topExamples)}

## Active Candidate Unmatched

\`\`\`json
${JSON.stringify({
    totalRows: report.activeCandidateUnmatched.totalRows,
    positionCounts: report.activeCandidateUnmatched.positionCounts,
    teamCounts: report.activeCandidateUnmatched.teamCounts,
    v82SafeSubsetRows: report.activeCandidateUnmatched.v82SafeSubsetRows,
    recommendedAction: report.activeCandidateUnmatched.recommendedAction,
  }, null, 2)}
\`\`\`

${renderRows(report.activeCandidateUnmatched.topExamples)}

## Low Confidence Unmatched

\`\`\`json
${JSON.stringify({
    totalRows: report.lowConfidenceUnmatched.totalRows,
    positionCounts: report.lowConfidenceUnmatched.positionCounts,
    teamCounts: report.lowConfidenceUnmatched.teamCounts,
    v82SafeSubsetRows: report.lowConfidenceUnmatched.v82SafeSubsetRows,
    recommendedAction: report.lowConfidenceUnmatched.recommendedAction,
  }, null, 2)}
\`\`\`

${renderRows(report.lowConfidenceUnmatched.topExamples)}

## Kicker Policy

\`\`\`json
${JSON.stringify(report.kickerPolicy, null, 2)}
\`\`\`

## v8.2 Adoption Impact

\`\`\`json
${JSON.stringify(report.v82AdoptionImpact, null, 2)}
\`\`\`

## Safety Gates

${renderGateTable(report.safetyGates)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderCsv(report: ProjectionRosterRefreshPolicyReviewReport) {
  const headers = [
    "player_id",
    "player",
    "position",
    "projection_team",
    "roster_team",
    "roster_status",
    "h19_status",
    "policy_group",
    "recommended_policy_action",
    "v82_path",
    "v82_protection_status",
    "promotion_classification",
    "reason_codes",
  ];
  return [headers, ...report.rows.map((row) => [
    row.playerId,
    row.player,
    row.position,
    row.projectionTeam ?? "",
    row.rosterTeam ?? "",
    row.rosterStatus ?? "",
    row.h19Status,
    row.policyGroup,
    row.recommendedPolicyAction,
    row.v82Path,
    row.v82ProtectionStatus,
    row.promotionEligibilityClassification,
    row.reasonCodes.join("|"),
  ])].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function renderRows(rows: ProjectionRosterRefreshPolicyReviewRow[]) {
  if (!rows.length) return "No rows.";
  return [
    "| Player | Pos | Projection Team | Roster Team | Roster Status | H19 Status | v8.2 | Action |",
    "|---|---|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.projectionTeam ?? ""} | ${row.rosterTeam ?? ""} | ${row.rosterStatus ?? ""} | ${row.h19Status} | ${row.v82ProtectionStatus} | ${row.recommendedPolicyAction} |`),
  ].join("\n");
}

function renderGateTable(gates: ProjectionRosterRefreshPolicyReviewReport["safetyGates"]) {
  return [
    "| Gate | Status | Detail |",
    "|---|---|---|",
    ...gates.map((gateRow) => `| ${gateRow.name} | ${gateRow.passed ? "PASS" : "FAIL"} | ${gateRow.detail} |`),
  ].join("\n");
}

function topRows(rows: ProjectionRosterRefreshPolicyReviewRow[], limit = 50) {
  return [...rows]
    .sort((a, b) =>
      Math.abs(b.projectedTotalPointDelta ?? 0) - Math.abs(a.projectedTotalPointDelta ?? 0)
      || (a.lastActiveSeason ?? 9999) - (b.lastActiveSeason ?? 9999)
      || a.player.localeCompare(b.player)
    )
    .slice(0, limit);
}

function countPolicyGroups(rows: ProjectionRosterRefreshPolicyReviewRow[]) {
  const counts = Object.fromEntries(POLICY_GROUPS.map((group) => [group, 0])) as Record<ProjectionRosterRefreshPolicyGroup, number>;
  for (const row of rows) counts[row.policyGroup] += 1;
  return counts;
}

function countPolicyActions(rows: ProjectionRosterRefreshPolicyReviewRow[]) {
  const counts = Object.fromEntries(POLICY_ACTIONS.map((action) => [action, 0])) as Record<ProjectionRosterRefreshPolicyAction, number>;
  for (const row of rows) counts[row.recommendedPolicyAction] += 1;
  return counts;
}

function countBy<Key extends string>(rows: ProjectionRosterRefreshPolicyReviewRow[], keyFor: (row: ProjectionRosterRefreshPolicyReviewRow) => Key) {
  const counts: Record<Key, number> = {} as Record<Key, number>;
  for (const row of rows) {
    const key = keyFor(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function readJson<T>(artifactPath: string): T {
  return JSON.parse(readFileSync(artifactPath, "utf8")) as T;
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
