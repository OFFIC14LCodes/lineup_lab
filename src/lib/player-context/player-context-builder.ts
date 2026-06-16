import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { matchAcquiredPlayer } from "@/lib/data-acquisition/player-identity-match";
import { loadRookieData } from "@/lib/projections/rookie-data-loader";
import { addContextAttribution, sourceLabelsFor, type PlayerContextAttributionMap } from "./player-context-attribution";
import { buildDepthChartPossibility } from "./depth-chart-possibilities";
import { deriveInjuryRisk } from "./injury-risk";
import { bmi } from "./player-context-normalization";
import type { ContextConfidence, PlayerContextProfile, PlayerContextSourceRecord } from "./player-context-types";
import { loadAllContextSources } from "./sources/local-context-source";

const OUTPUT_PATH = path.join(process.cwd(), "data", "player-context", "normalized", "player-context-profiles.json");
const PROJECTION_ARTIFACT = path.join(process.cwd(), "artifacts", "projections", "h9-comprehensive-stat-projections.json");

export type PlayerContextBuildReport = {
  generatedAt: string;
  draftRoomId: string | null;
  outputPath: string;
  sourceRows: number;
  profiles: number;
  matchedRows: number;
  unmatchedRows: number;
  ambiguousRows: number;
  conflicts: number;
  coverage: PlayerContextCoverage;
  topDataGaps: Array<{ key: string; count: number }>;
  valueIntegration: {
    contextAffectsValueWhenSourced: boolean;
    missingContextNeutral: boolean;
    adpUsedAsContextFallback: false;
  };
  safety: {
    noAi: true;
    noScraping: true;
    noPaidApi: true;
    noFabricatedContext: true;
    noAdpFallback: true;
    noDraftStateMutation: true;
    noRecommendationPersistence: true;
  };
  verdict: "passed" | "needs_source_data" | "failed";
};

export type PlayerContextCoverage = {
  playersWithDepthChartRole: number;
  playersWithFloorCeilingRoles: number;
  playersWithInjuryContext: number;
  playersWithAthleticTesting: number;
  playersWithPhysicalProfile: number;
  playersWithCoachingContext: number;
  playersWithTeamContext: number;
  byPosition: Record<string, { total: number; withAnyContext: number }>;
};

type Candidate = { playerId: string; playerName: string; position: string; team: string | null; season: number };

export function buildPlayerContext(input: { draftRoomId?: string | null; writeOutput?: boolean } = {}): { report: PlayerContextBuildReport; profiles: PlayerContextProfile[] } {
  const generatedAt = new Date().toISOString();
  const candidates = loadCandidatePlayers();
  const profiles = candidates.map(defaultProfile);
  const profileById = new Map(profiles.map((profile) => [profile.playerId, profile]));
  const sourceRows = loadAllContextSources();
  const attribution: PlayerContextAttributionMap = {};
  const conflicts: string[] = [];
  let matchedRows = 0;
  let unmatchedRows = 0;
  let ambiguousRows = 0;

  for (const row of sourceRows) {
    if (row.kind === "coaching-environment" || row.kind === "team-environment") {
      const teamMatches = profiles.filter((profile) => profile.team === row.team && profile.season === (row.season ?? profile.season));
      if (!teamMatches.length) {
        unmatchedRows += 1;
        continue;
      }
      for (const profile of teamMatches) mergeContext(profile, row, attribution, conflicts);
      matchedRows += 1;
      continue;
    }
    const match = matchAcquiredPlayer(row, candidates);
    if (!match.playerId) {
      if (match.matchStatus === "ambiguous") ambiguousRows += 1;
      else unmatchedRows += 1;
      continue;
    }
    const profile = profileById.get(match.playerId);
    if (!profile) {
      unmatchedRows += 1;
      continue;
    }
    mergeContext(profile, row, attribution, conflicts);
    matchedRows += 1;
  }

  for (const profile of profiles) finalizeProfile(profile, attribution);
  if (input.writeOutput ?? true) {
    mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, `${JSON.stringify(profiles, null, 2)}\n`);
  }
  const coverage = coverageFor(profiles);
  const report: PlayerContextBuildReport = {
    generatedAt,
    draftRoomId: input.draftRoomId ?? null,
    outputPath: OUTPUT_PATH,
    sourceRows: sourceRows.length,
    profiles: profiles.length,
    matchedRows,
    unmatchedRows,
    ambiguousRows,
    conflicts: conflicts.length,
    coverage,
    topDataGaps: topDataGaps(profiles),
    valueIntegration: {
      contextAffectsValueWhenSourced: true,
      missingContextNeutral: true,
      adpUsedAsContextFallback: false,
    },
    safety: {
      noAi: true,
      noScraping: true,
      noPaidApi: true,
      noFabricatedContext: true,
      noAdpFallback: true,
      noDraftStateMutation: true,
      noRecommendationPersistence: true,
    },
    verdict: conflicts.length || ambiguousRows ? "failed" : sourceRows.length ? "passed" : "needs_source_data",
  };
  return { report, profiles };
}

export function loadBuiltPlayerContextProfiles(filePath = OUTPUT_PATH): PlayerContextProfile[] {
  if (!existsSync(filePath)) return [];
  return JSON.parse(readFileSync(filePath, "utf8")) as PlayerContextProfile[];
}

function loadCandidatePlayers(): Candidate[] {
  if (existsSync(PROJECTION_ARTIFACT)) {
    const artifact = JSON.parse(readFileSync(PROJECTION_ARTIFACT, "utf8")) as { projections?: Array<{ playerId: string; playerName: string; position: string; team?: string | null }> };
    const rows = artifact.projections ?? [];
    if (rows.length) return rows.map((row) => ({ playerId: row.playerId, playerName: row.playerName, position: row.position, team: row.team ?? null, season: 2026 }));
  }
  const rookies = loadRookieData({ dryRun: true, useExampleWhenMissing: false }).rows;
  return rookies.map((row) => ({ playerId: row.matchedPlayerId ?? row.profile.playerId, playerName: row.profile.playerName, position: row.profile.position, team: row.profile.team, season: row.profile.season }));
}

function defaultProfile(candidate: Candidate): PlayerContextProfile {
  return {
    playerId: candidate.playerId,
    playerName: candidate.playerName,
    position: candidate.position,
    team: candidate.team,
    season: candidate.season,
    identity: { age: null, yearsExperience: null, college: null, draftYear: null, draftRound: null, draftPick: null, draftOverall: null },
    physicalProfile: { heightInches: null, weightPounds: null, bmi: null, armLengthInches: null, handSizeInches: null, wingspanInches: null },
    athleticProfile: { fortyYardDash: null, tenYardSplit: null, verticalJumpInches: null, broadJumpInches: null, threeCone: null, shuttle: null, benchPressReps: null, speedScore: null, burstScore: null, agilityScore: null },
    roleProfile: { currentRole: "unknown", floorRole: "unknown", ceilingRole: "unknown", roleConfidence: "very_low", expectedGamesActive: null, expectedGamesStarted: null, expectedSnapShare: null, expectedRouteShare: null, expectedRushShare: null, expectedTargetShare: null, expectedTackleOpportunity: null },
    depthChartProfile: { depthChartPosition: null, depthChartLabel: null, primaryCompetition: [], pathToCeiling: [], pathToFloor: [], depthChartConfidence: "very_low" },
    coachingEnvironment: { headCoach: null, offensiveCoordinator: null, defensiveCoordinator: null, schemeLabel: null, paceTendency: "unknown", passRateTendency: "unknown", rushRateTendency: "unknown", teUsageTendency: "unknown", rbTargetTendency: "unknown", idpTackleOpportunity: "unknown", confidence: "very_low" },
    injuryProfile: { gamesMissedLastSeason: null, gamesMissedLast3Seasons: null, notableInjuries: [], currentInjuryStatus: null, injuryRisk: "unknown", riskReasons: ["No sourced injury history is available."], confidence: "very_low" },
    sourceSummary: { sourceLabels: [], importedAt: null, confidence: "very_low", dataGaps: [], conflicts: [] },
  };
}

function mergeContext(profile: PlayerContextProfile, row: PlayerContextSourceRecord, attribution: PlayerContextAttributionMap, conflicts: string[]) {
  for (const [field, value] of Object.entries(row.values)) {
    if (!hasValue(value)) continue;
    const target = targetFor(profile, row.kind);
    const existing = (target as Record<string, unknown>)[field];
    if (hasValue(existing) && JSON.stringify(existing) !== JSON.stringify(value)) {
      conflicts.push(`${profile.playerId}:${field}`);
      continue;
    }
    (target as Record<string, unknown>)[field] = value;
    addContextAttribution(attribution, profile.playerId, `${row.kind}.${field}`, row.attribution);
  }
}

function targetFor(profile: PlayerContextProfile, kind: PlayerContextSourceRecord["kind"]): Record<string, unknown> {
  if (kind === "physical-profile") return profile.physicalProfile;
  if (kind === "athletic-testing") return profile.athleticProfile;
  if (kind === "depth-chart") return profile.depthChartProfile;
  if (kind === "role-notes") return profile.roleProfile;
  if (kind === "injury-history") return profile.injuryProfile;
  if (kind === "coaching-environment") return profile.coachingEnvironment;
  return profile.sourceSummary;
}

function finalizeProfile(profile: PlayerContextProfile, attribution: PlayerContextAttributionMap) {
  profile.physicalProfile.bmi = bmi(profile.physicalProfile.heightInches, profile.physicalProfile.weightPounds);
  const injury = deriveInjuryRisk({
    gamesMissedLastSeason: profile.injuryProfile.gamesMissedLastSeason,
    gamesMissedLast3Seasons: profile.injuryProfile.gamesMissedLast3Seasons,
    notableInjuries: profile.injuryProfile.notableInjuries,
    currentInjuryStatus: profile.injuryProfile.currentInjuryStatus,
  });
  profile.injuryProfile.injuryRisk = injury.injuryRisk;
  profile.injuryProfile.riskReasons = injury.riskReasons;
  profile.injuryProfile.confidence = injury.confidence;
  const depth = buildDepthChartPossibility(profile);
  profile.depthChartProfile.pathToFloor = profile.depthChartProfile.pathToFloor.length ? profile.depthChartProfile.pathToFloor : depth.pathToFloor;
  profile.depthChartProfile.pathToCeiling = profile.depthChartProfile.pathToCeiling.length ? profile.depthChartProfile.pathToCeiling : depth.pathToCeiling;
  profile.sourceSummary.sourceLabels = sourceLabelsFor(attribution, profile.playerId);
  profile.sourceSummary.importedAt = null;
  profile.sourceSummary.dataGaps = dataGapsFor(profile);
  profile.sourceSummary.confidence = confidenceFor(profile);
}

function dataGapsFor(profile: PlayerContextProfile): string[] {
  return [
    profile.physicalProfile.heightInches === null ? "physical profile" : null,
    profile.athleticProfile.fortyYardDash === null ? "athletic testing" : null,
    profile.roleProfile.currentRole === "unknown" ? "role context" : null,
    profile.depthChartProfile.depthChartPosition === null ? "depth chart context" : null,
    profile.injuryProfile.injuryRisk === "unknown" ? "injury context" : null,
    profile.coachingEnvironment.confidence === "very_low" ? "coaching environment" : null,
  ].filter((gap): gap is string => Boolean(gap));
}

function confidenceFor(profile: PlayerContextProfile): ContextConfidence {
  const sourceCount = profile.sourceSummary.sourceLabels.length;
  if (!sourceCount) return "very_low";
  if (sourceCount >= 4 && profile.sourceSummary.dataGaps.length <= 2) return "high";
  if (sourceCount >= 2) return "medium";
  return "low";
}

function coverageFor(profiles: PlayerContextProfile[]): PlayerContextCoverage {
  const byPosition: PlayerContextCoverage["byPosition"] = {};
  for (const profile of profiles) {
    byPosition[profile.position] = byPosition[profile.position] ?? { total: 0, withAnyContext: 0 };
    byPosition[profile.position].total += 1;
    if (profile.sourceSummary.sourceLabels.length) byPosition[profile.position].withAnyContext += 1;
  }
  return {
    playersWithDepthChartRole: profiles.filter((profile) => profile.roleProfile.currentRole !== "unknown" || profile.depthChartProfile.depthChartPosition !== null).length,
    playersWithFloorCeilingRoles: profiles.filter((profile) => profile.roleProfile.floorRole !== "unknown" || profile.roleProfile.ceilingRole !== "unknown").length,
    playersWithInjuryContext: profiles.filter((profile) => profile.injuryProfile.injuryRisk !== "unknown").length,
    playersWithAthleticTesting: profiles.filter((profile) => profile.athleticProfile.fortyYardDash !== null).length,
    playersWithPhysicalProfile: profiles.filter((profile) => profile.physicalProfile.heightInches !== null || profile.physicalProfile.weightPounds !== null).length,
    playersWithCoachingContext: profiles.filter((profile) => profile.coachingEnvironment.confidence !== "very_low").length,
    playersWithTeamContext: 0,
    byPosition,
  };
}

function topDataGaps(profiles: PlayerContextProfile[]) {
  const counts = profiles.flatMap((profile) => profile.sourceSummary.dataGaps).reduce((acc, gap) => {
    acc[gap] = (acc[gap] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 20).map(([key, count]) => ({ key, count }));
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  return String(value).trim() !== "" && String(value) !== "unknown";
}
