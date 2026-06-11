import { NextResponse } from "next/server";

import { syncSleeperPlayers } from "@/lib/players/sync";
import { getSessionUser } from "@/lib/supabase/auth";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await syncSleeperPlayers();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sync Sleeper players." },
      { status: 500 }
    );
  }
}
