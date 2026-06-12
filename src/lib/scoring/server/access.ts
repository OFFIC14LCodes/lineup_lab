import "server-only";

import { notFound } from "next/navigation";

import { getBooleanEnv } from "@/lib/env";
import { SCORING_INSPECTOR_ERROR_CODES, ScoringInspectorError } from "@/lib/scoring/server/errors";
import { getSessionUser, requireUser } from "@/lib/supabase/auth";

export const SCORING_INSPECTOR_FEATURE_FLAG = "ENABLE_SCORING_INSPECTOR";

export function isScoringInspectorEnabled() {
  return getBooleanEnv(SCORING_INSPECTOR_FEATURE_FLAG, false);
}

export async function requireScoringInspectorAccess() {
  if (!isScoringInspectorEnabled()) {
    notFound();
  }

  return requireUser();
}

export async function requireScoringInspectorApiAccess() {
  if (!isScoringInspectorEnabled()) {
    throw new ScoringInspectorError(
      SCORING_INSPECTOR_ERROR_CODES.inspectorDisabled,
      "Scoring inspector is disabled.",
      403
    );
  }

  const user = await getSessionUser();
  if (!user) {
    throw new ScoringInspectorError(
      SCORING_INSPECTOR_ERROR_CODES.authRequired,
      "Authentication is required.",
      401
    );
  }

  return user;
}
