import {
  runProjectionUniverseHygieneSummary,
  writeProjectionUniverseHygieneSummaryArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionUniverseHygieneSummary({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionUniverseHygieneSummaryArtifacts(report);
  const passedGates = report.hygieneGates.filter((gate) => gate.passed).length;
  const failedGates = report.hygieneGates.filter((gate) => !gate.passed);

  console.log("Blackbird Projection Universe Hygiene Summary");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  hygiene gates: ${passedGates}/${report.hygieneGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  hygiene counts:");
  console.log(`    total rows: ${report.hygieneCounts.totalRows}`);
  console.log(`    active plausible: ${report.hygieneCounts.activePlausible}`);
  console.log(`    low-confidence plausible: ${report.hygieneCounts.lowConfidencePlausible}`);
  console.log(`    rookie/new: ${report.hygieneCounts.rookieNew}`);
  console.log(`    stale historical: ${report.hygieneCounts.staleHistorical}`);
  console.log(`    retired/legacy suspect: ${report.hygieneCounts.retiredLegacySuspect}`);
  console.log(`    blocked from promotion: ${report.hygieneCounts.blockedFromPromotion}`);
  console.log(`    shadow-only: ${report.hygieneCounts.shadowOnly}`);
  console.log(`    eligible: ${report.hygieneCounts.eligible}`);
  console.log(`    missing team: ${report.hygieneCounts.missingTeam}`);
  console.log(`    old last-seen signal: ${report.hygieneCounts.oldLastSeenSignal}`);
  console.log("  kicker policy:");
  console.log(`    total K rows: ${report.kickerPolicy.totalKRows}`);
  console.log(`    eligible K rows: ${report.kickerPolicy.eligibleKRows}`);
  console.log(`    shadow-only K rows: ${report.kickerPolicy.shadowOnlyKRows}`);
  console.log(`    blocked K rows: ${report.kickerPolicy.blockedKRows}`);
  console.log(`    low-prior K rows: ${report.kickerPolicy.lowPriorKRows}`);
  console.log(`    K critical movers: ${report.kickerPolicy.criticalMovementKRows}`);
  console.log(`    recommended next action: ${report.kickerPolicy.recommendedNextAction}`);
  console.log("  roster/team confidence:");
  console.log(`    rows with current team: ${report.rosterTeamConfidence.rowsWithCurrentTeam}`);
  console.log(`    rows missing team: ${report.rosterTeamConfidence.rowsMissingTeam}`);
  console.log(`    rows with ambiguous team: ${report.rosterTeamConfidence.rowsWithAmbiguousTeam}`);
  console.log(`    rows with stale team: ${report.rosterTeamConfidence.rowsWithStaleTeam}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
