import { describe, expect, it } from "vitest";

import { buildPlayerProfileUsageProfile, detectPlayerProfileUsageSources } from "./player-profile-usage";
import type { HistoricalPlayerProfileSnapshot } from "./player-profile-types";

const missingSources = {
  used: ["data/nflverse/player_stats_2018_2025.csv"],
  missing: ["data/nflverse/snap_counts_2018_2025.csv", "data/nflverse/participation_2018_2025.csv", "data/nflverse/pbp_2018_2025.csv"],
  hasSnapData: false,
  hasParticipationData: false,
  hasPlayByPlayData: false,
};

const snapSources = {
  used: ["data/nflverse/player_stats_2018_2025.csv", "data/nflverse/snap_counts_2018_2025.csv", "data/nflverse/participation_2018_2025.csv"],
  missing: ["data/nflverse/pbp_2018_2025.csv"],
  hasSnapData: true,
  hasParticipationData: true,
  hasPlayByPlayData: false,
};

describe("player profile usage and role metrics", () => {
  it("calculates offensive opportunity metrics", () => {
    const usage = buildPlayerProfileUsageProfile({
      position: "RB",
      weeklyStats: [
        weekly({ rushing: { rush_att: 12, rush_yd: 60, rush_td: 1 }, receiving: { targets: 4, rec: 3, rec_yd: 30 } }),
        weekly({ week: 2, rushing: { rush_att: 16, rush_yd: 80 }, receiving: { targets: 2, rec: 2, rec_yd: 10 } }),
      ],
      matchConfidence: "exact_id",
      sources: missingSources,
    });

    expect(usage.usageSummary.opportunitiesPerGame).toBe(17);
    expect(usage.usageSummary.touchesPerGame).toBe(16.5);
    expect(usage.usageSummary.yardsPerTouch).toBe(5.5);
    expect(usage.roleWarnings).toContain("snap_data_unavailable");
  });

  it("detects RB receiving roles", () => {
    const usage = buildPlayerProfileUsageProfile({
      position: "RB",
      weeklyStats: Array.from({ length: 8 }, (_, index) => weekly({ week: index + 1, rushing: { rush_att: 5 }, receiving: { targets: 6, rec: 5, rec_yd: 40 } })),
      matchConfidence: "strong",
      sources: missingSources,
    });

    expect(usage.roleMetrics.roleLabel).toBe("receiving_back");
    expect(usage.usageSummary.receivingUsageShare).toBeGreaterThan(50);
  });

  it("detects QB rushing roles", () => {
    const usage = buildPlayerProfileUsageProfile({
      position: "QB",
      weeklyStats: Array.from({ length: 8 }, (_, index) => weekly({ week: index + 1, passing: { pass_att: 30 }, rushing: { rush_att: 7, rush_yd: 45 } })),
      matchConfidence: "exact_id",
      sources: missingSources,
    });

    expect(usage.roleMetrics.roleLabel).toBe("rushing_qb");
    expect(usage.usageSummary.carriesPerGame).toBe(7);
  });

  it("detects WR/TE volume roles", () => {
    const usage = buildPlayerProfileUsageProfile({
      position: "WR",
      weeklyStats: Array.from({ length: 8 }, (_, index) => weekly({ week: index + 1, receiving: { targets: 9, rec: 6, rec_yd: 78 } })),
      matchConfidence: "exact_id",
      sources: missingSources,
    });

    expect(usage.roleMetrics.roleLabel).toBe("alpha_receiver");
    expect(usage.usageSummary.targetsPerGame).toBe(9);
  });

  it("detects IDP tackle floor and big-play dependency", () => {
    const tackleFloor = buildPlayerProfileUsageProfile({
      position: "LB",
      weeklyStats: Array.from({ length: 8 }, (_, index) => weekly({ week: index + 1, defensive: { solo_tkl: 6, ast_tkl: 3, sack: 0 } })),
      matchConfidence: "exact_id",
      sources: missingSources,
    });
    const bigPlay = buildPlayerProfileUsageProfile({
      position: "DL",
      weeklyStats: Array.from({ length: 8 }, (_, index) => weekly({ week: index + 1, defensive: { solo_tkl: 1, ast_tkl: 0, sack: 1, pd: 1 } })),
      matchConfidence: "exact_id",
      sources: missingSources,
    });

    expect(tackleFloor.roleMetrics.idpArchetype).toBe("tackle_floor");
    expect(tackleFloor.roleMetrics.roleLabel).toBe("tackle_floor");
    expect(bigPlay.roleMetrics.roleLabel).toBe("sack_upside");
    expect(bigPlay.usageSummary.bigPlayDependencyScore).toBeGreaterThan(45);
  });

  it("lowers role confidence for low sample profiles", () => {
    const usage = buildPlayerProfileUsageProfile({
      position: "WR",
      weeklyStats: [weekly({ receiving: { targets: 10, rec: 7, rec_yd: 90 } })],
      matchConfidence: "exact_id",
      sources: missingSources,
    });

    expect(usage.roleMetrics.roleConfidence).toBe("low");
    expect(usage.roleWarnings).toContain("low_usage_sample");
  });

  it("detects missing snap source without failing", () => {
    const sources = detectPlayerProfileUsageSources("missing-directory");

    expect(sources.hasSnapData).toBe(false);
    expect(sources.missing.some((file) => file.endsWith("snap_counts_2018_2025.csv"))).toBe(true);
  });

  it("joins offensive snap rows into usage summaries", () => {
    const usage = buildPlayerProfileUsageProfile({
      position: "RB",
      weeklyStats: [weekly({ rushing: { rush_att: 12 }, receiving: { targets: 4, rec: 3 } })],
      snapCounts: [
        snap({ offenseSnapShare: 0.82, offenseSnaps: 54 }),
        snap({ week: 2, offenseSnapShare: 0.76, offenseSnaps: 49 }),
      ],
      participation: [
        participation({ offensePlays: 62 }),
        participation({ week: 2, offensePlays: 59 }),
      ],
      matchConfidence: "exact_id",
      sources: snapSources,
    });

    expect(usage.usageSummary.gamesWithSnapData).toBe(2);
    expect(usage.usageSummary.gamesWithParticipationData).toBe(2);
    expect(usage.usageSummary.offensiveSnapShare).toBe(0.8);
    expect(usage.usageSummary.gamesOver70PercentSnaps).toBe(2);
    expect(usage.roleMetrics.roleModifiers).toContain("full_time_role");
    expect(usage.roleWarnings).not.toContain("snap_data_unavailable");
  });

  it("joins defensive snap rows into IDP role summaries", () => {
    const usage = buildPlayerProfileUsageProfile({
      position: "LB",
      weeklyStats: [weekly({ defensive: { solo_tkl: 7, ast_tkl: 3 } })],
      snapCounts: [
        snap({ defenseSnapShare: 0.91, defenseSnaps: 68 }),
        snap({ week: 2, defenseSnapShare: 0.88, defenseSnaps: 64 }),
      ],
      participation: [participation({ defensePlays: 70 }), participation({ week: 2, defensePlays: 66 })],
      matchConfidence: "strong",
      sources: snapSources,
    });

    expect(usage.usageSummary.defensiveSnapShare).toBe(0.9);
    expect(usage.usageSummary.gamesOver70PercentSnaps).toBe(2);
    expect(usage.roleMetrics.roleModifiers).toContain("full_time_role");
  });

  it("flags productive players with limited snap roles", () => {
    const usage = buildPlayerProfileUsageProfile({
      position: "WR",
      weeklyStats: Array.from({ length: 8 }, (_, index) => weekly({ week: index + 1, receiving: { targets: 7, rec: 4, rec_yd: 60 } })),
      snapCounts: Array.from({ length: 8 }, (_, index) => snap({ week: index + 1, offenseSnapShare: 0.34, offenseSnaps: 21 })),
      matchConfidence: "exact_id",
      sources: snapSources,
    });

    expect(usage.roleMetrics.roleModifiers).toContain("rotational_role");
    expect(usage.roleMetrics.roleModifiers).toContain("production_without_full_role");
    expect(usage.roleWarnings).toContain("low_snap_share");
  });
});

function weekly(input: Partial<HistoricalPlayerProfileSnapshot["weeklyStats"][number]> = {}): HistoricalPlayerProfileSnapshot["weeklyStats"][number] {
  return {
    season: 2025,
    week: 1,
    team: "TST",
    opponent: "OPP",
    passing: {},
    rushing: {},
    receiving: {},
    kicking: {},
    defensive: {},
    calculatedFantasyPoints: 0,
    scoringWarnings: [],
    ...input,
  };
}

function snap(input: Partial<{
  season: number;
  week: number;
  pfrId: string;
  playerName: string;
  offenseSnaps: number | null;
  offenseSnapShare: number | null;
  defenseSnaps: number | null;
  defenseSnapShare: number | null;
  specialTeamsSnaps: number | null;
  specialTeamsSnapShare: number | null;
}> = {}) {
  return {
    season: input.season ?? 2025,
    week: input.week ?? 1,
    pfrId: input.pfrId ?? "TestP00",
    playerName: input.playerName ?? "Test Player",
    position: "RB" as const,
    team: "TST",
    offenseSnaps: input.offenseSnaps ?? null,
    offenseSnapShare: input.offenseSnapShare ?? null,
    defenseSnaps: input.defenseSnaps ?? null,
    defenseSnapShare: input.defenseSnapShare ?? null,
    specialTeamsSnaps: input.specialTeamsSnaps ?? null,
    specialTeamsSnapShare: input.specialTeamsSnapShare ?? null,
  };
}

function participation(input: Partial<{
  season: number;
  week: number;
  gsisId: string;
  offensePlays: number;
  defensePlays: number;
}> = {}) {
  return {
    season: input.season ?? 2025,
    week: input.week ?? 1,
    gsisId: input.gsisId ?? "00-TEST",
    offensePlays: input.offensePlays ?? 0,
    defensePlays: input.defensePlays ?? 0,
  };
}
