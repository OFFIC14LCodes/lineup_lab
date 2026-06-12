"use client";

import type { ReactNode } from "react";
import { useState, useTransition } from "react";

import type { ProjectionType } from "@/lib/providers/data-types";
import type { ProviderName } from "@/lib/providers/types";
import type { PositionGroup, ScoringWarning } from "@/lib/scoring/types";
import type {
  ProviderPointComparison,
  ScoringInspectorResponse,
  ScoringInspectorSourceType,
  StoredRowBatchItem,
  StoredRowScoringResult
} from "@/lib/scoring/server/types";
import type {
  CohortValidationSummary,
  LeagueScoringValidationReport,
  RowValidationError,
  RowValidationResult
} from "@/lib/scoring/validation/types";

type LeagueOption = {
  id: string;
  name: string | null;
  season: string | number | null;
};

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

type InspectorMode = "inspection" | "validation";

const SOURCE_OPTIONS: Array<{ value: ScoringInspectorSourceType; label: string }> = [
  { value: "weekly_stats", label: "Weekly stats" },
  { value: "season_stats", label: "Season stats" },
  { value: "projections", label: "Projections" }
];

const POSITION_OPTIONS: Array<PositionGroup | ""> = ["", "QB", "RB", "WR", "TE", "K", "DEF", "DL", "LB", "DB"];
const PROVIDER_OPTIONS: Array<ProviderName | ""> = ["", "manual", "sportsdataio", "fantasydata", "sportradar", "nflverse", "gsis", "sleeper", "espn", "yahoo"];
const PROJECTION_TYPE_OPTIONS: Array<ProjectionType | ""> = ["", "weekly", "season", "rest_of_season", "preseason"];

export function ScoringInspectorPanel({
  leagues,
  defaultSeason
}: {
  leagues: LeagueOption[];
  defaultSeason: number;
}) {
  const [mode, setMode] = useState<InspectorMode>("inspection");
  const [leagueId, setLeagueId] = useState(leagues[0]?.id ?? "");
  const [sourceType, setSourceType] = useState<ScoringInspectorSourceType>("weekly_stats");
  const [season, setSeason] = useState(String(defaultSeason));
  const [week, setWeek] = useState("1");
  const [provider, setProvider] = useState<ProviderName | "">("");
  const [positionGroup, setPositionGroup] = useState<PositionGroup | "">("");
  const [projectionType, setProjectionType] = useState<ProjectionType | "">("");
  const [inspectionResponse, setInspectionResponse] = useState<ScoringInspectorResponse | null>(null);
  const [validationResponse, setValidationResponse] = useState<LeagueScoringValidationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedLeague = leagues.find((league) => league.id === leagueId) ?? null;
  const isProjectionSource = sourceType === "projections";

  async function handleLoad() {
    if (!leagueId) {
      setError("Select a league first.");
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const search = new URLSearchParams({
          leagueId,
          sourceType,
          season
        });

        if (sourceType === "weekly_stats") {
          search.set("week", week);
        }
        if (provider) {
          search.set("provider", provider);
        }
        if (positionGroup) {
          search.set("positionGroup", positionGroup);
        }
        if (isProjectionSource && projectionType) {
          search.set("projectionType", projectionType);
        }

        const path = mode === "inspection" ? "/api/scoring/inspect" : "/api/scoring/validate";
        const apiResponse = await fetch(`${path}?${search.toString()}`, {
          method: "GET"
        });
        const payload = (await apiResponse.json()) as ScoringInspectorResponse | LeagueScoringValidationReport | ApiErrorPayload;
        if (!apiResponse.ok) {
          throw new Error(getApiErrorMessage(payload, "Unable to load scoring data."));
        }

        if (mode === "inspection") {
          setInspectionResponse(payload as ScoringInspectorResponse);
          setValidationResponse(null);
        } else {
          setValidationResponse(payload as LeagueScoringValidationReport);
          setInspectionResponse(null);
        }
      } catch (loadError) {
        setInspectionResponse(null);
        setValidationResponse(null);
        setError(loadError instanceof Error ? loadError.message : "Unable to load scoring data.");
      }
    });
  }

  if (leagues.length === 0) {
    return (
      <div className="rf-panel p-6">
        <h2 className="text-lg font-black text-slate-100">No leagues available</h2>
        <p className="mt-2 text-sm text-slate-400">
          Import a Sleeper league first. The scoring inspector only runs against league-owned scoring settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rf-panel p-5">
        <div className="flex flex-wrap gap-3">
          <ModeButton active={mode === "inspection"} onClick={() => setMode("inspection")}>
            Row inspection
          </ModeButton>
          <ModeButton active={mode === "validation"} onClick={() => setMode("validation")}>
            Validation report
          </ModeButton>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="League">
            <select value={leagueId} onChange={(event) => setLeagueId(event.target.value)} className={INPUT_CLASS}>
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name ?? "Unnamed league"}{league.season ? ` (${league.season})` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Source">
            <select value={sourceType} onChange={(event) => setSourceType(event.target.value as ScoringInspectorSourceType)} className={INPUT_CLASS}>
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Season">
            <input value={season} onChange={(event) => setSeason(event.target.value)} className={INPUT_CLASS} inputMode="numeric" />
          </Field>

          {sourceType === "weekly_stats" ? (
            <Field label="Week">
              <input value={week} onChange={(event) => setWeek(event.target.value)} className={INPUT_CLASS} inputMode="numeric" />
            </Field>
          ) : null}

          <Field label="Provider">
            <select value={provider} onChange={(event) => setProvider(event.target.value as ProviderName | "")} className={INPUT_CLASS}>
              <option value="">All providers</option>
              {PROVIDER_OPTIONS.filter(Boolean).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Position group">
            <select value={positionGroup} onChange={(event) => setPositionGroup(event.target.value as PositionGroup | "")} className={INPUT_CLASS}>
              <option value="">All positions</option>
              {POSITION_OPTIONS.filter(Boolean).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>

          {isProjectionSource ? (
            <Field label="Projection type">
              <select value={projectionType} onChange={(event) => setProjectionType(event.target.value as ProjectionType | "")} className={INPUT_CLASS}>
                <option value="">All projection types</option>
                {PROJECTION_TYPE_OPTIONS.filter(Boolean).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={handleLoad} className="rf-button" disabled={isPending}>
            {isPending ? "Loading..." : mode === "inspection" ? "Load scoring sample" : "Load validation report"}
          </button>
          <p className="text-xs text-slate-500">
            Internal-only. Read-only scoring analysis against stored provider rows for owned leagues.
          </p>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">{error}</div> : null}

      {inspectionResponse ? (
        <InspectionView response={inspectionResponse} selectedLeagueName={selectedLeague?.name ?? null} />
      ) : null}

      {validationResponse ? (
        <ValidationView response={validationResponse} selectedLeagueName={selectedLeague?.name ?? null} />
      ) : null}

      {!inspectionResponse && !validationResponse ? (
        <div className="rf-panel p-6">
          <h2 className="text-lg font-black text-slate-100">No scoring analysis loaded</h2>
          <p className="mt-2 text-sm text-slate-400">
            Use row inspection for individual score diagnostics or validation report mode for bounded readiness analysis.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function InspectionView({
  response,
  selectedLeagueName
}: {
  response: ScoringInspectorResponse;
  selectedLeagueName: string | null;
}) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="League" value={response.league.leagueName ?? selectedLeagueName ?? "Unnamed"} />
        <StatCard label="Formula" value={response.league.formulaVersion} accent />
        <StatCard label="Active keys" value={String(Object.keys(response.league.scoringSettings.values).length)} />
        <StatCard label="Supported keys" value={String(response.league.scoringAudit.fullySupportedKeys.length + response.league.scoringAudit.partiallySupportedKeys.length)} />
        <StatCard label="Unsupported keys" value={String(response.league.scoringAudit.unsupportedKeys.length)} />
      </div>

      <div className="rf-panel p-5">
        <h2 className="text-lg font-black text-slate-100">League scoring audit</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <AuditList title="Supported" values={[...response.league.scoringAudit.fullySupportedKeys, ...response.league.scoringAudit.partiallySupportedKeys]} emptyLabel="None" />
          <AuditList title="Unsupported" values={response.league.scoringAudit.unsupportedKeys} emptyLabel="None" />
          <AuditList
            title="Invalid values"
            values={response.league.scoringSettings.invalidKeys.map((item) => `${item.key}: ${item.reason}`)}
            emptyLabel="None"
          />
        </div>
      </div>

      <div className="rf-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-100">Scored rows</h2>
            <p className="mt-1 text-sm text-slate-400">
              Coverage status and provider comparisons are informational until Blackbird scoring is wired into recommendations.
            </p>
          </div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {response.results.length} row{response.results.length === 1 ? "" : "s"}
          </div>
        </div>

        {response.results.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-400">
            No matching stored rows. Import provider data for this season and source type, then reload the inspector.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {response.results.map((item, index) => (
              <ScoredRowCard key={item.ok ? item.result.source.rowId : `${item.error.rowId}-${index}`} item={item} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ValidationView({
  response,
  selectedLeagueName
}: {
  response: LeagueScoringValidationReport;
  selectedLeagueName: string | null;
}) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <StatCard label="League" value={response.league.leagueName ?? selectedLeagueName ?? "Unnamed"} />
        <StatCard label="Readiness" value={formatStatus(response.overallRecommendationReadiness.status)} accent />
        <StatCard label="Score" value={String(response.overallRecommendationReadiness.score)} />
        <StatCard label="Eligible" value={response.overallRecommendationReadiness.eligibleForRecommendationExperiment ? "Yes" : "No"} />
        <StatCard label="Returned rows" value={String(response.sample.returnedRows)} />
        <StatCard label="Scored rows" value={String(response.sample.successfullyScoredRows)} />
      </div>

      <div className="rf-panel p-5">
        <h2 className="text-lg font-black text-slate-100">Overall readiness</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <InfoList
            title="Decision"
            items={[
              `Status: ${formatStatus(response.overallRecommendationReadiness.status)}`,
              `Scope: ${response.overallRecommendationReadiness.eligibleExperimentScope}`,
              `Formula: ${response.scoringFormulaVersion}`,
              `Readiness version: ${response.readinessVersion}`
            ]}
          />
          <InfoList
            title="Reasons and warnings"
            items={[
              ...response.overallRecommendationReadiness.reasons.map((reason) => reason.message),
              ...response.overallRecommendationReadiness.warnings,
              ...(response.warnings.length > 0 ? response.warnings : ["No additional report warnings."])
            ]}
          />
        </div>
      </div>

      <div className="rf-panel p-5">
        <h2 className="text-lg font-black text-slate-100">League readiness</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Status" value={formatStatus(response.leagueReadiness.status)} accent />
          <StatCard label="Support ratio" value={response.leagueReadiness.supportRatio === null ? "N/A" : `${Math.round(response.leagueReadiness.supportRatio * 100)}%`} />
          <StatCard label="Unsupported keys" value={String(response.leagueReadiness.unsupportedApplicableKeys.length)} />
          <StatCard label="Invalid keys" value={String(response.leagueReadiness.invalidScoringKeys.length)} />
          <StatCard label="Aggregate-unsafe" value={String(response.leagueReadiness.aggregateUnsafeKeys.length)} />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <AuditList title="Unsupported applicable keys" values={response.leagueReadiness.unsupportedApplicableKeys} emptyLabel="None" />
          <AuditList title="High-impact blockers" values={response.leagueReadiness.highImpactUnsupportedKeys} emptyLabel="None" />
          <AuditList title="Invalid settings" values={response.leagueReadiness.invalidScoringKeys} emptyLabel="None" />
        </div>
      </div>

      <div className="rf-panel p-5">
        <h2 className="text-lg font-black text-slate-100">Sample summary</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Requested" value={String(response.sample.requestedLimit)} />
          <StatCard label="Returned" value={String(response.sample.returnedRows)} />
          <StatCard label="Scored" value={String(response.sample.successfullyScoredRows)} />
          <StatCard label="Errors" value={String(response.sample.erroredRows)} />
          <StatCard
            label="Eligible rows"
            value={`${response.rows.filter(isRowValidationResult).filter((row) => row.readiness.eligibleForRecommendationExperiment).length}`}
          />
        </div>
      </div>

      <div className="rf-panel p-5">
        <h2 className="text-lg font-black text-slate-100">Cohorts</h2>
        <div className="mt-4 space-y-4">
          {response.cohorts.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-400">
              No cohort summaries were generated because no rows were scored successfully.
            </div>
          ) : (
            response.cohorts.map((cohort) => <CohortCard key={cohort.cohortKey} cohort={cohort} />)
          )}
        </div>
      </div>

      <div className="rf-panel p-5">
        <h2 className="text-lg font-black text-slate-100">Row details</h2>
        <div className="mt-4 space-y-4">
          {response.rows.map((row) =>
            isRowValidationResult(row) ? (
              <ValidatedRowCard key={row.rowId} row={row} />
            ) : (
              <ValidationErrorCard key={row.rowId} row={row} />
            )
          )}
        </div>
      </div>
    </>
  );
}

function ScoredRowCard({ item }: { item: StoredRowBatchItem }) {
  if (!item.ok) {
    return <InspectionErrorCard item={item} />;
  }

  return <ScoringResultDetails result={item.result} />;
}

function ValidatedRowCard({ row }: { row: RowValidationResult }) {
  return (
    <details className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-lg font-bold text-slate-100">{row.playerName}</div>
            <div className="mt-1 text-sm text-slate-400">
              {[row.scoringResult.player.team, row.positionGroup, row.provider, row.projectionType].filter(Boolean).join(" • ")}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Badge label={formatStatus(row.readiness.status)} tone={statusTone(row.readiness.status)} />
              <Badge label={row.readiness.eligibleForRecommendationExperiment ? "Eligible" : "Not eligible"} tone={row.readiness.eligibleForRecommendationExperiment ? "green" : "rose"} />
              <Badge label={`Score ${row.readiness.score}`} tone="slate" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4 lg:min-w-[420px]">
            <Metric label="Blackbird" value={formatPoints(row.blackbirdPoints)} accent />
            <Metric label="Coverage" value={`${Math.round(row.coverageRatio * 100)}%`} />
            <Metric label="Provider" value={row.providerComparison ? formatPoints(row.providerComparison.providerPoints) : "N/A"} />
            <Metric label="Scope" value={row.readiness.eligibleExperimentScope.replace(/_/g, " ")} />
          </div>
        </div>
      </summary>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <InfoList
          title="Readiness reasons"
          items={[
            ...row.readiness.reasons.map((reason) => reason.message),
            ...(row.readiness.warnings.length > 0 ? row.readiness.warnings : ["No additional readiness warnings."])
          ]}
        />
        <InfoList
          title="Readiness rules"
          items={[
            `Passed: ${joinOrNone(row.readiness.passedRules)}`,
            `Failed: ${joinOrNone(row.readiness.failedRules)}`
          ]}
        />
      </div>

      <div className="mt-4">
        <ScoringResultBody result={row.scoringResult} />
      </div>
    </details>
  );
}

function ValidationErrorCard({ row }: { row: RowValidationError }) {
  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-rose-100">{row.error.message}</div>
        <Badge label={formatStatus(row.readiness.status)} tone="rose" />
      </div>
      <div className="mt-2 text-xs text-rose-200">
        {row.error.source.table} · {row.error.source.provider ?? "unknown provider"} · {row.error.source.season ?? "?"}
        {row.error.source.week ? ` · week ${row.error.source.week}` : ""}
      </div>
    </div>
  );
}

function InspectionErrorCard({ item }: { item: Extract<StoredRowBatchItem, { ok: false }> }) {
  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-rose-100">{item.error.message}</div>
        <div className="font-mono text-xs text-rose-200">{item.error.rowId}</div>
      </div>
      <div className="mt-2 text-xs text-rose-200">
        {item.error.source.table} · {item.error.source.provider ?? "unknown provider"} · {item.error.source.season ?? "?"}
        {item.error.source.week ? ` · week ${item.error.source.week}` : ""}
      </div>
    </div>
  );
}

function ScoringResultDetails({ result }: { result: StoredRowScoringResult }) {
  return (
    <details className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-lg font-bold text-slate-100">{result.player.name}</div>
            <div className="mt-1 text-sm text-slate-400">
              {[result.player.team, result.player.positionGroup, result.source.provider, result.source.projectionType].filter(Boolean).join(" • ")}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Badge label={getCoverageLabel(result).label} tone={getCoverageLabel(result).tone} />
              <Badge label={getProviderComparisonLabel(result.providerComparison).label} tone={getProviderComparisonLabel(result.providerComparison).tone} />
              {result.aggregateCompatibility && !result.aggregateCompatibility.isExact ? <Badge label="Aggregate estimate" tone="amber" /> : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4 lg:min-w-[420px]">
            <Metric label="Blackbird" value={formatPoints(result.blackbird.totalPoints)} accent />
            <Metric label="Provider" value={result.providerComparison ? formatPoints(result.providerComparison.providerPoints) : "N/A"} />
            <Metric label="Diff" value={result.providerComparison ? formatSignedPoints(result.providerComparison.difference) : "N/A"} />
            <Metric label="Coverage" value={`${Math.round(result.blackbird.coverage.coverageRatio * 100)}%`} />
          </div>
        </div>
      </summary>

      <div className="mt-4">
        <ScoringResultBody result={result} />
      </div>
    </details>
  );
}

function ScoringResultBody({ result }: { result: StoredRowScoringResult }) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <InfoList
          title="Source context"
          items={[
            `Table: ${result.source.table}`,
            `Row ID: ${result.source.rowId}`,
            `Season: ${result.source.season}`,
            `Week: ${result.source.week ?? "n/a"}`,
            `Projection: ${result.source.projectionType ?? "n/a"}`,
            `Updated: ${result.source.sourceUpdatedAt ?? "n/a"}`,
            `Ingested: ${result.source.ingestedAt}`,
            `Formula: ${result.blackbird.formulaVersion}`
          ]}
        />

        <InfoList
          title="Coverage details"
          items={[
            `Evaluated keys: ${joinOrNone(result.blackbird.coverage.evaluatedScoringKeys)}`,
            `Unsupported keys: ${joinOrNone(result.blackbird.coverage.unsupportedScoringKeys)}`,
            `Missing stats: ${joinMissingStats(result.blackbird.coverage.missingStatsForSupportedKeys)}`,
            `Ambiguous aliases: ${joinAliasWarnings(result.blackbird.coverage.ambiguousStatAliases)}`,
            `Unused stat keys: ${joinOrNone(result.blackbird.coverage.unusedStatKeys)}`
          ]}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <WarningList title="Warnings" warnings={[...result.contextWarnings, ...result.blackbird.warnings]} />
        <InfoList
          title="Component breakdown"
          items={
            result.blackbird.components.length > 0
              ? result.blackbird.components.map((component) => `${component.scoringKey}: ${formatSignedPoints(component.points)} from ${component.statKey} (${component.statValue})`)
              : ["No scoring components were produced."]
          }
        />
      </div>

      {result.aggregateCompatibility ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
          <div className="font-semibold text-slate-100">Aggregate compatibility</div>
          <div className="mt-2">Exact claim: {result.aggregateCompatibility.isExact ? "Yes" : "No"}</div>
          <div className="mt-2">Unsafe keys: {joinOrNone(result.aggregateCompatibility.aggregateUnsafeKeys)}</div>
          <div className="mt-2">Reasons: {joinOrNone(result.aggregateCompatibility.reasons)}</div>
        </div>
      ) : null}
    </>
  );
}

function CohortCard({ cohort }: { cohort: CohortValidationSummary }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-lg font-bold text-slate-100">{cohort.provider} · {cohort.sourceType}</div>
          <div className="mt-1 text-sm text-slate-400">
            {[cohort.positionGroup, cohort.projectionType].filter(Boolean).join(" • ") || "All positions"}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Badge label={formatStatus(cohort.readiness.status)} tone={statusTone(cohort.readiness.status)} />
            <Badge label={cohort.sampleSufficiency} tone="slate" />
            <Badge label={`${Math.round(cohort.eligiblePercentage * 100)}% eligible`} tone={cohort.eligiblePercentage >= 0.8 ? "green" : "amber"} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4 lg:min-w-[420px]">
          <Metric label="Rows" value={String(cohort.sampleSize)} />
          <Metric label="Avg coverage" value={`${Math.round(cohort.averageCoverageRatio * 100)}%`} />
          <Metric label="Min coverage" value={`${Math.round(cohort.minimumCoverageRatio * 100)}%`} />
          <Metric label="Mean abs diff" value={cohort.providerComparison.meanAbsoluteDifference === null ? "N/A" : formatPoints(cohort.providerComparison.meanAbsoluteDifference)} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <InfoList
          title="Readiness counts"
          items={[
            `Ready: ${cohort.readyCount}`,
            `Conditional: ${cohort.conditionallyReadyCount}`,
            `Not ready: ${cohort.notReadyCount}`,
            `Insufficient: ${cohort.insufficientDataCount}`
          ]}
        />
        <InfoList
          title="Provider comparison"
          items={[
            `With totals: ${cohort.providerComparison.withProviderTotals}`,
            `Match: ${Math.round(cohort.providerComparison.percentageMatch * 100)}%`,
            `Close: ${Math.round(cohort.providerComparison.percentageClose * 100)}%`,
            `Different: ${Math.round(cohort.providerComparison.percentageDifferent * 100)}%`
          ]}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <AuditList title="Common unsupported keys" values={cohort.unsupportedKeyFrequency.map((item) => `${item.key} (${item.count})`)} emptyLabel="None" />
        <AuditList title="Common missing stats" values={cohort.missingStatFrequency.map((item) => `${item.statKey} (${item.count})`)} emptyLabel="None" />
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? "rounded-full border border-brand bg-brand/10 px-4 py-2 text-sm font-semibold text-brand" : "rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300"}
    >
      {children}
    </button>
  );
}

function AuditList({ title, values, emptyLabel }: { title: string; values: string[]; emptyLabel: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <div className="text-sm font-semibold text-slate-100">{title}</div>
      <div className="mt-3 text-sm text-slate-300">{values.length > 0 ? values.join(", ") : emptyLabel}</div>
    </div>
  );
}

function WarningList({ title, warnings }: { title: string; warnings: ScoringWarning[] }) {
  const deduped = Array.from(new Map(warnings.map((warning) => [`${warning.code}:${warning.message}`, warning])).values());
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <div className="text-sm font-semibold text-slate-100">{title}</div>
      <div className="mt-3 space-y-2 text-sm text-slate-300">
        {deduped.length > 0 ? deduped.map((warning) => <div key={`${warning.code}-${warning.message}`}>{warning.message}</div>) : <div>None</div>}
      </div>
    </div>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <div className="text-sm font-semibold text-slate-100">{title}</div>
      <div className="mt-3 space-y-2 text-sm text-slate-300">
        {items.map((item) => (
          <div key={item}>{item}</div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className={accent ? "mt-2 text-lg font-black text-brand" : "mt-2 text-lg font-black text-slate-100"}>{value}</div>
    </div>
  );
}

function StatCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className={accent ? "mt-2 text-2xl font-black text-brand" : "mt-2 text-2xl font-black text-slate-100"}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2 text-sm">
      <span className="text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function Badge({ label, tone }: { label: string; tone: "green" | "amber" | "rose" | "slate" }) {
  const toneClass =
    tone === "green"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
      : tone === "amber"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
        : tone === "rose"
          ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
          : "border-white/10 bg-slate-900/80 text-slate-300";

  return <span className={`rounded-full border px-3 py-1 ${toneClass}`}>{label}</span>;
}

function getCoverageLabel(result: StoredRowScoringResult) {
  if (result.player.positionGroup === null) {
    return { label: "Position missing", tone: "rose" as const };
  }
  if (result.blackbird.coverage.unsupportedScoringKeys.length > 0) {
    return { label: "Unsupported settings", tone: "rose" as const };
  }
  if (result.blackbird.coverage.ambiguousStatAliases.length > 0) {
    return { label: "Alias ambiguity", tone: "amber" as const };
  }
  if (result.blackbird.coverage.missingStatsForSupportedKeys.length > 0) {
    return { label: "Missing raw stats", tone: "amber" as const };
  }
  if (!result.blackbird.coverage.isComplete || (result.aggregateCompatibility && !result.aggregateCompatibility.isExact)) {
    return { label: "Partial", tone: "amber" as const };
  }
  return { label: "Complete", tone: "green" as const };
}

function getProviderComparisonLabel(comparison: ProviderPointComparison | null) {
  if (!comparison) {
    return { label: "No provider total", tone: "slate" as const };
  }
  if (comparison.comparisonStatus === "match") {
    return { label: "Match", tone: "green" as const };
  }
  if (comparison.comparisonStatus === "close") {
    return { label: "Close", tone: "amber" as const };
  }
  if (comparison.comparisonStatus === "incomplete_blackbird_coverage") {
    return { label: "Incomplete coverage", tone: "amber" as const };
  }
  return { label: "Different", tone: "rose" as const };
}

function statusTone(status: string) {
  if (status === "ready") return "green" as const;
  if (status === "conditionally_ready") return "amber" as const;
  if (status === "insufficient_data") return "slate" as const;
  return "rose" as const;
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function getApiErrorMessage(payload: ScoringInspectorResponse | LeagueScoringValidationReport | ApiErrorPayload, fallback: string) {
  return "error" in payload && payload.error?.message ? payload.error.message : fallback;
}

function formatPoints(value: number) {
  return value.toFixed(2);
}

function formatSignedPoints(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}`;
}

function joinOrNone(values: string[]) {
  return values.length > 0 ? values.join(", ") : "None";
}

function joinMissingStats(values: StoredRowScoringResult["blackbird"]["coverage"]["missingStatsForSupportedKeys"]) {
  return values.length > 0 ? values.map((item) => `${item.scoringKey} (${item.requiredStats.join(", ")})`).join(", ") : "None";
}

function joinAliasWarnings(values: StoredRowScoringResult["blackbird"]["coverage"]["ambiguousStatAliases"]) {
  return values.length > 0 ? values.map((item) => `${item.canonicalKey} (${item.presentAliases.join(", ")})`).join(", ") : "None";
}

function isRowValidationResult(
  value: RowValidationResult | RowValidationError
): value is RowValidationResult {
  return "scoringResult" in value;
}

const INPUT_CLASS = "w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100";
