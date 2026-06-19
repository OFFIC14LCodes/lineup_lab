import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ProjectionPromotionCandidatePoolReport, ProjectionPromotionCandidateRow } from "./projection-promotion-candidate-pool-types";
import type { ProjectionUniverseEligibilityAuditReport, ProjectionUniverseEligibilityRow } from "./projection-universe-eligibility-audit-types";
import type { ProjectionUniverseHygieneSummaryReport } from "./projection-universe-hygiene-summary-types";
import type { ProjectionV82FeatureFlagReviewPacketReport } from "./projection-v8-2-feature-flag-review-packet-types";
import type {
  ProjectionActiveUniverseGateArtifactPaths,
  ProjectionActiveUniverseGateInput,
  ProjectionActiveUniverseGateOptions,
  ProjectionActiveUniverseGateReasonCode,
  ProjectionActiveUniverseGateReport,
  ProjectionActiveUniverseGateRow,
  ProjectionActiveUniverseGateStatus,
  ProjectionActiveUniverseGateV82Path,
} from "./projection-active-universe-gate-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const GATE_STATUSES: ProjectionActiveUniverseGateStatus[] = [
  "active_confirmed",
  "rookie_or_new_confirmed",
  "free_agent_plausible",
  "low_confidence_plausible",
  "stale_status_review",
  "legacy_archive_blocked",
  "kicker_policy_review",
  "manual_review_required",
];
const V82_PATHS: ProjectionActiveUniverseGateV82Path[] = ["would_use_v8_2_safe_subset", "would_stay_current_path", "excluded_or_blocked"];

export function runProjectionActiveUniverseGate(options: ProjectionActiveUniverseGateOptions): ProjectionActiveUniverseGateReport {
  const sourceArtifacts = {
    preseasonProjectionSnapshot: path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`),
    universeEligibilityAudit: path.join(OUTPUT_DIR, `projection-universe-eligibility-audit-${options.projectionSeason}.json`),
    universeHygieneSummary: path.join(OUTPUT_DIR, `projection-universe-hygiene-summary-${options.projectionSeason}.json`),
    promotionCandidatePool: path.join(OUTPUT_DIR, `projection-promotion-candidate-pool-${options.projectionSeason}.json`),
    featureFlagReviewPacket: path.join(OUTPUT_DIR, `projection-v8-2-feature-flag-review-packet-${options.projectionSeason}.json`),
  };
  for (const artifactPath of Object.values(sourceArtifacts)) {
    if (!existsSync(artifactPath)) throw new Error(`Missing ${path.relative(process.cwd(), artifactPath)}.`);
  }

  return buildProjectionActiveUniverseGateFromData({
    options,
    universeEligibilityAudit: readJson<ProjectionUniverseEligibilityAuditReport>(sourceArtifacts.universeEligibilityAudit),
    universeHygieneSummary: readJson<ProjectionUniverseHygieneSummaryReport>(sourceArtifacts.universeHygieneSummary),
    promotionCandidatePool: readJson<ProjectionPromotionCandidatePoolReport>(sourceArtifacts.promotionCandidatePool),
    featureFlagReviewPacket: readJson<ProjectionV82FeatureFlagReviewPacketReport>(sourceArtifacts.featureFlagReviewPacket),
    sourceArtifacts,
  });
}

export function buildProjectionActiveUniverseGateFromData(input: ProjectionActiveUniverseGateInput): ProjectionActiveUniverseGateReport {
  const promotionById = new Map(input.promotionCandidatePool.rows.map((row) => [row.playerId, row]));
  const rows = input.universeEligibilityAudit.rows.map((row) => activeUniverseGateRow(row, promotionById.get(row.playerId)));
  const activeGateCounts = {
    totalRows: rows.length,
    statusCounts: countStatuses(rows),
    byPosition: countNested(rows, (row) => row.position || "unknown_position", (row) => row.gateStatus),
    byTeam: countNested(rows, (row) => row.team ?? "missing_team", (row) => row.gateStatus),
    byOriginalHygieneStatus: countNested(rows, (row) => row.universeEligibilityStatus, (row) => row.gateStatus),
    byPromotionClassification: countNested(rows, (row) => row.promotionEligibilityClassification, (row) => row.gateStatus),
  };
  const sourceIntegrationNeeds = {
    currentRosterSourceNeeded: rows.filter((row) => row.reasonCodes.includes("needs_current_roster_source")).length,
    depthChartSourceNeeded: rows.filter((row) => row.reasonCodes.includes("needs_depth_chart_source")).length,
    transactionFreeAgentStatusSourceNeeded: rows.filter((row) => row.gateStatus === "free_agent_plausible").length,
    rookieDraftTeamSourceNeeded: rows.filter((row) => row.gateStatus === "rookie_or_new_confirmed" && (!row.team || row.reasonCodes.includes("ambiguous_team_signal"))).length,
    injuryPupNfiStatusSourceNeeded: rows.filter((row) => row.gateStatus === "low_confidence_plausible" || row.reasonCodes.includes("critical_movement_protected")).length,
    kickerSpecificDepthChartSourceNeeded: rows.filter((row) => row.gateStatus === "kicker_policy_review").length,
    notes: [
      "Counts identify source needs only; H16 does not fetch external roster, depth chart, transaction, rookie, injury, or kicker sources.",
      "Team values are treated as stale-suspect when paired with old activity signals, even when the team field is populated.",
    ],
  };
  const candidatePool = {
    activeUniverseCandidateRows: rows.filter((row) => row.gateStatus === "active_confirmed" || row.gateStatus === "rookie_or_new_confirmed" || row.gateStatus === "free_agent_plausible").length,
    blockedArchiveRows: rows.filter((row) => row.gateStatus === "legacy_archive_blocked").length,
    reviewRows: rows.filter((row) => row.gateStatus === "stale_status_review" || row.gateStatus === "low_confidence_plausible" || row.gateStatus === "manual_review_required").length,
    kickerPolicyRows: rows.filter((row) => row.gateStatus === "kicker_policy_review").length,
    note: "Candidate groups are reported only; production outputs are not filtered or changed.",
  };
  const v82SafeSubsetCrossReference = {
    byGateStatus: countV82ByGateStatus(rows),
    packetSummary: {
      enabledSafeSubsetV82Rows: input.featureFlagReviewPacket.safetySummary.enabledSafeSubsetV82Rows,
      currentPathProtectedRows: input.featureFlagReviewPacket.safetySummary.currentPathProtectedRows,
      excludedRows: input.featureFlagReviewPacket.safetySummary.excludedRows,
      blockedRows: input.featureFlagReviewPacket.safetySummary.blockedRows,
    },
    note: "Row-level path is a dry-run classification inferred from promotion pool eligibility and protection flags; it does not enable v8.2.",
  };
  const topReviewTables = {
    staleStatusReview: topRows(rows.filter((row) => row.gateStatus === "stale_status_review")),
    legacyArchiveBlocked: topRows(rows.filter((row) => row.gateStatus === "legacy_archive_blocked")),
    freeAgentPlausible: topRows(rows.filter((row) => row.gateStatus === "free_agent_plausible")),
    lowConfidencePlausible: topRows(rows.filter((row) => row.gateStatus === "low_confidence_plausible")),
    ambiguousTeamRows: topRows(rows.filter((row) => row.reasonCodes.includes("ambiguous_team_signal")), 100),
    kickerPolicyReview: topRows(rows.filter((row) => row.gateStatus === "kicker_policy_review"), 150),
  };
  const safetyGates = buildSafetyGates(rows, sourceIntegrationNeeds, input.universeHygieneSummary);
  const recommendation = recommendationFor(safetyGates, candidatePool, sourceIntegrationNeeds);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? {
      preseasonProjectionSnapshot: "in-memory",
      universeEligibilityAudit: "in-memory",
      universeHygieneSummary: "in-memory",
      promotionCandidatePool: "in-memory",
      featureFlagReviewPacket: "in-memory",
    },
    activeGateCounts,
    sourceIntegrationNeeds,
    candidatePool,
    v82SafeSubsetCrossReference,
    topReviewTables,
    rows,
    safetyGates,
    recommendation,
    notes: [
      "H16 is a dry-run/read-only active-universe gate report.",
      "No source player records are deleted and no production outputs are silently filtered.",
      "No live projections, Blackbird Rank ordering, Draft Suggestion ordering, War Room scoring behavior, Supabase writes, AI calls, or v8.2 enablement are changed.",
    ],
  };
}

export function writeProjectionActiveUniverseGateArtifacts(report: ProjectionActiveUniverseGateReport): ProjectionActiveUniverseGateArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-active-universe-gate-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function activeUniverseGateRow(universeRow: ProjectionUniverseEligibilityRow, promotionRow: ProjectionPromotionCandidateRow | undefined): ProjectionActiveUniverseGateRow {
  const reasonCodes = activeUniverseReasonCodes(universeRow, promotionRow);
  const gateStatus = activeUniverseGateStatus(universeRow, promotionRow, reasonCodes);
  return {
    playerId: universeRow.playerId,
    player: universeRow.player,
    position: universeRow.position,
    team: universeRow.team,
    lastActiveSeason: universeRow.lastActiveSeason,
    gateStatus,
    reasonCodes,
    universeEligibilityStatus: universeRow.eligibilityStatus,
    promotionEligibilityClassification: promotionRow?.promotionEligibilityClassification ?? "missing_from_candidate_pool",
    v82Path: v82PathFor(promotionRow),
    currentExpectedGames: universeRow.currentExpectedGames,
    v82ExpectedGames: universeRow.v82ExpectedGames,
    projectedTotalPointDelta: universeRow.projectedTotalPointDelta,
    criticalMovement: universeRow.criticalMovement || Boolean(promotionRow?.criticalMovement),
    estimatedOverallRankMovement: universeRow.estimatedOverallRankMovement ?? promotionRow?.estimatedOverallRankMovement ?? null,
    matchConfidence: universeRow.matchConfidence,
    recommendedAction: promotionRow?.recommendedAction ?? universeRow.recommendedAction,
  };
}

function activeUniverseReasonCodes(universeRow: ProjectionUniverseEligibilityRow, promotionRow: ProjectionPromotionCandidateRow | undefined): ProjectionActiveUniverseGateReasonCode[] {
  const codes = new Set<ProjectionActiveUniverseGateReasonCode>();
  if (universeRow.team) codes.add("current_team_present");
  if (universeRow.reasonCodes.includes("old_last_seen_season")) {
    codes.add("old_last_seen_signal");
    if (universeRow.team) codes.add("team_value_stale_suspect");
  }
  if (universeRow.reasonCodes.includes("recent_nfl_activity")) codes.add("recent_activity_signal");
  if (universeRow.reasonCodes.includes("rookie_current_class") || universeRow.noPriorNflData) codes.add("rookie_current_class");
  if (universeRow.eligibilityStatus === "retired_or_legacy_suspect" || promotionRow?.reasonCodes.includes("retired_legacy_blocked")) codes.add("blocked_legacy_from_hygiene");
  if (promotionRow?.promotionEligibilityClassification === "eligible_for_projection_promotion") codes.add("promotion_eligible");
  if (promotionRow?.promotionEligibilityClassification === "shadow_only") codes.add("shadow_only_from_candidate_pool");
  if (universeRow.position === "K" || promotionRow?.reasonCodes.includes("kicker_policy_shadow_only") || universeRow.reasonCodes.includes("kicker_low_prior_fallback")) {
    codes.add("kicker_policy_excluded");
    codes.add("needs_depth_chart_source");
  }
  if (universeRow.criticalMovement || promotionRow?.criticalMovement) codes.add("critical_movement_protected");
  if (
    promotionRow?.reasonCodes.includes("high_impact_manual_review") ||
    promotionRow?.reasonCodes.includes("active_veteran_large_movement_review") ||
    promotionRow?.reasonCodes.includes("rookie_extreme_movement_review")
  ) {
    codes.add("meaningful_rank_protected");
  }
  if (universeRow.matchConfidence === "weak" || universeRow.reasonCodes.includes("missing_current_team")) {
    codes.add("ambiguous_team_signal");
    codes.add("needs_current_roster_source");
  }
  if (universeRow.reasonCodes.includes("no_2026_roster_signal")) {
    codes.add("needs_current_roster_source");
  }
  if (universeRow.eligibilityStatus === "stale_historical_signal" || universeRow.eligibilityStatus === "low_confidence_plausible") {
    codes.add("needs_depth_chart_source");
  }
  return [...codes];
}

function activeUniverseGateStatus(
  universeRow: ProjectionUniverseEligibilityRow,
  promotionRow: ProjectionPromotionCandidateRow | undefined,
  reasonCodes: ProjectionActiveUniverseGateReasonCode[],
): ProjectionActiveUniverseGateStatus {
  if (universeRow.position === "K" || reasonCodes.includes("kicker_policy_excluded")) return "kicker_policy_review";
  if (universeRow.eligibilityStatus === "retired_or_legacy_suspect" || promotionRow?.promotionEligibilityClassification === "blocked_from_promotion") return "legacy_archive_blocked";
  if (universeRow.eligibilityStatus === "manual_review_required" || promotionRow?.promotionEligibilityClassification === "manual_review_before_promotion") return "manual_review_required";
  if (universeRow.eligibilityStatus === "stale_historical_signal" || reasonCodes.includes("old_last_seen_signal")) return "stale_status_review";
  if (universeRow.eligibilityStatus === "rookie_or_new_player") return "rookie_or_new_confirmed";
  if (universeRow.eligibilityStatus === "low_confidence_plausible") return "low_confidence_plausible";
  if (universeRow.team === "FA" || universeRow.team === null || reasonCodes.includes("ambiguous_team_signal")) return "free_agent_plausible";
  return "active_confirmed";
}

function v82PathFor(row: ProjectionPromotionCandidateRow | undefined): ProjectionActiveUniverseGateV82Path {
  if (!row) return "excluded_or_blocked";
  if (row.promotionEligibilityClassification === "eligible_for_projection_promotion" && row.position !== "K" && !row.criticalMovement) {
    return "would_use_v8_2_safe_subset";
  }
  if (row.promotionEligibilityClassification === "eligible_for_projection_promotion" || row.promotionEligibilityClassification === "manual_review_before_promotion") {
    return "would_stay_current_path";
  }
  return "excluded_or_blocked";
}

function buildSafetyGates(
  rows: ProjectionActiveUniverseGateRow[],
  sourceIntegrationNeeds: ProjectionActiveUniverseGateReport["sourceIntegrationNeeds"],
  hygieneSummary: ProjectionUniverseHygieneSummaryReport,
) {
  const activeLegacyRows = rows.filter((row) => row.gateStatus === "active_confirmed" && row.reasonCodes.includes("blocked_legacy_from_hygiene"));
  const activeKRows = rows.filter((row) => row.gateStatus === "active_confirmed" && row.position === "K");
  const staleHygieneRows = rows.filter((row) => row.universeEligibilityStatus === "stale_historical_signal");
  const unreportedStaleRows = staleHygieneRows.filter((row) => !row.reasonCodes.includes("old_last_seen_signal") && row.gateStatus === "active_confirmed");
  return [
    gate("no_live_outputs_changed", true, "Report reads artifacts and writes only local H16 artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Blackbird Rank ordering is not imported, recalculated, or mutated."),
    gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported, recalculated, or mutated."),
    gate("war_room_scoring_unchanged", true, "War Room scoring behavior is not imported, recalculated, or mutated."),
    gate("legacy_rows_not_active_confirmed", activeLegacyRows.length === 0, `${activeLegacyRows.length} legacy/archive rows active-confirmed.`),
    gate("k_rows_not_active_confirmed_without_policy", activeKRows.length === 0, `${activeKRows.length} K rows active-confirmed without policy.`),
    gate(
      "stale_rows_reported",
      staleHygieneRows.length === hygieneSummary.hygieneCounts.staleHistorical && unreportedStaleRows.length === 0,
      `${staleHygieneRows.length} stale hygiene rows reported; ${unreportedStaleRows.length} stale rows active-confirmed without stale reason; H15 stale count ${hygieneSummary.hygieneCounts.staleHistorical}.`,
    ),
    gate("source_needs_reported", sourceIntegrationNeeds.currentRosterSourceNeeded > 0 || sourceIntegrationNeeds.kickerSpecificDepthChartSourceNeeded > 0, `${sourceIntegrationNeeds.currentRosterSourceNeeded} roster-source and ${sourceIntegrationNeeds.kickerSpecificDepthChartSourceNeeded} K-source rows.`),
  ];
}

function recommendationFor(
  safetyGates: ProjectionActiveUniverseGateReport["safetyGates"],
  candidatePool: ProjectionActiveUniverseGateReport["candidatePool"],
  sourceIntegrationNeeds: ProjectionActiveUniverseGateReport["sourceIntegrationNeeds"],
): ProjectionActiveUniverseGateReport["recommendation"] {
  if (safetyGates.some((gateRow) => !gateRow.passed)) return "active_universe_gate_blocked";
  if (
    candidatePool.blockedArchiveRows > 0 ||
    candidatePool.reviewRows > 0 ||
    candidatePool.kickerPolicyRows > 0 ||
    sourceIntegrationNeeds.currentRosterSourceNeeded > 0 ||
    sourceIntegrationNeeds.depthChartSourceNeeded > 0
  ) {
    return "active_universe_gate_needs_review";
  }
  return "active_universe_gate_ready_for_source_integration";
}

function renderMarkdown(report: ProjectionActiveUniverseGateReport) {
  return `# Projection Active Universe Gate ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Recommendation: ${report.recommendation}

## Active Gate Counts

\`\`\`json
${JSON.stringify(report.activeGateCounts, null, 2)}
\`\`\`

## Source Integration Needs

\`\`\`json
${JSON.stringify(report.sourceIntegrationNeeds, null, 2)}
\`\`\`

## No-Mutation Candidate Pool

\`\`\`json
${JSON.stringify(report.candidatePool, null, 2)}
\`\`\`

## v8.2 Safe Subset Cross-Reference

\`\`\`json
${JSON.stringify(report.v82SafeSubsetCrossReference, null, 2)}
\`\`\`

## Top Review Tables

### Stale Status Review

${renderRows(report.topReviewTables.staleStatusReview)}

### Legacy Archive Blocked

${renderRows(report.topReviewTables.legacyArchiveBlocked)}

### Free Agent Plausible

${renderRows(report.topReviewTables.freeAgentPlausible)}

### Low Confidence Plausible

${renderRows(report.topReviewTables.lowConfidencePlausible)}

### Ambiguous Team Rows

${renderRows(report.topReviewTables.ambiguousTeamRows)}

### Kicker Policy Review

${renderRows(report.topReviewTables.kickerPolicyReview)}

## Safety Gates

${renderGateTable(report.safetyGates)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderCsv(report: ProjectionActiveUniverseGateReport) {
  const headers = [
    "player_id",
    "player",
    "position",
    "team",
    "last_active_season",
    "gate_status",
    "reason_codes",
    "hygiene_status",
    "promotion_classification",
    "v82_path",
    "projected_total_point_delta",
    "recommended_action",
  ];
  return [headers, ...report.rows.map((row) => [
    row.playerId,
    row.player,
    row.position,
    row.team ?? "",
    row.lastActiveSeason ?? "",
    row.gateStatus,
    row.reasonCodes.join("|"),
    row.universeEligibilityStatus,
    row.promotionEligibilityClassification,
    row.v82Path,
    row.projectedTotalPointDelta ?? "",
    row.recommendedAction,
  ])].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function renderRows(rows: ProjectionActiveUniverseGateRow[]) {
  if (!rows.length) return "No rows.";
  return [
    "| Player | Pos | Team | Last Active | Gate | Reasons | v8.2 Path |",
    "|---|---|---|---:|---|---|---|",
    ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.team ?? ""} | ${row.lastActiveSeason ?? ""} | ${row.gateStatus} | ${row.reasonCodes.join(" ")} | ${row.v82Path} |`),
  ].join("\n");
}

function renderGateTable(gates: ProjectionActiveUniverseGateReport["safetyGates"]) {
  return [
    "| Gate | Status | Detail |",
    "|---|---|---|",
    ...gates.map((gateRow) => `| ${gateRow.name} | ${gateRow.passed ? "PASS" : "FAIL"} | ${gateRow.detail} |`),
  ].join("\n");
}

function topRows(rows: ProjectionActiveUniverseGateRow[], limit = 50) {
  return [...rows]
    .sort((a, b) =>
      (a.lastActiveSeason ?? 9999) - (b.lastActiveSeason ?? 9999)
      || Math.abs(b.projectedTotalPointDelta ?? 0) - Math.abs(a.projectedTotalPointDelta ?? 0)
      || a.player.localeCompare(b.player)
    )
    .slice(0, limit);
}

function countStatuses(rows: ProjectionActiveUniverseGateRow[]) {
  const counts = Object.fromEntries(GATE_STATUSES.map((status) => [status, 0])) as Record<ProjectionActiveUniverseGateStatus, number>;
  for (const row of rows) counts[row.gateStatus] += 1;
  return counts;
}

function countV82ByGateStatus(rows: ProjectionActiveUniverseGateRow[]) {
  const counts = Object.fromEntries(
    GATE_STATUSES.map((status) => [
      status,
      Object.fromEntries(V82_PATHS.map((pathKey) => [pathKey, 0])) as Record<ProjectionActiveUniverseGateV82Path, number>,
    ]),
  ) as Record<ProjectionActiveUniverseGateStatus, Record<ProjectionActiveUniverseGateV82Path, number>>;
  for (const row of rows) counts[row.gateStatus][row.v82Path] += 1;
  return counts;
}

function countNested<Key extends string, Value extends string>(
  rows: ProjectionActiveUniverseGateRow[],
  keyFor: (row: ProjectionActiveUniverseGateRow) => Key,
  valueFor: (row: ProjectionActiveUniverseGateRow) => Value,
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
