export type WarRoomLiveStateStatus = "fresh" | "watch" | "stale" | "error" | "unknown";

export type WarRoomLiveState = {
  status: WarRoomLiveStateStatus;
  label: string;
  draftStatusSummary: string;
  lastUpdatedAt: string | null;
  secondsSinceUpdate: number | null;
  warnings: string[];
};

export const WAR_ROOM_LIVE_STATE_THRESHOLDS = {
  freshSeconds: 30,
  staleSeconds: 90,
} as const;

export function buildWarRoomLiveState(input: {
  now: Date;
  lastUpdatedAt: string | null;
  error: string | null;
  syncing: boolean;
  draftStatus: string | null | undefined;
  currentPickNumber: number | null | undefined;
  currentRound: number | null | undefined;
  pickCount: number | null | undefined;
}): WarRoomLiveState {
  const secondsSinceUpdate = secondsBetween(input.lastUpdatedAt, input.now);
  const warnings: string[] = [];
  const draftStatusSummary = buildDraftStatusSummary({
    draftStatus: input.draftStatus,
    currentPickNumber: input.currentPickNumber,
    currentRound: input.currentRound,
    pickCount: input.pickCount,
  });

  if (input.error) {
    warnings.push("Sleeper sync or draft-state polling reported an error.");
    if (secondsSinceUpdate !== null && secondsSinceUpdate > WAR_ROOM_LIVE_STATE_THRESHOLDS.staleSeconds) {
      warnings.push("Suggestions may be based on stale draft state.");
    }
    return {
      status: "error",
      label: "Sleeper unavailable",
      draftStatusSummary,
      lastUpdatedAt: input.lastUpdatedAt,
      secondsSinceUpdate,
      warnings,
    };
  }

  if (input.syncing) {
    return {
      status: secondsSinceUpdate === null ? "unknown" : classifyByAge(secondsSinceUpdate),
      label: "Syncing",
      draftStatusSummary,
      lastUpdatedAt: input.lastUpdatedAt,
      secondsSinceUpdate,
      warnings,
    };
  }

  if (secondsSinceUpdate === null) {
    warnings.push("Draft-state freshness is not available yet.");
    return {
      status: "unknown",
      label: draftStatusLabel(input.draftStatus, "Unknown"),
      draftStatusSummary,
      lastUpdatedAt: null,
      secondsSinceUpdate: null,
      warnings,
    };
  }

  const status = classifyByAge(secondsSinceUpdate);
  if (status === "watch") warnings.push("Draft state is aging; confirm sync before relying on tight timing calls.");
  if (status === "stale") warnings.push("Suggestions may be based on stale draft state.");

  return {
    status,
    label: draftStatusLabel(input.draftStatus, status === "fresh" ? "Live" : status === "watch" ? "Watch" : "Stale"),
    draftStatusSummary,
    lastUpdatedAt: input.lastUpdatedAt,
    secondsSinceUpdate,
    warnings,
  };
}

function classifyByAge(secondsSinceUpdate: number): WarRoomLiveStateStatus {
  if (secondsSinceUpdate < WAR_ROOM_LIVE_STATE_THRESHOLDS.freshSeconds) return "fresh";
  if (secondsSinceUpdate <= WAR_ROOM_LIVE_STATE_THRESHOLDS.staleSeconds) return "watch";
  return "stale";
}

function secondsBetween(value: string | null, now: Date): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor((now.getTime() - parsed) / 1000));
}

function draftStatusLabel(draftStatus: string | null | undefined, fallback: string): string {
  const normalized = draftStatus?.toLowerCase() ?? "";
  if (["complete", "completed", "finished"].includes(normalized)) return "Draft complete";
  if (["pre_draft", "created", "not_started"].includes(normalized)) return "Draft not started";
  if (normalized === "drafting" || normalized === "in_progress") return fallback === "Live" ? "Live" : fallback;
  return fallback;
}

function buildDraftStatusSummary(input: {
  draftStatus: string | null | undefined;
  currentPickNumber: number | null | undefined;
  currentRound: number | null | undefined;
  pickCount: number | null | undefined;
}): string {
  const normalized = input.draftStatus?.toLowerCase() ?? "";
  const status =
    ["complete", "completed", "finished"].includes(normalized)
      ? "Draft complete"
      : ["pre_draft", "created", "not_started"].includes(normalized)
        ? "Draft not started"
        : normalized === "drafting" || normalized === "in_progress"
          ? "Live draft"
          : "Draft status unknown";
  const pick = input.currentPickNumber ? `Pick ${input.currentPickNumber}` : null;
  const round = input.currentRound ? `Round ${input.currentRound}` : null;
  const drafted = input.pickCount !== null && input.pickCount !== undefined ? `${input.pickCount} drafted` : null;
  return [status, pick, round, drafted].filter(Boolean).join(" · ");
}
