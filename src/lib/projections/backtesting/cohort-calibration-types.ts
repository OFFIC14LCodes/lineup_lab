import type { HistoricalPlayerProfileSnapshot } from "@/lib/player-profiles";

export type BlackbirdCalibrationCohort =
  | "qb_projected_starter"
  | "qb_low_sample_or_backup"
  | "rb_veteran"
  | "rb_low_sample"
  | "wr_veteran"
  | "wr_low_sample"
  | "te_veteran"
  | "te_low_sample"
  | "kicker"
  | "idp_dl"
  | "idp_lb"
  | "idp_db"
  | "rookie_with_source_data"
  | "no_prior_with_role_signal"
  | "no_prior_no_signal"
  | "low_prior_sample";

export type CohortCalibrationInput = {
  profile: HistoricalPlayerProfileSnapshot;
  priorSummaries: HistoricalPlayerProfileSnapshot["seasonSummaries"];
  priorUsage: NonNullable<HistoricalPlayerProfileSnapshot["seasonUsageSummaries"]>[number] | null;
  priorHighValue: NonNullable<HistoricalPlayerProfileSnapshot["seasonHighValueUsageSummaries"]>[number] | null;
  noPrior: boolean;
  noPriorType: string;
  basePpg: number;
  v1Ppg: number;
  v1Games: number;
};

export type CohortCalibrationResult = {
  cohort: BlackbirdCalibrationCohort;
  cohortReason: string;
  expectedGames: number;
  expectedGamesRule: string;
  ppg: number;
  ppgAdjustment: number;
  ppgAdjustmentRule: string;
  confidenceRule: string;
  noPriorRule: string | null;
};
