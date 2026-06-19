export type DynastyAgeCurvePosition = "QB" | "RB" | "WR" | "TE" | "K" | "DST" | "DEF" | "DL" | "LB" | "DB";

export type DynastyAgePhase =
  | "rookie"
  | "ascending"
  | "prime"
  | "late_prime"
  | "decline_risk"
  | "cliff_risk"
  | "unknown";

export type DynastyDeclineRisk = "low" | "medium" | "high" | "severe" | "unknown";

export type DynastyAgeCurve = {
  age: number | null;
  position: DynastyAgeCurvePosition;
  agePhase: DynastyAgePhase;
  runwayScore: number;
  ageAdjustment: number;
  declineRisk: DynastyDeclineRisk;
  explanation: string;
};
