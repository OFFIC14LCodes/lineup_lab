import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("LoginForm Google OAuth wiring", () => {
  const source = readFileSync(path.join(process.cwd(), "src", "components", "login-form.tsx"), "utf8");

  it("preserves magic-link sign-in", () => {
    expect(source).toContain("signInWithOtp");
    expect(source).toContain("emailRedirectTo");
    expect(source).toContain("Send magic link");
  });

  it("adds a non-submit Google OAuth button", () => {
    expect(source).toContain('type="button"');
    expect(source).toContain("Continue with Google");
    expect(source).toContain("Redirecting...");
  });

  it("starts Supabase Google OAuth with the shared callback URL", () => {
    expect(source).toContain("signInWithOAuth");
    expect(source).toContain('provider: "google"');
    expect(source).toContain("redirectTo: callbackUrl");
    expect(source).toContain("buildAuthCallbackUrl");
  });

  it("does not expose Google provider secrets in the client component", () => {
    expect(source).not.toContain("GOOGLE_CLIENT_SECRET");
    expect(source).not.toContain("GOOGLE_CLIENT_ID");
  });
});
