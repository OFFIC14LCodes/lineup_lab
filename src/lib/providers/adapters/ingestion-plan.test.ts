import { describe, expect, it } from "vitest";

import { createIngestionPlan } from "@/lib/providers/adapters/ingestion-plan";
import type { AdapterWeeklyStatsRecord, IdentityResolutionResult } from "@/lib/providers/adapters/types";

const record: AdapterWeeklyStatsRecord = {
  kind: "weekly_stats",
  provider: "manual",
  providerExternalId: "abc",
  externalType: "player",
  fullName: "Player One",
  firstName: null,
  lastName: null,
  team: "ATL",
  rawPosition: "WR",
  positionGroup: "WR",
  season: 2026,
  week: 1,
  seasonType: "regular",
  gameId: null,
  opponent: "CAR",
  homeAway: "home",
  gameDate: null,
  stats: { receiving_yards: 88 },
  providerFantasyPoints: null,
  dataVersion: null,
  sourceUpdatedAt: null,
  sourceRecordId: "src-1",
  metadata: { raw: true }
};

function identity(status: IdentityResolutionResult["status"], playerId: string | null): IdentityResolutionResult {
  return {
    status,
    playerId,
    provider: "manual",
    providerExternalId: "abc",
    externalType: "player",
    mappingStatus: null,
    mappingMethod: null,
    confidence: null,
    reasons: [status],
    warnings: [],
    candidatePlayerIds: playerId ? [playerId] : []
  };
}

describe("ingestion plan", () => {
  it("places every record into exactly one outcome and reconciles totals", () => {
    const plan = createIngestionPlan(
      [
        { record, identity: identity("resolved", "11111111-1111-4111-8111-111111111111"), sourceIndex: 0 },
        { record: { ...record, sourceRecordId: "src-2" }, identity: identity("manual_review", null), sourceIndex: 1 },
        { record: { ...record, sourceRecordId: "src-3" }, identity: identity("unresolved", null), sourceIndex: 2 }
      ],
      [{ code: "warn", message: "warning", severity: "warning" }],
      [{ record: "bad", issues: [{ code: "bad", message: "bad", severity: "error" }], sourceIndex: 3 }]
    );

    expect(plan.ready).toHaveLength(1);
    expect(plan.ready[0].playerId).toBe("11111111-1111-4111-8111-111111111111");
    expect(plan.manualReview).toHaveLength(1);
    expect(plan.unresolved).toHaveLength(1);
    expect(plan.rejected).toHaveLength(1);
    expect(plan.summary).toEqual({
      total: 4,
      ready: 1,
      unresolved: 1,
      manualReview: 1,
      rejected: 1
    });
  });
});
