import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  buildRecommendationQualityCalibrationArtifact,
  type RecommendationQualityRoomInput,
} from "@/lib/draft/recommendation-quality-calibration";
import type { WarRoomRecommendationRow } from "@/lib/draft/war-room-recommendations";
import type { H10WarRoomCompactRecommendation } from "@/lib/draft/war-room-recommendation-validation";

type ValidationArtifact = {
  roomResults?: Array<{
    source: "live" | "validation_seed" | "fixture";
    draftRoomId: string;
    leagueId: string;
    leagueName: string | null;
    topRecommendations?: H10WarRoomCompactRecommendation[];
    watchlistExamples?: H10WarRoomCompactRecommendation[];
  }>;
};

loadLocalEnv();

const validationArtifact = loadValidationArtifact();
const rooms = (validationArtifact.roomResults ?? [])
  .map((room): RecommendationQualityRoomInput => ({
    source: room.source,
    draftRoomId: room.draftRoomId,
    leagueId: room.leagueId,
    leagueName: room.leagueName,
    rows: [...(room.topRecommendations ?? []), ...(room.watchlistExamples ?? [])]
      .filter(uniqueRecommendation)
      .map((row) => inflateRow(room.leagueId, room.draftRoomId, row)),
  }))
  .filter((room) => room.rows.length > 0);

const artifact = buildRecommendationQualityCalibrationArtifact({
  generatedAt: new Date().toISOString(),
  rooms,
});
const artifactPaths = writeArtifacts(artifact);

console.log(JSON.stringify({
  roomsEvaluated: artifact.aggregate.roomsEvaluated,
  rowsAudited: artifact.aggregate.rowsAudited,
  verdict: artifact.aggregate.verdict,
  dominantComponentCounts: artifact.aggregate.dominantComponentCounts,
  confidenceRiskFindingCount: artifact.aggregate.confidenceRiskFindingCount,
  specialTeamsCautionFindingCount: artifact.aggregate.specialTeamsCautionFindingCount,
  idpCautionFindingCount: artifact.aggregate.idpCautionFindingCount,
  stabilityFindingCount: artifact.aggregate.stabilityFindingCount,
  safetyFindingCount: artifact.aggregate.safetyFindingCount,
  artifactPaths,
}, null, 2));

if (artifact.aggregate.verdict !== "ready") {
  process.exitCode = 1;
}

function inflateRow(leagueId: string, draftRoomId: string, row: H10WarRoomCompactRecommendation): WarRoomRecommendationRow {
  const maybeRow = row as Partial<H10WarRoomCompactRecommendation>;
  return {
    leagueId,
    draftRoomId,
    entityId: null,
    entityType: row.position === "DEF" ? "TEAM_DEFENSE" : "PLAYER",
    displayName: row.displayName,
    team: row.team,
    position: row.position,
    recommendationRank: row.recommendationRank,
    recommendationTier: row.recommendationTier as WarRoomRecommendationRow["recommendationTier"],
    recommendationScore: row.recommendationScore,
    scoreComponents: row.scoreComponents,
    primaryReason: row.primaryReason,
    explanationFragments: row.explanationFragments ?? [row.primaryReason],
    reasonCodes: row.reasonCodes,
    warningCodes: row.warningCodes,
    h10: maybeRow.h10 ?? {
      medianPoints: null,
      pointsAboveReplacement: null,
      riskAdjustedValue: null,
      tier: null,
      marketValueSignal: null,
      confidenceLabel: null,
      valueReadiness: null,
    },
    draftContext: maybeRow.draftContext ?? {
      currentRound: null,
      currentPick: null,
      picksUntilNextUserPick: null,
      positionNeedLevel: null,
      starterSlotNeed: false,
      benchDepthNeed: false,
      tierDropBeforeNextPick: null,
    },
    rosterNeedStatus: maybeRow.rosterNeedStatus ?? "filled",
    needUrgency: maybeRow.needUrgency ?? "low",
    futureAvailability: maybeRow.futureAvailability ?? "uncertain_available_next_pick",
    tierDropRisk: maybeRow.tierDropRisk ?? "low",
    opportunityCost: maybeRow.opportunityCost ?? "low",
    needTimingAction: maybeRow.needTimingAction ?? "monitor",
    needTimingReasons: maybeRow.needTimingReasons ?? [],
    survivalConfidence: maybeRow.survivalConfidence ?? "low",
    survivalConfidenceScore: maybeRow.survivalConfidenceScore ?? 0,
    comparableOptionsNow: maybeRow.comparableOptionsNow ?? 0,
    comparableOptionsLikelyNextPick: maybeRow.comparableOptionsLikelyNextPick ?? 0,
    comparableOptionsLikelyNextTwoPicks: maybeRow.comparableOptionsLikelyNextTwoPicks ?? 0,
    waitRisk: maybeRow.waitRisk ?? "high",
    waitRiskReasons: maybeRow.waitRiskReasons ?? [],
    needTimingAdjustedBySurvival: maybeRow.needTimingAdjustedBySurvival ?? false,
    waitPlanTargets: maybeRow.waitPlanTargets ?? [],
    waitPlanTargetCount: maybeRow.waitPlanTargetCount ?? 0,
    waitPlanStrongTargetCount: maybeRow.waitPlanStrongTargetCount ?? 0,
    waitPlanSurvivalSummary: maybeRow.waitPlanSurvivalSummary ?? "No wait targets.",
    waitPlanRisk: maybeRow.waitPlanRisk ?? "high",
    waitPlanReason: maybeRow.waitPlanReason ?? "No wait plan.",
    waitPlanBacked: maybeRow.waitPlanBacked ?? false,
    waitPlanFallbackAction: maybeRow.waitPlanFallbackAction ?? null,
    needTimingAdjustedByWaitPlan: maybeRow.needTimingAdjustedByWaitPlan ?? false,
    status: row.status as WarRoomRecommendationRow["status"],
  };
}

function uniqueRecommendation(row: H10WarRoomCompactRecommendation, index: number, rows: H10WarRoomCompactRecommendation[]) {
  return rows.findIndex((candidate) => candidate.displayName === row.displayName && candidate.position === row.position) === index;
}

function loadValidationArtifact(): ValidationArtifact {
  const artifactPath = path.join(process.cwd(), "artifacts", "projections", "h10-war-room-recommendation-validation.json");
  if (!existsSync(artifactPath)) {
    throw new Error("Missing H10 validation artifact. Run npm run validate:h10-war-room-recommendations -- --all first.");
  }
  return JSON.parse(readFileSync(artifactPath, "utf8")) as ValidationArtifact;
}

function writeArtifacts(artifact: ReturnType<typeof buildRecommendationQualityCalibrationArtifact>) {
  const dir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(dir, { recursive: true });
  const jsonPath = path.join(dir, "h10-recommendation-quality-calibration.json");
  const markdownPath = path.join(dir, "h10-recommendation-quality-calibration.md");
  writeFileSync(jsonPath, JSON.stringify(artifact, null, 2));
  writeFileSync(markdownPath, renderMarkdown(artifact));
  return { jsonPath, markdownPath };
}

function renderMarkdown(artifact: ReturnType<typeof buildRecommendationQualityCalibrationArtifact>) {
  return [
    "# H10.12 Recommendation Quality Calibration",
    "",
    `Generated: ${artifact.generatedAt}`,
    `Verdict: ${artifact.aggregate.verdict}`,
    "",
    "## Aggregate",
    "",
    `- Rooms evaluated: ${artifact.aggregate.roomsEvaluated}`,
    `- Rows audited: ${artifact.aggregate.rowsAudited}`,
    `- Dominant component counts: ${JSON.stringify(artifact.aggregate.dominantComponentCounts)}`,
    `- Confidence/risk findings: ${artifact.aggregate.confidenceRiskFindingCount}`,
    `- K/DST caution findings: ${artifact.aggregate.specialTeamsCautionFindingCount}`,
    `- IDP caution findings: ${artifact.aggregate.idpCautionFindingCount}`,
    `- Stability findings: ${artifact.aggregate.stabilityFindingCount}`,
    `- Safety findings: ${artifact.aggregate.safetyFindingCount}`,
    "",
    "## Rooms",
    "",
    ...artifact.rooms.flatMap((room) => [
      `### ${room.source}:${room.leagueName ?? room.leagueId}`,
      "",
      `- Draft room: ${room.draftRoomId}`,
      `- Rows audited: ${room.rowCount}`,
      `- Component averages: ${JSON.stringify(room.componentAverages)}`,
      `- Dominant components: ${JSON.stringify(room.dominantComponentCounts)}`,
      `- Confidence/risk findings: ${room.confidenceRiskFindings.join("; ") || "None"}`,
      `- K/DST caution findings: ${room.specialTeamsCautionFindings.join("; ") || "None"}`,
      `- IDP caution findings: ${room.idpCautionFindings.join("; ") || "None"}`,
      `- Stability findings: ${room.stabilityFindings.join("; ") || "None"}`,
      `- Safety findings: ${room.safetyFindings.join("; ") || "None"}`,
      `- Top examples: ${room.topRecommendationExamples.slice(0, 5).map((row) => `${row.displayName} ${row.position ?? ""} ${row.recommendationTier} ${row.recommendationScore} ${row.needTimingAction ?? ""}`).join("; ") || "None"}`,
      `- Explanation examples: ${room.topExplanationExamples.slice(0, 3).map((row) => `${row.displayName}: ${row.explanation}`).join("; ") || "None"}`,
      "",
    ]),
    "## Known Limitations",
    "",
    ...artifact.knownLimitations.map((limitation) => `- ${limitation}`),
    "",
  ].join("\n");
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
