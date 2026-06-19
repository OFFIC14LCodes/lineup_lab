import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { CurrentRosterSourceReport, CurrentRosterSourceRow } from "@/lib/data-acquisition/current-roster-source-types";
import type { PlayerIdCrosswalkConfidence, PlayerIdCrosswalkSourceReport } from "@/lib/data-acquisition/player-id-crosswalk-source-types";
import type { RookieTeamConfirmationSourceReport, RookieTeamConfirmationSourceRow } from "@/lib/data-acquisition/rookie-team-confirmation-source-types";
import { loadSleeperPlayers, SLEEPER_PLAYERS_PATH } from "@/lib/data-acquisition/sleeper/sleeper-player-loader";
import { normalizeSleeperPlayers } from "@/lib/data-acquisition/sleeper/sleeper-player-normalizer";

import type { ProjectionRookieNewTargetDiagnosticsReport } from "./projection-rookie-new-target-diagnostics-types";
import type {
  ProjectionPlayerIdCrosswalkArtifactPaths,
  ProjectionPlayerIdCrosswalkEvidence,
  ProjectionPlayerIdCrosswalkIntegrationPreview,
  ProjectionPlayerIdCrosswalkRecommendation,
  ProjectionPlayerIdCrosswalkReviewInput,
  ProjectionPlayerIdCrosswalkReviewReport,
  ProjectionPlayerIdCrosswalkReviewRow,
  ProjectionPlayerIdCrosswalkStatus,
  ProjectionPlayerIdCrosswalkTargetRow,
} from "./projection-player-id-crosswalk-review-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const CROSSWALK_OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "player-crosswalk");
const CURRENT_ROSTER_OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "current-rosters");
const ROOKIE_OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "rookies");
const STATUSES: ProjectionPlayerIdCrosswalkStatus[] = ["crosswalk_confirmed", "crosswalk_conflict", "crosswalk_missing", "crosswalk_ambiguous", "crosswalk_review_candidate", "source_missing"];
const PREVIEWS: ProjectionPlayerIdCrosswalkIntegrationPreview[] = ["use_current_roster_source", "use_rookie_team_confirmation_source", "manual_review", "still_needs_crosswalk"];

export function runProjectionPlayerIdCrosswalkReview(options: { projectionSeason: number; includeIdp: boolean }): ProjectionPlayerIdCrosswalkReviewReport {
  const sourceArtifacts = {
    rookieNewTargetDiagnostics: path.join(OUTPUT_DIR, `projection-rookie-new-target-diagnostics-${options.projectionSeason}.json`),
    playerIdCrosswalkSource: path.join(CROSSWALK_OUTPUT_DIR, `sleeper-nflverse-crosswalk-${options.projectionSeason}.normalized.json`),
    sleeperPlayers: SLEEPER_PLAYERS_PATH,
    currentRosterSource: path.join(CURRENT_ROSTER_OUTPUT_DIR, `current-rosters-${options.projectionSeason}.normalized.json`),
    rookieTeamConfirmationSource: path.join(ROOKIE_OUTPUT_DIR, `rookie-team-confirmation-${options.projectionSeason}.normalized.json`),
  };
  const sleeperLoad = loadSleeperPlayers();
  return buildProjectionPlayerIdCrosswalkReviewFromData({
    options,
    rookieNewTargetDiagnostics: existsSync(sourceArtifacts.rookieNewTargetDiagnostics) ? readJson<ProjectionRookieNewTargetDiagnosticsReport>(sourceArtifacts.rookieNewTargetDiagnostics) : null,
    playerIdCrosswalkSource: existsSync(sourceArtifacts.playerIdCrosswalkSource) ? readJson<PlayerIdCrosswalkSourceReport>(sourceArtifacts.playerIdCrosswalkSource) : null,
    sleeperPlayers: sleeperLoad.exists ? normalizeSleeperPlayers(sleeperLoad.players) : [],
    currentRosterSource: existsSync(sourceArtifacts.currentRosterSource) ? readJson<CurrentRosterSourceReport>(sourceArtifacts.currentRosterSource) : null,
    rookieTeamConfirmationSource: existsSync(sourceArtifacts.rookieTeamConfirmationSource) ? readJson<RookieTeamConfirmationSourceReport>(sourceArtifacts.rookieTeamConfirmationSource) : null,
    sourceArtifacts: {
      rookieNewTargetDiagnostics: sourceArtifacts.rookieNewTargetDiagnostics,
      playerIdCrosswalkSource: existsSync(sourceArtifacts.playerIdCrosswalkSource) ? sourceArtifacts.playerIdCrosswalkSource : null,
      sleeperPlayers: sleeperLoad.exists ? sourceArtifacts.sleeperPlayers : null,
      currentRosterSource: existsSync(sourceArtifacts.currentRosterSource) ? sourceArtifacts.currentRosterSource : null,
      rookieTeamConfirmationSource: existsSync(sourceArtifacts.rookieTeamConfirmationSource) ? sourceArtifacts.rookieTeamConfirmationSource : null,
    },
  });
}

export function buildProjectionPlayerIdCrosswalkReviewFromData(input: ProjectionPlayerIdCrosswalkReviewInput): ProjectionPlayerIdCrosswalkReviewReport {
  if (!input.rookieNewTargetDiagnostics) return sourceMissingReport(input);
  const targetRows = input.rookieNewTargetDiagnostics.rows.filter((row) => row.recommendedSourceStrategy === "needs_id_crosswalk");
  const lookups = buildLookups(input);
  const rows = targetRows.map((row) => buildReviewRow(row, lookups));
  const summary = {
    targetRows: rows.length,
    confirmedRows: rows.filter((row) => row.status === "crosswalk_confirmed").length,
    conflictRows: rows.filter((row) => row.status === "crosswalk_conflict").length,
    ambiguousRows: rows.filter((row) => row.status === "crosswalk_ambiguous").length,
    reviewCandidateRows: rows.filter((row) => row.status === "crosswalk_review_candidate").length,
    missingRows: rows.filter((row) => row.status === "crosswalk_missing").length,
    byStatus: countByFixed(rows, STATUSES, (row) => row.status),
    byIntegrationPreview: countByFixed(rows, PREVIEWS, (row) => row.integrationPreview),
  };
  const safetyGates = buildSafetyGates(input, rows);
  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? sourceArtifactsFor(input),
    sourceMissing: false,
    summary,
    sourceCoverage: {
      sleeperMetadataRows: input.sleeperPlayers.length,
      sleeperMetadataRowsWithGsis: input.sleeperPlayers.filter((player) => player.externalIds.gsis_id).length,
      csvCrosswalkRows: input.playerIdCrosswalkSource?.rows.length ?? 0,
      csvConfirmedRows: input.playerIdCrosswalkSource?.rows.filter((row) => row.gsisId && ["exact_id", "source_declared"].includes(row.confidence)).length ?? 0,
      snapshotBridgeRows: rows.filter((row) => row.reasonCodes.includes("snapshot_sleeper_gsis_bridge")).length,
      targetRowsWithSleeperId: targetRows.filter((row) => row.sleeperId).length,
      targetRowsWithSnapshotGsis: targetRows.filter((row) => row.gsisId).length,
    },
    h21IntegrationPreview: {
      wouldRouteTo: summary.byIntegrationPreview,
      notes: [
        "Preview routing is evidence only and does not update H21 policy packets.",
        "Confirmed crosswalk rows can be linked to current roster or rookie source artifacts by exact GSIS ID in a future dry-run.",
      ],
    },
    examples: {
      confirmedRows: topRows(rows.filter((row) => row.status === "crosswalk_confirmed"), 50),
      conflictRows: topRows(rows.filter((row) => row.status === "crosswalk_conflict"), 50),
      ambiguousRows: topRows(rows.filter((row) => row.status === "crosswalk_ambiguous"), 50),
      reviewCandidateRows: topRows(rows.filter((row) => row.status === "crosswalk_review_candidate"), 50),
      missingRows: topRows(rows.filter((row) => row.status === "crosswalk_missing"), 50),
    },
    rows,
    safetyGates,
    recommendation: recommendationFor(safetyGates, rows),
    notes: [
      "H24 is dry-run/read-only identity review only.",
      "Exact Sleeper metadata, exact source-declared CSV rows, and exact snapshot Sleeper/GSIS bridges can confirm identity.",
      "Name/team/position evidence is retained as review evidence and is not treated as a confirmed identity bridge.",
      "No live projections, rank, suggestions, War Room scoring, Supabase tables, or v8.2 selection are mutated.",
    ],
  };
}

export function writeProjectionPlayerIdCrosswalkReviewArtifacts(report: ProjectionPlayerIdCrosswalkReviewReport): ProjectionPlayerIdCrosswalkArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-player-id-crosswalk-review-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function buildLookups(input: ProjectionPlayerIdCrosswalkReviewInput) {
  return {
    csvBySleeperId: groupBy(input.playerIdCrosswalkSource?.rows ?? [], (row) => row.sleeperId),
    sleeperBySleeperId: mapFirst(input.sleeperPlayers.map((player) => [player.sleeperId, player] as const)),
    currentByGsisId: mapFirst((input.currentRosterSource?.rows ?? []).filter((row) => row.gsisId).map((row) => [row.gsisId ?? "", row] as const)),
    rookieByGsisId: mapFirst((input.rookieTeamConfirmationSource?.rows ?? []).filter((row) => row.gsisId).map((row) => [row.gsisId ?? "", row] as const)),
  };
}

function buildReviewRow(target: ProjectionPlayerIdCrosswalkTargetRow, lookups: ReturnType<typeof buildLookups>): ProjectionPlayerIdCrosswalkReviewRow {
  const evidence = evidenceFor(target, lookups);
  const exactEvidence = evidence.filter((item) => item.confirmed && item.gsisId);
  const exactGsisIds = [...new Set(exactEvidence.map((item) => item.gsisId ?? ""))];
  const reviewEvidence = evidence.filter((item) => !item.confirmed);
  const status = statusFor(exactGsisIds, exactEvidence, reviewEvidence);
  const crosswalkGsisId = status === "crosswalk_confirmed" ? exactGsisIds[0] : null;
  const current = crosswalkGsisId ? lookups.currentByGsisId.get(crosswalkGsisId) ?? null : null;
  const rookie = crosswalkGsisId ? lookups.rookieByGsisId.get(crosswalkGsisId) ?? null : null;
  const integrationPreview = integrationPreviewFor(status, current, rookie);
  return {
    playerId: target.playerId,
    sleeperId: target.sleeperId,
    originalGsisId: target.gsisId,
    crosswalkGsisId,
    player: target.player,
    normalizedName: target.normalizedName,
    position: target.position,
    team: target.team,
    h23SourceStrategy: target.recommendedSourceStrategy,
    v82SafeSubsetStatus: target.v82SafeSubsetStatus,
    status,
    confidence: confidenceFor(status, exactEvidence, reviewEvidence),
    evidenceSources: [...new Set(evidence.map((item) => item.source))],
    reasonCodes: reasonCodesFor(status, evidence, current, rookie),
    linkedCurrentRosterRow: current,
    linkedRookieTeamRow: rookie,
    integrationPreview,
    projectedTotalPointDelta: target.projectedTotalPointDelta,
    estimatedOverallRankMovement: target.estimatedOverallRankMovement,
  };
}

function evidenceFor(target: ProjectionPlayerIdCrosswalkTargetRow, lookups: ReturnType<typeof buildLookups>): ProjectionPlayerIdCrosswalkEvidence[] {
  const evidence: ProjectionPlayerIdCrosswalkEvidence[] = [];
  const sleeperId = target.sleeperId ?? target.playerId;
  const sleeperPlayer = lookups.sleeperBySleeperId.get(sleeperId);
  if (sleeperPlayer?.externalIds.gsis_id) {
    evidence.push(evidenceRow("sleeper_metadata", sleeperId, sleeperPlayer.externalIds.gsis_id, sleeperPlayer.sleeperId, sleeperPlayer.playerName, sleeperPlayer.position, sleeperPlayer.team, "exact_id", true, "Sleeper metadata includes GSIS ID."));
  }
  if (target.sleeperId && target.gsisId) {
    evidence.push(evidenceRow("snapshot", target.sleeperId, target.gsisId, target.playerId, target.player, target.position, target.team, "exact_id", true, "H23 snapshot row already contains both Sleeper and GSIS IDs."));
  }
  for (const row of lookups.csvBySleeperId.get(sleeperId) ?? []) {
    const confirmed = Boolean(row.gsisId && (row.confidence === "exact_id" || row.confidence === "source_declared"));
    evidence.push(evidenceRow("csv_crosswalk", row.sleeperId, row.gsisId, row.playerId, row.playerName, row.position, row.team, row.confidence, confirmed, confirmed ? "CSV row is source-declared exact ID evidence." : "CSV row is review evidence only."));
  }
  if (!evidence.length && target.sourceRowMatchCandidates.currentRoster.concat(target.sourceRowMatchCandidates.rookieTeam).some((candidate) => candidate.matchKind === "name_position_team")) {
    evidence.push(evidenceRow("name_team_position", sleeperId, null, target.playerId, target.player, target.position, target.team, "name_team_position", false, "Name/team/position overlap requires manual review."));
  }
  return evidence;
}

function evidenceRow(source: ProjectionPlayerIdCrosswalkEvidence["source"], sleeperId: string, gsisId: string | null, playerId: string | null, playerName: string | null, position: string | null, team: string | null, confidence: PlayerIdCrosswalkConfidence, confirmed: boolean, detail: string): ProjectionPlayerIdCrosswalkEvidence {
  return { source, sleeperId, gsisId, playerId, playerName, position, team, confidence, confirmed, detail };
}

function statusFor(exactGsisIds: string[], exactEvidence: ProjectionPlayerIdCrosswalkEvidence[], reviewEvidence: ProjectionPlayerIdCrosswalkEvidence[]): ProjectionPlayerIdCrosswalkStatus {
  if (exactGsisIds.length > 1) return "crosswalk_conflict";
  if (exactGsisIds.length === 1 && exactEvidence.length > 1 && exactEvidence.some((item) => item.source === "csv_crosswalk") && exactEvidence.some((item) => item.source !== "csv_crosswalk")) return "crosswalk_confirmed";
  if (exactGsisIds.length === 1) return "crosswalk_confirmed";
  if (reviewEvidence.length > 1) return "crosswalk_ambiguous";
  if (reviewEvidence.length === 1) return "crosswalk_review_candidate";
  return "crosswalk_missing";
}

function confidenceFor(status: ProjectionPlayerIdCrosswalkStatus, exactEvidence: ProjectionPlayerIdCrosswalkEvidence[], reviewEvidence: ProjectionPlayerIdCrosswalkEvidence[]): PlayerIdCrosswalkConfidence {
  if (status === "crosswalk_confirmed") return exactEvidence.some((item) => item.confidence === "source_declared") ? "source_declared" : "exact_id";
  if (reviewEvidence.some((item) => item.confidence === "name_team_position")) return "name_team_position";
  if (reviewEvidence.some((item) => item.confidence === "manual_review")) return "manual_review";
  return "unknown";
}

function integrationPreviewFor(status: ProjectionPlayerIdCrosswalkStatus, current: CurrentRosterSourceRow | null, rookie: RookieTeamConfirmationSourceRow | null): ProjectionPlayerIdCrosswalkIntegrationPreview {
  if (status === "crosswalk_confirmed" && current) return "use_current_roster_source";
  if (status === "crosswalk_confirmed" && rookie) return "use_rookie_team_confirmation_source";
  if (status === "crosswalk_confirmed") return "manual_review";
  if (status === "crosswalk_missing" || status === "source_missing") return "still_needs_crosswalk";
  return "manual_review";
}

function reasonCodesFor(status: ProjectionPlayerIdCrosswalkStatus, evidence: ProjectionPlayerIdCrosswalkEvidence[], current: CurrentRosterSourceRow | null, rookie: RookieTeamConfirmationSourceRow | null) {
  const codes = new Set<string>([status]);
  for (const item of evidence) {
    if (item.source === "snapshot" && item.confirmed) codes.add("snapshot_sleeper_gsis_bridge");
    if (item.source === "sleeper_metadata" && item.confirmed) codes.add("sleeper_metadata_gsis_bridge");
    if (item.source === "csv_crosswalk" && item.confirmed) codes.add("csv_source_declared_bridge");
    if (!item.confirmed) codes.add(`${item.source}_review_only`);
  }
  if (current) codes.add("current_roster_gsis_link_found");
  if (rookie) codes.add("rookie_source_gsis_link_found");
  if (status === "crosswalk_confirmed" && !current && !rookie) codes.add("confirmed_crosswalk_no_roster_or_rookie_source_link");
  if (!evidence.length) codes.add("no_crosswalk_evidence_found");
  return [...codes];
}

function sourceMissingReport(input: ProjectionPlayerIdCrosswalkReviewInput): ProjectionPlayerIdCrosswalkReviewReport {
  const summary = {
    targetRows: 0,
    confirmedRows: 0,
    conflictRows: 0,
    ambiguousRows: 0,
    reviewCandidateRows: 0,
    missingRows: 0,
    byStatus: Object.fromEntries(STATUSES.map((status) => [status, status === "source_missing" ? 1 : 0])) as Record<ProjectionPlayerIdCrosswalkStatus, number>,
    byIntegrationPreview: Object.fromEntries(PREVIEWS.map((preview) => [preview, preview === "still_needs_crosswalk" ? 1 : 0])) as Record<ProjectionPlayerIdCrosswalkIntegrationPreview, number>,
  };
  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? sourceArtifactsFor(input),
    sourceMissing: true,
    summary,
    sourceCoverage: {
      sleeperMetadataRows: input.sleeperPlayers.length,
      sleeperMetadataRowsWithGsis: input.sleeperPlayers.filter((player) => player.externalIds.gsis_id).length,
      csvCrosswalkRows: input.playerIdCrosswalkSource?.rows.length ?? 0,
      csvConfirmedRows: 0,
      snapshotBridgeRows: 0,
      targetRowsWithSleeperId: 0,
      targetRowsWithSnapshotGsis: 0,
    },
    h21IntegrationPreview: { wouldRouteTo: summary.byIntegrationPreview, notes: ["H23 rookie/new target diagnostics are required before H24 review can classify rows."] },
    examples: { confirmedRows: [], conflictRows: [], ambiguousRows: [], reviewCandidateRows: [], missingRows: [] },
    rows: [],
    safetyGates: [gate("required_h23_diagnostics_present", false, "Missing H23 diagnostics artifact.")],
    recommendation: "player_id_crosswalk_source_missing",
    notes: ["No live outputs changed."],
  };
}

function sourceArtifactsFor(input: ProjectionPlayerIdCrosswalkReviewInput): ProjectionPlayerIdCrosswalkReviewReport["sourceArtifacts"] {
  return {
    rookieNewTargetDiagnostics: input.rookieNewTargetDiagnostics ? "in-memory" : "missing",
    playerIdCrosswalkSource: input.playerIdCrosswalkSource ? "in-memory" : null,
    sleeperPlayers: input.sleeperPlayers.length ? "in-memory" : null,
    currentRosterSource: input.currentRosterSource ? "in-memory" : null,
    rookieTeamConfirmationSource: input.rookieTeamConfirmationSource ? "in-memory" : null,
  };
}

function buildSafetyGates(input: ProjectionPlayerIdCrosswalkReviewInput, rows: ProjectionPlayerIdCrosswalkReviewRow[]) {
  return [
    gate("no_live_outputs_changed", true, "Report reads local artifacts and writes only local H24 artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Blackbird Rank ordering is not imported, recalculated, or mutated."),
    gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported, recalculated, or mutated."),
    gate("war_room_scoring_unchanged", true, "War Room behavior is not imported, recalculated, or mutated."),
    gate("v8_2_not_enabled", true, "v8.2 feature flag and projection selector behavior are not changed."),
    gate("only_h23_needs_id_crosswalk_rows_targeted", rows.every((row) => row.h23SourceStrategy === "needs_id_crosswalk"), `${rows.length} H23 needs_id_crosswalk rows evaluated.`),
    gate("name_team_position_not_confirmed", rows.every((row) => row.confidence !== "name_team_position" || row.status !== "crosswalk_confirmed"), "Name/team/position evidence is review-only."),
    gate("required_h23_diagnostics_present", Boolean(input.rookieNewTargetDiagnostics), "H23 diagnostics artifact is present."),
  ];
}

function recommendationFor(safetyGates: ProjectionPlayerIdCrosswalkReviewReport["safetyGates"], rows: ProjectionPlayerIdCrosswalkReviewRow[]): ProjectionPlayerIdCrosswalkRecommendation {
  if (safetyGates.some((gateRow) => !gateRow.passed)) return "player_id_crosswalk_source_missing";
  if (rows.some((row) => row.status === "crosswalk_conflict" || row.status === "crosswalk_ambiguous")) return "player_id_crosswalk_needs_review";
  return "player_id_crosswalk_ready_for_source_integration_preview";
}

function renderMarkdown(report: ProjectionPlayerIdCrosswalkReviewReport) {
  return `# Projection Player ID Crosswalk Review ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Recommendation: ${report.recommendation}

## Summary

\`\`\`json
${JSON.stringify(report.summary, null, 2)}
\`\`\`

## Source Coverage

\`\`\`json
${JSON.stringify(report.sourceCoverage, null, 2)}
\`\`\`

## Integration Preview

\`\`\`json
${JSON.stringify(report.h21IntegrationPreview, null, 2)}
\`\`\`

## Confirmed Rows

${renderRows(report.examples.confirmedRows)}

## Conflicts

${renderRows(report.examples.conflictRows)}

## Ambiguous Rows

${renderRows(report.examples.ambiguousRows)}

## Review Candidates

${renderRows(report.examples.reviewCandidateRows)}

## Missing Rows

${renderRows(report.examples.missingRows)}

## Safety Gates

${renderGateTable(report.safetyGates)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderRows(rows: ProjectionPlayerIdCrosswalkReviewRow[]) {
  if (!rows.length) return "No rows.";
  return [
    "| Player | Pos | Team | Sleeper | GSIS | Status | Preview | Evidence | Reasons |",
    "|---|---|---|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.team ?? ""} | ${row.sleeperId ?? ""} | ${row.crosswalkGsisId ?? row.originalGsisId ?? ""} | ${row.status} | ${row.integrationPreview} | ${row.evidenceSources.join(" ")} | ${row.reasonCodes.slice(0, 4).join(" ")} |`),
  ].join("\n");
}

function renderGateTable(gates: ProjectionPlayerIdCrosswalkReviewReport["safetyGates"]) {
  return [
    "| Gate | Status | Detail |",
    "|---|---|---|",
    ...gates.map((gateRow) => `| ${gateRow.name} | ${gateRow.passed ? "PASS" : "FAIL"} | ${gateRow.detail} |`),
  ].join("\n");
}

function renderCsv(report: ProjectionPlayerIdCrosswalkReviewReport) {
  const headers = ["player_id", "sleeper_id", "original_gsis_id", "crosswalk_gsis_id", "player", "position", "team", "status", "confidence", "evidence_sources", "integration_preview", "current_roster_link", "rookie_team_link", "reason_codes"];
  const rows = report.rows.map((row) => [
    row.playerId,
    row.sleeperId ?? "",
    row.originalGsisId ?? "",
    row.crosswalkGsisId ?? "",
    row.player,
    row.position,
    row.team ?? "",
    row.status,
    row.confidence,
    row.evidenceSources.join("|"),
    row.integrationPreview,
    row.linkedCurrentRosterRow?.playerName ?? "",
    row.linkedRookieTeamRow?.playerName ?? "",
    row.reasonCodes.join("|"),
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function topRows(rows: ProjectionPlayerIdCrosswalkReviewRow[], limit: number) {
  return [...rows].sort((a, b) =>
    Math.abs(b.projectedTotalPointDelta ?? 0) - Math.abs(a.projectedTotalPointDelta ?? 0)
    || Math.abs(b.estimatedOverallRankMovement ?? 0) - Math.abs(a.estimatedOverallRankMovement ?? 0)
    || a.player.localeCompare(b.player)
  ).slice(0, limit);
}

function countByFixed<T, Key extends string>(rows: T[], keys: Key[], keyFor: (row: T) => Key) {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<Key, number>;
  for (const row of rows) counts[keyFor(row)] += 1;
  return counts;
}

function groupBy<T>(rows: T[], keyFor: (row: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) grouped.set(keyFor(row), [...(grouped.get(keyFor(row)) ?? []), row]);
  return grouped;
}

function mapFirst<T>(entries: Array<readonly [string, T]>) {
  const mapped = new Map<string, T>();
  for (const [key, value] of entries) if (!mapped.has(key)) mapped.set(key, value);
  return mapped;
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
