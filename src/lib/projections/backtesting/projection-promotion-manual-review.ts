import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { PreseasonProjectionSnapshot } from "./preseason-projection-snapshot-types";
import type { ProjectionPromotionCandidatePoolReport, ProjectionPromotionCandidateRow } from "./projection-promotion-candidate-pool-types";
import type {
  ProjectionPromotionManualReviewAction,
  ProjectionPromotionManualReviewArtifactPaths,
  ProjectionPromotionManualReviewOptions,
  ProjectionPromotionManualReviewReport,
  ProjectionPromotionManualReviewRow,
  ProjectionPromotionManualReviewVerdict,
} from "./projection-promotion-manual-review-types";
import type { ProjectionUniverseEligibilityAuditReport } from "./projection-universe-eligibility-audit-types";
import type { ProjectionV82ShadowReport, ProjectionV82ShadowRow } from "./projection-v8-2-shadow-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const ACTIONS: ProjectionPromotionManualReviewAction[] = [
  "approve_for_candidate_pool",
  "keep_shadow_only",
  "block_from_promotion",
  "needs_roster_confirmation",
  "needs_model_policy_review",
  "needs_kicker_policy_review",
];
const HIGH_IMPACT_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);

export function runProjectionPromotionManualReview(options: ProjectionPromotionManualReviewOptions): ProjectionPromotionManualReviewReport {
  const snapshotPath = path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`);
  const shadowPath = path.join(OUTPUT_DIR, `projection-v8-2-shadow-${options.projectionSeason}.json`);
  const universePath = path.join(OUTPUT_DIR, `projection-universe-eligibility-audit-${options.projectionSeason}.json`);
  const candidatePoolPath = path.join(OUTPUT_DIR, `projection-promotion-candidate-pool-${options.projectionSeason}.json`);
  if (!existsSync(snapshotPath)) throw new Error(`Missing ${path.relative(process.cwd(), snapshotPath)}. Run npm run projection:snapshot:preseason -- --target-season=${options.projectionSeason} --include-idp first.`);
  if (!existsSync(shadowPath)) throw new Error(`Missing ${path.relative(process.cwd(), shadowPath)}. Run npm run projection:v8-2:shadow -- --projection-season=${options.projectionSeason} --include-idp first.`);
  if (!existsSync(universePath)) throw new Error(`Missing ${path.relative(process.cwd(), universePath)}. Run npm run projection:universe:eligibility:audit -- --projection-season=${options.projectionSeason} --include-idp first.`);
  if (!existsSync(candidatePoolPath)) throw new Error(`Missing ${path.relative(process.cwd(), candidatePoolPath)}. Run npm run projection:promotion:candidate-pool -- --projection-season=${options.projectionSeason} --include-idp first.`);

  return buildProjectionPromotionManualReviewFromData({
    snapshot: JSON.parse(readFileSync(snapshotPath, "utf8")) as PreseasonProjectionSnapshot,
    shadow: JSON.parse(readFileSync(shadowPath, "utf8")) as ProjectionV82ShadowReport,
    universe: JSON.parse(readFileSync(universePath, "utf8")) as ProjectionUniverseEligibilityAuditReport,
    candidatePool: JSON.parse(readFileSync(candidatePoolPath, "utf8")) as ProjectionPromotionCandidatePoolReport,
    options,
    sourceArtifacts: {
      snapshot: snapshotPath,
      shadow: shadowPath,
      universeEligibilityAudit: universePath,
      promotionCandidatePool: candidatePoolPath,
    },
  });
}

export function buildProjectionPromotionManualReviewFromData(input: {
  snapshot: PreseasonProjectionSnapshot;
  shadow: ProjectionV82ShadowReport;
  universe: ProjectionUniverseEligibilityAuditReport;
  candidatePool: ProjectionPromotionCandidatePoolReport;
  options: ProjectionPromotionManualReviewOptions;
  sourceArtifacts?: ProjectionPromotionManualReviewReport["sourceArtifacts"];
}): ProjectionPromotionManualReviewReport {
  const shadowByPlayerId = new Map(input.shadow.rows.map((row) => [row.playerId, row]));
  const rows = input.candidatePool.rows
    .filter((row) => row.promotionEligibilityClassification === "manual_review_before_promotion")
    .map((row) => manualReviewRow(row, shadowByPlayerId.get(row.playerId) ?? null))
    .sort(compareByAbsMovement);
  const rowsByProposedAction = Object.fromEntries(ACTIONS.map((action) => [action, rows.filter((row) => row.proposedReviewAction === action).sort(compareByAbsMovement)])) as Record<ProjectionPromotionManualReviewAction, ProjectionPromotionManualReviewRow[]>;
  const safetyGates = buildSafetyGates(rows);
  const verdict = verdictFor(rows, safetyGates);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? {
      snapshot: "in-memory",
      shadow: "in-memory",
      universeEligibilityAudit: "in-memory",
      promotionCandidatePool: "in-memory",
    },
    summary: {
      totalManualReviewRows: rows.length,
      proposedActionCounts: actionCounts(rows),
      byPosition: countBy(rows.map((row) => row.position)),
      byUniverseEligibilityStatus: countBy(rows.map((row) => row.universeEligibilityStatus)),
      byPromotionReasonCode: countBy(rows.flatMap((row) => row.promotionReasonCodes)),
      criticalMovementRows: rows.filter((row) => row.criticalMovement).length,
      kickerManualReviewRows: rows.filter((row) => row.position === "K").length,
      rookieNewPlayerRows: rows.filter((row) => row.universeEligibilityStatus === "rookie_or_new_player").length,
      veteranManualReviewRows: rows.filter((row) => row.universeEligibilityStatus !== "rookie_or_new_player" && row.position !== "K").length,
      canProceedAfterHumanDecisions: rows.length > 0 && safetyGates.every((gate) => gate.passed),
    },
    rows,
    topManualReviewRows: rows.slice(0, 25),
    kickerManualReviewRows: rows.filter((row) => row.position === "K").sort(compareByAbsMovement),
    rookieNewPlayerManualReviewRows: rows.filter((row) => row.universeEligibilityStatus === "rookie_or_new_player").sort(compareByAbsMovement),
    veteranManualReviewRows: rows.filter((row) => row.universeEligibilityStatus !== "rookie_or_new_player" && row.position !== "K").sort(compareByAbsMovement),
    highImpactManualReviewRows: rows.filter((row) => HIGH_IMPACT_POSITIONS.has(row.position)).sort(compareByAbsMovement),
    rowsByProposedAction,
    safetyGates,
    verdict,
    notes: [
      "Dry-run/read-only manual review packet only.",
      "Rows are copied from the manual-review classification in the promotion candidate pool; the candidate-pool classifications are not modified.",
      "No live projections, 2026 production outputs, Supabase writes, War Room UI, Blackbird Rank, or Draft Suggestion ordering are changed.",
      "Proposed actions are review guidance only and do not approve or promote v8.2.",
    ],
  };
}

export function writeProjectionPromotionManualReviewArtifacts(report: ProjectionPromotionManualReviewReport): ProjectionPromotionManualReviewArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-promotion-manual-review-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderProjectionPromotionManualReviewMarkdown(report), "utf8");
  writeFileSync(csvPath, renderProjectionPromotionManualReviewCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

export function manualReviewRow(candidateRow: ProjectionPromotionCandidateRow, shadowRow: ProjectionV82ShadowRow | null): ProjectionPromotionManualReviewRow {
  const proposedReviewAction = proposedActionFor(candidateRow, shadowRow);
  return {
    playerId: candidateRow.playerId,
    sleeperId: candidateRow.sleeperId,
    gsisId: candidateRow.gsisId,
    player: candidateRow.player,
    position: candidateRow.position,
    team: candidateRow.team,
    universeEligibilityStatus: candidateRow.universeEligibilityStatus,
    promotionClassification: candidateRow.promotionEligibilityClassification,
    promotionReasonCodes: [...candidateRow.reasonCodes],
    currentExpectedGames: candidateRow.currentExpectedGames,
    v82ExpectedGames: candidateRow.v82ExpectedGames,
    gamesDelta: candidateRow.gamesDelta,
    scoringAnchorPpg: shadowRow?.ppgAnchor ?? null,
    projectedTotalPointDelta: candidateRow.projectedTotalPointDelta,
    movementBucket: candidateRow.movementBucket,
    criticalMovement: candidateRow.criticalMovement,
    estimatedPositionRankMovement: shadowRow?.estimatedPositionRankMovement ?? null,
    estimatedOverallRankMovement: candidateRow.estimatedOverallRankMovement,
    v82GuardrailReasonCodes: shadowRow?.reasonCodes ?? [],
    riskFlags: [...candidateRow.riskFlags],
    proposedReviewAction,
    reviewRationale: rationaleFor(candidateRow, shadowRow, proposedReviewAction),
  };
}

export function renderProjectionPromotionManualReviewMarkdown(report: ProjectionPromotionManualReviewReport): string {
  return `# Projection Promotion Manual Review ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Verdict: ${report.verdict}

## Promotion Readiness Summary

\`\`\`json
${JSON.stringify(report.summary, null, 2)}
\`\`\`

## Safety Gates

${renderGateTable(report.safetyGates)}

## Top Manual-Review Rows

${renderRowsTable(report.topManualReviewRows)}

## Kicker Manual-Review Rows

${renderRowsTable(report.kickerManualReviewRows)}

## Rookie / New-Player Manual-Review Rows

${renderRowsTable(report.rookieNewPlayerManualReviewRows)}

## High-Impact QB/RB/WR/TE Manual-Review Rows

${renderRowsTable(report.highImpactManualReviewRows)}

## Proposed Action Tables

${ACTIONS.map((action) => `### ${action}\n\n${renderRowsTable(report.rowsByProposedAction[action])}`).join("\n\n")}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

export function renderProjectionPromotionManualReviewCsv(report: ProjectionPromotionManualReviewReport): string {
  const headers = [
    "player_id",
    "sleeper_id",
    "gsis_id",
    "player",
    "position",
    "team",
    "universe_eligibility_status",
    "promotion_classification",
    "promotion_reason_codes",
    "current_expected_games",
    "v82_expected_games",
    "games_delta",
    "scoring_anchor_ppg",
    "projected_total_point_delta",
    "movement_bucket",
    "critical_movement",
    "estimated_position_rank_movement",
    "estimated_overall_rank_movement",
    "v82_guardrail_reason_codes",
    "risk_flags",
    "proposed_review_action",
    "review_rationale",
  ];
  const rows = report.rows.map((row) => [
    row.playerId,
    row.sleeperId ?? "",
    row.gsisId ?? "",
    row.player,
    row.position,
    row.team ?? "",
    row.universeEligibilityStatus,
    row.promotionClassification,
    row.promotionReasonCodes.join("|"),
    row.currentExpectedGames ?? "",
    row.v82ExpectedGames ?? "",
    row.gamesDelta ?? "",
    row.scoringAnchorPpg ?? "",
    row.projectedTotalPointDelta ?? "",
    row.movementBucket,
    row.criticalMovement,
    row.estimatedPositionRankMovement ?? "",
    row.estimatedOverallRankMovement ?? "",
    row.v82GuardrailReasonCodes.join("|"),
    row.riskFlags.join("|"),
    row.proposedReviewAction,
    row.reviewRationale.join("|"),
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function proposedActionFor(row: ProjectionPromotionCandidateRow, shadowRow: ProjectionV82ShadowRow | null): ProjectionPromotionManualReviewAction {
  const absPointDelta = Math.abs(row.projectedTotalPointDelta ?? 0);
  if (row.position === "K") return "needs_kicker_policy_review";
  if (row.universeEligibilityStatus === "retired_or_legacy_suspect" || row.riskFlags.includes("retired_legacy_suspect")) return "block_from_promotion";
  if (!row.team || row.riskFlags.includes("missing_team")) return "needs_roster_confirmation";
  if (row.universeEligibilityStatus === "rookie_or_new_player" && absPointDelta >= 20) return "needs_roster_confirmation";
  if (absPointDelta >= 20 || row.criticalMovement || shadowRow?.risk === "critical") return "needs_model_policy_review";
  if (row.riskFlags.length === 0 && row.universeEligibilityStatus === "active_plausible") return "approve_for_candidate_pool";
  return "keep_shadow_only";
}

function rationaleFor(row: ProjectionPromotionCandidateRow, shadowRow: ProjectionV82ShadowRow | null, action: ProjectionPromotionManualReviewAction) {
  const reasons: string[] = [];
  if (row.position === "K") reasons.push("K rows are excluded from initial promotion eligibility until kicker fallback policy is reviewed.");
  if (row.universeEligibilityStatus === "retired_or_legacy_suspect") reasons.push("Universe audit marked this row as retired/legacy suspect.");
  if (!row.team || row.riskFlags.includes("missing_team")) reasons.push("Roster/team signal is ambiguous or missing.");
  if (row.universeEligibilityStatus === "rookie_or_new_player") reasons.push("Rookie/new-player movement needs roster and role confirmation before promotion.");
  if (row.criticalMovement) reasons.push("v8.2 movement is critical and must be reviewed before promotion.");
  if (Math.abs(row.projectedTotalPointDelta ?? 0) >= 20) reasons.push("Projected total-point movement is 20+ points.");
  if (shadowRow?.reasonCodes.length) reasons.push(`v8.2 guardrail reasons: ${shadowRow.reasonCodes.join(", ")}.`);
  if (!reasons.length && action === "approve_for_candidate_pool") reasons.push("Manual-review row has clean risk flags and sub-critical movement.");
  if (!reasons.length) reasons.push("Manual-review row remains noisy enough to keep shadow-only pending human review.");
  return reasons;
}

function buildSafetyGates(rows: ProjectionPromotionManualReviewRow[]) {
  const kRows = rows.filter((row) => row.position === "K");
  const legacyRows = rows.filter((row) => row.universeEligibilityStatus === "retired_or_legacy_suspect");
  return [
    gate("manual_review_rows_only", rows.every((row) => row.promotionClassification === "manual_review_before_promotion"), `${rows.length} manual-review rows included.`),
    gate("k_rows_not_auto_approved", kRows.every((row) => row.proposedReviewAction === "needs_kicker_policy_review"), `${kRows.length} K manual-review rows checked.`),
    gate("legacy_rows_blocked", legacyRows.every((row) => row.proposedReviewAction === "block_from_promotion"), `${legacyRows.length} legacy manual-review rows checked.`),
    gate("critical_rows_not_auto_approved", rows.filter((row) => row.criticalMovement).every((row) => row.proposedReviewAction !== "approve_for_candidate_pool"), `${rows.filter((row) => row.criticalMovement).length} critical rows checked.`),
    gate("no_live_outputs_changed", true, "Manual-review packet reads dry-run artifacts and writes only review artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Rank movement is copied from shadow diagnostics only."),
    gate("draft_suggestions_unchanged", true, "Draft suggestion code paths are not imported or executed."),
    gate("war_room_unchanged", true, "War Room UI code is not imported or modified."),
  ];
}

function verdictFor(rows: ProjectionPromotionManualReviewRow[], gates: ProjectionPromotionManualReviewReport["safetyGates"]): ProjectionPromotionManualReviewVerdict {
  if (!rows.length) return "manual_review_no_rows";
  if (gates.some((gate) => !gate.passed)) return "manual_review_packet_blocked";
  return "manual_review_packet_ready";
}

function actionCounts(rows: ProjectionPromotionManualReviewRow[]) {
  return Object.fromEntries(ACTIONS.map((action) => [action, rows.filter((row) => row.proposedReviewAction === action).length])) as Record<ProjectionPromotionManualReviewAction, number>;
}

function renderGateTable(gates: ProjectionPromotionManualReviewReport["safetyGates"]) {
  const header = "| Gate | Status | Detail |";
  const divider = "|---|---|---|";
  return [header, divider, ...gates.map((gate) => `| ${gate.name} | ${gate.passed ? "PASS" : "FAIL"} | ${gate.detail} |`)].join("\n");
}

function renderRowsTable(rows: ProjectionPromotionManualReviewRow[]) {
  if (!rows.length) return "No rows.";
  const header = "| Player | Pos | Team | Universe | Points Delta | PPG | Current G | v8.2 G | Action | Rationale |";
  const divider = "|---|---|---|---|---:|---:|---:|---:|---|---|";
  return [header, divider, ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.team ?? ""} | ${row.universeEligibilityStatus} | ${row.projectedTotalPointDelta ?? ""} | ${row.scoringAnchorPpg ?? ""} | ${row.currentExpectedGames ?? ""} | ${row.v82ExpectedGames ?? ""} | ${row.proposedReviewAction} | ${row.reviewRationale.join(" ")} |`)].join("\n");
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function countBy(values: string[]) {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function compareByAbsMovement(a: ProjectionPromotionManualReviewRow, b: ProjectionPromotionManualReviewRow) {
  return Math.abs(b.projectedTotalPointDelta ?? 0) - Math.abs(a.projectedTotalPointDelta ?? 0) || a.player.localeCompare(b.player);
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
