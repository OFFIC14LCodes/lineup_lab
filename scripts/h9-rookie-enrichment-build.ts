import { buildRookieEnrichment } from "@/lib/data-acquisition/build-rookie-enrichment";
import { arg, loadLocalEnv, writeDiagnostic } from "./h9-projection-hardening-utils";

loadLocalEnv();

const report = buildRookieEnrichment({
  priorityOnly: process.argv.includes("--priority-only"),
  writeFiles: true,
});

writeDiagnostic("h9-rookie-enrichment-build", report);
console.log(JSON.stringify({
  verdict: report.verdict,
  priorityOnly: report.priorityOnly,
  counts: report.counts,
  files: report.files,
  artifact: "artifacts/projections/h9-rookie-enrichment-build.json",
}, null, 2));

if (report.verdict === "failed") process.exitCode = 1;
