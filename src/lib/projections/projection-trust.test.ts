import { describe, expect, it } from "vitest";

import { buildProjectionTrust, projectionTrustBadgeLabel } from "./projection-trust";

describe("projection trust", () => {
  it("scores comprehensive stat-backed season projections higher", () => {
    const trust = buildProjectionTrust({
      playerId: "p1",
      playerName: "Starter LB",
      position: "LB",
      projectionRunId: "run",
      projectionVersion: "comprehensive-stat-projections-v1",
      projectionUnit: "season",
      projectionType: "veteran",
      confidence: "medium",
      stats: { solo_tkl: { median: 80 }, sack: { median: 4 } },
      floorPoints: 180,
      medianPoints: 240,
      ceilingPoints: 290,
    });

    expect(trust.projectionSource).toBe("comprehensive_stat_projection");
    expect(trust.hasStatBackedProjection).toBe(true);
    expect(trust.trustLabel).toMatch(/medium|high/);
    expect(projectionTrustBadgeLabel(trust)).toContain("Stat-backed season projection");
  });

  it("keeps fallback-only players low trust with an explicit reason", () => {
    const trust = buildProjectionTrust({
      playerId: "p2",
      playerName: "Fallback Player",
      position: "WR",
      projectionUnit: "fallback",
      projectionType: "fallback",
      confidence: "very_low",
      dataGaps: ["missing historical stats", "missing rookie projection inputs"],
      isFallback: true,
    });

    expect(trust.projectionSource).toBe("fallback_projection");
    expect(trust.hasStatBackedProjection).toBe(false);
    expect(trust.trustLabel).toBe("very_low");
    expect(trust.fallbackReason).toBe("missing_scoring_projection");
  });

  it("treats missing scored projections as data gaps, not zeroes", () => {
    const trust = buildProjectionTrust({
      playerId: "p3",
      playerName: "Missing Score",
      position: "RB",
      projectionVersion: "comprehensive-stat-projections-v1",
      projectionUnit: "season",
      stats: { rush_yd: { median: 500 } },
    });

    expect(trust.hasScoredFantasyProjection).toBe(false);
    expect(trust.reasons.join(" ")).toContain("not treated as zero");
    expect(trust.fallbackReason).toBe("missing_scoring_projection");
  });

  it("labels rookie projections cautiously without rookie inputs", () => {
    const trust = buildProjectionTrust({
      playerId: "p4",
      playerName: "Rookie",
      position: "RB",
      projectionType: "rookie",
      projectionUnit: "season",
      confidence: "very_low",
      dataGaps: ["missing NFL draft capital", "missing college production profile", "rookie role uncertainty"],
      stats: { rush_yd: { median: 320 } },
      medianPoints: 70,
    });

    expect(trust.projectionSource).toBe("rookie_projection");
    expect(trust.trustLabel).not.toBe("high");
    expect(trust.dataGaps).toContain("missing NFL draft capital");
  });

  it("separates uploaded and legacy projection sources", () => {
    expect(buildProjectionTrust({ playerName: "Uploaded", projectionSource: "uploaded_ranking_projection", medianPoints: 100 }).projectionSource).toBe("uploaded_projection");
    expect(buildProjectionTrust({ playerName: "Legacy", projectionSource: "h10_league_projection", medianPoints: 100 }).projectionSource).toBe("legacy_projection");
  });
});
