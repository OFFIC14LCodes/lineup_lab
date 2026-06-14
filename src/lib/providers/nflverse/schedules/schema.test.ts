import { describe, expect, it } from "vitest";

import { parseScheduleRow, validateSchedulesSchema } from "./schema";

describe("validateSchedulesSchema", () => {
  it("returns valid for a complete column list", () => {
    const result = validateSchedulesSchema([
      "game_id", "season", "game_type", "week",
      "home_team", "away_team", "home_score", "away_score",
      "gameday", "overtime",
    ]);
    expect(result.valid).toBe(true);
    expect(result.missingColumns).toEqual([]);
  });

  it("reports missing required columns", () => {
    const result = validateSchedulesSchema(["game_id", "season"]);
    expect(result.valid).toBe(false);
    expect(result.missingColumns).toContain("home_score");
    expect(result.missingColumns).toContain("away_score");
  });
});

describe("parseScheduleRow", () => {
  const validRow = {
    game_id: "2025_01_DET_LA",
    season: "2025",
    game_type: "REG",
    week: "1",
    home_team: "LA",
    away_team: "DET",
    home_score: "17",
    away_score: "24",
  };

  it("parses a valid completed regular-season game", () => {
    const result = parseScheduleRow(validRow);
    expect(result).not.toBeNull();
    expect(result?.gameId).toBe("2025_01_DET_LA");
    expect(result?.season).toBe(2025);
    expect(result?.week).toBe(1);
    expect(result?.homeTeamRaw).toBe("LA");
    expect(result?.awayTeamRaw).toBe("DET");
    expect(result?.homeScore).toBe(17);
    expect(result?.awayScore).toBe(24);
  });

  it("returns null for non-REG game types", () => {
    expect(parseScheduleRow({ ...validRow, game_type: "POST" })).toBeNull();
    expect(parseScheduleRow({ ...validRow, game_type: "WC" })).toBeNull();
    expect(parseScheduleRow({ ...validRow, game_type: "SB" })).toBeNull();
  });

  it("returns null when scores are absent (game not yet played)", () => {
    expect(parseScheduleRow({ ...validRow, home_score: "NA", away_score: "NA" })).toBeNull();
    expect(parseScheduleRow({ ...validRow, home_score: "", away_score: "" })).toBeNull();
  });

  it("returns null for missing required fields", () => {
    expect(parseScheduleRow({ ...validRow, game_id: "" })).toBeNull();
    expect(parseScheduleRow({ ...validRow, home_team: "" })).toBeNull();
  });

  it("rejects negative scores", () => {
    expect(parseScheduleRow({ ...validRow, home_score: "-3" })).toBeNull();
  });

  it("parses OT games (scores present, game_type REG)", () => {
    // Overtime games still have normal final scores in schedules.csv.
    const result = parseScheduleRow({ ...validRow, home_score: "20", away_score: "17" });
    expect(result?.homeScore).toBe(20);
  });

  it("parses 0-0 score games (not played / weather forfeits)", () => {
    const result = parseScheduleRow({ ...validRow, home_score: "0", away_score: "0" });
    expect(result?.homeScore).toBe(0);
    expect(result?.awayScore).toBe(0);
  });
});
