import Link from "next/link";

import { RankingsUpload } from "@/components/rankings-upload";
import { SyncPlayersButton } from "@/components/sync-players-button";
import { PageShell, Panel } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function RankingsPage({
  searchParams
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const filter = params.filter ?? "all";
  const supabase = await createClient();

  const [{ data: leagues }, rankingsResult] = await Promise.all([
    supabase.from("leagues").select("id,name,season").order("name"),
    buildRankingsQuery(supabase, filter)
  ]);
  const rankings = rankingsResult.data ?? [];

  return (
    <PageShell>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-black">Rankings</h1>
          <p className="mt-2 text-slate-400">Manage manual rankings and Sleeper player matching.</p>
        </div>
        <Link href="/dashboard" className="rf-button secondary">
          Dashboard
        </Link>
      </div>

      <div className="mt-8 grid gap-6">
        <SyncPlayersButton />
        <Panel>
          <h2 className="text-xl font-bold">Upload CSV</h2>
          <RankingsUpload leagues={leagues ?? []} />
        </Panel>
        <Panel>
          {/* TODO: Build UI to manually resolve unmatched/ambiguous ranking rows to Sleeper players. */}
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <h2 className="text-xl font-bold">Latest rankings</h2>
            <div className="flex flex-wrap gap-2 text-sm">
              {[
                { value: "all", label: "All" },
                { value: "matched", label: "Matched" },
                { value: "unmatched", label: "Unmatched" },
                { value: "ambiguous", label: "Needs Review" },
              ].map(({ value, label }) => (
                <Link
                  key={value}
                  className={`rounded border px-3 py-2 ${
                    filter === value ? "border-electric bg-electric text-background" : "border-line bg-panel2"
                  }`}
                  href={`/rankings?filter=${value}`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-panel2 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-3">Rank</th>
                  <th className="px-3 py-3">Player</th>
                  <th className="px-3 py-3">Matched Sleeper</th>
                  <th className="px-3 py-3">Pos</th>
                  <th className="px-3 py-3">Team</th>
                  <th className="px-3 py-3">Proj</th>
                  <th className="px-3 py-3">ADP</th>
                  <th className="px-3 py-3">Dynasty</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((ranking) => (
                  <tr key={ranking.id} className="border-t border-line">
                    <td className="px-3 py-3 font-mono">{ranking.rank ?? "-"}</td>
                    <td className="px-3 py-3 font-bold">{ranking.player_name}</td>
                    <td className="px-3 py-3">{ranking.players?.full_name ?? ranking.sleeper_player_id ?? "-"}</td>
                    <td className="px-3 py-3">{ranking.position ?? "-"}</td>
                    <td className="px-3 py-3">{ranking.team ?? "-"}</td>
                    <td className="px-3 py-3 font-mono">{ranking.projected_points ?? "-"}</td>
                    <td className="px-3 py-3 font-mono">{ranking.adp ?? "-"}</td>
                    <td className="px-3 py-3 font-mono">{ranking.dynasty_value ?? "-"}</td>
                    <td className="px-3 py-3">{ranking.match_status ?? "unmatched"}</td>
                    <td className="px-3 py-3 font-mono">
                      {ranking.match_confidence === null || ranking.match_confidence === undefined
                        ? "-"
                        : Number(ranking.match_confidence).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {rankings.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-slate-400" colSpan={10}>
                      No rankings found for this filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}

function buildRankingsQuery(supabase: Awaited<ReturnType<typeof createClient>>, filter: string) {
  let query = supabase
    .from("draft_rankings")
    .select("*, players:matched_player_id(full_name)")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (filter === "matched") query = query.not("matched_player_id", "is", null);
  if (filter === "unmatched") query = query.eq("match_status", "unmatched");
  if (filter === "ambiguous") query = query.eq("match_status", "ambiguous");

  return query;
}
