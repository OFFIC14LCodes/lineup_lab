import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildBlackbirdBoard } from "@/lib/draft/blackbird-board";
import { buildProjectionCoverageAudit, type ProjectionCoverageAudit } from "@/lib/draft/projection-coverage";
import type { H10LeagueValueRow } from "@/lib/projections/h10-league-value";
import { getDraftRoomState } from "@/lib/rosterforge/state";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections");

loadLocalEnv();

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const artifact = blockedArtifact(message);
  writeArtifacts(artifact);
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  process.env.ENABLE_H10_WAR_ROOM_OVERLAY = process.env.ENABLE_H10_WAR_ROOM_OVERLAY ?? "true";
  process.env.ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_PREVIEW = process.env.ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_PREVIEW ?? "true";
  process.env.ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_EXPERIMENT = process.env.ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_EXPERIMENT ?? "true";

  const userId = process.env.BLACKBIRD_E2E_AUTH_USER_ID ?? process.env.SCORING_VALIDATION_OPERATOR_USER_ID;
  if (!userId) throw new Error("Missing BLACKBIRD_E2E_AUTH_USER_ID or SCORING_VALIDATION_OPERATOR_USER_ID.");
  const draftRoomId = process.argv.find((arg) => arg.startsWith("--draft-room-id="))?.split("=")[1] ?? selectDraftRoomId();
  if (!draftRoomId) throw new Error("No draft room found for H11 projection coverage.");

  const state = await getDraftRoomState(userId, draftRoomId);
  const league = recordOrNull(state.league);
  const leagueId = String(recordOrNull(state.room)?.league_id ?? "");
  const board = buildBlackbirdBoard({
    players: state.remainingPlayers,
    overlays: (state as { h10ValueOverlay?: Parameters<typeof buildBlackbirdBoard>[0]["overlays"] }).h10ValueOverlay,
    recommendations: state.h10RecommendationPreview,
    draftedPlayerIds: state.draftedPlayerIds.filter((id): id is string => typeof id === "string"),
  });
  const projectionRows = loadH10ValueRows().filter((row) => row.leagueId === leagueId);
  const audit = buildProjectionCoverageAudit({
    draftRoomId,
    leagueId,
    scoringSettings: recordOrNull(league?.scoring_settings_json),
    rosterPositions: Array.isArray(league?.roster_positions_json) ? league.roster_positions_json.filter((slot): slot is string => typeof slot === "string") : [],
    rosterRequirements: state.rosterRequirements,
    projectionRows,
    availablePlayers: state.remainingPlayers,
    boardRows: board.rows,
    recommendationRows: state.h10RecommendationPreview,
  });
  writeArtifacts(audit);
  console.log(JSON.stringify({ verdict: audit.verdict, artifact: "artifacts/projections/h11-projection-coverage.json" }, null, 2));
  if (audit.verdict !== "passed") process.exitCode = 1;
}

function loadH10ValueRows(): H10LeagueValueRow[] {
  const artifactPath = path.join(OUTPUT_DIR, "h10-league-value.json");
  if (!existsSync(artifactPath)) return [];
  const parsed = JSON.parse(readFileSync(artifactPath, "utf8")) as { rows?: H10LeagueValueRow[] } | H10LeagueValueRow[];
  return Array.isArray(parsed) ? parsed : parsed.rows ?? [];
}

function selectDraftRoomId(): string | null {
  const artifactPath = path.join(OUTPUT_DIR, "h10-war-room-recommendation-validation.json");
  if (!existsSync(artifactPath)) return null;
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { roomInventory?: Array<{ draftRoomId: string; isSuperflex?: boolean; hasIDP?: boolean }> };
  return artifact.roomInventory?.find((room) => room.isSuperflex || room.hasIDP)?.draftRoomId ?? artifact.roomInventory?.[0]?.draftRoomId ?? null;
}

function writeArtifacts(artifact: ProjectionCoverageAudit) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(path.join(OUTPUT_DIR, "h11-projection-coverage.json"), JSON.stringify(artifact, null, 2));
  writeFileSync(path.join(OUTPUT_DIR, "h11-projection-coverage.md"), renderMarkdown(artifact));
}

function renderMarkdown(artifact: ProjectionCoverageAudit): string {
  return [
    "# H11.3.1 Projection Coverage",
    "",
    `Verdict: ${artifact.verdict}`,
    `Draft room: ${artifact.draftRoomId}`,
    `League: ${artifact.leagueId}`,
    `Scoring fingerprint: ${artifact.scoringFingerprint}`,
    `Roster positions: ${artifact.rosterPositions.join(", ") || "none"}`,
    `Enabled positions: ${artifact.enabledPositions.join(", ") || "none"}`,
    "",
    "## Counts",
    "",
    `- Total projection rows: ${artifact.totalProjectionRows}`,
    `- Projection rows by position: ${JSON.stringify(artifact.projectionRowsByPosition)}`,
    `- Available players by position: ${JSON.stringify(artifact.availablePlayersByPosition)}`,
    `- Board rows by position: ${JSON.stringify(artifact.boardRowsByPosition)}`,
    `- Recommendation rows by position: ${JSON.stringify(artifact.recommendationRowsByPosition)}`,
    `- Provider count distribution: ${JSON.stringify(artifact.providerCountDistribution)}`,
    "",
    "## Flags",
    "",
    `- Missing projection positions: ${artifact.missingProjectionPositions.join(", ") || "none"}`,
    `- Suspicious low projection count: ${artifact.suspiciousLowProjectionCount}`,
    `- Suspicious single-position only: ${artifact.suspiciousSinglePositionOnly}`,
    `- Failure reasons: ${artifact.failureReasons.join("; ") || "none"}`,
    "",
  ].join("\n");
}

function blockedArtifact(message: string): ProjectionCoverageAudit {
  return {
    draftRoomId: "unknown",
    leagueId: "unknown",
    scoringFingerprint: "blocked",
    rosterPositions: [],
    enabledPositions: [],
    projectionRunIdsUsed: [],
    totalProjectionRows: 0,
    projectionRowsByPosition: {},
    availablePlayersByPosition: {},
    boardRowsByPosition: {},
    recommendationRowsByPosition: {},
    missingProjectionPositions: [],
    excludedPositionsWithReason: [],
    suspiciousLowProjectionCount: 0,
    suspiciousSinglePositionOnly: false,
    providerCountDistribution: {},
    failureReasons: [message],
    verdict: "failed",
  };
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}
