import { inspectCurrentRosterSource } from "@/lib/data-acquisition/current-roster-source";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const inputPath = arg("--input");
  if (!inputPath) throw new Error("--input=<csv-or-json-path> is required.");
  const report = inspectCurrentRosterSource(inputPath);

  console.log("Blackbird Current Roster Source Inspect");
  console.log(`  dry run: ${report.dryRun}`);
  console.log(`  read only: ${report.readOnly}`);
  console.log(`  input: ${report.inputPath}`);
  console.log(`  headers (${report.headers.length}): ${report.headers.join(", ")}`);
  console.log(`  direct mapped fields: ${Object.keys(report.directMappedFields).join(", ") || "none"}`);
  console.log(`  missing required fields: ${report.missingRequiredFields.join(", ") || "none"}`);
  console.log(`  missing recommended fields: ${report.missingRecommendedFields.join(", ") || "none"}`);
  console.log("  suggested mapping:");
  console.log(JSON.stringify(report.suggestedMapping, null, 2));
  console.log("  sample rows:");
  console.log(JSON.stringify(report.sampleRows, null, 2));
}
