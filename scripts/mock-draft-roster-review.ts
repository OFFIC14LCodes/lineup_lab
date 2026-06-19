import {
  runMockDraftRosterReview,
  writeMockDraftRosterReviewArtifacts,
} from "@/lib/draft/mock-draft-roster-review";

import { arg } from "./h9-projection-hardening-utils";

void main();

function main() {
  const projectionSeason = Number(arg("--projection-season"));
  const inputPath = arg("--input");
  if (!Number.isInteger(projectionSeason)) throw new Error("--projection-season=<year> is required.");
  if (!inputPath) throw new Error("--input=<path> is required.");

  const report = runMockDraftRosterReview({ projectionSeason, inputPath });
  const artifacts = writeMockDraftRosterReviewArtifacts(report);
  console.log("Blackbird Mock Draft Roster Review");
  console.log(`  draft room: ${report.draftRoomId}`);
  console.log(`  invalid issue tags: ${report.invalidIssueTags.length}`);
  console.log(`  safety gates: ${report.safetyGates.filter((gate) => gate.passed).length}/${report.safetyGates.length} passed`);
  console.log("  artifacts:");
  console.log(`    ${artifacts.jsonPath}`);
  console.log(`    ${artifacts.markdownPath}`);
  console.log(`    ${artifacts.csvPath}`);
}
