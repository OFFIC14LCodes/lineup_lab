import { describe, expect, it, vi } from "vitest";

import {
  AUTH_CALLBACK_PATH,
  buildAuthCallbackUrl,
  getSafeAuthNextPath,
  withAuthTimeout,
} from "@/lib/supabase/oauth";

describe("Supabase auth OAuth helpers", () => {
  it("builds callback URLs with safe next paths", () => {
    const url = buildAuthCallbackUrl({
      origin: "http://localhost:3000",
      configuredSiteUrl: "",
      nextPath: "/settings",
    });

    expect(url).toBe(`http://localhost:3000${AUTH_CALLBACK_PATH}?next=%2Fsettings`);
  });

  it("uses configured site URL when present", () => {
    const url = buildAuthCallbackUrl({
      origin: "https://preview.blackbirdgm.com",
      configuredSiteUrl: "https://blackbirdgm.com",
      nextPath: "/dashboard",
    });

    expect(url).toBe("https://blackbirdgm.com/auth/callback?next=%2Fdashboard");
  });

  it("uses localhost origin even when NEXT_PUBLIC_SITE_URL is production", () => {
    const url = buildAuthCallbackUrl({
      origin: "http://localhost:3006",
      configuredSiteUrl: "https://blackbirdgm.com",
      nextPath: "/settings",
    });

    expect(url).toBe("http://localhost:3006/auth/callback?next=%2Fsettings");
  });

  it("uses 127.0.0.1 origin even when NEXT_PUBLIC_SITE_URL is production", () => {
    const url = buildAuthCallbackUrl({
      origin: "http://127.0.0.1:3006",
      configuredSiteUrl: "https://blackbirdgm.com",
      nextPath: "/dashboard",
    });

    expect(url).toBe("http://127.0.0.1:3006/auth/callback?next=%2Fdashboard");
  });

  it("rejects absolute and protocol-relative next values", () => {
    expect(getSafeAuthNextPath("https://evil.example/path")).toBe("/dashboard");
    expect(getSafeAuthNextPath("//evil.example/path")).toBe("/dashboard");
    expect(getSafeAuthNextPath("/settings")).toBe("/settings");
  });

  it("times out auth requests with a clear error", async () => {
    vi.useFakeTimers();
    const promise = withAuthTimeout(new Promise(() => undefined), 15000, "Google sign-in timed out. Please try again.");

    vi.advanceTimersByTime(15000);

    await expect(promise).rejects.toThrow("Google sign-in timed out. Please try again.");
    vi.useRealTimers();
  });
});
