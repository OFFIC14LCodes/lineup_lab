import { describe, expect, it } from "vitest";

import { resolveStoredRowPositionGroup } from "@/lib/scoring/server/score-stored-row";

describe("resolveStoredRowPositionGroup", () => {
  it("uses the row position group when valid", () => {
    const result = resolveStoredRowPositionGroup({
      rowPositionGroup: "WR",
      player: {
        id: "player-1",
        full_name: "Receiver One",
        team: "CHI",
        position: "WR",
        primary_position: "WR",
        position_group: "WR"
      }
    });

    expect(result.positionGroup).toBe("WR");
    expect(result.warnings).toHaveLength(0);
  });

  it("falls back to canonical player position group", () => {
    const result = resolveStoredRowPositionGroup({
      rowPositionGroup: null,
      player: {
        id: "player-1",
        full_name: "Defender One",
        team: "CHI",
        position: "EDGE",
        primary_position: "EDGE",
        position_group: "DL"
      }
    });

    expect(result.positionGroup).toBe("DL");
  });

  it("falls back to normalized raw position when group is absent", () => {
    const result = resolveStoredRowPositionGroup({
      rowPositionGroup: null,
      player: {
        id: "player-1",
        full_name: "Defender One",
        team: "CHI",
        position: "EDGE",
        raw_position: "EDGE",
        primary_position: null,
        position_group: null
      }
    });

    expect(result.positionGroup).toBe("DL");
    expect(result.warnings[0]?.code).toBe("POSITION_GROUP_FALLBACK");
  });

  it("prefers canonical position when the stored row conflicts", () => {
    const result = resolveStoredRowPositionGroup({
      rowPositionGroup: "WR",
      player: {
        id: "player-1",
        full_name: "Kicker One",
        team: "CHI",
        position: "K",
        primary_position: "K",
        position_group: "K"
      }
    });

    expect(result.positionGroup).toBe("K");
    expect(result.warnings[0]?.code).toBe("POSITION_GROUP_CONFLICT");
  });

  it("returns a warning when position is missing entirely", () => {
    const result = resolveStoredRowPositionGroup({
      rowPositionGroup: null,
      player: {
        id: "player-1",
        full_name: "Mystery Player",
        team: null,
        position: null,
        primary_position: null,
        position_group: null
      }
    });

    expect(result.positionGroup).toBeNull();
    expect(result.warnings[0]?.code).toBe("POSITION_GROUP_MISSING");
  });
});
