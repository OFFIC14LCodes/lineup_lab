import { afterEach, describe, expect, it } from "vitest";

import {
  buildH10WarRoomModeState,
  H10_INTERNAL_TRUSTED_EXPERIMENT_FEATURE_FLAG,
  H10_INTERNAL_TRUSTED_USER_IDS_ENV,
} from "@/lib/rosterforge/h10-internal-trusted-mode";

const OLD_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...OLD_ENV };
});

describe("buildH10WarRoomModeState", () => {
  it("keeps H10.17 defaults when internal trusted mode is disabled", () => {
    delete process.env[H10_INTERNAL_TRUSTED_EXPERIMENT_FEATURE_FLAG];
    delete process.env[H10_INTERNAL_TRUSTED_USER_IDS_ENV];
    delete process.env.BLACKBIRD_E2E_AUTH_USER_ID;
    delete process.env.SCORING_VALIDATION_OPERATOR_USER_ID;

    const state = buildH10WarRoomModeState({ userId: "user-1" });

    expect(state.h10RecommendationPreviewEnabled).toBe(true);
    expect(state.h10RecommendationExperimentEnabled).toBe(false);
    expect(state.h10InternalTrustedExperimentEnabled).toBe(false);
    expect(state.h10InternalTrustedExperimentAllowed).toBe(false);
    expect(state.h10InternalTrustedExperimentGating).toBe("env_only");
  });

  it("allows env-only trusted mode when no trusted-user allowlist exists", () => {
    process.env[H10_INTERNAL_TRUSTED_EXPERIMENT_FEATURE_FLAG] = "true";
    delete process.env[H10_INTERNAL_TRUSTED_USER_IDS_ENV];
    delete process.env.BLACKBIRD_E2E_AUTH_USER_ID;
    delete process.env.SCORING_VALIDATION_OPERATOR_USER_ID;

    const state = buildH10WarRoomModeState({ userId: "user-1" });

    expect(state.h10InternalTrustedExperimentEnabled).toBe(true);
    expect(state.h10InternalTrustedExperimentAllowed).toBe(true);
    expect(state.h10InternalTrustedExperimentGating).toBe("env_only");
  });

  it("requires the current user when a trusted-user allowlist exists", () => {
    process.env[H10_INTERNAL_TRUSTED_EXPERIMENT_FEATURE_FLAG] = "true";
    process.env[H10_INTERNAL_TRUSTED_USER_IDS_ENV] = "user-2,user-3";

    expect(buildH10WarRoomModeState({ userId: "user-1" }).h10InternalTrustedExperimentAllowed).toBe(false);
    expect(buildH10WarRoomModeState({ userId: "user-2" }).h10InternalTrustedExperimentAllowed).toBe(true);
    expect(buildH10WarRoomModeState({ userId: "user-2" }).h10InternalTrustedExperimentGating).toBe("trusted_user_allowlist");
  });

  it("treats local e2e and scoring operator users as trusted test users", () => {
    process.env[H10_INTERNAL_TRUSTED_EXPERIMENT_FEATURE_FLAG] = "true";
    process.env.BLACKBIRD_E2E_AUTH_USER_ID = "e2e-user";

    expect(buildH10WarRoomModeState({ userId: "e2e-user" }).h10InternalTrustedExperimentAllowed).toBe(true);
    expect(buildH10WarRoomModeState({ userId: "other-user" }).h10InternalTrustedExperimentAllowed).toBe(false);
  });

  it("lets an explicit trusted-user allowlist override local e2e fallback users", () => {
    process.env[H10_INTERNAL_TRUSTED_EXPERIMENT_FEATURE_FLAG] = "true";
    process.env[H10_INTERNAL_TRUSTED_USER_IDS_ENV] = "admin-user";
    process.env.BLACKBIRD_E2E_AUTH_USER_ID = "e2e-user";

    expect(buildH10WarRoomModeState({ userId: "e2e-user" }).h10InternalTrustedExperimentAllowed).toBe(false);
    expect(buildH10WarRoomModeState({ userId: "admin-user" }).h10InternalTrustedExperimentAllowed).toBe(true);
  });
});
