import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildPreDraftStrategyUiViewModel, findBannedStrategyUiLanguage } from "@/lib/draft/pre-draft-strategy-ui";

describe("DraftWarRoom H11 strategy UI wiring", () => {
  const source = readFileSync(path.join(process.cwd(), "src", "components", "draft-war-room.tsx"), "utf8");

  it("fetches the authenticated pre-draft strategy endpoint", () => {
    expect(source).toContain("/pre-draft-strategy");
    expect(source).toContain("cache: \"no-store\"");
  });

  it("renders required strategy sections and states", () => {
    [
      "League Summary",
      "Scoring Emphasis",
      "Roster Construction Plan",
      "Positional Priority Map",
      "Draft Slot Strategy",
      "Round Window Plan",
      "Tier Cliff Watchlist",
      "Value Pocket Watchlist",
      "Wait Positions",
      "Do-Not-Force Positions",
      "Contingency Plans",
      "Special Position Guidance",
      "Risk Notes",
      "Strategy preview is partial because some draft context is missing.",
      "Loading strategy preview",
      "Unable to load strategy preview. War Room remains usable.",
    ].forEach((text) => expect(source).toContain(text));
  });

  it("keeps read-only and experimental caveats visible", () => {
    const model = buildPreDraftStrategyUiViewModel({ loadState: "ready", error: null, sectionCounts: { scoringEmphasis: 1 } });

    expect(model.title).toBe("Pre-Draft Strategy Preview");
    expect(model.caveats).toContain("Read-only");
    expect(model.caveats).toContain("Experimental");
    expect(model.caveats).toContain("Historical outcome validation is not yet available.");
  });

  it("does not introduce banned H11 strategy UI language", () => {
    const visibleCopy = [
      "Pre-Draft Strategy Preview",
      "Read-only",
      "Experimental",
      "Blackbird Strategy Preview based on currently available projections, market context, and league context.",
      "Strategy preview is partial because some draft context is missing.",
      "Unable to load strategy preview. War Room remains usable.",
      "Historical outcome validation is not yet available.",
    ].join(" ");
    const bannedFound = findBannedStrategyUiLanguage(visibleCopy);

    expect(bannedFound).toEqual([]);
  });

  it("does not persist strategy UI state", () => {
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("pre-draft-strategy\", { method: \"POST\"");
  });

  it("renders the read-only Blackbird board controls and missing-data labels", () => {
    [
      "Blackbird Board",
      "Draft Suggestion is live and available-only. Blackbird Rank is static league value across draftable players.",
      "Draft Suggestions",
      "Full Blackbird Rank",
      "Available Blackbird Rank",
      "Load more",
      "Projection unavailable",
      "Season Projection",
      "Floor",
      "Median",
      "Ceiling",
      "Blackbird Power Rank",
      "Player + Details",
      "Draft Suggestion",
      "Risk",
      "Live Plan Status",
      "Contingency active",
      "Wait plan supported",
      "Wait plan weakening",
      "Tier risk rising",
      "Unexpected value signal",
      "Data Gaps",
      "Rookie projection",
      "Enriched rookie data available",
      "Draft capital available",
      "Missing draft capital",
      "College production available",
      "Missing college production",
      "Role uncertainty",
      "Rookie Context",
      "withFallbackDraftSuggestionRanks",
      "Filters and sort are local to this browser view.",
    ].forEach((text) => expect(source).toContain(text));
  });

  it("wires read-only historical player profiles into the player modal", () => {
    [
      "/api/player-profiles/",
      "weeklyLimit: \"8\"",
      "Historical Profile",
      "Loading historical profile...",
      "Historical profile not available yet.",
      "League projection profile is not available for this player yet.",
      "Profile match confidence:",
      "Review may be needed.",
      "Recent Weekly Game Log",
      "weeklyGameLog.slice(0, 8)",
      "profile.warnings.map",
      "buildWeeklyStatLine",
      "idpSummary",
    ].forEach((text) => expect(source).toContain(text));
  });
});
