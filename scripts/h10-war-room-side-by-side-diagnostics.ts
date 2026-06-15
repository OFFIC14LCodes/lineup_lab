// H10.9 — Read-only legacy vs Blackbird War Room recommendation diagnostics.

import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import {
  buildH10WarRoomSideBySideDiagnostics,
  type H10SideBySideDiagnosticsArtifact,
  type H10SideBySideRoomInput,
} from "@/lib/draft/war-room-side-by-side-diagnostics";
import { getBooleanEnv } from "@/lib/env";

type ValidationArtifact = {
  roomInventory?: Array<{
    source: string;
    draftRoomId: string;
    leagueId: string;
    leagueName: string | null;
  }>;
  roomResults?: H10SideBySideRoomInput[];
};

loadLocalEnv();

function main() {
  const validationArtifact = loadValidationArtifact();
  const rooms = (validationArtifact.roomResults ?? [])
    .filter((room) => room.source === "live" || room.source === "validation_seed")
    .map((room) => ({
      ...room,
      warningCounts: room.warningCounts ?? {},
      rowsByTier: room.rowsByTier ?? {},
      rowsByStatus: room.rowsByStatus ?? {},
      legacyRecommendationTopRows: room.legacyRecommendationTopRows ?? [],
      topRecommendations: room.topRecommendations ?? [],
      legacyRowsChanged: Boolean(room.legacyRowsChanged),
      remainingPlayersOrderChanged: Boolean(room.remainingPlayersOrderChanged),
    }));

  const artifact = buildH10WarRoomSideBySideDiagnostics({
    generatedAt: new Date().toISOString(),
    featureFlags: {
      previewEnabled: getBooleanEnv("ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_PREVIEW", false),
      experimentEnabled: getBooleanEnv("ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_EXPERIMENT", false),
    },
    rooms,
  });
  const artifactPaths = writeArtifacts(artifact);

  console.log("\nH10.9 War Room Side-by-Side Diagnostics");
  console.log(JSON.stringify({
    roomsCompared: artifact.aggregate.roomsCompared,
    blackbirdEligibleRooms: artifact.aggregate.blackbirdEligibleRooms,
    overlapCount: artifact.aggregate.overlapCount,
    disagreementCount: artifact.aggregate.disagreementCount,
    disagreementCounts: artifact.aggregate.disagreementCounts,
    safetyAssertions: artifact.aggregate.safetyAssertions,
    disagreementIsFailure: artifact.aggregate.disagreementIsFailure,
    artifactPaths,
  }, null, 2));
}

function loadValidationArtifact(): ValidationArtifact {
  const artifactPath = path.join(process.cwd(), "artifacts", "projections", "h10-war-room-recommendation-validation.json");
  if (!existsSync(artifactPath)) {
    throw new Error("Missing H10 validation artifact. Run npm run validate:h10-war-room-recommendations -- --all first.");
  }
  return JSON.parse(readFileSync(artifactPath, "utf8")) as ValidationArtifact;
}

function writeArtifacts(artifact: H10SideBySideDiagnosticsArtifact) {
  const dir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(dir, { recursive: true });
  const jsonPath = path.join(dir, "h10-war-room-side-by-side-diagnostics.json");
  const markdownPath = path.join(dir, "h10-war-room-side-by-side-diagnostics.md");
  writeFileSync(jsonPath, JSON.stringify(artifact, null, 2));
  writeFileSync(markdownPath, renderMarkdown(artifact));
  return { jsonPath, markdownPath };
}

function renderMarkdown(artifact: H10SideBySideDiagnosticsArtifact): string {
  const lines = [
    "# H10.9 War Room Side-by-Side Diagnostics",
    "",
    `Generated: ${artifact.generatedAt}`,
    "",
    "## Feature Flags",
    "",
    `- ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_PREVIEW: ${artifact.featureFlags.previewEnabled}`,
    `- ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_EXPERIMENT: ${artifact.featureFlags.experimentEnabled}`,
    "",
    "## Aggregate",
    "",
    `- Rooms compared: ${artifact.aggregate.roomsCompared}`,
    `- Blackbird eligible rooms: ${artifact.aggregate.blackbirdEligibleRooms}`,
    `- Overlap count: ${artifact.aggregate.overlapCount}`,
    `- Disagreement count: ${artifact.aggregate.disagreementCount}`,
    `- Disagreement is failure: ${artifact.aggregate.disagreementIsFailure}`,
    `- Disagreement counts: ${JSON.stringify(artifact.aggregate.disagreementCounts)}`,
    `- Safety assertions: ${JSON.stringify(artifact.aggregate.safetyAssertions)}`,
    "",
    "## Rooms",
    "",
    ...artifact.rooms.flatMap((room) => [
      `### ${room.source}:${room.leagueName ?? room.leagueId}`,
      "",
      `- Draft room: ${room.draftRoomId}`,
      `- Blackbird eligible: ${room.blackbirdEligible}`,
      `- Failed gates: ${room.failedExperimentGates.join(", ") || "None"}`,
      `- Defaults changed: ${room.defaultsChanged}`,
      `- Legacy unchanged: ${room.legacyRecommendationsUnchanged}`,
      `- Remaining player order unchanged: ${room.remainingPlayerOrderUnchanged}`,
      `- Overlap: ${room.overlapCount}`,
      `- Disagreements: ${room.disagreementCount}`,
      `- Disagreement counts: ${JSON.stringify(room.disagreementCounts)}`,
      `- Warning counts: ${JSON.stringify(room.warningCounts)}`,
      `- Top legacy rows: ${room.topLegacyRows.slice(0, 5).map((row) => `${row.player_name ?? "unknown"} ${row.position ?? ""} ${row.draftTargetScore ?? ""}`).join("; ") || "None"}`,
      `- Top Blackbird rows: ${room.topBlackbirdRows.slice(0, 5).map((row) => `${row.displayName} ${row.position ?? ""} ${row.recommendationTier} ${row.recommendationScore}`).join("; ") || "None"}`,
      `- Examples: ${room.examples.slice(0, 5).map((example) => `${example.classification}: ${example.legacyName ?? "-"} vs ${example.blackbirdName ?? "-"} (${example.position ?? "UNK"})`).join("; ") || "None"}`,
      "",
    ]),
  ];
  return `${lines.join("\n")}\n`;
}

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sep = trimmed.indexOf("=");
    if (sep === -1) continue;
    const key = trimmed.slice(0, sep).trim();
    if (!key || process.env[key]) continue;
    let value = trimmed.slice(sep + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

main();
