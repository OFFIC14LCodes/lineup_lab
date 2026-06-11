"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Upload } from "lucide-react";

type UploadSummary = {
  totalRows: number;
  matchedExact: number;
  matchedFuzzy: number;
  ambiguous: number;
  unmatched: number;
  inserted: number;
  updated: number;
  errors: number;
  error?: string;
};

type LeagueOption = {
  id: string;
  name: string;
  season: string | null;
};

export function RankingsUpload({ leagues = [] }: { leagues?: LeagueOption[] }) {
  const [status, setStatus] = useState<string | null>(null);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [leagueId, setLeagueId] = useState("");
  const [source, setSource] = useState("manual");
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [format, setFormat] = useState("dynasty_superflex");

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setSummary(null);
    setStatus("Parsing CSV...");

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        const response = await fetch("/api/rankings/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: result.data,
            leagueId: leagueId || null,
            source,
            season,
            format
          })
        });
        const payload = (await response.json()) as UploadSummary;
        setLoading(false);
        if (!response.ok) {
          setStatus(payload.error ?? "Upload failed.");
          return;
        }
        setStatus("Upload complete.");
        setSummary(payload);
      },
      error: (error) => {
        setLoading(false);
        setStatus(error.message);
      }
    });
  }

  return (
    <div className="mt-6 rounded-md border border-line bg-panel2 p-4">
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-400">League</span>
          <select className="rf-input" value={leagueId} onChange={(event) => setLeagueId(event.target.value)}>
            <option value="">Global rankings</option>
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name}
              </option>
            ))}
          </select>
        </label>
        <TextInput label="Source" value={source} onChange={setSource} />
        <TextInput label="Season" value={season} onChange={setSeason} />
        <TextInput label="Format" value={format} onChange={setFormat} />
      </div>
      <p className="mt-4 text-xs text-slate-400">
        Supported headers include player, player name, pos, tm, overall_rank, proj, fantasy_points,
        dynasty, best_ball, superflex, and te_premium.
      </p>
      <label className="rf-button mt-4 cursor-pointer">
        <Upload className="h-4 w-4" />
        {loading ? "Uploading..." : "Choose CSV"}
        <input className="hidden" type="file" accept=".csv,text/csv" onChange={onFileChange} />
      </label>
      {status ? <p className="mt-3 text-sm text-slate-300">{status}</p> : null}
      {summary ? (
        <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
          <Summary label="Rows" value={summary.totalRows} />
          <Summary label="Exact" value={summary.matchedExact} />
          <Summary label="Fuzzy" value={summary.matchedFuzzy} />
          <Summary label="Ambiguous" value={summary.ambiguous} />
          <Summary label="Unmatched" value={summary.unmatched} />
          <Summary label="Inserted" value={summary.inserted} />
          <Summary label="Updated" value={summary.updated} />
          <Summary label="Errors" value={summary.errors} />
        </div>
      ) : null}
    </div>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-400">{label}</span>
      <input className="rf-input" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-line bg-background px-3 py-2">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="font-black">{value}</div>
    </div>
  );
}
