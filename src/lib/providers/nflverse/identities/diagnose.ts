import { readFileSync } from "node:fs";
import path from "node:path";

import Papa from "papaparse";
import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizePlayerName } from "@/lib/players/normalize";
import { normalizeGsisId } from "@/lib/providers/nflverse/normalize-gsis-id";
import { NFLVERSE_SUPPORTED_POSITION_GROUPS } from "@/lib/providers/nflverse/schema";

import { buildEvidenceComparison, normalizeHeightToInches } from "./evidence";
import { classifyRootCause, isPositionCompatible } from "./classify";
import type {
  CanonicalPlayerInfo,
  DiagnoseOptions,
  DiagnoseReport,
  NflversePlayerInfo,
  UnresolvedPlayerReport,
  UnresolvedRootCause
} from "./types";

const PAGE_SIZE = 1000;
const CHUNK_SIZE = 500;

// ─── Canonical players ──────────────────────────────────────────────────────

export type CanonicalMaps = {
  byId: Map<string, CanonicalPlayerInfo>;
  byGsisId: Map<string, CanonicalPlayerInfo>;       // meta.gsis_id → player
  byEspnId: Map<string, CanonicalPlayerInfo>;        // meta.espn_id → player
  byNormalizedName: Map<string, CanonicalPlayerInfo[]>; // normalized_name → players
};

export async function loadAllCanonicalPlayers(client: SupabaseClient): Promise<CanonicalMaps> {
  const byId = new Map<string, CanonicalPlayerInfo>();
  const byGsisId = new Map<string, CanonicalPlayerInfo>();
  const byEspnId = new Map<string, CanonicalPlayerInfo>();
  const byNormalizedName = new Map<string, CanonicalPlayerInfo[]>();

  let page = 0;
  while (true) {
    const { data, error } = await client
      .from("players")
      .select("id, sleeper_player_id, full_name, normalized_name, position_group, team, metadata_json")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to load canonical players (page ${page}): ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      const meta = (row.metadata_json as Record<string, unknown> | null) ?? {};

      const rawGsisId = meta["gsis_id"];
      const rawEspnId = meta["espn_id"];
      const rawStatsId = meta["stats_id"];

      const metaGsisId = rawGsisId != null ? normalizeGsisId(String(rawGsisId)) : null;
      const metaEspnId =
        rawEspnId != null && String(rawEspnId).trim() !== "" && String(rawEspnId) !== "0" && String(rawEspnId) !== "null"
          ? String(rawEspnId).trim()
          : null;
      const metaStatsId = rawStatsId != null && String(rawStatsId).trim() !== "" ? String(rawStatsId).trim() : null;

      // Evidence fields
      const rawBirthDate = meta["birth_date"];
      const metaBirthDate =
        rawBirthDate != null && String(rawBirthDate).trim() !== "" && String(rawBirthDate) !== "null"
          ? String(rawBirthDate).trim()
          : null;

      const rawCollege = meta["college"];
      const metaCollege = rawCollege != null && String(rawCollege).trim() !== "" ? String(rawCollege).trim() : null;

      const rawHeight = meta["height"];
      const metaHeightInches = rawHeight != null ? normalizeHeightToInches(String(rawHeight)) : null;

      const rawWeight = meta["weight"];
      const metaWeightRaw = rawWeight != null ? String(rawWeight).trim() : null;
      const metaWeightLbs = metaWeightRaw && metaWeightRaw !== "NA" ? (parseInt(metaWeightRaw, 10) || null) : null;

      // Sleeper stores rookie_year in a nested metadata object
      const nestedMeta = meta["metadata"] as Record<string, unknown> | null | undefined;
      const rookieYearRaw = nestedMeta?.["rookie_year"];
      const metaRookieYear = rookieYearRaw != null ? (parseInt(String(rookieYearRaw), 10) || null) : null;

      const info: CanonicalPlayerInfo = {
        playerId: row.id as string,
        sleeperId: row.sleeper_player_id as string,
        fullName: (row.full_name as string | null) ?? null,
        normalizedName: (row.normalized_name as string | null) ?? null,
        positionGroup: (row.position_group as string | null) ?? null,
        team: (row.team as string | null) ?? null,
        metaGsisId,
        metaEspnId,
        metaStatsId,
        metaBirthDate,
        metaCollege,
        metaHeightInches,
        metaWeightLbs,
        metaRookieYear
      };

      byId.set(info.playerId, info);
      if (metaGsisId) byGsisId.set(metaGsisId, info);
      if (metaEspnId) byEspnId.set(metaEspnId, info);
      if (info.normalizedName) {
        const existing = byNormalizedName.get(info.normalizedName) ?? [];
        existing.push(info);
        byNormalizedName.set(info.normalizedName, existing);
      }
    }

    if (data.length < PAGE_SIZE) break;
    page++;
  }

  return { byId, byGsisId, byEspnId, byNormalizedName };
}

// ─── nflverse players.csv lookup ─────────────────────────────────────────────

const POSITION_GROUP_CANON: Record<string, string> = {
  QB: "QB", RB: "RB", FB: "RB", WR: "WR", TE: "TE",
  K: "K", P: "K", OL: "OL", OT: "OL", OG: "OL", C: "OL",
  DL: "DL", DE: "DL", DT: "DL", EDGE: "DL", NT: "DL",
  LB: "LB", ILB: "LB", OLB: "LB", MLB: "LB",
  DB: "DB", CB: "DB", S: "DB", FS: "DB", SS: "DB"
};

export function loadNflversePlayersMap(projectRoot: string): Map<string, NflversePlayerInfo> {
  const filePath = path.join(projectRoot, "data", "raw", "nflverse", "players", "players.csv");
  const content = readFileSync(filePath, "utf8");
  const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true });

  const map = new Map<string, NflversePlayerInfo>();

  for (const row of parsed.data) {
    const gsisId = normalizeGsisId(row["gsis_id"]);
    if (!gsisId) continue;

    const displayName = row["display_name"]?.trim() ?? "";
    const normalizedName = displayName ? normalizePlayerName(displayName) : "";
    const rawPosGroup = row["position_group"]?.trim().toUpperCase() ?? "";
    const positionGroup = POSITION_GROUP_CANON[rawPosGroup] ?? null;

    const espnIdRaw = row["espn_id"]?.trim();
    const espnId = espnIdRaw && espnIdRaw !== "NA" && espnIdRaw !== "" ? espnIdRaw : null;

    const lastSeasonRaw = row["last_season"]?.trim();
    let lastSeason: number | null = null;
    if (lastSeasonRaw && lastSeasonRaw !== "NA") {
      const n = parseInt(lastSeasonRaw, 10);
      if (Number.isInteger(n)) lastSeason = n;
    }

    // Extended evidence fields
    const suffixRaw = row["suffix"]?.trim();
    const suffix = suffixRaw && suffixRaw !== "" && suffixRaw !== "NA" ? suffixRaw : null;

    const rookieSeasonRaw = row["rookie_season"]?.trim();
    const rookieSeason = rookieSeasonRaw && rookieSeasonRaw !== "NA"
      ? (parseInt(rookieSeasonRaw, 10) || null)
      : null;

    const draftYearRaw = row["draft_year"]?.trim();
    const draftYear = draftYearRaw && draftYearRaw !== "NA" && draftYearRaw !== ""
      ? (parseInt(draftYearRaw, 10) || null)
      : null;

    const draftRoundRaw = row["draft_round"]?.trim();
    const draftRound = draftRoundRaw && draftRoundRaw !== "NA" && draftRoundRaw !== ""
      ? (parseInt(draftRoundRaw, 10) || null)
      : null;

    const draftPickRaw = row["draft_pick"]?.trim();
    const draftPick = draftPickRaw && draftPickRaw !== "NA" && draftPickRaw !== ""
      ? (parseInt(draftPickRaw, 10) || null)
      : null;

    map.set(gsisId, {
      gsisId,
      displayName,
      normalizedName,
      positionGroup,
      rawPosition: row["position"]?.trim() || null,
      latestTeam: row["latest_team"]?.trim() || null,
      espnId,
      birthDate: row["birth_date"]?.trim() || null,
      college: row["college_name"]?.trim() || null,
      height: row["height"]?.trim() || null,
      weight: row["weight"]?.trim() || null,
      status: row["status"]?.trim() ?? "",
      lastSeason,
      suffix,
      rookieSeason,
      draftYear,
      draftRound,
      draftPick
    });
  }

  return map;
}

// ─── Weekly stats — unresolved GSIS ID extraction ────────────────────────────

type WeeklyGsisEntry = {
  weeklyRowCount: number;
  position: string;  // position group from weekly stats
};

export function loadUnresolvedGsisIds(
  projectRoot: string,
  season: number,
  resolvedGsisIds: Set<string>
): Map<string, WeeklyGsisEntry> {
  const filePath = path.join(
    projectRoot, "data", "raw", "nflverse", "player_stats", String(season),
    `stats_player_week_${season}.csv`
  );
  const content = readFileSync(filePath, "utf8");
  const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true });

  const allCounts = new Map<string, WeeklyGsisEntry>();

  for (const row of parsed.data) {
    const posGroup = row["position_group"]?.trim().toUpperCase();
    if (!posGroup || !NFLVERSE_SUPPORTED_POSITION_GROUPS.has(posGroup)) continue;

    const seasonType = row["season_type"]?.trim().toUpperCase();
    if (seasonType !== "REG") continue;

    const gsisId = normalizeGsisId(row["player_id"]);
    if (!gsisId) continue;

    const existing = allCounts.get(gsisId);
    if (existing) {
      existing.weeklyRowCount += 1;
    } else {
      allCounts.set(gsisId, { weeklyRowCount: 1, position: posGroup });
    }
  }

  const unresolved = new Map<string, WeeklyGsisEntry>();
  for (const [gsisId, entry] of allCounts) {
    if (!resolvedGsisIds.has(gsisId)) {
      unresolved.set(gsisId, entry);
    }
  }

  return unresolved;
}

// ─── Existing player_external_ids lookup ────────────────────────────────────

export async function loadExistingMappingsForGsisIds(
  gsisIds: string[],
  client: SupabaseClient
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const deduped = [...new Set(gsisIds)];

  for (let i = 0; i < deduped.length; i += CHUNK_SIZE) {
    const chunk = deduped.slice(i, i + CHUNK_SIZE);
    const { data, error } = await client
      .from("player_external_ids")
      .select("external_id, player_id, provider, external_type")
      .in("external_id", chunk);

    if (error) throw new Error(`Failed to load external mappings: ${error.message}`);

    for (const row of data ?? []) {
      const key = normalizeGsisId(row.external_id as string);
      if (key && !result.has(key)) {
        result.set(key, row.player_id as string);
      }
    }
  }

  return result;
}

export async function loadResolvedGsisIds(client: SupabaseClient): Promise<Set<string>> {
  const resolved = new Set<string>();
  let page = 0;

  while (true) {
    const { data, error } = await client
      .from("player_external_ids")
      .select("external_id")
      .eq("provider", "gsis")
      .eq("external_type", "gsis")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to load resolved GSIS IDs: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      const key = normalizeGsisId(row.external_id as string);
      if (key) resolved.add(key);
    }

    if (data.length < PAGE_SIZE) break;
    page++;
  }

  return resolved;
}

// ─── Main diagnosis pipeline ─────────────────────────────────────────────────

export async function diagnose2025Identities(
  options: DiagnoseOptions,
  client: SupabaseClient
): Promise<DiagnoseReport> {
  const { season, projectRoot } = options;

  const resolvedGsisIds = await loadResolvedGsisIds(client);
  const unresolvedEntries = loadUnresolvedGsisIds(projectRoot, season, resolvedGsisIds);
  const nflversePlayersMap = loadNflversePlayersMap(projectRoot);
  const canonical = await loadAllCanonicalPlayers(client);

  const unresolvedIds = [...unresolvedEntries.keys()];
  const existingMappings = await loadExistingMappingsForGsisIds(unresolvedIds, client);

  const players: UnresolvedPlayerReport[] = [];
  const rootCauseCounts: Record<UnresolvedRootCause, number> = {
    canonical_player_missing: 0,
    canonical_gsis_missing: 0,
    canonical_espn_missing: 0,
    source_identifier_missing: 0,
    identifier_format_mismatch: 0,
    duplicate_canonical_candidate: 0,
    conflicting_external_mapping: 0,
    position_mismatch: 0,
    legacy_or_duplicate_source_identity: 0,
    unknown: 0
  };
  const byPosition: Record<string, Partial<Record<UnresolvedRootCause, number>>> = {};

  // Tier accumulation
  const tierCounts = { autoApproved: 0, highConfidenceReview: 0, ambiguous: 0, conflict: 0, rejected: 0 };
  let autoApprovedRows = 0;
  let reviewRows = 0;
  let conflictRows = 0;

  for (const [gsisId, weeklyEntry] of unresolvedEntries) {
    const nflverse = nflversePlayersMap.get(gsisId);
    const weeklyRowCount = weeklyEntry.weeklyRowCount;
    const weeklyPosition = weeklyEntry.position;

    const nflverseName = nflverse?.displayName ?? gsisId;
    const nflverseNorm = nflverse?.normalizedName ?? normalizePlayerName(gsisId);
    const nflverseEspnId = nflverse?.espnId ?? null;
    const nflversePosGroup = nflverse?.positionGroup ?? null;

    const allNameCandidates = canonical.byNormalizedName.get(nflverseNorm) ?? [];
    const positionCompatibleCandidates = allNameCandidates.filter((c) =>
      isPositionCompatible(nflversePosGroup, c.positionGroup)
    );

    const hasExistingMapping = existingMappings.has(gsisId);
    const existingMappingPlayerId = existingMappings.get(gsisId) ?? null;

    const rootCause = classifyRootCause({
      nflversePlayer: { gsisId, espnId: nflverseEspnId, positionGroup: nflversePosGroup },
      allNameCandidates,
      positionCompatibleCandidates,
      hasExistingMapping
    });

    const uniqueCandidate = positionCompatibleCandidates.length === 1 ? positionCompatibleCandidates[0]! : null;

    // Evidence comparison — only for canonical_gsis_missing players with a unique candidate
    let evidence = null;
    let confidenceTier = null;
    let approvalReason = null;

    if (rootCause === "canonical_gsis_missing" && uniqueCandidate && nflverse) {
      evidence = buildEvidenceComparison(nflverse, uniqueCandidate);
      confidenceTier = evidence.tier;
      approvalReason = evidence.approvalReason;

      // Accumulate tier counts
      switch (confidenceTier) {
        case "auto_approved":
          tierCounts.autoApproved++;
          autoApprovedRows += weeklyRowCount;
          break;
        case "high_confidence_review":
          tierCounts.highConfidenceReview++;
          reviewRows += weeklyRowCount;
          break;
        case "ambiguous":
          tierCounts.ambiguous++;
          break;
        case "conflict":
          tierCounts.conflict++;
          conflictRows += weeklyRowCount;
          break;
        case "rejected":
          tierCounts.rejected++;
          break;
      }
    }

    players.push({
      gsisId,
      nflverseName,
      nflversePositionGroup: nflversePosGroup,
      nflverseTeam: nflverse?.latestTeam ?? null,
      nflverseEspnId,
      nflverseBirthDate: nflverse?.birthDate ?? null,
      nflverseCollege: nflverse?.college ?? null,
      nflverseHeight: nflverse?.height ?? null,
      nflverseWeight: nflverse?.weight ?? null,
      nflverseSuffix: nflverse?.suffix ?? null,
      nflverseRookieSeason: nflverse?.rookieSeason ?? null,
      nflverseDraftYear: nflverse?.draftYear ?? null,
      nflverseDraftRound: nflverse?.draftRound ?? null,
      nflverseDraftPick: nflverse?.draftPick ?? null,
      weeklyRowCount,
      weeklyPosition,
      candidateCount: positionCompatibleCandidates.length,
      canonicalPlayerId: uniqueCandidate?.playerId ?? null,
      canonicalName: uniqueCandidate?.fullName ?? null,
      canonicalSleeperPlayerId: uniqueCandidate?.sleeperId ?? null,
      canonicalMetaGsisId: uniqueCandidate?.metaGsisId ?? null,
      canonicalMetaEspnId: uniqueCandidate?.metaEspnId ?? null,
      canonicalMetaStatsId: uniqueCandidate?.metaStatsId ?? null,
      canonicalTeam: uniqueCandidate?.team ?? null,
      canonicalPositionGroup: uniqueCandidate?.positionGroup ?? null,
      canonicalBirthDate: uniqueCandidate?.metaBirthDate ?? null,
      canonicalCollege: uniqueCandidate?.metaCollege ?? null,
      canonicalHeight: uniqueCandidate?.metaHeightInches != null ? String(uniqueCandidate.metaHeightInches) : null,
      canonicalWeight: uniqueCandidate?.metaWeightLbs != null ? String(uniqueCandidate.metaWeightLbs) : null,
      canonicalRookieYear: uniqueCandidate?.metaRookieYear ?? null,
      hasExistingMapping,
      existingMappingPlayerId,
      rootCause,
      evidence,
      confidenceTier,
      approvalReason
    });

    rootCauseCounts[rootCause] += 1;

    const posKey = nflversePosGroup ?? weeklyPosition;
    if (!byPosition[posKey]) byPosition[posKey] = {};
    byPosition[posKey][rootCause] = (byPosition[posKey][rootCause] ?? 0) + 1;
  }

  players.sort((a, b) => b.weeklyRowCount - a.weeklyRowCount);

  // Sleeper metadata coverage summary
  const withUnique = players.filter((p) => p.candidateCount === 1);
  const withUniqueCandidate = withUnique.length;
  const candidatesWithSleeperId = withUnique.filter((p) => p.canonicalSleeperPlayerId !== null).length;
  const candidatesMissingGsisId = withUnique.filter((p) => p.canonicalMetaGsisId === null).length;
  const candidatesMissingEspnId = withUnique.filter((p) => p.canonicalMetaEspnId === null).length;
  const candidatesSleeperHasGsisId = withUnique.filter((p) => p.canonicalMetaGsisId !== null).length;
  const candidatesSleeperHasEspnId = withUnique.filter((p) => p.canonicalMetaEspnId !== null).length;

  return {
    season,
    totalUnresolved: players.length,
    rootCauseCounts,
    byPosition,
    players,
    withUniqueCandidate,
    candidatesWithSleeperId,
    candidatesMissingGsisId,
    candidatesMissingEspnId,
    candidatesSleeperHasGsisId,
    candidatesSleeperHasEspnId,
    tierCounts,
    autoApprovedRows,
    reviewRows,
    conflictRows
  };
}
