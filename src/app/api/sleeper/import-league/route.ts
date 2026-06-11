import { NextResponse } from "next/server";

import { importSleeperLeague } from "@/lib/rosterforge/sync";
import { getSessionUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { platformLeagueId?: string };
  if (!body.platformLeagueId) {
    return NextResponse.json({ error: "platformLeagueId is required." }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: league, error: leagueError } = await supabase
      .from("leagues")
      .select("id")
      .eq("platform_league_id", body.platformLeagueId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (leagueError) {
      return NextResponse.json({ error: "Unable to verify league access." }, { status: 500 });
    }

    if (!league) {
      return NextResponse.json({ error: "League not found for this account." }, { status: 404 });
    }

    const importedLeague = await importSleeperLeague(user.id, body.platformLeagueId);
    return NextResponse.json({ league: importedLeague });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to import league." },
      { status: 500 }
    );
  }
}
