import type {
  AdpProviderContribution,
  ConsensusAdpBreakdown,
  ConsensusAdpRecord,
  ConsensusMarketConfidence,
  PlayerAdpRecord,
} from "./types";

export type SnapshotContribution = {
  snapshotId: string;
  provider: string;               // e.g. "mfl", "fantasypros"
  capturedAt: string;             // ISO8601; used for recency weight
  formatMatchScore: number;       // 0–1 from scoreFormatMatch
  sourceConfidenceScore: number;  // 0–1; "high"=1, "medium"=0.75, "low"=0.5, "unknown"=0.4
  sampleSize: number | null;
  records: PlayerAdpRecord[];
};

// Recency weight: exponential decay, half-life = 21 days.
function recencyWeight(capturedAt: string, referenceDate: Date): number {
  const diffMs = referenceDate.getTime() - new Date(capturedAt).getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 1; // future-dated snapshot treated as current
  const halfLifeDays = 21;
  return Math.exp(-0.693 * diffDays / halfLifeDays);
}

// Sample-size weight: sigmoidal. Diminishing returns above 500 drafts.
function sampleSizeWeight(size: number | null): number {
  if (size === null) return 0.6; // unknown — modest discount
  if (size <= 0) return 0.3;
  return 1 - 1 / (1 + size / 200);
}

function combinedWeight(
  snap: SnapshotContribution,
  now: Date
): number {
  const rw = recencyWeight(snap.capturedAt, now);
  const fw = snap.formatMatchScore;
  const sw = sampleSizeWeight(snap.sampleSize);
  const cw = snap.sourceConfidenceScore;
  // Multiplicative: all factors must be reasonable for the weight to be meaningful
  return rw * fw * sw * cw;
}

// Build consensus ADP for all players present in at least one contribution.
// Individual snapshot records are preserved separately per spec.
export function buildConsensusAdp(
  contributions: SnapshotContribution[],
  referenceDate: Date = new Date()
): ConsensusAdpRecord[] {
  // Group records by canonicalPlayerId (resolved players only)
  const byPlayer = new Map<string, Array<{ record: PlayerAdpRecord; snap: SnapshotContribution; weight: number }>>();

  for (const snap of contributions) {
    const w = combinedWeight(snap, referenceDate);
    if (w <= 0) continue;
    for (const rec of snap.records) {
      if (!rec.canonicalPlayerId) continue;
      if (!byPlayer.has(rec.canonicalPlayerId)) byPlayer.set(rec.canonicalPlayerId, []);
      byPlayer.get(rec.canonicalPlayerId)!.push({ record: rec, snap, weight: w });
    }
  }

  const results: ConsensusAdpRecord[] = [];

  for (const [playerId, entries] of byPlayer) {
    if (entries.length === 0) continue;

    const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
    const weightedAdp = entries.reduce((s, e) => s + e.record.overallAdp * e.weight, 0) / totalWeight;

    // Weighted positional ADP (only entries that have it)
    const posEntries = entries.filter((e) => e.record.positionalAdp !== null);
    const weightedPosAdp = posEntries.length > 0
      ? posEntries.reduce((s, e) => s + e.record.positionalAdp! * e.weight, 0) /
        posEntries.reduce((s, e) => s + e.weight, 0)
      : null;

    // Cross-snapshot std dev (only meaningful with 2+ sources)
    let adpStddev: number | null = null;
    if (entries.length > 1) {
      const variance = entries.reduce(
        (s, e) => s + e.weight * Math.pow(e.record.overallAdp - weightedAdp, 2),
        0
      ) / totalWeight;
      adpStddev = Math.round(Math.sqrt(variance) * 100) / 100;
    }

    const minPick = entries.reduce(
      (m, e) => (e.record.minPick !== null ? Math.min(m ?? Infinity, e.record.minPick) : m),
      null as number | null
    );
    const maxPick = entries.reduce(
      (m, e) => (e.record.maxPick !== null ? Math.max(m ?? -Infinity, e.record.maxPick) : m),
      null as number | null
    );

    const totalSampleSize = entries.reduce(
      (s, e) => (e.snap.sampleSize !== null ? (s ?? 0) + e.snap.sampleSize : s),
      null as number | null
    );

    const first = entries[0].record;
    const avgRecencyWeight = entries.reduce((s, e) => s + recencyWeight(e.snap.capturedAt, referenceDate) * e.weight, 0) / totalWeight;
    const avgFormatWeight = entries.reduce((s, e) => s + e.snap.formatMatchScore * e.weight, 0) / totalWeight;

    results.push({
      canonicalPlayerId: playerId,
      playerName: first.resolvedName ?? first.rawName,
      position: first.resolvedPosition ?? first.rawPosition,
      nflTeam: first.resolvedTeam ?? first.rawTeam,
      isRookie: first.isRookie,
      hasHistoricalProfile: first.hasHistoricalProfile,
      overallAdp: Math.round(weightedAdp * 10) / 10,
      overallRank: 0,                    // Assigned after sort below
      positionalAdp: weightedPosAdp !== null ? Math.round(weightedPosAdp * 10) / 10 : null,
      positionalRank: null,              // Assigned after sort below
      adpStddev,
      minPick: minPick === Infinity || minPick === null ? null : minPick,
      maxPick: maxPick === -Infinity || maxPick === null ? null : maxPick,
      providerCount: new Set(entries.map((e) => e.snap.snapshotId)).size,
      totalSampleSize,
      recencyWeight: Math.round(avgRecencyWeight * 1000) / 1000,
      formatWeight: Math.round(avgFormatWeight * 1000) / 1000,
      sourceSnapshots: [...new Set(entries.map((e) => e.snap.snapshotId))],
    });
  }

  // Assign overall ranks
  results.sort((a, b) => a.overallAdp - b.overallAdp);
  results.forEach((r, i) => { r.overallRank = i + 1; });

  // Assign positional ranks
  const posGroups = new Map<string, ConsensusAdpRecord[]>();
  for (const r of results) {
    if (!r.position) continue;
    const pos = r.position.toUpperCase();
    if (!posGroups.has(pos)) posGroups.set(pos, []);
    posGroups.get(pos)!.push(r);
  }
  for (const group of posGroups.values()) {
    group.sort((a, b) => a.overallAdp - b.overallAdp);
    group.forEach((r, i) => { r.positionalRank = i + 1; });
  }

  return results;
}

// --------------------------------------------------------------------------
// Extended consensus with per-provider breakdown
// --------------------------------------------------------------------------

export type ConsensusAdpResult = {
  records: ConsensusAdpRecord[];
  // Keyed by canonicalPlayerId
  breakdowns: Map<string, ConsensusAdpBreakdown>;
};

function classifyMarketConfidence(
  providerCount: number,
  totalSampleSize: number | null,
  providerDisagreement: number | null
): ConsensusMarketConfidence {
  if (providerCount >= 2 && (totalSampleSize === null || totalSampleSize >= 300) && (providerDisagreement === null || providerDisagreement <= 18)) {
    return "high";
  }
  if (providerCount >= 2 || (totalSampleSize !== null && totalSampleSize >= 300)) {
    return "medium";
  }
  return "low";
}

// Like buildConsensusAdp but also returns per-provider contribution breakdowns.
// Use this when you need to show provider disagreement on the board.
export function buildConsensusAdpWithBreakdown(
  contributions: SnapshotContribution[],
  referenceDate: Date = new Date()
): ConsensusAdpResult {
  const byPlayer = new Map<
    string,
    Array<{ record: PlayerAdpRecord; snap: SnapshotContribution; weight: number }>
  >();

  for (const snap of contributions) {
    const w = combinedWeight(snap, referenceDate);
    if (w <= 0) continue;
    for (const rec of snap.records) {
      if (!rec.canonicalPlayerId) continue;
      if (!byPlayer.has(rec.canonicalPlayerId)) byPlayer.set(rec.canonicalPlayerId, []);
      byPlayer.get(rec.canonicalPlayerId)!.push({ record: rec, snap, weight: w });
    }
  }

  const records: ConsensusAdpRecord[] = [];
  const breakdowns = new Map<string, ConsensusAdpBreakdown>();

  for (const [playerId, entries] of byPlayer) {
    if (entries.length === 0) continue;

    const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
    const weightedAdp = entries.reduce((s, e) => s + e.record.overallAdp * e.weight, 0) / totalWeight;

    const posEntries = entries.filter((e) => e.record.positionalAdp !== null);
    const weightedPosAdp =
      posEntries.length > 0
        ? posEntries.reduce((s, e) => s + e.record.positionalAdp! * e.weight, 0) /
          posEntries.reduce((s, e) => s + e.weight, 0)
        : null;

    let adpStddev: number | null = null;
    if (entries.length > 1) {
      const variance =
        entries.reduce((s, e) => s + e.weight * Math.pow(e.record.overallAdp - weightedAdp, 2), 0) / totalWeight;
      adpStddev = Math.round(Math.sqrt(variance) * 100) / 100;
    }

    const minPick = entries.reduce(
      (m, e) => (e.record.minPick !== null ? Math.min(m ?? Infinity, e.record.minPick) : m),
      null as number | null
    );
    const maxPick = entries.reduce(
      (m, e) => (e.record.maxPick !== null ? Math.max(m ?? -Infinity, e.record.maxPick) : m),
      null as number | null
    );
    const totalSampleSize = entries.reduce(
      (s, e) => (e.snap.sampleSize !== null ? (s ?? 0) + e.snap.sampleSize : s),
      null as number | null
    );

    const first = entries[0].record;
    const avgRecencyWeight =
      entries.reduce((s, e) => s + recencyWeight(e.snap.capturedAt, referenceDate) * e.weight, 0) / totalWeight;
    const avgFormatWeight =
      entries.reduce((s, e) => s + e.snap.formatMatchScore * e.weight, 0) / totalWeight;

    records.push({
      canonicalPlayerId: playerId,
      playerName: first.resolvedName ?? first.rawName,
      position: first.resolvedPosition ?? first.rawPosition,
      nflTeam: first.resolvedTeam ?? first.rawTeam,
      isRookie: first.isRookie,
      hasHistoricalProfile: first.hasHistoricalProfile,
      overallAdp: Math.round(weightedAdp * 10) / 10,
      overallRank: 0,
      positionalAdp: weightedPosAdp !== null ? Math.round(weightedPosAdp * 10) / 10 : null,
      positionalRank: null,
      adpStddev,
      minPick: minPick === Infinity || minPick === null ? null : minPick,
      maxPick: maxPick === -Infinity || maxPick === null ? null : maxPick,
      providerCount: new Set(entries.map((e) => e.snap.snapshotId)).size,
      totalSampleSize,
      recencyWeight: Math.round(avgRecencyWeight * 1000) / 1000,
      formatWeight: Math.round(avgFormatWeight * 1000) / 1000,
      sourceSnapshots: [...new Set(entries.map((e) => e.snap.snapshotId))],
    });

    // Build per-provider breakdown
    const allAdps = entries.map((e) => e.record.overallAdp);
    const providerDisagreement =
      entries.length > 1 ? Math.round((Math.max(...allAdps) - Math.min(...allAdps)) * 10) / 10 : null;

    const dates = entries.map((e) => e.snap.capturedAt).sort();

    const providerContributions: AdpProviderContribution[] = entries.map((e) => ({
      snapshotId: e.snap.snapshotId,
      provider: e.snap.provider,
      capturedAt: e.snap.capturedAt,
      overallAdp: e.record.overallAdp,
      effectiveWeight: totalWeight > 0 ? Math.round((e.weight / totalWeight) * 1000) / 1000 : 0,
    }));

    breakdowns.set(playerId, {
      canonicalPlayerId: playerId,
      providerContributions,
      providerDisagreement,
      newestSourceDate: dates[dates.length - 1] ?? null,
      oldestSourceDate: dates[0] ?? null,
      marketConfidence: classifyMarketConfidence(
        providerContributions.length,
        totalSampleSize,
        providerDisagreement
      ),
    });
  }

  // Assign overall ranks
  records.sort((a, b) => a.overallAdp - b.overallAdp);
  records.forEach((r, i) => { r.overallRank = i + 1; });

  // Assign positional ranks
  const posGroups = new Map<string, ConsensusAdpRecord[]>();
  for (const r of records) {
    if (!r.position) continue;
    const pos = r.position.toUpperCase();
    if (!posGroups.has(pos)) posGroups.set(pos, []);
    posGroups.get(pos)!.push(r);
  }
  for (const group of posGroups.values()) {
    group.sort((a, b) => a.overallAdp - b.overallAdp);
    group.forEach((r, i) => { r.positionalRank = i + 1; });
  }

  return { records, breakdowns };
}
