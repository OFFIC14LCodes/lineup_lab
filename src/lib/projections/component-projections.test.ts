import { describe, expect, it, vi } from "vitest";
import {
  buildReferenceRates,
  buildRoleWeekProfile,
  projectPlayer,
  projectComponentPopulation,
} from "./component-projections";
import type { HistoricalPlayerProjectionInput, ProjectionPosition, WeeklyStatRow } from "./types";

const UNKNOWN_SNAP = {
  value: null,
  status: "unknown" as const,
  confidence: "unresolved" as const,
  sourceEvidenceIds: [] as string[],
};

const NEUTRAL_H8: HistoricalPlayerProjectionInput["h8Fields"] = {
  priorTargetShare: UNKNOWN_SNAP,
  priorCarryShare: UNKNOWN_SNAP,
  priorRedZoneShare: UNKNOWN_SNAP,
  priorGoalLineShare: UNKNOWN_SNAP,
  priorTeamPassRate: UNKNOWN_SNAP,
  priorTeamRushRate: UNKNOWN_SNAP,
  priorEarlyDownPassRate: UNKNOWN_SNAP,
};

const OBSERVED_TARGET_H8: HistoricalPlayerProjectionInput["h8Fields"] = {
  ...NEUTRAL_H8,
  priorTargetShare: {
    value: 0.25,
    status: "observed",
    confidence: "verified",
    sourceEvidenceIds: ["h8-target"],
  },
};

function row(week: number, overrides: Partial<WeeklyStatRow> = {}): WeeklyStatRow {
  return {
    week,
    passAttempts: 0,
    completions: 0,
    passingYards: 0,
    passingTds: 0,
    interceptions: 0,
    carries: 0,
    rushingYards: 0,
    rushingTds: 0,
    targets: 0,
    receptions: 0,
    receivingYards: 0,
    receivingTds: 0,
    fumRetTd: 0,
    twoPointConversions: 0,
    fumblesLost: 0,
    ...overrides,
  };
}

function input(
  id: string,
  position: ProjectionPosition,
  weeklyStats: WeeklyStatRow[],
  overrides: Partial<HistoricalPlayerProjectionInput> = {}
): HistoricalPlayerProjectionInput {
  return {
    canonicalPlayerId: id,
    position,
    historicalSeason: 2025,
    projectionSeason: 2026,
    weeklyStats,
    h8SnapshotId: null,
    h8Fields: NEUTRAL_H8,
    compatibleAdpRecords: [],
    ...overrides,
  };
}

function repeat(n: number, f: (week: number) => Partial<WeeklyStatRow>): WeeklyStatRow[] {
  return Array.from({ length: n }, (_, i) => row(i + 1, f(i + 1)));
}

function basePopulation(): HistoricalPlayerProjectionInput[] {
  const qbs = Array.from({ length: 6 }, (_, i) =>
    input(`qb-${i}`, "QB", repeat(10, () => ({
      passAttempts: 30,
      completions: 18 + i,
      passingYards: 210 + i * 10,
      passingTds: i % 2,
      interceptions: i === 0 ? 1 : 0,
      carries: 3,
      rushingYards: 12,
    })))
  );
  const rbs = Array.from({ length: 6 }, (_, i) =>
    input(`rb-${i}`, "RB", repeat(10, () => ({
      carries: 12,
      rushingYards: 48 + i,
      rushingTds: i % 3 === 0 ? 1 : 0,
      targets: 3,
      receptions: 2,
      receivingYards: 14,
      receivingTds: i === 0 ? 1 : 0,
    })))
  );
  const wrs = Array.from({ length: 6 }, (_, i) =>
    input(`wr-${i}`, "WR", repeat(10, () => ({
      targets: 8,
      receptions: 4 + (i % 3),
      receivingYards: 56 + i,
      receivingTds: i < 2 ? 1 : 0,
    })))
  );
  const tes = Array.from({ length: 6 }, (_, i) =>
    input(`te-${i}`, "TE", repeat(10, () => ({
      targets: 5,
      receptions: 3,
      receivingYards: 32 + i,
      receivingTds: i === 0 ? 1 : 0,
    })))
  );
  return [...qbs, ...rbs, ...wrs, ...tes];
}

describe("H9.2 reference populations", () => {
  it("uses pooled rates for additive receiving references", () => {
    const result = projectComponentPopulation(basePopulation());
    const wrCatch = result.referenceRates.find(r => r.position === "WR" && r.referenceName === "catchRate");
    expect(wrCatch?.method).toBe("pooled_rate");
    expect(wrCatch?.eligiblePlayerCount).toBe(6);
    expect(wrCatch?.rate).toBeCloseTo(300 / 480, 6);
  });

  it("activates fallback diagnostics for small pools instead of substituting silent zeroes", () => {
    const result = projectComponentPopulation(basePopulation().filter(p => p.position !== "QB").concat([
      input("qb-small", "QB", repeat(8, () => ({ passAttempts: 12, completions: 7, passingYards: 80 }))),
    ]));
    const qbTd = result.referenceRates.find(r => r.position === "QB" && r.referenceName === "passingTdRate");
    expect(qbTd?.smallPool).toBe(true);
    expect(qbTd?.fallbackTierUsed).toBe("all_valid");
    expect(qbTd?.rate).toBe(0);
    expect(qbTd?.totalEvents).toBe(0);
    expect(qbTd?.zeroRateObserved).toBe(true);
    expect(qbTd?.totalOpportunity).toBeGreaterThan(0);
  });

  it("throws a deterministic error instead of silently substituting missing references", () => {
    const profiles = basePopulation().map(buildRoleWeekProfile);
    const refs = buildReferenceRates(profiles).filter(r => !(r.position === "WR" && r.referenceName === "catchRate"));
    const wr = profiles.find(p => p.input.canonicalPlayerId === "wr-0")!;

    expect(() => projectPlayer(wr, profiles, refs)).toThrow(/Missing H9\.2 reference rate: referenceName=catchRate position=WR playerId=wr-0 component=catchRate/);
  });

  it("is deterministic independent of row order", () => {
    const pop = basePopulation();
    const a = projectComponentPopulation(pop);
    const b = projectComponentPopulation([...pop].reverse());
    expect(a.referenceRates).toEqual(b.referenceRates);
    expect(a.projections.map(p => p.playerProjectionInputHash)).toEqual(b.projections.map(p => p.playerProjectionInputHash));
  });
});

describe("H9.2 shrinkage and opportunity", () => {
  it("regresses a zero-TD high-opportunity receiver upward while preserving fractional TDs", () => {
    const player = input("wr-zero-td", "WR", repeat(10, () => ({
      targets: 10,
      receptions: 7,
      receivingYards: 80,
      receivingTds: 0,
    })));
    const result = projectComponentPopulation([...basePopulation(), player]);
    const projection = result.projections.find(p => p.canonicalPlayerId === "wr-zero-td")!;
    const tdRegression = projection.regressionDiagnostics.find(d => d.metric === "receivingTdRate")!;
    expect(tdRegression.regressedRate).toBeGreaterThan(0);
    expect(projection.medianComponents.receivingTds).toBeGreaterThan(0);
    expect(Number.isInteger(projection.medianComponents.receivingTds)).toBe(false);
  });

  it("keeps a zero-opportunity TD component at zero", () => {
    const player = input("wr-no-role", "WR", repeat(4, () => ({ targets: 0 })));
    const projection = projectComponentPopulation([...basePopulation(), player]).projections.find(p => p.canonicalPlayerId === "wr-no-role")!;
    expect(projection.medianComponents.receivingTds).toBe(0);
    expect(projection.componentReasons).toContain("ROLE_WEEK_RATE_UNAVAILABLE");
  });

  it("caps unrealistic tiny-sample opportunity but retains meaningful upside", () => {
    const player = input("rb-tiny-extreme", "RB", repeat(2, () => ({
      carries: 40,
      rushingYards: 160,
      rushingTds: 2,
    })));
    const projection = projectComponentPopulation([...basePopulation(), player]).projections.find(p => p.canonicalPlayerId === "rb-tiny-extreme")!;
    const carries = projection.opportunityDiagnostics.find(d => d.metric === "carries")!;
    expect(carries.capApplied).toBe(true);
    expect(carries.capValue).toBeGreaterThan(0);
    expect(carries.percentileUsed).toBe(0.95);
    expect(carries.regressedTowardReference).toBe(true);
    expect(projection.ceilingComponents.carries).toBeGreaterThan(projection.medianComponents.carries);
  });

  it("flags small opportunity reference pools and uses the fallback pool minimum", () => {
    const small = [
      input("rb-a", "RB", repeat(10, () => ({ carries: 10, rushingYards: 40 }))),
      input("rb-b", "RB", repeat(2, () => ({ carries: 30, rushingYards: 120 }))),
    ];
    const projection = projectComponentPopulation(small).projections.find(p => p.canonicalPlayerId === "rb-b")!;
    const carries = projection.opportunityDiagnostics.find(d => d.metric === "carries")!;
    expect(carries.smallPool).toBe(true);
    expect(carries.fallbackTierUsed).toBe("all_valid");
    expect(carries.eligiblePlayerCount).toBe(2);
    expect(carries.method).toBe("median_role_week_rate");
  });

  it("does not cap normal elite opportunity incorrectly", () => {
    const player = input("wr-elite-normal", "WR", repeat(12, () => ({
      targets: 11,
      receptions: 7,
      receivingYards: 85,
      receivingTds: 1,
    })));
    const projection = projectComponentPopulation([...basePopulation(), player]).projections.find(p => p.canonicalPlayerId === "wr-elite-normal")!;
    const targets = projection.opportunityDiagnostics.find(d => d.metric === "targets")!;
    expect(targets.capApplied).toBe(false);
    expect(targets.capValue).toBeGreaterThan(0);
  });

  it("does not project incidental WR rushing below materiality threshold", () => {
    const player = input("wr-one-carry", "WR", repeat(10, week => ({
      targets: 7,
      receptions: 5,
      receivingYards: 65,
      carries: week === 1 ? 1 : 0,
      rushingYards: week === 1 ? 12 : 0,
    })));
    const projection = projectComponentPopulation([...basePopulation(), player]).projections.find(p => p.canonicalPlayerId === "wr-one-carry")!;
    expect(projection.medianComponents.carries).toBe(0);
    expect(projection.componentReasons).toContain("INCIDENTAL_RUSHING_NOT_PROJECTED");
  });
});

describe("H9.2 efficiency, scenarios, and exclusions", () => {
  it("enforces completions and receptions not exceeding opportunity", () => {
    const player = input("qb-overcomplete", "QB", repeat(10, () => ({
      passAttempts: 20,
      completions: 24,
      passingYards: 180,
      passingTds: 1,
    })));
    const projection = projectComponentPopulation([...basePopulation(), player]).projections.find(p => p.canonicalPlayerId === "qb-overcomplete")!;
    expect(projection.medianComponents.completions).toBeLessThanOrEqual(projection.medianComponents.passAttempts);
    expect(projection.validation.ok).toBe(true);
  });

  it("keeps beneficial scenario components ordered and harmful interceptions reversed", () => {
    const player = input("qb-with-picks", "QB", repeat(10, () => ({
      passAttempts: 30,
      completions: 19,
      passingYards: 220,
      passingTds: 1,
      interceptions: 1,
    })));
    const projection = projectComponentPopulation([...basePopulation(), player]).projections.find(p => p.canonicalPlayerId === "qb-with-picks")!;
    expect(projection.downsideComponents.passingYards).toBeLessThanOrEqual(projection.floorComponents.passingYards);
    expect(projection.floorComponents.passingYards).toBeLessThanOrEqual(projection.medianComponents.passingYards);
    expect(projection.ceilingComponents.passingYards).toBeLessThanOrEqual(projection.upsideComponents.passingYards);
    expect(projection.downsideComponents.interceptions).toBeGreaterThanOrEqual(projection.floorComponents.interceptions);
    expect(projection.floorComponents.interceptions).toBeGreaterThanOrEqual(projection.medianComponents.interceptions);
    expect(projection.validation.ok).toBe(true);
  });

  it("uses wider TD scenario ranges than opportunity ranges", () => {
    const projection = projectComponentPopulation(basePopulation()).projections.find(p => p.canonicalPlayerId === "wr-0")!;
    const opportunityWidth = projection.scenarioMultipliers.opportunity.upside / projection.scenarioMultipliers.opportunity.ceiling - 1;
    const tdWidth = projection.scenarioMultipliers.td.upside - projection.scenarioMultipliers.td.ceiling;
    expect(tdWidth).toBeGreaterThan(opportunityWidth);
  });

  it("volatility changes range but not median", () => {
    const normal = input("wr-normal", "WR", repeat(10, () => ({
      targets: 8,
      receptions: 5,
      receivingYards: 64,
      receivingTds: 0,
    })));
    const volatile = input("wr-volatile", "WR", repeat(10, week => ({
      targets: 8,
      receptions: 5,
      receivingYards: 64,
      receivingTds: 0,
      fumRetTd: week === 1 ? 1 : 0,
    })));
    const result = projectComponentPopulation([...basePopulation(), normal, volatile]);
    const a = result.projections.find(p => p.canonicalPlayerId === "wr-normal")!;
    const b = result.projections.find(p => p.canonicalPlayerId === "wr-volatile")!;
    expect(a.medianComponents.receivingYards).toBe(b.medianComponents.receivingYards);
    expect(b.upsideComponents.receivingYards - b.downsideComponents.receivingYards).toBeGreaterThan(
      a.upsideComponents.receivingYards - a.downsideComponents.receivingYards
    );
    expect(b.componentReasons).toContain("NON_REPEATABLE_MISC_TD");
  });

  it("long-TD evidence widens ranges without adding median touchdowns", () => {
    const normal = input("wr-no-long", "WR", repeat(10, () => ({
      targets: 8,
      receptions: 5,
      receivingYards: 64,
      receivingTds: 1,
    })));
    const longTd = input("wr-long", "WR", repeat(10, week => ({
      targets: 8,
      receptions: 5,
      receivingYards: 64,
      receivingTds: 1,
      longTds: week === 1 ? 1 : 0,
    })));
    const result = projectComponentPopulation([...basePopulation(), normal, longTd]);
    const a = result.projections.find(p => p.canonicalPlayerId === "wr-no-long")!;
    const b = result.projections.find(p => p.canonicalPlayerId === "wr-long")!;
    expect(b.medianComponents.receivingTds).toBe(a.medianComponents.receivingTds);
    expect(b.upsideComponents.receivingTds - b.downsideComponents.receivingTds).toBeGreaterThan(
      a.upsideComponents.receivingTds - a.downsideComponents.receivingTds
    );
    expect(b.componentReasons).toContain("LONG_TD_VOLATILITY");
  });

  it("models fumbles lost and excludes two-point conversions with explicit reasons", () => {
    const player = input("rb-fumble-two-point", "RB", repeat(10, week => ({
      carries: 10,
      rushingYards: 42,
      targets: 2,
      receptions: 1,
      fumblesLost: week === 1 ? 1 : 0,
      twoPointConversions: week === 2 ? 1 : 0,
    })));
    const projection = projectComponentPopulation([...basePopulation(), player]).projections.find(p => p.canonicalPlayerId === "rb-fumble-two-point")!;
    expect(projection.medianComponents.fumblesLost).toBeGreaterThan(0);
    expect(Number.isInteger(projection.medianComponents.fumblesLost)).toBe(false);
    expect(projection.medianComponents.twoPointConversions).toBe(0);
    expect(projection.regressionDiagnostics.find(d => d.metric === "fumblesLostPerTouch")).toBeTruthy();
    expect(projection.componentReasons).toContain("FUMBLE_RATE_REGRESSION_DOWN");
    expect(projection.componentReasons).toContain("TWO_POINT_NOT_PROJECTED");
  });

  it("does not use ADP or league scoring inputs in component hashes", () => {
    const player = input("wr-hash", "WR", repeat(10, () => ({
      targets: 8,
      receptions: 5,
      receivingYards: 60,
    })));
    const withAdp = input("wr-hash", "WR", player.weeklyStats, {
      compatibleAdpRecords: [{
        adpRecordId: "adp",
        snapshotId: "snap",
        provider: "x",
        scoringFormat: "ppr",
        pprValue: 1,
        tePremiumValue: 0,
        isDynasty: false,
        isBestBall: false,
        isSuperflex: false,
        overallAdp: 10,
        overallRank: 10,
        positionalAdp: 3,
        positionalRank: 3,
        effectiveDate: "2026-06-01",
      }],
    });
    const a = projectComponentPopulation([...basePopulation(), player]).projections.find(p => p.canonicalPlayerId === "wr-hash")!;
    const b = projectComponentPopulation([...basePopulation(), withAdp]).projections.find(p => p.canonicalPlayerId === "wr-hash")!;
    expect(a.playerProjectionInputHash).toBe(b.playerProjectionInputHash);
  });
});

describe("H9.2 validation and role edge cases", () => {
  it("rejects negative opportunity counts", () => {
    const bad = input("bad-negative-carries", "RB", [row(1, { carries: -1 })]);
    expect(() => projectComponentPopulation([bad])).toThrow(/field=carries/);
  });

  it("rejects negative event counts", () => {
    const bad = input("bad-negative-completions", "QB", [row(1, { passAttempts: 12, completions: -1 })]);
    expect(() => projectComponentPopulation([bad])).toThrow(/field=completions/);
  });

  it("rejects invalid numeric values", () => {
    const bad = input("bad-nan", "WR", [row(1, { targets: Number.NaN })]);
    expect(() => projectComponentPopulation([bad])).toThrow(/field=targets/);
  });

  it("keeps a 17-week low-volume RB low", () => {
    const player = input("rb-low-17", "RB", repeat(17, () => ({
      carries: 4,
      rushingYards: 14,
      targets: 1,
      receptions: 1,
      receivingYards: 5,
    })));
    const projection = projectComponentPopulation([...basePopulation(), player]).projections.find(p => p.canonicalPlayerId === "rb-low-17")!;
    expect(projection.medianComponents.carries).toBeLessThan(120);
    expect(projection.medianComponents.targets).toBeLessThan(30);
  });

  it("lets a four-week high-opportunity WR retain meaningful volume and upside", () => {
    const player = input("wr-four-week-breakout", "WR", repeat(4, () => ({
      targets: 14,
      receptions: 9,
      receivingYards: 110,
      receivingTds: 1,
    })));
    const projection = projectComponentPopulation([...basePopulation(), player]).projections.find(p => p.canonicalPlayerId === "wr-four-week-breakout")!;
    expect(projection.medianComponents.targets).toBeGreaterThan(35);
    expect(projection.upsideComponents.targets).toBeGreaterThan(projection.medianComponents.targets);
  });

  it("zero-role-week player has zero components and explicit fallback reasons", () => {
    const player = input("wr-zero-role-explicit", "WR", repeat(4, () => ({ targets: 1, receptions: 1, receivingYards: 6 })));
    const projection = projectComponentPopulation([...basePopulation(), player]).projections.find(p => p.canonicalPlayerId === "wr-zero-role-explicit")!;
    expect(Object.values(projection.medianComponents).every(v => v === 0)).toBe(true);
    expect(projection.componentReasons).toContain("ROLE_WEEK_RATE_UNAVAILABLE");
  });
});

describe("H9.2 H8 interactions and fumbles", () => {
  it("changing H8 status changes range but not historical role-week rates", () => {
    const stats = repeat(10, () => ({ targets: 8, receptions: 5, receivingYards: 70, receivingTds: 0 }));
    const unknown = input("wr-h8-unknown", "WR", stats);
    const observed = input("wr-h8-observed", "WR", stats, { h8Fields: OBSERVED_TARGET_H8 });
    const result = projectComponentPopulation([...basePopulation(), unknown, observed]);
    const a = result.projections.find(p => p.canonicalPlayerId === "wr-h8-unknown")!;
    const b = result.projections.find(p => p.canonicalPlayerId === "wr-h8-observed")!;
    expect(a.roleWeekRates).toEqual(b.roleWeekRates);
    expect(a.roleFoundation.totalRangeWidth).not.toBe(b.roleFoundation.totalRangeWidth);
    expect(a.medianComponents.receivingYards).toBe(b.medianComponents.receivingYards);
  });

  it("uses carries plus receptions for player and reference fumbles lost per touch", () => {
    const result = projectComponentPopulation(basePopulation());
    const rbRef = result.referenceRates.find(r => r.position === "RB" && r.referenceName === "fumblesLostPerTouch")!;
    expect(rbRef.totalOpportunity).toBe(840);
    expect(rbRef.rate).toBeCloseTo(rbRef.totalEvents / rbRef.totalOpportunity, 6);
  });

  it("orders fumbles as harmful scenario components", () => {
    const player = input("rb-fumble-order", "RB", repeat(10, () => ({
      carries: 12,
      rushingYards: 48,
      targets: 2,
      receptions: 2,
      receivingYards: 12,
      fumblesLost: 1,
    })));
    const projection = projectComponentPopulation([...basePopulation(), player]).projections.find(p => p.canonicalPlayerId === "rb-fumble-order")!;
    expect(projection.downsideComponents.fumblesLost).toBeGreaterThanOrEqual(projection.floorComponents.fumblesLost);
    expect(projection.floorComponents.fumblesLost).toBeGreaterThanOrEqual(projection.medianComponents.fumblesLost);
    expect(projection.medianComponents.fumblesLost).toBeGreaterThanOrEqual(projection.ceilingComponents.fumblesLost);
    expect(projection.ceilingComponents.fumblesLost).toBeGreaterThanOrEqual(projection.upsideComponents.fumblesLost);
  });
});

describe("H9.2 model config and hashes", () => {
  it("component output and hash change when role games change", () => {
    const short = input("wr-role-short", "WR", repeat(8, () => ({ targets: 8, receptions: 5, receivingYards: 60 })));
    const long = input("wr-role-long", "WR", repeat(14, () => ({ targets: 8, receptions: 5, receivingYards: 60 })));
    const result = projectComponentPopulation([...basePopulation(), short, long]);
    const a = result.projections.find(p => p.canonicalPlayerId === "wr-role-short")!;
    const b = result.projections.find(p => p.canonicalPlayerId === "wr-role-long")!;
    expect(a.roleFoundation.projectedAvailability.projectedRoleGames.median).not.toBe(b.roleFoundation.projectedAvailability.projectedRoleGames.median);
    expect(a.medianComponents.targets).not.toBe(b.medianComponents.targets);
    expect(a.playerProjectionInputHash).not.toBe(b.playerProjectionInputHash);
  });

  it("changing a K constant changes fumble projection and semantic hash", async () => {
    const player = input("rb-k", "RB", repeat(10, () => ({
      carries: 10,
      rushingYards: 40,
      targets: 2,
      receptions: 2,
      receivingYards: 10,
      fumblesLost: 1,
    })));
    const base = projectComponentPopulation([...basePopulation(), player]).projections.find(p => p.canonicalPlayerId === "rb-k")!;

    vi.resetModules();
    vi.doMock("./constants", async importOriginal => {
      const original = await importOriginal<typeof import("./constants")>();
      return {
        ...original,
        FUMBLES_LOST_RATE_K: original.FUMBLES_LOST_RATE_K + 100,
        MODEL_CONFIG: {
          ...original.MODEL_CONFIG,
          fumblesLostRateK: original.FUMBLES_LOST_RATE_K + 100,
        },
      };
    });
    const mocked = await import("./component-projections");
    const changed = mocked.projectComponentPopulation([...basePopulation(), player]).projections.find(p => p.canonicalPlayerId === "rb-k")!;
    expect(changed.medianComponents.fumblesLost).not.toBe(base.medianComponents.fumblesLost);
    expect(changed.playerProjectionInputHash).not.toBe(base.playerProjectionInputHash);
    vi.doUnmock("./constants");
  });

  it("changing scenario multiplier constants changes scenario output and semantic hash", async () => {
    const player = input("wr-scenario-k", "WR", repeat(10, () => ({ targets: 8, receptions: 5, receivingYards: 60, receivingTds: 1 })));
    const base = projectComponentPopulation([...basePopulation(), player]).projections.find(p => p.canonicalPlayerId === "wr-scenario-k")!;

    vi.resetModules();
    vi.doMock("./constants", async importOriginal => {
      const original = await importOriginal<typeof import("./constants")>();
      return {
        ...original,
        SCENARIO_TD_RANGE_SHARE: original.SCENARIO_TD_RANGE_SHARE + 0.1,
        MODEL_CONFIG: {
          ...original.MODEL_CONFIG,
          scenarioTdRangeShare: original.SCENARIO_TD_RANGE_SHARE + 0.1,
        },
      };
    });
    const mocked = await import("./component-projections");
    const changed = mocked.projectComponentPopulation([...basePopulation(), player]).projections.find(p => p.canonicalPlayerId === "wr-scenario-k")!;
    expect(changed.upsideComponents.receivingTds).not.toBe(base.upsideComponents.receivingTds);
    expect(changed.playerProjectionInputHash).not.toBe(base.playerProjectionInputHash);
    vi.doUnmock("./constants");
  });
});
