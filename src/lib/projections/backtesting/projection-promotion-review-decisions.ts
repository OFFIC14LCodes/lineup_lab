import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ProjectionPromotionCandidatePoolReport } from "./projection-promotion-candidate-pool-types";
import type { ProjectionPromotionManualReviewReport, ProjectionPromotionManualReviewRow } from "./projection-promotion-manual-review-types";
import type {
  ProjectionPromotionResolvedDecisionRow,
  ProjectionPromotionReviewDecision,
  ProjectionPromotionReviewDecisionArtifactPaths,
  ProjectionPromotionReviewDecisionOptions,
  ProjectionPromotionReviewDecisionReport,
  ProjectionPromotionReviewDecisionTemplateRow,
  ProjectionPromotionReviewDecisionVerdict,
} from "./projection-promotion-review-decisions-types";
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
const CLASSIFICATIONS = ["eligible_for_projection_promotion", "manual_review_before_promotion", "shadow_only", "blocked_from_promotion"] as const;

export function runProjectionPromotionReviewDecisions(options: ProjectionPromotionReviewDecisionOptions): ProjectionPromotionReviewDecisionReport {
  const shadowPath = path.join(OUTPUT_DIR, `projection-v8-2-shadow-${options.projectionSeason}.json`);
  const universePath = path.join(OUTPUT_DIR, `projection-universe-eligibility-audit-${options.projectionSeason}.json`);
  const candidatePoolPath = path.join(OUTPUT_DIR, `projection-promotion-candidate-pool-${options.projectionSeason}.json`);
  const manualReviewPath = path.join(OUTPUT_DIR, `projection-promotion-manual-review-${options.projectionSeason}.json`);
  if (!existsSync(shadowPath)) throw new Error(`Missing ${path.relative(process.cwd(), shadowPath)}. Run npm run projection:v8-2:shadow -- --projection-season=${options.projectionSeason} --include-idp first.`);
  if (!existsSync(universePath)) throw new Error(`Missing ${path.relative(process.cwd(), universePath)}. Run npm run projection:universe:eligibility:audit -- --projection-season=${options.projectionSeason} --include-idp first.`);
  if (!existsSync(candidatePoolPath)) throw new Error(`Missing ${path.relative(process.cwd(), candidatePoolPath)}. Run npm run projection:promotion:candidate-pool -- --projection-season=${options.projectionSeason} --include-idp first.`);
  if (!existsSync(manualReviewPath)) throw new Error(`Missing ${path.relative(process.cwd(), manualReviewPath)}. Run npm run projection:promotion:manual-review -- --projection-season=${options.projectionSeason} --include-idp first.`);

  return buildProjectionPromotionReviewDecisionsFromData({
    shadow: JSON.parse(readFileSync(shadowPath, "utf8")) as ProjectionV82ShadowReport,
    universe: JSON.parse(readFileSync(universePath, "utf8")) as ProjectionUniverseEligibilityAuditReport,
    candidatePool: JSON.parse(readFileSync(candidatePoolPath, "utf8")) as ProjectionPromotionCandidatePoolReport,
    manualReview: JSON.parse(readFileSync(manualReviewPath, "utf8")) as ProjectionPromotionManualReviewReport,
    decisions: options.decisionsFile ? readDecisionRows(options.decisionsFile) : null,
    options,
    sourceArtifacts: {
      shadow: shadowPath,
      universeEligibilityAudit: universePath,
      promotionCandidatePool: candidatePoolPath,
      promotionManualReview: manualReviewPath,
    },
  });
}

export function buildProjectionPromotionReviewDecisionsFromData(input: {
  shadow: ProjectionV82ShadowReport;
  universe: ProjectionUniverseEligibilityAuditReport;
  candidatePool: ProjectionPromotionCandidatePoolReport;
  manualReview: ProjectionPromotionManualReviewReport;
  decisions?: ProjectionPromotionReviewDecisionTemplateRow[] | null;
  options: ProjectionPromotionReviewDecisionOptions;
  sourceArtifacts?: ProjectionPromotionReviewDecisionReport["sourceArtifacts"];
}): ProjectionPromotionReviewDecisionReport {
  const templateRows = input.manualReview.rows.map(templateRowFor);
  const decisionsByPlayerId = new Map((input.decisions ?? []).map((row) => [row.playerId, row]));
  const resolvedRows = templateRows.map((row) => resolveRow(row, input.manualReview.rows.find((candidate) => candidate.playerId === row.playerId), decisionsByPlayerId.get(row.playerId) ?? null));
  const originalCandidatePool = classificationCounts(input.candidatePool.rows.map((row) => row.promotionEligibilityClassification));
  const resolvedCandidatePool = resolvedClassificationCounts(input.candidatePool, resolvedRows);
  const unresolvedRows = resolvedRows.filter((row) => row.humanOrDefaultDecision === "unresolved");
  const unresolvedNonKRows = unresolvedRows.filter((row) => row.position !== "K");
  const safetyGates = buildSafetyGates(templateRows, resolvedRows);
  const verdict = verdictFor(unresolvedRows, safetyGates);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    decisionsFile: input.options.decisionsFile ?? null,
    sourceArtifacts: input.sourceArtifacts ?? {
      shadow: "in-memory",
      universeEligibilityAudit: "in-memory",
      promotionCandidatePool: "in-memory",
      promotionManualReview: "in-memory",
    },
    templateRows,
    resolvedRows,
    summary: {
      defaultDecisionCounts: decisionCounts(templateRows.map((row) => row.recommendedDefaultDecision)),
      resolvedDecisionCounts: decisionCounts(resolvedRows.map((row) => row.humanOrDefaultDecision)),
      originalCandidatePool,
      resolvedCandidatePool,
      eligibleRows: resolvedCandidatePool.eligible_for_projection_promotion,
      manualReviewRowsRemaining: resolvedCandidatePool.manual_review_before_promotion,
      shadowOnlyRows: resolvedCandidatePool.shadow_only,
      blockedRows: resolvedCandidatePool.blocked_from_promotion,
      kRows: resolvedRows.filter((row) => row.position === "K").length,
      criticalMovementRows: resolvedRows.filter((row) => row.criticalMovement).length,
      nonKCriticalMovementRows: resolvedRows.filter((row) => row.criticalMovement && row.position !== "K").length,
      unresolvedRows: unresolvedRows.length,
    },
    unresolvedNonKRows,
    safetyGates,
    verdict,
    notes: [
      "Dry-run/read-only review decision registry only.",
      "Default decisions do not promote v8.2 and do not mutate the promotion candidate pool.",
      "K rows default to needs_kicker_policy_review and resolve to shadow_only for the current promotion round.",
      "Critical non-K rows default to unresolved and remain manual_review_before_promotion until human review.",
      "No live projections, 2026 production outputs, Supabase writes, War Room UI, Blackbird Rank, or Draft Suggestion ordering are changed.",
    ],
  };
}

export function writeProjectionPromotionReviewDecisionArtifacts(report: ProjectionPromotionReviewDecisionReport): ProjectionPromotionReviewDecisionArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-promotion-review-decisions-${report.projectionSeason}`;
  const templateCsvPath = path.join(OUTPUT_DIR, `${base}.template.csv`);
  const templateJsonPath = path.join(OUTPUT_DIR, `${base}.template.json`);
  const resolvedJsonPath = path.join(OUTPUT_DIR, `${base}.resolved.json`);
  const resolvedMarkdownPath = path.join(OUTPUT_DIR, `${base}.resolved.md`);
  const resolvedCsvPath = path.join(OUTPUT_DIR, `${base}.resolved.csv`);
  writeFileSync(templateCsvPath, renderDecisionTemplateCsv(report.templateRows), "utf8");
  writeFileSync(templateJsonPath, `${JSON.stringify(report.templateRows, null, 2)}\n`, "utf8");
  writeFileSync(resolvedJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(resolvedMarkdownPath, renderResolvedDecisionMarkdown(report), "utf8");
  writeFileSync(resolvedCsvPath, renderResolvedDecisionCsv(report), "utf8");
  return { templateCsvPath, templateJsonPath, resolvedJsonPath, resolvedMarkdownPath, resolvedCsvPath };
}

export function templateRowFor(row: ProjectionPromotionManualReviewRow): ProjectionPromotionReviewDecisionTemplateRow {
  const recommendedDefaultDecision = defaultDecisionFor(row);
  return {
    playerId: row.playerId,
    player: row.player,
    position: row.position,
    team: row.team,
    currentProposedAction: row.proposedReviewAction,
    movementAmount: row.projectedTotalPointDelta,
    currentExpectedGames: row.currentExpectedGames,
    v82ExpectedGames: row.v82ExpectedGames,
    gamesDelta: row.gamesDelta,
    ppgAnchor: row.scoringAnchorPpg,
    riskFlags: [...row.riskFlags],
    reasonCodes: [...row.promotionReasonCodes],
    recommendedDefaultDecision,
    decision: recommendedDefaultDecision,
    decisionRationale: defaultRationaleFor(recommendedDefaultDecision),
    reviewer: "",
    reviewedAt: "",
  };
}

export function resolveDecisionToClassification(decision: ProjectionPromotionReviewDecision) {
  if (decision === "approve_for_candidate_pool") return "eligible_for_projection_promotion";
  if (decision === "keep_shadow_only" || decision === "use_current_path_for_now" || decision === "needs_kicker_policy_review") return "shadow_only";
  if (decision === "block_from_promotion") return "blocked_from_promotion";
  return "manual_review_before_promotion";
}

export function renderDecisionTemplateCsv(rows: ProjectionPromotionReviewDecisionTemplateRow[]) {
  const headers = templateHeaders();
  return [headers, ...rows.map(templateValues)].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

export function renderResolvedDecisionCsv(report: ProjectionPromotionReviewDecisionReport) {
  const headers = [
    ...templateHeaders(),
    "original_promotion_classification",
    "manual_review_proposed_action",
    "human_or_default_decision",
    "resolved_classification",
    "resolved_action",
    "universe_eligibility_status",
    "critical_movement",
    "source",
  ];
  const rows = report.resolvedRows.map((row) => [
    ...templateValues(row),
    row.originalPromotionClassification,
    row.manualReviewProposedAction,
    row.humanOrDefaultDecision,
    row.resolvedClassification,
    row.resolvedAction,
    row.universeEligibilityStatus,
    row.criticalMovement,
    row.source,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

export function readDecisionRows(filePath: string): ProjectionPromotionReviewDecisionTemplateRow[] {
  const resolved = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!existsSync(resolved)) throw new Error(`Decision file not found: ${filePath}`);
  if (resolved.endsWith(".json")) return JSON.parse(readFileSync(resolved, "utf8")) as ProjectionPromotionReviewDecisionTemplateRow[];
  return parseDecisionTemplateCsv(readFileSync(resolved, "utf8"));
}

export function parseDecisionTemplateCsv(csv: string): ProjectionPromotionReviewDecisionTemplateRow[] {
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
      currentProposedAction: record.current_proposed_action as ProjectionPromotionReviewDecisionTemplateRow["currentProposedAction"],
      movementAmount: numberOrNull(record.movement_amount),
      currentExpectedGames: numberOrNull(record.current_expected_games),
      v82ExpectedGames: numberOrNull(record.v82_expected_games),
      gamesDelta: numberOrNull(record.games_delta),
      ppgAnchor: numberOrNull(record.ppg_anchor),
      riskFlags: splitList(record.risk_flags),
      reasonCodes: splitList(record.reason_codes),
      recommendedDefaultDecision: normalizeDecision(record.recommended_default_decision),
      decision: normalizeDecision(record.decision),
      decisionRationale: record.decision_rationale,
      reviewer: record.reviewer,
      reviewedAt: record.reviewed_at,
    };
  });
}

function resolveRow(template: ProjectionPromotionReviewDecisionTemplateRow, manualReviewRow: ProjectionPromotionManualReviewRow | undefined, decisionOverride: ProjectionPromotionReviewDecisionTemplateRow | null): ProjectionPromotionResolvedDecisionRow {
  const decision = normalizeDecision(decisionOverride?.decision ?? template.decision);
  const decisionRationale = decisionOverride?.decisionRationale || template.decisionRationale;
  const resolvedClassification = resolveDecisionToClassification(decision);
  return {
    ...template,
    decision,
    decisionRationale,
    reviewer: decisionOverride?.reviewer ?? template.reviewer,
    reviewedAt: decisionOverride?.reviewedAt ?? template.reviewedAt,
    originalPromotionClassification: manualReviewRow?.promotionClassification ?? "manual_review_before_promotion",
    manualReviewProposedAction: manualReviewRow?.proposedReviewAction ?? template.currentProposedAction,
    humanOrDefaultDecision: decision,
    resolvedClassification,
    resolvedAction: resolvedActionFor(decision),
    universeEligibilityStatus: manualReviewRow?.universeEligibilityStatus ?? "manual_review_required",
    criticalMovement: manualReviewRow?.criticalMovement ?? template.riskFlags.includes("critical_movement"),
    source: decisionOverride ? "decision_file" : "default",
  };
}

function defaultDecisionFor(row: ProjectionPromotionManualReviewRow): ProjectionPromotionReviewDecision {
  if (row.position === "K") return "needs_kicker_policy_review";
  if (row.universeEligibilityStatus === "retired_or_legacy_suspect" || row.riskFlags.includes("retired_legacy_suspect")) return "block_from_promotion";
  if (row.criticalMovement || Math.abs(row.projectedTotalPointDelta ?? 0) >= 20) return "unresolved";
  if (row.riskFlags.length === 0 && row.universeEligibilityStatus === "active_plausible") return "approve_for_candidate_pool";
  return "unresolved";
}

function resolvedClassificationCounts(candidatePool: ProjectionPromotionCandidatePoolReport, resolvedRows: ProjectionPromotionResolvedDecisionRow[]) {
  const counts = classificationCounts(candidatePool.rows.map((row) => row.promotionEligibilityClassification));
  for (const row of resolvedRows) {
    counts.manual_review_before_promotion -= 1;
    counts[row.resolvedClassification] += 1;
  }
  return counts;
}

function buildSafetyGates(templateRows: ProjectionPromotionReviewDecisionTemplateRow[], resolvedRows: ProjectionPromotionResolvedDecisionRow[]) {
  const kRows = resolvedRows.filter((row) => row.position === "K");
  const criticalRows = resolvedRows.filter((row) => row.criticalMovement);
  const unresolvedRows = resolvedRows.filter((row) => row.humanOrDefaultDecision === "unresolved");
  return [
    gate("no_live_outputs_changed", true, "Decision resolver reads dry-run artifacts and writes only decision artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Rank movement remains copied from dry-run diagnostics only."),
    gate("draft_suggestions_unchanged", true, "Draft suggestion code paths are not imported or executed."),
    gate("war_room_unchanged", true, "War Room UI code is not imported or modified."),
    gate("decision_template_generated", templateRows.length > 0, `${templateRows.length} template rows generated.`),
    gate("k_rows_not_auto_approved", kRows.every((row) => row.humanOrDefaultDecision !== "approve_for_candidate_pool"), `${kRows.length} K decision rows checked.`),
    gate("critical_rows_not_auto_approved", criticalRows.every((row) => row.humanOrDefaultDecision !== "approve_for_candidate_pool"), `${criticalRows.length} critical rows checked.`),
    gate("resolved_pool_generated", resolvedRows.length === templateRows.length, `${resolvedRows.length} resolved rows generated.`),
    gate("unresolved_rows_reported", unresolvedRows.length === 0 || unresolvedRows.every((row) => row.resolvedClassification === "manual_review_before_promotion"), `${unresolvedRows.length} unresolved rows reported.`),
  ];
}

function verdictFor(unresolvedRows: ProjectionPromotionResolvedDecisionRow[], gates: ProjectionPromotionReviewDecisionReport["safetyGates"]): ProjectionPromotionReviewDecisionVerdict {
  if (gates.some((gate) => !gate.passed)) return "review_decisions_blocked";
  if (unresolvedRows.length) return "review_decisions_unresolved_rows_remaining";
  return "review_decisions_ready";
}

function renderResolvedDecisionMarkdown(report: ProjectionPromotionReviewDecisionReport) {
  return `# Projection Promotion Review Decisions ${report.projectionSeason}

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

## Unresolved Non-K Rows

${renderRowsTable(report.unresolvedNonKRows)}

## Resolved Rows

${renderRowsTable(report.resolvedRows)}

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
    "current_proposed_action",
    "movement_amount",
    "current_expected_games",
    "v82_expected_games",
    "games_delta",
    "ppg_anchor",
    "risk_flags",
    "reason_codes",
    "recommended_default_decision",
    "decision",
    "decision_rationale",
    "reviewer",
    "reviewed_at",
  ];
}

function templateValues(row: ProjectionPromotionReviewDecisionTemplateRow) {
  return [
    row.playerId,
    row.player,
    row.position,
    row.team ?? "",
    row.currentProposedAction,
    row.movementAmount ?? "",
    row.currentExpectedGames ?? "",
    row.v82ExpectedGames ?? "",
    row.gamesDelta ?? "",
    row.ppgAnchor ?? "",
    row.riskFlags.join("|"),
    row.reasonCodes.join("|"),
    row.recommendedDefaultDecision,
    row.decision,
    row.decisionRationale,
    row.reviewer,
    row.reviewedAt,
  ];
}

function renderGateTable(gates: ProjectionPromotionReviewDecisionReport["safetyGates"]) {
  const header = "| Gate | Status | Detail |";
  const divider = "|---|---|---|";
  return [header, divider, ...gates.map((gate) => `| ${gate.name} | ${gate.passed ? "PASS" : "FAIL"} | ${gate.detail} |`)].join("\n");
}

function renderRowsTable(rows: ProjectionPromotionResolvedDecisionRow[]) {
  if (!rows.length) return "No rows.";
  const header = "| Player | Pos | Team | Decision | Resolved Class | Points Delta | Current G | v8.2 G | Rationale |";
  const divider = "|---|---|---|---|---|---:|---:|---:|---|";
  return [header, divider, ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.team ?? ""} | ${row.humanOrDefaultDecision} | ${row.resolvedClassification} | ${row.movementAmount ?? ""} | ${row.currentExpectedGames ?? ""} | ${row.v82ExpectedGames ?? ""} | ${row.decisionRationale} |`)].join("\n");
}

function defaultRationaleFor(decision: ProjectionPromotionReviewDecision) {
  if (decision === "needs_kicker_policy_review") return "Default decision: K rows require kicker policy review and remain shadow-only for this promotion round.";
  if (decision === "block_from_promotion") return "Default decision: retired/legacy suspect should be blocked from promotion.";
  if (decision === "approve_for_candidate_pool") return "Default decision: active non-critical row with clean risk flags may enter candidate pool.";
  if (decision === "unresolved") return "Default decision: critical non-K movement requires human review before promotion.";
  return `Default decision: ${decision}.`;
}

function resolvedActionFor(decision: ProjectionPromotionReviewDecision) {
  if (decision === "approve_for_candidate_pool") return "move_to_eligible_pool_for_future_review";
  if (decision === "keep_shadow_only" || decision === "use_current_path_for_now") return "keep_current_path_for_this_promotion_round";
  if (decision === "needs_kicker_policy_review") return "keep_k_shadow_only_until_policy_review";
  if (decision === "block_from_promotion") return "exclude_from_promotion_pool";
  if (decision === "cap_v8_2_movement") return "requires_cap_policy_artifact_before_resolution";
  if (decision === "needs_external_roster_confirmation") return "requires_roster_confirmation_before_resolution";
  return "requires_human_decision_before_resolution";
}

function decisionCounts(values: ProjectionPromotionReviewDecision[]) {
  return Object.fromEntries(DECISIONS.map((decision) => [decision, values.filter((value) => value === decision).length])) as Record<ProjectionPromotionReviewDecision, number>;
}

function classificationCounts(values: string[]) {
  return Object.fromEntries(CLASSIFICATIONS.map((classification) => [classification, values.filter((value) => value === classification).length])) as Record<(typeof CLASSIFICATIONS)[number], number>;
}

function normalizeDecision(value: string | undefined): ProjectionPromotionReviewDecision {
  return DECISIONS.includes(value as ProjectionPromotionReviewDecision) ? value as ProjectionPromotionReviewDecision : "unresolved";
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
