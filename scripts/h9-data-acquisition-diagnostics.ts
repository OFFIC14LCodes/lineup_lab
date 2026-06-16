import { existsSync } from "node:fs";
import path from "node:path";

import { buildRookieEnrichment } from "@/lib/data-acquisition/build-rookie-enrichment";
import { buildCollegeProspectProfile } from "@/lib/data-acquisition/college-prospect-profile";
import { loadCollegeProductionRecords } from "@/lib/data-acquisition/college-production-source";
import { loadDraftCapitalRecords } from "@/lib/data-acquisition/nfl-draft-capital-source";
import { loadRoleNotesRecords } from "@/lib/data-acquisition/role-notes-source";
import { sourceStatuses } from "@/lib/data-acquisition/source-registry";
import { arg, loadLocalEnv, writeDiagnostic } from "./h9-projection-hardening-utils";

loadLocalEnv();

const kind = arg("--kind", "data-source-readiness") ?? "data-source-readiness";
const artifact = buildArtifact(kind);
const name = diagnosticName(kind);
writeDiagnostic(name, artifact);
console.log(JSON.stringify({
  verdict: artifact.verdict,
  artifact: `artifacts/projections/${name}.json`,
  summary: artifact.summary,
}, null, 2));
if (artifact.verdict === "failed") process.exitCode = 1;

function buildArtifact(kind: string): any {
  const generatedAt = new Date().toISOString();
  const draftCapital = loadDraftCapitalRecords();
  const collegeProduction = loadCollegeProductionRecords();
  const roleNotes = loadRoleNotesRecords();
  const sources = sourceStatuses();
  const base = {
    generatedAt,
    kind,
    safety: {
      noScraping: true,
      noPaidApi: true,
      noAi: true,
      noAdpFallback: true,
      unknownFieldsRemainDataGaps: true,
    },
  };

  if (kind === "data-source-readiness") {
    const missingLocal = sources.filter((source) => source.localPath && !source.available);
    const disabledApi = sources.filter((source) => source.requiresApiKey && !source.configured);
    return {
      ...base,
      verdict: "passed",
      summary: {
        registeredSources: sources.length,
        availableSources: sources.filter((source) => source.available).length,
        missingLocalFiles: missingLocal.length,
        disabledApiSources: disabledApi.length,
      },
      sources,
      directories: [
        "data/acquisition/cache",
        "data/acquisition/raw",
        "data/acquisition/normalized",
        "data/acquisition/logs",
        "data/rookies/sources",
      ].map((dir) => ({ dir, exists: existsSync(path.join(process.cwd(), dir)) })),
    };
  }

  if (kind === "draft-capital-source") {
    return sourceArtifact(base, "passed", {
      sourceRows: draftCapital.length,
      rowsWithDraftCapital: draftCapital.filter((row) => row.nflDraftRound !== null || row.nflDraftOverall !== null).length,
      rowsWithAttribution: draftCapital.filter((row) => Boolean(row.attribution.sourceLabel)).length,
      dataGaps: gapCounts(draftCapital.flatMap((row) => row.dataGaps)),
    }, draftCapital.slice(0, 20));
  }

  if (kind === "college-production-source") {
    return sourceArtifact(base, "passed", {
      sourceRows: collegeProduction.length,
      rowsWithProductionStats: collegeProduction.filter((row) => Object.values(row.stats).some((value) => value !== null)).length,
      rowsWithAttribution: collegeProduction.filter((row) => Boolean(row.attribution.sourceLabel)).length,
      dataGaps: gapCounts(collegeProduction.flatMap((row) => row.dataGaps)),
    }, collegeProduction.slice(0, 20));
  }

  if (kind === "role-notes-source") {
    return sourceArtifact(base, "passed", {
      sourceRows: roleNotes.length,
      rowsWithKnownRole: roleNotes.filter((row) => row.landingSpotRole !== "unknown").length,
      rowsWithOpportunityNotes: roleNotes.filter((row) => row.opportunityNotes.length > 0).length,
      dataGaps: gapCounts(roleNotes.flatMap((row) => row.dataGaps)),
    }, roleNotes.slice(0, 20));
  }

  if (kind === "rookie-enrichment-build") {
    const report = buildRookieEnrichment({ writeFiles: false });
    return { ...base, ...report, dryRun: true, summary: report.counts };
  }

  if (kind === "college-prospect-profile") {
    const draftByKey = new Map(draftCapital.map((row) => [key(row.playerId, row.playerName, row.position), row]));
    const collegeByKey = new Map(collegeProduction.map((row) => [key(row.playerId, row.playerName, row.position), row]));
    const roleByKey = new Map(roleNotes.map((row) => [key(row.playerId, row.playerName, row.position), row]));
    const keys = Array.from(new Set([...draftByKey.keys(), ...collegeByKey.keys(), ...roleByKey.keys()])).slice(0, 25);
    const profiles = keys.map((profileKey) => buildCollegeProspectProfile({
      draftCapital: draftByKey.get(profileKey) ?? null,
      collegeProduction: collegeByKey.get(profileKey) ?? null,
      roleNotes: roleByKey.get(profileKey) ?? null,
    }));
    return {
      ...base,
      verdict: "passed",
      summary: {
        profileCount: profiles.length,
        profilesWithDraftCapital: profiles.filter((row) => row.draftCapitalScore !== null).length,
        profilesWithCollegeProduction: profiles.filter((row) => row.collegeProductionScore !== null).length,
        profilesWithRole: profiles.filter((row) => row.landingSpotRole !== "unknown").length,
      },
      profiles,
      note: profiles.length ? "Profiles are built from local source records only." : "No local source records are available yet; profile builder is source-ready.",
    };
  }

  return {
    ...base,
    verdict: "failed",
    summary: { error: `Unknown diagnostic kind ${kind}` },
  };
}

function diagnosticName(kind: string): string {
  return `h9-${kind}`;
}

function sourceArtifact(base: any, verdict: "passed" | "failed", summary: Record<string, unknown>, samples: unknown[]) {
  return {
    ...base,
    verdict,
    summary,
    samples,
  };
}

function gapCounts(values: string[]) {
  return Object.entries(values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count }));
}

function key(playerId: string | null, playerName: string, position: string) {
  return `${playerId ?? ""}|${playerName.toLowerCase()}|${position.toUpperCase()}`;
}
