import "server-only";

import { notFound } from "next/navigation";

import { getBooleanEnv } from "@/lib/env";
import { IMPORT_ERROR_CODES, ImportWorkflowError } from "@/lib/providers/import/errors";
import { requireUser } from "@/lib/supabase/auth";
import { getSessionUser } from "@/lib/supabase/auth";

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

export async function requireProviderImportApiAccess() {
  if (!isProviderDataImportEnabled()) {
    throw new ImportWorkflowError(
      IMPORT_ERROR_CODES.importDisabled,
      "Provider data import is disabled.",
      403
    );
  }

  const user = await getSessionUser();
  if (!user) {
    throw new ImportWorkflowError(
      IMPORT_ERROR_CODES.authRequired,
      "Authentication is required.",
      401
    );
  }

  return user;
}
