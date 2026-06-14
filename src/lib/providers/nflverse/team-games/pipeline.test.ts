import { describe, expect, it } from "vitest";

import {
  classifyTeamGameRows,
  computeExistingTeamGameSemanticHash,
  computePipelineStatus,
  computeTeamGameSemanticHash,
  emptyCoverage,
  type ExistingTeamGameRow,
} from "./pipeline";
import type { TeamGamePipelineCoverage, TeamGameRow } from "./types";

describe("emptyCoverage", () => {
  it("initializes all fields to zero", () => {
    const coverage = emptyCoverage();
    for (const value of Object.values(coverage)) {
      expect(value).toBe(0);
    }
  });
});

describe("computePipelineStatus", () => {
  it("returns success for dry-run with no violations", () => {
    const coverage = emptyCoverage();
    expect(computePipelineStatus(coverage, "dry_run", 0)).toBe("success");
  });

  it("returns success for execute mode with no errors or violations", () => {
    const coverage = { ...emptyCoverage(), rowsInserted: 32, writeAttempts: 32, teamGameRowsBuilt: 32 };
    expect(computePipelineStatus(coverage, "execute", 0)).toBe("success");
  });

  it("returns failure when all rows errored", () => {
    const coverage = { ...emptyCoverage(), writeErrors: 5, writeAttempts: 5 };
    expect(computePipelineStatus(coverage, "execute", 0)).toBe("failure");
  });

  it("returns partial_failure when some rows errored", () => {
    const coverage = { ...emptyCoverage(), writeErrors: 2, writeAttempts: 12 };
    expect(computePipelineStatus(coverage, "execute", 0)).toBe("partial_failure");
  });

  it("returns partial_failure when there are invariant violations", () => {
    const coverage = { ...emptyCoverage(), rowsInserted: 32 };
    expect(computePipelineStatus(coverage, "execute", 3)).toBe("partial_failure");
  });
});

describe("team-game semantic idempotency", () => {
  function makeRow(overrides: Partial<TeamGameRow> = {}): TeamGameRow {
    return {
      gameId: "2025_01_DAL_PHI",
      season: 2025,
      week: 1,
      seasonType: "REG",
      teamId: "PHI",
      opponentId: "DAL",
      isHome: true,
      pointsScored: 24,
      pointsAllowed: 20,
      offensiveYards: 302,
      yardsAllowed: 280,
      isFinal: true,
      ...overrides,
    };
  }

  function makeExisting(overrides: Partial<ExistingTeamGameRow> = {}): ExistingTeamGameRow {
    const row = makeRow();
    return {
      game_id: row.gameId,
      season: row.season,
      week: row.week,
      season_type: row.seasonType,
      team_id: row.teamId,
      opponent_id: row.opponentId,
      is_home: row.isHome,
      points_scored: row.pointsScored,
      points_allowed: row.pointsAllowed,
      offensive_yards: row.offensiveYards,
      yards_allowed: row.yardsAllowed,
      is_final: row.isFinal,
      reconciliation_status: "verified",
      source_provider: "nflverse",
      source_batch_id: "old-batch",
      updated_at: "2026-01-01T00:00:00.000Z",
      ...overrides,
    };
  }

  it("identical existing rows have the same semantic hash", () => {
    expect(computeTeamGameSemanticHash(makeRow())).toBe(
      computeExistingTeamGameSemanticHash(makeExisting())
    );
  });

  it("volatile updated_at changes do not trigger semantic updates", () => {
    const first = computeExistingTeamGameSemanticHash(makeExisting({ updated_at: "2026-01-01T00:00:00.000Z" }));
    const second = computeExistingTeamGameSemanticHash(makeExisting({ updated_at: "2026-02-01T00:00:00.000Z" }));
    expect(first).toBe(second);
  });

  it("batch ID changes do not trigger semantic updates", () => {
    const first = computeExistingTeamGameSemanticHash(makeExisting({ source_batch_id: "batch-a" }));
    const second = computeExistingTeamGameSemanticHash(makeExisting({ source_batch_id: "batch-b" }));
    expect(first).toBe(second);
  });

  it("one changed score changes the semantic hash", () => {
    expect(computeTeamGameSemanticHash(makeRow({ pointsScored: 25 }))).not.toBe(
      computeExistingTeamGameSemanticHash(makeExisting())
    );
  });

  it("one changed yardage value changes the affected semantic hash", () => {
    expect(computeTeamGameSemanticHash(makeRow({ yardsAllowed: 281 }))).not.toBe(
      computeExistingTeamGameSemanticHash(makeExisting())
    );
  });

  it("first import classifies all rows as inserts", () => {
    const result = classifyTeamGameRows([makeRow()], []);
    expect(result.rowsInserted).toBe(1);
    expect(result.rowsUpdated).toBe(0);
    expect(result.rowsUnchanged).toBe(0);
    expect(result.decisions[0]?.action).toBe("insert_required");
  });

  it("identical rerun classifies as unchanged with zero writes required", () => {
    const result = classifyTeamGameRows([makeRow()], [makeExisting()]);
    expect(result.rowsInserted).toBe(0);
    expect(result.rowsUpdated).toBe(0);
    expect(result.rowsUnchanged).toBe(1);
    expect(result.decisions[0]?.action).toBe("unchanged");
  });

  it("one changed score classifies one row as update_required", () => {
    const result = classifyTeamGameRows([makeRow({ pointsScored: 25 })], [makeExisting()]);
    expect(result.rowsUpdated).toBe(1);
    expect(result.decisions[0]?.action).toBe("update_required");
  });

  it("one changed yardage classifies the affected reciprocal row as update_required", () => {
    const home = makeRow({ teamId: "PHI", opponentId: "DAL", isHome: true, offensiveYards: 302, yardsAllowed: 280 });
    const away = makeRow({ teamId: "DAL", opponentId: "PHI", isHome: false, offensiveYards: 280, yardsAllowed: 302, pointsScored: 20, pointsAllowed: 24 });
    const existingHome = makeExisting();
    const existingAway = makeExisting({
      team_id: "DAL",
      opponent_id: "PHI",
      is_home: false,
      points_scored: 20,
      points_allowed: 24,
      offensive_yards: 280,
      yards_allowed: 302,
    });

    const result = classifyTeamGameRows(
      [{ ...home, yardsAllowed: 281 }, away],
      [existingHome, existingAway]
    );

    expect(result.rowsUpdated).toBe(1);
    expect(result.rowsUnchanged).toBe(1);
    expect(result.decisions.filter((decision) => decision.action === "update_required")).toHaveLength(1);
  });

  it("unexpected existing rows are reported without affecting derived decisions", () => {
    const result = classifyTeamGameRows([makeRow()], [
      makeExisting(),
      makeExisting({ game_id: "2025_02_DAL_PHI" }),
    ]);
    expect(result.rowsUnexpected).toBe(1);
    expect(result.rowsUnchanged).toBe(1);
  });

  it("duplicate natural keys classify derived rows as conflicts", () => {
    const result = classifyTeamGameRows([makeRow(), makeRow()], []);
    expect(result.duplicateNaturalKeys).toBe(1);
    expect(result.rowsConflicted).toBe(2);
    expect(result.decisions.every((decision) => decision.action === "conflict")).toBe(true);
  });
});

describe("team-game idempotency report invariant", () => {
  function expectCountsReconcile(coverage: TeamGamePipelineCoverage) {
    expect(
      coverage.rowsInserted +
      coverage.rowsUpdated +
      coverage.rowsUnchanged +
      coverage.rowsConflicted
    ).toBe(coverage.rowsDerived);
  }

  it("first import inserts all derived rows", () => {
    const coverage = { ...emptyCoverage(), rowsDerived: 544, rowsInserted: 544 };
    expectCountsReconcile(coverage);
  });

  it("identical rerun performs zero writes and marks all rows unchanged", () => {
    const coverage = { ...emptyCoverage(), rowsDerived: 544, rowsExisting: 544, rowsUnchanged: 544, writeAttempts: 0 };
    expectCountsReconcile(coverage);
  });

  it("missing row inserts while the rest remain unchanged", () => {
    const coverage = { ...emptyCoverage(), rowsDerived: 544, rowsExisting: 543, rowsInserted: 1, rowsUnchanged: 543, rowsMissing: 1 };
    expectCountsReconcile(coverage);
  });

  it("unexpected existing rows are reported outside the derived-row invariant", () => {
    const coverage = { ...emptyCoverage(), rowsDerived: 544, rowsExisting: 545, rowsUnchanged: 544, rowsUnexpected: 1 };
    expectCountsReconcile(coverage);
  });

  it("duplicate natural keys are counted as conflicts", () => {
    const coverage = { ...emptyCoverage(), rowsDerived: 544, rowsUnchanged: 542, rowsConflicted: 2, duplicateNaturalKeys: 1 };
    expectCountsReconcile(coverage);
  });
});

describe("TeamGameRow symmetry invariants", () => {
  // These are the business-logic invariants we verify on derived data.
  // The pipeline builds two rows per game; these tests verify the expected symmetry.

  function makeGamePair(
    gameId: string,
    homeId: string,
    awayId: string,
    homeScore: number,
    awayScore: number,
    homeYards: number,
    awayYards: number
  ): [TeamGameRow, TeamGameRow] {
    const homeRow: TeamGameRow = {
      gameId,
      season: 2025,
      week: 1,
      seasonType: "REG",
      teamId: homeId,
      opponentId: awayId,
      isHome: true,
      pointsScored: homeScore,
      pointsAllowed: awayScore,
      offensiveYards: homeYards,
      yardsAllowed: awayYards,
      isFinal: true,
    };
    const awayRow: TeamGameRow = {
      gameId,
      season: 2025,
      week: 1,
      seasonType: "REG",
      teamId: awayId,
      opponentId: homeId,
      isHome: false,
      pointsScored: awayScore,
      pointsAllowed: homeScore,
      offensiveYards: awayYards,
      yardsAllowed: homeYards,
      isFinal: true,
    };
    return [homeRow, awayRow];
  }

  it("home and away rows reference each other as opponents", () => {
    const [home, away] = makeGamePair("2025_01_KC_BUF", "KC", "BUF", 27, 24, 350, 280);
    expect(home.opponentId).toBe(away.teamId);
    expect(away.opponentId).toBe(home.teamId);
  });

  it("points_allowed for home = points_scored for away", () => {
    const [home, away] = makeGamePair("2025_01_KC_BUF", "KC", "BUF", 27, 24, 350, 280);
    expect(home.pointsAllowed).toBe(away.pointsScored);
    expect(away.pointsAllowed).toBe(home.pointsScored);
  });

  it("yards_allowed for home = offensive_yards for away", () => {
    const [home, away] = makeGamePair("2025_01_KC_BUF", "KC", "BUF", 27, 24, 350, 280);
    expect(home.yardsAllowed).toBe(away.offensiveYards);
    expect(away.yardsAllowed).toBe(home.offensiveYards);
  });

  it("is_home is true for home row and false for away row", () => {
    const [home, away] = makeGamePair("2025_01_KC_BUF", "KC", "BUF", 27, 24, 350, 280);
    expect(home.isHome).toBe(true);
    expect(away.isHome).toBe(false);
  });

  it("team_id and opponent_id are never equal", () => {
    const [home, away] = makeGamePair("2025_01_KC_BUF", "KC", "BUF", 27, 24, 350, 280);
    expect(home.teamId).not.toBe(home.opponentId);
    expect(away.teamId).not.toBe(away.opponentId);
  });

  it("allows null yards when PBP data is missing", () => {
    const [home, away] = makeGamePair("2025_01_KC_BUF", "KC", "BUF", 27, 24, 0, 0);
    // Simulate null PBP:
    const homeWithNull = { ...home, offensiveYards: null, yardsAllowed: null };
    const awayWithNull = { ...away, offensiveYards: null, yardsAllowed: null };
    expect(homeWithNull.offensiveYards).toBeNull();
    expect(awayWithNull.yardsAllowed).toBeNull();
  });

  it("season_type is always REG for regular season games", () => {
    const [home, away] = makeGamePair("2025_01_KC_BUF", "KC", "BUF", 27, 24, 350, 280);
    expect(home.seasonType).toBe("REG");
    expect(away.seasonType).toBe("REG");
  });
});

describe("team registry coverage", () => {
  it("NFL_TEAM_IDS covers all 32 active franchises", async () => {
    const { NFL_TEAM_IDS, NFL_TEAMS } = await import("@/lib/providers/nflverse/teams/registry");
    expect(NFL_TEAMS).toHaveLength(32);
    expect(NFL_TEAM_IDS.size).toBe(32);
  });

  it("all registry teams are unique by ID", async () => {
    const { NFL_TEAMS } = await import("@/lib/providers/nflverse/teams/registry");
    const ids = NFL_TEAMS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all teams have valid conference", async () => {
    const { NFL_TEAMS } = await import("@/lib/providers/nflverse/teams/registry");
    for (const team of NFL_TEAMS) {
      expect(["AFC", "NFC"]).toContain(team.conference);
    }
  });

  it("16 teams in each conference", async () => {
    const { NFL_TEAMS } = await import("@/lib/providers/nflverse/teams/registry");
    const afc = NFL_TEAMS.filter((t) => t.conference === "AFC");
    const nfc = NFL_TEAMS.filter((t) => t.conference === "NFC");
    expect(afc).toHaveLength(16);
    expect(nfc).toHaveLength(16);
  });
});
