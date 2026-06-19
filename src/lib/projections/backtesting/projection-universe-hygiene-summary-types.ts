import type { ProjectionPromotionCandidateRow } from "./projection-promotion-candidate-pool-types";
import type { ProjectionUniverseEligibilityRow, ProjectionUniverseEligibilityStatus } from "./projection-universe-eligibility-audit-types";

export type ProjectionUniverseHygieneRecommendation =
  | "universe_hygiene_ready_for_source_integration"
  | "universe_hygiene_needs_review"
  | "universe_hygiene_blocked";

export type ProjectionUniverseHygieneSummaryOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionUniverseHygieneStaleLegacyRow = {
  playerId: string;
  player: string;
  position: string;
  team: string | null;
  lastActiveSeason: number | null;
  currentTeamStatus: string;
  reasonCodes: string[];
  whyBlocked: string;
};

export type ProjectionUniverseHygieneSummaryReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    universeEligibilityAudit: string;
    promotionCandidatePool: string;
    featureFlagReviewPacket: string;
    preseasonProjectionSnapshot: string;
  };
  hygieneCounts: {
    totalRows: number;
    activePlausible: number;
    lowConfidencePlausible: number;
    rookieNew: number;
    staleHistorical: number;
    retiredLegacySuspect: number;
    manualReviewRequired: number;
    blockedFromPromotion: number;
    shadowOnly: number;
    eligible: number;
    missingTeam: number;
    unknownStatus: number;
    oldLastSeenSignal: number;
    positionCounts: Record<string, number>;
    teamCounts: Record<string, number>;
  };
  staleLegacyReview: {
    totalRows: number;
    topSuspects: ProjectionUniverseHygieneStaleLegacyRow[];
    note: string;
  };
  kickerPolicy: {
    totalKRows: number;
    eligibleKRows: number;
    shadowOnlyKRows: number;
    blockedKRows: number;
    lowPriorKRows: number;
    criticalMovementKRows: number;
    whyExcludedFromV82Promotion: string;
    recommendedNextAction: "kicker_policy_review_required";
  };
  rosterTeamConfidence: {
    rowsWithCurrentTeam: number;
    rowsMissingTeam: number;
    rowsWithAmbiguousTeam: number;
    rowsWithStaleTeam: number;
    rookiesWithTeam: number;
    rookiesMissingTeam: number;
    veteransMissingTeam: number;
    sourceStatus: "insufficient_current_roster_source";
    recommendation: string;
  };
  reviewExamples: {
    staleLegacy: ProjectionUniverseHygieneStaleLegacyRow[];
    missingTeam: ProjectionUniverseEligibilityRow[];
    kickerRows: ProjectionPromotionCandidateRow[];
  };
  hygieneGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionUniverseHygieneRecommendation;
  notes: string[];
};

export type ProjectionUniverseHygieneSummaryInput = {
  options: ProjectionUniverseHygieneSummaryOptions;
  universeEligibilityAudit: import("./projection-universe-eligibility-audit-types").ProjectionUniverseEligibilityAuditReport;
  promotionCandidatePool: import("./projection-promotion-candidate-pool-types").ProjectionPromotionCandidatePoolReport;
  featureFlagReviewPacket: import("./projection-v8-2-feature-flag-review-packet-types").ProjectionV82FeatureFlagReviewPacketReport;
  sourceArtifacts?: ProjectionUniverseHygieneSummaryReport["sourceArtifacts"];
};

export type ProjectionUniverseHygieneSummaryArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};

export type ProjectionUniverseHygieneStatusCounts = Record<ProjectionUniverseEligibilityStatus, number>;
