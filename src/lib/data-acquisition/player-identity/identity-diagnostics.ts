import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { readLocalRows } from "@/lib/data-acquisition/local-source-utils";
import { readNflverseCsv, normalizeNflversePlayer, normalizeNflverseRoster, normalizeNflverseWeeklyStat, isFantasyRelevantNflversePosition } from "@/lib/data-acquisition/nflverse";
import { isSleeperFantasyRelevant, loadSleeperPlayers, normalizeSleeperPlayers } from "@/lib/data-acquisition/sleeper";

import { loadIdentityManualOverrides } from "./identity-manual-overrides";
import { makeIdentityRecord, mergeIdentityRecords } from "./identity-normalization";
import { matchPlayerIdentities } from "./identity-matcher";
import type { IdentityMatchConfidence, PlayerIdentityMatch, PlayerIdentityRecord } from "./identity-match-types";

export type PlayerIdentityDiagnosticsReport = {
  generatedAt: string;
  dryRun: true;
  sources: {
    blackbirdContextProfiles: { path: string; exists: boolean; rows: number };
    rookieData: { path: string; exists: boolean; rows: number };
    sleeperExport: { path: string; exists: boolean; rawRows: number; normalizedRows: number };
    sleeperRepairDiagnostic: { path: string; exists: boolean; rows: number };
    manualOverrides: { path: string; exists: boolean; rows: number; approvedRows: number; skippedRows: number; missingColumns: string[]; issues: string[] };
    nflversePlayers: { rows: number };
    nflverseRosters: { rows: number };
    nflversePlayerStats: { rows: number };
  };
  counts: {
    totalBlackbirdSleeperPlayersConsidered: number;
    totalNflversePlayersConsidered: number;
    totalSleeperPlayersLoaded: number;
    activeSleeperPlayers: number;
    fantasyRelevantSleeperPlayers: number;
    activeFantasyRelevantSleeperPlayers: number;
    manualOverrideMatches: number;
    manualOverrideConflicts: number;
    exactIdMatches: number;
    exactExternalIdMatches: number;
    strongNamePositionTeamMatches: number;
    namePositionTeamMatches: number;
    mediumMatches: number;
    weakMatches: number;
    unmatchedBlackbirdSleeperPlayers: number;
    activeFantasyRelevantUnmatchedPlayers: number;
    inactiveRetiredUnmatchedPlayers: number;
    unmatchedNflverseFantasyRelevantPlayers: number;
    conflictsDuplicateCandidates: number;
    activeFantasyRelevantConflicts: number;
  };
  confidenceDistribution: Record<IdentityMatchConfidence, number>;
  examples: Record<IdentityMatchConfidence, MatchExample[]>;
  unmatchedNflverseExamples: Array<{
    playerId: string;
    playerName: string;
    position: string | null;
    team: string | null;
    ids: PlayerIdentityRecord["ids"];
  }>;
  topUnresolvedActiveFantasyRelevant: MatchExample[];
  topConflicts: MatchExample[];
  limitations: string[];
  verdict: "passed" | "blackbird_source_missing" | "needs_review";
};

export type MatchExample = {
  sourcePlayerId: string;
  sourcePlayerName: string;
  sourcePosition: string | null;
  sourceTeam: string | null;
  sourceStatus: string | null;
  sourceActive: boolean | null;
  sourceSearchRank: number | null;
  sourceYearsExperience: number | null;
  sourceCollege: string | null;
  sourceAge: number | null;
  sourceBirthDate: string | null;
  sourceHeight: number | null;
  sourceWeight: number | null;
  matchedPlayerId: string | null;
  matchedPlayerName: string | null;
  confidence: IdentityMatchConfidence;
  score: number;
  matchReasons: string[];
  conflictReasons: string[];
  candidateCount: number;
  preservedIds: PlayerIdentityRecord["ids"];
  candidateExamples: PlayerIdentityMatch["candidateExamples"];
};

export function buildPlayerIdentityDiagnostics(projectRoot = process.cwd()): PlayerIdentityDiagnosticsReport {
  const blackbirdContextPath = path.join(projectRoot, "data", "player-context", "normalized", "player-context-profiles.json");
  const rookiePath = path.join(projectRoot, "data", "rookies", "rookie-data.csv");
  const sleeperPath = path.join(projectRoot, "data", "sleeper", "raw", "players-nfl.json");
  const repairPath = path.join(projectRoot, "data", "diagnostic", "repair-sleeper-player-identities-dry-run.json");

  const blackbirdRecords = loadBlackbirdIdentityRecords({ blackbirdContextPath, rookiePath, sleeperPath, repairPath });
  const nflverseRecords = loadNflverseIdentityRecords();
  const manualOverrides = loadIdentityManualOverrides(projectRoot);
  const matches = matchPlayerIdentities(blackbirdRecords.records, nflverseRecords.records, { manualOverrides: manualOverrides.approved });
  const matchedNflverseIds = new Set(matches.map((match) => match.matchedPlayer?.playerId).filter((id): id is string => Boolean(id)));
  const unmatchedNflverse = nflverseRecords.records.filter((record) => !matchedNflverseIds.has(record.playerId));

  const confidenceDistribution = countMatches(matches);
  const limitations = buildLimitations(blackbirdRecords, matches);
  const conflicts = confidenceDistribution.conflict ?? 0;
  const unmatched = confidenceDistribution.unmatched ?? 0;
  const activeFantasyRelevantUnmatched = matches.filter((match) => match.confidence === "unmatched" && isActiveFantasyRelevantSource(match.sourcePlayer));
  const inactiveRetiredUnmatched = matches.filter((match) => match.confidence === "unmatched" && !isActiveFantasyRelevantSource(match.sourcePlayer));
  const activeFantasyRelevantConflicts = matches.filter((match) => match.confidence === "conflict" && isActiveFantasyRelevantSource(match.sourcePlayer));

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    sources: {
      blackbirdContextProfiles: {
        path: blackbirdContextPath,
        exists: existsSync(blackbirdContextPath),
        rows: blackbirdRecords.sourceRows.blackbirdContextProfiles,
      },
      rookieData: {
        path: rookiePath,
        exists: existsSync(rookiePath),
        rows: blackbirdRecords.sourceRows.rookieData,
      },
      sleeperExport: {
        path: sleeperPath,
        exists: existsSync(sleeperPath),
        rawRows: blackbirdRecords.sourceRows.sleeperExportRaw,
        normalizedRows: blackbirdRecords.sourceRows.sleeperExportNormalized,
      },
      sleeperRepairDiagnostic: {
        path: repairPath,
        exists: existsSync(repairPath),
        rows: blackbirdRecords.sourceRows.sleeperRepairDiagnostic,
      },
      manualOverrides: {
        path: manualOverrides.path,
        exists: manualOverrides.exists,
        rows: manualOverrides.rows,
        approvedRows: manualOverrides.approvedRows,
        skippedRows: manualOverrides.skippedRows,
        missingColumns: manualOverrides.missingColumns,
        issues: manualOverrides.issues,
      },
      nflversePlayers: { rows: nflverseRecords.sourceRows.players },
      nflverseRosters: { rows: nflverseRecords.sourceRows.rosters },
      nflversePlayerStats: { rows: nflverseRecords.sourceRows.playerStats },
    },
    counts: {
      totalBlackbirdSleeperPlayersConsidered: blackbirdRecords.records.length,
      totalNflversePlayersConsidered: nflverseRecords.records.length,
      totalSleeperPlayersLoaded: blackbirdRecords.sleeperStats.total,
      activeSleeperPlayers: blackbirdRecords.sleeperStats.active,
      fantasyRelevantSleeperPlayers: blackbirdRecords.sleeperStats.fantasyRelevant,
      activeFantasyRelevantSleeperPlayers: blackbirdRecords.sleeperStats.activeFantasyRelevant,
      manualOverrideMatches: confidenceDistribution.manual_override ?? 0,
      manualOverrideConflicts: matches.filter((match) => match.confidence === "conflict" && match.conflictReasons.some((reason) => reason.includes("manual override"))).length,
      exactIdMatches: confidenceDistribution.exact_id ?? 0,
      exactExternalIdMatches: matches.filter((match) => match.confidence === "exact_id").length,
      strongNamePositionTeamMatches: matches.filter((match) => match.confidence === "strong" && match.matchReasons.includes("team match")).length,
      namePositionTeamMatches: matches.filter((match) => match.matchReasons.includes("normalized full name match") && match.matchReasons.includes("position match") && match.matchReasons.includes("team match")).length,
      mediumMatches: confidenceDistribution.medium ?? 0,
      weakMatches: confidenceDistribution.weak ?? 0,
      unmatchedBlackbirdSleeperPlayers: unmatched,
      activeFantasyRelevantUnmatchedPlayers: activeFantasyRelevantUnmatched.length,
      inactiveRetiredUnmatchedPlayers: inactiveRetiredUnmatched.length,
      unmatchedNflverseFantasyRelevantPlayers: unmatchedNflverse.length,
      conflictsDuplicateCandidates: conflicts,
      activeFantasyRelevantConflicts: activeFantasyRelevantConflicts.length,
    },
    confidenceDistribution,
    examples: {
      manual_override: examplesFor(matches, "manual_override"),
      exact_id: examplesFor(matches, "exact_id"),
      strong: examplesFor(matches, "strong"),
      medium: examplesFor(matches, "medium"),
      weak: examplesFor(matches, "weak"),
      unmatched: examplesFor(matches, "unmatched"),
      conflict: examplesFor(matches, "conflict"),
    },
    unmatchedNflverseExamples: unmatchedNflverse.slice(0, 20).map((record) => ({
      playerId: record.playerId,
      playerName: record.playerName,
      position: record.position,
      team: record.team,
      ids: record.ids,
    })),
    topUnresolvedActiveFantasyRelevant: activeFantasyRelevantUnmatched.slice(0, 50).map(matchExample),
    topConflicts: activeFantasyRelevantConflicts.slice(0, 50).map(matchExample),
    limitations,
    verdict: blackbirdRecords.records.length === 0 ? "blackbird_source_missing" : conflicts > 0 || unmatched > 0 ? "needs_review" : "passed",
  };
}

function loadBlackbirdIdentityRecords(input: { blackbirdContextPath: string; rookiePath: string; sleeperPath: string; repairPath: string }) {
  const byKey = new Map<string, PlayerIdentityRecord>();
  const sourceRows = {
    blackbirdContextProfiles: 0,
    rookieData: 0,
    sleeperExportRaw: 0,
    sleeperExportNormalized: 0,
    sleeperRepairDiagnostic: 0,
  };
  const sleeperStats = {
    total: 0,
    active: 0,
    fantasyRelevant: 0,
    activeFantasyRelevant: 0,
  };

  if (existsSync(input.blackbirdContextPath)) {
    const rows = JSON.parse(readFileSync(input.blackbirdContextPath, "utf8")) as Array<Record<string, unknown>>;
    sourceRows.blackbirdContextProfiles = rows.length;
    for (const row of rows) {
      const identity = objectValue(row.identity);
      const physical = objectValue(row.physicalProfile);
      addRecord(byKey, makeIdentityRecord({
        source: "blackbird_context",
        playerId: stringValue(row.playerId),
        playerName: stringValue(row.playerName),
        position: stringValue(row.position),
        team: stringValue(row.team),
        rookieSeason: identity?.rookieYear ?? identity?.draftYear,
        height: physical?.heightInches,
        weight: physical?.weightPounds,
        age: identity?.age,
        yearsExperience: identity?.yearsExperience,
        college: identity?.college,
        ids: { blackbirdPlayerId: stringValue(row.playerId) },
        sourceRefs: ["data/player-context/normalized/player-context-profiles.json"],
      }));
    }
  }

  if (existsSync(input.rookiePath)) {
    const rows = readLocalRows(input.rookiePath);
    sourceRows.rookieData = rows.length;
    for (const row of rows) {
      addRecord(byKey, makeIdentityRecord({
        source: "blackbird_rookie",
        playerId: stringValue(row.playerId),
        playerName: stringValue(row.playerName),
        position: stringValue(row.position),
        team: stringValue(row.team),
        rookieSeason: row.rookieYear,
        height: row.height,
        weight: row.weight,
        age: row.age,
        yearsExperience: row.yearsExperience,
        college: row.college,
        ids: { blackbirdPlayerId: stringValue(row.playerId) },
        sourceRefs: ["data/rookies/rookie-data.csv"],
      }));
    }
  }

  const sleeperLoad = loadSleeperPlayers(input.sleeperPath);
  sourceRows.sleeperExportRaw = sleeperLoad.rawCount;
  if (sleeperLoad.exists) {
    const sleeperPlayers = normalizeSleeperPlayers(sleeperLoad.players);
    sourceRows.sleeperExportNormalized = sleeperPlayers.length;
    sleeperStats.total = sleeperPlayers.length;
    sleeperStats.active = sleeperPlayers.filter((player) => player.active).length;
    sleeperStats.fantasyRelevant = sleeperPlayers.filter(isSleeperFantasyRelevant).length;
    sleeperStats.activeFantasyRelevant = sleeperPlayers.filter((player) => player.active && isSleeperFantasyRelevant(player)).length;
    for (const player of sleeperPlayers.filter(isSleeperFantasyRelevant)) {
      addRecord(byKey, makeIdentityRecord({
        source: "sleeper_export",
        playerId: player.sleeperId,
        playerName: player.playerName,
        position: player.position,
        team: player.team,
        birthDate: player.birthDate,
        height: player.height,
        weight: player.weight,
        age: player.age,
        yearsExperience: player.yearsExperience,
        college: player.college,
        active: player.active,
        status: player.status,
        searchRank: player.searchRank,
        ids: {
          sleeperId: player.sleeperId,
          gsisId: player.externalIds.gsis_id ?? null,
          espnId: player.externalIds.espn_id ?? null,
          pfrId: player.externalIds.pfr_id ?? null,
          nflId: player.externalIds.nfl_id ?? null,
          smartId: player.externalIds.smart_id ?? null,
        },
        externalIds: player.externalIds,
        sourceRefs: ["data/sleeper/raw/players-nfl.json"],
      }));
    }
  }

  if (existsSync(input.repairPath)) {
    const report = JSON.parse(readFileSync(input.repairPath, "utf8")) as { decisions?: Array<Record<string, unknown>> };
    const decisions = report.decisions ?? [];
    sourceRows.sleeperRepairDiagnostic = decisions.length;
    for (const decision of decisions) {
      addRecord(byKey, makeIdentityRecord({
        source: "sleeper_repair_diagnostic",
        playerId: stringValue(decision.canonicalPlayerId),
        playerName: stringValue(decision.canonicalName),
        position: stringValue(decision.nflversePosition),
        team: stringValue(decision.nflverseTeam),
        ids: {
          blackbirdPlayerId: stringValue(decision.canonicalPlayerId),
          sleeperId: stringValue(decision.canonicalSleeperId),
          gsisId: stringValue(decision.gsisId),
        },
        sourceRefs: ["data/diagnostic/repair-sleeper-player-identities-dry-run.json"],
      }));
    }
  }

  return { records: Array.from(byKey.values()), sourceRows, sleeperStats };
}

function loadNflverseIdentityRecords() {
  const byKey = new Map<string, PlayerIdentityRecord>();
  const playersCsv = readNflverseCsv("players");
  const rostersCsv = readNflverseCsv("rosters");
  const statsCsv = readNflverseCsv("playerStats");

  for (const player of playersCsv.rows.map(normalizeNflversePlayer).filter((player) => isFantasyRelevantNflversePosition(player.position))) {
    addRecord(byKey, makeIdentityRecord({
      source: "nflverse_players",
      playerId: player.playerId,
      playerName: player.playerName,
      position: player.position,
      team: player.team,
      rookieSeason: player.rookieSeason,
      birthDate: player.birthDate,
      height: player.height,
      weight: player.weight,
      age: null,
      yearsExperience: player.yearsExperience,
      college: player.college,
      ids: {
        gsisId: player.ids.gsisId,
        espnId: player.ids.espnId,
        pfrId: player.ids.pfrId,
        nflId: player.ids.nflId,
        smartId: player.ids.smartId,
      },
      sourceRefs: ["data/nflverse/players.csv"],
    }));
  }

  for (const roster of rostersCsv.rows.map(normalizeNflverseRoster).filter((roster) => isFantasyRelevantNflversePosition(roster.position))) {
    addRecord(byKey, makeIdentityRecord({
      source: "nflverse_rosters",
      playerId: roster.playerId,
      playerName: roster.playerName,
      position: roster.position,
      team: roster.team,
      rookieSeason: roster.rookieYear,
      ids: {
        gsisId: roster.ids.gsisId,
        espnId: roster.ids.espnId,
        pfrId: roster.ids.pfrId,
        smartId: roster.ids.smartId,
        sleeperId: roster.ids.sleeperId,
      },
      sourceRefs: ["data/nflverse/rosters_2025.csv"],
    }));
  }

  for (const stat of statsCsv.rows.map(normalizeNflverseWeeklyStat).filter((stat) => isFantasyRelevantNflversePosition(stat.position))) {
    addRecord(byKey, makeIdentityRecord({
      source: "nflverse_player_stats",
      playerId: stat.playerId,
      playerName: stat.playerName,
      position: stat.position,
      team: stat.team,
      ids: { gsisId: stat.playerId },
      sourceRefs: ["data/nflverse/player_stats_2025.csv"],
    }));
  }

  return {
    records: Array.from(byKey.values()),
    sourceRows: {
      players: playersCsv.rows.length,
      rosters: rostersCsv.rows.length,
      playerStats: statsCsv.rows.length,
    },
  };
}

function addRecord(records: Map<string, PlayerIdentityRecord>, record: PlayerIdentityRecord | null) {
  if (!record) return;
  const key = identityKey(record);
  const existing = records.get(key);
  records.set(key, existing ? mergeIdentityRecords(existing, record) : record);
}

function identityKey(record: PlayerIdentityRecord) {
  return record.ids.blackbirdPlayerId ?? record.ids.gsisId ?? record.ids.sleeperId ?? record.ids.smartId ?? `${record.normalizedName}|${record.position ?? ""}|${record.team ?? ""}`;
}

function countMatches(matches: PlayerIdentityMatch[]): Record<IdentityMatchConfidence, number> {
  return matches.reduce((acc, match) => {
    acc[match.confidence] = (acc[match.confidence] ?? 0) + 1;
    return acc;
  }, { manual_override: 0, exact_id: 0, strong: 0, medium: 0, weak: 0, unmatched: 0, conflict: 0 } as Record<IdentityMatchConfidence, number>);
}

function examplesFor(matches: PlayerIdentityMatch[], confidence: IdentityMatchConfidence): MatchExample[] {
  return matches
    .filter((match) => match.confidence === confidence)
    .slice(0, 20)
    .map(matchExample);
}

function buildLimitations(blackbirdRecords: ReturnType<typeof loadBlackbirdIdentityRecords>, matches: PlayerIdentityMatch[]) {
  const limitations: string[] = ["Dry-run only. No Supabase writes are performed."];
  if (blackbirdRecords.records.length === 0) limitations.push("No local Blackbird/Sleeper player source was found; Supabase player matching remains pending.");
  if (blackbirdRecords.sourceRows.sleeperExportRaw === 0) limitations.push("Full local Sleeper export is missing. Run npm run sleeper:export to improve exact sleeper_id coverage.");
  if (blackbirdRecords.sourceRows.sleeperRepairDiagnostic === 0) limitations.push("No local Sleeper repair diagnostic rows were available, so exact sleeper_id matching is limited.");
  if (matches.some((match) => match.confidence === "conflict")) limitations.push("Some candidates are conflicts or duplicates and require manual review before persistence.");
  if (matches.some((match) => match.confidence === "unmatched")) limitations.push("Some Blackbird/Sleeper players remain unmatched to nflverse identities.");
  return limitations;
}

function matchExample(match: PlayerIdentityMatch): MatchExample {
  return {
    sourcePlayerId: match.sourcePlayer.playerId,
    sourcePlayerName: match.sourcePlayer.playerName,
    sourcePosition: match.sourcePlayer.position,
    sourceTeam: match.sourcePlayer.team,
    sourceStatus: match.sourcePlayer.status,
    sourceActive: match.sourcePlayer.active,
    sourceSearchRank: match.sourcePlayer.searchRank,
    sourceYearsExperience: match.sourcePlayer.yearsExperience,
    sourceCollege: match.sourcePlayer.college,
    sourceAge: match.sourcePlayer.age,
    sourceBirthDate: match.sourcePlayer.birthDate,
    sourceHeight: match.sourcePlayer.height,
    sourceWeight: match.sourcePlayer.weight,
    matchedPlayerId: match.matchedPlayer?.playerId ?? null,
    matchedPlayerName: match.matchedPlayer?.playerName ?? null,
    confidence: match.confidence,
    score: match.score,
    matchReasons: match.matchReasons,
    conflictReasons: match.conflictReasons,
      candidateCount: match.candidateCount,
      preservedIds: match.preservedIds,
      candidateExamples: match.candidateExamples,
  };
}

function isActiveFantasyRelevantSource(record: PlayerIdentityRecord) {
  if (record.active !== true) return false;
  return Boolean(record.position && ["QB", "RB", "WR", "TE", "K", "DST", "DL", "LB", "DB"].includes(record.position));
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
