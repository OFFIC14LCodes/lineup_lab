import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ProjectionPromotionCandidatePoolReport } from "./projection-promotion-candidate-pool-types";
import type { ProjectionUniverseEligibilityAuditReport, ProjectionUniverseEligibilityRow } from "./projection-universe-eligibility-audit-types";
import type { ProjectionV82FeatureFlagReviewPacketReport } from "./projection-v8-2-feature-flag-review-packet-types";
import type {
  ProjectionUniverseHygieneStaleLegacyRow,
  ProjectionUniverseHygieneSummaryArtifactPaths,
  ProjectionUniverseHygieneSummaryInput,
  ProjectionUniverseHygieneSummaryOptions,
  ProjectionUniverseHygieneSummaryReport,
} from "./projection-universe-hygiene-summary-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");

export function runProjectionUniverseHygieneSummary(options: ProjectionUniverseHygieneSummaryOptions): ProjectionUniverseHygieneSummaryReport {
  const sourceArtifacts = {
    universeEligibilityAudit: path.join(OUTPUT_DIR, `projection-universe-eligibility-audit-${options.projectionSeason}.json`),
    promotionCandidatePool: path.join(OUTPUT_DIR, `projection-promotion-candidate-pool-${options.projectionSeason}.json`),
    featureFlagReviewPacket: path.join(OUTPUT_DIR, `projection-v8-2-feature-flag-review-packet-${options.projectionSeason}.json`),
    preseasonProjectionSnapshot: path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`),
  };
  for (const artifactPath of Object.values(sourceArtifacts)) {
    if (!existsSync(artifactPath)) throw new Error(`Missing ${path.relative(process.cwd(), artifactPath)}.`);
  }

  return buildProjectionUniverseHygieneSummaryFromData({
    options,
    universeEligibilityAudit: readJson<ProjectionUniverseEligibilityAuditReport>(sourceArtifacts.universeEligibilityAudit),
    promotionCandidatePool: readJson<ProjectionPromotionCandidatePoolReport>(sourceArtifacts.promotionCandidatePool),
    featureFlagReviewPacket: readJson<ProjectionV82FeatureFlagReviewPacketReport>(sourceArtifacts.featureFlagReviewPacket),
    sourceArtifacts,
  });
}

export function buildProjectionUniverseHygieneSummaryFromData(input: ProjectionUniverseHygieneSummaryInput): ProjectionUniverseHygieneSummaryReport {
  const universeRows = input.universeEligibilityAudit.rows;
  const promotionRows = input.promotionCandidatePool.rows;
  const statusCounts = input.universeEligibilityAudit.summary.statusCounts;
  const classificationCounts = input.promotionCandidatePool.summary.classificationCounts;
  const missingTeamRows = universeRows.filter((row) => !row.team);
  const oldLastSeenRows = universeRows.filter((row) => row.reasonCodes.includes("old_last_seen_season"));
  const staleLegacyRows = universeRows
    .filter((row) => row.eligibilityStatus === "retired_or_legacy_suspect" || row.eligibilityStatus === "stale_historical_signal")
    .sort(compareStaleLegacy);
  const kRows = promotionRows.filter((row) => row.position === "K");
  const staleTeamRows = universeRows.filter((row) => row.team && row.reasonCodes.includes("old_last_seen_season"));
  const ambiguousTeamRows = universeRows.filter((row) => row.matchConfidence === "weak" || row.reasonCodes.includes("missing_current_team"));
  const hygieneCounts = {
    totalRows: universeRows.length,
    activePlausible: statusCounts.active_plausible ?? 0,
    lowConfidencePlausible: statusCounts.low_confidence_plausible ?? 0,
    rookieNew: statusCounts.rookie_or_new_player ?? 0,
    staleHistorical: statusCounts.stale_historical_signal ?? 0,
    retiredLegacySuspect: statusCounts.retired_or_legacy_suspect ?? 0,
    manualReviewRequired: statusCounts.manual_review_required ?? 0,
    blockedFromPromotion: classificationCounts.blocked_from_promotion ?? 0,
    shadowOnly: classificationCounts.shadow_only ?? 0,
    eligible: classificationCounts.eligible_for_projection_promotion ?? 0,
    missingTeam: missingTeamRows.length,
    unknownStatus: universeRows.filter((row) => !row.eligibilityStatus).length,
    oldLastSeenSignal: oldLastSeenRows.length,
    positionCounts: countBy(universeRows.map((row) => row.position || "unknown_position")),
    teamCounts: countBy(universeRows.map((row) => row.team ?? "missing_team")),
  };
  const staleLegacyReview = {
    totalRows: staleLegacyRows.length,
    topSuspects: staleLegacyRows.slice(0, 50).map(staleLegacyReviewRow),
    note: "Rows are reported for review only; H15 does not delete, filter, or remove source player records.",
  };
  const lowPriorKRows = kRows.filter((row) => row.reasonCodes.includes("low_prior_shadow_only") || row.universeReasonCodes.includes("kicker_low_prior_fallback"));
  const kickerPolicy = {
    totalKRows: input.promotionCandidatePool.kickerPolicy.totalKRows,
    eligibleKRows: input.promotionCandidatePool.kickerPolicy.eligibleKRows,
    shadowOnlyKRows: input.promotionCandidatePool.kickerPolicy.shadowOnlyKRows,
    blockedKRows: input.promotionCandidatePool.kickerPolicy.blockedKRows,
    lowPriorKRows: lowPriorKRows.length,
    criticalMovementKRows: input.promotionCandidatePool.kickerPolicy.criticalMovementKRows,
    whyExcludedFromV82Promotion: "K rows remain excluded from initial v8.2 promotion because low-prior kicker fallback behavior needs a dedicated policy review before promotion eligibility.",
    recommendedNextAction: "kicker_policy_review_required" as const,
  };
  const rookieRows = universeRows.filter((row) => row.eligibilityStatus === "rookie_or_new_player");
  const rosterTeamConfidence = {
    rowsWithCurrentTeam: universeRows.filter((row) => Boolean(row.team)).length,
    rowsMissingTeam: missingTeamRows.length,
    rowsWithAmbiguousTeam: ambiguousTeamRows.length,
    rowsWithStaleTeam: staleTeamRows.length,
    rookiesWithTeam: rookieRows.filter((row) => Boolean(row.team)).length,
    rookiesMissingTeam: rookieRows.filter((row) => !row.team).length,
    veteransMissingTeam: missingTeamRows.filter((row) => row.eligibilityStatus !== "rookie_or_new_player").length,
    sourceStatus: "insufficient_current_roster_source" as const,
    recommendation: "Integrate or refresh a current roster/team source before any future projection promotion so missing/stale team signals can be separated from true inactive players.",
  };
  const hygieneGates = buildHygieneGates(input, hygieneCounts, kickerPolicy, rosterTeamConfidence);
  const recommendation = recommendationFor(hygieneGates, hygieneCounts, kickerPolicy, rosterTeamConfidence);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? {
      universeEligibilityAudit: "in-memory",
      promotionCandidatePool: "in-memory",
      featureFlagReviewPacket: "in-memory",
      preseasonProjectionSnapshot: "in-memory",
    },
    hygieneCounts,
    staleLegacyReview,
    kickerPolicy,
    rosterTeamConfidence,
    reviewExamples: {
      staleLegacy: staleLegacyReview.topSuspects.slice(0, 25),
      missingTeam: missingTeamRows.slice(0, 25),
      kickerRows: kRows.slice(0, 25),
    },
    hygieneGates,
    recommendation,
    notes: [
      "H15 is dry-run/read-only data hygiene reporting only.",
      "No v8.2 enablement, promotion, live projection output, Supabase write, Blackbird Rank ordering, Draft Suggestion ordering, War Room scoring behavior, or AI API path is changed.",
      "Stale/legacy and K rows are reported for review; players are not deleted or silently removed from production outputs.",
    ],
  };
}

export function writeProjectionUniverseHygieneSummaryArtifacts(report: ProjectionUniverseHygieneSummaryReport): ProjectionUniverseHygieneSummaryArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-universe-hygiene-summary-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function buildHygieneGates(
  input: ProjectionUniverseHygieneSummaryInput,
  hygieneCounts: ProjectionUniverseHygieneSummaryReport["hygieneCounts"],
  kickerPolicy: ProjectionUniverseHygieneSummaryReport["kickerPolicy"],
  rosterTeamConfidence: ProjectionUniverseHygieneSummaryReport["rosterTeamConfidence"],
) {
  const blockedRows = input.promotionCandidatePool.rows.filter((row) => row.promotionEligibilityClassification === "blocked_from_promotion");
  const wronglyPromotedBlockedRows = input.promotionCandidatePool.rows.filter((row) =>
    row.promotionEligibilityClassification === "eligible_for_projection_promotion" &&
    (row.universeEligibilityStatus === "retired_or_legacy_suspect" || row.reasonCodes.includes("retired_legacy_blocked"))
  );
  return [
    gate("legacy_rows_identified", hygieneCounts.retiredLegacySuspect > 0 || hygieneCounts.staleHistorical > 0, `${hygieneCounts.retiredLegacySuspect} retired/legacy and ${hygieneCounts.staleHistorical} stale rows.`),
    gate("kicker_policy_flagged", kickerPolicy.totalKRows > 0 && kickerPolicy.recommendedNextAction === "kicker_policy_review_required", `${kickerPolicy.totalKRows} K rows; ${kickerPolicy.lowPriorKRows} low-prior K rows.`),
    gate("missing_team_rows_reported", rosterTeamConfidence.rowsMissingTeam >= 0, `${rosterTeamConfidence.rowsMissingTeam} missing-team rows.`),
    gate(
      "blocked_rows_not_promoted",
      blockedRows.length === hygieneCounts.blockedFromPromotion && wronglyPromotedBlockedRows.length === 0,
      `${hygieneCounts.blockedFromPromotion} blocked rows tracked; ${wronglyPromotedBlockedRows.length} blocked/legacy row(s) eligible.`,
    ),
    gate("no_live_outputs_changed", true, "Summary reads artifacts and writes only local H15 artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Blackbird Rank ordering is not imported, recalculated, or mutated."),
    gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported, recalculated, or mutated."),
    gate("war_room_scoring_unchanged", true, "War Room scoring behavior is not imported, recalculated, or mutated."),
    gate("v82_not_live", input.featureFlagReviewPacket.warRoomImpactSummary.riskConfidenceChangedRows === 0, input.featureFlagReviewPacket.recommendation),
  ];
}

function recommendationFor(
  gates: ProjectionUniverseHygieneSummaryReport["hygieneGates"],
  hygieneCounts: ProjectionUniverseHygieneSummaryReport["hygieneCounts"],
  kickerPolicy: ProjectionUniverseHygieneSummaryReport["kickerPolicy"],
  rosterTeamConfidence: ProjectionUniverseHygieneSummaryReport["rosterTeamConfidence"],
): ProjectionUniverseHygieneSummaryReport["recommendation"] {
  if (gates.some((gateRow) => !gateRow.passed)) return "universe_hygiene_blocked";
  if (
    hygieneCounts.retiredLegacySuspect > 0 ||
    hygieneCounts.staleHistorical > 0 ||
    kickerPolicy.totalKRows > 0 ||
    rosterTeamConfidence.rowsMissingTeam > 0 ||
    rosterTeamConfidence.rowsWithStaleTeam > 0
  ) {
    return "universe_hygiene_needs_review";
  }
  return "universe_hygiene_ready_for_source_integration";
}

function staleLegacyReviewRow(row: ProjectionUniverseEligibilityRow): ProjectionUniverseHygieneStaleLegacyRow {
  return {
    playerId: row.playerId,
    player: row.player,
    position: row.position,
    team: row.team,
    lastActiveSeason: row.lastActiveSeason,
    currentTeamStatus: row.team ? `team:${row.team}` : "missing_team",
    reasonCodes: row.reasonCodes,
    whyBlocked: row.recommendedAction,
  };
}

function renderMarkdown(report: ProjectionUniverseHygieneSummaryReport) {
  return `# Projection Universe Hygiene Summary ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Recommendation: ${report.recommendation}

## Hygiene Counts

\`\`\`json
${JSON.stringify(report.hygieneCounts, null, 2)}
\`\`\`

## Stale / Legacy Review

Total stale/legacy rows: ${report.staleLegacyReview.totalRows}

${renderStaleLegacyRows(report.staleLegacyReview.topSuspects)}

## Kicker Policy

\`\`\`json
${JSON.stringify(report.kickerPolicy, null, 2)}
\`\`\`

## Roster / Team Confidence

\`\`\`json
${JSON.stringify(report.rosterTeamConfidence, null, 2)}
\`\`\`

## Hygiene Gates

${renderGateTable(report.hygieneGates)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderCsv(report: ProjectionUniverseHygieneSummaryReport) {
  const headers = ["section", "player_id", "player", "position", "team", "last_active_season", "reason_codes", "status_or_classification", "action"];
  const rows = [
    ...report.reviewExamples.staleLegacy.map((row) => [
      "stale_legacy",
      row.playerId,
      row.player,
      row.position,
      row.team ?? "",
      row.lastActiveSeason ?? "",
      row.reasonCodes.join("|"),
      row.currentTeamStatus,
      row.whyBlocked,
    ]),
    ...report.reviewExamples.missingTeam.map((row) => [
      "missing_team",
      row.playerId,
      row.player,
      row.position,
      row.team ?? "",
      row.lastActiveSeason ?? "",
      row.reasonCodes.join("|"),
      row.eligibilityStatus,
      row.recommendedAction,
    ]),
    ...report.reviewExamples.kickerRows.map((row) => [
      "kicker_policy",
      row.playerId,
      row.player,
      row.position,
      row.team ?? "",
      row.lastActiveSeason ?? "",
      row.reasonCodes.join("|"),
      row.promotionEligibilityClassification,
      row.recommendedAction,
    ]),
  ];
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function renderStaleLegacyRows(rows: ProjectionUniverseHygieneStaleLegacyRow[]) {
  if (!rows.length) return "No rows.";
  return [
    "| Player | Pos | Team | Last Active | Reasons | Why Blocked |",
    "|---|---|---|---:|---|---|",
    ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.team ?? ""} | ${row.lastActiveSeason ?? ""} | ${row.reasonCodes.join(" ")} | ${row.whyBlocked} |`),
  ].join("\n");
}

function renderGateTable(gates: ProjectionUniverseHygieneSummaryReport["hygieneGates"]) {
  return [
    "| Gate | Status | Detail |",
    "|---|---|---|",
    ...gates.map((gateRow) => `| ${gateRow.name} | ${gateRow.passed ? "PASS" : "FAIL"} | ${gateRow.detail} |`),
  ].join("\n");
}

function compareStaleLegacy(a: ProjectionUniverseEligibilityRow, b: ProjectionUniverseEligibilityRow) {
  return (a.lastActiveSeason ?? 9999) - (b.lastActiveSeason ?? 9999)
    || Math.abs(b.projectedTotalPointDelta ?? 0) - Math.abs(a.projectedTotalPointDelta ?? 0)
    || a.player.localeCompare(b.player);
}

function countBy(values: string[]) {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
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
