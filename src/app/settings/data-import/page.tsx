import Link from "next/link";

import { PageShell, Panel } from "@/components/ui";
import { ProviderDataImportPanel } from "@/components/provider-data-import-panel";
import { requireProviderImportAccess } from "@/lib/providers/import/access";
import { IMPORT_TEMPLATES } from "@/lib/providers/import/templates";

export default async function DataImportPage() {
  await requireProviderImportAccess();

  return (
    <PageShell className="space-y-6">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Provider Data Import</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Internal-only manual JSON and CSV import for football data review. Preview rows, approve identity matches, then explicitly execute the ready subset.
            </p>
          </div>
          <Link href="/settings" className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300">
            Back to settings
          </Link>
        </div>
      </Panel>

      <ProviderDataImportPanel />

      <Panel>
        <h2 className="text-xl font-bold">Templates and examples</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {Object.values(IMPORT_TEMPLATES).map((template) => (
            <div key={template.datasetKind} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div className="text-sm font-semibold text-slate-100">{template.title}</div>
              <div className="mt-2 text-xs text-slate-400">
                Required: {template.requiredFields.map((field) => field.name).join(", ")}
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <a href={`/examples/provider-import/${template.datasetKind}.csv`} className="text-brand hover:underline">
                  Sample CSV
                </a>
                <a href={`/examples/provider-import/${template.datasetKind}.json`} className="text-brand hover:underline">
                  Sample JSON
                </a>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </PageShell>
  );
}
