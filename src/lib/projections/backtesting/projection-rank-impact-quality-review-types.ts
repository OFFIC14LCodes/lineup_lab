export type ProjectionRankImpactQualityRecommendation =
  | "rank_impact_clean_for_feature_flag_review"
  | "rank_impact_needs_tier_review"
  | "rank_impact_blocked";

export type ProjectionRankImpactRelevanceTier =
  | "overall_top_50"
  | "overall_top_100"
  | "overall_top_200"
  | "overall_top_300"
  | "overall_top_500"
  | "overall_500_plus"
  | "position_starter_tier"
  | "position_depth_tier"
  | "position_deep_tier"
  | "near_zero_projection";

export type ProjectionRankImpactFlag =
  | "top_100_overall_movement"
  | "top_200_overall_movement"
  | "top_300_overall_movement"
  | "starter_tier_position_movement"
  | "qb_superflex_sensitive_movement"
  | "large_points_small_rank_noise"
  | "small_points_large_rank_noise"
  | "deep_tier_rank_noise";

export type ProjectionRankImpactPointDeltaBucket = "0" | "0-2" | "2-5" | "5-10" | "10-20";

export type ProjectionRankImpactQualityRow = {
  playerId: string;
  player: string;
  position: string;
  team: string | null;
  currentProjectedTotal: number | null;
  v82ProjectedTotal: number | null;
  projectedPointDelta: number | null;
  currentOverallRank: number | null;
  v82OverallRank: number | null;
  currentPositionRank: number | null;
  v82PositionRank: number | null;
  estimatedOverallRankMovement: number | null;
  estimatedPositionRankMovement: number | null;
  bestOverallRank: number | null;
  bestPositionRank: number | null;
  relevanceTiers: ProjectionRankImpactRelevanceTier[];
  pointDeltaBucket: ProjectionRankImpactPointDeltaBucket;
  meaningfulFlags: ProjectionRankImpactFlag[];
  riskFlags: string[];
  reasonCodes: string[];
};

export type ProjectionRankImpactTierSummary = {
  tier: string;
  rows: number;
  averageProjectedPointDelta: number | null;
  medianProjectedPointDelta: number | null;
  averageOverallRankMovement: number | null;
  medianOverallRankMovement: number | null;
  averagePositionRankMovement: number | null;
  medianPositionRankMovement: number | null;
  rowsMoving5PlusPositionRanks: number;
  rowsMoving10PlusPositionRanks: number;
  rowsMoving25PlusOverallRanks: number;
  rowsMoving50PlusOverallRanks: number;
  topMovers: ProjectionRankImpactQualityRow[];
};

export type ProjectionRankImpactDraftableRangeSummary = {
  segment: string;
  rows: number;
  rowsMoving5PlusPositionRanks: number;
  rowsMoving10PlusPositionRanks: number;
  rowsMoving25PlusOverallRanks: number;
  rowsMoving50PlusOverallRanks: number;
  averageProjectedPointDelta: number | null;
  topMovers: ProjectionRankImpactQualityRow[];
};

export type ProjectionRankImpactQbReview = {
  eligibleQbRows: number;
  rowsMoving5PlusPositionRanks: number;
  rowsMoving10PlusPositionRanks: number;
  top12MeaningfulRows: number;
  top24MeaningfulRows: number;
  top36MeaningfulRows: number;
  topQbMovements: ProjectionRankImpactQualityRow[];
  backupDeepQbNoiseRows: ProjectionRankImpactQualityRow[];
};

export type ProjectionRankImpactQualityReviewReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  sourceArtifacts: {
    limitedPromotionPoolReview: string;
    finalReadiness: string;
    shadow: string;
    snapshot: string;
  };
  rows: ProjectionRankImpactQualityRow[];
  tierSummaries: ProjectionRankImpactTierSummary[];
  pointDeltaBucketSummaries: ProjectionRankImpactTierSummary[];
  draftableRangeSummaries: ProjectionRankImpactDraftableRangeSummary[];
  positionRangeSummaries: ProjectionRankImpactDraftableRangeSummary[];
  qbReview: ProjectionRankImpactQbReview;
  summary: {
    eligibleRows: number;
    meaningfulOverallRankMovers: number;
    meaningfulPositionRankMovers: number;
    smallPointsLargeRankNoiseRows: number;
    deepTierNoiseRows: number;
    qbSuperflexSensitiveRows: number;
  };
  topMeaningfulOverallRankMovers: ProjectionRankImpactQualityRow[];
  topMeaningfulPositionRankMovers: ProjectionRankImpactQualityRow[];
  topSmallPointsLargeRankNoiseRows: ProjectionRankImpactQualityRow[];
  topDeepTierRankNoiseRows: ProjectionRankImpactQualityRow[];
  topQbRankMovers: ProjectionRankImpactQualityRow[];
  topRbRankMovers: ProjectionRankImpactQualityRow[];
  topWrRankMovers: ProjectionRankImpactQualityRow[];
  topTeRankMovers: ProjectionRankImpactQualityRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  recommendation: ProjectionRankImpactQualityRecommendation;
  notes: string[];
};

export type ProjectionRankImpactQualityReviewOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionRankImpactQualityReviewArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
