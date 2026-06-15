import Link from "next/link";

import { ProjectionPreviewPanel } from "@/components/projection-preview-panel";
import { PageShell, Panel } from "@/components/ui";
import { loadCombinedProjectionPreview, type ProjectionPreviewFilters } from "@/lib/projections/load-combined-projection-preview";
import { requireBaselineProjectionsAccess } from "@/lib/projections/server/access";

export const dynamic = "force-dynamic";

type ProjectionPreviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectionPreviewPage({ searchParams }: ProjectionPreviewPageProps) {
  await requireBaselineProjectionsAccess();

  const params = await searchParams;
  const filters = parseFilters(params ?? {});
  const result = await loadPreviewSafely(filters);

  return (
    <PageShell className="space-y-6">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Projection Preview</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Internal read-only inspection for the H9.13 combined projection read model.
            </p>
          </div>
          <Link href="/settings" className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300">
            Back to settings
          </Link>
        </div>
      </Panel>

      {"error" in result ? (
        <Panel>
          <h2 className="text-lg font-bold">Load Failure</h2>
          <p className="mt-3 text-sm text-slate-300">{result.error}</p>
        </Panel>
      ) : (
        <ProjectionPreviewPanel result={result} />
      )}
    </PageShell>
  );
}

async function loadPreviewSafely(filters: ProjectionPreviewFilters) {
  try {
    return await loadCombinedProjectionPreview(filters);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Combined projection preview failed to load.",
    };
  }
}

function parseFilters(params: Record<string, string | string[] | undefined>): ProjectionPreviewFilters {
  return {
    leagueId: first(params.leagueId),
    includeDstDryRun: first(params.includeDstDryRun) === "true",
    includeAllPositions: first(params.includeAllPositions) === "true",
    position: first(params.position),
    search: first(params.search),
    projectionSource: first(params.projectionSource) as ProjectionPreviewFilters["projectionSource"],
    confidenceLabel: first(params.confidenceLabel),
    marketStatus: first(params.marketStatus) as ProjectionPreviewFilters["marketStatus"],
    readiness: first(params.readiness) as ProjectionPreviewFilters["readiness"],
  };
}

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
