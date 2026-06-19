import type { ProjectionCurrentRosterConfirmationReport } from "./projection-current-roster-confirmation-types";

export type ProjectionCurrentRosterConfirmationDeltaOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionCurrentRosterConfirmationDeltaReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  realSourceStatus: "real_source_present" | "real_source_missing";
  sourceArtifacts: {
    beforeConfirmation: string;
    afterConfirmation: string | null;
    realSourceCsv: string;
  };
  before: ProjectionCurrentRosterConfirmationDeltaSummary;
  after: ProjectionCurrentRosterConfirmationDeltaSummary;
  delta: ProjectionCurrentRosterConfirmationDeltaSummary;
  activeUniverseGateStatusChanges: Record<string, number>;
  nextCommand: string | null;
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  notes: string[];
};

export type ProjectionCurrentRosterConfirmationDeltaSummary = {
  matchedRows: number;
  unmatchedRows: number;
  confirmedActive: number;
  confirmedNonActive: number;
  confirmedFreeAgent: number;
  confirmedIrPupNfi: number;
  conflicts: number;
  legacyArchiveConfirmed: number;
  staleReviewResolved: number;
  manualReviewResolved: number;
  kRowsWithRosterDepthStatus: number;
  activeConfirmedIncrease: number;
  activeConfirmedDecrease: number;
};

export type ProjectionCurrentRosterConfirmationDeltaInput = {
  options: ProjectionCurrentRosterConfirmationDeltaOptions;
  before: ProjectionCurrentRosterConfirmationReport;
  after: ProjectionCurrentRosterConfirmationReport | null;
  realSourceCsvExists: boolean;
  sourceArtifacts?: ProjectionCurrentRosterConfirmationDeltaReport["sourceArtifacts"];
};

export type ProjectionCurrentRosterConfirmationDeltaArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
