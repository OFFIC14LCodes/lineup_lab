export type WarRoomE2eQaStatus = "pass" | "warn" | "fail" | "not_tested";

export type WarRoomE2eQaRecommendation =
  | "war_room_e2e_ready_for_manual_live_test"
  | "war_room_e2e_ready_with_mock_pass"
  | "war_room_e2e_needs_bugfix"
  | "war_room_e2e_blocked";

export type WarRoomE2eQaSectionName =
  | "draft_connection"
  | "draft_state_loading"
  | "board_modes"
  | "available_player_filtering"
  | "drafted_player_handling"
  | "draft_suggestions"
  | "roster_construction"
  | "plan_alignment"
  | "gm_brief"
  | "player_modal"
  | "search_filter_load_more"
  | "sync_status"
  | "error_and_stale_states"
  | "responsive_layout"
  | "data_policy_holdbacks"
  | "v8_2_safety";

export type WarRoomE2eQaCheck = {
  name: string;
  status: WarRoomE2eQaStatus;
  detail: string;
};

export type WarRoomE2eQaSection = {
  name: WarRoomE2eQaSectionName;
  status: WarRoomE2eQaStatus;
  checks: WarRoomE2eQaCheck[];
  observedValues: Record<string, string | number | boolean | null>;
  notes: string[];
};

export type WarRoomE2eQaPlayer = {
  playerId: string;
  sleeperId?: string | null;
  playerName: string;
  position: string;
  team: string;
  drafted?: boolean;
  draftedByRosterId?: string | null;
  blackbirdRank?: number | null;
  draftSuggestionRank?: number | null;
  projection?: number | null;
};

export type WarRoomE2eQaPick = {
  pickNumber: number;
  round: number;
  rosterId: string;
  playerId: string;
};

export type WarRoomE2eQaSnapshot = {
  currentPickNumber: number;
  currentRound: number;
  draftStatus: string;
  lastSyncedAt: string;
  picks: WarRoomE2eQaPick[];
  myRoster: string[];
  availablePlayersSample: WarRoomE2eQaPlayer[];
};

export type WarRoomE2eQaScenario = {
  season: number;
  leagueType: string;
  teams: number;
  rounds: number;
  draftSlot: number;
  rosterSettings: Record<string, unknown>;
  scoringSettings: Record<string, unknown>;
  picks: WarRoomE2eQaPick[];
  myRoster: string[];
  availablePlayersSample: WarRoomE2eQaPlayer[];
  before?: Partial<WarRoomE2eQaSnapshot>;
  after?: Partial<WarRoomE2eQaSnapshot>;
  manualLiveConfirmed?: boolean;
  responsiveViewports?: {
    mobile?: boolean;
    tablet?: boolean;
    desktop?: boolean;
  };
};

export type WarRoomE2eQaPolicyReadiness = {
  sourceMissing?: boolean;
  recommendation?: string;
  sourceHoldbackSummary?: {
    depthChartSourceRowsHeldBack?: number;
    depthChartUnmatchedRows?: number;
    freeAgentUnknownRowsNotAutoPromoted?: boolean;
    inactiveStaleRowsHeldBack?: number;
    kickerRowsNotAutoPromoted?: boolean;
    legacyRowsBlockedArchive?: boolean;
  };
  v82Safety?: {
    enabled?: boolean;
    defaultDisabled?: boolean;
    controlledFlagReviewRemainsBlocked?: boolean;
    zeroChecksPreserved?: boolean;
    protectedZeroChecks?: Record<string, boolean>;
  };
};

export type WarRoomE2eQaInput = {
  projectionSeason: number;
  scenario: WarRoomE2eQaScenario;
  scenarioPath?: string;
  v1Readiness?: WarRoomE2eQaPolicyReadiness | null;
  sourceText?: string;
  generatedAt?: string;
};

export type WarRoomE2eQaReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  scenarioPath: string | null;
  recommendation: WarRoomE2eQaRecommendation;
  sectionSummary: Record<WarRoomE2eQaSectionName, WarRoomE2eQaStatus>;
  sections: WarRoomE2eQaSection[];
  boardInvariants: Record<string, boolean>;
  reactiveStateInvariants: Record<string, boolean>;
  playerModalChecklist: Record<string, boolean>;
  searchFilterLoadMoreChecklist: Record<string, boolean>;
  syncStatusChecklist: Record<string, boolean>;
  safetyGates: WarRoomE2eQaCheck[];
  notes: string[];
};

export type WarRoomE2eQaArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
