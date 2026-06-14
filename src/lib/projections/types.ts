// H9-lite projection engine — TypeScript contracts.
//
// Naming conventions enforced throughout:
//   historicalActiveWeeks  — distinct canonical weekly rows in historical data
//   historicalRoleWeeks    — weeks exceeding position opportunity threshold
//   projectedActiveGames   — weeks player is available on a roster
//   projectedRoleGames     — weeks player has meaningful opportunity
//   player_data_hash       — hash of semantic values, excludes player ID
//   player_projection_input_hash — hash includes player ID, is player-unique

import type { ReasonCode, ReasonDirection, ReasonScope } from "./reason-codes";
import type { ModelConfig } from "./constants";

// --------------------------------------------------------------------------
// Primitive aliases
// --------------------------------------------------------------------------

export type ProjectionPosition = "QB" | "RB" | "WR" | "TE";

export type RoleSampleClass =
  | "ESTABLISHED_FULL_SEASON"
  | "ESTABLISHED_PARTIAL_SEASON"
  | "PART_TIME_CONTRIBUTOR"
  | "BACKUP_OR_SPOT_STARTER"
  | "MINIMAL_SAMPLE"
  | "ROLE_UNKNOWN";

export type ProjectionConfidenceLabel = "high" | "medium" | "low" | "very_low";

export type MarketDiscrepancyLabel =
  | "aligned"
  | "slight_disagreement"
  | "moderate_disagreement"
  | "strong_disagreement"
  | "no_compatible_adp";

export type ProjectionRunStatus =
  | "pending"
  | "computing"
  | "ready_to_persist"
  | "persisting"
  | "complete"
  | "interrupted"
  | "failed";

// --------------------------------------------------------------------------
// H8 context field snapshot (normalized values used by the projection engine)
// --------------------------------------------------------------------------

export type H8FieldStatus =
  | "observed"
  | "inferred"
  | "unknown"
  | "contradicted"
  | "stale"
  | "not_applicable";

export type H8FieldConfidence = "verified" | "high" | "moderate" | "low" | "unresolved";

export type H8FieldSnapshot = {
  value: number | null;
  status: H8FieldStatus;
  confidence: H8FieldConfidence;
  // Evidence IDs carried for reason-record lineage; excluded from canonical hash.
  sourceEvidenceIds: string[];
};

// All CONTEXT_FIELDS from src/lib/context/applicability.ts.
// Each field maps to an H8FieldSnapshot. sourceEvidenceIds are excluded from hashing.
export type H8ContextFields = {
  priorTargetShare: H8FieldSnapshot;
  priorCarryShare: H8FieldSnapshot;
  priorRedZoneShare: H8FieldSnapshot;
  priorGoalLineShare: H8FieldSnapshot;
  priorTeamPassRate: H8FieldSnapshot;
  priorTeamRushRate: H8FieldSnapshot;
  priorEarlyDownPassRate: H8FieldSnapshot;
};

// --------------------------------------------------------------------------
// Weekly stat row (normalized from stats_json; no timestamps)
// --------------------------------------------------------------------------

export type WeeklyStatRow = {
  week: number;
  passAttempts: number;
  completions: number;
  passingYards: number;
  passingTds: number;
  interceptions: number;
  carries: number;
  rushingYards: number;
  rushingTds: number;
  targets: number;
  receptions: number;
  receivingYards: number;
  receivingTds: number;
  // Non-repeatable; excluded from projection but preserved for canonical hash
  fumRetTd: number;
  twoPointConversions: number;
  fumblesLost: number;
};

// --------------------------------------------------------------------------
// ADP record (compatible format only; IDs included for lineage)
// --------------------------------------------------------------------------

export type CompatibleAdpRecord = {
  adpRecordId: string;         // uuid — adp_player_records.id (lineage only)
  snapshotId: string;          // uuid — adp_snapshots.id (lineage only)
  provider: string;
  scoringFormat: string;
  pprValue: number;
  tePremiumValue: number;
  isDynasty: boolean;
  isBestBall: boolean;
  isSuperflex: boolean;
  overallAdp: number;
  overallRank: number | null;
  positionalAdp: number | null;
  positionalRank: number | null;
  effectiveDate: string;       // ISO date — included in canonical hash
};

// --------------------------------------------------------------------------
// HistoricalPlayerProjectionInput — Pass 1 output, one per player
// --------------------------------------------------------------------------

export type HistoricalPlayerProjectionInput = {
  canonicalPlayerId: string;          // uuid
  position: ProjectionPosition;
  historicalSeason: number;
  projectionSeason: number;
  weeklyStats: WeeklyStatRow[];       // sorted by week ascending
  h8SnapshotId: string | null;        // uuid — null if no H8 snapshot
  h8Fields: H8ContextFields;
  compatibleAdpRecords: CompatibleAdpRecord[];
};

// --------------------------------------------------------------------------
// RoleSampleClassification — Pass 2 output
// --------------------------------------------------------------------------

export type RoleSampleClassification = {
  roleSampleClass: RoleSampleClass;
  roleSampleConfidence: ProjectionConfidenceLabel;
  historicalActiveWeeks: number;   // distinct canonical weekly rows
  historicalRoleWeeks: number;     // weeks exceeding opportunity threshold
  totalPassAttempts: number;
  totalCarries: number;
  totalTargets: number;
  totalReceptions: number;
  roleParticipationFactor: number; // historicalRoleWeeks / historicalActiveWeeks; 0 if both 0
  reasonCodes: ReasonCode[];
};

// --------------------------------------------------------------------------
// ProjectedAvailability — Pass 4 output: games projections
// --------------------------------------------------------------------------

export type GameProjection = {
  floor: number;
  median: number;
  ceiling: number;
};

export type ProjectedAvailability = {
  projectedActiveGames: GameProjection;
  projectedRoleGames: GameProjection;
  gamesConfidence: ProjectionConfidenceLabel; // mapped from roleSampleClass
  reasonCodes: ReasonCode[];
};

// --------------------------------------------------------------------------
// ProjectedOpportunity — volume per role game
// --------------------------------------------------------------------------

export type ProjectedOpportunity = {
  passAttemptsPerRoleGame: number;
  carriesPerRoleGame: number;
  targetsPerRoleGame: number;
};

// --------------------------------------------------------------------------
// RegressionRateResult — for a single TD or efficiency rate
// --------------------------------------------------------------------------

export type RegressionRateResult = {
  playerRate: number;
  positionReferenceRate: number;
  sampleWeight: number;
  regressedRate: number;
  opportunity: number;             // denominator used (attempts, carries, or targets)
  stabilizationConstant: number;   // the K value applied
  referencePoolSize: number;
  reasonCodes: ReasonCode[];
};

// --------------------------------------------------------------------------
// ProjectionReferenceRates — Pass 3 regression outputs, one per player
// --------------------------------------------------------------------------

export type ProjectionReferenceRates = {
  passingTdRate: RegressionRateResult | null;    // null when no passing opportunity
  rushingTdRate: RegressionRateResult | null;    // null when no rushing opportunity
  receivingTdRate: RegressionRateResult | null;  // null when no receiving opportunity
  completionRate: RegressionRateResult | null;   // QB only
  yardsPerAttempt: RegressionRateResult | null;  // QB only
  intRate: RegressionRateResult | null;          // QB only
  yardsPerCarry: RegressionRateResult | null;    // QB/RB
  catchRate: RegressionRateResult | null;        // WR/TE/RB
  yardsPerTarget: RegressionRateResult | null;   // WR/TE/RB
};

// --------------------------------------------------------------------------
// StatComponents — football stat projection (not fantasy points)
// --------------------------------------------------------------------------

export type StatComponents = {
  passAttempts: number;
  completions: number;
  passingYards: number;
  passingTds: number;
  interceptions: number;
  carries: number;
  rushingYards: number;
  rushingTds: number;
  targets: number;
  receptions: number;
  receivingYards: number;
  receivingTds: number;
  twoPointConversions: number; // always 0 in H9-lite baseline
  miscTds: number;             // always 0 in H9-lite baseline (NON_REPEATABLE_MISC_TD)
};

// --------------------------------------------------------------------------
// ProjectedStatComponents — Pass 3 output: median stat components
// --------------------------------------------------------------------------

export type ProjectedStatComponents = {
  median: StatComponents;
  reasonCodes: ReasonCode[];
};

// --------------------------------------------------------------------------
// ProjectionConfidence — football data quality score
// --------------------------------------------------------------------------

export type ConfidenceFactor = {
  factor: string;
  delta: number;
};

export type ProjectionConfidence = {
  projectionConfidenceScore: number;    // 0.0–1.0
  projectionConfidenceLabel: ProjectionConfidenceLabel;
  contributingFactors: ConfidenceFactor[];
};

// --------------------------------------------------------------------------
// ProjectionUncertainty — Pass 4 output: uncertainty and volatility
// --------------------------------------------------------------------------

export type ProjectionUncertainty = {
  modelUncertainty: number;   // 0.0–1.0 (data quality uncertainty)
  playerVolatility: number;   // 0.0–1.0 (inherent player variance)
  totalRangeWidth: number;    // clamp(modelUncertainty + playerVolatility, 0.20, 0.80)
  reasonCodes: ReasonCode[];
};

// --------------------------------------------------------------------------
// ProjectionScenarioComponents — Pass 4 output: five scenario stat sets
// --------------------------------------------------------------------------

export type ProjectionScenarioComponents = {
  downside: StatComponents;
  floor: StatComponents;
  median: StatComponents;
  ceiling: StatComponents;
  upside: StatComponents;
  downsideGames: number;
  floorGames: number;
  medianGames: number;
  ceilingGames: number;
  upsideGames: number;
};

// --------------------------------------------------------------------------
// MarketAgreement — Pass 7 output (requires ranks from Pass 6)
// --------------------------------------------------------------------------

export type MarketAgreement = {
  marketAgreementScore: number | null;          // null if no compatible ADP
  marketDiscrepancy: number | null;             // projectedRank - adpPositionalRank (signed); positive = Blackbird ranks player higher
  marketDiscrepancyLabel: MarketDiscrepancyLabel;
  adpRecordIds: string[];                       // uuid[] — lineage of which ADP records contributed
  reasonCodes: ReasonCode[];
};

// --------------------------------------------------------------------------
// LeagueProjectionOutput — Pass 5+6+7 output, per player per league
// --------------------------------------------------------------------------

export type LeagueProjectionOutput = {
  leagueId: string;                           // uuid
  position: ProjectionPosition;
  projectedPpgWhenInRole: number;
  floorPpg: number;
  ceilingPpg: number;
  downsidePoints: number;
  floorPoints: number;
  medianPoints: number;
  ceilingPoints: number;
  upsidePoints: number;
  projectedPositionRank: number | null;       // set in Pass 6; null before ranking pass
  projectionConfidence: ProjectionConfidence;
  modelUncertainty: ProjectionUncertainty;
  marketAgreement: MarketAgreement | null;    // set in Pass 7; null before market pass
  projectedComponentsJson: ProjectionScenarioComponents | null; // persisted as JSONB
  reasonCodes: ReasonCode[];
};

// --------------------------------------------------------------------------
// ProjectionReason — single reason record (one row in projection_reasons)
// --------------------------------------------------------------------------

export type ProjectionReason = {
  reasonCode: ReasonCode;
  reasonScope: ReasonScope;
  direction: ReasonDirection;
  magnitude: number | null;
  explanation: string;
  leagueId: string | null;          // null for football-projection (global) reasons
  sourceEvidenceIds: string[];       // context_evidence.evidence_id values (text)
  reasonKey: string;                 // SHA-256 of (runId|playerId|leagueOrGlobal|code|scope)
};

// --------------------------------------------------------------------------
// Hashing types — what goes into canonical hash payloads
// --------------------------------------------------------------------------

// Normalized semantic data for a player — excludes player ID and DB identifiers.
// Two players with genuinely identical inputs have the same PlayerDataHashPayload.
export type PlayerDataHashPayload = {
  position: ProjectionPosition;
  historicalSeason: number;
  projectionSeason: number;
  projectionVersion: number;
  weeklyStats: Array<{
    week: number;
    stats: Record<string, number>;  // sorted keys; normalized values
  }>;
  h8Fields: Record<string, {
    value: number | null;
    status: string;
    confidence: string;
  }>;
  compatibleAdpRecords: Array<{
    provider: string;
    scoringFormat: string;
    pprValue: number;
    tePremiumValue: number;
    isDynasty: boolean;
    isBestBall: boolean;
    isSuperflex: boolean;
    overallAdp: number;
    overallRank: number | null;
    positionalAdp: number | null;
    positionalRank: number | null;
    effectiveDate: string;
  }>;
  modelConfig: ModelConfig;
};

// Full run-level canonical payload.
export type RunSemanticHashPayload = {
  projection: {
    method: string;
    version: number;
    historicalSeason: number;
    projectionSeason: number;
    leagueConfigSeason: number;
    contextVersion: number;
  };
  modelConfig: ModelConfig;
  population: {
    scope: string;
    playerProjectionInputHashes: string[]; // sorted
  };
  leagues: {
    scoringConfigHashes: Record<string, string>; // leagueId → SHA-256 of canonical scoring config
  };
  reasonCodeRegistryVersion: string;
};

// --------------------------------------------------------------------------
// ProjectionRunPlan — full computation plan (all passes, before persistence)
// --------------------------------------------------------------------------

export type ProjectionRunPlan = {
  projectionVersion: number;
  historicalSeason: number;
  projectionSeason: number;
  leagueConfigSeason: number;
  contextVersion: number;
  asOfDate: string;          // ISO date
  method: string;
  codeVersion: string;
  selectionScope: string;    // 'all' | 'QB' | 'RB' | 'WR' | 'TE' | 'player:<uuid>'
  modelConfig: ModelConfig;
  playerInputs: HistoricalPlayerProjectionInput[];
  leagueIds: string[];
  semanticInputHash: string; // run-level hash
  playerDataHashes: Record<string, string>;              // canonicalPlayerId → playerDataHash
  playerProjectionInputHashes: Record<string, string>;   // canonicalPlayerId → playerProjectionInputHash
};

// --------------------------------------------------------------------------
// ProjectionPersistencePlan — what will be written, in what order
// --------------------------------------------------------------------------

export type ProjectionRunRecord = {
  projectionRunId: string;         // uuid — generated before persistence
  projectionVersion: number;
  historicalSeason: number;
  projectionSeason: number;
  leagueConfigSeason: number;
  contextVersion: number;
  asOfDate: string;
  method: string;
  codeVersion: string;
  modelConfigJson: ModelConfig;
  semanticInputHash: string;
  selectionScope: string;
  populationCount: number;
  leagueCount: number;
};

export type ProjectionInputRecord = {
  projectionRunId: string;
  canonicalPlayerId: string;
  position: ProjectionPosition;
  roleSampleClass: RoleSampleClass;
  roleSampleConfidence: ProjectionConfidenceLabel;
  gamesConfidence: ProjectionConfidenceLabel;
  historicalActiveWeeks: number;
  historicalRoleWeeks: number;
  roleParticipationFactor: number;
  projectedActiveGamesFloor: number;
  projectedActiveGamesMedian: number;
  projectedActiveGamesCeiling: number;
  projectedRoleGamesFloor: number;
  projectedRoleGamesMedian: number;
  projectedRoleGamesCeiling: number;
  modelUncertainty: number;
  playerVolatility: number;
  totalRangeWidth: number;
  projectionConfidenceScore: number;
  projectionConfidenceLabel: ProjectionConfidenceLabel;
  h8SnapshotId: string | null;
  adpRecordIds: string[];           // uuid[]
  playerDataHash: string;
  playerProjectionInputHash: string;
};

export type ProjectionOutputRecord = {
  projectionRunId: string;
  canonicalPlayerId: string;
  leagueId: string;
  position: ProjectionPosition;
  projectedPpgWhenInRole: number;
  floorPpg: number;
  ceilingPpg: number;
  downsidePoints: number;
  floorPoints: number;
  medianPoints: number;
  ceilingPoints: number;
  upsidePoints: number;
  modelUncertainty: number;
  playerVolatility: number;
  totalRangeWidth: number;
  projectionConfidenceScore: number;
  projectionConfidenceLabel: ProjectionConfidenceLabel;
  marketAgreementScore: number | null;
  marketDiscrepancy: number | null;
  marketDiscrepancyLabel: MarketDiscrepancyLabel | null;
  projectedPositionRank: number | null;
  projectedComponentsJson: ProjectionScenarioComponents | null;
  projectionMethod: string;
  playerProjectionInputHash: string;
};

export type ProjectionReasonRecord = {
  projectionRunId: string;
  canonicalPlayerId: string;
  leagueId: string | null;
  reasonCode: ReasonCode;
  reasonScope: ReasonScope;
  direction: ReasonDirection;
  magnitude: number | null;
  explanation: string;
  sourceEvidenceIds: string[];
  reasonKey: string;
};

export type ProjectionPersistencePlan = {
  runRecord: ProjectionRunRecord;
  inputs: ProjectionInputRecord[];
  outputs: ProjectionOutputRecord[];
  reasons: ProjectionReasonRecord[];
};
