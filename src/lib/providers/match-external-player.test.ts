import { describe, expect, it } from "vitest";

import {
  matchExternalPlayer,
  type ExternalMatchablePlayer
} from "@/lib/providers/match-external-player";
import type { ExternalPlayerCandidate } from "@/lib/providers/types";

function makePlayer(overrides: Partial<ExternalMatchablePlayer> = {}): ExternalMatchablePlayer {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    full_name: overrides.full_name ?? "Player Name",
    normalized_name: overrides.normalized_name ?? "player name",
    team: overrides.team ?? "ATL",
    primary_position: overrides.primary_position ?? "WR",
    position_group: overrides.position_group ?? "WR",
    side_of_ball: overrides.side_of_ball ?? "offense",
    metadata_json: overrides.metadata_json ?? {},
    existingExternalIds: overrides.existingExternalIds ?? [],
    first_name: overrides.first_name,
    last_name: overrides.last_name
  };
}

function makeCandidate(overrides: Partial<ExternalPlayerCandidate> = {}): ExternalPlayerCandidate {
  return {
    provider: overrides.provider ?? "sportsdataio",
    externalId: overrides.externalId ?? "abc-123",
    fullName: overrides.fullName ?? "Player Name",
    team: "team" in overrides ? (overrides.team ?? null) : "ATL",
    rawPosition: "rawPosition" in overrides ? (overrides.rawPosition ?? null) : "WR",
    normalizedPositionGroup:
      "normalizedPositionGroup" in overrides ? (overrides.normalizedPositionGroup ?? null) : "WR",
    externalType: "externalType" in overrides ? overrides.externalType : undefined,
    metadata: overrides.metadata ?? {}
  };
}

describe("matchExternalPlayer", () => {
  it("uses an existing provider/external ID mapping first", () => {
    const player = makePlayer({
      existingExternalIds: [
        {
          provider: "sportsdataio",
          external_id: "abc-123",
          external_type: "player"
        }
      ]
    });

    const result = matchExternalPlayer(makeCandidate(), [player]);

    expect(result.playerId).toBe(player.id);
    expect(result.status).toBe("verified");
    expect(result.method).toBe("provider_supplied");
  });

  it("auto-matches on exact name, team, and position group", () => {
    const player = makePlayer({
      full_name: "Brian Thomas Jr.",
      normalized_name: "brian thomas",
      team: "JAX",
      position_group: "WR",
      primary_position: "WR"
    });

    const result = matchExternalPlayer(
      makeCandidate({
        fullName: "Brian Thomas Jr.",
        team: "JAC",
        rawPosition: "WR"
      }),
      [player]
    );

    expect(result.playerId).toBe(player.id);
    expect(result.status).toBe("auto_matched");
    expect(result.method).toBe("exact_name_team_position");
  });

  it("sends duplicate normalized names to manual review", () => {
    const players = [
      makePlayer({ id: "one", team: "ATL", normalized_name: "josh allen", full_name: "Josh Allen", position_group: "QB", primary_position: "QB" }),
      makePlayer({ id: "two", team: "BUF", normalized_name: "josh allen", full_name: "Josh Allen", position_group: "QB", primary_position: "QB" })
    ];

    const result = matchExternalPlayer(
      makeCandidate({
        fullName: "Josh Allen",
        rawPosition: "QB",
        normalizedPositionGroup: "QB",
        team: null
      }),
      players
    );

    expect(result.playerId).toBeNull();
    expect(result.status).toBe("manual_review");
    expect(result.candidatePlayerIds).toEqual(["one", "two"]);
  });

  it("keeps offense and defense separated when names collide", () => {
    const players = [
      makePlayer({
        id: "offense",
        full_name: "Mike Williams",
        normalized_name: "mike williams",
        team: "LAC",
        primary_position: "WR",
        position_group: "WR",
        side_of_ball: "offense"
      }),
      makePlayer({
        id: "defense",
        full_name: "Mike Williams",
        normalized_name: "mike williams",
        team: "PIT",
        primary_position: "LB",
        position_group: "LB",
        side_of_ball: "defense"
      })
    ];

    const result = matchExternalPlayer(
      makeCandidate({
        fullName: "Mike Williams",
        team: "PIT",
        rawPosition: "LB",
        normalizedPositionGroup: "LB"
      }),
      players
    );

    expect(result.playerId).toBe("defense");
    expect(result.status).toBe("auto_matched");
  });

  it("handles team defense entities explicitly against DEF player rows", () => {
    const players = [
      makePlayer({
        id: "team-def",
        full_name: "Baltimore Ravens D/ST",
        normalized_name: "baltimore ravens dst",
        team: "BAL",
        primary_position: "DEF",
        position_group: "DEF",
        side_of_ball: "team_defense"
      })
    ];

    const result = matchExternalPlayer(
      makeCandidate({
        fullName: "Baltimore Ravens",
        team: "BAL",
        rawPosition: "DEF",
        normalizedPositionGroup: "DEF",
        externalType: "team_defense"
      }),
      players
    );

    expect(result.playerId).toBe("team-def");
    expect(result.status).toBe("auto_matched");
    expect(result.method).toBe("exact_name_team_position");
  });
});
