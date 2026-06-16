import { NextResponse } from "next/server";

import { createPlayerProfileRepository, toPlayerProfileReadModel } from "@/lib/player-profiles";

export async function GET(request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const url = new URL(request.url);
  const position = url.searchParams.get("position");
  const weeklyLimit = numberParam(url.searchParams.get("weeklyLimit")) ?? 20;
  const repository = createPlayerProfileRepository();
  const lookup = repository.lookupProfile({ playerId: decodeURIComponent(playerId), position });

  if (lookup.duplicateKey) {
    return NextResponse.json({
      error: "Player profile lookup is ambiguous.",
      duplicateKey: lookup.duplicateKey,
      matchedBy: lookup.matchedBy,
    }, { status: 404 });
  }

  if (!lookup.profile) {
    return NextResponse.json({ error: "Player profile not found." }, { status: 404 });
  }

  return NextResponse.json({
    profile: toPlayerProfileReadModel(lookup.profile, { weeklyLimit }),
    lookup: {
      matchedBy: lookup.matchedBy,
      artifactBacked: true,
      readOnly: true,
    },
  });
}

function numberParam(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
