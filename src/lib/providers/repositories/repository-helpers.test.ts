import { describe, expect, it } from "vitest";

import type { PlayerWeeklyStatsInsert } from "@/lib/providers/data-types";
import {
  buildInjuryDedupeKey,
  buildProjectionScope,
  buildSeasonStatsScope,
  buildWeeklyStatsConflictScope,
  normalizeListQueryOptions,
  planCurrentInjuryTransition,
  validateBatchPlan,
  verifyExternalMappingDecision
} from "@/lib/providers/repositories/repository-helpers";

const PLAYER_ID = "11111111-1111-4111-8111-111111111111";

describe("repository helpers", () => {
  it("builds weekly conflict scope with game_id", () => {
    expect(
      buildWeeklyStatsConflictScope({
        player_id: PLAYER_ID,
        provider: "sportsdataio",
        season: 2026,
        week: 3,
        season_type: "regular",
        game_id: "game-1",
        stats_json: {}
      })
    ).toMatchObject({ mode: "with_game", gameId: "game-1" });
  });

  it("builds weekly conflict scope without game_id and separates postseason", () => {
    const regular = buildWeeklyStatsConflictScope({
      player_id: PLAYER_ID,
      provider: "sportsdataio",
      season: 2026,
      week: 1,
      season_type: "regular",
      stats_json: {}
    });
    const postseason = buildWeeklyStatsConflictScope({
      player_id: PLAYER_ID,
      provider: "sportsdataio",
      season: 2026,
      week: 1,
      season_type: "postseason",
      stats_json: {}
    });

    expect(regular).toMatchObject({ mode: "without_game", seasonType: "regular" });
    expect(postseason).toMatchObject({ mode: "without_game", seasonType: "postseason" });
    expect(JSON.stringify(regular)).not.toBe(JSON.stringify(postseason));
  });

  it("detects duplicate logical weekly rows in batch validation", () => {
    const duplicateRows: PlayerWeeklyStatsInsert[] = [
      { player_id: PLAYER_ID, provider: "sportsdataio", season: 2026, week: 4, season_type: "regular", stats_json: {} },
      { player_id: PLAYER_ID, provider: "sportsdataio", season: 2026, week: 4, season_type: "regular", stats_json: {} }
    ];

    expect(() =>
      validateBatchPlan(duplicateRows, (row) => JSON.stringify(buildWeeklyStatsConflictScope(row)))
    ).toThrow("Duplicate logical row");
  });

  it("builds stable season stats scope for provider corrections", () => {
    expect(
      buildSeasonStatsScope({
        player_id: PLAYER_ID,
        provider: "nflverse",
        season: 2025,
        season_type: "regular",
        stats_json: {}
      })
    ).toEqual({
      playerId: PLAYER_ID,
      provider: "nflverse",
      season: 2025,
      seasonType: "regular"
    });
  });

  it("builds weekly and season projection scopes correctly", () => {
    expect(
      buildProjectionScope({
        player_id: PLAYER_ID,
        provider: "sportsdataio",
        season: 2026,
        week: 8,
        projection_type: "weekly",
        stats_json: {}
      })
    ).toMatchObject({ mode: "weekly", week: 8, version: "current" });

    expect(
      buildProjectionScope({
        player_id: PLAYER_ID,
        provider: "sportsdataio",
        season: 2026,
        week: null,
        projection_type: "rest_of_season",
        scoring_format: "ppr",
        version: "v2",
        stats_json: {}
      })
    ).toMatchObject({ mode: "non_weekly", projectionType: "rest_of_season", scoringFormat: "ppr", version: "v2" });
  });

  it("plans current injury transition per provider/player without cross-provider overwrite", () => {
    const plan = planCurrentInjuryTransition({
      playerId: PLAYER_ID,
      provider: "sportsdataio",
      existingCurrentRows: [
        { id: "one", player_id: PLAYER_ID, provider: "sportsdataio", is_current: true },
        { id: "two", player_id: PLAYER_ID, provider: "fantasydata", is_current: true }
      ]
    });

    expect(plan.rowsToDeactivate).toEqual(["one"]);
  });

  it("recognizes duplicate injury observations when source_updated_at exists", () => {
    expect(
      buildInjuryDedupeKey({
        player_id: PLAYER_ID,
        provider: "sportsdataio",
        source_updated_at: "2026-09-10T10:00:00.000Z",
        status: "Questionable"
      })
    ).toMatchObject({
      playerId: PLAYER_ID,
      provider: "sportsdataio",
      sourceUpdatedAt: "2026-09-10T10:00:00.000Z"
    });
  });

  it("accepts matching external mappings, rejects conflicts, and allows null external ids", () => {
    expect(
      verifyExternalMappingDecision({
        playerId: PLAYER_ID,
        provider: "sportsdataio",
        providerExternalId: "abc",
        requireVerifiedMapping: true,
        matches: [{ player_id: PLAYER_ID, external_type: "player" }]
      })
    ).toMatchObject({ ok: true });

    expect(
      verifyExternalMappingDecision({
        playerId: PLAYER_ID,
        provider: "sportsdataio",
        providerExternalId: "abc",
        requireVerifiedMapping: true,
        matches: [{ player_id: "22222222-2222-4222-8222-222222222222", external_type: "player" }]
      })
    ).toMatchObject({ ok: false, code: "mapping_conflict" });

    expect(
      verifyExternalMappingDecision({
        playerId: PLAYER_ID,
        provider: "sportsdataio",
        providerExternalId: null,
        requireVerifiedMapping: true,
        matches: []
      })
    ).toMatchObject({ ok: true });
  });

  it("enforces mapping-required behavior and query safety caps", () => {
    expect(
      verifyExternalMappingDecision({
        playerId: PLAYER_ID,
        provider: "sportsdataio",
        providerExternalId: "abc",
        requireVerifiedMapping: false,
        matches: []
      })
    ).toMatchObject({ ok: true });

    expect(
      verifyExternalMappingDecision({
        playerId: PLAYER_ID,
        provider: "sportsdataio",
        providerExternalId: "abc",
        requireVerifiedMapping: true,
        matches: []
      })
    ).toMatchObject({ ok: false, code: "mapping_required" });

    expect(normalizeListQueryOptions({ limit: 500, offset: 2 })).toEqual({ limit: 100, offset: 2 });
    expect(() => normalizeListQueryOptions({ limit: 0 })).toThrow("limit");
    expect(() => validateBatchPlan(new Array(251).fill({}), (row) => JSON.stringify(row))).toThrow("maximum");
  });
});
