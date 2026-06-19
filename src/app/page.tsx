import Link from "next/link";
import { ArrowRight, Shield, Target, Zap } from "lucide-react";

import { PageShell } from "@/components/ui";

// ─── Static mock data for the board preview ───────────────────────────────────

const MOCK_ROWS = [
  { rank: 1, name: "CeeDee Lamb", pos: "WR", team: "DAL", val: "+4.2", drafted: false },
  { rank: 2, name: "Ja'Marr Chase", pos: "WR", team: "CIN", val: "+3.8", drafted: false },
  { rank: 3, name: "C. McCaffrey", pos: "RB", team: "SF", val: "+2.1", drafted: true },
  { rank: 4, name: "Justin Jefferson", pos: "WR", team: "MIN", val: "+1.7", drafted: false },
  { rank: 5, name: "Tyreek Hill", pos: "WR", team: "MIA", val: "−0.3", drafted: true },
  { rank: 6, name: "Bijan Robinson", pos: "RB", team: "ATL", val: "+3.1", drafted: false },
] as const;

const FEATURES = [
  {
    Icon: Zap,
    title: "Live Draft Sync",
    body: "Picks flow in from Sleeper automatically. The board updates as the draft moves — you're always working from live state, not a snapshot.",
  },
  {
    Icon: Target,
    title: "Blackbird Board",
    body: "Your rankings fused with projection data, ADP signals, and positional scarcity into one prioritized target list with value scores.",
  },
  {
    Icon: Shield,
    title: "Roster Intelligence",
    body: "Positional need scores, timing windows, and live plan fit ratings guide every pick from round one through the final bench slot.",
  },
] as const;

// ─── Position badge ───────────────────────────────────────────────────────────

function posBadge(pos: string) {
  const map: Record<string, string> = {
    WR: "border-sky-400/40 bg-sky-500/15 text-sky-200",
    RB: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
    QB: "border-red-400/40 bg-red-500/15 text-red-200",
    TE: "border-orange-400/40 bg-orange-500/15 text-orange-200",
  };
  return map[pos] ?? "border-line bg-panel2 text-slate-300";
}

// ─── Mock board preview panel ─────────────────────────────────────────────────

function BoardPreview() {
  return (
    <div className="rf-panel overflow-hidden shadow-glow">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line/60 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-100">Blackbird Board</span>
            <span className="flex items-center gap-1.5 rounded-full border border-electric/35 bg-electric/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-electric">
              <span className="h-1 w-1 animate-pulse rounded-full bg-electric" />
              Live
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500">Pick 23 · Round 3 · 4 picks until your turn</p>
        </div>
        <span className="font-mono text-[11px] text-slate-500">Slot 6 / 12</span>
      </div>

      {/* Column labels */}
      <div className="grid grid-cols-[28px_1fr_44px_40px_52px] gap-3 border-b border-line/30 bg-panel2/50 px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-slate-500">
        <span>#</span>
        <span>Player</span>
        <span>Pos</span>
        <span>Team</span>
        <span className="text-right">Val</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-line/30">
        {MOCK_ROWS.map((row) => (
          <div
            key={row.rank}
            className={`grid grid-cols-[28px_1fr_44px_40px_52px] items-center gap-3 px-4 py-2.5 text-sm ${row.drafted ? "opacity-30" : "hover:bg-panel2/40"}`}
          >
            <span className="font-mono text-[11px] font-black text-slate-500">#{row.rank}</span>
            <span className={`truncate font-semibold ${row.drafted ? "text-slate-500 line-through" : "text-slate-100"}`}>
              {row.name}
            </span>
            <span className={`inline-flex justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-black ${posBadge(row.pos)}`}>
              {row.pos}
            </span>
            <span className="text-[11px] text-slate-400">{row.team}</span>
            <span className={`text-right font-mono text-[11px] font-bold tabular-nums ${row.val.startsWith("+") ? "text-electric" : "text-slate-500"}`}>
              {row.val}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-line/30 px-4 py-3 text-[11px] text-slate-500">
        <span className="font-mono">4 available · <span className="font-semibold text-electric">2 suggested</span></span>
        <span className="font-mono">Rounds 3–5 window</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <PageShell className="space-y-20 py-10 sm:py-16">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="grid items-center gap-12 lg:grid-cols-[1fr_460px] lg:gap-10">

        {/* Copy */}
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-electric/25 bg-electric/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-electric">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-electric" />
            2025 NFL Draft Season
          </div>

          <div>
            <h1 className="font-display text-6xl font-extrabold leading-none text-white sm:text-7xl lg:text-[5.5rem]">
              Blackbird <span className="text-electric">GM</span>
            </h1>
            <p className="mt-3 text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
              Draft War Room Intelligence
            </p>
          </div>

          <p className="max-w-lg text-lg leading-relaxed text-slate-300">
            Import your Sleeper leagues, load your rankings, and run your draft from a clean
            command surface built for faster decisions, sharper value reads, and live roster
            awareness.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link href="/login" className="rf-button">
              Enter the War Room <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/dashboard" className="rf-button secondary">
              Go to Dashboard
            </Link>
          </div>

          {/* Trust chips */}
          <div className="flex flex-wrap gap-2 text-xs">
            {["Sleeper league import", "Live draft monitoring", "Rankings + ADP fusion"].map((label) => (
              <span key={label} className="rounded-full border border-electric/25 bg-electric/5 px-3 py-1.5 text-slate-300">
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Mock board panel */}
        <BoardPreview />
      </section>

      {/* ── Section divider ──────────────────────────────────────────── */}
      <div className="border-t border-line/20" />

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section>
        <p className="mb-8 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          What&rsquo;s inside
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ Icon, title, body }) => (
            <div key={title} className="rf-panel space-y-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-electric/25 bg-electric/10 text-electric">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

    </PageShell>
  );
}
