import type { ProjectionUniverseEligibilityStatus } from "./projection-universe-eligibility-audit-types";
import type { ProjectionPromotionEligibilityClassification } from "./projection-promotion-candidate-pool-types";
import type {
  ProjectionRankImpactFlag,
  ProjectionRankImpactPointDeltaBucket,
  ProjectionRankImpactRelevanceTier,
} from "./projection-rank-impact-quality-review-types";

export type ProjectionRankImpactTierReviewVerdict =
  | "tier_review_packet_ready"
  | "tier_review_no_meaningful_movers"
  | "tier_review_blocked";

export type ProjectionRankImpactTierReviewAction =
  | "acceptable_v8_2_movement"
  | "keep_current_path_for_now"
  | "needs_roster_confirmation"
  | "needs_injury_role_review"
  | "needs_qb_superflex_review"
  | "needs_model_policy_review";

export type ProjectionRankImpactRankRange =
  | "top_50"
  | "top_100"
  | "top_150"
  | "top_200"
  | "top_300"
  | "top_500"
  | "500_plus"
  | "unknown";

export type ProjectionRankImpactPositionRankRange =
  | "starter"
  | "depth"
  | "deep"
  | "unknown";

export type ProjectionRankImpactTierReviewRow = {
  playerId: string;
  player: string;
  position: string;
  team: string | null;
  currentExpectedGames: number | null;
  v82ExpectedGames: number | null;
  gamesDelta: number | null;
  currentProjectedTotal: number | null;
  v82ProjectedTotal: number | null;
  projectedPointDelta: number | null;
  currentOverallRank: number | null;
  v82OverallRank: number | null;
  estimatedOverallRankMovement: number | null;
  currentPositionRank: number | null;
  v82PositionRank: number | null;
  estimatedPositionRankMovement: number | null;
  bestOverallRank: number | null;
  bestPositionRank: number | null;
  relevanceTiers: ProjectionRankImpactRelevanceTier[];
  pointDeltaBucket: ProjectionRankImpactPointDeltaBucket;
  overallRankRange: ProjectionRankImpactRankRange;
  positionRankRange: ProjectionRankImpactPositionRankRange;
  rankImpactFlags: ProjectionRankImpactFlag[];
  riskFlags: string[];
  reasonCodes: string[];
  cohortTags: string[];
  universeEligibilityStatus: ProjectionUniverseEligibilityStatus;
  promotionClassification: ProjectionPromotionEligibilityClassification;
  recommendedTierReviewAction: ProjectionRankImpactTierReviewAction;
  reviewRationale: string;
};

export type ProjectionRankImpactTierReviewSummary = {
  meaningfulRows: number;
  actionCounts: Record<ProjectionRankImpactTierReviewAction, number>;
  positionCounts: Record<string, number>;
  rankImpactFlagCounts: Record<ProjectionRankImpactFlag, number>;
  overallRankRangeCounts: Record<ProjectionRankImpactRankRange, number>;
  positionRankRangeCounts: Record<ProjectionRankImpactPositionRankRange, number>;
  projectedPointMovementBucketCounts: Record<ProjectionRankImpactPointDeltaBucket, number>;
  qbSuperflexSensitiveRows: number;
};

export type ProjectionRankImpactTierReviewReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    rankImpactQualityReview: string;
    limitedPromotionPoolReview: string;
    finalReadiness: string;
    shadow: string;
    snapshot: string;
  };
  rows: ProjectionRankImpactTierReviewRow[];
  summary: ProjectionRankImpactTierReviewSummary;
  allMeaningfulOverallRankMovers: ProjectionRankImpactTierReviewRow[];
  allMeaningfulPositionRankMovers: ProjectionRankImpactTierReviewRow[];
  allQbSuperflexSensitiveMovers: ProjectionRankImpactTierReviewRow[];
  starterTierVeteranMovers: ProjectionRankImpactTierReviewRow[];
  rookieYoungMovers: ProjectionRankImpactTierReviewRow[];
  topProjectedPointMovers: ProjectionRankImpactTierReviewRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  verdict: ProjectionRankImpactTierReviewVerdict;
  notes: string[];
};

export type ProjectionRankImpactTierReviewOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionRankImpactTierReviewArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
