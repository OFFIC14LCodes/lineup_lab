import type { DynastyAgeCurve } from "./dynasty-age-curve-types";

export type DynastyAssetValueComponents = {
  projectionValue: number;
  replacementValue: number;
  scarcityValue: number;
  formatPremium: number;
  ageRunwayValue: number;
  riskAdjustment: number;
  trustAdjustment: number;
  marketSanityAdjustment: number;
  veteranProductionCushion: number;
  shortTermWindowScore: number;
  runwayPenalty: number;
  ageCliffPenalty: number;
  tePremiumScarcityBoost: number;
  teRunwayBoost: number;
  teMarketSanityContext: number;
};

export type DynastyAssetValue = {
  dynastyAssetScoreRaw: number;
  dynastyAssetScoreDisplay: number;
  components: DynastyAssetValueComponents;
  ageCurve: DynastyAgeCurve;
  veteranProductionCushion: number;
  shortTermWindowScore: number;
  runwayPenalty: number;
  ageCliffPenalty: number;
  agePenaltyWasSmoothed: boolean;
  ageReason: string;
  eliteYoungTeProfile: boolean;
  explanation: string[];
};
