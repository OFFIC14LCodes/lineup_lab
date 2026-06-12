import { describe, expect, it } from "vitest";

import { parseNflversePlayerRow } from "./normalize";

function makeRaw(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    gsis_id: "00-0039337",
    display_name: "Patrick Mahomes",
    position_group: "QB",
    position: "QB",
    espn_id: "3139477",
    latest_team: "KC",
    status: "ACT",
    last_season: "2025",
    ...overrides
  };
}

describe("parseNflversePlayerRow — valid rows", () => {
  it("parses a valid QB row", () => {
    const result = parseNflversePlayerRow(makeRaw());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.gsisId).toBe("00-0039337");
    expect(result.row.displayName).toBe("Patrick Mahomes");
    expect(result.row.positionGroup).toBe("QB");
    expect(result.row.espnId).toBe("3139477");
    expect(result.row.latestTeam).toBe("KC");
    expect(result.row.status).toBe("ACT");
    expect(result.row.lastSeason).toBe(2025);
  });

  it("parses last_season as integer", () => {
    const result = parseNflversePlayerRow(makeRaw({ last_season: "2024" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.lastSeason).toBe(2024);
  });

  it("handles NA last_season as null", () => {
    const result = parseNflversePlayerRow(makeRaw({ last_season: "NA" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.lastSeason).toBeNull();
  });

  it("handles empty last_season as null", () => {
    const result = parseNflversePlayerRow(makeRaw({ last_season: "" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.lastSeason).toBeNull();
  });

  it("handles NA espn_id as null", () => {
    const result = parseNflversePlayerRow(makeRaw({ espn_id: "NA" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.espnId).toBeNull();
  });

  it("handles empty espn_id as null", () => {
    const result = parseNflversePlayerRow(makeRaw({ espn_id: "" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.espnId).toBeNull();
  });

  it("preserves raw position_group alongside canonical", () => {
    const result = parseNflversePlayerRow(makeRaw({ position_group: "FB", position: "FB" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.rawPositionGroup).toBe("FB");
    expect(result.row.positionGroup).toBe("RB");
  });
});

describe("parseNflversePlayerRow — position group mapping", () => {
  it("maps FB to RB", () => {
    const result = parseNflversePlayerRow(makeRaw({ position_group: "FB", position: "FB" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.positionGroup).toBe("RB");
  });

  it("maps NT to DL", () => {
    const result = parseNflversePlayerRow(makeRaw({ position_group: "NT", position: "NT" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.positionGroup).toBe("DL");
  });

  it("maps EDGE to DL", () => {
    const result = parseNflversePlayerRow(makeRaw({ position_group: "EDGE", position: "EDGE" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.positionGroup).toBe("DL");
  });

  it("maps DE to DL", () => {
    const result = parseNflversePlayerRow(makeRaw({ position_group: "DE", position: "DE" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.positionGroup).toBe("DL");
  });

  it("maps ILB to LB", () => {
    const result = parseNflversePlayerRow(makeRaw({ position_group: "ILB", position: "ILB" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.positionGroup).toBe("LB");
  });

  it("maps CB to DB", () => {
    const result = parseNflversePlayerRow(makeRaw({ position_group: "CB", position: "CB" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.positionGroup).toBe("DB");
  });

  it("maps SS to DB", () => {
    const result = parseNflversePlayerRow(makeRaw({ position_group: "SS", position: "SS" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.positionGroup).toBe("DB");
  });

  it("leaves unknown position_group as null", () => {
    const result = parseNflversePlayerRow(makeRaw({ position_group: "SPECIAL", position: "SPEC" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.positionGroup).toBeNull();
  });
});

describe("parseNflversePlayerRow — rejection rules", () => {
  it("rejects blank gsis_id", () => {
    const result = parseNflversePlayerRow(makeRaw({ gsis_id: "" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.isTeamDefense).toBe(false);
  });

  it("rejects team-defense position_group DEF", () => {
    const result = parseNflversePlayerRow(makeRaw({ position_group: "DEF", position: "DEF" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.isTeamDefense).toBe(true);
  });

  it("rejects team-defense position_group DST", () => {
    const result = parseNflversePlayerRow(makeRaw({ position_group: "DST", position: "DST" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.isTeamDefense).toBe(true);
  });

  it("rejects team-defense position DST even when position_group is blank", () => {
    const result = parseNflversePlayerRow(makeRaw({ position_group: "", position: "DST" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.isTeamDefense).toBe(true);
  });
});

describe("parseNflversePlayerRow — name normalization", () => {
  it("normalizes display_name by stripping suffixes", () => {
    const result = parseNflversePlayerRow(makeRaw({ display_name: "Travis Kelce Jr." }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.normalizedName).toBe("travis kelce");
  });

  it("normalizes display_name accents", () => {
    const result = parseNflversePlayerRow(makeRaw({ display_name: "Davante Adams" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.normalizedName).toBe("davante adams");
  });

  it("produces empty normalizedName for empty display_name", () => {
    const result = parseNflversePlayerRow(makeRaw({ display_name: "" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.normalizedName).toBe("");
  });
});
