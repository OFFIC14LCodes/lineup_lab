import "server-only";

import { notFound } from "next/navigation";

import { getBooleanEnv } from "@/lib/env";
import { requireUser } from "@/lib/supabase/auth";

export const PROVIDER_IMPORT_FEATURE_FLAG = "ENABLE_PROVIDER_DATA_IMPORT";

export function isProviderDataImportEnabled() {
  return getBooleanEnv(PROVIDER_IMPORT_FEATURE_FLAG, false);
}

export async function requireProviderImportAccess() {
  if (!isProviderDataImportEnabled()) {
    notFound();
  }

  return requireUser();
}

export async function getProviderImportAccess() {
  if (!isProviderDataImportEnabled()) {
    return { enabled: false as const, user: null };
  }

  const user = await requireUser();
  return { enabled: true as const, user };
}
