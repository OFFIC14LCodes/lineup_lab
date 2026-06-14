// H8: Position-aware field applicability for derived context.
// Classifies each context field as applicable, secondary, or not applicable
// per position so that unknown-count reporting is position-correct.
//
// Rules:
//   applicable            — this field is a primary metric for the position
//   secondary_applicability — the field exists but is peripheral for the position
//   not_applicable         — the field has no meaningful interpretation for the position
//
// Not-applicable fields are excluded from unknown-field counts.

import type { BlackbirdDerivedContext, ContextFieldStatus } from "./types";
import { SKILL_POSITIONS, isSkillPosition } from "./season-type";
import type { SkillPosition } from "./season-type";

export type FieldApplicability =
  | "applicable"
  | "secondary_applicability"
  | "not_applicable";

// The subset of BlackbirdDerivedContext fields tracked for completeness reporting.
// priorSnapProxy and priorTargetConcentration are excluded: snap_proxy is a
// documented backlog and concentration is a team attribute, not a player share.
export const CONTEXT_FIELDS = [
  "priorTargetShare",
  "priorCarryShare",
  "priorRedZoneShare",
  "priorGoalLineShare",
  "priorTeamPassRate",
  "priorTeamRushRate",
  "priorEarlyDownPassRate",
] as const satisfies readonly (keyof BlackbirdDerivedContext)[];

export type ContextFieldName = (typeof CONTEXT_FIELDS)[number];

export const FIELD_APPLICABILITY: Record<ContextFieldName, Record<SkillPosition, FieldApplicability>> = {
  // Receiving target share: primary for RB/WR/TE; secondary for QB (trick plays only)
  priorTargetShare: {
    QB: "secondary_applicability",
    RB: "applicable",
    WR: "applicable",
    TE: "applicable",
  },
  // Carry share: primary for QB (scrambles/designed runs) and RB;
  // secondary for WR (sweeps/reverses); TEs almost never carry
  priorCarryShare: {
    QB: "applicable",
    RB: "applicable",
    WR: "secondary_applicability",
    TE: "not_applicable",
  },
  // Red zone receiving: primary for WR/TE; secondary for RB (gets RZ targets but
  // carries are more important); not applicable for QB (who throws, not catches)
  priorRedZoneShare: {
    QB: "not_applicable",
    RB: "secondary_applicability",
    WR: "applicable",
    TE: "applicable",
  },
  // Goal line carry: primary for RB; QB goal line sneaks are in carry share;
  // WR/TE goal line carries are near-zero by definition
  priorGoalLineShare: {
    QB: "not_applicable",
    RB: "applicable",
    WR: "not_applicable",
    TE: "not_applicable",
  },
  // Team pass rate: applicable to all positions (determines pass/run volume)
  priorTeamPassRate: {
    QB: "applicable",
    RB: "applicable",
    WR: "applicable",
    TE: "applicable",
  },
  // Team rush rate: mirror of pass rate, applicable to all positions
  priorTeamRushRate: {
    QB: "applicable",
    RB: "applicable",
    WR: "applicable",
    TE: "applicable",
  },
  // Early down pass rate: applicable to all positions
  priorEarlyDownPassRate: {
    QB: "applicable",
    RB: "applicable",
    WR: "applicable",
    TE: "applicable",
  },
};

// --------------------------------------------------------------------------
// Per-player breakdown
// --------------------------------------------------------------------------

export type ApplicabilityBreakdown = {
  applicableObserved: number;
  applicableInferred: number;
  applicableUnknown: number;
  secondaryObserved: number;
  secondaryUnknown: number;
  notApplicable: number;
};

export function computeApplicabilityBreakdown(
  context: BlackbirdDerivedContext,
  position: string
): ApplicabilityBreakdown {
  const pos: SkillPosition = isSkillPosition(position.toUpperCase())
    ? (position.toUpperCase() as SkillPosition)
    : "WR";

  let applicableObserved = 0;
  let applicableInferred = 0;
  let applicableUnknown = 0;
  let secondaryObserved = 0;
  let secondaryUnknown = 0;
  let notApplicable = 0;

  for (const fieldName of CONTEXT_FIELDS) {
    const field = context[fieldName] as { status: ContextFieldStatus } | undefined;
    if (!field) continue;
    const { status } = field;
    const applicability = FIELD_APPLICABILITY[fieldName][pos];

    if (applicability === "not_applicable") {
      notApplicable++;
    } else if (applicability === "applicable") {
      if (status === "observed") applicableObserved++;
      else if (status === "inferred") applicableInferred++;
      else applicableUnknown++;
    } else {
      if (status === "observed" || status === "inferred") secondaryObserved++;
      else secondaryUnknown++;
    }
  }

  return {
    applicableObserved,
    applicableInferred,
    applicableUnknown,
    secondaryObserved,
    secondaryUnknown,
    notApplicable,
  };
}

// --------------------------------------------------------------------------
// Population-level summary
// --------------------------------------------------------------------------

export type PopulationApplicabilitySummary = {
  totalApplicableObserved: number;
  totalApplicableInferred: number;
  totalApplicableUnknown: number;
  totalSecondaryObserved: number;
  totalSecondaryUnknown: number;
  totalNotApplicable: number;
  playerCount: number;
  totalFields: number;
  applicableFields: number;
};

export function summarizeApplicability(
  breakdowns: ApplicabilityBreakdown[]
): PopulationApplicabilitySummary {
  const acc = {
    totalApplicableObserved: 0,
    totalApplicableInferred: 0,
    totalApplicableUnknown: 0,
    totalSecondaryObserved: 0,
    totalSecondaryUnknown: 0,
    totalNotApplicable: 0,
  };
  for (const b of breakdowns) {
    acc.totalApplicableObserved += b.applicableObserved;
    acc.totalApplicableInferred += b.applicableInferred;
    acc.totalApplicableUnknown += b.applicableUnknown;
    acc.totalSecondaryObserved += b.secondaryObserved;
    acc.totalSecondaryUnknown += b.secondaryUnknown;
    acc.totalNotApplicable += b.notApplicable;
  }
  const totalFields = breakdowns.length * CONTEXT_FIELDS.length;
  const applicableFields = totalFields - acc.totalNotApplicable;
  return {
    ...acc,
    playerCount: breakdowns.length,
    totalFields,
    applicableFields,
  };
}

// Export for callers that need the list of positions (avoids re-importing)
export { SKILL_POSITIONS };
