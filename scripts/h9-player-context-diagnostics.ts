import { existsSync } from "node:fs";
import path from "node:path";

import { buildPlayerContext, loadBuiltPlayerContextProfiles } from "@/lib/player-context/player-context-builder";
import { buildDepthChartPossibility } from "@/lib/player-context/depth-chart-possibilities";
import { CONTEXT_SOURCE_FILES, contextSourcePath, loadContextSource } from "@/lib/player-context/sources/local-context-source";
import type { PlayerContextSourceKind } from "@/lib/player-context/player-context-types";
import { arg, loadLocalEnv, writeDiagnostic } from "./h9-projection-hardening-utils";

loadLocalEnv();

const kind = arg("--kind", "source-readiness") ?? "source-readiness";
const draftRoomId = arg("--draft-room-id");
const artifact = artifactFor(kind, draftRoomId);
const name = diagnosticName(kind);
writeDiagnostic(name, artifact);
console.log(JSON.stringify({
  verdict: artifact.verdict,
  summary: artifact.summary,
  artifact: `artifacts/projections/${name}.json`,
}, null, 2));
if (artifact.verdict === "failed") process.exitCode = 1;

function artifactFor(kind: string, draftRoomId: string | null): any {
  if (kind === "source-readiness") {
    const sourceFiles = sourceKinds().map((sourceKind) => {
      const filePath = contextSourcePath(sourceKind);
      const rows = loadContextSource(sourceKind);
      return { kind: sourceKind, filePath, present: existsSync(filePath), rows: rows.length, headerOnly: rows.length === 0 };
    });
    return {
      generatedAt: new Date().toISOString(),
      verdict: sourceFiles.every((file) => file.present) ? "needs_source_data" : "failed",
      summary: {
        filesPresent: sourceFiles.filter((file) => file.present).length,
        sourceFiles: sourceFiles.length,
        sourceRows: sourceFiles.reduce((sum, file) => sum + file.rows, 0),
        headerOnlyFiles: sourceFiles.filter((file) => file.headerOnly).length,
      },
      sourceFiles,
      safety: safety(),
    };
  }

  const { report, profiles } = buildPlayerContext({ draftRoomId, writeOutput: kind === "build" });
  if (kind === "build") return { ...report, summary: { profiles: report.profiles, sourceRows: report.sourceRows, coverage: report.coverage } };
  if (kind === "depth-chart-context") {
    const possibilities = profiles.slice(0, 50).map(buildDepthChartPossibility);
    return {
      generatedAt: new Date().toISOString(),
      verdict: report.verdict,
      summary: {
        playersWithDepthChartRole: report.coverage.playersWithDepthChartRole,
        playersWithFloorCeilingRoles: report.coverage.playersWithFloorCeilingRoles,
      },
      possibilities,
      topDataGaps: report.topDataGaps,
      safety: safety(),
    };
  }
  if (kind === "coaching-context") return contextCoverageArtifact(report, "playersWithCoachingContext", "coaching environment");
  if (kind === "injury-context") return contextCoverageArtifact(report, "playersWithInjuryContext", "injury context");
  if (kind === "physical-athletic-context") {
    return {
      generatedAt: new Date().toISOString(),
      verdict: report.verdict,
      summary: {
        playersWithPhysicalProfile: report.coverage.playersWithPhysicalProfile,
        playersWithAthleticTesting: report.coverage.playersWithAthleticTesting,
      },
      topDataGaps: report.topDataGaps,
      safety: safety(),
    };
  }
  if (kind === "context-value-impact") {
    return {
      generatedAt: new Date().toISOString(),
      draftRoomId,
      verdict: report.verdict,
      summary: report.valueIntegration,
      coverage: report.coverage,
      note: "Context affects value only when sourced. Empty context remains neutral and visible as data gaps.",
      safety: safety(),
    };
  }
  if (kind === "player-context-display") {
    const built = loadBuiltPlayerContextProfiles();
    const displayProfiles = (built.length ? built : profiles).slice(0, 25).map((profile) => ({
      playerId: profile.playerId,
      playerName: profile.playerName,
      roleContext: profile.roleProfile.currentRole,
      depthChartScenario: {
        floor: profile.roleProfile.floorRole,
        ceiling: profile.roleProfile.ceilingRole,
        pathToCeiling: profile.depthChartProfile.pathToCeiling,
      },
      injuryContext: profile.injuryProfile.injuryRisk,
      physicalProfileAvailable: profile.physicalProfile.heightInches !== null || profile.physicalProfile.weightPounds !== null,
      athleticProfileAvailable: profile.athleticProfile.fortyYardDash !== null,
      sourceLabels: profile.sourceSummary.sourceLabels,
      dataGaps: profile.sourceSummary.dataGaps,
    }));
    return {
      generatedAt: new Date().toISOString(),
      draftRoomId,
      verdict: report.verdict,
      summary: { displayProfiles: displayProfiles.length, contextSectionReady: true },
      displayProfiles,
      safety: safety(),
    };
  }
  return { generatedAt: new Date().toISOString(), verdict: "failed", summary: { error: `unknown diagnostic ${kind}` } };
}

function contextCoverageArtifact(report: ReturnType<typeof buildPlayerContext>["report"], field: keyof ReturnType<typeof buildPlayerContext>["report"]["coverage"], gap: string) {
  return {
    generatedAt: new Date().toISOString(),
    verdict: report.verdict,
    summary: { [field]: report.coverage[field] },
    topDataGaps: report.topDataGaps.filter((row) => row.key.includes(gap)),
    safety: safety(),
  };
}

function sourceKinds(): PlayerContextSourceKind[] {
  return Object.keys(CONTEXT_SOURCE_FILES) as PlayerContextSourceKind[];
}

function diagnosticName(kind: string): string {
  if (kind === "source-readiness") return "h9-player-context-source-readiness";
  if (kind === "build") return "h9-player-context-build";
  if (kind === "player-context-display") return "h11-player-context-display";
  return `h9-${kind}`;
}

function safety() {
  return {
    noAi: true,
    noScraping: true,
    noPaidApi: true,
    noFabricatedContext: true,
    noAdpFallback: true,
    noDraftStateMutation: true,
    noRecommendationPersistence: true,
  };
}
