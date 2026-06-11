import { NextResponse } from "next/server";

import { syncDraftRoomPicks } from "@/lib/rosterforge/sync";
import { getSessionUser } from "@/lib/supabase/auth";

export async function POST(_: Request, { params }: { params: Promise<{ draftRoomId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { draftRoomId } = await params;
    const result = await syncDraftRoomPicks(user.id, draftRoomId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sync draft picks." },
      { status: 500 }
    );
  }
}
