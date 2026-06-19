export const PROJECTION_MODEL_SELECTION_FEATURE_FLAG = "BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES" as const;
export const MARKET_ANCHOR_RANK_FEATURE_FLAG = "BLACKBIRD_ENABLE_MARKET_ANCHOR_RANK" as const;

export type ProjectionModelSelectionStatus = {
  featureFlagName: typeof PROJECTION_MODEL_SELECTION_FEATURE_FLAG;
  flagEnabled: boolean;
  defaultModel: "current_path";
  currentModelSelectedInWarRoom: "current_path";
  v82Eligible: boolean;
  safeSubsetReadiness: "ready_for_controlled_flag_review";
  protectedRowsEnforced: true;
  liveUsage: false;
  supabaseWrites: false;
  draftSuggestionsUseV82: false;
  blackbirdRankUsesV82: false;
  warRoomUsesV82: false;
  missingArtifactsFailClosed: true;
};

export type MarketAnchorRankSelectionStatus = {
  featureFlagName: typeof MARKET_ANCHOR_RANK_FEATURE_FLAG;
  flagEnabled: boolean;
  defaultState: "disabled";
  label: "Market Anchor Rank: disabled" | "Market Anchor Rank: preview enabled";
  liveUsage: false;
  draftSuggestionsUseMarketAnchor: false;
  blackbirdRankUsesMarketAnchorByDefault: false;
  supabaseWrites: false;
};

export function buildProjectionModelSelectionStatus(
  env: Pick<NodeJS.ProcessEnv, string> = typeof process === "undefined" ? {} : process.env,
): ProjectionModelSelectionStatus {
  return {
    featureFlagName: PROJECTION_MODEL_SELECTION_FEATURE_FLAG,
    flagEnabled: isProjectionV82FlagEnabled(env[PROJECTION_MODEL_SELECTION_FEATURE_FLAG]),
    defaultModel: "current_path",
    currentModelSelectedInWarRoom: "current_path",
    v82Eligible: true,
    safeSubsetReadiness: "ready_for_controlled_flag_review",
    protectedRowsEnforced: true,
    liveUsage: false,
    supabaseWrites: false,
    draftSuggestionsUseV82: false,
    blackbirdRankUsesV82: false,
    warRoomUsesV82: false,
    missingArtifactsFailClosed: true,
  };
}

export function isProjectionV82FlagEnabled(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const normalized = raw.trim();
  return normalized === "1" || normalized.toLowerCase() === "true";
}

export function buildMarketAnchorRankSelectionStatus(
  env: Pick<NodeJS.ProcessEnv, string> = typeof process === "undefined" ? {} : process.env,
): MarketAnchorRankSelectionStatus {
  const flagEnabled = isMarketAnchorRankFlagEnabled(env[MARKET_ANCHOR_RANK_FEATURE_FLAG]);
  return {
    featureFlagName: MARKET_ANCHOR_RANK_FEATURE_FLAG,
    flagEnabled,
    defaultState: "disabled",
    label: flagEnabled ? "Market Anchor Rank: preview enabled" : "Market Anchor Rank: disabled",
    liveUsage: false,
    draftSuggestionsUseMarketAnchor: false,
    blackbirdRankUsesMarketAnchorByDefault: false,
    supabaseWrites: false,
  };
}

export function isMarketAnchorRankFlagEnabled(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const normalized = raw.trim();
  return normalized === "1" || normalized.toLowerCase() === "true";
}
