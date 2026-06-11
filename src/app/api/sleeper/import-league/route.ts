import { NextResponse } from "next/server";

import { importSleeperLeague } from "@/lib/rosterforge/sync";
import { getSessionUser } from "@/lib/supabase/auth";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { platformLeagueId?: string };
  if (!body.platformLeagueId) {
    return NextResponse.json({ error: "platformLeagueId is required." }, { status: 400 });
  }

  try {
    const league = await importSleeperLeague(user.id, body.platformLeagueId);
    return NextResponse.json({ league });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to import league." },
      { status: 500 }
    );
  }
}
