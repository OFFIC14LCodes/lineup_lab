import { NextResponse } from "next/server";

import { getDraftRoomState } from "@/lib/rosterforge/state";
import { getSessionUser } from "@/lib/supabase/auth";

export async function GET(_: Request, { params }: { params: Promise<{ draftRoomId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { draftRoomId } = await params;
    const state = await getDraftRoomState(user.id, draftRoomId);
    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load draft room state." },
      { status: 500 }
    );
  }
}
