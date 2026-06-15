import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  buildRecommendationReplayEvaluationArtifact,
  type RecommendationReplayEvaluationArtifact,
  type ReplayRoomInput,
} from "@/lib/draft/recommendation-replay-evaluation";
import type { H10WarRoomCompactRecommendation } from "@/lib/draft/war-room-recommendation-validation";
import type { WarRoomRecommendationRow } from "@/lib/draft/war-room-recommendations";

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
  .map((room): ReplayRoomInput => ({
    source: room.source,
    draftRoomId: room.draftRoomId,
    leagueId: room.leagueId,
    leagueName: room.leagueName,
    rows: [...(room.topRecommendations ?? []), ...(room.watchlistExamples ?? [])]
      .filter(uniqueRecommendation)
      .map((row) => inflateRow(room.leagueId, room.draftRoomId, row)),
  }))
  .filter((room) => room.rows.length > 0);

const artifact = buildRecommendationReplayEvaluationArtifact({
  generatedAt: new Date().toISOString(),
  rooms,
  trueHistoricalDraftsAvailable: false,
});
const artifactPaths = writeArtifacts(artifact);

console.log(JSON.stringify({
  trueHistoricalDraftsAvailable: artifact.trueHistoricalDraftsAvailable,
  roomsEvaluated: artifact.aggregate.roomsEvaluated,
  replayStatesEvaluated: artifact.aggregate.replayStatesEvaluated,
  recommendationsEvaluated: artifact.aggregate.recommendationsEvaluated,
  wait_on_need_cases: artifact.aggregate.wait_on_need_cases,
  wait_on_need_success_rate: artifact.aggregate.wait_on_need_success_rate,
  wait_plan_cases: artifact.aggregate.wait_plan_cases,
  wait_plan_backed_rate: artifact.aggregate.wait_plan_backed_rate,
  unsupported_wait_count: artifact.aggregate.unsupported_wait_count,
  unsupported_wait_converted_count: artifact.aggregate.unsupported_wait_converted_count,
  wait_plan_target_survival_rate: artifact.aggregate.wait_plan_target_survival_rate,
  average_wait_plan_target_count: artifact.aggregate.average_wait_plan_target_count,
  strong_wait_plan_target_count: artifact.aggregate.strong_wait_plan_target_count,
  wait_without_targets_count: artifact.aggregate.wait_without_targets_count,
  fill_now_cases: artifact.aggregate.fill_now_cases,
  fill_now_supported_rate: artifact.aggregate.fill_now_supported_rate,
  tier_cliff_cases: artifact.aggregate.tier_cliff_cases,
  tier_cliff_supported_rate: artifact.aggregate.tier_cliff_supported_rate,
  elite_value_cases: artifact.aggregate.elite_value_cases,
  low_confidence_push_count: artifact.aggregate.low_confidence_push_count,
  K_DST_early_push_count: artifact.aggregate.K_DST_early_push_count,
  IDP_low_confidence_overpush_count: artifact.aggregate.IDP_low_confidence_overpush_count,
  instability_churn_count: artifact.aggregate.instability_churn_count,
  safety_finding_count: artifact.aggregate.safety_finding_count,
  verdict: artifact.aggregate.verdict,
  artifactPaths,
}, null, 2));

if (artifact.aggregate.verdict === "blocked_by_missing_data" || artifact.aggregate.verdict === "failed_safety_gates") {
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

function writeArtifacts(artifact: RecommendationReplayEvaluationArtifact) {
  const dir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(dir, { recursive: true });
  const jsonPath = path.join(dir, "h10-recommendation-replay-evaluation.json");
  const markdownPath = path.join(dir, "h10-recommendation-replay-evaluation.md");
  writeFileSync(jsonPath, JSON.stringify(artifact, null, 2));
  writeFileSync(markdownPath, renderMarkdown(artifact));
  return { jsonPath, markdownPath };
}

function renderMarkdown(artifact: RecommendationReplayEvaluationArtifact) {
  return [
    "# H10.13 Recommendation Replay Evaluation",
    "",
    `Generated: ${artifact.generatedAt}`,
    `Verdict: ${artifact.aggregate.verdict}`,
    `True historical drafts available: ${artifact.trueHistoricalDraftsAvailable}`,
    "",
    "## Methodology",
    "",
    artifact.methodology,
    "",
    "## Aggregate",
    "",
    `- Rooms evaluated: ${artifact.aggregate.roomsEvaluated}`,
    `- Replay states evaluated: ${artifact.aggregate.replayStatesEvaluated}`,
    `- Recommendations evaluated: ${artifact.aggregate.recommendationsEvaluated}`,
    `- Wait-on-need cases: ${artifact.aggregate.wait_on_need_cases}`,
    `- Wait-on-need success rate: ${formatRate(artifact.aggregate.wait_on_need_success_rate)}`,
    `- Wait-plan cases: ${artifact.aggregate.wait_plan_cases}`,
    `- Wait-plan backed rate: ${formatRate(artifact.aggregate.wait_plan_backed_rate)}`,
    `- Unsupported waits: ${artifact.aggregate.unsupported_wait_count}`,
    `- Unsupported waits converted: ${artifact.aggregate.unsupported_wait_converted_count}`,
    `- Wait-plan target survival rate: ${formatRate(artifact.aggregate.wait_plan_target_survival_rate)}`,
    `- Average wait-plan target count: ${artifact.aggregate.average_wait_plan_target_count ?? "n/a"}`,
    `- Strong wait-plan targets: ${artifact.aggregate.strong_wait_plan_target_count}`,
    `- Waits without targets: ${artifact.aggregate.wait_without_targets_count}`,
    `- Fill-now cases: ${artifact.aggregate.fill_now_cases}`,
    `- Fill-now supported rate: ${formatRate(artifact.aggregate.fill_now_supported_rate)}`,
    `- Tier-cliff cases: ${artifact.aggregate.tier_cliff_cases}`,
    `- Tier-cliff supported rate: ${formatRate(artifact.aggregate.tier_cliff_supported_rate)}`,
    `- Elite value cases: ${artifact.aggregate.elite_value_cases}`,
    `- Low-confidence pushes: ${artifact.aggregate.low_confidence_push_count}`,
    `- K/DST early pushes: ${artifact.aggregate.K_DST_early_push_count}`,
    `- IDP low-confidence overpushes: ${artifact.aggregate.IDP_low_confidence_overpush_count}`,
    `- Instability churn findings: ${artifact.aggregate.instability_churn_count}`,
    `- Safety findings: ${artifact.aggregate.safety_finding_count}`,
    "",
    "## Assumptions",
    "",
    ...artifact.assumptions.map((assumption) => `- ${assumption}`),
    "",
    "## Rooms",
    "",
    ...artifact.rooms.flatMap((room) => [
      `### ${room.source}:${room.leagueName ?? room.leagueId}`,
      "",
      `- Draft room: ${room.draftRoomId}`,
      `- Rows evaluated: ${room.rowsEvaluated}`,
      `- Simulated picks until next: ${room.simulatedPicksUntilNext}`,
      `- Simulated picks until next two: ${room.simulatedPicksUntilNextTwo}`,
      `- Strong examples: ${formatCases(room.strongestSuccessfulExamples)}`,
      `- Concerning examples: ${formatCases(room.concerningExamples)}`,
      `- Need timing examples: ${formatCases(room.needTimingAccuracyExamples)}`,
      `- Tier cliff examples: ${formatCases(room.tierCliffExamples)}`,
      `- Special position caution findings: ${room.specialPositionCautionFindings.join("; ") || "None"}`,
      `- Stability findings: ${room.stabilityFindings.join("; ") || "None"}`,
      `- Safety findings: ${room.safetyFindings.join("; ") || "None"}`,
      "",
    ]),
    "## Known Limitations",
    "",
    ...artifact.knownLimitations.map((limitation) => `- ${limitation}`),
    "",
  ].join("\n");
}

function formatCases(cases: RecommendationReplayEvaluationArtifact["rooms"][number]["cases"]) {
  return cases
    .slice(0, 5)
    .map((item) => `${item.displayName} ${item.position ?? ""} rank ${item.recommendationRank} score ${item.recommendationScore} ${item.needTimingAction}`)
    .join("; ") || "None";
}

function formatRate(value: number | null) {
  return value === null ? "n/a" : `${Math.round(value * 1000) / 10}%`;
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
