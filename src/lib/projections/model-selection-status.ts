export const PROJECTION_MODEL_SELECTION_FEATURE_FLAG = "BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES" as const;

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
