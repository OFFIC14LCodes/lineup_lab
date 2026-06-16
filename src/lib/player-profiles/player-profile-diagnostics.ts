import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { HistoricalPlayerProfileSnapshot, PlayerProfilesBuildResult } from "./player-profile-types";

export const PLAYER_PROFILE_ARTIFACTS = {
  profiles: "player-profiles.json",
  summary: "player-profiles-summary.md",
  sample: "player-profiles-sample.md",
  diagnostics: "player-profiles-diagnostics.json",
} as const;

export function writePlayerProfileArtifacts(result: PlayerProfilesBuildResult, outputDir = path.join(process.cwd(), "artifacts", "projections")) {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, PLAYER_PROFILE_ARTIFACTS.profiles), `${JSON.stringify(result.profiles, null, 2)}\n`, "utf8");
  writeFileSync(path.join(outputDir, PLAYER_PROFILE_ARTIFACTS.diagnostics), `${JSON.stringify(result.diagnostics, null, 2)}\n`, "utf8");
  writeFileSync(path.join(outputDir, PLAYER_PROFILE_ARTIFACTS.summary), renderSummary(result), "utf8");
  writeFileSync(path.join(outputDir, PLAYER_PROFILE_ARTIFACTS.sample), renderSample(result.profiles), "utf8");
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
    `Profiles with IDP stats: ${d.profilesWithIdpStats}`,
    `Profiles with warnings: ${d.profilesWithWarnings}`,
    "",
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
    .sort((a, b) => (b.seasonSummaries[0]?.totalFantasyPoints ?? 0) - (a.seasonSummaries[0]?.totalFantasyPoints ?? 0))
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
      `- Games: ${profile.seasonSummaries[0]?.gamesPlayed ?? 0}`,
      `- Total points: ${profile.seasonSummaries[0]?.totalFantasyPoints ?? 0}`,
      `- PPG: ${profile.seasonSummaries[0]?.pointsPerGame ?? "n/a"}`,
      `- Floor/median/ceiling: ${profile.consistencyMetrics.floorPercentile20 ?? "n/a"} / ${profile.consistencyMetrics.median ?? "n/a"} / ${profile.consistencyMetrics.ceilingPercentile90 ?? "n/a"}`,
      `- Warnings: ${profile.profileWarnings.join(", ") || "none"}`,
      "",
    ]),
  ].join("\n");
}

function renderCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries.length ? entries.map(([key, value]) => `- ${key}: ${value}`).join("\n") : "- none";
}
