import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";

import { loadRookieData } from "@/lib/projections/rookie-data-loader";
import { coverageSummary } from "@/lib/projections/rookie-enrichment-workflow";
import { readHardeningArtifacts, writeDiagnostic } from "./h9-projection-hardening-utils";

const artifacts = readHardeningArtifacts();
const candidateRows = artifacts.projections?.projections ?? [];
const priorityPath = path.join(process.cwd(), "data", "rookies", "rookie-enrichment-priority.csv");
const priorityRows = readCsv(priorityPath);
const result = loadRookieData({
  candidates: candidateRows.map((row) => ({
    id: row.playerId,
    full_name: row.playerName,
    position: row.position,
    team: row.team ?? null,
  })),
  dryRun: true,
  useExampleWhenMissing: true,
});
const coverage = coverageSummary(result);
const priorityByTier: Record<string, number> = {};
for (const row of priorityRows) {
  const tier = String(row.priorityTier ?? "unknown");
  priorityByTier[tier] = Number(priorityByTier[tier] ?? 0) + 1;
}
const priorityHighCount = (priorityByTier["critical"] ?? 0) + (priorityByTier["high"] ?? 0);

const profiles = result.rows.map((row) => ({
  playerId: row.profile.playerId,
  playerName: row.profile.playerName,
  position: row.profile.position,
  team: row.profile.team,
  matchStatus: row.matchStatus,
  unresolvedReason: row.unresolvedReason,
  draftCapitalScore: row.profile.draftCapitalScore,
  collegeProductionScore: row.profile.collegeProductionScore,
  opportunityScore: row.profile.opportunityScore,
  landingSpotRole: row.profile.landingSpotRole,
  confidence: row.profile.rookieProjectionConfidence,
  availableInputs: row.profile.availableInputs,
  dataGaps: row.profile.dataGaps,
  sourceLabels: row.profile.sourceLabels,
  errors: row.errors,
}));

const artifact = {
  generatedAt: new Date().toISOString(),
  verdict: result.validRows > 0 ? "passed" : "failed",
  dryRun: true,
  noPersistence: true,
  noAdpFallback: true,
  sourcePath: result.sourcePath,
  prioritySourcePath: existsSync(priorityPath) ? priorityPath : null,
  counts: {
    baseSourcePath: result.sourcePath,
    enrichmentSourcePath: result.enrichmentSourcePath,
    prioritySourcePath: existsSync(priorityPath) ? priorityPath : null,
    totalRows: result.totalRows,
    validRows: result.validRows,
    invalidRows: result.invalidRows,
    matchedRows: result.matchedRows,
    unmatchedRows: result.unmatchedRows,
    duplicateCandidateMatches: result.duplicateCandidateMatches,
    ambiguousMatches: result.ambiguousMatches,
    exactIdMatches: result.exactIdMatches,
    namePositionTeamMatches: result.namePositionTeamMatches,
    namePositionMatches: result.namePositionMatches,
    nameOnlyUniqueMatches: result.nameOnlyUniqueMatches,
    candidatePlayers: candidateRows.length,
    enrichmentRows: result.enrichmentRows,
    validEnrichmentRows: result.validEnrichmentRows,
    invalidEnrichmentRows: result.invalidEnrichmentRows,
    matchedEnrichmentRows: result.matchedEnrichmentRows,
    unmatchedEnrichmentRows: result.unmatchedEnrichmentRows,
    ambiguousEnrichmentRows: result.ambiguousEnrichmentRows,
    conflictCount: result.conflictCount,
    priorityRows: priorityRows.length,
    rowsWithDraftCapital: coverage.rowsWithDraftCapital,
    rowsWithCollegeProduction: coverage.rowsWithCollegeProduction,
    rowsWithLandingSpotRole: coverage.rowsWithLandingSpotRole,
    coverageByPriorityTier: priorityByTier,
  },
  coverageByPosition: coverage.coverageByPosition,
  topMissingFields: topMissingFields(result),
  nextAction: `Fill nflDraftRound/nflDraftOverall and college production for the ${priorityHighCount} critical/high priority rookies in data/rookies/rookie-enrichment-priority.csv, then rerun npm run dry-run:h9-rookie-data-import.`,
  enrichmentResults: result.enrichmentResults,
  conflicts: result.conflicts,
  errors: result.errors.slice(0, 25),
  profiles,
};

writeDiagnostic("h9-rookie-data-import-dry-run", artifact);
console.log(JSON.stringify({ verdict: artifact.verdict, artifact: "artifacts/projections/h9-rookie-data-import-dry-run.json", counts: artifact.counts, topMissingFields: artifact.topMissingFields, nextAction: artifact.nextAction }, null, 2));
if (artifact.verdict === "failed") process.exitCode = 1;

function readCsv(filePath: string): Array<Record<string, unknown>> {
  if (!existsSync(filePath)) return [];
  const parsed = Papa.parse<Record<string, unknown>>(readFileSync(filePath, "utf8"), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`CSV parse failed for ${filePath}: ${parsed.errors.map((error) => error.message).join("; ")}`);
  return parsed.data;
}

function topMissingFields(loadResult: ReturnType<typeof loadRookieData>) {
  const counts = loadResult.rows.flatMap((row) => row.profile.dataGaps).reduce((acc, gap) => {
    acc[gap] = (acc[gap] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20)
    .map(([field, count]) => ({ field, count }));
}
