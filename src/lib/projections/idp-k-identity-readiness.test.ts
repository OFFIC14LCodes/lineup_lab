import { describe, expect, it } from "vitest";

import type { H98NormalizedPlayerRow } from "./special-teams-defense-ingest";
import {
  classifyDstReadiness,
  classifyProjectionReadiness,
  makeUnresolvedAggregate,
  matchIdentityCandidate,
  normalizeIdentityName,
} from "./idp-k-identity-readiness";

const PLAYER_A = "11111111-1111-4111-8111-111111111111";
const PLAYER_B = "22222222-2222-4222-8222-222222222222";

function row(overrides: Partial<H98NormalizedPlayerRow> = {}): H98NormalizedPlayerRow {
  return {
    category: "idp",
    gsisId: "00-0099999",
    playerDisplayName: "Defender Jr.",
    rawPosition: "OLB",
    rawPositionGroup: "LB",
    positionGroup: "LB",
    team: "BAL",
    opponent: "PIT",
    season: 2025,
    week: 1,
    seasonType: "regular",
    stats: { tkl: 8, solo_tkl: 5, sack: 1 },
    sourceFields: ["def_tackles_with_assist"],
    allZeroStats: false,
    ...overrides,
  };
}

describe("H9.9 identity normalization", () => {
  it("handles suffixes and punctuation consistently", () => {
    expect(normalizeIdentityName("Defender Jr.")).toBe("defender");
    expect(normalizeIdentityName("D'Andre Swift III")).toBe("dandre swift");
  });
});

describe("H9.9 identity matching", () => {
  it("keeps exact ID match priority over candidates", () => {
    const aggregate = makeUnresolvedAggregate([row()]);
    const decision = matchIdentityCandidate(
      aggregate,
      new Map([[aggregate.normalizedName, [{ playerId: PLAYER_B, fullName: "Defender", normalizedName: aggregate.normalizedName, team: "BAL", positionGroup: "LB", active: true }]]]),
      PLAYER_A
    );

    expect(decision.status).toBe("existing_id");
    expect(decision.method).toBe("existing_gsis_mapping");
  });

  it("returns auto_safe for unique exact name, team, and position match", () => {
    const aggregate = makeUnresolvedAggregate([row()]);
    const decision = matchIdentityCandidate(
      aggregate,
      new Map([[aggregate.normalizedName, [{ playerId: PLAYER_A, fullName: "Defender", normalizedName: aggregate.normalizedName, team: "BAL", positionGroup: "LB", active: true }]]])
    );

    expect(decision.status).toBe("auto_safe");
    expect(decision.confidence).toBeGreaterThanOrEqual(0.9);
    expect(decision.method).toBe("exact_name_team_position");
  });

  it("rejects ambiguous same-name team-position candidates", () => {
    const aggregate = makeUnresolvedAggregate([row()]);
    const candidate = { fullName: "Defender", normalizedName: aggregate.normalizedName, team: "BAL", positionGroup: "LB", active: true };
    const decision = matchIdentityCandidate(
      aggregate,
      new Map([[aggregate.normalizedName, [{ ...candidate, playerId: PLAYER_A }, { ...candidate, playerId: PLAYER_B }]]])
    );

    expect(decision.status).toBe("ambiguous");
    expect(decision.recommendedAction).toMatch(/Do not auto-map/);
  });

  it("keeps team mismatches in manual review", () => {
    const aggregate = makeUnresolvedAggregate([row()]);
    const decision = matchIdentityCandidate(
      aggregate,
      new Map([[aggregate.normalizedName, [{ playerId: PLAYER_A, fullName: "Defender", normalizedName: aggregate.normalizedName, team: "KC", positionGroup: "LB", active: true }]]])
    );

    expect(decision.status).toBe("manual_review");
    expect(decision.reasonUnresolved).toBe("team_mismatch_or_stale_canonical_team");
  });
});

describe("H9.9 unresolved priority", () => {
  it("flags high-volume unresolved players as high priority", () => {
    const rows = Array.from({ length: 8 }, (_, index) => row({ week: index + 1, stats: { tkl: 5, solo_tkl: 3 } }));
    expect(makeUnresolvedAggregate(rows).highPriority).toBe(true);
  });

  it("flags kicker attempts as high priority", () => {
    const kicker = makeUnresolvedAggregate([
      row({
        category: "kicker",
        rawPosition: "K",
        rawPositionGroup: "SPEC",
        positionGroup: "K",
        stats: { fga: 9, fgm: 6, xpa: 12, xpm: 11 },
      }),
    ]);
    expect(kicker.highPriority).toBe(true);
  });
});

describe("H9.9 readiness classification", () => {
  it("classifies IDP/K readiness from identity coverage and active weeks", () => {
    expect(classifyProjectionReadiness({
      category: "idp",
      resolvedRows: 900,
      totalRows: 1000,
      highPriorityUnresolvedPlayers: 0,
      playersWithEightWeeks: 40,
      playersWithTwelveWeeks: 20,
    })).toBe("READY_FOR_LOW_CONFIDENCE_PROJECTION");

    expect(classifyProjectionReadiness({
      category: "kicker",
      resolvedRows: 550,
      totalRows: 1000,
      highPriorityUnresolvedPlayers: 3,
      playersWithEightWeeks: 10,
      playersWithTwelveWeeks: 2,
    })).toBe("READY_AFTER_IDENTITY_REPAIR");
  });

  it("classifies DST allowance-only readiness when big-play components are missing", () => {
    expect(classifyDstReadiness({
      rows: 544,
      pointsAllowedCoverage: 544,
      yardsAllowedCoverage: 544,
      missingBigPlayComponents: 9,
    })).toBe("DST_ALLOWANCE_ONLY_READY");
  });
});
