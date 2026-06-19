import type { BlackbirdBoardRow } from "./blackbird-board";

export type MarketAnchorPreviewStatus =
  | "disabled"
  | "preview_enabled"
  | "artifacts_missing"
  | "blocked";

export type MarketAnchorBoardPreviewDiagnostics = {
  flagEnabled: boolean;
  status: MarketAnchorPreviewStatus;
  label: "Market Anchor Rank: disabled" | "Market Anchor Rank: preview enabled";
  marketFormat: string;
  artifactAvailability: {
    enrichedUniverse: boolean;
    review: boolean;
  };
  playersWithAdp: number;
  playersWithMarketMovement: number;
  playersApplied: number;
  playersSkipped: number;
  unsupportedPositionsFiltered: string[];
  matchQualityWarning: string | null;
  warnings: string[];
};

export type MarketAnchorBoardPreviewMetadata = {
  enabled: true;
  label: "Market Anchor Preview";
  source: "current_season_adp_enrichment";
  marketFormat: string;
  originalBlackbirdRank: number;
  marketAnchorRank: number;
  marketRank: number;
  marketAdp: number | null;
  rankDelta: number;
  matchConfidence: "exact" | "high" | "review";
  notes: string[];
};

export type MarketAnchorBoardPreviewRow = BlackbirdBoardRow & {
  marketAnchorPreview?: MarketAnchorBoardPreviewMetadata;
};

export type MarketAnchorBoardPreviewResult = {
  rows: MarketAnchorBoardPreviewRow[];
  diagnostics: MarketAnchorBoardPreviewDiagnostics;
};
