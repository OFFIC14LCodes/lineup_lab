import type { ProjectionType } from "@/lib/providers/data-types";
import type { ProviderName } from "@/lib/providers/types";
import type { PositionGroup } from "@/lib/scoring/types";
import type {
  LeagueScoringContext,
  ProviderPointComparison,
  ScoringInspectorSourceType,
  StoredRowBatchItem,
  StoredRowScoringError,
  StoredRowScoringResult
} from "@/lib/scoring/server/types";

export type ScoringReadinessStatus =
  | "ready"
  | "conditionally_ready"
  | "not_ready"
  | "insufficient_data";

export type ScoringKeyImpact = "core" | "material" | "minor" | "unknown";

export type ReadinessReason = {
  code: string;
  message: string;
  severity: "info" | "warning" | "blocking";
  scoringKeys?: string[];
  statKeys?: string[];
};

export type ReadinessScoreBreakdownItem = {
  code: string;
  label: string;
  points: number;
  kind: "base" | "deduction" | "cap";
};

export type RecommendationExperimentScope =
  | "none"
  | "weekly_recommendation"
  | "weekly_projection_experiment"
  | "season_value_experiment"
  | "historical_season_analysis";

export type ScoringReadinessDecision = {
  status: ScoringReadinessStatus;
  eligibleForRecommendationExperiment: boolean;
  eligibleExperimentScope: RecommendationExperimentScope;
  score: number;
  reasons: ReadinessReason[];
  warnings: string[];
  failedRules: string[];
  passedRules: string[];
  scoreBreakdown: ReadinessScoreBreakdownItem[];
  formulaVersion: string;
  readinessVersion: string;
};

export type LeagueReadinessResult = ScoringReadinessDecision & {
  positionGroup: PositionGroup | null;
  activeApplicableKeys: string[];
  supportedApplicableKeys: string[];
  unsupportedApplicableKeys: string[];
  invalidScoringKeys: string[];
  aggregateUnsafeKeys: string[];
  supportRatio: number | null;
  unsupportedKeyImpacts: Record<string, ScoringKeyImpact>;
  highImpactUnsupportedKeys: string[];
};

export type RowValidationResult = {
  rowId: string;
  playerId: string;
  playerName: string;
  provider: ProviderName;
  sourceType: ScoringInspectorSourceType;
  positionGroup: PositionGroup | null;
  season: number;
  week: number | null;
  projectionType: ProjectionType | null;
  blackbirdPoints: number;
  coverageRatio: number;
  providerComparison: ProviderPointComparison | null;
  readiness: ScoringReadinessDecision;
  scoringResult: StoredRowScoringResult;
};

export type RowValidationError = {
  rowId: string;
  error: StoredRowScoringError;
  readiness: ScoringReadinessDecision;
};

export type ProviderComparisonDistribution = {
  withProviderTotals: number;
  withoutProviderTotals: number;
  matchCount: number;
  closeCount: number;
  differentCount: number;
  incompleteCoverageCount: number;
  meanSignedDifference: number | null;
  meanAbsoluteDifference: number | null;
  medianAbsoluteDifference: number | null;
  maximumAbsoluteDifference: number | null;
  percentageWithProviderTotals: number;
  percentageMatch: number;
  percentageClose: number;
  percentageDifferent: number;
};

export type CohortSampleSufficiency = "insufficient" | "small" | "moderate" | "stronger";

export type CohortValidationSummary = {
  cohortKey: string;
  provider: ProviderName | "mixed";
  sourceType: ScoringInspectorSourceType;
  positionGroup: PositionGroup | "mixed" | null;
  projectionType: ProjectionType | "mixed" | null;
  sampleSize: number;
  sampleSufficiency: CohortSampleSufficiency;
  readyCount: number;
  conditionallyReadyCount: number;
  notReadyCount: number;
  insufficientDataCount: number;
  eligibleCount: number;
  eligiblePercentage: number;
  averageCoverageRatio: number;
  minimumCoverageRatio: number;
  unsupportedKeyFrequency: Array<{ key: string; count: number }>;
  missingStatFrequency: Array<{ statKey: string; count: number }>;
  aliasAmbiguityCount: number;
  positionWarningCount: number;
  providerComparison: ProviderComparisonDistribution;
  warnings: string[];
  readiness: ScoringReadinessDecision;
};

export type ValidationRequestSummary = {
  sourceType: ScoringInspectorSourceType;
  season: number;
  week: number | null;
  provider: ProviderName | null;
  positionGroup: PositionGroup | null;
  projectionType: ProjectionType | null;
  limit: number;
};

export type LeagueScoringValidationReport = {
  readinessVersion: string;
  scoringFormulaVersion: string;
  generatedAt: string;
  league: Pick<LeagueScoringContext, "leagueId" | "leagueName" | "season" | "formulaVersion">;
  request: ValidationRequestSummary;
  sample: {
    requestedLimit: number;
    returnedRows: number;
    successfullyScoredRows: number;
    erroredRows: number;
  };
  leagueReadiness: LeagueReadinessResult;
  rows: Array<RowValidationResult | RowValidationError>;
  cohorts: CohortValidationSummary[];
  overallRecommendationReadiness: ScoringReadinessDecision;
  warnings: string[];
};

export type ValidateScoringSampleInput = {
  league: LeagueScoringContext;
  request: ValidationRequestSummary;
  results: StoredRowBatchItem[];
  generatedAt?: string;
  now?: Date;
};
