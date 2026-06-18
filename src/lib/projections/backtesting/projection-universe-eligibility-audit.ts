import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { PreseasonProjectionSnapshot, PreseasonProjectionSnapshotRow } from "./preseason-projection-snapshot-types";
import type { ProjectionV82ShadowReport, ProjectionV82ShadowRow } from "./projection-v8-2-shadow-types";
import type {
  ProjectionUniverseEligibilityAuditArtifactPaths,
  ProjectionUniverseEligibilityAuditOptions,
  ProjectionUniverseEligibilityAuditReport,
  ProjectionUniverseEligibilityReasonCode,
  ProjectionUniverseEligibilityRow,
  ProjectionUniverseEligibilityStatus,
  ProjectionUniverseEligibilitySummaryRow,
  ProjectionUniverseRecommendedAction,
  ProjectionUniverseReadinessVerdict,
} from "./projection-universe-eligibility-audit-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const CURRENT_MODEL = "blackbird_expected_games_v7_family_selective";
const LEGACY_MANUAL_REVIEW_NAMES = new Set(["eli manning", "philip rivers"]);
const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DL", "LB", "DB", "DST"];
const COHORTS = ["rookie_or_new_player", "low_prior_sample", "stale_historical_signal", "retired_or_legacy_suspect", "manual_review_required", "idp", "offense", "kicker"];

export function runProjectionUniverseEligibilityAudit(options: ProjectionUniverseEligibilityAuditOptions): ProjectionUniverseEligibilityAuditReport {
  const snapshotPath = path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`);
  const shadowPath = path.join(OUTPUT_DIR, `projection-v8-2-shadow-${options.projectionSeason}.json`);
  if (!existsSync(snapshotPath)) throw new Error(`Missing ${path.relative(process.cwd(), snapshotPath)}. Run npm run projection:snapshot:preseason -- --target-season=${options.projectionSeason} --include-idp first.`);
  if (!existsSync(shadowPath)) throw new Error(`Missing ${path.relative(process.cwd(), shadowPath)}. Run npm run projection:v8-2:shadow -- --projection-season=${options.projectionSeason} --include-idp first.`);
  return buildProjectionUniverseEligibilityAuditFromData({
    snapshot: JSON.parse(readFileSync(snapshotPath, "utf8")) as PreseasonProjectionSnapshot,
    shadow: JSON.parse(readFileSync(shadowPath, "utf8")) as ProjectionV82ShadowReport,
    options,
    sourceArtifacts: { snapshot: snapshotPath, shadow: shadowPath },
  });
}

export function buildProjectionUniverseEligibilityAuditFromData(input: {
  snapshot: PreseasonProjectionSnapshot;
  shadow: ProjectionV82ShadowReport;
  options: ProjectionUniverseEligibilityAuditOptions;
  sourceArtifacts?: ProjectionUniverseEligibilityAuditReport["sourceArtifacts"];
}): ProjectionUniverseEligibilityAuditReport {
  const currentRows = input.snapshot.rows.filter((row) => row.variant === CURRENT_MODEL);
  const shadowByKey = new Map(input.shadow.rows.map((row) => [row.playerId, row]));
  const rows = currentRows.map((row) => classifyRow(row, shadowByKey.get(rowKey(row)) ?? null, input.options.projectionSeason));
  const criticalMovementReview = rows.filter((row) => row.criticalMovement).sort(compareByAbsMovement);
  const retiredLegacySuspects = rows.filter((row) => row.eligibilityStatus === "retired_or_legacy_suspect").sort(compareByAbsMovement);
  const kickerReview = buildKickerReview(rows);
  const safetyGates = [
    gate("no_live_outputs_changed", true, "Audit reads dry-run artifacts and writes only audit artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Ranking movement is copied from shadow diagnostics only."),
    gate("draft_suggestions_unchanged", true, "Draft suggestion code paths are not imported or executed."),
    gate("war_room_unchanged", true, "War Room UI code is not imported or modified."),
    gate("critical_movements_classified", criticalMovementReview.every((row) => row.recommendedAction !== "safe_to_shadow" || row.eligibilityStatus === "active_plausible"), `${criticalMovementReview.length} critical movement rows classified.`),
    gate("legacy_suspects_reported", ["Eli Manning", "Philip Rivers"].every((name) => !rows.some((row) => row.player === name) || retiredLegacySuspects.some((row) => row.player === name)), `${retiredLegacySuspects.length} retired/legacy suspects reported.`),
  ];
  const verdict = verdictFor(rows, kickerReview);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? { snapshot: "in-memory", shadow: "in-memory" },
    summary: {
      totalProjectedRows: rows.length,
      statusCounts: statusCounts(rows),
      byPosition: POSITIONS.map((position) => summaryRow(position, rows.filter((row) => row.position === position))),
      byCohort: COHORTS.map((cohort) => summaryRow(cohort, rows.filter((row) => rowMatchesCohort(row, cohort))),
      ),
      byTeam: countBy(rows.map((row) => row.team ?? "missing_team")),
      byLastActiveSeason: countBy(rows.map((row) => row.lastActiveSeason === null ? "none" : String(row.lastActiveSeason))),
    },
    rows: rows.sort(compareByStatusThenName),
    criticalMovementReview,
    retiredLegacySuspects,
    kickerReview,
    safetyGates,
    verdict,
    notes: [
      "Dry-run/read-only projection universe eligibility audit only.",
      "Rows are classified for review; no players are deleted or filtered from projection artifacts.",
      "No live projections, 2026 production outputs, Blackbird Rank, Draft Suggestion ordering, War Room UI, or Supabase data are changed.",
    ],
  };
}

export function writeProjectionUniverseEligibilityAuditArtifacts(report: ProjectionUniverseEligibilityAuditReport): ProjectionUniverseEligibilityAuditArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-universe-eligibility-audit-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderProjectionUniverseEligibilityAuditMarkdown(report), "utf8");
  writeFileSync(csvPath, renderProjectionUniverseEligibilityAuditCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

export function renderProjectionUniverseEligibilityAuditMarkdown(report: ProjectionUniverseEligibilityAuditReport): string {
  return `# Projection Universe Eligibility Audit ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Verdict: ${report.verdict}

## Summary

\`\`\`json
${JSON.stringify(report.summary.statusCounts, null, 2)}
\`\`\`

## Safety Gates

${renderGateTable(report.safetyGates)}

## Position Summary

${renderSummaryTable(report.summary.byPosition)}

## Cohort Summary

${renderSummaryTable(report.summary.byCohort)}

## Critical Movement Review

${renderRowsTable(report.criticalMovementReview)}

## Kicker Review

\`\`\`json
${JSON.stringify(report.kickerReview, null, 2)}
\`\`\`

## Retired / Legacy Suspects

${renderRowsTable(report.retiredLegacySuspects.slice(0, 50))}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

export function renderProjectionUniverseEligibilityAuditCsv(report: ProjectionUniverseEligibilityAuditReport): string {
  const headers = [
    "player_id",
    "sleeper_id",
    "gsis_id",
    "player",
    "position",
    "team",
    "eligibility_status",
    "reason_codes",
    "recommended_action",
    "last_active_season",
    "prior_games",
    "no_prior_nfl_data",
    "match_confidence",
    "current_expected_games",
    "v82_expected_games",
    "games_delta",
    "projected_total_point_delta",
    "shadow_movement_bucket",
    "critical_movement",
    "estimated_overall_rank_movement",
    "projection_signal_source",
  ];
  const rows = report.rows.map((row) => [
    row.playerId,
    row.sleeperId ?? "",
    row.gsisId ?? "",
    row.player,
    row.position,
    row.team ?? "",
    row.eligibilityStatus,
    row.reasonCodes.join("|"),
    row.recommendedAction,
    row.lastActiveSeason ?? "",
    row.priorGames,
    row.noPriorNflData,
    row.matchConfidence,
    row.currentExpectedGames ?? "",
    row.v82ExpectedGames ?? "",
    row.gamesDelta ?? "",
    row.projectedTotalPointDelta ?? "",
    row.shadowMovementBucket ?? "",
    row.criticalMovement,
    row.estimatedOverallRankMovement ?? "",
    row.projectionSignalSource,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function classifyRow(row: PreseasonProjectionSnapshotRow, shadow: ProjectionV82ShadowRow | null, projectionSeason: number): ProjectionUniverseEligibilityRow {
  const lastActiveSeason = max(row.inputCoverage.priorSeasonsUsed);
  const normalizedName = row.playerName.toLowerCase();
  const reasonCodes = new Set<ProjectionUniverseEligibilityReasonCode>();
  if (row.team) reasonCodes.add("has_current_team");
  else reasonCodes.add("missing_current_team");
  if (lastActiveSeason !== null && lastActiveSeason >= projectionSeason - 1) reasonCodes.add("recent_nfl_activity");
  else reasonCodes.add("no_recent_nfl_activity");
  if (lastActiveSeason !== null && lastActiveSeason <= projectionSeason - 3) reasonCodes.add("old_last_seen_season");
  if (row.inputCoverage.noPriorNflData || row.inputCoverage.noPriorType.includes("rookie")) reasonCodes.add("rookie_current_class");
  if (LEGACY_MANUAL_REVIEW_NAMES.has(normalizedName)) {
    reasonCodes.add("legacy_name_match");
    reasonCodes.add("manual_review_name_flag");
  }
  if (row.position === "K" && (row.expectedGamesDiagnostics.v7GateReason === "k_hard_baseline_fallback" || row.inputCoverage.priorGames < 12)) reasonCodes.add("kicker_low_prior_fallback");
  if (["DL", "LB", "DB"].includes(row.position) && row.inputCoverage.priorGames < 12) reasonCodes.add("idp_low_prior_fallback");
  if (shadow?.criticalReviewStatus) reasonCodes.add("shadow_critical_movement");
  if (Math.abs(shadow?.expectedGamesDelta ?? 0) >= 2) reasonCodes.add("large_expected_games_delta");
  reasonCodes.add("no_2026_roster_signal");

  const status = statusFor(row, [...reasonCodes], lastActiveSeason, projectionSeason, shadow);
  return {
    playerId: rowKey(row),
    sleeperId: row.sleeperId,
    gsisId: row.gsisId,
    player: row.playerName,
    position: row.position,
    team: row.team,
    eligibilityStatus: status,
    reasonCodes: [...reasonCodes].sort(),
    recommendedAction: actionFor(row, status, [...reasonCodes], shadow),
    lastActiveSeason,
    priorGames: row.inputCoverage.priorGames,
    noPriorNflData: row.inputCoverage.noPriorNflData,
    matchConfidence: row.matchConfidence,
    currentExpectedGames: shadow?.currentExpectedGames ?? row.projectedGames,
    v82ExpectedGames: shadow?.v82ExpectedGames ?? null,
    gamesDelta: shadow?.expectedGamesDelta ?? null,
    projectedTotalPointDelta: shadow?.projectedTotalPointDelta ?? null,
    shadowMovementBucket: shadow?.movementBucket ?? null,
    criticalMovement: shadow?.risk === "critical",
    estimatedOverallRankMovement: shadow?.estimatedOverallRankMovement ?? null,
    projectionSignalSource: row.inputCoverage.noPriorNflData ? "no_prior_projection_prior" : `historical_profile_last_active_${lastActiveSeason ?? "unknown"}`,
  };
}

function statusFor(
  row: PreseasonProjectionSnapshotRow,
  reasonCodes: ProjectionUniverseEligibilityReasonCode[],
  lastActiveSeason: number | null,
  projectionSeason: number,
  shadow: ProjectionV82ShadowRow | null
): ProjectionUniverseEligibilityStatus {
  if (reasonCodes.includes("legacy_name_match") || (lastActiveSeason !== null && lastActiveSeason <= projectionSeason - 5 && !row.inputCoverage.noPriorNflData)) return "retired_or_legacy_suspect";
  if (shadow?.risk === "critical" && (reasonCodes.includes("old_last_seen_season") || reasonCodes.includes("missing_current_team"))) return "manual_review_required";
  if (row.inputCoverage.noPriorNflData || row.inputCoverage.noPriorType.includes("rookie")) return "rookie_or_new_player";
  if (lastActiveSeason !== null && lastActiveSeason <= projectionSeason - 3) return "stale_historical_signal";
  if (row.matchConfidence === "weak" || row.confidence === "very_low" || row.inputCoverage.priorGames < 12) return "low_confidence_plausible";
  return "active_plausible";
}

function actionFor(
  row: PreseasonProjectionSnapshotRow,
  status: ProjectionUniverseEligibilityStatus,
  reasonCodes: ProjectionUniverseEligibilityReasonCode[],
  shadow: ProjectionV82ShadowRow | null
): ProjectionUniverseRecommendedAction {
  if (status === "retired_or_legacy_suspect") return "exclude_from_promotion_candidate_pool";
  if (row.position === "K" && (reasonCodes.includes("kicker_low_prior_fallback") || shadow?.risk === "critical")) return "needs_kicker_policy_review";
  if (status === "manual_review_required" || shadow?.risk === "critical") return "manual_review_before_promotion";
  if (reasonCodes.includes("no_2026_roster_signal") && status !== "active_plausible") return "needs_roster_source_confirmation";
  return "safe_to_shadow";
}

function buildKickerReview(rows: ProjectionUniverseEligibilityRow[]) {
  const kRows = rows.filter((row) => row.position === "K");
  const lowPriorFallbackRows = kRows.filter((row) => row.reasonCodes.includes("kicker_low_prior_fallback"));
  const movingEightToTwelveExpectedGames = kRows.filter((row) => row.currentExpectedGames === 8 && row.v82ExpectedGames === 12).length;
  return {
    totalKRows: kRows.length,
    lowPriorFallbackRows: lowPriorFallbackRows.length,
    criticalMovementRows: kRows.filter((row) => row.criticalMovement).length,
    movingEightToTwelveExpectedGames,
    statusCounts: countBy(kRows.map((row) => row.eligibilityStatus)),
    recommendation: lowPriorFallbackRows.length ? "Keep K on current/v7 fallback during early v8.2 shadow adoption until low-prior kicker policy is reviewed." : "No kicker-specific blocker found.",
  };
}

function verdictFor(rows: ProjectionUniverseEligibilityRow[], kickerReview: ReturnType<typeof buildKickerReview>): ProjectionUniverseReadinessVerdict {
  const legacyCritical = rows.some((row) => row.criticalMovement && row.eligibilityStatus === "retired_or_legacy_suspect");
  const criticalManualCount = rows.filter((row) => row.criticalMovement && row.recommendedAction !== "safe_to_shadow").length;
  if (legacyCritical && criticalManualCount > 10) return "universe_blocked_for_promotion";
  if (criticalManualCount || kickerReview.criticalMovementRows) return "universe_shadow_ok_manual_review_needed";
  return "universe_clean_for_shadow";
}

function summaryRow(segment: string, rows: ProjectionUniverseEligibilityRow[]): ProjectionUniverseEligibilitySummaryRow {
  return {
    segment,
    total: rows.length,
    activePlausible: rows.filter((row) => row.eligibilityStatus === "active_plausible").length,
    lowConfidencePlausible: rows.filter((row) => row.eligibilityStatus === "low_confidence_plausible").length,
    rookieOrNewPlayer: rows.filter((row) => row.eligibilityStatus === "rookie_or_new_player").length,
    staleHistoricalSignal: rows.filter((row) => row.eligibilityStatus === "stale_historical_signal").length,
    retiredOrLegacySuspect: rows.filter((row) => row.eligibilityStatus === "retired_or_legacy_suspect").length,
    manualReviewRequired: rows.filter((row) => row.eligibilityStatus === "manual_review_required").length,
  };
}

function rowMatchesCohort(row: ProjectionUniverseEligibilityRow, cohort: string) {
  if (cohort === row.eligibilityStatus) return true;
  if (cohort === "low_prior_sample") return row.priorGames < 12;
  if (cohort === "idp") return ["DL", "LB", "DB"].includes(row.position);
  if (cohort === "offense") return ["QB", "RB", "WR", "TE"].includes(row.position);
  if (cohort === "kicker") return row.position === "K";
  return row.reasonCodes.includes(cohort as ProjectionUniverseEligibilityReasonCode);
}

function statusCounts(rows: ProjectionUniverseEligibilityRow[]) {
  return {
    active_plausible: rows.filter((row) => row.eligibilityStatus === "active_plausible").length,
    low_confidence_plausible: rows.filter((row) => row.eligibilityStatus === "low_confidence_plausible").length,
    rookie_or_new_player: rows.filter((row) => row.eligibilityStatus === "rookie_or_new_player").length,
    stale_historical_signal: rows.filter((row) => row.eligibilityStatus === "stale_historical_signal").length,
    retired_or_legacy_suspect: rows.filter((row) => row.eligibilityStatus === "retired_or_legacy_suspect").length,
    manual_review_required: rows.filter((row) => row.eligibilityStatus === "manual_review_required").length,
  };
}

function renderGateTable(gates: ProjectionUniverseEligibilityAuditReport["safetyGates"]) {
  const header = "| Gate | Status | Detail |";
  const divider = "|---|---|---|";
  return [header, divider, ...gates.map((gate) => `| ${gate.name} | ${gate.passed ? "PASS" : "FAIL"} | ${gate.detail} |`)].join("\n");
}

function renderSummaryTable(rows: ProjectionUniverseEligibilitySummaryRow[]) {
  const header = "| Segment | Total | Active | Low Conf | Rookie/New | Stale | Retired/Legacy | Manual Review |";
  const divider = "|---|---:|---:|---:|---:|---:|---:|---:|";
  return [header, divider, ...rows.map((row) => `| ${row.segment} | ${row.total} | ${row.activePlausible} | ${row.lowConfidencePlausible} | ${row.rookieOrNewPlayer} | ${row.staleHistoricalSignal} | ${row.retiredOrLegacySuspect} | ${row.manualReviewRequired} |`)].join("\n");
}

function renderRowsTable(rows: ProjectionUniverseEligibilityRow[]) {
  if (!rows.length) return "No rows.";
  const header = "| Player | Pos | Team | Status | Reasons | Point Move | Action | Last Active |";
  const divider = "|---|---|---|---|---|---:|---|---:|";
  return [header, divider, ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.team ?? ""} | ${row.eligibilityStatus} | ${row.reasonCodes.join(" ")} | ${row.projectedTotalPointDelta ?? ""} | ${row.recommendedAction} | ${row.lastActiveSeason ?? ""} |`)].join("\n");
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function rowKey(row: PreseasonProjectionSnapshotRow) {
  return row.sleeperId ?? row.gsisId ?? `${row.normalizedName}:${row.position}`;
}

function compareByAbsMovement(a: ProjectionUniverseEligibilityRow, b: ProjectionUniverseEligibilityRow) {
  return Math.abs(b.projectedTotalPointDelta ?? 0) - Math.abs(a.projectedTotalPointDelta ?? 0) || a.player.localeCompare(b.player);
}

function compareByStatusThenName(a: ProjectionUniverseEligibilityRow, b: ProjectionUniverseEligibilityRow) {
  return statusRank(a.eligibilityStatus) - statusRank(b.eligibilityStatus) || a.player.localeCompare(b.player);
}

function statusRank(status: ProjectionUniverseEligibilityStatus) {
  return ["retired_or_legacy_suspect", "manual_review_required", "stale_historical_signal", "rookie_or_new_player", "low_confidence_plausible", "active_plausible"].indexOf(status);
}

function countBy(values: string[]) {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function max(values: number[]) {
  return values.length ? Math.max(...values) : null;
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
