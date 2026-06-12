import Link from "next/link";

import { ScoringInspectorPanel } from "@/components/scoring-inspector-panel";
import { PageShell, Panel } from "@/components/ui";
import { requireScoringInspectorAccess } from "@/lib/scoring/server";
import { createClient } from "@/lib/supabase/server";

export default async function ScoringInspectorPage() {
  await requireScoringInspectorAccess();

  const supabase = await createClient();
  const { data: leagues } = await supabase
    .from("leagues")
    .select("id,name,season")
    .order("season", { ascending: false })
    .order("name", { ascending: true });

  const currentYear = new Date().getFullYear();

  return (
    <PageShell className="space-y-6">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Scoring Inspector</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Internal-only validation for league-owned Sleeper scoring settings against stored provider stats and projections. This does not affect Draft Target Score or recommendations.
            </p>
          </div>
          <Link href="/settings" className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300">
            Back to settings
          </Link>
        </div>
      </Panel>

      <ScoringInspectorPanel leagues={(leagues ?? []) as Array<{ id: string; name: string | null; season: string | number | null }>} defaultSeason={currentYear} />
    </PageShell>
  );
}
