import { getBooleanEnv, getOptionalEnv } from "@/lib/env";

export const H10_INTERNAL_TRUSTED_EXPERIMENT_FEATURE_FLAG = "ENABLE_H10_INTERNAL_TRUSTED_EXPERIMENT";
export const H10_INTERNAL_TRUSTED_USER_IDS_ENV = "H10_INTERNAL_TRUSTED_USER_IDS";

export type H10WarRoomModeState = {
  h10RecommendationPreviewEnabled: boolean;
  h10RecommendationExperimentEnabled: boolean;
  h10InternalTrustedExperimentEnabled: boolean;
  h10InternalTrustedExperimentAllowed: boolean;
  h10InternalTrustedExperimentGating: "env_only" | "trusted_user_allowlist";
};

export function buildH10WarRoomModeState(input: {
  userId: string;
  previewEnabled?: boolean;
  experimentEnabled?: boolean;
  internalTrustedEnabled?: boolean;
}): H10WarRoomModeState {
  const h10RecommendationPreviewEnabled = input.previewEnabled ?? getBooleanEnv("ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_PREVIEW", true);
  const h10RecommendationExperimentEnabled = input.experimentEnabled ?? getBooleanEnv("ENABLE_H10_WAR_ROOM_RECOMMENDATIONS_EXPERIMENT", false);
  const h10InternalTrustedExperimentEnabled =
    input.internalTrustedEnabled ?? getBooleanEnv(H10_INTERNAL_TRUSTED_EXPERIMENT_FEATURE_FLAG, false);
  const trustedUserIds = getTrustedUserIds();
  const usesAllowlist = trustedUserIds.length > 0;
  const h10InternalTrustedExperimentAllowed =
    h10InternalTrustedExperimentEnabled && (!usesAllowlist || trustedUserIds.includes(input.userId));

  return {
    h10RecommendationPreviewEnabled,
    h10RecommendationExperimentEnabled,
    h10InternalTrustedExperimentEnabled,
    h10InternalTrustedExperimentAllowed,
    h10InternalTrustedExperimentGating: usesAllowlist ? "trusted_user_allowlist" : "env_only",
  };
}

function getTrustedUserIds() {
  const explicitTrustedUserIds = splitIds(getOptionalEnv(H10_INTERNAL_TRUSTED_USER_IDS_ENV));
  if (explicitTrustedUserIds.length > 0) return explicitTrustedUserIds;

  return [
    ...splitIds(getOptionalEnv("BLACKBIRD_E2E_AUTH_USER_ID")),
    ...splitIds(getOptionalEnv("SCORING_VALIDATION_OPERATOR_USER_ID")),
  ].filter((value, index, values) => value && values.indexOf(value) === index);
}

function splitIds(value: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
