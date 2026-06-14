import { describe, expect, it } from "vitest";
import { evaluateH8Evidence } from "./h8-evidence";
import type { H8ContextFields } from "./types";

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

const UNKNOWN_SNAP: H8ContextFields[keyof H8ContextFields] = {
  value: null, status: "unknown", confidence: "unresolved", sourceEvidenceIds: [],
};

function allUnknown(): H8ContextFields {
  return {
    priorTargetShare: UNKNOWN_SNAP,
    priorCarryShare: UNKNOWN_SNAP,
    priorRedZoneShare: UNKNOWN_SNAP,
    priorGoalLineShare: UNKNOWN_SNAP,
    priorTeamPassRate: UNKNOWN_SNAP,
    priorTeamRushRate: UNKNOWN_SNAP,
    priorEarlyDownPassRate: UNKNOWN_SNAP,
  };
}

function withObserved(
  fields: Partial<H8ContextFields>,
  base = allUnknown()
): H8ContextFields {
  return { ...base, ...fields };
}

// --------------------------------------------------------------------------
// Structure — always returns all 7 field evaluations
// --------------------------------------------------------------------------

describe("structure", () => {
  it("returns one evaluation for each CONTEXT_FIELD (7 total)", () => {
    const result = evaluateH8Evidence(allUnknown(), "WR");
    expect(result.fieldEvaluations).toHaveLength(7);
  });

  it("fieldEvaluation includes fieldName, applicability, status, confidence, value", () => {
    const result = evaluateH8Evidence(allUnknown(), "WR");
    for (const fe of result.fieldEvaluations) {
      expect(fe).toHaveProperty("fieldName");
      expect(fe).toHaveProperty("applicability");
      expect(fe).toHaveProperty("status");
      expect(fe).toHaveProperty("confidence");
      expect(fe).toHaveProperty("value");
    }
  });
});

// --------------------------------------------------------------------------
// WR — applicability matrix from FIELD_APPLICABILITY
// --------------------------------------------------------------------------

describe("WR applicability", () => {
  it("priorTargetShare is applicable for WR", () => {
    const result = evaluateH8Evidence(allUnknown(), "WR");
    const fe = result.fieldEvaluations.find(f => f.fieldName === "priorTargetShare")!;
    expect(fe.applicability).toBe("applicable");
  });

  it("priorCarryShare is secondary_applicability for WR", () => {
    const result = evaluateH8Evidence(allUnknown(), "WR");
    const fe = result.fieldEvaluations.find(f => f.fieldName === "priorCarryShare")!;
    expect(fe.applicability).toBe("secondary_applicability");
  });

  it("priorGoalLineShare is not_applicable for WR", () => {
    const result = evaluateH8Evidence(allUnknown(), "WR");
    const fe = result.fieldEvaluations.find(f => f.fieldName === "priorGoalLineShare")!;
    expect(fe.applicability).toBe("not_applicable");
  });

  it("priorRedZoneShare is applicable for WR", () => {
    const result = evaluateH8Evidence(allUnknown(), "WR");
    const fe = result.fieldEvaluations.find(f => f.fieldName === "priorRedZoneShare")!;
    expect(fe.applicability).toBe("applicable");
  });

  it("all-unknown WR context: 0 applicableObserved, counts unknown applicable fields", () => {
    const result = evaluateH8Evidence(allUnknown(), "WR");
    // WR applicable fields: priorTargetShare, priorRedZoneShare, priorTeamPassRate, priorTeamRushRate, priorEarlyDownPassRate = 5
    expect(result.applicableObserved).toBe(0);
    expect(result.applicableUnknown).toBeGreaterThanOrEqual(4);
  });
});

// --------------------------------------------------------------------------
// RB — priorCarryShare is applicable
// --------------------------------------------------------------------------

describe("RB applicability", () => {
  it("priorCarryShare is applicable for RB", () => {
    const result = evaluateH8Evidence(allUnknown(), "RB");
    const fe = result.fieldEvaluations.find(f => f.fieldName === "priorCarryShare")!;
    expect(fe.applicability).toBe("applicable");
  });

  it("priorGoalLineShare is applicable for RB", () => {
    const result = evaluateH8Evidence(allUnknown(), "RB");
    const fe = result.fieldEvaluations.find(f => f.fieldName === "priorGoalLineShare")!;
    expect(fe.applicability).toBe("applicable");
  });

  it("priorRedZoneShare is secondary_applicability for RB", () => {
    const result = evaluateH8Evidence(allUnknown(), "RB");
    const fe = result.fieldEvaluations.find(f => f.fieldName === "priorRedZoneShare")!;
    expect(fe.applicability).toBe("secondary_applicability");
  });
});

// --------------------------------------------------------------------------
// QB — carry share applicable, target share secondary
// --------------------------------------------------------------------------

describe("QB applicability", () => {
  it("priorCarryShare is applicable for QB", () => {
    const result = evaluateH8Evidence(allUnknown(), "QB");
    const fe = result.fieldEvaluations.find(f => f.fieldName === "priorCarryShare")!;
    expect(fe.applicability).toBe("applicable");
  });

  it("priorTargetShare is secondary_applicability for QB", () => {
    const result = evaluateH8Evidence(allUnknown(), "QB");
    const fe = result.fieldEvaluations.find(f => f.fieldName === "priorTargetShare")!;
    expect(fe.applicability).toBe("secondary_applicability");
  });

  it("priorGoalLineShare is not_applicable for QB", () => {
    const result = evaluateH8Evidence(allUnknown(), "QB");
    const fe = result.fieldEvaluations.find(f => f.fieldName === "priorGoalLineShare")!;
    expect(fe.applicability).toBe("not_applicable");
  });
});

// --------------------------------------------------------------------------
// Observed fields → applicableObserved count
// --------------------------------------------------------------------------

describe("observed field counting", () => {
  it("increments applicableObserved when applicable field is observed", () => {
    const h8 = withObserved({
      priorTargetShare: { value: 0.18, status: "observed", confidence: "high", sourceEvidenceIds: ["ev-1"] },
    });
    const result = evaluateH8Evidence(h8, "WR");
    expect(result.applicableObserved).toBe(1);
  });

  it("inferred status also counts as observed", () => {
    const h8 = withObserved({
      priorTargetShare: { value: 0.15, status: "inferred", confidence: "moderate", sourceEvidenceIds: [] },
    });
    const result = evaluateH8Evidence(h8, "WR");
    expect(result.applicableObserved).toBe(1);
  });

  it("increments secondaryObserved when secondary field is observed", () => {
    const h8 = withObserved({
      priorCarryShare: { value: 0.02, status: "observed", confidence: "moderate", sourceEvidenceIds: [] },
    });
    const result = evaluateH8Evidence(h8, "WR");
    expect(result.secondaryObserved).toBe(1);
    expect(result.applicableObserved).toBe(0);
  });

  it("ROLE_STABILITY_HIGH emitted when applicable field observed with high confidence", () => {
    const h8 = withObserved({
      priorTargetShare: { value: 0.22, status: "observed", confidence: "high", sourceEvidenceIds: [] },
    });
    const result = evaluateH8Evidence(h8, "WR");
    expect(result.reasonCodes).toContain("ROLE_STABILITY_HIGH");
  });

  it("ROLE_STABILITY_HIGH NOT emitted for low-confidence observed field", () => {
    const h8 = withObserved({
      priorTargetShare: { value: 0.10, status: "observed", confidence: "low", sourceEvidenceIds: [] },
    });
    const result = evaluateH8Evidence(h8, "WR");
    expect(result.reasonCodes).not.toContain("ROLE_STABILITY_HIGH");
    expect(result.applicableObserved).toBe(1);
  });

  it("ROLE_STABILITY_HIGH NOT emitted for unresolved confidence", () => {
    const h8 = withObserved({
      priorTargetShare: { value: null, status: "observed", confidence: "unresolved", sourceEvidenceIds: [] },
    });
    const result = evaluateH8Evidence(h8, "WR");
    expect(result.reasonCodes).not.toContain("ROLE_STABILITY_HIGH");
  });
});

// --------------------------------------------------------------------------
// Quality signals
// --------------------------------------------------------------------------

describe("quality signals", () => {
  it("hasContradictory is true when any applicable field is contradicted", () => {
    const h8 = withObserved({
      priorTargetShare: { value: null, status: "contradicted", confidence: "unresolved", sourceEvidenceIds: [] },
    });
    const result = evaluateH8Evidence(h8, "WR");
    expect(result.hasContradictory).toBe(true);
    expect(result.reasonCodes).toContain("CONTRADICTORY_EVIDENCE");
  });

  it("hasStale is true when any field is stale", () => {
    const h8 = withObserved({
      priorCarryShare: { value: 0.12, status: "stale", confidence: "low", sourceEvidenceIds: [] },
    });
    const result = evaluateH8Evidence(h8, "WR");
    expect(result.hasStale).toBe(true);
    expect(result.reasonCodes).toContain("STALE_EVIDENCE");
  });

  it("hasContradictory is false when no fields are contradicted", () => {
    expect(evaluateH8Evidence(allUnknown(), "WR").hasContradictory).toBe(false);
  });

  it("hasStale is false when no fields are stale", () => {
    expect(evaluateH8Evidence(allUnknown(), "WR").hasStale).toBe(false);
  });
});

// --------------------------------------------------------------------------
// Evidence IDs
// --------------------------------------------------------------------------

describe("sourceEvidenceIds", () => {
  it("collects evidence IDs from applicable/secondary fields", () => {
    const h8 = withObserved({
      priorTargetShare: { value: 0.18, status: "observed", confidence: "high", sourceEvidenceIds: ["ev-1", "ev-2"] },
      priorCarryShare: { value: 0.04, status: "observed", confidence: "moderate", sourceEvidenceIds: ["ev-3"] },
    });
    const result = evaluateH8Evidence(h8, "WR");
    expect(result.sourceEvidenceIds).toContain("ev-1");
    expect(result.sourceEvidenceIds).toContain("ev-2");
    expect(result.sourceEvidenceIds).toContain("ev-3");
  });

  it("deduplicates evidence IDs", () => {
    const h8 = withObserved({
      priorTargetShare: { value: 0.18, status: "observed", confidence: "high", sourceEvidenceIds: ["ev-1"] },
      priorTeamPassRate: { value: 0.55, status: "observed", confidence: "moderate", sourceEvidenceIds: ["ev-1"] },
    });
    const result = evaluateH8Evidence(h8, "WR");
    const occurrences = result.sourceEvidenceIds.filter(id => id === "ev-1").length;
    expect(occurrences).toBe(1);
  });

  it("returns empty array when all fields are unknown with no evidence", () => {
    const result = evaluateH8Evidence(allUnknown(), "WR");
    expect(result.sourceEvidenceIds).toHaveLength(0);
  });
});

// --------------------------------------------------------------------------
// All positions — not_applicable count sanity check
// --------------------------------------------------------------------------

describe("not_applicable counts", () => {
  it("QB: priorGoalLineShare and priorRedZoneShare are not_applicable", () => {
    const result = evaluateH8Evidence(allUnknown(), "QB");
    expect(result.notApplicableCount).toBeGreaterThanOrEqual(2);
  });

  it("TE: priorGoalLineShare is not_applicable", () => {
    const result = evaluateH8Evidence(allUnknown(), "TE");
    const fe = result.fieldEvaluations.find(f => f.fieldName === "priorGoalLineShare")!;
    expect(fe.applicability).toBe("not_applicable");
  });
});
