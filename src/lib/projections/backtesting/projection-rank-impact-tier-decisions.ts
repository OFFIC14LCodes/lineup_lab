import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ProjectionLimitedPromotionPoolReviewReport } from "./projection-limited-promotion-pool-review-types";
import type { ProjectionPromotionReadinessFinalReport } from "./projection-promotion-readiness-final-types";
import type { ProjectionRankImpactQualityReviewReport } from "./projection-rank-impact-quality-review-types";
import type {
  ProjectionRankImpactTierDecision,
  ProjectionRankImpactTierDecisionArtifactPaths,
  ProjectionRankImpactTierDecisionOptions,
  ProjectionRankImpactTierDecisionReport,
  ProjectionRankImpactTierDecisionTemplateRow,
  ProjectionRankImpactTierDecisionVerdict,
  ProjectionRankImpactTierResolvedDecisionRow,
  ProjectionRankImpactTierStatus,
} from "./projection-rank-impact-tier-decisions-types";
import type { ProjectionRankImpactTierReviewReport, ProjectionRankImpactTierReviewRow } from "./projection-rank-impact-tier-review-types";
import type { ProjectionV82ShadowReport } from "./projection-v8-2-shadow-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const DECISIONS: ProjectionRankImpactTierDecision[] = [
  "approve_v8_2_movement",
  "use_current_path_for_now",
  "keep_shadow_only",
  "needs_roster_confirmation",
  "needs_injury_role_review",
  "needs_qb_superflex_review",
  "needs_model_policy_review",
  "unresolved",
];
const STATUSES: ProjectionRankImpactTierStatus[] = ["tier_approved", "tier_current_path", "tier_shadow_only", "tier_unresolved"];

export function runProjectionRankImpactTierDecisions(options: ProjectionRankImpactTierDecisionOptions): ProjectionRankImpactTierDecisionReport {
  const tierReviewPath = path.join(OUTPUT_DIR, `projection-rank-impact-tier-review-${options.projectionSeason}.json`);
  const qualityPath = path.join(OUTPUT_DIR, `projection-rank-impact-quality-review-${options.projectionSeason}.json`);
  const limitedPath = path.join(OUTPUT_DIR, `projection-limited-promotion-pool-review-${options.projectionSeason}.json`);
  const finalReadinessPath = path.join(OUTPUT_DIR, `projection-promotion-readiness-final-${options.projectionSeason}.json`);
  const shadowPath = path.join(OUTPUT_DIR, `projection-v8-2-shadow-${options.projectionSeason}.json`);
  for (const artifactPath of [tierReviewPath, qualityPath, limitedPath, finalReadinessPath, shadowPath]) {
    if (!existsSync(artifactPath)) throw new Error(`Missing ${path.relative(process.cwd(), artifactPath)}.`);
  }

  return buildProjectionRankImpactTierDecisionsFromData({
    options,
    tierReview: JSON.parse(readFileSync(tierReviewPath, "utf8")) as ProjectionRankImpactTierReviewReport,
    qualityReview: JSON.parse(readFileSync(qualityPath, "utf8")) as ProjectionRankImpactQualityReviewReport,
    limitedPool: JSON.parse(readFileSync(limitedPath, "utf8")) as ProjectionLimitedPromotionPoolReviewReport,
    finalReadiness: JSON.parse(readFileSync(finalReadinessPath, "utf8")) as ProjectionPromotionReadinessFinalReport,
    shadow: JSON.parse(readFileSync(shadowPath, "utf8")) as ProjectionV82ShadowReport,
    decisions: options.decisionsFile ? readTierDecisionRows(options.decisionsFile) : null,
    sourceArtifacts: {
      rankImpactTierReview: tierReviewPath,
      rankImpactQualityReview: qualityPath,
      limitedPromotionPoolReview: limitedPath,
      finalReadiness: finalReadinessPath,
      shadow: shadowPath,
    },
  });
}

export function buildProjectionRankImpactTierDecisionsFromData(input: {
  options: ProjectionRankImpactTierDecisionOptions;
  tierReview: ProjectionRankImpactTierReviewReport;
  qualityReview: ProjectionRankImpactQualityReviewReport;
  limitedPool: ProjectionLimitedPromotionPoolReviewReport;
  finalReadiness: ProjectionPromotionReadinessFinalReport;
  shadow: ProjectionV82ShadowReport;
  decisions?: ProjectionRankImpactTierDecisionTemplateRow[] | null;
  sourceArtifacts?: ProjectionRankImpactTierDecisionReport["sourceArtifacts"];
}): ProjectionRankImpactTierDecisionReport {
  void input.qualityReview;
  void input.limitedPool;
  void input.finalReadiness;
  void input.shadow;

  const templateRows = input.tierReview.rows.map(tierDecisionTemplateRowFor);
  const decisionIndex = indexDecisionRows(input.decisions ?? []);
  const resolvedRows = templateRows.map((template) => {
    const tierReviewRow = input.tierReview.rows.find((row) => row.playerId === template.playerId);
    if (!tierReviewRow) throw new Error(`Missing tier-review row for ${template.playerId}.`);
    return resolveTierDecisionRow(template, tierReviewRow, decisionIndex.byPlayerId.get(template.playerId) ?? null);
  });
  const validationErrors = [
    ...decisionIndex.validationErrors,
    ...validateDecisionFileCoverage(templateRows, input.decisions ?? []),
    ...resolvedRows.flatMap((row) => row.validationErrors.map((error) => `${row.playerId}: ${error}`)),
  ];
  const policyViolations = resolvedRows.flatMap((row) => row.policyViolations.map((violation) => `${row.playerId}: ${violation}`));
  const summary = buildSummary(templateRows, resolvedRows, validationErrors, policyViolations);
  const safetyGates = buildSafetyGates(templateRows, resolvedRows, validationErrors, policyViolations);
  const verdict = verdictFor(summary, validationErrors, policyViolations);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    decisionsFile: input.options.decisionsFile ?? null,
    sourceArtifacts: input.sourceArtifacts ?? {
      rankImpactTierReview: "in-memory",
      rankImpactQualityReview: "in-memory",
      limitedPromotionPoolReview: "in-memory",
      finalReadiness: "in-memory",
      shadow: "in-memory",
    },
    templateRows,
    resolvedRows,
    validationErrors,
    policyViolations,
    summary,
    topMovementRowsByFinalStatus: topMovementRowsByStatus(resolvedRows),
    unresolvedQbSuperflexRows: unresolvedRowsForAction(resolvedRows, "needs_qb_superflex_review"),
    unresolvedInjuryRoleRows: unresolvedRowsForAction(resolvedRows, "needs_injury_role_review"),
    unresolvedModelPolicyRows: unresolvedRowsForAction(resolvedRows, "needs_model_policy_review"),
    safetyGates,
    verdict,
    notes: [
      "Dry-run/read-only rank impact tier decision registry only.",
      "Default decisions never auto-approve meaningful tier-review rows.",
      "Resolved tier statuses prepare later disabled feature-flag readiness review but do not promote v8.2.",
      "No live projections, 2026 production outputs, Supabase writes, Blackbird Rank, Draft Suggestion ordering, War Room UI, or conservative promotion decision files are changed.",
    ],
  };
}

export function writeProjectionRankImpactTierDecisionArtifacts(report: ProjectionRankImpactTierDecisionReport): ProjectionRankImpactTierDecisionArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-rank-impact-tier-decisions-${report.projectionSeason}`;
  const templateCsvPath = path.join(OUTPUT_DIR, `${base}.template.csv`);
  const templateJsonPath = path.join(OUTPUT_DIR, `${base}.template.json`);
  const resolvedCsvPath = path.join(OUTPUT_DIR, `${base}.resolved.csv`);
  const resolvedJsonPath = path.join(OUTPUT_DIR, `${base}.resolved.json`);
  const resolvedMarkdownPath = path.join(OUTPUT_DIR, `${base}.resolved.md`);
  writeFileSync(templateCsvPath, renderTierDecisionTemplateCsv(report.templateRows), "utf8");
  writeFileSync(templateJsonPath, `${JSON.stringify(report.templateRows, null, 2)}\n`, "utf8");
  writeFileSync(resolvedCsvPath, renderTierDecisionResolvedCsv(report), "utf8");
  writeFileSync(resolvedJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(resolvedMarkdownPath, renderTierDecisionResolvedMarkdown(report), "utf8");
  return { templateCsvPath, templateJsonPath, resolvedCsvPath, resolvedJsonPath, resolvedMarkdownPath };
}

export function tierDecisionTemplateRowFor(row: ProjectionRankImpactTierReviewRow): ProjectionRankImpactTierDecisionTemplateRow {
  const decision = defaultDecisionFor(row);
  return {
    playerId: row.playerId,
    player: row.player,
    position: row.position,
    team: row.team,
    currentExpectedGames: row.currentExpectedGames,
    v82ExpectedGames: row.v82ExpectedGames,
    gamesDelta: row.gamesDelta,
    currentProjectedTotal: row.currentProjectedTotal,
    v82ProjectedTotal: row.v82ProjectedTotal,
    projectedPointDelta: row.projectedPointDelta,
    currentOverallRank: row.currentOverallRank,
    v82OverallRank: row.v82OverallRank,
    estimatedOverallRankMovement: row.estimatedOverallRankMovement,
    currentPositionRank: row.currentPositionRank,
    v82PositionRank: row.v82PositionRank,
    estimatedPositionRankMovement: row.estimatedPositionRankMovement,
    rankImpactFlags: [...row.rankImpactFlags],
    riskFlags: [...row.riskFlags],
    reasonCodes: [...row.reasonCodes],
    recommendedTierReviewAction: row.recommendedTierReviewAction,
    decision,
    decisionRationale: defaultRationaleFor(decision),
    reviewer: "",
    reviewedAt: "",
  };
}

export function resolveTierDecisionToStatus(decision: ProjectionRankImpactTierDecision): ProjectionRankImpactTierStatus {
  if (decision === "approve_v8_2_movement") return "tier_approved";
  if (decision === "use_current_path_for_now") return "tier_current_path";
  if (decision === "keep_shadow_only") return "tier_shadow_only";
  return "tier_unresolved";
}

export function resolveTierDecisionRow(
  template: ProjectionRankImpactTierDecisionTemplateRow,
  tierReviewRow: ProjectionRankImpactTierReviewRow,
  override: ProjectionRankImpactTierDecisionTemplateRow | null,
): ProjectionRankImpactTierResolvedDecisionRow {
  const decision = normalizeDecision(override?.decision ?? template.decision);
  const row: ProjectionRankImpactTierResolvedDecisionRow = {
    ...template,
    decision,
    decisionRationale: override?.decisionRationale ?? template.decisionRationale,
    reviewer: override?.reviewer ?? template.reviewer,
    reviewedAt: override?.reviewedAt ?? template.reviewedAt,
    resolvedTierStatus: resolveTierDecisionToStatus(decision),
    source: override ? "decision_file" : "default",
    validationErrors: [],
    policyViolations: [],
    tierReviewRow,
  };
  row.validationErrors = validateResolvedRow(row);
  row.policyViolations = policyViolationsFor(row);
  return row;
}

export function renderTierDecisionTemplateCsv(rows: ProjectionRankImpactTierDecisionTemplateRow[]) {
  return [templateHeaders(), ...rows.map(templateValues)].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

export function readTierDecisionRows(filePath: string): ProjectionRankImpactTierDecisionTemplateRow[] {
  const resolved = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!existsSync(resolved)) throw new Error(`Decision file not found: ${filePath}`);
  if (resolved.endsWith(".json")) return JSON.parse(readFileSync(resolved, "utf8")) as ProjectionRankImpactTierDecisionTemplateRow[];
  return parseTierDecisionTemplateCsv(readFileSync(resolved, "utf8"));
}

export function parseTierDecisionTemplateCsv(csv: string): ProjectionRankImpactTierDecisionTemplateRow[] {
  const [headerRow, ...dataRows] = parseCsv(csv).filter((row) => row.some((cell) => cell.trim()));
  if (!headerRow) return [];
  const headers = headerRow.map((header) => header.trim());
  return dataRows.map((row) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
    return {
      playerId: record.player_id,
      player: record.player_name,
      position: record.position,
      team: record.team || null,
      currentExpectedGames: numberOrNull(record.current_expected_games),
      v82ExpectedGames: numberOrNull(record.v82_expected_games),
      gamesDelta: numberOrNull(record.games_delta),
      currentProjectedTotal: numberOrNull(record.current_projected_total),
      v82ProjectedTotal: numberOrNull(record.v82_projected_total),
      projectedPointDelta: numberOrNull(record.projected_point_delta),
      currentOverallRank: numberOrNull(record.current_overall_rank),
      v82OverallRank: numberOrNull(record.v82_overall_rank),
      estimatedOverallRankMovement: numberOrNull(record.overall_rank_movement),
      currentPositionRank: numberOrNull(record.current_position_rank),
      v82PositionRank: numberOrNull(record.v82_position_rank),
      estimatedPositionRankMovement: numberOrNull(record.position_rank_movement),
      rankImpactFlags: splitList(record.rank_impact_flags),
      riskFlags: splitList(record.risk_flags),
      reasonCodes: splitList(record.v82_reason_codes),
      recommendedTierReviewAction: record.recommended_tier_review_action as ProjectionRankImpactTierDecisionTemplateRow["recommendedTierReviewAction"],
      decision: normalizeDecision(record.decision),
      decisionRationale: record.decision_rationale,
      reviewer: record.reviewer,
      reviewedAt: record.reviewed_at,
    };
  });
}

function defaultDecisionFor(row: ProjectionRankImpactTierReviewRow): ProjectionRankImpactTierDecision {
  if (row.rankImpactFlags.includes("qb_superflex_sensitive_movement") || row.recommendedTierReviewAction === "needs_qb_superflex_review") return "needs_qb_superflex_review";
  if (row.recommendedTierReviewAction === "needs_injury_role_review") return "needs_injury_role_review";
  if (row.recommendedTierReviewAction === "needs_model_policy_review") return "needs_model_policy_review";
  if (row.recommendedTierReviewAction === "needs_roster_confirmation") return "needs_roster_confirmation";
  if (row.recommendedTierReviewAction === "keep_current_path_for_now") return "use_current_path_for_now";
  return "unresolved";
}

function defaultRationaleFor(decision: ProjectionRankImpactTierDecision) {
  if (decision === "needs_qb_superflex_review") return "Default decision: QB/Superflex-sensitive movement requires explicit review before approval.";
  if (decision === "needs_injury_role_review") return "Default decision: injury/role-sensitive movement requires explicit review before approval.";
  if (decision === "needs_model_policy_review") return "Default decision: model-policy-sensitive movement requires explicit review before approval.";
  if (decision === "needs_roster_confirmation") return "Default decision: roster/depth-chart context requires confirmation before approval.";
  if (decision === "use_current_path_for_now") return "Default decision: keep current path for this row during initial tier-decision review.";
  if (decision === "keep_shadow_only") return "Default decision: keep v8.2 movement in shadow-only mode.";
  if (decision === "approve_v8_2_movement") return "Reviewed and approved v8.2 movement.";
  return "Default decision: unresolved until reviewed.";
}

function validateResolvedRow(row: ProjectionRankImpactTierResolvedDecisionRow) {
  const errors: string[] = [];
  if (!DECISIONS.includes(row.decision)) errors.push("invalid decision");
  if (!row.decisionRationale.trim()) errors.push("missing rationale");
  return errors;
}

function policyViolationsFor(row: ProjectionRankImpactTierResolvedDecisionRow) {
  const violations: string[] = [];
  if (row.decision !== "approve_v8_2_movement") return violations;
  const explicit = row.source === "decision_file" && row.decisionRationale.trim().length >= 20 && !row.decisionRationale.toLowerCase().startsWith("default decision");
  if (row.rankImpactFlags.includes("qb_superflex_sensitive_movement") && !explicit) violations.push("QB/Superflex row approved without explicit rationale");
  if (row.recommendedTierReviewAction === "needs_injury_role_review" && !explicit) violations.push("injury/role row approved without explicit rationale");
  if ((Math.abs(row.projectedPointDelta ?? 0) >= 10 || Math.abs(row.estimatedOverallRankMovement ?? 0) >= 25 || Math.abs(row.estimatedPositionRankMovement ?? 0) >= 5) && !explicit) {
    violations.push("critical/high-impact row approved without explicit rationale");
  }
  return violations;
}

function indexDecisionRows(rows: ProjectionRankImpactTierDecisionTemplateRow[]) {
  const byPlayerId = new Map<string, ProjectionRankImpactTierDecisionTemplateRow>();
  const validationErrors: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.playerId)) validationErrors.push(`${row.playerId}: duplicate decision row`);
    seen.add(row.playerId);
    byPlayerId.set(row.playerId, row);
    if (!DECISIONS.includes(row.decision)) validationErrors.push(`${row.playerId}: invalid decision`);
  }
  return { byPlayerId, validationErrors };
}

function validateDecisionFileCoverage(templateRows: ProjectionRankImpactTierDecisionTemplateRow[], decisions: ProjectionRankImpactTierDecisionTemplateRow[]) {
  if (!decisions.length) return [];
  const errors: string[] = [];
  const templateIds = new Set(templateRows.map((row) => row.playerId));
  const decisionIds = new Set(decisions.map((row) => row.playerId));
  for (const row of decisions) {
    if (!templateIds.has(row.playerId)) errors.push(`${row.playerId}: unknown player id`);
  }
  for (const row of templateRows) {
    if (!decisionIds.has(row.playerId)) errors.push(`${row.playerId}: tier-review row missing from decision file`);
  }
  return errors;
}

function buildSummary(
  templateRows: ProjectionRankImpactTierDecisionTemplateRow[],
  resolvedRows: ProjectionRankImpactTierResolvedDecisionRow[],
  validationErrors: string[],
  policyViolations: string[],
): ProjectionRankImpactTierDecisionReport["summary"] {
  return {
    totalTierReviewRows: templateRows.length,
    defaultDecisionCounts: countBy(templateRows, (row) => row.decision, DECISIONS),
    resolvedDecisionCounts: countBy(resolvedRows, (row) => row.decision, DECISIONS),
    resolvedTierStatusCounts: countBy(resolvedRows, (row) => row.resolvedTierStatus, STATUSES),
    validationErrors: validationErrors.length,
    policyViolations: policyViolations.length,
    qbSuperflexRowsByStatus: statusCountsFor(resolvedRows.filter((row) => row.rankImpactFlags.includes("qb_superflex_sensitive_movement"))),
    injuryRoleRowsByStatus: statusCountsFor(resolvedRows.filter((row) => row.recommendedTierReviewAction === "needs_injury_role_review")),
    modelPolicyRowsByStatus: statusCountsFor(resolvedRows.filter((row) => row.recommendedTierReviewAction === "needs_model_policy_review")),
  };
}

function topMovementRowsByStatus(rows: ProjectionRankImpactTierResolvedDecisionRow[]) {
  return Object.fromEntries(STATUSES.map((status) => [status, rows.filter((row) => row.resolvedTierStatus === status).sort(compareByAbsMovement).slice(0, 25)])) as Record<ProjectionRankImpactTierStatus, ProjectionRankImpactTierResolvedDecisionRow[]>;
}

function unresolvedRowsForAction(rows: ProjectionRankImpactTierResolvedDecisionRow[], decision: ProjectionRankImpactTierDecision) {
  return rows.filter((row) => row.decision === decision && row.resolvedTierStatus === "tier_unresolved").sort(compareByAbsMovement);
}

function buildSafetyGates(
  templateRows: ProjectionRankImpactTierDecisionTemplateRow[],
  resolvedRows: ProjectionRankImpactTierResolvedDecisionRow[],
  validationErrors: string[],
  policyViolations: string[],
) {
  return [
    gate("no_live_outputs_changed", true, "Tier decisions read dry-run artifacts and write only decision registry artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Rank fields are copied from dry-run rank impact artifacts only."),
    gate("draft_suggestions_unchanged", true, "Draft suggestion code paths are not imported or executed."),
    gate("war_room_unchanged", true, "War Room UI code is not imported or modified."),
    gate("v8_2_not_promoted", true, "No production or live projection paths are changed."),
    gate("conservative_decision_file_unchanged", true, "The conservative promotion decision file is not rewritten."),
    gate("decision_template_generated", templateRows.length > 0, `${templateRows.length} template rows generated.`),
    gate("resolved_registry_generated", resolvedRows.length === templateRows.length, `${resolvedRows.length}/${templateRows.length} resolved rows generated.`),
    gate("validation_clean", validationErrors.length === 0, `${validationErrors.length} validation error(s).`),
    gate("policy_clean", policyViolations.length === 0, `${policyViolations.length} policy violation(s).`),
  ];
}

function verdictFor(
  summary: ProjectionRankImpactTierDecisionReport["summary"],
  validationErrors: string[],
  policyViolations: string[],
): ProjectionRankImpactTierDecisionVerdict {
  if (validationErrors.length) return "tier_decisions_blocked_by_validation";
  if (policyViolations.length) return "tier_decisions_blocked_by_policy";
  if (summary.resolvedTierStatusCounts.tier_unresolved > 0) return "tier_decisions_unresolved_rows_remaining";
  return "tier_decisions_ready";
}

function renderTierDecisionResolvedCsv(report: ProjectionRankImpactTierDecisionReport) {
  const headers = [...templateHeaders(), "resolved_tier_status", "source", "validation_errors", "policy_violations"];
  const rows = report.resolvedRows.map((row) => [
    ...templateValues(row),
    row.resolvedTierStatus,
    row.source,
    row.validationErrors.join("|"),
    row.policyViolations.join("|"),
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function renderTierDecisionResolvedMarkdown(report: ProjectionRankImpactTierDecisionReport) {
  return `# Projection Rank Impact Tier Decisions ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Verdict: ${report.verdict}
Decisions file: ${report.decisionsFile ?? "default decisions"}

## Summary

\`\`\`json
${JSON.stringify(report.summary, null, 2)}
\`\`\`

## Safety Gates

${renderGateTable(report.safetyGates)}

## Validation Errors

${report.validationErrors.length ? report.validationErrors.map((error) => `- ${error}`).join("\n") : "No validation errors."}

## Policy Violations

${report.policyViolations.length ? report.policyViolations.map((violation) => `- ${violation}`).join("\n") : "No policy violations."}

## Unresolved QB / Superflex Rows

${renderRowsTable(report.unresolvedQbSuperflexRows)}

## Unresolved Injury / Role Rows

${renderRowsTable(report.unresolvedInjuryRoleRows)}

## Unresolved Model Policy Rows

${renderRowsTable(report.unresolvedModelPolicyRows)}

## Top Movement Rows by Final Status

${STATUSES.map((status) => `### ${status}\n\n${renderRowsTable(report.topMovementRowsByFinalStatus[status])}`).join("\n\n")}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function templateHeaders() {
  return [
    "player_id",
    "player_name",
    "position",
    "team",
    "current_expected_games",
    "v82_expected_games",
    "games_delta",
    "current_projected_total",
    "v82_projected_total",
    "projected_point_delta",
    "current_overall_rank",
    "v82_overall_rank",
    "overall_rank_movement",
    "current_position_rank",
    "v82_position_rank",
    "position_rank_movement",
    "rank_impact_flags",
    "risk_flags",
    "v82_reason_codes",
    "recommended_tier_review_action",
    "decision",
    "decision_rationale",
    "reviewer",
    "reviewed_at",
  ];
}

function templateValues(row: ProjectionRankImpactTierDecisionTemplateRow) {
  return [
    row.playerId,
    row.player,
    row.position,
    row.team ?? "",
    row.currentExpectedGames ?? "",
    row.v82ExpectedGames ?? "",
    row.gamesDelta ?? "",
    row.currentProjectedTotal ?? "",
    row.v82ProjectedTotal ?? "",
    row.projectedPointDelta ?? "",
    row.currentOverallRank ?? "",
    row.v82OverallRank ?? "",
    row.estimatedOverallRankMovement ?? "",
    row.currentPositionRank ?? "",
    row.v82PositionRank ?? "",
    row.estimatedPositionRankMovement ?? "",
    row.rankImpactFlags.join("|"),
    row.riskFlags.join("|"),
    row.reasonCodes.join("|"),
    row.recommendedTierReviewAction,
    row.decision,
    row.decisionRationale,
    row.reviewer,
    row.reviewedAt,
  ];
}

function renderGateTable(gates: ProjectionRankImpactTierDecisionReport["safetyGates"]) {
  const header = "| Gate | Status | Detail |";
  const divider = "|---|---|---|";
  return [header, divider, ...gates.map((gate) => `| ${gate.name} | ${gate.passed ? "PASS" : "FAIL"} | ${gate.detail} |`)].join("\n");
}

function renderRowsTable(rows: ProjectionRankImpactTierResolvedDecisionRow[]) {
  if (!rows.length) return "No rows.";
  const header = "| Player | Pos | Team | Decision | Status | Pts Delta | OVR Move | Pos Move | Rationale |";
  const divider = "|---|---|---|---|---|---:|---:|---:|---|";
  return [header, divider, ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.team ?? ""} | ${row.decision} | ${row.resolvedTierStatus} | ${row.projectedPointDelta ?? ""} | ${row.estimatedOverallRankMovement ?? ""} | ${row.estimatedPositionRankMovement ?? ""} | ${row.decisionRationale} |`)].join("\n");
}

function countBy<T, K extends string>(rows: T[], selector: (row: T) => K, keys: readonly K[]): Record<K, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  for (const row of rows) {
    const key = selector(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function statusCountsFor(rows: ProjectionRankImpactTierResolvedDecisionRow[]) {
  return countBy(rows, (row) => row.resolvedTierStatus, STATUSES);
}

function compareByAbsMovement(a: ProjectionRankImpactTierResolvedDecisionRow, b: ProjectionRankImpactTierResolvedDecisionRow) {
  return Math.abs(b.projectedPointDelta ?? 0) - Math.abs(a.projectedPointDelta ?? 0)
    || Math.abs(b.estimatedOverallRankMovement ?? 0) - Math.abs(a.estimatedOverallRankMovement ?? 0)
    || Math.abs(b.estimatedPositionRankMovement ?? 0) - Math.abs(a.estimatedPositionRankMovement ?? 0);
}

function normalizeDecision(value: string | undefined): ProjectionRankImpactTierDecision {
  return DECISIONS.includes(value as ProjectionRankImpactTierDecision) ? value as ProjectionRankImpactTierDecision : "unresolved";
}

function numberOrNull(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitList(value: string) {
  return value ? value.split("|").filter(Boolean) : [];
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index++) {
    const char = csv[index];
    const next = csv[index + 1];
    if (quoted && char === "\"" && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
