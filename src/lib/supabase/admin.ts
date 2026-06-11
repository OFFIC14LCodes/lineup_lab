import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getRequiredEnv } from "@/lib/env";

export function createAdminClient() {
  const url = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
