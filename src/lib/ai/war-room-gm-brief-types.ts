export type WarRoomGmBrief = {
  headline: string;
  draftStateSummary: string;
  rosterNeedSummary: string;
  topRecommendationSummary: string;
  scarcitySummary: string;
  riskSummary: string;
  watchList: string[];
  dataGaps: string[];
  safety: {
    deterministic: true;
    aiApiCalls: false;
    mutatesDraftState: false;
    changesRankings: false;
  };
};
