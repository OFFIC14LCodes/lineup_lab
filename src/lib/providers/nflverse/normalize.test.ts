import { describe, expect, it } from "vitest";

import { buildRowSha256Input, normalizeNflverseRow } from "./normalize";
import type { NflversePlayerStatsRaw } from "./schema";

function makeRaw(overrides: Partial<NflversePlayerStatsRaw> = {}): NflversePlayerStatsRaw {
  return {
    player_id: "00-0039337",
    player_display_name: "Patrick Mahomes",
    position: "QB",
    position_group: "QB",
    team: "KC",
    season: "2025",
    week: "1",
    season_type: "REG",
    opponent_team: "BAL",
    completions: "28",
    attempts: "40",
    passing_yards: "305",
    passing_tds: "3",
    passing_interceptions: "1",
    sacks_suffered: "2",
    passing_first_downs: "18",
    passing_2pt_conversions: "0",
    sack_fumbles: "0",
    carries: "3",
    rushing_yards: "12",
    rushing_tds: "0",
    rushing_fumbles: "0",
    rushing_fumbles_lost: "0",
    rushing_first_downs: "1",
    rushing_2pt_conversions: "0",
    receptions: "0",
    targets: "0",
    receiving_yards: "0",
    receiving_tds: "0",
    receiving_fumbles: "0",
    receiving_fumbles_lost: "0",
    receiving_first_downs: "0",
    receiving_2pt_conversions: "0",
    sack_fumbles_lost: "0",
    punt_return_yards: "0",
    kickoff_return_yards: "0",
    special_teams_tds: "0",
    fantasy_points: "28.65",
    fantasy_points_ppr: "28.65",
    ...overrides
  };
}

describe("normalizeNflverseRow — passing stats", () => {
  it("maps completions to pass_cmp", () => {
    const result = normalizeNflverseRow(makeRaw({ completions: "28" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["pass_cmp"]).toBe(28);
  });

  it("maps attempts to pass_att", () => {
    const result = normalizeNflverseRow(makeRaw({ attempts: "40" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["pass_att"]).toBe(40);
  });

  it("maps passing_yards to pass_yd", () => {
    const result = normalizeNflverseRow(makeRaw({ passing_yards: "305" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["pass_yd"]).toBe(305);
  });

  it("maps passing_tds to pass_td", () => {
    const result = normalizeNflverseRow(makeRaw({ passing_tds: "3" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["pass_td"]).toBe(3);
  });

  it("maps passing_interceptions to pass_int", () => {
    const result = normalizeNflverseRow(makeRaw({ passing_interceptions: "1" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["pass_int"]).toBe(1);
  });

  it("maps sacks_suffered to pass_sack", () => {
    const result = normalizeNflverseRow(makeRaw({ sacks_suffered: "2" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["pass_sack"]).toBe(2);
  });

  it("maps passing_first_downs to pass_fd", () => {
    const result = normalizeNflverseRow(makeRaw({ passing_first_downs: "18" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["pass_fd"]).toBe(18);
  });

  it("maps passing_2pt_conversions to pass_2pt when nonzero", () => {
    const result = normalizeNflverseRow(makeRaw({ passing_2pt_conversions: "1" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["pass_2pt"]).toBe(1);
  });

  it("derives pass_inc from attempts minus completions", () => {
    const result = normalizeNflverseRow(makeRaw({ attempts: "30", completions: "20" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["pass_inc"]).toBe(10);
  });

  it("derives zero pass_inc for a 0-attempt, 0-completion row", () => {
    const result = normalizeNflverseRow(makeRaw({ attempts: "0", completions: "0" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["pass_inc"]).toBe(0);
  });

  it("omits pass_inc when both attempts and completions are absent", () => {
    const raw = makeRaw();
    delete raw["attempts"];
    delete raw["completions"];
    const result = normalizeNflverseRow(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["pass_inc"]).toBeUndefined();
  });

  it("clamps negative pass_inc to zero and emits a visible normalization warning", () => {
    const result = normalizeNflverseRow(makeRaw({ attempts: "20", completions: "21" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["pass_inc"]).toBe(0);
    expect(result.row.metadata.normalizationWarnings).toEqual([
      {
        code: "pass_cmp_gt_pass_att",
        message: "Completions exceeded attempts in nflverse weekly source; pass_inc was clamped to zero.",
        details: {
          completions: 21,
          attempts: 20
        }
      }
    ]);
  });
});

describe("normalizeNflverseRow — rushing stats", () => {
  it("maps carries to rush_att", () => {
    const result = normalizeNflverseRow(makeRaw({ carries: "15", position_group: "RB" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["rush_att"]).toBe(15);
  });

  it("maps rushing_yards to rush_yd", () => {
    const result = normalizeNflverseRow(makeRaw({ rushing_yards: "88", position_group: "RB" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["rush_yd"]).toBe(88);
  });

  it("maps rushing_tds to rush_td", () => {
    const result = normalizeNflverseRow(makeRaw({ rushing_tds: "1", position_group: "RB" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["rush_td"]).toBe(1);
  });

  it("maps rushing_first_downs to rush_fd", () => {
    const result = normalizeNflverseRow(makeRaw({ rushing_first_downs: "5", position_group: "RB" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["rush_fd"]).toBe(5);
  });
});

describe("normalizeNflverseRow — receiving stats", () => {
  it("maps receptions to rec", () => {
    const result = normalizeNflverseRow(makeRaw({ receptions: "8", position_group: "WR" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["rec"]).toBe(8);
  });

  it("maps targets to rec_tgt", () => {
    const result = normalizeNflverseRow(makeRaw({ targets: "11", position_group: "WR" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["rec_tgt"]).toBe(11);
  });

  it("maps receiving_yards to rec_yd", () => {
    const result = normalizeNflverseRow(makeRaw({ receiving_yards: "102", position_group: "TE" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["rec_yd"]).toBe(102);
  });

  it("maps receiving_tds to rec_td", () => {
    const result = normalizeNflverseRow(makeRaw({ receiving_tds: "1", position_group: "TE" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["rec_td"]).toBe(1);
  });

  it("maps receiving_first_downs to rec_fd", () => {
    const result = normalizeNflverseRow(makeRaw({ receiving_first_downs: "6", position_group: "WR" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["rec_fd"]).toBe(6);
  });

  it("maps receiving_2pt_conversions to rec_2pt when nonzero", () => {
    const result = normalizeNflverseRow(makeRaw({ receiving_2pt_conversions: "1", position_group: "WR" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["rec_2pt"]).toBe(1);
  });
});

describe("normalizeNflverseRow — H4A weekly source mappings", () => {
  it("aggregates total fumbles from nflverse weekly context columns", () => {
    const result = normalizeNflverseRow(
      makeRaw({
        sack_fumbles: "1",
        rushing_fumbles: "2",
        receiving_fumbles: "0",
        position_group: "RB"
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["fum"]).toBe(3);
  });

  it("maps kickoff_return_yards to kick_ret_yd", () => {
    const result = normalizeNflverseRow(makeRaw({ kickoff_return_yards: "63", position_group: "WR" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["kick_ret_yd"]).toBe(63);
  });

  it("maps punt_return_yards to punt_ret_yd", () => {
    const result = normalizeNflverseRow(makeRaw({ punt_return_yards: "27", position_group: "WR" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["punt_ret_yd"]).toBe(27);
  });

  it("maps special_teams_tds to return_td", () => {
    const result = normalizeNflverseRow(makeRaw({ special_teams_tds: "1", position_group: "RB" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["return_td"]).toBe(1);
  });

  it("does not fabricate return_fd without a verified weekly source column", () => {
    const result = normalizeNflverseRow(makeRaw({ position_group: "WR" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["return_fd"]).toBeUndefined();
  });
});

describe("normalizeNflverseRow — filtering", () => {
  it("skips unsupported position_group", () => {
    const result = normalizeNflverseRow(makeRaw({ position_group: "K" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/Unsupported position_group/);
  });

  it("skips postseason rows", () => {
    const result = normalizeNflverseRow(makeRaw({ season_type: "POST" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/non-regular/);
  });

  it("skips preseason rows", () => {
    const result = normalizeNflverseRow(makeRaw({ season_type: "PRE" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/non-regular/);
  });

  it("rejects missing player_id", () => {
    const result = normalizeNflverseRow(makeRaw({ player_id: "" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/player_id/);
  });

  it("rejects unknown season_type", () => {
    const result = normalizeNflverseRow(makeRaw({ season_type: "WEIRD" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/season_type/);
  });
});

describe("normalizeNflverseRow — zero/missing stat handling", () => {
  it("retains numeric zero values from known source columns", () => {
    const result = normalizeNflverseRow(makeRaw({ carries: "0", rushing_yards: "0" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["rush_att"]).toBe(0);
    expect(result.row.stats["rush_yd"]).toBe(0);
  });

  it("omits NA values", () => {
    const result = normalizeNflverseRow(makeRaw({ receptions: "NA", receiving_yards: "NA" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["rec"]).toBeUndefined();
    expect(result.row.stats["rec_yd"]).toBeUndefined();
  });

  it("omits empty string values", () => {
    const result = normalizeNflverseRow(makeRaw({ targets: "" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["rec_tgt"]).toBeUndefined();
  });

  it("omits absent source columns", () => {
    const raw = makeRaw();
    delete raw["targets"];
    const result = normalizeNflverseRow(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["rec_tgt"]).toBeUndefined();
  });

  it("omits null source columns", () => {
    const result = normalizeNflverseRow(makeRaw({ targets: null as unknown as string }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["rec_tgt"]).toBeUndefined();
  });

  it("omits NaN and infinite source values instead of coercing them to zero", () => {
    const result = normalizeNflverseRow(
      makeRaw({
        completions: "NaN",
        attempts: "Infinity",
        passing_yards: "-Infinity"
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["pass_cmp"]).toBeUndefined();
    expect(result.row.stats["pass_att"]).toBeUndefined();
    expect(result.row.stats["pass_yd"]).toBeUndefined();
  });

  it("counts canonical keys correctly", () => {
    const result = normalizeNflverseRow(makeRaw({
      passing_yards: "305",
      passing_tds: "3",
      passing_interceptions: "0",
      completions: "28",
      attempts: "40",
      // All rushing/receiving are 0
      carries: "0",
      rushing_yards: "0",
      rushing_tds: "0",
      rushing_first_downs: "0",
      rushing_2pt_conversions: "0",
      receptions: "0",
      targets: "0",
      receiving_yards: "0",
      receiving_tds: "0",
      receiving_first_downs: "0",
      receiving_2pt_conversions: "0",
      receiving_fumbles_lost: "0",
      sacks_suffered: "2",
      sack_fumbles_lost: "0",
      passing_first_downs: "18",
      passing_2pt_conversions: "0",
      sack_fumbles: "0",
      rushing_fumbles: "0",
      receiving_fumbles: "0",
      rushing_fumbles_lost: "0",
      punt_return_yards: "0",
      kickoff_return_yards: "0",
      special_teams_tds: "0"
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.canonicalKeyCount).toBe(25);
  });

  it("keeps known zero receiving fields for quarterbacks", () => {
    const result = normalizeNflverseRow(
      makeRaw({
        position_group: "QB",
        receptions: "0",
        targets: "0",
        receiving_yards: "0",
        receiving_tds: "0",
        receiving_first_downs: "0",
        receiving_2pt_conversions: "0"
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["rec"]).toBe(0);
    expect(result.row.stats["rec_tgt"]).toBe(0);
    expect(result.row.stats["rec_yd"]).toBe(0);
    expect(result.row.stats["rec_td"]).toBe(0);
    expect(result.row.stats["rec_fd"]).toBe(0);
    expect(result.row.stats["rec_2pt"]).toBe(0);
  });

  it("keeps known zero rushing fields for wide receivers", () => {
    const result = normalizeNflverseRow(
      makeRaw({
        position_group: "WR",
        carries: "0",
        rushing_yards: "0",
        rushing_tds: "0",
        rushing_first_downs: "0",
        rushing_2pt_conversions: "0"
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["rush_att"]).toBe(0);
    expect(result.row.stats["rush_yd"]).toBe(0);
    expect(result.row.stats["rush_td"]).toBe(0);
    expect(result.row.stats["rush_fd"]).toBe(0);
    expect(result.row.stats["rush_2pt"]).toBe(0);
  });

  it("keeps known zero receiving touchdowns for running backs", () => {
    const result = normalizeNflverseRow(makeRaw({ position_group: "RB", receiving_tds: "0" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["rec_td"]).toBe(0);
  });

  it("keeps known zero two-point conversion values", () => {
    const result = normalizeNflverseRow(
      makeRaw({
        passing_2pt_conversions: "0",
        rushing_2pt_conversions: "0",
        receiving_2pt_conversions: "0"
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["pass_2pt"]).toBe(0);
    expect(result.row.stats["rush_2pt"]).toBe(0);
    expect(result.row.stats["rec_2pt"]).toBe(0);
  });

  it("aggregates lost fumbles from nflverse context columns and keeps known zero", () => {
    const zeroResult = normalizeNflverseRow(
      makeRaw({
        sack_fumbles_lost: "0",
        rushing_fumbles_lost: "0",
        receiving_fumbles_lost: "0"
      })
    );
    expect(zeroResult.ok).toBe(true);
    if (!zeroResult.ok) return;
    expect(zeroResult.row.stats["fum_lost"]).toBe(0);

    const nonzeroResult = normalizeNflverseRow(
      makeRaw({
        sack_fumbles_lost: "1",
        rushing_fumbles_lost: "1",
        receiving_fumbles_lost: "0"
      })
    );
    expect(nonzeroResult.ok).toBe(true);
    if (!nonzeroResult.ok) return;
    expect(nonzeroResult.row.stats["fum_lost"]).toBe(2);
  });

  it("preserves provider fantasy points", () => {
    const result = normalizeNflverseRow(makeRaw({ fantasy_points: "28.65" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.providerFantasyPoints).toBeCloseTo(28.65);
  });

  it("sets providerFantasyPoints to null for NA", () => {
    const result = normalizeNflverseRow(makeRaw({ fantasy_points: "NA" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.providerFantasyPoints).toBeNull();
  });
});

describe("normalizeNflverseRow — pass_pick6 unavailability", () => {
  it("does not populate pass_pick6 when passing_interceptions is nonzero", () => {
    const result = normalizeNflverseRow(makeRaw({ passing_interceptions: "3" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["pass_pick6"]).toBeUndefined();
  });

  it("does not populate pass_pick6 when passing_interceptions is zero", () => {
    const result = normalizeNflverseRow(makeRaw({ passing_interceptions: "0" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["pass_pick6"]).toBeUndefined();
  });

  it("maps passing_interceptions to pass_int but never to pass_pick6", () => {
    const result = normalizeNflverseRow(makeRaw({ passing_interceptions: "2" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.stats["pass_int"]).toBe(2);
    expect("pass_pick6" in result.row.stats).toBe(false);
  });
});

describe("normalizeNflverseRow — week coverage", () => {
  it("normalizes rows from all regular season weeks (1–18)", () => {
    for (let week = 1; week <= 18; week++) {
      const result = normalizeNflverseRow(makeRaw({ week: String(week) }));
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(`Week ${week} failed: ${result.reason}`);
      expect(result.row.week).toBe(week);
    }
  });
});

describe("buildRowSha256Input", () => {
  it("builds deterministic input from identity fields", () => {
    const raw = makeRaw();
    const a = buildRowSha256Input(raw);
    const b = buildRowSha256Input({ ...raw });
    expect(a).toBe(b);
  });

  it("produces different output for different player/week", () => {
    const a = buildRowSha256Input(makeRaw({ player_id: "00-0039337", week: "1" }));
    const b = buildRowSha256Input(makeRaw({ player_id: "00-0039337", week: "2" }));
    expect(a).not.toBe(b);
  });

  it("produces different output for different players same week", () => {
    const a = buildRowSha256Input(makeRaw({ player_id: "00-0039337" }));
    const b = buildRowSha256Input(makeRaw({ player_id: "00-0033357" }));
    expect(a).not.toBe(b);
  });
});
