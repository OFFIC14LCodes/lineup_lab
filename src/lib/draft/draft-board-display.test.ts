import { describe, expect, it } from "vitest";

import { draftBoardPositionBadgeClass, normalizeDraftBoardPosition } from "@/lib/draft/draft-board-display";

describe("draft board position display", () => {
  it("normalizes defensive aliases for board labels and colors", () => {
    expect(normalizeDraftBoardPosition("S")).toBe("DB");
    expect(normalizeDraftBoardPosition("SS")).toBe("DB");
    expect(normalizeDraftBoardPosition("FS")).toBe("DB");
    expect(normalizeDraftBoardPosition("CB")).toBe("DB");
    expect(normalizeDraftBoardPosition("DE")).toBe("DL");
    expect(normalizeDraftBoardPosition("DT")).toBe("DL");
    expect(normalizeDraftBoardPosition("ILB")).toBe("LB");
    expect(normalizeDraftBoardPosition("OLB")).toBe("LB");
    expect(normalizeDraftBoardPosition("MLB")).toBe("LB");
    expect(normalizeDraftBoardPosition("D/ST")).toBe("DST");
    expect(normalizeDraftBoardPosition("DEF")).toBe("DST");
  });

  it("keeps unknown positions visually safe", () => {
    expect(normalizeDraftBoardPosition("P")).toBe("UNK");
    expect(draftBoardPositionBadgeClass("P")).toContain("border-line");
  });
});
