import {
  runMockDraftResultCapture,
  writeMockDraftResultCaptureArtifacts,
} from "@/lib/draft/mock-draft-result-capture";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  const inputPath = arg("--input");
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");
  if (!inputPath) throw new Error("--input=<path> is required.");

  const report = runMockDraftResultCapture({ projectionSeason, inputPath });
  const artifacts = writeMockDraftResultCaptureArtifacts(report);
  console.log("Blackbird Mock Draft Result Capture");
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  teams: ${report.allTeamRosters.length}`);
  console.log(`  my roster positions: ${Object.keys(report.myRosterByPosition).join(", ")}`);
  console.log(`  overall grade: ${report.grades.overall_grade}`);
  console.log(`  safety gates: ${report.safetyGates.filter((gate) => gate.passed).length}/${report.safetyGates.length} passed`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
