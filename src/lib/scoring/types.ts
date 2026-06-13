import type { NormalizedFantasyPosition } from "@/lib/players/normalize";
import type {
  PlayerProjectionRow,
  PlayerSeasonStatsRow,
  PlayerWeeklyStatsRow,
  ProviderStatsJson
} from "@/lib/providers/data-types";

export type PositionGroup = NormalizedFantasyPosition;
export type StatSource = "actual" | "projection";
export type ScoringCategory =
  | "passing"
  | "rushing"
  | "receiving"
  | "first_downs"
  | "returns"
  | "kicking"
  | "team_defense"
  | "idp"
  | "bonuses"
  | "miscellaneous";

export type NormalizedScoringSettings = {
  values: Record<string, number>;
  originalKeys: string[];
  ignoredKeys: string[];
  invalidKeys: Array<{
    key: string;
    value: unknown;
    reason: string;
  }>;
};

export type ScoringWarning = {
  code: string;
  message: string;
  scoringKey?: string;
  statKey?: string;
  details?: Record<string, unknown>;
};

export type ScoringKeyImplementationStatus = "implemented" | "known_unimplemented" | "unknown";

export type DataCapabilityStatus =
  | "implementable_now_verified"
  | "requires_semantic_verification"
  | "requires_weekly_canonical_field"
  | "requires_play_by_play"
  | "unavailable_from_current_source"
  | "unavailable_from_weekly_source"
  | "intentionally_deferred";

// Whether the scoring engine has a functional rule for this key.
export type EngineImplementationStatus = "implemented" | "known_unimplemented";

// Whether the required canonical stat field is present in actual stored rows.
// "absent" means the source dataset has no column that maps to this stat.
export type RowStatAvailabilityStatus = "available" | "absent" | "unknown";

export type ScoringKeyDefinition = {
  scoringKey: string;
  category: ScoringCategory;
  description: string;
  allowedPositions?: PositionGroup[];
  requiredStats: string[];
  implementationStatus: ScoringKeyImplementationStatus;
  derivedStatExpression?: string;
  dataCapabilityStatus?: DataCapabilityStatus;
  dataCapabilityDetail?: {
    reason: string;
    requiredData?: string[];
  };
  // Separates scoring-engine capability from dataset availability.
  // A key may be "implemented" in the engine but have "absent" row-stat availability
  // if the underlying canonical stat is not produced by the current data source.
  engineImplementationStatus?: EngineImplementationStatus;
  rowStatAvailabilityStatus?: RowStatAvailabilityStatus;
};

export type FantasyScoringComponent = {
  scoringKey: string;
  statKey: string;
  statValue: number;
  scoringValue: number;
  points: number;
  category: ScoringCategory;
  description: string;
};

export type ScoringCoverageReport = {
  supportedScoringKeys: string[];
  unsupportedScoringKeys: string[];
  missingStatsForSupportedKeys: Array<{
    scoringKey: string;
    requiredStats: string[];
  }>;
  unusedStatKeys: string[];
  ambiguousStatAliases: Array<{
    canonicalKey: string;
    presentAliases: string[];
  }>;
  notApplicableScoringKeys: string[];
  activeScoringKeys: string[];
  evaluatedScoringKeys: string[];
  coverageRatio: number;
  isComplete: boolean;
};

export type FantasyScoringResult = {
  totalPoints: number;
  components: FantasyScoringComponent[];
  coverage: ScoringCoverageReport;
  warnings: ScoringWarning[];
  positionGroup: PositionGroup | null;
  formulaVersion: string;
};

export type ScoreFantasyStatsInput = {
  stats: ProviderStatsJson | Record<string, unknown>;
  scoringSettings: NormalizedScoringSettings | Record<string, unknown>;
  positionGroup: PositionGroup | null;
  statSource?: StatSource;
  context?: {
    season?: number;
    week?: number | null;
    playerId?: string;
  };
};

export type ScoreStoredWeeklyStatsInput = {
  row: Pick<PlayerWeeklyStatsRow, "stats_json" | "position_group" | "season" | "week" | "player_id">;
  scoringSettings: NormalizedScoringSettings | Record<string, unknown>;
};

export type ScoreStoredSeasonStatsInput = {
  row: Pick<PlayerSeasonStatsRow, "stats_json" | "position_group" | "season" | "player_id">;
  scoringSettings: NormalizedScoringSettings | Record<string, unknown>;
};

export type ScoreStoredProjectionInput = {
  row: Pick<PlayerProjectionRow, "stats_json" | "position_group" | "season" | "week" | "player_id">;
  scoringSettings: NormalizedScoringSettings | Record<string, unknown>;
};

export type CanonicalStatDefinition = {
  canonicalKey: string;
  aliases: string[];
  allowedPositions?: PositionGroup[];
};

export type ResolvedStat = {
  canonicalKey: string;
  statKey: string | null;
  statValue: number | null;
  presentAliases: string[];
};

export type ActiveScoringKeyState = "evaluated" | "missing_stat" | "unsupported" | "not_applicable";

export type LeagueScoringAudit = {
  normalizedSettings: NormalizedScoringSettings;
  fullySupportedKeys: string[];
  partiallySupportedKeys: string[];
  unsupportedKeys: string[];
  unknownKeys: string[];
  positionSpecificSupport: Record<
    PositionGroup | "DEF" | "UNKNOWN",
    {
      supportedKeys: string[];
      unsupportedKeys: string[];
      notApplicableKeys: string[];
    }
  >;
};

export type AggregateScoringCompatibility = {
  safeKeys: string[];
  aggregateUnsafeKeys: string[];
  reasons: string[];
  isExact: boolean;
  warnings: ScoringWarning[];
};

export type ScoringRuleContext = {
  scoringKey: string;
  scoringValue: number;
  positionGroup: PositionGroup | null;
  statSource: StatSource;
  activeScoringKeys: Set<string>;
  getStat: (canonicalKey: string) => ResolvedStat;
};

export type ScoringRuleEvaluation =
  | {
      state: "evaluated";
      components: FantasyScoringComponent[];
      requiredStats: string[];
      warning?: ScoringWarning;
    }
  | {
      state: "missing_stat";
      requiredStats: string[];
    }
  | {
      state: "unsupported";
      requiredStats: string[];
      warning?: ScoringWarning;
    }
  | {
      state: "not_applicable";
      requiredStats: string[];
    };

export type SleeperScoringRule = {
  scoringKey: string;
  category: ScoringCategory;
  description: string;
  allowedPositions?: PositionGroup[];
  requiredStats: string[];
  evaluate: (context: ScoringRuleContext) => ScoringRuleEvaluation;
};
