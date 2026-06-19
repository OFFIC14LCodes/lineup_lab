import {
  normalizePlayerIdCrosswalkSource,
  writePlayerIdCrosswalkSourceArtifacts,
} from "@/lib/data-acquisition/player-id-crosswalk-source";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const season = Number(arg("--season"));
  if (!Number.isInteger(season)) throw new Error("--season=<year> is required.");
  const inputPath = arg("--input");
  if (!inputPath) throw new Error("--input=<csv-path> is required.");

  const report = normalizePlayerIdCrosswalkSource({ season, inputPath });
  const artifacts = writePlayerIdCrosswalkSourceArtifacts(report);

  console.log("Blackbird Player ID Crosswalk Source Normalize");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  season: ${report.season}`);
  console.log(`  input: ${report.inputPath}`);
  console.log(`  source rows: ${report.sourceRows}`);
  console.log(`  normalized rows: ${report.normalizedRows}`);
  console.log(`  duplicate rows removed: ${report.duplicateRowsRemoved}`);
  console.log(`  invalid rows: ${report.invalidRows}`);
  console.log(`  missing GSIS rows: ${report.missingGsisRows}`);
  console.log("  confidence counts:");
  for (const [confidence, count] of Object.entries(report.confidenceCounts)) {
    console.log(`    ${confidence}: ${count}`);
  }
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
