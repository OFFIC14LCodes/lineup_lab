import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ProjectionPromotionCandidatePoolReport, ProjectionPromotionCandidateRow, ProjectionPromotionEligibilityClassification } from "./projection-promotion-candidate-pool-types";
import type { ProjectionPromotionManualReviewReport, ProjectionPromotionManualReviewRow } from "./projection-promotion-manual-review-types";
import {
  readDecisionRows,
  runProjectionPromotionReviewDecisions,
} from "./projection-promotion-review-decisions";
import type {
  ProjectionPromotionResolvedDecisionRow,
  ProjectionPromotionReviewDecision,
  ProjectionPromotionReviewDecisionTemplateRow,
} from "./projection-promotion-review-decisions-types";
import type {
  ProjectionPromotionReadinessFinalArtifactPaths,
  ProjectionPromotionReadinessFinalOptions,
  ProjectionPromotionReadinessFinalReport,
  ProjectionPromotionReadinessFinalRow,
  ProjectionPromotionReadinessFinalVerdict,
  ProjectionPromotionReadinessPolicyViolation,
  ProjectionPromotionReadinessValidationIssue,
} from "./projection-promotion-readiness-final-types";
import type { ProjectionUniverseEligibilityAuditReport } from "./projection-universe-eligibility-audit-types";
import type { ProjectionV82ShadowReport } from "./projection-v8-2-shadow-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const DECISIONS: ProjectionPromotionReviewDecision[] = [
  "approve_for_candidate_pool",
  "keep_shadow_only",
  "block_from_promotion",
  "cap_v8_2_movement",
  "use_current_path_for_now",
  "needs_external_roster_confirmation",
  "needs_kicker_policy_review",
  "unresolved",
];
const CLASSIFICATIONS: ProjectionPromotionEligibilityClassification[] = [
  "eligible_for_projection_promotion",
  "manual_review_before_promotion",
  "shadow_only",
  "blocked_from_promotion",
];

export function runProjectionPromotionReadinessFinal(options: ProjectionPromotionReadinessFinalOptions): ProjectionPromotionReadinessFinalReport {
  const reviewDecisionsPath = path.join(OUTPUT_DIR, `projection-promotion-review-decisions-${options.projectionSeason}.resolved.json`);
  const candidatePoolPath = path.join(OUTPUT_DIR, `projection-promotion-candidate-pool-${options.projectionSeason}.json`);
  const manualReviewPath = path.join(OUTPUT_DIR, `projection-promotion-manual-review-${options.projectionSeason}.json`);
  const shadowPath = path.join(OUTPUT_DIR, `projection-v8-2-shadow-${options.projectionSeason}.json`);
  const universePath = path.join(OUTPUT_DIR, `projection-universe-eligibility-audit-${options.projectionSeason}.json`);
  if (!existsSync(candidatePoolPath)) throw new Error(`Missing ${path.relative(process.cwd(), candidatePoolPath)}. Run npm run projection:promotion:candidate-pool -- --projection-season=${options.projectionSeason} --include-idp first.`);
  if (!existsSync(manualReviewPath)) throw new Error(`Missing ${path.relative(process.cwd(), manualReviewPath)}. Run npm run projection:promotion:manual-review -- --projection-season=${options.projectionSeason} --include-idp first.`);
  if (!existsSync(shadowPath)) throw new Error(`Missing ${path.relative(process.cwd(), shadowPath)}. Run npm run projection:v8-2:shadow -- --projection-season=${options.projectionSeason} --include-idp first.`);
  if (!existsSync(universePath)) throw new Error(`Missing ${path.relative(process.cwd(), universePath)}. Run npm run projection:universe:eligibility:audit -- --projection-season=${options.projectionSeason} --include-idp first.`);
  if (!options.decisionsFile && !existsSync(reviewDecisionsPath)) throw new Error(`Missing ${path.relative(process.cwd(), reviewDecisionsPath)}. Run npm run projection:promotion:review-decisions -- --projection-season=${options.projectionSeason} --include-idp first.`);

  const candidatePool = JSON.parse(readFileSync(candidatePoolPath, "utf8")) as ProjectionPromotionCandidatePoolReport;
  const manualReview = JSON.parse(readFileSync(manualReviewPath, "utf8")) as ProjectionPromotionManualReviewReport;
  const shadow = JSON.parse(readFileSync(shadowPath, "utf8")) as ProjectionV82ShadowReport;
  const universe = JSON.parse(readFileSync(universePath, "utf8")) as ProjectionUniverseEligibilityAuditReport;
  const reviewDecisions = options.decisionsFile
    ? runProjectionPromotionReviewDecisions(options)
    : JSON.parse(readFileSync(reviewDecisionsPath, "utf8")) as ReturnType<typeof runProjectionPromotionReviewDecisions>;
  const decisionRows = options.decisionsFile ? readDecisionRows(options.decisionsFile) : null;
  const rawDecisionRows = options.decisionsFile ? readRawDecisionRows(options.decisionsFile) : null;

  return buildProjectionPromotionReadinessFinalFromData({
    options,
    candidatePool,
    manualReview,
    reviewDecisions,
    shadow,
    universe,
    decisionRows,
    rawDecisionRows,
    sourceArtifacts: {
      reviewDecisions: options.decisionsFile ? options.decisionsFile : reviewDecisionsPath,
      promotionCandidatePool: candidatePoolPath,
      promotionManualReview: manualReviewPath,
      shadow: shadowPath,
      universeEligibilityAudit: universePath,
    },
  });
}

export function buildProjectionPromotionReadinessFinalFromData(input: {
  options: ProjectionPromotionReadinessFinalOptions;
  candidatePool: ProjectionPromotionCandidatePoolReport;
  manualReview: ProjectionPromotionManualReviewReport;
  reviewDecisions: { resolvedRows: ProjectionPromotionResolvedDecisionRow[] };
  shadow: ProjectionV82ShadowReport;
  universe: ProjectionUniverseEligibilityAuditReport;
  decisionRows?: ProjectionPromotionReviewDecisionTemplateRow[] | null;
  rawDecisionRows?: Array<Record<string, string>> | null;
  sourceArtifacts?: ProjectionPromotionReadinessFinalReport["sourceArtifacts"];
}): ProjectionPromotionReadinessFinalReport {
  void input.shadow;
  void input.universe;
  const validationIssues = validateDecisionFile({
    manualRows: input.manualReview.rows,
    decisionRows: input.decisionRows ?? null,
    rawDecisionRows: input.rawDecisionRows ?? null,
    decisionsFile: input.options.decisionsFile ?? null,
  });
  const finalRows = buildFinalRows(input.candidatePool, input.reviewDecisions.resolvedRows);
  const policyViolations = buildPolicyViolations(input.reviewDecisions.resolvedRows);
  const summary = buildSummary(finalRows, validationIssues, policyViolations);
  const safetyGates = buildSafetyGates(input.manualReview.rows, finalRows, validationIssues, policyViolations);
  const verdict = verdictFor(summary, validationIssues, policyViolations);
  const unresolvedRows = finalRows
    .filter((row) => row.decision === "unresolved" || row.finalClassification === "manual_review_before_promotion")
    .sort(compareByAbsMovement);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    decisionsFile: input.options.decisionsFile ?? null,
    sourceArtifacts: input.sourceArtifacts ?? {
      reviewDecisions: "in-memory",
      promotionCandidatePool: "in-memory",
      promotionManualReview: "in-memory",
      shadow: "in-memory",
      universeEligibilityAudit: "in-memory",
    },
    validationIssues,
    policyViolations,
    finalRows,
    summary,
    topEligibleMovements: topByClassification(finalRows, "eligible_for_projection_promotion"),
    topManualReviewMovements: topByClassification(finalRows, "manual_review_before_promotion"),
    topShadowOnlyMovements: topByClassification(finalRows, "shadow_only"),
    topBlockedMovements: topByClassification(finalRows, "blocked_from_promotion"),
    criticalMovementRows: finalRows.filter((row) => row.criticalMovement).sort(compareByAbsMovement),
    unresolvedRows,
    safetyGates,
    verdict,
    notes: [
      "Dry-run/read-only final promotion-readiness report only.",
      "Final classifications are reporting output only and do not promote v8.2.",
      "K rows remain shadow-only unless an edited decision file explicitly approves them with an override rationale.",
      "No live projections, 2026 production outputs, Supabase writes, War Room UI, Blackbird Rank, or Draft Suggestion ordering are changed.",
    ],
  };
}

export function writeProjectionPromotionReadinessFinalArtifacts(report: ProjectionPromotionReadinessFinalReport): ProjectionPromotionReadinessFinalArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-promotion-readiness-final-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderProjectionPromotionReadinessFinalMarkdown(report), "utf8");
  writeFileSync(csvPath, renderProjectionPromotionReadinessFinalCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

export function validateDecisionFile(input: {
  manualRows: ProjectionPromotionManualReviewRow[];
  decisionRows: ProjectionPromotionReviewDecisionTemplateRow[] | null;
  rawDecisionRows: Array<Record<string, string>> | null;
  decisionsFile: string | null;
}): ProjectionPromotionReadinessValidationIssue[] {
  const issues: ProjectionPromotionReadinessValidationIssue[] = [];
  if (!input.decisionsFile) return issues;
  const manualById = new Map(input.manualRows.map((row) => [row.playerId, row]));
  const seen = new Set<string>();
  const rows: Array<Record<string, string>> = input.rawDecisionRows ?? input.decisionRows?.map((row) => ({
    player_id: row.playerId,
    player_name: row.player,
    decision: row.decision,
    decision_rationale: row.decisionRationale,
  })) ?? [];

  for (const row of rows) {
    const playerId = row.player_id || row.playerId || "";
    const player = row.player_name || row.player || null;
    const decision = row.decision || "";
    const rationale = row.decision_rationale || row.decisionRationale || "";
    if (!playerId.trim()) {
      issues.push({ code: "unknown_player_id", playerId: null, player, detail: "Decision row is missing player_id." });
      continue;
    }
    if (seen.has(playerId)) issues.push({ code: "duplicate_decision_row", playerId, player, detail: "Decision file contains more than one row for this player_id." });
    seen.add(playerId);
    if (!manualById.has(playerId)) issues.push({ code: "unknown_player_id", playerId, player, detail: "Decision file row does not match a manual-review player_id." });
    if (!DECISIONS.includes(decision as ProjectionPromotionReviewDecision)) issues.push({ code: "invalid_decision", playerId, player, detail: `Unsupported decision: ${decision || "<blank>"}.` });
    if (!rationale.trim()) issues.push({ code: "missing_rationale", playerId, player, detail: "Decision row must include decision_rationale." });
  }

  for (const row of input.manualRows) {
    if (!seen.has(row.playerId)) {
      issues.push({
        code: "manual_review_row_missing_from_decision_file",
        playerId: row.playerId,
        player: row.player,
        detail: "Manual-review row is not represented in the edited decision file.",
      });
    }
  }
  return issues;
}

export function buildPolicyViolations(rows: ProjectionPromotionResolvedDecisionRow[]): ProjectionPromotionReadinessPolicyViolation[] {
  const violations: ProjectionPromotionReadinessPolicyViolation[] = [];
  for (const row of rows) {
    if (row.position === "K" && row.humanOrDefaultDecision === "approve_for_candidate_pool" && !hasExplicitKickerOverride(row.decisionRationale)) {
      violations.push({
        code: "k_row_approved_without_explicit_override_reason",
        playerId: row.playerId,
        player: row.player,
        position: row.position,
        decision: row.humanOrDefaultDecision,
        detail: "K approval requires an explicit override reason in decision_rationale.",
      });
    }
    if (row.criticalMovement && row.humanOrDefaultDecision === "approve_for_candidate_pool" && !row.decisionRationale.trim()) {
      violations.push({
        code: "critical_movement_row_approved_without_rationale",
        playerId: row.playerId,
        player: row.player,
        position: row.position,
        decision: row.humanOrDefaultDecision,
        detail: "Critical movement approval requires a decision rationale.",
      });
    }
    if (row.universeEligibilityStatus === "retired_or_legacy_suspect" && row.humanOrDefaultDecision === "approve_for_candidate_pool") {
      violations.push({
        code: "retired_legacy_row_approved",
        playerId: row.playerId,
        player: row.player,
        position: row.position,
        decision: row.humanOrDefaultDecision,
        detail: "Retired/legacy suspect rows cannot be eligible for promotion.",
      });
    }
  }
  return violations;
}

function buildFinalRows(candidatePool: ProjectionPromotionCandidatePoolReport, resolvedRows: ProjectionPromotionResolvedDecisionRow[]): ProjectionPromotionReadinessFinalRow[] {
  const decisionsByPlayerId = new Map(resolvedRows.map((row) => [row.playerId, row]));
  return candidatePool.rows.map((row) => {
    const decision = decisionsByPlayerId.get(row.playerId);
    return finalRow(row, decision ?? null);
  });
}

function finalRow(row: ProjectionPromotionCandidateRow, decision: ProjectionPromotionResolvedDecisionRow | null): ProjectionPromotionReadinessFinalRow {
  return {
    playerId: row.playerId,
    player: row.player,
    position: row.position,
    team: row.team,
    universeEligibilityStatus: row.universeEligibilityStatus,
    originalClassification: row.promotionEligibilityClassification,
    finalClassification: decision?.resolvedClassification ?? row.promotionEligibilityClassification,
    decision: decision?.humanOrDefaultDecision ?? null,
    decisionRationale: decision?.decisionRationale ?? null,
    reviewer: decision?.reviewer || (decision ? "default_reviewer" : null),
    reviewedAt: decision?.reviewedAt || (decision ? "generated_at_runtime" : null),
    projectedTotalPointDelta: row.projectedTotalPointDelta,
    currentExpectedGames: row.currentExpectedGames,
    v82ExpectedGames: row.v82ExpectedGames,
    gamesDelta: row.gamesDelta,
    criticalMovement: row.criticalMovement,
    movementBucket: row.movementBucket,
    riskFlags: [...row.riskFlags],
    reasonCodes: [...row.reasonCodes],
    source: decision ? "review_decision" : "candidate_pool",
  };
}

function buildSummary(rows: ProjectionPromotionReadinessFinalRow[], validationIssues: ProjectionPromotionReadinessValidationIssue[], policyViolations: ProjectionPromotionReadinessPolicyViolation[]): ProjectionPromotionReadinessFinalReport["summary"] {
  const classifications = classificationCounts(rows);
  return {
    eligibleRows: classifications.eligible_for_projection_promotion,
    manualReviewRowsRemaining: classifications.manual_review_before_promotion,
    shadowOnlyRows: classifications.shadow_only,
    blockedRows: classifications.blocked_from_promotion,
    kRows: classificationCounts(rows.filter((row) => row.position === "K")),
    criticalMovementRows: classificationCounts(rows.filter((row) => row.criticalMovement)),
    unresolvedRows: rows.filter((row) => row.decision === "unresolved").length,
    validationErrors: validationIssues.length,
    policyViolations: policyViolations.length,
  };
}

function buildSafetyGates(manualRows: ProjectionPromotionManualReviewRow[], finalRows: ProjectionPromotionReadinessFinalRow[], validationIssues: ProjectionPromotionReadinessValidationIssue[], policyViolations: ProjectionPromotionReadinessPolicyViolation[]) {
  const manualReviewRows = finalRows.filter((row) => row.source === "review_decision");
  const legacyEligible = finalRows.filter((row) => row.universeEligibilityStatus === "retired_or_legacy_suspect" && row.finalClassification === "eligible_for_projection_promotion");
  const kEligibleWithoutOverride = finalRows.filter((row) => row.position === "K" && row.finalClassification === "eligible_for_projection_promotion" && !hasExplicitKickerOverride(row.decisionRationale ?? ""));
  const criticalApprovedWithoutRationale = finalRows.filter((row) => row.criticalMovement && row.finalClassification === "eligible_for_projection_promotion" && !(row.decisionRationale ?? "").trim());
  const unresolvedRows = finalRows.filter((row) => row.decision === "unresolved");
  return [
    gate("no_live_outputs_changed", true, "Final readiness reads dry-run artifacts and writes only readiness artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Ranking code paths are not imported or modified."),
    gate("draft_suggestions_unchanged", true, "Draft suggestion code paths are not imported or executed."),
    gate("war_room_unchanged", true, "War Room UI code is not imported or modified."),
    gate("all_manual_review_rows_accounted_for", manualReviewRows.length === manualRows.length && !validationIssues.some((issue) => issue.code === "manual_review_row_missing_from_decision_file"), `${manualReviewRows.length}/${manualRows.length} manual-review rows accounted for.`),
    gate("no_invalid_decisions", validationIssues.length === 0, `${validationIssues.length} validation issue(s).`),
    gate("no_legacy_rows_eligible", legacyEligible.length === 0, `${legacyEligible.length} legacy eligible row(s).`),
    gate("no_k_rows_eligible_without_override", kEligibleWithoutOverride.length === 0, `${kEligibleWithoutOverride.length} K row(s) eligible without explicit override.`),
    gate("critical_approvals_have_rationale", criticalApprovedWithoutRationale.length === 0, `${criticalApprovedWithoutRationale.length} critical approval(s) missing rationale.`),
    gate("unresolved_rows_reported", unresolvedRows.length === 0 || unresolvedRows.every((row) => row.finalClassification === "manual_review_before_promotion"), `${unresolvedRows.length} unresolved row(s).`),
    gate("eligible_pool_generated", finalRows.some((row) => row.finalClassification === "eligible_for_projection_promotion"), `${finalRows.filter((row) => row.finalClassification === "eligible_for_projection_promotion").length} eligible row(s).`),
    gate("no_policy_violations", policyViolations.length === 0, `${policyViolations.length} policy violation(s).`),
  ];
}

function verdictFor(summary: ProjectionPromotionReadinessFinalReport["summary"], validationIssues: ProjectionPromotionReadinessValidationIssue[], policyViolations: ProjectionPromotionReadinessPolicyViolation[]): ProjectionPromotionReadinessFinalVerdict {
  if (validationIssues.length) return "blocked_by_invalid_decisions";
  if (policyViolations.length) return "blocked_by_policy_violation";
  if (summary.manualReviewRowsRemaining || summary.unresolvedRows) return "manual_decisions_required";
  return "ready_for_shadow_promotion_review";
}

function topByClassification(rows: ProjectionPromotionReadinessFinalRow[], classification: ProjectionPromotionEligibilityClassification) {
  return rows.filter((row) => row.finalClassification === classification).sort(compareByAbsMovement).slice(0, 25);
}

function classificationCounts(rows: ProjectionPromotionReadinessFinalRow[]) {
  return Object.fromEntries(CLASSIFICATIONS.map((classification) => [classification, rows.filter((row) => row.finalClassification === classification).length])) as Record<ProjectionPromotionEligibilityClassification, number>;
}

function hasExplicitKickerOverride(rationale: string) {
  const normalized = rationale.toLowerCase();
  return normalized.includes("kicker") && normalized.includes("override") && rationale.trim().length >= 20;
}

function compareByAbsMovement(a: ProjectionPromotionReadinessFinalRow, b: ProjectionPromotionReadinessFinalRow) {
  return Math.abs(b.projectedTotalPointDelta ?? 0) - Math.abs(a.projectedTotalPointDelta ?? 0) || a.player.localeCompare(b.player);
}

function renderProjectionPromotionReadinessFinalMarkdown(report: ProjectionPromotionReadinessFinalReport) {
  return `# Projection Promotion Final Readiness ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Verdict: ${report.verdict}
Decisions file: ${report.decisionsFile ?? "default resolved decisions"}

## Summary

\`\`\`json
${JSON.stringify(report.summary, null, 2)}
\`\`\`

## Safety Gates

${renderGateTable(report.safetyGates)}

## Validation Issues

${renderIssues(report.validationIssues)}

## Policy Violations

${renderPolicyViolations(report.policyViolations)}

## Unresolved Rows

${renderRowsTable(report.unresolvedRows)}

## Top Eligible Movements

${renderRowsTable(report.topEligibleMovements)}

## Top Manual-Review Movements

${renderRowsTable(report.topManualReviewMovements)}

## Top Shadow-Only Movements

${renderRowsTable(report.topShadowOnlyMovements)}

## Top Blocked Movements

${renderRowsTable(report.topBlockedMovements)}

## Critical Movement Rows

${renderRowsTable(report.criticalMovementRows)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderProjectionPromotionReadinessFinalCsv(report: ProjectionPromotionReadinessFinalReport) {
  const headers = [
    "player_id",
    "player",
    "position",
    "team",
    "universe_eligibility_status",
    "original_classification",
    "final_classification",
    "decision",
    "decision_rationale",
    "reviewer",
    "reviewed_at",
    "projected_total_point_delta",
    "current_expected_games",
    "v82_expected_games",
    "games_delta",
    "critical_movement",
    "movement_bucket",
    "risk_flags",
    "reason_codes",
    "source",
  ];
  const rows = report.finalRows.map((row) => [
    row.playerId,
    row.player,
    row.position,
    row.team ?? "",
    row.universeEligibilityStatus,
    row.originalClassification,
    row.finalClassification,
    row.decision ?? "",
    row.decisionRationale ?? "",
    row.reviewer ?? "",
    row.reviewedAt ?? "",
    row.projectedTotalPointDelta ?? "",
    row.currentExpectedGames ?? "",
    row.v82ExpectedGames ?? "",
    row.gamesDelta ?? "",
    row.criticalMovement,
    row.movementBucket,
    row.riskFlags.join("|"),
    row.reasonCodes.join("|"),
    row.source,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function renderGateTable(gates: ProjectionPromotionReadinessFinalReport["safetyGates"]) {
  const header = "| Gate | Status | Detail |";
  const divider = "|---|---|---|";
  return [header, divider, ...gates.map((gate) => `| ${gate.name} | ${gate.passed ? "PASS" : "FAIL"} | ${gate.detail} |`)].join("\n");
}

function renderIssues(issues: ProjectionPromotionReadinessValidationIssue[]) {
  if (!issues.length) return "No validation issues.";
  const header = "| Code | Player ID | Player | Detail |";
  const divider = "|---|---|---|---|";
  return [header, divider, ...issues.map((issue) => `| ${issue.code} | ${issue.playerId ?? ""} | ${issue.player ?? ""} | ${issue.detail} |`)].join("\n");
}

function renderPolicyViolations(violations: ProjectionPromotionReadinessPolicyViolation[]) {
  if (!violations.length) return "No policy violations.";
  const header = "| Code | Player | Pos | Decision | Detail |";
  const divider = "|---|---|---|---|---|";
  return [header, divider, ...violations.map((violation) => `| ${violation.code} | ${violation.player} | ${violation.position} | ${violation.decision} | ${violation.detail} |`)].join("\n");
}

function renderRowsTable(rows: ProjectionPromotionReadinessFinalRow[]) {
  if (!rows.length) return "No rows.";
  const header = "| Player | Pos | Team | Decision | Final Class | Points Delta | Current G | v8.2 G | Rationale |";
  const divider = "|---|---|---|---|---|---:|---:|---:|---|";
  return [header, divider, ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.team ?? ""} | ${row.decision ?? ""} | ${row.finalClassification} | ${row.projectedTotalPointDelta ?? ""} | ${row.currentExpectedGames ?? ""} | ${row.v82ExpectedGames ?? ""} | ${row.decisionRationale ?? ""} |`)].join("\n");
}

function readRawDecisionRows(filePath: string) {
  const resolved = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!existsSync(resolved)) throw new Error(`Decision file not found: ${filePath}`);
  if (resolved.endsWith(".json")) {
    const rows = JSON.parse(readFileSync(resolved, "utf8")) as Array<Record<string, unknown>>;
    return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value ?? "")])));
  }
  return parseRawCsv(readFileSync(resolved, "utf8"));
}

function parseRawCsv(csv: string) {
  const [headerRow, ...dataRows] = parseCsv(csv).filter((row) => row.some((cell) => cell.trim()));
  if (!headerRow) return [];
  const headers = headerRow.map((header) => header.trim());
  return dataRows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
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
