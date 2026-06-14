// H8: Player context and evidence type system.
// All types are serialization-friendly (no class instances, no Date objects).
// Dates are ISO 8601 strings. Status fields are always explicit — never use null to mean "unknown".

// --------------------------------------------------------------------------
// Core status and confidence primitives
// --------------------------------------------------------------------------

export type ContextFieldStatus =
  | "observed"       // Directly recorded from a source (fact)
  | "inferred"       // Derived by model or reasoning from observed facts
  | "unknown"        // Explicitly unknown — do not treat as neutral
  | "contradicted"   // Two or more sources conflict; interpretation pending
  | "stale"          // Was observed but has passed its expiration window
  | "not_applicable"; // Field does not apply to this player/position/situation

export type ContextConfidence =
  | "verified"   // Multiple tier-1 sources agree; no contradictions
  | "high"       // Direct quote or official source; one contradiction max
  | "moderate"   // Credible source; some uncertainty or recency gap
  | "low"        // Weak source, indirect inference, or significant uncertainty
  | "unresolved"; // Cannot assign confidence — missing or contradictory

export type ContextStatus =
  | "current"
  | "stale"
  | "contradicted"
  | "unknown"
  | "not_applicable";

// --------------------------------------------------------------------------
// Evidence categories and reliability
// --------------------------------------------------------------------------

export type EvidenceCategory =
  | "official_team"
  | "official_league"
  | "coach_quote"
  | "depth_chart"
  | "beat_report"
  | "transaction"
  | "contract"
  | "injury_report"
  | "practice_participation"
  | "game_usage"
  | "historical_stat"
  | "roster_move"
  | "suspension"
  | "manual_review"
  | "user_entered"
  | "model_inference";

// 1 = official/highest; 4 = unverified community report
export type ReliabilityTier = 1 | 2 | 3 | 4;

export type ReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "superseded"
  | "needs_more_evidence";

export type ExpirationPolicy =
  | "until_superseded"    // Transactions, contracts — persist until replaced
  | "injury_report"       // 3–7 days
  | "practice_report"     // Until next official report
  | "depth_chart"         // 14–30 days or roster event
  | "coach_quote"         // Until camp/preseason role change
  | "seasonal"            // Valid for the season, lower confidence after coaching change
  | "none";               // Does not expire

// --------------------------------------------------------------------------
// Evidence record (immutable)
// --------------------------------------------------------------------------

export type EvidenceRecord = {
  evidenceId: string;           // Deterministic hash of source + content
  sourceType: EvidenceCategory;
  sourceName: string | null;
  sourceUrl: string | null;
  sourceIdentifier: string | null;
  author: string | null;
  organization: string | null;
  publishedAt: string | null;   // ISO 8601
  capturedAt: string;           // ISO 8601 — when Blackbird ingested it
  effectiveDate: string | null; // ISO 8601 date — when the claim is effective
  season: number | null;
  playerId: string | null;      // canonical player UUID
  teamId: string | null;        // NFL team ID
  evidenceCategory: EvidenceCategory;
  normalizedClaim: string;      // Concise factual statement (not copyrighted prose)
  rawExcerpt: string | null;    // Short compliant excerpt or null
  isObserved: boolean;          // true = direct fact; false = inferred
  confidence: number;           // 0–1
  reliabilityTier: ReliabilityTier;
  expirationPolicy: ExpirationPolicy;
  expiresAt: string | null;     // ISO 8601 or null
  sourceHash: string | null;    // SHA-256 of source content for deduplication
  parserVersion: string | null;
  reviewStatus: ReviewStatus;
};

// --------------------------------------------------------------------------
// Context field value (generic wrapper)
// --------------------------------------------------------------------------

export type ContextFieldValue<T> = {
  value: T | null;
  valueType: string;              // e.g. "string" | "number" | "boolean" | "ordinal" | "probability"
  status: ContextFieldStatus;
  confidence: ContextConfidence;
  evidenceIds: string[];          // references EvidenceRecord.evidenceId
  observedAt: string | null;
  effectiveFrom: string | null;
  expiresAt: string | null;
  lastReviewedAt: string | null;
  inferenceMethod: string | null; // e.g. "derived_from_h2_pbp" | "coach_statement_inferred"
  contradictionCount: number;
};

// Helper for creating unknown fields — explicit, never neutral
export function unknownField<T>(): ContextFieldValue<T> {
  return {
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
  };
}

// --------------------------------------------------------------------------
// Expectation range (used for share/probability fields)
// --------------------------------------------------------------------------

export type ExpectationRange = {
  low: number | null;
  median: number | null;
  high: number | null;
  confidence: ContextConfidence;
  evidenceIds: string[];
};

// --------------------------------------------------------------------------
// Role scenario
// --------------------------------------------------------------------------

export type RoleScenario = {
  scenarioType: "downside" | "median" | "upside";
  roleLabel: string;
  probability: number | null;   // null if not supportable numerically
  triggers: string[];
  evidenceIds: string[];
};

export type RoleProbabilityModel = {
  downsideRole: string | null;
  medianRole: string | null;
  upsideRole: string | null;
  downsideProbability: number | null;
  medianProbability: number | null;
  upsideProbability: number | null;
  probabilitiesKnown: boolean;  // false if numerics not supportable
  roleTransitionTriggers: string[];
  roleLossTriggers: string[];
  scenarios: RoleScenario[];
};

// --------------------------------------------------------------------------
// Player role profile (position-neutral general fields)
// --------------------------------------------------------------------------

export type RosterStatus = "active" | "injured_reserve" | "pup" | "suspended" | "practice_squad" | "cut" | "unknown";

export type PlayerRoleProfile = {
  rosterStatus: ContextFieldValue<RosterStatus>;
  depthChartPosition: ContextFieldValue<string>;
  projectedDepthChartRank: ContextFieldValue<number>;
  starterProbability: ContextFieldValue<number>;
  roleSecurity: ContextFieldValue<"locked_in" | "strong" | "moderate" | "tenuous" | "competition" | "unknown">;
  snapShareExpectation: ContextFieldValue<ExpectationRange>;
  opportunityShareExpectation: ContextFieldValue<ExpectationRange>;
  activeRosterProbability: ContextFieldValue<number>;
  gameDayActiveProbability: ContextFieldValue<number>;
  positionEligibility: ContextFieldValue<string[]>;
  primaryRole: ContextFieldValue<string>;
  secondaryRole: ContextFieldValue<string>;
  specialTeamsRole: ContextFieldValue<string>;
  probabilityModel: RoleProbabilityModel;
};

// --------------------------------------------------------------------------
// Position-specific role profiles
// --------------------------------------------------------------------------

export type QBRoleProfile = {
  startingQBProbability: ContextFieldValue<number>;
  backupRank: ContextFieldValue<number>;
  designedRushRole: ContextFieldValue<"starter_scheme" | "moderate" | "minimal" | "none" | "unknown">;
  goalLineRushRole: ContextFieldValue<"primary" | "packages" | "none" | "unknown">;
  benchRisk: ContextFieldValue<"high" | "moderate" | "low" | "unknown">;
  competitionStatus: ContextFieldValue<"open_competition" | "incumbent" | "depth_only" | "unknown">;
};

export type RBRoleProfile = {
  earlyDownRole: ContextFieldValue<"lead" | "rotational" | "situational" | "none" | "unknown">;
  thirdDownRole: ContextFieldValue<"primary" | "rotational" | "none" | "unknown">;
  goalLineRole: ContextFieldValue<"primary" | "packages" | "none" | "unknown">;
  twoMinuteRole: ContextFieldValue<"primary" | "rotational" | "none" | "unknown">;
  targetRole: ContextFieldValue<"featured" | "rotational" | "minimal" | "none" | "unknown">;
  carryShareExpectation: ContextFieldValue<ExpectationRange>;
  routeShareExpectation: ContextFieldValue<ExpectationRange>;
  committeeProbability: ContextFieldValue<number>;
};

export type WRRoleProfile = {
  outsideSlotRole: ContextFieldValue<"outside" | "slot" | "hybrid" | "unknown">;
  routeParticipationExpectation: ContextFieldValue<ExpectationRange>;
  targetRankExpectation: ContextFieldValue<number>;
  deepTargetRole: ContextFieldValue<"primary" | "occasional" | "none" | "unknown">;
  redZoneRole: ContextFieldValue<"primary" | "rotational" | "none" | "unknown">;
  motionUsageExpectation: ContextFieldValue<"high" | "moderate" | "low" | "unknown">;
  personnelPackageRole: ContextFieldValue<string>;
};

export type TERoleProfile = {
  inlineSlotWideRole: ContextFieldValue<"inline" | "slot" | "wide" | "hybrid" | "unknown">;
  routeParticipationExpectation: ContextFieldValue<ExpectationRange>;
  blockingBurden: ContextFieldValue<"heavy" | "moderate" | "light" | "minimal" | "unknown">;
  targetRankExpectation: ContextFieldValue<number>;
  redZoneRole: ContextFieldValue<"primary" | "rotational" | "none" | "unknown">;
  personnelPackageRole: ContextFieldValue<string>;
};

// --------------------------------------------------------------------------
// Competition profile
// --------------------------------------------------------------------------

export type CompetitionProfile = {
  competingPlayerIds: ContextFieldValue<string[]>;
  competitionByRole: ContextFieldValue<Record<string, string[]>>;
  competitionStrength: ContextFieldValue<"heavy" | "moderate" | "light" | "none" | "unknown">;
  returningTargetShare: ContextFieldValue<number>;
  returningCarryShare: ContextFieldValue<number>;
  returningRouteShare: ContextFieldValue<number>;
  vacatedTargets: ContextFieldValue<number>;
  vacatedCarries: ContextFieldValue<number>;
  vacatedRoutes: ContextFieldValue<number>;
  vacatedRedZoneTargets: ContextFieldValue<number>;
  vacatedGoalLineCarries: ContextFieldValue<number>;
  teammateAdditionImpact: ContextFieldValue<"significant" | "moderate" | "minimal" | "none" | "unknown">;
  teammateDepartureImpact: ContextFieldValue<"significant" | "moderate" | "minimal" | "none" | "unknown">;
  roleConcentration: ContextFieldValue<"concentrated" | "distributed" | "unknown">;
  opportunityConcentration: ContextFieldValue<"concentrated" | "distributed" | "unknown">;
  competitionConfidence: ContextConfidence;
};

// --------------------------------------------------------------------------
// Ordinal grades (used when quantitative grades are unavailable)
// --------------------------------------------------------------------------

export type OrdinalGrade = "elite" | "strong" | "average" | "weak" | "unknown";

// --------------------------------------------------------------------------
// QB environment profile (for RB/WR/TE)
// --------------------------------------------------------------------------

export type QBEnvironmentProfile = {
  projectedStartingQBId: ContextFieldValue<string>;
  startingQBConfidence: ContextConfidence;
  backupQBIds: ContextFieldValue<string[]>;
  qbChangeFromPriorSeason: ContextFieldValue<boolean>;
  passingEfficiencyContext: ContextFieldValue<OrdinalGrade>;
  sackRateContext: ContextFieldValue<OrdinalGrade>;
  pressureHandlingContext: ContextFieldValue<OrdinalGrade>;
  deepBallContext: ContextFieldValue<OrdinalGrade>;
  shortAreaAccuracyContext: ContextFieldValue<OrdinalGrade>;
  scramblingImpact: ContextFieldValue<"high" | "moderate" | "low" | "unknown">;
  checkdownTendency: ContextFieldValue<"high" | "moderate" | "low" | "unknown">;
  targetDistributionTendency: ContextFieldValue<"concentrated" | "distributed" | "unknown">;
  qbStability: ContextFieldValue<"locked" | "probable" | "uncertain" | "competition" | "unknown">;
  qbEnvironmentConfidence: ContextConfidence;
};

// --------------------------------------------------------------------------
// Offensive line context
// --------------------------------------------------------------------------

export type OLContext = {
  projectedStartingOL: ContextFieldValue<string[]>;
  returningStarterCount: ContextFieldValue<number>;
  continuityScore: ContextFieldValue<OrdinalGrade>;
  passProtectionContext: ContextFieldValue<OrdinalGrade>;
  runBlockingContext: ContextFieldValue<OrdinalGrade>;
  interiorLineContext: ContextFieldValue<OrdinalGrade>;
  tackleContext: ContextFieldValue<OrdinalGrade>;
  injuryRisk: ContextFieldValue<"high" | "moderate" | "low" | "unknown">;
  depthQuality: ContextFieldValue<OrdinalGrade>;
  lineChangeMagnitude: ContextFieldValue<"major" | "moderate" | "minor" | "none" | "unknown">;
  evidenceConfidence: ContextConfidence;
};

// --------------------------------------------------------------------------
// Team environment profile
// --------------------------------------------------------------------------

export type TeamEnvironmentProfile = {
  teamId: string;
  season: number;
  quarterbackEnvironment: ContextFieldValue<OrdinalGrade>;
  offensiveLineEnvironment: ContextFieldValue<OrdinalGrade>;
  expectedPassRate: ContextFieldValue<number>;
  expectedRushRate: ContextFieldValue<number>;
  expectedPace: ContextFieldValue<OrdinalGrade>;
  expectedScoringEnvironment: ContextFieldValue<OrdinalGrade>;
  offensiveContinuity: ContextFieldValue<OrdinalGrade>;
  coachingContinuity: ContextFieldValue<OrdinalGrade>;
  coordinatorContinuity: ContextFieldValue<OrdinalGrade>;
  schemeChangeMagnitude: ContextFieldValue<"major" | "moderate" | "minor" | "none" | "unknown">;
  personnelContinuity: ContextFieldValue<OrdinalGrade>;
  redZoneEfficiencyContext: ContextFieldValue<OrdinalGrade>;
  passProtectionContext: ContextFieldValue<OrdinalGrade>;
  runBlockingContext: ContextFieldValue<OrdinalGrade>;
  offensiveUncertainty: ContextFieldValue<"high" | "moderate" | "low">;
  environmentConfidence: ContextConfidence;
};

// --------------------------------------------------------------------------
// Coaching and scheme profile
// --------------------------------------------------------------------------

export type CoachingSchemeProfile = {
  headCoach: ContextFieldValue<string>;
  offensiveCoordinator: ContextFieldValue<string>;
  playCaller: ContextFieldValue<string>;
  quarterbackCoach: ContextFieldValue<string>;
  coachingChange: ContextFieldValue<boolean>;
  coordinatorChange: ContextFieldValue<boolean>;
  playCallerChange: ContextFieldValue<boolean>;
  schemeFamily: ContextFieldValue<string>;
  personnelUsage: ContextFieldValue<string>;
  baseFormationTendencies: ContextFieldValue<string>;
  motionTendency: ContextFieldValue<"high" | "moderate" | "low" | "unknown">;
  playActionTendency: ContextFieldValue<"high" | "moderate" | "low" | "unknown">;
  shotgunRateContext: ContextFieldValue<OrdinalGrade>;
  underCenterRateContext: ContextFieldValue<OrdinalGrade>;
  neutralPassRateContext: ContextFieldValue<number>;
  earlyDownPassRateContext: ContextFieldValue<number>;
  paceContext: ContextFieldValue<OrdinalGrade>;
  runningBackCommitteeHistory: ContextFieldValue<"consistent_committee" | "bellcow_history" | "mixed" | "unknown">;
  tightEndUsageHistory: ContextFieldValue<"featured" | "complementary" | "minimal" | "unknown">;
  targetConcentrationHistory: ContextFieldValue<"concentrated" | "distributed" | "unknown">;
  schemeConfidence: ContextConfidence;
};

// --------------------------------------------------------------------------
// Injury and availability profile
// --------------------------------------------------------------------------

export type InjuryAvailabilityProfile = {
  currentInjuryStatus: ContextFieldValue<"healthy" | "limited" | "questionable" | "doubtful" | "out" | "ir" | "pup" | "unknown">;
  injuryType: ContextFieldValue<string>;
  bodyArea: ContextFieldValue<string>;
  dateReported: ContextFieldValue<string>;
  surgeryStatus: ContextFieldValue<"none" | "scheduled" | "completed" | "unknown">;
  practiceStatus: ContextFieldValue<"full" | "limited" | "dnp" | "unknown">;
  expectedReturnWindow: ContextFieldValue<string>;
  pupStatus: ContextFieldValue<boolean>;
  irStatus: ContextFieldValue<boolean>;
  suspensionStatus: ContextFieldValue<boolean>;
  suspensionGames: ContextFieldValue<number>;
  workloadRestriction: ContextFieldValue<"none" | "limited" | "full_restriction" | "unknown">;
  reinjuryRisk: ContextFieldValue<"high" | "moderate" | "low" | "unknown">;
  availabilityProbability: ContextFieldValue<number>;
  limitationConfidence: ContextConfidence;
  sourceRecency: ContextFieldValue<string>;
  staleAfterDays: number;
};

// --------------------------------------------------------------------------
// Transaction and contract context
// --------------------------------------------------------------------------

export type TransactionContext = {
  contractYearsRemaining: ContextFieldValue<number>;
  guaranteedMoneyContext: ContextFieldValue<"fully_guaranteed" | "partially_guaranteed" | "none" | "unknown">;
  rosterBonusDates: ContextFieldValue<string[]>;
  teamOption: ContextFieldValue<boolean>;
  franchiseTag: ContextFieldValue<boolean>;
  tradeStatus: ContextFieldValue<"traded" | "trade_rumor" | "not_traded" | "unknown">;
  recentSigning: ContextFieldValue<boolean>;
  recentTrade: ContextFieldValue<boolean>;
  draftCapital: ContextFieldValue<string>;
  teamInvestmentLevel: ContextFieldValue<"elite" | "high" | "moderate" | "low" | "unknown">;
  cutRisk: ContextFieldValue<"high" | "moderate" | "low" | "unknown">;
  contractRoleSecurity: ContextFieldValue<"secured" | "incentive_dependent" | "at_risk" | "unknown">;
  transactionConfidence: ContextConfidence;
};

// --------------------------------------------------------------------------
// Historical-to-current comparison (structured deltas)
// --------------------------------------------------------------------------

export type TrendDirection = "rising" | "stable" | "falling" | "unknown";

export type HistoricalComparison = {
  priorSeasonActualRole: ContextFieldValue<string>;
  currentExpectedRole: ContextFieldValue<string>;
  roleChangeDirection: ContextFieldValue<TrendDirection>;
  teamChange: ContextFieldValue<boolean>;
  coachingChange: ContextFieldValue<boolean>;
  teammateCompetitionChange: ContextFieldValue<"more" | "less" | "similar" | "unknown">;
  quarterbackChange: ContextFieldValue<boolean>;
  offensiveLineChange: ContextFieldValue<"improved" | "declined" | "similar" | "unknown">;
  roleTrend: TrendDirection;
  competitionTrend: TrendDirection;
  environmentTrend: TrendDirection;
  healthTrend: TrendDirection;
  opportunityTrend: TrendDirection;
};

// --------------------------------------------------------------------------
// Blackbird-derived context (from H1/H2/H5 historical data)
// --------------------------------------------------------------------------

export type BlackbirdDerivedContext = {
  // From H2 PBP
  priorSnapProxy: ContextFieldValue<number | null>;        // Estimated snap count from H2 (not official)
  priorTargetShare: ContextFieldValue<number | null>;
  priorCarryShare: ContextFieldValue<number | null>;
  priorRedZoneShare: ContextFieldValue<number | null>;
  priorGoalLineShare: ContextFieldValue<number | null>;
  priorTeamPassRate: ContextFieldValue<number | null>;
  priorTeamRushRate: ContextFieldValue<number | null>;
  priorEarlyDownPassRate: ContextFieldValue<number | null>;
  priorTargetConcentration: ContextFieldValue<"concentrated" | "distributed" | "unknown">;
  priorPositionalUsage: ContextFieldValue<Record<string, number> | null>;
  derivedSeason: number | null;
  derivedFromDataVersion: string | null;
  // Backlogged fields (require new PBP columns or new data sources)
  backlogs: string[];
};

// --------------------------------------------------------------------------
// Contradiction record
// --------------------------------------------------------------------------

export type ContradictionRecord = {
  fieldPath: string;
  winningEvidenceId: string | null;
  supersededEvidenceIds: string[];
  contradictionReason: string;
  resolutionMethod: "reliability_tier" | "recency" | "manual_override" | "unresolved";
  manualReviewRequired: boolean;
  resolvedAt: string | null;
};

// --------------------------------------------------------------------------
// Player context snapshot (the main entity)
// --------------------------------------------------------------------------

export type PlayerSituationProfile = {
  canonicalPlayerId: string;
  season: number;
  nflTeam: string | null;
  position: string | null;
  asOfDate: string;
  createdAt: string;
  updatedAt: string;
  contextVersion: number;
  sourceCoverageVersion: string;
  overallConfidence: ContextConfidence;
  overallStatus: ContextStatus;
  staleFieldCount: number;
  unresolvedFieldCount: number;

  // Composite profiles
  roleProfile: PlayerRoleProfile;
  qbRoleProfile: QBRoleProfile | null;     // QB-specific (null for non-QB)
  rbRoleProfile: RBRoleProfile | null;
  wrRoleProfile: WRRoleProfile | null;
  teRoleProfile: TERoleProfile | null;
  competitionProfile: CompetitionProfile;
  qbEnvironment: QBEnvironmentProfile | null; // null for QBs (N/A)
  olContext: OLContext;
  injuryProfile: InjuryAvailabilityProfile;
  transactionContext: TransactionContext;
  historicalComparison: HistoricalComparison;
  derivedContext: BlackbirdDerivedContext;

  // Team-level (can be shared across players on same team)
  teamEnvironmentRef: string | null;     // team_context_snapshots.id
  coachingSchemeRef: string | null;      // team_context_snapshots.id

  // Evidence and contradictions
  evidenceIds: string[];
  contradictions: ContradictionRecord[];
  manualReviewRequired: boolean;
  reviewQueueReasons: string[];
};

// --------------------------------------------------------------------------
// Team context snapshot
// --------------------------------------------------------------------------

export type TeamContextSnapshot = {
  id: string;
  teamId: string;
  season: number;
  asOfDate: string;
  contextVersion: number;
  teamEnvironment: TeamEnvironmentProfile;
  coachingScheme: CoachingSchemeProfile;
  olContext: OLContext;
  evidenceIds: string[];
  overallConfidence: ContextConfidence;
  createdAt: string;
  updatedAt: string;
};

// --------------------------------------------------------------------------
// Data quality reporting
// --------------------------------------------------------------------------

export type ContextDataQualityReport = {
  season: number;
  asOfDate: string;
  totalOffensivePlayers: number;
  playersWithContext: number;
  confidenceCounts: Record<ContextConfidence, number>;
  roleCoverage: number;
  depthChartCoverage: number;
  injuryCoverage: number;
  teamEnvironmentCoverage: number;
  coachingCoverage: number;
  evidenceSourceDistribution: Record<EvidenceCategory, number>;
  staleFieldCount: number;
  contradictionCount: number;
  unresolvedIdentityCount: number;
  manualReviewQueueSize: number;
};

// --------------------------------------------------------------------------
// Storage row types (mirroring DB snake_case columns)
// --------------------------------------------------------------------------

export type ContextSnapshotRow = {
  id: string;
  canonical_player_id: string;
  season: number;
  nfl_team: string | null;
  position: string | null;
  as_of_date: string;
  context_version: number;
  source_coverage_version: string | null;
  overall_confidence: ContextConfidence;
  overall_status: ContextStatus;
  stale_field_count: number;
  unresolved_field_count: number;
  role_profile_json: unknown;
  competition_profile_json: unknown;
  team_environment_profile_json: unknown;
  coaching_scheme_json: unknown;
  injury_availability_json: unknown;
  transaction_context_json: unknown;
  qb_environment_json: unknown;
  ol_context_json: unknown;
  role_scenarios_json: unknown;
  derived_context_json: unknown;
  historical_comparison_json: unknown;
  manual_review_required: boolean;
  review_queue_reasons_json: string[];
  created_at: string;
  updated_at: string;
};

export type ContextEvidenceRow = {
  id: string;
  evidence_id: string;
  source_type: string;
  source_name: string | null;
  source_url: string | null;
  source_identifier: string | null;
  author: string | null;
  organization: string | null;
  published_at: string | null;
  captured_at: string;
  effective_date: string | null;
  season: number | null;
  player_id: string | null;
  team_id: string | null;
  evidence_category: string;
  normalized_claim: string;
  raw_excerpt: string | null;
  is_observed: boolean;
  confidence: number;
  reliability_tier: number;
  expiration_policy: string;
  expires_at: string | null;
  source_hash: string | null;
  parser_version: string | null;
  review_status: string;
  created_at: string;
};

export type TeamContextRow = {
  id: string;
  team_id: string;
  season: number;
  as_of_date: string;
  context_version: number;
  environment_profile_json: unknown;
  coaching_scheme_json: unknown;
  ol_context_json: unknown;
  overall_confidence: ContextConfidence;
  evidence_ids: string[];
  created_at: string;
  updated_at: string;
};
