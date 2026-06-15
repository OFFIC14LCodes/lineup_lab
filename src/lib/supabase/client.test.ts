import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createBrowserClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: mocks.createBrowserClient,
}));

describe("Supabase browser client env loading", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv, NODE_ENV: "test" };
    mocks.createBrowserClient.mockReturnValue({ auth: {} });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws a clear error when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";

    const { createClient } = await import("@/lib/supabase/client");

    expect(() => createClient()).toThrow("Missing required public environment variable: NEXT_PUBLIC_SUPABASE_URL");
  });

  it("uses configured public Supabase env values for the browser client", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";

    const { createClient } = await import("@/lib/supabase/client");
    createClient();

    expect(mocks.createBrowserClient).toHaveBeenCalledWith("https://project.supabase.co", "anon");
  });

  it("does not import server-only Supabase helpers in the browser client or login form", () => {
    const clientSource = readFileSync(path.join(process.cwd(), "src", "lib", "supabase", "client.ts"), "utf8");
    const loginSource = readFileSync(path.join(process.cwd(), "src", "components", "login-form.tsx"), "utf8");

    expect(clientSource).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL");
    expect(clientSource).toContain("process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(clientSource).not.toContain("@/lib/supabase/server");
    expect(loginSource).toContain("@/lib/supabase/client");
    expect(loginSource).not.toContain("@/lib/supabase/server");
  });
});
