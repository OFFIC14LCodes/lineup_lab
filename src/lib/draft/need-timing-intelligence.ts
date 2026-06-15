import type { DraftTargetScorePlayer } from "@/lib/draft/scoring";
import type { NormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import { buildWaitTargetPlan, type WaitPlanTarget, type WaitTargetPlan } from "@/lib/draft/wait-target-planning";

export type RosterNeedStatus = "starter_need_open" | "flex_need_open" | "bench_depth_need" | "filled" | "overfilled";
export type NeedUrgency = "low" | "medium" | "high" | "critical";
export type FutureAvailability = "likely_available_next_pick" | "uncertain_available_next_pick" | "unlikely_available_next_pick";
export type TierDropRisk = "low" | "medium" | "high";
export type OpportunityCost = "low" | "medium" | "high";
export type NeedTimingAction = "fill_now" | "wait_one_turn" | "wait_multiple_turns" | "monitor" | "ignore_for_now";
export type SurvivalConfidence = "high" | "medium" | "low";
export type WaitRisk = "low" | "medium" | "high" | "severe";

export type NeedTimingDiagnostic = {
  rosterNeedStatus: RosterNeedStatus;
  needUrgency: NeedUrgency;
  futureAvailability: FutureAvailability;
  tierDropRisk: TierDropRisk;
  opportunityCost: OpportunityCost;
  needTimingAction: NeedTimingAction;
  needTimingModifier: number;
  needTimingReasons: string[];
  survivalConfidence: SurvivalConfidence;
  survivalConfidenceScore: number;
  comparableOptionsNow: number;
  comparableOptionsLikelyNextPick: number;
  comparableOptionsLikelyNextTwoPicks: number;
  waitRisk: WaitRisk;
  waitRiskReasons: string[];
  needTimingAdjustedBySurvival: boolean;
  waitPlanTargets: WaitPlanTarget[];
  waitPlanTargetCount: number;
  waitPlanStrongTargetCount: number;
  waitPlanSurvivalSummary: string;
  waitPlanRisk: WaitRisk;
  waitPlanReason: string;
  waitPlanBacked: boolean;
  waitPlanFallbackAction: NeedTimingAction | null;
  needTimingAdjustedByWaitPlan: boolean;
};

export type BuildNeedTimingInput = {
  candidate: DraftTargetScorePlayer;
  overlay: WarRoomValueOverlayRow | null;
  remainingPlayers: DraftTargetScorePlayer[];
  h10ValueOverlay: WarRoomValueOverlayRow[];
  rosterRequirements: NormalizedRosterRequirements;
  positionCounts?: Record<string, number>;
  currentPickNumber?: number | null;
  currentRound?: number | null;
  picksUntilMyNextPick?: number | null;
};

const IDP_POSITION_ALIASES: Record<string, string> = {
  DE: "DL",
  DT: "DL",
  NT: "DL",
  EDGE: "DL",
  ILB: "LB",
  OLB: "LB",
  MLB: "LB",
  CB: "DB",
  S: "DB",
  FS: "DB",
  SS: "DB",
};
const IDP_POSITIONS = new Set(["DL", "LB", "DB"]);
const FLEX_POSITIONS = new Set(["RB", "WR", "TE"]);

export function buildNeedTimingDiagnostic(input: BuildNeedTimingInput): NeedTimingDiagnostic {
  const position = normalizePosition(input.candidate.position ?? input.overlay?.position ?? null);
  const rosterNeedStatus = classifyRosterNeedStatus(position, input);
  const tierDropRisk = classifyTierDropRisk(position, input);
  const opportunityCost = classifyOpportunityCost(position, input);
  const survival = buildSurvivalModel(position, { ...input, tierDropRisk, rosterNeedStatus });
  const futureAvailability = classifyFutureAvailability(survival);
  const needUrgency = classifyNeedUrgency({ position, rosterNeedStatus, futureAvailability, tierDropRisk, input });
  const rawNeedTimingAction = classifyAction({ rosterNeedStatus, needUrgency, futureAvailability, tierDropRisk, opportunityCost, position, input });
  const survivalAdjustedAction = adjustActionForSurvival({
    rawAction: rawNeedTimingAction,
    rosterNeedStatus,
    needUrgency,
    tierDropRisk,
    position,
    input,
    survival,
  });
  const waitPlan = buildWaitTargetPlan({
    position,
    candidate: input.candidate,
    overlay: input.overlay,
    remainingPlayers: input.remainingPlayers,
    h10ValueOverlay: input.h10ValueOverlay,
    currentPickNumber: input.currentPickNumber,
    picksUntilMyNextPick: input.picksUntilMyNextPick,
    currentRound: input.currentRound,
    needUrgency,
    tierDropRisk,
    proposedAction: survivalAdjustedAction,
  });
  const needTimingAction = adjustActionForWaitPlan(survivalAdjustedAction, waitPlan);
  const needTimingModifier = modifierFor(needTimingAction, needUrgency, opportunityCost);
  const needTimingReasons = buildReasons({
    position,
    rosterNeedStatus,
    needUrgency,
    futureAvailability,
    tierDropRisk,
    opportunityCost,
    needTimingAction,
    survival,
    waitPlan,
    adjusted: needTimingAction !== rawNeedTimingAction,
  });

  return {
    rosterNeedStatus,
    needUrgency,
    futureAvailability,
    tierDropRisk,
    opportunityCost,
    needTimingAction,
    needTimingModifier,
    needTimingReasons,
    survivalConfidence: survival.survivalConfidence,
    survivalConfidenceScore: survival.survivalConfidenceScore,
    comparableOptionsNow: survival.comparableOptionsNow,
    comparableOptionsLikelyNextPick: survival.comparableOptionsLikelyNextPick,
    comparableOptionsLikelyNextTwoPicks: survival.comparableOptionsLikelyNextTwoPicks,
    waitRisk: survival.waitRisk,
    waitRiskReasons: survival.waitRiskReasons,
    needTimingAdjustedBySurvival: survivalAdjustedAction !== rawNeedTimingAction,
    waitPlanTargets: waitPlan.waitPlanTargets,
    waitPlanTargetCount: waitPlan.waitPlanTargetCount,
    waitPlanStrongTargetCount: waitPlan.waitPlanStrongTargetCount,
    waitPlanSurvivalSummary: waitPlan.waitPlanSurvivalSummary,
    waitPlanRisk: waitPlan.waitPlanRisk,
    waitPlanReason: waitPlan.waitPlanReason,
    waitPlanBacked: waitPlan.waitPlanBacked,
    waitPlanFallbackAction: waitPlan.waitPlanFallbackAction,
    needTimingAdjustedByWaitPlan: needTimingAction !== survivalAdjustedAction,
  };
}

function classifyRosterNeedStatus(position: string, input: BuildNeedTimingInput): RosterNeedStatus {
  const current = input.positionCounts?.[position] ?? 0;
  const direct = directRequirement(position, input.rosterRequirements);
  const shared = sharedDemand(position, input.rosterRequirements);
  const minimum = minimumNeed(position, input.rosterRequirements);

  if (current > Math.max(minimum + 1, direct + shared + 1)) return "overfilled";
  if (current < direct) return "starter_need_open";
  if (shared > 0 && current < direct + Math.min(shared, 1)) return "flex_need_open";
  if (current < minimum) return "bench_depth_need";
  return "filled";
}

function classifyFutureAvailability(survival: SurvivalModel): FutureAvailability {
  if (survival.comparableOptionsLikelyNextPick >= 2 && survival.survivalConfidence !== "low") return "likely_available_next_pick";
  if (survival.comparableOptionsLikelyNextPick >= 1 && survival.waitRisk !== "high" && survival.waitRisk !== "severe") return "uncertain_available_next_pick";
  return "unlikely_available_next_pick";
}

function classifyTierDropRisk(position: string, input: BuildNeedTimingInput): TierDropRisk {
  const rows = comparableRows(position, input);
  const sameTier = sameTierRows(position, input);
  const candidateValue = valueFor(input.overlay);
  const nextComparableValue = rows.map(valueFor).filter((value) => value !== null && value < (candidateValue ?? Infinity))[0] ?? null;
  const valueGap = candidateValue !== null && nextComparableValue !== null ? candidateValue - nextComparableValue : 0;

  if (sameTier.length <= 1 || valueGap >= 12) return "high";
  if (sameTier.length <= 3 || valueGap >= 6) return "medium";
  return "low";
}

type SurvivalModel = {
  survivalConfidence: SurvivalConfidence;
  survivalConfidenceScore: number;
  comparableOptionsNow: number;
  comparableOptionsLikelyNextPick: number;
  comparableOptionsLikelyNextTwoPicks: number;
  waitRisk: WaitRisk;
  waitRiskReasons: string[];
};

function buildSurvivalModel(
  position: string,
  input: BuildNeedTimingInput & {
    tierDropRisk: TierDropRisk;
    rosterNeedStatus: RosterNeedStatus;
  }
): SurvivalModel {
  const comparables = comparableCandidates(position, input);
  const picksUntilNext = finiteNumber(input.picksUntilMyNextPick);
  const nextPick = finiteNumber(input.currentPickNumber) !== null && picksUntilNext !== null ? (finiteNumber(input.currentPickNumber) as number) + picksUntilNext : null;
  const nextTwoPick = finiteNumber(input.currentPickNumber) !== null && picksUntilNext !== null ? (finiteNumber(input.currentPickNumber) as number) + picksUntilNext * 2 : null;
  const likelyNext = comparables.filter((candidate) => survivesWindow(candidate, nextPick, picksUntilNext, input, 1));
  const likelyNextTwo = comparables.filter((candidate) => survivesWindow(candidate, nextTwoPick, picksUntilNext !== null ? picksUntilNext * 2 : null, input, 2));
  const scarcityPressure = input.tierDropRisk === "high" ? 20 : input.tierDropRisk === "medium" ? 10 : 0;
  const starterPressure = input.rosterNeedStatus === "starter_need_open" ? 15 : input.rosterNeedStatus === "flex_need_open" ? 8 : 0;
  const positionDepthScore = Math.min(30, comparables.length * 10);
  const nextScore = Math.min(40, likelyNext.length * 20);
  const nextTwoScore = Math.min(15, likelyNextTwo.length * 5);
  const specialTeamsPenalty = (position === "K" || position === "DEF") && (input.currentRound ?? 1) < 13 ? 18 : 0;
  const idpConfidencePenalty = IDP_POSITIONS.has(position) && isLowConfidence(input.overlay) ? 12 : 0;
  const survivalConfidenceScore = clamp(
    positionDepthScore + nextScore + nextTwoScore - scarcityPressure - starterPressure - specialTeamsPenalty - idpConfidencePenalty,
    0,
    100
  );
  const waitRiskReasons: string[] = [];

  if (comparables.length <= 1) waitRiskReasons.push(`${position} has very few comparable options now.`);
  if (likelyNext.length === 0) waitRiskReasons.push(`No comparable ${position} option projects to survive to the next pick.`);
  if (likelyNextTwo.length === 0) waitRiskReasons.push(`No comparable ${position} option projects to survive two turns.`);
  if ((position === "K" || position === "DEF") && (input.currentRound ?? 1) < 13) waitRiskReasons.push(`${position} is still an early/mid draft special-position slot.`);
  if (IDP_POSITIONS.has(position) && isLowConfidence(input.overlay)) waitRiskReasons.push(`${position} projection confidence is low.`);
  if (input.tierDropRisk === "high") waitRiskReasons.push(`${position} tier drop risk is high.`);
  if (input.rosterNeedStatus === "starter_need_open" && likelyNext.length <= 1) waitRiskReasons.push(`${position} starter need has weak survival evidence.`);

  const severe =
    input.rosterNeedStatus === "starter_need_open" &&
    (likelyNext.length === 0 || input.tierDropRisk === "high");
  const high = likelyNext.length === 0 || (input.tierDropRisk === "high" && likelyNext.length <= 1);
  const medium = likelyNext.length <= 1 || survivalConfidenceScore < 58;

  return {
    survivalConfidence: survivalConfidenceScore >= 70 ? "high" : survivalConfidenceScore >= 42 ? "medium" : "low",
    survivalConfidenceScore: round(survivalConfidenceScore),
    comparableOptionsNow: comparables.length,
    comparableOptionsLikelyNextPick: likelyNext.length,
    comparableOptionsLikelyNextTwoPicks: likelyNextTwo.length,
    waitRisk: severe ? "severe" : high ? "high" : medium ? "medium" : "low",
    waitRiskReasons: waitRiskReasons.slice(0, 5),
  };
}

function adjustActionForSurvival(input: {
  rawAction: NeedTimingAction;
  rosterNeedStatus: RosterNeedStatus;
  needUrgency: NeedUrgency;
  tierDropRisk: TierDropRisk;
  position: string;
  input: BuildNeedTimingInput;
  survival: SurvivalModel;
}): NeedTimingAction {
  if (input.rawAction !== "wait_one_turn" && input.rawAction !== "wait_multiple_turns") return input.rawAction;
  if ((input.position === "K" || input.position === "DEF") && (input.input.currentRound ?? 1) < 13) return "wait_multiple_turns";

  const weakSurvival =
    input.survival.survivalConfidence === "low" ||
    input.survival.waitRisk === "high" ||
    input.survival.waitRisk === "severe" ||
    input.survival.comparableOptionsLikelyNextPick === 0;

  if (!weakSurvival) return input.rawAction;
  if (input.needUrgency === "critical" || (input.rosterNeedStatus === "starter_need_open" && input.tierDropRisk === "high")) return "fill_now";
  return "monitor";
}

function adjustActionForWaitPlan(action: NeedTimingAction, waitPlan: WaitTargetPlan): NeedTimingAction {
  if (action !== "wait_one_turn" && action !== "wait_multiple_turns") return action;
  if (waitPlan.waitPlanBacked) return action;
  return waitPlan.waitPlanFallbackAction ?? "monitor";
}

function classifyOpportunityCost(position: string, input: BuildNeedTimingInput): OpportunityCost {
  const candidateValue = valueFor(input.overlay) ?? 0;
  const bestOther = input.h10ValueOverlay
    .filter((row) => normalizePosition(row.position) !== position && row.overlayStatus !== "missing_projection" && row.overlayStatus !== "format_excluded")
    .map(valueFor)
    .filter((value): value is number => value !== null)
    .sort((a, b) => b - a)[0] ?? candidateValue;
  const gap = bestOther - candidateValue;
  if (gap >= 14) return "high";
  if (gap >= 7) return "medium";
  return "low";
}

function classifyNeedUrgency(input: {
  position: string;
  rosterNeedStatus: RosterNeedStatus;
  futureAvailability: FutureAvailability;
  tierDropRisk: TierDropRisk;
  input: BuildNeedTimingInput;
}): NeedUrgency {
  const lateRound = (input.input.currentRound ?? 1) >= 12;
  if (input.position === "K" || input.position === "DEF") {
    if (!lateRound) return "low";
  }
  if (input.rosterNeedStatus === "starter_need_open") {
    if (input.futureAvailability === "unlikely_available_next_pick" && input.tierDropRisk === "high") return "critical";
    if (input.tierDropRisk !== "low" || lateRound) return "high";
    return "medium";
  }
  if (input.rosterNeedStatus === "flex_need_open") return input.tierDropRisk === "high" ? "high" : "medium";
  if (input.rosterNeedStatus === "bench_depth_need") return input.tierDropRisk === "high" ? "medium" : "low";
  return "low";
}

function classifyAction(input: {
  rosterNeedStatus: RosterNeedStatus;
  needUrgency: NeedUrgency;
  futureAvailability: FutureAvailability;
  tierDropRisk: TierDropRisk;
  opportunityCost: OpportunityCost;
  position: string;
  input: BuildNeedTimingInput;
}): NeedTimingAction {
  if (input.rosterNeedStatus === "overfilled") return "ignore_for_now";
  if (input.rosterNeedStatus === "filled") return input.opportunityCost === "low" ? "monitor" : "ignore_for_now";
  if ((input.position === "K" || input.position === "DEF") && (input.input.currentRound ?? 1) < 13) return "wait_multiple_turns";
  if (input.needUrgency === "critical") return "fill_now";
  if (input.needUrgency === "high" && input.futureAvailability === "unlikely_available_next_pick" && input.opportunityCost !== "high") return "fill_now";
  if (input.futureAvailability === "likely_available_next_pick" && input.tierDropRisk === "low" && input.opportunityCost === "high") return "wait_one_turn";
  if (input.futureAvailability === "likely_available_next_pick" && input.rosterNeedStatus === "bench_depth_need") return "wait_multiple_turns";
  if (input.futureAvailability === "likely_available_next_pick") return "wait_one_turn";
  return "monitor";
}

function modifierFor(action: NeedTimingAction, urgency: NeedUrgency, opportunityCost: OpportunityCost): number {
  if (action === "fill_now") return urgency === "critical" ? 22 : 8;
  if (action === "wait_one_turn") return opportunityCost === "high" ? -8 : -5;
  if (action === "wait_multiple_turns") return -10;
  if (action === "ignore_for_now") return -6;
  return 0;
}

function buildReasons(input: {
  position: string;
  rosterNeedStatus: RosterNeedStatus;
  needUrgency: NeedUrgency;
  futureAvailability: FutureAvailability;
  tierDropRisk: TierDropRisk;
  opportunityCost: OpportunityCost;
  needTimingAction: NeedTimingAction;
  survival: SurvivalModel;
  waitPlan: WaitTargetPlan;
  adjusted: boolean;
}): string[] {
  const position = input.position || "position";
  const reasons = [`${position} timing action: ${input.needTimingAction}.`];
  if (input.rosterNeedStatus === "starter_need_open") reasons.push(`${position} remains a starter need.`);
  if (input.rosterNeedStatus === "bench_depth_need") reasons.push(`${position} is a depth need, not a starter need.`);
  if (input.futureAvailability === "likely_available_next_pick") reasons.push(`Comparable ${position} options are likely to be available near the next pick.`);
  if (input.futureAvailability === "unlikely_available_next_pick") reasons.push(`Comparable ${position} options are unlikely to last to the next pick.`);
  reasons.push(`${position} survival confidence is ${input.survival.survivalConfidence} (${input.survival.comparableOptionsLikelyNextPick} likely next-pick comparables).`);
  if (input.needTimingAction === "wait_one_turn" || input.needTimingAction === "wait_multiple_turns") reasons.push(input.waitPlan.waitPlanReason);
  if (input.waitPlan.waitPlanFallbackAction && !input.waitPlan.waitPlanBacked) reasons.push(`Wait plan fallback: ${input.waitPlan.waitPlanFallbackAction}.`);
  if (input.adjusted) reasons.push(`${position} timing was adjusted by survival risk.`);
  if (input.tierDropRisk === "high") reasons.push(`${position} tier drop risk is high.`);
  if (input.opportunityCost === "high") reasons.push("Forcing this need has high opportunity cost versus the board.");
  if (input.needUrgency === "critical") reasons.push(`${position} urgency is critical.`);
  return reasons.slice(0, 5);
}

function comparableRows(position: string, input: BuildNeedTimingInput): WarRoomValueOverlayRow[] {
  return input.h10ValueOverlay
    .filter((row) => normalizePosition(row.position) === position && row.overlayStatus !== "missing_projection" && row.overlayStatus !== "format_excluded")
    .sort((a, b) => (valueFor(b) ?? -9999) - (valueFor(a) ?? -9999));
}

function sameTierRows(position: string, input: BuildNeedTimingInput): WarRoomValueOverlayRow[] {
  if (!input.overlay || input.overlay.tier === null || input.overlay.tier === undefined) return [];
  return comparableRows(position, input).filter((row) => row.tier === input.overlay?.tier);
}

function comparableCandidates(position: string, input: BuildNeedTimingInput) {
  const candidateKey = input.overlay?.entityId ?? input.candidate.matched_player_id ?? input.candidate.sleeper_player_id ?? input.candidate.player_name ?? "";
  return input.h10ValueOverlay
    .map((overlay, index) => ({ overlay, player: input.remainingPlayers[index] }))
    .filter((row) => {
      const key = row.overlay.entityId ?? row.player?.matched_player_id ?? row.player?.sleeper_player_id ?? row.player?.player_name ?? "";
      return key !== candidateKey && normalizePosition(row.overlay.position) === position && row.overlay.overlayStatus !== "missing_projection" && row.overlay.overlayStatus !== "format_excluded";
    })
    .sort((a, b) => {
      const adpDelta = (finiteNumber(a.player?.adp) ?? finiteNumber(a.player?.rank) ?? 9999) - (finiteNumber(b.player?.adp) ?? finiteNumber(b.player?.rank) ?? 9999);
      if (adpDelta) return adpDelta;
      return (valueFor(b.overlay) ?? -9999) - (valueFor(a.overlay) ?? -9999);
    });
}

function survivesWindow(
  candidate: ReturnType<typeof comparableCandidates>[number],
  targetPick: number | null,
  windowPicks: number | null,
  input: BuildNeedTimingInput,
  horizon: 1 | 2
): boolean {
  const adp = finiteNumber(candidate.player?.adp) ?? finiteNumber(candidate.player?.rank);
  const valueGap = (valueFor(input.overlay) ?? 0) - (valueFor(candidate.overlay) ?? 0);
  const buffer = horizon === 1 ? 4 : 8;
  if (targetPick !== null && adp !== null && adp <= targetPick + buffer) return false;
  if (candidate.overlay.tier != null && input.overlay?.tier != null && candidate.overlay.tier > input.overlay.tier + 1 && valueGap >= 8) return false;
  if (windowPicks !== null && adp === null) {
    const conservativePositionDepletion = Math.max(1, Math.ceil(windowPicks / 5));
    const positionRank = comparableCandidates(normalizePosition(candidate.overlay.position), input).findIndex((row) => row.overlay === candidate.overlay) + 1;
    return positionRank > conservativePositionDepletion;
  }
  return true;
}

function valueFor(row: WarRoomValueOverlayRow | null): number | null {
  if (!row) return null;
  return finiteNumber(row.riskAdjustedValue) ?? finiteNumber(row.pointsAboveReplacement);
}

function directRequirement(position: string, requirements: NormalizedRosterRequirements): number {
  if (position === "DEF") return requirements.directStarters.DEF;
  return requirements.directStarters[position as keyof NormalizedRosterRequirements["directStarters"]] ?? 0;
}

function sharedDemand(position: string, requirements: NormalizedRosterRequirements): number {
  if (position === "QB") return requirements.superflexCount;
  if (FLEX_POSITIONS.has(position)) return requirements.offensiveFlexCount + requirements.superflexCount;
  if (IDP_POSITIONS.has(position)) return requirements.idpFlexCount;
  return 0;
}

function minimumNeed(position: string, requirements: NormalizedRosterRequirements): number {
  const direct = directRequirement(position, requirements);
  const shared = sharedDemand(position, requirements);
  if (position === "QB") return direct + Math.min(shared, 1);
  if (position === "RB" || position === "WR") return direct + (shared > 0 ? 1 : 0) + (requirements.benchCount > 0 ? 1 : 0);
  if (position === "TE") return direct + (shared >= 2 ? 1 : 0);
  if (IDP_POSITIONS.has(position)) return direct + (shared > 0 ? 1 : 0) + (requirements.benchCount > 0 ? 1 : 0);
  return direct;
}

function normalizePosition(position: string | null | undefined): string {
  const normalized = (position ?? "").trim().toUpperCase();
  if (normalized === "DST" || normalized === "D/ST") return "DEF";
  return IDP_POSITION_ALIASES[normalized] ?? normalized;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isLowConfidence(row: WarRoomValueOverlayRow | null): boolean {
  return row?.confidenceLabel === "low" || row?.confidenceLabel === "very_low" || row?.warningCodes.includes("LOW_PROJECTION_CONFIDENCE") === true;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
