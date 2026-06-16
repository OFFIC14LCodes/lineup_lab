import { buildIdentityReviewQueue, writeIdentityReviewArtifacts } from "@/lib/data-acquisition/player-identity";

import { loadLocalEnv } from "./h9-projection-hardening-utils";

loadLocalEnv();

const queue = buildIdentityReviewQueue();
writeIdentityReviewArtifacts(queue);

console.log("Blackbird Player Identity Review Queue");
console.log(`  active unmatched rows: ${queue.summary.activeUnmatchedRows}`);
console.log(`  active conflict rows: ${queue.summary.activeConflictRows}`);
console.log(`  by priority: ${JSON.stringify(queue.summary.byPriority)}`);
console.log(`  by recommended action: ${JSON.stringify(queue.summary.byRecommendedAction)}`);
console.log("  artifacts:");
console.log("    artifacts/projections/player-identity-review-summary.md");
console.log("    artifacts/projections/player-identity-review-active-unmatched.csv");
console.log("    artifacts/projections/player-identity-review-active-conflicts.csv");
console.log("    artifacts/projections/player-identity-review-active-unmatched.json");
console.log("    artifacts/projections/player-identity-review-active-conflicts.json");
