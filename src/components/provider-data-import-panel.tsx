"use client";

import { useMemo, useState, useTransition } from "react";

import type {
  ExecuteImportResponse,
  ImportCandidatePlayer,
  ImportDatasetKind,
  ImportPreviewResponse,
  InjuryImportMode
} from "@/lib/providers/import/types";

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

const DATASET_OPTIONS: Array<{ value: ImportDatasetKind; label: string }> = [
  { value: "weekly_stats", label: "Weekly stats" },
  { value: "season_stats", label: "Season stats" },
  { value: "projection", label: "Projection" },
  { value: "injury", label: "Injury" }
];

export function ProviderDataImportPanel() {
  const [datasetKind, setDatasetKind] = useState<ImportDatasetKind>("weekly_stats");
  const [injuryImportMode, setInjuryImportMode] = useState<InjuryImportMode>("append_observation");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [execution, setExecution] = useState<ExecuteImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedPlayers, setSelectedPlayers] = useState<Record<string, string>>({});

  const blockedRows = useMemo(() => {
    if (!preview) return [];
    return [
      ...preview.mappingRequiredRows.map((row) => ({ row, kind: "mapping" as const })),
      ...preview.manualReviewRows.map((row) => ({ row, kind: "manual" as const })),
      ...preview.unresolvedRows.map((row) => ({ row, kind: "unresolved" as const }))
    ];
  }, [preview]);

  async function handlePreview() {
    if (!file) {
      setError("Choose a JSON or CSV file first.");
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        setExecution(null);
        const fileContent = await file.text();
        const response = await fetch("/api/provider-import/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            datasetKind,
            provider: "manual",
            filename: file.name,
            fileContent,
            fileMimeType: file.type || null,
            injuryImportMode
          })
        });

        const payload = (await response.json()) as ImportPreviewResponse | ApiErrorPayload;
        if (!response.ok) {
          throw new Error(getApiErrorMessage(payload, "Unable to preview import."));
        }

        setPreview(payload as ImportPreviewResponse);
      } catch (previewError) {
        setPreview(null);
        setError(previewError instanceof Error ? previewError.message : "Unable to preview import.");
      }
    });
  }

  async function handleReviewAction(sourceRecordId: string, action: "approve" | "skip") {
    if (!preview) return;

    startTransition(async () => {
      try {
        setError(null);
        const response = await fetch("/api/provider-import/mapping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: preview.sessionId,
            sourceRecordId,
            action,
            playerId: selectedPlayers[sourceRecordId] || undefined
          })
        });

        const payload = (await response.json()) as ImportPreviewResponse | ApiErrorPayload;
        if (!response.ok) {
          throw new Error(getApiErrorMessage(payload, "Unable to update review row."));
        }

        setPreview(payload as ImportPreviewResponse);
      } catch (reviewError) {
        setError(reviewError instanceof Error ? reviewError.message : "Unable to update review row.");
      }
    });
  }

  async function handleExecute() {
    if (!preview) return;

    startTransition(async () => {
      try {
        setError(null);
        if (!window.confirm("Execute the ready rows now? This write step is non-transactional.")) {
          return;
        }
        const response = await fetch("/api/provider-import/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: preview.sessionId,
            confirm: true,
            failureMode: "continue"
          })
        });

        const payload = (await response.json()) as ExecuteImportResponse | ApiErrorPayload;
        if (!response.ok) {
          throw new Error(getApiErrorMessage(payload, "Unable to execute import."));
        }

        setExecution(payload as ExecuteImportResponse);
      } catch (executeError) {
        setError(executeError instanceof Error ? executeError.message : "Unable to execute import.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rf-panel p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="text-slate-300">Dataset</span>
            <select
              value={datasetKind}
              onChange={(event) => setDatasetKind(event.target.value as ImportDatasetKind)}
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              {DATASET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {datasetKind === "injury" ? (
            <label className="space-y-2 text-sm">
              <span className="text-slate-300">Injury mode</span>
              <select
                value={injuryImportMode}
                onChange={(event) => setInjuryImportMode(event.target.value as InjuryImportMode)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              >
                <option value="append_observation">Append observation</option>
                <option value="replace_current">Replace current</option>
              </select>
            </label>
          ) : null}
        </div>

        <div className="mt-4 space-y-3">
          <input
            type="file"
            accept=".json,.csv,application/json,text/csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:font-semibold file:text-slate-950"
          />
          <p className="text-xs text-slate-400">
            Manual provider only. Max 5 MB and 250 parsed rows per preview.
          </p>
          <button type="button" onClick={handlePreview} className="rf-button" disabled={isPending}>
            {isPending ? "Previewing..." : "Preview import"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">{error}</div>
      ) : null}

      {preview ? (
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Total rows" value={String(preview.summary.totalRows)} />
            <StatCard label="Ready" value={String(preview.summary.ready)} accent />
            <StatCard label="Mapping needed" value={String(preview.summary.mappingRequired)} />
            <StatCard label="Manual review" value={String(preview.summary.manualReview)} />
            <StatCard label="Unresolved" value={String(preview.summary.unresolved)} />
            <StatCard label="Rejected" value={String(preview.summary.rejected)} />
          </div>

          <div className="rf-panel p-5 text-sm text-slate-300">
            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-400">
              <span>{preview.datasetKind.replace("_", " ")}</span>
              <span>{preview.provider}</span>
              <span>expires {new Date(preview.expiresAt).toLocaleTimeString()}</span>
            </div>
            <p className="mt-3 text-sm text-slate-300">{preview.filename}</p>
            {preview.sourceWarnings.length > 0 ? (
              <p className="mt-2 text-xs text-amber-200">{preview.sourceWarnings.join(" ")}</p>
            ) : null}
          </div>

          {blockedRows.length > 0 ? (
            <div className="rf-panel p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-100">Identity review</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Approve a player match or skip the row before executing the ready subset.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {blockedRows.map(({ row, kind }) => {
                  const playerOptions = row.candidatePlayers ?? [];
                  const defaultPlayerId =
                    "playerId" in row && row.playerId
                      ? row.playerId
                      : "resolvedPlayerId" in row && row.resolvedPlayerId
                        ? row.resolvedPlayerId
                        : playerOptions[0]?.id ?? "";

                  return (
                    <div key={row.sourceRecordId ?? `${kind}-${row.sourceIndex}`} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{kind}</div>
                          <div className="mt-1 text-base font-bold text-slate-100">
                            {row.record.fullName ?? ([row.record.firstName, row.record.lastName].filter(Boolean).join(" ") || "Unknown player")}
                          </div>
                          <div className="mt-1 text-sm text-slate-400">
                            {[row.record.team, row.record.positionGroup, row.record.providerExternalId].filter(Boolean).join(" • ")}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500">{row.sourceRecordId}</div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {row.reasons.map((reason) => (
                          <span key={reason} className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                            {reason}
                          </span>
                        ))}
                      </div>

                      {row.warnings.length > 0 ? (
                        <div className="mt-3 text-xs text-amber-200">{row.warnings.join(" ")}</div>
                      ) : null}

                      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                        <select
                          value={selectedPlayers[row.sourceRecordId ?? ""] ?? defaultPlayerId}
                          onChange={(event) =>
                            setSelectedPlayers((current) => ({
                              ...current,
                              [row.sourceRecordId ?? ""]: event.target.value
                            }))
                          }
                          className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                        >
                          <option value="">Select player</option>
                          {playerOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {formatPlayerOption(option)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleReviewAction(row.sourceRecordId ?? "", "approve")}
                          className="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand"
                          disabled={isPending}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewAction(row.sourceRecordId ?? "", "skip")}
                          className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300"
                          disabled={isPending}
                        >
                          Skip
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="rf-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-100">Ready rows</h2>
                <p className="mt-1 text-sm text-slate-400">
                  These rows are eligible for write execution using the existing provider repository pipeline.
                </p>
                <p className="mt-2 text-xs text-amber-200">
                  Execution is non-transactional. Successfully written rows are not rolled back if a later row fails.
                </p>
              </div>
              <button type="button" onClick={handleExecute} className="rf-button" disabled={isPending || preview.readyRows.length === 0}>
                {isPending ? "Working..." : `Execute ${preview.readyRows.length} ready row${preview.readyRows.length === 1 ? "" : "s"}`}
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-300">
                <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Player</th>
                    <th className="px-3 py-2">Kind</th>
                    <th className="px-3 py-2">Player ID</th>
                    <th className="px-3 py-2">Warnings</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.readyRows.map((row) => (
                    <tr key={row.sourceRecordId ?? `${row.prepared.kind}-${row.prepared.playerId}`} className="border-t border-white/10">
                      <td className="px-3 py-3">{row.record.fullName ?? row.record.providerExternalId ?? "Unknown"}</td>
                      <td className="px-3 py-3">{row.prepared.kind}</td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-400">{row.prepared.playerId}</td>
                      <td className="px-3 py-3 text-xs text-slate-400">{row.warnings.join(" ") || "None"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {execution ? (
            <div className="rf-panel p-5">
              <h2 className="text-lg font-black text-slate-100">Execution result</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-5">
                <StatCard label="Status" value={execution.status} accent={execution.status === "completed"} />
                <StatCard label="Written" value={String(execution.execution?.summary.written ?? 0)} />
                <StatCard label="Updated" value={String(execution.execution?.summary.updated ?? 0)} />
                <StatCard label="Reused" value={String(execution.execution?.summary.reused ?? 0)} />
                <StatCard label="Failed" value={String(execution.execution?.summary.failed ?? 0)} />
              </div>
              {execution.warnings.length > 0 ? (
                <div className="mt-3 text-sm text-amber-200">{execution.warnings.join(" ")}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rf-panel p-6">
          <h2 className="text-lg font-black text-slate-100">No preview yet</h2>
          <p className="mt-2 text-sm text-slate-400">
            Upload a capped JSON or CSV file to preview identity resolution, review blocked rows, and run a manual provider import.
          </p>
        </div>
      )}
    </div>
  );
}

function formatPlayerOption(option: ImportCandidatePlayer) {
  return [option.fullName, option.team, option.positionGroup ?? option.primaryPosition].filter(Boolean).join(" • ");
}

function StatCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className={accent ? "mt-2 text-2xl font-black text-brand" : "mt-2 text-2xl font-black text-slate-100"}>{value}</div>
    </div>
  );
}

function getApiErrorMessage(payload: ImportPreviewResponse | ExecuteImportResponse | ApiErrorPayload, fallback: string) {
  return "error" in payload && payload.error?.message ? payload.error.message : fallback;
}
