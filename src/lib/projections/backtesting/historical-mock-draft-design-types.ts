export type HistoricalMockDraftDesignReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  inputsRequired: string[];
  draftSimulationStages: string[];
  baselineStrategies: string[];
  seasonScoringMethods: string[];
  dataLeakageRules: string[];
  metrics: string[];
  futureImplementationPhases: string[];
  knownLimitations: string[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
};

export type HistoricalMockDraftDesignArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
};
