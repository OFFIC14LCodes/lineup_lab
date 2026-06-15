import { beforeEach, describe, expect, it, vi } from "vitest";

import { PreDraftStrategyAccessError } from "@/lib/draft/pre-draft-strategy-endpoint";
import { GET } from "./route";

vi.mock("@/lib/supabase/auth", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/draft/pre-draft-strategy-endpoint", async () => {
  const actual = await vi.importActual<typeof import("@/lib/draft/pre-draft-strategy-endpoint")>(
    "@/lib/draft/pre-draft-strategy-endpoint"
  );
  return {
    PreDraftStrategyAccessError: actual.PreDraftStrategyAccessError,
    getPreDraftStrategyEndpointResponse: vi.fn(),
  };
});

const { getSessionUser } = await import("@/lib/supabase/auth");
const { getPreDraftStrategyEndpointResponse } = await import("@/lib/draft/pre-draft-strategy-endpoint");

describe("GET /api/draft-rooms/[draftRoomId]/pre-draft-strategy", () => {
  beforeEach(() => {
    vi.mocked(getSessionUser).mockReset();
    vi.mocked(getPreDraftStrategyEndpointResponse).mockReset();
  });

  it("returns strategy for an authenticated request", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({ id: "user-1" } as never);
    vi.mocked(getPreDraftStrategyEndpointResponse).mockResolvedValue({
      strategyPreviewLabel: "read-only strategy preview",
      safetyLanguageStatus: { passed: true, failures: [] },
    } as never);

    const response = await GET(new Request("http://localhost"), params("room-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.strategyPreviewLabel).toBe("read-only strategy preview");
    expect(getPreDraftStrategyEndpointResponse).toHaveBeenCalledWith("user-1", "room-1");
  });

  it("fails unauthenticated requests", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), params("room-1"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(getPreDraftStrategyEndpointResponse).not.toHaveBeenCalled();
  });

  it("fails unauthorized draft-room access", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({ id: "user-1" } as never);
    vi.mocked(getPreDraftStrategyEndpointResponse).mockRejectedValue(new PreDraftStrategyAccessError());

    const response = await GET(new Request("http://localhost"), params("other-room"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Draft room not found." });
  });
});

function params(draftRoomId: string) {
  return { params: Promise.resolve({ draftRoomId }) };
}
