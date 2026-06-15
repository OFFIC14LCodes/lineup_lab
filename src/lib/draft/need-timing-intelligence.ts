import type { DraftTargetScorePlayer } from "@/lib/draft/scoring";
import type { NormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";

export type RosterNeedStatus = "starter_need_open" | "flex_need_open" | "bench_depth_need" | "filled" | "overfilled";
export type NeedUrgency = "low" | "medium" | "high" | "critical";
export type FutureAvailability = "likely_available_next_pick" | "uncertain_available_next_pick" | "unlikely_available_next_pick";
export type TierDropRisk = "low" | "medium" | "high";
export type OpportunityCost = "low" | "medium" | "high";
export type NeedTimingAction = "fill_now" | "wait_one_turn" | "wait_multiple_turns" | "monitor" | "ignore_for_now";

export type NeedTimingDiagnostic = {
  rosterNeedStatus: RosterNeedStatus;
  needUrgency: NeedUrgency;
  futureAvailability: FutureAvailability;
  tierDropRisk: TierDropRisk;
  opportunityCost: OpportunityCost;
  needTimingAction: NeedTimingAction;
  needTimingModifier: number;
  needTimingReasons: string[];
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
  const futureAvailability = classifyFutureAvailability(position, input);
  const tierDropRisk = classifyTierDropRisk(position, input);
  const opportunityCost = classifyOpportunityCost(position, input);
  const needUrgency = classifyNeedUrgency({ position, rosterNeedStatus, futureAvailability, tierDropRisk, input });
  const needTimingAction = classifyAction({ rosterNeedStatus, needUrgency, futureAvailability, tierDropRisk, opportunityCost, position, input });
  const needTimingModifier = modifierFor(needTimingAction, needUrgency, opportunityCost);
  const needTimingReasons = buildReasons({
    position,
    rosterNeedStatus,
    needUrgency,
    futureAvailability,
    tierDropRisk,
    opportunityCost,
    needTimingAction,
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

function classifyFutureAvailability(position: string, input: BuildNeedTimingInput): FutureAvailability {
  const currentPick = input.currentPickNumber;
  const picksUntilNext = input.picksUntilMyNextPick;
  const nextPick = currentPick !== null && currentPick !== undefined && picksUntilNext !== null && picksUntilNext !== undefined
    ? currentPick + picksUntilNext
    : null;
  const candidateAdp = finiteNumber(input.candidate.adp);
  const samePositionDepth = comparableRows(position, input).length;
  const sameTierDepth = sameTierRows(position, input).length;

  if (nextPick === null) return samePositionDepth >= 4 ? "uncertain_available_next_pick" : "unlikely_available_next_pick";
  if (candidateAdp !== null) {
    if (candidateAdp >= nextPick + 8 && samePositionDepth >= 3) return "likely_available_next_pick";
    if (candidateAdp >= nextPick - 2 && samePositionDepth >= 2) return sameTierDepth >= 2 ? "likely_available_next_pick" : "uncertain_available_next_pick";
    if (candidateAdp <= nextPick) return "unlikely_available_next_pick";
  }
  if (sameTierDepth <= Math.max(1, Math.ceil((picksUntilNext ?? 0) / 8))) return "unlikely_available_next_pick";
  return samePositionDepth >= 4 ? "likely_available_next_pick" : "uncertain_available_next_pick";
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
}): string[] {
  const position = input.position || "position";
  const reasons = [`${position} timing action: ${input.needTimingAction}.`];
  if (input.rosterNeedStatus === "starter_need_open") reasons.push(`${position} remains a starter need.`);
  if (input.rosterNeedStatus === "bench_depth_need") reasons.push(`${position} is a depth need, not a starter need.`);
  if (input.futureAvailability === "likely_available_next_pick") reasons.push(`Comparable ${position} options are likely to be available near the next pick.`);
  if (input.futureAvailability === "unlikely_available_next_pick") reasons.push(`Comparable ${position} options are unlikely to last to the next pick.`);
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
