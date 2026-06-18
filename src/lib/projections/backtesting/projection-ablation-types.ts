import type {
  ProjectionBacktestBaselineModel,
  ProjectionBacktestDataset,
  ProjectionBacktestMetricSet,
  ProjectionBacktestOptions,
  ProjectionBacktestPlayerRow,
} from "./projection-backtest-types";

export type ProjectionAblationVariant =
  | "weighted_recent_ppg"
  | "weighted_recent_ppg_plus_baseline_games"
  | "weighted_recent_ppg_plus_availability_games"
  | "weighted_recent_ppg_plus_cohort_games"
  | "weighted_recent_ppg_plus_profile_ppg_adjustment"
  | "weighted_recent_ppg_plus_role_ppg_adjustment"
  | "weighted_recent_ppg_plus_no_prior_priors"
  | "blackbird_v2"
  | "blackbird_v3"
  | "blackbird_expected_games_v4"
  | "blackbird_expected_games_v5_selective"
  | "blackbird_expected_games_v6_gated"
  | "blackbird_expected_games_v7_family_selective"
  | "blackbird_expected_games_v8_cohort_blend"
  | "blackbird_expected_games_v8_1_calibrated_gate"
  | "blackbird_expected_games_v8_2_high_impact_guardrail";

export type ProjectionAblationClassification =
  | "ppg_helped_games_hurt"
  | "games_helped_ppg_hurt"
  | "both_helped"
  | "both_hurt"
  | "neutral";

export type ProjectionAblationRecommendation =
  | "keep_component"
  | "remove_component"
  | "keep_diagnostic_only"
  | "needs_cohort_split"
  | "needs_better_data"
  | "likely_leakage_risk";

export type ProjectionAblationRow = {
  player: string;
  sleeperId: string | null;
  gsisId: string;
  position: string;
  team: string | null;
  cohort: string;
  cohorts: string[];
  actualGames: number;
  actualPpg: number | null;
  actualPoints: number;
  modelName: ProjectionAblationVariant;
  predictedGames: number | null;
  predictedPpg: number | null;
  predictedPoints: number | null;
  ppgError: number | null;
  gamesError: number | null;
  totalError: number | null;
  totalErrorDueToPpg: number | null;
  totalErrorDueToGames: number | null;
  helpedOrWorsenedVsWeightedRecent: "helped" | "worsened" | "unchanged" | "unavailable";
  componentFlags: string[];
  classification: ProjectionAblationClassification;
};

export type ProjectionAblationComponentSummary = {
  variant: ProjectionAblationVariant;
  recommendation: ProjectionAblationRecommendation;
  summary: string;
  playersImproved: number;
  playersWorsened: number;
  playersUnchanged: number;
  netMaeImpact: number | null;
  netPpgMaeImpact: number | null;
  netGamesMaeImpact: number | null;
  netBiasImpact: number | null;
  positionsImproved: string[];
  positionsWorsened: string[];
  cohortsImproved: string[];
  cohortsWorsened: string[];
};

export type ProjectionAblationTable = Record<ProjectionAblationVariant, ProjectionBacktestMetricSet>;

export type ProjectionAblationReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  targetSeason: number;
  inputSeasons: number[];
  leakageSafety: ProjectionBacktestDataset["leakageSafety"] & {
    passed: boolean;
    notes: string[];
  };
  options: ProjectionBacktestOptions;
  variantsEvaluated: ProjectionAblationVariant[];
  rows: ProjectionAblationRow[];
  overall: ProjectionAblationTable;
  byPosition: Record<string, ProjectionAblationTable>;
  byCohort: Record<string, ProjectionAblationTable>;
  componentSummaries: ProjectionAblationComponentSummary[];
  topHelpfulComponents: ProjectionAblationComponentSummary[];
  topHarmfulComponents: ProjectionAblationComponentSummary[];
  ppgComponentFindings: string[];
  gamesComponentFindings: string[];
  noPriorComponentFindings: string[];
  idpFindings: string[];
  recommendedNextModelRecipe: string[];
  sourceModels: Partial<Record<ProjectionAblationVariant, ProjectionBacktestBaselineModel | "synthetic">>;
};

export type ProjectionAblationVariantInput = {
  row: ProjectionBacktestPlayerRow;
  variant: ProjectionAblationVariant;
};
