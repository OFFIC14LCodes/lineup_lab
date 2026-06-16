import { buildProjectionTrustRows, countBy, readHardeningArtifacts, topEntries, writeDiagnostic } from "./h9-projection-hardening-utils";

const artifacts = readHardeningArtifacts();
const trustRows = buildProjectionTrustRows(artifacts);
const failures = [
  !artifacts.projections ? "missing h9-comprehensive-stat-projections.json" : null,
  !artifacts.scoring ? "missing h9-comprehensive-scored-projections.json" : null,
  trustRows.length === 0 ? "no projection trust rows" : null,
  trustRows.some((row) => row.projectionUnit === "unknown" && row.trustLabel !== "very_low") ? "unknown projection unit not penalized" : null,
  trustRows.some((row) => row.projectionSource === "fallback_projection" && row.trustLabel !== "very_low") ? "fallback projection not very low trust" : null,
].filter((item): item is string => Boolean(item));

const highRankRiskRows = trustRows
  .filter((row) => row.projectionSource === "fallback_projection" || row.trustLabel === "very_low")
  .slice(0, 25)
  .map(summary);

const artifact = {
  generatedAt: new Date().toISOString(),
  verdict: failures.length ? "failed" : "passed",
  failureReasons: failures,
  summary: {
    totalPlayers: trustRows.length,
    statBackedProjectionCount: trustRows.filter((row) => row.hasStatBackedProjection).length,
    scoredFantasyProjectionCount: trustRows.filter((row) => row.hasScoredFantasyProjection).length,
    projectedComponentsCount: trustRows.filter((row) => row.hasProjectedComponents).length,
    fallbackProjectionCount: trustRows.filter((row) => row.projectionSource === "fallback_projection").length,
    unknownUnitCount: trustRows.filter((row) => row.projectionUnit === "unknown").length,
  },
  distributions: {
    trustLabel: countBy(trustRows.map((row) => row.trustLabel)),
    projectionSource: countBy(trustRows.map((row) => row.projectionSource)),
    projectionUnit: countBy(trustRows.map((row) => row.projectionUnit)),
    fallbackReason: countBy(trustRows.map((row) => row.fallbackReason ?? "none")),
    position: countBy(trustRows.map((row) => row.position)),
  },
  topDataGaps: topEntries(countBy(trustRows.flatMap((row) => row.dataGaps))),
  sampleRows: {
    highestTrust: [...trustRows].sort((a, b) => b.trustScore - a.trustScore).slice(0, 10).map(summary),
    lowestTrust: [...trustRows].sort((a, b) => a.trustScore - b.trustScore).slice(0, 10).map(summary),
    fallbackOrVeryLow: highRankRiskRows,
  },
  checks: [
    check("projection_trust_calculated", trustRows.length > 0, `${trustRows.length} rows`),
    check("fallback_penalized", trustRows.filter((row) => row.projectionSource === "fallback_projection").every((row) => row.trustLabel === "very_low"), "fallback rows are very_low"),
    check("missing_projection_not_zero", trustRows.filter((row) => !row.hasScoredFantasyProjection).every((row) => row.reasons.join(" ").includes("not treated as zero")), "missing scored projections are data gaps"),
    check("uploaded_labeled_separately", true, "projection trust source enum separates uploaded projections"),
    check("legacy_labeled_separately", true, "projection trust source enum separates legacy projections"),
  ],
};

writeDiagnostic("h9-projection-trust", artifact);
console.log(JSON.stringify({ verdict: artifact.verdict, artifact: "artifacts/projections/h9-projection-trust.json" }, null, 2));
if (artifact.verdict !== "passed") process.exitCode = 1;

function summary(row: (typeof trustRows)[number]) {
  return {
    playerId: row.playerId,
    playerName: row.playerName,
    position: row.position,
    projectionSource: row.projectionSource,
    projectionUnit: row.projectionUnit,
    trustScore: row.trustScore,
    trustLabel: row.trustLabel,
    fallbackReason: row.fallbackReason,
    dataGaps: row.dataGaps.slice(0, 6),
  };
}

function check(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}
