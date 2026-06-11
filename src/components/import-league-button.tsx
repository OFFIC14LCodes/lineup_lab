"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { useRouter } from "next/navigation";

export function ImportLeagueButton({ platformLeagueId }: { platformLeagueId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function importLeague() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/sleeper/import-league", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platformLeagueId })
    });
    const payload = (await response.json()) as { error?: string };
    setLoading(false);
    if (!response.ok) {
      setError(payload.error ?? "Import failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button className="rf-button secondary" onClick={importLeague} disabled={loading}>
        <Download className="h-4 w-4" />
        {loading ? "Importing..." : "Sync league"}
      </button>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
