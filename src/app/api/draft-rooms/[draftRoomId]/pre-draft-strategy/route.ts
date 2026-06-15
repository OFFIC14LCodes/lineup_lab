import { NextResponse } from "next/server";

import {
  PreDraftStrategyAccessError,
  getPreDraftStrategyEndpointResponse,
} from "@/lib/draft/pre-draft-strategy-endpoint";
import { getSessionUser } from "@/lib/supabase/auth";

export async function GET(_: Request, { params }: { params: Promise<{ draftRoomId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { draftRoomId } = await params;
    const strategy = await getPreDraftStrategyEndpointResponse(user.id, draftRoomId);
    return NextResponse.json(strategy);
  } catch (error) {
    if (error instanceof PreDraftStrategyAccessError) {
      return NextResponse.json({ error: "Draft room not found." }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load pre-draft strategy." },
      { status: 500 }
    );
  }
}
