import Link from "next/link";

import { ImportLeagueButton } from "@/components/import-league-button";
import { EmptyState, PageShell, Panel } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

function LeagueStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  if (status === "in_season") return null;
  if (status === "drafting") {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        Drafting
      </span>
    );
  }
  if (status === "pre_draft") {
    return (
      <span className="rounded-full border border-slate-600/50 bg-slate-700/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
        Pre-Draft
      </span>
    );
  }
  if (status === "complete") {
    return (
      <span className="rounded-full border border-slate-700/40 bg-panel2 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
        Complete
      </span>
    );
  }
  return (
    <span className="rounded-full border border-slate-700/40 bg-panel2 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">
      {status}
    </span>
  );
}

export default async function LeaguesPage() {
  await requireUser();
  const supabase = await createClient();
  const { data: leagues } = await supabase
    .from("leagues")
    .select("*")
    .order("season", { ascending: false })
    .order("name", { ascending: true });

  return (
    <PageShell>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-black">Leagues</h1>
          <p className="mt-2 text-slate-400">Imported Sleeper leagues for your account.</p>
        </div>
        <Link href="/connect/sleeper" className="rf-button secondary">
          Refresh Sleeper
        </Link>
      </div>
      <div className="mt-8 grid gap-4">
        {!leagues?.length ? (
          <EmptyState title="No leagues yet" body="Connect Sleeper to import your current-season leagues." />
        ) : (
          leagues.map((league) => (
            <Panel key={league.id} className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <div className="flex items-center gap-3">
                  <Link className="text-xl font-bold hover:text-electric" href={`/leagues/${league.id}`}>
                    {league.name}
                  </Link>
                  <LeagueStatusBadge status={league.status} />
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  {league.season} · {league.total_teams ?? "?"} teams
                </p>
              </div>
              <ImportLeagueButton platformLeagueId={league.platform_league_id} />
            </Panel>
          ))
        )}
      </div>
    </PageShell>
  );
}
