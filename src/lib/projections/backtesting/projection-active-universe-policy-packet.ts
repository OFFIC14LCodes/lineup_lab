import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ProjectionActiveUniverseGateV82Path } from "./projection-active-universe-gate-types";
import type { ProjectionActiveUniverseGateRosterRefreshReport } from "./projection-active-universe-gate-roster-refresh-types";
import type { ProjectionCurrentRosterConfirmationReport } from "./projection-current-roster-confirmation-types";
import type { ProjectionPromotionCandidatePoolReport } from "./projection-promotion-candidate-pool-types";
import type {
  ProjectionActiveUniversePolicyClassification,
  ProjectionActiveUniversePolicyPacketArtifactPaths,
  ProjectionActiveUniversePolicyPacketInput,
  ProjectionActiveUniversePolicyPacketOptions,
  ProjectionActiveUniversePolicyPacketReport,
  ProjectionActiveUniversePolicyPacketRow,
  ProjectionActiveUniversePolicyReasonCode,
  ProjectionActiveUniversePolicyRecommendation,
  ProjectionActiveUniversePolicySourceNeed,
} from "./projection-active-universe-policy-packet-types";
import type { ProjectionRosterRefreshPolicyGroup, ProjectionRosterRefreshPolicyReviewReport, ProjectionRosterRefreshPolicyReviewRow } from "./projection-roster-refresh-policy-review-types";
import type { ProjectionV82FeatureFlagReviewPacketReport } from "./projection-v8-2-feature-flag-review-packet-types";

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
const H20_GROUPS: ProjectionRosterRefreshPolicyGroup[] = [
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
const V82_BUCKETS: ProjectionActiveUniverseGateV82Path[] = ["would_use_v8_2_safe_subset", "would_stay_current_path", "excluded_or_blocked"];
const SOURCE_NEEDS: ProjectionActiveUniversePolicySourceNeed[] = [
  "depth_chart_source",
  "transaction_free_agent_source",
  "rookie_team_confirmation_source",
  "injury_pup_nfi_source",
  "kicker_specific_depth_chart_source",
  "manual_conflict_review",
];

export function runProjectionActiveUniversePolicyPacket(options: ProjectionActiveUniversePolicyPacketOptions): ProjectionActiveUniversePolicyPacketReport {
  const sourceArtifacts = {
    rosterPolicyReview: path.join(OUTPUT_DIR, `projection-roster-refresh-policy-review-${options.projectionSeason}.json`),
    rosterRefresh: path.join(OUTPUT_DIR, `projection-active-universe-gate-roster-refresh-${options.projectionSeason}.json`),
    currentRosterConfirmation: path.join(OUTPUT_DIR, `projection-current-roster-confirmation-${options.projectionSeason}.json`),
    universeHygieneSummary: path.join(OUTPUT_DIR, `projection-universe-hygiene-summary-${options.projectionSeason}.json`),
    featureFlagReviewPacket: path.join(OUTPUT_DIR, `projection-v8-2-feature-flag-review-packet-${options.projectionSeason}.json`),
    promotionCandidatePool: path.join(OUTPUT_DIR, `projection-promotion-candidate-pool-${options.projectionSeason}.json`),
  };
  for (const artifactPath of Object.values(sourceArtifacts)) {
    if (!existsSync(artifactPath)) throw new Error(`Missing ${path.relative(process.cwd(), artifactPath)}.`);
  }

  return buildProjectionActiveUniversePolicyPacketFromData({
    options,
    rosterPolicyReview: readJson<ProjectionRosterRefreshPolicyReviewReport>(sourceArtifacts.rosterPolicyReview),
    rosterRefresh: readJson<ProjectionActiveUniverseGateRosterRefreshReport>(sourceArtifacts.rosterRefresh),
    currentRosterConfirmation: readJson<ProjectionCurrentRosterConfirmationReport>(sourceArtifacts.currentRosterConfirmation),
    featureFlagReviewPacket: readJson<ProjectionV82FeatureFlagReviewPacketReport>(sourceArtifacts.featureFlagReviewPacket),
    promotionCandidatePool: readJson<ProjectionPromotionCandidatePoolReport>(sourceArtifacts.promotionCandidatePool),
    sourceArtifacts,
  });
}

export function buildProjectionActiveUniversePolicyPacketFromData(input: ProjectionActiveUniversePolicyPacketInput): ProjectionActiveUniversePolicyPacketReport {
  const rows = input.rosterPolicyReview.rows.map(policyRow);
  const packetZeroChecks = {
    kRowsUsingV82: input.featureFlagReviewPacket.safetySummary.kRowsUsingV82 === 0,
    criticalMoversUsingV82: input.featureFlagReviewPacket.safetySummary.criticalMoversUsingV82 === 0,
    meaningfulRankMoversUsingV82: input.featureFlagReviewPacket.safetySummary.meaningfulRankMoversUsingV82 === 0,
    legacyRowsUsingV82: input.featureFlagReviewPacket.safetySummary.legacyRowsUsingV82 === 0,
  };
  const sourceExpansionPriorities = SOURCE_NEEDS
    .map((sourceNeed) => sourceNeedSummary(sourceNeed, rows))
    .filter((summary) => summary.rowsAffected > 0);
  const manualReview = {
    conflicts: topRows(rows.filter((row) => row.policyGroup === "conflict_review"), 100),
    remainingManualRows: topRows(rows.filter((row) => row.policyGroup === "manual_review_remaining"), 100),
    confirmedNonActiveRows: topRows(rows.filter((row) => row.policyGroup === "confirmed_non_active_review"), 100),
    irPupNfiSummary: {
      totalRows: rows.filter((row) => row.policyGroup === "confirmed_ir_pup_nfi_review").length,
      byPosition: countBy(rows.filter((row) => row.policyGroup === "confirmed_ir_pup_nfi_review"), (row) => row.position || "unknown_position"),
      topExamples: topRows(rows.filter((row) => row.policyGroup === "confirmed_ir_pup_nfi_review"), 50),
    },
  };
  const safeV82Rows = rows.filter((row) => row.v82Path === "would_use_v8_2_safe_subset");
  const v82ConservativePolicyImpact = {
    safeV82RowsAllowedByConservativePolicy: safeV82Rows.filter((row) => row.policyClassification === "policy_active_candidate").length,
    safeV82RowsHeldBackBySourceExpansion: safeV82Rows.filter((row) => row.policyClassification === "policy_source_expansion_required").length,
    safeV82RowsHeldBackByKickerManualCurrentPathPolicy: safeV82Rows.filter((row) =>
      row.policyClassification === "policy_kicker_review_required"
      || row.policyClassification === "policy_manual_review"
      || row.policyClassification === "policy_current_path_only"
      || row.policyClassification === "policy_shadow_only"
      || row.policyClassification === "policy_blocked_archive"
    ).length,
    protectedZeroChecks: packetZeroChecks,
    v82RemainsSafe: Object.values(packetZeroChecks).every(Boolean),
  };
  const safetyGates = buildSafetyGates(input, rows, sourceExpansionPriorities, v82ConservativePolicyImpact.v82RemainsSafe);
  const recommendation = recommendationFor(safetyGates);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? {
      rosterPolicyReview: "in-memory",
      rosterRefresh: "in-memory",
      currentRosterConfirmation: "in-memory",
      universeHygieneSummary: "in-memory",
      featureFlagReviewPacket: "in-memory",
      promotionCandidatePool: "in-memory",
    },
    policyCounts: {
      totalRows: rows.length,
      byClassification: countClassifications(rows),
      byPosition: countNested(rows, (row) => row.position || "unknown_position", (row) => row.policyClassification),
      byTeam: countNested(rows, (row) => row.projectionTeam ?? "missing_team", (row) => row.policyClassification),
      byH20PolicyGroup: countH20Groups(rows),
      byV82SelectionBucket: countV82Buckets(rows),
    },
    sourceExpansionPriorities,
    v82ConservativePolicyImpact,
    manualReview,
    rows,
    safetyGates,
    recommendation,
    notes: [
      "H21 is a dry-run/read-only conservative active-universe policy packet.",
      "The policy is not applied to live projections, rank, suggestions, War Room scoring, Supabase, or v8.2 selection.",
      "Unmatched groups remain source-expansion required and are not auto-promoted to active.",
      "Kicker rows remain policy review required until kicker-specific policy and source coverage exist.",
    ],
  };
}

export function writeProjectionActiveUniversePolicyPacketArtifacts(report: ProjectionActiveUniversePolicyPacketReport): ProjectionActiveUniversePolicyPacketArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-active-universe-policy-packet-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function policyRow(row: ProjectionRosterRefreshPolicyReviewRow): ProjectionActiveUniversePolicyPacketRow {
  const policyClassification = classificationFor(row);
  return {
    ...row,
    policyClassification,
    policyReasonCodes: reasonCodesFor(row, policyClassification),
  };
}

function classificationFor(row: ProjectionRosterRefreshPolicyReviewRow): ProjectionActiveUniversePolicyClassification {
  if (row.policyGroup === "confirmed_active_clear") return "policy_active_candidate";
  if (row.policyGroup === "confirmed_ir_pup_nfi_review") return "policy_shadow_only";
  if (row.policyGroup === "confirmed_non_active_review") return row.rosterStatus === "retired" ? "policy_blocked_archive" : "policy_current_path_only";
  if (row.policyGroup === "legacy_blocked") return "policy_blocked_archive";
  if (row.policyGroup === "kicker_policy_review") return "policy_kicker_review_required";
  if (row.policyGroup === "conflict_review") return "policy_manual_review";
  if (row.policyGroup === "manual_review_remaining") return "policy_current_path_only";
  return "policy_source_expansion_required";
}

function reasonCodesFor(row: ProjectionRosterRefreshPolicyReviewRow, classification: ProjectionActiveUniversePolicyClassification): ProjectionActiveUniversePolicyReasonCode[] {
  const codes = new Set<ProjectionActiveUniversePolicyReasonCode>();
  if (row.policyGroup === "confirmed_active_clear") codes.add("roster_confirmed_active_allowed");
  if (row.policyGroup === "confirmed_ir_pup_nfi_review") codes.add("ir_pup_nfi_requires_status_review");
  if (row.policyGroup === "confirmed_non_active_review") codes.add("non_active_current_path_only");
  if (row.policyGroup === "legacy_blocked" || classification === "policy_blocked_archive") codes.add("legacy_blocked");
  if (row.policyGroup === "kicker_policy_review") codes.add("kicker_policy_missing");
  if (row.policyGroup === "conflict_review") codes.add("team_conflict_manual_review");
  if (row.policyGroup === "manual_review_remaining") codes.add("manual_mover_current_path_only");
  if (row.policyGroup === "unmatched_active_candidate_review") codes.add("unmatched_needs_depth_chart_source");
  if (row.policyGroup === "unmatched_rookie_new_review") codes.add("unmatched_rookie_needs_team_confirmation");
  if (row.policyGroup === "stale_unmatched_review") codes.add("stale_needs_transaction_status_source");
  if (row.policyGroup === "unmatched_low_confidence_review") codes.add("low_confidence_needs_depth_chart_source");
  if (row.v82Path === "would_use_v8_2_safe_subset") codes.add("v8_2_safe_subset_preserved");
  return [...codes];
}

function sourceNeedSummary(sourceNeed: ProjectionActiveUniversePolicySourceNeed, rows: ProjectionActiveUniversePolicyPacketRow[]) {
  const sourceRows = rows.filter((row) => sourceNeedFor(row) === sourceNeed);
  return {
    sourceNeed,
    rowsAffected: sourceRows.length,
    positionsAffected: countBy(sourceRows, (row) => row.position || "unknown_position"),
    v82SafeSubsetRowsAffected: sourceRows.filter((row) => row.v82Path === "would_use_v8_2_safe_subset").length,
    topExamples: topRows(sourceRows, 30),
    recommendedNextMilestone: milestoneFor(sourceNeed),
  };
}

function sourceNeedFor(row: ProjectionActiveUniversePolicyPacketRow): ProjectionActiveUniversePolicySourceNeed | null {
  if (row.policyGroup === "unmatched_active_candidate_review" || row.policyGroup === "unmatched_low_confidence_review") return "depth_chart_source";
  if (row.policyGroup === "stale_unmatched_review" || row.policyGroup === "confirmed_non_active_review") return "transaction_free_agent_source";
  if (row.policyGroup === "unmatched_rookie_new_review") return "rookie_team_confirmation_source";
  if (row.policyGroup === "confirmed_ir_pup_nfi_review") return "injury_pup_nfi_source";
  if (row.policyGroup === "kicker_policy_review") return "kicker_specific_depth_chart_source";
  if (row.policyGroup === "conflict_review") return "manual_conflict_review";
  return null;
}

function milestoneFor(sourceNeed: ProjectionActiveUniversePolicySourceNeed) {
  if (sourceNeed === "depth_chart_source") return "Add dry-run depth chart/source coverage for unmatched active and low-confidence rows.";
  if (sourceNeed === "transaction_free_agent_source") return "Add dry-run transaction/free-agent status source for stale and non-active rows.";
  if (sourceNeed === "rookie_team_confirmation_source") return "Add rookie/team confirmation source coverage before any rookie unmatched promotion.";
  if (sourceNeed === "injury_pup_nfi_source") return "Add injury/PUP/NFI status review policy before treating injured rows as active.";
  if (sourceNeed === "kicker_specific_depth_chart_source") return "Define kicker policy with kicker-specific depth chart/source coverage.";
  return "Manually review roster/projection team conflicts before policy promotion.";
}

function buildSafetyGates(
  input: ProjectionActiveUniversePolicyPacketInput,
  rows: ProjectionActiveUniversePolicyPacketRow[],
  sourceExpansionPriorities: ProjectionActiveUniversePolicyPacketReport["sourceExpansionPriorities"],
  v82RemainsSafe: boolean,
) {
  const unmatchedAutoPromoted = rows.filter((row) =>
    (row.policyGroup === "unmatched_active_candidate_review"
      || row.policyGroup === "unmatched_rookie_new_review"
      || row.policyGroup === "unmatched_low_confidence_review"
      || row.policyGroup === "stale_unmatched_review")
    && row.policyClassification === "policy_active_candidate"
  );
  const kickerAutoPromoted = rows.filter((row) => row.policyGroup === "kicker_policy_review" && row.policyClassification === "policy_active_candidate");
  const legacyNotBlocked = rows.filter((row) => row.policyGroup === "legacy_blocked" && row.policyClassification !== "policy_blocked_archive");
  const conflictsNotManual = rows.filter((row) => row.policyGroup === "conflict_review" && row.policyClassification !== "policy_manual_review");
  return [
    gate("no_live_outputs_changed", true, "Report reads artifacts and writes only local H21 artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Blackbird Rank ordering is not imported, recalculated, or mutated."),
    gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported, recalculated, or mutated."),
    gate("war_room_scoring_unchanged", true, "War Room scoring behavior is not imported, recalculated, or mutated."),
    gate("v8_2_not_enabled", true, "v8.2 feature flag and projection selector behavior are not changed."),
    gate("unmatched_groups_not_auto_promoted", unmatchedAutoPromoted.length === 0, `${unmatchedAutoPromoted.length} unmatched rows auto-promoted.`),
    gate("kicker_rows_not_auto_promoted", kickerAutoPromoted.length === 0, `${kickerAutoPromoted.length} K rows auto-promoted.`),
    gate("legacy_rows_blocked", legacyNotBlocked.length === 0, `${legacyNotBlocked.length} legacy rows not blocked.`),
    gate("conflicts_manual_review", conflictsNotManual.length === 0 && input.rosterPolicyReview.conflicts.length > 0, `${conflictsNotManual.length} conflicts not manual-review.`),
    gate("source_expansion_prioritized", sourceExpansionPriorities.length >= 4, `${sourceExpansionPriorities.length} source priorities reported.`),
    gate("v8_2_protection_preserved", v82RemainsSafe, "v8.2 packet zero checks remain preserved."),
    gate("all_rows_classified", rows.length === input.rosterPolicyReview.rows.length, `${rows.length} rows classified.`),
  ];
}

function recommendationFor(safetyGates: ProjectionActiveUniversePolicyPacketReport["safetyGates"]): ProjectionActiveUniversePolicyRecommendation {
  if (safetyGates.some((gateRow) => !gateRow.passed)) return "active_policy_blocked";
  return "active_policy_ready_for_source_expansion";
}

function renderMarkdown(report: ProjectionActiveUniversePolicyPacketReport) {
  return `# Projection Active Universe Policy Packet ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Recommendation: ${report.recommendation}

## Conservative Policy Counts

\`\`\`json
${JSON.stringify(report.policyCounts, null, 2)}
\`\`\`

## Source Expansion Priorities

${report.sourceExpansionPriorities.map((summary) => `### ${summary.sourceNeed}

Rows affected: ${summary.rowsAffected}
v8.2 safe subset rows affected: ${summary.v82SafeSubsetRowsAffected}
Recommended next milestone: ${summary.recommendedNextMilestone}

${renderRows(summary.topExamples)}
`).join("\n")}

## v8.2 Conservative Policy Impact

\`\`\`json
${JSON.stringify(report.v82ConservativePolicyImpact, null, 2)}
\`\`\`

## Manual Review

### Conflicts

${renderRows(report.manualReview.conflicts)}

### Remaining Manual Rows

${renderRows(report.manualReview.remainingManualRows)}

### Confirmed Non-Active Rows

${renderRows(report.manualReview.confirmedNonActiveRows)}

### IR / PUP / NFI Summary

\`\`\`json
${JSON.stringify(report.manualReview.irPupNfiSummary, null, 2)}
\`\`\`

## Safety Gates

${renderGateTable(report.safetyGates)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderCsv(report: ProjectionActiveUniversePolicyPacketReport) {
  const headers = [
    "player_id",
    "player",
    "position",
    "projection_team",
    "roster_team",
    "roster_status",
    "h20_policy_group",
    "policy_classification",
    "policy_reason_codes",
    "v82_path",
    "recommended_policy_action",
  ];
  return [headers, ...report.rows.map((row) => [
    row.playerId,
    row.player,
    row.position,
    row.projectionTeam ?? "",
    row.rosterTeam ?? "",
    row.rosterStatus ?? "",
    row.policyGroup,
    row.policyClassification,
    row.policyReasonCodes.join("|"),
    row.v82Path,
    row.recommendedPolicyAction,
  ])].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function renderRows(rows: ProjectionActiveUniversePolicyPacketRow[]) {
  if (!rows.length) return "No rows.";
  return [
    "| Player | Pos | Team | Roster | H20 Group | Policy | v8.2 | Reasons |",
    "|---|---|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.projectionTeam ?? ""} | ${row.rosterStatus ?? ""} | ${row.policyGroup} | ${row.policyClassification} | ${row.v82Path} | ${row.policyReasonCodes.join(" ")} |`),
  ].join("\n");
}

function renderGateTable(gates: ProjectionActiveUniversePolicyPacketReport["safetyGates"]) {
  return [
    "| Gate | Status | Detail |",
    "|---|---|---|",
    ...gates.map((gateRow) => `| ${gateRow.name} | ${gateRow.passed ? "PASS" : "FAIL"} | ${gateRow.detail} |`),
  ].join("\n");
}

function topRows(rows: ProjectionActiveUniversePolicyPacketRow[], limit = 50) {
  return [...rows]
    .sort((a, b) =>
      Math.abs(b.projectedTotalPointDelta ?? 0) - Math.abs(a.projectedTotalPointDelta ?? 0)
      || (a.lastActiveSeason ?? 9999) - (b.lastActiveSeason ?? 9999)
      || a.player.localeCompare(b.player)
    )
    .slice(0, limit);
}

function countClassifications(rows: ProjectionActiveUniversePolicyPacketRow[]) {
  const counts = Object.fromEntries(POLICY_CLASSIFICATIONS.map((classification) => [classification, 0])) as Record<ProjectionActiveUniversePolicyClassification, number>;
  for (const row of rows) counts[row.policyClassification] += 1;
  return counts;
}

function countH20Groups(rows: ProjectionActiveUniversePolicyPacketRow[]) {
  const counts = Object.fromEntries(
    H20_GROUPS.map((group) => [group, Object.fromEntries(POLICY_CLASSIFICATIONS.map((classification) => [classification, 0])) as Record<ProjectionActiveUniversePolicyClassification, number>]),
  ) as Record<ProjectionRosterRefreshPolicyGroup, Record<ProjectionActiveUniversePolicyClassification, number>>;
  for (const row of rows) counts[row.policyGroup][row.policyClassification] += 1;
  return counts;
}

function countV82Buckets(rows: ProjectionActiveUniversePolicyPacketRow[]) {
  const counts = Object.fromEntries(
    V82_BUCKETS.map((bucket) => [bucket, Object.fromEntries(POLICY_CLASSIFICATIONS.map((classification) => [classification, 0])) as Record<ProjectionActiveUniversePolicyClassification, number>]),
  ) as Record<ProjectionActiveUniverseGateV82Path, Record<ProjectionActiveUniversePolicyClassification, number>>;
  for (const row of rows) counts[row.v82Path][row.policyClassification] += 1;
  return counts;
}

function countNested<Key extends string, Value extends string>(
  rows: ProjectionActiveUniversePolicyPacketRow[],
  keyFor: (row: ProjectionActiveUniversePolicyPacketRow) => Key,
  valueFor: (row: ProjectionActiveUniversePolicyPacketRow) => Value,
) {
  const counts: Record<Key, Record<Value, number>> = {} as Record<Key, Record<Value, number>>;
  for (const row of rows) {
    const key = keyFor(row);
    const value = valueFor(row);
    counts[key] = counts[key] ?? {} as Record<Value, number>;
    counts[key][value] = (counts[key][value] ?? 0) + 1;
  }
  return counts;
}

function countBy<Key extends string>(rows: ProjectionActiveUniversePolicyPacketRow[], keyFor: (row: ProjectionActiveUniversePolicyPacketRow) => Key) {
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
