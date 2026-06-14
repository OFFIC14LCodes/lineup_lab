// H7 ADP board generation — league-specific view combining market ADP, HLV, tiers, and availability.
// Reads from stored snapshots + in-memory HLV/VvM from H6 profiles.
// Does not write to any table.

import { buildAvailabilityModels } from "./availability";
import { scoreFormatMatchByPosition } from "./format-match";
import { buildPositionalTiers } from "./value";
import type {
  AdpBoardSeasonModel,
  AdpFormatGroupKey,
  AdpFormatProfile,
  AvailabilityModel,
  ConsensusAdpBreakdown,
  ConsensusAdpRecord,
  ConsensusMarketConfidence,
  DataQuality,
  HistoricalLeagueValue,
  LeagueFormatInput,
  PositionFormatMatchScore,
  ValueSignal,
  ValueVsMarket,
  AdpFormatMatchScore,
  AdpTier,
} from "./types";
import type { StoredPlayerRecord, SnapshotRow } from "./storage";

// --------------------------------------------------------------------------
// Board entry type
// --------------------------------------------------------------------------

export type AdpBoardEntry = {
  // Identity
  canonicalPlayerId: string | null;
  playerName: string;
  position: string | null;
  nflTeam: string | null;
  isRookie: boolean;
  // Market
  overallAdp: number;
  marketRank: number | null;
  positionalRank: number | null;
  minPick: number | null;
  maxPick: number | null;
  adpStddev: number | null;
  // Format match (relative to selected league)
  formatMatchScore: number;
  formatMatchCompatible: boolean;
  formatMatchWarnings: string[];
  // HLV (null when no H6 profile). Historical — not projected.
  hlvScore: number | null;
  hlvRank: number | null;
  hlvPositionalRank: number | null;
  pointsAboveReplacement: number | null;
  historyConfidence: string | null;
  // Value vs market
  rankDelta: number | null;
  valueSignal: ValueSignal;
  dataQuality: DataQuality;
  // Tiers
  marketTier: string | null;
  marketTierNumber: number | null;
  // Availability
  probAtAdp: number | null;             // P(available at round containing ADP pick)
  probAtAdpPlus12: number | null;       // P(available 12 picks after ADP)
  // Confidence & limitations
  identityMethod: string | null;
  identityConfidence: number | null;
  limitations: string[];
  // Season provenance: ADP cost vs historical league value
  seasonModel: AdpBoardSeasonModel | null;
  // H7.2: Multi-provider consensus fields
  formatGroupKey: AdpFormatGroupKey | null;
  positionFormatScores: PositionFormatMatchScore[] | null;
  providerDisagreement: number | null;
  marketConfidence: ConsensusMarketConfidence | null;
};

export type AdpBoardFilter = {
  positions?: string[];                 // e.g. ["QB","RB","WR","TE"]
  resolvedOnly?: boolean;               // Exclude players with no canonical ID
  hasProfile?: boolean;                 // Require H6 historical profile
  rookieOnly?: boolean;
  minConfidence?: "complete" | "high" | "moderate" | "low";
};

export type AdpBoardSort =
  | "adp"
  | "hlv"
  | "value_gap"
  | "availability"
  | "position"
  | "tier";

// --------------------------------------------------------------------------
// Build board from in-memory data
// --------------------------------------------------------------------------

export function buildAdpBoard(opts: {
  snapshot: SnapshotRow;
  records: StoredPlayerRecord[];
  formatMatch: AdpFormatMatchScore;
  hlv: HistoricalLeagueValue[];
  vvm: ValueVsMarket[];
  seasonModel?: AdpBoardSeasonModel;
  // H7.2: optional multi-provider consensus inputs
  snapshotFormatProfile?: AdpFormatProfile;
  leagueFormatInput?: LeagueFormatInput;
  formatGroupKey?: AdpFormatGroupKey;
  breakdowns?: Map<string, ConsensusAdpBreakdown>;
  filter?: AdpBoardFilter;
  sort?: AdpBoardSort;
}): AdpBoardEntry[] {
  const { records, formatMatch, hlv, vvm, seasonModel, snapshotFormatProfile, leagueFormatInput, formatGroupKey, breakdowns, filter, sort } = opts;

  // Compute position-specific format scores once if format profile and league are available
  const posFormatScores =
    snapshotFormatProfile && leagueFormatInput
      ? scoreFormatMatchByPosition(snapshotFormatProfile, leagueFormatInput)
      : null;

  // Index HLV and VvM by canonical player ID
  const hlvMap = new Map<string, HistoricalLeagueValue>(hlv.map((h) => [h.canonicalPlayerId, h]));
  const vvmMap = new Map<string, ValueVsMarket>(vvm.map((v) => [v.canonicalPlayerId, v]));

  // Build consensus records from stored player records for tier + availability computation
  const consensusForTiers: ConsensusAdpRecord[] = records
    .filter((r) => r.canonical_player_id)
    .map((r) => ({
      canonicalPlayerId: r.canonical_player_id!,
      playerName: r.raw_name,
      position: r.raw_position,
      nflTeam: r.raw_team,
      isRookie: r.is_rookie,
      hasHistoricalProfile: r.has_historical_profile,
      overallAdp: Number(r.overall_adp),
      overallRank: r.overall_rank ?? 0,
      positionalAdp: r.positional_adp ? Number(r.positional_adp) : null,
      positionalRank: r.positional_rank ?? null,
      adpStddev: r.stddev ? Number(r.stddev) : null,
      minPick: r.min_pick,
      maxPick: r.max_pick,
      providerCount: 1,
      totalSampleSize: r.sample_size,
      recencyWeight: 1.0,
      formatWeight: formatMatch.overallScore,
      sourceSnapshots: [r.snapshot_id],
    }));

  // Build tiers
  const tiers = buildPositionalTiers(consensusForTiers);
  const tierMap = new Map<string, AdpTier>();
  for (const tier of tiers) {
    for (const pid of tier.playerIds) {
      tierMap.set(pid, tier);
    }
  }

  // Build availability models for top 200 by ADP
  const top200 = consensusForTiers
    .sort((a, b) => a.overallAdp - b.overallAdp)
    .slice(0, 200);
  const availModels = buildAvailabilityModels(
    top200.map((r) => ({
      canonicalPlayerId: r.canonicalPlayerId,
      playerName: r.playerName,
      overallAdp: r.overallAdp,
      adpStddev: r.adpStddev,
    }))
  );
  const availMap = new Map<string, AvailabilityModel>(
    availModels.map((m) => [m.canonicalPlayerId, m])
  );

  // Build entries
  const entries: AdpBoardEntry[] = records.map((r) => {
    const pid = r.canonical_player_id;
    const hlvRec = pid ? hlvMap.get(pid) ?? null : null;
    const vvmRec = pid ? vvmMap.get(pid) ?? null : null;
    const tier = pid ? tierMap.get(pid) ?? null : null;
    const avail = pid ? availMap.get(pid) ?? null : null;
    const adp = Number(r.overall_adp);
    const adpPick = Math.round(adp);
    const adpPlus12 = adpPick + 12;

    const perfSeason = seasonModel?.historicalPerformanceSeason ?? null;
    const cfgSeason = seasonModel?.leagueConfigSeason ?? null;
    const limitations: string[] = [];
    if (!r.canonical_player_id) limitations.push("identity unresolved");
    if (!hlvRec) {
      limitations.push(
        perfSeason
          ? `no ${perfSeason} historical profile under ${cfgSeason ?? "target"} league config`
          : "no H6 historical profile"
      );
    }
    if (r.is_rookie) {
      limitations.push(
        perfSeason ? `rookie — no ${perfSeason} historical data` : "rookie — no historical data"
      );
    }
    if (hlvRec && hlvRec.historicalScoreConfidence === "low") limitations.push("low scoring completeness");
    if (!formatMatch.isCompatible) limitations.push("format mismatch — ADP not directly comparable");
    if (formatMatch.warnings.length > 0) limitations.push(...formatMatch.warnings.slice(0, 2));

    const probAtAdp = avail?.probAvailableAt[String(adpPick)] ?? null;
    const probAtAdpPlus12 = avail?.probAvailableAt[String(adpPlus12)] ?? null;

    return {
      canonicalPlayerId: pid ?? null,
      playerName: r.raw_name,
      position: r.raw_position,
      nflTeam: r.raw_team,
      isRookie: r.is_rookie,
      overallAdp: adp,
      marketRank: r.overall_rank,
      positionalRank: r.positional_rank ?? null,
      minPick: r.min_pick,
      maxPick: r.max_pick,
      adpStddev: r.stddev ? Number(r.stddev) : null,
      formatMatchScore: formatMatch.overallScore,
      formatMatchCompatible: formatMatch.isCompatible,
      formatMatchWarnings: formatMatch.warnings,
      hlvScore: hlvRec?.hlvScore ?? null,
      hlvRank: hlvRec?.hlvRank ?? null,
      hlvPositionalRank: hlvRec?.hlvPositionalRank ?? null,
      pointsAboveReplacement: hlvRec?.pointsAboveReplacement ?? null,
      historyConfidence: hlvRec?.historicalScoreConfidence ?? null,
      rankDelta: vvmRec?.rankDelta ?? null,
      valueSignal: vvmRec?.valueSignal ?? "insufficient_data",
      dataQuality: vvmRec?.dataQuality ?? (r.is_rookie ? "rookie_no_history" : "insufficient_data"),
      marketTier: tier?.tierLabel ?? null,
      marketTierNumber: tier?.tierNumber ?? null,
      probAtAdp,
      probAtAdpPlus12,
      identityMethod: r.identity_match_method,
      identityConfidence: r.identity_match_confidence ? Number(r.identity_match_confidence) : null,
      limitations,
      seasonModel: seasonModel ?? null,
      formatGroupKey: formatGroupKey ?? null,
      positionFormatScores: posFormatScores,
      providerDisagreement: pid && breakdowns ? (breakdowns.get(pid)?.providerDisagreement ?? null) : null,
      marketConfidence: pid && breakdowns ? (breakdowns.get(pid)?.marketConfidence ?? null) : null,
    };
  });

  // Apply filters
  let filtered = entries;
  if (filter) {
    if (filter.positions?.length) {
      const posSet = new Set(filter.positions);
      filtered = filtered.filter((e) => e.position && posSet.has(e.position));
    }
    if (filter.resolvedOnly) {
      filtered = filtered.filter((e) => e.canonicalPlayerId !== null);
    }
    if (filter.hasProfile) {
      filtered = filtered.filter((e) => e.hlvRank !== null);
    }
    if (filter.rookieOnly) {
      filtered = filtered.filter((e) => e.isRookie);
    }
    if (filter.minConfidence) {
      const order = { complete: 4, high: 3, moderate: 2, low: 1 };
      const minLevel = order[filter.minConfidence] ?? 1;
      filtered = filtered.filter(
        (e) => e.historyConfidence && (order[e.historyConfidence as keyof typeof order] ?? 0) >= minLevel
      );
    }
  }

  // Apply sort
  const sortKey = sort ?? "adp";
  filtered.sort((a, b) => {
    switch (sortKey) {
      case "adp":
        return a.overallAdp - b.overallAdp;
      case "hlv":
        return (a.hlvRank ?? 9999) - (b.hlvRank ?? 9999);
      case "value_gap":
        return (b.rankDelta ?? -9999) - (a.rankDelta ?? -9999);
      case "availability":
        return (b.probAtAdp ?? 0) - (a.probAtAdp ?? 0);
      case "position": {
        const pc = (a.position ?? "ZZZ").localeCompare(b.position ?? "ZZZ");
        return pc !== 0 ? pc : a.overallAdp - b.overallAdp;
      }
      case "tier":
        return (a.marketTierNumber ?? 999) - (b.marketTierNumber ?? 999) || a.overallAdp - b.overallAdp;
      default:
        return a.overallAdp - b.overallAdp;
    }
  });

  return filtered;
}

// --------------------------------------------------------------------------
// Representative player examples for specific archetypes
// --------------------------------------------------------------------------

export type ArchetypeExample = {
  archetype: string;
  playerName: string;
  position: string | null;
  nflTeam: string | null;
  overallAdp: number;
  marketRank: number | null;
  hlvScore: number | null;
  hlvRank: number | null;
  pointsAboveReplacement: number | null;
  rankDelta: number | null;
  valueSignal: ValueSignal;
  dataQuality: DataQuality;
  probAtAdp: number | null;
  historyConfidence: string | null;
  limitations: string[];
};

export function extractArchetypeExamples(board: AdpBoardEntry[]): ArchetypeExample[] {
  const examples: ArchetypeExample[] = [];

  function pick(
    archetype: string,
    filter: (e: AdpBoardEntry) => boolean,
    preferWith: (e: AdpBoardEntry) => boolean = () => true
  ) {
    const candidates = board.filter(filter);
    const preferred = candidates.filter(preferWith);
    const entry = preferred[0] ?? candidates[0];
    if (!entry) return;
    examples.push({
      archetype,
      playerName: entry.playerName,
      position: entry.position,
      nflTeam: entry.nflTeam,
      overallAdp: entry.overallAdp,
      marketRank: entry.marketRank,
      hlvScore: entry.hlvScore,
      hlvRank: entry.hlvRank,
      pointsAboveReplacement: entry.pointsAboveReplacement,
      rankDelta: entry.rankDelta,
      valueSignal: entry.valueSignal,
      dataQuality: entry.dataQuality,
      probAtAdp: entry.probAtAdp,
      historyConfidence: entry.historyConfidence,
      limitations: entry.limitations,
    });
  }

  pick("elite_qb", (e) => e.position === "QB" && e.overallAdp <= 50, (e) => e.overallAdp <= 25);
  pick("mid_round_qb", (e) => e.position === "QB" && e.overallAdp > 50);
  pick("elite_rb", (e) => e.position === "RB" && e.overallAdp <= 30, (e) => e.overallAdp <= 15);
  pick("mid_round_wr", (e) => e.position === "WR" && e.overallAdp > 30 && e.overallAdp <= 80);
  pick("te_premium", (e) => e.position === "TE" && e.overallAdp <= 60, (e) => e.hlvScore !== null);
  pick("strong_value", (e) => e.valueSignal === "strong_value" || e.valueSignal === "moderate_value");
  pick("negative_value", (e) => e.valueSignal === "clear_overdraft" || e.valueSignal === "slight_overdraft");
  pick(
    "rookie_no_history",
    (e) => e.isRookie || e.dataQuality === "rookie_no_history",
    (e) => e.overallAdp <= 60
  );

  return examples;
}
