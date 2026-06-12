import type { PositionGroup, AggregateScoringCompatibility, FantasyScoringResult, LeagueScoringAudit, NormalizedScoringSettings, ScoringWarning } from "@/lib/scoring/types";
import type { ProjectionType } from "@/lib/providers/data-types";
import type { ProviderName } from "@/lib/providers/types";

export type ScoringInspectorSourceType = "weekly_stats" | "season_stats" | "projections";
export type ScoringSourceTable = "player_weekly_stats" | "player_season_stats" | "player_projections";

export type LeagueScoringContext = {
  leagueId: string;
  leagueName: string | null;
  season: number | null;
  scoringSettings: NormalizedScoringSettings;
  scoringAudit: LeagueScoringAudit;
  formulaVersion: string;
};

export type ProviderPointComparison = {
  providerPoints: number;
  blackbirdPoints: number;
  difference: number;
  absoluteDifference: number;
  percentDifference: number | null;
  comparisonStatus: "match" | "close" | "different" | "incomplete_blackbird_coverage";
  warnings: string[];
};

export type StoredRowScoringResult = {
  league: {
    id: string;
    name: string | null;
  };
  player: {
    id: string;
    name: string;
    team: string | null;
    positionGroup: PositionGroup | null;
  };
  source: {
    table: ScoringSourceTable;
    rowId: string;
    provider: ProviderName;
    providerExternalId: string | null;
    season: number;
    week: number | null;
    projectionType: ProjectionType | null;
    sourceUpdatedAt: string | null;
    ingestedAt: string;
  };
  blackbird: FantasyScoringResult;
  providerComparison: ProviderPointComparison | null;
  aggregateCompatibility: AggregateScoringCompatibility | null;
  contextWarnings: ScoringWarning[];
};

export type StoredRowScoringError = {
  rowId: string;
  code: string;
  message: string;
  source: {
    table: ScoringSourceTable;
    provider: ProviderName | null;
    season: number | null;
    week: number | null;
    projectionType: ProjectionType | null;
  };
};

export type StoredRowBatchItem =
  | {
      ok: true;
      result: StoredRowScoringResult;
    }
  | {
      ok: false;
      error: StoredRowScoringError;
    };

export type ScoringInspectorQuery = {
  leagueId: string;
  sourceType: ScoringInspectorSourceType;
  rowId?: string | null;
  season?: number | null;
  week?: number | null;
  provider?: ProviderName | null;
  positionGroup?: PositionGroup | null;
  projectionType?: ProjectionType | null;
  limit?: number;
};

export type ScoringInspectorResponse = {
  league: LeagueScoringContext;
  sourceType: ScoringInspectorSourceType;
  results: StoredRowBatchItem[];
};
