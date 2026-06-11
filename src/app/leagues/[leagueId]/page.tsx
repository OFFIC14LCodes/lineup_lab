import Link from "next/link";

import { CreateDraftRoomButton } from "@/components/create-draft-room-button";
import { PageShell, Panel, Stat } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function LeaguePage({ params }: { params: Promise<{ leagueId: string }> }) {
  await requireUser();
  const { leagueId } = await params;
  const supabase = await createClient();

  const [{ data: league }, { data: rosters }, { data: managers }, { data: drafts }] = await Promise.all([
    supabase.from("leagues").select("*").eq("id", leagueId).single(),
    supabase.from("league_rosters").select("*").eq("league_id", leagueId).order("platform_roster_id"),
    supabase.from("league_users").select("*").eq("league_id", leagueId).order("display_name"),
    supabase.from("draft_rooms").select("*").eq("league_id", leagueId).order("created_at", { ascending: false })
  ]);

  if (!league) {
    return (
      <PageShell>
        <Panel>League not found.</Panel>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Link className="text-sm text-forge" href="/leagues">
        Back to leagues
      </Link>
      <div className="mt-4 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-black">{league.name}</h1>
          <p className="mt-2 text-slate-400">
            {league.season} · {league.status ?? "unknown"} · Last synced{" "}
            {league.last_synced_at ? new Date(league.last_synced_at).toLocaleString() : "never"}
          </p>
        </div>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Stat label="Teams" value={league.total_teams ?? rosters?.length ?? 0} />
        <Stat label="Rosters" value={rosters?.length ?? 0} />
        <Stat label="Managers" value={managers?.length ?? 0} />
        <Stat label="Drafts" value={drafts?.length ?? 0} accent />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <Panel>
          <h2 className="text-xl font-bold">Drafts</h2>
          <div className="mt-4 space-y-3">
            {!drafts?.length ? (
              <p className="text-sm text-slate-400">Sync this league to import draft rooms.</p>
            ) : (
              drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="flex flex-col justify-between gap-3 rounded-md border border-line bg-panel2 p-4 md:flex-row md:items-center"
                >
                  <div>
                    <div className="font-bold">{draft.platform_draft_id}</div>
                    <div className="text-sm text-slate-400">
                      {draft.season} · {draft.draft_type ?? "draft"} · {draft.status ?? "unknown"}
                    </div>
                  </div>
                  <CreateDraftRoomButton leagueId={league.id} platformDraftId={draft.platform_draft_id} />
                </div>
              ))
            )}
          </div>
        </Panel>
        <Panel>
          <h2 className="text-xl font-bold">Format flags</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between"><dt>Dynasty</dt><dd>{league.is_dynasty ? "Yes" : "No"}</dd></div>
            <div className="flex justify-between"><dt>Best ball</dt><dd>{league.is_best_ball ? "Yes" : "No"}</dd></div>
            <div className="flex justify-between"><dt>Superflex</dt><dd>{league.is_superflex ? "Yes" : "No"}</dd></div>
            <div className="flex justify-between"><dt>Two QB</dt><dd>{league.is_two_qb ? "Yes" : "No"}</dd></div>
            <div className="flex justify-between"><dt>TE premium</dt><dd>{league.te_premium ?? 0}</dd></div>
          </dl>
        </Panel>
      </div>
    </PageShell>
  );
}
