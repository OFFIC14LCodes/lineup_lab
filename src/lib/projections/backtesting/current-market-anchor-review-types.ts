import type { CurrentSeasonAdpEnrichedPlayer, CurrentSeasonAdpEnrichmentReport, CurrentSeasonAdpMatch } from "./current-season-adp-enrichment-types";

export type CurrentMarketAnchorReviewRecommendation =
  | "current_market_anchor_ready_for_feature_flag_preview"
  | "current_market_anchor_needs_id_mapping"
  | "current_market_anchor_needs_manual_review"
  | "current_market_anchor_needs_tuning"
  | "current_market_anchor_blocked";

export type CurrentMarketAnchorReviewRow = {
  playerName: string;
  position: string;
  team: string | null;
  originalBlackbirdRank: number | null;
  marketAdp: number | null;
  marketRank: number | null;
  marketFormat: string;
  marketAnchorRank: number | null;
  rankDelta: number;
  confidenceTrust: string | null;
  activePolicy: string | null;
  matchType: string | null;
  notes: string[];
};

export type CurrentMarketAnchorReviewReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  season: number;
  marketFormat: string;
  recommendation: CurrentMarketAnchorReviewRecommendation;
  sourceArtifacts: {
    enrichmentPath: string;
    enrichedUniversePath: string;
    wideAdpPath: string;
    snapshotPath: string;
    activePolicyPath: string;
  };
  movementQuality: {
    playersWithMarketAdp: number;
    playersWithoutMarketAdp: number;
    averageRankMovement: number;
    medianRankMovement: number;
    maxRankMovement: number;
    playersMovedUp: number;
    playersMovedDown: number;
    playersUnchanged: number;
    movementByPosition: Record<string, { players: number; averageMovement: number; maxMovement: number }>;
    movementByConfidenceTrustBucket: Record<string, { players: number; averageMovement: number; maxMovement: number }>;
    movementByActivePolicyGroup: Record<string, { players: number; averageMovement: number; maxMovement: number }>;
  };
  topMovementTables: {
    top50MovedUp: CurrentMarketAnchorReviewRow[];
    top50MovedDown: CurrentMarketAnchorReviewRow[];
    top50QbMovement: CurrentMarketAnchorReviewRow[];
    top50RbMovement: CurrentMarketAnchorReviewRow[];
    top50WrMovement: CurrentMarketAnchorReviewRow[];
    top50TeMovement: CurrentMarketAnchorReviewRow[];
    top50LowConfidenceMoved: CurrentMarketAnchorReviewRow[];
    top50HighConfidenceMoved: CurrentMarketAnchorReviewRow[];
  };
  superflexSanity: {
    eliteQbsPulledUpward: boolean;
    nonSuperflexPprOnlyBehaviorNotUsed: boolean;
    qbsHaveMateriallyDifferentMarketOrderThanOneQb: boolean;
    skillPositionMovementWithinCap: boolean;
    maxMovementCapRespected: boolean;
    examples: Array<{ playerName: string; expectedSuperflexOrder: number; actualSuperflexOrder: number | null; marketAnchorMovement: number | null; passed: boolean }>;
  };
  matchQualityAudit: {
    exactIdMatches: number;
    nameTeamPositionMatches: number;
    uniqueNamePositionMatches: number;
    reviewCandidates: number;
    unmatchedAdpRows: number;
    matchQualityRiskGrade: "low" | "medium" | "high";
    warnings: string[];
  };
  reviewCandidates: {
    candidateRows: CurrentSeasonAdpMatch[];
    unmatchedRows: CurrentSeasonAdpMatch[];
    mismatchCandidates: CurrentSeasonAdpMatch[];
  };
  rosterEligibilitySafety: {
    kRowsPresentInAdpSource: boolean;
    kRowsFilteredForNoKLeague: boolean;
    dstRowsFilteredIfUnsupported: boolean;
    idpRowsFilteredIfUnsupported: boolean;
    unsupportedPositionsFiltered: string[];
    noUnsupportedPositionsInMarketAnchorDraftablePreview: boolean;
  };
  recommendationImpactPreview: {
    status: "available" | "not_available_v1";
    currentTop25BeforeMarketAnchor: CurrentMarketAnchorReviewRow[];
    top25AfterMarketAnchor: CurrentMarketAnchorReviewRow[];
    playersEnteringTop25: string[];
    playersLeavingTop25: string[];
    topRecommendationChanged: boolean | "not_available_v1";
    draftSignalTopChanged: boolean | "not_available_v1";
  };
  sourceSummary: Pick<CurrentSeasonAdpEnrichmentReport, "matchQuality" | "marketSanityPreview" | "warRoomSafetyPreview">;
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
};

export type CurrentMarketAnchorReviewArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};

export type CurrentMarketAnchorReviewInputArtifact = CurrentSeasonAdpEnrichmentReport & {
  enrichedUniverse?: CurrentSeasonAdpEnrichedPlayer[];
};
