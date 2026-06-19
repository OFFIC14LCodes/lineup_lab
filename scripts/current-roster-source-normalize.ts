import {
  normalizeCurrentRosterSource,
  writeCurrentRosterSourceArtifacts,
} from "@/lib/data-acquisition/current-roster-source";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const season = Number(arg("--season"));
  if (!Number.isInteger(season)) throw new Error("--season=<year> is required.");
  const inputPath = arg("--input");
  if (!inputPath) throw new Error("--input=<csv-or-json-path> is required.");
  const mappingPath = arg("--mapping");

  const report = normalizeCurrentRosterSource({ season, inputPath, mappingPath });
  const artifacts = writeCurrentRosterSourceArtifacts(report);

  console.log("Blackbird Current Roster Source Normalize");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  season: ${report.season}`);
  console.log(`  input: ${report.inputPath}`);
  console.log(`  mapping: ${report.mappingPath ?? "canonical headers"}`);
  console.log(`  source rows: ${report.sourceRows}`);
  console.log(`  normalized rows: ${report.normalizedRows}`);
  console.log(`  duplicate rows removed: ${report.duplicateRowsRemoved}`);
  console.log(`  invalid rows: ${report.invalidRows}`);
  console.log(`  missing-id rows: ${report.missingIdRows}`);
  console.log("  status counts:");
  for (const [status, count] of Object.entries(report.statusCounts)) {
    console.log(`    ${status}: ${count}`);
  }
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
