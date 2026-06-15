"use client";

import { SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import type { ProjectionPreviewResult } from "@/lib/projections/load-combined-projection-preview";
import { DST_PREVIEW_WARNING } from "@/lib/projections/projection-preview-constants";

type ProjectionPreviewPanelProps = {
  result: ProjectionPreviewResult;
};

const POSITIONS = ["QB", "RB", "WR", "TE", "DL", "LB", "DB", "K", "DST"];
const SOURCES = ["OFFENSE_BASELINE_V1", "IDP_K_BASELINE_V1", "DST_ALLOWANCE_BASELINE_V1_DRY_RUN"];
const MARKET_STATUSES = ["AVAILABLE", "NO_COMPATIBLE_MARKET", "NOT_IMPLEMENTED_FOR_SOURCE"];
const READINESS = ["READY", "LOW_CONFIDENCE_BASELINE", "SCORING_PARTIAL_ALLOWANCE_ONLY"];

export function ProjectionPreviewPanel({ result }: ProjectionPreviewPanelProps) {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(result.rows[0]?.entityId ?? null);
  const selectedRow = useMemo(
    () => result.rows.find((row) => row.entityId === selectedEntityId) ?? result.rows[0] ?? null,
    [result.rows, selectedEntityId]
  );

  return (
    <div className="space-y-6">
      <section className="rf-panel p-5">
        <form className="grid gap-4 lg:grid-cols-4">
          <label className="grid gap-2 text-sm font-semibold text-slate-300">
            League
            <select name="leagueId" defaultValue={result.filters.leagueId ?? ""} className="rf-input">
              <option value="">Select a league</option>
              {result.leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name ?? league.id}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-300">
            Position
            <select name="position" defaultValue={result.filters.position ?? ""} className="rf-input">
              <option value="">All positions</option>
              {POSITIONS.map((position) => <option key={position} value={position}>{position}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-300">
            Source
            <select name="projectionSource" defaultValue={result.filters.projectionSource ?? ""} className="rf-input">
              <option value="">All sources</option>
              {SOURCES.map((source) => <option key={source} value={source}>{source}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-300">
            Confidence
            <select name="confidenceLabel" defaultValue={result.filters.confidenceLabel ?? ""} className="rf-input">
              <option value="">All confidence</option>
              {unique(result.rows.map((row) => row.confidenceLabel)).map((confidence) => <option key={confidence} value={confidence}>{confidence}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-300">
            Market status
            <select name="marketStatus" defaultValue={result.filters.marketStatus ?? ""} className="rf-input">
              <option value="">All market states</option>
              {MARKET_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-300">
            Readiness
            <select name="readiness" defaultValue={result.filters.readiness ?? ""} className="rf-input">
              <option value="">All readiness</option>
              {READINESS.map((readiness) => <option key={readiness} value={readiness}>{readiness}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-300 lg:col-span-2">
            Search
            <input name="search" defaultValue={result.filters.search ?? ""} className="rf-input" placeholder="Player, team, or id" />
          </label>
          <label className="flex items-center gap-3 text-sm font-semibold text-slate-300">
            <input name="includeDstDryRun" value="true" type="checkbox" defaultChecked={Boolean(result.filters.includeDstDryRun)} />
            Include DST dry-run
          </label>
          <label className="flex items-center gap-3 text-sm font-semibold text-slate-300">
            <input name="includeAllPositions" value="true" type="checkbox" defaultChecked={Boolean(result.filters.includeAllPositions)} />
            Include all positions
          </label>
          <div className="lg:col-span-2">
            <button type="submit" className="rf-button">
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Apply filters
            </button>
          </div>
        </form>
      </section>

      {result.summary.dstRequested ? (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 text-sm font-semibold text-amber-100">
          {DST_PREVIEW_WARNING}
        </div>
      ) : null}

      {result.diagnostics.length > 0 ? (
        <section className="rf-panel p-5">
          <h2 className="text-lg font-bold">Diagnostics</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {result.diagnostics.map((diagnostic) => <li key={diagnostic}>{diagnostic}</li>)}
          </ul>
        </section>
      ) : null}

      <SummaryCards result={result} />
      <CoveragePanel coverage={result.coverage} />

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="rf-panel overflow-hidden">
          <div className="border-b border-white/10 p-4">
            <h2 className="text-lg font-bold">Projection Rows</h2>
          </div>
          {result.rows.length === 0 ? (
            <div className="p-6 text-sm text-slate-400">No projection rows match the current selection.</div>
          ) : (
            <div className="max-h-[760px] overflow-auto">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase text-slate-400">
                  <tr>
                    {["Rank", "Player/Team", "Team", "Position", "Source", "Readiness", "Confidence", "Floor", "Median", "Ceiling", "PPG", "Market Rank", "Rank Delta", "Market Status", "Warnings"].map((heading) => (
                      <th key={heading} className="border-b border-white/10 px-3 py-3 font-bold">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr
                      key={`${row.leagueId}-${row.projectionSource}-${row.entityId}`}
                      className="border-b border-white/5 hover:bg-white/5"
                    >
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          className="font-bold text-brand underline-offset-4 hover:underline"
                          onClick={() => setSelectedEntityId(row.entityId)}
                        >
                          {row.projectedPositionRank ?? "—"}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-100">{row.displayName}</div>
                        {row.entityType === "TEAM_DEFENSE" ? <div className="text-xs text-amber-200">Team defense · dry-run allowance-only</div> : null}
                      </td>
                      <td className="px-3 py-3 text-slate-300">{row.team ?? "—"}</td>
                      <td className="px-3 py-3 font-semibold">{row.position}</td>
                      <td className="px-3 py-3 text-xs text-slate-300">{row.projectionSource}</td>
                      <td className="px-3 py-3 text-xs text-slate-300">{row.projectionReadiness}</td>
                      <td className="px-3 py-3">{row.confidenceLabel}</td>
                      <td className="px-3 py-3 tabular-nums">{formatNumber(row.floorPoints)}</td>
                      <td className="px-3 py-3 font-bold tabular-nums">{formatNumber(row.medianPoints)}</td>
                      <td className="px-3 py-3 tabular-nums">{formatNumber(row.ceilingPoints)}</td>
                      <td className="px-3 py-3 tabular-nums">{formatNullable(row.projectedPpgWhenInRole)}</td>
                      <td className="px-3 py-3 tabular-nums">{row.marketPositionRank ?? "—"}</td>
                      <td className="px-3 py-3 tabular-nums" title="Positive means Blackbird is above market; negative means Blackbird is below market.">
                        {formatNullable(row.marketRankDelta)}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-300">{row.marketComparisonStatus}</td>
                      <td className="px-3 py-3 text-xs text-slate-300">{row.warningCodes.length ? row.warningCodes.join(", ") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <DetailPanel row={selectedRow} />
      </section>
    </div>
  );
}

function SummaryCards({ result }: { result: ProjectionPreviewResult }) {
  const cards = [
    ["Rows shown", result.summary.rowsShown],
    ["League selected", result.summary.leagueSelected],
    ["Positions included", list(result.summary.positionsIncluded)],
    ["Sources included", list(result.summary.sourcesIncluded)],
    ["Persisted rows", result.summary.persistedRows],
    ["Dry-run rows", result.summary.dryRunRows],
    ["Market available", result.summary.marketAvailableCount],
    ["No compatible market", result.summary.noCompatibleMarketCount],
    ["Not implemented market", result.summary.notImplementedMarketCount],
    ["Warning count", result.summary.warningCount],
    ["DST included", result.summary.dstIncluded ? "Included" : "Excluded"],
  ];
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, value]) => (
        <div key={String(label)} className="rf-panel p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
          <div className="mt-2 break-words text-xl font-black">{value}</div>
        </div>
      ))}
    </section>
  );
}

function CoveragePanel({ coverage }: { coverage: ProjectionPreviewResult["coverage"] }) {
  return (
    <section className="rf-panel p-5">
      <h2 className="text-lg font-bold">League Coverage</h2>
      {!coverage ? (
        <p className="mt-3 text-sm text-slate-400">Select a league to view coverage.</p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <CoverageItem label="offenseIncluded" value={String(coverage.offenseIncluded)} />
          <CoverageItem label="idpIncluded" value={String(coverage.idpIncluded)} />
          <CoverageItem label="kickerIncluded" value={String(coverage.kickerIncluded)} />
          <CoverageItem label="dstIncluded" value={String(coverage.dstIncluded)} />
          <CoverageItem label="positionsIncluded" value={list(coverage.positionsIncluded)} />
          <CoverageItem label="positionsExcluded" value={list(coverage.positionsExcluded)} />
          <CoverageItem label="exclusionReasons" value={list(coverage.exclusionReasons)} wide />
        </div>
      )}
    </section>
  );
}

function CoverageItem({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-200">{value || "—"}</div>
    </div>
  );
}

function DetailPanel({ row }: { row: ProjectionPreviewResult["rows"][number] | null }) {
  if (!row) {
    return (
      <aside className="rf-panel p-5">
        <h2 className="text-lg font-bold">Row Detail</h2>
        <p className="mt-3 text-sm text-slate-400">Select a projection row to inspect full scenario and reason details.</p>
      </aside>
    );
  }

  return (
    <aside className="rf-panel h-fit p-5 xl:sticky xl:top-6">
      <h2 className="text-lg font-bold">Row Detail</h2>
      <div className="mt-1 text-sm text-slate-400">{row.displayName} · {row.position}</div>
      <div className="mt-5 grid gap-3 text-sm">
        <DetailItem label="Scenarios" value={`Downside ${formatNumber(row.downsidePoints)} · Floor ${formatNumber(row.floorPoints)} · Median ${formatNumber(row.medianPoints)} · Ceiling ${formatNumber(row.ceilingPoints)} · Upside ${formatNumber(row.upsidePoints)}`} />
        <DetailItem label="Projection method" value={row.projectionMethod} />
        <DetailItem label="Projection run ID" value={row.projectionRunId ?? "Dry-run only"} />
        <DetailItem label="Projection source" value={row.projectionSource} />
        <DetailItem label="Entity type" value={row.entityType === "TEAM_DEFENSE" ? "TEAM_DEFENSE · team defense" : row.entityType} />
        <DetailItem label="Readiness" value={row.projectionReadiness} />
        <DetailItem label="Confidence" value={row.confidenceLabel} />
        <DetailItem label="Market compatibility/status" value={`${row.marketCompatibility ?? "—"} / ${row.marketComparisonStatus}`} />
        <DetailItem label="Reason codes" value={list(row.reasonCodes)} />
        <DetailItem label="Warning codes" value={list(row.warningCodes)} />
        <DetailItem label="Explanation fragments" value={list(row.explanationFragments)} />
        <DetailItem label="Persistence" value={row.isPersisted ? "Persisted" : "Dry-run, not persisted"} />
        <DetailItem label="Source notes" value={sourceNotes(row)} />
      </div>
    </aside>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 break-words font-semibold text-slate-200">{value || "—"}</div>
    </div>
  );
}

function sourceNotes(row: ProjectionPreviewResult["rows"][number]): string {
  if (row.projectionSource === "DST_ALLOWANCE_BASELINE_V1_DRY_RUN") {
    return "Big-play components unavailable; schedule not modeled; allowance-only; persistence deferred.";
  }
  if (row.projectionSource === "IDP_K_BASELINE_V1") {
    return "Low-confidence baseline; unresolved rows excluded where applicable; team environment not modeled for kickers.";
  }
  return "Single-season baseline; market comparison details shown when compatible market data is available.";
}

function formatNumber(value: number): string {
  return value.toFixed(1);
}

function formatNullable(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

function list(values: string[]): string {
  return values.length ? values.join(", ") : "—";
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}
