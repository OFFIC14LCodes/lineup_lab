import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireScoringInspectorApiAccess: vi.fn(),
  parseScoringInspectorQuery: vi.fn(),
  validateLeagueSampleServer: vi.fn(),
  toScoringInspectorErrorPayload: vi.fn()
}));

vi.mock("@/lib/scoring/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scoring/server")>("@/lib/scoring/server");
  return {
    ...actual,
    requireScoringInspectorApiAccess: mocks.requireScoringInspectorApiAccess,
    parseScoringInspectorQuery: mocks.parseScoringInspectorQuery,
    toScoringInspectorErrorPayload: mocks.toScoringInspectorErrorPayload
  };
});

vi.mock("@/lib/scoring/server/validate-league-sample", () => ({
  validateLeagueSampleServer: mocks.validateLeagueSampleServer
}));

describe("GET /api/scoring/validate", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.requireScoringInspectorApiAccess.mockResolvedValue({ id: "user-1" });
    mocks.toScoringInspectorErrorPayload.mockImplementation((error: { status?: number; code?: string; message?: string }) => ({
      status: error?.status ?? 500,
      body: {
        error: {
          code: error?.code ?? "INTERNAL_ERROR",
          message: error?.message ?? "Unable to inspect scoring results."
        }
      }
    }));
  });

  it("returns a validation report", async () => {
    mocks.parseScoringInspectorQuery.mockReturnValue({
      leagueId: "league-1",
      sourceType: "projections",
      season: 2026,
      week: 1,
      provider: "manual",
      positionGroup: "WR",
      projectionType: "weekly",
      limit: 10
    });
    mocks.validateLeagueSampleServer.mockResolvedValue({
      readinessVersion: "blackbird-scoring-readiness-v1"
    });

    const { GET } = await import("@/app/api/scoring/validate/route");
    const response = await GET(new Request("http://localhost/api/scoring/validate"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.readinessVersion).toBe("blackbird-scoring-readiness-v1");
  });

  it("rejects projectionType on non-projection sources", async () => {
    mocks.parseScoringInspectorQuery.mockReturnValue({
      leagueId: "league-1",
      sourceType: "weekly_stats",
      season: 2026,
      week: 1,
      provider: "manual",
      positionGroup: "WR",
      projectionType: "weekly",
      limit: 10
    });

    const { GET } = await import("@/app/api/scoring/validate/route");
    const response = await GET(new Request("http://localhost/api/scoring/validate"));

    expect(response.status).toBe(400);
  });
});
