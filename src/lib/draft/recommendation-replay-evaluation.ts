import type { WarRoomRecommendationRow } from "@/lib/draft/war-room-recommendations";
import { compareRecommendationStability } from "@/lib/draft/recommendation-quality-calibration";

export type ReplayRoomInput = {
  source: "live" | "validation_seed" | "fixture" | "scenario";
  draftRoomId: string;
  leagueId: string;
  leagueName: string | null;
  rows: WarRoomRecommendationRow[];
};

export type ReplayEvaluationCase = {
  roomId: string;
  displayName: string;
  position: string | null;
  recommendationRank: number;
  recommendationScore: number;
  needTimingAction: string;
  survivedToNextPick: boolean;
  survivedToNextTwoPicks: boolean;
  comparableAtNextPick: number;
  comparableAtNextTwoPicks: number;
  waitRecommendationSupported: boolean | null;
  waitPlanBacked: boolean;
  waitPlanTargetCount: number;
  waitPlanStrongTargetCount: number;
  waitPlanTargetsSurvived: number;
  fillNowSupported: boolean | null;
  tierCliffSupported: boolean | null;
  valueDefensible: boolean;
  findings: string[];
};

export type ReplayRoomEvaluation = {
  source: ReplayRoomInput["source"];
  draftRoomId: string;
  leagueId: string;
  leagueName: string | null;
  rowsEvaluated: number;
  simulatedPicksUntilNext: number;
  simulatedPicksUntilNextTwo: number;
  cases: ReplayEvaluationCase[];
  strongestSuccessfulExamples: ReplayEvaluationCase[];
  concerningExamples: ReplayEvaluationCase[];
  needTimingAccuracyExamples: ReplayEvaluationCase[];
  tierCliffExamples: ReplayEvaluationCase[];
  specialPositionCautionFindings: string[];
  stabilityFindings: string[];
  safetyFindings: string[];
};

export type RecommendationReplayEvaluationArtifact = {
  generatedAt: string;
  artifactVersion: "h10.13-recommendation-replay-evaluation-v1";
  methodology: string;
  assumptions: string[];
  trueHistoricalDraftsAvailable: boolean;
  rooms: ReplayRoomEvaluation[];
  aggregate: {
    roomsEvaluated: number;
    replayStatesEvaluated: number;
    recommendationsEvaluated: number;
    wait_on_need_cases: number;
    wait_on_need_success_rate: number | null;
    wait_plan_cases: number;
    wait_plan_backed_rate: number | null;
    unsupported_wait_count: number;
    unsupported_wait_converted_count: number;
    wait_plan_target_survival_rate: number | null;
    average_wait_plan_target_count: number | null;
    strong_wait_plan_target_count: number;
    wait_without_targets_count: number;
    fill_now_cases: number;
    fill_now_supported_rate: number | null;
    tier_cliff_cases: number;
    tier_cliff_supported_rate: number | null;
    elite_value_cases: number;
    low_confidence_push_count: number;
    K_DST_early_push_count: number;
    IDP_low_confidence_overpush_count: number;
    instability_churn_count: number;
    safety_finding_count: number;
    verdict: "ready" | "quality_risks" | "blocked_by_missing_data" | "failed_safety_gates";
  };
  knownLimitations: string[];
};

const IDP_POSITIONS = new Set(["DL", "LB", "DB"]);
const SPECIAL_TEAMS_POSITIONS = new Set(["K", "DEF"]);
const BANNED_LANGUAGE = ["must draft", "guaranteed", "ai says", "ai advice", "best pick", "you should draft"];

export function buildRecommendationReplayEvaluationArtifact(input: {
  generatedAt: string;
  rooms: ReplayRoomInput[];
  trueHistoricalDraftsAvailable?: boolean;
}): RecommendationReplayEvaluationArtifact {
  const rooms = input.rooms.map(evaluateReplayRoom);
  const allCases = rooms.flatMap((room) => room.cases);
  const waitCases = allCases.filter((item) => item.needTimingAction === "wait_one_turn" || item.needTimingAction === "wait_multiple_turns");
  const waitPlanCases = allCases.filter((item) => item.waitPlanTargetCount > 0 || item.waitPlanBacked);
  const fillNowCases = allCases.filter((item) => item.needTimingAction === "fill_now");
  const tierCliffCases = allCases.filter((item) => item.tierCliffSupported !== null);
  const lowConfidencePushCount = allCases.filter((item) => item.findings.some((finding) => finding.includes("low_confidence_push"))).length;
  const specialTeamsPushCount = allCases.filter((item) => item.findings.some((finding) => finding.includes("special_teams_early_push"))).length;
  const idpOverpushCount = allCases.filter((item) => item.findings.some((finding) => finding.includes("idp_low_confidence_overpush"))).length;
  const instabilityChurnCount = rooms.reduce((sum, room) => sum + room.stabilityFindings.length, 0);
  const safetyFindingCount = rooms.reduce((sum, room) => sum + room.safetyFindings.length, 0);
  const qualityRiskCount = allCases.filter((item) => item.findings.some((finding) => finding.includes("unsupported") || finding.includes("failed"))).length;
  const recommendationsEvaluated = allCases.length;
  const totalWaitPlanTargets = waitPlanCases.reduce((sum, item) => sum + item.waitPlanTargetCount, 0);
  const totalWaitPlanTargetsSurvived = waitPlanCases.reduce((sum, item) => sum + item.waitPlanTargetsSurvived, 0);
  const verdict =
    safetyFindingCount > 0
      ? "failed_safety_gates"
      : recommendationsEvaluated === 0
        ? "blocked_by_missing_data"
        : qualityRiskCount > 0 || lowConfidencePushCount > 0 || specialTeamsPushCount > 0 || idpOverpushCount > 0
          ? "quality_risks"
          : "ready";

  return {
    generatedAt: input.generatedAt,
    artifactVersion: "h10.13-recommendation-replay-evaluation-v1",
    methodology: "Deterministic simulated replay over validation/live recommendation snapshots. Board depletion removes higher-ranked available rows before the next user pick and next two user picks, then evaluates whether timing, tier cliff, value, and caution signals remain supported.",
    assumptions: [
      "True historical draft logs are not yet available in the H10 validation artifact, so this phase uses simulated depletion.",
      "Opponent picks are approximated by current recommendation/rank order, including the evaluated candidate when that row would be selected before the user's next pick.",
      "Comparable players are rows at the same normalized position with score within a tier/value tolerance.",
      "Next two user picks are modeled as twice picksUntilNextUserPick when known, otherwise a conservative default.",
    ],
    trueHistoricalDraftsAvailable: Boolean(input.trueHistoricalDraftsAvailable),
    rooms,
    aggregate: {
      roomsEvaluated: rooms.length,
      replayStatesEvaluated: rooms.length * 2,
      recommendationsEvaluated,
      wait_on_need_cases: waitCases.length,
      wait_on_need_success_rate: rate(waitCases.filter((item) => item.waitRecommendationSupported).length, waitCases.length),
      wait_plan_cases: waitPlanCases.length,
      wait_plan_backed_rate: rate(waitPlanCases.filter((item) => item.waitPlanBacked).length, waitPlanCases.length),
      unsupported_wait_count: waitCases.filter((item) => !item.waitPlanBacked).length,
      unsupported_wait_converted_count: allCases.filter((item) => item.findings.some((finding) => finding.includes("unsupported_wait_converted"))).length,
      wait_plan_target_survival_rate: rate(totalWaitPlanTargetsSurvived, totalWaitPlanTargets),
      average_wait_plan_target_count: waitPlanCases.length ? Math.round((totalWaitPlanTargets / waitPlanCases.length) * 10) / 10 : null,
      strong_wait_plan_target_count: waitPlanCases.reduce((sum, item) => sum + item.waitPlanStrongTargetCount, 0),
      wait_without_targets_count: waitCases.filter((item) => item.waitPlanTargetCount === 0).length,
      fill_now_cases: fillNowCases.length,
      fill_now_supported_rate: rate(fillNowCases.filter((item) => item.fillNowSupported).length, fillNowCases.length),
      tier_cliff_cases: tierCliffCases.length,
      tier_cliff_supported_rate: rate(tierCliffCases.filter((item) => item.tierCliffSupported).length, tierCliffCases.length),
      elite_value_cases: allCases.filter((item) => item.valueDefensible && item.recommendationScore >= 72).length,
      low_confidence_push_count: lowConfidencePushCount,
      K_DST_early_push_count: specialTeamsPushCount,
      IDP_low_confidence_overpush_count: idpOverpushCount,
      instability_churn_count: instabilityChurnCount,
      safety_finding_count: safetyFindingCount,
      verdict,
    },
    knownLimitations: [
      "This is not yet a true historical draft-outcome backtest.",
      "Simulated opponent selection uses deterministic depletion from available recommendation rows, not actual manager behavior.",
      "Outcome scoring evaluates projection/market/timing support, not end-of-season fantasy points.",
      "Rows absent from compact validation examples cannot be evaluated until richer replay snapshots are persisted as artifacts.",
    ],
  };
}

export function evaluateReplayRoom(room: ReplayRoomInput): ReplayRoomEvaluation {
  const rows = room.rows.filter((row) => row.status === "recommendable" || row.status === "watch_only");
  const picksUntilNext = inferPicksUntilNext(rows);
  const cases = rows.slice(0, 15).map((row) => evaluateReplayCase(row, rows, picksUntilNext));
  const adjacentState = simulateAdjacentState(rows, Math.max(1, Math.ceil(picksUntilNext / 4)));
  const stabilityFindings = compareRecommendationStability({ before: rows, after: adjacentState });
  const safetyFindings = rows.flatMap(safetyFindingsFor);
  const specialPositionCautionFindings = cases.flatMap((item) => item.findings.filter((finding) => finding.includes("special_teams") || finding.includes("idp_low_confidence")));

  return {
    source: room.source,
    draftRoomId: room.draftRoomId,
    leagueId: room.leagueId,
    leagueName: room.leagueName,
    rowsEvaluated: cases.length,
    simulatedPicksUntilNext: picksUntilNext,
    simulatedPicksUntilNextTwo: picksUntilNext * 2,
    cases,
    strongestSuccessfulExamples: cases.filter((item) => item.findings.length === 0 && item.valueDefensible).slice(0, 5),
    concerningExamples: cases.filter((item) => item.findings.length > 0).slice(0, 5),
    needTimingAccuracyExamples: cases.filter((item) => item.needTimingAction === "wait_one_turn" || item.needTimingAction === "fill_now").slice(0, 5),
    tierCliffExamples: cases.filter((item) => item.tierCliffSupported !== null).slice(0, 5),
    specialPositionCautionFindings,
    stabilityFindings,
    safetyFindings,
  };
}

function evaluateReplayCase(row: WarRoomRecommendationRow, rows: WarRoomRecommendationRow[], picksUntilNext: number): ReplayEvaluationCase {
  const nextPool = depleteBoard(rows, picksUntilNext);
  const nextTwoPool = depleteBoard(rows, picksUntilNext * 2);
  const survivedToNextPick = includesRow(nextPool, row);
  const survivedToNextTwoPicks = includesRow(nextTwoPool, row);
  const comparableAtNextPick = comparableRows(row, nextPool).length;
  const comparableAtNextTwoPicks = comparableRows(row, nextTwoPool).length;
  const waitRecommendationSupported =
    row.needTimingAction === "wait_one_turn"
      ? waitPlanTargetsSurvived(row, nextPool) > 0 || (row.waitPlanTargetCount === 0 && (survivedToNextPick || comparableAtNextPick > 0))
      : row.needTimingAction === "wait_multiple_turns"
        ? waitPlanTargetsSurvived(row, nextTwoPool) > 0 || (row.waitPlanTargetCount === 0 && (survivedToNextTwoPicks || comparableAtNextTwoPicks > 0))
        : null;
  const waitPlanTargetsSurvivedCount =
    row.needTimingAction === "wait_multiple_turns" ? waitPlanTargetsSurvived(row, nextTwoPool) : waitPlanTargetsSurvived(row, nextPool);
  const fillNowSupported = row.needTimingAction === "fill_now" ? !survivedToNextPick && comparableAtNextPick === 0 : null;
  const tierCliffSupported = row.tierDropRisk === "high" ? comparableAtNextPick <= 1 || valueGapAfter(row, nextPool) >= 8 : null;
  const valueDefensible = row.scoreComponents.leagueValue + row.scoreComponents.marketValue + row.scoreComponents.scarcity >= row.scoreComponents.rosterNeed || row.recommendationScore >= 58;
  const findings = findingsFor(row, {
    survivedToNextPick,
    comparableAtNextPick,
    waitRecommendationSupported,
    waitPlanBacked: row.waitPlanBacked,
    waitPlanTargetCount: row.waitPlanTargetCount,
    waitPlanStrongTargetCount: row.waitPlanStrongTargetCount,
    waitPlanTargetsSurvived: waitPlanTargetsSurvivedCount,
    fillNowSupported,
    tierCliffSupported,
    valueDefensible,
  });

  return {
    roomId: row.draftRoomId,
    displayName: row.displayName,
    position: row.position,
    recommendationRank: row.recommendationRank,
    recommendationScore: row.recommendationScore,
    needTimingAction: row.needTimingAction,
    survivedToNextPick,
    survivedToNextTwoPicks,
    comparableAtNextPick,
    comparableAtNextTwoPicks,
    waitRecommendationSupported,
    waitPlanBacked: row.waitPlanBacked,
    waitPlanTargetCount: row.waitPlanTargetCount,
    waitPlanStrongTargetCount: row.waitPlanStrongTargetCount,
    waitPlanTargetsSurvived: waitPlanTargetsSurvivedCount,
    fillNowSupported,
    tierCliffSupported,
    valueDefensible,
    findings,
  };
}

function findingsFor(
  row: WarRoomRecommendationRow,
  support: {
    survivedToNextPick: boolean;
    comparableAtNextPick: number;
    waitRecommendationSupported: boolean | null;
    waitPlanBacked: boolean;
    waitPlanTargetCount: number;
    waitPlanStrongTargetCount: number;
    waitPlanTargetsSurvived: number;
    fillNowSupported: boolean | null;
    tierCliffSupported: boolean | null;
    valueDefensible: boolean;
  }
): string[] {
  const findings: string[] = [];
  const position = normalizePosition(row.position);
  const lowConfidence = row.h10.confidenceLabel === "low" || row.h10.confidenceLabel === "very_low" || row.warningCodes.includes("LOW_PROJECTION_CONFIDENCE");

  if ((row.needTimingAction === "wait_one_turn" || row.needTimingAction === "wait_multiple_turns") && support.waitRecommendationSupported === false) {
    findings.push(
      row.needTimingAction === "wait_multiple_turns"
        ? "wait_on_need_failed:no comparable option survived to next two picks."
        : "wait_on_need_failed:no comparable option survived to next pick."
    );
  }
  if ((row.needTimingAction === "wait_one_turn" || row.needTimingAction === "wait_multiple_turns") && !row.waitPlanBacked) {
    findings.push("wait_plan_unsupported:wait action has no backed target plan.");
  }
  if (row.needTimingAdjustedByWaitPlan) findings.push(`unsupported_wait_converted:${row.waitPlanFallbackAction ?? "monitor"}.`);
  if (support.fillNowSupported === false) findings.push("fill_now_unsupported:candidate or comparable option survived to next pick.");
  if (support.tierCliffSupported === false) findings.push("tier_cliff_unsupported:post-depletion comparable depth/gap did not support high cliff.");
  if (!support.valueDefensible) findings.push("value_case_unsupported:score composition did not support value-over-need case.");
  if (lowConfidence && row.recommendationTier === "priority_target") findings.push("low_confidence_push:low-confidence row reached priority target.");
  if (IDP_POSITIONS.has(position) && lowConfidence && row.recommendationTier === "priority_target") findings.push("idp_low_confidence_overpush:IDP row overstated despite low confidence.");
  if (SPECIAL_TEAMS_POSITIONS.has(position) && (row.draftContext.currentRound ?? 1) < 13 && (row.recommendationTier === "priority_target" || row.recommendationTier === "strong_target")) {
    findings.push("special_teams_early_push:K/DST surfaced aggressively before late rounds.");
  }
  return findings;
}

function depleteBoard(rows: WarRoomRecommendationRow[], pickCount: number): WarRoomRecommendationRow[] {
  const drafted = new Set(
    [...rows]
      .sort((a, b) => marketOrder(a, b))
      .slice(0, Math.max(0, pickCount))
      .map(rowKey)
  );
  return rows.filter((row) => !drafted.has(rowKey(row)));
}

function simulateAdjacentState(rows: WarRoomRecommendationRow[], depletionCount: number): WarRoomRecommendationRow[] {
  const nudge = Math.min(1.5, Math.max(0.2, depletionCount / 12));
  return rows.map((row, index) => ({
    ...row,
    recommendationScore: row.recommendationScore + (index % 2 === 0 ? nudge : -nudge),
  }));
}

function comparableRows(row: WarRoomRecommendationRow, pool: WarRoomRecommendationRow[]): WarRoomRecommendationRow[] {
  const position = normalizePosition(row.position);
  const scoreFloor = row.recommendationScore - 8;
  const tier = row.h10.tier;
  return pool.filter((candidate) => {
    if (rowKey(candidate) === rowKey(row)) return false;
    if (normalizePosition(candidate.position) !== position) return false;
    if (tier !== null && candidate.h10.tier !== null && candidate.h10.tier === tier) return true;
    return candidate.recommendationScore >= scoreFloor;
  });
}

function waitPlanTargetsSurvived(row: WarRoomRecommendationRow, pool: WarRoomRecommendationRow[]): number {
  if (!row.waitPlanTargets.length) return 0;
  const poolKeys = new Set(pool.map((candidate) => `${candidate.displayName}|${normalizePosition(candidate.position)}`));
  return row.waitPlanTargets.filter((target) => {
    if (poolKeys.has(`${target.displayName}|${normalizePosition(target.position)}`)) return true;
    return target.survivalEstimate === "likely";
  }).length;
}

function valueGapAfter(row: WarRoomRecommendationRow, pool: WarRoomRecommendationRow[]): number {
  const next = comparableRows(row, pool).sort((a, b) => b.recommendationScore - a.recommendationScore)[0];
  return next ? row.recommendationScore - next.recommendationScore : row.recommendationScore;
}

function marketOrder(a: WarRoomRecommendationRow, b: WarRoomRecommendationRow): number {
  return a.recommendationRank - b.recommendationRank || b.recommendationScore - a.recommendationScore || a.displayName.localeCompare(b.displayName);
}

function inferPicksUntilNext(rows: WarRoomRecommendationRow[]): number {
  const known = rows.map((row) => row.draftContext.picksUntilNextUserPick).find((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  if (known) return Math.max(1, Math.min(24, known));
  return Math.max(4, Math.min(12, Math.ceil(rows.length / 4)));
}

function includesRow(rows: WarRoomRecommendationRow[], row: WarRoomRecommendationRow): boolean {
  const key = rowKey(row);
  return rows.some((candidate) => rowKey(candidate) === key);
}

function safetyFindingsFor(row: WarRoomRecommendationRow): string[] {
  const text = [row.primaryReason, ...row.explanationFragments, ...row.needTimingReasons].join(" ").toLowerCase();
  return BANNED_LANGUAGE.filter((term) => text.includes(term)).map((term) => `${row.displayName}: banned language ${term}`);
}

function rowKey(row: WarRoomRecommendationRow): string {
  return row.entityId ?? `${row.displayName}|${row.position ?? ""}`;
}

function normalizePosition(position: string | null | undefined): string {
  const normalized = (position ?? "").trim().toUpperCase();
  if (normalized === "DST" || normalized === "D/ST") return "DEF";
  return normalized;
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 1000;
}
