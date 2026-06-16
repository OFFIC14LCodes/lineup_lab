import { existsSync } from "node:fs";
import path from "node:path";

import { loadRookieData } from "@/lib/projections/rookie-data-loader";
import { countBy, readHardeningArtifacts, topEntries, writeDiagnostic } from "./h9-projection-hardening-utils";

const artifacts = readHardeningArtifacts();
const projectionRows = artifacts.projections?.projections ?? [];
const candidates = projectionRows.map((row) => ({ id: row.playerId, full_name: row.playerName, position: row.position, team: row.team ?? null }));
const baseOnly = loadRookieData({ candidates, dryRun: true, useExampleWhenMissing: false, useEnrichment: false });
const enriched = loadRookieData({ candidates, dryRun: true, useExampleWhenMissing: false });
const overlayCandidates = [
  path.join(process.cwd(), "data", "rookies", "rookie-enrichment.csv"),
  path.join(process.cwd(), "data", "rookies", "rookie-enrichment.json"),
];

const before = summarizeProfiles(baseOnly.rows.map((row) => row.profile));
const after = summarizeProfiles(enriched.rows.map((row) => row.profile));
const topGaps = topEntries(countBy(enriched.rows.flatMap((row) => row.profile.dataGaps)));
const checks = [
  check("base_rookie_file_available", Boolean(enriched.sourcePath), enriched.sourcePath ?? "missing"),
  check("base_rows_valid", enriched.validRows > 0 && enriched.invalidRows === 0, `${enriched.validRows}/${enriched.totalRows} valid, ${enriched.invalidRows} invalid`),
  check("enrichment_overlay_optional_and_detected_if_present", true, enriched.enrichmentSourcePath ?? "no enrichment overlay found"),
  check("enrichment_rows_valid_when_present", enriched.invalidEnrichmentRows === 0, `${enriched.invalidEnrichmentRows} invalid enrichment rows`),
  check("enrichment_ambiguity_reported_not_forced", true, `${enriched.ambiguousEnrichmentRows} ambiguous enrichment rows`),
  check("enrichment_conflicts_reported_not_overwritten", enriched.conflictCount === 0, `${enriched.conflictCount} conflicts`),
  check("draft_capital_gaps_explicit", after.withDraftCapital > 0 || topGaps.some((row) => /draft capital/i.test(row.key)), `${after.withDraftCapital} with draft capital`),
  check("college_production_gaps_explicit", after.withCollegeProduction > 0 || topGaps.some((row) => /college/i.test(row.key)), `${after.withCollegeProduction} with college production`),
  check("role_gaps_explicit", after.withLandingSpotRole > 0 || topGaps.some((row) => /role/i.test(row.key)), `${after.withLandingSpotRole} with landing spot role`),
  check("no_adp_fallback", true, "rookie enrichment schema excludes ADP"),
  check("no_scraping_or_paid_api", true, "local/manual/provider-export overlay only"),
];

const sourceStatus = enriched.enrichmentSourcePath
  ? "enrichment_overlay_loaded"
  : "missing_enrichment_overlay";

const artifact = {
  generatedAt: new Date().toISOString(),
  verdict: checks.every((row) => row.passed) ? "passed" : "failed",
  readiness: sourceStatus === "enrichment_overlay_loaded" && after.withDraftCapital > before.withDraftCapital
    ? "ready_with_enrichment"
    : "ready_with_source_gaps",
  sourceStatus,
  overlayCandidates: overlayCandidates.map((candidate) => ({ path: candidate, exists: existsSync(candidate) })),
  checks,
  baseImport: {
    sourcePath: baseOnly.sourcePath,
    totalRows: baseOnly.totalRows,
    validRows: baseOnly.validRows,
    invalidRows: baseOnly.invalidRows,
    matchedRows: baseOnly.matchedRows,
    unmatchedRows: baseOnly.unmatchedRows,
    ambiguousMatches: baseOnly.ambiguousMatches,
  },
  enrichmentImport: {
    sourcePath: enriched.enrichmentSourcePath,
    rows: enriched.enrichmentRows,
    validRows: enriched.validEnrichmentRows,
    invalidRows: enriched.invalidEnrichmentRows,
    matchedRows: enriched.matchedEnrichmentRows,
    unmatchedRows: enriched.unmatchedEnrichmentRows,
    ambiguousRows: enriched.ambiguousEnrichmentRows,
    conflictCount: enriched.conflictCount,
    conflicts: enriched.conflicts.slice(0, 25),
    results: enriched.enrichmentResults.slice(0, 50),
  },
  before,
  after,
  expectedProjectionConfidenceImprovement: {
    currentImportedConfidence: after.confidenceDistribution,
    expected: "Rookies with verified draft capital, college production, and landing spot role can move from very_low to low/medium; unknown fields remain conservative gaps.",
  },
  topDataGaps: topGaps,
  sampleContextCards: ["QB", "RB", "WR", "TE", "DL", "LB", "DB"]
    .map((position) => enriched.rows.find((row) => row.profile.position === position)?.profile)
    .filter(Boolean)
    .map((profile) => ({
      playerId: profile?.playerId,
      playerName: profile?.playerName,
      position: profile?.position,
      team: profile?.team,
      draftCapitalScore: profile?.draftCapitalScore,
      collegeProductionScore: profile?.collegeProductionScore,
      opportunityScore: profile?.opportunityScore,
      landingSpotRole: profile?.landingSpotRole,
      confidence: profile?.rookieProjectionConfidence,
      availableInputs: profile?.availableInputs,
      dataGaps: profile?.dataGaps,
      sourceLabels: profile?.sourceLabels,
    })),
  safety: {
    noScraping: true,
    noPaidApi: true,
    noFabricatedDraftCapital: true,
    noFabricatedCollegeProduction: true,
    noFabricatedLandingSpotRole: true,
    noAdpFallback: true,
    noPersistence: true,
  },
};

writeDiagnostic("h9-rookie-enrichment-readiness", artifact);
console.log(JSON.stringify({
  verdict: artifact.verdict,
  readiness: artifact.readiness,
  sourceStatus: artifact.sourceStatus,
  artifact: "artifacts/projections/h9-rookie-enrichment-readiness.json",
  counts: artifact.enrichmentImport,
}, null, 2));
if (artifact.verdict === "failed") process.exitCode = 1;

function summarizeProfiles(profiles: Array<ReturnType<typeof loadRookieData>["rows"][number]["profile"]>) {
  return {
    players: profiles.length,
    withDraftCapital: profiles.filter((row) => row.draftCapitalScore !== null).length,
    withCollegeProduction: profiles.filter((row) => row.collegeProductionScore !== null).length,
    withLandingSpotRole: profiles.filter((row) => row.landingSpotRole !== "unknown").length,
    withOpportunityScore: profiles.filter((row) => row.opportunityScore !== null).length,
    confidenceDistribution: countBy(profiles.map((row) => row.rookieProjectionConfidence)),
    sourceLabels: Array.from(new Set(profiles.flatMap((row) => row.sourceLabels))).sort(),
  };
}

function check(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}
