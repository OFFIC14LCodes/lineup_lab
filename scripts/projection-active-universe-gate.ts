import {
  runProjectionActiveUniverseGate,
  writeProjectionActiveUniverseGateArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionActiveUniverseGate({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionActiveUniverseGateArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection Active Universe Gate");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  active gate counts:");
  for (const [status, count] of Object.entries(report.activeGateCounts.statusCounts)) {
    console.log(`    ${status}: ${count}`);
  }
  console.log("  candidate pool:");
  console.log(`    active universe candidates: ${report.candidatePool.activeUniverseCandidateRows}`);
  console.log(`    blocked/archive rows: ${report.candidatePool.blockedArchiveRows}`);
  console.log(`    review rows: ${report.candidatePool.reviewRows}`);
  console.log(`    kicker policy rows: ${report.candidatePool.kickerPolicyRows}`);
  console.log("  source integration needs:");
  console.log(`    current roster source: ${report.sourceIntegrationNeeds.currentRosterSourceNeeded}`);
  console.log(`    depth chart source: ${report.sourceIntegrationNeeds.depthChartSourceNeeded}`);
  console.log(`    transaction/free-agent source: ${report.sourceIntegrationNeeds.transactionFreeAgentStatusSourceNeeded}`);
  console.log(`    rookie draft/team source: ${report.sourceIntegrationNeeds.rookieDraftTeamSourceNeeded}`);
  console.log(`    injury/PUP/NFI source: ${report.sourceIntegrationNeeds.injuryPupNfiStatusSourceNeeded}`);
  console.log(`    kicker depth chart/source: ${report.sourceIntegrationNeeds.kickerSpecificDepthChartSourceNeeded}`);
  console.log("  v8.2 packet summary:");
  console.log(`    enabled safe subset rows: ${report.v82SafeSubsetCrossReference.packetSummary.enabledSafeSubsetV82Rows}`);
  console.log(`    current path protected rows: ${report.v82SafeSubsetCrossReference.packetSummary.currentPathProtectedRows}`);
  console.log(`    excluded rows: ${report.v82SafeSubsetCrossReference.packetSummary.excludedRows}`);
  console.log(`    blocked rows: ${report.v82SafeSubsetCrossReference.packetSummary.blockedRows}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
