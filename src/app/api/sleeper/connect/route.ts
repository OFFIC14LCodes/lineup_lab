import { NextResponse } from "next/server";

import { connectSleeperAccount } from "@/lib/rosterforge/sync";
import { getSessionUser } from "@/lib/supabase/auth";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { username?: string };
  if (!body.username?.trim()) {
    return NextResponse.json({ error: "Sleeper username is required." }, { status: 400 });
  }

  try {
    const result = await connectSleeperAccount(user.id, body.username);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to connect Sleeper account." },
      { status: 500 }
    );
  }
}
