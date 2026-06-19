import type { HistoricalWeeklyResult } from "./historical-season-outcome-scorer-types";

export type HistoricalWeeklyResultsRecommendation =
  | "historical_weekly_results_ready_for_h37_scoring"
  | "historical_weekly_results_needs_source_file"
  | "historical_weekly_results_needs_scoring_mapping"
  | "historical_weekly_results_needs_identifier_mapping"
  | "historical_weekly_results_blocked";

export type HistoricalWeeklyResultsSourceCandidate = {
  path: string;
  exists: boolean;
  selected: boolean;
  rowCount: number;
  seasonCoverage: number[];
  weekCoverage: number[];
  identifierCoverage: {
    player_id: number;
    sleeper_id: number;
    gsis_id: number;
    player_name: number;
  };
  positionCoverage: number;
  fantasyPointsPresent: boolean;
  scoringMustBeCalculated: boolean;
  columns: string[];
};

export type HistoricalWeeklyResultsNormalizedRow = HistoricalWeeklyResult & {
  season: number;
  season_type: string | null;
  team: string | null;
  opponent: string | null;
  passing_points: number;
  rushing_points: number;
  receiving_points: number;
  td_points: number;
  turnover_points: number;
  kicking_points: number;
  dst_points: number;
  idp_points: number;
  source: string;
  source_updated_at: string | null;
  notes: string[];
};

export type HistoricalWeeklyResultsReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  season: number;
  recommendation: HistoricalWeeklyResultsRecommendation;
  sourceDiscovery: HistoricalWeeklyResultsSourceCandidate[];
  selectedSourcePath: string | null;
  summary: {
    totalWeeklyRows: number;
    playersCovered: number;
    weeksCovered: number[];
    positionsCovered: string[];
    exactIdCoverage: {
      player_id: number;
      sleeper_id: number;
      gsis_id: number;
    };
    rowsWithFantasyPoints: number;
    rowsCalculatedFromStats: number;
    rowsMissingScoringInputs: number;
  };
  fantasyPointMethod: "precomputed_fantasy_points_ppr" | "precomputed_fantasy_points" | "calculated_from_stats" | "not_available";
  h37Integration: {
    weeklyResultsInputPath: string;
    scenarioTemplatePath: string;
  };
  dataLeakageGuard: {
    weeklyOutcomesSourceIsOutcomeOnly: boolean;
    notUsedByH36DraftEngine: boolean;
    h37ScoringOnly: boolean;
    noDraftRankingsRecomputed: boolean;
    noLiveOutputsChanged: boolean;
  };
  limitations: string[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  results: HistoricalWeeklyResultsNormalizedRow[];
};

export type HistoricalWeeklyResultsArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
  csvPath: string;
};

