import type { BlackbirdLeagueContext } from "@/lib/draft/blackbird-contextual-value";
import type { PlayerRole, PlayerRoleClassification } from "@/lib/projections/player-role-classification";

export type ReplacementBaseline = {
  position: string;
  replacementRank: number;
  replacementMedianPoints: number | null;
  replacementPlayerId: string | null;
  replacementPlayerName: string | null;
  starterDemand: number;
  flexDemand: number;
  benchDemand: number;
  eligiblePlayerCount: number;
  method: "league_roster_slots" | "projection_distribution_fallback";
  dataGaps: string[];
};

export type PlayerPAR = {
  playerId: string;
  position: string;
  medianPoints: number | null;
  replacementMedianPoints: number | null;
  pointsAboveReplacement: number | null;
  parPercentileByPosition: number | null;
  replacementRank: number | null;
  replacementMethod: ReplacementBaseline["method"] | "unavailable";
  role: PlayerRole;
  roleConfidence: PlayerRoleClassification["confidence"];
  reasons: string[];
  dataGaps: string[];
};

export type ReplacementValuePlayer = {
  playerId: string;
  playerName: string;
  position: string;
  medianPoints: number | null;
  drafted?: boolean;
  projectionTrustLabel?: string | null;
  roleClassification: PlayerRoleClassification;
};

export type ReplacementValueModel = {
  baselines: ReplacementBaseline[];
  playerPar: PlayerPAR[];
  diagnostics: {
    totalPlayers: number;
    positions: number;
    baselinesWithRosterSettings: number;
    unavailableBaselines: number;
    playersWithPAR: number;
    playersWithoutPAR: number;
    backupDeweightedCount: number;
    dataGaps: string[];
  };
};

const SCORABLE_POSITIONS = ["QB", "RB", "WR", "TE", "DL", "LB", "DB", "K", "DEF"] as const;
const OFFENSE_FLEX = new Set(["FLEX", "WRRB_FLEX", "WRRBTE_FLEX", "REC_FLEX", "W/R/T"]);
const SUPER_FLEX = new Set(["SUPER_FLEX", "SUPERFLEX", "OP"]);
const IDP_FLEX = new Set(["IDP", "IDP_FLEX", "FLEX_IDP", "DP"]);
const BENCH = new Set(["BN", "BE", "BENCH"]);
const BACKUP_ROLES = new Set<PlayerRole>(["backup", "deep_reserve", "rookie_unknown", "unknown"]);

export function buildReplacementValueModel(input: {
  players: ReplacementValuePlayer[];
  leagueContext?: BlackbirdLeagueContext;
  teamCount?: number | null;
}): ReplacementValueModel {
  const teamCount = finiteNumber(input.teamCount) ?? inferTeamCount(input.leagueContext) ?? 12;
  const roster = parseRosterDemand(input.leagueContext, teamCount);
  const positions = Array.from(new Set(input.players.map((player) => normalizePosition(player.position)).filter((position) => SCORABLE_POSITIONS.includes(position as typeof SCORABLE_POSITIONS[number]))));
  const baselines = positions.map((position) => buildBaseline(position, input.players, roster, teamCount, input.leagueContext));
  const baselineByPosition = new Map(baselines.map((baseline) => [baseline.position, baseline]));
  const parRows = input.players.map((player) => buildPlayerPAR(player, input.players, baselineByPosition.get(normalizePosition(player.position)) ?? null));
  return {
    baselines,
    playerPar: parRows,
    diagnostics: {
      totalPlayers: input.players.length,
      positions: baselines.length,
      baselinesWithRosterSettings: baselines.filter((baseline) => baseline.method === "league_roster_slots").length,
      unavailableBaselines: baselines.filter((baseline) => baseline.replacementMedianPoints === null).length,
      playersWithPAR: parRows.filter((row) => row.pointsAboveReplacement !== null).length,
      playersWithoutPAR: parRows.filter((row) => row.pointsAboveReplacement === null).length,
      backupDeweightedCount: input.players.filter((player) => BACKUP_ROLES.has(player.roleClassification.role)).length,
      dataGaps: Array.from(new Set(baselines.flatMap((baseline) => baseline.dataGaps))).sort(),
    },
  };
}

function buildBaseline(
  position: string,
  players: ReplacementValuePlayer[],
  roster: ReturnType<typeof parseRosterDemand>,
  teamCount: number,
  context?: BlackbirdLeagueContext
): ReplacementBaseline {
  const starterDemand = (roster.direct[position] ?? 0) * teamCount;
  const flexDemand = flexDemandFor(position, roster, context) * teamCount;
  const benchDemand = benchDemandFor(position, roster, context) * teamCount;
  const hasRosterSettings = Boolean(context?.rosterPositions?.length);
  const replacementRank = Math.max(1, Math.ceil(starterDemand + flexDemand + benchDemand));
  const positionPlayers = players
    .filter((player) => normalizePosition(player.position) === position && player.medianPoints !== null)
    .sort((a, b) => (b.medianPoints ?? -Infinity) - (a.medianPoints ?? -Infinity) || a.playerName.localeCompare(b.playerName));
  const eligible = positionPlayers.filter((player) => !isWeakReplacementCandidate(player));
  const pool = eligible.length > 0 ? eligible : positionPlayers;
  const replacement = pool[Math.min(Math.max(replacementRank, 1), pool.length) - 1] ?? pool[pool.length - 1] ?? null;
  const dataGaps = [
    hasRosterSettings ? null : "roster positions",
    context?.scoringSettings ? null : "scoring settings",
    replacement ? null : `${position} replacement player`,
    eligible.length < positionPlayers.length ? "confirmed depth chart for backup deweighting" : null,
  ].filter((gap): gap is string => Boolean(gap));
  return {
    position,
    replacementRank,
    replacementMedianPoints: replacement?.medianPoints ?? null,
    replacementPlayerId: replacement?.playerId ?? null,
    replacementPlayerName: replacement?.playerName ?? null,
    starterDemand: round1(starterDemand),
    flexDemand: round1(flexDemand),
    benchDemand: round1(benchDemand),
    eligiblePlayerCount: pool.length,
    method: hasRosterSettings ? "league_roster_slots" : "projection_distribution_fallback",
    dataGaps,
  };
}

function buildPlayerPAR(player: ReplacementValuePlayer, allPlayers: ReplacementValuePlayer[], baseline: ReplacementBaseline | null): PlayerPAR {
  const median = finiteNumber(player.medianPoints);
  const replacement = baseline?.replacementMedianPoints ?? null;
  const par = median !== null && replacement !== null ? round1(median - replacement) : null;
  const position = normalizePosition(player.position);
  const allPars = allPlayers
    .filter((candidate) => normalizePosition(candidate.position) === position)
    .map((candidate) => {
      const candidateMedian = finiteNumber(candidate.medianPoints);
      return candidateMedian !== null && replacement !== null ? round1(candidateMedian - replacement) : null;
    });
  return {
    playerId: player.playerId,
    position,
    medianPoints: median,
    replacementMedianPoints: replacement,
    pointsAboveReplacement: par,
    parPercentileByPosition: percentile(par, allPars),
    replacementRank: baseline?.replacementRank ?? null,
    replacementMethod: baseline?.method ?? "unavailable",
    role: player.roleClassification.role,
    roleConfidence: player.roleClassification.confidence,
    reasons: [
      baseline ? `${position} replacement baseline is rank ${baseline.replacementRank} by league roster demand.` : null,
      par !== null ? `PAR is season projection minus replacement median (${replacement?.toFixed(1)}).` : null,
      BACKUP_ROLES.has(player.roleClassification.role) ? `Role proxy is ${player.roleClassification.role}; replacement calibration deweights weak role candidates.` : null,
    ].filter((reason): reason is string => Boolean(reason)),
    dataGaps: Array.from(new Set([...(baseline?.dataGaps ?? []), ...player.roleClassification.dataGaps])).sort(),
  };
}

function parseRosterDemand(context: BlackbirdLeagueContext | undefined, teamCount: number) {
  const direct: Record<string, number> = Object.fromEntries(SCORABLE_POSITIONS.map((position) => [position, 0]));
  let offenseFlex = 0;
  let superFlex = 0;
  let idpFlex = 0;
  let bench = 0;
  for (const raw of context?.rosterPositions ?? []) {
    const slot = normalizeRosterSlot(raw);
    if (BENCH.has(slot)) {
      bench += 1;
      continue;
    }
    if (OFFENSE_FLEX.has(slot)) {
      offenseFlex += 1;
      continue;
    }
    if (SUPER_FLEX.has(slot)) {
      superFlex += 1;
      continue;
    }
    if (IDP_FLEX.has(slot)) {
      idpFlex += 1;
      continue;
    }
    const position = normalizeSlotToPosition(slot);
    if (position) direct[position] += 1;
  }
  return { direct, offenseFlex, superFlex, idpFlex, bench, teamCount };
}

function flexDemandFor(position: string, roster: ReturnType<typeof parseRosterDemand>, context?: BlackbirdLeagueContext): number {
  let demand = 0;
  if (position === "RB") demand += roster.offenseFlex * 0.42 + roster.superFlex * 0.08;
  if (position === "WR") demand += roster.offenseFlex * 0.45 + roster.superFlex * 0.08;
  if (position === "TE") demand += roster.offenseFlex * 0.13 + ((context?.tePremium ?? 0) > 0 ? 0.12 : 0);
  if (position === "QB") demand += roster.superFlex * (context?.isSuperflex || context?.isTwoQb ? 0.72 : 0.45);
  if (position === "DL" || position === "LB" || position === "DB") demand += roster.idpFlex / 3;
  return demand;
}

function benchDemandFor(position: string, roster: ReturnType<typeof parseRosterDemand>, context?: BlackbirdLeagueContext): number {
  if (roster.bench <= 0) return 0;
  const bench = roster.bench * 0.22;
  if (position === "QB") return (context?.isSuperflex || context?.isTwoQb) ? bench * 0.16 : bench * 0.08;
  if (position === "RB") return bench * 0.24;
  if (position === "WR") return bench * 0.3;
  if (position === "TE") return bench * (((context?.tePremium ?? 0) > 0) ? 0.12 : 0.08);
  if (position === "DL" || position === "LB" || position === "DB") return bench * 0.08;
  return 0;
}

function isWeakReplacementCandidate(player: ReplacementValuePlayer): boolean {
  return BACKUP_ROLES.has(player.roleClassification.role) || player.projectionTrustLabel === "very_low";
}

function inferTeamCount(context?: BlackbirdLeagueContext): number | null {
  const value = context?.scoringSettings?.teams ?? context?.scoringSettings?.team_count ?? context?.scoringSettings?.num_teams;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeRosterSlot(slot: string): string {
  return slot.trim().toUpperCase().replace(/\s+/g, "_");
}

function normalizeSlotToPosition(slot: string): string | null {
  if (slot === "DST" || slot === "D/ST") return "DEF";
  if (["DE", "DT", "EDGE"].includes(slot)) return "DL";
  if (["CB", "S", "FS", "SS"].includes(slot)) return "DB";
  return SCORABLE_POSITIONS.includes(slot as typeof SCORABLE_POSITIONS[number]) ? slot : null;
}

function normalizePosition(position: string): string {
  const normalized = position.trim().toUpperCase();
  return normalized === "DST" || normalized === "D/ST" ? "DEF" : normalized;
}

function percentile(value: number | null, values: Array<number | null>): number | null {
  if (value === null) return null;
  const finiteValues = values.filter((candidate): candidate is number => candidate !== null && Number.isFinite(candidate));
  if (finiteValues.length <= 1) return 50;
  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  if (max === min) return 50;
  return round1(((value - min) / (max - min)) * 100);
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
