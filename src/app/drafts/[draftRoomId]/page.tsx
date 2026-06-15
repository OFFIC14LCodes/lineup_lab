import Link from "next/link";

import { DraftWarRoom } from "@/components/draft-war-room";
import { PageShell } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";

export default async function DraftRoomPage({ params }: { params: Promise<{ draftRoomId: string }> }) {
  await requireUser();
  const { draftRoomId } = await params;

  return (
    <PageShell className="max-w-[1800px]">
      <Link className="mb-4 inline-block text-sm text-brand" href="/leagues">
        Back to leagues
      </Link>
      <DraftWarRoom draftRoomId={draftRoomId} disableAutoSync={process.env.DISABLE_WAR_ROOM_AUTO_SYNC_FOR_E2E === "true"} />
    </PageShell>
  );
}
