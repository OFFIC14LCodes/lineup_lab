import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ProjectionActiveUniverseGateReport, ProjectionActiveUniverseGateRow, ProjectionActiveUniverseGateStatus, ProjectionActiveUniverseGateV82Path } from "./projection-active-universe-gate-types";
import type { ProjectionCurrentRosterConfirmationReport, ProjectionCurrentRosterConfirmationRow } from "./projection-current-roster-confirmation-types";
import type {
  ProjectionActiveUniverseGateRosterRefreshArtifactPaths,
  ProjectionActiveUniverseGateRosterRefreshInput,
  ProjectionActiveUniverseGateRosterRefreshOptions,
  ProjectionActiveUniverseGateRosterRefreshRecommendation,
  ProjectionActiveUniverseGateRosterRefreshReport,
  ProjectionActiveUniverseGateRosterRefreshRow,
  ProjectionActiveUniverseGateRosterRefreshStatus,
} from "./projection-active-universe-gate-roster-refresh-types";
import type { ProjectionCurrentRosterConfirmationDeltaReport } from "./projection-current-roster-confirmation-delta-types";
import type { ProjectionV82FeatureFlagReviewPacketReport } from "./projection-v8-2-feature-flag-review-packet-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const ORIGINAL_STATUSES: ProjectionActiveUniverseGateStatus[] = [
  "active_confirmed",
  "rookie_or_new_confirmed",
  "free_agent_plausible",
  "low_confidence_plausible",
  "stale_status_review",
  "legacy_archive_blocked",
  "kicker_policy_review",
  "manual_review_required",
];
const REFRESHED_STATUSES: ProjectionActiveUniverseGateRosterRefreshStatus[] = [
  "roster_confirmed_active",
  "roster_confirmed_ir_pup_nfi",
  "roster_confirmed_non_active",
  "roster_unmatched_review",
  "rookie_or_new_unmatched_review",
  "legacy_archive_blocked",
  "kicker_policy_review",
  "manual_review_required",
];
const V82_PATHS: ProjectionActiveUniverseGateV82Path[] = ["would_use_v8_2_safe_subset", "would_stay_current_path", "excluded_or_blocked"];

export function runProjectionActiveUniverseGateRosterRefresh(options: ProjectionActiveUniverseGateRosterRefreshOptions): ProjectionActiveUniverseGateRosterRefreshReport {
  const sourceArtifacts = {
    preseasonProjectionSnapshot: path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`),
    activeUniverseGate: path.join(OUTPUT_DIR, `projection-active-universe-gate-${options.projectionSeason}.json`),
    currentRosterConfirmation: path.join(OUTPUT_DIR, `projection-current-roster-confirmation-${options.projectionSeason}.json`),
    currentRosterConfirmationDelta: path.join(OUTPUT_DIR, `projection-current-roster-confirmation-delta-${options.projectionSeason}.json`),
    universeHygieneSummary: path.join(OUTPUT_DIR, `projection-universe-hygiene-summary-${options.projectionSeason}.json`),
    promotionCandidatePool: path.join(OUTPUT_DIR, `projection-promotion-candidate-pool-${options.projectionSeason}.json`),
    featureFlagReviewPacket: path.join(OUTPUT_DIR, `projection-v8-2-feature-flag-review-packet-${options.projectionSeason}.json`),
  };
  for (const artifactPath of Object.values(sourceArtifacts)) {
    if (!existsSync(artifactPath)) throw new Error(`Missing ${path.relative(process.cwd(), artifactPath)}.`);
  }

  return buildProjectionActiveUniverseGateRosterRefreshFromData({
    options,
    activeUniverseGate: readJson<ProjectionActiveUniverseGateReport>(sourceArtifacts.activeUniverseGate),
    currentRosterConfirmation: readJson<ProjectionCurrentRosterConfirmationReport>(sourceArtifacts.currentRosterConfirmation),
    currentRosterConfirmationDelta: readJson<ProjectionCurrentRosterConfirmationDeltaReport>(sourceArtifacts.currentRosterConfirmationDelta),
    featureFlagReviewPacket: readJson<ProjectionV82FeatureFlagReviewPacketReport>(sourceArtifacts.featureFlagReviewPacket),
    sourceArtifacts,
  });
}

export function buildProjectionActiveUniverseGateRosterRefreshFromData(input: ProjectionActiveUniverseGateRosterRefreshInput): ProjectionActiveUniverseGateRosterRefreshReport {
  const activeGateById = new Map(input.activeUniverseGate.rows.map((row) => [row.playerId, row]));
  const rows = input.currentRosterConfirmation.rows.map((confirmationRow) => refreshRow(confirmationRow, activeGateById.get(confirmationRow.playerId)));
  const unmatchedRows = rows.filter((row) => row.confirmationStatus === "roster_unmatched" || row.confirmationStatus === "roster_source_missing");
  const conflicts = rows.filter((row) => row.confirmationStatus === "roster_conflict");
  const manualReviewResolvedRows = rows.filter((row) => row.originalGateStatus === "manual_review_required" && isRosterResolved(row));
  const staleReviewResolvedRows = rows.filter((row) => row.originalGateStatus === "stale_status_review" && isRosterResolved(row));
  const lowConfidenceResolvedRows = rows.filter((row) => row.originalGateStatus === "low_confidence_plausible" && isRosterResolved(row));
  const legacyArchiveChanged = rows.filter((row) => row.originalGateStatus === "legacy_archive_blocked" && row.refreshedGateStatus !== "legacy_archive_blocked").length;
  const kickerPolicyChanged = rows.filter((row) => row.originalGateStatus === "kicker_policy_review" && row.refreshedGateStatus !== "kicker_policy_review").length;
  const beforeAfterStatusCounts = {
    totalRows: rows.length,
    originalH16StatusCounts: countOriginalStatuses(rows),
    refreshedStatusCounts: countRefreshedStatuses(rows),
    transitionCounts: countTransitions(rows),
  };
  const v82SafeSubsetCrossReference = {
    byRefreshedStatus: countV82ByRefreshedStatus(rows),
    packetSummary: {
      enabledSafeSubsetV82Rows: input.featureFlagReviewPacket.safetySummary.enabledSafeSubsetV82Rows,
      currentPathProtectedRows: input.featureFlagReviewPacket.safetySummary.currentPathProtectedRows,
      excludedRows: input.featureFlagReviewPacket.safetySummary.excludedRows,
      blockedRows: input.featureFlagReviewPacket.safetySummary.blockedRows,
      kRowsUsingV82: input.featureFlagReviewPacket.safetySummary.kRowsUsingV82,
      criticalMoversUsingV82: input.featureFlagReviewPacket.safetySummary.criticalMoversUsingV82,
      meaningfulRankMoversUsingV82: input.featureFlagReviewPacket.safetySummary.meaningfulRankMoversUsingV82,
      legacyRowsUsingV82: input.featureFlagReviewPacket.safetySummary.legacyRowsUsingV82,
    },
    rowsThatWouldUseV82UnderEnabledSafeFlag: rows.filter((row) => row.v82Path === "would_use_v8_2_safe_subset").length,
    rowsThatStayCurrentPath: rows.filter((row) => row.v82Path === "would_stay_current_path").length,
    rowsExcludedOrBlocked: rows.filter((row) => row.v82Path === "excluded_or_blocked").length,
    rowsBlocked: rows.filter((row) => row.refreshedGateStatus === "legacy_archive_blocked").length,
    preservedZeroChecks: {
      kRowsUsingV82: input.featureFlagReviewPacket.safetySummary.kRowsUsingV82 === 0,
      criticalMoversUsingV82: input.featureFlagReviewPacket.safetySummary.criticalMoversUsingV82 === 0,
      meaningfulRankMoversUsingV82: input.featureFlagReviewPacket.safetySummary.meaningfulRankMoversUsingV82 === 0,
      legacyRowsUsingV82: input.featureFlagReviewPacket.safetySummary.legacyRowsUsingV82 === 0,
    },
  };
  const matchedSummary = {
    matchedRows: input.currentRosterConfirmation.summary.matchedRows,
    unmatchedRows: input.currentRosterConfirmation.summary.unmatchedRows,
    conflicts: input.currentRosterConfirmation.summary.conflicts,
    confirmedActive: input.currentRosterConfirmation.summary.confirmedActive,
    confirmedNonActive: input.currentRosterConfirmation.summary.confirmedNonActive + input.currentRosterConfirmation.summary.confirmedFreeAgent,
    confirmedIrPupNfi: input.currentRosterConfirmation.summary.confirmedIrPupNfi,
  };
  const statusChangeSummary = {
    activeConfirmedIncrease: input.currentRosterConfirmationDelta.after.activeConfirmedIncrease,
    activeConfirmedDecrease: input.currentRosterConfirmationDelta.after.activeConfirmedDecrease,
    staleStatusReviewResolved: staleReviewResolvedRows.length,
    manualReviewResolved: manualReviewResolvedRows.length,
    lowConfidenceResolved: lowConfidenceResolvedRows.length,
    legacyArchiveChanged,
    kickerPolicyChanged,
    kickerPolicyUnchanged: rows.filter((row) => row.originalGateStatus === "kicker_policy_review" && row.refreshedGateStatus === "kicker_policy_review").length,
  };
  const unmatchedSummary = {
    totalRows: unmatchedRows.length,
    byOriginalH16GateStatus: countBy(unmatchedRows, (row) => row.originalGateStatus),
    byPosition: countBy(unmatchedRows, (row) => row.position || "unknown_position"),
    byTeam: countBy(unmatchedRows, (row) => row.projectionTeam ?? "missing_team"),
    byStaleLegacyStatus: countBy(unmatchedRows, staleLegacyBucket),
    byPromotionClassification: countBy(unmatchedRows, (row) => row.promotionEligibilityClassification),
    topUnmatchedActiveCandidateRows: topRows(unmatchedRows.filter((row) => row.originalGateStatus === "active_confirmed" || row.originalGateStatus === "rookie_or_new_confirmed")),
    topUnmatchedLowConfidenceRows: topRows(unmatchedRows.filter((row) => row.originalGateStatus === "low_confidence_plausible")),
    topUnmatchedStaleRows: topRows(unmatchedRows.filter((row) => row.originalGateStatus === "stale_status_review")),
  };
  const safetyGates = buildSafetyGates(input, rows, conflicts, manualReviewResolvedRows, staleReviewResolvedRows, v82SafeSubsetCrossReference.preservedZeroChecks);
  const recommendation = recommendationFor(safetyGates, unmatchedRows, conflicts);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? {
      preseasonProjectionSnapshot: "in-memory",
      activeUniverseGate: "in-memory",
      currentRosterConfirmation: "in-memory",
      currentRosterConfirmationDelta: "in-memory",
      universeHygieneSummary: "in-memory",
      promotionCandidatePool: "in-memory",
      featureFlagReviewPacket: "in-memory",
    },
    beforeAfterStatusCounts,
    statusChangeSummary,
    matchedSummary,
    unmatchedSummary,
    conflicts,
    manualReviewResolvedRows: topRows(manualReviewResolvedRows, 100),
    staleReviewResolvedRows: topRows(staleReviewResolvedRows, 100),
    v82SafeSubsetCrossReference,
    rows,
    safetyGates,
    recommendation,
    notes: [
      "H19 is a dry-run/read-only roster-confirmed active-universe gate refresh.",
      "Roster evidence is applied only to local reporting artifacts; production outputs are not filtered or changed.",
      "K rows remain in kicker policy review until a kicker policy is implemented.",
      "Unmatched rows remain review/shadow unless already legacy/archive protected.",
      "No live projections, Blackbird Rank ordering, Draft Suggestion ordering, War Room scoring behavior, Supabase writes, or v8.2 enablement are changed.",
    ],
  };
}

export function writeProjectionActiveUniverseGateRosterRefreshArtifacts(report: ProjectionActiveUniverseGateRosterRefreshReport): ProjectionActiveUniverseGateRosterRefreshArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-active-universe-gate-roster-refresh-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function refreshRow(
  confirmationRow: ProjectionCurrentRosterConfirmationRow,
  activeGateRow: ProjectionActiveUniverseGateRow | undefined,
): ProjectionActiveUniverseGateRosterRefreshRow {
  const refreshedGateStatus = refreshedStatusFor(confirmationRow);
  return {
    playerId: confirmationRow.playerId,
    player: confirmationRow.player,
    position: confirmationRow.position,
    projectionTeam: confirmationRow.projectionTeam,
    rosterTeam: confirmationRow.rosterTeam,
    rosterStatus: confirmationRow.rosterStatus,
    originalGateStatus: confirmationRow.activeGateStatus,
    refreshedGateStatus,
    confirmationStatus: confirmationRow.confirmationStatus,
    promotionEligibilityClassification: confirmationRow.promotionEligibilityClassification,
    v82Path: activeGateRow?.v82Path ?? "excluded_or_blocked",
    reasonCodes: confirmationRow.reasonCodes,
    refreshReasonCodes: refreshReasonCodesFor(confirmationRow, refreshedGateStatus),
    recommendedAction: recommendedActionFor(confirmationRow, refreshedGateStatus),
    lastActiveSeason: activeGateRow?.lastActiveSeason ?? null,
    projectedTotalPointDelta: activeGateRow?.projectedTotalPointDelta ?? null,
    criticalMovement: activeGateRow?.criticalMovement ?? false,
    estimatedOverallRankMovement: activeGateRow?.estimatedOverallRankMovement ?? null,
    matchConfidence: activeGateRow?.matchConfidence ?? "unknown",
  };
}

function refreshedStatusFor(row: ProjectionCurrentRosterConfirmationRow): ProjectionActiveUniverseGateRosterRefreshStatus {
  if (row.activeGateStatus === "kicker_policy_review" || row.position === "K") return "kicker_policy_review";
  if (row.activeGateStatus === "legacy_archive_blocked") return "legacy_archive_blocked";
  if (row.confirmationStatus === "roster_conflict") return "manual_review_required";
  if (row.confirmationStatus === "roster_confirmed_active") return "roster_confirmed_active";
  if (row.confirmationStatus === "roster_confirmed_ir_pup_nfi") return "roster_confirmed_ir_pup_nfi";
  if (row.confirmationStatus === "roster_confirmed_non_active" || row.confirmationStatus === "roster_confirmed_free_agent") return "roster_confirmed_non_active";
  if (row.activeGateStatus === "manual_review_required") return "manual_review_required";
  if (row.activeGateStatus === "rookie_or_new_confirmed") return "rookie_or_new_unmatched_review";
  return "roster_unmatched_review";
}

function refreshReasonCodesFor(row: ProjectionCurrentRosterConfirmationRow, status: ProjectionActiveUniverseGateRosterRefreshStatus) {
  const codes = new Set<string>();
  if (row.activeGateStatus === "kicker_policy_review" || row.position === "K") codes.add("kicker_policy_preserved");
  if (row.activeGateStatus === "legacy_archive_blocked") codes.add("legacy_archive_protection_preserved");
  if (row.confirmationStatus === "roster_conflict") codes.add("team_conflict_requires_manual_review");
  if (row.confirmationStatus === "roster_confirmed_active") codes.add("current_roster_active_confirmation");
  if (row.confirmationStatus === "roster_confirmed_ir_pup_nfi") codes.add("current_roster_ir_pup_nfi_confirmation");
  if (row.confirmationStatus === "roster_confirmed_non_active" || row.confirmationStatus === "roster_confirmed_free_agent") codes.add("current_roster_non_active_confirmation");
  if (row.confirmationStatus === "roster_unmatched" || row.confirmationStatus === "roster_source_missing") codes.add("current_roster_unmatched");
  if (status === "rookie_or_new_unmatched_review") codes.add("rookie_or_new_unmatched_review");
  return [...codes];
}

function recommendedActionFor(row: ProjectionCurrentRosterConfirmationRow, status: ProjectionActiveUniverseGateRosterRefreshStatus) {
  if (status === "roster_confirmed_active") return "increase_active_universe_confidence_in_policy_review";
  if (status === "roster_confirmed_ir_pup_nfi") return "keep_review_shadow_until_injury_policy_decision";
  if (status === "roster_confirmed_non_active") return "review_for_block_or_non_active_policy";
  if (status === "legacy_archive_blocked") return "keep_legacy_archive_blocked";
  if (status === "kicker_policy_review") return "keep_kicker_policy_review";
  if (status === "manual_review_required" && row.confirmationStatus === "roster_conflict") return "manual_review_team_conflict";
  if (status === "manual_review_required") return "manual_review_still_required";
  if (status === "rookie_or_new_unmatched_review") return "review_rookie_or_new_source_coverage";
  return "keep_shadow_review_until_more_source_data";
}

function buildSafetyGates(
  input: ProjectionActiveUniverseGateRosterRefreshInput,
  rows: ProjectionActiveUniverseGateRosterRefreshRow[],
  conflicts: ProjectionActiveUniverseGateRosterRefreshRow[],
  manualReviewResolvedRows: ProjectionActiveUniverseGateRosterRefreshRow[],
  staleReviewResolvedRows: ProjectionActiveUniverseGateRosterRefreshRow[],
  zeroChecks: Record<string, boolean>,
) {
  const unmatchedRows = rows.filter((row) => row.confirmationStatus === "roster_unmatched" || row.confirmationStatus === "roster_source_missing");
  return [
    gate("no_live_outputs_changed", true, "Report reads artifacts and writes only local H19 artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Blackbird Rank ordering is not imported, recalculated, or mutated."),
    gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported, recalculated, or mutated."),
    gate("war_room_scoring_unchanged", true, "War Room scoring behavior is not imported, recalculated, or mutated."),
    gate("v8_2_not_enabled", true, "v8.2 feature flag and projection selector behavior are not changed."),
    gate("roster_source_consumed", input.currentRosterConfirmation.sourceStatus === "present" && input.currentRosterConfirmation.summary.rosterSourceRows > 0, `${input.currentRosterConfirmation.summary.rosterSourceRows} roster source rows reported.`),
    gate("conflicts_reported", conflicts.length === input.currentRosterConfirmation.summary.conflicts, `${conflicts.length} conflicts reported.`),
    gate("unmatched_rows_reported", unmatchedRows.length === input.currentRosterConfirmation.summary.unmatchedRows, `${unmatchedRows.length} unmatched rows reported.`),
    gate("manual_review_resolution_reported", manualReviewResolvedRows.length === input.currentRosterConfirmation.h16IntegrationPreview.manualReviewRequiredResolved, `${manualReviewResolvedRows.length} manual-review rows resolved.`),
    gate("stale_resolution_reported", staleReviewResolvedRows.length === input.currentRosterConfirmation.h16IntegrationPreview.staleStatusReviewResolved, `${staleReviewResolvedRows.length} stale-review rows resolved.`),
    gate("kicker_policy_not_changed", rows.every((row) => row.position !== "K" || row.refreshedGateStatus === "kicker_policy_review"), "All K rows remain kicker_policy_review."),
    gate("v8_2_zero_checks_preserved", Object.values(zeroChecks).every(Boolean), JSON.stringify(zeroChecks)),
  ];
}

function recommendationFor(
  safetyGates: ProjectionActiveUniverseGateRosterRefreshReport["safetyGates"],
  unmatchedRows: ProjectionActiveUniverseGateRosterRefreshRow[],
  conflicts: ProjectionActiveUniverseGateRosterRefreshRow[],
): ProjectionActiveUniverseGateRosterRefreshRecommendation {
  if (safetyGates.some((gateRow) => !gateRow.passed)) return "roster_refresh_blocked";
  if (unmatchedRows.length > 0 || conflicts.length > 0) return "roster_refresh_ready_for_policy_review";
  return "roster_refresh_ready_for_policy_review";
}

function isRosterResolved(row: ProjectionActiveUniverseGateRosterRefreshRow) {
  return row.confirmationStatus !== "roster_unmatched" && row.confirmationStatus !== "roster_source_missing";
}

function staleLegacyBucket(row: ProjectionActiveUniverseGateRosterRefreshRow) {
  if (row.originalGateStatus === "legacy_archive_blocked") return "legacy_archive";
  if (row.originalGateStatus === "stale_status_review") return "stale_status_review";
  return "not_stale_or_legacy";
}

function renderMarkdown(report: ProjectionActiveUniverseGateRosterRefreshReport) {
  return `# Projection Active Universe Gate Roster Refresh ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Recommendation: ${report.recommendation}

## Before / After Status Counts

\`\`\`json
${JSON.stringify(report.beforeAfterStatusCounts, null, 2)}
\`\`\`

## Status Change Summary

\`\`\`json
${JSON.stringify(report.statusChangeSummary, null, 2)}
\`\`\`

## Matched / Unmatched / Conflicts

\`\`\`json
${JSON.stringify(report.matchedSummary, null, 2)}
\`\`\`

## Unmatched Summary

\`\`\`json
${JSON.stringify({
    totalRows: report.unmatchedSummary.totalRows,
    byOriginalH16GateStatus: report.unmatchedSummary.byOriginalH16GateStatus,
    byPosition: report.unmatchedSummary.byPosition,
    byTeam: report.unmatchedSummary.byTeam,
    byStaleLegacyStatus: report.unmatchedSummary.byStaleLegacyStatus,
    byPromotionClassification: report.unmatchedSummary.byPromotionClassification,
  }, null, 2)}
\`\`\`

### Top Unmatched Active Candidates

${renderRows(report.unmatchedSummary.topUnmatchedActiveCandidateRows)}

### Top Unmatched Low Confidence

${renderRows(report.unmatchedSummary.topUnmatchedLowConfidenceRows)}

### Top Unmatched Stale

${renderRows(report.unmatchedSummary.topUnmatchedStaleRows)}

## Conflicts

${renderRows(report.conflicts)}

## Manual Review Resolved

${renderRows(report.manualReviewResolvedRows)}

## Stale Review Resolved

${renderRows(report.staleReviewResolvedRows)}

## v8.2 Safe Subset Cross-Reference

\`\`\`json
${JSON.stringify(report.v82SafeSubsetCrossReference, null, 2)}
\`\`\`

## Safety Gates

${renderGateTable(report.safetyGates)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderCsv(report: ProjectionActiveUniverseGateRosterRefreshReport) {
  const headers = [
    "player_id",
    "player",
    "position",
    "projection_team",
    "roster_team",
    "roster_status",
    "original_gate_status",
    "refreshed_gate_status",
    "confirmation_status",
    "promotion_classification",
    "v82_path",
    "reason_codes",
    "refresh_reason_codes",
    "recommended_action",
  ];
  return [headers, ...report.rows.map((row) => [
    row.playerId,
    row.player,
    row.position,
    row.projectionTeam ?? "",
    row.rosterTeam ?? "",
    row.rosterStatus ?? "",
    row.originalGateStatus,
    row.refreshedGateStatus,
    row.confirmationStatus,
    row.promotionEligibilityClassification,
    row.v82Path,
    row.reasonCodes.join("|"),
    row.refreshReasonCodes.join("|"),
    row.recommendedAction,
  ])].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function renderRows(rows: ProjectionActiveUniverseGateRosterRefreshRow[]) {
  if (!rows.length) return "No rows.";
  return [
    "| Player | Pos | Projection Team | Roster Team | Roster Status | Old Gate | New Gate | Reasons | Action |",
    "|---|---|---|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.projectionTeam ?? ""} | ${row.rosterTeam ?? ""} | ${row.rosterStatus ?? ""} | ${row.originalGateStatus} | ${row.refreshedGateStatus} | ${row.reasonCodes.join(" ")} | ${row.recommendedAction} |`),
  ].join("\n");
}

function renderGateTable(gates: ProjectionActiveUniverseGateRosterRefreshReport["safetyGates"]) {
  return [
    "| Gate | Status | Detail |",
    "|---|---|---|",
    ...gates.map((gateRow) => `| ${gateRow.name} | ${gateRow.passed ? "PASS" : "FAIL"} | ${gateRow.detail} |`),
  ].join("\n");
}

function topRows(rows: ProjectionActiveUniverseGateRosterRefreshRow[], limit = 50) {
  return [...rows]
    .sort((a, b) =>
      Math.abs(b.projectedTotalPointDelta ?? 0) - Math.abs(a.projectedTotalPointDelta ?? 0)
      || (a.lastActiveSeason ?? 9999) - (b.lastActiveSeason ?? 9999)
      || a.player.localeCompare(b.player)
    )
    .slice(0, limit);
}

function countOriginalStatuses(rows: ProjectionActiveUniverseGateRosterRefreshRow[]) {
  const counts = Object.fromEntries(ORIGINAL_STATUSES.map((status) => [status, 0])) as Record<ProjectionActiveUniverseGateStatus, number>;
  for (const row of rows) counts[row.originalGateStatus] += 1;
  return counts;
}

function countRefreshedStatuses(rows: ProjectionActiveUniverseGateRosterRefreshRow[]) {
  const counts = Object.fromEntries(REFRESHED_STATUSES.map((status) => [status, 0])) as Record<ProjectionActiveUniverseGateRosterRefreshStatus, number>;
  for (const row of rows) counts[row.refreshedGateStatus] += 1;
  return counts;
}

function countTransitions(rows: ProjectionActiveUniverseGateRosterRefreshRow[]) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = `${row.originalGateStatus}->${row.refreshedGateStatus}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function countV82ByRefreshedStatus(rows: ProjectionActiveUniverseGateRosterRefreshRow[]) {
  const counts = Object.fromEntries(
    REFRESHED_STATUSES.map((status) => [
      status,
      Object.fromEntries(V82_PATHS.map((pathKey) => [pathKey, 0])) as Record<ProjectionActiveUniverseGateV82Path, number>,
    ]),
  ) as Record<ProjectionActiveUniverseGateRosterRefreshStatus, Record<ProjectionActiveUniverseGateV82Path, number>>;
  for (const row of rows) counts[row.refreshedGateStatus][row.v82Path] += 1;
  return counts;
}

function countBy<Key extends string>(rows: ProjectionActiveUniverseGateRosterRefreshRow[], keyFor: (row: ProjectionActiveUniverseGateRosterRefreshRow) => Key) {
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
