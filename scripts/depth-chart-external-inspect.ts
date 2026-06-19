import { inspectExternalDepthChartCsv } from "@/lib/data-acquisition/depth-chart-external-source";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const inputPath = arg("--input");
  if (!inputPath) throw new Error("--input=<csv-path> is required.");

  const report = inspectExternalDepthChartCsv(inputPath);

  console.log("Blackbird External Depth Chart Inspect");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  input: ${report.inputPath}`);
  console.log(`  headers (${report.headers.length}): ${report.headers.join(", ")}`);
  console.log(`  row count: ${report.rowCount}`);
  console.log(`  unique teams: ${report.uniqueTeams.join(", ") || "none"}`);
  console.log(`  unique positions: ${report.uniquePositions.join(", ") || "none"}`);
  console.log("  likely columns:");
  console.log(JSON.stringify(report.likelyColumns, null, 2));
  console.log("  missing/blank rates:");
  console.log(JSON.stringify(report.missingBlankRates, null, 2));
  console.log("  sample rows:");
  console.log(JSON.stringify(report.sampleRows, null, 2));
}
