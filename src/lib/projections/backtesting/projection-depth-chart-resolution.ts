import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { DepthChartSourceReport, DepthChartSourceRow } from "@/lib/data-acquisition/depth-chart-source-types";
import { normalizeDepthChartName } from "@/lib/data-acquisition/depth-chart-source";

import type {
  ProjectionDepthChartPolicyPreview,
  ProjectionDepthChartResolutionArtifactPaths,
  ProjectionDepthChartResolutionInput,
  ProjectionDepthChartResolutionRecommendation,
  ProjectionDepthChartResolutionReport,
  ProjectionDepthChartResolutionRow,
  ProjectionDepthChartResolutionStatus,
} from "./projection-depth-chart-resolution-types";
import type { ProjectionActivePolicyRefreshFinalRow } from "./projection-active-policy-refresh-final-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const DEPTH_OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "depth-charts");
const STATUSES: ProjectionDepthChartResolutionStatus[] = [
  "depth_chart_active_confirmed",
  "depth_chart_starter_confirmed",
  "depth_chart_backup_confirmed",
  "depth_chart_reserve_or_practice_squad",
  "depth_chart_inactive_or_injured",
  "depth_chart_team_conflict",
  "depth_chart_position_conflict",
  "depth_chart_review_candidate",
  "depth_chart_unmatched",
  "depth_chart_source_missing",
];
const POLICIES: ProjectionDepthChartPolicyPreview[] = [
  "final_policy_active_candidate_preview",
  "final_policy_shadow_only",
  "final_policy_current_path_only",
  "final_policy_manual_review",
  "final_policy_source_expansion_required",
];

export function runProjectionDepthChartResolution(options: { projectionSeason: number; includeIdp: boolean }): ProjectionDepthChartResolutionReport {
  const sourceArtifacts = {
    activePolicyRefreshFinal: path.join(OUTPUT_DIR, `projection-active-policy-refresh-final-${options.projectionSeason}.json`),
    depthChartSource: path.join(DEPTH_OUTPUT_DIR, `depth-chart-${options.projectionSeason}.normalized.json`),
  };
  return buildProjectionDepthChartResolutionFromData({
    options,
    activePolicyRefreshFinal: readIfExists(sourceArtifacts.activePolicyRefreshFinal),
    depthChartSource: readIfExists(sourceArtifacts.depthChartSource),
    sourceArtifacts,
  });
}

export function buildProjectionDepthChartResolutionFromData(input: ProjectionDepthChartResolutionInput): ProjectionDepthChartResolutionReport {
  if (!input.activePolicyRefreshFinal) return sourceMissingReport(input);
  const targetRows = input.activePolicyRefreshFinal.rows.filter((row) => row.finalPolicyClass === "final_policy_source_expansion_required");
  const rows = targetRows.map((row) => resolutionRow(row, input.depthChartSource));
  const zeroChecks = input.activePolicyRefreshFinal.v82ControlledFlagImpact.protectedZeroChecks;
  const safetyGates = buildSafetyGates(rows, zeroChecks);
  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? { activePolicyRefreshFinal: "in-memory", depthChartSource: input.depthChartSource ? "in-memory" : "missing" },
    sourceMissing: !input.depthChartSource,
    summary: buildSummary(rows, input.depthChartSource),
    policyImpactPreview: buildPolicyImpact(input.activePolicyRefreshFinal.policyCounts.h30FinalPolicyCounts, rows),
    v82ControlledFlagImpact: buildV82Impact(rows, zeroChecks),
    examples: {
      topActiveStarterBackupConfirmations: topRows(rows.filter((row) => row.policyPreview === "final_policy_active_candidate_preview"), 50),
      topReservePracticeSquadRows: topRows(rows.filter((row) => row.resolutionStatus === "depth_chart_reserve_or_practice_squad"), 50),
      topConflicts: topRows(rows.filter((row) => row.resolutionStatus === "depth_chart_team_conflict" || row.resolutionStatus === "depth_chart_position_conflict"), 50),
      topStillUnmatchedRows: topRows(rows.filter((row) => row.resolutionStatus === "depth_chart_unmatched" || row.resolutionStatus === "depth_chart_source_missing"), 50),
      topV82SafeRowsNewlyAllowed: topRows(rows.filter((row) => row.v82SafeSubset && row.policyPreview === "final_policy_active_candidate_preview"), 50),
    },
    rows,
    safetyGates,
    recommendation: recommendationFor(rows, safetyGates, input.depthChartSource),
    notes: [
      "H31 is dry-run/read-only and writes only local artifacts.",
      "Exact ID joins can confirm; normalized name + team + compatible position is review-candidate only.",
      "Unmatched depth-chart target rows remain source-expansion-required.",
      "No live projection, rank, suggestion, War Room scoring, Supabase, or v8.2 behavior is changed.",
    ],
  };
}

export function writeProjectionDepthChartResolutionArtifacts(report: ProjectionDepthChartResolutionReport): ProjectionDepthChartResolutionArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-depth-chart-resolution-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function resolutionRow(row: ProjectionActivePolicyRefreshFinalRow, source: DepthChartSourceReport | null): ProjectionDepthChartResolutionRow {
  if (!source) return buildRow(row, null, "none", "depth_chart_source_missing");
  const match = findMatch(row, source.rows);
  if (!match.sourceRow) return buildRow(row, null, "none", "depth_chart_unmatched");
  const conflictStatus = conflictFor(row, match.sourceRow);
  if (conflictStatus) return buildRow(row, match.sourceRow, match.matchedBy, conflictStatus);
  if (match.matchedBy === "name_team_position") return buildRow(row, match.sourceRow, match.matchedBy, "depth_chart_review_candidate");
  return buildRow(row, match.sourceRow, match.matchedBy, statusFor(match.sourceRow));
}

function findMatch(row: ProjectionActivePolicyRefreshFinalRow, sourceRows: DepthChartSourceRow[]) {
  const bySleeper = row.sleeperId ? sourceRows.find((source) => source.sleeperId === row.sleeperId) : null;
  if (bySleeper) return { sourceRow: bySleeper, matchedBy: "sleeper_id" as const };
  const gsis = row.h28Row?.h27Row.crosswalkGsisId ?? row.h28Row?.h27Row.h26Row.crosswalkGsisId ?? null;
  const byGsis = gsis ? sourceRows.find((source) => source.gsisId === gsis) : null;
  if (byGsis) return { sourceRow: byGsis, matchedBy: "gsis_id" as const };
  const byPlayer = sourceRows.find((source) => source.playerId === row.playerId);
  if (byPlayer) return { sourceRow: byPlayer, matchedBy: "player_id" as const };
  const normalizedName = normalizeDepthChartName(row.player);
  const byName = sourceRows.find((source) => source.normalizedName === normalizedName && source.team === row.projectionTeam && positionCompatible(row.position, source.position));
  if (byName) return { sourceRow: byName, matchedBy: "name_team_position" as const };
  return { sourceRow: null, matchedBy: "none" as const };
}

function buildRow(
  row: ProjectionActivePolicyRefreshFinalRow,
  sourceRow: DepthChartSourceRow | null,
  matchedBy: ProjectionDepthChartResolutionRow["matchedBy"],
  resolutionStatus: ProjectionDepthChartResolutionStatus,
): ProjectionDepthChartResolutionRow {
  return {
    playerId: row.playerId,
    sleeperId: row.sleeperId,
    player: row.player,
    normalizedName: normalizeDepthChartName(row.player),
    position: row.position,
    projectionTeam: row.projectionTeam,
    matchedBy,
    sourceRow,
    resolutionStatus,
    policyPreview: policyFor(resolutionStatus),
    reasonCodes: reasonCodesFor(resolutionStatus, matchedBy),
    v82SafeSubset: row.v82SafeSubset,
    importanceBucket: importanceBucketFor(row),
    projectedTotalPointDelta: row.projectedTotalPointDelta,
    estimatedOverallRankMovement: row.estimatedOverallRankMovement,
    h30Row: row,
  };
}

function statusFor(source: DepthChartSourceRow): ProjectionDepthChartResolutionStatus {
  if (source.role === "starter" || source.status === "starter") return "depth_chart_starter_confirmed";
  if (source.role === "backup" || source.role === "rotational" || source.role === "handcuff" || source.status === "backup") return "depth_chart_backup_confirmed";
  if (source.status === "active") return "depth_chart_active_confirmed";
  if (source.role === "practice_squad" || source.status === "practice_squad" || source.status === "reserve" || source.role === "depth") return "depth_chart_reserve_or_practice_squad";
  if (source.status === "inactive" || source.status === "injured") return "depth_chart_inactive_or_injured";
  return "depth_chart_review_candidate";
}

function conflictFor(row: ProjectionActivePolicyRefreshFinalRow, source: DepthChartSourceRow): ProjectionDepthChartResolutionStatus | null {
  if (row.projectionTeam && source.team && row.projectionTeam !== source.team) return "depth_chart_team_conflict";
  if (!positionCompatible(row.position, source.position)) return "depth_chart_position_conflict";
  return null;
}

function policyFor(status: ProjectionDepthChartResolutionStatus): ProjectionDepthChartPolicyPreview {
  if (status === "depth_chart_active_confirmed" || status === "depth_chart_starter_confirmed" || status === "depth_chart_backup_confirmed") return "final_policy_active_candidate_preview";
  if (status === "depth_chart_reserve_or_practice_squad") return "final_policy_shadow_only";
  if (status === "depth_chart_inactive_or_injured") return "final_policy_current_path_only";
  if (status === "depth_chart_team_conflict" || status === "depth_chart_position_conflict" || status === "depth_chart_review_candidate") return "final_policy_manual_review";
  return "final_policy_source_expansion_required";
}

function reasonCodesFor(status: ProjectionDepthChartResolutionStatus, matchedBy: ProjectionDepthChartResolutionRow["matchedBy"]) {
  const codes: string[] = [status];
  if (matchedBy !== "none") codes.push(`matched_by_${matchedBy}`);
  if (matchedBy === "name_team_position") codes.push("fallback_match_review_candidate_only");
  return codes;
}

function buildSummary(rows: ProjectionDepthChartResolutionRow[], source: DepthChartSourceReport | null): ProjectionDepthChartResolutionReport["summary"] {
  return {
    targetDepthChartSourceRows: rows.length,
    sourceRows: source?.normalizedRows ?? 0,
    matchedRows: rows.filter((row) => row.sourceRow).length,
    confirmedActiveStarterBackup: rows.filter((row) => row.policyPreview === "final_policy_active_candidate_preview").length,
    reservePracticeSquad: rows.filter((row) => row.resolutionStatus === "depth_chart_reserve_or_practice_squad").length,
    inactiveInjured: rows.filter((row) => row.resolutionStatus === "depth_chart_inactive_or_injured").length,
    teamConflicts: rows.filter((row) => row.resolutionStatus === "depth_chart_team_conflict").length,
    positionConflicts: rows.filter((row) => row.resolutionStatus === "depth_chart_position_conflict").length,
    reviewCandidates: rows.filter((row) => row.resolutionStatus === "depth_chart_review_candidate").length,
    unmatched: rows.filter((row) => row.resolutionStatus === "depth_chart_unmatched").length,
    sourceMissing: rows.filter((row) => row.resolutionStatus === "depth_chart_source_missing").length,
    byPosition: countBy(rows.map((row) => row.position)),
    byTeam: countBy(rows.map((row) => row.projectionTeam ?? "missing_team")),
    byV82SafeSubset: countBy(rows.map((row) => row.v82SafeSubset ? "v82_safe_subset" : "not_v82_safe_subset")),
    byImportanceBucket: countBy(rows.map((row) => row.importanceBucket)),
    byStatus: countByFixed(rows, STATUSES, (row) => row.resolutionStatus),
  };
}

function buildPolicyImpact(before: ProjectionDepthChartResolutionReport["policyImpactPreview"]["h30FinalPolicyCountsBeforeDepthChart"], rows: ProjectionDepthChartResolutionRow[]): ProjectionDepthChartResolutionReport["policyImpactPreview"] {
  const preview = countByFixed(rows, POLICIES, (row) => row.policyPreview);
  return {
    h30FinalPolicyCountsBeforeDepthChart: before,
    h31DepthChartPreviewCounts: preview,
    deltaActiveCandidatePreview: preview.final_policy_active_candidate_preview,
    deltaShadowOnly: preview.final_policy_shadow_only,
    deltaCurrentPathOnly: preview.final_policy_current_path_only,
    deltaManualReview: preview.final_policy_manual_review,
    deltaSourceExpansionRequired: preview.final_policy_source_expansion_required - rows.length,
  };
}

function buildV82Impact(rows: ProjectionDepthChartResolutionRow[], zeroChecks: ProjectionDepthChartResolutionReport["v82ControlledFlagImpact"]["protectedZeroChecks"]): ProjectionDepthChartResolutionReport["v82ControlledFlagImpact"] {
  const safeRows = rows.filter((row) => row.v82SafeSubset);
  return {
    v82SafeRowsResolvedByDepthChart: safeRows.filter((row) => row.policyPreview !== "final_policy_source_expansion_required").length,
    v82SafeRowsNewlyAllowed: safeRows.filter((row) => row.policyPreview === "final_policy_active_candidate_preview").length,
    v82SafeRowsStillSourceExpansionRequired: safeRows.filter((row) => row.policyPreview === "final_policy_source_expansion_required").length,
    v82SafeRowsMovedToManualReview: safeRows.filter((row) => row.policyPreview === "final_policy_manual_review").length,
    controlledFlagReviewRemainsBlocked: safeRows.some((row) => row.policyPreview !== "final_policy_active_candidate_preview") || !Object.values(zeroChecks).every(Boolean),
    protectedZeroChecks: zeroChecks,
  };
}

function buildSafetyGates(rows: ProjectionDepthChartResolutionRow[], zeroChecks: ProjectionDepthChartResolutionReport["v82ControlledFlagImpact"]["protectedZeroChecks"]) {
  const unmatchedActive = rows.filter((row) => (row.resolutionStatus === "depth_chart_unmatched" || row.resolutionStatus === "depth_chart_source_missing") && row.policyPreview === "final_policy_active_candidate_preview");
  const conflictsNotManual = rows.filter((row) => (row.resolutionStatus === "depth_chart_team_conflict" || row.resolutionStatus === "depth_chart_position_conflict") && row.policyPreview !== "final_policy_manual_review");
  return [
    gate("no_live_outputs_changed", true, "Report reads artifacts and writes only local H31 artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Blackbird Rank ordering is not imported, recalculated, or mutated."),
    gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported, recalculated, or mutated."),
    gate("war_room_scoring_unchanged", true, "War Room scoring behavior is not imported, recalculated, or mutated."),
    gate("v8_2_not_enabled", true, "v8.2 feature flag and projection selector behavior are not changed."),
    gate("depth_chart_unmatched_not_forced_active", unmatchedActive.length === 0, `${unmatchedActive.length} unmatched/source-missing rows forced active.`),
    gate("conflicts_manual_review", conflictsNotManual.length === 0, `${conflictsNotManual.length} conflicts not manual-review.`),
    gate("zero_checks_preserved", Object.values(zeroChecks).every(Boolean), "K, critical mover, meaningful rank mover, and legacy v8.2 zero checks remain zero."),
  ];
}

function recommendationFor(rows: ProjectionDepthChartResolutionRow[], safetyGates: ProjectionDepthChartResolutionReport["safetyGates"], source: DepthChartSourceReport | null): ProjectionDepthChartResolutionRecommendation {
  if (safetyGates.some((gateRow) => !gateRow.passed)) return "depth_chart_resolution_blocked";
  if (!source || source.normalizedRows === 0) return "depth_chart_resolution_needs_source_population";
  if (rows.some((row) => row.policyPreview === "final_policy_manual_review")) return "depth_chart_resolution_needs_manual_review";
  return "depth_chart_resolution_ready_for_policy_refresh";
}

function sourceMissingReport(input: ProjectionDepthChartResolutionInput): ProjectionDepthChartResolutionReport {
  const zeroChecks = { kRowsUsingV82: true, criticalMoversUsingV82: true, meaningfulRankMoversUsingV82: true, legacyRowsUsingV82: true };
  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? { activePolicyRefreshFinal: "missing", depthChartSource: "missing" },
    sourceMissing: true,
    summary: buildSummary([], null),
    policyImpactPreview: { h30FinalPolicyCountsBeforeDepthChart: {} as never, h31DepthChartPreviewCounts: countByFixed([], POLICIES, (row: ProjectionDepthChartResolutionRow) => row.policyPreview), deltaActiveCandidatePreview: 0, deltaShadowOnly: 0, deltaCurrentPathOnly: 0, deltaManualReview: 0, deltaSourceExpansionRequired: 0 },
    v82ControlledFlagImpact: { v82SafeRowsResolvedByDepthChart: 0, v82SafeRowsNewlyAllowed: 0, v82SafeRowsStillSourceExpansionRequired: 0, v82SafeRowsMovedToManualReview: 0, controlledFlagReviewRemainsBlocked: true, protectedZeroChecks: zeroChecks },
    examples: { topActiveStarterBackupConfirmations: [], topReservePracticeSquadRows: [], topConflicts: [], topStillUnmatchedRows: [], topV82SafeRowsNewlyAllowed: [] },
    rows: [],
    safetyGates: [gate("required_sources_present", false, "H30 final active policy artifact is required.")],
    recommendation: "depth_chart_resolution_blocked",
    notes: ["H31 could not run because required H30 artifact is missing."],
  };
}

function importanceBucketFor(row: ProjectionActivePolicyRefreshFinalRow): ProjectionDepthChartResolutionRow["importanceBucket"] {
  const points = Math.abs(row.projectedTotalPointDelta ?? 0);
  const rank = Math.abs(row.estimatedOverallRankMovement ?? 0);
  if (points >= 5 || rank >= 1000) return "high";
  if (points >= 1 || rank >= 500) return "moderate";
  if (row.projectedTotalPointDelta === null && row.estimatedOverallRankMovement === null) return "unknown";
  return "low";
}

function positionCompatible(a: string, b: string) {
  return a === b || (a === "DEF" && b === "DST") || (a === "DST" && b === "DEF");
}

function renderMarkdown(report: ProjectionDepthChartResolutionReport) {
  return `# Projection Depth Chart Resolution ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Recommendation: ${report.recommendation}

## Summary

\`\`\`json
${JSON.stringify(report.summary, null, 2)}
\`\`\`

## Policy Impact Preview

\`\`\`json
${JSON.stringify(report.policyImpactPreview, null, 2)}
\`\`\`

## v8.2 Controlled Flag Impact

\`\`\`json
${JSON.stringify(report.v82ControlledFlagImpact, null, 2)}
\`\`\`

## Active / Starter / Backup Confirmations

${renderRows(report.examples.topActiveStarterBackupConfirmations)}

## Reserve / Practice Squad

${renderRows(report.examples.topReservePracticeSquadRows)}

## Conflicts

${renderRows(report.examples.topConflicts)}

## Still Unmatched

${renderRows(report.examples.topStillUnmatchedRows)}

## v8.2 Safe Newly Allowed

${renderRows(report.examples.topV82SafeRowsNewlyAllowed)}

## Safety Gates

${renderGateTable(report.safetyGates)}
`;
}

function renderRows(rows: ProjectionDepthChartResolutionRow[]) {
  if (!rows.length) return "No rows.";
  return ["| Player | Pos | Team | Status | Policy | Match | Reasons |", "|---|---|---|---|---|---|---|", ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.projectionTeam ?? ""} | ${row.resolutionStatus} | ${row.policyPreview} | ${row.matchedBy} | ${row.reasonCodes.join(" ")} |`)].join("\n");
}

function renderGateTable(gates: ProjectionDepthChartResolutionReport["safetyGates"]) {
  return ["| Gate | Status | Detail |", "|---|---|---|", ...gates.map((gateRow) => `| ${gateRow.name} | ${gateRow.passed ? "PASS" : "FAIL"} | ${gateRow.detail} |`)].join("\n");
}

function renderCsv(report: ProjectionDepthChartResolutionReport) {
  const headers = ["player_id", "sleeper_id", "player", "position", "projection_team", "matched_by", "resolution_status", "policy_preview", "v82_safe_subset", "importance_bucket", "reason_codes"];
  const rows = report.rows.map((row) => [row.playerId, row.sleeperId ?? "", row.player, row.position, row.projectionTeam ?? "", row.matchedBy, row.resolutionStatus, row.policyPreview, row.v82SafeSubset, row.importanceBucket, row.reasonCodes.join("|")]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function topRows(rows: ProjectionDepthChartResolutionRow[], limit: number) {
  return [...rows].sort((a, b) => Math.abs(b.projectedTotalPointDelta ?? 0) - Math.abs(a.projectedTotalPointDelta ?? 0) || Math.abs(b.estimatedOverallRankMovement ?? 0) - Math.abs(a.estimatedOverallRankMovement ?? 0) || a.player.localeCompare(b.player)).slice(0, limit);
}

function countBy(values: string[]) {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function countByFixed<T, Key extends string>(rows: T[], keys: Key[], keyFor: (row: T) => Key) {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<Key, number>;
  for (const row of rows) counts[keyFor(row)] += 1;
  return counts;
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function readIfExists<T>(artifactPath: string): T | null {
  return existsSync(artifactPath) ? JSON.parse(readFileSync(artifactPath, "utf8")) as T : null;
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
