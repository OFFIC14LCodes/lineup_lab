import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type {
  ProjectionFreeAgentUnknownImportanceBucket,
  ProjectionFreeAgentUnknownPolicyClass,
  ProjectionFreeAgentUnknownPolicyRecommendation,
  ProjectionFreeAgentUnknownPolicyReviewArtifactPaths,
  ProjectionFreeAgentUnknownPolicyReviewInput,
  ProjectionFreeAgentUnknownPolicyReviewReport,
  ProjectionFreeAgentUnknownPolicyRow,
  ProjectionFreeAgentUnknownReasonCode,
} from "./projection-free-agent-unknown-policy-review-types";
import type { ProjectionSleeperPolicyRefreshRow } from "./projection-sleeper-policy-refresh-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const POLICY_CLASSES: ProjectionFreeAgentUnknownPolicyClass[] = [
  "free_agent_unknown_shadow_only",
  "free_agent_unknown_current_path_only",
  "free_agent_unknown_manual_review",
  "free_agent_unknown_blocked_archive",
  "free_agent_unknown_source_expansion_required",
];
const IMPORTANCE_BUCKETS: ProjectionFreeAgentUnknownImportanceBucket[] = [
  "high_projection_importance",
  "moderate_projection_importance",
  "low_projection_importance",
  "insufficient_projection_importance_data",
];

export function runProjectionFreeAgentUnknownPolicyReview(options: { projectionSeason: number; includeIdp: boolean }): ProjectionFreeAgentUnknownPolicyReviewReport {
  const sourceArtifacts = {
    sleeperPolicyRefresh: path.join(OUTPUT_DIR, `projection-sleeper-policy-refresh-${options.projectionSeason}.json`),
    sleeperMetadataResolution: path.join(OUTPUT_DIR, `projection-sleeper-metadata-resolution-${options.projectionSeason}.json`),
    activeUniversePolicyPacket: path.join(OUTPUT_DIR, `projection-active-universe-policy-packet-${options.projectionSeason}.json`),
    rosterRefreshPolicyReview: path.join(OUTPUT_DIR, `projection-roster-refresh-policy-review-${options.projectionSeason}.json`),
    featureFlagReviewPacket: path.join(OUTPUT_DIR, `projection-v8-2-feature-flag-review-packet-${options.projectionSeason}.json`),
    preseasonProjectionSnapshot: path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`),
  };

  return buildProjectionFreeAgentUnknownPolicyReviewFromData({
    options,
    sleeperPolicyRefresh: readIfExists(sourceArtifacts.sleeperPolicyRefresh),
    sleeperMetadataResolution: readIfExists(sourceArtifacts.sleeperMetadataResolution),
    activeUniversePolicyPacket: readIfExists(sourceArtifacts.activeUniversePolicyPacket),
    rosterRefreshPolicyReview: readIfExists(sourceArtifacts.rosterRefreshPolicyReview),
    featureFlagReviewPacket: readIfExists(sourceArtifacts.featureFlagReviewPacket),
    preseasonProjectionSnapshot: readIfExists(sourceArtifacts.preseasonProjectionSnapshot),
    sourceArtifacts,
  });
}

export function buildProjectionFreeAgentUnknownPolicyReviewFromData(input: ProjectionFreeAgentUnknownPolicyReviewInput): ProjectionFreeAgentUnknownPolicyReviewReport {
  if (!input.sleeperPolicyRefresh) return sourceMissingReport(input);
  const rows = input.sleeperPolicyRefresh.rows
    .filter((row) => row.resolutionStatus === "sleeper_metadata_free_agent_or_unknown")
    .map((row) => reviewRow(row, input.options.projectionSeason));
  const zeroChecks = zeroChecksFor(input);
  const safetyGates = buildSafetyGates(rows, zeroChecks, input);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? sourceArtifactsFor(input),
    sourceMissing: false,
    summary: buildSummary(rows),
    v82Impact: buildV82Impact(rows, zeroChecks),
    examples: {
      topHighImportanceManualReviewRows: topRows(rows.filter((row) => row.policyClass === "free_agent_unknown_manual_review"), 50),
      topCurrentPathOnlyRows: topRows(rows.filter((row) => row.policyClass === "free_agent_unknown_current_path_only"), 50),
      topShadowOnlyRows: topRows(rows.filter((row) => row.policyClass === "free_agent_unknown_shadow_only"), 50),
      topBlockedArchiveRows: topRows(rows.filter((row) => row.policyClass === "free_agent_unknown_blocked_archive"), 50),
      topSourceExpansionRequiredRows: topRows(rows.filter((row) => row.policyClass === "free_agent_unknown_source_expansion_required"), 50),
    },
    rows,
    safetyGates,
    recommendation: recommendationFor(safetyGates),
    notes: [
      "H29 is a dry-run/read-only policy review for H28 free-agent/unknown rows only.",
      "Free-agent/unknown rows are never promoted to active candidates.",
      "High-importance rows remain manual review; moderate rows stay current-path only; low rows are shadow-only unless an old stale signal justifies blocked/archive.",
      "No live projection, rank, suggestion, War Room scoring, Supabase, or v8.2 behavior is changed.",
    ],
  };
}

export function writeProjectionFreeAgentUnknownPolicyReviewArtifacts(report: ProjectionFreeAgentUnknownPolicyReviewReport): ProjectionFreeAgentUnknownPolicyReviewArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-free-agent-unknown-policy-review-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function reviewRow(row: ProjectionSleeperPolicyRefreshRow, projectionSeason: number): ProjectionFreeAgentUnknownPolicyRow {
  const lastActiveSeason = row.h27Row.h26Row.lastActiveSeason;
  const oldOrStaleSignal = typeof lastActiveSeason === "number" && lastActiveSeason <= projectionSeason - 3;
  const importanceBucket = importanceBucketFor(row);
  const policyClass = policyClassFor(importanceBucket, oldOrStaleSignal);
  return {
    playerId: row.playerId,
    sleeperId: row.sleeperId,
    player: row.player,
    position: row.position,
    projectionTeam: row.projectionTeam,
    metadataTeam: row.metadataTeam,
    metadataStatus: row.metadataStatus,
    projectedTotalPointDelta: row.projectedTotalPointDelta,
    estimatedOverallRankMovement: row.estimatedOverallRankMovement,
    lastActiveSeason,
    oldOrStaleSignal,
    importanceBucket,
    policyClass,
    reasonCodes: reasonCodesFor(importanceBucket, policyClass, oldOrStaleSignal, row.v82SafeSubsetStatus),
    v82SafeSubsetStatus: row.v82SafeSubsetStatus,
    h28Row: row,
  };
}

function importanceBucketFor(row: ProjectionSleeperPolicyRefreshRow): ProjectionFreeAgentUnknownImportanceBucket {
  const pointDelta = absoluteNumber(row.projectedTotalPointDelta);
  const rankMovement = absoluteNumber(row.estimatedOverallRankMovement);
  if (pointDelta === null && rankMovement === null) return "insufficient_projection_importance_data";
  if ((pointDelta ?? 0) >= 5 || (rankMovement ?? 0) >= 1000) return "high_projection_importance";
  if ((pointDelta ?? 0) >= 1 || (rankMovement ?? 0) >= 500) return "moderate_projection_importance";
  return "low_projection_importance";
}

function policyClassFor(bucket: ProjectionFreeAgentUnknownImportanceBucket, oldOrStaleSignal: boolean): ProjectionFreeAgentUnknownPolicyClass {
  if (bucket === "high_projection_importance") return "free_agent_unknown_manual_review";
  if (bucket === "moderate_projection_importance") return "free_agent_unknown_current_path_only";
  if (bucket === "low_projection_importance" && oldOrStaleSignal) return "free_agent_unknown_blocked_archive";
  if (bucket === "low_projection_importance") return "free_agent_unknown_shadow_only";
  return "free_agent_unknown_source_expansion_required";
}

function reasonCodesFor(
  bucket: ProjectionFreeAgentUnknownImportanceBucket,
  policyClass: ProjectionFreeAgentUnknownPolicyClass,
  oldOrStaleSignal: boolean,
  v82SafeSubsetStatus: string,
): ProjectionFreeAgentUnknownReasonCode[] {
  const codes: ProjectionFreeAgentUnknownReasonCode[] = [
    "sleeper_metadata_free_agent_unknown",
    "not_current_roster_confirmed",
    "not_rookie_confirmed",
    "needs_transaction_status_source",
  ];
  if (bucket !== "insufficient_projection_importance_data") codes.push(bucket);
  if (oldOrStaleSignal) codes.push("old_last_seen_signal");
  if (v82SafeSubsetStatus === "v82_safe_subset") codes.push("v8_2_safe_but_held_back");
  if (policyClass === "free_agent_unknown_manual_review") codes.push("needs_manual_review");
  return codes;
}

function buildSummary(rows: ProjectionFreeAgentUnknownPolicyRow[]): ProjectionFreeAgentUnknownPolicyReviewReport["summary"] {
  return {
    targetRows: rows.length,
    reviewedRows: rows.length,
    activePromotions: 0,
    byPolicyClass: countByFixed(rows, POLICY_CLASSES, (row) => row.policyClass),
    byPosition: countNested(rows, (row) => row.position || "unknown_position", (row) => row.policyClass, POLICY_CLASSES),
    byTeam: countNested(rows, (row) => row.projectionTeam ?? "missing_team", (row) => row.policyClass, POLICY_CLASSES),
    byImportanceBucket: countByFixed(rows, IMPORTANCE_BUCKETS, (row) => row.importanceBucket),
    byV82SafeSubset: countNested(rows, (row) => row.v82SafeSubsetStatus, (row) => row.policyClass, POLICY_CLASSES),
    oldOrStaleSignal: {
      oldOrStaleRows: rows.filter((row) => row.oldOrStaleSignal).length,
      notOldOrStaleRows: rows.filter((row) => !row.oldOrStaleSignal).length,
      byPolicyClass: countByFixed(rows.filter((row) => row.oldOrStaleSignal), POLICY_CLASSES, (row) => row.policyClass),
    },
  };
}

function buildV82Impact(
  rows: ProjectionFreeAgentUnknownPolicyRow[],
  zeroChecks: ProjectionFreeAgentUnknownPolicyReviewReport["v82Impact"]["protectedZeroChecks"],
): ProjectionFreeAgentUnknownPolicyReviewReport["v82Impact"] {
  const safeRows = rows.filter((row) => row.v82SafeSubsetStatus === "v82_safe_subset");
  return {
    freeAgentUnknownV82SafeRowsReviewed: safeRows.length,
    heldBackAsShadowOnly: safeRows.filter((row) => row.policyClass === "free_agent_unknown_shadow_only").length,
    heldBackAsCurrentPathOnly: safeRows.filter((row) => row.policyClass === "free_agent_unknown_current_path_only").length,
    heldBackAsManualReview: safeRows.filter((row) => row.policyClass === "free_agent_unknown_manual_review").length,
    heldBackAsBlockedArchive: safeRows.filter((row) => row.policyClass === "free_agent_unknown_blocked_archive").length,
    heldBackAsSourceExpansionRequired: safeRows.filter((row) => row.policyClass === "free_agent_unknown_source_expansion_required").length,
    controlledFlagReviewRemainsBlocked: safeRows.length > 0 || !Object.values(zeroChecks).every(Boolean),
    protectedZeroChecks: zeroChecks,
  };
}

function buildSafetyGates(
  rows: ProjectionFreeAgentUnknownPolicyRow[],
  zeroChecks: ProjectionFreeAgentUnknownPolicyReviewReport["v82Impact"]["protectedZeroChecks"],
  input: ProjectionFreeAgentUnknownPolicyReviewInput,
) {
  const nonFreeAgentRows = rows.filter((row) => row.h28Row.resolutionStatus !== "sleeper_metadata_free_agent_or_unknown");
  const activePromotions = rows.filter((row) => row.policyClass.includes("active"));
  const highImportanceNonManual = rows.filter((row) => row.importanceBucket === "high_projection_importance" && row.policyClass !== "free_agent_unknown_manual_review");
  return [
    gate("required_sources_present", Boolean(input.sleeperPolicyRefresh), "H28 Sleeper policy refresh artifact is required."),
    gate("no_live_outputs_changed", true, "Report reads artifacts and writes only local H29 artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Blackbird Rank ordering is not imported, recalculated, or mutated."),
    gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported, recalculated, or mutated."),
    gate("war_room_scoring_unchanged", true, "War Room scoring behavior is not imported, recalculated, or mutated."),
    gate("v8_2_not_enabled", true, "v8.2 feature flag and projection selector behavior are not changed."),
    gate("free_agent_unknown_scope_only", nonFreeAgentRows.length === 0, `${nonFreeAgentRows.length} non-free-agent/unknown rows included.`),
    gate("free_agent_unknown_not_auto_promoted", activePromotions.length === 0, `${activePromotions.length} active promotions found.`),
    gate("high_importance_rows_manual_review", highImportanceNonManual.length === 0, `${highImportanceNonManual.length} high-importance rows not manual review.`),
    gate("zero_checks_preserved", Object.values(zeroChecks).every(Boolean), "K, critical mover, meaningful rank mover, and legacy v8.2 zero checks remain zero."),
  ];
}

function recommendationFor(safetyGates: ProjectionFreeAgentUnknownPolicyReviewReport["safetyGates"]): ProjectionFreeAgentUnknownPolicyRecommendation {
  if (safetyGates.some((gateRow) => !gateRow.passed)) return "free_agent_unknown_policy_blocked";
  return "free_agent_unknown_policy_ready_for_refresh";
}

function sourceMissingReport(input: ProjectionFreeAgentUnknownPolicyReviewInput): ProjectionFreeAgentUnknownPolicyReviewReport {
  const zeroChecks = zeroChecksFor(input);
  const emptyPolicyCounts = Object.fromEntries(POLICY_CLASSES.map((policyClass) => [policyClass, 0])) as Record<ProjectionFreeAgentUnknownPolicyClass, number>;
  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? sourceArtifactsFor(input),
    sourceMissing: true,
    summary: {
      targetRows: 0,
      reviewedRows: 0,
      activePromotions: 0,
      byPolicyClass: emptyPolicyCounts,
      byPosition: {},
      byTeam: {},
      byImportanceBucket: Object.fromEntries(IMPORTANCE_BUCKETS.map((bucket) => [bucket, 0])) as Record<ProjectionFreeAgentUnknownImportanceBucket, number>,
      byV82SafeSubset: {},
      oldOrStaleSignal: { oldOrStaleRows: 0, notOldOrStaleRows: 0, byPolicyClass: emptyPolicyCounts },
    },
    v82Impact: { freeAgentUnknownV82SafeRowsReviewed: 0, heldBackAsShadowOnly: 0, heldBackAsCurrentPathOnly: 0, heldBackAsManualReview: 0, heldBackAsBlockedArchive: 0, heldBackAsSourceExpansionRequired: 0, controlledFlagReviewRemainsBlocked: true, protectedZeroChecks: zeroChecks },
    examples: { topHighImportanceManualReviewRows: [], topCurrentPathOnlyRows: [], topShadowOnlyRows: [], topBlockedArchiveRows: [], topSourceExpansionRequiredRows: [] },
    rows: [],
    safetyGates: [gate("required_sources_present", false, "H28 Sleeper policy refresh artifact is required.")],
    recommendation: "free_agent_unknown_policy_blocked",
    notes: ["H29 could not run because required source artifacts are missing."],
  };
}

function zeroChecksFor(input: ProjectionFreeAgentUnknownPolicyReviewInput) {
  const fromPacket = input.featureFlagReviewPacket?.safetySummary;
  const fromH28 = input.sleeperPolicyRefresh?.v82SafeSubsetImpact.protectedZeroChecks;
  return {
    kRowsUsingV82: fromH28?.kRowsUsingV82 ?? (fromPacket?.kRowsUsingV82 ?? 0) === 0,
    criticalMoversUsingV82: fromH28?.criticalMoversUsingV82 ?? (fromPacket?.criticalMoversUsingV82 ?? 0) === 0,
    meaningfulRankMoversUsingV82: fromH28?.meaningfulRankMoversUsingV82 ?? (fromPacket?.meaningfulRankMoversUsingV82 ?? 0) === 0,
    legacyRowsUsingV82: fromH28?.legacyRowsUsingV82 ?? (fromPacket?.legacyRowsUsingV82 ?? 0) === 0,
  };
}

function sourceArtifactsFor(input: ProjectionFreeAgentUnknownPolicyReviewInput): ProjectionFreeAgentUnknownPolicyReviewReport["sourceArtifacts"] {
  return {
    sleeperPolicyRefresh: input.sleeperPolicyRefresh ? "in-memory" : "missing",
    sleeperMetadataResolution: input.sleeperMetadataResolution ? "in-memory" : "missing",
    activeUniversePolicyPacket: input.activeUniversePolicyPacket ? "in-memory" : "missing",
    rosterRefreshPolicyReview: input.rosterRefreshPolicyReview ? "in-memory" : "missing",
    featureFlagReviewPacket: input.featureFlagReviewPacket ? "in-memory" : "missing",
    preseasonProjectionSnapshot: input.preseasonProjectionSnapshot ? "in-memory" : "missing",
  };
}

function renderMarkdown(report: ProjectionFreeAgentUnknownPolicyReviewReport) {
  return `# Projection Free-Agent/Unknown Policy Review ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Recommendation: ${report.recommendation}

## Summary

\`\`\`json
${JSON.stringify(report.summary, null, 2)}
\`\`\`

## v8.2 Impact

\`\`\`json
${JSON.stringify(report.v82Impact, null, 2)}
\`\`\`

## High-Importance Manual Review

${renderRows(report.examples.topHighImportanceManualReviewRows)}

## Current Path Only

${renderRows(report.examples.topCurrentPathOnlyRows)}

## Shadow Only

${renderRows(report.examples.topShadowOnlyRows)}

## Blocked / Archive

${renderRows(report.examples.topBlockedArchiveRows)}

## Source Expansion Required

${renderRows(report.examples.topSourceExpansionRequiredRows)}

## Safety Gates

${renderGateTable(report.safetyGates)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderRows(rows: ProjectionFreeAgentUnknownPolicyRow[]) {
  if (!rows.length) return "No rows.";
  return [
    "| Player | Pos | Team | Points Delta | Rank Movement | Importance | Policy | Reasons |",
    "|---|---|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.projectionTeam ?? ""} | ${row.projectedTotalPointDelta ?? ""} | ${row.estimatedOverallRankMovement ?? ""} | ${row.importanceBucket} | ${row.policyClass} | ${row.reasonCodes.join(" ")} |`),
  ].join("\n");
}

function renderGateTable(gates: ProjectionFreeAgentUnknownPolicyReviewReport["safetyGates"]) {
  return [
    "| Gate | Status | Detail |",
    "|---|---|---|",
    ...gates.map((gateRow) => `| ${gateRow.name} | ${gateRow.passed ? "PASS" : "FAIL"} | ${gateRow.detail} |`),
  ].join("\n");
}

function renderCsv(report: ProjectionFreeAgentUnknownPolicyReviewReport) {
  const headers = ["player_id", "sleeper_id", "player", "position", "projection_team", "metadata_status", "projected_total_point_delta", "estimated_overall_rank_movement", "last_active_season", "old_or_stale_signal", "importance_bucket", "policy_class", "v82_safe_subset", "reason_codes"];
  const rows = report.rows.map((row) => [
    row.playerId,
    row.sleeperId ?? "",
    row.player,
    row.position,
    row.projectionTeam ?? "",
    row.metadataStatus ?? "",
    row.projectedTotalPointDelta ?? "",
    row.estimatedOverallRankMovement ?? "",
    row.lastActiveSeason ?? "",
    row.oldOrStaleSignal,
    row.importanceBucket,
    row.policyClass,
    row.v82SafeSubsetStatus,
    row.reasonCodes.join("|"),
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function topRows(rows: ProjectionFreeAgentUnknownPolicyRow[], limit: number) {
  return [...rows].sort((a, b) =>
    (absoluteNumber(b.projectedTotalPointDelta) ?? 0) - (absoluteNumber(a.projectedTotalPointDelta) ?? 0)
    || (absoluteNumber(b.estimatedOverallRankMovement) ?? 0) - (absoluteNumber(a.estimatedOverallRankMovement) ?? 0)
    || a.player.localeCompare(b.player)
  ).slice(0, limit);
}

function countByFixed<T, Key extends string>(rows: T[], keys: Key[], keyFor: (row: T) => Key) {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<Key, number>;
  for (const row of rows) counts[keyFor(row)] += 1;
  return counts;
}

function countNested<T, Key extends string, Value extends string>(rows: T[], keyFor: (row: T) => Key, valueFor: (row: T) => Value, values: Value[]) {
  const counts: Record<Key, Record<Value, number>> = {} as Record<Key, Record<Value, number>>;
  for (const row of rows) {
    const key = keyFor(row);
    const value = valueFor(row);
    counts[key] = counts[key] ?? Object.fromEntries(values.map((entry) => [entry, 0])) as Record<Value, number>;
    counts[key][value] += 1;
  }
  return counts;
}

function absoluteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.abs(value) : null;
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
