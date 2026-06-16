import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import Papa from "papaparse";

import { normalizeIdentityName } from "./identity-normalization";
import { buildPlayerIdentityDiagnostics, type MatchExample, type PlayerIdentityDiagnosticsReport } from "./identity-diagnostics";
import type { IdentityReviewQueue, IdentityReviewQueueRow, IdentityReviewRecommendedAction, IdentityReviewPriority } from "./identity-review-types";

export const PLAYER_IDENTITY_REVIEW_ARTIFACTS = {
  summary: "player-identity-review-summary.md",
  activeUnmatchedCsv: "player-identity-review-active-unmatched.csv",
  activeConflictsCsv: "player-identity-review-active-conflicts.csv",
  activeUnmatchedJson: "player-identity-review-active-unmatched.json",
  activeConflictsJson: "player-identity-review-active-conflicts.json",
} as const;

export function buildIdentityReviewQueue(report: PlayerIdentityDiagnosticsReport = buildPlayerIdentityDiagnostics()): IdentityReviewQueue {
  const activeUnmatched = report.topUnresolvedActiveFantasyRelevant.map((match) => reviewRow(match, "unmatched"));
  const activeConflicts = report.topConflicts
    .filter((match) => match.confidence === "conflict")
    .map((match) => reviewRow(match, "conflict"));
  const allRows = [...activeUnmatched, ...activeConflicts];

  return {
    generatedAt: new Date().toISOString(),
    activeUnmatched,
    activeConflicts,
    summary: {
      activeUnmatchedRows: activeUnmatched.length,
      activeConflictRows: activeConflicts.length,
      byPriority: countBy(allRows.map((row) => row.reviewPriority)),
      byPosition: countBy(allRows.map((row) => row.normalizedPosition ?? "unknown")),
      byTeam: countBy(allRows.map((row) => row.team ?? "FA")),
      byRecommendedAction: countBy(allRows.map((row) => row.recommendedAction)),
      byConflictReason: countReasons(activeConflicts.flatMap((row) => row.conflictReasons)),
      byUnmatchedReason: countReasons(activeUnmatched.flatMap((row) => row.matchReasons.length ? row.matchReasons : ["no candidate"])),
    },
  };
}

export function writeIdentityReviewArtifacts(queue: IdentityReviewQueue, outputDir = path.join(process.cwd(), "artifacts", "projections")) {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, PLAYER_IDENTITY_REVIEW_ARTIFACTS.activeUnmatchedJson), `${JSON.stringify(queue.activeUnmatched, null, 2)}\n`, "utf8");
  writeFileSync(path.join(outputDir, PLAYER_IDENTITY_REVIEW_ARTIFACTS.activeConflictsJson), `${JSON.stringify(queue.activeConflicts, null, 2)}\n`, "utf8");
  writeFileSync(path.join(outputDir, PLAYER_IDENTITY_REVIEW_ARTIFACTS.activeUnmatchedCsv), rowsToCsv(queue.activeUnmatched), "utf8");
  writeFileSync(path.join(outputDir, PLAYER_IDENTITY_REVIEW_ARTIFACTS.activeConflictsCsv), rowsToCsv(queue.activeConflicts), "utf8");
  writeFileSync(path.join(outputDir, PLAYER_IDENTITY_REVIEW_ARTIFACTS.summary), renderSummary(queue), "utf8");
}

export function reviewRow(match: MatchExample, kind: "unmatched" | "conflict"): IdentityReviewQueueRow {
  const recommendedAction = recommendedActionFor(match, kind);
  return {
    sourcePlayerId: match.sourcePlayerId,
    sleeperId: match.preservedIds.sleeperId,
    blackbirdPlayerId: match.preservedIds.blackbirdPlayerId,
    playerName: match.sourcePlayerName,
    normalizedName: normalizeIdentityName(match.sourcePlayerName),
    position: match.sourcePosition,
    normalizedPosition: match.sourcePosition,
    team: match.sourceTeam,
    status: match.sourceStatus,
    active: match.sourceActive,
    searchRank: match.sourceSearchRank,
    yearsExperience: match.sourceYearsExperience,
    college: match.sourceCollege,
    age: match.sourceAge,
    birthDate: match.sourceBirthDate,
    height: match.sourceHeight,
    weight: match.sourceWeight,
    candidateNflversePlayerIds: match.candidateExamples.map((candidate) => candidate.playerId),
    candidateNames: match.candidateExamples.map((candidate) => candidate.playerName),
    candidateTeams: match.candidateExamples.map((candidate) => candidate.team),
    candidatePositions: match.candidateExamples.map((candidate) => candidate.position),
    matchConfidence: match.confidence,
    matchReasons: match.matchReasons,
    conflictReasons: match.conflictReasons,
    recommendedAction,
    reviewPriority: priorityFor(match, recommendedAction),
  };
}

function priorityFor(match: MatchExample, action: IdentityReviewRecommendedAction): IdentityReviewPriority {
  if (action === "likely_safe_ignore") return "P4";
  if (match.sourceActive !== true) return "P4";
  if (typeof match.sourceSearchRank === "number" && match.sourceSearchRank <= 999 && match.sourceTeam) return "P1";
  if (match.sourceTeam && (match.preservedIds.sleeperId || match.preservedIds.blackbirdPlayerId)) return "P1";
  if (match.sourceTeam) return "P2";
  return "P3";
}

function recommendedActionFor(match: MatchExample, kind: "unmatched" | "conflict"): IdentityReviewRecommendedAction {
  if (!match.sourcePosition || match.sourcePosition === "DST") return "unsupported_position";
  if (kind === "conflict") {
    if (match.conflictReasons.some((reason) => reason.toLowerCase().includes("duplicate"))) return "possible_duplicate";
    return "needs_manual_override";
  }
  if (match.candidateCount === 0) return "provider_missing_id";
  if (match.matchReasons.some((reason) => reason.includes("position mismatch") || reason.includes("team mismatch"))) return "improve_normalization";
  return "manual_review_required";
}

function rowsToCsv(rows: IdentityReviewQueueRow[]): string {
  return Papa.unparse(rows.map((row) => ({
    ...row,
    candidateNflversePlayerIds: row.candidateNflversePlayerIds.join("|"),
    candidateNames: row.candidateNames.join("|"),
    candidateTeams: row.candidateTeams.map((value) => value ?? "").join("|"),
    candidatePositions: row.candidatePositions.map((value) => value ?? "").join("|"),
    matchReasons: row.matchReasons.join("|"),
    conflictReasons: row.conflictReasons.join("|"),
  }))) + "\n";
}

function renderSummary(queue: IdentityReviewQueue): string {
  return [
    "# Player Identity Review Queue",
    "",
    `Generated: ${queue.generatedAt}`,
    "",
    "Dry-run only. No Supabase writes were performed.",
    "",
    `Active unmatched rows: ${queue.summary.activeUnmatchedRows}`,
    `Active conflict rows: ${queue.summary.activeConflictRows}`,
    "",
    "## By Priority",
    renderCounts(queue.summary.byPriority),
    "",
    "## By Recommended Action",
    renderCounts(queue.summary.byRecommendedAction),
    "",
    "## By Position",
    renderCounts(queue.summary.byPosition),
    "",
    "## By Team",
    renderCounts(queue.summary.byTeam),
    "",
    "## Conflict Reasons",
    renderCounts(queue.summary.byConflictReason),
    "",
    "## Unmatched Reasons",
    renderCounts(queue.summary.byUnmatchedReason),
    "",
  ].join("\n");
}

function renderCounts(counts: Record<string, number>): string {
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return rows.length ? rows.map(([key, count]) => `- ${key}: ${count}`).join("\n") : "- none";
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function countReasons(values: string[]): Record<string, number> {
  return countBy(values.map((value) => value || "unknown"));
}
