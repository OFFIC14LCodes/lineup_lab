import Link from "next/link";
import { ArrowRight, Eye, ShieldCheck, Trophy } from "lucide-react";

import { BrandLockup } from "@/components/brand";
import { PageShell, Panel } from "@/components/ui";

export default function Home() {
  return (
    <PageShell className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
      <section className="py-8">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-black/20 px-3 py-1 text-sm text-slate-300">
          <Eye className="h-4 w-4 text-gold" />
          Blackbird war room for Sleeper drafts
        </div>
        <BrandLockup size="lg" priority showTagline />
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          Import your Sleeper leagues, track live draft movement, and work from one clean command
          surface built for sharper rankings, roster awareness, and in-draft decision speed.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login" className="rf-button">
            Enter the war room <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/dashboard" className="rf-button secondary">
            Dashboard
          </Link>
        </div>
        <div className="mt-8 grid max-w-2xl gap-3 text-sm text-slate-300 sm:grid-cols-3">
          {[
            "Sleeper league import",
            "Live draft room monitoring",
            "Manual rankings control"
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-line bg-black/20 px-4 py-3">
              {item}
            </div>
          ))}
        </div>
      </section>
      <Panel className="shadow-glow">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-forge" />
          <div>
            <h2 className="text-xl font-bold">Stealth stack</h2>
            <p className="text-sm text-slate-400">Core systems for auth, sync, polling, and draft state.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 text-sm text-slate-300">
          {["Supabase auth + RLS", "Sleeper public API sync", "Live draft room polling", "Rankings CSV upload"].map(
            (item) => (
              <div key={item} className="rounded-2xl border border-line bg-panel2/70 px-3 py-3">
                {item}
              </div>
            )
          )}
        </div>
        <div className="mt-6 rounded-2xl border border-gold/20 bg-[linear-gradient(135deg,rgba(201,164,92,0.14),rgba(201,164,92,0.03))] p-4">
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-gold/80">
            <Trophy className="h-4 w-4" />
            New identity
          </div>
          <p className="mt-2 text-sm leading-7 text-slate-300">
            The Blackbird GM brand shifts the product from generic draft tooling to a sharper,
            film-room-style command center.
          </p>
        </div>
      </Panel>
    </PageShell>
  );
}
