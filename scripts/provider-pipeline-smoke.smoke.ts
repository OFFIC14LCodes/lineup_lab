import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { mockAdapter } from "@/lib/providers/adapters/mock-adapter";
import type {
  AdapterInjuryRecord,
  AdapterProjectionRecord,
  AdapterSeasonStatsRecord,
  AdapterWeeklyStatsRecord
} from "@/lib/providers/adapters/types";
import {
  ExternalIdMappingConflictError,
  getPlayerByExternalId,
  markMappingVerified,
  upsertExternalIdMapping
} from "@/lib/providers/external-ids";
import { createProviderOrchestrationDependencies } from "@/lib/providers/orchestration/identity-lookups";
import { executeIngestionPlan } from "@/lib/providers/orchestration/execution";
import {
  planInjuryIngestion,
  planProjectionIngestion,
  planSeasonStatsIngestion,
  planWeeklyStatsIngestion
} from "@/lib/providers/orchestration/planning";
import { type DatasetIngestionPlan } from "@/lib/providers/orchestration/types";
import { getCurrentInjuryForPlayer, getInjuryHistoryForPlayer } from "@/lib/providers/repositories/injuries";
import { getProjectionForPlayer } from "@/lib/providers/repositories/projections";
import { getSeasonStatsForPlayer } from "@/lib/providers/repositories/season-stats";
import { ProviderRepositoryError } from "@/lib/providers/repositories/shared";
import { getWeeklyStatsForPlayer } from "@/lib/providers/repositories/weekly-stats";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequiredEnv } from "@/lib/env";

loadEnvConfig(process.cwd());
loadLocalEnvFallback();

type SmokePlayer = {
  id: string;
  full_name: string | null;
  team: string | null;
  position_group: string | null;
};

type CleanupContext = {
  authUserId: string | null;
  externalMappings: Array<{ provider: string; externalId: string }>;
  providerExternalIds: Array<{ provider: string; providerExternalId: string }>;
};

type PlayerSelection = {
  offense: SmokePlayer | null;
  idp: SmokePlayer | null;
  defense: SmokePlayer | null;
  conflict: SmokePlayer | null;
};

const CURRENT_SEASON = new Date().getUTCFullYear();

describe.sequential("provider pipeline smoke test", () => {
  it("verifies the provider-neutral pipeline against the configured Supabase project", async () => {
    console.warn("This smoke test writes temporary rows to the configured Supabase project and cleans up only its own marker-tagged rows.");

    const admin = createAdminClient();
    const deps = createProviderOrchestrationDependencies();
    const marker = `smoke_test_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const cleanup: CleanupContext = {
      authUserId: null,
      externalMappings: [],
      providerExternalIds: []
    };

    await assertTablesExist(admin, [
      "player_external_ids",
      "player_weekly_stats",
      "player_season_stats",
      "player_projections",
      "player_injuries"
    ]);

    const players = await selectSmokePlayers(admin);
    if (!players.offense) {
      throw new Error("Smoke test requires at least one active offensive player in public.players.");
    }
    if (!players.conflict) {
      throw new Error("Smoke test requires a second player row for conflict verification.");
    }

    console.info(
      JSON.stringify(
        {
          marker,
          selectedPlayers: {
            offense: summarizePlayer(players.offense),
            idp: summarizePlayer(players.idp),
            defense: summarizePlayer(players.defense),
            conflict: summarizePlayer(players.conflict)
          }
        },
        null,
        2
      )
    );

    const auth = await createAuthenticatedHarness(marker);
    cleanup.authUserId = auth.userId;

    let testFailure: unknown = null;

    try {
      await verifyAuthenticatedReadAccess(auth.client);
      await verifyAuthenticatedWriteDenied(auth.client, players.offense.id, marker);

      const manualExternalId = `${marker}_manual_${players.offense.id.slice(0, 8)}`;
      cleanup.externalMappings.push({ provider: "manual", externalId: manualExternalId });
      cleanup.providerExternalIds.push({ provider: "manual", providerExternalId: manualExternalId });

      const mapping = await upsertExternalIdMapping(
        {
          player_id: players.offense.id,
          provider: "manual",
          external_id: manualExternalId,
          external_type: "player",
          team: players.offense.team,
          position_group: players.offense.position_group,
          mapping_status: "unverified",
          mapping_method: "manual",
          confidence: 1,
          metadata_json: { smoke_test_marker: marker }
        },
        admin
      );

      await markMappingVerified(
        mapping.id,
        {
          confidence: 1,
          mappingMethod: "manual",
          metadata: { smoke_test_marker: marker }
        },
        admin
      );

      const resolved = await getPlayerByExternalId(
        {
          provider: "manual",
          externalId: manualExternalId,
          externalType: "player"
        },
        admin
      );
      expect(resolved?.mapping.player_id).toBe(players.offense.id);
      expect(resolved?.player?.id).toBe(players.offense.id);

      const authMappingRead = await (auth.client as any)
        .from("player_external_ids")
        .select("id,player_id")
        .eq("provider", "manual")
        .eq("external_id", manualExternalId)
        .single();
      expect(authMappingRead.error).toBeNull();
      expect((authMappingRead.data as { player_id: string } | null)?.player_id).toBe(players.offense.id);

      await expect(
        upsertExternalIdMapping(
          {
            player_id: players.conflict.id,
            provider: "manual",
            external_id: manualExternalId,
            external_type: "player",
            team: players.conflict.team,
            position_group: players.conflict.position_group,
            mapping_status: "unverified",
            mapping_method: "manual",
            confidence: 1,
            metadata_json: { smoke_test_marker: marker, conflict_probe: true }
          },
          admin
        )
      ).rejects.toBeInstanceOf(ExternalIdMappingConflictError);

      const weeklyGamePlan = await planWeeklyStatsIngestion(
        normalizeWeeklyStats([
          {
            providerExternalId: manualExternalId,
            fullName: players.offense.full_name,
            team: players.offense.team,
            position: players.offense.position_group,
            season: CURRENT_SEASON,
            week: 1,
            seasonType: "regular",
            gameId: `${marker}_game_1`,
            opponent: "GB",
            homeAway: "home",
            gameDate: `${CURRENT_SEASON}-09-10T00:00:00.000Z`,
            stats: { receiving_yards: 88, receptions: 6 },
            providerFantasyPoints: 18.8,
            sourceUpdatedAt: `${CURRENT_SEASON}-09-10T12:00:00.000Z`,
            sourceRecordId: `${marker}_weekly_game_v1`,
            metadata: { smoke_test_marker: marker }
          }
        ]),
        [],
        deps,
        { allowCandidateMatching: false, requireVerifiedExternalMapping: true }
      );
      assertReadyPlan(weeklyGamePlan, "weekly stats with game");
      await executeIngestionPlan(weeklyGamePlan, deps);

      let weeklyGameRows = await getWeeklyStatsForPlayer(
        { playerId: players.offense.id, season: CURRENT_SEASON, week: 1, provider: "manual" },
        admin
      );
      weeklyGameRows = weeklyGameRows.filter((row) => row.provider_external_id === manualExternalId);
      expect(weeklyGameRows).toHaveLength(1);
      const weeklyGameRowId = weeklyGameRows[0].id;
      expect(weeklyGameRows[0].stats_json.receiving_yards).toBe(88);

      const weeklyGameCorrectionPlan = await planWeeklyStatsIngestion(
        normalizeWeeklyStats([
          {
            providerExternalId: manualExternalId,
            fullName: players.offense.full_name,
            team: players.offense.team,
            position: players.offense.position_group,
            season: CURRENT_SEASON,
            week: 1,
            seasonType: "regular",
            gameId: `${marker}_game_1`,
            opponent: "GB",
            homeAway: "home",
            gameDate: `${CURRENT_SEASON}-09-10T00:00:00.000Z`,
            stats: { receiving_yards: 96, receptions: 7 },
            providerFantasyPoints: 21.1,
            sourceUpdatedAt: `${CURRENT_SEASON}-09-10T13:00:00.000Z`,
            sourceRecordId: `${marker}_weekly_game_v2`,
            metadata: { smoke_test_marker: marker }
          }
        ]),
        [],
        deps,
        { allowCandidateMatching: false, requireVerifiedExternalMapping: true }
      );
      assertReadyPlan(weeklyGameCorrectionPlan, "weekly stats with game correction");
      await executeIngestionPlan(weeklyGameCorrectionPlan, deps);

      weeklyGameRows = await getWeeklyStatsForPlayer(
        { playerId: players.offense.id, season: CURRENT_SEASON, week: 1, provider: "manual" },
        admin
      );
      weeklyGameRows = weeklyGameRows.filter((row) => row.provider_external_id === manualExternalId);
      expect(weeklyGameRows).toHaveLength(1);
      expect(weeklyGameRows[0].id).toBe(weeklyGameRowId);
      expect(weeklyGameRows[0].stats_json.receiving_yards).toBe(96);

      const weeklyNoGamePlan = await planWeeklyStatsIngestion(
        normalizeWeeklyStats([
          {
            providerExternalId: manualExternalId,
            fullName: players.offense.full_name,
            team: players.offense.team,
            position: players.offense.position_group,
            season: CURRENT_SEASON,
            week: 2,
            seasonType: "regular",
            stats: { receiving_yards: 44, receptions: 4 },
            providerFantasyPoints: 10.4,
            sourceUpdatedAt: `${CURRENT_SEASON}-09-17T12:00:00.000Z`,
            sourceRecordId: `${marker}_weekly_nogame_v1`,
            metadata: { smoke_test_marker: marker }
          }
        ]),
        [],
        deps,
        { allowCandidateMatching: false, requireVerifiedExternalMapping: true }
      );
      assertReadyPlan(weeklyNoGamePlan, "weekly stats without game");
      await executeIngestionPlan(weeklyNoGamePlan, deps);

      let weeklyNoGameRows = await getWeeklyStatsForPlayer(
        { playerId: players.offense.id, season: CURRENT_SEASON, week: 2, provider: "manual" },
        admin
      );
      weeklyNoGameRows = weeklyNoGameRows.filter((row) => row.provider_external_id === manualExternalId);
      expect(weeklyNoGameRows).toHaveLength(1);
      const weeklyNoGameRowId = weeklyNoGameRows[0].id;

      const weeklyNoGameCorrectionPlan = await planWeeklyStatsIngestion(
        normalizeWeeklyStats([
          {
            providerExternalId: manualExternalId,
            fullName: players.offense.full_name,
            team: players.offense.team,
            position: players.offense.position_group,
            season: CURRENT_SEASON,
            week: 2,
            seasonType: "regular",
            stats: { receiving_yards: 51, receptions: 5 },
            providerFantasyPoints: 12.1,
            sourceUpdatedAt: `${CURRENT_SEASON}-09-17T13:00:00.000Z`,
            sourceRecordId: `${marker}_weekly_nogame_v2`,
            metadata: { smoke_test_marker: marker }
          }
        ]),
        [],
        deps,
        { allowCandidateMatching: false, requireVerifiedExternalMapping: true }
      );
      assertReadyPlan(weeklyNoGameCorrectionPlan, "weekly stats without game correction");
      await executeIngestionPlan(weeklyNoGameCorrectionPlan, deps);

      weeklyNoGameRows = await getWeeklyStatsForPlayer(
        { playerId: players.offense.id, season: CURRENT_SEASON, week: 2, provider: "manual" },
        admin
      );
      weeklyNoGameRows = weeklyNoGameRows.filter((row) => row.provider_external_id === manualExternalId);
      expect(weeklyNoGameRows).toHaveLength(1);
      expect(weeklyNoGameRows[0].id).toBe(weeklyNoGameRowId);
      expect(weeklyNoGameRows[0].stats_json.receiving_yards).toBe(51);

      const seasonStatsPlan = await planSeasonStatsIngestion(
        normalizeSeasonStats([
          {
            providerExternalId: manualExternalId,
            fullName: players.offense.full_name,
            team: players.offense.team,
            position: players.offense.position_group,
            season: CURRENT_SEASON,
            seasonType: "regular",
            gamesPlayed: 2,
            gamesStarted: 2,
            stats: { receiving_yards: 147, receptions: 12 },
            providerFantasyPoints: 30.9,
            sourceUpdatedAt: `${CURRENT_SEASON}-09-18T12:00:00.000Z`,
            sourceRecordId: `${marker}_season_v1`,
            metadata: { smoke_test_marker: marker }
          }
        ]),
        [],
        deps,
        { allowCandidateMatching: false, requireVerifiedExternalMapping: true }
      );
      assertReadyPlan(seasonStatsPlan, "season stats");
      await executeIngestionPlan(seasonStatsPlan, deps);

      let seasonRows = await getSeasonStatsForPlayer(
        { playerId: players.offense.id, season: CURRENT_SEASON, provider: "manual", seasonType: "regular" },
        admin
      );
      seasonRows = seasonRows.filter((row) => row.provider_external_id === manualExternalId);
      expect(seasonRows).toHaveLength(1);
      const seasonRowId = seasonRows[0].id;

      const seasonStatsCorrectionPlan = await planSeasonStatsIngestion(
        normalizeSeasonStats([
          {
            providerExternalId: manualExternalId,
            fullName: players.offense.full_name,
            team: players.offense.team,
            position: players.offense.position_group,
            season: CURRENT_SEASON,
            seasonType: "regular",
            gamesPlayed: 2,
            gamesStarted: 2,
            stats: { receiving_yards: 156, receptions: 13 },
            providerFantasyPoints: 33.4,
            sourceUpdatedAt: `${CURRENT_SEASON}-09-18T13:00:00.000Z`,
            sourceRecordId: `${marker}_season_v2`,
            metadata: { smoke_test_marker: marker }
          }
        ]),
        [],
        deps,
        { allowCandidateMatching: false, requireVerifiedExternalMapping: true }
      );
      assertReadyPlan(seasonStatsCorrectionPlan, "season stats correction");
      await executeIngestionPlan(seasonStatsCorrectionPlan, deps);

      seasonRows = await getSeasonStatsForPlayer(
        { playerId: players.offense.id, season: CURRENT_SEASON, provider: "manual", seasonType: "regular" },
        admin
      );
      seasonRows = seasonRows.filter((row) => row.provider_external_id === manualExternalId);
      expect(seasonRows).toHaveLength(1);
      expect(seasonRows[0].id).toBe(seasonRowId);
      expect(seasonRows[0].stats_json.receiving_yards).toBe(156);

      const weeklyProjectionPlan = await planProjectionIngestion(
        normalizeProjections([
          {
            providerExternalId: manualExternalId,
            fullName: players.offense.full_name,
            team: players.offense.team,
            position: players.offense.position_group,
            season: CURRENT_SEASON,
            week: 3,
            seasonType: "regular",
            projectionType: "weekly",
            scoringFormat: "ppr",
            opponent: "CHI",
            stats: { receiving_yards: 72, receptions: 5 },
            providerFantasyPoints: 16.2,
            sourceUpdatedAt: `${CURRENT_SEASON}-09-24T12:00:00.000Z`,
            sourceRecordId: `${marker}_projection_weekly_v1`,
            metadata: { smoke_test_marker: marker }
          }
        ]),
        [],
        deps,
        { allowCandidateMatching: false, requireVerifiedExternalMapping: true }
      );
      assertReadyPlan(weeklyProjectionPlan, "weekly projection");
      await executeIngestionPlan(weeklyProjectionPlan, deps);

      let weeklyProjectionRows = await getProjectionForPlayer(
        {
          playerId: players.offense.id,
          season: CURRENT_SEASON,
          week: 3,
          provider: "manual",
          projectionType: "weekly",
          scoringFormat: "ppr",
          version: "current"
        },
        admin
      );
      weeklyProjectionRows = weeklyProjectionRows.filter((row) => row.provider_external_id === manualExternalId);
      expect(weeklyProjectionRows).toHaveLength(1);
      const weeklyProjectionRowId = weeklyProjectionRows[0].id;

      const weeklyProjectionCorrectionPlan = await planProjectionIngestion(
        normalizeProjections([
          {
            providerExternalId: manualExternalId,
            fullName: players.offense.full_name,
            team: players.offense.team,
            position: players.offense.position_group,
            season: CURRENT_SEASON,
            week: 3,
            seasonType: "regular",
            projectionType: "weekly",
            scoringFormat: "ppr",
            opponent: "CHI",
            stats: { receiving_yards: 79, receptions: 6 },
            providerFantasyPoints: 18.1,
            sourceUpdatedAt: `${CURRENT_SEASON}-09-24T13:00:00.000Z`,
            sourceRecordId: `${marker}_projection_weekly_v2`,
            metadata: { smoke_test_marker: marker }
          }
        ]),
        [],
        deps,
        { allowCandidateMatching: false, requireVerifiedExternalMapping: true }
      );
      assertReadyPlan(weeklyProjectionCorrectionPlan, "weekly projection correction");
      await executeIngestionPlan(weeklyProjectionCorrectionPlan, deps);

      weeklyProjectionRows = await getProjectionForPlayer(
        {
          playerId: players.offense.id,
          season: CURRENT_SEASON,
          week: 3,
          provider: "manual",
          projectionType: "weekly",
          scoringFormat: "ppr",
          version: "current"
        },
        admin
      );
      weeklyProjectionRows = weeklyProjectionRows.filter((row) => row.provider_external_id === manualExternalId);
      expect(weeklyProjectionRows).toHaveLength(1);
      expect(weeklyProjectionRows[0].id).toBe(weeklyProjectionRowId);
      expect(weeklyProjectionRows[0].provider_fantasy_points).toBe(18.1);

      const seasonProjectionPlan = await planProjectionIngestion(
        normalizeProjections([
          {
            providerExternalId: manualExternalId,
            fullName: players.offense.full_name,
            team: players.offense.team,
            position: players.offense.position_group,
            season: CURRENT_SEASON,
            seasonType: "regular",
            projectionType: "season",
            scoringFormat: "ppr",
            stats: { receiving_yards: 1120, receptions: 91 },
            providerFantasyPoints: 248.4,
            sourceUpdatedAt: `${CURRENT_SEASON}-09-24T12:30:00.000Z`,
            sourceRecordId: `${marker}_projection_season_v1`,
            metadata: { smoke_test_marker: marker }
          }
        ]),
        [],
        deps,
        { allowCandidateMatching: false, requireVerifiedExternalMapping: true }
      );
      assertReadyPlan(seasonProjectionPlan, "season projection");
      await executeIngestionPlan(seasonProjectionPlan, deps);

      let seasonProjectionRows = await getProjectionForPlayer(
        {
          playerId: players.offense.id,
          season: CURRENT_SEASON,
          week: null,
          provider: "manual",
          projectionType: "season",
          scoringFormat: "ppr",
          version: "current"
        },
        admin
      );
      seasonProjectionRows = seasonProjectionRows.filter((row) => row.provider_external_id === manualExternalId);
      expect(seasonProjectionRows).toHaveLength(1);
      const seasonProjectionRowId = seasonProjectionRows[0].id;

      const seasonProjectionCorrectionPlan = await planProjectionIngestion(
        normalizeProjections([
          {
            providerExternalId: manualExternalId,
            fullName: players.offense.full_name,
            team: players.offense.team,
            position: players.offense.position_group,
            season: CURRENT_SEASON,
            seasonType: "regular",
            projectionType: "season",
            scoringFormat: "ppr",
            stats: { receiving_yards: 1140, receptions: 93 },
            providerFantasyPoints: 254.8,
            sourceUpdatedAt: `${CURRENT_SEASON}-09-24T13:30:00.000Z`,
            sourceRecordId: `${marker}_projection_season_v2`,
            metadata: { smoke_test_marker: marker }
          }
        ]),
        [],
        deps,
        { allowCandidateMatching: false, requireVerifiedExternalMapping: true }
      );
      assertReadyPlan(seasonProjectionCorrectionPlan, "season projection correction");
      await executeIngestionPlan(seasonProjectionCorrectionPlan, deps);

      seasonProjectionRows = await getProjectionForPlayer(
        {
          playerId: players.offense.id,
          season: CURRENT_SEASON,
          week: null,
          provider: "manual",
          projectionType: "season",
          scoringFormat: "ppr",
          version: "current"
        },
        admin
      );
      seasonProjectionRows = seasonProjectionRows.filter((row) => row.provider_external_id === manualExternalId);
      expect(seasonProjectionRows).toHaveLength(1);
      expect(seasonProjectionRows[0].id).toBe(seasonProjectionRowId);
      expect(seasonProjectionRows[0].provider_fantasy_points).toBe(254.8);

      const injuryAppendPlan = await planInjuryIngestion(
        normalizeInjuries([
          {
            providerExternalId: manualExternalId,
            fullName: players.offense.full_name,
            team: players.offense.team,
            position: players.offense.position_group,
            season: CURRENT_SEASON,
            week: 4,
            status: "questionable",
            practiceStatus: "limited",
            gameStatus: "questionable",
            bodyPart: "hamstring",
            injuryType: "strain",
            description: "Limited in practice",
            expectedReturn: `${CURRENT_SEASON}-10-01`,
            observedAt: `${CURRENT_SEASON}-09-30T12:00:00.000Z`,
            sourceUpdatedAt: `${CURRENT_SEASON}-09-30T12:00:00.000Z`,
            sourceRecordId: `${marker}_injury_v1`,
            isCurrent: true,
            metadata: { smoke_test_marker: marker }
          }
        ]),
        [],
        deps,
        { allowCandidateMatching: false, requireVerifiedExternalMapping: true }
      );
      assertReadyPlan(injuryAppendPlan, "injury append");
      await executeIngestionPlan(injuryAppendPlan, deps);

      let injuryHistory = await getInjuryHistoryForPlayer(
        { playerId: players.offense.id, provider: "manual", season: CURRENT_SEASON },
        admin
      );
      injuryHistory = injuryHistory.filter((row) => row.provider_external_id === manualExternalId);
      expect(injuryHistory).toHaveLength(1);

      const injuryReplacePlan = await planInjuryIngestion(
        normalizeInjuries([
          {
            providerExternalId: manualExternalId,
            fullName: players.offense.full_name,
            team: players.offense.team,
            position: players.offense.position_group,
            season: CURRENT_SEASON,
            week: 4,
            status: "out",
            practiceStatus: "dnp",
            gameStatus: "out",
            bodyPart: "hamstring",
            injuryType: "strain",
            description: "Did not practice",
            expectedReturn: `${CURRENT_SEASON}-10-08`,
            observedAt: `${CURRENT_SEASON}-10-01T12:00:00.000Z`,
            sourceUpdatedAt: `${CURRENT_SEASON}-10-01T12:00:00.000Z`,
            sourceRecordId: `${marker}_injury_v2`,
            isCurrent: true,
            metadata: { smoke_test_marker: marker }
          }
        ]),
        [],
        deps,
        { allowCandidateMatching: false, requireVerifiedExternalMapping: true }
      );
      assertReadyPlan(injuryReplacePlan, "injury replace");
      const replacePrepared = injuryReplacePlan.ready[0]?.prepared;
      if (!replacePrepared || replacePrepared.kind !== "injury") {
        throw new Error("Expected one prepared injury record for replace-current verification.");
      }
      injuryReplacePlan.ready[0] = {
        ...injuryReplacePlan.ready[0],
        prepared: {
          ...replacePrepared,
          executionMode: "replace_current"
        }
      };
      await executeIngestionPlan(injuryReplacePlan, deps);

      injuryHistory = await getInjuryHistoryForPlayer(
        { playerId: players.offense.id, provider: "manual", season: CURRENT_SEASON },
        admin
      );
      injuryHistory = injuryHistory.filter((row) => row.provider_external_id === manualExternalId);
      expect(injuryHistory).toHaveLength(2);
      expect(injuryHistory.filter((row) => row.is_current)).toHaveLength(1);

      const currentInjury = await getCurrentInjuryForPlayer({ playerId: players.offense.id, provider: "manual" }, admin);
      expect(currentInjury?.provider_external_id).toBe(manualExternalId);
      expect(currentInjury?.status).toBe("out");

      const blockedPlan = await planWeeklyStatsIngestion(
        normalizeWeeklyStats([
          {
            providerExternalId: `${marker}_missing_mapping`,
            fullName: players.offense.full_name,
            team: players.offense.team,
            position: players.offense.position_group,
            season: CURRENT_SEASON,
            week: 5,
            seasonType: "regular",
            stats: {},
            sourceRecordId: `${marker}_missing_mapping`,
            metadata: { smoke_test_marker: marker }
          }
        ]),
        [],
        deps,
        { allowCandidateMatching: false, requireVerifiedExternalMapping: true }
      );
      expect(blockedPlan.summary.unresolved).toBe(1);
      await expect(executeIngestionPlan(blockedPlan, deps)).rejects.toBeInstanceOf(ProviderRepositoryError);

      const invalidWeekPlan = await planWeeklyStatsIngestion(
        normalizeWeeklyStats([
          {
            providerExternalId: manualExternalId,
            fullName: players.offense.full_name,
            team: players.offense.team,
            position: players.offense.position_group,
            season: CURRENT_SEASON,
            week: 0,
            stats: {},
            sourceRecordId: `${marker}_invalid_week`
          }
        ]),
        [],
        deps,
        { allowCandidateMatching: false, requireVerifiedExternalMapping: true }
      );
      expect(invalidWeekPlan.summary.rejected).toBe(1);
      expect(invalidWeekPlan.rejected[0]?.code).toBe("IDENTITY_LOOKUP_FAILED");

      const invalidStatNormalization = normalizeWeeklyStatsResult([
        {
          providerExternalId: `${marker}_invalid_stats`,
          fullName: players.offense.full_name,
          team: players.offense.team,
          position: players.offense.position_group,
          season: CURRENT_SEASON,
          week: 6,
          stats: { receiving_yards: Number.POSITIVE_INFINITY },
          sourceRecordId: `${marker}_invalid_stats`
        }
      ]);
      expect(invalidStatNormalization.issues).toHaveLength(1);
    } catch (error) {
      testFailure = error;
      throw error;
    } finally {
      try {
        await cleanupSmokeRows(admin, cleanup);
      } catch (cleanupError) {
        if (testFailure) {
          console.error(
            `Smoke cleanup follow-up failure: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`
          );
        } else {
          throw cleanupError;
        }
      }
    }
  });
});

async function assertTablesExist(admin: ReturnType<typeof createAdminClient>, tables: string[]) {
  for (const table of tables) {
    const { error } = await admin.from(table).select("id").limit(1);
    if (error) {
      throw new Error(`Required table ${table} is not queryable in the configured Supabase project: ${error.message}`);
    }
  }
}

async function selectSmokePlayers(admin: ReturnType<typeof createAdminClient>): Promise<PlayerSelection> {
  const { data, error } = await admin
    .from("players")
    .select("id,full_name,team")
    .eq("active", true)
    .limit(250);

  if (error) {
    throw new Error(`Unable to select smoke-test players: ${error.message}`);
  }

  const players = ((data ?? []) as Array<{
    id: string;
    full_name: string | null;
    team: string | null;
  }>).map((player) => ({
    id: player.id,
    full_name: player.full_name,
    team: player.team,
    position_group: null
  }));
  const offense = players[0] ?? null;
  return {
    offense,
    idp: null,
    defense: null,
    conflict: players.find((player) => player.id !== offense?.id) ?? null
  };
}

function summarizePlayer(player: SmokePlayer | null) {
  if (!player) return null;
  return {
    id: player.id,
    fullName: player.full_name,
    team: player.team,
    positionGroup: player.position_group
  };
}

async function createAuthenticatedHarness(marker: string) {
  const url = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const admin = createAdminClient();
  const email = `${marker}@blackbirdgm.local`;
  const password = `${marker}_Password1!`;
  const client = createSupabaseClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (created.error || !created.data.user) {
    throw new Error(`Unable to create smoke-test auth user: ${created.error?.message ?? "unknown error"}`);
  }

  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) {
    await admin.auth.admin.deleteUser(created.data.user.id);
    throw new Error(`Unable to sign in smoke-test auth user: ${signIn.error.message}`);
  }

  return {
    userId: created.data.user.id,
    client
  };
}

async function verifyAuthenticatedReadAccess(client: any) {
  for (const table of [
    "player_external_ids",
    "player_weekly_stats",
    "player_season_stats",
    "player_projections",
    "player_injuries"
  ]) {
    const { error } = await client.from(table).select("id", { head: true, count: "exact" }).limit(1);
    if (error) {
      throw new Error(`Authenticated select failed for ${table}: ${error.message}`);
    }
  }
}

async function verifyAuthenticatedWriteDenied(client: any, playerId: string, marker: string) {
  const attempt = await client.from("player_external_ids").insert({
    player_id: playerId,
    provider: "manual",
    external_id: `${marker}_auth_write_blocked`,
    external_type: "player",
    mapping_status: "verified"
  });
  if (!attempt.error) {
    throw new Error("Authenticated non-admin client unexpectedly inserted into player_external_ids.");
  }
}

function assertReadyPlan(plan: DatasetIngestionPlan, label: string) {
  expect(plan.summary.ready).toBe(1);
  expect(plan.summary.mappingRequired).toBe(0);
  expect(plan.summary.manualReview).toBe(0);
  expect(plan.summary.unresolved).toBe(0);
  expect(plan.summary.rejected).toBe(0);
  console.info(`${label}: ready=1, blocked=0`);
}

async function cleanupSmokeRows(admin: ReturnType<typeof createAdminClient>, cleanup: CleanupContext) {
  for (const providerExternalId of cleanup.providerExternalIds) {
    for (const table of ["player_injuries", "player_projections", "player_season_stats", "player_weekly_stats"]) {
      const { error } = await admin
        .from(table)
        .delete()
        .eq("provider", providerExternalId.provider)
        .eq("provider_external_id", providerExternalId.providerExternalId);
      if (error) {
        throw new Error(`Smoke cleanup failed for ${table} ${providerExternalId.providerExternalId}: ${error.message}`);
      }
    }
  }

  for (const mapping of cleanup.externalMappings) {
    const { error } = await admin
      .from("player_external_ids")
      .delete()
      .eq("provider", mapping.provider)
      .eq("external_id", mapping.externalId);
    if (error) {
      throw new Error(`Smoke cleanup failed for player_external_ids ${mapping.externalId}: ${error.message}`);
    }
  }

  for (const providerExternalId of cleanup.providerExternalIds) {
    for (const table of ["player_injuries", "player_projections", "player_season_stats", "player_weekly_stats"]) {
      await assertTableCount(admin, table, providerExternalId.provider, providerExternalId.providerExternalId, 0);
    }
  }

  for (const mapping of cleanup.externalMappings) {
    const { count, error } = await admin
      .from("player_external_ids")
      .select("id", { head: true, count: "exact" })
      .eq("provider", mapping.provider)
      .eq("external_id", mapping.externalId);
    if (error) {
      throw new Error(`Smoke cleanup verification failed for player_external_ids ${mapping.externalId}: ${error.message}`);
    }
    expect(count ?? 0).toBe(0);
  }

  if (cleanup.authUserId) {
    const deleted = await admin.auth.admin.deleteUser(cleanup.authUserId);
    if (deleted.error) {
      throw new Error(`Smoke cleanup failed for auth user ${cleanup.authUserId}: ${deleted.error.message}`);
    }
  }
}

async function assertTableCount(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  provider: string,
  providerExternalId: string,
  expectedCount: number
) {
  const { count, error } = await admin
    .from(table)
    .select("id", { head: true, count: "exact" })
    .eq("provider", provider)
    .eq("provider_external_id", providerExternalId);
  if (error) {
    throw new Error(`Smoke cleanup verification failed for ${table} ${providerExternalId}: ${error.message}`);
  }
  expect(count ?? 0).toBe(expectedCount);
}

function normalizeWeeklyStats(input: unknown[]) {
  return unwrapNormalization<AdapterWeeklyStatsRecord>(mockAdapter.normalizeWeeklyStats?.(input), "weekly stats").records;
}

function normalizeWeeklyStatsResult(input: unknown[]) {
  return unwrapNormalization<AdapterWeeklyStatsRecord>(mockAdapter.normalizeWeeklyStats?.(input), "weekly stats");
}

function normalizeSeasonStats(input: unknown[]) {
  return unwrapNormalization<AdapterSeasonStatsRecord>(mockAdapter.normalizeSeasonStats?.(input), "season stats").records;
}

function normalizeProjections(input: unknown[]) {
  return unwrapNormalization<AdapterProjectionRecord>(mockAdapter.normalizeProjections?.(input), "projections").records;
}

function normalizeInjuries(input: unknown[]) {
  return unwrapNormalization<AdapterInjuryRecord>(mockAdapter.normalizeInjuries?.(input), "injuries").records;
}

function unwrapNormalization<T>(
  result:
    | { records: T[]; issues: unknown[] }
    | { supported: false; message: string }
    | undefined,
  label: string
): { records: T[]; issues: unknown[] } {
  if (!result) {
    throw new Error(`Mock adapter does not expose ${label} normalization.`);
  }
  if ("supported" in result && result.supported === false) {
    throw new Error(`Mock adapter does not support ${label}: ${result.message}`);
  }
  return result as { records: T[]; issues: unknown[] };
}

function loadLocalEnvFallback() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    return;
  }

  const contents = readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}
