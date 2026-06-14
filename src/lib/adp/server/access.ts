import "server-only";

import { notFound } from "next/navigation";

import { getBooleanEnv } from "@/lib/env";
import { requireUser } from "@/lib/supabase/auth";

export const ADP_BOARD_FEATURE_FLAG = "ENABLE_ADP_BOARD";

export function isAdpBoardEnabled() {
  return getBooleanEnv(ADP_BOARD_FEATURE_FLAG, false);
}

export async function requireAdpBoardAccess() {
  if (!isAdpBoardEnabled()) {
    notFound();
  }
  return requireUser();
}
