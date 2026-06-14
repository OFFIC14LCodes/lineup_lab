import type {
  AdpTier,
  AdpTierBasis,
  ConsensusAdpRecord,
  DataQuality,
  HistoricalLeagueValue,
  ValueSignal,
  ValueVsMarket,
} from "./types";
import type { PlayerLeagueSeasonProfile } from "@/lib/draft-data/types";

// Penalty factor applied to PAR/G based on scoring completeness.
const CONFIDENCE_PENALTY: Record<string, number> = {
  complete: 1.00,
  high: 0.97,
  moderate: 0.88,
  low: 0.70,
  unusable: 0.00,
};

// Build HLV records from H6 profiles for a specific league.
// Historical league value = actual past performance — NOT a projection.
export function buildHistoricalLeagueValues(
  profiles: PlayerLeagueSeasonProfile[],
  season: number,
  leagueId: string
): HistoricalLeagueValue[] {
  const raw: Array<HistoricalLeagueValue & { _sortKey: number }> = [];

  for (const profile of profiles) {
    const par = profile.replacement.pointsAboveReplacement;
    const gamesValid = profile.gamesWithValidScoringData;
    if (gamesValid <= 0) continue;

    const confidence = profile.scoringCompleteness.historicalScoreConfidence;
    if (confidence === "unusable") continue;
    const penaltyFactor = CONFIDENCE_PENALTY[confidence] ?? 0;

    const parPerGame = par !== null ? par / gamesValid : null;
    const adjustedParPerGame = parPerGame !== null ? parPerGame * penaltyFactor : null;

    if (adjustedParPerGame === null) continue;

    const notes: string[] = [];
    if (penaltyFactor < 1) notes.push(`Confidence penalty applied: ${confidence} → ×${penaltyFactor}`);
    if (profile.scoringCompleteness.scoringCompletenessRatio < 0.85) {
      notes.push(`Low scoring completeness: ${(profile.scoringCompleteness.scoringCompletenessRatio * 100).toFixed(1)}%`);
    }

    raw.push({
      canonicalPlayerId: profile.playerId,
      playerName: profile.playerName,
      position: profile.position,
      nflTeam: profile.nflTeam,
      season,
      leagueId,
      totalPoints: Math.round(profile.totalPoints * 100) / 100,
      pointsPerGame: Math.round(profile.pointsPerGame * 100) / 100,
      gamesWithValidScoringData: gamesValid,
      pointsAboveReplacement: par !== null ? Math.round(par * 100) / 100 : null,
      replacementPointsPerGame: profile.replacement.replacementPointsPerGame,
      scoringCompletenessRatio: profile.scoringCompleteness.scoringCompletenessRatio,
      historicalScoreConfidence: confidence,
      adjustedParPerGame: Math.round(adjustedParPerGame * 1000) / 1000,
      hlvScore: 0,               // Normalized after collecting all players
      hlvRank: 0,                // Assigned after sort
      hlvPositionalRank: 0,      // Assigned after sort
      confidencePenaltyFactor: penaltyFactor,
      notes,
      _sortKey: adjustedParPerGame,
    });
  }

  if (raw.length === 0) return [];

  // Normalize hlvScore 0–100 within position (not cross-position).
  // This avoids QBs dominating due to higher raw PAR.
  const posMaxes = new Map<string, number>();
  for (const r of raw) {
    const pos = r.position ?? "UNK";
    posMaxes.set(pos, Math.max(posMaxes.get(pos) ?? 0, r._sortKey));
  }

  for (const r of raw) {
    const max = posMaxes.get(r.position ?? "UNK") ?? 1;
    r.hlvScore = max > 0 ? Math.round((r._sortKey / max) * 1000) / 10 : 0;
  }

  // Assign overall HLV rank by adjustedParPerGame descending
  raw.sort((a, b) => b._sortKey - a._sortKey);
  raw.forEach((r, i) => { r.hlvRank = i + 1; });

  // Assign positional ranks
  const byPos = new Map<string, Array<typeof raw[number]>>();
  for (const r of raw) {
    const pos = r.position ?? "UNK";
    if (!byPos.has(pos)) byPos.set(pos, []);
    byPos.get(pos)!.push(r);
  }
  for (const group of byPos.values()) {
    group.sort((a, b) => b._sortKey - a._sortKey);
    group.forEach((r, i) => { r.hlvPositionalRank = i + 1; });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return raw.map(({ _sortKey, ...rest }) => rest);
}

// Value signal thresholds (in ranks): positive delta = HLV higher rank than market.
function rankDeltaToSignal(delta: number | null): ValueSignal {
  if (delta === null) return "insufficient_data";
  if (delta >= 24) return "strong_value";
  if (delta >= 10) return "moderate_value";
  if (delta >= -10) return "fair_value";
  if (delta >= -24) return "slight_overdraft";
  return "clear_overdraft";
}

function confidenceToDataQuality(
  confidence: "complete" | "high" | "moderate" | "low" | "unusable" | null,
  isRookie: boolean
): DataQuality {
  if (isRookie && confidence === null) return "rookie_no_history";
  if (confidence === null) return "insufficient_data";
  if (confidence === "unusable") return "insufficient_data";
  return confidence;
}

// Merge consensus ADP with HLV records into per-player value-vs-market.
export function buildValueVsMarket(
  consensusAdp: ConsensusAdpRecord[],
  hlv: HistoricalLeagueValue[],
  leagueId: string
): ValueVsMarket[] {
  const hlvByPlayer = new Map<string, HistoricalLeagueValue>(hlv.map((h) => [h.canonicalPlayerId, h]));
  const adpByPlayer = new Map<string, ConsensusAdpRecord>(consensusAdp.map((c) => [c.canonicalPlayerId, c]));

  const playerIds = new Set([...hlvByPlayer.keys(), ...adpByPlayer.keys()]);
  const results: ValueVsMarket[] = [];

  for (const playerId of playerIds) {
    const adpRec = adpByPlayer.get(playerId) ?? null;
    const hlvRec = hlvByPlayer.get(playerId) ?? null;

    const rankDelta =
      adpRec?.overallRank != null && hlvRec?.hlvRank != null
        ? adpRec.overallRank - hlvRec.hlvRank
        : null;

    const adpDelta =
      adpRec?.overallAdp != null && hlvRec?.hlvRank != null
        ? adpRec.overallAdp - hlvRec.hlvRank
        : null;

    const isRookie = adpRec?.isRookie ?? false;
    const dataQuality = confidenceToDataQuality(
      hlvRec?.historicalScoreConfidence ?? null,
      isRookie
    );

    results.push({
      canonicalPlayerId: playerId,
      playerName: hlvRec?.playerName ?? adpRec?.playerName ?? null,
      position: hlvRec?.position ?? adpRec?.position ?? null,
      nflTeam: hlvRec?.nflTeam ?? adpRec?.nflTeam ?? null,
      leagueId,
      isRookie,
      overallAdp: adpRec?.overallAdp ?? null,
      marketRank: adpRec?.overallRank ?? null,
      hlvScore: hlvRec?.hlvScore ?? null,
      hlvRank: hlvRec?.hlvRank ?? null,
      hlvPositionalRank: hlvRec?.hlvPositionalRank ?? null,
      rankDelta,
      adpDelta,
      valueSignal: rankDeltaToSignal(rankDelta),
      dataQuality,
    });
  }

  // Sort by marketRank asc, then hlvRank asc
  results.sort((a, b) => {
    const aRank = a.marketRank ?? 9999;
    const bRank = b.marketRank ?? 9999;
    if (aRank !== bRank) return aRank - bRank;
    return (a.hlvRank ?? 9999) - (b.hlvRank ?? 9999);
  });

  return results;
}

// Gap-threshold tier detection: a new tier starts when consecutive ADP values
// jump more than `gapThreshold`. Threshold scales with ADP to allow wider
// late-round gaps without fragmenting.
function tierGapThreshold(adp: number): number {
  if (adp <= 24) return 4;
  if (adp <= 60) return 6;
  if (adp <= 120) return 9;
  return 14;
}

export function buildPositionalTiers(
  consensusAdp: ConsensusAdpRecord[],
  tierBasis: AdpTierBasis = "market_adp"
): AdpTier[] {
  const tierLabels = ["Elite", "Tier 2", "Tier 3", "Tier 4", "Tier 5", "Tier 6", "Tier 7", "Tier 8"];

  const positions = [...new Set(consensusAdp.map((r) => r.position).filter(Boolean))] as string[];
  const allTiers: AdpTier[] = [];

  for (const pos of positions) {
    const players = consensusAdp
      .filter((r) => r.position === pos)
      .sort((a, b) => a.overallAdp - b.overallAdp);

    if (players.length === 0) continue;

    const tiers: AdpTier[] = [];
    let currentTier: ConsensusAdpRecord[] = [players[0]];

    for (let i = 1; i < players.length; i++) {
      const prev = players[i - 1];
      const curr = players[i];
      const gap = curr.overallAdp - prev.overallAdp;
      const threshold = tierGapThreshold(prev.overallAdp);

      if (gap >= threshold) {
        tiers.push(toTier(pos, tiers.length + 1, tierLabels, currentTier, tierBasis, gap));
        currentTier = [curr];
      } else {
        currentTier.push(curr);
      }
    }
    if (currentTier.length > 0) {
      tiers.push(toTier(pos, tiers.length + 1, tierLabels, currentTier, tierBasis, null));
    }

    allTiers.push(...tiers);
  }

  return allTiers;
}

function toTier(
  position: string,
  tierNumber: number,
  labels: string[],
  players: ConsensusAdpRecord[],
  tierBasis: AdpTierBasis,
  gapAbove: number | null
): AdpTier {
  const adps = players.map((p) => p.overallAdp);
  return {
    position,
    tierNumber,
    tierLabel: labels[tierNumber - 1] ?? `Tier ${tierNumber}`,
    playerIds: players.map((p) => p.canonicalPlayerId),
    tierBasis,
    adpCeiling: Math.min(...adps),
    adpFloor: Math.max(...adps),
    tierGapAbove: gapAbove !== null ? Math.round(gapAbove * 10) / 10 : null,
  };
}

