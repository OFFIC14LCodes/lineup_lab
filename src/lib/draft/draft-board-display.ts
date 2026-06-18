import { normalizePrimaryPosition } from "@/lib/players/normalize";

export type DraftBoardDisplayPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DST" | "DL" | "LB" | "DB" | "UNK";

export function normalizeDraftBoardPosition(position: string | null | undefined): DraftBoardDisplayPosition {
  const normalized = normalizePrimaryPosition(position);
  if (!normalized) return "UNK";
  return normalized === "DEF" ? "DST" : normalized;
}

export function draftBoardPositionCardClass(position: string | null | undefined) {
  const normalized = normalizeDraftBoardPosition(position);
  const base = "border-line bg-panel2/90 text-slate-100";
  const classes: Record<DraftBoardDisplayPosition, string> = {
    QB: "border-red-300/25 bg-red-950/35 text-slate-100",
    RB: "border-emerald-300/25 bg-emerald-950/35 text-slate-100",
    WR: "border-sky-300/25 bg-sky-950/35 text-slate-100",
    TE: "border-amber-300/25 bg-amber-950/35 text-slate-100",
    K: "border-fuchsia-300/25 bg-fuchsia-950/30 text-slate-100",
    DST: "border-zinc-300/25 bg-zinc-800/55 text-slate-100",
    DL: "border-violet-300/25 bg-violet-950/35 text-slate-100",
    LB: "border-lime-300/25 bg-lime-950/30 text-slate-100",
    DB: "border-cyan-300/25 bg-cyan-950/35 text-slate-100",
    UNK: base,
  };
  return classes[normalized] ?? base;
}

export function draftBoardPositionBadgeClass(position: string | null | undefined) {
  const normalized = normalizeDraftBoardPosition(position);
  const classes: Record<DraftBoardDisplayPosition, string> = {
    QB: "border-red-300/35 bg-red-500/10 text-red-100",
    RB: "border-emerald-300/35 bg-emerald-500/10 text-emerald-100",
    WR: "border-sky-300/35 bg-sky-500/10 text-sky-100",
    TE: "border-amber-300/35 bg-amber-500/10 text-amber-100",
    K: "border-fuchsia-300/35 bg-fuchsia-500/10 text-fuchsia-100",
    DST: "border-zinc-300/35 bg-zinc-500/10 text-zinc-100",
    DL: "border-violet-300/35 bg-violet-500/10 text-violet-100",
    LB: "border-lime-300/35 bg-lime-500/10 text-lime-100",
    DB: "border-cyan-300/35 bg-cyan-500/10 text-cyan-100",
    UNK: "border-line bg-background text-slate-300",
  };
  return classes[normalized] ?? classes.UNK;
}
