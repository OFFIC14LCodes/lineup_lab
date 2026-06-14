// H9-lite projection engine — reason-code registry.
//
// Each code carries a category, the scopes it can appear in, its default
// direction, whether it is league-specific, and an explanation template.
// Templates use {variable} placeholders that the engine fills at emit time.

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type ReasonCode =
  // Sample and coverage
  | "SINGLE_SEASON_ONLY"
  | "AGE_UNKNOWN"
  | "TEAM_STATUS_UNVERIFIED"
  | "NO_QUALIFYING_ROLE_WEEKS"
  // Role classification
  | "ESTABLISHED_FULL_SEASON"
  | "ESTABLISHED_PARTIAL_SEASON"
  | "PART_TIME_CONTRIBUTOR"
  | "BACKUP_OR_SPOT_STARTER"
  | "MINIMAL_SAMPLE"
  | "ROLE_UNKNOWN"
  // TD regression
  | "TD_RATE_REGRESSION_UP"
  | "TD_RATE_REGRESSION_DOWN"
  | "LOW_SAMPLE_TD_REGRESSION"
  | "TD_REFERENCE_POOL_SMALL"
  // Volatility signals
  | "LONG_TD_VOLATILITY"
  | "NON_REPEATABLE_MISC_TD"
  | "TWO_POINT_NOT_PROJECTED"
  | "PICK_RATE_HIGH"
  // Role stability
  | "ROLE_STABILITY_HIGH"
  | "ROLE_CHANGE_EVIDENCE"
  // H8 evidence quality
  | "CONTRADICTORY_EVIDENCE"
  | "STALE_EVIDENCE"
  // Market agreement
  | "MARKET_DISAGREEMENT_HIGH"
  | "MARKET_FORMAT_INCOMPATIBLE"
  | "MARKET_DATA_UNAVAILABLE"
  | "MARKET_DATA_LOW_CONFIDENCE"
  // Scoring edge cases
  | "NEGATIVE_FLOOR_VALID";

export type ReasonCategory =
  | "sample"
  | "role"
  | "regression"
  | "volatility"
  | "stability"
  | "evidence"
  | "market"
  | "scoring";

export type ReasonScope =
  | "games"
  | "passing_td"
  | "rushing_td"
  | "receiving_td"
  | "efficiency"
  | "market"
  | "projection"
  | "h8_priorTargetShare"
  | "h8_priorCarryShare"
  | "h8_priorTeamPassRate"
  | "h8_priorRedZoneShare";

export type ReasonDirection = "up" | "down" | "neutral" | "widened" | "narrowed" | "excluded";

export type ReasonCodeDefinition = {
  category: ReasonCategory;
  allowedScopes: ReasonScope[];
  defaultDirection: ReasonDirection;
  isLeagueSpecific: boolean;
  explanationTemplate: string;
};

// --------------------------------------------------------------------------
// Registry
// --------------------------------------------------------------------------

export const REASON_CODES: Record<ReasonCode, ReasonCodeDefinition> = {
  // ---- Sample and coverage -------------------------------------------------

  SINGLE_SEASON_ONLY: {
    category: "sample",
    allowedScopes: ["projection"],
    defaultDirection: "widened",
    isLeagueSpecific: false,
    explanationTemplate:
      "Projection is based on a single historical season ({historicalSeason}). " +
      "Multi-year patterns are not available in H9-lite; model uncertainty is increased.",
  },

  AGE_UNKNOWN: {
    category: "sample",
    allowedScopes: ["projection"],
    defaultDirection: "neutral",
    isLeagueSpecific: false,
    explanationTemplate:
      "Player age is not available in the canonical record. " +
      "Age-based adjustments (career arc, injury risk) are not applied.",
  },

  TEAM_STATUS_UNVERIFIED: {
    category: "sample",
    allowedScopes: ["projection"],
    defaultDirection: "neutral",
    isLeagueSpecific: false,
    explanationTemplate:
      "Player was recorded on multiple teams in {historicalSeason} or team status for " +
      "{projectionSeason} is unverified. Historical rates may mix role contexts.",
  },

  NO_QUALIFYING_ROLE_WEEKS: {
    category: "sample",
    allowedScopes: ["games", "projection"],
    defaultDirection: "down",
    isLeagueSpecific: false,
    explanationTemplate:
      "Player had zero qualifying role weeks in {historicalSeason} " +
      "(no week exceeded the position minimum-opportunity threshold). " +
      "Projected median points is 0 for this player.",
  },

  // ---- Role classification -------------------------------------------------

  ESTABLISHED_FULL_SEASON: {
    category: "role",
    allowedScopes: ["games", "projection"],
    defaultDirection: "neutral",
    isLeagueSpecific: false,
    explanationTemplate:
      "Player qualifies as ESTABLISHED_FULL_SEASON: " +
      "{historicalActiveWeeks} active weeks and {primaryOpportunity} " +
      "primary opportunity in {historicalSeason}. " +
      "Games projection uses fixed full-season medians.",
  },

  ESTABLISHED_PARTIAL_SEASON: {
    category: "role",
    allowedScopes: ["games", "projection"],
    defaultDirection: "neutral",
    isLeagueSpecific: false,
    explanationTemplate:
      "Player qualifies as ESTABLISHED_PARTIAL_SEASON: " +
      "{historicalActiveWeeks} active weeks and {primaryOpportunity} " +
      "primary opportunity in {historicalSeason}. " +
      "Games projection extends from historical baseline.",
  },

  PART_TIME_CONTRIBUTOR: {
    category: "role",
    allowedScopes: ["games", "projection"],
    defaultDirection: "neutral",
    isLeagueSpecific: false,
    explanationTemplate:
      "Player classifies as PART_TIME_CONTRIBUTOR: sufficient opportunity " +
      "to establish a role ({primaryOpportunity} in {historicalSeason}) " +
      "but below established thresholds.",
  },

  BACKUP_OR_SPOT_STARTER: {
    category: "role",
    allowedScopes: ["games", "projection"],
    defaultDirection: "down",
    isLeagueSpecific: false,
    explanationTemplate:
      "Player classifies as BACKUP_OR_SPOT_STARTER: " +
      "{historicalActiveWeeks} active weeks but only {historicalRoleWeeks} role weeks " +
      "in {historicalSeason}. Role participation factor: {roleParticipationFactor}.",
  },

  MINIMAL_SAMPLE: {
    category: "role",
    allowedScopes: ["games", "projection"],
    defaultDirection: "down",
    isLeagueSpecific: false,
    explanationTemplate:
      "Player has a minimal historical sample: {historicalActiveWeeks} active weeks " +
      "and below minimum-opportunity thresholds in {historicalSeason}. " +
      "Projections carry very high uncertainty.",
  },

  ROLE_UNKNOWN: {
    category: "role",
    allowedScopes: ["games", "projection"],
    defaultDirection: "down",
    isLeagueSpecific: false,
    explanationTemplate:
      "Player role is unknown: minimal historical sample and all applicable H8 " +
      "fields are absent or unknown. Projected role games is 0.",
  },

  // ---- TD regression -------------------------------------------------------

  TD_RATE_REGRESSION_UP: {
    category: "regression",
    allowedScopes: ["passing_td", "rushing_td", "receiving_td"],
    defaultDirection: "up",
    isLeagueSpecific: false,
    explanationTemplate:
      "TD rate regressed upward toward the position reference rate. " +
      "Player rate: {playerRate}/opp, reference rate: {referenceRate}/opp, " +
      "sample weight: {sampleWeight:.2f}, regressed rate: {regressedRate}/opp.",
  },

  TD_RATE_REGRESSION_DOWN: {
    category: "regression",
    allowedScopes: ["passing_td", "rushing_td", "receiving_td"],
    defaultDirection: "down",
    isLeagueSpecific: false,
    explanationTemplate:
      "TD rate regressed downward toward the position reference rate. " +
      "Player rate: {playerRate}/opp, reference rate: {referenceRate}/opp, " +
      "sample weight: {sampleWeight:.2f}, regressed rate: {regressedRate}/opp.",
  },

  LOW_SAMPLE_TD_REGRESSION: {
    category: "regression",
    allowedScopes: ["passing_td", "rushing_td", "receiving_td"],
    defaultDirection: "neutral",
    isLeagueSpecific: false,
    explanationTemplate:
      "TD rate sample is small (opportunity: {opportunity}, K: {kConstant}); " +
      "sample weight is {sampleWeight:.2f}. Rate is weighted primarily toward " +
      "the position reference ({referenceRate}/opp).",
  },

  TD_REFERENCE_POOL_SMALL: {
    category: "regression",
    allowedScopes: ["passing_td", "rushing_td", "receiving_td"],
    defaultDirection: "neutral",
    isLeagueSpecific: false,
    explanationTemplate:
      "Reference population for {tdType} TD rate had fewer than {minPlayers} qualifying " +
      "players; fallback threshold was used (pool size: {poolSize}). " +
      "Reference rate may be less stable.",
  },

  // ---- Volatility signals --------------------------------------------------

  LONG_TD_VOLATILITY: {
    category: "volatility",
    allowedScopes: ["projection"],
    defaultDirection: "widened",
    isLeagueSpecific: false,
    explanationTemplate:
      "Player recorded long-distance touchdowns in {historicalSeason}, " +
      "which increases week-to-week variance. Player volatility increased by {delta}.",
  },

  NON_REPEATABLE_MISC_TD: {
    category: "volatility",
    allowedScopes: ["projection"],
    defaultDirection: "excluded",
    isLeagueSpecific: false,
    explanationTemplate:
      "Player recorded a non-repeatable miscellaneous TD (fumble return or similar) " +
      "in {historicalSeason}. This is excluded from the median projection. " +
      "Minor volatility note applied.",
  },

  TWO_POINT_NOT_PROJECTED: {
    category: "volatility",
    allowedScopes: ["projection"],
    defaultDirection: "excluded",
    isLeagueSpecific: false,
    explanationTemplate:
      "Two-point conversions are excluded from the baseline projection. " +
      "Historical two-point scoring is captured in total points but not carried forward.",
  },

  PICK_RATE_HIGH: {
    category: "volatility",
    allowedScopes: ["efficiency"],
    defaultDirection: "down",
    isLeagueSpecific: true,
    explanationTemplate:
      "Regressed interception rate ({regressedIntRate}/attempt) exceeds the " +
      "position 75th percentile. In leagues with INT penalties, this reduces " +
      "projected points.",
  },

  // ---- Role stability ------------------------------------------------------

  ROLE_STABILITY_HIGH: {
    category: "stability",
    allowedScopes: ["projection", "h8_priorTargetShare", "h8_priorCarryShare"],
    defaultDirection: "narrowed",
    isLeagueSpecific: false,
    explanationTemplate:
      "H8 evidence confirms a stable role (applicable field observed with " +
      "value above threshold). Player volatility reduced by {delta}.",
  },

  ROLE_CHANGE_EVIDENCE: {
    category: "stability",
    allowedScopes: ["projection", "h8_priorTargetShare", "h8_priorCarryShare"],
    defaultDirection: "neutral",
    isLeagueSpecific: false,
    explanationTemplate:
      "H8 evidence indicates a potential role change from {historicalSeason}: " +
      "{fieldName} value ({currentValue}) differs substantially from historical average. " +
      "Projection defaults to historical data — no offseason news ingestion in H9-lite.",
  },

  // ---- H8 evidence quality -------------------------------------------------

  CONTRADICTORY_EVIDENCE: {
    category: "evidence",
    allowedScopes: [
      "projection",
      "h8_priorTargetShare",
      "h8_priorCarryShare",
      "h8_priorTeamPassRate",
      "h8_priorRedZoneShare",
    ],
    defaultDirection: "widened",
    isLeagueSpecific: false,
    explanationTemplate:
      "Contradictory evidence was detected for {fieldName} in the H8 snapshot. " +
      "Confidence reduced and model uncertainty increased.",
  },

  STALE_EVIDENCE: {
    category: "evidence",
    allowedScopes: [
      "projection",
      "h8_priorTargetShare",
      "h8_priorCarryShare",
      "h8_priorTeamPassRate",
      "h8_priorRedZoneShare",
    ],
    defaultDirection: "widened",
    isLeagueSpecific: false,
    explanationTemplate:
      "One or more applicable H8 fields have stale evidence (captured before " +
      "{stalenessThreshold}). Confidence reduced and model uncertainty increased.",
  },

  // ---- Market agreement ----------------------------------------------------

  MARKET_DISAGREEMENT_HIGH: {
    category: "market",
    allowedScopes: ["market"],
    defaultDirection: "neutral",
    isLeagueSpecific: true,
    explanationTemplate:
      "Blackbird projection rank ({projectedRank}) disagrees significantly with " +
      "ADP ({adpRank}). Discrepancy: {discrepancy} positions. This is a market " +
      "signal only — it does not affect projected points.",
  },

  MARKET_FORMAT_INCOMPATIBLE: {
    category: "market",
    allowedScopes: ["market"],
    defaultDirection: "neutral",
    isLeagueSpecific: true,
    explanationTemplate:
      "No compatible ADP data found for this league format " +
      "(PPR value: {pprValue}, TE premium: {tePremium}, dynasty: {isDynasty}). " +
      "Market agreement score is not computed.",
  },

  MARKET_DATA_UNAVAILABLE: {
    category: "market",
    allowedScopes: ["market"],
    defaultDirection: "neutral",
    isLeagueSpecific: true,
    explanationTemplate:
      "No ADP data is available for {projectionSeason}. " +
      "Market agreement score is not computed.",
  },

  MARKET_DATA_LOW_CONFIDENCE: {
    category: "market",
    allowedScopes: ["market"],
    defaultDirection: "neutral",
    isLeagueSpecific: true,
    explanationTemplate:
      "ADP data has low confidence: {reason}. Market agreement score is " +
      "computed but should be interpreted cautiously.",
  },

  // ---- Scoring edge cases --------------------------------------------------

  NEGATIVE_FLOOR_VALID: {
    category: "scoring",
    allowedScopes: ["projection"],
    defaultDirection: "neutral",
    isLeagueSpecific: true,
    explanationTemplate:
      "The projected floor scenario produces negative fantasy points " +
      "({floorPoints}) under this league's scoring rules. This is a valid " +
      "outcome — not an error — for scoring configurations with heavy penalties.",
  },
};
