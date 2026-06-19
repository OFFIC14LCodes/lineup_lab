import {
  runWarRoomE2eQa,
  writeWarRoomE2eQaArtifacts,
} from "@/lib/draft/war-room-e2e-qa";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  const scenarioPath = arg("--scenario");
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");
  if (!scenarioPath) throw new Error("--scenario=<path> is required.");

  const report = runWarRoomE2eQa({ projectionSeason, scenarioPath });
  const artifacts = writeWarRoomE2eQaArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.status === "pass").length;
  const failedGates = report.safetyGates.filter((gate) => gate.status === "fail");

  console.log("Blackbird War Room E2E Draft QA");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  scenario: ${report.scenarioPath}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  sections:");
  for (const [section, status] of Object.entries(report.sectionSummary)) {
    console.log(`    ${section}: ${status}`);
  }
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
