import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";
import type { WarRoomRecommendationRow } from "@/lib/draft/war-room-recommendations";

export type BlackbirdContextualConfidence = "very_low" | "low" | "medium" | "high";
export type BlackbirdContextualRisk = "low" | "medium" | "high";

export type PlayerSituationContext = {
  playerId: string;
  age: number | null;
  yearsExperience: number | null;
  team: string | null;
  position: string;
  depthChartRole: "starter" | "committee" | "rotational" | "backup" | "unknown";
  projectedSnapShare: number | null;
  coachingEnvironmentScore: number | null;
  teamOffenseEnvironmentScore: number | null;
  teamDefenseEnvironmentScore: number | null;
  roleStability: "low" | "medium" | "high" | "unknown";
  injuryRisk: "low" | "medium" | "high" | "unknown";
  dataGaps: string[];
};

export type BlackbirdLeagueContext = {
  isDynasty?: boolean;
  isBestBall?: boolean;
  isSuperflex?: boolean;
  isTwoQb?: boolean;
  tePremium?: number;
  hasIDP?: boolean;
  hasKicker?: boolean;
  hasTeamDefense?: boolean;
  rosterPositions?: string[];
  scoringSettings?: Record<string, number | string | boolean | null> | null;
  scoringFingerprint?: string | null;
};

export type BlackbirdContextualValue = {
  playerId: string;
  playerName: string;
  position: string;
  projectedFantasyPoints: {
    low: number | null;
    median: number | null;
    high: number | null;
    source: string;
    scoringAware: boolean;
  };
  valueScore: number;
  valueScoreComponents: {
    projectionValue: number;
    floorCeilingShape: number;
    positionScarcity: number;
    rosterFormatFit: number;
    leagueFormatFit: number;
    ageCurve: number;
    dynastyValue: number;
    redraftValue: number;
    bestBallFit: number;
    superflexFit: number;
    idpFormatFit: number;
    situation: number;
    coachingEnvironment: number;
    depthChartRole: number;
    projectedSnapShare: number;
    confidence: number;
    riskAdjustment: number;
  };
  blackbirdRank: number | null;
  blackbirdTier: number | null;
  confidence: BlackbirdContextualConfidence;
  risk: BlackbirdContextualRisk;
  reasons: string[];
  dataGaps: string[];
};

export type BlackbirdContextualValueInput = {
  player: ScoredDraftTarget & { age?: number | null; years_exp?: number | null; yearsExperience?: number | null };
  overlay?: (WarRoomValueOverlayRow & { floorPoints?: number | null; ceilingPoints?: number | null; projectedPositionRank?: number | null }) | null;
  recommendation?: WarRoomRecommendationRow | null;
  leagueContext?: BlackbirdLeagueContext;
  situationContext?: Partial<PlayerSituationContext> | null;
  positionPeers?: Array<{
    projection: number | null;
    floor: number | null;
    ceiling: number | null;
    par: number | null;
    value: number | null;
  }>;
};

const IDP_POSITIONS = new Set(["DL", "LB", "DB"]);

export function buildBlackbirdContextualValue(input: BlackbirdContextualValueInput): BlackbirdContextualValue {
  const playerId = input.player.matched_player_id ?? input.player.sleeper_player_id ?? input.overlay?.entityId ?? input.recommendation?.entityId ?? "";
  const playerName = input.player.player_name ?? input.overlay?.displayName ?? input.recommendation?.displayName ?? "Unknown";
  const position = normalizePosition(input.player.position ?? input.overlay?.position ?? input.recommendation?.position ?? "UNK");
  const projection = projectionBundle(input);
  const situation = normalizeSituation({
    playerId,
    position,
    team: input.player.team ?? input.overlay?.team ?? input.recommendation?.team ?? null,
    age: finiteNumber(input.player.age),
    yearsExperience: finiteNumber(input.player.yearsExperience) ?? finiteNumber(input.player.years_exp),
    situationContext: input.situationContext,
  });
  const peers = input.positionPeers ?? [];
  const confidence = confidenceLabel(input);
  const risk = riskLabel(input, situation);
  const projectionValue = percentile(projection.median, peers.map((peer) => peer.projection), 50);
  const floorCeilingShape = floorCeilingScore(projection.low, projection.median, projection.high, Boolean(input.leagueContext?.isBestBall));
  const positionScarcity = clamp(input.overlay?.positionScarcityScore ?? percentile(input.overlay?.pointsAboveReplacement ?? null, peers.map((peer) => peer.par), 50), 0, 100);
  const rosterFormatFit = rosterFit(position, input.leagueContext);
  const leagueFormatFit = leagueFit(position, input.leagueContext);
  const ageCurve = ageCurveScore(position, situation.age, Boolean(input.leagueContext?.isDynasty));
  const dynastyValue = formatValue(input.player.dynasty_value, Boolean(input.leagueContext?.isDynasty), ageCurve);
  const redraftValue = redraftScore(input.player, projectionValue, Boolean(input.leagueContext?.isDynasty));
  const bestBallFit = bestBallScore(input.player.best_ball_value, floorCeilingShape, Boolean(input.leagueContext?.isBestBall));
  const superflexFit = superflexScore(input.player.superflex_value, position, input.leagueContext, input.player.rank);
  const idpFormatFit = idpScore(position, input.leagueContext, confidence);
  const situationScore = situationScoreFor(situation);
  const coachingEnvironment = neutralOrScore(situation.coachingEnvironmentScore);
  const depthChartRole = depthChartScore(situation.depthChartRole);
  const projectedSnapShare = snapShareScore(situation.projectedSnapShare);
  const confidenceScore = confidenceScoreFor(confidence);
  const riskAdjustment = riskAdjustmentFor(risk, situation.injuryRisk);

  const components: BlackbirdContextualValue["valueScoreComponents"] = {
    projectionValue,
    floorCeilingShape,
    positionScarcity,
    rosterFormatFit,
    leagueFormatFit,
    ageCurve,
    dynastyValue,
    redraftValue,
    bestBallFit,
    superflexFit,
    idpFormatFit,
    situation: situationScore,
    coachingEnvironment,
    depthChartRole,
    projectedSnapShare,
    confidence: confidenceScore,
    riskAdjustment,
  };
  const valueScore = round2(
    projectionValue * 0.2 +
      floorCeilingShape * 0.08 +
      positionScarcity * 0.13 +
      rosterFormatFit * 0.12 +
      leagueFormatFit * 0.08 +
      ageCurve * 0.06 +
      dynastyValue * 0.07 +
      redraftValue * 0.05 +
      bestBallFit * 0.05 +
      superflexFit * 0.06 +
      idpFormatFit * 0.04 +
      situationScore * 0.03 +
      coachingEnvironment * 0.01 +
      depthChartRole * 0.02 +
      projectedSnapShare * 0.03 +
      confidenceScore * 0.04 +
      riskAdjustment
  );
  return {
    playerId,
    playerName,
    position,
    projectedFantasyPoints: {
      low: projection.low,
      median: projection.median,
      high: projection.high,
      source: projection.source,
      scoringAware: projection.scoringAware,
    },
    valueScore: clamp(round2(valueScore), 0, 100),
    valueScoreComponents: components,
    blackbirdRank: null,
    blackbirdTier: null,
    confidence,
    risk,
    reasons: reasonsFor({ position, projection, components, leagueContext: input.leagueContext, situation }),
    dataGaps: Array.from(new Set([...projection.dataGaps, ...situation.dataGaps, ...contextDataGaps(input.leagueContext, position)])).sort(),
  };
}

export function assignBlackbirdRanks(values: BlackbirdContextualValue[]): BlackbirdContextualValue[] {
  const ranked = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value.valueScore - a.value.valueScore || tieBreakProjection(b.value) - tieBreakProjection(a.value) || a.value.playerName.localeCompare(b.value.playerName));
  const tiers = buildTiers(ranked.map((row) => row.value));
  return ranked
    .map((row, index) => ({
      ...row.value,
      blackbirdRank: index + 1,
      blackbirdTier: tiers.get(row.value.playerId || row.value.playerName) ?? null,
    }))
    .sort((a, b) => (a.blackbirdRank ?? 99999) - (b.blackbirdRank ?? 99999));
}

function projectionBundle(input: BlackbirdContextualValueInput) {
  const low = finiteNumber(input.overlay?.floorPoints) ?? null;
  const median = finiteNumber(input.overlay?.medianPoints) ?? finiteNumber(input.player.projected_points) ?? finiteNumber(input.recommendation?.h10.medianPoints);
  const high = finiteNumber(input.overlay?.ceilingPoints) ?? null;
  const source = input.overlay?.medianPoints !== null && input.overlay?.medianPoints !== undefined
    ? "h10_league_projection"
    : input.player.projected_points !== null && input.player.projected_points !== undefined
      ? "uploaded_ranking_projection"
      : input.recommendation?.h10.medianPoints !== null && input.recommendation?.h10.medianPoints !== undefined
        ? "h10_recommendation_projection"
        : "missing";
  return {
    low,
    median,
    high,
    source,
    scoringAware: source === "h10_league_projection" || source === "h10_recommendation_projection",
    dataGaps: [
      median === null ? "projection median" : null,
      low === null ? "projection low" : null,
      high === null ? "projection high" : null,
    ].filter((gap): gap is string => Boolean(gap)),
  };
}

function normalizeSituation(input: {
  playerId: string;
  position: string;
  team: string | null;
  age: number | null;
  yearsExperience: number | null;
  situationContext?: Partial<PlayerSituationContext> | null;
}): PlayerSituationContext {
  const context = input.situationContext ?? {};
  const age = finiteNumber(context.age) ?? input.age;
  const yearsExperience = finiteNumber(context.yearsExperience) ?? input.yearsExperience;
  const projectedSnapShare = finiteNumber(context.projectedSnapShare);
  const gaps = [
    age === null ? "age" : null,
    yearsExperience === null ? "years experience" : null,
    context.depthChartRole ? null : "depth chart role",
    projectedSnapShare === null ? "projected snap share" : null,
    context.coachingEnvironmentScore === null || context.coachingEnvironmentScore === undefined ? "coaching environment" : null,
    context.teamOffenseEnvironmentScore === null || context.teamOffenseEnvironmentScore === undefined ? "team offense environment" : null,
    context.teamDefenseEnvironmentScore === null || context.teamDefenseEnvironmentScore === undefined ? "team defense environment" : null,
    context.roleStability ? null : "role stability",
    context.injuryRisk ? null : "injury risk",
    ...(context.dataGaps ?? []),
  ].filter((gap): gap is string => Boolean(gap));
  return {
    playerId: input.playerId,
    position: input.position,
    team: context.team ?? input.team,
    age,
    yearsExperience,
    depthChartRole: context.depthChartRole ?? "unknown",
    projectedSnapShare,
    coachingEnvironmentScore: finiteNumber(context.coachingEnvironmentScore),
    teamOffenseEnvironmentScore: finiteNumber(context.teamOffenseEnvironmentScore),
    teamDefenseEnvironmentScore: finiteNumber(context.teamDefenseEnvironmentScore),
    roleStability: context.roleStability ?? "unknown",
    injuryRisk: context.injuryRisk ?? "unknown",
    dataGaps: gaps,
  };
}

function reasonsFor(input: {
  position: string;
  projection: ReturnType<typeof projectionBundle>;
  components: BlackbirdContextualValue["valueScoreComponents"];
  leagueContext?: BlackbirdLeagueContext;
  situation: PlayerSituationContext;
}): string[] {
  const reasons = [];
  if (input.projection.median !== null) reasons.push(`Projection median contributes ${input.components.projectionValue.toFixed(1)} component points.`);
  if (input.components.positionScarcity >= 65) reasons.push(`${input.position} scarcity is elevated for this league.`);
  if ((input.leagueContext?.isSuperflex || input.leagueContext?.isTwoQb) && input.position === "QB") reasons.push("Superflex/2QB format lifts quarterback value.");
  if ((input.leagueContext?.tePremium ?? 0) > 0 && input.position === "TE") reasons.push("TE premium format lifts tight end value.");
  if (input.leagueContext?.isDynasty && input.situation.age !== null) reasons.push("Dynasty age curve is included.");
  if (input.leagueContext?.isBestBall) reasons.push("Best ball format gives additional weight to ceiling shape.");
  if (IDP_POSITIONS.has(input.position)) reasons.push("IDP value is separated by defensive position and confidence.");
  return reasons.length ? reasons : ["Contextual value uses neutral defaults where player context data is missing."];
}

function contextDataGaps(context: BlackbirdLeagueContext | undefined, position: string): string[] {
  const gaps = [];
  if (!context?.rosterPositions?.length) gaps.push("roster positions");
  if (!context?.scoringSettings) gaps.push("scoring settings");
  if (IDP_POSITIONS.has(position) && !context?.hasIDP) gaps.push("IDP roster confirmation");
  return gaps;
}

function floorCeilingScore(low: number | null, median: number | null, high: number | null, bestBall: boolean): number {
  if (median === null) return 45;
  if (low === null || high === null) return 50;
  const floorRatio = clamp(low / Math.max(median, 1), 0, 1.2);
  const ceilingRatio = clamp(high / Math.max(median, 1), 0, 2);
  return clamp(bestBall ? ceilingRatio * 55 + floorRatio * 25 : floorRatio * 45 + ceilingRatio * 30, 0, 100);
}

function rosterFit(position: string, context?: BlackbirdLeagueContext): number {
  const slots = (context?.rosterPositions ?? []).map((slot) => slot.toUpperCase());
  if (!slots.length) return 50;
  const direct = slots.filter((slot) => slot === position || (position === "DEF" && (slot === "DST" || slot === "D/ST"))).length;
  const flex = slots.filter((slot) => slot.includes("FLEX") || slot === "OP").length;
  return clamp(45 + direct * 12 + (["RB", "WR", "TE", "QB", "DL", "LB", "DB"].includes(position) ? flex * 4 : 0), 0, 100);
}

function leagueFit(position: string, context?: BlackbirdLeagueContext): number {
  let score = 50;
  if ((context?.isSuperflex || context?.isTwoQb) && position === "QB") score += 28;
  if ((context?.tePremium ?? 0) > 0 && position === "TE") score += 18;
  if (context?.hasIDP && IDP_POSITIONS.has(position)) score += 16;
  if (!context?.hasKicker && position === "K") score -= 18;
  if (!context?.hasTeamDefense && position === "DEF") score -= 18;
  return clamp(score, 0, 100);
}

function ageCurveScore(position: string, age: number | null, dynasty: boolean): number {
  if (age === null) return 50;
  if (!dynasty) {
    if (age >= 34) return 42;
    if ((position === "RB" || position === "WR") && age >= 30) return 46;
    return 52;
  }
  const peak = position === "RB" ? 24.5 : position === "WR" ? 25.5 : position === "TE" ? 26.5 : position === "QB" ? 29 : 26;
  const sensitivity = position === "RB" ? 8 : position === "WR" ? 6 : position === "QB" ? 3 : 5;
  return clamp(70 - Math.max(0, age - peak) * sensitivity + Math.max(0, peak - age) * 2, 20, 90);
}

function formatValue(value: number | null, active: boolean, ageCurve: number): number {
  if (!active) return 50;
  return value === null ? ageCurve : clamp(value * 0.7 + ageCurve * 0.3, 0, 100);
}

function redraftScore(_player: ScoredDraftTarget, projectionValue: number, dynasty: boolean): number {
  if (dynasty) return 50;
  return clamp(projectionValue, 0, 100);
}

function bestBallScore(value: number | null, floorCeilingShape: number, active: boolean): number {
  if (!active) return 50;
  return value === null ? floorCeilingShape : clamp(value * 0.65 + floorCeilingShape * 0.35, 0, 100);
}

function superflexScore(value: number | null, position: string, context?: BlackbirdLeagueContext, sourceRank?: number | null): number {
  if (!(context?.isSuperflex || context?.isTwoQb)) return 50;
  if (position !== "QB") return 45;
  if (sourceRank !== null && sourceRank !== undefined) {
    if (sourceRank <= 12) return value === null ? 94 : clamp(value * 0.65 + 28, 0, 100);
    if (sourceRank <= 24) return value === null ? 88 : clamp(value * 0.65 + 22, 0, 100);
    if (sourceRank <= 60) return value === null ? 78 : clamp(value * 0.65 + 16, 0, 100);
    if (sourceRank <= 100) return value === null ? 68 : clamp(value * 0.65 + 10, 0, 100);
    return value === null ? 54 : clamp(value * 0.65 + 4, 0, 100);
  }
  return value === null ? 82 : clamp(value * 0.65 + 28, 0, 100);
}

function idpScore(position: string, context: BlackbirdLeagueContext | undefined, confidence: BlackbirdContextualConfidence): number {
  if (!IDP_POSITIONS.has(position)) return 50;
  if (!context?.hasIDP) return 38;
  return confidence === "very_low" || confidence === "low" ? 52 : 66;
}

function situationScoreFor(situation: PlayerSituationContext): number {
  const stability = situation.roleStability === "high" ? 12 : situation.roleStability === "medium" ? 5 : situation.roleStability === "low" ? -8 : 0;
  return clamp(50 + stability, 0, 100);
}

function neutralOrScore(value: number | null): number {
  return value === null ? 50 : clamp(value, 0, 100);
}

function depthChartScore(role: PlayerSituationContext["depthChartRole"]): number {
  if (role === "starter") return 78;
  if (role === "committee") return 60;
  if (role === "rotational") return 48;
  if (role === "backup") return 32;
  return 50;
}

function snapShareScore(value: number | null): number {
  if (value === null) return 50;
  return clamp(value <= 1 ? value * 100 : value, 0, 100);
}

function confidenceLabel(input: BlackbirdContextualValueInput): BlackbirdContextualConfidence {
  const label = (input.recommendation?.h10.confidenceLabel ?? input.overlay?.confidenceLabel ?? "").toLowerCase();
  if (label.includes("very")) return "very_low";
  if (label.includes("low")) return "low";
  if (label.includes("high")) return "high";
  if (input.player.match_status === "ambiguous" || input.player.match_status === "unmatched") return "low";
  return "medium";
}

function riskLabel(input: BlackbirdContextualValueInput, situation: PlayerSituationContext): BlackbirdContextualRisk {
  const label = (input.overlay?.riskLabel ?? input.recommendation?.tierDropRisk ?? "").toLowerCase();
  if (label.includes("high") || label.includes("extreme") || situation.injuryRisk === "high") return "high";
  if (label.includes("medium") || situation.injuryRisk === "medium") return "medium";
  return "low";
}

function confidenceScoreFor(confidence: BlackbirdContextualConfidence): number {
  if (confidence === "high") return 82;
  if (confidence === "medium") return 66;
  if (confidence === "low") return 42;
  return 25;
}

function riskAdjustmentFor(risk: BlackbirdContextualRisk, injuryRisk: PlayerSituationContext["injuryRisk"]): number {
  const injury = injuryRisk === "high" ? -3 : injuryRisk === "medium" ? -1.5 : 0;
  if (risk === "high") return -6 + injury;
  if (risk === "medium") return -2.5 + injury;
  return 1 + injury;
}

function percentile(value: number | null, values: Array<number | null>, fallback: number): number {
  if (value === null) return fallback;
  const finiteValues = values.filter((candidate): candidate is number => candidate !== null && Number.isFinite(candidate));
  if (finiteValues.length <= 1) return fallback;
  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  if (max === min) return fallback;
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

function buildTiers(values: BlackbirdContextualValue[]): Map<string, number> {
  const tiers = new Map<string, number>();
  let tier = 1;
  let previous: number | null = null;
  for (const value of values) {
    if (previous !== null && previous - value.valueScore >= 4) tier += 1;
    tiers.set(value.playerId || value.playerName, tier);
    previous = value.valueScore;
  }
  return tiers;
}

function tieBreakProjection(value: BlackbirdContextualValue): number {
  return value.projectedFantasyPoints.median ?? 0;
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
