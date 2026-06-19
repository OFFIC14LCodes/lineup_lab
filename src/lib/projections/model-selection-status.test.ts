import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  PROJECTION_MODEL_SELECTION_FEATURE_FLAG,
  buildProjectionModelSelectionStatus,
  isProjectionV82FlagEnabled,
} from "./model-selection-status";

describe("projection model selection status", () => {
  it("keeps the v8.2 feature-flag runbook and required warnings present", () => {
    const runbookPath = path.join(process.cwd(), "docs", "projections", "v8-2-feature-flag-runbook.md");
    expect(existsSync(runbookPath)).toBe(true);

    const runbook = readFileSync(runbookPath, "utf8");
    [
      "v8.2 status: `ready_for_controlled_flag_review`",
      "flag default: disabled",
      "live usage: no",
      "Supabase writes: no",
      "Blackbird Rank usage: no",
      "Draft Suggestion usage: no",
      "War Room scoring usage: no",
      "Remove-Item Env:\\BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES -ErrorAction SilentlyContinue",
      "Do not enable the env var in production yet.",
      "Do not write v8.2 projection outputs to Supabase production tables.",
      "Do not let v8.2 power Draft Suggestions yet.",
      "Phase 0: disabled scaffold, current state.",
      "Phase 5: production enablement only after manual approval.",
      "Unset `BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES`.",
      "Confirm selector returns current path.",
    ].forEach((text) => expect(runbook).toContain(text));
  });

  it("defaults to disabled current-path status", () => {
    expect(buildProjectionModelSelectionStatus({})).toEqual({
      featureFlagName: "BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES",
      flagEnabled: false,
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
    });
  });

  it("reports enabled only for true, TRUE, and 1", () => {
    expect(isProjectionV82FlagEnabled("true")).toBe(true);
    expect(isProjectionV82FlagEnabled("TRUE")).toBe(true);
    expect(isProjectionV82FlagEnabled("1")).toBe(true);
    expect(isProjectionV82FlagEnabled("false")).toBe(false);
    expect(isProjectionV82FlagEnabled("0")).toBe(false);
    expect(isProjectionV82FlagEnabled("enabled")).toBe(false);
    expect(isProjectionV82FlagEnabled(undefined)).toBe(false);
  });

  it("reports flag state from the provided env without changing live usage", () => {
    const status = buildProjectionModelSelectionStatus({ [PROJECTION_MODEL_SELECTION_FEATURE_FLAG]: "true" });

    expect(status.flagEnabled).toBe(true);
    expect(status.liveUsage).toBe(false);
    expect(status.supabaseWrites).toBe(false);
    expect(status.blackbirdRankUsesV82).toBe(false);
    expect(status.draftSuggestionsUseV82).toBe(false);
    expect(status.warRoomUsesV82).toBe(false);
  });

  it("confirms missing artifacts fail closed", () => {
    expect(buildProjectionModelSelectionStatus({}).missingArtifactsFailClosed).toBe(true);
  });
});
