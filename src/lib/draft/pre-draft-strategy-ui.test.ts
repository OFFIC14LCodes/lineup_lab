import { describe, expect, it } from "vitest";

import {
  buildPreDraftStrategyUiViewModel,
  findBannedStrategyUiLanguage,
} from "./pre-draft-strategy-ui";

describe("H11 pre-draft strategy UI model", () => {
  it("models the loading state", () => {
    const model = buildPreDraftStrategyUiViewModel({ loadState: "loading", error: null });

    expect(model.loading).toBe(true);
    expect(model.title).toBe("Pre-Draft Strategy Preview");
  });

  it("models the endpoint error state without breaking the War Room", () => {
    const model = buildPreDraftStrategyUiViewModel({ loadState: "error", error: "Unable to load strategy preview. War Room remains usable." });

    expect(model.unavailable).toBe(true);
    expect(model.errorMessage).toContain("War Room remains usable");
  });

  it("models partial data gaps", () => {
    const model = buildPreDraftStrategyUiViewModel({ loadState: "ready", error: null, dataGaps: ["missing draft slot"] });

    expect(model.partial).toBe(true);
    expect(model.dataGaps).toEqual(["missing draft slot"]);
  });

  it("models empty strategy sections", () => {
    const model = buildPreDraftStrategyUiViewModel({ loadState: "ready", error: null, sectionCounts: {} });

    expect(model.empty).toBe(true);
  });

  it("keeps read-only and experimental caveats visible", () => {
    const model = buildPreDraftStrategyUiViewModel({ loadState: "ready", error: null, sectionCounts: { scoringEmphasis: 1 } });

    expect(model.caveats).toContain("Read-only");
    expect(model.caveats).toContain("Experimental");
    expect(model.caveats.join(" ")).toContain("Historical outcome validation is not yet available.");
  });

  it("detects banned UI language", () => {
    expect(findBannedStrategyUiLanguage("This is the best pick and a final plan.")).toEqual(["best pick", "final plan"]);
  });

  it("does not flag approved strategy preview language", () => {
    const model = buildPreDraftStrategyUiViewModel({
      loadState: "ready",
      error: null,
      sectionCounts: { scoringEmphasis: 1, specialPositionGuidance: 1 },
      riskNotes: ["True historical completed-draft outcome validation remains unavailable."],
      safetyLanguagePassed: true,
    });

    expect(model.bannedLanguageFound).toEqual([]);
  });
});
