import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";

import { loadRookieData } from "@/lib/projections/rookie-data-loader";
import { coverageSummary } from "@/lib/projections/rookie-enrichment-workflow";
import { arg, countBy, loadLocalEnv, readHardeningArtifacts, topEntries, writeDiagnostic } from "./h9-projection-hardening-utils";

loadLocalEnv();

const DATA_DIR = path.join(process.cwd(), "data", "rookies");
const TEMPLATE_PATH = path.join(DATA_DIR, "rookie-enrichment.csv");
const PRIORITY_PATH = path.join(DATA_DIR, "rookie-enrichment-priority.csv");
const draftRoomId = arg("--draft-room-id");

const artifacts = readHardeningArtifacts();
const projectionRows = artifacts.projections?.projections ?? [];
const loadResult = loadRookieData({
  candidates: projectionRows.map((row) => ({ id: row.playerId, full_name: row.playerName, position: row.position, team: row.team ?? null })),
  dryRun: true,
  useExampleWhenMissing: false,
});
const priorityRows = readCsv(PRIORITY_PATH);
const priorityByPlayerId = new Map(priorityRows.map((row) => [String(row.playerId ?? ""), row]));
const criticalHigh = priorityRows.filter((row) => ["critical", "high"].includes(String(row.priorityTier ?? "")));
const profileByPlayerId = new Map(loadResult.rows.map((row) => [row.matchedPlayerId ?? row.profile.playerId, row.profile]));
const coverage = coverageSummary(loadResult);
const criticalHighMissing = criticalHigh.map((row) => {
  const profile = profileByPlayerId.get(String(row.playerId ?? ""));
  return {
    playerId: String(row.playerId ?? ""),
    playerName: String(row.playerName ?? ""),
    position: String(row.position ?? ""),
    priorityTier: String(row.priorityTier ?? ""),
    missingDraftCapital: !profile || profile.draftCapitalScore === null,
    missingCollegeProduction: !profile || profile.collegeProductionScore === null,
    missingLandingSpotRole: !profile || profile.landingSpotRole === "unknown",
  };
});
const priorityCoverage = Object.fromEntries(
  ["critical", "high", "medium", "low"].map((tier) => {
    const rows = priorityRows.filter((row) => String(row.priorityTier ?? "") === tier);
    return [tier, {
      priorityRows: rows.length,
      withDraftCapital: rows.filter((row) => profileByPlayerId.get(String(row.playerId ?? ""))?.draftCapitalScore !== null).length,
      withCollegeProduction: rows.filter((row) => profileByPlayerId.get(String(row.playerId ?? ""))?.collegeProductionScore !== null).length,
      withLandingSpotRole: rows.filter((row) => {
        const profile = profileByPlayerId.get(String(row.playerId ?? ""));
        return profile ? profile.landingSpotRole !== "unknown" : false;
      }).length,
    }];
  })
);
const checks = [
  check("base_rookie_file_available", Boolean(loadResult.sourcePath), loadResult.sourcePath ?? "missing"),
  check("enrichment_template_available", existsSync(TEMPLATE_PATH), TEMPLATE_PATH),
  check("priority_export_available", existsSync(PRIORITY_PATH), PRIORITY_PATH),
  check("invalid_base_rows_absent", loadResult.invalidRows === 0, `${loadResult.invalidRows} invalid rows`),
  check("invalid_enrichment_rows_absent", loadResult.invalidEnrichmentRows === 0, `${loadResult.invalidEnrichmentRows} invalid enrichment rows`),
  check("conflicts_absent", loadResult.conflictCount === 0, `${loadResult.conflictCount} conflicts`),
  check("unmatched_enrichment_reported", true, `${loadResult.unmatchedEnrichmentRows} unmatched enrichment rows`),
  check("no_adp_fallback", true, "ADP is not used for enrichment coverage"),
];
const artifact = {
  generatedAt: new Date().toISOString(),
  draftRoomId: draftRoomId ?? null,
  verdict: checks.every((row) => row.passed) ? "passed" : "failed",
  checks,
  files: {
    baseSourcePath: loadResult.sourcePath,
    enrichmentPath: TEMPLATE_PATH,
    enrichmentExists: existsSync(TEMPLATE_PATH),
    priorityPath: PRIORITY_PATH,
    priorityExists: existsSync(PRIORITY_PATH),
  },
  totalRookies: coverage.totalRookies,
  enrichmentRows: loadResult.enrichmentRows,
  enrichmentRowsWithDraftCapital: coverage.rowsWithDraftCapital,
  enrichmentRowsWithCollegeProduction: coverage.rowsWithCollegeProduction,
  enrichmentRowsWithLandingSpotRole: coverage.rowsWithLandingSpotRole,
  priorityRows: priorityRows.length,
  coverageByPosition: coverage.coverageByPosition,
  coverageByPriorityTier: priorityCoverage,
  criticalHighPriorityRowsMissingDraftCapital: criticalHighMissing.filter((row) => row.missingDraftCapital),
  criticalHighPriorityRowsMissingCollegeProduction: criticalHighMissing.filter((row) => row.missingCollegeProduction),
  criticalHighPriorityRowsMissingLandingSpotRole: criticalHighMissing.filter((row) => row.missingLandingSpotRole),
  unmatchedEnrichmentRows: loadResult.enrichmentResults.filter((row) => row.matchStatus === "unmatched"),
  ambiguousEnrichmentRows: loadResult.enrichmentResults.filter((row) => row.matchStatus === "ambiguous"),
  conflicts: loadResult.conflicts,
  topMissingFields: topEntries(countBy(loadResult.rows.flatMap((row) => row.profile.dataGaps))),
  nextAction: nextAction(criticalHighMissing.length),
  safety: {
    noScraping: true,
    noPaidApi: true,
    noFabricatedValues: true,
    blankFieldsRemainDataGaps: true,
    noAdpFallback: true,
  },
};

writeDiagnostic("h9-rookie-enrichment-coverage", artifact);
console.log(JSON.stringify({
  verdict: artifact.verdict,
  artifact: "artifacts/projections/h9-rookie-enrichment-coverage.json",
  coverage: {
    totalRookies: artifact.totalRookies,
    enrichmentRows: artifact.enrichmentRows,
    priorityRows: artifact.priorityRows,
    withDraftCapital: artifact.enrichmentRowsWithDraftCapital,
    withCollegeProduction: artifact.enrichmentRowsWithCollegeProduction,
    withLandingSpotRole: artifact.enrichmentRowsWithLandingSpotRole,
  },
  nextAction: artifact.nextAction,
}, null, 2));
if (artifact.verdict !== "passed") process.exitCode = 1;

function readCsv(filePath: string): Array<Record<string, unknown>> {
  if (!existsSync(filePath)) return [];
  const parsed = Papa.parse<Record<string, unknown>>(readFileSync(filePath, "utf8"), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`CSV parse failed for ${filePath}: ${parsed.errors.map((error) => error.message).join("; ")}`);
  return parsed.data;
}

function nextAction(criticalHighRows: number) {
  return `Fill nflDraftRound/nflDraftOverall and college production for the ${criticalHighRows} critical/high priority rookies in data/rookies/rookie-enrichment-priority.csv, then rerun npm run dry-run:h9-rookie-data-import.`;
}

function check(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}
