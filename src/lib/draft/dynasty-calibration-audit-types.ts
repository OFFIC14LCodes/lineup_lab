export type DynastyCalibrationRecommendation =
  | "dynasty_calibration_ready_for_manual_review"
  | "dynasty_calibration_needs_formula_tuning"
  | "dynasty_calibration_needs_age_smoothing"
  | "dynasty_calibration_needs_te_premium_tuning"
  | "dynasty_calibration_needs_age_data_fix"
  | "dynasty_calibration_needs_market_data_fix"
  | "dynasty_calibration_blocked";

export type DynastyCalibrationAuditRow = {
  playerName: string;
  position: string | null;
  team: string | null;
  beforeRank: number | null;
  afterRank: number | null;
  beforePositionRank: number | null;
  afterPositionRank: number | null;
  age: number | null;
  agePhase: string;
  runwayScore: number | null;
  projectionPoints: number | null;
  projectionValue: number | null;
  replacementValue: number | null;
  scarcityValue: number | null;
  formatPremium: number | null;
  ageRunwayValue: number | null;
  shortTermWindowScore: number | null;
  runwayPenalty: number | null;
  ageCliffPenalty: number | null;
  veteranProductionCushion: number | null;
  agePenaltyWasSmoothed: boolean;
  ageReason: string | null;
  eliteYoungTeProfile: boolean;
  tePremiumScarcityBoost: number | null;
  teRunwayBoost: number | null;
  teMarketSanityContext: number | null;
  riskAdjustment: number | null;
  trustAdjustment: number | null;
  marketSanityAdjustment: number | null;
  dynastyAssetScore: number | null;
  marketAdp: number | null;
  suggestedDraftSpot: string;
  valueEdge: number | null;
  timingLabel: string;
  explanation: string;
  reviewFlag: string | null;
};

export type DynastyCalibrationAuditReport = {
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  marketFormat: string;
  recommendation: DynastyCalibrationRecommendation;
  summary: {
    rowsAudited: number;
    rowsWithAge: number;
    top50RowsWithAge: number;
    top50AgeCoverageRate: number;
    henryTaylorResolved: boolean;
    bowersExplainable: boolean;
    unsupportedPlayersFiltered: number;
    unsupportedPositionsFiltered: string[];
  };
  rbComparison: DynastyCalibrationAuditRow[];
  teComparison: DynastyCalibrationAuditRow[];
  watchlist: DynastyCalibrationAuditRow[];
  top50: DynastyCalibrationAuditRow[];
  rows: DynastyCalibrationAuditRow[];
};
