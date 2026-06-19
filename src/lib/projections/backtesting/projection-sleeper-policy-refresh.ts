import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ProjectionActiveUniversePolicyClassification } from "./projection-active-universe-policy-packet-types";
import type { ProjectionSleeperMetadataResolutionRow, ProjectionSleeperMetadataResolutionStatus } from "./projection-sleeper-metadata-resolution-types";
import type {
  ProjectionSleeperPolicyRefreshArtifactPaths,
  ProjectionSleeperPolicyRefreshClassification,
  ProjectionSleeperPolicyRefreshInput,
  ProjectionSleeperPolicyRefreshRecommendation,
  ProjectionSleeperPolicyRefreshReport,
  ProjectionSleeperPolicyRefreshRow,
  ProjectionSleeperPolicyRefreshSourceNeed,
} from "./projection-sleeper-policy-refresh-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const POLICY_CLASSIFICATIONS: ProjectionActiveUniversePolicyClassification[] = [
  "policy_active_candidate",
  "policy_shadow_only",
  "policy_blocked_archive",
  "policy_manual_review",
  "policy_source_expansion_required",
  "policy_kicker_review_required",
  "policy_current_path_only",
];
const REFRESHED_CLASSIFICATIONS: ProjectionSleeperPolicyRefreshClassification[] = [
  ...POLICY_CLASSIFICATIONS,
  "policy_active_candidate_preview",
];

export function runProjectionSleeperPolicyRefresh(options: { projectionSeason: number; includeIdp: boolean }): ProjectionSleeperPolicyRefreshReport {
  const sourceArtifacts = {
    sleeperMetadataResolution: path.join(OUTPUT_DIR, `projection-sleeper-metadata-resolution-${options.projectionSeason}.json`),
    activeUniversePolicyPacket: path.join(OUTPUT_DIR, `projection-active-universe-policy-packet-${options.projectionSeason}.json`),
    rosterRefreshPolicyReview: path.join(OUTPUT_DIR, `projection-roster-refresh-policy-review-${options.projectionSeason}.json`),
    activeUniverseGateRosterRefresh: path.join(OUTPUT_DIR, `projection-active-universe-gate-roster-refresh-${options.projectionSeason}.json`),
    featureFlagReviewPacket: path.join(OUTPUT_DIR, `projection-v8-2-feature-flag-review-packet-${options.projectionSeason}.json`),
    preseasonProjectionSnapshot: path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`),
  };

  return buildProjectionSleeperPolicyRefreshFromData({
    options,
    sleeperMetadataResolution: readIfExists(sourceArtifacts.sleeperMetadataResolution),
    activeUniversePolicyPacket: readIfExists(sourceArtifacts.activeUniversePolicyPacket),
    rosterRefreshPolicyReview: readIfExists(sourceArtifacts.rosterRefreshPolicyReview),
    activeUniverseGateRosterRefresh: readIfExists(sourceArtifacts.activeUniverseGateRosterRefresh),
    featureFlagReviewPacket: readIfExists(sourceArtifacts.featureFlagReviewPacket),
    preseasonProjectionSnapshot: readIfExists(sourceArtifacts.preseasonProjectionSnapshot),
    sourceArtifacts,
  });
}

export function buildProjectionSleeperPolicyRefreshFromData(input: ProjectionSleeperPolicyRefreshInput): ProjectionSleeperPolicyRefreshReport {
  if (!input.sleeperMetadataResolution || !input.activeUniversePolicyPacket) return sourceMissingReport(input);
  const rows = input.sleeperMetadataResolution.rows.map(refreshRow);
  const h21Before = countByFixed(rows, POLICY_CLASSIFICATIONS, (row) => row.originalPolicyClassification);
  const h28After = countByFixed(rows, REFRESHED_CLASSIFICATIONS, (row) => row.refreshedPolicyClassification);
  const summary = buildSummary(rows);
  const zeroChecks = zeroChecksFor(input);
  const safeRows = rows.filter((row) => row.v82SafeSubsetStatus === "v82_safe_subset");
  const v82SafeSubsetImpact = {
    newlyAllowedBySleeperMetadata: safeRows.filter((row) => row.refreshedPolicyClassification === "policy_active_candidate_preview").length,
    stillHeldBack: safeRows.filter((row) => row.refreshedPolicyClassification !== "policy_active_candidate_preview").length,
    heldBackByInactiveStale: safeRows.filter((row) => row.resolutionStatus === "sleeper_metadata_inactive_or_stale").length,
    heldBackByFreeAgentUnknown: safeRows.filter((row) => row.resolutionStatus === "sleeper_metadata_free_agent_or_unknown").length,
    heldBackByPositionConflict: safeRows.filter((row) => row.resolutionStatus === "sleeper_metadata_position_conflict").length,
    heldBackByMissingMetadata: safeRows.filter((row) => row.resolutionStatus === "sleeper_metadata_missing").length,
    controlledFlagReviewRemainsBlocked: safeRows.some((row) => row.refreshedPolicyClassification !== "policy_active_candidate_preview") || !Object.values(zeroChecks).every(Boolean),
    protectedZeroChecks: zeroChecks,
  };
  const sourceRecommendations = sourceRecommendationsFor(rows);
  const safetyGates = buildSafetyGates(rows, zeroChecks, input);
  const recommendation = recommendationFor(safetyGates);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? sourceArtifactsFor(input),
    sourceMissing: false,
    policyCounts: {
      h21Before,
      h28After,
      delta: deltaCounts(h21Before, h28After),
    },
    summary,
    v82SafeSubsetImpact,
    sourceRecommendations,
    examples: {
      activePlausibleRows: topRows(rows.filter((row) => row.resolutionStatus === "sleeper_metadata_active_plausible"), 100),
      topInactiveStaleRows: topRows(rows.filter((row) => row.resolutionStatus === "sleeper_metadata_inactive_or_stale"), 50),
      topFreeAgentUnknownRows: topRows(rows.filter((row) => row.resolutionStatus === "sleeper_metadata_free_agent_or_unknown"), 50),
      positionConflictRows: topRows(rows.filter((row) => row.resolutionStatus === "sleeper_metadata_position_conflict"), 100),
      topV82SafeRowsStillHeldBack: topRows(safeRows.filter((row) => row.refreshedPolicyClassification !== "policy_active_candidate_preview"), 50),
    },
    rows,
    safetyGates,
    recommendation,
    notes: [
      "H28 is a refreshed dry-run policy preview only; the original H21 artifact is not modified.",
      "Only Sleeper active-plausible rows are promoted to active-candidate preview.",
      "Inactive/stale, free-agent/unknown, missing metadata, and position-conflict rows remain held back.",
      "No live projection, rank, suggestion, War Room scoring, Supabase, or v8.2 behavior is changed.",
    ],
  };
}

export function writeProjectionSleeperPolicyRefreshArtifacts(report: ProjectionSleeperPolicyRefreshReport): ProjectionSleeperPolicyRefreshArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-sleeper-policy-refresh-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function refreshRow(row: ProjectionSleeperMetadataResolutionRow): ProjectionSleeperPolicyRefreshRow {
  const refreshedPolicyClassification = refreshedPolicyFor(row.resolutionStatus);
  const reasonCodes = reasonCodesFor(row.resolutionStatus, row.v82SafeSubsetStatus);
  const originalPolicyClassification = row.h26Row.originalPolicyClassification ?? "policy_source_expansion_required";
  return {
    playerId: row.playerId,
    sleeperId: row.sleeperId,
    player: row.player,
    position: row.position,
    projectionTeam: row.projectionTeam,
    metadataTeam: row.metadataTeam,
    metadataStatus: row.metadataStatus,
    resolutionStatus: row.resolutionStatus,
    originalPolicyClassification,
    refreshedPolicyClassification,
    policyDelta: policyDeltaFor(originalPolicyClassification, refreshedPolicyClassification),
    reasonCodes,
    v82SafeSubsetStatus: row.v82SafeSubsetStatus,
    projectedTotalPointDelta: row.projectedTotalPointDelta,
    estimatedOverallRankMovement: row.estimatedOverallRankMovement,
    h27Row: row,
  };
}

function refreshedPolicyFor(status: ProjectionSleeperMetadataResolutionStatus): ProjectionSleeperPolicyRefreshClassification {
  if (status === "sleeper_metadata_active_plausible") return "policy_active_candidate_preview";
  if (status === "sleeper_metadata_inactive_or_stale") return "policy_shadow_only";
  if (status === "sleeper_metadata_position_conflict" || status === "sleeper_metadata_team_conflict" || status === "sleeper_metadata_manual_review") return "policy_manual_review";
  return "policy_source_expansion_required";
}

function reasonCodesFor(status: ProjectionSleeperMetadataResolutionStatus, v82SafeSubsetStatus: string) {
  const reasons: ProjectionSleeperPolicyRefreshRow["reasonCodes"] = [];
  if (status === "sleeper_metadata_active_plausible") reasons.push("sleeper_active_plausible_preview_allowed");
  if (status === "sleeper_metadata_inactive_or_stale") reasons.push("sleeper_inactive_stale_held_back");
  if (status === "sleeper_metadata_free_agent_or_unknown") reasons.push("sleeper_free_agent_unknown_held_back");
  if (status === "sleeper_metadata_position_conflict") reasons.push("sleeper_position_conflict_manual_review");
  if (status === "sleeper_metadata_team_conflict") reasons.push("sleeper_team_conflict_manual_review");
  if (status === "sleeper_metadata_missing") reasons.push("sleeper_metadata_missing_source_expansion");
  if (status === "sleeper_metadata_manual_review") reasons.push("sleeper_manual_review_required");
  if (v82SafeSubsetStatus === "v82_safe_subset") reasons.push("v8_2_safe_subset_preserved");
  return reasons;
}

function policyDeltaFor(original: ProjectionActiveUniversePolicyClassification, refreshed: ProjectionSleeperPolicyRefreshClassification) {
  if (refreshed === "policy_active_candidate_preview" && original !== "policy_active_candidate") return "promoted_in_preview";
  if (refreshed === "policy_manual_review") return "manual_review";
  if (refreshed !== "policy_active_candidate_preview" && original !== refreshed) return "held_back";
  return "unchanged";
}

function buildSummary(rows: ProjectionSleeperPolicyRefreshRow[]): ProjectionSleeperPolicyRefreshReport["summary"] {
  return {
    totalSleeperRows: rows.length,
    activeCandidatesGainedFromSleeperMetadata: rows.filter((row) => row.refreshedPolicyClassification === "policy_active_candidate_preview").length,
    heldBackFromSleeperMetadata: rows.filter((row) => row.refreshedPolicyClassification !== "policy_active_candidate_preview").length,
    manualReviewPositionConflicts: rows.filter((row) => row.resolutionStatus === "sleeper_metadata_position_conflict").length,
    inactiveStaleHeldBack: rows.filter((row) => row.resolutionStatus === "sleeper_metadata_inactive_or_stale").length,
    freeAgentUnknownHeldBack: rows.filter((row) => row.resolutionStatus === "sleeper_metadata_free_agent_or_unknown").length,
    missingMetadataHeldBack: rows.filter((row) => row.resolutionStatus === "sleeper_metadata_missing").length,
    teamConflictsManualReview: rows.filter((row) => row.resolutionStatus === "sleeper_metadata_team_conflict").length,
  };
}

function sourceRecommendationsFor(rows: ProjectionSleeperPolicyRefreshRow[]) {
  return [
    recommendationSummary("free_agent_unknown_policy_review", rows.filter((row) => row.resolutionStatus === "sleeper_metadata_free_agent_or_unknown"), "Free-agent/unknown rows are the largest remaining Sleeper metadata bucket and need a policy decision or external status source."),
    recommendationSummary("transaction_status_source", rows.filter((row) => row.resolutionStatus === "sleeper_metadata_inactive_or_stale"), "Inactive/stale rows need transaction or status evidence before any active-universe consideration."),
    recommendationSummary("position_conflict_manual_review", rows.filter((row) => row.resolutionStatus === "sleeper_metadata_position_conflict"), "Position conflicts must remain manual review because they can alter roster-slot and scoring treatment."),
    recommendationSummary("depth_chart_source", rows.filter((row) => row.resolutionStatus === "sleeper_metadata_missing"), "Missing metadata rows need another source before policy promotion."),
  ].filter((summary) => summary.rowsAffected > 0)
    .sort((a, b) => b.rowsAffected - a.rowsAffected || a.sourceNeed.localeCompare(b.sourceNeed));
}

function recommendationSummary(sourceNeed: ProjectionSleeperPolicyRefreshSourceNeed, rows: ProjectionSleeperPolicyRefreshRow[], rationale: string) {
  return {
    sourceNeed,
    rowsAffected: rows.length,
    v82SafeSubsetRowsAffected: rows.filter((row) => row.v82SafeSubsetStatus === "v82_safe_subset").length,
    rationale,
  };
}

function buildSafetyGates(
  rows: ProjectionSleeperPolicyRefreshRow[],
  zeroChecks: ProjectionSleeperPolicyRefreshReport["v82SafeSubsetImpact"]["protectedZeroChecks"],
  input: ProjectionSleeperPolicyRefreshInput,
) {
  const promotedRows = rows.filter((row) => row.refreshedPolicyClassification === "policy_active_candidate_preview");
  const inactivePromoted = rows.filter((row) => row.resolutionStatus === "sleeper_metadata_inactive_or_stale" && row.refreshedPolicyClassification === "policy_active_candidate_preview");
  const freeAgentPromoted = rows.filter((row) => row.resolutionStatus === "sleeper_metadata_free_agent_or_unknown" && row.refreshedPolicyClassification === "policy_active_candidate_preview");
  const positionConflictPromoted = rows.filter((row) => row.resolutionStatus === "sleeper_metadata_position_conflict" && row.refreshedPolicyClassification === "policy_active_candidate_preview");
  const positionConflictNotManual = rows.filter((row) => row.resolutionStatus === "sleeper_metadata_position_conflict" && row.refreshedPolicyClassification !== "policy_manual_review");
  return [
    gate("required_sources_present", Boolean(input.sleeperMetadataResolution && input.activeUniversePolicyPacket), "H27 Sleeper metadata resolution and H21 policy packet are required."),
    gate("no_live_outputs_changed", true, "Report reads artifacts and writes only local H28 artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Blackbird Rank ordering is not imported, recalculated, or mutated."),
    gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported, recalculated, or mutated."),
    gate("war_room_scoring_unchanged", true, "War Room scoring behavior is not imported, recalculated, or mutated."),
    gate("v8_2_not_enabled", true, "v8.2 feature flag and projection selector behavior are not changed."),
    gate("only_active_plausible_promoted_in_preview", promotedRows.every((row) => row.resolutionStatus === "sleeper_metadata_active_plausible"), `${promotedRows.length} preview promotions checked.`),
    gate("inactive_stale_held_back", inactivePromoted.length === 0, `${inactivePromoted.length} inactive/stale rows promoted.`),
    gate("free_agent_unknown_held_back", freeAgentPromoted.length === 0, `${freeAgentPromoted.length} free-agent/unknown rows promoted.`),
    gate("position_conflicts_manual_review", positionConflictPromoted.length === 0 && positionConflictNotManual.length === 0, `${positionConflictPromoted.length} position conflicts promoted; ${positionConflictNotManual.length} not manual-review.`),
    gate("zero_checks_preserved", Object.values(zeroChecks).every(Boolean), "K, critical mover, meaningful rank mover, and legacy v8.2 zero checks remain zero."),
  ];
}

function recommendationFor(safetyGates: ProjectionSleeperPolicyRefreshReport["safetyGates"]): ProjectionSleeperPolicyRefreshRecommendation {
  if (safetyGates.some((gateRow) => !gateRow.passed)) return "sleeper_policy_refresh_blocked";
  return "sleeper_policy_refresh_ready_for_transaction_source";
}

function sourceMissingReport(input: ProjectionSleeperPolicyRefreshInput): ProjectionSleeperPolicyRefreshReport {
  const zeroChecks = zeroChecksFor(input);
  const h21Before = Object.fromEntries(POLICY_CLASSIFICATIONS.map((classification) => [classification, 0])) as Record<ProjectionActiveUniversePolicyClassification, number>;
  const h28After = Object.fromEntries(REFRESHED_CLASSIFICATIONS.map((classification) => [classification, 0])) as Record<ProjectionSleeperPolicyRefreshClassification, number>;
  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? sourceArtifactsFor(input),
    sourceMissing: true,
    policyCounts: { h21Before, h28After, delta: h28After },
    summary: { totalSleeperRows: 0, activeCandidatesGainedFromSleeperMetadata: 0, heldBackFromSleeperMetadata: 0, manualReviewPositionConflicts: 0, inactiveStaleHeldBack: 0, freeAgentUnknownHeldBack: 0, missingMetadataHeldBack: 0, teamConflictsManualReview: 0 },
    v82SafeSubsetImpact: { newlyAllowedBySleeperMetadata: 0, stillHeldBack: 0, heldBackByInactiveStale: 0, heldBackByFreeAgentUnknown: 0, heldBackByPositionConflict: 0, heldBackByMissingMetadata: 0, controlledFlagReviewRemainsBlocked: true, protectedZeroChecks: zeroChecks },
    sourceRecommendations: [],
    examples: { activePlausibleRows: [], topInactiveStaleRows: [], topFreeAgentUnknownRows: [], positionConflictRows: [], topV82SafeRowsStillHeldBack: [] },
    rows: [],
    safetyGates: [gate("required_sources_present", false, "H27 Sleeper metadata resolution and H21 policy packet are required.")],
    recommendation: "sleeper_policy_refresh_blocked",
    notes: ["H28 could not run because required source artifacts are missing."],
  };
}

function zeroChecksFor(input: ProjectionSleeperPolicyRefreshInput) {
  const fromPacket = input.featureFlagReviewPacket?.safetySummary;
  const fromRosterRefresh = input.activeUniverseGateRosterRefresh?.v82SafeSubsetCrossReference.packetSummary;
  return {
    kRowsUsingV82: (fromPacket?.kRowsUsingV82 ?? fromRosterRefresh?.kRowsUsingV82 ?? 0) === 0,
    criticalMoversUsingV82: (fromPacket?.criticalMoversUsingV82 ?? fromRosterRefresh?.criticalMoversUsingV82 ?? 0) === 0,
    meaningfulRankMoversUsingV82: (fromPacket?.meaningfulRankMoversUsingV82 ?? fromRosterRefresh?.meaningfulRankMoversUsingV82 ?? 0) === 0,
    legacyRowsUsingV82: (fromPacket?.legacyRowsUsingV82 ?? fromRosterRefresh?.legacyRowsUsingV82 ?? 0) === 0,
  };
}

function deltaCounts(
  before: Record<ProjectionActiveUniversePolicyClassification, number>,
  after: Record<ProjectionSleeperPolicyRefreshClassification, number>,
) {
  const delta = Object.fromEntries(REFRESHED_CLASSIFICATIONS.map((classification) => [classification, 0])) as Record<ProjectionSleeperPolicyRefreshClassification, number>;
  for (const classification of REFRESHED_CLASSIFICATIONS) {
    delta[classification] = after[classification] - (classification === "policy_active_candidate_preview" ? 0 : before[classification]);
  }
  return delta;
}

function sourceArtifactsFor(input: ProjectionSleeperPolicyRefreshInput): ProjectionSleeperPolicyRefreshReport["sourceArtifacts"] {
  return {
    sleeperMetadataResolution: input.sleeperMetadataResolution ? "in-memory" : "missing",
    activeUniversePolicyPacket: input.activeUniversePolicyPacket ? "in-memory" : "missing",
    rosterRefreshPolicyReview: input.rosterRefreshPolicyReview ? "in-memory" : "missing",
    activeUniverseGateRosterRefresh: input.activeUniverseGateRosterRefresh ? "in-memory" : "missing",
    featureFlagReviewPacket: input.featureFlagReviewPacket ? "in-memory" : "missing",
    preseasonProjectionSnapshot: input.preseasonProjectionSnapshot ? "in-memory" : "missing",
  };
}

function renderMarkdown(report: ProjectionSleeperPolicyRefreshReport) {
  return `# Projection Sleeper Policy Refresh ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Recommendation: ${report.recommendation}

## Summary

\`\`\`json
${JSON.stringify(report.summary, null, 2)}
\`\`\`

## Before / After Policy Counts

\`\`\`json
${JSON.stringify(report.policyCounts, null, 2)}
\`\`\`

## v8.2 Safe Subset Impact

\`\`\`json
${JSON.stringify(report.v82SafeSubsetImpact, null, 2)}
\`\`\`

## Source Recommendations

${report.sourceRecommendations.map((row) => `- ${row.sourceNeed}: ${row.rowsAffected} rows, ${row.v82SafeSubsetRowsAffected} v8.2-safe rows. ${row.rationale}`).join("\n")}

## Active Plausible Rows

${renderRows(report.examples.activePlausibleRows)}

## Inactive / Stale Examples

${renderRows(report.examples.topInactiveStaleRows)}

## Free Agent / Unknown Examples

${renderRows(report.examples.topFreeAgentUnknownRows)}

## Position Conflicts

${renderRows(report.examples.positionConflictRows)}

## v8.2 Safe Still Held Back

${renderRows(report.examples.topV82SafeRowsStillHeldBack)}

## Safety Gates

${renderGateTable(report.safetyGates)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderRows(rows: ProjectionSleeperPolicyRefreshRow[]) {
  if (!rows.length) return "No rows.";
  return [
    "| Player | Pos | Projection Team | Metadata Team | Status | Original Policy | Refreshed Policy | Reasons |",
    "|---|---|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.projectionTeam ?? ""} | ${row.metadataTeam ?? ""} | ${row.resolutionStatus} | ${row.originalPolicyClassification} | ${row.refreshedPolicyClassification} | ${row.reasonCodes.join(" ")} |`),
  ].join("\n");
}

function renderGateTable(gates: ProjectionSleeperPolicyRefreshReport["safetyGates"]) {
  return [
    "| Gate | Status | Detail |",
    "|---|---|---|",
    ...gates.map((gateRow) => `| ${gateRow.name} | ${gateRow.passed ? "PASS" : "FAIL"} | ${gateRow.detail} |`),
  ].join("\n");
}

function renderCsv(report: ProjectionSleeperPolicyRefreshReport) {
  const headers = ["player_id", "sleeper_id", "player", "position", "projection_team", "metadata_team", "metadata_status", "resolution_status", "original_policy", "refreshed_policy", "policy_delta", "v82_safe_subset", "reason_codes"];
  const rows = report.rows.map((row) => [
    row.playerId,
    row.sleeperId ?? "",
    row.player,
    row.position,
    row.projectionTeam ?? "",
    row.metadataTeam ?? "",
    row.metadataStatus ?? "",
    row.resolutionStatus,
    row.originalPolicyClassification,
    row.refreshedPolicyClassification,
    row.policyDelta,
    row.v82SafeSubsetStatus,
    row.reasonCodes.join("|"),
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function topRows(rows: ProjectionSleeperPolicyRefreshRow[], limit: number) {
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
