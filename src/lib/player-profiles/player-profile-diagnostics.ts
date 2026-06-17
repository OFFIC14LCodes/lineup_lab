import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { HistoricalPlayerProfileSnapshot, PlayerProfilesBuildResult } from "./player-profile-types";
import { DEFAULT_PLAYER_PROFILES_SHARDED_DIR, writeShardedPlayerProfileArtifacts } from "./player-profile-shards";

export const PLAYER_PROFILE_ARTIFACTS = {
  profiles: "player-profiles.json",
  summary: "player-profiles-summary.md",
  sample: "player-profiles-sample.md",
  diagnostics: "player-profiles-diagnostics.json",
} as const;

export function writePlayerProfileArtifacts(result: PlayerProfilesBuildResult, outputDir = path.join(process.cwd(), "artifacts", "projections")) {
  mkdirSync(outputDir, { recursive: true });
  const profilesJson = `${JSON.stringify(result.profiles, null, 2)}\n`;
  result.diagnostics.artifactSizeBytes = Buffer.byteLength(profilesJson, "utf8");
  writeFileSync(path.join(outputDir, PLAYER_PROFILE_ARTIFACTS.profiles), profilesJson, "utf8");
  const shardedManifest = writeShardedPlayerProfileArtifacts({
    profiles: result.profiles,
    generatedAt: result.generatedAt,
    singleArtifactSizeBytes: result.diagnostics.artifactSizeBytes,
    outputDir: path.join(process.cwd(), DEFAULT_PLAYER_PROFILES_SHARDED_DIR),
  });
  writeFileSync(path.join(outputDir, PLAYER_PROFILE_ARTIFACTS.diagnostics), `${JSON.stringify(result.diagnostics, null, 2)}\n`, "utf8");
  writeFileSync(path.join(outputDir, PLAYER_PROFILE_ARTIFACTS.summary), renderSummary(result), "utf8");
  writeFileSync(path.join(outputDir, PLAYER_PROFILE_ARTIFACTS.sample), renderSample(result.profiles), "utf8");
  writeFileSync(path.join(outputDir, "player-profiles-shards-diagnostics.json"), `${JSON.stringify(shardedManifest, null, 2)}\n`, "utf8");
  return shardedManifest;
}

export function renderSummary(result: PlayerProfilesBuildResult): string {
  const d = result.diagnostics;
  return [
    "# Historical Player Profiles",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    "Dry-run only. No Supabase writes were performed.",
    "",
    `Profiles built: ${d.totalProfilesBuilt}`,
    `Profiles with weekly stats: ${d.profilesWithWeeklyStats}`,
    `Profiles without weekly stats: ${d.profilesWithoutWeeklyStats}`,
    `Profiles with multi-season stats: ${d.profilesWithMultiSeasonData ?? 0}`,
    `Profiles with one stat season: ${d.profilesWithOnlyOneSeason ?? 0}`,
    `Profiles with IDP stats: ${d.profilesWithIdpStats}`,
    `Profiles with warnings: ${d.profilesWithWarnings}`,
    `Profiles with usage summary: ${d.profilesWithUsageSummary ?? 0}`,
    `Profiles with offensive usage: ${d.profilesWithOffensiveUsage ?? 0}`,
    `Profiles with IDP usage: ${d.profilesWithIdpUsage ?? 0}`,
    `Profiles with snap data: ${d.profilesWithSnapData ?? 0}`,
    `Profiles missing snap data: ${d.profilesMissingSnapData ?? 0}`,
    `Profiles with high-value usage: ${d.profilesWithHighValueUsage ?? 0}`,
    `Profiles with red-zone usage: ${d.profilesWithRedZoneUsage ?? 0}`,
    `Profiles with end-zone targets: ${d.profilesWithEndZoneTargets ?? 0}`,
    `Profiles with goal-line carries: ${d.profilesWithGoalLineCarries ?? 0}`,
    `Profiles with deep targets: ${d.profilesWithDeepTargets ?? 0}`,
    `Profiles with role label: ${d.profilesWithRoleLabel ?? 0}`,
    `Artifact size: ${d.artifactSizeBytes ?? "unknown"} bytes`,
    "",
    "## Source Files",
    `- Player stats: ${d.sourceFilesUsed?.playerStats ?? "unknown"}`,
    `- Rosters: ${d.sourceFilesUsed?.rosters ?? "unknown"}`,
    `- Weekly stat rows: ${d.sourceRows?.weeklyStats ?? 0}`,
    `- Roster rows: ${d.sourceRows?.rosters ?? 0}`,
    `- Seasons detected: ${d.seasonsIncluded?.join(", ") || "none"}`,
    `- Min/max season: ${d.minSeason ?? "n/a"} / ${d.maxSeason ?? "n/a"}`,
    "",
    "## Coverage",
    `- Career from rookie: ${d.profilesWithFullRookieToCurrentCoverage ?? 0}`,
    `- Partial/recent coverage: ${d.profilesWithPartialCoverage ?? 0}`,
    renderCounts(d.profilesByCoverageLabel ?? {}),
    "",
    "## Usage Sources",
    `- Used: ${d.usageSourceFiles?.used.join(", ") || "none"}`,
    `- Missing: ${d.usageSourceFiles?.missing.join(", ") || "none"}`,
    `- Snap count source: ${d.usageSourceFiles?.snapCounts?.exists ? "found" : "missing"}`,
    `- Snap rows loaded: ${d.usageSourceFiles?.snapCounts?.rowCount ?? 0}`,
    `- Snap seasons: ${d.usageSourceFiles?.snapCounts?.seasons.join(", ") || "none"}`,
    `- Snap missing columns: ${d.usageSourceFiles?.snapCounts?.missingColumns.join(", ") || "none"}`,
    `- Snap rows matched/unmatched: ${d.usageSourceFiles?.snapCounts?.matchedRows ?? 0} / ${d.usageSourceFiles?.snapCounts?.unmatchedRows ?? 0}`,
    `- Participation source: ${d.usageSourceFiles?.participation?.exists ? "found" : "missing"}`,
    `- Participation rows loaded: ${d.usageSourceFiles?.participation?.rowCount ?? 0}`,
    `- Participation seasons: ${d.usageSourceFiles?.participation?.seasons.join(", ") || "none"}`,
    `- Participation missing columns: ${d.usageSourceFiles?.participation?.missingColumns.join(", ") || "none"}`,
    `- Participation rows matched/unmatched: ${d.usageSourceFiles?.participation?.matchedRows ?? 0} / ${d.usageSourceFiles?.participation?.unmatchedRows ?? 0}`,
    `- Play-by-play source: ${d.usageSourceFiles?.pbp?.exists ? "found" : "missing"}`,
    `- Play-by-play selected file: ${d.usageSourceFiles?.pbp?.selectedFile ?? "none"}`,
    `- Play-by-play candidates checked: ${d.usageSourceFiles?.pbp?.candidateFiles.join(", ") || "none"}`,
    `- Play-by-play rows loaded: ${d.usageSourceFiles?.pbp?.rowCount ?? 0}`,
    `- Play-by-play seasons: ${d.usageSourceFiles?.pbp?.seasons.join(", ") || "none"}`,
    `- Play-by-play missing columns: ${d.usageSourceFiles?.pbp?.missingColumns.join(", ") || "none"}`,
    `- Play-by-play derived player-weeks: ${d.usageSourceFiles?.pbp?.derivedPlayerWeekRows ?? 0}`,
    `- Play-by-play rows matched/unmatched: ${d.usageSourceFiles?.pbp?.matchedRows ?? 0} / ${d.usageSourceFiles?.pbp?.unmatchedRows ?? 0}`,
    "",
    "## Role Labels By Position",
    ...Object.entries(d.roleLabelsByPosition ?? {}).flatMap(([position, counts]) => [
      `### ${position}`,
      renderCounts(counts),
      "",
    ]),
    "## Scoring Profile",
    `- ${d.scoringProfileUsed.label} (${d.scoringProfileUsed.version})`,
    ...d.scoringProfileUsed.notes.map((note) => `- ${note}`),
    "",
    "## Profiles By Position",
    renderCounts(d.profilesByPosition),
    "",
    "## Profiles By Match Confidence",
    renderCounts(d.profilesByMatchConfidence),
    "",
    "## Limitations",
    ...d.limitations.map((item) => `- ${item}`),
    "",
  ].join("\n");
}

export function renderSample(profiles: HistoricalPlayerProfileSnapshot[], limit = 10): string {
  const rows = profiles
    .filter((profile) => profile.weeklyStats.length > 0)
    .sort((a, b) => (b.careerSummary?.careerTotalPoints ?? 0) - (a.careerSummary?.careerTotalPoints ?? 0))
    .slice(0, limit);
  return [
    "# Historical Player Profile Samples",
    "",
    ...rows.flatMap((profile) => [
      `## ${profile.bio.name} (${profile.bio.position}, ${profile.bio.team ?? "FA"})`,
      "",
      `- GSIS: ${profile.identity.gsisId}`,
      `- Sleeper: ${profile.identity.sleeperId ?? "none"}`,
      `- Match confidence: ${profile.identity.matchConfidence}`,
      `- Coverage: ${profile.careerMetadata?.coverageLabel ?? "unknown"} (${profile.careerMetadata?.firstStatSeason ?? "n/a"}-${profile.careerMetadata?.latestStatSeason ?? "n/a"})`,
      `- Trend: ${profile.trendMetrics?.trendLabel ?? "unknown"}`,
      `- Career games: ${profile.careerSummary?.careerGames ?? profile.seasonSummaries[0]?.gamesPlayed ?? 0}`,
      `- Career total points: ${profile.careerSummary?.careerTotalPoints ?? profile.seasonSummaries[0]?.totalFantasyPoints ?? 0}`,
      `- Career PPG: ${profile.careerSummary?.careerPointsPerGame ?? profile.seasonSummaries[0]?.pointsPerGame ?? "n/a"}`,
      `- Career floor/median/ceiling: ${profile.careerSummary?.careerFloor ?? "n/a"} / ${profile.careerSummary?.careerMedian ?? "n/a"} / ${profile.careerSummary?.careerCeiling ?? "n/a"}`,
      `- Latest season: ${profile.careerSummary?.mostRecentSeason?.season ?? "n/a"} (${profile.careerSummary?.mostRecentSeason?.totalFantasyPoints ?? "n/a"} pts)`,
      `- Role: ${profile.roleMetrics?.roleLabel ?? "n/a"} (${profile.roleMetrics?.roleConfidence ?? "n/a"} confidence)`,
      `- Usage: ${profile.usageSummary?.opportunitiesPerGame ?? "n/a"} opp/g, ${profile.usageSummary?.touchesPerGame ?? "n/a"} touches/g, trend ${profile.usageSummary?.trendLabel ?? "n/a"}`,
      `- Snap share: offense ${formatPercent(profile.usageSummary?.offensiveSnapShare ?? null)}, defense ${formatPercent(profile.usageSummary?.defensiveSnapShare ?? null)}, ST ${formatPercent(profile.usageSummary?.specialTeamsSnapShare ?? null)}`,
      `- Role modifiers: ${profile.roleMetrics?.roleModifiers.join(", ") || "none"}`,
      `- High-value usage: ${profile.highValueUsageSummary?.highValueTouchesPerGame ?? "n/a"} HV touches/g, ${profile.highValueUsageSummary?.highValueTargetsPerGame ?? "n/a"} HV targets/g`,
      `- High-value modifiers: ${profile.highValueUsageSummary?.modifiers.join(", ") || "none"}`,
      `- Warnings: ${profile.profileWarnings.join(", ") || "none"}`,
      "",
    ]),
  ].join("\n");
}

function renderCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries.length ? entries.map(([key, value]) => `- ${key}: ${value}`).join("\n") : "- none";
}

function formatPercent(value: number | null) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "n/a";
}
