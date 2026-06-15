import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { RecommendationReplayEvaluationArtifact } from "@/lib/draft/recommendation-replay-evaluation";
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

const validation = readJson<ValidationArtifact>("h10-war-room-recommendation-validation.json");
const replay = readJson<RecommendationReplayEvaluationArtifact>("h10-recommendation-replay-evaluation.json");
const rows = (validation.roomResults ?? []).flatMap((room) =>
  [...(room.topRecommendations ?? []), ...(room.watchlistExamples ?? [])].map((row) => ({
    room: `${room.source}:${room.leagueName ?? room.leagueId}`,
    draftRoomId: room.draftRoomId,
    ...row,
  }))
);
const uniqueRows = rows.filter((row, index) => rows.findIndex((candidate) => candidate.displayName === row.displayName && candidate.position === row.position && candidate.draftRoomId === row.draftRoomId) === index);
const waitRows = uniqueRows.filter((row) => row.needTimingAction === "wait_one_turn" || row.needTimingAction === "wait_multiple_turns");
const waitPlanCases = uniqueRows.filter((row) => row.waitPlanTargetCount > 0 || row.waitPlanBacked);
const unsupportedWaits = waitRows.filter((row) => !row.waitPlanBacked);
const converted = uniqueRows.filter((row) => row.needTimingAdjustedByWaitPlan);
const artifact = {
  generatedAt: new Date().toISOString(),
  artifactVersion: "h10.15-wait-target-planning-v1",
  aggregate: {
    rowsAudited: uniqueRows.length,
    waitRows: waitRows.length,
    waitPlanCases: waitPlanCases.length,
    waitPlanBackedRate: rate(waitPlanCases.filter((row) => row.waitPlanBacked).length, waitPlanCases.length),
    unsupportedWaitCount: unsupportedWaits.length,
    unsupportedWaitConvertedCount: converted.length,
    waitWithoutTargetsCount: waitRows.filter((row) => row.waitPlanTargetCount === 0).length,
    averageWaitPlanTargetCount: waitPlanCases.length ? Math.round((waitPlanCases.reduce((sum, row) => sum + row.waitPlanTargetCount, 0) / waitPlanCases.length) * 10) / 10 : null,
    strongWaitPlanTargetCount: waitPlanCases.reduce((sum, row) => sum + row.waitPlanStrongTargetCount, 0),
    replayWaitOnNeedSuccessRate: replay.aggregate.wait_on_need_success_rate,
    replayVerdict: replay.aggregate.verdict,
    safetyFindingCount: replay.aggregate.safety_finding_count,
    lowConfidencePushCount: replay.aggregate.low_confidence_push_count,
    kDstEarlyPushCount: replay.aggregate.K_DST_early_push_count,
    idpLowConfidenceOverpushCount: replay.aggregate.IDP_low_confidence_overpush_count,
  },
  examples: {
    backedWaitPlans: waitRows.filter((row) => row.waitPlanBacked).slice(0, 10).map(exampleFor),
    unsupportedWaits: unsupportedWaits.slice(0, 10).map(exampleFor),
    convertedUnsupportedWaits: converted.slice(0, 10).map(exampleFor),
  },
  verdict:
    replay.aggregate.safety_finding_count > 0
      ? "failed_safety_gates"
      : replay.aggregate.verdict === "ready"
        ? "ready"
        : "quality_risks",
};
const paths = writeArtifacts(artifact);

console.log(JSON.stringify({ ...artifact.aggregate, verdict: artifact.verdict, artifactPaths: paths }, null, 2));

function exampleFor(row: typeof uniqueRows[number]) {
  return {
    room: row.room,
    displayName: row.displayName,
    position: row.position,
    needTimingAction: row.needTimingAction,
    waitPlanBacked: row.waitPlanBacked,
    waitPlanTargetCount: row.waitPlanTargetCount,
    waitPlanStrongTargetCount: row.waitPlanStrongTargetCount,
    waitPlanRisk: row.waitPlanRisk,
    waitPlanReason: row.waitPlanReason,
    targets: row.waitPlanTargets?.slice(0, 3).map((target) => `${target.displayName} ${target.position ?? ""} ${target.confidence}/${target.survivalEstimate}`) ?? [],
  };
}

function readJson<T>(file: string): T {
  const artifactPath = path.join(process.cwd(), "artifacts", "projections", file);
  if (!existsSync(artifactPath)) throw new Error(`Missing artifact: ${artifactPath}`);
  return JSON.parse(readFileSync(artifactPath, "utf8")) as T;
}

function writeArtifacts(input: typeof artifact) {
  const dir = path.join(process.cwd(), "artifacts", "projections");
  mkdirSync(dir, { recursive: true });
  const jsonPath = path.join(dir, "h10-wait-target-planning.json");
  const markdownPath = path.join(dir, "h10-wait-target-planning.md");
  writeFileSync(jsonPath, JSON.stringify(input, null, 2));
  writeFileSync(markdownPath, renderMarkdown(input));
  return { jsonPath, markdownPath };
}

function renderMarkdown(input: typeof artifact) {
  return [
    "# H10.15 Wait Target Planning",
    "",
    `Generated: ${input.generatedAt}`,
    `Verdict: ${input.verdict}`,
    "",
    "## Aggregate",
    "",
    ...Object.entries(input.aggregate).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Backed Wait Plans",
    "",
    ...input.examples.backedWaitPlans.map((row) => `- ${row.displayName} ${row.position ?? ""}: ${row.waitPlanReason} Targets: ${row.targets.join("; ") || "none"}`),
    "",
    "## Unsupported Waits",
    "",
    ...input.examples.unsupportedWaits.map((row) => `- ${row.displayName} ${row.position ?? ""}: ${row.waitPlanReason}`),
    "",
    "## Converted Unsupported Waits",
    "",
    ...input.examples.convertedUnsupportedWaits.map((row) => `- ${row.displayName} ${row.position ?? ""}: ${row.needTimingAction}, ${row.waitPlanReason}`),
    "",
  ].join("\n");
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 1000;
}
