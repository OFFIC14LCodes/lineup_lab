import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireScoringInspectorApiAccess: vi.fn(),
  parseScoringInspectorQuery: vi.fn(),
  getLeagueScoringContext: vi.fn(),
  scoreStoredWeeklyStatsForLeague: vi.fn(),
  scoreWeeklyStatsRowsForLeague: vi.fn(),
  scoreStoredSeasonStatsForLeague: vi.fn(),
  scoreSeasonStatsRowsForLeague: vi.fn(),
  scoreStoredProjectionForLeague: vi.fn(),
  scoreProjectionRowsForLeague: vi.fn(),
  toScoringInspectorErrorPayload: vi.fn()
}));

vi.mock("@/lib/scoring/server", () => ({
  requireScoringInspectorApiAccess: mocks.requireScoringInspectorApiAccess,
  parseScoringInspectorQuery: mocks.parseScoringInspectorQuery,
  getLeagueScoringContext: mocks.getLeagueScoringContext,
  scoreStoredWeeklyStatsForLeague: mocks.scoreStoredWeeklyStatsForLeague,
  scoreWeeklyStatsRowsForLeague: mocks.scoreWeeklyStatsRowsForLeague,
  scoreStoredSeasonStatsForLeague: mocks.scoreStoredSeasonStatsForLeague,
  scoreSeasonStatsRowsForLeague: mocks.scoreSeasonStatsRowsForLeague,
  scoreStoredProjectionForLeague: mocks.scoreStoredProjectionForLeague,
  scoreProjectionRowsForLeague: mocks.scoreProjectionRowsForLeague,
  toScoringInspectorErrorPayload: mocks.toScoringInspectorErrorPayload
}));

describe("GET /api/scoring/inspect", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.requireScoringInspectorApiAccess.mockResolvedValue({ id: "user-1" });
    mocks.toScoringInspectorErrorPayload.mockReturnValue({
      status: 500,
      body: {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unable to inspect scoring results."
        }
      }
    });
  });

  it("returns a weekly batch response", async () => {
    mocks.parseScoringInspectorQuery.mockReturnValue({
      leagueId: "league-1",
      sourceType: "weekly_stats",
      rowId: null,
      season: 2026,
      week: 1,
      provider: "manual",
      positionGroup: "WR",
      limit: 5
    });
    mocks.scoreWeeklyStatsRowsForLeague.mockResolvedValue({
      league: { leagueId: "league-1" },
      results: [{ ok: true, result: { source: { rowId: "row-1" } } }]
    });

    const { GET } = await import("@/app/api/scoring/inspect/route");
    const response = await GET(new Request("http://localhost/api/scoring/inspect"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.sourceType).toBe("weekly_stats");
    expect(mocks.scoreWeeklyStatsRowsForLeague).toHaveBeenCalledWith({
      userId: "user-1",
      leagueId: "league-1",
      season: 2026,
      week: 1,
      provider: "manual",
      positionGroup: "WR",
      limit: 5
    });
  });

  it("returns a single-row response when rowId is provided", async () => {
    mocks.parseScoringInspectorQuery.mockReturnValue({
      leagueId: "league-1",
      sourceType: "season_stats",
      rowId: "row-1",
      season: null,
      week: null,
      provider: null,
      positionGroup: null,
      limit: 25
    });
    mocks.getLeagueScoringContext.mockResolvedValue({ leagueId: "league-1", scoringAudit: {} });
    mocks.scoreStoredSeasonStatsForLeague.mockResolvedValue({ source: { rowId: "row-1" } });

    const { GET } = await import("@/app/api/scoring/inspect/route");
    const response = await GET(new Request("http://localhost/api/scoring/inspect"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.results).toEqual([{ ok: true, result: { source: { rowId: "row-1" } } }]);
  });

  it("returns stable errors from the serializer", async () => {
    mocks.parseScoringInspectorQuery.mockImplementation(() => {
      throw new Error("boom");
    });

    const { GET } = await import("@/app/api/scoring/inspect/route");
    const response = await GET(new Request("http://localhost/api/scoring/inspect"));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe("INTERNAL_ERROR");
    expect(mocks.toScoringInspectorErrorPayload).toHaveBeenCalled();
  });
});
