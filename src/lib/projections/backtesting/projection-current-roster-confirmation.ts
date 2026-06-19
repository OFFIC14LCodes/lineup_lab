import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { CurrentRosterSourceReport, CurrentRosterSourceRow } from "@/lib/data-acquisition/current-roster-source-types";
import type { PreseasonProjectionSnapshot, PreseasonProjectionSnapshotRow } from "./preseason-projection-snapshot-types";
import type { ProjectionActiveUniverseGateReport, ProjectionActiveUniverseGateRow } from "./projection-active-universe-gate-types";
import type {
  ProjectionCurrentRosterConfirmationArtifactPaths,
  ProjectionCurrentRosterConfirmationInput,
  ProjectionCurrentRosterConfirmationOptions,
  ProjectionCurrentRosterConfirmationReasonCode,
  ProjectionCurrentRosterConfirmationReport,
  ProjectionCurrentRosterConfirmationRow,
  ProjectionCurrentRosterConfirmationStatus,
} from "./projection-current-roster-confirmation-types";

const BACKTESTING_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const ROSTER_DIR = path.join(process.cwd(), "artifacts", "projections", "current-rosters");
const STATUSES: ProjectionCurrentRosterConfirmationStatus[] = [
  "roster_confirmed_active",
  "roster_confirmed_non_active",
  "roster_confirmed_free_agent",
  "roster_confirmed_ir_pup_nfi",
  "roster_unmatched",
  "roster_source_missing",
  "roster_conflict",
];

export function runProjectionCurrentRosterConfirmation(options: ProjectionCurrentRosterConfirmationOptions): ProjectionCurrentRosterConfirmationReport {
  const sourceArtifacts = {
    preseasonProjectionSnapshot: path.join(BACKTESTING_DIR, `preseason-projection-snapshot-${options.projectionSeason}.json`),
    activeUniverseGate: path.join(BACKTESTING_DIR, `projection-active-universe-gate-${options.projectionSeason}.json`),
    currentRosterSource: path.join(ROSTER_DIR, `current-rosters-${options.projectionSeason}.normalized.json`),
  };
  for (const artifactPath of [sourceArtifacts.preseasonProjectionSnapshot, sourceArtifacts.activeUniverseGate]) {
    if (!existsSync(artifactPath)) throw new Error(`Missing ${path.relative(process.cwd(), artifactPath)}.`);
  }
  const rosterSource = existsSync(sourceArtifacts.currentRosterSource)
    ? readJson<CurrentRosterSourceReport>(sourceArtifacts.currentRosterSource)
    : null;

  return buildProjectionCurrentRosterConfirmationFromData({
    options,
    preseasonProjectionSnapshot: readJson<PreseasonProjectionSnapshot>(sourceArtifacts.preseasonProjectionSnapshot),
    activeUniverseGate: readJson<ProjectionActiveUniverseGateReport>(sourceArtifacts.activeUniverseGate),
    currentRosterSource: rosterSource,
    sourceArtifacts: { ...sourceArtifacts, currentRosterSource: rosterSource ? sourceArtifacts.currentRosterSource : null },
  });
}

export function buildProjectionCurrentRosterConfirmationFromData(input: ProjectionCurrentRosterConfirmationInput): ProjectionCurrentRosterConfirmationReport {
  const snapshotBySleeperId = new Map(input.preseasonProjectionSnapshot.rows.map((row) => [row.sleeperId, row]).filter(([key]) => Boolean(key)) as Array<[string, PreseasonProjectionSnapshotRow]>);
  const rosterIndex = input.currentRosterSource ? buildRosterIndex(input.currentRosterSource.rows) : null;
  const rows = input.activeUniverseGate.rows.map((gateRow) => confirmationRow(gateRow, snapshotBySleeperId.get(gateRow.playerId) ?? null, rosterIndex));
  const summary = {
    totalProjectionRows: rows.length,
    rosterSourceRows: input.currentRosterSource?.rows.length ?? 0,
    matchedRows: rows.filter((row) => row.confirmationStatus !== "roster_unmatched" && row.confirmationStatus !== "roster_source_missing").length,
    unmatchedRows: rows.filter((row) => row.confirmationStatus === "roster_unmatched" || row.confirmationStatus === "roster_source_missing").length,
    confirmedActive: rows.filter((row) => row.confirmationStatus === "roster_confirmed_active").length,
    confirmedNonActive: rows.filter((row) => row.confirmationStatus === "roster_confirmed_non_active").length,
    confirmedFreeAgent: rows.filter((row) => row.confirmationStatus === "roster_confirmed_free_agent").length,
    confirmedIrPupNfi: rows.filter((row) => row.confirmationStatus === "roster_confirmed_ir_pup_nfi").length,
    conflicts: rows.filter((row) => row.confirmationStatus === "roster_conflict").length,
    byPosition: countNested(rows, (row) => row.position, (row) => row.confirmationStatus),
    byH16ActiveGateStatus: countNested(rows, (row) => row.activeGateStatus, (row) => row.confirmationStatus),
    byPromotionClassification: countNested(rows, (row) => row.promotionEligibilityClassification, (row) => row.confirmationStatus),
  };
  const h16IntegrationPreview = {
    activeConfirmedIncrease: rows.filter((row) => row.confirmationStatus === "roster_confirmed_active" && row.activeGateStatus !== "active_confirmed" && row.activeGateStatus !== "rookie_or_new_confirmed").length,
    activeConfirmedDecrease: rows.filter((row) => row.activeGateStatus === "active_confirmed" && row.confirmationStatus !== "roster_confirmed_active" && row.confirmationStatus !== "roster_source_missing" && row.confirmationStatus !== "roster_unmatched").length,
    staleStatusReviewResolved: rows.filter((row) => row.activeGateStatus === "stale_status_review" && row.confirmationStatus !== "roster_unmatched" && row.confirmationStatus !== "roster_source_missing").length,
    legacyArchiveBlockedConfirmed: rows.filter((row) => row.activeGateStatus === "legacy_archive_blocked" && (row.confirmationStatus === "roster_confirmed_non_active" || row.confirmationStatus === "roster_confirmed_free_agent")).length,
    manualReviewRequiredResolved: rows.filter((row) => row.activeGateStatus === "manual_review_required" && row.confirmationStatus !== "roster_unmatched" && row.confirmationStatus !== "roster_source_missing").length,
    kickerPolicyUnaffected: rows.filter((row) => row.activeGateStatus === "kicker_policy_review").length,
    note: "Preview only; H16 active-universe gate behavior is not changed.",
  };
  const safetyGates = [
    gate("no_live_outputs_changed", true, "Report reads artifacts and writes only local H17 artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Blackbird Rank ordering is not imported, recalculated, or mutated."),
    gate("draft_suggestions_unchanged", true, "Draft Suggestion ordering is not imported, recalculated, or mutated."),
    gate("war_room_scoring_unchanged", true, "War Room scoring behavior is not imported, recalculated, or mutated."),
    gate("v82_not_enabled", true, "v8.2 feature flag and projection selector behavior are not changed."),
  ];

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    sourceArtifacts: input.sourceArtifacts ?? {
      preseasonProjectionSnapshot: "in-memory",
      activeUniverseGate: "in-memory",
      currentRosterSource: input.currentRosterSource ? "in-memory" : null,
    },
    sourceStatus: input.currentRosterSource ? "present" : "missing",
    summary,
    h16IntegrationPreview,
    topExamples: {
      conflicts: topRows(rows.filter((row) => row.confirmationStatus === "roster_conflict")),
      unmatched: topRows(rows.filter((row) => row.confirmationStatus === "roster_unmatched" || row.confirmationStatus === "roster_source_missing")),
      confirmedActive: topRows(rows.filter((row) => row.confirmationStatus === "roster_confirmed_active")),
      confirmedNonActive: topRows(rows.filter((row) => row.confirmationStatus === "roster_confirmed_non_active" || row.confirmationStatus === "roster_confirmed_ir_pup_nfi")),
    },
    rows,
    safetyGates,
    notes: [
      "H17 current roster confirmation is dry-run/read-only.",
      input.currentRosterSource ? "A normalized current roster source artifact was applied for comparison." : "No normalized current roster source artifact was present; all projection rows are reported as roster_source_missing.",
      "No live projection, rank, suggestion, War Room, Supabase, or v8.2 behavior is changed.",
    ],
  };
}

export function writeProjectionCurrentRosterConfirmationArtifacts(report: ProjectionCurrentRosterConfirmationReport): ProjectionCurrentRosterConfirmationArtifactPaths {
  mkdirSync(BACKTESTING_DIR, { recursive: true });
  const base = `projection-current-roster-confirmation-${report.projectionSeason}`;
  const jsonPath = path.join(BACKTESTING_DIR, `${base}.json`);
  const markdownPath = path.join(BACKTESTING_DIR, `${base}.md`);
  const csvPath = path.join(BACKTESTING_DIR, `${base}.csv`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  writeFileSync(csvPath, renderCsv(report), "utf8");
  return { jsonPath, markdownPath, csvPath };
}

function confirmationRow(
  gateRow: ProjectionActiveUniverseGateRow,
  snapshotRow: PreseasonProjectionSnapshotRow | null,
  rosterIndex: RosterIndex | null,
): ProjectionCurrentRosterConfirmationRow {
  const identity = {
    playerId: gateRow.playerId,
    sleeperId: snapshotRow?.sleeperId ?? gateRow.playerId,
    gsisId: snapshotRow?.gsisId ?? null,
    normalizedName: snapshotRow?.normalizedName ?? normalizeName(gateRow.player),
    position: gateRow.position,
    team: gateRow.team,
  };
  if (!rosterIndex) return baseRow(gateRow, snapshotRow, null, "roster_source_missing", ["source_missing"]);

  const match = matchRoster(identity, rosterIndex);
  if (!match) return baseRow(gateRow, snapshotRow, null, "roster_unmatched", []);
  const codes: ProjectionCurrentRosterConfirmationReasonCode[] = [match.reason];
  if (match.row.team && identity.team && match.row.team !== identity.team) codes.push("team_conflicts_projection");
  else codes.push("team_matches_projection");
  if (match.row.status === "active" || match.row.status === "practice_squad") codes.push("status_active");
  else if (match.row.status === "free_agent") codes.push("status_free_agent");
  else if (match.row.status === "injured_reserve" || match.row.status === "pup" || match.row.status === "nfi") codes.push("status_ir_pup_nfi");
  else codes.push("status_non_active");
  if (isSourceStale(match.row.sourceUpdatedAt)) codes.push("source_stale");
  const status = confirmationStatus(match.row, codes);
  return baseRow(gateRow, snapshotRow, match.row, status, codes);
}

function baseRow(
  gateRow: ProjectionActiveUniverseGateRow,
  snapshotRow: PreseasonProjectionSnapshotRow | null,
  rosterRow: CurrentRosterSourceRow | null,
  confirmationStatus: ProjectionCurrentRosterConfirmationStatus,
  reasonCodes: ProjectionCurrentRosterConfirmationReasonCode[],
): ProjectionCurrentRosterConfirmationRow {
  return {
    playerId: gateRow.playerId,
    sleeperId: snapshotRow?.sleeperId ?? gateRow.playerId,
    gsisId: snapshotRow?.gsisId ?? null,
    player: gateRow.player,
    normalizedName: snapshotRow?.normalizedName ?? normalizeName(gateRow.player),
    position: gateRow.position,
    projectionTeam: gateRow.team,
    rosterTeam: rosterRow?.team ?? null,
    rosterStatus: rosterRow?.status ?? null,
    activeGateStatus: gateRow.gateStatus,
    promotionEligibilityClassification: gateRow.promotionEligibilityClassification,
    confirmationStatus,
    reasonCodes,
    matchedRosterSource: rosterRow?.source ?? null,
    sourceUpdatedAt: rosterRow?.sourceUpdatedAt ?? null,
  };
}

function confirmationStatus(row: CurrentRosterSourceRow, codes: ProjectionCurrentRosterConfirmationReasonCode[]): ProjectionCurrentRosterConfirmationStatus {
  if (codes.includes("team_conflicts_projection") && row.status !== "free_agent") return "roster_conflict";
  if (row.status === "active" || row.status === "practice_squad") return "roster_confirmed_active";
  if (row.status === "free_agent") return "roster_confirmed_free_agent";
  if (row.status === "injured_reserve" || row.status === "pup" || row.status === "nfi") return "roster_confirmed_ir_pup_nfi";
  return "roster_confirmed_non_active";
}

type MatchReason = Extract<ProjectionCurrentRosterConfirmationReasonCode, "matched_by_player_id" | "matched_by_sleeper_id" | "matched_by_gsis_id" | "matched_by_name_team_position">;
type RosterIndex = {
  byPlayerId: Map<string, CurrentRosterSourceRow>;
  bySleeperId: Map<string, CurrentRosterSourceRow>;
  byGsisId: Map<string, CurrentRosterSourceRow>;
  byNameTeamPosition: Map<string, CurrentRosterSourceRow>;
};

function buildRosterIndex(rows: CurrentRosterSourceRow[]): RosterIndex {
  return {
    byPlayerId: indexBy(rows, (row) => row.playerId),
    bySleeperId: indexBy(rows, (row) => row.sleeperId),
    byGsisId: indexBy(rows, (row) => row.gsisId),
    byNameTeamPosition: indexBy(rows, (row) => `${row.normalizedName}|${row.team ?? ""}|${row.position}`),
  };
}

function matchRoster(identity: { playerId: string; sleeperId: string | null; gsisId: string | null; normalizedName: string; position: string; team: string | null }, index: RosterIndex): { row: CurrentRosterSourceRow; reason: MatchReason } | null {
  const byPlayerId = index.byPlayerId.get(identity.playerId);
  if (byPlayerId) return { row: byPlayerId, reason: "matched_by_player_id" };
  if (identity.sleeperId) {
    const bySleeperId = index.bySleeperId.get(identity.sleeperId);
    if (bySleeperId) return { row: bySleeperId, reason: "matched_by_sleeper_id" };
  }
  if (identity.gsisId) {
    const byGsisId = index.byGsisId.get(identity.gsisId);
    if (byGsisId) return { row: byGsisId, reason: "matched_by_gsis_id" };
  }
  const fallback = index.byNameTeamPosition.get(`${identity.normalizedName}|${identity.team ?? ""}|${identity.position}`);
  return fallback ? { row: fallback, reason: "matched_by_name_team_position" } : null;
}

function indexBy(rows: CurrentRosterSourceRow[], keyFor: (row: CurrentRosterSourceRow) => string | null) {
  const map = new Map<string, CurrentRosterSourceRow>();
  for (const row of rows) {
    const key = keyFor(row);
    if (key && !map.has(key)) map.set(key, row);
  }
  return map;
}

function isSourceStale(value: string | null) {
  if (!value) return true;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return true;
  return parsed < Date.parse("2026-01-01T00:00:00.000Z");
}

function renderMarkdown(report: ProjectionCurrentRosterConfirmationReport) {
  return `# Projection Current Roster Confirmation ${report.projectionSeason}

Dry run: ${report.dryRun}
Read only: ${report.readOnly}
Source status: ${report.sourceStatus}

## Summary

\`\`\`json
${JSON.stringify(report.summary, null, 2)}
\`\`\`

## H16 Integration Preview

\`\`\`json
${JSON.stringify(report.h16IntegrationPreview, null, 2)}
\`\`\`

## Safety Gates

${renderGateTable(report.safetyGates)}
`;
}

function renderCsv(report: ProjectionCurrentRosterConfirmationReport) {
  const headers = ["player_id", "sleeper_id", "gsis_id", "player", "position", "projection_team", "roster_team", "roster_status", "active_gate_status", "promotion_classification", "confirmation_status", "reason_codes", "source", "source_updated_at"];
  const rows = report.rows.map((row) => [
    row.playerId,
    row.sleeperId ?? "",
    row.gsisId ?? "",
    row.player,
    row.position,
    row.projectionTeam ?? "",
    row.rosterTeam ?? "",
    row.rosterStatus ?? "",
    row.activeGateStatus,
    row.promotionEligibilityClassification,
    row.confirmationStatus,
    row.reasonCodes.join("|"),
    row.matchedRosterSource ?? "",
    row.sourceUpdatedAt ?? "",
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function topRows(rows: ProjectionCurrentRosterConfirmationRow[], limit = 50) {
  return [...rows].sort((a, b) => a.player.localeCompare(b.player)).slice(0, limit);
}

function countNested<Key extends string, Value extends string>(
  rows: ProjectionCurrentRosterConfirmationRow[],
  keyFor: (row: ProjectionCurrentRosterConfirmationRow) => Key,
  valueFor: (row: ProjectionCurrentRosterConfirmationRow) => Value,
) {
  const counts: Record<Key, Record<Value, number>> = {} as Record<Key, Record<Value, number>>;
  for (const row of rows) {
    const key = keyFor(row);
    const value = valueFor(row);
    counts[key] = counts[key] ?? Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<Value, number>;
    counts[key][value] = (counts[key][value] ?? 0) + 1;
  }
  return counts;
}

function renderGateTable(gates: ProjectionCurrentRosterConfirmationReport["safetyGates"]) {
  return [
    "| Gate | Status | Detail |",
    "|---|---|---|",
    ...gates.map((gateRow) => `| ${gateRow.name} | ${gateRow.passed ? "PASS" : "FAIL"} | ${gateRow.detail} |`),
  ].join("\n");
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function readJson<T>(artifactPath: string): T {
  return JSON.parse(readFileSync(artifactPath, "utf8")) as T;
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}
