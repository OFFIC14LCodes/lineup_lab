import {
  runWarRoomManualQaReport,
  writeWarRoomManualQaArtifacts,
} from "@/lib/draft/war-room-manual-qa-report";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  const inputPath = arg("--input");
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");
  if (!inputPath) throw new Error("--input=<path> is required.");

  const report = runWarRoomManualQaReport({ projectionSeason, inputPath });
  const artifacts = writeWarRoomManualQaArtifacts(report);
  console.log("Blackbird War Room Manual QA Report");
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  summary: pass=${report.summary.pass} warn=${report.summary.warn} fail=${report.summary.fail} not_tested=${report.summary.not_tested}`);
  console.log(`  triage items: ${report.triage.length}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
