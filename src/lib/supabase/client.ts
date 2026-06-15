"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  reportBrowserSupabaseEnvDiagnostics({
    supabaseUrlDefined: Boolean(supabaseUrl),
    supabaseAnonKeyDefined: Boolean(supabaseAnonKey),
  });

  if (!supabaseUrl) throw new Error("Missing required public environment variable: NEXT_PUBLIC_SUPABASE_URL. Restart the Next.js dev server after editing .env.local.");
  if (!supabaseAnonKey) throw new Error("Missing required public environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY. Restart the Next.js dev server after editing .env.local.");

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

function reportBrowserSupabaseEnvDiagnostics(input: { supabaseUrlDefined: boolean; supabaseAnonKeyDefined: boolean }) {
  if (process.env.NODE_ENV !== "development") return;
  const isClient = typeof window !== "undefined";
  const origin = isClient ? window.location.origin : "server";
  console.info("[supabase-browser-env]", {
    NEXT_PUBLIC_SUPABASE_URL_defined: input.supabaseUrlDefined,
    NEXT_PUBLIC_SUPABASE_ANON_KEY_defined: input.supabaseAnonKeyDefined,
    origin,
    runtime: isClient ? "client" : "server",
  });
}
