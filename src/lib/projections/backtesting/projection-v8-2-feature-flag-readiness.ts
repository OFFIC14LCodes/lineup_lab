import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { PreseasonProjectionSnapshot } from "./preseason-projection-snapshot-types";
import type { ProjectionLimitedPromotionPoolReviewReport } from "./projection-limited-promotion-pool-review-types";
import type { ProjectionPromotionReadinessFinalReport, ProjectionPromotionReadinessFinalRow } from "./projection-promotion-readiness-final-types";
import type { ProjectionRankImpactTierDecisionReport, ProjectionRankImpactTierResolvedDecisionRow } from "./projection-rank-impact-tier-decisions-types";
import type { ProjectionRankImpactTierReviewReport } from "./projection-rank-impact-tier-review-types";
import type { ProjectionUniverseEligibilityAuditReport } from "./projection-universe-eligibility-audit-types";
import type {
  ProjectionV82FeatureFlagCandidateStatus,
  ProjectionV82FeatureFlagImpactSummary,
  ProjectionV82FeatureFlagProtectionReason,
  ProjectionV82FeatureFlagReadinessArtifactPaths,
  ProjectionV82FeatureFlagReadinessOptions,
  ProjectionV82FeatureFlagReadinessRecommendation,
  ProjectionV82FeatureFlagReadinessReport,
  ProjectionV82FeatureFlagReadinessRow,
} from "./projection-v8-2-feature-flag-readiness-types";
import type { ProjectionV82ShadowReport, ProjectionV82ShadowRow } from "./projection-v8-2-shadow-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const PROTECTION_REASONS: ProjectionV82FeatureFlagProtectionReason[] = [
  "eligible_for_flag_candidate",
  "critical_movement_protected",
  "kicker_policy_protected",
  "tier_review_protected",
  "qb_superflex_protected",
  "injury_role_protected",
  "model_policy_protected",
  "shadow_only",
  "blocked_legacy",
  "blocked_other",
  "manual_review_remaining",
  "unresolved_tier_decision",
  "missing_readiness_row",
];

export function runProjectionV82FeatureFlagReadiness(options: ProjectionV82FeatureFlagReadinessOptions): ProjectionV82FeatureFlagReadinessReport {
  const finalReadinessPath = path.join(OUTPUT_DIR, `projection-promotion-readiness-final-${options.projectionSeason}.json`);
  const conservativePromotionPath = path.join(OUTPUT_DIR, `projection-promotion-review-decisions-${options.projectionSeason}.conservative.csv`);
  const conservativeTierPath = path.join(OUTPUT_DIR, `projection-rank-impact-tier-decisions-${options.projectionSeason}.conservative.csv`);
  const resolvedTierPath = path.join(OUTPUT_DIR, `projection-rank-impact-tier-decisions-${options.projectionSeason}.resolved.json`);
  const tierReviewPath = path.join(OUTPUT_DIR, `projection-rank-impact-tier-review-${options.projectionSeason}.json`);
  const limitedPoolPath = path.join(OUTPUT_DIR, `projection-limited-promotion-pool-review-${options.projectionSeason}.json`);
  const shadowPath = path.join(OUTPUT_DIR, `projection-v8-2-shadow-${options.projectionSeason}.json`);
  const universePath = path.join(OUTPUT_DIR, `projection-universe-eligibility-audit-${options.projectionSeason}.json`);
  const snapshotPath = path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`);
  for (const artifactPath of [finalReadinessPath, conservativePromotionPath, conservativeTierPath, resolvedTierPath, tierReviewPath, limitedPoolPath, shadowPath, universePath, snapshotPath]) {
    if (!existsSync(artifactPath)) throw new Error(`Missing ${path.relative(process.cwd(), artifactPath)}.`);
  }

  return buildProjectionV82FeatureFlagReadinessFromData({
    options,
    finalReadiness: JSON.parse(readFileSync(finalReadinessPath, "utf8")) as ProjectionPromotionReadinessFinalReport,
    resolvedTierDecisions: JSON.parse(readFileSync(resolvedTierPath, "utf8")) as ProjectionRankImpactTierDecisionReport,
    tierReview: JSON.parse(readFileSync(tierReviewPath, "utf8")) as ProjectionRankImpactTierReviewReport,
    limitedPool: JSON.parse(readFileSync(limitedPoolPath, "utf8")) as ProjectionLimitedPromotionPoolReviewReport,
    shadow: JSON.parse(readFileSync(shadowPath, "utf8")) as ProjectionV82ShadowReport,
    universe: JSON.parse(readFileSync(universePath, "utf8")) as ProjectionUniverseEligibilityAuditReport,
    snapshot: JSON.parse(readFileSync(snapshotPath, "utf8")) as PreseasonProjectionSnapshot,
    sourceArtifacts: {
      finalReadiness: finalReadinessPath,
      conservativePromotionDecisions: conservativePromotionPath,
      conservativeTierDecisions: conservativeTierPath,
      resolvedTierDecisions: resolvedTierPath,
      tierReview: tierReviewPath,
      limitedPromotionPoolReview: limitedPoolPath,
      shadow: shadowPath,
      universeEligibilityAudit: universePath,
      snapshot: snapshotPath,
    },
  });
}

export function buildProjectionV82FeatureFlagReadinessFromData(input: {
  options: ProjectionV82FeatureFlagReadinessOptions;
  finalReadiness: ProjectionPromotionReadinessFinalReport;
  resolvedTierDecisions: ProjectionRankImpactTierDecisionReport;
  tierReview: ProjectionRankImpactTierReviewReport;
  limitedPool: ProjectionLimitedPromotionPoolReviewReport;
  shadow: ProjectionV82ShadowReport;
  universe: ProjectionUniverseEligibilityAuditReport;
  snapshot: PreseasonProjectionSnapshot;
  sourceArtifacts?: ProjectionV82FeatureFlagReadinessReport["sourceArtifacts"];
}): ProjectionV82FeatureFlagReadinessReport {
  void input.limitedPool;
  void input.universe;
  void input.snapshot;
  const finalById = new Map(input.finalReadiness.finalRows.map((row) => [row.playerId, row]));
  const tierById = new Map(input.resolvedTierDecisions.resolvedRows.map((row) => [row.playerId, row]));
  const tierReviewIds = new Set(input.tierReview.rows.map((row) => row.playerId));
  const rows = input.shadow.rows.map((shadowRow) => featureFlagRow(shadowRow, finalById.get(shadowRow.playerId) ?? null, tierById.get(shadowRow.playerId) ?? null, tierReviewIds));
  const summary = buildSummary(rows, input.finalReadiness, input.resolvedTierDecisions);
  const impactSummary = buildImpactSummary(rows.filter((row) => row.status === "would_use_v8_2_under_flag"), input.shadow);
  const currentPathProtectionSummary = buildProtectionSummary(rows.filter((row) => row.status === "would_use_current_path_under_flag" || row.status === "excluded_from_flag_pool" || row.status === "blocked_from_flag_pool"));
  const safetyGates = buildSafetyGates(summary, impactSummary);
  const recommendation = recommendationFor(safetyGates);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? {
      finalReadiness: "in-memory",
      conservativePromotionDecisions: "in-memory",
      conservativeTierDecisions: "in-memory",
      resolvedTierDecisions: "in-memory",
      tierReview: "in-memory",
      limitedPromotionPoolReview: "in-memory",
      shadow: "in-memory",
      universeEligibilityAudit: "in-memory",
      snapshot: "in-memory",
    },
    rows,
    summary,
    impactSummary,
    currentPathProtectionSummary,
    safetyGates,
    recommendation,
    notes: [
      "Dry-run/read-only disabled feature-flag readiness review only.",
      "No runtime feature flag is created or enabled by this report.",
      "Rows protected by conservative promotion or tier decisions remain on the current path in this simulation.",
      "No live projections, 2026 production outputs, Supabase writes, Blackbird Rank, Draft Suggestion ordering, War Room UI, or v8.2 promotion paths are changed.",
    ],
  };
}

export function writeProjectionV82FeatureFlagReadinessArtifacts(report: ProjectionV82FeatureFlagReadinessReport): ProjectionV82FeatureFlagReadinessArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-v8-2-feature-flag-readiness-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

export function featureFlagRow(
  shadowRow: ProjectionV82ShadowRow,
  finalRow: ProjectionPromotionReadinessFinalRow | null,
  tierDecision: ProjectionRankImpactTierResolvedDecisionRow | null,
  tierReviewIds: Set<string>,
): ProjectionV82FeatureFlagReadinessRow {
  const protectionReasons: ProjectionV82FeatureFlagProtectionReason[] = [];
  const meaningfulRankMover = tierReviewIds.has(shadowRow.playerId);
  let status: ProjectionV82FeatureFlagCandidateStatus = "excluded_from_flag_pool";

  if (!finalRow) {
    status = "excluded_from_flag_pool";
    protectionReasons.push("missing_readiness_row");
  } else if (finalRow.finalClassification === "blocked_from_promotion") {
    status = "blocked_from_flag_pool";
    protectionReasons.push(finalRow.universeEligibilityStatus === "retired_or_legacy_suspect" ? "blocked_legacy" : "blocked_other");
  } else if (tierDecision?.resolvedTierStatus === "tier_current_path") {
    status = "would_use_current_path_under_flag";
    protectionReasons.push("tier_review_protected");
    if (tierDecision.rankImpactFlags.includes("qb_superflex_sensitive_movement")) protectionReasons.push("qb_superflex_protected");
    if (tierDecision.recommendedTierReviewAction === "needs_injury_role_review") protectionReasons.push("injury_role_protected");
    if (tierDecision.recommendedTierReviewAction === "needs_model_policy_review") protectionReasons.push("model_policy_protected");
  } else if (tierDecision?.resolvedTierStatus === "tier_unresolved") {
    status = "excluded_from_flag_pool";
    protectionReasons.push("unresolved_tier_decision");
  } else if (finalRow.position === "K") {
    status = "would_use_current_path_under_flag";
    protectionReasons.push("kicker_policy_protected");
  } else if (finalRow.criticalMovement || finalRow.decision === "use_current_path_for_now") {
    status = "would_use_current_path_under_flag";
    protectionReasons.push("critical_movement_protected");
  } else if (finalRow.finalClassification === "manual_review_before_promotion") {
    status = "excluded_from_flag_pool";
    protectionReasons.push("manual_review_remaining");
  } else if (finalRow.finalClassification === "shadow_only") {
    status = "excluded_from_flag_pool";
    protectionReasons.push("shadow_only");
  } else if (finalRow.finalClassification === "eligible_for_projection_promotion") {
    status = "would_use_v8_2_under_flag";
    protectionReasons.push("eligible_for_flag_candidate");
  }

  return {
    playerId: shadowRow.playerId,
    player: shadowRow.player,
    position: shadowRow.position,
    team: shadowRow.team,
    status,
    protectionReasons: [...new Set(protectionReasons)],
    universeEligibilityStatus: finalRow?.universeEligibilityStatus ?? null,
    finalClassification: finalRow?.finalClassification ?? null,
    currentExpectedGames: shadowRow.currentExpectedGames,
    v82ExpectedGames: shadowRow.v82ExpectedGames,
    gamesDelta: shadowRow.expectedGamesDelta,
    currentProjectedTotal: shadowRow.currentProjectedTotal,
    v82ProjectedTotal: shadowRow.shadowProjectedTotal,
    projectedPointDelta: shadowRow.projectedTotalPointDelta,
    movementBucket: shadowRow.movementBucket,
    criticalMovement: finalRow?.criticalMovement ?? shadowRow.risk === "critical",
    meaningfulRankMover,
    riskFlags: [...new Set([...(finalRow?.riskFlags ?? []), ...shadowRow.riskFlags])],
    reasonCodes: [...new Set([...(finalRow?.reasonCodes ?? []), ...shadowRow.reasonCodes])],
  };
}

function buildSummary(
  rows: ProjectionV82FeatureFlagReadinessRow[],
  finalReadiness: ProjectionPromotionReadinessFinalReport,
  tierDecisions: ProjectionRankImpactTierDecisionReport,
): ProjectionV82FeatureFlagReadinessReport["summary"] {
  return {
    totalRows: rows.length,
    wouldUseV82UnderFlag: rows.filter((row) => row.status === "would_use_v8_2_under_flag").length,
    wouldUseCurrentPathUnderFlag: rows.filter((row) => row.status === "would_use_current_path_under_flag").length,
    excludedFromFlagPool: rows.filter((row) => row.status === "excluded_from_flag_pool").length,
    blockedFromFlagPool: rows.filter((row) => row.status === "blocked_from_flag_pool").length,
    manualReviewRowsRemaining: finalReadiness.summary.manualReviewRowsRemaining,
    unresolvedRowsRemaining: finalReadiness.summary.unresolvedRows + tierDecisions.summary.resolvedTierStatusCounts.tier_unresolved,
    kRowsUsingV82: rows.filter((row) => row.position === "K" && row.status === "would_use_v8_2_under_flag").length,
    criticalMovementRowsUsingV82: rows.filter((row) => row.criticalMovement && row.status === "would_use_v8_2_under_flag").length,
    meaningfulRankMoversUsingV82: rows.filter((row) => row.meaningfulRankMover && row.status === "would_use_v8_2_under_flag").length,
    legacyRowsUsingV82: rows.filter((row) => row.universeEligibilityStatus === "retired_or_legacy_suspect" && row.status === "would_use_v8_2_under_flag").length,
  };
}

function buildImpactSummary(rows: ProjectionV82FeatureFlagReadinessRow[], shadow: ProjectionV82ShadowReport): ProjectionV82FeatureFlagImpactSummary {
  void shadow;
  return {
    rows: rows.length,
    averageProjectedPointDelta: average(rows.map((row) => row.projectedPointDelta)),
    medianProjectedPointDelta: median(rows.map((row) => row.projectedPointDelta)),
    maxProjectedPointDelta: maxAbs(rows.map((row) => row.projectedPointDelta)),
    movementBuckets: countBy(rows, (row) => row.movementBucket),
    positionSummary: segmentSummary(rows, (row) => row.position).map(([position, segmentRows]) => ({
      position,
      rows: segmentRows.length,
      averageProjectedPointDelta: average(segmentRows.map((row) => row.projectedPointDelta)),
      maxProjectedPointDelta: maxAbs(segmentRows.map((row) => row.projectedPointDelta)),
    })),
    cohortSummary: segmentSummary(rows, (row) => row.riskFlags.length ? row.riskFlags[0] : "none").map(([cohort, segmentRows]) => ({
      cohort,
      rows: segmentRows.length,
      averageProjectedPointDelta: average(segmentRows.map((row) => row.projectedPointDelta)),
      maxProjectedPointDelta: maxAbs(segmentRows.map((row) => row.projectedPointDelta)),
    })),
    topMovements: [...rows].sort((a, b) => Math.abs(b.projectedPointDelta ?? 0) - Math.abs(a.projectedPointDelta ?? 0)).slice(0, 50),
  };
}

function buildProtectionSummary(rows: ProjectionV82FeatureFlagReadinessRow[]) {
  const counts = Object.fromEntries(PROTECTION_REASONS.map((reason) => [reason, 0])) as Record<ProjectionV82FeatureFlagProtectionReason, number>;
  for (const row of rows) {
    for (const reason of row.protectionReasons) counts[reason] += 1;
  }
  return counts;
}

function buildSafetyGates(summary: ProjectionV82FeatureFlagReadinessReport["summary"], impactSummary: ProjectionV82FeatureFlagImpactSummary) {
  return [
    gate("no_live_outputs_changed", true, "Readiness review writes only dry-run artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Rank data is read from dry-run artifacts only."),
    gate("draft_suggestions_unchanged", true, "Draft suggestion code paths are not imported or executed."),
    gate("war_room_unchanged", true, "War Room UI code is not imported or modified."),
    gate("flag_not_enabled", true, "No runtime feature flag is created or enabled."),
    gate("v8_2_not_promoted", true, "No live projection path is switched to v8.2."),
    gate("manual_review_rows_zero", summary.manualReviewRowsRemaining === 0, `${summary.manualReviewRowsRemaining} manual-review row(s) remain.`),
    gate("unresolved_rows_zero", summary.unresolvedRowsRemaining === 0, `${summary.unresolvedRowsRemaining} unresolved row(s) remain.`),
    gate("k_rows_not_using_v8_2", summary.kRowsUsingV82 === 0, `${summary.kRowsUsingV82} K row(s) would use v8.2.`),
    gate("critical_movers_not_using_v8_2", summary.criticalMovementRowsUsingV82 === 0, `${summary.criticalMovementRowsUsingV82} critical movement row(s) would use v8.2.`),
    gate("meaningful_rank_movers_not_using_v8_2", summary.meaningfulRankMoversUsingV82 === 0, `${summary.meaningfulRankMoversUsingV82} meaningful rank mover(s) would use v8.2.`),
    gate("legacy_rows_not_using_v8_2", summary.legacyRowsUsingV82 === 0, `${summary.legacyRowsUsingV82} legacy row(s) would use v8.2.`),
    gate("candidate_set_generated", summary.totalRows > 0, `${summary.totalRows} candidate rows generated.`),
    gate("impact_summary_generated", impactSummary.rows === summary.wouldUseV82UnderFlag, `${impactSummary.rows} v8.2 impact row(s) summarized.`),
  ];
}

function recommendationFor(gates: ProjectionV82FeatureFlagReadinessReport["safetyGates"]): ProjectionV82FeatureFlagReadinessRecommendation {
  const failed = gates.filter((gate) => !gate.passed);
  if (failed.some((gate) => ["manual_review_rows_zero", "unresolved_rows_zero", "k_rows_not_using_v8_2", "critical_movers_not_using_v8_2", "meaningful_rank_movers_not_using_v8_2", "legacy_rows_not_using_v8_2"].includes(gate.name))) {
    return "feature_flag_readiness_blocked";
  }
  if (failed.length) return "feature_flag_readiness_needs_review";
  return "ready_for_disabled_feature_flag_scaffold";
}

function renderMarkdown(report: ProjectionV82FeatureFlagReadinessReport) {
  return `# Projection v8.2 Disabled Feature-Flag Readiness ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Recommendation: ${report.recommendation}

## Summary

\`\`\`json
${JSON.stringify(report.summary, null, 2)}
\`\`\`

## Impact Summary

\`\`\`json
${JSON.stringify({
  rows: report.impactSummary.rows,
  averageProjectedPointDelta: report.impactSummary.averageProjectedPointDelta,
  medianProjectedPointDelta: report.impactSummary.medianProjectedPointDelta,
  maxProjectedPointDelta: report.impactSummary.maxProjectedPointDelta,
  movementBuckets: report.impactSummary.movementBuckets,
}, null, 2)}
\`\`\`

## Current-Path Protection Summary

\`\`\`json
${JSON.stringify(report.currentPathProtectionSummary, null, 2)}
\`\`\`

## Safety Gates

${renderGateTable(report.safetyGates)}

## Top v8.2 Movements Under Disabled Flag Simulation

${renderRowsTable(report.impactSummary.topMovements)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderCsv(report: ProjectionV82FeatureFlagReadinessReport) {
  const headers = [
    "player_id",
    "player",
    "position",
    "team",
    "status",
    "protection_reasons",
    "universe_eligibility_status",
    "final_classification",
    "current_expected_games",
    "v82_expected_games",
    "games_delta",
    "current_projected_total",
    "v82_projected_total",
    "projected_point_delta",
    "movement_bucket",
    "critical_movement",
    "meaningful_rank_mover",
    "risk_flags",
    "reason_codes",
  ];
  const rows = report.rows.map((row) => [
    row.playerId,
    row.player,
    row.position,
    row.team ?? "",
    row.status,
    row.protectionReasons.join("|"),
    row.universeEligibilityStatus ?? "",
    row.finalClassification ?? "",
    row.currentExpectedGames ?? "",
    row.v82ExpectedGames ?? "",
    row.gamesDelta ?? "",
    row.currentProjectedTotal ?? "",
    row.v82ProjectedTotal ?? "",
    row.projectedPointDelta ?? "",
    row.movementBucket,
    row.criticalMovement,
    row.meaningfulRankMover,
    row.riskFlags.join("|"),
    row.reasonCodes.join("|"),
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function renderGateTable(gates: ProjectionV82FeatureFlagReadinessReport["safetyGates"]) {
  const header = "| Gate | Status | Detail |";
  const divider = "|---|---|---|";
  return [header, divider, ...gates.map((gate) => `| ${gate.name} | ${gate.passed ? "PASS" : "FAIL"} | ${gate.detail} |`)].join("\n");
}

function renderRowsTable(rows: ProjectionV82FeatureFlagReadinessRow[]) {
  if (!rows.length) return "No rows.";
  const header = "| Player | Pos | Team | Status | Pts Delta | Movement | Reasons |";
  const divider = "|---|---|---|---|---:|---|---|";
  return [header, divider, ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.team ?? ""} | ${row.status} | ${row.projectedPointDelta ?? ""} | ${row.movementBucket} | ${row.protectionReasons.join(", ")} |`)].join("\n");
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return null;
  return round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function median(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
  if (!valid.length) return null;
  const middle = Math.floor(valid.length / 2);
  return round(valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2);
}

function maxAbs(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return null;
  return round(valid.reduce((max, value) => Math.max(max, Math.abs(value)), 0));
}

function countBy<T>(rows: T[], selector: (row: T) => string) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = selector(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function segmentSummary<T>(rows: T[], selector: (row: T) => string) {
  const segments = new Map<string, T[]>();
  for (const row of rows) {
    const key = selector(row);
    segments.set(key, [...(segments.get(key) ?? []), row]);
  }
  return [...segments.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
