import type { PlayerInjuryRow, PlayerProjectionRow, PlayerSeasonStatsRow, PlayerWeeklyStatsRow } from "@/lib/providers/data-types";
import type { CandidatePlayerLookupInput, ExternalMappingLookupResult, IdentityLookupInput, ProviderCandidatePlayer } from "@/lib/providers/orchestration/types";
import type { PlayerInjuryInsert, PlayerProjectionInsert, PlayerSeasonStatsInsert, PlayerWeeklyStatsInsert } from "@/lib/providers/data-types";

export type IdentityLookupDependencies = {
  getExistingExternalMappings: (input: IdentityLookupInput) => Promise<ExternalMappingLookupResult[]>;
  findCandidatePlayers: (input: CandidatePlayerLookupInput) => Promise<ProviderCandidatePlayer[]>;
};

export type RepositoryWriteDependencies = {
  upsertWeeklyStats: (input: PlayerWeeklyStatsInsert) => Promise<PlayerWeeklyStatsRow>;
  upsertSeasonStats: (input: PlayerSeasonStatsInsert) => Promise<PlayerSeasonStatsRow>;
  upsertProjection: (input: PlayerProjectionInsert) => Promise<PlayerProjectionRow>;
  addInjuryObservation: (input: PlayerInjuryInsert) => Promise<PlayerInjuryRow>;
  replaceCurrentInjuryObservation: (input: PlayerInjuryInsert) => Promise<PlayerInjuryRow>;
};

export type ProviderOrchestrationDependencies = IdentityLookupDependencies & RepositoryWriteDependencies;
