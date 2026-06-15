import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

export const E2E_AUTH_COOKIE = "blackbird_e2e_auth";

export async function getSessionUser() {
  const e2eUser = await getE2ETestUser();
  if (e2eUser) return e2eUser;

  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function requireUser() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

async function getE2ETestUser() {
  if (process.env.NODE_ENV === "production") return null;
  if (process.env.ENABLE_BLACKBIRD_E2E_AUTH_BYPASS !== "true") return null;

  const userId = process.env.BLACKBIRD_E2E_AUTH_USER_ID ?? process.env.SCORING_VALIDATION_OPERATOR_USER_ID;
  if (!userId) return null;

  const cookieStore = await cookies();
  if (cookieStore.get(E2E_AUTH_COOKIE)?.value !== "enabled") return null;

  return {
    id: userId,
    email: "local-e2e@blackbird.test",
    app_metadata: {},
    user_metadata: { authMethod: "local_e2e_bypass" },
    aud: "authenticated",
    created_at: new Date(0).toISOString(),
  };
}
