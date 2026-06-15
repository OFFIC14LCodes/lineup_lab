import "server-only";

import { notFound } from "next/navigation";

import { getBooleanEnv } from "@/lib/env";
import { requireUser } from "@/lib/supabase/auth";

export const BASELINE_PROJECTIONS_FEATURE_FLAG = "ENABLE_BASELINE_PROJECTIONS";

export function isBaselineProjectionsEnabled() {
  return getBooleanEnv(BASELINE_PROJECTIONS_FEATURE_FLAG, false);
}

export async function requireBaselineProjectionsAccess() {
  if (!isBaselineProjectionsEnabled()) {
    notFound();
  }

  return requireUser();
}
