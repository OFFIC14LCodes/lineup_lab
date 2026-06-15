import { describe, expect, it } from "vitest";

import {
  buildH10ValidationSeedPlan,
  cleanupFilters,
  H10_VALIDATION_PROFILES,
  rankingSource,
  validationMetadata,
  type H10ValidationLeagueCandidate,
} from "./h10-validation-room-seed";
import type { H10LeagueValueRow } from "@/lib/projections/h10-league-value";

describe("H10 validation room seed plan", () => {
  it("builds isolated deterministic validation rooms and is idempotent", () => {
    const first = buildH10ValidationSeedPlan({ leagues, valueRows, playerLookup });
    const second = buildH10ValidationSeedPlan({ leagues: [...leagues].reverse(), valueRows: [...valueRows].reverse(), playerLookup });

    expect(first.rooms.map((room) => room.platformDraftId).sort()).toEqual(second.rooms.map((room) => room.platformDraftId).sort());
    expect(first.rooms.every((room) => room.platformDraftId.startsWith("h10-validation-"))).toBe(true);
    expect(first.rooms.every((room) => room.metadata.validation_room === true && room.metadata.purpose === "h10_recommendation_validation")).toBe(true);
  });

  it("covers required validation profiles when matching leagues and rows exist", () => {
    const plan = buildH10ValidationSeedPlan({ leagues, valueRows, playerLookup });
    const profiles = new Set(plan.rooms.map((room) => room.profileId));

    for (const profile of H10_VALIDATION_PROFILES.map((item) => item.profileId)) {
      expect(profiles.has(profile)).toBe(true);
    }
  });

  it("ranking rows can include canonical ids where value rows have player records", () => {
    const plan = buildH10ValidationSeedPlan({ leagues, valueRows, playerLookup });
    const nonDstRows = plan.rooms.flatMap((room) => room.players).filter((player) => player.position !== "DEF");

    expect(nonDstRows.length).toBeGreaterThan(0);
    expect(nonDstRows.every((player) => player.entityId && player.sleeperPlayerId)).toBe(true);
  });

  it("reports missing coverage clearly", () => {
    const plan = buildH10ValidationSeedPlan({ leagues: [leagues[0]], valueRows: valueRows.filter((row) => row.leagueId === "one"), playerLookup });

    expect(plan.missingProfiles.length).toBeGreaterThan(0);
    expect(plan.missingProfiles[0].reason).toContain("No existing owned league");
  });

  it("cleanup filters target only validation markers", () => {
    expect(cleanupFilters()).toEqual({
      draftRoomMetadataPurpose: "h10_recommendation_validation",
      rankingSource: "h10_validation",
      leagueMetadataPurpose: "h10_recommendation_validation",
    });
    expect(rankingSource()).toBe("h10_validation");
    expect(validationMetadata("one_qb_offense")).toMatchObject({
      validation_room: true,
      created_by_system: true,
      purpose: "h10_recommendation_validation",
    });
  });
});

const leagues: H10ValidationLeagueCandidate[] = [
  league("one", ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN", "BN", "BN"]),
  league("sf", ["QB", "RB", "WR", "TE", "SUPER_FLEX", "BN", "BN"], { is_superflex: true }),
  league("tep", ["QB", "RB", "WR", "TE", "FLEX", "BN", "BN"], { te_premium: 1.5 }),
  league("k", ["QB", "RB", "WR", "TE", "K", "BN", "BN"]),
  league("dst", ["QB", "RB", "WR", "TE", "DEF", "BN", "BN"]),
  league("shallow", ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN", "BN"]),
  league("idp", ["QB", "RB", "WR", "TE", "DL", "LB", "DB", "IDP_FLEX", "BN", "BN"]),
];

const valueRows: H10LeagueValueRow[] = leagues.flatMap((leagueRow) =>
  ["QB", "RB", "WR", "TE", "K", "DL", "LB", "DB"].flatMap((position) =>
    Array.from({ length: 10 }, (_, index) => h10Row(leagueRow.id, `${leagueRow.id}-${position}-${index}`, position, 100 - index))
  )
);

const playerLookup = Object.fromEntries(
  valueRows.map((row) => [
    row.entityId,
    {
      sleeper_player_id: `sleeper-${row.entityId}`,
      full_name: row.displayName,
      position: row.positionGroup,
      team: "FA",
    },
  ])
);

function league(
  id: string,
  roster_positions_json: string[],
  overrides: Partial<H10ValidationLeagueCandidate> = {}
): H10ValidationLeagueCandidate {
  return {
    id,
    user_id: "user",
    name: id,
    season: "2026",
    roster_positions_json,
    is_superflex: false,
    is_two_qb: false,
    te_premium: 0,
    metadata_json: {},
    ...overrides,
  };
}

function h10Row(leagueId: string, entityId: string, position: string, value: number): H10LeagueValueRow {
  return {
    leagueId,
    leagueName: leagueId,
    entityId,
    entityType: "PLAYER",
    displayName: `${position} ${value}`,
    team: "FA",
    position,
    positionGroup: position,
    projectedPositionRank: 1,
    medianPoints: value,
    floorPoints: value - 10,
    ceilingPoints: value + 10,
    downsidePoints: value - 15,
    upsidePoints: value + 15,
    replacementRank: 10,
    replacementLevelPoints: 10,
    starterCutlinePoints: 20,
    starterCutlineRank: 5,
    pointsAboveReplacement: value - 10,
    pointsAboveStarterCutline: value - 20,
    riskAdjustedValue: value,
    confidenceAdjustedValue: value,
    tier: 1,
    tierLabel: "Tier 1",
    tierSize: 10,
    tierGapAbove: null,
    tierGapBelow: null,
    pointsToNextTier: null,
    pointsAboveNextTier: null,
    positionScarcityScore: value,
    scarcityLabel: "high",
    marketValueSignal: "aligned",
    marketRankDelta: 0,
    valueReadiness: "READY",
    riskLabel: "low",
    warningCodes: [],
    reasonCodes: [],
    draftRelevance: "draft_relevant",
  };
}
