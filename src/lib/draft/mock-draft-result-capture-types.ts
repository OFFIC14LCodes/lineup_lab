import type { MockDraftRosterHumanReview } from "./mock-draft-roster-review-types";

export type MockDraftResultCaptureRecommendation =
  | "mock_draft_roster_review_ready_for_human_review"
  | "mock_draft_roster_review_needs_input_data"
  | "mock_draft_roster_review_needs_bugfix"
  | "mock_draft_roster_review_blocked";

export type MockDraftResultTeam = {
  teamId: string;
  draftSlot: number;
  name?: string;
};

export type MockDraftPickRecommendation = {
  topPlayerId?: string;
  topPlayerName?: string;
  top3PlayerIds?: string[];
  top5PlayerIds?: string[];
  reason?: string;
};

export type MockDraftResultPick = {
  pickNumber: number;
  round: number;
  draftSlot: number;
  teamId: string;
  playerId: string;
  sleeperId?: string | null;
  playerName: string;
  position: string;
  nflTeam?: string | null;
  projectedPoints?: number | null;
  byeWeek?: number | null;
  riskTags?: string[];
  blackbirdRecommendation?: MockDraftPickRecommendation | null;
  actualPickMade?: boolean;
  availablePlayersAtPick?: string[];
};

export type MockDraftResultCaptureInput = {
  season: number;
  leagueSettings: Record<string, unknown>;
  scoringSettings: Record<string, unknown>;
  rosterSettings: Record<string, unknown>;
  teams: MockDraftResultTeam[];
  myTeamId: string;
  myDraftSlot: number;
  draftRounds: number;
  picks: MockDraftResultPick[];
  humanReview: MockDraftRosterHumanReview;
};

export type MockDraftTeamRoster = {
  teamId: string;
  draftSlot: number;
  picks: MockDraftResultPick[];
  byPosition: Record<string, MockDraftResultPick[]>;
};

export type MockDraftTeamSummary = {
  teamId: string;
  draftSlot: number;
  counts: Record<string, number>;
  starterCoverage: string;
  benchDepth: string;
  stackCorrelationNotes: string[];
  obviousRosterHoles: string[];
  overallStructureGrade: string;
};

export type MockDraftRecommendationComparison = {
  status: "available" | "recommendation_comparison_not_available";
  totalCompared: number;
  actualPickMatchedTopRecommendation: number;
  actualPickMatchedTop3: number;
  actualPickMatchedTop5: number;
  missedRecommendationCandidates: string[];
  divergences: Array<{ pickNumber: number; actualPlayerId: string; topPlayerId: string | null; reason: string | null }>;
};

export type MockDraftGradeSummary = {
  roster_structure_grade: string;
  starter_strength_grade: string;
  depth_grade: string;
  value_grade: string;
  risk_grade: string;
  format_fit_grade: string;
  overall_grade: string;
  logic: string[];
};

export type MockDraftResultCaptureReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  inputPath: string | null;
  recommendation: MockDraftResultCaptureRecommendation;
  allTeamRosters: MockDraftTeamRoster[];
  myRosterByPosition: Record<string, string[]>;
  starterCandidates: string[];
  benchDepth: string[];
  positionAllocation: Record<string, number>;
  draftCapitalByPosition: Record<string, number[]>;
  roundByRoundTeamBuild: Array<{ round: number; playerName: string; position: string; pickNumber: number }>;
  myTeamReview: Record<string, unknown>;
  allTeamSummary: MockDraftTeamSummary[];
  recommendationComparison: MockDraftRecommendationComparison;
  grades: MockDraftGradeSummary;
  invalidIssueTags: string[];
  humanReview: MockDraftRosterHumanReview;
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
};

export type MockDraftResultCaptureArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};
