import Link from "next/link";
import { ArrowRight, ShieldCheck, Trophy } from "lucide-react";

import { PageShell, Panel } from "@/components/ui";

export default function Home() {
  return (
    <PageShell className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
      <section className="py-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-sm text-slate-300">
          <Trophy className="h-4 w-4 text-gold" />
          Sleeper-first draft command center
        </div>
        <h1 className="max-w-3xl text-5xl font-black leading-tight text-white md:text-7xl">
          RosterForge
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
          Connect Sleeper, import your leagues, and monitor live draft picks with a clean
          foundation for rankings, roster needs, and future AI recommendations.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login" className="rf-button">
            Start drafting <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/dashboard" className="rf-button secondary">
            Dashboard
          </Link>
        </div>
      </section>
      <Panel className="shadow-glow">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-forge" />
          <div>
            <h2 className="text-xl font-bold">Milestone foundation</h2>
            <p className="text-sm text-slate-400">Auth, sync, polling, and draft state.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 text-sm text-slate-300">
          {["Supabase Auth + RLS", "Sleeper public API sync", "Live draft room polling", "Rankings CSV upload"].map(
            (item) => (
              <div key={item} className="rounded-md border border-line bg-panel2 px-3 py-3">
                {item}
              </div>
            )
          )}
        </div>
      </Panel>
    </PageShell>
  );
}
