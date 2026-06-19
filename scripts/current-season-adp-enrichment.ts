import {
  runCurrentSeasonAdpEnrichment,
  writeCurrentSeasonAdpEnrichmentArtifacts,
} from "@/lib/projections/backtesting/current-season-adp-enrichment";

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  return [key, rest.join("=") || "true"];
}));

const season = Number(args.get("season"));
const marketFormat = args.get("market-format") ?? args.get("marketFormat") ?? "SUPERFLEX";
const adpPath = args.get("input") ?? args.get("adp-path") ?? undefined;

if (!Number.isFinite(season)) {
  console.error("Usage: npm run projection:current-adp:enrich -- --season=2026 --market-format=SUPERFLEX");
  process.exit(1);
}

const report = runCurrentSeasonAdpEnrichment({ season, marketFormat, adpPath });
const artifacts = writeCurrentSeasonAdpEnrichmentArtifacts(report);

console.log("Blackbird Current Season ADP Enrichment");
console.log(`  recommendation: ${report.recommendation}`);
console.log(`  dry run: ${report.dryRun}`);
console.log(`  read only: ${report.readOnly}`);
console.log(`  season: ${report.season}`);
console.log(`  market format: ${report.marketFormat}`);
console.log(`  current universe rows: ${report.matchQuality.currentUniverseRows}`);
console.log(`  ADP rows for selected format: ${report.matchQuality.adpRowsForSelectedMarketFormat}`);
console.log(`  exact ID matches: ${report.matchQuality.exactIdMatches}`);
console.log(`  name/team/position matches: ${report.matchQuality.nameTeamPositionMatches}`);
console.log(`  unique name/position matches: ${report.matchQuality.uniqueNamePositionMatches}`);
console.log(`  review candidates: ${report.matchQuality.reviewCandidates}`);
console.log(`  unmatched ADP rows: ${report.matchQuality.unmatchedAdpRows}`);
console.log(`  universe rows without ADP: ${report.matchQuality.universeRowsWithoutAdp}`);
console.log("  market movement preview:");
console.log(`    players with ADP: ${report.marketSanityPreview.playersWithMarketAdp}`);
console.log(`    players without ADP: ${report.marketSanityPreview.playersWithoutMarketAdp}`);
console.log(`    average movement: ${report.marketSanityPreview.averageRankMovement}`);
console.log(`    max movement: ${report.marketSanityPreview.maxRankMovement}`);
console.log(`    unsupported positions filtered: ${report.marketSanityPreview.unsupportedPositionsFiltered.join(", ") || "none"}`);
console.log("  safety preview:");
console.log(`    ADP parsed: ${report.warRoomSafetyPreview.adpMarketSourceParsed}`);
console.log(`    Superflex rows available: ${report.warRoomSafetyPreview.superflexMarketRowsAvailable}`);
console.log(`    K rows exist in ADP: ${report.warRoomSafetyPreview.kRowsExistInAdpSource}`);
console.log(`    K excluded when no K slot: ${report.warRoomSafetyPreview.kExcludedByRosterEligibilityWhenNoKSlot}`);
console.log(`    DST/IDP excluded unsupported: ${report.warRoomSafetyPreview.dstIdpExcludedWhenUnsupported}`);
console.log(`  safety gates: ${report.safetyGates.filter((gate) => gate.passed).length}/${report.safetyGates.length} passed`);
console.log("  artifacts:");
for (const artifactPath of Object.values(artifacts)) console.log(`    ${artifactPath}`);
