import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { CurrentRosterSourceReport, CurrentRosterSourceRow } from "@/lib/data-acquisition/current-roster-source-types";
import type { RookieTeamConfirmationSourceReport, RookieTeamConfirmationSourceRow } from "@/lib/data-acquisition/rookie-team-confirmation-source-types";

import { normalizeProjectionRookieName } from "./projection-rookie-team-confirmation";
import type { ProjectionActiveUniversePolicyPacketReport, ProjectionActiveUniversePolicyPacketRow } from "./projection-active-universe-policy-packet-types";
import type { ProjectionActiveUniverseGateRosterRefreshReport } from "./projection-active-universe-gate-roster-refresh-types";
import type { ProjectionCurrentRosterConfirmationReport, ProjectionCurrentRosterConfirmationRow } from "./projection-current-roster-confirmation-types";
import type { ProjectionRookieTeamConfirmationReport, ProjectionRookieTeamConfirmationRow } from "./projection-rookie-team-confirmation-types";
import type { PreseasonProjectionSnapshot, PreseasonProjectionSnapshotRow } from "./preseason-projection-snapshot-types";
import type {
  ProjectionRookieNewTargetDiagnosticsArtifactPaths,
  ProjectionRookieNewTargetDiagnosticsInput,
  ProjectionRookieNewTargetDiagnosticsRecommendation,
  ProjectionRookieNewTargetDiagnosticsReport,
  ProjectionRookieNewTargetDiagnosticsRow,
  ProjectionRookieNewTargetIdentityClass,
  ProjectionRookieNewTargetPositionFamilyDiagnostic,
  ProjectionRookieNewTargetSourceCandidate,
  ProjectionRookieNewTargetSourceStrategy,
} from "./projection-rookie-new-target-diagnostics-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const CURRENT_ROSTER_OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "current-rosters");
const ROOKIE_OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "rookies");
const IDENTITY_CLASSES: ProjectionRookieNewTargetIdentityClass[] = [
  "true_rookie_candidate",
  "sleeper_only_player",
  "low_prior_veteran_or_unknown",
  "idp_position_family_mismatch_candidate",
  "special_teams_position_mismatch_candidate",
  "duplicate_or_alias_candidate",
  "missing_identity_data",
  "source_strategy_unknown",
];
const SOURCE_STRATEGIES: ProjectionRookieNewTargetSourceStrategy[] = [
  "use_sleeper_player_metadata",
  "use_current_roster_source",
  "use_draft_results_source",
  "use_depth_chart_source",
  "use_transaction_status_source",
  "use_manual_rookie_source",
  "needs_id_crosswalk",
  "needs_position_family_review",
];
const POSITION_FAMILIES: ProjectionRookieNewTargetPositionFamilyDiagnostic[] = [
  "returner_family_compatible",
  "edge_family_compatible",
  "db_family_compatible",
  "te_ls_incompatible_without_review",
  "position_family_incompatible",
  "position_family_exact",
  "not_applicable",
];

export function runProjectionRookieNewTargetDiagnostics(options: { projectionSeason: number; includeIdp: boolean }): ProjectionRookieNewTargetDiagnosticsReport {
  const sourceArtifacts = {
    rookieTeamConfirmation: path.join(OUTPUT_DIR, `projection-rookie-team-confirmation-${options.projectionSeason}.json`),
    policyPacket: path.join(OUTPUT_DIR, `projection-active-universe-policy-packet-${options.projectionSeason}.json`),
    rosterRefresh: path.join(OUTPUT_DIR, `projection-active-universe-gate-roster-refresh-${options.projectionSeason}.json`),
    currentRosterConfirmation: path.join(OUTPUT_DIR, `projection-current-roster-confirmation-${options.projectionSeason}.json`),
    preseasonProjectionSnapshot: path.join(OUTPUT_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`),
    currentRosterSource: path.join(CURRENT_ROSTER_OUTPUT_DIR, `current-rosters-${options.projectionSeason}.normalized.json`),
    rookieTeamConfirmationSource: path.join(ROOKIE_OUTPUT_DIR, `rookie-team-confirmation-${options.projectionSeason}.normalized.json`),
  };
  for (const artifactPath of [
    sourceArtifacts.rookieTeamConfirmation,
    sourceArtifacts.policyPacket,
    sourceArtifacts.rosterRefresh,
    sourceArtifacts.currentRosterConfirmation,
    sourceArtifacts.preseasonProjectionSnapshot,
  ]) {
    if (!existsSync(artifactPath)) throw new Error(`Missing ${path.relative(process.cwd(), artifactPath)}.`);
  }

  return buildProjectionRookieNewTargetDiagnosticsFromData({
    options,
    rookieTeamConfirmation: readJson<ProjectionRookieTeamConfirmationReport>(sourceArtifacts.rookieTeamConfirmation),
    policyPacket: readJson<ProjectionActiveUniversePolicyPacketReport>(sourceArtifacts.policyPacket),
    rosterRefresh: readJson<ProjectionActiveUniverseGateRosterRefreshReport>(sourceArtifacts.rosterRefresh),
    currentRosterConfirmation: readJson<ProjectionCurrentRosterConfirmationReport>(sourceArtifacts.currentRosterConfirmation),
    preseasonProjectionSnapshot: readJson<PreseasonProjectionSnapshot>(sourceArtifacts.preseasonProjectionSnapshot),
    currentRosterSource: existsSync(sourceArtifacts.currentRosterSource) ? readJson<CurrentRosterSourceReport>(sourceArtifacts.currentRosterSource) : null,
    rookieTeamConfirmationSource: existsSync(sourceArtifacts.rookieTeamConfirmationSource) ? readJson<RookieTeamConfirmationSourceReport>(sourceArtifacts.rookieTeamConfirmationSource) : null,
    sourceArtifacts: {
      ...sourceArtifacts,
      currentRosterSource: existsSync(sourceArtifacts.currentRosterSource) ? sourceArtifacts.currentRosterSource : null,
      rookieTeamConfirmationSource: existsSync(sourceArtifacts.rookieTeamConfirmationSource) ? sourceArtifacts.rookieTeamConfirmationSource : null,
    },
  });
}

export function buildProjectionRookieNewTargetDiagnosticsFromData(input: ProjectionRookieNewTargetDiagnosticsInput): ProjectionRookieNewTargetDiagnosticsReport {
  const targetRows = input.policyPacket.rows.filter((row) => row.policyGroup === "unmatched_rookie_new_review");
  const snapshotRows = input.preseasonProjectionSnapshot?.rows ?? [];
  const lookups = buildLookups(input, snapshotRows);
  const rows = targetRows.map((row) => buildTargetRow(row, lookups));
  const summary = {
    totalTargetRows: rows.length,
    identityClassCounts: countByFixed(rows, IDENTITY_CLASSES, (row) => row.targetIdentityClass),
    sourceStrategyCounts: countByFixed(rows, SOURCE_STRATEGIES, (row) => row.recommendedSourceStrategy),
    positionFamilyCounts: countByFixed(rows, POSITION_FAMILIES, (row) => row.positionFamilyDiagnostic),
  };
  const sourceCoverageSummary = buildSourceCoverageSummary(rows);
  const positionFamilyDiagnostics = {
    nameTeamOverlapsWithIncompatiblePosition: rows.filter((row) =>
      row.sourceRowMatchCandidates.currentRoster.concat(row.sourceRowMatchCandidates.rookieTeam).some((candidate) =>
        candidate.matchKind === "name_team" && candidate.positionFamilyDiagnostic === "position_family_incompatible"
      )
    ).length,
    nameTeamOverlapsWithCompatiblePositionFamily: rows.filter((row) =>
      row.sourceRowMatchCandidates.currentRoster.concat(row.sourceRowMatchCandidates.rookieTeam).some((candidate) =>
        candidate.matchKind === "name_team"
        && ["returner_family_compatible", "edge_family_compatible", "db_family_compatible"].includes(candidate.positionFamilyDiagnostic)
      )
    ).length,
    namePositionOverlapsWithTeamMismatch: rows.filter((row) =>
      row.sourceRowMatchCandidates.currentRoster.concat(row.sourceRowMatchCandidates.rookieTeam).some((candidate) => candidate.matchKind === "name_position_team_mismatch")
    ).length,
  };
  const h21ImpactSummary = {
    rowsBySourceStrategy: summary.sourceStrategyCounts,
    v82SafeRowsBySourceStrategy: countByFixed(rows.filter((row) => row.v82SafeSubsetStatus === "v82_safe_subset"), SOURCE_STRATEGIES, (row) => row.recommendedSourceStrategy),
    sourceStrategyBlocksV82ControlledReview: false,
    note: "H23 is source-selection diagnostics only; no source strategy changes H21 or v8.2 behavior.",
  };
  const safetyGates = buildSafetyGates(input, rows);
  const recommendation = recommendationFor(safetyGates);
  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? {
      rookieTeamConfirmation: "in-memory",
      policyPacket: "in-memory",
      rosterRefresh: "in-memory",
      currentRosterConfirmation: "in-memory",
      preseasonProjectionSnapshot: "in-memory",
      currentRosterSource: input.currentRosterSource ? "in-memory" : null,
      rookieTeamConfirmationSource: input.rookieTeamConfirmationSource ? "in-memory" : null,
    },
    summary,
    sourceCoverageSummary,
    positionFamilyDiagnostics,
    h21ImpactSummary,
    examples: {
      topRowsByProjectionImpact: topRows(rows, 50),
      topV82SafeSubsetRows: topRows(rows.filter((row) => row.v82SafeSubsetStatus === "v82_safe_subset"), 50),
      topRowsWithNoSourceOverlap: topRows(rows.filter((row) => allCandidates(row).length === 0), 50),
      topRowsWithNameOverlapPositionMismatch: topRows(rows.filter((row) => allCandidates(row).some((candidate) => candidate.positionFamilyDiagnostic === "position_family_incompatible" || candidate.positionFamilyDiagnostic === "te_ls_incompatible_without_review")), 50),
      topIdpEdgeFamilyMismatchCandidates: topRows(rows.filter((row) => row.positionFamilyDiagnostic === "edge_family_compatible"), 50),
      topSpecialTeamsPositionMismatchCandidates: topRows(rows.filter((row) => row.positionFamilyDiagnostic === "returner_family_compatible" || row.positionFamilyDiagnostic === "te_ls_incompatible_without_review"), 50),
    },
    rows,
    safetyGates,
    recommendation,
    notes: [
      "H23 is a dry-run/read-only diagnostics and source-strategy report.",
      "Position-family compatibility is review evidence only and does not confirm identity.",
      "No live projections, rank, suggestions, War Room scoring, Supabase tables, or v8.2 selection are mutated.",
    ],
  };
}

export function writeProjectionRookieNewTargetDiagnosticsArtifacts(report: ProjectionRookieNewTargetDiagnosticsReport): ProjectionRookieNewTargetDiagnosticsArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-rookie-new-target-diagnostics-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  const csvPath = path.join(OUTPUT_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function buildLookups(input: ProjectionRookieNewTargetDiagnosticsInput, snapshotRows: PreseasonProjectionSnapshotRow[]) {
  const currentRows = input.currentRosterSource?.rows ?? [];
  const rookieRows = input.rookieTeamConfirmationSource?.rows ?? [];
  return {
    snapshotsByPlayerId: mapFirst(snapshotRows.flatMap((row) => [
      row.sleeperId ? [row.sleeperId, row] as const : null,
      row.gsisId ? [row.gsisId, row] as const : null,
      [namePositionKey(normalizeProjectionRookieName(row.playerName), row.position), row] as const,
    ].filter(Boolean) as Array<readonly [string, PreseasonProjectionSnapshotRow]>)),
    currentByName: groupBy(currentRows, (row) => normalizeProjectionRookieName(row.playerName)),
    currentByNameTeam: groupBy(currentRows.filter((row) => row.team), (row) => nameTeamKey(normalizeProjectionRookieName(row.playerName), row.team ?? "")),
    currentByNamePosition: groupBy(currentRows, (row) => namePositionKey(normalizeProjectionRookieName(row.playerName), row.position)),
    currentByNamePositionTeam: groupBy(currentRows.filter((row) => row.team), (row) => namePositionTeamKey(normalizeProjectionRookieName(row.playerName), row.position, row.team ?? "")),
    rookieByName: groupBy(rookieRows, (row) => normalizeProjectionRookieName(row.playerName)),
    rookieByNameTeam: groupBy(rookieRows.filter((row) => row.nflTeam), (row) => nameTeamKey(normalizeProjectionRookieName(row.playerName), row.nflTeam ?? "")),
    rookieByNamePosition: groupBy(rookieRows, (row) => namePositionKey(normalizeProjectionRookieName(row.playerName), row.position)),
    rookieByNamePositionTeam: groupBy(rookieRows.filter((row) => row.nflTeam), (row) => namePositionTeamKey(normalizeProjectionRookieName(row.playerName), row.position, row.nflTeam ?? "")),
    currentConfirmationByPlayerId: mapFirst(input.currentRosterConfirmation.rows.map((row) => [row.playerId, row] as const)),
    rookieConfirmationByPlayerId: mapFirst(input.rookieTeamConfirmation.rows.map((row) => [row.playerId, row] as const)),
  };
}

function buildTargetRow(row: ProjectionActiveUniversePolicyPacketRow, lookups: ReturnType<typeof buildLookups>): ProjectionRookieNewTargetDiagnosticsRow {
  const normalizedName = normalizeProjectionRookieName(row.player);
  const snapshot = lookups.snapshotsByPlayerId.get(row.playerId) ?? lookups.snapshotsByPlayerId.get(namePositionKey(normalizedName, row.position));
  const currentRosterCandidates = candidateRows("current_roster", row, [
    ...(lookups.currentByNamePositionTeam.get(namePositionTeamKey(normalizedName, row.position, row.projectionTeam ?? "")) ?? []),
    ...(lookups.currentByNameTeam.get(nameTeamKey(normalizedName, row.projectionTeam ?? "")) ?? []),
    ...(lookups.currentByNamePosition.get(namePositionKey(normalizedName, row.position)) ?? []),
    ...(lookups.currentByName.get(normalizedName) ?? []),
  ]);
  const rookieCandidates = candidateRows("rookie_team_confirmation", row, [
    ...(lookups.rookieByNamePositionTeam.get(namePositionTeamKey(normalizedName, row.position, row.projectionTeam ?? "")) ?? []),
    ...(lookups.rookieByNameTeam.get(nameTeamKey(normalizedName, row.projectionTeam ?? "")) ?? []),
    ...(lookups.rookieByNamePosition.get(namePositionKey(normalizedName, row.position)) ?? []),
    ...(lookups.rookieByName.get(normalizedName) ?? []),
  ]);
  const uniqueCurrentCandidates = uniqueCandidates(currentRosterCandidates);
  const uniqueRookieCandidates = uniqueCandidates(rookieCandidates);
  const currentConfirmation = lookups.currentConfirmationByPlayerId.get(row.playerId);
  const rookieConfirmation = lookups.rookieConfirmationByPlayerId.get(row.playerId);
  const reasonCodes = reasonCodesFor(row, snapshot, uniqueCurrentCandidates, uniqueRookieCandidates, currentConfirmation, rookieConfirmation);
  const positionFamilyDiagnostic = strongestPositionDiagnostic(uniqueCurrentCandidates.concat(uniqueRookieCandidates));
  const targetIdentityClass = identityClassFor(row, snapshot, uniqueCurrentCandidates, uniqueRookieCandidates, positionFamilyDiagnostic, currentConfirmation, rookieConfirmation);
  const recommendedSourceStrategy = sourceStrategyFor(targetIdentityClass, snapshot, uniqueCurrentCandidates, uniqueRookieCandidates, currentConfirmation, rookieConfirmation);
  return {
    playerId: row.playerId,
    sleeperId: snapshot?.sleeperId ?? row.playerId,
    gsisId: snapshot?.gsisId ?? null,
    player: row.player,
    normalizedName,
    position: row.position,
    team: row.projectionTeam,
    sourceRowMatchCandidates: {
      currentRoster: uniqueCurrentCandidates.slice(0, 10),
      rookieTeam: uniqueRookieCandidates.slice(0, 10),
    },
    currentRosterMatchStatus: currentConfirmation?.confirmationStatus ?? "not_in_current_roster_confirmation",
    rookieConfirmationMatchStatus: rookieConfirmation?.rookieTeamStatus ?? "not_in_rookie_confirmation",
    h21PolicyGroup: row.policyGroup,
    v82SafeSubsetStatus: row.v82Path === "would_use_v8_2_safe_subset" ? "v82_safe_subset" : "not_v82_safe_subset",
    reasonCodes,
    targetIdentityClass,
    recommendedSourceStrategy,
    positionFamilyDiagnostic,
    projectedTotalPointDelta: row.projectedTotalPointDelta,
    estimatedOverallRankMovement: row.estimatedOverallRankMovement,
  };
}

function candidateRows(source: "current_roster" | "rookie_team_confirmation", target: ProjectionActiveUniversePolicyPacketRow, rows: Array<CurrentRosterSourceRow | RookieTeamConfirmationSourceRow>): ProjectionRookieNewTargetSourceCandidate[] {
  return rows.map((row) => {
    const team = "team" in row ? row.team : row.nflTeam;
    const status = "status" in row ? row.status : null;
    return {
      source,
      playerId: row.playerId,
      sleeperId: row.sleeperId,
      gsisId: row.gsisId,
      playerName: row.playerName,
      normalizedName: normalizeProjectionRookieName(row.playerName),
      position: row.position,
      team,
      status,
      matchKind: matchKindFor(target, row.position, team),
      positionFamilyDiagnostic: positionFamilyDiagnostic(target.position, row.position),
    };
  });
}

function matchKindFor(target: ProjectionActiveUniversePolicyPacketRow, sourcePosition: string, sourceTeam: string | null) {
  const teamMatches = Boolean(target.projectionTeam && sourceTeam && target.projectionTeam === sourceTeam);
  const positionMatches = target.position === sourcePosition;
  if (teamMatches && positionMatches) return "name_position_team";
  if (teamMatches) return "name_team";
  if (positionMatches) return "name_position_team_mismatch";
  return "name_only";
}

export function positionFamilyDiagnostic(targetPosition: string, sourcePosition: string): ProjectionRookieNewTargetPositionFamilyDiagnostic {
  if (targetPosition === sourcePosition) return "position_family_exact";
  if (["WR", "KR", "PR"].includes(targetPosition) && ["WR", "KR", "PR"].includes(sourcePosition)) return "returner_family_compatible";
  if (["DL", "LB", "EDGE", "DE"].includes(targetPosition) && ["DL", "LB", "EDGE", "DE"].includes(sourcePosition)) return "edge_family_compatible";
  if (["DB", "S", "CB"].includes(targetPosition) && ["DB", "S", "CB"].includes(sourcePosition)) return "db_family_compatible";
  if ((targetPosition === "TE" && sourcePosition === "LS") || (targetPosition === "LS" && sourcePosition === "TE")) return "te_ls_incompatible_without_review";
  return "position_family_incompatible";
}

function strongestPositionDiagnostic(candidates: ProjectionRookieNewTargetSourceCandidate[]): ProjectionRookieNewTargetPositionFamilyDiagnostic {
  const order: ProjectionRookieNewTargetPositionFamilyDiagnostic[] = [
    "position_family_exact",
    "edge_family_compatible",
    "returner_family_compatible",
    "db_family_compatible",
    "te_ls_incompatible_without_review",
    "position_family_incompatible",
  ];
  return order.find((diagnostic) => candidates.some((candidate) => candidate.positionFamilyDiagnostic === diagnostic)) ?? "not_applicable";
}

function identityClassFor(
  row: ProjectionActiveUniversePolicyPacketRow,
  snapshot: PreseasonProjectionSnapshotRow | undefined,
  currentCandidates: ProjectionRookieNewTargetSourceCandidate[],
  rookieCandidates: ProjectionRookieNewTargetSourceCandidate[],
  positionDiagnostic: ProjectionRookieNewTargetPositionFamilyDiagnostic,
  currentConfirmation: ProjectionCurrentRosterConfirmationRow | undefined,
  rookieConfirmation: ProjectionRookieTeamConfirmationRow | undefined,
): ProjectionRookieNewTargetIdentityClass {
  const all = currentCandidates.concat(rookieCandidates);
  if (!row.player || !row.position || !row.projectionTeam) return "missing_identity_data";
  if (all.length > 1 && all.some((candidate) => candidate.matchKind === "name_only")) return "duplicate_or_alias_candidate";
  if (positionDiagnostic === "edge_family_compatible") return "idp_position_family_mismatch_candidate";
  if (positionDiagnostic === "returner_family_compatible" || positionDiagnostic === "te_ls_incompatible_without_review") return "special_teams_position_mismatch_candidate";
  if (rookieConfirmation?.rookieTeamStatus === "rookie_team_review_candidate" || all.some((candidate) => candidate.source === "rookie_team_confirmation")) return "true_rookie_candidate";
  if (currentConfirmation?.confirmationStatus === "roster_unmatched" && snapshot?.sleeperId && !snapshot.gsisId) return "sleeper_only_player";
  if (snapshot?.sleeperId && !snapshot.gsisId) return "sleeper_only_player";
  if (row.lastActiveSeason && row.lastActiveSeason < 2025) return "low_prior_veteran_or_unknown";
  if (!all.length) return "sleeper_only_player";
  return "source_strategy_unknown";
}

function sourceStrategyFor(
  identityClass: ProjectionRookieNewTargetIdentityClass,
  snapshot: PreseasonProjectionSnapshotRow | undefined,
  currentCandidates: ProjectionRookieNewTargetSourceCandidate[],
  rookieCandidates: ProjectionRookieNewTargetSourceCandidate[],
  currentConfirmation: ProjectionCurrentRosterConfirmationRow | undefined,
  rookieConfirmation: ProjectionRookieTeamConfirmationRow | undefined,
): ProjectionRookieNewTargetSourceStrategy {
  if (identityClass === "idp_position_family_mismatch_candidate" || identityClass === "special_teams_position_mismatch_candidate") return "needs_position_family_review";
  if (rookieConfirmation?.rookieTeamStatus === "rookie_team_review_candidate" || rookieCandidates.length) return "use_manual_rookie_source";
  if (currentConfirmation?.confirmationStatus && currentConfirmation.confirmationStatus !== "roster_unmatched") return "use_current_roster_source";
  if (currentCandidates.length) return "use_current_roster_source";
  if (snapshot?.sleeperId && !snapshot.gsisId) return "use_sleeper_player_metadata";
  if (snapshot?.sleeperId && snapshot.gsisId) return "needs_id_crosswalk";
  if (identityClass === "true_rookie_candidate") return "use_draft_results_source";
  if (identityClass === "low_prior_veteran_or_unknown") return "use_transaction_status_source";
  return "use_sleeper_player_metadata";
}

function reasonCodesFor(
  row: ProjectionActiveUniversePolicyPacketRow,
  snapshot: PreseasonProjectionSnapshotRow | undefined,
  currentCandidates: ProjectionRookieNewTargetSourceCandidate[],
  rookieCandidates: ProjectionRookieNewTargetSourceCandidate[],
  currentConfirmation: ProjectionCurrentRosterConfirmationRow | undefined,
  rookieConfirmation: ProjectionRookieTeamConfirmationRow | undefined,
) {
  const codes = new Set<string>(["h21_rookie_new_unmatched"]);
  if (row.v82Path === "would_use_v8_2_safe_subset") codes.add("v8_2_safe_subset");
  if (snapshot?.sleeperId) codes.add("snapshot_sleeper_id_present");
  if (snapshot?.gsisId) codes.add("snapshot_gsis_id_present");
  if (!snapshot?.gsisId) codes.add("missing_gsis_crosswalk");
  if (currentCandidates.length) codes.add("current_roster_name_overlap");
  if (rookieCandidates.length) codes.add("rookie_source_name_overlap");
  if (currentConfirmation?.confirmationStatus) codes.add(`current_roster_confirmation:${currentConfirmation.confirmationStatus}`);
  if (rookieConfirmation?.rookieTeamStatus) codes.add(`rookie_confirmation:${rookieConfirmation.rookieTeamStatus}`);
  if (currentCandidates.concat(rookieCandidates).some((candidate) => candidate.positionFamilyDiagnostic !== "position_family_exact")) codes.add("position_family_review_needed");
  return [...codes];
}

function buildSourceCoverageSummary(rows: ProjectionRookieNewTargetDiagnosticsRow[]) {
  return {
    targetRowsWithSleeperIdOnly: rows.filter((row) => row.sleeperId && !row.gsisId).length,
    targetRowsWithGsisId: rows.filter((row) => row.gsisId).length,
    targetRowsWithBothSleeperAndGsis: rows.filter((row) => row.sleeperId && row.gsisId).length,
    targetRowsWithNoStableId: rows.filter((row) => !row.sleeperId && !row.gsisId).length,
    targetRowsFoundInCurrentRosterSource: rows.filter((row) => row.sourceRowMatchCandidates.currentRoster.length > 0).length,
    targetRowsFoundInRookieSource: rows.filter((row) => row.sourceRowMatchCandidates.rookieTeam.length > 0).length,
    targetRowsFoundByNameTeamOverlap: rows.filter((row) => allCandidates(row).some((candidate) => candidate.matchKind === "name_team" || candidate.matchKind === "name_position_team")).length,
    targetRowsRequiringSleeperMetadata: rows.filter((row) => row.recommendedSourceStrategy === "use_sleeper_player_metadata").length,
    targetRowsRequiringDraftResults: rows.filter((row) => row.recommendedSourceStrategy === "use_draft_results_source").length,
    targetRowsRequiringManualReview: rows.filter((row) => row.recommendedSourceStrategy === "needs_position_family_review" || row.recommendedSourceStrategy === "use_manual_rookie_source").length,
  };
}

function buildSafetyGates(input: ProjectionRookieNewTargetDiagnosticsInput, rows: ProjectionRookieNewTargetDiagnosticsRow[]) {
  return [
    gate("no_live_outputs_changed", true, "Report reads artifacts and writes only local H23 artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Blackbird Rank ordering is not imported, recalculated, or mutated."),
    gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported, recalculated, or mutated."),
    gate("war_room_scoring_unchanged", true, "War Room scoring behavior is not imported, recalculated, or mutated."),
    gate("v8_2_not_enabled", true, "v8.2 feature flag and projection selector behavior are not changed."),
    gate("only_rookie_new_unmatched_targeted", rows.every((row) => row.h21PolicyGroup === "unmatched_rookie_new_review"), `${rows.length} target rows evaluated.`),
    gate("all_target_rows_classified", rows.length === input.policyPacket.rows.filter((row) => row.policyGroup === "unmatched_rookie_new_review").length, `${rows.length} target rows classified.`),
  ];
}

function recommendationFor(safetyGates: ProjectionRookieNewTargetDiagnosticsReport["safetyGates"]): ProjectionRookieNewTargetDiagnosticsRecommendation {
  if (safetyGates.some((gateRow) => !gateRow.passed)) return "rookie_target_diagnostics_blocked";
  return "rookie_target_diagnostics_ready_for_source_selection";
}

function renderMarkdown(report: ProjectionRookieNewTargetDiagnosticsReport) {
  return `# Projection Rookie/New Target Diagnostics ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Recommendation: ${report.recommendation}

## Summary

\`\`\`json
${JSON.stringify(report.summary, null, 2)}
\`\`\`

## Source Coverage

\`\`\`json
${JSON.stringify(report.sourceCoverageSummary, null, 2)}
\`\`\`

## Position Family Diagnostics

\`\`\`json
${JSON.stringify(report.positionFamilyDiagnostics, null, 2)}
\`\`\`

## H21 / v8.2 Impact

\`\`\`json
${JSON.stringify(report.h21ImpactSummary, null, 2)}
\`\`\`

## Top Projection Impact Rows

${renderRows(report.examples.topRowsByProjectionImpact)}

## Top v8.2 Safe Rows

${renderRows(report.examples.topV82SafeSubsetRows)}

## Rows With No Source Overlap

${renderRows(report.examples.topRowsWithNoSourceOverlap)}

## Name Overlap With Position Mismatch

${renderRows(report.examples.topRowsWithNameOverlapPositionMismatch)}

## Likely IDP Edge-Family Mismatch Candidates

${renderRows(report.examples.topIdpEdgeFamilyMismatchCandidates)}

## Special Teams Position Mismatch Candidates

${renderRows(report.examples.topSpecialTeamsPositionMismatchCandidates)}

## Safety Gates

${renderGateTable(report.safetyGates)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderRows(rows: ProjectionRookieNewTargetDiagnosticsRow[]) {
  if (!rows.length) return "No rows.";
  return [
    "| Player | Pos | Team | Class | Strategy | Current | Rookie | v8.2 | Reasons |",
    "|---|---|---|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.player} | ${row.position} | ${row.team ?? ""} | ${row.targetIdentityClass} | ${row.recommendedSourceStrategy} | ${row.currentRosterMatchStatus} | ${row.rookieConfirmationMatchStatus} | ${row.v82SafeSubsetStatus} | ${row.reasonCodes.slice(0, 4).join(" ")} |`),
  ].join("\n");
}

function renderGateTable(gates: ProjectionRookieNewTargetDiagnosticsReport["safetyGates"]) {
  return [
    "| Gate | Status | Detail |",
    "|---|---|---|",
    ...gates.map((gateRow) => `| ${gateRow.name} | ${gateRow.passed ? "PASS" : "FAIL"} | ${gateRow.detail} |`),
  ].join("\n");
}

function renderCsv(report: ProjectionRookieNewTargetDiagnosticsReport) {
  const headers = ["player_id", "sleeper_id", "gsis_id", "player", "normalized_name", "position", "team", "identity_class", "source_strategy", "position_family_diagnostic", "current_roster_status", "rookie_confirmation_status", "v82_safe_subset", "reason_codes"];
  return [headers, ...report.rows.map((row) => [
    row.playerId,
    row.sleeperId ?? "",
    row.gsisId ?? "",
    row.player,
    row.normalizedName,
    row.position,
    row.team ?? "",
    row.targetIdentityClass,
    row.recommendedSourceStrategy,
    row.positionFamilyDiagnostic,
    row.currentRosterMatchStatus,
    row.rookieConfirmationMatchStatus,
    row.v82SafeSubsetStatus,
    row.reasonCodes.join("|"),
  ])].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function topRows(rows: ProjectionRookieNewTargetDiagnosticsRow[], limit: number) {
  return [...rows].sort((a, b) =>
    Math.abs(b.projectedTotalPointDelta ?? 0) - Math.abs(a.projectedTotalPointDelta ?? 0)
    || Math.abs(b.estimatedOverallRankMovement ?? 0) - Math.abs(a.estimatedOverallRankMovement ?? 0)
    || a.player.localeCompare(b.player)
  ).slice(0, limit);
}

function allCandidates(row: ProjectionRookieNewTargetDiagnosticsRow) {
  return row.sourceRowMatchCandidates.currentRoster.concat(row.sourceRowMatchCandidates.rookieTeam);
}

function uniqueCandidates(candidates: ProjectionRookieNewTargetSourceCandidate[]) {
  return [...new Map(candidates.map((candidate) => [`${candidate.source}:${candidate.playerId ?? ""}:${candidate.playerName}:${candidate.position}:${candidate.team ?? ""}:${candidate.matchKind}`, candidate])).values()];
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

function namePositionKey(normalizedName: string, position: string) {
  return `${normalizedName}|${position}`;
}

function nameTeamKey(normalizedName: string, team: string) {
  return `${normalizedName}|${team}`;
}

function namePositionTeamKey(normalizedName: string, position: string, team: string) {
  return `${normalizedName}|${position}|${team}`;
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
