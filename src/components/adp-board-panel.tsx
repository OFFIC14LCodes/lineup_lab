"use client";

import { useState } from "react";

import type { AdpBoardEntry, ArchetypeExample, AdpBoardSort } from "@/lib/adp/board";
import type { AdpFormatMatchScore } from "@/lib/adp/types";

const POSITIONS = ["QB", "RB", "WR", "TE"];
const SORT_OPTIONS: Array<{ value: AdpBoardSort; label: string }> = [
  { value: "adp", label: "ADP" },
  { value: "hlv", label: "2025 Hist. Rank" },
  { value: "value_gap", label: "Value Gap" },
  { value: "availability", label: "Availability" },
  { value: "position", label: "Position" },
  { value: "tier", label: "Tier" },
];

const MARKET_CONFIDENCE_COLORS: Record<string, string> = {
  high: "text-green-400",
  medium: "text-amber-300",
  low: "text-slate-500",
};

const VALUE_SIGNAL_LABELS: Record<string, string> = {
  strong_value: "Strong Value",
  moderate_value: "Moderate Value",
  fair_value: "Fair",
  slight_overdraft: "Slight Overdraft",
  clear_overdraft: "Overdraft",
  insufficient_data: "—",
};
const VALUE_SIGNAL_COLORS: Record<string, string> = {
  strong_value: "text-green-400",
  moderate_value: "text-emerald-300",
  fair_value: "text-slate-300",
  slight_overdraft: "text-amber-300",
  clear_overdraft: "text-red-400",
  insufficient_data: "text-slate-500",
};

export function AdpBoardPanel({
  board: initialBoard,
  archetypes,
  snapshotCapturedAt,
  formatMatchScore,
  formatGroupKey,
}: {
  board: AdpBoardEntry[];
  archetypes: ArchetypeExample[];
  snapshotCapturedAt: string;
  formatMatchScore: AdpFormatMatchScore | null;
  formatGroupKey?: string | null;
}) {
  const [sort, setSort] = useState<AdpBoardSort>("adp");
  const [filterPos, setFilterPos] = useState<string[]>([]);
  const [resolvedOnly, setResolvedOnly] = useState(false);
  const [profileOnly, setProfileOnly] = useState(false);
  const [showArchetypes, setShowArchetypes] = useState(false);

  // Apply filters in-memory
  let filtered = initialBoard;
  if (filterPos.length > 0) {
    filtered = filtered.filter((e) => e.position && filterPos.includes(e.position));
  }
  if (resolvedOnly) {
    filtered = filtered.filter((e) => e.canonicalPlayerId !== null);
  }
  if (profileOnly) {
    filtered = filtered.filter((e) => e.hlvRank !== null);
  }

  // Client sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "adp": return a.overallAdp - b.overallAdp;
      case "hlv": return (a.hlvRank ?? 9999) - (b.hlvRank ?? 9999);
      case "value_gap": return (b.rankDelta ?? -9999) - (a.rankDelta ?? -9999);
      case "availability": return (b.probAtAdp ?? 0) - (a.probAtAdp ?? 0);
      case "position": {
        const pc = (a.position ?? "ZZZ").localeCompare(b.position ?? "ZZZ");
        return pc !== 0 ? pc : a.overallAdp - b.overallAdp;
      }
      case "tier": return (a.marketTierNumber ?? 999) - (b.marketTierNumber ?? 999) || a.overallAdp - b.overallAdp;
      default: return a.overallAdp - b.overallAdp;
    }
  });

  // Capture date for display
  const capturedDate = new Date(snapshotCapturedAt).toLocaleDateString();

  return (
    <div className="space-y-4">
      {/* Format match warning */}
      {formatMatchScore && !formatMatchScore.isCompatible && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-300">
          <strong>Format mismatch</strong> — MFL ADP may not be directly comparable to this league.
          {formatMatchScore.warnings.map((w, i) => (
            <div key={i} className="mt-1 text-xs text-amber-400/80">• {w}</div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="rounded-xl border border-white/8 bg-white/4 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as AdpBoardSort)}
              className="rounded-md border border-white/10 bg-slate-800 px-2 py-1 text-sm text-slate-200"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Position filter */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-400">Position</span>
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                onClick={() =>
                  setFilterPos((p) =>
                    p.includes(pos) ? p.filter((x) => x !== pos) : [...p, pos]
                  )
                }
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  filterPos.includes(pos)
                    ? "bg-blue-600 text-white"
                    : "border border-white/10 text-slate-400 hover:border-white/20"
                }`}
              >
                {pos}
              </button>
            ))}
          </div>

          {/* Toggles */}
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={resolvedOnly}
              onChange={(e) => setResolvedOnly(e.target.checked)}
              className="accent-blue-500"
            />
            Resolved only
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={profileOnly}
              onChange={(e) => setProfileOnly(e.target.checked)}
              className="accent-blue-500"
            />
            Historical profile only
          </label>
          <button
            onClick={() => setShowArchetypes((s) => !s)}
            className="ml-auto rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 hover:border-white/20"
          >
            {showArchetypes ? "Hide archetypes" : "Show archetypes"}
          </button>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Showing {sorted.length} of {initialBoard.length} players · ADP captured {capturedDate}
          {formatMatchScore && (
            <> · Format match {(formatMatchScore.overallScore * 100).toFixed(0)}% ({formatMatchScore.isCompatible ? "compatible" : "incompatible"})</>
          )}
          {formatGroupKey && (
            <> · Group: <span className="text-slate-400">{formatGroupKey.replace(/_/g, " ")}</span></>
          )}
        </div>
      </div>

      {/* Archetype examples */}
      {showArchetypes && archetypes.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/4 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Representative Examples</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {archetypes.map((ex) => (
              <div key={ex.archetype} className="rounded-lg border border-white/8 bg-white/2 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {ex.archetype.replace(/_/g, " ")}
                </div>
                <div className="mt-1 font-semibold text-slate-200">{ex.playerName}</div>
                <div className="text-xs text-slate-400">
                  {ex.position} · {ex.nflTeam ?? "—"} · ADP {ex.overallAdp.toFixed(1)}
                </div>
                {ex.hlvRank && (
                  <div className="mt-1 text-xs text-slate-400">
                    2025 Hist. Rank {ex.hlvRank} · PAR {ex.pointsAboveReplacement?.toFixed(1) ?? "—"}
                  </div>
                )}
                <div className={`mt-1 text-xs font-semibold ${VALUE_SIGNAL_COLORS[ex.valueSignal]}`}>
                  {VALUE_SIGNAL_LABELS[ex.valueSignal]}
                </div>
                {ex.limitations.length > 0 && (
                  <div className="mt-1 text-[10px] text-slate-500">
                    {ex.limitations[0]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Board table */}
      <div className="overflow-x-auto rounded-xl border border-white/8 bg-white/4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 text-xs text-slate-400">
              <th className="px-3 py-2 text-right font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">Player</th>
              <th className="px-3 py-2 text-center font-medium">Pos</th>
              <th className="px-3 py-2 text-left font-medium">Team</th>
              <th className="px-3 py-2 text-right font-medium">ADP</th>
              <th className="px-3 py-2 text-center font-medium">Mkt Conf</th>
              <th className="px-3 py-2 text-right font-medium">Mkt Rank</th>
              <th className="px-3 py-2 text-right font-medium">Pos Rank</th>
              <th className="px-3 py-2 text-right font-medium">Tier</th>
              <th className="px-3 py-2 text-right font-medium">2025 Historical League Rank</th>
              <th className="px-3 py-2 text-right font-medium">PAR</th>
              <th className="px-3 py-2 text-center font-medium">Historical vs Market Signal</th>
              <th className="px-3 py-2 text-right font-medium">Gap</th>
              <th className="px-3 py-2 text-right font-medium">P(avail)</th>
              <th className="px-3 py-2 text-center font-medium">Conf</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry, idx) => (
              <tr
                key={entry.canonicalPlayerId ?? `raw-${idx}`}
                className="border-b border-white/4 hover:bg-white/4"
              >
                <td className="px-3 py-2 text-right text-slate-500">{idx + 1}</td>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-200">{entry.playerName}</div>
                  {!entry.canonicalPlayerId && (
                    <div className="text-[10px] text-amber-500">unresolved</div>
                  )}
                  {entry.isRookie && (
                    <div className="text-[10px] text-blue-400">rookie</div>
                  )}
                </td>
                <td className="px-3 py-2 text-center text-slate-300">
                  {entry.position ?? "—"}
                  {/* Position-specific format warning badge for QB (Superflex) and TE (TE-premium) */}
                  {entry.positionFormatScores && (() => {
                    const posScore = entry.positionFormatScores!.find((s) => s.position === entry.position);
                    return posScore && posScore.warnings.length > 0 ? (
                      <span className="ml-1 text-[9px] text-amber-400" title={posScore.warnings[0]}>⚠</span>
                    ) : null;
                  })()}
                </td>
                <td className="px-3 py-2 text-slate-400">{entry.nflTeam ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-200">
                  {entry.overallAdp.toFixed(1)}
                  {entry.providerDisagreement !== null && entry.providerDisagreement > 0 && (
                    <div className="text-[10px] text-slate-500">±{entry.providerDisagreement.toFixed(1)}</div>
                  )}
                </td>
                <td className={`px-3 py-2 text-center text-[10px] font-semibold ${entry.marketConfidence ? MARKET_CONFIDENCE_COLORS[entry.marketConfidence] : "text-slate-600"}`}>
                  {entry.marketConfidence ? entry.marketConfidence[0].toUpperCase() : "—"}
                </td>
                <td className="px-3 py-2 text-right text-slate-400">{entry.marketRank ?? "—"}</td>
                <td className="px-3 py-2 text-right text-slate-400">{entry.positionalRank ?? "—"}</td>
                <td className="px-3 py-2 text-right text-slate-400">{entry.marketTier ?? "—"}</td>
                <td className="px-3 py-2 text-right text-slate-400">{entry.hlvRank ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-400">
                  {entry.pointsAboveReplacement !== null ? entry.pointsAboveReplacement.toFixed(1) : "—"}
                </td>
                <td className={`px-3 py-2 text-center text-xs font-semibold ${VALUE_SIGNAL_COLORS[entry.valueSignal]}`}>
                  {VALUE_SIGNAL_LABELS[entry.valueSignal]}
                </td>
                <td className={`px-3 py-2 text-right font-mono text-xs ${
                  entry.rankDelta === null ? "text-slate-500"
                  : entry.rankDelta >= 24 ? "text-green-400"
                  : entry.rankDelta >= 10 ? "text-emerald-300"
                  : entry.rankDelta <= -24 ? "text-red-400"
                  : entry.rankDelta <= -10 ? "text-amber-300"
                  : "text-slate-400"
                }`}>
                  {entry.rankDelta !== null
                    ? (entry.rankDelta > 0 ? "+" : "") + entry.rankDelta
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-slate-400">
                  {entry.probAtAdp !== null ? `${(entry.probAtAdp * 100).toFixed(0)}%` : "—"}
                </td>
                <td className={`px-3 py-2 text-center text-[10px] ${
                  entry.historyConfidence === "complete" || entry.historyConfidence === "high" ? "text-green-400"
                  : entry.historyConfidence === "moderate" ? "text-amber-300"
                  : entry.historyConfidence === "low" ? "text-red-400"
                  : "text-slate-500"
                }`}>
                  {entry.historyConfidence ?? (entry.isRookie ? "rookie" : "—")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-500">No players match the current filters.</div>
        )}
      </div>

      <div className="text-xs text-slate-500">
        ADP board is read-only — does not affect War Room recommendations or Draft Target Score.
        Historical Value = 2025 actual performance scored under 2026 league config. Historical — not projected.
        MFL ADP aggregates redraft PPR 12-team leagues. Format-match score indicates compatibility with your league.
      </div>
    </div>
  );
}
