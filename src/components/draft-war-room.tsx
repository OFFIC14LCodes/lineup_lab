"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type PlayerLine = {
  player_name: string | null;
  position: string | null;
  team: string | null;
  rank?: number | null;
  projected_points?: number | null;
};

type PickLine = PlayerLine & {
  pick_no: number;
  round: number | null;
  pick_in_round: number | null;
};

type DraftState = {
  room: { id: string; status: string | null; last_synced_at: string | null };
  league: { name: string | null } | null;
  picks: PickLine[];
  currentPickNumber: number;
  currentRound: number;
  lastPick: PickLine | null;
  myRoster: PickLine[];
  positionCounts: Record<string, number>;
  remainingPlayers: PlayerLine[];
  recommendations: PlayerLine[];
  topNeeds: Array<{ position: string; current: number; target: number; need: number }>;
  warning: string | null;
};

export function DraftWarRoom({ draftRoomId }: { draftRoomId: string }) {
  const [state, setState] = useState<DraftState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadState = useCallback(async () => {
    const response = await fetch(`/api/draft-rooms/${draftRoomId}/state`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Unable to load draft room.");
      return;
    }
    setState(payload as DraftState);
    setError(null);
  }, [draftRoomId]);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    const response = await fetch(`/api/draft-rooms/${draftRoomId}/sync`, { method: "POST" });
    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error ?? "Sync failed.");
    }
    setSyncing(false);
    await loadState();
  }, [draftRoomId, loadState]);

  useEffect(() => {
    void syncNow();
    const interval = window.setInterval(loadState, 5000);
    return () => window.clearInterval(interval);
  }, [loadState, syncNow]);

  if (error && !state) {
    return <div className="rf-panel p-6 text-red-300">{error}</div>;
  }

  if (!state) {
    return <div className="rf-panel p-6 text-slate-300">Loading draft room...</div>;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <section className="space-y-6">
        <div className="rf-panel p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <h1 className="text-3xl font-black">{state.league?.name ?? "Draft War Room"}</h1>
              <p className="mt-2 text-sm text-slate-400">
                Status {state.room.status ?? "unknown"} · Last synced{" "}
                {state.room.last_synced_at ? new Date(state.room.last_synced_at).toLocaleTimeString() : "never"}
              </p>
            </div>
            <button className="rf-button" onClick={syncNow} disabled={syncing}>
              <RefreshCw className="h-4 w-4" />
              {syncing ? "Syncing..." : "Sync now"}
            </button>
          </div>
          {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
          {state.warning ? <p className="mt-3 text-sm text-gold">{state.warning}</p> : null}
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <Metric label="Current pick" value={state.currentPickNumber} />
            <Metric label="Round" value={state.currentRound} />
            <Metric label="Drafted" value={state.picks.length} />
            <Metric label="Last pick" value={state.lastPick?.player_name ?? "None"} />
          </div>
        </div>

        <div className="rf-panel overflow-hidden">
          <div className="border-b border-line p-4">
            <h2 className="text-xl font-bold">Picks</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-panel2 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Pick</th>
                  <th className="px-4 py-3">Round</th>
                  <th className="px-4 py-3">Player</th>
                  <th className="px-4 py-3">Pos</th>
                  <th className="px-4 py-3">Team</th>
                </tr>
              </thead>
              <tbody>
                {state.picks.map((pick) => (
                  <tr key={pick.pick_no} className="border-t border-line/70">
                    <td className="px-4 py-3 font-bold">{pick.pick_no}</td>
                    <td className="px-4 py-3">{pick.round ?? "-"}</td>
                    <td className="px-4 py-3">{pick.player_name ?? "Unknown"}</td>
                    <td className="px-4 py-3">{pick.position ?? "-"}</td>
                    <td className="px-4 py-3">{pick.team ?? "-"}</td>
                  </tr>
                ))}
                {state.picks.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-400" colSpan={5}>
                      No picks synced yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <aside className="space-y-6">
        <SidePanel title="Recommended targets">
          <PlayerList players={state.recommendations} showRank />
          <p className="mt-3 text-xs text-slate-500">
            Placeholder logic only: rankings first, then remaining known players. TODO: true projection
            engine, AI GM chat, advanced draft target score, live pick probability engine.
          </p>
        </SidePanel>
        <SidePanel title="My drafted roster">
          <div className="mb-3 flex flex-wrap gap-2">
            {Object.entries(state.positionCounts).map(([position, count]) => (
              <span key={position} className="rounded border border-line bg-panel2 px-2 py-1 text-xs">
                {position} {count}
              </span>
            ))}
          </div>
          <PlayerList players={state.myRoster} />
        </SidePanel>
        <SidePanel title="Top needs">
          {state.topNeeds.length ? (
            state.topNeeds.map((need) => (
              <div key={need.position} className="flex justify-between border-b border-line/70 py-2 text-sm">
                <span>{need.position}</span>
                <span className="text-slate-400">
                  {need.current}/{need.target}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">Starter targets covered by placeholder counts.</p>
          )}
        </SidePanel>
        <SidePanel title="Remaining players">
          <PlayerList players={state.remainingPlayers.slice(0, 15)} showRank />
        </SidePanel>
      </aside>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-line bg-panel2 p-3">
      <div className="text-xs uppercase text-slate-400">{label}</div>
      <div className="mt-1 truncate text-lg font-black">{value}</div>
    </div>
  );
}

function SidePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rf-panel p-4">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function PlayerList({ players, showRank = false }: { players: PlayerLine[]; showRank?: boolean }) {
  if (!players.length) {
    return <p className="text-sm text-slate-400">No players to show.</p>;
  }

  return (
    <div className="space-y-2">
      {players.map((player, index) => (
        <div
          key={`${player.player_name}-${index}`}
          className="flex items-center justify-between gap-3 rounded-md border border-line bg-panel2 px-3 py-2 text-sm"
        >
          <div className="min-w-0">
            <div className="truncate font-bold">{player.player_name ?? "Unknown"}</div>
            <div className="text-xs text-slate-400">
              {player.position ?? "-"} · {player.team ?? "-"}
            </div>
          </div>
          {showRank ? <div className="text-xs text-slate-400">#{player.rank ?? index + 1}</div> : null}
        </div>
      ))}
    </div>
  );
}
