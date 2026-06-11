"use client";

import { useState } from "react";
import { DoorOpen } from "lucide-react";
import { useRouter } from "next/navigation";

export function CreateDraftRoomButton({
  leagueId,
  platformDraftId
}: {
  leagueId: string;
  platformDraftId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/draft-rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leagueId, platformDraftId })
    });
    const payload = (await response.json()) as { draftRoom?: { id: string }; error?: string };
    setLoading(false);
    if (!response.ok) {
      setError(payload.error ?? "Unable to open war room.");
      return;
    }
    if (payload.draftRoom?.id) {
      router.push(`/drafts/${payload.draftRoom.id}`);
      return;
    }
    setError("Unable to open war room.");
  }

  return (
    <div>
      <button className="rf-button" onClick={createRoom} disabled={loading}>
        <DoorOpen className="h-4 w-4" />
        {loading ? "Opening..." : "Open war room"}
      </button>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
