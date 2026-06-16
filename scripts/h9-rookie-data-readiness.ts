import { buildProjectionTrustRows, countBy, readHardeningArtifacts, topEntries, writeDiagnostic } from "./h9-projection-hardening-utils";
import { loadRookieData } from "@/lib/projections/rookie-data-loader";

const artifacts = readHardeningArtifacts();
const projectionRows = artifacts.projections?.projections ?? [];
const rookies = projectionRows.filter((row) => row.projectionType === "rookie");
const trustById = new Map(buildProjectionTrustRows(artifacts).map((row) => [row.playerId, row]));
const rookieTrust = rookies.map((row) => trustById.get(row.playerId)).filter((row): row is NonNullable<typeof row> => Boolean(row));
const rookieData = loadRookieData({
  candidates: projectionRows.map((row) => ({ id: row.playerId, full_name: row.playerName, position: row.position, team: row.team ?? null })),
  dryRun: true,
  useExampleWhenMissing: true,
});
const importedProfiles = rookieData.rows.map((row) => row.profile);
const artifact = {
  generatedAt: new Date().toISOString(),
  verdict: rookies.length || rookieData.validRows ? "passed" : "blocked",
  rookieCount: rookies.length,
  rookiesWithProjections: rookies.filter((row) => Object.keys(row.stats ?? {}).length > 0).length,
  rookiesMissingProjections: rookies.filter((row) => Object.keys(row.stats ?? {}).length === 0).length,
  rookiesWithDraftCapital: rookies.filter((row) => !row.dataGaps.some((gap) => /draft capital/i.test(gap))).length,
  rookiesWithCollegeProduction: rookies.filter((row) => !row.dataGaps.some((gap) => /college/i.test(gap))).length,
  rookiesWithTeamAssignment: rookies.filter((row) => Boolean(row.team)).length,
  rookiesWithRoleContext: rookies.filter((row) => !row.dataGaps.some((gap) => /role/i.test(gap))).length,
  rookieDataImport: {
    sourcePath: rookieData.sourcePath,
    totalRows: rookieData.totalRows,
    validRows: rookieData.validRows,
    invalidRows: rookieData.invalidRows,
    matchedRows: rookieData.matchedRows,
    unmatchedRows: rookieData.unmatchedRows,
    duplicateCandidateMatches: rookieData.duplicateCandidateMatches,
    ambiguousMatches: rookieData.ambiguousMatches,
    exactIdMatches: rookieData.exactIdMatches,
    namePositionTeamMatches: rookieData.namePositionTeamMatches,
    namePositionMatches: rookieData.namePositionMatches,
    nameOnlyUniqueMatches: rookieData.nameOnlyUniqueMatches,
    enrichmentSourcePath: rookieData.enrichmentSourcePath,
    enrichmentRows: rookieData.enrichmentRows,
    validEnrichmentRows: rookieData.validEnrichmentRows,
    invalidEnrichmentRows: rookieData.invalidEnrichmentRows,
    matchedEnrichmentRows: rookieData.matchedEnrichmentRows,
    unmatchedEnrichmentRows: rookieData.unmatchedEnrichmentRows,
    ambiguousEnrichmentRows: rookieData.ambiguousEnrichmentRows,
    conflictCount: rookieData.conflictCount,
    conflicts: rookieData.conflicts.slice(0, 25),
    noPersistence: true,
  },
  importedRookiesWithDraftCapital: importedProfiles.filter((row) => row.draftCapitalScore !== null).length,
  importedRookiesWithCollegeProduction: importedProfiles.filter((row) => row.collegeProductionScore !== null).length,
  importedRookiesWithRoleContext: importedProfiles.filter((row) => row.landingSpotRole !== "unknown").length,
  rookieProjectionTrustDistribution: countBy(rookieTrust.map((row) => row.trustLabel)),
  projectedConfidenceBeforeAfterAvailableInputs: {
    current: artifacts.projections?.rookieConfidenceDistribution ?? {},
    expectedAfterDraftCapitalCollegeRole: "low-to-medium for rookies with real draft capital, college production, and role context; very_low remains for missing inputs",
  },
  topRookieDataGaps: topEntries(countBy([...rookies.flatMap((row) => row.dataGaps), ...importedProfiles.flatMap((row) => row.dataGaps)])),
  importReadyLocalInputShape: {
    files: ["data/rookies/rookie-data.csv", "data/rookies/rookie-data.json"],
    model: "src/lib/projections/rookie-data-sources.ts",
    loader: "src/lib/projections/rookie-data-loader.ts",
    fields: ["playerId", "playerName", "position", "team", "season", "nflDraftRound", "nflDraftOverall", "college production columns", "landingSpotRole", "source"],
  },
  examplesOfDataNeeded: [
    "NFL draft round and overall pick",
    "college receiving/rushing/passing/tackle production",
    "team assignment and position",
    "role expectation such as starter, committee, rotational, backup",
  ],
};

writeDiagnostic("h9-rookie-data-readiness", artifact);
console.log(JSON.stringify({ verdict: artifact.verdict, artifact: "artifacts/projections/h9-rookie-data-readiness.json" }, null, 2));
if (artifact.verdict === "blocked") process.exitCode = 1;
