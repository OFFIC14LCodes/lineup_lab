"use client";

import { useState, useTransition } from "react";

import type { BlackbirdDerivedContext, ContextConfidence, ContextFieldStatus } from "@/lib/context/types";

// --------------------------------------------------------------------------
// Sub-types for panel props
// --------------------------------------------------------------------------

export type PlayerContextEntry = {
  playerId: string;
  fullName: string;
  position: string | null;
  team: string | null;
  season: number;
  games: number;
  derivedContext: BlackbirdDerivedContext | null;
};

export type PlayerContextPanelProps = {
  entries: PlayerContextEntry[];
  season: number;
  backlogs: string[];
};

// --------------------------------------------------------------------------
// Status badge
// --------------------------------------------------------------------------

const STATUS_COLORS: Record<ContextFieldStatus, string> = {
  observed: "text-emerald-400",
  inferred: "text-sky-400",
  unknown: "text-slate-500",
  contradicted: "text-amber-400",
  stale: "text-orange-400",
  not_applicable: "text-slate-600",
};

function StatusDot({ status }: { status: ContextFieldStatus }) {
  return <span className={`text-xs ${STATUS_COLORS[status]}`}>{status[0].toUpperCase()}</span>;
}

// --------------------------------------------------------------------------
// Confidence badge
// --------------------------------------------------------------------------

const CONF_COLORS: Record<ContextConfidence, string> = {
  verified: "text-emerald-300",
  high: "text-green-400",
  moderate: "text-yellow-400",
  low: "text-orange-400",
  unresolved: "text-slate-500",
};

function ConfBadge({ conf }: { conf: ContextConfidence }) {
  return <span className={`text-xs font-mono ${CONF_COLORS[conf]}`}>{conf.slice(0, 3).toUpperCase()}</span>;
}

// --------------------------------------------------------------------------
// Derived field row
// --------------------------------------------------------------------------

function FieldRow({
  label,
  value,
  status,
  confidence,
}: {
  label: string;
  value: number | string | null;
  status: ContextFieldStatus;
  confidence: ContextConfidence;
}) {
  const display =
    value === null
      ? "—"
      : typeof value === "number"
      ? `${(value * 100).toFixed(1)}%`
      : String(value);

  return (
    <tr className="border-t border-slate-800">
      <td className="py-1 pr-3 text-sm text-slate-300">{label}</td>
      <td className="py-1 pr-3 text-sm font-mono text-slate-100">{display}</td>
      <td className="py-1 pr-2">
        <StatusDot status={status} />
      </td>
      <td className="py-1">
        <ConfBadge conf={confidence} />
      </td>
    </tr>
  );
}

// --------------------------------------------------------------------------
// Single player card
// --------------------------------------------------------------------------

function PlayerContextCard({ entry }: { entry: PlayerContextEntry }) {
  const ctx = entry.derivedContext;

  return (
    <div className="rounded-md border border-slate-700 bg-slate-900 p-4 mb-4">
      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-base font-bold text-slate-100">{entry.fullName}</span>
        <span className="text-xs text-slate-400">{entry.position ?? "?"}</span>
        <span className="text-xs text-slate-400">{entry.team ?? "?"}</span>
        <span className="text-xs text-slate-500">{entry.games}G</span>
        {ctx === null && (
          <span className="text-xs text-orange-400">No derived data</span>
        )}
      </div>

      {ctx !== null && (
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="pb-1 text-xs text-slate-500 font-normal">Field</th>
              <th className="pb-1 text-xs text-slate-500 font-normal">Value</th>
              <th className="pb-1 text-xs text-slate-500 font-normal">St</th>
              <th className="pb-1 text-xs text-slate-500 font-normal">Conf</th>
            </tr>
          </thead>
          <tbody>
            <FieldRow
              label="Target share"
              value={ctx.priorTargetShare.value}
              status={ctx.priorTargetShare.status}
              confidence={ctx.priorTargetShare.confidence}
            />
            <FieldRow
              label="Carry share"
              value={ctx.priorCarryShare.value}
              status={ctx.priorCarryShare.status}
              confidence={ctx.priorCarryShare.confidence}
            />
            <FieldRow
              label="RZ target share"
              value={ctx.priorRedZoneShare.value}
              status={ctx.priorRedZoneShare.status}
              confidence={ctx.priorRedZoneShare.confidence}
            />
            <FieldRow
              label="GL carry share"
              value={ctx.priorGoalLineShare.value}
              status={ctx.priorGoalLineShare.status}
              confidence={ctx.priorGoalLineShare.confidence}
            />
            <FieldRow
              label="Team pass rate"
              value={ctx.priorTeamPassRate.value}
              status={ctx.priorTeamPassRate.status}
              confidence={ctx.priorTeamPassRate.confidence}
            />
            <FieldRow
              label="Team rush rate"
              value={ctx.priorTeamRushRate.value}
              status={ctx.priorTeamRushRate.status}
              confidence={ctx.priorTeamRushRate.confidence}
            />
            <FieldRow
              label="Early-dn pass rt"
              value={ctx.priorEarlyDownPassRate.value}
              status={ctx.priorEarlyDownPassRate.status}
              confidence={ctx.priorEarlyDownPassRate.confidence}
            />
            <FieldRow
              label="Tgt concentration"
              value={ctx.priorTargetConcentration.value}
              status={ctx.priorTargetConcentration.status}
              confidence={ctx.priorTargetConcentration.confidence}
            />
          </tbody>
        </table>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Main panel
// --------------------------------------------------------------------------

export function PlayerContextPanel({ entries, season, backlogs }: PlayerContextPanelProps) {
  const [posFilter, setPosFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [showBacklogs, setShowBacklogs] = useState(false);
  const [, startTransition] = useTransition();

  const filtered = entries.filter((e) => {
    if (posFilter && e.position !== posFilter) return false;
    if (search && !e.fullName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const withData = filtered.filter((e) => e.derivedContext !== null);
  const noData = filtered.filter((e) => e.derivedContext === null);

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {["", "QB", "RB", "WR", "TE"].map((pos) => (
            <button
              key={pos}
              onClick={() => startTransition(() => setPosFilter(pos))}
              className={`px-2 py-1 text-xs rounded border transition-colors ${
                posFilter === pos
                  ? "bg-sky-700 border-sky-500 text-white"
                  : "border-slate-600 text-slate-400 hover:border-slate-400"
              }`}
            >
              {pos || "All"}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search player…"
          value={search}
          onChange={(e) => startTransition(() => setSearch(e.target.value))}
          className="px-2 py-1 text-sm rounded border border-slate-600 bg-slate-800 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-slate-400 w-44"
        />
        <span className="text-xs text-slate-500">{filtered.length} players • {season} context</span>
        <button
          onClick={() => setShowBacklogs((v) => !v)}
          className="ml-auto text-xs text-slate-400 hover:text-slate-200 underline"
        >
          {showBacklogs ? "Hide" : "Show"} backlogs ({backlogs.length})
        </button>
      </div>

      {/* Backlogs */}
      {showBacklogs && (
        <div className="mb-4 rounded border border-amber-800 bg-amber-950 p-3">
          <p className="text-xs font-semibold text-amber-400 mb-2">Backlog — fields not yet derivable:</p>
          <ul className="space-y-1">
            {backlogs.map((b) => (
              <li key={b} className="text-xs text-amber-300 font-mono">• {b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Legend */}
      <div className="mb-4 flex gap-4 text-xs text-slate-500">
        <span>St: <span className="text-emerald-400">O</span>=observed <span className="text-sky-400">I</span>=inferred <span className="text-slate-500">U</span>=unknown <span className="text-amber-400">C</span>=contradicted <span className="text-orange-400">S</span>=stale</span>
        <span>Conf: <span className="text-emerald-300">VER</span> <span className="text-green-400">HIG</span> <span className="text-yellow-400">MOD</span> <span className="text-orange-400">LOW</span> <span className="text-slate-500">UNR</span></span>
      </div>

      {/* No data warning */}
      {noData.length > 0 && (
        <p className="text-xs text-orange-400 mb-3">
          {noData.length} players have no derived context for {season} (no H1/H2 stats rows).
        </p>
      )}

      {/* Cards */}
      {withData.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">
          No derived context available for the current filter.
          {noData.length > 0 ? " Verify H1/H2 stat rows exist for this season." : ""}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {withData.map((e) => (
            <PlayerContextCard key={e.playerId} entry={e} />
          ))}
        </div>
      )}
    </div>
  );
}
