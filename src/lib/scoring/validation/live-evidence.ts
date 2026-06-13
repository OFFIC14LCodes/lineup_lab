import type { RecommendationExperimentScope, ScoringReadinessStatus } from "@/lib/scoring/validation/types";

export type AnonymizedDiscrepantRow = {
  rowLabel: string;
  blackbirdPoints: number;
  providerPoints: number | null;
  difference: number | null;
  comparisonStatus: string | null;
  coverageRatio: number;
  isComplete: boolean;
};

export type DiscrepancyInvestigation = {
  leagueLabel: string;
  cohortKey: string;
  providerLabel: string;
  positionGroup: string | null;
  sourceType: string;
  triggerReasons: string[];
  fullyCoveredRowCount: number;
  differentStatusCount: number;
  meanAbsoluteDifference: number | null;
  maximumAbsoluteDifference: number | null;
  likelyCauses: string[];
  representativeSamples: AnonymizedDiscrepantRow[];
};

export type ExperimentCandidate = {
  leagueLabel: string;
  sourceType: string;
  providerLabel: string;
  positionGroup: string | null;
  projectionType: string | null;
  sampleSize: number;
  eligibilityPercentage: number;
  averageCoverage: number;
  minimumCoverage: number;
  unsupportedKeys: string[];
  missingStats: string[];
  readinessVerdict: ScoringReadinessStatus;
  intendedExperimentScope: RecommendationExperimentScope;
};

export type BlockedCohort = {
  leagueLabel: string;
  sourceType: string;
  providerLabel: string;
  positionGroup: string | null;
  projectionType: string | null;
  status: ScoringReadinessStatus;
  blockReasons: string[];
};

export type AnonymizedLeagueDataInventory = {
  weeklyStatsRowCount: number;
  seasonStatsRowCount: number;
  projectionRowCount: number;
  availableSeasons: number[];
  availableWeeks: number[];
  providers: string[];
  sourceUpdatedAtRange: { earliest: string | null; latest: string | null };
  rowCountByWeek: Array<{ week: number; count: number }>;
  rowCountByPosition: Array<{ positionGroup: string; count: number }>;
  provenance: {
    artifactDownloadedAtRange: { earliest: string | null; latest: string | null };
    importBatchRange: { earliestStartedAt: string | null; latestCompletedAt: string | null };
    sourceShas: string[];
    importBatchIds: string[];
  };
};

export type AnonymizedLeagueScoringProfile = {
  label: string;
  season: number | null;
  receptionFormat: "PPR" | "half-PPR" | "no-PPR" | "unknown";
  passingTdValue: number | null;
  tePremiumPresent: boolean;
  bonusesPresent: string[];
  kickerEnabled: boolean;
  defEnabled: boolean;
  idpEnabled: boolean;
  activeScoringKeyCount: number;
  unsupportedActiveKeyCount: number;
  unsupportedActiveKeys: string[];
  invalidScoringSettingCount: number;
};

export type AnonymizedLeagueEvidence = {
  label: string;
  scoringProfile: AnonymizedLeagueScoringProfile;
  dataInventory: AnonymizedLeagueDataInventory;
};

export type AnonymizedCohortEvidence = {
  leagueLabel: string;
  cohortLabel: string;
  providerLabel: string;
  sourceType: string;
  positionGroup: string | null;
  projectionType: string | null;
  season: number;
  week: number | null;
  sampleSize: number;
  readinessStatus: ScoringReadinessStatus;
  scoringValidationStatus: ScoringReadinessStatus;
  recommendationExperimentEligible: boolean;
  recommendationExperimentScope: RecommendationExperimentScope;
  eligibilityPercentage: number;
  averageCoverageRatio: number;
  minimumCoverageRatio: number;
  sampleSufficiency: string;
  missingStatTopKeys: string[];
  unsupportedTopKeys: string[];
  aliasAmbiguityCount: number;
  providerComparisonMetrics: {
    withProviderTotals: number;
    classifiedCount: number;
    excludedCount: number;
    matchCount: number;
    closeCount: number;
    differentCount: number;
    meanAbsoluteDifference: number | null;
    maximumAbsoluteDifference: number | null;
  };
};

export type LiveScoringValidationEvidence = {
  generatedAt: string;
  scoringFormulaVersion: string;
  readinessVersion: string;
  leagues: AnonymizedLeagueEvidence[];
  cohorts: AnonymizedCohortEvidence[];
  discrepancyInvestigations: DiscrepancyInvestigation[];
  overallFindings: string[];
  experimentCandidates: ExperimentCandidate[];
  blockedCohorts: BlockedCohort[];
};
