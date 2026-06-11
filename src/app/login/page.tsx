"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";

import { BrandLockup } from "@/components/brand";
import { PageShell, Panel } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    setStatus(null);
    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` }
    });

    setLoading(false);
    setStatus(error ? error.message : "Check your email for a magic link.");
  }

  return (
    <PageShell className="max-w-xl">
      <Panel>
        <BrandLockup showTagline />
        <h1 className="text-3xl font-black">Sign in</h1>
        <p className="mt-2 text-sm text-slate-400">
          Use your email to access the Blackbird GM draft room via secure magic link.
        </p>
        <div className="mt-6 space-y-3">
          <input
            className="rf-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button className="rf-button w-full" onClick={signIn} disabled={loading || !email}>
            <LogIn className="h-4 w-4" />
            {loading ? "Sending..." : "Send magic link"}
          </button>
          {status ? <p className="text-sm text-slate-300">{status}</p> : null}
        </div>
      </Panel>
    </PageShell>
  );
}
