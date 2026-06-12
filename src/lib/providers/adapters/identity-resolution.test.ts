import { describe, expect, it } from "vitest";

import { resolveIdentityDecision } from "@/lib/providers/adapters/identity-resolution";
import type { AdapterWeeklyStatsRecord } from "@/lib/providers/adapters/types";
import type { ExternalMatchablePlayer } from "@/lib/providers/match-external-player";
import type { PlayerExternalIdRow } from "@/lib/providers/types";

function makeRecord(overrides: Partial<AdapterWeeklyStatsRecord> = {}): AdapterWeeklyStatsRecord {
  return {
    kind: "weekly_stats",
    provider: "manual",
    providerExternalId: "providerExternalId" in overrides ? (overrides.providerExternalId ?? null) : "abc-1",
    externalType: overrides.externalType ?? "player",
    fullName: "fullName" in overrides ? (overrides.fullName ?? null) : "Player Name",
    firstName: "firstName" in overrides ? (overrides.firstName ?? null) : null,
    lastName: "lastName" in overrides ? (overrides.lastName ?? null) : null,
    team: "team" in overrides ? (overrides.team ?? null) : "ATL",
    rawPosition: "rawPosition" in overrides ? (overrides.rawPosition ?? null) : "WR",
    positionGroup: "positionGroup" in overrides ? (overrides.positionGroup ?? null) : "WR",
    season: overrides.season ?? 2026,
    week: overrides.week ?? 1,
    seasonType: overrides.seasonType ?? "regular",
    gameId: "gameId" in overrides ? (overrides.gameId ?? null) : null,
    opponent: "opponent" in overrides ? (overrides.opponent ?? null) : null,
    homeAway: "homeAway" in overrides ? (overrides.homeAway ?? null) : null,
    gameDate: "gameDate" in overrides ? (overrides.gameDate ?? null) : null,
    stats: overrides.stats ?? {},
    providerFantasyPoints: "providerFantasyPoints" in overrides ? (overrides.providerFantasyPoints ?? null) : null,
    dataVersion: "dataVersion" in overrides ? (overrides.dataVersion ?? null) : null,
    sourceUpdatedAt: "sourceUpdatedAt" in overrides ? (overrides.sourceUpdatedAt ?? null) : null,
    sourceRecordId: "sourceRecordId" in overrides ? (overrides.sourceRecordId ?? null) : "src-1",
    metadata: overrides.metadata ?? {}
  };
}

function makePlayer(overrides: Partial<ExternalMatchablePlayer> = {}): ExternalMatchablePlayer {
  return {
    id: overrides.id ?? "player-1",
    full_name: overrides.full_name ?? "Player Name",
    normalized_name: overrides.normalized_name ?? "player name",
    team: overrides.team ?? "ATL",
    primary_position: overrides.primary_position ?? "WR",
    position_group: overrides.position_group ?? "WR",
    side_of_ball: overrides.side_of_ball ?? "offense",
    existingExternalIds: overrides.existingExternalIds ?? [],
    metadata_json: overrides.metadata_json ?? {}
  };
}

function makeMapping(overrides: Partial<PlayerExternalIdRow> = {}): PlayerExternalIdRow {
  return {
    id: overrides.id ?? "map-1",
    player_id: overrides.player_id ?? "player-1",
    provider: overrides.provider ?? "manual",
    external_id: overrides.external_id ?? "abc-1",
    external_type: overrides.external_type ?? "player",
    season: overrides.season ?? null,
    team: overrides.team ?? null,
    position_group: overrides.position_group ?? null,
    mapping_status: overrides.mapping_status ?? "verified",
    mapping_method: overrides.mapping_method ?? "manual",
    confidence: overrides.confidence ?? 1,
    metadata_json: overrides.metadata_json ?? {},
    verified_at: overrides.verified_at ?? null,
    created_at: overrides.created_at ?? "",
    updated_at: overrides.updated_at ?? ""
  };
}

describe("identity resolution", () => {
  it("resolves exact external mapping", () => {
    const result = resolveIdentityDecision({
      record: makeRecord(),
      existingExternalMappings: [makeMapping()]
    });

    expect(result.status).toBe("resolved");
    expect(result.playerId).toBe("player-1");
  });

  it("rejects conflicting external mappings", () => {
    const result = resolveIdentityDecision({
      record: makeRecord(),
      existingExternalMappings: [makeMapping(), makeMapping({ id: "map-2", player_id: "player-2" })]
    });

    expect(result.status).toBe("conflicting_mapping");
  });

  it("resolves exact name/team/position when unique", () => {
    const result = resolveIdentityDecision({
      record: makeRecord({ providerExternalId: null }),
      candidatePlayers: [makePlayer()]
    });

    expect(result.status).toBe("resolved");
    expect(result.playerId).toBe("player-1");
  });

  it("returns manual review for duplicate names", () => {
    const result = resolveIdentityDecision({
      record: makeRecord({ fullName: "Josh Allen", team: null, rawPosition: "QB", positionGroup: "QB", providerExternalId: null }),
      candidatePlayers: [
        makePlayer({ id: "one", full_name: "Josh Allen", normalized_name: "josh allen", team: "BUF", primary_position: "QB", position_group: "QB" }),
        makePlayer({ id: "two", full_name: "Josh Allen", normalized_name: "josh allen", team: "JAX", primary_position: "QB", position_group: "QB" })
      ]
    });

    expect(result.status).toBe("manual_review");
  });

  it("rejects offense/defense mismatch and remains unresolved", () => {
    const result = resolveIdentityDecision({
      record: makeRecord({ providerExternalId: null, rawPosition: "LB", positionGroup: "LB" }),
      candidatePlayers: [makePlayer({ primary_position: "WR", position_group: "WR", side_of_ball: "offense" })]
    });

    expect(result.status).toBe("unresolved");
  });

  it("resolves mapped and exact-team team defense conservatively", () => {
    const mapped = resolveIdentityDecision({
      record: makeRecord({ externalType: "team_defense", providerExternalId: "def-1", team: "BAL", rawPosition: "DEF", positionGroup: "DEF", fullName: null }),
      existingExternalMappings: [makeMapping({ external_id: "def-1", external_type: "team_defense" })]
    });
    const exactTeam = resolveIdentityDecision({
      record: makeRecord({ externalType: "team_defense", providerExternalId: null, team: "BAL", rawPosition: "DEF", positionGroup: "DEF", fullName: null }),
      candidatePlayers: [makePlayer({ id: "def-player", full_name: "Baltimore Ravens D/ST", normalized_name: "baltimore ravens dst", team: "BAL", primary_position: "DEF", position_group: "DEF", side_of_ball: "team_defense" })]
    });

    expect(mapped.status).toBe("team_defense_resolved");
    expect(exactTeam.status).toBe("team_defense_resolved");
    expect(exactTeam.playerId).toBe("def-player");
  });

  it("keeps ambiguous or missing DEF team unresolved", () => {
    const missing = resolveIdentityDecision({
      record: makeRecord({ externalType: "team_defense", providerExternalId: null, team: null, rawPosition: "DEF", positionGroup: "DEF", fullName: null }),
      candidatePlayers: [makePlayer({ id: "def-player", team: "BAL", primary_position: "DEF", position_group: "DEF", side_of_ball: "team_defense" })]
    });
    const wrong = resolveIdentityDecision({
      record: makeRecord({ externalType: "team_defense", providerExternalId: null, team: "BAL", rawPosition: "DEF", positionGroup: "DEF", fullName: null }),
      candidatePlayers: [makePlayer({ id: "lb-player", team: "BAL", primary_position: "LB", position_group: "LB", side_of_ball: "defense" })]
    });

    expect(missing.status).toBe("unresolved");
    expect(wrong.status).toBe("unresolved");
  });
});
