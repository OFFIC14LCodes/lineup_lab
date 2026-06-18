import {
  runProjectionRankImpactTierDecisions,
  writeProjectionRankImpactTierDecisionArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");
  const report = runProjectionRankImpactTierDecisions({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
    decisionsFile: arg("--decisions-file"),
  });
  const artifacts = writeProjectionRankImpactTierDecisionArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird Rank Impact Tier Decisions");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  verdict: ${report.verdict}`);
  console.log(`  decisions file: ${report.decisionsFile ?? "default decisions"}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log(`  total tier-review rows: ${report.summary.totalTierReviewRows}`);
  console.log(`  tier approved: ${report.summary.resolvedTierStatusCounts.tier_approved}`);
  console.log(`  tier current path: ${report.summary.resolvedTierStatusCounts.tier_current_path}`);
  console.log(`  tier shadow-only: ${report.summary.resolvedTierStatusCounts.tier_shadow_only}`);
  console.log(`  tier unresolved: ${report.summary.resolvedTierStatusCounts.tier_unresolved}`);
  console.log(`  validation errors: ${report.summary.validationErrors}`);
  console.log(`  policy violations: ${report.summary.policyViolations}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.templateCsvPath}`);
  console.log(`    ${artifacts.templateJsonPath}`);
  console.log(`    ${artifacts.resolvedCsvPath}`);
  console.log(`    ${artifacts.resolvedJsonPath}`);
  console.log(`    ${artifacts.resolvedMarkdownPath}`);
}
