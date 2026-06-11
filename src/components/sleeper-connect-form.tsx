"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

type ConnectResult = {
  leagues?: Array<{ league_id: string; name: string; season: string }>;
  error?: string;
};

export function SleeperConnectForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConnectResult | null>(null);

  async function connect() {
    setLoading(true);
    setResult(null);
    const response = await fetch("/api/sleeper/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username })
    });
    const payload = (await response.json()) as ConnectResult;
    setLoading(false);
    setResult(payload);
    if (response.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <input
        className="rf-input"
        placeholder="Sleeper username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
      />
      <button className="rf-button" disabled={loading || !username.trim()} onClick={connect}>
        <RefreshCw className="h-4 w-4" />
        {loading ? "Connecting..." : "Connect Sleeper"}
      </button>
      {result?.error ? <p className="text-sm text-red-300">{result.error}</p> : null}
      {result?.leagues ? (
        <p className="text-sm text-slate-300">Found {result.leagues.length} current-season leagues.</p>
      ) : null}
    </div>
  );
}
