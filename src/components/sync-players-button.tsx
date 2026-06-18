"use client";

import { useState } from "react";
import { DatabaseZap } from "lucide-react";

type SyncResult = {
  total?: number;
  upserted?: number;
  skipped?: number;
  errors?: number;
  lastSyncedAt?: string;
  error?: string;
};

export function SyncPlayersButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  async function syncPlayers() {
    setLoading(true);
    setResult(null);
    const response = await fetch("/api/players/sync-sleeper", { method: "POST" });
    const payload = (await response.json()) as SyncResult;
    setLoading(false);
    setResult(payload);
  }

  return (
    <div className="rounded-md border border-line bg-panel2 p-4">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="font-bold">Sleeper player pool</h2>
          <p className="mt-1 text-sm text-slate-400">Run this before uploading rankings to ensure accurate player name matching.</p>
        </div>
        <button className="rf-button secondary" onClick={syncPlayers} disabled={loading}>
          <DatabaseZap className="h-4 w-4" />
          {loading ? "Syncing..." : "Sync Sleeper Players"}
        </button>
      </div>
      {result?.error ? <p className="mt-3 text-sm text-red-300">{result.error}</p> : null}
      {result?.upserted !== undefined ? (
        <p className="mt-3 text-sm text-slate-300">
          Synced {result.upserted} of {result.total} players. Skipped {result.skipped}, errors {result.errors}.
        </p>
      ) : null}
    </div>
  );
}
