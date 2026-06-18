import Link from "next/link";
import { ArrowRight, LayoutGrid, Swords, Upload, UserPlus } from "lucide-react";

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

  const nextActions = [
    {
      href: "/connect/sleeper" as const,
      icon: UserPlus,
      label: "Connect Sleeper",
      description: "Import your current-season leagues",
    },
    {
      href: "/leagues" as const,
      icon: LayoutGrid,
      label: "View Leagues",
      description: "Browse imported leagues and draft rooms",
    },
    {
      href: "/rankings" as const,
      icon: Upload,
      label: "Upload Rankings",
      description: "Load a CSV to power your draft board",
    },
  ];

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
            Upload Rankings
          </Link>
        </div>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Stat label="Leagues" value={leagues ?? 0} accent />
        <Stat label="Draft rooms" value={draftRooms ?? 0} />
        <Stat label="Sleeper account" value={account?.platform_username ?? "—"} />
      </div>
      <Panel className="mt-8">
        <div className="flex items-center gap-2">
          <Swords className="h-4 w-4 text-electric" />
          <h2 className="text-xl font-bold">Next Actions</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {nextActions.map(({ href, icon: Icon, label, description }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-3 rounded-xl border border-line bg-panel2 p-4 transition-colors hover:border-electric/30 hover:bg-electric/5"
            >
              <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-electric/20 bg-electric/10 text-electric transition-colors group-hover:bg-electric/20">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-slate-100">{label}</span>
                  <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-500 transition-colors group-hover:text-electric" />
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      </Panel>
    </PageShell>
  );
}
