export const MOCK_DRAFT_ROSTER_ISSUE_TAGS = [
  "too_qb_heavy",
  "too_rb_heavy",
  "too_wr_heavy",
  "ignored_te",
  "ignored_depth",
  "too_much_injury_risk",
  "too_much_age_risk",
  "missed_value",
  "bad_stack_logic",
  "bad_bye_week_cluster",
  "bad_position_run_response",
  "great_value",
  "great_structure",
] as const;

export type MockDraftRosterIssueTag = (typeof MOCK_DRAFT_ROSTER_ISSUE_TAGS)[number];

export type MockDraftRosterPick = {
  pickNumber: number;
  round: number;
  rosterId: string;
  playerId: string;
  playerName?: string;
  position?: string;
  team?: string;
};

export type MockDraftRosterPlayer = {
  playerId: string;
  playerName: string;
  position: string;
  team?: string;
  projectedPoints?: number | null;
  riskTags?: string[];
  byeWeek?: number | null;
};

export type MockDraftRosterHumanReview = {
  looks_good: boolean | null;
  human_grade: string | null;
  human_notes: string;
  issue_tags: string[];
};

export type MockDraftRosterReviewInput = {
  draftRoomId: string;
  season: number;
  leagueSettings: Record<string, unknown>;
  scoringSettings: Record<string, unknown>;
  rosterSettings: Record<string, unknown>;
  draftSlot: number;
  picks: MockDraftRosterPick[];
  myDraftedRoster: MockDraftRosterPlayer[];
  allDraftedRosters?: Array<{ rosterId: string; players: MockDraftRosterPlayer[] }>;
  recommendationsAtPicks?: unknown[];
  availableBoardStates?: unknown[];
  humanReview: MockDraftRosterHumanReview;
};

export type MockDraftRosterReviewReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  inputPath: string | null;
  draftRoomId: string;
  sections: Record<string, unknown>;
  invalidIssueTags: string[];
  humanReview: MockDraftRosterHumanReview;
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
};

export type MockDraftRosterReviewArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
