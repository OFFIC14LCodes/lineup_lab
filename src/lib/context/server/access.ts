import "server-only";

import { notFound } from "next/navigation";

import { getBooleanEnv } from "@/lib/env";
import { requireUser } from "@/lib/supabase/auth";

export const PLAYER_CONTEXT_FEATURE_FLAG = "ENABLE_PLAYER_CONTEXT";

export function isPlayerContextEnabled() {
  return getBooleanEnv(PLAYER_CONTEXT_FEATURE_FLAG, false);
}

export async function requirePlayerContextAccess() {
  if (!isPlayerContextEnabled()) {
    notFound();
  }
  return requireUser();
}
