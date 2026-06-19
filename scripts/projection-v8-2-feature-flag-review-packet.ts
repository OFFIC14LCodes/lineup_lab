import {
  runProjectionV82FeatureFlagReviewPacket,
  writeProjectionV82FeatureFlagReviewPacketArtifacts,
} from "@/lib/projections/backtesting";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");

  const report = runProjectionV82FeatureFlagReviewPacket({
    projectionSeason,
    includeIdp: process.argv.includes("--include-idp"),
  });
  const artifacts = writeProjectionV82FeatureFlagReviewPacketArtifacts(report);
  const passedGates = report.safetyGates.filter((gate) => gate.passed).length;
  const failedGates = report.safetyGates.filter((gate) => !gate.passed);

  console.log("Blackbird v8.2 Feature-Flag Review Packet");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  projection season: ${report.projectionSeason}`);
  console.log(`  feature flag: ${report.featureFlagName}`);
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  safety gates: ${passedGates}/${report.safetyGates.length} passed`);
  if (failedGates.length) console.log(`  failed gates: ${failedGates.map((gate) => gate.name).join(", ")}`);
  console.log("  safety summary:");
  console.log(`    disabled mode v8.2 rows: ${report.safetySummary.disabledModeV82Rows}`);
  console.log(`    enabled safe subset v8.2 rows: ${report.safetySummary.enabledSafeSubsetV82Rows}`);
  console.log(`    current path protected rows: ${report.safetySummary.currentPathProtectedRows}`);
  console.log(`    excluded rows: ${report.safetySummary.excludedRows}`);
  console.log(`    blocked rows: ${report.safetySummary.blockedRows}`);
  console.log(`    missing artifact fallback rows: ${report.safetySummary.missingArtifactFallbackRows}`);
  console.log("  recommendation impact:");
  console.log(`    top suggestion changed: ${report.recommendationImpactSummary.topSuggestionChanged}`);
  console.log(`    top 5 overlap: ${report.recommendationImpactSummary.top5Overlap}`);
  console.log(`    top 10 overlap: ${report.recommendationImpactSummary.top10Overlap}`);
  console.log(`    top 300 affected rows: ${report.recommendationImpactSummary.top300AffectedRows}`);
  console.log(`    QB/Superflex-sensitive rows: ${report.recommendationImpactSummary.qbSuperflexSensitiveRows}`);
  console.log(`    starter-tier movement rows: ${report.recommendationImpactSummary.starterTierMovementRows}`);
  console.log(`    deep-tier/noise rows shown: ${report.recommendationImpactSummary.deepTierNoiseRowsShown}`);
  console.log("  War Room impact:");
  console.log(`    value movement rows: ${report.warRoomImpactSummary.valueMovementRows}`);
  console.log(`    reasoning likely changed rows: ${report.warRoomImpactSummary.reasoningLikelyChangedRows}`);
  console.log(`    GM Brief headline changed: ${report.warRoomImpactSummary.gmBriefHeadlineChanged}`);
  console.log(`    GM Brief top recommendation summary changed: ${report.warRoomImpactSummary.gmBriefTopRecommendationSummaryChanged}`);
  console.log(`    Plan Alignment changed rows: ${report.warRoomImpactSummary.planAlignmentChangedRows}`);
  console.log(`    risk/confidence changed rows: ${report.warRoomImpactSummary.riskConfidenceChangedRows}`);
  console.log(`    not-estimated areas: ${report.warRoomImpactSummary.notEstimatedAreas.length}`);
  console.log("  allowed next step:");
  console.log(`    ${report.executiveSummary.allowedNextStep}`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
