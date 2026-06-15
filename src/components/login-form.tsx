"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { LogIn } from "lucide-react";

import { BrandLockup } from "@/components/brand";
import { PageShell, Panel } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { AUTH_REQUEST_TIMEOUT_MS, buildAuthCallbackUrl, withAuthTimeout } from "@/lib/supabase/oauth";

export function LoginForm({ authErrorMessage, nextPath }: { authErrorMessage: string | null; nextPath?: string | null }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const loading = emailLoading || googleLoading;

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail || loading) return;

    setEmailLoading(true);
    setStatus(null);
    try {
      const supabase = createClient();
      const callbackUrl = buildAuthCallbackUrl({
        origin: window.location.origin,
        configuredSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        nextPath,
      });
      const { error } = await withAuthTimeout(
        supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: { emailRedirectTo: callbackUrl }
        }),
        AUTH_REQUEST_TIMEOUT_MS,
        "Magic link request timed out. Check Supabase email settings and try again."
      );

      setStatus(error ? error.message : "Check your email for a magic link.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send magic link. Please try again.");
    } finally {
      setEmailLoading(false);
    }
  }

  async function signInWithGoogle() {
    if (loading) return;

    setGoogleLoading(true);
    setStatus(null);
    try {
      const supabase = createClient();
      const callbackUrl = buildAuthCallbackUrl({
        origin: window.location.origin,
        configuredSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        nextPath,
      });
      const { error } = await withAuthTimeout(
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: callbackUrl },
        }),
        AUTH_REQUEST_TIMEOUT_MS,
        "Google sign-in timed out. Please try again."
      );

      if (error) setStatus(error.message || "Could not start Google sign-in. Please try again.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not start Google sign-in. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <PageShell className="max-w-xl">
      <Panel>
        <BrandLockup showTagline />
        <h1 className="text-3xl font-black">Sign in to Blackbird GM</h1>
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
            {emailLoading ? "Sending..." : "Send magic link"}
          </button>
          <div className="flex items-center gap-3 py-2 text-xs uppercase tracking-wide text-slate-500">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
          <button className="rf-button secondary w-full" type="button" disabled={loading} onClick={signInWithGoogle}>
            {googleLoading ? "Redirecting..." : "Continue with Google"}
          </button>
          {status ? <p className="text-sm text-slate-300">{status}</p> : null}
        </form>
      </Panel>
    </PageShell>
  );
}
