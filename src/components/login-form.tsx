"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { LogIn } from "lucide-react";

import { BrandLockup } from "@/components/brand";
import { PageShell, Panel } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

const MAGIC_LINK_TIMEOUT_MS = 15000;

export function LoginForm({ authErrorMessage }: { authErrorMessage: string | null }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail || loading) return;

    setLoading(true);
    setStatus(null);
    try {
      const supabase = createClient();
      const redirectOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || window.location.origin;
      const { error } = await withTimeout(
        supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: { emailRedirectTo: `${redirectOrigin}/auth/callback` }
        }),
        MAGIC_LINK_TIMEOUT_MS
      );

      setStatus(error ? error.message : "Check your email for a magic link.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send magic link. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell className="max-w-xl">
      <Panel>
        <BrandLockup showTagline />
        <h1 className="text-3xl font-black">Sign in</h1>
        <p className="mt-2 text-sm text-slate-400">
          Use your email to access the Blackbird GM draft room via secure magic link.
        </p>
        {authErrorMessage ? (
          <p className="mt-4 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {authErrorMessage}
          </p>
        ) : null}
        <form className="mt-6 space-y-3" onSubmit={signIn}>
          <input
            className="rf-input"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button className="rf-button w-full" type="submit" disabled={loading || !email.trim()}>
            <LogIn className="h-4 w-4" />
            {loading ? "Sending..." : "Send magic link"}
          </button>
          {status ? <p className="text-sm text-slate-300">{status}</p> : null}
        </form>
      </Panel>
    </PageShell>
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Magic link request timed out. Check Supabase email settings and try again.")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
