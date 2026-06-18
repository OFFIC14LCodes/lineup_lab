import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { ProjectionUniverseEligibilityStatus } from "./backtesting";
import type { ProjectionV82FeatureFlagReadinessReport, ProjectionV82FeatureFlagReadinessRow } from "./backtesting";

export const BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES = "BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES";

export type ExpectedGamesModelSelection = "current_path" | "v8_2_candidate_path" | "blocked_or_excluded";

export type ExpectedGamesModelSelectionReason =
  | "flag_disabled"
  | "missing_safety_artifacts"
  | "readiness_row_missing"
  | "eligible_safe_candidate"
  | "current_path_protected"
  | "kicker_policy_protected"
  | "critical_movement_protected"
  | "meaningful_rank_movement_protected"
  | "legacy_or_stale_blocked"
  | "excluded_or_blocked";

export type ExpectedGamesModelSelectionInput = {
  playerId: string;
  position?: string | null;
  criticalMovement?: boolean;
  meaningfulRankMover?: boolean;
  universeEligibilityStatus?: ProjectionUniverseEligibilityStatus | null;
  readinessRow?: ProjectionV82FeatureFlagReadinessRow | null;
  readinessArtifactsAvailable?: boolean;
  flagEnabled?: boolean;
};

export type ExpectedGamesModelSelectionResult = {
  selection: ExpectedGamesModelSelection;
  reason: ExpectedGamesModelSelectionReason;
  model: "current" | "blackbird_expected_games_v8_2_high_impact_guardrail" | null;
  flagEnabled: boolean;
};

export function isV82ExpectedGamesEnabled(env: Pick<NodeJS.ProcessEnv, string> = process.env): boolean {
  const raw = env[BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES];
  if (raw === undefined) return false;
  return raw.trim().toLowerCase() === "true" || raw.trim() === "1";
}

export function selectExpectedGamesModelForProjectionRow(input: ExpectedGamesModelSelectionInput): ExpectedGamesModelSelectionResult {
  const flagEnabled = input.flagEnabled ?? isV82ExpectedGamesEnabled();
  if (!flagEnabled) return current("flag_disabled", flagEnabled);
  if (input.readinessArtifactsAvailable === false) return current("missing_safety_artifacts", flagEnabled);
  if (!input.readinessRow) return current("readiness_row_missing", flagEnabled);

  const position = input.position ?? input.readinessRow.position;
  const universeEligibilityStatus = input.universeEligibilityStatus ?? input.readinessRow.universeEligibilityStatus;
  const criticalMovement = input.criticalMovement ?? input.readinessRow.criticalMovement;
  const meaningfulRankMover = input.meaningfulRankMover ?? input.readinessRow.meaningfulRankMover;

  if (input.readinessRow.status === "excluded_from_flag_pool" || input.readinessRow.status === "blocked_from_flag_pool") {
    return blocked("excluded_or_blocked", flagEnabled);
  }
  if (input.readinessRow.status === "would_use_current_path_under_flag") return current("current_path_protected", flagEnabled);
  if (universeEligibilityStatus === "retired_or_legacy_suspect" || universeEligibilityStatus === "stale_historical_signal") {
    return blocked("legacy_or_stale_blocked", flagEnabled);
  }
  if (position === "K") return current("kicker_policy_protected", flagEnabled);
  if (criticalMovement) return current("critical_movement_protected", flagEnabled);
  if (meaningfulRankMover) return current("meaningful_rank_movement_protected", flagEnabled);
  if (input.readinessRow.status === "would_use_v8_2_under_flag") {
    return {
      selection: "v8_2_candidate_path",
      reason: "eligible_safe_candidate",
      model: "blackbird_expected_games_v8_2_high_impact_guardrail",
      flagEnabled,
    };
  }

  return current("current_path_protected", flagEnabled);
}

export function loadV82FeatureFlagReadinessRows(options: {
  projectionSeason: number;
  artifactPath?: string;
}): Map<string, ProjectionV82FeatureFlagReadinessRow> | null {
  const artifactPath = options.artifactPath ?? path.join(
    process.cwd(),
    "artifacts",
    "projections",
    "backtesting",
    `projection-v8-2-feature-flag-readiness-${options.projectionSeason}.json`,
  );
  if (!existsSync(artifactPath)) return null;
  try {
    const report = JSON.parse(readFileSync(artifactPath, "utf8")) as ProjectionV82FeatureFlagReadinessReport;
    if (report.recommendation !== "ready_for_disabled_feature_flag_scaffold") return null;
    return new Map(report.rows.map((row) => [row.playerId, row]));
  } catch {
    return null;
  }
}

function current(reason: ExpectedGamesModelSelectionReason, flagEnabled: boolean): ExpectedGamesModelSelectionResult {
  return { selection: "current_path", reason, model: "current", flagEnabled };
}

function blocked(reason: ExpectedGamesModelSelectionReason, flagEnabled: boolean): ExpectedGamesModelSelectionResult {
  return { selection: "blocked_or_excluded", reason, model: null, flagEnabled };
}
