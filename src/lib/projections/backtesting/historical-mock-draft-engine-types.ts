import type { MockDraftResultCaptureReport } from "@/lib/draft/mock-draft-result-capture-types";

export type HistoricalMockDraftLeagueType = "redraft" | "dynasty" | "best_ball" | "dynasty_best_ball";
export type HistoricalMockDraftOrderType = "snake" | "third_round_reversal";
export type HistoricalMockDraftStrategy =
  | "blackbird_rank_only"
  | "projection_only"
  | "adp_only"
  | "market_rank"
  | "need_based"
  | "random_within_adp_band";
export type HistoricalMockDraftRecommendation =
  | "historical_mock_draft_engine_ready_for_season_scoring"
  | "historical_mock_draft_engine_needs_input_data"
  | "historical_mock_draft_engine_needs_bugfix"
  | "historical_mock_draft_engine_blocked";

export type HistoricalMockDraftPlayer = {
  playerId: string;
  sleeperId?: string | null;
  playerName: string;
  position: string;
  nflTeam?: string | null;
  blackbirdRank?: number | null;
  internalDraftRank?: number | null;
  projectionRank?: number | null;
  adpRank?: number | null;
  marketRank?: number | null;
  projectedPoints?: number | null;
};

export type HistoricalMockDraftScenario = {
  historicalSeason: number;
  leagueType: HistoricalMockDraftLeagueType;
  teams: number;
  rounds: number;
  draftOrderType: HistoricalMockDraftOrderType;
  draftSlots: number[];
  myDraftSlot: number;
  rosterSettings: Record<string, number>;
  scoringSettings: Record<string, unknown>;
  strategySet: HistoricalMockDraftStrategy[];
  randomSeed: number;
  playerUniverseInput: { players?: HistoricalMockDraftPlayer[]; artifactPath?: string };
  projectionSnapshotInput: Record<string, unknown>;
  adpInput?: Record<string, unknown> | null;
  marketRankInput?: Record<string, unknown> | null;
};

export type HistoricalMockDraftOrderPick = {
  overallPick: number;
  round: number;
  pickInRound: number;
  draftSlot: number;
};

export type HistoricalMockDraftPickLog = HistoricalMockDraftOrderPick & {
  strategy: HistoricalMockDraftStrategy;
  playerId: string;
  playerName: string;
  position: string;
  nflTeam?: string | null;
  rankSource: string;
};

export type HistoricalMockDraftStrategyResult = {
  strategy: HistoricalMockDraftStrategy;
  teamRosters: Array<{ draftSlot: number; picks: HistoricalMockDraftPickLog[] }>;
  pickLog: HistoricalMockDraftPickLog[];
  myTeamRoster: HistoricalMockDraftPickLog[];
  positionCounts: Record<string, number>;
  starterCoverageEstimate: string;
  benchDepthEstimate: string;
  draftCapitalByPosition: Record<string, number[]>;
  reachesValueNotes: string[];
  blackbirdFallbackUsed?: string | null;
  rosterReview?: MockDraftResultCaptureReport | null;
};

export type HistoricalMockDraftEngineReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  scenarioPath: string | null;
  recommendation: HistoricalMockDraftRecommendation;
  draftOrderType: HistoricalMockDraftOrderType;
  draftOrder: HistoricalMockDraftOrderPick[];
  strategyResults: HistoricalMockDraftStrategyResult[];
  dataLeakageGuard: {
    allowedDraftTimeInputs: string[];
    disallowedOutcomeInputs: string[];
    actualSeasonScoringLoaded: false;
    futureOutcomeFieldsUsed: false;
  };
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
};

export type HistoricalMockDraftEngineArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
