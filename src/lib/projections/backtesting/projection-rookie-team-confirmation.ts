import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { RookieTeamConfirmationSourceReport, RookieTeamConfirmationSourceRow } from "@/lib/data-acquisition/rookie-team-confirmation-source-types";

import type { ProjectionActiveUniversePolicyClassification, ProjectionActiveUniversePolicyPacketReport, ProjectionActiveUniversePolicyPacketRow } from "./projection-active-universe-policy-packet-types";
import type { ProjectionActiveUniverseGateRosterRefreshReport } from "./projection-active-universe-gate-roster-refresh-types";
import type { PreseasonProjectionSnapshot, PreseasonProjectionSnapshotRow } from "./preseason-projection-snapshot-types";
import type {
  ProjectionRookieTeamConfirmationArtifactPaths,
  ProjectionRookieTeamConfirmationInput,
  ProjectionRookieTeamConfirmationMatchReason,
  ProjectionRookieTeamConfirmationRecommendation,
  ProjectionRookieTeamConfirmationReport,
  ProjectionRookieTeamConfirmationRow,
  ProjectionRookieTeamConfirmationStatus,
  ProjectionRookieTeamConfirmationSourceExampleRow,
} from "./projection-rookie-team-confirmation-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const SOURCE_OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "rookies");
const POLICY_CLASSIFICATIONS: ProjectionActiveUniversePolicyClassification[] = [
  "policy_active_candidate",
  "policy_shadow_only",
  "policy_blocked_archive",
  "policy_manual_review",
  "policy_source_expansion_required",
  "policy_kicker_review_required",
  "policy_current_path_only",
];
const STATUSES: ProjectionRookieTeamConfirmationStatus[] = [
  "rookie_team_confirmed",
  "rookie_team_conflict",
  "rookie_team_ambiguous_match",
  "rookie_team_review_candidate",
  "rookie_team_unmatched",
  "rookie_team_source_missing",
];

export function runProjectionRookieTeamConfirmation(options: { projectionSeason: number; includeIdp: boolean; sourcePath?: string | null }): ProjectionRookieTeamConfirmationReport {
  const sourceArtifacts = {
    policyPacket: path.join(OUTPUT_DIR, `projection-active-universe-policy-packet-${options.projectionSeason}.json`),
    rosterRefresh: path.join(OUTPUT_DIR, `projection-active-universe-gate-roster-refresh-${options.projectionSeason}.json`),
    preseasonProjectionSnapshot: path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`),
    rookieTeamConfirmationSource: options.sourcePath ?? path.join(SOURCE_OUTPUT_DIR, `rookie-team-confirmation-${options.projectionSeason}.normalized.json`),
  };
  for (const artifactPath of [sourceArtifacts.policyPacket, sourceArtifacts.rosterRefresh, sourceArtifacts.preseasonProjectionSnapshot]) {
    if (!existsSync(artifactPath)) throw new Error(`Missing ${path.relative(process.cwd(), artifactPath)}.`);
  }
  const rookieSourcePath = sourceArtifacts.rookieTeamConfirmationSource;
  const rookieTeamConfirmationSource = rookieSourcePath && existsSync(rookieSourcePath)
    ? readJson<RookieTeamConfirmationSourceReport>(rookieSourcePath)
    : null;

  return buildProjectionRookieTeamConfirmationFromData({
    options: { projectionSeason: options.projectionSeason, includeIdp: options.includeIdp },
    policyPacket: readJson<ProjectionActiveUniversePolicyPacketReport>(sourceArtifacts.policyPacket),
    rosterRefresh: readJson<ProjectionActiveUniverseGateRosterRefreshReport>(sourceArtifacts.rosterRefresh),
    preseasonProjectionSnapshot: readJson<PreseasonProjectionSnapshot>(sourceArtifacts.preseasonProjectionSnapshot),
    rookieTeamConfirmationSource,
    sourceArtifacts: {
      ...sourceArtifacts,
      rookieTeamConfirmationSource: rookieTeamConfirmationSource ? rookieSourcePath : null,
    },
  });
}

export function buildProjectionRookieTeamConfirmationFromData(input: ProjectionRookieTeamConfirmationInput): ProjectionRookieTeamConfirmationReport {
  const sourceMissing = !input.rookieTeamConfirmationSource;
  const sourceRows = input.rookieTeamConfirmationSource?.rows ?? [];
  const snapshotRows = input.preseasonProjectionSnapshot?.rows ?? [];
  const targetRows = input.policyPacket.rows.filter((row) => row.policyGroup === "unmatched_rookie_new_review");
  const indexes = buildIndexes(sourceRows, snapshotRows, targetRows);
  const rows = targetRows.map((row) => confirmRookieRow(row, indexes, sourceMissing));
  const matchDiagnostics = buildMatchDiagnostics(targetRows, sourceRows, indexes);
  const summary = {
    targetRookieNewUnmatchedRows: targetRows.length,
    sourceRows: input.rookieTeamConfirmationSource?.normalizedRows ?? 0,
    matchedRows: rows.filter((row) => row.rookieTeamStatus === "rookie_team_confirmed" || row.rookieTeamStatus === "rookie_team_conflict" || row.rookieTeamStatus === "rookie_team_ambiguous_match" || row.rookieTeamStatus === "rookie_team_review_candidate").length,
    unmatchedRows: rows.filter((row) => row.rookieTeamStatus === "rookie_team_unmatched" || row.rookieTeamStatus === "rookie_team_source_missing").length,
    confirmedTeamRows: rows.filter((row) => row.rookieTeamStatus === "rookie_team_confirmed").length,
    teamConflictRows: rows.filter((row) => row.rookieTeamStatus === "rookie_team_conflict").length,
    ambiguousMatchRows: rows.filter((row) => row.rookieTeamStatus === "rookie_team_ambiguous_match").length,
    reviewCandidateRows: rows.filter((row) => row.rookieTeamStatus === "rookie_team_review_candidate").length,
    invalidSourceRows: input.rookieTeamConfirmationSource?.invalidRows ?? 0,
    byStatus: countStatuses(rows),
    byPosition: countNestedStatuses(rows, (row) => row.position || "unknown_position"),
    byTeam: countNestedStatuses(rows, (row) => row.projectionTeam ?? "missing_team"),
    byV82SafeSubset: countNestedStatuses(rows, (row) => row.v82Path === "would_use_v8_2_safe_subset" ? "v82_safe_subset" : "not_v82_safe_subset"),
  };
  const h21IntegrationPreview = buildH21Preview(rows);
  const safetyGates = buildSafetyGates(input, rows);
  const recommendation = recommendationFor(sourceMissing, summary.teamConflictRows + summary.ambiguousMatchRows + summary.reviewCandidateRows, safetyGates);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? {
      policyPacket: "in-memory",
      rosterRefresh: "in-memory",
      preseasonProjectionSnapshot: "in-memory",
      rookieTeamConfirmationSource: sourceMissing ? null : "in-memory",
    },
    sourceMissing,
    summary,
    matchDiagnostics,
    h21IntegrationPreview,
    rows,
    safetyGates,
    recommendation,
    notes: [
      "H22 is a dry-run/read-only rookie team confirmation report.",
      "The H21 integration summary is a preview only; H21 policy behavior is not changed.",
      "No live projections, rank, suggestions, War Room scoring, Supabase tables, or v8.2 selection are mutated.",
    ],
  };
}

export function writeProjectionRookieTeamConfirmationArtifacts(report: ProjectionRookieTeamConfirmationReport): ProjectionRookieTeamConfirmationArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-rookie-team-confirmation-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function confirmRookieRow(
  row: ProjectionActiveUniversePolicyPacketRow,
  indexes: ReturnType<typeof buildIndexes>,
  sourceMissing: boolean,
): ProjectionRookieTeamConfirmationRow {
  if (sourceMissing) return projectionRow(row, null, "rookie_team_source_missing", "no_source");
  const match = findSourceMatch(row, indexes);
  if (!match) return projectionRow(row, null, "rookie_team_unmatched", "no_match");
  if (match.ambiguous) return projectionRow(row, match.sources[0] ?? null, "rookie_team_ambiguous_match", match.reason);
  if (match.reviewCandidate) return projectionRow(row, match.sources[0] ?? null, "rookie_team_review_candidate", match.reason);
  const source = match.sources[0];
  if (!source) return projectionRow(row, null, "rookie_team_unmatched", "no_match");
  const status = teamsAgree(row.projectionTeam, source.nflTeam) ? "rookie_team_confirmed" : "rookie_team_conflict";
  return projectionRow(row, source, status, match.reason);
}

function projectionRow(
  row: ProjectionActiveUniversePolicyPacketRow,
  sourceRow: RookieTeamConfirmationSourceRow | null,
  status: ProjectionRookieTeamConfirmationStatus,
  matchReason: ProjectionRookieTeamConfirmationMatchReason,
): ProjectionRookieTeamConfirmationRow {
  const previewPolicyClassification = previewClassification(status);
  return {
    ...row,
    rookieTeamStatus: status,
    matchReason,
    sourceTeam: sourceRow?.nflTeam ?? null,
    sourceDraftClub: sourceRow?.draftClub ?? null,
    sourceCollege: sourceRow?.college ?? null,
    sourcePlayerName: sourceRow?.playerName ?? null,
    sourceRow,
    previewPolicyClassification,
    previewReasonCodes: previewReasonCodes(status, row, sourceRow),
  };
}

function previewClassification(status: ProjectionRookieTeamConfirmationStatus): ProjectionActiveUniversePolicyClassification {
  if (status === "rookie_team_confirmed") return "policy_active_candidate";
  if (status === "rookie_team_conflict") return "policy_manual_review";
  if (status === "rookie_team_ambiguous_match" || status === "rookie_team_review_candidate") return "policy_manual_review";
  return "policy_source_expansion_required";
}

function previewReasonCodes(status: ProjectionRookieTeamConfirmationStatus, row: ProjectionActiveUniversePolicyPacketRow, sourceRow: RookieTeamConfirmationSourceRow | null) {
  if (status === "rookie_team_confirmed") return ["rookie_team_source_confirmed", `source_team:${sourceRow?.nflTeam ?? "missing"}`];
  if (status === "rookie_team_conflict") return ["rookie_team_source_conflict", `projection_team:${row.projectionTeam ?? "missing"}`, `source_team:${sourceRow?.nflTeam ?? "missing"}`];
  if (status === "rookie_team_ambiguous_match") return ["rookie_team_source_ambiguous", `projection_team:${row.projectionTeam ?? "missing"}`];
  if (status === "rookie_team_review_candidate") return ["rookie_team_source_review_candidate", `projection_team:${row.projectionTeam ?? "missing"}`, `source_team:${sourceRow?.nflTeam ?? "missing"}`];
  if (status === "rookie_team_source_missing") return ["rookie_team_source_missing"];
  return ["rookie_team_not_found_in_source"];
}

function buildIndexes(sourceRows: RookieTeamConfirmationSourceRow[], snapshotRows: PreseasonProjectionSnapshotRow[], targetRows: ProjectionActiveUniversePolicyPacketRow[]) {
  const sourceByPlayerId = new Map<string, RookieTeamConfirmationSourceRow[]>();
  const sourceBySleeperId = new Map<string, RookieTeamConfirmationSourceRow[]>();
  const sourceByGsisId = new Map<string, RookieTeamConfirmationSourceRow[]>();
  const sourceByName = new Map<string, RookieTeamConfirmationSourceRow[]>();
  const sourceByNamePosition = new Map<string, RookieTeamConfirmationSourceRow[]>();
  const sourceByNameTeam = new Map<string, RookieTeamConfirmationSourceRow[]>();
  const sourceByNamePositionTeam = new Map<string, RookieTeamConfirmationSourceRow[]>();
  for (const row of sourceRows) {
    const normalizedName = normalizeProjectionRookieName(row.playerName);
    if (row.playerId) addToMap(sourceByPlayerId, row.playerId, row);
    if (row.sleeperId) addToMap(sourceBySleeperId, row.sleeperId, row);
    if (row.gsisId) addToMap(sourceByGsisId, row.gsisId, row);
    addToMap(sourceByName, normalizedName, row);
    addToMap(sourceByNamePosition, namePositionKey(normalizedName, row.position), row);
    if (row.nflTeam) addToMap(sourceByNameTeam, nameTeamKey(normalizedName, row.nflTeam), row);
    if (row.nflTeam) addToMap(sourceByNamePositionTeam, namePositionTeamKey(normalizedName, row.position, row.nflTeam), row);
  }

  const snapshotByPlayerId = new Map<string, PreseasonProjectionSnapshotRow>();
  for (const row of snapshotRows) {
    if (row.sleeperId) snapshotByPlayerId.set(row.sleeperId, row);
    if (row.gsisId) snapshotByPlayerId.set(row.gsisId, row);
    snapshotByPlayerId.set(namePositionKey(row.normalizedName, row.position), row);
  }
  const targetByName = new Map<string, ProjectionActiveUniversePolicyPacketRow[]>();
  const targetByNamePosition = new Map<string, ProjectionActiveUniversePolicyPacketRow[]>();
  const targetByNameTeam = new Map<string, ProjectionActiveUniversePolicyPacketRow[]>();
  const targetByNamePositionTeam = new Map<string, ProjectionActiveUniversePolicyPacketRow[]>();
  for (const row of targetRows) {
    const normalizedName = normalizeProjectionRookieName(row.player);
    addToMap(targetByName, normalizedName, row);
    addToMap(targetByNamePosition, namePositionKey(normalizedName, row.position), row);
    if (row.projectionTeam) addToMap(targetByNameTeam, nameTeamKey(normalizedName, row.projectionTeam), row);
    if (row.projectionTeam) addToMap(targetByNamePositionTeam, namePositionTeamKey(normalizedName, row.position, row.projectionTeam), row);
  }
  return {
    sourceByPlayerId,
    sourceBySleeperId,
    sourceByGsisId,
    sourceByName,
    sourceByNamePosition,
    sourceByNameTeam,
    sourceByNamePositionTeam,
    snapshotByPlayerId,
    targetByName,
    targetByNamePosition,
    targetByNameTeam,
    targetByNamePositionTeam,
  };
}

function findSourceMatch(row: ProjectionActiveUniversePolicyPacketRow, indexes: ReturnType<typeof buildIndexes>): { sources: RookieTeamConfirmationSourceRow[]; reason: ProjectionRookieTeamConfirmationMatchReason; ambiguous?: boolean; reviewCandidate?: boolean } | null {
  const normalizedName = normalizeProjectionRookieName(row.player);
  const snapshot = indexes.snapshotByPlayerId.get(row.playerId) ?? indexes.snapshotByPlayerId.get(namePositionKey(normalizedName, row.position));
  const idMatches: Array<[ProjectionRookieTeamConfirmationMatchReason, RookieTeamConfirmationSourceRow[] | undefined]> = [
    ["player_id", indexes.sourceByPlayerId.get(row.playerId)],
    ["sleeper_id", indexes.sourceBySleeperId.get(row.playerId)],
    ["gsis_id", indexes.sourceByGsisId.get(row.playerId)],
    ["sleeper_id", snapshot?.sleeperId ? indexes.sourceBySleeperId.get(snapshot.sleeperId) : undefined],
    ["gsis_id", snapshot?.gsisId ? indexes.sourceByGsisId.get(snapshot.gsisId) : undefined],
  ];
  for (const [reason, sources] of idMatches) {
    if (sources?.length) return { sources, reason, ambiguous: sources.length > 1 };
  }

  const namePosition = indexes.sourceByNamePosition.get(namePositionKey(normalizedName, row.position));
  if (namePosition?.length) return nonIdMatch(row, namePosition, "name_position", indexes.targetByNamePosition.get(namePositionKey(normalizedName, row.position)));

  const nameTeam = row.projectionTeam ? indexes.sourceByNameTeam.get(nameTeamKey(normalizedName, row.projectionTeam)) : undefined;
  if (nameTeam?.length) return nonIdMatch(row, nameTeam, "name_team", indexes.targetByNameTeam.get(nameTeamKey(normalizedName, row.projectionTeam ?? "")));

  const namePositionTeam = row.projectionTeam ? indexes.sourceByNamePositionTeam.get(namePositionTeamKey(normalizedName, row.position, row.projectionTeam)) : undefined;
  if (namePositionTeam?.length) return nonIdMatch(row, namePositionTeam, "name_position_team", indexes.targetByNamePositionTeam.get(namePositionTeamKey(normalizedName, row.position, row.projectionTeam ?? "")));

  const nameOnly = indexes.sourceByName.get(normalizedName);
  if (nameOnly?.length) return { sources: nameOnly, reason: "name_only_overlap", reviewCandidate: true, ambiguous: nameOnly.length > 1 };
  return null;
}

function nonIdMatch(
  row: ProjectionActiveUniversePolicyPacketRow,
  sources: RookieTeamConfirmationSourceRow[],
  reason: ProjectionRookieTeamConfirmationMatchReason,
  matchingTargets: ProjectionActiveUniversePolicyPacketRow[] | undefined,
) {
  if (sources.length > 1 || (matchingTargets?.length ?? 0) > 1) return { sources, reason, ambiguous: true };
  const source = sources[0];
  if (!source) return { sources, reason, ambiguous: true };
  if (source.position !== row.position || (row.projectionTeam && source.nflTeam && source.nflTeam !== row.projectionTeam)) {
    return { sources, reason, reviewCandidate: true };
  }
  return { sources, reason };
}

function teamsAgree(projectionTeam: string | null, sourceTeam: string | null) {
  return Boolean(projectionTeam && sourceTeam && projectionTeam === sourceTeam);
}

function buildH21Preview(rows: ProjectionRookieTeamConfirmationRow[]) {
  const wouldMoveTo = Object.fromEntries(POLICY_CLASSIFICATIONS.map((classification) => [classification, 0])) as Record<ProjectionActiveUniversePolicyClassification, number>;
  for (const row of rows) wouldMoveTo[row.previewPolicyClassification] += 1;
  return {
    wouldMoveTo,
    confirmedRowsToActiveCandidate: wouldMoveTo.policy_active_candidate,
    conflictRowsToManualReview: wouldMoveTo.policy_manual_review,
    heldForSourceExpansion: wouldMoveTo.policy_source_expansion_required,
    shadowOnlyRows: wouldMoveTo.policy_shadow_only,
    notes: [
      "Confirmed rookie team rows are previewed as policy_active_candidate.",
      "Team conflicts, ambiguous matches, and review candidates are previewed as policy_manual_review.",
      "Missing or unmatched rows stay policy_source_expansion_required.",
      "This preview does not change H21 output or any live selector.",
    ],
  };
}

function buildSafetyGates(input: ProjectionRookieTeamConfirmationInput, rows: ProjectionRookieTeamConfirmationRow[]) {
  return [
    gate("no_live_outputs_changed", true, "Report reads artifacts and writes only local H22 artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Blackbird Rank ordering is not imported, recalculated, or mutated."),
    gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported, recalculated, or mutated."),
    gate("war_room_scoring_unchanged", true, "War Room scoring behavior is not imported, recalculated, or mutated."),
    gate("v8_2_not_enabled", true, "v8.2 feature flag and projection selector behavior are not changed."),
    gate("h21_not_mutated", input.policyPacket.recommendation === "active_policy_ready_for_source_expansion", `H21 recommendation observed as ${input.policyPacket.recommendation}.`),
    gate("only_rookie_new_unmatched_targeted", rows.every((row) => row.policyGroup === "unmatched_rookie_new_review"), `${rows.length} target rows evaluated.`),
    gate("confirmed_rows_have_matching_teams", rows.filter((row) => row.rookieTeamStatus === "rookie_team_confirmed").every((row) => row.projectionTeam === row.sourceTeam), "Confirmed rows require projection/source team agreement."),
    gate("review_rows_not_auto_promoted", rows.filter((row) => row.rookieTeamStatus === "rookie_team_conflict" || row.rookieTeamStatus === "rookie_team_ambiguous_match" || row.rookieTeamStatus === "rookie_team_review_candidate").every((row) => row.previewPolicyClassification === "policy_manual_review"), "Conflict/ambiguous/review rows remain manual-review preview."),
  ];
}

function recommendationFor(
  sourceMissing: boolean,
  teamConflictRows: number,
  safetyGates: ProjectionRookieTeamConfirmationReport["safetyGates"],
): ProjectionRookieTeamConfirmationRecommendation {
  if (sourceMissing) return "rookie_team_confirmation_source_missing";
  if (safetyGates.some((gateRow) => !gateRow.passed) || teamConflictRows > 0) return "rookie_team_confirmation_needs_review";
  return "rookie_team_confirmation_ready_for_h21_preview";
}

export function normalizeProjectionRookieName(value: string) {
  return value
    .toLowerCase()
    .replace(/[.'-]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((part) => part && !["jr", "sr", "ii", "iii", "iv", "v"].includes(part))
    .join("");
}

function buildMatchDiagnostics(
  targetRows: ProjectionActiveUniversePolicyPacketRow[],
  sourceRows: RookieTeamConfirmationSourceRow[],
  indexes: ReturnType<typeof buildIndexes>,
): ProjectionRookieTeamConfirmationReport["matchDiagnostics"] {
  const targetSnapshotRows = targetRows.map((row) => indexes.snapshotByPlayerId.get(row.playerId) ?? indexes.snapshotByPlayerId.get(namePositionKey(normalizeProjectionRookieName(row.player), row.position)) ?? null);
  const targetNames = new Set(targetRows.map((row) => normalizeProjectionRookieName(row.player)));
  const sourceNames = new Set(sourceRows.map((row) => normalizeProjectionRookieName(row.playerName)));
  const overlappingNames = [...targetNames].filter((name) => sourceNames.has(name));
  const rejected = nameOnlyRejectedExamples(targetRows, indexes);
  return {
    targetFieldCounts: {
      withPlayerId: targetRows.filter((row) => Boolean(row.playerId)).length,
      withSleeperId: targetSnapshotRows.filter((row) => Boolean(row?.sleeperId)).length,
      withGsisId: targetSnapshotRows.filter((row) => Boolean(row?.gsisId)).length,
      withPlayerName: targetRows.filter((row) => Boolean(row.player)).length,
      withPosition: targetRows.filter((row) => Boolean(row.position)).length,
      withTeam: targetRows.filter((row) => Boolean(row.projectionTeam)).length,
    },
    sourceFieldCounts: {
      withPlayerId: sourceRows.filter((row) => Boolean(row.playerId)).length,
      withSleeperId: sourceRows.filter((row) => Boolean(row.sleeperId)).length,
      withGsisId: sourceRows.filter((row) => Boolean(row.gsisId)).length,
      withPlayerName: sourceRows.filter((row) => Boolean(row.playerName)).length,
      withPosition: sourceRows.filter((row) => Boolean(row.position)).length,
      withNflTeam: sourceRows.filter((row) => Boolean(row.nflTeam)).length,
    },
    candidateMatchCounts: {
      byExactPlayerId: countTargetCandidates(targetRows, (row) => indexes.sourceByPlayerId.has(row.playerId)),
      bySleeperId: countTargetCandidates(targetRows, (_row, index) => Boolean(targetSnapshotRows[index]?.sleeperId && indexes.sourceBySleeperId.has(targetSnapshotRows[index]?.sleeperId ?? ""))),
      byGsisId: countTargetCandidates(targetRows, (_row, index) => Boolean(targetSnapshotRows[index]?.gsisId && indexes.sourceByGsisId.has(targetSnapshotRows[index]?.gsisId ?? ""))),
      byNormalizedPlayerName: countTargetCandidates(targetRows, (row) => indexes.sourceByName.has(normalizeProjectionRookieName(row.player))),
      byNormalizedPlayerNamePosition: countTargetCandidates(targetRows, (row) => indexes.sourceByNamePosition.has(namePositionKey(normalizeProjectionRookieName(row.player), row.position))),
      byNormalizedPlayerNameTeam: countTargetCandidates(targetRows, (row) => Boolean(row.projectionTeam && indexes.sourceByNameTeam.has(nameTeamKey(normalizeProjectionRookieName(row.player), row.projectionTeam)))),
      byNormalizedPlayerNamePositionTeam: countTargetCandidates(targetRows, (row) => Boolean(row.projectionTeam && indexes.sourceByNamePositionTeam.has(namePositionTeamKey(normalizeProjectionRookieName(row.player), row.position, row.projectionTeam)))),
    },
    examples: {
      topTargetRows: targetRows.slice(0, 25).map(targetExample),
      topSourceRows: sourceRows.slice(0, 25).map(sourceExample),
      normalizedNameOverlaps: overlappingNames.slice(0, 25).map((normalizedName) => ({
        normalizedName,
        targetPlayers: (indexes.targetByName.get(normalizedName) ?? []).slice(0, 5).map(targetExample),
        sourcePlayers: (indexes.sourceByName.get(normalizedName) ?? []).slice(0, 5).map(sourceExample),
      })),
      nameOnlyMatchesRejected: rejected.slice(0, 25),
      sourceRowsWithNoTargetNameOverlap: sourceRows.filter((row) => !targetNames.has(normalizeProjectionRookieName(row.playerName))).slice(0, 25).map(sourceExample),
      targetRowsWithNoSourceNameOverlap: targetRows.filter((row) => !sourceNames.has(normalizeProjectionRookieName(row.player))).slice(0, 25).map(targetExample),
    },
  };
}

function nameOnlyRejectedExamples(targetRows: ProjectionActiveUniversePolicyPacketRow[], indexes: ReturnType<typeof buildIndexes>) {
  const rejected: ProjectionRookieTeamConfirmationReport["matchDiagnostics"]["examples"]["nameOnlyMatchesRejected"] = [];
  for (const target of targetRows) {
    const normalizedName = normalizeProjectionRookieName(target.player);
    for (const source of indexes.sourceByName.get(normalizedName) ?? []) {
      const positionMatches = source.position === target.position;
      const teamMatches = Boolean(target.projectionTeam && source.nflTeam && source.nflTeam === target.projectionTeam);
      if (!positionMatches || !teamMatches) {
        rejected.push({
          target: targetExample(target),
          source: sourceExample(source),
          reason: !positionMatches && !teamMatches ? "position_and_team_mismatch" : !positionMatches ? "position_mismatch" : "team_mismatch",
        });
      }
    }
  }
  return rejected;
}

function countTargetCandidates(rows: ProjectionActiveUniversePolicyPacketRow[], predicate: (row: ProjectionActiveUniversePolicyPacketRow, index: number) => boolean) {
  return rows.filter(predicate).length;
}

function countStatuses(rows: ProjectionRookieTeamConfirmationRow[]) {
  const counts = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<ProjectionRookieTeamConfirmationStatus, number>;
  for (const row of rows) counts[row.rookieTeamStatus] += 1;
  return counts;
}

function countNestedStatuses<Key extends string>(rows: ProjectionRookieTeamConfirmationRow[], keyFor: (row: ProjectionRookieTeamConfirmationRow) => Key) {
  const counts: Record<Key, Record<ProjectionRookieTeamConfirmationStatus, number>> = {} as Record<Key, Record<ProjectionRookieTeamConfirmationStatus, number>>;
  for (const row of rows) {
    const key = keyFor(row);
    counts[key] = counts[key] ?? Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<ProjectionRookieTeamConfirmationStatus, number>;
    counts[key][row.rookieTeamStatus] += 1;
  }
  return counts;
}

function namePositionKey(normalizedName: string, position: string) {
  return `${normalizedName}|${position}`;
}

function nameTeamKey(normalizedName: string, team: string) {
  return `${normalizedName}|${team}`;
}

function namePositionTeamKey(normalizedName: string, position: string, team: string) {
  return `${normalizedName}|${position}|${team}`;
}

function addToMap<K, V>(map: Map<K, V[]>, key: K, value: V) {
  map.set(key, [...(map.get(key) ?? []), value]);
}

function targetExample(row: ProjectionActiveUniversePolicyPacketRow) {
  return {
    playerId: row.playerId,
    player: row.player,
    normalizedName: normalizeProjectionRookieName(row.player),
    position: row.position,
    team: row.projectionTeam,
    v82Path: row.v82Path,
  };
}

function sourceExample(row: RookieTeamConfirmationSourceRow): ProjectionRookieTeamConfirmationSourceExampleRow {
  return {
    playerId: row.playerId,
    sleeperId: row.sleeperId,
    gsisId: row.gsisId,
    playerName: row.playerName,
    normalizedName: normalizeProjectionRookieName(row.playerName),
    position: row.position,
    nflTeam: row.nflTeam,
    draftClub: row.draftClub,
  };
}

function renderMarkdown(report: ProjectionRookieTeamConfirmationReport) {
  return `# Projection Rookie Team Confirmation ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Recommendation: ${report.recommendation}
Source missing: ${report.sourceMissing}

## Summary

\`\`\`json
${JSON.stringify(report.summary, null, 2)}
\`\`\`

## H21 Integration Preview

\`\`\`json
${JSON.stringify(report.h21IntegrationPreview, null, 2)}
\`\`\`

## Match Diagnostics

\`\`\`json
${JSON.stringify({
  targetFieldCounts: report.matchDiagnostics.targetFieldCounts,
  sourceFieldCounts: report.matchDiagnostics.sourceFieldCounts,
  candidateMatchCounts: report.matchDiagnostics.candidateMatchCounts,
}, null, 2)}
\`\`\`

### Top Target Rookie/New Unmatched Rows

${renderExampleRows(report.matchDiagnostics.examples.topTargetRows)}

### Top Source Rookie Rows

${renderSourceExampleRows(report.matchDiagnostics.examples.topSourceRows)}

### Normalized Name Overlaps

${renderOverlapRows(report.matchDiagnostics.examples.normalizedNameOverlaps)}

### Name-Only Matches Rejected

${renderRejectedRows(report.matchDiagnostics.examples.nameOnlyMatchesRejected)}

### Source Rows With No Target Name Overlap

${renderSourceExampleRows(report.matchDiagnostics.examples.sourceRowsWithNoTargetNameOverlap)}

### Target Rows With No Source Name Overlap

${renderExampleRows(report.matchDiagnostics.examples.targetRowsWithNoSourceNameOverlap)}

## Safety Gates

${renderGateTable(report.safetyGates)}

## Top Rows

${renderRows(report.rows.slice(0, 100))}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderExampleRows(rows: ProjectionRookieTeamConfirmationReport["matchDiagnostics"]["examples"]["topTargetRows"]) {
  if (!rows.length) return "No rows.";
  return [
    "| Player | Normalized | Pos | Team | v8.2 |",
    "|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.player} | ${row.normalizedName} | ${row.position} | ${row.team ?? ""} | ${row.v82Path} |`),
  ].join("\n");
}

function renderSourceExampleRows(rows: ProjectionRookieTeamConfirmationSourceExampleRow[]) {
  if (!rows.length) return "No rows.";
  return [
    "| Player | Normalized | Pos | NFL Team | Sleeper | GSIS |",
    "|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.playerName} | ${row.normalizedName} | ${row.position} | ${row.nflTeam ?? ""} | ${row.sleeperId ?? ""} | ${row.gsisId ?? ""} |`),
  ].join("\n");
}

function renderOverlapRows(rows: ProjectionRookieTeamConfirmationReport["matchDiagnostics"]["examples"]["normalizedNameOverlaps"]) {
  if (!rows.length) return "No rows.";
  return [
    "| Normalized Name | Target Players | Source Players |",
    "|---|---|---|",
    ...rows.map((row) => `| ${row.normalizedName} | ${row.targetPlayers.map((player) => `${player.player} ${player.position} ${player.team ?? ""}`).join("; ")} | ${row.sourcePlayers.map((player) => `${player.playerName} ${player.position} ${player.nflTeam ?? ""}`).join("; ")} |`),
  ].join("\n");
}

function renderRejectedRows(rows: ProjectionRookieTeamConfirmationReport["matchDiagnostics"]["examples"]["nameOnlyMatchesRejected"]) {
  if (!rows.length) return "No rows.";
  return [
    "| Target | Source | Reason |",
    "|---|---|---|",
    ...rows.map((row) => `| ${row.target.player} ${row.target.position} ${row.target.team ?? ""} | ${row.source.playerName} ${row.source.position} ${row.source.nflTeam ?? ""} | ${row.reason} |`),
  ].join("\n");
}

function renderRows(rows: ProjectionRookieTeamConfirmationRow[]) {
  if (!rows.length) return "No rows.";
  return [
    "| Player | Pos | Projection Team | Source Team | Status | Match | Preview Policy |",
    "|---|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.projectionTeam ?? ""} | ${row.sourceTeam ?? ""} | ${row.rookieTeamStatus} | ${row.matchReason} | ${row.previewPolicyClassification} |`),
  ].join("\n");
}

function renderGateTable(gates: ProjectionRookieTeamConfirmationReport["safetyGates"]) {
  return [
    "| Gate | Status | Detail |",
    "|---|---|---|",
    ...gates.map((gateRow) => `| ${gateRow.name} | ${gateRow.passed ? "PASS" : "FAIL"} | ${gateRow.detail} |`),
  ].join("\n");
}

function renderCsv(report: ProjectionRookieTeamConfirmationReport) {
  const headers = [
    "player_id",
    "player",
    "position",
    "projection_team",
    "source_team",
    "source_player",
    "source_college",
    "rookie_team_status",
    "match_reason",
    "h21_policy_classification",
    "preview_policy_classification",
    "v82_path",
    "preview_reason_codes",
  ];
  return [headers, ...report.rows.map((row) => [
    row.playerId,
    row.player,
    row.position,
    row.projectionTeam ?? "",
    row.sourceTeam ?? "",
    row.sourcePlayerName ?? "",
    row.sourceCollege ?? "",
    row.rookieTeamStatus,
    row.matchReason,
    row.policyClassification,
    row.previewPolicyClassification,
    row.v82Path,
    row.previewReasonCodes.join("|"),
  ])].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
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
