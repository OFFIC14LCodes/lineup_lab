import { describe, expect, it } from "vitest";

import { buildNflverseSourceUrl } from "./download";

describe("buildNflverseSourceUrl", () => {
  it("resolves season 2025 to the correct release URL", () => {
    expect(buildNflverseSourceUrl(2025)).toBe(
      "https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_2025.csv"
    );
  });

  it("embeds the season in the filename for other seasons", () => {
    expect(buildNflverseSourceUrl(2024)).toBe(
      "https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_2024.csv"
    );
    expect(buildNflverseSourceUrl(2023)).toBe(
      "https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_2023.csv"
    );
  });

  it("uses the correct release tag stats_player", () => {
    const url = buildNflverseSourceUrl(2025);
    expect(url).toContain("releases/download/stats_player/");
  });

  it("does not use the incorrect player_stats release tag", () => {
    const url = buildNflverseSourceUrl(2025);
    expect(url).not.toContain("/player_stats/");
  });
});
