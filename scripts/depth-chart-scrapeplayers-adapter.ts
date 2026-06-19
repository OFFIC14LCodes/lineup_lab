import { convertScrapePlayersDepthChart } from "@/lib/data-acquisition/depth-chart-external-source";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const inputPath = arg("--input");
  if (!inputPath) throw new Error("--input=<path to master_nfl_depth_chart.csv> is required.");
  const outputPath = arg("--output") ?? "data/depth-charts/depth-chart-2026.csv";
  const season = Number(arg("--season"));
  if (!Number.isInteger(season)) throw new Error("--season=<year> is required.");

  const report = convertScrapePlayersDepthChart({ inputPath, outputPath, season });

  console.log("Blackbird ScrapePlayers Depth Chart Adapter");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  input: ${report.inputPath}`);
  console.log(`  output: ${report.outputPath}`);
  console.log(`  season: ${report.season}`);
  console.log(`  source rows: ${report.sourceRows}`);
  console.log(`  converted rows: ${report.convertedRows}`);
  console.log(`  skipped rows: ${report.skippedRows}`);
  console.log("  inferred columns:");
  console.log(JSON.stringify(report.inferredColumns, null, 2));
  console.log("  role counts:");
  console.log(JSON.stringify(report.roleCounts, null, 2));
  console.log("  status counts:");
  console.log(JSON.stringify(report.statusCounts, null, 2));
  console.log(`  issues: ${report.issues.length}`);
  console.log("  stale-source note: stale_source_trial_not_current_2026_truth");
}
