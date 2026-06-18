import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { PreseasonProjectionSnapshot } from "./preseason-projection-snapshot-types";
import type {
  ProjectionPromotionCandidatePoolArtifactPaths,
  ProjectionPromotionCandidatePoolOptions,
  ProjectionPromotionCandidatePoolReport,
  ProjectionPromotionCandidateReasonCode,
  ProjectionPromotionCandidateRow,
  ProjectionPromotionEligibilityClassification,
  ProjectionPromotionMovementBucket,
  ProjectionPromotionPoolMetric,
  ProjectionPromotionPoolVerdict,
  ProjectionPromotionRecommendedAction,
} from "./projection-promotion-candidate-pool-types";
import type { ProjectionUniverseEligibilityAuditReport, ProjectionUniverseEligibilityRow } from "./projection-universe-eligibility-audit-types";
import type { ProjectionV82ShadowReport, ProjectionV82ShadowRow } from "./projection-v8-2-shadow-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const CLASSIFICATIONS: ProjectionPromotionEligibilityClassification[] = [
  "eligible_for_projection_promotion",
  "manual_review_before_promotion",
  "shadow_only",
  "blocked_from_promotion",
];
const MOVEMENT_BUCKETS: ProjectionPromotionMovementBucket[] = ["0", "0-5", "5-10", "10-20", "20+"];
const HIGH_IMPACT_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);

export function runProjectionPromotionCandidatePool(options: ProjectionPromotionCandidatePoolOptions): ProjectionPromotionCandidatePoolReport {
  const snapshotPath = path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`);
  const shadowPath = path.join(OUTPUT_DIR, `projection-v8-2-shadow-${options.projectionSeason}.json`);
  const universePath = path.join(OUTPUT_DIR, `projection-universe-eligibility-audit-${options.projectionSeason}.json`);
  if (!existsSync(snapshotPath)) throw new Error(`Missing ${path.relative(process.cwd(), snapshotPath)}. Run npm run projection:snapshot:preseason -- --target-season=${options.projectionSeason} --include-idp first.`);
  if (!existsSync(shadowPath)) throw new Error(`Missing ${path.relative(process.cwd(), shadowPath)}. Run npm run projection:v8-2:shadow -- --projection-season=${options.projectionSeason} --include-idp first.`);
  if (!existsSync(universePath)) throw new Error(`Missing ${path.relative(process.cwd(), universePath)}. Run npm run projection:universe:eligibility:audit -- --projection-season=${options.projectionSeason} --include-idp first.`);
  return buildProjectionPromotionCandidatePoolFromData({
    snapshot: JSON.parse(readFileSync(snapshotPath, "utf8")) as PreseasonProjectionSnapshot,
    shadow: JSON.parse(readFileSync(shadowPath, "utf8")) as ProjectionV82ShadowReport,
    universe: JSON.parse(readFileSync(universePath, "utf8")) as ProjectionUniverseEligibilityAuditReport,
    options,
    sourceArtifacts: {
      snapshot: snapshotPath,
      shadow: shadowPath,
      universeEligibilityAudit: universePath,
    },
  });
}

export function buildProjectionPromotionCandidatePoolFromData(input: {
  snapshot: PreseasonProjectionSnapshot;
  shadow: ProjectionV82ShadowReport;
  universe: ProjectionUniverseEligibilityAuditReport;
  options: ProjectionPromotionCandidatePoolOptions;
  sourceArtifacts?: ProjectionPromotionCandidatePoolReport["sourceArtifacts"];
}): ProjectionPromotionCandidatePoolReport {
  const shadowByPlayerId = new Map(input.shadow.rows.map((row) => [row.playerId, row]));
  const rows = input.universe.rows.map((row) => classifyPromotionRow(row, shadowByPlayerId.get(row.playerId) ?? null)).sort(compareByClassificationThenMovement);
  const kickerPolicy = buildKickerPolicy(rows);
  const safetyGates = buildSafetyGates(rows, kickerPolicy);
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
    },
    summary: {
      totalRows: rows.length,
      classificationCounts: classificationCounts(rows),
      byUniverseStatus: countBy(rows.map((row) => row.universeEligibilityStatus)),
      byPosition: groupedClassificationCounts(rows, (row) => row.position),
      byCohort: groupedClassificationCounts(rows, (row) => row.cohortTags),
      byTeamSignal: countBy(rows.map((row) => row.team ? "has_team" : "missing_team")),
      byMovementBucket: movementBucketCounts(rows),
      byRiskFlag: countBy(rows.flatMap((row) => row.riskFlags.length ? row.riskFlags : ["none"])),
      byRecommendedAction: countBy(rows.map((row) => row.recommendedAction)) as Record<ProjectionPromotionRecommendedAction, number>,
    },
    poolMetrics: [
      poolMetric("all_rows", rows),
      poolMetric("promotion_eligible_rows_only", rows.filter((row) => row.promotionEligibilityClassification === "eligible_for_projection_promotion")),
      poolMetric("promotion_eligible_excluding_k", rows.filter((row) => row.promotionEligibilityClassification === "eligible_for_projection_promotion" && row.position !== "K")),
      poolMetric("manual_review_rows", rows.filter((row) => row.promotionEligibilityClassification === "manual_review_before_promotion")),
      poolMetric("blocked_rows", rows.filter((row) => row.promotionEligibilityClassification === "blocked_from_promotion")),
      poolMetric("shadow_only_rows", rows.filter((row) => row.promotionEligibilityClassification === "shadow_only")),
    ],
    rows,
    topEligibleMovements: topMovements(rows, "eligible_for_projection_promotion", 25),
    topManualReviewMovements: topMovements(rows, "manual_review_before_promotion", 25),
    topBlockedMovements: topMovements(rows, "blocked_from_promotion", 25),
    topShadowOnlyMovements: topMovements(rows, "shadow_only", 25),
    criticalMovementRows: rows.filter((row) => row.criticalMovement).sort(compareByAbsMovement),
    kickerPolicy,
    safetyGates,
    verdict,
    notes: [
      "Dry-run/read-only promotion candidate pool audit only.",
      "Rows are classified for future promotion review; no projection artifacts are filtered or mutated.",
      "No live projections, 2026 production outputs, Supabase writes, War Room UI, Blackbird Rank, or Draft Suggestion ordering are changed.",
      "K rows are intentionally kept out of the initial eligible promotion pool until kicker low-prior fallback policy is reviewed.",
    ],
  };
}

export function writeProjectionPromotionCandidatePoolArtifacts(report: ProjectionPromotionCandidatePoolReport): ProjectionPromotionCandidatePoolArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-promotion-candidate-pool-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderProjectionPromotionCandidatePoolMarkdown(report), "utf8");
  writeFileSync(csvPath, renderProjectionPromotionCandidatePoolCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

export function classifyPromotionRow(universeRow: ProjectionUniverseEligibilityRow, shadowRow: ProjectionV82ShadowRow | null): ProjectionPromotionCandidateRow {
  const reasonCodes = new Set<ProjectionPromotionCandidateReasonCode>();
  const criticalMovement = universeRow.criticalMovement || shadowRow?.risk === "critical";
  const projectedTotalPointDelta = universeRow.projectedTotalPointDelta ?? shadowRow?.projectedTotalPointDelta ?? null;
  const absPointDelta = Math.abs(projectedTotalPointDelta ?? 0);
  const highImpact = HIGH_IMPACT_POSITIONS.has(universeRow.position);
  const hasMissingCurrentTeam = universeRow.reasonCodes.includes("missing_current_team");
  const hasLegacySignal = universeRow.eligibilityStatus === "retired_or_legacy_suspect" || universeRow.reasonCodes.includes("legacy_name_match") || universeRow.reasonCodes.includes("manual_review_name_flag");
  const oldLastSeenBlocked = universeRow.lastActiveSeason !== null && universeRow.lastActiveSeason <= 2021 && !universeRow.noPriorNflData;
  let classification: ProjectionPromotionEligibilityClassification;

  if (hasLegacySignal) {
    classification = "blocked_from_promotion";
    reasonCodes.add("retired_legacy_blocked");
    if (universeRow.reasonCodes.includes("manual_review_name_flag")) reasonCodes.add("manual_name_flag_blocked");
  } else if (hasMissingCurrentTeam && oldLastSeenBlocked) {
    classification = "blocked_from_promotion";
    reasonCodes.add("missing_current_team_blocked");
    reasonCodes.add("old_last_seen_blocked");
    reasonCodes.add("no_2026_roster_signal_blocked");
  } else if (universeRow.position === "K") {
    classification = criticalMovement ? "manual_review_before_promotion" : "shadow_only";
    reasonCodes.add("kicker_policy_shadow_only");
    if (criticalMovement) reasonCodes.add("critical_movement_manual_review");
  } else if (criticalMovement || (highImpact && absPointDelta >= 20)) {
    classification = "manual_review_before_promotion";
    reasonCodes.add("critical_movement_manual_review");
    if (highImpact) reasonCodes.add("high_impact_manual_review");
    if (universeRow.eligibilityStatus === "rookie_or_new_player") reasonCodes.add("rookie_extreme_movement_review");
    if (universeRow.eligibilityStatus === "active_plausible" && !universeRow.noPriorNflData) reasonCodes.add("active_veteran_large_movement_review");
  } else if (universeRow.eligibilityStatus === "stale_historical_signal") {
    classification = "shadow_only";
    reasonCodes.add("stale_signal_shadow_only");
    if (universeRow.reasonCodes.includes("no_2026_roster_signal")) reasonCodes.add("no_2026_roster_signal_blocked");
  } else if (universeRow.eligibilityStatus === "manual_review_required") {
    classification = "manual_review_before_promotion";
    reasonCodes.add("ambiguous_roster_signal_review");
  } else if (universeRow.eligibilityStatus === "low_confidence_plausible" && universeRow.priorGames < 12) {
    classification = "shadow_only";
    reasonCodes.add("low_prior_shadow_only");
  } else {
    classification = "eligible_for_projection_promotion";
    if (universeRow.eligibilityStatus === "active_plausible") reasonCodes.add("active_plausible_allowed");
    if (universeRow.eligibilityStatus === "rookie_or_new_player") reasonCodes.add("rookie_allowed");
    if (universeRow.eligibilityStatus === "low_confidence_plausible") reasonCodes.add("low_confidence_allowed");
  }

  return {
    playerId: universeRow.playerId,
    sleeperId: universeRow.sleeperId,
    gsisId: universeRow.gsisId,
    player: universeRow.player,
    position: universeRow.position,
    team: universeRow.team,
    universeEligibilityStatus: universeRow.eligibilityStatus,
    promotionEligibilityClassification: classification,
    reasonCodes: [...reasonCodes].sort(),
    universeReasonCodes: [...universeRow.reasonCodes],
    currentExpectedGames: universeRow.currentExpectedGames,
    v82ExpectedGames: universeRow.v82ExpectedGames,
    gamesDelta: universeRow.gamesDelta,
    projectedTotalPointDelta,
    movementBucket: movementBucketFor(projectedTotalPointDelta ?? 0),
    criticalMovement,
    rankingMovementEstimated: universeRow.estimatedOverallRankMovement !== null,
    estimatedOverallRankMovement: universeRow.estimatedOverallRankMovement,
    recommendedAction: recommendedActionFor(classification, universeRow.position),
    riskFlags: riskFlagsFor(universeRow, shadowRow, criticalMovement, absPointDelta),
    cohortTags: cohortTagsFor(universeRow, shadowRow),
    lastActiveSeason: universeRow.lastActiveSeason,
    priorGames: universeRow.priorGames,
    noPriorNflData: universeRow.noPriorNflData,
    matchConfidence: universeRow.matchConfidence,
  };
}

export function renderProjectionPromotionCandidatePoolMarkdown(report: ProjectionPromotionCandidatePoolReport): string {
  return `# Projection Promotion Candidate Pool ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Verdict: ${report.verdict}

## Classification Counts

\`\`\`json
${JSON.stringify(report.summary.classificationCounts, null, 2)}
\`\`\`

## Safety Gates

${renderGateTable(report.safetyGates)}

## Pool Metrics

${renderPoolMetricTable(report.poolMetrics)}

## Kicker Policy

\`\`\`json
${JSON.stringify(report.kickerPolicy, null, 2)}
\`\`\`

## Top Eligible Movements

${renderRowsTable(report.topEligibleMovements)}

## Top Manual-Review Movements

${renderRowsTable(report.topManualReviewMovements)}

## Top Blocked Movements

${renderRowsTable(report.topBlockedMovements)}

## Top Shadow-Only Movements

${renderRowsTable(report.topShadowOnlyMovements)}

## All Critical Movement Rows

${renderRowsTable(report.criticalMovementRows)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

export function renderProjectionPromotionCandidatePoolCsv(report: ProjectionPromotionCandidatePoolReport): string {
  const headers = [
    "player_id",
    "sleeper_id",
    "gsis_id",
    "player",
    "position",
    "team",
    "universe_eligibility_status",
    "promotion_eligibility_classification",
    "reason_codes",
    "universe_reason_codes",
    "current_expected_games",
    "v82_expected_games",
    "games_delta",
    "projected_total_point_delta",
    "movement_bucket",
    "critical_movement",
    "ranking_movement_estimated",
    "estimated_overall_rank_movement",
    "recommended_action",
    "risk_flags",
    "cohort_tags",
    "last_active_season",
    "prior_games",
    "no_prior_nfl_data",
    "match_confidence",
  ];
  const rows = report.rows.map((row) => [
    row.playerId,
    row.sleeperId ?? "",
    row.gsisId ?? "",
    row.player,
    row.position,
    row.team ?? "",
    row.universeEligibilityStatus,
    row.promotionEligibilityClassification,
    row.reasonCodes.join("|"),
    row.universeReasonCodes.join("|"),
    row.currentExpectedGames ?? "",
    row.v82ExpectedGames ?? "",
    row.gamesDelta ?? "",
    row.projectedTotalPointDelta ?? "",
    row.movementBucket,
    row.criticalMovement,
    row.rankingMovementEstimated,
    row.estimatedOverallRankMovement ?? "",
    row.recommendedAction,
    row.riskFlags.join("|"),
    row.cohortTags.join("|"),
    row.lastActiveSeason ?? "",
    row.priorGames,
    row.noPriorNflData,
    row.matchConfidence,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function recommendedActionFor(classification: ProjectionPromotionEligibilityClassification, position: string): ProjectionPromotionRecommendedAction {
  if (classification === "eligible_for_projection_promotion") return "ready_for_promotion_review_pool";
  if (position === "K" && classification !== "blocked_from_promotion") return "review_kicker_policy_before_promotion";
  if (classification === "manual_review_before_promotion") return "manual_review_required_before_promotion";
  if (classification === "blocked_from_promotion") return "exclude_from_promotion_candidate_pool";
  return "keep_shadow_only";
}

function riskFlagsFor(universeRow: ProjectionUniverseEligibilityRow, shadowRow: ProjectionV82ShadowRow | null, criticalMovement: boolean, absPointDelta: number) {
  const flags = new Set<string>(shadowRow?.riskFlags ?? []);
  if (criticalMovement) flags.add("critical_movement");
  if (absPointDelta >= 20) flags.add("projected_points_delta_20_plus");
  if (!universeRow.team) flags.add("missing_team");
  if (universeRow.eligibilityStatus === "retired_or_legacy_suspect") flags.add("retired_legacy_suspect");
  if (universeRow.position === "K") flags.add("kicker_policy_pending");
  return [...flags].sort();
}

function cohortTagsFor(universeRow: ProjectionUniverseEligibilityRow, shadowRow: ProjectionV82ShadowRow | null) {
  const tags = new Set<string>(shadowRow?.cohorts ?? []);
  tags.add(universeRow.eligibilityStatus);
  if (universeRow.priorGames < 12) tags.add("low_prior_sample");
  if (["DL", "LB", "DB"].includes(universeRow.position)) tags.add("idp");
  if (HIGH_IMPACT_POSITIONS.has(universeRow.position)) tags.add("offense");
  if (universeRow.position === "K") tags.add("kicker");
  return [...tags].sort();
}

function buildKickerPolicy(rows: ProjectionPromotionCandidateRow[]) {
  const kRows = rows.filter((row) => row.position === "K");
  return {
    totalKRows: kRows.length,
    eligibleKRows: kRows.filter((row) => row.promotionEligibilityClassification === "eligible_for_projection_promotion").length,
    manualReviewKRows: kRows.filter((row) => row.promotionEligibilityClassification === "manual_review_before_promotion").length,
    shadowOnlyKRows: kRows.filter((row) => row.promotionEligibilityClassification === "shadow_only").length,
    blockedKRows: kRows.filter((row) => row.promotionEligibilityClassification === "blocked_from_promotion").length,
    criticalMovementKRows: kRows.filter((row) => row.criticalMovement).length,
    excludedFromEligiblePoolRows: kRows.filter((row) => row.promotionEligibilityClassification !== "eligible_for_projection_promotion").length,
    recommendation: "Keep K excluded from the initial promotion-eligible pool until low-prior kicker fallback policy is reviewed.",
  };
}

function buildSafetyGates(rows: ProjectionPromotionCandidateRow[], kickerPolicy: ReturnType<typeof buildKickerPolicy>) {
  const retiredLegacyRows = rows.filter((row) => row.universeEligibilityStatus === "retired_or_legacy_suspect");
  const criticalRows = rows.filter((row) => row.criticalMovement);
  const eligibleRows = rows.filter((row) => row.promotionEligibilityClassification === "eligible_for_projection_promotion");
  return [
    gate("no_live_outputs_changed", true, "Candidate-pool audit reads dry-run artifacts and writes only audit artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Ranking movement is copied from shadow diagnostics only."),
    gate("draft_suggestions_unchanged", true, "Draft suggestion code paths are not imported or executed."),
    gate("war_room_unchanged", true, "War Room UI code is not imported or modified."),
    gate("retired_legacy_rows_blocked", retiredLegacyRows.every((row) => row.promotionEligibilityClassification === "blocked_from_promotion"), `${retiredLegacyRows.length} retired/legacy rows checked.`),
    gate("k_rows_not_eligible_initially", kickerPolicy.eligibleKRows === 0, `${kickerPolicy.eligibleKRows} K rows eligible.`),
    gate("critical_movements_classified", criticalRows.every((row) => row.promotionEligibilityClassification !== "eligible_for_projection_promotion"), `${criticalRows.length} critical movement rows classified outside eligible pool.`),
    gate("eligible_pool_generated", eligibleRows.length > 0, `${eligibleRows.length} eligible rows generated.`),
    gate("eligible_pool_has_no_legacy_suspects", eligibleRows.every((row) => row.universeEligibilityStatus !== "retired_or_legacy_suspect"), `${eligibleRows.length} eligible rows checked.`),
  ];
}

function verdictFor(rows: ProjectionPromotionCandidateRow[], gates: ProjectionPromotionCandidatePoolReport["safetyGates"]): ProjectionPromotionPoolVerdict {
  if (gates.some((gate) => !gate.passed)) return "promotion_pool_blocked";
  if (rows.some((row) => row.promotionEligibilityClassification === "blocked_from_promotion" && row.criticalMovement)) return "promotion_pool_needs_manual_review";
  if (rows.some((row) => row.promotionEligibilityClassification === "manual_review_before_promotion")) return "promotion_pool_needs_manual_review";
  return "promotion_pool_clean_for_review";
}

function poolMetric(segment: string, rows: ProjectionPromotionCandidateRow[]): ProjectionPromotionPoolMetric {
  return {
    segment,
    rows: rows.length,
    movementBucketCounts: movementBucketCounts(rows),
    criticalMovementRows: rows.filter((row) => row.criticalMovement).length,
    averageProjectedPointDelta: mean(rows.map((row) => row.projectedTotalPointDelta ?? 0)),
    averageAbsProjectedPointDelta: mean(rows.map((row) => Math.abs(row.projectedTotalPointDelta ?? 0))),
    topMovements: [...rows].sort(compareByAbsMovement).slice(0, 10),
    positionMovementCounts: countBy(rows.map((row) => row.position)),
    cohortMovementCounts: countBy(rows.flatMap((row) => row.cohortTags)),
  };
}

function classificationCounts(rows: ProjectionPromotionCandidateRow[]) {
  return Object.fromEntries(CLASSIFICATIONS.map((classification) => [classification, rows.filter((row) => row.promotionEligibilityClassification === classification).length])) as Record<ProjectionPromotionEligibilityClassification, number>;
}

function groupedClassificationCounts(rows: ProjectionPromotionCandidateRow[], key: (row: ProjectionPromotionCandidateRow) => string | string[]) {
  const result: Record<string, Record<ProjectionPromotionEligibilityClassification, number>> = {};
  for (const row of rows) {
    const keys = Array.isArray(key(row)) ? key(row) as string[] : [key(row) as string];
    for (const group of keys) {
      result[group] ??= Object.fromEntries(CLASSIFICATIONS.map((classification) => [classification, 0])) as Record<ProjectionPromotionEligibilityClassification, number>;
      result[group][row.promotionEligibilityClassification] += 1;
    }
  }
  return result;
}

function topMovements(rows: ProjectionPromotionCandidateRow[], classification: ProjectionPromotionEligibilityClassification, limit: number) {
  return rows.filter((row) => row.promotionEligibilityClassification === classification).sort(compareByAbsMovement).slice(0, limit);
}

function movementBucketFor(delta: number): ProjectionPromotionMovementBucket {
  const absolute = Math.abs(delta);
  if (absolute === 0) return "0";
  if (absolute < 5) return "0-5";
  if (absolute < 10) return "5-10";
  if (absolute < 20) return "10-20";
  return "20+";
}

function movementBucketCounts(rows: ProjectionPromotionCandidateRow[]) {
  return Object.fromEntries(MOVEMENT_BUCKETS.map((bucket) => [bucket, rows.filter((row) => row.movementBucket === bucket).length])) as Record<ProjectionPromotionMovementBucket, number>;
}

function renderGateTable(gates: ProjectionPromotionCandidatePoolReport["safetyGates"]) {
  const header = "| Gate | Status | Detail |";
  const divider = "|---|---|---|";
  return [header, divider, ...gates.map((gate) => `| ${gate.name} | ${gate.passed ? "PASS" : "FAIL"} | ${gate.detail} |`)].join("\n");
}

function renderPoolMetricTable(metrics: ProjectionPromotionPoolMetric[]) {
  const header = "| Pool | Rows | Critical | Avg Delta | Avg Abs Delta | 20+ Moves |";
  const divider = "|---|---:|---:|---:|---:|---:|";
  return [header, divider, ...metrics.map((metric) => `| ${metric.segment} | ${metric.rows} | ${metric.criticalMovementRows} | ${format(metric.averageProjectedPointDelta)} | ${format(metric.averageAbsProjectedPointDelta)} | ${metric.movementBucketCounts["20+"]} |`)].join("\n");
}

function renderRowsTable(rows: ProjectionPromotionCandidateRow[]) {
  if (!rows.length) return "No rows.";
  const header = "| Player | Pos | Team | Class | Universe | Points Delta | Current G | v8.2 G | Reasons | Action |";
  const divider = "|---|---|---|---|---|---:|---:|---:|---|---|";
  return [header, divider, ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.team ?? ""} | ${row.promotionEligibilityClassification} | ${row.universeEligibilityStatus} | ${row.projectedTotalPointDelta ?? ""} | ${row.currentExpectedGames ?? ""} | ${row.v82ExpectedGames ?? ""} | ${row.reasonCodes.join(" ")} | ${row.recommendedAction} |`)].join("\n");
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function compareByClassificationThenMovement(a: ProjectionPromotionCandidateRow, b: ProjectionPromotionCandidateRow) {
  return classificationRank(a.promotionEligibilityClassification) - classificationRank(b.promotionEligibilityClassification) || compareByAbsMovement(a, b);
}

function classificationRank(classification: ProjectionPromotionEligibilityClassification) {
  return CLASSIFICATIONS.indexOf(classification);
}

function compareByAbsMovement(a: ProjectionPromotionCandidateRow, b: ProjectionPromotionCandidateRow) {
  return Math.abs(b.projectedTotalPointDelta ?? 0) - Math.abs(a.projectedTotalPointDelta ?? 0) || a.player.localeCompare(b.player);
}

function countBy(values: string[]) {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function mean(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 1000) / 1000;
}

function format(value: number | null) {
  return value === null ? "n/a" : String(value);
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
