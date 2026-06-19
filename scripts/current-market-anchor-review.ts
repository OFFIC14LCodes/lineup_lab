import {
  runCurrentMarketAnchorReview,
  writeCurrentMarketAnchorReviewArtifacts,
} from "@/lib/projections/backtesting/current-market-anchor-review";

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  return [key, rest.join("=") || "true"];
}));

const season = Number(args.get("season"));
const marketFormat = args.get("market-format") ?? args.get("marketFormat") ?? "SUPERFLEX";

if (!Number.isFinite(season)) {
  console.error("Usage: npm run projection:current-market-anchor:review -- --season=2026 --market-format=SUPERFLEX");
  process.exit(1);
}

const report = runCurrentMarketAnchorReview({ season, marketFormat });
const artifacts = writeCurrentMarketAnchorReviewArtifacts(report);

console.log("Blackbird Current Market Anchor Review");
console.log(`  recommendation: ${report.recommendation}`);
console.log(`  dry run: ${report.dryRun}`);
console.log(`  read only: ${report.readOnly}`);
console.log(`  season: ${report.season}`);
console.log(`  market format: ${report.marketFormat}`);
console.log("  movement quality:");
console.log(`    players with ADP: ${report.movementQuality.playersWithMarketAdp}`);
console.log(`    players without ADP: ${report.movementQuality.playersWithoutMarketAdp}`);
console.log(`    average movement: ${report.movementQuality.averageRankMovement}`);
console.log(`    median movement: ${report.movementQuality.medianRankMovement}`);
console.log(`    max movement: ${report.movementQuality.maxRankMovement}`);
console.log(`    moved up: ${report.movementQuality.playersMovedUp}`);
console.log(`    moved down: ${report.movementQuality.playersMovedDown}`);
console.log(`    unchanged: ${report.movementQuality.playersUnchanged}`);
console.log("  match quality:");
console.log(`    exact ID matches: ${report.matchQualityAudit.exactIdMatches}`);
console.log(`    name/team/position matches: ${report.matchQualityAudit.nameTeamPositionMatches}`);
console.log(`    unique name/position matches: ${report.matchQualityAudit.uniqueNamePositionMatches}`);
console.log(`    review candidates: ${report.matchQualityAudit.reviewCandidates}`);
console.log(`    unmatched ADP rows: ${report.matchQualityAudit.unmatchedAdpRows}`);
console.log(`    risk grade: ${report.matchQualityAudit.matchQualityRiskGrade}`);
for (const warning of report.matchQualityAudit.warnings) console.log(`    warning: ${warning}`);
console.log("  Superflex sanity:");
console.log(`    elite QBs pulled upward: ${report.superflexSanity.eliteQbsPulledUpward}`);
console.log(`    non-PPR-only behavior: ${report.superflexSanity.nonSuperflexPprOnlyBehaviorNotUsed}`);
console.log(`    QB order materially different: ${report.superflexSanity.qbsHaveMateriallyDifferentMarketOrderThanOneQb}`);
console.log(`    cap respected: ${report.superflexSanity.maxMovementCapRespected}`);
console.log("  roster eligibility:");
console.log(`    unsupported positions filtered: ${report.rosterEligibilitySafety.unsupportedPositionsFiltered.join(", ") || "none"}`);
console.log(`    no unsupported draftable preview rows: ${report.rosterEligibilitySafety.noUnsupportedPositionsInMarketAnchorDraftablePreview}`);
console.log(`  safety gates: ${report.safetyGates.filter((gate) => gate.passed).length}/${report.safetyGates.length} passed`);
console.log("  artifacts:");
for (const artifactPath of Object.values(artifacts)) console.log(`    ${artifactPath}`);
