import type { PlayerTrustConfidenceReasonCode } from "@/lib/draft/player-trust-confidence";

export type BlackbirdTrustMetadataRecommendation =
  | "blackbird_trust_metadata_ready_for_manual_review"
  | "blackbird_trust_metadata_needs_data_fix"
  | "blackbird_trust_metadata_blocked";

export type BlackbirdTrustMetadataAuditRow = {
  player_name: string;
  position: string | null;
  team: string | null;
  blackbird_rank: number;
  raw_trust_label: string;
  calibrated_trust_label: string;
  confidence: string;
  projection_points: number | null;
  projection_ppg: number | null;
  projection_source: string | null;
  projection_confidence: string | null;
  identity_confidence: string | null;
  active_policy: string | null;
  current_roster_confirmation: string;
  sleeper_metadata_status: string;
  market_adp_available: boolean;
  historical_profile_available: boolean | null;
  risk_label: string;
  data_gaps: string[];
  reason_codes: PlayerTrustConfidenceReasonCode[];
  reason_trust_is_low_medium_high: string;
};

export type BlackbirdTrustMetadataWatchlistRow = {
  player_name: string;
  matched: boolean;
  blackbird_rank: number | null;
  raw_trust_label: string | null;
  calibrated_trust_label: string | null;
  reason_codes: PlayerTrustConfidenceReasonCode[];
  reason: string;
};

export type BlackbirdTrustMetadataAuditReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  recommendation: BlackbirdTrustMetadataRecommendation;
  rowsAudited: number;
  top100BeforeTrustDistribution: Record<"high" | "medium" | "low" | "very_low", number>;
  top100AfterTrustDistribution: Record<"high" | "medium" | "low" | "very_low", number>;
  reasonCounts: Record<PlayerTrustConfidenceReasonCode, number>;
  watchlist: BlackbirdTrustMetadataWatchlistRow[];
  rows: BlackbirdTrustMetadataAuditRow[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  marketAnchorEnabledByDefault: false;
  supabaseWrites: false;
  v82Enabled: false;
};

export type BuildBlackbirdTrustMetadataAuditInput = {
  projectionSeason: number;
  rows: unknown[];
  topN?: number;
};
