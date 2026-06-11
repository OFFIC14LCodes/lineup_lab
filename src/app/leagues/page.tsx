import Link from "next/link";

import { ImportLeagueButton } from "@/components/import-league-button";
import { EmptyState, PageShell, Panel } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

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
                <Link className="text-xl font-bold hover:text-forge" href={`/leagues/${league.id}`}>
                  {league.name}
                </Link>
                <p className="mt-1 text-sm text-slate-400">
                  {league.season} · {league.total_teams ?? "?"} teams · {league.status ?? "unknown"}
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
