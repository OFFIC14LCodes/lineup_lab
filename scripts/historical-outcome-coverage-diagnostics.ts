import {
  runHistoricalOutcomeCoverageDiagnostics,
  writeHistoricalOutcomeCoverageDiagnosticsArtifacts,
} from "@/lib/projections/backtesting/historical-outcome-coverage-diagnostics";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const season = Number(arg("--season"));
  if (!Number.isInteger(season)) throw new Error("--season=<year> is required.");

  const report = runHistoricalOutcomeCoverageDiagnostics({ season });
  const artifacts = writeHistoricalOutcomeCoverageDiagnosticsArtifacts(report);
  console.log("Blackbird Historical Outcome Coverage Diagnostics");
  console.log(`  recommendation: ${report.recommendation}`);
  console.log(`  h37 integration: ${report.h37IntegrationRecommendation}`);
  console.log(`  current missing rows: ${report.improvementPreview.current_missing_rows}`);
  console.log(`  true zero week rows: ${report.improvementPreview.true_zero_week_rows_to_synthesize}`);
  console.log(`  remaining missing after preview: ${report.improvementPreview.remaining_missing_after_preview}`);
  console.log(`  projected missing score rate: ${report.improvementPreview.projected_missing_score_rate_after_preview}`);
  console.log(`  safety gates: ${report.safetyGates.filter((gate) => gate.passed).length}/${report.safetyGates.length} passed`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
