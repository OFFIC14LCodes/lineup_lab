import { buildRookieSourceFiles } from "@/lib/data-acquisition/source-fill-workflow";
import { loadLocalEnv, writeDiagnostic } from "./h9-projection-hardening-utils";

loadLocalEnv();

const apply = process.argv.includes("--apply");
const dryRun = process.argv.includes("--dry-run") || !apply;
const report = buildRookieSourceFiles({ apply, dryRun });
writeDiagnostic("h9-rookie-source-files-build", report);
console.log(JSON.stringify({
  verdict: report.verdict,
  dryRun: report.dryRun,
  apply: report.apply,
  generatedPriorityFillFiles: report.generatedPriorityFillFiles,
  mergeResults: report.mergeResults,
  artifact: "artifacts/projections/h9-rookie-source-files-build.json",
}, null, 2));
if (report.verdict === "failed") process.exitCode = 1;
