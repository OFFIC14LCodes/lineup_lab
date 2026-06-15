import { normalizePrimaryPosition } from "@/lib/players/normalize";

export type DraftBoardDisplayPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DST" | "DL" | "LB" | "DB" | "UNK";

export function normalizeDraftBoardPosition(position: string | null | undefined): DraftBoardDisplayPosition {
  const normalized = normalizePrimaryPosition(position);
  if (!normalized) return "UNK";
  return normalized === "DEF" ? "DST" : normalized;
}

export function draftBoardPositionCardClass(position: string | null | undefined) {
  const normalized = normalizeDraftBoardPosition(position);
  const base = "border-line bg-panel2 text-slate-100";
  const classes: Record<DraftBoardDisplayPosition, string> = {
    QB: "border-red-300/35 bg-red-950/85 text-red-50",
    RB: "border-emerald-300/35 bg-emerald-950/85 text-emerald-50",
    WR: "border-sky-300/35 bg-sky-950/85 text-sky-50",
    TE: "border-orange-300/35 bg-orange-950/85 text-orange-50",
    K: "border-fuchsia-300/35 bg-fuchsia-950/85 text-fuchsia-50",
    DST: "border-zinc-300/35 bg-zinc-800/90 text-zinc-50",
    DL: "border-violet-300/35 bg-violet-950/85 text-violet-50",
    LB: "border-lime-300/35 bg-lime-950/85 text-lime-50",
    DB: "border-cyan-300/35 bg-cyan-950/85 text-cyan-50",
    UNK: base,
  };
  return classes[normalized] ?? base;
}

export function draftBoardPositionBadgeClass(position: string | null | undefined) {
  const normalized = normalizeDraftBoardPosition(position);
  const classes: Record<DraftBoardDisplayPosition, string> = {
    QB: "border-red-300/40 bg-red-500/15 text-red-100",
    RB: "border-emerald-300/40 bg-emerald-500/15 text-emerald-100",
    WR: "border-sky-300/40 bg-sky-500/15 text-sky-100",
    TE: "border-orange-300/40 bg-orange-500/15 text-orange-100",
    K: "border-fuchsia-300/40 bg-fuchsia-500/15 text-fuchsia-100",
    DST: "border-zinc-300/40 bg-zinc-500/15 text-zinc-100",
    DL: "border-violet-300/40 bg-violet-500/15 text-violet-100",
    LB: "border-lime-300/40 bg-lime-500/15 text-lime-100",
    DB: "border-cyan-300/40 bg-cyan-500/15 text-cyan-100",
    UNK: "border-line bg-background text-slate-300",
  };
  return classes[normalized] ?? classes.UNK;
}
