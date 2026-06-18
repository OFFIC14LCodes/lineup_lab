import Link from "next/link";

import { CreateDraftRoomButton } from "@/components/create-draft-room-button";
import { PageShell, Panel, Stat } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

function FormatFlag({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-300">{label}</dt>
      <dd>
        {enabled ? (
          <span className="rounded-full border border-electric/30 bg-electric/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-electric">
            On
          </span>
        ) : (
          <span className="text-slate-500">Off</span>
        )}
      </dd>
    </div>
  );
}

function DraftStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  if (status === "drafting") {
    return (
      <span className="flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-400">
        <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" />
        Live
      </span>
    );
  }
  if (status === "complete") {
    return (
      <span className="rounded-full border border-slate-700/40 bg-panel2 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">
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
      <Link className="text-sm text-slate-400 transition-colors hover:text-electric" href="/leagues">
        ← Back to leagues
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
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{draft.season} {draft.draft_type === "snake" ? "Snake" : (draft.draft_type ?? "Draft")}</span>
                      <DraftStatusBadge status={draft.status} />
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-slate-500">{draft.platform_draft_id}</div>
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
            <FormatFlag label="Dynasty" enabled={!!league.is_dynasty} />
            <FormatFlag label="Best ball" enabled={!!league.is_best_ball} />
            <FormatFlag label="Superflex" enabled={!!league.is_superflex} />
            <FormatFlag label="Two QB" enabled={!!league.is_two_qb} />
            <div className="flex items-center justify-between">
              <dt className="text-slate-300">TE premium</dt>
              <dd className="font-semibold text-slate-100">{league.te_premium ?? 0}</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </PageShell>
  );
}
