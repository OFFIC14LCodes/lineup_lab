// H9.1 — H8 applicability-aware evidence evaluation.
//
// Iterates CONTEXT_FIELDS using the authoritative FIELD_APPLICABILITY matrix
// from src/lib/context/applicability.ts. Does NOT recreate the matrix.
//
// For each context field, the function determines applicability for the player's
// position and evaluates the observed status/confidence of that field.
//
// Data reality (2026-06-14): only priorTargetShare and priorCarryShare are
// ever non-unknown in current H8 data. All other CONTEXT_FIELDS are documented
// backlogs (always unknown). The evaluator handles this correctly — unknown
// applicable fields produce an uncertainty penalty, not an error.

import {
  CONTEXT_FIELDS,
  FIELD_APPLICABILITY,
  type ContextFieldName,
  type FieldApplicability,
} from "../context/applicability";

import type { H8ContextFields, H8FieldStatus, H8FieldConfidence, ProjectionPosition } from "./types";
import type { ReasonCode } from "./reason-codes";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type H8FieldEvaluation = {
  fieldName: ContextFieldName;
  applicability: FieldApplicability;
  status: H8FieldStatus;
  confidence: H8FieldConfidence;
  value: number | null;
  sourceEvidenceIds: string[];
  reasonCodes: ReasonCode[];
};

export type H8EvidenceEvaluation = {
  fieldEvaluations: H8FieldEvaluation[];
  // Counts by applicability × observed/unknown
  applicableObserved: number;    // "applicable" fields with status observed/inferred
  applicableUnknown: number;     // "applicable" fields with status unknown/not_applicable (from data gap)
  secondaryObserved: number;     // "secondary_applicability" fields with status observed/inferred
  secondaryUnknown: number;      // "secondary_applicability" fields with status unknown
  notApplicableCount: number;    // "not_applicable" fields (excluded from penalties)
  // Quality signals
  hasContradictory: boolean;
  hasStale: boolean;
  // Aggregate reason codes and evidence IDs
  reasonCodes: ReasonCode[];
  sourceEvidenceIds: string[];
};

// --------------------------------------------------------------------------
// Internal helpers
// --------------------------------------------------------------------------

function isObserved(status: H8FieldStatus): boolean {
  return status === "observed" || status === "inferred";
}

function isUnknown(status: H8FieldStatus): boolean {
  // "not_applicable" at the field level means the field wasn't populated for this
  // player. We treat it same as unknown when computing confidence penalties.
  return status === "unknown" || status === "not_applicable";
}

// --------------------------------------------------------------------------
// Main function
// --------------------------------------------------------------------------

export function evaluateH8Evidence(
  h8Fields: H8ContextFields,
  position: ProjectionPosition
): H8EvidenceEvaluation {
  const fieldEvaluations: H8FieldEvaluation[] = [];
  const allReasonCodes = new Set<ReasonCode>();
  const allEvidenceIds = new Set<string>();

  let applicableObserved = 0;
  let applicableUnknown = 0;
  let secondaryObserved = 0;
  let secondaryUnknown = 0;
  let notApplicableCount = 0;
  let hasContradictory = false;
  let hasStale = false;

  for (const fieldName of CONTEXT_FIELDS) {
    const applicability = FIELD_APPLICABILITY[fieldName][position];
    const snap = h8Fields[fieldName];
    const fieldReasonCodes: ReasonCode[] = [];

    // Track quality signals
    if (snap.status === "contradicted") hasContradictory = true;
    if (snap.status === "stale") hasStale = true;

    switch (applicability) {
      case "applicable":
        if (isObserved(snap.status)) {
          applicableObserved++;
          if (snap.confidence === "low" || snap.confidence === "unresolved") {
            // Don't emit ROLE_STABILITY_HIGH for low-confidence fields
          } else {
            fieldReasonCodes.push("ROLE_STABILITY_HIGH");
            allReasonCodes.add("ROLE_STABILITY_HIGH");
          }
        } else if (isUnknown(snap.status)) {
          applicableUnknown++;
        }
        break;

      case "secondary_applicability":
        if (isObserved(snap.status)) {
          secondaryObserved++;
        } else if (isUnknown(snap.status)) {
          secondaryUnknown++;
        }
        break;

      case "not_applicable":
        notApplicableCount++;
        break;
    }

    // Track evidence IDs from all applicable/secondary fields
    if (applicability !== "not_applicable") {
      for (const id of snap.sourceEvidenceIds) {
        allEvidenceIds.add(id);
      }
    }

    fieldEvaluations.push({
      fieldName,
      applicability,
      status: snap.status,
      confidence: snap.confidence,
      value: snap.value,
      sourceEvidenceIds: snap.sourceEvidenceIds,
      reasonCodes: fieldReasonCodes,
    });
  }

  // Add cross-field quality reason codes
  if (hasContradictory) allReasonCodes.add("CONTRADICTORY_EVIDENCE");
  if (hasStale) allReasonCodes.add("STALE_EVIDENCE");

  return {
    fieldEvaluations,
    applicableObserved,
    applicableUnknown,
    secondaryObserved,
    secondaryUnknown,
    notApplicableCount,
    hasContradictory,
    hasStale,
    reasonCodes: [...allReasonCodes],
    sourceEvidenceIds: [...allEvidenceIds],
  };
}
