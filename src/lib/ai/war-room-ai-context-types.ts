export type WarRoomAiBoardPlayer = {
  playerId: string | null;
  playerName: string;
  position: string | null;
  team: string | null;
  draftSuggestionRank?: number | null;
  blackbirdRank?: number | null;
  valueScore?: number | null;
  projection?: number | null;
  floor?: number | null;
  ceiling?: number | null;
  confidence?: string | null;
  risk?: string | null;
  timingAction?: string | null;
  reasons?: string[];
  dataGaps?: string[];
  drafted?: boolean;
};

export type WarRoomAiPick = {
  pickNo: number;
  round: number | null;
  playerName: string | null;
  position: string | null;
  team: string | null;
  rosterId: string | null;
};

export type WarRoomAiNeed = {
  position: string;
  label?: string | null;
  current?: number | null;
  target?: number | null;
  need?: number | null;
  needLevel?: string | null;
  note?: string | null;
};

export type WarRoomAiContextInput = {
  draftRoomId: string;
  leagueId?: string | null;
  league?: {
    name?: string | null;
    isDynasty?: boolean | null;
    isBestBall?: boolean | null;
    isSuperflex?: boolean | null;
    isTwoQb?: boolean | null;
    tePremium?: number | null;
    rosterPositions?: string[] | null;
    scoringSettings?: Record<string, number | string | boolean | null> | null;
  } | null;
  draftState: {
    currentPickNumber: number;
    currentRound: number;
    picksUntilMyNextPick?: number | null;
    myDraftSlot?: number | null;
    teamCount?: number | null;
    status?: string | null;
  };
  rosterConstruction?: {
    positionCounts?: Record<string, number>;
    needs?: WarRoomAiNeed[];
    planSummaries?: string[];
  };
  myRoster?: WarRoomAiPick[];
  recentPicks?: WarRoomAiPick[];
  draftSuggestions?: WarRoomAiBoardPlayer[];
  fullBlackbirdRank?: WarRoomAiBoardPlayer[];
  availableBlackbirdRank?: WarRoomAiBoardPlayer[];
  positionScarcity?: Array<{ position: string; summary: string; risk?: string | null }>;
  liveState?: {
    status: "fresh" | "watch" | "stale" | "error" | "unknown";
    lastUpdatedAt?: string | null;
    secondsSinceUpdate?: number | null;
    warnings?: string[];
  };
  marketAnchorPreview?: {
    enabled: boolean;
    source?: string | null;
    matchQuality?: string | null;
    warnings?: string[];
  };
  riskSummary?: string[];
  confidenceSummary?: string[];
  topN?: number;
};

export type WarRoomAiContext = {
  contextVersion: "war_room_ai_context_v1";
  readOnly: true;
  deterministic: true;
  canMutateDraft: false;
  draftRoomId: string;
  leagueId: string | null;
  leagueSettingsSummary: {
    name: string | null;
    formatFlags: string[];
    rosterPositions: string[];
  };
  scoringSummary: {
    scoringKeys: string[];
    notableScoring: string[];
  };
  draftState: WarRoomAiContextInput["draftState"];
  rosterConstructionSummary: {
    positionCounts: Record<string, number>;
    teamNeeds: WarRoomAiNeed[];
    planSummaries: string[];
  };
  userRosterSoFar: WarRoomAiPick[];
  recentPicks: WarRoomAiPick[];
  topPlayers: {
    draftSuggestions: WarRoomAiBoardPlayer[];
    fullBlackbirdRank: WarRoomAiBoardPlayer[];
    availableBlackbirdRank: WarRoomAiBoardPlayer[];
  };
  positionScarcitySummary: Array<{ position: string; summary: string; risk: string | null }>;
  liveState: {
    status: "fresh" | "watch" | "stale" | "error" | "unknown";
    lastUpdatedAt: string | null;
    secondsSinceUpdate: number | null;
    warnings: string[];
  };
  riskConfidenceContext: {
    riskSummary: string[];
    confidenceSummary: string[];
  };
  marketAnchorPreview: {
    marketAnchorPreviewEnabled: boolean;
    marketAnchorSource: string | null;
    marketAnchorMatchQuality: string | null;
    marketAnchorWarnings: string[];
  };
  safety: {
    noAiApiCalls: true;
    noSupabaseWrites: true;
    noRankingMutation: true;
    noDraftSuggestionMutation: true;
  };
};
