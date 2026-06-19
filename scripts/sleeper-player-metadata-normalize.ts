import {
  normalizeSleeperPlayerMetadataSource,
  writeSleeperPlayerMetadataArtifacts,
} from "@/lib/data-acquisition/sleeper-player-metadata-source";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const season = Number(arg("--season"));
  if (!Number.isInteger(season)) throw new Error("--season=<year> is required.");
  const inputPath = arg("--input");
  if (!inputPath) throw new Error("--input=<json-or-csv-path> is required.");

  const report = normalizeSleeperPlayerMetadataSource({ season, inputPath });
  const artifacts = writeSleeperPlayerMetadataArtifacts(report);

  console.log("Blackbird Sleeper Player Metadata Normalize");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  season: ${report.season}`);
  console.log(`  input: ${report.inputPath}`);
  console.log(`  source rows: ${report.sourceRows}`);
  console.log(`  normalized rows: ${report.normalizedRows}`);
  console.log(`  invalid rows: ${report.invalidRows}`);
  console.log(`  active rows: ${report.activeRows}`);
  console.log(`  inactive rows: ${report.inactiveRows}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
