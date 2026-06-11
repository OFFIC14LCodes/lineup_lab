import { NextResponse } from "next/server";

import { createDraftRoomForDraft } from "@/lib/rosterforge/sync";
import { getSessionUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { leagueId?: string; platformDraftId?: string };
  if (!body.leagueId || !body.platformDraftId) {
    return NextResponse.json({ error: "leagueId and platformDraftId are required." }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: league, error: leagueError } = await supabase
      .from("leagues")
      .select("id")
      .eq("id", body.leagueId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (leagueError) {
      return NextResponse.json({ error: "Unable to verify league access." }, { status: 500 });
    }

    if (!league) {
      return NextResponse.json({ error: "League not found." }, { status: 404 });
    }

    const draftRoom = await createDraftRoomForDraft(user.id, body.leagueId, body.platformDraftId);
    return NextResponse.json({ draftRoom });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create draft room." },
      { status: 500 }
    );
  }
}
