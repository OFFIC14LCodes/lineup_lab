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
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it("exchanges code for a Supabase session", async () => {
    const { GET } = await import("@/app/auth/callback/route");

    await GET(new Request("http://localhost:3000/auth/callback?code=abc&next=/settings"));

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledTimes(1);
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
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=auth_callback_missing_code&next=%2Fsettings");
    expect(console.warn).toHaveBeenCalledWith("[supabase-oauth-callback]", expect.objectContaining({
      codeExists: false,
      requestOrigin: "http://localhost:3000",
      safeNext: "/settings",
    }));
  });

  it("redirects to login when code exchange fails", async () => {
    const error = new Error("bad code") as Error & { status: number };
    error.status = 400;
    mocks.exchangeCodeForSession.mockResolvedValue({ error });
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request("http://localhost:3000/auth/callback?code=bad&next=/settings"));

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=auth_callback_exchange_failed&next=%2Fsettings&exchange_error=bad+code");
    expect(console.warn).toHaveBeenCalledWith("[supabase-oauth-callback]", expect.objectContaining({
      codeExists: true,
      exchangeCodeForSessionErrorMessage: "bad code",
      exchangeCodeForSessionErrorStatus: 400,
      requestOrigin: "http://localhost:3000",
    }));
  });

  it("logs OAuth provider errors returned to callback without exchanging", async () => {
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request("http://localhost:3006/auth/callback?error=server_error&error_code=unexpected_failure&error_description=Unable%20to%20exchange%20external%20code&next=/settings"));

    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost:3006/login?error=auth_callback_missing_code&next=%2Fsettings&oauth_error=server_error&oauth_error_code=unexpected_failure&oauth_error_description=Unable+to+exchange+external+code");
    expect(console.warn).toHaveBeenCalledWith("[supabase-oauth-callback]", expect.objectContaining({
      codeExists: false,
      error: "server_error",
      error_code: "unexpected_failure",
      error_description: "Unable to exchange external code",
      next: "/settings",
      safeNext: "/settings",
      requestOrigin: "http://localhost:3006",
    }));
  });

  it("redirects safely on localhost:3006", async () => {
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request("http://localhost:3006/auth/callback?code=abc&next=/settings"));

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(response.headers.get("location")).toBe("http://localhost:3006/settings");
  });

  it("redirects safely on production origin", async () => {
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(new Request("https://blackbirdgm.com/auth/callback?code=abc&next=/settings"));

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(response.headers.get("location")).toBe("https://blackbirdgm.com/settings");
  });
});
