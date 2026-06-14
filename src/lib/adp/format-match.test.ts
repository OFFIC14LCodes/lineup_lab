import { describe, expect, it } from "vitest";

import { rankSnapshotsByFormatMatch, scoreFormatMatch } from "./format-match";
import type { AdpFormatProfile, LeagueFormatInput } from "./types";

const baseMflProfile: AdpFormatProfile = {
  draftType: "redraft",
  platform: "mfl",
  scoringFormat: "ppr",
  pprValue: 1.0,
  tePremiumValue: 0.0,
  rosterPositions: [],
  teamCount: 12,
  isBestBall: false,
  isDynasty: false,
  isStartup: false,
  isSuperflex: false,
  isTePremium: false,
};

const baseLeague: LeagueFormatInput = {
  leagueId: "league-1",
  pprValue: 1.0,
  tePremiumValue: 0.0,
  teamCount: 12,
  isDynasty: false,
  isBestBall: false,
  isSuperflex: false,
};

describe("scoreFormatMatch", () => {
  it("perfect match returns overallScore=1 and isCompatible=true with no warnings", () => {
    const result = scoreFormatMatch("snap-1", baseMflProfile, baseLeague);
    expect(result.overallScore).toBe(1);
    expect(result.isCompatible).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("PPR mismatch (1.0 vs 0) zeros pprValue dimension and adds warning", () => {
    const league: LeagueFormatInput = { ...baseLeague, pprValue: 0.0 };
    const result = scoreFormatMatch("snap-1", baseMflProfile, league);
    expect(result.dimensionScores.pprValue).toBe(0); // diff=1.0, penalty=1.0/0.5=2→clamped 0
    // Other dimensions still pass (dynasty/superflex/team-count match), so overall ~0.70
    expect(result.overallScore).toBeLessThan(0.80);
    expect(result.overallScore).toBeGreaterThan(0.60);
    expect(result.warnings.some((w) => w.includes("PPR mismatch"))).toBe(true);
  });

  it("half-PPR (0.5) gives partial pprScore of 0", () => {
    const league: LeagueFormatInput = { ...baseLeague, pprValue: 0.5 };
    const result = scoreFormatMatch("snap-1", baseMflProfile, league);
    // diff=0.5, 1 - 0.5/0.5 = 0
    expect(result.dimensionScores.pprValue).toBe(0);
  });

  it("dynasty mismatch zeros draftType score and adds warning", () => {
    const league: LeagueFormatInput = { ...baseLeague, isDynasty: true };
    const result = scoreFormatMatch("snap-1", baseMflProfile, league);
    expect(result.dimensionScores.draftType).toBe(0);
    // draftType weight is 0.25; other dimensions pass → score ≈ 0.75 (compatible)
    expect(result.overallScore).toBeCloseTo(0.75, 1);
    expect(result.warnings.some((w) => w.includes("Draft type mismatch"))).toBe(true);
  });

  it("superflex mismatch lowers score but may still be compatible", () => {
    const league: LeagueFormatInput = { ...baseLeague, isSuperflex: true };
    const result = scoreFormatMatch("snap-1", baseMflProfile, league);
    expect(result.dimensionScores.superflex).toBe(0.3);
    expect(result.warnings.some((w) => w.includes("Superflex mismatch"))).toBe(true);
  });

  it("team count ±2 does not penalise", () => {
    const league: LeagueFormatInput = { ...baseLeague, teamCount: 10 };
    const result = scoreFormatMatch("snap-1", baseMflProfile, league);
    expect(result.dimensionScores.teamCount).toBe(1);
  });

  it("team count difference of 6 gives zero teamCount score", () => {
    const league: LeagueFormatInput = { ...baseLeague, teamCount: 18 };
    const result = scoreFormatMatch("snap-1", baseMflProfile, league);
    expect(result.dimensionScores.teamCount).toBe(0);
    expect(result.warnings.some((w) => w.includes("Team count difference"))).toBe(true);
  });

  it("TE premium mismatch at 0.5 gives zero tePremium score", () => {
    const league: LeagueFormatInput = { ...baseLeague, tePremiumValue: 0.5 };
    const result = scoreFormatMatch("snap-1", baseMflProfile, league);
    expect(result.dimensionScores.tePremium).toBe(0);
  });

  it("best-ball mismatch gives partial score", () => {
    const league: LeagueFormatInput = { ...baseLeague, isBestBall: true };
    const result = scoreFormatMatch("snap-1", baseMflProfile, league);
    expect(result.dimensionScores.bestBall).toBe(0.85);
  });

  it("snapshotId and leagueId are passed through", () => {
    const result = scoreFormatMatch("snap-abc", baseMflProfile, { ...baseLeague, leagueId: "league-xyz" });
    expect(result.snapshotId).toBe("snap-abc");
    expect(result.leagueId).toBe("league-xyz");
  });
});

describe("rankSnapshotsByFormatMatch", () => {
  it("returns snapshots sorted best score first", () => {
    const snapshots = [
      { id: "snap-dynasty", formatProfile: { ...baseMflProfile, isDynasty: true } },
      { id: "snap-perfect", formatProfile: baseMflProfile },
      { id: "snap-half-ppr", formatProfile: { ...baseMflProfile, pprValue: 0.5 } },
    ];
    const ranked = rankSnapshotsByFormatMatch(snapshots, baseLeague);
    expect(ranked[0].snapshotId).toBe("snap-perfect");
    expect(ranked[0].overallScore).toBe(1);
  });

  it("returns empty array for empty snapshots", () => {
    expect(rankSnapshotsByFormatMatch([], baseLeague)).toHaveLength(0);
  });
});
