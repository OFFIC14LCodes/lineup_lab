export type PlayerRole =
  | "locked_starter"
  | "probable_starter"
  | "committee"
  | "rotational"
  | "backup"
  | "deep_reserve"
  | "rookie_unknown"
  | "team_unit"
  | "unknown";

export type PlayerRoleConfidence = "very_low" | "low" | "medium" | "high";

export type PlayerRoleBasis =
  | "projection_volume_proxy"
  | "same_team_position_rank_proxy"
  | "rookie_unknown"
  | "team_unit"
  | "insufficient_data";

export type PlayerRoleClassification = {
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
  role: PlayerRole;
  confidence: PlayerRoleConfidence;
  basis: PlayerRoleBasis[];
  teamPositionRankProxy: number | null;
  sameTeamPositionPeerCount: number;
  projectedVolumeScore: number | null;
  reasons: string[];
  dataGaps: string[];
};

export type PlayerRoleClassificationInput = {
  playerId: string;
  playerName: string;
  position: string | null;
  team: string | null;
  age?: number | null;
  yearsExperience?: number | null;
  medianProjection?: number | null;
  projectionTrustLabel?: string | null;
  projectionUnit?: string | null;
  isFallback?: boolean | null;
  matchStatus?: string | null;
  projectedStats?: Record<string, number | null | undefined> | null;
  sameTeamPositionPeers?: Array<{
    playerId: string;
    medianProjection?: number | null;
    projectionTrustLabel?: string | null;
    isFallback?: boolean | null;
    projectedStats?: Record<string, number | null | undefined> | null;
  }>;
};

const OFFENSE = new Set(["QB", "RB", "WR", "TE"]);
const IDP = new Set(["DL", "LB", "DB"]);

export function classifyPlayerRole(input: PlayerRoleClassificationInput): PlayerRoleClassification {
  const position = normalizePosition(input.position ?? "UNK");
  const median = finiteNumber(input.medianProjection);
  const peers = input.sameTeamPositionPeers ?? [];
  const projectedVolumeScore = projectedVolumeScoreFor(position, median, input.projectedStats);
  const teamRank = teamPositionRankProxy(input.playerId, median, peers);
  const trust = normalizeTrust(input.projectionTrustLabel);
  const isFallback = Boolean(input.isFallback) || input.projectionUnit === "fallback";
  const yearsExperience = finiteNumber(input.yearsExperience);
  const basis: PlayerRoleBasis[] = [];
  const dataGaps = [
    input.team ? null : "team",
    "confirmed depth chart",
    position === "DEF" ? null : "confirmed snap share",
    position === "DEF" ? "individual role not applicable to team defense" : null,
    median === null ? "season projection median" : null,
  ].filter((gap): gap is string => Boolean(gap));

  if (position === "DEF") {
    return {
      playerId: input.playerId,
      playerName: input.playerName,
      position,
      team: input.team,
      role: "team_unit",
      confidence: trust === "very_low" ? "low" : "medium",
      basis: ["team_unit"],
      teamPositionRankProxy: null,
      sameTeamPositionPeerCount: peers.length + 1,
      projectedVolumeScore,
      reasons: ["Team defense is evaluated as a unit, not an individual depth-chart role."],
      dataGaps: dataGaps.filter((gap) => gap !== "confirmed depth chart"),
    };
  }

  if (yearsExperience === 0 && (trust === "very_low" || trust === "low" || median === null)) {
    return {
      playerId: input.playerId,
      playerName: input.playerName,
      position,
      team: input.team,
      role: "rookie_unknown",
      confidence: "low",
      basis: ["rookie_unknown"],
      teamPositionRankProxy: teamRank,
      sameTeamPositionPeerCount: peers.length + 1,
      projectedVolumeScore,
      reasons: ["Rookie role is not confirmed; projection is treated as a low-confidence role proxy."],
      dataGaps: Array.from(new Set([...dataGaps, "rookie draft capital", "college role translation"])).sort(),
    };
  }

  if (median === null || input.matchStatus === "unmatched" || input.matchStatus === "ambiguous") {
    return {
      playerId: input.playerId,
      playerName: input.playerName,
      position,
      team: input.team,
      role: "unknown",
      confidence: "very_low",
      basis: ["insufficient_data"],
      teamPositionRankProxy: teamRank,
      sameTeamPositionPeerCount: peers.length + 1,
      projectedVolumeScore,
      reasons: ["Role cannot be inferred without a trusted season projection and resolved identity."],
      dataGaps: Array.from(new Set([...dataGaps, "resolved player identity"])).sort(),
    };
  }

  basis.push("projection_volume_proxy");
  if (teamRank !== null) basis.push("same_team_position_rank_proxy");

  const role = roleFromSignals(position, median, projectedVolumeScore, teamRank);
  const confidence = roleConfidence(role, trust, isFallback, teamRank);
  const reasons = [
    `Role is inferred from ${position} season projection volume, not confirmed depth chart data.`,
    teamRank !== null ? `Same-team ${position} projection rank proxy is ${teamRank}.` : null,
    isFallback ? "Fallback projection lowers role confidence." : null,
  ].filter((reason): reason is string => Boolean(reason));

  return {
    playerId: input.playerId,
    playerName: input.playerName,
    position,
    team: input.team,
    role,
    confidence,
    basis,
    teamPositionRankProxy: teamRank,
    sameTeamPositionPeerCount: peers.length + 1,
    projectedVolumeScore,
    reasons,
    dataGaps: Array.from(new Set(dataGaps)).sort(),
  };
}

function roleFromSignals(position: string, median: number, volume: number | null, teamRank: number | null): PlayerRole {
  const score = volume ?? volumeFromMedian(position, median);
  if (OFFENSE.has(position)) {
    if (position === "QB") {
      if (median >= 250 || teamRank === 1 && median >= 170) return "probable_starter";
      if (median >= 120) return "backup";
      return "deep_reserve";
    }
    if (score >= 78 || teamRank === 1 && score >= 65) return "probable_starter";
    if (score >= 58) return position === "RB" ? "committee" : "rotational";
    if (score >= 35) return "backup";
    return "deep_reserve";
  }
  if (IDP.has(position)) {
    if (score >= 78 || teamRank === 1 && score >= 65) return "probable_starter";
    if (score >= 52) return "rotational";
    if (score >= 30) return "backup";
    return "deep_reserve";
  }
  if (position === "K") return median >= 90 ? "probable_starter" : "unknown";
  return "unknown";
}

function roleConfidence(role: PlayerRole, trust: PlayerRoleConfidence, isFallback: boolean, teamRank: number | null): PlayerRoleConfidence {
  if (isFallback || trust === "very_low") return role === "unknown" ? "very_low" : "low";
  if (role === "unknown" || role === "rookie_unknown") return "low";
  if (trust === "high" && teamRank !== null && ["probable_starter", "team_unit"].includes(role)) return "high";
  if (trust === "medium" || trust === "high") return "medium";
  return "low";
}

function teamPositionRankProxy(playerId: string, median: number | null, peers: PlayerRoleClassificationInput["sameTeamPositionPeers"] = []): number | null {
  if (median === null || peers.length === 0) return null;
  const ranked = [{ playerId, median }, ...peers.map((peer) => ({ playerId: peer.playerId, median: finiteNumber(peer.medianProjection) }))]
    .filter((row): row is { playerId: string; median: number } => row.median !== null)
    .sort((a, b) => b.median - a.median || a.playerId.localeCompare(b.playerId));
  const index = ranked.findIndex((row) => row.playerId === playerId);
  return index >= 0 ? index + 1 : null;
}

function projectedVolumeScoreFor(position: string, median: number | null, stats?: Record<string, number | null | undefined> | null): number | null {
  if (stats) {
    const attempts = sum(stats, ["pass_att", "passing_attempts", "rush_att", "carries", "targets", "rec", "receptions", "solo_tkl", "tackle_solo", "ast_tkl", "tackle_assist"]);
    if (attempts > 0) return clamp((attempts / volumeDenominator(position)) * 100, 0, 100);
  }
  return median === null ? null : volumeFromMedian(position, median);
}

function volumeFromMedian(position: string, median: number): number {
  const denominators: Record<string, number> = { QB: 320, RB: 230, WR: 220, TE: 180, DL: 170, LB: 240, DB: 180, K: 120, DEF: 125 };
  return clamp((median / (denominators[position] ?? 220)) * 100, 0, 100);
}

function volumeDenominator(position: string): number {
  const denominators: Record<string, number> = { QB: 520, RB: 260, WR: 125, TE: 100, DL: 70, LB: 125, DB: 100 };
  return denominators[position] ?? 150;
}

function sum(stats: Record<string, number | null | undefined>, keys: string[]): number {
  return keys.reduce((total, key) => total + (finiteNumber(stats[key]) ?? 0), 0);
}

function normalizeTrust(value: string | null | undefined): PlayerRoleConfidence {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("very")) return "very_low";
  if (normalized.includes("low")) return "low";
  if (normalized.includes("high")) return "high";
  return "medium";
}

function normalizePosition(position: string): string {
  const normalized = position.trim().toUpperCase();
  return normalized === "DST" || normalized === "D/ST" ? "DEF" : normalized;
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
