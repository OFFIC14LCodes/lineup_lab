export type DraftBoardTeam = {
  rosterId: string;
  label: string;
  ownerPlatformUserId: string | null;
  draftSlot: number;
  mappingSource: "draft_order_user" | "draft_order_roster" | "pick_history" | "roster_id_fallback";
};

export type DraftBoardRosterLike = {
  platform_roster_id: string;
  owner_platform_user_id: string | null;
  owner_display_name: string | null;
};

export type DraftBoardPickLike = {
  pick_in_round?: number | null;
  platform_roster_id?: string | null;
};

export function buildDraftBoardTeams(input: {
  rosters: DraftBoardRosterLike[];
  roomMetadata?: unknown;
  picks?: DraftBoardPickLike[];
  teamCount?: number | null;
}): DraftBoardTeam[] {
  const draftOrder = readDraftOrder(input.roomMetadata);
  const pickSlotByRoster = readPickSlotByRoster(input.picks ?? [], input.teamCount);

  return input.rosters
    .map((roster) => {
      const byUser = roster.owner_platform_user_id ? finiteSlot(draftOrder.get(roster.owner_platform_user_id), input.teamCount) : null;
      const byRoster = finiteSlot(draftOrder.get(roster.platform_roster_id), input.teamCount);
      const byPick = finiteSlot(pickSlotByRoster.get(roster.platform_roster_id), input.teamCount);
      const byRosterId = finiteSlot(roster.platform_roster_id, input.teamCount);
      const draftSlot = byUser ?? byRoster ?? byPick ?? byRosterId ?? Number.MAX_SAFE_INTEGER;
      return {
        rosterId: roster.platform_roster_id,
        label: roster.owner_display_name ?? `Roster ${roster.platform_roster_id}`,
        ownerPlatformUserId: roster.owner_platform_user_id,
        draftSlot,
        mappingSource: byUser
          ? "draft_order_user"
          : byRoster
            ? "draft_order_roster"
            : byPick
              ? "pick_history"
              : "roster_id_fallback",
      } satisfies DraftBoardTeam;
    })
    .sort((a, b) => a.draftSlot - b.draftSlot || a.label.localeCompare(b.label));
}

export function readDraftOrder(metadata: unknown): Map<string, number> {
  const root = recordOrNull(metadata);
  const raw = recordOrNull(root?.draft_order) ?? recordOrNull(recordOrNull(root?.metadata)?.draft_order);
  const order = new Map<string, number>();
  if (!raw) return order;

  for (const [key, value] of Object.entries(raw)) {
    const slot = finiteSlot(value, null);
    if (slot) order.set(key, slot);
  }
  return order;
}

function readPickSlotByRoster(picks: DraftBoardPickLike[], teamCount: number | null | undefined): Map<string, number> {
  const slots = new Map<string, number>();
  for (const pick of picks) {
    if (!pick.platform_roster_id || slots.has(pick.platform_roster_id)) continue;
    const slot = finiteSlot(pick.pick_in_round, teamCount);
    if (slot) slots.set(pick.platform_roster_id, slot);
  }
  return slots;
}

function finiteSlot(value: unknown, teamCount: number | null | undefined): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const slot = Math.floor(numeric);
  if (teamCount && slot > teamCount) return null;
  return slot;
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
