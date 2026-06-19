import type { DepthChartSourceReport, DepthChartSourceRow } from "@/lib/data-acquisition/depth-chart-source-types";

import type { ProjectionActivePolicyRefreshFinalReport, ProjectionActivePolicyRefreshFinalRow } from "./projection-active-policy-refresh-final-types";

export type ProjectionDepthChartResolutionStatus =
  | "depth_chart_active_confirmed"
  | "depth_chart_starter_confirmed"
  | "depth_chart_backup_confirmed"
  | "depth_chart_reserve_or_practice_squad"
  | "depth_chart_inactive_or_injured"
  | "depth_chart_team_conflict"
  | "depth_chart_position_conflict"
  | "depth_chart_review_candidate"
  | "depth_chart_unmatched"
  | "depth_chart_source_missing";

export type ProjectionDepthChartPolicyPreview =
  | "final_policy_active_candidate_preview"
  | "final_policy_shadow_only"
  | "final_policy_current_path_only"
  | "final_policy_manual_review"
  | "final_policy_source_expansion_required";

export type ProjectionDepthChartResolutionRecommendation =
  | "depth_chart_resolution_ready_for_policy_refresh"
  | "depth_chart_resolution_needs_source_population"
  | "depth_chart_resolution_needs_manual_review"
  | "depth_chart_resolution_blocked";

export type ProjectionDepthChartResolutionOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionDepthChartResolutionRow = {
  playerId: string;
  sleeperId: string | null;
  player: string;
  normalizedName: string;
  position: string;
  projectionTeam: string | null;
  matchedBy: "sleeper_id" | "gsis_id" | "player_id" | "name_team_position" | "none";
  sourceRow: DepthChartSourceRow | null;
  resolutionStatus: ProjectionDepthChartResolutionStatus;
  policyPreview: ProjectionDepthChartPolicyPreview;
  reasonCodes: string[];
  v82SafeSubset: boolean;
  importanceBucket: "high" | "moderate" | "low" | "unknown";
  projectedTotalPointDelta: number | null;
  estimatedOverallRankMovement: number | null;
  h30Row: ProjectionActivePolicyRefreshFinalRow;
};

export type ProjectionDepthChartResolutionReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    activePolicyRefreshFinal: string;
    depthChartSource: string;
  };
  sourceMissing: boolean;
  summary: {
    targetDepthChartSourceRows: number;
    sourceRows: number;
    matchedRows: number;
    confirmedActiveStarterBackup: number;
    reservePracticeSquad: number;
    inactiveInjured: number;
    teamConflicts: number;
    positionConflicts: number;
    reviewCandidates: number;
    unmatched: number;
    sourceMissing: number;
    byPosition: Record<string, number>;
    byTeam: Record<string, number>;
    byV82SafeSubset: Record<string, number>;
    byImportanceBucket: Record<string, number>;
    byStatus: Record<ProjectionDepthChartResolutionStatus, number>;
  };
  policyImpactPreview: {
    h30FinalPolicyCountsBeforeDepthChart: ProjectionActivePolicyRefreshFinalReport["policyCounts"]["h30FinalPolicyCounts"];
    h31DepthChartPreviewCounts: Record<ProjectionDepthChartPolicyPreview, number>;
    deltaActiveCandidatePreview: number;
    deltaShadowOnly: number;
    deltaCurrentPathOnly: number;
    deltaManualReview: number;
    deltaSourceExpansionRequired: number;
  };
  v82ControlledFlagImpact: {
    v82SafeRowsResolvedByDepthChart: number;
    v82SafeRowsNewlyAllowed: number;
    v82SafeRowsStillSourceExpansionRequired: number;
    v82SafeRowsMovedToManualReview: number;
    controlledFlagReviewRemainsBlocked: boolean;
    protectedZeroChecks: Record<"kRowsUsingV82" | "criticalMoversUsingV82" | "meaningfulRankMoversUsingV82" | "legacyRowsUsingV82", boolean>;
  };
  examples: {
    topActiveStarterBackupConfirmations: ProjectionDepthChartResolutionRow[];
    topReservePracticeSquadRows: ProjectionDepthChartResolutionRow[];
    topConflicts: ProjectionDepthChartResolutionRow[];
    topStillUnmatchedRows: ProjectionDepthChartResolutionRow[];
    topV82SafeRowsNewlyAllowed: ProjectionDepthChartResolutionRow[];
  };
  rows: ProjectionDepthChartResolutionRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionDepthChartResolutionRecommendation;
  notes: string[];
};

export type ProjectionDepthChartResolutionInput = {
  options: ProjectionDepthChartResolutionOptions;
  activePolicyRefreshFinal: ProjectionActivePolicyRefreshFinalReport | null;
  depthChartSource: DepthChartSourceReport | null;
  sourceArtifacts?: ProjectionDepthChartResolutionReport["sourceArtifacts"];
};

export type ProjectionDepthChartResolutionArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
