export type DraftSlotBand = "early" | "early-middle" | "middle" | "late-middle" | "late" | "unknown";

export type ProjectedUserPick = {
  round: number;
  pickInRound: number;
  overallPick: number;
  window: "early anchor" | "second/third turn" | "middle value" | "late fill";
};

export type RoundPickWindow = {
  label: string;
  rounds: string;
  picks: number[];
  guidance: string;
};

export type DraftSlotStrategyCalibration = {
  draftSlot: number | null;
  teamCount: number | null;
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
  dataGaps: string[];
};

const SUPPORTED_TEAM_COUNTS = new Set([8, 10, 12, 14]);

export function buildDraftSlotStrategyCalibration(input: {
  draftSlot: number | null | undefined;
  teamCount: number | null | undefined;
  rounds?: number | null | undefined;
}): DraftSlotStrategyCalibration {
  const teamCount = positiveInt(input.teamCount);
  const draftSlot = positiveInt(input.draftSlot);
  const rounds = positiveInt(input.rounds) ?? 18;
  const dataGaps: string[] = [];

  if (!teamCount) dataGaps.push("team count unavailable");
  if (!draftSlot) dataGaps.push("draft slot unavailable");
  if (teamCount && !SUPPORTED_TEAM_COUNTS.has(teamCount)) dataGaps.push(`team count ${teamCount} uses fallback slot thresholds`);
  if (!teamCount || !draftSlot || draftSlot > teamCount) {
    return {
      draftSlot: draftSlot ?? null,
      teamCount: teamCount ?? null,
      draftSlotBand: "unknown",
      isTurnPick: false,
      isNearTurn: false,
      averagePicksBetweenTurns: null,
      maxWaitUntilNextPick: null,
      turnPairingRisk: "unknown",
      slotStrategySummary: "Draft slot and team count are needed for exact snake timing.",
      projectedUserPicks: [],
      roundPickWindows: [],
      roundWindowPlanBySlot: [],
      timingSignals: ["Draft slot and team count are needed for exact snake timing."],
      dataGaps,
    };
  }

  const draftSlotBand = classifyDraftSlotBand(draftSlot, teamCount);
  const isTurnPick = draftSlot === 1 || draftSlot === teamCount;
  const isNearTurn = isTurnPick || draftSlot === 2 || draftSlot === teamCount - 1;
  const waits = waitLengthsForSlot(draftSlot, teamCount);
  const maxWaitUntilNextPick = Math.max(...waits);
  const averagePicksBetweenTurns = round(waits.reduce((sum, value) => sum + value, 0) / waits.length);
  const turnPairingRisk = isTurnPick || maxWaitUntilNextPick >= teamCount + 7 ? "high" : isNearTurn || maxWaitUntilNextPick >= teamCount + 3 ? "medium" : "low";
  const projectedUserPicks = buildProjectedUserPicks(draftSlot, teamCount, rounds);
  const roundPickWindows = buildRoundPickWindows(projectedUserPicks, draftSlotBand, maxWaitUntilNextPick);
  const timingSignals = buildTimingSignals({ draftSlotBand, isTurnPick, isNearTurn, maxWaitUntilNextPick });

  return {
    draftSlot,
    teamCount,
    draftSlotBand,
    isTurnPick,
    isNearTurn,
    averagePicksBetweenTurns,
    maxWaitUntilNextPick,
    turnPairingRisk,
    slotStrategySummary: summarizeSlot({ draftSlotBand, isTurnPick, isNearTurn, maxWaitUntilNextPick }),
    projectedUserPicks,
    roundPickWindows,
    roundWindowPlanBySlot: roundPickWindows.map((window) => ({
      window: window.label,
      rounds: window.rounds,
      picks: window.picks,
      guidance: window.guidance,
    })),
    timingSignals,
    dataGaps,
  };
}

export function classifyDraftSlotBand(draftSlot: number, teamCount: number): DraftSlotBand {
  if (!Number.isFinite(draftSlot) || !Number.isFinite(teamCount) || draftSlot < 1 || teamCount < 2 || draftSlot > teamCount) {
    return "unknown";
  }
  const pct = draftSlot / teamCount;
  if (pct <= 0.18) return "early";
  if (pct <= 0.36) return "early-middle";
  if (pct <= 0.64) return "middle";
  if (pct <= 0.82) return "late-middle";
  return "late";
}

export function expectedSnakePick(round: number, draftSlot: number, teamCount: number): ProjectedUserPick {
  const pickInRound = round % 2 === 0 ? teamCount - draftSlot + 1 : draftSlot;
  const overallPick = (round - 1) * teamCount + pickInRound;
  return {
    round,
    pickInRound,
    overallPick,
    window: round <= 2 ? "early anchor" : round <= 4 ? "second/third turn" : round <= 10 ? "middle value" : "late fill",
  };
}

function buildProjectedUserPicks(draftSlot: number, teamCount: number, rounds: number): ProjectedUserPick[] {
  const visibleRounds = Math.min(Math.max(rounds, 1), 20);
  return Array.from({ length: visibleRounds }, (_, index) => expectedSnakePick(index + 1, draftSlot, teamCount));
}

function buildRoundPickWindows(
  picks: ProjectedUserPick[],
  band: DraftSlotBand,
  maxWaitUntilNextPick: number
): RoundPickWindow[] {
  const early = picks.filter((pick) => pick.round <= 4);
  const middle = picks.filter((pick) => pick.round >= 5 && pick.round <= 10);
  const late = picks.filter((pick) => pick.round >= 11);
  return [
    {
      label: "early anchor window",
      rounds: "1-4",
      picks: early.map((pick) => pick.overallPick),
      guidance:
        band === "early"
          ? "Blackbird leans toward an anchor start while planning for the long Round 1-to-Round 2 wait."
          : band === "late"
            ? "Blackbird leans toward paired early selections because the next return can carry tier pressure."
            : "Blackbird leans toward flexible early value while tracking tier risk before the next window.",
    },
    {
      label: "middle-round value windows",
      rounds: "5-10",
      picks: middle.map((pick) => pick.overallPick),
      guidance: `Timing signal: compare value pockets against a max snake wait near ${maxWaitUntilNextPick} picks.`,
    },
    {
      label: "IDP timing window",
      rounds: "middle-late",
      picks: middle.slice(-2).concat(late.slice(0, 3)).map((pick) => pick.overallPick),
      guidance: "Use IDP tier risk and named targets before waiting through another full turn.",
    },
    {
      label: "K/DST timing window",
      rounds: "late",
      picks: late.slice(-4).map((pick) => pick.overallPick),
      guidance: "Keep K/DST in late fill windows unless scoring settings create a measurable format signal.",
    },
  ];
}

function waitLengthsForSlot(draftSlot: number, teamCount: number): number[] {
  const picks = [1, 2, 3, 4].map((round) => expectedSnakePick(round, draftSlot, teamCount).overallPick);
  return picks.slice(1).map((pick, index) => pick - picks[index] - 1);
}

function buildTimingSignals(input: {
  draftSlotBand: DraftSlotBand;
  isTurnPick: boolean;
  isNearTurn: boolean;
  maxWaitUntilNextPick: number;
}): string[] {
  const signals = [`Max wait until the next user pick is about ${input.maxWaitUntilNextPick} picks.`];
  if (input.isTurnPick) signals.unshift("Turn pick: Blackbird leans toward paired-position planning.");
  else if (input.isNearTurn) signals.unshift("Near-turn pick: tier risk rises when passing fragile positions.");
  else if (input.draftSlotBand === "middle") signals.unshift("Middle-slot timing signal: stay flexible and monitor tier movement.");
  else if (input.draftSlotBand === "early") signals.unshift("Early-slot timing signal: anchor selection matters before a long return.");
  else if (input.draftSlotBand === "early-middle") signals.unshift("Early-middle timing signal: balance anchor value with flexibility on the return.");
  else if (input.draftSlotBand === "late-middle") signals.unshift("Late-middle timing signal: prepare contingency pairs before the board approaches the turn.");
  else if (input.draftSlotBand === "late") signals.unshift("Late-slot timing signal: double-tap opportunity comes with tier-cliff pressure.");
  else signals.unshift("Slot timing signal: monitor value pockets and contingency paths.");
  return signals;
}

function summarizeSlot(input: {
  draftSlotBand: DraftSlotBand;
  isTurnPick: boolean;
  isNearTurn: boolean;
  maxWaitUntilNextPick: number;
}): string {
  if (input.draftSlotBand === "early") return `Early-slot strategy preview: prioritize an anchor start and account for a ${input.maxWaitUntilNextPick}-pick wait back.`;
  if (input.isTurnPick) return `Turn-slot strategy preview: plan paired selections and avoid passing thin tiers through a ${input.maxWaitUntilNextPick}-pick wait.`;
  if (input.isNearTurn) return `Near-turn strategy preview: keep contingency pairs ready because the return wait can reach ${input.maxWaitUntilNextPick} picks.`;
  if (input.draftSlotBand === "middle") return "Middle-slot strategy preview: preserve flexibility and exploit falling value while monitoring tier risk.";
  if (input.draftSlotBand === "early-middle") return `Early-middle slot strategy preview: blend anchor value with flexibility across a ${input.maxWaitUntilNextPick}-pick max wait.`;
  if (input.draftSlotBand === "late-middle") return `Late-middle slot strategy preview: prepare contingency pairs before turn pressure rises across a ${input.maxWaitUntilNextPick}-pick max wait.`;
  if (input.draftSlotBand === "late") return `Late-slot strategy preview: use double-tap planning while respecting tier-cliff pressure across a ${input.maxWaitUntilNextPick}-pick wait.`;
  return "Strategy preview uses generic slot timing because exact slot context is partial.";
}

function positiveInt(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
