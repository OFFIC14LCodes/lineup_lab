import Link from "next/link";

import { DraftWarRoom } from "@/components/draft-war-room";
import { PageShell } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";

export default async function DraftRoomPage({ params }: { params: Promise<{ draftRoomId: string }> }) {
  await requireUser();
  const { draftRoomId } = await params;

  return (
    <PageShell>
      <Link className="mb-4 inline-block text-sm text-forge" href="/leagues">
        Back to leagues
      </Link>
      <DraftWarRoom draftRoomId={draftRoomId} />
    </PageShell>
  );
}
