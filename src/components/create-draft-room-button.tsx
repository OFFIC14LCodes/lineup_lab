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

  async function createRoom() {
    setLoading(true);
    const response = await fetch("/api/draft-rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leagueId, platformDraftId })
    });
    const payload = (await response.json()) as { draftRoom?: { id: string }; error?: string };
    setLoading(false);
    if (payload.draftRoom?.id) {
      router.push(`/drafts/${payload.draftRoom.id}`);
    }
  }

  return (
    <button className="rf-button" onClick={createRoom} disabled={loading}>
      <DoorOpen className="h-4 w-4" />
      {loading ? "Opening..." : "Open war room"}
    </button>
  );
}
