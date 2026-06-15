// H9-lite projection engine — centralized constants.
//
// Every value here that affects a projection output is included in
// MODEL_CONFIG and therefore in canonical hash payloads. Add new tuning
// constants here, never inline them in engine code.

// --------------------------------------------------------------------------
// Model identity
// --------------------------------------------------------------------------

export const PROJECTION_METHOD = "blackbird_baseline_v1";
export const PROJECTION_VERSION = 1;
export const REASON_CODE_REGISTRY_VERSION = "v1";

// --------------------------------------------------------------------------
// Role-week opportunity thresholds (what counts as a "role week")
// --------------------------------------------------------------------------

export const QB_ROLE_WEEK_MIN_ATTEMPTS = 10;
export const QB_ROLE_WEEK_MIN_CARRIES = 4;   // mobile QB alternative
export const RB_ROLE_WEEK_MIN_CARRIES = 4;
export const RB_ROLE_WEEK_MIN_TARGETS = 2;
export const WR_ROLE_WEEK_MIN_TARGETS = 2;
export const TE_ROLE_WEEK_MIN_TARGETS = 2;

// --------------------------------------------------------------------------
// Role/sample classification thresholds — QB
// --------------------------------------------------------------------------

export const QB_FULL_SEASON_WEEKS = 14;
export const QB_FULL_SEASON_ATTEMPTS = 300;
export const QB_PARTIAL_SEASON_WEEKS = 8;
export const QB_PARTIAL_SEASON_ATTEMPTS = 100;
export const QB_PART_TIME_ATTEMPTS = 50;
export const QB_MIN_SIGNIFICANT_ATTEMPTS = 20;

// --------------------------------------------------------------------------
// Role/sample classification thresholds — RB
// --------------------------------------------------------------------------

export const RB_FULL_SEASON_WEEKS = 14;
export const RB_FULL_SEASON_CARRIES = 150;
export const RB_FULL_SEASON_TARGETS = 60;
export const RB_PARTIAL_SEASON_WEEKS = 8;
export const RB_PARTIAL_SEASON_CARRIES = 60;
export const RB_PARTIAL_SEASON_TARGETS = 25;
export const RB_PART_TIME_CARRIES = 25;
export const RB_PART_TIME_TARGETS = 10;
export const RB_MIN_SIGNIFICANT_CARRIES = 8;
export const RB_MIN_SIGNIFICANT_TARGETS = 4;

// --------------------------------------------------------------------------
// Role/sample classification thresholds — WR
// --------------------------------------------------------------------------

export const WR_FULL_SEASON_WEEKS = 14;
export const WR_FULL_SEASON_TARGETS = 80;
export const WR_PARTIAL_SEASON_WEEKS = 8;
export const WR_PARTIAL_SEASON_TARGETS = 30;
export const WR_PART_TIME_TARGETS = 15;
export const WR_MIN_SIGNIFICANT_TARGETS = 5;

// --------------------------------------------------------------------------
// Role/sample classification thresholds — TE
// --------------------------------------------------------------------------

export const TE_FULL_SEASON_WEEKS = 14;
export const TE_FULL_SEASON_TARGETS = 50;
export const TE_PARTIAL_SEASON_WEEKS = 8;
export const TE_PARTIAL_SEASON_TARGETS = 20;
export const TE_PART_TIME_TARGETS = 10;
export const TE_MIN_SIGNIFICANT_TARGETS = 4;

// --------------------------------------------------------------------------
// Games projection — ESTABLISHED_FULL_SEASON fixed outputs
// --------------------------------------------------------------------------

export const FULL_SEASON_ACTIVE_GAMES_FLOOR = 12;
export const FULL_SEASON_ACTIVE_GAMES_MEDIAN = 15;
export const FULL_SEASON_ACTIVE_GAMES_CEILING = 17;

// --------------------------------------------------------------------------
// TD stabilization constants (Bayesian shrinkage K values)
// sampleWeight = opportunity / (opportunity + K)
// --------------------------------------------------------------------------

export const QB_PASSING_TD_K = 150;
export const QB_RUSHING_TD_K = 25;
export const RB_RUSHING_TD_K = 75;
export const RB_RECEIVING_TD_K = 25;
export const WR_RECEIVING_TD_K = 50;
export const TE_RECEIVING_TD_K = 30;

// --------------------------------------------------------------------------
// Efficiency stabilization constants
// --------------------------------------------------------------------------

export const QB_COMPLETION_RATE_K = 100;
export const QB_YPA_K = 100;
export const QB_INT_RATE_K = 150;
export const RUSH_YPC_K = 50;
export const CATCH_RATE_K = 40;
export const YPT_K = 40;
export const FUMBLES_LOST_RATE_K = 60;

// --------------------------------------------------------------------------
// H9.2 component projection reference and scenario constants
// --------------------------------------------------------------------------

export const EFFICIENCY_REFERENCE_POOL_MIN_PLAYERS = 5;
export const OPPORTUNITY_REFERENCE_POOL_MIN_PLAYERS = 5;

export const QB_EFFICIENCY_REF_MIN_ATTEMPTS = 100;
export const QB_EFFICIENCY_REF_FALLBACK_ATTEMPTS = 50;
export const QB_RUSH_EFFICIENCY_REF_MIN_CARRIES = 15;

export const RB_RUSH_EFFICIENCY_REF_MIN_CARRIES = 40;
export const RB_RUSH_EFFICIENCY_REF_FALLBACK_CARRIES = 20;
export const RB_RECEIVING_EFFICIENCY_REF_MIN_TARGETS = 15;
export const RB_RECEIVING_EFFICIENCY_REF_FALLBACK_TARGETS = 8;

export const WR_RECEIVING_EFFICIENCY_REF_MIN_TARGETS = 25;
export const WR_RECEIVING_EFFICIENCY_REF_FALLBACK_TARGETS = 12;
export const TE_RECEIVING_EFFICIENCY_REF_MIN_TARGETS = 15;
export const TE_RECEIVING_EFFICIENCY_REF_FALLBACK_TARGETS = 8;

export const WR_TE_RUSHING_MATERIAL_CARRIES = 8;
export const WR_TE_RUSHING_MATERIAL_CARRIES_PER_ROLE_WEEK = 0.5;

export const MATERIAL_REGRESSION_PCT_DIFF = 0.15;
export const LOW_SAMPLE_WEIGHT_THRESHOLD = 0.35;

export const OPPORTUNITY_CAP_PERCENTILE = 0.95;
export const OPPORTUNITY_TINY_SAMPLE_ROLE_WEEKS = 4;
export const OPPORTUNITY_TINY_SAMPLE_CAP_MULTIPLIER = 1.15;
export const OPPORTUNITY_REGRESSION_ROLE_WEEK_K = 6;

export const SCENARIO_OPPORTUNITY_RANGE_SHARE = 0.35;
export const SCENARIO_EFFICIENCY_RANGE_SHARE = 0.45;
export const SCENARIO_TD_RANGE_SHARE = 0.75;

// --------------------------------------------------------------------------
// Reference population minimums (for TD regression pools)
// Opportunity threshold AND active-week threshold where shown.
// --------------------------------------------------------------------------

export const REF_POOL_MIN_PLAYERS = 5;         // below this → use fallback threshold

export const QB_PASSING_TD_REF_MIN_ATTEMPTS = 100;
export const QB_PASSING_TD_REF_MIN_WEEKS = 8;
export const QB_PASSING_TD_REF_FALLBACK_ATTEMPTS = 50;

export const QB_RUSHING_TD_REF_MIN_CARRIES = 15;

export const RB_RUSHING_TD_REF_MIN_CARRIES = 40;
export const RB_RUSHING_TD_REF_MIN_WEEKS = 6;
export const RB_RUSHING_TD_REF_FALLBACK_CARRIES = 20;

export const RB_RECEIVING_TD_REF_MIN_TARGETS = 15;
export const RB_RECEIVING_TD_REF_FALLBACK_TARGETS = 8;

export const WR_RECEIVING_TD_REF_MIN_TARGETS = 25;
export const WR_RECEIVING_TD_REF_MIN_WEEKS = 6;
export const WR_RECEIVING_TD_REF_FALLBACK_TARGETS = 12;

export const TE_RECEIVING_TD_REF_MIN_TARGETS = 15;
export const TE_RECEIVING_TD_REF_MIN_WEEKS = 4;
export const TE_RECEIVING_TD_REF_FALLBACK_TARGETS = 8;

// --------------------------------------------------------------------------
// Model uncertainty — base values and additive increments
// --------------------------------------------------------------------------

export const MODEL_UNCERTAINTY_BASE_QB = 0.14;
export const MODEL_UNCERTAINTY_BASE_RB = 0.18;
export const MODEL_UNCERTAINTY_BASE_WR = 0.16;
export const MODEL_UNCERTAINTY_BASE_TE = 0.20;

export const MODEL_UNCERTAINTY_UNKNOWN_APPLICABLE_FIELD = 0.06; // per field, max 2 fields
export const MODEL_UNCERTAINTY_SINGLE_SEASON_ONLY = 0.06;       // always fires in H9-lite
export const MODEL_UNCERTAINTY_MINIMAL_SAMPLE = 0.08;
export const MODEL_UNCERTAINTY_BACKUP_OR_SPOT = 0.05;
export const MODEL_UNCERTAINTY_ROLE_UNKNOWN = 0.04;
export const MODEL_UNCERTAINTY_STALE_EVIDENCE = 0.04;
export const MODEL_UNCERTAINTY_CONTRADICTORY_EVIDENCE = 0.04;
export const MODEL_UNCERTAINTY_ESTABLISHED_OBSERVED = -0.04;    // reduces when applicable H8 field observed

export const MODEL_UNCERTAINTY_MIN = 0.08;
export const MODEL_UNCERTAINTY_MAX = 0.48;

// --------------------------------------------------------------------------
// Player volatility — base values and additive increments
// --------------------------------------------------------------------------

export const PLAYER_VOLATILITY_BASE_QB = 0.10;
export const PLAYER_VOLATILITY_BASE_RB = 0.18;
export const PLAYER_VOLATILITY_BASE_WR = 0.16;
export const PLAYER_VOLATILITY_BASE_TE = 0.18;

export const PLAYER_VOLATILITY_LONG_TD = 0.06;
export const PLAYER_VOLATILITY_MISC_TD = 0.02;
export const PLAYER_VOLATILITY_MULTI_TEAM = 0.05;
export const PLAYER_VOLATILITY_HIGH_PICK_RATE = 0.03;    // QB only
export const PLAYER_VOLATILITY_ROLE_STABILITY_HIGH = -0.04;

export const PLAYER_VOLATILITY_MIN = 0.08;
export const PLAYER_VOLATILITY_MAX = 0.48;

// --------------------------------------------------------------------------
// Scenario range scaling
// --------------------------------------------------------------------------

export const TOTAL_RANGE_WIDTH_MIN = 0.20;
export const TOTAL_RANGE_WIDTH_MAX = 0.80;

export const SCENARIO_FLOOR_SCALE = 0.55;       // component multiplier for floor
export const SCENARIO_CEILING_SCALE = 0.55;     // component multiplier for ceiling
export const SCENARIO_DOWNSIDE_SCALE = 0.85;    // component multiplier for downside
export const SCENARIO_UPSIDE_SCALE = 0.85;      // component multiplier for upside

// --------------------------------------------------------------------------
// Projection confidence adjustments
// --------------------------------------------------------------------------

export const PROJ_CONFIDENCE_BASE = 0.65;

export const PROJ_CONFIDENCE_WEEKS_14_PLUS = 0.10;
export const PROJ_CONFIDENCE_WEEKS_10_TO_13 = 0.04;
export const PROJ_CONFIDENCE_WEEKS_UNDER_6 = -0.10;
export const PROJ_CONFIDENCE_WEEKS_UNDER_3 = -0.18;

export const PROJ_CONFIDENCE_ESTABLISHED_FULL = 0.08;
export const PROJ_CONFIDENCE_ESTABLISHED_PARTIAL = 0.02;
export const PROJ_CONFIDENCE_BACKUP = -0.06;
export const PROJ_CONFIDENCE_MINIMAL = -0.12;
export const PROJ_CONFIDENCE_ROLE_UNKNOWN = -0.12;

export const PROJ_CONFIDENCE_SINGLE_SEASON_ONLY = -0.05;
export const PROJ_CONFIDENCE_CONTRADICTORY = -0.04;
export const PROJ_CONFIDENCE_STALE = -0.03;

// Per applicable H8 field (based on position applicability matrix)
export const PROJ_CONFIDENCE_APPLICABLE_OBSERVED = 0.05;
export const PROJ_CONFIDENCE_APPLICABLE_UNKNOWN_PENALTY = -0.06;

// Secondary fields: capped total penalty
export const PROJ_CONFIDENCE_SECONDARY_UNKNOWN_PENALTY = -0.02;
export const PROJ_CONFIDENCE_SECONDARY_MAX_TOTAL_PENALTY = -0.04;

export const PROJ_CONFIDENCE_MIN = 0.05;
export const PROJ_CONFIDENCE_MAX = 0.95;

// --------------------------------------------------------------------------
// Market agreement thresholds (rank-position gaps)
// --------------------------------------------------------------------------

export const MARKET_AGREEMENT_ALIGNED_THRESHOLD = 5;
export const MARKET_AGREEMENT_SLIGHT_THRESHOLD = 15;
export const MARKET_AGREEMENT_MODERATE_THRESHOLD = 30;
export const MARKET_DATA_STALENESS_DAYS = 60;

// --------------------------------------------------------------------------
// MODEL_CONFIG — canonical serialization of all projection-affecting constants.
// This object is stored in projection_runs.model_config_json and included in
// the run semantic hash. Add any new constant here when it affects outputs.
// --------------------------------------------------------------------------

export const MODEL_CONFIG = {
  projectionMethod: PROJECTION_METHOD,
  projectionVersion: PROJECTION_VERSION,
  reasonCodeRegistryVersion: REASON_CODE_REGISTRY_VERSION,

  // Role-week thresholds
  qbRoleWeekMinAttempts: QB_ROLE_WEEK_MIN_ATTEMPTS,
  qbRoleWeekMinCarries: QB_ROLE_WEEK_MIN_CARRIES,
  rbRoleWeekMinCarries: RB_ROLE_WEEK_MIN_CARRIES,
  rbRoleWeekMinTargets: RB_ROLE_WEEK_MIN_TARGETS,
  wrRoleWeekMinTargets: WR_ROLE_WEEK_MIN_TARGETS,
  teRoleWeekMinTargets: TE_ROLE_WEEK_MIN_TARGETS,

  // QB classification
  qbFullSeasonWeeks: QB_FULL_SEASON_WEEKS,
  qbFullSeasonAttempts: QB_FULL_SEASON_ATTEMPTS,
  qbPartialSeasonWeeks: QB_PARTIAL_SEASON_WEEKS,
  qbPartialSeasonAttempts: QB_PARTIAL_SEASON_ATTEMPTS,
  qbPartTimeAttempts: QB_PART_TIME_ATTEMPTS,
  qbMinSignificantAttempts: QB_MIN_SIGNIFICANT_ATTEMPTS,

  // RB classification
  rbFullSeasonWeeks: RB_FULL_SEASON_WEEKS,
  rbFullSeasonCarries: RB_FULL_SEASON_CARRIES,
  rbFullSeasonTargets: RB_FULL_SEASON_TARGETS,
  rbPartialSeasonWeeks: RB_PARTIAL_SEASON_WEEKS,
  rbPartialSeasonCarries: RB_PARTIAL_SEASON_CARRIES,
  rbPartialSeasonTargets: RB_PARTIAL_SEASON_TARGETS,
  rbPartTimeCarries: RB_PART_TIME_CARRIES,
  rbPartTimeTargets: RB_PART_TIME_TARGETS,
  rbMinSignificantCarries: RB_MIN_SIGNIFICANT_CARRIES,
  rbMinSignificantTargets: RB_MIN_SIGNIFICANT_TARGETS,

  // WR classification
  wrFullSeasonWeeks: WR_FULL_SEASON_WEEKS,
  wrFullSeasonTargets: WR_FULL_SEASON_TARGETS,
  wrPartialSeasonWeeks: WR_PARTIAL_SEASON_WEEKS,
  wrPartialSeasonTargets: WR_PARTIAL_SEASON_TARGETS,
  wrPartTimeTargets: WR_PART_TIME_TARGETS,
  wrMinSignificantTargets: WR_MIN_SIGNIFICANT_TARGETS,

  // TE classification
  teFullSeasonWeeks: TE_FULL_SEASON_WEEKS,
  teFullSeasonTargets: TE_FULL_SEASON_TARGETS,
  tePartialSeasonWeeks: TE_PARTIAL_SEASON_WEEKS,
  tePartialSeasonTargets: TE_PARTIAL_SEASON_TARGETS,
  tePartTimeTargets: TE_PART_TIME_TARGETS,
  teMinSignificantTargets: TE_MIN_SIGNIFICANT_TARGETS,

  // Games projection fixed values
  fullSeasonActiveGamesFloor: FULL_SEASON_ACTIVE_GAMES_FLOOR,
  fullSeasonActiveGamesMedian: FULL_SEASON_ACTIVE_GAMES_MEDIAN,
  fullSeasonActiveGamesCeiling: FULL_SEASON_ACTIVE_GAMES_CEILING,

  // TD stabilization
  qbPassingTdK: QB_PASSING_TD_K,
  qbRushingTdK: QB_RUSHING_TD_K,
  rbRushingTdK: RB_RUSHING_TD_K,
  rbReceivingTdK: RB_RECEIVING_TD_K,
  wrReceivingTdK: WR_RECEIVING_TD_K,
  teReceivingTdK: TE_RECEIVING_TD_K,

  // Efficiency stabilization
  qbCompletionRateK: QB_COMPLETION_RATE_K,
  qbYpaK: QB_YPA_K,
  qbIntRateK: QB_INT_RATE_K,
  rushYpcK: RUSH_YPC_K,
  catchRateK: CATCH_RATE_K,
  yptK: YPT_K,
  fumblesLostRateK: FUMBLES_LOST_RATE_K,

  // H9.2 component references and scenarios
  efficiencyReferencePoolMinPlayers: EFFICIENCY_REFERENCE_POOL_MIN_PLAYERS,
  opportunityReferencePoolMinPlayers: OPPORTUNITY_REFERENCE_POOL_MIN_PLAYERS,
  qbEfficiencyRefMinAttempts: QB_EFFICIENCY_REF_MIN_ATTEMPTS,
  qbEfficiencyRefFallbackAttempts: QB_EFFICIENCY_REF_FALLBACK_ATTEMPTS,
  qbRushEfficiencyRefMinCarries: QB_RUSH_EFFICIENCY_REF_MIN_CARRIES,
  rbRushEfficiencyRefMinCarries: RB_RUSH_EFFICIENCY_REF_MIN_CARRIES,
  rbRushEfficiencyRefFallbackCarries: RB_RUSH_EFFICIENCY_REF_FALLBACK_CARRIES,
  rbReceivingEfficiencyRefMinTargets: RB_RECEIVING_EFFICIENCY_REF_MIN_TARGETS,
  rbReceivingEfficiencyRefFallbackTargets: RB_RECEIVING_EFFICIENCY_REF_FALLBACK_TARGETS,
  wrReceivingEfficiencyRefMinTargets: WR_RECEIVING_EFFICIENCY_REF_MIN_TARGETS,
  wrReceivingEfficiencyRefFallbackTargets: WR_RECEIVING_EFFICIENCY_REF_FALLBACK_TARGETS,
  teReceivingEfficiencyRefMinTargets: TE_RECEIVING_EFFICIENCY_REF_MIN_TARGETS,
  teReceivingEfficiencyRefFallbackTargets: TE_RECEIVING_EFFICIENCY_REF_FALLBACK_TARGETS,
  wrTeRushingMaterialCarries: WR_TE_RUSHING_MATERIAL_CARRIES,
  wrTeRushingMaterialCarriesPerRoleWeek: WR_TE_RUSHING_MATERIAL_CARRIES_PER_ROLE_WEEK,
  materialRegressionPctDiff: MATERIAL_REGRESSION_PCT_DIFF,
  lowSampleWeightThreshold: LOW_SAMPLE_WEIGHT_THRESHOLD,
  opportunityCapPercentile: OPPORTUNITY_CAP_PERCENTILE,
  opportunityTinySampleRoleWeeks: OPPORTUNITY_TINY_SAMPLE_ROLE_WEEKS,
  opportunityTinySampleCapMultiplier: OPPORTUNITY_TINY_SAMPLE_CAP_MULTIPLIER,
  opportunityRegressionRoleWeekK: OPPORTUNITY_REGRESSION_ROLE_WEEK_K,
  scenarioOpportunityRangeShare: SCENARIO_OPPORTUNITY_RANGE_SHARE,
  scenarioEfficiencyRangeShare: SCENARIO_EFFICIENCY_RANGE_SHARE,
  scenarioTdRangeShare: SCENARIO_TD_RANGE_SHARE,

  // Reference pool
  refPoolMinPlayers: REF_POOL_MIN_PLAYERS,
  qbPassingTdRefMinAttempts: QB_PASSING_TD_REF_MIN_ATTEMPTS,
  qbPassingTdRefMinWeeks: QB_PASSING_TD_REF_MIN_WEEKS,
  qbPassingTdRefFallbackAttempts: QB_PASSING_TD_REF_FALLBACK_ATTEMPTS,
  qbRushingTdRefMinCarries: QB_RUSHING_TD_REF_MIN_CARRIES,
  rbRushingTdRefMinCarries: RB_RUSHING_TD_REF_MIN_CARRIES,
  rbRushingTdRefMinWeeks: RB_RUSHING_TD_REF_MIN_WEEKS,
  rbRushingTdRefFallbackCarries: RB_RUSHING_TD_REF_FALLBACK_CARRIES,
  rbReceivingTdRefMinTargets: RB_RECEIVING_TD_REF_MIN_TARGETS,
  rbReceivingTdRefFallbackTargets: RB_RECEIVING_TD_REF_FALLBACK_TARGETS,
  wrReceivingTdRefMinTargets: WR_RECEIVING_TD_REF_MIN_TARGETS,
  wrReceivingTdRefMinWeeks: WR_RECEIVING_TD_REF_MIN_WEEKS,
  wrReceivingTdRefFallbackTargets: WR_RECEIVING_TD_REF_FALLBACK_TARGETS,
  teReceivingTdRefMinTargets: TE_RECEIVING_TD_REF_MIN_TARGETS,
  teReceivingTdRefMinWeeks: TE_RECEIVING_TD_REF_MIN_WEEKS,
  teReceivingTdRefFallbackTargets: TE_RECEIVING_TD_REF_FALLBACK_TARGETS,

  // Model uncertainty
  modelUncertaintyBaseQb: MODEL_UNCERTAINTY_BASE_QB,
  modelUncertaintyBaseRb: MODEL_UNCERTAINTY_BASE_RB,
  modelUncertaintyBaseWr: MODEL_UNCERTAINTY_BASE_WR,
  modelUncertaintyBaseTe: MODEL_UNCERTAINTY_BASE_TE,
  modelUncertaintyUnknownApplicableField: MODEL_UNCERTAINTY_UNKNOWN_APPLICABLE_FIELD,
  modelUncertaintySingleSeasonOnly: MODEL_UNCERTAINTY_SINGLE_SEASON_ONLY,
  modelUncertaintyMinimalSample: MODEL_UNCERTAINTY_MINIMAL_SAMPLE,
  modelUncertaintyBackupOrSpot: MODEL_UNCERTAINTY_BACKUP_OR_SPOT,
  modelUncertaintyRoleUnknown: MODEL_UNCERTAINTY_ROLE_UNKNOWN,
  modelUncertaintyStaleEvidence: MODEL_UNCERTAINTY_STALE_EVIDENCE,
  modelUncertaintyContradictoryEvidence: MODEL_UNCERTAINTY_CONTRADICTORY_EVIDENCE,
  modelUncertaintyEstablishedObserved: MODEL_UNCERTAINTY_ESTABLISHED_OBSERVED,
  modelUncertaintyMin: MODEL_UNCERTAINTY_MIN,
  modelUncertaintyMax: MODEL_UNCERTAINTY_MAX,

  // Player volatility
  playerVolatilityBaseQb: PLAYER_VOLATILITY_BASE_QB,
  playerVolatilityBaseRb: PLAYER_VOLATILITY_BASE_RB,
  playerVolatilityBaseWr: PLAYER_VOLATILITY_BASE_WR,
  playerVolatilityBaseTe: PLAYER_VOLATILITY_BASE_TE,
  playerVolatilityLongTd: PLAYER_VOLATILITY_LONG_TD,
  playerVolatilityMiscTd: PLAYER_VOLATILITY_MISC_TD,
  playerVolatilityMultiTeam: PLAYER_VOLATILITY_MULTI_TEAM,
  playerVolatilityHighPickRate: PLAYER_VOLATILITY_HIGH_PICK_RATE,
  playerVolatilityRoleStabilityHigh: PLAYER_VOLATILITY_ROLE_STABILITY_HIGH,
  playerVolatilityMin: PLAYER_VOLATILITY_MIN,
  playerVolatilityMax: PLAYER_VOLATILITY_MAX,

  // Scenario scaling
  totalRangeWidthMin: TOTAL_RANGE_WIDTH_MIN,
  totalRangeWidthMax: TOTAL_RANGE_WIDTH_MAX,
  scenarioFloorScale: SCENARIO_FLOOR_SCALE,
  scenarioCeilingScale: SCENARIO_CEILING_SCALE,
  scenarioDownsideScale: SCENARIO_DOWNSIDE_SCALE,
  scenarioUpsideScale: SCENARIO_UPSIDE_SCALE,

  // Confidence adjustments
  projConfidenceBase: PROJ_CONFIDENCE_BASE,
  projConfidenceWeeks14Plus: PROJ_CONFIDENCE_WEEKS_14_PLUS,
  projConfidenceWeeks10To13: PROJ_CONFIDENCE_WEEKS_10_TO_13,
  projConfidenceWeeksUnder6: PROJ_CONFIDENCE_WEEKS_UNDER_6,
  projConfidenceWeeksUnder3: PROJ_CONFIDENCE_WEEKS_UNDER_3,
  projConfidenceEstablishedFull: PROJ_CONFIDENCE_ESTABLISHED_FULL,
  projConfidenceEstablishedPartial: PROJ_CONFIDENCE_ESTABLISHED_PARTIAL,
  projConfidenceBackup: PROJ_CONFIDENCE_BACKUP,
  projConfidenceMinimal: PROJ_CONFIDENCE_MINIMAL,
  projConfidenceRoleUnknown: PROJ_CONFIDENCE_ROLE_UNKNOWN,
  projConfidenceSingleSeasonOnly: PROJ_CONFIDENCE_SINGLE_SEASON_ONLY,
  projConfidenceContradictory: PROJ_CONFIDENCE_CONTRADICTORY,
  projConfidenceStale: PROJ_CONFIDENCE_STALE,
  projConfidenceApplicableObserved: PROJ_CONFIDENCE_APPLICABLE_OBSERVED,
  projConfidenceApplicableUnknownPenalty: PROJ_CONFIDENCE_APPLICABLE_UNKNOWN_PENALTY,
  projConfidenceSecondaryUnknownPenalty: PROJ_CONFIDENCE_SECONDARY_UNKNOWN_PENALTY,
  projConfidenceSecondaryMaxTotalPenalty: PROJ_CONFIDENCE_SECONDARY_MAX_TOTAL_PENALTY,
  projConfidenceMin: PROJ_CONFIDENCE_MIN,
  projConfidenceMax: PROJ_CONFIDENCE_MAX,

  // Market agreement
  marketAgreementAlignedThreshold: MARKET_AGREEMENT_ALIGNED_THRESHOLD,
  marketAgreementSlightThreshold: MARKET_AGREEMENT_SLIGHT_THRESHOLD,
  marketAgreementModerateThreshold: MARKET_AGREEMENT_MODERATE_THRESHOLD,
  marketDataStalenessDays: MARKET_DATA_STALENESS_DAYS,
} as const;

export type ModelConfig = typeof MODEL_CONFIG;
