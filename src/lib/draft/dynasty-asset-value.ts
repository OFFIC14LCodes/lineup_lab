import { buildDynastyAgeCurve } from "./dynasty-age-curve";
import type { DynastyAgeCurve } from "./dynasty-age-curve-types";
import type { DynastyAssetValue } from "./dynasty-asset-value-types";

export function buildDynastyAssetValue(input: {
  playerName?: string | null;
  position?: string | null;
  age?: number | null;
  projectionValue?: number | null;
  replacementValue?: number | null;
  scarcityValue?: number | null;
  formatFit?: number | null;
  projectedPoints?: number | null;
  pointsAboveReplacement?: number | null;
  risk?: string | null;
  trustScore?: number | null;
  trustLabel?: string | null;
  marketRank?: number | null;
  blackbirdRank?: number | null;
  leagueContext?: {
    isDynasty?: boolean;
    isSuperflex?: boolean;
    isTwoQb?: boolean;
    isBestBall?: boolean;
    tePremium?: number;
  } | null;
}): DynastyAssetValue {
  const position = normalizePosition(input.position);
  const ageCurve = buildDynastyAgeCurve({ age: input.age ?? null, position });
  const projectionValue = finiteNumber(input.projectionValue) ?? projectionScoreFromPoints(input.projectedPoints, position);
  const replacementValue = finiteNumber(input.replacementValue) ?? parScore(input.pointsAboveReplacement);
  const scarcityValue = scarcityScore(position, finiteNumber(input.scarcityValue), input.leagueContext);
  const formatPremium = formatPremiumScore(position, finiteNumber(input.formatFit), input.leagueContext);
  const smoothing = ageSmoothingFor({ position, ageCurve, projectionValue, replacementValue });
  const tePremium = tePremiumBoostFor({
    position,
    ageCurve,
    projectionValue,
    replacementValue,
    scarcityValue,
    marketRank: input.marketRank,
    leagueContext: input.leagueContext,
  });
  const ageRunwayValue = ageRunwayScore(ageCurve, projectionValue, smoothing, tePremium);
  const riskAdjustment = riskAdjustmentFor(input.risk, ageCurve, smoothing);
  const trustAdjustment = trustAdjustmentFor(input.trustScore, input.trustLabel);
  const marketSanityAdjustment = computeMarketSanityAdjustment(input.marketRank, input.blackbirdRank, projectionValue);

  const raw =
    projectionValue * 0.24 +
    replacementValue * 0.19 +
    scarcityValue * 0.13 +
    formatPremium * 0.09 +
    ageRunwayValue * 0.25 +
    riskAdjustment +
    trustAdjustment +
    marketSanityAdjustment +
    smoothing.veteranProductionCushion +
    tePremium.totalBoost;

  return {
    dynastyAssetScoreRaw: round2(raw),
    dynastyAssetScoreDisplay: clamp(round2(raw), 0, 100),
    components: {
      projectionValue: round2(projectionValue),
      replacementValue: round2(replacementValue),
      scarcityValue: round2(scarcityValue),
      formatPremium: round2(formatPremium),
      ageRunwayValue: round2(ageRunwayValue),
      riskAdjustment: round2(riskAdjustment),
      trustAdjustment: round2(trustAdjustment),
      marketSanityAdjustment: round2(marketSanityAdjustment),
      veteranProductionCushion: round2(smoothing.veteranProductionCushion),
      shortTermWindowScore: round2(smoothing.shortTermWindowScore),
      runwayPenalty: round2(smoothing.runwayPenalty),
      ageCliffPenalty: round2(smoothing.ageCliffPenalty),
      tePremiumScarcityBoost: round2(tePremium.tePremiumScarcityBoost),
      teRunwayBoost: round2(tePremium.teRunwayBoost),
      teMarketSanityContext: round2(tePremium.teMarketSanityContext),
    },
    ageCurve,
    veteranProductionCushion: round2(smoothing.veteranProductionCushion),
    shortTermWindowScore: round2(smoothing.shortTermWindowScore),
    runwayPenalty: round2(smoothing.runwayPenalty),
    ageCliffPenalty: round2(smoothing.ageCliffPenalty),
    agePenaltyWasSmoothed: smoothing.agePenaltyWasSmoothed,
    ageReason: smoothing.ageReason,
    eliteYoungTeProfile: tePremium.eliteYoungTeProfile,
    explanation: explanationFor(position, ageCurve, {
      projectionValue,
      replacementValue,
      scarcityValue,
      formatPremium,
      riskAdjustment,
      trustAdjustment,
      marketSanityAdjustment,
      veteranProductionCushion: smoothing.veteranProductionCushion,
      agePenaltyWasSmoothed: smoothing.agePenaltyWasSmoothed,
      ageReason: smoothing.ageReason,
      eliteYoungTeProfile: tePremium.eliteYoungTeProfile,
      tePremiumScarcityBoost: tePremium.tePremiumScarcityBoost,
      teRunwayBoost: tePremium.teRunwayBoost,
    }),
  };
}

function projectionScoreFromPoints(points: number | null | undefined, position: string): number {
  const value = finiteNumber(points);
  if (value === null) return 45;
  const ceiling = position === "QB" ? 390 : position === "TE" ? 230 : 310;
  const floor = position === "QB" ? 180 : position === "TE" ? 80 : 120;
  return clamp(((value - floor) / (ceiling - floor)) * 100, 0, 100);
}

function parScore(value: number | null | undefined): number {
  const par = finiteNumber(value);
  if (par === null) return 50;
  return clamp(50 + par * 1.2, 0, 100);
}

function scarcityScore(position: string, base: number | null, context: Parameters<typeof buildDynastyAssetValue>[0]["leagueContext"]): number {
  const score = base ?? 50;
  if (position === "QB" && (context?.isSuperflex || context?.isTwoQb)) return clamp(score + 18, 0, 100);
  if (position === "TE") return clamp(score + 10 + Math.min(8, Math.max(0, context?.tePremium ?? 0) * 4), 0, 100);
  if (position === "RB") return clamp(score + 3, 0, 100);
  return clamp(score, 0, 100);
}

function formatPremiumScore(position: string, base: number | null, context: Parameters<typeof buildDynastyAssetValue>[0]["leagueContext"]): number {
  const score = base ?? 50;
  if (position === "QB" && (context?.isSuperflex || context?.isTwoQb)) return clamp(score + 22, 0, 100);
  if (position === "TE") return clamp(score + 12 + Math.min(10, Math.max(0, context?.tePremium ?? 0) * 5), 0, 100);
  if (context?.isBestBall && (position === "WR" || position === "TE")) return clamp(score + 5, 0, 100);
  return clamp(score, 0, 100);
}

function ageRunwayScore(ageCurve: DynastyAgeCurve, projectionValue: number, smoothing: AgeSmoothing, tePremium: TePremiumBoost): number {
  const productionSupport = projectionValue >= 78 ? 7 : projectionValue >= 65 ? 4 : 0;
  const cliffCompression = ageCurve.declineRisk === "severe" ? -10 + smoothing.shortTermWindowScore * 0.18 : ageCurve.declineRisk === "high" ? -4 : 0;
  const base = ageCurve.runwayScore + ageCurve.ageAdjustment + productionSupport + cliffCompression + tePremium.teRunwayBoost;
  const smoothedFloor = smoothing.agePenaltyWasSmoothed ? smoothing.shortTermWindowScore * 0.6 : 0;
  return clamp(Math.max(base, smoothedFloor), 0, 100);
}

function riskAdjustmentFor(risk: string | null | undefined, ageCurve: DynastyAgeCurve, smoothing: AgeSmoothing): number {
  const label = (risk ?? "").toLowerCase();
  const base = label === "high" ? -7 : label === "medium" ? -3 : 0;
  const age = ageCurve.declineRisk === "severe" ? -7 : ageCurve.declineRisk === "high" ? -4 : ageCurve.declineRisk === "medium" ? -1.5 : 0;
  return base + age + (smoothing.agePenaltyWasSmoothed ? 5 : 0);
}

function trustAdjustmentFor(trustScore: number | null | undefined, trustLabel: string | null | undefined): number {
  const score = finiteNumber(trustScore);
  if (score !== null) return clamp((score - 55) / 8, -7, 6);
  const label = (trustLabel ?? "").toLowerCase();
  if (label === "high") return 4;
  if (label === "medium") return 1;
  if (label === "low") return -3;
  if (label === "very_low") return -7;
  return 0;
}

function computeMarketSanityAdjustment(marketRank: number | null | undefined, blackbirdRank: number | null | undefined, projectionValue: number): number {
  const market = finiteNumber(marketRank);
  const rank = finiteNumber(blackbirdRank);
  if (market === null || rank === null || market <= 0 || rank <= 0) return 0;
  const gap = rank - market;
  if (gap >= 35 && projectionValue >= 65) return 3;
  if (gap <= -45) return -4;
  if (gap <= -25) return -2;
  return 0;
}

function explanationFor(position: string, ageCurve: DynastyAgeCurve, values: {
  projectionValue: number;
  replacementValue: number;
  scarcityValue: number;
  formatPremium: number;
  riskAdjustment: number;
  trustAdjustment: number;
  marketSanityAdjustment: number;
  veteranProductionCushion: number;
  agePenaltyWasSmoothed: boolean;
  ageReason: string;
  eliteYoungTeProfile: boolean;
  tePremiumScarcityBoost: number;
  teRunwayBoost: number;
}): string[] {
  const reasons = [
    values.ageReason || ageCurve.explanation,
    `Projection value ${round2(values.projectionValue)} and PAR value ${round2(values.replacementValue)} remain primary production inputs.`,
  ];
  if (values.agePenaltyWasSmoothed) reasons.push(`Veteran production cushion ${round2(values.veteranProductionCushion)} preserves short-term win-now value without removing runway risk.`);
  if (values.eliteYoungTeProfile) reasons.push(`Elite young TE profile adds scarcity boost ${round2(values.tePremiumScarcityBoost)} and runway boost ${round2(values.teRunwayBoost)}.`);
  if (position === "TE" && (values.scarcityValue >= 65 || values.formatPremium >= 65)) reasons.push("TE scarcity and premium scoring add dynasty format value.");
  if (position === "QB" && values.formatPremium >= 70) reasons.push("Superflex format premium raises multi-year QB asset value.");
  if (values.riskAdjustment < -6) reasons.push(`Risk adjustment ${round2(values.riskAdjustment)} reflects decline and confidence risk.`);
  if (values.marketSanityAdjustment !== 0) reasons.push(`Market sanity adjustment ${round2(values.marketSanityAdjustment)} is capped and does not drive raw value.`);
  return reasons;
}

type AgeSmoothing = {
  veteranProductionCushion: number;
  shortTermWindowScore: number;
  runwayPenalty: number;
  ageCliffPenalty: number;
  agePenaltyWasSmoothed: boolean;
  ageReason: string;
};

function ageSmoothingFor(input: {
  position: string;
  ageCurve: DynastyAgeCurve;
  projectionValue: number;
  replacementValue: number;
}): AgeSmoothing {
  const runwayPenalty = Math.max(0, 70 - input.ageCurve.runwayScore);
  const ageCliffPenalty =
    input.ageCurve.declineRisk === "severe" ? 18 : input.ageCurve.declineRisk === "high" ? 10 : input.ageCurve.declineRisk === "medium" ? 4 : 0;
  const shortTermWindowScore = input.position === "RB" && input.ageCurve.age !== null && input.ageCurve.age >= 30
    ? clamp((input.projectionValue * 0.55 + input.replacementValue * 0.45) - 50, 0, 45)
    : 0;
  const veteranProductionCushion = input.position === "RB" && input.ageCurve.declineRisk === "severe" && shortTermWindowScore >= 20
    ? clamp(shortTermWindowScore * 0.4, 0, 13)
    : 0;
  const agePenaltyWasSmoothed = veteranProductionCushion > 0;
  const ageReason = agePenaltyWasSmoothed
    ? "Older RB with severe dynasty runway risk, but elite short-term production keeps him in the win-now tier."
    : input.ageCurve.explanation;
  return {
    veteranProductionCushion,
    shortTermWindowScore,
    runwayPenalty,
    ageCliffPenalty,
    agePenaltyWasSmoothed,
    ageReason,
  };
}

type TePremiumBoost = {
  eliteYoungTeProfile: boolean;
  tePremiumScarcityBoost: number;
  teRunwayBoost: number;
  teMarketSanityContext: number;
  totalBoost: number;
};

function tePremiumBoostFor(input: {
  position: string;
  ageCurve: DynastyAgeCurve;
  projectionValue: number;
  replacementValue: number;
  scarcityValue: number;
  marketRank?: number | null;
  leagueContext?: Parameters<typeof buildDynastyAssetValue>[0]["leagueContext"];
}): TePremiumBoost {
  const tePremium = input.leagueContext?.tePremium ?? 0;
  const marketRank = finiteNumber(input.marketRank);
  const eliteYoungTeProfile =
    input.position === "TE" &&
    input.ageCurve.age !== null &&
    input.ageCurve.age <= 25 &&
    input.projectionValue >= 70 &&
    input.replacementValue >= 70 &&
    tePremium > 0;
  const tePremiumScarcityBoost = eliteYoungTeProfile ? clamp(5 + tePremium * 3 + Math.max(0, input.scarcityValue - 75) * 0.08, 0, 9) : 0;
  const teRunwayBoost = eliteYoungTeProfile ? 6 : 0;
  const teMarketSanityContext = eliteYoungTeProfile && marketRank !== null && marketRank <= 18 ? 2 : 0;
  return {
    eliteYoungTeProfile,
    tePremiumScarcityBoost,
    teRunwayBoost,
    teMarketSanityContext,
    totalBoost: tePremiumScarcityBoost + teRunwayBoost * 0.35 + teMarketSanityContext,
  };
}

function normalizePosition(value: string | null | undefined): string {
  const position = (value ?? "").trim().toUpperCase();
  return position === "D/ST" ? "DST" : position || "UNK";
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
