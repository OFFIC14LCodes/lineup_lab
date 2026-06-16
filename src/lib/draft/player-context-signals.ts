import type { PlayerSituationContext } from "@/lib/draft/blackbird-contextual-value";

export type PlayerContextConfidence = "very_low" | "low" | "medium" | "high";
export type PlayerContextEnvironmentLabel = "positive" | "neutral" | "negative" | "unknown";
export type PlayerContextRiskLabel = "low" | "medium" | "high" | "unknown";
export type PlayerContextRoleStabilityLabel = "low" | "medium" | "high" | "unknown";
export type PlayerContextDepthChartRole = "starter" | "committee" | "rotational" | "backup" | "rookie_unknown" | "unknown";

export type PlayerContextSignals = {
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
  age: number | null;
  yearsExperience: number | null;
  depthChartRole: PlayerContextDepthChartRole;
  projectedSnapShare: number | null;
  coachingEnvironment: {
    score: number | null;
    label: PlayerContextEnvironmentLabel;
    reasons: string[];
  };
  teamEnvironment: {
    score: number | null;
    label: PlayerContextEnvironmentLabel;
    reasons: string[];
  };
  injuryRisk: {
    label: PlayerContextRiskLabel;
    reasons: string[];
  };
  roleStability: {
    label: PlayerContextRoleStabilityLabel;
    reasons: string[];
  };
  dataSources: string[];
  dataGaps: string[];
  confidence: PlayerContextConfidence;
};

export type PlayerContextSignalInput = {
  playerId?: string | null;
  playerName?: string | null;
  position?: string | null;
  team?: string | null;
  age?: number | null;
  yearsExperience?: number | null;
  years_exp?: number | null;
  projectionConfidence?: string | null;
  matchStatus?: string | null;
  unresolvedIdentity?: boolean | null;
  isRookie?: boolean | null;
  historicalGamesPlayed?: number | null;
  historicalGamesPossible?: number | null;
  weeklyStatTotals?: Array<number | null | undefined> | null;
  projectedVolume?: number | null;
  sameTeamPositionProjectedVolumes?: Array<number | null | undefined> | null;
  actualSnapShare?: number | null;
  dataSources?: string[] | null;
};

export type PlayerContextSignalSummary = {
  totalPlayers: number;
  playersWithAge: number;
  playersWithYearsExperience: number;
  playersWithInferredRole: number;
  playersWithProjectedSnapShare: number;
  playersWithCoachingEnvironmentScore: number;
  playersWithInjuryRisk: number;
  playersWithRoleStability: number;
  topDataGaps: Array<{ gap: string; count: number }>;
  confidenceDistribution: Record<PlayerContextConfidence, number>;
};

const VALID_CONTEXT_ROLES: PlayerContextDepthChartRole[] = ["starter", "committee", "rotational", "backup", "rookie_unknown", "unknown"];

export function buildPlayerContextSignals(input: PlayerContextSignalInput): PlayerContextSignals {
  const playerId = input.playerId ?? "";
  const playerName = input.playerName ?? "Unknown";
  const position = normalizePosition(input.position ?? "UNK");
  const age = finiteNumber(input.age);
  const yearsExperience = finiteNumber(input.yearsExperience) ?? finiteNumber(input.years_exp);
  const dataSources = unique([
    ...(input.dataSources ?? []),
    age !== null ? "player age" : null,
    yearsExperience !== null ? "years experience" : null,
    finiteNumber(input.historicalGamesPlayed) !== null ? "historical games played" : null,
    input.weeklyStatTotals?.some((value) => finiteNumber(value) !== null) ? "historical weekly stat consistency" : null,
    finiteNumber(input.projectedVolume) !== null ? "projected volume" : null,
    finiteNumber(input.actualSnapShare) !== null ? "actual snap share" : null,
    input.projectionConfidence ? "projection confidence" : null,
    input.matchStatus ? "identity resolution" : null,
  ]);

  const roleStability = deriveRoleStability(input);
  const injuryRisk = deriveInjuryRisk(input);
  const depthChartRole = deriveDepthChartRole(input, yearsExperience);
  const projectedSnapShare = normalizeShare(input.actualSnapShare);
  const dataGaps = unique([
    age === null ? "age" : null,
    yearsExperience === null ? "years experience" : null,
    depthChartRole === "unknown" || depthChartRole === "rookie_unknown" ? "confirmed depth chart role" : null,
    projectedSnapShare === null ? "actual snap share" : null,
    "coaching environment",
    "team environment",
    injuryRisk.label === "unknown" ? "confirmed injury status" : null,
    roleStability.label === "unknown" ? "role stability" : null,
    input.unresolvedIdentity || input.matchStatus === "unmatched" || input.matchStatus === "ambiguous" ? "resolved player identity" : null,
  ]);

  return {
    playerId,
    playerName,
    position,
    team: input.team ?? null,
    age,
    yearsExperience,
    depthChartRole,
    projectedSnapShare,
    coachingEnvironment: {
      score: null,
      label: "unknown",
      reasons: ["No approved coaching data source is connected; value model should use neutral default."],
    },
    teamEnvironment: {
      score: null,
      label: "unknown",
      reasons: ["No approved team environment model is connected; value model should use neutral default."],
    },
    injuryRisk,
    roleStability,
    dataSources,
    dataGaps,
    confidence: confidenceFor({ input, dataGaps, roleStability, injuryRisk, depthChartRole }),
  };
}

export function buildPlayerContextSignalSummary(signals: PlayerContextSignals[]): PlayerContextSignalSummary {
  const topDataGaps = new Map<string, number>();
  const confidenceDistribution: Record<PlayerContextConfidence, number> = {
    very_low: 0,
    low: 0,
    medium: 0,
    high: 0,
  };
  for (const signal of signals) {
    confidenceDistribution[signal.confidence] += 1;
    for (const gap of signal.dataGaps) topDataGaps.set(gap, (topDataGaps.get(gap) ?? 0) + 1);
  }
  return {
    totalPlayers: signals.length,
    playersWithAge: signals.filter((signal) => signal.age !== null).length,
    playersWithYearsExperience: signals.filter((signal) => signal.yearsExperience !== null).length,
    playersWithInferredRole: signals.filter((signal) => !["unknown", "rookie_unknown"].includes(signal.depthChartRole)).length,
    playersWithProjectedSnapShare: signals.filter((signal) => signal.projectedSnapShare !== null).length,
    playersWithCoachingEnvironmentScore: signals.filter((signal) => signal.coachingEnvironment.score !== null).length,
    playersWithInjuryRisk: signals.filter((signal) => signal.injuryRisk.label !== "unknown").length,
    playersWithRoleStability: signals.filter((signal) => signal.roleStability.label !== "unknown").length,
    topDataGaps: [...topDataGaps.entries()]
      .map(([gap, count]) => ({ gap, count }))
      .sort((a, b) => b.count - a.count || a.gap.localeCompare(b.gap))
      .slice(0, 12),
    confidenceDistribution,
  };
}

export function playerContextSignalsToSituationContext(signals: PlayerContextSignals): Partial<PlayerSituationContext> {
  return {
    playerId: signals.playerId,
    age: signals.age,
    yearsExperience: signals.yearsExperience,
    team: signals.team,
    position: signals.position,
    depthChartRole: toSituationDepthChartRole(signals.depthChartRole),
    projectedSnapShare: signals.projectedSnapShare,
    coachingEnvironmentScore: signals.coachingEnvironment.score,
    teamOffenseEnvironmentScore: signals.teamEnvironment.score,
    teamDefenseEnvironmentScore: signals.teamEnvironment.score,
    roleStability: signals.roleStability.label,
    injuryRisk: signals.injuryRisk.label,
    dataGaps: signals.dataGaps,
  };
}

export function findPlayerContextSignalDataGaps(signals: PlayerContextSignals[]): string[] {
  return buildPlayerContextSignalSummary(signals).topDataGaps.map((row) => row.gap);
}

function deriveDepthChartRole(input: PlayerContextSignalInput, yearsExperience: number | null): PlayerContextDepthChartRole {
  const projectedVolume = finiteNumber(input.projectedVolume);
  const peers = (input.sameTeamPositionProjectedVolumes ?? []).map(finiteNumber).filter((value): value is number => value !== null);
  if (projectedVolume === null || projectedVolume <= 0 || !peers.length) {
    if (input.isRookie || yearsExperience === 0) return "rookie_unknown";
    return "unknown";
  }
  const sorted = [...peers, projectedVolume].sort((a, b) => b - a);
  const rank = sorted.findIndex((value) => value === projectedVolume) + 1;
  const topVolume = sorted[0] ?? projectedVolume;
  const shareOfTop = topVolume > 0 ? projectedVolume / topVolume : 0;
  if (rank === 1 && shareOfTop >= 0.85) return "starter";
  if (rank <= 2 && shareOfTop >= 0.55) return "committee";
  if (shareOfTop >= 0.25) return "rotational";
  return "backup";
}

function deriveRoleStability(input: PlayerContextSignalInput): PlayerContextSignals["roleStability"] {
  const gamesPlayed = finiteNumber(input.historicalGamesPlayed);
  const gamesPossible = finiteNumber(input.historicalGamesPossible);
  const consistency = weeklyConsistency(input.weeklyStatTotals);
  if (gamesPlayed === null && consistency === null) {
    return { label: "unknown", reasons: ["No historical games or weekly stat consistency input available."] };
  }
  const availability = gamesPlayed !== null && gamesPossible && gamesPossible > 0 ? gamesPlayed / gamesPossible : null;
  if ((availability !== null && availability >= 0.82) && (consistency === null || consistency >= 0.55)) {
    return { label: "high", reasons: ["Derived proxy: strong historical availability and steady weekly production."] };
  }
  if ((availability !== null && availability >= 0.55) || (consistency !== null && consistency >= 0.35)) {
    return { label: "medium", reasons: ["Derived proxy: partial historical availability or moderate weekly production consistency."] };
  }
  return { label: "low", reasons: ["Derived proxy: limited availability or unstable weekly production sample."] };
}

function deriveInjuryRisk(input: PlayerContextSignalInput): PlayerContextSignals["injuryRisk"] {
  const gamesPlayed = finiteNumber(input.historicalGamesPlayed);
  const gamesPossible = finiteNumber(input.historicalGamesPossible);
  if (gamesPlayed === null || gamesPossible === null || gamesPossible <= 0) {
    return { label: "unknown", reasons: ["No confirmed injury feed is connected; missed-game proxy unavailable."] };
  }
  const missedGames = Math.max(0, gamesPossible - gamesPlayed);
  if (missedGames >= 7) return { label: "high", reasons: [`Derived proxy: missed ${missedGames} of ${gamesPossible} historical games.`] };
  if (missedGames >= 3) return { label: "medium", reasons: [`Derived proxy: missed ${missedGames} of ${gamesPossible} historical games.`] };
  return { label: "low", reasons: [`Derived proxy: missed ${missedGames} of ${gamesPossible} historical games.`] };
}

function confidenceFor(input: {
  input: PlayerContextSignalInput;
  dataGaps: string[];
  roleStability: PlayerContextSignals["roleStability"];
  injuryRisk: PlayerContextSignals["injuryRisk"];
  depthChartRole: PlayerContextDepthChartRole;
}): PlayerContextConfidence {
  if (input.input.unresolvedIdentity || input.input.matchStatus === "unmatched" || input.input.matchStatus === "ambiguous") return "very_low";
  const projectionConfidence = (input.input.projectionConfidence ?? "").toLowerCase();
  const base: PlayerContextConfidence = projectionConfidence.includes("high")
    ? "high"
    : projectionConfidence.includes("medium")
      ? "medium"
      : projectionConfidence.includes("low")
        ? "low"
        : "low";
  const knownDerivedSignals = [
    input.roleStability.label !== "unknown",
    input.injuryRisk.label !== "unknown",
    !["unknown", "rookie_unknown"].includes(input.depthChartRole),
  ].filter(Boolean).length;
  if (knownDerivedSignals === 0) return "very_low";
  if (input.dataGaps.length >= 6) return downgrade(base);
  if (base === "high" && ["actual snap share", "coaching environment", "team environment"].some((gap) => input.dataGaps.includes(gap))) return "medium";
  if (input.dataGaps.length >= 4) return downgrade(base);
  return base;
}

function downgrade(confidence: PlayerContextConfidence): PlayerContextConfidence {
  if (confidence === "high") return "medium";
  if (confidence === "medium") return "low";
  return "very_low";
}

function weeklyConsistency(values: PlayerContextSignalInput["weeklyStatTotals"]): number | null {
  const finiteValues = (values ?? []).map(finiteNumber).filter((value): value is number => value !== null);
  if (finiteValues.length < 4) return null;
  const mean = finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
  if (mean <= 0) return 0;
  const variance = finiteValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / finiteValues.length;
  const coefficientOfVariation = Math.sqrt(variance) / mean;
  return clamp(1 - coefficientOfVariation, 0, 1);
}

function toSituationDepthChartRole(role: PlayerContextDepthChartRole): PlayerSituationContext["depthChartRole"] {
  if (role === "rookie_unknown" || !VALID_CONTEXT_ROLES.includes(role)) return "unknown";
  return role;
}

function normalizeShare(value: number | null | undefined): number | null {
  const finite = finiteNumber(value);
  if (finite === null) return null;
  return clamp(finite <= 1 ? finite : finite / 100, 0, 1);
}

function normalizePosition(position: string): string {
  const normalized = position.trim().toUpperCase();
  return normalized === "DST" || normalized === "D/ST" ? "DEF" : normalized;
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
