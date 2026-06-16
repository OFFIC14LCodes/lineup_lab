import type { BlackbirdBoardRow } from "@/lib/draft/blackbird-board";
export type LivePlanStrategy = {
  leagueSummary: {
    superflexOr2Qb: boolean;
    tePremium: boolean;
    idp: boolean;
    kicker: boolean;
    teamDefense: boolean;
    flexStructure: string[];
    startingRequirements?: Record<string, number>;
  };
  roundWindowPlanDetailed?: Array<{
    window: string;
    rounds: string;
    primaryPositions: string[];
    avoidForcingPositions: string[];
    likelyValuePockets: string[];
    tierCliffRisks: string[];
    contingencyTriggers: string[];
    fallbackPath: string;
    guidance: string;
  }>;
  contingencyTriggers?: Array<{
    id: string;
    label: string;
    appliesToRounds: number[];
    appliesToPositions: string[];
    triggerConditionSummary: string;
    suggestedAdjustment: string;
    riskLevel: "low" | "medium" | "high";
    confidence: "low" | "medium" | "high";
    reasons: string[];
  }>;
  doNotForcePositions: Array<{ position: string; reason: string }>;
  waitPositions: Array<{ position: string; confidence: string; reason: string; targetCount: number }>;
  roundWindowTierRisks?: Array<{ window: string; positions: string[]; riskLevel: "low" | "medium" | "high"; reason: string }>;
};

export type LivePlanOverallStatus =
  | "pre_draft"
  | "on_plan"
  | "slightly_off_plan"
  | "contingency_active"
  | "off_plan_recoverable"
  | "needs_attention"
  | "insufficient_data";

export type LivePlanFit =
  | "strong_fit"
  | "acceptable_fit"
  | "value_detour"
  | "contingency_fit"
  | "depth_only"
  | "avoid_forcing"
  | "insufficient_data";

export type LiveTriggeredContingency = {
  contingencyId: string;
  label: string;
  triggerReason: string;
  suggestedAdjustment: string;
  riskLevel: "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
  relatedPositions: string[];
  relatedPlayerIds: string[];
};

export type LivePositionPlanStatus = {
  position: string;
  plannedWindow: string | null;
  rosterCount: number;
  targetCount: number | null;
  status: "ahead" | "on_track" | "thin" | "behind" | "intentionally_waiting" | "avoid_forcing" | "insufficient_data";
  summary: string;
  reasons: string[];
};

export type LiveRosterConstructionStatus = {
  status: "balanced" | "thin_spots" | "overexposed" | "insufficient_data";
  summary: string;
  thinPositions: string[];
  aheadPositions: string[];
  overexposedPositions: string[];
};

export type LiveTierRiskStatus = {
  position: string;
  riskLevel: "low" | "medium" | "high";
  summary: string;
  relatedPlayerIds: string[];
};

export type LiveValueFallStatus = {
  playerId: string | null;
  playerName: string;
  position: string | null;
  blackbirdRank: number;
  valueScore: number | null;
  signal: "unexpected_contextual_value" | "none";
  summary: string;
};

export type LiveWaitPlanStatus = {
  position: string;
  status: "supported" | "weakening" | "dangerous" | "not_waiting";
  targetCount: number;
  summary: string;
  relatedPlayerIds: string[];
};

export type LiveRecommendedFocus = {
  label: string;
  priority: "low" | "medium" | "high";
  positions: string[];
  playerIds: string[];
  reason: string;
};

export type LivePlanStatus = {
  draftRoomId: string;
  currentPickNumber: number | null;
  currentRound: number | null;
  myDraftSlot: number | null;
  myNextPickNumber: number | null;
  picksUntilMyTurn: number | null;
  overallStatus: LivePlanOverallStatus;
  statusLabel: string;
  statusSummary: string;
  activeRoundWindowIds: string[];
  activeContingencyIds: string[];
  triggeredContingencies: LiveTriggeredContingency[];
  positionPlanStatus: LivePositionPlanStatus[];
  rosterConstructionStatus: LiveRosterConstructionStatus;
  tierRiskStatus: LiveTierRiskStatus[];
  valueFallStatus: LiveValueFallStatus[];
  waitPlanStatus: LiveWaitPlanStatus[];
  recommendedFocus: LiveRecommendedFocus[];
  dataGaps: string[];
  safetyNotes: string[];
};

export type LivePlanStatusInput = {
  draftRoomId: string;
  currentPickNumber: number | null;
  currentRound: number | null;
  myDraftSlot: number | null;
  teamCount: number | null;
  picksUntilMyTurn: number | null;
  positionCounts: Record<string, number>;
  strategy: LivePlanStrategy | null;
  boardRows: BlackbirdBoardRow[];
  draftedPlayerIds?: string[];
};

const BANNED_LIVE_PLAN_TERMS = [
  "must draft",
  "guaranteed",
  "lock",
  "can't miss",
  "can’t miss",
  "best pick",
  "final recommendation",
  "you should draft",
] as const;
const OFFENSE = new Set(["QB", "RB", "WR", "TE"]);
const IDP = new Set(["DL", "LB", "DB"]);
const SPECIAL = new Set(["K", "DEF"]);

export function buildLivePlanStatus(input: LivePlanStatusInput): LivePlanStatus {
  const state = cloneInput(input);
  const strategy = state.strategy;
  const currentRound = finiteNumber(state.currentRound);
  const currentPickNumber = finiteNumber(state.currentPickNumber);
  const dataGaps = new Set<string>();
  if (!strategy) dataGaps.add("missing pre-draft strategy");
  if (currentPickNumber === null) dataGaps.add("missing current pick");
  if (currentRound === null) dataGaps.add("missing current round");
  if (state.myDraftSlot === null) dataGaps.add("missing draft slot");
  if (state.teamCount === null) dataGaps.add("missing team count");
  if (!state.boardRows.length) dataGaps.add("missing Blackbird board rows");

  const activeWindows = strategy && currentRound !== null ? activeRoundWindows(strategy, currentRound) : [];
  const positionPlanStatus = strategy
    ? buildPositionPlanStatus(strategy, state.positionCounts, currentRound, state.boardRows)
    : [];
  const rosterConstructionStatus = buildRosterConstructionStatus(positionPlanStatus);
  const tierRiskStatus = buildTierRiskStatus(strategy, state.boardRows, currentRound);
  const waitPlanStatus = buildWaitPlanStatus(strategy, state.boardRows);
  const valueFallStatus = buildValueFallStatus(state.boardRows, currentPickNumber);
  const triggeredContingencies = buildTriggeredContingencies(strategy, currentRound, positionPlanStatus, tierRiskStatus, waitPlanStatus, valueFallStatus);
  const recommendedFocus = buildRecommendedFocus(positionPlanStatus, tierRiskStatus, waitPlanStatus, valueFallStatus, triggeredContingencies);
  const overallStatus = deriveOverallStatus({
    preDraft: (currentPickNumber ?? 1) <= 1 && !(state.draftedPlayerIds?.length ?? 0),
    dataGaps: dataGaps.size,
    triggeredContingencies,
    positionPlanStatus,
    tierRiskStatus,
    waitPlanStatus,
  });
  const statusLabel = labelForStatus(overallStatus);
  const statusSummary = summaryForStatus(overallStatus, recommendedFocus, activeWindows);
  const myNextPickNumber =
    currentPickNumber !== null && state.picksUntilMyTurn !== null ? currentPickNumber + Math.max(0, state.picksUntilMyTurn) : null;

  const output: LivePlanStatus = {
    draftRoomId: state.draftRoomId,
    currentPickNumber,
    currentRound,
    myDraftSlot: finiteNumber(state.myDraftSlot),
    myNextPickNumber,
    picksUntilMyTurn: finiteNumber(state.picksUntilMyTurn),
    overallStatus,
    statusLabel,
    statusSummary,
    activeRoundWindowIds: activeWindows.map((window) => window.window),
    activeContingencyIds: triggeredContingencies.map((trigger) => trigger.contingencyId),
    triggeredContingencies,
    positionPlanStatus,
    rosterConstructionStatus,
    tierRiskStatus,
    valueFallStatus,
    waitPlanStatus,
    recommendedFocus,
    dataGaps: Array.from(dataGaps).sort(),
    safetyNotes: [
      "Read-only live plan status.",
      "Contextual Blackbird Rank remains the primary board rank.",
      "H10 timing can inform plan fit but does not replace contextual rank.",
    ],
  };
  const banned = findBannedLivePlanLanguage(JSON.stringify(output));
  return banned.length ? { ...output, dataGaps: [...output.dataGaps, ...banned.map((term) => `unsafe language: ${term}`)] } : output;
}

export function applyLivePlanFitToBoardRows(rows: BlackbirdBoardRow[], status: LivePlanStatus | null): BlackbirdBoardRow[] {
  return rows.map((row) => {
    const fit = buildPlanFit(row, status);
    return {
      ...row,
      planFit: fit.planFit,
      planFitReasons: fit.planFitReasons,
    };
  });
}

export function findBannedLivePlanLanguage(text: string): string[] {
  const normalized = text.toLowerCase();
  return BANNED_LIVE_PLAN_TERMS.filter((phrase) => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\W)${escaped}(\\W|$)`, "i").test(normalized);
  });
}

function buildPlanFit(row: BlackbirdBoardRow, status: LivePlanStatus | null): { planFit: LivePlanFit; planFitReasons: string[] } {
  if (!status) return { planFit: "insufficient_data", planFitReasons: ["Live plan status is unavailable."] };
  const position = normalizePosition(row.position);
  const reasons: string[] = [];
  const activePosition = status.positionPlanStatus.find((item) => item.position === position);
  const activeContingency = status.triggeredContingencies.find((item) => item.relatedPositions.includes(position));
  const wait = status.waitPlanStatus.find((item) => item.position === position);
  const tierRisk = status.tierRiskStatus.find((item) => item.position === position && item.riskLevel !== "low");
  const valueFall = status.valueFallStatus.find((item) => item.playerId === row.playerId || item.playerName === row.playerName);

  if (activePosition?.plannedWindow) reasons.push("Fits active round window.");
  if (activeContingency) reasons.push("Fits active contingency.");
  if (activePosition?.status === "thin" || activePosition?.status === "behind") reasons.push("Fills roster thin spot.");
  if (valueFall?.signal === "unexpected_contextual_value") reasons.push("Unexpected contextual value signal.");
  if (wait?.status === "supported") reasons.push("Position can likely wait.");
  if (wait?.status === "weakening" || wait?.status === "dangerous") reasons.push("Wait targets are drying up.");
  if (tierRisk) reasons.push("Tier risk is rising.");
  if (IDP.has(position) && (row.confidence === "low" || row.contextualDataGaps.length > 0)) reasons.push("IDP data quality caveat is visible.");
  if (SPECIAL.has(position)) reasons.push("Avoid forcing K/DST before late-window evidence.");
  if (row.contextualDataGaps.some((gap) => /snap|depth|situation|role/i.test(gap))) reasons.push("Situation, snap, or depth-chart data is unavailable.");

  if (SPECIAL.has(position) && (status.currentRound ?? 1) < 10) return { planFit: "avoid_forcing", planFitReasons: unique(reasons) };
  if (activeContingency) return { planFit: "contingency_fit", planFitReasons: unique(reasons) };
  if (valueFall?.signal === "unexpected_contextual_value") return { planFit: "value_detour", planFitReasons: unique(reasons) };
  if (activePosition?.status === "thin" || activePosition?.status === "behind") return { planFit: "strong_fit", planFitReasons: unique(reasons) };
  if (wait?.status === "supported") return { planFit: "acceptable_fit", planFitReasons: unique(reasons) };
  if (!row.dataStatus.projection || row.dataStatus.projection === "unavailable") return { planFit: "insufficient_data", planFitReasons: unique(reasons) };
  return { planFit: row.blackbirdBoardRank <= 24 ? "acceptable_fit" : "depth_only", planFitReasons: unique(reasons.length ? reasons : ["Plan fit uses contextual rank and live roster state."]) };
}

function buildPositionPlanStatus(
  strategy: LivePlanStrategy,
  counts: Record<string, number>,
  currentRound: number | null,
  boardRows: BlackbirdBoardRow[]
): LivePositionPlanStatus[] {
  const positions = new Set<string>(["QB", "RB", "WR", "TE", ...Object.keys(strategy.leagueSummary.startingRequirements ?? {})]);
  if (strategy.leagueSummary.idp) ["DL", "LB", "DB"].forEach((position) => positions.add(position));
  if (strategy.leagueSummary.kicker) positions.add("K");
  if (strategy.leagueSummary.teamDefense) positions.add("DEF");
  return [...positions].filter(Boolean).sort().map((position) => {
    const targetCount = targetForPosition(strategy, position);
    const rosterCount = counts[position] ?? 0;
    const plannedWindow = findWindowForPosition(strategy, position, currentRound);
    const avoid = strategy.doNotForcePositions.some((item) => normalizePosition(item.position) === position);
    const wait = strategy.waitPositions.find((item) => normalizePosition(item.position) === position);
    const availableTop = boardRows.find((row) => normalizePosition(row.position) === position);
    let status: LivePositionPlanStatus["status"] = "on_track";
    const reasons: string[] = [];
    if (targetCount === null) status = "insufficient_data";
    else if (rosterCount > targetCount) status = "ahead";
    else if (avoid && rosterCount >= targetCount) status = "avoid_forcing";
    else if (wait && rosterCount < targetCount) status = wait.targetCount > 0 ? "intentionally_waiting" : "thin";
    else if (rosterCount < targetCount && plannedWindow) status = availableTop && availableTop.blackbirdBoardRank <= 36 ? "thin" : "behind";
    else if (rosterCount < targetCount) status = "thin";
    if (plannedWindow) reasons.push(`${position} is in the active or nearby round window.`);
    if (wait) reasons.push(wait.reason);
    if (avoid) reasons.push(`${position} has avoid-forcing guidance.`);
    if (availableTop) reasons.push(`Top available ${position} is Blackbird rank ${availableTop.blackbirdBoardRank}.`);
    return {
      position,
      plannedWindow,
      rosterCount,
      targetCount,
      status,
      summary: summaryForPosition(position, status, rosterCount, targetCount),
      reasons: reasons.length ? reasons : [`${position} is monitored against roster count and current round.`],
    };
  });
}

function buildRosterConstructionStatus(positions: LivePositionPlanStatus[]): LiveRosterConstructionStatus {
  const thinPositions = positions.filter((row) => row.status === "thin" || row.status === "behind").map((row) => row.position);
  const aheadPositions = positions.filter((row) => row.status === "ahead").map((row) => row.position);
  const overexposedPositions = positions.filter((row) => row.targetCount !== null && row.rosterCount >= row.targetCount + 2).map((row) => row.position);
  const status = !positions.length ? "insufficient_data" : overexposedPositions.length ? "overexposed" : thinPositions.length ? "thin_spots" : "balanced";
  return {
    status,
    summary:
      status === "balanced"
        ? "Roster construction is tracking the current plan."
        : status === "overexposed"
          ? "One or more positions are ahead of target; avoid over-pushing those spots."
          : status === "thin_spots"
            ? "One or more planned positions are thin versus target."
            : "Roster construction needs more draft state.",
    thinPositions,
    aheadPositions,
    overexposedPositions,
  };
}

function buildTierRiskStatus(strategy: LivePlanStrategy | null, rows: BlackbirdBoardRow[], currentRound: number | null): LiveTierRiskStatus[] {
  const plannedRisk = new Set<string>();
  for (const risk of strategy?.roundWindowTierRisks ?? []) {
    if (risk.riskLevel !== "low") risk.positions.forEach((position) => plannedRisk.add(normalizePosition(position)));
  }
  return [...new Set([...plannedRisk, ...rows.filter((row) => row.risk === "high" || row.needTimingAction === "fill_now").map((row) => normalizePosition(row.position))])]
    .filter(Boolean)
    .sort()
    .map((position) => {
      const relatedRows = rows.filter((row) => normalizePosition(row.position) === position).slice(0, 3);
      const urgent = relatedRows.some((row) => row.needTimingAction === "fill_now" || row.risk === "high");
      const riskLevel = urgent || plannedRisk.has(position) ? "high" : currentRound && currentRound >= 8 ? "medium" : "low";
      return {
        position,
        riskLevel,
        summary: riskLevel === "high" ? `${position} tier risk rising.` : `${position} tier risk is monitored.`,
        relatedPlayerIds: relatedRows.map((row) => row.playerId).filter((id): id is string => Boolean(id)),
      };
    });
}

function buildValueFallStatus(rows: BlackbirdBoardRow[], currentPickNumber: number | null): LiveValueFallStatus[] {
  return rows
    .filter((row) => {
      if (row.blackbirdBoardRank > 12) return false;
      if ((row.blackbirdValueScore ?? 0) >= 62) return true;
      if (currentPickNumber === null || currentPickNumber <= 1) return false;
      return currentPickNumber - row.blackbirdBoardRank >= 12 || (row.adp !== null && currentPickNumber - row.adp >= 12);
    })
    .slice(0, 5)
    .map((row) => {
      const hasBlackbirdFall = currentPickNumber !== null && currentPickNumber > 1 && currentPickNumber - row.blackbirdBoardRank >= 12;
      const hasMarketFall = currentPickNumber !== null && currentPickNumber > 1 && row.adp !== null && currentPickNumber - row.adp >= 12;
      const signal: LiveValueFallStatus["signal"] = hasBlackbirdFall || hasMarketFall ? "unexpected_contextual_value" : "none";
      return {
        playerId: row.playerId,
        playerName: row.playerName,
        position: row.position,
        blackbirdRank: row.blackbirdBoardRank,
        valueScore: row.blackbirdValueScore,
        signal,
        summary: signal === "unexpected_contextual_value" ? `${row.playerName} is a contextual value signal.` : `${row.playerName} remains a monitored board value.`,
      };
    })
    .filter((row) => row.signal !== "none");
}

function buildWaitPlanStatus(strategy: LivePlanStrategy | null, rows: BlackbirdBoardRow[]): LiveWaitPlanStatus[] {
  const positions = new Set<string>((strategy?.waitPositions ?? []).map((row) => normalizePosition(row.position)));
  rows.filter((row) => row.needTimingAction?.startsWith("wait")).forEach((row) => positions.add(normalizePosition(row.position)));
  return [...positions].filter(Boolean).sort().map((position) => {
    const strategyWait = strategy?.waitPositions.find((row) => normalizePosition(row.position) === position);
    const boardMatches = rows.filter((row) => normalizePosition(row.position) === position && row.blackbirdBoardRank <= 80);
    const targetCount = Math.max(strategyWait?.targetCount ?? 0, boardMatches.filter((row) => (row.waitPlanTargetCount ?? 0) > 0).length);
    const highRisk = boardMatches.some((row) => row.risk === "high" || row.needTimingAction === "fill_now");
    const status = highRisk && targetCount === 0 ? "dangerous" : targetCount === 0 ? "weakening" : "supported";
    return {
      position,
      status,
      targetCount,
      summary:
        status === "supported"
          ? `${position} wait plan still supported.`
          : status === "weakening"
            ? `${position} wait plan weakening.`
            : `${position} wait plan dangerous.`,
      relatedPlayerIds: boardMatches.slice(0, 4).map((row) => row.playerId).filter((id): id is string => Boolean(id)),
    };
  });
}

function buildTriggeredContingencies(
  strategy: LivePlanStrategy | null,
  currentRound: number | null,
  positions: LivePositionPlanStatus[],
  tierRisks: LiveTierRiskStatus[],
  waits: LiveWaitPlanStatus[],
  values: LiveValueFallStatus[]
): LiveTriggeredContingency[] {
  const triggers: LiveTriggeredContingency[] = [];
  for (const trigger of strategy?.contingencyTriggers ?? []) {
    const roundApplies = currentRound === null || trigger.appliesToRounds.includes(currentRound);
    const relatedPositions = trigger.appliesToPositions.map(normalizePosition).filter(Boolean);
    const positionIssue = positions.some((row) => relatedPositions.includes(row.position) && ["thin", "behind", "intentionally_waiting"].includes(row.status));
    const tierIssue = tierRisks.some((row) => relatedPositions.includes(row.position) && row.riskLevel !== "low");
    const waitIssue = waits.some((row) => relatedPositions.includes(row.position) && row.status !== "supported");
    const valueIssue = values.some((row) => row.position && relatedPositions.includes(normalizePosition(row.position)));
    if (!roundApplies || !(positionIssue || tierIssue || waitIssue || valueIssue)) continue;
    triggers.push({
      contingencyId: trigger.id,
      label: trigger.label,
      triggerReason: trigger.triggerConditionSummary,
      suggestedAdjustment: trigger.suggestedAdjustment,
      riskLevel: trigger.riskLevel,
      confidence: trigger.confidence,
      relatedPositions,
      relatedPlayerIds: values.filter((row) => row.position && relatedPositions.includes(normalizePosition(row.position))).map((row) => row.playerId).filter((id): id is string => Boolean(id)),
    });
  }
  return triggers.slice(0, 6);
}

function buildRecommendedFocus(
  positions: LivePositionPlanStatus[],
  tierRisks: LiveTierRiskStatus[],
  waits: LiveWaitPlanStatus[],
  values: LiveValueFallStatus[],
  contingencies: LiveTriggeredContingency[]
): LiveRecommendedFocus[] {
  const focus: LiveRecommendedFocus[] = [];
  const thin = positions.filter((row) => row.status === "thin" || row.status === "behind").slice(0, 3);
  if (thin.length) focus.push({ label: "Roster thin spot", priority: "high", positions: thin.map((row) => row.position), playerIds: [], reason: "Monitor positions that trail the current plan." });
  const tier = tierRisks.filter((row) => row.riskLevel !== "low").slice(0, 3);
  if (tier.length) focus.push({ label: "Tier risk rising", priority: "high", positions: tier.map((row) => row.position), playerIds: tier.flatMap((row) => row.relatedPlayerIds), reason: "Tier risk is active near the live board." });
  const weakWait = waits.filter((row) => row.status !== "supported").slice(0, 3);
  if (weakWait.length) focus.push({ label: "Wait plan weakening", priority: "medium", positions: weakWait.map((row) => row.position), playerIds: weakWait.flatMap((row) => row.relatedPlayerIds), reason: "Named wait targets or comparable options are thinning." });
  if (values.length) focus.push({ label: "Unexpected value signal", priority: "medium", positions: values.map((row) => normalizePosition(row.position)), playerIds: values.map((row) => row.playerId).filter((id): id is string => Boolean(id)), reason: "A high contextual Blackbird Rank player is still available." });
  if (contingencies.length) focus.push({ label: "Contingency active", priority: "high", positions: unique(contingencies.flatMap((row) => row.relatedPositions)), playerIds: unique(contingencies.flatMap((row) => row.relatedPlayerIds)), reason: "One or more deterministic contingency triggers are active." });
  return focus.slice(0, 6);
}

function deriveOverallStatus(input: {
  preDraft: boolean;
  dataGaps: number;
  triggeredContingencies: LiveTriggeredContingency[];
  positionPlanStatus: LivePositionPlanStatus[];
  tierRiskStatus: LiveTierRiskStatus[];
  waitPlanStatus: LiveWaitPlanStatus[];
}): LivePlanOverallStatus {
  if (input.dataGaps >= 4) return "insufficient_data";
  if (input.preDraft) return "pre_draft";
  if (input.triggeredContingencies.some((row) => row.riskLevel === "high")) return "contingency_active";
  if (input.positionPlanStatus.some((row) => row.status === "behind")) return "off_plan_recoverable";
  if (input.tierRiskStatus.some((row) => row.riskLevel === "high")) return "needs_attention";
  if (input.waitPlanStatus.some((row) => row.status === "dangerous")) return "needs_attention";
  if (input.positionPlanStatus.some((row) => row.status === "thin" || row.status === "intentionally_waiting")) return "slightly_off_plan";
  return "on_plan";
}

function activeRoundWindows(strategy: LivePlanStrategy, currentRound: number) {
  return (strategy.roundWindowPlanDetailed ?? []).filter((window) => roundsFromLabel(window.rounds).includes(currentRound));
}

function targetForPosition(strategy: LivePlanStrategy, position: string): number | null {
  const direct = strategy.leagueSummary.startingRequirements?.[position];
  if (position === "QB" && strategy.leagueSummary.superflexOr2Qb) return Math.max(typeof direct === "number" ? direct : 0, 2);
  if (typeof direct === "number" && direct > 0) return direct;
  if ((position === "RB" || position === "WR") && strategy.leagueSummary.flexStructure.length) return 2;
  if (IDP.has(position) && strategy.leagueSummary.idp) return 1;
  if (position === "K" && strategy.leagueSummary.kicker) return 1;
  if (position === "DEF" && strategy.leagueSummary.teamDefense) return 1;
  if (OFFENSE.has(position)) return 1;
  return null;
}

function findWindowForPosition(strategy: LivePlanStrategy, position: string, currentRound: number | null): string | null {
  const windows = (strategy.roundWindowPlanDetailed ?? []).filter((window) => window.primaryPositions.map(normalizePosition).includes(position));
  if (!windows.length) return null;
  if (currentRound === null) return windows[0].window;
  return windows.find((window) => roundsFromLabel(window.rounds).includes(currentRound))?.window ?? windows.find((window) => roundsFromLabel(window.rounds).some((round) => Math.abs(round - currentRound) <= 1))?.window ?? null;
}

function labelForStatus(status: LivePlanOverallStatus): string {
  return status.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

function summaryForStatus(status: LivePlanOverallStatus, focus: LiveRecommendedFocus[], windows: Array<{ window: string }>): string {
  if (status === "pre_draft") return "Draft has not started; monitor the opening round window.";
  if (status === "on_plan") return "Live draft state is tracking the current plan.";
  const focusText = focus[0]?.label ?? "live timing signal";
  const windowText = windows[0]?.window ? ` in ${windows[0].window}` : "";
  if (status === "contingency_active") return `Contingency active${windowText}; ${focusText.toLowerCase()} is the main focus.`;
  if (status === "needs_attention") return `Needs attention${windowText}; ${focusText.toLowerCase()} is active.`;
  if (status === "off_plan_recoverable") return `Off plan but recoverable${windowText}; adjust using the strongest deterministic focus.`;
  if (status === "slightly_off_plan") return `Slightly off plan${windowText}; monitor timing before forcing a lane.`;
  return "Insufficient data to score the live plan confidently.";
}

function summaryForPosition(position: string, status: LivePositionPlanStatus["status"], count: number, target: number | null): string {
  const targetText = target === null ? "unknown target" : `${count}/${target}`;
  if (status === "ahead") return `${position} is ahead of plan (${targetText}).`;
  if (status === "thin") return `${position} is thin versus plan (${targetText}).`;
  if (status === "behind") return `${position} is behind the planned window (${targetText}).`;
  if (status === "intentionally_waiting") return `${position} is waiting with plan support (${targetText}).`;
  if (status === "avoid_forcing") return `${position} is covered; avoid forcing extra exposure.`;
  if (status === "insufficient_data") return `${position} needs more context.`;
  return `${position} is on track (${targetText}).`;
}

function cloneInput(input: LivePlanStatusInput): LivePlanStatusInput {
  return {
    ...input,
    positionCounts: { ...input.positionCounts },
    boardRows: input.boardRows.map((row) => ({ ...row })),
    draftedPlayerIds: [...(input.draftedPlayerIds ?? [])],
  };
}

function normalizePosition(position: string | null | undefined): string {
  const normalized = (position ?? "").trim().toUpperCase();
  if (normalized === "DST" || normalized === "D/ST") return "DEF";
  return normalized;
}

function roundsFromLabel(label: string): number[] {
  const normalized = label.toLowerCase();
  const rangeMatch = normalized.match(/(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) return range(Number(rangeMatch[1]), Number(rangeMatch[2]));
  const plus = normalized.match(/(\d+)\+/);
  if (plus) return range(Number(plus[1]), Number(plus[1]) + 8);
  const single = normalized.match(/\d+/);
  return single ? [Number(single[0])] : range(1, 16);
}

function range(start: number, end: number): number[] {
  const from = Math.max(1, Math.floor(start));
  const to = Math.max(from, Math.floor(end));
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
