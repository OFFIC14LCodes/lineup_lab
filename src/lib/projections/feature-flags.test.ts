import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES,
  BLACKBIRD_ENABLE_MARKET_ANCHOR_RANK,
  isMarketAnchorRankEnabled,
  isV82ExpectedGamesEnabled,
  loadV82FeatureFlagReadinessRows,
  selectExpectedGamesModelForProjectionRow,
} from "./feature-flags";
import type { ProjectionV82FeatureFlagReadinessReport, ProjectionV82FeatureFlagReadinessRow } from "./backtesting";

describe("v8.2 expected-games feature flag scaffold", () => {
  it("defaults disabled and only accepts explicit truthy values", () => {
    expect(isV82ExpectedGamesEnabled({})).toBe(false);
    expect(isV82ExpectedGamesEnabled({ [BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES]: "false" })).toBe(false);
    expect(isV82ExpectedGamesEnabled({ [BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES]: "0" })).toBe(false);
    expect(isV82ExpectedGamesEnabled({ [BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES]: "no" })).toBe(false);
    expect(isV82ExpectedGamesEnabled({ [BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES]: "enabled" })).toBe(false);
    expect(isV82ExpectedGamesEnabled({ [BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES]: "true" })).toBe(true);
    expect(isV82ExpectedGamesEnabled({ [BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES]: "TRUE" })).toBe(true);
    expect(isV82ExpectedGamesEnabled({ [BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES]: "1" })).toBe(true);
  });

  it("defaults market anchor rank disabled and only accepts explicit truthy values", () => {
    expect(isMarketAnchorRankEnabled({})).toBe(false);
    expect(isMarketAnchorRankEnabled({ [BLACKBIRD_ENABLE_MARKET_ANCHOR_RANK]: "false" })).toBe(false);
    expect(isMarketAnchorRankEnabled({ [BLACKBIRD_ENABLE_MARKET_ANCHOR_RANK]: "0" })).toBe(false);
    expect(isMarketAnchorRankEnabled({ [BLACKBIRD_ENABLE_MARKET_ANCHOR_RANK]: "yes" })).toBe(false);
    expect(isMarketAnchorRankEnabled({ [BLACKBIRD_ENABLE_MARKET_ANCHOR_RANK]: "true" })).toBe(true);
    expect(isMarketAnchorRankEnabled({ [BLACKBIRD_ENABLE_MARKET_ANCHOR_RANK]: "TRUE" })).toBe(true);
    expect(isMarketAnchorRankEnabled({ [BLACKBIRD_ENABLE_MARKET_ANCHOR_RANK]: "1" })).toBe(true);
  });

  it("uses current path when the flag is unset or disabled", () => {
    expect(selectExpectedGamesModelForProjectionRow({ playerId: "p1", readinessRow: row("p1"), flagEnabled: false })).toMatchObject({
      selection: "current_path",
      reason: "flag_disabled",
      model: "current",
    });
  });

  it("fails closed to current path when decision artifacts are missing", () => {
    expect(selectExpectedGamesModelForProjectionRow({ playerId: "p1", flagEnabled: true, readinessArtifactsAvailable: false })).toMatchObject({
      selection: "current_path",
      reason: "missing_safety_artifacts",
    });
    expect(selectExpectedGamesModelForProjectionRow({ playerId: "p1", flagEnabled: true, readinessRow: null })).toMatchObject({
      selection: "current_path",
      reason: "readiness_row_missing",
    });
  });

  it("selects v8.2 only for eligible safe rows when explicitly enabled", () => {
    expect(selectExpectedGamesModelForProjectionRow({ playerId: "p1", readinessRow: row("p1"), flagEnabled: true })).toMatchObject({
      selection: "v8_2_candidate_path",
      reason: "eligible_safe_candidate",
      model: "blackbird_expected_games_v8_2_high_impact_guardrail",
    });
  });

  it("keeps protected rows on current path even when explicitly enabled", () => {
    expect(selectExpectedGamesModelForProjectionRow({ playerId: "k", position: "K", readinessRow: row("k", { position: "K" }), flagEnabled: true })).toMatchObject({
      selection: "current_path",
      reason: "kicker_policy_protected",
    });
    expect(selectExpectedGamesModelForProjectionRow({ playerId: "critical", criticalMovement: true, readinessRow: row("critical"), flagEnabled: true })).toMatchObject({
      selection: "current_path",
      reason: "critical_movement_protected",
    });
    expect(selectExpectedGamesModelForProjectionRow({ playerId: "tier", meaningfulRankMover: true, readinessRow: row("tier"), flagEnabled: true })).toMatchObject({
      selection: "current_path",
      reason: "meaningful_rank_movement_protected",
    });
    expect(selectExpectedGamesModelForProjectionRow({ playerId: "current", readinessRow: row("current", { status: "would_use_current_path_under_flag" }), flagEnabled: true })).toMatchObject({
      selection: "current_path",
      reason: "current_path_protected",
    });
  });

  it("blocks excluded and legacy rows instead of selecting v8.2", () => {
    expect(selectExpectedGamesModelForProjectionRow({ playerId: "legacy", readinessRow: row("legacy", { universeEligibilityStatus: "retired_or_legacy_suspect" }), flagEnabled: true })).toMatchObject({
      selection: "blocked_or_excluded",
      reason: "legacy_or_stale_blocked",
      model: null,
    });
    expect(selectExpectedGamesModelForProjectionRow({ playerId: "excluded", readinessRow: row("excluded", { status: "excluded_from_flag_pool" }), flagEnabled: true })).toMatchObject({
      selection: "blocked_or_excluded",
      reason: "excluded_or_blocked",
    });
  });

  it("preserves blocked readiness status before category protections", () => {
    expect(selectExpectedGamesModelForProjectionRow({
      playerId: "blocked-k",
      position: "K",
      readinessRow: row("blocked-k", { position: "K", status: "blocked_from_flag_pool" }),
      flagEnabled: true,
    })).toMatchObject({
      selection: "blocked_or_excluded",
      reason: "excluded_or_blocked",
    });
    expect(selectExpectedGamesModelForProjectionRow({
      playerId: "blocked-critical",
      criticalMovement: true,
      readinessRow: row("blocked-critical", { status: "blocked_from_flag_pool", criticalMovement: true }),
      flagEnabled: true,
    })).toMatchObject({
      selection: "blocked_or_excluded",
      reason: "excluded_or_blocked",
    });
  });

  it("preserves explicit current-path readiness status before stale metadata", () => {
    expect(selectExpectedGamesModelForProjectionRow({
      playerId: "current-stale",
      readinessRow: row("current-stale", {
        status: "would_use_current_path_under_flag",
        universeEligibilityStatus: "stale_historical_signal",
      }),
      flagEnabled: true,
    })).toMatchObject({
      selection: "current_path",
      reason: "current_path_protected",
    });
  });

  it("loads readiness artifacts only when the report is ready", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "blackbird-v82-flag-"));
    const readyPath = path.join(dir, "ready.json");
    const blockedPath = path.join(dir, "blocked.json");
    writeFileSync(readyPath, JSON.stringify(report([row("p1")])), "utf8");
    writeFileSync(blockedPath, JSON.stringify({ ...report([row("p1")]), recommendation: "feature_flag_readiness_blocked" }), "utf8");

    expect(loadV82FeatureFlagReadinessRows({ projectionSeason: 2026, artifactPath: path.join(dir, "missing.json") })).toBeNull();
    expect(loadV82FeatureFlagReadinessRows({ projectionSeason: 2026, artifactPath: blockedPath })).toBeNull();
    expect(loadV82FeatureFlagReadinessRows({ projectionSeason: 2026, artifactPath: readyPath })?.get("p1")?.status).toBe("would_use_v8_2_under_flag");
  });

  it("does not import live mutation, ranking, suggestion, or UI paths", () => {
    const source = readFileSync(path.join(process.cwd(), "src", "lib", "projections", "feature-flags.ts"), "utf8");

    expect(source).not.toContain("@supabase");
    expect(source).not.toContain("createClient");
    expect(source).not.toContain("blackbird-league-rank");
    expect(source).not.toContain("live-draft-suggestion");
    expect(source).not.toContain("draft-war-room");
    expect(source).not.toContain("src/components");
  });
});

function row(playerId: string, overrides: Partial<ProjectionV82FeatureFlagReadinessRow> = {}): ProjectionV82FeatureFlagReadinessRow {
  return {
    playerId,
    player: playerId,
    position: "RB",
    team: "TST",
    status: "would_use_v8_2_under_flag",
    protectionReasons: ["eligible_for_flag_candidate"],
    universeEligibilityStatus: "active_plausible",
    finalClassification: "eligible_for_projection_promotion",
    currentExpectedGames: 10,
    v82ExpectedGames: 11,
    gamesDelta: 1,
    currentProjectedTotal: 100,
    v82ProjectedTotal: 105,
    projectedPointDelta: 5,
    movementBucket: "5-10",
    criticalMovement: false,
    meaningfulRankMover: false,
    riskFlags: [],
    reasonCodes: [],
    ...overrides,
  };
}

function report(rows: ProjectionV82FeatureFlagReadinessRow[]): ProjectionV82FeatureFlagReadinessReport {
  return {
    generatedAt: "2026-06-17T00:00:00.000Z",
    dryRun: true,
    readOnly: true,
    projectionSeason: 2026,
    includeIdp: true,
    sourceArtifacts: { finalReadiness: "", conservativePromotionDecisions: "", conservativeTierDecisions: "", resolvedTierDecisions: "", tierReview: "", limitedPromotionPoolReview: "", shadow: "", universeEligibilityAudit: "", snapshot: "" },
    rows,
    summary: { totalRows: rows.length, wouldUseV82UnderFlag: rows.length, wouldUseCurrentPathUnderFlag: 0, excludedFromFlagPool: 0, blockedFromFlagPool: 0, manualReviewRowsRemaining: 0, unresolvedRowsRemaining: 0, kRowsUsingV82: 0, criticalMovementRowsUsingV82: 0, meaningfulRankMoversUsingV82: 0, legacyRowsUsingV82: 0 },
    impactSummary: { rows: rows.length, averageProjectedPointDelta: 5, medianProjectedPointDelta: 5, maxProjectedPointDelta: 5, movementBuckets: { "5-10": rows.length }, positionSummary: [], cohortSummary: [], topMovements: rows },
    currentPathProtectionSummary: { eligible_for_flag_candidate: 0, critical_movement_protected: 0, kicker_policy_protected: 0, tier_review_protected: 0, qb_superflex_protected: 0, injury_role_protected: 0, model_policy_protected: 0, shadow_only: 0, blocked_legacy: 0, blocked_other: 0, manual_review_remaining: 0, unresolved_tier_decision: 0, missing_readiness_row: 0 },
    safetyGates: [],
    recommendation: "ready_for_disabled_feature_flag_scaffold",
    notes: [],
  };
}
