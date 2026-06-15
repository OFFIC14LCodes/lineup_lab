import type { DraftTargetScorePlayer } from "@/lib/draft/scoring";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import type { NeedTimingAction, NeedUrgency, TierDropRisk, WaitRisk } from "@/lib/draft/need-timing-intelligence";

export type WaitPlanTarget = {
  displayName: string;
  position: string | null;
  team: string | null;
  projectedValue: number | null;
  adp: number | null;
  tier: number | null;
  survivalEstimate: "likely" | "uncertain" | "unlikely";
  usability: "starter_usable" | "depth_only" | "replacement_level";
  confidence: "strong" | "usable" | "weak";
  reasons: string[];
};

export type WaitTargetPlan = {
  waitPlanTargets: WaitPlanTarget[];
  waitPlanTargetCount: number;
  waitPlanStrongTargetCount: number;
  waitPlanSurvivalSummary: string;
  waitPlanRisk: WaitRisk;
  waitPlanReason: string;
  waitPlanBacked: boolean;
  waitPlanFallbackAction: NeedTimingAction | null;
};

export type BuildWaitTargetPlanInput = {
  position: string;
  candidate: DraftTargetScorePlayer;
  overlay: WarRoomValueOverlayRow | null;
  remainingPlayers: DraftTargetScorePlayer[];
  h10ValueOverlay: WarRoomValueOverlayRow[];
  currentPickNumber?: number | null;
  picksUntilMyNextPick?: number | null;
  currentRound?: number | null;
  needUrgency: NeedUrgency;
  tierDropRisk: TierDropRisk;
  proposedAction: NeedTimingAction;
};

const IDP_POSITIONS = new Set(["DL", "LB", "DB"]);
const BANNED_LANGUAGE = ["must draft", "guaranteed", "best pick", "ai advice", "lock", "can't miss", "should draft"];

export function buildWaitTargetPlan(input: BuildWaitTargetPlanInput): WaitTargetPlan {
  const targets = comparableTargets(input)
    .map((target) => scoreTarget(target, input))
    .filter((target) => target.confidence !== "weak")
    .slice(0, 5);
  const strongTargets = targets.filter((target) => target.confidence === "strong");
  const requiredStrong = input.needUrgency === "critical" || input.tierDropRisk === "high" ? 2 : input.proposedAction === "wait_multiple_turns" ? 2 : 1;
  const requiredTotal = input.proposedAction === "wait_multiple_turns" ? 3 : 2;
  const specialPosition = input.position === "K" || input.position === "DEF";
  const backed = specialPosition
    ? targets.length >= 1 || (input.currentRound ?? 1) < 13
    : strongTargets.length >= requiredStrong && targets.length >= requiredTotal;
  const risk = backed
    ? strongTargets.length >= 2 ? "low" : "medium"
    : targets.length === 0 ? "severe" : "high";
  const fallbackAction = backed
    ? null
    : input.needUrgency === "critical" || input.tierDropRisk === "high"
      ? "fill_now"
      : "monitor";

  return {
    waitPlanTargets: targets,
    waitPlanTargetCount: targets.length,
    waitPlanStrongTargetCount: strongTargets.length,
    waitPlanSurvivalSummary: `${targets.filter((target) => target.survivalEstimate === "likely").length} likely, ${targets.filter((target) => target.survivalEstimate === "uncertain").length} uncertain wait targets.`,
    waitPlanRisk: risk,
    waitPlanReason: sanitizeReason(
      backed
        ? `Wait plan has ${targets.length} comparable ${input.position} targets, including ${strongTargets.length} strong target${strongTargets.length === 1 ? "" : "s"}.`
        : `Wait risk ${risk}; only ${targets.length} comparable ${input.position} target${targets.length === 1 ? "" : "s"} support waiting.`
    ),
    waitPlanBacked: backed,
    waitPlanFallbackAction: fallbackAction,
  };
}

function comparableTargets(input: BuildWaitTargetPlanInput) {
  const candidateKey = rowKey(input.overlay, input.candidate);
  return input.h10ValueOverlay
    .map((overlay, index) => ({ overlay, player: input.remainingPlayers[index] }))
    .filter((row) => {
      if (rowKey(row.overlay, row.player) === candidateKey) return false;
      if (normalizePosition(row.overlay.position) !== input.position) return false;
      if (row.overlay.overlayStatus === "missing_projection" || row.overlay.overlayStatus === "format_excluded") return false;
      return true;
    })
    .sort((a, b) => (valueFor(b.overlay) ?? -9999) - (valueFor(a.overlay) ?? -9999));
}

function scoreTarget(
  target: ReturnType<typeof comparableTargets>[number],
  input: BuildWaitTargetPlanInput
): WaitPlanTarget {
  const targetValue = valueFor(target.overlay);
  const candidateValue = valueFor(input.overlay);
  const valueGap = candidateValue !== null && targetValue !== null ? candidateValue - targetValue : 0;
  const targetAdp = finiteNumber(target.player?.adp) ?? finiteNumber(target.player?.rank);
  const nextPick = finiteNumber(input.currentPickNumber) !== null && finiteNumber(input.picksUntilMyNextPick) !== null
    ? (finiteNumber(input.currentPickNumber) as number) + (finiteNumber(input.picksUntilMyNextPick) as number)
    : null;
  const likelyByAdp = targetAdp === null || nextPick === null || targetAdp > nextPick + 4;
  const sameTier = input.overlay?.tier != null && target.overlay.tier === input.overlay.tier;
  const severeTierDrop = input.overlay?.tier != null && target.overlay.tier != null && target.overlay.tier > input.overlay.tier + 1 && valueGap >= 8;
  const lowConfidence = target.overlay.confidenceLabel === "low" || target.overlay.confidenceLabel === "very_low" || target.overlay.warningCodes.includes("LOW_PROJECTION_CONFIDENCE");
  const specialPosition = input.position === "K" || input.position === "DEF";
  const idpLowConfidence = IDP_POSITIONS.has(input.position) && lowConfidence;
  const usability = valueGap <= 6 || sameTier ? "starter_usable" : valueGap <= 12 ? "depth_only" : "replacement_level";
  const survivalEstimate = likelyByAdp && !severeTierDrop ? "likely" : severeTierDrop ? "unlikely" : "uncertain";
  const strong = survivalEstimate === "likely" && usability === "starter_usable" && !idpLowConfidence && (sameTier || valueGap <= 6);

  return {
    displayName: target.overlay.displayName,
    position: target.overlay.position,
    team: target.overlay.team,
    projectedValue: targetValue,
    adp: targetAdp,
    tier: target.overlay.tier,
    survivalEstimate,
    usability,
    confidence: strong ? "strong" : survivalEstimate !== "unlikely" && usability !== "replacement_level" && !idpLowConfidence ? "usable" : specialPosition ? "usable" : "weak",
    reasons: [
      sameTier ? "same tier" : null,
      valueGap <= 6 ? "close value" : null,
      likelyByAdp ? "market timing survives" : "market timing risk",
      idpLowConfidence ? "low-confidence IDP target" : null,
    ].filter((reason): reason is string => Boolean(reason)),
  };
}

function rowKey(overlay: WarRoomValueOverlayRow | null, player?: DraftTargetScorePlayer): string {
  return overlay?.entityId ?? player?.matched_player_id ?? player?.sleeper_player_id ?? player?.player_name ?? "";
}

function valueFor(row: WarRoomValueOverlayRow | null): number | null {
  if (!row) return null;
  return finiteNumber(row.riskAdjustedValue) ?? finiteNumber(row.pointsAboveReplacement);
}

function normalizePosition(position: string | null | undefined): string {
  const normalized = (position ?? "").trim().toUpperCase();
  if (normalized === "DST" || normalized === "D/ST") return "DEF";
  if (["DE", "DT", "NT", "EDGE"].includes(normalized)) return "DL";
  if (["ILB", "OLB", "MLB"].includes(normalized)) return "LB";
  if (["CB", "S", "FS", "SS"].includes(normalized)) return "DB";
  return normalized;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sanitizeReason(reason: string): string {
  let safe = reason;
  for (const banned of BANNED_LANGUAGE) safe = safe.replace(new RegExp(banned, "gi"), "target");
  return safe;
}
