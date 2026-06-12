import { describe, expect, it, vi } from "vitest";

import type { IdentityLookupDependencies } from "@/lib/providers/orchestration/dependencies";
import { planInjuryIngestion, planProjectionIngestion, planSeasonStatsIngestion, planWeeklyStatsIngestion } from "@/lib/providers/orchestration/planning";
import type { AdapterInjuryRecord, AdapterProjectionRecord, AdapterSeasonStatsRecord, AdapterWeeklyStatsRecord } from "@/lib/providers/adapters/types";

const PLAYER_ID = "11111111-1111-4111-8111-111111111111";

function weeklyRecord(overrides: Partial<AdapterWeeklyStatsRecord> = {}): AdapterWeeklyStatsRecord {
  return {
    kind: "weekly_stats",
    provider: "manual",
    providerExternalId: overrides.providerExternalId ?? "ext-1",
    externalType: overrides.externalType ?? "player",
    fullName: overrides.fullName ?? "Player One",
    firstName: overrides.firstName ?? null,
    lastName: overrides.lastName ?? null,
    team: "team" in overrides ? (overrides.team ?? null) : "ATL",
    rawPosition: overrides.rawPosition ?? "WR",
    positionGroup: overrides.positionGroup ?? "WR",
    season: overrides.season ?? 2026,
    week: overrides.week ?? 1,
    seasonType: overrides.seasonType ?? "regular",
    gameId: overrides.gameId ?? null,
    opponent: overrides.opponent ?? null,
    homeAway: overrides.homeAway ?? null,
    gameDate: overrides.gameDate ?? null,
    stats: overrides.stats ?? { receiving_yards: 80 },
    providerFantasyPoints: overrides.providerFantasyPoints ?? null,
    dataVersion: overrides.dataVersion ?? null,
    sourceUpdatedAt: overrides.sourceUpdatedAt ?? null,
    sourceRecordId: overrides.sourceRecordId ?? "src-1",
    metadata: overrides.metadata ?? {}
  };
}

function seasonRecord(overrides: Partial<AdapterSeasonStatsRecord> = {}): AdapterSeasonStatsRecord {
  return {
    kind: "season_stats",
    provider: "manual",
    providerExternalId: overrides.providerExternalId ?? null,
    externalType: overrides.externalType ?? "player",
    fullName: overrides.fullName ?? "Backer One",
    firstName: overrides.firstName ?? null,
    lastName: overrides.lastName ?? null,
    team: overrides.team ?? "ATL",
    rawPosition: overrides.rawPosition ?? "ILB",
    positionGroup: overrides.positionGroup ?? "LB",
    season: overrides.season ?? 2026,
    seasonType: overrides.seasonType ?? "regular",
    gamesPlayed: overrides.gamesPlayed ?? 17,
    gamesStarted: overrides.gamesStarted ?? 17,
    stats: overrides.stats ?? { solo_tackles: 100 },
    providerFantasyPoints: overrides.providerFantasyPoints ?? null,
    dataVersion: overrides.dataVersion ?? null,
    sourceUpdatedAt: overrides.sourceUpdatedAt ?? null,
    sourceRecordId: overrides.sourceRecordId ?? "src-season",
    metadata: overrides.metadata ?? {}
  };
}

function projectionRecord(overrides: Partial<AdapterProjectionRecord> = {}): AdapterProjectionRecord {
  return {
    kind: "projection",
    provider: "manual",
    providerExternalId: "providerExternalId" in overrides ? (overrides.providerExternalId ?? null) : "proj-1",
    externalType: overrides.externalType ?? "player",
    fullName: overrides.fullName ?? "Kicker One",
    firstName: overrides.firstName ?? null,
    lastName: overrides.lastName ?? null,
    team: overrides.team ?? "ATL",
    rawPosition: overrides.rawPosition ?? "K",
    positionGroup: overrides.positionGroup ?? "K",
    season: overrides.season ?? 2026,
    week: overrides.week ?? 1,
    seasonType: overrides.seasonType ?? "regular",
    projectionType: overrides.projectionType ?? "weekly",
    scoringFormat: overrides.scoringFormat ?? null,
    opponent: overrides.opponent ?? null,
    stats: overrides.stats ?? { fg_made_50_plus: 1 },
    providerFantasyPoints: overrides.providerFantasyPoints ?? null,
    version: overrides.version ?? "current",
    sourceUpdatedAt: overrides.sourceUpdatedAt ?? null,
    sourceRecordId: overrides.sourceRecordId ?? "src-proj",
    metadata: overrides.metadata ?? {}
  };
}

function injuryRecord(overrides: Partial<AdapterInjuryRecord> = {}): AdapterInjuryRecord {
  return {
    kind: "injury",
    provider: "manual",
    providerExternalId: overrides.providerExternalId ?? null,
    externalType: overrides.externalType ?? "player",
    fullName: overrides.fullName ?? "Def One",
    firstName: overrides.firstName ?? null,
    lastName: overrides.lastName ?? null,
    team: overrides.team ?? "BAL",
    rawPosition: overrides.rawPosition ?? "DEF",
    positionGroup: overrides.positionGroup ?? "DEF",
    season: overrides.season ?? 2026,
    sourceUpdatedAt: overrides.sourceUpdatedAt ?? null,
    sourceRecordId: overrides.sourceRecordId ?? "src-injury",
    metadata: overrides.metadata ?? {},
    week: overrides.week ?? 2,
    status: overrides.status ?? "Questionable",
    practiceStatus: overrides.practiceStatus ?? null,
    gameStatus: overrides.gameStatus ?? null,
    bodyPart: overrides.bodyPart ?? null,
    injuryType: overrides.injuryType ?? null,
    description: overrides.description ?? null,
    expectedReturn: overrides.expectedReturn ?? null,
    observedAt: overrides.observedAt ?? null,
    isCurrent: overrides.isCurrent ?? true
  };
}

function deps(overrides: Partial<IdentityLookupDependencies> = {}): IdentityLookupDependencies {
  return {
    getExistingExternalMappings: overrides.getExistingExternalMappings ?? vi.fn().mockResolvedValue([]),
    findCandidatePlayers: overrides.findCandidatePlayers ?? vi.fn().mockResolvedValue([])
  };
}

describe("orchestration planning", () => {
  it("uses an existing mapping and skips candidate lookup", async () => {
    const dependencies = deps({
      getExistingExternalMappings: vi.fn().mockResolvedValue([
        {
          playerId: PLAYER_ID,
          provider: "manual",
          externalId: "ext-1",
          externalType: "player",
          mappingStatus: "verified",
          mappingMethod: "manual",
          confidence: 1,
          verifiedAt: null,
          team: "ATL",
          positionGroup: "WR"
        }
      ]),
      findCandidatePlayers: vi.fn()
    });

    const plan = await planWeeklyStatsIngestion([weeklyRecord()], [], dependencies);
    expect(plan.ready).toHaveLength(1);
    expect(plan.ready[0].prepared.playerId).toBe(PLAYER_ID);
    expect(dependencies.findCandidatePlayers).not.toHaveBeenCalled();
  });

  it("creates mappingRequired for unique candidate with external id but no persisted mapping", async () => {
    const dependencies = deps({
      findCandidatePlayers: vi.fn().mockResolvedValue([
        {
          id: PLAYER_ID,
          full_name: "Player One",
          normalized_name: "player one",
          team: "ATL",
          primary_position: "WR",
          position_group: "WR",
          side_of_ball: "offense",
          existingExternalIds: [],
          metadata_json: {}
        }
      ])
    });

    const plan = await planWeeklyStatsIngestion([weeklyRecord()], [], dependencies);
    expect(plan.mappingRequired).toHaveLength(1);
    expect(plan.ready).toHaveLength(0);
    expect(plan.mappingRequired[0].playerId).toBe(PLAYER_ID);
  });

  it("allows ready candidate match when external id is null", async () => {
    const dependencies = deps({
      findCandidatePlayers: vi.fn().mockResolvedValue([
        {
          id: PLAYER_ID,
          full_name: "Backer One",
          normalized_name: "backer one",
          team: "ATL",
          primary_position: "LB",
          position_group: "LB",
          side_of_ball: "defense",
          existingExternalIds: [],
          metadata_json: {}
        }
      ])
    });

    const plan = await planSeasonStatsIngestion([seasonRecord()], [], dependencies);
    expect(plan.ready).toHaveLength(1);
    expect(plan.mappingRequired).toHaveLength(0);
  });

  it("keeps duplicate candidates in manual review and unresolved records out of ready", async () => {
    const dupDeps = deps({
      findCandidatePlayers: vi.fn().mockResolvedValue([
        {
          id: "one",
          full_name: "Player One",
          normalized_name: "player one",
          team: "ATL",
          primary_position: "WR",
          position_group: "WR",
          side_of_ball: "offense",
          existingExternalIds: [],
          metadata_json: {}
        },
        {
          id: "two",
          full_name: "Player One",
          normalized_name: "player one",
          team: "ATL",
          primary_position: "WR",
          position_group: "WR",
          side_of_ball: "offense",
          existingExternalIds: [],
          metadata_json: {}
        }
      ])
    });

    const manualPlan = await planWeeklyStatsIngestion([weeklyRecord({ providerExternalId: null })], [], dupDeps);
    expect(manualPlan.manualReview).toHaveLength(1);
    expect(manualPlan.ready).toHaveLength(0);

    const unresolvedPlan = await planProjectionIngestion([projectionRecord({ providerExternalId: null })], [], deps());
    expect(unresolvedPlan.unresolved).toHaveLength(1);
    expect(unresolvedPlan.ready).toHaveLength(0);
  });

  it("rejects conflicting mappings and preserves normalization warnings", async () => {
    const dependencies = deps({
      getExistingExternalMappings: vi.fn().mockResolvedValue([
        {
          playerId: "22222222-2222-4222-8222-222222222222",
          provider: "manual",
          externalId: "ext-1",
          externalType: "player",
          mappingStatus: "verified",
          mappingMethod: "manual",
          confidence: 1,
          verifiedAt: null,
          team: "ATL",
          positionGroup: "WR"
        },
        {
          playerId: PLAYER_ID,
          provider: "manual",
          externalId: "ext-1",
          externalType: "player",
          mappingStatus: "verified",
          mappingMethod: "manual",
          confidence: 1,
          verifiedAt: null,
          team: "ATL",
          positionGroup: "WR"
        }
      ])
    });

    const plan = await planWeeklyStatsIngestion(
      [weeklyRecord()],
      [{ code: "warn", message: "warning", severity: "warning" }],
      dependencies
    );
    expect(plan.rejected).toHaveLength(1);
    expect(plan.identityConflictCount).toBe(1);
    expect(plan.warnings).toHaveLength(1);
  });

  it("handles team defense, kicker, and IDP candidate rules", async () => {
    const defPlan = await planInjuryIngestion(
      [injuryRecord({ externalType: "team_defense", providerExternalId: "def-1", fullName: null })],
      [],
      deps({
        findCandidatePlayers: vi.fn().mockResolvedValue([
          {
            id: PLAYER_ID,
            full_name: "Baltimore Ravens D/ST",
            normalized_name: "baltimore ravens dst",
            team: "BAL",
            primary_position: "DEF",
            position_group: "DEF",
            side_of_ball: "team_defense",
            existingExternalIds: [],
            metadata_json: {}
          }
        ])
      })
    );
    expect(defPlan.mappingRequired).toHaveLength(1);

    const kickPlan = await planProjectionIngestion(
      [projectionRecord({ providerExternalId: null })],
      [],
      deps({
        findCandidatePlayers: vi.fn().mockResolvedValue([
          {
            id: PLAYER_ID,
            full_name: "Kicker One",
            normalized_name: "kicker one",
            team: "ATL",
            primary_position: "K",
            position_group: "K",
            side_of_ball: "special_teams",
            existingExternalIds: [],
            metadata_json: {}
          }
        ])
      })
    );
    expect(kickPlan.ready).toHaveLength(1);

    const idpPlan = await planSeasonStatsIngestion(
      [seasonRecord({ providerExternalId: null, rawPosition: "EDGE", positionGroup: "DL", fullName: "Edge Guy" })],
      [],
      deps({
        findCandidatePlayers: vi.fn().mockResolvedValue([
          {
            id: PLAYER_ID,
            full_name: "Edge Guy",
            normalized_name: "edge guy",
            team: "ATL",
            primary_position: "DL",
            position_group: "DL",
            side_of_ball: "defense",
            existingExternalIds: [],
            metadata_json: {}
          }
        ])
      })
    );
    expect(idpPlan.ready).toHaveLength(1);
  });

  it("reconciles totals and rejects mixed-provider batches", async () => {
    const plan = await planWeeklyStatsIngestion(
      [weeklyRecord({ providerExternalId: null }), weeklyRecord({ sourceRecordId: "src-2" })],
      [],
      deps({
        findCandidatePlayers: vi.fn().mockResolvedValue([
          {
            id: PLAYER_ID,
            full_name: "Player One",
            normalized_name: "player one",
            team: "ATL",
            primary_position: "WR",
            position_group: "WR",
            side_of_ball: "offense",
            existingExternalIds: [],
            metadata_json: {}
          }
        ])
      })
    );
    expect(plan.summary.total).toBe(2);
    expect(plan.summary.ready + plan.summary.mappingRequired + plan.summary.manualReview + plan.summary.unresolved + plan.summary.rejected).toBe(2);

    await expect(
      planWeeklyStatsIngestion(
        [weeklyRecord(), { ...weeklyRecord(), provider: "sportsdataio" }],
        [],
        deps()
      )
    ).rejects.toThrow("one provider");
  });
});
