import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { PreseasonProjectionSnapshotRow } from "./preseason-projection-snapshot-types";
import type {
  ProjectionV82CriticalReviewStatus,
  ProjectionV82ShadowArtifactPaths,
  ProjectionV82ShadowGamesBucket,
  ProjectionV82ShadowInput,
  ProjectionV82ShadowMovementBucket,
  ProjectionV82ShadowMovementSummaryRow,
  ProjectionV82ShadowOptions,
  ProjectionV82ShadowRecommendation,
  ProjectionV82ShadowReport,
  ProjectionV82ShadowRisk,
  ProjectionV82ShadowRow,
  ProjectionV82ShadowSafetyGate,
} from "./projection-v8-2-shadow-types";
import type { PreseasonProjectionSnapshot } from "./preseason-projection-snapshot-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const CURRENT_MODEL = "blackbird_expected_games_v7_family_selective" as const;
const SHADOW_MODEL = "blackbird_expected_games_v8_2_high_impact_guardrail" as const;
const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DL", "LB", "DB", "DST"];
const COHORTS = [
  "veteran_prior_sample",
  "rookie",
  "second_year_low_prior",
  "no_prior_stats",
  "low_prior_sample",
  "te_fallback",
  "k_fallback",
  "idp",
  "offense",
  "kicker",
];

export function runProjectionV82Shadow(options: ProjectionV82ShadowOptions): ProjectionV82ShadowReport {
  const snapshotPath = path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`);
  if (!existsSync(snapshotPath)) {
    throw new Error(`Missing ${path.relative(process.cwd(), snapshotPath)}. Run npm run projection:snapshot:preseason -- --target-season=${options.projectionSeason} --include-idp first.`);
  }
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as PreseasonProjectionSnapshot;
  return buildProjectionV82ShadowFromData({
    snapshot,
    options,
    sourceArtifacts: { snapshot: snapshotPath },
  });
}

export function buildProjectionV82ShadowFromData(input: ProjectionV82ShadowInput): ProjectionV82ShadowReport {
  const currentRows = input.snapshot.rows.filter((row) => row.variant === CURRENT_MODEL);
  const shadowRows = input.snapshot.rows.filter((row) => row.variant === SHADOW_MODEL);
  const currentByKey = new Map(currentRows.map((row) => [rowKey(row), row]));
  const shadowByKey = new Map(shadowRows.map((row) => [rowKey(row), row]));
  const sharedKeys = [...currentByKey.keys()].filter((key) => shadowByKey.has(key));
  const currentOnlyRows = [...currentByKey.keys()].filter((key) => !shadowByKey.has(key)).length;
  const v82OnlyRows = [...shadowByKey.keys()].filter((key) => !currentByKey.has(key)).length;
  const baseRows = sharedKeys
    .map((key) => {
      const current = currentByKey.get(key);
      const shadow = shadowByKey.get(key);
      if (!current || !shadow) return null;
      return shadowRow(current, shadow);
    })
    .filter((row): row is ProjectionV82ShadowRow => row !== null);
  const rankedRows = withEstimatedRanks(baseRows);
  const topMovements = [...rankedRows].sort(compareByAbsProjectedDelta).slice(0, 50);
  const criticalMovements = rankedRows.filter((row) => row.risk === "critical").sort(compareByAbsProjectedDelta);
  const safetyGates = buildSafetyGates(rankedRows, currentRows, shadowRows);
  const recommendation = recommendationFor(safetyGates, criticalMovements);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    currentModel: CURRENT_MODEL,
    shadowModel: SHADOW_MODEL,
    sourceArtifacts: input.sourceArtifacts ?? { snapshot: "in-memory" },
    rowCoverage: {
      currentLiveProjectionRows: currentRows.length,
      v82ShadowRows: shadowRows.length,
      sharedRows: rankedRows.length,
      currentOnlyRows,
      v82OnlyRows,
      rowsSkipped: input.snapshot.diagnostics.playersSkipped,
      skipReasons: {
        players_skipped_no_signal: input.snapshot.diagnostics.playersSkippedNoSignal,
        current_only_rows: currentOnlyRows,
        v82_only_rows: v82OnlyRows,
      },
      positionCounts: countBy(rankedRows.map((row) => row.position)),
      cohortCounts: countBy(rankedRows.flatMap((row) => row.cohorts)),
    },
    movementBuckets: movementBucketCounts(rankedRows),
    expectedGamesMovementBuckets: gamesBucketCounts(rankedRows),
    positionMovementSummary: POSITIONS.map((position) => movementSummary(position, rankedRows.filter((row) => row.position === position))),
    cohortMovementSummary: COHORTS.map((cohort) => movementSummary(cohort, rankedRows.filter((row) => row.cohorts.includes(cohort)))),
    rows: [...rankedRows].sort(compareByAbsProjectedDelta),
    topMovements,
    criticalMovements,
    rankingRiskPreview: {
      estimated: true,
      reason: "Estimated from current and v8.2 projected total points within the dry-run snapshot row universe. No ranking state was mutated.",
      rowsWithEstimatedOverallRankMovement: rankedRows.filter((row) => row.estimatedOverallRankMovement !== null).length,
      rowsWithEstimatedPositionRankMovement: rankedRows.filter((row) => row.estimatedPositionRankMovement !== null).length,
      topOverallRankMovements: [...rankedRows].sort(compareByAbsOverallRankMovement).slice(0, 25),
      topPositionRankMovements: [...rankedRows].sort(compareByAbsPositionRankMovement).slice(0, 25),
    },
    safetyGates,
    recommendation,
    notes: [
      "Shadow/dev-only comparison infrastructure.",
      "The current model is read from the dry-run snapshot as blackbird_expected_games_v7_family_selective.",
      "No live projections, 2026 production outputs, Supabase writes, War Room UI, Blackbird Rank, or Draft Suggestion ordering are changed.",
    ],
  };
}

export function writeProjectionV82ShadowArtifacts(report: ProjectionV82ShadowReport): ProjectionV82ShadowArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-v8-2-shadow-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderProjectionV82ShadowMarkdown(report), "utf8");
  writeFileSync(csvPath, renderProjectionV82ShadowCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

export function renderProjectionV82ShadowMarkdown(report: ProjectionV82ShadowReport): string {
  return `# Projection v8.2 Shadow Report ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Current model: ${report.currentModel}
Shadow model: ${report.shadowModel}
Recommendation: ${report.recommendation}

## Row Coverage

\`\`\`json
${JSON.stringify(report.rowCoverage, null, 2)}
\`\`\`

## Safety Gates

${renderSafetyGateTable(report.safetyGates)}

## Movement Buckets

\`\`\`json
${JSON.stringify(report.movementBuckets, null, 2)}
\`\`\`

## Expected-Games Movement Buckets

\`\`\`json
${JSON.stringify(report.expectedGamesMovementBuckets, null, 2)}
\`\`\`

## Top 20 Player Movements

${renderShadowRowsTable(report.topMovements.slice(0, 20))}

## Critical Movement Review

${renderCriticalRowsTable(report.criticalMovements)}

## Position Movement Summary

${renderMovementSummaryTable(report.positionMovementSummary)}

## Cohort Movement Summary

${renderMovementSummaryTable(report.cohortMovementSummary)}

## Ranking Risk Preview

Estimated: ${report.rankingRiskPreview.estimated}
Reason: ${report.rankingRiskPreview.reason}
Rows with overall rank movement estimate: ${report.rankingRiskPreview.rowsWithEstimatedOverallRankMovement}
Rows with position rank movement estimate: ${report.rankingRiskPreview.rowsWithEstimatedPositionRankMovement}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

export function renderProjectionV82ShadowCsv(report: ProjectionV82ShadowReport): string {
  const headers = [
    "player_id",
    "sleeper_id",
    "gsis_id",
    "player",
    "position",
    "team",
    "cohorts",
    "current_expected_games",
    "v82_expected_games",
    "expected_games_delta",
    "ppg_anchor",
    "projected_total_point_delta",
    "current_projected_total",
    "shadow_projected_total",
    "movement_bucket",
    "games_bucket",
    "risk",
    "risk_flags",
    "reason_codes",
    "guardrail_applied",
    "current_overall_rank",
    "shadow_overall_rank",
    "estimated_overall_rank_movement",
    "current_position_rank",
    "shadow_position_rank",
    "estimated_position_rank_movement",
    "critical_review_status",
  ];
  const rows = report.rows.map((row) => [
    row.playerId,
    row.sleeperId ?? "",
    row.gsisId ?? "",
    row.player,
    row.position,
    row.team ?? "",
    row.cohorts.join("|"),
    row.currentExpectedGames,
    row.v82ExpectedGames,
    row.expectedGamesDelta,
    row.ppgAnchor,
    row.projectedTotalPointDelta,
    row.currentProjectedTotal,
    row.shadowProjectedTotal,
    row.movementBucket,
    row.gamesBucket,
    row.risk,
    row.riskFlags.join("|"),
    row.reasonCodes.join("|"),
    row.guardrailApplied,
    row.currentOverallRank ?? "",
    row.shadowOverallRank ?? "",
    row.estimatedOverallRankMovement ?? "",
    row.currentPositionRank ?? "",
    row.shadowPositionRank ?? "",
    row.estimatedPositionRankMovement ?? "",
    row.criticalReviewStatus ?? "",
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function shadowRow(current: PreseasonProjectionSnapshotRow, shadow: PreseasonProjectionSnapshotRow): ProjectionV82ShadowRow {
  const expectedGamesDelta = round(shadow.projectedGames - current.projectedGames);
  const ppgAnchor = current.projectedPpg;
  const projectedTotalPointDelta = round(shadow.projectedTotalPoints - current.projectedTotalPoints);
  const movementBucket = movementBucketFor(projectedTotalPointDelta);
  const risk = riskFor(movementBucket);
  const cohorts = cohortsFor(current, shadow);
  const guardrailApplied = shadow.expectedGamesDiagnostics.v82GuardrailApplied ?? false;
  return {
    playerId: current.sleeperId ?? current.gsisId ?? `${current.normalizedName}:${current.position}`,
    sleeperId: current.sleeperId,
    gsisId: current.gsisId,
    player: current.playerName,
    position: current.position,
    team: current.team,
    cohorts,
    currentExpectedGames: current.projectedGames,
    v82ExpectedGames: shadow.projectedGames,
    expectedGamesDelta,
    ppgAnchor,
    projectedTotalPointDelta,
    currentProjectedTotal: current.projectedTotalPoints,
    shadowProjectedTotal: shadow.projectedTotalPoints,
    movementBucket,
    gamesBucket: gamesBucketFor(expectedGamesDelta),
    risk,
    riskFlags: riskFlagsFor(current, expectedGamesDelta, ppgAnchor, cohorts, guardrailApplied),
    reasonCodes: shadow.expectedGamesDiagnostics.v82GuardrailReasonCodes,
    guardrailApplied,
    currentOverallRank: null,
    shadowOverallRank: null,
    estimatedOverallRankMovement: null,
    currentPositionRank: null,
    shadowPositionRank: null,
    estimatedPositionRankMovement: null,
    criticalReviewStatus: criticalReviewStatus(risk, guardrailApplied, ppgAnchor),
  };
}

function withEstimatedRanks(rows: ProjectionV82ShadowRow[]) {
  const currentRanks = rankBy(rows, (row) => row.currentProjectedTotal);
  const shadowRanks = rankBy(rows, (row) => row.shadowProjectedTotal);
  const currentPositionRanks = rankByPosition(rows, (row) => row.currentProjectedTotal);
  const shadowPositionRanks = rankByPosition(rows, (row) => row.shadowProjectedTotal);
  return rows.map((row) => {
    const currentOverallRank = currentRanks.get(row.playerId) ?? null;
    const shadowOverallRank = shadowRanks.get(row.playerId) ?? null;
    const currentPositionRank = currentPositionRanks.get(row.playerId) ?? null;
    const shadowPositionRank = shadowPositionRanks.get(row.playerId) ?? null;
    return {
      ...row,
      currentOverallRank,
      shadowOverallRank,
      estimatedOverallRankMovement: currentOverallRank === null || shadowOverallRank === null ? null : currentOverallRank - shadowOverallRank,
      currentPositionRank,
      shadowPositionRank,
      estimatedPositionRankMovement: currentPositionRank === null || shadowPositionRank === null ? null : currentPositionRank - shadowPositionRank,
    };
  });
}

function buildSafetyGates(rows: ProjectionV82ShadowRow[], currentRows: PreseasonProjectionSnapshotRow[], shadowRows: PreseasonProjectionSnapshotRow[]): ProjectionV82ShadowSafetyGate[] {
  const teFallbackRows = rows.filter((row) => row.cohorts.includes("te_fallback"));
  const kFallbackRows = rows.filter((row) => row.cohorts.includes("k_fallback"));
  const criticalRows = rows.filter((row) => row.risk === "critical");
  const eliteCriticalRows = criticalRows.filter((row) => row.ppgAnchor >= 20);
  return [
    gate("no_live_outputs_changed", true, "Shadow report reads dry-run artifacts and writes only shadow artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is called by the shadow report module."),
    gate("rankings_unchanged", true, "Ranking movement is estimated in-memory only."),
    gate("draft_suggestions_unchanged", true, "Draft suggestion code paths are not imported or executed."),
    gate("war_room_unchanged", true, "War Room UI code is not imported or modified."),
    gate("te_fallback_preserved", teFallbackRows.every((row) => row.reasonCodes.includes("te_fallback_preserved")), `${teFallbackRows.length} TE fallback rows checked.`),
    gate("k_fallback_preserved", kFallbackRows.every((row) => row.reasonCodes.includes("k_fallback_preserved")), `${kFallbackRows.length} K fallback rows checked.`),
    gate("critical_movements_reported", rows.every((row) => row.risk !== "critical" || row.criticalReviewStatus !== null), `${criticalRows.length} critical rows reported.`),
    gate("elite_ppg_movements_guardrailed", eliteCriticalRows.every((row) => row.guardrailApplied), `${eliteCriticalRows.length} elite critical rows checked.`),
    gate("shadow_rows_generated", currentRows.length > 0 && shadowRows.length > 0 && rows.length > 0, `${rows.length} shared shadow rows.`),
  ];
}

function recommendationFor(gates: ProjectionV82ShadowSafetyGate[], criticalMovements: ProjectionV82ShadowRow[]): ProjectionV82ShadowRecommendation {
  if (gates.some((gate) => !gate.passed)) return "shadow_blocked";
  if (criticalMovements.length) return "shadow_candidate_with_manual_review";
  return "shadow_clean";
}

function cohortsFor(current: PreseasonProjectionSnapshotRow, shadow: PreseasonProjectionSnapshotRow) {
  const cohorts = new Set<string>();
  const v8Cohort = shadow.expectedGamesDiagnostics.v8Cohort;
  if (v8Cohort) cohorts.add(v8Cohort);
  if (current.inputCoverage.noPriorNflData) cohorts.add("no_prior_stats");
  if (current.inputCoverage.priorGames < 12) cohorts.add("low_prior_sample");
  if (current.expectedGamesDiagnostics.v7GateReason === "te_hard_baseline_fallback") cohorts.add("te_fallback");
  if (current.expectedGamesDiagnostics.v7GateReason === "k_hard_baseline_fallback") cohorts.add("k_fallback");
  if (["DL", "LB", "DB"].includes(current.position)) cohorts.add("idp");
  if (["QB", "RB", "WR", "TE"].includes(current.position)) cohorts.add("offense");
  if (current.position === "K") cohorts.add("kicker");
  return [...cohorts].sort();
}

function riskFlagsFor(row: PreseasonProjectionSnapshotRow, expectedGamesDelta: number, ppgAnchor: number, cohorts: string[], guardrailApplied: boolean) {
  const flags = new Set<string>();
  if (ppgAnchor >= 15) flags.add("elite_ppg_player");
  if (cohorts.some((cohort) => ["rookie", "low_prior_sample", "second_year_low_prior", "no_prior_stats"].includes(cohort))) flags.add("rookie_or_low_prior");
  if (["QB", "RB", "WR", "TE"].includes(row.position)) flags.add("high_value_position");
  if (row.position === "QB") flags.add("qb_superflex_sensitive");
  if (["DL", "LB", "DB"].includes(row.position)) flags.add("idp_row");
  if (cohorts.includes("te_fallback") || cohorts.includes("k_fallback")) flags.add("fallback_row");
  if (Math.abs(expectedGamesDelta) >= 2) flags.add("large_games_movement");
  if (guardrailApplied) flags.add("guardrail_applied");
  return [...flags].sort();
}

function criticalReviewStatus(risk: ProjectionV82ShadowRisk, guardrailApplied: boolean, ppgAnchor: number): ProjectionV82CriticalReviewStatus | null {
  if (risk !== "critical") return null;
  if (ppgAnchor >= 20 && !guardrailApplied) return "do_not_promote_until_reviewed";
  if (ppgAnchor >= 15 || !guardrailApplied) return "needs_manual_review";
  return "safe_shadow_difference";
}

function movementSummary(segment: string, rows: ProjectionV82ShadowRow[]): ProjectionV82ShadowMovementSummaryRow {
  return {
    segment,
    rows: rows.length,
    averageExpectedGamesDelta: mean(rows.map((row) => row.expectedGamesDelta)),
    averageProjectedTotalPointDelta: mean(rows.map((row) => row.projectedTotalPointDelta)),
    rowsMoving5Plus: rows.filter((row) => Math.abs(row.projectedTotalPointDelta) >= 5).length,
    rowsMoving10Plus: rows.filter((row) => Math.abs(row.projectedTotalPointDelta) >= 10).length,
    rowsMoving20Plus: rows.filter((row) => Math.abs(row.projectedTotalPointDelta) >= 20).length,
    criticalMovementRows: rows.filter((row) => row.risk === "critical").length,
  };
}

function movementBucketCounts(rows: ProjectionV82ShadowRow[]): Record<ProjectionV82ShadowMovementBucket, number> {
  return {
    "0": rows.filter((row) => row.movementBucket === "0").length,
    "0-5": rows.filter((row) => row.movementBucket === "0-5").length,
    "5-10": rows.filter((row) => row.movementBucket === "5-10").length,
    "10-20": rows.filter((row) => row.movementBucket === "10-20").length,
    "20+": rows.filter((row) => row.movementBucket === "20+").length,
  };
}

function gamesBucketCounts(rows: ProjectionV82ShadowRow[]): Record<ProjectionV82ShadowGamesBucket, number> {
  return {
    "0": rows.filter((row) => row.gamesBucket === "0").length,
    "0-0.5": rows.filter((row) => row.gamesBucket === "0-0.5").length,
    "0.5-1": rows.filter((row) => row.gamesBucket === "0.5-1").length,
    "1-2": rows.filter((row) => row.gamesBucket === "1-2").length,
    "2-4": rows.filter((row) => row.gamesBucket === "2-4").length,
    "4+": rows.filter((row) => row.gamesBucket === "4+").length,
  };
}

function movementBucketFor(delta: number): ProjectionV82ShadowMovementBucket {
  const absolute = Math.abs(delta);
  if (absolute === 0) return "0";
  if (absolute < 5) return "0-5";
  if (absolute < 10) return "5-10";
  if (absolute < 20) return "10-20";
  return "20+";
}

function gamesBucketFor(delta: number): ProjectionV82ShadowGamesBucket {
  const absolute = Math.abs(delta);
  if (absolute === 0) return "0";
  if (absolute <= 0.5) return "0-0.5";
  if (absolute <= 1) return "0.5-1";
  if (absolute <= 2) return "1-2";
  if (absolute <= 4) return "2-4";
  return "4+";
}

function riskFor(bucket: ProjectionV82ShadowMovementBucket): ProjectionV82ShadowRisk {
  if (bucket === "20+") return "critical";
  if (bucket === "10-20") return "high";
  if (bucket === "5-10") return "moderate";
  return "low";
}

function rankBy(rows: ProjectionV82ShadowRow[], value: (row: ProjectionV82ShadowRow) => number) {
  const ranked = [...rows].sort((a, b) => value(b) - value(a) || a.player.localeCompare(b.player));
  return new Map(ranked.map((row, index) => [row.playerId, index + 1]));
}

function rankByPosition(rows: ProjectionV82ShadowRow[], value: (row: ProjectionV82ShadowRow) => number) {
  const result = new Map<string, number>();
  for (const position of [...new Set(rows.map((row) => row.position))]) {
    const ranked = rows.filter((row) => row.position === position).sort((a, b) => value(b) - value(a) || a.player.localeCompare(b.player));
    ranked.forEach((row, index) => result.set(row.playerId, index + 1));
  }
  return result;
}

function rowKey(row: PreseasonProjectionSnapshotRow) {
  return row.sleeperId ?? row.gsisId ?? `${row.normalizedName}:${row.position}`;
}

function compareByAbsProjectedDelta(a: ProjectionV82ShadowRow, b: ProjectionV82ShadowRow) {
  return Math.abs(b.projectedTotalPointDelta) - Math.abs(a.projectedTotalPointDelta) || a.player.localeCompare(b.player);
}

function compareByAbsOverallRankMovement(a: ProjectionV82ShadowRow, b: ProjectionV82ShadowRow) {
  return Math.abs(b.estimatedOverallRankMovement ?? 0) - Math.abs(a.estimatedOverallRankMovement ?? 0) || a.player.localeCompare(b.player);
}

function compareByAbsPositionRankMovement(a: ProjectionV82ShadowRow, b: ProjectionV82ShadowRow) {
  return Math.abs(b.estimatedPositionRankMovement ?? 0) - Math.abs(a.estimatedPositionRankMovement ?? 0) || a.player.localeCompare(b.player);
}

function renderSafetyGateTable(gates: ProjectionV82ShadowSafetyGate[]) {
  const header = "| Gate | Status | Detail |";
  const divider = "|---|---|---|";
  return [header, divider, ...gates.map((gate) => `| ${gate.name} | ${gate.passed ? "PASS" : "FAIL"} | ${gate.detail} |`)].join("\n");
}

function renderShadowRowsTable(rows: ProjectionV82ShadowRow[]) {
  if (!rows.length) return "No rows.";
  const header = "| Player | Pos | Team | Cohorts | Current G | v8.2 G | Games Delta | PPG | Points Delta | Risk | Flags | Reasons |";
  const divider = "|---|---|---|---|---:|---:|---:|---:|---:|---|---|---|";
  return [header, divider, ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.team ?? ""} | ${row.cohorts.join(" ")} | ${row.currentExpectedGames} | ${row.v82ExpectedGames} | ${row.expectedGamesDelta} | ${row.ppgAnchor} | ${row.projectedTotalPointDelta} | ${row.risk} | ${row.riskFlags.join(" ")} | ${row.reasonCodes.join(" ")} |`)].join("\n");
}

function renderCriticalRowsTable(rows: ProjectionV82ShadowRow[]) {
  if (!rows.length) return "No critical movements.";
  const header = "| Player | Pos | Team | Current G | v8.2 G | Games Delta | Points Delta | Why v8.2 moved | Guardrail | Review Status |";
  const divider = "|---|---|---|---:|---:|---:|---:|---|---|---|";
  return [header, divider, ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.team ?? ""} | ${row.currentExpectedGames} | ${row.v82ExpectedGames} | ${row.expectedGamesDelta} | ${row.projectedTotalPointDelta} | ${row.reasonCodes.join(" ")} | ${row.guardrailApplied} | ${row.criticalReviewStatus ?? ""} |`)].join("\n");
}

function renderMovementSummaryTable(rows: ProjectionV82ShadowMovementSummaryRow[]) {
  const header = "| Segment | Rows | Avg Games Delta | Avg Points Delta | Move 5+ | Move 10+ | Move 20+ | Critical |";
  const divider = "|---|---:|---:|---:|---:|---:|---:|---:|";
  return [header, divider, ...rows.map((row) => `| ${row.segment} | ${row.rows} | ${format(row.averageExpectedGamesDelta)} | ${format(row.averageProjectedTotalPointDelta)} | ${row.rowsMoving5Plus} | ${row.rowsMoving10Plus} | ${row.rowsMoving20Plus} | ${row.criticalMovementRows} |`)].join("\n");
}

function gate(name: ProjectionV82ShadowSafetyGate["name"], passed: boolean, detail: string): ProjectionV82ShadowSafetyGate {
  return { name, passed, detail };
}

function countBy(values: string[]) {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function mean(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function format(value: number | null) {
  return value === null ? "n/a" : String(value);
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
