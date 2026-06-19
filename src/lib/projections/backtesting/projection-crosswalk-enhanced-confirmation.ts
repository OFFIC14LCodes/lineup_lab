import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { CurrentRosterSourceReport, CurrentRosterSourceRow } from "@/lib/data-acquisition/current-roster-source-types";
import type { RookieTeamConfirmationSourceReport, RookieTeamConfirmationSourceRow } from "@/lib/data-acquisition/rookie-team-confirmation-source-types";

import type { ProjectionActiveUniversePolicyClassification, ProjectionActiveUniversePolicyPacketReport } from "./projection-active-universe-policy-packet-types";
import type { ProjectionActiveUniverseGateRosterRefreshReport } from "./projection-active-universe-gate-roster-refresh-types";
import type { ProjectionCurrentRosterConfirmationReport, ProjectionCurrentRosterConfirmationRow } from "./projection-current-roster-confirmation-types";
import type { ProjectionPlayerIdCrosswalkReviewReport } from "./projection-player-id-crosswalk-review-types";
import type { ProjectionRookieNewTargetDiagnosticsReport } from "./projection-rookie-new-target-diagnostics-types";
import type { ProjectionRookieTeamConfirmationReport } from "./projection-rookie-team-confirmation-types";
import type { PreseasonProjectionSnapshot, PreseasonProjectionSnapshotRow } from "./preseason-projection-snapshot-types";
import type {
  ProjectionCrosswalkEnhancedConfirmationArtifactPaths,
  ProjectionCrosswalkEnhancedConfirmationInput,
  ProjectionCrosswalkEnhancedConfirmationReasonCode,
  ProjectionCrosswalkEnhancedConfirmationRecommendation,
  ProjectionCrosswalkEnhancedConfirmationReport,
  ProjectionCrosswalkEnhancedConfirmationRow,
  ProjectionCrosswalkEnhancedConfirmationStatus,
  ProjectionCrosswalkEnhancedTargetRow,
} from "./projection-crosswalk-enhanced-confirmation-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const CURRENT_ROSTER_OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "current-rosters");
const ROOKIE_OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "rookies");
const STATUSES: ProjectionCrosswalkEnhancedConfirmationStatus[] = [
  "crosswalk_roster_confirmed_active",
  "crosswalk_roster_confirmed_ir_pup_nfi",
  "crosswalk_roster_confirmed_non_active",
  "crosswalk_rookie_team_confirmed",
  "crosswalk_team_conflict",
  "crosswalk_source_unmatched",
  "crosswalk_manual_review",
  "crosswalk_blocked_archive",
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

export function runProjectionCrosswalkEnhancedConfirmation(options: { projectionSeason: number; includeIdp: boolean }): ProjectionCrosswalkEnhancedConfirmationReport {
  const sourceArtifacts = {
    playerIdCrosswalkReview: path.join(OUTPUT_DIR, `projection-player-id-crosswalk-review-${options.projectionSeason}.json`),
    rookieNewTargetDiagnostics: path.join(OUTPUT_DIR, `projection-rookie-new-target-diagnostics-${options.projectionSeason}.json`),
    rookieTeamConfirmation: path.join(OUTPUT_DIR, `projection-rookie-team-confirmation-${options.projectionSeason}.json`),
    currentRosterConfirmation: path.join(OUTPUT_DIR, `projection-current-roster-confirmation-${options.projectionSeason}.json`),
    currentRosterSource: path.join(CURRENT_ROSTER_OUTPUT_DIR, `current-rosters-${options.projectionSeason}.normalized.json`),
    rookieTeamConfirmationSource: path.join(ROOKIE_OUTPUT_DIR, `rookie-team-confirmation-${options.projectionSeason}.normalized.json`),
    policyPacket: path.join(OUTPUT_DIR, `projection-active-universe-policy-packet-${options.projectionSeason}.json`),
    rosterRefresh: path.join(OUTPUT_DIR, `projection-active-universe-gate-roster-refresh-${options.projectionSeason}.json`),
    preseasonProjectionSnapshot: path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`),
  };
  return buildProjectionCrosswalkEnhancedConfirmationFromData({
    options,
    playerIdCrosswalkReview: readIfExists<ProjectionPlayerIdCrosswalkReviewReport>(sourceArtifacts.playerIdCrosswalkReview),
    rookieNewTargetDiagnostics: readIfExists<ProjectionRookieNewTargetDiagnosticsReport>(sourceArtifacts.rookieNewTargetDiagnostics),
    rookieTeamConfirmation: readIfExists<ProjectionRookieTeamConfirmationReport>(sourceArtifacts.rookieTeamConfirmation),
    currentRosterConfirmation: readIfExists<ProjectionCurrentRosterConfirmationReport>(sourceArtifacts.currentRosterConfirmation),
    currentRosterSource: readIfExists<CurrentRosterSourceReport>(sourceArtifacts.currentRosterSource),
    rookieTeamConfirmationSource: readIfExists<RookieTeamConfirmationSourceReport>(sourceArtifacts.rookieTeamConfirmationSource),
    policyPacket: readIfExists<ProjectionActiveUniversePolicyPacketReport>(sourceArtifacts.policyPacket),
    rosterRefresh: readIfExists<ProjectionActiveUniverseGateRosterRefreshReport>(sourceArtifacts.rosterRefresh),
    preseasonProjectionSnapshot: readIfExists<PreseasonProjectionSnapshot>(sourceArtifacts.preseasonProjectionSnapshot),
    sourceArtifacts: {
      ...sourceArtifacts,
      currentRosterSource: existsSync(sourceArtifacts.currentRosterSource) ? sourceArtifacts.currentRosterSource : null,
      rookieTeamConfirmationSource: existsSync(sourceArtifacts.rookieTeamConfirmationSource) ? sourceArtifacts.rookieTeamConfirmationSource : null,
    },
  });
}

export function buildProjectionCrosswalkEnhancedConfirmationFromData(input: ProjectionCrosswalkEnhancedConfirmationInput): ProjectionCrosswalkEnhancedConfirmationReport {
  if (!hasRequiredSources(input)) return sourceMissingReport(input);
  const lookups = buildLookups(input);
  const rows = input.playerIdCrosswalkReview.rows.map((row) => enhancedRow(row, lookups));
  const beforeAfterSummary = {
    needsIdCrosswalkBefore: input.rookieNewTargetDiagnostics.rows.filter((row) => row.recommendedSourceStrategy === "needs_id_crosswalk").length,
    exactCrosswalkConfirmed: rows.filter((row) => row.reasonCodes.includes("exact_crosswalk_confirmed")).length,
    linkedToCurrentRosterSource: rows.filter((row) => row.linkedCurrentRosterRow).length,
    linkedToRookieTeamSource: rows.filter((row) => row.linkedRookieTeamRow).length,
    confirmedActiveAfterCrosswalk: rows.filter((row) => row.enhancedStatus === "crosswalk_roster_confirmed_active").length,
    confirmedTeamAfterCrosswalk: rows.filter((row) => row.enhancedStatus === "crosswalk_rookie_team_confirmed").length,
    teamConflictsAfterCrosswalk: rows.filter((row) => row.enhancedStatus === "crosswalk_team_conflict").length,
    stillUnmatchedAfterCrosswalk: rows.filter((row) => row.enhancedStatus === "crosswalk_source_unmatched").length,
    manualReviewAfterCrosswalk: rows.filter((row) => row.enhancedStatus === "crosswalk_manual_review").length,
  };
  const statusCounts = countByFixed(rows, STATUSES, (row) => row.enhancedStatus);
  const h21PolicyImpactPreview = {
    wouldMoveTo: countByFixed(rows, POLICY_CLASSIFICATIONS, (row) => row.policyImpactPreview),
    notes: [
      "Policy impact is preview-only and does not update H21 artifacts.",
      "Exact crosswalk + exact GSIS source links are the only confirmation path used by H25.",
    ],
  };
  const v82SafeRows = rows.filter((row) => row.v82SafeSubsetStatus === "v82_safe_subset");
  const zeroChecks = zeroChecksFor(input.rosterRefresh);
  const safetyGates = buildSafetyGates(input, rows, zeroChecks);
  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? sourceArtifactsFor(input),
    sourceMissing: false,
    beforeAfterSummary,
    statusCounts,
    h21PolicyImpactPreview,
    v82SafeSubsetImpact: {
      safeRowsResolvedByCrosswalkEnhancedConfirmation: v82SafeRows.filter((row) => row.policyImpactPreview === "policy_active_candidate" || row.policyImpactPreview === "policy_current_path_only").length,
      safeRowsStillHeldBack: v82SafeRows.filter((row) => row.policyImpactPreview === "policy_source_expansion_required" || row.policyImpactPreview === "policy_manual_review" || row.policyImpactPreview === "policy_blocked_archive").length,
      safeRowsMovedToActiveCandidatePreview: v82SafeRows.filter((row) => row.policyImpactPreview === "policy_active_candidate").length,
      protectedRowsStillProtected: protectedRowsStillProtected(input.policyPacket),
      zeroChecks,
    },
    reviewTables: {
      topRowsConfirmedActiveAfterCrosswalk: topRows(rows.filter((row) => row.enhancedStatus === "crosswalk_roster_confirmed_active"), 50),
      rowsWithTeamConflictsAfterCrosswalk: topRows(rows.filter((row) => row.enhancedStatus === "crosswalk_team_conflict"), 50),
      rowsStillUnmatchedAfterCrosswalk: topRows(rows.filter((row) => row.enhancedStatus === "crosswalk_source_unmatched"), 50),
      rowsMovedToActiveCandidatePreview: topRows(rows.filter((row) => row.policyImpactPreview === "policy_active_candidate"), 50),
      rowsMovedToManualReview: topRows(rows.filter((row) => row.policyImpactPreview === "policy_manual_review"), 50),
    },
    rows,
    safetyGates,
    recommendation: recommendationFor(safetyGates, rows),
    notes: [
      "H25 is dry-run/read-only confirmation reporting only.",
      "No fuzzy matching is used as confirmed identity.",
      "No live projections, Blackbird Rank, Draft Suggestions, War Room scoring, Supabase tables, or v8.2 behavior are changed.",
    ],
  };
}

export function writeProjectionCrosswalkEnhancedConfirmationArtifacts(report: ProjectionCrosswalkEnhancedConfirmationReport): ProjectionCrosswalkEnhancedConfirmationArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-crosswalk-enhanced-confirmation-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function hasRequiredSources(input: ProjectionCrosswalkEnhancedConfirmationInput): input is ProjectionCrosswalkEnhancedConfirmationInput & {
  playerIdCrosswalkReview: ProjectionPlayerIdCrosswalkReviewReport;
  rookieNewTargetDiagnostics: ProjectionRookieNewTargetDiagnosticsReport;
  rookieTeamConfirmation: ProjectionRookieTeamConfirmationReport;
  currentRosterConfirmation: ProjectionCurrentRosterConfirmationReport;
  policyPacket: ProjectionActiveUniversePolicyPacketReport;
  rosterRefresh: ProjectionActiveUniverseGateRosterRefreshReport;
  preseasonProjectionSnapshot: Pick<PreseasonProjectionSnapshot, "metadata" | "diagnostics" | "rows">;
} {
  return Boolean(input.playerIdCrosswalkReview && input.rookieNewTargetDiagnostics && input.rookieTeamConfirmation && input.currentRosterConfirmation && input.policyPacket && input.rosterRefresh && input.preseasonProjectionSnapshot);
}

function buildLookups(input: ProjectionCrosswalkEnhancedConfirmationInput) {
  return {
    currentRosterByGsis: mapFirst((input.currentRosterSource?.rows ?? []).filter((row) => row.gsisId).map((row) => [row.gsisId ?? "", row] as const)),
    rookieSourceByGsis: mapFirst((input.rookieTeamConfirmationSource?.rows ?? []).filter((row) => row.gsisId).map((row) => [row.gsisId ?? "", row] as const)),
    snapshotByGsis: mapFirst((input.preseasonProjectionSnapshot?.rows ?? []).filter((row) => row.gsisId).map((row) => [row.gsisId ?? "", row] as const)),
    currentConfirmationByPlayerId: mapFirst((input.currentRosterConfirmation?.rows ?? []).map((row) => [row.playerId, row] as const)),
  };
}

function enhancedRow(target: ProjectionCrosswalkEnhancedTargetRow, lookups: ReturnType<typeof buildLookups>): ProjectionCrosswalkEnhancedConfirmationRow {
  const gsisId = target.status === "crosswalk_confirmed" ? target.crosswalkGsisId : null;
  const current = gsisId ? lookups.currentRosterByGsis.get(gsisId) ?? null : null;
  const rookie = gsisId ? lookups.rookieSourceByGsis.get(gsisId) ?? null : null;
  const snapshot = gsisId ? lookups.snapshotByGsis.get(gsisId) ?? null : null;
  const existing = lookups.currentConfirmationByPlayerId.get(target.playerId) ?? null;
  const reasonCodes = reasonCodesFor(target, current, rookie, snapshot, existing);
  const enhancedStatus = statusFor(target, current, rookie, existing, reasonCodes);
  return {
    playerId: target.playerId,
    sleeperId: target.sleeperId,
    crosswalkGsisId: gsisId,
    player: target.player,
    normalizedName: target.normalizedName,
    position: target.position,
    projectionTeam: target.team,
    currentRosterTeam: current?.team ?? null,
    currentRosterStatus: current?.status ?? null,
    rookieTeam: rookie?.nflTeam ?? null,
    snapshotTeam: snapshot?.team ?? null,
    existingRosterConfirmationStatus: existing?.confirmationStatus ?? null,
    h24Status: target.status,
    enhancedStatus,
    reasonCodes,
    policyImpactPreview: policyFor(enhancedStatus),
    v82SafeSubsetStatus: target.v82SafeSubsetStatus,
    linkedCurrentRosterRow: current,
    linkedRookieTeamRow: rookie,
    linkedSnapshotRow: snapshot,
    existingRosterConfirmationRow: existing,
    projectedTotalPointDelta: target.projectedTotalPointDelta,
    estimatedOverallRankMovement: target.estimatedOverallRankMovement,
  };
}

function reasonCodesFor(
  target: ProjectionCrosswalkEnhancedTargetRow,
  current: CurrentRosterSourceRow | null,
  rookie: RookieTeamConfirmationSourceRow | null,
  snapshot: PreseasonProjectionSnapshotRow | null,
  existing: ProjectionCurrentRosterConfirmationRow | null,
): ProjectionCrosswalkEnhancedConfirmationReasonCode[] {
  const codes = new Set<ProjectionCrosswalkEnhancedConfirmationReasonCode>();
  if (target.status === "crosswalk_confirmed" && target.crosswalkGsisId) codes.add("exact_crosswalk_confirmed");
  else codes.add("crosswalk_not_confirmed");
  if (current) codes.add("linked_to_current_roster_by_gsis");
  else codes.add("roster_source_missing_after_crosswalk");
  if (rookie) codes.add("linked_to_rookie_source_by_gsis");
  else codes.add("rookie_source_missing_after_crosswalk");
  if (snapshot) codes.add("linked_to_snapshot_by_gsis");
  if (existing) codes.add("linked_to_existing_roster_confirmation");
  if (teamsConflict(target.team, current?.team ?? rookie?.nflTeam ?? null)) codes.add("team_conflicts_projection");
  else if (current?.team || rookie?.nflTeam) codes.add("team_matches_projection");
  if (current?.status === "active" || current?.status === "practice_squad") codes.add("status_active");
  else if (current?.status === "injured_reserve" || current?.status === "pup" || current?.status === "nfi") codes.add("status_ir_pup_nfi");
  else if (current) codes.add("status_non_active");
  if (target.reasonCodes.some((code) => code.includes("position_family"))) codes.add("manual_review_position_family");
  if (existing?.activeGateStatus === "legacy_archive_blocked") codes.add("blocked_archive_preserved");
  return [...codes];
}

function statusFor(
  target: ProjectionCrosswalkEnhancedTargetRow,
  current: CurrentRosterSourceRow | null,
  rookie: RookieTeamConfirmationSourceRow | null,
  existing: ProjectionCurrentRosterConfirmationRow | null,
  codes: ProjectionCrosswalkEnhancedConfirmationReasonCode[],
): ProjectionCrosswalkEnhancedConfirmationStatus {
  if (existing?.activeGateStatus === "legacy_archive_blocked") return "crosswalk_blocked_archive";
  if (target.status !== "crosswalk_confirmed" || !target.crosswalkGsisId) return "crosswalk_manual_review";
  if (codes.includes("manual_review_position_family")) return "crosswalk_manual_review";
  if (codes.includes("team_conflicts_projection")) return "crosswalk_team_conflict";
  if (current?.status === "active" || current?.status === "practice_squad") return "crosswalk_roster_confirmed_active";
  if (current?.status === "injured_reserve" || current?.status === "pup" || current?.status === "nfi") return "crosswalk_roster_confirmed_ir_pup_nfi";
  if (current) return "crosswalk_roster_confirmed_non_active";
  if (rookie) return "crosswalk_rookie_team_confirmed";
  return "crosswalk_source_unmatched";
}

function policyFor(status: ProjectionCrosswalkEnhancedConfirmationStatus): ProjectionActiveUniversePolicyClassification {
  if (status === "crosswalk_roster_confirmed_active" || status === "crosswalk_rookie_team_confirmed") return "policy_active_candidate";
  if (status === "crosswalk_roster_confirmed_ir_pup_nfi" || status === "crosswalk_roster_confirmed_non_active") return "policy_current_path_only";
  if (status === "crosswalk_team_conflict" || status === "crosswalk_manual_review") return "policy_manual_review";
  if (status === "crosswalk_blocked_archive") return "policy_blocked_archive";
  return "policy_source_expansion_required";
}

function sourceMissingReport(input: ProjectionCrosswalkEnhancedConfirmationInput): ProjectionCrosswalkEnhancedConfirmationReport {
  const zeroChecks = zeroChecksFor(input.rosterRefresh);
  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? sourceArtifactsFor(input),
    sourceMissing: true,
    beforeAfterSummary: { needsIdCrosswalkBefore: 0, exactCrosswalkConfirmed: 0, linkedToCurrentRosterSource: 0, linkedToRookieTeamSource: 0, confirmedActiveAfterCrosswalk: 0, confirmedTeamAfterCrosswalk: 0, teamConflictsAfterCrosswalk: 0, stillUnmatchedAfterCrosswalk: 0, manualReviewAfterCrosswalk: 0 },
    statusCounts: Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<ProjectionCrosswalkEnhancedConfirmationStatus, number>,
    h21PolicyImpactPreview: { wouldMoveTo: Object.fromEntries(POLICY_CLASSIFICATIONS.map((classification) => [classification, 0])) as Record<ProjectionActiveUniversePolicyClassification, number>, notes: ["Required H25 source artifact is missing."] },
    v82SafeSubsetImpact: { safeRowsResolvedByCrosswalkEnhancedConfirmation: 0, safeRowsStillHeldBack: 0, safeRowsMovedToActiveCandidatePreview: 0, protectedRowsStillProtected: 0, zeroChecks },
    reviewTables: { topRowsConfirmedActiveAfterCrosswalk: [], rowsWithTeamConflictsAfterCrosswalk: [], rowsStillUnmatchedAfterCrosswalk: [], rowsMovedToActiveCandidatePreview: [], rowsMovedToManualReview: [] },
    rows: [],
    safetyGates: [gate("required_sources_present", false, "One or more required H25 source artifacts are missing.")],
    recommendation: "crosswalk_enhanced_confirmation_blocked",
    notes: ["H25 did not mutate live outputs."],
  };
}

function buildSafetyGates(input: ProjectionCrosswalkEnhancedConfirmationInput, rows: ProjectionCrosswalkEnhancedConfirmationRow[], zeroChecks: ProjectionCrosswalkEnhancedConfirmationReport["v82SafeSubsetImpact"]["zeroChecks"]) {
  return [
    gate("required_sources_present", hasRequiredSources(input), "All required H25 source artifacts were loaded."),
    gate("no_live_outputs_changed", true, "Report reads artifacts and writes only local H25 artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Blackbird Rank ordering is not imported, recalculated, or mutated."),
    gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported, recalculated, or mutated."),
    gate("war_room_scoring_unchanged", true, "War Room scoring behavior is not imported, recalculated, or mutated."),
    gate("v8_2_not_enabled", true, "v8.2 feature flag and projection selector behavior are not changed."),
    gate("only_exact_crosswalk_confirms", rows.every((row) => row.enhancedStatus === "crosswalk_manual_review" || row.reasonCodes.includes("exact_crosswalk_confirmed")), "Confirmed statuses require exact H24 crosswalk evidence."),
    gate("protected_zero_checks_preserved", Object.values(zeroChecks).every(Boolean), "K, critical mover, meaningful rank mover, and legacy v8.2 zero checks remain zero."),
  ];
}

function recommendationFor(safetyGates: ProjectionCrosswalkEnhancedConfirmationReport["safetyGates"], rows: ProjectionCrosswalkEnhancedConfirmationRow[]): ProjectionCrosswalkEnhancedConfirmationRecommendation {
  if (safetyGates.some((gateRow) => !gateRow.passed)) return "crosswalk_enhanced_confirmation_blocked";
  if (rows.some((row) => row.enhancedStatus === "crosswalk_team_conflict" || row.enhancedStatus === "crosswalk_manual_review")) return "crosswalk_enhanced_confirmation_needs_review";
  return "crosswalk_enhanced_confirmation_ready_for_policy_refresh";
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

function protectedRowsStillProtected(policyPacket: ProjectionActiveUniversePolicyPacketReport | null) {
  const protectedChecks = policyPacket?.v82ConservativePolicyImpact.protectedZeroChecks;
  return protectedChecks ? Object.values(protectedChecks).filter(Boolean).length : 0;
}

function sourceArtifactsFor(input: ProjectionCrosswalkEnhancedConfirmationInput): ProjectionCrosswalkEnhancedConfirmationReport["sourceArtifacts"] {
  return {
    playerIdCrosswalkReview: input.playerIdCrosswalkReview ? "in-memory" : "missing",
    rookieNewTargetDiagnostics: input.rookieNewTargetDiagnostics ? "in-memory" : "missing",
    rookieTeamConfirmation: input.rookieTeamConfirmation ? "in-memory" : "missing",
    currentRosterConfirmation: input.currentRosterConfirmation ? "in-memory" : "missing",
    currentRosterSource: input.currentRosterSource ? "in-memory" : null,
    rookieTeamConfirmationSource: input.rookieTeamConfirmationSource ? "in-memory" : null,
    policyPacket: input.policyPacket ? "in-memory" : "missing",
    rosterRefresh: input.rosterRefresh ? "in-memory" : "missing",
    preseasonProjectionSnapshot: input.preseasonProjectionSnapshot ? "in-memory" : "missing",
  };
}

function renderMarkdown(report: ProjectionCrosswalkEnhancedConfirmationReport) {
  return `# Projection Crosswalk-Enhanced Confirmation ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Recommendation: ${report.recommendation}

## Before / After

\`\`\`json
${JSON.stringify(report.beforeAfterSummary, null, 2)}
\`\`\`

## H21 Policy Impact Preview

\`\`\`json
${JSON.stringify(report.h21PolicyImpactPreview, null, 2)}
\`\`\`

## v8.2 Safe Subset Impact

\`\`\`json
${JSON.stringify(report.v82SafeSubsetImpact, null, 2)}
\`\`\`

## Confirmed Active

${renderRows(report.reviewTables.topRowsConfirmedActiveAfterCrosswalk)}

## Team Conflicts

${renderRows(report.reviewTables.rowsWithTeamConflictsAfterCrosswalk)}

## Still Unmatched

${renderRows(report.reviewTables.rowsStillUnmatchedAfterCrosswalk)}

## Safety Gates

${renderGateTable(report.safetyGates)}
`;
}

function renderRows(rows: ProjectionCrosswalkEnhancedConfirmationRow[]) {
  if (!rows.length) return "No rows.";
  return [
    "| Player | Pos | Projection Team | GSIS | Status | Policy Preview | Reasons |",
    "|---|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.projectionTeam ?? ""} | ${row.crosswalkGsisId ?? ""} | ${row.enhancedStatus} | ${row.policyImpactPreview} | ${row.reasonCodes.slice(0, 4).join(" ")} |`),
  ].join("\n");
}

function renderGateTable(gates: ProjectionCrosswalkEnhancedConfirmationReport["safetyGates"]) {
  return [
    "| Gate | Status | Detail |",
    "|---|---|---|",
    ...gates.map((gateRow) => `| ${gateRow.name} | ${gateRow.passed ? "PASS" : "FAIL"} | ${gateRow.detail} |`),
  ].join("\n");
}

function renderCsv(report: ProjectionCrosswalkEnhancedConfirmationReport) {
  const headers = ["player_id", "sleeper_id", "crosswalk_gsis_id", "player", "position", "projection_team", "current_roster_team", "current_roster_status", "rookie_team", "enhanced_status", "policy_impact_preview", "v82_safe_subset_status", "reason_codes"];
  const rows = report.rows.map((row) => [
    row.playerId,
    row.sleeperId ?? "",
    row.crosswalkGsisId ?? "",
    row.player,
    row.position,
    row.projectionTeam ?? "",
    row.currentRosterTeam ?? "",
    row.currentRosterStatus ?? "",
    row.rookieTeam ?? "",
    row.enhancedStatus,
    row.policyImpactPreview,
    row.v82SafeSubsetStatus,
    row.reasonCodes.join("|"),
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function teamsConflict(projectionTeam: string | null, sourceTeam: string | null) {
  return Boolean(projectionTeam && sourceTeam && sourceTeam !== "FA" && projectionTeam !== sourceTeam);
}

function topRows(rows: ProjectionCrosswalkEnhancedConfirmationRow[], limit: number) {
  return [...rows].sort((a, b) =>
    Math.abs(b.projectedTotalPointDelta ?? 0) - Math.abs(a.projectedTotalPointDelta ?? 0)
    || Math.abs(b.estimatedOverallRankMovement ?? 0) - Math.abs(a.estimatedOverallRankMovement ?? 0)
    || a.player.localeCompare(b.player)
  ).slice(0, limit);
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
