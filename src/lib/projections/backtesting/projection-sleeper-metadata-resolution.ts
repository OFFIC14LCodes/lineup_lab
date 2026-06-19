import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { SleeperPlayerMetadataReport, SleeperPlayerMetadataRow } from "@/lib/data-acquisition/sleeper-player-metadata-source-types";

import type { ProjectionActiveUniversePolicyClassification } from "./projection-active-universe-policy-packet-types";
import type { ProjectionActiveUniverseGateRosterRefreshReport } from "./projection-active-universe-gate-roster-refresh-types";
import type { ProjectionCrosswalkUnmatchedReport, ProjectionCrosswalkUnmatchedRow } from "./projection-crosswalk-unmatched-classification-types";
import type {
  ProjectionSleeperMetadataResolutionArtifactPaths,
  ProjectionSleeperMetadataResolutionInput,
  ProjectionSleeperMetadataResolutionReasonCode,
  ProjectionSleeperMetadataResolutionRecommendation,
  ProjectionSleeperMetadataResolutionReport,
  ProjectionSleeperMetadataResolutionRow,
  ProjectionSleeperMetadataResolutionStatus,
} from "./projection-sleeper-metadata-resolution-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const SLEEPER_OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "sleeper");
const STATUSES: ProjectionSleeperMetadataResolutionStatus[] = [
  "sleeper_metadata_active_plausible",
  "sleeper_metadata_inactive_or_stale",
  "sleeper_metadata_free_agent_or_unknown",
  "sleeper_metadata_position_conflict",
  "sleeper_metadata_team_conflict",
  "sleeper_metadata_missing",
  "sleeper_metadata_manual_review",
];
const POLICY_CLASSIFICATIONS: ProjectionActiveUniversePolicyClassification[] = [
  "policy_active_candidate",
  "policy_shadow_only",
  "policy_blocked_archive",
  "policy_manual_review",
  "policy_source_expansion_required",
  "policy_kicker_review_required",
  "policy_current_path_only",
];

export function runProjectionSleeperMetadataResolution(options: { projectionSeason: number; includeIdp: boolean }): ProjectionSleeperMetadataResolutionReport {
  const sourceArtifacts = {
    crosswalkUnmatchedClassification: path.join(OUTPUT_DIR, `projection-crosswalk-unmatched-classification-${options.projectionSeason}.json`),
    sleeperPlayerMetadataSource: path.join(SLEEPER_OUTPUT_DIR, `sleeper-player-metadata-${options.projectionSeason}.normalized.json`),
    rosterRefresh: path.join(OUTPUT_DIR, `projection-active-universe-gate-roster-refresh-${options.projectionSeason}.json`),
  };
  const sleeperSource = readIfExists<SleeperPlayerMetadataReport>(sourceArtifacts.sleeperPlayerMetadataSource);
  return buildProjectionSleeperMetadataResolutionFromData({
    options,
    crosswalkUnmatchedClassification: readIfExists<ProjectionCrosswalkUnmatchedReport>(sourceArtifacts.crosswalkUnmatchedClassification),
    sleeperPlayerMetadataSource: sleeperSource,
    rosterRefresh: readIfExists<ProjectionActiveUniverseGateRosterRefreshReport>(sourceArtifacts.rosterRefresh),
    sourceArtifacts: {
      crosswalkUnmatchedClassification: sourceArtifacts.crosswalkUnmatchedClassification,
      sleeperPlayerMetadataSource: sleeperSource ? sourceArtifacts.sleeperPlayerMetadataSource : null,
      rosterRefresh: sourceArtifacts.rosterRefresh,
    },
  });
}

export function buildProjectionSleeperMetadataResolutionFromData(input: ProjectionSleeperMetadataResolutionInput): ProjectionSleeperMetadataResolutionReport {
  if (!input.crosswalkUnmatchedClassification || !input.rosterRefresh) return sourceMissingReport(input);
  const metadataBySleeperId = mapFirst((input.sleeperPlayerMetadataSource?.rows ?? []).map((row) => [row.sleeperId, row] as const));
  const targetRows = input.crosswalkUnmatchedClassification.rows.filter((row) => row.classification === "needs_sleeper_status_source");
  const rows = targetRows.map((row) => resolutionRow(row, metadataBySleeperId.get(row.sleeperId ?? "") ?? null));
  const summary = buildSummary(rows, input.sleeperPlayerMetadataSource?.normalizedRows ?? 0);
  const zeroChecks = zeroChecksFor(input.rosterRefresh);
  const safetyGates = buildSafetyGates(rows, zeroChecks);
  const safeRows = rows.filter((row) => row.v82SafeSubsetStatus === "v82_safe_subset");
  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? sourceArtifactsFor(input),
    sourceMissing: !input.sleeperPlayerMetadataSource,
    summary,
    policyPreview: {
      wouldMoveTo: countByFixed(rows, POLICY_CLASSIFICATIONS, (row) => row.policyPreview),
      notes: [
        "Sleeper metadata resolution is preview-only and does not update H21 behavior.",
        "Only exact Sleeper ID matches are used.",
      ],
    },
    v82Impact: {
      safeRowsResolvedBySleeperMetadata: safeRows.filter((row) => row.policyPreview === "policy_active_candidate" || row.policyPreview === "policy_current_path_only").length,
      safeRowsStillHeldBack: safeRows.filter((row) => row.policyPreview !== "policy_active_candidate").length,
      safeRowsMovedToActiveCandidatePreview: safeRows.filter((row) => row.policyPreview === "policy_active_candidate").length,
      protectedZeroChecks: zeroChecks,
      unblocksControlledFlagReview: safeRows.every((row) => row.policyPreview === "policy_active_candidate") && Object.values(zeroChecks).every(Boolean),
    },
    examples: {
      topActivePlausibleRows: topRows(rows.filter((row) => row.resolutionStatus === "sleeper_metadata_active_plausible"), 50),
      topInactiveStaleRows: topRows(rows.filter((row) => row.resolutionStatus === "sleeper_metadata_inactive_or_stale"), 50),
      topMissingMetadataRows: topRows(rows.filter((row) => row.resolutionStatus === "sleeper_metadata_missing"), 50),
      topPositionTeamConflicts: topRows(rows.filter((row) => row.resolutionStatus === "sleeper_metadata_position_conflict" || row.resolutionStatus === "sleeper_metadata_team_conflict"), 50),
      topV82SafeRowsStillHeldBack: topRows(safeRows.filter((row) => row.policyPreview !== "policy_active_candidate"), 50),
    },
    rows,
    safetyGates,
    recommendation: recommendationFor(safetyGates, rows),
    notes: [
      "H27 is dry-run/read-only Sleeper metadata resolution only.",
      "No fuzzy matching is used as confirmed identity.",
      "No live projection, rank, suggestion, War Room scoring, Supabase, or v8.2 behavior is changed.",
    ],
  };
}

export function writeProjectionSleeperMetadataResolutionArtifacts(report: ProjectionSleeperMetadataResolutionReport): ProjectionSleeperMetadataResolutionArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-sleeper-metadata-resolution-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function resolutionRow(row: ProjectionCrosswalkUnmatchedRow, sourceRow: SleeperPlayerMetadataRow | null): ProjectionSleeperMetadataResolutionRow {
  const reasonCodes = reasonCodesFor(row, sourceRow);
  const resolutionStatus = statusFor(row, sourceRow, reasonCodes);
  return {
    playerId: row.playerId,
    sleeperId: row.sleeperId,
    crosswalkGsisId: row.crosswalkGsisId,
    player: row.player,
    position: row.position,
    projectionTeam: row.projectionTeam,
    metadataTeam: sourceRow?.team ?? null,
    metadataPosition: sourceRow?.position ?? null,
    metadataStatus: sourceRow?.normalizedStatus ?? null,
    metadataActive: sourceRow?.active ?? null,
    resolutionStatus,
    reasonCodes,
    policyPreview: policyFor(resolutionStatus),
    v82SafeSubsetStatus: row.v82SafeSubsetStatus,
    sourceRow,
    h26Row: row,
    projectedTotalPointDelta: row.projectedTotalPointDelta,
    estimatedOverallRankMovement: row.estimatedOverallRankMovement,
  };
}

function reasonCodesFor(row: ProjectionCrosswalkUnmatchedRow, sourceRow: SleeperPlayerMetadataRow | null): ProjectionSleeperMetadataResolutionReasonCode[] {
  const codes = new Set<ProjectionSleeperMetadataResolutionReasonCode>(["crosswalk_confirmed_gsis", "not_in_current_roster_source", "not_in_rookie_source"]);
  if (!sourceRow) {
    codes.add("missing_sleeper_metadata");
    return [...codes];
  }
  codes.add("exact_sleeper_id_match");
  codes.add(sourceRow.active ? "sleeper_active_true" : "sleeper_active_false");
  codes.add(sourceRow.team ? "sleeper_team_present" : "sleeper_team_missing");
  if (positionCompatible(row.position, sourceRow)) codes.add("sleeper_position_matches");
  else codes.add("sleeper_position_conflicts");
  if (!sourceRow.active || ["inactive", "retired"].includes(sourceRow.normalizedStatus)) codes.add("sleeper_status_inactive");
  if (!sourceRow.normalizedStatus || sourceRow.normalizedStatus === "unknown") codes.add("sleeper_status_unknown");
  if (sourceRow.searchRank !== null) codes.add("sleeper_search_rank_available");
  return [...codes];
}

function statusFor(row: ProjectionCrosswalkUnmatchedRow, sourceRow: SleeperPlayerMetadataRow | null, codes: ProjectionSleeperMetadataResolutionReasonCode[]): ProjectionSleeperMetadataResolutionStatus {
  if (!sourceRow) return "sleeper_metadata_missing";
  if (codes.includes("sleeper_position_conflicts")) return "sleeper_metadata_position_conflict";
  if (teamConflict(row.projectionTeam, sourceRow.team)) return "sleeper_metadata_team_conflict";
  if (!sourceRow.active || codes.includes("sleeper_status_inactive")) return "sleeper_metadata_inactive_or_stale";
  if (!sourceRow.team || sourceRow.team === "FA" || sourceRow.normalizedStatus === "unknown") return "sleeper_metadata_free_agent_or_unknown";
  if (sourceRow.active && sourceRow.team && codes.includes("sleeper_position_matches")) return "sleeper_metadata_active_plausible";
  return "sleeper_metadata_manual_review";
}

function policyFor(status: ProjectionSleeperMetadataResolutionStatus): ProjectionActiveUniversePolicyClassification {
  if (status === "sleeper_metadata_active_plausible") return "policy_active_candidate";
  if (status === "sleeper_metadata_inactive_or_stale") return "policy_shadow_only";
  if (status === "sleeper_metadata_position_conflict" || status === "sleeper_metadata_team_conflict" || status === "sleeper_metadata_manual_review") return "policy_manual_review";
  if (status === "sleeper_metadata_free_agent_or_unknown") return "policy_source_expansion_required";
  return "policy_source_expansion_required";
}

function buildSummary(rows: ProjectionSleeperMetadataResolutionRow[], metadataSourceRows: number): ProjectionSleeperMetadataResolutionReport["summary"] {
  return {
    targetRows: rows.length,
    metadataSourceRows,
    matchedBySleeperId: rows.filter((row) => row.sourceRow).length,
    missingMetadata: rows.filter((row) => row.resolutionStatus === "sleeper_metadata_missing").length,
    activePlausible: rows.filter((row) => row.resolutionStatus === "sleeper_metadata_active_plausible").length,
    inactiveOrStale: rows.filter((row) => row.resolutionStatus === "sleeper_metadata_inactive_or_stale").length,
    freeAgentOrUnknown: rows.filter((row) => row.resolutionStatus === "sleeper_metadata_free_agent_or_unknown").length,
    positionConflicts: rows.filter((row) => row.resolutionStatus === "sleeper_metadata_position_conflict").length,
    teamConflicts: rows.filter((row) => row.resolutionStatus === "sleeper_metadata_team_conflict").length,
    manualReview: rows.filter((row) => row.resolutionStatus === "sleeper_metadata_manual_review").length,
    byPosition: countBy(rows, (row) => row.position),
    byTeam: countBy(rows, (row) => row.projectionTeam ?? "missing_team"),
    byV82SafeSubset: countBy(rows, (row) => row.v82SafeSubsetStatus),
    byStatus: countByFixed(rows, STATUSES, (row) => row.resolutionStatus),
  };
}

function sourceMissingReport(input: ProjectionSleeperMetadataResolutionInput): ProjectionSleeperMetadataResolutionReport {
  const zeroChecks = zeroChecksFor(input.rosterRefresh);
  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? sourceArtifactsFor(input),
    sourceMissing: true,
    summary: { targetRows: 0, metadataSourceRows: 0, matchedBySleeperId: 0, missingMetadata: 0, activePlausible: 0, inactiveOrStale: 0, freeAgentOrUnknown: 0, positionConflicts: 0, teamConflicts: 0, manualReview: 0, byPosition: {}, byTeam: {}, byV82SafeSubset: {}, byStatus: Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<ProjectionSleeperMetadataResolutionStatus, number> },
    policyPreview: { wouldMoveTo: Object.fromEntries(POLICY_CLASSIFICATIONS.map((policy) => [policy, 0])) as Record<ProjectionActiveUniversePolicyClassification, number>, notes: ["Required source artifacts are missing."] },
    v82Impact: { safeRowsResolvedBySleeperMetadata: 0, safeRowsStillHeldBack: 0, safeRowsMovedToActiveCandidatePreview: 0, protectedZeroChecks: zeroChecks, unblocksControlledFlagReview: false },
    examples: { topActivePlausibleRows: [], topInactiveStaleRows: [], topMissingMetadataRows: [], topPositionTeamConflicts: [], topV82SafeRowsStillHeldBack: [] },
    rows: [],
    safetyGates: [gate("required_sources_present", false, "H26 classification and roster refresh artifacts are required.")],
    recommendation: "sleeper_metadata_resolution_blocked",
    notes: ["H27 did not mutate live outputs."],
  };
}

function buildSafetyGates(rows: ProjectionSleeperMetadataResolutionRow[], zeroChecks: ProjectionSleeperMetadataResolutionReport["v82Impact"]["protectedZeroChecks"]) {
  return [
    gate("no_live_outputs_changed", true, "Report reads artifacts and writes only local H27 artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Blackbird Rank ordering is not imported, recalculated, or mutated."),
    gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported, recalculated, or mutated."),
    gate("war_room_scoring_unchanged", true, "War Room scoring behavior is not imported, recalculated, or mutated."),
    gate("v8_2_not_enabled", true, "v8.2 feature flag and projection selector behavior are not changed."),
    gate("only_exact_sleeper_id_join", rows.every((row) => !row.sourceRow || row.sourceRow.sleeperId === row.sleeperId), "Metadata joins use exact Sleeper IDs only."),
    gate("v8_2_zero_checks_preserved", Object.values(zeroChecks).every(Boolean), "K, critical mover, meaningful rank mover, and legacy v8.2 zero checks remain zero."),
  ];
}

function recommendationFor(safetyGates: ProjectionSleeperMetadataResolutionReport["safetyGates"], rows: ProjectionSleeperMetadataResolutionRow[]): ProjectionSleeperMetadataResolutionRecommendation {
  if (safetyGates.some((gateRow) => !gateRow.passed)) return "sleeper_metadata_resolution_blocked";
  if (rows.some((row) => row.resolutionStatus === "sleeper_metadata_position_conflict" || row.resolutionStatus === "sleeper_metadata_team_conflict" || row.resolutionStatus === "sleeper_metadata_manual_review")) return "sleeper_metadata_resolution_needs_review";
  return "sleeper_metadata_resolution_ready_for_policy_preview";
}

function positionCompatible(position: string, row: SleeperPlayerMetadataRow) {
  return row.position === position || row.fantasyPositions.includes(position);
}

function teamConflict(projectionTeam: string | null, metadataTeam: string | null) {
  return Boolean(projectionTeam && metadataTeam && metadataTeam !== "FA" && projectionTeam !== metadataTeam);
}

function zeroChecksFor(rosterRefresh: ProjectionActiveUniverseGateRosterRefreshReport | null) {
  const packet = rosterRefresh?.v82SafeSubsetCrossReference.packetSummary;
  return {
    kRowsUsingV82: (packet?.kRowsUsingV82 ?? 0) === 0,
    criticalMoversUsingV82: (packet?.criticalMoversUsingV82 ?? 0) === 0,
    meaningfulRankMoversUsingV82: (packet?.meaningfulRankMoversUsingV82 ?? 0) === 0,
    legacyRowsUsingV82: (packet?.legacyRowsUsingV82 ?? 0) === 0,
  };
}

function sourceArtifactsFor(input: ProjectionSleeperMetadataResolutionInput): ProjectionSleeperMetadataResolutionReport["sourceArtifacts"] {
  return {
    crosswalkUnmatchedClassification: input.crosswalkUnmatchedClassification ? "in-memory" : "missing",
    sleeperPlayerMetadataSource: input.sleeperPlayerMetadataSource ? "in-memory" : null,
    rosterRefresh: input.rosterRefresh ? "in-memory" : "missing",
  };
}

function renderMarkdown(report: ProjectionSleeperMetadataResolutionReport) {
  return `# Projection Sleeper Metadata Resolution ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Recommendation: ${report.recommendation}

## Summary

\`\`\`json
${JSON.stringify(report.summary, null, 2)}
\`\`\`

## Policy Preview

\`\`\`json
${JSON.stringify(report.policyPreview, null, 2)}
\`\`\`

## v8.2 Impact

\`\`\`json
${JSON.stringify(report.v82Impact, null, 2)}
\`\`\`

## Active Plausible

${renderRows(report.examples.topActivePlausibleRows)}

## Inactive / Stale

${renderRows(report.examples.topInactiveStaleRows)}

## Missing Metadata

${renderRows(report.examples.topMissingMetadataRows)}

## Conflicts

${renderRows(report.examples.topPositionTeamConflicts)}

## v8.2 Safe Still Held Back

${renderRows(report.examples.topV82SafeRowsStillHeldBack)}

## Safety Gates

${renderGateTable(report.safetyGates)}
`;
}

function renderRows(rows: ProjectionSleeperMetadataResolutionRow[]) {
  if (!rows.length) return "No rows.";
  return [
    "| Player | Pos | Projection Team | Metadata Team | Status | Policy Preview | Reasons |",
    "|---|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.projectionTeam ?? ""} | ${row.metadataTeam ?? ""} | ${row.resolutionStatus} | ${row.policyPreview} | ${row.reasonCodes.slice(0, 4).join(" ")} |`),
  ].join("\n");
}

function renderGateTable(gates: ProjectionSleeperMetadataResolutionReport["safetyGates"]) {
  return [
    "| Gate | Status | Detail |",
    "|---|---|---|",
    ...gates.map((gateRow) => `| ${gateRow.name} | ${gateRow.passed ? "PASS" : "FAIL"} | ${gateRow.detail} |`),
  ].join("\n");
}

function renderCsv(report: ProjectionSleeperMetadataResolutionReport) {
  const headers = ["player_id", "sleeper_id", "gsis_id", "player", "position", "projection_team", "metadata_team", "metadata_position", "metadata_status", "metadata_active", "resolution_status", "policy_preview", "v82_safe_subset", "reason_codes"];
  const rows = report.rows.map((row) => [
    row.playerId,
    row.sleeperId ?? "",
    row.crosswalkGsisId ?? "",
    row.player,
    row.position,
    row.projectionTeam ?? "",
    row.metadataTeam ?? "",
    row.metadataPosition ?? "",
    row.metadataStatus ?? "",
    row.metadataActive ?? "",
    row.resolutionStatus,
    row.policyPreview,
    row.v82SafeSubsetStatus,
    row.reasonCodes.join("|"),
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function topRows(rows: ProjectionSleeperMetadataResolutionRow[], limit: number) {
  return [...rows].sort((a, b) =>
    Math.abs(b.projectedTotalPointDelta ?? 0) - Math.abs(a.projectedTotalPointDelta ?? 0)
    || Math.abs(b.estimatedOverallRankMovement ?? 0) - Math.abs(a.estimatedOverallRankMovement ?? 0)
    || a.player.localeCompare(b.player)
  ).slice(0, limit);
}

function countBy<T>(rows: T[], keyFor: (row: T) => string) {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[keyFor(row)] = (counts[keyFor(row)] ?? 0) + 1;
  return counts;
}

function countByFixed<T, Key extends string>(rows: T[], keys: Key[], keyFor: (row: T) => Key) {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<Key, number>;
  for (const row of rows) counts[keyFor(row)] += 1;
  return counts;
}

function mapFirst<T>(entries: Array<readonly [string, T]>) {
  const mapped = new Map<string, T>();
  for (const [key, value] of entries) if (!mapped.has(key)) mapped.set(key, value);
  return mapped;
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function readIfExists<T>(artifactPath: string): T | null {
  return existsSync(artifactPath) ? readJson<T>(artifactPath) : null;
}

function readJson<T>(artifactPath: string): T {
  return JSON.parse(readFileSync(artifactPath, "utf8")) as T;
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
