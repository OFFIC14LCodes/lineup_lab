import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
    },
  })),
}));

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it("exchanges code for a Supabase session", async () => {
    const { GET } = await import("@/app/auth/callback/route");

    await GET(new Request("http://localhost:3000/auth/callback?code=abc&next=/settings"));

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("abc");
  });

  it("redirects to safe relative next path", async () => {
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request("http://localhost:3000/auth/callback?code=abc&next=/settings"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/settings");
  });

  it("rejects absolute next paths and falls back to dashboard", async () => {
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request("http://localhost:3000/auth/callback?code=abc&next=https://evil.example/path"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("redirects to login when code is missing", async () => {
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request("http://localhost:3000/auth/callback?next=/settings"));

    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=auth_callback_failed");
  });

  it("redirects to login when code exchange fails", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: new Error("bad code") });
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request("http://localhost:3000/auth/callback?code=bad&next=/settings"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=auth_callback_failed");
  });
});
