import { describe, expect, it } from "vitest";

import type { H910LeagueInput, H910LeagueOutput, H910PlayerProjection, H910WeeklyRow } from "./idp-k-baseline-projections";
import {
  assertH911ExecuteSafety,
  buildH911WritePlan,
  h911ReasonKey,
  inspectH911Rows,
} from "./idp-k-persistence";

const args = {
  historicalSeason: 2025,
  projectionSeason: 2026,
  includeIdp: true,
  includeKicker: true,
  position: null,
  limit: null,
  playerId: null,
  leagueId: null,
};

function projection(id: string, position: "LB" | "K"): H910PlayerProjection {
  const kicker = position === "K";
  return {
    projectionLabel: "low-confidence baseline",
    canonicalPlayerId: id,
    category: kicker ? "kicker" : "idp",
    position,
    roleClass: kicker ? "K_ESTABLISHED_FULL_SEASON" : "IDP_ESTABLISHED_FULL_SEASON",
    historicalActiveWeeks: 12,
    historicalRoleWeeks: 12,
    historicalMeaningfulRoleWeeks: 12,
    projectedActiveWeeks: 15,
    projectedRoleWeeks: 14,
    roleParticipation: 1,
    confidence: "low",
    volatility: kicker ? "medium" : "high",
    reasonCodes: kicker ? ["K_MAKE_RATE_REGRESSION", "K_TEAM_ENVIRONMENT_NOT_MODELED"] : ["IDP_BIG_PLAY_REGRESSION", "IDP_DEFENSIVE_TD_VOLATILITY"],
    componentsByScenario: kicker
      ? {
          downside: { fgm: 20, xpm: 20, fgmiss: 4 },
          floor: { fgm: 25, xpm: 25, fgmiss: 3 },
          median: { fgm: 30, xpm: 30, fgmiss: 2 },
          ceiling: { fgm: 35, xpm: 35, fgmiss: 1 },
          upside: { fgm: 40, xpm: 40, fgmiss: 0 },
        }
      : {
          downside: { solo_tkl: 40, sack: 1 },
          floor: { solo_tkl: 50, sack: 2 },
          median: { solo_tkl: 60, sack: 3, bonus_sack_2p: 1 },
          ceiling: { solo_tkl: 70, sack: 4 },
          upside: { solo_tkl: 80, sack: 5 },
        },
  };
}

const weeklyRows: H910WeeklyRow[] = [
  { player_id: "p1", week: 1, position_group: "LB", stats_json: { solo_tkl: 4, sack: 1 } },
  { player_id: "k1", week: 1, position_group: "K", stats_json: { fga: 2, fgm: 2, xpa: 3, xpm: 3 } },
];

const leagues: H910LeagueInput[] = [
  { leagueId: "l1", leagueName: "IDP", season: 2026, rosterPositions: ["LB"], scoringSettings: { solo_tkl: 1 } },
  { leagueId: "l2", leagueName: "K", season: 2026, rosterPositions: ["K"], scoringSettings: { fgm: 3 } },
];

const outputs: H910LeagueOutput[] = [
  {
    leagueId: "l1",
    leagueName: "IDP",
    category: "idp",
    playerId: "p1",
    position: "LB",
    rank: 1,
    playersRankedAtPosition: 1,
    downsidePoints: 40,
    floorPoints: 50,
    medianPoints: 60,
    ceilingPoints: 70,
    upsidePoints: 80,
    confidence: "low",
    reasonCodes: ["IDP_BIG_PLAY_REGRESSION"],
    unsupportedScoringKeys: [],
    missingStatsForSupportedKeys: [],
  },
  {
    leagueId: "l2",
    leagueName: "K",
    category: "kicker",
    playerId: "k1",
    position: "K",
    rank: 1,
    playersRankedAtPosition: 1,
    downsidePoints: 70,
    floorPoints: 85,
    medianPoints: 100,
    ceilingPoints: 115,
    upsidePoints: 130,
    confidence: "low",
    reasonCodes: ["K_TEAM_ENVIRONMENT_NOT_MODELED"],
    unsupportedScoringKeys: [],
    missingStatsForSupportedKeys: [],
  },
];

function plan(extra?: Partial<Parameters<typeof buildH911WritePlan>[0]>) {
  return buildH911WritePlan({
    args,
    weeklyRows,
    projections: [projection("p1", "LB"), projection("k1", "K")],
    leagues,
    outputs,
    unresolvedExclusions: {
      unresolvedRowsExcluded: { idp: 1, kicker: 0, total: 1 },
      unresolvedPlayersExcluded: 1,
      unresolvedStatVolumeExcluded: { idpPercent: 1, kickerPercent: 0 },
      highPriorityUnresolvedExcluded: 1,
    },
    unsupportedScoringKeys: [],
    scenarioInvariantFailures: [],
    asOfDate: "2026-06-15",
    codeVersion: "test",
    ...extra,
  });
}

describe("H9.11 IDP/K persistence planning", () => {
  it("builds expected run/input/output/reason counts", () => {
    const writePlan = plan();

    expect(writePlan.run.method).toBe("blackbird_idp_k_baseline_v1");
    expect(writePlan.run.selection_scope).toBe("idp_k");
    expect(writePlan.expected.inputCount).toBe(2);
    expect(writePlan.expected.outputCount).toBe(2);
    expect(writePlan.inputs.map((row) => row.position).sort()).toEqual(["K", "LB"]);
    expect(writePlan.outputs[0].semantic_input_hash).toBe(writePlan.semanticInputHash);
    expect(writePlan.reasonsWithoutRun.some((row) => row.reason_code === "IDP_BIG_PLAY_REGRESSION")).toBe(true);
  });

  it("persists unresolved exclusions as explicit low-confidence reason evidence", () => {
    const writePlan = plan({
      projections: [
        { ...projection("p1", "LB"), reasonCodes: ["IDP_UNRESOLVED_ROWS_EXCLUDED"] },
        projection("k1", "K"),
      ],
    });

    expect(writePlan.reasonsWithoutRun).toContainEqual(expect.objectContaining({
      canonical_player_id: "p1",
      league_id: null,
      reason_code: "IDP_UNRESOLVED_ROWS_EXCLUDED",
      reason_scope: "player_projection",
      direction: "excluded",
      magnitude: 1,
    }));
  });

  it("keeps run semantic hash stable for identical inputs and changes when resolved row set changes", () => {
    const first = plan();
    const second = plan();
    const changed = plan({ weeklyRows: [...weeklyRows, { player_id: "p1", week: 2, position_group: "LB", stats_json: { solo_tkl: 8 } }] });

    expect(second.semanticInputHash).toBe(first.semanticInputHash);
    expect(changed.semanticInputHash).not.toBe(first.semanticInputHash);
  });

  it("uses stable reason keys for idempotent reruns", () => {
    const keyA = h911ReasonKey({ projectionRunId: "run", canonicalPlayerId: "p1", leagueId: null, reasonCode: "IDP_BIG_PLAY_REGRESSION", reasonScope: "player_projection" });
    const keyB = h911ReasonKey({ projectionRunId: "run", canonicalPlayerId: "p1", leagueId: null, reasonCode: "IDP_BIG_PLAY_REGRESSION", reasonScope: "player_projection" });
    const keyC = h911ReasonKey({ projectionRunId: "run2", canonicalPlayerId: "p1", leagueId: null, reasonCode: "IDP_BIG_PLAY_REGRESSION", reasonScope: "player_projection" });

    expect(keyB).toBe(keyA);
    expect(keyC).not.toBe(keyA);
  });

  it("inspection detects missing outputs and duplicate reason keys", () => {
    const writePlan = plan();
    const summary = inspectH911Rows({
      inputs: writePlan.inputs.map((row) => ({ canonical_player_id: row.canonical_player_id, position: row.position, position_group: row.position_group })),
      outputs: [writePlan.outputs[0]],
      reasons: [{ reason_key: "same" }, { reason_key: "same" }],
    }, writePlan.expected);

    expect(summary.missingPlayerLeagueOutputs).toBe(1);
    expect(summary.duplicateReasonKeys).toBe(1);
    expect(summary.complete).toBe(false);
  });

  it("inspection rejects duplicate player-league outputs even when counts match", () => {
    const writePlan = plan();
    const duplicatedOutput = writePlan.outputs[0];
    const summary = inspectH911Rows({
      inputs: writePlan.inputs.map((row) => ({ canonical_player_id: row.canonical_player_id, position: row.position, position_group: row.position_group })),
      outputs: [duplicatedOutput, duplicatedOutput],
      reasons: writePlan.reasonsWithoutRun.map((row, index) => ({ reason_key: `reason-${index}-${row.reason_code}` })),
    }, writePlan.expected);

    expect(summary.outputCount).toBe(writePlan.expected.outputCount);
    expect(summary.duplicateOutputKeys).toBe(1);
    expect(summary.missingPlayerLeagueOutputs).toBe(1);
    expect(summary.complete).toBe(false);
  });

  it("blocks partial limit execute unless explicitly allowed", () => {
    expect(() => assertH911ExecuteSafety({ ...args, limit: 10 }, false)).toThrow("--execute with --limit requires --allow-partial-execute");
    expect(() => assertH911ExecuteSafety({ ...args, limit: 10 }, true)).not.toThrow();
  });

  it("aborts Phase A before writes when scoring is unsupported", () => {
    expect(() => plan({ unsupportedScoringKeys: ["league:idp:key"] })).toThrow("EXECUTE ABORTED");
  });
});
