// H8: Position-aware field applicability tests

import { describe, expect, it } from "vitest";

import {
  CONTEXT_FIELDS,
  FIELD_APPLICABILITY,
  computeApplicabilityBreakdown,
  summarizeApplicability,
} from "./applicability";
import type { ApplicabilityBreakdown } from "./applicability";
import type { BlackbirdDerivedContext } from "./types";

// --------------------------------------------------------------------------
// Fixture helpers
// --------------------------------------------------------------------------

function makeContext(
  fieldStatuses: Partial<Record<string, "observed" | "inferred" | "unknown">> = {}
): BlackbirdDerivedContext {
  function f(status: "observed" | "inferred" | "unknown" = "unknown") {
    return {
      value: null,
      valueType: "number",
      status,
      confidence: "unresolved" as const,
      evidenceIds: [],
      observedAt: null,
      effectiveFrom: null,
      expiresAt: null,
      lastReviewedAt: null,
      inferenceMethod: null,
      contradictionCount: 0,
    };
  }
  return {
    priorSnapProxy: f(),
    priorTargetShare: f(fieldStatuses["priorTargetShare"]),
    priorCarryShare: f(fieldStatuses["priorCarryShare"]),
    priorRedZoneShare: f(fieldStatuses["priorRedZoneShare"]),
    priorGoalLineShare: f(fieldStatuses["priorGoalLineShare"]),
    priorTeamPassRate: f(fieldStatuses["priorTeamPassRate"]),
    priorTeamRushRate: f(fieldStatuses["priorTeamRushRate"]),
    priorEarlyDownPassRate: f(fieldStatuses["priorEarlyDownPassRate"]),
    priorTargetConcentration: {
      value: "unknown" as const,
      valueType: "string",
      status: "unknown" as const,
      confidence: "unresolved" as const,
      evidenceIds: [],
      observedAt: null,
      effectiveFrom: null,
      expiresAt: null,
      lastReviewedAt: null,
      inferenceMethod: null,
      contradictionCount: 0,
    },
    priorPositionalUsage: f(),
    derivedSeason: 2025,
    derivedFromDataVersion: "h8-derive-v1",
    backlogs: [],
  } as unknown as BlackbirdDerivedContext;
}

// --------------------------------------------------------------------------
// 1. QB applicability table
// --------------------------------------------------------------------------

describe("FIELD_APPLICABILITY — QB", () => {
  it("QB target share is secondary_applicability (trick plays only)", () => {
    expect(FIELD_APPLICABILITY["priorTargetShare"]["QB"]).toBe("secondary_applicability");
  });

  it("QB carry share is applicable (scrambles and designed runs)", () => {
    expect(FIELD_APPLICABILITY["priorCarryShare"]["QB"]).toBe("applicable");
  });

  it("QB red zone share is not_applicable (QB throws, does not catch)", () => {
    expect(FIELD_APPLICABILITY["priorRedZoneShare"]["QB"]).toBe("not_applicable");
  });

  it("QB goal line share is not_applicable (QB sneaks are in carry share)", () => {
    expect(FIELD_APPLICABILITY["priorGoalLineShare"]["QB"]).toBe("not_applicable");
  });

  it("QB team pass rate is applicable", () => {
    expect(FIELD_APPLICABILITY["priorTeamPassRate"]["QB"]).toBe("applicable");
  });

  it("QB team rush rate is applicable", () => {
    expect(FIELD_APPLICABILITY["priorTeamRushRate"]["QB"]).toBe("applicable");
  });

  it("QB early down pass rate is applicable", () => {
    expect(FIELD_APPLICABILITY["priorEarlyDownPassRate"]["QB"]).toBe("applicable");
  });
});

// --------------------------------------------------------------------------
// 2. RB applicability table
// --------------------------------------------------------------------------

describe("FIELD_APPLICABILITY — RB", () => {
  it("RB target share is applicable", () => {
    expect(FIELD_APPLICABILITY["priorTargetShare"]["RB"]).toBe("applicable");
  });

  it("RB carry share is applicable", () => {
    expect(FIELD_APPLICABILITY["priorCarryShare"]["RB"]).toBe("applicable");
  });

  it("RB red zone share is secondary_applicability (carries are more primary)", () => {
    expect(FIELD_APPLICABILITY["priorRedZoneShare"]["RB"]).toBe("secondary_applicability");
  });

  it("RB goal line share is applicable", () => {
    expect(FIELD_APPLICABILITY["priorGoalLineShare"]["RB"]).toBe("applicable");
  });
});

// --------------------------------------------------------------------------
// 3. WR applicability table
// --------------------------------------------------------------------------

describe("FIELD_APPLICABILITY — WR", () => {
  it("WR target share is applicable", () => {
    expect(FIELD_APPLICABILITY["priorTargetShare"]["WR"]).toBe("applicable");
  });

  it("WR carry share is secondary_applicability (sweeps/reverses are rare)", () => {
    expect(FIELD_APPLICABILITY["priorCarryShare"]["WR"]).toBe("secondary_applicability");
  });

  it("WR red zone share is applicable", () => {
    expect(FIELD_APPLICABILITY["priorRedZoneShare"]["WR"]).toBe("applicable");
  });

  it("WR goal line share is not_applicable", () => {
    expect(FIELD_APPLICABILITY["priorGoalLineShare"]["WR"]).toBe("not_applicable");
  });
});

// --------------------------------------------------------------------------
// 4. TE applicability table
// --------------------------------------------------------------------------

describe("FIELD_APPLICABILITY — TE", () => {
  it("TE target share is applicable", () => {
    expect(FIELD_APPLICABILITY["priorTargetShare"]["TE"]).toBe("applicable");
  });

  it("TE carry share is not_applicable (TEs almost never carry)", () => {
    expect(FIELD_APPLICABILITY["priorCarryShare"]["TE"]).toBe("not_applicable");
  });

  it("TE red zone share is applicable", () => {
    expect(FIELD_APPLICABILITY["priorRedZoneShare"]["TE"]).toBe("applicable");
  });

  it("TE goal line share is not_applicable", () => {
    expect(FIELD_APPLICABILITY["priorGoalLineShare"]["TE"]).toBe("not_applicable");
  });
});

// --------------------------------------------------------------------------
// 5. computeApplicabilityBreakdown — QB correctness
// --------------------------------------------------------------------------

describe("computeApplicabilityBreakdown — QB", () => {
  it("QB with all-unknown context: 2 not_applicable, 4 applicable-unknown, 1 secondary-unknown", () => {
    const ctx = makeContext();
    const result = computeApplicabilityBreakdown(ctx, "QB");
    expect(result.notApplicable).toBe(2);         // priorRedZoneShare, priorGoalLineShare
    expect(result.applicableUnknown).toBe(4);     // priorCarryShare, passRate, rushRate, earlyDownPassRate
    expect(result.secondaryUnknown).toBe(1);      // priorTargetShare
    expect(result.applicableObserved).toBe(0);
    expect(result.applicableInferred).toBe(0);
    expect(result.secondaryObserved).toBe(0);
  });

  it("QB with carry share observed reduces applicable-unknown", () => {
    const ctx = makeContext({ priorCarryShare: "observed" });
    const result = computeApplicabilityBreakdown(ctx, "QB");
    expect(result.applicableObserved).toBe(1);
    expect(result.applicableUnknown).toBe(3);
  });
});

// --------------------------------------------------------------------------
// 6. computeApplicabilityBreakdown — WR correctness
// --------------------------------------------------------------------------

describe("computeApplicabilityBreakdown — WR", () => {
  it("WR with all-unknown context: 1 not_applicable, 5 applicable-unknown, 1 secondary-unknown", () => {
    const ctx = makeContext();
    const result = computeApplicabilityBreakdown(ctx, "WR");
    expect(result.notApplicable).toBe(1);         // priorGoalLineShare
    expect(result.applicableUnknown).toBe(5);     // target, redZone, passRate, rushRate, earlyDown
    expect(result.secondaryUnknown).toBe(1);      // priorCarryShare
  });

  it("WR with target and red zone observed: 2 applicable-observed, 3 applicable-unknown", () => {
    const ctx = makeContext({ priorTargetShare: "observed", priorRedZoneShare: "observed" });
    const result = computeApplicabilityBreakdown(ctx, "WR");
    expect(result.applicableObserved).toBe(2);
    expect(result.applicableUnknown).toBe(3);
  });
});

// --------------------------------------------------------------------------
// 7. not_applicable fields excluded from unknown count
// --------------------------------------------------------------------------

describe("not_applicable fields — exclusion from unknown counts", () => {
  it("QB has fewer applicable-unknowns than WR for all-unknown context", () => {
    const ctx = makeContext();
    const qb = computeApplicabilityBreakdown(ctx, "QB");
    const wr = computeApplicabilityBreakdown(ctx, "WR");
    // QB: 2 not_applicable → 4 applicable-unknown
    // WR: 1 not_applicable → 5 applicable-unknown
    expect(qb.applicableUnknown).toBeLessThan(wr.applicableUnknown);
  });

  it("TE has more not_applicable fields than QB", () => {
    const ctx = makeContext();
    const te = computeApplicabilityBreakdown(ctx, "TE");
    const qb = computeApplicabilityBreakdown(ctx, "QB");
    // TE: carry share + goal line = 2
    // QB: red zone + goal line = 2
    expect(te.notApplicable).toBe(qb.notApplicable); // both have 2
  });

  it("total fields always equals CONTEXT_FIELDS.length for every position", () => {
    const ctx = makeContext();
    for (const pos of ["QB", "RB", "WR", "TE"] as const) {
      const r = computeApplicabilityBreakdown(ctx, pos);
      const total =
        r.applicableObserved +
        r.applicableInferred +
        r.applicableUnknown +
        r.secondaryObserved +
        r.secondaryUnknown +
        r.notApplicable;
      expect(total).toBe(CONTEXT_FIELDS.length);
    }
  });
});

// --------------------------------------------------------------------------
// 8. QB receiving (trick-play) treated as secondary, not primary
// --------------------------------------------------------------------------

describe("QB receiving field — secondary applicability", () => {
  it("QB target share observed counts as secondary, not applicable", () => {
    const ctx = makeContext({ priorTargetShare: "observed" });
    const result = computeApplicabilityBreakdown(ctx, "QB");
    // secondaryObserved goes up, not applicableObserved
    expect(result.secondaryObserved).toBe(1);
    expect(result.applicableObserved).toBe(0);
  });
});

// --------------------------------------------------------------------------
// 9. summarizeApplicability — population rollup
// --------------------------------------------------------------------------

describe("summarizeApplicability", () => {
  it("rolls up breakdowns across players", () => {
    const breakdowns: ApplicabilityBreakdown[] = [
      { applicableObserved: 2, applicableInferred: 0, applicableUnknown: 2, secondaryObserved: 0, secondaryUnknown: 1, notApplicable: 2 },
      { applicableObserved: 1, applicableInferred: 1, applicableUnknown: 2, secondaryObserved: 1, secondaryUnknown: 0, notApplicable: 2 },
    ];
    const summary = summarizeApplicability(breakdowns);
    expect(summary.totalApplicableObserved).toBe(3);
    expect(summary.totalApplicableUnknown).toBe(4);
    expect(summary.totalNotApplicable).toBe(4);
    expect(summary.playerCount).toBe(2);
    expect(summary.totalFields).toBe(2 * CONTEXT_FIELDS.length);
    expect(summary.applicableFields).toBe(2 * CONTEXT_FIELDS.length - 4);
  });

  it("returns zeros for empty input", () => {
    const summary = summarizeApplicability([]);
    expect(summary.playerCount).toBe(0);
    expect(summary.totalFields).toBe(0);
    expect(summary.totalApplicableUnknown).toBe(0);
  });
});
