import {
  normalizeDepthChartSource,
  writeDepthChartSourceArtifacts,
} from "@/lib/data-acquisition/depth-chart-source";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const season = Number(arg("--season"));
  if (!Number.isInteger(season)) throw new Error("--season=<year> is required.");
  const inputPath = arg("--input");
  if (!inputPath) throw new Error("--input=<csv-path> is required.");

  const report = normalizeDepthChartSource({ season, inputPath });
  const artifacts = writeDepthChartSourceArtifacts(report);

  console.log("Blackbird Depth Chart Source Normalize");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  season: ${report.season}`);
  console.log(`  input: ${report.inputPath}`);
  console.log(`  source rows: ${report.sourceRows}`);
  console.log(`  normalized rows: ${report.normalizedRows}`);
  console.log(`  duplicate rows removed: ${report.duplicateRowsRemoved}`);
  console.log(`  invalid rows: ${report.invalidRows}`);
  console.log(`  missing identity rows: ${report.missingIdentityRows}`);
  console.log(`  conflict rows: ${report.conflictRows}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
