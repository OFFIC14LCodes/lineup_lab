import "server-only";

import { normalizePositionGroup } from "@/lib/players/normalize";
import { BLACKBIRD_SCORING_FORMULA_VERSION } from "@/lib/scoring";
import type { PositionGroup, ScoringWarning } from "@/lib/scoring/types";
import type {
  LeagueScoringContext,
  ScoringSourceTable,
  StoredRowScoringError,
  StoredRowScoringResult
} from "@/lib/scoring/server/types";
import type { ProviderName } from "@/lib/providers/types";

type PlayerSummary = {
  id: string;
  full_name: string | null;
  team: string | null;
  position: string | null;
  raw_position?: string | null;
  primary_position: string | null;
  position_group: string | null;
};

export function resolveStoredRowPositionGroup(args: {
  rowPositionGroup: string | null;
  player: PlayerSummary | null;
}): { positionGroup: PositionGroup | null; warnings: ScoringWarning[] } {
  const rowGroup = normalizePositionGroup(args.rowPositionGroup);
  const canonicalGroup = normalizePositionGroup(args.player?.position_group);
  const fallbackGroup = normalizePositionGroup(
    args.player?.primary_position ?? args.player?.raw_position ?? args.player?.position
  );
  const warnings: ScoringWarning[] = [];

  if (rowGroup && canonicalGroup && rowGroup !== canonicalGroup) {
    warnings.push({
      code: "POSITION_GROUP_CONFLICT",
      message: `Stored row position ${rowGroup} conflicts with canonical player position ${canonicalGroup}. Canonical player position was used.`
    });
    return { positionGroup: canonicalGroup, warnings };
  }

  if (rowGroup) {
    return { positionGroup: rowGroup, warnings };
  }

  if (canonicalGroup) {
    return { positionGroup: canonicalGroup, warnings };
  }

  if (fallbackGroup) {
    warnings.push({
      code: "POSITION_GROUP_FALLBACK",
      message: `Position group was derived from canonical player primary/raw position as ${fallbackGroup}.`
    });
    return { positionGroup: fallbackGroup, warnings };
  }

  warnings.push({
    code: "POSITION_GROUP_MISSING",
    message: "Position group could not be determined from the stored row or canonical player."
  });
  return { positionGroup: null, warnings };
}

export function buildStoredRowScoringResult(args: {
  league: LeagueScoringContext;
  player: PlayerSummary;
  source: {
    table: ScoringSourceTable;
    rowId: string;
    provider: ProviderName;
    providerExternalId: string | null;
    season: number;
    week: number | null;
    projectionType: import("@/lib/providers/data-types").ProjectionType | null;
    sourceUpdatedAt: string | null;
    ingestedAt: string;
  };
  blackbird: import("@/lib/scoring/types").FantasyScoringResult;
  providerComparison: import("@/lib/scoring/server/types").ProviderPointComparison | null;
  aggregateCompatibility: import("@/lib/scoring/types").AggregateScoringCompatibility | null;
  contextWarnings: ScoringWarning[];
}): StoredRowScoringResult {
  return {
    league: {
      id: args.league.leagueId,
      name: args.league.leagueName
    },
    player: {
      id: args.player.id,
      name: args.player.full_name ?? "Unknown player",
      team: args.player.team,
      positionGroup: args.blackbird.positionGroup
    },
    source: args.source,
    blackbird: {
      ...args.blackbird,
      formulaVersion: BLACKBIRD_SCORING_FORMULA_VERSION
    },
    providerComparison: args.providerComparison,
    aggregateCompatibility: args.aggregateCompatibility,
    contextWarnings: args.contextWarnings
  };
}

export function buildStoredRowScoringError(args: {
  rowId: string;
  table: ScoringSourceTable;
  provider?: ProviderName | null;
  season?: number | null;
  week?: number | null;
  projectionType?: import("@/lib/providers/data-types").ProjectionType | null;
  code: string;
  message: string;
}): StoredRowScoringError {
  return {
    rowId: args.rowId,
    code: args.code,
    message: args.message,
    source: {
      table: args.table,
      provider: args.provider ?? null,
      season: args.season ?? null,
      week: args.week ?? null,
      projectionType: args.projectionType ?? null
    }
  };
}
