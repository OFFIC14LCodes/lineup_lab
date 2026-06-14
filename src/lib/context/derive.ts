// H8: Blackbird-derived context from H1/H2/H5 historical data.
// These fields are facts (observed from our own data), not projections.
// Do not convert any derived field into a projected future value.

import { buildInferenceEvidence } from "./evidence";
import type { BlackbirdDerivedContext, ContextFieldValue, EvidenceRecord } from "./types";

export type { BlackbirdDerivedContext, EvidenceRecord };

export const DERIVE_VERSION = "h8-derive-v1";

// --------------------------------------------------------------------------
// Observed field builder (from Blackbird's own historical data)
// --------------------------------------------------------------------------

function derivedField<T>(
  value: T | null,
  evidenceId: string,
  inferenceMethod: string,
  observedAt: string
): ContextFieldValue<T> {
  return {
    value,
    valueType: typeof value === "number" ? "number" : "unknown",
    status: value !== null ? "observed" : "unknown",
    confidence: value !== null ? "high" : "unresolved",
    evidenceIds: value !== null ? [evidenceId] : [],
    observedAt: value !== null ? observedAt : null,
    effectiveFrom: null,
    expiresAt: null,
    lastReviewedAt: null,
    inferenceMethod,
    contradictionCount: 0,
  };
}

// --------------------------------------------------------------------------
// Input: aggregated stats for one player in a prior season
// --------------------------------------------------------------------------

export type PlayerSeasonStats = {
  canonicalPlayerId: string;
  season: number;
  position: string | null;

  // From player_weekly_stats (H1)
  games: number;
  totalTargets: number | null;
  totalCarries: number | null;
  teamTotalTargets: number | null;
  teamTotalCarries: number | null;

  // From player_weekly_derived_stats (H2 PBP)
  snapProxy: number | null;    // Estimated from PBP routing participation
  redZoneTargets: number | null;
  redZoneTotalTargets: number | null;
  goalLineCarries: number | null;
  goalLineTotalCarries: number | null;
  teamPassPlays: number | null;
  teamRushPlays: number | null;
  teamEarlyDownPassPlays: number | null;
  teamTotalEarlyDownPlays: number | null;

  // Derived elsewhere
  targetConcentrationGini: number | null; // Gini coefficient of target distribution (optional)
};

export type TeamSeasonStats = {
  teamId: string;
  season: number;
  totalPassPlays: number;
  totalRushPlays: number;
  totalTargets: number;
  totalCarries: number;
  topTargetShare: number | null;    // max single-player target share
};

// --------------------------------------------------------------------------
// Derive context for one player from Blackbird historical data
// --------------------------------------------------------------------------

export function derivePlayerContext(
  playerStats: PlayerSeasonStats,
  teamStats: TeamSeasonStats | null,
  capturedAt: string = new Date().toISOString()
): { context: BlackbirdDerivedContext; evidenceRecords: EvidenceRecord[] } {
  const { canonicalPlayerId, season } = playerStats;
  const method = `h2_pbp_season_${season}`;
  const observedAt = capturedAt;
  const evidenceRecords: EvidenceRecord[] = [];

  function makeEvidence(claim: string): EvidenceRecord {
    const rec = buildInferenceEvidence({
      normalizedClaim: claim,
      playerId: canonicalPlayerId,
      inferenceMethod: method,
      season,
      capturedAt,
    });
    evidenceRecords.push(rec);
    return rec;
  }

  // Target share
  const targetShare =
    playerStats.totalTargets !== null && teamStats && teamStats.totalTargets > 0
      ? Math.round((playerStats.totalTargets / teamStats.totalTargets) * 1000) / 1000
      : null;
  const targetShareEvidence = makeEvidence(
    `${season} target share: ${targetShare !== null ? (targetShare * 100).toFixed(1) + "%" : "unknown"}`
  );

  // Carry share
  const carryShare =
    playerStats.totalCarries !== null && teamStats && teamStats.totalCarries > 0
      ? Math.round((playerStats.totalCarries / teamStats.totalCarries) * 1000) / 1000
      : null;
  const carryShareEvidence = makeEvidence(
    `${season} carry share: ${carryShare !== null ? (carryShare * 100).toFixed(1) + "%" : "unknown"}`
  );

  // Red zone target share
  const redZoneShare =
    playerStats.redZoneTargets !== null && playerStats.redZoneTotalTargets !== null && playerStats.redZoneTotalTargets > 0
      ? Math.round((playerStats.redZoneTargets / playerStats.redZoneTotalTargets) * 1000) / 1000
      : null;
  const redZoneEvidence = makeEvidence(
    `${season} red zone target share: ${redZoneShare !== null ? (redZoneShare * 100).toFixed(1) + "%" : "unknown"}`
  );

  // Goal line carry share
  const goalLineShare =
    playerStats.goalLineCarries !== null && playerStats.goalLineTotalCarries !== null && playerStats.goalLineTotalCarries > 0
      ? Math.round((playerStats.goalLineCarries / playerStats.goalLineTotalCarries) * 1000) / 1000
      : null;
  const goalLineEvidence = makeEvidence(
    `${season} goal line carry share: ${goalLineShare !== null ? (goalLineShare * 100).toFixed(1) + "%" : "unknown"}`
  );

  // Team pass rate
  const teamPassRate =
    playerStats.teamPassPlays !== null && playerStats.teamRushPlays !== null
      ? Math.round(
          (playerStats.teamPassPlays / (playerStats.teamPassPlays + playerStats.teamRushPlays)) * 1000
        ) / 1000
      : null;
  const passRateEvidence = makeEvidence(
    `${season} team pass rate: ${teamPassRate !== null ? (teamPassRate * 100).toFixed(1) + "%" : "unknown"}`
  );

  // Team rush rate
  const teamRushRate = teamPassRate !== null ? Math.round((1 - teamPassRate) * 1000) / 1000 : null;

  // Early down pass rate
  const earlyDownPassRate =
    playerStats.teamEarlyDownPassPlays !== null && playerStats.teamTotalEarlyDownPlays !== null && playerStats.teamTotalEarlyDownPlays > 0
      ? Math.round(
          (playerStats.teamEarlyDownPassPlays / playerStats.teamTotalEarlyDownPlays) * 1000
        ) / 1000
      : null;
  const earlyDownEvidence = makeEvidence(
    `${season} team early-down pass rate: ${earlyDownPassRate !== null ? (earlyDownPassRate * 100).toFixed(1) + "%" : "unknown"}`
  );

  // Target concentration
  const targetConcentration: "concentrated" | "distributed" | "unknown" =
    teamStats?.topTargetShare !== null && teamStats?.topTargetShare !== undefined
      ? teamStats.topTargetShare >= 0.28 ? "concentrated" : "distributed"
      : "unknown";
  const concentrationEvidence = makeEvidence(
    `${season} team target concentration: ${targetConcentration}`
  );

  // Snap proxy (from PBP routing)
  const snapEvidence = makeEvidence(
    `${season} snap proxy from PBP routing: ${playerStats.snapProxy !== null ? playerStats.snapProxy.toFixed(0) : "unavailable"}`
  );

  // Backlogs: fields that require new PBP columns, new data sources, or new joins.
  // All are documented as explicit unknowns — they are never silently absent.
  const backlogs = [
    "priorTeamPassRate: team_pass_plays not stored in nflverse player_weekly_stats; requires PBP team-play aggregation",
    "priorSnapProxy: snap_proxy not in H2 PBP derivation output (rec_td_40p etc. only)",
    "priorRedZoneShare: rz_targets not in H2 PBP derivation output",
    "priorGoalLineShare: gl_carries not in H2 PBP derivation output",
    "route_participation_rate: requires PBP route-running column not yet in H2",
    "positional_usage_breakdown: requires play-type classification expansion",
    "home_away_splits: requires game-site join across H1+H5",
    "neutral_situation_tendencies: requires game-state classification",
  ];

  const context: BlackbirdDerivedContext = {
    priorSnapProxy: derivedField(playerStats.snapProxy, snapEvidence.evidenceId, method, observedAt),
    priorTargetShare: derivedField(targetShare, targetShareEvidence.evidenceId, method, observedAt),
    priorCarryShare: derivedField(carryShare, carryShareEvidence.evidenceId, method, observedAt),
    priorRedZoneShare: derivedField(redZoneShare, redZoneEvidence.evidenceId, method, observedAt),
    priorGoalLineShare: derivedField(goalLineShare, goalLineEvidence.evidenceId, method, observedAt),
    priorTeamPassRate: derivedField(teamPassRate, passRateEvidence.evidenceId, method, observedAt),
    priorTeamRushRate: derivedField(teamRushRate, passRateEvidence.evidenceId, method, observedAt),
    priorEarlyDownPassRate: derivedField(earlyDownPassRate, earlyDownEvidence.evidenceId, method, observedAt),
    priorTargetConcentration: {
      value: targetConcentration,
      valueType: "string",
      status: targetConcentration !== "unknown" ? "inferred" : "unknown",
      confidence: targetConcentration !== "unknown" ? "moderate" : "unresolved",
      evidenceIds: [concentrationEvidence.evidenceId],
      observedAt,
      effectiveFrom: null,
      expiresAt: null,
      lastReviewedAt: null,
      inferenceMethod: `${method}_top_target_share`,
      contradictionCount: 0,
    },
    priorPositionalUsage: {
      value: null,
      valueType: "unknown",
      status: "unknown",
      confidence: "unresolved",
      evidenceIds: [],
      observedAt: null,
      effectiveFrom: null,
      expiresAt: null,
      lastReviewedAt: null,
      inferenceMethod: null,
      contradictionCount: 0,
    },
    derivedSeason: season,
    derivedFromDataVersion: DERIVE_VERSION,
    backlogs,
  };

  return { context, evidenceRecords };
}

// --------------------------------------------------------------------------
// Derive context from H1 weekly stats rows
// Called by the dry-run script; not a live ingestion path
// --------------------------------------------------------------------------

export type WeeklyStatRow = {
  player_id: string;
  season: number;
  week: number;
  stats_json: Record<string, number>;
};

export type DerivedStatRow = {
  player_id: string;
  season: number;
  week: number;
  stats_json: Record<string, number>;
};

export function aggregatePlayerSeasonStats(
  playerId: string,
  weeklyRows: WeeklyStatRow[],
  derivedRows: DerivedStatRow[],
  season: number,
  position: string | null
): PlayerSeasonStats {
  const playerWeekly = weeklyRows.filter(
    (r) => r.player_id === playerId && r.season === season
  );
  // derivedRows accepted for API compatibility; all derived columns are documented backlogs
  const _playerDerived = derivedRows.filter(
    (r) => r.player_id === playerId && r.season === season
  );
  void _playerDerived;
  // games = distinct weeks played (not row count — some seasons have duplicate provider rows)
  const distinctWeeks = new Set(playerWeekly.map((r) => r.week));

  const sum = (rows: Array<{ stats_json: Record<string, number> }>, key: string) =>
    rows.reduce((acc, r) => acc + (r.stats_json[key] ?? 0), 0);

  const sumAll = (rows: Array<{ stats_json: Record<string, number> }>, keys: string[]) =>
    keys.reduce((acc, k) => acc + sum(rows, k), 0);

  // nflverse canonical stat keys (from normalize.ts STAT_COLUMN_MAP):
  //   targets → rec_tgt   (not "targets")
  //   carries → rush_att  (not "carries")
  const totalTargets = sumAll(playerWeekly, ["rec_tgt"]);
  const totalCarries = sumAll(playerWeekly, ["rush_att"]);

  // Team totals — caller must provide team aggregates separately for share computation.
  // team_pass_plays and team_rush_plays are NOT stored in nflverse player_weekly_stats —
  // they require PBP-level team aggregation which is not yet implemented in H2.
  // These will always be null for nflverse data; teamPassRate will be unknown.
  const teamPassPlays: number | null = null;
  const teamRushPlays: number | null = null;

  // snap_proxy, rz_targets, gl_carries: H2 PBP derivation only produces
  // rec_td_40p, rec_td_50p, rush_td_40p, rush_td_50p, pass_pick6, fum_ret_td.
  // Snap, red-zone, and goal-line columns are documented backlogs (not available yet).
  const snapProxy: number | null = null;
  const redZoneTargets: number | null = null;
  const goalLineCarries: number | null = null;

  return {
    canonicalPlayerId: playerId,
    season,
    position,
    games: distinctWeeks.size,
    totalTargets: totalTargets || null,
    totalCarries: totalCarries || null,
    teamTotalTargets: null,  // Caller fills from team aggregation
    teamTotalCarries: null,
    snapProxy,
    redZoneTargets,
    redZoneTotalTargets: null, // Caller fills
    goalLineCarries,
    goalLineTotalCarries: null, // Caller fills
    teamPassPlays,
    teamRushPlays,
    teamEarlyDownPassPlays: null, // Requires game-state classification
    teamTotalEarlyDownPlays: null,
    targetConcentrationGini: null,
  };
}
