import type { ProjectionSelectorPipelinePreviewReport, ProjectionSelectorPipelinePreviewSummary } from "./projection-selector-pipeline-preview-types";

export type ProjectionV82SnapshotDiffGuardRecommendation =
  | "snapshot_diff_guard_clean"
  | "snapshot_diff_guard_mismatch"
  | "snapshot_diff_guard_blocked";

export type ProjectionV82SnapshotDiffGuardOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionV82SnapshotDiffGuardSummary = {
  totalRows: number;
  selectorRows: number;
  selectorFlagEnabled: boolean | null;
  readinessArtifactsAvailable: boolean | null;
  v82SelectedRows: number;
  currentPathRows: number;
  projectionDeltasVsCurrentPath: number;
  rankingAffectingDeltas: number;
  protectedRowViolations: number;
};

export type ProjectionV82SnapshotDiffGuardEnabledValidation = {
  strategy: "pipeline_preview_artifact_no_enabled_snapshot_written";
  summary: ProjectionSelectorPipelinePreviewSummary;
  expectedV82Rows: number;
  expectedCurrentPathRows: number;
  expectedExcludedRows: number;
  expectedBlockedRows: number;
};

export type ProjectionV82SnapshotDiffGuardReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    snapshot: string;
    readiness: string;
    selectorPreview: string;
    pipelinePreview: string;
  };
  defaultSnapshot: ProjectionV82SnapshotDiffGuardSummary;
  enabledValidation: ProjectionV82SnapshotDiffGuardEnabledValidation;
  missingArtifacts: {
    v82SelectedRows: number;
    currentPathRows: number;
  };
  pipelinePreviewRecommendation: ProjectionSelectorPipelinePreviewReport["recommendation"];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionV82SnapshotDiffGuardRecommendation;
  notes: string[];
};

export type ProjectionV82SnapshotDiffGuardArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
