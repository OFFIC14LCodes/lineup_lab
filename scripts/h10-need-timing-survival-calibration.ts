import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { RecommendationReplayEvaluationArtifact } from "@/lib/draft/recommendation-replay-evaluation";
import type { H10WarRoomCompactRecommendation } from "@/lib/draft/war-room-recommendation-validation";

type ValidationArtifact = {
  generatedAt?: string;
  roomResults?: Array<{
    source: "live" | "validation_seed" | "fixture";
    draftRoomId: string;
    leagueId: string;
    leagueName: string | null;
    topRecommendations?: H10WarRoomCompactRecommendation[];
    watchlistExamples?: H10WarRoomCompactRecommendation[];
  }>;
};

const H1013_BASELINE = {
  wait_on_need_success_rate: 0.435,
  fill_now_supported_rate: 0.846,
  tier_cliff_supported_rate: 1,
  low_confidence_push_count: 0,
  K_DST_early_push_count: 0,
  IDP_low_confidence_overpush_count: 0,
  instability_churn_count: 29,
  safety_finding_count: 0,
};

const validation = readJson<ValidationArtifact>("h10-war-room-recommendation-validation.json");
const replay = readJson<RecommendationReplayEvaluationArtifact>("h10-recommendation-replay-evaluation.json");
const rows = (validation.roomResults ?? []).flatMap((room) => [
  ...(room.topRecommendations ?? []),
  ...(room.watchlistExamples ?? []),
]);
const uniqueRows = rows.filter((row, index) => rows.findIndex((candidate) => candidate.displayName === row.displayName && candidate.position === row.position) === index);
const adjustedRows = uniqueRows.filter((row) => row.needTimingAdjustedBySurvival);
const waitRows = uniqueRows.filter((row) => row.needTimingAction === "wait_one_turn" || row.needTimingAction === "wait_multiple_turns");
const artifact = {
  generatedAt: new Date().toISOString(),
  artifactVersion: "h10.14-need-timing-survival-calibration-v1",
  baselineReplayMetrics: H1013_BASELINE,
  currentReplayMetrics: replay.aggregate,
  deltas: {
    wait_on_need_success_rate: delta(replay.aggregate.wait_on_need_success_rate, H1013_BASELINE.wait_on_need_success_rate),
    fill_now_supported_rate: delta(replay.aggregate.fill_now_supported_rate, H1013_BASELINE.fill_now_supported_rate),
    tier_cliff_supported_rate: delta(replay.aggregate.tier_cliff_supported_rate, H1013_BASELINE.tier_cliff_supported_rate),
    instability_churn_count: replay.aggregate.instability_churn_count - H1013_BASELINE.instability_churn_count,
  },
  survivalSummary: {
    rowsAudited: uniqueRows.length,
    waitRows: waitRows.length,
    survivalConfidenceDistribution: countBy(uniqueRows.map((row) => row.survivalConfidence ?? "unknown")),
    waitRiskDistribution: countBy(uniqueRows.map((row) => row.waitRisk ?? "unknown")),
    adjustedBySurvivalCount: adjustedRows.length,
    adjustedBySurvivalExamples: adjustedRows.slice(0, 10).map((row) => ({
      displayName: row.displayName,
      position: row.position,
      recommendationRank: row.recommendationRank,
      recommendationScore: row.recommendationScore,
      needTimingAction: row.needTimingAction,
      survivalConfidence: row.survivalConfidence,
      survivalConfidenceScore: row.survivalConfidenceScore,
      comparableOptionsNow: row.comparableOptionsNow,
      comparableOptionsLikelyNextPick: row.comparableOptionsLikelyNextPick,
      comparableOptionsLikelyNextTwoPicks: row.comparableOptionsLikelyNextTwoPicks,
      waitRisk: row.waitRisk,
      waitRiskReasons: row.waitRiskReasons,
    })),
  },
  safetyMaintained:
    replay.aggregate.safety_finding_count === 0 &&
    replay.aggregate.low_confidence_push_count === 0 &&
    replay.aggregate.K_DST_early_push_count === 0 &&
    replay.aggregate.IDP_low_confidence_overpush_count === 0,
  verdict:
    replay.aggregate.safety_finding_count > 0
      ? "failed_safety_gates"
      : replay.aggregate.wait_on_need_success_rate !== null && replay.aggregate.wait_on_need_success_rate > H1013_BASELINE.wait_on_need_success_rate
        ? "improved"
        : "quality_risks_remain",
};
const paths = writeArtifacts(artifact);

console.log(JSON.stringify({
  verdict: artifact.verdict,
  baselineWaitSuccessRate: artifact.baselineReplayMetrics.wait_on_need_success_rate,
  currentWaitSuccessRate: artifact.currentReplayMetrics.wait_on_need_success_rate,
  waitSuccessDelta: artifact.deltas.wait_on_need_success_rate,
  baselineChurn: artifact.baselineReplayMetrics.instability_churn_count,
  currentChurn: artifact.currentReplayMetrics.instability_churn_count,
  churnDelta: artifact.deltas.instability_churn_count,
  safetyMaintained: artifact.safetyMaintained,
  survivalSummary: artifact.survivalSummary,
  artifactPaths: paths,
}, null, 2));

function readJson<T>(file: string): T {
  const artifactPath = path.join(process.cwd(), "artifacts", "projections", file);
  if (!existsSync(artifactPath)) throw new Error(`Missing artifact: ${artifactPath}`);
  return JSON.parse(readFileSync(artifactPath, "utf8")) as T;
}

function writeArtifacts(input: typeof artifact) {
  const dir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(dir, { recursive: true });
  const jsonPath = path.join(dir, "h10-need-timing-survival-calibration.json");
  const markdownPath = path.join(dir, "h10-need-timing-survival-calibration.md");
  writeFileSync(jsonPath, JSON.stringify(input, null, 2));
  writeFileSync(markdownPath, renderMarkdown(input));
  return { jsonPath, markdownPath };
}

function renderMarkdown(input: typeof artifact) {
  return [
    "# H10.14 Need Timing Survival Calibration",
    "",
    `Generated: ${input.generatedAt}`,
    `Verdict: ${input.verdict}`,
    `Safety maintained: ${input.safetyMaintained}`,
    "",
    "## Replay Comparison",
    "",
    `- Wait-on-need success: ${formatRate(input.baselineReplayMetrics.wait_on_need_success_rate)} -> ${formatRate(input.currentReplayMetrics.wait_on_need_success_rate)} (${formatDelta(input.deltas.wait_on_need_success_rate)})`,
    `- Fill-now supported: ${formatRate(input.baselineReplayMetrics.fill_now_supported_rate)} -> ${formatRate(input.currentReplayMetrics.fill_now_supported_rate)} (${formatDelta(input.deltas.fill_now_supported_rate)})`,
    `- Tier-cliff supported: ${formatRate(input.baselineReplayMetrics.tier_cliff_supported_rate)} -> ${formatRate(input.currentReplayMetrics.tier_cliff_supported_rate)} (${formatDelta(input.deltas.tier_cliff_supported_rate)})`,
    `- Instability churn: ${input.baselineReplayMetrics.instability_churn_count} -> ${input.currentReplayMetrics.instability_churn_count} (${input.deltas.instability_churn_count})`,
    "",
    "## Survival Summary",
    "",
    `- Rows audited: ${input.survivalSummary.rowsAudited}`,
    `- Wait rows: ${input.survivalSummary.waitRows}`,
    `- Adjusted by survival: ${input.survivalSummary.adjustedBySurvivalCount}`,
    `- Survival confidence: ${JSON.stringify(input.survivalSummary.survivalConfidenceDistribution)}`,
    `- Wait risk: ${JSON.stringify(input.survivalSummary.waitRiskDistribution)}`,
    "",
    "## Adjusted Examples",
    "",
    ...input.survivalSummary.adjustedBySurvivalExamples.map((row) => `- ${row.displayName} ${row.position ?? ""}: ${row.needTimingAction}, ${row.survivalConfidence}/${row.waitRisk}, next=${row.comparableOptionsLikelyNextPick}, reasons=${row.waitRiskReasons.join("; ") || "none"}`),
    "",
  ].join("\n");
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function delta(current: number | null, baseline: number) {
  return current === null ? null : Math.round((current - baseline) * 1000) / 1000;
}

function formatRate(value: number | null) {
  return value === null ? "n/a" : `${Math.round(value * 1000) / 10}%`;
}

function formatDelta(value: number | null) {
  return value === null ? "n/a" : `${value >= 0 ? "+" : ""}${Math.round(value * 1000) / 10} pts`;
}
