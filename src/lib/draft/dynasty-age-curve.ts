import type { DynastyAgeCurve, DynastyAgeCurvePosition, DynastyAgePhase, DynastyDeclineRisk } from "./dynasty-age-curve-types";

type AgeBand = {
  maxAge: number;
  agePhase: DynastyAgePhase;
  runwayScore: number;
  ageAdjustment: number;
  declineRisk: DynastyDeclineRisk;
};

const POSITION_BANDS: Record<DynastyAgeCurvePosition, AgeBand[]> = {
  QB: [
    { maxAge: 22, agePhase: "rookie", runwayScore: 86, ageAdjustment: 5, declineRisk: "low" },
    { maxAge: 26, agePhase: "ascending", runwayScore: 92, ageAdjustment: 8, declineRisk: "low" },
    { maxAge: 32, agePhase: "prime", runwayScore: 88, ageAdjustment: 6, declineRisk: "low" },
    { maxAge: 35, agePhase: "late_prime", runwayScore: 74, ageAdjustment: 0, declineRisk: "medium" },
    { maxAge: 37, agePhase: "decline_risk", runwayScore: 56, ageAdjustment: -8, declineRisk: "high" },
    { maxAge: 99, agePhase: "cliff_risk", runwayScore: 38, ageAdjustment: -16, declineRisk: "severe" },
  ],
  RB: [
    { maxAge: 22, agePhase: "rookie", runwayScore: 92, ageAdjustment: 10, declineRisk: "low" },
    { maxAge: 24, agePhase: "ascending", runwayScore: 96, ageAdjustment: 12, declineRisk: "low" },
    { maxAge: 26, agePhase: "prime", runwayScore: 86, ageAdjustment: 6, declineRisk: "low" },
    { maxAge: 27, agePhase: "late_prime", runwayScore: 72, ageAdjustment: 0, declineRisk: "medium" },
    { maxAge: 29, agePhase: "decline_risk", runwayScore: 48, ageAdjustment: -12, declineRisk: "high" },
    { maxAge: 99, agePhase: "cliff_risk", runwayScore: 22, ageAdjustment: -26, declineRisk: "severe" },
  ],
  WR: [
    { maxAge: 22, agePhase: "rookie", runwayScore: 90, ageAdjustment: 9, declineRisk: "low" },
    { maxAge: 24, agePhase: "ascending", runwayScore: 94, ageAdjustment: 11, declineRisk: "low" },
    { maxAge: 28, agePhase: "prime", runwayScore: 88, ageAdjustment: 7, declineRisk: "low" },
    { maxAge: 30, agePhase: "late_prime", runwayScore: 70, ageAdjustment: -1, declineRisk: "medium" },
    { maxAge: 32, agePhase: "decline_risk", runwayScore: 52, ageAdjustment: -10, declineRisk: "high" },
    { maxAge: 99, agePhase: "cliff_risk", runwayScore: 32, ageAdjustment: -20, declineRisk: "severe" },
  ],
  TE: [
    { maxAge: 22, agePhase: "rookie", runwayScore: 88, ageAdjustment: 8, declineRisk: "low" },
    { maxAge: 24, agePhase: "ascending", runwayScore: 94, ageAdjustment: 11, declineRisk: "low" },
    { maxAge: 28, agePhase: "prime", runwayScore: 88, ageAdjustment: 7, declineRisk: "low" },
    { maxAge: 31, agePhase: "late_prime", runwayScore: 68, ageAdjustment: -2, declineRisk: "medium" },
    { maxAge: 33, agePhase: "decline_risk", runwayScore: 48, ageAdjustment: -12, declineRisk: "high" },
    { maxAge: 99, agePhase: "cliff_risk", runwayScore: 30, ageAdjustment: -22, declineRisk: "severe" },
  ],
  K: [{ maxAge: 99, agePhase: "unknown", runwayScore: 50, ageAdjustment: 0, declineRisk: "unknown" }],
  DST: [{ maxAge: 99, agePhase: "unknown", runwayScore: 50, ageAdjustment: 0, declineRisk: "unknown" }],
  DEF: [{ maxAge: 99, agePhase: "unknown", runwayScore: 50, ageAdjustment: 0, declineRisk: "unknown" }],
  DL: [{ maxAge: 99, agePhase: "unknown", runwayScore: 50, ageAdjustment: 0, declineRisk: "unknown" }],
  LB: [{ maxAge: 99, agePhase: "unknown", runwayScore: 50, ageAdjustment: 0, declineRisk: "unknown" }],
  DB: [{ maxAge: 99, agePhase: "unknown", runwayScore: 50, ageAdjustment: 0, declineRisk: "unknown" }],
};

export function buildDynastyAgeCurve(input: { age?: number | null; position?: string | null }): DynastyAgeCurve {
  const position = normalizePosition(input.position);
  const age = finiteNumber(input.age);
  if (age === null) {
    return {
      age: null,
      position,
      agePhase: "unknown",
      runwayScore: 50,
      ageAdjustment: 0,
      declineRisk: "unknown",
      explanation: `${position} age is unavailable, so dynasty runway is neutral until verified.`,
    };
  }

  const band = POSITION_BANDS[position].find((candidate) => age <= candidate.maxAge) ?? POSITION_BANDS[position][POSITION_BANDS[position].length - 1];
  return {
    age,
    position,
    agePhase: band.agePhase,
    runwayScore: band.runwayScore,
    ageAdjustment: band.ageAdjustment,
    declineRisk: band.declineRisk,
    explanation: explanationFor(position, age, band),
  };
}

function explanationFor(position: DynastyAgeCurvePosition, age: number, band: AgeBand): string {
  if (position === "RB" && band.agePhase === "cliff_risk") {
    return `Age ${age} RB is in a dynasty cliff-risk window, so short runway materially compresses asset value.`;
  }
  if (position === "QB" && (band.agePhase === "late_prime" || band.agePhase === "decline_risk")) {
    return `Age ${age} QB keeps a longer dynasty runway than RB/WR/TE, with only a gradual age penalty.`;
  }
  if (position === "TE" && (band.agePhase === "rookie" || band.agePhase === "ascending")) {
    return `Age ${age} TE has runway value because elite tight ends usually carry multi-year scarcity.`;
  }
  return `Age ${age} ${position} is classified as ${band.agePhase.replace(/_/g, " ")} with ${band.declineRisk} decline risk.`;
}

function normalizePosition(value: string | null | undefined): DynastyAgeCurvePosition {
  const position = (value ?? "").trim().toUpperCase();
  if (position === "D/ST") return "DST";
  if (position in POSITION_BANDS) return position as DynastyAgeCurvePosition;
  return "DEF";
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
