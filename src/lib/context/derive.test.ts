// H8: Blackbird-derived context tests

import { describe, expect, it } from "vitest";

import { aggregatePlayerSeasonStats, derivePlayerContext } from "./derive";
import type { PlayerSeasonStats, TeamSeasonStats } from "./derive";

function makePlayerStats(overrides: Partial<PlayerSeasonStats> = {}): PlayerSeasonStats {
  return {
    canonicalPlayerId: "player-uuid-1",
    season: 2025,
    position: "WR",
    games: 16,
    totalTargets: 120,
    totalCarries: 4,
    teamTotalTargets: null,
    teamTotalCarries: null,
    snapProxy: 850,
    redZoneTargets: 12,
    redZoneTotalTargets: 60,
    goalLineCarries: null,
    goalLineTotalCarries: null,
    teamPassPlays: 580,
    teamRushPlays: 380,
    teamEarlyDownPassPlays: null,
    teamTotalEarlyDownPlays: null,
    targetConcentrationGini: null,
    ...overrides,
  };
}

function makeTeamStats(overrides: Partial<TeamSeasonStats> = {}): TeamSeasonStats {
  return {
    teamId: "KC",
    season: 2025,
    totalPassPlays: 580,
    totalRushPlays: 380,
    totalTargets: 580,
    totalCarries: 380,
    topTargetShare: 0.27,
    ...overrides,
  };
}

// ─── 1. Derived fields are observed (not projected) ───────────────────────────

describe("derivePlayerContext — no projection generation", () => {
  it("does not generate future expected points", () => {
    const stats = makePlayerStats();
    const team = makeTeamStats();
    const { context } = derivePlayerContext(stats, team);
    // No field should be named "projected" or "expected"
    const keys = Object.keys(context);
    for (const key of keys) {
      expect(key.toLowerCase()).not.toContain("projected");
      expect(key.toLowerCase()).not.toContain("expected_points");
    }
  });

  it("target share status is observed, not inferred for the share itself", () => {
    const stats = makePlayerStats();
    const team = makeTeamStats({ totalTargets: 580 });
    const { context } = derivePlayerContext(stats, team);
    // Status should be observed (computed from real data) or unknown
    expect(["observed", "unknown"]).toContain(context.priorTargetShare.status);
  });
});

// ─── 2. Target share computation ─────────────────────────────────────────────

describe("derivePlayerContext — target share", () => {
  it("computes target share correctly", () => {
    const stats = makePlayerStats({ totalTargets: 120 });
    const team = makeTeamStats({ totalTargets: 600 });
    const { context } = derivePlayerContext(stats, team);
    expect(context.priorTargetShare.value).toBeCloseTo(0.2, 2);
  });

  it("target share is unknown when team totals unavailable", () => {
    const stats = makePlayerStats({ totalTargets: 120 });
    const { context } = derivePlayerContext(stats, null);
    expect(context.priorTargetShare.value).toBeNull();
    expect(context.priorTargetShare.status).toBe("unknown");
  });
});

// ─── 3. Team pass rate ────────────────────────────────────────────────────────

describe("derivePlayerContext — team pass rate", () => {
  it("computes pass rate from play counts", () => {
    const stats = makePlayerStats({ teamPassPlays: 580, teamRushPlays: 420 });
    const { context } = derivePlayerContext(stats, null);
    const expectedRate = 580 / (580 + 420);
    expect(context.priorTeamPassRate.value).toBeCloseTo(expectedRate, 2);
  });

  it("rush rate = 1 - pass rate", () => {
    const stats = makePlayerStats({ teamPassPlays: 580, teamRushPlays: 420 });
    const { context } = derivePlayerContext(stats, null);
    const passRate = context.priorTeamPassRate.value!;
    const rushRate = context.priorTeamRushRate.value!;
    expect(passRate + rushRate).toBeCloseTo(1.0, 5);
  });

  it("unknown when play counts are null", () => {
    const stats = makePlayerStats({ teamPassPlays: null, teamRushPlays: null });
    const { context } = derivePlayerContext(stats, null);
    expect(context.priorTeamPassRate.status).toBe("unknown");
  });
});

// ─── 4. Red zone share ────────────────────────────────────────────────────────

describe("derivePlayerContext — red zone share", () => {
  it("computes red zone share when data available", () => {
    const stats = makePlayerStats({ redZoneTargets: 15, redZoneTotalTargets: 60 });
    const { context } = derivePlayerContext(stats, null);
    expect(context.priorRedZoneShare.value).toBeCloseTo(0.25, 2);
  });

  it("unknown when red zone data missing", () => {
    const stats = makePlayerStats({ redZoneTargets: null, redZoneTotalTargets: null });
    const { context } = derivePlayerContext(stats, null);
    expect(context.priorRedZoneShare.status).toBe("unknown");
  });
});

// ─── 5. Evidence records produced ────────────────────────────────────────────

describe("derivePlayerContext — evidence records", () => {
  it("produces evidence records for each derived field", () => {
    const stats = makePlayerStats();
    const team = makeTeamStats();
    const { evidenceRecords } = derivePlayerContext(stats, team);
    expect(evidenceRecords.length).toBeGreaterThan(0);
  });

  it("evidence records are model_inference category", () => {
    const { evidenceRecords } = derivePlayerContext(makePlayerStats(), null);
    for (const r of evidenceRecords) {
      expect(r.evidenceCategory).toBe("model_inference");
      expect(r.isObserved).toBe(false);
    }
  });

  it("all evidence IDs are referenced in context fields", () => {
    const stats = makePlayerStats();
    const team = makeTeamStats();
    const { context, evidenceRecords } = derivePlayerContext(stats, team);
    const evidenceIdSet = new Set(evidenceRecords.map((r) => r.evidenceId));
    const allContextEvidenceIds = [
      ...context.priorTargetShare.evidenceIds,
      ...context.priorCarryShare.evidenceIds,
      ...context.priorTeamPassRate.evidenceIds,
    ];
    for (const id of allContextEvidenceIds) {
      expect(evidenceIdSet.has(id)).toBe(true);
    }
  });
});

// ─── 6. Backlogs documented ───────────────────────────────────────────────────

describe("derivePlayerContext — backlog fields", () => {
  it("has a backlogs array with documented missing fields", () => {
    const { context } = derivePlayerContext(makePlayerStats(), null);
    expect(context.backlogs.length).toBeGreaterThan(0);
    const backlogStr = context.backlogs.join(" ");
    expect(backlogStr.toLowerCase()).toMatch(/route|snap|neutral|positional|team_pass/);
  });

  it("team pass rate is in the backlog for nflverse data", () => {
    const backlogStr = derivePlayerContext(makePlayerStats(), null).context.backlogs.join(" ");
    expect(backlogStr).toContain("team_pass_plays");
  });
});

// ─── 7. aggregatePlayerSeasonStats ────────────────────────────────────────────

describe("aggregatePlayerSeasonStats", () => {
  it("sums rec_tgt (not 'targets') from weekly rows", () => {
    const weekly = [
      { player_id: "p1", season: 2025, week: 1, stats_json: { rec_tgt: 8 } },
      { player_id: "p1", season: 2025, week: 2, stats_json: { rec_tgt: 10 } },
      { player_id: "p2", season: 2025, week: 1, stats_json: { rec_tgt: 5 } },
    ];
    const result = aggregatePlayerSeasonStats("p1", weekly, [], 2025, "WR");
    expect(result.totalTargets).toBe(18);
    expect(result.games).toBe(2);
  });

  it("does not include other players' stats", () => {
    const weekly = [
      { player_id: "p1", season: 2025, week: 1, stats_json: { rec_tgt: 8 } },
      { player_id: "other", season: 2025, week: 1, stats_json: { rec_tgt: 99 } },
    ];
    const result = aggregatePlayerSeasonStats("p1", weekly, [], 2025, "RB");
    expect(result.totalTargets).toBe(8);
  });

  it("snap_proxy is always null (not yet in H2 PBP derivation)", () => {
    const derived = [
      { player_id: "p1", season: 2025, week: 1, stats_json: { snap_proxy: 50 } },
      { player_id: "p1", season: 2025, week: 2, stats_json: { snap_proxy: 60 } },
    ];
    const result = aggregatePlayerSeasonStats("p1", [], derived, 2025, "WR");
    // snap_proxy is a backlog — H2 PBP only stores rec_td_40p etc.
    expect(result.snapProxy).toBeNull();
  });

  it("games = distinct weeks, not row count", () => {
    const weekly = [
      { player_id: "p1", season: 2025, week: 1, stats_json: { rec_tgt: 4 } },
      { player_id: "p1", season: 2025, week: 1, stats_json: { rec_tgt: 2 } }, // duplicate week
      { player_id: "p1", season: 2025, week: 2, stats_json: { rec_tgt: 6 } },
    ];
    const result = aggregatePlayerSeasonStats("p1", weekly, [], 2025, "WR");
    expect(result.games).toBe(2); // distinct weeks: 1, 2
  });
});
