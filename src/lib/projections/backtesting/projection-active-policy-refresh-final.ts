import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ProjectionActiveUniversePolicyClassification, ProjectionActiveUniversePolicyPacketRow } from "./projection-active-universe-policy-packet-types";
import type { ProjectionFreeAgentUnknownPolicyClass, ProjectionFreeAgentUnknownPolicyRow } from "./projection-free-agent-unknown-policy-review-types";
import type { ProjectionSleeperPolicyRefreshClassification, ProjectionSleeperPolicyRefreshRow } from "./projection-sleeper-policy-refresh-types";
import type {
  ProjectionActivePolicyRefreshFinalArtifactPaths,
  ProjectionActivePolicyRefreshFinalClass,
  ProjectionActivePolicyRefreshFinalInput,
  ProjectionActivePolicyRefreshFinalReasonCode,
  ProjectionActivePolicyRefreshFinalRecommendation,
  ProjectionActivePolicyRefreshFinalReport,
  ProjectionActivePolicyRefreshFinalRow,
} from "./projection-active-policy-refresh-final-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const H21_CLASSES: ProjectionActiveUniversePolicyClassification[] = [
  "policy_active_candidate",
  "policy_shadow_only",
  "policy_blocked_archive",
  "policy_manual_review",
  "policy_source_expansion_required",
  "policy_kicker_review_required",
  "policy_current_path_only",
];
const H28_CLASSES: ProjectionSleeperPolicyRefreshClassification[] = [...H21_CLASSES, "policy_active_candidate_preview"];
const H29_CLASSES: ProjectionFreeAgentUnknownPolicyClass[] = [
  "free_agent_unknown_shadow_only",
  "free_agent_unknown_current_path_only",
  "free_agent_unknown_manual_review",
  "free_agent_unknown_blocked_archive",
  "free_agent_unknown_source_expansion_required",
];
const FINAL_CLASSES: ProjectionActivePolicyRefreshFinalClass[] = [
  "final_policy_active_candidate",
  "final_policy_shadow_only",
  "final_policy_current_path_only",
  "final_policy_manual_review",
  "final_policy_source_expansion_required",
  "final_policy_kicker_review_required",
  "final_policy_blocked_archive",
];

export function runProjectionActivePolicyRefreshFinal(options: { projectionSeason: number; includeIdp: boolean }): ProjectionActivePolicyRefreshFinalReport {
  const sourceArtifacts = {
    activeUniversePolicyPacket: path.join(OUTPUT_DIR, `projection-active-universe-policy-packet-${options.projectionSeason}.json`),
    sleeperPolicyRefresh: path.join(OUTPUT_DIR, `projection-sleeper-policy-refresh-${options.projectionSeason}.json`),
    freeAgentUnknownPolicyReview: path.join(OUTPUT_DIR, `projection-free-agent-unknown-policy-review-${options.projectionSeason}.json`),
    sleeperMetadataResolution: path.join(OUTPUT_DIR, `projection-sleeper-metadata-resolution-${options.projectionSeason}.json`),
    rosterRefreshPolicyReview: path.join(OUTPUT_DIR, `projection-roster-refresh-policy-review-${options.projectionSeason}.json`),
    featureFlagReviewPacket: path.join(OUTPUT_DIR, `projection-v8-2-feature-flag-review-packet-${options.projectionSeason}.json`),
    preseasonProjectionSnapshot: path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`),
  };

  return buildProjectionActivePolicyRefreshFinalFromData({
    options,
    activeUniversePolicyPacket: readIfExists(sourceArtifacts.activeUniversePolicyPacket),
    sleeperPolicyRefresh: readIfExists(sourceArtifacts.sleeperPolicyRefresh),
    freeAgentUnknownPolicyReview: readIfExists(sourceArtifacts.freeAgentUnknownPolicyReview),
    sleeperMetadataResolution: readIfExists(sourceArtifacts.sleeperMetadataResolution),
    rosterRefreshPolicyReview: readIfExists(sourceArtifacts.rosterRefreshPolicyReview),
    featureFlagReviewPacket: readIfExists(sourceArtifacts.featureFlagReviewPacket),
    preseasonProjectionSnapshot: readIfExists(sourceArtifacts.preseasonProjectionSnapshot),
    sourceArtifacts,
  });
}

export function buildProjectionActivePolicyRefreshFinalFromData(input: ProjectionActivePolicyRefreshFinalInput): ProjectionActivePolicyRefreshFinalReport {
  if (!input.activeUniversePolicyPacket || !input.sleeperPolicyRefresh || !input.freeAgentUnknownPolicyReview) return sourceMissingReport(input);
  const h28ByPlayerId = mapBy(input.sleeperPolicyRefresh.rows, (row) => row.playerId);
  const h29ByPlayerId = mapBy(input.freeAgentUnknownPolicyReview.rows, (row) => row.playerId);
  const baseByPlayerId = mapBy(input.activeUniversePolicyPacket.rows, (row) => row.playerId);
  const playerIds = new Set<string>([
    ...input.activeUniversePolicyPacket.rows.map((row) => row.playerId),
    ...input.sleeperPolicyRefresh.rows.map((row) => row.playerId),
    ...input.freeAgentUnknownPolicyReview.rows.map((row) => row.playerId),
  ]);
  const rows = [...playerIds].map((playerId) => finalRow(baseByPlayerId.get(playerId) ?? null, h28ByPlayerId.get(playerId) ?? null, h29ByPlayerId.get(playerId) ?? null));
  const zeroChecks = zeroChecksFor(input);
  const remainingBlockers = buildRemainingBlockers(rows);
  const v82ControlledFlagImpact = buildV82Impact(rows, zeroChecks);
  const manualReviewSummary = buildManualReviewSummary(rows);
  const sourceExpansionRecommendations = buildSourceExpansionRecommendations(remainingBlockers);
  const safetyGates = buildSafetyGates(rows, remainingBlockers, zeroChecks, input);
  const recommendation = recommendationFor(safetyGates, remainingBlockers);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? sourceArtifactsFor(input),
    sourceMissing: false,
    policyCounts: {
      h21PolicyCounts: input.activeUniversePolicyPacket.policyCounts.byClassification,
      h28ScopedPolicyCounts: input.sleeperPolicyRefresh.policyCounts.h28After,
      h29ScopedPolicyCounts: input.freeAgentUnknownPolicyReview.summary.byPolicyClass,
      h30FinalPolicyCounts: countByFixed(rows, FINAL_CLASSES, (row) => row.finalPolicyClass),
    },
    remainingBlockers,
    v82ControlledFlagImpact,
    manualReviewSummary,
    sourceExpansionRecommendations,
    rows,
    safetyGates,
    recommendation,
    notes: [
      "H30 is a dry-run/read-only final policy refresh packet.",
      "Policy layers are applied in order: H21 conservative policy, H28 Sleeper metadata refresh, H29 free-agent/unknown policy review.",
      "Free-agent/unknown rows are not promoted to active candidates.",
      "No live projection, rank, suggestion, War Room scoring, Supabase, or v8.2 behavior is changed.",
    ],
  };
}

export function writeProjectionActivePolicyRefreshFinalArtifacts(report: ProjectionActivePolicyRefreshFinalReport): ProjectionActivePolicyRefreshFinalArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-active-policy-refresh-final-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function finalRow(
  baseRow: ProjectionActiveUniversePolicyPacketRow | null,
  h28Row: ProjectionSleeperPolicyRefreshRow | null,
  h29Row: ProjectionFreeAgentUnknownPolicyRow | null,
): ProjectionActivePolicyRefreshFinalRow {
  const finalPolicyClass = h29Row ? finalClassForH29(h29Row.policyClass) : h28Row ? finalClassForH28(h28Row.refreshedPolicyClassification) : finalClassForH21(baseRow?.policyClassification ?? "policy_source_expansion_required");
  const appliedLayer = h29Row ? "h29_free_agent_unknown_policy_review" : h28Row ? "h28_sleeper_metadata_policy_refresh" : "h21_conservative_policy";
  const reasonCodes = reasonCodesFor(baseRow, h28Row, h29Row, finalPolicyClass);
  return {
    playerId: h29Row?.playerId ?? h28Row?.playerId ?? baseRow?.playerId ?? "missing_player_id",
    sleeperId: h29Row?.sleeperId ?? h28Row?.sleeperId ?? null,
    player: h29Row?.player ?? h28Row?.player ?? baseRow?.player ?? "Unknown Player",
    position: h29Row?.position ?? h28Row?.position ?? baseRow?.position ?? "UNK",
    projectionTeam: h29Row?.projectionTeam ?? h28Row?.projectionTeam ?? baseRow?.projectionTeam ?? null,
    basePolicyClassification: baseRow?.policyClassification ?? null,
    h28PolicyClassification: h28Row?.refreshedPolicyClassification ?? null,
    h29PolicyClass: h29Row?.policyClass ?? null,
    finalPolicyClass,
    appliedLayer,
    reasonCodes,
    v82SafeSubset: isV82Safe(baseRow, h28Row, h29Row),
    policyGroup: baseRow?.policyGroup ?? h28Row?.h27Row.h26Row.h21PolicyGroup ?? null,
    projectedTotalPointDelta: h29Row?.projectedTotalPointDelta ?? h28Row?.projectedTotalPointDelta ?? baseRow?.projectedTotalPointDelta ?? null,
    estimatedOverallRankMovement: h29Row?.estimatedOverallRankMovement ?? h28Row?.estimatedOverallRankMovement ?? baseRow?.estimatedOverallRankMovement ?? null,
    baseRow,
    h28Row,
    h29Row,
  };
}

function finalClassForH21(policy: ProjectionActiveUniversePolicyClassification): ProjectionActivePolicyRefreshFinalClass {
  if (policy === "policy_active_candidate") return "final_policy_active_candidate";
  if (policy === "policy_shadow_only") return "final_policy_shadow_only";
  if (policy === "policy_current_path_only") return "final_policy_current_path_only";
  if (policy === "policy_manual_review") return "final_policy_manual_review";
  if (policy === "policy_kicker_review_required") return "final_policy_kicker_review_required";
  if (policy === "policy_blocked_archive") return "final_policy_blocked_archive";
  return "final_policy_source_expansion_required";
}

function finalClassForH28(policy: ProjectionSleeperPolicyRefreshClassification): ProjectionActivePolicyRefreshFinalClass {
  if (policy === "policy_active_candidate_preview") return "final_policy_active_candidate";
  return finalClassForH21(policy);
}

function finalClassForH29(policy: ProjectionFreeAgentUnknownPolicyClass): ProjectionActivePolicyRefreshFinalClass {
  if (policy === "free_agent_unknown_shadow_only") return "final_policy_shadow_only";
  if (policy === "free_agent_unknown_current_path_only") return "final_policy_current_path_only";
  if (policy === "free_agent_unknown_manual_review") return "final_policy_manual_review";
  if (policy === "free_agent_unknown_blocked_archive") return "final_policy_blocked_archive";
  return "final_policy_source_expansion_required";
}

function reasonCodesFor(
  baseRow: ProjectionActiveUniversePolicyPacketRow | null,
  h28Row: ProjectionSleeperPolicyRefreshRow | null,
  h29Row: ProjectionFreeAgentUnknownPolicyRow | null,
  finalPolicyClass: ProjectionActivePolicyRefreshFinalClass,
): ProjectionActivePolicyRefreshFinalReasonCode[] {
  const codes = new Set<ProjectionActivePolicyRefreshFinalReasonCode>();
  if (baseRow) codes.add(reasonForH21(baseRow.policyClassification));
  if (h28Row) codes.add(reasonForH28(h28Row.refreshedPolicyClassification, h28Row.resolutionStatus));
  if (h29Row) codes.add(reasonForH29(h29Row.policyClass));
  if (finalPolicyClass === "final_policy_source_expansion_required") codes.add("h21_source_expansion_preserved");
  if (isV82Safe(baseRow, h28Row, h29Row)) codes.add("v8_2_safe_subset_preserved");
  return [...codes];
}

function reasonForH21(policy: ProjectionActiveUniversePolicyClassification): ProjectionActivePolicyRefreshFinalReasonCode {
  if (policy === "policy_active_candidate") return "h21_confirmed_active_candidate";
  if (policy === "policy_shadow_only") return "h21_shadow_only_preserved";
  if (policy === "policy_current_path_only") return "h21_current_path_preserved";
  if (policy === "policy_manual_review") return "h21_manual_review_preserved";
  if (policy === "policy_kicker_review_required") return "h21_kicker_review_preserved";
  if (policy === "policy_blocked_archive") return "h21_legacy_blocked_preserved";
  return "h21_source_expansion_preserved";
}

function reasonForH28(policy: ProjectionSleeperPolicyRefreshClassification, status: string): ProjectionActivePolicyRefreshFinalReasonCode {
  if (policy === "policy_active_candidate_preview") return "h28_sleeper_active_plausible_promoted_preview";
  if (status === "sleeper_metadata_inactive_or_stale") return "h28_inactive_stale_held_shadow";
  if (status === "sleeper_metadata_position_conflict") return "h28_position_conflict_manual_review";
  return "h28_source_expansion_preserved";
}

function reasonForH29(policy: ProjectionFreeAgentUnknownPolicyClass): ProjectionActivePolicyRefreshFinalReasonCode {
  if (policy === "free_agent_unknown_shadow_only") return "h29_free_agent_shadow_only";
  if (policy === "free_agent_unknown_current_path_only") return "h29_free_agent_current_path_only";
  if (policy === "free_agent_unknown_manual_review") return "h29_free_agent_manual_review";
  if (policy === "free_agent_unknown_blocked_archive") return "h29_free_agent_blocked_archive";
  return "h29_free_agent_source_expansion_required";
}

function isV82Safe(baseRow: ProjectionActiveUniversePolicyPacketRow | null, h28Row: ProjectionSleeperPolicyRefreshRow | null, h29Row: ProjectionFreeAgentUnknownPolicyRow | null) {
  if (h29Row) return h29Row.v82SafeSubsetStatus === "v82_safe_subset";
  if (h28Row) return h28Row.v82SafeSubsetStatus === "v82_safe_subset";
  return baseRow?.v82Path === "would_use_v8_2_safe_subset";
}

function buildRemainingBlockers(rows: ProjectionActivePolicyRefreshFinalRow[]): ProjectionActivePolicyRefreshFinalReport["remainingBlockers"] {
  return {
    manualReviewRows: rows.filter((row) => row.finalPolicyClass === "final_policy_manual_review").length,
    kickerPolicyRows: rows.filter((row) => row.finalPolicyClass === "final_policy_kicker_review_required").length,
    positionConflictRows: rows.filter((row) => row.reasonCodes.includes("h28_position_conflict_manual_review")).length,
    inactiveStaleHeldBack: rows.filter((row) => row.reasonCodes.includes("h28_inactive_stale_held_shadow")).length,
    remainingSourceExpansionRows: rows.filter((row) => row.finalPolicyClass === "final_policy_source_expansion_required").length,
    blockedArchiveRows: rows.filter((row) => row.finalPolicyClass === "final_policy_blocked_archive").length,
    freeAgentUnknownHighImportanceManualReviewRows: rows.filter((row) => row.reasonCodes.includes("h29_free_agent_manual_review")).length,
    rosterConflictRows: rows.filter((row) => row.policyGroup === "conflict_review").length,
    currentPathManualRows: rows.filter((row) => row.policyGroup === "manual_review_remaining").length,
  };
}

function buildV82Impact(
  rows: ProjectionActivePolicyRefreshFinalRow[],
  zeroChecks: ProjectionActivePolicyRefreshFinalReport["v82ControlledFlagImpact"]["protectedZeroChecks"],
): ProjectionActivePolicyRefreshFinalReport["v82ControlledFlagImpact"] {
  const safeRows = rows.filter((row) => row.v82SafeSubset);
  const blockedRows = safeRows.filter((row) => row.finalPolicyClass !== "final_policy_active_candidate");
  return {
    safeV82RowsAllowedByFinalPolicy: safeRows.filter((row) => row.finalPolicyClass === "final_policy_active_candidate").length,
    safeV82RowsHeldShadowOnly: safeRows.filter((row) => row.finalPolicyClass === "final_policy_shadow_only").length,
    safeV82RowsHeldCurrentPathOnly: safeRows.filter((row) => row.finalPolicyClass === "final_policy_current_path_only").length,
    safeV82RowsHeldManualReview: safeRows.filter((row) => row.finalPolicyClass === "final_policy_manual_review").length,
    safeV82RowsStillSourceExpansionRequired: safeRows.filter((row) => row.finalPolicyClass === "final_policy_source_expansion_required").length,
    safeV82RowsBlockedArchive: safeRows.filter((row) => row.finalPolicyClass === "final_policy_blocked_archive").length,
    safeV82RowsKickerReviewRequired: safeRows.filter((row) => row.finalPolicyClass === "final_policy_kicker_review_required").length,
    controlledFlagReviewRemainsBlocked: blockedRows.length > 0 || !Object.values(zeroChecks).every(Boolean),
    protectedZeroChecks: zeroChecks,
  };
}

function buildManualReviewSummary(rows: ProjectionActivePolicyRefreshFinalRow[]): ProjectionActivePolicyRefreshFinalReport["manualReviewSummary"] {
  const manualRows = rows.filter((row) => row.finalPolicyClass === "final_policy_manual_review");
  return {
    freeAgentUnknownHighImportanceRows: topRows(manualRows.filter((row) => row.reasonCodes.includes("h29_free_agent_manual_review")), 50),
    positionConflictRows: topRows(manualRows.filter((row) => row.reasonCodes.includes("h28_position_conflict_manual_review")), 50),
    rosterConflictRows: topRows(manualRows.filter((row) => row.policyGroup === "conflict_review"), 50),
    currentPathManualRows: topRows(manualRows.filter((row) => row.policyGroup === "manual_review_remaining"), 50),
    otherManualRows: topRows(manualRows.filter((row) =>
      !row.reasonCodes.includes("h29_free_agent_manual_review")
      && !row.reasonCodes.includes("h28_position_conflict_manual_review")
      && row.policyGroup !== "conflict_review"
      && row.policyGroup !== "manual_review_remaining"
    ), 50),
  };
}

function buildSourceExpansionRecommendations(blockers: ProjectionActivePolicyRefreshFinalReport["remainingBlockers"]) {
  return [
    { sourceNeed: "manual_high_importance_free_agent_review" as const, rowsAffected: blockers.freeAgentUnknownHighImportanceManualReviewRows, rationale: "High-importance free-agent/unknown rows remain manual review before controlled v8.2 review." },
    { sourceNeed: "kicker_policy" as const, rowsAffected: blockers.kickerPolicyRows, rationale: "Kicker rows remain held until kicker-specific policy and source coverage exist." },
    { sourceNeed: "position_conflict_manual_review" as const, rowsAffected: blockers.positionConflictRows, rationale: "Position conflicts require manual validation before active policy promotion." },
    { sourceNeed: "transaction_status_source" as const, rowsAffected: blockers.inactiveStaleHeldBack, rationale: "Inactive/stale rows need transaction or status evidence." },
    { sourceNeed: "depth_chart_source" as const, rowsAffected: blockers.remainingSourceExpansionRows, rationale: "Remaining source-expansion rows need depth chart or equivalent active-universe evidence." },
  ].filter((row) => row.rowsAffected > 0).sort((a, b) => b.rowsAffected - a.rowsAffected || a.sourceNeed.localeCompare(b.sourceNeed));
}

function buildSafetyGates(
  rows: ProjectionActivePolicyRefreshFinalRow[],
  blockers: ProjectionActivePolicyRefreshFinalReport["remainingBlockers"],
  zeroChecks: ProjectionActivePolicyRefreshFinalReport["v82ControlledFlagImpact"]["protectedZeroChecks"],
  input: ProjectionActivePolicyRefreshFinalInput,
) {
  const freeAgentPromoted = rows.filter((row) => row.h29Row && row.finalPolicyClass === "final_policy_active_candidate");
  const kickerPromoted = rows.filter((row) => row.baseRow?.policyClassification === "policy_kicker_review_required" && row.finalPolicyClass === "final_policy_active_candidate");
  const legacyNotBlocked = rows.filter((row) => row.baseRow?.policyClassification === "policy_blocked_archive" && row.finalPolicyClass !== "final_policy_blocked_archive");
  return [
    gate("required_sources_present", Boolean(input.activeUniversePolicyPacket && input.sleeperPolicyRefresh && input.freeAgentUnknownPolicyReview), "H21, H28, and H29 artifacts are required."),
    gate("no_live_outputs_changed", true, "Report reads artifacts and writes only local H30 artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Blackbird Rank ordering is not imported, recalculated, or mutated."),
    gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported, recalculated, or mutated."),
    gate("war_room_scoring_unchanged", true, "War Room scoring behavior is not imported, recalculated, or mutated."),
    gate("v8_2_not_enabled", true, "v8.2 feature flag and projection selector behavior are not changed."),
    gate("free_agent_unknown_not_auto_promoted", freeAgentPromoted.length === 0, `${freeAgentPromoted.length} free-agent/unknown rows promoted.`),
    gate("kicker_rows_not_auto_promoted", kickerPromoted.length === 0, `${kickerPromoted.length} kicker rows promoted.`),
    gate("legacy_rows_blocked", legacyNotBlocked.length === 0, `${legacyNotBlocked.length} legacy rows not blocked/archive.`),
    gate("manual_review_rows_reported", blockers.manualReviewRows > 0, `${blockers.manualReviewRows} manual review rows reported.`),
    gate("zero_checks_preserved", Object.values(zeroChecks).every(Boolean), "K, critical mover, meaningful rank mover, and legacy v8.2 zero checks remain zero."),
  ];
}

function recommendationFor(
  safetyGates: ProjectionActivePolicyRefreshFinalReport["safetyGates"],
  blockers: ProjectionActivePolicyRefreshFinalReport["remainingBlockers"],
): ProjectionActivePolicyRefreshFinalRecommendation {
  if (safetyGates.some((gateRow) => !gateRow.passed)) return "active_policy_final_blocked";
  if (blockers.manualReviewRows > 0) return "active_policy_final_needs_manual_review";
  if (blockers.kickerPolicyRows > 0) return "active_policy_final_needs_kicker_policy";
  return "active_policy_final_ready_for_controlled_flag_review";
}

function sourceMissingReport(input: ProjectionActivePolicyRefreshFinalInput): ProjectionActivePolicyRefreshFinalReport {
  const zeroChecks = zeroChecksFor(input);
  const emptyFinalCounts = Object.fromEntries(FINAL_CLASSES.map((policyClass) => [policyClass, 0])) as Record<ProjectionActivePolicyRefreshFinalClass, number>;
  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? sourceArtifactsFor(input),
    sourceMissing: true,
    policyCounts: {
      h21PolicyCounts: Object.fromEntries(H21_CLASSES.map((policyClass) => [policyClass, 0])) as Record<ProjectionActiveUniversePolicyClassification, number>,
      h28ScopedPolicyCounts: Object.fromEntries(H28_CLASSES.map((policyClass) => [policyClass, 0])) as Record<ProjectionSleeperPolicyRefreshClassification, number>,
      h29ScopedPolicyCounts: Object.fromEntries(H29_CLASSES.map((policyClass) => [policyClass, 0])) as Record<ProjectionFreeAgentUnknownPolicyClass, number>,
      h30FinalPolicyCounts: emptyFinalCounts,
    },
    remainingBlockers: { manualReviewRows: 0, kickerPolicyRows: 0, positionConflictRows: 0, inactiveStaleHeldBack: 0, remainingSourceExpansionRows: 0, blockedArchiveRows: 0, freeAgentUnknownHighImportanceManualReviewRows: 0, rosterConflictRows: 0, currentPathManualRows: 0 },
    v82ControlledFlagImpact: { safeV82RowsAllowedByFinalPolicy: 0, safeV82RowsHeldShadowOnly: 0, safeV82RowsHeldCurrentPathOnly: 0, safeV82RowsHeldManualReview: 0, safeV82RowsStillSourceExpansionRequired: 0, safeV82RowsBlockedArchive: 0, safeV82RowsKickerReviewRequired: 0, controlledFlagReviewRemainsBlocked: true, protectedZeroChecks: zeroChecks },
    manualReviewSummary: { freeAgentUnknownHighImportanceRows: [], positionConflictRows: [], rosterConflictRows: [], currentPathManualRows: [], otherManualRows: [] },
    sourceExpansionRecommendations: [],
    rows: [],
    safetyGates: [gate("required_sources_present", false, "H21, H28, and H29 artifacts are required.")],
    recommendation: "active_policy_final_blocked",
    notes: ["H30 could not run because required source artifacts are missing."],
  };
}

function zeroChecksFor(input: ProjectionActivePolicyRefreshFinalInput) {
  const fromPacket = input.featureFlagReviewPacket?.safetySummary;
  const fromH29 = input.freeAgentUnknownPolicyReview?.v82Impact.protectedZeroChecks;
  const fromH28 = input.sleeperPolicyRefresh?.v82SafeSubsetImpact.protectedZeroChecks;
  return {
    kRowsUsingV82: fromH29?.kRowsUsingV82 ?? fromH28?.kRowsUsingV82 ?? (fromPacket?.kRowsUsingV82 ?? 0) === 0,
    criticalMoversUsingV82: fromH29?.criticalMoversUsingV82 ?? fromH28?.criticalMoversUsingV82 ?? (fromPacket?.criticalMoversUsingV82 ?? 0) === 0,
    meaningfulRankMoversUsingV82: fromH29?.meaningfulRankMoversUsingV82 ?? fromH28?.meaningfulRankMoversUsingV82 ?? (fromPacket?.meaningfulRankMoversUsingV82 ?? 0) === 0,
    legacyRowsUsingV82: fromH29?.legacyRowsUsingV82 ?? fromH28?.legacyRowsUsingV82 ?? (fromPacket?.legacyRowsUsingV82 ?? 0) === 0,
  };
}

function sourceArtifactsFor(input: ProjectionActivePolicyRefreshFinalInput): ProjectionActivePolicyRefreshFinalReport["sourceArtifacts"] {
  return {
    activeUniversePolicyPacket: input.activeUniversePolicyPacket ? "in-memory" : "missing",
    sleeperPolicyRefresh: input.sleeperPolicyRefresh ? "in-memory" : "missing",
    freeAgentUnknownPolicyReview: input.freeAgentUnknownPolicyReview ? "in-memory" : "missing",
    sleeperMetadataResolution: input.sleeperMetadataResolution ? "in-memory" : "missing",
    rosterRefreshPolicyReview: input.rosterRefreshPolicyReview ? "in-memory" : "missing",
    featureFlagReviewPacket: input.featureFlagReviewPacket ? "in-memory" : "missing",
    preseasonProjectionSnapshot: input.preseasonProjectionSnapshot ? "in-memory" : "missing",
  };
}

function renderMarkdown(report: ProjectionActivePolicyRefreshFinalReport) {
  return `# Projection Active Policy Refresh Final ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Recommendation: ${report.recommendation}

## Policy Counts

\`\`\`json
${JSON.stringify(report.policyCounts, null, 2)}
\`\`\`

## Remaining Blockers

\`\`\`json
${JSON.stringify(report.remainingBlockers, null, 2)}
\`\`\`

## v8.2 Controlled Flag Impact

\`\`\`json
${JSON.stringify(report.v82ControlledFlagImpact, null, 2)}
\`\`\`

## Source Expansion Recommendations

${report.sourceExpansionRecommendations.map((row) => `- ${row.sourceNeed}: ${row.rowsAffected} rows. ${row.rationale}`).join("\n")}

## Manual Review Summary

### Free-Agent/Unknown High Importance

${renderRows(report.manualReviewSummary.freeAgentUnknownHighImportanceRows)}

### Position Conflicts

${renderRows(report.manualReviewSummary.positionConflictRows)}

### Roster Conflicts

${renderRows(report.manualReviewSummary.rosterConflictRows)}

### Current-Path Manual Rows

${renderRows(report.manualReviewSummary.currentPathManualRows)}

### Other Manual Rows

${renderRows(report.manualReviewSummary.otherManualRows)}

## Safety Gates

${renderGateTable(report.safetyGates)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderRows(rows: ProjectionActivePolicyRefreshFinalRow[]) {
  if (!rows.length) return "No rows.";
  return [
    "| Player | Pos | Team | Final Policy | Layer | Points Delta | Rank Movement | Reasons |",
    "|---|---|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.projectionTeam ?? ""} | ${row.finalPolicyClass} | ${row.appliedLayer} | ${row.projectedTotalPointDelta ?? ""} | ${row.estimatedOverallRankMovement ?? ""} | ${row.reasonCodes.join(" ")} |`),
  ].join("\n");
}

function renderGateTable(gates: ProjectionActivePolicyRefreshFinalReport["safetyGates"]) {
  return [
    "| Gate | Status | Detail |",
    "|---|---|---|",
    ...gates.map((gateRow) => `| ${gateRow.name} | ${gateRow.passed ? "PASS" : "FAIL"} | ${gateRow.detail} |`),
  ].join("\n");
}

function renderCsv(report: ProjectionActivePolicyRefreshFinalReport) {
  const headers = ["player_id", "sleeper_id", "player", "position", "projection_team", "base_policy", "h28_policy", "h29_policy", "final_policy", "applied_layer", "policy_group", "v82_safe_subset", "projected_total_point_delta", "estimated_overall_rank_movement", "reason_codes"];
  const rows = report.rows.map((row) => [
    row.playerId,
    row.sleeperId ?? "",
    row.player,
    row.position,
    row.projectionTeam ?? "",
    row.basePolicyClassification ?? "",
    row.h28PolicyClassification ?? "",
    row.h29PolicyClass ?? "",
    row.finalPolicyClass,
    row.appliedLayer,
    row.policyGroup ?? "",
    row.v82SafeSubset,
    row.projectedTotalPointDelta ?? "",
    row.estimatedOverallRankMovement ?? "",
    row.reasonCodes.join("|"),
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function topRows(rows: ProjectionActivePolicyRefreshFinalRow[], limit: number) {
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

function mapBy<T>(rows: T[], keyFor: (row: T) => string) {
  const mapped = new Map<string, T>();
  for (const row of rows) mapped.set(keyFor(row), row);
  return mapped;
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
