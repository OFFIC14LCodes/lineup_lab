import { describe, expect, it } from "vitest";

import { buildWarRoomLiveState } from "./war-room-live-state";

const NOW = new Date("2026-06-17T12:00:00.000Z");

describe("buildWarRoomLiveState", () => {
  it("classifies fresh draft state under 30 seconds", () => {
    const state = buildWarRoomLiveState(base({ lastUpdatedAt: "2026-06-17T11:59:45.000Z" }));

    expect(state.status).toBe("fresh");
    expect(state.label).toBe("Live");
    expect(state.secondsSinceUpdate).toBe(15);
    expect(state.warnings).toEqual([]);
  });

  it("classifies watch state between 30 and 90 seconds", () => {
    const state = buildWarRoomLiveState(base({ lastUpdatedAt: "2026-06-17T11:59:15.000Z" }));

    expect(state.status).toBe("watch");
    expect(state.label).toBe("Watch");
    expect(state.warnings).toContain("Draft state is aging; confirm sync before relying on tight timing calls.");
  });

  it("classifies stale state after 90 seconds", () => {
    const state = buildWarRoomLiveState(base({ lastUpdatedAt: "2026-06-17T11:58:00.000Z" }));

    expect(state.status).toBe("stale");
    expect(state.label).toBe("Stale");
    expect(state.warnings).toContain("Suggestions may be based on stale draft state.");
  });

  it("classifies polling errors without discarding stale age", () => {
    const state = buildWarRoomLiveState(base({
      error: "Sync failed.",
      lastUpdatedAt: "2026-06-17T11:58:00.000Z",
    }));

    expect(state.status).toBe("error");
    expect(state.label).toBe("Sleeper unavailable");
    expect(state.warnings).toContain("Sleeper sync or draft-state polling reported an error.");
    expect(state.warnings).toContain("Suggestions may be based on stale draft state.");
  });

  it("handles missing timestamp safely", () => {
    const state = buildWarRoomLiveState(base({ lastUpdatedAt: null }));

    expect(state.status).toBe("unknown");
    expect(state.secondsSinceUpdate).toBeNull();
    expect(state.warnings).toContain("Draft-state freshness is not available yet.");
  });

  it("summarizes draft lifecycle statuses", () => {
    expect(buildWarRoomLiveState(base({ draftStatus: "complete" })).draftStatusSummary).toContain("Draft complete");
    expect(buildWarRoomLiveState(base({ draftStatus: "pre_draft" })).draftStatusSummary).toContain("Draft not started");
  });
});

function base(overrides: Partial<Parameters<typeof buildWarRoomLiveState>[0]> = {}): Parameters<typeof buildWarRoomLiveState>[0] {
  return {
    now: NOW,
    lastUpdatedAt: "2026-06-17T11:59:45.000Z",
    error: null,
    syncing: false,
    draftStatus: "drafting",
    currentPickNumber: 42,
    currentRound: 4,
    pickCount: 41,
    ...overrides,
  };
}
