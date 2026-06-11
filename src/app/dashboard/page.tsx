import Link from "next/link";
import { Upload, UserPlus } from "lucide-react";

import { PageShell, Panel, Stat } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ count: leagues }, { count: draftRooms }, { data: account }] = await Promise.all([
    supabase.from("leagues").select("*", { count: "exact", head: true }),
    supabase.from("draft_rooms").select("*", { count: "exact", head: true }),
    supabase.from("fantasy_accounts").select("*").eq("platform", "sleeper").maybeSingle()
  ]);

  return (
    <PageShell>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-black">Dashboard</h1>
          <p className="mt-2 text-slate-400">{user.email}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/connect/sleeper" className="rf-button">
            <UserPlus className="h-4 w-4" />
            Connect Sleeper
          </Link>
          <Link href="/rankings" className="rf-button secondary">
            <Upload className="h-4 w-4" />
            Upload rankings
          </Link>
        </div>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Stat label="Imported leagues" value={leagues ?? 0} accent />
        <Stat label="Draft rooms" value={draftRooms ?? 0} />
        <Stat label="Sleeper account" value={account?.platform_username ?? "Not connected"} />
      </div>
      <Panel className="mt-8">
        <h2 className="text-xl font-bold">Next actions</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Link className="rounded-md border border-line bg-panel2 p-4" href="/connect/sleeper">
            Connect or refresh Sleeper leagues
          </Link>
          <Link className="rounded-md border border-line bg-panel2 p-4" href="/leagues">
            Open imported league list
          </Link>
          <Link className="rounded-md border border-line bg-panel2 p-4" href="/rankings">
            Upload draft rankings CSV
          </Link>
        </div>
      </Panel>
    </PageShell>
  );
}
