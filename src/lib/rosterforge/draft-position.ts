export type DraftPositionContext = {
  currentPickNumber: number;
  currentRound: number;
  picksUntilMyNextPick: number | null;
  myDraftSlot: number | null;
  teamCount: number | null;
};

export type DraftPickLike = {
  pick_no?: number | null;
  round?: number | null;
  pick_in_round?: number | null;
  platform_roster_id?: string | null;
  picked_by_platform_user_id?: string | null;
};

export function buildDraftPositionContext(input: {
  picks: DraftPickLike[];
  settings: unknown;
  myRosterId?: string | null;
  myPlatformUserId?: string | null;
  teamCountFallback?: number | null;
  roundsFallback?: number | null;
}): DraftPositionContext {
  const teamCount =
    readPositiveInt(input.settings, "teams") ??
    readPositiveInt(input.settings, "slots") ??
    finitePositiveInt(input.teamCountFallback);
  const rounds = readPositiveInt(input.settings, "rounds") ?? finitePositiveInt(input.roundsFallback);
  const lastPickNumber = Math.max(0, ...input.picks.map((pick) => finitePositiveInt(pick.pick_no) ?? 0));
  const currentPickNumber = lastPickNumber + 1;
  const currentRound = teamCount ? Math.ceil(currentPickNumber / teamCount) : Math.max(1, input.picks.at(-1)?.round ?? 1);
  const myDraftSlot = inferMyDraftSlot({
    picks: input.picks,
    myRosterId: input.myRosterId,
    myPlatformUserId: input.myPlatformUserId,
    teamCount,
  });
  const picksUntilMyNextPick =
    teamCount && rounds && myDraftSlot
      ? getPicksUntilDraftSlot({
          currentPickNumber,
          teamCount,
          rounds,
          draftSlot: myDraftSlot,
        })
      : null;

  return {
    currentPickNumber,
    currentRound,
    picksUntilMyNextPick,
    myDraftSlot,
    teamCount,
  };
}

export function getPicksUntilDraftSlot(input: {
  currentPickNumber: number;
  teamCount: number;
  rounds: number;
  draftSlot: number;
}): number | null {
  if (
    !Number.isFinite(input.currentPickNumber) ||
    !Number.isFinite(input.teamCount) ||
    !Number.isFinite(input.rounds) ||
    !Number.isFinite(input.draftSlot) ||
    input.currentPickNumber <= 0 ||
    input.teamCount <= 0 ||
    input.rounds <= 0 ||
    input.draftSlot <= 0 ||
    input.draftSlot > input.teamCount
  ) {
    return null;
  }

  for (let pick = input.currentPickNumber; pick <= input.teamCount * input.rounds; pick += 1) {
    const round = Math.ceil(pick / input.teamCount);
    const pickInRound = ((pick - 1) % input.teamCount) + 1;
    const slot = round % 2 === 0 ? input.teamCount - pickInRound + 1 : pickInRound;
    if (slot === input.draftSlot) return pick - input.currentPickNumber;
  }

  return null;
}

function inferMyDraftSlot(input: {
  picks: DraftPickLike[];
  myRosterId?: string | null;
  myPlatformUserId?: string | null;
  teamCount: number | null;
}): number | null {
  const mine = input.picks.find((pick) =>
    Boolean(
      (input.myRosterId && pick.platform_roster_id === input.myRosterId) ||
        (input.myPlatformUserId && pick.picked_by_platform_user_id === input.myPlatformUserId)
    )
  );
  const persistedDraftSlot = finitePositiveInt(mine?.pick_in_round);
  if (persistedDraftSlot && (!input.teamCount || persistedDraftSlot <= input.teamCount)) return persistedDraftSlot;

  const rosterSlot = finitePositiveInt(input.myRosterId);
  if (rosterSlot && (!input.teamCount || rosterSlot <= input.teamCount)) return rosterSlot;

  return null;
}

function readPositiveInt(settings: unknown, key: string): number | null {
  if (!settings || typeof settings !== "object") return null;
  return finitePositiveInt((settings as Record<string, unknown>)[key]);
}

function finitePositiveInt(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : null;
}
