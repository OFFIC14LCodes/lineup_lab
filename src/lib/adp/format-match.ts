import type {
  AdpFormatMatchScore,
  AdpFormatProfile,
  LeagueFormatInput,
  PositionFormatMatchScore,
} from "./types";

// Weight each dimension by how much it distorts relative player value.
// PPR and draft type are the biggest value drivers; superflex affects QB tiers significantly.
const WEIGHTS = {
  pprValue: 0.30,
  draftType: 0.25,
  superflex: 0.20,
  tePremium: 0.10,
  teamCount: 0.10,
  bestBall: 0.05,
} as const;

type DimensionWeights = { pprValue: number; draftType: number; superflex: number; tePremium: number; teamCount: number; bestBall: number };

// Position-specific dimension weights.
// QB values hinge most on Superflex; TE values on TE-premium; RB/WR on PPR.
const POSITION_WEIGHTS: Record<string, DimensionWeights> = {
  QB: { pprValue: 0.08, draftType: 0.20, superflex: 0.48, tePremium: 0.02, teamCount: 0.17, bestBall: 0.05 },
  RB: { pprValue: 0.42, draftType: 0.25, superflex: 0.08, tePremium: 0.03, teamCount: 0.17, bestBall: 0.05 },
  WR: { pprValue: 0.42, draftType: 0.25, superflex: 0.05, tePremium: 0.06, teamCount: 0.17, bestBall: 0.05 },
  TE: { pprValue: 0.22, draftType: 0.20, superflex: 0.05, tePremium: 0.38, teamCount: 0.10, bestBall: 0.05 },
};

// Compute raw dimension scores (0–1) for snapshot vs league.
// Extracted so both scoreFormatMatch and scoreFormatMatchByPosition can share it.
function computeDimensionScores(
  snapshotFormat: AdpFormatProfile,
  league: LeagueFormatInput
): {
  pprValue: number;
  draftType: number;
  superflex: number;
  tePremium: number;
  teamCount: number;
  bestBall: number;
} {
  const pprDiff = Math.abs(snapshotFormat.pprValue - league.pprValue);
  const teDiff = Math.abs(snapshotFormat.tePremiumValue - league.tePremiumValue);
  const teamDiff = Math.abs(snapshotFormat.teamCount - league.teamCount);
  return {
    pprValue: Math.max(0, 1 - pprDiff / 0.5),
    draftType: snapshotFormat.isDynasty === league.isDynasty ? 1 : 0,
    superflex: snapshotFormat.isSuperflex === league.isSuperflex ? 1 : 0.3,
    tePremium: Math.max(0, 1 - teDiff / 0.5),
    teamCount: Math.max(0, 1 - Math.max(0, teamDiff - 2) / 4),
    bestBall: snapshotFormat.isBestBall === league.isBestBall ? 1 : 0.85,
  };
}

export function scoreFormatMatch(
  snapshotId: string,
  snapshotFormat: AdpFormatProfile,
  league: LeagueFormatInput
): AdpFormatMatchScore {
  const d = computeDimensionScores(snapshotFormat, league);
  const teamDiff = Math.abs(snapshotFormat.teamCount - league.teamCount);

  const overallScore = Math.round((
    d.pprValue * WEIGHTS.pprValue +
    d.draftType * WEIGHTS.draftType +
    d.superflex * WEIGHTS.superflex +
    d.tePremium * WEIGHTS.tePremium +
    d.teamCount * WEIGHTS.teamCount +
    d.bestBall * WEIGHTS.bestBall
  ) * 1000) / 1000;

  const warnings: string[] = [];
  if (d.pprValue < 0.5) {
    warnings.push(
      `PPR mismatch: snapshot=${snapshotFormat.pprValue}, league=${league.pprValue} — values not comparable`
    );
  }
  if (d.draftType === 0) {
    warnings.push(
      `Draft type mismatch: snapshot=${snapshotFormat.isDynasty ? "dynasty" : "redraft"}, ` +
      `league=${league.isDynasty ? "dynasty" : "redraft"} — ADP not applicable`
    );
  }
  if (d.superflex < 1) {
    warnings.push(
      `Superflex mismatch: snapshot=${snapshotFormat.isSuperflex}, league=${league.isSuperflex} — QB tiers differ`
    );
  }
  if (teamDiff > 4) {
    warnings.push(`Team count difference: snapshot=${snapshotFormat.teamCount}, league=${league.teamCount}`);
  }

  return {
    snapshotId,
    leagueId: league.leagueId,
    overallScore,
    dimensionScores: {
      pprValue: Math.round(d.pprValue * 1000) / 1000,
      draftType: d.draftType,
      superflex: Math.round(d.superflex * 1000) / 1000,
      tePremium: Math.round(d.tePremium * 1000) / 1000,
      teamCount: Math.round(d.teamCount * 1000) / 1000,
      bestBall: d.bestBall,
    },
    isCompatible: overallScore >= 0.55,
    warnings,
  };
}

// Position-specific format match scores.
// Returns one entry per position (QB/RB/WR/TE).
// Use these to surface position-level warnings even when the overall score is acceptable.
export function scoreFormatMatchByPosition(
  snapshotFormat: AdpFormatProfile,
  league: LeagueFormatInput
): PositionFormatMatchScore[] {
  const d = computeDimensionScores(snapshotFormat, league);
  const teamDiff = Math.abs(snapshotFormat.teamCount - league.teamCount);

  return (["QB", "RB", "WR", "TE"] as const).map((pos) => {
    const w = POSITION_WEIGHTS[pos] ?? WEIGHTS;
    const score = Math.round((
      d.pprValue * w.pprValue +
      d.draftType * w.draftType +
      d.superflex * w.superflex +
      d.tePremium * w.tePremium +
      d.teamCount * w.teamCount +
      d.bestBall * w.bestBall
    ) * 1000) / 1000;

    const warnings: string[] = [];

    if (pos === "QB" && d.superflex < 1) {
      warnings.push(
        `Superflex mismatch — QB tier values diverge (snapshot=${snapshotFormat.isSuperflex}, league=${league.isSuperflex})`
      );
    }
    if (pos === "TE" && d.tePremium < 1) {
      warnings.push(
        `TE-premium mismatch — TE values shift (snapshot=${snapshotFormat.tePremiumValue}, league=${league.tePremiumValue})`
      );
    }
    if ((pos === "RB" || pos === "WR") && d.pprValue < 0.5) {
      warnings.push(
        `PPR mismatch — ${pos} values not comparable (snapshot=${snapshotFormat.pprValue}, league=${league.pprValue})`
      );
    }
    if (teamDiff > 4) {
      warnings.push(
        `Team count difference (${snapshotFormat.teamCount} vs ${league.teamCount}) — positional scarcity shifts`
      );
    }

    return { position: pos, score, warnings };
  });
}

// Score all snapshots against a league and return sorted best-first.
export function rankSnapshotsByFormatMatch(
  snapshots: Array<{ id: string; formatProfile: AdpFormatProfile }>,
  league: LeagueFormatInput
): AdpFormatMatchScore[] {
  return snapshots
    .map((s) => scoreFormatMatch(s.id, s.formatProfile, league))
    .sort((a, b) => b.overallScore - a.overallScore);
}
