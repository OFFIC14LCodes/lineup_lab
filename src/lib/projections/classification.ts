// H9.1 — role/sample classification into one of 6 classes.
//
// Classification is position-specific using season opportunity totals and
// active/role week counts. The class drives games projections, confidence,
// and model uncertainty downstream.

import type { ProjectionPosition, RoleSampleClass, ProjectionConfidenceLabel } from "./types";
import type { RoleWeekResult } from "./role-weeks";
import {
  QB_FULL_SEASON_WEEKS, QB_FULL_SEASON_ATTEMPTS,
  QB_PARTIAL_SEASON_WEEKS, QB_PARTIAL_SEASON_ATTEMPTS,
  QB_PART_TIME_ATTEMPTS, QB_MIN_SIGNIFICANT_ATTEMPTS,
  RB_FULL_SEASON_WEEKS, RB_FULL_SEASON_CARRIES, RB_FULL_SEASON_TARGETS,
  RB_PARTIAL_SEASON_WEEKS, RB_PARTIAL_SEASON_CARRIES, RB_PARTIAL_SEASON_TARGETS,
  RB_PART_TIME_CARRIES, RB_PART_TIME_TARGETS,
  RB_MIN_SIGNIFICANT_CARRIES, RB_MIN_SIGNIFICANT_TARGETS,
  WR_FULL_SEASON_WEEKS, WR_FULL_SEASON_TARGETS,
  WR_PARTIAL_SEASON_WEEKS, WR_PARTIAL_SEASON_TARGETS,
  WR_PART_TIME_TARGETS, WR_MIN_SIGNIFICANT_TARGETS,
  TE_FULL_SEASON_WEEKS, TE_FULL_SEASON_TARGETS,
  TE_PARTIAL_SEASON_WEEKS, TE_PARTIAL_SEASON_TARGETS,
  TE_PART_TIME_TARGETS, TE_MIN_SIGNIFICANT_TARGETS,
} from "./constants";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type ClassificationInputs = {
  historicalActiveWeeks: number;
  historicalRoleWeeks: number;
  totalPassAttempts: number;
  totalCarries: number;
  totalTargets: number;
  roleParticipationFactor: number;
};

export type RoleSampleClassification = {
  roleSampleClass: RoleSampleClass;
  roleSampleConfidence: ProjectionConfidenceLabel;
  classificationInputs: ClassificationInputs;
};

// --------------------------------------------------------------------------
// Confidence mapping
// --------------------------------------------------------------------------

const CLASS_CONFIDENCE: Record<RoleSampleClass, ProjectionConfidenceLabel> = {
  ESTABLISHED_FULL_SEASON: "high",
  ESTABLISHED_PARTIAL_SEASON: "medium",
  PART_TIME_CONTRIBUTOR: "medium",
  BACKUP_OR_SPOT_STARTER: "low",
  MINIMAL_SAMPLE: "very_low",
  ROLE_UNKNOWN: "very_low",
};

// --------------------------------------------------------------------------
// Position-specific classifiers
// --------------------------------------------------------------------------

function classifyQB(
  activeWeeks: number,
  roleWeeks: number,
  attempts: number
): RoleSampleClass {
  if (activeWeeks >= QB_FULL_SEASON_WEEKS && attempts >= QB_FULL_SEASON_ATTEMPTS) {
    return "ESTABLISHED_FULL_SEASON";
  }
  if (activeWeeks >= QB_PARTIAL_SEASON_WEEKS && attempts >= QB_PARTIAL_SEASON_ATTEMPTS) {
    return "ESTABLISHED_PARTIAL_SEASON";
  }
  if (attempts >= QB_PART_TIME_ATTEMPTS) {
    return "PART_TIME_CONTRIBUTOR";
  }
  if (attempts >= QB_MIN_SIGNIFICANT_ATTEMPTS && roleWeeks > 0) {
    return "BACKUP_OR_SPOT_STARTER";
  }
  if (roleWeeks > 0) {
    return "MINIMAL_SAMPLE";
  }
  return "ROLE_UNKNOWN";
}

function classifyRB(
  activeWeeks: number,
  roleWeeks: number,
  carries: number,
  targets: number
): RoleSampleClass {
  if (activeWeeks >= RB_FULL_SEASON_WEEKS &&
      (carries >= RB_FULL_SEASON_CARRIES || targets >= RB_FULL_SEASON_TARGETS)) {
    return "ESTABLISHED_FULL_SEASON";
  }
  if (activeWeeks >= RB_PARTIAL_SEASON_WEEKS &&
      (carries >= RB_PARTIAL_SEASON_CARRIES || targets >= RB_PARTIAL_SEASON_TARGETS)) {
    return "ESTABLISHED_PARTIAL_SEASON";
  }
  if (carries >= RB_PART_TIME_CARRIES || targets >= RB_PART_TIME_TARGETS) {
    return "PART_TIME_CONTRIBUTOR";
  }
  if ((carries >= RB_MIN_SIGNIFICANT_CARRIES || targets >= RB_MIN_SIGNIFICANT_TARGETS) &&
      roleWeeks > 0) {
    return "BACKUP_OR_SPOT_STARTER";
  }
  if (roleWeeks > 0) {
    return "MINIMAL_SAMPLE";
  }
  return "ROLE_UNKNOWN";
}

function classifyWR(
  activeWeeks: number,
  roleWeeks: number,
  targets: number
): RoleSampleClass {
  if (activeWeeks >= WR_FULL_SEASON_WEEKS && targets >= WR_FULL_SEASON_TARGETS) {
    return "ESTABLISHED_FULL_SEASON";
  }
  if (activeWeeks >= WR_PARTIAL_SEASON_WEEKS && targets >= WR_PARTIAL_SEASON_TARGETS) {
    return "ESTABLISHED_PARTIAL_SEASON";
  }
  if (targets >= WR_PART_TIME_TARGETS) {
    return "PART_TIME_CONTRIBUTOR";
  }
  if (targets >= WR_MIN_SIGNIFICANT_TARGETS && roleWeeks > 0) {
    return "BACKUP_OR_SPOT_STARTER";
  }
  if (roleWeeks > 0) {
    return "MINIMAL_SAMPLE";
  }
  return "ROLE_UNKNOWN";
}

function classifyTE(
  activeWeeks: number,
  roleWeeks: number,
  targets: number
): RoleSampleClass {
  if (activeWeeks >= TE_FULL_SEASON_WEEKS && targets >= TE_FULL_SEASON_TARGETS) {
    return "ESTABLISHED_FULL_SEASON";
  }
  if (activeWeeks >= TE_PARTIAL_SEASON_WEEKS && targets >= TE_PARTIAL_SEASON_TARGETS) {
    return "ESTABLISHED_PARTIAL_SEASON";
  }
  if (targets >= TE_PART_TIME_TARGETS) {
    return "PART_TIME_CONTRIBUTOR";
  }
  if (targets >= TE_MIN_SIGNIFICANT_TARGETS && roleWeeks > 0) {
    return "BACKUP_OR_SPOT_STARTER";
  }
  if (roleWeeks > 0) {
    return "MINIMAL_SAMPLE";
  }
  return "ROLE_UNKNOWN";
}

// --------------------------------------------------------------------------
// Main function
// --------------------------------------------------------------------------

export function classifyRoleSample(
  position: ProjectionPosition,
  rw: RoleWeekResult
): RoleSampleClassification {
  const { historicalActiveWeeks: aw, historicalRoleWeeks: rw2, totals } = rw;
  const historicalRoleWeeks = rw2;

  let roleSampleClass: RoleSampleClass;
  switch (position) {
    case "QB":
      roleSampleClass = classifyQB(aw, historicalRoleWeeks, totals.totalPassAttempts);
      break;
    case "RB":
      roleSampleClass = classifyRB(aw, historicalRoleWeeks, totals.totalCarries, totals.totalTargets);
      break;
    case "WR":
      roleSampleClass = classifyWR(aw, historicalRoleWeeks, totals.totalTargets);
      break;
    case "TE":
      roleSampleClass = classifyTE(aw, historicalRoleWeeks, totals.totalTargets);
      break;
  }

  return {
    roleSampleClass,
    roleSampleConfidence: CLASS_CONFIDENCE[roleSampleClass],
    classificationInputs: {
      historicalActiveWeeks: aw,
      historicalRoleWeeks,
      totalPassAttempts: totals.totalPassAttempts,
      totalCarries: totals.totalCarries,
      totalTargets: totals.totalTargets,
      roleParticipationFactor: rw.roleParticipationFactor,
    },
  };
}
