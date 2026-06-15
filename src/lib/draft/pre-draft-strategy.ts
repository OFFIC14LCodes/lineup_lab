import { POSITION_GROUPS, buildNormalizedRosterRequirements, type NormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import { buildDraftSlotStrategyCalibration, type DraftSlotBand, type ProjectedUserPick, type RoundPickWindow } from "@/lib/draft/draft-slot-strategy";
import type { H10WarRoomCompactRecommendation, H10WarRoomInventoryRow, H10WarRoomPerRoomValidation } from "@/lib/draft/war-room-recommendation-validation";

export type StrategyPriority = "elite" | "high" | "medium" | "low" | "defer";
export type DataAvailabilityStatus = "available" | "partial" | "missing" | "computed";

export type PreDraftStrategyDataAudit = {
  leagueScoring: DataAvailabilityStatus;
  rosterSlots: DataAvailabilityStatus;
  startingLineupRequirements: DataAvailabilityStatus;
  draftOrder: DataAvailabilityStatus;
  draftSlot: DataAvailabilityStatus;
  teamCount: DataAvailabilityStatus;
  roundCount: DataAvailabilityStatus;
  playerProjections: DataAvailabilityStatus;
  marketAdp: DataAvailabilityStatus;
  tiers: DataAvailabilityStatus;
  scarcity: DataAvailabilityStatus;
  h10RecommendationRows: DataAvailabilityStatus;
  h10NeedTimingFields: DataAvailabilityStatus;
  h10WaitPlanFields: DataAvailabilityStatus;
  idpKDstSupport: DataAvailabilityStatus;
  notes: string[];
};

export type PreDraftStrategyInput = {
  room: Pick<
    H10WarRoomInventoryRow,
    | "draftRoomId"
    | "leagueId"
    | "leagueName"
    | "season"
    | "positions_present"
    | "hasIDP"
    | "hasKicker"
    | "hasTeamDefense"
    | "isSuperflex"
    | "is2QB"
    | "isTEPremium"
    | "benchDepth"
    | "currentPickKnown"
    | "picksUntilMyNextPickKnown"
    | "remaining_player_count"
  >;
  roomResult?: Pick<
    H10WarRoomPerRoomValidation,
    "formats" | "topRecommendations" | "watchlistExamples" | "rowsByPosition" | "contextLimitations"
  > | null;
  rosterSlots?: string[] | null;
  scoringSettings?: Record<string, number | string | boolean | null> | null;
  draftSlot?: number | null;
  teamCount?: number | null;
  rounds?: number | null;
};

export type PreDraftStrategyOutput = {
  strategyPreviewLabel: "read-only strategy preview";
  leagueSummary: {
    leagueId: string;
    draftRoomId: string;
    leagueName: string | null;
    teams: number | null;
    rounds: number | null;
    scoringType: string;
    formats: string[];
    superflexOr2Qb: boolean;
    tePremium: boolean;
    idp: boolean;
    kicker: boolean;
    teamDefense: boolean;
    flexStructure: string[];
    startingRequirements: Record<string, number>;
    benchDepth: number;
  };
  scoringEmphasis: Array<{ signal: string; position: string; priority: StrategyPriority; reason: string }>;
  rosterConstructionPlan: Array<{ phase: string; guidance: string; positions: string[] }>;
  positionalPriorityMap: Record<string, { priority: StrategyPriority; score: number; reasons: string[] }>;
  draftSlotStrategy: {
    slot: number | null;
    teamCount: number | null;
    archetype: "early" | "middle" | "turn" | "unknown";
    expectedLongWaitPicks: number | null;
    draftSlotBand: DraftSlotBand;
    isTurnPick: boolean;
    isNearTurn: boolean;
    averagePicksBetweenTurns: number | null;
    maxWaitUntilNextPick: number | null;
    turnPairingRisk: "low" | "medium" | "high" | "unknown";
    slotStrategySummary: string;
    projectedUserPicks: ProjectedUserPick[];
    roundPickWindows: RoundPickWindow[];
    roundWindowPlanBySlot: Array<{ window: string; rounds: string; picks: number[]; guidance: string }>;
    timingSignals: string[];
    positionsAtRiskBeforeNextTurn: string[];
  };
  roundWindowPlan: Array<{ window: string; rounds: string; positions: string[]; guidance: string }>;
  roundWindowPlanDetailed: RoundWindowPlanDetail[];
  roundWindowPositionTargets: Array<{ window: string; positions: string[]; reason: string }>;
  roundWindowValueTargets: Array<{ window: string; positions: string[]; reason: string }>;
  roundWindowAvoids: Array<{ window: string; positions: string[]; reason: string }>;
  roundWindowContingencies: Array<{ window: string; trigger: string; adjustment: string }>;
  roundWindowTierRisks: Array<{ window: string; positions: string[]; riskLevel: "low" | "medium" | "high"; reason: string }>;
  roundWindowFallbacks: Array<{ window: string; fallbackPath: string; reason: string }>;
  contingencyTriggers: ContingencyTrigger[];
  tierCliffWatchlist: Array<{ position: string; label: string; tier: number | null; risk: string; reason: string }>;
  valuePocketWatchlist: Array<{ position: string; label: string; marketSignal: string | null; reason: string }>;
  waitPositions: Array<{ position: string; confidence: string; reason: string; targetCount: number }>;
  doNotForcePositions: Array<{ position: string; reason: string }>;
  contingencyPlans: Array<{ trigger: string; response: string }>;
  specialPositionGuidance: Array<{ position: string; guidance: string }>;
  riskNotes: string[];
  explanationFragments: string[];
  dataAvailabilityAudit: PreDraftStrategyDataAudit;
};

export type RoundWindowPlanDetail = {
  window: string;
  rounds: string;
  projectedPicks: number[];
  primaryPositions: string[];
  avoidForcingPositions: string[];
  likelyValuePockets: string[];
  tierCliffRisks: string[];
  contingencyTriggers: string[];
  fallbackPath: string;
  guidance: string;
};

export type ContingencyTrigger = {
  id: string;
  label: string;
  appliesToRounds: number[];
  appliesToPositions: string[];
  triggerConditionSummary: string;
  suggestedAdjustment: string;
  riskLevel: "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
  reasons: string[];
};

const IDP_POSITIONS = new Set(["DL", "LB", "DB"]);
const SPECIAL_POSITIONS = new Set(["K", "DEF"]);
const BANNED_STRATEGY_TERMS = [
  "must draft",
  "guaranteed",
  "lock",
  "can't miss",
  "can’t miss",
  "best pick",
  "ai advice",
  "you should draft",
  "final recommendation",
  "final plan",
] as const;

export function buildPreDraftStrategy(input: PreDraftStrategyInput): PreDraftStrategyOutput {
  const requirements = buildRequirements(input);
  const formats = buildFormats(input, requirements);
  const recommendations = normalizedRecommendations(input.roomResult);
  const positionalPriorityMap = buildPriorityMap(input, requirements, recommendations);
  const draftSlotStrategy = buildDraftSlotStrategy({
    draftSlot: input.draftSlot ?? null,
    teamCount: input.teamCount ?? null,
    rounds: input.rounds ?? null,
    priorityMap: positionalPriorityMap,
    recommendations,
  });
  const roundWindowPlan = buildRoundWindowPlan(input, requirements);
  const contingencyTriggers = buildContingencyTriggers(input, requirements, recommendations, draftSlotStrategy);
  const roundWindowPlanDetailed = buildRoundWindowPlanDetailed(roundWindowPlan, draftSlotStrategy, recommendations, contingencyTriggers);

  const output: PreDraftStrategyOutput = {
    strategyPreviewLabel: "read-only strategy preview",
    leagueSummary: {
      leagueId: input.room.leagueId,
      draftRoomId: input.room.draftRoomId,
      leagueName: input.room.leagueName,
      teams: finiteNumber(input.teamCount),
      rounds: finiteNumber(input.rounds),
      scoringType: inferScoringType(input.scoringSettings),
      formats,
      superflexOr2Qb: input.room.isSuperflex || input.room.is2QB || requirements.superflexCount > 0 || requirements.directStarters.QB >= 2,
      tePremium: input.room.isTEPremium || isTePremium(input.scoringSettings),
      idp: input.room.hasIDP || requirements.hasIDP,
      kicker: input.room.hasKicker || requirements.hasKicker,
      teamDefense: input.room.hasTeamDefense || requirements.hasTeamDefense,
      flexStructure: buildFlexStructure(requirements),
      startingRequirements: Object.fromEntries(POSITION_GROUPS.map((position) => [position, requirements.directStarters[position]])),
      benchDepth: requirements.benchCount || input.room.benchDepth || 0,
    },
    scoringEmphasis: buildScoringEmphasis(input, requirements),
    rosterConstructionPlan: buildRosterConstructionPlan(input, requirements),
    positionalPriorityMap,
    draftSlotStrategy,
    roundWindowPlan,
    roundWindowPlanDetailed,
    roundWindowPositionTargets: roundWindowPlanDetailed.map((window) => ({ window: window.window, positions: window.primaryPositions, reason: window.guidance })),
    roundWindowValueTargets: roundWindowPlanDetailed.map((window) => ({ window: window.window, positions: window.likelyValuePockets, reason: "Value pocket positions are derived from market and H10 score signals in the window." })),
    roundWindowAvoids: roundWindowPlanDetailed.map((window) => ({ window: window.window, positions: window.avoidForcingPositions, reason: "Avoid-forcing labels reflect low timing leverage or special-position caution." })),
    roundWindowContingencies: roundWindowPlanDetailed.flatMap((window) => window.contingencyTriggers.map((trigger) => ({ window: window.window, trigger, adjustment: window.fallbackPath }))),
    roundWindowTierRisks: roundWindowPlanDetailed.map((window) => ({ window: window.window, positions: window.tierCliffRisks, riskLevel: window.tierCliffRisks.length ? "high" : "low", reason: window.tierCliffRisks.length ? "H10 tier-cliff rows are present for this window." : "No strong tier-cliff row is present for this window." })),
    roundWindowFallbacks: roundWindowPlanDetailed.map((window) => ({ window: window.window, fallbackPath: window.fallbackPath, reason: "Fallback path is deterministic from slot timing, tier risk, and value pocket state." })),
    contingencyTriggers,
    tierCliffWatchlist: buildTierCliffWatchlist(recommendations),
    valuePocketWatchlist: buildValuePocketWatchlist(recommendations),
    waitPositions: buildWaitPositions(recommendations),
    doNotForcePositions: buildDoNotForcePositions(input, recommendations),
    contingencyPlans: buildContingencyPlans(input, recommendations),
    specialPositionGuidance: buildSpecialPositionGuidance(input, requirements),
    riskNotes: buildRiskNotes(input, recommendations),
    explanationFragments: [
      "Read-only strategy preview built from league format, roster settings, H10 timing signals, tiers, and market context.",
      "Blackbird leans are deterministic and do not mutate draft state, projections, or player ordering.",
      "Timing signal and tier risk are pre-draft planning aids; live H10 recommendations remain separate.",
    ],
    dataAvailabilityAudit: auditPreDraftStrategyData(input),
  };

  const failures = validateStrategyLanguage(output);
  if (failures.length > 0) {
    return {
      ...output,
      riskNotes: [...output.riskNotes, ...failures.map((failure) => `Safety language check failed: ${failure}`)],
    };
  }
  return output;
}

export function auditPreDraftStrategyData(input: PreDraftStrategyInput): PreDraftStrategyDataAudit {
  const hasRecommendations = normalizedRecommendations(input.roomResult).length > 0;
  const hasWaitPlan = normalizedRecommendations(input.roomResult).some((row) => row.waitPlanTargetCount > 0 || row.waitPlanBacked);
  const hasNeedTiming = normalizedRecommendations(input.roomResult).some((row) => Boolean(row.needTimingAction));
  const hasTiers = normalizedRecommendations(input.roomResult).some((row) => row.h10.tier !== null || row.tierDropRisk);
  const hasMarket = normalizedRecommendations(input.roomResult).some((row) => row.h10.marketValueSignal !== null || row.scoreComponents.marketValue !== 0);

  return {
    leagueScoring: input.scoringSettings ? "available" : input.room.isTEPremium ? "partial" : "missing",
    rosterSlots: input.rosterSlots?.length ? "available" : "partial",
    startingLineupRequirements: input.rosterSlots?.length ? "computed" : "partial",
    draftOrder: input.room.currentPickKnown ? "partial" : "missing",
    draftSlot: input.draftSlot ? "available" : "missing",
    teamCount: input.teamCount ? "available" : "missing",
    roundCount: input.rounds ? "available" : "missing",
    playerProjections: hasRecommendations ? "available" : "partial",
    marketAdp: hasMarket ? "available" : "partial",
    tiers: hasTiers ? "available" : "partial",
    scarcity: hasRecommendations ? "available" : "partial",
    h10RecommendationRows: hasRecommendations ? "available" : "missing",
    h10NeedTimingFields: hasNeedTiming ? "available" : "missing",
    h10WaitPlanFields: hasWaitPlan ? "available" : "partial",
    idpKDstSupport: input.room.hasIDP || input.room.hasKicker || input.room.hasTeamDefense ? "available" : "partial",
    notes: [
      "Exact pre-draft strategy improves when raw draft slot, team count, round count, and roster slots are loaded.",
      "H10 validation artifacts provide compact timing and recommendation rows but not every raw league scoring key.",
      "True historical completed-draft outcome validation remains unavailable.",
    ],
  };
}

export function validateStrategyLanguage(output: unknown): string[] {
  const text = JSON.stringify(output).toLowerCase();
  return BANNED_STRATEGY_TERMS.filter((term) => text.includes(term)).map((term) => `Banned strategy language emitted: ${term}`);
}

function buildRequirements(input: PreDraftStrategyInput): NormalizedRosterRequirements {
  if (input.rosterSlots?.length) return buildNormalizedRosterRequirements(input.rosterSlots);

  const inferredSlots: string[] = [];
  if (input.room.is2QB) inferredSlots.push("QB", "QB");
  else inferredSlots.push("QB");
  if (input.room.isSuperflex) inferredSlots.push("SUPER_FLEX");
  for (const position of input.room.positions_present ?? []) {
    const normalized = normalizePosition(position);
    if (["RB", "WR", "TE", "K", "DEF", "DL", "LB", "DB"].includes(normalized)) inferredSlots.push(normalized);
  }
  if (input.room.hasKicker) inferredSlots.push("K");
  if (input.room.hasTeamDefense) inferredSlots.push("DEF");
  if (input.room.hasIDP && !inferredSlots.some((slot) => IDP_POSITIONS.has(slot))) inferredSlots.push("DL", "LB", "DB");
  for (let i = 0; i < Math.max(0, input.room.benchDepth ?? 0); i += 1) inferredSlots.push("BN");
  return buildNormalizedRosterRequirements(inferredSlots);
}

function buildFormats(input: PreDraftStrategyInput, requirements: NormalizedRosterRequirements): string[] {
  return [
    input.room.isSuperflex || requirements.superflexCount > 0 ? "Superflex" : null,
    input.room.is2QB || requirements.directStarters.QB >= 2 ? "2QB" : null,
    input.room.isTEPremium || isTePremium(input.scoringSettings) ? "TE premium" : null,
    input.room.hasIDP || requirements.hasIDP ? "IDP" : null,
    input.room.hasKicker || requirements.hasKicker ? "Kicker" : null,
    input.room.hasTeamDefense || requirements.hasTeamDefense ? "DST" : null,
    (requirements.benchCount || input.room.benchDepth) >= 8 ? "Deep roster" : "Shallow roster",
  ].filter((format): format is string => Boolean(format));
}

function buildScoringEmphasis(input: PreDraftStrategyInput, requirements: NormalizedRosterRequirements) {
  const signals: PreDraftStrategyOutput["scoringEmphasis"] = [];
  if (input.room.isSuperflex || input.room.is2QB || requirements.superflexCount > 0 || requirements.directStarters.QB >= 2) {
    signals.push({ signal: "format signal", position: "QB", priority: "elite", reason: "Superflex or 2QB structure increases quarterback demand." });
  }
  if (input.room.isTEPremium || isTePremium(input.scoringSettings)) {
    signals.push({ signal: "format signal", position: "TE", priority: "high", reason: "TE premium increases tier sensitivity at tight end." });
  }
  if (input.room.hasIDP || requirements.hasIDP) {
    signals.push({ signal: "format signal", position: "DL/LB/DB", priority: "medium", reason: "IDP slots require defensive position planning instead of a single generic pool." });
  }
  if (requirements.offensiveFlexCount >= 2 || requirements.benchCount >= 8 || input.room.benchDepth >= 8) {
    signals.push({ signal: "format signal", position: "RB/WR", priority: "high", reason: "Heavy flex or deep bench settings increase running back and wide receiver depth value." });
  }
  if (input.room.hasKicker || input.room.hasTeamDefense || requirements.hasKicker || requirements.hasTeamDefense) {
    signals.push({ signal: "format signal", position: "K/DEF", priority: "defer", reason: "Kicker and team defense generally fit late-round fill windows unless scoring settings materially change." });
  }
  if (!signals.length) {
    signals.push({ signal: "format signal", position: "RB/WR", priority: "medium", reason: "Standard roster structure keeps early planning centered on broad offensive value and tier risk." });
  }
  return signals;
}

function buildPriorityMap(input: PreDraftStrategyInput, requirements: NormalizedRosterRequirements, recommendations: H10WarRoomCompactRecommendation[]) {
  const map = Object.fromEntries(
    POSITION_GROUPS.map((position) => [
      position,
      { priority: "low" as StrategyPriority, score: 35, reasons: [] as string[] },
    ])
  );

  for (const position of POSITION_GROUPS) {
    const starterCount = requirements.directStarters[position];
    const rowCount = recommendations.filter((row) => normalizePosition(row.position) === position).length;
    const tierRiskRows = recommendations.filter((row) => normalizePosition(row.position) === position && row.tierDropRisk === "high").length;
    const marketRows = recommendations.filter((row) => normalizePosition(row.position) === position && row.h10.marketValueSignal === "above_market").length;
    let score = starterCount > 0 ? 52 + starterCount * 8 : rowCount > 0 ? 42 : 25;
    const reasons: string[] = [];

    if (starterCount > 0) reasons.push(`${position} has direct starter demand.`);
    if (rowCount > 0) reasons.push(`${position} appears in the H10 planning pool.`);
    if (tierRiskRows > 0) {
      score += Math.min(18, tierRiskRows * 7);
      reasons.push(`${position} has visible tier risk in H10 rows.`);
    }
    if (marketRows > 0) {
      score += Math.min(10, marketRows * 4);
      reasons.push(`${position} has value pocket signals against market.`);
    }
    if (position === "QB" && (input.room.isSuperflex || input.room.is2QB || requirements.superflexCount > 0 || requirements.directStarters.QB >= 2)) {
      score += 35;
      reasons.push("Superflex or 2QB format signal elevates QB priority.");
    }
    if (position === "TE" && (input.room.isTEPremium || isTePremium(input.scoringSettings))) {
      score += 22;
      reasons.push("TE premium format signal elevates TE tier sensitivity.");
    }
    if ((position === "RB" || position === "WR") && (requirements.offensiveFlexCount >= 1 || requirements.benchCount >= 8 || input.room.benchDepth >= 8)) {
      score += 12;
      reasons.push("Flex or deep roster settings increase depth value.");
    }
    if (IDP_POSITIONS.has(position) && (input.room.hasIDP || requirements.hasIDP)) {
      score += 16;
      reasons.push("IDP format signal requires defensive planning.");
    }
    if (SPECIAL_POSITIONS.has(position)) {
      score -= 24;
      reasons.push(`${position} is generally a late-round fill position.`);
    }
    const clamped = clamp(score, 0, 100);
    map[position] = {
      priority: priorityForScore(clamped),
      score: clamped,
      reasons: reasons.length ? reasons : [`${position} has no strong pre-draft format signal.`],
    };
  }
  return map;
}

function buildDraftSlotStrategy(input: {
  draftSlot: number | null;
  teamCount: number | null;
  rounds: number | null;
  priorityMap: PreDraftStrategyOutput["positionalPriorityMap"];
  recommendations: H10WarRoomCompactRecommendation[];
}): PreDraftStrategyOutput["draftSlotStrategy"] {
  const calibration = buildDraftSlotStrategyCalibration({
    draftSlot: input.draftSlot,
    teamCount: input.teamCount,
    rounds: input.rounds,
  });
  if (!input.draftSlot || !input.teamCount) {
    return {
      slot: input.draftSlot,
      teamCount: input.teamCount,
      archetype: "unknown",
      expectedLongWaitPicks: null,
      draftSlotBand: calibration.draftSlotBand,
      isTurnPick: calibration.isTurnPick,
      isNearTurn: calibration.isNearTurn,
      averagePicksBetweenTurns: calibration.averagePicksBetweenTurns,
      maxWaitUntilNextPick: calibration.maxWaitUntilNextPick,
      turnPairingRisk: calibration.turnPairingRisk,
      slotStrategySummary: calibration.slotStrategySummary,
      projectedUserPicks: calibration.projectedUserPicks,
      roundPickWindows: calibration.roundPickWindows,
      roundWindowPlanBySlot: calibration.roundWindowPlanBySlot,
      timingSignals: calibration.timingSignals,
      positionsAtRiskBeforeNextTurn: positionsAtRisk(input.priorityMap, input.recommendations),
    };
  }
  const third = Math.ceil(input.teamCount / 3);
  const archetype = input.draftSlot <= third ? "early" : input.draftSlot > input.teamCount - third ? "turn" : "middle";
  const expectedLongWaitPicks = calibration.maxWaitUntilNextPick;
  return {
    slot: input.draftSlot,
    teamCount: input.teamCount,
    archetype,
    expectedLongWaitPicks,
    draftSlotBand: calibration.draftSlotBand,
    isTurnPick: calibration.isTurnPick,
    isNearTurn: calibration.isNearTurn,
    averagePicksBetweenTurns: calibration.averagePicksBetweenTurns,
    maxWaitUntilNextPick: calibration.maxWaitUntilNextPick,
    turnPairingRisk: calibration.turnPairingRisk,
    slotStrategySummary: calibration.slotStrategySummary,
    projectedUserPicks: calibration.projectedUserPicks,
    roundPickWindows: calibration.roundPickWindows,
    roundWindowPlanBySlot: calibration.roundWindowPlanBySlot,
    timingSignals: calibration.timingSignals,
    positionsAtRiskBeforeNextTurn: positionsAtRisk(input.priorityMap, input.recommendations),
  };
}

function buildRosterConstructionPlan(input: PreDraftStrategyInput, requirements: NormalizedRosterRequirements) {
  const plan: PreDraftStrategyOutput["rosterConstructionPlan"] = [
    { phase: "early anchor", positions: ["QB", "RB", "WR", "TE"], guidance: "Blackbird leans toward capturing format-sensitive value before forcing low-priority slots." },
    { phase: "middle value pocket", positions: ["RB", "WR", "TE"], guidance: "Use tier risk and market value pockets to build starters and flexible depth." },
    { phase: "late depth and fill", positions: ["RB", "WR", "K", "DEF"], guidance: "Fill special positions late while using remaining bench slots for upside and coverage." },
  ];
  if (input.room.isSuperflex || input.room.is2QB || requirements.superflexCount > 0) {
    plan.unshift({ phase: "QB structure", positions: ["QB"], guidance: "Superflex and 2QB formats make quarterback structure a core planning lane." });
  }
  if (input.room.hasIDP || requirements.hasIDP) {
    plan.push({ phase: "IDP structure", positions: ["DL", "LB", "DB"], guidance: "Build defensive coverage by position group, then react to tier risk." });
  }
  return plan;
}

function buildRoundWindowPlan(input: PreDraftStrategyInput, requirements: NormalizedRosterRequirements) {
  const calibration = buildDraftSlotStrategyCalibration({
    draftSlot: input.draftSlot,
    teamCount: input.teamCount,
    rounds: input.rounds,
  });
  const windows: PreDraftStrategyOutput["roundWindowPlan"] = [
    { window: "early anchor targets", rounds: "1-4", positions: ["QB", "RB", "WR", "TE"], guidance: `${calibration.roundPickWindows[0]?.guidance ?? "Prioritize format signals, elite tiers, and broad value."}` },
    { window: "middle-round value pockets", rounds: "5-10", positions: ["RB", "WR", "TE"], guidance: `${calibration.roundPickWindows[1]?.guidance ?? "Track tier risk and market gaps before filling every roster slot."}` },
    { window: "late-round depth/fill", rounds: "11+", positions: ["RB", "WR"], guidance: "Use late windows for depth, contingent value, and remaining roster coverage." },
  ];
  if (input.room.isSuperflex || input.room.is2QB || requirements.superflexCount > 0) {
    windows.splice(1, 0, { window: "QB tier window", rounds: "1-8", positions: ["QB"], guidance: "Monitor QB tier risk before long snake waits." });
  }
  if (input.room.isTEPremium || isTePremium(input.scoringSettings)) {
    windows.splice(1, 0, { window: "TE premium tier window", rounds: "2-8", positions: ["TE"], guidance: "Watch tight end tier gaps because premium scoring can amplify positional separation." });
  }
  if (input.room.hasIDP || requirements.hasIDP) {
    windows.push({ window: "IDP timing", rounds: "middle-late", positions: ["DL", "LB", "DB"], guidance: "Plan IDP starts around tier risk while accounting for lower projection confidence." });
  }
  if (input.room.hasKicker || input.room.hasTeamDefense || requirements.hasKicker || requirements.hasTeamDefense) {
    windows.push({ window: "K/DST timing", rounds: "late", positions: ["K", "DEF"], guidance: "Keep kicker and team defense in late fill windows unless league scoring creates a clear format signal." });
  }
  return windows;
}

function buildTierCliffWatchlist(recommendations: H10WarRoomCompactRecommendation[]) {
  return recommendations
    .filter((row) => row.tierDropRisk === "high" || row.scoreComponents.tierCliff >= 12)
    .sort((a, b) => b.scoreComponents.tierCliff - a.scoreComponents.tierCliff || a.recommendationRank - b.recommendationRank)
    .slice(0, 8)
    .map((row) => ({
      position: normalizePosition(row.position) || "UNK",
      label: row.displayName,
      tier: row.h10.tier,
      risk: row.tierDropRisk,
      reason: `${normalizePosition(row.position) || "Position"} tier risk is elevated in current H10 rows.`,
    }));
}

function buildValuePocketWatchlist(recommendations: H10WarRoomCompactRecommendation[]) {
  return recommendations
    .filter((row) => row.h10.marketValueSignal === "above_market" || row.scoreComponents.marketValue >= 8)
    .sort((a, b) => b.scoreComponents.marketValue - a.scoreComponents.marketValue || a.recommendationRank - b.recommendationRank)
    .slice(0, 8)
    .map((row) => ({
      position: normalizePosition(row.position) || "UNK",
      label: row.displayName,
      marketSignal: row.h10.marketValueSignal,
      reason: "Value pocket signal exists versus available market context.",
    }));
}

function buildWaitPositions(recommendations: H10WarRoomCompactRecommendation[]) {
  const byPosition = new Map<string, H10WarRoomCompactRecommendation[]>();
  for (const row of recommendations) {
    const position = normalizePosition(row.position);
    if (!position) continue;
    if (row.needTimingAction !== "wait_one_turn" && row.needTimingAction !== "wait_multiple_turns") continue;
    byPosition.set(position, [...(byPosition.get(position) ?? []), row]);
  }
  return [...byPosition.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([position, rows]) => {
      const targetCount = rows.reduce((sum, row) => sum + row.waitPlanTargetCount, 0);
      const backedCount = rows.filter((row) => row.waitPlanBacked).length;
      return {
        position,
        confidence: backedCount > 0 ? "backed by wait targets" : "monitor only",
        targetCount,
        reason:
          backedCount > 0
            ? `${position} has H10 wait target support in this planning pool.`
            : `${position} wait signal exists but named target support is thin.`,
      };
    });
}

function buildDoNotForcePositions(input: PreDraftStrategyInput, recommendations: H10WarRoomCompactRecommendation[]) {
  const positions = new Map<string, string>();
  if (input.room.hasKicker) positions.set("K", "Kicker belongs in a late fill window for this strategy preview.");
  if (input.room.hasTeamDefense) positions.set("DEF", "Team defense belongs in a late fill window for this strategy preview.");
  for (const row of recommendations) {
    const position = normalizePosition(row.position);
    if (!position) continue;
    if (row.needTimingAction === "wait_one_turn" || row.needTimingAction === "wait_multiple_turns") {
      positions.set(position, `${position} has wait guidance from H10 timing signals.`);
    }
    if (row.opportunityCost === "high") {
      positions.set(position, `${position} has high opportunity cost versus the board in at least one H10 row.`);
    }
  }
  return [...positions.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([position, reason]) => ({ position, reason }));
}

function buildContingencyPlans(input: PreDraftStrategyInput, recommendations: H10WarRoomCompactRecommendation[]) {
  const plans: PreDraftStrategyOutput["contingencyPlans"] = [];
  const riskPositions = new Set(buildTierCliffWatchlist(recommendations).map((row) => row.position));
  if (input.room.isSuperflex || input.room.is2QB || riskPositions.has("QB")) {
    plans.push({ trigger: "If a QB tier dries up before the next turn", response: "pivot to the strongest non-QB value pocket and revisit QB on the next timing signal." });
  }
  if (input.room.isTEPremium || riskPositions.has("TE")) {
    plans.push({ trigger: "If a TE premium tier falls into range", response: "consider TE within the tier window before filling low-scarcity depth." });
  }
  if (input.room.hasIDP || ["DL", "LB", "DB"].some((position) => riskPositions.has(position))) {
    plans.push({ trigger: "If an IDP tier becomes thin", response: "avoid waiting without named targets and compare DL/LB/DB coverage separately." });
  }
  plans.push({ trigger: "If RB/WR value falls below market", response: "let value pocket evidence compete with roster need before filling a lower-value slot." });
  plans.push({ trigger: "If wait guidance lacks named targets", response: "treat the position as monitor-only and prefer stronger tier or value signals." });
  return uniqueBy(plans, (plan) => `${plan.trigger}|${plan.response}`).slice(0, 8);
}

function buildContingencyTriggers(
  input: PreDraftStrategyInput,
  requirements: NormalizedRosterRequirements,
  recommendations: H10WarRoomCompactRecommendation[],
  draftSlotStrategy: PreDraftStrategyOutput["draftSlotStrategy"]
): ContingencyTrigger[] {
  const triggers: ContingencyTrigger[] = [];
  const highTierRiskPositions = [...new Set(recommendations.filter((row) => row.tierDropRisk === "high" || row.scoreComponents.tierCliff >= 12).map((row) => normalizePosition(row.position)).filter(Boolean))];
  const weakSurvivalPositions = [...new Set(recommendations.filter((row) => row.survivalConfidence === "low" || row.waitRisk === "high").map((row) => normalizePosition(row.position)).filter(Boolean))];
  const valuePocketPositions = [...new Set(recommendations.filter((row) => row.h10.marketValueSignal === "above_market" || row.scoreComponents.marketValue >= 8).map((row) => normalizePosition(row.position)).filter(Boolean))];
  const roundCount = input.rounds ?? 16;

  if (input.room.isSuperflex || input.room.is2QB || requirements.superflexCount > 0 || requirements.directStarters.QB >= 2) {
    triggers.push({
      id: "qb-tier-superflex-pivot",
      label: "QB tier contingency",
      appliesToRounds: range(1, Math.min(8, roundCount)),
      appliesToPositions: ["QB"],
      triggerConditionSummary: "Elite or starter QB tier thins before the next projected user pick.",
      suggestedAdjustment: highTierRiskPositions.includes("QB")
        ? "Monitor the next QB tier against best available non-QB value before the long wait."
        : "Let non-QB value pockets compete with the next QB tier when scarcity is not elevated.",
      riskLevel: highTierRiskPositions.includes("QB") ? "high" : "medium",
      confidence: recommendations.some((row) => normalizePosition(row.position) === "QB") ? "medium" : "low",
      reasons: ["Superflex or 2QB structure increases QB demand.", "Adjustment uses deterministic tier and market signals."],
    });
  }

  if (input.room.isTEPremium || isTePremium(input.scoringSettings)) {
    triggers.push({
      id: "te-premium-value-fall",
      label: "TE premium value contingency",
      appliesToRounds: range(2, Math.min(8, roundCount)),
      appliesToPositions: ["TE"],
      triggerConditionSummary: "A TE premium tier player falls near market range.",
      suggestedAdjustment: "Consider TE within the premium window before lower-scarcity depth if projection and market signals align.",
      riskLevel: highTierRiskPositions.includes("TE") ? "high" : "medium",
      confidence: recommendations.some((row) => normalizePosition(row.position) === "TE") ? "medium" : "low",
      reasons: ["TE premium scoring can amplify tier gaps.", "Market alignment reduces overreach risk."],
    });
  }

  if (valuePocketPositions.some((position) => position === "RB" || position === "WR")) {
    triggers.push({
      id: "rb-wr-depth-value-pocket",
      label: "RB/WR value pocket contingency",
      appliesToRounds: range(3, Math.min(12, roundCount)),
      appliesToPositions: ["RB", "WR"],
      triggerConditionSummary: "RB/WR depth remains strong and value pockets are visible.",
      suggestedAdjustment: "Allow waiting on lower-urgency needs while monitoring tier risk and named wait targets.",
      riskLevel: weakSurvivalPositions.some((position) => position === "RB" || position === "WR") ? "medium" : "low",
      confidence: "medium",
      reasons: ["RB/WR value pockets are present in H10 rows.", "Depth positions can support flexible fallback paths."],
    });
  }

  for (const position of weakSurvivalPositions) {
    triggers.push({
      id: `weak-survival-${position.toLowerCase()}`,
      label: `${position} survival contingency`,
      appliesToRounds: range(1, Math.min(12, roundCount)),
      appliesToPositions: [position],
      triggerConditionSummary: `${position} survival confidence is weak before a projected user pick.`,
      suggestedAdjustment: "Escalate from wait to monitor or fill-soon if named alternatives are thin.",
      riskLevel: "high",
      confidence: "medium",
      reasons: ["H10 survival confidence or wait risk is weak.", "Fallback avoids overcommitting when target depth is thin."],
    });
  }

  if (input.room.hasKicker || input.room.hasTeamDefense || requirements.hasKicker || requirements.hasTeamDefense) {
    triggers.push({
      id: "special-position-late-caution",
      label: "K/DST timing contingency",
      appliesToRounds: range(Math.max(10, roundCount - 5), roundCount),
      appliesToPositions: ["K", "DEF"],
      triggerConditionSummary: "K or DST appears before the late fill window.",
      suggestedAdjustment: "Avoid forcing special positions early unless league scoring creates a clear format signal.",
      riskLevel: "low",
      confidence: "high",
      reasons: ["K/DST are marked as late fill positions in roster construction.", "No persistent state changes are made."],
    });
  }

  if (input.room.hasIDP || requirements.hasIDP) {
    triggers.push({
      id: "idp-confidence-caution",
      label: "IDP confidence contingency",
      appliesToRounds: range(6, roundCount),
      appliesToPositions: ["DL", "LB", "DB"],
      triggerConditionSummary: "IDP tier or roster pressure rises while projection confidence remains lower.",
      suggestedAdjustment: "Monitor DL/LB/DB separately and avoid over-pushing IDP before stronger offensive value unless the format demands coverage.",
      riskLevel: "medium",
      confidence: "medium",
      reasons: ["IDP baselines carry unresolved identity and confidence caveats.", "Defensive positions need separate coverage checks."],
    });
  }

  if (draftSlotStrategy.isTurnPick || draftSlotStrategy.isNearTurn) {
    triggers.push({
      id: "turn-paired-position",
      label: "Turn pairing contingency",
      appliesToRounds: range(1, Math.min(10, roundCount)),
      appliesToPositions: ["QB", "RB", "WR", "TE"],
      triggerConditionSummary: "User pick is on or near the turn with a long wait after paired picks.",
      suggestedAdjustment: "Plan paired-position paths and compare one tier-risk position with one value-pocket position.",
      riskLevel: "high",
      confidence: "high",
      reasons: ["Turn slots have longer waits between picks.", "Paired planning reduces single-position overcommitment."],
    });
  } else if (draftSlotStrategy.archetype === "middle") {
    triggers.push({
      id: "middle-slot-flexibility",
      label: "Middle-slot flexibility contingency",
      appliesToRounds: range(1, Math.min(10, roundCount)),
      appliesToPositions: ["QB", "RB", "WR", "TE"],
      triggerConditionSummary: "Middle slot has more frequent market updates before each pick.",
      suggestedAdjustment: "Preserve flexibility and let fallen value compete with pre-draft position lanes.",
      riskLevel: "medium",
      confidence: "high",
      reasons: ["Middle slots can react to both ends of the board.", "Avoids overcommitting before value falls."],
    });
  }

  return uniqueBy(triggers, (trigger) => trigger.id).slice(0, 12);
}

function buildRoundWindowPlanDetailed(
  windows: PreDraftStrategyOutput["roundWindowPlan"],
  draftSlotStrategy: PreDraftStrategyOutput["draftSlotStrategy"],
  recommendations: H10WarRoomCompactRecommendation[],
  triggers: ContingencyTrigger[]
): RoundWindowPlanDetail[] {
  const valuePocketPositions = [...new Set(recommendations.filter((row) => row.h10.marketValueSignal === "above_market" || row.scoreComponents.marketValue >= 8).map((row) => normalizePosition(row.position)).filter(Boolean))];
  const tierRiskPositions = [...new Set(recommendations.filter((row) => row.tierDropRisk === "high" || row.scoreComponents.tierCliff >= 12).map((row) => normalizePosition(row.position)).filter(Boolean))];
  const waitPositions = [...new Set(recommendations.filter((row) => row.needTimingAction === "wait_one_turn" || row.needTimingAction === "wait_multiple_turns").map((row) => normalizePosition(row.position)).filter(Boolean))];

  return windows.map((window, index) => {
    const projectedPicks = draftSlotStrategy.roundPickWindows[index]?.picks ?? [];
    const windowRounds = roundsFromLabel(window.rounds);
    const matchingTriggers = triggers.filter((trigger) => trigger.appliesToRounds.some((round) => windowRounds.includes(round)));
    const avoidForcingPositions = [...new Set([
      ...window.positions.filter((position) => waitPositions.includes(position)),
      ...(window.window.toLowerCase().includes("late") || window.window.toLowerCase().includes("k/dst") ? [] : ["K", "DEF"]),
    ])].filter((position) => window.positions.includes(position) || position === "K" || position === "DEF");
    const likelyValuePockets = valuePocketPositions.filter((position) => window.positions.includes(position));
    const tierCliffRisks = tierRiskPositions.filter((position) => window.positions.includes(position));
    return {
      window: window.window,
      rounds: window.rounds,
      projectedPicks,
      primaryPositions: window.positions,
      avoidForcingPositions,
      likelyValuePockets,
      tierCliffRisks,
      contingencyTriggers: matchingTriggers.map((trigger) => trigger.label),
      fallbackPath: fallbackForWindow(window, tierCliffRisks, likelyValuePockets, draftSlotStrategy),
      guidance: window.guidance,
    };
  });
}

function buildSpecialPositionGuidance(input: PreDraftStrategyInput, requirements: NormalizedRosterRequirements) {
  const guidance: PreDraftStrategyOutput["specialPositionGuidance"] = [];
  if (input.room.hasIDP || requirements.hasIDP) {
    guidance.push({ position: "DL/LB/DB", guidance: "Plan IDP by position group; low-confidence baselines make tier risk and named targets more important." });
  }
  if (input.room.hasKicker || requirements.hasKicker) {
    guidance.push({ position: "K", guidance: "Kicker is a late fill position unless scoring settings create a measurable format signal." });
  }
  if (input.room.hasTeamDefense || requirements.hasTeamDefense) {
    guidance.push({ position: "DEF", guidance: "Team defense is a late fill position with allowance-only projection caveats where applicable." });
  }
  return guidance;
}

function buildRiskNotes(input: PreDraftStrategyInput, recommendations: H10WarRoomCompactRecommendation[]) {
  const notes = [
    "H11.0 is design/foundation only and read-only.",
    "True historical completed-draft outcome validation remains unavailable.",
  ];
  if (!input.draftSlot || !input.teamCount) notes.push("Exact snake timing requires draft slot and team count.");
  if (!input.rosterSlots?.length) notes.push("Roster requirements were inferred from available room flags and position coverage.");
  if (!recommendations.length) notes.push("H10 recommendation rows are missing, so watchlists are limited.");
  if (recommendations.some((row) => row.warningCodes.includes("NO_COMPATIBLE_MARKET"))) notes.push("Some rows lack compatible market data.");
  return notes;
}

function positionsAtRisk(
  priorityMap: PreDraftStrategyOutput["positionalPriorityMap"],
  recommendations: H10WarRoomCompactRecommendation[]
) {
  const risk = new Set<string>();
  for (const [position, priority] of Object.entries(priorityMap)) {
    if (priority.score >= 78) risk.add(position);
  }
  for (const row of recommendations) {
    if (row.tierDropRisk === "high") risk.add(normalizePosition(row.position));
  }
  return [...risk].filter(Boolean).sort();
}

function normalizedRecommendations(roomResult: PreDraftStrategyInput["roomResult"]): H10WarRoomCompactRecommendation[] {
  return uniqueBy([...(roomResult?.topRecommendations ?? []), ...(roomResult?.watchlistExamples ?? [])], (row) => `${row.displayName}|${row.position}|${row.recommendationRank}`);
}

function buildFlexStructure(requirements: NormalizedRosterRequirements) {
  return [
    requirements.offensiveFlexCount ? `${requirements.offensiveFlexCount} offensive flex` : null,
    requirements.superflexCount ? `${requirements.superflexCount} superflex` : null,
    requirements.idpFlexCount ? `${requirements.idpFlexCount} IDP flex` : null,
  ].filter((value): value is string => Boolean(value));
}

function inferScoringType(scoringSettings: PreDraftStrategyInput["scoringSettings"]) {
  if (!scoringSettings) return "unknown";
  const reception = Number(scoringSettings.rec ?? scoringSettings.reception ?? scoringSettings.receptions ?? 0);
  if (reception >= 1) return "PPR";
  if (reception > 0) return "half PPR";
  return "standard or custom";
}

function isTePremium(scoringSettings: PreDraftStrategyInput["scoringSettings"]) {
  if (!scoringSettings) return false;
  return Number(scoringSettings.bonus_rec_te ?? scoringSettings.te_premium ?? scoringSettings.teRecBonus ?? 0) > 0;
}

function priorityForScore(score: number): StrategyPriority {
  if (score >= 88) return "elite";
  if (score >= 72) return "high";
  if (score >= 50) return "medium";
  if (score >= 30) return "low";
  return "defer";
}

function normalizePosition(position: string | null | undefined): string {
  const normalized = (position ?? "").trim().toUpperCase();
  if (normalized === "DST" || normalized === "D/ST") return "DEF";
  if (normalized === "DE" || normalized === "DT" || normalized === "EDGE") return "DL";
  if (normalized === "CB" || normalized === "S" || normalized === "FS" || normalized === "SS") return "DB";
  if (normalized === "ILB" || normalized === "OLB" || normalized === "MLB") return "LB";
  return normalized;
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function range(start: number, end: number): number[] {
  const from = Math.max(1, Math.floor(start));
  const to = Math.max(from, Math.floor(end));
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

function roundsFromLabel(label: string): number[] {
  const normalized = label.toLowerCase();
  const match = normalized.match(/(\d+)\s*-\s*(\d+)/);
  if (match) return range(Number(match[1]), Number(match[2]));
  const plus = normalized.match(/(\d+)\+/);
  if (plus) return range(Number(plus[1]), Number(plus[1]) + 8);
  if (normalized.includes("middle-late")) return range(6, 16);
  if (normalized.includes("late")) return range(10, 16);
  const single = normalized.match(/\d+/);
  return single ? [Number(single[0])] : range(1, 16);
}

function fallbackForWindow(
  window: PreDraftStrategyOutput["roundWindowPlan"][number],
  tierCliffRisks: string[],
  likelyValuePockets: string[],
  draftSlotStrategy: PreDraftStrategyOutput["draftSlotStrategy"]
): string {
  if (tierCliffRisks.length > 0 && likelyValuePockets.length > 0) {
    return `Monitor ${tierCliffRisks.join("/")} tier risk while keeping ${likelyValuePockets.join("/")} value pockets active.`;
  }
  if (tierCliffRisks.length > 0) {
    return `If ${tierCliffRisks.join("/")} dries up, pivot to the strongest available value pocket rather than forcing the next tier.`;
  }
  if (likelyValuePockets.length > 0) {
    return `If expected targets thin out, let ${likelyValuePockets.join("/")} value pockets compete with roster need.`;
  }
  if (draftSlotStrategy.isTurnPick || draftSlotStrategy.isNearTurn) {
    return "Use paired-position planning because the next wait can be long.";
  }
  if (window.window.toLowerCase().includes("late")) {
    return "Use late windows for remaining coverage and avoid forcing low-signal positions early.";
  }
  return "Preserve flexibility and monitor tier movement before committing to a narrow position lane.";
}

function uniqueBy<T>(items: T[], keyFor: (item: T) => string): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    const key = keyFor(item);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}
