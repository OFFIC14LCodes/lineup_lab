import type { ProjectionActiveUniverseGateStatus } from "./projection-active-universe-gate-types";
import type { ProjectionPromotionEligibilityClassification } from "./projection-promotion-candidate-pool-types";

export type ProjectionCurrentRosterConfirmationStatus =
  | "roster_confirmed_active"
  | "roster_confirmed_non_active"
  | "roster_confirmed_free_agent"
  | "roster_confirmed_ir_pup_nfi"
  | "roster_unmatched"
  | "roster_source_missing"
  | "roster_conflict";

export type ProjectionCurrentRosterConfirmationReasonCode =
  | "matched_by_player_id"
  | "matched_by_sleeper_id"
  | "matched_by_gsis_id"
  | "matched_by_name_team_position"
  | "team_matches_projection"
  | "team_conflicts_projection"
  | "status_active"
  | "status_non_active"
  | "status_free_agent"
  | "status_ir_pup_nfi"
  | "source_missing"
  | "source_stale";

export type ProjectionCurrentRosterConfirmationOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionCurrentRosterConfirmationRow = {
  playerId: string;
  sleeperId: string | null;
  gsisId: string | null;
  player: string;
  normalizedName: string;
  position: string;
  projectionTeam: string | null;
  rosterTeam: string | null;
  rosterStatus: string | null;
  activeGateStatus: ProjectionActiveUniverseGateStatus;
  promotionEligibilityClassification: ProjectionPromotionEligibilityClassification | "missing_from_candidate_pool";
  confirmationStatus: ProjectionCurrentRosterConfirmationStatus;
  reasonCodes: ProjectionCurrentRosterConfirmationReasonCode[];
  matchedRosterSource: string | null;
  sourceUpdatedAt: string | null;
};

export type ProjectionCurrentRosterConfirmationReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    preseasonProjectionSnapshot: string;
    activeUniverseGate: string;
    currentRosterSource: string | null;
  };
  sourceStatus: "present" | "missing";
  summary: {
    totalProjectionRows: number;
    rosterSourceRows: number;
    matchedRows: number;
    unmatchedRows: number;
    confirmedActive: number;
    confirmedNonActive: number;
    confirmedFreeAgent: number;
    confirmedIrPupNfi: number;
    conflicts: number;
    byPosition: Record<string, Record<ProjectionCurrentRosterConfirmationStatus, number>>;
    byH16ActiveGateStatus: Record<string, Record<ProjectionCurrentRosterConfirmationStatus, number>>;
    byPromotionClassification: Record<string, Record<ProjectionCurrentRosterConfirmationStatus, number>>;
  };
  h16IntegrationPreview: {
    activeConfirmedIncrease: number;
    activeConfirmedDecrease: number;
    staleStatusReviewResolved: number;
    legacyArchiveBlockedConfirmed: number;
    manualReviewRequiredResolved: number;
    kickerPolicyUnaffected: number;
    note: string;
  };
  topExamples: {
    conflicts: ProjectionCurrentRosterConfirmationRow[];
    unmatched: ProjectionCurrentRosterConfirmationRow[];
    confirmedActive: ProjectionCurrentRosterConfirmationRow[];
    confirmedNonActive: ProjectionCurrentRosterConfirmationRow[];
  };
  rows: ProjectionCurrentRosterConfirmationRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  notes: string[];
};

export type ProjectionCurrentRosterConfirmationInput = {
  options: ProjectionCurrentRosterConfirmationOptions;
  preseasonProjectionSnapshot: import("./preseason-projection-snapshot-types").PreseasonProjectionSnapshot;
  activeUniverseGate: import("./projection-active-universe-gate-types").ProjectionActiveUniverseGateReport;
  currentRosterSource: import("@/lib/data-acquisition/current-roster-source-types").CurrentRosterSourceReport | null;
  sourceArtifacts?: ProjectionCurrentRosterConfirmationReport["sourceArtifacts"];
};

export type ProjectionCurrentRosterConfirmationArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
