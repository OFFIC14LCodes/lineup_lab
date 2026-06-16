import { NextResponse } from "next/server";

import { createPlayerProfileRepository } from "@/lib/player-profiles/player-profile-repository";
import { toPlayerProfileReadModel } from "@/lib/player-profiles/player-profile-read-model";

export async function GET(request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const url = new URL(request.url);
  const position = url.searchParams.get("position");
  const weeklyLimit = numberParam(url.searchParams.get("weeklyLimit")) ?? 20;
  const includeDiagnostics = url.searchParams.get("diagnostics") === "1";
  const repository = createPlayerProfileRepository();
  const diagnostics = repository.runtimeDiagnostics();

  if (includeDiagnostics) {
    return NextResponse.json({
      status: repository.status,
      diagnostics,
      readOnly: true,
      artifactBacked: true,
    }, { status: repository.status === "ready" ? 200 : 503 });
  }

  if (repository.status !== "ready") {
    return NextResponse.json({
      status: repository.status,
      error: playerProfileArtifactError(repository.status),
      diagnostics,
    }, { status: repository.status === "artifact_missing" ? 503 : 500 });
  }

  const lookup = repository.lookupProfile({ playerId: decodeURIComponent(playerId), position });

  if (lookup.duplicateKey) {
    return NextResponse.json({
      status: "ambiguous_duplicate_lookup",
      error: "Player profile lookup is ambiguous.",
      duplicateKey: lookup.duplicateKey,
      matchedBy: lookup.matchedBy,
    }, { status: 404 });
  }

  if (!lookup.profile) {
    return NextResponse.json({
      status: "profile_not_found",
      error: "Player profile not found.",
    }, { status: 404 });
  }

  return NextResponse.json({
    status: "profile_found",
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

function playerProfileArtifactError(status: string): string {
  if (status === "artifact_missing") return "Player profile artifact is missing from this deployment.";
  if (status === "artifact_unreadable") return "Player profile artifact is not readable in this deployment.";
  if (status === "artifact_invalid") return "Player profile artifact is invalid.";
  return "Player profile artifact is unavailable.";
}
